import { useState, useEffect } from 'react'
import { useI18n } from '../lib/i18n'

interface Props {
  connected: boolean
}

declare global {
  interface Window {
    electronAPI?: {
      platform?: string
      windowControl?: {
        minimize: () => void
        maximize: () => void
        close: () => void
        isMaximized: () => Promise<boolean>
      }
    }
  }
}

import iconImg from '../public/icon.png'

const DRAG: React.CSSProperties = { WebkitAppRegion: 'drag' } as any
const NO_DRAG: React.CSSProperties = { WebkitAppRegion: 'no-drag' } as any

export default function TitleBar({ connected }: Props) {
  const [maximized, setMaximized] = useState(false)
  const { t } = useI18n()
  const wc = window.electronAPI?.windowControl

  useEffect(() => {
    if (!wc) return
    const check = () => wc.isMaximized().then(setMaximized).catch(() => {})
    check()
    const id = setInterval(check, 500)
    return () => clearInterval(id)
  }, [wc])

  return (
    <div
      style={DRAG}
      className="flex items-center h-10 bg-dark-800 border-b border-dark-500 shrink-0 select-none"
    >
      <div style={NO_DRAG} className="flex items-center gap-2 pl-3">
        <img src={iconImg} alt="" className="w-5 h-5 rounded-md" />
        <span className="text-[13px] font-medium text-dark-100 tracking-wide">Claw Desktop</span>
        <div className={`ml-1 w-2 h-2 rounded-full transition-colors ${connected ? 'bg-green-400 glow-dot' : 'bg-dark-400'}`} />
      </div>

      <div className="flex-1" />

      {wc && (
        <div style={NO_DRAG} className="flex items-center">
          <button onClick={wc.minimize} className="w-11 h-10 flex items-center justify-center hover:bg-dark-600 transition-colors" title="Minimize">
            <svg width="10" height="1" viewBox="0 0 10 1" className="text-dark-200"><rect width="10" height="1" fill="currentColor" /></svg>
          </button>
          <button onClick={wc.maximize} className="w-11 h-10 flex items-center justify-center hover:bg-dark-600 transition-colors" title={maximized ? 'Restore' : 'Maximize'}>
            {maximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.1" className="text-dark-200">
                <rect x="2" y="0" width="8" height="8" rx="1" /><rect x="0" y="2" width="8" height="8" rx="1" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.1" className="text-dark-200">
                <rect x="0.5" y="0.5" width="9" height="9" rx="1.5" />
              </svg>
            )}
          </button>
          <button onClick={wc.close} className="w-11 h-10 flex items-center justify-center hover:bg-red-600 transition-colors" title="Close">
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="text-dark-200">
              <line x1="0" y1="0" x2="10" y2="10" /><line x1="10" y1="0" x2="0" y2="10" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
