# Pflegestruktur — Entwurf

Stand 16.09.2026, **Vorschlag; entschieden ist, was so markiert ist.**
Anlass: das Beispielprodukt (Smartphone) zeigt, dass vier Attribute mit
Sprache/Kanal nicht reichen. Hier steht, woraus das Modell besteht, wie das
Beispiel darauf abgebildet wird, und welche Eintragstypen das braucht. Erst
wenn das steht, wird gebaut.

**Entschieden (Taloan, 16.09.2026):**

- Der Strom ist eine **interne Id**, nie die SKU.
- Die Pflegehierarchie ist **Produktgruppe → Produktgruppe → … →
  Produktgruppe → Produkt → Variante**. Varianten sind die
  **verkaufsfähigen Blätter** auf der letzten Ebene; nur sie tragen SKU
  und GTIN.
- **Freigabe setzt Vollständigkeit voraus:** die Pflichtfelder der Familie
  für diesen Kanal und diese Sprache müssen ausgefüllt sein, sonst lehnt
  der Server `ReleaseGranted` ab. Kein Eintrag, keine Warnung — eine Sperre.
- **Vermehrbare Attribute** (13) gehören von Anfang an ins Modell.

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
  („web/en 7 / 9") und die Liste, was fehlt. **Freigabe für einen Kanal
  und eine Sprache setzt Vollständigkeit dort voraus — Sperre, entschieden.**
  Der Server prüft vor `ReleaseGranted` und antwortet sonst mit der Liste
  der fehlenden Felder; die Oberfläche zeigt den Schalter erst scharf, wenn
  die Zahl voll ist.
- welche **Variantenachsen** erlaubt sind: Smartphone = Farbe, Speicher;
  Stiefel = Farbe, Grösse; Kabel = keine. Das Produkt wählt daraus.

### 4. Kategorie (`category:<id>`)

Baum: `CategoryDefined(id, parent, label je Sprache)`. Das Produkt bekommt
`CategoryAssigned(id)` (gibt es schon). Der Pfad „Elektronik › Smartphones &
Zubehör › Smartphones" ist Ableitung, nicht Speicher.

### 5. Knoten: Produktgruppe, Produkt, Variante (`<id>`) — entschieden

Drei Rollen in einem Baum, jeder Knoten ein Strom mit **interner Id**
(SKUs werden umbenannt — Lieferantenwechsel, neues Schema —, ein Strom
nie):

| Rolle | Eltern | Kinder | Trägt |
|---|---|---|---|
| **Produktgruppe** | Wurzel oder Produktgruppe | Produktgruppen oder Produkte | Label je Sprache, gemeinsame Werte für alles darunter |
| **Produkt** | Produktgruppe | Varianten | Familie, die Pflegewerte, die **Variantenachsen** („variiert nach Farbe, Speicher") |
| **Variante** | Produkt | keine — verkaufsfähiges Blatt | SKU, GTIN, je Variantenachse einen Wert, Abweichungen |

Erste Einträge: `GroupCreated(parent, label)`, `ProductCreated(group,
family)`, `VariantCreated(product, sku, axisValues)`; Umhängen später
`NodeMoved(parent)`. SKU und GTIN sind Attribute der Variante mit
Eindeutigkeitsprüfung — die „kleine synchrone Prüf-Projektion" aus
`architektur.md`.

**Vererbung** läuft den Pfad hinauf: Variante → Produkt → Gruppe → … →
Wurzel, und auf jeder Stufe zusätzlich Kanal → Sprache → alle. Ein Wert an
der Gruppe „TechVibe" (brand) gilt für jedes Produkt und jede Variante
darunter, bis eines ihn überschreibt. Welche Rolle ein Attribut setzen
darf, steht in der Definition (`levels: [group, product, variant]`);
`sku` nur an der Variante, `brand` überall.

`created_at` und `updated_at` werden nicht gespeichert: erster und letzter
Eintrag des Stroms.

**Status** (`draft`, `active`, `discontinued`) am Produkt und an der
Variante; Freigabe je Kanal bleibt daneben. `discontinued` am Produkt
überstimmt jede Variante und jede Freigabe.

Was ein Produkt ohne Variante ist — eines mit genau einer, unsichtbaren
Variante, die die SKU trägt (Vorschlag), damit „verkaufsfähig = Variante"
ohne Ausnahme gilt.

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

### 8. Variantenachsen — entschieden: eine Variantenebene

Keine gestaffelten Ebenen (Farbe → Speicher) mehr, sondern **ein** Produkt
mit n Varianten, und das Produkt sagt, **wonach** es variiert: `axes:
[color, storage]`. Jede Variante hat je Achse genau einen Wert aus der
Werteliste (`VariantCreated(…, axisValues: {color: black, storage: 256})`);
die Kombination ist je Produkt eindeutig. Farbe und Speicher sind damit
Achsenwerte der Variante, keine freien Attribute — die Oberfläche zeigt
die Varianten eines Produkts als Matrix (Farbe × Speicher) oder Liste.

`SP-PHONE-X10-BLK` ist eine Variante (color=black) des Produkts „Phone
X10" in der Produktgruppe „X-Series" unter „TechVibe". Was das Produkt
und was die Gruppe ist, entscheidet die Pflege, nicht das System.

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

Das erste Plugin ist der **IXP-Import** (`plugins/import-tools/ixp/`):
Baum aus der IXP-API lesen, Knoten wählen, Vorschau, Import oder Update
vorhandener Knoten über die externe Kennung. Dafür braucht jeder Knoten
eine **externe Kennung** je Quellsystem: Eintrag `ExternalLinked{system,
id}` auf dem Knotenstrom, Abbild hält `(system, id) → Knoten`. Und der
**Stapelbefehl** (12) ist der Schreibweg.

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

### 13. Vermehrbare Attribute — entschieden

Taloans Name für das, was OpenDXP objectbricks / fieldcollections / table
nennt: ein Satz zusammengehöriger Felder, der **n-mal** an einem Knoten
vorkommt, mit Reihenfolge und Identität je Zeile.

| Fall | Zeile aus |
|---|---|
| Verpackungseinheiten | Menge, EAN, Gewicht, Masse — Einzelstück, 6er, Palette |
| Zertifikate | Name, Nummer, gültig bis, Dokument |
| Technische Tabelle | Merkmal, Wert, Einheit |
| Lieferanten | Lieferant, Artikelnummer dort, Einkaufspreis |
| Stückliste | Teil (Verweis), Anzahl |

Im Modell ist ein vermehrbares Attribut eine **Definition mit Spalten**
(`attribute:packaging` mit `type: rows`, `columns: [quantity, ean,
weight, …]` — jede Spalte selbst ein Attribut mit Typ, Einheit, Achsen)
und in der Familie wie jedes andere Attribut eingehängt, mit Pflicht
(„mindestens eine Zeile") je Kanal.

Am Knoten ist jede **Zeile ein eigener kleiner Strom** unter dem Produkt,
so wie Medien: `RowAdded(attribute, rowId)`, Werte per `AttributeSet` mit
`row: rowId` (Feld im bestehenden Typ, kein neuer), `RowRemoved(rowId)`,
`RowOrdered(attribute, [rowIds])`. Damit bleibt jede Zelle ein Eintrag
(„wer hat Zeile 3 geändert", Rückgängig je Zelle), und Zeilen erben nicht —
eine Verpackungseinheit gehört zu genau einer Variante. *Nicht* gewählt:
die ganze Tabelle als JSON in einem Wert; das ersetzt bei jeder Änderung
alles und verliert die Historie je Zeile.

In der Oberfläche ist es das bekannte Gitter, nur mit Zeilen statt Achsen
als Vertikale: + Zeile, Entf Zeile, Zeilen ziehen, dieselbe
Zellenbearbeitung. In der Massenpflege (12) erscheint es als
aufklappbare Unterzeilen je Produkt.

Ein einfaches Attribut mit `multiple: true` (Keywords) bleibt der
Sonderfall „eine Spalte, keine Identität" — die Liste ist ein Wert.

### 14. Einheiten (`unit:<key>`) — Grundstock da

Taloan: „Einheiten müssen auch konfiguriert werden, evtl. mit Umrechnung."
Eine Einheit gehört zu einer **Grösse** (mass, length, volume, data, count …)
und hat einen **Faktor zur Basiseinheit** dieser Grösse (kg = 1, g = 0.001,
in = 0.0254 m). `UnitDefined{key, label{}, quantity, factor}`; ein Attribut
darf nur eine definierte Einheit tragen; löschen geht nicht, solange ein
Attribut sie benutzt. Saatgut: kg g m cm mm in l ml GB MB TB pc.

Im Journal steht der Wert **immer in der Einheit des Attributs** — die
Umrechnung ist Anzeige und Export: Sicht „zeige Gewicht in g" rechnet
`wert × faktor(attribut) / faktor(sicht)`, ein Kanal (Amazon US) bekommt
Zoll statt Zentimeter. Noch nicht gebaut: die Umrechnung in der Zelle und
je Kanal (Feld `unit` an der Kanal- oder Sichtdefinition).

### 15. Sichten (`view:<key>`) — entschieden (Taloan, 16.09.2026)

> Die Reihenfolge gehört in eine Sicht. Später hat einer nur redaktionelle
> Sichten, der andere auch technische Werte, der Dritte vielleicht Preise —
> oder eine Sicht, die alles beinhaltet, für den PIM-Editor. Eine Sicht
> hängt nicht von einer Familie ab, sondern von einer Ebene im Baum. Die
> Gruppe ist Teil des Attributs.

Die Familie sagt, **was es gibt** und was Pflicht ist; die Sicht sagt,
**wer was sieht**: eine Auswahl von Attributen in Reihenfolge, optional nur
für eine Ebene (Gruppe, Produkt, Variante). `ViewDefined{key, label,
level?, attributes[{key}]}`. Die Gruppierung kommt vom Attribut; ein
Gruppenkopf steht dort, wo sein erstes Attribut steht. Im Knoten je Ebene
wählbar (gemerkt), ⇅ Anordnen ändert die gewählte Sicht per Drag & Drop
(Zeilen und ganze Gruppenblöcke); ohne Sicht zeigt der Knoten die Familie
„alles". Die Sicht ist der Ort, an dem später Rollen und Rechte greifen
(Schritt 10): welche Sichten ein Nutzer hat, was er darin ändern darf.

Das **Label-Attribut** (wie Produkt und Variante im Baum heissen) bleibt
an der Familie — es ist eine Eigenschaft des Dings, nicht der Sicht. Die
`group`-Angabe je Attribut in der Familie ist damit tot; sie bleibt im
Eintragstyp (für immer), wird aber nicht mehr gezeigt.

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
| objectbricks, fieldcollections, block, table, structuredtable | vermehrbare Attribute (13) — Zeilen mit Identität und Historie je Zelle |
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

Dazu fünf Punkte, die Taloan aus einer OpenDXP-Zusammenfassung nachgereicht
hat (16.09.2026):

| OpenDXP | journali |
|---|---|
| Datenmodell im Browser per Drag-and-Drop, Tabellen und Oberfläche entstehen daraus | Modell-Ansicht (Schritt 1): Definition als Gitterzeile, das Produktgitter baut sich aus dem Modell. Kein Drag-and-Drop; Reihenfolge und Gruppen kommen aus der Familie. Keine Tabellen zu erzeugen — das Journal ist schemafrei, das Abbild rechnet |
| API-first, REST/GraphQL, Anbindung ERP/CRM/PLM | `/api` + Delta ab Nummer (11). GraphQL: fehlt; kommt, wenn ein Abnehmer es braucht |
| KI-Bundles: Übersetzung (DeepL), Verschlagwortung, Anreicherung, Validierung | Plugins (11): ein Übersetzungs-Plugin liest das Delta, schreibt `AttributeSet` als `plugin:deepl` — Herkunft sichtbar, Handwert geschützt. Wörterbuch (9) als Gedächtnis dazu. Nichts davon im Server |
| Datendichtes ExtJS-Backend für Power-User, komplexe Gitter | genau das Ziel der Oberfläche: Gitter, Zelle, Tastatur, kein Formular; Massenpflege (12) |
| Suche über Millionen Datensätze, Elasticsearch/OpenSearch asynchron | der Suchindex ist ein Abbild, das dasselbe Journal liest (`architektur.md`). Erst Postgres-Volltext im Abbild, OpenSearch als Plugin/Abbild, wenn die Menge es verlangt |

## Das Beispiel auf dem Modell

| Im JSON | Wird zu |
|---|---|
| `product_id` | Strom-Id der **Variante** (das JSON beschreibt eine) |
| `sku` | Attribut `sku` an der Variante, `text`, eindeutig |
| `gtin` | Attribut `gtin` an der Variante, `text`, eindeutig |
| `status` | `StatusSet` |
| `created_at`, `updated_at` | erster/letzter Eintrag |
| `structure.category_path` | `CategoryAssigned` auf das Blatt; Pfad ist Ableitung |
| `structure.brand` | Attribut `brand`, `enum` aus `list:brand` |
| `structure.model_family` | Produktgruppe „X-Series" — oder Attribut `enum`, wenn die Gruppe anders geschnitten ist |
| `localization.de.title` | `title`, `text`, Achse locale |
| `localization.de.summary` | `summary`, `text`, locale |
| `localization.de.description` | `description`, `html`, locale (+ channel, wenn Shop und Print abweichen) |
| `localization.de.keywords` | `keywords`, `text` mehrfach, locale |
| `attributes.technical.display_size_inch` | `display_size`, `decimal`, unit `in`, Gruppe technical |
| `…display_resolution` | zwei Attribute `display_width_px`, `display_height_px`, `integer` — oder `text`, wenn man es nie rechnen will |
| `…storage_capacity_gb` | Variantenachse `storage` aus `list:storage` (128, 256, 512), wenn das Produkt danach variiert; sonst `integer` mit `GB` |
| `…ram_gb`, `…battery_capacity_mah`, `…processor_cores` | `integer` mit Einheit |
| `…operating_system` | `os`, `enum` aus `list:os` |
| `attributes.physical.color` | Variantenachse `color` aus `list:color`, Hexcode als Zusatzfeld des Listenwerts — nicht zwei Attribute |
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
| Gruppe | `GroupCreated` | `parent`, `label{}` |
| Produkt | `ProductCreated` | `group`, `family`, `axes[]` |
| Variante | `VariantCreated` | `product`, `sku`, `axisValues{}` |
| alle drei | `NodeMoved` | `parent` |
| Produkt | `StatusSet` | `status` |
| Produkt | `AttributeSet` | wie heute, plus `level` fällt weg (der Strom ist die Ebene) |
| Produkt | `MediaAttached` / `MediaDetached` / `MediaTextSet` / `MediaOrdered` | siehe 6 |
| Knoten | `RowAdded` / `RowRemoved` / `RowOrdered` | `attribute`, `rowId`; Werte per `AttributeSet` mit `row` — siehe 13 |
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
- Links ein **Baum** Produktgruppe → Produkt → Variante (aufklappbar,
  Tastatur), rechts der gewählte Knoten. Anlegen = im Baum: Gruppe unter
  Gruppe, Produkt mit Familie unter Gruppe, Variante mit Achsenwerten und
  SKU unter Produkt. Geerbte Werte stehen kursiv mit Herkunft im Tooltip
  („von X-Series").

## Reihenfolge

1. ~~Attribute, Wertelisten, Familien im Journal + Modell-Ansicht~~ 16.09.2026:
   Typen `LocaleDefined`, `ChannelDefined`, `AttributeDefined/Retired`,
   `ListDefined`, `ListValueDefined/Retired`, `FamilyDefined/Retired`; Abbild
   `ModelCatalog`; Saatgut; `/api/model`; Ansicht ⊞ Modell mit Gitter je
   Bereich; Produktgitter nach Gruppen, Zelle nach Typ (Text, Schalter,
   Auswahl), mehrfach kommagetrennt, Spalten `*/kanal`. Familien werden
   definiert, aber noch nicht benutzt (Schritt 2)
2. ~~Baum~~ 16.09.2026: `GroupCreated/Renamed`, `ProductCreated(group, family,
   axes)`, `VariantCreated(product, axisValues)`, `NodeMoved`, `NodeRetired`,
   `StatusSet`; Abbild `Tree` mit `Resolve` den Pfad hinauf und Herkunft;
   `sku` als Attribut nur an der Variante, eindeutig; `levels` je Attribut;
   Freigabe nur an der Variante. Ansicht ▣ Baum links (↑↓←→, Filter, Pfad
   aufgeklappt), Anlegen inline, Knoten mit Pfad, Status, Achsenwert 🔒,
   geerbt kursiv mit Herkunft. **Sicht** statt Matrix: gewählte Sprachen +
   ein Kanal als Spalten (Taloan: 27 Sprachen × 6 Kanäle passen nicht)
3. ~~Typisierte Zellen, Vollständigkeit, vermehrbare Attribute~~ 16.09.2026:
   Zellen für date (Datumsfeld) und html (Editor: Quelltext + Vorschau,
   Ctrl+Enter); `CompletenessRules` je Kanal × Sprache aus den Pflichtfeldern
   der Familie, geerbte Werte zählen, an den Freigaben als `n/m` grün/rot,
   Schalter gesperrt, Server lehnt `ReleaseGranted` ab und nennt die
   Fehlenden; `rows` mit `columns`, `RowAdded/Removed/Ordered`, Zellen per
   `AttributeSet` mit `row`, Zeilenblock im Gitter (+ Zeile, ↑↓, ×); Suche
   über alle Werte; Unterbaum zurückziehen (Entf, ein Stapel); Einheiten
   (14) als Modellbereich
4. Kategoriebaum
5. Variantenebenen
6. Wörterbücher und Platzhaltertexte (brauchen 1–3)
7. Massengitter mit ~~Stapelbefehl~~ (`POST /api/batch`, 16.09.2026), Einfügen aus Excel, Rückgängig je Aktion
8. Medien, Relationen
9. Abnehmer, Cursor, Webhook; ~~erstes Plugin: IXP-Import~~ 16.09.2026: Ansicht
   ⇩ Import (läuft im Browser gegen die IXP-API, CORS offen): Quellbaum mit
   Haken je Teilbaum, Ziel, Familie, Sprachen, Eigenschaften → Attribute
   (vorhandene oder neu als text/html), Vorschau neu/vorhanden über
   `ExternalLinked{ixp, masterId}`, ein Stapel; zweiter Lauf schreibt nur
   Geändertes. Offen: Familie aus `class_identifier`, `sort_nr`, Bilder,
   Fortschritt bei grossen Bäumen, Token-Anmeldung
10. Anmeldung und Rechte (je Familie/Attribut/Kanal)

## Offen — Taloans Wort

- Ist die **Kategorie** (4, `category_path` fürs Shop-Menü) ein zweiter,
  eigener Baum neben der Produktgruppe — oder *ist* die Produktgruppe die
  Kategorie? Vorschlag: zwei Bäume; Struktur (Pflege, Vererbung) und
  Navigation (Shop) fallen selten zusammen, ein Produkt kann in mehreren
  Kategorien hängen, aber nur in einer Gruppe.
- Produkt ohne Variante: heute muss eine Variante angelegt werden (ohne
  Achsen, wenn das Produkt nach nichts variiert); eine „unsichtbare"
  Einzelvariante gibt es noch nicht
- `AttributeDefined` als ganze Definition je Eintrag (Vorschlag) oder
  feldweise wie beim Produkt?
- Relationen gerichtet mit expliziter Gegenrichtung oder abgeleitet?
- HTML in `description`: roh speichern (Vorschlag) oder strukturiert (Markdown)?
- Wörterbuch: nur Begriffe (Vorschlag) oder auch ganze Sätze/Bausteine?
- Platzhaltertext-Ergebnis als Ableitung (Vorschlag) oder beim Anlegen als
  Eintrag „eingefroren"?
- Plugins: darf ein Import Handwerte überschreiben — je Attribut regelbar
  (Vorschlag) oder nie?
- DAM: eigener Baustein oder Plugin?
