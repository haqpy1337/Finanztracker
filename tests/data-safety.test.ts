import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizeData } from '../src/shared/defaults'
import { CURRENT_SCHEMA, NewerSchemaError, migrate } from '../src/shared/schema'

// Real data file written by version 0.1.0 (sample data plus one entry added in the dialog).
const v010 = JSON.parse(readFileSync(join(__dirname, 'fixtures/data-v0.1.0.json'), 'utf8'))

describe('upgrading data from 0.1.0', () => {
  const upgraded = normalizeData(v010)

  it('keeps every entry with all its values unchanged', () => {
    expect(upgraded.entries).toHaveLength(v010.entries.length)
    v010.entries.forEach((original: Record<string, unknown>, i: number) => {
      expect(upgraded.entries[i]).toEqual({ ...original, extraPayments: [], variable: null })
    })
  })

  it('keeps categories and settings unchanged', () => {
    expect(upgraded.categories).toEqual(v010.categories)
    expect(upgraded.settings).toEqual(v010.settings)
  })

  it('marks the data with the current format', () => {
    expect(upgraded.schemaVersion).toBe(CURRENT_SCHEMA)
    expect(migrate(v010).from).toBe(1)
  })

  it('does not change data when it is saved again', () => {
    expect(normalizeData(JSON.parse(JSON.stringify(upgraded)))).toEqual(upgraded)
  })
})

describe('protection against data loss', () => {
  it('refuses data written by a newer version', () => {
    expect(() => normalizeData({ ...v010, schemaVersion: CURRENT_SCHEMA + 1 })).toThrow(NewerSchemaError)
  })

  it('keeps fields it does not know', () => {
    const withFuture = { ...v010, entries: [{ ...v010.entries[0], futureField: { a: 1 } }] }
    expect((normalizeData(withFuture).entries[0] as unknown as Record<string, unknown>).futureField).toEqual({ a: 1 })
  })

  it('keeps valid extra payments and drops broken ones', () => {
    const data = normalizeData({
      ...v010,
      schemaVersion: 2,
      entries: [
        {
          ...v010.entries[0],
          extraPayments: [
            { id: 'x1', month: 11, amount: 3150, label: '14. Gehalt' },
            { id: 'x2', month: 5, amount: 3150, label: '13. Gehalt' },
            { id: 'x3', month: 13, amount: 10, label: 'kaputt' },
            { id: 'x4', month: 3, amount: 0, label: 'leer' }
          ]
        }
      ]
    })
    expect(data.entries[0].extraPayments.map((x) => x.label)).toEqual(['13. Gehalt', '14. Gehalt'])
  })
})

describe('upgrading data from format 2', () => {
  it('only adds `variable: null` to entries and keeps everything else', () => {
    const v2 = { ...JSON.parse(JSON.stringify(v010)), schemaVersion: 2 }
    v2.entries = v2.entries.map((e: Record<string, unknown>) => ({ ...e, extraPayments: [{ id: 'x', month: 5, amount: 1, label: 'a' }] }))
    expect(migrate(v2).from).toBe(2)
    const up = normalizeData(v2)
    up.entries.forEach((e, i) => expect(e).toEqual({ ...v2.entries[i], variable: null }))
    expect(up.categories).toEqual(v2.categories)
  })

  it('still refuses newer data', () => {
    expect(() => normalizeData({ ...v010, schemaVersion: CURRENT_SCHEMA + 1 })).toThrow(NewerSchemaError)
  })
})

describe('upgrading data from format 3 (0.3.0) to 4 (assets)', () => {
  const v3 = { ...JSON.parse(JSON.stringify(v010)), schemaVersion: 3 }
  v3.entries = v3.entries.map((e: Record<string, unknown>) => ({
    ...e,
    extraPayments: [],
    variable: e.kind === 'income' ? { rate: 500, unit: 'Woche', usual: 1, months: [{ month: '2026-11', count: 2 }] } : null
  }))

  it('keeps every entry, category and setting exactly as it was', () => {
    const up = normalizeData(v3)
    expect(migrate(v3).from).toBe(3)
    expect(up.entries).toHaveLength(v3.entries.length)
    up.entries.forEach((e, i) => {
      const original = v3.entries[i]
      // Variable incomes store the usual monthly amount, exactly as 0.3.0 did.
      expect(e).toEqual(original.variable ? { ...original, amount: 500, interval: 'monthly' } : original)
    })
    expect(up.categories).toEqual(v3.categories)
    expect(up.settings).toEqual(v3.settings)
  })

  it('only adds an empty list of assets', () => {
    expect(migrate(v3).data).toEqual({ ...v3, schemaVersion: 4, assets: [] })
    expect(normalizeData(v3).assets).toEqual([])
  })
})

describe('assets are stored safely', () => {
  const asset = {
    id: 'a-1',
    type: 'collectible',
    name: 'Glurak Holo',
    provider: 'eBay',
    identifier: '',
    quantity: null,
    purchaseDate: '2025-03-20',
    purchaseValue: 850,
    valuations: [
      { id: 'v-2', date: '2026-09-01', value: 1150, invested: null, note: 'Cardmarket' },
      { id: 'v-1', date: '2025-11-15', value: 920, invested: null, note: '' }
    ],
    description: 'Base Set 4/102',
    grading: 'PSA 9',
    certificate: '81234567',
    notes: '',
    sale: null,
    createdAt: '2026-10-18T10:00:00.000Z',
    updatedAt: '2026-10-18T10:00:00.000Z'
  }
  const data = { ...v010, schemaVersion: 4, assets: [asset] }

  it('keeps every value of an asset and sorts the value updates by date', () => {
    const [a] = normalizeData(data).assets
    expect(a).toEqual({ ...asset, valuations: [asset.valuations[1], asset.valuations[0]] })
  })

  it('does not change assets when saved again', () => {
    const once = normalizeData(data)
    expect(normalizeData(JSON.parse(JSON.stringify(once)))).toEqual(once)
  })

  it('keeps fields it does not know, on assets and on value updates', () => {
    const withFuture = { ...data, assets: [{ ...asset, futureField: 1, valuations: [{ ...asset.valuations[0], currency: 'EUR' }] }] }
    const [a] = normalizeData(withFuture).assets as unknown as Array<Record<string, unknown>>
    expect(a.futureField).toBe(1)
    expect((a.valuations as Array<Record<string, unknown>>)[0].currency).toBe('EUR')
  })

  it('repairs broken values instead of dropping the asset', () => {
    const [a] = normalizeData({ ...data, assets: [{ ...asset, type: 'rocket', purchaseValue: 'x', valuations: [{ date: 'kaputt', value: 1 }, { date: '2026-01-01', value: 5 }] }] }).assets
    expect(a.name).toBe('Glurak Holo')
    expect(a.type).toBe('other')
    expect(a.purchaseValue).toBe(0)
    expect(a.valuations.map((v) => v.value)).toEqual([5])
  })
})
