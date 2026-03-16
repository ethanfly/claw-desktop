import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useI18n } from '../lib/i18n'
import type { Attachment } from '../lib/types'

interface Props {
  onSend: (message: string, attachments?: Attachment[]) => void
  onAbort: () => void
  disabled: boolean
  running: boolean
}




export default function InputArea({ onSend, onAbort, disabled, running }: Props) {
  const { t } = useI18n()
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [text])

  const handleSend = () => {
    const msg = text.trim()
    const hasAttachments = attachments.length > 0
    if ((!msg && !hasAttachments) || disabled || running) return
    onSend(msg, attachments)
    setText('')
    setAttachments([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const addFileAttachment = (file: File) => {
    if (attachments.length >= 4) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setAttachments(prev => [...prev, {
        dataUrl,
        mediaType: file.type || 'application/octet-stream',
        name: file.name,
        source: 'file',
      }])
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    for (const file of Array.from(files)) {
      addFileAttachment(file)
    }
    e.target.value = ''
  }

  const addClipboardImage = (dataUrl: string, mediaType: string) => {
    if (attachments.length >= 4) return
    const ts = Date.now().toString(36)
    setAttachments(prev => [...prev, {
      dataUrl,
      mediaType,
      name: `clipboard-${ts}.png`,
      source: 'clipboard',
    }])
  }

  // Handle paste — extract images from clipboard
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (!blob) continue
        const reader = new FileReader()
        reader.onload = () => {
          addClipboardImage(reader.result as string, blob.type)
        }
        reader.readAsDataURL(blob)
      }
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const canSend = !disabled && !running && (text.trim() || attachments.length > 0)

  return (
    <div className="border-t border-dark-500 bg-dark-800 px-4 py-3">
      <div className="max-w-3xl mx-auto">
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex gap-2 mb-2 flex-wrap">
            {attachments.map((att, i) => (
              <div key={i} className="relative group">
                {att.mediaType.startsWith('image/') ? (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="w-16 h-16 object-cover rounded-lg border border-dark-500"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-dark-500 bg-dark-700 flex flex-col items-center justify-center gap-0.5 px-1">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dark-300 shrink-0">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="text-[10px] text-dark-300 truncate w-full text-center">{att.name}</span>
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-dark-900 border border-dark-400 rounded-full flex items-center justify-center text-dark-300 hover:text-white hover:bg-dark-700 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* Attach button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleFileSelect}
            disabled={disabled || running}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-dark-300 hover:text-dark-100 hover:bg-dark-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={t('input.attach')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>

          {/* Textarea */}
          <div className="flex-1 flex items-center">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={disabled ? t('input.disabled') : running ? t('input.running') : t('input.placeholder')}
              disabled={disabled}
              rows={1}
              className="w-full resize-none bg-dark-700 border border-dark-500 rounded-xl px-4 py-3 text-sm text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/40 transition-colors disabled:opacity-40 max-h-[200px] overflow-hidden"
            />
          </div>

          {/* Send / Stop button */}
          {running ? (
            <button onClick={onAbort} className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/15 border border-red-500/20 text-red-400 hover:bg-red-500/25 hover:text-red-300 transition-colors" title={t('input.stop')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            </button>
          ) : (
            <button onClick={handleSend} disabled={!canSend} className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-accent text-white hover:bg-accent-light disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title={t('input.send')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
