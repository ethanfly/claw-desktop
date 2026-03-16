import { useState } from 'react'
import { useI18n } from '../lib/i18n'

interface Props {
  text: string
  defaultOpen?: boolean
}

export default function ThinkingBlock({ text, defaultOpen = false }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState(defaultOpen)

  if (!text.trim()) return null

  return (
    <div className="my-2 animate-slide-up">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-xs text-dark-300 hover:text-dark-100 transition-colors group">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform ${open ? 'rotate-90' : ''}`}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="group-hover:text-accent-light">{t('msg.thinking')}</span>
        <span className="text-dark-400">({text.length} {t('msg.chars')})</span>
      </button>
      {open && (
        <div className="mt-2 ml-5 pl-3 border-l-2 border-accent/20 text-sm text-dark-300 leading-relaxed whitespace-pre-wrap break-words animate-fade-in">
          {text}
        </div>
      )}
    </div>
  )
}
