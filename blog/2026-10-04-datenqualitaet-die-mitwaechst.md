---
title: Datenqualität, die mitwächst – jede Regel gilt für jeden neuen Knoten und für den Bestand
excerpt: In journali stehen die Regeln im Modell – Pflicht je Kanal und Sprache, Muster, Zahlen, Listen, eindeutige Kennungen. Wächst das Modell, wächst die Prüfung mit, auch für die Daten, die schon da sind.
slug: datenqualitaet-die-mitwaechst
tags: [Datenqualität, Freigabe, Modell]
categories: [Entwicklung]
wp: 72
---
Gute Produktdaten entstehen nicht an einem großen Aufräumtag. Sie entstehen, wenn jede Regel dort steht, wo sie gilt – und **für jeden Knoten gilt, der dazukommt**. Genau so arbeitet journali: Die Regeln stehen im Modell, und das Modell wächst mit euren Daten.

## Die Regel steht am Attribut

Wer ein Attribut anlegt, legt gleich fest, was es braucht:

- **Pflicht je Kanal und Sprache** – zum Beispiel Deutsch und Englisch für den Shop, nur Deutsch für den Druck.
- **Muster** als regulärer Ausdruck, samt Hinweis, der in der Meldung steht.
- **Typ**: ganze Zahl, Dezimalzahl mit Einheit, Datum, Ja/Nein, Liste.
- **Eindeutig** für Kennungen wie SKU oder EAN.

Über seine Attributgruppe gilt das Attribut an jedem Knoten, an dem die Gruppe gilt. Neue Produktgruppe, tausend neue Produkte? **Die Regeln gelten dort sofort** – ohne dass jemand sie ein zweites Mal einrichtet.

## Falsches kommt nicht hinein

journali prüft jeden Wert beim Speichern: Eine Zahl ist eine Zahl, ein Datum ein Datum, ein Listenwert steht in der Werteliste, ein Text passt zum Muster. Eingaben wie 1.234,56 oder 31.12.2026 versteht journali und speichert sie sauber.

Und **eindeutig heißt eindeutig**: Eine SKU oder EAN, die es schon gibt, lehnt journali ab und nennt den Knoten, der sie hat. Wer einen Knoten dupliziert, bekommt eine Kopie ohne eindeutige Kennungen.

## Das Modell ändert sich – die Prüfung zieht nach

Hier wächst die Datenqualität mit. Ändert ihr ein Attribut, für das schon Werte gepflegt sind – Typ, Werteliste, Muster, Sprach- oder Kanalachse –, prüft journali **den ganzen Bestand gegen die neue Definition**. Passt etwas nicht, nennt journali die Zahl und Beispiele, bevor sich irgendetwas ändert.

Schaltet ihr „eindeutig“ ein und es gibt schon Doppelte, lehnt journali die Änderung ab und nennt Beispiele. **Ein Merkmal, das im Modell steht, stimmt auch im Bestand.**

## ✓ Datenqualität: ganze Teilbäume auf einmal

Unter Datenanalyse wählt ihr einen Teilbaum und klickt ▶ prüfen. journali liest alle Knoten darunter **in jeder Sprache** und prüft sie gegen die eingebauten Regeln:

- Pflichtattribut fehlt
- Muster verletzt, Zahl nicht lesbar, Wert nicht in der Liste
- Leerzeichen am Rand oder doppelt, HTML ohne Inhalt
- SKU fehlt oder ist doppelt vergeben
- Übersetzung fehlt oder ist gleich wie in der Mastersprache
- Formel oder Vorlage ohne Ergebnis
- aktive Variante, der noch Pflichtwerte fehlen

Die Befunde stehen als Liste mit Schwere (✗ ⚠ ℹ), Knoten, SKU, Sprache, Attribut und Meldung. **Ein Klick springt zum Knoten**, ⇪ CSV nimmt die Liste mit. Welche Regeln ihr gewählt habt, merkt sich journali. Und vom Knoten aus geht es direkt: Datenqualität des Teilbaums prüfen, ein Klick im Kontextmenü.

## Plugins bringen ihre Regeln mit

Die Regelliste ist offen. **Plugins tragen eigene Regeln bei**, die in derselben Liste stehen – je Plugin als eigene Gruppe, als Ganzes oder einzeln wählbar. GEO-Texte prüft, ob Beschreibungen für Suchmaschinen und KI-Antworten taugen, EmpCo prüft Werbeaussagen, ETIM prüft Klasse und Merkmale. Digitaler Produktpass und Verpackung (PPWR) haben eigene Prüfansichten in der Datenanalyse. Zu allen gibt es eigene Beiträge.

Mit einem KI-Schlüssel kommt die **✦ KI-Analyse** dazu: Die KI bewertet die gewählten Regelgruppen am gewählten Knoten – erfüllt, auffällig oder unklar, mit Begründung und Vorschlag. Sie kennt dabei nur die Daten des Knotens und die Befunde der Prüfung.

## Ohne Vollständigkeit keine Freigabe

Am Knoten zeigt ✓ Freigaben für jeden Kanal und jede Sprache, wie weit ihr seid – etwa **7/9**, grün, sobald alles da ist; der Tooltip nennt, was fehlt. Vererbte Werte zählen, wenn das Attribut vererbbar ist. Ein Wert, der nur aus der Mastersprache kommt, zählt nicht als Übersetzung.

Und dann gilt: **Freigabe setzt Vollständigkeit voraus.** Fehlt ein Pflichtwert, lehnt der Server die Freigabe ab und nennt jeden fehlenden Wert. Keine Warnung zum Wegklicken – eine Sperre. Scheitert ein Workflow-Schritt daran, zeigt die Variante sofort nur noch die Attribute, die fehlen. Und die Suche im Baum findet mit `incomplete:web` jeden Knoten, der für einen Kanal noch nicht so weit ist.

## Und jetzt?

journali ist noch in Entwicklung – die Datenqualität steckt schon drin und wächst mit jedem Plugin, das Regeln mitbringt. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
