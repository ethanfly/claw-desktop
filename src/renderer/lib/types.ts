/* ---- Gateway config ---- */
export interface GatewayConfig {
  url: string
  token: string
  password: string
  authMode: 'token' | 'password'
}

/* ---- Message / content ---- */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: ContentBlock[]
  timestamp: number
  id?: string
  senderLabel?: string | null
  toolCallId?: string
  runId?: string
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_call'; name: string; arguments?: unknown }
  | { type: 'tool_result'; name: string; text?: string; output?: string }
  | { type: 'image'; source?: { type?: string; media_type?: string; data?: string } }

/* ---- Attachment ---- */
export interface Attachment {
  dataUrl: string
  mediaType: string
  name: string
}

/* ---- Tool stream ---- */
export type ToolPhase = 'start' | 'update' | 'result'

export interface ToolStreamEntry {
  toolCallId: string
  runId: string
  sessionKey?: string
  name: string
  args?: unknown
  output?: string
  startedAt: number
  updatedAt: number
  phase: ToolPhase
}

/* ---- Sessions ---- */
export interface SessionInfo {
  sessionKey: string
  agentId: string
  lastActivity?: number
  label?: string
  unreadCount?: number
}

/* ---- Gateway protocol events ---- */
export interface ChatEventPayload {
  runId: string
  sessionKey: string
  state: 'delta' | 'final' | 'aborted' | 'error'
  message?: unknown
  errorMessage?: string
}

export interface AgentEventPayload {
  runId: string
  seq: number
  stream: string
  ts: number
  sessionKey?: string
  data: Record<string, unknown>
}

/* ---- Run status ---- */
export interface RunStatus {
  running: boolean
  runId: string | null
  startedAt: number | null
  activeTool?: string | null
}
