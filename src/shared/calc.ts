import type { Entry, EntryKind, Interval } from './types'

/**
 * All dates are ISO calendar dates (YYYY-MM-DD) without a time zone. Arithmetic
 * runs on plain year/month/day numbers so results never shift with the local
 * time zone or daylight saving time.
 */

export interface Occurrence {
  entry: Entry
  date: string
  amount: number
  /** Set for extra payments such as a 13th salary. */
  extraLabel?: string
}

const MONTH_STEPS: Partial<Record<Interval, number>> = {
  monthly: 1,
  quarterly: 3,
  halfyearly: 6,
  yearly: 12
}

/** Occurrences per year, used to normalise amounts. */
export const PER_YEAR: Record<Interval, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  halfyearly: 2,
  yearly: 1,
  once: 0
}

export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

export function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`
}

export function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

export function isValidIso(iso: string | null | undefined): iso is string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const { y, m, d } = parseIso(iso)
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m)
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export function todayIso(now: Date = new Date()): string {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

function dayNumber(iso: string): number {
  const { y, m, d } = parseIso(iso)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

function fromDayNumber(n: number): string {
  const dt = new Date(n * 86_400_000)
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

export function addDays(iso: string, days: number): string {
  return fromDayNumber(dayNumber(iso) + days)
}

export function daysBetween(fromIso: string, toIsoDate: string): number {
  return dayNumber(toIsoDate) - dayNumber(fromIso)
}

/** Adds months, keeping `anchorDay` where the month allows and clamping otherwise (31 -> 30/28). */
export function addMonths(iso: string, months: number, anchorDay?: number): string {
  const { y, m, d } = parseIso(iso)
  const index = y * 12 + (m - 1) + months
  const ny = Math.floor(index / 12)
  const nm = (index % 12) + 1
  return toIso(ny, nm, Math.min(anchorDay ?? d, daysInMonth(ny, nm)))
}

export function monthStart(y: number, m: number): string {
  return toIso(y, m, 1)
}

export function monthEnd(y: number, m: number): string {
  return toIso(y, m, daysInMonth(y, m))
}

/** True when the entry is counted at all (paused entries are left out of every calculation). */
export function isCounted(entry: Entry): boolean {
  return !entry.paused && entry.amount > 0
}

/** True when a recurring entry runs on the given date. */
export function isActiveOn(entry: Entry, iso: string): boolean {
  if (!isCounted(entry)) return false
  if (entry.interval === 'once') return entry.startDate === iso
  if (entry.startDate > iso) return false
  return !entry.endDate || entry.endDate >= iso
}

/** Every due date of an entry within [from, to], both inclusive. */
export function occurrencesBetween(entry: Entry, from: string, to: string): string[] {
  if (!isCounted(entry) || from > to) return []
  const start = entry.startDate
  const last = entry.endDate && entry.endDate < to ? entry.endDate : to
  if (start > last) return []

  if (entry.interval === 'once') {
    return start >= from && start <= last ? [start] : []
  }

  const result: string[] = []

  if (entry.interval === 'weekly') {
    const startDay = dayNumber(start)
    const fromDay = dayNumber(from)
    const lastDay = dayNumber(last)
    let k = Math.max(0, Math.ceil((fromDay - startDay) / 7))
    for (let day = startDay + k * 7; day <= lastDay; k++, day = startDay + k * 7) {
      result.push(fromDayNumber(day))
    }
    return result
  }

  const step = MONTH_STEPS[entry.interval] ?? 1
  const s = parseIso(start)
  const f = parseIso(from)
  const monthsToFrom = (f.y - s.y) * 12 + (f.m - s.m)
  // Start one step early so a clamped date at a month boundary is never skipped.
  let k = Math.max(0, Math.floor(monthsToFrom / step) - 1)
  for (;;) {
    const date = addMonths(start, k * step, s.d)
    if (date > last) break
    if (date >= from) result.push(date)
    k++
  }
  return result
}

export function nextOccurrence(entry: Entry, fromIso: string, horizonDays = 800): string | null {
  return occurrencesBetween(entry, fromIso, addDays(fromIso, horizonDays))[0] ?? null
}

/** Sum of the yearly extra payments (13th/14th salary etc.) of a recurring entry. */
export function extrasPerYear(entry: Entry): number {
  if (entry.interval === 'once') return 0
  return (entry.extraPayments ?? []).reduce((acc, x) => acc + x.amount, 0)
}

/** Average monthly amount of a recurring entry including extra payments; one-off entries count as 0. */
export function monthlyEquivalent(entry: Entry): number {
  return yearlyEquivalent(entry) / 12
}

export function yearlyEquivalent(entry: Entry): number {
  return entry.amount * PER_YEAR[entry.interval] + extrasPerYear(entry)
}

/** Extra payments of an entry that fall within [from, to]. They are due on the entry's usual day of month. */
export function extraOccurrencesBetween(entry: Entry, from: string, to: string): Array<{ date: string; amount: number; label: string }> {
  if (!isCounted(entry) || entry.interval === 'once' || !entry.extraPayments?.length || from > to) return []
  const day = parseIso(entry.startDate).d
  const first = parseIso(from).y
  const last = parseIso(to).y
  const out: Array<{ date: string; amount: number; label: string }> = []
  for (let y = first; y <= last; y++) {
    for (const x of entry.extraPayments) {
      const date = toIso(y, x.month, Math.min(day, daysInMonth(y, x.month)))
      if (date < from || date > to || date < entry.startDate) continue
      if (entry.endDate && date > entry.endDate) continue
      out.push({ date, amount: x.amount, label: x.label || 'Sonderzahlung' })
    }
  }
  return out
}

export function occurrencesInRange(entries: Entry[], from: string, to: string, kind?: EntryKind): Occurrence[] {
  const out: Occurrence[] = []
  for (const entry of entries) {
    if (kind && entry.kind !== kind) continue
    for (const date of occurrencesBetween(entry, from, to)) {
      out.push({ entry, date, amount: entry.amount })
    }
    for (const x of extraOccurrencesBetween(entry, from, to)) {
      out.push({ entry, date: x.date, amount: x.amount, extraLabel: x.label })
    }
  }
  return out.sort((a, b) => (a.date === b.date ? a.entry.name.localeCompare(b.entry.name) : a.date < b.date ? -1 : 1))
}

export function occurrencesInMonth(entries: Entry[], y: number, m: number, kind?: EntryKind): Occurrence[] {
  return occurrencesInRange(entries, monthStart(y, m), monthEnd(y, m), kind)
}

export function sum(values: number[]): number {
  // Work in cents to avoid floating point drift in long sums.
  return Math.round(values.reduce((acc, v) => acc + Math.round(v * 100), 0)) / 100
}

export function sumOccurrences(list: Occurrence[]): number {
  return sum(list.map((o) => o.amount))
}

/** Normalised monthly amount of everything recurring that is active on `iso`. */
export function recurringMonthlyTotal(entries: Entry[], iso: string, kind: EntryKind): number {
  return sum(entries.filter((e) => e.kind === kind && e.interval !== 'once' && isActiveOn(e, iso)).map(monthlyEquivalent))
}

/** Twelve monthly sums for the given year, keyed by category id. */
export function yearByCategory(entries: Entry[], year: number, kind: EntryKind): Map<string, number[]> {
  const map = new Map<string, number[]>()
  for (let m = 1; m <= 12; m++) {
    for (const o of occurrencesInMonth(entries, year, m, kind)) {
      const row = map.get(o.entry.categoryId) ?? new Array(12).fill(0)
      row[m - 1] = sum([row[m - 1], o.amount])
      map.set(o.entry.categoryId, row)
    }
  }
  return map
}

export function monthTotals(entries: Entry[], year: number, kind: EntryKind): number[] {
  const totals: number[] = []
  for (let m = 1; m <= 12; m++) totals.push(sumOccurrences(occurrencesInMonth(entries, year, m, kind)))
  return totals
}

/** Percentage change from `previous` to `current`, or null when there is no base to compare with. */
export function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}
