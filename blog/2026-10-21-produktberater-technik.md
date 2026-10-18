---
title: journali-advisor – wie der Journali KI Produktberater gebaut ist
excerpt: Ein eigener Dienst im Container, ein Chat-Fenster als ein Script-Tag, ein MCP-Server für KI-Agenten – der Berater versteht, journali entscheidet, was er zeigt. Dazu, was als Nächstes kommt: weitere Quellen über MCP.
slug: produktberater-technik
tags: [KI, MCP, RAG, Architektur, Integration, Betrieb]
categories: [Entwicklung]
date: 2026-10-21 06:00
wp: 234
description: journali-advisor: ein eigener Dienst im Container, das Chat-Fenster als ein Script-Tag, ein MCP-Server für KI-Agenten – so ist der Produktberater gebaut.
keyphrase: journali-advisor
---
Der [Journali KI Produktberater](/?p=233) beantwortet Fragen von Besuchern eurer Website zu euren Produkten. Technisch heißt er **journali-advisor**: ein Plugin mit dem Schlüssel `advisor`, ein Teil im journali-Server und ein Dienst an eurer Website. **Hier steht, wie die Teile zusammenspielen, was gebaut ist und was als Nächstes kommt.**

## Zwei Teile: journali innen, der Dienst außen

**Eure Besucher erreichen nie den journali-Server.** Zwischen Website und PIM steht ein eigener Dienst:

- **Im Server** stehen die Definition des Beraters (im Journal, als Daten des Plugins), der Bestand je Berater und Sprache und die Fragen unter `/api/advisor/{key}/…`: Vokabular, Auswahl, Unterlagen, KI, dazu Info, Produkt, Variante, Vergleich, Bild und Dokument.
- **Der Dienst** (`serve.mjs`) läuft in einem **eigenen Container** aus `node:22-alpine` mit dem Verzeichnis des Plugins, nur lesend eingebunden – kein eigenes Image, keine npm-Pakete. Er braucht nur HTTP zu journali, keine Datenbank, keinen Medienspeicher, und die Verbindung zu journali baut immer er auf. In ihm läuft der **Kern** des Beraters: Er versteht die Eingaben und führt das Gespräch.

Der Reverse Proxy gibt nur den Port des Dienstes nach außen, etwa als `https://advisor.example.com`. Der journali-Server bleibt im internen Netz.

## Ein Token, das nur für einen Berater gilt

Ein Berater hat keine Person, die fragt. Darum bekommt sein Dienst ein **eigenes Token**, das in journali als Hash im Tresor liegt und nur beim Ausgeben sichtbar ist. Es liest mit der Rolle des Beraters und erreicht **nur dessen Fragen** – nicht den Baum, nicht die Definition, nicht die Token, keinen anderen Berater, auch nichts, was die Rolle sonst lesen dürfte. Wird es widerrufen, antwortet journali dem Dienst mit 401, und der Dienst sagt seinen Besuchern, dass journali nicht erreichbar ist.

## Was journali auswählt: Baum, Rolle, Sicht

Was ein Berater zeigt, entscheidet journali mit drei Angaben an der Definition:

- der **Publikationsbaum** – welche Produkte, mit den Varianten, die er für seinen Kanal ausleitet,
- die **Rolle** – eingeschränkte Knoten und Ordner von Medien fallen weg,
- die **Sicht** – welche Attribute am Produkt, in Merkmalen, Vergleich und KI-Text erscheinen. Die Achsen der Varianten (Farbe, Größe) zählen mit, auch wenn die Sicht sie nicht nennt.

Bilder und Dokumente erscheinen nur, wenn sie heute gelten, freigegeben sind und in einem Ordner liegen, den die Rolle sieht. **Die Regeln für Sichtbarkeit gibt es so nur einmal: in journali.**

## Das Chat-Fenster: ein Script-Tag

```html
<script src="https://advisor.example.com/widget.js" async></script>
```

Mehr braucht eure Website nicht. Das Fenster läuft im **Shadow DOM**, damit Seite und Fenster sich nicht gegenseitig gestalten. Werte aus den Produktdaten setzt es nur als Text, nie als HTML. Wählbar sind `data-locale`, `data-target` (in ein Element statt schwebend) und `data-color`. Der Dienst liefert `widget.js` mit Fingerabdruck aus: Nach einem Update bekommt der Browser sofort das neue Fenster.

## MCP für KI-Agenten

Derselbe Dienst bedient unter `/mcp` einen **MCP-Server** (Streamable HTTP, Antwort als JSON) mit drei Werkzeugen, alle nur lesend:

- `search_products` – Frage, Filter aus den Merkmalen, Sprache, Anzahl; der Kern versteht die Frage wie im Fenster, nur ohne Gespräch, und liefert die passenden Abschnitte aus den Unterlagen mit,
- `get_product` – ein Produkt mit seinen Attributen, Bildern und Varianten,
- `compare_products` – Produkte nebeneinander.

Der Dienst spricht **zwei Generationen der Spezifikation**: 2026-07-28 ohne Handshake – jede Anfrage nennt ihre Version im Kopf und im Rumpf, `server/discover` sagt, was der Server kann – und 2025-11-25, 2025-06-18 und 2025-03-26 mit `initialize`, ohne Sitzung. Eine Anmeldung gibt es am MCP-Endpunkt nicht: Er zeigt, was die Website ohnehin zeigt. Ob ein Berater MCP anbietet, steht an ihm. Mehr zum Protokoll: [MCP erklärt](/2026/09/20/mcp-model-context-protocol-erklaert/).

## Unterlagen: der Berater schlägt in euren Dokumenten nach

Für Fragen zu Pflege, Gebrauch, Größe oder einem Problem nutzt der Berater, was journali schon hat: den **Dokumentindex** (Abschnitte mit Seite und Überschrift) und die **Vektoren der Abschnitte** aus dem Plugin embed. Kein eigener Index, keine Kopie. Die Unterlagen eines Beraters sind die Dokumente an seinen Produkten, Varianten und den Gruppen darüber – eine Pflegeanleitung an der Gruppe „Hosen“ gilt für jede Hose.

Die Grenze, ab der ein Abschnitt passt, ist **gemessen**: an 499 Abschnitten von Testunterlagen, mit Fragen zu Pflege und Reparatur und mit Fragen ohne Bezug. Ein Dokument selbst gibt der Dienst nur heraus, wenn es zu den Unterlagen gehört, und immer mit `Content-Security-Policy: sandbox`. Mehr zum Prinzip: [RAG erklärt](/2026/10/04/rag-retrieval-augmented-generation-erklaert/).

## Grenzen und Herkunft

| Grenze | Vorgabe | zählt |
|---|---|---|
| je Besucher und Minute | 20 | der Dienst, je Adresse |
| je Besucher und Tag | 300 | der Dienst, je Adresse |
| alle Fragen je Tag | ohne | journali, je Berater |
| Texte der KI je Tag | ohne | journali, je Berater |

Die Adresse eines Besuchers kennt nur der Dienst, darum zählt er. journali zählt alle Fragen und alle KI-Texte eines Beraters – **mit einer Tagesgrenze kostet auch ein übernommener Dienst nicht mehr als diese Grenze.** Beides ist Betrieb und steht nicht im Journal.

**CORS:** Die Definition nennt die Websites, die das Fenster einbinden dürfen. Eine Anfrage mit einem anderen `Origin` bekommt 403, auch am MCP-Endpunkt, wie es die Spezifikation gegen DNS-Rebinding verlangt. Ohne `Origin` – ein Server, ein MCP-Client – gilt die Anfrage.

## Der Berater versteht, journali wählt aus

Die Arbeit ist geteilt:

- **Der Berater versteht:** Der Kern im Plugin macht aus der Eingabe eine genaue Anfrage – Angaben, Zahlen mit Einheit, Eigenschaftswörter wie „leicht“, Tippfehler, die Art des Produkts –, führt das Gespräch mit seinem Gedächtnis und setzt die Antwort in der Sprache des Besuchers zusammen. Er läuft im Dienst und in journali als Kindprozess für die Vorschau.
- **journali wählt aus:** Rechte, Sicht, Freigaben, Suche nach Angaben, Wörtern und Sinn, Merkmale, Unterlagen, KI mit dem Schlüssel des Teams – alles, was ein Recht oder ein Geheimnis braucht.

Dazwischen liegt die **Schnittstelle in Version 2**:

1. **Vokabular** – die Attribute der Sicht mit Bezeichnung, Typ, Einheit und Listenwerten, dazu die Wörter der Produktnamen. Klein und mit ETag: Der Berater holt es nur, wenn es sich geändert hat.
2. **Auswahl** – Art, Angaben, Wörter zum Ordnen, Seite. journali schickt nur, was passt: „ein Laptop zwischen 1000 und 2000 €“ wird eine Anfrage mit der Art „laptop“ und zwei Angaben zum Preis, auch in einem sehr großen Katalog.
3. **Unterlagen** – die passenden Abschnitte zu einer Frage.
4. **KI** – der Auftrag des Beraters; journali ruft die KI mit dem Schlüssel des Teams.

Das Chat-Fenster zeigt nur noch an: Es schickt die Eingabe oder den Klick, der Kern antwortet. Wie gut der Berater antwortet, prüft ein **Prüfstand**: Gespräche mit Eingaben, Klicks und der Antwort, die ein guter Berater geben würde, gespielt gegen eine Instanz.

## Weitere Quellen über MCP – angebunden von journali

Preise und Verfügbarkeit aus der Warenwirtschaft, Angaben aus dem Shop: Solche Systeme bieten zunehmend einen eigenen MCP-Server an. **Entschieden ist, wer sie anbindet: journali, nicht das Chat-Fenster und nicht der Dienst.** Der Dienst spricht nur mit journali.

Der Entwurf dafür, **geplant und noch nicht gebaut**:

- ein **Zugang der Art `mcp`** mit Adresse und Anmeldung (Bearer, eigener Kopf oder OAuth Client Credentials); das **Geheimnis liegt im Tresor** von journali, nie am Dienst an der Website,
- am Berater eine **Freigabeliste**: welche Werkzeuge welcher Zugänge er nutzen darf – nur lesende, mit Grenze je Besucher und Tag,
- die KI des Beraters bekommt die freigegebenen Werkzeuge angeboten, **journali führt jeden Aufruf selbst aus** und gibt ihr das Ergebnis,
- ein Eintrag je Aufruf hält fest, welches Werkzeug gerufen wurde, wie lange es dauerte und ob es ein Ergebnis gab – ohne Inhalt.

So gibt es Rechte, Grenzen und Protokoll einmal, in journali. Und fremde Antworten gehen durch dieselbe Stelle wie eure eigenen Daten: **Sie sind Daten, keine Anweisungen an die KI.**

## Und jetzt?

journali ist noch in Entwicklung – journali-advisor läuft schon, die nächsten Schritte sind entschieden. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
