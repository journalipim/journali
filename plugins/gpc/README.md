# gpc — GS1-Produktklassifikation

Stand 30.09.2026. Ansicht: ⌗ Klassifikation → GPC; am Knoten der Punkt „GPC-Klasse (+)“.

## Woher die Daten kommen

Die GPC ist laut GS1 kostenfrei nutzbar. Die Veröffentlichung holt der Anwender bei GS1 (gpc-browser.gs1.org: „Current GPC
standard full package“, ein Zip mit `.xlsx`, `.xml` und `.json`). Das Plugin liest das Zip oder die `.json` darin im Browser.
Im Repo liegen keine GPC-Daten; `sample.json` ist erfunden und hat dieselbe Form.

## Was das Plugin macht

1. **Einlesen** — Segment › Family › Class › Brick; am Brick die Attribute, am Attribut die erlaubten Werte. Attribute und Werte
   haben in allen Bricks dieselben Codes und Titel und stehen darum einmal im Wörterbuch (`dict`), am Brick nur die Codes.
2. **Übernehmen** — ein Datensatz je Segment (`bricks:<segment>`), dazu `dict` und `release` als Plugin-Daten im Journal.
   Eine weitere Sprache (eine andere Datei derselben Version) ergänzt die Titel, die Struktur bleibt.
3. **Suchen** — nach Code, Titel, Weg und Definition; alle Wörter müssen passen.
4. **Zuweisen** — der Server legt an, was fehlt (`/api/classification/assign`): die Gruppe `gpc` (sie trägt das Klassenattribut
   `class_gpc` mit der Liste der Bricks), die Gruppe des Bricks `gpc_<brick>` (Bezeichnung: Code und Name) mit ihren Attributen — je
   GPC-Attribut ein Listenattribut `gpc<code>`, das, wo es schon besteht, nur der Gruppe zugeordnet wird — und hängt die Gruppe des
   Bricks an den Knoten. Hat ein Attribut an einem anderen Brick weitere Werte, ergänzt der Server die Liste.
5. **Am Knoten** — das Band ⌗ GPC zeigt die Klasse (eigen oder geerbt) und die Zahl ihrer Attribute; Knöpfe: Klasse wählen (Dialog mit
   Version, zuletzt gewählten Dateien, Umfeld, KI-Vorschlag, Suche und Durchsehen von Segment bis Brick), Klasse entfernen (samt ihrer
   Gruppe), die Gruppen anhängen, wo sie nicht gelten. Die Attribute der Klasse stehen als eigener Reiter.

## Grenzen

- Die Liste eines Attributs ist die Vereinigung seiner Werte über alle Bricks; welche davon an einem Brick gelten, erzwingt sie
  nicht.
- Kein Export: GPC hängt an GDSN, nicht an BMEcat.
- Hat ein Knoten unter einem mit Klasse eine eigene, gelten an ihm beide Gruppen.

## Daten im Journal (Plugin-Daten)

| Name | Inhalt |
|---|---|
| `release` | Version, Datum, Sprachen, Zählung |
| `dict` | Titel der Attribute, Werte und der oberen Ebenen je Sprache |
| `bricks:<segment>` | die Bricks eines Segments: Weg, Texte je Sprache, Attribute mit den Codes ihrer Werte |
| `settings` | `group`, `classAttr` — nur wenn der Server wegen einer Namenskollision ausgewichen ist |
