---
title: ETIM – wie technische Produkte zu einer gemeinsamen Sprache kommen
excerpt: ETIM beschreibt technische Produkte über Klassen, Merkmale, Werte und Einheiten, die für alle Lieferanten gleich sind; BMEcat ist die Datei, in der sie ankommen.
slug: etim-klassifikation-erklaert
tags: [Klassifikation, ETIM, BMEcat]
categories: [Wissen]
date: 2026-11-03
---
Ein Hersteller nennt es „Breite“, der nächste „B“, der dritte „Gehäusebreite in mm“. Für einen Großhändler, der Tausende Artikel von vielen Lieferanten vergleichbar anbieten will, ist das ein Problem: **Dieselbe Eigenschaft steht überall anders da.** ETIM löst es mit einem gemeinsamen Modell: Jedes technische Produkt gehört in eine Klasse, und jede Klasse legt fest, welche Merkmale es gibt und in welcher Form ihre Werte stehen.

## Was ETIM ist

**ETIM International** ist nach eigener Darstellung eine gemeinnützige Organisation, die Entwicklung, Pflege, Veröffentlichung und Förderung des ETIM-Klassifikationsmodells zentral verwaltet. Sie vereint ETIM-Organisationen aus **21 Ländern**; das Modell steht in **17 Sprachen** zur Verfügung. Ursprünglich auf die niederländische Elektrotechnik ausgerichtet, deckt es heute Elektrotechnik, Heizung, Lüftung und Sanitär, Baustoffe und Produkte für den Schiffbau einschließlich Werkzeugen ab.

## Wie das Modell aufgebaut ist

ETIM kennt sechs Bausteine:

| Baustein | Was er festlegt |
|---|---|
| Produktgruppe | die obere Ebene; jede Klasse gehört zu genau einer Gruppe |
| Produktklasse | fasst ähnliche Produkte verschiedener Hersteller zusammen |
| Synonym | ein anderer Name für eine Klasse, je Sprache |
| Merkmal (englisch Feature) | eine Eigenschaft mit Typ, Einheit und/oder Werten |
| Wert | ein Eintrag aus der festen Liste eines Merkmals |
| Einheit | die Maßeinheit eines numerischen Merkmals oder Bereichs |

Jede Klasse, jedes Merkmal, jeder Wert und jede Einheit hat eine **eindeutige Kennung, die von der Sprache unabhängig ist**; nur die Beschreibungen sind sprachabhängig. So bleibt ein Merkmal in jeder Sprache dasselbe.

Ein Merkmal hat einen von vier **Typen**:

- **A – alphanumerisch:** ein Wert aus einer vorgegebenen Liste,
- **L – logisch:** eine Ja/Nein-Frage,
- **N – numerisch:** eine Zahl,
- **R – Bereich:** zwei Zahlen, die einen Bereich begrenzen.

Bei alphanumerischen Merkmalen gibt es **keinen Freitext**: Jedes ist mit einer festen Liste erlaubter Werte verbunden. Numerische Merkmale und Bereiche können eine Einheit tragen; dann muss der Wert in dieser Einheit stehen.

## Wie neue Versionen entstehen

Offizielle internationale Freigaben erscheinen **etwa alle drei Jahre**. Die aktuelle ist **ETIM 10.0**, veröffentlicht am **10. Dezember 2024**: Aus **5 264 Änderungsanträgen** entstanden unter anderem **119 neue Klassen**. Das Standardformat der Freigabe ist **ETIM IXF**, eine XML-Datei; zusätzlich gibt es Versionen in Excel und CSV. Wer häufiger aktualisieren will, bekommt dazu dynamische Zwischenfreigaben mit Klassen im Status „bereit zur Veröffentlichung“.

## Wie ETIM zum BMEcat kommt

**BMEcat** ist ein XML-Austauschformat für Produktkataloge, entwickelt vom Bundesverband Materialwirtschaft, Einkauf und Logistik (BME). Beide Standards ergänzen sich: **BMEcat beschreibt, wie die Katalogdatei aufgebaut ist; ETIM beschreibt, was das Produkt ist** – seine Klasse und ihre Merkmale. ETIM International empfiehlt BMEcat als das am weitesten verbreitete Austauschformat in den ETIM-Ländern.

## Was es schwierig macht

- **Jedes Produkt braucht seine Klasse**, und die muss zum Produkt passen. Bei Tausenden Artikeln ist das Auswahlarbeit.
- **Der Typ des Merkmals bestimmt die Form des Werts:** Ja/Nein, Zahl mit Einheit, Bereich als zwei Zahlen oder ein Wert aus der Liste. Ein Wert, der nicht in der Liste steht, ist falsch, auch wenn er richtig aussieht.
- **Eigene Attribute heißen anders** als die Merkmale der Klasse. Wer längst „breite“ und „farbe“ pflegt, muss sie den ETIM-Merkmalen zuordnen und dabei Einheiten und Schreibweisen umrechnen.
- **Alles ändert sich mit der Freigabe:** Klassen kommen hinzu, Merkmale und Listen ändern sich.
- **Der Empfänger prüft.** Eine Datei, die nicht zum Schema passt oder deren Werte nicht zur Klasse passen, geht zurück.

## Wie journali es löst

In journali übernimmt das Plugin **ETIM** diese Schritte:

- Es liest die **Freigabe im Format IXF 3.1** ein, auch aus einer Zip-Datei; alle Klassen stehen danach im Journal, in den Sprachen eures Modells, und niemand braucht die Datei mehr.
- Ihr weist eine Klasse am Knoten zu; sie **erbt auf alles darunter**. Die Attributgruppe der Klasse hängt journali gleich mit an.
- Jedes ETIM-Merkmal lässt sich einem **vorhandenen eigenen Attribut zuordnen**, mit einer Umwandlungskette für Einheiten, Ja/Nein und Listenwerte.
- Die Prüfung meldet Zahlen, die keine sind, Werte außerhalb der Liste und Merkmale ohne Zuordnung, auch in ✓ Datenqualität.
- Der Vorlagen-Export bringt **ETIM BMEcat 5.0** mit, geprüft gegen das ETIM-Schema `bmecat_etim_501.xsd`.

Mehr dazu: [ETIM in journali](/?p=42).

## Hinweis

Dieser Beitrag beschreibt ETIM nach den Veröffentlichungen von ETIM International am 4. Oktober 2026. Er ist keine Rechtsberatung und ersetzt nicht die Lektüre der Guidelines.

## Quellen

- ETIM International, Über uns – [etim-international.com](https://www.etim-international.com/about-us/)
- ETIM International, Modellinformation – [etim-international.com](https://www.etim-international.com/classification/model-information/)
- ETIM International, Release Policy – [etim-international.com](https://www.etim-international.com/classification/release-policy/)
- ETIM International, Neue Freigabe ETIM 10.0 – [etim-international.com](https://www.etim-international.com/new-release-etim-10-0-available/)
- Mittelstand-Digital Zentrum WertNetzWerke, BMEcat Katalogaustauschformat – [mittelstand-digital-wertnetzwerke.de](https://www.mittelstand-digital-wertnetzwerke.de/interoperabilitaet/standards-im-e-business/katalogaustausch/bmecat/)
