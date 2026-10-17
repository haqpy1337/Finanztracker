import { app, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log/main'
import type { UpdateStatus } from '@shared/types'

let window: BrowserWindow | null = null
let last: UpdateStatus = { state: 'idle' }

function send(status: UpdateStatus): void {
  last = status
  window?.webContents.send('update:status', status)
}

export function lastUpdateStatus(): UpdateStatus {
  return last
}

export function initUpdater(win: BrowserWindow): void {
  window = win
  if (!app.isPackaged) {
    send({ state: 'disabled', reason: 'Updates sind nur in der installierten Version aktiv.' })
    return
  }

  autoUpdater.logger = log
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-not-available', () => send({ state: 'none', version: app.getVersion() }))
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info.version }))
  autoUpdater.on('download-progress', (p) => {
    const version = last.state === 'available' || last.state === 'downloading' ? last.version : ''
    send({ state: 'downloading', version, percent: Math.round(p.percent) })
  })
  autoUpdater.on('update-downloaded', (info) => send({ state: 'ready', version: info.version }))
  autoUpdater.on('error', (err) => {
    log.error('Update failed', err)
    send({ state: 'error', message: 'Die Update-Prüfung ist fehlgeschlagen. Bitte Internetverbindung prüfen.' })
  })

  void checkForUpdates()
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) return
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    log.error('checkForUpdates failed', err)
  }
}

export function installUpdate(): void {
  if (last.state === 'ready') autoUpdater.quitAndInstall(false, true)
}
