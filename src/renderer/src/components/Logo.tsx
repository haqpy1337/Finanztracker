/** The app mark: a closed three-colour ring (donut chart) on a dark tile. Same artwork as build/icon.svg. */
export function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="8 8 240 240" aria-hidden="true" className="logo">
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2a3346" />
          <stop offset="1" stopColor="#141a26" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="240" height="240" rx="56" fill="url(#logo-bg)" />
      <circle cx="128" cy="128" r="56" fill="none" stroke="#4a86ee" strokeWidth="32" strokeDasharray="140.7 351.9" strokeDashoffset="-0.0" transform="rotate(-90 128 128)" />
      <circle cx="128" cy="128" r="56" fill="none" stroke="#ffffff" strokeWidth="32" strokeDasharray="116.1 351.9" strokeDashoffset="-140.7" transform="rotate(-90 128 128)" />
      <circle cx="128" cy="128" r="56" fill="none" stroke="#6f7788" strokeWidth="32" strokeDasharray="95.0 351.9" strokeDashoffset="-256.9" transform="rotate(-90 128 128)" />
    </svg>
  )
}
