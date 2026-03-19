import { useState, useEffect, useCallback } from 'react'

interface Props {
  src: string
  visible: boolean
  onClose: () => void
}

export default function ImagePreview({ src, visible, onClose }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [zoom, setZoom] = useState(false)

  useEffect(() => {
    if (visible) {
      setLoaded(false)
      setZoom(false)
    }
  }, [visible])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [visible, handleKeyDown])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Image container */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={e => e.stopPropagation()}
      >
        {/* Loading spinner */}
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/20 border-t-accent rounded-full animate-spin" />
          </div>
        )}

        {/* Image */}
        <img
          src={src}
          alt="preview"
          className={`max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl transition-all duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          } ${zoom ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
          onClick={() => setZoom(z => !z)}
          onLoad={() => setLoaded(true)}
        />
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Zoom hint */}
      {loaded && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs select-none">
          Click image to zoom • ESC to close
        </div>
      )}
    </div>
  )
}
