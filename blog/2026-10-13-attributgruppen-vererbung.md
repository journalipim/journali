---
title: Attributgruppen – einmal anhängen, gilt für alles darunter
excerpt: Eine Gruppe von Attributen hängt an einem Knoten und gilt für den ganzen Ast darunter; ein Attribut kann in mehreren Gruppen stehen, ohne Kopie, und der Import legt neue Gruppen dort an, wo sie hingehören.
slug: attributgruppen-vererbung
tags: [Datenpflege, Datenqualität, Architektur, Import & Export]
categories: [Entwicklung]
date: 2026-10-13 06:00
wp: 154
---
Die Spannungsversorgung steht bei Betriebsgeräten für Entladungslampen genauso wie bei LED-Treibern. Dimmung gibt es nur bei den Treibern, die Zündung nur bei den Betriebsgeräten. Wie pflegt ihr das, ohne dieselbe Größe zweimal anzulegen, und ohne dass die Treiber ein Feld „Zündung“ mitschleppen? **Mit Attributgruppen, die an den Baum gehängt werden.**

## Eine Gruppe hängt an einem Knoten

Eine Attributgruppe bündelt Attribute und hängt an einem Knoten des Baums. Von dort **gilt sie für alles darunter**: jede Produktgruppe, jedes Produkt, jede Variante im Ast hat diese Attribute dazu. Ihr hängt „Spannungsversorgung“ einmal an die Wurzel der Betriebsgeräte und müsst nirgends sonst daran denken.

Hängt eine Gruppe schon an einem Vorfahren, ist ein zweites Anhängen darunter überflüssig – die Knotenansicht zeigt euch das an. Und was einmal gilt, gilt in der Vollständigkeit auch nur einmal.

## Ein Attribut, mehrere Gruppen – ohne Kopie

Hier wird es praktisch. Eine Gruppe ist bei journali eine **Auswahl** von Attributen, kein Besitz. Dasselbe Attribut steht in beliebig vielen Gruppen, **ohne dass es kopiert wird**:

- Betriebsgeräte für Entladungslampen: Spannungsversorgung + Zündung + Gehäuse
- LED-Treiber: Spannungsversorgung + Dimmung + Gehäuse

Die Spannungsversorgung bleibt ein einziges Attribut – mit einer Bedeutung, einer Einheit, einer Pflicht. Im Modell wählt ihr am Attribut mehrere Gruppen aus, und die Gruppe zeigt ihre Mitglieder. Eine zweite Zusammenstellung kostet einen Namen und ein paar Häkchen, statt Attribute umzuziehen und anderswo zu verlieren.

Kommt ein Attribut über zwei Gruppen an denselben Knoten, **steht es dort trotzdem nur einmal**: in der ersten geltenden Gruppe, die weiteren nennt der Tooltip. Ein Wert, eine Zelle.

## Die Pflicht bleibt am Attribut

Ob ein Attribut Pflicht ist, steht am Attribut selbst – je Kanal und Sprache – und **gilt überall gleich**. Dasselbe Attribut hat nicht in einer Gruppe diese und in der anderen jene Pflicht. Soll es anders sein, ist es ein anderes Attribut. Das hält das Modell eindeutig, und eine Vollständigkeitsprüfung rechnet am Ende überall nach derselben Regel.

Für Größen, die nur unter Bedingungen gelten, gibt es zwei Wege, die schon da sind: die Pflicht je Kanal und Sprache und eine Bedingung, die ein Attribut anhand des Werts eines anderen abschaltet.

## Gruppen, die erst ab einer Ebene gelten

Nicht jede Gruppe gehört auf jede Ebene. Eine Gruppe legt fest, **ab welchem Knotentyp** ihre Werte erfasst werden: ab Gruppe, ab Produkt oder ab Variante. Die eingebauten Vorgaben haben dafür ein Beispiel: Logistik mit SKU und EAN ist **ab Variante aktiv**.

Darüber ist die Gruppe sichtbar, aber gesperrt. In der Knotenansicht steht dann „hier gesperrt“ mit der Ebene, ab der sie gilt, und im Reiter erscheint ein ⌀. Ihr seht also, dass es die Gruppe gibt, und pflegt ihre Werte dort, wo sie hingehören. Die Vollständigkeit prüft nur, wo die Gruppe aktiv ist.

## Werte wandern nach unten

Die Gruppe vererbt die **Definition**, also welche Attribute es gibt. Ob auch der **Wert** nach unten weitergegeben wird, sagt das Attribut: Es ist vererbbar oder nicht. Ein Name soll an jedem Produkt eigen sein, eine Kategorie darf von der Produktgruppe kommen.

Ist ein Attribut vererbbar, sucht journali den Wert den Pfad hinauf: erst der eigene, sonst der des Produkts, sonst der der Gruppe und so weiter. **Geerbte Werte stehen kursiv.** Ein eigener Wert überschreibt den geerbten; löscht ihr ihn, gilt der geerbte wieder.

## Hängt ihr um, geht nichts verloren

Wer eine Gruppe von einem Knoten löst oder woanders anhängt, verliert keine Werte. Werte für Attribute, die danach über keine Gruppe mehr gelten, **bleiben im Journal** und stehen am Knoten als „Eigene Werte ohne Gruppe“. Hängt ihr eine Gruppe an, in der sie wieder vorkommen, gelten sie wieder.

## Der Import legt neue Gruppen an die richtige Stelle

Bringt ein Katalog hunderte neue Attribute mit, hilft eine einzige Sammelgruppe nicht weiter – jeder Knoten sähe alles. Der **Solr-Import** ordnet deshalb nach den Regeln aus dem Basis-Plugin Tabelle:

- **Die Position:** Ein Attribut gehört an den Knoten, unter dem alle seine Werte stehen – den tiefsten gemeinsamen Vorfahren der Produktgruppen, in denen es vorkommt. Dort hängt seine Gruppe. Was mehrere Kategorien gemeinsam haben, steht eine Stufe höher; was nur eine betrifft, an ihr.
- **Genau, was dort vorkommt:** Wer unter einem Knoten arbeitet, sieht seine Attribute und nichts von den Zweigen daneben.
- **Keine Mini- und keine Riesengruppen:** Eine Gruppe mit weniger als 3 Attributen geht zum Knoten darüber, eine mit mehr als 60 wird nach Thema geteilt.
- **Eine Ebene je Gruppe:** Attribute, deren Werte auf derselben Ebene stehen, kommen zusammen und sind dort „aktiv ab“. Attribute oberhalb der Varianten sind vererbbar – die Varianten bekommen den Wert, ohne dass der Import ihn wiederholt.
- **Namen zum Lesen:** Die Gruppe heißt nach dem Knoten, etwa „Federnde Druckstücke“. Ein Schlüssel wie `abmessung_a_max` wird zu „Abmessung a max“.

Der **Trockenlauf** zeigt vorher im Plan jede neue Gruppe mit Ort, „aktiv ab“ und Zahl ihrer Attribute. Und für den Tabellenimport gilt: Ein neues Attribut braucht eine Gruppe, sonst gilt es nirgends – der Plan meldet fehlende Gruppen, bevor etwas geschrieben wird.

## Und jetzt?

journali ist noch in Entwicklung – Attributgruppen mit Vererbung stecken schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
