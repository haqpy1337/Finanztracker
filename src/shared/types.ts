export type EntryKind = 'expense' | 'income'

export type Interval = 'weekly' | 'monthly' | 'quarterly' | 'halfyearly' | 'yearly' | 'once'

export type ThemePreference = 'system' | 'light' | 'dark'

export interface Category {
  id: string
  name: string
  kind: EntryKind
  /** Index into the categorical chart palette (0-7), or 8 for neutral grey. */
  color: number
}

/** An additional payment in a fixed calendar month, e.g. a 13th salary in November. */
export interface ExtraPayment {
  id: string
  /** Calendar month 1-12. */
  month: number
  amount: number
  label: string
}

export interface Entry {
  id: string
  kind: EntryKind
  name: string
  categoryId: string
  /** Amount per occurrence, always positive. */
  amount: number
  interval: Interval
  /** First due date (YYYY-MM-DD). Later occurrences are derived from it. */
  startDate: string
  /** Last day the entry is active (YYYY-MM-DD), inclusive. */
  endDate: string | null
  /** Amount is a rough estimate (e.g. groceries), not a fixed contract value. */
  estimated: boolean
  paused: boolean
  provider: string
  paymentMethod: string
  /** Free text such as "1 Monat zum Laufzeitende". */
  noticePeriod: string
  /** Minimum term / next possible cancellation date (YYYY-MM-DD). */
  contractEnd: string | null
  notes: string
  /** Paid once a year in the given months on top of the regular amount. */
  extraPayments: ExtraPayment[]
  /** Income that varies per month (e.g. on-call duty): rate x number of units. null for fixed amounts. */
  variable: VariablePay | null
  createdAt: string
  updatedAt: string
}

export interface VariablePay {
  /** Amount per unit, e.g. 500 per week of on-call duty. */
  rate: number
  /** Name of the unit, e.g. "Woche". */
  unit: string
  /** Usual number of units per month. */
  usual: number
  /** Months that differ from the usual count (YYYY-MM). */
  months: Array<{ month: string; count: number }>
}

export type AssetType = 'etf' | 'stock' | 'fund' | 'crypto' | 'metal' | 'cash' | 'collectible' | 'other'

/** A recorded value of an asset at a given day. */
export interface AssetValuation {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** Total value of the holding on that day. */
  value: number
  /** Total amount paid in up to that day, e.g. with a savings plan. null keeps the previous amount. */
  invested: number | null
  note: string
}

/** An investment or valuable item, tracked separately from income and expenses. */
export interface Asset {
  id: string
  type: AssetType
  name: string
  /** Broker, platform or shop, e.g. "Trade Republic". */
  provider: string
  /** ISIN, WKN, ticker or similar. */
  identifier: string
  /** Number of shares or pieces; null if not tracked. */
  quantity: number | null
  /** YYYY-MM-DD */
  purchaseDate: string
  /** Purchase price including fees. */
  purchaseValue: number
  /** Value updates, oldest first. */
  valuations: AssetValuation[]
  /** For items: what exactly it is, e.g. "Glurak, Base Set, 1. Edition". */
  description: string
  /** For items: grading or condition, e.g. "PSA 10". */
  grading: string
  /** For items: certificate or serial number. */
  certificate: string
  notes: string
  /** Set once the asset was sold; the gain is frozen from then on. */
  sale: { date: string; value: number } | null
  createdAt: string
  updatedAt: string
}

export interface Settings {
  theme: ThemePreference
  /** Optional monthly spending limit; 0 disables it. */
  monthlyBudget: number
}

export interface AppData {
  schemaVersion: 4
  categories: Category[]
  entries: Entry[]
  /** Investments and valuables, separate from income and expenses. */
  assets: Asset[]
  settings: Settings
}

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'disabled'; reason: string }
  | { state: 'checking' }
  | { state: 'none'; version: string }
  | { state: 'available'; version: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string; detail?: string }

export interface FinanceApi {
  loadData(): Promise<AppData | null>
  saveData(data: AppData): Promise<void>
  exportJson(data: AppData): Promise<string | null>
  /** `name` is the start of the suggested file name, e.g. "Finanztracker-Anlagen". */
  exportCsv(csv: string, name?: string): Promise<string | null>
  importJson(): Promise<AppData | null>
  /** Stores a permanent copy of the current data, e.g. before replacing it. */
  backupNow(reason: string): Promise<string | null>
  openDataFolder(): Promise<void>
  openLog(): Promise<void>
  setTheme(theme: ThemePreference): Promise<void>
  getVersion(): Promise<string>
  checkForUpdates(): Promise<void>
  installUpdate(): Promise<void>
  onUpdateStatus(listener: (status: UpdateStatus) => void): () => void
  /** Registers the function that saves pending changes before the app closes. */
  onFlushRequest(flush: () => Promise<void>): () => void
}
