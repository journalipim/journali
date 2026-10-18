---
title: Versionen – journali hält fest, was nach draußen ging
excerpt: Eine Version ist ein Zeiger auf den Journalstand eines Produkts plus die eingefrorenen Dokumente, die damit hinausgingen – unveränderlich, hash-adressiert, mit Aufbewahrungsfrist.
slug: versionen
tags: [Versionen, Datenblatt, Journal]
categories: [Entwicklung]
wp: 69
description: Versionen in journali: ein Zeiger auf den Journalstand eines Produkts plus die eingefrorenen Dokumente, die damit hinausgingen – unveränderlich.
keyphrase: Versionen
---
Ein Kunde fragt nach: Welches Datenblatt habt ihr im März verschickt? Welche Werte standen darin? In vielen Systemen beginnt jetzt die Suche in Postfächern, Netzlaufwerken und alten Exporten. **In journali öffnet ihr die Version.** Dort steht der Stand des Produkts von damals – und das Dokument, das hinausging, Byte für Byte.

## Eine Version ist ein Zeiger, keine Kopie

Mit **＋ Version** am Produkt haltet ihr den Stand fest. journali merkt sich dafür genau eine Zahl: **die Nummer im Journal**. Alles, was bis dahin eingetragen war, ist der Stand dieser Version – die Werte, die Struktur und sogar das Modell von damals.

Kopiert wird dabei nichts. Die alten Werte stehen ohnehin im Journal, denn dort wird nie etwas überschrieben. **Der Stand einer Version kostet darum keinen zweiten Speicher.**

Ihr könnt eine Version für einen Kanal und eine Sprache erzeugen. Dann prüft journali vorher die Vollständigkeit, genau wie bei der Freigabe: fehlt ein Pflichtwert, gibt es keine Version. Und erzeugen darf sie, wer das Recht zur Freigabe hat.

## Das Dokument wird eingefroren

Eine Version ist mehr als ein Datenbankstand. Sobald sie angelegt ist, rendern **Erzeuger-Plugins** die Dokumente dazu und hängen sie an. Das Plugin Datenblatt liefert heute das **Datenblatt als HTML** – im Layout aus dem Datenblatt-Designer, mit einer Fußzeile, die Version, Journalstand, Datum, Kanal und Sprache nennt. So spricht das Dokument für sich, auch wenn es Jahre später allein auf dem Tisch liegt.

Jedes Dokument landet als Medium im Speicher, **hash-adressiert**: Der Inhalt bestimmt den Schlüssel, unter dem er liegt. Eine Änderung am Dokument wäre ein anderes Dokument mit einem anderen Hash.

Und weil Erzeuger Plugins sind, braucht ein weiteres Dokument keinen neuen Kern: Ein Plugin meldet im Manifest, dass es rendert – journali ruft es bei jeder neuen Version auf. Kam ein Erzeuger erst später dazu oder ist ein Lauf schiefgegangen, holt **↻** das nach.

## Im Medienbestand, am Produkt

Ein erzeugtes Dokument ist ein ganz normales Asset. Es bekommt im selben Schritt:

- seine **Herkunft** – welches Plugin es erzeugt hat und zu welcher Version es gehört,
- einen **Ordner** – `Belege` auf der obersten Ebene, den journali bei Bedarf selbst anlegt,
- die **Zuordnung zum Produkt** – als Dokument oder Bild, damit es im Medienband des Knotens erscheint.

Ihr findet es also dort, wo ihr ohnehin sucht.

## Aufbewahren, zurückziehen – aber nie löschen

Jede Version hat eine **Aufbewahrungsfrist**: zehn Jahre als Vorgabe, einstellbar bis hundert. journali zeigt an jeder Version, bis wann sie aufbewahrt wird.

War eine Version fehlerhaft oder ist sie überholt, **zieht ihr sie zurück** – mit Grund. Sie gilt dann nicht mehr, bleibt aber sichtbar. Gelöscht wird nichts. Auch das Rückgängig in journali lässt Versionen in Ruhe.

## Zurückrollen ist ein Schritt vorwärts

Was hat sich seit Version 3 geändert? **≠ Stand** zeigt es: die eigenen Werte des Produkts damals gegen heute, Achse für Achse.

Wollt ihr zurück, zeigt **↶** zuerst den **Plan**: was gesetzt wird und was außen vor bleibt – etwa ein Attribut, das es heute nicht mehr gibt. Erst dann rollt ihr zurück. Und das heißt bei journali: **Die Werte von damals werden neu gesetzt, als ein Stapel neuer Einträge.** Nichts dazwischen geht verloren. Und weil es ein Stapel ist, lässt sich auch das Zurückrollen wieder rückgängig machen.

## Auch für eure KI

Der RAG-Export nimmt je Produkt die **letzte gültige Version** mit – Nummer, Journalstand, Datum und Verweise auf die Dokumente. Ein Assistent kann damit sagen, auf welchen Stand sich seine Antwort stützt.

## Und jetzt?

journali ist noch in Entwicklung – Versionen stecken schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
