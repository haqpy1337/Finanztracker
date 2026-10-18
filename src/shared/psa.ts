import type { UsdQuote } from './fx'

/** What the public PSA certificate page shows for a graded card. */
export interface PsaCert {
  cert: string
  url: string
  /** e.g. "2014 POKEMON JAPANESE XY PHANTOM GATE #033 GENGAR EX PHANTOM GATE-1ST ED." */
  title: string
  /** As shown by PSA, e.g. "MINT 9". */
  grade: string
  /** Short form for the grading field, e.g. "PSA 9". */
  grading: string
  population: number | null
  popHigher: number | null
  /** "PSA Estimate" in US dollars; null if PSA shows none for this card. */
  estimateUsd: number | null
}

export type PsaLookup = { ok: true; cert: PsaCert; rate: UsdQuote | null } | { ok: false; error: string }

export function psaCertUrl(cert: string): string {
  return `https://www.psacard.com/cert/${cert}/psa`
}

/** PSA certificate numbers are 7 to 10 digits; spaces and a leading # are ignored. */
export function cleanCertNumber(input: string): string | null {
  const s = input.replace(/[\s#]/g, '')
  return /^\d{7,10}$/.test(s) ? s : null
}

/** "$1,234.50" -> 1234.5 */
export function parseUsdText(text: string): number | null {
  const m = text.replace(/\s/g, '').match(/^(?:US)?\$([\d,]+(?:\.\d{1,2})?)$/i)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseCount(text: string | undefined): number | null {
  if (!text) return null
  const s = text.replace(/[,.\s]/g, '')
  return /^\d+$/.test(s) ? Number(s) : null
}

/** "MINT 9" -> "PSA 9", "GEM MT 10" -> "PSA 10", "NM-MT 8.5" -> "PSA 8.5", "AUTHENTIC" -> "PSA Authentic" */
export function psaGrading(grade: string): string {
  const num = grade.match(/(\d+(?:\.5)?)\s*$/)
  if (num) return `PSA ${num[1]}`
  return grade.trim() ? `PSA ${grade.trim().charAt(0)}${grade.trim().slice(1).toLowerCase()}` : 'PSA'
}

/** Label/value lines as rendered on the page; labels may carry an info icon or other trailing text. */
function valueAfter(lines: string[], label: string): string | undefined {
  const i = lines.findIndex((l) => l.toUpperCase().replace(/[^A-Z ]/g, '').trim() === label)
  return i >= 0 ? lines.slice(i + 1).find((l) => l.trim()) : undefined
}

/**
 * Reads the certificate page from its visible text (document.body.innerText split
 * into lines) and the main heading. Returns null until the grade is on the page.
 */
export function parsePsaPage(cert: string, heading: string, lines: string[]): PsaCert | null {
  const clean = lines.map((l) => l.trim()).filter(Boolean)
  const grade = valueAfter(clean, 'ITEM GRADE')
  if (!grade) return null
  const estimate = valueAfter(clean, 'PSA ESTIMATE')
  let title = heading.replace(/\s+/g, ' ').trim()
  // The heading is only used if it names the card, not e.g. the certificate number.
  if (!/[a-z]{3}/i.test(title.replace(/cert/gi, ''))) title = ''
  if (!title) {
    const i = clean.findIndex((l) => l.replace(/\s/g, '') === `#${cert}`)
    title = i >= 0 ? (clean[i + 1] ?? '') : ''
  }
  return {
    cert,
    url: psaCertUrl(cert),
    title,
    grade: grade.trim(),
    grading: psaGrading(grade),
    population: parseCount(valueAfter(clean, 'PSA POPULATION')),
    popHigher: parseCount(valueAfter(clean, 'PSA POP HIGHER')),
    estimateUsd: estimate ? parseUsdText(estimate) : null
  }
}
