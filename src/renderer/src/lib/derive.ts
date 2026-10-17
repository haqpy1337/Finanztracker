import type { AppData, Entry } from '@shared/types'
import { daysBetween, monthlyEquivalent, nextOccurrence } from '@shared/calc'
import { INTERVAL_LABELS } from '@shared/defaults'

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
    'Intervall',
    'Pro Monat',
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
    INTERVAL_LABELS[e.interval],
    monthlyEquivalent(e),
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
