import { app, BrowserWindow, session } from 'electron'
import log from 'electron-log/main'
import { cleanCertNumber, parsePsaPage, PSA_READ_SCRIPT, psaCertUrl, type PsaCert, type PsaLookup } from '@shared/psa'
import { getUsdRate } from './fx'

/**
 * PSA's public API has no value field, so the certificate page is opened in a
 * hidden window (like a normal browser visit) and read. If that does not work
 * within a few seconds, e.g. because PSA first shows a browser check, the window
 * is shown so the page can finish loading in front of the user; it closes again
 * as soon as the values are read. Cookies are kept, so the next lookup usually
 * succeeds hidden. Lookups run one after another, only when the user asks.
 */
const SHOW_AFTER_MS = 10000
const TIMEOUT_MS = 30000
/** Once the window is shown (browser check), the user gets this long. */
const VISIBLE_TIMEOUT_MS = 180000
/** Some cards have no estimate; once the grade is there, wait this long for it before giving up on it. */
const ESTIMATE_GRACE_MS = 6000

let queue: Promise<unknown> = Promise.resolve()

interface Page {
  title: string
  heading: string
  lines: string[]
}

/**
 * A plain Chrome user agent for the whole session, so the page, the Cloudflare
 * check frame and its workers all report the same browser. A user agent set only
 * on the window differs from the one inside the check frame, which makes the
 * check fail over and over.
 */
function psaSession(): Electron.Session {
  const s = session.fromPartition('persist:psa')
  s.setUserAgent(app.userAgentFallback.replace(/ (Electron|Finanztracker|Moo)\/\S+/gi, ''), 'de-DE,de;q=0.9,en;q=0.8')
  return s
}

async function readCert(cert: string, parent: BrowserWindow | null): Promise<PsaCert> {
  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 820,
    title: `PSA-Zertifikat ${cert} wird gelesen …`,
    parent: parent ?? undefined,
    autoHideMenuBar: true,
    webPreferences: {
      session: psaSession(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })
  win.webContents.setAudioMuted(true)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.on('page-title-updated', (e) => e.preventDefault())
  let last: Page | null = null
  try {
    void win.loadURL(psaCertUrl(cert)).catch(() => undefined)
    const start = Date.now()
    let gradeSince: number | null = null
    let shownAt: number | null = null
    while (shownAt === null ? Date.now() - start < TIMEOUT_MS : Date.now() - shownAt < VISIBLE_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 500))
      if (win.isDestroyed()) throw new Error('Das PSA-Fenster wurde geschlossen, bevor die Werte gelesen waren.')
      const page = (await win.webContents.executeJavaScript(PSA_READ_SCRIPT).catch(() => null)) as Page | null
      if (page) {
        last = page
        const parsed = parsePsaPage(cert, page.heading, page.lines)
        if (parsed) {
          if (parsed.estimateUsd !== null) return parsed
          gradeSince ??= Date.now()
          if (Date.now() - gradeSince > ESTIMATE_GRACE_MS) return parsed
        } else if (/no (results|data) found|invalid cert/i.test(page.lines.join(' '))) {
          throw new Error(`PSA kennt die Zertifikatsnummer ${cert} nicht.`)
        }
      }
      // Still nothing usable: let the page load visibly (a browser check may need it).
      if (!win.isVisible() && gradeSince === null && Date.now() - start > SHOW_AFTER_MS) {
        log.info(`PSA page not readable hidden yet (title: ${last?.title ?? '–'}), showing window`)
        win.show()
        shownAt = Date.now()
      }
    }
    throw new Error('Die PSA-Seite konnte nicht gelesen werden.')
  } catch (err) {
    log.warn(`PSA page ${cert}: title "${last?.title ?? ''}", text: ${(last?.lines ?? []).join(' | ').slice(0, 1500)}`)
    throw err
  } finally {
    if (!win.isDestroyed()) win.destroy()
  }
}

export function lookupPsaCert(input: string, parent: BrowserWindow | null): Promise<PsaLookup> {
  const cert = cleanCertNumber(String(input ?? ''))
  if (!cert) return Promise.resolve({ ok: false, error: 'Bitte eine gültige PSA-Zertifikatsnummer eingeben (7 bis 10 Ziffern).' })
  const lookup = queue.then(async (): Promise<PsaLookup> => {
    try {
      const data = await readCert(cert, parent)
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
