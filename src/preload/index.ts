import { contextBridge, ipcRenderer } from 'electron'
import type { AppData, FinanceApi, ThemePreference, UpdateStatus } from '@shared/types'

const api: FinanceApi = {
  loadData: () => ipcRenderer.invoke('data:load'),
  saveData: (data: AppData) => ipcRenderer.invoke('data:save', data),
  exportJson: (data: AppData) => ipcRenderer.invoke('data:export-json', data),
  exportCsv: (csv: string) => ipcRenderer.invoke('data:export-csv', csv),
  importJson: () => ipcRenderer.invoke('data:import-json'),
  openDataFolder: () => ipcRenderer.invoke('app:open-data-folder'),
  setTheme: (theme: ThemePreference) => ipcRenderer.invoke('app:set-theme', theme),
  getVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateStatus: (listener: (status: UpdateStatus) => void) => {
    const handler = (_e: unknown, status: UpdateStatus): void => listener(status)
    ipcRenderer.on('update:status', handler)
    void ipcRenderer.invoke('update:last').then(listener)
    return () => ipcRenderer.removeListener('update:status', handler)
  }
}

contextBridge.exposeInMainWorld('finance', api)
