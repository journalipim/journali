# Produktberater — was zu tun ist (Stand 09.10.2026)

Übergabe an die nächste Sitzung. Grundlage: `docs/pflegestruktur.md` Abschnitte 42 (gebaut), 43 und 44 (Entwurf, Entscheidungen
markiert). Stand des Plugins: `advisor` 1.9.0. Arbeitsregeln wie immer: CLAUDE.md (Python-Patchskripte, Tests vor dem Commit, ein
Commit je Thema, sofort nach `origin`, dann `github`; Plugin nach Änderung hochzählen, bauen, signieren).

## Was steht

- Berater (`Journali.Server/AdvisorApi.cs`, Plugin `plugins/advisor`: `dienst.mjs`, `serve.mjs`, `widget.js`, `mcp.mjs`).
- Gespräch im Fenster: gesammelte Wörter und Angaben, Verlauf, Produkt im Blick (`fokus`), Abschluss mit Frage und Werten in
  derselben Blase, „Neue Suche“ in der letzten Blase.
- Suche: die Art (Wort in einem Produktnamen) grenzt ein, jedes andere Wort ordnet (`Finde`, `HartWeich`); je Wort nur die beste
  Stufe (`MitWoertern`); gebeugte Formen (`Formen`); Eigenschaftswörter „leicht/schwer/gross/hell“ an der Grösse der Einheit
  (`Relativ`); Tippfehler (`Korrektur`); Themenwechsel; Lockern; Suche nur in dem, was die Sicht zeigt.
- Unterlagen (RAG): Dokumente an Produkten und Gruppen, Abschnitte nach Sinn (Grenze 0,145 gemessen), `/doc/{media}`,
  Teile eines Abschnitts zusammengefasst; Frage zum Produkt im Blick aus seinen Werten (Grenze 0,165 gemessen).
- KI: Vorschau fragt mit KI, Grund eines Fehlers nur für Angemeldete; Spalte „Anbieter“ im KI-Austauschvolumen.
- Testdaten: `tools/demo-daten.cmd --anreichern --ohne-beispiele` (Shop-Texte, technische Merkmale, GEO-Texte, Datenblätter,
  Pflege/Reparatur, FAQ aus `tools/tannwald_faq.md`, Sicht „Onlineshop“).

## Nächste Schritte (Reihenfolge aus Abschnitt 44)

1. **Vokabular und Auswahl in journali** (Schnittstelle Version 2, neben `/ask`):
   - `GET /api/advisor/{key}/vocabulary` — Attribute der Sicht (Bezeichnung je Sprache, Typ, Einheit und deren Grösse,
     Listenwerte, Merkmal ja/nein), Wörter der Produktnamen mit Anzahl, Sprachen; ETag aus Journalstand und Definition.
   - `POST /api/advisor/{key}/select` — `{ art, angaben[{attribute, op: eq|le|ge|low|high, value}], ordnen, satz, fokus, take, skip,
     locale, lockern }` → Anzahl, Karten, Merkmale, Lockern. Aus dem heutigen Code in `AdvisorApi` herauslösen (Finde, MitWoertern,
     Relativ, Passt, Facetten, Lockern, Sinn), Tests in `Journali.Tests/AdvisorTests.cs` mitziehen.
   - `POST /api/advisor/{key}/docs` — `{ satz, art, fokus }` → Abschnitte.
   - `FuerToken` um die neuen Wege erweitern; `dienst.mjs` reicht sie durch.
2. **Der Kern im Plugin** (`plugins/advisor/kern/*.mjs`): Verstehen (Erkenne, Eigenschaftswörter, Tippfehler, Füllwörter,
   Produkt im Blick, Fragt), Antwort zusammensetzen (Sätze de/en heute in `widget.js` TEXTE und im Server) — gegen Vokabular und
   Auswahl. Das Fenster zeigt nur noch an. Kern als Kindprozess in journali für die Vorschau (Muster: `Embedder.cs`).
3. **Gedächtnis im Dienst**: Kennung je Seite, Arbeitsspeicher, 30 Minuten; Vorlieben über Themenwechsel („Grösse M habe ich
   übernommen.“), gesehene und abgelehnte Produkte (✕ an der Karte, „nicht das“).
4. **Prüfstand**: `tools/berater-dialoge/` — Dialoge mit Eingaben, Klicks und erwarteter Antwort; ein Skript spielt sie über den
   Kern gegen eine Instanz (lesend, Token eines Beraters) und zeigt die Abweichungen. Dann: Dialoge ausdenken, eigene Antwort
   daneben schreiben, Berater nachstellen — ohne KI so nah wie möglich.
5. **Lernen** (ohne Person): Wörter ohne Treffer, angenommene Tippfehler, Wörter vor Öffnen/Merken → Vorschläge.
6. **Später, mit einem konkreten Shop**: Zugang `mcp` (Plugin `driver`), Freigabeliste der Werkzeuge am Berater, KI mit
   Werkzeugen in journali, Nachweis des Kunden (JWT vom Shop → Fenster → Dienst `X-Advisor-Customer` → journali prüft), Preise
   aus dem Shop in der Auswahl.

## Kleinere Punkte

- **Fenster vergrössern**: im schwebenden Fenster einen Knopf im Kopf, der es auf fast die ganze Höhe und eine grössere Breite
  stellt (gewünscht, noch nicht gebaut).
- **Prüfstand „keine Namen“**: CLAUDE.md nennt `web/test/kein-name.test.mjs`; die Datei gibt es nicht mehr. Wiederherstellen oder
  CLAUDE.md anpassen.
- **Offene Entscheidungen** aus Abschnitt 44 („Offen“): Gespräch über ein Neuladen hinaus, Gedächtnis bei mehreren Diensten,
  wo Lernvorschläge erscheinen, ob `/mcp` den Kern nutzt, Nachweis ohne JWT.

## Zum Ausprobieren auf einem Rechner

- journali nach jeder Server-Änderung neu starten; nach Änderungen an `widget.js` auch den Berater-Dienst (er liest `widget.js`
  nur beim Start, `plugins/advisor/serve.mjs`), dann die Seite neu laden.
- Am Berater: Sicht „Onlineshop“, unter „Websites“ die Adresse der Testseite; KI mit Team einschalten, wenn KI-Text gewünscht ist.
- Belegt ein Tunnel oder ein anderer Prozess die Ports des Testpaars, landet „localhost:…“ dort und nicht beim Dienst — Ports mit
  `Get-NetTCPConnection -State Listen -LocalPort …` prüfen.
- Ein fehlschlagender UI-Test darf kein DOM-Element in `assert.equal` vergleichen (Regel in `web/test/ui.mjs`).
