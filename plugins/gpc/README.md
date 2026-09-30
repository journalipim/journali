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
   Eine weitere Sprache (eine andere Datei derselben Fassung) ergänzt die Titel, die Struktur bleibt.
3. **Suchen** — nach Code, Titel, Weg und Definition; alle Wörter müssen passen.
4. **Zuweisen** — der Server legt an, was fehlt (`/api/classification/assign`): die Gruppe `gpc`, das Klassenattribut
   `gpc_class` mit der Liste der Bricks, je GPC-Attribut ein Listenattribut `gpc<code>` mit Bedingung, die Gruppe am Pfad des
   Knotens und die Klasse am Knoten. Hat ein Attribut an einem anderen Brick weitere Werte, ergänzt der Server die Liste.

## Grenzen

- Die Liste eines Attributs ist die Vereinigung seiner Werte über alle Bricks; welche davon an einem Brick gelten, erzwingt sie
  nicht.
- Kein Export: GPC hängt an GDSN, nicht an BMEcat.

## Daten im Journal (Plugin-Daten)

| Name | Inhalt |
|---|---|
| `release` | Fassung, Datum, Sprachen, Zählung |
| `dict` | Titel der Attribute, Werte und der oberen Ebenen je Sprache |
| `bricks:<segment>` | die Bricks eines Segments: Weg, Texte je Sprache, Attribute mit den Codes ihrer Werte |
| `settings` | `group`, `classAttr` — nur wenn der Server wegen einer Namenskollision ausgewichen ist |
