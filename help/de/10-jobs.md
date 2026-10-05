# Jobs

Ein Job ist ein Prozess-Plugin, das der Server nach Zeitplan oder auf Knopfdruck als Kindprozess startet: Import, Export, Sicherung, Vorschauen rechnen, Dokumente lesen, Übersetzung. Jobs laufen nie im Serverprozess und sprechen mit journali nur über die Schnittstelle.

## Anlegen

⏱ Jobs → + Job führt durch vier Schritte: welches Plugin, mit welchem Profil und welchen Parametern, wo die Ablage liegt, wann es läuft. Bei gewähltem Profil stehen nur die Parameter, die am Job hängen; Zugangsdaten und Schlüssel liegen als Geheimnis beim Server am Profil, nie im Journal.

## Zeitplan

Nur von Hand, stündlich, täglich, wöchentlich, monatlich oder als Ausdruck mit Minute, Stunde, Tag, Monat und Wochentag. Ein Job lässt sich ausschalten, dann ruht der Zeitplan; ein laufender Job lässt sich anhalten, er wartet beim nächsten Stapel.

## Fächer

Jobs, die Dateien verarbeiten, haben Fächer auf dem Server: Eingang, Erledigt, Gescheitert, Ausgabe. Ein Lauf nimmt, was im Eingang liegt, und legt es danach in Erledigt oder Gescheitert ab; Ausgaben landen in Ausgabe, wahlweise zusätzlich als Medium in der Bibliothek und als Kopie unter festem Namen. Die Aufbewahrung sagt, wie viele Läufe oder wie viele Tage bleiben.

## Läufe und Protokolle

Jeder Lauf steht im Journal mit Start, Ende, Ergebnis und Grösse des Protokolls; das Protokoll selbst liegt als Datei beim Server und ist am Job lesbar. Ein Job bekommt je Lauf ein Dienst-Token mit der Rolle PIM-Editor, das mit dem Lauf erlischt.

## Was ein Job kostet

<!-- lizenz -->
Die Betriebsspur eines Laufs, also Start, Ende, verarbeitete und geschriebene Dateien, zählt nicht gegen das Kontingent. Was ein Job an Daten schreibt, zählt wie Handarbeit: ein Import einen Eintrag je geändertem Wert, ein Wiederholungsimport ohne Änderung keinen.
<!-- /lizenz -->
<!-- startphase -->
Was ein Job an Daten schreibt, steht im Journal wie Handarbeit: ein Import einen Eintrag je geändertem Wert, ein Wiederholungsimport ohne Änderung keinen.
<!-- /startphase -->

## Von selbst

Was der Rechner selbst tun kann, tut er: Vorschauen rechnet der Job nach jedem Hochladen und nach jeder Preset-Änderung, ohne dass jemand hingeht. Der Knopf am Job ist der Nachzieher.
