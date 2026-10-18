import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Asset, AssetValuation } from '@shared/types'
import { isValidIso, todayIso } from '@shared/calc'
import { assetPoints, stateAt } from '@shared/assets'
import { newId } from '@shared/defaults'
import { amountInput, date, money, parseAmount, signedMoney, signedPercent } from '@/lib/format'
import { Dialog } from './ui'

interface Props {
  asset: Asset
  /** The value update to edit; a new one when omitted. */
  valuation?: AssetValuation
  onClose(): void
  onSave(asset: Asset): void
}

/** Records the value of an asset on a day, optionally with a new total invested amount. */
export function ValuationDialog({ asset, valuation, onClose, onSave }: Props) {
  const isNew = !valuation
  const others = asset.valuations.filter((v) => v.id !== valuation?.id)
  const [day, setDay] = useState(valuation?.date ?? todayIso())
  const [valueText, setValueText] = useState(valuation ? amountInput(valuation.value) || '0,00' : '')
  const [investedText, setInvestedText] = useState(valuation?.invested !== null && valuation ? amountInput(valuation.invested) || '0,00' : '')
  const [note, setNote] = useState(valuation?.note ?? '')
  const [showErrors, setShowErrors] = useState(false)

  const value = parseAmount(valueText)
  const invested = investedText.trim() ? parseAmount(investedText) : null
  const validDay = isValidIso(day)

  // What was known just before this day, for the comparison below the form.
  const without = { ...asset, valuations: others }
  const before = validDay ? stateAt(without, day < asset.purchaseDate ? asset.purchaseDate : day) : null
  const previousInvested = before?.invested ?? asset.purchaseValue
  const effectiveInvested = invested ?? previousInvested
  const lastPoint = assetPoints(without).filter((p) => validDay && p.date <= day && p.source !== 'sale').pop()

  const errors = {
    day: !validDay
      ? 'Bitte ein gültiges Datum wählen.'
      : day < asset.purchaseDate
        ? `Der Stand muss am oder nach dem Kaufdatum (${date(asset.purchaseDate)}) liegen.`
        : asset.sale && day > asset.sale.date
          ? `Die Anlage wurde am ${date(asset.sale.date)} verkauft.`
          : day > todayIso()
            ? 'Das Datum liegt in der Zukunft.'
            : null,
    value: value === null ? 'Bitte den Wert eingeben.' : null,
    invested: investedText.trim() && invested === null ? 'Bitte einen gültigen Betrag eingeben.' : null
  }
  const valid = !Object.values(errors).some(Boolean)

  const save = () => {
    if (!valid || value === null) {
      setShowErrors(true)
      return
    }
    const next: AssetValuation = { ...(valuation ?? { id: newId('v') }), date: day, value, invested, note: note.trim() }
    onSave({ ...asset, valuations: [...others, next].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) })
  }

  const remove = () => {
    onSave({ ...asset, valuations: others })
  }

  const err = (key: keyof typeof errors) => (showErrors && errors[key] ? <span className="error">{errors[key]}</span> : null)
  const gain = value !== null ? value - effectiveInvested : null
  // Without new payments, so a savings plan instalment does not count as a gain.
  const change = value !== null && lastPoint ? value - lastPoint.value - (effectiveInvested - lastPoint.invested) : null

  return (
    <Dialog
      title={isNew ? `Wert aktualisieren: ${asset.name}` : 'Wertstand bearbeiten'}
      onClose={onClose}
      narrow
      footer={
        <>
          {!isNew && (
            <button className="btn ghost left text-bad" onClick={remove}>
              <Trash2 size={15} />
              Löschen
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn primary" onClick={save}>
            Speichern
          </button>
        </>
      }
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="field">
          <label htmlFor="v-date">Stand vom</label>
          <input
            id="v-date"
            type="date"
            max={todayIso()}
            className={`input ${showErrors && errors.day ? 'invalid' : ''}`}
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="v-value">Gesamtwert</label>
          <div className="amount-input">
            <input
              id="v-value"
              className={`input num ${showErrors && errors.value ? 'invalid' : ''}`}
              value={valueText}
              onChange={(e) => setValueText(e.target.value)}
              onBlur={() => value !== null && setValueText(amountInput(value) || '0,00')}
              inputMode="decimal"
              placeholder="0,00"
              autoFocus
            />
            <span>€</span>
          </div>
        </div>
        {(err('day') || err('value')) && (
          <div className="field s6">
            {err('day')}
            {err('value')}
          </div>
        )}
        <div className="field s6">
          <label htmlFor="v-invested">Insgesamt eingezahlt (optional)</label>
          <div className="amount-input">
            <input
              id="v-invested"
              className={`input num ${showErrors && errors.invested ? 'invalid' : ''}`}
              value={investedText}
              onChange={(e) => setInvestedText(e.target.value)}
              onBlur={() => invested !== null && setInvestedText(amountInput(invested) || '0,00')}
              inputMode="decimal"
              placeholder={amountInput(previousInvested) || '0,00'}
            />
            <span>€</span>
          </div>
          {err('invested')}
          <span className="help">
            Nur nötig, wenn du nachgekauft oder etwas entnommen hast, z. B. per Sparplan. Bisher: {money(previousInvested)}.
          </span>
        </div>
        <div className="field s6">
          <label htmlFor="v-note">Notiz (optional)</label>
          <input id="v-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Kurs laut Depot, Cardmarket-Trend" />
        </div>
        {gain !== null && (
          <div className="preview-box">
            {change !== null && lastPoint && (
              <span>
                Seit {date(lastPoint.date)}{' '}
                <strong className={`num ${change > 0 ? 'text-good' : change < 0 ? 'text-bad' : ''}`}>{signedMoney(change)}</strong>
              </span>
            )}
            <span>
              {gain >= 0 ? 'Gewinn gesamt' : 'Verlust gesamt'}{' '}
              <strong className={`num ${gain > 0 ? 'text-good' : gain < 0 ? 'text-bad' : ''}`}>
                {signedMoney(gain)} {effectiveInvested > 0 && `(${signedPercent((gain / effectiveInvested) * 100)})`}
              </strong>
            </span>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
