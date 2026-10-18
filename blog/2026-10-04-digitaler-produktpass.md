---
title: Digitaler Produktpass – journali zeigt euch, was noch fehlt
excerpt: Das Plugin Digitaler Produktpass prüft eure Produkte gegen 39 Datenpunkte nach ESPR und Batteriepass, legt fehlende Attribute an und hilft beim Füllen – mit Regeln, mit KI und mit einem Beleg an jedem Wert.
slug: digitaler-produktpass
tags: [Compliance, Digitaler Produktpass, Datenqualität, KI]
categories: [Entwicklung]
wp: 40
description: Digitaler Produktpass in journali: 39 Datenpunkte nach ESPR und Batteriepass prüfen, fehlende Attribute anlegen und füllen – mit Beleg an jedem Wert.
keyphrase: Produktpass
---
Der Digitale Produktpass kommt – und mit ihm die Frage: **Haben wir die Daten dafür überhaupt?** journali beantwortet sie mit einem Klick. Das Plugin **Digitaler Produktpass** prüft einen ganzen Ast eures Produktbaums gegen die Datenpunkte des Passes und zeigt euch Knoten für Knoten, was da ist, was fehlt und was nicht stimmt.

## 39 Datenpunkte, sauber sortiert

Der Katalog folgt der Ökodesign-Verordnung **ESPR (EU) 2024/1781**, Art. 7/9 und Anhang III, dazu kommt der **Batteriepass nach (EU) 2023/1542** als eigene Gruppe. Das sind 39 Datenpunkte in sieben Gruppen: Identifikation, Wirtschaftsakteure, Konformität und Dokumente, Material und Stoffe, Umwelt und Leistung, Kreislauffähigkeit und Batteriepass.

Jeder Datenpunkt hat seinen Pflichtgrad – **● Pflicht** (15), **◐ empfohlen** (19), **○ optional** (5) – und einen Steckbrief hinter ⓘ: *was* gemeint ist, *wo* es steht, *ab wann* es gilt, *was passiert*, wenn es fehlt, und *woher* ihr den Wert bekommt.

## Euer Modell bleibt euer Modell

journali zwingt euch kein zweites Datenmodell auf. Das Plugin ordnet jeden Datenpunkt einem **vorhandenen Attribut** zu – über Schlüssel, Bezeichnung und Synonyme. Aus `ean` wird die GTIN, aus `hersteller` der Hersteller. Die Zuordnung steht im Journal, und ihr könnt sie jederzeit ändern.

Was es noch nicht gibt, legt journali **nach eurer Bestätigung** an: in einer eigenen Attributgruppe, mit Typ, Einheit und Ebene – und wo es passt **je Sprache** oder **vererbbar**. Die Anschrift des Herstellers tragt ihr einmal an der Gruppe ein, und alle Produkte darunter haben sie.

## Ein Klick, ein Teilbaum, ein klares Bild

Direkt am Knoten: **◈ DPP prüfen**. Die Ansicht unter ✓ Datenanalyse öffnet sich und prüft sofort.

- Eine **Matrix je Knoten und Datenpunkt**: ✓ erfüllt, · leer, ✗ fraglich, ⏳ angefragt.
- Je Knoten der **Anteil erfüllter Pflicht-Datenpunkte** in Prozent, oben der Schnitt über den ganzen Teilbaum.
- **Geerbte Werte zählen mit.** Und haben alle Varianten unter einem Produkt den Wert, gilt er auch am Produkt als erfüllt (↓).
- **13 Datenpunkte prüfen den Wert selbst**: GTIN samt Prüfziffer, ISO-Ländercode, Prozent von 0 bis 100, Energieeffizienzklasse A–G, Links auf Konformitätserklärung und Anleitung.

Ein Klick auf die Zahl der leeren Werte, und ihr bekommt die Liste aller betroffenen Knoten: Wert eintragen, Enter, nächster.

## Weiß noch niemand? Dann wird angefragt.

Nicht jeder Wert liegt im Haus. Mit **⏳** merkt ihr euch, bei wem ihr angefragt habt – Lieferant, Abteilung, Person – und bis wann. Der Datenpunkt steht dann nicht mehr rot da, sondern als angefragt, und **nach der Wiedervorlage als überfällig**.

## Vorschläge – mit Regel, mit KI, mit Quelle

- **⚙ Regelbasiert**: Die Modellbezeichnung kommt aus der SKU, der Handelsname aus dem Namen im Baum.
- **✦ Mit KI**: Mit dem KI-Schlüssel eures Teams schlägt die KI aus den vorhandenen Werten eines Produkts Werte für die leeren Datenpunkte vor – mit Sicherheit und Begründung.
- **⌕ Recherche im Internet**: Für Handelsware sucht die KI nach Hersteller, Typ und EAN – jeder Vorschlag nennt seine Quelle.

Und das Beste: **Nichts wird ohne euren Klick geschrieben.** Vorschläge ab 70 % Sicherheit sind vorangehakt, jeder Wert lässt sich vorher ändern. Übernommen wird als ein Stapel ins Journal – und an jedem Wert hängt der **Beleg: Quelle, Weg und Prüfdatum**.

## Batteriepass nur dort, wo er gilt

Der Batteriepass gilt nicht für jedes Produkt. journali schlägt die Geltung vor – anhand der **ETIM-Klasse** (Batterie, Akku, Powerbank) und, mit Schlüssel, zusätzlich mit der KI. Ihr entscheidet, **ab welchem Knoten** sie gilt; darunter wird sie vererbt. Ein „nein“ merkt sich journali, die Frage kommt nicht wieder.

## Klar gesagt: keine Rechtsberatung

Die genauen Datenpunkte je Produktgruppe legen delegierte Rechtsakte fest; der Katalog bildet die allgemeine ESPR-Ebene ab. Darum steht in jeder Prüfansicht oben: **Datenpunkte, Fristen und Vorschläge sind Hinweise – maßgeblich ist der Rechtstext**, verlinkt direkt daneben. Ihr wisst so jederzeit, worauf ihr euch stützt.

## Und jetzt?

journali ist noch in Entwicklung – der Digitale Produktpass steckt schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
