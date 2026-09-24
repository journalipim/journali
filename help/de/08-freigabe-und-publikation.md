# Freigabe und Publikation

Zwischen Pflege und Ausgabe stehen zwei Schritte: die **Freigabe** einer Variante je Kanal und Sprache, und der **Publikationsbaum**, der bestimmt, was in welcher Gliederung hinausgeht.

## Vollständigkeit

Welche Attribute Pflicht sind, steht im Modell je Kanal und Sprache. Am Knoten zeigt ✓ Freigaben, was für jeden Kanal fehlt. Vererbte Werte zählen, wenn das Attribut vererbbar ist; vermehrbare Attribute brauchen mindestens eine Zeile. Ein Wert, der nur aus dem Master kommt, zählt nicht als Übersetzung.

## Freigabe

Freigegeben wird die Variante, je Kanal und wahlweise je Sprache. Fehlen Pflichtwerte, wird die Freigabe abgelehnt und nennt, was fehlt. Eine Freigabe lässt sich zurücknehmen. Der Status ausgelaufen am Produkt überstimmt jede Freigabe darunter.

Ein Workflow kann die Freigabe als Wirkung eines Schritts auslösen; dann prüft der Schritt vorher, ob er gehen kann.

## Publikationsbaum

Unter ⇶ Publikation gibt es je Kanal, wahlweise je Markt, einen Baum aus **Rubriken**. Produktgruppen und Produkte des Pflegebaums werden hineingezogen: als **Verweis**, der dem Pflegebaum folgt, oder als **Kopie** der Gliederung, die sich frei umbauen lässt. Eine Rubrik trägt eigene Texte und Bilder wie jeder Knoten, und einen Anzeigenamen, der nur hier gilt.

**Regeln** füllen eine Rubrik automatisch: nach Name oder nach Attributwert, flach oder gegliedert nach der Produktgruppe darüber.

Ausgeleitet wird ein Produkt, wenn eine Variante für den Kanal freigegeben ist und der Markt des Baums in den Verkaufsländern des Produkts steht; leer heisst überall. Die Ansicht zeigt, was ausgeleitet wird, was zurückgehalten wird und warum, und welche Produkte noch nicht einsortiert sind.

## Stand einfrieren

Eine Rubrik kann auf einen Journalstand eingefroren werden: die Publikation liest die Pflege dann wie zu diesem Zeitpunkt, bis der Stand aktualisiert oder aufgehoben wird. Nichts wird kopiert, es ist ein Zeiger ins Journal.

## Versionen

Eine Version friert den Stand eines Knotens ein und hängt die Belege an, die damit nach draussen gingen: Datenblatt, Sicherheitsdatenblatt, Katalogseite, erzeugt von den Erzeuger-Plugins. Eine Version hat eine Aufbewahrungsfrist, lässt sich zurückziehen, aber nicht löschen, und zeigt den Unterschied zwischen damals und heute. Zurückrollen setzt die Werte von damals als neuen Stapel.
