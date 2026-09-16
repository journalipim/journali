# journali — Arbeitsregeln

Taloan ist alleiniger Entwickler und schreibt deutsch. Antworten auf Deutsch.
Code englisch, Kommentare und Dokumentation deutsch.

## Regel 1: Keine Behauptung ohne Beleg im selben Zug

Vor jeder Aussage über eine Regel, eine Reihenfolge, eine Zahl oder eine
Ursache: **nachsehen.** Ein Beleg ist ein `grep`, eine gelesene Codezeile
oder eine Messung — aus diesem Zug, nicht aus der Erinnerung. Was nicht
belegt ist, wird nicht behauptet; eine Vermutung ist als Vermutung
gekennzeichnet, mit dem Hinweis, was sie belegen würde.

Wird eine Aussage doch falsch: in einem Satz sagen, was stattdessen gilt,
und weiterarbeiten. Keine Entschuldigung, keine Herleitung.

## Regel 2: Das Journal ist die Wahrheit

`docs/architektur.md` ist verbindlich. Kein Schreibpfad an der
`IJournal.Append` vorbei; kein Abbild, das nicht aus dem Journal neu
gebaut werden kann. Ein Eintragstyp ist für immer — neue Typen sind
billig, geänderte teuer, gelöschte unmöglich.

## Arbeitsweise

- **Keine Pausen bei Mehrfachaufträgen.** Alles durcharbeiten, erst am Ende
  berichten.
- **Das Programm nie selbst starten.**
- **Änderungen mit Python-Patchskripten** über das Write-Werkzeug, nicht mit
  Bash-Heredocs. Anker eindeutig (`assert count == 1`), BOM und CRLF je
  Datei erhalten.
- **Vor dem Commit:** `dotnet build -c Release` mit 0 Fehlern.
- Branch ist `master`. Git-Identität ist pro Repo gesetzt.

## Aufbau

- `Journali.Core` — net8.0, **keine NuGet-Pakete**, engine-frei: Journal,
  Einträge, Abbilder
- `Journali.Sandbox` — Konsole zum Nachrechnen
- `docs/architektur.md` — das Prinzip, die Schichten, die Achsen, was offen ist
