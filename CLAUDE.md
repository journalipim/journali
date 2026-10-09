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

## Regel 5: Der Lizenzserver bleibt draussen

Zwei Repos, und sie gehen verschiedene Wege:

| Repo | Gitea (privat) | GitHub (öffentlich) |
|---|---|---|
| `journali` | `origin` | `github` |
| `journali-lizenz` | `origin` | **nie** |

Dieses Repo wird veröffentlicht (ELv2) und hat darum beide Fernablagen — ein Commit geht nach `origin` **und**
nach `github`. Der Lizenzserver liegt ausschliesslich auf der Gitea und bekommt keine zweite Fernablage. **Nichts von dort kommt hierher** — kein Quelltext, kein privater
Ausstellerschlüssel, keine Datenbankzugänge, kein Webhook-Geheimnis, keine Shop-Varianten, keine Anleitung zum
vServer. Was journali braucht, ist das gemeinsame Format (`Journali.Core/Licensing/Vertrag.cs`) und der
**öffentliche** Schlüssel des Ausstellers (`Core.Licensing.Aussteller`); beides entsteht hier, nicht dort.

Umgekehrt bindet das Lizenz-Repo journali als Submodul `extern/journali` ein: dort wird nicht gearbeitet und
nicht gepusht. Eine Änderung am gemeinsamen Format entsteht hier, das Submodul zieht sie nach.

Genauso wenig gehören **eigene Adressen** in ein öffentliches Repo: Hostname, IP und Domain der Entwicklungs-
und Betriebsrechner. Eine Beispieladresse ist `localhost` oder ein Platzhalter, nicht der eigene Server.

## Regel 6: Gitea immer

Die Gitea (`origin`) ist die Ablage, die zählt: Sie baut die Images, aus denen der Betrieb aktualisiert wird, und sie
sichert die Arbeit. Ein abgeschlossenes Stück Arbeit (Build ohne Fehler, beide Testläufe grün) wird **sofort**
committet und nach `origin` gepusht — ohne Nachfrage und ohne zu warten, bis mehrere Themen zusammenkommen. Ein Commit
je Thema. GitHub (`github`) folgt danach; scheitert dieser Push, bleibt der nach Gitea bestehen. Ungepushte Arbeit ist
weder gesichert noch im Betrieb. Jede Antwort, die Arbeit abschliesst, nennt den Commit, bis zu dem `origin` steht.
Liegt `origin` mehr als ein Stück Arbeit hinter dem Rechner, ist das ein Fehler.

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
  **Brachte der Pull Änderungen, immer auch `npm run build` in `web/`** (Oberfläche und Plugins): Die Plugins
  liegen im Verzeichnis und sind sofort neu, das Paket der Oberfläche nicht — ein Plugin ruft dann Funktionen auf,
  die das alte Paket nicht kennt (`ctx.compliance.setup is not a function`). Nach dem Bau zeigt die Oberfläche
  „↻ Neue Version“; dem Anwender sagen, dass die Seite neu zu laden ist. Ohne Änderungen („Already up to date“) entfällt der Bau.
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
- **Paket dazu oder gewechselt** (in `web/` oder im Server): `node tools/lizenzen.mjs` erzeugt `licenses/oberflaeche` und
  `licenses/server` neu, und `THIRD-PARTY-NOTICES.md` nennt das Paket — Prüfstand `lizenzen.test.mjs`.
- **Kein Passwort im Repo.** Die Datenbankverbindung gibt man einmal je Server im Einrichtungsdialog ein (`db.json` im
  Datenverzeichnis, `Einrichtung.cs`), im Paket kommt sie aus `.env`/`compose.yaml`; `.env` ist ignoriert. Nur als
  Paket betrieben — `dotnet run` ist Entwicklung.
- Branch ist `master`. Git-Identität ist pro Repo gesetzt.
- **Mehrere Rechner, ein Repo** (09.10.2026): gearbeitet wird an mehr als einem Rechner, und die Sitzungen dort sehen einander nicht —
  gemeinsam ist nur das Repo (Erinnerungen einer Sitzung bleiben auf ihrem Rechner). Darum: **Startskripte liegen im Repo unter `tools\`**
  und heissen nach der Sache, auf jedem Rechner gleich — `tools\server` (journali), `tools\berater` (Dienst und Testseite des
  Produktberaters, Prüfstand), `tools\demo-daten`, `tools\site`. Keine Skripte ausserhalb des Repos, keine festen Pfade (`%~dp0`),
  Geheimnisse in `%USERPROFILE%\.journali\`. Braucht ein Rechner ein Skript, kommt es hierher, oder ein vorhandenes bekommt einen Befehl
  dazu. Ein angefangenes Thema steht in `docs/todo-<thema>.md` — dort liest die nächste Sitzung weiter, gleich an welchem Rechner.

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
  builtin, autoInstall); Stand (installiert, Version, an/aus) im Journal
  `plugin:<key>`, Verwaltung unter ⬡ Plugins (`PluginApi.cs`, `plugins.js`).
  Laufen nie im Serverprozess: Browser-Plugins als ES-Modul in der Oberfläche,
  Prozess-Plugins als Kindprozess des Servers, beide nur über `/api`. Eine Ausnahme: `embed/serve.mjs` hält der
  Server als Kindprozess vor und fragt ihn über stdin/stdout (`Embedder.cs`) — eine Suchfrage muss in denselben
  Vektorraum wie die Abschnitte, und das Modell gehört dem Plugin, nicht dem Server.
  **Basis-Plugins** (`base: [Gruppen]`) bringen die Grundfunktion einer Gruppe der Leiste
  mit und sind der Container für Ergänzungen (`requires`): `table` (Import/Export Tabelle),
  `da` (Datenanalyse), `tasker` (Jobs). Ergänzungen: `csv`, `excel`, `json`, `ixp`, `solr` →
  table; `dpp`, `ppwr` → da; `backup` (Job) → tasker; `datasheet` eigene Gruppe.
  **Ein Format, ein Plugin — auch als Job**: `csv` und `excel` bringen ihren Dienst `export` selbst mit
  (`export-job.mjs`, Kern in `table/export-job.mjs`); ein eigenes Plugin, das das Format als Parameter führt, gibt
  es nicht mehr (25.09.2026). **Im Profil steht, WAS** exportiert oder importiert wird (Teilbaum, Zuordnung,
  Sprachen, Sicht) — angelegt in der Ansicht des Plugins, nie im Job-Dialog: 180 Spalten mit Transformationen
  richtet dort niemand ein. **Am Job steht, WOHIN und WANN** (Verzeichnis, Dateiname, Zeitplan): dasselbe Profil
  darf wöchentlich in das eine und täglich in ein anderes Verzeichnis schreiben.
  **Ein Profil gehört einem Dienst**, nicht nur einem Plugin: es heißt `<dienst>:<name>` im Strom des Format-Plugins
  (`import:abc` bei `csv`), damit ein Exportprofil nicht in der Importauswahl steht. Der Tasker zeigt nur die des
  gewählten Dienstes und legt keine an — das tut die Ansicht des Plugins.
  **Vier Achsen, die nicht vermischt werden** (25.09.2026):
  1. **Format** — CSV, Excel, JSON, BMEcat nach Vorlage. Das ist das Plugin.
  2. **Transport** — wie die Bytes kommen: Dateisystem, HTTP, WebDAV, die API eines Fremdsystems. Eine CSV über
     WebDAV ist dieselbe CSV wie eine vom Laufwerk; der Transport gehört nicht ins Format.
  3. **Inhalt** — Zuordnung, Ziel im Baum, Umfang, Sprachen. Das ist das Profil.
  4. **Ablage und Zeit** — Verzeichnis, Dateiname, Zeitplan, Trockenlauf. Das ist der Job.

  **Skripte** (Plugin `scriptum`, `ScriptumApi.cs`, `docs/pflegestruktur.md` 37, 29.09.2026): ein Skript ist ein
  ES-Modul **im Journal** (`script:<key>` in den Plugin-Daten), nicht im Verzeichnis — geschrieben unter ⌨ Skripte,
  gelaufen als Job `scriptum_<key>` (Kindprozess, Log, Zeitgrenze, Fächer), nie im Serverprozess. Der Kopf
  (`export const meta`) ist das Formular, das Ergebnis eine Zeile auf stdout (Tabelle, Text oder Datei im Fach `out/`).
  Zwei Rechte: `scriptum.write` schreibt und liest den Quelltext (ein Administratorrecht), `scriptum.run` stösst an;
  am Skript steht, welches Recht sein Lauf braucht. Kein Geheimnis im Skript — dafür sind Zugänge und der Tresor da.
  **Ab Pro+**: weder Kostenlos noch Pro enthalten `scriptum` — ein Skript läuft als Prozess auf dem Server.

  **Attribut und Gruppe sind n:m** (29.09.2026, `docs/pflegestruktur.md` 36): eine Gruppe ist eine **Auswahl** von
  Attributen, kein Besitz — dasselbe Attribut gilt in beliebig vielen Gruppen, ohne Kopie. Die Menge steht im Journal
  (`AttributeGroupsSet`), `group` am Attribut zählt als Mitgliedschaft mit und bleibt die Heimatgruppe. Die **Pflicht
  bleibt am Attribut**: unterscheidet sie sich zwischen zwei Verwendungen, ist es ein anderes Attribut. Am Knoten steht
  ein Attribut einmal, auch wenn es über zwei geltende Gruppen hereinkommt.

  **Zugänge** (Plugin `driver`, `DriverApi.cs`, `/api/drivers`): ein Plugin fragt nach einem Zugang seiner Art
  („gib mir die vom Typ mysql“) statt selbst nach Adresse und Passwort. Zwei Sorten: einer, der **Dateien liefert**
  — mit Auflisten und Browser —, und einer, der nur **Anmeldung** ist. **Angeboten wird nur, was trägt**: Dateien
  liefern `file`, `webdav` und `ftp` (alle hinter `IDateiTreiber`, `Treiber.cs`), Anmeldungen sind `ixp` und `solr`
  (der Browser liest ihre Quelle über `/api/drivers/{zugang}/relay`). **Alle Arten gehören zum Plugin `driver`** —
  kein Plugin je Art (28.09.2026); mysql kommt, sobald ein Plugin es liest.
  Der Zugang ist **keine Schicht über der Datenbank**: er kennt kein SQL und keinen Index, das Plugin weiß, was es
  mit seiner Verbindung tut. Die offenen Felder stehen im Journal, das **Geheimnis beim Server** (Tresor) und geht
  **nur an einen Prozess**, nie an den Browser — die Liste nennt bloß seinen Namen. `lokal` ist eingebaut.

  *Gebaut ist davon:* beim Transport das Dateisystem (Pfad auf dem Server, bei Jobs die Fächer `in/` und `out/`),
  HTTP als Quelle beim JSON-Import und **Fächer an einem Zugang** (WebDAV, FTP): der Tasker holt den Eingang vor dem
  Lauf und legt die Ausgabe danach ab — das ist der allgemeine Transportweg, jedes Format-Plugin nutzt ihn, ohne
  davon zu wissen (`docs/tasker-dateien.md`). `ixp` und `solr` nehmen ihre Quelle aus einem Zugang: im Profil steht
  sein Name, im Job ein Parameter vom Typ `driver` (`JOURNALI_ZUGANG_*`); das Geheimnis bleibt beim Server — nie im
  Journal, denn dort lässt sich nichts löschen, und nie im Browser.
  **Ein Format, ein Plugin**: `csv`, `excel` und `json` bringen Import **und** Export ihres Formats mit — ihre Art
  ist `io` (⇵ Import / Export), nicht `import`. `ixp` und `solr` sind nur Import. Die Schlüssel der Office-Add-ins
  heißen `exceladdin` und `ooaddin` (25.09.2026), damit `excel` das Formatplugin ist.
  **Kein Präfix in der Bezeichnung**: die Art steht als eigene Spalte in ⑁ Plugins — ein Plugin heißt „Sicherung“,
  nicht „Werkzeug: Sicherung“.
  Plugins mit Vue-Ansichten haben `src/` und ein gebautes `entry.js` (im Repo; `npm run
  build` in `web/` baut Oberfläche und Plugins, `node build-plugins.mjs <key>` eines) —
  sie importieren `vue`, `vue-router`, `journali` und teilen die Instanzen der Oberfläche
  (`web/src/host.js`). Im Container liegt `plugins/` als Bind-Mount: austauschen ohne Image
  Beitragspunkte: views (mit `needs` — die Kachel erscheint nur, solange das genannte Plugin wirkt — und `props`),
  nodeActions, importers, checks, nodeBands (Band in der Knotenansicht),
  install(ctx) (einmal beim Einschalten: legt an, was das Plugin braucht);
  **Zustimmung im Manifest** (05.10.2026): `download` (eine Datei aus dem Netz beim ersten Lauf) und `acknowledge` (ein Hinweis,
  etwa „keine Rechtsberatung“) fragt ⬡ Plugins vor dem Einschalten ab; der Server schaltet nur mit `?download=ja` bzw.
  `?hinweis=<version>` ein, die Bestätigung steht als `PluginAcknowledged` im Journal, und ohne sie wirkt das Plugin nicht.
  **`health` im Manifest** (27.09.2026): die Adresse eines Endpunkts, der `{ ready, reason }` sagt — für Plugins mit
  Voraussetzungen, die niemand in journali setzt (eine Erweiterung der Datenbank, ein Modell, ein erreichbarer Dienst).
  ⑁ Plugins fragt ihn für jedes wirkende Plugin und zeigt den Zustand in der Spalte: `◑ an, nicht bereit`, der Grund im
  Tooltip und im Kopf. So steht die Voraussetzung nicht als Satz in der Beschreibung, sondern als Zustand da; Plugin-Daten im
  Journal (`PluginDataSet`, `ctx.data`); Profile je Import-Plugin
  (`ProfileBar`); im Job-Dialog steht bei gewähltem Profil nur, was am Job hängt
  (Profil, Pfade, Schalter) — ein Parameter mit `perJob: true` bleibt immer sichtbar. Der Job-Dialog legt **keine
  Profile an**: den generischen Profil-Editor gibt es nicht mehr, seit `rag` eine eigene Ansicht hat (28.09.2026).
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
  Manifest). Im Quelltext bleibt beides (Prüfstand `sichtbare-texte.test.mjs`)
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
  **Einstellungen: ein Reiter je Sache**: ◐ Mein Account (Darstellung, Sicht,
  dieser Rechner, mein Konto mit Passwort und **meinen API-Token** — die gehören zur
  Person, nicht zum Team) · ◍ Team (Mitglieder, KI-Schlüssel, journali-Token gegen die
  Limits **und die Lizenz** — Limits und Gekauftes hängen am Team) · ◈ IAM
  (Anwenderkonten, Rollen, Rechte, Teams anlegen) · ⚑ Workflows · ▨ Storage ·
  ▩ Assets (Ableitungen, Bestand — getrennt, weil das später auch ein Medienmanager
  pflegen darf) · ✉ Mail · ⇅ B&R (Sichern von Hand und zurück — jeder Tarif; als
  Zeitplan ist es ein Job des Plugins `backup`, ab Pro) · ⧉ Server (welche Server auf die Datenbank zugreifen,
  Hauptserver und Arbeitsserver, `docs/pflegestruktur.md` 41) · ⚑ Workflows.
  **Startphase** (05.10.2026, `Core.Licensing.Startphase`, gesetzt in `Program.cs`): alle Teams Unlimited, kein Kontingent,
  **ein** Server je Datenbank (ein Debug-Bau zählt nicht mit: `Verbund.Entwicklung`), **kein Aufruf des Lizenzservers** außer den Nutzungsberichten, wenn ein Administrator sie
  eingeschaltet hat (`NutzungsberichtApi.cs`, Eintrag `UsageReportsSet`, aus als Voreinstellung); die Oberfläche blendet Lizenz, Limits und journali-Token aus
  (`store.startphase` aus `/api/health`). Die Lizenzfunktionen bleiben im Code und werden mit `Startphase.An = false` getestet —
  wer an ihnen arbeitet, prüft beide Zustände. Was folgt, beschreibt die Lizenz nach der Startphase.
  **Tarife**: Kostenlos, Pro, Pro+, Enterprise, Unlimited — aus dem signierten **Tarifblatt** des Lizenzservers im
  Journal (`TarifeReceived`, `Teams.Tarife`, `Catalog.Tarife`); `Tarife.cs` ist nur das Saatgut, im Code nie
  `Tarife.Free`/`Tarife.Pro` für den Betrieb verwenden. Grenzen je Team, Plugins und Publikationsbäume nach dem
  höchsten Tarif der Instanz; drei Monate Enterprise ab dem ersten Journaleintrag (Test-Tarif und -Monate im Blatt).
  **Nur Signiertes zählt**: Lizenz, Schlüssel, Abo-Stand und Tarifblatt gelten nur mit der Signatur des eingebauten
  Lizenzserver-Schlüssels (`Core.Licensing.Aussteller`); `JOURNALI_LICENCE_KEY` nur im Debug-Bau (Prüf-Aussteller).
  Auch **seine Adresse ist eingebaut** (`Aussteller.Adresse`) — eine Instanz frischt ihr Abo ohne Einrichtung auf,
  und der Name bleibt, während der Server dahinter wechseln darf (DNS). `JOURNALI_LIZENZSERVER` nur im Debug-Bau.
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
  Grenzen und Verbrauch, weil sie irgendwo hängen müssen. Jede Instanz bringt das
  **Init Team** mit (`team:init`, `Model.InitTeam`): nicht löschbar, umbenennbar,
  trägt das Grundkontingent; der erste Administrator gehört hinein, und wer kein
  eigenes Team trägt, arbeitet dort.
  **Ohne Kontingent keine Pflege**: abgewiesen wird **jeder Eintrag,
  der journali-Token kostet** (`Kinds.Counts`: Datenpflege und Ausleitung) — nicht
  jede schreibende Anfrage. Modellieren, Strukturieren, Kataloge, Einrichtung und
  Betrieb kosten nichts und gehen weiter. Die Sperre sitzt am **Schreibpfad**
  (`Catalog.With` → `KeinKontingentException` → 403), weil erst dort der Eintragstyp
  feststeht. Kein Kontingent hat, wer in keinem Team ist oder dessen Zahlerkette bei
  0 endet. **Jeder Job zählt auf ein Team** (`JobDefined.Team`, sonst das des Besitzers, sonst das des
  Administrators); ein Team startet nur seine eigenen Jobs, ein Administrator alle. Ändern sich die Grenzen eines Teams,
  zählt es neu (`Teams.Zaehlbeginn`, 03.10.2026).
  **Eine Instanz hat keine Lizenz — jede gehört einem Team**: ein Abo (Shop-Schlüssel) oder ein Schlüssel zum
  Kopieren, den das Team selbst einlöst. Die Limits ergeben sich aus dem Tarif — nirgends ein Eingabefeld. Das Init
  Team hat den Test einer neuen Instanz (Test-Tarif, Testmonate ab dem ersten Eintrag), danach Kostenlos; jedes
  weitere hat nur, was Abo oder Schlüssel ihm geben, sonst rechnet es über ein anderes Team ab.
  **Führen und dazugehören sind zweierlei**: man kann Manager
  mehrerer Teams sein, aber **Mitglied nur eines** — der IT-Administrator von
  Südeuropa führt Spanien, Frankreich und Portugal und sitzt in Team Deutschland.
  Die Balken in der Statusleiste zeigen immer das Team der **Mitgliedschaft**, am
  Ende der Zahlerkette. Ein Team kann über ein anderes abrechnen, das selbst über
  ein drittes abrechnet; **Kreise sind verboten** (a→b→a, a→b→c→a) und werden beim
  Setzen abgelehnt (`Teams.WaereKreis`).
- `docs/architektur.md` — das Prinzip, die Schichten, die Achsen, was offen ist
