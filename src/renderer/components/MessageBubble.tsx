import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useState } from 'react'
import type { ChatMessage, ContentBlock } from '../lib/types'
import { useI18n } from '../lib/i18n'
import ThinkingBlock from './ThinkingBlock'
import AgentAvatar from './AgentAvatar'
import ImagePreview from './ImagePreview'

function FileDownloadCard({ name, mediaType, dataUrl }: { name: string; mediaType: string; dataUrl: string }) {
  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = name
    a.click()
  }

  return (
    <div className="flex items-center gap-3 bg-dark-600 rounded-xl px-4 py-3 max-w-sm hover:bg-dark-500 transition-colors cursor-pointer" onClick={handleDownload}>
      <div className="shrink-0 w-10 h-10 rounded-lg bg-dark-500 flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-dark-300">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <polyline points="9 15 12 18 15 15" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-dark-50 font-medium truncate">{name}</p>
        <p className="text-xs text-dark-400 truncate">{mediaType}</p>
      </div>
    </div>
  )
}

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
  const fileBlocks = message.content.filter((b): b is Extract<ContentBlock, { type: 'file' }> => b.type === 'file')
  const textContent = extractTextFromContent(message.content)
  const hasText = textContent.trim().length > 0
  const hasImages = imageBlocks.length > 0
  const hasFiles = fileBlocks.length > 0
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)

  if (!isUser && textContent.trim() === 'NO_REPLY' && thinkingBlocks.length === 0 && !hasImages && !hasFiles) return null

  // Helper to get proper image src - handles both raw base64 and full data URLs
  const getImageSrc = (block: Extract<ContentBlock, { type: 'image' }>): string | null => {
    if (!('source' in block) || !block.source) return null
    const { type, media_type, data } = block.source
    if (!data) return null

    // If data already has data: prefix, use it directly (avoid double-prefix)
    if (data.startsWith('data:')) return data

    // If source type is url (e.g., from image_url blocks), use directly
    if (type === 'url') return data

    // Otherwise, construct the data URL from base64
    if (type === 'base64') {
      return `data:${media_type ?? 'image/png'};base64,${data}`
    }

    return data
  }

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <AgentAvatar running={false} />
      )}
      <div className={`max-w-[85%] ${isUser ? 'order-first' : ''}`}>
        {showThinking && thinkingBlocks.map((b, i) => (
          <ThinkingBlock key={i} text={'thinking' in b ? b.thinking : ''} />
        ))}
        {hasFiles && (
          <div className={`flex gap-2 flex-wrap mb-2 ${isUser ? 'justify-end' : ''}`}>
            {fileBlocks.map((b, i) => (
              <FileDownloadCard key={i} name={b.name} mediaType={b.media_type} dataUrl={b.data} />
            ))}
          </div>
        )}
        {hasImages && (
          <div className={`flex gap-2 flex-wrap mb-2 ${isUser ? 'justify-end' : ''}`}>
            {imageBlocks.map((b, i) => {
              const src = getImageSrc(b)
              if (!src) return null
              return (
                <img
                  key={i}
                  src={src}
                  alt={`attachment-${i}`}
                  className="max-w-xs max-h-64 rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity shadow-lg hover:shadow-xl hover:scale-[1.02] transform duration-200"
                  onClick={() => setPreviewSrc(src)}
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
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code: CodeBlock as any,
                    img: ({ src, alt, ...props }: any) => (
                      <img
                        {...props}
                        src={src}
                        alt={alt}
                        className="max-w-full max-h-80 rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity shadow-lg"
                        onClick={() => src && setPreviewSrc(src)}
                      />
                    ),
                  }}
                >
                  {textContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>
      {isUser && (
        <div className="shrink-0 w-7 h-7 mt-0.5 rounded-lg bg-dark-500 flex items-center justify-center text-dark-100 text-xs font-bold">U</div>
      )}
      <ImagePreview src={previewSrc ?? ''} visible={!!previewSrc} onClose={() => setPreviewSrc(null)} />
    </div>
  )
}
