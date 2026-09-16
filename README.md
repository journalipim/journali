# journali

Produktdaten aus einem Journal. Jede Änderung ein Eintrag, jedes Abbild
eine Ableitung.

*(PIM, MDM, Datenstore je Kanal)*

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

## Aufbau

| Projekt | Zweck |
|---|---|
| `Journali.Core` | Journal, Einträge, Abbilder — net8.0, keine Abhängigkeiten |
| `Journali.Sandbox` | Konsole: Journal füllen, Abbild bauen, ausgeben |
| `Journali.Server` | ASP.NET Core: Journal in PostgreSQL 18, Abbild „Produkte", Befehle unter `/api` — [docs/betrieb.md](docs/betrieb.md), [docs/eintraege.md](docs/eintraege.md) |
| `web` | Oberfläche, Vue 3 + Vite; wird nach `Journali.Server/wwwroot` gebaut |

```bash
dotnet run --project Journali.Sandbox
```

```bash
dotnet run --project Journali.Server
```

`Dockerfile` und `compose.yaml` bauen Server + Datenbank als Paket.
