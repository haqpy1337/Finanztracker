import { useMemo } from 'react'
import { AlertTriangle, CalendarClock, Plus, Repeat, TrendingDown, TrendingUp, Wallet, PiggyBank } from 'lucide-react'
import {
  addDays,
  addMonths,
  isActiveOn,
  monthlyEquivalent,
  occurrencesInMonth,
  occurrencesInRange,
  parseIso,
  recurringMonthlyTotal,
  sum,
  sumOccurrences,
  todayIso
} from '@shared/calc'
import { INTERVAL_LABELS, sampleData } from '@shared/defaults'
import { useStore } from '@/lib/store'
import { useDark } from '@/lib/theme'
import { date, dayAndWeekday, money, MONTHS, MONTHS_SHORT, percent } from '@/lib/format'
import { seriesColor } from '@/lib/palette'
import { upcomingContractEnds } from '@/lib/derive'
import { categorySlices, DonutChart, GroupedBarChart, Legend } from '@/components/charts'
import { Card, CategoryLabel, EmptyState, Kpi, PageHeader } from '@/components/ui'
import { useEntryEditor } from '@/components/EntryEditor'

export function Overview() {
  const { data, replaceData, categoryById, colorSlot } = useStore()
  const editor = useEntryEditor()
  const dark = useDark()
  const today = todayIso()
  const { y, m } = parseIso(today)
  const entries = data.entries

  const stats = useMemo(() => {
    const expenseMonthly = recurringMonthlyTotal(entries, today, 'expense')
    const incomeMonthly = recurringMonthlyTotal(entries, today, 'income')
    const activeRecurring = entries.filter((e) => e.kind === 'expense' && e.interval !== 'once' && isActiveOn(e, today))
    const estimated = sum(activeRecurring.filter((e) => e.estimated).map(monthlyEquivalent))
    const subscriptions = activeRecurring.filter((e) => e.categoryId === 'cat-abos')
    const free = incomeMonthly - expenseMonthly

    const perCategory = new Map<string, number>()
    for (const e of activeRecurring) perCategory.set(e.categoryId, sum([perCategory.get(e.categoryId) ?? 0, monthlyEquivalent(e)]))

    const upcoming = occurrencesInRange(entries, today, addDays(today, 30))
    const largest = [...activeRecurring].sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a)).slice(0, 6)

    const trend: Array<Record<string, number | string>> = []
    for (let i = 11; i >= 0; i--) {
      const p = parseIso(addMonths(`${y}-${String(m).padStart(2, '0')}-01`, -i))
      trend.push({
        label: MONTHS_SHORT[p.m - 1],
        fullLabel: `${MONTHS[p.m - 1]} ${p.y}`,
        expense: sumOccurrences(occurrencesInMonth(entries, p.y, p.m, 'expense')),
        income: sumOccurrences(occurrencesInMonth(entries, p.y, p.m, 'income'))
      })
    }

    return {
      expenseMonthly,
      incomeMonthly,
      estimated,
      free,
      savingsRate: incomeMonthly > 0 ? (free / incomeMonthly) * 100 : null,
      activeCount: activeRecurring.length,
      subscriptionsCount: subscriptions.length,
      subscriptionsMonthly: sum(subscriptions.map(monthlyEquivalent)),
      perCategory,
      upcoming,
      largest,
      trend,
      contractEnds: upcomingContractEnds(entries, today, 60),
      monthDue: sumOccurrences(occurrencesInMonth(entries, y, m, 'expense'))
    }
  }, [entries, today, y, m])

  if (entries.length === 0) {
    return (
      <div className="page">
        <PageHeader title="Übersicht" subtitle="Willkommen im Finanztracker" />
        <div className="card">
          <EmptyState
            icon={<Wallet size={22} />}
            title="Noch keine Ausgaben erfasst"
            text="Trage deine regelmäßigen Ausgaben wie Miete, Strom, Abos oder Versicherungen ein. Die Übersichten und Auswertungen entstehen dann automatisch."
            actions={
              <>
                <button className="btn primary" onClick={() => editor.create('expense')}>
                  <Plus size={16} />
                  Erste Ausgabe hinzufügen
                </button>
                <button className="btn" onClick={() => replaceData({ ...sampleData({ y, m }), settings: data.settings })}>
                  Beispieldaten laden
                </button>
              </>
            }
          />
        </div>
      </div>
    )
  }

  const budget = data.settings.monthlyBudget
  const slices = categorySlices(stats.perCategory, data.categories, dark)
  const trendSeries = [
    { key: 'expense', name: 'Ausgaben', color: seriesColor(0, dark) },
    { key: 'income', name: 'Einnahmen', color: seriesColor(2, dark) }
  ]
  const largestMax = stats.largest.length ? monthlyEquivalent(stats.largest[0]) : 0

  return (
    <div className="page">
      <PageHeader
        title="Übersicht"
        subtitle={`Stand ${date(today)} · alle laufenden Posten auf einen Monat umgerechnet`}
        actions={
          <>
            <button className="btn" onClick={() => editor.create('income')}>
              <TrendingUp size={16} />
              Einnahme
            </button>
            <button className="btn primary" onClick={() => editor.create('expense')}>
              <Plus size={16} />
              Ausgabe hinzufügen
            </button>
          </>
        }
      />

      <div className="grid kpis">
        <Kpi
          label="Fixkosten pro Monat"
          icon={<TrendingDown size={15} />}
          value={money(stats.expenseMonthly)}
          foot={
            <>
              {stats.estimated > 0 ? <span>davon geschätzt {money(stats.estimated)}</span> : <span>{stats.activeCount} laufende Posten</span>}
              {budget > 0 && (
                <div style={{ width: '100%' }}>
                  <div className="budget-bar" title={`Budget ${money(budget)}`}>
                    <div className={stats.expenseMonthly > budget ? 'over' : ''} style={{ width: `${Math.min(100, (stats.expenseMonthly / budget) * 100)}%` }} />
                  </div>
                  <span className={stats.expenseMonthly > budget ? 'text-bad' : ''}>
                    {percent((stats.expenseMonthly / budget) * 100)} des Budgets von {money(budget)}
                  </span>
                </div>
              )}
            </>
          }
        />
        <Kpi label="Einnahmen pro Monat" icon={<TrendingUp size={15} />} value={money(stats.incomeMonthly)} foot={stats.incomeMonthly === 0 ? 'Noch keine Einnahmen erfasst' : 'regelmäßige Einnahmen'} />
        <Kpi
          label="Frei verfügbar pro Monat"
          icon={<PiggyBank size={15} />}
          value={<span className={stats.free < 0 ? 'text-bad' : ''}>{money(stats.free)}</span>}
          foot={stats.savingsRate !== null ? `${percent(stats.savingsRate)} der Einnahmen bleiben übrig` : 'Einnahmen erfassen für diese Auswertung'}
        />
        <Kpi
          label="Fixkosten pro Jahr"
          icon={<Repeat size={15} />}
          value={money(stats.expenseMonthly * 12)}
          foot={
            stats.subscriptionsCount > 0
              ? `${stats.subscriptionsCount} Abos für ${money(stats.subscriptionsMonthly)} im Monat`
              : `${stats.activeCount} laufende Posten`
          }
        />
      </div>

      {stats.contractEnds.length > 0 && (
        <div className="alert">
          <AlertTriangle size={17} style={{ flex: 'none', marginTop: 1 }} />
          <div>
            <strong>Kündigungstermine in Sicht: </strong>
            {stats.contractEnds.map(({ entry, daysLeft }, i) => (
              <span key={entry.id}>
                {i > 0 && ', '}
                {entry.name} am {date(entry.contractEnd)} ({daysLeft === 0 ? 'heute' : `in ${daysLeft} Tagen`})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid cols-3-2" style={{ marginBottom: 16 }}>
        <Card title="Monatliche Fixkosten nach Kategorie" hint="Jährliche und vierteljährliche Beträge sind anteilig umgerechnet">
          {slices.length ? (
            <DonutChart slices={slices} centerValue={money(stats.expenseMonthly)} centerLabel="pro Monat" />
          ) : (
            <div className="small-empty">Keine laufenden Ausgaben.</div>
          )}
        </Card>

        <Card title="Nächste Zahlungen" hint="in den kommenden 30 Tagen" flush>
          {stats.upcoming.length === 0 ? (
            <div className="small-empty">In den nächsten 30 Tagen ist nichts fällig.</div>
          ) : (
            <div className="list" style={{ maxHeight: 330, overflow: 'auto' }}>
              {stats.upcoming.slice(0, 40).map((o) => {
                const p = parseIso(o.date)
                return (
                  <div className="list-row" key={`${o.entry.id}-${o.date}`} onDoubleClick={() => editor.edit(o.entry)}>
                    <div className="date-chip">
                      <div className="d">{p.d}</div>
                      <div className="m">{MONTHS_SHORT[p.m - 1]}</div>
                    </div>
                    <div className="grow">
                      <div className="title">{o.entry.name}</div>
                      <div className="entry-meta">
                        {dayAndWeekday(o.date)} · {categoryById(o.entry.categoryId)?.name ?? 'Ohne Kategorie'}
                      </div>
                    </div>
                    <div className={`num ${o.entry.kind === 'income' ? 'text-good' : ''}`} style={{ fontWeight: 600 }}>
                      {o.entry.kind === 'income' ? '+' : '−'}
                      {money(o.amount)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid cols-3-2">
        <Card title="Ausgaben und Einnahmen der letzten 12 Monate" hint="tatsächlich fällige Beträge je Monat" actions={<Legend series={trendSeries} />}>
          <GroupedBarChart rows={stats.trend} series={trendSeries} />
        </Card>

        <Card title="Größte laufende Posten" hint="pro Monat umgerechnet" flush>
          {stats.largest.length === 0 ? (
            <div className="small-empty">Keine laufenden Ausgaben.</div>
          ) : (
            <div className="list">
              {stats.largest.map((e) => {
                const value = monthlyEquivalent(e)
                const cat = categoryById(e.categoryId)
                return (
                  <div className="list-row" key={e.id} style={{ cursor: 'pointer' }} onClick={() => editor.edit(e)}>
                    <div className="grow">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span className="title">{e.name}</span>
                        <span className="num" style={{ fontWeight: 600 }}>
                          {money(value)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, margin: '3px 0 6px' }}>
                        <span className="entry-meta">
                          <CategoryLabel category={cat} />
                        </span>
                        <span className="entry-meta">
                          {INTERVAL_LABELS[e.interval]} {money(e.amount)}
                        </span>
                      </div>
                      <div className="share-bar">
                        <div style={{ width: `${largestMax ? (value / largestMax) * 100 : 0}%`, background: seriesColor(colorSlot(e.categoryId), dark) }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="card-hint" style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        <CalendarClock size={13} />
        Im {MONTHS[m - 1]} sind insgesamt {money(stats.monthDue)} an Ausgaben fällig.
      </div>
    </div>
  )
}
