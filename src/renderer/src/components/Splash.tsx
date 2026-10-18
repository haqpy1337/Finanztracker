import { useEffect, useState } from 'react'

// The mark is drawn in about 2 s; a click or key press skips the wait.
const MIN_VISIBLE_MS = 2300
const EXIT_MS = 420

const delay = (s: number) => ({ '--d': `${s}s` }) as React.CSSProperties

/**
 * Start-up screen: the Moo mark draws itself on the app's grey while the data
 * loads, then fades into the real app. It stays for at least a moment so the
 * animation never flickers.
 */
export function Splash({ ready, onExit }: { ready: boolean; onExit?(): void }) {
  const [minElapsed, setMinElapsed] = useState(false)
  const [phase, setPhase] = useState<'show' | 'exit' | 'done'>('show')

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = window.setTimeout(() => setMinElapsed(true), reduced ? 0 : MIN_VISIBLE_MS)
    const skip = () => setMinElapsed(true)
    window.addEventListener('keydown', skip)
    window.addEventListener('pointerdown', skip)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', skip)
      window.removeEventListener('pointerdown', skip)
    }
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
    <div className={`splash ${phase === 'exit' ? 'exit' : ''}`} aria-hidden="true">
      <div className="moo">
        <svg viewBox="-12 -10 314 128">
          <path className="moo-draw" pathLength={1} style={delay(0.05)} d="M8 100 V12 L48 64 L88 12 V100" />
          <circle className="moo-draw" pathLength={1} style={delay(0.3)} cx="151" cy="66" r="34" transform="rotate(-90 151 66)" />
          <g className="moo-head">
            <path className="moo-horn" style={{ ...delay(0.85), transformOrigin: '100% 100%' }} d="M227.1 39.2 Q206 38.5 210.1 14.7" />
            <path className="moo-horn" style={{ ...delay(0.93), transformOrigin: '0% 100%' }} d="M268.9 39.2 Q290 38.5 285.9 14.7" />
            <circle className="moo-ring" cx="248" cy="66" r="34" />
            <ellipse className="moo-nose" style={delay(1.05)} cx="237.8" cy="74.5" rx="4.1" ry="5.8" />
            <ellipse className="moo-nose" style={delay(1.1)} cx="258.2" cy="74.5" rx="4.1" ry="5.8" />
          </g>
        </svg>
        <div className="moo-tag">Money Overview</div>
      </div>
    </div>
  )
}
