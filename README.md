# Finanztracker

Lokale Windows-Anwendung, um regelmäßige und einmalige Ausgaben im Blick zu behalten:
Miete, Strom, Wasser, Abos wie Netflix oder Amazon Prime, Versicherungen, geschätzte
Kosten wie Lebensmittel und auch Einnahmen. Alle Daten bleiben auf dem eigenen PC.

## Funktionen

- **Übersicht**: Fixkosten pro Monat und Jahr, Einnahmen, frei verfügbarer Betrag,
  Verteilung nach Kategorien, nächste Zahlungen, größte Posten, Trend der letzten 12 Monate
  und Hinweise auf bevorstehende Kündigungstermine.
- **Monatsübersicht**: alle in einem Monat fälligen Zahlungen mit Datum, Saldo, Vergleich
  zum Vormonat, Aufteilung nach Kategorie und nach festen, geschätzten und einmaligen Kosten.
- **Jahresübersicht**: Ausgaben je Monat nach Kategorie, Einnahmen als Linie, Tabelle
  Kategorie × Monat, Vergleich zum Vorjahr, Auswertung nach Zahlungsart und Zahlungsrhythmus.
- **Ausgaben & Einnahmen**: Posten anlegen, bearbeiten, duplizieren, pausieren und löschen
  (mit Rückgängig), Suche, Filter, Sortierung, CSV-Export für Excel.
- Intervalle: wöchentlich, monatlich, vierteljährlich, halbjährlich, jährlich, einmalig;
  optional mit Enddatum, Kündigungsfrist und Vertragsende.
- **Kategorien** frei anpassbar, **Einstellungen** für Hell/Dunkel, Monatsbudget,
  Export/Import und Beispieldaten.
- **Automatische Updates** beim Start über GitHub Releases.

## Daten

Die Daten liegen als JSON-Datei unter `%APPDATA%\Finanztracker\daten\finanztracker.json`.
Beim Start legt die App einmal täglich eine Sicherung in `daten\sicherungen` an und behält
die letzten 30. Ist die Datendatei beschädigt, lädt die App automatisch die neueste lesbare
Sicherung. Über *Einstellungen → Datenordner* lässt sich der Ordner direkt öffnen.

## Entwicklung

Voraussetzung: Node.js 22.

```bash
npm install
npm run dev        # App mit Hot Reload starten
npm test           # Tests der Berechnungen
npm run typecheck
npm run dist:win   # Installer lokal bauen (unter Windows)
```

Aufbau:

| Pfad | Inhalt |
| --- | --- |
| `src/main` | Electron-Hauptprozess: Fenster, Speicherung, Auto-Update |
| `src/preload` | sichere Brücke zwischen Oberfläche und Hauptprozess |
| `src/renderer` | Oberfläche (React) |
| `src/shared` | Datenmodell und Berechnungen (Fälligkeiten, Summen) |
| `tests` | Tests für `src/shared` |

## Neue Version veröffentlichen (Updates)

Updates kommen aus den GitHub Releases dieses Repositorys. Ein neues Release entsteht,
sobald ein Versions-Tag gepusht wird:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Der Workflow `.github/workflows/release.yml` baut dann auf einem Windows-Runner den
Installer, übernimmt die Versionsnummer aus dem Tag und veröffentlicht ihn samt
`latest.yml` als Release. Installierte Apps finden die neue Version beim nächsten Start,
laden sie im Hintergrund und installieren sie beim Beenden oder per Klick auf
*Jetzt neu starten*.

Damit das funktioniert, muss das Repository öffentlich bleiben, sonst können installierte
Apps die Releases nicht abrufen.

Der Installer ist nicht signiert. Windows SmartScreen zeigt deshalb beim ersten Start des
Installers einen Hinweis, der sich über *Weitere Informationen → Trotzdem ausführen*
bestätigen lässt.
