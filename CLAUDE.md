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
billig, geänderte teuer, gelöschte unmöglich. **Auch das Modell** (Sprachen,
Kanäle, Einheiten, Attributgruppen, Attribute, Wörterbücher, Sichten) steht
im Journal, nie im Code:
`Model.Seeds()` ist nur das Saatgut für ein leeres Journal.
`docs/pflegestruktur.md` ist der Entwurf dazu; Entscheidungen von Taloan
stehen dort als solche markiert.

## Arbeitsweise

- **Keine Pausen bei Mehrfachaufträgen.** Alles durcharbeiten, erst am Ende
  berichten.
- **Das Programm nie selbst starten.** Läuft es (Taloan hat es gestartet),
  dürfen die Endpunkte mit curl geprüft werden.
- **Änderungen mit Python-Patchskripten** über das Write-Werkzeug, nicht mit
  Bash-Heredocs. Anker eindeutig (`assert count == 1`), BOM und CRLF je
  Datei erhalten.
- **Vor dem Commit:** `dotnet build -c Release` mit 0 Fehlern.
- **Benutzer & Rollen:** Identität/Rolle im Journal (`user:<key>`), Passwörter/Token/Sitzungen
  in `auth.json` im Datenverzeichnis (`Auth.cs`). Ohne Benutzer offen; mit Benutzern kommt
  `X-Actor` aus der Sitzung. Jobs bekommen `JOURNALI_TOKEN` (Bearer) je Lauf.
- **Kein Passwort im Repo.** Das Datenbankpasswort kommt aus user-secrets
  (`JOURNALI_DB_PASSWORD`) oder der Umgebung; `.env` ist ignoriert.
- Branch ist `master`. Git-Identität ist pro Repo gesetzt.

## Aufbau

- `Journali.Core` — net8.0, **keine NuGet-Pakete**, engine-frei: Journal,
  Einträge, Abbilder
- `Journali.Sandbox` — Konsole zum Nachrechnen
- `Journali.Server` — ASP.NET Core Minimal API, net8.0, einziges Paket
  Npgsql: `PostgresJournal` hinter `IJournal`, `Catalog` als einziger
  Schreibpfad (Eintrag + Abbilder `ModelCatalog` und `Tree` unter einer
  Sperre), `ModelApi` und `TreeApi` unter `/api`, Oberfläche aus `wwwroot`;
  `docs/betrieb.md`, `docs/eintraege.md`
- `plugins/<key>/` — ein Plugin je Verzeichnis mit `plugin.json` (key, version,
  label, kind, runs: browser | process, entry oder process.command/args/params,
  builtin, autoInstall); Stand (installiert, Fassung, an/aus) im Journal
  `plugin:<key>`, Verwaltung unter ⌁ Plugins (`PluginApi.cs`, `plugins.js`).
  Laufen nie im Serverprozess: Browser-Plugins als ES-Modul in der Oberfläche,
  Prozess-Plugins als Kindprozess des Servers, beide nur über `/api`.
  **Basis-Plugins** (`base: [Gruppen]`) bringen die Grundfunktion einer Gruppe der Leiste
  mit und sind der Container für Ergänzungen (`requires`): `table` (Import/Export Tabelle),
  `da` (Datenanalyse), `tasker` (Jobs). Ergänzungen: `csv`, `xlsx`, `json`, `ixp`, `solr` →
  table; `dpp`, `ppwr` → da; `backup`, `export` (Job) → tasker; `datasheet` eigene Gruppe.
  Plugins mit Vue-Ansichten haben `src/` und ein gebautes `entry.js` (im Repo; `npm run
  build` in `web/` baut Oberfläche und Plugins, `node build-plugins.mjs <key>` eines) —
  sie importieren `vue`, `vue-router`, `journali` und teilen die Instanzen der Oberfläche
  (`web/src/host.js`). Im Container liegt `plugins/` als Bind-Mount: austauschen ohne Image
  Beitragspunkte: views, nodeActions, importers, checks; Plugin-Daten im
  Journal (`PluginDataSet`, `ctx.data`); Profile je Import-Plugin
  (`ProfileBar`). **Keine Kundendaten** (Adressen, Wurzeln) in Manifesten,
  Ansichten oder READMEs — die gehören in ein Profil
- `web` — Vue 3 + Vite, Fat-Client-Gefühl: keine Seitenwechsel, Inline-
  Bearbeitung in der Zelle, Tastatur durch Listen, Journal lebendig daneben.
  Symbole und Zahlen statt Wörter in Kacheln, Knöpfen, Zeilen; Sätze nur im
  Tooltip. Positiv grün, negativ rot.
- `docs/architektur.md` — das Prinzip, die Schichten, die Achsen, was offen ist
