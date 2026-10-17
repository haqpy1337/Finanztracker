import { useEffect, useState } from 'react'
import { Logo } from './Logo'

const MIN_VISIBLE_MS = 1150
const EXIT_MS = 420

/**
 * Start-up screen: shown while the data loads, for at least a short moment so
 * the animation never flickers, then fades out over the app.
 */
export function Splash({ ready, version, onExit }: { ready: boolean; version: string; onExit?(): void }) {
  const [minElapsed, setMinElapsed] = useState(false)
  const [phase, setPhase] = useState<'show' | 'exit' | 'done'>('show')

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = window.setTimeout(() => setMinElapsed(true), reduced ? 0 : MIN_VISIBLE_MS)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!ready || !minElapsed || phase !== 'show') return
    setPhase('exit')
    onExit?.()
    const t = window.setTimeout(() => setPhase('done'), EXIT_MS)
    return () => window.clearTimeout(t)
  }, [ready, minElapsed, phase, onExit])

  if (phase === 'done') return null
  return (
    <div className={`splash ${phase === 'exit' ? 'exit' : ''}`} aria-hidden={phase === 'exit'}>
      <div className="splash-content">
        <div className="splash-mark">
          <Logo size={76} />
        </div>
        <div className="splash-name">Finanztracker</div>
        <div className="splash-sub">Ausgaben im Blick</div>
        <div className="splash-progress">
          <div />
        </div>
      </div>
      {version && <div className="splash-version">Version {version}</div>}
    </div>
  )
}
