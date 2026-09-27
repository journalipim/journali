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

Der Job Dokumente lesen zieht den Text aus PDF, Text, HTML, Markdown und XML an den Knoten und legt ihn in einen Index. ⌕ Dokumente durchsucht ihn nach Wörtern, Zahlen und Normen und springt zum Knoten und zur Seite.

PDFs ohne Textebene sind Bilder von Text. Der Job Texterkennung (Plugin ocr) erkennt sie und legt den Text in denselben Index; ein Bild kommt in diese Liste, wenn es das Stichwort „Text erkennen“ trägt. Die Erkennung läuft auf dem Server, ohne Schlüssel und ohne fremden Dienst.

## Suche nach Sinn

Neben der Wortsuche gibt es die Suche nach Sinn. Sie findet Abschnitte, die dasselbe meinen wie die Frage, auch wenn kein Wort übereinstimmt: „wasserfester Leim für Gartenmöbel“ findet den Abschnitt über Holzklebstoff für aussen. In ⌕ Dokumente steht die Wahl als drei Chips: Wörter, Sinn, Beides. Wörter ist genau bei Zahlen, Normen und Kennungen; Sinn ist gut bei Umschreibungen; Beides verschneidet die zwei Reihen. Am Treffer der Sinnsuche steht die Ähnlichkeit in Prozent. Es gibt dort kein „gefunden oder nicht“, nur näher oder ferner, darum hat die Sinnsuche immer Treffer, auch schwache.

So arbeitet sie: Das Plugin Einbettungen rechnet aus jedem Abschnitt eines Dokuments eine Liste von 384 Zahlen, einen Vektor. Er ist die Lage des Textes in einem Raum der Bedeutungen; zwei Texte, die dasselbe meinen, liegen dort nah beieinander. Die Frage geht denselben Weg und wird ein Vektor; gesucht wird, was ihm am nächsten liegt. Die Vektoren liegen in der Datenbank neben dem Text. Sie sind abgeleitet: ändert sich ein Dokument, rechnet der Job sie neu.

Dasselbe gilt für Knoten: aus Name, Pfad und Werten entsteht je Sprache ein Vektor. Das Band ≈ Ähnliche Knoten in der Knotenansicht zeigt die Knoten, die dem geöffneten am nächsten stehen.

Das Modell dafür ist klein, mehrsprachig und läuft auf dem Server, im Plugin Einbettungen. Beim ersten Lauf des Jobs holt es sich selbst aus dem Netz (etwa 120 MB) und bleibt dann im Verzeichnis des Plugins; danach braucht nichts mehr das Netz, kein Schlüssel, kein fremder Dienst, kein Volumen. Ein Rechner ohne Netz bekommt das Verzeichnis kopiert.

## Frage an die Dokumente

Unter der Suche steht ein Feld für eine Frage. Der Server sucht die passendsten Abschnitte (Wörter und Sinn) und gibt sie nummeriert an die KI des Teams, mit der Anweisung, nur daraus zu antworten. Die Antwort trägt je Aussage die Nummer ihrer Quelle; darunter stehen die Quellen mit Dokument, Seite und den Knoten, an denen es hängt. Anders als die Suche braucht die Frage einen KI-Schlüssel am Team, denn sie ist ein KI-Aufruf und wird wie jeder gezählt. Steht die Antwort nicht in den Dokumenten, sagt die KI das.

## Tabellen aus einem Dokument

Ein Datenblatt mit gedrückter Steuerungstaste auf einen Knoten gezogen wird angehängt und ausgewertet: der Leser findet die Tabellen mit Schlüssel und Wert, und ein Dialog zeigt je Zeile das Attribut, das dazu passt, oder schlägt ein neues vor, mit Typ und Einheit aus dem Wert. Geschrieben wird erst mit ✓. Neue Attribute kommen in die Gruppe „aus Dokument“ und lassen sich im Modell später einordnen.

## Sichtbar für Rollen

Ein Ordner der Bibliothek kann Rollen nennen, die ihn sehen (🔒 am Ordner). Das gilt für seine Unterordner und die Medien darin. Wer die Rolle nicht hat, sieht den Ordner nirgends: nicht in der Bibliothek, nicht am Knoten, nicht als Datei. Administratoren sehen immer alles; leer heisst für alle. Dasselbe gibt es im Baum für einen Teilbaum.
