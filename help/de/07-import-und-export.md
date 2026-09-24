# Import und Export

Import und Export sind Plugins. Unter ⇩ Import und ⇪ Export steht je Format eine Kachel: CSV, Excel, JSON — dazu die
Zwischenablage. Dahinter arbeitet dasselbe Basis-Plugin; die Kachel wählt nur das Format vor. Ein Format erscheint,
solange sein Plugin eingeschaltet ist. IXP und Solr sind eigene Quellen mit eigener Kachel.

## Import

Die Kachel nimmt eine Datei per Ziehen oder Auswahl, ein Blatt aus Excel oder Zeilen aus der Zwischenablage; die erste Zeile sind die Spaltennamen. Vier Schritte:

1. **Quelle**: Datei, Blatt, zuletzt verwendete Dateien.
2. **Ziel**: wohin neue Zeilen kommen. Vorhandene Knoten werden über die journali-Kennung, die SKU oder eine externe Kennung gefunden; eine Spalte Elternteil ordnet Zeilen im Baum ein.
3. **Zuordnung**: der Datenmapper erkennt Spalten an Schlüssel, Bezeichnung, Synonymen und Sprache im Namen, schlägt Typen für neue Attribute vor und ordnet Fremdstatus dem Modell zu. Je Spalte kann eine Umwandlungskette stehen: Zahl, Ja/Nein, Datum, Ersetzen, Aufteilen, Verbinden, Bedingung.
4. **Plan**: analysieren zeigt, was neu, geändert und unverändert wäre, welche Werte nicht zum Typ passen und was das Modell noch braucht. Geschrieben wird erst auf Knopfdruck, als ein Stapel.

Eine Zuordnung mit Ziel und Regeln lässt sich als **Profil** speichern und als Job wiederholen.

## Tabellenexport

⇪ Export → Tabelle liefert einen Teilbaum als Excel oder CSV: Rollen, Sprachen, Attribute, eigene oder auch geerbte Werte. Die Datei ist so gebaut, dass der Tabellenimport sie wieder liest, mit Kennungen und Wurzel. Die Vorlage für einen Knoten gibt es auch per Rechtsklick im Baum.

## JSON

Der JSON-Export schreibt einen Teilbaum als Rohdaten, wahlweise mit dem Modellteil, so dass er sich in ein anderes System einspielen lässt; oder ausgewertet als Baum oder Liste. Der JSON-Import erkennt beides.

## Vorlagen-Export

⇪ Export → Vorlage baut aus einer Textvorlage mit Feldern, Schleifen und Abschnitten eine Datei: BMEcat mit ETIM, Google Merchant, JSON oder eine eigene Definition. Quelle ist ein Publikationsbaum oder ein Teilbaum; Kopfwerte, Zuordnung und Sprache stehen im Profil. Für ETIM lassen sich Sperren setzen: Klasse ist Pflicht, Werte müssen passen, Mindestanteil gefüllter Merkmale.

## Externe Quellen

Die Plugins IXP und Solr lesen einen fremden Baum, zeigen ihn zur Auswahl, ordnen Eigenschaften den Attributen zu und schreiben einen Teilbaum mit Medien und Relationen. Zugangsdaten liegen am Profil beim Server, nie im Journal.

## Als Job

Jeder Import und Export lässt sich unter ⏱ Jobs mit Profil, Verzeichnis und Zeitplan einrichten. Ein Wiederholungsimport ohne Änderung schreibt keinen Eintrag; ein Import schreibt je geändertem Wert genau einen.
