import { useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import { usdToEur } from '@shared/fx'
import { cleanCertNumber, type PsaCert, type PsaLookup as Lookup } from '@shared/psa'
import { api } from '@/lib/api'
import { date, money, usdMoney } from '@/lib/format'
import { rateInput } from './UsdRate'

/** What a lookup hands back to the dialog: the card data and the estimate in euros, if any. */
export interface PsaResult {
  cert: PsaCert
  /** Estimate converted to euros; null without estimate or without exchange rate. */
  eur: number | null
  /** Note for a value update, e.g. "PSA-Schätzung 164,00 $ · 1 € = 1,0852 $ (16.10.2026)". */
  note: string
}

function toResult(lookup: Extract<Lookup, { ok: true }>): PsaResult {
  const { cert, rate } = lookup
  const quote = rate && rate.status !== 'unavailable' ? rate.rate : null
  const eur = cert.estimateUsd !== null && quote ? usdToEur(cert.estimateUsd, quote.rate) : null
  const note =
    cert.estimateUsd === null
      ? ''
      : `PSA-Schätzung ${usdMoney(cert.estimateUsd)}${quote ? ` · 1 € = ${rateInput(quote.rate)} $ (${date(quote.date)})` : ''}`
  return { cert, eur, note }
}

interface Props {
  certificate: string
  onResult(result: PsaResult): void
  /** Wording of the hint after a successful lookup. */
  appliedText: string
}

/** "Von PSA abrufen" button with the outcome of the lookup below it. */
export function PsaLookupButton({ certificate, onResult, appliedText }: Props) {
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; error: string } | { kind: 'done'; lookup: Extract<Lookup, { ok: true }> }>({
    kind: 'idle'
  })
  const cert = cleanCertNumber(certificate)

  const run = async () => {
    if (!cert) {
      setState({ kind: 'error', error: 'Bitte zuerst eine PSA-Zertifikatsnummer eintragen (7 bis 10 Ziffern).' })
      return
    }
    setState({ kind: 'loading' })
    const lookup = await api.lookupPsaCert(cert).catch((err: unknown): Lookup => ({ ok: false, error: err instanceof Error ? err.message : String(err) }))
    if (!lookup.ok) {
      setState({ kind: 'error', error: lookup.error })
      return
    }
    setState({ kind: 'done', lookup })
    onResult(toResult(lookup))
  }

  const done = state.kind === 'done' ? toResult(state.lookup) : null
  const rate = state.kind === 'done' ? state.lookup.rate : null

  return (
    <div className="psa-lookup">
      <button type="button" className="btn small" onClick={run} disabled={state.kind === 'loading'}>
        <Search size={14} />
        {state.kind === 'loading' ? 'PSA wird abgefragt …' : 'Von PSA abrufen'}
      </button>
      {state.kind === 'error' && <span className="error">{state.error}</span>}
      {done && (
        <div className="psa-result">
          <div>
            <strong>{done.cert.grade}</strong>
            {done.cert.population !== null && <span className="text-2"> · Population {done.cert.population.toLocaleString('de-DE')}</span>}
            {' · '}
            <a href={done.cert.url} target="_blank" rel="noreferrer">
              Zertifikat ansehen <ExternalLink size={12} />
            </a>
          </div>
          {done.cert.estimateUsd === null ? (
            <div className="text-2">PSA zeigt für diese Karte keine Schätzung. Kartendaten wurden übernommen.</div>
          ) : (
            <div>
              PSA-Schätzung <strong className="num">{usdMoney(done.cert.estimateUsd)}</strong>
              {done.eur !== null ? (
                <>
                  {' '}
                  ≈ <strong className="num">{money(done.eur)}</strong>{' '}
                  <span className={`badge ${rate?.status === 'live' ? 'good' : 'warn'}`}>
                    {rate?.status === 'live' ? 'Live-Kurs' : `letzter Kurs vom ${rate && rate.status !== 'unavailable' ? date(rate.rate.date) : ''}`}
                  </span>
                </>
              ) : (
                <span className="badge bad">Kein Kurs, Euro-Wert bitte selbst eintragen</span>
              )}
            </div>
          )}
          <span className="help">{appliedText}</span>
        </div>
      )}
    </div>
  )
}
