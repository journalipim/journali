---
title: Workflows – wer wann was freigibt, steht im Journal
excerpt: In journali hat jeder Knoten einen Zustand, jeder Schritt eine Rolle, die ihn gehen darf, und eine Wirkung – und die Aufgabenliste füllt sich von selbst, ohne dass jemand eine Tabelle pflegt.
slug: workflows
tags: [Workflow, Datenpflege, Datenqualität, Mehrsprachigkeit, Betrieb]
categories: [Entwicklung]
date: 2026-10-22 06:00
wp: 157
description: In journali hat jeder Knoten einen Zustand, jeder Schritt eine Rolle, die ihn gehen darf – und die Aufgabenliste füllt sich von selbst.
---
Eine Redakteurin schreibt die Texte zu einer neuen Bohrmaschine fertig und schickt das Produkt zur Prüfung. Die Prüfung findet ein fehlendes Bild und schickt es zurück, mit Begründung. Danach gibt eine Person mit dem Recht dazu das Produkt frei. Später fragt jemand: Wer hat das freigegeben, und wann? In vielen Systemen steht die Antwort in einer Tabelle, die jemand nebenbei pflegt, oder in einer Mail. **In journali steht sie am Produkt.** Jeder Schritt ist ein Eintrag im Journal – mit Anwender, Zeit und Notiz.

## Zustände und Übergänge, die ihr selbst zeichnet

Ein Workflow ist der Bearbeitungszustand über euren Daten: **Zustände**, **Übergänge** zwischen ihnen und alles, was an einem Übergang hängt. Ihr gestaltet ihn unter ⚙ Einstellungen → ⚑ Workflows. Zustände sind Kacheln, Übergänge sind Pfeile. Ihr verschiebt eine Kachel, zieht vom Rand zu einer anderen Kachel und habt einen Übergang. Doppelklick benennt um.

Wie alles in journali steht auch der Workflow im Journal, nicht im Code. Zwei Workflows bringt journali mit:

- **Redaktion**: Entwurf → Prüfung → Freigegeben, mit einer Korrekturschleife zurück.
- **Übersetzung**: nicht angefordert → zur Übersetzung → übersetzt → geprüft.

Beide könnt ihr ändern oder durch eigene ersetzen. Ein Workflow gilt für die Knotentypen, die ihr ankreuzt: Gruppe, Produkt, Variante und auf Wunsch auch Asset.

## Wer einen Schritt gehen darf

An jedem Übergang legt ihr fest, **welche Rollen** ihn gehen dürfen. Im mitgelieferten Redaktions-Workflow darf zum Beispiel nur ein Administrator freigeben. Lasst ihr die Rollen leer, darf jede Rolle mit Schreibrecht den Schritt gehen.

Dazu kommt die **Notiz-Pflicht**: Die Korrekturschleife verlangt eine Begründung. „Zurück zur Korrektur“ ohne Grund gibt es nicht, und die Begründung steht danach am Knoten.

Und wenn niemand da ist? Mit der **Eskalation** gebt ihr einem Übergang eine Frist: Steht ein Knoten nach n Tagen noch im selben Zustand, dürfen auch andere Rollen den Schritt gehen. Am Knoten steht ⏰ mit dem Datum, ab dem das gilt. Ein Timer läuft dafür nicht: journali vergleicht beim Lesen.

## Ein Schritt tut etwas

Ein Übergang kann **Wirkungen** auslösen:

- **Freigabe erteilen oder zurücknehmen**, für einen Kanal oder für alle,
- **einen Status setzen**,
- **ein Übersetzungspaket aus dem offenen Rückstand erzeugen**,
- **einen Job aus dem Tasker starten**, etwa einen Export.

So ist „freigeben“ kein eigener Knopf, sondern ein Schritt im Workflow, der die Freigabe für den Kanal Web schreibt.

## Ohne Vollständigkeit keine Freigabe

Eine Freigabe kann scheitern, und journali sagt das **vorher**. Fehlt einer Variante ein Pflichtwert, ist der Schritt am Knoten mit ⊘ markiert, und der Tooltip nennt, woran es liegt: welche Werte in welcher Sprache fehlen. Beim Freigeben am Produkt oder an der Gruppe gibt journali alle vollständigen Varianten darunter frei. Varianten, die in ihrem eigenen Workflow noch in Entwurf, Prüfung oder Korrektur stehen, lässt es aus und nennt sie.

## Jede Sprache geht ihren eigenen Weg

Mit einem Haken „🗣 je Sprache“ führt ein Workflow für **jede Sprache einen eigenen Zustand**. Französisch steht in der Korrektur, Deutsch ist freigegeben – am selben Produkt, zur selben Zeit. Ein Schritt wirkt nur auf seine Sprache, auch die Freigabe: Deutsch geht hinaus, Französisch wartet. Am Knoten steht eine Zeile je Sprache mit eigenen Schritten.

Das gilt für den eingebauten Übersetzungs-Workflow und für jeden eigenen, auch für die Redaktion.

## ⚑ Aufgaben: alles, was auf euch wartet

Niemand muss nachsehen, wo etwas hängt. Die Ansicht **⚑ Aufgaben** listet alle Knoten, die auf einen Schritt eurer Rolle warten: mit Workflow, Zustand, seit wann und wer zuständig ist. Die älteste Aufgabe steht oben. Ihr filtert nach Workflow und Zustand, geht mit einem Klick zum Knoten oder **geht den Schritt gleich aus der Zeile**. Verlangt er eine Notiz, fragt journali danach.

Die Liste ist keine zweite Datenhaltung. Sie ergibt sich aus Zuständen und Rollen im Journal – ändert sich eines, ändert sich die Liste. Wollt ihr einen Schritt einer bestimmten Person geben, **weist ihr ihn zu**. Die Liste zeigt jedem, was ihm zugewiesen oder noch niemandem zugewiesen ist; der nächste Schritt am Knoten löst die Zuständigkeit wieder.

Mehrere Knoten auf einmal? Im Baum wählt ihr sie aus. Das Kontextmenü zeigt unter ⚑ Workflow die Schritte, die für die Auswahl passen.

## Der Verlauf schreibt sich selbst

Der Zustand gilt am Knoten und **vererbt sich nach unten**, bis ein Knoten einen eigenen bekommt. Mit ↑ Erben nehmt ihr einen eigenen Zustand wieder weg. Am Knoten seht ihr den Zustand, die Schritte, die ihr gehen dürft, den Zuständigen und den Verlauf: jeder Schritt mit Anwender, Zeit und Notiz, gelesen aus dem Journal des Knotens. Wer mit der Suche arbeitet, findet mit `wf:` alle Knoten in einem Zustand.

## Status auch an Gruppen

Daneben gibt es den **Status** – Entwurf, aktiv, ausgelaufen und was ihr im Modell sonst anlegt. Er beschreibt den Lebenszyklus eines Dings am Markt. Auch eine **Gruppe** kann einen Status haben, zum Beispiel für eine neue Produktgruppe: Redaktionell ist alles freigegeben und vorbereitet, aber der Verkaufsstart kommt später.

Der Status gehört dem Knoten, an dem er steht. Er vererbt sich nicht und überschreibt nichts: Die Gruppe sagt etwas über sich, jedes Produkt über sich. Wer Freigaben steuern will, nimmt den Workflow.

Eine Gruppe, für die niemand einen Status gesetzt hat, zeigt „–“ und behauptet nichts. Beim Setzen fragt journali, wenn der Knoten Subitems hat: **„auch für die n Subitems“**, standardmäßig aus. Gesetzt wird nur, wo der Status noch fehlt, bei mehreren Knoten als Stapel. Den Status könnt ihr auch **ab einem Datum** setzen.

## Auch für Assets

Ein Workflow kann auch für **Assets** gelten, wenn ihr das ausdrücklich ankreuzt. Dann hat ein Bild einen Zustand wie ein Produkt, und die Bibliothek zeigt die Zustände als Filter. Die Wirkungen Freigabe, Status und Übersetzungspaket gibt es dort nicht.

## Und jetzt?

journali ist noch in Entwicklung – Workflows stecken schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
