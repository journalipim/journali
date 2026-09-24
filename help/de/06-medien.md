# Medien

Bilder und Dokumente heissen in journali Assets. Ein Asset wird einmal gespeichert und beliebig oft zugeordnet.

## Bibliothek

▨ Medien zeigt alle Assets mit Ordnern, Suche über Name, Kennung und Werte, Sortierung und Gruppierung. Hochladen geht per Knopf oder durch Ziehen; eine Datei, die es schon gibt, wird am Inhalt erkannt und nicht doppelt gespeichert. Ordner sind eine Ablage für die Bibliothek, sie ändern nichts an den Zuordnungen.

Ein Asset trägt eigene Werte: Alt-Text je Sprache, Rechte, dazu Grösse, Typ und Prüfsumme. Zurückziehen nimmt es aus der Bibliothek; die Datei bleibt im Speicher, und das Journal kennt es weiter.

## Zuordnung am Knoten

Am Knoten stehen die Assets unter ▩ Assets. Dateien lassen sich dort ablegen oder aus der Bibliothek wählen, mit Ordner, Suche und Mehrfachauswahl. Eine Zuordnung ist eine Relation vom Typ Bild oder Dokument mit Werten: Reihenfolge, Verwendung, und ob sie **an Subitems vererbt** wird.

Vererbt heisst: das Asset gilt an allen Knoten darunter, ohne Kopie. Ein geerbtes Asset lässt sich an einem Knoten nicht entfernen, nur **sperren**; dann gilt es dort und an allem darunter nicht mehr, und die Sperre lässt sich wieder aufheben. Aufräumen setzt die Assets eines Knotens auf vererben und löst gleiche feste Zuordnungen an den Subitems.

## Vorschauen

Für jedes Bild und jede erste PDF-Seite rechnet ein Job Vorschauen nach den **Presets** unter ⚙ Einstellungen → ▩ Assets: Kachel, Web, Druck, mit Grösse, Format und Qualität. Der Job läuft nach jedem Hochladen und nach jeder Preset-Änderung von selbst; der Knopf ist der Nachzieher. Der Bestand zeigt, wie viele Assets ableitbar sind, wie viele gerechnet wurden, welche ohne Verwendung sind und welche gleichen Inhalt haben.

## Speicher

Wo die Bytes liegen, stellt ⚙ Einstellungen → ▨ Storage ein: in der Datenbank, in einem Verzeichnis auf dem Server oder in einem S3-kompatiblen Speicher. Das Journal kennt nur die Prüfsumme; der Treiber ist wechselbar. Nach einem Wechsel holt die Assetmigration, was im neuen Speicher fehlt.

## Dokumente durchsuchen

Der Job Dokumente lesen zieht den Text aus PDF, Text, HTML, Markdown und XML an den Knoten und legt ihn in einen Index. ⌕ Dokumente durchsucht ihn nach Wörtern, Zahlen und Normen und springt zum Knoten und zur Seite. PDFs ohne Textebene brauchen vorher eine Texterkennung.
