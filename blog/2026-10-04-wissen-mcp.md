---
title: Model Context Protocol (MCP): KI-Schnittstelle für Produktdaten
excerpt: Was das Model Context Protocol (MCP) regelt, wie es aufgebaut ist und worauf es beim Zugriff eines KI-Assistenten auf Produktdaten ankommt.
slug: mcp-model-context-protocol-erklaert
tags: [KI, MCP, Integration, REST API]
categories: [Wissen]
wp: 103
---
**Das Model Context Protocol (MCP) ist ein offener Standard, der einheitlich regelt, wie ein KI-Assistent auf die Systeme zugreift, in denen Daten gepflegt werden.** Ein KI-Assistent kennt nur, was sein Modell enthält und was ihm im Gespräch gegeben wird. Für aktuelle technische Daten, Varianten oder Freigaben braucht er Zugriff auf diese Systeme. Dieser Artikel beschreibt, wie das Protokoll aufgebaut ist, welche Fragen es offen lässt und welche Anforderungen sich daraus für Produktdaten ergeben.

## Auf einen Blick

- MCP unterscheidet drei Rollen: Host, Client und Server.
- Ein MCP-Server bietet drei Arten von Inhalten an: Tools, Resources und Prompts.
- Die Nachrichten sind JSON-RPC 2.0 in UTF-8 und gehen über stdio oder Streamable HTTP.
- Die erste Version der Spezifikation trägt das Datum 5. November 2024, die aktuelle ist vom 28. Juli 2026.
- Das Protokoll kann seine Grundsätze zur Sicherheit nicht selbst erzwingen; eine Anmeldung ist optional und stützt sich bei HTTP auf OAuth 2.1.
- In journali spricht der Produktberater MCP: sein Dienst bietet die Werkzeuge `search_products`, `get_product` und `compare_products`; ein allgemeiner MCP-Dienst für die Pflege ist als Entwurf geplant und liest nur.

## Wie ist das Model Context Protocol aufgebaut?

MCP beschreibt die Verbindung zwischen einer KI-Anwendung und einem Dienst, der ihr Daten und Funktionen bereitstellt. Die Spezifikation unterscheidet drei Rollen:

- **Host** – die KI-Anwendung, mit der eine Person arbeitet, etwa ein Chatprogramm oder ein Editor.
- **Client** – die Verbindungskomponente innerhalb des Hosts.
- **Server** – der Dienst, der Daten und Funktionen anbietet.

Ein Server bietet drei Arten von Inhalten an:

- **Tools** sind Funktionen, die das Modell selbst aufruft, zum Beispiel „Produkte mit diesem Merkmal suchen“.
- **Resources** sind Daten und Kontext, die die Person oder das Modell verwendet.
- **Prompts** sind Vorlagen für Nachrichten und Abläufe, die die Person auswählt.

Die Nachrichten sind **JSON-RPC 2.0** in UTF-8. Ein Client fragt mit `tools/list`, welche Werkzeuge ein Server anbietet – jedes mit Name, Beschreibung und einem JSON-Schema für seine Parameter – und ruft eines mit `tools/call` auf. Für die Übertragung definiert die Spezifikation zwei Wege: **stdio**, bei dem der Client den Server als Unterprozess startet, und **Streamable HTTP**, bei dem jede Nachricht ein HTTP-POST an einen Endpunkt ist.

## Woher es kommt: eine Schnittstelle statt vieler Einzelanbindungen

Wer einen Assistenten an ein System anbinden wollte, schrieb dafür eine eigene Integration – und für den nächsten Assistenten eine weitere. Bei mehreren KI-Anwendungen und mehreren Systemen wächst die Zahl der Anbindungen mit dem Produkt beider Zahlen.

MCP wurde **Ende 2024 von einem KI-Anbieter als offener Standard vorgestellt**; die erste Version der Spezifikation trägt das Datum 5. November 2024. Seither unterstützen zahlreiche KI-Assistenten und Entwicklungswerkzeuge verschiedener Hersteller das Protokoll. Ein System, das MCP spricht, ist damit für alle diese Anwendungen erreichbar, ohne eine eigene Anbindung je Anwendung.

## Was es schwierig macht: Rechte, Daten, Nachweis, Versionen, Betrieb

### Wie sicher ist MCP? Die Sicherheit liegt bei der Umsetzung

Die Spezifikation stellt Grundsätze auf: Die Person stimmt dem Zugriff auf Daten und jedem Werkzeugaufruf zu und behält die Kontrolle darüber, was geteilt wird. Sie hält aber auch fest, dass **das Protokoll diese Grundsätze nicht selbst erzwingen kann** – das ist Aufgabe der Umsetzungen. Eine Anmeldung ist optional. Für HTTP stützt sie sich auf OAuth 2.1; bei stdio kommen die Zugangsdaten aus der Umgebung des Prozesses.

Für Produktdaten ist entscheidend, **mit wessen Rechten ein Server auf das System zugreift**. Ein Server mit einem eigenen, weit berechtigten Dienstkonto gibt jedem Assistenten, der ihn erreicht, dieselben Rechte. Die Spezifikation verlangt von Servern Zugriffskontrollen, geprüfte Eingaben und eine Begrenzung der Aufrufe.

### Daten können Anweisungen enthalten

Ein Assistent verarbeitet das Ergebnis eines Werkzeugs wie anderen Text. Steht in einem Produkttext, einer Lieferantenbeschreibung oder einem Datenblatt ein Satz, der wie eine Anweisung formuliert ist, kann das Modell ihn befolgen (**Prompt-Injection**). Das Risiko steigt, wenn derselbe Assistent auch schreibende Werkzeuge hat. Die Spezifikation empfiehlt, Werkzeugergebnisse vor der Weitergabe an das Modell zu prüfen, Angaben eines Servers über seine Werkzeuge nur bei vertrauenswürdigen Servern zu übernehmen und bei heiklen Vorgängen eine Bestätigung der Person einzuholen.

### Wer hat was geändert?

Schreibt ein Assistent Werte, ist hinterher zu klären, welche Änderungen von ihm stammen, in wessen Auftrag und auf welcher Grundlage. Die Spezifikation empfiehlt Clients, Werkzeugaufrufe zu protokollieren. Ein Protokoll im Client hilft aber dem System nicht, in dem die Daten stehen. Dort sind **Urheber und Zeitpunkt je Änderung** nötig, dazu erkennbare Zusammenhänge und ein Weg zurück.

### Die Spezifikation ändert sich

Jede Version trägt ein Datum; die aktuelle ist vom 28. Juli 2026. Mit ihr entfällt der Verbindungsaufbau über `initialize`: Jede Anfrage nennt ihre Protokollversion selbst. Ein Client nach dem älteren Verfahren erreicht einen Server, der nur das neue umsetzt, nicht; ein Server, der beide bedienen soll, setzt beide Verfahren um. Der frühere Übertragungsweg HTTP mit Server-Sent Events gilt als veraltet. **Wer einen MCP-Server betreibt, plant Aktualisierungen ein.**

### Lokal oder als Dienst

Bei stdio läuft der Server auf dem Rechner der Person und mit deren Rechten. Die Spezifikation beschreibt das Risiko eines Startbefehls aus fremder Quelle und empfiehlt eine ausdrückliche Zustimmung vor der Ausführung sowie eine eingeschränkte Umgebung. Ein Server über HTTP ist ein Dienst im Netz: Anmeldung, Verschlüsselung, Begrenzung der Aufrufe und Überwachung gehören zum Betrieb.

## Wen betrifft MCP?

- **Unternehmen, die Assistenten an ihre Systeme anbinden** – sie entscheiden, welche Systeme angebunden werden, welche Werkzeuge es gibt und mit welchen Rechten sie arbeiten.
- **Produktdaten-Teams** – ein Assistent nennt Werte aus den Produktdaten. Ein falscher oder veralteter Wert erscheint dann in einer Antwort, die jemand weitergibt.
- **Vertrieb** – Fragen nach technischen Daten, Varianten und Ausführungen lassen sich im Gespräch beantworten, so genau wie die Quelle.
- **Service** – Ersatzteile, Kompatibilität und Pflegehinweise; eine Antwort mit Herkunftsangabe lässt sich nachprüfen.

## Wie Lösungen aussehen: Rechte, Lesen, Nachweis, eine Quelle

### Vier Grundsätze

1. **Zugriff nur mit den Rechten der Person.** Der Server hat kein eigenes Konto; jeder Aufruf kommt mit dem Zugang einer Person, und dieser Zugang lässt sich sperren.
2. **Lesen vor Schreiben.** Zuerst lesende Werkzeuge. Schreibende Werkzeuge erhalten ein eigenes Recht und eine Bestätigung.
3. **Jede Änderung nachvollziehbar und umkehrbar.** Urheber, Zeitpunkt und Zusammengehörigkeit stehen fest, und eine Änderung lässt sich zurücknehmen.
4. **Eine gepflegte Quelle.** Der Assistent fragt die Quelle zum Zeitpunkt der Frage, statt eine Kopie zu lesen, die veraltet.

### journali heute: Schnittstelle, Token, Journal

- **REST-Schnittstelle unter `/api`.** Die Oberfläche von journali nutzt dieselbe Schnittstelle wie jedes andere System. Die Beschreibung im Format **OpenAPI 3.0** liegt unter `/api/openapi.json`; sie wird aus den Endpunkten des laufenden Servers erzeugt und nennt zu jedem Aufruf das Recht, das er braucht.
- **API-Token je Person.** Ein Token wird in den Einstellungen unter ◐ Mein Account angelegt, ist nur beim Anlegen sichtbar und lässt sich widerrufen; gespeichert wird nur sein Hash. Ein Token arbeitet mit der Rolle seiner Person. Fehlt ein Recht, antwortet der Server mit `403`.
- **Jede Änderung ist ein Eintrag im Journal** – mit laufender Nummer, Zeitpunkt und Urheber. Einträge werden nur angehängt, nie geändert oder gelöscht. Alle Einträge einer Aktion tragen dieselbe Stapelkennung; ein Stapel lässt sich zurücknehmen, und die Rücknahme ist selbst ein neuer Stapel.

Mehr dazu: [Integration im PIM journali](https://journali.de/2026/10/02/integration/) und [Das Journal als Single Source of Truth in journali](https://journali.de/2026/09/01/journal-single-source-of-truth/).

### MCP in journali: der Produktberater spricht MCP, der allgemeine Dienst ist geplant

**Gebaut ist der MCP-Server des Produktberaters.** Der Dienst des Journali KI Produktberaters beantwortet unter `/mcp` Anfragen über Streamable HTTP, in der Version vom 28. Juli 2026 und in den älteren Versionen mit `initialize`. Er bietet drei Werkzeuge: `search_products`, `get_product` und `compare_products`. Ein KI-Agent sieht damit die Produkte, die der Berater zeigt – aus einem Publikationsbaum, mit den Rechten einer Rolle und den Attributen einer Sicht – und liest nur.

**Ein allgemeiner MCP-Dienst für die Pflege ist als Entwurf geplant und nicht gebaut.** Der Entwurf sieht vor:

- **Ein eigener Prozess**, der nur über die Schnittstelle spricht. Zwei Betriebsarten: vom Assistenten selbst gestartet (stdio) oder als Dienst über HTTP in einem eigenen Container.
- **Werkzeuge über vorhandenen Endpunkten:** Suche nach Knoten, ein Knoten mit seinen Attributen je Sprache und Kanal, ein Teilbaum als Tabelle, die freigegebene Version eines Produkts mit ihren Belegen, der Verlauf eines Werts, das Modell und die Ausleitung eines Publikationsbaums.
- **Nur lesen** – das ist entschieden. Schreiben käme später als eigene Werkzeuge mit eigener Rolle, damit im Journal steht, dass ein Assistent die Änderung geschrieben hat.
- **Keine eigenen Rechte im Dienst:** Jeder Aufruf kommt mit dem Token einer Person. Geplant ist, dass ein Administrator solche Token ausgibt und begrenzt – Aufrufe je Minute und je Tag, größte Antwort, Ablaufdatum, nur lesen oder auch schreiben.
- **Ein Container ohne Daten:** Er verbindet sich nur ausgehend mit dem Server, hat keinen Zugang außer HTTP, legt keine Token ab, protokolliert keine Werte und speichert keine Produktdaten zwischen – nur das Modell.
- **Antworten mit Herkunft:** Journalnummer, freigegebene Version und Beleg am Wert.

Offen ist, ob später eine Anmeldung über OAuth dazukommt.

Verwandte Themen: [Retrieval-Augmented Generation (RAG) erklärt](https://journali.de/2026/10/04/rag-retrieval-augmented-generation-erklaert/), [Generative Engine Optimization (GEO) erklärt](https://journali.de/2026/09/26/geo-generative-engine-optimization-erklaert/).

## Häufige Fragen

### Was ist das Model Context Protocol (MCP)?

Das Model Context Protocol (MCP) ist ein offener Standard, der die Verbindung zwischen einer KI-Anwendung und einem Dienst regelt, der ihr Daten und Funktionen bereitstellt. Ein System, das MCP spricht, ist für alle KI-Anwendungen erreichbar, die das Protokoll unterstützen, ohne eine eigene Anbindung je Anwendung.

### Was ist ein MCP-Server?

Ein MCP-Server ist der Dienst, der einer KI-Anwendung Daten und Funktionen anbietet. Ein MCP-Server bietet drei Arten von Inhalten an: Tools als Funktionen, die das Modell selbst aufruft, Resources als Daten und Kontext und Prompts als Vorlagen für Nachrichten und Abläufe, die die Person auswählt.

### Welche Übertragungswege kennt MCP?

MCP definiert zwei Übertragungswege: stdio, bei dem der Client den Server als Unterprozess startet, und Streamable HTTP, bei dem jede Nachricht ein HTTP-POST an einen Endpunkt ist. Der frühere Übertragungsweg HTTP mit Server-Sent Events gilt als veraltet.

### Wie sicher ist MCP?

Die Sicherheit von MCP liegt bei der Umsetzung, denn das Protokoll kann seine Grundsätze, etwa die Zustimmung der Person zu jedem Werkzeugaufruf, nicht selbst erzwingen. Eine Anmeldung ist bei MCP optional und stützt sich bei HTTP auf OAuth 2.1; von Servern verlangt die Spezifikation Zugriffskontrollen, geprüfte Eingaben und eine Begrenzung der Aufrufe.

### Was ist Prompt-Injection bei MCP?

Prompt-Injection bei MCP bedeutet, dass ein Modell einen Satz aus dem Ergebnis eines Werkzeugs befolgt, der wie eine Anweisung formuliert ist, etwa aus einem Produkttext, einer Lieferantenbeschreibung oder einem Datenblatt. Das Risiko steigt, wenn derselbe Assistent auch schreibende Werkzeuge hat; die Spezifikation empfiehlt, Werkzeugergebnisse vor der Weitergabe an das Modell zu prüfen und bei heiklen Vorgängen eine Bestätigung der Person einzuholen.

### Was ändert die MCP-Spezifikation vom 28. Juli 2026?

Mit der MCP-Spezifikation vom 28. Juli 2026 entfällt der Verbindungsaufbau über initialize, und jede Anfrage nennt ihre Protokollversion selbst. Ein Client nach dem älteren Verfahren erreicht einen Server, der nur das neue Verfahren umsetzt, nicht; ein Server, der beide bedienen soll, setzt beide Verfahren um.

### Was hat ein PIM-System mit MCP zu tun?

Ein KI-Assistent, der über MCP auf Produktdaten zugreift, nennt Werte aus dem System, in dem sie gepflegt werden, und ein falscher oder veralteter Wert erscheint dann in seiner Antwort. Darum zählt, dass der Assistent die gepflegte Quelle zum Zeitpunkt der Frage liest, nur mit den Rechten einer Person zugreift und jede Änderung mit Urheber und Zeitpunkt nachvollziehbar bleibt. Im PIM-System journali spricht der Produktberater MCP mit den Werkzeugen search_products, get_product und compare_products; ein allgemeiner MCP-Dienst für die Pflege ist als Entwurf geplant. Heute gibt es dafür die REST-Schnittstelle unter /api mit API-Token je Person, und jede Änderung ist ein Eintrag im Journal.

*Erstellt mit Unterstützung von KI.*

## Quellen

- Model Context Protocol, offizielle Website: [modelcontextprotocol.io](https://modelcontextprotocol.io)
- Spezifikation, Version 2026-07-28: [modelcontextprotocol.io/specification/2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
- Spezifikation, erste Version 2024-11-05: [modelcontextprotocol.io/specification/2024-11-05](https://modelcontextprotocol.io/specification/2024-11-05)
