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
  createdAt: string
  updatedAt: string
}

export interface Settings {
  theme: ThemePreference
  /** Optional monthly spending limit; 0 disables it. */
  monthlyBudget: number
}

export interface AppData {
  schemaVersion: 1
  categories: Category[]
  entries: Entry[]
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
  | { state: 'error'; message: string }

export interface FinanceApi {
  loadData(): Promise<AppData | null>
  saveData(data: AppData): Promise<void>
  exportJson(data: AppData): Promise<string | null>
  exportCsv(csv: string): Promise<string | null>
  importJson(): Promise<AppData | null>
  openDataFolder(): Promise<void>
  setTheme(theme: ThemePreference): Promise<void>
  getVersion(): Promise<string>
  checkForUpdates(): Promise<void>
  installUpdate(): Promise<void>
  onUpdateStatus(listener: (status: UpdateStatus) => void): () => void
}
