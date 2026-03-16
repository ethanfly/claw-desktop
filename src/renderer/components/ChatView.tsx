import { useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage, ToolStreamEntry, RunStatus } from '../lib/types'
import { useI18n } from '../lib/i18n'
import MessageBubble from './MessageBubble'
import ToolCard from './ToolCard'
import ThinkingBlock from './ThinkingBlock'
import AgentAvatar from './AgentAvatar'
import InputArea from './InputArea'

interface Props {
  messages: ChatMessage[]
  streamingText: string | null
  toolEntries: ToolStreamEntry[]
  thinkingText: string | null
  runStatus: RunStatus
  showThinking: boolean
  showTools: boolean
  onSend: (message: string) => void
  onAbort: () => void
  connected: boolean
  loading: boolean
}

export default function ChatView({
  messages, streamingText, toolEntries, thinkingText,
  runStatus, showThinking, showTools, onSend, onAbort,
  connected, loading
}: Props) {
  const { t } = useI18n()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = bottomRef.current
    if (!el) return
    requestAnimationFrame(() => { el.scrollIntoView({ behavior: 'smooth' }) })
  }, [messages, streamingText, toolEntries, thinkingText])

  const isEmpty = messages.length === 0 && !streamingText && !runStatus.running

  const statusLabel = runStatus.activeTool
    ? `${t('run.using')} ${runStatus.activeTool}...`
    : t('run.processing')

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-dark-900">
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        )}

        {isEmpty && !loading && (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/15 flex items-center justify-center mb-5 glow-accent">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">{t('chat.welcome')}</h2>
            <p className="text-dark-300 text-sm max-w-md">
              {t('chat.welcomeDesc')}
            </p>
            <p className="text-dark-400 text-xs mt-2">{t('chat.welcomeHint')}</p>
          </div>
        )}

        {!isEmpty && (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
            {messages.map((msg, i) => (
              <MessageBubble key={`${msg.timestamp}-${i}`} message={msg} showThinking={showThinking} showTools={showTools} />
            ))}

            {runStatus.running && thinkingText && showThinking && (
              <div className="flex gap-3 animate-fade-in">
                <AgentAvatar running />
                <div className="flex-1"><ThinkingBlock text={thinkingText} defaultOpen /></div>
              </div>
            )}

            {runStatus.running && showTools && toolEntries.map(entry => (
              <div key={entry.toolCallId} className="flex gap-3">
                <AgentAvatar running />
                <div className="flex-1"><ToolCard entry={entry} show /></div>
              </div>
            ))}

            {runStatus.running && streamingText && (
              <div className="flex gap-3 animate-fade-in">
                <AgentAvatar running />
                <div className="flex-1 max-w-[85%]">
                  <div className="bg-dark-600 rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed">
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{streamingText}</ReactMarkdown>
                    </div>
                    <span className="inline-block w-1.5 h-4 bg-accent ml-0.5 animate-pulse rounded-sm align-text-bottom" />
                  </div>
                </div>
              </div>
            )}

            {runStatus.running && !streamingText && !thinkingText && toolEntries.length === 0 && (
              <div className="flex gap-3 animate-fade-in">
                <AgentAvatar running />
                <div className="flex items-center px-1">
                  <span className="text-xs text-dark-200">{statusLabel}</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <InputArea onSend={onSend} onAbort={onAbort} disabled={!connected} running={runStatus.running} />
    </div>
  )
}
