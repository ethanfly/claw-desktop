import { useState, useEffect } from 'react'
import type { GatewayConfig } from '../lib/types'
import { useI18n } from '../lib/i18n'

interface Props {
  config: GatewayConfig
  onConnect: (config: GatewayConfig) => void
  connecting: boolean
  error: string | null
}

declare global {
  interface Window {
    electronAPI?: {
      readOpenClawConfig?: () => Promise<{
        url: string
        authMode: 'token' | 'password'
        token: string
        password: string
      } | null>
    }
  }
}

export default function ConnectDialog({ config, onConnect, connecting, error }: Props) {
  const { t } = useI18n()
  const [url, setUrl] = useState(config.url || 'http://127.0.0.1:18789')
  const [authMode, setAuthMode] = useState<'token' | 'password'>(config.authMode || 'token')
  const [token, setToken] = useState(config.token || '')
  const [password, setPassword] = useState(config.password || '')
  const [configSource, setConfigSource] = useState<'manual' | 'openclaw'>('manual')

  useEffect(() => {
    const read = window.electronAPI?.readOpenClawConfig
    if (!read) return
    read().then(res => {
      if (!res) return
      console.log('[connect] loaded openclaw config:', { url: res.url, authMode: res.authMode, hasToken: !!res.token, hasPassword: !!res.password })
      setUrl(res.url || url)
      setAuthMode(res.authMode || authMode)
      if (res.token) setToken(res.token)
      if (res.password) setPassword(res.password)
      setConfigSource('openclaw')
    }).catch((e) => console.warn('[connect] failed to read openclaw config:', e))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConnect({ url, authMode, token, password })
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-dark-900">
      <div className="w-full max-w-md mx-4 animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 mb-4 glow-accent">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Claw Desktop</h1>
          <p className="text-dark-200 text-sm">{t('connect.title')}</p>
        </div>

        {configSource === 'openclaw' && (
          <div className="mb-4 flex items-center justify-center gap-1.5 text-xs text-green-400 bg-green-400/10 border border-green-400/20 rounded-full px-3 py-1 w-fit mx-auto animate-slide-up">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
            </svg>
            {t('connect.autoLoaded')}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-dark-700 border border-dark-500 rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1.5">{t('connect.gatewayUrl')}</label>
            <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="http://127.0.0.1:18789" disabled={connecting}
              className="w-full px-3.5 py-2.5 bg-dark-800 border border-dark-500 rounded-lg text-sm text-white placeholder-dark-300 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors disabled:opacity-50" />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1.5">{t('connect.auth')}</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAuthMode('token')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${authMode === 'token' ? 'bg-accent/20 text-accent-light border border-accent/30' : 'bg-dark-800 text-dark-200 border border-dark-500 hover:border-dark-400'}`}>
                {t('connect.auth.token')}
              </button>
              <button type="button" onClick={() => setAuthMode('password')} className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${authMode === 'password' ? 'bg-accent/20 text-accent-light border border-accent/30' : 'bg-dark-800 text-dark-200 border border-dark-500 hover:border-dark-400'}`}>
                {t('connect.auth.password')}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-100 mb-1.5">{authMode === 'token' ? t('connect.tokenLabel') : t('connect.passwordLabel')}</label>
            <input type="password" value={authMode === 'token' ? token : password}
              onChange={e => authMode === 'token' ? setToken(e.target.value) : setPassword(e.target.value)}
              placeholder={authMode === 'token' ? t('connect.tokenPlaceholder') : t('connect.passwordPlaceholder')}
              disabled={connecting}
              className="w-full px-3.5 py-2.5 bg-dark-800 border border-dark-500 rounded-lg text-sm text-white placeholder-dark-300 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/50 transition-colors disabled:opacity-50" />
            {configSource === 'openclaw' && (token || password) && (
              <p className="mt-1.5 text-xs text-dark-400">
                {authMode === 'token' && token ? `${t('connect.tokenLoaded')}: ****${token.slice(-6)}` : `${t('connect.passwordLoaded')}: ****`}
              </p>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3.5 py-2.5 text-sm text-red-400 animate-slide-up">{error}</div>
          )}

          <button type="submit" disabled={connecting || !url.trim()}
            className="w-full py-2.5 bg-accent hover:bg-accent-light disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm">
            {connecting ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t('connect.connecting')}
              </span>
            ) : t('connect.connect')}
          </button>
        </form>

        <p className="text-center text-dark-300 text-xs mt-4">{t('connect.hint')}</p>
      </div>
    </div>
  )
}
