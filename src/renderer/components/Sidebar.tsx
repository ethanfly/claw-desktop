import type { SessionInfo } from '../lib/types'
import { useI18n } from '../lib/i18n'
import type { Lang } from '../lib/i18n'
import iconImg from '../public/icon.png'

interface Props {
  sessions: SessionInfo[]
  currentSession: string
  onSelectSession: (key: string) => void
  onNewSession: () => void
  onDisconnect: () => void
  connected: boolean
  showThinking: boolean
  onToggleThinking: () => void
  showTools: boolean
  onToggleTools: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

function sessionLabel(key: string, t: (key: string) => string): string {
  const parts = key.split(':')
  const last = parts[parts.length - 1]
  if (last === 'default') return t('session.main')
  return last?.slice(0, 8) ?? ''
}

export default function Sidebar({
  sessions, currentSession, onSelectSession, onNewSession,
  onDisconnect, connected, showThinking, onToggleThinking,
  showTools, onToggleTools, collapsed, onToggleCollapse
}: Props) {
  const { t, lang, setLang } = useI18n()

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 px-2 bg-dark-800 border-r border-dark-500 w-14 shrink-0">
        <button onClick={onToggleCollapse} title="Expand sidebar"
          className="p-2 rounded-lg hover:bg-dark-600 transition-colors text-dark-200">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="flex-1" />
        <div className={`w-2.5 h-2.5 rounded-full mb-4 ${connected ? 'bg-green-400 glow-dot' : 'bg-dark-400'}`} />
      </div>
    )
  }

  const switchLang = () => setLang(lang === 'en' ? 'zh' : 'en')

  return (
    <div className="flex flex-col bg-dark-800 border-r border-dark-500 w-64 shrink-0 select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-500">
        <div className="flex items-center gap-2">
          <img src={iconImg} alt="Claw" className="w-7 h-7 rounded-lg" />
          <span className="font-semibold text-sm text-white">Claw Desktop</span>
        </div>
        <button onClick={onToggleCollapse} title="Collapse sidebar"
          className="p-1.5 rounded-md hover:bg-dark-600 transition-colors text-dark-300">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      </div>

      {/* New session */}
      <div className="px-3 pt-3 pb-1">
        <button onClick={onNewSession} disabled={!connected}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-dark-200 hover:bg-dark-600 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t('sidebar.newSession')}
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {sessions.length === 0 && (
          <p className="text-dark-400 text-xs text-center py-8">{t('sidebar.noSessions')}</p>
        )}
        {sessions.map(s => (
          <button
            key={s.sessionKey}
            onClick={() => onSelectSession(s.sessionKey)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
              s.sessionKey === currentSession
                ? 'bg-accent/15 text-accent-light'
                : 'text-dark-200 hover:bg-dark-600 hover:text-white'
            }`}
          >
            <div className="truncate">{s.label || sessionLabel(s.sessionKey, t)}</div>
          </button>
        ))}
      </div>

      {/* Footer toggles */}
      <div className="border-t border-dark-500 px-3 py-2 space-y-0.5">
        <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-dark-600 cursor-pointer transition-colors text-dark-200 text-xs">
          <input type="checkbox" checked={showThinking} onChange={onToggleThinking}
            className="w-3.5 h-3.5 rounded border-dark-400 bg-dark-800 text-accent focus:ring-accent/50 accent-accent" />
          {t('sidebar.showThinking')}
        </label>
        <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-dark-600 cursor-pointer transition-colors text-dark-200 text-xs">
          <input type="checkbox" checked={showTools} onChange={onToggleTools}
            className="w-3.5 h-3.5 rounded border-dark-400 bg-dark-800 text-accent focus:ring-accent/50 accent-accent" />
          {t('sidebar.showTools')}
        </label>
      </div>

      {/* Connection status + language */}
      <div className="border-t border-dark-500 px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 glow-dot' : 'bg-dark-400'}`} />
          <span className="text-xs text-dark-300">{connected ? t('sidebar.connected') : t('sidebar.disconnected')}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={switchLang} title={t('sidebar.language')}
            className="px-1.5 py-1 rounded text-xs text-dark-300 hover:bg-dark-600 hover:text-white transition-colors font-medium">
            {lang === 'en' ? 'EN' : '中'}
          </button>
          <button onClick={onDisconnect} title="Disconnect"
            className="p-1.5 rounded-md hover:bg-dark-600 transition-colors text-dark-300 hover:text-red-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
