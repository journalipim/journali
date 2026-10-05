---
title: GPC – die Produktklassifikation von GS1 und was sie von Produktdaten verlangt
excerpt: Die Global Product Classification ordnet Produkte in vier Ebenen bis zum Brick, der Brick trägt Attribute mit festen Werten – und zweimal im Jahr erscheint eine neue Veröffentlichung.
slug: gpc-klassifikation-erklaert
tags: [Klassifikation, GS1 GPC]
categories: [Wissen]
date: 2026-11-06
wp: 162
---
Ein Händler bekommt Produktdaten von hunderten Lieferanten und muss sie in seinem System einordnen. Ohne gemeinsame Kategorien heißt dieselbe Ware überall anders. **Die GPC von GS1 gibt jedem Produkt eine Kategorie, die weltweit gleich ist** – und jeder Kategorie die Attribute, mit denen ein Produkt dort beschrieben wird.

## Der Aufbau: vier Ebenen bis zum Brick

Die **Global Product Classification (GPC)** besteht aus einer Hierarchie mit vier Ebenen, von oben nach unten:

1. **Segment** – eine logische Gruppierung von Familien mit ähnlichen Eigenschaften,
2. **Family** – teilt ein Segment grob auf,
3. **Class** – teilt eine Family weiter auf,
4. **Brick** – eine Kategorie ähnlicher Produkte.

Die Ebenen Segment, Family und Class dienen nur dazu, den passenden **Brick** zu finden; mitgeteilt wird über den Datenpool von GS1 der Brick. Bricks lassen sich auch ohne die Hierarchie verwenden.

## Attribute und Werte am Brick

Unter dem Brick liegt eine weitere Ebene: Jeder Brick kann ein oder mehrere **Attribute** haben, und jedes Attribut hat eine Menge **Attributwerte**, die sich gegenseitig ausschließen. Ein Produkt hat je Attribut also einen dieser Werte und nicht mehrere. Brick-Attribute und -Werte gehören nicht zur Hierarchie, weil sie sich nicht zu höheren Ebenen zusammenfassen lassen.

Die Codes folgen einer Regel: Brick-Codes beginnen mit **1**, Attribut-Codes mit **2** und Attributwert-Codes mit **3**.

## Zweimal im Jahr eine neue Veröffentlichung

Die GPC wird **zweimal im Jahr** veröffentlicht. Nach jeder Veröffentlichung gehen die Dateien an das **Global Data Synchronisation Network (GDSN)**, in dem Hersteller, Händler und Datenpools Produktdaten austauschen; die GPC gehört zum Standardpaket von GS1 für dieses Netzwerk. Zum Nachschlagen gibt es den **GPC Browser** von GS1 im Netz.

## Was es schwierig macht

- **Zu jedem Produkt gehört ein Brick**, und der passende steht unter tausenden anderen.
- **Die Attribute hängen am Brick.** Wer ein Produkt einem anderen Brick zuordnet, bekommt andere Attribute.
- **Werte kommen aus festen Listen.** Ein Wert, der nicht in der Liste steht, ist kein GPC-Wert.
- **Mehrere Sprachen:** Titel und Definitionen gibt es in mehreren Sprachen, die Codes bleiben gleich.
- **Die Veröffentlichung ändert sich** zweimal im Jahr: Bricks, Attribute und Werte können hinzukommen oder sich ändern.

## Wie journali es löst

In journali übernimmt das Plugin **GPC** diese Schritte:

- Ihr holt die Veröffentlichung bei GS1 – laut GS1 ist die GPC kostenfrei nutzbar – und **lest das Zip oder die JSON-Datei im Browser ein**. Im Repository liegen keine GPC-Daten.
- Die Bricks stehen danach im Journal; eine weitere Sprache aus einer anderen Datei derselben Version **ergänzt die Titel**, die Struktur bleibt.
- Ihr **sucht** nach Code, Titel, Weg und Definition und weist den Brick am Knoten zu. Wer will, lässt sich per KI-Vorschlag helfen.
- Beim Zuweisen legt journali an, was fehlt: die Attributgruppe des Bricks mit **je GPC-Attribut einem Listenattribut**. Die Klasse **erbt auf alles darunter**.
- Das Band **⌗ GPC** zeigt am Knoten die Klasse, eigen oder geerbt, und die Zahl ihrer Attribute.

Ehrlich dazu: Ein Export ins GDSN gehört nicht zum Plugin. journali pflegt die Klassifikation und ihre Attribute. GPC gehört zu den Plugins ab dem Tarif **Pro+**. Mehr dazu: [GPC in journali](/?p=44).

## Hinweis

Dieser Beitrag beschreibt die GPC nach den Veröffentlichungen von GS1 am 4. Oktober 2026. Er ersetzt nicht die Lektüre der GS1-Dokumente.

## Quellen

- GS1, Global Product Classification (GPC) Development & Implementation Guide – [gs1-germany.de](https://www.gs1-germany.de/fileadmin/gs1/fachpublikationen/GPC_Development_and_Implementation_Guide_8.0.pdf)
- GS1, How is GPC implemented and integrated into GDSN? – [support.gs1.org](https://support.gs1.org/support/solutions/articles/43000734200-how-is-gpc-implemented-and-integrated-into-gdsn-)
- GS1, GPC Browser – [gpc-browser.gs1.org](https://gpc-browser.gs1.org/)
