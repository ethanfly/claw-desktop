import type {
  GatewayConfig,
  ChatMessage,
} from './types'

/* ================================================================
   OpenClaw Gateway WebSocket Client
   Protocol: req/res + event frames, connect challenge handshake
   With device identity support to preserve operator scopes
   ================================================================ */

// --- Wire frame types ---

interface HelloOk {
  type: 'hello-ok'
  protocol: number
  server?: { version?: string; connId?: string }
  features?: { methods?: string[]; events?: string[] }
  snapshot?: unknown
  policy?: { tickIntervalMs?: number; maxPayload?: number }
  auth?: { deviceToken?: string; role?: string; scopes?: string[] }
}

interface EventFrame {
  type: 'event'
  event: string
  payload?: unknown
  seq?: number
}

interface ResFrame {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: { code: string; message: string; details?: unknown }
}

type Listener = (payload: unknown) => void

class PendingReq {
  resolve = (_v: unknown) => {}
  reject = (_e: Error) => {}
}

// --- Device identity helpers ---
// The OpenClaw gateway clears operator scopes when no device identity
// is presented. Delegating Ed25519 key operations to the main process
// via IPC ensures compatibility regardless of renderer crypto support.

/* eslint-disable @typescript-eslint/no-explicit-any */
const electronAPI = (globalThis as any).electronAPI
/* eslint-enable @typescript-eslint/no-explicit-any */

interface DeviceIdentity {
  deviceId: string
  publicKey: string
  privateKey: string
}

function buildDeviceAuthPayload(params: {
  deviceId: string; clientId: string; clientMode: string
  role: string; scopes: string; signedAtMs: string
  token: string; nonce: string
}): string {
  // Use v2 format to avoid platform/deviceFamily normalization mismatch.
  // Server tries v3 first (which won't match), then falls back to v2.
  // v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce
  return [
    'v2', params.deviceId, params.clientId, params.clientMode,
    params.role, params.scopes, params.signedAtMs,
    params.token, params.nonce,
  ].join('|')
}

// ---- Client ----

export class GatewayClient {
  private ws: WebSocket | null = null
  private pending = new Map<string, PendingReq>()
  private lastSeq: number | null = null
  private nonce: string | null = null
  private cfg: GatewayConfig
  private listeners = new Map<string, Set<Listener>>()
  private _connected = false
  private _hello: HelloOk | null = null
  private closed = false
  private backoff = 800
  private timer: ReturnType<typeof setTimeout> | null = null
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null
  private tickMissTimer: ReturnType<typeof setTimeout> | null = null
  private tickIntervalMs = 30_000

  constructor(cfg: GatewayConfig) {
    this.cfg = { ...cfg }
  }

  /* ---- public state ---- */
  get connected() { return this._connected }
  get hello() { return this._hello }

  updateConfig(patch: Partial<GatewayConfig>) {
    Object.assign(this.cfg, patch)
  }

  /* ---- events ---- */
  on(event: string, fn: Listener): () => void {
    let set = this.listeners.get(event)
    if (!set) { set = new Set(); this.listeners.set(event, set) }
    set.add(fn)
    return () => set!.delete(fn)
  }
  private emit(event: string, payload: unknown) {
    this.listeners.get(event)?.forEach(fn => {
      try { fn(payload) } catch (e) { console.error('[gateway]', e) }
    })
  }

  /* ---- lifecycle ---- */
  connect(): void {
    this.closed = false
    this._doConnect()
  }

  disconnect(): void {
    this.closed = true
    this._connected = false
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    this._stopKeepalive()
    this.ws?.close()
    this.ws = null
    this.flushPending(new Error('disconnected'))
  }

  /* ---- generic request ---- */
  request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('not connected'))
    }
    const id = crypto.randomUUID()
    this.ws.send(JSON.stringify({ type: 'req', id, method, params }))
    return new Promise<T>((resolve, reject) => {
      const p = new PendingReq()
      p.resolve = v => resolve(v as T)
      p.reject = reject
      this.pending.set(id, p)
    })
  }

  /* ---- chat helpers ---- */
  loadHistory(sessionKey: string, limit = 200): Promise<{ messages?: ChatMessage[]; thinkingLevel?: string }> {
    return this.request('chat.history', { sessionKey, limit })
  }

  sendMessage(sessionKey: string, message: string, runId: string, images?: Array<{ media_type: string; data: string; url?: string }>): Promise<void> {
    const params: Record<string, unknown> = {
      sessionKey, message, deliver: false, idempotencyKey: runId,
    }
    if (images && images.length > 0) {
      params.images = images
    }
    return this.request('chat.send', params)
  }

  abortRun(sessionKey: string, runId: string): Promise<void> {
    return this.request('chat.abort', { sessionKey, runId })
  }

  listSessions(activeMinutes = 240): Promise<{ sessions?: unknown[] }> {
    return this.request('sessions.list', { activeMinutes })
  }

  /* ---- internals ---- */

  private _doConnect() {
    if (this.closed) return
    const wsUrl = this.cfg.url
      .replace(/^http:\/\//, 'ws://')
      .replace(/^https:\/\//, 'wss://')

    this.ws = new WebSocket(wsUrl)
    this.ws.addEventListener('open', () => {
      this.nonce = null
      // fallback timer if no challenge arrives
      setTimeout(() => {
        if (!this.nonce && this.ws?.readyState === WebSocket.OPEN) this._sendConnect()
      }, 800)
    })
    this.ws.addEventListener('message', ev => this._onMsg(String(ev.data)))
    this.ws.addEventListener('close', ev => {
      this._connected = false
      this._stopKeepalive()
      this.ws = null
      this.flushPending(new Error(`closed ${ev.code}: ${ev.reason}`))
      this.emit('close', { code: ev.code, reason: ev.reason })
      if (!this.closed) this._scheduleReconnect()
    })
    this.ws.addEventListener('error', () => { /* close fires next */ })
  }

  private _scheduleReconnect() {
    if (this.closed) return
    const ms = this.backoff
    this.backoff = Math.min(this.backoff * 1.6, 15000)
    this.timer = setTimeout(() => this._doConnect(), ms)
  }

  private flushPending(err: Error) {
    for (const p of this.pending.values()) p.reject(err)
    this.pending.clear()
  }

  private async _sendConnect() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.closed) return

    const auth =
      this.cfg.authMode === 'token'
        ? { token: this.cfg.token || undefined }
        : { password: this.cfg.password || undefined }

    const role = 'operator'
    const scopes = ['operator.admin', 'operator.read', 'operator.write', 'operator.approvals', 'operator.pairing']

    // Build device identity via main process IPC
    let device: {
      id: string
      publicKey: string
      signature: string
      signedAt: number
      nonce: string
    } | undefined

    try {
      const identity: DeviceIdentity = await electronAPI?.getDeviceIdentity()
      if (identity) {
        const signedAtMs = Date.now()
        const payload = buildDeviceAuthPayload({
          deviceId: identity.deviceId,
          clientId: 'webchat-ui',
          clientMode: 'webchat',
          role,
          scopes: scopes.join(','),
          signedAtMs: String(signedAtMs),
          token: auth?.token ?? '',
          nonce: this.nonce ?? '',
        })
        const signature: string = await electronAPI?.signDevicePayload(identity.privateKey, payload)
        device = {
          id: identity.deviceId,
          publicKey: identity.publicKey,
          signature,
          signedAt: signedAtMs,
          nonce: this.nonce ?? '',
        }
        console.log('[gateway] device identity attached:', identity.deviceId.slice(0, 8) + '...')
      }
    } catch (e) {
      console.warn('[gateway] device identity not available, connecting without device auth:', e)
    }

    this.request<HelloOk>('connect', {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: 'webchat-ui',
        displayName: 'Claw Desktop',
        version: '1.0.0',
        platform: navigator.platform || 'web',
        mode: 'webchat',
      },
      role,
      scopes,
      device,
      auth,
      userAgent: navigator.userAgent,
      locale: navigator.language,
    })
      .then(hello => {
        this._hello = hello
        this._connected = true
        this.backoff = 800
        this.tickIntervalMs = hello.policy?.tickIntervalMs ?? 30_000
        this._startKeepalive()
        this.emit('hello', hello)
      })
      .catch(err => {
        console.error('[gateway] connect failed:', err)
        this.emit('error', err)
        this.ws?.close()
      })
  }

  private _startKeepalive() {
    this._stopKeepalive()
    this._resetTickMiss()
    // Only start the tick-miss timer; no keepalive ping that could flood the gateway
  }

  private _stopKeepalive() {
    if (this.keepaliveTimer) { clearInterval(this.keepaliveTimer); this.keepaliveTimer = null }
    if (this.tickMissTimer) { clearTimeout(this.tickMissTimer); this.tickMissTimer = null }
  }

  private _resetTickMiss() {
    if (this.tickMissTimer) clearTimeout(this.tickMissTimer)
    // Generous timeout: if no tick for 5 minutes, consider the connection stale.
    // The gateway may not always send ticks, so don't aggressively reconnect.
    this.tickMissTimer = setTimeout(() => {
      if (this._connected && !this.closed) {
        console.warn('[gateway] tick missed for 5 min — sending a ping to check liveness')
        this.request('sessions.list', { activeMinutes: 0 }).catch(() => {
          // If the ping fails, the WebSocket close event will handle reconnection
        })
      }
    }, 5 * 60_000)
  }

  private _onMsg(raw: string) {
    let frame: unknown
    try { frame = JSON.parse(raw) } catch { return }
    const f = frame as { type?: string }

    if (f.type === 'event') {
      const evt = frame as EventFrame

      if (evt.event === 'tick') {
        this._resetTickMiss()
        return
      }

      if (evt.event === 'connect.challenge') {
        const p = evt.payload as { nonce?: string } | undefined
        if (p?.nonce) { this.nonce = p.nonce; this._sendConnect() }
        return
      }

      if (typeof evt.seq === 'number') {
        if (this.lastSeq !== null && evt.seq > this.lastSeq + 1) {
          console.warn(`[gateway] seq gap ${this.lastSeq + 1}→${evt.seq}`)
        }
        this.lastSeq = evt.seq
      }

      this.emit(evt.event, evt.payload)
      return
    }

    if (f.type === 'res') {
      const res = frame as ResFrame
      const p = this.pending.get(res.id)
      if (!p) return
      this.pending.delete(res.id)
      res.ok
        ? p.resolve(res.payload)
        : p.reject(new Error(res.error?.message ?? 'request failed'))
    }
  }
}
