import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import type { ForeignAmount } from '@shared/types'
import type { UsdRate } from '@shared/fx'
import { date } from '@/lib/format'

/** Where the rate shown in the entry dialog currently comes from. */
export type RateState =
  | { kind: 'loading' }
  | { kind: 'live'; rate: UsdRate }
  | { kind: 'cached'; rate: UsdRate; error: string }
  | { kind: 'unavailable'; error: string }
  | { kind: 'stored'; foreign: ForeignAmount }
  | { kind: 'manual' }

const rateFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 8, useGrouping: false })

export function rateInput(rate: number): string {
  return rate > 0 ? rateFormat.format(rate) : ''
}

function indicator(state: RateState): { tone: string; text: string; help: string | null } {
  switch (state.kind) {
    case 'loading':
      return { tone: '', text: 'Aktueller Kurs wird geladen …', help: null }
    case 'live':
      return { tone: 'good', text: 'Live-Kurs geladen', help: `EZB-Referenzkurs vom ${date(state.rate.date)}.` }
    case 'cached':
      return {
        tone: 'warn',
        text: 'Live-Kurs nicht erreichbar',
        help: `Verwendet wird der zuletzt geladene Kurs vom ${date(state.rate.date)}. Du kannst ihn auch von Hand anpassen.`
      }
    case 'unavailable':
      return { tone: 'bad', text: 'Kein Kurs verfügbar', help: 'Die Kursquelle ist nicht erreichbar. Bitte den Kurs von Hand eintragen.' }
    case 'stored':
      return {
        tone: '',
        text: 'Gespeicherter Kurs',
        help: `Dieser Betrag wurde ${state.foreign.convertedAt ? `am ${date(state.foreign.convertedAt.slice(0, 10))} ` : ''}mit dem Kurs${state.foreign.rateDate ? ` vom ${date(state.foreign.rateDate)}` : ''} umgerechnet.`
      }
    case 'manual':
      return { tone: 'accent', text: 'Kurs von Hand eingetragen', help: null }
  }
}

interface Props {
  state: RateState
  rateText: string
  invalid: boolean
  error: ReactNode
  onRateChange(text: string): void
  onReload(): void
}

/** Rate row of the entry dialog: status of the live rate, the rate used, and a reload button. */
export function UsdRateRow({ state, rateText, invalid, error, onRateChange, onReload }: Props) {
  const { tone, text, help } = indicator(state)
  return (
    <div className="field s6">
      <label htmlFor="f-rate">Wechselkurs</label>
      <div className="rate-row">
        <span className={`badge ${tone}`} role="status" aria-live="polite">
          <span className={`rate-dot ${state.kind === 'loading' ? 'pulse' : ''}`} />
          {text}
        </span>
        <div className="rate-input">
          <span>1 € =</span>
          <input
            id="f-rate"
            className={`input num ${invalid ? 'invalid' : ''}`}
            value={rateText}
            onChange={(e) => onRateChange(e.target.value)}
            inputMode="decimal"
            placeholder="1,0850"
            aria-label="Dollar pro Euro"
          />
          <span>$</span>
        </div>
        <button type="button" className="btn small" onClick={onReload} disabled={state.kind === 'loading'}>
          <RefreshCw size={14} />
          {state.kind === 'live' ? 'Neu laden' : state.kind === 'stored' || state.kind === 'manual' ? 'Aktuellen Kurs laden' : 'Erneut versuchen'}
        </button>
      </div>
      {help && <span className="help">{help}</span>}
      {error}
    </div>
  )
}
