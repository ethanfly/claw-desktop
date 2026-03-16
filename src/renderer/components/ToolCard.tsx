import { useState } from 'react'
import type { ToolStreamEntry } from '../lib/types'
import { useI18n } from '../lib/i18n'

interface Props {
  entry: ToolStreamEntry
  show?: boolean
}

function formatArgs(args: unknown): string {
  if (!args) return ''
  try {
    const s = JSON.stringify(args)
    return s.length > 200 ? s.slice(0, 200) + '...' : s
  } catch { return String(args) }
}

function truncate(s: string, max = 500): string {
  return s.length > max ? s.slice(0, max) + '\n... truncated' : s
}

export default function ToolCard({ entry, show = true }: Props) {
  const { t } = useI18n()
  const [expanded, setExpanded] = useState(false)

  if (!show) return null

  const isRunning = entry.phase === 'start' || entry.phase === 'update'
  const hasOutput = Boolean(entry.output)

  return (
    <div className={`my-2 rounded-lg border transition-colors ${isRunning ? 'border-accent/30 bg-accent/5' : 'border-dark-500 bg-dark-800'} animate-slide-in`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2.5 px-3 py-2 text-left">
        <div className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${isRunning ? 'bg-accent/20' : 'bg-dark-600'}`}>
          {isRunning ? (
            <span className="block w-2.5 h-2.5 border-2 border-accent/60 border-t-accent rounded-full animate-spin" />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-dark-200">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-dark-100">{entry.name}</span>
          {entry.args && !expanded && (
            <span className="ml-2 text-xs text-dark-400 truncate max-w-[300px] inline-block align-bottom">{formatArgs(entry.args)}</span>
          )}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-dark-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 animate-fade-in">
          {entry.args && (
            <div>
              <div className="text-xs text-dark-400 mb-1 font-medium">{t('tool.args')}</div>
              <pre className="text-xs text-dark-200 bg-dark-900 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-words">{truncate(formatArgs(entry.args), 1000)}</pre>
            </div>
          )}
          {hasOutput && (
            <div>
              <div className="text-xs text-dark-400 mb-1 font-medium">{t('tool.output')}</div>
              <pre className="text-xs text-dark-200 bg-dark-900 rounded-md p-2 overflow-x-auto whitespace-pre-wrap break-words max-h-64 overflow-y-auto">{truncate(entry.output!, 2000)}</pre>
            </div>
          )}
          {isRunning && !hasOutput && (
            <div className="flex items-center gap-2 text-xs text-dark-300">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              {t('tool.running')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
