import type { AppData, Asset, Entry } from '@shared/types'
import { daysBetween, monthlyEquivalent, nextOccurrence } from '@shared/calc'
import { INTERVAL_LABELS } from '@shared/defaults'
import { ASSET_TYPE_LABELS, summarize } from '@shared/assets'
import { MONTHS } from './format'

export type EntryStatus = 'active' | 'paused' | 'ended' | 'future' | 'once'

export function entryStatus(entry: Entry, today: string): EntryStatus {
  if (entry.paused) return 'paused'
  if (entry.interval === 'once') return 'once'
  if (entry.endDate && entry.endDate < today) return 'ended'
  if (entry.startDate > today) return 'future'
  return 'active'
}

export const STATUS_LABELS: Record<EntryStatus, string> = {
  active: 'Aktiv',
  paused: 'Pausiert',
  ended: 'Beendet',
  future: 'Startet später',
  once: 'Einmalig'
}

/** Contracts whose cancellation date lies within the next `days` days. */
export function upcomingContractEnds(entries: Entry[], today: string, days = 60): Array<{ entry: Entry; daysLeft: number }> {
  return entries
    .filter((e) => !e.paused && e.contractEnd && e.contractEnd >= today && (!e.endDate || e.endDate >= today))
    .map((e) => ({ entry: e, daysLeft: daysBetween(today, e.contractEnd!) }))
    .filter((x) => x.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

function csvCell(value: string | number): string {
  const s = typeof value === 'number' ? value.toFixed(2).replace('.', ',') : value
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Semicolon separated CSV with German number format, so Excel opens it directly. */
export function entriesToCsv(data: AppData, today: string): string {
  const cat = new Map(data.categories.map((c) => [c.id, c.name]))
  const header = [
    'Typ',
    'Bezeichnung',
    'Kategorie',
    'Betrag',
    'Eingegeben in USD',
    'Kurs (1 € in $)',
    'Kursdatum',
    'Intervall',
    'Ø pro Monat',
    'Sonderzahlungen',
    'Variabel',
    'Erste Fälligkeit',
    'Läuft bis',
    'Nächste Fälligkeit',
    'Status',
    'Geschätzt',
    'Zahlungsart',
    'Anbieter',
    'Kündigungsfrist',
    'Vertragsende',
    'Notizen'
  ]
  const rows = data.entries.map((e) => [
    e.kind === 'income' ? 'Einnahme' : 'Ausgabe',
    e.name,
    cat.get(e.categoryId) ?? '',
    e.amount,
    e.foreign ? e.foreign.amount : '',
    e.foreign ? String(e.foreign.rate).replace('.', ',') : '',
    e.foreign?.rateDate ?? '',
    INTERVAL_LABELS[e.interval],
    monthlyEquivalent(e),
    e.extraPayments.map((x) => `${x.label || 'Sonderzahlung'} ${MONTHS[x.month - 1]} ${x.amount.toFixed(2).replace('.', ',')}`).join(', '),
    e.variable
      ? `${e.variable.rate.toFixed(2).replace('.', ',')} pro ${e.variable.unit}, üblich ${String(e.variable.usual).replace('.', ',')}`
      : '',
    e.startDate,
    e.endDate ?? '',
    nextOccurrence(e, today) ?? '',
    STATUS_LABELS[entryStatus(e, today)],
    e.estimated ? 'ja' : 'nein',
    e.paymentMethod,
    e.provider,
    e.noticePeriod,
    e.contractEnd ?? '',
    e.notes
  ])
  return [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n')
}

/** All assets with their current value, one row each, plus every value update below in a second block. */
export function assetsToCsv(assets: Asset[], today: string): string {
  const header = ['Art', 'Bezeichnung', 'Depot / Gekauft bei', 'ISIN / Kürzel', 'Anzahl', 'Beschreibung', 'Grading', 'Zertifikatsnummer', 'Kaufdatum', 'Kaufpreis', 'Eingezahlt', 'Wert', 'Gewinn/Verlust', 'Gewinn/Verlust %', 'Letzter Stand', 'Verkauft am', 'Notizen']
  const rows = assets.map((a) => {
    const s = summarize(a, today)
    return [
      ASSET_TYPE_LABELS[a.type],
      a.name,
      a.provider,
      a.identifier,
      a.quantity === null ? '' : String(a.quantity).replace('.', ','),
      a.description,
      a.grading,
      a.certificate,
      a.purchaseDate,
      a.purchaseValue,
      s.invested,
      s.value,
      s.gain,
      s.gainPercent === null ? '' : s.gainPercent,
      s.lastDate,
      a.sale?.date ?? '',
      a.notes
    ]
  })
  const history: Array<Array<string | number>> = [['Anlage', 'Datum', 'Wert', 'Insgesamt eingezahlt', 'Notiz']]
  for (const a of assets) for (const v of a.valuations) history.push([a.name, v.date, v.value, v.invested ?? '', v.note])
  return [header, ...rows, [], ...history].map((r) => r.map(csvCell).join(';')).join('\r\n')
}
