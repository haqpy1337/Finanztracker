import { net } from 'electron'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import log from 'electron-log/main'
import { parseUsdRate, USD_RATE_URLS, validUsdRate, type UsdQuote, type UsdRate } from '@shared/fx'
import { dataDir } from './storage'

/** Fresh rates are reused for a few minutes so opening several dialogs does not refetch. */
const REUSE_MS = 10 * 60 * 1000
const TIMEOUT_MS = 6000

let recent: { rate: UsdRate; at: number } | null = null

/** The last rate fetched successfully, kept next to the data (not inside it) for offline use. */
function cacheFile(): string {
  return join(dataDir(), 'wechselkurs-usd.json')
}

async function readCache(): Promise<UsdRate | null> {
  try {
    return validUsdRate(JSON.parse(await fs.readFile(cacheFile(), 'utf8')))
  } catch {
    return null
  }
}

async function writeCache(rate: UsdRate): Promise<void> {
  try {
    await fs.mkdir(dataDir(), { recursive: true })
    await fs.writeFile(cacheFile(), JSON.stringify(rate, null, 2), 'utf8')
  } catch (err) {
    log.warn('Could not store exchange rate', err)
  }
}

async function fetchRate(): Promise<UsdRate> {
  let lastError: unknown = null
  for (const url of USD_RATE_URLS) {
    try {
      const res = await net.fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const rate = parseUsdRate(await res.json(), new Date().toISOString())
      if (!rate) throw new Error('Unerwartete Antwort der Kursquelle')
      return rate
    } catch (err) {
      lastError = err
      log.warn(`Exchange rate from ${url} failed`, err)
    }
  }
  throw lastError ?? new Error('Keine Kursquelle erreichbar')
}

export async function getUsdRate(refresh = false): Promise<UsdQuote> {
  if (!refresh && recent && Date.now() - recent.at < REUSE_MS) return { status: 'live', rate: recent.rate }
  try {
    const rate = await fetchRate()
    recent = { rate, at: Date.now() }
    await writeCache(rate)
    return { status: 'live', rate }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    const cached = recent?.rate ?? (await readCache())
    return cached ? { status: 'cached', rate: cached, error } : { status: 'unavailable', error }
  }
}
