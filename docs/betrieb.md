# Betrieb

Stand 16.09.2026. Der Server ist `Journali.Server` (ASP.NET Core, net8.0),
das Journal liegt in PostgreSQL 18. Das Passwort steht nie im Repo.

## Entwickeln auf dem PC

Der Server läuft lokal, die Datenbank auf der rossibox
(`localhost:7432`, Nutzer `postgres`, Datenbank `journali` — legt
der Server beim ersten Start selbst an, ebenso die Tabelle).

Einmalig das Passwort in die user-secrets (bleibt unter
`%APPDATA%\Microsoft\UserSecrets\journali-server\`, nie im Repo):

```bash
dotnet user-secrets set JOURNALI_DB_PASSWORD "…" --project Journali.Server
```

Dann F5 in Visual Studio (Profil `Journali.Server`, `http://localhost:5000`,
öffnet `/health`) oder:

```bash
dotnet run --project Journali.Server
```

Im Hintergrund, in einem eigenen Fenster „journali":

```bash
tools\server start
```

`tools\server stop` beendet `Journali.Server.exe` (das Fenster schliesst
mit), `restart` beides, `status` ruft `/health`.

Host, Port, Nutzer und Datenbankname stehen in
`Journali.Server/appsettings.json` unter `JOURNALI_DB`; die Umgebungsvariable
gleichen Namens übersteuert sie.

## Medien

Die Bytes liegen ausserhalb des Journals, adressiert über den SHA-256; das Journal
kennt nur den Hash. **Wo** sie liegen, ist ein Treiber per `JOURNALI_MEDIA`
(Taloan, 19.09.2026: Datenbank z. B. auf Azure, Assets im günstigen Object Storage):

| `JOURNALI_MEDIA` | Treiber |
|---|---|
| `postgres` (Vorgabe) | Tabelle `media_blob` in derselben Datenbank — ein Paket, lauffähig, `pg_dump` sichert alles; für grosse Bestände auf `s3` wechseln |
| `/pfad` | Verzeichnis, Unterordner nach den ersten zwei Hexzeichen |
| `s3://bucket` | S3-kompatibel (Garage, MinIO, AWS, R2, Hetzner …), Signature V4 ohne SDK; dazu `JOURNALI_S3_ENDPOINT`, `JOURNALI_S3_KEY`, `JOURNALI_S3_SECRET`, optional `JOURNALI_S3_REGION` (Vorgabe `garage`), `JOURNALI_S3_PATHSTYLE=false` für `bucket.endpoint` |

Regel: **ein Journal, ein Speicher.** Zwei Instanzen am selben Journal (PC und Container) zeigen auf denselben
Speicher — dieselbe Postgres-Datenbank oder denselben Bucket; sonst fehlen der einen die Bytes der anderen.

**Einstellen** unter ⚙ Einstellungen → ▨ Storage: Treiber, Zugang — prüfen, speichern; die Einstellung
liegt als `media.json` im Datenverzeichnis (`JOURNALI_JOBS`, neben `secrets.json`), nie im Journal, und geht der
Umgebung vor. Dort auch Fehlbestand zählen und Blobs aus einem anderen Speicher herüberkopieren.

**Treiber wechseln** ohne neue Ids: neue Angabe setzen, starten, dann `POST /api/media/copy {"from": "<alte Angabe>"}`
(X-Actor) — kopiert alle Blobs, die hier fehlen, Hash-geprüft. `GET /api/media/missing` zeigt Medien ohne Bytes,
`GET /api/media/store` den aktiven Treiber. Vorschauen (`sha.thumb`, WebP 256 px) rechnet der erste Betrachter im
Browser und legt sie im selben Store ab (`PUT /api/media/{id}/thumb`); der Server braucht kein Bildpaket.

Die Bytes liegen ausserhalb der Datenbank (docs/pflegestruktur.md, 20):
Verzeichnis aus `JOURNALI_MEDIA`, Vorgabe `media/` neben dem Programm (beim
Entwickeln `Journali.Server/media/`, nicht im Repo), Unterordner nach den
ersten zwei Hexzeichen des SHA-256. Im Journal steht nur `MediaCreated`
mit Hash, Grösse, Typ, Name. Gleiche Datei zweimal hochgeladen = ein
Medium. Im Container: Volume `journali-media` auf `/data/media`
(`compose.yaml`). Später S3/MinIO hinter derselben Schnittstelle
`IMediaStore` (`MediaStore.cs`). Sicherung = Datenbank **und** dieses
Verzeichnis.

## Endpunkte

Alles unter `/api`; alles andere liefert die Oberfläche (`index.html`).
Befehle (schreiben) brauchen den Kopf `X-Actor` und stehen in
`docs/eintraege.md`. Lesen:

| Aufruf | Antwort |
|---|---|
| `GET /api/health` | `{"head": N, "nodes": K}` — letzter Eintrag (0 bei leerem Journal), Zahl der Knoten |
| `GET /api/model` | Sprachen, Kanäle, Attribute, Wertelisten, Familien, Typen — aus dem Journal (`docs/eintraege.md`) |
| `GET /api/tree` | alle Knoten flach: Id, Rolle, Eltern, Label, Familie, Achsen, Status, SKU, Zähler |
| `GET /api/nodes/{id}` | ein Knoten: Werte, **Vorfahren mit ihren Werten** (für die Vererbung), Kategorien, Freigaben, externe Kennungen — oder 404 |
| `GET /api/nodes/external/{system}/{id}` | der Knoten zu einer externen Kennung — oder 404 |
| `GET /api/search?q=&limit=` | Suche über Label, SKU, Id, Achsenwerte und alle eigenen Werte (auch im HTML); Zeilen mit Fundstelle. Ohne Index — gut bis einige zehntausend Knoten |
| `GET /api/journal?after=N&limit=M` | Einträge mit Nummer > N, höchstens M (Vorgabe 1000, Obergrenze 10 000) |
| `GET /api/journal/{number}` | ein Eintrag oder 404 |
| `GET /api/streams/{stream}` | alle Einträge eines Stroms in Reihenfolge |
| `GET /api/media?q=&limit=` | Medien, neueste zuerst (Name, Id, Werte durchsucht) |
| `GET /api/media/{id}` · `/file` | ein Medium; die Datei (unveränderlich, `immutable`-Cache, Range) |
| `POST /api/media` (multipart `file`) | hochladen → `MediaCreated`, oder das vorhandene Medium bei gleichem Hash (`existed`) |
| `POST /api/media/fetch` `{url, name?}` | der Server holt die Datei von einer http(s)-Adresse (Import: Bilder der Quelle) — sonst wie hochladen |
| `GET /api/nodes/{id}/table?role=&attributes=&locale=&channel=&deep=` | Kinder (mit `deep=true` alle Nachfahren) als Zeilen mit aufgelösten Werten je Attribut (`value`, `own`, `from`) — Massenpflege, Export, Datenqualität |
| `GET/PUT/DELETE /api/plugins/{key}/data/{name}` | benannte JSON-Datensätze eines Plugins im Journal (`PluginDataSet`): Profile, Vorlagen, Regeln; `GET …/data` listet die Namen |

`payload` kommt in jeder Antwort als eingebettetes JSON, nicht als String.

Beispiel:

```bash
curl -s -X POST localhost:5000/api/nodes/v-213865ea/attributes -H "X-Actor: anna" -H "Content-Type: application/json" -d "{\"attribute\":\"name\",\"locale\":\"de\",\"value\":\"Stiefel\"}"
```

```bash
curl -s "localhost:5000/api/journal?after=0"
```

## Auf der rossibox (Unraid)

Die Datenbank ist das Template `postgresql18` aus den Community Apps
(Host-Port 7432, Nutzer `postgres`, Daten unter `/mnt/cache/appdata/postgresql18`).

Der Server bringt die Oberfläche mit (Dockerfile baut sie mit Node in der
ersten Stufe). Für den Server gibt es zwei Wege:

1. **Image** — `Dockerfile` im Repo, gegen die vorhandene Datenbank mit
   `compose.rossibox.yaml`: auf der rossibox im Checkout `cp .env.example .env`,
   Passwort eintragen, `docker compose -f compose.rossibox.yaml up --build -d`
   → `http://rossibox:8080`. Das Image baut die Oberfläche selbst (Node-Stufe),
   die Plugins kommen per Bind-Mount aus dem Checkout, Jobs/Storage-Einstellung
   liegen im Volume `journali-jobs`. Neuer Stand = `git pull` und dasselbe
   Kommando; nur Plugin-Änderungen brauchen kein neues Image. Alle Prozess-Plugins
   laufen auf node (seit 23.09.2026 auch der Solr-Import) — das Image braucht nichts
   weiter.
2. **Publish-Ordner** — ohne Image: vom PC erst `tools\server build`, dann
   `dotnet publish Journali.Server -c Release -o <Freigabe>\journali -p:DebugType=none -p:DebugSymbols=false`
   (nimmt `wwwroot` mit),
   Container aus `mcr.microsoft.com/dotnet/aspnet:8.0` mit dem Ordner
   als `/app`, Befehl `dotnet Journali.Server.dll`, Port 8080, dieselben
   Umgebungsvariablen. Änderung = neu publishen, Container neu starten.

**Keine Debugsymbole in der Auslieferung** (Taloan, 22.09.2026): Image und
Publish-Ordner werden mit `-p:DebugType=none -p:DebugSymbols=false` gebaut,
also ohne `.pdb`. Das nimmt einem Leser die Dateipfade und Zeilennummern; die
DLLs sind IL und bleiben mit einem Dekompilierer lesbar (Namen und Logik, ohne
Kommentare) — technisch dagegen hülfe nur NativeAOT. Den Rest regeln Lizenz
und Vertrag. Die Oberfläche geht ohnehin minifiziert und ohne Source Maps
heraus; die Plugins liegen als Quelltext im Image, das ist so gewollt.

## Verteilen

`compose.yaml` ist das ganze Paket: Server + `postgres:18` mit eigenem
Volume. Plugins kommen per Bind-Mount `./plugins:/app/plugins` vom Host:
eine Datei dort tauschen aktualisiert das Plugin ohne neues Image (der
Server liest Manifeste und Module bei jedem Zugriff, `no-cache`; eine neue
Fassung erscheint unter ⌁ Plugins als ↑ Update). Prozess-Plugins brauchen
`node` im Laufzeit-Image — das Dockerfile kopiert die Binärdatei aus
`node:22`. Basis-Plugins (table, da, tasker) liegen ebenfalls unter `plugins/`
— auch ihre Ansichten lassen sich so austauschen; gebaute Plugins (`src/` →
`entry.js`) kommen fertig gebaut aus dem Repo, das Image baut nur `web/`. Jobs (Logs, `secrets.json`) liegen im Volume `journali-jobs`. `.env.example` nach `.env` kopieren, Passwort eintragen,
`docker compose up --build`. Der Server wartet, bis Postgres bereit ist
(Healthcheck), und legt Datenbank und Tabelle selbst an.

## Benutzer & Rollen

Ohne Benutzer ist der Server offen wie bisher (`X-Actor` frei — Intranet). Der erste Aufruf von `/login`
legt den ersten Administrator an (`POST /api/auth/setup`); ab dann braucht alles unter `/api` ausser
`/api/health` und `/api/auth/*` eine Sitzung (Cookie `journali.session`, 30 Tage) oder ein Token
(`Authorization: Bearer …`), und der Urheber jedes Eintrags kommt aus der Sitzung — der Client kann
`X-Actor` nicht mehr wählen.

**Rollen sind Daten, Rechte sind Code** (Taloan, 20.09.2026: „wie die Rollen heißen und was sie können,
überlassen wir dem Anwender — wir legen sinnvolle vor“). Das Rechte-Vokabular (`Rights` im Kern) ist fest,
weil der Server jedes Recht prüfen muss (`Auth.Needed`: welche Anfrage welches Recht braucht):

| Recht | erlaubt |
|---|---|
| `read` | lesen: Baum, Werte, Medien, Journal, Modell, Jobliste |
| `write` | pflegen: Knoten, Werte, Relationen, Medien, Stapel, Plugin-Daten (Profile), Plugin-Läufe, Belege |
| `retire` | Knoten zurückziehen, wiederherstellen, Stapel rückgängig |
| `release` | Freigaben, Versionen (anlegen, Belege, zurückrollen, zurückziehen) |
| `model` | Modell ändern: Attribute, Gruppen, Listen, Sichten, Einheiten, Sprachen, Kanäle, Relationstypen |
| `plugins` | Plugins installieren, an/aus, entfernen |
| `jobs` | Jobs anlegen, starten, Läufe und Logs |
| `storage` | Medien-Speicher einstellen, Store lesen, kopieren |
| `users` | Benutzer und Rollen verwalten („Administrator“ heißt: dieses Recht) |

Welche Rolle welche Rechte hat, steht im Journal (`role:<key>`, `RoleDefined`), Verwaltung unter
⚙ Einstellungen → 👤 Benutzer & Rollen (Tabelle Rollen × Rechte, neue Rollen, Rechtsklick zieht zurück).
Vorbelegt in einem leeren Journal: `admin` Administrator (alles), `manager` PIM-Manager (pflegen, Modell,
Jobs), `editor` PIM-Editor (pflegen, Versionen — Modell nur ansehen), `reader` Leser. Nur `admin` kommt beim
Start wieder, wenn er fehlt; ohne Lesen geht keine Rolle. Das Recht `users` darf nicht aus der letzten Rolle
verschwinden, die ein aktiver Benutzer hat; eine Rolle mit Benutzern lässt sich nicht zurückziehen.

Verwaltung unter ⚙ Einstellungen → 👤 Benutzer & Rollen (Recht users) bzw. Konto (jeder: Passwort, API-Token). API-Token
(`jt_…`) sind für Excel-Add-in, OnlyOffice und Skripte — je Nutzer, widerrufbar, nur beim Anlegen sichtbar.
Jobs und Belegerzeuger bekommen je Lauf ein Dienst-Token (`JOURNALI_TOKEN`, Rolle `editor` — fehlt sie, das
feste Minimum read/write/retire/release), das mit dem
Lauf erlischt. Geheimnisse liegen in `auth.json` im Datenverzeichnis (`JOURNALI_JOBS`, im Container das
Volume `journali-jobs`), Passwörter als PBKDF2-SHA256 — nie im Journal. Der letzte Benutzer mit dem Recht
`users` lässt sich nicht sperren oder entfernen. Hosting: Anmeldung ist Pflicht, bevor eine Instanz ins Internet geht.

**Ausgesperrt?** Die Benutzer stehen im Journal (Datenbank), die Passwörter in `auth.json` im Datenverzeichnis des
jeweiligen Rechners. Läuft der Server auf einem anderen Rechner (oder mit anderem `JOURNALI_JOBS`) als dem, auf dem der
Administrator angelegt wurde, gibt es dort kein `auth.json` — jede Anmeldung scheitert mit „Benutzer oder Passwort
falsch“. Entweder `auth.json` mitnehmen, oder einmalig mit `JOURNALI_ADMIN_PASSWORD=<neues Passwort>` (optional
`JOURNALI_ADMIN_USER`, Vorgabe `admin`) starten: der Start setzt das Passwort neu, legt den Benutzer an, wenn er fehlt,
und sagt es in der Konsole. Danach die Variable wieder entfernen.

## KI

journali bietet keine KI an und hat keinen eigenen Schlüssel; kein Anbieter ist im Code bevorzugt
(Taloan, 20.09.2026). Der Schlüssel liegt **am Team** (⚙ Einstellungen → ◍ Team), im Datenverzeichnis
des Servers (`jobs/secrets.json` unter `team:<key>`), nie im Journal und nie im Browser. Gefragt wird
über `POST /api/ai/ask`: der Server nimmt den Schlüssel des **zahlenden** Teams (`keysFrom`) und das
dort eingetragene Modell. Ohne Team keine KI; dasselbe gilt für Jobs, die über ihr `JOURNALI_TOKEN`
einen Anwender und damit ein Team haben. Eingerichtet werden können **Anthropic**
(`api.anthropic.com`) und **OpenAI** (`api.openai.com`); weitere sind ein Eintrag in `AiApi.Call`.
Der Anbieter bleibt Vertragspartner des Kunden — abgerechnet wird dort.

**Über Tokens und Kosten sagt journali nichts** (Taloan, 23.09.2026: „wir machen keine Aussagen über
fremd entstandene und verbrauchte Tokens + Kosten“). Was der Anbieter meldet, wird weder gespeichert
noch angezeigt. Was journali sagt, hat journali selbst gemessen: das **KI-Austauschvolumen** in
Bytes — was hingeschickt und was zurückgekommen ist. Es steht als Kennzahl in der Statuszeile
(Monat, KB/MB/GB) und auf der Teamseite je Tag, aufgeschlüsselt nach Anlass (Editor, Übersetzung,
Klassifikation, Prüfung, Geodaten). Begrenzt wird nichts. Die Recherche im Internet nutzt das
Suchwerkzeug des Anbieters und wird dort je Suche berechnet.

## Plugins im Container

Das Image ist autark: es bringt alle Plugins mit, dazu die Pakete der beiden, die
welche brauchen (`derive` mit sharp, `docs` mit pdfjs) und die Node-Binärdatei.
Ein `docker run` allein genügt, nichts wird nachgeladen.

`compose.yaml` legt zusätzlich `./plugins` vom Host darüber, damit ein Plugin ohne
neues Image ausgetauscht werden kann. Ein Bind-Mount **überdeckt** aber alles
darunter — auch die `node_modules` aus dem Image. Darum holen zwei benannte
Volumes genau diese zwei Ordner zurück:

```yaml
- ./plugins:/app/plugins
- journali-derive-modules:/app/plugins/derive/node_modules
- journali-docs-modules:/app/plugins/docs/node_modules
```

Sie werden beim ersten Start aus dem Image gefüllt. Wer die Pakete eines Plugins
erneuert, entfernt das zugehörige Volume (`docker volume rm journali-docs-modules`)
und startet neu — dann kommen sie wieder aus dem Image.

## Mail

Einstellungen → ✉ Mail: Server, Port, STARTTLS, Benutzer, Passwort, Absender.
Liegt als `mail.json` im Datenverzeichnis, neben `media.json` und `auth.json` —
nie im Journal. Das Passwort kommt maskiert zurück; wer das Feld nicht anfasst,
lässt es stehen. Ein Knopf sendet eine Probe.

Gesendet wird mit dem, was .NET mitbringt (`SmtpClient`): Klartext auf 25,
STARTTLS auf 587. **Implizites TLS auf 465 geht nicht** — dafür bräuchte es ein
Paket, und der Server hat nur Npgsql.

Der Versand steht als Dienst bereit (`Mailer.SendAsync`); ohne Einstellung sendet
er nichts und sagt es, statt still zu scheitern.

## Sicherung und Wiederherstellung

Zwei Wege, die sich nicht ersetzen.

**`pg_dump`** sichert die Datenbank: Journal, abgeleitete Tabellen und — beim
Speicher `postgres` — die Medien. Schnell, konsistent, erprobt. Er kennt aber nur
die Datenbank: die Plugin-Verzeichnisse und die Dateien im Datenverzeichnis
(`auth.json`, `media.json`, `jobs/secrets.json`) liegen im Dateisystem und fehlen.
Wer so sichert, muss das Volume mitnehmen.

**Die Vollsicherung** — von Hand unter ⚙ Einstellungen → ⇅ B&R (jeder Tarif, Taloan 24.09.2026) oder als Zeitplan
mit dem Plugin `backup` im Tasker (ab Pro); beide rufen `POST /api/backup` — schreibt einen
Satz, der an nichts hängt — nicht an der Postgres-Fassung, nicht am Schema:

| im Verzeichnis | was |
|---|---|
| `journal.ndjson.gz` | alle Einträge, je Zeile einer, mit Nummer, Zeit, Urheber |
| `media/` | die Blobs — **nur beim Speicher `postgres`** |
| `config/` | `auth.json`, `media.json`, `jobs/secrets.json` |
| `plugins/` | die Plugin-Verzeichnisse ohne `node_modules` |
| `backup.json` | Zeitpunkt, Anzahl, Art des Speichers |

Alles Fachliche steht im Journal und kommt damit zurück: Modell, Baum, Werte,
Relationen, **Rollen und Rechte** (`role:…`), Benutzer (`user:…`), Workflows,
Jobs (`job:…`), der Stand der Plugins (`plugin:…`) und die Medien-Metadaten.

Liegen die Medien in `file` oder `s3`, bleiben sie draussen — dafür sorgt der
Betrieb (Volume-Snapshot, Lifecycle beim Anbieter). Die Verweise stimmen nach der
Wiederherstellung trotzdem, solange dieser Speicher derselbe bleibt: im Journal
steht der Hash, und der Hash ist der Schlüssel im Speicher.

**Zurück** geht es nur in ein **leeres** System (Einstellungen → Sicherung →
Einspielen): sonst kollidierten die Eintragsnummern. Danach einmal neu starten —
der Server baut seine Abbilder beim Start aus dem Journal. Plugins mit eigenen
Paketen brauchen einmal `npm install`; `node_modules` sind nicht in der Sicherung,
weil sie für ein Betriebssystem gebaut sind (sharp, pdfjs bringen Binärdateien mit).

Die Sicherung enthält Passwort-Hashes und Token. Sie gehört dorthin, wo auch das
Datenverzeichnis hingehört.

## Tabelle `journal`

| Spalte | Typ | |
|---|---|---|
| `number` | `BIGINT PRIMARY KEY` | MAX+1 unter Tabellensperre, damit lückenlos — eine Sequenz liesse bei Abbrüchen Lücken |
| `at` | `TIMESTAMPTZ` | `now()` der Datenbank |
| `actor`, `stream`, `type` | `TEXT` | |
| `payload` | `JSONB` | Postgres weist ungültiges JSON ab; Leerraum und Reihenfolge werden normalisiert |
| `batch` | `TEXT`, null | Stapelkennung; kommt per `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in bestehende Tabellen |

Index `journal_stream (stream, number)` für `ReadStream`.

### Start und der lokale Spiegel

Beim Start baut der Server alle Abbilder aus dem Journal neu (`Catalog.Rebuild`); die Startzeile sagt, wo die
Zeit hingeht: `61242 Einträge in 31556 ms — lesen 30326 ms · anwenden Plugins 728 ms, Tree 199 ms …` (Taloan,
21.09.2026). Das Anwenden ist billig; das Lesen über das Netz aus Postgres nicht. Darum führt der Server einen
**lokalen Spiegel** des Journals (`CachedJournal`): `journal-<host>-<port>-<db>.cache.jsonl` im Datenverzeichnis
(`JOURNALI_JOBS`), eine JSON-Zeile je Eintrag. Beim Start kommt alles bis zum Spiegelstand von der Platte, nur der
Rest aus der Datenbank; jeder gelesene oder geschriebene Eintrag wird angehängt. Der Spiegel ist ein Cache, keine
Wahrheit: beim Start wird sein letzter Eintrag gegen die Datenbank geprüft (Nummer, Strom, Typ, Zeit, Nutzdaten) und
die Nummernfolge auf Lücken — bei jeder Abweichung wird die Datei verworfen und alles aus der Datenbank gelesen.
Datei löschen ist jederzeit erlaubt. `JOURNALI_JOURNAL_CACHE=off` schaltet den Spiegel ab.
Was je Eintrag kostet, wächst mit dem Journal (Taloan, 24.09.2026): die Datei ist einmal je Vorgang offen, nicht je
Eintrag; beim Start wird nur die letzte Zeile entschlüsselt (lückenlos = erste Zeile #1 und so viele Zeilen wie die
letzte Nummer); Zeilen vor dem gesuchten Stand werden an ihrer Nummer erkannt, ohne sie zu entschlüsseln; eine beim
Absturz halb geschriebene letzte Zeile wird abgeschnitten statt den Spiegel zu verwerfen. Gemessen an 125 096
Einträgen: Start prüfen 207 ms (vorher ~2,2 s), 50 000 nachholen 127 ms (vorher 7,4 s allein fürs Schreiben).

**Schnappschuss der Abbilder** (Taloan, 21.09.2026 — gegen das Anwenden, ~18 µs je Eintrag): `snapshot-<host>-<port>-<db>.json`
im Datenverzeichnis, der Stand aller Abbilder bei #n (`Snapshot.cs` im Kern: System.Text.Json über die Abbild-Klassen samt
privater Felder). Beim Start werden die Abbilder daraus geladen und nur der Rest ab #n angewandt; geschrieben wird er im
Hintergrund nach dem Start und beim Beenden. Auch er ist ein Cache: er trägt den Bau-Stempel des Kerns (neue Fassung =
alter Schnappschuss fällt) und der Eintrag #n wird gegen das Journal geprüft; bei Abweichung wird die Datei gelöscht.
`JOURNALI_SNAPSHOT=off` schaltet ihn ab. Startzeile: „Schnappschuss bis #n“.

## Jobs (fest eingebaut: ⏱ Jobs)

Jobs laufen im Server als Kindprozesse (`JobRunner`), unabhängig vom
Browser: nach Zeitplan (cron, geprüft je Minute; nach einem Stillstand werden
höchstens die letzten 5 Minuten nachgeholt) oder von Hand. Verzeichnis aus
`JOURNALI_JOBS`, Vorgabe `jobs/` neben dem Programm (im Repo ignoriert):
`jobs/<key>/<run>.log` je Lauf, `jobs/secrets.json` für Geheimnisse (Token,
Passwörter — nie im Journal). Der Prozess bekommt `{journali}` (Adresse des
Servers), `{actor}` (`job:<key>`) und die Parameter als Argumente laut
Manifest und als Umgebung `JOURNALI_<PARAM>`. Nur Plugins mit `process` im
Manifest können Jobs; mitgeliefert: `backup` (Rohdaten-JSON eines Teilbaums
oder aller Wurzeln, behält die letzten n Dateien).

Parameter (`process.params`: `key`, `label`, `type`, `default`, `secret`) — Typen: `text`, `number`, `boolean`,
`node` (Auswahlbaum, Wert ist die Knoten-Id), `pub` (Publikationsbaum), `profile` (Dropdown der gespeicherten
Profile des Plugins — `profile:<name>` oder `config:<name>` im Plugin-Strom; jeder Parameter mit `key: profile`
bekommt es auch ohne den Typ), `dir` (Verzeichnis auf dem Server) und
`path` (Datei, Verzeichnis oder URL). **Alles im Profil** (Taloan, 21.09.2026: „die Profile definiere ich im Plugin —
alle Infos müssen deshalb im Profil vorliegen; das Einzige, was der Tasker bei dateibasierten Importen und Exporten
können muss, ist Verzeichnis/Datei; Ziel im Baum beim Import, Quelle vom Baum beim Export stehen im Profil“): hat ein
Prozess einen Parameter `profile`, zeigt der Job-Dialog nur Profil, Dateien/Verzeichnisse und Schalter; Baumknoten,
Texte und Geheimnisse stehen unter „Überschreiben (leer = wie im Profil)“. Der JobRunner liest `profile:<name>`
(sonst `config:<name>`) aus den Plugin-Daten und füllt jeden Manifest-Parameter gleichen Namens, den der Job nicht
selbst setzt — die Prozesse selbst bleiben, wie sie sind. Plugins mit eigener Ansicht pflegen ihre Profile dort
(IXP, JSON-Import, Solr, Vorlagen-Export — Solr: Kern, Ziel, angehakte Wurzeln als `root` mit Komma, übergangene
Schlüssel); Prozesse ohne Ansicht tragen `"profile": "generic"` und bekommen im Job-Dialog
✎ — ein Formular aus ihren Parametern (Tabellen-Export, Backup, RAG, Datenblatt-Job, JSON-Export).
**Fächer** (`docs/tasker-dateien.md`, Taloan 21.09.2026): Prozesse mit `files` im Manifest bekommen je Job `in/`, `done/`,
`failed/`, `out/` unter einer Basis (Vorgabe `jobs/<key>`, je Job ein Share). Der Tasker wählt den Eingang (Muster,
eine oder alle Dateien, Duplikat nach SHA-256 → `done/…-dup-…` ohne Lauf; leerer Eingang → kein Lauf), füllt
`{inFile}`/`{inDir}`/`{outFile}`/`{outDir}` und den genannten Parameter (`source`, `dir`), wenn der Job ihn leer lässt,
räumt nach dem Lauf auf (`done/` bzw. `failed/` mit Log daneben), belegt Ausgaben (`JobFileConsumed`/`JobFileWritten`),
kopiert `latest` (`out/<key>-latest/`), hält die Aufbewahrung (`10` Läufe, `30d`, leer = alle) und archiviert auf Wunsch
im Medienspeicher. `GET /api/jobs/{key}/files` zeigt es; im Job-Detail steht es unter den Läufen.

Geheimnisse (Token) gehören nie ins Journal, also nicht ins Profil selbst — sie liegen **am Profil beim Server**:
`PUT /api/plugins/{key}/secrets/{profil}` `{values:{token:…}}` (Recht Schreiben; `GET` nennt nur die Schlüssel) in
`jobs/secrets.json` unter `plugin:<key>:<profil>`; der JobRunner füllt damit, was der Job nicht selbst gesetzt hat.
⇩ Import → IXP hat dafür 🔒 neben dem Token. Bei `dir` und `path` öffnet 📁 den Dateibrowser des **Servers** — derselbe wie
unter Einstellungen → Storage (`GET /api/files?path=…`, `FileApi.cs`, Recht Jobs oder Storage; Oberfläche
`web/src/filePicker.js`, Plugins über `ctx.filePicker`): Wurzeln sind das Datenverzeichnis, das Programm und die
Laufwerke; versteckte Einträge bleiben weg. Die Pfade gelten auf dem Rechner, auf dem der Server läuft — nicht im
Browser (Taloan, 21.09.2026).

## Lizenz — Tabelle `licence` in der Datenbank

Die Grenzen dieser Anlage stehen in der Lizenz (Taloan, 23.09.2026: „die Grenzen setzt der Lizenzkey“), nicht in der Hand
des Administrators und schon gar nicht bei einem anderen Team:

| Feld | Bedeutung |
|---|---|
| `entriesWeek`, `entriesMonth` | journali-Token je Woche und Monat (gezählt werden Datenpflege und Ausleitung) |
| `countFrom` | ab wann gezählt wird — was davor im Journal steht, zählt nicht mehr mit |
| `teams` | Kontingente einzelner Teams: `{"es": {"entriesWeek": 5000, "entriesMonth": 20000}}` |
| `plan`, `holder`, `validUntil` | Bezeichnung, Inhaber, Ablauf |
| `aiTokensMonth`, `aiTokensDay` | Altlast, wird nicht mehr ausgewertet |

### Tarife (Taloan, 24.09.2026)

`Journali.Core/Projections/Tarife.cs` ist die eine Tabelle; `plan` in Lizenz, Anforderung und Schlüssel nennt den Tarif.

| Tarif | je Woche / Monat | Publikationsbäume | Plugins |
|---|---|---|---|
| Kostenlos (`free`) | 10 000 / 50 000 | 1 | Tabelle: `table`, `csv`, `xlsx`, `json`; `excel` (Add-in), `onlyoffice`, `derive` (Vorschaubilder), `export` — und der `tasker`, den die beiden letzten brauchen (er startet nur Jobs erlaubter Plugins) |
| Pro (`pro`) | 50 000 / 250 000 | 5 | dazu `datasheet`, `xliff`, `xport` (BMEcat), `etim` — und was sie brauchen: `da`; `backup` als Job |
| Pro+ (`proplus`) | 50 000 / 250 000 | 5 | alle („All-Plugin“ zu Pro, gilt systemweit) |
| Enterprise (`enterprise`) | 200 000 / 1 000 000 | ohne Grenze | alle |
| Unlimited (`unlimited`) | ohne Grenze | ohne Grenze | alle |

- **Grenzen** hängen am Team (am Ende der Zahlerkette). **Plugins und Publikationsbäume** gelten für die ganze
  Instanz nach ihrem **höchsten** Tarif — Lizenz oder ein eingelöster Schlüssel irgendeines Teams
  (`Catalog.InstanzTarif`). Ein Plugin ausserhalb des Tarifs lädt nicht, lässt sich nicht installieren, einschalten
  oder als Job starten (403); ein Publikationsbaum zu viel wird am Schreibpfad abgewiesen (`TarifException`, 403).
- **Test:** eine Instanz ohne Lizenz legt ihre Testlizenz selbst an — Enterprise für drei Monate ab dem ersten
  Eintrag im Journal (`trial: true`), festgehalten wie jede Lizenz. Der erste Tag kommt aus dem Journal und fährt mit
  jeder Sicherung mit: eine wiederhergestellte Instanz fängt den Test nicht von vorn an.
- **Abgelaufen** (Test oder Lizenz) gilt **Kostenlos** — auch im laufenden Betrieb; stündlich zieht der Server die
  Limits des Init Teams nach (`LimitsAusLizenz`).
- Lizenzen von vor den Tarifen (ohne bekannten `plan`) gelten als Kostenlos, ihre Grenzen bleiben.
- **Reset-Schlüssel** gibt es getrennt für Pro (gilt für Pro und Pro+) und Enterprise; kostenlos gibt es keinen,
  Unlimited braucht keinen.
- Unlimited steht in den Zahlen als `int.MaxValue` (`Tarife.Ohne`); die Oberfläche zeigt ∞.

**Der Verbrauch lässt sich nicht zurücksetzen** — er sind die Einträge im Journal, und das Journal ist die Wahrheit.
Was eine Lizenz darf, ist einen **Anfang setzen**: `countFrom` verschiebt den Zählbeginn, alles davor bleibt stehen und
zählt nicht mehr mit. Das ist auch der Weg nach einer Migration, deren Altdaten keine Pflege waren.

Die Limits liegen am **Init Team**; jedes weitere Team hat, was die Lizenz ihm unter `teams` zuschreibt, sonst nichts —
dann rechnet es über ein anderes Team ab. Eingestellt wird hier nichts (Taloan: „es gibt hier nichts einzustellen“).

**Ohne Kontingent keine Pflege**: Einträge, die zählen, weist der Server ab (403), sobald der Zähler voll ist.
Ein **Joblauf** hört schon bei 90 % auf (`Limits.JobReserve`) — die letzten 10 % gehören der Handarbeit — und er
**pausiert**, statt zu sterben. Fortgesetzt wird er nur von Hand: sonst nähmen wartende Jobs das neue Kontingent im
selben Moment wieder weg.

Ein Team mit **eigenem Schlüssel** rechnet beim Anbieter selbst ab — dort begrenzt journali nichts (Taloan: „wer den
Komfort der Kontrolle will, muss Teams mit eigenem Kontingent bilden“). Teams ohne eigenen Schlüssel arbeiten über den
Schlüssel der Anlage (`secrets.json` unter `licence`, ersatzweise `JOURNALI_AI_KEY`) und zählen gegen das KI-Limit.

Echtheit: `sig` ist eine ECDSA-P-256-Signatur (SHA-256, Base64) über die Felder ohne `sig`. Geprüft wird sie, sobald
`JOURNALI_LICENCE_KEY` den öffentlichen Schlüssel trägt (Base64, SubjectPublicKeyInfo); fehlt er, wird die Lizenz
gelesen und als **ungeprüft** ausgewiesen — es wird nichts vorgetäuscht. Einspielen: ⚙ Einstellungen → Teams →
⚿ Lizenz (Recht `users`). Sie liegt verschlüsselt in der Tabelle `licence` und gilt nur für die Instanz, deren Kennung
(`instance`, Tabelle `instanz`) sie nennt; eine `licence.json` von früher wird beim ersten Start übernommen und entfernt.
Lizenz, Kennung und Anforderungen gehen **nicht** in die Vollsicherung — eine wiederhergestellte Instanz ist eine neue.

### Schlüssel — Reset und Limit, signiert angefordert

Zusätzlich zur Lizenz gibt es Schlüssel (Taloan, 23.09.2026), einmal einlösbar, an die Instanz gebunden, **ohne Team** —
die zentrale IT legt sie auf Vorrat und wählt das Team beim Einlösen:

| Art | Wirkung |
|---|---|
| `reset` | das Team zählt ab dem Einlösen neu — ab dem Eintrag, nicht ab dem Tag: was am selben Tag vorher gezählt war, zieht `Usage.Cuts` ab (verschiebt nur den Zählbeginn des Teams, nie den der Instanz) |
| `limit` | `entriesWeek`/`entriesMonth` für `days` Tage ab dem Einlösen; hebt an, senkt nie. Läuft schon eines, wird dessen **Restvolumen** in Tage des neuen umgerechnet und angehängt (`Schluessel.Bis`) |

Ein Limit wird als **Paket** angefordert, nie mit freien Zahlen (Taloan, 23.09.2026): `pro`, `ultimate`, `enterprise`
(`Schluessel.Pakete`, `GET /api/licence/packages`); die Anforderung trägt `plan` und die Zahlen des Pakets. Die Zahlen
der Pakete sind vorläufig.

Beide sind kombinierbar; ein Limit überschreibt keinen Reset. Eingelöst wird beim Team, das sein Kontingent selbst
trägt — wer über ein anderes abrechnet, bekommt den Schlüssel dort.

Der Weg eines Schlüssels (Taloan: „PGP quasi“):

1. **Anfordern** (⚷ Anfordern, Recht `users`): die Instanz schreibt die Anforderung — `id`, `kind`, Grenzen, `days`,
   `instance`, `pub` — und signiert sie mit ihrem eigenen Schlüsselpaar (ECDSA P-256, entsteht mit der Kennung, liegt
   verschlüsselt in `instanz.paar`). Heraus geht `{"anforderung": "<Rumpf als Text>", "sig": "<r‖s, Base64>"}`.
   Der Rumpf reist als Text wie bei einer PGP-Klartextsignatur; geprüft wird er so, wie er dasteht.
2. **Freigabe** durch den Shop: er signiert den Fingerabdruck (SHA-256 über den Rumpf, hex).
3. **Ausstellen**: der Aussteller prüft die Signatur der Instanz (öffentlicher Schlüssel steht im Rumpf; beim ersten Mal
   merkt er sich Kennung → Schlüssel) und die Freigabe, und stellt aus: `id` der Anforderung, `kind`, `instance`,
   Grenzen, `days`, `issued`, `request` = Fingerabdruck, `sig` mit dem Lizenzschlüssel.
4. **Einlösen** (⚿ Einlösen): die Instanz nimmt nur Schlüssel an, zu denen sie selbst eine Anforderung mit passendem
   Fingerabdruck, eigener Kennung, eigenem öffentlichem Schlüssel und gleicher Art hat — und die noch nicht eingelöst
   sind. Geschrieben wird `KeyRedeemed` im Strom des Teams; das Journal sagt, was eingelöst ist.

Die Anforderungen liegen in der Tabelle `anforderung` (nicht im Journal: sie sind Sache dieser Instanz, nicht der Daten).
Was die Signaturen nicht leisten: wer Datenbank und Programm besitzt, kann beides kopieren oder die Prüfung entfernen —
sie machen Vervielfältigung zu einer bewussten Handlung statt zu einem Nebeneffekt.
