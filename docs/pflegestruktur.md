# Pflegestruktur — Entwurf

Stand 16.09.2026, **Vorschlag; entschieden ist, was so markiert ist.**
Anlass: das Beispielprodukt (Smartphone) zeigt, dass vier Attribute mit
Sprache/Kanal nicht reichen. Hier steht, woraus das Modell besteht, wie das
Beispiel darauf abgebildet wird, und welche Eintragstypen das braucht. Erst
wenn das steht, wird gebaut.

**Entschieden:**

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
**`*` bei Sprachachse** ist der **sprachneutrale
Grundtext** — wie die 35-Zeichen-Kurzbezeichnung aus ERP, während `de` der
ausgeschriebene Titel ist. Die Zelle ist änderbar; solange sie leer ist,
zeigt sie gedämpft den Master mit „◌ de". Kette je Sprache: eigener Wert →
Master → `*` → dasselbe bei den Vorfahren (wenn vererbbar). Drei Zustände
sichtbar: eigener Wert · ◌ aus dem Master (nicht übersetzt) · ⟳ zu
überarbeiten (übersetzt, aber der Master ist neuer). Leer ist eine Zelle
nur, wenn auch Master und `*` leer sind. Die Vollständigkeit für `en` zählt
weiter je Sprache. Ohne Sprachachse ist `*` die eine Zelle.
**Kanäle genauso**: Sprachen und Kanäle sind eine Matrix
mit je einem Stern. Es gibt eine Mastersprache und einen **Masterkanal**; der
Master bekommt die Werte des Sterns und kann sie überschreiben; abgeleitete
Sprachen bzw. Kanäle beziehen ihren Wert aus dem Master. Kette je Achse:
eigener Wert → Fallback → Master → `*`, der Kanal fällt vor der Sprache
(`de/print` → `de/web` → `de` → … → `*`). **Fallback**:
eine Sprache oder ein Kanal kann eine andere Ausprägung nennen, die vor dem
Master gilt — `fr-ch` → `fr-fr`, `shop_ch` → `shop_de`. Beim Kanal gilt der
Fallback auch für die Freigaben: das Sortiment von fr-ch ist das von fr-fr,
solange fr-ch nichts Eigenes sagt. Die Vollständigkeit zählt ohne Master.

**Status ist Vokabular**: der Status eines Produkts oder
einer Variante ist der Lebenszyklus am Markt (Entwurf, aktiv, ausgelaufen —
oder Überprüfung, Freigabe, Verkauf DE, Verkauf weltweit), nicht die
Redaktion (das ist der Workflow). Die Status stehen im Modell unter Basics:
frei benennbar, Name je eingerichteter Sprache, Symbol, Farbe, Reihenfolge.
`draft` ist der Startstatus neuer Knoten und bleibt. Ein Workflow kann einen
Status als Wirkung setzen (`status:<key>`); der Import bildet einen
Fremdstatus (Materialstatus des ERP 300 → Überprüfung, 501 → Verkauf weltweit)
im Ziel „Status“ über eine Wertetabelle auf einen Schlüssel ab — die
Tabelle ist eine Umwandlung der Spalte und damit Teil des Profils.

**Ausleitung:** ein Publikationsbaum nennt
Kanal und optional Markt. Drin ist ein Produkt, wenn eine Variante für den
Kanal freigegeben ist (Kanal-Fallback zählt) und der Markt des Baums in den
Verkaufsländern (`markets`, vererbbar, leer = überall) steht — oder in der
Fallback-Kette des Markts (Liste `market`, Spalte `fallback`). Regel und
Gründe: `docs/eintraege.md` → Ausleitung, `Publication.cs`.

### 2. Werteliste (`list:<key>`) — Einträge mit eigenen Spalten

> Der Sinn: bei Farbe nicht „rot" als Text, sondern ein Eintrag aus der
> Liste. Erweitere ich den Eintrag um ein Feld (RAL), ist das über den
> Verweis schon da.

Eine Liste hat **Spalten** (`ListDefinition.columns`, z. B. `ral`, `hex`),
jeder Eintrag füllt sie in `extra`. Saatgut: `color` mit 20 Farben de/en
und RAL-Classic-Nummer. Offen: der Durchgriff im Produkt (Farbe → RAL als
abgeleitetes Feld für Export und Anzeige).

Marke, Farbe, Betriebssystem, Relationstyp, Medienrolle: ein Schlüssel je
Wert, Label je Sprache, optional Zusatzfelder (Farbe: Hexcode). Eine
Werteliste ist ein Strom, jeder Wert ein Eintrag `ListValueDefined`.

### 3. ~~Familie~~ → Attributgruppen am Baum (entschieden)

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

### 4. Kategorie — entschieden: weggelassen

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

**Entscheidung (21.09.2026):** Die SKU ist ein Attribut wie jedes
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

**Entschieden (28.09.2026): Sätze, die man je Produkt auswählt, sind Listenwerte — kein zweites Wörterbuch.** Der
Anlass ist der Abschnitt „Funkentstörung“ eines Datenblatts — acht Punkte wie „Netzleitung und Lampenleitung nicht
kreuzen“. Das nächste Datenblatt hat denselben Abschnitt, aber „… bitte nicht kreuzen“: derselbe Sachverhalt, frei
getextet, weil die Redaktion nicht mehr weiss, wie sie es beim anderen Produkt formuliert hat. Datengetrieben heisst:
**der Satz steht einmal da**, einmal übersetzt, und jedes Produkt **verweist** auf ihn.

Die Trennung, die dabei gilt: das **Wörterbuch** (`Terms`) ist die Übersetzungsschicht — Glossar und Gedächtnis
für Systemtexte, Attributnamen, Fachwörter; es wird nicht am Produkt ausgewählt. Die **Werteliste** ist die Auswahl am
Produkt, und sie hat schon alles, was ein „Satz mit Gruppe“ braucht: die Liste ist die Gruppe, jeder Wert hat einen
Schlüssel und einen Text je Sprache (`ListValueDefinition(Value, Labels)`), das Attribut ist `enum` mehrwertig, der
Server prüft gegen die Liste, Ausleitung, Formel und Datenblatt lösen den Schlüssel in der Sprache auf. Ein Attribut
`terms` hätte dasselbe noch einmal gebaut. Gebaut ist darum nur, was fehlte (34 L): die Punkte eines Abschnitts als
Werte der Liste gleichen Namens, je Satz **Best Guess** gegen die vorhandenen Werte — gleich, normalisiert gleich,
oder ähnlich ab der Schwelle des Mappers (0,72), Ähnlichkeit aber nur für Sätze, nie für Codes („EN 61347-2-12“ und
„EN 61347-2-13“ sind sich ähnlich und verschieden) —, was nicht trifft, kommt neu in die Liste (Schlüssel aus dem
Text), solange sie nicht geschlossen ist.

Offen und die eigentliche Lücke: **⇄ Übersetzung kennt die Texte der Wertelisten nicht** — ein Satz, der einmal
gepflegt ist, muss dort einmal übersetzt werden können wie ein Attributwert (XLIFF hin und zurück, DeepL, KI, das
Gedächtnis). Bis dahin stehen die Übersetzungen der Listenwerte im Modell (Wertelisten), von Hand.

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

**Präfix je Quellsystem**: ein Import legt neue
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

**Gebaut (17.09.2026):** Cursor wie in Excel
(Pfeile, Shift+Pfeil Bereich, Enter speichert und springt nach unten, Tab nach
rechts, Tippen überschreibt, F2), Strg+D runterziehen, Strg+Shift+D Reihe
fortsetzen (Zahlen, Art-001), Strg+H Suchen & Ersetzen (Bereich/Tabelle,
Gross/Klein, ganze Zelle), Entf leert, Strg+C/V mit Excel. Kein Browser-Limit:
der Engpass war das fehlende Cursor-Modell, nicht der Client.

**Excel-Add-in** (Plugin `exceladdin`, Office.js, 17.09.2026): Aufgabenbereich in
Excel, Knoten suchen, Tabelle ins Blatt laden, in Excel pflegen, „Geändertes
speichern" schreibt nur die Differenz zum Schnappschuss als einen Stapel.
Manifest unter `/plugins/exceladdin/manifest.xml` (Origin vom Server eingesetzt);
auf einem Server im Netz braucht es HTTPS. **OnlyOffice-Plugin** (`plugins/onlyoffice`): gleiche Bedienung als Seitenleiste in
OnlyOffice Tabellen, Installation über den Plugin-Manager mit
`/plugins/ooaddin/package.plugin` (ZIP vom Server), Schnappschuss im
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

die Name für das, was ein anderes PIM objectbricks / fieldcollections / table
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

**Berechnete Spalten** (30.09.2026): eine Spalte vom Typ `formula` oder `template` zeigt in
jeder Zeile ein Ergebnis und ist nicht zu bearbeiten. Das Skript steht — wie bei jedem
Formel-Attribut — als Wert der Spalte am Knoten (ƒ in der Spaltenüberschrift öffnet es) und
rechnet für jede Zeile: `$spalte` meint den Wert dieser Zeile, jedes andere `$schlüssel`
den Wert am Knoten. Eine berechnete Spalte darf eine andere der Zeile lesen. Fehlt ein Wert,
ist das Ergebnis leer (null rechnet sich durch). Im Journal steht nur das Skript, die
Ergebnisse werden beim Lesen gerechnet (`Tree.ComputeRows`, `ComputedView.Row`).

Ein einfaches Attribut mit `multiple: true` (Keywords) bleibt der
Sonderfall „eine Spalte, keine Identität" — die Liste ist ein Wert.

### 14. Einheiten (`unit:<key>`) — Grundstock da
Eine Einheit gehört zu einer **Grösse** (mass, length, volume, data, count …)
und hat einen **Faktor zur Basiseinheit** dieser Grösse (kg = 1, g = 0.001,
in = 0.0254 m), dazu eine **Verschiebung** (`offset`, Vorgabe 0; seit 30.09.2026):
Basis = Wert × Faktor + Verschiebung. Damit rechnen auch °C, °F und K ineinander
um (Basis °C; °F: Faktor 5/9, Verschiebung −160/9; K: Faktor 1, Verschiebung
−273.15). Nichtlineares (dB, pH) ist keine Einheit, sondern ein Formel-Attribut am Knoten.
`UnitDefined{key, label{}, quantity, factor, offset?}`; ein Attribut
darf nur eine definierte Einheit tragen; löschen geht nicht, solange ein
Attribut sie benutzt. Saatgut: kg g m cm mm in l ml GB MB TB pc.

Im Journal steht der Wert **immer in der Einheit des Attributs** — die
Umrechnung ist Anzeige und Export: Sicht „zeige Gewicht in g" rechnet
`wert × faktor(attribut) / faktor(sicht)`, ein Kanal (Amazon US) bekommt
Zoll statt Zentimeter. Noch nicht gebaut: die Umrechnung je Kanal und je Sicht
(Feld `unit` an der Kanal- oder Sichtdefinition).

**Einheit in der Zelle** (30.09.2026, `web/src/units.js`): ein Zahlenattribut
(`integer`, `decimal`) mit Einheit hat neben dem Wert eine Auswahl der Einheiten
seiner Grösse. Die Einheit am Attribut ist der Standard und die, in der
gespeichert wird; die Grösse folgt aus ihr. Umschalten rechnet die Anzeige um
und schreibt nichts. Was in der gewählten Einheit eingegeben wird, geht in die
Einheit des Attributs zurückgerechnet hinaus; ein `integer` nimmt nur ein
ganzzahliges Ergebnis. Es gibt dafür keinen eigenen Attributtyp: Typ, Grösse und
Standardeinheit stehen schon am Attribut.

**Eingabeeinheit** (30.09.2026): der Eintrag `AttributeSet` trägt optional `unit` — die
Einheit, in der der Wert eingegeben wurde („20 g“). `value` steht weiterhin in der Einheit
des Attributs (Suche, Formeln, Ausleitung rechnen damit); `unit` ist der Hinweis, in welcher
Einheit die Pflege ihn wieder zeigt. Sie muss zur Grösse der Einheit des Attributs gehören;
die Einheit des Attributs selbst braucht keinen Hinweis. Ein neuer Wert ohne `unit` nimmt den
Hinweis weg, ebenso Leeren und Löschen der Zeile. Die Anzeige gilt je Zelle und je Relation:
gewählt, sonst die Eingabeeinheit, sonst bei Relationswerten die günstigste Einheit (die
grösste, in der der Wert mindestens 1 ist und höchstens drei Nachkommastellen hat), sonst die
Einheit des Attributs. Bei Einheiten mit Verschiebung (°C, °F) gilt ohne Hinweis die des Attributs.

### 15. Sichten (`view:<key>`) — entschieden

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

### 21. Suche mit Bedingungen

> Ich wusste, dass ich in einem Knoten schon mal etwas bei einem
> Funktionsattribut eingetragen hatte — auf die Wurzel gehen und nach dem
> Ergebnis suchen funktioniert so nicht.

Die Textsuche findet Text; die Frage „wo steht bei Attribut X überhaupt
etwas?" ist eine Frage nach der Struktur. Deshalb im Baum-Suchfeld Chips
`key:value` (englisch, alles UND) mit Vorschlägen am Cursor (Schlüssel, dann
Werte — der Baukasten war „gut gemeint, schlecht gemacht“); ein Minus
davor verneint (`-empty:function`, `-role:variant`, `-Wort`), Klick auf den Chip dreht um: `attr:function` (eigener Wert da) · `attr:function=*sku*`
(Muster) · `attr:x=` (kein eigener Wert) · `empty:name/en` (auch geerbt
nichts) · `incomplete:web` · `role:variant` · `status:active` ·
`group:logistics` (gilt hier) · `under:<id>` · `by:<name>` ·
`since:2026-09-10` · freier Text. Rechnet der Server (`Query.cs`), Treffer
wie bisher im Baum mit Pfad und Fundstelle. Offen: gespeicherte Suchen →
virtueller Ordner.

## 22. Vorlagen — Textbausteine ohne KI

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
Ollama im eigenen Netz).

## 26. Benutzer & Rollen — gebaut

Voraussetzung für Workflow-Zuständigkeiten und Hosting. Identität und Rolle im Journal (`UserDefined`),
Geheimnisse in `auth.json` beim Server. Drei Rollen (admin, editor, reader); Rechte als Pfad-Regeln in
`Auth.Allowed`. Ohne Benutzer bleibt der Server offen (Intranet), mit Benutzern sperrt die Middleware `/api`
und setzt `X-Actor` aus der Sitzung. Sitzungen per Cookie, API-Token je Nutzer für Add-ins und Skripte,
Dienst-Token je Job-Lauf. Offen: SSO/OIDC, Passwort-Zurücksetzen per Mail, Rollen je Teilbaum,
Workflow-Rollen (Prüfer, Freigeber) darüber. Details: `docs/betrieb.md`.

## 25. Versionen — gebaut

die Bild aus dem letzten PIM: das Datenblatt dient der Endkontrolle, bei „Version erzeugen“ läuft ein
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
  letzten Stände im Speicher), eigene Werte damals gegen heute — geerbte Werte und Baumposition zählen nicht.
- **Zurückrollen** (`POST …/rollback`, erst `dryRun`): Plan mit allem, was gesetzt würde, und allem, was aussen vor
  bleibt (Attribut gibt es nicht mehr, gilt hier nicht, Zeilen vermehrbarer Attribute); dann ein Stapel vorwärts —
  wie `git revert`, nie `reset`; rückgängig machbar. Eine neue Version ist kein Schnitt: alle Deltas bleiben.
- **Zurückziehen** markiert nur (`VersionWithdrawn`), löscht nichts. Mit Kanal wird Vollständigkeit geprüft wie
  bei der Freigabe. Versionen sind vom Rückgängig ausgenommen.
- Noch offen: Benutzer und Rollen (Zuständigkeit), Workflow-Zustände über dem Status, grafischer Designer,
  Lebensdauer-Regel für Bytes, Ausdünnen des Journals nur nach Ablauf einer beschlossenen Frist (nie aus Platzgründen).

## 23. Jobs — fest eingebaut

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

**Entschieden: alle Importe sind als Job ausführbar, anhand
gespeicherter Profile.** Der Token liegt dann als `secret`-Parameter des Jobs
in `secrets.json` beim Server — nicht im Profil, nicht im Journal (die eine
Ausnahme von 19). Der IXP-Import hat dafür einen Kern (`plugins/ixp/core.mjs`),
den Browser und Prozess (`job.mjs`) gleich benutzen: dieselbe Analyse, derselbe
Stapel, dieselben Regeln.

## 24. Regeln eines Imports — was passiert bei was

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

## 27. Workflow — Entwurf

**Gebaut 21.09.2026 (Kern und erste Oberfläche):** `Workflows.cs` (Abbild), `WorkflowApi.cs`, Befehle in `Commands.cs`, Eintragstypen
wie unten, Saatgut „Redaktion“ (Entwurf → Prüfung → Korrektur ⟲ → freigegeben; freigeben nur admin) und „Übersetzung“ (nicht
angefordert → zur Übersetzung → übersetzt → geprüft). Oberfläche: Band ⚑ Workflow am Knoten, Rechtsklick im Baum → Workflow für
die Auswahl, Einstellungen → ⚑ Workflows (Skizze + Tabellen, kein Ziehen von Pfeilen — der grafische Designer ist offen),
⚑ Aufgaben in der Leiste, Suche `wf:`. ⇄ Übersetzung filtert auf „zur Übersetzung“ und schaltet nach dem Schreiben weiter.
Entschieden vorerst so: ein Workflow gilt für Knotentypen (und Familien), mehrere Workflows nebeneinander; Zuständigkeit je
Person über `WorkflowAssigned` (Aufgaben zeigen nur mir Zugewiesenes oder Unzugewiesenes); keine Fristen; Rubriken der
Publikation nicht — die Antworten auf die vier Fragen unten stehen aus.

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
- **Designer**: Zustände als Kacheln, Übergänge als Pfeile (SVG, Ziehen von Kachel zu
  Kachel), je Pfeil Rolle, Notiz-Pflicht, Wirkungen; Vorlagen „Vier-Augen“, „Redaktion–Prüfung–Freigabe“. Speichert
  `WorkflowDefined`.
- **Am Knoten**: Band „Workflow“ mit Zustand, den erlaubten Übergängen als Knöpfe (nur die der eigenen Rolle), Notiz,
  Verlauf aus dem Journal. Kontextmenü auf die Auswahl (Massen-Freigabe). Suche `wf:<zustand>`, `wf:mine`.
- **Meine Aufgaben**: Ansicht aller Knoten in Zuständen, deren nächster Übergang meiner Rolle (oder mir per
  `WorkflowAssigned`) gehört — nach Alter im Zustand.
- Rechte: `Auth` prüft an `POST /api/nodes/{id}/workflow/{transition}` die Rolle des Übergangs; `Rights.Release`
  bleibt für die Wirkung `release:` nötig.

Entscheidungen: ein Workflow je Familie oder einer für alle? Zuständigkeit je Person (`WorkflowAssigned`) oder nur
je Rolle? Fristen je Zustand (Erinnerung, Eskalation) — jetzt oder später? Gilt der Workflow auch für Rubriken der
Publikation (Freigabe eines Kanalbaums)?

**Produkt und Varianten:** Freigaben hängen an Varianten. „freigeben“ am Produkt oder an
der Gruppe gibt alle vollständigen Varianten darunter frei — ausser denen, die in ihrem eigenen Workflow nicht am Ende stehen
(Entwurf, Prüfung, Korrektur): die überfährt der Vater nicht; ist keine freigebbar, bleibt der Schritt aus und nennt sie.
Zurücknehmen am Produkt trifft alle Varianten. Der Workflow-Zustand des Produkts ist redaktionell und wird vom System nicht
verändert; ob die Produktseite rausgeht, entscheidet die Ausleitung aus den Varianten (keine freigegeben = nicht ausgeleitet,
wieder eine = wieder da — nichts zu merken). Das Band zeigt die Tatsache: „⚠ nicht ausgeleitet“.

**Eskalation:** je Übergang optional „nach n Tagen an Rollen“ (`EscalateAfterDays`,
`EscalateRoles`, leer = jede Rolle mit Schreibrecht): steht ein Knoten so lange im Ausgangszustand, dürfen auch diese
Rollen den Schritt gehen — alle Redakteure im Urlaub, der Manager gibt frei. Am Knoten steht „⏰ Eskalation ab ⟨Datum⟩ → manager“,
nach Ablauf „⏰ eskaliert“; die Aufgabenliste (⚑ Workflows) zeigt den Schritt dann auch diesen Rollen. Kein Timer nötig:
der Vergleich läuft beim Lesen (Commands.Allowed/Escalated).

## 28. Übersetzungsmanagement — gebaut

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

## Messlatte: ein anderes PIM
Was ein anderes PIM für Datenobjekte anbietet (aus der Doku, Stand 16.09.2026,
`docs.opendxp.io/docs/core-framework/Objects/Object_Classes/Data_Types/`),
und wo es hier landet:

| ein anderes PIM | journali |
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

Dazu fünf Punkte, die nachgereicht wurden
hat (16.09.2026):

| ein anderes PIM | journali |
|---|---|
| Datenmodell im Browser per Drag-and-Drop, Tabellen und Oberfläche entstehen daraus | Modell-Ansicht (Schritt 1): Definition als Gitterzeile, das Produktgitter baut sich aus dem Modell. Kein Drag-and-Drop; Reihenfolge und Gruppen kommen aus der Familie. Keine Tabellen zu erzeugen — das Journal ist schemafrei, das Abbild rechnet |
| API-first, REST/GraphQL, Anbindung ERP/CRM/PLM | `/api` + Delta ab Nummer (11). GraphQL: fehlt; kommt, wenn ein Abnehmer es braucht |
| KI-Bundles: Übersetzung (DeepL), Verschlagwortung, Anreicherung, Validierung | Plugins (11): ein Übersetzungs-Plugin liest das Delta, schreibt `AttributeSet` als `plugin:deepl` — Herkunft sichtbar, Handwert geschützt. Wörterbuch (9) als Gedächtnis dazu. Nichts davon im Server |
| Datendichtes ExtJS-Backend für Power-User, komplexe Gitter | genau das Ziel der Oberfläche: Gitter, Zelle, Tastatur, kein Formular; Massenpflege (12) |
| Suche über Millionen Datensätze, Elasticsearch/OpenSearch asynchron | der Suchindex ist ein Abbild, das dasselbe Journal liest (`architektur.md`). Erst Postgres-Volltext im Abbild, OpenSearch als Plugin/Abbild, wenn die Menge es verlangt |

### Funktionsvergleich, Stand 21.09.2026

Quellen: `docs.opendxp.io` (Overview, Objects, Assets, Tools and Features, Bundles) und `opendxp.io/en/platform/components/pim`,
gelesen am 21.09.2026. Die Tabelle von oben (16.09.) bleibt als Geschichte; hier der Stand nach fünf Tagen Bauen.
Was ein anderes PIM als Bundle hat, ist bei uns ein Plugin — beides ausserhalb des Kerns.

| Bereich | ein anderes PIM | journali heute | Urteil |
|---|---|---|---|
| Datenmodell | Klassen-Editor im Browser, Vererbung, Classification Store, Object Bricks, Localized Fields | Modell im Journal (Sprachen, Kanäle, Einheiten, Gruppen, Attribute, Listen, Sichten), Familien, Gruppen ab Ebene, Vererbung entlang des Baums, Achsen Sprache × Kanal je Attribut, vermehrbare Attribute, Formeln und Skripte, ETIM-Klassen | gleichauf; Modelländerungen sind bei uns Einträge mit Historie |
| Varianten | Variants als Objekte mit Vererbung vom Parent | Produkt → Varianten mit Achsen (eindeutige Kombination), geerbte Werte, Achsenassistent | gleichauf |
| Historie/Versionen | Versionen je Objekt (Tabelle), Auto-Save | das Journal selbst (jeder Wert, jede Struktur), Versionen als Zeiger ins Journal, Abbild zu #n | journali vorn — vollständig, ohne Versionstabelle |
| Rechte | Benutzer, Rollen, Rechte je Klasse/Feld/Layout, Permission Analyzer, 2FA | Benutzer, Rollen mit 9 Rechten (Lesen, Schreiben, Zurückziehen, Freigabe, Modell, Plugins, Jobs, Storage, Benutzer), Sitzungen, Dienst-Token je Job | ein anderes PIM vorn: Rechte je Feld/Teilbaum, 2FA, SSO fehlen |
| Workflow | Workflow Management (Zustände, Übergänge, Rollen) | Status + Freigabe je Kanal (mit Sortiment über den Vater); keine freien Zustände, keine Zuständigkeiten | ein anderes PIM vorn |
| Publikation | Multichannel über Output-Channels, Dokumente (CMS) | Publikationsbäume je Kanal × Markt (Rubriken, Verweise, Arbeitsname, kopierte Rubrik), Ausleitungsregel Freigabe × Markt; kein CMS | anders: wir leiten aus, ein anderes PIM rendert Seiten |
| DAM | Ordner, Metadaten, 200+ Vorschauen, Thumbnail-Pipelines, Bildbearbeitung, Fokuspunkt, WebDAV, Versionen | Medien nach Hash mit Werten (Alt-Text, Rechte), Ordnerbaum, Sortieren/Gruppieren, Vererbung an Subitems mit „unterbunden“, Store Postgres/Verzeichnis/S3, eine Vorschau (Browser rechnet) | ein anderes PIM vorn: Presets, Bildbearbeitung, Metadaten aus der Datei (EXIF/IPTC), Videovorschau |
| Import-Pipeline | Data Importer: je Feld eine Transformationskette (Data Types, Manipulation: Combine, Conditional, Explode, Trim, Replace, Static …) | Datenmapper mit **Umwandlung je Spalte** (`transform.js`, 21.09.: trim, ersetzen, Zahl aus „22 mm“, Ja/Nein, Datum, aufteilen, Spalten verbinden, fester Wert, wenn leer, Werte übersetzen, Bedingung, HTML), Kette im Profil, Vorschau je Spalte; danach die Prüfung des Attributtyps | gleichauf für Tabellen; Geo/Galerie-Typen fehlen |
| Massenpflege | Grid mit Spaltenkonfiguration, Batch-Edit, CSV/XLSX-Export und -Import im Grid | Tabellenansicht je Knoten (Inline, Tastatur), Excel/CSV/JSON-Import mit Datenmapper und strengem 1:1-Rundlauf, Office-Aufgabenbereiche (Excel, OnlyOffice) | gleichauf; Office-Seitenleiste haben sie nicht |
| Datenqualität | Validierung je Feld (Pflicht, Muster), Bundles | Regeln je Kanal × Sprache (Vollständigkeit), Datenanalyse-Plugins: DPP, PPWR, Empowering Consumers, GEO-Texte, Anreicherung mit KI | journali vorn — Regelwerke, nicht nur Feldprüfung |
| KI | Bundles (Übersetzung, Verschlagwortung, Anreicherung) | KI mehrere Anbieter, Schlüssel nur im Browser; Vorschläge nie ohne Bestätigung; Herkunft je Wert | gleichauf, anderer Grundsatz (Herkunft sichtbar) |
| Import/Export | Data Hub (GraphQL, REST), Import-Bundle, Grid-Export | `/api` mit Delta ab Nummer, Plugins: CSV, XLSX, JSON, IXP, Solr, Vorlagen-Export (BMEcat 2005/ETIM 5, Google Merchant, JSON), RAG-Export, Backup; Jobs mit Profil | GraphQL fehlt; Vorlagen-Export haben sie nicht im Kern |
| Suche | Advanced Object Search, Elasticsearch/OpenSearch-Bundle | Suche im Abbild mit Begriffen (`media:`, `rel:`, Status, Attribute); kein Volltextindex | ein anderes PIM vorn bei Millionen Datensätzen |
| Jobs/Automatisierung | Scheduling (Veröffentlichung), Maintenance, Symfony Messenger | Jobs als Kindprozesse (cron, von Hand), Profile, Geheimnisse beim Server; Fächer in/done (Entwurf) | gleichauf; terminierte Freigabe fehlt |
| Betrieb | Symfony/PHP, MySQL/MariaDB, Redis, Elasticsearch optional; Docker | .NET 8, Postgres, ein Prozess, Plugins als Bind-Mount, lokaler Journal-Spiegel; Docker | journali leichter; Schnappschüsse der Abbilder fehlen noch |
| API-Erweiterung | PHP-Bundles im Prozess, Events | Plugins nie im Serverprozess (Browser-Modul oder Kindprozess), nur über `/api` | Grundsatzentscheid: Stabilität vor Tiefe |
| Werkzeuge | Notes & Events, Tags, Perspectives, Custom Reports, Glossary, Notifications, PDF-Rendering, Cloning | Journal lebendig daneben (statt Notes/Events), Sichten je Rolle (statt Perspectives), Wörterbuch (statt Glossary), Datenblatt HTML + Designer (PDF-Stapel offen), Duplizieren; keine Tags, keine Reports, keine Benachrichtigungen | ein anderes PIM breiter; das meiste davon bei uns nicht Gegenstand oder Plugin-Stoff |
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

## 29. Klassifikation und BMEcat — gebaut

**Wording:** Im PIM gibt es zwei gängige Paare — *Attribut → Wert* oder
*Merkmal → Ausprägung*. journali hat sich mit Attributen und Attributgruppen auf das erste
festgelegt: wir sprechen von **Attributen** und ihren **Werten**, nie von Merkmalen oder
Ausprägungen. Ein ETIM-Merkmal heisst darum **ETIM-Attribut** (EF-Code) und wird einem Attribut
des Modells **zugeordnet** — „nicht zugeordnet“ statt „Merkmal ohne Attribut“ („ein Attribut ohne
Attribut“); Werte sind leer oder gefüllt.

**Trennschnitt (die Entscheidung):** ETIM hilft nur, Produktgruppen und Produkte Klassen
zuzuordnen und die Merkmale als Attribute bereitzustellen. Der **BMEcat-Export setzt auf einen
Publikationsbaum auf** — welche Produkte, welche Rubriken, welche Reihenfolge, ist der Baum;
Freigabe, Markt und Stand gelten wie bei jeder Publikation. Damit entfällt jede
Export-Konfiguration im Klassifikations-Plugin („welche Klassen, ab welcher Stufe“).

**Klassifikation (Gruppe ⌗ in der Leiste; ETIM heute, ECLASS/UNSPSC mit demselben Aufbau):**
- **Eine Klasse, eine Attributgruppe** (30.09.2026, ersetzt die frühere Bauart mit einer Sammelgruppe je System und einer
  Bedingung `when` an jedem Merkmal — die stammte aus der Zeit, als ein Attribut nur in einer Gruppe stehen konnte): je System
  eine Gruppe, die nur das Klassenattribut trägt (`etim`, `gpc`), und je zugewiesener Klasse eine Gruppe, die so heisst wie die Klasse
  (`etim_ec002712`, Bezeichnung „EC002712 Name“). Ihre Attribute werden angelegt, wo es sie noch nicht gibt, und sonst nur dieser Gruppe
  zugeordnet (n:m, 36): `EF000008 Breite` gibt es einmal und gilt in den Gruppen aller Klassen, die es führen. Die Gruppe hängt an dem
  Knoten, dem die Klasse zugewiesen wird, und gilt von dort abwärts — dasselbe Vorgehen wie bei DPP und PPWR: eine Gruppe mit ihren
  Attributen, die man zuordnet oder füllt. Genau eine Klasse je Produkt (ETIM-Grundsatz); mehrere Klassifikationen zugleich sind
  mehrere Systeme. Hat ein Knoten unter einem mit Klasse eine eigene, gelten an ihm beide Gruppen — die Klasse gehört an die Ebene,
  unter der alle dieselbe haben. Ein früherer Bestand wird mit `POST /api/classification/migrate` umgestellt.
  **Systemobjekte:** die Gruppe des Systems und das Klassenattribut darin lassen sich nicht einzeln zurückziehen (der Server lehnt es ab);
  die Oberfläche fragt mit den Zahlen — Knoten mit Klasse, Werte, Gruppen, Attribute — und nimmt auf Antwort die ganze Klassifikation in allen
  Bäumen zurück (`POST /api/classification/retire`). Das verlangt das Recht `system.retire` („Systemobjekte zurückziehen“), das der Administrator
  trägt; wer Anwender verwaltet, hat es mit. Erkannt werden sie an ihrer Form (geschlossene Liste so benannt wie das Attribut, mit Spalte „group“),
  nicht an einem Namen. Attribute des Kunden, die einer Klassengruppe zugeordnet waren, bleiben mit ihren Werten.
- **Klasse an der Produktgruppe, erbt** (Regelfall), Ausnahme am Produkt; an der Variante nicht.
  Die Gruppe des Systems gilt überall (die Klasse muss an der Gruppe stehen dürfen), die
  Merkmale nur an Produkt und Variante (`levels`) — normale Vererbung reicht.
- **Zuordnung statt Anlegen:** Standard ist ein vorhandenes Attribut des Kunden (`breite`,
  `farbe`) mit **ƒ** — dieselbe Umwandlungskette wie im Datenmapper (`plugins/table/transform.mjs`): Einheit umrechnen, ja/x → Ja/Nein,
  Text → EV-Code nach Tabelle, von/bis verbinden. Ein eigenes `ef…`-Attribut ist der Ausweg; ab
  dann ist es das Attribut des Kunden, das die nächste Klassifikation wiederverwendet. Die
  Zuordnung (`map`: Schlüssel oder `{ to, steps }`) ist Modellwahrheit, einmal je Journal —
  **kein Profil im Klassifikations-Plugin**; eine aktive Release, Wechsel = Abgleich.
- **Gemeinsames liegt im Server, nicht in einem dritten Plugin** (30.09.2026, `ClassificationApi.cs`): je System ein eigenes
  Plugin (`etim`, später `eclass`), das seine Dateien liest und sagt, was ein Merkmal in seinem System ist. Anlegen im
  Modell (Gruppe des Systems, Klassenattribut mit Werteliste, Gruppe der Klasse, Merkmalsattribute mit Einheit und Liste), Klasse
  zuweisen (Gruppe des Systems an den Pfad, Gruppe der Klasse und Klasse an den Knoten), entfernen, umstellen und die Bereitschaft
  (`POST /api/classification/ensure|assign|clear|migrate|readiness`) macht der Server aus einer neutralen Beschreibung; er kennt kein
  System. Ein zugeordnetes Merkmal (`target`) kommt als vorhandenes Attribut in die Gruppe, ein eigenes entsteht dann nicht.
- **GPC** (Plugin `gpc`, 30.09.2026): die GS1-Produktklassifikation als zweites System — Segment, Family, Class, Brick; der Brick
  ist die Klasse. Die Nutzung ist laut GS1 kostenfrei; die Datei (JSON, oder das Zip der Veröffentlichung) holt der Anwender
  selbst, im Repo liegen keine GPC-Daten (`sample.json` ist erfunden). Attribute und Werte haben in allen Bricks dieselben
  Codes; nur die Auswahl der Werte je Brick ist verschieden — sie stehen einmal im Wörterbuch, am Brick nur die Codes
  (die ganze Veröffentlichung sind rund 5,5 MB im Journal, ein Datensatz je Segment). Jedes GPC-Attribut wird ein Listenattribut
  `gpc<code>` mit der Vereinigung seiner Werte, das in den Gruppen aller Bricks steht, die es führen (`gpc_<brick>`). Die Werte
  eines Bricks erzwingt die Liste nicht — sie ist die Vereinigung über alle Bricks. eCl@ss folgt nur, wenn ein Kunde es verlangt
  und die Datei liefert: der Einbau in eine Software ist laut ECLASS kostenpflichtig.
- **Bedient wird beim Gegenstand, nicht im Plugin**. Neuer Beitragspunkt **`nodeBands`**: ein Plugin zeichnet je Knoten ein Band in
  der Knotenansicht (`mount({ head, body }, nodeId, ctx)`, wie das Workflow-Band). Das Band
  ⌗ ETIM zeigt in einer Zeile Klasse (eigen/geerbt, ≠ abweichende darunter) · Attribute n/m
  (zugeordnet, ƒ, fehlend) · Daten % gefüllt (leer, passen nicht) und springt ins vorhandene
  Werkzeug: Zuweisen-Dialog, Zuordnung (auf die Klasse gefiltert), **Subitems-Tabelle mit genau
  den Spalten der Klasse** (`/table/<id>?attrs=…`), Prüfung mit Funden im Körper. Die Ansicht des Plugins
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

## 30. Freigabesteuerung — Modellteil gebaut

Die Frage dahinter: „wenn ich die Beschreibung ändere und die Redaktion hatte vorher
schon eine Freigabe — darf das überhaupt dann noch auf freigegeben stehen?“ Drei Hebel, die
man nicht verwechseln darf:

- **Stand** — was geht hinaus (der Wert selbst).
- **Freigabe** — darf es hinaus (Zustand am Knoten je Kanal).
- **Workflow** — wer muss noch hinsehen (Stufen und Übergänge).

Die Freigabesteuerung sagt nur das eine: **zählt diese Wertänderung als Eingriff, der Prüfung
und Freigabe berührt?** Was dann geschieht, sagt der Workflow — die beiden bleiben getrennt.

**Gestellt wird sie je Attributgruppe, überschrieben je Attribut**:

| Stufe | Werte | Bedeutung |
|---|---|---|
| Gruppe | `auto` (leer) · `always` · `never` | automatisch = zählt, wenn die Gruppe mindestens ein Pflichtfeld hat |
| Attribut | leer · `always` · `never` | leer = wie die Gruppe; `auto` gibt es nur an der Gruppe |

Gebaut: `ReleaseWatch` (Konstanten) in `Types.cs`, Feld `releaseWatch` an
`AttributeGroupDefinition` und `AttributeDefinition`, `ModelCatalog.Watched(attribut)` als die
eine Auskunft (Attribut schlägt Gruppe, sonst Gruppe, sonst Pflichtfeld-Automatik), Prüfung der
Werte in `ModelApi`, Zeile „⚑ Freigabesteuerung“ in der Modellpflege an Gruppe und Attribut,
Kennzeichen ⚑/⚐ in den Listen, `ReleaseWatchTests`.

**Die Wirkung ist noch nicht gebaut.** Entschieden ist: zählt die Änderung, wird
die Freigabe zurückgenommen und der Zustand fällt auf die Stufe vor der Freigabe zurück. Offen
bleiben die Quelle der Änderung (Importprofil gegen Mensch — je Profil einstellbar) und die
**Rollenregel**: kein Zurückstufen, wenn die ändernde Rolle den Weg von der
Rückfallstufe bis zur Freigabe ohnehin allein gehen könnte — das Vier-Augen-Prinzip fällt dann
aus dem Graphen heraus, statt als zweite Regel danebenzustehen.

### Übersetzung — offene Frage, Praxis als Vorschlag

„Wann gibt man eine Übersetzung in den Workflow und nach welcher Menge der
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
Übersetzung. Entschieden ist davon nichts — die Wort fehlt.

### Die vier Blockaden aus der Praxis
keine Version freigeben, bis die französische Übersetzung da ist … Fallbacksprachen sind auch
nicht die Lösung, man will nicht mitten in der französischen Webseite deutsche Texte …
viele Übersetzungen laufen heute mit KI und müssen nur noch von einem lokal Verantwortlichen
abgenommen werden.“ Was der Bestand dazu schon trägt — und wo die eine Lücke ist:

| Blockade | Antwort | Beleg |
|---|---|---|
| Der Redakteur speichert zehnmal, bis es „final“ ist | **Der Auslöser ist nie das Speichern, sondern ein Übergang.** Der Redakteur geht „final — zur Übersetzung“ oder „final — ohne Übersetzung“; das ist seine Entscheidung über die Relevanz, und sie ist modellierbar, ohne eine Zeile Code: zwei Übergänge aus demselben Zustand, Wirkung `translate:<sprache>` neben `release:` / `revoke:` | `WfTransition(… Effects …)`, `Types.cs:504`; Wirkungen heute `release:web`, `revoke:`, `status:` (`Workflows.cs:10`) |
| Version blockiert, weil Französisch zwei Wochen braucht | **Freigabe und Version gibt es schon je Sprache** — Deutsch geht hinaus, Französisch wartet. Blockiert wird nur, wer eine Version über alle Sprachen zieht | `Release(string Channel, string? Locale)` (`Tree.cs:9`, gesetzt in `:567`, gelesen in `ReleasedVia` `:168`); `VersionState.Channel` / `.Locale` (`Versions.cs`) |
| Fallback auf die Mastersprache will niemand | **Der Rückfall geht nicht auf Deutsch, sondern auf die letzte freigegebene französische Version.** Das kostet keinen zweiten Speicher: die Version ist ein Zeiger auf die Journalnummer, der alte französische Wert steht im Journal. Erst wenn es noch nie eine französische Version gab, muss der Kanal wählen: Mastersprache zeigen oder das Produkt in Französisch nicht zeigen | `VersionState.JournalNumber` (`Versions.cs`) |
| KI übersetzt sofort, lokal wird nur abgenommen | **Die KI ist ein Akteur mit eigener Rolle**, kein Sonderweg: sie schreibt den Wert, der Zustand heisst „maschinell übersetzt“, der lokal Verantwortliche geht den Übergang „abgenommen“. Die Rollenregel greift dann von allein — die KI-Rolle kann den Weg bis zur Freigabe nicht allein gehen, also bleibt das Vier-Augen-Prinzip stehen, ohne zweite Regel. Der „Auftrag“ ist dann ein Job im `tasker` statt ein Paket an die Agentur; die Warteschlange ist dieselbe | Benutzer und Rollen im Journal (`user:<key>`, `role:<key>`), Jobs mit eigenem Token (CLAUDE.md, `Auth.cs`) |

**Die Lücke:** der Workflow-Zustand hängt je Knoten und Workflow — ohne Achse (`NodeWorkflow`
in `Workflows.cs`, Schlüssel `_nodes[knoten][workflow]`). „Redaktion Französisch in Korrektur,
Deutsch freigegeben“ gibt es damit heute nicht. Zu bauen wäre: ein Workflow darf als *je
Sprache* gekennzeichnet sein, dann trägt `WorkflowStateSet` eine Sprache (leer = gilt für alle,
also bleibt jeder heutige Eintrag gültig). Das ist der eine Eingriff — Freigabe, Version und
Rollen können es schon. **die Wort fehlt.**

### Der Übersetzungsspeicher, das Paket und die Rückkehr
die alte, und so sammelt sich ein Kontingent im Übersetzungsspeicher an … spätestens wenn der
Redakteur der Mastersprache eine Version macht oder nach einer vorgegebenen Zeit — bei den
meisten wöchentlich, bei anderen einmal nachts — wird daraus ein Übersetzungsauftrag …
und irgendwann kommt er zurück und man stellt fest, dass es schon wieder etliche Änderungen am
Original gibt.“

**1. Der Speicher ist keine zweite Datenhaltung, sondern eine Marke.** Je Knoten, Attribut und
Sprache steht im Journal, bis zu welcher Journalnummer übersetzt wurde. Offen ist alles, was
sich seither geändert hat — eine Abfrage, kein Behälter. Damit ist die „die neue Version
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
| Zielwert wurde inzwischen von Hand geändert | **nur hier** ein Mensch: Konflikt zeigen, beide Versionen nebeneinander |

Nie: den Auftrag verwerfen, weil er „nicht mehr aktuell“ ist. Genau daraus entsteht das
Hamsterrad — wer immer den ganzen Text neu übersetzen lässt, holt den
Rückstand nie ein; wer nur die Differenz nachbestellt, schon.

**Nebenbei fällt eine Zahl ab:** weil jeder Wert seinen Quell-Hash kennt, steht je Sprache der
Rückstand da („FR: 12 Werte“) — dieselbe Zahl, aus der das nächste Paket entsteht. Läuft die
Übersetzung über die KI, schrumpft die Runde auf Minuten und der ganze Fall „Quelle ist
weitergezogen“ bleibt nur für die Agenturstrecke übrig.

**Gebaut** (22.09.2026): der Eintrag für die Marke, das Abbild, der Auftrag, der Rücklauf mit den
drei Fällen, die Workflow-Achse — siehe die Tabelle unten.

### Gebaut am 22.09.2026

Vorweg eine Berichtigung: „gebaut ist nichts“ stimmte nicht — Einheiten, XLIFF hin und zurück, Gedächtnis, Wörterbuch und
die Jobs gab es seit dem 21.09. Gebaut wurde das, was gefehlt hat:

| Was | Wo |
|---|---|
| **Die Marke** je Knoten × Attribut × Zielsprache × Kanal × Zeile: gegen welche Quellversion ist übersetzt (Fingerabdruck + Journalnummer) | `TranslationMarked`, Abbild `Translations` (`Journali.Core/Projections/Translations.cs`) |
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

**Noch nicht gebaut** (die Wort fehlt): die Bagatellgrenze (Normalisieren vor dem Vergleich, Abstand statt „ungleich“),
das Häkchen „unwesentliche Änderung“ am Wert, die Fallback-Regel je Kanal („letzte freigegebene Version der Zielsprache
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

## 31. MCP — der Assistent spricht mit dem PIM (Entwurf)

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

**Nur lesen — entschieden.** Der Dienst schreibt nicht. Ein Assistent, der selbst Werte
setzt, erzeugt Einträge, die niemand angefordert hat; Vertrauen entsteht
zuerst am Lesen. Nachrüstbar bleibt es jederzeit, weil jeder Eintrag ohnehin
seinen Akteur trägt: Schreiben käme dann als eigene Werkzeuge
(`wert_setzen`, `klasse_zuweisen`) mit eigener Rolle, damit im Journal steht,
dass es die KI war — und es zählte als Tagesgeschäft.

**Zugang und Menge — entschieden.** Der Assistent meldet sich mit
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

**Eigener Container — entschieden.**
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
- **Cache: nur was weder Rechte noch Aktualität berührt**. Gegen einen Datencache sprechen drei Dinge: zwei Anwender
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

## 32. Dokumente durchsuchbar machen — Entwurf

Am Knoten hängen Datenblätter, Sicherheitsdatenblätter, Zertifikate,
Verarbeitungshinweise. Für uns sind sie heute eine Blackbox: `MediaCreated`
kennt Hash, Grösse, Mime und Name — nicht den Inhalt. Wer wissen will, in
welchem Datenblatt „Zugfestigkeit 12 N/mm²“ steht oder welches Produkt
„temperaturbeständig bis 120 °C“ ist, muss die PDFs von Hand öffnen. Das ist
die Lücke, die weder die Attributsuche noch MCP schliesst: **die Information
steht in Prosa, nicht in einem Attribut.**

### Die vier Schritte

1. **Text herausholen.** Ein Job wie `derive` (Prozess-Plugin, Kindprozess
   des Servers) zieht Text aus PDF, Word und HTML. Hash-adressiert: dasselbe
   Dokument wird nie zweimal gelesen. Für gescannte PDFs braucht es OCR —
   optional, teuer, und erst wenn es wirklich gebraucht wird.
2. **In Abschnitte teilen.** Ein 40-seitiges Datenblatt ist als Ganzes für die
   Suche wertlos. Absatzweise schneiden, Seitenzahl und Überschrift
   mitführen — damit die Antwort „Datenblatt INTERCOLL D 3442, Seite 4"
   lautet und nicht „irgendwo in dem PDF".
3. **Zwei Indizes, nicht einer.**
   - **Wortsuche** (Postgres-Volltext, `tsvector`): findet „12 N/mm²",
     „DIN EN 204", eine Chargennummer. Kostet nichts, ist exakt, braucht kein
     Modell.
   - **Vektorsuche** (`pgvector`): findet „hält Hitze aus", wenn im Text
     „temperaturbeständig bis 120 °C" steht. Kostet Embeddings je Abschnitt
     und bindet an ein Modell.

   Beides zusammen ist das, was in der Praxis trägt: reine Vektorsuche
   verfehlt Normbezeichnungen und Zahlen erstaunlich zuverlässig, reine
   Wortsuche findet Umschreibungen nicht.
4. **Der Treffer zeigt aufs Produkt.** Das ist der Vorteil gegenüber jedem
   allgemeinen Dokumentensystem: Das Dokument hängt am Knoten, also liefert
   ein Treffer Dokument **und** Produkt — und ist es Beleg einer Version,
   auch den Zeitraum, in dem es galt.

### Wo die Daten liegen

**Nicht im Journal.** Text, Abschnitte und Vektoren sind abgeleitet: aus einem
Dokument, das hash-adressiert im Medienspeicher liegt, und jederzeit neu
herstellbar. Sie gehören in eigene Tabellen neben dem Journal (wie die
gerechneten Vorschauen), und ihr Wasserstand ist die Journalnummer: neu
eingelesen wird, was seither dazukam. Ein Modellwechsel bei den Embeddings
bedeutet: Index verwerfen, neu rechnen — das Journal bleibt unberührt.

### Was es kostet

Die Extraktion ist billig (Rechenzeit). Teuer sind die Embeddings: je
Abschnitt ein Aufruf beim Anbieter, den der Kunde mitbringt. Bei 5 000
Dokumenten à 20 Abschnitten sind das 100 000 Aufrufe — einmalig, danach nur
noch für Neues. Dafür braucht es eine ehrliche Anzeige vor dem Lauf („so viele
Abschnitte, so viele Aufrufe") und die Möglichkeit, erst einmal nur einen
Teilbaum zu indizieren.

### Reihenfolge

Extraktion und **Wortsuche** zuerst: Sie decken die meisten „in welchem
Datenblatt steht …"-Fragen ab, kosten keine KI und sind dauerhaft stabil. Die
**Vektorsuche** kommt oben drauf, sobald unscharfe Fragen häufig sind — und
ist dann zugleich das Werkzeug `aehnlich` für den MCP-Dienst (§31).

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
   ein Kanal als Spalten
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

## Offen — die Wort

- ~~Kategorie als zweiter Baum?~~ Entschieden, siehe 4: keine Kategorien;
  Symlink für Knoten in mehreren Ästen, Kanalbäume als eigene logische Bäume.
- Produkt ohne Variante: heute muss eine Variante angelegt werden (ohne
  Achsen, wenn das Produkt nach nichts variiert); eine „unsichtbare"
  Einzelvariante gibt es noch nicht
- `AttributeDefined` als ganze Definition je Eintrag (Vorschlag) oder
  feldweise wie beim Produkt?
- Relationen gerichtet mit expliziter Gegenrichtung oder abgeleitet?
- HTML in `description`: roh speichern (Vorschlag) oder strukturiert (Markdown)?
- ~~Wörterbuch: nur Begriffe (Vorschlag) oder auch ganze Sätze/Bausteine?~~ — entschieden 28.09.2026: auch Sätze, in
  Gruppen (9).
- Platzhaltertext-Ergebnis als Ableitung (Vorschlag) oder beim Anlegen als
  Eintrag „eingefroren"?
- Plugins: darf ein Import Handwerte überschreiben — je Attribut regelbar
  (Vorschlag) oder nie?
- DAM: eigener Baustein oder Plugin?

### 17. Name im Baum — entschieden

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
   auf `name` von weiter oben bleiben;
3. Variante: SKU, sonst die Achsenwerte;
4. die interne Id — der Mindest-Fallback, den es immer gibt.

Nicht gewählt: Name je Attributgruppe (mehrere Gruppen am Knoten → Kollision,
welche zählt?), Name je Knotentyp im Modell (`TreeLabelDefined`, Altlast: ein
Attribut, das jemand aus dem Modell nimmt, liesse den Baum namenlos), Name
aus dem Attribut `name` fest im Code (dasselbe Problem; wer sein Attribut
`shortdesc` nennt, hätte keinen Baum).

Sperre: ein Attribut, das irgendwo das ★ trägt, lässt sich nicht zurückziehen
— erst das ★ umsetzen (`DELETE /api/model/attributes/{key}` nennt den Knoten).

Mehrsprachig ist der eigene Name nicht . Ob der Baum der
Oberflächensprache folgen soll, ist offen
vielleicht gerade nicht". Der automatische Name nimmt heute fest `de` zuerst.

Saatgut: das ★ steht an `g-mastertree` auf `name`; ein leeres Journal benennt
damit alles darunter nach seinem Namen, bis jemand es umsetzt.

### 18. Relationen — gebaut

Andere PIMs haben Relationen und attributierte Relationen; die Solr-Quelle
zeigt es: 109 376 `complex_relation`-Dokumente (Konfigurator: „in diesen
ThinkCentre passt dieses RAM-Modul, Menge 1, Slot 1") neben einfachen
`*_doc_rel`-Feldern (Zubehör, Bestandteile, Bilder).

Ein Mechanismus für beides: **eine Relation ist ein Ding mit eigenem
Strom** `r-…`, wie ein Knoten.

- `RelationCreated {type, from, to}` — der Typ kommt aus dem Modell
  (`relation:<key>`: Bezeichnung hin und zurück, erlaubte Rollen je Ende,
  Attributgruppen der Werte — eine oder mehrere, seit 30.09.2026). Je Typ nur einmal zwischen denselben Knoten,
  nie auf sich selbst.
- Werte an der Relation sind dieselben `AttributeSet`-Einträge wie am
  Knoten — erlaubt sind die Attribute der Gruppen des Relationstyps, über
  Heimatgruppe oder Mitgliedschaft (n:m, 36); ein Attribut wird dafür nicht
  kopiert. Saatgut: `component` mit `relation_component` → `quantity`. Formeln
  und Vorlagen werden an einer Relation nicht gerechnet (sie ist kein Knoten).
  Eine einfache Relation ist dieselbe Sache ohne Gruppe.
- `RelationRetired` nimmt sie aus dem Abbild; `ExternalLinked` trägt die
  Kennung der Quelle (Import: Update statt Neuanlage).
- Abbild `Relations`: je Knoten ausgehend und eingehend. Ein
  zurückgezogener Knoten lässt seine Relationen stehen; sie zeigen ins Leere
  (`other.missing`), bis jemand sie zurückzieht — wie verwaiste Werte.
- Im Knoten: Abschnitt „⇄ Relationen" je Typ, → ausgehend mit den Werten
  als Zellen, ← eingehend mit der umgekehrten Bezeichnung; neue Relation
  über Typ + Suche nach dem Ziel (Name, SKU, Id). Modell → Relationen
  pflegt die Typen.

- **Tabellenexport** (30.09.2026): der Excel-Export nimmt auf Wunsch ein zweites Blatt `Relationen` mit — eine Zeile
  je Relation, dort geschrieben, wo sie ausgeht: `journali_von`, `journali_von_name`, `journali_typ`, `journali_nach`,
  `journali_nach_name`, dann je Relationsattribut eine Spalte (mit Sprache `<attribut>_<sprache>`) und, wo das Attribut eine
  Einheit hat, daneben `<attribut>_einheit` (nur zum Lesen; der Wert steht in der Einheit des Attributs). Werte mit Kanal
  hat das Blatt nicht, eine Relation, die von ausserhalb des Teilbaums ausgeht, fehlt. CSV hat nur ein Blatt und kennt
  keine Relationen. Der Tabellenimport liest das Blatt hinter den Knoten: die Kennungen des Blatts `Daten` (auch in einem
  anderen System) gehen vor Ids im Baum; was es nicht gibt, wird gemeldet und übergangen. Eine vorhandene Relation
  (Typ, von, nach) wird nicht noch einmal angelegt, nur ein abweichender Wert wird gesetzt; leere Zellen löschen nichts.

Offen: Reihenfolge der Relationen (heute nach Eintrag), Relationen in der
Suche und Vollständigkeit, Medien (eigene Dinge oder Relationen zu
Medienknoten), und der Import der Solr-Relationen (`*_doc_rel` am Knoten,
`complex_relation` als attributierte Kante — beide Enden müssen importiert
sein; mit 109 k Kanten ein eigener Lauf).

### 19. Plugins — gebaut

die Bild: Plugins werden installiert, aktiviert, gelöscht, haben eine
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
  wann mit welcher Version benutzt hat, ist damit nachvollziehbar — und die
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
(`PluginInstalled/Enabled/Disabled/Removed`); ⬡ Plugins in der Leiste:
Liste mit Stand und Version (↑ wenn die Platte neuer ist), installieren,
ein/aus, aktualisieren, entfernen, Prozess starten mit Parametern und
Ausgabe. Browser-Plugins: `default export { views: [{path, label, icon,
mount(el, ctx)}], nodeActions: [{label, icon, run(nodeId, ctx)}] }` —
Ansichten erscheinen in der Leiste, Aktionen im Kontextmenü des Baums.
Der Solr-Import ist zugleich Prozess-Plugin (`job.mjs`); Ansicht und Job teilen
sich Ablauf (`lauf.mjs`) und Abbildung (`solr.js`).

**Basis-Plugins.** Der
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

**Ausbau:**

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
- **Mitgelieferte Plugins**: `csv`, `json`, `excel` (SheetJS, Apache-2.0)
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

### 20. Medien — gebaut

**Vererbung:** ein Medium am Knoten
bekommt an seiner Zuordnung den Schalter `inherit` („an Subitems
vererben“, Gruppe `relation_media`). Dann gilt es an allen Knoten
darunter — als *geerbtes* Medium (gestrichelte Kachel, kursiv, mit
Herkunft), eine Ableitung wie bei Attributwerten, nichts wird kopiert.
Eigene und geerbte Medien bestehen nebeneinander. **Ein geerbtes Medium
lässt sich an keiner Ebene entfernen, nur unterbinden:** ⛔ am
Knoten legt eine Zuordnung zum selben Medium mit `stop=true` an — damit ist
es dort und an allem darunter weg; den Stopp lösen (×) bringt es zurück.
**Bedeutung:** an dieser Ebene steht das Medium *nicht
zur Verfügung* — auch nicht für Exporte, Datenblätter, Suche (`media:`).
Ein Stopp ist keine Zuordnung, nur eine Sperre; wer Medien eines Knotens
liest, lässt Zuordnungen mit `stop=true` aus.
Der Server liefert `inherited` in `GET /api/nodes/{id}/relations`. Modell
„Kopien je Subitem“ wurde verworfen (Kaskaden beim Aufbrechen). Der
IXP-Import nutzt das: hat ein Subitem dasselbe Bild wie sein Elternteil,
wird es dort vererbt und am Subitem nicht eigens zugeordnet.

**Ordner:** die Bibliothek hat einen eigenen Ordnerbaum (Strom `mf-…`, `MediaFolderCreated/Renamed/Moved/
Retired`), ein Medium liegt in höchstens einem Ordner (`MediaFiled` am Medium, null = ohne Ordner). Die Ordner sind
reine Organisation — nichts über Verwendung (das sind die Relationen) oder Datei (Store) — und gehen nie in die Ausleitung.
Regeln: gleicher Name je Ebene nur einmal, nicht in sich selbst verschieben, löschen nur leer (kein stilles Aufräumen —
jede Ablage ist ein Eintrag). ▨ Medien: links die Ordner (＋ ✎ 🗑 an der Zeile, Ordner ziehen = verschieben, „mit
Unterordnern“), Mitte Kacheln mit Sortierung (zuletzt geändert, Name, Datum, Größe, Verwendung, ↑↓) und Gruppierung
(Art, Dateityp, Monat, verwendet, Ordner), Mehrfachauswahl (Strg/Umschalt-Klick, Strg+A, Esc), Kacheln auf einen Ordner
oder „⌂ ohne Ordner“ ziehen, „📁 verschieben …“ für die Auswahl, Hochladen landet im gezeigten Ordner. Am Knoten: „▨ aus der
Bibliothek …“ (Abschnitt Medien) öffnet dasselbe Bild als Fenster — Ordner, Suche, Mehrfachauswahl, Relationstyp
(automatisch: Bild → `image`, sonst `document`), was schon hängt ist ausgegraut. Suche: `folder:<Name|Pfad|Id>` (samt Unterordnern), `folder:none`.

Binärdaten nicht in die Datenbank — später skalieren, woanders
speichern. Einverstanden; das Journal bleibt schlank.

- **Die Datei liegt ausserhalb**, der Ort ist ein Treiber: `postgres`
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

**Vorschau-Presets — gebaut 21.09.2026**: Presets im Journal (`media-preset:<key>`,
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

## 33. Status auch an Gruppen — entschieden und gebaut

**Die Entscheidung:** „Ich finde es wohl richtig, wenn Gruppen auch Status
haben können. Beispiel: neue PG, Markteinführung: redaktionell kann alles
freigegeben sein, vorbereitet, trotzdem noch kein Verkaufsstart."

Und, auf die Frage, was gilt, wenn die Gruppe auf Entwurf steht und ein Artikel
darunter auf aktiv: „Völlig egal. Der Status ist kein Workflow-Kriterium, sondern
lediglich ein Attribut, das wir weitergeben."

Damit ist die Semantik knapp: Der Status gehört dem Knoten, an dem er steht. Er
vererbt sich nicht, er überschreibt nichts, und keine Kombination ist ein
Widerspruch — die Gruppe sagt etwas über sich, jedes Produkt über sich. Wer
Freigaben steuern will, nimmt den Workflow (30), nicht den Status.

**Was das kostet, und wie es gelöst ist.** `Node.Status` ist seit jeher mit
`draft` vorbelegt. Hätten wir den Wähler einfach für Gruppen eingeblendet, würde
jede der 1466 bestehenden Gruppen behaupten, sie sei ein Entwurf — eine Aussage,
die nie jemand getroffen hat. Darum merkt sich der Knoten die Nummer des
Eintrags, der den Status setzte (`Node.StatusAt`, 0 = nie): `HasStatus` ist bei
Produkt und Variante immer wahr (sie beginnen als Entwurf), bei einer Gruppe erst
nach dem ersten `StatusSet`. Die Oberfläche zeigt bis dahin „–".

Daran hängen drei Stellen, die vorher „eine Gruppe hat keinen Status"
voraussetzten und jetzt `HasStatus` fragen: der Versionsvergleich (die
Statuszeile), die Zählung „wie oft benutzt" im Modell (sie zählte bisher jede
Gruppe als Entwurf mit) und der Teilbaum-Export. Der Export schreibt den Status
einer Gruppe nur, wenn sie einen hat; ein Import setzt ihn an einer Gruppe nur,
wenn die Datei wirklich einen mitbringt — ein Export von früher trug an jeder
Gruppe `draft`, und daraus sollen keine Einträge entstehen.

**Weitergeben beim Setzen:** „Das Setzen eines Status in einem übergeordneten
Knoten muss ähnlich funktionieren wie bei Windows: auch für Subitems? ja nein.“
Also kein Vererben, sondern ein Weiterreichen im Moment des Setzens: hat der Knoten
Subitems, fragt der Dialog „‹Status› setzen?“ mit dem Schalter „auch für die n
Subitems“ (Vorgabe: aus). Gezählt und geschrieben wird nur, wer den Status noch
nicht hat — eine Gruppe ohne gesetzten ist auch für `draft` offen. Einer wird
einzeln geschrieben, mehrere als Stapel (`web/src/status.js`, Prüfstand
`status-scope.test.mjs`). Ein Knoten ohne Kinder fragt nicht.

**Offen:** Rubriken bleiben aussen vor (Publikationsknoten, kein Lebenszyklus am
Markt) — weder im Wähler noch als Subitem.

## 34. DAM — die Bibliothek wird ein Bestand, nicht eine Liste (27.09.2026)

**Der Befund.** Was heute steht (20), ist eine sortierbare Liste mit Ordnerbaum und einer Zuordnung an den Knoten.
Das trägt ein PIM, für ein DAM ist es zu wenig: die Bibliothek weiss von einer Datei nur Hash, Grösse, Mime und
Name, an Metadaten gibt es zwei Attribute (`alt_text` je Sprache, `copyright`), und woher ein automatisch geholtes
Asset kam, steht nirgends.

**Nicht Gegenstand:** Videoumwandlung. Es geht um Bilder und Dokumente — darum DAM, nicht MAM.

### Der Grundsatz: gepflegt oder gemessen

Zwei Sorten Angaben, und sie gehen verschiedene Wege:

| | Beispiel | Eintrag | Kontingent |
|---|---|---|---|
| **gemessen** — Eigenschaft der Bytes | Mass, Auflösung, Farbraum, Seitenzahl, erkannter Text | eigener Typ, Art `Ops` | zählt **nicht** |
| **gepflegt** — Aussage eines Menschen | Alt-Text, Rechte, Stichwörter, Freigabe | `AttributeSet`, Art `Data` | zählt |

Der Grund ist nicht Ordnungsliebe: `AttributeSet` zählt gegen das Kontingent (`Kinds.cs`). Läse man EXIF von
50 000 Bildern als Attributwerte, verbrauchte das Auslesen das Kontingent des Kunden für Arbeit, die niemand
getan hat. Was aus der Datei kommt, ist darum nie ein `AttributeSet`. Übernimmt ein Mensch eine gelesene Angabe
in einen gepflegten Wert (IPTC-Urheber → `copyright`), ist *das* Pflege und zählt — zu Recht.

### Offene Posten statt Warteschlange — entschieden

Alle diese Arbeiten sind Serverarbeit an vielen Assets: Köpfe lesen, Ableitungen rechnen, Text ziehen, Texterkennung.
Ein Import von tausend Assets darf nicht darauf warten. Und ein Abbruch, ein Absturz, ein Neustart darf nichts
verlieren.

**Die Lösung braucht keine Warteschlange.** Die offene Postenliste ist eine *Frage an das Abbild*: offen ist, was
den Eintrag noch nicht hat. `Media.Unprobed()` sind die Medien ohne `MediaProbed`, `Media.Pending(preset)` die ohne
aktuelle Ableitung. Daraus folgt alles, was sonst gebaut werden müsste:

- **Wiederaufnahme** ist nichts, was es gibt — es gibt nur „noch offen“. Kein Zustand stirbt mit dem Prozess.
- **Neustart** ändert nichts: dieselbe Frage, dieselbe Antwort.
- **Doppelt arbeiten** ist ausgeschlossen: wer den Eintrag hat, ist nicht mehr offen.

**Ein Systemjob je Art von Arbeit** — nicht ein Sammeljob. Masse lesen ist `probe`, Ableitungen sind `derive`,
Texterkennung wird ein dritter. Damit nimmt Abbrechen nie fremde Arbeit mit: wer die Texterkennung anhält, hält
nicht das Lesen der Masse an. Geführt werden sie vom Tasker, der Anhalten, Fortsetzen, Abbrechen und Zeitplan
schon kann (`JobRunner.Pause/Resume/Cancel`); ein Lauf stirbt beim Anhalten nicht, er wartet beim nächsten Stapel.

**Ein Systemjob hängt nicht am Tarif** (27.09.2026). Im Betrieb gilt das signierte Tarifblatt, nicht das Saatgut in
`Tarife.cs` — ein Blatt, das einen neuen Systemjob noch nicht kennt, sperrte ihn sonst aus: in ⑁ Plugins stünde der
Tarif statt an/aus, und einmal ausgeschaltet liesse er sich nicht wieder einschalten. Darum erlaubt `Tarif.Erlaubt`
die Schlüssel aus `Tarife.Systemjobs` immer, unabhängig vom Blatt. Die Marke `system: true` im Manifest ist etwas
anderes: sie sagt dem Tasker, dass der Job dauerhaft in der Liste steht.

**Entschieden (27.09.2026): Abbrechen bei einem Systemjob heisst anhalten bis zum nächsten Start.** Der Job endet,
die Posten bleiben offen, der nächste Start nimmt sie wieder; der Knopf im Tasker bleibt, sein Text sagt genau das
(`abbruchText`). Ein „diesen Posten nie“ braucht es nicht: ein Bild, das der Leser nicht kennt, bekommt seinen Eintrag
mit Mass 0 × 0, ein Dokument ohne Text seinen Zustand `fehler` — beides ist erledigt, nicht offen.

### Gebaut am 27.09.2026 (Block A)

**`MediaProbed(Width, Height, Dpi?, Space?, Alpha?)`** — was im Kopf der Datei steht. Gelesen wird **im Server**
(`MediaProbe.cs`), ohne Paket: ein Dateikopf ist eine Handvoll Felder an festen Stellen. JPEG, PNG, GIF, WebP, BMP,
TIFF. Bei JPEG und TIFF tauscht die EXIF-Orientierung Breite und Höhe, damit die Bibliothek dasselbe Mass nennt
wie die Ableitung (`derive` dreht mit `rotate()`). Ein unbekanntes Format bekommt den Eintrag mit 0 × 0 — sonst
bliebe der Posten für immer offen und jede Runde läse ihn erneut; `again=true` liest diese erneut, wenn eine neue
Version mehr Formate kennt.

Damit ist das Mass des **Originals** überhaupt zum ersten Mal bekannt: bisher stand es nur an der Ableitung. Erst
dadurch lässt sich nach „mindestens 2000 px“ filtern.

**`MediaSourced(Plugin?, Profile?, Job?, Ref?, From?)`** — woher das Asset kam. Die Schnittstelle, das benutzte
Profil (`<dienst>:<name>`), der Job, der Bezug an der Quelle (Adresse, Dateiname, Kennung dort). Gesetzt vom
Importeur beim Anlegen, nicht von einem Menschen später; ein zweiter Eintrag **ergänzt** und löscht nichts.
`From` nennt das Medium, aus dem dieses entstand — ein Zuschnitt ergibt ein neues Medium, weil ein Medium
unveränderlich ist, und `From` hält die Abstammung fest. Das Importdatum steht nicht im Rumpf: es ist die Zeit
des Eintrags (`Medium.CreatedAt`, `CreatedBy`).

**Job `probe`** (Plugin, `system: true`, `progress: /api/media/probe`) treibt das Lesen in Runden an, bis nichts
mehr offen ist; der Server stösst ihn nach jedem Hochladen und Holen an. Neue Filter in der Liste: `minW`, `minH`,
`plugin` (`-` = von Hand hochgeladen), `from`/`to` über das Importdatum; neue Sortierung `pixels` und `created`.

### Reihenfolge der weiteren Blöcke

**B. Verschlagwortung und Facetten.** Stichwörter als Mehrfachwert am Medium (Werteliste im Modell, damit sie
gepflegt und übersetzbar sind), Facetten in der Bibliothek über Art, Mass, Datum, Herkunft, Stichwort, Rechtestand.
Dazu **Vorschläge**: bei automatischem Import pflegt niemand von Hand, also schlägt die Oberfläche vor — aus dem
Dateinamen, aus IPTC/XMP, aus dem Knoten, an dem das Asset hängt, und aus dem erkannten Text. Ein Vorschlag wird
erst ein Wert, wenn ihn jemand annimmt (dann zählt er auch).

**C. Ansehen und Öffnen.** Ein PDF bekommt eine Vorschau in der Oberfläche — der Browser kann PDF selbst, es
braucht kein Plugin dafür, nur den Rahmen um `GET /api/media/{id}/file`. Doppelklick öffnet das Asset in einem
neuen Fenster; was damit geschieht, entscheidet das Betriebssystem des Anwenders.

**D. Zuschnitt und Ausrichten — gebaut (27.09.2026).** Im Browser auf einer Leinwand (`CropEditor.vue`), so wie
dieser Browser schon die Kacheln rechnet. Zwei Drehungen, weil sie zwei Dinge sind: ⟲ ⟳ in Vierteln für ein quer
stehendes Foto, ein feiner Winkel (±15°) zum Ausrichten eines schiefen Scans. Der Ausschnitt gilt im gedrehten
Bild in Pixeln des Originals; gerechnet wird in voller Auflösung, die Vorschau ist nur verkleinert. **Ein Medium
ist unveränderlich** — das Ergebnis ist ein **neues** Medium, hochgeladen mit `from` = Original (`MediaSourced.From`,
die Abstammung), im Format des Originals, wenn der Browser es schreibt (JPEG, PNG, WebP), sonst PNG. Wahlweise
ersetzt es das Original gleich als neue Version (F) — dann wandern die Zuordnungen. Offen bleibt der *nicht
zerstörende* Zuschnitt (ein Rechteck am Medium, das die Presets anwenden — „quadratische Kachel ohne
abgeschnittenen Kopf“): ein eigener Eintragstyp und eine Änderung an `derive`, die nur mit Siegel geht.

**E. Belege ins DAM — gebaut (27.09.2026).** Bis dahin legte der Erzeuger das Datenblatt als Medium an und hängte
es per `VersionDocumentAdded` nur an die **Version**: in der Bibliothek ohne Ordner und Herkunft, am Produkt gar
nicht. Jetzt bekommt der Beleg im selben Zug (`VersionApi.BelegInsDam`) seine Herkunft (`MediaSourced`, Plugin =
Erzeuger, Bezug = `version:<knoten>/<nr>`), den Ordner „Belege" (angelegt, wenn er fehlt — ein schon gewählter
Ordner bleibt) und die Zuordnung am Knoten (`image` für ein Bild, sonst `document`; gibt es sie schon, ist das
kein Fehler). Was davon nicht geht, hält den Beleg nicht auf — der Eintrag an der Version bleibt die Wahrheit,
die Hinweise gehen an den Erzeuger zurück. Die Zuordnung zählt als Pflege, die Herkunft nicht.

**F. Versionen — gebaut (27.09.2026).** „Ein neues Bild ist ein neues Medium“ bleibt richtig. „Dieses ersetzt
jenes“ ist ein Eintrag am Vorgänger (`MediaSuperseded {by}`, Art Datenpflege). Der Befehl dazu
(`Commands.SupersedeMedium`, `POST /api/media/{id}/supersede`) legt im selben Zug je Zuordnung eine neue am
Nachfolger an — gleicher Typ, gleicher Knoten, dieselben Werte (Reihenfolge, Verwendung, Vererbung, Stopp) — und
löst die alte; der Nachfolger bekommt `MediaSourced.from` auf den Vorgänger, die Abstammung ist in beide
Richtungen lesbar. Der Vorgänger **bleibt im Abbild**: Belege, Versionen und die Ausleitung von damals nennen ihn
weiter und lösen ihn auf. Nur die Bibliothek bietet ihn nicht mehr an (`Media.Current`; `?superseded=true` zeigt
ihn). Ein Vorgänger wird nur einmal abgelöst, ein Nachfolger darf nicht selbst abgelöst sein — eine Kette
a → b → c entsteht, indem b später selbst abgelöst wird. In der Bibliothek: Kontextmenü „Neue Version
hochladen …“ (Datei → Medium → ersetzen), rechts „ersetzt durch“ und „ersetzt“ als Sprung.

**G. Rolle und Reihenfolge am Produkt — Reihenfolge gebaut (27.09.2026).** Berichtigung: die Gruppe
`relation_media` trug schon `position` (Reihenfolge, Zahl) und `usage` (Verwendung, Text), nicht nur `inherit`
und `stop`, und die Kacheln am Knoten sortierten nach `position`. Was fehlte, war die Bedienung: die Reihenfolge
liess sich nur als Zahl tippen. Jetzt ziehen die Kacheln — beim Ablegen bekommt jede ihre Nummer 1 … n,
geschrieben wird nur, was sich ändert; die erste ist als solche gekennzeichnet (①), die Ausleitung nimmt sie als
Hauptbild. Offen: `usage` ist Freitext. Eine Werteliste (Hauptbild, Detail, Verpackung, Zeichnung) liesse Exporte
die Rolle zuverlässig lesen — aber der Typ eines bestehenden Attributs ändert sich nicht ohne Weiteres, und die
Werte, die in Anlagen schon als Text stehen, müssten mit. Das ist eine Entscheidung, keine Kleinigkeit.

**H. Rechte und Fristen — gebaut (27.09.2026).** Entschieden nach der Vorlage: **`download`** ist ein Recht
(„Herunterladen“). Es braucht, wer die Datei selbst, ein Preset oder einen Blob lädt (`Auth.IstDatei`); Kachel,
Angaben und Listen sieht, wer liest. **Wer pflegt, lädt** — die Regel steht im Kern (`Rights.Implies`,
`Rights.Effective`), nicht in den Rollen; die Regel „wer Anwender verwaltet, führt Teams“ ist dorthin gezogen.
Der Leser aus dem Saatgut lädt nicht. Jobs laden (`ServiceRights`), sonst rechnete kein Job eine Vorschau. Die
Oberfläche zeigt ohne das Recht weder Datei-Link noch PDF-Rahmen noch Zuschnitt — kein gesperrter Knopf, der Weg
fehlt. **Fristen:** `valid_from`, `valid_until` (Datum), `licence` (Werteliste, beginnt leer), `source` (Text) in der
Gruppe `media`. Die Regel `Medium.GueltigAm(tag)` beantworten Bibliothek (`valid`, `expired`, Facette
„abgelaufen“, Filter `valid=yes|no|expired`), Knoten (⌛ an der Kachel) und Relationen (`RelationEnd.Valid`) gleich.
**Gebaut (27.09.2026):** ein abgelaufenes Bild fällt aus der Ausleitung — `GET /api/nodes/{id}/relations?export=true`
lässt es weg, `xport` und `rag` fragen so (siehe I: `RelationView.Ausleitbar`). Rechte je Ordner: gebaut, siehe H.

**H, Nachtrag — Rechte je Ordner gebaut (27.09.2026), zusammen mit „Rollen je Teilbaum“.** Ein Ordner der Bibliothek
nennt Rollen, die ihn sehen (`MediaFolderRestricted {roles[]}` am Ordnerstrom, 🔒 am Ordner); das gilt für seine
Unterordner und die Medien darin, bis ein Unterordner eigene nennt. Dieselbe Mechanik am Baum: `NodeRestricted` am
Knoten („Sichtbar für Rollen …“ im Kontextmenü), ab dort abwärts. Leer = für alle. Administratoren (Recht `users`)
und der Dienst der Jobs sehen immer alles; ohne Anmeldung gilt nichts davon. Die Sperre sitzt zentral: ein Knoten,
Medium oder Ordner, den die Rolle nicht sieht, ist 403 (`Auth.Sichtbar`, jeder Pfad), und die Listen filtern in
derselben Sicht (`Auth.Sicht`: Baum, Suche, Bibliothek, Facetten, Ordner, Relationen, Verwendung). Kein gesperrter
Abschnitt, kein Hinweis auf Verborgenes — wer es nicht sieht, sieht es nicht.

**I. Workflows für Assets — gebaut (27.09.2026), Weg (a).** Derselbe Workflow: `roles` darf `media` enthalten —
**nur ausdrücklich**, eine leere Liste heisst „alle Pflegeknoten“, nicht „auch jedes Bild“ (`WorkflowDef.AppliesToMedium`;
der Designer bietet „▩ Asset“ an und behält die Knoten, wenn er es zu einer leeren Liste zufügt). Der Zustand steht am
Medienstrom (`WorkflowStateSet` auf `m-…`), das Abbild kannte den Weg schon; ein zurückgezogenes Medium nimmt seinen
Zustand mit. Kein neuer Eintragstyp. Der Schritt (`Commands.WorkflowStepMedium`, `POST /api/media/{id}/workflow/{wf}/{t}`)
prüft Übergang, Rolle, Eskalation und Notizpflicht wie am Knoten — ohne Vater (kein Erben), ohne Blocker und **ohne
Wirkungen**: `release`, `revoke`, `status`, `translate` sind Knotensache; die Oberfläche sagt es am Knopf („am Asset
ohne Wirkung“). Zuständiger wie am Knoten (`…/assign`). Bibliothek: Abschnitt ⚑ Workflow rechts, Facette je
Zustand (`state=<wf>:<zustand>`), Fahne in der Farbe des Zustands an der Kachel. **Gebaut (27.09.2026):** die
Brücke zu Import und Export — `WfTransition.Job` nennt einen Job des Tasker, und nach einem gelungenen Schritt startet
er (`WorkflowApi.Nachlauf`, am Knoten wie am Asset; läuft er schon, findet er den neuen Stand in seiner nächsten Runde;
ein Fehler beim Start hält den Schritt nicht auf). In den Workflow-Einstellungen steht er als Spalte „⏱ Job“ je
Übergang. **Gebaut (27.09.2026):** ein nicht freigegebenes Bild wird nicht
ausgeleitet — `RelationEnd.Released` (jeder Medien-Workflow am Medium in einem Endzustand, `MediaWorkflowApi.Freigegeben`)
neben `Valid` (Frist), und `GET /api/nodes/{id}/relations?export=true` lässt Medien weg, die eines von beidem nicht
sind (`RelationView.Ausleitbar`) — in `out` wie in `inherited`. Die Erzeuger fragen so (`xport`, `rag`); die Pflege
fragt ohne `export` und sieht alles. Ohne Medien-Workflow ist jedes Medium freigegeben; sobald einer für Assets gilt,
ist der Startzustand nicht frei — das ist der Sinn eines Freigabe-Workflows.

**J. Texterkennung (OCR) — gebaut (27.09.2026).** Der Volltext liegt **je Medium** (`DocText.cs`, `media_text`), und
der Zustand `scan` bedeutet „ohne Textebene — wartet auf OCR“. `GET /api/docs/scans` ist die offene Postenliste:
Dokumente in diesem Zustand mit dem Hash, den der Index kennt (`DocsApi.Scans`) — eine Frage an den Index, kein
Bestand. Der Erkenner ist das Plugin `ocr` (`plugins/ocr`): ein Job, der die Datei lädt, die Seiten rendert
(`pdfjs-dist`, `@napi-rs/canvas`), sie lokal erkennt (`tesseract.js`, Sprachen als Parameter, Vorgabe `deu+eng`) und
aus Zeilen und Wortkästen dieselben Abschnitte und Tabellen baut wie der Leser (`../docs/core.mjs`: `cellsOf`,
`findTables`) — der Zellenabstand folgt der mittleren Zeichenbreite der Seite, denn die Erkennung misst in Pixeln.
Abgelegt wird mit `PUT /api/docs/{id}`, `state: text`, `note: "ocr · Vertrauen n %"`; ein Dokument ohne erkennbaren
Text wird `fehler` mit dem Grund, damit es nicht in jeder Runde wiederkommt (`/docs/retry` gibt es frei). Die
Sprachdaten kommen beim ersten Lauf nach `plugins/ocr/.cache` (Volume). Kein Systemjob: die Erkennung ist teuer und
eine Entscheidung je Anlage. Damit wird ein gescanntes Datenblatt durchsuchbar, einbettbar (35) und seine Tabellen
werden Attribute (L). **Bilder** kommen ausdrücklich: das gesäte Stichwort „Text erkennen“ (`ocr`, Werteliste `keyword`) stellt ein Bild in
die Liste der Texterkennung (`DocsApi.IstScan`), solange der Index es nicht zu seinem Hash kennt; der Zähler in
⌕ Dokumente zählt sie mit. Der Leser nimmt weiterhin nur Dokumente (`Readable`) — jedes Bild zu erkennen kostet viel
und bringt bei Produktfotos nichts.

**K. Ablegen auf einem Knoten.** Heute nimmt der Baum nur JSON und Tabellen an (`TreeView.vue`); ein Bild oder PDF
auf einen Knoten gezogen bringt „Kein Importer für …“. Zu bauen: ein Asset, das auf einen Knoten fällt, wird
angelegt, verarbeitet (Masse, Ableitungen, Text) **und** dem Knoten zugeordnet. Das ist der kürzeste Weg von der
Datei zum Produkt und sollte der erste Block der Oberfläche sein.

**L. Werte aus einem Dokument — gebaut (27.09.2026, Text gegen das Modell und Rechtsklick 28.09.2026).** Die
Konzeption in einem Satz: **für jeden gefundenen Wert wird nach Best Guess ein bestehendes Attribut vorgeschlagen;
gibt es keines, lässt es sich neu anlegen und einer Attributgruppe zuordnen — einer bestehenden oder einer neuen —, und
die Gruppe kommt an den Knoten oder an eine Ebene darüber.** Ein Dokument am Knoten wird also nicht nur angehängt,
sondern **ausgewertet**, aus zwei Quellen in einer Liste: **Tabellen** darin werden Zeilen Schlüssel/Wert; der
**Text** geht gegen die Attribute, die an diesem Knoten gelten, und die KI nennt je Attribut Wert, Seite, Stelle und
Sicherheit, dazu alles Weitere als Bezeichnung/Wert. Es läuft nie ohne Bestätigung: ein falsch erkanntes Attribut ist
teurer als ein nicht erkanntes.

Zwei Wege hinein, derselbe Dialog dahinter:

- **Ziehen mit Strg** auf einen Knoten (Baum oder Medienband): die Datei wird ein Asset (K) — mit Strg merkt sich der
  Baum die Dokumente samt Namen (`store.pendingDocTables`) und springt zum Knoten; das Medienband öffnet den Dialog
  direkt.
- **Shift beim Ablegen** auf eine Gruppe oder ein Produkt: je Dokument ein **neuer Knoten darunter** — Produkt unter der
  Gruppe, Variante unter dem Produkt (nur ohne Achsen; eine Variante mit Achsen braucht Achsenwerte) —, benannt nach
  der Datei ohne Endung, mit dem Dokument als Asset. Ein Stapel je Knoten (`product.create`/`variant.create`,
  `node.rename` über `@n`), dann das Asset. Ein Dokument: der Baum springt hin und öffnet die Auswertung; mehrere: er
  bleibt stehen und zählt. Was kein Dokument ist, legt keinen Knoten an.
- **Rechtsklick auf ein Asset** im Band der Knotenansicht — oder auf mehrere, mit Strg+Klick gewählte. Ein Datenblatt
  liegt meist längst am Knoten; es noch einmal zu ziehen, nur um die Auswertung zu starten, legte ein zweites Asset
  an. Mehrere zusammen sind ein Fall: Datenblatt und Massblatt desselben Produkts ergeben **eine** Liste, die Quelle
  je Zeile nennt das Dokument. Bilder haben keinen Text — an ihnen ist der Eintrag gesperrt. Dasselbe Menü löst
  Zuordnungen, einzeln oder für die Auswahl.

Die Schritte, wie sie stehen:

1. **Anhängen** (K), wenn die Datei neu ist — beim Rechtsklick entfällt das.
2. **Tabellen finden** — Teil von `docs`, nicht ein eigenes Plugin: ein Dokument wird einmal gelesen. Der Leser behält
   je Textstück die x-Lage; ein Sprung nach rechts trennt Zellen (`cellsOf`), drei oder mehr Zeilen Schlüssel/Wert
   hintereinander sind eine Tabelle, die Überschrift davor gehört dazu (`findTables`); bei Textdateien gilt „Schlüssel:
   Wert“ (`pairsFromText`). Die Tabellen liegen neben dem Text (`media_table`, `DocText.Table`), abgeleitet wie er, und
   kommen mit demselben `PUT /api/docs/{id}` (`tables`). `GET /api/docs/{id}/tables` liefert sie mit dem Zustand des
   Index; **ohne Zustand ist das Dokument noch nicht gelesen** — der Dialog stösst dann den Job des Plugins `docs`
   einmal an (`POST /api/jobs/{key}/run`) und fragt alle drei Sekunden nach, bis zu zwei Minuten. Der Job läuft im
   Hintergrund; der Dialog wartet auf ihn, nicht der Anwender.
3. **Zuordnen** — der Mapper hat die Lage „Schlüssel/Wert“ (`suggestPairs`): derselbe Vorschlag wie je Spalte
   (Schlüssel, Bezeichnung, Synonym, Ähnlichkeit), die Einheit aus dem Wert (`splitUnit`: „22 mm“ → 22, `mm`, nur
   wenn das Modell die Einheit kennt), der Typ aus dem Wert, der Wert umgeformt und geprüft. Schlüsselspalten (Id,
   Elternteil, Status) gibt es in dieser Lage nicht. Passt der Wert nicht zum geratenen Typ, wird das Attribut Text.
   Eine **Zahl mit einer Einheit, die das Modell nicht kennt** („104 Hz“), wird für ein neues Attribut trotzdem eine
   Zahl: Einheit `Hz`, gekennzeichnet als neu, angelegt beim ✓ (`ensureUnit`, Schlüssel ist das Symbol) — vorher war
   das Text, und am ersten Datenblatt waren es siebzehn Textattribute für Watt, Hertz und Volt. „560 Stk.“: der Punkt
   gehört nicht zur Einheit. Eine **Aufzählung** („EN 55015, EN 61000-3-2, …“ — zwei oder mehr kurze Glieder) wird
   eine **Werteliste**, mehrwertig: beim ✓ die Liste unter dem Schlüssel des Attributs, ihre Werte aus dem Dokument,
   das Attribut `enum` darauf, der Wert als `values`. Der Typ eines neuen Attributs lässt sich im Dialog umstellen —
   `enum` macht aus dem Wert eine Liste, jeder andere Typ formt ihn um. Beim Öffnen holt der Dialog das Modell frisch
   (`store.poll(true)`): der zweite Lauf über dasselbe Dokument kennt die Attribute des ersten und schlägt sie vor.
   **Was die bezahlte KI tut, ist magenta** (`--ai`, Klasse `ai`): die ✦-Zeilen, der Lauf, die Knöpfe der
   Prüfmaschine, geo und xliff — Prüfstand `ui-ki-farbe`.
4a. **Text gegen das Modell ohne KI** (▦ Zeile, ⌕ Sinnsuche; 28.09.2026) — bei einem Datenblatt steht der Wert in
   derselben Zeile wie sein Schlüssel, und die Zellen sind seit dem 28.09. mit Abstand getrennt. Je Attribut, das hier
   gilt, die Zeile im Text, deren Schlüssel Bezeichnung, Attributschlüssel oder ein Synonym des Mappers trifft
   (gleich, beginnt damit, ähnlich ≥ 0,72) — der Rest der Zeile ist der Wert, mit Einheit abgetrennt, umgeformt,
   geprüft. Dazu die **Spaltentabelle**: ist der Attributname eine Zelle eines Kopfs („Typ  Artikelnummer“), steht
   der Wert in derselben Spalte der Wertzeile — die kommt oft Zeilen später, weil der Kopf umgebrochen ist
   („Verpackung“, „Karton“, … je eine Zeile); gesucht wird bis zwölf Zeilen voraus nach einer Zeile mit genügend
   Zellen. Eine **EAN** ist dreizehn Ziffern mit Prüfziffer, irgendwo im Text. Der **Name** kommt aus der Spalte
   „Typ“ einer Tabelle — die Typenbezeichnung; die erste Überschrift war es nicht, die hiess am ersten Datenblatt
   „Gewicht“. Ein Wert, der mit einem Vergleichszeichen endet („tc/ta für ≥“), ist ein Kopf. Prüfwerkzeug:
   `node plugins/docs/zeilen.mjs <datei.pdf>` zeigt die Zeilen, wie der Leser sie in den Index legt. Die Suche (⌕) braucht
   ≥ 0,6, einen Wert, der einer ist, und schlägt einer Werteliste nichts Neues vor. Die Werte stehen nach Attribut
   sortiert; die Quelle nennt die Seite. Für Attribute ohne Zeilentreffer eine Frage je Attribut an `GET /api/docs/search?mode=hybrid&under=
   <knoten>` (Wörter, und Vektoren, wenn `embed` läuft): im gefundenen Abschnitt die passendste Schlüssel/Wert-Zeile,
   ab 0,5, mit der Sicherheit, die sie hat — „Nennmasse: 1,5 kg“ für Gewicht. Ein Zahlenattribut nimmt die Zahl
   aus dem Wert („pro Stk.  0,105 kg“ → 0,105); ohne Zahl (ein Tabellenkopf, eine Nebenzelle) gibt es keine Zeile —
   ein falscher Vorschlag ist schlechter als keiner. Findet ohne Kosten, was zu finden ist;
   was Zeile und KI beide finden, ist derselbe Wert oder ein Widerspruch (5).
4. **Text gegen das Modell** (✦) — nur mit KI-Schlüssel am Team, und **nur auf Knopfdruck** („✦ KI fragen“, magenta,
   bereit, sobald der Text da ist): was Token kostet, läuft nicht von selbst (28.09.2026). Sonst bleibt es bei 2, 3
   und 4a. Die Attribute, die an
   diesem Knoten gelten (die aktiven Gruppen am Pfad, `node.groups`), und der Text des Dokuments
   (`GET /api/docs/{id}/text`, mit Seitenmarken, bis 60 000 Zeichen — ein Datenblatt hat wenige Seiten, ein Katalog
   nicht) gehen einmal je Dokument an die KI; sie antwortet je Attribut mit Wert, Seite, Stelle (wörtlich) und
   Sicherheit — und dazu **alle weiteren technischen Daten** als Bezeichnung/Wert (auch aus Tabellen und Massangaben
   in Zeichnungen). Ohne das fand die KI an einem Knoten mit drei Attributen drei Werte, während das Datenblatt
   zwanzig hatte. Dazu bekommt sie **alle Attribute des Modells** (Schlüssel und Bezeichnung, im gecachten Systemtext)
   und nennt den Schlüssel, wenn es die Sache schon gibt — sonst hiess „Lampenwattage“ beim zweiten Lauf
   „Lampenleistung“, und es entstanden zwölf Attribute für Werte, die es schon gab. Ein genannter Schlüssel gilt; ohne
   geht die Zeile durch den Mapper wie eine Tabellenzeile (3), aber nur über Schlüssel, Bezeichnung und Synonym — ein
   reiner Ähnlichkeitstreffer („λ bei 50 Hz“ ≈ „Strom bei 50 Hz“) zählt bei einer KI-Zeile nicht, sie kannte die
   Liste. Das Ziel bleibt wählbar. Der Wert wird wie bei 3 umgeformt und geprüft; eine
   Einheit im Wert („35 W“) stört nicht. Ein Attribut, das am Knoten
   schon einen eigenen Wert hat, bleibt ohne Haken: der Anwender entscheidet, nicht der Vorschlag. Das Attribut einer
   ✦-Zeile steht fest — die KI hat es ja gegen genau dieses Attribut gelesen.
   **Textbausteine** (▤) — die dritte Quelle, ohne KI: jeder Abschnitt mit Überschrift aus dem Index
   (`GET /api/docs/{id}/text`), aufeinanderfolgende unter derselben Überschrift zusammen, zu kurze nicht. Ein
   Abschnitt wie „Funkentstörung“ mit acht Punkten hat keinen Wert, aber einen Platz am Produkt: als `html`-Attribut
   (mit Sprache), neu unter dem Schlüssel der Überschrift oder in ein bestehendes Textattribut — Aufzählungspunkte
   werden eine Liste, der Rest Absätze. Eigene Zeilengruppe unter den Werten, **keine Zeile trägt einen Haken**: bei
   einem 40-seitigen Katalog wären das 40 Textattribute, die niemand will; bei einem Datenblatt sind „Montage“,
   „Funkentstörung“, „Normen“ genau die drei, die auf die Produktseite gehören. Man nimmt, was gehört — mit einer
   Ausnahme: trifft der Baustein ein **vorhandenes** Attribut, das hier noch leer ist, ist er angehakt; das Modell
   sagt, das Produkt hat es, das Datenblatt liefert es.
    **Eine Aufzählung wird eine Werteliste** (9): die Punkte unter „Funkentstörung“ sind keine Absätze, sondern Sätze,
   die man je Produkt auswählt. Die Überschrift sucht ein Attribut (Mapper) — trifft sie eine mehrwertige Liste,
   geht jeder Satz gegen deren Werte: gleich oder normalisiert gleich, bei Sätzen auch ähnlich (≥ 0,72; „bitte nicht
   kreuzen“ trifft „nicht kreuzen“), sonst neu mit einem Schlüssel aus dem Text. Beim ✓ kommen die neuen Sätze in die
   Liste (`PUT /api/model/lists/{key}/values`), der Wert sind die Schlüssel. Ohne passendes Attribut: neu als `enum`
   mehrwertig mit eigener Liste, umstellbar auf `html`. Dasselbe gilt für Aufzählungen in Werten („Normen“) und für
   jede Zeile, deren Ziel ein enum-Attribut ist: was in der Liste fehlt, wird nachgetragen — nicht abgelehnt.
   **↻ neu lesen** im Kopf des Dialogs löscht den Eintrag im Index und lässt den Job das Dokument neu lesen — nötig,
   wenn der Leser sich geändert hat (Tabellen seit 27.09., Zellen mit Abstand seit 28.09.) und der Index den alten
   Stand hält. Ein neues html-Attribut aus einem Baustein bekommt die Sprachachse (`axes: ['locale']`).
   **In der Zelle** eines mehrwertigen Listenattributs ändert ✎ den Text eines Werts (Modell-Recht, die anderen
   Sprachen bleiben) — bei einer Liste aus Sätzen ist die Zelle der Ort, an dem der Tippfehler auffällt.
5. **Bestätigen** — `DocTables.vue`: je Zeile Haken, Schlüssel und Rohwert (bei ✦ die Stelle) aus dem Dokument, die
   Quelle (▦ Tabelle oder ✦ KI, Seite, Sicherheit; das Dokument und die Stelle im Tooltip), das Attribut (gefunden,
   „+ neu: key“ oder nichts), Typ und Einheit eines neuen, der Wert, wie er geschrieben wird, und der Grund.
   **Zielen zwei Zeilen auf dasselbe Attribut**, kommt es auf den Wert an: derselbe Wert ist kein Widerspruch — beide
   bleiben angehakt, geschrieben wird einmal, mit dem Beleg der ersten; verschiedene Werte tragen keinen Haken, jede
   Zeile nennt den anderen Wert (≠), und der Anwender wählt — hakt er eine an, verliert die andere den Haken. Der
   Dialog entscheidet das nicht vorab. **Neue Attribute brauchen eine Gruppe und eine Ebene**: unten steht die
   Gruppe zur Wahl — eine des Modells oder „+ neue Gruppe“ mit Namen; Vorgabe ist `from_document` („aus Dokument“),
   wenn es sie gibt. Gilt die Gruppe am Knoten noch nicht, steht daneben der Pfad von der Wurzel bis hierher als
   Ebene, an die sie kommt — Vorgabe der Knoten selbst; weiter oben gilt sie für alles darunter („Elektrik“ an die
   Produktgruppe, und jedes Produkt darunter hat die Attribute). Eine Gruppe für alle neuen Attribute eines Laufs,
   nicht je Zeile — eingeordnet wird später im Modell. Erst ✓ schreibt, in dieser Reihenfolge:
   `PUT /api/model/groups/{key}`, wenn die Gruppe neu ist; `PUT /api/model/attributes/{key}` je neuem Attribut
   (Modell, zählt nicht) in dieser Gruppe; dann `PUT /api/nodes/{ebene}/groups`, wenn die Gruppe am Pfad noch nicht
   gilt — an einer Ebene darüber wird vorher gelesen, was dort hängt, denn `GroupsAttached` ist die ganze Liste; dann
   **ein Stapel**
   (`POST /api/batch?skipErrors=true`, Pflege, zählt): je Wert `attribute.set` und direkt dahinter der **Beleg**
   `value.source` — Quelle ist der Name des Dokuments, Titel die Seite, Notiz die Stelle (▦: die Überschrift der
   Tabelle; ✦: das Zitat und die Sicherheit), Weg `import` (▦) oder `ai` (✦). Was der Server ablehnt, steht als
   Meldung je Zeile, der Rest wird geschrieben.

Offen: Tabellen mit mehr als zwei Spalten (Varianten je Spalte) werden heute als Schlüssel plus zusammengezogener Wert
gelesen; eine Zuordnung Spalte → Variante wäre der nächste Schritt. Ein Bild von einer Tabelle (Scan) braucht erst die
Texterkennung (J). Und ein zweites Datenblatt am selben Knoten ergänzt die Vorschläge des ersten nicht — jeder Aufruf
des Dialogs ist eine eigene Liste; was übernommen wurde, steht am Wert als Beleg.

### Semantische Suche

Volltext (Postgres `tsvector` je Medium, `DocText`) findet Wörter, Zahlen, Normen und Kennungen. Alles, was Sinn
meint, steht in 35.

### Das Datenblatt daneben — Fundstelle im PDF (29.09.2026, Stufe 1 gebaut)

Der Datenblatt-Dialog zeigt das PDF verkleinert neben der Analyse (`PdfPane`, pdf.js im Browser). Ein Klick auf eine
ermittelte Zeile („Im Dokument“) springt zur Seite und zeichnet einen Kasten um die Fundstelle. Die Lage kommt aus der
**Textschicht von pdf.js** — den echten Glyph-Positionen, denselben Koordinaten wie beim Lesen (Plugin docs); **welche**
Stücke der Kasten umfasst, sagt `pdf-locate` (reine, geprüfte Logik): whitespace-unempfindlich, mit Rückfall auf die
erste Hälfte des Zitats. pdf.js wird verzögert geladen (eigener Chunk); im Test ist `PdfPane` gestubbt, es lädt also nie.

**Offen (Stufe 2).** Für pixelgenaue Kästen unabhängig vom Text-Match müsste die Extraktion die Koordinaten je Zelle
persistieren — heute wirft `layoutDocument` sie weg (nur `{ page, heading, header, rows }` als Text), obwohl `tables()`
sie kennt —, über einen Endpunkt ausliefern und die Ansicht sie als Overlay zeichnen. Ein Umbau bis in die Datenhaltung
(DocText/Postgres); nachziehen, falls die Textschicht-Disambiguierung in echten Datenblättern nicht reicht.

## 35. Vektoren — Suche nach Sinn, Frage an die Dokumente, ähnliche Knoten (27.09.2026)

**Entschieden und gebaut.** Drei Entscheidungen davor: das Paket wechselt auf das Image `pgvector/pgvector:pg18`
(PostgreSQL 18 mit der Erweiterung `vector`); das Modell läuft **lokal** in einem Prozess-Plugin, nicht bei einem
Anbieter — kein Schlüssel, kein Volumen, dafür Rechenzeit auf dem Server; und der Umfang ist voll: Dokumente, Knoten,
die Frage an die Dokumente.

**In Worten, bevor es technisch wird.** Eine Einbettung ist eine Liste von Zahlen, hier 384, die ein Modell aus einem
Text rechnet. Sie ist die Lage des Textes in einem Raum der Bedeutungen: zwei Texte, die dasselbe meinen, liegen dort
nah beieinander, auch wenn sie kein Wort teilen; zwei, die nichts miteinander zu tun haben, liegen fern. „Nah“ heisst
ein kleiner Winkel zwischen den beiden Zahlenreihen (Kosinusabstand, 0 = gleich, 1 = ohne Bezug); die Vektoren des
Modells sind auf Länge 1 normiert, darum ist der Kosinus dasselbe wie das Skalarprodukt. Eine Suche nach Sinn ist
darum keine Frage „gefunden oder nicht“, sondern „wie nah“ — sie hat immer Treffer, auch schwache, und die Oberfläche
zeigt die Nähe als Prozent. Die 384 kommen vom Modell: `multilingual-e5-small` hat 384 Ausgänge; ein grösseres Modell
hätte 768 oder 1024, wäre etwas genauer und mehrfach so teuer in Zeit und Platz. Für Datenblätter und Produktnamen
reicht klein, und klein läuft auf jedem Server ohne Grafikkarte.

**Das lokale Modell: was es ist, woher es kommt.** Es ist keine Chat-KI, sondern ein Einbettungsmodell — es antwortet
nicht, es misst. Technisch eine ONNX-Datei (quantisiert, etwa 120 MB) mit Wortschatz und Tokenizer, gerechnet in
Node über `@huggingface/transformers` mit der eingebauten ONNX-Laufzeit (CPU). Es wird **nicht mit journali
ausgeliefert**: der erste Lauf des Jobs `embed` holt es vom Hugging-Face-Hub nach `plugins/embed/.cache` (im Paket
das Volume `journali-embed-cache`); danach liest jeder Start es von dort, ohne Netz. Ein Server ohne Netz bekommt das
Verzeichnis kopiert. Der Name des Modells steht am Server (`JOURNALI_EMBED_MODEL`) und am Job (`model`), beide
gleich; ein anderes Modell rechnet alles neu, weil seine Zahlen nicht in denselben Raum fallen. Dasselbe Muster gilt
für die Texterkennung: `tesseract.js` holt die Sprachdaten (`deu`, `eng`) beim ersten Lauf nach `plugins/ocr/.cache`.
Nur die **Frage an die Dokumente** ist eine Chat-KI — und die ist nicht lokal, sondern der Schlüssel des Teams.

**Wege, die erwogen wurden, und warum nicht.**

- *Einbettungen bei einem Anbieter (OpenAI, Embeddings-Endpunkt) über den Schlüssel des Teams.* Wäre die kleinere
  Änderung im Server gewesen (ein Endpunkt neben `/ai/ask`). Verworfen, weil ohne Schlüssel nichts testbar wäre,
  jede Einbettung Volumen kostet und ein Bestandswechsel des Anbieters alle Vektoren entwertet. Der Anbieter kann als
  zweiter Weg dazukommen: der Job müsste nur einen anderen `embed()` rufen.
- *Ein fremder Vektor-Store (der Export des Plugins `rag`).* Der Export bleibt und gibt jetzt auch den Text der
  Dokumente mit. Als einziger Weg verworfen, weil dann die Suche nach Sinn nicht in journali stattfände — sie
  gehört neben den Volltext, in dieselbe Datenbank, mit denselben Rechten (Sichtbarkeit je Rolle gilt auch hier).
- *Das Modell im Server rechnen (ONNX-Laufzeit als NuGet-Paket).* Verworfen: ein weiteres Paket im Server wäre eine
  Entscheidung gegen die Regel „Pakete nur für Protokolle“, und das Modell gehört dem Plugin, das auch den Stapel
  rechnet — zwei Laufzeiten für dasselbe Modell wären eine Quelle von Abweichungen.
- *Die Frage je Suche über einen Job einbetten.* Ein Prozessstart mit Modellladen je Frage, ein bis zwei Sekunden.
  Verworfen für den vorgehaltenen Kindprozess (`Embedder.cs`), der das Modell einmal lädt und je Zeile antwortet —
  die eine dokumentierte Ausnahme von „Plugins nur über /api“.
- *Treffer nach Wert mischen (Volltext-Rang und Kosinusabstand addieren).* Verworfen, weil die zwei Skalen nichts
  miteinander zu tun haben; Reciprocal Rank Fusion zählt je Reihe nur den Platz.
- *Eine feste Dimension an der Spalte (`vector(384)`).* Verworfen, weil das Modell wechseln darf; darum eine
  Spalte ohne Dimension, das Modell je Zeile und je Modell ein Teilindex über den Ausdruck `embedding::vector(N)`.
- *Bilder einbetten.* Ein anderes Modell (Bild zu Vektor, mehrsprachig zu Text). Nicht verworfen, nur nicht gebaut:
  ein eigener Schritt mit eigenem Modell und eigener Entscheidung.

**Was ein Vektor ist und wo er liegt.** Je Abschnitt eines Dokuments (`media_text`) und je Pflegeknoten in der
Leitsprache eine Einbettung: `media_vector (media, sha256, seq, model, embedding)`, `node_vector (node, locale, hash,
model, embedding)` — `Vectors.cs`. **Abgeleitet** wie der Text: aus Text und Modell jederzeit neu zu rechnen, darum
eigene Tabellen neben dem Journal, nie ein Eintrag. Die Spalte `embedding` hat keine feste Dimension; das Modell
steht je Zeile, gesucht wird nur unter dem eigenen (`Xenova/multilingual-e5-small`, 384 Dimensionen; ein anderes
Modell rechnet alles neu). Ohne Erweiterung ist der Server nicht kaputt: `Vectors.Ready` ist falsch, der Grund steht
in der Antwort, die Wortsuche läuft weiter.

**Wer rechnet.** Das Plugin `embed` (`plugins/embed`, `@huggingface/transformers`, ONNX, `dtype q8`). Zwei Prozesse
aus demselben Modul:

- **Der Job** (`job.mjs`) ist ein Systemjob wie `probe`: `GET /api/docs/embed/pending` nennt die offenen Posten —
  Abschnitte ohne Vektor zu ihrem Hash und Modell, Knoten, deren Text (`NodeText.Of`) einen anderen Hash hat als der
  eingebettete, dazu Knoten, die es nicht mehr gibt —, der Job bettet in Stapeln von 16 ein und schreibt
  `PUT /api/docs/embed`. Die Liste ist eine Frage an die Tabellen, kein Bestand: ein abgebrochener Lauf lässt sie
  offen, der nächste findet dieselben. Anhalten über `/signal` wie bei `probe`. `GET /api/docs/embed` zählt (`offen`,
  `gelesen`, `total` wie bei `probe`).
- **Der Einbetter** (`serve.mjs`) beantwortet Suchfragen: eine Frage muss in denselben Raum wie die Abschnitte, und das
  Modell gehört dem Plugin. Der Server hält darum **einen** Kindprozess vor (`Embedder.cs`), startet ihn beim ersten
  Bedarf, fragt je Zeile JSON über stdin/stdout (`{text, kind}` → `{model, dims, vector}`) und startet ihn nach einem
  Absturz neu. Das ist die eine Ausnahme von „Plugins nur über /api“ (CLAUDE.md), und sie ist begründet: der Weg über
  einen Job wäre je Frage ein Prozessstart mit Modellladen.

Das Modell kommt beim ersten Lauf aus dem Netz (etwa 120 MB) nach `plugins/embed/.cache` und bleibt dort (Volume
`journali-embed-cache`; `JOURNALI_EMBED_CACHE` setzt den Ort). Danach braucht nichts mehr das Netz. Servername des
Modells: `JOURNALI_EMBED_MODEL`, Vorgabe dieselbe wie im Parameter des Jobs — beide müssen dasselbe sagen.

**Suche.** `GET /api/docs/search?mode=text|semantic|hybrid`. `text` ist, was war. `semantic` bettet die Frage ein
und sortiert nach Kosinusabstand (`score` = 1 − Abstand am Treffer, der Ausschnitt ist der Anfang des Abschnitts).
`hybrid` verschneidet beide Reihen mit Reciprocal Rank Fusion (`SemanticApi.Rrf`): je Reihe zählt der Platz, nicht
der Wert, denn Volltext-Rang und Abstand sind nicht vergleichbar; was in beiden vorn steht, steht vorn. Geht der Sinn
nicht (Erweiterung, Plugin, Prozess), sagt `warning` warum, und die Wörter kommen trotzdem. In ⌕ Dokumente stehen die
drei als Chips „Wörter · Sinn · Beides“, die Wahl bleibt im Browser.

**Frage an die Dokumente.** `POST /api/docs/ask {q, under?, k}`: die besten `k` Abschnitte (hybrid; der Wort-Treffer
holt sich seinen ganzen Abschnitt, `DocText.ChunkAsync`) gehen nummeriert als Auszüge an die KI des zahlenden Teams
(`AiApi.AskAsync`, derselbe Weg und dieselbe Zählung wie `/ai/ask`, Anlass `docs`). Die Anweisung: nur aus den
Auszügen, jede Aussage mit ihrer Nummer, ein Satz, wenn nichts drinsteht, Sprache der Frage. Die Antwort trägt
`sources`: Nummer, Dokument, Seite, Überschrift, die Knoten, an denen es hängt. Ohne Schlüssel am Team kommt die
Meldung, die auch `/ai/ask` gibt. Der Sinn braucht keinen Schlüssel — die Frage schon: sie ist ein KI-Aufruf.

**Knoten.** Der Text eines Knotens (`NodeText.Of`): Name, Rolle, Pfad, dann je Attribut Bezeichnung und Wert in der
Leitsprache — Listenwerte als Bezeichnung, HTML ohne Tags, Einheit dahinter; Formeln, Vorlagen und Zeilen nicht.
Derselbe Inhalt wie das Markdown des Plugins `rag`, ohne Auszeichnung. `GET /api/nodes/semantic?q` findet Knoten nach
Sinn; `GET /api/nodes/{id}/similar` die nächsten aus dem eigenen Vektor, ohne neue Einbettung — als Band
„≈ Ähnliche Knoten“ in der Knotenansicht (Plugin `embed`, `entry.js`). `known` sagt, ob der Knoten schon einen
Vektor hat.

**Export.** Das Plugin `rag` gibt mit `withDocs` (Vorgabe an) den Text der Dokumente am Knoten mit
(`GET /api/docs/{id}/text`, Abschnitt „## Dokument: …“, `docs` in `nodes.jsonl`) — bisher stand nur ihre Adresse im
Export (34 J).

**Offen.**

- ~~Nur die Leitsprache~~ — je Sprache des Modells ein Text und ein Vektor je Knoten (27.09.2026); `/nodes/semantic`
  und `/nodes/{id}/similar` nehmen `locale`, Vorgabe die Leitsprache.
- ~~Kein Index auf den Vektorspalten~~ — gebaut (27.09.2026): je Modell und Dimension ein HNSW-Teilindex über
  `embedding::vector(N)` mit `WHERE model = '…'` (`Vectors.EnsureIndexAsync`, nach jeder Ablage, einmal je Prozess).
  Die Suche fragt mit demselben Ausdruck und dem Modell als Wortlaut, sonst nähme der Planer den Teilindex nicht;
  ein Modellname darf darum nur Bezeichnerzeichen tragen (`ModelLiteral`). Scheitert der Index (Zeilen mit anderer
  Dimension unter demselben Modell), bleibt die Suche genau und langsam, der Grund steht in `GET /api/docs/embed`
  (`indexError`). HNSW ist näherungsweise: mit `ef_search` 40 (Vorgabe) fehlt selten ein Treffer am Rand — für die
  Suche nach Sinn ist das die richtige Seite des Tauschs.
- ~~Ein Systemjob-Balken im Tasker~~ — gebaut (27.09.2026): `GET /api/jobs/plugins` gibt `system` und `progress`
  aus dem Manifest mit, der Tasker zeigt oben je Systemjob eine Zeile mit Balken (erledigt von gesamt), den Zahlen
  und ▶; `POST /api/jobs/system/{plugin}/run` legt den Job an, wenn es keinen gibt, und startet ihn (wie
  `ProbeApi.Kick`, für jeden Systemjob). Der Balken ist ein Füllstand, wie in CLAUDE.md verlangt.
- Bilder haben keinen Text und darum keinen Vektor; Bildeinbettungen (ein anderes Modell) wären ein eigener Schritt.
## 36. Attribut und Gruppe — n:m (29.09.2026, entschieden)

**Die Lage.** Ein Attribut trägt heute genau eine Gruppe (`AttributeDefinition.Group`, ein einzelner Schlüssel), und
was an einem Knoten gilt, sind alle Attribute aller Gruppen am Pfad (`CompletenessRules.ActiveAttributes`). Geltung und
Ordnung sind damit dieselbe Sache: Die Gruppe sagt zugleich, wofür ein Attribut inhaltlich steht und wo es gepflegt
werden muss.

**Das Problem.** Beides zusammen lässt sich nicht granular modellieren. Eine Grösse wie die Spannungsversorgung
gehört zu vielen Produktarten; damit sie überall gilt, muss ihre Gruppe weit oben hängen — und dann erbt alles
darunter auch jedes andere Attribut derselben Gruppe. Schneidet man die Gruppen kleiner, muss sich jedes Attribut für
eine entscheiden: Dieselbe Grösse in zwei Ästen heisst zwei Attribute mit gleicher Bedeutung, gleicher Einheit und
gleicher Pflicht. Das widerspricht dem Grundsatz, dass ein Attribut systemweit dieselbe Funktion hat.

**Die Entscheidung.** Zwischen Attribut und Gruppe gilt künftig n:m. Eine Gruppe ist damit keine Zugehörigkeit des
Attributs mehr, sondern eine **Auswahl**: eine Liste von Attributen, die man an einen Ast hängt. Ein Attribut kann in
beliebig vielen Auswahlen vorkommen, ohne Kopie.

Damit wird die Gruppe billig. Eine zweite Zusammenstellung, die ein Pflichtattribut weglässt, kostet einen Namen und
ein paar Häkchen, statt Attribute umzuziehen und sie anderswo zu verlieren. Der natürliche Weg sind kleine Bausteine,
die sich am Knoten addieren:

    Betriebsgeräte für HID  →  Spannungsversorgung + Zündung + Gehäuse
    LED-Treiber             →  Spannungsversorgung + Dimmung + Gehäuse

**Die Pflicht bleibt am Attribut.** Ein Attribut hat überall dieselben Regeln — Typ, Einheit, Pflicht, Eindeutigkeit.
Unterscheidet sich die Pflicht zwischen zwei Verwendungen, ist es eine andere Sache und damit ein anderes Attribut.
Die Zuordnung zu einer Gruppe trägt deshalb nur Zugehörigkeit, keine eigenen Regeln. Für den Fall, dass eine Grösse
nur unter Bedingungen gilt, gibt es bereits zwei Ventile: `Required` steht je Kanal und Sprache, und `When` schaltet
ein Attribut anhand des Werts eines anderen ab.

**Was unberührt bleibt.** Die Geltung entscheidet weiter der Baum: Gruppen hängen an Knoten und vererben sich nach
unten (`Tree.EffectiveGroups`), `activeFrom` gilt je Rolle, `Levels` beschränkt auf Rollen, `When` auf Werte, und die
Vollständigkeit rechnet wie bisher. Es ändert sich eine einzige Regel — dass ein Attribut nur einer Gruppe angehören
darf.

**Migration ohne Datenänderung.** Jedes Attribut behält seine heutige Zuordnung; aus einer Zuordnung wird eine
Mitgliedschaft. Kein Eintrag im Journal wird ungültig, keine Vererbung kippt, keine Vollständigkeit ändert sich. Erst
wenn jemand ein Attribut einer zweiten Gruppe hinzufügt, entsteht etwas Neues.

**Vertagt, mit Begründung.**

- **Eine zweite Ordnung** („Attributklasse“: worum es thematisch geht, quer zu den Gruppen) ist erst nötig, wenn die
  Zahl der Attribute die Suche über Name und Gruppe überfordert. Sie darf dann nie über Geltung entscheiden, sonst
  entsteht dasselbe Problem unter neuem Namen.
- **Ein Behälter für Gruppen** (mehrere Gruppen unter einem Namen, in einem Zug anhängen) leistet in einem System mit
  Vererbung wenig: Was anderswo Klickarbeit spart, macht hier der Baum. Sein einziger Rest-Nutzen ist die spätere
  Änderung an vielen Ästen. Falls er kommt, dann als Vorlage, die beim Anhängen in ihre Gruppen aufgelöst wird — nicht
  als Verweis, der eine zweite Auflösungsebene in Geltung, Vererbung und Vollständigkeit bringt.
- **Bündel nach Zuständigkeit** (Vertrieb, Logistik, Marketing) beantworten nicht, welche Attribute ein Produkt hat,
  sondern wer sie pflegt. Das ist eine Sicht, keine Gruppe.

**Was zu bauen ist.**

1. Kern: ein Eintrag, der die Mitgliedschaft eines Attributs in einer Gruppe setzt und löst; `ModelCatalog` führt sie
   neben der heutigen Zuordnung, `AttributesOf` liest beide.
2. Server: `ModelApi` gibt die Mitgliedschaften aus und nimmt sie entgegen; die Prüfung, dass ein Attribut zu einer
   Gruppe gehört, fragt künftig die Menge.
3. Oberfläche: Im Modell steht am Attribut eine Mehrfachauswahl statt eines Wählers; die Gruppe zeigt ihre Mitglieder
   und nimmt welche auf.
4. Knotenansicht: Ein Attribut, das über zwei geltende Gruppen hereinkommt, steht einmal da — unter der ersten Gruppe
   am Pfad, mit Hinweis auf die weiteren. Der Wert ist derselbe, die Zelle auch.
5. Datenblatt und Ausleitung: Der Baustein `group` nimmt die Attribute der Gruppe wie bisher; bei Mehrfachzugehörigkeit
   kann dasselbe Attribut in zwei Blöcken vorkommen — das ist gewollt und bleibt Sache der Vorlage.

**Gebaut (29.09.2026).** Ein Eintrag `AttributeGroupsSet(key, groups[])` im Strom des Attributs setzt die ganze Menge;
`ModelCatalog.AttributeGroups` führt sie neben der Zuordnung, `AttributesOf` liest beide, `GroupsOf` nennt sie
zusammen. `CompletenessRules.ActiveAttributes` gibt ein Attribut einmal aus, auch wenn es über zwei geltende Gruppen
hereinkommt — sonst zählte seine Pflicht doppelt. `ModelApi` gibt je Attribut `groups[]` aus und nimmt das Feld beim
Schreiben entgegen (ohne das Feld ändert sich nichts); die Gruppenliste kennt auch Gruppen, die nur Mitglieder haben.
Im Modell steht am Attribut eine Mehrfachauswahl, die Gruppe zeigt ihre Mitglieder und nimmt welche auf. Am Knoten
steht ein Attribut einmal — in der ersten geltenden Gruppe, die weiteren im Tooltip; eine Gruppe, deren Attribute alle
woanders stehen, bekommt keinen leeren Block, und der Sprung auf sie führt dorthin, wo ihre Attribute stehen.

**Die Zuordnung bleibt als Heimatgruppe.** Die Menge ist die Wahrheit; `group` am Attribut zählt als eine
Mitgliedschaft unter anderen und ist die erste der Menge. Sie steht, wo nur eine Gruppe Platz hat (Listen, Filter,
Export), und lässt jeden Leser, der die Menge nicht kennt, weiterarbeiten. Ein eigener Eintragstyp, der sie löscht,
ist nicht nötig: ein Attribut ohne Mitgliedschaft gilt an keinem Knoten — wie vorher ohne Gruppe.

**Offen.** Ob die Knotenansicht zusätzlich nach Thema gliedern soll, entscheidet sich mit der zweiten Ordnung.

## 37. scriptum — Skripte, die der Anwender schreibt und anstösst (29.09.2026, entschieden)

**Die Lage.** Für Auswertungen über Systemgrenzen, eigene Transformationen und Schnittstellen zu Fremdsystemen hat
journali fast alles, was es braucht:

- Ein Plugin mit `runs: process` läuft als Kindprozess des Servers (`JobRunner`), nie im Serverprozess.
- Je Lauf gibt es ein Token mit der Rolle des Jobs (`Auth.IssueServiceToken`, `JOURNALI_TOKEN`); der Prozess spricht
  `/api` als Bearer und darf genau das, was die Rolle erlaubt.
  Ein Lauf, der aus einer Ansicht an den Tasker abgegeben wird (`/api/jobs/<key>/uebergabe`), hat die Rolle des Anfragenden
  (01.10.2026): ein Import, der neue Attribute anlegt, braucht das Recht „model“ und gelingt nur dem, der es selbst hat.
  **Ein Import hat Vorfahrt** (02.10.2026): solange ein Import läuft (Plugin der Art `import`, oder der Dienst `import` eines
  Formats), startet der Nachzieher keinen Systemjob, und die laufenden — Vektoren, Ableitungen, Dokumente lesen, Erkennen,
  Messen — bekommen über `/api/jobs/<job>/signal` „anhalten“ (Grund „Import“) und enden mit Rückgabewert 2. Das gilt nicht
  als Fehler; der nächste Lauf findet dieselben offenen Posten. Der Import schreibt in dieselbe Datenbank, und auf ihn wartet jemand.
- Parameter stehen im Manifest und werden zum Formular; das Profil sagt, **was** getan wird, der Job **wohin und wann**.
- Zugänge (`driver`) tragen Adresse und Anmeldung: die offenen Felder im Journal, das Geheimnis beim Server, und es
  geht nur an einen Prozess, nie an den Browser.
- Fächer `in/` und `out/` holen und legen Dateien ab, auch über einen Zugang.
- Ein Plugin bringt eigene Vue-Ansichten mit; der Lauf schreibt ein Log, hat einen Zeitplan und einen Trockenlauf.
- Von aussen ist alles über `POST /api/jobs/{key}/run` mit Token aufrufbar.

**Die Lücke.** Diese Logik muss heute als Plugin-Verzeichnis ausgeliefert, gebaut und signiert werden. Wer eine
Auswertung für sein Haus braucht, kann sie nicht selbst schreiben. Genau das ist der häufige Fall: eine Liste, die
zwei Systeme zusammenführt; ein Abgleich, der einmal die Woche läuft; eine Übergabe an ein Fremdsystem, die niemand
sonst so braucht.

**Die Entscheidung.** `scriptum` ist ein Plugin, dessen Programm nicht im Verzeichnis liegt, sondern **im Journal**:
in der Oberfläche geschrieben, versioniert wie jeder andere Eintrag, ausgeführt mit der Maschinerie, die schon steht.

1. **Der Quelltext steht im Journal** (Plugin-Daten, wie Profile). Damit ist er versioniert, rückholbar und in der
   Sicherung enthalten. Ein Geheimnis steht nie darin — es kommt aus einem Zugang oder dem Tresor, denn im Journal
   lässt sich nichts löschen.
2. **Zwei Rechte, die nicht dasselbe sind.** `scriptum.write` schreibt und ändert Skripte; wer es hat, kann alles,
   was der Serverbenutzer kann — das ist ein Administratorrecht. `scriptum.run` stösst ein freigegebenes Skript an
   und sieht sein Ergebnis; damit bedient jemand die Auswertung, ohne je Quelltext zu sehen.
3. **Ausgeführt wird als Kindprozess**, wie jedes Prozess-Plugin. Der Runner des Plugins holt den Quelltext über
   `/api`, führt ihn als Modul aus und gibt das Ergebnis zurück. Das Token trägt die Rolle, die am Skript steht —
   ein Skript darf nie mehr als ein Anwender mit dieser Rolle.
4. **Das Ergebnis ist JSON auf stdout**: eine Tabelle (Spalten und Zeilen), ein Text, oder ein Verweis auf eine Datei
   im Fach `out/`. Die Ansicht zeigt Tabelle und Text und bietet die Datei zum Herunterladen an. So entsteht eine
   Auswertung ohne eine Zeile Oberflächencode.
5. **Angestossen wird auf drei Wegen**, alle mit demselben Skript: von Hand in der Ansicht, als Job mit Zeitplan und
   Fächern, oder über `/api` von einem anderen System aus.
6. **Das Formular steht im Skript.** Ein Kopf (`export const meta = { label, params, role }`) deklariert Bezeichnung,
   Parameter und die Rolle; Formular und Programm bleiben zusammen und können nicht auseinanderlaufen.

**Abgrenzung, die scharf bleibt.** Formel und Vorlage (`Tree.Compute`) rechnen Werte **am Knoten**, ohne Aussenwelt,
und ihr Ergebnis ist ein Attributwert. `scriptum` darf nach aussen und schreibt über `/api` wie ein Anwender. Ein
ausgeliefertes Plugin bleibt, was es ist: ein Verzeichnis mit Zertifikat, das journali mitbringt. Ein Skript ist das
Gegenstück dazu — nichts wird mitgeliefert, nichts signiert, alles gehört der Anlage.

**Was ehrlich dabeisteht.** Ein Skript läuft als Prozess auf dem Server. Sein Token begrenzt, was es in journali
darf; was es darüber hinaus tut (Netz, Dateisystem), begrenzt nur das Betriebssystem. Darum ist `scriptum.write` ein
Administratorrecht, und die Oberfläche sagt das an der Stelle, an der jemand ein Skript anlegt.

**Was gebaut wird.**

1. Plugin `scriptum` mit `runs: process` und einem Runner, der ein Skript aus dem Journal ausführt; Parameter aus
   `meta` des Skripts, Ergebnis als JSON auf stdout.
2. Ablage der Skripte in den Plugin-Daten (`PluginDataSet`), mit Bezeichnung, Rolle, Freigabe und Quelltext.
3. Ansicht: Liste links, Editor rechts (der Editor der Formeln trägt schon Hervorhebung und Tastenkürzel),
   Parameterformular, ▶ Ausführen, Ergebnis als Tabelle, Text oder Datei; ein Lauf schreibt sein Log wie jeder Job.
4. Rechte `scriptum.write` und `scriptum.run` im Vokabular; die Freigabe je Skript steht an ihm.
5. Anstoss als Job: der Tasker sieht `scriptum` wie jedes Prozess-Plugin, das Skript ist der Parameter.

**Gebaut (29.09.2026).** Plugin `scriptum` (`runs: process`, Ansicht ⌨ Skripte, Runner `runner.mjs`), Endpunkte in
`ScriptumApi.cs`, Rechte `scriptum.write` und `scriptum.run` im Vokabular (`Rights`), Parameter vom Typ `script` im
Job-Dialog. Ein Skript steht als `script:<key>` in den Plugin-Daten von `scriptum`.

**Von Hand ausführen geht über die Job-Maschinerie.** ▶ legt den Job `scriptum_<key>` an (oder frischt ihn auf) und
startet ihn über den `JobRunner`; die Ansicht fragt danach nach Stand, Ergebnis und Protokoll
(`GET /api/scriptum/runs/{job}/{run}`). Damit gibt es **keinen zweiten Weg**, auf dem ein Prozess entsteht: dasselbe
Log, dieselbe Zeitgrenze, dieselben Fächer, dieselbe Anzeige unter ⏱ Jobs — und kein Skript im Serverprozess. Das
Ergebnis steht als letzte Zeile mit der Marke `⟦scriptum⟧` auf stdout und damit im Log des Laufs; von dort liest der
Server es, statt eine zweite Ablage zu führen.

**Die Freigabe ist ein Recht, kein Schalter.** Am Skript steht, welches Recht sein Lauf braucht (`run`): gesetzt heisst
freigegeben. So bedient jemand eine Auswertung mit `read`, ohne `scriptum.run` an jede Rolle zu geben — und ohne je
Quelltext zu sehen. Ohne Recht kann es nur, wer Skripte schreibt.

**Der Kopf ist das Formular, an zwei Stellen gelesen.** Beim Speichern liest die Ansicht `export const meta` aus dem
Quelltext (`plugins/scriptum/kopf.mjs`, nur der Ausdruck, nicht das Programm) und legt die Parameter neben das Skript —
daraus baut das Formular, auch für den, der den Quelltext nicht sehen darf. Beim Lauf liest der Runner denselben Kopf
noch einmal und nimmt seine Vorgaben; so können Programm und Maske nicht auseinanderlaufen.

**Ab Pro+, nicht in Pro** (29.09.2026, entschieden). Ein Skript läuft als Prozess auf dem Server, und wer eines
schreibt, kann alles, was der Serverbenutzer kann. Darum steht `scriptum` in keiner Plugin-Liste des Saatguts und gilt
erst, wo der Tarif alle Plugins enthält — Pro+, Enterprise, Unlimited. Kostenlos und Pro bleiben ohne.

**Grenzen, an den Runner.** Zeitgrenze je Lauf (Vorgabe 60 s, am Skript einstellbar, höchstens eine Stunde),
höchstens 20 000 Zeilen und 4 000 Zeichen je Zelle, Text bis 200 000 Zeichen. Ein Fehler des Skripts ist eine Meldung
im Ergebnis und Rückgabewert 1 — kein Absturz.

**Offen.**

**Nicht bevormunden** (29.09.2026). journali ist Open Source (ELv2); wer `scriptum.write` hat, kann ohnehin alles, was
der Serverprozess kann (er könnte längst per `fetch` Fremdcode ziehen). Einen Anwender mit erteilten Rechten davor zu
schützen ist **nicht unsere Aufgabe** — das Sicherheitsnetz sind die gestaffelten Umgebungen des Betreibers
(dev→test→preview→prod), nicht paternalistischer Produktcode. Was bleibt, ist **kein** Paternalismus, sondern Schutz
Dritter bzw. Korrektheit: **Geheimnisse bleiben beim Server** (Tresor, Relay — schützt fremde Zugangsdaten, nicht den
Admin vor sich), **Signaturen sind Manipulationsnachweis** für ausgeliefertes (keine Erlaubnisschranke), und journali
tut **nichts Gefährliches von selbst** — der Unterschied ist „der Anwender wählt es“ gegen „es passiert automatisch“.

- **Bibliotheken / npm-Pakete.** Der Kontext bringt mit: `api`, `params`, `out`, `log`, `zugang`, `step`, `snapshot`,
  `lib` (dazu `fetch` und die Standardbibliothek der Laufzeit). Eigene npm-Pakete sind noch nicht dabei, aber **kein
  Sicherheitsproblem** (siehe „Nicht bevormunden“); die offene Frage ist rein technisch — wer legt `node_modules` für
  den Runner an (je Skript, global, im Container-Bau) und wie die Versionen.
- **Wiederverwendung — gebaut (29.09.2026).** Kuratierte Helfer `ctx.lib` (csv, parseCsv, chunk, retry, get, sleep) —
  geprüft und ausgeliefert statt beliebiger Pakete — und benannte Schritte `ctx.step(name, fn, { schema, snapshot })`:
  jeder Schritt mit Start, Dauer und Ausgang im Log, optional gegen ein minimales JSON-Schema geprüft (`ctx.lib`-Prüfer)
  und als Snapshot ins Fach out/ (`ctx.snapshot`). Struktur und Reuse **in einem** Skript, kein Pipeline-Motor über
  Skripte hinweg. Ein Fremdsystem spricht ein Skript weiter über `ctx.zugang` an (Abschnitt 38) — nicht Skript ruft Skript.
- **Knoten-Skripte im Kontextmenü — gebaut (29.09.2026).** Ein Skript mit `meta.nodes: true` erscheint im
  Kontextmenü des Baums (unter ≡ Skripte) — auch bei **Mehrfachauswahl**; ein Klick läuft **einmal** auf allen
  selektierten Knoten, deren IDs kommen als Parameter `nodes` (Komma-getrennt). Das Flag steht am Skript
  (`ScriptumApi.Skript.Nodes`), scriptum meldet eine multi-fähige `nodeAction` an, TreeView zeigt sie eigens (nicht in
  der bei Mehrfachauswahl gesperrten Plugin-Gruppe). So sind Skripte kleine Helfer direkt am Knoten.
- **Ein Markt fremder Snippets.** Legitim, sobald der Anwender ihn einlöst — nicht davor zu schützen ist nicht unsere
  Aufgabe. Gebaut ist der bequeme, geprüfte Standardweg zuerst: eine eigene Beispiel-Bibliothek (Abschnitt 38). Die
  Grenze ist nur: journali zieht Fremdcode **nicht von selbst** und führt ihn aus — gewählt statt automatisch.
- **Ein Skript ohne Job.** Jeder Lauf legt einen Job an; ein Skript, das nur einmal laufen soll, hinterlässt also
  einen Job in der Liste. Ob der Tasker solche Läufe eigens zeigt oder verbirgt, entscheidet sich, wenn es stört.
- **Promotion test→prod — Skripte gebaut (29.09.2026), Modell offen.** Das Beispiel „Promotion test→prod: Skripte"
  hebt scriptum-Skripte auf eine andere Instanz: das Ziel ist ein `http`-Zugang auf ihre Basis-URL (Geheimnis = ein
  API-Token dort mit `scriptum.write`), Diff über die Skriptliste, Trockenlauf als Standard, Anwenden per Schalter
  (PUT je Skript, idempotent), gelöscht wird auf dem Ziel nie. Das **Modell** hebt es noch nicht: die idempotenten PUTs
  je Schlüssel (`/attributes/{key}`, `/lists/{key}`, `/groups/{key}` …) sind da, aber der Feld-Abgleich GET↔PUT je
  Modelltyp und ein sauberer Diff sind der Ausbau. Ganze-Instanz-Kopie geht weiterhin nur *runter* (⇅ B&R).

## 38. Fremdsysteme anbinden — Zugang `http` und `ctx.zugang` (29.09.2026, entschieden)

**Der Bedarf.** Ein PIM muss Fremdsysteme (Warenwirtschaft, Medienverwaltung, jede REST-Schnittstelle) über deren API
anbinden — lesen und beschicken —, **ohne für jedes System ein Plugin zu schreiben**. journali bleibt dabei PIM und
Datenwahrheit; ein vollständiges Process-Framework ist nicht sein Sinn. Die Ablauflogik (welcher Schritt wann, welche
Route) bleibt draussen; journali ist Quelle und Ziel und lässt sich von aussen anstossen (`POST
/api/scriptum/scripts/{key}/run`, Bearer-Token).

**Zwei Stücke, beide auf Bestehendem.**
1. **Eine allgemeine Art `http`** in den Zugängen (`DriverApi`): Adresse (`url`), Anmeldung (`auth`: ohne, Bearer,
   Basic, eigener Kopf), Anwendername, Kopfname; das Geheimnis (`secret`) im Tresor. Wie die anderen Anmeldungen (IXP,
   Solr) wird sie über die **Weiterleitung** gelesen — jetzt auch schreibend (GET/POST/PUT/DELETE mit Rumpf). Der
   Server hängt die Anmeldung an und bleibt der einzige, der das Geheimnis kennt; die Weiterleitung bleibt auf den
   einen Host des Zugangs beschränkt (`WeiterUrl`), so wird sie kein offenes Tor.
2. **`ctx.zugang(name)` im Runner** von scriptum: ein Skript spricht ein Fremdsystem über die Weiterleitung an
   (`get/post/put/del`), ohne dessen Token je zu sehen. Der Name kommt aus einem Parameter vom Typ `driver` (im
   Formular eine Auswahl der eingerichteten Zugänge) oder steht im Skript.

Damit ist ein neues System **ein Zugang plus ein Skript** — keine gebaute, signierte Erweiterung.

**Schreiben mit Kopfzeilen.** Mancher Schreibzugriff braucht mehr als Rumpf und Anmeldung — ERP Gateway etwa einen
CSRF-Token, gebunden an die Sitzung. Dafür gibt `ctx.zugang(name).roh(method, pfad, { body, headers })` die ganze
Antwort zurück (`{ status, headers, body }`), und die Weiterleitung reicht wenige Kopfzeilen des Aufrufers an die
Quelle durch (`X-CSRF-Token`, `If-Match`, den Sitzungskeks als `X-Relay-Cookie` → `Cookie`) — nie sein Authorization.
So holt ein Skript erst den Token (`X-CSRF-Token: Fetch`) und schreibt dann mit Token und Keks; das Geheimnis des
Zugangs bleibt beim Server. Beispiel „ERP OData schreiben (CSRF)“ in der Bibliothek.

**Die Beispiel-Bibliothek — statt eines Marktes.** Damit niemand jedes Skript bei null beginnt, liefert journali
**kuratierte Beispiele** mit (`plugins/scriptum/beispiele.mjs`): CSV-Export, Fremdsystem lesen, Fremdsystem beschicken,
ein einfacher Bericht. Der Autor lädt eines in den Editor (＋ Beispiel …) und passt es an. Kein Fremdcode aus einem
öffentlichen Markt — dazu die Begründung unter „Offen“ in Abschnitt 37.

## 39. Konfigurator (`configurator`) — Regeln, die zu einer Auswahl sagen, was geht (02.10.2026, Kern und Endpunkt gebaut)

Ein Konfigurator prüft eine Auswahl von Produkten gegen Regeln. Die Regeln pflegt ein Anwender im PIM und prüft dort Beispiele;
ein Shop schickt, was ausgewählt ist, und bekommt zurück, was geht. **Die Logik steht nur auf dem Server**: der Shop kennt sie nicht,
und die Ansicht des PIM fragt denselben Endpunkt wie der Shop. Das Plugin heisst `configurator`; die Namen in der Definition und in der
Schnittstelle sind englisch, weil sie im Journal stehen und nach aussen gehen.

**Zwei Sorten von Regeln:**

- **Bilanz.** Ein Teil stellt Ressourcen bereit (ein Mainboard 3 Steckplätze) oder verbraucht sie (eine CPU einen Steckplatz und eine Kühlung).
  Eine Erweiterungskarte, die einen Steckplatz braucht und drei bereitstellt, trägt beides. Jede Ressource, die in der Auswahl vorkommt,
  muss in der Summe ≥ 0 sein; eine Regel je Ressource gibt es nicht. Die Ressourcen stehen als Zeilenattribut `resources` am Produkt
  (Spalten `resource` und `amount`, positiv = stellt bereit, negativ = verbraucht). Eine Variante ohne eigene Zeilen nimmt die ihres Produkts.
  Das ist der Weg vor Abschnitt 40: dort ist die Ressource eine Konfiguratorgruppe, und eine Zeile an einem Teil geht diesem Attribut vor.
- **„wenn A, dann B“** (`if` und `then` an der Regel). Die Bedingung (`has`, `count`, `sum` eines Attributs, `balance` einer Ressource, verknüpft mit
  `and`, `or`, `not`) fragt nach Teilen, die ein **Selektor** (`selector`) benennt: ein Knoten (Produkt, Gruppe oder Variante, sein ganzer Teilbaum),
  ein Attributfilter oder beides. Die Folge: `forbids`, `limits` auf höchstens `max`, `requires` mindestens `min`. Eine Regel ohne Bedingung gilt immer.

**Zwei Zustände.** *Unzulässig* (`valid: false`): ein Verbot, eine Grenze oder eine Ressource im Minus ist verletzt. *Unvollständig*
(`complete: false`): etwas ist verlangt und fehlt. Eine unvollständige Auswahl kann zulässig sein. Zu jedem Teil, das noch dazukommen könnte,
sagt das Ergebnis auf Wunsch (`selectable`), ob es geht und welchen Verstoss es neu verursachen würde; was verlangt ist und fehlt, sperrt kein Teil —
und eine Summe im Minus ebenso wenig: ein weiteres Teil kann sie beheben (Abschnitt 40).

**Kern (`Journali.Core/Configurator/`):** `Definition` (JSON, Prüfung der Regeln, jede Meldung nennt die Regel), `Checker` (Auswahl → `Evaluation` mit
Verstössen, Fehlendem, Bilanz je Ressource und Wählbarkeit), `Parts` (Baum → Teil, wählbare Teile unter einer Wurzel).
Tests: `ConfiguratorTests` (das Beispiel eines Servers mit Mainboard, CPU, Kühlern, Karten und Grafikkarten).

**Endpunkt (`ConfiguratorApi.cs`):**

- `POST /api/configurator/{key}/check` mit `{ "selection": [{ "id": "<Knoten-Id oder eindeutiger Wert, z. B. SKU>", "amount": 1 }], "selectable": false }`.
  Die Antwort: `valid`, `complete`, `selection` (`ref`, `id`, `name`, `amount`), `violations` und `missing` (`kind`, `text`, `affects`, `rule` oder
  `group`), `balance` je Gruppe (`provided`, `consumed`, `free`), `groups` (`label`, `count`, `min`, `max`, `allowed`, `values`) und mit `selectable: true` zu jedem
  wählbaren Teil `ok`, die `reasons` und die `lifts` (die Gruppen im Minus, die es anhebt). In
  `affects` stehen die Kennungen, die der Aufrufer geschickt hat — der Shop kennt unsere Ids nicht. Höchstens 500 Zeilen, Menge 1 bis 9999,
  höchstens 2 000 wählbare Teile.
- `GET /api/configurator` (die Konfiguratoren mit Zahl der Regeln und Fehler) und `GET /api/configurator/{key}` (die Definition und was an ihr nicht stimmt).
- **Recht:** Prüfen braucht nur das Recht zu lesen, auch wenn es ein POST ist (`Auth.Needed`). Ein Teil, das die Rolle des Aufrufers nicht sieht, gibt es für
  ihn nicht (dieselbe Antwort wie für ein unbekanntes). Die Definition liegt unter den Plugin-Daten von `configurator` (`def:<key>`); sie zu ändern
  ist Pflege dieser Daten.
- **Das Plugin muss da, an und im Tarif sein**; im Saatgut gehört `configurator` zu Pro+ (nicht in der Liste von Kostenlos und Pro). Im Betrieb gilt das
  signierte Tarifblatt: ein Blatt, das `configurator` nicht nennt, schliesst es aus.

**Ansicht (Plugin `configurator`, ⚙ Werkzeuge → Konfigurator):** links die Konfiguratoren (anlegen, entfernen), rechts die Definition. *Regeln* pflegt
ein Formular: Kennung, Meldung, Bedingung (Art und Felder je Art, verschachtelbar) und Folge mit Selektor (Knoten über den Auswahlbaum, Attributfilter);
unter jeder Regel steht sie als Satz. Die Definition steht als Plugin-Daten im Journal (`def:<key>`); was der Server an ihr bemängelt, steht darüber.
*Prüfen* wählt Teile (Id oder SKU, Menge), zeigt zulässig und vollständig, Verstösse, fehlende Teile, die Bilanz und die wählbaren Teile mit dem Grund,
warum eines gesperrt ist — über denselben Endpunkt wie der Shop, gegen den gespeicherten Stand. *Testfälle* merken eine Auswahl mit dem Ergebnis
(`case:<key>:<name>`); „Alle prüfen“ vergleicht nach jeder Änderung der Regeln, was sich verschoben hat.

**Offen:** mehrere Container in einer Konfiguration (zwei Mainboards fallen heute in eine Bilanz zusammen), Hilfe in der Instanz, der Tarif des Plugins im
Tarifblatt des Lizenzservers.

## 40. Konfiguratorgruppen — Teile gehören mit Zeilen zu Gruppen, die Regel steht an der Gruppe (02.10.2026, Kern und Endpunkt gebaut)

Eine Regel „Teil A schliesst Teil B aus“ gilt für genau diese zwei Produkte und muss bei jedem neuen Produkt nachgepflegt werden. Darum steht die Regel an einer
**Konfiguratorgruppe**; das Produkt ist Mitglied und trägt Zahlen oder einen Wert. Eine Gruppe gilt für alle Konfiguratoren, ihre Mitglieder auch. Die wenn/dann-Regeln
aus Abschnitt 39 bleiben für Fälle, die keine Gruppe abdeckt.

**Speicherung** (Plugin-Daten von `configurator`, kein neuer Eintragstyp; Namen und Felder englisch, sie stehen im Journal):

- `group:<key>`: `label` (für Meldungen) und `equal` (alle Werte der Mitglieder müssen gleich sein). Eine Gruppe, die nur in Zeilen vorkommt, hat den Schlüssel als
  Bezeichnung.
- `member:<knoten>`: die **Zeilen** des Teils (`rows`). Hat eine Variante keine, gelten die des nächsten Vorfahren, der welche hat (Produkt, Gruppe im Baum); hat sie
  eigene, gelten nur diese.
- `def:<key>` (Abschnitt 39) bekommt `limits`: eine Grenze je Zeile für eine Gruppe, die der Konfigurator selbst setzt.

**Eine Zeile** nennt ihre Gruppe (`group`), optional eine Bedingung (`when`) und entweder eine Wirkung als **Mitglied** oder eine **Vorgabe**:

| Art | Felder | Das Teil zählt in der Gruppe |
|---|---|---|
| Mitglied | `provides` (stellt bereit), `consumes` (verbraucht), `value` (Wert in der Gruppe) | ja |
| Vorgabe | `min`, `max` (Zahl der Mitglieder), `values` (erlaubte Werte) | nein |

**Alle Zeilen, deren Bedingung zutrifft, wirken**; es gibt keine Reihenfolge und keinen Rückfall. Ein Teil hat beliebig viele Zeilen in beliebig vielen Gruppen
(eine CPU: verbraucht einen CPU-Steckplatz; stellt mit einem bestimmten Mainboard zwei PCI-Steckplätze bereit; verbraucht mit einem bestimmten Gehäuse zwei Kühlungen).
`when` ist eine Bedingung aus Abschnitt 39 (`has`, `count`, `sum`, `and`, `or`, `not`) über die **Teile der Auswahl**; nach der Bilanz einer Gruppe darf sie nicht
fragen, weil die Bilanz von den Zeilen abhängt, die sie auswählt (ein Kreis). Eine Zeile mit Fehlern wirkt nicht und wird beim Lesen gemeldet.

**Was daraus folgt** (`Checker`):

- **Summe.** Je Gruppe, in der eine Zeile `provides` oder `consumes` nennt: bereit − verbraucht über alle Teile mal Menge, Zeilen derselben Gruppe addieren sich. Im Minus
  ist die Auswahl **ungültig** (`valid: false`, Art `balance`); ein Teil, das die Summe ins Minus bringt, bleibt trotzdem **wählbar**, und die `lifts` am wählbaren Teil
  nennen, welche Gruppe im Minus es anhebt.
- **Mitglieder und Werte.** Ein Teil zählt in einer Gruppe einmal (mal Menge), egal wie viele seiner Zeilen sie nennen. Hat es mehrere Werte, hat es sie alle. Werte werden
  als Zahlen verglichen, wo sie Zahlen sind (8 = 8,0), sonst ohne Beachtung der Gross- und Kleinschreibung.
- **Gleiche Werte** (`equal`): zwei verschiedene Werte in der Gruppe sind ungültig (Art `equal`).
- **Vorgaben.** Alle zutreffenden Vorgaben einer Gruppe gelten zusammen, auch die des Konfigurators: das höchste `min`, das niedrigste `max`, die Schnittmenge der erlaubten
  Werte. Mehr Mitglieder als `max` ist ungültig (`max`), ein Wert, der nicht erlaubt ist, ebenso (`value`); weniger als `min` ist **unvollständig** (`min`, unter `missing`).
  Ein Mitglied ohne Wert prüft die Liste der erlaubten Werte nicht. Eine Vorgabe gibt es nur, solange das Teil, das sie macht, in der Auswahl ist.
- **Wählbar.** Gesperrt ist ein Teil, das einen **neuen** Verstoss der Arten `rule`, `equal`, `max` oder `value` verursacht — nicht eines, das nur die Summe ins Minus
  bringt oder eine Mindestmenge offen lässt. Ein Verstoss, den die Auswahl schon hat, sperrt kein weiteres Teil.
- **Bestellbar** ist eine Auswahl, wenn `valid` und `complete` zutreffen.

**Beispiele** (Tests in `ConfiguratorGruppenTests`): ein Mainboard gibt der Gruppe „RAM“ vor: `min 2`, `max 2`, erlaubte Werte 8 und 32 (die Kapazität in GB, als Wert der
Gruppe, unabhängig vom Attribut am Produkt); ein 16-GB-Baustein ist dann ungültig und gesperrt, ein einzelner Baustein unvollständig, ein dritter gesperrt. Eine Gruppe
„nur ein CPU-Typ“ mit `equal` schliesst Silber- neben Gold-CPUs aus, zwei Silber-CPUs gehen. Eine CPU, die eine Kühlpaste verbraucht, ist ohne ein Teil, das sie bereitstellt,
ungültig; der Kühler, der sie bereitstellt, trägt in `selectable` den Hinweis `lifts: ["paste"]`.

**Schnittstelle:** `POST /api/configurator/{key}/check` liest Gruppen und Zeilen aus den Plugin-Daten und antwortet zusätzlich mit `groups`; `violations` und `missing` nennen
`group` statt `resource`. `GET /api/configurator-groups` liefert die Gruppen (mit der Zahl ihrer Mitglieder), die Zeilen der Teile und was an ihnen nicht stimmt.

**Offen:** Ansicht (Reiter „Gruppen“, Zeilen am Produkt), Gruppen im Tarifblatt (gilt wie das Plugin), mehrere Container in einer Konfiguration (Abschnitt 39).
