# Solr (infolox/prodexa-Export) — Quelle für den Import

Stand 17.09.2026. Beispiel: `https://solr-admin.144-bytec.preview.infolox.tools/solr/`
— Solr 7.7.3 im Standalone-Modus (kein SolrCloud), ein Kern `products`,
123 453 Dokumente, nur `lang: de`, Markt `all`. Die Admin-Oberfläche unter
`/solr/#/` ist eine Angular-App über derselben API; alles Nötige liefert
`/solr/products/select` und `/solr/products/schema`. **Kein CORS-Kopf** —
aber Solr antwortet auf `json.wrf=<callback>` mit JSONP (Content-Type
text/plain, kein `nosniff`), und das darf ein `<script>`-Tag laden. Darum
gibt es zwei Werkzeuge mit derselben Abbildung:

- **⇩ Import → Solr** in der Oberfläche (`web/src/views/SolrView.vue`,
  Client `web/src/solr.js`): Quellbaum aufklappen, Knoten anschauen (alles,
  was er hat, und was davon wohin geht), Haken = Teilbaum, Analysieren,
  Schreiben. Belegt 17.09.2026 im eingebauten Browser bis „Analysieren"
  (PoE Switche: 3 Knoten, 41 neue Attribute in 10 Gruppen).
- **`solr_import.py`** (nur Standardbibliothek) für die Kommandozeile und
  grosse Läufe (`--since`, `--limit`).

## Was drin ist

Ein Dokument je Ding und Sprache, Schlüssel `id` = `<master_id>_<lang>`.

| Typ (`type`) | Anzahl | Bedeutung |
|---|---|---|
| `group` | 192 | Baumknoten (Wurzel `node_group_root`, dann `BYTEC_SHOP_Produkte` → Hardware → Netzwerk → Switche …) |
| `product` | 363 | die unterste Ebene des Baums, fast immer mit Varianten darunter (`hasChilds`) |
| `productVariant` | 7 323 | Artikel mit `product_number`; hängen unter `product`, vereinzelt direkt unter `group` |
| `property` | 796 | **Attribut-Definitionen**: `remote_id` = Schlüssel, `name` = Label, `control__section_id__string` = Gruppe (`techData_Hardware`, `propertyGroup_intern` …) |
| `propertyGroup` | 41 | die Gruppen dazu (`techData_*`) |
| `complex_relation`, `image`, `file`, `finder`, `facet`, `partner` | Rest | Relationen, Medien, Suchkonfiguration — nicht im Baum |

Felder eines Baumknotens: `master_id` (Schlüssel fürs Update), `remote_id`,
`name`, `description`, `product_number` (Variante), `main_parent_id`,
`main_path_id[]` (Pfad von der Wurzel, enthält die eigene Id), `main_level`,
`sort_nr`, `preview_image`, `info__changedOn__dateTime`. Werte stehen in
dynamischen Feldern `property__<schlüssel>__<typ>`; der Typ ist das Suffix:
`string`, `multi_string`, `int`, `float`, `boolean`, `xhtml`, `dateTime`,
`multi_image_rel`, `multi_doc_rel` … (Schema: `/schema/dynamicfields`).

## Abbildung auf journali

| Solr | journali |
|---|---|
| `group` | ▣ Produktgruppe, Name aus `name` (leer → `remote_id`) |
| `product` | ▦ Produkt ohne Achsen |
| `productVariant` | ◆ Variante; `product_number` → `sku` |
| Variante direkt unter einer Gruppe | ▦ Sammelprodukt mit dem Namen der Gruppe, Kennung `<gruppe>#variants` |
| `master_id` | externe Kennung `solr:<master_id>` — zweiter Lauf = Update |
| `name` | Attribut `name` (Achse locale = `lang`) |
| `description` | Attribut `description` (locale) |
| `property__<k>__<typ>` | Attribut `slug(k)`; Typ nach Suffix: string/text → text, xhtml → html, int/long → integer, float/double → decimal, boolean, date/dateTime → date (`JJJJ-MM-TT`); `multi_*` → mehrfach; Text und HTML mit Achse locale |
| `property`-Dokument `remote_id` | Label und Attributgruppe des Attributs (`control__section_id__string` → Gruppe `slug(section)`, z. B. `techdata_hardware`); ohne Definition → Gruppe `solr` |
| Fundstellen einer Gruppe | „aktiv ab" der neuen Gruppe = oberste Rolle, an der ein Wert vorkommt (nur Varianten → ab Variante); eine vorhandene Gruppe mit tieferem „aktiv ab" wird angehoben, sonst lehnte der Server den Wert ab |
| `*_rel`, `image`, `file`, `json`, `loc`, `cur` | übergangen — Medien und Relationen kommen später (docs/pflegestruktur.md, 6) |
| `*_finder`, `technical_details`, `group_title`, `prodexa_classification` | übergangen (Ableitungen der Quelle); mehr mit `--skip` |
| `info__changedOn__dateTime` | `--since` holt nur Geändertes |

Die Attributgruppen, die der Teilbaum braucht, werden an die importierte
Wurzel gehängt (`groups.attach`), das ★ dort auf `name` gesetzt — der Baum
heisst dann wie in der Quelle.

## Aufruf

```bash
python plugins/import-tools/solr/solr_import.py --solr https://…/solr/products list --root BYTEC_SHOP_Netzwerk --depth 2
```

```bash
python plugins/import-tools/solr/solr_import.py --solr https://…/solr/products --actor Taloan import --root BYTEC_SHOP_Switche --target g-mastertree --dry-run
```

`--dry-run` zählt nur; `--limit N` nimmt die ersten N Produkte; `--since
2026-09-01T00:00:00Z` nur Geändertes; `--verbose` zeigt jeden Stapel.
Journali läuft auf `localhost:5000` (`--journali` für einen anderen).

Ablauf: Modell zuerst (`PUT /api/model/groups`, `PUT /api/model/attributes`,
nur was fehlt), dann ein Stapel für Wurzel und Gruppen, dann je Produkt ein
Stapel mit seinen Varianten (`POST /api/batch`, unter 9 000 Befehlen je
Stapel). Ein vorhandener Knoten (Kennung `solr`) wird gelesen
(`GET /api/nodes/{id}`) und bekommt nur Werte, die sich unterscheiden.

Belegt 17.09.2026 im Trockenlauf gegen `BYTEC_SHOP_Switche`: 117 Dokumente
→ 118 Knoten (1 Sammelprodukt), 157 neue Attribute in 21 Gruppen, 5 471
Werte, 7 Stapel.
