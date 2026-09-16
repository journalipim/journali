# Eintragstypen

Das Vokabular des Journals. Ein Typ ist für immer: neue Typen sind billig,
geänderte teuer, gelöschte unmöglich. Quelle: `Journali.Core/Entries/Types.cs`,
Abbild: `Journali.Core/Projections/ProductCatalog.cs`.

Strom ist immer die SKU des Produkts. Nutzdaten in camelCase, Null-Felder
fehlen. Ein fehlendes `locale`/`channel` heisst „gilt für alle".

| Typ | Nutzdaten | Wirkung im Abbild |
|---|---|---|
| `AttributeSet` | `attribute`, `locale?`, `channel?`, `value` oder `values[]` (mehrfach) | Wert auf dieser Achse; der letzte gewinnt. Leerer `value` / leere `values` = eigener Wert weg, Rückfall gilt wieder |
| `CategoryAssigned` | `category` | Kategorie dazu |
| `CategoryRemoved` | `category` | Kategorie weg |
| `ReleaseGranted` | `channel`, `locale?` | Freigabe für Kanal (je Sprache oder alle) |
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
| `attribute:<key>` | `AttributeDefined` | `key`, `label{}`, `type` (text, html, integer, decimal, boolean, date, enum), `unit?`, `group?`, `axes[]` (locale, channel), `channels[]?`, `list?`, `multiple` |
| `attribute:<key>` | `AttributeRetired` | `key` |
| `list:<key>` | `ListDefined` | `key`, `label{}` |
| `list:<key>` | `ListValueDefined` | `value`, `label{}`, `extra{}?`, `order` |
| `list:<key>` | `ListValueRetired` | `value` |
| `family:<key>` | `FamilyDefined` | `key`, `label{}`, `attributes[]` je `{key, group?, required{kanal: [sprachen] oder ["*"]}}`, `axes[]` (Variantenachsen = Attribute) |
| `family:<key>` | `FamilyRetired` | `key` |

Ein leeres Journal bekommt beim ersten Serverstart das Saatgut aus
`Model.Seeds()` (`AttributeDefinition.cs`): `de`, `en`; `web`, `print`;
`name`, `description`, `weight`, `ean` — als Einträge des Urhebers `system`.

`ProductCatalog` reagiert nur auf Produkt-Typen; Modell-Ströme gehen an ihm
vorbei. Werte werden beim Befehl gegen die Definition geprüft (Typ, Achsen,
erlaubte Kanäle, Werteliste), im Journal steht immer ein String.

## Befehle (Server)

Jeder Befehl ist genau ein Eintrag; der Server schreibt ihn über
`Catalog.Execute` und zieht das Abbild im selben Schritt nach. Wer handelt,
steht im Kopf `X-Actor`.

| Aufruf | Eintrag |
|---|---|
| `POST /api/products/{sku}/attributes` `{attribute, locale?, channel?, value | values[]}` | `AttributeSet` — prüft Attribut, Achsen, Kanal, Typ, Werteliste |
| `POST /api/products/{sku}/categories` `{category}` | `CategoryAssigned` |
| `DELETE /api/products/{sku}/categories/{category}` | `CategoryRemoved` |
| `POST /api/products/{sku}/releases` `{channel, locale?}` | `ReleaseGranted` |
| `DELETE /api/products/{sku}/releases?channel=&locale=` | `ReleaseRevoked` |
| `POST /api/journal` `{actor, stream, type, payload}` | roh, für Import und Werkzeuge — keine Prüfung |
| `PUT /api/model/locales/{code}` `{label}` | `LocaleDefined` |
| `PUT /api/model/channels/{key}` `{label{}}` | `ChannelDefined` |
| `PUT /api/model/attributes/{key}` Definition | `AttributeDefined` — prüft Typ, Achsen, Einheit nur bei Zahlen, enum ↔ Werteliste |
| `DELETE /api/model/attributes/{key}` | `AttributeRetired` |
| `PUT /api/model/lists/{key}` `{label{}}` | `ListDefined` |
| `PUT /api/model/lists/{key}/values/{value}` `{label{}, extra?, order}` | `ListValueDefined` |
| `DELETE /api/model/lists/{key}/values/{value}` | `ListValueRetired` |
| `PUT /api/model/families/{key}` Definition | `FamilyDefined` — prüft Attribute, Kanäle, Sprachen, Achsen |
| `DELETE /api/model/families/{key}` | `FamilyRetired` |
