# Produktberater — was zu tun ist (Stand 09.10.2026, abends)

Übergabe an die nächste Sitzung. Grundlage: `docs/pflegestruktur.md` Abschnitte 42 (gebaut), 43 (Entwurf) und 44 (Schritte 1–4 und das
Lernen gebaut). Stand des Plugins: `advisor` 1.7.0 (bis 14.10.2026 als 2.7.0 gezählt). Arbeitsregeln wie immer: CLAUDE.md (Python-Patchskripte, Tests vor dem Commit, ein
Commit je Thema, sofort nach `origin`, dann `github`; Plugin nach Änderung hochzählen, bauen, signieren).

## Was steht

- **Schnittstelle Version 2** (`Journali.Server/AdvisorAuswahl.cs`): `GET vocabulary` (ETag), `POST select` (Art, Angaben, Ordnen, Satz,
  Fokus, Seite, Lockern, Hinten, Probe), `POST docs`, `POST ki` (Angaben oder Antwort, ohne Werkzeuge). `/ask` ist weg.
- **Der Kern** (`plugins/advisor/kern/`): `woerter.mjs` (Wörter, Formen, Tippfehler), `verstehen.mjs` (Angaben im Text, Eigenschaftswörter,
  Art, Fragen), `texte.mjs` (Sätze de/en), `gespraech.mjs` (Gespräch, Gedächtnis, Antwort), `lernen.mjs`, `prozess.mjs` (Kindprozess).
- **Wo der Kern läuft**: im Dienst (`dienst.mjs`: `/api/ask` mit Kennung des Gesprächs, `/api/event`, MCP `search_products` ohne Gespräch)
  und in journali für die Vorschau (`AdvisorKern.cs`, Weg `preview`, Token `ja_p_…` nur im Arbeitsspeicher). Die C#-Tests der Gespräche
  laufen über die Vorschau, also über den echten Kern (`AdvisorTests`, braucht `node`).
- **Das Fenster** zeigt nur an: Eingaben und Klicks als Schritt (`filter`, `weg`, `neu`, `statt`, `ablehnen`), Sätze vom Kern; „Nicht das“
  an der Karte, „angesehen“, Merken an den Dienst; ⤢ vergrössert das schwebende Fenster.
- **Gedächtnis** im Dienst je Kennung, 30 Minuten: Angaben mit Herkunft, Vorlieben über einen Themenwechsel („… habe ich übernommen.“),
  gesehene und abgelehnte Produkte, Produkt im Blick, Verlauf.
- **Fragen zu den gezeigten Produkten** („sind die wasserdicht?“) beantworten ihre Werte und Sätze (`kern/stellen.mjs`); Gruss, Dank
  und Abschied bekommen einen Satz; „leichter als 1.8 kg“ ist eine Grenze. **Sortiment**: „was verkauft ihr?“ nennt die Gruppen des
  Publikationsbaums (`groups` im Vokabular, `gruppe` in `select`). **Grundwissen** (`kern/wissen.mjs`): wer, was kann er, Shopfragen,
  und die Rückführung auf das Sortiment für alles andere. **Assoziationen** (`kern/assoziationen.mjs`, `wissen/`): eigene Liste und
  Unterbegriffe von 388 Oberthemen aus Wikidata (`tools/advisor-wissen/`).
- **Prüfstand** `tools/berater-dialoge/` (`spiele.mjs`, `pruefe.mjs`, sieben Dialoge mit Erwartung und Vorbild).
- **Lernen** im Dienst (`lernen.json` mit `JOURNALI_ADVISOR_DATA`), Vorschläge mit `plugins/advisor/vorschlaege.mjs`.
- Blog: drei Beiträge als Entwürfe 233–235 (14.10., 21.10., 29.10.), Startseite mit Karte „Journali KI Produktberater“ (lokal in
  `site/index.html`, in WordPress noch nicht — erst, wenn Beitrag 233 erscheint, weil die Karte darauf verweist).

## Nächste Schritte

1. **Prüfstand gegen die Testdaten spielen** (`tools/demo-daten.cmd --anreichern --ohne-beispiele`, Berater mit Sicht „Onlineshop“, Token)
   und die Abweichungen angehen; Dialoge ausdenken und das Vorbild daneben schreiben. Bei älteren Testdaten am Attribut `weight` die
   Einheit kg nachtragen, sonst versteht der Berater „leicht“ nicht.
2. **Mit einem konkreten Shop** (Abschnitte 43 und 44): Zugang `mcp` (Plugin `driver`), Freigabeliste der Werkzeuge am Berater, KI mit
   Werkzeugen in journali (`ki` mit Werkzeugschleife), Nachweis des Kunden (JWT vom Shop → Fenster `data-customer` → Dienst
   `X-Advisor-Customer` → journali prüft), Preise aus dem Shop in der Auswahl.

## Offene Entscheidungen (Abschnitt 44, „Offen“)

- eigene Assoziationen eines Shops im Journal (zu den Assoziationen der Grundausstattung im Plugin),
- Share-Alike-Quellen (OdeNet, DBpedia) als Download beim Einschalten oder gar nicht,

- ob die KI des Teams Fragen ausserhalb des Sortiments beantworten darf (je Berater ein Schalter) — ohne KI gilt die Rückführung, und eine
  Frage, deren Wörter in Produkttexten stehen („wie wird das Wetter?“ trifft „wetterfest“), bleibt eine Suche,

- ob die Kennung des Gesprächs ein Neuladen der Seite übersteht (`sessionStorage`),
- wo das Gedächtnis liegt, wenn der Dienst auf mehreren Rechnern läuft,
- ob die Vorschläge aus dem Lernen in journali als Liste erscheinen (heute: `vorschlaege.mjs` im Container),
- ob `/mcp` den Kern mit Gedächtnis nutzt (heute: ohne Gespräch),
- das Format des Nachweises, wenn ein Shop kein JWT ausstellen kann.

## Zum Ausprobieren auf einem Rechner

- `tools\berater token shop ja_…` (einmal), dann `tools\berater`: Dienst auf `localhost:8190`, Testaufbau `tools\berater-test` auf `localhost:8191`
  (am Berater unter „Websites“ eintragen); `tools\berater pruefen shop` spielt den Prüfstand, `tools\berater stop` beendet.

- journali nach jeder Server-Änderung neu starten; nach Änderungen an `widget.js` oder am Kern auch den Berater-Dienst (er liest beides nur
  beim Start, `plugins/advisor/serve.mjs`), dann die Seite neu laden. Die Vorschau in journali startet den Kern beim ersten Bedarf neu,
  nachdem journali neu gestartet ist.
- Am Berater: Sicht „Onlineshop“, unter „Websites“ die Adresse der Testseite; KI mit Team einschalten, wenn KI-Text gewünscht ist.
- Belegt ein Tunnel oder ein anderer Prozess die Ports des Testpaars, landet „localhost:…“ dort und nicht beim Dienst — Ports mit
  `Get-NetTCPConnection -State Listen -LocalPort …` prüfen.
- Ein fehlschlagender UI-Test darf kein DOM-Element in `assert.equal` vergleichen (Regel in `web/test/ui.mjs`).
