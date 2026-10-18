import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeData } from '../src/shared/defaults'
import { migrate } from '../src/shared/schema'
import { parseUsdRate, usdToEur, validUsdRate } from '../src/shared/fx'

const v010 = JSON.parse(readFileSync(join(__dirname, 'fixtures/data-v0.1.0.json'), 'utf8'))

/** Data as 0.3.1 / 0.4.0 stores it (format 4). */
function v4() {
  const data = normalizeData(v010) as unknown as Record<string, unknown>
  const entries = (data.entries as Array<Record<string, unknown>>).map(({ foreign: _f, ...e }) => e)
  return JSON.parse(JSON.stringify({ ...data, schemaVersion: 4, entries }))
}

const foreign = {
  currency: 'USD',
  amount: 19.99,
  rate: 1.085,
  rateDate: '2026-10-16',
  source: 'live',
  convertedAt: '2026-10-18T16:50:00.000Z'
}

describe('upgrading data from format 4 to 5 (amounts in dollars)', () => {
  it('only adds `foreign: null` to entries; every euro amount stays exactly as it was', () => {
    const old = v4()
    const { data, from } = migrate(old)
    expect(from).toBe(4)
    expect(data).toEqual({ ...old, schemaVersion: 5, entries: old.entries.map((e: Record<string, unknown>) => ({ ...e, foreign: null })) })
    const up = normalizeData(old)
    up.entries.forEach((e, i) => expect(e).toEqual({ ...old.entries[i], foreign: null }))
    expect(up.categories).toEqual(old.categories)
    expect(up.assets).toEqual(old.assets)
    expect(up.settings).toEqual(old.settings)
  })
})

describe('entries entered in dollars', () => {
  const withUsd = () => {
    const data = normalizeData(v010)
    data.entries[0] = { ...data.entries[0], amount: 18.42, foreign: foreign as never }
    return data
  }

  it('keep the dollar amount, rate, rate date and euro amount when saved and loaded again', () => {
    const data = withUsd()
    const again = normalizeData(JSON.parse(JSON.stringify(data)))
    expect(again).toEqual(data)
    expect(again.entries[0].amount).toBe(18.42)
    expect(again.entries[0].foreign).toEqual(foreign)
  })

  it('never recompute the stored euro amount', () => {
    const data = withUsd()
    data.entries[0] = { ...data.entries[0], amount: 17 }
    expect(normalizeData(JSON.parse(JSON.stringify(data))).entries[0].amount).toBe(17)
  })

  it('drop a broken dollar record but keep the entry and its euro amount', () => {
    const data = withUsd()
    data.entries[0] = { ...data.entries[0], foreign: { ...foreign, rate: 0 } as never }
    const [e] = normalizeData(JSON.parse(JSON.stringify(data))).entries
    expect(e.foreign).toBeNull()
    expect(e.amount).toBe(18.42)
  })
})

describe('exchange rate', () => {
  it('converts dollars to euros with the ECB convention (dollars per euro)', () => {
    expect(usdToEur(19.99, 1.085)).toBe(18.42)
    expect(usdToEur(100, 1.1)).toBe(90.91)
    expect(usdToEur(10, 0)).toBe(0)
  })

  it('reads the answer of the rate source', () => {
    expect(parseUsdRate({ amount: 1, base: 'EUR', date: '2026-10-16', rates: { USD: 1.085 } }, 't')).toEqual({ rate: 1.085, date: '2026-10-16', fetchedAt: 't' })
  })

  it('rejects implausible or malformed answers', () => {
    expect(parseUsdRate({ base: 'USD', date: '2026-10-16', rates: { USD: 1 } }, 't')).toBeNull()
    expect(parseUsdRate({ base: 'EUR', date: '2026-10-16', rates: { USD: 0 } }, 't')).toBeNull()
    expect(parseUsdRate({ base: 'EUR', date: '2026-10-16', rates: { USD: 108.5 } }, 't')).toBeNull()
    expect(parseUsdRate({ base: 'EUR', date: 'gestern', rates: { USD: 1.08 } }, 't')).toBeNull()
    expect(parseUsdRate('<html>', 't')).toBeNull()
    expect(validUsdRate({ rate: 'x', date: '2026-10-16' })).toBeNull()
  })
})
