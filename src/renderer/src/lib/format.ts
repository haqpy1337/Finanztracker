import { parseIso } from '@shared/calc'
import type { ForeignAmount } from '@shared/types'

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
const eurShort = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const pct = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 0 })

export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export function money(value: number): string {
  return eur.format(value)
}

const usd = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'USD' })
const rateFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 8, useGrouping: false })

export function usdMoney(value: number): string {
  return usd.format(value)
}

/** "Eingegeben: 10,00 $ · Kurs 1 € = 1,0850 $ vom 16.10.2026 (live)" */
export function foreignTitle(f: ForeignAmount): string {
  const source = f.source === 'live' ? 'Live-Kurs' : f.source === 'cached' ? 'zuletzt geladener Kurs' : 'von Hand eingetragen'
  return `Eingegeben: ${usd.format(f.amount)} · Kurs 1 € = ${rateFormat.format(f.rate)} $${f.rateDate ? ` vom ${date(f.rateDate)}` : ''} (${source})`
}

export function moneyShort(value: number): string {
  return eurShort.format(value)
}

export function percent(value: number): string {
  return `${pct.format(value)} %`
}

export function date(iso: string | null | undefined): string {
  if (!iso) return '–'
  const { y, m, d } = parseIso(iso)
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`
}

export function dayAndWeekday(iso: string): string {
  const { y, m, d } = parseIso(iso)
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${wd}, ${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.`
}

export function monthLabel(y: number, m: number): string {
  return `${MONTHS[m - 1]} ${y}`
}

/** Parses German or plain decimal input ("1.234,56", "12,5", "12.50"). */
export function parseAmount(input: string): number | null {
  const s = input.trim().replace(/\s|€/g, '')
  if (!s) return null
  let normalized = s
  if (s.includes(',')) normalized = s.replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

export function amountInput(value: number): string {
  return value ? value.toFixed(2).replace('.', ',') : ''
}

const qty = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 8 })

/** Amount with an explicit sign, e.g. "+120,00 €" or "−35,50 €". */
export function signedMoney(value: number): string {
  const v = Math.round(value * 100) / 100
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${money(Math.abs(v))}`
}

export function signedPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '–'
  const v = Math.round(value * 10) / 10
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${percent(Math.abs(v))}`
}

export function quantity(value: number): string {
  return qty.format(value)
}

/** Parses a number of shares or pieces with up to 8 decimals ("0,0125", "12"). */
export function parseQuantity(input: string): number | null {
  const s = input.trim().replace(/\s/g, '')
  if (!s) return null
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = Number(normalized)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1e8) / 1e8 : null
}

export function quantityInput(value: number | null): string {
  return value === null ? '' : String(value).replace('.', ',')
}

/** "heute", "vor 12 Tagen", "vor 3 Monaten", "vor 2 Jahren". */
export function ago(days: number): string {
  if (days <= 0) return 'heute'
  if (days === 1) return 'gestern'
  if (days < 45) return `vor ${days} Tagen`
  const months = Math.round(days / 30.44)
  if (months < 18) return months === 1 ? 'vor 1 Monat' : `vor ${months} Monaten`
  const years = Math.round(days / 365.25)
  return years === 1 ? 'vor 1 Jahr' : `vor ${years} Jahren`
}

/** Holding period such as "4 Monate" or "2 Jahre 3 Monate". */
export function duration(days: number): string {
  if (days < 31) return days === 1 ? '1 Tag' : `${days} Tage`
  const totalMonths = Math.floor(days / 30.44)
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  const y = years === 1 ? '1 Jahr' : `${years} Jahre`
  const m = months === 1 ? '1 Monat' : `${months} Monate`
  if (years === 0) return m
  return months === 0 ? y : `${y} ${m}`
}
