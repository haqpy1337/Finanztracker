import { useEffect, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Category } from '@shared/types'
import { seriesColor } from '@/lib/palette'
import { useDark } from '@/lib/theme'
import { percent } from '@/lib/format'
import { useStore } from '@/lib/store'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </div>
  )
}

export function Card({
  title,
  hint,
  actions,
  children,
  flush,
  className
}: {
  title?: ReactNode
  hint?: ReactNode
  actions?: ReactNode
  children: ReactNode
  flush?: boolean
  className?: string
}) {
  return (
    <section className={`card ${className ?? ''}`}>
      {(title || actions) && (
        <div className="card-header">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {hint && <div className="card-hint">{hint}</div>}
          </div>
          {actions}
        </div>
      )}
      <div className={`card-body ${flush ? 'flush' : ''}`}>{children}</div>
    </section>
  )
}

export function Kpi({ label, value, foot, icon }: { label: string; value: ReactNode; foot?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">
        {icon}
        {label}
      </div>
      <div className="kpi-value num">{value}</div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  )
}

/**
 * Change against a reference value. For expenses a rise is bad, for income
 * and balance a rise is good; `higherIsGood` picks the colour.
 */
export function Delta({ value, higherIsGood = false }: { value: number | null; higherIsGood?: boolean }) {
  if (value === null || !Number.isFinite(value)) return null
  if (Math.abs(value) < 0.05) return <span className="delta text-muted">±0 %</span>
  const up = value > 0
  const good = up === higherIsGood
  return (
    <span className={`delta ${good ? 'text-good' : 'text-bad'}`}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {percent(Math.abs(value))}
    </span>
  )
}

export function CategoryLabel({ category }: { category: Category | undefined }) {
  const dark = useDark()
  const { colorSlot } = useStore()
  if (!category) return <span className="text-muted">Ohne Kategorie</span>
  return (
    <span className="cat">
      <span className="dot" style={{ background: seriesColor(colorSlot(category.id), dark) }} />
      {category.name}
    </span>
  )
}

export function PeriodNav({ label, onPrev, onNext, onToday }: { label: string; onPrev(): void; onNext(): void; onToday?(): void }) {
  return (
    <div className="header-actions">
      {onToday && (
        <button className="btn small ghost" onClick={onToday}>
          Heute
        </button>
      )}
      <div className="period-nav">
        <button className="icon-btn" onClick={onPrev} aria-label="Zurück">
          <ChevronLeft size={17} />
        </button>
        <span className="label">{label}</span>
        <button className="icon-btn" onClick={onNext} aria-label="Weiter">
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange(value: T): void
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'active' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, text, actions }: { icon: ReactNode; title: string; text: string; actions?: ReactNode }) {
  return (
    <div className="empty">
      <div className="icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

export function Dialog({
  title,
  onClose,
  children,
  footer,
  narrow
}: {
  title: string
  onClose(): void
  children: ReactNode
  footer: ReactNode
  narrow?: boolean
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog ${narrow ? 'narrow' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-header">
          <h2 className="dialog-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Schließen">
            <X size={18} />
          </button>
        </div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-footer">{footer}</div>
      </div>
    </div>
  )
}

export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  onConfirm,
  onClose
}: {
  title: string
  text: ReactNode
  confirmLabel: string
  onConfirm(): void
  onClose(): void
}) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      narrow
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button
            className="btn danger"
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-2">{text}</div>
    </Dialog>
  )
}
