---
title: Konfigurator – euer Shop fragt, journali sagt, was zusammenpasst
excerpt: Teile gehören mit Zeilen zu Konfiguratorgruppen, die summieren, gleiche Werte verlangen oder Mengen und Werte vorgeben – und ein Endpunkt sagt dem Shop, ob die Auswahl geht und was noch fehlt.
slug: konfigurator
tags: [Integration, REST API, Datenqualität]
categories: [Entwicklung]
date: 2026-10-10 06:00
wp: 153
description: Der Konfigurator: Gruppen summieren, verlangen gleiche Werte oder geben Mengen vor – und ein Endpunkt sagt dem Shop, ob die Auswahl geht.
keyphrase: Konfigurator
---
Ein Kunde stellt sich einen Server zusammen: Mainboard, zwei Prozessoren, Arbeitsspeicher, drei Karten. Passt der Kühler zum Gehäuse? Reichen die Steckplätze? Darf er die 16-GB-Bausteine nehmen, die er schon im Warenkorb hat? **Mit dem Konfigurator beantwortet journali diese Fragen – auf dem Server, in einem Aufruf, für jeden Shop.**

## Der Shop schickt die Auswahl, journali antwortet

Der Shop sendet, was gewählt ist: eine Kennung je Zeile – die Id eines Knotens oder ein eindeutiger Wert wie die SKU – und die Menge. Zurück kommt:

- **zulässig** oder nicht, **vollständig** oder nicht,
- die **Verstöße** und das, was **fehlt**, jeweils mit den Teilen, um die es geht – in den Kennungen, die der Shop geschickt hat,
- die **Bilanz** je Gruppe und die Gruppen mit ihren Vorgaben,
- auf Wunsch zu **jedem Teil, das noch dazukommen könnte**: ob es geht, und wenn nicht, warum.

**Die Logik steht nur auf dem Server.** Der Shop kennt die Regeln nicht und muss sie nicht nachbauen; die Ansicht im PIM fragt denselben Endpunkt wie der Shop.

## Gruppen statt Einzelregeln

„Teil A schließt Teil B aus“ gilt für genau diese zwei Produkte und muss bei jedem neuen Produkt nachgepflegt werden. Darum steht die Regel im Konfigurator **an einer Gruppe**, und das Produkt ist Mitglied:

- **Summe:** Mitglieder stellen etwas bereit oder verbrauchen es. Eine Karte verbraucht einen Steckplatz und stellt drei bereit; eine CPU verbraucht eine Portion Kühlpaste. Ist die Summe einer Gruppe kleiner als 0, ist die Auswahl ungültig.
- **Gleiche Werte:** Eine Gruppe kann verlangen, dass alle Mitglieder denselben Wert haben – etwa nur ein CPU-Typ je Server.
- **Vorgaben:** Ein Teil bestimmt Menge und Werte einer Gruppe. Das Mainboard sagt dem Arbeitsspeicher: **genau zwei Bausteine, 8 oder 32 GB.** Ein 16-GB-Baustein ist dann ungültig und gesperrt, ein einzelner Baustein unvollständig.

Die Zeilen eines Teils pflegt ihr dort, wo ihr ohnehin arbeitet: im Band **⚙ Konfiguratorgruppen** in der Knotenansicht. Eine Variante nimmt die Zeilen ihres Produkts, eigene ersetzen sie.

## Der Einbau bestimmt, was ein Teil bedeutet

Eine Zeile kann an eine **Bedingung** geknüpft sein. Eine CPU verbraucht immer einen Prozessorsockel; **mit einem bestimmten Mainboard** stellt sie zusätzlich zwei PCI-Steckplätze bereit; mit einem bestimmten Gehäuse verbraucht sie zwei Kühlungen. Alle Zeilen, deren Bedingung zutrifft, wirken, und Zahlen derselben Gruppe addieren sich. Die Bedingung fragt nach Teilen der Auswahl, nicht nach Summen – so entsteht kein Kreis.

## Ungültig, unvollständig, gesperrt

journali trennt sauber:

- **Ungültig** ist eine Auswahl mit einem Verbot, einer überschrittenen Grenze, einer Summe im Minus oder einem Wert, den die Gruppe nicht erlaubt.
- **Unvollständig** ist eine Auswahl, in der etwas verlangt ist und fehlt – etwa die Mindestmenge einer Gruppe.
- **Bestellbar** ist sie, wenn sie zulässig und vollständig ist.

Ein Teil, das nur den Bedarf ins Minus bringt, ist **nicht gesperrt**: Eine CPU darf in den Warenkorb, bevor die Kühlpaste dabei ist. Dafür zeigt das Ergebnis an jedem wählbaren Teil, **welches die Summe wieder anhebt** (↑). Gesperrt ist, was einen neuen Verstoß verursacht, den ein weiteres Teil nicht beheben kann.

## Regeln für den Rest

Was keine Gruppe abdeckt, steht als Regel „wenn A, dann B“. Die einfachen Formen sind **Sätze, in denen ihr nur die Teile wählt**: passt nicht zusammen, braucht, höchstens, mindestens. Darunter steht jede Regel noch einmal als Satz, und der ist auch die Meldung, wenn ihr keine eigene eintragt. Wer mehr braucht, schaltet auf die technische Form: Summe eines Attributs, Bilanz einer Gruppe, und, oder, nicht.

## Ausprobieren, bevor der Shop es tut

Im Reiter **Prüfen** wählt ihr Teile und seht das Ergebnis genau so, wie der Shop es bekommt – mit den wählbaren Teilen und dem Grund jeder Sperre. **Testfälle** halten eine Auswahl mit dem erwarteten Ergebnis fest; **Alle prüfen** zeigt nach jeder Änderung der Regeln, was sich verschoben hat.

## Ein Konfigurator ist ein Ausgangspunkt

Wo eine Konfiguration beginnt, bestimmt ihr: Die **Wurzel** des Konfigurators legt fest, woraus gewählt werden darf. Zwei Bereiche, die getrennt gerechnet werden sollen, bekommen getrennte Gruppen – etwa eigener Arbeitsspeicher je Mainboard.

Und der Zugriff bleibt, wie er ist: Prüfen braucht nur das Recht zu lesen, und ein Teil, das die Rolle des Aufrufers nicht sieht, gibt es für ihn nicht.

## Und jetzt?

journali ist noch in Entwicklung – der Konfigurator läuft schon. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
