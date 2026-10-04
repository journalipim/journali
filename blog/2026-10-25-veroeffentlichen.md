---
title: Vom Produkt zum Kanal – Veröffentlichen in journali
excerpt: Pflichtfelder je Kanal und Sprache, Freigabe nur für Vollständiges und Publikationsbäume mit Verweisen, Kopien und Regeln: journali leitet aus, was freigegeben ist, und sagt bei allem anderen, warum es zurückbleibt.
slug: veroeffentlichen
tags: [Datenqualität, Workflow, Mehrsprachigkeit, Import & Export]
categories: [Entwicklung]
date: 2026-10-25
---
Die Heckenschere soll ab Montag im Webshop stehen. Die englische Beschreibung fehlt noch, und in der Schweiz wird sie gar nicht verkauft. In vielen Abläufen merkt das jemand erst, wenn der Export schon hinausgegangen ist. **In journali merkt ihr es vorher – und zwar an der Stelle, an der ihr freigeben wollt.**

## Pflicht steht im Modell, je Kanal und Sprache

Welche Attribute Pflicht sind, legt ihr am Attribut fest: **je Kanal, und je Sprache oder für alle Sprachen auf einmal.** Für den Webshop braucht ihr vielleicht Titel und Beschreibung in Deutsch und Englisch, für den Printkatalog nur die deutschen Werte. Beides steht an einer Stelle und gilt überall gleich.

Gezählt wird ehrlich: Vererbte Werte zählen, wenn das Attribut vererbbar ist. Ein Attribut mit mehreren Zeilen braucht mindestens eine. Und **ein Wert, der nur aus der Mastersprache kommt, zählt nicht als Übersetzung.**

## ✓ Freigaben: der Blick auf jeden Kanal

An jeder Variante zeigt der Abschnitt **✓ Freigaben** eine Tabelle: Kanäle in den Zeilen, Sprachen in den Spalten, in jeder Zelle die Zahl der gefüllten gegen die verlangten Pflichtwerte (etwa 3/4), grün oder rot. Fehlt etwas, nennt der Tooltip genau die Attribute. Die Prüfung der Vollständigkeit übernimmt journali, ihr müsst keine Liste führen.

## Freigeben geht nur mit Vollständigem

Freigegeben wird **die Variante, je Kanal und wahlweise je Sprache.** Der Knopf bleibt aus, solange Pflichtwerte fehlen. Dieselbe Prüfung gilt für jeden anderen Weg zur Freigabe: Fehlt etwas, **lehnt journali die Freigabe ab und listet auf, was fehlt.**

Am Produkt oder an einer Produktgruppe geht es in einem Zug: Alle vollständigen Varianten darunter werden freigegeben, die übrigen nennt journali mit ihren Lücken. Eine Freigabe lässt sich jederzeit zurücknehmen. Und ein Workflow kann die Freigabe als Wirkung eines Schritts auslösen: Der Schritt prüft vorher, ob er gehen kann, und bleibt stehen, wenn keine Variante vollständig ist.

Hat ein Kanal einen Fallback-Kanal, gilt dessen Freigabe mit, solange der Kanal nichts Eigenes sagt. Euer Shop für die Schweiz übernimmt so das Sortiment des deutschen, bis ihr es anders entscheidet.

## Publikationsbäume: eine Gliederung je Kanal

Was hinausgeht, ist das eine. **In welcher Gliederung** es hinausgeht, das andere. Unter **⇶ Publikation** baut ihr je Kanal, wahlweise je Markt, einen Baum aus **Rubriken.** Links steht euer Pflegebaum, rechts zieht ihr Äste hinüber. Dabei habt ihr die Wahl:

- **↗ Verweis** – die Gruppe oder das Produkt bleibt, wo es ist, und der Baum folgt dem Pflegebaum.
- **⇊ Kopie** – die Gliederung wird übernommen und lässt sich danach frei umbauen: ziehen, umhängen, eigene Rubriken ergänzen.

Dasselbe Produkt darf in mehreren Rubriken hängen. Eine Rubrik trägt **eigene Texte und Bilder** wie jeder Knoten, und ein Verweis kann einen **Anzeigenamen** bekommen, der nur im Baum gilt. Der Pflegename bleibt unberührt.

## Regeln füllen Rubriken von selbst

Händisch einsortieren geht, aber besser ist eine **Regel**: „alle Gruppen namens Ersatzteile“ oder „alle Produkte mit diesem Attributwert“, flach oder gegliedert nach der Produktgruppe darüber. Vor dem Speichern zeigt die Vorschau, wie viele Gruppen und Produkte die Regel trifft. **Kommt später eine neue Produktgruppe mit passendem Namen dazu, ist sie automatisch in der Rubrik.** Produkte, die in einem Baum noch nirgends hängen, zählt **⚠** als nicht einsortiert.

## Was ausgeleitet wird und was nicht

Ein Produkt geht hinaus, wenn **mindestens eine Variante für den Kanal des Baums freigegeben ist** – und der **Markt des Baums in den Verkaufsländern** des Produkts steht. Die Verkaufsländer vererben sich von der Gruppe nach unten; ist nichts eingetragen, gilt das Produkt überall. Auch Märkte können einen Fallback nennen: Ein Markt bekommt das Sortiment seines Fallback-Marktes, solange er nichts Eigenes sagt. Ein Produkt ohne Variante geht nie hinaus, denn Freigabe gibt es nur an der Variante.

Der Zähler am Baum zeigt **ausgeleitet** in Grün und **zurückgehalten** in Rot. Zu jedem zurückgehaltenen Produkt steht der Grund da:

- „nicht freigegeben für web“
- „Markt ch nicht in den Verkaufsländern (fr)“
- „keine Variante – Freigabe gibt es nur an der Variante“

Betrifft ein Grund nur einen Teil der Varianten, steht „n von m Varianten“ dabei. Ein Klick auf ▣ öffnet das Produkt im Pflegebaum, ⇶ bringt euch zurück.

## Den Stand einer Rubrik einfrieren

Der Katalog ist geschlossen, die Pflege geht weiter? Eine Rubrik lässt sich auf einen **Journalstand einfrieren.** Alles darunter liest die Pflege dann wie zu diesem Zeitpunkt: Freigaben, Verkaufsländer, Varianten. Kopiert wird nichts, es ist ein Zeiger ins Journal. Was danach neu angelegt wurde, ist im eingefrorenen Baum „noch nicht vorhanden“, und der Stand lässt sich wieder aufheben. Wie aus einem Stand ein unveränderliches Dokument wird, steht im Beitrag [Versionen](/?p=69).

## Aus dem Baum wird eine Datei

Die Ausleitung ist kein Bild auf dem Bildschirm, sie ist die Quelle der Exporte. Ein Export-Job für **CSV oder Excel** nimmt statt eines Teilbaums einen Publikationsbaum: Dann geht hinaus, was für den Kanal freigegeben ist und im Markt verkauft wird. Für **BMEcat nach Vorlage** werden die Rubriken zu Kataloggruppen, und Zurückgehaltenes steht in den Statistiken des Laufs. Mehr zu Profilen und Jobs im Beitrag [Import und Export](/?p=71).

## Und jetzt?

journali ist noch in Entwicklung – Pflichtfelder, Freigabe und Publikationsbäume stecken schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
