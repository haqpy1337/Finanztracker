import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { emptyData, newId } from '@shared/defaults'
import type { AppData, Category, Entry, Settings } from '@shared/types'
import { api } from './api'
import { resolveCategorySlots } from './palette'

interface Store {
  data: AppData
  loaded: boolean
  loadError: string | null
  saveError: string | null
  replaceData(data: AppData): void
  upsertEntry(entry: Entry): void
  deleteEntry(id: string): void
  upsertCategory(category: Category): void
  /** Deletes a category and moves its entries to `moveTo`. */
  deleteCategory(id: string, moveTo: string): void
  updateSettings(patch: Partial<Settings>): void
  categoryById(id: string): Category | undefined
  /** Palette slot actually used for a category on screen. */
  colorSlot(id: string): number
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData)
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const pending = useRef<AppData | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    api
      .loadData()
      .then((stored) => {
        if (stored) setData(stored)
        setLoaded(true)
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : String(err))
      })
  }, [])

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    const next = pending.current
    if (!next) return
    pending.current = null
    api
      .saveData(next)
      .then(() => setSaveError(null))
      .catch((err: unknown) => setSaveError(err instanceof Error ? err.message : String(err)))
  }, [])

  useEffect(() => {
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [flush])

  const commit = useCallback(
    (update: (prev: AppData) => AppData) => {
      setData((prev) => {
        const next = update(prev)
        pending.current = next
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(flush, 250)
        return next
      })
    },
    [flush]
  )

  const store = useMemo<Store>(() => {
    const categoryMap = new Map(data.categories.map((c) => [c.id, c]))
    const slots = resolveCategorySlots(data.categories)
    return {
      data,
      loaded,
      loadError,
      saveError,
      replaceData: (next) => commit(() => next),
      upsertEntry: (entry) =>
        commit((prev) => {
          const stamped = { ...entry, updatedAt: new Date().toISOString() }
          const exists = prev.entries.some((e) => e.id === entry.id)
          return {
            ...prev,
            entries: exists ? prev.entries.map((e) => (e.id === entry.id ? stamped : e)) : [...prev.entries, stamped]
          }
        }),
      deleteEntry: (id) => commit((prev) => ({ ...prev, entries: prev.entries.filter((e) => e.id !== id) })),
      upsertCategory: (category) =>
        commit((prev) => {
          const withId = category.id ? category : { ...category, id: newId('cat') }
          const exists = prev.categories.some((c) => c.id === withId.id)
          return {
            ...prev,
            categories: exists ? prev.categories.map((c) => (c.id === withId.id ? withId : c)) : [...prev.categories, withId]
          }
        }),
      deleteCategory: (id, moveTo) =>
        commit((prev) => ({
          ...prev,
          categories: prev.categories.filter((c) => c.id !== id),
          entries: prev.entries.map((e) => (e.categoryId === id ? { ...e, categoryId: moveTo } : e))
        })),
      updateSettings: (patch) => commit((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } })),
      categoryById: (id) => categoryMap.get(id),
      colorSlot: (id) => slots.get(id) ?? 0
    }
  }, [data, loaded, loadError, saveError, commit])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore outside StoreProvider')
  return store
}
