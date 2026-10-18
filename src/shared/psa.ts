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

/** "$1,234.50" -> 1234.5; the first dollar amount in the text counts. */
export function parseUsdText(text: string): number | null {
  const m = text.replace(/\s/g, '').match(/\$([\d,]+(?:\.\d{1,2})?)/)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseCount(text: string | undefined): number | null {
  const m = text?.match(/\d[\d,.]*/)
  return m ? Number(m[0].replace(/[,.]/g, '')) : null
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

export const PSA_LABELS = ['ITEM GRADE', 'PSA ESTIMATE', 'PSA POPULATION', 'PSA POP HIGHER']

/**
 * Runs inside the certificate page. Finds each label element by its own text and
 * takes the text of the next element after it (going up a few levels if the label
 * is wrapped, e.g. next to an info icon). Works without layout, unlike innerText,
 * so it also reads a page that was never shown. Returns [label, value, label, value, …]
 * followed by the visible lines, plus title and heading.
 */
export const PSA_READ_SCRIPT = `(() => {
  const labels = ${JSON.stringify(PSA_LABELS)}
  const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\\s+/g, ' ').trim()
  const pairs = []
  for (const el of document.querySelectorAll('body *')) {
    if (el.closest('script, style, noscript')) continue
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ')
    const label = norm(own)
    if (!labels.includes(label) || pairs.includes(label)) continue
    let value = ''
    let node = el
    for (let up = 0; up < 4 && node && !value; up++) {
      for (let sib = node.nextElementSibling; sib && !value; sib = sib.nextElementSibling) value = (sib.textContent || '').trim()
      node = node.parentElement
    }
    if (value) pairs.push(label, value.replace(/\\s+/g, ' '))
  }
  const h1 = document.querySelector('h1')
  return {
    title: document.title,
    heading: h1 ? h1.textContent || '' : '',
    lines: pairs.concat((document.body ? document.body.innerText : '').split('\\n'))
  }
})()`

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
