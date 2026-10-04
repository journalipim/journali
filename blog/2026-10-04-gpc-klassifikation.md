---
title: GPC in journali – vom Brick zu fertigen Attributen mit einem Klick
excerpt: journali liest die GS1-Produktklassifikation ein, hilft euch beim Finden des passenden Bricks und legt beim Zuweisen gleich alle Attribute der Klasse an – direkt am Produkt.
slug: gpc-klassifikation
tags: [Klassifikation, GS1 GPC, KI]
categories: [Entwicklung]
wp: 44
---
Segment, Family, Class, Brick: Die **GS1-Produktklassifikation GPC** ordnet Produkte in vier Ebenen, und der Brick ist die Klasse, die ein Produkt bekommt. **journali kann jetzt GPC** – ihr lest die Veröffentlichung ein, findet den passenden Brick und weist ihn zu. Und im selben Moment stehen alle Attribute dieser Klasse an eurem Produkt bereit.

## Die Daten holt ihr bei GS1 – journali liest sie ein

Die GPC ist laut GS1 kostenfrei nutzbar. Ihr ladet die Veröffentlichung bei GS1 herunter und zieht sie in journali – **das komplette Zip oder die JSON-Datei daraus, gelesen direkt im Browser**. journali bringt selbst keine GPC-Daten mit: Was ihr einlest, steht danach in eurem Journal.

- **Nur Neues wird geschrieben.** Dieselbe Datei ein zweites Mal ergibt nichts.
- **Weitere Sprachen dazu.** Eine andere Datei derselben Version ergänzt die Titel, die Struktur bleibt.
- **Kompakt abgelegt.** Attribute und Werte stehen einmal in einem Wörterbuch, am Brick nur ihre Codes – die ganze Veröffentlichung sind rund 5,5 MB im Journal.
- **Einmal übernommen, fertig.** Die Datei braucht ihr nur noch für eine neue Version oder eine weitere Sprache.

## Vier Wege zum richtigen Brick

Der Klassendialog öffnet sich direkt am Knoten und bietet euch alles auf einmal:

- **Umfeld**: journali zeigt, welche Klassen die Geschwister und die Knoten darunter schon haben – die häufigsten zuerst.
- **KI-Vorschlag**: Ist eine KI eingerichtet, wählt sie erst die passenden Families und dann bis zu drei Bricks – **jeder mit einer kurzen Begründung**.
- **Suche**: nach Code, Name, Weg und Definition. Alle Wörter müssen passen, die besten Treffer stehen oben.
- **Durchsehen**: Segment › Family › Class › Brick als Baum, auf jeder Ebene mit der Zahl der Bricks darunter.

Bevor ihr zuweist, seht ihr den Brick im Ganzen: Definition, Abgrenzung und seine Attribute mit der Zahl ihrer Werte.

## Ein Klick – und die Attribute sind da

Beim Zuweisen legt journali an, was fehlt: **eine Attributgruppe für den Brick**, benannt mit Code und Name, und **je GPC-Attribut ein Listenattribut** mit seinen Werten. Die Gruppe hängt am Knoten – und schon könnt ihr die Attribute der Klasse pflegen.

Das Beste daran: **Ein Attribut gibt es nur einmal**, egal wie viele Bricks es führen. Gibt es das Attribut schon, kommt es nur in die Gruppe des neuen Bricks. Bringt ein weiterer Brick neue Werte mit, ergänzt journali die Liste. Keine Kopien, kein Wildwuchs.

Und direkt danach sagt euch journali, ob alles bereit ist – oder ob noch eine Gruppe fehlt, nicht gilt oder ein Attribut fehlt.

## Einmal an der Produktgruppe – gilt für alles darunter

Die Klasse setzt ihr dort, wo alle dieselbe haben: **an der Produktgruppe, und sie gilt nach unten**. Wo ein Produkt eine Ausnahme ist, bekommt es seine eigene.

Das Band **⌗ GPC** in der Knotenansicht zeigt auf einen Blick, welche Klasse gilt – eigene oder geerbte – und wie viele Attribute sie mitbringt. Daneben die Knöpfe: andere Klasse wählen, Klasse entfernen (samt ihrer Gruppe), Gruppe anhängen, wo sie noch nicht gilt.

## Derselbe Aufbau wie bei ETIM

GPC folgt in journali demselben Prinzip wie ETIM: **eine Klasse, eine Attributgruppe**. Was beide gemeinsam haben – Gruppen anlegen, Klassen zuweisen, entfernen – erledigt der Server für jedes Klassifikationssystem gleich. Wer ETIM in journali kennt, ist bei GPC sofort zu Hause.

Beim Einschalten legt das Plugin die Gruppe GPC mit dem Klassenattribut an und hängt sie an die Wurzeln eures Baums – **es sagt euch vorher, was es anlegt**. Solange das Plugin an ist, sind diese Systemobjekte geschützt.

## Und jetzt?

journali ist noch in Entwicklung – GPC steckt schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
