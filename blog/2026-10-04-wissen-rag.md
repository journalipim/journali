---
title: Retrieval-Augmented Generation (RAG): Antworten aus Produktdaten
excerpt: Wie Retrieval-Augmented Generation (RAG) ein Sprachmodell aus eigenen Dokumenten mit Quelle antworten lässt und warum die Antwort an den Daten hängt.
slug: rag-retrieval-augmented-generation-erklaert
tags: [KI, RAG, Suche, Versionen]
categories: [Wissen]
wp: 102
keyphrase: Retrieval-Augmented Generation
---
**Retrieval-Augmented Generation (RAG)** ist ein Ansatz, der eine Suche in eigenen Dokumenten mit der Textgenerierung eines Sprachmodells verbindet. Ein KI-Assistent, der Fragen zu Produkten beantwortet, klingt nach einer einfachen Aufgabe. In der Praxis scheitert er oft an zwei Stellen: Das Sprachmodell kennt die Produkte nicht, und es sagt nicht, woher eine Antwort stammt. RAG setzt an beiden Stellen an.

## Auf einen Blick

- RAG verbindet eine Suche in eigenen Dokumenten mit der Textgenerierung eines Sprachmodells: Das Modell formuliert, die Fakten kommen aus den gefundenen Auszügen.
- Der Begriff stammt aus einem Forschungsbeitrag von 2020, der eine Enzyklopädie als externen Index in rund 21 Millionen Abschnitte zu je 100 Wörtern zerlegte.
- Das Prinzip hat fünf Schritte: Zerlegen, Einbetten, Ablegen, Suchen und Antworten.
- Wird der Index gegen einen neueren ausgetauscht, ändert sich das Wissen des Systems, ohne dass das Modell neu trainiert wird.
- Die Antwort ist nur so gut wie die Daten im Index: Veraltete oder widersprüchliche Angaben erscheinen in der Antwort, mit einer Quellenangabe.
- In journali rechnet das Plugin embed je Abschnitt und je Knoten einen Vektor mit 384 Zahlen, lokal auf dem eigenen Server und ohne Grafikkarte.

## Warum braucht ein Sprachmodell RAG?

Ein großes Sprachmodell lernt aus Texten, die bis zu einem bestimmten Zeitpunkt gesammelt wurden. Daraus ergeben sich drei Grenzen:

- **Fester Wissensstand.** Was nach dem Training entstanden ist, kennt das Modell nicht. Ein neues Produkt, ein geänderter Preis, eine überarbeitete Norm fehlen.
- **Keine Firmendaten.** Interne Datenblätter, Pflegedaten und Anleitungen waren nie Teil der Trainingsdaten.
- **Halluzinationen.** Ein Modell erzeugt auch dann einen flüssigen Text, wenn ihm das Wissen fehlt. Das Ergebnis kann plausibel klingen und trotzdem falsch sein.

Ein Forschungsbeitrag aus dem Jahr 2020 trägt den Begriff im Titel. Er beschreibt die Grenzen großer vortrainierter Sprachmodelle so: Sie können auf ihr Wissen nicht gezielt zugreifen, sie können nicht belegen, woher eine Aussage stammt, und ihr Wissen lässt sich nur schwer aktualisieren. Der Vorschlag: Das im Modell gespeicherte Wissen wird um einen **externen Index** ergänzt, in dem ein Suchverfahren passende Textabschnitte findet. Im Beitrag war das eine Enzyklopädie, zerlegt in rund 21 Millionen Abschnitte zu je 100 Wörtern. Ein Ergebnis der Arbeit: Wird der Index gegen einen neueren ausgetauscht, ändert sich das Wissen des Systems, **ohne dass das Modell neu trainiert wird**.

### Wie funktioniert RAG? Das Prinzip in fünf Schritten

1. **Zerlegen.** Dokumente werden in Abschnitte geteilt, etwa nach Überschriften oder Absätzen.
2. **Einbetten.** Ein Einbettungsmodell rechnet aus jedem Abschnitt einen **Vektor**: eine Reihe von Zahlen, die die Bedeutung des Textes beschreibt. Texte mit ähnlicher Bedeutung erhalten ähnliche Vektoren, auch wenn sie keine Wörter gemeinsam haben.
3. **Ablegen.** Die Vektoren werden in einem Index gespeichert, der schnelle Ähnlichkeitssuche erlaubt.
4. **Suchen.** Eine Frage wird mit demselben Modell eingebettet. Gesucht werden die Abschnitte, deren Vektoren dem Vektor der Frage am nächsten liegen.
5. **Antworten.** Die gefundenen Auszüge gehen zusammen mit der Frage an ein Sprachmodell. Die Anweisung lautet, nur aus diesen Auszügen zu antworten und anzugeben, aus welchem Auszug eine Aussage stammt.

Das Sprachmodell formuliert, die Fakten kommen aus den eigenen Dokumenten. **Damit verschiebt sich die Frage, ob eine Antwort stimmt, vom Modell auf die Daten.**

## Was es schwierig macht: Die Antwort ist nur so gut wie die Daten im Index

Ein RAG-System lässt sich schnell aufsetzen. Verlässliche Antworten liefert es erst, wenn die folgenden Punkte gelöst sind.

**Datenqualität und Aktualität.** Das Modell gibt wieder, was im Index steht. Enthält er veraltete Datenblätter, widersprüchliche Angaben oder drei Versionen derselben Anleitung, enthält die Antwort dieselben Fehler – jetzt mit einer Quellenangabe, die sie glaubwürdig wirken lässt. Ein Index, der einmal befüllt und dann nicht nachgeführt wird, hat dasselbe Problem wie das Sprachmodell selbst: einen festen Wissensstand.

**Zerlegung in Abschnitte.** Zu kurze Abschnitte verlieren den Zusammenhang; zu lange behandeln mehrere Themen, und ihr Vektor beschreibt keines davon genau. Tabellen in Datenblättern, Fußnoten und Kopfzeilen sind schwer sinnvoll zu teilen. Ein Abschnitt „Technische Daten“ ohne den Produktnamen ist für die Suche kaum zuzuordnen.

**Metadaten.** Ein Textabschnitt allein sagt nicht, zu welchem Produkt, welcher Variante oder welcher Sprache er gehört. Ohne diese Angaben lässt sich die Suche nicht eingrenzen, und die Antwort kann Werte zweier ähnlicher Produkte vermischen.

**Versionen und Gültigkeit.** Produktdaten ändern sich. Eine Antwort sollte sich auf den Stand beziehen, der freigegeben ist und heute gilt – nicht auf einen Entwurf und nicht auf ein Dokument, dessen Gültigkeit abgelaufen ist.

**Rechte.** Nicht jede Information ist für jeden Empfänger bestimmt. Interne Kalkulationen oder unveröffentlichte Produkte gehören nicht in einen Index, aus dem ein Händlerportal antwortet.

**Mehrsprachigkeit.** Eine Frage auf Deutsch soll auch einen englischen Abschnitt finden, und die Antwort soll in der Sprache der Frage kommen. Dazu braucht es ein mehrsprachiges Einbettungsmodell und Inhalte, die je Sprache sauber getrennt vorliegen.

**Halluzinationen trotz RAG.** Auch mit passenden Auszügen kann ein Modell Aussagen ergänzen, die dort nicht stehen, oder Auszüge falsch kombinieren. Die Anweisung, nur aus den Auszügen zu antworten, senkt das Risiko, beseitigt es aber nicht.

**Nachvollziehbarkeit.** Darum ist die **Quellenangabe** der eigentliche Gewinn: Jede Aussage verweist auf einen Auszug, jeder Auszug auf ein Dokument, eine Seite und einen Stand. Wer die Antwort prüfen will, kann es.

## Wen betrifft RAG? Alle, die Fragen zu Produkten beantworten

- **Vertrieb**, der in einem Gespräch schnell eine technische Angabe oder eine passende Alternative braucht.
- **Service und Support**, die Fehlerbilder, Ersatzteile und Anleitungen zuordnen.
- **Händlerportale und Shops**, in denen Kunden Fragen in eigenen Worten stellen statt nach Artikelnummern zu suchen.
- **Entwicklungs- und Datenteams**, die Assistenten, Chatbots oder interne Suchen mit Produktwissen bauen.

In allen Fällen gilt: Die Qualität der Antwort hängt an den Produktdaten, die in den Index gehen. **RAG ersetzt keine Datenpflege – es macht ihre Mängel sichtbar.**

## Wie Lösungen aussehen: eine gepflegte Quelle, regelmäßig ausgeleitet

Unabhängig von der eingesetzten Software haben belastbare Lösungen dieselben Bestandteile:

- **Eine gepflegte Quelle.** Produktdaten werden an einer Stelle gepflegt und von dort in den Index gegeben – nicht aus verstreuten Dateien zusammengesucht.
- **Ein zitierfähiges Dokument je Produkt.** Je Produkt und Sprache ein Dokument mit Name, Pfad in der Struktur, Kennungen wie der Artikelnummer und allen gepflegten Werten samt Einheit.
- **Metadaten und Version.** Jedes Dokument nennt, welcher Stand enthalten ist und wann er freigegeben wurde. Damit kann eine Antwort auf genau diesen Stand verweisen.
- **Ein regelmäßiger Export.** Der Index wird nach einem Zeitplan aus der Quelle neu befüllt, damit er nicht veraltet.
- **Lokale Einbettungen.** Ein kleines Einbettungsmodell auf dem eigenen Server rechnet die Vektoren, ohne dass Produktdaten dafür an einen externen Dienst gehen.
- **Antworten mit Quellenangabe.** Das Sprachmodell erhält nummerierte Auszüge und gibt zu jeder Aussage die Nummer an.

### Wie journali es löst

journali ist ein PIM-System, in dem jede Änderung als Eintrag in einem Journal steht. Für RAG gibt es zwei Wege.

**Der Export für eigene Systeme.** Das Plugin **KI-Wissensbasis** schreibt als Job **je Knoten und Sprache ein Markdown-Dokument** sowie eine Datei `nodes.jsonl` mit einer Zeile je Dokument. Das Dokument enthält Name, Art des Knotens, Pfad im Baum, die Schlüssel und jedes gepflegte Attribut mit Bezeichnung, Wert und Einheit – geerbte Werte eingeschlossen, Formeln ausgerechnet, Listenwerte als lesbare Bezeichnung. Dazu kommen die **freigegebene Version** mit Nummer, Journalstand und Datum, die Belege dieser Version und der Text der Dokumente am Knoten mit Seite und Überschrift. Ausgeleitet werden nur Medien, die gültig und freigegeben sind. Jede Zeile der `nodes.jsonl` trägt einen Link zurück zum Knoten in journali. Der Job liest alles über die API von journali. Details stehen im Beitrag [RAG-ready: Produktwissen aus dem PIM journali als Wissensbasis](https://journali.de/2026/10/04/rag-ready/).

**Die Suche in journali selbst.** Das Plugin **embed** rechnet je Abschnitt eines Dokuments und je Knoten einen Vektor mit 384 Zahlen – mit einem mehrsprachigen Modell, **lokal auf dem eigenen Server und ohne Grafikkarte**. Die Vektoren liegen in derselben PostgreSQL-Datenbank wie alle anderen Daten, über die Erweiterung pgvector. Sie sind aus Text und Modell jederzeit neu zu berechnen; neu eingebettet wird nur, was sich geändert hat. Die Suche kann Wortsuche und Ähnlichkeitssuche verbinden: Was in beiden Ergebnislisten weit vorn steht, steht vorn.

Die **Frage an die Dokumente** folgt dem beschriebenen Prinzip: Die besten Abschnitte gehen nummeriert an die KI des Teams, mit der Anweisung, nur aus diesen Auszügen zu antworten, jede Aussage mit der Nummer ihres Auszugs zu versehen und in einem Satz zu sagen, wenn die Auszüge keine Antwort enthalten. Die Antwort nennt zu jeder Nummer Dokument, Seite, Überschrift und die Produkte, an denen das Dokument hängt. Mehr dazu im Beitrag [Suche nach Sinn im PIM journali](https://journali.de/2026/10/04/suche-nach-sinn/).

Verwandte Themen: [Generative Engine Optimization (GEO) erklärt](https://journali.de/2026/09/26/geo-generative-engine-optimization-erklaert/), [Model Context Protocol (MCP) erklärt](https://journali.de/2026/09/20/mcp-model-context-protocol-erklaert/).

## Häufige Fragen

### Was ist Retrieval-Augmented Generation (RAG)?

Retrieval-Augmented Generation (RAG) ist ein Ansatz, der eine Suche in eigenen Dokumenten mit der Textgenerierung eines Sprachmodells verbindet. Das Sprachmodell formuliert die Antwort, die Fakten kommen aus den gefundenen Auszügen der eigenen Dokumente, und jede Aussage verweist auf ihren Auszug.

### Wie funktioniert RAG?

RAG arbeitet in fünf Schritten: Dokumente werden in Abschnitte zerlegt, ein Einbettungsmodell rechnet aus jedem Abschnitt einen Vektor, die Vektoren werden in einem Index abgelegt, eine Frage wird mit demselben Modell eingebettet und mit den Abschnitten verglichen, und die ähnlichsten Auszüge gehen zusammen mit der Frage an ein Sprachmodell. Das Sprachmodell erhält die Anweisung, nur aus diesen Auszügen zu antworten und anzugeben, aus welchem Auszug eine Aussage stammt.

### Muss das Sprachmodell für RAG neu trainiert werden?

Für RAG muss das Sprachmodell nicht neu trainiert werden. Das Wissen steht in einem externen Index, und wird dieser Index gegen einen neueren ausgetauscht, ändert sich das Wissen des Systems, ohne dass das Modell neu trainiert wird.

### Verhindert RAG Halluzinationen?

RAG senkt das Risiko von Halluzinationen, beseitigt es aber nicht. Auch mit passenden Auszügen kann ein Sprachmodell Aussagen ergänzen, die dort nicht stehen, oder Auszüge falsch kombinieren; die Quellenangabe je Aussage macht eine RAG-Antwort darum prüfbar.

### Was ist ein Einbettungsmodell bei RAG?

Ein Einbettungsmodell rechnet bei RAG aus einem Textabschnitt einen Vektor, eine Reihe von Zahlen, die die Bedeutung des Textes beschreibt. Texte mit ähnlicher Bedeutung erhalten ähnliche Vektoren, auch wenn sie keine Wörter gemeinsam haben. Damit eine Frage auf Deutsch auch einen englischen Abschnitt findet, braucht es ein mehrsprachiges Einbettungsmodell.

### Welche Daten gehören in einen RAG-Index für Produkte?

In einen RAG-Index für Produkte gehört je Produkt und Sprache ein Dokument mit Name, Pfad in der Struktur, Kennungen wie der Artikelnummer und allen gepflegten Werten samt Einheit. Dazu kommen Angaben zu Produkt, Variante und Sprache sowie der freigegebene Stand mit Datum, damit sich die Suche eingrenzen lässt und eine Antwort auf genau diesen Stand verweisen kann.

### Was hat ein PIM-System mit RAG zu tun?

Ein RAG-System gibt wieder, was in seinem Index steht, und die Qualität seiner Antworten hängt an den Produktdaten, die in den Index gehen. Darum werden die Produktdaten an einer Stelle gepflegt, in einem PIM-System, und nach einem Zeitplan von dort in den Index gegeben, statt aus verstreuten Dateien zusammengesucht zu werden. Im PIM-System journali schreibt das Plugin KI-Wissensbasis dafür als Job je Knoten und Sprache ein Dokument mit der freigegebenen Version und einem Link zurück zum Knoten.

*Erstellt mit Unterstützung von KI.*

## Quellen

- Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks (2020): [arxiv.org/abs/2005.11401](https://arxiv.org/abs/2005.11401)
