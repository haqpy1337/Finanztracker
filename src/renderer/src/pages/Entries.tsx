import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Download, ListPlus, Pause, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react'
import type { Entry, EntryKind } from '@shared/types'
import { monthlyEquivalent, nextOccurrence, sum, todayIso } from '@shared/calc'
import { INTERVAL_LABELS } from '@shared/defaults'
import { useStore } from '@/lib/store'
import { useToast } from '@/lib/toast'
import { api } from '@/lib/api'
import { date, money } from '@/lib/format'
import { entriesToCsv, entryStatus, STATUS_LABELS, type EntryStatus } from '@/lib/derive'
import { Card, CategoryLabel, EmptyState, PageHeader, Segmented } from '@/components/ui'
import { useEntryEditor } from '@/components/EntryEditor'

type SortKey = 'name' | 'category' | 'amount' | 'monthly' | 'next' | 'interval'
type StatusFilter = 'current' | 'all' | EntryStatus

const STATUS_BADGE: Record<EntryStatus, string> = {
  active: 'good',
  paused: '',
  ended: '',
  future: 'accent',
  once: ''
}

export function Entries() {
  const { data, upsertEntry, categoryById } = useStore()
  const editor = useEntryEditor()
  const toast = useToast()
  const today = todayIso()
  const [kind, setKind] = useState<EntryKind>('expense')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<StatusFilter>('current')
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'monthly', asc: false })

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = data.entries
      .filter((e) => e.kind === kind)
      .filter((e) => !category || e.categoryId === category)
      .filter((e) => {
        const st = entryStatus(e, today)
        if (status === 'all') return true
        if (status === 'current') return st === 'active' || st === 'future' || (st === 'once' && e.startDate >= `${today.slice(0, 4)}-01-01`)
        return st === status
      })
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          e.provider.toLowerCase().includes(q) ||
          e.notes.toLowerCase().includes(q) ||
          (categoryById(e.categoryId)?.name.toLowerCase().includes(q) ?? false)
      )
      .map((e) => ({ entry: e, monthly: monthlyEquivalent(e), next: nextOccurrence(e, today), status: entryStatus(e, today) }))

    const dir = sort.asc ? 1 : -1
    list.sort((a, b) => {
      switch (sort.key) {
        case 'name':
          return dir * a.entry.name.localeCompare(b.entry.name, 'de')
        case 'category':
          return dir * (categoryById(a.entry.categoryId)?.name ?? '').localeCompare(categoryById(b.entry.categoryId)?.name ?? '', 'de')
        case 'amount':
          return dir * (a.entry.amount - b.entry.amount)
        case 'interval':
          return dir * INTERVAL_LABELS[a.entry.interval].localeCompare(INTERVAL_LABELS[b.entry.interval], 'de')
        case 'next':
          return dir * (a.next ?? '9999').localeCompare(b.next ?? '9999')
        default:
          return dir * (a.monthly - b.monthly) || a.entry.name.localeCompare(b.entry.name, 'de')
      }
    })
    return list
  }, [data.entries, kind, category, status, query, sort, today, categoryById])

  const monthlySum = sum(rows.filter((r) => r.status === 'active').map((r) => r.monthly))
  const categories = data.categories.filter((c) => c.kind === kind)

  const header = (key: SortKey, label: string, right = false) => (
    <th
      className={`sortable ${right ? 'right' : ''}`}
      onClick={() => setSort((s) => ({ key, asc: s.key === key ? !s.asc : key === 'name' || key === 'category' || key === 'next' }))}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        {sort.key === key && (sort.asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </span>
    </th>
  )

  const togglePause = (e: Entry) => {
    upsertEntry({ ...e, paused: !e.paused })
    toast({ message: e.paused ? `„${e.name}“ wieder aktiv` : `„${e.name}“ pausiert`, actionLabel: 'Rückgängig', action: () => upsertEntry(e) })
  }

  const exportCsv = async () => {
    const path = await api.exportCsv(entriesToCsv(data, today))
    if (path) toast({ message: 'CSV-Datei gespeichert' })
  }

  return (
    <div className="page">
      <PageHeader
        title="Ausgaben & Einnahmen"
        subtitle="Alle Posten verwalten: Abos, Verträge, Fixkosten, Schätzungen und einmalige Ausgaben"
        actions={
          <>
            <button className="btn" onClick={exportCsv} disabled={data.entries.length === 0}>
              <Download size={16} />
              CSV-Export
            </button>
            <button className="btn primary" onClick={() => editor.create(kind)}>
              <Plus size={16} />
              {kind === 'income' ? 'Einnahme hinzufügen' : 'Ausgabe hinzufügen'}
            </button>
          </>
        }
      />

      <Card flush>
        <div className="toolbar" style={{ marginTop: -8 }}>
          <Segmented<EntryKind>
            value={kind}
            onChange={(k) => {
              setKind(k)
              setCategory('')
            }}
            options={[
              { value: 'expense', label: `Ausgaben (${data.entries.filter((e) => e.kind === 'expense').length})` },
              { value: 'income', label: `Einnahmen (${data.entries.filter((e) => e.kind === 'income').length})` }
            ]}
          />
          <div className="input-icon grow">
            <Search size={15} />
            <input className="input" placeholder="Suchen nach Name, Anbieter, Notiz …" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="select" style={{ width: 210 }} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Alle Kategorien</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select className="select" style={{ width: 170 }} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="current">Aktuelle</option>
            <option value="all">Alle Status</option>
            <option value="active">Nur aktive</option>
            <option value="future">Startet später</option>
            <option value="paused">Pausiert</option>
            <option value="ended">Beendet</option>
            <option value="once">Einmalig</option>
          </select>
        </div>

        {data.entries.filter((e) => e.kind === kind).length === 0 ? (
          <EmptyState
            icon={<ListPlus size={22} />}
            title={kind === 'income' ? 'Noch keine Einnahmen' : 'Noch keine Ausgaben'}
            text={
              kind === 'income'
                ? 'Erfasse dein Gehalt und weitere Einnahmen, um zu sehen, wie viel dir nach den Fixkosten bleibt.'
                : 'Lege deine erste Ausgabe an, zum Beispiel Miete, Strom oder ein Streaming-Abo.'
            }
            actions={
              <button className="btn primary" onClick={() => editor.create(kind)}>
                <Plus size={16} />
                Hinzufügen
              </button>
            }
          />
        ) : rows.length === 0 ? (
          <div className="small-empty">Keine Posten passen zu den Filtern.</div>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  {header('name', 'Bezeichnung')}
                  {header('category', 'Kategorie')}
                  {header('interval', 'Intervall')}
                  {header('amount', 'Betrag', true)}
                  {header('monthly', 'Pro Monat', true)}
                  {header('next', 'Nächste Fälligkeit')}
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ entry: e, monthly, next, status: st }) => (
                  <tr key={e.id} className={st === 'paused' || st === 'ended' ? 'row-muted' : ''} onDoubleClick={() => editor.edit(e)}>
                    <td>
                      <div className="entry-name">{e.name}</div>
                      {(e.provider || e.noticePeriod) && (
                        <div className="entry-meta">{[e.provider, e.noticePeriod && `Kündigung: ${e.noticePeriod}`].filter(Boolean).join(' · ')}</div>
                      )}
                    </td>
                    <td>
                      <CategoryLabel category={categoryById(e.categoryId)} />
                    </td>
                    <td className="text-2">{INTERVAL_LABELS[e.interval]}</td>
                    <td className="right num">{money(e.amount)}</td>
                    <td className="right num" style={{ fontWeight: 600 }}>
                      {e.interval === 'once' ? '–' : money(monthly)}
                    </td>
                    <td className="num text-2">{date(next)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className={`badge ${STATUS_BADGE[st]}`}>{STATUS_LABELS[st]}</span>
                        {e.estimated && <span className="badge warn">geschätzt</span>}
                        {e.contractEnd && e.contractEnd >= today && <span className="badge">kündbar bis {date(e.contractEnd)}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" title="Bearbeiten" onClick={() => editor.edit(e)}>
                          <Pencil size={15} />
                        </button>
                        <button className="icon-btn" title="Duplizieren" onClick={() => editor.duplicate(e)}>
                          <Copy size={15} />
                        </button>
                        {e.interval !== 'once' && (
                          <button className="icon-btn" title={e.paused ? 'Fortsetzen' : 'Pausieren'} onClick={() => togglePause(e)}>
                            {e.paused ? <Play size={15} /> : <Pause size={15} />}
                          </button>
                        )}
                        <button className="icon-btn danger" title="Löschen" onClick={() => editor.remove(e)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>
                    {rows.length} Posten · davon aktiv pro Monat
                  </td>
                  <td className="right num">{money(monthlySum)}</td>
                  <td colSpan={3} className="text-2" style={{ fontWeight: 400 }}>
                    entspricht {money(monthlySum * 12)} pro Jahr
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
      <div className="card-hint" style={{ marginTop: 10 }}>
        Tipp: Doppelklick auf eine Zeile öffnet den Posten zum Bearbeiten.
      </div>
    </div>
  )
}
