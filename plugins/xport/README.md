# xport — Export nach Vorlage

Stand 20.09.2026. Ein Plugin für alle „Format nach Definition“-Exporte: BMEcat 2005
mit ETIM-Merkmalen, Google Merchant, JSON — und die Definition eines Kunden. Die
Vorlage ist Text und steht mit Zuordnung, Kopfwerten, Merkmalen, Teilbaum und
Sprache in einem **Profil** (`profile:<name>` in den Plugin-Daten, also im Journal).
Oberfläche: ⇪ Export → ‹› Vorlagen-Export (Vorschau der ersten 3 Produkte,
Herunterladen). Job: ⏱ Jobs → Export: Vorlage (`job.mjs`) schreibt das Profil in
ein Verzeichnis. Beide nehmen `core.mjs` — kein DOM, alles über `/api`.

## Vorlagensprache

Dieselbe Schreibweise wie die Vorlagen-Attribute (`Template.cs`), dazu Schleifen.

| Schreibweise | Bedeutung |
|---|---|
| `{feld}` | Wert; leer, wenn nicht da. `{` ohne Namen dahinter (`{"id": …`) bleibt Text |
| `{feld\|plain}` | HTML weg, Entities aufgelöst, Leerraum gestrafft |
| `{feld\|2}` / `{feld\|dec2}` | Zahl mit 2 Stellen — Sprachformat (1.234,50) / mit Punkt (1234.50, xs:decimal) |
| `{feld\|unit}` | Wert mit Einheit des Attributs |
| `{feld\|upper\|lower\|capitalize\|trim\|max80\|xml\|raw}` | Groß/Klein, Kürzen, doppelt entkommen, roh |
| `{feld\|or:name}` | wenn leer: Feld `name` aus dem Kontext — gibt es das nicht, der Text selbst (`or:C62`) |
| `[ … ]` | fällt weg, wenn ein Platzhalter darin leer ist oder eine `{#liste}` darin leer ist. Platzhalter in Schleifen zählen nicht |
| `{#liste} … {/liste}` | je Element; darin `_index` (ab 1), `_first`, `_last`, `_parent` |
| `{^liste} … {/liste}` | wenn leer (auch für `false`) |
| `\{ \[ \] \\` | wörtlich — JSON-Listen brauchen `\[ … \]` |

Werte werden je **Ausgabeart** entkommen: `xml` (`&<>"`), `csv` (Anführungszeichen
bei `;"` und Zeilenumbruch), `json` (JSON-String ohne die Anführungszeichen), `text`.

## Kontext

Kopf: `products`, `groups` (id, name, parent, children, type root|node|leaf), `count`, `locale`,
`languageCode` (deu/eng/…), `today`, `now`, `rootName` — und alle **Kopfwerte**
des Profils (`{catalogId}`, `{supplierName}` … die Ansicht fragt sie ab).

Je Produkt: `id`, `role`, `sku`, `name`, `status`, `parentId`, `path` (Liste id/name),
`pathText`, `f.<feld>` (aus der **Zuordnung** Feld → Attribut, `$sku`, `$name`, `$id`),
`attr.<key>` (`value`, `unit`, `label`; geerbt zählt, Listenwerte als Bezeichnung),
`label.<key>`, `rows.<attribut>` (Zeilen vermehrbarer Attribute, je Spalte
`{ value, unit, label }`), `media` (`id`, `name`, `mime`, `url`, `type`, `isImage`),
`features` (`code`, `value`, `values` — Bereich = zwei —, `unit`, `details`, `label`;
aus dem Profil und, wenn das Plugin etim wirksam ist, aus der ETIM-Klasse am Knoten;
dazu `etim.classCode`), `children` (eine Ebene, ohne Kinder), `axes`.

## Quelle: Publikationsbaum oder Teilbaum

Ein BMEcat ist eine Publikationsstrecke: das Profil nennt einen **Publikationsbaum** (`pub`) —
es gehen nur ausgeleitete Produkte hinaus (Freigabe für den Kanal, Markt, Stand;
`GET /api/pub/{id}/export`), die Rubriken werden die Kataloggruppen (`groups`), `parentId` und
`path` je Produkt zeigen auf die Rubrik. Wertgruppen aus Regel-Verweisen (ohne Knoten) heissen
`v-<bezeichnung>`. Zurückgehaltenes steht in `stats.held`. Ohne `pub` wie bisher: Teilbaum des
Pflegebaums (`root`).

**Regeln der Ausleitung** (`rules` im Profil, für die ETIM-Merkmale): `unknownAs` UN | NA | skip,
`requireClass` (ohne Klasse sperren), `strict` (unpassender Wert sperrt), `minCompleteness`
(Prozent gefüllter Merkmale je Produkt; die Empfänger rechnen das). Verstösse sperren den Export
mit Liste (`gate`); `stats.completeness` = Ø über die klassifizierten Produkte, `stats.classified`.

## Startvorlagen (`templates/`)

- `bmecat-etim5.xml` — ETIM BMEcat Guideline 5.0 (Namensraum etim-international.com/bmecat/50):
  ohne Gruppensystem, PRODUCT_FEATURES und Preis Pflicht, Medien als UDX.EDXF.MIME (MD01/MD22),
  EAN als INTERNATIONAL_PID gtin. Geprüft gegen `bmecat_etim_501.xsd` (Guideline-Paket): gültig.
  Kopfwerte catalogId, catalogVersion, catalogName, currency, supplierName, buyerName, territory,
  etimVersion, priceType (net_customer | net_list | nrp), validFrom.
- `bmecat2005.xml` — BMEcat 2005 T_NEW_CATALOG nach ETIM-BMEcat-Guideline:
  CATALOG_GROUP_SYSTEM aus den Gruppen, PRODUCT mit PRODUCT_FEATURES (ETIM),
  MIME_INFO, PRODUCT_TO_CATALOGGROUP_MAP. Kopfwerte catalogId, catalogVersion,
  catalogName, currency, supplierName, etimVersion. Felder sku, short, long, ean,
  manufacturer, manufacturerPid, keywords, etimClass, orderUnit, contentUnit,
  noCuPerOu, priceQuantity, quantityMin, quantityInterval, price, vat.
  Prüfen gegen das XSD der Guideline: https://etim.de/daten/downloads/
  (ETIM BMEcat Guideline V5.0.1, frei, ohne Anmeldung).
- `google-merchant.xml` — RSS 2.0 mit `g:`-Namensraum; erstes Bild image_link,
  weitere additional_image_link.
- `products.json` — flache Liste mit Medien.

Eigene Vorlagen: in der Ansicht schreiben, als Profil speichern. Eine Datei unter
`templates/` wird zur Startvorlage, wenn sie in `STARTERS` (`entry.js`) steht.
