import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useStore } from '@/lib/store'
import { DarkContext, useAppliedTheme } from '@/lib/theme'
import { Sidebar, type PageId } from '@/components/Sidebar'
import { useEntryEditor } from '@/components/EntryEditor'
import { Splash } from '@/components/Splash'
import { Overview } from '@/pages/Overview'
import { MonthView } from '@/pages/MonthView'
import { YearView } from '@/pages/YearView'
import { Entries } from '@/pages/Entries'
import { Categories } from '@/pages/Categories'
import { Settings } from '@/pages/Settings'

const PAGE_KEY = 'finanztracker-page'
const PAGES: PageId[] = ['overview', 'month', 'year', 'entries', 'categories', 'settings']

function initialPage(): PageId {
  try {
    const stored = localStorage.getItem(PAGE_KEY) as PageId | null
    return stored && PAGES.includes(stored) ? stored : 'overview'
  } catch {
    return 'overview'
  }
}

export function App() {
  const { data, loaded, loadError, saveError } = useStore()
  const editor = useEntryEditor()
  const dark = useAppliedTheme(data.settings.theme, loaded)
  const [page, setPage] = useState<PageId>(initialPage)
  const mainRef = useRef<HTMLElement>(null)

  const navigate = (next: PageId) => {
    setPage(next)
    mainRef.current?.scrollTo({ top: 0 })
    try {
      localStorage.setItem(PAGE_KEY, next)
    } catch {
      // only a convenience
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && !document.querySelector('.overlay')) {
        e.preventDefault()
        editor.create('expense')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editor])

  // The first page animates in only once the start-up screen fades out.
  const [booted, setBooted] = useState(false)
  const onSplashExit = useCallback(() => setBooted(true), [])

  let content: ReactNode = null
  if (loadError) {
    content = (
      <div className="loading">
        <div className="alert bad" style={{ maxWidth: 560 }}>
          <AlertTriangle size={18} style={{ flex: 'none' }} />
          <div>
            <strong>Die Daten konnten nicht geladen werden.</strong>
            <div>{loadError}</div>
            <div style={{ marginTop: 6 }}>Es wurde nichts verändert oder überschrieben.</div>
          </div>
        </div>
      </div>
    )
  } else if (loaded) {
    content = (
      <div className="app">
        <Sidebar page={page} onNavigate={navigate} />
        <main className="main" ref={mainRef}>
          {saveError && (
            <div className="page" style={{ paddingBottom: 0 }}>
              <div className="alert bad">
                <AlertTriangle size={17} style={{ flex: 'none' }} />
                <div>Speichern fehlgeschlagen: {saveError}</div>
              </div>
            </div>
          )}
          <div key={`${page}-${booted}`} className="page-enter">
            {page === 'overview' && <Overview />}
            {page === 'month' && <MonthView />}
            {page === 'year' && <YearView />}
            {page === 'entries' && <Entries />}
            {page === 'categories' && <Categories />}
            {page === 'settings' && <Settings />}
          </div>
        </main>
      </div>
    )
  }

  return (
    <DarkContext.Provider value={dark}>
      {content}
      <Splash ready={loaded || Boolean(loadError)} onExit={onSplashExit} />
    </DarkContext.Provider>
  )
}
