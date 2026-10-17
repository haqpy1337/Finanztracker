import type { ReactNode } from 'react'
import { CalendarDays, CalendarRange, Download, LayoutDashboard, List, RefreshCw, Settings, Tags, Wallet } from 'lucide-react'
import { api } from '@/lib/api'
import { useAppVersion, useUpdateStatus } from '@/lib/updates'

export type PageId = 'overview' | 'month' | 'year' | 'entries' | 'categories' | 'settings'

const SECTIONS: Array<{ label: string; items: Array<{ id: PageId; label: string; icon: ReactNode }> }> = [
  {
    label: 'Auswertung',
    items: [
      { id: 'overview', label: 'Übersicht', icon: <LayoutDashboard size={17} /> },
      { id: 'month', label: 'Monatsübersicht', icon: <CalendarDays size={17} /> },
      { id: 'year', label: 'Jahresübersicht', icon: <CalendarRange size={17} /> }
    ]
  },
  {
    label: 'Verwalten',
    items: [
      { id: 'entries', label: 'Ausgaben & Einnahmen', icon: <List size={17} /> },
      { id: 'categories', label: 'Kategorien', icon: <Tags size={17} /> },
      { id: 'settings', label: 'Einstellungen', icon: <Settings size={17} /> }
    ]
  }
]

function UpdateBox() {
  const status = useUpdateStatus()
  if (status.state === 'downloading' || status.state === 'available') {
    const percent = status.state === 'downloading' ? status.percent : 0
    return (
      <div className="update-box">
        <div className="head">
          <Download size={14} />
          Update {status.version} wird geladen
        </div>
        <div className="progress">
          <div style={{ width: `${percent}%` }} />
        </div>
      </div>
    )
  }
  if (status.state === 'ready') {
    return (
      <div className="update-box ready">
        <div className="head">
          <RefreshCw size={14} />
          Update {status.version} bereit
        </div>
        <span>Wird beim Beenden installiert, oder sofort:</span>
        <button className="btn primary small" onClick={() => void api.installUpdate()}>
          Jetzt neu starten
        </button>
      </div>
    )
  }
  return null
}

export function Sidebar({ page, onNavigate }: { page: PageId; onNavigate(page: PageId): void }) {
  const version = useAppVersion()
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Wallet size={17} />
        </div>
        <div>
          <div className="brand-name">Finanztracker</div>
          <div className="brand-sub">Ausgaben im Blick</div>
        </div>
      </div>
      <nav>
        {SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="nav-label">{section.label}</div>
            {section.items.map((item) => (
              <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)} aria-current={page === item.id ? 'page' : undefined}>
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <UpdateBox />
        <div className="version">Version {version}</div>
      </div>
    </aside>
  )
}
