import { useState, type ReactNode } from 'react'
import { Bitcoin, Box, Coins, Gem, Landmark, LineChart, PiggyBank, Trash2, Wallet } from 'lucide-react'
import type { Asset, AssetType } from '@shared/types'
import { isValidIso, todayIso } from '@shared/calc'
import { ASSET_TYPE_LABELS, ASSET_TYPES, isItemType } from '@shared/assets'
import { newId } from '@shared/defaults'
import { amountInput, money, parseAmount, parseQuantity, quantityInput, signedMoney, signedPercent } from '@/lib/format'
import { Dialog } from './ui'
import { PsaLookupButton, type PsaResult } from './PsaLookup'

export const ASSET_TYPE_ICONS: Record<AssetType, ReactNode> = {
  etf: <LineChart size={17} />,
  stock: <Landmark size={17} />,
  fund: <PiggyBank size={17} />,
  crypto: <Bitcoin size={17} />,
  metal: <Coins size={17} />,
  cash: <Wallet size={17} />,
  collectible: <Gem size={17} />,
  other: <Box size={17} />
}

const NAME_PLACEHOLDER: Record<AssetType, string> = {
  etf: 'z. B. MSCI World, S&P 500',
  stock: 'z. B. Apple, Allianz',
  fund: 'z. B. DWS Top Dividende',
  crypto: 'z. B. Bitcoin, Ethereum',
  metal: 'z. B. Goldbarren 100 g, Krügerrand',
  cash: 'z. B. Tagesgeld, Festgeld 12 Monate',
  collectible: 'z. B. Glurak Holo, Rolex Submariner',
  other: 'z. B. Oldtimer, Kunstwerk'
}

const PROVIDERS = ['Trade Republic', 'Scalable Capital', 'ING', 'comdirect', 'DKB', 'Consorsbank', 'flatex', 'Smartbroker+', 'Bitpanda', 'Coinbase', 'eBay', 'Cardmarket', 'Kleinanzeigen']
const GRADINGS = ['PSA 10', 'PSA 9', 'PSA 8', 'BGS 10', 'BGS 9.5', 'CGC 10', 'CGC 9.5', 'Ungegradet, Near Mint', 'Neu & OVP', 'Gebraucht, sehr gut']

interface Props {
  initial: Asset
  isNew: boolean
  onClose(): void
  onSave(asset: Asset): void
  onDelete?(asset: Asset): void
}

export function AssetDialog({ initial, isNew, onClose, onSave, onDelete }: Props) {
  const [asset, setAsset] = useState<Asset>(initial)
  const [priceText, setPriceText] = useState(amountInput(initial.purchaseValue))
  const [currentText, setCurrentText] = useState('')
  const [quantityText, setQuantityText] = useState(quantityInput(initial.quantity))
  const [sold, setSold] = useState(initial.sale !== null)
  const [saleDate, setSaleDate] = useState(initial.sale?.date ?? todayIso())
  const [saleText, setSaleText] = useState(initial.sale ? amountInput(initial.sale.value) : '')
  const [showErrors, setShowErrors] = useState(false)
  /** Note for the first value when it came from the PSA estimate. */
  const [psaNote, setPsaNote] = useState<{ value: number; note: string } | null>(null)

  const item = isItemType(asset.type)
  const price = parseAmount(priceText)
  const current = currentText.trim() ? parseAmount(currentText) : null
  const qty = quantityText.trim() ? parseQuantity(quantityText) : null
  const saleValue = parseAmount(saleText)
  const today = todayIso()

  const errors = {
    name: !asset.name.trim() ? 'Bitte eine Bezeichnung eingeben.' : null,
    price: price === null ? 'Bitte den Kaufpreis eingeben (0 ist erlaubt, z. B. bei einem Geschenk).' : null,
    date: !isValidIso(asset.purchaseDate) ? 'Bitte ein gültiges Datum wählen.' : asset.purchaseDate > today ? 'Das Kaufdatum liegt in der Zukunft.' : null,
    current: currentText.trim() && current === null ? 'Bitte einen gültigen Betrag eingeben.' : null,
    quantity: quantityText.trim() && qty === null ? 'Bitte eine gültige Anzahl eingeben.' : null,
    sale: !sold
      ? null
      : saleValue === null
        ? 'Bitte den Verkaufserlös eingeben.'
        : !isValidIso(saleDate) || saleDate < asset.purchaseDate
          ? 'Das Verkaufsdatum muss nach dem Kaufdatum liegen.'
          : null
  }
  const valid = !Object.values(errors).some(Boolean)
  const set = <K extends keyof Asset>(key: K, value: Asset[K]) => setAsset((a) => ({ ...a, [key]: value }))

  const save = () => {
    if (!valid || price === null) {
      setShowErrors(true)
      return
    }
    const valuations = [...asset.valuations]
    if (isNew && current !== null) {
      valuations.push({ id: newId('v'), date: today, value: current, invested: null, note: psaNote?.value === current ? psaNote.note : '' })
    }
    onSave({
      ...asset,
      name: asset.name.trim(),
      provider: asset.provider.trim(),
      identifier: asset.identifier.trim(),
      description: asset.description.trim(),
      grading: asset.grading.trim(),
      certificate: asset.certificate.trim(),
      purchaseValue: price,
      quantity: qty,
      valuations,
      sale: sold && saleValue !== null ? { date: saleDate, value: saleValue } : null
    })
  }

  const applyPsa = (r: PsaResult) => {
    setAsset((a) => {
      const next = {
        ...a,
        name: a.name.trim() ? a.name : r.cert.title,
        description: r.cert.title || a.description,
        grading: r.cert.grading,
        certificate: r.cert.cert
      }
      // An existing card gets the estimate as today's value (replacing an earlier PSA value from today).
      if (!isNew && r.eur !== null && !a.sale) {
        const kept = a.valuations.filter((v) => !(v.date === today && v.note.startsWith('PSA-Schätzung')))
        next.valuations = [...kept, { id: newId('v'), date: today, value: r.eur, invested: null, note: r.note }].sort((x, y) =>
          x.date < y.date ? -1 : x.date > y.date ? 1 : 0
        )
      }
      return next
    })
    if (isNew && r.eur !== null) {
      setCurrentText(amountInput(r.eur) || '0,00')
      setPsaNote({ value: r.eur, note: r.note })
    }
  }

  const err = (key: keyof typeof errors) => (showErrors && errors[key] ? <span className="error">{errors[key]}</span> : null)
  const previewGain = isNew && current !== null && price !== null ? current - price : null

  return (
    <Dialog
      title={isNew ? 'Anlage hinzufügen' : 'Anlage bearbeiten'}
      onClose={onClose}
      footer={
        <>
          {!isNew && onDelete && (
            <button className="btn ghost left text-bad" onClick={() => onDelete(asset)}>
              <Trash2 size={15} />
              Löschen
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button className="btn primary" onClick={save}>
            {isNew ? 'Hinzufügen' : 'Speichern'}
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
        <div className="field s6">
          <label>Art der Anlage</label>
          <div className="type-grid" role="radiogroup">
            {ASSET_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={asset.type === t}
                className={asset.type === t ? 'active' : ''}
                onClick={() => set('type', t)}
              >
                {ASSET_TYPE_ICONS[t]}
                <span>{ASSET_TYPE_LABELS[t]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="a-name">Bezeichnung</label>
          <input
            id="a-name"
            className={`input ${showErrors && errors.name ? 'invalid' : ''}`}
            value={asset.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder={NAME_PLACEHOLDER[asset.type]}
            autoFocus
          />
          {err('name')}
        </div>

        <div className="field">
          <label htmlFor="a-provider">{item ? 'Gekauft bei (optional)' : 'Depot / Plattform (optional)'}</label>
          <input
            id="a-provider"
            className="input"
            value={asset.provider}
            onChange={(e) => set('provider', e.target.value)}
            list="asset-providers"
            placeholder={item ? 'z. B. eBay, Cardmarket, Händler' : 'z. B. Trade Republic'}
          />
          <datalist id="asset-providers">
            {PROVIDERS.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>

        {item ? (
          <>
            <div className="field s6">
              <label htmlFor="a-desc">Beschreibung</label>
              <input
                id="a-desc"
                className="input"
                value={asset.description}
                onChange={(e) => set('description', e.target.value)}
                placeholder="z. B. Pokémon Base Set, 4/102, 1. Edition, deutsch"
              />
            </div>
            <div className="field">
              <label htmlFor="a-grading">Grading / Zustand</label>
              <input
                id="a-grading"
                className="input"
                value={asset.grading}
                onChange={(e) => set('grading', e.target.value)}
                list="asset-gradings"
                placeholder="z. B. PSA 10"
              />
              <datalist id="asset-gradings">
                {GRADINGS.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label htmlFor="a-cert">Zertifikats- / Seriennummer</label>
              <input id="a-cert" className="input" value={asset.certificate} onChange={(e) => set('certificate', e.target.value)} placeholder="optional" />
            </div>
            {asset.type === 'collectible' && (
              <div className="field s6">
                <PsaLookupButton
                  certificate={asset.certificate}
                  onResult={applyPsa}
                  appliedText={
                    isNew
                      ? 'Bezeichnung, Beschreibung, Grading und „Wert heute“ wurden ausgefüllt.'
                      : asset.sale
                        ? 'Kartendaten wurden übernommen.'
                        : 'Kartendaten übernommen; die Schätzung wird beim Speichern als Wertstand von heute eingetragen.'
                  }
                />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="a-id">{asset.type === 'cash' ? 'Konto / Bank (optional)' : 'ISIN, WKN oder Kürzel (optional)'}</label>
              <input
                id="a-id"
                className="input"
                value={asset.identifier}
                onChange={(e) => set('identifier', e.target.value)}
                placeholder={asset.type === 'crypto' ? 'z. B. BTC' : asset.type === 'cash' ? 'z. B. Tagesgeldkonto' : 'z. B. IE00B4L5Y983'}
              />
            </div>
            {asset.type !== 'cash' && (
              <div className="field">
                <label htmlFor="a-qty">{asset.type === 'metal' ? 'Menge (optional)' : 'Anzahl Anteile / Stück (optional)'}</label>
                <input
                  id="a-qty"
                  className={`input num ${showErrors && errors.quantity ? 'invalid' : ''}`}
                  value={quantityText}
                  onChange={(e) => setQuantityText(e.target.value)}
                  inputMode="decimal"
                  placeholder="z. B. 12,5"
                />
                {err('quantity')}
              </div>
            )}
          </>
        )}

        <div className="section-label">Kauf</div>
        <div className="field s2">
          <label htmlFor="a-date">{asset.type === 'cash' ? 'Angelegt am' : 'Kaufdatum'}</label>
          <input
            id="a-date"
            type="date"
            max={today}
            className={`input ${showErrors && errors.date ? 'invalid' : ''}`}
            value={asset.purchaseDate}
            onChange={(e) => set('purchaseDate', e.target.value)}
          />
          {err('date')}
        </div>
        <div className="field s2">
          <label htmlFor="a-price">{asset.type === 'cash' ? 'Angelegter Betrag' : 'Kaufpreis inkl. Gebühren'}</label>
          <div className="amount-input">
            <input
              id="a-price"
              className={`input num ${showErrors && errors.price ? 'invalid' : ''}`}
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
              onBlur={() => price !== null && setPriceText(amountInput(price) || '0,00')}
              inputMode="decimal"
              placeholder="0,00"
            />
            <span>€</span>
          </div>
          {err('price')}
        </div>
        {isNew && (
          <div className="field s2">
            <label htmlFor="a-current">Wert heute (optional)</label>
            <div className="amount-input">
              <input
                id="a-current"
                className={`input num ${showErrors && errors.current ? 'invalid' : ''}`}
                value={currentText}
                onChange={(e) => setCurrentText(e.target.value)}
                onBlur={() => current !== null && setCurrentText(amountInput(current) || '0,00')}
                inputMode="decimal"
                placeholder="0,00"
              />
              <span>€</span>
            </div>
            {err('current')}
          </div>
        )}
        {isNew && (
          <div className="field s6">
            <span className="help" style={{ marginTop: -6 }}>
              Später trägst du über „Wert aktualisieren“ einfach neue Stände ein. Je mehr Stände, desto genauer wird der Verlauf.
            </span>
          </div>
        )}

        {!isNew && (
          <>
            <div className="section-label">Verkauf</div>
            <div className="field s6">
              <label className="check" style={{ fontWeight: 400, color: 'var(--text)', fontSize: 14 }}>
                <input type="checkbox" checked={sold} onChange={(e) => setSold(e.target.checked)} />
                Verkauft (Gewinn oder Verlust wird damit festgeschrieben)
              </label>
            </div>
            {sold && (
              <>
                <div className="field s2">
                  <label htmlFor="a-sale-date">Verkauft am</label>
                  <input
                    id="a-sale-date"
                    type="date"
                    className={`input ${showErrors && errors.sale ? 'invalid' : ''}`}
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                  />
                </div>
                <div className="field s2">
                  <label htmlFor="a-sale">Verkaufserlös nach Gebühren</label>
                  <div className="amount-input">
                    <input
                      id="a-sale"
                      className={`input num ${showErrors && errors.sale ? 'invalid' : ''}`}
                      value={saleText}
                      onChange={(e) => setSaleText(e.target.value)}
                      onBlur={() => saleValue !== null && setSaleText(amountInput(saleValue) || '0,00')}
                      inputMode="decimal"
                      placeholder="0,00"
                    />
                    <span>€</span>
                  </div>
                </div>
                <div className="field s2" style={{ justifyContent: 'flex-end' }}>{err('sale')}</div>
              </>
            )}
          </>
        )}

        <div className="field s6">
          <label htmlFor="a-notes">Notizen</label>
          <textarea
            id="a-notes"
            className="textarea"
            value={asset.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder={item ? 'Lagerort, Rechnung, Echtheitsnachweis …' : 'Sparplan-Rate, Strategie …'}
          />
        </div>

        {previewGain !== null && price !== null && (
          <div className="preview-box">
            <span>
              Kaufpreis <strong className="num">{money(price)}</strong>
            </span>
            <span>
              Wert heute <strong className="num">{money(current ?? 0)}</strong>
            </span>
            <span>
              {previewGain >= 0 ? 'Gewinn' : 'Verlust'}{' '}
              <strong className={`num ${previewGain > 0 ? 'text-good' : previewGain < 0 ? 'text-bad' : ''}`}>
                {signedMoney(previewGain)} {price > 0 && `(${signedPercent((previewGain / price) * 100)})`}
              </strong>
            </span>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
