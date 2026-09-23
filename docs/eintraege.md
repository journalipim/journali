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
| `ProductAxesSet` | `axes[]` | Variantenachsen (ganze Liste) — auch mit Varianten (20.09.2026): eine neue Achse nimmt an jeder Variante deren eigenen Wert des Attributs — leere zählen nicht, die Variante bleibt dann ohne Achsenwert und bekommt ihn, sobald der Wert gesetzt wird (`AttributeSet` des Achsenattributs an der Variante = Achsenwert); die Kombination aller Achsen je Produkt bleibt eindeutig (vollständige Kombinationen) — sonst Rückfrage; mit `force` verlieren die doppelten Varianten ihre Achsenzuordnung (Werte bleiben, sie zählen nicht, bis sie unterscheidbar sind); eine entfallene Achse schreibt ihren Wert vorher als `AttributeSet` an die Variante, damit nichts verloren geht |
| `VariantCreated` | `product`, `axisValues{}` | Variante — das Verkaufbare; je Produktachse ein Wert, Kombination je Produkt eindeutig |
| `RubricCreated` | `parent?`, `label{}`, `name?`, `channel?`, `market?` | Rubrik eines Publikationsbaums (Taloan, 20.09.2026; Strom `k-…`, Rolle `rubric`). Ohne `parent` die Wurzel = der Baum eines Kanals, optional für einen Markt (Maximalstruktur; Ausleitungen filtern über das Attribut `markets`). Rubriken tragen Werte wie jeder Knoten (Texte, Bilder, SEO); NodeNamed/NodeMoved/NodeRetired/AttributeSet gelten |
| `PubTreeSet` | `channel`, `market?` | Kanal und Markt der Wurzel ändern |
| `PubStandSet` | `journalNumber?` | Stand einer Rubrik oder Wurzel (Taloan, 21.09.2026, „A“): eingefroren bei #n — alles darunter liest die Pflege wie damals (Ausleitung, Knotenansicht, Export-Job); die nächste Rubrik mit eigenem Stand übersteuert; null = live. Kein Kopieren, ein Zeiger; aktualisieren = neuer Zeiger. `PUT /api/rubrics/{id}/stand` `{now:true}` / `{journalNumber}` / `{}` |
| `RulePlaced` | `rule{id, kind, under?, role?, name?, attribute?, value?, groupBy?, label?}` | Regel-Verweis an einer Rubrik (Taloan, 21.09.2026: Ersatzteilkatalog aus 20 Produktgruppen — „alles, worauf das zutrifft“). `kind` name: Gruppen (`role` group) oder Produkte namens `name` unter `under`; `kind` attribute: Produkte, deren wirksamer Wert von `attribute` gleich `value` ist (geerbt zählt, Listen: enthält). `groupBy` none · parent (Produktgruppe darüber) · attr:&lt;key&gt;. Aufgelöst beim Lesen (`Rules.cs`), im Baum des Stands; nichts wird kopiert. Gleiche `id` ersetzt. `PUT /api/rubrics/{id}/rules`, Vorschau `GET …/rules/preview?kind=…`, Auflösung `GET …/rules/expand` |
| `RuleRemoved` | `id` | Regel weg — die Treffer verschwinden aus der Rubrik, der Pflegebaum bleibt |
| `PlaceNamed` | `node`, `name?` | Anzeigename eines Verweises in dieser Rubrik (Taloan, 21.09.2026: 20 Verweise „Ersatzteile“ intern „Rasenmäher“ nennen) — nur für den Überblick, nie für die Ausgabe (die nimmt Attribute); leer = Pflegename |
| `NodePlaced` | `node`, `order?` | Verweis: Produktgruppe oder Produkt hängt in dieser Rubrik (Strom = Rubrik); derselbe Knoten darf in mehreren Rubriken hängen; keine Vererbung darüber. `order` = Platz in der Rubrik |
| `NodeUnplaced` | `node` | Verweis weg |
| `NodeMoved` | `parent` | Umhängen (Variante unter Produkt, Rubrik unter Rubrik, sonst unter Gruppe; nie unter sich selbst) |
| `NodeOrdered` | `order` | Platz unter den Geschwistern (Rubriken; Taloan, 21.09.2026 — Reihenfolge per Ziehen). Ohne Eintrag alphabetisch |
| `NodeRetired` | — | Knoten aus dem Abbild (nur ohne Kinder); das Journal behält alles — das Abbild legt ihn in den Papierkorb |
| `NodeRestored` | — | Knoten zurück aus dem Papierkorb, mit allem, was er hatte (Werte, Gruppen, Kennungen); der Vater muss im Baum stehen. Rückgängig je Aktion über den Stapel: `POST /api/batches/{batch}/undo` holt genau die Knoten des Stapels zurück |
| `StatusSet` | `status` (Schlüssel aus dem Status-Vokabular des Modells) | Produkt und Variante; Gruppe hat keinen. Saat: draft, active, discontinued |
| `GroupsAttached` | `groups[]` | welche Attributgruppen an diesem Knoten hängen (ganze Liste); die **Definition** vererbt sich nach unten — ob der **Wert** vererbt wird, sagt das Attribut |
| `ExternalLinked` | `system`, `id` | externe Kennung je Quellsystem (Import: Update statt Neuanlage); je System nur ein Knoten |
| `ExternalUnlinked` | `system` | Kennung weg |

Vererbung: `Tree.Resolve` sucht am Knoten (genaue Achse, ohne Kanal, ohne
Sprache), dann bei den Eltern bis zur Wurzel — und sagt, woher der Wert kam.

## Relationen — ein Strom je Relation (`r-…`)

Kante von Knoten zu Knoten mit Typ aus dem Modell; Werte wie am Knoten
(attributierte Relation: Menge, Slot …), docs/pflegestruktur.md, 18.

| Typ | Nutzdaten | Wirkung |
|---|---|---|
| `RelationCreated` | `type`, `from`, `to` | Relation; je Typ nur einmal zwischen denselben Knoten; Rollen laut Typ |
| `RelationRetired` | — | Relation aus dem Abbild |
| `AttributeSet` | wie am Knoten | Wert an der Relation — nur Attribute der Gruppe des Relationstyps |
| `ExternalLinked` / `ExternalUnlinked` | wie am Knoten | Kennung aus der Quelle (Import) |

Ein zurückgezogener Knoten lässt seine Relationen stehen; sie zeigen dann
ins Leere (`other.missing`) bis jemand sie zurückzieht.

## Plugins — Strom `plugin:<key>`

Verwaltung der Plugins (docs/pflegestruktur.md, 19): die Dateien liegen unter
`plugins/<key>/`, der Stand im Journal.

| Typ | Nutzdaten | Wirkung |
|---|---|---|
| `PluginInstalled` | `version`, `manifest` (plugin.json als Text) | installiert oder aktualisiert |
| `PluginEnabled` / `PluginDisabled` | — | an / aus |
| `PluginRemoved` | — | aus dem Abbild; die Dateien bleiben |

Befehle: `GET /api/plugins` (Platte + Journal), `POST /api/plugins/{key}/install | enable | disable`,
`DELETE /api/plugins/{key}`, `POST /api/plugins/{key}/run {params{}}` (Prozess-Plugin: Befehl aus dem
Manifest, `{param}` aus dem Aufruf, `{journali}`/`{actor}` vom Server; Ausgabe am Ende). Dateien
eines Plugins: `GET /plugins/{key}/…` (nur lesend).

## Medien — ein Strom je Medium (`m-…`)

Die Datei liegt ausserhalb (Store, Hash-adressiert); im Journal nur das Ding
(docs/pflegestruktur.md, 20). Zuordnung zum Knoten = Relation (`image`,
`document`, Ziel-Rolle `media`) mit Werten an der Kante (`position`, `usage`).

| Typ | Nutzdaten | Wirkung |
|---|---|---|
| `MediaCreated` | `sha256`, `bytes`, `mime`, `name` | Medium; gleicher Hash = dasselbe Medium (kein zweiter Eintrag) |
| `MediaRetired` | — | Medium aus dem Abbild; die Datei bleibt im Store |
| `AttributeSet` | wie am Knoten | Wert am Medium — nur Attribute der Gruppe `media` (Saatgut `alt_text` je Sprache, `copyright`) |
| `ExternalLinked` / `ExternalUnlinked` | wie am Knoten | Kennung aus der Quelle |
| `MediaFiled` | `folder` (Ordner-Id oder null) | Medium in einen Ordner der Bibliothek gelegt (null = kein Ordner) |
| `MediaDerived` | `preset`, `width`, `height`, `bytes`, `fingerprint` | Ableitung nach Preset liegt im Store (`sha.<preset>`); anderer Fingerabdruck als das Preset = neu rechnen |

Vorschau-Presets (Strom `media-preset:<key>`, Taloan 21.09.2026): `MediaPresetDefined {label, width, height, format, quality, auto}` ·
`MediaPresetRetired`. API: `GET/PUT/DELETE /api/media/presets[/{key}]` (Recht Modell), `GET /api/media/pending`,
`PUT /api/media/{id}/derived/{preset}` (Bytes, Köpfe X-Width/X-Height/X-Fingerprint), `GET /api/media/{id}/{preset}`, `POST /api/media/derive`.

Jobs (`job:<key>`, `docs/tasker-dateien.md`): `JobDefined` trägt seit 21.09.2026 `files` (`base`, `keep`, `latest`, `archive`);
Belege je Datei — die Dateien selbst liegen in den Fächern, nicht im Journal:

| Typ | Nutzdaten | Wirkung |
|---|---|---|
| `JobFileConsumed` | `run` (leer bei Duplikat), `name`, `hash`, `bytes`, `status` ok/failed/duplicate, `mediaId?` | Eingang verarbeitet; `ok`-Hashes merkt das Abbild — gleicher Inhalt läuft nie zweimal |
| `JobFileWritten` | `run`, `name` (mit Laufordner), `hash`, `bytes`, `latest`, `mediaId?` | Ausgabe geschrieben (`latest`: auch unter dem stabilen Namen) |

Medienordner (Taloan, 21.09.2026: „Strukturbaum, um Medien dort zu organisieren, wie ein interner Dateimanager“) — Strom
`mf-…`, nur zum Organisieren der Bibliothek; sagt nichts über Verwendung (Relationen) oder Datei (Store):

| Typ | Nutzdaten | Wirkung |
|---|---|---|
| `MediaFolderCreated` | `name`, `parent` (Ordner-Id oder null) | Ordner; gleicher Name je Ebene nur einmal (prüft der Befehl) |
| `MediaFolderRenamed` | `name` | umbenannt |
| `MediaFolderMoved` | `parent` | anderer Vater (nicht in sich selbst) |
| `MediaFolderRetired` | — | Ordner weg — nur leer; das Abbild schiebt Reste eine Ebene hoch |

## Werte an einem Knoten

| Typ | Nutzdaten | Wirkung im Abbild |
|---|---|---|
| `AttributeSet` | `attribute`, `locale?`, `channel?`, `value` oder `values[]` (mehrfach), `row?` | Wert auf dieser Achse; der letzte gewinnt. Leerer `value` / leere `values` = eigener Wert weg, Fallback gilt wieder. `row`: Zelle einer Zeile eines vermehrbaren Attributs |
| `TranslationMarked` | `attribute`, `locale` (Ziel), `channel?`, `row?`, `sourceHash`, `sourceAt`, `order?` | Übersetzung, die Marke (30; Taloan 22.09.2026): gegen **diese** Quellfassung ist der Zielwert übersetzt. Daraus kommt der Zustand einer Einheit — Hash gleich = fertig, ungleich = im Rückstand, auch wenn der Zieltext gerade erst geschrieben wurde (ein überholter Rücklauf wird eingespielt, nicht verworfen) |
| `ValueSourced` | `attribute`, `locale?`, `channel?`, `row?`, `source`, `title?`, `note?`, `method?` (web, ai, rule, import, manual, pending), `checkedAt?` | **Beleg am Wert** (20.09.2026): woher der Wert auf dieser Achse stammt — URL oder Text (Datenblatt, Katalogseite), Weg, Prüfdatum (leer = Tag des Eintrags). Leere `source` = Beleg weg. Wird der Wert danach geändert, meldet die Sicht den Beleg als veraltet (`stale`). Die Anreicherung schreibt ihn im selben Stapel wie den Wert | `pending` (Taloan, 20.09.): noch kein Wert, aber angefragt — `source` = bei wem, `checkedAt` = Wiedervorlage; die Datenanalyse zeigt ⏳ statt rot, überfällig nach dem Datum
| `RowAdded` | `attribute`, `row` | neue Zeile eines vermehrbaren Attributs (`type: rows`); Kennung `r-…` vergibt der Server |
| `RowRemoved` | `attribute`, `row` | Zeile weg, samt ihren Zellen im Abbild |
| `RowOrdered` | `attribute`, `rows[]` | Reihenfolge; ungenannte Zeilen hinten dran |
| `CategoryAssigned` | `category` | Kategorie dazu — Altlast: Kategorien gibt es seit 17.09.2026 nicht mehr (pflegestruktur §4), Einträge bleiben lesbar |
| `CategoryRemoved` | `category` | Kategorie weg (Altlast, s. o.) |
| `PluginDataSet` | `name`, `value?` | Strom `plugin:<key>`: benannter JSON-Datensatz des Plugins (Profil `config:…`/`run:…`, Vorlage `template:…`, `settings`); leerer `value` = weg; der letzte gewinnt |
| `ReleaseGranted` | `channel`, `locale?` | Freigabe für Kanal (je Sprache oder alle) — nur an der Variante |
| `ReleaseRevoked` | `channel`, `locale?` | Freigabe weg |

## Fallback über die Achsen

`ProductState.Resolve(attribute, locale, channel)`: erst die genaue Achse,
dann ohne Kanal, dann ohne Sprache. Ein Wert auf `de/web` überschreibt also
`de`, das wiederum `*`. Die Variantenebene (Modell → Farbe → Grösse) fehlt
noch — sie kommt als eigene Achse dazu, nicht als neuer Typ.

## Ausleitung eines Publikationsbaums (Taloan, 21.09.2026 — entschieden)

`GET /api/pub/{id}/export?locale=` — je Produkt im Baum (Verweis selbst oder über eine verwiesene Gruppe) ausgeleitet oder zurückgehalten,
mit Grund (`Journali.Core/Projections/Publication.cs`, Tests `PublicationTests`):

1. **Freigabe:** eine Variante ist für den Kanal des Baums freigegeben (`ReleaseGranted`; Kanal-Fallback zählt). Das Produkt ist
   ausgeleitet, wenn mindestens eine Variante ausgeleitet wird; ohne Varianten nie (Freigabe gibt es nur an der Variante).
2. **Markt:** Attribut `markets` (Liste `market`, mehrfach, vererbbar, Saat in `mastergroup`) am Verkaufbaren, geerbt zählt.
   Leer = überall. Sonst muss der Markt des Baums darin stehen — oder ein Markt seiner Fallback-Kette (Spalte `fallback` der Liste
   `market`: ein Markt bekommt das Sortiment seines Fallback-Markts, solange er nichts Eigenes sagt). Baum ohne Markt = kein Filter.

Die Oberfläche (⇶ Publikation) zeigt je Baum „n ausgeleitet · m zurückgehalten“ und die Liste mit Gründen.

**Attributgruppen am Publikationsbaum (Taloan, 21.09.2026 — entschieden):** eine Gruppe, die an einer Rubrik hängt
(`GroupsAttached` am `k-…`-Knoten), gilt für alles, was darunter verwiesen ist — am Verweis selbst oder an einem Vorfahren
(`Tree.EffectiveGroups`, Herkunft = die Rubrik). So hängt der Web-Redakteur „SEO“ an seinen Baum und pflegt es dort, auf der
Kanalachse seines Baums; ein Print-Baum ohne die Gruppe kennt sie nicht. **Pflegewerte sind in der Publikation nur lesbar,
auch für admin** — geändert wird an der Quelle, im Pflegebaum. Pflegbar ist im Publikationsbaum nur, was eine Rubrik-Gruppe
mitbringt.

## Modell — eigene Ströme, ganze Definition je Eintrag

Das Modell steht im Journal (docs/pflegestruktur.md, Grundsatz). Jeder
Eintrag trägt die **ganze** Definition, der letzte je Strom gewinnt; ein
`…Retired` nimmt den Schlüssel aus dem Abbild `ModelCatalog`. Schlüssel:
`[a-z][a-z0-9_]*`, für immer.

| Strom | Typ | Nutzdaten |
|---|---|---|
| `locale:<code>` | `LocaleDefined` / `LocaleRetired` | `code`, `label` — zurückziehen nicht für die Mastersprache und nicht die letzte; Werte auf ihr bleiben im Journal |
| `status:<key>` | `StatusDefined` / `StatusRetired` | Status-Vokabular (Taloan, 22.09.2026): `key`, `label{}` je Sprache, `color` (muted, pos, neg, warn, accent), `icon`, `order`. Lebenszyklus am Markt, nicht Redaktion (das ist der Workflow). `draft` bleibt (Startstatus neuer Knoten); zurückziehen nur, wenn kein Knoten ihn trägt und kein Workflow ihn als Wirkung `status:<key>` nennt; zurückgezogene sät `SeedMissing` nicht wieder. Der Import bildet Fremdstatus (SAP-Materialstatus 300/400/500/501) über die Umwandlung „Tabelle“ auf einen Schlüssel ab (Ziel „Status“, `status.set` im Stapel) |
| `channel:<key>` | `ChannelDefined` / `ChannelRetired` | `key`, `label{}` — zurückziehen nur, wenn kein Attribut ihn nennt (channels, required) |
| `attribute:<key>` | `AttributeDefined` | `key`, `label{}`, `unique` (eindeutig über den Baum, Taloan 21.09.2026 — Text/Zahl, einwertig, auch eine Achse; einschalten mit doppelten Werten im Bestand wird verweigert — erst bereinigen; eindeutige Werte sind die Schlüssel des Knotens: `keys` in der Baumzeile, Name der Variante ohne ★, finden beim Tabellen-Import, kommen beim Kopieren nicht mit), `type` (text, html, integer, decimal, boolean, date, enum, **rows**, **formula** — der Wert ist ein Skript wie JavaScript, gepflegt wie jeder Wert, auch geerbt und je Sprache; das Ergebnis wird beim Lesen gerechnet: `$schlüssel` liest andere Attribute, Variablen, if/else, return, Vorlagen `…${…}…`, `+ - * / % **`, `== != < <= > >=`, `&& || !`, `?:`, `??`, round trunc floor ceil abs min max sqrt format · len upper lower capitalize title trim trimstart trimend squeeze left right substr indexof contains startswith endswith count replace split repeat reverse padleft padright regextest regexmatch regexreplace striphtml escapehtml nl2br slug str number · isblank coalesce; der Server prüft die Syntax beim Setzen; `Formula.cs`), `unit?` (muss es unter `unit:` geben), `group` (Attributgruppe), `axes[]` (locale, channel), `channels[]?`, `list?`, `multiple`, `inheritable` (Wert vererbt sich nach unten; Vorgabe nein), `required{kanal: [sprachen] oder ["*"]}?` (Pflicht — gilt überall gleich, Eineindeutigkeit), `levels[]?` (Ausnahme: an welchen Knotentypen; null = Regel der Gruppe), `columns[]?` (bei rows), `pattern?` (nur text: regulärer Ausdruck, dem jeder Wert ganz genügen muss — E-Mail, Telefon, EAN …; Vorlagen im Modell; `patternHint?` steht in der Fehlermeldung), `releaseWatch?` (Freigabesteuerung, Taloan 22.09.2026: `always` = jede Änderung zählt als Eingriff in Prüfung und Freigabe, `never` = nie, leer = wie die Gruppe) |
| `group:<key>` | `AttributeGroupDefined` / `AttributeGroupRetired` | `key`, `label{}`, `activeFrom?` (group, product, variant: ab welchem Knotentyp Werte erfasst werden; darüber sichtbar, gesperrt), `releaseWatch?` (Freigabesteuerung, Taloan 22.09.2026: `auto`/leer = zählt, wenn die Gruppe ein Pflichtfeld hat, `always` = immer, `never` = nie; das Attribut überschreibt die Gruppe; `ModelCatalog.Watched` ist die eine Auskunft, die Wirkung sagt der Workflow). Gruppen hängen an Knoten (`GroupsAttached`) |
| `relation:<key>` | `RelationTypeDefined` / `RelationTypeRetired` | `key`, `label{}`, `reverse{}` (Bezeichnung vom Ziel aus), `from[]?`/`to[]?` (erlaubte Rollen, null = alle), `group?` (Attributgruppe der Werte an der Relation). Saatgut: accessory, component (Gruppe relation_component mit `quantity`), related |
| `locale:<code>` / `channel:<key>` | `LocaleDefined` / `ChannelDefined` mit `fallback` (Taloan, 20.09.2026) | Fallback: Sprache bzw. Kanal, deren Wert gilt, wenn diese keinen hat — in der Kette vor dem Master (`fr-ch → fr-fr → de → *`); beim Kanal gilt der Fallback auch für Freigaben (Sortiment: `shop_cn` ohne eigene Freigabe → die von `shop_tr`, `Tree.ReleasedVia`). Codes dürfen `-` tragen |
| `settings:master_channel` | `MasterChannelDefined` | `key` — der Masterkanal (Saatgut `web`, Taloan 20.09.2026): bekommt die Werte des Sterns (ohne Kanal) und kann sie überschreiben; die anderen Kanäle beziehen ihren Wert aus ihm — Fallback-Kette je Achse Wert → Master → Stern, Kanal vor Sprache (`Node.Fallback`); die Vollständigkeit zählt ohne Master |
| `translation:<key>` | `TranslationOrdered` / `TranslationReturned` | Übersetzung, das Paket (30): `from`, `to`, `units[]` (Id, `sourceHash`, `targetHash`), `root?`, `channel?`, `attributes[]?`, `scope`, `note?` — ein Zeiger ins Journal, die XLIFF-Datei ist nur die Kopie für unterwegs. Der Rücklauf schliesst ihn: `written`, `behind` (kam überholt zurück, bleibt offen), `conflicts` (Ziel hier geändert), `skipped` |
| `settings:sku_attribute` | `SkuAttributeDefined` | **ausser Kraft** (Taloan, 21.09.2026, am selben Tag: „Kennung raus, alles über eindeutig“) — die Abbilder überlesen ihn; jedes Attribut mit `unique` ist ein Schlüssel |
| `settings:master_locale` | `MasterLocaleDefined` | `code` — die Mastersprache (Saatgut `de`): Pflichtfelder beim Anlegen werden in ihr erfasst; liegt ihr Wert nach dem einer anderen Sprache (Eintragsnummer), gilt die als „zu überarbeiten“ — abgeleitet, kein eigener Eintrag |
| `settings:label:<role>` | `TreeLabelDefined` | **Altlast** (17.09.2026): Name im Baum je Knotentyp — ersetzt durch das ★ am Knoten (`LabelAttributeSet`); bleibt lesbar, wird nicht mehr gesät |
| `view:<key>` | `ViewDefined` / `ViewRetired` | `key`, `label{}`, `level` (Knotentyp, Pflicht), `items[]` je `{group, order[]?}` — **nur diese** Gruppen, in dieser Reihenfolge; darin Attribute in Reihenfolge, ungenannte Attribute hängen unten an ihrer Gruppe |
| `unit:<key>` | `UnitDefined` / `UnitRetired` | `key`, `label{}`, `quantity` (mass, length, volume, data, count …), `factor` zur Basiseinheit der Grösse (Basis = 1) — Saatgut: kg g m cm mm in l ml GB MB TB pc |
| `attribute:<key>` | `AttributeRetired` | `key` — nicht ein ★ |
| `list:<key>` | `ListDefined` / `ListRetired` | `key`, `label{}`, `columns[]?` (eigene Felder je Eintrag, z. B. ral), `closed?` (Taloan, 20.09.2026: geschlossen — Werte aus einer Quelle wie ETIM, kein „+ neuer Wert“ in der Zelle, Werte zufügen nur mit Modell-Recht) — zurückziehen nur, wenn kein Attribut die Liste benutzt |
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

## Nutzung — kein eigener Eintrag

Jeder Eintrag trägt seit dem 22.09.2026 eine **Art** (Spalte `kind`, Taloan:
„eine neue Spalte, die die Art des Eintrags kategorisiert“): `model`,
`structure`, `data`, `publish`, `reference`, `setup`, `ops` (`Kinds` im Kern).
Die Art ist ein Fakt und steht für immer im Eintrag — ob sie **zählt**, sagt
der Tarif und darf sich ändern, ohne die Vergangenheit anzufassen. Wer
schreibt, darf sie mitgeben (`IJournal.Append(..., kind)`; ein Plugin weiss
besser als der Kern, was es tut); fehlt sie — so bei allen Einträgen von vor
der Spalte —, leitet `Kinds.Of(type)` sie aus dem Typ ab. Die Spalte wurde
nachgerüstet wie seinerzeit `batch` (`ADD COLUMN IF NOT EXISTS`), dazu ein
Index `(kind, at)`; ausgewertet wird sie auch direkt: `select kind, count(*)
from journal group by kind`. In der Journalansicht steht je Zeile ein Symbol,
und die Arten sind Filterkacheln.

Das Abbild `Usage` (Kern) zählt beim Durchlauf des Journals mit, wie viele
Einträge an welchem Tag (Ortszeit) geschrieben wurden — zweimal: **alle**
(`AllPerDay`) und das **Tagesgeschäft** (`PerDay`), das allein zählt: die Arten
`data` und `publish` (`Kinds.Counts`). Dazu gehören: Werte und Zeilen pflegen,
Artikel und Varianten anlegen oder zurückziehen, Status, externe Kennungen,
Medien am Artikel, Relationen, Freigaben, Versionen, Workflow-Zustände und
Übersetzungsschritte. Nicht gezählt wird: **Datenmodellierung**
(Attribute, Gruppen, Sichten, Listen, Sprachen, Kanäle, Status,
Relationstypen, Workflow-Designer, Einheiten, Wörterbuch), **Struktur** (Baum
anlegen, umhängen, ordnen, Achsen, Gruppen anhängen), der **Aufbau des
Publikationsbaums** (Rubriken, einsortieren, Regeln, Stand — die Werte dort zu
pflegen zählt aber sehr wohl, auch an einer Rubrik: das ist keine
Datenmodellierung), die **Klassenzuweisung** (ETIM), **Referenzdaten von
aussen** (`PluginDataSet` eines Katalogs samt seinen Wertelisten) und
**Einrichtung und Betrieb** (Plugins, Jobs mit Protokoll, gerechnete
Vorschauen, Benutzer, Rollen). Gemessen an Taloans Journal (17.–22.09.2026):
32 597 von 68 351 Einträgen zählen — der ETIM-Katalog am 20.09. schlug mit
29 183 nicht zählenden zu Buche. Woche (ab Montag) und Monat werden aus den
Tagen gerechnet. Es schreibt selbst nichts und braucht keinen
Eintragstyp — der Verlauf steht damit auch rückwirkend für alles da, was schon
im Journal liegt. `GET /api/usage?history=day|week|month&limit=n` liefert je
Periode `used`, `max`, `start`, `resetAt` und den Verlauf; die Grenzen stehen
vorerst als Annahme in `Limits` (20 000 in der Woche, 100 000 im Monat; **kein
Tageslimit** — Taloan, 22.09.2026: „macht man 3 Testimporte und muss aufhören“).
Zum Messen, was eine Einzelperson braucht; keine Lizenz, keine Sperre. **Lesen und Exportieren zählen nicht mit**, weil die
Endpunkte nichts schreiben (`/api/pub/{id}/export` und `/api/nodes/{id}/table`
sind `MapGet` und verwerfen den Writer). **Die Betriebsspur der Jobläufe zählt ebenfalls nicht** (`JobRunStarted`,
`JobRunFinished`, `JobFileConsumed`, `JobFileWritten` stehen in `Usage.Free`;
Taloan, 22.09.2026: „Sicherung kostet nix“) — was ein Job an Daten schreibt,
zählt weiterhin: ein Import einen Eintrag je geändertem Wert, ein
Wiederholungsimport ohne Änderung gar keinen. Angezeigt wird das in den Einstellungen als
drei Fortschrittsbalken mit Verlauf (`UsageBars.vue`).

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
| `POST /api/nodes/{id}/order` `{parent?, before?}` | `NodeMoved` (wenn der Vater wechselt) + `NodeOrdered` je Geschwister, dessen Platz sich ändert |
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
| `GET /api/nodes/{id}/relations` | `{out[], in[]}` — je Relation Typ, das andere Ende (`other.label`, `missing`), Werte |
| `POST /api/relations` `{type, from, to}` | `RelationCreated` — Id vergibt der Server (`r-…`) |
| `DELETE /api/relations/{id}` | `RelationRetired` |
| `POST /api/relations/{id}/attributes` `{attribute, locale?, channel?, value | values[]}` | `AttributeSet` an der Relation |
| `PUT /api/relations/{id}/external/{system}` `{id}` | `ExternalLinked` an der Relation |
| `PUT /api/model/relations/{key}` `{label{}, reverse{}, from[], to[], group}` · `DELETE` | `RelationTypeDefined` / `RelationTypeRetired` (nicht mit Relationen); `to` darf `media` enthalten |
| `POST /api/media` (multipart `file`) | `MediaCreated` — oder vorhandenes Medium bei gleichem Hash |
| `DELETE /api/media/{id}` | `MediaRetired` |
| `POST /api/media/{id}/attributes` `{attribute, locale?, value | values[]}` | `AttributeSet` am Medium (Gruppe `media`) |
| `PUT /api/media/{id}/external/{system}` `{id}` | `ExternalLinked` am Medium |
| `PUT /api/media/{id}/folder` `{folder}` | `MediaFiled` (null = kein Ordner) |
| `POST /api/media/folders` `{name, parent?}` · `PUT …/{id}/name` `{name}` · `PUT …/{id}/parent` `{parent}` · `DELETE …/{id}` | `MediaFolderCreated` / `MediaFolderRenamed` / `MediaFolderMoved` / `MediaFolderRetired`; `GET /api/media/folders` liest, `GET /api/media?folder=&deep=&sort=&desc=` filtert und sortiert |
| `POST /api/journal` `{actor, stream, type, payload}` | roh, für Import und Werkzeuge — keine Prüfung |
| `PUT /api/nodes/{id}/external/{system}` `{id}` | `ExternalLinked` |
| `DELETE /api/nodes/{id}/external/{system}` | `ExternalUnlinked` |
| `POST /api/batch` `{commands: [{op, ref?, args}]}` | viele Befehle, eine Sperre, eine Stapelkennung. `op`: group.create (`name`), group.rename (Altlast), node.rename (`name`), label.set (`attribute`), product.create, axes.set (`axes[]`), variant.create, node.move, node.retire, node.order (`parent`, `before` = Id oder `@ref`, null = ans Ende), status.set, attribute.set (mit `row`), value.source (`source`, `title`, `note`, `method`, `checkedAt` — Beleg am Wert), row.add/remove/order, category.assign/remove, release.grant/revoke, external.link/unlink, relation.create (`type`, `from`, `to`; bekommt `ref`), relation.retire / relation.attribute.set / relation.external.link (`relation` = Id oder `@ref`), media.attribute.set / media.external.link / media.retire (`media` = Id); `args` wie beim Einzelbefehl plus `node`; ein neuer Knoten bekommt `ref`, spätere Befehle verweisen mit `@ref`. Hält beim ersten Fehler an und sagt, wie weit er kam; mit `?skipErrors=true` (Importe mit Regel „überspringen“) wird der fehlgeschlagene Befehl übersprungen und in `skipped[]` genannt — so fallen doppelte eindeutige Werte aus dem Stapel, der Rest wird geschrieben |
| `PUT /api/model/locales/{code}` `{label}` | `LocaleDefined` |
| `PUT /api/model/channels/{key}` `{label{}}` | `ChannelDefined` |
| `PUT /api/model/statuses/{key}` `{label{}, color, icon, order}` · `DELETE …/statuses/{key}` | `StatusDefined` / `StatusRetired` — DELETE abgelehnt für `draft`, für Status an Knoten und für Wirkungen in Workflows |
| `PUT /api/model/attributes/{key}` Definition | `AttributeDefined` — prüft Typ, Achsen, Einheit nur bei Zahlen, enum ↔ Werteliste |
| `DELETE /api/model/attributes/{key}` | `AttributeRetired` — **abgelehnt, solange das Attribut an einem Knoten das ★ trägt** (Fehler nennt den Knoten) |
| `PUT /api/model/lists/{key}` `{label{}}` | `ListDefined` |
| `PUT /api/model/lists/{key}/values/{value}` `{label{}, extra?, order}` | `ListValueDefined` |
| `DELETE /api/model/lists/{key}/values/{value}` | `ListValueRetired` |
| `PUT /api/model/groups/{key}` `{label{}, activeFrom?, releaseWatch?}` · `DELETE` | `AttributeGroupDefined` / `AttributeGroupRetired` (nicht mit Attributen) |
| `PUT /api/model/views/{key}` `{label{}, level, items[]}` · `DELETE` | `ViewDefined` / `ViewRetired` |
| `PUT /api/model/master-locale` `{code}` | `MasterLocaleDefined` — muss eine Sprache des Modells sein |
| `PUT /api/model/master-channel` `{key}` | `MasterChannelDefined` — muss ein Kanal des Modells sein; der Masterkanal lässt sich nicht zurückziehen |
| `PUT /api/model/units/{key}` `{label{}, quantity, factor}` | `UnitDefined` |
| `DELETE /api/model/units/{key}` | `UnitRetired` — nicht, solange ein Attribut sie benutzt |

## Versionen — am Knotenstrom

Taloan, 19.09.2026: eine Freigabe ist eine Version; nach aussen zählt das Belegdokument (Haftung: „welche Unterlagen galten vor
5 Jahren“), das Journal ist das Register. Nichts wird kopiert oder gelöscht; zurückgezogen wird nur markiert.

| Typ | Payload | Bedeutung |
|---|---|---|
| `VersionCreated` | `nr`, `journalNumber`, `channel`, `locale`, `note`, `retentionYears` | Version `nr` des Knotens = Journalstand `journalNumber` (alles bis dahin ist der Stand, auch das Modell von damals); Aufbewahrung in Jahren (Vorgabe 10) |
| `VersionDocumentAdded` | `nr`, `kind`, `mediaId`, `sha256`, `mime`, `name`, `bytes`, `renderer` | Beleg zur Version — vom Erzeuger-Plugin gerendert, als Medium hochgeladen (unveränderlich, hash-adressiert); derselbe Erzeuger ersetzt seine Belegart |
| `VersionWithdrawn` | `nr`, `reason` | Version gilt nicht mehr (fehlerhaft, ersetzt) — bleibt sichtbar |

Zurückrollen erzeugt keine eigenen Typen: es ist ein Stapel (`batch` `rollback-<knoten>-<nr>-…`) aus `AttributeSet`, `NodeNamed`, `StatusSet`
mit den Werten von damals — eigene Werte des Knotens, nicht die Welt von damals.

## Benutzer — Strom `user:<key>`

Taloan, 19.09.2026: Benutzer und Rollen. Wer es gibt und welche Rolle gilt, steht im Journal; Passwörter, API-Token und
Sitzungen liegen in `auth.json` im Datenverzeichnis — nie im Journal (Regel wie bei `secrets.json`).

| Typ | Payload | Bedeutung |
|---|---|---|
| `UserDefined` | `name`, `email`, `role` (Schlüssel einer Rolle), `enabled` | der Benutzer — der letzte Eintrag gilt ganz |
| `UserRetired` | — | entfernt; Einträge, die er geschrieben hat, bleiben (X-Actor) |
| `UserPrefsSet` | `prefs{}` — Werte als JSON-Text | was die Person für sich eingestellt hat (Taloan, 23.09.2026: „Darstellung sollte auch userspezifisch sein“): Darstellung, Sichtsprachen, Zellen, Sicht je Knotentyp, Anordnung, Umfang, Attributnamen. Nur Genanntes wird gesetzt, leerer Wert nimmt einen Schlüssel weg — ein Wechsel der Darstellung ist ein kleiner Eintrag. Der **Fensterzustand** bleibt im Browser (Serveradresse, Journal auf/zu, zugeklappte Abschnitte, Reihenfolge der Leiste): er ändert sich ständig und gehört zum Gerät. Geschrieben über `PUT /api/auth/me/prefs`, jeder für sich, ohne besonderes Recht |

## Rollen — Strom `role:<key>`

Taloan, 20.09.2026: Rollen sind Daten, Rechte sind Code. Das Vokabular der Rechte (`Rights`: read, write, retire,
release, model, plugins, jobs, storage, users) ist fest; welche Rolle welche hat, steht hier. Saatgut: admin,
manager, editor, reader (docs/betrieb.md).

| Typ | Payload | Bedeutung |
|---|---|---|
| `RoleDefined` | `label`, `rights[]` | die Rolle — der letzte Eintrag gilt ganz; unbekannte Rechte werden übergangen |
| `RoleRetired` | — | weg (nur ohne Benutzer; `admin` nie) |

## Jobs (fest eingebaut: ⏱ Jobs) — Strom `job:<key>`

| Typ | Nutzlast | Bedeutung |
|---|---|---|
| `JobDefined` | `label`, `plugin`, `service` (Dienst aus `processes[]`, leer = `process`), `params{}`, `schedule` (cron „m h tag monat wochentag“, dazu `dN:Datum`/`wN:Datum` = alle N Tage/Wochen; leer = nur von Hand), `enabled`, `timeoutMinutes` | der Job — Plugin mit Prozess und Parametern; Geheimnisse (`secret: true` im Manifest) stehen nicht hier, sondern in `jobs/secrets.json` beim Server |
| `JobRetired` | — | Job weg; seine Läufe bleiben im Journal |
| `JobRunStarted` | `run`, `trigger` (schedule, manual) | Lauf begonnen — Urheber `job:<key>` |
| `JobRunFinished` | `run`, `status` (ok, failed, timeout, cancelled), `exit`, `seconds`, `summary`, `logBytes` | Lauf zu Ende; das Log liegt als Datei `jobs/<key>/<run>.log` |

