# etim — ETIM-Klassifikation

Stand 20.09.2026. Braucht `da` (Prüfregel) und `xport` (BMEcat-Export). Ansicht: ⇪ Export → ⌗ ETIM.

## Woher die Daten kommen

Die ETIM-Freigaben sind frei (Open Data Commons Attribution): https://etim.de/daten/downloads/
(Formate, Guideline, Beispiele) und das ETIM CMT (Classification Management Tool) für die
eigentliche Freigabe als **IXF 3.1** (XML; XSD `etim-international.com/etimixf/31`). Die Datei
enthält Units, Features, Values, Groups und Classes — je Klasse die ETIM-Attribute mit Einheit und
erlaubten Werten, alles mit Übersetzungen (`de-DE`, `EN`, …).

## Was das Plugin macht

1. **Freigabe lesen** — die IXF-Datei wird im Browser gelesen (`core.mjs: parseIxf`, ohne DOM,
   Regex über den Text; auch grosse Dateien) und bleibt dort. Ins Journal geht nur `release`
   (Name, Nummer, Datum, Zählung).
2. **Klassen übernehmen** — Suche nach Code, Name, Synonym; `+` legt `class:<EC>` als
   Datensatz an: Name, Gruppe, Version, alle ETIM-Attribute mit Typ, Einheit (Code, Abkürzung,
   Name) und Werten (EV-Code, Namen). Alles aufgelöst — Job, Prüfung und Export brauchen die
   Freigabe nicht mehr. „aus dem Baum“ übernimmt alle Klassen, die im Klassenattribut stehen.
3. **Attribute anlegen** — Klassenattribut `etim_class` (Werteliste der übernommenen Klassen,
   vererbbar, Gruppe ETIM) und je ETIM-Attribut ein Attribut `ef…` in der Gruppe ETIM:
   Numeric → `decimal` mit Einheit (vorhandene Einheit nach Abkürzung, sonst `u_<abk>`),
   Logical → `boolean`, Alphanumeric → `enum` mit Werteliste `ef…` (Wert = EV-Code, Bezeichnung
   = Name), Range → `text` mit Muster „von - bis“. Die Gruppe ETIM gilt erst, wenn sie an
   einem Knoten des Pfads hängt: „⌗ Gruppe an Teilbaum“.
4. **Zuordnung** — ETIM-Attribut → vorhandenes Attribut statt eigenem `ef…` (`map` im Journal).
5. **Prüfung** — Klasse unbekannt/nicht übernommen (⚠), Wert passt nicht zum ETIM-Attribut (⚠:
   Zahl, Ja/Nein, Bereich, Wert nicht in der Liste), ETIM-Attribute ohne Attribut und Belegung (ℹ).
   Dieselbe Regel läuft in ✓ Datenqualität (`checks`).

## Datenanalyse (✓ Datenanalyse → ⌗ ETIM-Attribute)

Dieselbe Prüfmaschine wie DPP/PPWR (`ctx.compliance`), der Katalog ist dynamisch: Datenpunkte =
Klasse + alle ETIM-Attribute der übernommenen Klassen; ein ETIM-Attribut gilt an einem Knoten nur, wenn seine
Klasse es hat (`appliesIf`). Zuordnung ETIM-Attribut → Attribut (Best Guess, gemerkt als `mapping`;
der Export nimmt sie mit), fehlende Attribute legt der Katalog selbst an (`createAttribute`:
Listen, Einheiten), je Knoten die Matrix erfüllt/leer/fraglich, Vorschläge aus Regeln, von der
KI aus den vorhandenen Werten oder mit **Recherche im Internet** (Handelsware — s. Plugin
`enrich`), übernehmen als Stapel.

## Export (xport)

`entry.js` exportiert `featuresOf(pctx)`; xport setzt es als `env.featuresOf` (Ansicht:
`ctx.use('etim')`; Job: `../etim/core.mjs` mit den Daten über `/api`). Je ETIM-Attribut der Klasse
nach ETIM-BMEcat-Guideline 5.0: Logical `true`/`false`, Numeric mit Punkt, Range zwei
`FVALUE`, Alphanumeric der EV-Code (aus dem Code oder dem Namen in irgendeiner Sprache),
leer → `-` mit `FVALUE_DETAILS` `UN` (einstellbar: NA oder weglassen). Kein `FUNIT` — die
Einheit steckt im ETIM-Attribut. Der Kontext bekommt `features` (`code`, `values`, `details`,
`label`) und `etim.classCode`. Startvorlage „ETIM BMEcat 5.0“ in xport — geprüft gegen
`bmecat_etim_501.xsd`: gültig.

## Der Weg

ETIM ist Klassifikation, kein Export (Leiste: ⌗ Klassifikation). Bedient wird am Knoten: das Band
⌗ ETIM in der Knotenansicht (Beitragspunkt `nodeBands`) zeigt die Stufen mit Zahlen, jede springt
ins vorhandene Werkzeug; die Ansicht des Plugins ist nur Quelle, Versionen, Klassen, Attribute,
Zuordnung:

Beim Einschalten des Plugins (`install`) entsteht die Gruppe `etim` und hängt an jeder Wurzel des Pflegebaums.
Namenskollision: gibt es `etim` schon mit fremden Attributen, weicht ETIM auf `etim_std` aus (Meldung; in den
Einstellungen wählbar); dasselbe gilt für das Klassenattribut (`etim_klasse`) und für Sichten, die jemand anderem gehören.

Jede Zuweisung stellt sicher, dass die Klasse danach pflegbar ist: Gruppe `etim` anlegen (falls gelöscht) und an den
Pfad des Knotens hängen, Klassenattribut anlegen, je ETIM-Attribut ein Attribut im Modell — danach wird geprüft und
gemeldet, was noch fehlt (`readiness` im Kern). Fehlt etwas später wieder, hat das Band den Knopf dafür.

1. **Klasse** — eigen oder geerbt (Regelfall: an der Produktgruppe, erbt auf alles darunter;
   Ausnahme am Produkt), ≠ abweichende Klassen darunter. „Klasse zuweisen …“ öffnet den Dialog
   (Vorschlag, Umfeld, Suche, Ebene mit Empfehlung).
2. **Attribute** — die ETIM-Attribute der Klasse: n von m als Attribut, zugeordnet, mit ƒ, fehlend.
   „zuordnen …“ filtert die Zuordnung auf die Klasse; Standard ist ein **vorhandenes Attribut**
   mit **ƒ** (Einheit, ja/x → Ja/Nein, Text → EV-Code nach Tabelle, von/bis) — ein eigenes
   `ef…` ist der Ausweg („＋ n anlegen“, Gruppe `etim`, nur an Produkt und Variante).
2a. **Sicht** — „◫ Sicht“ baut je Rolle eine Attributsicht `etim_<klasse>_<rolle>` („⌗ EC004718 Laptop“) mit genau
   den Attributen dieser Klasse (das Klassenattribut vorn, zugeordnete Attribute in ihrer eigenen Gruppe) und wählt sie
   am Knoten — der Reiter zeigt dann nur diese Attribute. Jede Zuweisung schreibt die Sicht neu.

3. **Daten** — Produkte darunter × ETIM-Attribute: % gefüllt, leer, passen nicht. „⊞ Tabelle“ öffnet
   die Subitems-Tabelle mit genau den Spalten der Klasse (Excel-Bedienung); „✓ prüfen“ dieselbe
   Regel wie in ✓ Datenqualität.
4. **Ausleitung** — BMEcat-Profile des Vorlagen-Exports (xport): **Publikationsbaum** + Kanal +
   Vorlage; die Regeln der Ausleitung (leer, Klasse Pflicht, Werte müssen passen,
   Vollständigkeit ≥ n %) stehen dort im Profil, nicht hier.

Kein Profil im Plugin: Release, Klassenattribut, Gruppe und Zuordnung (`map`: Schlüssel oder
`{ to, steps }`) sind einmal je Journal. Grundlagen (Releases, Klassen in Gebrauch, Attribute,
Zuordnung) stehen unter der Übersicht, zugeklappt.

## Daten im Journal (Plugin-Daten)

| Name | Inhalt |
|---|---|
| `release` | zuletzt gelesene Freigabe |
| `class:<EC>` | Klasse aufgelöst (s. o.) |
| `settings` | `group` (Attributgruppe der ETIM-Daten, Vorgabe `etim` — gibt es sie nicht, wird sie angelegt; eine vorhandene heißt: dort zuordnen, „↻ in … zuordnen“ rät nach Namen), `classAttr` (Vorgabe `etim_class`), `unknownAs` (UN / NA / skip), `requireClass` |
| `map` | EF-Code → Attributschlüssel, wo nicht das eigene `ef…` gilt |

`sample.xml` ist eine kleine IXF-Datei zum Ausprobieren (2 Klassen, 4 ETIM-Attribute — erfunden).
