---
title: Suche nach Sinn – journali findet, was ihr meint, nicht nur, was ihr tippt
excerpt: Jeder Produktknoten bekommt seinen eigenen Vektor. Damit findet journali Produkte und Dokumente nach Bedeutung – lokal gerechnet, ohne Schlüssel, ohne Anbieter. Und seit heute rasend schnell.
slug: suche-nach-sinn
tags: [KI, Suche, Einbettungen]
categories: [Entwicklung]
wp: 34
---
Ihr sucht „wasserdichte Arbeitsschuhe“ – und im Datenblatt steht „Schutzklasse S3, wasserabweisendes Obermaterial“. Eine Wortsuche findet da nichts. **journali findet es.** Denn journali sucht nicht nur nach Wörtern, sondern nach Sinn.

## Jeder Knoten hat seinen eigenen Text

Für jede Produktgruppe, jedes Produkt und jede Variante schreibt journali einen **Knotentext**: Name, Pfad im Baum, Achsenwerte und jedes gepflegte Attribut mit Bezeichnung, Wert und Einheit – und zwar **in jeder Sprache eures Modells**. Listenwerte stehen als lesbare Bezeichnung darin, HTML wird zu sauberem Text.

Aus diesem Text rechnet ein Modell einen **Vektor**: 384 Zahlen, die beschreiben, *was* der Knoten bedeutet. Zwei Produkte, die dasselbe meinen, liegen nah beieinander – auch wenn sie kein einziges Wort teilen. Dasselbe passiert mit jedem Abschnitt eurer Dokumente: Datenblätter, Normen, Anleitungen.

## Was ihr damit bekommt

- **Suche nach Sinn** in ⌕ Dokumente: Wörter, Sinn oder beides zusammen. Was in beiden Reihen vorn steht, steht ganz vorn.
- **Ähnliche Knoten** direkt am Produkt: journali zeigt, welche Produkte inhaltlich am nächsten liegen. Dubletten, Nachfolger, Alternativen – auf einen Blick.
- **Die Frage an die Dokumente**: Ihr stellt eine Frage in normaler Sprache und bekommt eine Antwort aus euren eigenen Dokumenten, **jede Aussage mit Quelle** – Dokument, Seite, Abschnitt, Produkt.
- **Mehrsprachig**: Das Modell versteht viele Sprachen. Eine deutsche Frage findet auch den englischen Text.

## Lokal. Ohne Schlüssel. Ohne Anbieter.

Die Einbettungen rechnet journali **auf eurem eigenen Server**. Kein Anbieter, kein API-Schlüssel, kein Volumen, das mitläuft. Eure Produktdaten verlassen dafür nicht das Haus.

Das Modell ist rund 120 MB groß, wird beim ersten Lauf einmal geladen und läuft danach ohne Netz – auf jedem Server, **ohne Grafikkarte**. Die Vektoren liegen in derselben PostgreSQL-Datenbank wie alles andere – **kein zusätzlicher Dienst, kein externer Vektor-Store**.

Nur die Frage an die Dokumente nutzt eine Chat-KI – über den Schlüssel eures Teams, mit genau den Auszügen, die zur Frage passen.

## Holt von selbst nach

Das Plugin **embed** läuft als Systemjob auf dem Hauptserver und arbeitet nur ab, was offen ist: neue Knoten, geänderte Knoten, neue Dokumente. Ob ein Knoten neu eingebettet werden muss, entscheidet ein Hash über seinen Text – ändert sich ein Wert, ändert sich der Text, ändert sich der Hash. Bricht ein Lauf ab, macht der nächste einfach weiter.

## Und seit heute: rasend schnell

Bei einem großen Bestand mit über 18 000 Knoten in zwei Sprachen sind das mehr als 37 000 Knotentexte. Bisher rechnete journali nach jeder Änderung **alle** davon neu. Jetzt nicht mehr:

- **Nach einer Änderung: 20 ms statt 2,2 Sekunden.** journali rechnet nur noch die Knoten nach, die sich tatsächlich geändert haben – samt allem darunter, wenn sich ein Name im Pfad ändert.
- **158 MB weniger im Speicher.** Für die Übersicht reicht der Hash jedes Textes. Den vollen Text baut journali nur noch für die Knoten, die gerade eingebettet werden.
- **Kein Knoten muss neu eingebettet werden.** Die Hashes sind bit für bit dieselben wie vorher – geprüft an allen 37 222 Texten.

## Und jetzt?

journali ist noch in Entwicklung – die Suche nach Sinn steckt schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
