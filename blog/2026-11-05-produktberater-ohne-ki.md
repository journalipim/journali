---
title: Journali KI Produktberater – was er versteht, auch ganz ohne KI
excerpt: Zwei Personen, unter 200 Euro, mindestens 400 Lumen, für Minusgrade: Der Produktberater macht aus Kundensätzen genaue Angaben – ohne KI-Anbindung, geprüft an 17 Gesprächen.
slug: produktberater-ohne-ki
tags: [KI, Produktberatung, Suche, Onlineshop]
categories: [Entwicklung]
date: 2026-11-05 06:00
wp: 255
description: Zwei Personen, unter 200 Euro, mindestens 400 Lumen, für Minusgrade: Der Produktberater macht aus Kundensätzen genaue Angaben – ohne KI-Anbindung.
---
Ein Kunde schreibt nicht „persons = 2“. Er schreibt **„Ich brauche ein Zelt für zwei Personen“**. Er schreibt „unter 200 Euro“, „mit Rotlicht“, „für Minusgrade“ – und erwartet, dass ihn jemand versteht. **Der [Journali KI Produktberater](/?p=233) versteht das auch dann, wenn ihr gar keine KI anbindet.** Er liest die Sätze gegen eure Produktdaten: Attribute, Einheiten, Wertelisten, Namen. Mit KI wird die Antwort zusätzlich ein Text – nötig ist sie dafür nicht.

## So sieht das aus

Die Beispiele stammen aus unseren Testdaten: einer erfundenen Outdoor-Marke mit gut 200 Produkten, Varianten, technischen Merkmalen und Unterlagen. Jede Zeile ist eine Eingabe, wie ein Kunde sie tippt, und das, was der Berater daraus macht – ohne KI.

| Der Kunde schreibt | Der Berater versteht | und antwortet |
|---|---|---|
| Ich brauche ein Zelt für zwei Personen | Personen: 2 | die Zelte für zwei |
| eins, das schnell aufgebaut ist | Aufbauzeit: kurz | davon die mit der kürzeren Aufbauzeit |
| Ich suche ein leichtes Zelt | Gewicht: leicht | die leichteren Zelte |
| in rot | Farbe: Rot | keines – rote Zelte gibt es nicht, und er sagt das |
| Regenjacke unter 200 Euro | Preis: bis 200 € | Regenjacken in diesem Rahmen |
| mit helmkapuze | Helmtaugliche Kapuze: ja | nur noch die mit Helmkapuze |
| Tagesrucksack mit 30 Litern | Volumen: 30 l | die Tagesrucksäcke mit 30 Litern |
| ja, mit trinksystem | Trinksystemvorbereitet: ja | davon die fürs Trinksystem |
| Stirnlampe mit mindestens 400 Lumen | Lichtstrom: ab 400 lm | die hellen Stirnlampen |
| mit rotlicht | Rotlicht: ja | davon die mit Rotlicht |
| Wanderschuhe in 43, wasserdicht mit Membran | Schuhgröße EU 43, Wasserdichte Membran: ja | die passenden Wanderschuhe |
| Trinkflasche, die Tee lange warm hält | Hält warm: lange | die Flaschen, die länger warm halten |
| gibt es die auch in orange? | Farbe: Orange | dieselbe Suche, nur in Orange |
| isomate | „isomate“ als „isomatte“ gelesen | die Isomatten – und sagt, wie er es gelesen hat |
| Was kostet die Fjell Jacke? | eine Frage zu genau einem Produkt | den Preis dieser Jacke |
| Bei meinen Wanderschuhen ist der Schnürsenkel gerissen | keine Suche, ein Problem | den passenden Abschnitt aus der Reparaturanleitung |
| lightweight tent for two people | persons: 2, weight: light | die leichten Zelte für zwei, auf Englisch |

Was dabei zählt: **Der Berater sammelt.** „in rot“ gilt für die Zelte von eben, „mit rotlicht“ für die hellen Stirnlampen von eben. Und er merkt sich, was gefragt wurde – wechselt der Kunde von der Hose in Größe M zum Schlafsack, fragt er nach („Stattdessen nach Schlafsack suchen?“) und übernimmt die Größe, wenn es sie beim Schlafsack auch gibt.

## Wenn eine Angabe mehreres meinen kann, fragt er nach

„Schlafsack für Minusgrade“ – gemeint ist eine Temperatur, aber welche? Ein Schlafsack hat drei: Komfort, Grenze, Extrem. **Statt zu raten, fragt der Berater:** „Meinen Sie Komforttemperatur, Extremtemperatur oder Grenztemperatur?“ – jede Möglichkeit ein Knopf. Ein Klick auf „Komforttemperatur: bis 0 °C“, danach „bis minus 10 grad“: Der Berater ersetzt den Wert und zeigt die Schlafsäcke, die bis −10 °C komfortabel sind.

Genauso bei Länge und Breite in Zentimetern oder bei zwei Zeitangaben in Stunden. Hat nur eines der Attribute bei den gezeigten Produkten einen Wert, nimmt er dieses – ohne Rückfrage.

## Woher er das weiß

Nicht aus einer Liste für Outdoor-Artikel. Der Berater kennt eure **Attribute mit ihren Bezeichnungen, Einheiten und Wertelisten** – genau die, die in der Sicht des Beraters stehen. Daraus folgt alles Weitere:

- **Einheiten:** „30 Litern“ trifft das Attribut in Litern, „minus 10 grad“ das in °C, „400 Lumen“ das in Lumen.
- **Bezeichnungen, auch gebeugt und zusammengesetzt:** „wasserdichter Membran“ trifft „Wasserdichte Membran“, „helmkapuze“ trifft „Helmtaugliche Kapuze“, „trinksystem“ trifft „Trinksystemvorbereitet“.
- **Eigenschaften nach Größe der Einheit:** „leicht“ meint Masse, „hell“ Lichtstrom, „schnell“ eine kurze Zeit – an dem Attribut, das die gesuchten Produkte haben. Bei einem Zelt ist „leicht“ sein Gewicht, nicht die Zuladung eines Rucksacks.
- **Zahlwörter und Geld:** „zwei Personen“, „unter 200 Euro“, „für 150 €“.
- **Die Produktnamen:** Was im Namen steht, ist die Art – „Zelt“, „Stirnlampe“. Ein Tippfehler wird zum nächsten Namen, und der Berater sagt, wie er es gelesen hat.

Ändert ihr ein Attribut, eine Einheit oder eine Werteliste in journali, versteht der Berater es beim nächsten Gespräch. Niemand pflegt eine zweite Liste von Synonymen.

## Geprüft, nicht vorgeführt

Jede Zeile der Tabelle ist Teil eines **Prüfstands**: 17 Gespräche mit einem oder mehreren Schritten, je mit der erwarteten Antwort, die meisten mit einem Vorbild, wie ein guter Verkäufer antworten würde. Der Prüfstand spielt sie gegen echte Daten durch und zeigt jede Abweichung. Ein neuer Fall aus der Praxis wird ein neues Gespräch im Prüfstand – so fällt auf, wenn eine spätere Änderung ihn wieder bricht.

## Und mit KI?

Bindet ihr eine KI über den Schlüssel eures Teams an, formuliert sie die Antwort als Text und versteht auch das, was keine Regel erfasst. Die Auswahl bleibt dieselbe: **journali entscheidet, welche Produkte passen – die KI erklärt sie.** Ohne KI bekommt ihr dieselben Treffer, dieselben Rückfragen, dieselben Unterlagen.

## Und jetzt?

journali ist noch in Entwicklung – der Journali KI Produktberater versteht schon heute, was eure Kunden schreiben. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
