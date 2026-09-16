# Eintragstypen

Das Vokabular des Journals. Ein Typ ist für immer: neue Typen sind billig,
geänderte teuer, gelöschte unmöglich. Quelle: `Journali.Core/Entries/Types.cs`,
Abbild: `Journali.Core/Projections/ProductCatalog.cs`.

Strom ist immer die SKU des Produkts. Nutzdaten in camelCase, Null-Felder
fehlen. Ein fehlendes `locale`/`channel` heisst „gilt für alle".

| Typ | Nutzdaten | Wirkung im Abbild |
|---|---|---|
| `AttributeSet` | `attribute`, `locale?`, `channel?`, `value` | Wert auf dieser Achse; der letzte gewinnt. Leerer `value` = eigener Wert weg, Rückfall gilt wieder |
| `CategoryAssigned` | `category` | Kategorie dazu |
| `CategoryRemoved` | `category` | Kategorie weg |
| `ReleaseGranted` | `channel`, `locale?` | Freigabe für Kanal (je Sprache oder alle) |
| `ReleaseRevoked` | `channel`, `locale?` | Freigabe weg |

## Rückfall über die Achsen

`ProductState.Resolve(attribute, locale, channel)`: erst die genaue Achse,
dann ohne Kanal, dann ohne Sprache. Ein Wert auf `de/web` überschreibt also
`de`, das wiederum `*`. Die Variantenebene (Modell → Farbe → Grösse) fehlt
noch — sie kommt als eigene Achse dazu, nicht als neuer Typ.

## Modell

Welche Attribute es gibt und welche Achsen sie haben, steht vorläufig fest
in `Model` (`AttributeDefinition.cs`): `name` je Sprache, `description` je
Sprache und Kanal, `weight` und `ean` ohne Achsen. Sprachen `de`, `en`;
Kanäle `web`, `print`. Sobald das Modell selbst pflegbar sein soll, wird es
ein Eintragstyp (`AttributeDefined`) — dann kommt auch das aus dem Journal.

## Befehle (Server)

Jeder Befehl ist genau ein Eintrag; der Server schreibt ihn über
`Catalog.Execute` und zieht das Abbild im selben Schritt nach. Wer handelt,
steht im Kopf `X-Actor`.

| Aufruf | Eintrag |
|---|---|
| `POST /api/products/{sku}/attributes` `{attribute, locale?, channel?, value}` | `AttributeSet` — prüft, dass das Attribut die Achse hat |
| `POST /api/products/{sku}/categories` `{category}` | `CategoryAssigned` |
| `DELETE /api/products/{sku}/categories/{category}` | `CategoryRemoved` |
| `POST /api/products/{sku}/releases` `{channel, locale?}` | `ReleaseGranted` |
| `DELETE /api/products/{sku}/releases?channel=&locale=` | `ReleaseRevoked` |
| `POST /api/journal` `{actor, stream, type, payload}` | roh, für Import und Werkzeuge — keine Prüfung |
