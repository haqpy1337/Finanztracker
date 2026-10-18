import type { ForeignAmount } from './types'

/** A euro exchange rate for US dollars as published by the ECB. */
export interface UsdRate {
  /** US dollars per euro, e.g. 1.085 means 1 € = 1,085 $. */
  rate: number
  /** Day the reference rate applies to (YYYY-MM-DD). */
  date: string
  /** When the app fetched it (ISO timestamp). */
  fetchedAt: string
}

/**
 * Result of asking for the current rate:
 * - live: freshly fetched just now
 * - cached: the source was unreachable, `rate` is the last one fetched successfully
 * - unavailable: unreachable and nothing fetched before
 */
export type UsdQuote =
  | { status: 'live'; rate: UsdRate }
  | { status: 'cached'; rate: UsdRate; error: string }
  | { status: 'unavailable'; error: string }

/**
 * Free ECB reference rates without an API key (Frankfurter). The second URL is
 * the older address of the same service, used if the first one fails.
 */
export const USD_RATE_URLS = [
  'https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD',
  'https://api.frankfurter.app/latest?from=EUR&to=USD'
]

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function plausibleRate(v: unknown): v is number {
  // Guards against garbage; EUR/USD has stayed between 0.8 and 1.6 since the euro exists.
  return typeof v === 'number' && Number.isFinite(v) && v > 0.2 && v < 5
}

/** Reads a Frankfurter response, e.g. {"base":"EUR","date":"2026-10-16","rates":{"USD":1.085}}. */
export function parseUsdRate(json: unknown, fetchedAt: string): UsdRate | null {
  if (!json || typeof json !== 'object') return null
  const r = json as Record<string, unknown>
  const rates = r.rates as Record<string, unknown> | undefined
  const rate = rates && typeof rates === 'object' ? rates.USD : undefined
  if (r.base !== 'EUR' || !plausibleRate(rate) || typeof r.date !== 'string' || !ISO_DAY.test(r.date)) return null
  return { rate, date: r.date, fetchedAt }
}

/** Validates a stored rate, e.g. the cached one. */
export function validUsdRate(value: unknown): UsdRate | null {
  if (!value || typeof value !== 'object') return null
  const r = value as Record<string, unknown>
  if (!plausibleRate(r.rate) || typeof r.date !== 'string' || !ISO_DAY.test(r.date)) return null
  return { rate: r.rate, date: r.date, fetchedAt: typeof r.fetchedAt === 'string' ? r.fetchedAt : '' }
}

/** Converts US dollars to euros, rounded to cents. `rate` is dollars per euro. */
export function usdToEur(usd: number, rate: number): number {
  if (!(rate > 0)) return 0
  return Math.round((usd / rate) * 100) / 100
}

const SOURCES = new Set<ForeignAmount['source']>(['live', 'cached', 'manual'])

/** Validates the stored original amount of an entry entered in dollars; anything broken becomes null. */
export function normalizeForeign(value: unknown): ForeignAmount | null {
  if (!value || typeof value !== 'object') return null
  const r = value as Record<string, unknown>
  if (r.currency !== 'USD') return null
  const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) ? Math.round(Math.abs(r.amount) * 100) / 100 : 0
  const rate = typeof r.rate === 'number' && Number.isFinite(r.rate) && r.rate > 0 ? r.rate : 0
  if (amount <= 0 || rate <= 0) return null
  return {
    currency: 'USD',
    amount,
    rate,
    rateDate: typeof r.rateDate === 'string' && ISO_DAY.test(r.rateDate) ? r.rateDate : '',
    source: SOURCES.has(r.source as ForeignAmount['source']) ? (r.source as ForeignAmount['source']) : 'manual',
    convertedAt: typeof r.convertedAt === 'string' ? r.convertedAt : ''
  }
}
