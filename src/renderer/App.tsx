import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { GatewayClient } from './lib/gateway'
import type {
  GatewayConfig, ChatMessage, ToolStreamEntry, SessionInfo,
  ChatEventPayload, AgentEventPayload, RunStatus, ContentBlock, Attachment,
} from './lib/types'
import { I18nContext, detectLang, t as translate } from './lib/i18n'
import type { Lang } from './lib/i18n'
import ConnectDialog from './components/ConnectDialog'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import TitleBar from './components/TitleBar'

/* ---- helpers ---- */

const SILENT = /^\s*NO_REPLY\s*$/

function extractText(msg: unknown): string | null {
  if (!msg || typeof msg !== 'object') return null
  const m = msg as Record<string, unknown>
  if (typeof m.text === 'string') return m.text
  if (Array.isArray(m.content)) {
    const tb = m.content.find((b: any) => b.type === 'text')
    if (tb && typeof tb.text === 'string') return tb.text
  }
  return null
}

function extractThinking(msg: unknown): string | null {
  if (!msg || typeof msg !== 'object') return null
  const m = msg as Record<string, unknown>
  if (typeof m.thinking === 'string') return m.thinking
  if (Array.isArray(m.content)) {
    const tb = m.content.find((b: any) => b.type === 'thinking')
    if (tb) return String(tb.thinking ?? tb.text ?? '')
  }
  return null
}

function normalizeMessage(msg: unknown): ChatMessage | null {
  if (!msg || typeof msg !== 'object') return null
  const m = msg as Record<string, unknown>
  const role = (typeof m.role === 'string' ? m.role : 'assistant') as ChatMessage['role']
  const timestamp = typeof m.timestamp === 'number' ? m.timestamp : Date.now()

  let content: ContentBlock[]
  if (Array.isArray(m.content)) {
    content = m.content.map((b: any): ContentBlock => {
      if (b.type === 'thinking') return { type: 'thinking', thinking: String(b.thinking ?? b.text ?? '') }
      if (b.type === 'tool_call' || b.type === 'toolcall') return { type: 'tool_call', name: String(b.name ?? ''), arguments: b.args ?? b.arguments }
      if (b.type === 'tool_result' || b.type === 'toolresult') return { type: 'tool_result', name: String(b.name ?? ''), text: b.text ?? b.output ?? undefined, output: b.output }
      if (b.type === 'image_url' && typeof b.image_url === 'object' && b.image_url?.url) {
        const url = typeof b.image_url.url === 'string' ? b.image_url.url : ''
        return { type: 'image', source: { type: 'url', data: url } }
      }
      if (b.type === 'image') return { type: 'image', source: b.source }
      if (b.type === 'file') return { type: 'file', name: String(b.name ?? 'unknown'), media_type: String(b.media_type ?? b.mediaType ?? 'application/octet-stream'), data: String(b.data ?? b.dataUrl ?? '') }
      return { type: 'text', text: String(b.text ?? '') }
    })
  } else {
    content = [{ type: 'text', text: typeof m.text === 'string' ? m.text : '' }]
  }

  return { role, content, timestamp, id: m.id as string | undefined, toolCallId: m.toolCallId as string | undefined, runId: m.runId as string | undefined }
}

function isSilent(msg: unknown): boolean {
  if (!msg || typeof msg !== 'object') return false
  const m = msg as Record<string, unknown>
  if ((m.role as string)?.toLowerCase() !== 'assistant') return false
  const t = typeof m.text === 'string' ? m.text : extractText(m)
  return t ? SILENT.test(t) : false
}

function formatToolOutput(val: unknown): string | undefined {
  if (val == null) return undefined
  if (typeof val === 'string') return val || undefined
  if (typeof val === 'object') {
    const r = val as Record<string, unknown>
    if (typeof r.text === 'string') return r.text || undefined
    const c = r.content
    if (Array.isArray(c)) {
      const parts = c.map((p: any) => (p.type === 'text' && typeof p.text === 'string') ? p.text : '').filter(Boolean)
      if (parts.length) return parts.join('\n')
    }
    try { return JSON.stringify(val, null, 2) } catch { /* ignore */ }
  }
  return String(val) || undefined
}

/* ---- storage ---- */

const STORAGE_KEY = 'claw-desktop-config'

const DEFAULT_CONFIG: GatewayConfig = {
  url: 'http://127.0.0.1:18789',
  token: '',
  password: '',
  authMode: 'token',
}

function loadSavedConfig(): GatewayConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch { /* ignore */ }
  return { ...DEFAULT_CONFIG }
}

function saveConfig(c: GatewayConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)) } catch { /* ignore */ }
}

/* ---- per-session state ---- */

interface SessionState {
  messages: ChatMessage[]
  streamingText: string | null
  thinkingText: string | null
  toolEntries: ToolStreamEntry[]
  runStatus: RunStatus
  loading: boolean
}

function emptySessionState(): SessionState {
  return {
    messages: [],
    streamingText: null,
    thinkingText: null,
    toolEntries: [],
    runStatus: { running: false, runId: null, startedAt: null },
    loading: false,
  }
}

/* ================================================================
   App
   ================================================================ */

export default function App() {
  /* ---- view / connection ---- */
  const [view, setView] = useState<'connect' | 'chat'>('connect')
  const [config, setConfig] = useState<GatewayConfig>(loadSavedConfig)
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  /* ---- chat state (per-session) ---- */
  const handleConnectRef = useRef<ReturnType<typeof handleConnect>>()

  /* ---- auto-connect from openclaw config on startup ---- */
  useEffect(() => {
    if (view !== 'connect') return
    const read = window.electronAPI?.readOpenClawConfig
    if (!read) return
    read().then(res => {
      if (!res || !res.url) return
      console.log('[app] auto-loading openclaw config:', { url: res.url, authMode: res.authMode, hasToken: !!res.token })
      if (handleConnectRef.current) {
        handleConnectRef.current({ url: res.url, authMode: res.authMode, token: res.token, password: res.password })
      }
    }).catch(() => { /* show connect dialog */ })
  }, [view])

  /* ---- tray new session shortcut ---- */
  useEffect(() => {
    if (view !== 'chat') return
    const off = window.electronAPI?.onTrayNewSession?.(() => {
      handleNewSession()
    })
    return () => off?.()
  }, [view])

  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [currentSession, setCurrentSession] = useState('agent:main:main:default')
  const [sessionStates, setSessionStates] = useState<Record<string, SessionState>>({})

  /* ---- UI toggles ---- */
  const [showThinking, setShowThinking] = useState(() => {
    try { return localStorage.getItem('claw-show-thinking') !== 'false' } catch { return true }
  })
  const [showTools, setShowTools] = useState(() => {
    try { return localStorage.getItem('claw-show-tools') !== 'false' } catch { return true }
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  /* ---- i18n ---- */
  const [lang, setLang] = useState<Lang>(detectLang)
  const i18nValue = useMemo(() => ({
    lang, setLang,
    t: (key: string, params?: Record<string, string>) => translate(key, lang, params),
  }), [lang])

  useEffect(() => { localStorage.setItem('claw-lang', lang) }, [lang])

  /* ---- refs ---- */
  const clientRef = useRef<GatewayClient | null>(null)
  const sessionRef = useRef(currentSession)
  const runIdMapRef = useRef<Record<string, string>>({})
  const streamingMapRef = useRef<Record<string, string>>({})

  useEffect(() => { sessionRef.current = currentSession }, [currentSession])

  /* ---- persist toggles ---- */
  useEffect(() => { localStorage.setItem('claw-show-thinking', String(showThinking)) }, [showThinking])
  useEffect(() => { localStorage.setItem('claw-show-tools', String(showTools)) }, [showTools])

  /* ---- helpers to update per-session state ---- */
  const updateSession = useCallback((key: string, updater: (prev: SessionState) => SessionState) => {
    setSessionStates(prev => {
      const cur = prev[key] ?? emptySessionState()
      return { ...prev, [key]: updater(cur) }
    })
  }, [])

  const current = sessionStates[currentSession] ?? emptySessionState()

  /* ---- load sessions from gateway ---- */
  const refreshSessions = useCallback(async (client: GatewayClient) => {
    try {
      const res = await client.listSessions()
      const raw: unknown[] = Array.isArray(res.sessions) ? res.sessions : []
      const list: SessionInfo[] = raw.map((s: any) => ({
        sessionKey: s.sessionKey ?? s.key ?? '',
        agentId: s.agentId ?? 'main',
        lastActivity: s.lastActivity ?? s.last_active_at,
        label: s.label ?? undefined,
      })).filter((s: SessionInfo) => s.sessionKey)
      setSessions(list)
    } catch { /* sessions.list may not be available */ }
  }, [])

  /* ---- load chat history ---- */
  const loadHistory = useCallback(async (client: GatewayClient, sessionKey: string) => {
    updateSession(sessionKey, s => ({ ...s, loading: true }))
    try {
      const res = await client.loadHistory(sessionKey)
      const raw: unknown[] = Array.isArray(res.messages) ? res.messages : []
      updateSession(sessionKey, s => ({
        ...s,
        messages: raw.filter(m => !isSilent(m)).map(normalizeMessage).filter((m): m is ChatMessage => m !== null),
        loading: false,
      }))
    } catch (e) {
      console.error('Failed to load history:', e)
      updateSession(sessionKey, s => ({ ...s, loading: false }))
    }
  }, [updateSession])

  /* ---- connect ---- */
  const handleConnect = useCallback((cfg: GatewayConfig) => {
    setConnecting(true)
    setConnectError(null)
    saveConfig(cfg)
    setConfig(cfg)

    const client = new GatewayClient(cfg)
    clientRef.current = client

    client.on('hello', async () => {
      setConnected(true)
      setConnecting(false)
      setConnectError(null)
      setView('chat')
      // Reset all session states
      setSessionStates({})
      runIdMapRef.current = {}
      streamingMapRef.current = {}
      await loadHistory(client, sessionRef.current)
      refreshSessions(client)
    })

    client.on('error', (payload) => {
      const msg = payload instanceof Error ? payload.message : String(payload)
      setConnectError(msg)
      setConnecting(false)
    })

    client.on('chat', (payload) => {
      const p = payload as ChatEventPayload
      // Route events by sessionKey
      const key = p.sessionKey || sessionRef.current
      const streaming = streamingMapRef.current[key] ?? null

      if (p.state === 'delta') {
        const text = extractText(p.message)
        if (text && !SILENT.test(text)) {
          const cur = streaming
          if (!cur || text.length >= cur.length) {
            streamingMapRef.current[key] = text
            updateSession(key, s => ({ ...s, streamingText: text }))
          }
        }
        const think = extractThinking(p.message)
        if (think) {
          updateSession(key, s => ({ ...s, thinkingText: (s.thinkingText ?? '') + think }))
        }
      } else if (p.state === 'final') {
        const norm = normalizeMessage(p.message)
        const partial = streamingMapRef.current[key]
        if (norm && !isSilent(p.message)) {
          updateSession(key, s => ({ ...s, messages: [...s.messages, norm] }))
        } else if (partial && !SILENT.test(partial)) {
          updateSession(key, s => ({ ...s, messages: [...s.messages, { role: 'assistant', content: [{ type: 'text', text: partial }], timestamp: Date.now() }] }))
        }
        streamingMapRef.current[key] = null
        delete runIdMapRef.current[key]
        updateSession(key, s => ({ ...s, streamingText: null, thinkingText: null, toolEntries: [], runStatus: { running: false, runId: null, startedAt: null, activeTool: null } }))
        refreshSessions(client)
      } else if (p.state === 'aborted') {
        const partial = streamingMapRef.current[key]
        if (partial && !SILENT.test(partial)) {
          updateSession(key, s => ({
            ...s,
            messages: [...s.messages, { role: 'assistant', content: [{ type: 'text', text: partial }], timestamp: Date.now() }],
          }))
        }
        const norm = normalizeMessage(p.message)
        if (norm && !isSilent(p.message)) {
          updateSession(key, s => {
            const updated = [...s.messages]
            const lastIdx = updated.length - 1
            if (lastIdx >= 0 && updated[lastIdx].role === 'assistant' && !updated[lastIdx].id) {
              updated[lastIdx] = norm
            } else {
              updated.push(norm)
            }
            return { ...s, messages: updated }
          })
        }
        streamingMapRef.current[key] = null
        delete runIdMapRef.current[key]
        updateSession(key, s => ({ ...s, streamingText: null, thinkingText: null, toolEntries: [], runStatus: { running: false, runId: null, startedAt: null, activeTool: null } }))
      } else if (p.state === 'error') {
        updateSession(key, s => ({
          ...s,
          messages: [...s.messages, { role: 'assistant', content: [{ type: 'text', text: `Error: ${p.errorMessage ?? 'unknown error'}` }], timestamp: Date.now() }],
          streamingText: null, thinkingText: null, toolEntries: [],
          runStatus: { running: false, runId: null, startedAt: null, activeTool: null },
        }))
        streamingMapRef.current[key] = null
        delete runIdMapRef.current[key]
      }
    })

    client.on('agent', (payload) => {
      const p = payload as AgentEventPayload
      const key = p.sessionKey || sessionRef.current
      const runId = runIdMapRef.current[key]
      if (!runId) return

      // Thinking stream
      if (p.stream === 'thinking') {
        const text = typeof p.data?.text === 'string' ? p.data.text : null
        if (text) {
          updateSession(key, s => ({ ...s, thinkingText: (s.thinkingText ?? '') + text }))
        }
        return
      }

      // Tool stream
      if (p.stream === 'tool') {
        const data = p.data
        const toolCallId = String(data.toolCallId ?? '')
        const name = String(data.name ?? 'tool')
        const phase = String(data.phase ?? 'start')
        const args = phase === 'start' ? data.args : undefined
        const output = phase === 'update'
          ? formatToolOutput(data.partialResult)
          : phase === 'result'
            ? formatToolOutput(data.result)
            : undefined
        const now = Date.now()

        updateSession(key, s => {
          const existing = s.toolEntries.find(e => e.toolCallId === toolCallId)
          let newEntries: ToolStreamEntry[]
          if (!existing) {
            newEntries = [...s.toolEntries, {
              toolCallId, runId: p.runId, sessionKey: p.sessionKey,
              name, args, output: output || undefined,
              startedAt: typeof p.ts === 'number' ? p.ts : now,
              updatedAt: now, phase: phase as ToolStreamEntry['phase'],
            }]
          } else {
            newEntries = s.toolEntries.map(e => {
              if (e.toolCallId !== toolCallId) return e
              return { ...e, name, args: args ?? e.args, output: output ?? e.output, updatedAt: now, phase: phase as ToolStreamEntry['phase'] }
            })
          }
          return { ...s, toolEntries: newEntries }
        })

        if (phase === 'start') {
          updateSession(key, s => ({ ...s, runStatus: { ...s.runStatus, activeTool: name } }))
        } else if (phase === 'result') {
          updateSession(key, s => {
            const stillActive = s.runStatus.activeTool === name
            return { ...s, runStatus: stillActive ? { ...s.runStatus, activeTool: null } : s.runStatus }
          })
        }
        return
      }

      // Compaction
      if (p.stream === 'compaction') {
        const phase = String(p.data?.phase ?? '')
        if (phase === 'start') {
          updateSession(key, s => ({ ...s, runStatus: { ...s.runStatus, activeTool: 'Compacting context...' } }))
        } else if (phase === 'end') {
          updateSession(key, s => s.runStatus.activeTool?.includes('Compacting') ? { ...s, runStatus: { ...s.runStatus, activeTool: null } } : s)
        }
      }
    })

    client.on('close', () => {
      setConnected(false)
      setSessionStates(prev => {
        const next: Record<string, SessionState> = {}
        for (const [k, v] of Object.entries(prev)) {
          next[k] = {
            ...v,
            streamingText: null, thinkingText: null, toolEntries: [],
            runStatus: { running: false, runId: null, startedAt: null, activeTool: null },
          }
        }
        return next
      })
      runIdMapRef.current = {}
      streamingMapRef.current = {}
    })

    client.connect()
  }, [loadHistory, refreshSessions, updateSession])
  handleConnectRef.current = handleConnect

  /* ---- disconnect ---- */
  const handleDisconnect = useCallback(() => {
    clientRef.current?.disconnect()
    clientRef.current = null
    setConnected(false)
    setView('connect')
    setSessionStates({})
    runIdMapRef.current = {}
    streamingMapRef.current = {}
  }, [])

  /* ---- send message ---- */
  const handleSend = useCallback(async (text: string, attachments: Attachment[] = []) => {
    const client = clientRef.current
    if (!client || !connected) return
    const key = sessionRef.current
    const state = sessionStates[key]
    if (state?.runStatus.running) return

    const runId = crypto.randomUUID()
    runIdMapRef.current[key] = runId
    streamingMapRef.current[key] = null

    // Helper to strip data URL prefix, returning raw base64
    const stripDataUrl = (dataUrl: string): string => {
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
      return match ? match[2] : dataUrl
    }

    const content: ContentBlock[] = attachments.map(att => {
      const isImage = att.mediaType.startsWith('image/')
      if (isImage) {
        // For images, store only raw base64 (strip data: prefix)
        return {
          type: 'image' as const,
          source: { type: 'base64', media_type: att.mediaType, data: stripDataUrl(att.dataUrl) },
        }
      } else {
        // For non-image files, store full data URL for download
        return {
          type: 'file' as const,
          name: att.name,
          media_type: att.mediaType,
          data: att.dataUrl,
        }
      }
    })
    if (text.trim()) {
      content.push({ type: 'text', text })
    }

    updateSession(key, s => ({
      ...s,
      messages: [...s.messages, { role: 'user', content: content.length > 0 ? content : [{ type: 'text', text }], timestamp: Date.now() }],
      streamingText: '',
      thinkingText: null,
      toolEntries: [],
      runStatus: { running: true, runId, startedAt: Date.now() },
    }))

    const gatewayAttachments = attachments.length > 0
      ? attachments.map(att => ({ type: 'image', mimeType: att.mediaType, fileName: att.name, content: att.dataUrl }))
      : undefined

    try {
      await client.sendMessage(key, text, runId, gatewayAttachments)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      updateSession(key, s => ({
        ...s,
        messages: [...s.messages, { role: 'assistant', content: [{ type: 'text', text: `Error: ${msg}` }], timestamp: Date.now() }],
        runStatus: { running: false, runId: null, startedAt: null },
        streamingText: null,
      }))
      delete runIdMapRef.current[key]
    }
  }, [connected, sessionStates, updateSession])

  /* ---- abort ---- */
  const handleAbort = useCallback(async () => {
    const client = clientRef.current
    const key = sessionRef.current
    const runId = runIdMapRef.current[key]
    if (!client || !runId) return
    try {
      await client.abortRun(key, runId)
    } catch (e) {
      console.error('Abort failed:', e)
    }
  }, [])

  /* ---- new session ---- */
  const handleNewSession = useCallback(() => {
    const key = `agent:main:main:${crypto.randomUUID().slice(0, 8)}`
    setCurrentSession(key)
    sessionRef.current = key
    // Don't clear other sessions' states
  }, [])

  /* ---- select session ---- */
  const handleSelectSession = useCallback(async (key: string) => {
    if (key === sessionRef.current) return
    setCurrentSession(key)
    sessionRef.current = key
    // Load history if not cached
    const client = clientRef.current
    if (client && connected && !sessionStates[key]?.messages.length) {
      loadHistory(client, key)
    }
  }, [connected, sessionStates, loadHistory])

  /* ---- refresh current session ---- */
  const handleRefresh = useCallback(async () => {
    const client = clientRef.current
    if (client && connected) {
      await loadHistory(client, sessionRef.current)
      refreshSessions(client)
    }
  }, [connected, loadHistory, refreshSessions])

  /* ---- render ---- */

  if (view === 'connect') {
    return (
      <I18nContext.Provider value={i18nValue}>
        <div className="h-screen w-screen flex flex-col bg-dark-900">
          <TitleBar connected={false} />
        <div className="flex-1 flex items-center justify-center">
          <ConnectDialog
            config={config}
            onConnect={handleConnect}
            connecting={connecting}
            error={connectError}
          />
        </div>
      </div>
      </I18nContext.Provider>
    )
  }

  return (
    <I18nContext.Provider value={i18nValue}>
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-dark-900">
      <TitleBar connected={connected} />
      <div className="flex flex-1 min-h-0">
        <Sidebar
        sessions={sessions}
        currentSession={currentSession}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDisconnect={handleDisconnect}
        connected={connected}
        showThinking={showThinking}
        onToggleThinking={() => setShowThinking(v => !v)}
        showTools={showTools}
        onToggleTools={() => setShowTools(v => !v)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(v => !v)}
      />
      <ChatView
        messages={current.messages}
        streamingText={current.streamingText}
        toolEntries={current.toolEntries}
        thinkingText={current.thinkingText}
        runStatus={current.runStatus}
        showThinking={showThinking}
        showTools={showTools}
        onSend={handleSend}
        onAbort={handleAbort}
        onRefresh={handleRefresh}
        connected={connected}
        loading={current.loading}
      />
      </div>
    </div>
    </I18nContext.Provider>
  )
}
