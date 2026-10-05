---
title: Übersetzungen, die nachziehen – jede Sprache geht ihren eigenen Weg
excerpt: journali weiß je Sprache, was übersetzt ist, was fehlt und was nach einer Änderung am Grundtext nachzuziehen ist – mit eigenem Workflow-Zustand je Sprache und XLIFF hin und zurück.
slug: uebersetzungen-die-nachziehen
tags: [Übersetzung, Mehrsprachigkeit, Workflow, XLIFF]
categories: [Entwicklung]
wp: 47
---
Der deutsche Text ist geprüft, der englische fertig, der französische liegt noch bei der Agentur – und gestern hat jemand die Beschreibung im Deutschen nachgeschärft. Was ist jetzt veraltet? Welche Sprache darf raus? **journali weiß es. Für jeden Wert, in jeder Sprache.**

## Jede Sprache hat ihren eigenen Zustand

Der eingebaute Workflow **Übersetzung** führt je Sprache einen eigenen Zustand: *nicht angefordert → zur Übersetzung → übersetzt → geprüft*. Französisch steht noch auf „zur Übersetzung“, während Englisch längst geprüft ist – am selben Produkt, zur selben Zeit.

Und das geht mit **jedem Workflow**: Ein Haken „🗣 je Sprache“ in den Workflow-Einstellungen, und auch die Redaktion läuft je Sprache. Französisch in Korrektur, Deutsch freigegeben. **Ein Schritt wirkt dann nur auf seine Sprache** – auch die Freigabe. Deutsch geht hinaus, Französisch wartet, niemand blockiert niemanden.

## Ändert sich der Grundtext, seht ihr es sofort

Jeder übersetzte Wert trägt eine **Marke**: gegen welche Version des Grundtexts er übersetzt ist – mit Fingerabdruck und Stand im Journal. Ändert sich die Mastersprache, stimmt der Fingerabdruck nicht mehr, und die Zelle zeigt **⟳ zu überarbeiten**.

Das Schöne daran: verglichen wird immer *Marke gegen jetzt*. **Zehnmal geändert ist ein Posten, nicht zehn.** Kein Stapel von Änderungen, kein doppelter Auftrag für denselben Satz.

## Alles im Blick: ⇄ Übersetzung

Das Plugin **Übersetzung (XLIFF)** zeigt je Zielsprache auf einen Blick:

- **○ fehlt** – noch gar kein Zieltext
- **⟳ veraltet** – übersetzt, aber gegen eine ältere Quelle
- **✓ fertig** – aktuell
- **📦 draussen** – steckt in einem Auftrag, der noch nicht zurück ist

Darunter die offenen Einheiten als Tabelle: Quelle links, Ziel rechts, **direkt eintragen und mit 💾 schreiben**. Ist derselbe Quelltext anderswo schon übersetzt, schlägt das **Gedächtnis** ihn vor; Begriffe aus dem **Wörterbuch** kommen gleich mit.

## XLIFF hin und zurück – auch wenn die Quelle weitergelaufen ist

Mit **📦 Paket schnüren** geht ein Auftrag hinaus: als **XLIFF 2.0** für die Agentur oder das CAT-Werkzeug. Der Auftrag steht im Journal und in der Datei – mit dem Fingerabdruck jedes Quelltexts, der hinausging. Zurück liest journali XLIFF 2.0 und 1.2.

Und dann kommt der Moment, an dem es sonst immer hakt: Die Übersetzung ist da, aber am Original hat sich inzwischen wieder etwas getan. journali entscheidet **je Wert am Fingerabdruck**:

1. **Quelle unverändert** – eingespielt, fertig.
2. **Quelle weitergezogen** – trotzdem eingespielt, denn die Übersetzung ist besser als die vorige. Der Wert bleibt als ⟳ offen, und **nur die Differenz geht ins nächste Paket**. Die zweite Runde ist klein.
3. **Ziel inzwischen von Hand geändert** – nicht überschrieben, sondern als **Konflikt** gemeldet.

Kein Auftrag wird weggeworfen, weil er „nicht mehr aktuell“ ist. So holt ihr den Rückstand ein, statt ihm hinterherzulaufen.

## Läuft von selbst

Aufträge schnürt ein **Job** – nach Zeitplan, wöchentlich oder jede Nacht. Die Datei landet im Fach `out/`, die Agentur legt die Antwort in `in/`, der Import liest sie zurück. Kommt dieselbe Datei zweimal, erkennt der Tasker das am Inhalt.

Oder ihr hängt die Wirkung `translate:<sprache>` an einen Übergang im Workflow: **Ein Klick auf den Schritt, und das Paket ist geschnürt.** Zwei Auslöser, ein Weg. Ist nichts offen, entsteht auch kein leerer Auftrag.

## Mit KI oder DeepL vorübersetzen

- **✦ KI vorübersetzen**: Die KI füllt leere Ziele – mit eurem Wörterbuch als verbindlichem Glossar. Das Ergebnis ist ein **Vorschlag** in der Tabelle; geschrieben wird erst mit 💾.
- **DeepL-Übersetzung** als Job: übersetzt die offenen Einheiten aus einem Profil und schreibt sie zurück. Der Schlüssel liegt **beim Server am Profil, nie im Journal**.

## Und jetzt?

journali ist noch in Entwicklung – Übersetzungen, die nachziehen, stecken schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
