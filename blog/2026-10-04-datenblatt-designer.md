---
title: Der Datenblatt-Designer – Seite wie gedruckt, Werte direkt aus euren Produktdaten
excerpt: Bausteine per Drag & Drop auf die Seite ziehen, sofort mit echten Werten sehen, in jeder Sprache eures Modells – und auf Wunsch die Datenblätter eines ganzen Teilbaums auf einmal als Job.
slug: datenblatt-designer
tags: [Datenblatt, Versionen, Jobs, Mehrsprachigkeit]
categories: [Entwicklung]
wp: 39
description: Bausteine per Drag & Drop auf die Seite, sofort mit echten Werten in jeder Sprache – und die Datenblätter eines ganzen Teilbaums auf einmal als Job.
---
Ihr pflegt eure Produktdaten einmal – **und das Datenblatt entsteht genau daraus**. Kein Abtippen in eine Vorlage, kein Kopieren von Werten, kein „welcher Stand steht eigentlich im PDF?“. Der Datenblatt-Designer in journali baut eure Blätter direkt aus dem, was im Journal steht.

## Ihr seht die Seite, wie sie gedruckt wird

Der Designer zeigt **die Seite so, wie sie aus dem Drucker kommt**: A4 oder Letter, Hoch- oder Querformat, Rand und Schriftgröße nach eurer Wahl. Ihr zieht Bausteine von links auf die Seite – und seht sofort die echten Werte des Knotens, den ihr für die Vorschau gewählt habt.

Das steckt im Baukasten:

- **Abschnitte mit 1 bis 4 Spalten**
- **Attributgruppen** als Wertetabelle und **einzelne Attribute**
- **Bilder** – das erste oder alle, in der Höhe, die ihr festlegt
- **Text**, direkt auf der Seite getippt, mit Platzhaltern wie `{name}`, `{sku}`, `{today}` oder einem beliebigen Attribut
- **Aufzählungen** für mehrwertige Attribute – mit Punkt, Strich oder Zahl, auf Wunsch mehrspaltig
- **Datentabelle**: am Produkt die Varianten, an der Gruppe die Produkte
- **Vergleichstabelle** – auf Knopfdruck **nur die Unterschiede**
- **Seitenumbruch**, dazu Kopf und Fuß

Verschieben, auswählen, entfernen: alles mit der Maus, direkt auf der Seite.

## Die Palette kennt euer Produkt

Wählt einen Knoten, und die Palette zeigt die Attributgruppen und Attribute, die dort gelten – **samt allem, was an den Knoten darunter vorkommt**. Statt in einer Liste mit Hunderten Attributen zu suchen, habt ihr genau die vor euch, die für dieses Produkt zählen.

Und die Werte stimmen: **Geerbte Werte zählen mit**, Formeln kommen berechnet aufs Blatt, Listenwerte als lesbare Bezeichnung, Einheiten gleich dahinter.

## Ein Layout für jede Rolle

Produktgruppe, Produkt und Variante bekommen **jeweils ihr eigenes Layout**. Die Layouts liegen im Journal – einmal gespeichert, gelten sie für alle.

Im Baum reicht ein Rechtsklick: **„Datenblatt erstellen“** öffnet das fertige Blatt in einem neuen Fenster – drucken oder als PDF speichern, fertig. **„Datenblatt designen …“** öffnet den Designer gleich mit diesem Knoten als Vorschau.

Wer lieber selbst schreibt: **HTML-Vorlagen mit Platzhaltern** gibt es als zweiten Weg – mit Schleifen über Gruppen, Varianten und Bilder und mit Bedingungen.

## In jeder Sprache eures Modells

Ein Wechsel der Sprache in der Vorschau, und das Blatt steht in dieser Sprache da: **Bezeichnungen, Gruppennamen, Listenwerte und sprachabhängige Werte** – alles aus dem Modell, nichts doppelt gepflegt.

## Alle Datenblätter eines Teilbaums – als Job

Ein Blatt per Klick ist schön. **Alle Blätter eines Teilbaums auf einmal ist besser.** Der Job „Datenblätter: Verzeichnis“ schreibt für jeden Knoten ein fertiges Blatt als HTML-Datei, dazu eine `index.html` mit allen Blättern.

- **Teilbaum** wählen – oder den ganzen Baum
- **Produkte, Varianten, Gruppen** oder alle
- **Layout und Sprache** je Job
- **Ziel**: ein Verzeichnis oder das Fach `out/` des Jobs – und von dort über einen Zugang per **WebDAV oder FTP** weiter

Mit Zeitplan läuft das stündlich, täglich, wöchentlich oder monatlich. **Eure Datenblätter sind immer auf dem Stand der Daten.**

## Das Blatt, das rausging, bleibt

Bei „Version erzeugen“ liefert das Plugin **das Datenblatt als eingefrorenen Beleg**: mit Belegfuß – Version, Stand des Journals, Datum –, hochgeladen als Medium, **hash-adressiert und unveränderlich**, und an die Version gehängt.

Der Beleg landet in der Bibliothek im Ordner „Belege“, mit seiner Herkunft, und ist am Produkt zugeordnet. Für die Haftungsfrage zählt das Dokument, das nach draußen ging – **und genau das habt ihr in der Hand**.

## Und jetzt?

journali ist noch in Entwicklung – der Datenblatt-Designer steckt schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
