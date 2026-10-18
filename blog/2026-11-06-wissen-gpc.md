---
title: Global Product Classification (GPC): Bricks und Attribute von GS1
excerpt: Die Global Product Classification (GPC) von GS1 ordnet Produkte in vier Ebenen bis zum Brick; der Beitrag erklärt Bricks, Attribute, Werte und Codes.
slug: gpc-klassifikation-erklaert
tags: [Klassifikation, GS1 GPC]
categories: [Wissen]
date: 2026-11-06 06:00
wp: 162
keyphrase: Global Product Classification
---
Die **Global Product Classification (GPC)** ist die Produktklassifikation von GS1: Sie gibt jedem Produkt eine Kategorie, die weltweit gleich ist – und jeder Kategorie die Attribute, mit denen ein Produkt dort beschrieben wird. Ein Händler bekommt Produktdaten von hunderten Lieferanten und muss sie in seinem System einordnen. Ohne gemeinsame Kategorien heißt dieselbe Ware überall anders.

## Auf einen Blick

- Die GPC ordnet Produkte in vier Ebenen: Segment, Family, Class und Brick.
- Über den Datenpool von GS1 wird der Brick mitgeteilt; Segment, Family und Class dienen nur dazu, den passenden Brick zu finden.
- Jeder Brick kann Attribute haben, und je Attribut hat ein Produkt einen Wert aus einer Menge von Werten, die sich gegenseitig ausschließen.
- Brick-Codes beginnen mit 1, Attribut-Codes mit 2 und Attributwert-Codes mit 3.
- Die GPC wird zweimal im Jahr veröffentlicht und geht danach an das Global Data Synchronisation Network (GDSN).
- Titel und Definitionen gibt es in mehreren Sprachen; die Codes bleiben gleich.

## Wie ist die GPC aufgebaut?

Die GPC besteht aus einer Hierarchie mit vier Ebenen, von oben nach unten:

1. **Segment** – eine logische Gruppierung von Familien mit ähnlichen Eigenschaften,
2. **Family** – teilt ein Segment grob auf,
3. **Class** – teilt eine Family weiter auf,
4. **Brick** – eine Kategorie ähnlicher Produkte.

Die Ebenen Segment, Family und Class dienen nur dazu, den passenden **Brick** zu finden; mitgeteilt wird über den Datenpool von GS1 der Brick. Bricks lassen sich auch ohne die Hierarchie verwenden.

## Welche Attribute hat ein GPC-Brick?

Unter dem Brick liegt eine weitere Ebene: Jeder Brick kann ein oder mehrere **Attribute** haben, und jedes Attribut hat eine Menge **Attributwerte**, die sich gegenseitig ausschließen. Ein Produkt hat je Attribut also einen dieser Werte und nicht mehrere. Brick-Attribute und -Werte gehören nicht zur Hierarchie, weil sie sich nicht zu höheren Ebenen zusammenfassen lassen.

Die Codes folgen einer Regel: Brick-Codes beginnen mit **1**, Attribut-Codes mit **2** und Attributwert-Codes mit **3**.

## Wie oft erscheint eine neue GPC-Version?

Die GPC wird **zweimal im Jahr** veröffentlicht. Nach jeder Veröffentlichung gehen die Dateien an das **Global Data Synchronisation Network (GDSN)**, in dem Hersteller, Händler und Datenpools Produktdaten austauschen; die GPC gehört zum Standardpaket von GS1 für dieses Netzwerk. Zum Nachschlagen gibt es den **GPC Browser** von GS1 im Netz.

## Was es schwierig macht

- **Zu jedem Produkt gehört ein Brick**, und der passende steht unter tausenden anderen.
- **Die Attribute hängen am Brick.** Wer ein Produkt einem anderen Brick zuordnet, bekommt andere Attribute.
- **Werte kommen aus festen Listen.** Ein Wert, der nicht in der Liste steht, ist kein GPC-Wert.
- **Mehrere Sprachen:** Titel und Definitionen gibt es in mehreren Sprachen, die Codes bleiben gleich.
- **Die Veröffentlichung ändert sich** zweimal im Jahr: Bricks, Attribute und Werte können hinzukommen oder sich ändern.

## Wie journali es löst

In journali übernimmt das Plugin **GPC** diese Schritte:

- Ihr holt die Veröffentlichung bei GS1 und **lest das Zip oder die JSON-Datei im Browser ein**. Im Repository liegen keine GPC-Daten.
- Die Bricks stehen danach im Journal; eine weitere Sprache aus einer anderen Datei derselben Version **ergänzt die Titel**, die Struktur bleibt.
- Ihr **sucht** nach Code, Titel, Weg und Definition und weist den Brick am Knoten zu. Wer will, lässt sich per KI-Vorschlag helfen.
- Beim Zuweisen legt journali an, was fehlt: die Attributgruppe des Bricks mit **je GPC-Attribut einem Listenattribut**. Die Klasse **erbt auf alles darunter**.
- Das Band **⌗ GPC** zeigt am Knoten die Klasse, eigen oder geerbt, und die Zahl ihrer Attribute.

Ein Export ins GDSN gehört nicht zum Plugin. journali pflegt die Klassifikation und ihre Attribute. Mehr dazu: [GPC-Klassifikation im PIM journali pflegen](https://journali.de/2026/10/04/gpc-klassifikation/).

Verwandte Themen: [ETIM: Klassifikation technischer Produkte](https://journali.de/2026/11/03/etim-klassifikation-erklaert/), [Digitaler Produktpass (DPP) erklärt](https://journali.de/2026/09/06/digitaler-produktpass-erklaert/).

## Häufige Fragen

### Was ist die GPC von GS1?

Die Global Product Classification (GPC) ist die Produktklassifikation von GS1, die jedem Produkt eine weltweit gleiche Kategorie gibt. Die GPC ordnet Produkte in vier Ebenen – Segment, Family, Class und Brick – und gibt jedem Brick die Attribute, mit denen ein Produkt dort beschrieben wird.

### Was ist ein GPC-Brick?

Ein GPC-Brick ist die unterste der vier Ebenen der GPC und eine Kategorie ähnlicher Produkte. Über den Datenpool von GS1 wird der Brick mitgeteilt; Segment, Family und Class dienen nur dazu, den passenden Brick zu finden, und Bricks lassen sich auch ohne die Hierarchie verwenden.

### Woran erkennt man Brick-, Attribut- und Wertcodes der GPC?

In der GPC beginnen Brick-Codes mit 1, Attribut-Codes mit 2 und Attributwert-Codes mit 3. Die GPC-Codes bleiben in jeder Sprache gleich; Titel und Definitionen gibt es in mehreren Sprachen.

### Kann ein Produkt mehrere Werte für ein GPC-Attribut haben?

Nein, ein Produkt hat je GPC-Attribut einen Wert und nicht mehrere, weil sich die Attributwerte eines Attributs gegenseitig ausschließen. Ein Wert, der nicht in der Liste des GPC-Attributs steht, ist kein GPC-Wert.

### Wie oft erscheint eine neue GPC-Version?

Die GPC wird zweimal im Jahr veröffentlicht; dabei können Bricks, Attribute und Werte hinzukommen oder sich ändern. Nach jeder Veröffentlichung gehen die GPC-Dateien an das Global Data Synchronisation Network (GDSN).

### Was hat die GPC mit dem GDSN zu tun?

Die GPC gehört zum Standardpaket von GS1 für das Global Data Synchronisation Network (GDSN), in dem Hersteller, Händler und Datenpools Produktdaten austauschen. Nach jeder GPC-Veröffentlichung gehen die Dateien an das GDSN.

### Was hat ein PIM-System mit der GPC zu tun?

Ein PIM-System hält die Produktdaten, zu denen der GPC-Brick und die Werte seiner Attribute gehören: Jedes Produkt braucht seinen Brick, und wer ein Produkt einem anderen Brick zuordnet, bekommt andere Attribute. In journali liest das Plugin GPC die Veröffentlichung von GS1 ein, weist den Brick am Knoten zu und legt je GPC-Attribut ein Listenattribut an; ein Export ins GDSN gehört nicht zum Plugin.

## Hinweis

Dieser Beitrag beschreibt die GPC nach den Veröffentlichungen von GS1 am 4. Oktober 2026. Er ersetzt nicht die Lektüre der GS1-Dokumente.

## Quellen

- GS1, Global Product Classification (GPC) Development & Implementation Guide – [gs1-germany.de](https://www.gs1-germany.de/fileadmin/gs1/fachpublikationen/GPC_Development_and_Implementation_Guide_8.0.pdf)
- GS1, How is GPC implemented and integrated into GDSN? – [support.gs1.org](https://support.gs1.org/support/solutions/articles/43000734200-how-is-gpc-implemented-and-integrated-into-gdsn-)
- GS1, GPC Browser – [gpc-browser.gs1.org](https://gpc-browser.gs1.org/)
