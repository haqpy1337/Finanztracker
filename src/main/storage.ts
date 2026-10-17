import { app } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import log from 'electron-log/main'
import { normalizeData } from '@shared/defaults'
import { CURRENT_SCHEMA, NewerSchemaError, schemaOf } from '@shared/schema'
import type { AppData } from '@shared/types'

/**
 * Data safety rules:
 * - The data lives in %APPDATA%\Finanztracker\daten, which installs, updates
 *   and uninstalls never touch.
 * - Every write goes to a temp file that is flushed to disk and then renamed
 *   over the data file, so a crash mid-write never leaves a half-written file.
 *   The previous state is kept as finanztracker.json.bak.
 * - Before an older data format is upgraded and whenever the app version
 *   changes, a copy of the untouched file is stored in daten\sicherungen.
 *   Those copies are never deleted automatically.
 * - Data written by a newer app version is never overwritten.
 */

const KEEP_DAILY_BACKUPS = 30
const DAILY_PREFIX = 'taeglich-'

export function dataDir(): string {
  return join(app.getPath('userData'), 'daten')
}

function dataFile(): string {
  return join(dataDir(), 'finanztracker.json')
}

function backupDir(): string {
  return join(dataDir(), 'sicherungen')
}

function stateFile(): string {
  return join(dataDir(), 'app-status.json')
}

function stamp(): string {
  return new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, '')
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

/** Writes a file atomically: temp file, flush to disk, rename. */
async function writeAtomic(path: string, content: string): Promise<void> {
  const tmp = `${path}.tmp`
  const handle = await fs.open(tmp, 'w')
  try {
    await handle.writeFile(content, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await fs.rename(tmp, path)
}

async function copyToBackups(name: string): Promise<string | null> {
  const file = dataFile()
  if (!(await exists(file))) return null
  await fs.mkdir(backupDir(), { recursive: true })
  const target = join(backupDir(), name)
  if (!(await exists(target))) await fs.copyFile(file, target)
  return target
}

/** All backups, newest first by modification time. */
async function backupsNewestFirst(): Promise<string[]> {
  try {
    const names = (await fs.readdir(backupDir())).filter((f) => f.endsWith('.json'))
    const withTime = await Promise.all(
      names.map(async (n) => {
        const path = join(backupDir(), n)
        return { path, time: (await fs.stat(path)).mtimeMs }
      })
    )
    return withTime.sort((a, b) => b.time - a.time).map((x) => x.path)
  } catch {
    return []
  }
}

/** Set once the data was loaded successfully; until then nothing is written. */
let writable = false
let blockedReason: string | null = null

function parseAndUpgrade(text: string): { data: AppData; from: number } {
  const raw: unknown = JSON.parse(text)
  const from = schemaOf(raw)
  if (from > CURRENT_SCHEMA) throw new NewerSchemaError(from)
  return { data: normalizeData(raw), from }
}

/**
 * Loads the data file, upgrading older formats after backing them up. Falls
 * back to the newest readable backup if the file is damaged.
 */
export async function loadData(): Promise<AppData | null> {
  const file = dataFile()
  writable = false
  if (!(await exists(file))) {
    writable = true
    return null
  }

  let parsed: { data: AppData; from: number } | null = null
  try {
    parsed = parseAndUpgrade(await fs.readFile(file, 'utf8'))
  } catch (err) {
    if (err instanceof NewerSchemaError) {
      blockedReason = err.message
      throw err
    }
    log.error('Data file unreadable, trying backups', err)
  }

  if (parsed) {
    writable = true
    if (parsed.from < CURRENT_SCHEMA) {
      const backup = await copyToBackups(`vor-umstellung-datenformat-${parsed.from}-auf-${CURRENT_SCHEMA}_${stamp()}.json`)
      log.info(`Upgrading data format ${parsed.from} -> ${CURRENT_SCHEMA}, original kept at ${backup}`)
      await saveData(parsed.data)
    }
    return parsed.data
  }

  // The data file is damaged: keep it for inspection and use the newest readable backup.
  await fs.copyFile(file, join(dataDir(), `finanztracker.defekt_${stamp()}.json`)).catch(() => undefined)
  const candidates = [`${file}.bak`, ...(await backupsNewestFirst())]
  for (const candidate of candidates) {
    try {
      if (!(await exists(candidate))) continue
      const { data } = parseAndUpgrade(await fs.readFile(candidate, 'utf8'))
      log.warn(`Restored data from ${candidate}`)
      writable = true
      await saveData(data)
      return data
    } catch {
      // try the next older backup
    }
  }
  blockedReason = 'Die Datendatei ist beschädigt und es wurde keine lesbare Sicherung gefunden.'
  throw new Error(blockedReason)
}

let writeQueue: Promise<void> = Promise.resolve()

/** Validates and writes the data. Concurrent saves are serialised. */
export function saveData(data: AppData): Promise<void> {
  if (!writable) {
    return Promise.reject(new Error(blockedReason ?? 'Die Daten wurden noch nicht geladen und werden nicht gespeichert.'))
  }
  const normalized = normalizeData(data)
  const content = JSON.stringify(normalized, null, 2)
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      await fs.mkdir(dataDir(), { recursive: true })
      const file = dataFile()
      if (await exists(file)) await fs.copyFile(file, `${file}.bak`)
      await writeAtomic(file, content)
    })
  return writeQueue
}

/** Permanent copy of the current data file, e.g. before an import replaces everything. */
export async function createBackup(reason: string): Promise<string | null> {
  await waitForWrites()
  const safe = reason.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  return copyToBackups(`vor-${safe}_${stamp()}.json`)
}

/** Resolves once every pending write has reached the disk. */
export function waitForWrites(): Promise<void> {
  return writeQueue.catch(() => undefined)
}

/**
 * Runs at start-up before the data is loaded: keeps one backup per day (30
 * days) and an extra, permanent backup whenever the app version changed.
 */
export async function backupOnStart(): Promise<void> {
  const version = app.getVersion()
  let lastVersion: string | null = null
  try {
    lastVersion = (JSON.parse(await fs.readFile(stateFile(), 'utf8')) as { lastVersion?: string }).lastVersion ?? null
  } catch {
    // first start of a version that writes this file
  }

  if (lastVersion !== version) {
    const from = lastVersion ?? 'alt'
    const backup = await copyToBackups(`vor-update-${from}-auf-${version}_${stamp()}.json`)
    if (backup) log.info(`Version changed ${from} -> ${version}, data backed up to ${backup}`)
  }

  await copyToBackups(`${DAILY_PREFIX}${new Date().toISOString().slice(0, 10)}.json`)

  try {
    const daily = (await fs.readdir(backupDir())).filter((f) => f.startsWith(DAILY_PREFIX)).sort().reverse()
    for (const old of daily.slice(KEEP_DAILY_BACKUPS)) await fs.unlink(join(backupDir(), old)).catch(() => undefined)
  } catch {
    // no backups yet
  }

  if (lastVersion !== version) {
    await fs.mkdir(dataDir(), { recursive: true })
    await writeAtomic(stateFile(), JSON.stringify({ lastVersion: version }, null, 2))
  }
}
