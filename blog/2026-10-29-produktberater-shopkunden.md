---
title: Journali KI Produktberater – wie Besucher, Shop-Kunden und journali zusammenhängen
excerpt: Wer fragt, was der Berater sich merkt und was nie ins Journal kommt: heute anonym und ohne Speicher, als Nächstes mit einem Gedächtnis im Dienst und einem signierten Nachweis vom Shop für angemeldete Kunden.
slug: produktberater-besucher-und-kunden
tags: [KI, MCP, Integration, Architektur, Betrieb]
categories: [Entwicklung]
date: 2026-10-29 06:00
wp: 235
---
Ein Besucher fragt nach einem Zelt. Ein angemeldeter Kunde fragt nach demselben Zelt und will seinen Preis sehen. **Für den [Journali KI Produktberater](/?p=233) sind das zwei verschiedene Lagen – und in beiden gilt: Kein Passwort geht durch den Chat, und nichts über eure Besucher kommt ins Journal.** Hier steht, wie die Teile zusammenhängen, was heute gebaut ist und was als Konzept entschieden ist.

## Die Teile im Überblick

| Teil | Aufgabe |
|---|---|
| Chat-Fenster | zeigt das Gespräch auf eurer Website, ein Script-Tag |
| Dienst (journali-advisor) | der einzige Teil, den die Website erreicht; spricht nur mit journali |
| journali | entscheidet, was gezeigt werden darf, und wählt aus |
| Shop | meldet seine Kunden an – journali kennt sie nicht und braucht sie nicht zu kennen |

Wie Dienst, Fenster und MCP-Server gebaut sind, steht in [journali-advisor – wie der Journali KI Produktberater gebaut ist](/?p=234).

## Heute: jeder Besucher ist anonym – gebaut

Der Berater zeigt jedem Besucher dasselbe: die Produkte des Publikationsbaums mit den Attributen der Sicht, so weit die Rolle des Beraters sie sieht. **Eine Anmeldung gibt es nicht, weder im Fenster noch am MCP-Endpunkt.** Was der Berater zeigt, ist öffentlich – das bestätigt ihr vor dem Einschalten.

Das Gespräch hält heute das **Fenster selbst**, im Arbeitsspeicher der Seite: die gesammelten Wörter und Filter, die letzten sechs Eingaben und das Produkt im Blick. Es schickt sie mit jeder Frage mit. Server und Dienst merken sich nichts davon. **Kein Cookie, kein Speicher im Browser** – nach dem Neuladen beginnt das Gespräch von vorn, auch der Merkzettel ist dann leer.

Der Dienst zählt je Besucheradresse die Fragen für Minute und Tag, im Arbeitsspeicher, und verwirft die Zahlen danach. Den Inhalt einer Frage protokolliert er nicht.

## Als Nächstes: ein Gedächtnis im Dienst – Konzept

Entschieden und **noch nicht gebaut** ist ein Gedächtnis für ein Gespräch, das über einen Themenwechsel hinaus gilt:

1. Das Fenster erzeugt beim Laden der Seite eine **zufällige Kennung des Gesprächs** und schickt sie mit jeder Frage mit. Sie trägt keine Person.
2. Der Dienst hält dazu **nur im Arbeitsspeicher** fest: die Angaben (gesagt oder geklickt), Vorlieben wie Farbe, Größe oder Budget, gesehene und abgelehnte Produkte, das Produkt im Blick und den Verlauf.
3. **30 Minuten nach der letzten Frage ist alles weg.** Nichts davon liegt auf einem Datenträger.

Was das bringt: Wechselt ein Besucher vom Zelt zum Schlafsack, übernimmt der Berater die Vorlieben, die es beim Schlafsack auch gibt, und sagt es – etwa „Größe M habe ich übernommen.“. Ein abgelehntes Produkt kommt nicht wieder nach vorn. Ein KI-Agent über MCP schickt keine Kennung; für ihn steht jede Frage für sich.

**Offen** ist noch, ob die Kennung ein Neuladen der Seite übersteht – das wäre ein Speicher im Browser, und den gibt es heute bewusst nicht.

## Angemeldete Shop-Kunden: ein signierter Nachweis – Konzept

Für Kundenpreise, Kundengruppen oder einen Bestellstatus muss feststehen, wer fragt. Der Kunde ist in eurem Shop angemeldet, nicht in journali. **Entschieden ist der Weg, gebaut ist er noch nicht:**

1. **Der Shop stellt einen Nachweis aus.** Ist ein Kunde angemeldet, signiert der Shop mit seinem privaten Schlüssel ein kurzlebiges JWT (ES256 oder RS256): `iss` der Shop, `aud` der Berater, `sub` die Kundennummer, auf Wunsch `grp` für Kundengruppe oder Preisliste, `exp` höchstens 15 Minuten.
2. **Das Fenster reicht ihn weiter.** Es bekommt den Nachweis beim Einbinden (`data-customer`) oder später über `journaliAdvisor.kunde(nachweis)`, auch zum Erneuern, und schickt ihn mit jeder Frage mit.
3. **Der Dienst reicht ihn unverändert durch** – in einem eigenen Kopf `X-Advisor-Customer`, neben seinem Token, nie anstelle davon. Er prüft ihn nicht und merkt ihn sich nicht.
4. **journali prüft ihn** bei jeder Anfrage: Signatur mit dem öffentlichen Schlüssel oder der JWKS-Adresse des Shops am Berater, dazu Aussteller, Empfänger und Ablauf.
5. **Gegenüber dem MCP-Server des Shops** reicht journali den Nachweis weiter oder tauscht ihn dort gegen ein Token des Shops (OAuth Token Exchange) – je nachdem, was der Shop anbietet.

**Ein Passwort oder Schlüssel des Kunden geht nie durch den Chat.** Das Fenster sieht nur einen Nachweis, der nach wenigen Minuten abläuft und nur für diesen Berater gilt.

## Was ohne Nachweis passiert

Fehlt der Nachweis, ist er abgelaufen oder stimmt die Signatur nicht, ist der Besucher **anonym** – mit allem, was ein Berater heute schon zeigt:

- Treffer, Rückfragen, Vergleich und Unterlagen wie bisher,
- kommen Preise aus dem Shop, die **Preise für Anonyme**, also Listenpreise,
- **keine kundenspezifischen Werkzeuge**: journali bietet sie der KI gar nicht erst an.

Mit gültigem Nachweis fragt journali die Preise des Kunden beim Shop an – für die Kandidaten der Auswahl in einem Aufruf – und **filtert und ordnet danach**. Ein Preisfilter wirkt so auch auf Preise, die nicht im PIM stehen. Auch das ist entschieden und kommt mit dem ersten konkreten Shop.

## Was nie ins Journal kommt

Im Journal lässt sich nichts löschen. Darum gehört dorthin nur, was Produktdaten und Einrichtung sind – die Definition des Beraters und der Verbrauch der KI. **Nie im Journal stehen:**

- das Gespräch eines Besuchers, seine Vorlieben und was er gesehen oder abgelehnt hat,
- der Nachweis des Kunden und die Kundennummer – das Protokoll nennt höchstens, dass ein Nachweis galt,
- die Zählung je Besucheradresse,
- was der Berater später aus dem Verkehr der Website lernt: Wörter ohne Treffer, angenommene Tippfehler. Das zählt er ohne Gespräch und ohne Kennung, im Container des Dienstes, und macht daraus Vorschläge, die ein Mensch in journali übernimmt.

## Wer was hält

| journali | Dienst (journali-advisor) |
|---|---|
| was gezeigt werden darf: Baum, Rolle, Sicht, Freigaben, gültige Medien | das Gespräch: Angaben, Vorlieben, Gesehenes, Abgelehntes |
| Suche, Merkmale, Unterlagen, Vektoren | Rückfragen und Antwort in der Sprache des Besuchers |
| KI über den Schlüssel des Teams, mit Grenzen | wann KI, wann ein Werkzeug gefragt wird |
| fremde MCP-Werkzeuge: Zugang, Geheimnis, Freigabeliste, Prüfung des Nachweises | reicht den Nachweis nur durch |

Heute liegt das Verstehen noch im journali-Server und das Gespräch im Fenster. Die Aufteilung in der Tabelle ist entschieden; gebaut wird sie Schritt für Schritt – zuerst die Auswahl in journali, dann das Verstehen im Plugin, dann das Gedächtnis. **Nachweis, Kundenpreise und fremde MCP-Quellen kommen zuletzt, mit einem konkreten Shop**, denn sie hängen daran, wie der Shop seine Kunden anmeldet.

## Und jetzt?

journali ist noch in Entwicklung – der Journali KI Produktberater läuft schon, für angemeldete Kunden ist der Weg entschieden. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
