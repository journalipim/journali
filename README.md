# journali PIM

Product data from a journal. Every change is an entry, every view of the data is derived from it.

*(PIM, MDM, data store per channel)* · Website: [journali.de](https://journali.de) ·
Demo: [try journali](https://journali.de/journali-testen/) · Articles: [journali.de/category/entwicklung](https://journali.de/category/entwicklung/) ·
Deutsch: [README.de.md](README.de.md)

## Test version

**This software is under development (alpha/beta) and is provided solely for testing and evaluation purposes. It is expressly not suitable for production use or critical system environments.**

Use is at your own risk. The descriptions on [journali.de](https://journali.de) refer to the production release.

## Idea

A PIM is not hard because of trees and attributes, but because of the axes — language × channel × variant × rights — that
multiply every function, because of the history every write path has to maintain, and because of the interfaces to the
outside that are never finished.

journali answers all three with one mechanism: the journal is the single source of truth, everything else is derived from
it. History is the journal itself, a delta export is "everything since number N", and a broken view is rebuilt instead of
repaired.

In detail (German): [docs/architektur.md](docs/architektur.md).

## Installation

On Unraid there are templates under `unraid/` (journali, its database journali-db, and journali-advisor). Otherwise Docker
with Compose is required. The image is `ghcr.io/journalipim/journali`, the database is PostgreSQL 18 from `compose.yaml`.

```
git clone https://github.com/journalipim/journali.git
cd journali
docker compose pull
docker compose up -d
```

Then open `http://localhost:8080`; the first visit creates the administrator. Plugins are a bind mount under `plugins/`,
jobs and media are in volumes. New version: `docker compose pull && docker compose up -d`. To build the image yourself:
`docker compose up --build -d`. Environment, storage, backup and licence are described in
[docs/betrieb.md](docs/betrieb.md) (German); the help inside the instance explains how to use it (? at the top right),
in German and English.

## Source and contributions

Copyright (C) 2026 Taloan. journali is free software under the **GNU Affero General Public License, version 3**
([LICENSE](LICENSE)): you may use, modify and distribute it; whoever distributes a modified version or offers it as a
network service gives its users the source code under the same licence. Other licence terms are available on
request. Pull requests are not accepted and are closed automatically ([CONTRIBUTING.md](CONTRIBUTING.md)). Extensions are
plugins ([docs/plugins-zertifizierung.md](docs/plugins-zertifizierung.md)); the journali seal and catalogue cover
journali's own plugins only. Report a vulnerability confidentially ([SECURITY.md](SECURITY.md)); serious known bugs are
listed in [BEKANNTE-FEHLER.md](BEKANNTE-FEHLER.md).

"journali PIM" is a trademark filed with the German Patent and Trade Mark Office (DPMA). The licence grants no rights in
it: a modified or derived version may not be distributed or offered under this name.

## Structure

| Project | Purpose |
|---|---|
| `Journali.Core` | journal, entries, derived views — net8.0, no dependencies |
| `Journali.Sandbox` | console: fill a journal, build a view, print it |
| `Journali.Server` | ASP.NET Core: journal in PostgreSQL 18, product view, commands under `/api` — [docs/betrieb.md](docs/betrieb.md), [docs/eintraege.md](docs/eintraege.md) |
| `web` | user interface, Vue 3 + Vite; built into `Journali.Server/wwwroot` |
| `plugins` | one plugin per directory: import and export, data quality, jobs, product advisor and more |

journali is only shipped as a package: `Dockerfile` and `compose.yaml` bring server and database together, see
Installation above. Running from source is development and is described in [docs/betrieb.md](docs/betrieb.md) under
"Entwickeln auf dem PC". The documentation in `docs/` is German.
