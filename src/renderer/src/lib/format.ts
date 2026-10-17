import { parseIso } from '@shared/calc'

const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })
const eurShort = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const pct = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 0 })

export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export function money(value: number): string {
  return eur.format(value)
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
