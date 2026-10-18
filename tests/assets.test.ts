import { describe, expect, it } from 'vitest'
import { assetPoints, blankAsset, portfolioSeries, stateAt, summarize } from '../src/shared/assets'
import type { Asset } from '../src/shared/types'

function asset(patch: Partial<Asset>): Asset {
  return { ...blankAsset('etf', '2025-01-01'), name: 'Test', purchaseValue: 1000, ...patch }
}

const v = (date: string, value: number, invested: number | null = null) => ({ id: `v-${date}`, date, value, invested, note: '' })

describe('summarize', () => {
  it('compares the newest value with the purchase price', () => {
    const s = summarize(asset({ valuations: [v('2025-06-01', 900), v('2026-01-01', 1250)] }), '2026-10-18')
    expect(s.value).toBe(1250)
    expect(s.invested).toBe(1000)
    expect(s.gain).toBe(250)
    expect(s.gainPercent).toBeCloseTo(25)
    expect(s.lastDate).toBe('2026-01-01')
  })

  it('uses the invested amount of a savings plan', () => {
    const s = summarize(asset({ valuations: [v('2025-06-01', 2600, 2500), v('2026-01-01', 4100)] }), '2026-10-18')
    expect(s.invested).toBe(2500)
    expect(s.gain).toBe(1600)
    expect(s.annualPercent).toBeNull()
  })

  it('freezes the gain at the sale', () => {
    const s = summarize(asset({ valuations: [v('2025-06-01', 1500), v('2026-05-01', 9999)], sale: { date: '2026-02-01', value: 1400 } }), '2026-10-18')
    expect(s.sold).toBe(true)
    expect(s.value).toBe(1400)
    expect(s.gain).toBe(400)
  })

  it('gives a yearly return for holdings of more than a year', () => {
    const s = summarize(asset({ purchaseDate: '2024-10-18', valuations: [v('2026-10-18', 1210)] }), '2026-10-18')
    expect(s.annualPercent).toBeCloseTo(10, 0)
  })

  it('handles gifts without a purchase price', () => {
    const s = summarize(asset({ purchaseValue: 0, valuations: [v('2026-01-01', 300)] }))
    expect(s.gain).toBe(300)
    expect(s.gainPercent).toBeNull()
  })
})

describe('stateAt', () => {
  it('interpolates between known values and stays flat afterwards', () => {
    const a = asset({ purchaseDate: '2026-01-01', valuations: [v('2026-01-11', 1100)] })
    expect(stateAt(a, '2025-12-31')).toBeNull()
    expect(stateAt(a, '2026-01-06')!.value).toBeCloseTo(1050)
    expect(stateAt(a, '2026-05-01')!.value).toBe(1100)
  })

  it('ignores updates after the sale', () => {
    const a = asset({ valuations: [v('2026-03-01', 5000)], sale: { date: '2026-02-01', value: 1200 } })
    expect(assetPoints(a).map((p) => p.source)).toEqual(['purchase', 'sale'])
  })
})

describe('portfolioSeries', () => {
  it('adds up all assets and keeps realised gains after a sale', () => {
    const a = asset({ id: 'a', purchaseDate: '2026-01-01', valuations: [v('2026-03-01', 1200)] })
    const b = asset({ id: 'b', purchaseDate: '2026-02-01', purchaseValue: 500, sale: { date: '2026-04-01', value: 700 } })
    const series = portfolioSeries([a, b], '2026-06-01')
    const at = (d: string) => series.find((p) => p.date === d)!
    expect(at('2026-01-01')).toEqual({ date: '2026-01-01', value: 1000, invested: 1000, gain: 0 })
    expect(at('2026-03-31').value).toBeCloseTo(1896.61, 2)
    expect(at('2026-04-01')).toEqual({ date: '2026-04-01', value: 1200, invested: 1000, gain: 400 })
    expect(series[series.length - 1]).toEqual({ date: '2026-06-01', value: 1200, invested: 1000, gain: 400 })
  })
})
