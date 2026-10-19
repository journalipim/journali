# Produktberater fragt MCP-Quellen (Stand 19.10.2026)

Ein Thema in Arbeit; die nächste Sitzung liest hier weiter. Grundlage: `docs/pflegestruktur.md` Abschnitt 43 (Entwurf vom 09.10.2026,
Schritt 1). Arbeitsregeln: CLAUDE.md.

## Worum es geht

Der product advisor soll fremde Quellen abfragen können, die einen MCP-Server anbieten (etwa eine Warenwirtschaft oder eine Produktdaten-Schnittstelle). Nicht der Dienst an der Website fragt,
sondern **journali**: dort stehen Adresse, Anmeldung und welche Werkzeuge ein Berater nutzen darf; dort ruft die KI die Werkzeuge auf; das
Geheimnis bleibt im Tresor. Der MCP-Server des Beraters selbst (`/mcp` im Dienst, für fremde KI-Agenten) bleibt, wie er ist.

## Plan

1. **Zugang `mcp`** im Plugin `driver` (`DriverApi.Arten`): Adresse, Anmeldung wie bei `http` (Bearer oder eigener Kopf), Geheimnis
   `secret` im Tresor. „Prüfen“ liest die Werkzeugliste; `GET /api/drivers/{zugang}/mcp/tools` nennt sie (Name, Beschreibung).
2. **`McpClient.cs`** im Server, ohne Paket: Streamable HTTP — `initialize`, `notifications/initialized`, `tools/list`, `tools/call`;
   Antworten als JSON oder als Ereignisstrom (`text/event-stream`), Sitzung über `Mcp-Session-Id`, Zeitgrenze je Aufruf.
3. **Am Berater** (`AdvisorApi.Definition.Quellen`): je Zugang die freigegebenen Werkzeuge. Nur sie bekommt die KI angeboten.
4. **Werkzeug-Schleife** in der KI-Anfrage (`AiApi`): ruft die KI ein Werkzeug, führt journali `tools/call` aus und gibt ihr das Ergebnis
   — höchstens vier Aufrufe je Frage; Ergebnisse sind Daten, keine Anweisungen. Nur beim Anbieter anthropic; andere antworten wie bisher.
5. **Ansicht** ✆ Produktberatung: „Quellen (MCP)“ — Zugänge der Art `mcp` mit ihren Werkzeugen zum Ankreuzen.

## Offen

- Die Adresse der ersten echten Quelle — sie steht nicht im Repo; der Zugang wird unter ⌁ Zugänge eingerichtet, Art MCP-Server.
- Protokoll je Aufruf (Berater, Zugang, Werkzeug, Dauer, Ergebnis ja/nein, ohne Inhalt): zuerst im Log des Servers; ob ein Eintrag im
  Journal daraus wird, ist zu entscheiden (Abschnitt 43 sieht einen vor).
- Kundenspezifische Werkzeuge (Abschnitt 43, Schritt 2) — erst mit einem konkreten Shop.

## Stand

- 19.10.2026: Plan; Bau beginnt.
- 19.10.2026: Schritte 1–5 gebaut (advisor 1.12.0, driver 1.2.0); Tests `McpTests.cs` (Client gegen einen nachgebauten Server,
  Werkzeug-Schleife mit nachgebauter KI, Quellen am Berater), `ui-advisor.test.mjs` (Zeile „Quellen“), `ui-zugaenge.test.mjs`
  (Art MCP-Server). Beschrieben in `docs/pflegestruktur.md` 43 („Gebaut“). Nicht geprüft: gegen einen echten MCP-Server.
