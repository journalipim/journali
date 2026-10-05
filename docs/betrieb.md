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
liegt im Tresor (Stück `media`, verschlüsselt in der Datenbank; ohne Datenbank als `media.json` im Datenverzeichnis), nie im Journal, und geht der
Umgebung vor. Seit dem 03.10.2026 gilt sie damit für alle Server auf derselben Datenbank: stellt einer um, folgen die anderen binnen 10 Sekunden.
Eine `media.json` von früher übernimmt der Start in den Tresor, wenn dort noch keine Einstellung steht (danach `media.json.uebernommen`). Der
Treiber „Verzeichnis“ meint auf jedem Server dessen eigene Platte — mit mehreren Servern taugt er nur mit einem gemeinsamen Netzlaufwerk. Dort auch Fehlbestand zählen und Blobs aus einem anderen Speicher herüberkopieren.

**Treiber wechseln** ohne neue Ids: neue Angabe setzen, starten, dann `POST /api/media/copy {"from": "<alte Angabe>"}`
(X-Actor) — kopiert alle Blobs, die hier fehlen, Hash-geprüft: passt der SHA-256 der Bytes nicht zum Namen, wird der Blob nicht übernommen
und als fehlgeschlagen gezählt. `GET /api/media/missing` zeigt Medien ohne Bytes, `GET /api/media/store` den aktiven Treiber. Vorschauen
(`sha.<preset>`) rechnet der Systemjob des Plugins `derive` nach jedem Hochladen und legt sie im selben Store ab; der Server braucht kein Bildpaket.

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

**Die Erweiterung `vector` in einer vorhandenen Datenbank.** Sie wird für die Suche nach Sinn, die Frage an die
Dokumente und das Band „Ähnliche Knoten“ gebraucht; ohne sie läuft der Rest. Der Weg ist **das Image tauschen**, nicht
die Erweiterung nachinstallieren: `pgvector/pgvector:pg18` ist `postgres:18` mit der Erweiterung, dasselbe
Datenverzeichnis und dieselben Umgebungsvariablen. Auf Unraid also am vorhandenen Container das *Repository* auf
`pgvector/pgvector:pg18` stellen und *Apply* drücken — der Container wird neu erzeugt, das Volume bleibt, die Daten
bleiben. Die Erweiterung selbst legt journali beim ersten Start an (`Vectors.cs`: `CREATE EXTENSION IF NOT EXISTS
vector`); dafür braucht der Datenbankbenutzer das Recht dazu (`postgres` hat es).

Ein `apt-get install postgresql-18-pgvector` im laufenden Container tut es auch — aber nur bis zum nächsten Update:
Unraid erzeugt den Container dann aus dem Image neu, und die Erweiterung fehlt wieder. Die Version der Hauptversion
muss beim Tausch dieselbe bleiben (18 → `pg18`); ein Wechsel der Hauptversion ist ein eigener Vorgang mit Dump und
Rückspielen.

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
Version erscheint unter ⬡ Plugins als ↑ Update). Prozess-Plugins brauchen
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
| `download` | Herunterladen: die Datei selbst, ein Preset, ein Blob — sehen ist nicht haben |
| `scriptum.write` | Skripte schreiben und ihren Quelltext lesen — ein Administratorrecht (siehe Skripte) |
| `scriptum.run` | Ein freigegebenes Skript anstossen und sein Ergebnis sehen |

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

journali bietet keine KI an und hat keinen eigenen Schlüssel; kein Anbieter ist im Code bevorzugt.

**Ein lokales Modell** (29.09.2026): `JOURNALI_KI_LOKAL` am Server nennt die Adresse eines Dienstes mit der
Ollama-Schnittstelle (`http://localhost:11434`); `JOURNALI_KI_LOKAL_MODELL` das Modell, sonst das erste, das der
Dienst kennt — wählbar am Team. Dann steht der Anbieter `lokal` jedem Team zur Verfügung, ohne Schlüssel. Ohne die
Umgebungsvariable trägt ein Team die Adresse selbst ein (◍ Team → KI API Keys, Zeile lokal; sie liegt wie ein Schlüssel
beim Server). Die Zeilen des Abschnitts sind Anbieter: Zugang, Modell und der Schalter „aktiv“ — welchen die Plugins fragen,
wählt das Team (im Journal `models["*"]`); die bezahlten Anbieter mit Schlüssel gehen vor, solange keiner gewählt ist. Das lokale Modell sucht nicht im Internet. Gezählt wird es wie die anderen — Volumen ist
Volumen —, aber es kostet nichts: die Oberfläche zeigt es darum nicht magenta, und es darf von selbst laufen.
Die Adresse bleibt beim Server; die Oberfläche sieht nur, dass es ein lokales Modell gibt und welche Modelle.

**Gemessen** (29.09.2026, vier Kerne, acht GB, ohne GPU, `gemma3:4b` mit vier Milliarden Parametern, drei Komma drei GB
auf der Platte): eine kurze Zuordnungsfrage (unter hundert Token Eingabe) antwortet in rund acht Sekunden. Ein ganzes
Datenblatt gegen eine Attributliste (rund zweitausend Token Eingabe, sechzehntausend Token Kontextfenster) braucht rund
anderthalb Minuten, davon der grösste Teil für die Eingabe — vier Komma fünf GB Speicher im Container, mit fünf GB
Grenze knapp, aber ohne Auslagerung. Für kurze Zuordnungs- und Benennungsfragen (Knopf) taugt das; ein ganzes Dokument
lesen ist für einen Knopf, hinter dem jemand wartet, zu langsam — dafür bliebe ein Nachtjob.

Der Schlüssel liegt **am Team** (⚙ Einstellungen → ◍ Team), im Datenverzeichnis
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

**Der Anfang einer Anfrage wird gecacht** (28.09.2026): der Systemtext geht als Block mit `cache_control` an die
Anthropic-API. Wiederholt sich derselbe Anfang innerhalb weniger Minuten — die Attributliste eines Knotens für das
zweite Dokument, der Katalog der Prüfmaschine für den nächsten Knoten —, liest der Dienst ihn aus dem Cache statt ihn
neu zu rechnen und berechnet ihn günstiger. Ein einzelner Aufruf wird dadurch nicht billiger, eine Reihe gleichartiger
schon. Unter der Mindestlänge des Dienstes bleibt der Block ein gewöhnlicher Systemtext. Der andere Anbieter cacht
von sich aus. Das Austauschvolumen zählt weiter, was über die Leitung ging — auch gelesener Cache.

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

Das Image bringt alle Plugins mit, dazu die Pakete der vier, die
welche brauchen (`derive` mit sharp, `docs` mit pdfjs, `embed` mit transformers, `ocr` mit tesseract) und die Node-Binärdatei.
Ein `docker run` allein genügt. Nachgeladen werden nur zwei Dateien, jeweils beim ersten Lauf ihres Plugins (unten).

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

### Hinweis vor dem Einschalten

Ein Plugin, dessen Ergebnis jemand für mehr halten könnte, als es ist, nennt im Manifest einen Hinweis (`acknowledge`: `version`,
`title`, `points`, je Sprache; 05.10.2026). ⬡ Plugins zeigt ihn vor dem Einschalten; eingeschaltet wird nur mit „zur Kenntnis
genommen“, und der Server schaltet nur mit `?hinweis=<version>` ein. Die Bestätigung steht im Journal (`PluginAcknowledged`:
Version und Wortlaut, wer und wann am Eintrag). Ein eingeschaltetes Plugin, dessen geltende Version niemand bestätigt hat, wirkt
nicht; ⬡ Plugins bietet „◐ Hinweis bestätigen“ an (`POST /api/plugins/{key}/acknowledge?hinweis=`). Eine neue Version des Hinweises
verlangt eine neue Bestätigung. Die Saat (`autoInstall`) installiert solche Plugins, schaltet sie aber nicht ein.

| Plugin | Hinweis |
|---|---|
| `dpp`, `ppwr`, `empco` | Hilfsmittel, keine Rechtsberatung: keine Gewähr für Vollständigkeit, Richtigkeit und Aktualität; ob und wie Pflichten erfüllt sind, prüft und entscheidet der Betreiber |
| MCP (geplant) | Zugriff für fremde KI-Agenten: sie arbeiten mit dem Token einer Person, lesend und, wenn die Rolle es erlaubt, schreibend; was ein Agent liest, geht an seinen Anbieter, was er schreibt, steht unter der Person im Journal; ob und welchem Agenten Zugriff gegeben wird, entscheidet und verantwortet der Betreiber |

### Was beim ersten Lauf nachgeladen wird

Zwei Plugins holen beim ersten Lauf eine Datei aus dem Netz; danach liegt sie im Cache des Plugins, und das Plugin
braucht das Netz nicht mehr:

| Plugin | Datei | Adresse | Cache | Lizenz |
|---|---|---|---|---|
| `embed` | Modell `Xenova/multilingual-e5-small` (ONNX, etwa 120 MB) | huggingface.co | `plugins/embed/.cache`, Volume `journali-embed-cache`, `JOURNALI_EMBED_CACHE` | MIT |
| `ocr` | Sprachdaten der Texterkennung je Sprache | cdn.jsdelivr.net | `plugins/ocr/.cache`, Volume `journali-ocr-cache`, `JOURNALI_OCR_CACHE` | MIT |

Dabei geht keine Produktdatei und kein Wert hinaus; die beiden Adressen sehen nur, dass der Server die Datei abruft
(seine IP-Adresse). **Eingeschaltet wird nur mit Zustimmung** (05.10.2026): das Manifest nennt den Download (`download`: `why`,
`what`, `from`, `size`), ⬡ Plugins fragt vor dem Einschalten, und der Server schaltet ein solches Plugin nur mit `?download=ja`
ein. Ohne Zustimmung bleibt es aus; der Einbetter für Suchfragen (`Embedder.cs`) startet nur, solange `embed` an ist. Ein Server ohne Netz bekommt den Cache von einem Rechner mit Netz kopiert (oben, „Vektoren und die
Frage an die Dokumente“). Weitergegeben werden die beiden Dateien von journali nicht — sie stehen weder im Repo noch
im Image.

Lizenzen: `LICENSE` (journali) und `THIRD-PARTY-NOTICES.md` (alles Fremde, mit Quelle) liegen im Repo und im Image
unter `/app`.

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
die Datenbank: die Plugin-Verzeichnisse liegen im Dateisystem und fehlen
(der Tresor mit den Zugängen und dem Medienspeicher ist dabei — er ist eine Tabelle).
Wer so sichert, muss das Volume mitnehmen.

**Die Vollsicherung** — von Hand unter ⚙ Einstellungen → ⇅ B&R (jeder Tarif) oder als Zeitplan
mit dem Plugin `backup` im Tasker (ab Pro); beide rufen `POST /api/backup` — schreibt einen
Satz, der an nichts hängt — nicht an der Postgres-Version, nicht am Schema:

| im Verzeichnis | was |
|---|---|
| `journal.ndjson.gz` | alle Einträge, je Zeile einer, mit Nummer, Zeit, Urheber |
| `media/` | die Blobs — **nur beim Speicher `postgres`** |
| `config/` | `auth.json`, `mail.json`, `secrets.json`, `media.json` aus dem Tresor |
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

**Die Probe liegt beim Betreiber** (05.10.2026). Ob sich eine Sicherung einspielen lässt, hängt an Speicher, Rechten,
Netz und Hardware des Betriebs — das zeigt nur eine Probe: die Sicherung regelmässig in eine leere Testinstanz
einspielen und prüfen, ob Einträge, Medien (auch die in `file` oder `s3`), Anmeldungen und Plugins da sind.
Sicherung, Aufbewahrung und Probe liegen beim Betreiber; journali stellt die Werkzeuge bereit und sagt nicht zu,
dass eine Wiederherstellung gelingt. Die Oberfläche sagt das in ⇅ B&R und im Job-Dialog des Plugins `backup`
(`process.notice` im Manifest — ein Satz, den der Job-Dialog unter der Plugin-Wahl zeigt, `noticeTitle` im Tooltip).

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
Fingerabdruck der Kern-Logik (`Fingerabdruck.cs`: Typen, Felder, Code der Methoden, Verweise als Namen)
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

**Hauptserver und Arbeitsserver** (03.10.2026, `docs/pflegestruktur.md` 41): nur ein Server führt die Systemjobs aus (`derive`, `docs`, `embed`, `probe`) und
frischt das Abo auf. Jeder andere Job läuft auf dem Server, dem er gehört (`JobDefined.Server`; ohne Angabe der Hauptserver), mit dessen Pfaden und Fächern. Wer Hauptserver ist und wer gesperrt ist, steht im Journal (`ServerMainSet`, `ServerBlockSet`); Puls, Version,
Stand und laufende Jobs stehen in der Tabelle `server` (`Verbund.cs`, Takt alle 2 s). Hauptserver ist nur, wer festgelegt ist **und** die Sperre
`pg_try_advisory_lock` hält; ist keiner festgelegt, wird es der erste, der sie bekommt. Fällt er aus, übernimmt keiner von selbst: Einstellungen → ⧉ Server zeigt
das, und dort wird ein anderer festgelegt. Ein Import auf einem Server lässt die Systemjobs auf dem Hauptserver warten. Ein gesperrter Server beantwortet unter
`/api` nur `/api/health`. Die Kennung eines Servers steht in `server.json` im Datenverzeichnis — wer das Datenverzeichnis kopiert, kopiert die Kennung mit; dann
die Datei im neuen Verzeichnis löschen.

**Wie viele Server laufen dürfen** (04.10.2026): ein Server, mit Unlimited beliebig viele, mit dem Zusatz „Multi-Server“ aus einem Abo entsprechend mehr
(`Catalog.ErlaubteServer`). Ein Server über dieser Zahl antwortet unter `/api` mit 503 und führt keine Jobs aus; der Hauptserver hat Vorfahrt. Mit nur
einem erlaubten Server übernimmt der laufende die Rolle des Hauptservers, wenn der festgelegte nicht läuft. ⧉ Server zeigt „⊘ ohne Lizenz“.

Ein Job, der auf einem anderen Server gestartet, angehalten, fortgesetzt oder abgebrochen wird, geht als Zeile in `server_auftrag` (Spalte `an`) an seinen Server;
`NOTIFY journali_server` stösst ihn an, jeder Server wartet darauf mit `LISTEN` und sieht sonst alle 2 s nach. Antwortet er nicht binnen 5 s, wird der Auftrag
zurückgezogen; ein Auftrag, der älter als eine Minute ist, wird nicht mehr ausgeführt. Was dort läuft, steht im Puls des Servers (Spalte `jobs`), das Log
jedes Laufs (die letzten 1 MB) in `job_protokoll` — 30 Tage, die Datei beim Server des Jobs bleibt. Die Adresse, unter der die Jobs ihren Server rufen, ist vor der
ersten Anfrage die eigene (`localhost` und der Port, auf dem er hört).

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
Schlüssel; Tabellen-Export unter ⇪ Export → CSV/Excel; RAG unter ⇪ Export → KI-Wissensbasis). Der Job-Dialog legt
keine Profile an — den generischen Profil-Editor (`"profile": "generic"`) gibt es seit dem 28.09.2026 nicht mehr.
Ein Prozess, dessen Profil „leer = Werte unten“ erlaubt (Datenblatt-Job, JSON-Export), bekommt ohne Profil seine
Werte direkt am Job; vorhandene Profile bleiben wählbar.
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

## Skripte (Plugin scriptum)

Ein Skript ist ein ES-Modul, das **im Journal** steht (Plugin-Daten von `scriptum`, `script:<key>`) und als
Kindprozess läuft — nie im Serverprozess. Geschrieben wird es unter ⌨ Skripte, angestossen von Hand, als Job mit
Zeitplan oder über `/api`; jeder Lauf ist ein Job `scriptum_<key>` mit Log, Zeitgrenze und Fächern.

**Ab Pro+** (29.09.2026): in Kostenlos und Pro gibt es `scriptum` nicht. Ein Skript läuft als Prozess auf dem Server,
und wer eines schreibt, kann alles, was der Serverbenutzer kann — das gehört zu den Tarifen, die auch die
Verantwortung dafür tragen. Ausserhalb des Tarifs lädt das Plugin nicht, lässt sich nicht einschalten und kein Lauf
startet (403).

Der Kopf des Skripts ist sein Formular, das Programm ist seine Standardfunktion:

```js
export const meta = { label: 'Preise prüfen', role: 'editor', params: [{ key: 'root', label: 'Teilbaum', default: '' }] }
export default async function ({ api, params, out, log, journali, actor }) {
  const rows = await api.get('/api/tree')
  return out.table(['id', 'Bezeichnung'], rows.map(r => [r.id, r.label]))
}
```

- **Das Token trägt die Rolle, die am Skript steht** (`meta.role`, sonst `editor`): ein Skript darf nie mehr als ein
  Anwender mit dieser Rolle. `api` spricht `/api` mit diesem Token.
- **Das Ergebnis** ist eine Zeile auf stdout mit der Marke `⟦scriptum⟧`: `{ table }`, `{ text }` oder `{ file }`
  (die Datei liegt im Fach `out/` des Laufs). Alles andere, was das Skript ausgibt, ist Protokoll im Log.
- **Die Grenzen gehören an den Runner**, nicht an das Skript: Zeitgrenze je Lauf (Vorgabe 60 s, am Skript
  einstellbar), höchstens 20 000 Zeilen und 4 000 Zeichen je Zelle, Text bis 200 000 Zeichen. Ein Fehler des Skripts
  ist eine Meldung mit Rückgabewert 1, kein Absturz.
- **Kein Geheimnis im Skript** — Adresse und Anmeldung kommen aus einem Zugang (`driver`) oder dem Tresor; im Journal
  lässt sich nichts löschen.
- **Zwei Rechte.** `scriptum.write` schreibt und liest den Quelltext; wer es hat, kann alles, was der Serverbenutzer
  kann (das Skript läuft als Prozess: was es im Netz und im Dateisystem tut, begrenzt nur das Betriebssystem). Am
  Skript steht, welches Recht sein Lauf braucht (`run`) — damit bedient jemand die Auswertung, ohne je Quelltext zu
  sehen. Den Quelltext bekommt ausserdem der Lauf selbst: ein Dienst-Token gehört einem Prozess auf diesem Server.
- **Endpunkte:** `GET /api/scriptum/scripts` (Liste ohne Quelltext) · `GET|PUT|DELETE /api/scriptum/scripts/{key}` ·
  `GET /api/scriptum/scripts/{key}/source` · `POST /api/scriptum/scripts/{key}/run` ·
  `GET /api/scriptum/runs/{job}/{run}` (Stand, Ergebnis, Protokoll) · `GET /api/scriptum/runs/{job}/{run}/file?name=`.
- **Keine Pakete**, kein Skript, das ein anderes aufruft: nur die Standardbibliothek der Laufzeit, `fetch` und was
  der Kontext anbietet.

## Dateibrowser

`GET /api/files` listet ein Verzeichnis des Servers (Recht Jobs oder Storage). Dazu `POST /api/files/dir`
(anlegen) und `PUT /api/files/dir` (umbenennen); beide nehmen nur einen Namen, keinen Pfad — sonst liesse sich
damit an jede Stelle des Dateisystems schreiben. Gelöscht wird über diesen Weg nichts, und Dateien bleiben unberührt.

## Zugänge (Plugin driver)

Ein Zugang wird einmal unter ⌁ Zugänge eingerichtet und von jedem Plugin nach seiner Art gewählt. Alle Arten gehören
zum Plugin `driver` (`DriverApi.cs`, `Treiber.cs`), keine ist ein eigenes Plugin (28.09.2026):

| Art | Sorte | Felder | Geheimnis |
|---|---|---|---|
| `file` | Dateien | — (eingebaut: `lokal`, das Dateisystem des Servers) | — |
| `webdav` | Dateien | `url`, `user` | `password` |
| `ftp` | Dateien | `host`, `port`, `user`, `pfad` (Startverzeichnis), `tls` (explizites TLS) | `password` |
| `ixp` | Anmeldung | `url` | `token` (Bearer) |
| `solr` | Anmeldung | `url`, `user` | `password` (Basic) |

Die Felder stehen im Journal (`plugin:driver`, `zugang:<key>`), das Geheimnis im Tresor — die Liste nennt nur seinen
Namen. Endpunkte:

- `GET /api/drivers/arten`, `GET /api/drivers` (`?art=`, `?dateien=true`), `PUT`/`DELETE /api/drivers/{zugang}`
- `GET /api/drivers/{zugang}/files?path=`, `POST`/`PUT /api/drivers/{zugang}/dir` — der Dateibrowser eines Zugangs,
  der Dateien liefert; die Antwort hat dieselbe Form wie `/api/files`. Pfade sind relativ zur Wurzel des Zugangs, `..`
  wird abgewiesen.
- `POST /api/drivers/{zugang}/test` — kommt der Zugang an? Dateien: die Wurzel auflisten; Anmeldung: die Quelle
  einmal fragen (Solr: `/admin/ping`). Antwort `{ ok, text }`.
- `GET /api/drivers/{zugang}/relay?path=` — nur bei einer Anmeldung: der Server fragt die Quelle unter ihrer Adresse
  (Pfad relativ, ohne `..`, ohne fremden Rechner) und hängt die Anmeldung an. So liest die Ansicht von IXP und Solr
  ihre Quelle, ohne dass das Geheimnis den Server verlässt.

**Im Job:** ein Parameter vom Typ `driver` (mit `art`) wird im Job-Dialog eine Auswahl der Zugänge dieser Art; der
JobRunner reicht Felder und Geheimnisse als `JOURNALI_<PARAM>_<FELD>` an den Prozess (`JOURNALI_ZUGANG_URL`,
`JOURNALI_ZUGANG_TOKEN`). Steht der Zugang im Profil, füllt ihn der JobRunner wie jeden anderen Parameter daraus.
Die **Fächer** eines Jobs können an einem Zugang liegen, der Dateien liefert (`docs/tasker-dateien.md`).

## Fehlermeldungen

Eine abgelehnte Anfrage antwortet mit `{ error, template, args }`: `error` ist der fertige deutsche Text, `template`
die Vorlage mit `{0}`, `{1}` … und `args` die Werte. Die Oberfläche übersetzt die Vorlage in ihre Sprache
(`web/public/lang/<code>.json`, Schlüssel ist der deutsche Text) und setzt die Werte ein; wer die API ohne die
Oberfläche bedient, nimmt `error`. Stapelfehler (`/api/batch`) tragen dieselben Felder je Befehl.

## Zertifizierte Plugins

Ein `certificate.json` neben `plugin.json`, signiert vom Herausgeber (ECDSA P-256 über Schlüssel, Version und den Hash
aller Dateien). `PluginSeal.cs` prüft es bei jedem Lesen der Platte; `GET /api/plugins` liefert `certified`,
`sealIssued`, `sealIssuer`, `sealReason`. Öffentlicher Schlüssel: `PluginSeal.DefaultKey`, überschreibbar mit
`JOURNALI_PLUGIN_KEY`. Katalog: `GET /api/plugins/catalog` und `POST /api/plugins/catalog/{key}/fetch`
(`JOURNALI_PLUGIN_CATALOG`, Vorgabe der Katalog auf GitHub). Alles Weitere: `docs/plugins-zertifizierung.md`.

## Lizenz — je Team

**Startphase (05.10.2026, `Core.Licensing.Startphase`):** Zurzeit gilt nichts von diesem Abschnitt. Jedes Team hat Unlimited,
kein Eintrag wird wegen eines Kontingents abgewiesen, auf einer Datenbank läuft **ein** Server (kein Multi-Server), und
kein Server fragt den Lizenzserver — weder Abo noch Tarifblatt noch Registrierung (die Adresse ist dann leer). Die
Oberfläche zeigt nichts zu Lizenz, Limits und journali-Token (`/api/health` sagt `startphase: true`). Die Funktionen
bleiben im Code; eine spätere Version schaltet die Startphase ab, und Grenzen gelten dann nur für diese neue Version.
Der Schalter steht in `Program.cs`, nicht in der Umgebung; nur der Debug-Bau schaltet ihn mit `JOURNALI_STARTPHASE=0` ab.
Ein Server aus dem **Debug-Bau** (`dotnet run`, Entwicklung) zählt dabei nicht mit: er trägt sich in der Tabelle `server` als
`entwicklung` ein, ist immer zugelassen und nimmt dem Server des Betriebs nicht den einzigen Platz (`Verbund.Entwicklung`).

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
| Pro+ (`proplus`) | 50 000 / 250 000 | 5 | alle („All-Plugin“ zu Pro, gilt systemweit) — dazu `scriptum` (Skripte), das es in Kostenlos und Pro nicht gibt |
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
- **Vektoren (`embed`) gehören zum Tarif** (03.10.2026): Vorschauen (`derive`) und Bildabmessungen (`probe`) sind in jedem Tarif erlaubt
  (`Tarife.Systemjobs`), die Vektoren nicht — im Tarifblatt Version 11 und in den eingebauten Vorgabe-Tarifen erst ab Pro+. Welcher Tarif sie enthält, steht im
  Tarifblatt des Lizenzservers unter dem Schlüssel `embed`; ein Blatt, das ihn nicht nennt, schaltet sie ab.

**Der Verbrauch lässt sich nicht zurücksetzen** — er sind die Einträge im Journal, und das Journal ist die Wahrheit.
Was ein **Reset-Schlüssel** darf, ist einen **Anfang setzen**: das Team zählt ab dem Einlösen neu, alles davor bleibt
stehen und zählt nicht mehr mit. Das ist auch der Weg nach einer Migration, deren Altdaten keine Pflege waren.

**Ein Grenzwechsel setzt ebenfalls einen Anfang** (03.10.2026, `Teams.Zaehlbeginn`): ändern sich die Grenzen eines Teams — neues Grundkontingent, ein
Stand vom Lizenzserver mit anderem Tarif oder entzogen, ein Limit-Schlüssel beginnt oder endet, ein Abo läuft ab —, zählt das Team ab diesem Eintrag (oder
Tag) neu. Sonst nähme der Wechsel vom Test (Enterprise) auf Kostenlos alles mit, was vorher geschrieben wurde, und das Team stünde von heute auf morgen
still. Gleiche Grenzen sind kein Wechsel: Pro und Pro+ zählen weiter.

**Jeder Job wird über ein Team abgerechnet** (03.10.2026, `Abrechnung`): was ein Lauf schreibt (Urheber `job:<key>`), zählt auf das Team am Job
(`JobDefined.Team`; beim Anlegen das Team dessen, der ihn anlegt oder an den Tasker abgibt). Ohne Team am Job zählt er auf das Team seines Besitzers,
ohne Besitzer — die Systemjobs — auf das Team des Administrators. Bis dahin zählten Läufe auf niemanden: ein Import über den Tasker kostete nichts.
**Ein Team startet nur seine eigenen Jobs** (anhalten, fortsetzen, abbrechen ebenso); ein Administrator (Recht `users`) startet alle, gezahlt wird
weiter vom Team des Jobs. Jobs anderer Teams sieht nur, wer Anwender und Teams verwaltet.

**Warnung vor dem Kontingent** (03.10.2026): ein Import fragt vor dem Start, was sein Team noch schreiben darf (Grenze ohne die 10 % Reserve, abzüglich
des Gezählten) und was der letzte **Trockenlauf** schätzte; reicht es nicht, steht das in der Rückfrage, starten lässt er sich trotzdem. Den Trockenlauf
stösst ≈ im Tasker an (`POST /api/jobs/{key}/run?trocken=true`): derselbe Job mit seinem Parameter `dryRun`/`dry_run`, ohne Vorfahrt vor den
Systemjobs. Ein Prozess meldet die Zahl mit der Zeile `journali:eintraege=N`; sie steht am Lauf (`JobRunFinished.Entries`). `csv` und `excel`
zählen ihre Befehle genau, `ixp`, `json` und `solr` höchstens (bestehende Werte, die gleich bleiben, zählen mit). Hält ein Lauf wegen des Kontingents
an, sagt es der Tasker mit einer Meldung. Auch die Übergabe aus einer Plugin-Ansicht fragt, wenn es nicht reicht (`kontingent.reicht` aus `journali`,
`GET /api/jobs/verfuegbar` für das eigene Team; Solr schätzt aus seinem Plan).

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

### Abo über den Lizenzserver

Ein Team mit Abo aus dem Shop (Lemon Squeezy) fügt den **Lizenzschlüssel aus dem Shop** in dasselbe Feld ein
(⚙ Einstellungen → Team → Lizenz); der Knopf heisst dann „⚿ Abo verbinden · Team“. Der Server schickt eine mit dem
Schlüsselpaar der Instanz signierte Anfrage an den Lizenzserver und legt dessen signierte Antwort als
`EntitlementReceived` ins Journal des Teams: Tarif, Grenzen, Status, bezahlt bis, gilt ohne neue Abfrage bis.
Stündlich sieht er nach und fragt neu, wenn der letzte Stand älter als 20 Stunden ist. Ein Stand gilt bis zum
früheren von „bezahlt bis“ und „ausgestellt + 7 Tage“ — ohne Verbindung also höchstens eine Woche; danach gilt, was
das Team ohne Abo hat. Ein Abo hebt die Grenzen an, senkt nie; sein Tarif zählt für den höchsten Tarif der Instanz.

**Es gilt, was der Lizenzserver sagt** (03.10.2026): hat ein Team einen geprüften Stand vom Lizenzserver, zählen seine im Journal eingelösten Schlüssel
zum Kopieren nicht mehr — Tarif und Grenzen kommen allein aus dem Stand. Entzieht der Lizenzserver das Abo oder ist es abgelaufen, hat das Team, was es
ohne Abo hat; ein älterer Schlüssel im Journal hebt es nicht wieder an. Ohne Stand (eine Instanz ohne Verbindung zum Lizenzserver) zählen die Schlüssel
wie bisher. Einstellungen → Team → ⚿ journali Lizenz nennt beim Tarif, woher er kommt (Lizenz, Test, Abo oder Schlüssel), beim Abo zuerst seinen Zustand,
und je geltendem Schlüssel eine Zeile — mit „zählt nicht“, wenn der Lizenzserver entscheidet.

Die Adresse des Lizenzservers ist eingebaut (`Core.Licensing.Aussteller.Adresse`) — nichts einzustellen, und im
Release-Bau nicht zu ändern. Sie schützt nichts; das tut der eingebaute Schlüssel daneben: wer die Anfrage
woandershin lenkt, bekommt keinen Stand, den journali annimmt. Nur der Debug-Bau nimmt `JOURNALI_LIZENZSERVER`
an, damit die Entwicklung gegen einen eigenen Lizenzserver arbeiten kann.

Ein Stand ohne passende Signatur wird nicht übernommen. Mit jedem Stand kommt das **Tarifblatt** des Lizenzservers.

#### Tarifblatt

Welche Tarife es gibt — Grenzen je Woche und Monat, Publikationsbäume, Plugins, dazu Tarif und Dauer des Tests —
sagt der Lizenzserver, nicht das Image: er signiert ein Tarifblatt mit Versionsnummer und liefert es mit jedem
Abo-Stand und jedem Schlüssel zum Kopieren aus. journali legt eine neuere Version als `TarifeReceived` ins Journal
(Strom `tarife`); ab dann gilt sie für Pakete, Plugins, Bäume, die Lizenz des Init Teams und den Test. Eine ältere
Version oder eine ohne passende Signatur ändert nichts — auch nicht beim Neuaufbau, das Abbild prüft selbst. Ohne
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

## Absicherung (01.10.2026)

**Ohne Sitzung** ist nur zu haben: `GET /api/health` (Version und Bau), die Aufrufe zum Anmelden (`/api/auth/login`, `state`, `setup`, `claim`), die Dateien
der Office-Add-ins (`/plugins/exceladdin`, `/plugins/ooaddin`) und die Seite der Oberfläche selbst. Die Sperre ignoriert Gross- und Kleinschreibung wie das
Routing. Die Beschreibung der Schnittstelle (`GET /api/openapi.json`) nennt je Aufruf das Recht, das er braucht (`x-recht`; `offen` bei den eben genannten).

**Anmeldung.** Nach 8 Fehlversuchen mit einem Namen oder 30 von einer Adresse gilt eine Sperre von einer Minute (`429`, Kopf `Retry-After`); in dieser Zeit prüft
der Server das Passwort nicht, ein Versuch kostet ihn sonst 210 000 Runden PBKDF2. Eine richtige Anmeldung setzt den Zähler des Namens zurück. Der Körper eines Aufrufs
ohne Sitzung darf höchstens 16 KB haben.

**Anfragen je Absender.** Ein Absender im Netz hat einen Eimer von 600 Anfragen, der sich mit 30 je Sekunde füllt; darüber antwortet der Server `429`. Was vom Rechner
des Servers selbst kommt (Jobs und Prozesse der Plugins rufen ihn unter seiner eigenen Adresse), ist nicht begrenzt. Läuft journali hinter einem Reverse-Proxy, sehen
alle Anwender dieselbe Adresse des Proxys und teilen sich einen Eimer.

**Grosse Dateien.** Ein Medium (`POST /api/media`) und ein Blob (`PUT /api/media/blob/…`) dürfen bis `JOURNALI_UPLOAD_MB` gross sein (Vorgabe 2048, also 2 GB), nur
für Angemeldete. Alle anderen Aufrufe bleiben bei der Grenze von Kestrel (30 MB). Ein Reverse-Proxy hat oft eine eigene, kleinere Grenze (nginx: `client_max_body_size`,
Vorgabe 1 MB) — sie muss mindestens so gross sein wie `JOURNALI_UPLOAD_MB`.

**Verschlüsselung zum Browser.** journali spricht selbst nur HTTP. Über ein Netz gehört TLS davor (ein Reverse-Proxy); das Cookie der Sitzung trägt `Secure`, sobald die
Verbindung HTTPS ist.

**Verschlüsselung zur Datenbank.** Npgsql steht auf `SSL Mode=Prefer`: es verschlüsselt, wenn Postgres es anbietet. Das Image `pgvector/pgvector` bietet es in der
Vorgabe nicht an (`ssl = off`), die Verbindung läuft dann **im Klartext** — gemessen am 01.10.2026 mit `pg_stat_ssl`. Im eigenen Docker-Netz oder im Heimnetz ist das
ein geringes Risiko; über ein fremdes Netz nicht. Ob die Verbindung verschlüsselt wird, entscheidet der Betreiber der Datenbank, nicht journali: ein Betreiber in einer Cloud wird es verlangen, ein Heimnetz nicht.
journali kann beides: es verschlüsselt, wenn Postgres es anbietet, und verlangt es, wenn man es einstellt. Eingestellt wird es im Einrichtungsdialog der Datenbank (Feld
**Verschlüsselung**: wenn möglich / immer / immer mit geprüftem Aussteller / immer mit geprüftem Aussteller und Namen / nie; das ist der `SSL Mode` von Npgsql, Vorgabe `Prefer`)
oder in `db.json`. Was die Verbindung wirklich ist, zeigt ⚙ Einstellungen → ⇅ B&R → Datenbank in der Zeile **Verschlüsselung**: `✓ verschlüsselt` mit der TLS-Version oder
`✗ im Klartext`, daneben der eingestellte Modus. Die Zeile stammt aus `pg_stat_ssl`, also von Postgres selbst, nicht aus der Einstellung.

**Verschlüsselung der Datenbank einschalten, ohne Neustart** (Postgres-Dokumentation „Secure TCP/IP Connections with SSL“): `ssl = on` ändert sich mit
`pg_reload_conf()`. Zertifikat und Schlüssel liegen standardmässig im Datenverzeichnis (`server.crt`, `server.key`; der Schlüssel mit den Rechten 0600, ohne Passwort,
sonst ist ein Neustart nötig). Neue Verbindungen verschlüsseln dann, bestehende bleiben, wie sie sind; journali hält Verbindungen in einem Pool, es braucht also einen
Neustart des Servers oder Zeit, bis sie erneuert sind. Der Ablauf im Container der Datenbank:

1. Zertifikat erzeugen (selbstsigniert, hier 10 Jahre): `docker exec -u postgres journali-db sh -c 'openssl req -new -x509 -days 3650 -nodes -subj "/CN=journali-db" -keyout "$PGDATA/server.key" -out "$PGDATA/server.crt"'`
   — fehlt `openssl` im Image, wird das Zertifikat ausserhalb erzeugt und mit `docker cp` in das Datenverzeichnis gelegt.
2. Einschalten: `docker exec -u postgres journali-db psql -c "ALTER SYSTEM SET ssl = on" -c "SELECT pg_reload_conf()"`
3. Prüfen, mit einer Verbindung von journali: `select ssl, version from pg_stat_ssl where pid = pg_backend_pid()` muss `true` liefern.
4. Erzwingen (erst, wenn 3 stimmt): in `pg_hba.conf` die Zeilen `host` durch `hostssl` ersetzen und `SELECT pg_reload_conf()` — Verbindungen ohne SSL werden dann abgewiesen.

**Der Modus in journali** steht im Einrichtungsdialog und unter Einstellungen → ⇅ B&R → Datenbank (Prefer, Require, VerifyCA, VerifyFull, Disable). Dort steht auch, was
Postgres über die laufende Verbindung sagt (`pg_stat_ssl`). Eine Änderung wird zuerst mit einer Verbindung geprüft und nur bei Erfolg in `db.json` geschrieben; sie gilt nach
dem nächsten Start des Servers. Kommt die Verbindung aus der Umgebung (`JOURNALI_DB`), steht der Modus dort (`SSL Mode=…`) und ist hier nicht änderbar.

Ein selbstsigniertes Zertifikat verschlüsselt, beweist dem Client aber nicht, mit wem er spricht (`Prefer`, `Require`). Das prüft erst `VerifyFull` mit dem Zertifikat der
ausstellenden Stelle (`Root Certificate=<Datei>` in der Verbindung) und dem Namen des Servers im Zertifikat.
