---
title: Medien und Ableitungen – ein Bild einmal hochladen, überall verwenden
excerpt: Ein Asset wird einmal gespeichert, beliebig oft zugeordnet und an Subitems vererbt – die Vorschauen rechnet journali nach jedem Hochladen und jeder Preset-Änderung von selbst.
slug: medien-und-ableitungen
tags: [Medien, Jobs, Datenpflege]
categories: [Entwicklung]
date: 2026-10-19 06:00
wp: 156
---
Eine Produktgruppe, vierzig Varianten, ein gemeinsames Hauptbild. Wohin damit? Vierzigmal hochladen und bei jeder Änderung vierzigmal austauschen? **Bei journali lädt ihr das Bild einmal hoch, ordnet es der Gruppe zu – und alle Varianten darunter haben es.** Ohne Kopie, ohne Handarbeit.

## Die Bibliothek: einmal gespeichert, beliebig oft zugeordnet

Bilder und Dokumente heißen in journali **Assets**. In der Bibliothek ▨ Medien liegen sie in Ordnern, ihr sucht über Name, Kennung und Werte, sortiert und gruppiert. Hochladen geht per Knopf oder einfach durch Ziehen.

Und weil journali jede Datei am **Inhalt** erkennt, entsteht keine Dublette: Wer dasselbe Bild zweimal hochlädt, hat es trotzdem nur einmal gespeichert. Jedes Asset trägt seine eigenen Werte – Alt-Text je Sprache, Rechte, Stichwörter, dazu Größe, Typ und Prüfsumme.

## Zuordnen am Knoten, vererben an Subitems

Am Produkt landen Assets im Abschnitt ▩ Assets: Datei ablegen oder aus der Bibliothek wählen, mit Ordner, Suche und Mehrfachauswahl. Eine Zuordnung hat ihre eigenen Werte, zum Beispiel **Reihenfolge** und **Verwendung**. Die Kacheln zieht ihr einfach in die gewünschte Reihenfolge – die erste ist das Hauptbild, und das nimmt auch die Ausleitung.

Der Schalter **an Subitems vererben** macht aus einer Zuordnung eine Ableitung wie bei Attributwerten: Das Asset gilt an allen Knoten darunter, nichts wird kopiert. Gehört an einer Stelle doch ein anderes Bild, hilft das Sperren: Ein geerbtes Asset lässt sich dort nicht entfernen, aber **sperren** – dann gilt es an dieser Stelle und an allem darunter nicht mehr. Löst ihr die Sperre, ist es wieder da.

Hängen an den Subitems schon lauter feste Zuordnungen desselben Bildes, räumt ein Knopf auf: Er setzt die Assets des Knotens auf „vererben“ und löst die gleichen festen Zuordnungen darunter.

## Presets: ihr bestimmt die Größen

Ein Bild wird selten in einer einzigen Größe gebraucht. Darum gibt es **Vorschau-Presets** in den Einstellungen unter ▩ Assets. Ein Preset legt fest:

- die **Kantenlänge** – die längste Seite wird eingepasst, nie vergrößert,
- das **Format** – webp, jpeg, png oder avif,
- die **Qualität**,
- ob das Preset **automatisch** gerechnet wird.

Ab Werk gibt es drei: eine Kachel mit 256 Pixeln, **Web** mit 1200 und **Druck** mit 3000 Pixeln. Weitere legt ihr selbst an. Auch die Presets stehen im Journal – ein Modell, das ihr pflegt, nicht Code, den jemand ändern muss.

## Die Ableitungen rechnet journali von selbst

Hier wird es bequem. Sobald ein Bild hochgeladen ist, rechnet das Plugin **derive** im Hintergrund die Ableitungen für jedes automatische Preset – bei einem PDF aus der ersten Seite. Das läuft als Job, **nie im Serverprozess**, und liest unter anderem TIFF, PNG, JPEG, WebP, AVIF, GIF und SVG.

Und ändert ihr ein Preset – größere Kante, andere Qualität –, **rechnet journali alles neu, was nicht mehr passt.** Ihr müsst dafür keine Seite aufsuchen. Der Knopf „▶ Jetzt rechnen“ ist nur der Nachzieher für den Fall, dass ihr nicht warten wollt.

Die fertigen Vorschauen liegen im selben Speicher wie das Original. Wo dieser Speicher ist – PostgreSQL, Verzeichnis oder S3 –, steht im Beitrag zu S3 Object Storage.

## Offene Posten statt Warteschlange

Wie schafft journali das auch bei tausend Assets auf einmal? Mit einem einfachen Gedanken: **Offen ist, was seinen Eintrag noch nicht hat.** Es gibt keine Warteschlange, die bei einem Neustart verloren gehen könnte – es gibt nur die Frage „Was fehlt noch?“.

Daraus folgt:

- Bricht ein Lauf ab, findet der nächste dieselben offenen Posten.
- Nach einem Neustart stimmt alles wieder, ohne dass jemand etwas fortsetzt.
- Doppelt gearbeitet wird nie: Wer seinen Eintrag hat, ist nicht mehr offen.

Genauso liest journali die **Maße** eines Bildes aus dem Dateikopf – Breite, Höhe, Auflösung, Farbraum. Damit lässt sich die Bibliothek zum Beispiel nach „mindestens 2000 Pixel“ filtern.

## Gepflegt oder gemessen

journali unterscheidet zwei Arten von Angaben. **Gepflegt** ist, was ein Mensch sagt: Alt-Text, Rechte, Stichwörter. **Gemessen** ist, was in den Bytes steht: Maße, Ableitungen, Herkunft.

## Ein Bestand statt einer Liste

Unter ▩ Assets zeigt der **Bestand**, wie es um eure Medien steht:

- **Arten** – Bilder, PDFs, Texte und mehr, mit Anzahl und Größe,
- **ableitbar** – wie viele Assets sich zu einer Vorschau rechnen lassen,
- **Ableitungen** – wie viele schon vorliegen,
- **ohne Verwendung** – Assets, die an keinem Knoten hängen,
- **gleicher Inhalt** – dieselben Bytes unter mehreren Assets,
- **Fehlbestand zählen** – ob wirklich alles im Speicher liegt.

Dazu kommen Facetten in der Bibliothek: nach Art, Herkunft, Stichwort und **abgelaufen**. Hat ein Asset eine Frist, fällt es nach Ablauf aus der Ausleitung – im Journal bleibt es.

## Datenblätter sind Medien

Ein Datenblatt ist ein Asset wie ein Bild: Es hängt am Produkt als Dokument und lässt sich vererben. Der Job **Dokumente lesen** zieht den Text aus PDF, Text, HTML, Markdown und XML und macht ihn durchsuchbar. Scans ohne Textebene erkennt das Plugin **ocr** auf dem Server, ohne Schlüssel und ohne fremden Dienst.

Zieht ihr ein Datenblatt mit gedrückter Strg-Taste auf einen Knoten, findet journali darin die Tabellen mit Schlüssel und Wert und schlägt je Zeile das passende Attribut vor. Geschrieben wird erst, wenn ihr bestätigt.

## Neue Version, nichts geht verloren

Ein Asset ist unveränderlich. Gibt es ein besseres Bild, lädt ihr es als **neue Version** hoch: Die Zuordnungen wandern mit allen Werten zum Nachfolger, und die Abstammung bleibt in beide Richtungen lesbar. Das alte Asset bleibt im Journal, die Bibliothek bietet es nur nicht mehr an.

## Und jetzt?

journali ist noch in Entwicklung – Medien und Ableitungen stecken schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
