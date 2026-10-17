import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Entry, EntryKind } from '@shared/types'
import { blankEntry, newId } from '@shared/defaults'
import { todayIso } from '@shared/calc'
import { useStore } from '@/lib/store'
import { useToast } from '@/lib/toast'
import { EntryDialog } from './EntryDialog'
import { ConfirmDialog } from './ui'

interface Editor {
  create(kind: EntryKind): void
  edit(entry: Entry): void
  duplicate(entry: Entry): void
  remove(entry: Entry): void
}

const EditorContext = createContext<Editor | null>(null)

export function EntryEditorProvider({ children }: { children: ReactNode }) {
  const { data, upsertEntry, deleteEntry } = useStore()
  const toast = useToast()
  const [editing, setEditing] = useState<{ entry: Entry; isNew: boolean } | null>(null)
  const [deleting, setDeleting] = useState<Entry | null>(null)

  const create = useCallback(
    (kind: EntryKind) => {
      const category = data.categories.find((c) => c.kind === kind)
      setEditing({ entry: blankEntry(kind, category?.id ?? '', todayIso()), isNew: true })
    },
    [data.categories]
  )

  const editor = useMemo<Editor>(
    () => ({
      create,
      edit: (entry) => setEditing({ entry, isNew: false }),
      duplicate: (entry) => {
        const now = new Date().toISOString()
        setEditing({ entry: { ...entry, id: newId(), name: `${entry.name} (Kopie)`, createdAt: now, updatedAt: now }, isNew: true })
      },
      remove: (entry) => setDeleting(entry)
    }),
    [create]
  )

  return (
    <EditorContext.Provider value={editor}>
      {children}
      {editing && (
        <EntryDialog
          key={editing.entry.id}
          initial={editing.entry}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSaved={(e) => toast({ message: editing.isNew ? `„${e.name}“ hinzugefügt` : `„${e.name}“ gespeichert` })}
          onDelete={(e) => {
            setEditing(null)
            setDeleting(e)
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Posten löschen?"
          text={
            <>
              „{deleting.name}“ wird aus allen Übersichten entfernt. Du kannst das direkt danach noch rückgängig machen. Wenn der Vertrag nur ruht, ist „Pausiert“ die bessere Wahl.
            </>
          }
          confirmLabel="Löschen"
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            const removed = deleting
            deleteEntry(removed.id)
            toast({ message: `„${removed.name}“ gelöscht`, actionLabel: 'Rückgängig', action: () => upsertEntry(removed) })
          }}
        />
      )}
    </EditorContext.Provider>
  )
}

export function useEntryEditor(): Editor {
  const editor = useContext(EditorContext)
  if (!editor) throw new Error('useEntryEditor outside provider')
  return editor
}
