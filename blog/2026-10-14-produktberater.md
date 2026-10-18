---
title: Journali KI Produktberater – eure Besucher fragen, eure Produktdaten antworten
excerpt: Ein Chat-Fenster auf eurer Website, das Fragen zu euren Produkten aus den Daten eines Publikationsbaums beantwortet – mit Rückfragen, Vergleich, Merkzettel und Auszügen aus euren Unterlagen, auch ganz ohne KI.
slug: produktberater
tags: [KI, Suche, Integration, Datenqualität]
categories: [Entwicklung]
date: 2026-10-14 06:00
wp: 233
description: Ein Chat-Fenster auf eurer Website beantwortet Fragen zu euren Produkten aus euren Daten – mit Rückfragen, Vergleich und Merkzettel, auch ohne KI.
---
„Ein Zelt für zwei, unter 3 kg.“ So fragt ein Mensch, nicht ein Suchfeld. **Der Journali KI Produktberater beantwortet solche Fragen auf eurer Website – aus euren gepflegten Produktdaten, mit den Merkmalen, nach denen sich die Treffer unterscheiden, und mit einer Rückfrage, die weiterhilft.** Und das Beste: Der größte Teil davon braucht keine KI.

## Ein Chat-Fenster, das eure Produkte kennt

Ihr bindet ein Fenster in eure Website ein, eure Besucher schreiben, was sie suchen. Der Berater antwortet mit:

- den **passenden Produkten** als Karten, mit Bild und den wichtigsten Werten,
- einer **Rückfrage** am Ende der Antwort: „Passt eines davon? Oder soll ich nach Farbe oder Gewicht eingrenzen?“ – mit je einem Knopf für jedes Merkmal,
- einem **Vergleich** von zwei bis vier Produkten, Zeile für Zeile, gleiche Werte gekennzeichnet,
- einem **Merkzettel** (☆) für Produkte und Varianten, zum Öffnen, Wegnehmen und Vergleichen.

Ein Produkt öffnet sich in einer Ansicht neben dem Gespräch, mit Beschreibung, Werten und Bildern, und von dort jede Variante.

## Ein Gespräch, keine Einzelsuche

Jede Eingabe **ergänzt** das, was schon gesagt wurde: „Zelt“, dann „für zwei“, dann „unter 3 kg“ sucht mit allem zusammen. Die gesammelten Angaben stehen im Fenster und lassen sich einzeln entfernen; „Neue Suche“ fängt von vorn an.

Der Berater versteht dabei mehr als Stichwörter:

- **Zahlen mit Einheit:** „unter 3 kg“ wird ein Filter auf das Gewicht, „ab 550 W“ einer auf die Leistung.
- **Werte aus Listen:** „rot“ wird ein Filter auf die Farbe, wenn das Wort genau einen Wert trifft.
- **Eigenschaftswörter:** „leicht“, „schwer“, „hell“, „groß“ beziehen sich auf das Zahlenattribut mit der passenden Einheit und gelten im Verhältnis zu den Treffern: „leicht“ ist die leichtere Hälfte, die leichtesten zuerst.
- **Tippfehler:** „zeit“ liest er als „zelt“ und sagt es in der Antwort.
- **Fragen zum Produkt im Blick:** „Ist es wasserdicht?“ beantworten die Werte des Produkts, das gerade offen ist.

Findet nichts mehr, sagt der Berater, **welche Angabe zu eng ist** und wie viele Produkte es ohne sie wären. Ein Klick nimmt sie weg.

## Funktioniert auch ohne KI

Hier liegt der Unterschied zu einem Chat, der nur ein Sprachmodell vor eure Produkte setzt. **Treffer, Rückfragen, Vergleich und Auszüge aus den Unterlagen kommen ohne KI zustande:**

- **Treffer über die Wörter** der Frage im Namen, in den Attributen der Sicht und in den Achsen der Varianten. Die Art eines Produkts („zelt“, „hose“) grenzt ein, jedes andere Wort ordnet.
- **Treffer über den Sinn** mit dem Plugin embed: Die Frage wird in einen Vektor umgerechnet und mit den Vektoren eurer Produkte verglichen – auf eurem eigenen Server, ohne fremden Dienst. So findet „hält Hitze aus“ ein Produkt mit „temperaturbeständig bis 120 °C“.
- **Merkmale als Rückfrage:** Attribute vom Typ Liste, ja/nein und Zahl, nach denen sich die Treffer unterscheiden, mit Anzahl je Wert. Vorn steht, was die Treffer am gleichmäßigsten teilt.
- **Auszüge aus euren Unterlagen:** Was in keinem Attribut steht – wie man einen klemmenden Reißverschluss gängig macht, warum ein Zelt innen nass wird –, steht in den Dokumenten an euren Produkten und Gruppen. Der Berater sucht den passenden Abschnitt heraus und nennt Dokument und Seite.

Jede Antwort setzt sich aus euren Daten zusammen. **Was der Berater sagt, steht so in eurem PIM.**

## KI, wenn ihr wollt – gekennzeichnet und mit eurem Schlüssel

Schaltet ihr die KI an einem Berater ein, kommt zweierlei dazu:

- Die KI schreibt **zwei bis vier Sätze zu den ersten Treffern**. Das Fenster kennzeichnet den Text als „Text von einer KI erstellt“.
- Was die Regeln in einer Eingabe nicht erkannt haben, übersetzt die KI in Filter – nur aus den Attributen und Werten der Sicht, vom Server geprüft. Was nicht passt, fällt weg.

Die KI ist die eures Teams: **euer Anbieter, euer Schlüssel, euer Verbrauch.** Sie bekommt die nummerierten Treffer mit ihren Werten und keine Werkzeuge. Fehlt der Schlüssel oder ist die Tagesgrenze erreicht, kommt die Antwort ohne diesen Text – die Treffer bleiben.

## Ihr bestimmt, was öffentlich ist

Ein Berater zeigt genau das, was ihr ihm gebt. Drei Angaben, jede schränkt ein:

| Angabe | bestimmt |
|---|---|
| Publikationsbaum | welche Produkte – das, was der Baum für seinen Kanal ausleitet, mit den freigegebenen Varianten |
| Rolle | was davon sichtbar ist – eingeschränkte Knoten und Ordner von Medien fallen weg |
| Sicht | welche Attribute erscheinen – am Produkt, in den Rückfragen, im Vergleich und im Text der KI |

**Ein internes Attribut wie der Einkaufspreis erscheint nirgends**, auch nicht als Filter. Bilder und Dokumente erscheinen nur, wenn sie heute gelten und freigegeben sind.

## Für Besucher und für KI-Agenten

Dieselben Fragen stellen auch fremde KI-Agenten: Der Berater bietet einen **MCP-Server** an, mit Werkzeugen zum Suchen, Lesen und Vergleichen, alle nur lesend. Ein Assistent, der für einen Menschen nach einem Produkt sucht, bekommt dieselben Treffer und dieselben Auszüge wie euer Besucher im Fenster.

## Gut zu wissen

- **Eingebunden mit einem Tag:** ein `<script>` auf eurer Seite, schwebend mit Knopf oder in einem Element eurer Seite, auf Deutsch oder Englisch.
- **Nichts im Browser:** Das Fenster setzt kein Cookie und speichert nichts im Browser. Gespräch und Merkzettel liegen im Arbeitsspeicher der Seite und sind nach dem Neuladen leer.
- **Preise und Verfügbarkeit** kennt der Berater, soweit sie Attribute der Sicht sind. Ein Verweis vom Treffer in euren Shop ist noch nicht gebaut.
- **Angelegt** wird ein Berater unter ⇪ Export → Produktberatung. Die Vorschau dort stellt dieselbe Frage wie ein Besucher.

## Und jetzt?

journali ist noch in Entwicklung – der Journali KI Produktberater läuft schon. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
