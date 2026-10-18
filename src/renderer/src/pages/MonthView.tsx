import { useMemo, useState } from 'react'
import { Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { addMonths, changePercent, monthEnd, occurrencesInMonth, parseIso, recurringMonthlyTotal, sum, sumOccurrences, todayIso } from '@shared/calc'
import { INTERVAL_LABELS } from '@shared/defaults'
import type { EntryKind } from '@shared/types'
import { useStore } from '@/lib/store'
import { useDark } from '@/lib/theme'
import { dayAndWeekday, money, monthLabel, MONTHS, percent } from '@/lib/format'
import { categorySlices, DonutChart } from '@/components/charts'
import { AnimatedMoney } from '@/components/AnimatedNumber'
import { Card, CategoryLabel, Delta, Kpi, PageHeader, PeriodNav, Segmented } from '@/components/ui'
import { useEntryEditor } from '@/components/EntryEditor'

export function MonthView() {
  const { data, categoryById } = useStore()
  const editor = useEntryEditor()
  const dark = useDark()
  const now = parseIso(todayIso())
  const [period, setPeriod] = useState({ y: now.y, m: now.m })
  const [filter, setFilter] = useState<'all' | EntryKind>('all')

  const shift = (months: number) => {
    const p = parseIso(addMonths(`${period.y}-${String(period.m).padStart(2, '0')}-01`, months))
    setPeriod({ y: p.y, m: p.m })
  }

  const s = useMemo(() => {
    const { y, m } = period
    const prev = parseIso(addMonths(`${y}-${String(m).padStart(2, '0')}-01`, -1))
    const all = occurrencesInMonth(data.entries, y, m)
    const expenses = all.filter((o) => o.entry.kind === 'expense')
    const income = all.filter((o) => o.entry.kind === 'income')
    const expenseTotal = sumOccurrences(expenses)
    const incomeTotal = sumOccurrences(income)
    const prevExpense = sumOccurrences(occurrencesInMonth(data.entries, prev.y, prev.m, 'expense'))
    const prevIncome = sumOccurrences(occurrencesInMonth(data.entries, prev.y, prev.m, 'income'))
    const average = recurringMonthlyTotal(data.entries, monthEnd(y, m), 'expense')

    const perCategory = new Map<string, number>()
    for (const o of expenses) perCategory.set(o.entry.categoryId, sum([perCategory.get(o.entry.categoryId) ?? 0, o.amount]))

    const fixed = sumOccurrences(expenses.filter((o) => !o.entry.estimated && o.entry.interval !== 'once'))
    const estimated = sumOccurrences(expenses.filter((o) => o.entry.estimated))
    const oneOff = sumOccurrences(expenses.filter((o) => o.entry.interval === 'once'))

    return { all, expenseTotal, incomeTotal, prevExpense, prevIncome, average, perCategory, fixed, estimated, oneOff, prevLabel: MONTHS[prev.m - 1] }
  }, [data.entries, period])

  const rows = filter === 'all' ? s.all : s.all.filter((o) => o.entry.kind === filter)
  const balance = s.incomeTotal - s.expenseTotal
  const budget = data.settings.monthlyBudget
  const slices = categorySlices(s.perCategory, data.categories, dark)

  return (
    <div className="page">
      <PageHeader
        title="Monatsübersicht"
        subtitle="Was in diesem Monat tatsächlich fällig wird"
        actions={
          <PeriodNav
            label={monthLabel(period.y, period.m)}
            onPrev={() => shift(-1)}
            onNext={() => shift(1)}
            onToday={period.y === now.y && period.m === now.m ? undefined : () => setPeriod({ y: now.y, m: now.m })}
          />
        }
      />

      <div className="grid kpis">
        <Kpi
          label="Ausgaben im Monat"
          icon={<TrendingDown size={15} />}
          value={<AnimatedMoney value={s.expenseTotal} />}
          foot={
            <>
              {s.prevExpense > 0 ? (
                <>
                  <Delta value={changePercent(s.expenseTotal, s.prevExpense)} />
                  <span>gegenüber {s.prevLabel}</span>
                </>
              ) : (
                <span>{s.all.filter((o) => o.entry.kind === 'expense').length} Buchungen</span>
              )}
            </>
          }
        />
        <Kpi
          label="Einnahmen im Monat"
          icon={<TrendingUp size={15} />}
          value={<AnimatedMoney value={s.incomeTotal} />}
          foot={
            <>
              {s.prevIncome > 0 ? (
                <>
                  <Delta value={changePercent(s.incomeTotal, s.prevIncome)} higherIsGood />
                  <span>gegenüber {s.prevLabel}</span>
                </>
              ) : (
                <span>{s.all.filter((o) => o.entry.kind === 'income').length} Buchungen</span>
              )}
            </>
          }
        />
        <Kpi
          label="Saldo"
          icon={<Scale size={15} />}
          value={<span className={balance < 0 ? 'text-bad' : balance > 0 ? 'text-good' : ''}><AnimatedMoney value={balance} /></span>}
          foot={s.incomeTotal > 0 ? `${percent((balance / s.incomeTotal) * 100)} der Einnahmen` : 'ohne erfasste Einnahmen'}
        />
        <Kpi
          label={budget > 0 ? 'Budget' : 'Durchschnitt pro Monat'}
          icon={<Wallet size={15} />}
          value={<AnimatedMoney value={budget > 0 ? budget - s.expenseTotal : s.average} />}
          foot={
            budget > 0 ? (
              <span className={s.expenseTotal > budget ? 'text-bad' : ''}>
                {s.expenseTotal > budget ? 'überschritten' : 'noch frei'} · {percent((s.expenseTotal / budget) * 100)} von {money(budget)} verbraucht
              </span>
            ) : (
              <span>
                {s.expenseTotal > s.average ? 'Dieser Monat liegt über' : 'Dieser Monat liegt unter'} dem Durchschnitt der laufenden Kosten
              </span>
            )
          }
        />
      </div>

      <div className="grid cols-2-3">
        <div className="stack">
          <Card title="Ausgaben nach Kategorie">
            {slices.length ? <DonutChart vertical slices={slices} centerValue={money(s.expenseTotal)} centerLabel={MONTHS[period.m - 1]} /> : <div className="small-empty">Keine Ausgaben in diesem Monat.</div>}
          </Card>
          <Card title="Zusammensetzung">
            <table className="table compact legend-table">
              <tbody>
                <tr>
                  <td>Feste Kosten</td>
                  <td className="right num">{money(s.fixed)}</td>
                </tr>
                <tr>
                  <td>Geschätzte Kosten (z. B. Lebensmittel)</td>
                  <td className="right num">{money(s.estimated)}</td>
                </tr>
                <tr>
                  <td>Einmalige Ausgaben</td>
                  <td className="right num">{money(s.oneOff)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td>Summe</td>
                  <td className="right num">{money(s.expenseTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </Card>
        </div>

        <Card
          title="Zahlungsplan"
          hint={`${rows.length} Buchungen im ${MONTHS[period.m - 1]}`}
          flush
          actions={
            <Segmented<'all' | EntryKind>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Alle' },
                { value: 'expense', label: 'Ausgaben' },
                { value: 'income', label: 'Einnahmen' }
              ]}
            />
          }
        >
          {rows.length === 0 ? (
            <div className="small-empty">In diesem Monat ist nichts fällig.</div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Posten</th>
                    <th>Kategorie</th>
                    <th className="right">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={`${o.entry.id}-${o.date}-${o.extraLabel ?? ''}`} onDoubleClick={() => editor.edit(o.entry)} style={{ cursor: 'default' }}>
                      <td className="num text-2" style={{ whiteSpace: 'nowrap' }}>
                        {dayAndWeekday(o.date)}
                      </td>
                      <td>
                        <div className="entry-name">
                          {o.entry.name}
                          {o.extraLabel && (
                            <span className="badge accent" style={{ marginLeft: 8 }}>
                              {o.extraLabel}
                            </span>
                          )}
                          {o.entry.variable && !o.extraLabel && (
                            <span className="badge accent" style={{ marginLeft: 8 }}>
                              variabel
                            </span>
                          )}
                          {o.entry.estimated && (
                            <span className="badge warn" style={{ marginLeft: 8 }}>
                              geschätzt
                            </span>
                          )}
                        </div>
                        <div className="entry-meta">
                          {[
                            o.entry.variable && !o.extraLabel
                              ? `${money(o.entry.variable.rate)} × ${String(o.amount / o.entry.variable.rate).replace('.', ',')} ${o.entry.variable.unit}`
                              : INTERVAL_LABELS[o.entry.interval],
                            o.entry.provider,
                            o.entry.paymentMethod
                          ].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td>
                        <CategoryLabel category={categoryById(o.entry.categoryId)} />
                      </td>
                      <td className={`right num ${o.entry.kind === 'income' ? 'text-good' : ''}`} style={{ fontWeight: 600 }}>
                        {o.entry.kind === 'income' ? '+' : '−'}
                        {money(o.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>{filter === 'all' ? 'Saldo' : 'Summe'}</td>
                    <td className="right num">
                      {money(filter === 'expense' ? s.expenseTotal : filter === 'income' ? s.incomeTotal : balance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
