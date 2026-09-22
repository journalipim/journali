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
**`*` bei Sprachachse** (Taloan, 17.09.2026) ist der **sprachneutrale
Grundtext** — wie die 35-Zeichen-Kurzbezeichnung aus SAP, während `de` der
ausgeschriebene Titel ist. Die Zelle ist änderbar; solange sie leer ist,
zeigt sie gedämpft den Master mit „◌ de". Kette je Sprache: eigener Wert →
Master → `*` → dasselbe bei den Vorfahren (wenn vererbbar). Drei Zustände
sichtbar: eigener Wert · ◌ aus dem Master (nicht übersetzt) · ⟳ zu
überarbeiten (übersetzt, aber der Master ist neuer). Leer ist eine Zelle
nur, wenn auch Master und `*` leer sind. Die Vollständigkeit für `en` zählt
weiter je Sprache. Ohne Sprachachse ist `*` die eine Zelle.
**Kanäle genauso** (Taloan, 20.09.2026): Sprachen und Kanäle sind eine Matrix
mit je einem Stern. Es gibt eine Mastersprache und einen **Masterkanal**; der
Master bekommt die Werte des Sterns und kann sie überschreiben; abgeleitete
Sprachen bzw. Kanäle beziehen ihren Wert aus dem Master. Kette je Achse:
eigener Wert → Fallback → Master → `*`, der Kanal fällt vor der Sprache
(`de/print` → `de/web` → `de` → … → `*`). **Fallback** (Taloan, 20.09.2026):
eine Sprache oder ein Kanal kann eine andere Ausprägung nennen, die vor dem
Master gilt — `fr-ch` → `fr-fr`, `shop_ch` → `shop_de`. Beim Kanal gilt der
Fallback auch für die Freigaben: das Sortiment von fr-ch ist das von fr-fr,
solange fr-ch nichts Eigenes sagt. Die Vollständigkeit zählt ohne Master.

**Status ist Vokabular** (Taloan, 22.09.2026): der Status eines Produkts oder
einer Variante ist der Lebenszyklus am Markt (Entwurf, aktiv, ausgelaufen —
oder Überprüfung, Freigabe, Verkauf DE, Verkauf weltweit), nicht die
Redaktion (das ist der Workflow). Die Status stehen im Modell unter Basics:
frei benennbar, Name je eingerichteter Sprache, Symbol, Farbe, Reihenfolge.
`draft` ist der Startstatus neuer Knoten und bleibt. Ein Workflow kann einen
Status als Wirkung setzen (`status:<key>`); der Import bildet einen
Fremdstatus (SAP-Materialstatus 300 → Überprüfung, 501 → Verkauf weltweit)
im Ziel „Status“ über eine Wertetabelle auf einen Schlüssel ab — die
Tabelle ist eine Umwandlung der Spalte und damit Teil des Profils.

**Ausleitung (Taloan, 21.09.2026, entschieden):** ein Publikationsbaum nennt
Kanal und optional Markt. Drin ist ein Produkt, wenn eine Variante für den
Kanal freigegeben ist (Kanal-Fallback zählt) und der Markt des Baums in den
Verkaufsländern (`markets`, vererbbar, leer = überall) steht — oder in der
Fallback-Kette des Markts (Liste `market`, Spalte `fallback`). Regel und
Gründe: `docs/eintraege.md` → Ausleitung, `Publication.cs`.

### 2. Werteliste (`list:<key>`) — Einträge mit eigenen Spalten

> Der Sinn: bei Farbe nicht „rot" als Text, sondern ein Eintrag aus der
> Liste. Erweitere ich den Eintrag um ein Feld (RAL), ist das über den
> Verweis schon da. (Taloan, 17.09.2026 — deshalb wieder „Werteliste", nicht
> „Wörterbuch".)

Eine Liste hat **Spalten** (`ListDefinition.columns`, z. B. `ral`, `hex`),
jeder Eintrag füllt sie in `extra`. Saatgut: `color` mit 20 Farben de/en
und RAL-Classic-Nummer. Offen: der Durchgriff im Produkt (Farbe → RAL als
abgeleitetes Feld für Export und Anzeige).

Marke, Farbe, Betriebssystem, Relationstyp, Medienrolle: ein Schlüssel je
Wert, Label je Sprache, optional Zusatzfelder (Farbe: Hexcode). Eine
Werteliste ist ein Strom, jeder Wert ein Eintrag `ListValueDefined`.

### 3. ~~Familie~~ → Attributgruppen am Baum (entschieden, Taloan, 17.09.2026)

> Nach den Beschreibungen ist eine Familie definiert durch meine Baumstruktur.
> Supermaster bekommt Name (Pflicht) und Beschreibung; Hardware darunter fügt
> das vererbbare Attribut Kategorie hinzu; PC, Laptops setzen es; Gaming-PCs
> hat damit automatisch Name, Beschreibung, Kategorie = PC.

Die Familie ist gestrichen. Stattdessen hängen **Attributgruppen an
Baumknoten** (`GroupsAttached`, an jedem Knotentyp); die *Definition*
vererbt sich nach unten — alles darunter hat diese Attribute dazu. Ob der
*Wert* vererbt wird, sagt das Attribut (`inheritable`, Vorgabe nein: Name
nein, Kategorie ja). Pflicht (je Kanal × Sprache) steht am Attribut und
gilt überall gleich — **Eineindeutigkeit**: soll es anders sein, heisst es
anders. Eine Gruppe sagt, **ab welchem Knotentyp** ihre Werte erfasst
werden (`activeFrom`): „Variantenmaster" mit SKU hängt am Supermaster, ist
ab Variante aktiv, darüber sichtbar und gesperrt; Vollständigkeit prüft nur,
wo aktiv. Am Knoten engt ein Filter ein: Alle Attribute (gesperrtes sichtbar) · Editierbare Attribute (auf dieser Ebene änderbar) · Nur hier editierbare Attribute (weder darüber noch darunter erlaubt).
Werte für Attribute, die nach dem Umhängen über keine Gruppe mehr gelten,
bleiben im Journal und stehen am Knoten als „verwaist".

#### alt: Familie

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

### 4. Kategorie — entschieden: weggelassen (Taloan, 17.09.2026)

Es gibt keinen Kategoriebaum neben dem Pflegebaum. Stattdessen:

- Soll ein Knoten in **mehreren Ästen** stehen, wird ein **„Symlink“**
  angelegt (Verweis auf den Knoten, kein zweiter Knoten) — noch zu bauen.
- **Kanalbäume** (Web, Print, …) werden **eigene Bäume**. Sie *können* mit dem
  Pflegebaum übereinstimmen, müssen aber nicht: ein Web-Menü oder eine
  Navigation folgt oft nicht der Pflegestruktur. Sie sind rein logische
  Strukturen zur Anordnung — keine Vererbung, keine Pflege darin.

`CategoryAssigned`/`CategoryRemoved` bleiben als Eintragstypen (Journal),
die Oberfläche zeigt sie nicht mehr; `Node.Categories` im Abbild bleibt.

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

**Entscheidung Taloan (21.09.2026):** Die SKU ist ein Attribut wie jedes
andere („bei anderen heisst es MATNR"). Es gibt **kein Kennungsattribut** —
nur das Merkmal **eindeutig** (`unique`) an der Attributdefinition: Text/Zahl,
einwertig, auch eine Variantenachse; beliebig viele je Modell, jedes für sich
(SKU, EAN, MATNR, „Elefant"). Einschalten mit Doppelten im Bestand wird
verweigert (erst bereinigen, `attr:<key>`). Die eindeutigen Werte sind die
**Schlüssel** eines Knotens: `keys` in der Baumzeile (Suche, Auswahl), der
erste benennt die Variante ohne ★, der Tabellen-Import findet damit den
Knoten wieder (Spalten eindeutiger Attribute stehen im Export vorn), die Kopie
eines Knotens nimmt sie nicht mit. (`settings:sku_attribute` vom selben Tag ist
ausser Kraft — Eintragstypen sind für immer, die Abbilder überlesen ihn.)

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

**Gebaut 21.09.2026 (erster Schnitt):** ein Wörterbuch, Strom `term:<key>`, `TermDefined {text je Sprache, note}` /
`TermRetired`, `ModelCatalog.Terms`, `/api/model/terms`; gepflegt in ⇄ Übersetzung (Band „Wörterbuch“). Wirkung heute:
Glossar für KI und DeepL, Gedächtnis in der Einheiten-Tabelle (📖 — der Begriff schlägt die Einheit ◌). Die Auflösung
`{t:oled}` in Texten und Labels der Wertelisten aus dem Wörterbuch sind offen.

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

**Präfix je Quellsystem** (Taloan, 17.09.2026): ein Import legt neue
Attribute als `<prefix><key>` an und sammelt sie in der Gruppe
`<prefix>import` — so kollidieren `title` aus IXP und `title` aus Solr nicht,
und man sieht dem Attribut die Herkunft an. Das Präfix steht im Profil
(IXP gebaut; Solr und Tabelle noch ohne).

Das erste Plugin ist der **IXP-Import** (`plugins/ixp/`):
Baum aus der IXP-API lesen, Knoten wählen, Vorschau, Import oder Update
vorhandener Knoten über die externe Kennung. Dafür braucht jeder Knoten
eine **externe Kennung** je Quellsystem: Eintrag `ExternalLinked{system,
id}` auf dem Knotenstrom, Abbild hält `(system, id) → Knoten`. Und der
**Stapelbefehl** (12) ist der Schreibweg.

### 12. Massendatenpflege wie in Excel

**Gebaut (17.09.2026, Taloan: „so bin ich doch nicht schnell"):** Cursor wie in Excel
(Pfeile, Shift+Pfeil Bereich, Enter speichert und springt nach unten, Tab nach
rechts, Tippen überschreibt, F2), Strg+D runterziehen, Strg+Shift+D Reihe
fortsetzen (Zahlen, Art-001), Strg+H Suchen & Ersetzen (Bereich/Tabelle,
Gross/Klein, ganze Zelle), Entf leert, Strg+C/V mit Excel. Kein Browser-Limit:
der Engpass war das fehlende Cursor-Modell, nicht der Client.

**Excel-Add-in** (Plugin `excel`, Office.js, 17.09.2026): Aufgabenbereich in
Excel, Knoten suchen, Tabelle ins Blatt laden, in Excel pflegen, „Geändertes
speichern" schreibt nur die Differenz zum Schnappschuss als einen Stapel.
Manifest unter `/plugins/excel/manifest.xml` (Origin vom Server eingesetzt);
auf der rossibox braucht es HTTPS. **OnlyOffice-Plugin** (`plugins/onlyoffice`,
Taloan: „hab ich eh installiert"): gleiche Bedienung als Seitenleiste in
OnlyOffice Tabellen, Installation über den Plugin-Manager mit
`/plugins/onlyoffice/package.plugin` (ZIP vom Server), Schnappschuss im
versteckten Blatt `_journali`. Der xlsx-Roundtrip bleibt der Weg, der nichts
voraussetzt.

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

> Sichten vererben sich im Baum. Eine Sicht definiert normalerweise die
> Gruppen, die man sehen darf, nicht einzelne Attribute — kommen tiefer im
> Baum weitere Attribute einer Gruppe hinzu, tauchen sie automatisch auf.

Die Familie sagt, **was es gibt** und was Pflicht ist; die Sicht sagt,
**wer was sieht**: eine **geordnete Liste von Gruppen** (16), einzelne
Attribute nur als Ausnahme. `ViewDefined{key, label, level?, items[{group}
| {key}]}`. Jeder Knoten zeigt in einer Gruppe automatisch die Attribute,
die er hat (Ebene, Familie) — deshalb gilt eine Sicht für den ganzen Baum
und „vererbt" sich von selbst. Im Knoten wählbar (gemerkt), ⇅ Anordnen:
Gruppenblöcke ordnen die Sicht, Zeilen ordnen ihre Gruppe (das schreibt die
Gruppe, nicht die Sicht); ohne Sicht zeigt der Knoten „komplett" (alle Gruppen, Reihenfolge der Standardsicht, Rest in Pfadreihenfolge).

### 16. Attributgruppen (`group:<key>`)

Gruppen sind eigene Modell-Dinge: Label je Sprache und **aktiv ab
Knotentyp** (`AttributeGroupDefined{key, label, activeFrom}`); die
Reihenfolge der Attribute liegt in der Sicht. Das Attribut verweist mit
`group`; Gruppen, die nur an Attributen vorkommen (z. B. „import" aus dem
Werkzeug), gelten als undefiniert, aber sichtbar. Saatgut: logistics (ab
Variante), texts, physical. Die Sicht ist der Ort, an dem später Rollen und Rechte greifen
(Schritt 10): welche Sichten ein Nutzer hat, was er darin ändern darf.

**Name im Baum**: siehe 17 — nicht mehr je Knotentyp (`TreeLabelDefined` ist
Altlast), sondern eigener Name am Knoten oder das ★ am Pfad.

> Ich möchte nicht in einem Ast umsortieren, sondern: ich kenne alle
> Attribute, ordne sie Gruppen zu, in Sichten sortiere ich Gruppen und darin
> Attribute per Drag & Drop; neu zugeordnete hängen unten an; eine Sicht
> gilt für einen Knotentyp; im Knoten schalte ich um zwischen alles und
> einer Sicht, rechts zwischen flach und Reitern.

So gebaut (17.09.2026): ⊞ Modell → Attributsichten mit Drag & Drop; im
Knoten Sicht je Knotentyp, ☰ flach / ⧉ Reiter, Filter Alle · Editierbare · Nur hier editierbare Attribute.

### 21. Suche mit Bedingungen (Taloan, 17.09.2026)

> Ich wusste, dass ich in einem Knoten schon mal etwas bei einem
> Funktionsattribut eingetragen hatte — auf die Wurzel gehen und nach dem
> Ergebnis suchen funktioniert so nicht.

Die Textsuche findet Text; die Frage „wo steht bei Attribut X überhaupt
etwas?" ist eine Frage nach der Struktur. Deshalb im Baum-Suchfeld Chips
`key:value` (englisch, alles UND) mit Vorschlägen am Cursor (Schlüssel, dann
Werte — der Baukasten war „gut gemeint, schlecht gemacht“, Taloan); ein Minus
davor verneint (`-empty:function`, `-role:variant`, `-Wort` — Taloan: „das
Gegenteil“), Klick auf den Chip dreht um: `attr:function` (eigener Wert da) · `attr:function=*sku*`
(Muster) · `attr:x=` (kein eigener Wert) · `empty:name/en` (auch geerbt
nichts) · `incomplete:web` · `role:variant` · `status:active` ·
`group:logistics` (gilt hier) · `under:<id>` · `by:Taloan` ·
`since:2026-09-10` · freier Text. Rechnet der Server (`Query.cs`), Treffer
wie bisher im Baum mit Pfad und Fundstelle. Offen: gespeicherte Suchen →
virtueller Ordner.

## 22. Vorlagen — Textbausteine ohne KI (Taloan, 17.09.2026)

> Content generieren, automatische Beschreibungen — braucht man dafür KI?

Zwei Schichten. Erst **Vorlagen** (Attributtyp `template`): der Wert am Knoten
ist die Vorlage, je Sprache, wenn so definiert; das Ergebnis baut der Server
beim Lesen wie bei der Formel (`Template.cs`), sichtbar in Knoten, Tabelle,
Export, Suche. Syntax für Redakteure, nicht Techniker: `{key}` (geerbt zählt,
Werteliste als Label, Sprache der Spalte), Zusätze `{weight|1|unit}` (Einheit,
Nachkommastellen in der Sprache, upper/lower/capitalize/plain), optionale
Abschnitte `[, {ram} GB RAM]`, die ganz wegfallen, wenn darin etwas leer ist —
so entstehen keine „, GB RAM“-Reste. Deterministisch, reproduzierbar, skaliert
über 27 Sprachen ohne 27 Korrekturleser. Editor wie bei der Formel: `{` zeigt
die Attribute, `|` die Zusätze, Vorschau am Knoten beim Tippen.

Dann **KI** als Plugin `ki` (offen): Profil je Zielattribut (Quellattribute,
Sprache, Ton, Modell), läuft über die Tabelle — Vorschläge landen als
ungespeicherte Zellen, nie automatisch; ins Journal mit Urheber `ki:<modell>`
und Stapel; Modell austauschbar (API-Schlüssel bleibt im Browser, oder lokal
Ollama auf der rossibox).

## 26. Benutzer & Rollen — gebaut (Taloan, 19.09.2026)

Voraussetzung für Workflow-Zuständigkeiten und Hosting. Identität und Rolle im Journal (`UserDefined`),
Geheimnisse in `auth.json` beim Server. Drei Rollen (admin, editor, reader); Rechte als Pfad-Regeln in
`Auth.Allowed`. Ohne Benutzer bleibt der Server offen (Intranet), mit Benutzern sperrt die Middleware `/api`
und setzt `X-Actor` aus der Sitzung. Sitzungen per Cookie, API-Token je Nutzer für Add-ins und Skripte,
Dienst-Token je Job-Lauf. Offen: SSO/OIDC, Passwort-Zurücksetzen per Mail, Rollen je Teilbaum,
Workflow-Rollen (Prüfer, Freigeber) darüber. Details: `docs/betrieb.md`.

## 25. Versionen — gebaut (Taloan, 19.09.2026)

Taloans Bild aus dem letzten PIM: das Datenblatt dient der Endkontrolle, bei „Version erzeugen“ läuft ein
Belegerzeuger (dort InBetween/InDesign → PDF/A), das Ergebnis wird mit der Version weggespeichert; für die
Haftungsfrage zählt nur das Dokument, das nach draussen ging, nicht der Datenbankstand. Entschieden:

- **Version = Zeiger + Belege.** `VersionCreated` hält den Journalstand; Belege hängen als `VersionDocumentAdded`
  daran (Medium, hash-adressiert, unveränderlich). Aufbewahrung je Version (Vorgabe 10 Jahre) — die spätere
  Lebensdauer-Regel für Bytes richtet sich danach: was eine laufende Version referenziert, bleibt.
- **Erzeuger sind Plugins:** Manifest `renderer: { kind, service }` — der Dienst bekommt `node`, `version`, `kind`,
  rendert, lädt per `POST /api/media` hoch und hängt per `POST /api/nodes/{id}/versions/{nr}/documents` an. Der
  Server ruft bei „Version erzeugen“ alle eingeschalteten Erzeuger (asynchron); `…/render` wiederholt das.
  `datasheet` liefert das HTML-Blatt mit Belegfuss (Version, Stand, Datum); PDF/A ist ein weiterer Erzeuger
  (Headless-Chromium), InBetween ein dritter — ohne Änderung am Kern.
- **Stand ansehen** (`GET …/versions/{nr}/diff`): Journal bis `journalNumber` abgespielt (`Catalog.AsOf`, die
  letzten Stände im Speicher), eigene Werte damals gegen heute — geerbte Werte und Baumposition zählen nicht
  (Taloan: „nicht die Welt von damals, sondern die Beschreibung von Artikel X“).
- **Zurückrollen** (`POST …/rollback`, erst `dryRun`): Plan mit allem, was gesetzt würde, und allem, was aussen vor
  bleibt (Attribut gibt es nicht mehr, gilt hier nicht, Zeilen vermehrbarer Attribute); dann ein Stapel vorwärts —
  wie `git revert`, nie `reset`; rückgängig machbar. Eine neue Version ist kein Schnitt: alle Deltas bleiben.
- **Zurückziehen** markiert nur (`VersionWithdrawn`), löscht nichts. Mit Kanal wird Vollständigkeit geprüft wie
  bei der Freigabe. Versionen sind vom Rückgängig ausgenommen.
- Noch offen: Benutzer und Rollen (Zuständigkeit), Workflow-Zustände über dem Status, grafischer Designer,
  Lebensdauer-Regel für Bytes, Ausdünnen des Journals nur nach Ablauf einer beschlossenen Frist (nie aus Platzgründen).

## 23. Jobs — fest eingebaut (Taloan, 19.09.2026; erst Plugin tasker, dann Grundfunktion: „dauerhaft in der Leiste“)

> Jobs wie Import dürfen nicht vom offenen Browserfenster abhängen; regelmässige
> Ausführung; Überwachung, Verwaltung, Logs.

Ein Job ist ein Plugin mit Prozess (`process` im Manifest: Befehl, Argumente,
Parameter mit `secret`) plus Parameter, Zeitplan (cron, fünf Felder) und
Zeitgrenze. Der Server (`JobRunner`) startet ihn als Kindprozess — nie im
Serverprozess selbst, Regel aus 19 —, schreibt die Ausgabe in `jobs/<key>/<run>.log`
und die Eckdaten ins Journal (`JobDefined`, `JobRunStarted`, `JobRunFinished`,
Urheber `job:<key>`). Je Job höchstens ein Lauf zugleich; abbrechen geht.
Geheimnisse (Token) liegen in `jobs/secrets.json` beim Server, nie im Journal,
nie im Repo — der Job bekommt sie als Parameter. Die Oberfläche (⏱ Jobs):
Liste mit Zeitplan, nächstem und letztem Lauf, ▶ jetzt, ⊘ abbrechen, an/aus,
Läufe mit Log (lebendig, solange er läuft). Erstes Prozess-Plugin: `backup`
(Rohdaten-JSON je Wurzel, behält n Stände).

**Entschieden (Taloan, 19.09.): alle Importe sind als Job ausführbar, anhand
gespeicherter Profile.** Der Token liegt dann als `secret`-Parameter des Jobs
in `secrets.json` beim Server — nicht im Profil, nicht im Journal (die eine
Ausnahme von 19). Der IXP-Import hat dafür einen Kern (`plugins/ixp/core.mjs`),
den Browser und Prozess (`job.mjs`) gleich benutzen: dieselbe Analyse, derselbe
Stapel, dieselben Regeln.

## 24. Regeln eines Imports — was passiert bei was (Taloan, 19.09.2026)

> Die Schwierigkeit, was jetzt neu dazukommt, ist die Fehlerbehandlung bzw.
> Vorab-Einstellungen im jeweiligen Plugin: was passiert bei was?

Im Browser entscheidet der Mensch am Bildschirm; im Job muss es vorher
feststehen. Darum trägt das Profil **Regeln** (`policy`), die in beiden Fällen
gelten — sichtbar in ⇩ Import → IXP → 4 · Ziel & Plan:

| Lage | Regel | Vorgabe |
|---|---|---|
| Quelle nicht erreichbar, Token abgelaufen, Ziel weg | immer: Lauf scheitert, nichts geschrieben (Analyse kommt vor dem ersten Befehl) | — |
| Eigenschaft der Quelle ohne Zuordnung | `unknownAttrs`: anlegen (Präfix, Gruppe aus der Klasse) · ignorieren und melden · abbrechen (Mensch ordnet im Browser zu) | anlegen |
| ein Befehl scheitert (SKU doppelt, Wert nicht in Liste …) | `onError`: überspringen und melden, Lauf „mit Warnungen“ · abbrechen, Rest nicht schreiben (Geschriebenes bleibt — Stapel, rückgängig-fähig) | überspringen |
| zu viele Fehler | `abortAbovePercent`: ab so viel Prozent (ab 5 Fehlern) abbrechen — die Quelle ist dann wohl kaputt; 0 = nie | 20 |
| Knoten im Ziel, den die Quelle nicht mehr liefert | `missing`: nur melden · Status „ausgelaufen“ · zurückziehen (tiefste zuerst) | melden |
| Quelle leer, System gefüllt | `emptyValues`: behalten · leeren | behalten |
| Medien | `media`: holen und anhängen (Fehler je Medium werden gemeldet, nicht abgebrochen) · nicht anfassen | holen |
| Probelauf | `dryRun`: nur analysieren, Plan melden | aus |

Der Ausgang eines Laufs: `ok`, `warn` (übersprungene Befehle), `failed`,
`timeout`, `cancelled` — im Journal (`JobRunFinished`) und in ⏱ Jobs; das
Log sagt, welcher Befehl warum. Dieselbe Tabelle gilt für Solr und Tabellen,
sobald sie einen Prozess haben (offen).

## 27. Workflow — Entwurf (Taloan, 21.09.2026: „brauchen wir auf jeden Fall — Workflow-Designer mit Freigaben, Korrekturschleifen etc.“)

**Gebaut 21.09.2026 (Kern und erste Oberfläche):** `Workflows.cs` (Abbild), `WorkflowApi.cs`, Befehle in `Commands.cs`, Eintragstypen
wie unten, Saatgut „Redaktion“ (Entwurf → Prüfung → Korrektur ⟲ → freigegeben; freigeben nur admin) und „Übersetzung“ (nicht
angefordert → zur Übersetzung → übersetzt → geprüft). Oberfläche: Band ⚑ Workflow am Knoten, Rechtsklick im Baum → Workflow für
die Auswahl, Einstellungen → ⚑ Workflows (Skizze + Tabellen, kein Ziehen von Pfeilen — der grafische Designer ist offen),
⚑ Aufgaben in der Leiste, Suche `wf:`. ⇄ Übersetzung filtert auf „zur Übersetzung“ und schaltet nach dem Schreiben weiter.
Entschieden vorerst so: ein Workflow gilt für Knotentypen (und Familien), mehrere Workflows nebeneinander; Zuständigkeit je
Person über `WorkflowAssigned` (Aufgaben zeigen nur mir Zugewiesenes oder Unzugewiesenes); keine Fristen; Rubriken der
Publikation nicht — Taloans Antworten auf die vier Fragen unten stehen aus.

Entwurf:

Heute: `StatusSet` (Entwurf · aktiv · ausgelaufen = Lebenszyklus des Dings) und `ReleaseGranted/Revoked` je Kanal.
Fehlt: der **Bearbeitungszustand** darüber — wer ist dran, was ist der nächste Schritt, wohin geht es zurück.

Vorschlag, Journal (alles Modell, nichts im Code):

| Strom | Typ | Nutzdaten |
|---|---|---|
| `workflow:<key>` | `WorkflowDefined` | `label`, `states[{key, label, color, final?}]`, `transitions[{key, from, to, label, roles[], noteRequired?, effects[]}]`, `appliesTo{roles[], families[]}`, `start` |
| `workflow:<key>` | `WorkflowRetired` | — |
| Knoten | `WorkflowStateSet` | `workflow`, `state`, `transition`, `note?` — der Schritt, der gegangen wurde |
| Knoten | `WorkflowAssigned` | `workflow`, `user?` (Person oder null = die Rolle des nächsten Übergangs) |

- **Zustände** sind frei (Entwurf → Prüfung → Korrektur → Freigabe → veröffentlicht), ein Workflow je Knotentyp oder je
  Familie (`appliesTo`); ein Knoten hat je Workflow genau einen Zustand (Abbild `Workflows`).
- **Übergänge** tragen die Rolle, die sie gehen darf (`roles`, Vokabular aus 26), ob eine Notiz Pflicht ist
  (Korrekturschleife: „zurück an Redaktion“ ohne Grund gibt es nicht) und **Wirkungen** (`effects`): `release:<kanal>`,
  `revoke:<kanal>`, `status:<wert>`, `version` — so ist „Freigabe“ ein Übergang, der `ReleaseGranted` schreibt, statt
  eines eigenen Knopfs. Freigabe je Kanal (25/18) bleibt die Wahrheit für die Ausleitung; der Workflow ist der Weg dorthin.
- **Designer** (Taloan: „Workflow Designer“): Zustände als Kacheln, Übergänge als Pfeile (SVG, Ziehen von Kachel zu
  Kachel), je Pfeil Rolle, Notiz-Pflicht, Wirkungen; Vorlagen „Vier-Augen“, „Redaktion–Prüfung–Freigabe“. Speichert
  `WorkflowDefined`.
- **Am Knoten**: Band „Workflow“ mit Zustand, den erlaubten Übergängen als Knöpfe (nur die der eigenen Rolle), Notiz,
  Verlauf aus dem Journal. Kontextmenü auf die Auswahl (Massen-Freigabe). Suche `wf:<zustand>`, `wf:mine`.
- **Meine Aufgaben**: Ansicht aller Knoten in Zuständen, deren nächster Übergang meiner Rolle (oder mir per
  `WorkflowAssigned`) gehört — nach Alter im Zustand.
- Rechte: `Auth` prüft an `POST /api/nodes/{id}/workflow/{transition}` die Rolle des Übergangs; `Rights.Release`
  bleibt für die Wirkung `release:` nötig.

Entscheidungen von Taloan: ein Workflow je Familie oder einer für alle? Zuständigkeit je Person (`WorkflowAssigned`) oder nur
je Rolle? Fristen je Zustand (Erinnerung, Eskalation) — jetzt oder später? Gilt der Workflow auch für Rubriken der
Publikation (Freigabe eines Kanalbaums)?

**Produkt und Varianten (Taloan, 21.09.2026, entschieden):** Freigaben hängen an Varianten. „freigeben“ am Produkt oder an
der Gruppe gibt alle vollständigen Varianten darunter frei — ausser denen, die in ihrem eigenen Workflow nicht am Ende stehen
(Entwurf, Prüfung, Korrektur): die überfährt der Vater nicht; ist keine freigebbar, bleibt der Schritt aus und nennt sie.
Zurücknehmen am Produkt trifft alle Varianten. Der Workflow-Zustand des Produkts ist redaktionell und wird vom System nicht
verändert; ob die Produktseite rausgeht, entscheidet die Ausleitung aus den Varianten (keine freigegeben = nicht ausgeleitet,
wieder eine = wieder da — nichts zu merken). Das Band zeigt die Tatsache: „⚠ nicht ausgeleitet“.

**Eskalation (Taloan, 21.09.2026, gebaut):** je Übergang optional „nach n Tagen an Rollen“ (`EscalateAfterDays`,
`EscalateRoles`, leer = jede Rolle mit Schreibrecht): steht ein Knoten so lange im Ausgangszustand, dürfen auch diese
Rollen den Schritt gehen — alle Redakteure im Urlaub, der Manager gibt frei. Am Knoten steht „⏰ Eskalation ab ⟨Datum⟩ → manager“,
nach Ablauf „⏰ eskaliert“; die Aufgabenliste (⚑ Workflows) zeigt den Schritt dann auch diesen Rollen. Kein Timer nötig:
der Vergleich läuft beim Lesen (Commands.Allowed/Escalated).

## 28. Übersetzungsmanagement — gebaut (Taloan, 21.09.2026, Blick in OpenDXP: „haben wir noch gar nicht“)

Die Zelle kannte die Zustände schon (◌ nicht übersetzt, ⟳ Master neuer); jetzt gibt es den Prozess darum: **Einheiten**
je Sprachrichtung — Knoten × sprachabhängiges Textattribut × Kanal × Zeile mit eigenem Quelltext — und ihr Zustand
`missing` / `stale` (Quelle seit dem Ziel geändert, nach `SetAt`) / `done`; vererbte Werte gehören dem Vorfahren.
`TranslateApi.cs`: `GET /api/translate/units` (root, from, to, channel, attributes, scope), `GET /api/translate/status`
(je Zielsprache fehlend/veraltet/fertig), `POST /api/translate/import` (Zieltexte; **nur, wenn der Hash der Quelle noch
stimmt** — seit 22.09.2026 gilt hier 30: eine überholte Übersetzung wird eingespielt und bleibt im Rückstand, `force`
überschreibt nur noch Konflikte), `GET/POST /api/translate/xliff` (XLIFF 2.0 schreiben; 2.0 und 1.2
lesen — der Hash steht als Notiz in der Datei). Plugin `xliff` (Thema ⇄ Übersetzung): 1 Sprachen/Kanal/Umfang/Attribute
· 2 Teilbaum · 3 Einheiten als Tabelle, Ziel direkt eintragen, ✦ KI vorübersetzen (nur Vorschlag, geschrieben mit 💾),
⇪ XLIFF für Agentur/CAT · 4 XLIFF zurück mit Plan. Als Job über die Fächer: Export nach out/ (latest für die Agentur),
Import aus in/ (Duplikat nach Hash). Tests `TranslateTests`. Offen: Übersetzungsgedächtnis (Wörterbuch 9),
Übersetzungs-Workflow (27: „zur Übersetzung“ als Zustand), DeepL als Anbieter neben der KI.
Dazu seit 22.09.2026 (30): `POST /api/translate/order` (Paket schnüren, mit `format=xliff` gleich die Datei) und
`GET /api/translate/orders` (was draussen ist, was zurückkam).

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

### Funktionsvergleich, Stand 21.09.2026 (Taloan: „lohnt mal einen Blick“)

Quellen: `docs.opendxp.io` (Overview, Objects, Assets, Tools and Features, Bundles) und `opendxp.io/en/platform/components/pim`,
gelesen am 21.09.2026. Die Tabelle von oben (16.09.) bleibt als Geschichte; hier der Stand nach fünf Tagen Bauen.
Was OpenDXP als Bundle hat, ist bei uns ein Plugin — beides ausserhalb des Kerns.

| Bereich | OpenDXP | journali heute | Urteil |
|---|---|---|---|
| Datenmodell | Klassen-Editor im Browser, Vererbung, Classification Store, Object Bricks, Localized Fields | Modell im Journal (Sprachen, Kanäle, Einheiten, Gruppen, Attribute, Listen, Sichten), Familien, Gruppen ab Ebene, Vererbung entlang des Baums, Achsen Sprache × Kanal je Attribut, vermehrbare Attribute, Formeln und Skripte, ETIM-Klassen | gleichauf; Modelländerungen sind bei uns Einträge mit Historie |
| Varianten | Variants als Objekte mit Vererbung vom Parent | Produkt → Varianten mit Achsen (eindeutige Kombination), geerbte Werte, Achsenassistent | gleichauf |
| Historie/Versionen | Versionen je Objekt (Tabelle), Auto-Save | das Journal selbst (jeder Wert, jede Struktur), Versionen als Zeiger ins Journal, Abbild zu #n | journali vorn — vollständig, ohne Versionstabelle |
| Rechte | Benutzer, Rollen, Rechte je Klasse/Feld/Layout, Permission Analyzer, 2FA | Benutzer, Rollen mit 9 Rechten (Lesen, Schreiben, Zurückziehen, Freigabe, Modell, Plugins, Jobs, Storage, Benutzer), Sitzungen, Dienst-Token je Job | OpenDXP vorn: Rechte je Feld/Teilbaum, 2FA, SSO fehlen |
| Workflow | Workflow Management (Zustände, Übergänge, Rollen) | Status + Freigabe je Kanal (mit Sortiment über den Vater); keine freien Zustände, keine Zuständigkeiten | OpenDXP vorn |
| Publikation | Multichannel über Output-Channels, Dokumente (CMS) | Publikationsbäume je Kanal × Markt (Rubriken, Verweise, Arbeitsname, kopierte Rubrik), Ausleitungsregel Freigabe × Markt; kein CMS | anders: wir leiten aus, OpenDXP rendert Seiten |
| DAM | Ordner, Metadaten, 200+ Vorschauen, Thumbnail-Pipelines, Bildbearbeitung, Fokuspunkt, WebDAV, Versionen | Medien nach Hash mit Werten (Alt-Text, Rechte), Ordnerbaum, Sortieren/Gruppieren, Vererbung an Subitems mit „unterbunden“, Store Postgres/Verzeichnis/S3, eine Vorschau (Browser rechnet) | OpenDXP vorn: Presets, Bildbearbeitung, Metadaten aus der Datei (EXIF/IPTC), Videovorschau |
| Import-Pipeline | Data Importer: je Feld eine Transformationskette (Data Types, Manipulation: Combine, Conditional, Explode, Trim, Replace, Static …) | Datenmapper mit **Umwandlung je Spalte** (`transform.js`, 21.09.: trim, ersetzen, Zahl aus „22 mm“, Ja/Nein, Datum, aufteilen, Spalten verbinden, fester Wert, wenn leer, Werte übersetzen, Bedingung, HTML), Kette im Profil, Vorschau je Spalte; danach die Prüfung des Attributtyps | gleichauf für Tabellen; Geo/Galerie-Typen fehlen |
| Massenpflege | Grid mit Spaltenkonfiguration, Batch-Edit, CSV/XLSX-Export und -Import im Grid | Tabellenansicht je Knoten (Inline, Tastatur), Excel/CSV/JSON-Import mit Datenmapper und strengem 1:1-Rundlauf, Office-Aufgabenbereiche (Excel, OnlyOffice) | gleichauf; Office-Seitenleiste haben sie nicht |
| Datenqualität | Validierung je Feld (Pflicht, Muster), Bundles | Regeln je Kanal × Sprache (Vollständigkeit), Datenanalyse-Plugins: DPP, PPWR, Empowering Consumers, GEO-Texte, Anreicherung mit KI | journali vorn — Regelwerke, nicht nur Feldprüfung |
| KI | Bundles (Übersetzung, Verschlagwortung, Anreicherung) | KI mehrere Anbieter, Schlüssel nur im Browser; Vorschläge nie ohne Bestätigung; Herkunft je Wert | gleichauf, anderer Grundsatz (Herkunft sichtbar) |
| Import/Export | Data Hub (GraphQL, REST), Import-Bundle, Grid-Export | `/api` mit Delta ab Nummer, Plugins: CSV, XLSX, JSON, IXP, Solr, Vorlagen-Export (BMEcat 2005/ETIM 5, Google Merchant, JSON), RAG-Export, Backup; Jobs mit Profil | GraphQL fehlt; Vorlagen-Export haben sie nicht im Kern |
| Suche | Advanced Object Search, Elasticsearch/OpenSearch-Bundle | Suche im Abbild mit Begriffen (`media:`, `rel:`, Status, Attribute); kein Volltextindex | OpenDXP vorn bei Millionen Datensätzen |
| Jobs/Automatisierung | Scheduling (Veröffentlichung), Maintenance, Symfony Messenger | Jobs als Kindprozesse (cron, von Hand), Profile, Geheimnisse beim Server; Fächer in/done (Entwurf) | gleichauf; terminierte Freigabe fehlt |
| Betrieb | Symfony/PHP, MySQL/MariaDB, Redis, Elasticsearch optional; Docker | .NET 8, Postgres, ein Prozess, Plugins als Bind-Mount, lokaler Journal-Spiegel; Docker | journali leichter; Schnappschüsse der Abbilder fehlen noch |
| API-Erweiterung | PHP-Bundles im Prozess, Events | Plugins nie im Serverprozess (Browser-Modul oder Kindprozess), nur über `/api` | Grundsatzentscheid: Stabilität vor Tiefe |
| Werkzeuge | Notes & Events, Tags, Perspectives, Custom Reports, Glossary, Notifications, PDF-Rendering, Cloning | Journal lebendig daneben (statt Notes/Events), Sichten je Rolle (statt Perspectives), Wörterbuch (statt Glossary), Datenblatt HTML + Designer (PDF-Stapel offen), Duplizieren; keine Tags, keine Reports, keine Benachrichtigungen | OpenDXP breiter; das meiste davon bei uns nicht Gegenstand oder Plugin-Stoff |
| CMS, E-Commerce, CDP | Documents, E-Commerce-Framework, Kundenobjekte | nicht Gegenstand | bewusst nicht |

Kurz: **vorn** sind wir bei Historie, Regelwerken (DQ/Compliance), Ausleitung je Kanal × Markt, Office-Anbindung und
Betriebsgewicht; **hinten** bei Rechten (Feld/Teilbaum, SSO, 2FA), freien Workflows, DAM-Tiefe (Presets, Metadaten aus
der Datei), Volltextsuche, GraphQL und terminierten Freigaben. Nicht Gegenstand: CMS, Shop, CDP.

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

## 29. Klassifikation und BMEcat — gebaut (Taloan, 22.09.2026: „ETIM ist eine Klassifikation, kein Exporttyp“)

**Wording (Taloan, 22.09.2026):** Im PIM gibt es zwei gängige Paare — *Attribut → Wert* oder
*Merkmal → Ausprägung*. journali hat sich mit Attributen und Attributgruppen auf das erste
festgelegt: wir sprechen von **Attributen** und ihren **Werten**, nie von Merkmalen oder
Ausprägungen. Ein ETIM-Merkmal heisst darum **ETIM-Attribut** (EF-Code) und wird einem Attribut
des Modells **zugeordnet** — „nicht zugeordnet“ statt „Merkmal ohne Attribut“ („ein Attribut ohne
Attribut“); Werte sind leer oder gefüllt.

**Trennschnitt (Taloans Entscheidung):** ETIM hilft nur, Produktgruppen und Produkte Klassen
zuzuordnen und die Merkmale als Attribute bereitzustellen. Der **BMEcat-Export setzt auf einen
Publikationsbaum auf** — welche Produkte, welche Rubriken, welche Reihenfolge, ist der Baum;
Freigabe, Markt und Stand gelten wie bei jeder Publikation. Damit entfällt jede
Export-Konfiguration im Klassifikations-Plugin („welche Klassen, ab welcher Stufe“).

**Klassifikation (Gruppe ⌗ in der Leiste; ETIM heute, ECLASS/UNSPSC mit demselben Aufbau):**
- Je System eine Attributgruppe, ein Klassenattribut, Merkmalsattribute. Innerhalb eines Systems
  **keine Gruppe je Klasse**: Merkmale sind global (`EF000008 Breite` in hunderten Klassen), ein
  Merkmal ist ein Attribut, die Klasse ist seine Bedingung (`when`). Genau eine Klasse je Produkt
  (ETIM-Grundsatz); mehrere Klassifikationen zugleich sind mehrere Systeme.
- **Klasse an der Produktgruppe, erbt** (Regelfall), Ausnahme am Produkt; an der Variante nicht.
  Die Gruppe des Systems gilt überall (die Klasse muss an der Gruppe stehen dürfen), die
  Merkmale nur an Produkt und Variante (`levels`) — normale Vererbung reicht (Taloan: Punkt 5).
- **Zuordnung statt Anlegen:** Standard ist ein vorhandenes Attribut des Kunden (`breite`,
  `farbe`) mit **ƒ** — dieselbe Umwandlungskette wie im Datenmapper (`plugins/table/transform.mjs`,
  Taloan: „die Werte existieren schon, nur nicht in der Form“): Einheit umrechnen, ja/x → Ja/Nein,
  Text → EV-Code nach Tabelle, von/bis verbinden. Ein eigenes `ef…`-Attribut ist der Ausweg; ab
  dann ist es das Attribut des Kunden, das die nächste Klassifikation wiederverwendet. Die
  Zuordnung (`map`: Schlüssel oder `{ to, steps }`) ist Modellwahrheit, einmal je Journal —
  **kein Profil im Klassifikations-Plugin**; eine aktive Release, Wechsel = Abgleich.
- **Bedient wird beim Gegenstand, nicht im Plugin** (Taloan, 22.09.: „nicht jedes Plugin muss beim
  Klick etwas ausführen — manche sind Wissens-/Funktions-Plugins, die Bedienung erfolgt an
  anderer Stelle“). Neuer Beitragspunkt **`nodeBands`**: ein Plugin zeichnet je Knoten ein Band in
  der Knotenansicht (`mount({ head, body }, nodeId, ctx)`, wie das Workflow-Band). Das Band
  ⌗ ETIM zeigt in einer Zeile Klasse (eigen/geerbt, ≠ abweichende darunter) · Attribute n/m
  (zugeordnet, ƒ, fehlend) · Daten % gefüllt (leer, passen nicht) und springt ins vorhandene
  Werkzeug: Zuweisen-Dialog, Zuordnung (auf die Klasse gefiltert), **Subitems-Tabelle mit genau
  den Spalten der Klasse** (`/table/<id>?attrs=…`, Taloan: „wir haben im Baum die Tabellenansicht,
  Excel — der Dialog ist grenzwertig“), Prüfung mit Funden im Körper. Die Ansicht des Plugins
  ist nur, was das Plugin selbst ist: Quelle und Versionen, Klassen in Gebrauch, Attribute,
  Zuordnung mit ƒ. Die eigene Tabelle des Dialogs ist weg.

**BMEcat = xport-Profil auf einem Publikationsbaum:** Quelle „Publikation“ statt Teilbaum —
`GET /api/pub/{id}/export` liefert nur Ausgeleitetes mit Rubrikenpfad; die Rubriken werden die
Kataloggruppen (`groups`), `parentId`/`path` je Produkt zeigen auf die Rubrik; Wertgruppen aus
Regel-Verweisen (ohne Knoten) bekommen `v-<bezeichnung>` als Schlüssel. Zurückgehaltenes zählt
(`stats.held`). Die **Regeln der Ausleitung stehen im Profil** (`rules`), nicht im
Klassifikations-Plugin: leer = „-“+UN / NA / weglassen; Klasse ist Pflicht (sonst geht das
Produkt ohne Merkmale hinaus); Werte müssen passen (streng); **Vollständigkeit ≥ n %** je Produkt
(das rechnen die Empfänger — Datenpools, Grosshandel). Verstösse sperren den Export mit Liste
(`gate`); Ø Vollständigkeit über die klassifizierten Produkte steht im Status und im Job-Log.

**Was die Praxis prüft (aus Wissen, nicht gegen die Guideline belegt — nachlesen: ETIM-BMEcat-
Guideline 5.0, ETIM xChange):** genau eine Klasse je Produkt, Klasse in der Release
(`FEATURE_SYSTEM_NAME`), Merkmal gehört zur Klasse, EV-Wert zum Merkmal, Zahl mit Einheit des
Merkmals, Logical true/false, Range zwei Werte, jedes Merkmal einmal; keine Pflichtmerkmale in der
Klassifikation selbst — der Vollständigkeitsgrad ist die eigentliche Hürde. BMEcat-Basis
unabhängig von ETIM (Lieferantennummer eindeutig, GTIN, Bestelleinheit, Kurztext ≤ 80, Bilder)
ist noch nicht als Prüfung gebaut; ETIM xChange wäre eine zweite Vorlage auf demselben Baum.

**Prozess-Plugins und geteilter Code:** `plugins/table/transform.mjs` ist die eine
Umwandlungskette; `web/src/transform.js` reicht sie durch, Jobs importieren sie relativ
(`../table/transform.mjs`) — `plugins/` ist im Container ein Bind-Mount, `web/src` nicht.

## 30. Freigabesteuerung — Modellteil gebaut (Taloan, 22.09.2026: „ich möchte dass das Freigabe Monitoring heisst — oder besser noch Freigabesteuerung“)

Die Frage dahinter (Taloan): „wenn ich die Beschreibung ändere und die Redaktion hatte vorher
schon eine Freigabe — darf das überhaupt dann noch auf freigegeben stehen?“ Drei Hebel, die
man nicht verwechseln darf:

- **Stand** — was geht hinaus (der Wert selbst).
- **Freigabe** — darf es hinaus (Zustand am Knoten je Kanal).
- **Workflow** — wer muss noch hinsehen (Stufen und Übergänge).

Die Freigabesteuerung sagt nur das eine: **zählt diese Wertänderung als Eingriff, der Prüfung
und Freigabe berührt?** Was dann geschieht, sagt der Workflow — die beiden bleiben getrennt.

**Gestellt wird sie je Attributgruppe, überschrieben je Attribut** (Taloan: „Man sollte bei jeder
Attributgruppe einstellen können … und je Attribut überschreiben“):

| Stufe | Werte | Bedeutung |
|---|---|---|
| Gruppe | `auto` (leer) · `always` · `never` | automatisch = zählt, wenn die Gruppe mindestens ein Pflichtfeld hat |
| Attribut | leer · `always` · `never` | leer = wie die Gruppe; `auto` gibt es nur an der Gruppe |

Gebaut: `ReleaseWatch` (Konstanten) in `Types.cs`, Feld `releaseWatch` an
`AttributeGroupDefinition` und `AttributeDefinition`, `ModelCatalog.Watched(attribut)` als die
eine Auskunft (Attribut schlägt Gruppe, sonst Gruppe, sonst Pflichtfeld-Automatik), Prüfung der
Werte in `ModelApi`, Zeile „⚑ Freigabesteuerung“ in der Modellpflege an Gruppe und Attribut,
Kennzeichen ⚑/⚐ in den Listen, `ReleaseWatchTests`.

**Die Wirkung ist noch nicht gebaut.** Entschieden ist (Taloan, 22.09.): zählt die Änderung, wird
die Freigabe zurückgenommen und der Zustand fällt auf die Stufe vor der Freigabe zurück. Offen
bleiben die Quelle der Änderung (Importprofil gegen Mensch — je Profil einstellbar) und die
**Rollenregel** (Taloan): kein Zurückstufen, wenn die ändernde Rolle den Weg von der
Rückfallstufe bis zur Freigabe ohnehin allein gehen könnte — das Vier-Augen-Prinzip fällt dann
aus dem Graphen heraus, statt als zweite Regel danebenzustehen.

### Übersetzung — offene Frage, Praxis als Vorschlag

Taloan, 22.09.: „Wann gibt man eine Übersetzung in den Workflow und nach welcher Menge der
Änderungen? … Will ein französischer Übersetzer 3000 Übersetzungsaufträge kriegen mit jeweils
einem Wort?“ **Aus Erfahrung, nicht aus diesem Code belegt** (TMS-Welt: Trados, memoQ,
Smartling, Phrase):

1. **Die Quelle stuft die Zielsprache nie zurück.** Ändert sich der Mastertext, bekommt die
   Übersetzung einen eigenen Stand: *aktuell · veraltet · in Arbeit*. Die Freigabe der
   Zielsprache bleibt, was sie ist — die Veröffentlichung entscheidet je Kanal, ob eine
   veraltete Übersetzung mit hinausgeht, auf die Mastersprache zurückfällt oder sperrt.
2. **Gemessen wird am Text, nicht am Ereignis.** Vor dem Vergleich normalisieren (Leerraum,
   Anführungszeichen, Interpunktion); der Abstand entscheidet: unter der Bagatellgrenze nur
   „veraltet“ markieren ohne Auftrag, darüber Auftrag. Im TMS ist das der Fuzzy-Match: 100 %
   kein Auftrag, 75–99 % Anpassung, darunter Neuübersetzung.
3. **Der Redakteur hat ein Häkchen „unwesentliche Änderung“.** Jede Automatik liegt in beide
   Richtungen falsch; das Häkchen ist der wirksamste Hebel und kostet nichts.
4. **Gesammelt statt sofort.** Bedarf geht in eine Warteschlange je Sprache; ein Paket entsteht
   nach Zeit (täglich/wöchentlich), Menge (ab n Wörtern) oder Ereignis (Katalogschluss) — das
   ist genau ein Job im `tasker`, kein eigener Mechanismus.
5. **Nur übersetzungsrelevante Attribute** zählen (`perLocale`), und auch dort gilt die
   Freigabesteuerung — `never` an einem Attribut heisst auch: kein Übersetzungsbedarf.

Der Übersetzer bekommt zum Auftrag immer drei Dinge: alte Quelle, neue Quelle, bisherige
Übersetzung. Entschieden ist davon nichts — Taloans Wort fehlt.

### Die vier Blockaden aus der Praxis (Taloan, 22.09.2026)

Taloan: „Er speichert und speichert und speichert und irgendwann sagt er final … dann kann er
keine Version freigeben, bis die französische Übersetzung da ist … Fallbacksprachen sind auch
nicht die Lösung, man will nicht mitten in der französischen Webseite deutsche Texte …
viele Übersetzungen laufen heute mit KI und müssen nur noch von einem lokal Verantwortlichen
abgenommen werden.“ Was der Bestand dazu schon trägt — und wo die eine Lücke ist:

| Blockade | Antwort | Beleg |
|---|---|---|
| Der Redakteur speichert zehnmal, bis es „final“ ist | **Der Auslöser ist nie das Speichern, sondern ein Übergang.** Der Redakteur geht „final — zur Übersetzung“ oder „final — ohne Übersetzung“; das ist seine Entscheidung über die Relevanz, und sie ist modellierbar, ohne eine Zeile Code: zwei Übergänge aus demselben Zustand, Wirkung `translate:<sprache>` neben `release:` / `revoke:` | `WfTransition(… Effects …)`, `Types.cs:504`; Wirkungen heute `release:web`, `revoke:`, `status:` (`Workflows.cs:10`) |
| Version blockiert, weil Französisch zwei Wochen braucht | **Freigabe und Version gibt es schon je Sprache** — Deutsch geht hinaus, Französisch wartet. Blockiert wird nur, wer eine Version über alle Sprachen zieht | `Release(string Channel, string? Locale)` (`Tree.cs:9`, gesetzt in `:567`, gelesen in `ReleasedVia` `:168`); `VersionState.Channel` / `.Locale` (`Versions.cs`) |
| Fallback auf die Mastersprache will niemand | **Der Rückfall geht nicht auf Deutsch, sondern auf die letzte freigegebene französische Fassung.** Das kostet keinen zweiten Speicher: die Version ist ein Zeiger auf die Journalnummer, der alte französische Wert steht im Journal. Erst wenn es noch nie eine französische Fassung gab, muss der Kanal wählen: Mastersprache zeigen oder das Produkt in Französisch nicht zeigen | `VersionState.JournalNumber` (`Versions.cs`) |
| KI übersetzt sofort, lokal wird nur abgenommen | **Die KI ist ein Akteur mit eigener Rolle**, kein Sonderweg: sie schreibt den Wert, der Zustand heisst „maschinell übersetzt“, der lokal Verantwortliche geht den Übergang „abgenommen“. Die Rollenregel greift dann von allein — die KI-Rolle kann den Weg bis zur Freigabe nicht allein gehen, also bleibt das Vier-Augen-Prinzip stehen, ohne zweite Regel. Der „Auftrag“ ist dann ein Job im `tasker` statt ein Paket an die Agentur; die Warteschlange ist dieselbe | Benutzer und Rollen im Journal (`user:<key>`, `role:<key>`), Jobs mit eigenem Token (CLAUDE.md, `Auth.cs`) |

**Die Lücke:** der Workflow-Zustand hängt je Knoten und Workflow — ohne Achse (`NodeWorkflow`
in `Workflows.cs`, Schlüssel `_nodes[knoten][workflow]`). „Redaktion Französisch in Korrektur,
Deutsch freigegeben“ gibt es damit heute nicht. Zu bauen wäre: ein Workflow darf als *je
Sprache* gekennzeichnet sein, dann trägt `WorkflowStateSet` eine Sprache (leer = gilt für alle,
also bleibt jeder heutige Eintrag gültig). Das ist der eine Eingriff — Freigabe, Version und
Rollen können es schon. **Taloans Wort fehlt.**

### Der Übersetzungsspeicher, das Paket und die Rückkehr (Taloan, 22.09.2026)

Taloan: „Wenn der Redakteur jeden Tag eine neue Version raushaut, überschreibt die neue Version
die alte, und so sammelt sich ein Kontingent im Übersetzungsspeicher an … spätestens wenn der
Redakteur der Mastersprache eine Version macht oder nach einer vorgegebenen Zeit — bei den
meisten wöchentlich, bei anderen einmal nachts — wird daraus ein Übersetzungsauftrag …
und irgendwann kommt er zurück und man stellt fest, dass es schon wieder etliche Änderungen am
Original gibt.“

**1. Der Speicher ist keine zweite Datenhaltung, sondern eine Marke.** Je Knoten, Attribut und
Sprache steht im Journal, bis zu welcher Journalnummer übersetzt wurde. Offen ist alles, was
sich seither geändert hat — eine Abfrage, kein Behälter. Damit ist Taloans „die neue Version
überschreibt die alte“ geschenkt: verglichen wird immer *Marke gegen jetzt*, nie ein Stapel von
Änderungen. Zehnmal geändert ist ein Posten, nicht zehn. Kein Schreibpfad am Journal vorbei.

**2. Das Paket schnürt ein Job.** Zeitplan gibt es schon (`Schedule`, cron „m h dom mon dow“,
`Jobs.cs:42`) — wöchentlich, oder einmal nachts, je Projekt. Der zweite Auslöser ist der
Übergang „Version der Mastersprache“; derselbe Job, zwei Auslöser, nie zwei Mechanismen. Ein- und
Ausgang sind die Fächer des Jobs (`JobFiles`: in/, out/, done/, failed/), und der doppelte
Rücklauf fällt schon am Fingerabdruck auf (`JobFileConsumed` mit `Hash`, Status `duplicate`).

**3. Der Auftrag ist ein Zeiger plus Fingerabdrücke.** Im Journal: Sprache, Umfang,
Journalnummer — und je Wert der Hash des Quelltextes, der hinausging. Die Datei (XLIFF, CSV über
`table`) ist nur die Kopie für unterwegs, nicht die Wahrheit.

**4. Die Rückkehr — der Teil, an dem es in der Praxis scheitert.** Beim Rückimport wird je Wert
am Hash entschieden, nicht am Gefühl:

| Befund | Was geschieht |
|---|---|
| Quelle seit dem Auftrag unverändert | einspielen, Marke auf jetzt, fertig |
| Quelle ist weitergezogen | **die Übersetzung ist kein Abfall** — sie ist besser als die vorige. Einspielen, Marke auf die *Auftragsnummer* (nicht auf jetzt). Der Rückstand bleibt offen und geht als Differenz ins nächste Paket: die zweite Runde ist klein, meist ein Satz |
| Zielwert wurde inzwischen von Hand geändert | **nur hier** ein Mensch: Konflikt zeigen, beide Fassungen nebeneinander |

Nie: den Auftrag verwerfen, weil er „nicht mehr aktuell“ ist. Genau daraus entsteht das
Hamsterrad, das Taloan beschreibt — wer immer den ganzen Text neu übersetzen lässt, holt den
Rückstand nie ein; wer nur die Differenz nachbestellt, schon.

**Nebenbei fällt eine Zahl ab:** weil jeder Wert seinen Quell-Hash kennt, steht je Sprache der
Rückstand da („FR: 12 Werte“) — dieselbe Zahl, aus der das nächste Paket entsteht. Läuft die
Übersetzung über die KI, schrumpft die Runde auf Minuten und der ganze Fall „Quelle ist
weitergezogen“ bleibt nur für die Agenturstrecke übrig.

**Gebaut** (22.09.2026): der Eintrag für die Marke, das Abbild, der Auftrag, der Rücklauf mit den
drei Fällen, die Workflow-Achse — siehe die Tabelle unten.

### Gebaut am 22.09.2026 (Taloan: „ja, bau das“)

Vorweg eine Berichtigung: „gebaut ist nichts“ stimmte nicht — Einheiten, XLIFF hin und zurück, Gedächtnis, Wörterbuch und
die Jobs gab es seit dem 21.09. Gebaut wurde das, was gefehlt hat:

| Was | Wo |
|---|---|
| **Die Marke** je Knoten × Attribut × Zielsprache × Kanal × Zeile: gegen welche Quellfassung ist übersetzt (Fingerabdruck + Journalnummer) | `TranslationMarked`, Abbild `Translations` (`Journali.Core/Projections/Translations.cs`) |
| **Der Zustand kommt aus der Marke**, nicht aus „wer wurde zuletzt geschrieben“ — ein frisch eingespielter, aber überholter Zieltext ist ⟳, nicht ✓. Ohne Marke (Bestand) gilt weiter der Zeitvergleich | `TranslateApi.Collect` |
| **Das Paket** als Auftrag im Journal: Sprachrichtung, Umfang, Stand, je Einheit die Fingerabdrücke von Quelle **und** Ziel | `TranslationOrdered` / `TranslationReturned`, `POST /api/translate/order`, `GET /api/translate/orders` |
| **Zwei Auslöser, ein Weg**: der Job nach Zeitplan (`Schedule`, cron) und die Wirkung `translate:<sprache>` an einem Übergang („Version der Mastersprache“) rufen dasselbe | `plugins/xliff/job.mjs`, `Commands.OrderTranslation` |
| **Der Rücklauf** entscheidet je Einheit am Fingerabdruck: unverändert → fertig · weitergezogen → **eingespielt und bleibt offen** (`behind`), die Differenz geht ins nächste Paket · Ziel von Hand geändert → Konflikt, nicht überschrieben (`conflicts`, `force` überschreibt) | `TranslateApi.Import` |
| **Der Auftrag steht in der XLIFF-Datei** (`journali-order` am file-Element) und kommt mit ihr zurück | `WithOrder` / `OrderOf` |
| **Workflow je Sprache**: `perLocale` am Workflow, Sprache am `WorkflowStateSet` (leer = wie bisher, jeder alte Eintrag gilt weiter); die Wirkung eines Schritts trifft nur diese Sprache — Freigabe gibt es längst je Kanal **und** Sprache | `Workflows`, `Commands.WorkflowStep(… locale)`, `WorkflowLocales.vue`, Saatgut „Übersetzung“ steht auf `perLocale` |
| **Oberfläche**: Zeile „🗣 je Sprache“ am Knoten, Schalter in den Workflow-Einstellungen, 📦 Paket schnüren und der Abschnitt „Aufträge“ in ⇄ Übersetzung, Spalte „📦 draussen“ in der Übersicht | `NodeView.vue`, `WorkflowSettings.vue`, `plugins/xliff/entry.js` |

Geprüft: `TranslationOrderTests` (Zeiger und Rücklauf, überholt bleibt offen, Konflikt, zehnmal geändert = ein Posten,
Wirkung am Übergang, Auftrag in der Datei), `WorkflowLocaleTests` (je Sprache, ohne `perLocale` unverändert, Wirkung trifft
nur die Sprache), `web/test/ui-workflow.test.mjs` (eine Zeile je Sprache, Klick schickt die Sprache mit, gesperrte Schritte).

**Noch nicht gebaut** (Taloans Wort fehlt): die Bagatellgrenze (Normalisieren vor dem Vergleich, Abstand statt „ungleich“),
das Häkchen „unwesentliche Änderung“ am Wert, die Fallback-Regel je Kanal („letzte freigegebene Fassung der Zielsprache
ausliefern“) und die KI-Strecke als Abnahme-Workflow (die Übersetzung gibt es schon, der Zustand „maschinell übersetzt“
noch nicht).

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

## 31. MCP — der Assistent spricht mit dem PIM (Entwurf; Taloan, 22.09.2026: „warum können wir keinen RAG-Service anbieten? oder einen MCP-Serverdienst?“)

Der Export einer Wissensbasis (Plugin `rag`) liefert Dateien für fremde
Systeme. Das Gegenstück fehlt: ein Assistent, der **live** fragt statt eine
Kopie zu lesen. Genau das ist MCP (Model Context Protocol): der Assistent
bekommt keine Dateien, sondern **Werkzeuge**, und ruft sie auf, während er
antwortet.

**Warum das besser ist als der Export.** Immer aktuell — kein Lauf, kein
veralteter Bestand. Die Rechte gelten, weil jeder Aufruf mit dem Token eines
Benutzers kommt (`Auth.Needed` prüft wie bei jeder Anfrage). Und jede Antwort
kann mitliefern, woher sie stammt: Journalnummer, freigegebene Version,
Beleg am Wert — das ist der Unterschied zwischen „die KI behauptet" und „die
KI zitiert".

**Bauform.** Ein Prozess-Plugin `mcp` (`runs: process`), wie die Jobs: eigener
Prozess, spricht nur über `/api`, nie in den Serverprozess hinein. Start über
den Tasker oder direkt vom Assistenten (stdio). Zwei Betriebsarten:

- **stdio** — der Assistent startet den Prozess selbst (Claude Desktop, IDE).
  Zugang über `JOURNALI_TOKEN` (API-Token des Benutzers) und `JOURNALI`-URL.
- **HTTP/SSE** — ein laufender Dienst im Container für Assistenten, die nicht
  selbst starten können; dieselbe Tokenprüfung, ein Port mehr.

**Die Werkzeuge** (jedes eine dünne Schicht über einem vorhandenen Endpunkt):

| Werkzeug | was es tut | dahinter |
|---|---|---|
| `suche` | Knoten nach Text und Bedingungen (`status:`, `attr:`, `empty:`, `under:`) | `GET /api/tree` + Query-Sprache der Suche |
| `knoten` | ein Knoten mit Attributen je Sprache und Kanal, Herkunft geerbter Werte | `GET /api/nodes/{id}` |
| `tabelle` | ein Teilbaum als Tabelle (Spalten wählbar) — für „vergleiche die Varianten" | `GET /api/nodes/{id}/table` |
| `version` | freigegebene Version eines Produkts mit ihren Belegen | `GET /api/nodes/{id}/versions` |
| `verlauf` | wer hat wann welchen Wert gesetzt (mit Notiz und Stapel) | `GET /api/streams/{id}` |
| `modell` | Attribute, Gruppen, Sprachen, Kanäle, Status — damit der Assistent die Begriffe kennt | `GET /api/model` |
| `ausleitung` | was ein Publikationsbaum gerade ausleitet (Kanal, Markt, Freigabe) | `GET /api/pub/{id}/export` |

**Nur lesen — entschieden (Taloan, 22.09.2026: „MCP als readonly, sonst ist das
doch zu krass“).** Der Dienst schreibt nicht. Ein Assistent, der selbst Werte
setzt, erzeugt Einträge, die niemand angefordert hat; Vertrauen entsteht
zuerst am Lesen. Nachrüstbar bleibt es jederzeit, weil jeder Eintrag ohnehin
seinen Akteur trägt: Schreiben käme dann als eigene Werkzeuge
(`wert_setzen`, `klasse_zuweisen`) mit eigener Rolle, damit im Journal steht,
dass es die KI war — und es zählte als Tagesgeschäft.

**Zugang und Menge — entschieden (Taloan, 22.09.2026: „Admin kann Tokens
erzeugen und Rate Limits festlegen je Token“).** Der Assistent meldet sich mit
einem API-Token an, und dieses Token gehört nicht dem Anwender, sondern wird
vom Administrator ausgegeben — mit einer Grenze daran. Damit beantwortet sich
auch die Frage nach der Antwortgrösse: nicht der Dienst rät, wie viel gut
ist, sondern das Token sagt es.

Das ist mehr als MCP: Es gilt für **jedes** API-Token (Excel-Add-in,
OnlyOffice, Skripte). Heute legt jeder Benutzer seine Token selbst an
(`POST /api/auth/tokens`), und ein Token trägt nur `{ user, label, at }`
(`Auth.TokenRec`). Zu bauen wäre:

| Teil | was dazukommt |
|---|---|
| `TokenRec` | `+ maxPerMinute`, `+ maxPerDay`, `+ maxRows` (grösste Antwort), `+ scope` (nur lesen / auch schreiben), `+ expires` |
| Vergabe | ein Administrator legt Token für einen Benutzer an und setzt die Grenzen; der Anwender kann seine eigenen weiter anlegen, aber nur innerhalb der Grenzen seiner Rolle |
| Zählung | je Token ein Fenster im Arbeitsspeicher (Minute, Tag), Überschreitung → `429` mit der Zeit bis zur Freigabe; nichts davon ins Journal, es ist Betrieb |
| Anzeige | in den Einstellungen je Token: Grenze, Verbrauch heute, letzter Zugriff — und ein Knopf, der es sofort sperrt |

Damit ist die Antwortgrösse geregelt (`maxRows` je Token statt fester
Obergrenze im Dienst), der Missbrauch gedeckelt (ein Assistent in einer
Schleife kostet dann den Kunden nichts ausser einer Fehlermeldung), und der
Administrator sieht, wer wie viel zieht.

**Eigener Container — entschieden (Taloan, 22.09.2026: „MCP muss in einem
eigenen Container laufen, da eventuell mit DMZ und nach aussen hin offen“).**
Der Dienst ist das einzige Stück, das von aussen erreichbar sein soll; der
Server mit dem Journal bleibt innen. Daraus folgt die Bauform:

- **Eigenes Image, eigener Port.** Der MCP-Container spricht ausgehend mit
  journali (`JOURNALI=http://server:8080`) — nie umgekehrt. Die Firewall
  braucht nur eine Richtung; der Server muss von aussen gar nicht erreichbar
  sein.
- **Kein Zugang ausser HTTP.** Keine Datenbank, kein Medienspeicher, kein
  Datenverzeichnis — was der Dienst nicht hat, kann ihm niemand abnehmen.
- **Keine eigenen Rechte.** Der Container hat **kein** Dienstkonto. Der
  Assistent schickt das Token des Benutzers, der Dienst reicht es unverändert
  an `/api` weiter. Damit sieht ein Angreifer, der den Container übernimmt,
  genau das, was das jeweils mitgebrachte Token ohnehin sehen dürfte — und
  nach dem Sperren des Tokens nichts mehr.
- **Nichts liegen lassen.** Keine Token auf Platte, Protokoll ohne Werte (nur
  Werkzeug, Dauer, Ergebnisgrösse).
- **Cache: nur was weder Rechte noch Aktualität berührt** (Taloan, 22.09.2026:
  „kein Cache?“). Gegen einen Datencache sprechen drei Dinge: zwei Anwender
  mit verschiedenen Rollen sehen verschiedene Daten — ein gemeinsamer Cache
  leckt; „immer aktuell" ist das Hauptargument gegenüber dem Export und wäre
  damit dahin; und in der DMZ lägen Produktdaten auf einem Rechner, der von
  aussen erreichbar ist. Dafür spricht wenig: ein Assistent stellt je Antwort
  eine Handvoll Anfragen, und die Strecke nach innen kostet Millisekunden.
  Erlaubt ist deshalb nur:
  - **das Modell** (Attribute, Gruppen, Sprachen, Kanäle, Status) — für alle
    gleich, keine Kundendaten; Schlüssel ist die Journalnummer: solange
    `head` gleich bleibt, darf es stehen;
  - **innerhalb einer Anfrage** — braucht ein Werkzeug denselben Knoten
    zweimal, ist das kein Cache, sondern Sparsamkeit.

  Nie zwischengespeichert werden Knotenwerte, Tabellen, Versionen und
  Suchergebnisse.
- **Transport HTTP/SSE**, TLS am Reverse Proxy davor. Die Mengenbegrenzung
  macht der Server am Token (siehe oben); der Dienst zählt nur gleichzeitige
  Verbindungen, damit ein Assistent ihn nicht allein belegt.

**Offen bleibt** nur, ob später eine bequemere Anmeldung als „Token kopieren"
kommt (OAuth).

**Der Vektorindex** (semantische Suche über `pgvector`) ist der zweite Schritt
und nur dort nötig, wo jemand unscharf sucht („welche Klebstoffe halten
Hitze aus?"). Für „hol mir Produkt X" ist MCP genauer, weil es exakt
antwortet statt ähnlich. Beim Nachziehen hilft das Journal: der Index merkt
sich die Journalnummer und bettet nur ein, was seitdem geschrieben wurde.

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

- ~~Kategorie als zweiter Baum?~~ Entschieden, siehe 4: keine Kategorien;
  Symlink für Knoten in mehreren Ästen, Kanalbäume als eigene logische Bäume.
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

### 17. Name im Baum — entschieden (Taloan, 17.09.2026)

Der Baum ist zuerst ein Verzeichnisbaum ohne Dateien: jeder Knoten kann von
Hand benannt werden (`NodeNamed`, einsprachig, jede Rolle; Rechtsklick →
Umbenennen). Für die Masse — hundert Varianten unter einem Produkt — gibt es
die Automatik: **das ★** an einem Attribut im rechten Feld (`LabelAttributeSet`).
Es gilt ab diesem Knoten nach unten und darf in jedem Zweig darunter auf ein
anderes Attribut gesetzt werden, das dort über eine Gruppe am Pfad gilt.

Reihenfolge (`NodeRow.LabelOf`):

1. eigener Name;
2. die ★ am Pfad, das nächste zuerst — ein ★ zählt nur dort, wo sein Attribut
   an der Rolle gilt (Gruppe aktiv, `levels`) und einen Wert hat (de, dann die
   anderen Sprachen, dann ohne Sprache; geerbt zählt; eine Werteliste zeigt
   ihr Label); sonst das nächste ★ weiter oben. So benennt ein ★ auf SKU an
   einer Gruppe die Varianten darunter, während Produkte und Gruppen beim ★
   auf `name` von weiter oben bleiben (Taloan, 17.09.2026: „bei 4 unsicher" —
   so entschieden);
3. Variante: SKU, sonst die Achsenwerte;
4. die interne Id — der Mindest-Fallback, den es immer gibt.

Nicht gewählt: Name je Attributgruppe (mehrere Gruppen am Knoten → Kollision,
welche zählt?), Name je Knotentyp im Modell (`TreeLabelDefined`, Altlast: ein
Attribut, das jemand aus dem Modell nimmt, liesse den Baum namenlos), Name
aus dem Attribut `name` fest im Code (dasselbe Problem; wer sein Attribut
`shortdesc` nennt, hätte keinen Baum).

Sperre: ein Attribut, das irgendwo das ★ trägt, lässt sich nicht zurückziehen
— erst das ★ umsetzen (`DELETE /api/model/attributes/{key}` nennt den Knoten).

Mehrsprachig ist der eigene Name nicht (Vorbild Pimcore `key`; Akeneo,
Ergonode und OpenPIM führen Kategorienamen je Sprache). Ob der Baum der
Oberflächensprache folgen soll, ist offen — Taloan: „vielleicht gerade das,
vielleicht gerade nicht". Der automatische Name nimmt heute fest `de` zuerst.

Saatgut: das ★ steht an `g-mastertree` auf `name`; ein leeres Journal benennt
damit alles darunter nach seinem Namen, bis jemand es umsetzt.

### 18. Relationen — gebaut (Taloan, 17.09.2026: „bau mal gleich")

Andere PIMs haben Relationen und attributierte Relationen; die Solr-Quelle
zeigt es: 109 376 `complex_relation`-Dokumente (Konfigurator: „in diesen
ThinkCentre passt dieses RAM-Modul, Menge 1, Slot 1") neben einfachen
`*_doc_rel`-Feldern (Zubehör, Bestandteile, Bilder).

Ein Mechanismus für beides: **eine Relation ist ein Ding mit eigenem
Strom** `r-…`, wie ein Knoten.

- `RelationCreated {type, from, to}` — der Typ kommt aus dem Modell
  (`relation:<key>`: Bezeichnung hin und zurück, erlaubte Rollen je Ende,
  Attributgruppe der Werte). Je Typ nur einmal zwischen denselben Knoten,
  nie auf sich selbst.
- Werte an der Relation sind dieselben `AttributeSet`-Einträge wie am
  Knoten — erlaubt sind die Attribute der Gruppe des Relationstyps
  (Saatgut: `component` mit `relation_component` → `quantity`). Eine
  einfache Relation ist dieselbe Sache ohne Gruppe.
- `RelationRetired` nimmt sie aus dem Abbild; `ExternalLinked` trägt die
  Kennung der Quelle (Import: Update statt Neuanlage).
- Abbild `Relations`: je Knoten ausgehend und eingehend. Ein
  zurückgezogener Knoten lässt seine Relationen stehen; sie zeigen ins Leere
  (`other.missing`), bis jemand sie zurückzieht — wie verwaiste Werte.
- Im Knoten: Abschnitt „⇄ Relationen" je Typ, → ausgehend mit den Werten
  als Zellen, ← eingehend mit der umgekehrten Bezeichnung; neue Relation
  über Typ + Suche nach dem Ziel (Name, SKU, Id). Modell → Relationen
  pflegt die Typen.

Offen: Reihenfolge der Relationen (heute nach Eintrag), Relationen in der
Suche und Vollständigkeit, Medien (eigene Dinge oder Relationen zu
Medienknoten), und der Import der Solr-Relationen (`*_doc_rel` am Knoten,
`complex_relation` als attributierte Kante — beide Enden müssen importiert
sein; mit 109 k Kanten ein eigener Lauf).

### 19. Plugins — gebaut (Taloan, 17.09.2026: „echte Verwaltung", „jetzt die Plugin-Verwaltung bauen")

Taloans Bild: Plugins werden installiert, aktiviert, gelöscht, haben eine
Versionsnummer; es werden viele. Genannt: Datenqualität (dpp, ppwr), Export
(BMEcat, Excel, JSON), Benutzerwerkzeuge (Datenblatt als PDF/Excel,
Massenbearbeitung mit Excel-Funktionen, OCR), Import (ixp, solr).

Vorschlag, der zum Journal passt:

- **Ein Plugin ist ein Verzeichnis** `plugins/<key>/` mit `plugin.json`
  (`key`, `version`, `label`, `kind`: import | export | quality | tool,
  `runs`: browser | process, `entry`, `needs`: Endpunkte/Rechte) und seinem
  Code. Browser-Plugins sind ein ES-Modul, das die Oberfläche lädt und das
  eine Ansicht oder eine Aktion am Knoten beisteuert; Prozess-Plugins sind
  ein Skript/Programm, das der Server als Kindprozess startet und das nur
  über `/api` redet. **Kein Plugin läuft im Serverprozess** — der bleibt
  der eine Schreibpfad.
- **Installiert / aktiv / Version stehen im Journal**: Strom
  `plugin:<key>`, `PluginInstalled {key, version, manifest}`,
  `PluginEnabled` / `PluginDisabled`, `PluginRemoved`. Wer welches Werkzeug
  wann mit welcher Fassung benutzt hat, ist damit nachvollziehbar — und die
  Stapel eines Plugins tragen seinen Schlüssel als Urheber (`X-Actor`
  `taloan via solr@1.2`).
- **Verwaltung** in der Oberfläche unter ⚙ → Plugins: Liste mit Version,
  Stand, Schalter; „installieren" nimmt ein Verzeichnis/Archiv entgegen und
  legt es nach `plugins/`; die Oberfläche lädt aktive Browser-Plugins beim
  Start, Prozess-Plugins bekommen einen Knopf, der `POST /api/plugins/<key>/run`
  auslöst (Server startet den Prozess, streamt das Protokoll).
- **Beitragspunkte**: Ansicht (eigener Reiter in der Leiste), Aktion am
  Knoten (Kontextmenü, mit Auswahl mehrerer), Aktion am Teilbaum, Prüfer
  (liefert Befunde je Knoten → Abschnitt „Qualität" im Knoten),
  Exporter (liefert eine Datei).

Gebaut: `plugins/<key>/plugin.json` (`key`, `version`, `label{}`,
`description{}`, `kind`, `runs`, `entry` für Browser-Module, `process`
{command, args mit `{param}` und `{flag?--opt}`, params} für Prozesse,
`builtin` für die eingebauten Ansichten, `autoInstall`); Abbild `Plugins`
(`PluginInstalled/Enabled/Disabled/Removed`); ⌁ Plugins in der Leiste:
Liste mit Stand und Fassung (↑ wenn die Platte neuer ist), installieren,
ein/aus, aktualisieren, entfernen, Prozess starten mit Parametern und
Ausgabe. Browser-Plugins: `default export { views: [{path, label, icon,
mount(el, ctx)}], nodeActions: [{label, icon, run(nodeId, ctx)}] }` —
Ansichten erscheinen in der Leiste, Aktionen im Kontextmenü des Baums.
Der Solr-Import ist zugleich Prozess-Plugin (`solr_import.py`).

**Basis-Plugins (Taloan, 19.09.2026: „einerseits mit einer eigenen Basisfunktion
ausgestattet und gleichzeitig der Container für Ergänzungs-Plugins“).** Der
Rahmen im Image ist klein (Journal, Baum, Modell, Medien, Verwaltung, Dienste);
alles, was man häufiger erweitert oder korrigiert, liegt in `plugins/` und wird im
Container per Bind-Mount ausgetauscht — ohne neues Image. Ein Basis-Plugin nennt
im Manifest `base: [Gruppen]` und besitzt damit die Gruppe(n) der Leiste: `table`
(⇩ Import → Tabelle, ⇪ Export → Tabelle, Excel am Knoten), `da` (✓ Datenanalyse — Grundfunktion Datenqualität),
`tasker` (⏱ Jobs). Ergänzungen nennen `requires: ["table"]` usw.: Einschalten
braucht die Basis (Server lehnt sonst ab), Ausschalten einer Basis fragt nach und
nimmt die Ergänzungen mit (in der Oberfläche „◐ an, Basis aus“). Beim Start werden
Basis-Plugins zuerst installiert. Plugins mit Vue-Ansichten (table, ixp, solr)
haben `src/*.vue` und ein gebautes `entry.js` im Repo (`web/build-plugins.mjs`);
sie importieren `vue`, `vue-router` und `journali` (api, store, tree, mapper,
dialog, treePicker, Splitter, ImportHead, TreePicker …) und teilen dieselben
Instanzen mit der Oberfläche (`web/src/host.js`, `window.journali`). Der
PluginHost zeichnet eine `component` direkt, `mount(el, ctx)` bleibt für
DOM-Plugins. `ctx.use('table').tableExport` gibt einem Plugin das Modul eines
anderen. Alte Pfade (`/import/table`, `/export/table`, `/import/ixp`,
`/import/solr`, `/analysis/dq`) leiten auf `/p/<key>/…` weiter.

**Ausbau (Taloan, 17.09.2026: „Importe, Massenbearbeitung, Datenblatt,
Datenmapper, Datenqualität — als Plugins, einzeln ausliefer- und auslagerbar;
je Import-Plugin mehrere Konfigurationen"):**

- **Plugin-Daten im Journal**: `PluginDataSet {name, value}` auf
  `plugin:<key>` — benannte JSON-Datensätze (Vorlagen, Profile, Regeln),
  `GET/PUT/DELETE /api/plugins/{key}/data/{name}`; in der Oberfläche
  `ctx.data.get/set/del/list`. Damit gilt eine Konfiguration für alle,
  nicht nur für einen Browser, und jede Änderung ist nachvollziehbar.
- **Profile je Import-Plugin** (`ProfileBar`): `config:<name>` (Ansicht:
  Quelle, Ziel, Zuordnung …) und `run:<name>` (Parameter eines Prozesses)
  — an IXP, Solr, Tabelle und den Prozess-Parametern. Kein Token im Profil.
- **Weitere Beitragspunkte**: `importers` (Quelle für ⇩ Import → Tabelle:
  `{key, label, accept, parse(file, ctx) → {columns, rows | sheets}}`) und
  `checks` (Prüfregel: `run({row, values, columns, model, locale}) →
  [{severity, attribute, message}]`). `ctx` bekommt `mapper` (der
  Datenmapper), `batch`, `checks`, `go`.
- **Datenmapper** (`web/src/mapper.js`, im Kern, weil jeder Import ihn
  braucht): Spalte → Attribut über Schlüssel, Label, Synonyme
  (Artikelnummer → sku …), Sprache im Spaltennamen (`name_en`), Ähnlichkeit;
  Typ aus den Werten; Werte normalisiert (Dezimalkomma, ja/nein, Datum,
  Listenwert über Label); vorhandene Knoten über Id, SKU, externe Kennung →
  nur Änderungen; Plan vor dem Schreiben.
- **Mitgelieferte Plugins**: `csv`, `json`, `xlsx` (SheetJS, Apache-2.0)
  als Importer; `datasheet` (Vorlagen mit Platzhaltern, Designer, Blatt
  im Kontextmenü); `dq` (Regeln, Befunde je Teilbaum, Sprung zum Knoten; seit 19.09. Basis-Plugin `da`).
- **Im Kern statt Plugin**, weil es der Pflegeweg selbst ist:
  Massenbearbeitung `/table/{id}` (Excel-artig, Einfügen aus Excel, ein
  Stapel) über `GET /api/nodes/{id}/table` — den nutzen auch dq und Export.
- **Keine Kundendaten im Repo**: Vorgaben in Manifesten und Ansichten sind
  leer; Adressen und Wurzeln gehören in ein Profil (Journal des Kunden).

Offen: Verpackung als Archiv (heute: Verzeichnis im Repo), Prozess-Plugins
setzen Python voraus (im Container nicht dabei — `python:3` ins Image oder
das Skript als Programm), Befunde der Qualitätsprüfer dauerhaft (heute:
Liste im Browser, CSV), Export-Plugins (BMEcat, Excel, JSON) über
`/api/nodes/{id}/table`, Datenblatt als PDF-Stapel.

### 20. Medien — gebaut (Taloan, 17.09.2026: „ausserhalb", „fang mit den Medien an")

**Vererbung (Taloan, 18.09.2026 — entschieden):** ein Medium am Knoten
bekommt an seiner Zuordnung den Schalter `inherit` („an Subitems
vererben“, Gruppe `relation_media`). Dann gilt es an allen Knoten
darunter — als *geerbtes* Medium (gestrichelte Kachel, kursiv, mit
Herkunft), eine Ableitung wie bei Attributwerten, nichts wird kopiert.
Eigene und geerbte Medien bestehen nebeneinander. **Ein geerbtes Medium
lässt sich an keiner Ebene entfernen, nur unterbinden:** ⛔ am
Knoten legt eine Zuordnung zum selben Medium mit `stop=true` an — damit ist
es dort und an allem darunter weg; den Stopp lösen (×) bringt es zurück.
**Bedeutung (Taloan: „Verwendung und Vererbung unterbunden“):** an dieser Ebene steht das Medium *nicht
zur Verfügung* — auch nicht für Exporte, Datenblätter, Suche (`media:`).
Ein Stopp ist keine Zuordnung, nur eine Sperre; wer Medien eines Knotens
liest, lässt Zuordnungen mit `stop=true` aus.
Der Server liefert `inherited` in `GET /api/nodes/{id}/relations`. Modell
„Kopien je Subitem“ wurde verworfen (Kaskaden beim Aufbrechen). Der
IXP-Import nutzt das: hat ein Subitem dasselbe Bild wie sein Elternteil,
wird es dort vererbt und am Subitem nicht eigens zugeordnet.

**Ordner (Taloan, 21.09.2026: „Medienorga: sortieren, gruppieren — Strukturbaum, um Medien dort zu organisieren, wie ein
interner Dateimanager“):** die Bibliothek hat einen eigenen Ordnerbaum (Strom `mf-…`, `MediaFolderCreated/Renamed/Moved/
Retired`), ein Medium liegt in höchstens einem Ordner (`MediaFiled` am Medium, null = ohne Ordner). Die Ordner sind
reine Organisation — nichts über Verwendung (das sind die Relationen) oder Datei (Store) — und gehen nie in die Ausleitung.
Regeln: gleicher Name je Ebene nur einmal, nicht in sich selbst verschieben, löschen nur leer (kein stilles Aufräumen —
jede Ablage ist ein Eintrag). ▨ Medien: links die Ordner (＋ ✎ 🗑 an der Zeile, Ordner ziehen = verschieben, „mit
Unterordnern“), Mitte Kacheln mit Sortierung (zuletzt geändert, Name, Datum, Größe, Verwendung, ↑↓) und Gruppierung
(Art, Dateityp, Monat, verwendet, Ordner), Mehrfachauswahl (Strg/Umschalt-Klick, Strg+A, Esc), Kacheln auf einen Ordner
oder „⌂ ohne Ordner“ ziehen, „📁 verschieben …“ für die Auswahl, Hochladen landet im gezeigten Ordner. Am Knoten: „▨ aus der
Bibliothek …“ (Abschnitt Medien) öffnet dasselbe Bild als Fenster — Ordner, Suche, Mehrfachauswahl, Relationstyp
(automatisch: Bild → `image`, sonst `document`), was schon hängt ist ausgegraut. Suche: `folder:<Name|Pfad|Id>` (samt Unterordnern), `folder:none`.

Taloan: Binärdaten nicht in die Datenbank — später skalieren, woanders
speichern. Einverstanden; das Journal bleibt schlank.

- **Die Datei liegt ausserhalb**, der Ort ist ein Treiber (Taloan, 19.09.2026:
  „Datenbank auf Azure, Assets im günstigeren Object Storage“): `postgres`
  (Vorgabe, Tabelle `media_blob` neben dem Journal — ein Paket ist lauffähig),
  Verzeichnis, `s3://` (Garage/MinIO/AWS/R2, ohne SDK); ein Journal, ein
  Speicher (eine „Ursprung“-Brücke für Zweitinstanzen war gebaut und wieder
  verworfen: verwirrend). Dieselbe Schnittstelle
  `IMediaStore` (put, open, exists, keys); Wechsel = Kopierlauf nach Hash,
  Ids und Journal bleiben. Vorschauen rechnet der Browser (`sha.thumb`).
- **Im Journal steht nur das Ding**: Strom `m-…`, `MediaCreated {sha256,
  bytes, mime, name}` — die Datei ist über ihren Hash adressiert (gleiche
  Datei zweimal = ein Medium), unveränderlich; ein neues Bild ist ein neues
  Medium. Dazu `AttributeSet` für Titel, Alt-Text, Rechte, Quelle (Gruppe
  `media`, sprachabhängig).
- **Zuordnung zum Knoten ist eine Relation** (18): Typ `image` (Bild),
  `document` (Datenblatt) … von Knoten zu Medium, mit Werten an der Kante:
  Reihenfolge, Rolle (Hauptbild, Galerie), Kanal. Der Solr-Import hat dafür
  schon die Felder (`images` als `multi_image_rel`, `preview_image`).
- **Ausliefern**: `GET /api/media/{id}` (Original) und
  `/api/media/{id}/{preset}` (Vorschau; gerechnet und im Store abgelegt).
  Der Server berührt Bytes nur beim Hochladen und Ausliefern; nichts davon
  im Journal.

Gebaut: `MediaCreated`/`MediaRetired`, Abbild `Media`, `FileMediaStore`
(`JOURNALI_MEDIA`), `/api/media…`; Saatgut Gruppe `media` (`alt_text`,
`copyright`), Gruppe `relation_media` (`position`, `usage`), Relationstypen
`image` und `document` mit Ziel-Rolle `media`. Oberfläche: 🖼 Medien
(Bibliothek: Kacheln, Suche, Hochladen per Knopf oder Ablegen, Werte) und
im Knoten der Abschnitt „🖼 Medien" (Kacheln mit Werten an der Kante,
Ablegen lädt hoch und verknüpft, „aus Medien wählen").

**Vorschau-Presets — gebaut 21.09.2026** (Taloan: „in den Einstellungen Basics definieren, welche Ableitungen beim Bilder-Import
automatisch berechnet werden, in welchen Größen … 200-MB-TIFFs aus der Konstruktion, davon 20 in ein Dokument, für 1000
Artikel live umrechnen — nee, das muss alles bereitliegen“): Presets im Journal (`media-preset:<key>`,
`MediaPresetDefined`: Kante B × H eingepasst, Format webp/jpeg/png/avif, Qualität, auto), Saatgut `thumb` 256, `web` 1200,
`print` 3000 jpeg. Gerechnet wird nie im Server: das Prozess-Plugin `derive` (Node + sharp/libvips, liest TIFF) holt
`GET /api/media/pending`, rechnet, legt per `PUT /api/media/{id}/derived/{preset}` ab (Store `sha.<preset>`, Beleg
`MediaDerived` mit Fingerabdruck des Presets — geändertes Preset = neu rechnen); der Server stösst den Job nach jedem
Hochladen/Holen an und legt ihn an, wenn er fehlt. Ausliefern `GET /api/media/{id}/{preset}` (404 = liegt noch nicht vor).
Einstellungen → Storage: Tabelle der Presets mit Stand „gerechnet / Bilder“, „▶ jetzt rechnen“.

Vorher offen: Vorschau-Presets (heute liefert der Server das Original, der Browser
skaliert), Medienimport aus der Quelle (Solr: `images` als
`multi_image_rel`, Pfade unter `suppliers/…` — braucht einen Basis-URL),
Medien im Baum (eigener Ast) oder nur am Knoten.
