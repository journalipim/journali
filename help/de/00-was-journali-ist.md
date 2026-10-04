# Was journali ist

journali verwaltet Produktdaten: Produktgruppen, Produkte und Varianten mit ihren Werten, Bildern, Dokumenten und Beziehungen, in mehreren Sprachen und für mehrere Kanäle. Daraus werden Shops, Kataloge, Datenblätter und Schnittstellen beliefert.

## Das Journal

Jede Änderung ist ein Eintrag in einem Journal: ein Knoten wird angelegt, ein Wert gesetzt, ein Bild zugeordnet, eine Freigabe erteilt. Ein Eintrag wird nie überschrieben und nie gelöscht. Der aktuelle Stand der Daten ist eine Ableitung aus allen Einträgen, ebenso jede Version, jeder Export und jeder Verlauf.

Das hat drei Folgen, die im Alltag sichtbar sind:

- **Nichts geht verloren.** Ein zurückgezogener Knoten, ein überschriebener Wert, ein entferntes Bild bleiben im Journal und lassen sich zurückholen. Rückgängig ist kein Sonderfall, sondern ein weiterer Eintrag.
- **Jeder Stand ist nachvollziehbar.** Zu jedem Wert steht, wer ihn wann gesetzt hat und was vorher galt. Eine Version friert einen Journalstand ein und hängt die Dokumente an, die damit nach draussen gingen.
- **Abbilder sind austauschbar.** Baum, Modell, Suche und Statistik werden aus dem Journal gebaut. Sind sie beschädigt, werden sie neu gebaut, nicht repariert.

## Die Achsen

Ein Wert kann je **Sprache** und je **Kanal** verschieden sein. Der Stern ist der Wert ohne Sprache und ohne Kanal, die Mastersprache und der Masterkanal sind die Bezugspunkte, von denen andere Sprachen und Kanäle ihren Wert beziehen, solange sie nichts Eigenes haben. Werte **vererben** sich im Baum von oben nach unten, wenn das Attribut vererbbar ist.

## Die Bausteine

| Baustein | Was er ist |
|---|---|
| Modell | Attribute, Attributgruppen, Wertelisten, Sichten, Einheiten, Sprachen, Kanäle, Status |
| Pflegebaum | Produktgruppen, Produkte, Varianten mit ihren Werten |
| Medien | Bilder und Dokumente, einmal gespeichert, an Knoten zugeordnet |
| Publikation | Je Kanal ein Baum, der bestimmt, was hinausgeht |
| Plugins | Import, Export, Datenblatt, Übersetzung, Prüfungen, Jobs |
| Journal | Der Verlauf aller Änderungen, mit Filter und Suche |

## Wo etwas liegt

Alles Fachliche steht im Journal in der Datenbank. Bilder und Dokumente liegen im Assetspeicher, wahlweise in der Datenbank, in einem Verzeichnis oder in einem S3-kompatiblen Speicher. Passwörter, Token, Mail- und Speichereinstellungen liegen verschlüsselt im Tresor in der Datenbank, ohne Datenbank in Dateien beim Server — nie im Journal.
