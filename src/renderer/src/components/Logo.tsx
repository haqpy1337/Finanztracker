/**
 * The Moo wordmark: a stroked "M", a plain "o" and a blue "o" with horns and
 * nostrils, the cow's head. The splash animates the same shapes, and
 * build/icon.svg uses the head alone.
 */
export const MOO = {
  viewBox: '-12 -10 314 128',
  m: 'M8 100 V12 L48 64 L88 12 V100',
  o: { cx: 151, cy: 66, r: 34 },
  head: { cx: 248, cy: 66, r: 34 },
  horns: ['M227.1 39.2 Q206 38.5 210.1 14.7', 'M268.9 39.2 Q290 38.5 285.9 14.7'],
  nostrils: [
    { cx: 237.8, cy: 74.5, rx: 4.1, ry: 5.8 },
    { cx: 258.2, cy: 74.5, rx: 4.1, ry: 5.8 }
  ]
} as const

export function Wordmark({ height }: { height: number }) {
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 16, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
  return (
    <svg height={height} viewBox={MOO.viewBox} aria-label="Moo" role="img" className="logo">
      <path d={MOO.m} {...stroke} />
      <circle {...MOO.o} {...stroke} />
      {MOO.horns.map((d) => (
        <path key={d} d={d} {...stroke} strokeWidth={12.8} />
      ))}
      <circle {...MOO.head} fill="none" stroke="var(--accent)" strokeWidth={16} />
      {MOO.nostrils.map((n) => (
        <ellipse key={n.cx} {...n} fill="currentColor" />
      ))}
    </svg>
  )
}
