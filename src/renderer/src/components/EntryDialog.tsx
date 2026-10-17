import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { Entry, EntryKind, Interval } from '@shared/types'
import { isValidIso, monthlyEquivalent, nextOccurrence, todayIso, yearlyEquivalent } from '@shared/calc'
import { INTERVAL_LABELS, INTERVAL_ORDER, PAYMENT_METHODS } from '@shared/defaults'
import { useStore } from '@/lib/store'
import { amountInput, date, money, parseAmount } from '@/lib/format'
import { Dialog, Segmented } from './ui'

/** Common positions; picking one fills in a sensible category and interval. */
const SUGGESTIONS: Array<{ name: string; category: string; interval?: Interval }> = [
  { name: 'Miete', category: 'cat-wohnen' },
  { name: 'Nebenkosten', category: 'cat-wohnen' },
  { name: 'Strom', category: 'cat-wohnen' },
  { name: 'Gas', category: 'cat-wohnen' },
  { name: 'Wasser', category: 'cat-wohnen', interval: 'quarterly' },
  { name: 'Rundfunkbeitrag', category: 'cat-wohnen', interval: 'quarterly' },
  { name: 'Netflix', category: 'cat-abos' },
  { name: 'Amazon Prime', category: 'cat-abos', interval: 'yearly' },
  { name: 'Spotify', category: 'cat-abos' },
  { name: 'Disney+', category: 'cat-abos' },
  { name: 'YouTube Premium', category: 'cat-abos' },
  { name: 'Apple One', category: 'cat-abos' },
  { name: 'DAZN', category: 'cat-abos' },
  { name: 'Sky', category: 'cat-abos' },
  { name: 'iCloud+', category: 'cat-abos' },
  { name: 'Microsoft 365', category: 'cat-abos', interval: 'yearly' },
  { name: 'Lebensmittel', category: 'cat-lebensmittel' },
  { name: 'Drogerie', category: 'cat-lebensmittel' },
  { name: 'Deutschlandticket', category: 'cat-mobilitaet' },
  { name: 'Tanken', category: 'cat-mobilitaet' },
  { name: 'Kfz-Versicherung', category: 'cat-versicherung', interval: 'yearly' },
  { name: 'Kfz-Steuer', category: 'cat-mobilitaet', interval: 'yearly' },
  { name: 'Haftpflichtversicherung', category: 'cat-versicherung', interval: 'yearly' },
  { name: 'Hausratversicherung', category: 'cat-versicherung' },
  { name: 'Krankenversicherung', category: 'cat-versicherung' },
  { name: 'Internet', category: 'cat-kommunikation' },
  { name: 'Handyvertrag', category: 'cat-kommunikation' },
  { name: 'Fitnessstudio', category: 'cat-freizeit' },
  { name: 'Sparplan', category: 'cat-sparen' },
  { name: 'Gehalt', category: 'cat-gehalt' }
]

interface Props {
  initial: Entry
  isNew: boolean
  onClose(): void
  onSaved?(entry: Entry): void
  onDelete?(entry: Entry): void
}

export function EntryDialog({ initial, isNew, onClose, onSaved, onDelete }: Props) {
  const { data, upsertEntry } = useStore()
  const [entry, setEntry] = useState<Entry>(initial)
  const [amountText, setAmountText] = useState(amountInput(initial.amount))
  const [showErrors, setShowErrors] = useState(false)

  const categories = data.categories.filter((c) => c.kind === entry.kind)
  const amount = parseAmount(amountText)

  const errors = {
    name: !entry.name.trim() ? 'Bitte eine Bezeichnung eingeben.' : null,
    amount: amount === null || amount <= 0 ? 'Bitte einen Betrag größer als 0 eingeben.' : null,
    startDate: !isValidIso(entry.startDate) ? 'Bitte ein gültiges Datum wählen.' : null,
    endDate: entry.endDate && entry.endDate < entry.startDate ? 'Das Enddatum liegt vor der ersten Fälligkeit.' : null
  }
  const valid = !Object.values(errors).some(Boolean)

  const set = <K extends keyof Entry>(key: K, value: Entry[K]) => setEntry((e) => ({ ...e, [key]: value }))

  const setKind = (kind: EntryKind) => {
    const first = data.categories.find((c) => c.kind === kind)
    setEntry((e) => ({ ...e, kind, categoryId: first?.id ?? e.categoryId }))
  }

  const onNameChange = (name: string) => {
    const match = isNew ? SUGGESTIONS.find((s) => s.name.toLowerCase() === name.trim().toLowerCase()) : undefined
    const cat = match && data.categories.find((c) => c.id === match.category)
    setEntry((e) => ({
      ...e,
      name,
      ...(cat ? { categoryId: cat.id, kind: cat.kind } : {}),
      ...(match?.interval ? { interval: match.interval } : {})
    }))
  }

  const preview = useMemo(() => {
    const probe = { ...entry, amount: amount ?? 0, paused: false }
    return {
      monthly: monthlyEquivalent(probe),
      yearly: yearlyEquivalent(probe),
      next: isValidIso(probe.startDate) ? nextOccurrence(probe, todayIso()) : null
    }
  }, [entry, amount])

  const save = () => {
    if (!valid || amount === null) {
      setShowErrors(true)
      return
    }
    const saved = { ...entry, name: entry.name.trim(), amount }
    upsertEntry(saved)
    onSaved?.(saved)
    onClose()
  }

  const err = (key: keyof typeof errors) => (showErrors && errors[key] ? <span className="error">{errors[key]}</span> : null)

  return (
    <Dialog
      title={isNew ? (entry.kind === 'income' ? 'Einnahme hinzufügen' : 'Ausgabe hinzufügen') : 'Posten bearbeiten'}
      onClose={onClose}
      footer={
        <>
          {!isNew && onDelete && (
            <button className="btn ghost left text-bad" onClick={() => onDelete(entry)}>
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
          <Segmented<EntryKind>
            value={entry.kind}
            onChange={setKind}
            options={[
              { value: 'expense', label: 'Ausgabe' },
              { value: 'income', label: 'Einnahme' }
            ]}
          />
        </div>

        <div className="field">
          <label htmlFor="f-name">Bezeichnung</label>
          <input
            id="f-name"
            className={`input ${showErrors && errors.name ? 'invalid' : ''}`}
            value={entry.name}
            onChange={(e) => onNameChange(e.target.value)}
            list="name-suggestions"
            placeholder="z. B. Netflix, Miete, Strom"
            autoFocus
          />
          <datalist id="name-suggestions">
            {SUGGESTIONS.map((s) => (
              <option key={s.name} value={s.name} />
            ))}
          </datalist>
          {err('name')}
        </div>

        <div className="field">
          <label htmlFor="f-cat">Kategorie</label>
          <select id="f-cat" className="select" value={entry.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field s2">
          <label htmlFor="f-amount">Betrag</label>
          <div className="amount-input">
            <input
              id="f-amount"
              className={`input num ${showErrors && errors.amount ? 'invalid' : ''}`}
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              onBlur={() => amount !== null && setAmountText(amountInput(amount))}
              inputMode="decimal"
              placeholder="0,00"
            />
            <span>€</span>
          </div>
          {err('amount')}
        </div>

        <div className="field s2">
          <label htmlFor="f-interval">Intervall</label>
          <select id="f-interval" className="select" value={entry.interval} onChange={(e) => set('interval', e.target.value as Interval)}>
            {INTERVAL_ORDER.map((i) => (
              <option key={i} value={i}>
                {INTERVAL_LABELS[i]}
              </option>
            ))}
          </select>
        </div>

        <div className="field s2">
          <label htmlFor="f-start">{entry.interval === 'once' ? 'Datum' : 'Erste Fälligkeit'}</label>
          <input
            id="f-start"
            type="date"
            className={`input ${showErrors && errors.startDate ? 'invalid' : ''}`}
            value={entry.startDate}
            onChange={(e) => set('startDate', e.target.value)}
          />
          {err('startDate')}
        </div>

        {entry.interval !== 'once' && (
          <div className="field s2">
            <label htmlFor="f-end">Läuft bis (optional)</label>
            <input
              id="f-end"
              type="date"
              className={`input ${showErrors && errors.endDate ? 'invalid' : ''}`}
              value={entry.endDate ?? ''}
              onChange={(e) => set('endDate', e.target.value || null)}
            />
            {err('endDate')}
          </div>
        )}

        <div className="field s2">
          <label htmlFor="f-pay">Zahlungsart</label>
          <select id="f-pay" className="select" value={entry.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
            <option value="">–</option>
            {PAYMENT_METHODS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className={`field ${entry.interval === 'once' ? 's2' : 's2'}`}>
          <label htmlFor="f-provider">Anbieter / Empfänger</label>
          <input id="f-provider" className="input" value={entry.provider} onChange={(e) => set('provider', e.target.value)} placeholder="optional" />
        </div>

        <div className="field s6" style={{ flexDirection: 'row', gap: 22 }}>
          <label className="check" style={{ fontWeight: 400, color: 'var(--text)', fontSize: 14 }}>
            <input type="checkbox" checked={entry.estimated} onChange={(e) => set('estimated', e.target.checked)} />
            Betrag ist geschätzt (z. B. Lebensmittel)
          </label>
          <label className="check" style={{ fontWeight: 400, color: 'var(--text)', fontSize: 14 }}>
            <input type="checkbox" checked={entry.paused} onChange={(e) => set('paused', e.target.checked)} />
            Pausiert (wird nicht berechnet)
          </label>
        </div>

        {entry.kind === 'expense' && entry.interval !== 'once' && (
          <>
            <div className="section-label">Vertrag & Kündigung</div>
            <div className="field">
              <label htmlFor="f-notice">Kündigungsfrist</label>
              <input
                id="f-notice"
                className="input"
                value={entry.noticePeriod}
                onChange={(e) => set('noticePeriod', e.target.value)}
                placeholder="z. B. 1 Monat zum Laufzeitende"
              />
            </div>
            <div className="field">
              <label htmlFor="f-contract">Vertragsende / nächste Kündigungsmöglichkeit</label>
              <input id="f-contract" type="date" className="input" value={entry.contractEnd ?? ''} onChange={(e) => set('contractEnd', e.target.value || null)} />
              <span className="help">Die Übersicht erinnert dich rechtzeitig vorher.</span>
            </div>
          </>
        )}

        <div className="field s6">
          <label htmlFor="f-notes">Notizen</label>
          <textarea id="f-notes" className="textarea" value={entry.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Kundennummer, Vertragsdetails …" />
        </div>

        {entry.interval !== 'once' ? (
          <div className="preview-box">
            <span>
              Pro Monat <strong className="num">{money(preview.monthly)}</strong>
            </span>
            <span>
              Pro Jahr <strong className="num">{money(preview.yearly)}</strong>
            </span>
            <span>
              Nächste Fälligkeit <strong>{date(preview.next)}</strong>
            </span>
          </div>
        ) : null}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
