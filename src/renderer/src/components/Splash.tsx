import { useEffect, useState } from 'react'
import { MOO } from './Logo'

// The mark is drawn in about 1.9 s; a click or key press skips the wait.
const MIN_VISIBLE_MS = 2000
const EXIT_MS = 420

const delay = (s: number) => ({ '--d': `${s}s` }) as React.CSSProperties

/**
 * Start-up screen: the Moo wordmark draws itself on dark grey while the data
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
        <svg viewBox={MOO.viewBox}>
          <path className="moo-draw" pathLength={1} style={delay(0.05)} d={MOO.m} />
          <circle className="moo-draw" pathLength={1} style={delay(0.3)} {...MOO.o} transform={`rotate(-90 ${MOO.o.cx} ${MOO.o.cy})`} />
          <g className="moo-head">
            <path className="moo-horn" style={{ ...delay(0.85), transformOrigin: '100% 100%' }} d={MOO.horns[0]} />
            <path className="moo-horn" style={{ ...delay(0.93), transformOrigin: '0% 100%' }} d={MOO.horns[1]} />
            <circle className="moo-ring" {...MOO.head} />
            {MOO.nostrils.map((n, i) => (
              <ellipse key={i} className="moo-nose" style={delay(1.05 + i * 0.05)} {...n} />
            ))}
          </g>
        </svg>
      </div>
    </div>
  )
}
