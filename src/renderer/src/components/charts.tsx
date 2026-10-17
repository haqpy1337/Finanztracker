import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Category } from '@shared/types'
import { sum } from '@shared/calc'
import { money, moneyShort, percent } from '@/lib/format'
import { NEUTRAL_SLOT, otherColor, PALETTE_SIZE, resolveCategorySlots, seriesColor } from '@/lib/palette'
import { useDark } from '@/lib/theme'

export interface Slice {
  key: string
  name: string
  value: number
  color: string
}

export const OTHER_KEY = '__other'

/**
 * Turns per-category values into chart slices: largest first, at most
 * `max` categories plus one grey "Übrige" slice. Each category keeps the
 * colour it has everywhere else; only if two shown categories still share one
 * (more categories than colours) the later one takes a free slot.
 */
export function categorySlices(values: Map<string, number>, categories: Category[], dark: boolean, max = 7): Slice[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const slots = resolveCategorySlots(categories)
  const sorted = [...values.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  // Grey categories ("Sonstiges") always join the grey remainder slice.
  const coloured = sorted.filter(([id]) => slots.get(id) !== NEUTRAL_SLOT)
  const grey = sorted.filter(([id]) => slots.get(id) === NEUTRAL_SLOT)
  const shown = coloured.length > max + 1 - (grey.length ? 1 : 0) ? coloured.slice(0, max) : coloured
  const rest = [...coloured.slice(shown.length), ...grey]
  const used = new Set<number>()
  const slices: Slice[] = shown.map(([id, value]) => {
    const cat = byId.get(id)
    let slot = slots.get(id) ?? 0
    if (used.has(slot)) {
      for (let i = 0; i < PALETTE_SIZE; i++) {
        if (!used.has(i)) {
          slot = i
          break
        }
      }
    }
    used.add(slot)
    return { key: id, name: cat?.name ?? 'Ohne Kategorie', value, color: seriesColor(slot, dark) }
  })
  if (rest.length) {
    const name = rest.length === 1 ? (byId.get(rest[0][0])?.name ?? 'Übrige') : `Übrige (${rest.length})`
    slices.push({ key: rest.length === 1 ? rest[0][0] : OTHER_KEY, name, value: sum(rest.map(([, v]) => v)), color: otherColor(dark) })
  }
  return slices
}

function useChartChrome() {
  const dark = useDark()
  return {
    dark,
    grid: dark ? '#2a2a28' : '#ebeae5',
    axis: dark ? '#3d3d3a' : '#c3c2b7',
    tick: dark ? '#8f8d86' : '#86847e',
    surface: dark ? '#1b1b1a' : '#ffffff',
    cursor: dark ? 'rgba(255,255,255,0.04)' : 'rgba(20,20,19,0.04)'
  }
}

export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  vertical
}: {
  slices: Slice[]
  centerLabel: string
  centerValue: string
  vertical?: boolean
}) {
  const { surface } = useChartChrome()
  const total = sum(slices.map((s) => s.value))
  return (
    <div className={`donut-wrap ${vertical ? 'vertical' : ''}`}>
      <div className="donut-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={66}
              outerRadius={96}
              paddingAngle={slices.length > 1 ? 1.5 : 0}
              cornerRadius={3}
              stroke={surface}
              strokeWidth={1}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const s = payload[0].payload as Slice
                return (
                  <div className="chart-tooltip">
                    <div className="t">{s.name}</div>
                    <div className="r">
                      <span className="k">Betrag</span>
                      <span className="num">{money(s.value)}</span>
                    </div>
                    <div className="r">
                      <span className="k">Anteil</span>
                      <span className="num">{percent(total ? (s.value / total) * 100 : 0)}</span>
                    </div>
                  </div>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="center-label">
          <div className="v num">{centerValue}</div>
          <div className="l">{centerLabel}</div>
        </div>
      </div>
      <table className="table compact legend-table">
        <tbody>
          {slices.map((s) => (
            <tr key={s.key}>
              <td>
                <span className="cat">
                  <span className="dot" style={{ background: s.color }} />
                  {s.name}
                </span>
              </td>
              <td className="right num" style={{ width: 104 }}>
                {money(s.value)}
              </td>
              <td className="right num text-muted" style={{ width: 66 }}>
                {percent(total ? (s.value / total) * 100 : 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface SeriesDef {
  key: string
  name: string
  color: string
}

function TooltipBox({ title, rows, total }: { title: string; rows: Array<{ name: string; color: string; value: number }>; total?: number }) {
  return (
    <div className="chart-tooltip">
      <div className="t">{title}</div>
      {rows.map((r) => (
        <div className="r" key={r.name}>
          <span className="k">
            <span className="dot" style={{ background: r.color }} />
            {r.name}
          </span>
          <span className="num">{money(r.value)}</span>
        </div>
      ))}
      {total !== undefined && (
        <div className="r sum">
          <span>Summe</span>
          <span className="num">{money(total)}</span>
        </div>
      )}
    </div>
  )
}

/** Monthly expenses stacked by category, with income as a line on the same euro axis. */
export function StackedMonthChart({
  rows,
  series,
  incomeKey,
  incomeColor,
  height = 300
}: {
  rows: Array<Record<string, number | string>>
  series: SeriesDef[]
  incomeKey?: string
  incomeColor?: string
  height?: number
}) {
  const c = useChartChrome()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: c.axis }} tick={{ fill: c.tick, fontSize: 12 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: c.tick, fontSize: 12 }} tickFormatter={(v: number) => moneyShort(v)} width={72} />
        <Tooltip
          cursor={{ fill: c.cursor }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const row = payload[0].payload as Record<string, number>
            const items = series.filter((s) => (row[s.key] ?? 0) > 0).map((s) => ({ name: s.name, color: s.color, value: row[s.key] }))
            const total = sum(items.map((i) => i.value))
            return (
              <div>
                <TooltipBox title={String(row.fullLabel ?? label)} rows={items.reverse()} total={total} />
                {incomeKey && (row[incomeKey] ?? 0) > 0 && (
                  <div className="chart-tooltip" style={{ marginTop: 6 }}>
                    <div className="r">
                      <span className="k">
                        <span className="dot" style={{ background: incomeColor, borderRadius: 999 }} />
                        Einnahmen
                      </span>
                      <span className="num">{money(row[incomeKey])}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          }}
        />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="a"
            fill={s.color}
            stroke={c.surface}
            strokeWidth={1}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
            isAnimationActive={false}
            maxBarSize={44}
          />
        ))}
        {incomeKey && (
          <Line
            dataKey={incomeKey}
            type="monotone"
            stroke={incomeColor}
            strokeWidth={2}
            dot={{ r: 3.5, fill: c.surface, strokeWidth: 2 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

/** Grouped bars for two measures in euros (e.g. expenses vs. income per month). */
export function GroupedBarChart({
  rows,
  series,
  height = 260
}: {
  rows: Array<Record<string, number | string>>
  series: SeriesDef[]
  height?: number
}) {
  const c = useChartChrome()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barCategoryGap="24%" barGap={2}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: c.axis }} tick={{ fill: c.tick, fontSize: 12 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: c.tick, fontSize: 12 }} tickFormatter={(v: number) => moneyShort(v)} width={72} />
        <Tooltip
          cursor={{ fill: c.cursor }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const row = payload[0].payload as Record<string, number>
            return <TooltipBox title={String(row.fullLabel ?? label)} rows={series.map((s) => ({ name: s.name, color: s.color, value: row[s.key] ?? 0 }))} />
          }}
        />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function Legend({ series }: { series: SeriesDef[] }) {
  return (
    <div className="legend">
      {series.map((s) => (
        <span key={s.key}>
          <span className="dot" style={{ background: s.color }} />
          {s.name}
        </span>
      ))}
    </div>
  )
}
