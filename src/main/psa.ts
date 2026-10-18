import { BrowserWindow, session } from 'electron'
import log from 'electron-log/main'
import { cleanCertNumber, parsePsaPage, psaCertUrl, type PsaCert, type PsaLookup } from '@shared/psa'
import { getUsdRate } from './fx'

/**
 * PSA's public API has no value field, so the certificate page is opened in a
 * hidden window (like a normal browser visit) and its visible text is read.
 * Lookups run one after another, only when the user asks for one.
 */
const TIMEOUT_MS = 25000
/** Some cards have no estimate; once the grade is there, wait this long for it before giving up on it. */
const ESTIMATE_GRACE_MS = 6000

let queue: Promise<unknown> = Promise.resolve()

const READ_PAGE = `({
  title: document.title,
  heading: (document.querySelector('h1') || {}).innerText || '',
  lines: (document.body ? document.body.innerText : '').split('\\n')
})`

async function readCert(cert: string): Promise<PsaCert> {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: { session: session.fromPartition('psa'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  win.webContents.setAudioMuted(true)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  // A plain Chrome user agent, as the page would see from a normal browser.
  win.webContents.setUserAgent(win.webContents.getUserAgent().replace(/ (Electron|Finanztracker|Moo)\/\S+/gi, ''))
  try {
    void win.loadURL(psaCertUrl(cert)).catch(() => undefined)
    const start = Date.now()
    let gradeSince: number | null = null
    while (Date.now() - start < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 500))
      if (win.isDestroyed()) break
      const page = (await win.webContents.executeJavaScript(READ_PAGE).catch(() => null)) as {
        title: string
        heading: string
        lines: string[]
      } | null
      if (!page) continue
      const parsed = parsePsaPage(cert, page.heading, page.lines)
      if (!parsed) {
        if (/no (results|data) found|invalid cert/i.test(page.lines.join(' '))) throw new Error(`PSA kennt die Zertifikatsnummer ${cert} nicht.`)
        continue
      }
      if (parsed.estimateUsd !== null) return parsed
      gradeSince ??= Date.now()
      if (Date.now() - gradeSince > ESTIMATE_GRACE_MS) return parsed
    }
    throw new Error('Die PSA-Seite hat nicht rechtzeitig geantwortet oder sieht anders aus als erwartet.')
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

export function lookupPsaCert(input: string): Promise<PsaLookup> {
  const cert = cleanCertNumber(String(input ?? ''))
  if (!cert) return Promise.resolve({ ok: false, error: 'Bitte eine gültige PSA-Zertifikatsnummer eingeben (7 bis 10 Ziffern).' })
  const lookup = queue.then(async (): Promise<PsaLookup> => {
    try {
      const data = await readCert(cert)
      const rate = data.estimateUsd !== null ? await getUsdRate() : null
      return { ok: true, cert: data, rate }
    } catch (err) {
      log.warn(`PSA lookup ${cert} failed`, err)
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
  queue = lookup
  return lookup
}
