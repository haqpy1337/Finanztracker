/**
 * Versioning of the stored data. Every change to the data format bumps
 * CURRENT_SCHEMA and adds a migration step from the previous version, so data
 * saved by any earlier app version is upgraded step by step and never
 * reinterpreted.
 *
 * History:
 *   1  0.1.0  initial format
 *   2  0.2.0  entries gain `extraPayments` (13th/14th salary and similar)
 *   3  0.3.0  entries gain `variable` (income that varies per month, e.g. on-call duty)
 *   4  0.3.1  new top-level list `assets` (investments and valuables); entries are untouched
 *   5  0.4.1  entries gain `foreign` (amount originally entered in US dollars); existing entries get null
 */
export const CURRENT_SCHEMA = 5

/** Thrown when the data was written by a newer app version than this one. */
export class NewerSchemaError extends Error {
  constructor(readonly schema: number) {
    super(
      `Die Daten wurden mit einer neueren Version von Moo gespeichert (Datenformat ${schema}). ` +
        'Diese Version kann sie nicht sicher bearbeiten. Bitte installiere die neueste Version.'
    )
    this.name = 'NewerSchemaError'
  }
}

type Raw = Record<string, unknown>
type Step = (data: Raw) => Raw

const STEPS: Record<number, Step> = {
  // 1 -> 2: entries get an empty list of extra payments.
  1: (data) => ({
    ...data,
    entries: Array.isArray(data.entries)
      ? data.entries.map((e) => (e && typeof e === 'object' ? { extraPayments: [], ...(e as Raw) } : e))
      : data.entries
  }),
  // 2 -> 3: entries get `variable: null`, i.e. nothing changes for existing entries.
  2: (data) => ({
    ...data,
    entries: Array.isArray(data.entries)
      ? data.entries.map((e) => (e && typeof e === 'object' ? { variable: null, ...(e as Raw) } : e))
      : data.entries
  }),
  // 3 -> 4: an empty list of assets is added; entries and categories stay exactly as they are.
  3: (data) => ({ assets: [], ...data }),
  // 4 -> 5: entries get `foreign: null`, i.e. every existing amount stays a euro amount, unchanged.
  4: (data) => ({
    ...data,
    entries: Array.isArray(data.entries)
      ? data.entries.map((e) => (e && typeof e === 'object' ? { foreign: null, ...(e as Raw) } : e))
      : data.entries
  })
}

export function schemaOf(raw: unknown): number {
  if (!raw || typeof raw !== 'object') return 0
  const v = (raw as Raw).schemaVersion
  // Files from before versioning existed count as version 1.
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 1
}

/** Upgrades raw stored data to CURRENT_SCHEMA. Returns the input unchanged if it is current. */
export function migrate(raw: unknown): { data: unknown; from: number } {
  const from = schemaOf(raw)
  if (from === 0) return { data: raw, from }
  if (from > CURRENT_SCHEMA) throw new NewerSchemaError(from)
  let data = raw as Raw
  for (let v = from; v < CURRENT_SCHEMA; v++) {
    const step = STEPS[v]
    if (!step) throw new Error(`Keine Migration von Datenformat ${v} vorhanden.`)
    data = { ...step(data), schemaVersion: v + 1 }
  }
  return { data, from }
}
