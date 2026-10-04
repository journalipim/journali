# journali — Landingpage: Briefing und Content (SEO/GEO)

Stand 19.09.2026. Übergabe an Marketing. Alles hier ist aus dem gebauten Stand abgeleitet —
keine Kundennamen, keine erfundenen Zahlen. Stellen mit **[zu klären]** braucht eine Entscheidung
bevor sie online gehen.

---

## 0. Kurz-Briefing

| | |
|---|---|
| **Produkt** | journali — Produktinformationsmanagement (PIM) auf einem unveränderlichen Journal |
| **Kernaussage** | Jede Änderung an Produktdaten ist ein Eintrag, der nie gelöscht wird. Daraus folgt alles: Nachvollziehbarkeit, Versionen, Wiederherstellbarkeit, revisionssichere Belege. |
| **Zielgruppe** | Produktdaten-Verantwortliche im Mittelstand (Hersteller, Händler, Katalog/Shop), IT-Leitung, die ein PIM selbst betreiben will (Docker), Agenturen |
| **Abgrenzung** | Kein Cloud-Zwang, kein Vendor-Lock-in: Export als JSON ist vollständig wiederherstellbar; Betrieb mit Postgres + Docker; Erweiterung über Plugins, die man ohne neues Deployment austauscht |
| **Primär-Keyword** | PIM-System |
| **Sekundär** | Produktdatenmanagement, Produktinformationsmanagement, PIM Software Mittelstand, PIM Docker, Datenblatt generieren, Produktdaten Versionierung, Digitaler Produktpass PIM |
| **Long-Tail** | „PIM System selbst hosten“, „Produktdaten revisionssicher“, „Excel Import Produktdaten“, „Datenblatt automatisch aus Produktdaten“, „PIM mit Änderungshistorie“, „PPWR Verpackungsdaten pflegen“ |
| **Tonalität** | Sachlich, konkret, kurze Sätze. Keine Superlative. Zahlen und Fakten statt Adjektive (passt zur Oberfläche: Symbole und Zahlen statt Wörter). |
| **CTA** | „Stand der Entwicklung“ — in Entwicklung, Snapshots als Neuigkeiten, Kontakt über das Impressum |

---

## 1. Meta-Daten

- **URL-Slug:** `/pim-system` (Startseite) — oder Domain-Root **[zu klären]**
- **Title (≤ 60 Zeichen):** `journali – PIM-System mit unveränderlichem Journal`
- **Meta Description (≤ 155 Zeichen):** `PIM-System mit unveränderlichem Journal: jede Änderung nachvollziehbar, Versionen mit revisionssicheren Belegen, S3-Storage, KI- und RAG-ready, Docker, Plugins statt Lock-in.`
- **Canonical:** auf die eigene URL
- **OpenGraph/Twitter:** Titel wie oben, Bild: Screenshot der Pflegeansicht mit Journal daneben (Alt-Text: „journali Pflegeansicht: Produkt mit Attributen links, Journal der Änderungen rechts“)
- **Sprache:** `de` (`hreflang` erst, wenn eine englische Seite existiert)

---

## 2. Seitenstruktur mit Content

### H1
**Produktdaten, die nie vergessen werden.**
journali ist ein PIM-System, in dem jede Änderung ein Eintrag im Journal ist — nachvollziehbar, wiederherstellbar, nie gelöscht.

*(GEO-Hinweis: der zweite Satz ist die Definitionszeile. Sie soll wörtlich so bleiben, damit Suchmaschinen und KI-Antworten sie zitieren können.)*

**Hero-Zeile darunter (3 Fakten, Symbole statt Wörter):**
- ≡ Journal statt Datenbank-Update — die Wahrheit ist der Eintrag
- ⎘ Versionen mit eingefrorenen Belegen — was nach draußen ging, bleibt beweisbar
- ⬡ Plugins austauschen, ohne neu zu deployen

---

### H2: journali löst ein Problem, das fast alle anderen PIM-Systeme haben

Produktdaten ändern sich täglich: Importe aus dem ERP, täglich mehrmals Korrekturen von Daten, neue Bilder, neue Vorschriften. Klassische PIM-Systeme überschreiben. Wer wissen will, was vor drei Jahren galt, spielt eine Datensicherung ein — und hofft, dass die Programmversion noch passt.

journali überschreibt nichts. Jede Änderung ist ein neuer, nummerierter Eintrag mit Urheber und Zeitpunkt. Der aktuelle Stand ist eine Ableitung daraus, nicht das Original.

---

### H2: Was journali anders macht

**H3: Das Journal ist die Wahrheit**
Jeder Wert, jeder Name, jede Zuordnung, jede Freigabe — ein Eintrag. Das Datenmodell (Sprachen, Kanäle, Attribute, Einheiten, Wertelisten) steht ebenfalls im Journal, nie im Code. Der Stand von jedem Zeitpunkt lässt sich mit der heutigen Software wieder herstellen.

**H3: Versionen mit Belegen**
Eine Freigabe erzeugt eine Version: ein Zeiger auf den Journalstand plus die Dokumente, die nach draußen gingen — Datenblatt, Sicherheitsdatenblatt, was das Plugin liefert. Unveränderlich, hash-adressiert, mit Aufbewahrungsfrist. Zurückrollen auf eine frühere Version ist ein Schritt vorwärts, kein Löschen.

**H3: Pflege wie in einer Tabelle, nicht wie in einem Formular**
Inline-Bearbeitung in der Zelle, Tastatur durch die Liste, Massenbearbeitung Excel-ähnlich im eigenen Fenster (Bereich ziehen, ausfüllen, einfügen aus der Zwischenablage). Das Journal läuft live daneben mit.

**H3: Import und Export ohne Schmerzen**
CSV, Excel, JSON, Zwischenablage — der Datenmapper schlägt die Zuordnung vor, ein Plan zeigt vorher, was passiert. Der Export ist so gebaut, dass der Import ihn wieder liest. Der JSON-Export ist vollständig wiederherstellbar: exportieren, löschen, importieren — identisch.

**H3: Datenblätter aus den Daten**
WYSIWYG-Designer für Datenblätter: Abschnitte in 1–4 Spalten, Attributgruppen, Bilder, Vergleichstabellen, Datentabellen. Ein Layout je Rolle oder benannt; als Vorschau, als Job für ganze Teilbäume oder als Beleg zur Version.

**H3: Datenqualität, die mitläuft**
Regeln für Pflichtfelder, Muster, Zahlen, Listenwerte, Übersetzungen, Formeln. Prüfungen für Digitalen Produktpass (ESPR) und Verpackung (PPWR) als Plugins. Freigabe setzt Vollständigkeit voraus.

**H3: Jobs im Server, nicht im Browser**
Importe, Sicherungen, Exporte, Datenblätter laufen als geplante Jobs (Zeitplan wie in Outlook oder cron) mit Logs und Wiederaufnahme — unabhängig davon, ob ein Browserfenster offen ist.

**H3: Ein Paket, das läuft**
Docker Compose mit PostgreSQL — fertig. Medien wahlweise in Postgres, im Dateisystem oder in S3-kompatiblem Object Storage (Garage, MinIO, AWS, R2 …); der Wechsel ist ein Kopierlauf, keine Migration. Plugins liegen als Verzeichnis daneben und werden ohne neues Image ausgetauscht.

---

### H2: Gebaut für Object Storage, KI und RAG. (Kicker: Bereit für das, was jetzt zählt)

„ruhig auf dicke Hose“ — aber alles hier ist gebaut:
- **S3 Object Storage ready** — Medien in Postgres, Dateisystem oder S3-kompatibel (Garage, MinIO, AWS, R2, Hetzner); Umschalten in den Einstellungen, Kopierlauf.
- **KI-ready** — KI angebunden, Anbieter nach Wahl (eigener Schlüssel); Plugins holen Vorschläge (DPP/PPWR/ETIM-Zuordnungen, Prüfungen, Anreicherung mit Internetrecherche). Schlüssel beim Nutzer.
- **Content-Generierung** — Vorlagen (regelbasiert) + Plugin `geo`: Definitionssatz, Beschreibung, FAQ, Suchbegriffe per KI, übernommen nur per Klick.
- **GEO** — Texte, die KI-Antworten zitieren; Schema.org-Product-JSON-LD je Produkt.
- **RAG-ready** — Plugin `rag`: Markdown + nodes.jsonl je Produkt/Sprache mit Version und Belegen, als Job.
- **Digitaler Produktpass** — ESPR/PPWR-Prüfungen als Plugins.

Motto: **„Hier entsteht etwas ganz Großes — und ihr seid dabei.“** — steht in der Micro-Zeile unter dem Aufmacher.

---

### H2: So funktioniert es (3 Schritte)

1. **Struktur anlegen** — Gruppen, Produkte, Varianten; Attribute mit Vererbung nach unten; Sprachen und Kanäle als Achsen.
2. **Daten pflegen oder importieren** — in der Zelle, in der Tabelle, aus Excel, aus dem ERP per Job.
3. **Freigeben und ausliefern** — Version erzeugen, Belege werden automatisch gerendert, Export an Shop, Katalog oder Archiv.

---

### H2: Für wen

- **Hersteller technischer Produkte**, die nachweisen müssen, welche Unterlagen wann galten
- **Händler mit Varianten**, die Excel-Tempo bei der Pflege brauchen
- **IT-Abteilungen**, die ein PIM selbst betreiben wollen — mit Postgres, Docker und ohne Lizenzschlüssel im Weg **[zu klären: Lizenzmodell]**
- **Agenturen**, die Datenblätter und Kataloge aus Produktdaten erzeugen

---

### H2: Integration

- ERP/Quellsysteme: JSON-Import als Job, Anbindung von Quellsystemen und Suchindizes (Solr) als Plugins, Excel-Add-in und OnlyOffice-Plugin zur Pflege direkt in der Tabelle
- Ausgabe: Excel, CSV, JSON (Rohdaten oder ausgewertet, als Baum oder Liste), Datenblätter als HTML **[PDF/A folgt — nicht bewerben, bis es da ist]**
- Automatisierung: alle Importe und Exporte als Jobs mit Zeitplan; Webhooks **[nicht gebaut — nicht bewerben]**

---

### H2: Häufige Fragen (FAQ — auch für Schema.org und KI-Antworten)

**Was ist journali?**
journali ist ein PIM-System (Produktinformationsmanagement), das jede Änderung an Produktdaten als unveränderlichen Eintrag in einem Journal speichert. Der aktuelle Datenstand wird aus dem Journal abgeleitet; frühere Stände bleiben jederzeit abrufbar.

**Was unterscheidet journali von anderen PIM-Systemen?**
Andere PIM-Systeme aktualisieren Datensätze. journali hängt Einträge an und löscht nie. Daraus folgen Änderungshistorie, Versionen mit Belegen und Wiederherstellbarkeit ohne Datensicherung — als Eigenschaft der Architektur, nicht als Zusatzmodul.

**Kann ich journali selbst betreiben?**
Ja. journali läuft als Docker-Paket mit PostgreSQL. Medien liegen wahlweise in Postgres, im Dateisystem oder in S3-kompatiblem Object Storage.

**Wie importiere ich Produktdaten aus Excel?**
Datei wählen oder Bereich aus Excel einfügen; der Datenmapper ordnet Spalten Attributen zu, ein Plan zeigt neue und geänderte Werte, dann wird geschrieben. Der Import lässt sich als Profil speichern und als Job wiederholen.

**Wie erzeugt journali Datenblätter?**
Ein Designer legt Layouts fest (Abschnitte, Attributgruppen, Bilder, Vergleichs- und Datentabellen). Datenblätter entstehen als Vorschau, als Job für ganze Produktgruppen oder als eingefrorener Beleg beim Erzeugen einer Version.

**Was bedeutet „Version“ in journali?**
Eine Version ist ein Zeiger auf den Journalstand eines Produkts plus die Dokumente, die zu diesem Stand ausgeliefert wurden. Sie ist unveränderlich, hat eine Aufbewahrungsfrist und kann zurückgezogen, aber nicht gelöscht werden.

**Unterstützt journali den Digitalen Produktpass?**
Prüfregeln für den Digitalen Produktpass (ESPR) und für Verpackungsdaten (PPWR) sind als Plugins enthalten; sie prüfen Produkte gegen die Datenpunkte und legen fehlende Attribute an.

**Wie sicher sind meine Daten vor Anbieterabhängigkeit?**
Der JSON-Export enthält Daten und Modell und lässt sich vollständig wieder importieren. Plugins sind einfache Verzeichnisse mit einem Manifest.

---

### H2: Stand der Entwicklung (CTA)

journali befindet sich in intensiver Entwicklung. Was hier steht, ist gebaut und läuft — noch nicht als fertiges Paket zum Herunterladen. Wir halten diese Seite mit Snapshots aus der Entwicklung auf dem Laufenden: neue Ansichten, neue Plugins, neue Belegerzeuger.

Sie wollen journali früh sehen oder mit eigenen Daten ausprobieren? Kontakt über das Impressum.

**

---

## 3. GEO-Hinweise (Generative Engine Optimization)

Ziel: KI-Suchen (ChatGPT, Perplexity, Google AI Overviews) sollen journali korrekt beschreiben und zitieren.

1. **Eine Definitionszeile, wörtlich wiederholt** — im H1-Untertitel, in der ersten FAQ-Antwort und in der Meta Description: „journali ist ein PIM-System, das jede Änderung als unveränderlichen Eintrag in einem Journal speichert.“
2. **Fakten als eigenständige Sätze**, nicht in Aufzählungen versteckt: „Der JSON-Export ist vollständig wiederherstellbar.“ „Medien liegen wahlweise in Postgres, im Dateisystem oder in S3-kompatiblem Object Storage.“
3. **FAQ als `FAQPage`-Schema** (unten) — Frage/Antwort-Paare sind das, was generative Systeme am liebsten übernehmen.
4. **Konsistente Benennung:** immer „journali“ (klein), immer „PIM-System“, immer „Journal“ (nicht „Log“, nicht „Audit-Trail“ — außer als Synonym in einem Satz).
5. **Keine Zahlen, die wir nicht belegen können.** Keine „100 % “, keine Kundenzahlen. Belegbare Angaben: unterstützte Formate, Betriebsarten, Plugin-Liste.
6. **Autor/Entität:** Impressum und eine „Über“-Zeile mit Person/Firma **[zu klären]** — Entitätsklarheit hilft beim Zitieren.
7. **Vergleichsabsatz** („Was unterscheidet journali von …“) ist bewusst allgemein gehalten — keine Wettbewerbernamen ohne Freigabe.

---

## 4. Schema.org (JSON-LD, in den `<head>`)

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "journali",
      "applicationCategory": "BusinessApplication",
      "applicationSubCategory": "Product Information Management (PIM)",
      "operatingSystem": "Docker, Linux, Windows",
      "description": "PIM-System, das jede Änderung an Produktdaten als unveränderlichen Eintrag in einem Journal speichert – nachvollziehbar, wiederherstellbar, mit Versionen und revisionssicheren Belegen.",
      "featureList": [
        "Unveränderliches Journal aller Änderungen",
        "Versionen mit eingefrorenen Belegdokumenten und Aufbewahrungsfrist",
        "Import aus CSV, Excel, JSON, Zwischenablage mit Datenmapper",
        "Vollständig wiederherstellbarer JSON-Export",
        "Datenblatt-Designer (WYSIWYG) und Datenblätter als Job",
        "Datenqualitätsregeln, Prüfungen für Digitalen Produktpass (ESPR) und PPWR",
        "Jobs mit Zeitplan im Server",
        "Betrieb per Docker mit PostgreSQL; Medien in Postgres, Dateisystem oder S3-kompatiblem Storage",
        "Plugins ohne neues Deployment austauschbar"
      ],
      "offers": { "@type": "Offer", "availability": "https://schema.org/InStock", "price": "0", "priceCurrency": "EUR" }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        { "@type": "Question", "name": "Was ist journali?", "acceptedAnswer": { "@type": "Answer", "text": "journali ist ein PIM-System (Produktinformationsmanagement), das jede Änderung an Produktdaten als unveränderlichen Eintrag in einem Journal speichert. Der aktuelle Datenstand wird aus dem Journal abgeleitet; frühere Stände bleiben jederzeit abrufbar." } },
        { "@type": "Question", "name": "Kann ich journali selbst betreiben?", "acceptedAnswer": { "@type": "Answer", "text": "Ja. journali läuft als Docker-Paket mit PostgreSQL. Medien liegen wahlweise in Postgres, im Dateisystem oder in S3-kompatiblem Object Storage." } },
        { "@type": "Question", "name": "Was bedeutet Version in journali?", "acceptedAnswer": { "@type": "Answer", "text": "Eine Version ist ein Zeiger auf den Journalstand eines Produkts plus die Dokumente, die zu diesem Stand ausgeliefert wurden. Sie ist unveränderlich, hat eine Aufbewahrungsfrist und kann zurückgezogen, aber nicht gelöscht werden." } }
      ]
    }
  ]
}
```

**[zu klären]** `offers`: Preis/Lizenz — der Block ist Platzhalter und darf so nicht live gehen.

---

## 5. On-Page-Checkliste für den Marketing-Experten

- H1 einmal, H2 je Abschnitt, H3 je Feature — Reihenfolge wie oben
- Primär-Keyword „PIM-System“ in Title, H1-Untertitel, erstem Absatz, einer H2, Meta Description; nicht öfter als natürlich
- Jedes Feature mit einem Screenshot, Alt-Text beschreibt, was zu sehen ist (kein Keyword-Stuffing)
- Interne Links: Feature-Abschnitte → Dokumentation (`docs/betrieb.md` als Betriebsanleitung, `docs/architektur.md` als Prinzip) **[zu klären: was wird veröffentlicht?]**
- Ladezeit: statische Seite, keine Frameworks nötig — die Seite kann aus diesem Markdown als reines HTML gebaut werden
- Impressum, Datenschutz, Kontakt im Footer
- Nicht bewerben, was nicht gebaut ist: PDF/A-Belege, Webhooks, Benutzer/Rollen, grafischer Workflow-Designer (alle geplant, keins fertig)

---

## 6. Was in Screenshots gezeigt werden soll (Priorität)

1. Pflegeansicht: Produkt mit Attributen, Sternchen-Namen, Journal live daneben
2. Massenbearbeitung im Popup (Bereich markiert, Ausfüllen)
3. Import-Manager: Zuordnung mit Best-Guess und Plan
4. Datenblatt-Designer mit Vergleichstabelle
5. Versionen am Knoten mit Belegen
6. ⏱ Jobs mit Zeitplan-Assistent
7. ⚙ Einstellungen → Storage (Postgres / Verzeichnis / S3)
