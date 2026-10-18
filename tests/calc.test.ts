import { describe, expect, it } from 'vitest'
import {
  addMonths,
  monthTotals,
  monthlyEquivalent,
  nextOccurrence,
  occurrencesInMonth,
  occurrencesBetween,
  recurringMonthlyTotal,
  sum
} from '../src/shared/calc'
import { blankEntry, normalizeData, sampleData } from '../src/shared/defaults'
import type { Entry } from '../src/shared/types'

function entry(patch: Partial<Entry>): Entry {
  return { ...blankEntry('expense', 'cat-abos', '2026-01-01'), name: 'Test', amount: 10, ...patch }
}

describe('addMonths', () => {
  it('clamps to the end of shorter months and returns to the anchor day', () => {
    expect(addMonths('2026-01-31', 1, 31)).toBe('2026-02-28')
    expect(addMonths('2026-01-31', 2, 31)).toBe('2026-03-31')
    expect(addMonths('2028-01-31', 1, 31)).toBe('2028-02-29')
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
  })
})

describe('occurrencesBetween', () => {
  it('lists monthly due dates inside the range', () => {
    const e = entry({ startDate: '2026-01-31' })
    expect(occurrencesBetween(e, '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })

  it('handles ranges far after the start date', () => {
    const e = entry({ startDate: '2020-03-15', interval: 'quarterly' })
    expect(occurrencesBetween(e, '2026-01-01', '2026-12-31')).toEqual(['2026-03-15', '2026-06-15', '2026-09-15', '2026-12-15'])
  })

  it('respects the end date and paused flag', () => {
    const e = entry({ startDate: '2026-01-05', endDate: '2026-03-04' })
    expect(occurrencesBetween(e, '2026-01-01', '2026-12-31')).toEqual(['2026-01-05', '2026-02-05'])
    expect(occurrencesBetween({ ...e, paused: true }, '2026-01-01', '2026-12-31')).toEqual([])
  })

  it('handles weekly, yearly and one-off entries', () => {
    expect(occurrencesBetween(entry({ interval: 'weekly', startDate: '2026-01-01' }), '2026-01-10', '2026-01-31')).toEqual([
      '2026-01-15',
      '2026-01-22',
      '2026-01-29'
    ])
    expect(occurrencesBetween(entry({ interval: 'yearly', startDate: '2024-02-29' }), '2025-01-01', '2028-12-31')).toEqual([
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29'
    ])
    expect(occurrencesBetween(entry({ interval: 'once', startDate: '2026-05-02' }), '2026-05-01', '2026-05-31')).toEqual(['2026-05-02'])
    expect(occurrencesBetween(entry({ interval: 'once', startDate: '2026-05-02' }), '2026-06-01', '2026-06-30')).toEqual([])
  })

  it('returns the next occurrence', () => {
    expect(nextOccurrence(entry({ startDate: '2026-01-20' }), '2026-10-21')).toBe('2026-11-20')
  })
})

describe('totals', () => {
  it('normalises amounts to a monthly figure', () => {
    expect(monthlyEquivalent(entry({ amount: 120, interval: 'yearly' }))).toBe(10)
    expect(monthlyEquivalent(entry({ amount: 30, interval: 'quarterly' }))).toBe(10)
    expect(monthlyEquivalent(entry({ amount: 12, interval: 'weekly' }))).toBe(52)
    expect(monthlyEquivalent(entry({ amount: 500, interval: 'once' }))).toBe(0)
  })

  it('sums without floating point drift', () => {
    expect(sum([0.1, 0.2, 0.3])).toBe(0.6)
    expect(sum(new Array(12).fill(13.99))).toBe(167.88)
  })

  it('computes the monthly recurring total for a date', () => {
    const entries = [entry({ amount: 13.99 }), entry({ amount: 89.9, interval: 'yearly' }), entry({ amount: 100, startDate: '2027-01-01' })]
    expect(recurringMonthlyTotal(entries, '2026-06-01', 'expense')).toBe(21.48)
  })

  it('computes twelve month totals for the sample data without errors', () => {
    const data = sampleData({ y: 2026, m: 10 })
    const totals = monthTotals(data.entries, 2026, 'expense')
    expect(totals).toHaveLength(12)
    expect(totals.every((t) => t > 0)).toBe(true)
  })
})

describe('normalizeData', () => {
  it('repairs broken entries instead of rejecting the file', () => {
    const data = normalizeData({
      categories: [{ id: 'x', name: 'X', kind: 'expense', color: 3 }],
      entries: [{ name: 'Kaputt', amount: -12.345, interval: 'hourly', startDate: 'gestern', categoryId: 'fehlt' }]
    })
    expect(data.entries[0].amount).toBe(12.35)
    expect(data.entries[0].interval).toBe('monthly')
    expect(data.entries[0].categoryId).toBe('x')
    expect(data.categories.some((c) => c.kind === 'income')).toBe(true)
  })

  it('rejects files that are not tracker data', () => {
    expect(() => normalizeData({ foo: 1 })).toThrow()
  })
})

describe('extra payments (13th/14th salary)', () => {
  const salary = entry({
    kind: 'income',
    categoryId: 'cat-gehalt',
    amount: 3000,
    startDate: '2026-01-28',
    extraPayments: [
      { id: 'a', month: 5, amount: 3000, label: '13. Gehalt' },
      { id: 'b', month: 11, amount: 3000, label: '14. Gehalt' }
    ]
  })

  it('adds the extra payment in its month', () => {
    const may = occurrencesInMonth([salary], 2026, 5)
    expect(may.map((o) => [o.date, o.amount, o.extraLabel])).toEqual([
      ['2026-05-28', 3000, undefined],
      ['2026-05-28', 3000, '13. Gehalt']
    ])
    expect(occurrencesInMonth([salary], 2026, 6)).toHaveLength(1)
  })

  it('counts 14 salaries per year', () => {
    expect(sum(monthTotals([salary], 2026, 'income'))).toBe(42000)
    expect(monthlyEquivalent(salary)).toBe(3500)
  })

  it('respects start and end date', () => {
    const late = { ...salary, startDate: '2026-06-28', endDate: '2027-05-01' }
    expect(occurrencesInMonth([late], 2026, 5)).toHaveLength(0)
    expect(occurrencesInMonth([late], 2026, 11)).toHaveLength(2)
    expect(occurrencesInMonth([late], 2027, 5)).toHaveLength(0)
  })
})

describe('variable income (on-call duty)', () => {
  const rb = entry({
    kind: 'income',
    categoryId: 'cat-gehalt',
    name: 'Rufbereitschaft',
    amount: 500,
    startDate: '2026-01-28',
    variable: { rate: 500, unit: 'Woche', usual: 1, months: [{ month: '2026-11', count: 2 }, { month: '2026-03', count: 0 }] }
  })

  it('uses the usual count, overrides and skips months with zero units', () => {
    expect(occurrencesInMonth([rb], 2026, 2).map((o) => o.amount)).toEqual([500])
    expect(occurrencesInMonth([rb], 2026, 11).map((o) => o.amount)).toEqual([1000])
    expect(occurrencesInMonth([rb], 2026, 3)).toEqual([])
    expect(sum(monthTotals([rb], 2026, 'income'))).toBe(500 * 10 + 1000)
  })

  it('is counted even when the usual count is zero, and stays out when paused', () => {
    const none = { ...rb, amount: 0, variable: { ...rb.variable!, usual: 0, months: [{ month: '2026-05', count: 4 }] } }
    expect(occurrencesInMonth([none], 2026, 5).map((o) => o.amount)).toEqual([2000])
    expect(occurrencesInMonth([none], 2026, 6)).toEqual([])
    expect(occurrencesInMonth([{ ...rb, paused: true }], 2026, 2)).toEqual([])
  })

  it('normalizes consistently and is stable when saved again', () => {
    const messy = { ...rb, interval: 'yearly', amount: 1, extraPayments: [{ id: 'x', month: 5, amount: 9, label: '' }],
      variable: { rate: 500, unit: ' ', usual: 2, months: [{ month: '2026-13', count: 1 }, { month: '2026-04', count: -1 }, { month: '2026-06', count: 3 }, { month: '2026-06', count: 4 }] } }
    const data = normalizeData({ ...sampleData({ y: 2026, m: 1 }), entries: [messy] })
    const e = data.entries[0]
    expect([e.interval, e.amount, e.extraPayments, e.variable]).toEqual(['monthly', 1000, [], { rate: 500, unit: 'Woche', usual: 2, months: [{ month: '2026-06', count: 4 }] }])
    expect(normalizeData(JSON.parse(JSON.stringify(data)))).toEqual(data)
  })
})
