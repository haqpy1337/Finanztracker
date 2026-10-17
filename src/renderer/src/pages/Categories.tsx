import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Category, EntryKind } from '@shared/types'
import { isActiveOn, monthlyEquivalent, sum, todayIso } from '@shared/calc'
import { useStore } from '@/lib/store'
import { useDark } from '@/lib/theme'
import { money } from '@/lib/format'
import { PALETTE_SIZE, seriesColor } from '@/lib/palette'
import { Card, CategoryLabel, Dialog, PageHeader, Segmented } from '@/components/ui'

function CategoryDialog({ initial, onClose }: { initial: Category; onClose(): void }) {
  const { data, upsertCategory, colorSlot } = useStore()
  const usedBy = (slot: number) =>
    data.categories.filter((c) => c.kind === cat.kind && c.id !== cat.id && colorSlot(c.id) === slot).map((c) => c.name)
  const dark = useDark()
  const [cat, setCat] = useState(initial)
  const [error, setError] = useState(false)
  const save = () => {
    if (!cat.name.trim()) {
      setError(true)
      return
    }
    upsertCategory({ ...cat, name: cat.name.trim() })
    onClose()
  }
  return (
    <Dialog
      title={initial.id ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
      onClose={onClose}
      narrow
      footer={
        <>
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
        <div className="field s6">
          <label htmlFor="c-name">Name</label>
          <input id="c-name" className={`input ${error ? 'invalid' : ''}`} value={cat.name} autoFocus onChange={(e) => setCat({ ...cat, name: e.target.value })} />
          {error && <span className="error">Bitte einen Namen eingeben.</span>}
        </div>
        {!initial.id && (
          <div className="field s6">
            <label>Art</label>
            <Segmented<EntryKind>
              value={cat.kind}
              onChange={(kind) => setCat({ ...cat, kind })}
              options={[
                { value: 'expense', label: 'Ausgaben' },
                { value: 'income', label: 'Einnahmen' }
              ]}
            />
          </div>
        )}
        <div className="field s6">
          <label>Farbe in Diagrammen</label>
          <div className="color-picker">
            {Array.from({ length: PALETTE_SIZE + 1 }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={i === PALETTE_SIZE ? 'Neutral' : `Farbe ${i + 1}`}
                title={usedBy(i).length ? `Bereits verwendet von: ${usedBy(i).join(', ')}` : 'Frei'}
                className={cat.color === i ? 'active' : ''}
                style={{ background: seriesColor(i, dark) }}
                onClick={() => setCat({ ...cat, color: i })}
              />
            ))}
          </div>
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  )
}

function DeleteCategoryDialog({ category, onClose }: { category: Category; onClose(): void }) {
  const { data, deleteCategory } = useStore()
  const targets = data.categories.filter((c) => c.kind === category.kind && c.id !== category.id)
  const [moveTo, setMoveTo] = useState(targets[0]?.id ?? '')
  const count = data.entries.filter((e) => e.categoryId === category.id).length
  return (
    <Dialog
      title="Kategorie löschen?"
      onClose={onClose}
      narrow
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Abbrechen
          </button>
          <button
            className="btn danger"
            disabled={!moveTo}
            onClick={() => {
              deleteCategory(category.id, moveTo)
              onClose()
            }}
          >
            Löschen
          </button>
        </>
      }
    >
      {targets.length === 0 ? (
        <p className="text-2">Das ist die letzte Kategorie dieser Art und kann nicht gelöscht werden.</p>
      ) : (
        <div className="form-grid">
          <p className="text-2 field s6" style={{ margin: 0 }}>
            {count === 0 ? `„${category.name}“ enthält keine Posten.` : `${count} Posten aus „${category.name}“ werden verschoben nach:`}
          </p>
          {count > 0 && (
            <div className="field s6">
              <select className="select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {targets.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}

export function Categories() {
  const { data } = useStore()
  const today = todayIso()
  const [editing, setEditing] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const section = (kind: EntryKind, title: string) => {
    const list = data.categories.filter((c) => c.kind === kind)
    const stats = list.map((c) => {
      const entries = data.entries.filter((e) => e.categoryId === c.id)
      const monthly = sum(entries.filter((e) => e.interval !== 'once' && isActiveOn(e, today)).map(monthlyEquivalent))
      return { c, count: entries.length, monthly }
    })
    const total = sum(stats.map((s) => s.monthly))
    return (
      <Card
        title={title}
        flush
        actions={
          <button className="btn small" onClick={() => setEditing({ id: '', name: '', kind, color: list.length % PALETTE_SIZE })}>
            <Plus size={14} />
            Kategorie
          </button>
        }
      >
        <table className="table">
          <thead>
            <tr>
              <th>Kategorie</th>
              <th className="right">Posten</th>
              <th className="right">Pro Monat</th>
              <th className="right">Anteil</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {stats.map(({ c, count, monthly }) => (
              <tr key={c.id} onDoubleClick={() => setEditing(c)}>
                <td>
                  <CategoryLabel category={c} />
                </td>
                <td className="right num">{count}</td>
                <td className="right num">{money(monthly)}</td>
                <td className="right num text-muted">{total ? `${((monthly / total) * 100).toFixed(1).replace('.', ',')} %` : '–'}</td>
                <td>
                  <div className="row-actions">
                    <button className="icon-btn" title="Bearbeiten" onClick={() => setEditing(c)}>
                      <Pencil size={15} />
                    </button>
                    <button className="icon-btn danger" title="Löschen" onClick={() => setDeleting(c)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    )
  }

  return (
    <div className="page">
      <PageHeader title="Kategorien" subtitle="Ordne deine Posten so, wie es für dich am übersichtlichsten ist" />
      <div className="grid cols-3-2">
        {section('expense', 'Ausgaben')}
        {section('income', 'Einnahmen')}
      </div>
      {editing && <CategoryDialog initial={editing} onClose={() => setEditing(null)} />}
      {deleting && <DeleteCategoryDialog category={deleting} onClose={() => setDeleting(null)} />}
    </div>
  )
}
