import { useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage, ToolStreamEntry, RunStatus } from '../lib/types'
import { useI18n } from '../lib/i18n'
import iconImg from '../public/icon.png'
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
  onRefresh: () => void
  connected: boolean
  loading: boolean
}

export default function ChatView({
  messages, streamingText, toolEntries, thinkingText,
  runStatus, showThinking, showTools, onSend, onAbort, onRefresh,
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
      {/* Refresh button - fixed above scroll area */}
      <div className="flex justify-end px-3 py-1.5 bg-dark-900 shrink-0">
        <button
          onClick={onRefresh}
          disabled={runStatus.running || loading}
          title={t('chat.refresh')}
          className="p-2 rounded-lg bg-dark-700/80 hover:bg-dark-600 text-dark-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors backdrop-blur-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <span className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        )}

        {isEmpty && !loading && (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/15 flex items-center justify-center mb-5 glow-accent">
              <img src={iconImg} alt="Claw" className="w-9 h-9" />
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
