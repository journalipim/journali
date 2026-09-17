# Eintragstypen

Das Vokabular des Journals. Ein Typ ist für immer: neue Typen sind billig,
geänderte teuer, gelöschte unmöglich. Quelle: `Journali.Core/Entries/Types.cs`,
Abbilder: `Projections/Tree.cs` (Knoten), `Projections/ModelCatalog.cs` (Modell).

Nutzdaten in camelCase, Null-Felder fehlen. Ein fehlendes `locale`/`channel`
heisst „gilt für alle".

Jeder Eintrag kann eine **Stapelkennung** `batch` tragen (Spalte, kein Feld
im Payload): alle Einträge einer Aktion — Import, Einfügen aus Excel — haben
dieselbe. `POST /api/batch` vergibt sie (`b-…`).

## Baum — ein Strom je Knoten, interne Id

Produktgruppe → … → Produkt → Variante (docs/pflegestruktur.md, 5 und 8).
Der Strom ist die interne Id (`g-…`, `p-…`, `v-…`, `Ids.New`), nie die SKU.
Der erste Eintrag legt den Knoten an; Einträge auf Strömen ohne Anlege-
Eintrag übergeht das Abbild.

| Typ | Nutzdaten | Wirkung |
|---|---|---|
| `GroupCreated` | `parent?`, `name?`, `label{}` | Produktgruppe; `parent` null = Wurzel. `name` = Name im Baum; `label{}` je Sprache ist Altlast und füllt `name`, wenn er fehlt |
| `GroupRenamed` | `label{}` | **Altlast** (17.09.2026): heute `NodeNamed`; bleibt lesbar |
| `NodeNamed` | `name?` | eigener Name im Baum, jede Rolle, einsprachig; leer = weg, die Automatik benennt (docs/pflegestruktur.md, 17) |
| `LabelAttributeSet` | `attribute?` | das ★: welches Attribut ab hier nach unten die Knoten ohne eigenen Namen benennt; jeder Knoten darunter darf es neu setzen; null = weg, es gilt wieder das der Vorfahren |
| `ProductCreated` | `group`, `axes[]?` | Produkt unter einer Gruppe; `axes` = wonach es variiert (Attribute, optional). `family` ist Altlast und bleibt leer |
| `ProductAxesSet` | `axes[]` | Variantenachsen nachträglich (ganze Liste) — nur, solange das Produkt keine Varianten hat |
| `VariantCreated` | `product`, `axisValues{}` | Variante — das Verkaufbare; je Produktachse ein Wert, Kombination je Produkt eindeutig |
| `NodeMoved` | `parent` | Umhängen (Variante unter Produkt, sonst unter Gruppe; nie unter sich selbst) |
| `NodeRetired` | — | Knoten aus dem Abbild (nur ohne Kinder); das Journal behält alles |
| `StatusSet` | `status` (draft, active, discontinued) | Produkt und Variante; Gruppe hat keinen |
| `GroupsAttached` | `groups[]` | welche Attributgruppen an diesem Knoten hängen (ganze Liste); die **Definition** vererbt sich nach unten — ob der **Wert** vererbt wird, sagt das Attribut |
| `ExternalLinked` | `system`, `id` | externe Kennung je Quellsystem (Import: Update statt Neuanlage); je System nur ein Knoten |
| `ExternalUnlinked` | `system` | Kennung weg |

Vererbung: `Tree.Resolve` sucht am Knoten (genaue Achse, ohne Kanal, ohne
Sprache), dann bei den Eltern bis zur Wurzel — und sagt, woher der Wert kam.

## Werte an einem Knoten

| Typ | Nutzdaten | Wirkung im Abbild |
|---|---|---|
| `AttributeSet` | `attribute`, `locale?`, `channel?`, `value` oder `values[]` (mehrfach), `row?` | Wert auf dieser Achse; der letzte gewinnt. Leerer `value` / leere `values` = eigener Wert weg, Rückfall gilt wieder. `row`: Zelle einer Zeile eines vermehrbaren Attributs |
| `RowAdded` | `attribute`, `row` | neue Zeile eines vermehrbaren Attributs (`type: rows`); Kennung `r-…` vergibt der Server |
| `RowRemoved` | `attribute`, `row` | Zeile weg, samt ihren Zellen im Abbild |
| `RowOrdered` | `attribute`, `rows[]` | Reihenfolge; ungenannte Zeilen hinten dran |
| `CategoryAssigned` | `category` | Kategorie dazu |
| `CategoryRemoved` | `category` | Kategorie weg |
| `ReleaseGranted` | `channel`, `locale?` | Freigabe für Kanal (je Sprache oder alle) — nur an der Variante |
| `ReleaseRevoked` | `channel`, `locale?` | Freigabe weg |

## Rückfall über die Achsen

`ProductState.Resolve(attribute, locale, channel)`: erst die genaue Achse,
dann ohne Kanal, dann ohne Sprache. Ein Wert auf `de/web` überschreibt also
`de`, das wiederum `*`. Die Variantenebene (Modell → Farbe → Grösse) fehlt
noch — sie kommt als eigene Achse dazu, nicht als neuer Typ.

## Modell — eigene Ströme, ganze Definition je Eintrag

Das Modell steht im Journal (docs/pflegestruktur.md, Grundsatz). Jeder
Eintrag trägt die **ganze** Definition, der letzte je Strom gewinnt; ein
`…Retired` nimmt den Schlüssel aus dem Abbild `ModelCatalog`. Schlüssel:
`[a-z][a-z0-9_]*`, für immer.

| Strom | Typ | Nutzdaten |
|---|---|---|
| `locale:<code>` | `LocaleDefined` | `code`, `label` |
| `channel:<key>` | `ChannelDefined` | `key`, `label{}` |
| `attribute:<key>` | `AttributeDefined` | `key`, `label{}`, `type` (text, html, integer, decimal, boolean, date, enum, **rows**), `unit?` (muss es unter `unit:` geben), `group` (Attributgruppe), `axes[]` (locale, channel), `channels[]?`, `list?`, `multiple`, `inheritable` (Wert vererbt sich nach unten; Vorgabe nein), `required{kanal: [sprachen] oder ["*"]}?` (Pflicht — gilt überall gleich, Eineindeutigkeit), `levels[]?` (Ausnahme: an welchen Knotentypen; null = Regel der Gruppe), `columns[]?` (bei rows) |
| `group:<key>` | `AttributeGroupDefined` / `AttributeGroupRetired` | `key`, `label{}`, `activeFrom?` (group, product, variant: ab welchem Knotentyp Werte erfasst werden; darüber sichtbar, gesperrt). Gruppen hängen an Knoten (`GroupsAttached`) |
| `settings:master_locale` | `MasterLocaleDefined` | `code` — die Mastersprache (Saatgut `de`): Pflichtfelder beim Anlegen werden in ihr erfasst; liegt ihr Wert nach dem einer anderen Sprache (Eintragsnummer), gilt die als „zu überarbeiten“ — abgeleitet, kein eigener Eintrag |
| `settings:label:<role>` | `TreeLabelDefined` | **Altlast** (17.09.2026): Name im Baum je Knotentyp — ersetzt durch das ★ am Knoten (`LabelAttributeSet`); bleibt lesbar, wird nicht mehr gesät |
| `view:<key>` | `ViewDefined` / `ViewRetired` | `key`, `label{}`, `level` (Knotentyp, Pflicht), `items[]` je `{group, order[]?}` — **nur diese** Gruppen, in dieser Reihenfolge; darin Attribute in Reihenfolge, ungenannte Attribute hängen unten an ihrer Gruppe |
| `unit:<key>` | `UnitDefined` / `UnitRetired` | `key`, `label{}`, `quantity` (mass, length, volume, data, count …), `factor` zur Basiseinheit der Grösse (Basis = 1) — Saatgut: kg g m cm mm in l ml GB MB TB pc |
| `attribute:<key>` | `AttributeRetired` | `key` |
| `list:<key>` | `ListDefined` | `key`, `label{}`, `columns[]?` (eigene Felder je Eintrag, z. B. ral) |
| `list:<key>` | `ListValueDefined` | `value`, `label{}`, `extra{}?`, `order` |
| `list:<key>` | `ListValueRetired` | `value` |
| `family:<key>` | `FamilyDefined` / `FamilyRetired` | **Altlast** (16.09.2026): Familien sind durch Attributgruppen am Baum ersetzt; der Typ bleibt lesbar, wird nicht mehr geschrieben |

Ein leeres Journal bekommt beim ersten Serverstart das Saatgut aus
`Model.Seeds()` (`AttributeDefinition.cs`): `de`, `en`; `web`, `print`;
Einheiten, Gruppen `mastergroup` (MasterGroup) / `logistics` (ab Variante) / `physical`, Werteliste
`color` (20 Farben, RAL), Attribute `name` `description` `color` `sku` `ean`
`weight`, Sicht `defaultview_<role>` (DefaultViewGruppe/-Produkt/-Variante) je Knotentyp, und der
Wurzelknoten `g-mastertree` (MasterTree) mit den drei Gruppen und dem ★ auf
`name` — als Einträge des Urhebers `system`. Fehlende Ströme werden bei jedem Start nachgesät
(`Catalog.SeedMissing`), Geändertes bleibt; der Wurzelknoten kommt nur, wenn
es ihn nie gab.

`Tree` reagiert nur auf Baum- und Wert-Typen; Modell-Ströme gehen an ihm
vorbei. Werte werden beim Befehl gegen die Definition geprüft (Typ, Achsen,
erlaubte Kanäle, Werteliste), im Journal steht immer ein String.

## Befehle (Server)

Jeder Befehl ist genau ein Eintrag; der Server schreibt ihn über
`Catalog.Execute` und zieht das Abbild im selben Schritt nach. Wer handelt,
steht im Kopf `X-Actor`.

| Aufruf | Eintrag |
|---|---|
| `POST /api/groups` `{parent?, label{}}` | `GroupCreated` — Id vergibt der Server |
| `PUT /api/groups/{id}/label` `{label{}}` | `GroupRenamed` — Altlast |
| `PUT /api/nodes/{id}/name` `{name}` | `NodeNamed` — jede Rolle; leer = Automatik |
| `PUT /api/nodes/{id}/label-attribute` `{attribute}` | `LabelAttributeSet` — nicht html/rows; die Gruppe des Attributs muss am Pfad hängen (aktiv darf sie erst tiefer sein); `attribute` null = weg |
| `POST /api/products` `{group, axes[]?}` | `ProductCreated` — Achsen optional, jede ein Attribut |
| `PUT /api/nodes/{id}/axes` `{axes[]}` | `ProductAxesSet` — nur Produkt ohne Varianten; jede Achse ein Attribut |
| `PUT /api/nodes/{id}/groups` `{groups[]}` | `GroupsAttached` |
| `POST /api/variants` `{product, axisValues{}}` | `VariantCreated` — genau die Produktachsen, Werte geprüft, Kombination eindeutig |
| `POST /api/nodes/{id}/move` `{parent}` | `NodeMoved` |
| `DELETE /api/nodes/{id}` | `NodeRetired` — nur ohne Kinder |
| `POST /api/nodes/{id}/status` `{status}` | `StatusSet` |
| `POST /api/nodes/{id}/attributes` `{attribute, locale?, channel?, value | values[]}` | `AttributeSet` — nur, wenn das Attribut hier **gilt** (Gruppe am Pfad, dort aktiv, `levels`); prüft Achsen, Kanal, Typ, Wörterbuch; `sku` eindeutig über alle Varianten |
| `POST /api/nodes/{id}/categories` `{category}` | `CategoryAssigned` |
| `DELETE /api/nodes/{id}/categories/{category}` | `CategoryRemoved` |
| `POST /api/nodes/{id}/releases` `{channel, locale?}` | `ReleaseGranted` — nur Variante; **abgelehnt, wenn Pflichtfelder der Familie für Kanal × Sprache fehlen** (`locale` leer = alle Sprachen) |
| `POST /api/nodes/{id}/rows` `{attribute}` | `RowAdded` |
| `DELETE /api/nodes/{id}/rows/{attribute}/{row}` | `RowRemoved` |
| `PUT /api/nodes/{id}/rows/{attribute}` `{rows[]}` | `RowOrdered` |
| `DELETE /api/nodes/{id}?recursive=true` | `NodeRetired` für den ganzen Unterbaum, tiefste zuerst, ein Stapel |
| `DELETE /api/nodes/{id}/releases?channel=&locale=` | `ReleaseRevoked` |
| `POST /api/journal` `{actor, stream, type, payload}` | roh, für Import und Werkzeuge — keine Prüfung |
| `PUT /api/nodes/{id}/external/{system}` `{id}` | `ExternalLinked` |
| `DELETE /api/nodes/{id}/external/{system}` | `ExternalUnlinked` |
| `POST /api/batch` `{commands: [{op, ref?, args}]}` | viele Befehle, eine Sperre, eine Stapelkennung. `op`: group.create (`name`), group.rename (Altlast), node.rename (`name`), label.set (`attribute`), product.create, axes.set (`axes[]`), variant.create, node.move, node.retire, status.set, attribute.set (mit `row`), row.add/remove/order, category.assign/remove, release.grant/revoke, external.link/unlink; `args` wie beim Einzelbefehl plus `node`; ein neuer Knoten bekommt `ref`, spätere Befehle verweisen mit `@ref`. Hält beim ersten Fehler an und sagt, wie weit er kam |
| `PUT /api/model/locales/{code}` `{label}` | `LocaleDefined` |
| `PUT /api/model/channels/{key}` `{label{}}` | `ChannelDefined` |
| `PUT /api/model/attributes/{key}` Definition | `AttributeDefined` — prüft Typ, Achsen, Einheit nur bei Zahlen, enum ↔ Werteliste |
| `DELETE /api/model/attributes/{key}` | `AttributeRetired` — **abgelehnt, solange das Attribut an einem Knoten das ★ trägt** (Fehler nennt den Knoten) |
| `PUT /api/model/lists/{key}` `{label{}}` | `ListDefined` |
| `PUT /api/model/lists/{key}/values/{value}` `{label{}, extra?, order}` | `ListValueDefined` |
| `DELETE /api/model/lists/{key}/values/{value}` | `ListValueRetired` |
| `PUT /api/model/groups/{key}` `{label{}, activeFrom?}` · `DELETE` | `AttributeGroupDefined` / `AttributeGroupRetired` (nicht mit Attributen) |
| `PUT /api/model/views/{key}` `{label{}, level, items[]}` · `DELETE` | `ViewDefined` / `ViewRetired` |
| `PUT /api/model/master-locale` `{code}` | `MasterLocaleDefined` — muss eine Sprache des Modells sein |
| `PUT /api/model/units/{key}` `{label{}, quantity, factor}` | `UnitDefined` |
| `DELETE /api/model/units/{key}` | `UnitRetired` — nicht, solange ein Attribut sie benutzt |
