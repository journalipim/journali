---
title: KI-Produktberater: Agentic Commerce, MCP und Produktdaten
excerpt: Was ein KI-Produktberater leistet, was Agentic Commerce und MCP bedeuten, welche Produktdaten nötig sind – und wie journali es umsetzt.
slug: ki-produktberater-agentic-commerce-erklaert
tags: [KI, Produktberater, MCP, Agentic Commerce]
categories: [Wissen]
wp: 260
keyphrase: Agentic Commerce
---
Ein **KI-Produktberater** ist ein Programm auf der Website eines Shops oder Herstellers, das Fragen von Besuchern in natürlicher Sprache annimmt und mit passenden Produkten aus dem eigenen Sortiment beantwortet – mit Rückfragen, Eingrenzen und Vergleich. Mit **Agentic Commerce** hängt er zusammen, weil dieselben Fragen zunehmend auch KI-Agenten stellen, die im Auftrag eines Menschen suchen, vergleichen und kaufen, und weil beide dieselben genauen, maschinenlesbaren Produktdaten brauchen. Agentic Commerce gilt laut der Onlinehändlerbefragung 2026 der FHNW als neuer Vertriebskanal, der 2026 noch wenig verbreitet ist.

## Auf einen Blick

- Ein KI-Produktberater beantwortet eine Frage wie „Zelt für zwei, unter 3 kg“ mit passenden Produkten, einer Rückfrage nach den Merkmalen, in denen sie sich unterscheiden, und einem Vergleich.
- In der Onlinehändlerbefragung 2026 der FHNW mit 473 Onlineshop-Betreibenden bewerten 10 Prozent Agentic Commerce als umsatzrelevant; 76 Prozent bieten den Kanal noch nicht an.
- Dieselbe Studie nennt vollständige, aktuelle und maschinenlesbare Produktdaten als Voraussetzung dafür, dass KI-Agenten Angebote finden, verstehen und vergleichen.
- Das Model Context Protocol (MCP) legt fest, wie eine KI-Anwendung Werkzeuge und Daten eines Servers aufruft; seit dem 9. Dezember 2025 gehört es zur Agentic AI Foundation der Linux Foundation.
- Der Journali KI Produktberater (journali-advisor) findet Produkte, stellt Rückfragen, vergleicht und schlägt in Unterlagen nach, ohne dass eine KI angebunden ist.
- Für KI-Agenten bietet derselbe Dienst einen MCP-Server mit drei Werkzeugen, die nur lesen: `search_products`, `get_product` und `compare_products`.

## Was leistet ein KI-Produktberater?

In ein Suchfeld tippt man Stichwörter und setzt Filter von Hand. Einem Produktberater schreibt man einen Satz: „Ich brauche ein Zelt für zwei Personen“, „Regenjacke unter 200 Euro“. Der Berater macht daraus Angaben zu den Merkmalen des Sortiments und zeigt die Produkte, die passen.

- **Rückfragen:** Unterscheiden sich die Treffer nach Farbe oder Gewicht, fragt der Berater danach und bietet die Werte zur Auswahl an.
- **Eingrenzen:** Jede weitere Eingabe ergänzt das bisher Gesagte. „Zelt“, dann „für zwei“, dann „unter 3 kg“ sucht mit allen drei Angaben.
- **Vergleichen:** Mehrere Produkte stehen Zeile für Zeile nebeneinander.
- **Nachfragen und Probleme:** „Ist es wasserdicht?“ gilt dem gezeigten Produkt; Fragen zu Pflege oder einem Defekt beantwortet ein Abschnitt aus den Unterlagen.

Der Berater erscheint als schwebendes Fenster mit einem Knopf oder eingebettet in einen Bereich der Seite. Für den Shop zeigt er nur, was gepflegt ist, und macht Lücken sichtbar: Ein Wort, das oft gefragt wird und in keinem Produkt steht, weist auf ein fehlendes Merkmal oder Synonym hin. Laut der FHNW-Befragung setzen 16 Prozent der Händler einen KI-basierten Chatbot in der Verkaufs- oder Kundenberatung ein (2025: 11 Prozent), weitere 21 Prozent planen oder testen ihn.

## Was ist Agentic Commerce?

Unter **Agentic Commerce** versteht man Onlinehandel, bei dem KI-Agenten auf Grundlage von Zielen, Befugnissen und Grenzen, die ihnen ein Mensch oder ein Unternehmen gibt, Aufgaben im Ein- oder Verkauf selbständig planen und ausführen: suchen, vergleichen, verhandeln, entscheiden, bezahlen. So fasst es die FHNW-Studie als Arbeitsdefinition zusammen; eine allgemein anerkannte Definition gibt es nach ihren Angaben noch nicht. Der Bitkom beschreibt Agentic Commerce im April 2026 als Einsatz von KI-Agenten, etwa digitalen Shoppingassistenten, die für Verbraucher Angebote vergleichen und passende Produkte finden.

Die FHNW-Studie unterscheidet Stufen nach der Rolle der KI:

| Stufe | Rolle der KI | Rolle des Menschen |
|---|---|---|
| Conversational Commerce | beantwortet Fragen, erklärt Produkte, stellt Rückfragen | führt den Dialog, kauft selbst |
| KI-gestützter Handel | analysiert Bedürfnisse, vergleicht Angebote | wählt aus und kauft selbst |
| teilagentischer Handel | stellt einen Warenkorb zusammen, bereitet die Bestellung vor | prüft und genehmigt |
| Agentic Commerce im engeren Sinn | wählt innerhalb von Zielen und Grenzen aus, bestellt und bezahlt | greift nur im Ausnahmefall ein |

Ein Produktberater im Shop gehört zur ersten Stufe. Ein Agent greift dagegen über Werkzeuge und Schnittstellen auf Daten zu und löst Aktionen aus.

### Wo der Markt 2026 steht

In der FHNW-Befragung erwarten 75 Prozent der Händler, dass KI-Agenten Produktsuchen übernehmen, 74 Prozent Preisvergleiche und 71 Prozent Empfehlungen; Kaufentscheidungen erwarten 32 Prozent, eine vollständige Kaufabwicklung 22 Prozent. Knapp drei Viertel haben noch keine Strategie für KI oder Agentic Commerce. Als Gründe für den noch geringen Umsatz nennt die Studie unter anderem fehlende Standards, Medienbrüche beim Kaufabschluss und offene Fragen zu Datenzugriff, Datenschutz, Haftung und Bezahlung. Zahlungsdienstleister und KI-Anbieter haben Verfahren für Einkäufe durch Agenten vorgestellt; als Commerce-Protokoll nennt die Studie das Universal Commerce Protocol (UCP). Die Befragten stammen zu 90 Prozent aus der Schweiz.

### Warum Produktdaten maschinenlesbar und genau sein müssen

Ein Mensch liest „ca. 1,4 kg, sehr leicht“ und versteht es. Ein Agent, der „unter 2 kg“ prüfen soll, braucht eine Zahl und eine Einheit. Die FHNW-Studie folgert: Produkttitel, Eigenschaften, Varianten, Preise, Verfügbarkeit, Lieferbedingungen und Rückgaberegeln müssen vollständig, aktuell und maschinenlesbar vorliegen, denn ein Agent empfiehlt nur Angebote, die er eindeutig versteht und vergleichen kann. Händler, die sich vorbereiten, nennen besonders häufig die Arbeit an strukturierten Produkt- und Stammdaten.

Für Produktdaten heißt das: Merkmale mit Typ (Gewicht als Zahl in kg, Farbe aus einer Werteliste, „wasserdicht“ als Ja/Nein), Varianten mit ihren Achsen, eindeutige Kennungen wie die GTIN, einheitliche Bezeichnungen und Freigaben. Für Produktseiten gibt es das Vokabular **Schema.org** mit dem Typ `Product` und Eigenschaften wie `gtin`, `color`, `weight` und `offers`. Agenten, die Werkzeuge aufrufen, fragen dagegen eine Schnittstelle.

## Was hat MCP mit Agentic Commerce zu tun?

Das **Model Context Protocol (MCP)** ist ein offenes Protokoll, über das eine KI-Anwendung mit einem Server spricht, der ihr **Tools** (Funktionen), **Resources** (Daten) und **Prompts** (Vorlagen) anbietet; die aktuelle Version der Spezifikation trägt das Datum 28. Juli 2026. Am 9. Dezember 2025 hat die Linux Foundation die Gründung der Agentic AI Foundation bekanntgegeben, mit MCP als einem der ersten Projekte; die Pressemitteilung nennt mehr als 10 000 veröffentlichte MCP-Server. Aufbau, Sicherheit und Versionen beschreibt die Wissensseite [MCP – das Model Context Protocol erklärt](https://journali.de/2026/09/20/mcp-model-context-protocol-erklaert/).

Über MCP fragt ein Agent ein Sortiment ab, statt Webseiten zu lesen: Er ruft ein Werkzeug „Produkte suchen“ mit Parametern auf und bekommt strukturierte Werte zurück. Ein Shop oder Hersteller, der seine Produktdaten über MCP anbietet, legt selbst fest, welche Produkte und Merkmale ein Agent erreicht, liefert den Stand zum Zeitpunkt der Frage und erreicht jeden Agenten, der MCP spricht. In der FHNW-Befragung nennen 22 Prozent der 136 Händler, die dazu antworteten, die Arbeit an Schnittstellen für KI-Agenten wie MCP oder UCP. Die Spezifikation hält fest, dass das Protokoll seine Sicherheitsgrundsätze nicht selbst erzwingen kann; Zugriffskontrollen sind Aufgabe der Umsetzung.

## Wie sehen Lösungen aus?

Ein Produktberater und ein MCP-Server für Agenten bestehen aus denselben drei Schritten:

1. **Verstehen:** Aus der Eingabe werden Angaben – Art des Produkts, Merkmale, Zahlen mit Einheit. Das leisten Regeln gegen das Datenmodell oder ein Sprachmodell.
2. **Auswählen:** Aus den gepflegten Daten werden die Produkte gewählt, die passen und gezeigt werden dürfen – nur freigegebene Produkte, nur öffentliche Merkmale.
3. **Antworten:** Karten, Rückfrage, Vergleich, ein Abschnitt aus den Unterlagen ([RAG erklärt](https://journali.de/2026/10/04/rag-retrieval-augmented-generation-erklaert/)); ein Text kann von einem Sprachmodell kommen.

Setzt man ein Sprachmodell allein vor den Katalog, ist zu klären: Nennt es Werte, die nicht in den Daten stehen? Was geschieht, wenn ein Produkttext einen Satz enthält, der wie eine Anweisung aussieht (Prompt-Injection)? Was kostet jede Frage, und welche Daten gehen an den Anbieter des Modells? Eine Auswahl aus den Daten selbst beantwortet die erste Frage: Was angezeigt wird, steht in den Produktdaten. Für die Sichtbarkeit in den Antworten fremder KI-Systeme siehe [GEO erklärt](https://journali.de/2026/09/26/geo-generative-engine-optimization-erklaert/).

## Wie journali es löst: der Journali KI Produktberater

Der **Journali KI Produktberater**, technisch **journali-advisor**, ist das Plugin `advisor`. Ein Berater wird unter ⇪ Export → Produktberatung angelegt; die Vorschau dort stellt dieselbe Frage wie ein Besucher. Was er zeigt, bestimmen drei Angaben, und jede schränkt ein:

| Angabe | bestimmt |
|---|---|
| Publikationsbaum | welche Produkte: was der Baum für seinen Kanal ausleitet, mit den freigegebenen Varianten |
| Rolle | was davon sichtbar ist: eingeschränkte Knoten und Ordner von Medien fallen weg |
| Sicht | welche Attribute am Produkt, in Rückfragen, im Vergleich und im Text der KI erscheinen |

Ein internes Attribut wie der Einkaufspreis erscheint nirgends, auch nicht als Filter. Bilder und Dokumente erscheinen nur, wenn sie heute gelten und freigegeben sind.

### Was er ohne KI versteht

Treffer, Rückfragen, Vergleich und Auszüge aus den Unterlagen entstehen ohne Sprachmodell. Der Berater liest jede Eingabe gegen die Attribute der Sicht mit Bezeichnungen, Einheiten und Wertelisten und gegen die Produktnamen:

- **Arten:** Ein Wort aus einem Produktnamen („zelt“) grenzt ein, jedes andere Wort ordnet; gebeugte Formen zählen mit.
- **Angaben mit Einheiten:** „unter 3 kg“, „mit 30 Litern“, „bis minus 10 grad“ werden Filter auf das Attribut mit dieser Einheit; dazu Zahlwörter („für zwei Personen“), Geld („unter 200 Euro“), Listenwerte („in rot“) und Ja/Nein („mit helmkapuze“).
- **Eigenschaftswörter:** „leicht“, „hell“, „schnell aufgebaut“ beziehen sich auf das Attribut, dessen Einheit Masse, Lichtstrom oder Zeit misst; „leicht“ ist die Hälfte der Treffer mit den kleineren Werten.
- **Tippfehler:** „isomate“ liest er als „isomatte“ und sagt es.
- **Gedächtnis des Gesprächs:** Angaben werden gesammelt und lassen sich einzeln entfernen. Beim Wechsel vom Zelt zum Schlafsack übernimmt er Vorlieben wie die Größe, wenn es sie dort gibt; ein abgelehntes Produkt kommt nicht wieder nach vorn.
- **Rückfragen:** Die Antwort endet mit einer Frage nach den unterscheidenden Merkmalen. Meint eine Angabe mehreres – Komfort-, Grenz- oder Extremtemperatur –, fragt er nach.
- **Fragen zu gezeigten Produkten:** „Sind die wasserdicht?“ beantworten die Werte und Textstellen dieser Produkte. Passt nichts mehr, nennt er, welche Angabe zu eng ist.
- **Sortiment und Grundwissen:** „Was verkauft ihr?“ beantwortet er mit den Gruppen des Publikationsbaums. Er grüßt, sagt, dass er ein Programm ist, und gibt zu Versand, Bezahlung oder Rückgabe keine Auskunft.
- **Assoziationen:** Ein Wort, das in keinem Produkt steht, sucht über verbundene Wörter aus dem Sortiment: zu „festival“ nach „zelt“ und „camping“. Das Plugin bringt über 25 000 Assoziationen in Deutsch und Englisch mit.
- **Unterlagen:** Was in keinem Attribut steht, etwa wie man einen klemmenden Reißverschluss gängig macht, nennt er als Abschnitt eines Dokuments mit Seite, aus dem Dokumentindex von journali.

Mit dem Plugin `embed` sucht er auch nach dem Sinn, auf dem eigenen Server: „hält Hitze aus“ findet „temperaturbeständig bis 120 °C“. Ein Prüfstand spielt 17 Gespräche mit erwarteter Antwort gegen echte Daten. Ändert sich ein Attribut oder eine Werteliste in journali, gilt das im nächsten Gespräch; eine zweite Liste von Synonymen gibt es nicht.

### Was eine KI ergänzt

Am Berater lässt sich die KI eines Teams einschalten, mit dessen Schlüssel und Verbrauch. Sie schreibt zwei bis vier Sätze zu den ersten fünf Treffern, im Fenster gekennzeichnet als „Text von einer KI erstellt“, und übersetzt, was die Regeln nicht erkannt haben, in Filter – nur aus Attributen und Werten der Sicht, vom Server geprüft. Sie bekommt die Treffer mit ihren Werten und keine Werkzeuge; ein Satz in den Produktdaten, der wie eine Anweisung aussieht, kann darum nichts auslösen. Welche Produkte passen, entscheidet journali. Fehlt der Schlüssel oder ist die Tagesgrenze erreicht, kommt die Antwort ohne Text, mit denselben Treffern.

### MCP-Werkzeuge für KI-Agenten

Der Dienst des Beraters bedient unter `/mcp` einen MCP-Server (Streamable HTTP, Version 2026-07-28 sowie 2025-11-25, 2025-06-18 und 2025-03-26) mit drei Werkzeugen, alle nur lesend: `search_products` (Frage, Filter, Sprache, Anzahl, dazu passende Abschnitte der Unterlagen), `get_product` und `compare_products`. Ein Agent bekommt dieselben Treffer wie ein Besucher, ohne Text der KI. Eine Anmeldung gibt es nicht, denn der Endpunkt zeigt, was die Website ohnehin zeigt; ob ein Berater MCP anbietet, steht an ihm. Bestellen oder bezahlen kann ein Agent darüber nicht.

### Website, Container, Token

- **Einbindung:** ein `<script>`-Tag; das Fenster erscheint schwebend oder mit `data-target` in einem Element der Seite, auf Deutsch oder Englisch. Es läuft im Shadow DOM, setzt kein Cookie und speichert nichts im Browser.
- **Eigener Container:** Der Dienst läuft aus `node:22-alpine` mit dem Verzeichnis des Plugins, ohne npm-Pakete und ohne Datenbank. Nur er ist von außen erreichbar; der journali-Server bleibt im internen Netz.
- **Token je Berater:** Es liegt als Hash im Tresor, liest mit der Rolle des Beraters und erreicht nur dessen Fragen.
- **Grenzen und Herkunft:** Je Besucheradresse 20 Fragen je Minute und 300 je Tag (Vorgabe); nur eingetragene Websites dürfen das Fenster einbinden.
- **Besucherdaten:** Das Gespräch hält der Dienst unter einer zufälligen Kennung im Arbeitsspeicher, 30 Minuten nach der letzten Eingabe ist es weg; nichts davon kommt ins Journal.

### Was offen ist

Preise und Verfügbarkeit kennt der Berater nur, soweit sie Attribute der Sicht sind; ein Verweis vom Treffer in den Shop fehlt. Geplant und nicht gebaut ist, dass journali fremde MCP-Server, etwa einer Warenwirtschaft, mit einer Freigabeliste lesender Werkzeuge anbindet. Als Konzept entschieden ist ein kurzlebiger, vom Shop signierter Nachweis für angemeldete Kunden, mit dem journali Kundenpreise anfragt.

Verwandte Themen: [MCP – das Model Context Protocol erklärt](https://journali.de/2026/09/20/mcp-model-context-protocol-erklaert/), [RAG – Retrieval-Augmented Generation erklärt](https://journali.de/2026/10/04/rag-retrieval-augmented-generation-erklaert/), [GEO – Generative Engine Optimization erklärt](https://journali.de/2026/09/26/geo-generative-engine-optimization-erklaert/).

## Häufige Fragen

### Was ist ein KI-Produktberater?

Ein KI-Produktberater ist ein Programm auf der Website eines Shops oder Herstellers, das Fragen von Besuchern in natürlicher Sprache mit passenden Produkten aus dem eigenen Sortiment beantwortet. Er stellt Rückfragen nach unterscheidenden Merkmalen, grenzt mit jeder Eingabe weiter ein und vergleicht Produkte.

### Funktioniert ein Produktberater ohne KI?

Ein Produktberater kann ohne Sprachmodell funktionieren, wenn er die Eingaben gegen das Datenmodell liest: Arten aus den Produktnamen, Zahlen mit Einheiten, Werte aus Listen, Eigenschaftswörter und Tippfehler. Der Journali KI Produktberater findet so Produkte, stellt Rückfragen, vergleicht und nennt Abschnitte aus den Unterlagen; eine KI des Teams schreibt auf Wunsch einen gekennzeichneten Text dazu.

### Was ist Agentic Commerce?

Agentic Commerce ist Onlinehandel, bei dem KI-Agenten im Auftrag eines Menschen oder Unternehmens innerhalb vorgegebener Ziele und Grenzen Produkte suchen, vergleichen, eine Kaufentscheidung treffen und bezahlen. In der Onlinehändlerbefragung 2026 der FHNW erwarten die Händler zuerst, dass Agenten Produktsuche, Preisvergleich und Empfehlungen übernehmen.

### Was hat MCP mit Agentic Commerce zu tun?

Das Model Context Protocol (MCP) ist ein offener Standard, über den ein KI-Agent Werkzeuge und Daten eines Servers aufruft, etwa „Produkte suchen“ mit Parametern statt einer Webseite. Ein Shop oder Hersteller mit einem MCP-Server bestimmt selbst, welche Produkte und Merkmale ein Agent erreicht, und liefert den Stand zum Zeitpunkt der Frage.

### Welche Produktdaten braucht ein KI-Produktberater?

Ein KI-Produktberater braucht Merkmale mit Typ und Einheit (Gewicht als Zahl in kg, Farbe aus einer Werteliste, Ja/Nein-Angaben), Varianten mit ihren Achsen, eindeutige Kennungen und einheitliche Bezeichnungen. Für Fragen zu Pflege und Gebrauch braucht er Dokumente an den Produkten oder Produktgruppen.

### Was unterscheidet einen KI-Produktberater von einem KI-Agenten?

Ein KI-Produktberater beantwortet Fragen und empfiehlt Produkte, die Kaufentscheidung trifft der Mensch; die FHNW-Studie ordnet das als Conversational Commerce ein. Ein KI-Agent greift über Werkzeuge und Schnittstellen auf Daten zu und löst Aktionen aus, bis zu Bestellung und Bezahlung.

### Was hat ein PIM-System mit einem KI-Produktberater zu tun?

Ein KI-Produktberater antwortet nur so genau wie die Produktdaten, und die werden im PIM-System gepflegt: Attribute mit Einheiten, Wertelisten, Varianten, Freigaben und Dokumente. Im PIM-System journali liest der Journali KI Produktberater die Produkte eines Publikationsbaums mit den Rechten einer Rolle und den Attributen einer Sicht.

### Ist Agentic Commerce ein Trendthema 2026?

Agentic Commerce gilt laut der Onlinehändlerbefragung 2026 der FHNW als neuer, noch wenig verbreiteter Vertriebskanal: 10 Prozent der befragten Händler bewerten ihn als umsatzrelevant, 76 Prozent bieten ihn noch nicht an. Knapp drei Viertel der Befragten haben noch keine Strategie für KI oder Agentic Commerce.

*Dieser Beitrag gibt den Stand vom 16. Oktober 2026 wieder.*

*Erstellt mit Unterstützung von KI.*

## Quellen

- Hochschule für Wirtschaft FHNW, Institute for Competitiveness and Communication: Onlinehändlerbefragung 2026 „Der Onlinehandel im KI-Wandel: Effizienz, Sichtbarkeit & Agentic Commerce“, September 2026, insbesondere Management Summary und Kapitel 2.2, 5.6, 5.7, 7.1 und 7.5: [fhnw.ch](https://www.fhnw.ch/de/wirtschaft/aktuelles/news-storys/alle/onlinehaendlerbefragung/online-haendler-befragung-2026.pdf)
- Handelsverband Schweiz, Meldung „Onlinehändlerbefragung 2026“ vom 09.09.2026: [handelsverband.swiss](https://handelsverband.swiss/news/onlinehaendlerbefragung-2026/)
- Bitkom, Presseinformation zu Agentic Commerce vom 10.04.2026: [bitkom.org](https://www.bitkom.org/Presse/Presseinformation/Agentic-Commerce-So-veraendert-KI-Online-Shopping)
- Model Context Protocol, Spezifikation, Version 2026-07-28, und Seite „Versioning“: [modelcontextprotocol.io/specification/2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
- Linux Foundation, Pressemitteilung zur Gründung der Agentic AI Foundation vom 09.12.2025: [linuxfoundation.org](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation)
- Schema.org, Typ Product, abgerufen am 16.10.2026: [schema.org/Product](https://schema.org/Product)
