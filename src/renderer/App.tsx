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
      if (b.type === 'image') return { type: 'image', source: b.source }
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

  /* ---- chat state ---- */
  const [sessions, setSessions] = useState<SessionInfo[]>([])
  const [currentSession, setCurrentSession] = useState('agent:main:main:default')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamingText, setStreamingText] = useState<string | null>(null)
  const [toolEntries, setToolEntries] = useState<ToolStreamEntry[]>([])
  const [thinkingText, setThinkingText] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<RunStatus>({ running: false, runId: null, startedAt: null })
  const [loading, setLoading] = useState(false)

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

  /* ---- refs for event handlers ---- */
  const clientRef = useRef<GatewayClient | null>(null)
  const sessionRef = useRef(currentSession)
  const streamingRef = useRef(streamingText)
  const runIdRef = useRef<string | null>(null)

  useEffect(() => { sessionRef.current = currentSession }, [currentSession])
  useEffect(() => { streamingRef.current = streamingText }, [streamingText])

  /* ---- persist toggles ---- */
  useEffect(() => { localStorage.setItem('claw-show-thinking', String(showThinking)) }, [showThinking])
  useEffect(() => { localStorage.setItem('claw-show-tools', String(showTools)) }, [showTools])

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
    setLoading(true)
    try {
      const res = await client.loadHistory(sessionKey)
      const raw: unknown[] = Array.isArray(res.messages) ? res.messages : []
      setMessages(raw.filter(m => !isSilent(m)).map(normalizeMessage).filter((m): m is ChatMessage => m !== null))
    } catch (e) {
      console.error('Failed to load history:', e)
    } finally {
      setLoading(false)
    }
  }, [])

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
      // Reset stale run state from before disconnect
      setRunStatus({ running: false, runId: null, startedAt: null, activeTool: null })
      setStreamingText(null)
      setThinkingText(null)
      setToolEntries([])
      runIdRef.current = null
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
      if (p.sessionKey && p.sessionKey !== sessionRef.current) return

      if (p.state === 'delta') {
        const text = extractText(p.message)
        if (text && !SILENT.test(text)) {
          const cur = streamingRef.current ?? ''
          if (!cur || text.length >= cur.length) {
            setStreamingText(text)
          }
        }
        const think = extractThinking(p.message)
        if (think) setThinkingText(think)
      } else if (p.state === 'final') {
        const norm = normalizeMessage(p.message)
        if (norm && !isSilent(p.message)) {
          setMessages(prev => [...prev, norm])
        } else if (streamingRef.current && !SILENT.test(streamingRef.current)) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: [{ type: 'text', text: streamingRef.current! }],
            timestamp: Date.now(),
          }])
        }
        setStreamingText(null)
        setThinkingText(null)
        setToolEntries([])
        setRunStatus({ running: false, runId: null, startedAt: null, activeTool: null })
        runIdRef.current = null
        // Refresh sessions after run completes
        refreshSessions(client)
      } else if (p.state === 'aborted') {
        const partial = streamingRef.current
        if (partial && !SILENT.test(partial)) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: [{ type: 'text', text: partial }],
            timestamp: Date.now(),
          }])
        }
        const norm = normalizeMessage(p.message)
        if (norm && !isSilent(p.message)) {
          // Replace the partial message with the normalized one if available
          setMessages(prev => {
            const updated = [...prev]
            // If the last message was the partial we just added, replace it
            const lastIdx = updated.length - 1
            if (lastIdx >= 0 && updated[lastIdx].role === 'assistant' && !updated[lastIdx].id) {
              updated[lastIdx] = norm
            } else {
              updated.push(norm)
            }
            return updated
          })
        }
        setStreamingText(null)
        setThinkingText(null)
        setToolEntries([])
        setRunStatus({ running: false, runId: null, startedAt: null, activeTool: null })
        runIdRef.current = null
      } else if (p.state === 'error') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: [{ type: 'text', text: `Error: ${p.errorMessage ?? 'unknown error'}` }],
          timestamp: Date.now(),
        }])
        setStreamingText(null)
        setThinkingText(null)
        setToolEntries([])
        setRunStatus({ running: false, runId: null, startedAt: null, activeTool: null })
        runIdRef.current = null
      }
    })

    client.on('agent', (payload) => {
      const p = payload as AgentEventPayload
      if (p.sessionKey && p.sessionKey !== sessionRef.current) return
      if (!runIdRef.current) return

      // Thinking stream
      if (p.stream === 'thinking') {
        const text = typeof p.data?.text === 'string' ? p.data.text : null
        if (text) setThinkingText(prev => (prev ?? '') + text)
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

        setToolEntries(prev => {
          const existing = prev.find(e => e.toolCallId === toolCallId)
          if (!existing) {
            // Commit streaming text segment before new tool
            setStreamingText(cur => {
              if (cur && cur.trim()) {
                // text is committed implicitly (already shown above)
              }
              return cur
            })
            return [...prev, {
              toolCallId, runId: p.runId, sessionKey: p.sessionKey,
              name, args, output: output || undefined,
              startedAt: typeof p.ts === 'number' ? p.ts : now,
              updatedAt: now, phase: phase as ToolStreamEntry['phase'],
            }]
          }
          return prev.map(e => {
            if (e.toolCallId !== toolCallId) return e
            return { ...e, name, args: args ?? e.args, output: output ?? e.output, updatedAt: now, phase: phase as ToolStreamEntry['phase'] }
          })
        })

        // Update active tool for indicator
        if (phase === 'start') {
          setRunStatus(prev => ({ ...prev, activeTool: name }))
        } else if (phase === 'result') {
          setRunStatus(prev => {
            const stillActive = prev.activeTool === name
            return stillActive ? { ...prev, activeTool: null } : prev
          })
        }
        return
      }

      // Compaction
      if (p.stream === 'compaction') {
        const phase = String(p.data?.phase ?? '')
        if (phase === 'start') {
          setRunStatus(prev => ({ ...prev, activeTool: 'Compacting context...' }))
        } else if (phase === 'end') {
          setRunStatus(prev => prev.activeTool?.includes('Compacting') ? { ...prev, activeTool: null } : prev)
        }
      }
    })

    client.on('close', () => {
      setConnected(false)
      // Reset run state so UI doesn't stay in loading
      setRunStatus({ running: false, runId: null, startedAt: null, activeTool: null })
      setStreamingText(null)
      setThinkingText(null)
      setToolEntries([])
      runIdRef.current = null
    })

    client.connect()
  }, [loadHistory, refreshSessions])

  /* ---- disconnect ---- */
  const handleDisconnect = useCallback(() => {
    clientRef.current?.disconnect()
    clientRef.current = null
    setConnected(false)
    setView('connect')
    setMessages([])
    setStreamingText(null)
    setToolEntries([])
    setThinkingText(null)
    setRunStatus({ running: false, runId: null, startedAt: null })
    runIdRef.current = null
  }, [])

  /* ---- send message ---- */
  const handleSend = useCallback(async (text: string, attachments: Attachment[] = []) => {
    const client = clientRef.current
    if (!client || !connected) return
    if (runStatus.running) return // Block while running

    const runId = crypto.randomUUID()
    runIdRef.current = runId

    // Build content blocks from text + attachments
    const content: ContentBlock[] = []
    for (const att of attachments) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: att.mediaType,
          data: att.dataUrl.replace(/^data:[^;]+;base64,/, ''),
        },
      })
    }
    if (text.trim()) {
      content.push({ type: 'text', text })
    }

    // Optimistically add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: content.length > 0 ? content : [{ type: 'text', text }],
      timestamp: Date.now(),
    }])

    // Clear streaming state
    setStreamingText('')
    setThinkingText(null)
    setToolEntries([])
    setRunStatus({ running: true, runId, startedAt: Date.now() })

    try {
      await client.sendMessage(sessionRef.current, text, runId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: [{ type: 'text', text: `Error: ${msg}` }],
        timestamp: Date.now(),
      }])
      setRunStatus({ running: false, runId: null, startedAt: null })
      setStreamingText(null)
      runIdRef.current = null
    }
  }, [connected, runStatus.running])

  /* ---- abort ---- */
  const handleAbort = useCallback(async () => {
    const client = clientRef.current
    if (!client || !runIdRef.current) return
    try {
      await client.abortRun(sessionRef.current, runIdRef.current)
    } catch (e) {
      console.error('Abort failed:', e)
    }
  }, [])

  /* ---- new session ---- */
  const handleNewSession = useCallback(() => {
    if (runStatus.running) return
    const key = `agent:main:main:${crypto.randomUUID().slice(0, 8)}`
    setCurrentSession(key)
    sessionRef.current = key
    setMessages([])
    setStreamingText(null)
    setToolEntries([])
    setThinkingText(null)
    runIdRef.current = null
  }, [runStatus.running])

  /* ---- select session ---- */
  const handleSelectSession = useCallback(async (key: string) => {
    if (runStatus.running) return
    if (key === sessionRef.current) return
    setCurrentSession(key)
    sessionRef.current = key
    setMessages([])
    setStreamingText(null)
    setToolEntries([])
    setThinkingText(null)
    runIdRef.current = null

    const client = clientRef.current
    if (client && connected) {
      loadHistory(client, key)
    }
  }, [connected, runStatus.running, loadHistory])

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
        messages={messages}
        streamingText={streamingText}
        toolEntries={toolEntries}
        thinkingText={thinkingText}
        runStatus={runStatus}
        showThinking={showThinking}
        showTools={showTools}
        onSend={handleSend}
        onAbort={handleAbort}
        connected={connected}
        loading={loading}
      />
      </div>
    </div>
    </I18nContext.Provider>
  )
}
