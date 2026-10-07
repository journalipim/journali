# journali PIM

Produktdaten aus einem Journal. Jede Änderung ein Eintrag, jedes Abbild
eine Ableitung.

*(PIM, MDM, Datenstore je Kanal)*

## Testversion

**Diese Software befindet sich in der Entwicklung (Alpha/Beta) und wird ausschließlich zu Test- und Evaluationszwecken bereitgestellt. Sie ist ausdrücklich nicht für den Produktiveinsatz oder kritische Systemumgebungen geeignet.**

Die Nutzung erfolgt auf eigene Gefahr.

**This software is under development (alpha/beta) and is provided solely for testing and evaluation purposes. It is expressly not suitable for production use or critical system environments.**

Use is at your own risk.

Die Beschreibungen auf [journali.de](https://journali.de) beziehen sich auf das produktive Release.

## Idee

Ein PIM ist nicht schwer wegen Bäumen und Attributen, sondern wegen der
Achsen — Sprache × Kanal × Variante × Rechte —, die jede Funktion
vervielfachen, wegen der Historie, die jeder Schreibpfad pflegen muss, und
wegen der Schnittstellen nach draussen, die nie fertig sind.

journali beantwortet alle drei mit einem Mechanismus: Das Journal ist die
einzige Wahrheit, alles andere ist ein Abbild daraus. Historie ist das
Journal selbst, Delta-Export ist „alles seit Nummer N", ein kaputtes
Abbild wird neu gebaut statt repariert.

Ausführlich: [docs/architektur.md](docs/architektur.md).

## Installation

Voraussetzung ist Docker mit Compose. Das Image liegt unter `ghcr.io/journalipim/journali`, die Datenbank ist
PostgreSQL 18 aus `compose.yaml`.

```
git clone https://github.com/journalipim/journali.git
cd journali
docker compose pull
docker compose up -d
```

Danach `http://localhost:8080`; der erste Aufruf legt den Administrator an. Plugins liegen als Bind-Mount unter
`plugins/`, Jobs und Medien in Volumes. Neuer Stand: `docker compose pull && docker compose up -d`. Wer das Image
selbst bauen will: `docker compose up --build -d`. Alles Weitere zu Umgebung, Speicher, Sicherung und Lizenz:
[docs/betrieb.md](docs/betrieb.md); die Bedienung erklärt die Hilfe in der Instanz (? oben rechts).

## Quelltext und Beiträge

Der Quelltext ist öffentlich einsehbar (Source Available) und zum Lesen, Herunterladen und Betreiben da — Lizenz: Elastic License
2.0 mit Hosting-Erlaubnis ([LICENSE](LICENSE)), keine Open-Source-Lizenz. Pull Requests werden
nicht angenommen und automatisch geschlossen ([CONTRIBUTING.md](CONTRIBUTING.md)). Ergänzungen sind Plugins
([docs/plugins-zertifizierung.md](docs/plugins-zertifizierung.md)); Siegel und Katalog von journali gelten nur eigenen Plugins.
Eine Schwachstelle meldet man vertraulich ([SECURITY.md](SECURITY.md)); schwere bekannte Fehler stehen in
[BEKANNTE-FEHLER.md](BEKANNTE-FEHLER.md).

„journali PIM“ ist eine beim Deutschen Patent- und Markenamt angemeldete Marke. Die Lizenz räumt keine Rechte an ihr ein: Eine
geänderte oder abgeleitete Software darf nicht unter diesem Namen verbreitet oder angeboten werden.

## Aufbau

| Projekt | Zweck |
|---|---|
| `Journali.Core` | Journal, Einträge, Abbilder — net8.0, keine Abhängigkeiten |
| `Journali.Sandbox` | Konsole: Journal füllen, Abbild bauen, ausgeben |
| `Journali.Server` | ASP.NET Core: Journal in PostgreSQL 18, Abbild „Produkte", Befehle unter `/api` — [docs/betrieb.md](docs/betrieb.md), [docs/eintraege.md](docs/eintraege.md) |
| `web` | Oberfläche, Vue 3 + Vite; wird nach `Journali.Server/wwwroot` gebaut |

journali gibt es nur als Paket: `Dockerfile` und `compose.yaml` bringen Server und Datenbank zusammen, der Weg
steht oben unter Installation. Das Starten aus dem Quelltext ist Entwicklung und steht in
[docs/betrieb.md](docs/betrieb.md) unter „Entwickeln auf dem PC“.
