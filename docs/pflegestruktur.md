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
weiter je Sprache. Ohne Sprachachse ist `*` die eine Zelle; der Kanal
fällt zurück (`de` = alle Kanäle, `de/print` überschreibt).

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
wo aktiv. Ein Knoten kann gesperrte Gruppen ausblenden („nur bearbeitbare").
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
auf der rossibox braucht es HTTPS.

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
Knoten Sicht je Knotentyp, ☰ flach / ⧉ Reiter, ✎ nur bearbeitbare.

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
4. die interne Id — der Mindest-Rückfall, den es immer gibt.

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
`ixp` und `solr` sind eingebaut (builtin) und werden beim Start installiert;
der Solr-Import ist zugleich Prozess-Plugin (`solr_import.py`).

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
  im Kontextmenü); `dq` (Regeln, Funde je Teilbaum, Sprung zum Knoten).
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

Taloan: Binärdaten nicht in die Datenbank — später skalieren, woanders
speichern. Einverstanden; das Journal bleibt schlank.

- **Die Datei liegt ausserhalb**, der Ort ist austauschbar: erst ein
  Verzeichnis (`JOURNALI_MEDIA=…`, Unterordner nach Hash), später S3/MinIO
  — dieselbe Schnittstelle `IMediaStore` (put, get, exists, url).
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

Offen: Vorschau-Presets (heute liefert der Server das Original, der Browser
skaliert), Medienimport aus der Quelle (Solr: `images` als
`multi_image_rel`, Pfade unter `suppliers/…` — braucht einen Basis-URL),
Medien im Baum (eigener Ast) oder nur am Knoten.
