import { describe, expect, it } from 'vitest'
import { cleanCertNumber, parsePsaPage, parseUsdText, psaGrading } from '../src/shared/psa'

// Visible text of https://www.psacard.com/cert/86915996/psa as rendered (labels upper-cased by CSS).
const lines = [
  'Search',
  'According to the PSA database, the requested certification number is defined as the following:',
  '#86915996',
  '2014 POKEMON JAPANESE XY PHANTOM GATE #033 GENGAR EX PHANTOM GATE-1ST ED.',
  'ITEM GRADE',
  'MINT 9',
  'PSA ESTIMATE ⓘ',
  '$164.00',
  'PSA POPULATION',
  '557',
  'PSA POP HIGHER',
  '2,031',
  'Sales History'
]

describe('PSA certificate page', () => {
  it('reads card, grade, population and the PSA estimate', () => {
    expect(parsePsaPage('86915996', '', lines)).toEqual({
      cert: '86915996',
      url: 'https://www.psacard.com/cert/86915996/psa',
      title: '2014 POKEMON JAPANESE XY PHANTOM GATE #033 GENGAR EX PHANTOM GATE-1ST ED.',
      grade: 'MINT 9',
      grading: 'PSA 9',
      population: 557,
      popHigher: 2031,
      estimateUsd: 164
    })
  })

  it('prefers the main heading and works with title-case labels', () => {
    const r = parsePsaPage('1', '2000 POKEMON GYM HEROES #3 ERIKA\'S CLEFABLE', ['Item Grade', 'NM-MT 8', 'Psa Estimate', '$1,240.50'])
    expect(r?.title).toBe("2000 POKEMON GYM HEROES #3 ERIKA'S CLEFABLE")
    expect(r?.grading).toBe('PSA 8')
    expect(r?.estimateUsd).toBe(1240.5)
  })

  it('waits while the page is still loading and handles cards without estimate', () => {
    expect(parsePsaPage('86915996', '', ['Loading …'])).toBeNull()
    expect(parsePsaPage('86915996', '', ['ITEM GRADE', 'GEM MT 10'])?.estimateUsd).toBeNull()
  })

  it('normalises inputs', () => {
    expect(cleanCertNumber(' #86915996 ')).toBe('86915996')
    expect(cleanCertNumber('8691-5996')).toBeNull()
    expect(cleanCertNumber('123')).toBeNull()
    expect(parseUsdText('$164.00')).toBe(164)
    expect(parseUsdText('N/A')).toBeNull()
    expect(psaGrading('GEM MT 10')).toBe('PSA 10')
    expect(psaGrading('NM-MT+ 8.5')).toBe('PSA 8.5')
    expect(psaGrading('AUTHENTIC')).toBe('PSA Authentic')
  })
})

it('ignores a heading that is only the certificate number', () => {
  expect(parsePsaPage('86915996', 'Cert #86915996', lines)?.title).toBe('2014 POKEMON JAPANESE XY PHANTOM GATE #033 GENGAR EX PHANTOM GATE-1ST ED.')
})
