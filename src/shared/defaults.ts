import type { AppData, Asset, AssetValuation, Category, Entry, EntryKind, ExtraPayment, Interval, Settings, VariablePay } from './types'
import { CURRENT_SCHEMA, migrate } from './schema'
import { addMonths, isValidIso, toIso } from './calc'
import { normalizeAssets } from './assets'
import { normalizeForeign } from './fx'

export const INTERVAL_LABELS: Record<Interval, string> = {
  weekly: 'Wöchentlich',
  monthly: 'Monatlich',
  quarterly: 'Vierteljährlich',
  halfyearly: 'Halbjährlich',
  yearly: 'Jährlich',
  once: 'Einmalig'
}

export const INTERVAL_ORDER: Interval[] = ['monthly', 'yearly', 'quarterly', 'halfyearly', 'weekly', 'once']

export const PAYMENT_METHODS = ['Lastschrift', 'Überweisung', 'Dauerauftrag', 'Kreditkarte', 'PayPal', 'Bar', 'Sonstiges']

/** Colour slot for the neutral grey; slots 0-7 are the chart hues. */
export const NEUTRAL_SLOT = 8

export const DEFAULT_SETTINGS: Settings = { theme: 'system', monthlyBudget: 0 }

const DEFAULT_CATEGORIES: Array<[string, string, EntryKind, number]> = [
  // Eight expense categories, one per chart colour, plus neutral grey for "Sonstiges".
  ['cat-wohnen', 'Wohnen & Energie', 'expense', 0],
  ['cat-lebensmittel', 'Lebensmittel & Haushalt', 'expense', 3],
  ['cat-abos', 'Abonnements & Streaming', 'expense', 6],
  ['cat-mobilitaet', 'Mobilität', 'expense', 4],
  ['cat-versicherung', 'Versicherungen', 'expense', 5],
  ['cat-kommunikation', 'Internet & Telefon', 'expense', 7],
  ['cat-freizeit', 'Freizeit & Gesundheit', 'expense', 2],
  ['cat-sparen', 'Sparen & Vorsorge', 'expense', 1],
  ['cat-sonstiges', 'Sonstiges', 'expense', NEUTRAL_SLOT],
  ['cat-gehalt', 'Gehalt', 'income', 2],
  ['cat-einnahmen', 'Sonstige Einnahmen', 'income', 0]
]

export function defaultCategories(): Category[] {
  return DEFAULT_CATEGORIES.map(([id, name, kind, color]) => ({ id, name, kind, color }))
}

export function emptyData(): AppData {
  return { schemaVersion: CURRENT_SCHEMA, categories: defaultCategories(), entries: [], assets: [], settings: { ...DEFAULT_SETTINGS } }
}

export function newId(prefix = 'e'): string {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}-${Date.now().toString(36)}-${rand}`
}

export function blankEntry(kind: EntryKind, categoryId: string, startDate: string): Entry {
  const now = new Date().toISOString()
  return {
    id: newId(),
    kind,
    name: '',
    categoryId,
    amount: 0,
    interval: 'monthly',
    startDate,
    endDate: null,
    estimated: false,
    paused: false,
    provider: '',
    paymentMethod: 'Lastschrift',
    noticePeriod: '',
    contractEnd: null,
    notes: '',
    extraPayments: [],
    variable: null,
    foreign: null,
    createdAt: now,
    updatedAt: now
  }
}

/** Example data so the app can be explored before entering real values. */
export function sampleData(today: { y: number; m: number }): AppData {
  const data = emptyData()
  const firstOfYear = toIso(today.y, 1, 1)
  const day = (d: number) => toIso(today.y, 1, d)
  const make = (
    name: string,
    categoryId: string,
    amount: number,
    interval: Interval,
    startDate: string,
    extra: Partial<Entry> = {}
  ): Entry => ({
    ...blankEntry(categoryId === 'cat-gehalt' || categoryId === 'cat-einnahmen' ? 'income' : 'expense', categoryId, startDate),
    name,
    amount,
    interval,
    ...extra
  })
  data.entries = [
    make('Gehalt', 'cat-gehalt', 3150, 'monthly', day(28), {
      paymentMethod: 'Überweisung',
      provider: 'Arbeitgeber',
      extraPayments: [
        { id: newId('x'), month: 5, amount: 3150, label: '13. Gehalt' },
        { id: newId('x'), month: 11, amount: 3150, label: '14. Gehalt' }
      ]
    }),
    make('Kaltmiete', 'cat-wohnen', 850, 'monthly', day(1), { paymentMethod: 'Dauerauftrag', provider: 'Hausverwaltung' }),
    make('Nebenkosten-Vorauszahlung', 'cat-wohnen', 180, 'monthly', day(1), { paymentMethod: 'Dauerauftrag' }),
    make('Strom', 'cat-wohnen', 72, 'monthly', day(15), { provider: 'Stadtwerke', noticePeriod: '4 Wochen' }),
    make('Wasser', 'cat-wohnen', 38, 'quarterly', day(10), { provider: 'Wasserwerk' }),
    make('Rundfunkbeitrag', 'cat-wohnen', 55.08, 'quarterly', day(15), { provider: 'ARD ZDF Deutschlandradio' }),
    make('Netflix Standard', 'cat-abos', 13.99, 'monthly', day(5), { paymentMethod: 'Kreditkarte', provider: 'Netflix', noticePeriod: 'Monatlich kündbar' }),
    make('Amazon Prime', 'cat-abos', 89.9, 'yearly', toIso(today.y, 3, 12), { paymentMethod: 'Kreditkarte', provider: 'Amazon', noticePeriod: 'Jederzeit' }),
    make('Spotify Premium', 'cat-abos', 10.99, 'monthly', day(20), { paymentMethod: 'PayPal', provider: 'Spotify' }),
    make('Disney+', 'cat-abos', 9.99, 'monthly', day(8), { paymentMethod: 'Kreditkarte', provider: 'Disney', contractEnd: addMonths(toIso(today.y, today.m, 8), 1) }),
    make('Lebensmittel', 'cat-lebensmittel', 420, 'monthly', firstOfYear, { estimated: true, paymentMethod: 'Bar' }),
    make('Drogerie & Haushalt', 'cat-lebensmittel', 60, 'monthly', firstOfYear, { estimated: true, paymentMethod: 'Bar' }),
    make('Deutschlandticket', 'cat-mobilitaet', 58, 'monthly', day(1), { provider: 'Verkehrsverbund', noticePeriod: 'Bis zum 10. des Vormonats' }),
    make('Kfz-Versicherung', 'cat-versicherung', 412.5, 'yearly', day(1), { provider: 'HUK', contractEnd: toIso(today.y, 11, 30), noticePeriod: '1 Monat zum 30.11.' }),
    make('Haftpflichtversicherung', 'cat-versicherung', 64.8, 'yearly', toIso(today.y, 6, 1), { provider: 'Allianz' }),
    make('Hausratversicherung', 'cat-versicherung', 9.5, 'monthly', day(1)),
    make('Internet (DSL 100)', 'cat-kommunikation', 39.99, 'monthly', day(3), { provider: 'Telekom', contractEnd: toIso(today.y + 1, 2, 28), noticePeriod: '1 Monat' }),
    make('Handyvertrag', 'cat-kommunikation', 17.99, 'monthly', day(3), { provider: 'O2' }),
    make('Fitnessstudio', 'cat-freizeit', 29.9, 'monthly', day(1), { provider: 'FitX', noticePeriod: '4 Wochen' }),
    make('ETF-Sparplan', 'cat-sparen', 250, 'monthly', day(2), { paymentMethod: 'Lastschrift', provider: 'Depot' }),
    make('Neue Waschmaschine', 'cat-sonstiges', 549, 'once', toIso(today.y, Math.min(12, Math.max(1, today.m - 2)), 14), { paymentMethod: 'Kreditkarte' })
  ]
  data.assets = sampleAssets(today)
  return data
}

function sampleAssets(today: { y: number; m: number }): Asset[] {
  const ago = (months: number, d = 15) => addMonths(toIso(today.y, today.m, d), -months)
  const now = new Date().toISOString()
  const base = { identifier: '', quantity: null, description: '', grading: '', certificate: '', notes: '', sale: null, createdAt: now, updatedAt: now }
  const v = (date: string, value: number, invested: number | null = null, note = ''): AssetValuation => ({ id: newId('v'), date, value, invested, note })
  return [
    {
      ...base,
      id: newId('a'),
      type: 'etf',
      name: 'MSCI World ETF (Sparplan)',
      provider: 'Trade Republic',
      identifier: 'IE00B4L5Y983',
      purchaseDate: ago(20, 2),
      purchaseValue: 1000,
      valuations: [v(ago(14), 2610, 2500), v(ago(9), 3720, 3750), v(ago(4), 5380, 5000), v(ago(0, 1), 6290, 6000)]
    },
    {
      ...base,
      id: newId('a'),
      type: 'stock',
      name: 'Apple',
      provider: 'Trade Republic',
      identifier: 'US0378331005',
      quantity: 8,
      purchaseDate: ago(16, 10),
      purchaseValue: 1420,
      valuations: [v(ago(10), 1365.4), v(ago(3), 1612.8), v(ago(0, 1), 1688)]
    },
    {
      ...base,
      id: newId('a'),
      type: 'crypto',
      name: 'Bitcoin',
      provider: 'Bitpanda',
      identifier: 'BTC',
      quantity: 0.025,
      purchaseDate: ago(13, 5),
      purchaseValue: 1600,
      valuations: [v(ago(8), 1180), v(ago(2), 1395), v(ago(0, 1), 1310)]
    },
    {
      ...base,
      id: newId('a'),
      type: 'collectible',
      name: 'Glurak Holo',
      provider: 'eBay',
      description: 'Pokémon Base Set, 4/102, Unlimited',
      grading: 'PSA 9',
      certificate: '81234567',
      purchaseDate: ago(18, 20),
      purchaseValue: 850,
      valuations: [v(ago(11), 920, null, 'Vergleich verkaufter Karten'), v(ago(1), 1150, null, 'Cardmarket-Trend')]
    }
  ]
}

const ENTRY_FIELDS = new Set([
  'id',
  'kind',
  'name',
  'categoryId',
  'amount',
  'interval',
  'startDate',
  'endDate',
  'estimated',
  'paused',
  'provider',
  'paymentMethod',
  'noticePeriod',
  'contractEnd',
  'notes',
  'extraPayments',
  'variable',
  'foreign',
  'createdAt',
  'updatedAt'
])

function normalizeExtras(value: unknown): ExtraPayment[] {
  if (!Array.isArray(value)) return []
  const out: ExtraPayment[] = []
  for (const x of value) {
    if (!x || typeof x !== 'object') continue
    const r = x as Record<string, unknown>
    const month = typeof r.month === 'number' ? Math.floor(r.month) : NaN
    const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) ? Math.round(Math.abs(r.amount) * 100) / 100 : 0
    if (!(month >= 1 && month <= 12) || amount <= 0) continue
    out.push({ id: str(r.id) || newId('x'), month, amount, label: str(r.label) })
  }
  return out.sort((a, b) => a.month - b.month)
}

const MAX_UNITS = 1000

export function normalizeVariable(value: unknown): VariablePay | null {
  if (!value || typeof value !== 'object') return null
  const r = value as Record<string, unknown>
  const rate = typeof r.rate === 'number' && Number.isFinite(r.rate) ? Math.round(Math.abs(r.rate) * 100) / 100 : 0
  if (rate <= 0) return null
  const count = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(MAX_UNITS, Math.round(v * 100) / 100) : fallback
  const months = new Map<string, number>()
  if (Array.isArray(r.months)) {
    for (const m of r.months) {
      if (!m || typeof m !== 'object') continue
      const o = m as Record<string, unknown>
      if (typeof o.month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(o.month)) continue
      if (typeof o.count !== 'number' || !Number.isFinite(o.count) || o.count < 0) continue
      months.set(o.month, count(o.count, 0))
    }
  }
  return {
    rate,
    unit: str(r.unit).trim() || 'Woche',
    usual: count(r.usual, 1),
    months: [...months].map(([month, c]) => ({ month, count: c })).sort((a, b) => (a.month < b.month ? -1 : 1))
  }
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

const INTERVALS = new Set<Interval>(['weekly', 'monthly', 'quarterly', 'halfyearly', 'yearly', 'once'])

/**
 * Validates data coming from disk or an import. Unknown or broken fields are
 * repaired instead of rejecting the whole file, so a single bad entry never
 * makes the rest of the data unreachable.
 */
export function normalizeData(input: unknown): AppData {
  if (!input || typeof input !== 'object') throw new Error('Die Datei enthält keine gültigen Moo-Daten.')
  const obj = migrate(input).data as Record<string, unknown>
  if (!Array.isArray(obj.entries) || !Array.isArray(obj.categories)) {
    throw new Error('Die Datei enthält keine gültigen Moo-Daten.')
  }

  const categories: Category[] = []
  const seen = new Set<string>()
  for (const c of obj.categories as unknown[]) {
    if (!c || typeof c !== 'object') continue
    const r = c as Record<string, unknown>
    const id = str(r.id)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const kind: EntryKind = r.kind === 'income' ? 'income' : 'expense'
    const color = typeof r.color === 'number' && r.color >= 0 && r.color <= NEUTRAL_SLOT ? Math.floor(r.color) : 0
    categories.push({ id, name: str(r.name, 'Ohne Namen') || 'Ohne Namen', kind, color })
  }
  for (const kind of ['expense', 'income'] as EntryKind[]) {
    if (!categories.some((c) => c.kind === kind)) {
      const fallback = defaultCategories().find((c) => c.kind === kind)!
      categories.push(fallback)
      seen.add(fallback.id)
    }
  }

  const entries: Entry[] = []
  for (const e of obj.entries as unknown[]) {
    if (!e || typeof e !== 'object') continue
    const r = e as Record<string, unknown>
    const kind: EntryKind = r.kind === 'income' ? 'income' : 'expense'
    let categoryId = str(r.categoryId)
    if (!seen.has(categoryId) || categories.find((c) => c.id === categoryId)?.kind !== kind) {
      categoryId = categories.find((c) => c.kind === kind)!.id
    }
    const startDate = isValidIso(str(r.startDate)) ? str(r.startDate) : toIso(new Date().getFullYear(), 1, 1)
    const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) ? Math.abs(r.amount) : 0
    const now = new Date().toISOString()
    // Fields this version does not know are kept as they are.
    const unknownFields = Object.fromEntries(Object.entries(r).filter(([k]) => !ENTRY_FIELDS.has(k)))
    const variable = normalizeVariable(r.variable)
    entries.push({
      ...unknownFields,
      id: str(r.id) || newId(),
      kind,
      name: str(r.name, 'Ohne Namen') || 'Ohne Namen',
      categoryId,
      amount: variable ? Math.round(variable.rate * variable.usual * 100) / 100 : Math.round(amount * 100) / 100,
      interval: variable ? 'monthly' : INTERVALS.has(r.interval as Interval) ? (r.interval as Interval) : 'monthly',
      startDate,
      endDate: isValidIso(str(r.endDate)) && str(r.endDate) >= startDate ? str(r.endDate) : null,
      estimated: r.estimated === true,
      paused: r.paused === true,
      provider: str(r.provider),
      paymentMethod: str(r.paymentMethod),
      noticePeriod: str(r.noticePeriod),
      contractEnd: isValidIso(str(r.contractEnd)) ? str(r.contractEnd) : null,
      notes: str(r.notes),
      extraPayments: variable ? [] : normalizeExtras(r.extraPayments),
      variable,
      foreign: variable ? null : normalizeForeign(r.foreign),
      createdAt: str(r.createdAt, now) || now,
      updatedAt: str(r.updatedAt, now) || now
    })
  }

  const s = (obj.settings ?? {}) as Record<string, unknown>
  const settings: Settings = {
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
    monthlyBudget: typeof s.monthlyBudget === 'number' && s.monthlyBudget > 0 ? s.monthlyBudget : 0
  }

  return { schemaVersion: CURRENT_SCHEMA, categories, entries, assets: normalizeAssets(obj.assets), settings }
}
