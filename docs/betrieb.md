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

| Aufruf | Antwort |
|---|---|
| `GET /health` | `{"head": N}` — Nummer des letzten Eintrags, 0 bei leerem Journal |
| `POST /journal` mit `{"actor","stream","type","payload"}` | 201 + der Eintrag mit Nummer und Zeit; `payload` ist beliebiges JSON und kommt in jeder Antwort als eingebettetes JSON zurück, nicht als String |
| `GET /journal?after=N&limit=M` | Einträge mit Nummer > N, höchstens M (Vorgabe 1000, Obergrenze 10 000) |
| `GET /journal/{number}` | ein Eintrag oder 404 |
| `GET /streams/{stream}` | alle Einträge eines Stroms in Reihenfolge |

Beispiel:

```bash
curl -s -X POST localhost:5000/journal -H "Content-Type: application/json" -d "{\"actor\":\"anna\",\"stream\":\"4711\",\"type\":\"AttributeSet\",\"payload\":{\"attribute\":\"name\",\"locale\":\"de\",\"channel\":null,\"value\":\"Stiefel\"}}"
```

```bash
curl -s "localhost:5000/journal?after=0"
```

## Auf der rossibox (Unraid)

Die Datenbank ist das Template `postgresql18` aus den Community Apps
(Host-Port 7432, Nutzer `postgres`, Daten unter `/mnt/cache/appdata/postgresql18`).

Für den Server gibt es zwei Wege:

1. **Image** — `Dockerfile` im Repo. Bauen, wo Docker ist (Compose Manager
   auf der rossibox mit Checkout aus Gitea, oder ein PC mit Docker), dann
   Container mit Port `8080` und den Umgebungsvariablen `JOURNALI_DB`
   (`Host=localhost;Port=7432;Database=journali;Username=postgres`)
   und `JOURNALI_DB_PASSWORD`.
2. **Publish-Ordner** — ohne Image: vom PC
   `dotnet publish Journali.Server -c Release -o <Freigabe>\journali`,
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

Index `journal_stream (stream, number)` für `ReadStream`.
