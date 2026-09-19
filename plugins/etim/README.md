# etim — ETIM-Klassifikation

Stand 20.09.2026. Braucht `da` (Prüfregel) und `xport` (BMEcat-Export). Ansicht: ⇪ Export → ⌗ ETIM.

## Woher die Daten kommen

Die ETIM-Freigaben sind frei (Open Data Commons Attribution): https://etim.de/daten/downloads/
(Formate, Guideline, Beispiele) und das ETIM CMT (Classification Management Tool) für die
eigentliche Freigabe als **IXF 3.1** (XML; XSD `etim-international.com/etimixf/31`). Die Datei
enthält Units, Features, Values, Groups und Classes — je Klasse die Merkmale mit Einheit und
erlaubten Werten, alles mit Übersetzungen (`de-DE`, `EN`, …).

## Was das Plugin macht

1. **Freigabe lesen** — die IXF-Datei wird im Browser gelesen (`core.mjs: parseIxf`, ohne DOM,
   Regex über den Text; auch grosse Dateien) und bleibt dort. Ins Journal geht nur `release`
   (Name, Nummer, Datum, Zählung).
2. **Klassen übernehmen** — Suche nach Code, Name, Synonym; `+` legt `class:<EC>` als
   Datensatz an: Name, Gruppe, Version, alle Merkmale mit Typ, Einheit (Code, Abkürzung,
   Name) und Werten (EV-Code, Namen). Alles aufgelöst — Job, Prüfung und Export brauchen die
   Freigabe nicht mehr. „aus dem Baum“ übernimmt alle Klassen, die im Klassenattribut stehen.
3. **Attribute anlegen** — Klassenattribut `etim_class` (Werteliste der übernommenen Klassen,
   vererbbar, Gruppe ETIM) und je Merkmal ein Attribut `ef…` in der Gruppe ETIM:
   Numeric → `decimal` mit Einheit (vorhandene Einheit nach Abkürzung, sonst `u_<abk>`),
   Logical → `boolean`, Alphanumeric → `enum` mit Werteliste `ef…` (Wert = EV-Code, Bezeichnung
   = Name), Range → `text` mit Muster „von - bis“. Die Gruppe ETIM gilt erst, wenn sie an
   einem Knoten des Pfads hängt: „⌗ Gruppe an Teilbaum“.
4. **Zuordnung** — Merkmal → vorhandenes Attribut statt eigenem `ef…` (`map` im Journal).
5. **Prüfung** — Klasse unbekannt/nicht übernommen (⚠), Wert passt nicht zum Merkmal (⚠:
   Zahl, Ja/Nein, Bereich, Wert nicht in der Liste), Merkmale ohne Attribut und Belegung (ℹ).
   Dieselbe Regel läuft in ✓ Datenqualität (`checks`).

## Export (xport)

`entry.js` exportiert `featuresOf(pctx)`; xport setzt es als `env.featuresOf` (Ansicht:
`ctx.use('etim')`; Job: `../etim/core.mjs` mit den Daten über `/api`). Je Merkmal der Klasse
nach ETIM-BMEcat-Guideline 5.0: Logical `true`/`false`, Numeric mit Punkt, Range zwei
`FVALUE`, Alphanumeric der EV-Code (aus dem Code oder dem Namen in irgendeiner Sprache),
leer → `-` mit `FVALUE_DETAILS` `UN` (einstellbar: NA oder weglassen). Kein `FUNIT` — die
Einheit steckt im Merkmal. Der Kontext bekommt `features` (`code`, `values`, `details`,
`label`) und `etim.classCode`. Startvorlage „ETIM BMEcat 5.0“ in xport — geprüft gegen
`bmecat_etim_501.xsd`: gültig.

## Daten im Journal (Plugin-Daten)

| Name | Inhalt |
|---|---|
| `release` | zuletzt gelesene Freigabe |
| `class:<EC>` | Klasse aufgelöst (s. o.) |
| `settings` | `classAttr` (Vorgabe `etim_class`), `unknownAs` (UN / NA / skip), `requireClass` |
| `map` | EF-Code → Attributschlüssel, wo nicht das eigene `ef…` gilt |

`sample.xml` ist eine kleine IXF-Datei zum Ausprobieren (2 Klassen, 4 Merkmale — erfunden).
