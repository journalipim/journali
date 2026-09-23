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
- **Nach jedem `git pull`:** `npm install` in `web/` (die andere Sitzung bringt neue Pakete mit — sonst
  brechen Tests mit `ERR_MODULE_NOT_FOUND`), dann `dotnet build -c Release` und beide Testläufe.
- **Vor dem Commit:** `dotnet build -c Release` mit 0 Fehlern, `dotnet test Journali.Tests` (Kern) und
  `npm test` in `web/` grün. **Oberfläche wird geprüft, nicht vorgeführt** (Taloan, 22.09.): jeder Dialog und jedes
  Fenster, das wir anfassen, bekommt einen Test in `web/test/ui-*.test.mjs` — echtes DOM (happy-dom), echte Komponente
  (@vue/test-utils, `test/vue-loader.mjs` übersetzt .vue), Klicks und Tasten wie beim Anwender; Hilfen in `test/ui.mjs`. **Use Cases testen, nicht Taloan klicken lassen:**
  jeder Fall, der in der Bedienung schiefging, wird ein Test (Taloan, 21.09.).
- **Anwender & Rollen:** In der Oberfläche heisst eine Person **Anwender** (Taloan, 23.09.), nie Benutzer.
  Identität/Rolle im Journal (`user:<key>`), Rollen mit Rechten im Journal (`role:<key>`,
  Vokabular `Rights` im Kern, `Auth.Needed` sagt je Anfrage das Recht), Passwörter/Token/Sitzungen
  in `auth.json` im Datenverzeichnis (`Auth.cs`). Ohne Anwender offen; mit Anwendern kommt
  `X-Actor` aus der Sitzung. Jobs bekommen `JOURNALI_TOKEN` (Bearer) je Lauf.
- **Kein Passwort im Repo.** Das Datenbankpasswort kommt aus user-secrets
  (`JOURNALI_DB_PASSWORD`) oder der Umgebung; `.env` ist ignoriert.
- Branch ist `master`. Git-Identität ist pro Repo gesetzt.

## Aufbau

- `Journali.Core` — net8.0, **keine NuGet-Pakete**, engine-frei: Journal,
  Einträge, Abbilder
- `Journali.Sandbox` — Konsole zum Nachrechnen
- `Journali.Server` — ASP.NET Core Minimal API, net8.0; zwei Pakete, beide für
  Protokolle, die man nicht selbst schreibt: **Npgsql** (Datenbank) und
  **MailKit** (SMTP, seit 23.09. — `SmtpClient` aus .NET kann kein implizites TLS
  auf 465, und bei vielen Hostern ist das der einzige Weg). Weitere Pakete sind
  eine Entscheidung von Taloan, nicht eine Bequemlichkeit.
  `PostgresJournal` hinter `IJournal`, `Catalog` als einziger
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
  Beitragspunkte: views, nodeActions, importers, checks, nodeBands (Band in der Knotenansicht),
  install(ctx) (einmal beim Einschalten: legt an, was das Plugin braucht); Plugin-Daten im
  Journal (`PluginDataSet`, `ctx.data`); Profile je Import-Plugin
  (`ProfileBar`); im Job-Dialog steht bei gewähltem Profil nur, was am Job hängt
  (Profil, Pfade, Schalter) — ein Parameter mit `perJob: true` bleibt immer sichtbar.
  **Keine Kundendaten** (Adressen, Wurzeln) in Manifesten,
  Ansichten oder READMEs — die gehören in ein Profil. **Kein Name, kein Zitat**
  in dem, was der Anwender liest (Taloan, 23.09.), und **keine Belehrung**: eine
  Beschreibung sagt sachlich, was das Plugin tut und was es braucht — keine
  Begründung, kein Beispiel aus dem Alltag, keine Rechtfertigung („ein 200-MB-TIFF
  rechnet man nicht um, während jemand wartet“ gehört in den Quelltext, nicht ins
  Manifest). Im Quelltext bleibt beides (Prüfstand `kein-name.test.mjs`)
- `web` — Vue 3 + Vite, Fat-Client-Gefühl: keine Seitenwechsel, Inline-
  Bearbeitung in der Zelle, Tastatur durch Listen, Journal lebendig daneben.
  Symbole und Zahlen statt Wörter in Kacheln, Knöpfen, Zeilen; Sätze nur im
  Tooltip — **ein sichtbarer Text ist höchstens ein Satz**, alles Weitere steht in
  `title=` (Prüfstand `sichtbare-texte.test.mjs`). Positiv grün, negativ rot.
  **Eine Überschrift ist ein Name und eine Zahl** (Taloan, 23.09.): der Beisatz nach
  dem `·` zählt auf oder zählt ab — er erklärt nichts, begründet nichts, bewertet
  nichts („· gemessen, nicht geschätzt“ ist die Antwort auf einen Einwand, den
  niemand erhoben hat). Wer erklären will, schreibt es in `title=` der Überschrift.
  Prüfstand: `ui-section-stil.test.mjs`.
  **Grenzen stehen positiv da** (Taloan, 23.09.): „Verfügbare Limits“, nicht „Nutzung
  gegen die Limits“; „verfügbarer Speicherplatz“, nicht „gemessen gegen die
  Speicherplatzgrenze“. Balken zeigen, was noch da ist, und leeren sich; die grosse
  Zahl ist der Rest, das Genutzte steht klein daneben. Angst macht eine Oberfläche
  nirgends.
  **Einstellungen: ein Reiter je Sache** (Taloan, 23.09.): ◐ Ich (Darstellung, Sicht,
  dieser Rechner, mein Konto mit Passwort und **meinen API-Token** — die gehören zur
  Person, nicht zum Team) · ◍ Team (Mitglieder, KI-Schlüssel, journali-Token gegen die
  Limits **und die Lizenz** — Limits und Gekauftes hängen am Team) · ◈ Rollen &
  Rechte (Anwender, Rollen, Teams anlegen) · ▨ Storage (wo die Bytes liegen) ·
  ▩ Assets (Ableitungen, Bestand — getrennt, weil das später auch ein Medienmanager
  pflegen darf) · ✉ Mail · ▣ Backup & Recovery (nur der Weg **zurück**; gesichert wird
  als Job des Plugins `backup`) · ⚑ Workflows.
  Die Abschnitte des Team-Tabs stehen fest (Taloan, 23.09.): ◍ {Teamname} · ⚿ journali
  Lizenz · ✦ journali Limits · ✧ KI API Keys · ✧ KI Austauschvolumen — erst, was
  journali betrifft, dann die fremde KI.
  **Was der Rechner selbst tun kann, tut er** (Taloan, 23.09.): kein Knopf, zu dem
  jemand regelmässig hingehen muss. Ableitungen rechnet der Job nach jedem Hochladen
  **und** nach jeder Preset-Änderung; der Knopf ist der Nachzieher, nicht der Weg.
  Grundsatz: **wer mit seinen Rechten, Rollen und seinem Team hierher kommt, sieht,
  was er sehen oder ändern darf — alles andere sieht er nicht.** Kein gesperrter
  Abschnitt, kein Hinweis auf Verborgenes; ein Reiter ohne Abschnitt fällt weg.
  **Team** = eine Gruppe von Personen, die am Gesamtsystem mitarbeitet (keine Insel —
  wer Abschottung braucht, braucht ein eigenes System). Daran hängen KI-Schlüssel,
  Grenzen und Verbrauch, weil sie irgendwo hängen müssen. Jede Anlage bringt das
  **Init Team** mit (`team:init`, `Model.InitTeam`): nicht löschbar, umbenennbar,
  trägt das Grundkontingent; der erste Administrator gehört hinein, und wer kein
  eigenes Team trägt, arbeitet dort.
- `docs/architektur.md` — das Prinzip, die Schichten, die Achsen, was offen ist
