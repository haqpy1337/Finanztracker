import type { Asset, AssetType, AssetValuation } from './types'
import { addDays, daysBetween, isValidIso, todayIso } from './calc'

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  etf: 'ETF',
  stock: 'Aktie',
  fund: 'Fonds',
  crypto: 'Krypto',
  metal: 'Edelmetall',
  cash: 'Tages- & Festgeld',
  collectible: 'Sammlerstück',
  other: 'Sonstiges'
}

export const ASSET_TYPES: AssetType[] = ['etf', 'stock', 'fund', 'crypto', 'metal', 'cash', 'collectible', 'other']

/** Chart colour slot per type, so a type looks the same on every chart. */
export const ASSET_TYPE_SLOTS: Record<AssetType, number> = {
  etf: 0,
  stock: 6,
  fund: 4,
  crypto: 3,
  metal: 1,
  cash: 2,
  collectible: 5,
  other: 8
}

/** Items (cards, watches, art …) get description, grading and certificate fields instead of ISIN and shares. */
export function isItemType(type: AssetType): boolean {
  return type === 'collectible' || type === 'other'
}

export function blankAsset(type: AssetType, purchaseDate: string): Asset {
  const now = new Date().toISOString()
  return {
    id: `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    type,
    name: '',
    provider: '',
    identifier: '',
    quantity: null,
    purchaseDate,
    purchaseValue: 0,
    valuations: [],
    description: '',
    grading: '',
    certificate: '',
    notes: '',
    sale: null,
    createdAt: now,
    updatedAt: now
  }
}

// ---------------------------------------------------------------------------
// Validation of stored data

const ASSET_FIELDS = new Set([
  'id',
  'type',
  'name',
  'provider',
  'identifier',
  'quantity',
  'purchaseDate',
  'purchaseValue',
  'valuations',
  'description',
  'grading',
  'certificate',
  'notes',
  'sale',
  'createdAt',
  'updatedAt'
])
const VALUATION_FIELDS = new Set(['id', 'date', 'value', 'invested', 'note'])

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function money(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null
}

function unknownFields(r: Record<string, unknown>, known: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(r).filter(([k]) => !known.has(k)))
}

function rand(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function normalizeValuations(value: unknown): AssetValuation[] {
  if (!Array.isArray(value)) return []
  const out: AssetValuation[] = []
  for (const v of value) {
    if (!v || typeof v !== 'object') continue
    const r = v as Record<string, unknown>
    const amount = money(r.value)
    if (!isValidIso(str(r.date)) || amount === null) continue
    out.push({
      ...unknownFields(r, VALUATION_FIELDS),
      id: str(r.id) || `v-${rand()}`,
      date: str(r.date),
      value: amount,
      invested: money(r.invested),
      note: str(r.note)
    })
  }
  // Stable sort keeps the entry order of several values on the same day.
  return out.map((v, i) => ({ v, i })).sort((a, b) => (a.v.date < b.v.date ? -1 : a.v.date > b.v.date ? 1 : a.i - b.i)).map((x) => x.v)
}

/**
 * Repairs a list of assets from disk or an import. Broken values are fixed
 * instead of dropping the asset, and fields this version does not know are kept.
 */
export function normalizeAssets(value: unknown): Asset[] {
  if (!Array.isArray(value)) return []
  const out: Asset[] = []
  const seen = new Set<string>()
  for (const a of value) {
    if (!a || typeof a !== 'object') continue
    const r = a as Record<string, unknown>
    let id = str(r.id) || `a-${rand()}`
    if (seen.has(id)) id = `${id}-${rand()}`
    seen.add(id)
    const now = new Date().toISOString()
    const createdAt = str(r.createdAt) || now
    const purchaseDate = isValidIso(str(r.purchaseDate)) ? str(r.purchaseDate) : isValidIso(createdAt.slice(0, 10)) ? createdAt.slice(0, 10) : todayIso()
    const s = r.sale && typeof r.sale === 'object' ? (r.sale as Record<string, unknown>) : null
    const saleValue = s ? money(s.value) : null
    const quantity = typeof r.quantity === 'number' && Number.isFinite(r.quantity) && r.quantity >= 0 ? Math.round(r.quantity * 1e8) / 1e8 : null
    out.push({
      ...unknownFields(r, ASSET_FIELDS),
      id,
      type: ASSET_TYPES.includes(r.type as AssetType) ? (r.type as AssetType) : 'other',
      name: str(r.name) || 'Ohne Namen',
      provider: str(r.provider),
      identifier: str(r.identifier),
      quantity,
      purchaseDate,
      purchaseValue: money(r.purchaseValue) ?? 0,
      valuations: normalizeValuations(r.valuations),
      description: str(r.description),
      grading: str(r.grading),
      certificate: str(r.certificate),
      notes: str(r.notes),
      sale: s && isValidIso(str(s.date)) && saleValue !== null ? { date: str(s.date), value: saleValue } : null,
      createdAt,
      updatedAt: str(r.updatedAt) || now
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Evaluation

export interface AssetPoint {
  date: string
  value: number
  invested: number
  /** What the point is: the purchase, a value update or the sale. */
  source: 'purchase' | 'valuation' | 'sale'
  valuationId?: string
  note?: string
}

const round = (n: number) => Math.round(n * 100) / 100

/**
 * Known values of an asset in date order: the purchase, every value update
 * and the sale. The invested amount carries forward until an update names a
 * new one. Updates after the sale are ignored.
 */
export function assetPoints(asset: Asset): AssetPoint[] {
  const points: AssetPoint[] = [{ date: asset.purchaseDate, value: asset.purchaseValue, invested: asset.purchaseValue, source: 'purchase' }]
  let invested = asset.purchaseValue
  const sorted = [...asset.valuations].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  for (const v of sorted) {
    if (asset.sale && v.date > asset.sale.date) break
    if (v.invested !== null) invested = v.invested
    points.push({ date: v.date, value: v.value, invested, source: 'valuation', valuationId: v.id, note: v.note })
  }
  if (asset.sale) points.push({ date: asset.sale.date, value: asset.sale.value, invested, source: 'sale' })
  // Values before the purchase date (e.g. a typo) still count; order by date, later entries win on equal days.
  return points.map((p, i) => ({ p, i })).sort((a, b) => (a.p.date < b.p.date ? -1 : a.p.date > b.p.date ? 1 : a.i - b.i)).map((x) => x.p)
}

export function startDate(asset: Asset): string {
  return assetPoints(asset)[0].date
}

/**
 * Value and invested amount on a day: linear between known values (savings
 * plans pay in gradually, too), flat after the last one. null before the
 * asset existed.
 */
export function stateAt(asset: Asset, iso: string, points = assetPoints(asset)): { value: number; invested: number } | null {
  if (iso < points[0].date) return null
  let prev = points[0]
  for (const p of points) {
    if (p.date > iso) {
      const span = daysBetween(prev.date, p.date)
      const t = span > 0 ? daysBetween(prev.date, iso) / span : 1
      return { value: prev.value + (p.value - prev.value) * t, invested: prev.invested + (p.invested - prev.invested) * t }
    }
    prev = p
  }
  return { value: prev.value, invested: prev.invested }
}

export interface AssetSummary {
  asset: Asset
  value: number
  invested: number
  gain: number
  /** Gain relative to the amount invested; null when nothing was invested (e.g. a gift). */
  gainPercent: number | null
  /** Date of the newest known value. */
  lastDate: string
  sold: boolean
  /** Average yearly return for holdings of at least a year without additional payments. */
  annualPercent: number | null
  heldDays: number
}

export function summarize(asset: Asset, today = todayIso()): AssetSummary {
  const points = assetPoints(asset)
  const last = points[points.length - 1]
  const value = last.value
  const invested = last.invested
  const gain = round(value - invested)
  const first = points[0]
  const end = asset.sale ? asset.sale.date : today
  const heldDays = Math.max(0, daysBetween(first.date, end))
  const steadyInvested = points.every((p) => p.invested === first.invested)
  const annualPercent =
    heldDays >= 365 && steadyInvested && invested > 0 && value > 0 ? (Math.pow(value / invested, 365 / heldDays) - 1) * 100 : null
  return {
    asset,
    value,
    invested,
    gain,
    gainPercent: invested > 0 ? (gain / invested) * 100 : null,
    lastDate: last.date,
    sold: asset.sale !== null,
    annualPercent,
    heldDays
  }
}

export interface PortfolioPoint {
  date: string
  /** Value of everything still held on that day. */
  value: number
  /** Amount invested in everything still held on that day. */
  invested: number
  /** Gain of held assets plus the realised gain of everything sold until then. */
  gain: number
}

/**
 * Development of all assets over time, sampled at every day on which any
 * value is known, plus today. From the day of a sale the asset no longer
 * counts towards value and invested amount, its gain stays in the total.
 */
export function portfolioSeries(assets: Asset[], today = todayIso()): PortfolioPoint[] {
  if (assets.length === 0) return []
  const prepared = assets.map((a) => ({ asset: a, points: assetPoints(a) }))
  const days = new Set<string>([today])
  for (const { asset, points } of prepared) {
    for (const p of points) days.add(p.date)
    // The day before the sale keeps the last held value, so the sale shows as a clean step.
    if (asset.sale) days.add(addDays(asset.sale.date, -1))
  }
  const sorted = [...days].sort()
  const firstDay = sorted.find((d) => prepared.some(({ points }) => points[0].date <= d))
  if (!firstDay) return []
  const lastDay = sorted[sorted.length - 1] > today ? sorted[sorted.length - 1] : today
  return sorted
    .filter((d) => d >= firstDay && d <= lastDay)
    .map((date) => {
      let value = 0
      let invested = 0
      let gain = 0
      for (const { asset, points } of prepared) {
        const s = stateAt(asset, date, points)
        if (!s) continue
        gain += s.value - s.invested
        if (!asset.sale || date < asset.sale.date) {
          value += s.value
          invested += s.invested
        }
      }
      return { date, value: round(value), invested: round(invested), gain: round(gain) }
    })
}

/** Days since the newest known value, for the reminder to update old values. */
export function daysSinceUpdate(summary: AssetSummary, today = todayIso()): number {
  return daysBetween(summary.lastDate, today)
}
