---
title: ETIM in journali – von der Klasse bis zum gültigen BMEcat
excerpt: journali holt die ETIM-Freigabe ins Journal, schlägt die passende Klasse vor, ordnet ETIM-Attribute euren eigenen Attributen zu und liefert BMEcat nach ETIM-Guideline 5.0 – geprüft gegen das XSD.
slug: etim-klassifikation
tags: [Klassifikation, ETIM, BMEcat, Import & Export]
categories: [Entwicklung]
wp: 42
---
Großhandel und Datenpools wollen ETIM: eine Klasse je Produkt, gefüllte ETIM-Attribute und einen BMEcat, der beim Empfänger sauber durchläuft. **In journali ist das kein Nebenprojekt mehr, sondern ein Plugin** – von der Freigabe über die Pflege bis zur fertigen Datei.

## Die ganze Freigabe mit einem Klick

Ein Klick auf **↻ Liste**, und journali zeigt die IXF-Freigaben von ETIM International. Auswählen, laden – **alle Klassen landen im Journal**, in den Sprachen eures Modells. Lieber eine Datei? Dann lest ihr eine IXF-3.1-Datei ein, gern auch als Zip.

- **Mehrere Versionen nebeneinander**: journali merkt sich jede geladene Freigabe. Eine ist die aktuelle – sie gilt für Zuweisen, Prüfen und Export.
- **Danach ohne Datei**: Jede Klasse steht aufgelöst im Journal, mit ETIM-Attributen, Einheiten und Werten. Suche, Zuweisung, Prüfung und Export brauchen die Freigabe nicht mehr.

## Die richtige Klasse – vorgeschlagen statt gesucht

Am Knoten öffnet **⌗ Klasse zuweisen …** einen Dialog, der mitdenkt:

- **Umfeld**: Welche Klassen tragen die Geschwister, welche stehen im Teilbaum darunter?
- **Suche** nach Code, Name und Synonym – oder blättern nach ETIM-Gruppen.
- **✦ KI fragen**: Die KI schlägt aus Name und Pfad bis zu drei Klassen vor, jede mit kurzer Begründung. Nur auf Knopfdruck, mit dem Schlüssel eures Teams.

Die Klasse gehört in der Regel an die **Produktgruppe und erbt auf alles darunter**; ein Produkt mit einer anderen Klasse bekommt seine eigene. Die Attributgruppe der Klasse hängt journali gleich mit an den Knoten – die Klasse ist danach sofort pflegbar.

## Eure Attribute bleiben eure Attribute

Ihr pflegt längst `breite` und `farbe`? Dann bleibt das so. **journali ordnet jedes ETIM-Attribut einem vorhandenen Attribut zu** – mit **ƒ**, derselben Umwandlungskette wie im Datenmapper:

- Einheit umrechnen
- ja/x → Ja/Nein
- Text → EV-Code nach Tabelle
- von/bis zu einem Bereich verbinden

Eine **Probe** zeigt sofort, was aus eurem Wert am ETIM-Attribut ankommt. Ein eigenes `ef…`-Attribut legt journali nur an, wo es nichts Passendes gibt. Und das gibt es dann **genau einmal**: `EF000008 Breite` gilt in den Gruppen aller Klassen, die es führen – ohne Kopie.

## Alles am Knoten: das Band ⌗ ETIM

In der Knotenansicht steht ETIM in **einer Zeile**: Klasse (eigen oder geerbt, abweichende darunter) · Attribute n von m · Daten in Prozent gefüllt. Jede Stufe springt ins passende Werkzeug – Zuweisen, Zuordnung auf die Klasse gefiltert, Prüfung. Und **⊞ Tabelle** öffnet die Subitems-Tabelle **mit genau den Spalten der Klasse**: alle Produkte darunter, alle ETIM-Attribute, direkt in der Zelle bearbeiten.

## Prüfen, bevor es der Empfänger tut

Die Prüfregel läuft auch in **✓ Datenqualität** und meldet, was nicht passt: eine Klasse, die nicht übernommen ist, eine Zahl, die keine ist, einen Wert, der nicht in der ETIM-Liste steht, ein ETIM-Attribut ohne Zuordnung. Je Knoten seht ihr den Stand als **„2 von 34 gefüllt“** mit Balken und Prozent.

## BMEcat nach ETIM-Guideline 5.0 – gültig

Der Vorlagen-Export bringt die Startvorlage **ETIM BMEcat 5.0** mit – **geprüft gegen `bmecat_etim_501.xsd`: gültig**. Dazu gibt es BMEcat 2005 mit ETIM-Merkmalen. Die ETIM-Attribute schreibt journali so, wie die Guideline sie will: Ja/Nein als `true`/`false`, Zahlen mit Punkt, Bereiche als zwei Werte, Listenwerte als EV-Code.

- **Quelle ist ein Publikationsbaum**: Es geht nur hinaus, was für Kanal und Markt freigegeben ist; im BMEcat 2005 werden die Rubriken die Kataloggruppen.
- **Eure Regeln im Profil**: Klasse ist Pflicht, Werte müssen passen, **Vollständigkeit ≥ n %** je Produkt. Ein Verstoß sperrt den Export – mit Liste.
- **Als Job**: Der Export läuft auf Wunsch regelmäßig in ein Verzeichnis, die durchschnittliche Vollständigkeit steht im Log.

## Ab Pro dabei

ETIM ist **ab dem Tarif Pro** enthalten – Vorlagen-Export und Datenanalyse kommen gleich mit.

## Und jetzt?

journali ist noch in Entwicklung – ETIM steckt schon drin, von der Freigabe bis zum BMEcat. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
