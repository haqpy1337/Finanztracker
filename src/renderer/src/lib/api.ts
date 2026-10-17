import type { AppData, FinanceApi, UpdateStatus } from '@shared/types'

declare global {
  interface Window {
    finance?: FinanceApi
  }
}

const STORAGE_KEY = 'finanztracker-preview'

/**
 * Stand-in used when the UI runs in a plain browser (development preview,
 * screenshots). The desktop app always uses the preload bridge.
 */
const browserApi: FinanceApi = {
  async loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as AppData) : null
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
  }
}

export const api: FinanceApi = window.finance ?? browserApi
