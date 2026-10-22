---
title: Journali KI Produktberater – wie Besucher, Shop-Kunden und journali zusammenhängen
excerpt: Wer fragt, was der Berater sich merkt und was nie ins Journal kommt: Gäste bleiben anonym, angemeldete Kunden weisen sich mit einem vom Shop signierten Nachweis aus.
slug: produktberater-besucher-und-kunden
tags: [KI, MCP, Integration, Architektur, Betrieb]
categories: [Entwicklung]
date: 2026-10-29 06:00
wp: 235
description: Besucher, Shop-Kunden und der Produktberater: Gäste bleiben anonym, angemeldete Kunden bringen einen signierten Nachweis mit. Nichts kommt ins Journal.
keyphrase: Shop-Kunden
---
Ein Besucher fragt nach einem Zelt. Ein angemeldeter Kunde fragt nach demselben Zelt und will seinen Preis sehen. **Für den [Journali KI Produktberater](/?p=233) sind das zwei verschiedene Lagen – und in beiden gilt: Kein Passwort geht durch den Chat, und nichts über eure Besucher kommt ins Journal.** Hier steht, wie die Teile zusammenhängen, was gebaut ist und was noch folgt.

## Die Teile im Überblick

| Teil | Aufgabe |
|---|---|
| Chat-Fenster | zeigt das Gespräch auf eurer Website, ein Script-Tag |
| Dienst (journali-advisor) | der einzige Teil, den die Website erreicht; spricht nur mit journali |
| journali | entscheidet, was gezeigt werden darf, und wählt aus; prüft den Nachweis eines Kunden |
| Shop | meldet seine Kunden an und stellt ihnen den Nachweis aus – journali kennt die Kunden nicht und braucht sie nicht zu kennen |

Wie Dienst, Fenster und MCP-Server gebaut sind, steht in [journali-advisor – wie der Journali KI Produktberater gebaut ist](/?p=234).

## Gäste: anonym – gebaut

Ohne Nachweis zeigt der Berater jedem Besucher dasselbe: die Produkte des Publikationsbaums mit den Attributen der Sicht, so weit die Rolle des Beraters sie sieht. **Am MCP-Endpunkt gibt es keine Anmeldung.** Was der Berater zeigt, ist öffentlich – das bestätigt ihr vor dem Einschalten.

Das Fenster speichert nichts: **kein Cookie, kein Speicher im Browser** – nach dem Neuladen beginnt das Gespräch von vorn, auch der Merkzettel ist dann leer. Das Gespräch selbst merkt sich der Dienst (nächster Abschnitt).

Der Dienst zählt je Besucheradresse die Fragen für Minute und Tag, im Arbeitsspeicher, und verwirft die Zahlen danach. Den Inhalt einer Frage protokolliert er nicht.

## Ein Gedächtnis im Dienst – gebaut

Der Berater merkt sich ein Gespräch, auch über einen Themenwechsel hinaus:

1. Das Fenster erzeugt beim Laden der Seite eine **zufällige Kennung des Gesprächs** und schickt sie mit jeder Frage mit. Sie trägt keine Person.
2. Der Dienst hält dazu **nur im Arbeitsspeicher** fest: die Angaben (gesagt oder geklickt), Vorlieben wie Farbe, Größe oder Budget, gesehene und abgelehnte Produkte, das Produkt im Blick und den Verlauf.
3. **30 Minuten nach der letzten Frage ist alles weg.** Nichts davon liegt auf einem Datenträger.

Was das bringt: Wechselt ein Besucher vom Zelt zum Schlafsack, übernimmt der Berater die Vorlieben, die es beim Schlafsack auch gibt, und sagt es – etwa „Größe M habe ich übernommen.“. Ein abgelehntes Produkt kommt nicht wieder nach vorn. Ein KI-Agent über MCP schickt keine Kennung; für ihn steht jede Frage für sich.

**Offen** ist noch, ob die Kennung ein Neuladen der Seite übersteht – das wäre ein Speicher im Browser, und den gibt es heute bewusst nicht.

## Angemeldete Shop-Kunden: ein signierter Nachweis – gebaut

Für einen Kundenpreis zählt, wer fragt. Der Kunde ist in eurem Shop angemeldet, nicht in journali. Darum geht der Weg über einen Nachweis:

1. **Der Shop stellt einen Nachweis aus.** Ist ein Kunde angemeldet, signiert der Shop mit seinem privaten Schlüssel ein kurzlebiges JWT (ES256 oder RS256): `sub` ist die Kundennummer, `aud` der Schlüssel des Beraters, `exp` höchstens 15 Minuten ab jetzt; wahlweise kommen `iss` (der Aussteller) und `nbf` dazu.
2. **Das Fenster reicht ihn weiter.** Es bekommt den Nachweis beim Einbinden (`data-customer`) oder später über `journaliAdvisor.kunde(nachweis)`, auch zum Erneuern vor dem Ablauf, und schickt ihn mit jeder Frage im Kopf `X-Advisor-Customer` mit.
3. **Der Dienst reicht ihn unverändert durch** – neben seinem Token, nie anstelle davon.
4. **journali prüft ihn** bei jeder Anfrage: die Signatur mit dem öffentlichen Schlüssel des Shops am Berater, dazu Empfänger, Ablauf und, wenn dort einer steht, den Aussteller.
5. **Gilt er, liest der Berater mit der Sicht für Kunden** – etwa mit einem anderen Preisfeld als die Sicht für Gäste.

**Ein Passwort oder Schlüssel des Kunden geht nie durch den Chat.** Das Fenster sieht nur einen Nachweis, der nach wenigen Minuten abläuft und nur für diesen Berater gilt. Gespeichert wird er nirgends.

## Was ohne Nachweis passiert

Fehlt der Nachweis, ist er abgelaufen, gefälscht oder für einen anderen Berater ausgestellt, antwortet der Berater wie einem Gast – mit allem, was er für Gäste zeigt: Treffer, Rückfragen, Vergleich und Unterlagen.

## Was noch folgt

Gebaut ist die andere Sicht für angemeldete Kunden. **Noch nicht gebaut** ist, dass journali mit dem Nachweis Kundenpreise beim Shop anfragt und danach filtert und ordnet, und dass es den Nachweis an eine fremde Quelle weitergibt. Beides hängt daran, wie ein konkreter Shop seine Kunden anmeldet und seine Preise anbietet.

Fremde Quellen für die KI des Beraters, etwa eine Warenwirtschaft mit MCP-Server, bindet journali schon an: als Zugang, mit angekreuzten Werkzeugen am Berater. Sie liefern heute Angaben für alle Besucher gleich, ohne Kundenbezug.

## Was nie ins Journal kommt

Im Journal lässt sich nichts löschen. Darum gehört dorthin nur, was Produktdaten und Einrichtung sind – die Definition des Beraters und der Verbrauch der KI. **Nie im Journal stehen:**

- das Gespräch eines Besuchers, seine Vorlieben und was er gesehen oder abgelehnt hat,
- der Nachweis des Kunden und die Kundennummer – der Nachweis wird nirgends gespeichert,
- die Zählung je Besucheradresse,
- was der Berater aus dem Verkehr der Website lernt: Wörter ohne Treffer, gelesene Tippfehler, Wörter vor dem Öffnen oder Merken eines Produkts. Das zählt er ohne Gespräch und ohne Kennung, wahlweise in einer Datei im Container des Dienstes, und macht daraus Vorschläge, die ein Mensch in journali übernimmt.

## Wer was hält

| journali | Dienst (journali-advisor) |
|---|---|
| was gezeigt werden darf: Baum, Rolle, Sicht, Freigaben, gültige Medien | das Gespräch: Angaben, Vorlieben, Gesehenes, Abgelehntes |
| Suche, Merkmale, Unterlagen, Vektoren | Rückfragen und Antwort in der Sprache des Besuchers |
| KI über den Schlüssel des Teams, mit Grenzen | reicht den Nachweis nur durch |
| fremde MCP-Werkzeuge: Zugang, Geheimnis, Freigabe; Prüfung des Nachweises | |

Die Aufteilung ist gebaut: die Auswahl in journali, das Verstehen im Plugin, das Gedächtnis im Dienst, der Nachweis geprüft in journali.

## Und jetzt?

journali ist noch in Entwicklung – der Journali KI Produktberater läuft schon, auch für angemeldete Kunden. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
