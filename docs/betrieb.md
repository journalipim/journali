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
   Kommando; nur Plugin-Änderungen brauchen kein neues Image. Prozess-Plugins
   auf Python-Basis (solr_import.py) laufen im Image nicht — es enthält nur node.
2. **Publish-Ordner** — ohne Image: vom PC erst `tools\server build`, dann
   `dotnet publish Journali.Server -c Release -o <Freigabe>\journali`
   (nimmt `wwwroot` mit),
   Container aus `mcr.microsoft.com/dotnet/aspnet:8.0` mit dem Ordner
   als `/app`, Befehl `dotnet Journali.Server.dll`, Port 8080, dieselben
   Umgebungsvariablen. Änderung = neu publishen, Container neu starten.

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
(Taloan, 20.09.2026). Wer die KI-Funktionen nutzt (Datenqualität, DPP/PPWR/ETIM-Zuordnungen,
Anreicherung, GEO-Texte, Editor), trägt unter ⚙ Einstellungen → KI je Anbieter seinen Schlüssel
und das Modell ein und wählt, wen die Plugins fragen. Eingerichtet werden können (`web/src/ai.js`,
`PROVIDERS`): **Anthropic** (`api.anthropic.com`) und **OpenAI** (`api.openai.com`); weitere sind
ein Eintrag in dieser Liste. Schlüssel bleiben im Browser (localStorage), nie im Journal, nie auf
dem Server. Die Anfragen gehen direkt aus dem Browser an den Anbieter — der Betreiber von journali
ist an diesem Datenfluss nicht beteiligt (für Hosting: der Anbieter ist damit kein Unterauftragnehmer
des Betreibers, sondern Vertragspartner des Kunden). Übertragen werden die Daten des jeweils
gewählten Knotens, nur auf Klick. Die Recherche im Internet (Anreicherung, Plugin `enrich`) nutzt
das Suchwerkzeug des Anbieters und wird dort je Suche berechnet.

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
Datei löschen ist jederzeit erlaubt. `JOURNALI_JOURNAL_CACHE=off` schaltet den Spiegel ab. Bei Millionen Einträgen
bleibt das Anwenden (heute ~18 µs je Eintrag) — dann kommen Schnappschüsse der Abbilder (offen).

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

