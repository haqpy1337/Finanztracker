import type { FinanceApi, UpdateStatus } from '@shared/types'
import { normalizeData } from '@shared/defaults'
import { parseUsdRate, USD_RATE_URLS, validUsdRate, type UsdQuote } from '@shared/fx'

declare global {
  interface Window {
    finance?: FinanceApi
  }
}

const STORAGE_KEY = 'finanztracker-preview'
const RATE_KEY = 'finanztracker-preview-usd'

async function previewUsdRate(): Promise<UsdQuote> {
  let error = 'Keine Kursquelle erreichbar'
  for (const url of USD_RATE_URLS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
      const rate = res.ok ? parseUsdRate(await res.json(), new Date().toISOString()) : null
      if (rate) {
        try {
          localStorage.setItem(RATE_KEY, JSON.stringify(rate))
        } catch {
          // preview only
        }
        return { status: 'live', rate }
      }
      error = res.ok ? 'Unerwartete Antwort der Kursquelle' : `HTTP ${res.status}`
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
  }
  let cached = null
  try {
    cached = validUsdRate(JSON.parse(localStorage.getItem(RATE_KEY) ?? 'null'))
  } catch {
    // nothing cached
  }
  return cached ? { status: 'cached', rate: cached, error } : { status: 'unavailable', error }
}

/**
 * Stand-in used when the UI runs in a plain browser (development preview,
 * screenshots). The desktop app always uses the preload bridge.
 */
const browserApi: FinanceApi = {
  async loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? normalizeData(JSON.parse(raw)) : null
    } catch {
      return null
    }
  },
  async saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // preview only
    }
  },
  async exportJson() {
    return null
  },
  async exportCsv() {
    return null
  },
  async importJson() {
    return null
  },
  async backupNow() {
    return null
  },
  async openDataFolder() {},
  async openLog() {},
  async setTheme() {},
  async getVersion() {
    return 'Vorschau'
  },
  async checkForUpdates() {},
  async installUpdate() {},
  onUpdateStatus(listener: (status: UpdateStatus) => void) {
    listener({ state: 'disabled', reason: 'Updates sind nur in der installierten Version aktiv.' })
    return () => undefined
  },
  onFlushRequest() {
    return () => undefined
  },
  getUsdRate: () => previewUsdRate(),
  async lookupPsaCert() {
    return { ok: false, error: 'Die PSA-Abfrage funktioniert nur in der installierten App.' }
  }
}

export const api: FinanceApi = window.finance ?? browserApi
