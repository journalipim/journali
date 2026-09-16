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

1. **Image** — `Dockerfile` im Repo. Bauen, wo Docker ist (Compose Manager
   auf der rossibox mit Checkout aus Gitea, oder ein PC mit Docker), dann
   Container mit Port `8080` und den Umgebungsvariablen `JOURNALI_DB`
   (`Host=localhost;Port=7432;Database=journali;Username=postgres`)
   und `JOURNALI_DB_PASSWORD`.
2. **Publish-Ordner** — ohne Image: vom PC erst `tools\server build`, dann
   `dotnet publish Journali.Server -c Release -o <Freigabe>\journali`
   (nimmt `wwwroot` mit),
   Container aus `mcr.microsoft.com/dotnet/aspnet:8.0` mit dem Ordner
   als `/app`, Befehl `dotnet Journali.Server.dll`, Port 8080, dieselben
   Umgebungsvariablen. Änderung = neu publishen, Container neu starten.

## Verteilen

`compose.yaml` ist das ganze Paket: Server + `postgres:18` mit eigenem
Volume. `.env.example` nach `.env` kopieren, Passwort eintragen,
`docker compose up --build`. Der Server wartet, bis Postgres bereit ist
(Healthcheck), und legt Datenbank und Tabelle selbst an.

## Tabelle `journal`

| Spalte | Typ | |
|---|---|---|
| `number` | `BIGINT PRIMARY KEY` | MAX+1 unter Tabellensperre, damit lückenlos — eine Sequenz liesse bei Abbrüchen Lücken |
| `at` | `TIMESTAMPTZ` | `now()` der Datenbank |
| `actor`, `stream`, `type` | `TEXT` | |
| `payload` | `JSONB` | Postgres weist ungültiges JSON ab; Leerraum und Reihenfolge werden normalisiert |
| `batch` | `TEXT`, null | Stapelkennung; kommt per `ALTER TABLE … ADD COLUMN IF NOT EXISTS` in bestehende Tabellen |

Index `journal_stream (stream, number)` für `ReadStream`.
