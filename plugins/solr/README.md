# Solr (Export eines anderen PIM) — Quelle für den Import

Stand 17.09.2026. Untersucht an einer Kundeninstanz (Adresse nicht im Repo)
— Solr 7.7.3 im Standalone-Modus (kein SolrCloud), ein Kern `products`,
123 453 Dokumente, nur `lang: de`, Markt `all`. Die Admin-Oberfläche unter
`/solr/#/` ist eine Angular-App über derselben API; alles Nötige liefert
`/solr/products/select` und `/solr/products/schema`. **Kein CORS-Kopf** —
aber Solr antwortet auf `json.wrf=<callback>` mit JSONP (Content-Type
text/plain, kein `nosniff`), und das darf ein `<script>`-Tag laden — ohne Anmeldung.
Seit dem 28.09.2026 ist der Kern ein **Zugang** (⌁ Zugänge, Plugin `driver`, Art `solr`: Adresse, Name,
Passwort beim Server): die Ansicht liest über `GET /api/drivers/<zugang>/relay?path=…`, der Server meldet
sich an — kein CORS, kein Passwort im Browser. JSONP bleibt nur für eine freie Adresse ohne Zugang.
Es gibt zwei Wege mit **einem** Ablauf (`lauf.mjs`) und **einer** Abbildung
(`solr.js`) — seit dem 23.09.2026 beide auf node:

- **⇩ Import → Solr** in der Oberfläche (`src/View.vue`): Quellbaum aufklappen,
  Knoten anschauen (alles, was er hat, und was davon wohin geht), Haken =
  Teilbaum, Analysieren, Schreiben. Solr liest der Browser über den Zugang.
- **Der Job** (`job.mjs`, Prozess-Plugin): derselbe Ablauf auf dem Server, Solr
  per fetch (mit Basic-Anmeldung aus dem Zugang), journali mit dem Dienst-Token des Laufs. Für grosse Läufe — er
  hängt an keinem offenen Browserfenster.

## Was drin ist

Ein Dokument je Ding und Sprache, Schlüssel `id` = `<master_id>_<lang>`.

| Typ (`type`) | Anzahl | Bedeutung |
|---|---|---|
| `group` | 192 | Baumknoten (Wurzel `node_group_root`, dann `<KUNDE>_SHOP_Produkte` → Hardware → Netzwerk → Switche …) |
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
| `property`-Dokument `remote_id` | Label und Attributgruppe des Attributs (`control__section_id__string` → Gruppe `slug(section)`, z. B. `techdata_hardware`); ohne Gruppe in der Quelle → nach dem Anfang des Schlüssels (`abmessung_a_max` → Gruppe `abmessung`, mindestens 5 Attribute; weniger Verwandte → „Weitere Merkmale“) |
| Fundstellen einer Gruppe | „aktiv ab" der neuen Gruppe = oberste Rolle, an der ein Wert vorkommt (nur Varianten → ab Variante); eine vorhandene Gruppe mit tieferem „aktiv ab" wird angehoben, sonst lehnte der Server den Wert ab |
| `*_rel`, `image`, `file`, `json`, `loc`, `cur` | übergangen — Medien und Relationen kommen später (docs/pflegestruktur.md, 6) |
| `*_finder`, `technical_details`, `group_title`, `prodexa_classification` | übergangen (Ableitungen der Quelle); mehr mit `--skip` |
| `info__changedOn__dateTime` | `--since` holt nur Geändertes |

Die Attributgruppen, die der Teilbaum braucht, werden an die importierte
Wurzel gehängt (`groups.attach`), das ★ dort auf `name` gesetzt — der Baum
heisst dann wie in der Quelle.

## Relationen (zweiter Lauf)

Kanten stehen in der Quelle an den Knoten: `property__<typ>__multi_doc_rel`
(`accessory` 108 Knoten, `component` 129, `service` 70 …) → einfache
Relation mit Typ = Schlüssel (fehlende Typen werden angelegt: Label = Schlüssel,
umgekehrt „… von"). `component_complex` zeigt auf die `complex_relation`-
Dokumente (109 376): je Kante Menge, Min/Max/Schritt, Richtung, Slots — das
werden die Werte der `component`-Kante (Gruppe `relation_component`,
Attribute nach Suffix). Kennung der Kante: `master_id` des complex-Dokuments,
sonst `<quelle>><typ>><ziel>`; zweiter Lauf schreibt nur Unterschiede.
Beide Enden müssen importiert sein — „Ziel fehlt" zählt, was übersprungen
wurde; Kanten auf sich selbst (kommt vor) überspringt journali.

In der Oberfläche: Plan → „⇄ Relationen" → analysieren / schreiben für die
angehakten Teilbäume. Im Job: Schalter `relations`.

## Aufruf als Job

Im Tasker einen Job auf `solr` anlegen; die Werte kommen aus dem Profil oder
stehen am Job:

| Parameter | Bedeutung |
|---|---|
| `profile` | Profil aus ⇩ Import → Solr (Kern, Ziel, Wurzeln, übergangene Schlüssel) |
| `zugang` | Zugang der Art `solr` — Adresse und Anmeldung (`JOURNALI_ZUGANG_URL`, `_USER`, `_PASSWORD`) |
| `base` | URL des Solr-Kerns ohne Anmeldung (ältere Profile; der Zugang geht vor) |
| `roots` | Solr-Ids der Wurzeln, mit Komma |
| `target` | Zielknoten in journali (leer = oberste Ebene) |
| `skip` | zusätzlich zu übergehende Felder |
| `relations` | nach den Knoten auch die Kanten |
| `dry_run` | nur analysieren, nichts schreiben |

Von Hand geht es auch:

```bash
node plugins/solr/job.mjs http://localhost:5000 admin
```

Der Rest kommt dann aus der Umgebung (`JOURNALI_ZUGANG_URL` oder `JOURNALI_BASE`, `JOURNALI_ROOTS`,
`JOURNALI_TARGET`, `JOURNALI_SKIP`, `JOURNALI_RELATIONS`, `JOURNALI_DRY_RUN`).

Ablauf: Modell zuerst (`PUT /api/model/groups`, `PUT /api/model/attributes`,
nur was fehlt), dann ein Stapel für Wurzel und Gruppen, dann je Produkt ein
Stapel mit seinen Varianten (`POST /api/batch`, unter 9 000 Befehlen je
Stapel). Ein vorhandener Knoten (Kennung `solr`) wird gelesen
(`GET /api/nodes/{id}`) und bekommt nur Werte, die sich unterscheiden.

Belegt 17.09.2026 im Trockenlauf gegen `<KUNDE>_SHOP_Switche`: 117 Dokumente
→ 118 Knoten (1 Sammelprodukt), 157 neue Attribute in 21 Gruppen, 5 471
Werte, 7 Stapel.

**Gruppen neuer Attribute** — die Regeln stehen in `plugins/table/anlage.mjs` und gelten für jeden Import (auch IXP):

- **Eine Ebene je Gruppe.** Eine Gruppe enthält Attribute, deren Werte in der Quelle auf derselben Ebene stehen (Gruppe, Produkt, Variante), und ist dort „aktiv ab“. Attribute
  oberhalb der Varianten sind **vererbbar**: die Varianten bekommen den Wert, ohne ihn zu wiederholen — und was ein Produkt trägt, schreibt der Import an der Variante nicht noch einmal.
  Spannt ein Thema mehrere Ebenen, wird je Ebene eine Gruppe daraus („Abmessung (Produkt)“, „Abmessung (Variante)“); sonst heisst sie nur „Abmessung“.
- **Das Thema** nennt die Quelle (Gruppe der Attributdefinition); fehlt sie, der Anfang des Schlüssels (`abmessung_a_max` → Abmessung, mindestens 5 Attribute; technische
  Anfänge wie `ctrl_` und was weniger Verwandte hat → „Weitere Merkmale“).
- **Namen:** die Bezeichnung des Attributs aus der Quelle, sonst aus dem Schlüssel (`abmessung_a_max` → „Abmessung a max“, Kennungen wie `d28e55178` entfallen).

Parameter `group_by`: `auto` (Vorgabe) nimmt das Thema der Quelle, wo es eines gibt, sonst den Anfang des Schlüssels; `section` nur die der Quelle; `prefix` nur den Anfang; `single`
alles in `solr`. Der Plan nennt jede neue Gruppe mit der Zahl ihrer Attribute — im Trockenlauf steht dort, was der Lauf anlegen würde.

**Attribute der Gruppe `solr` neu ordnen** (Parameter `regroup`, mit Trockenlauf prüfen): kein Import, sondern das Modell. Die Attribute, die früher alle in `solr` landeten,
bekommen Thema und Ebene wie oben — die Ebene liest der Job aus der Quelle (Kern und Wurzel wie beim Import). Die neuen Gruppen hängen an den Knoten, an denen `solr` hing; Attribute
oberhalb der Varianten werden vererbbar, die Bezeichnungen lesbar. Die Werte bleiben, wo sie sind. Attribute ohne Wert in der Quelle bleiben in `solr`. Braucht das Recht „Modell ändern“.
