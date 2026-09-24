# journali — Arbeitsregeln

Ein Entwickler, Projektsprache Deutsch. Antworten auf Deutsch.
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
`docs/pflegestruktur.md` ist der Entwurf dazu; Entscheidungen
stehen dort als solche markiert.

## Regel 3: Keine Namen, keine Zitate, keine fremden Produkte

Das Projekt ist abstrakt. Nirgends — nicht in Oberflächentexten, nicht in Kommentaren, nicht in
Dokumenten, nicht in Commits — steht ein Name, ein Zitat oder eine Beschreibung, wer sich etwas
gewünscht oder entschieden hat. Eine Entscheidung wird sachlich begründet und trägt höchstens ein
Datum. Fremde Produkte und Firmen kommen nicht als Vergleich oder Massstab vor; technische Namen
angebundener Systeme (Solr, Excel, OnlyOffice, DeepL, ETIM, Postgres, Docker) sind davon nicht
gemeint. In Commits keine Zeile „Co-Authored-By“ — es gibt einen Beitragenden.
`web/tools/namen-entfernen.py` räumt Altbestand auf.

## Regel 4: Sachliches Deutsch

Handbuch- und Entwicklerdeutsch, im Chat wie im Quelltext, in Kommentaren, Dokumenten und Oberflächentexten.
Keine Bilder, keine Metaphern, keine gehobene Sprache: ein Tarif **enthält** ein Plugin (er „trägt“ es nicht),
eine Grenze **gilt** (sie „steht“ nicht da), ein Wert **wird gelöscht** (er „verschwindet“ nicht). Wo ein
gewöhnliches Wort reicht, steht das gewöhnliche Wort.

## Arbeitsweise

- **Keine Pausen bei Mehrfachaufträgen.** Alles durcharbeiten, erst am Ende
  berichten.
- **Das Programm nie selbst starten.** Läuft es,
  dürfen die Endpunkte mit curl geprüft werden.
- **Änderungen mit Python-Patchskripten** über das Write-Werkzeug, nicht mit
  Bash-Heredocs. Anker eindeutig (`assert count == 1`), BOM und CRLF je
  Datei erhalten.
- **Nach jedem `git pull`:** `npm install` in `web/` (die andere Sitzung bringt neue Pakete mit — sonst
  brechen Tests mit `ERR_MODULE_NOT_FOUND`), dann `dotnet build -c Release` und beide Testläufe.
- **Vor dem Commit:** `dotnet build -c Release` mit 0 Fehlern, `dotnet test Journali.Tests` (Kern) und
  `npm test` in `web/` grün. **Oberfläche wird geprüft, nicht vorgeführt**: jeder Dialog und jedes
  Fenster, das wir anfassen, bekommt einen Test in `web/test/ui-*.test.mjs` — echtes DOM (happy-dom), echte Komponente
  (@vue/test-utils, `test/vue-loader.mjs` übersetzt .vue), Klicks und Tasten wie beim Anwender; Hilfen in `test/ui.mjs`. **Use Cases testen, nicht von Hand klicken lassen:**
  jeder Fall, der in der Bedienung schiefging, wird ein Test.
- **Anwender & Rollen:** In der Oberfläche heisst eine Person **Anwender**, nie Benutzer.
  Identität/Rolle im Journal (`user:<key>`), Rollen mit Rechten im Journal (`role:<key>`,
  Vokabular `Rights` im Kern, `Auth.Needed` sagt je Anfrage das Recht), Passwörter/Token/Sitzungen
  im Tresor (`Tresor.cs`: Tabelle `tresor`, dazu Mailserver und Job-Geheimnisse; ohne Datenbank Dateien). Ohne Anwender offen; mit Anwendern kommt
  `X-Actor` aus der Sitzung. Jobs bekommen `JOURNALI_TOKEN` (Bearer) je Lauf.
- **Kein Passwort im Repo.** Die Datenbankverbindung gibt man einmal je Server im Einrichtungsdialog ein (`db.json` im
  Datenverzeichnis, `Einrichtung.cs`), im Paket kommt sie aus `.env`/`compose.yaml`; `.env` ist ignoriert. Nur als
  Paket betrieben — `dotnet run` ist Entwicklung.
- Branch ist `master`. Git-Identität ist pro Repo gesetzt.

## Aufbau

- `Journali.Core` — net8.0, **keine NuGet-Pakete**, engine-frei: Journal,
  Einträge, Abbilder
- `Journali.Sandbox` — Konsole zum Nachrechnen
- `Journali.Server` — ASP.NET Core Minimal API, net8.0; zwei Pakete, beide für
  Protokolle, die man nicht selbst schreibt: **Npgsql** (Datenbank) und
  **MailKit** (SMTP, seit 23.09. — `SmtpClient` aus .NET kann kein implizites TLS
  auf 465, und bei vielen Hostern ist das der einzige Weg). Weitere Pakete sind
  eine Entscheidung, nicht eine Bequemlichkeit.
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
  Beitragspunkte: views (mit `needs` — die Kachel erscheint nur, solange das genannte Plugin wirkt — und `props`),
  nodeActions, importers, checks, nodeBands (Band in der Knotenansicht),
  install(ctx) (einmal beim Einschalten: legt an, was das Plugin braucht); Plugin-Daten im
  Journal (`PluginDataSet`, `ctx.data`); Profile je Import-Plugin
  (`ProfileBar`); im Job-Dialog steht bei gewähltem Profil nur, was am Job hängt
  (Profil, Pfade, Schalter) — ein Parameter mit `perJob: true` bleibt immer sichtbar.
  **Zertifikat:** `certificate.json` neben dem Manifest (`docs/plugins-zertifizierung.md`); wer ein Plugin
  ändert, signiert es vor dem Commit neu (`node tools/plugin-cert.mjs sign <key>`, nach dem Bau) — der Kern-Test
  `Core_Plugins_mit_Zertifikat_sind_gueltig` prüft alle Siegel im Repo. **Core-Plugins** sind die mit journali
  ausgelieferten (nicht zu verwechseln mit **Basis-Plugins**, die eine Gruppe der Leiste tragen). Der private Schlüssel liegt nie im Repo.
  **Keine Kundendaten** (Adressen, Wurzeln) in Manifesten,
  Ansichten oder READMEs — die gehören in ein Profil. **Kein Name, kein Zitat**
  in dem, was der Anwender liest, und **keine Belehrung**: eine
  Beschreibung sagt sachlich, was das Plugin tut und was es braucht — keine
  Begründung, kein Beispiel aus dem Alltag, keine Rechtfertigung („ein 200-MB-TIFF
  rechnet man nicht um, während jemand wartet“ gehört in den Quelltext, nicht ins
  Manifest). Im Quelltext bleibt beides (Prüfstand `kein-name.test.mjs`)
- `web` — Vue 3 + Vite, Fat-Client-Gefühl: keine Seitenwechsel, Inline-
  Bearbeitung in der Zelle, Tastatur durch Listen, Journal lebendig daneben.
  Symbole und Zahlen statt Wörter in Kacheln, Knöpfen, Zeilen; Sätze nur im
  Tooltip — **ein sichtbarer Text ist höchstens ein Satz**, alles Weitere steht in
  `title=` (Prüfstand `sichtbare-texte.test.mjs`). Positiv grün, negativ rot.
  **Eine Meldung sagt, was ist — nicht, was der Anwender zu tun hat**. Kein „bitte“,
  kein „erst …“, kein Ratschlag; ein Satz. Gilt auch für die Meldungen des
  Servers — Prüfstand `servermeldungen.test.mjs` liest `Bad("…")`, `Err("…")` und `error = "…"`
  aus `Journali.Server`. **Eine Servermeldung ist eine Vorlage**: `Bad("Plugin {0} fehlt.", key)`, nie `Bad($"…")` —
  die Oberfläche übersetzt die Vorlage (Schlüssel = deutscher Text in `en.json`) und setzt die Werte ein.
  **Eine Überschrift ist ein Name und eine Zahl**: der Beisatz nach
  dem `·` zählt auf oder zählt ab — er erklärt nichts, begründet nichts, bewertet
  nichts („· gemessen, nicht geschätzt“ ist die Antwort auf einen Einwand, den
  niemand erhoben hat). Wer erklären will, schreibt es in `title=` der Überschrift.
  Prüfstand: `ui-section-stil.test.mjs`.
  **Grenzen stehen positiv da**: „Verfügbare Limits“, nicht „Nutzung
  gegen die Limits“; „verfügbarer Speicherplatz“, nicht „gemessen gegen die
  Speicherplatzgrenze“. **Ein Balken ist trotzdem ein Füllstand und füllt sich** mit
  dem, was genutzt wurde — Zahl, Balken und Prozent zeigen dasselbe.
  Was verfügbar ist, steht als eigene Zeile darüber und im Tooltip. Angst macht eine
  Oberfläche nirgends.
  **Einstellungen: ein Reiter je Sache**: ◐ Ich (Darstellung, Sicht,
  dieser Rechner, mein Konto mit Passwort und **meinen API-Token** — die gehören zur
  Person, nicht zum Team) · ◍ Team (Mitglieder, KI-Schlüssel, journali-Token gegen die
  Limits **und die Lizenz** — Limits und Gekauftes hängen am Team) · ◈ IAM
  (Anwenderkonten, Rollen, Rechte, Teams anlegen) · ⚑ Workflows · ▨ Storage ·
  ▩ Assets (Ableitungen, Bestand — getrennt, weil das später auch ein Medienmanager
  pflegen darf) · ✉ Mail · ⇅ B&R (Sichern von Hand und zurück — jeder Tarif; als
  Zeitplan ist es ein Job des Plugins `backup`, ab Pro) · ⚑ Workflows.
  **Tarife**: `Tarife.cs` im Kern — Kostenlos, Pro, Pro+, Enterprise,
  Unlimited. Grenzen je Team, Plugins und Publikationsbäume nach dem höchsten Tarif der
  Instanz; drei Monate Enterprise ab dem ersten Journaleintrag.
  Die Abschnitte des Team-Tabs stehen fest: ◍ {Teamname} · ⚿ journali
  Lizenz · ✦ journali Limits · ✧ KI API Keys · ✧ KI Austauschvolumen — erst, was
  journali betrifft, dann die fremde KI.
  **Was der Rechner selbst tun kann, tut er**: kein Knopf, zu dem
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
  **Ohne Kontingent keine Pflege**: abgewiesen wird **jeder Eintrag,
  der journali-Token kostet** (`Kinds.Counts`: Datenpflege und Ausleitung) — nicht
  jede schreibende Anfrage. Modellieren, Strukturieren, Kataloge, Einrichtung und
  Betrieb kosten nichts und gehen weiter. Die Sperre sitzt am **Schreibpfad**
  (`Catalog.With` → `KeinKontingentException` → 403), weil erst dort der Eintragstyp
  feststeht. Kein Kontingent hat, wer in keinem Team ist oder dessen Zahlerkette bei
  0 endet; Jobs (`job:<key>`) und das System sind nicht gemeint.
  **Die Limits ergeben sich aus dem Tarif der Lizenz** — nirgends ein Eingabefeld, und die Lizenz trägt keine eigenen
  Zahlen (`Tarife.cs` sagt sie; `Licence.Week`/`.Month`): das Init Team trägt die Limits der
  Anlage, jedes weitere hat, was die Lizenz ihm namentlich zuschreibt (`teams` in
  `licence.json`), sonst nichts; dann rechnet es über ein anderes Team ab.
  **Führen und dazugehören sind zweierlei**: man kann Manager
  mehrerer Teams sein, aber **Mitglied nur eines** — der IT-Administrator von
  Südeuropa führt Spanien, Frankreich und Portugal und sitzt in Team Deutschland.
  Die Balken in der Statusleiste zeigen immer das Team der **Mitgliedschaft**, am
  Ende der Zahlerkette. Ein Team kann über ein anderes abrechnen, das selbst über
  ein drittes abrechnet; **Kreise sind verboten** (a→b→a, a→b→c→a) und werden beim
  Setzen abgelehnt (`Teams.WaereKreis`).
- `docs/architektur.md` — das Prinzip, die Schichten, die Achsen, was offen ist
