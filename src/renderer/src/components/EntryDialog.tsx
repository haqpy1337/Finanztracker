import { useMemo, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import type { Entry, EntryKind, ExtraPayment, Interval, VariablePay } from '@shared/types'
import { isValidIso, monthlyEquivalent, nextOccurrence, todayIso, yearlyEquivalent } from '@shared/calc'
import { INTERVAL_LABELS, INTERVAL_ORDER, newId, PAYMENT_METHODS } from '@shared/defaults'
import { useStore } from '@/lib/store'
import { amountInput, date, money, MONTHS, parseAmount } from '@/lib/format'
import { Dialog, Segmented } from './ui'

interface MonthDraft {
  id: string
  month: string
  countText: string
}


/** Parses a unit count such as "2" or "1,5"; zero is allowed. */
function parseCount(text: string): number | null {
  const t = text.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(t)) return null
  const n = Number(t)
  return n <= 1000 ? n : null
}

interface ExtraDraft {
  id: string
  month: number
  label: string
  amountText: string
}

function startLabel(income: boolean, recurring: boolean): string {
  if (income) return recurring ? 'Erster Zahlungseingang' : 'Datum des Zahlungseingangs'
  return recurring ? 'Erste Fälligkeit' : 'Datum'
}

/** Common positions; picking one fills in a sensible category and interval. */
const SUGGESTIONS: Array<{ name: string; category: string; interval?: Interval; variable?: boolean }> = [
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
  { name: 'Gehalt', category: 'cat-gehalt' },
  { name: 'Rufbereitschaft', category: 'cat-gehalt', variable: true }
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
  const [extras, setExtras] = useState<ExtraDraft[]>(() =>
    (initial.extraPayments ?? []).map((x) => ({ id: x.id, month: x.month, label: x.label, amountText: amountInput(x.amount) }))
  )

  const [varMode, setVarMode] = useState(!!initial.variable)
  const [rateText, setRateText] = useState(initial.variable ? amountInput(initial.variable.rate) : '')
  const [unit] = useState(initial.variable?.unit ?? 'Woche')
  const [usualText, setUsualText] = useState(String(initial.variable?.usual ?? 1).replace('.', ','))
  const [months, setMonths] = useState<MonthDraft[]>(() =>
    (initial.variable?.months ?? []).map((m) => ({ id: newId('v'), month: m.month, countText: String(m.count).replace('.', ',') }))
  )

  const categories = data.categories.filter((c) => c.kind === entry.kind)
  const income = entry.kind === 'income'
  const variableOn = varMode && income
  const rate = parseAmount(rateText)
  const usual = parseCount(usualText)
  const parsedMonths = months.map((m) => ({ ...m, count: parseCount(m.countText) }))
  const monthsInvalid = parsedMonths.some(
    (m, i) => !/^\d{4}-(0[1-9]|1[0-2])$/.test(m.month) || m.count === null || parsedMonths.findIndex((o) => o.month === m.month) !== i
  )
  const variable: VariablePay | null =
    variableOn && rate !== null && rate > 0 && usual !== null
      ? { rate, unit, usual, months: parsedMonths.filter((m) => m.count !== null).map((m) => ({ month: m.month, count: m.count! })) }
      : null
  const amount = variableOn ? (variable ? Math.round(variable.rate * variable.usual * 100) / 100 : null) : parseAmount(amountText)
  const recurring = variableOn || entry.interval !== 'once'
  const parsedExtras: ExtraPayment[] = recurring
    ? extras.map((x) => ({ id: x.id, month: x.month, label: x.label.trim(), amount: parseAmount(x.amountText) ?? 0 }))
    : []
  const extrasInvalid = parsedExtras.some((x) => x.amount <= 0)

  const errors = {
    name: !entry.name.trim() ? 'Bitte eine Bezeichnung eingeben.' : null,
    amount: variableOn ? null : amount === null || amount <= 0 ? 'Bitte einen Betrag größer als 0 eingeben.' : null,
    rate: variableOn && (rate === null || rate <= 0) ? 'Bitte einen Betrag größer als 0 eingeben.' : null,
    usual: variableOn && usual === null ? 'Bitte eine Zahl eingeben.' : null,
    months: variableOn && monthsInvalid ? 'Bitte für jeden abweichenden Monat einen Monat und eine Anzahl eingeben (jeder Monat nur einmal).' : null,
    startDate: !isValidIso(entry.startDate) ? 'Bitte ein gültiges Datum wählen.' : null,
    endDate: entry.endDate && entry.endDate < entry.startDate ? 'Das Enddatum liegt vor dem Startdatum.' : null,
    extras: extrasInvalid ? 'Bitte für jede Sonderzahlung einen Betrag größer als 0 eingeben.' : null
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
    if (match?.variable && cat?.kind === 'income') setVarMode(true)
  }

  const preview = useMemo(() => {
    const probe = {
      ...entry,
      amount: amount ?? 0,
      interval: variableOn ? ('monthly' as Interval) : entry.interval,
      paused: false,
      variable,
      extraPayments: variableOn ? [] : parsedExtras.filter((x) => x.amount > 0)
    }
    return {
      monthly: monthlyEquivalent(probe),
      yearly: yearlyEquivalent(probe),
      next: isValidIso(probe.startDate) ? nextOccurrence(probe, todayIso()) : null
    }
  }, [entry, amount, extras, variable, variableOn])

  const addExtra = (label: string, month: number) =>
    setExtras((list) => [...list, { id: newId('x'), month, label, amountText: amount ? amountInput(amount) : '' }])
  const updateExtra = (id: string, patch: Partial<ExtraDraft>) => setExtras((list) => list.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const removeExtra = (id: string) => setExtras((list) => list.filter((x) => x.id !== id))
  const hasLabel = (label: string) => extras.some((x) => x.label.trim().toLowerCase() === label.toLowerCase())

  const save = () => {
    if (!valid || amount === null) {
      setShowErrors(true)
      return
    }
    const saved: Entry = variableOn
      ? {
          ...entry,
          name: entry.name.trim(),
          amount,
          interval: 'monthly',
          extraPayments: [],
          variable: variable && { ...variable, months: [...variable.months].sort((a, b) => (a.month < b.month ? -1 : 1)) }
        }
      : { ...entry, name: entry.name.trim(), amount, variable: null, extraPayments: [...parsedExtras].sort((a, b) => a.month - b.month) }
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

        {income && (
          <div className="field s6">
            <label className="check" style={{ fontWeight: 400, color: 'var(--text)', fontSize: 14 }}>
              <input type="checkbox" checked={varMode} onChange={(e) => setVarMode(e.target.checked)} />
              Rufbereitschaft / Betrag pro Woche (Anzahl Wochen kann schwanken)
            </label>
          </div>
        )}

        {variableOn ? (
          <>
            <div className="field">
              <label htmlFor="f-rate">Betrag pro {unit}</label>
              <div className="amount-input">
                <input
                  id="f-rate"
                  className={`input num ${showErrors && errors.rate ? 'invalid' : ''}`}
                  value={rateText}
                  onChange={(e) => setRateText(e.target.value)}
                  onBlur={() => rate !== null && setRateText(amountInput(rate))}
                  inputMode="decimal"
                  placeholder="0,00"
                />
                <span>€</span>
              </div>
              {err('rate')}
            </div>
            <div className="field">
              <label htmlFor="f-usual">{unit}n pro Monat</label>
              <input
                id="f-usual"
                className={`input num ${showErrors && errors.usual ? 'invalid' : ''}`}
                value={usualText}
                onChange={(e) => setUsualText(e.target.value)}
                inputMode="decimal"
                placeholder="1"
              />
              {err('usual')}
            </div>
          </>
        ) : (
          <>
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
          </>
        )}

        <div className="field s2">
          <label htmlFor="f-start">{startLabel(income, recurring)}</label>
          <input
            id="f-start"
            type="date"
            className={`input ${showErrors && errors.startDate ? 'invalid' : ''}`}
            value={entry.startDate}
            onChange={(e) => set('startDate', e.target.value)}
          />
          {err('startDate')}
        </div>

        {recurring && (
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
          <label htmlFor="f-provider">{income ? 'Zahler / Arbeitgeber' : 'Anbieter / Empfänger'}</label>
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

        {variableOn && (
          <div className="field s6">
            {months.length > 0 && (
              <>
                <label>Abweichende Monate</label>
                <div className="extras">
                  {months.map((m) => (
                    <div className="extra-row" key={m.id}>
                      <input
                        type="month"
                        className="input"
                        value={m.month}
                        aria-label="Monat"
                        onChange={(e) => setMonths((l) => l.map((x) => (x.id === m.id ? { ...x, month: e.target.value } : x)))}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          className={`input num ${showErrors && parseCount(m.countText) === null ? 'invalid' : ''}`}
                          style={{ width: 70, textAlign: 'right' }}
                          value={m.countText}
                          inputMode="decimal"
                          aria-label={`Anzahl ${unit}`}
                          onChange={(e) => setMonths((l) => l.map((x) => (x.id === m.id ? { ...x, countText: e.target.value } : x)))}
                        />
                        <span className="text-2">{unit}n</span>
                      </div>
                      <button type="button" className="icon-btn danger" title="Entfernen" onClick={() => setMonths((l) => l.filter((x) => x.id !== m.id))}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            {err('months')}
            <div>
              <button
                type="button"
                className="btn small ghost"
                onClick={() => setMonths((l) => [...l, { id: newId('v'), month: todayIso().slice(0, 7), countText: String(usual ?? 1).replace('.', ',') }])}
              >
                <Plus size={14} />
                Einen Monat anders eintragen
              </button>
            </div>
          </div>
        )}

        {recurring && !variableOn && (
          <>
            <div className="section-label">Sonderzahlungen</div>
            <div className="field s6">
              <span className="help" style={{ marginTop: -6 }}>
                {income
                  ? 'Zusätzliche Zahlungen einmal im Jahr, z. B. 13. und 14. Monatsgehalt, Urlaubs- oder Weihnachtsgeld.'
                  : 'Zusätzliche Zahlungen einmal im Jahr in einem festen Monat, z. B. eine Jahresgebühr.'}
              </span>
              {extras.length > 0 && (
                <div className="extras">
                  {extras.map((x) => (
                    <div className="extra-row" key={x.id}>
                      <input
                        className="input"
                        value={x.label}
                        placeholder="Bezeichnung"
                        aria-label="Bezeichnung der Sonderzahlung"
                        onChange={(e) => updateExtra(x.id, { label: e.target.value })}
                      />
                      <select
                        className="select"
                        value={x.month}
                        aria-label="Monat"
                        onChange={(e) => updateExtra(x.id, { month: Number(e.target.value) })}
                      >
                        {MONTHS.map((name, i) => (
                          <option key={name} value={i + 1}>
                            im {name}
                          </option>
                        ))}
                      </select>
                      <div className="amount-input">
                        <input
                          className={`input num ${showErrors && (parseAmount(x.amountText) ?? 0) <= 0 ? 'invalid' : ''}`}
                          value={x.amountText}
                          placeholder="0,00"
                          inputMode="decimal"
                          aria-label="Betrag der Sonderzahlung"
                          onChange={(e) => updateExtra(x.id, { amountText: e.target.value })}
                          onBlur={() => {
                            const v = parseAmount(x.amountText)
                            if (v !== null) updateExtra(x.id, { amountText: amountInput(v) })
                          }}
                        />
                        <span>€</span>
                      </div>
                      <button type="button" className="icon-btn danger" title="Entfernen" onClick={() => removeExtra(x.id)}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {err('extras')}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {income && !hasLabel('13. Gehalt') && (
                  <button type="button" className="btn small" onClick={() => addExtra('13. Gehalt', 5)}>
                    <Plus size={14} />
                    13. Gehalt
                  </button>
                )}
                {income && !hasLabel('14. Gehalt') && (
                  <button type="button" className="btn small" onClick={() => addExtra('14. Gehalt', 11)}>
                    <Plus size={14} />
                    14. Gehalt
                  </button>
                )}
                <button type="button" className="btn small ghost" onClick={() => addExtra(income ? 'Sonderzahlung' : 'Zusatzzahlung', 12)}>
                  <Plus size={14} />
                  {income ? 'Andere Sonderzahlung' : 'Zusatzzahlung'}
                </button>
              </div>
            </div>
          </>
        )}

        <div className="field s6">
          <label htmlFor="f-notes">Notizen</label>
          <textarea id="f-notes" className="textarea" value={entry.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Kundennummer, Vertragsdetails …" />
        </div>

        {recurring ? (
          <div className="preview-box">
            {variableOn && variable && (
              <span>
                Üblich{' '}
                <strong className="num" style={{ whiteSpace: 'nowrap' }}>
                  {money(variable.rate)} × {String(variable.usual).replace('.', ',')} {variable.unit}
                </strong>
              </span>
            )}
            <span>
              {parsedExtras.length > 0 || variableOn ? 'Ø pro Monat' : 'Pro Monat'} <strong className="num">{money(preview.monthly)}</strong>
            </span>
            <span>
              Pro Jahr{parsedExtras.length > 0 ? ' inkl. Sonderzahlungen' : ''} <strong className="num">{money(preview.yearly)}</strong>
            </span>
            <span>
              {income ? 'Nächster Zahlungseingang' : 'Nächste Fälligkeit'} <strong>{date(preview.next)}</strong>
            </span>
          </div>
        ) : null}
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}
