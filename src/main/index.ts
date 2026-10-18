import { app, BrowserWindow, dialog, ipcMain, Menu, nativeTheme, shell } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import log from 'electron-log/main'
import { normalizeData } from '@shared/defaults'
import type { AppData, ThemePreference } from '@shared/types'
import { backupOnStart, createBackup, dataDir, loadData, saveData, waitForWrites } from './storage'
import { getUsdRate } from './fx'
import { lookupPsaCert } from './psa'
import { checkForUpdates, initUpdater, installUpdate, lastUpdateStatus } from './updater'

log.initialize()
app.setAppUserModelId('com.haqpy1337.finanztracker')
// German locale for date pickers and number input regardless of the Windows display language.
app.commandLine.appendSwitch('lang', 'de-DE')

let mainWindow: BrowserWindow | null = null
let closing = false

/** Asks the window to save pending changes and waits until they are on disk. */
async function flushPendingChanges(timeoutMs = 4000): Promise<void> {
  const win = mainWindow
  if (win && !win.isDestroyed()) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, timeoutMs)
      ipcMain.once('app:flushed', () => {
        clearTimeout(timer)
        resolve()
      })
      win.webContents.send('app:flush')
    })
  }
  await waitForWrites()
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'Moo',
    // Matches the start-up screen, which is dark grey in both themes.
    backgroundColor: '#121211',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // Never close before the last changes are saved.
  mainWindow.on('close', (event) => {
    if (closing) return
    event.preventDefault()
    closing = true
    void flushPendingChanges().finally(() => {
      mainWindow?.destroy()
      app.quit()
    })
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (mainWindow) initUpdater(mainWindow)
  })

  // Links never open inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow?.webContents.getURL()) event.preventDefault()
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('data:load', () => loadData())
  ipcMain.handle('data:save', (_e, data: AppData) => saveData(data))

  ipcMain.handle('data:export-json', async (_e, data: AppData) => {
    const stamp = new Date().toISOString().slice(0, 10)
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Daten exportieren',
      defaultPath: `Moo-Export-${stamp}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return null
    await fs.writeFile(result.filePath, JSON.stringify(normalizeData(data), null, 2), 'utf8')
    return result.filePath
  })

  ipcMain.handle('data:export-csv', async (_e, csv: string, name?: string) => {
    const stamp = new Date().toISOString().slice(0, 10)
    const prefix = typeof name === 'string' && /^[\w-]{1,60}$/.test(name) ? name : 'Moo-Posten'
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Als CSV exportieren',
      defaultPath: `${prefix}-${stamp}.csv`,
      filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }]
    })
    if (result.canceled || !result.filePath) return null
    // BOM so Excel opens umlauts correctly.
    await fs.writeFile(result.filePath, `﻿${csv}`, 'utf8')
    return result.filePath
  })

  ipcMain.handle('data:import-json', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Daten importieren',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const raw = await fs.readFile(result.filePaths[0], 'utf8')
    const imported = normalizeData(JSON.parse(raw))
    await createBackup('import')
    return imported
  })

  ipcMain.handle('data:backup', (_e, reason: string) => createBackup(reason))

  ipcMain.handle('app:open-data-folder', async () => {
    await fs.mkdir(dataDir(), { recursive: true })
    await shell.openPath(dataDir())
  })
  ipcMain.handle('app:open-log', async () => {
    await shell.openPath(log.transports.file.getFile().path)
  })
  ipcMain.handle('app:set-theme', (_e, theme: ThemePreference) => {
    nativeTheme.themeSource = theme
  })
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:install', async () => {
    await flushPendingChanges()
    closing = true
    installUpdate()
  })
  ipcMain.handle('update:last', () => lastUpdateStatus())
  ipcMain.handle('fx:usd', (_e, refresh?: boolean) => getUsdRate(refresh === true))
  ipcMain.handle('psa:cert', (_e, cert: string) => lookupPsaCert(cert, mainWindow))
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null)
    await backupOnStart().catch((err) => log.error('Backup failed', err))
    registerIpc()
    createWindow()
  })

  app.on('window-all-closed', () => app.quit())
}
