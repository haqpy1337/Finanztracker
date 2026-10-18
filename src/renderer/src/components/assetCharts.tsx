import { useId } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addMonths, parseIso, toIso } from '@shared/calc'
import { date, money, moneyShort, MONTHS_SHORT, signedMoney, signedPercent } from '@/lib/format'
import { seriesColor } from '@/lib/palette'
import { useDark } from '@/lib/theme'

export interface TimeRow {
  date: string
  value: number
  invested: number
  gain: number
  /** Marks a day with an actually entered value (drawn as a dot). */
  known?: boolean
  label?: string
}

const DAY = 86_400_000

function toTime(iso: string): number {
  const { y, m, d } = parseIso(iso)
  return Date.UTC(y, m - 1, d)
}

function fromTime(t: number): string {
  const dt = new Date(t)
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** Evenly spread ticks on whole months (or days for short ranges), at most about six. */
function timeTicks(min: number, max: number): { ticks: number[]; format(t: number): string } {
  const spanDays = (max - min) / DAY
  if (spanDays < 75) {
    const step = [1, 2, 7, 14, 21].find((s) => spanDays / s <= 6) ?? 28
    const ticks: number[] = []
    for (let t = min; t <= max; t += step * DAY) ticks.push(t)
    return {
      ticks,
      format: (t) => {
        const { m, d } = parseIso(fromTime(t))
        return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.`
      }
    }
  }
  const spanMonths = spanDays / 30.44
  const step = [1, 2, 3, 6, 12, 24, 60].find((s) => spanMonths / s <= 6) ?? 120
  const first = parseIso(fromTime(min))
  let cursor = toIso(first.y, first.m, 1)
  if (toTime(cursor) < min) cursor = addMonths(cursor, 1)
  // Align on quarters / half years / years where the step allows.
  while (step >= 3 && (parseIso(cursor).m - 1) % Math.min(step, 12) !== 0) cursor = addMonths(cursor, 1)
  const ticks: number[] = []
  while (toTime(cursor) <= max) {
    ticks.push(toTime(cursor))
    cursor = addMonths(cursor, step)
  }
  return {
    ticks,
    format: (t) => {
      const { y, m } = parseIso(fromTime(t))
      return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`
    }
  }
}

export function useGainColors() {
  const dark = useDark()
  return { good: dark ? '#3fbf6a' : '#0a7a36', bad: dark ? '#ec6b66' : '#c03530' }
}

function useChrome() {
  const dark = useDark()
  return {
    dark,
    grid: dark ? '#2a2a28' : '#ebeae5',
    axis: dark ? '#3d3d3a' : '#c3c2b7',
    tick: dark ? '#8f8d86' : '#86847e',
    surface: dark ? '#1b1b1a' : '#ffffff',
    invested: dark ? '#8f8d86' : '#86847e'
  }
}

function RowTooltip({ row, good, bad }: { row: TimeRow; good: string; bad: string }) {
  const pct = row.invested > 0 ? (row.gain / row.invested) * 100 : null
  return (
    <div className="chart-tooltip">
      <div className="t">
        {date(row.date)}
        {row.label && <span className="text-muted"> · {row.label}</span>}
      </div>
      <div className="r">
        <span className="k">Wert</span>
        <span className="num">{money(row.value)}</span>
      </div>
      <div className="r">
        <span className="k">Eingezahlt</span>
        <span className="num">{money(row.invested)}</span>
      </div>
      <div className="r sum">
        <span>{row.gain >= 0 ? 'Gewinn' : 'Verlust'}</span>
        <span className="num" style={{ color: row.gain >= 0 ? good : bad }}>
          {signedMoney(row.gain)} {pct !== null && <span style={{ fontWeight: 400 }}>({signedPercent(pct)})</span>}
        </span>
      </div>
    </div>
  )
}

/**
 * Development over time on a true time axis. "value" shows the value as an
 * area with the invested amount as a dashed line; "gain" shows profit and loss
 * around zero, green above and red below.
 */
export function TimeChart({ rows, mode, height = 300 }: { rows: TimeRow[]; mode: 'value' | 'gain'; height?: number }) {
  const c = useChrome()
  const { good, bad } = useGainColors()
  const id = useId().replace(/:/g, '')
  const data = rows.map((r) => ({ ...r, t: toTime(r.date) }))
  const min = data[0].t
  const max = data[data.length - 1].t
  const { ticks, format } = timeTicks(min, max)
  const accent = seriesColor(0, c.dark)

  const gains = data.map((r) => r.gain)
  const top = Math.max(0, ...gains)
  const bottom = Math.min(0, ...gains)
  // Where zero sits in the gradient (0 = top of the plotted range, 1 = bottom).
  const zero = top - bottom > 0 ? top / (top - bottom) : 1

  const dot = (props: { cx?: number; cy?: number; payload?: TimeRow; index?: number }, color: string) => {
    if (!props.payload?.known || props.cx === undefined || props.cy === undefined) return <g key={`d-${props.index}`} />
    return <circle key={`d-${props.index}`} cx={props.cx} cy={props.cy} r={3.5} fill={c.surface} stroke={color} strokeWidth={2} />
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id={`v-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.28} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id={`gf-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={good} stopOpacity={0.3} />
            <stop offset={`${zero * 100}%`} stopColor={good} stopOpacity={0.04} />
            <stop offset={`${zero * 100}%`} stopColor={bad} stopOpacity={0.04} />
            <stop offset="100%" stopColor={bad} stopOpacity={0.3} />
          </linearGradient>
          <linearGradient id={`gs-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset={`${zero * 100}%`} stopColor={good} />
            <stop offset={`${zero * 100}%`} stopColor={bad} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={[min, max]}
          ticks={ticks}
          tickFormatter={format}
          tickLine={false}
          axisLine={{ stroke: c.axis }}
          tick={{ fill: c.tick, fontSize: 12 }}
          minTickGap={16}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: c.tick, fontSize: 12 }}
          tickFormatter={(v: number) => (mode === 'gain' && v > 0 ? `+${moneyShort(v)}` : moneyShort(v))}
          width={78}
          domain={mode === 'gain' ? ['auto', 'auto'] : [0, 'auto']}
        />
        <Tooltip
          cursor={{ stroke: c.axis, strokeDasharray: '3 3' }}
          content={({ active, payload }) => (active && payload?.length ? <RowTooltip row={payload[0].payload as TimeRow} good={good} bad={bad} /> : null)}
        />
        {mode === 'value' ? (
          <>
            <Area
              dataKey="value"
              type="monotone"
              stroke={accent}
              strokeWidth={2}
              fill={`url(#v-${id})`}
              dot={(p: object) => dot(p, accent)}
              activeDot={{ r: 5 }}
              animationDuration={900}
              animationEasing="ease-out"
            />
            <Line
              dataKey="invested"
              type="linear"
              stroke={c.invested}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </>
        ) : (
          <>
            <ReferenceLine y={0} stroke={c.axis} />
            <Area
              dataKey="gain"
              type="monotone"
              // A gradient on a flat line has no height and would vanish, so one-sided ranges use a plain colour.
              stroke={bottom >= 0 ? good : top <= 0 ? bad : `url(#gs-${id})`}
              strokeWidth={2}
              fill={`url(#gf-${id})`}
              dot={false}
              activeDot={{ r: 5 }}
              animationDuration={900}
              animationEasing="ease-out"
              baseValue={0}
            />
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Profit and loss per asset as bars that grow left (loss) or right (gain) from a centre line. */
export function GainBars({ rows, onSelect }: { rows: Array<{ id: string; name: string; gain: number; percent: number | null; sold: boolean }>; onSelect(id: string): void }) {
  const { good, bad } = useGainColors()
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.gain)))
  return (
    <div className="gain-bars">
      {rows.map((r, i) => {
        const width = (Math.abs(r.gain) / max) * 50
        return (
          <button key={r.id} className="gain-row" onClick={() => onSelect(r.id)} style={{ ['--i' as string]: i }}>
            <span className="name">
              {r.name}
              {r.sold && <span className="text-muted"> · verkauft</span>}
            </span>
            <span className="track">
              <span className="axis" />
              <span
                className="bar"
                style={{
                  width: `${width}%`,
                  left: r.gain >= 0 ? '50%' : `${50 - width}%`,
                  background: r.gain >= 0 ? good : bad,
                  transformOrigin: r.gain >= 0 ? 'left center' : 'right center'
                }}
              />
            </span>
            <span className="num value" style={{ color: r.gain >= 0 ? good : bad }}>
              {signedMoney(r.gain)}
            </span>
            <span className="num pct text-muted">{signedPercent(r.percent)}</span>
          </button>
        )
      })}
    </div>
  )
}
