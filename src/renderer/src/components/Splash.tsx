import { useEffect, useState } from 'react'
import { useDark } from '@/lib/theme'
import { seriesColor } from '@/lib/palette'

// The build-up runs about 3.4 s; a click or key press skips the wait.
const MIN_VISIBLE_MS = 3600
const EXIT_MS = 420
const SHARES = [0.3, 0.24, 0.18, 0.16, 0.12]
const BAR_HEIGHTS = [14, 22, 17, 27, 20]
// Palette slots in the order the segments are drawn: blue, green, amber, orange, pink.
const SLOTS = [0, 2, 3, 1, 4]
const RING_RADIUS = 12
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

/**
 * Start-up screen: the app builds itself from a bare frame while the data
 * loads, then fades into the real app. It stays for at least a moment so the
 * animation never flickers.
 */
export function Splash({ ready, onExit }: { ready: boolean; onExit?(): void }) {
  const dark = useDark()
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

  let offset = 0
  const arcs = SHARES.map((share, i) => {
    const length = RING_LENGTH * share
    const arc = (
      <circle
        key={i}
        className="sp-ring"
        style={{ '--i': i, '--L': length.toFixed(1), strokeDashoffset: (-offset).toFixed(1) } as React.CSSProperties}
        cx="20"
        cy="20"
        r={RING_RADIUS}
        stroke={seriesColor(SLOTS[i], dark)}
      />
    )
    offset += length
    return arc
  })

  return (
    <div className={`splash ${phase === 'exit' ? 'exit' : ''}`} aria-hidden="true">
      <div className="sp">
        <div className="sp-side">
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>
        <div className="sp-main">
          <div className="sp-head" />
          <div className="sp-row">
            <div className="sp-card" style={{ '--i': 0 } as React.CSSProperties}>
              <svg viewBox="0 0 40 40">
                <g transform="rotate(-90 20 20)">{arcs}</g>
              </svg>
            </div>
            <div className="sp-card" style={{ '--i': 1 } as React.CSSProperties}>
              <svg viewBox="0 0 40 40">
                {BAR_HEIGHTS.map((h, i) => (
                  <rect
                    key={i}
                    className="sp-bar"
                    style={{ '--i': i } as React.CSSProperties}
                    x={3 + i * 7.4}
                    y={36 - h}
                    width="5.2"
                    height={h}
                    rx="1.4"
                    fill={seriesColor(SLOTS[i], dark)}
                  />
                ))}
              </svg>
            </div>
          </div>
          <div className="sp-card wide" style={{ '--i': 2 } as React.CSSProperties}>
            <svg viewBox="0 0 120 30" preserveAspectRatio="xMidYMid meet">
              <path className="sp-line" pathLength={1} stroke={seriesColor(0, dark)} d="M4 24 C 20 22 26 12 40 14 S 62 8 76 10 S 96 4 116 3" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
