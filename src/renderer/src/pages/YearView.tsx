import { useMemo, useState } from 'react'
import { CalendarRange, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react'
import { changePercent, monthTotals, occurrencesInRange, parseIso, sum, todayIso, yearByCategory } from '@shared/calc'
import { INTERVAL_LABELS } from '@shared/defaults'
import type { Interval } from '@shared/types'
import { useStore } from '@/lib/store'
import { useDark } from '@/lib/theme'
import { money, moneyShort, MONTHS, MONTHS_SHORT, percent } from '@/lib/format'
import { categorySlices, Legend, OTHER_KEY, StackedMonthChart } from '@/components/charts'
import { AnimatedMoney } from '@/components/AnimatedNumber'
import { Card, CategoryLabel, Delta, Kpi, PageHeader, PeriodNav } from '@/components/ui'

function ShareList({ items, total }: { items: Array<{ label: string; value: number }>; total: number }) {
  if (!items.length) return <div className="small-empty">Keine Daten für dieses Jahr.</div>
  return (
    <div className="list">
      {items.map((i) => (
        <div className="list-row" key={i.label}>
          <div className="grow">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <span className="title">{i.label}</span>
              <span className="num">
                {money(i.value)} <span className="text-muted">· {percent(total ? (i.value / total) * 100 : 0)}</span>
              </span>
            </div>
            <div className="share-bar">
              <div style={{ width: `${total ? (i.value / total) * 100 : 0}%`, background: 'var(--accent)' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function YearView() {
  const { data, categoryById } = useStore()
  const dark = useDark()
  const now = parseIso(todayIso())
  const [year, setYear] = useState(now.y)

  const s = useMemo(() => {
    const expenseMonths = monthTotals(data.entries, year, 'expense')
    const incomeMonths = monthTotals(data.entries, year, 'income')
    const expenseTotal = sum(expenseMonths)
    const incomeTotal = sum(incomeMonths)
    const prevExpense = sum(monthTotals(data.entries, year - 1, 'expense'))
    const prevIncome = sum(monthTotals(data.entries, year - 1, 'income'))
    const matrix = yearByCategory(data.entries, year, 'expense')
    const categoryTotals = new Map([...matrix.entries()].map(([id, row]) => [id, sum(row)]))

    const occurrences = occurrencesInRange(data.entries, `${year}-01-01`, `${year}-12-31`, 'expense')
    const byPayment = new Map<string, number>()
    const byInterval = new Map<Interval, number>()
    for (const o of occurrences) {
      const key = o.entry.paymentMethod || 'Ohne Angabe'
      byPayment.set(key, sum([byPayment.get(key) ?? 0, o.amount]))
      byInterval.set(o.entry.interval, sum([byInterval.get(o.entry.interval) ?? 0, o.amount]))
    }
    const highest = expenseMonths.reduce((best, v, i) => (v > expenseMonths[best] ? i : best), 0)

    return { expenseMonths, incomeMonths, expenseTotal, incomeTotal, prevExpense, prevIncome, matrix, categoryTotals, byPayment, byInterval, highest }
  }, [data.entries, year])

  const slices = categorySlices(s.categoryTotals, data.categories, dark)
  const shownIds = new Set(slices.map((x) => x.key))
  // Stack order: largest category at the bottom.
  const series = slices.map((x) => ({ key: x.key, name: x.name, color: x.color }))
  const rows = MONTHS_SHORT.map((label, i) => {
    const row: Record<string, number | string> = { label, fullLabel: `${MONTHS[i]} ${year}`, income: s.incomeMonths[i] }
    let other = 0
    for (const [id, values] of s.matrix) {
      if (shownIds.has(id)) row[id] = values[i]
      else other += values[i]
    }
    if (shownIds.has(OTHER_KEY)) row[OTHER_KEY] = other
    return row
  })
  const incomeColor = dark ? '#f0efec' : '#141413'
  const balance = s.incomeTotal - s.expenseTotal
  const monthsWithData = s.expenseMonths.filter((v) => v > 0).length || 1
  const matrixRows = [...s.matrix.entries()].sort((a, b) => sum(b[1]) - sum(a[1]))

  return (
    <div className="page">
      <PageHeader
        title="Jahresübersicht"
        subtitle="Alle Ausgaben und Einnahmen eines Kalenderjahres"
        actions={<PeriodNav label={String(year)} onPrev={() => setYear(year - 1)} onNext={() => setYear(year + 1)} onToday={year === now.y ? undefined : () => setYear(now.y)} />}
      />

      <div className="grid kpis">
        <Kpi
          label={`Ausgaben ${year}`}
          icon={<TrendingDown size={15} />}
          value={<AnimatedMoney value={s.expenseTotal} />}
          foot={
            <>
              {s.prevExpense > 0 ? (
                <>
                  <Delta value={changePercent(s.expenseTotal, s.prevExpense)} />
                  <span>gegenüber {year - 1}</span>
                </>
              ) : (
                <span>keine Daten für {year - 1}</span>
              )}
            </>
          }
        />
        <Kpi
          label={`Einnahmen ${year}`}
          icon={<TrendingUp size={15} />}
          value={<AnimatedMoney value={s.incomeTotal} />}
          foot={
            <>
              {s.prevIncome > 0 ? (
                <>
                  <Delta value={changePercent(s.incomeTotal, s.prevIncome)} higherIsGood />
                  <span>gegenüber {year - 1}</span>
                </>
              ) : (
                <span>keine Daten für {year - 1}</span>
              )}
            </>
          }
        />
        <Kpi
          label="Überschuss"
          icon={<PiggyBank size={15} />}
          value={<span className={balance < 0 ? 'text-bad' : balance > 0 ? 'text-good' : ''}><AnimatedMoney value={balance} /></span>}
          foot={s.incomeTotal > 0 ? `Sparquote ${percent((balance / s.incomeTotal) * 100)}` : 'ohne erfasste Einnahmen'}
        />
        <Kpi
          label="Durchschnitt pro Monat"
          icon={<CalendarRange size={15} />}
          value={<AnimatedMoney value={s.expenseTotal / monthsWithData} />}
          foot={s.expenseTotal > 0 ? `teuerster Monat: ${MONTHS[s.highest]} (${money(s.expenseMonths[s.highest])})` : 'keine Ausgaben'}
        />
      </div>

      <Card
        title="Ausgaben je Monat nach Kategorie"
        hint="Säulen: Ausgaben · Linie: Einnahmen"
      >
        <StackedMonthChart rows={rows} series={series} incomeKey="income" incomeColor={incomeColor} height={320} />
        <div style={{ marginTop: 12, paddingLeft: 80 }}>
          <Legend series={[...series, { key: 'income', name: 'Einnahmen', color: incomeColor }]} />
        </div>
      </Card>

      <div style={{ height: 16 }} />

      <Card title="Kategorien im Jahresverlauf" hint="tatsächlich fällige Beträge je Monat" flush>
        {matrixRows.length === 0 ? (
          <div className="small-empty">Keine Ausgaben in {year}.</div>
        ) : (
          <div className="table-scroll">
            <table className="table compact matrix">
              <thead>
                <tr>
                  <th>Kategorie</th>
                  {MONTHS_SHORT.map((mm) => (
                    <th key={mm} className="right">
                      {mm}
                    </th>
                  ))}
                  <th className="right">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {matrixRows.map(([id, values]) => {
                  const total = sum(values)
                  return (
                    <tr key={id}>
                      <td>
                        <CategoryLabel category={categoryById(id)} />
                      </td>
                      {values.map((v, i) => (
                        <td key={i} className={`right num ${v === 0 ? 'zero' : ''}`} title={money(v)}>
                          {v === 0 ? '–' : moneyShort(v)}
                        </td>
                      ))}
                      <td className="right num" style={{ fontWeight: 600 }} title={`${percent(s.expenseTotal ? (total / s.expenseTotal) * 100 : 0)} der Ausgaben`}>
                        {money(total)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Ausgaben</td>
                  {s.expenseMonths.map((v, i) => (
                    <td key={i} className="right num" title={money(v)}>
                      {moneyShort(v)}
                    </td>
                  ))}
                  <td className="right num">{money(s.expenseTotal)}</td>
                </tr>
                <tr>
                  <td>Einnahmen</td>
                  {s.incomeMonths.map((v, i) => (
                    <td key={i} className="right num" title={money(v)}>
                      {moneyShort(v)}
                    </td>
                  ))}
                  <td className="right num">{money(s.incomeTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <div style={{ height: 16 }} />

      <div className="grid cols-2">
        <Card title="Nach Zahlungsart" flush>
          <ShareList items={[...s.byPayment.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} total={s.expenseTotal} />
        </Card>
        <Card title="Nach Zahlungsrhythmus" flush>
          <ShareList
            items={[...s.byInterval.entries()].sort((a, b) => b[1] - a[1]).map(([interval, value]) => ({ label: INTERVAL_LABELS[interval], value }))}
            total={s.expenseTotal}
          />
        </Card>
      </div>
    </div>
  )
}
