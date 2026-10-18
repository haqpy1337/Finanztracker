import { useState } from 'react'
import { Download, FolderOpen, RefreshCw, RotateCcw, Upload } from 'lucide-react'
import type { ThemePreference } from '@shared/types'
import { emptyData, sampleData } from '@shared/defaults'
import { parseIso, todayIso } from '@shared/calc'
import { useStore } from '@/lib/store'
import { useToast } from '@/lib/toast'
import { api } from '@/lib/api'
import { amountInput, parseAmount } from '@/lib/format'
import { entriesToCsv } from '@/lib/derive'
import { describeUpdate, useAppVersion, useUpdateStatus } from '@/lib/updates'
import { Card, ConfirmDialog, PageHeader, Segmented } from '@/components/ui'

export function Settings() {
  const { data, updateSettings, replaceData } = useStore()
  const toast = useToast()
  const update = useUpdateStatus()
  const version = useAppVersion()
  const [budgetText, setBudgetText] = useState(amountInput(data.settings.monthlyBudget))
  const [confirm, setConfirm] = useState<'reset' | 'sample' | null>(null)
  const { y, m } = parseIso(todayIso())

  const saveBudget = () => {
    const value = parseAmount(budgetText) ?? 0
    updateSettings({ monthlyBudget: value })
    setBudgetText(amountInput(value))
  }

  const doImport = async () => {
    try {
      const imported = await api.importJson()
      if (!imported) return
      replaceData(imported)
      toast({ message: `${imported.entries.length} Posten${imported.assets.length ? ` und ${imported.assets.length} Anlagen` : ''} importiert` })
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : 'Import fehlgeschlagen' })
    }
  }

  return (
    <div className="page">
      <PageHeader title="Einstellungen" />
      <div className="stack" style={{ maxWidth: 900 }}>
        <Card title="Darstellung" flush>
          <div className="settings-row">
            <div>
              <div>Farbschema</div>
              <div className="desc">„System“ folgt der Einstellung von Windows.</div>
            </div>
            <div className="controls">
              <Segmented<ThemePreference>
                value={data.settings.theme}
                onChange={(theme) => updateSettings({ theme })}
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Hell' },
                  { value: 'dark', label: 'Dunkel' }
                ]}
              />
            </div>
          </div>
        </Card>

        <Card title="Budget" flush>
          <div className="settings-row">
            <div>
              <div>Monatliches Ausgabenbudget</div>
              <div className="desc">Übersicht und Monatsübersicht zeigen, wie viel davon verbraucht ist. Leer lassen zum Abschalten.</div>
            </div>
            <div className="controls">
              <div className="amount-input" style={{ width: 150 }}>
                <input
                  className="input num"
                  value={budgetText}
                  placeholder="kein Budget"
                  onChange={(e) => setBudgetText(e.target.value)}
                  onBlur={saveBudget}
                  onKeyDown={(e) => e.key === 'Enter' && saveBudget()}
                />
                <span>€</span>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Daten" hint="Alles wird nur lokal auf diesem PC gespeichert. Die App sichert die Daten automatisch: täglich, vor jedem Update und vor Import oder Zurücksetzen." flush>
          <div className="settings-row">
            <div>
              <div>Sicherung exportieren</div>
              <div className="desc">Speichert alle Posten, Anlagen, Kategorien und Einstellungen als JSON-Datei.</div>
            </div>
            <div className="controls">
              <button
                className="btn"
                onClick={async () => {
                  const path = await api.exportJson(data)
                  if (path) toast({ message: 'Sicherung gespeichert' })
                }}
              >
                <Download size={15} />
                Exportieren
              </button>
            </div>
          </div>
          <div className="settings-row">
            <div>
              <div>Sicherung importieren</div>
              <div className="desc">Ersetzt die aktuellen Daten durch den Inhalt einer exportierten JSON-Datei.</div>
            </div>
            <div className="controls">
              <button className="btn" onClick={doImport}>
                <Upload size={15} />
                Importieren
              </button>
            </div>
          </div>
          <div className="settings-row">
            <div>
              <div>Für Excel exportieren</div>
              <div className="desc">Alle Posten als CSV-Tabelle.</div>
            </div>
            <div className="controls">
              <button
                className="btn"
                disabled={data.entries.length === 0}
                onClick={async () => {
                  const path = await api.exportCsv(entriesToCsv(data, todayIso()))
                  if (path) toast({ message: 'CSV-Datei gespeichert' })
                }}
              >
                <Download size={15} />
                CSV
              </button>
            </div>
          </div>
          <div className="settings-row">
            <div>
              <div>Datenordner</div>
              <div className="desc">Öffnet den Ordner mit der Datendatei und den automatischen Sicherungen.</div>
            </div>
            <div className="controls">
              <button className="btn" onClick={() => void api.openDataFolder()}>
                <FolderOpen size={15} />
                Öffnen
              </button>
            </div>
          </div>
          <div className="settings-row">
            <div>
              <div>Beispieldaten laden</div>
              <div className="desc">Füllt die App mit typischen Beispielposten und -anlagen zum Ausprobieren. Ersetzt die aktuellen Daten.</div>
            </div>
            <div className="controls">
              <button className="btn" onClick={() => setConfirm('sample')}>
                Laden
              </button>
            </div>
          </div>
          <div className="settings-row">
            <div>
              <div>Alle Daten löschen</div>
              <div className="desc">Entfernt alle Posten und Anlagen und setzt die Kategorien zurück.</div>
            </div>
            <div className="controls">
              <button className="btn text-bad" onClick={() => setConfirm('reset')}>
                <RotateCcw size={15} />
                Zurücksetzen
              </button>
            </div>
          </div>
        </Card>

        <Card title="Updates" flush>
          <div className="settings-row">
            <div>
              <div>Version {version}</div>
              <div className="desc">{describeUpdate(update)}</div>
              {update.state === 'error' && update.detail && (
                <div className="desc" style={{ fontFamily: 'Consolas, monospace', fontSize: 12, marginTop: 4, wordBreak: 'break-word' }}>
                  {update.detail}
                </div>
              )}
            </div>
            <div className="controls">
              <button className="btn ghost" onClick={() => void api.openLog()}>
                Protokoll öffnen
              </button>
              {update.state === 'ready' ? (
                <button className="btn primary" onClick={() => void api.installUpdate()}>
                  Jetzt neu starten
                </button>
              ) : (
                <button
                  className="btn"
                  disabled={update.state === 'disabled' || update.state === 'checking' || update.state === 'downloading'}
                  onClick={() => void api.checkForUpdates()}
                >
                  <RefreshCw size={15} />
                  Nach Updates suchen
                </button>
              )}
            </div>
          </div>
        </Card>
      </div>

      {confirm === 'reset' && (
        <ConfirmDialog
          title="Alle Daten löschen?"
          text="Alle Posten, Anlagen und eigenen Kategorien werden entfernt. Vorher wird eine Sicherung im Datenordner angelegt."
          confirmLabel="Alles löschen"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await api.backupNow('zuruecksetzen')
            replaceData({ ...emptyData(), settings: data.settings })
            toast({ message: 'Alle Daten wurden gelöscht' })
          }}
        />
      )}
      {confirm === 'sample' && (
        <ConfirmDialog
          title="Beispieldaten laden?"
          text="Deine aktuellen Posten und Anlagen werden durch Beispieldaten ersetzt. Vorher wird eine Sicherung im Datenordner angelegt."
          confirmLabel="Beispieldaten laden"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await api.backupNow('beispieldaten')
            replaceData({ ...sampleData({ y, m }), settings: data.settings })
          }}
        />
      )}
    </div>
  )
}
