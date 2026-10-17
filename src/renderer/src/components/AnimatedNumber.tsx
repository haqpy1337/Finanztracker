import { useEffect, useRef, useState } from 'react'
import { money } from '@/lib/format'

const DURATION_MS = 650

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** Euro amount that counts smoothly from its previous value to the new one. */
export function AnimatedMoney({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(0)
  const frame = useRef<number | undefined>(undefined)

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = from.current
    if (reduced || start === value) {
      setShown(value)
      from.current = value
      return
    }
    const startTime = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / DURATION_MS)
      const current = start + (value - start) * easeOutCubic(t)
      setShown(current)
      from.current = current
      if (t < 1) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [value])

  return <>{money(Math.round(shown * 100) / 100)}</>
}
