# Betrieb

Stand 16.09.2026. Der Server ist `Journali.Server` (ASP.NET Core, net8.0),
das Journal liegt in PostgreSQL 18. Das Passwort steht nie im Repo.

## Entwickeln auf dem PC

Nur zum Entwickeln. Betrieben wird journali als Paket aus `compose.yaml`, Server und Datenbank zusammen (README →
Installation).

Der Server läuft lokal, die Datenbank irgendwo im Netz. Beim ersten Start fragt der Server im Browser nach ihr
(Abschnitt Einrichtung): Host, Port, Datenbank, Anmeldename, Passwort und der Einrichtungscode aus dem Fenster
„journali“. Die Verbindung liegt danach in `Journali.Server/jobs/db.json` — einmal je Arbeitsplatz, nie im Repo.
Datenbank und Tabellen legt der Server selbst an.

Dann F5 in Visual Studio (Profil `Journali.Server`, `http://localhost:5000`,
öffnet `/health`) oder:

```bash
dotnet run --project Journali.Server
```

Im Hintergrund, in einem eigenen Fenster „journali":

```bash
tools\server start
```

`tools\server stop` beendet `Journali.Server.exe`, `restart` beides, `status` ruft `/health`. Das Fenster bleibt nach
dem Ende offen, damit man sieht, warum.

## Einrichtung

Wohin der Server sich verbindet, steht in `db.json` im Datenverzeichnis (`JOURNALI_JOBS`; im Paket das Volume,
beim Entwickeln `Journali.Server/jobs/`) — geschrieben vom Einrichtungsdialog, das Passwort verschlüsselt. Ohne
`db.json` gilt die Umgebung: `JOURNALI_DB` (Verbindungszeichenfolge) und `JOURNALI_DB_PASSWORD`; im Paket setzt
`compose.yaml` beide. Der Dialog gilt vor der Umgebung, damit ein korrigiertes Passwort den Neustart überlebt;
„⟲ verwerfen“ löscht `db.json`, dann gilt wieder die Umgebung (`Einrichtung.cs`).

| Lage beim Start | Browser | Server |
|---|---|---|
| keine Verbindung eingerichtet | Datenbank-Dialog | Einrichtungsstufe auf derselben Adresse |
| Datenbank nicht erreichbar | Dialog, vorbefüllt, „Versuch n“ und der Grund (Host unbekannt, Port abgewiesen, Zeitüberschreitung) | versucht es alle 5 s neu und geht selbst weiter — bis im Dialog geprüft oder gespeichert wird |
| Anmeldung abgewiesen (falsches Passwort) | Dialog, vorbefüllt | wartet auf Eingabe, wiederholt nicht |
| Datenbank fehlt | — | legt sie an; ohne Recht dazu sagt es der Dialog |
| verbunden, noch kein Anwender | Anmeldeseite: ersten Administrator anlegen | offen wie bisher |
| verbunden, Administratoren ohne Passwort | Anmeldeseite: Passwort für einen von ihnen festlegen | — |
| verbunden, normal | Anmeldung | Betrieb |
| Datenbank bricht im Betrieb weg | Streifen oben „Datenbank nicht erreichbar“ | antwortet 503 mit `db: false`, verbindet neu, sobald sie zurück ist |

**Das Datenbankpasswort im Paket.** Der Dienst `db-passwort` erzeugt beim ersten Start eines (24 zufällige Bytes,
Base64) und legt es ins Volume `journali-secrets`; steht in `.env` ein `JOURNALI_DB_PASSWORD`, nimmt er dieses. Postgres
liest es über `POSTGRES_PASSWORD_FILE`, der Server über `JOURNALI_DB_PASSWORD_FILE`. Später ändern wirkt nicht —
Postgres übernimmt ein Passwort nur beim allerersten Start.

Wer die Datenbank selbst sichert, braucht es. Zwei Wege:

```bash
docker compose exec server cat /run/journali/db-password
```

oder ⚙ Einstellungen → ⇅ B&R → **⛁ Datenbank**: Host, Port, Datenbank, Anmeldename — und das Passwort nach Eingabe des eigenen
Anmeldepassworts in einem eigenen Fenster (Recht `users`, `GET /api/backup/db`, `POST /api/backup/db/password`). Nach einer Minute ist es
wieder verdeckt; jede Anzeige steht im Serverlog.

Ohne die Datenbank aus dem Paket (eigener Cluster) fällt der Dienst `db-passwort` weg: dann setzt man `JOURNALI_DB`
und `JOURNALI_DB_PASSWORD` in der Umgebung oder trägt die Verbindung im Einrichtungsdialog ein.

**Einrichtungscode.** Solange etwas einzurichten ist — Datenbank, erster Administrator, Passwort eines
Administrators —, erzeugt der Server einen Code, schreibt ihn in die Konsole und nach `einrichtungscode.txt` im
Datenverzeichnis. Dialog und Anmeldeseite verlangen ihn; ein falscher kostet eine Sekunde. Wer den Code sieht, hat
Zugang zum Server — wer nur den Port erreicht, kann weder die Verbindung umlenken noch sich zum Administrator machen.
Im Paket: `docker compose logs server`. Ist alles eingerichtet, ist der Code weg.

## Medien

Die Bytes liegen ausserhalb des Journals, adressiert über den SHA-256; das Journal
kennt nur den Hash. **Wo** sie liegen, ist ein Treiber per `JOURNALI_MEDIA`:

| `JOURNALI_MEDIA` | Treiber |
|---|---|
| `postgres` (Vorgabe) | Tabelle `media_blob` in derselben Datenbank — ein Paket, lauffähig, `pg_dump` sichert alles; für grosse Bestände auf `s3` wechseln |
| `/pfad` | Verzeichnis, Unterordner nach den ersten zwei Hexzeichen |
| `s3://bucket` | S3-kompatibel (Garage, MinIO, AWS, R2, Hetzner …), Signature V4 ohne SDK; dazu `JOURNALI_S3_ENDPOINT`, `JOURNALI_S3_KEY`, `JOURNALI_S3_SECRET`, optional `JOURNALI_S3_REGION` (Vorgabe `garage`), `JOURNALI_S3_PATHSTYLE=false` für `bucket.endpoint` |

Regel: **ein Journal, ein Speicher.** Zwei Instanzen am selben Journal (PC und Container) zeigen auf denselben
Speicher — dieselbe Postgres-Datenbank oder denselben Bucket; sonst fehlen der einen die Bytes der anderen.

**Einstellen** unter ⚙ Einstellungen → ▨ Storage: Treiber, Zugang — prüfen, speichern; die Einstellung
liegt als `media.json` im Datenverzeichnis (`JOURNALI_JOBS`, neben `db.json`), nie im Journal, und geht der
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

## Gegen eine vorhandene Datenbank (Unraid und ähnliche)

Steht die Datenbank schon — auf Unraid etwa das Template `postgresql18` aus den
Community Apps (Nutzer `postgres`) —, bringt das Paket keine zweite mit.
Host und Port kommen aus `.env` (`JOURNALI_DB_HOST`, `JOURNALI_DB_PORT`).

Der Server bringt die Oberfläche mit (Dockerfile baut sie mit Node in der
ersten Stufe). Für den Server gibt es zwei Wege:

1. **Image** — `Dockerfile` im Repo, gegen die vorhandene Datenbank mit
   `compose.extern.yaml`: auf dem Server im Checkout `cp .env.example .env`,
   Host, Port und Passwort eintragen, `docker compose -f compose.extern.yaml up --build -d`
   → `http://<host>:8080`. Das Image baut die Oberfläche selbst (Node-Stufe),
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

**Keine Debugsymbole in der Auslieferung**: Image und
Publish-Ordner werden mit `-p:DebugType=none -p:DebugSymbols=false` gebaut,
also ohne `.pdb`. Das nimmt einem Leser die Dateipfade und Zeilennummern; die
DLLs sind IL und bleiben mit einem Dekompilierer lesbar (Namen und Logik, ohne
Kommentare) — technisch dagegen hülfe nur NativeAOT. Den Rest regeln Lizenz
und Vertrag. Die Oberfläche geht ohnehin minifiziert und ohne Source Maps
heraus; die Plugins liegen als Quelltext im Image, das ist so gewollt.

## Unraid — als App

journali läuft auf Unraid wie jede andere App: eine Vorlage (`unraid/journali.xml`) für den Server, eine zweite
(`unraid/journali-db.xml`) für die Datenbank. Das Image kommt aus einer Registry — für alle aus `ghcr.io` (Community Applications), für den eigenen
Betrieb aus der Container-Registry der eigenen Gitea, gebaut von `.gitea/workflows/docker.yml` bei jedem Push auf
`master`. Unraid meldet einen neuen Stand dann wie bei jeder App.

**Die eigene Gitea als Registry.** Gitea und Docker laufen auf demselben Server, darum spricht der Workflow die
Registry als `127.0.0.1:<Port>` an: eine Registry ohne https nimmt Docker nur über `localhost` an, und so bleibt der
Docker-Dienst unangetastet (auf Unraid liegt `/etc` im RAM — eine `daemon.json` überlebte den Neustart nicht). Das
Image zieht dadurch nur dieser eine Server; für andere Rechner im Netz bräuchte es https oder `insecure-registries`.

**Einmal einrichten:**

1. **Datenbank** — `unraid/journali-db.xml` auf den USB-Stick kopieren (`config/plugins/dockerMan/templates-user/`)
   und als Vorlage installieren: Image `pgvector/pgvector:pg18`, also Postgres 18 **mit der Erweiterung `vector`**.
   Passwort für `postgres` setzen; der Port ist frei wählbar (Vorgabe 5432) und wird beim Einrichten von journali
   gebraucht. Die Erweiterung selbst legt journali beim ersten Start an (`Vectors.cs`: `CREATE EXTENSION IF NOT
   EXISTS vector`) — ohne sie läuft alles ausser der Suche nach Sinn, der Frage an die Dokumente und dem Band
   „Ähnliche Knoten“. Eine vorhandene `postgresql18`-App tut es also auch, nur eben ohne diese drei.
2. **Actions einschalten** — im Repo *Einstellungen* → *Actions*.
3. **Runner** — ein Container `act_runner` aus `gitea/act_runner:latest`:
   - `GITEA_INSTANCE_URL` = Adresse der Gitea, `GITEA_RUNNER_NAME` = frei,
     `GITEA_RUNNER_REGISTRATION_TOKEN` aus `gitea actions generate-runner-token` (im Gitea-Container als Nutzer `git`)
     oder aus *Administration* → *Actions* → *Runners*
   - `CONFIG_FILE=/data/config.yaml`
   - Pfade: `appdata/act_runner` → `/data`, `/var/run/docker.sock` → `/var/run/docker.sock`
   - `/data/config.yaml`: Label `ubuntu-latest:docker://docker:cli` und `container.valid_volumes: [/var/run/docker.sock]`.
     Den Socket reicht der Runner selbst in den Job-Container — ihn zusätzlich über `container.options` zu binden,
     lässt den Job mit „Duplicate mount point“ scheitern. Das Job-Image `docker:cli` (168 MB) bringt Docker und git mit,
     aber kein Node: darum kommt der Workflow ohne JS-Aktionen aus (`git clone` statt `actions/checkout`).
4. **Token für die Registry** — das Token, das Gitea einem Lauf mitgibt, darf keine Pakete schreiben
   (`docker login` antwortet mit `unauthorized`). Ein Zugangstoken mit `write:package` anlegen
   (*Einstellungen* → *Anwendungen*, oder `gitea admin user generate-access-token --scopes write:package`) und im Repo
   unter *Einstellungen* → *Actions* → *Geheimnisse* als `REGISTRY_TOKEN` hinterlegen.
5. **Bauen** — ein Push auf `master` (oder im Repo *Actions* → `docker` → *Ausführen*). Danach steht das Paket
   `journali` unter *Pakete*; lesen darf es jeder, der den Besitzer sehen darf — der Server zieht es also ohne Anmeldung.
6. **Vorlage** — `unraid/journali.xml` auf den USB-Stick des Servers kopieren
   (`config/plugins/dockerMan/templates-user/my-journali.xml`) und `Repository` auf
   `127.0.0.1:<Gitea-Port>/<besitzer>/journali:latest` stellen.
7. **Installieren** — *Docker* → *Add Container* → *Template*: `journali` → *Apply*. Danach steht die App auch unter
   *Apps* → *Previous Apps*.
8. **Einrichten** — *WebUI* öffnen: der Einrichtungsdialog fragt die Datenbank ab (Host = Adresse des Servers, Port und
   Passwort aus Schritt 1, Benutzer `postgres`) und legt den ersten Administrator an.
9. **Vektoren** — in ⑁ Plugins `embed` einschalten und im Tasker den Job starten. Der erste Lauf holt das Modell
   (etwa 120 MB) nach `.cache` im Plugin-Verzeichnis und dauert darum länger; die Laufzeit für ONNX steckt schon im
   Image (`Dockerfile`, Stufe `embed`).

Die Vorlage bringt Port 8080, das Datenverzeichnis (`/data/jobs` → `appdata/journali`: Verbindung zur Datenbank, Jobs,
Schnappschuss, Spiegel) und `JOURNALI_MEDIA` mit.

**Ein neuer Stand:** Push auf `master` — der Runner baut, und das Image liegt danach fertig im Docker des Servers.
Dann im Docker-Tab von *Basic View* auf *Advanced View* umschalten und am Container **force update** klicken; er wird
mit dem neuen Image neu erstellt. Unraid meldet den Stand dieser Registry nicht von selbst („not available" statt
„update ready"): es fragt Registries fest über `https` ab (`DockerClient.php`), die eigene Gitea spricht http. Am Image
und am Aktualisieren ändert das nichts — nur die Anzeige bleibt leer.

**Für alle:** dieselbe Vorlage mit `ghcr.io/journalipim/journali:latest` (öffentliches Paket) in einem öffentlichen
Repo, angemeldet bei den Community Applications.

## Verteilen

**Image:** `ghcr.io/journalipim/journali` — `latest` ist der Stand von `master`, `1.2.3`/`1.2`/`1` ein Tag `v1.2.3`,
`sha-<kurz>` jeder Commit. Gebaut vom Workflow `.github/workflows/docker.yml` aus dem Dockerfile (linux/amd64);
das Paket ist so sichtbar wie das Repo, `docker pull` ohne Anmeldung braucht ein öffentliches Paket.
`compose.yaml` nennt das Image und behält `build: .` — `docker compose pull` holt es, `docker compose up --build`
baut es aus dem Checkout unter demselben Namen. Neuer Stand: `docker compose pull && docker compose up -d`.

`compose.yaml` ist das ganze Paket: Server + `pgvector/pgvector:pg18` (PostgreSQL 18 mit der Erweiterung
`vector` für die Vektoren, pflegestruktur 35) mit eigenem Volume. Wer eine eigene Datenbank ohne die Erweiterung
betreibt, verliert nichts als die Suche nach Sinn — `GET /api/docs/embed` sagt es. Plugins kommen per Bind-Mount `./plugins:/app/plugins` vom Host:
eine Datei dort tauschen aktualisiert das Plugin ohne neues Image (der
Server liest Manifeste und Module bei jedem Zugriff, `no-cache`; eine neue
Fassung erscheint unter ⌁ Plugins als ↑ Update). Prozess-Plugins brauchen
`node` im Laufzeit-Image — das Dockerfile kopiert die Binärdatei aus
`node:22`. Basis-Plugins (table, da, tasker) liegen ebenfalls unter `plugins/`
— auch ihre Ansichten lassen sich so austauschen; gebaute Plugins (`src/` →
`entry.js`) kommen fertig gebaut aus dem Repo, das Image baut nur `web/`. Jobs (Logs) liegen im Volume `journali-jobs`. `.env.example` nach `.env` kopieren, Passwort eintragen,
`docker compose up --build`. Der Server wartet, bis Postgres bereit ist
(Healthcheck), und legt Datenbank und Tabelle selbst an.

## Benutzer & Rollen

Ohne Benutzer ist der Server offen wie bisher (`X-Actor` frei — Intranet). Der erste Aufruf von `/login`
legt den ersten Administrator an (`POST /api/auth/setup`); ab dann braucht alles unter `/api` ausser
`/api/health` und `/api/auth/*` eine Sitzung (Cookie `journali.session`, 30 Tage) oder ein Token
(`Authorization: Bearer …`), und der Urheber jedes Eintrags kommt aus der Sitzung — der Client kann
`X-Actor` nicht mehr wählen.

**Rollen sind Daten, Rechte sind Code**. Das Rechte-Vokabular (`Rights` im Kern) ist fest,
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
Lauf erlischt. Geheimnisse liegen im **Tresor** (`Tresor.cs`): mit Datenbank die Tabelle `tresor`, je Stück eine
Zeile (`auth`, `mail`, `secrets`), AES-GCM verschlüsselt; Passwörter als PBKDF2-SHA256 — nie im Journal. Alle Server
auf derselben Datenbank teilen ihn. `auth.json`, `mail.json` und `secrets.json` von früher übernimmt der erste Start
(was im Tresor fehlt, kommt dazu) und benennt sie in `….uebernommen` um. Der letzte Benutzer mit dem Recht
`users` lässt sich nicht sperren oder entfernen. Hosting: Anmeldung ist Pflicht, bevor eine Instanz ins Internet geht.

**Ausgesperrt?** Hat kein Administrator ein Passwort (Tresor leer, etwa bei einer Datenbank aus einer Sicherung ohne
Zugänge), zeigt die Anmeldeseite „Administrator-Passwort festlegen“: einen der Administratoren wählen, Passwort und
Einrichtungscode eingeben. Ohne Browser: einmalig mit `JOURNALI_ADMIN_PASSWORD=<neues Passwort>` (optional
`JOURNALI_ADMIN_USER`, Vorgabe `admin`) starten: der Start setzt das Passwort neu, legt den Benutzer an, wenn er fehlt,
und sagt es in der Konsole. Danach die Variable wieder entfernen.

### Sichtbar für Rollen

Ein Teilbaum oder ein Ordner der Bibliothek kann Rollen nennen, die ihn sehen (Kontextmenü im Baum „Sichtbar für
Rollen …“, 🔒 am Ordner). Es gilt ab dort abwärts, bis ein Nachfahre eigene Rollen nennt; leer heisst für alle.
Rollen mit dem Recht `users` und die Jobs sehen immer alles; ohne Anwender gilt keine Einschränkung. Wer etwas nicht
sieht, bekommt es nirgends: nicht in Listen, nicht in der Suche, nicht als Datei (403).

## KI

journali bietet keine KI an und hat keinen eigenen Schlüssel; kein Anbieter ist im Code bevorzugt. Der Schlüssel liegt **am Team** (⚙ Einstellungen → ◍ Team), im Datenverzeichnis
des Servers (Tresor, Stück `secrets` unter `team:<key>`), nie im Journal und nie im Browser. Gefragt wird
über `POST /api/ai/ask`: der Server nimmt den Schlüssel des **zahlenden** Teams (`keysFrom`) und das
dort eingetragene Modell. Ohne Team keine KI; dasselbe gilt für Jobs, die über ihr `JOURNALI_TOKEN`
einen Anwender und damit ein Team haben. Eingerichtet werden können **Anthropic**
(`api.anthropic.com`) und **OpenAI** (`api.openai.com`); weitere sind ein Eintrag in `AiApi.Call`.
Der Anbieter bleibt Vertragspartner des Kunden — abgerechnet wird dort.

**Über Tokens und Kosten sagt journali nichts**. Was der Anbieter meldet, wird weder gespeichert
noch angezeigt. Was journali sagt, hat journali selbst gemessen: das **KI-Austauschvolumen** in
Bytes — was hingeschickt und was zurückgekommen ist. Es steht als Kennzahl in der Statuszeile
(Monat, KB/MB/GB) und auf der Teamseite je Tag, aufgeschlüsselt nach Anlass (Editor, Übersetzung,
Klassifikation, Prüfung, Geodaten). Begrenzt wird nichts. Die Recherche im Internet nutzt das
Suchwerkzeug des Anbieters und wird dort je Suche berechnet.

### Vektoren und die Frage an die Dokumente

Die Suche nach Sinn braucht **keinen** Schlüssel: das Plugin `embed` rechnet die Vektoren mit einem lokalen Modell
(`Xenova/multilingual-e5-small`, ONNX) und legt sie in die Datenbank (Erweiterung `vector`). Einrichten: im
Plugin-Verzeichnis `npm install` (im Paket liegen die Pakete im Image), das Plugin einschalten, im Tasker einen Job
des Plugins anlegen und laufen lassen — der erste Lauf holt das Modell (etwa 120 MB) nach `plugins/embed/.cache`
(Volume `journali-embed-cache`); danach braucht nichts mehr das Netz. Für Suchfragen hält der Server einen
Kindprozess `node plugins/embed/serve.mjs` vor (`Embedder.cs`). Ein anderes Modell: `JOURNALI_EMBED_MODEL` am Server
**und** der Parameter `model` des Jobs, beide gleich. **Was lokal heisst:** das Modell ist eine Datei (ONNX, etwa 120 MB)
und läuft in Node auf der CPU des Servers; kein Dienst, kein Schlüssel, keine Grafikkarte. Es kommt nicht mit dem
Image, sondern beim ersten Lauf aus dem Netz nach `.cache`. **Ohne Netz:** das Verzeichnis `plugins/embed/.cache` von
einem Rechner mit Netz kopieren (im Paket in das Volume `journali-embed-cache`); dasselbe für die Sprachdaten der
Texterkennung in `plugins/ocr/.cache`. Die Suche nach Sinn braucht danach nichts von aussen — nur die Frage an die
Dokumente ist ein KI-Aufruf über den Schlüssel des Teams. Die **Frage an die Dokumente** (⌕ Dokumente → Fragen,
`POST /api/docs/ask`) ist dagegen ein KI-Aufruf über den Schlüssel des Teams, gezählt wie jeder andere (Anlass `docs`).

## Plugins im Container

Das Image ist autark: es bringt alle Plugins mit, dazu die Pakete der vier, die
welche brauchen (`derive` mit sharp, `docs` mit pdfjs, `embed` mit transformers, `ocr` mit tesseract) und die Node-Binärdatei.
Ein `docker run` allein genügt, nichts wird nachgeladen.

`compose.yaml` legt zusätzlich `./plugins` vom Host darüber, damit ein Plugin ohne
neues Image ausgetauscht werden kann. Ein Bind-Mount **überdeckt** aber alles
darunter — auch die `node_modules` aus dem Image. Darum holen benannte
Volumes genau diese Ordner zurück, dazu das Modell von `embed`:

```yaml
- ./plugins:/app/plugins
- journali-derive-modules:/app/plugins/derive/node_modules
- journali-docs-modules:/app/plugins/docs/node_modules
- journali-embed-modules:/app/plugins/embed/node_modules
- journali-embed-cache:/app/plugins/embed/.cache
- journali-ocr-modules:/app/plugins/ocr/node_modules
- journali-ocr-cache:/app/plugins/ocr/.cache
```

Sie werden beim ersten Start aus dem Image gefüllt. Wer die Pakete eines Plugins
erneuert, entfernt das zugehörige Volume (`docker volume rm journali-docs-modules`)
und startet neu — dann kommen sie wieder aus dem Image.

## Mail

Einstellungen → ✉ Mail: Server, Port, STARTTLS, Benutzer, Passwort, Absender.
Liegt im Tresor (Stück `mail`) — nie im Journal; alle Server auf derselben Datenbank senden über denselben. Das Passwort kommt maskiert zurück; wer das Feld nicht anfasst,
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
die Datenbank: die Plugin-Verzeichnisse und `media.json` im Datenverzeichnis liegen im Dateisystem und fehlen
(der Tresor mit den Zugängen ist dabei — er ist eine Tabelle).
Wer so sichert, muss das Volume mitnehmen.

**Die Vollsicherung** — von Hand unter ⚙ Einstellungen → ⇅ B&R (jeder Tarif) oder als Zeitplan
mit dem Plugin `backup` im Tasker (ab Pro); beide rufen `POST /api/backup` — schreibt einen
Satz, der an nichts hängt — nicht an der Postgres-Fassung, nicht am Schema:

| im Verzeichnis | was |
|---|---|
| `journal.ndjson.gz` | alle Einträge, je Zeile einer, mit Nummer, Zeit, Urheber |
| `media/` | die Blobs — **nur beim Speicher `postgres`** |
| `config/` | `auth.json`, `mail.json`, `secrets.json` aus dem Tresor, `media.json` aus dem Datenverzeichnis |
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
Zeit hingeht: `61242 Einträge in 31556 ms — lesen 30326 ms · anwenden Plugins 728 ms, Tree 199 ms …`. Das Anwenden ist billig; das Lesen über das Netz aus Postgres nicht. Darum führt der Server einen
**lokalen Spiegel** des Journals (`CachedJournal`): `journal-<host>-<port>-<db>.cache.jsonl` im Datenverzeichnis
(`JOURNALI_JOBS`), eine JSON-Zeile je Eintrag. Beim Start kommt alles bis zum Spiegelstand von der Platte, nur der
Rest aus der Datenbank; jeder gelesene oder geschriebene Eintrag wird angehängt. Der Spiegel ist ein Cache, keine
Wahrheit: beim Start wird sein letzter Eintrag gegen die Datenbank geprüft (Nummer, Strom, Typ, Zeit, Nutzdaten) und
die Nummernfolge auf Lücken — bei jeder Abweichung wird die Datei verworfen und alles aus der Datenbank gelesen.
Datei löschen ist jederzeit erlaubt. An und aus steht in ⚙ Einstellungen → ▨ Storage → ▨ Start (dort auch die
Grösse und der Papierkorb); ohne `betrieb.json` zählt `JOURNALI_JOURNAL_CACHE=off`.
Was je Eintrag kostet, wächst mit dem Journal: die Datei ist einmal je Vorgang offen, nicht je
Eintrag; beim Start wird nur die letzte Zeile entschlüsselt (lückenlos = erste Zeile #1 und so viele Zeilen wie die
letzte Nummer); Zeilen vor dem gesuchten Stand werden an ihrer Nummer erkannt, ohne sie zu entschlüsseln; eine beim
Absturz halb geschriebene letzte Zeile wird abgeschnitten statt den Spiegel zu verwerfen. Gemessen an 125 096
Einträgen: Start prüfen 207 ms (vorher ~2,2 s), 50 000 nachholen 127 ms (vorher 7,4 s allein fürs Schreiben).

**Schnappschuss der Abbilder**: `snapshot-<host>-<port>-<db>.json`
im Datenverzeichnis, der Stand aller Abbilder bei #n (`Snapshot.cs` im Kern: System.Text.Json über die Abbild-Klassen samt
privater Felder). Beim Start werden die Abbilder daraus geladen und nur der Rest ab #n angewandt; geschrieben wird er im
Hintergrund nach dem Start, stündlich (wenn Neues dazukam) und beim Beenden. Auch er ist ein Cache: er trägt den
Fingerabdruck der Kern-Logik (`Fingerabdruck.cs`: Typen, Felder, Code der Methoden, Verweise als Namen — Taloan, 24.09.2026)
und fällt, wenn die Abbilder anders rechnen könnten; nicht bei einem neuen Commit, nicht bei Kommentaren, nicht bei
Änderungen an Server oder Oberfläche. Bis dahin war es die ModuleVersionId des Kerns, und in ihr steckte der Git-Commit —
jeder Commit liess ihn fallen. Der Eintrag #n wird gegen das Journal geprüft; bei Abweichung wird die Datei gelöscht.
An und aus ebenfalls in ⚙ Einstellungen → ▨ Storage → ▨ Start; ohne `betrieb.json` zählt `JOURNALI_SNAPSHOT=off`.
Startzeile: „Schnappschuss bis #n“.

## Mehrere Server auf einer Datenbank

Ein Server wendet an, was er selbst schreibt, und liest das Journal sonst nur beim Start. Laufen zwei Server auf
derselben Datenbank (etwa auf dem Server und am Arbeitsplatz), sah deshalb keiner die Einträge des anderen, bis er neu
startete — auch das Journalfenster blieb leer, denn es fragt denselben Server (26.09.2026).

**Nachziehen** holt, was von aussen kam: `Catalog.Nachziehen()` liest ab dem eigenen Stand weiter und wendet alles an,
unter derselben Sperre wie das Schreiben — niemand sieht die Abbilder halb nachgezogen. Der Takt steht in
`betrieb.json` (`nachziehenSekunden`, Vorgabe 2); ohne Datei zählt `JOURNALI_NACHZIEHEN=<Sekunden>`. 0 schaltet es ab:
dann sieht dieser Server fremde Einträge erst beim Neustart. Die Oberfläche merkt es von selbst — sie fragt `/api/health`
alle drei Sekunden, und ein neuer Stand lässt Modell, Knotenansicht und Journalfenster nachladen.

Was das **nicht** löst: zwei Anwender, die gleichzeitig dasselbe Feld ändern. Beide Einträge stehen im Journal, der
spätere gilt — niemand wird gewarnt, nichts geht verloren. Ein **Stapel** (Import, Massenänderung) merkt dagegen, wenn
ein anderer Server dazwischenschreibt: die Nummern passen dann nicht mehr, und die Abbilder werden neu gebaut
(`Catalog.cs`, `NeuAufbauen`) — richtig, aber bei grossem Journal teuer.

## Jobs (fest eingebaut: ⏱ Jobs)

Jobs laufen im Server als Kindprozesse (`JobRunner`), unabhängig vom
Browser: nach Zeitplan (cron, geprüft je Minute; nach einem Stillstand werden
höchstens die letzten 5 Minuten nachgeholt) oder von Hand. Verzeichnis aus
`JOURNALI_JOBS`, Vorgabe `jobs/` neben dem Programm (im Repo ignoriert):
`jobs/<key>/<run>.log` je Lauf; Geheimnisse (Token,
Passwörter) im Tresor, Stück `secrets` — nie im Journal. Der Prozess bekommt `{journali}` (Adresse des
Servers), `{actor}` (`job:<key>`) und die Parameter als Argumente laut
Manifest und als Umgebung `JOURNALI_<PARAM>`. Nur Plugins mit `process` im
Manifest können Jobs; mitgeliefert: `backup` (Rohdaten-JSON eines Teilbaums
oder aller Wurzeln, behält die letzten n Dateien).

Parameter (`process.params`: `key`, `label`, `type`, `default`, `secret`) — Typen: `text`, `number`, `boolean`,
`node` (Auswahlbaum, Wert ist die Knoten-Id), `pub` (Publikationsbaum), `profile` (Dropdown der gespeicherten
Profile des Plugins — `profile:<name>` oder `config:<name>` im Plugin-Strom; jeder Parameter mit `key: profile`
bekommt es auch ohne den Typ), `dir` (Verzeichnis auf dem Server) und
`path` (Datei, Verzeichnis oder URL). **Alles im Profil**: hat ein
Prozess einen Parameter `profile`, zeigt der Job-Dialog nur Profil, Dateien/Verzeichnisse und Schalter; Baumknoten,
Texte und Geheimnisse stehen unter „Überschreiben (leer = wie im Profil)“. Der JobRunner liest `profile:<name>`
(sonst `config:<name>`) aus den Plugin-Daten und füllt jeden Manifest-Parameter gleichen Namens, den der Job nicht
selbst setzt — die Prozesse selbst bleiben, wie sie sind. Plugins mit eigener Ansicht pflegen ihre Profile dort
(IXP, JSON-Import, Solr, Vorlagen-Export — Solr: Kern, Ziel, angehakte Wurzeln als `root` mit Komma, übergangene
Schlüssel); Prozesse ohne Ansicht tragen `"profile": "generic"` und bekommen im Job-Dialog
✎ — ein Formular aus ihren Parametern (Tabellen-Export, Backup, RAG, Datenblatt-Job, JSON-Export).
**Fächer** (`docs/tasker-dateien.md`): Prozesse mit `files` im Manifest bekommen je Job `in/`, `done/`,
`failed/`, `out/` unter einer Basis (Vorgabe `jobs/<key>`, je Job ein Share). Der Tasker wählt den Eingang (Muster,
eine oder alle Dateien, Duplikat nach SHA-256 → `done/…-dup-…` ohne Lauf; leerer Eingang → kein Lauf), füllt
`{inFile}`/`{inDir}`/`{outFile}`/`{outDir}` und den genannten Parameter (`source`, `dir`), wenn der Job ihn leer lässt,
räumt nach dem Lauf auf (`done/` bzw. `failed/` mit Log daneben), belegt Ausgaben (`JobFileConsumed`/`JobFileWritten`),
kopiert `latest` (`out/<key>-latest/`), hält die Aufbewahrung (`10` Läufe, `30d`, leer = alle) und archiviert auf Wunsch
im Medienspeicher. `GET /api/jobs/{key}/files` zeigt es; im Job-Detail steht es unter den Läufen.

Geheimnisse (Token) gehören nie ins Journal, also nicht ins Profil selbst — sie liegen **am Profil beim Server**:
`PUT /api/plugins/{key}/secrets/{profil}` `{values:{token:…}}` (Recht Schreiben; `GET` nennt nur die Schlüssel) in
im Tresor (`secrets`) unter `plugin:<key>:<profil>`; der JobRunner füllt damit, was der Job nicht selbst gesetzt hat.
⇩ Import → IXP hat dafür 🔒 neben dem Token. Bei `dir` und `path` öffnet 📁 den Dateibrowser des **Servers** — derselbe wie
unter Einstellungen → Storage (`GET /api/files?path=…`, `FileApi.cs`, Recht Jobs oder Storage; Oberfläche
`web/src/filePicker.js`, Plugins über `ctx.filePicker`): Wurzeln sind das Datenverzeichnis, das Programm und die
Laufwerke; versteckte Einträge bleiben weg. Die Pfade gelten auf dem Rechner, auf dem der Server läuft — nicht im
Browser.

## Dateibrowser

`GET /api/files` listet ein Verzeichnis des Servers (Recht Jobs oder Storage). Dazu `POST /api/files/dir`
(anlegen) und `PUT /api/files/dir` (umbenennen); beide nehmen nur einen Namen, keinen Pfad — sonst liesse sich
damit an jede Stelle des Dateisystems schreiben. Gelöscht wird über diesen Weg nichts, und Dateien bleiben unberührt.

## Fehlermeldungen

Eine abgelehnte Anfrage antwortet mit `{ error, template, args }`: `error` ist der fertige deutsche Text, `template`
die Vorlage mit `{0}`, `{1}` … und `args` die Werte. Die Oberfläche übersetzt die Vorlage in ihre Sprache
(`web/public/lang/<code>.json`, Schlüssel ist der deutsche Text) und setzt die Werte ein; wer die API ohne die
Oberfläche bedient, nimmt `error`. Stapelfehler (`/api/batch`) tragen dieselben Felder je Befehl.

## Zertifizierte Plugins

Ein `certificate.json` neben `plugin.json`, signiert vom Herausgeber (ECDSA P-256 über Schlüssel, Fassung und den Hash
aller Dateien). `PluginSeal.cs` prüft es bei jedem Lesen der Platte; `GET /api/plugins` liefert `certified`,
`sealIssued`, `sealIssuer`, `sealReason`. Öffentlicher Schlüssel: `PluginSeal.DefaultKey`, überschreibbar mit
`JOURNALI_PLUGIN_KEY`. Katalog: `GET /api/plugins/catalog` und `POST /api/plugins/catalog/{key}/fetch`
(`JOURNALI_PLUGIN_CATALOG`, Vorgabe der Katalog auf GitHub). Alles Weitere: `docs/plugins-zertifizierung.md`.

## Lizenz — je Team

Eine Lizenz für die ganze Instanz gibt es nicht (seit 25.09.2026): jede gehört einem Team. Ein Team bekommt Tarif und
Grenzen durch ein **Abo** (Shop-Schlüssel, Lizenzserver) oder einen **Schlüssel zum Kopieren** (Reset oder Limit), den
es selbst einlöst. Das **Init Team** hat dazu den **Test** einer neuen Instanz; danach gilt für es Kostenlos. Jedes
weitere Team ohne Abo und Schlüssel hat nichts und rechnet über ein anderes ab. Eingestellt wird hier nichts.

### Tarife

`Journali.Core/Projections/Tarife.cs` ist die eine Tabelle; `plan` in Lizenz, Anforderung und Schlüssel nennt den Tarif.

| Tarif | je Woche / Monat | Publikationsbäume | Plugins |
|---|---|---|---|
| Kostenlos (`free`) | 10 000 / 50 000 | 1 | Tabelle: `table`, `csv`, `excel`, `json`; `exceladdin` (Add-in), `ooaddin`, `derive` (Vorschaubilder), `export` — und der `tasker`, den die beiden letzten brauchen (er startet nur Jobs erlaubter Plugins) |
| Pro (`pro`) | 50 000 / 250 000 | 5 | dazu `datasheet`, `xliff`, `xport` (BMEcat), `etim` — und was sie brauchen: `da`; `backup` als Job |
| Pro+ (`proplus`) | 50 000 / 250 000 | 5 | alle („All-Plugin“ zu Pro, gilt systemweit) |
| Enterprise (`enterprise`) | 200 000 / 1 000 000 | ohne Grenze | alle |
| Unlimited (`unlimited`) | ohne Grenze | ohne Grenze | alle |

- **Grenzen** hängen am Team (am Ende der Zahlerkette). **Plugins und Publikationsbäume** gelten für die ganze
  Instanz nach ihrem **höchsten** Tarif — Test, Abo oder eingelöster Schlüssel irgendeines Teams
  (`Catalog.InstanzTarif`). Ein Plugin ausserhalb des Tarifs lädt nicht, lässt sich nicht installieren, einschalten
  oder als Job starten (403); ein Publikationsbaum zu viel wird am Schreibpfad abgewiesen (`TarifException`, 403).
- **Test des Init Teams:** die Instanz legt ihn selbst an — der Test-Tarif des Tarifblatts (Saatgut: Enterprise) für
  seine Testmonate (Saatgut: drei) ab dem ersten Eintrag im Journal; gespeichert in der Tabelle `licence`
  (`trial: true`). Er gilt höchstens bis erster Tag + Testmonate, gleich was gespeichert ist. Der erste Tag kommt aus
  dem Journal und fährt mit jeder Sicherung mit: eine wiederhergestellte Instanz fängt den Test nicht von vorn an.
- **Nach dem Test** gilt für das Init Team **Kostenlos** — auch im laufenden Betrieb; stündlich zieht der Server seine
  Limits nach (`LimitsAusLizenz`).
- **Die Grenzen sagt der Tarif** (Tarifblatt, Saatgut `Tarife.cs`): was „Kostenlos“ heisst, bedeutet in jeder Anlage
  dasselbe. Ein Limit-Schlüssel oder ein Abo gibt einem Team zeitlich mehr.
- **Reset-Schlüssel** gibt es getrennt für Pro (gilt für Pro und Pro+) und Enterprise; kostenlos gibt es keinen,
  Unlimited braucht keinen.
- Unlimited steht in den Zahlen als `int.MaxValue` (`Tarife.Ohne`); die Oberfläche zeigt ∞.

**Der Verbrauch lässt sich nicht zurücksetzen** — er sind die Einträge im Journal, und das Journal ist die Wahrheit.
Was ein **Reset-Schlüssel** darf, ist einen **Anfang setzen**: das Team zählt ab dem Einlösen neu, alles davor bleibt
stehen und zählt nicht mehr mit. Das ist auch der Weg nach einer Migration, deren Altdaten keine Pflege waren.

**Ohne Kontingent keine Pflege**: Einträge, die zählen, weist der Server ab (403), sobald der Zähler voll ist.
Ein **Joblauf** hört schon bei 90 % auf (`Limits.JobReserve`) — die letzten 10 % gehören der Handarbeit — und er
**pausiert**, statt zu sterben. Fortgesetzt wird er nur von Hand: sonst nähmen wartende Jobs das neue Kontingent im
selben Moment wieder weg.

Ein Team mit **eigenem Schlüssel** rechnet beim Anbieter selbst ab — dort begrenzt journali nichts. Teams ohne eigenen Schlüssel arbeiten über den
Schlüssel der Anlage (Tresor `secrets` unter `licence`, ersatzweise `JOURNALI_AI_KEY`) und zählen gegen das KI-Limit.

Echtheit: Schlüssel, Abo-Stand und Tarifblatt tragen eine ECDSA-P-256-Signatur (SHA-256, Base64), geprüft mit dem
öffentlichen Schlüssel des Lizenzservers, der in journali eingebaut ist (`Core.Licensing.Aussteller`). **Nur
Signiertes zählt** (seit 25.09.2026). Eine Lizenzdatei von früher, die noch in der Tabelle `licence` steht, zählt
nicht, wenn ihre Signatur nicht passt; eingespielt wird keine mehr. Im Debug-Bau (`dotnet run`) nimmt
`JOURNALI_LICENCE_KEY` einen Prüf-Aussteller für die Entwicklung dazu; der Release-Bau kennt die Variable nicht.
Test, Kennung (`instance`, Tabelle `instanz`) und Anforderungen gehen **nicht** in die Vollsicherung — eine
wiederhergestellte Instanz ist eine neue.

### Abo über den Lizenzserver (Taloan, 24.09.2026)

Ein Team mit Abo aus dem Shop (Lemon Squeezy) fügt den **Lizenzschlüssel aus dem Shop** in dasselbe Feld ein
(⚙ Einstellungen → Team → Lizenz); der Knopf heisst dann „⚿ Abo verbinden · Team“. Der Server schickt eine mit dem
Schlüsselpaar der Instanz signierte Anfrage an den Lizenzserver und legt dessen signierte Antwort als
`EntitlementReceived` ins Journal des Teams: Tarif, Grenzen, Status, bezahlt bis, gilt ohne neue Abfrage bis.
Stündlich sieht er nach und fragt neu, wenn der letzte Stand älter als 20 Stunden ist. Ein Stand gilt bis zum
früheren von „bezahlt bis“ und „ausgestellt + 7 Tage“ — ohne Verbindung also höchstens eine Woche; danach gilt, was
das Team ohne Abo hat. Ein Abo hebt die Grenzen an, senkt nie; sein Tarif zählt für den höchsten Tarif der Instanz.

Die Adresse des Lizenzservers ist eingebaut (`Core.Licensing.Aussteller.Adresse`) — nichts einzustellen, und im
Release-Bau nicht zu ändern. Sie schützt nichts; das tut der eingebaute Schlüssel daneben: wer die Anfrage
woandershin lenkt, bekommt keinen Stand, den journali annimmt. Nur der Debug-Bau nimmt `JOURNALI_LIZENZSERVER`
an, damit die Entwicklung gegen einen eigenen Lizenzserver arbeiten kann.

Ein Stand ohne passende Signatur wird nicht übernommen. Mit jedem Stand kommt das **Tarifblatt** des Lizenzservers.

#### Tarifblatt

Welche Tarife es gibt — Grenzen je Woche und Monat, Publikationsbäume, Plugins, dazu Tarif und Dauer des Tests —
sagt der Lizenzserver, nicht das Image: er signiert ein Tarifblatt mit Fassungsnummer und liefert es mit jedem
Abo-Stand und jedem Schlüssel zum Kopieren aus. journali legt eine neuere Fassung als `TarifeReceived` ins Journal
(Strom `tarife`); ab dann gilt sie für Pakete, Plugins, Bäume, die Lizenz des Init Teams und den Test. Eine ältere
Fassung oder eine ohne passende Signatur ändert nichts — auch nicht beim Neuaufbau, das Abbild prüft selbst. Ohne
Tarifblatt gilt das Saatgut aus `Tarife.cs`. Die Grenzen eines Abos stehen zusätzlich im signierten Stand selbst: ein
gesenkter Tarif greift dort erst mit der nächsten Verlängerung.

Der Lizenzschlüssel aus dem Shop liegt beim Server (`jobs/secrets.json`, `abo:<team>`), nie im Journal; er geht mit
der Vollsicherung (Zugänge) mit. Der Lizenzserver selbst liegt in einem eigenen, privaten Repository.

### Schlüssel — Reset und Limit, signiert angefordert

Zusätzlich zur Lizenz gibt es Schlüssel, einmal einlösbar, an die Instanz gebunden, **ohne Team** —
Eine **offene Anforderung** lässt sich wegwerfen (⚙ Einstellungen → Lizenz, `DELETE /api/licence/requests/{id}`);
ein Schlüssel dazu ist danach nicht mehr einlösbar. Eine eingelöste bleibt — sie steht im Journal.
die zentrale IT legt sie auf Vorrat und wählt das Team beim Einlösen:

| Art | Wirkung |
|---|---|
| `reset` | das Team zählt ab dem Einlösen neu — ab dem Eintrag, nicht ab dem Tag: was am selben Tag vorher gezählt war, zieht `Usage.Cuts` ab (verschiebt nur den Zählbeginn des Teams, nie den der Instanz) |
| `limit` | `entriesWeek`/`entriesMonth` für `days` Tage ab dem Einlösen; hebt an, senkt nie. Läuft schon eines, wird dessen **Restvolumen** in Tage des neuen umgerechnet und angehängt (`Schluessel.Bis`) |

Ein Limit wird als **Paket** angefordert, nie mit freien Zahlen: `pro`, `ultimate`, `enterprise`
(`Schluessel.Pakete`, `GET /api/licence/packages`); die Anforderung trägt `plan` und die Zahlen des Pakets. Die Zahlen
der Pakete sind vorläufig.

Beide sind kombinierbar; ein Limit überschreibt keinen Reset. Eingelöst wird beim Team, das sein Kontingent selbst
trägt — wer über ein anderes abrechnet, bekommt den Schlüssel dort.

Der Weg eines Schlüssels:

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
