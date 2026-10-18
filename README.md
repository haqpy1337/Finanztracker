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
- Sonderzahlungen wie 13. und 14. Monatsgehalt in festen Monaten, die in Monats- und
  Jahresübersicht erscheinen und in den Monatsdurchschnitt einfließen.
- Schwankende Einnahmen wie Rufbereitschaft: Betrag pro Einheit (z. B. 500 € pro Woche) mal übliche
  Anzahl pro Monat, einzelne Monate lassen sich abweichend eintragen (z. B. 2 Wochen im November).
- **Kategorien** frei anpassbar, **Einstellungen** für Hell/Dunkel, Monatsbudget,
  Export/Import und Beispieldaten.
- **Automatische Updates** beim Start über GitHub Releases.

## Daten und Datensicherheit

Die Daten liegen als JSON-Datei unter `%APPDATA%\Finanztracker\daten\finanztracker.json`.
Installation, Updates und Deinstallation fassen diesen Ordner nicht an.

So bleiben die Daten auch über Updates hinweg unversehrt:

- **Sicherungen**: Bei jedem Versionswechsel legt die App vor dem ersten Laden eine
  dauerhafte Kopie an (`sicherungen\vor-update-<alt>-auf-<neu>_….json`), ebenso vor einer
  Umstellung des Datenformats, vor einem Import und vor dem Zurücksetzen. Diese Kopien
  werden nie automatisch gelöscht. Zusätzlich gibt es eine tägliche Sicherung (30 Tage).
- **Datenformat mit Versionsnummer**: Jede Änderung am Format bekommt eine neue Nummer und
  einen Umstellungsschritt (`src/shared/schema.ts`). Ältere Daten werden Schritt für Schritt
  umgestellt, ohne vorhandene Werte zu verändern. Felder, die eine Version nicht kennt,
  bleiben erhalten. Daten aus einer neueren Version werden nie überschrieben.
- **Sicheres Schreiben**: Gespeichert wird in eine temporäre Datei, die auf die Festplatte
  geschrieben und dann umbenannt wird. Ein Absturz oder Stromausfall hinterlässt so nie eine
  halbe Datei. Der vorige Stand bleibt als `finanztracker.json.bak` erhalten.
- **Kein Verlust beim Beenden**: Vor dem Schließen und vor der Installation eines Updates
  wartet die App, bis die letzten Änderungen gespeichert sind.
- **Beschädigte Datei**: Ist die Datei unlesbar, wird sie als `finanztracker.defekt_….json`
  aufbewahrt und der letzte lesbare Stand wiederhergestellt.
- **Tests**: `tests/data-safety.test.ts` prüft mit einer echten Datei aus Version 0.1.0, dass
  nach der Umstellung jeder Posten unverändert ist.

Über *Einstellungen → Datenordner* lässt sich der Ordner direkt öffnen.

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

Updates kommen aus den GitHub Releases dieses Repositorys. Für eine neue Version reicht es,
die Versionsnummer in `package.json` zu erhöhen (z. B. auf `0.2.0`) und auf `main` zu pushen.
Alternativ geht auch ein Tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

Der Workflow `.github/workflows/release.yml` prüft bei jedem Push, ob es für die Version
schon ein Release gibt. Wenn nicht, baut er auf einem Windows-Runner den Installer und
veröffentlicht ihn samt `latest.yml` als Release `v<Version>`. Installierte Apps finden die
neue Version beim nächsten Start, laden sie im Hintergrund und installieren sie beim Beenden
oder per Klick auf *Jetzt neu starten*.

Damit das funktioniert, muss das Repository öffentlich bleiben, sonst können installierte
Apps die Releases nicht abrufen.

Der Installer ist nicht signiert. Windows SmartScreen zeigt deshalb beim ersten Start des
Installers einen Hinweis, der sich über *Weitere Informationen → Trotzdem ausführen*
bestätigen lässt.
