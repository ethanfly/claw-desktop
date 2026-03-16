import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useState } from 'react'
import type { ChatMessage, ContentBlock } from '../lib/types'
import { useI18n } from '../lib/i18n'
import ThinkingBlock from './ThinkingBlock'
import AgentAvatar from './AgentAvatar'

interface Props {
  message: ChatMessage
  showThinking: boolean
  showTools: boolean
}

function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const lang = className?.replace('language-', '') || ''
  const code = String(children).replace(/\n$/, '')

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!className) {
    return <code className="bg-dark-800 border border-dark-500 px-1.5 py-0.5 rounded text-[13px]">{children}</code>
  }

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span>{lang || 'code'}</span>
        <button onClick={handleCopy} className="text-dark-300 hover:text-white transition-colors">
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </div>
      <pre className={className}><code className={className}>{children}</code></pre>
    </div>
  )
}

function extractTextFromContent(blocks: ContentBlock[]): string {
  return blocks.filter(b => b.type === 'text').map(b => 'text' in b ? b.text : '').join('\n')
}

export default function MessageBubble({ message, showThinking }: Props) {
  const isUser = message.role === 'user'
  const thinkingBlocks = message.content.filter(b => b.type === 'thinking')
  const imageBlocks = message.content.filter(b => b.type === 'image')
  const textContent = extractTextFromContent(message.content)
  const hasText = textContent.trim().length > 0
  const hasImages = imageBlocks.length > 0

  if (!isUser && textContent.trim() === 'NO_REPLY' && thinkingBlocks.length === 0 && !hasImages) return null

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <AgentAvatar running={false} />
      )}
      <div className={`max-w-[85%] ${isUser ? 'order-first' : ''}`}>
        {showThinking && thinkingBlocks.map((b, i) => (
          <ThinkingBlock key={i} text={'thinking' in b ? b.thinking : ''} />
        ))}
        {hasImages && (
          <div className={`flex gap-2 flex-wrap mb-2 ${isUser ? 'justify-end' : ''}`}>
            {imageBlocks.map((b, i) => {
              const src = 'source' in b && b.source
                ? (b.source.type === 'base64' && b.source.data
                    ? `data:${b.source.media_type ?? 'image/png'};base64,${b.source.data}`
                    : b.source.data ?? '')
                : ''
              if (!src) return null
              return (
                <img
                  key={i}
                  src={src}
                  alt={`attachment-${i}`}
                  className="max-w-xs max-h-64 rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(src, '_blank')}
                />
              )
            })}
          </div>
        )}
        {hasText && (
          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser ? 'bg-accent text-white rounded-br-md' : 'bg-dark-600 text-dark-50 rounded-bl-md'
          }`}>
            {isUser ? (
              <p className="whitespace-pre-wrap break-words">{textContent}</p>
            ) : (
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock as any }}>{textContent}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="shrink-0 w-7 h-7 mt-0.5 rounded-lg bg-dark-500 flex items-center justify-center text-dark-100 text-xs font-bold">U</div>
      )}
    </div>
  )
}
