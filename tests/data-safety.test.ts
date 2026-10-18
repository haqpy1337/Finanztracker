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
