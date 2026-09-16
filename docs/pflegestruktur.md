# Pflegestruktur — Entwurf

Stand 16.09.2026, **Vorschlag, nicht entschieden.** Anlass: das Beispielprodukt
(Smartphone) zeigt, dass vier Attribute mit Sprache/Kanal nicht reichen. Hier
steht, woraus das Modell besteht, wie das Beispiel darauf abgebildet wird,
und welche Eintragstypen das braucht. Erst wenn das steht, wird gebaut.

## Grundsatz

Das Modell selbst — welche Attribute es gibt, welche Typen, welche Familien —
steht **im Journal**, nicht im Code und nicht in einer Konfigurationsdatei.
Sonst gilt „das Journal ist die Wahrheit" nur für die Hälfte, und ein
Abbild von 2025 liesse sich mit dem Modell von 2026 nicht mehr lesen.
Modell-Einträge haben eigene Ströme (`attribute:…`, `family:…`,
`category:…`, `list:…`), Produkte bleiben ein Strom je Produkt.

## Die Bausteine

### 1. Attribut (`attribute:<key>`)

| Feld | Bedeutung | Beispiel |
|---|---|---|
| `key` | technischer Name, für immer | `display_size` |
| `label` | Anzeigename je Sprache | de „Displaygrösse", en "Display size" |
| `type` | siehe Typen | `decimal` |
| `unit` | Einheit, nur bei Zahlen | `in` |
| `group` | Gruppe in der Pflege (nur Anzeige) | `technical` |
| `axes` | welche Achsen der Wert hat | `[]`, `[locale]`, `[locale, channel]`, `[level]` |
| `channels` | falls nur für bestimmte Kanäle | `[amazon]` |
| `list` | Werteliste bei `enum`/`enums` | `list:brand` |
| `multiple` | mehrere Werte (Liste) | `true` bei keywords |

**Typen** (je Typ eine Zelle in der Oberfläche):

| Typ | Zelle | Beispiel |
|---|---|---|
| `text` | eine Zeile | title |
| `html` | Editor mit Fett/Absatz/Liste | description |
| `integer` | Zahl + Einheit | storage 256 GB |
| `decimal` | Zahl + Einheit | display 6.7 in |
| `boolean` | Schalter | searchable |
| `date` | Datum | launch |
| `enum` | Auswahl aus Werteliste | brand, color, os |
| `reference` | Verweis auf ein Produkt | (Relationen, siehe 7) |

`multiple: true` macht aus jedem Typ eine Liste (keywords = `text` mehrfach,
bullet_points = `text` mehrfach mit Achsen locale+channel).

**Sprachabhängig** ist kein Typ, sondern die Achse `locale` in `axes`:
`title` hat sie (ein Wert je Sprache), `weight` nicht (ein Wert für alle).
Ein sprachabhängiges Feld ohne Wert in `en` fällt auf `*` zurück, wenn es
dort einen gibt — sonst ist es leer, und die Vollständigkeit für `en`
zählt es als fehlend. Der Kanal ist die zweite Achse nach demselben Muster.

### 2. Werteliste (`list:<key>`)

Marke, Farbe, Betriebssystem, Relationstyp, Medienrolle: ein Schlüssel je
Wert, Label je Sprache, optional Zusatzfelder (Farbe: Hexcode). Eine
Werteliste ist ein Strom, jeder Wert ein Eintrag `ListValueDefined`.

### 3. Familie (`family:<key>`)

Was für ein Ding ist das Produkt, und welche Attribute hat es. Ein Produkt
hat genau eine Familie. Die Familie sagt:

- welche Attribute (in welcher Reihenfolge, in welchen Gruppen)
- welche davon **Pflicht** sind — je Kanal *und* je Sprache: fürs Web
  reicht `title`, für Amazon müssen `bullet_points` da sein; `en` ist für
  Print keine Pflicht, für den Shop schon. Ein Attribut in der Familie
  trägt also `required: { web: [de, en], amazon: [de], print: [de] }`
  (oder `*` für „in jeder Sprache"). Das ist die Vollständigkeitsregel;
  das Abbild rechnet daraus je Produkt × Kanal × Sprache eine Zahl
  („web/en 7 / 9") und die Liste, was fehlt. Freigabe für einen Kanal
  setzt Vollständigkeit dort voraus — als Warnung oder als Sperre, zu
  entscheiden.
- welche **Variantenebenen** es gibt: Smartphone = Modell → Farbe →
  Speicher; Stiefel = Modell → Farbe → Grösse; Kabel = keine.

### 4. Kategorie (`category:<id>`)

Baum: `CategoryDefined(id, parent, label je Sprache)`. Das Produkt bekommt
`CategoryAssigned(id)` (gibt es schon). Der Pfad „Elektronik › Smartphones &
Zubehör › Smartphones" ist Ableitung, nicht Speicher.

### 5. Produkt (`<product-id>`)

Der Strom ist eine **interne Id**, nicht die SKU: SKUs werden umbenannt
(Lieferantenwechsel, neues Schema), ein Strom nie. Die SKU ist ein Attribut
mit Eindeutigkeitsprüfung — genau die „kleine synchrone Prüf-Projektion"
aus `architektur.md`. Erster Eintrag: `ProductCreated(family, sku)`.

`created_at` und `updated_at` werden nicht gespeichert: erster und letzter
Eintrag des Stroms.

**Status** (`draft`, `active`, `discontinued`) ist global, die Freigabe je
Kanal bleibt daneben: `discontinued` überstimmt jede Freigabe.

### 6. Medien

Ein Bild ist nicht ein Attributwert — es hat Rolle, Reihenfolge, Typ und
eigene Texte je Sprache. Deshalb eigene Einträge auf dem Produktstrom:
`MediaAttached(mediaId, kind, role, url)`, `MediaDetached(mediaId)`,
`MediaTextSet(mediaId, field, locale, value)` für alt/title,
`MediaOrdered([ids])`. Die Datei selbst liegt nicht im Journal, nur ihr Ort.

### 7. Relationen

`RelationAdded(type, targetId, locale texts)`, `RelationRemoved(type, targetId)`.
Der Typ (Upsell, Crosssell, Zubehör, Ersatz) kommt aus einer Werteliste.
Gerichtet: die Gegenrichtung ist ein eigener Eintrag auf dem anderen Strom
oder eine Ableitung — zu entscheiden.

### 8. Variantenebenen

Die dritte Achse neben Sprache und Kanal. Die Familie definiert die Ebenen,
ein Produkt auf Ebene n hat einen Elternstrom auf Ebene n−1
(`ProductCreated(family, sku, parent)`). Vererbung = `Resolve` läuft den
Elternpfad hoch, wie heute schon über Kanal → Sprache → alle. Das Beispiel
`SP-PHONE-X10-BLK` ist Ebene 1 (Farbe) unter `SP-PHONE-X10`, und
`…-BLK-256` wäre Ebene 2 (Speicher). Farbe und Speicher sind dann keine
freien Attribute mehr, sondern die Ebenenwerte.

### 9. Wörterbücher (`dictionary:<key>`)

*Lesart (Vorschlag):* ein Begriff → Text je Sprache, an einer Stelle gepflegt
und überall benutzt: Labels der Wertelisten, Einheiten („Zoll"/„inch"),
Fachwörter in Texten, Gruppen- und Attributnamen. Eintrag
`TermDefined(term, locale, text)`. In Texten als `{t:oled}` referenzierbar;
das Abbild löst auf. Ändert sich die Übersetzung, ändern sich alle Texte,
die den Begriff benutzen — ohne einen einzigen Produkteintrag. Zweiter
Nutzen: Übersetzungsgedächtnis — was in einem Produkt schon übersetzt
wurde, schlägt das Wörterbuch beim nächsten vor.

### 10. Platzhaltertexte (`template:<family>/<attribute>`)

*Lesart (Vorschlag):* Textvorlagen je Familie × Attribut × Sprache × Kanal,
etwa `title` = `{brand} {model} – {storage} {u:GB} – {color}` → „TechVibe
Phone X10 – 256 GB – Schwarz". Platzhalter sind Attribute, Ebenenwerte,
Wörterbuchbegriffe, Einheiten. Eintrag `TemplateDefined(family, attribute,
locale, channel, template)`.

Der erzeugte Text ist **Ableitung**, kein Eintrag: das Abbild rechnet ihn
aus, solange kein eigener `AttributeSet` da ist — dieselbe Regel wie
heute beim Erben (eigener Wert > Vorlage > geerbt). In der Zelle steht er
als dritter Zustand neben „eigen" und „geerbt", etwa gestrichelt; Enter
macht daraus einen eigenen Wert, Entf gibt ihn an die Vorlage zurück.
Amazon-Bulletpoints, SEO-Titel, Print-Kurztexte sind damit Vorlagen, nicht
Handarbeit — und die Vollständigkeit zählt sie als erfüllt.

### 11. Plugin-API für externe Pflegewerkzeuge (Import, Export)

Das Journal *ist* die Schnittstelle; ein Plugin ist ein eigener Prozess
(jede Sprache, eigener Container), der sie benutzt:

| Richtung | Weg | Beispiel |
|---|---|---|
| Export | `GET /api/journal?after=N` liest das Delta, `GET /api/products/{id}` den Stand | Shop-Feed, InDesign-XML, Suchindex |
| Import | Befehle (`POST …/attributes` usw.) oder roh `POST /api/journal` | Lieferanten-CSV, das Beispiel-JSON, Altsystem |
| Modell | `GET /api/model`, `GET /api/dictionary` | Feldzuordnung im Plugin |

Dazu kommt, was heute fehlt:

- **Abnehmer** mit Namen und Schlüssel (`X-Actor` = Pluginname, Token statt
  Vertrauen). Der Server merkt sich je Abnehmer „zuletzt gelesen"
  (`PUT /api/consumers/{key}/cursor`) — das ist der Wert, hinter dem
  verdichtet werden darf (`architektur.md`). Diese Cursor sind das eine
  Stück Zustand, das *nicht* aus dem Journal kommt: sie sind Buchhaltung
  über Leser, keine Produktwahrheit; eigene kleine Tabelle.
- **Stossen statt Fragen:** optional ein Webhook je Abnehmer, den der
  Server ruft, wenn `head` steigt; das Plugin holt dann das Delta. Kein
  Plugin muss dauernd fragen.
- **Herkunft:** ein Import-Eintrag trägt `actor = plugin:<key>`, damit
  „Wert von Hand" und „Wert aus Import" unterscheidbar bleiben — und ein
  Import einen Handwert nicht stillschweigend überschreibt (Regel je
  Attribut: Import darf / darf nicht).
- **Kein Code im Server:** Plugins laufen nie im Prozess. Isolation, eigene
  Sprache, eigenes Deployment; die Kosten sind ein HTTP-Aufruf.

Das erste Plugin ist der Import des Beispiel-JSON — er zwingt die Zuordnung
oben in Code und deckt auf, was im Modell fehlt.

### 12. Massendatenpflege wie in Excel

Die Produktliste wird zum Gitter: Zeilen = Produkte (gefiltert nach
Familie, Kategorie, Vollständigkeit, Suche), Spalten = frei gewählte
Attribute auf einer gewählten Achse (z. B. `title/de`, `weight`,
`brand`). Darin:

- Zelle bearbeiten wie heute; Pfeiltasten, Tab, Enter, Mehrfachauswahl
  mit Shift/Strg, Bereich ziehen
- **Ausfüllen nach unten** (Strg+D), Spalte mit einem Wert füllen,
  Suchen/Ersetzen in einer Spalte
- **Einfügen aus Excel** (Strg+V mit Tabulator-Text): Zeilen werden über
  die SKU-Spalte zugeordnet, Spalten über die Kopfzeile; vor dem Schreiben
  eine Vorschau „vorher → nachher" je Zelle, wie `ConfirmWindow` in
  KnightsVoyage
- Kopieren nach Excel (Strg+C liefert Tabulator-Text mit Kopfzeile)
- Spalten sortieren, filtern, ein-/ausblenden, Ansicht speichern

Im Journal ist jede geänderte Zelle ein eigener `AttributeSet` — aber alle
aus einer Aktion tragen dieselbe `batch`-Kennung (Feld im Eintrag, kein
neuer Typ). Damit ist **Rückgängig für die ganze Aktion** eine Reihe
kompensierender Einträge, und im Journal steht „anna, 14:02, 340 Zellen
aus Einfügen" als eine Zeile, aufklappbar. Der Server bekommt dafür einen
Stapelbefehl (`POST /api/batch` mit einer Liste von Befehlen, ein Aufruf,
eine Sperre) — und genau der ist auch der Importweg für Plugins.

## Messlatte: OpenDXP

Taloan: „Unter dem, was OpenDXP kann, brauchen wir gar nicht erst zu landen."
Was OpenDXP für Datenobjekte anbietet (aus der Doku, Stand 16.09.2026,
`docs.opendxp.io/docs/core-framework/Objects/Object_Classes/Data_Types/`),
und wo es hier landet:

| OpenDXP | journali |
|---|---|
| input, textarea, wysiwyg | `text`, `text` mehrzeilig, `html` |
| numeric, quantity value | `integer`/`decimal` mit `unit` |
| date, datetime, time | `date`, `datetime` |
| select, multiselect, select options | `enum`, `enums` aus Werteliste (2) |
| country, language, countries, languages | Wertelisten, mitgeliefert |
| checkbox | `boolean` |
| link, externalimage, image, imagegallery, video | Medien (6) mit Rolle |
| many-to-one / many-to-many / advanced relations, reverse relation | Relationen (7) — typisiert, mit Texten; Gegenrichtung als Ableitung |
| localizedfields | Achse `locale` (1) — je Attribut, nicht je Block |
| classificationstore | Familie (3) + Gruppen — Attribute nach Produktart, ohne Klassenwechsel |
| objectbricks, fieldcollections, block, table, structuredtable | **fehlt.** Wiederholbare Gruppen (drei Adressen, n Tabellenzeilen). Vorschlag: `multiple` auf Gruppenebene, wenn ein Fall kommt |
| calculatedvalue | Platzhaltertexte (10) — für Zahlen später eine Formel |
| geopoint, geobounds, … | **fehlt**, bis ein Fall kommt |
| user, password, CRM-Felder | nicht Gegenstand (kein CDP) |
| dynamic select | Werteliste aus Plugin (11) |
| Versionierung, „wer hat wann was" | das Journal selbst — vollständiger als Versionen je Objekt |
| Workflows | Status (5) + Freigabe je Kanal; freie Workflows fehlen |
| Rechte je Klasse/Feld | **fehlt** — Anmeldung und Rechte sind noch offen |
| Grid/Massenbearbeitung, CSV-Export | (12) |
| REST/GraphQL, Data Hub | `/api`, Delta über Nummer (11); GraphQL fehlt |
| DAM (Assets mit Metadaten, Thumbnails) | **fehlt** — Medien (6) speichern nur den Ort; ein DAM wäre ein Plugin oder ein späterer Baustein |

Wo journali darüber liegt: Historie ohne Versionstabellen, Delta-Export
ab Nummer, jedes Abbild neu baubar, Platzhaltertexte als Ableitung,
Vollständigkeit je Kanal × Sprache als Regel im Modell.

## Das Beispiel auf dem Modell

| Im JSON | Wird zu |
|---|---|
| `product_id` | Strom-Id |
| `sku` | Attribut `sku`, `text`, eindeutig — oder Ebenenschlüssel, siehe 8 |
| `gtin` | Attribut `gtin`, `text`, eindeutig |
| `status` | `StatusSet` |
| `created_at`, `updated_at` | erster/letzter Eintrag |
| `structure.category_path` | `CategoryAssigned` auf das Blatt; Pfad ist Ableitung |
| `structure.brand` | Attribut `brand`, `enum` aus `list:brand` |
| `structure.model_family` | Ebene 0 der Variantenstruktur (oder Attribut `enum`, wenn keine Varianten) |
| `localization.de.title` | `title`, `text`, Achse locale |
| `localization.de.summary` | `summary`, `text`, locale |
| `localization.de.description` | `description`, `html`, locale (+ channel, wenn Shop und Print abweichen) |
| `localization.de.keywords` | `keywords`, `text` mehrfach, locale |
| `attributes.technical.display_size_inch` | `display_size`, `decimal`, unit `in`, Gruppe technical |
| `…display_resolution` | zwei Attribute `display_width_px`, `display_height_px`, `integer` — oder `text`, wenn man es nie rechnen will |
| `…storage_capacity_gb` | `storage`, `integer`, unit `GB` — Kandidat für Ebene 2 |
| `…ram_gb`, `…battery_capacity_mah`, `…processor_cores` | `integer` mit Einheit |
| `…operating_system` | `os`, `enum` aus `list:os` |
| `attributes.physical.color` | Ebene 1 (Farbe), Wert aus `list:color` mit Hexcode als Zusatzfeld — nicht zwei Attribute |
| `…weight_g`, `…dimensions.*` | vier Attribute `integer`/`decimal` mit Einheit, Gruppe physical; keine Verschachtelung |
| `attributes.logistics.*` | dito, Gruppe logistics; `customs_tariff_number` als `text` |
| `media[]` | `MediaAttached` je Eintrag, `alt_text_de` → `MediaTextSet(id, alt, de, …)` |
| `channels.b2c_shop.is_visible` | `ReleaseGranted(b2c_shop)` |
| `channels.b2c_shop.searchable` | Attribut `searchable`, `boolean`, Achse channel |
| `channels.amazon_marketplace.bullet_points_de` | `bullet_points`, `text` mehrfach, Achsen locale+channel, `channels: [amazon]` |
| `relations[]` | `RelationAdded(UPSELL, …)` mit `description` als Text je Sprache |

Was das JSON nicht hat und ein PIM braucht: Familie (welche Attribute
überhaupt), Pflichtfelder je Kanal, Variantenebenen, Werte-Herkunft
(Import vs. Hand), Freigabe je Sprache.

## Eintragstypen, die dazukommen

| Strom | Typ | Nutzdaten |
|---|---|---|
| `attribute:<key>` | `AttributeDefined` | die ganze Definition (klein, atomar — der letzte gewinnt) |
| `list:<key>` | `ListValueDefined` / `ListValueRetired` | `value`, `label{}`, Zusatzfelder |
| `family:<key>` | `FamilyDefined` | `label{}`, `attributes[]` mit Gruppe und Pflicht je Kanal, `levels[]` |
| `category:<id>` | `CategoryDefined` / `CategoryRetired` | `parent`, `label{}` |
| Produkt | `ProductCreated` | `family`, `sku`, `parent?` |
| Produkt | `StatusSet` | `status` |
| Produkt | `AttributeSet` | wie heute, plus `level` fällt weg (der Strom ist die Ebene) |
| Produkt | `MediaAttached` / `MediaDetached` / `MediaTextSet` / `MediaOrdered` | siehe 6 |
| Produkt | `RelationAdded` / `RelationRemoved` | siehe 7 |
| `dictionary:<key>` | `TermDefined` / `TermRetired` | `term`, `locale`, `text` |
| `template:…` | `TemplateDefined` / `TemplateRetired` | `family`, `attribute`, `locale?`, `channel?`, `template` |
| `consumer:<key>` | `ConsumerRegistered` / `ConsumerRetired` | `label`, `kind` (import/export), `webhook?`; der Cursor liegt daneben, nicht im Journal |

`CategoryAssigned/Removed`, `ReleaseGranted/Revoked` bleiben wie sie sind.
Die heutige feste `Model`-Liste im Code wird zum Abbild der
`AttributeDefined`-Einträge; die vier Attribute wandern als erste
Definitionen ins Journal.

## Was sich in der Oberfläche ändert

- Neue Ansicht **Modell**: Attribute als Gitter (Key, Typ, Einheit, Achsen,
  Gruppe), Familien mit ihrer Attributliste, Wertelisten, Kategoriebaum —
  dieselbe Zellenbearbeitung wie beim Produkt.
- Produktansicht wird **familienabhängig**: Gruppen als Abschnitte, Zelle
  nach Typ (Zahl mit Einheit, Schalter, Auswahl, Listeneditor, HTML),
  Pflichtfelder je Kanal markiert, Vollständigkeit als Zahl je Kanal.
- Anlegen = Familie wählen + SKU; Varianten als Baum unter dem Modell.

## Reihenfolge

1. Attribute, Wertelisten, Familien im Journal + Modell-Ansicht
2. `ProductCreated` mit Familie, SKU-Eindeutigkeit, Status
3. Typisierte Zellen und Gruppen in der Produktansicht, Vollständigkeit
4. Kategoriebaum
5. Variantenebenen
6. Wörterbücher und Platzhaltertexte (brauchen 1–3)
7. Massengitter mit Stapelbefehl, Einfügen aus Excel, Rückgängig je Aktion
8. Medien, Relationen
9. Abnehmer, Cursor, Webhook; erstes Plugin: Import des Beispiel-JSON
10. Anmeldung und Rechte (je Familie/Attribut/Kanal)

## Offen — Taloans Wort

- Strom = interne Id (Vorschlag) oder doch SKU?
- Farbe/Speicher als Variantenebenen (Vorschlag) oder als normale Attribute
  und Varianten sind eigene Produkte ohne Vererbung?
- `AttributeDefined` als ganze Definition je Eintrag (Vorschlag) oder
  feldweise wie beim Produkt?
- Relationen gerichtet mit expliziter Gegenrichtung oder abgeleitet?
- HTML in `description`: roh speichern (Vorschlag) oder strukturiert (Markdown)?
- Wörterbuch: nur Begriffe (Vorschlag) oder auch ganze Sätze/Bausteine?
- Platzhaltertext-Ergebnis als Ableitung (Vorschlag) oder beim Anlegen als
  Eintrag „eingefroren"?
- Plugins: darf ein Import Handwerte überschreiben — je Attribut regelbar
  (Vorschlag) oder nie?
- Freigabe bei unvollständigem Produkt: Warnung (Vorschlag) oder Sperre?
- Wiederholbare Gruppen (OpenDXP objectbricks/fieldcollections): jetzt
  vorsehen oder warten, bis ein Fall kommt (Vorschlag)?
- DAM: eigener Baustein oder Plugin?
