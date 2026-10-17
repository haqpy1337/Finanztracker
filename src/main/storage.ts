import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import log from 'electron-log/main'
import { normalizeData } from '@shared/defaults'
import type { AppData } from '@shared/types'

const KEEP_BACKUPS = 30

export function dataDir(): string {
  return join(app.getPath('userData'), 'daten')
}

function dataFile(): string {
  return join(dataDir(), 'finanztracker.json')
}

function backupDir(): string {
  return join(dataDir(), 'sicherungen')
}

async function readJson(path: string): Promise<AppData> {
  return normalizeData(JSON.parse(await fs.readFile(path, 'utf8')))
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function newestBackups(): Promise<string[]> {
  try {
    const files = await fs.readdir(backupDir())
    return files
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .map((f) => join(backupDir(), f))
  } catch {
    return []
  }
}

/** Loads the data file. Falls back to the newest readable backup if the file is damaged. */
export async function loadData(): Promise<AppData | null> {
  const file = dataFile()
  if (!(await exists(file))) return null
  try {
    return await readJson(file)
  } catch (err) {
    log.error('Data file unreadable, trying backups', err)
    await fs.copyFile(file, `${file}.defekt-${Date.now()}`).catch(() => undefined)
    for (const backup of await newestBackups()) {
      try {
        const data = await readJson(backup)
        log.warn(`Restored data from ${backup}`)
        return data
      } catch {
        // try the next older backup
      }
    }
    throw new Error('Die Datendatei ist beschädigt und es wurde keine lesbare Sicherung gefunden.')
  }
}

let writeQueue: Promise<void> = Promise.resolve()

/** Writes atomically (temp file + rename) and serialises concurrent saves. */
export function saveData(data: AppData): Promise<void> {
  const normalized = normalizeData(data)
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      await fs.mkdir(dataDir(), { recursive: true })
      const file = dataFile()
      const tmp = `${file}.tmp`
      await fs.writeFile(tmp, JSON.stringify(normalized, null, 2), 'utf8')
      await fs.rename(tmp, file)
    })
  return writeQueue
}

/** Keeps one backup per day of the data as it was when the app started. */
export async function backupOnStart(): Promise<void> {
  const file = dataFile()
  if (!(await exists(file))) return
  await fs.mkdir(backupDir(), { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  const target = join(backupDir(), `finanztracker-${stamp}.json`)
  if (!(await exists(target))) await fs.copyFile(file, target)
  const backups = await newestBackups()
  for (const old of backups.slice(KEEP_BACKUPS)) await fs.unlink(old).catch(() => undefined)
}
