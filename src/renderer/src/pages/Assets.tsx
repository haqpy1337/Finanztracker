import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Download, Gem, Pencil, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp, Wallet, Hourglass, Trophy } from 'lucide-react'
import type { Asset, AssetValuation } from '@shared/types'
import { daysBetween, todayIso } from '@shared/calc'
import { ASSET_TYPE_LABELS, ASSET_TYPE_SLOTS, assetPoints, blankAsset, isItemType, portfolioSeries, summarize, type AssetSummary } from '@shared/assets'
import { useStore } from '@/lib/store'
import { useToast } from '@/lib/toast'
import { useDark } from '@/lib/theme'
import { api } from '@/lib/api'
import { ago, date, duration, money, quantity, signedMoney, signedPercent } from '@/lib/format'
import { seriesColor } from '@/lib/palette'
import { assetsToCsv } from '@/lib/derive'
import { DonutChart, type Slice } from '@/components/charts'
import { GainBars, TimeChart, type TimeRow } from '@/components/assetCharts'
import { AnimatedMoney } from '@/components/AnimatedNumber'
import { AssetDialog, ASSET_TYPE_ICONS } from '@/components/AssetDialog'
import { ValuationDialog } from '@/components/ValuationDialog'
import { Card, ConfirmDialog, EmptyState, Kpi, PageHeader, Segmented } from '@/components/ui'

/** A value older than this gets a gentle reminder to update it. */
const STALE_DAYS = 120

type Filter = 'held' | 'sold' | 'all'
type ChartMode = 'value' | 'gain'

function gainClass(v: number): string {
  return v > 0.004 ? 'text-good' : v < -0.004 ? 'text-bad' : ''
}

function TypeLabel({ asset }: { asset: Asset }) {
  const dark = useDark()
  return (
    <span className="cat">
      <span className="dot" style={{ background: seriesColor(ASSET_TYPE_SLOTS[asset.type], dark) }} />
      {ASSET_TYPE_LABELS[asset.type]}
    </span>
  )
}

function assetMeta(a: Asset): string {
  const parts = isItemType(a.type) ? [a.description, a.grading, a.certificate && `Nr. ${a.certificate}`] : [a.provider, a.identifier]
  if (isItemType(a.type) && a.provider) parts.push(a.provider)
  return parts.filter(Boolean).join(' · ')
}

export function Assets() {
  const { data, upsertAsset, deleteAsset } = useStore()
  const toast = useToast()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ asset: Asset; isNew: boolean } | null>(null)
  const [valuing, setValuing] = useState<{ asset: Asset; valuation?: AssetValuation } | null>(null)
  const [deleting, setDeleting] = useState<Asset | null>(null)
  const today = todayIso()

  const selected = data.assets.find((a) => a.id === selectedId) ?? null

  const saveAsset = (asset: Asset, isNew: boolean) => {
    upsertAsset(asset)
    toast({ message: isNew ? `„${asset.name}“ hinzugefügt` : `„${asset.name}“ gespeichert` })
    setEditing(null)
  }

  const saveValuation = (asset: Asset, previous: Asset) => {
    upsertAsset(asset)
    const added = asset.valuations.length > previous.valuations.length
    const removed = asset.valuations.length < previous.valuations.length
    toast({
      message: removed ? 'Wertstand gelöscht' : added ? `Neuer Stand für „${asset.name}“ gespeichert` : 'Wertstand gespeichert',
      actionLabel: 'Rückgängig',
      action: () => upsertAsset(previous)
    })
    setValuing(null)
  }

  const open = (id: string) => {
    setSelectedId(id)
    document.querySelector('.main')?.scrollTo({ top: 0 })
  }

  return (
    <>
      <div key={selected ? selected.id : 'list'} className="page-enter">
        {selected ? (
          <AssetDetail
            asset={selected}
            today={today}
            onBack={() => setSelectedId(null)}
            onEdit={() => setEditing({ asset: selected, isNew: false })}
            onUpdate={(valuation) => setValuing({ asset: selected, valuation })}
          />
        ) : (
          <AssetList
            assets={data.assets}
            today={today}
            onCreate={() => setEditing({ asset: blankAsset('etf', today), isNew: true })}
            onOpen={open}
            onEdit={(a) => setEditing({ asset: a, isNew: false })}
            onUpdate={(a) => setValuing({ asset: a })}
            onDelete={setDeleting}
            onExport={async () => {
              const path = await api.exportCsv(assetsToCsv(data.assets, today), 'Moo-Anlagen')
              if (path) toast({ message: 'CSV-Datei gespeichert' })
            }}
          />
        )}
      </div>

      {editing && (
        <AssetDialog
          key={editing.asset.id}
          initial={editing.asset}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={(a) => saveAsset(a, editing.isNew)}
          onDelete={(a) => {
            setEditing(null)
            setDeleting(a)
          }}
        />
      )}
      {valuing && (
        <ValuationDialog
          key={valuing.valuation?.id ?? 'new'}
          asset={valuing.asset}
          valuation={valuing.valuation}
          onClose={() => setValuing(null)}
          onSave={(a) => saveValuation(a, valuing.asset)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Anlage löschen?"
          text={
            <>
              „{deleting.name}“ wird mit allen {deleting.valuations.length} Wertständen entfernt. Du kannst das direkt danach noch rückgängig machen. Wurde die
              Anlage verkauft, trage stattdessen den Verkauf ein, dann bleibt der Gewinn in der Auswertung.
            </>
          }
          confirmLabel="Löschen"
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            const removed = deleting
            deleteAsset(removed.id)
            if (selectedId === removed.id) setSelectedId(null)
            toast({ message: `„${removed.name}“ gelöscht`, actionLabel: 'Rückgängig', action: () => upsertAsset(removed) })
          }}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// All assets

function AssetList({
  assets,
  today,
  onCreate,
  onOpen,
  onEdit,
  onUpdate,
  onDelete,
  onExport
}: {
  assets: Asset[]
  today: string
  onCreate(): void
  onOpen(id: string): void
  onEdit(a: Asset): void
  onUpdate(a: Asset): void
  onDelete(a: Asset): void
  onExport(): void
}) {
  const dark = useDark()
  const [filter, setFilter] = useState<Filter>('held')
  const [mode, setMode] = useState<ChartMode>('value')

  const stats = useMemo(() => {
    const summaries = assets.map((a) => summarize(a, today))
    const held = summaries.filter((s) => !s.sold)
    const sold = summaries.filter((s) => s.sold)
    const value = held.reduce((t, s) => t + s.value, 0)
    const investedHeld = held.reduce((t, s) => t + s.invested, 0)
    const realized = sold.reduce((t, s) => t + s.gain, 0)
    const gain = held.reduce((t, s) => t + s.gain, 0) + realized
    const investedAll = summaries.reduce((t, s) => t + s.invested, 0)
    const withPct = summaries.filter((s) => s.gainPercent !== null)
    const best = [...withPct].sort((a, b) => b.gainPercent! - a.gainPercent!)[0] ?? null
    const worst = [...withPct].sort((a, b) => a.gainPercent! - b.gainPercent!)[0] ?? null
    const series = portfolioSeries(assets, today)
    const first = series[0]?.date ?? today
    const byType = new Map<string, number>()
    for (const s of held) byType.set(s.asset.type, (byType.get(s.asset.type) ?? 0) + s.value)
    const stale = held.filter((s) => daysBetween(s.lastDate, today) > STALE_DAYS)
    return { summaries, held, sold, value, investedHeld, realized, gain, investedAll, best, worst, series, first, byType, stale }
  }, [assets, today])

  if (assets.length === 0) {
    return (
      <div className="page">
        <PageHeader title="Anlagen" subtitle="Geldanlagen und Wertgegenstände, getrennt von Einnahmen und Ausgaben" />
        <div className="card">
          <EmptyState
            icon={<Gem size={22} />}
            title="Noch keine Anlagen erfasst"
            text="Trage ETFs, Aktien, Krypto, Tagesgeld oder auch Wertgegenstände wie eine gegradete Pokémon-Karte ein. Aktualisiere den Wert ab und zu, dann siehst du, wo du im Plus oder Minus bist."
            actions={
              <button className="btn primary" onClick={onCreate}>
                <Plus size={16} />
                Erste Anlage hinzufügen
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const shown = stats.summaries
    .filter((s) => (filter === 'all' ? true : filter === 'sold' ? s.sold : !s.sold))
    .sort((a, b) => Number(a.sold) - Number(b.sold) || b.value - a.value)
  const gainPct = stats.investedAll > 0 ? (stats.gain / stats.investedAll) * 100 : null

  const slices: Slice[] = [...stats.byType.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([type, v]) => ({ key: type, name: ASSET_TYPE_LABELS[type as Asset['type']], value: v, color: seriesColor(ASSET_TYPE_SLOTS[type as Asset['type']], dark) }))

  const rows: TimeRow[] = stats.series.map((p) => ({ ...p }))
  const bars = [...stats.summaries]
    .sort((a, b) => b.gain - a.gain)
    .map((s) => ({ id: s.asset.id, name: s.asset.name, gain: s.gain, percent: s.gainPercent, sold: s.sold }))

  return (
    <div className="page">
      <PageHeader
        title="Anlagen"
        subtitle={`Stand ${date(today)} · Geldanlagen und Wertgegenstände, getrennt von Einnahmen und Ausgaben`}
        actions={
          <>
            <button className="btn" onClick={onExport}>
              <Download size={16} />
              CSV-Export
            </button>
            <button className="btn primary" onClick={onCreate}>
              <Plus size={16} />
              Anlage hinzufügen
            </button>
          </>
        }
      />

      <div className="grid kpis">
        <Kpi
          label="Gesamtwert"
          icon={<Wallet size={15} />}
          value={<AnimatedMoney value={stats.value} />}
          foot={`${stats.held.length} ${stats.held.length === 1 ? 'Anlage' : 'Anlagen'} im Bestand`}
        />
        <Kpi label="Eingezahlt" icon={<Gem size={15} />} value={<AnimatedMoney value={stats.investedHeld} />} foot="Kaufpreise und Nachkäufe im Bestand" />
        <Kpi
          label={stats.gain >= 0 ? 'Gewinn gesamt' : 'Verlust gesamt'}
          icon={stats.gain >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
          value={
            <span className={gainClass(stats.gain)}>
              {stats.gain > 0.004 ? '+' : ''}
              <AnimatedMoney value={stats.gain} />
            </span>
          }
          foot={
            <>
              <span className={`delta ${gainClass(stats.gain)}`}>{signedPercent(gainPct)}</span>
              <span>seit {date(stats.first)}</span>
              {stats.sold.length > 0 && <span>· davon realisiert {signedMoney(stats.realized)}</span>}
            </>
          }
        />
        <Kpi
          label="Beste Entwicklung"
          icon={<Trophy size={15} />}
          value={stats.best ? <span className={gainClass(stats.best.gain)}>{signedPercent(stats.best.gainPercent)}</span> : '–'}
          foot={
            stats.best ? (
              <>
                <span>{stats.best.asset.name}</span>
                {stats.worst && stats.worst !== stats.best && (
                  <span style={{ width: '100%' }}>
                    Schwächste: {stats.worst.asset.name} <span className={gainClass(stats.worst.gain)}>{signedPercent(stats.worst.gainPercent)}</span>
                  </span>
                )}
              </>
            ) : (
              'Kaufpreise erfassen für diese Auswertung'
            )
          }
        />
      </div>

      {stats.stale.length > 0 && (
        <div className="alert">
          <AlertTriangle size={17} style={{ flex: 'none', marginTop: 1 }} />
          <div>
            <strong>Zeit für neue Stände: </strong>
            {stats.stale.map((s, i) => (
              <span key={s.asset.id}>
                {i > 0 && ', '}
                <button className="link-btn" onClick={() => onUpdate(s.asset)}>
                  {s.asset.name}
                </button>{' '}
                (zuletzt {ago(daysBetween(s.lastDate, today))})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="stack" style={{ marginBottom: 16 }}>
        <Card
          title="Entwicklung aller Anlagen"
          hint={mode === 'value' ? 'Gesamtwert im Bestand, gestrichelt der eingezahlte Betrag' : 'Gewinn und Verlust inklusive verkaufter Anlagen'}
          actions={
            <Segmented<ChartMode>
              value={mode}
              onChange={setMode}
              options={[
                { value: 'value', label: 'Wert' },
                { value: 'gain', label: 'Gewinn/Verlust' }
              ]}
            />
          }
        >
          {rows.length >= 2 ? (
            <TimeChart key={mode} rows={rows} mode={mode} height={320} />
          ) : (
            <div className="small-empty">Der Verlauf erscheint, sobald es Werte an mindestens zwei Tagen gibt.</div>
          )}
        </Card>

      </div>

      <div className="grid cols-2" style={{ marginBottom: 16 }}>
        <Card title="Aufteilung nach Art" hint="aktueller Wert im Bestand">
          {slices.length ? <DonutChart slices={slices} centerValue={money(stats.value)} centerLabel="Gesamtwert" /> : <div className="small-empty">Nichts im Bestand.</div>}
        </Card>
        <Card title="Gewinn und Verlust je Anlage" hint="Klick öffnet die Details">
          <GainBars rows={bars} onSelect={onOpen} />
        </Card>
      </div>

      <div className="stack">

        <Card
          title="Alle Anlagen"
          flush
          actions={
            stats.sold.length > 0 ? (
              <Segmented<Filter>
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'held', label: `Im Bestand (${stats.held.length})` },
                  { value: 'sold', label: `Verkauft (${stats.sold.length})` },
                  { value: 'all', label: 'Alle' }
                ]}
              />
            ) : undefined
          }
        >
          {shown.length === 0 ? (
            <div className="small-empty">Keine Anlagen in dieser Ansicht.</div>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Anlage</th>
                    <th className="right">Eingezahlt</th>
                    <th className="right">{filter === 'sold' ? 'Erlös' : 'Wert'}</th>
                    <th className="right">Gewinn/Verlust</th>
                    <th>Letzter Stand</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <AssetRow key={s.asset.id} s={s} today={today} onOpen={onOpen} onEdit={onEdit} onUpdate={onUpdate} onDelete={onDelete} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      <div className="card-hint" style={{ marginTop: 10 }}>
        Tipp: Klick auf eine Anlage zeigt den Verlauf und alle Wertstände.
      </div>
    </div>
  )
}

function AssetRow({
  s,
  today,
  onOpen,
  onEdit,
  onUpdate,
  onDelete
}: {
  s: AssetSummary
  today: string
  onOpen(id: string): void
  onEdit(a: Asset): void
  onUpdate(a: Asset): void
  onDelete(a: Asset): void
}) {
  const a = s.asset
  const meta = assetMeta(a)
  const age = daysBetween(s.lastDate, today)
  return (
    <tr className={s.sold ? 'row-muted clickable' : 'clickable'} onClick={() => onOpen(a.id)}>
      <td>
        <div className="entry-name asset-name">
          <span className="asset-icon" data-type={a.type}>
            {ASSET_TYPE_ICONS[a.type]}
          </span>
          <div>
            <div>{a.name}</div>
            <div className="entry-meta">
              <TypeLabel asset={a} />
              {meta && <> · {meta}</>}
            </div>
          </div>
        </div>
      </td>
      <td className="right num text-2">{money(s.invested)}</td>
      <td className="right num" style={{ fontWeight: 600 }}>
        {money(s.value)}
      </td>
      <td className={`right num ${gainClass(s.gain)}`}>
        <div style={{ fontWeight: 600 }}>{signedMoney(s.gain)}</div>
        <div className="entry-meta" style={{ color: 'inherit' }}>
          {signedPercent(s.gainPercent)}
        </div>
      </td>
      <td>
        {s.sold ? (
          <span className="badge">verkauft {date(a.sale!.date)}</span>
        ) : (
          <>
            <div className="num text-2">{date(s.lastDate)}</div>
            <div className={`entry-meta ${age > STALE_DAYS ? 'text-warn' : ''}`}>{ago(age)}</div>
          </>
        )}
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <div className="row-actions">
          {!s.sold && (
            <button className="icon-btn" title="Wert aktualisieren" onClick={() => onUpdate(a)}>
              <RefreshCw size={15} />
            </button>
          )}
          <button className="icon-btn" title="Bearbeiten" onClick={() => onEdit(a)}>
            <Pencil size={15} />
          </button>
          <button className="icon-btn danger" title="Löschen" onClick={() => onDelete(a)}>
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// One asset

function AssetDetail({
  asset,
  today,
  onBack,
  onEdit,
  onUpdate
}: {
  asset: Asset
  today: string
  onBack(): void
  onEdit(): void
  onUpdate(valuation?: AssetValuation): void
}) {
  const s = summarize(asset, today)
  const points = assetPoints(asset)
  const item = isItemType(asset.type)
  const age = daysBetween(s.lastDate, today)

  const rows: TimeRow[] = points.map((p) => ({
    date: p.date,
    value: p.value,
    invested: p.invested,
    gain: Math.round((p.value - p.invested) * 100) / 100,
    known: true,
    label: p.source === 'purchase' ? 'Kauf' : p.source === 'sale' ? 'Verkauf' : p.note || undefined
  }))
  // The last known value holds until today.
  const last = rows[rows.length - 1]
  if (!asset.sale && last.date < today) rows.push({ ...last, date: today, known: false, label: 'heute, letzter bekannter Wert' })

  const history = [...points].reverse()
  const details: Array<[string, string]> = item
    ? [
        ['Beschreibung', asset.description],
        ['Grading / Zustand', asset.grading],
        ['Zertifikats- / Seriennummer', asset.certificate],
        ['Gekauft bei', asset.provider]
      ]
    : [
        [asset.type === 'cash' ? 'Konto / Bank' : 'ISIN / WKN / Kürzel', asset.identifier],
        ['Depot / Plattform', asset.provider],
        ['Anzahl', asset.quantity !== null ? quantity(asset.quantity) : ''],
        ['Wert pro Stück', asset.quantity ? money(s.value / asset.quantity) : '']
      ]
  details.unshift(['Art', ASSET_TYPE_LABELS[asset.type]], [asset.type === 'cash' ? 'Angelegt am' : 'Gekauft am', date(asset.purchaseDate)])
  if (asset.sale) details.push(['Verkauft am', date(asset.sale.date)])

  return (
    <div className="page">
      <button className="btn ghost small back-btn" onClick={onBack}>
        <ArrowLeft size={15} />
        Alle Anlagen
      </button>
      <PageHeader
        title={asset.name}
        subtitle={
          <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <TypeLabel asset={asset} />
            {assetMeta(asset) && <span>· {assetMeta(asset)}</span>}
            {s.sold && <span className="badge">verkauft</span>}
          </span>
        }
        actions={
          <>
            <button className="btn" onClick={onEdit}>
              <Pencil size={16} />
              Bearbeiten
            </button>
            {!s.sold && (
              <button className="btn primary" onClick={() => onUpdate()}>
                <RefreshCw size={16} />
                Wert aktualisieren
              </button>
            )}
          </>
        }
      />

      <div className="grid kpis">
        <Kpi
          label={s.sold ? 'Verkaufserlös' : 'Aktueller Wert'}
          icon={<Wallet size={15} />}
          value={<AnimatedMoney value={s.value} />}
          foot={s.sold ? `am ${date(s.lastDate)}` : `Stand ${date(s.lastDate)}, ${ago(age)}`}
        />
        <Kpi
          label="Eingezahlt"
          icon={<Gem size={15} />}
          value={<AnimatedMoney value={s.invested} />}
          foot={s.invested !== asset.purchaseValue ? `Kaufpreis ${money(asset.purchaseValue)} plus Nachkäufe` : 'Kaufpreis inkl. Gebühren'}
        />
        <Kpi
          label={s.gain >= 0 ? (s.sold ? 'Realisierter Gewinn' : 'Gewinn') : s.sold ? 'Realisierter Verlust' : 'Verlust'}
          icon={s.gain >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
          value={
            <span className={gainClass(s.gain)}>
              {s.gain > 0.004 ? '+' : ''}
              <AnimatedMoney value={s.gain} />
            </span>
          }
          foot={<span className={`delta ${gainClass(s.gain)}`}>{signedPercent(s.gainPercent)}</span>}
        />
        <Kpi
          label="Haltedauer"
          icon={<Hourglass size={15} />}
          value={duration(s.heldDays)}
          foot={s.annualPercent !== null ? `entspricht ${signedPercent(s.annualPercent)} pro Jahr` : `seit ${date(points[0].date)}`}
        />
      </div>

      {!s.sold && age > STALE_DAYS && (
        <div className="alert">
          <AlertTriangle size={17} style={{ flex: 'none', marginTop: 1 }} />
          <div style={{ flex: 1 }}>Der letzte Wert ist {ago(age).replace('vor ', '')} alt. Trag einen neuen Stand ein, damit die Auswertung aktuell bleibt.</div>
          <button className="btn small" onClick={() => onUpdate()}>
            Jetzt aktualisieren
          </button>
        </div>
      )}

      <div className="grid cols-3-2" style={{ marginBottom: 16 }}>
        <Card title="Verlauf" hint="Punkte sind eingetragene Stände, gestrichelt der eingezahlte Betrag">
          {rows.length >= 2 ? (
            <TimeChart rows={rows} mode="value" height={280} />
          ) : (
            <div className="small-empty">Trag einen neuen Stand ein, dann entsteht hier der Verlauf.</div>
          )}
        </Card>
        <Card title="Details" flush>
          <dl className="details">
            {details
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            {asset.notes && (
              <div className="notes">
                <dt>Notizen</dt>
                <dd>{asset.notes}</dd>
              </div>
            )}
          </dl>
        </Card>
      </div>

      <Card title="Wertstände" hint={`${asset.valuations.length} ${asset.valuations.length === 1 ? 'Stand' : 'Stände'} seit dem Kauf`} flush>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Datum</th>
                <th className="right">Wert</th>
                <th className="right" title="Wertänderung seit dem vorherigen Stand, ohne Nachkäufe">
                  Entwicklung
                </th>
                <th className="right">Eingezahlt</th>
                <th className="right">Gewinn/Verlust gesamt</th>
                <th>Notiz</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {history.map((p, i) => {
                const prev = history[i + 1]
                // Payments into a savings plan are not performance, so they are taken out of the change.
                const paidIn = prev ? p.invested - prev.invested : 0
                const change = prev ? p.value - prev.value - paidIn : null
                const base = prev ? prev.value + paidIn : 0
                const gain = p.value - p.invested
                const valuation = p.valuationId ? asset.valuations.find((v) => v.id === p.valuationId) : undefined
                return (
                  <tr key={`${p.source}-${p.valuationId ?? p.date}`} onDoubleClick={() => (valuation ? onUpdate(valuation) : onEdit())}>
                    <td className="num">
                      {date(p.date)}
                      {p.source !== 'valuation' && <span className="badge" style={{ marginLeft: 8 }}>{p.source === 'purchase' ? 'Kauf' : 'Verkauf'}</span>}
                    </td>
                    <td className="right num" style={{ fontWeight: 600 }}>
                      {money(p.value)}
                    </td>
                    <td className={`right num ${change !== null ? gainClass(change) : ''}`}>
                      {change === null ? (
                        '–'
                      ) : (
                        <>
                          {signedMoney(change)}
                          {base > 0 && <span className="text-muted"> · {signedPercent((change / base) * 100)}</span>}
                        </>
                      )}
                    </td>
                    <td className="right num text-2">{money(p.invested)}</td>
                    <td className={`right num ${gainClass(gain)}`}>
                      {signedMoney(gain)}
                      {p.invested > 0 && <span className="text-muted"> · {signedPercent((gain / p.invested) * 100)}</span>}
                    </td>
                    <td className="text-2">{p.note}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" title="Bearbeiten" onClick={() => (valuation ? onUpdate(valuation) : onEdit())}>
                          <Pencil size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="card-hint" style={{ marginTop: 10 }}>
        Tipp: Doppelklick auf einen Stand öffnet ihn zum Bearbeiten oder Löschen.
      </div>
    </div>
  )
}
