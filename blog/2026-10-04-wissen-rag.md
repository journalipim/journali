---
title: RAG – wie KI-Assistenten aus eigenen Daten antworten und welche Rolle Produktdaten dabei spielen
excerpt: Retrieval-Augmented Generation lässt ein Sprachmodell aus gefundenen Auszügen eigener Dokumente antworten, mit Quelle – wie gut das gelingt, hängt vor allem an der Qualität der Daten, aus denen gesucht wird.
slug: rag-retrieval-augmented-generation-erklaert
tags: [KI, RAG, Suche, Versionen]
categories: [Wissen]
wp: 102
---
Ein KI-Assistent, der Fragen zu Produkten beantwortet, klingt nach einer einfachen Aufgabe. In der Praxis scheitert er oft an zwei Stellen: Das Sprachmodell kennt die Produkte nicht, und es sagt nicht, woher eine Antwort stammt. **Retrieval-Augmented Generation (RAG)** setzt an beiden Stellen an. Der Ansatz verbindet eine Suche in eigenen Dokumenten mit der Textgenerierung eines Sprachmodells.

## Woher es kommt: Sprachmodelle wissen viel, aber nicht das Richtige

Ein großes Sprachmodell lernt aus Texten, die bis zu einem bestimmten Zeitpunkt gesammelt wurden. Daraus ergeben sich drei Grenzen:

- **Fester Wissensstand.** Was nach dem Training entstanden ist, kennt das Modell nicht. Ein neues Produkt, ein geänderter Preis, eine überarbeitete Norm fehlen.
- **Keine Firmendaten.** Interne Datenblätter, Pflegedaten und Anleitungen waren nie Teil der Trainingsdaten.
- **Halluzinationen.** Ein Modell erzeugt auch dann einen flüssigen Text, wenn ihm das Wissen fehlt. Das Ergebnis kann plausibel klingen und trotzdem falsch sein.

Ein Forschungsbeitrag aus dem Jahr 2020 trägt den Begriff im Titel. Er beschreibt die Grenzen großer vortrainierter Sprachmodelle so: Sie können auf ihr Wissen nicht gezielt zugreifen, sie können nicht belegen, woher eine Aussage stammt, und ihr Wissen lässt sich nur schwer aktualisieren. Der Vorschlag: Das im Modell gespeicherte Wissen wird um einen **externen Index** ergänzt, in dem ein Suchverfahren passende Textabschnitte findet. Im Beitrag war das eine Enzyklopädie, zerlegt in rund 21 Millionen Abschnitte zu je 100 Wörtern. Ein Ergebnis der Arbeit: Wird der Index gegen einen neueren ausgetauscht, ändert sich das Wissen des Systems, **ohne dass das Modell neu trainiert wird**.

### Das Prinzip in fünf Schritten

1. **Zerlegen.** Dokumente werden in Abschnitte geteilt, etwa nach Überschriften oder Absätzen.
2. **Einbetten.** Ein Einbettungsmodell rechnet aus jedem Abschnitt einen **Vektor**: eine Reihe von Zahlen, die die Bedeutung des Textes beschreibt. Texte mit ähnlicher Bedeutung erhalten ähnliche Vektoren, auch wenn sie keine Wörter gemeinsam haben.
3. **Ablegen.** Die Vektoren werden in einem Index gespeichert, der schnelle Ähnlichkeitssuche erlaubt.
4. **Suchen.** Eine Frage wird mit demselben Modell eingebettet. Gesucht werden die Abschnitte, deren Vektoren dem Vektor der Frage am nächsten liegen.
5. **Antworten.** Die gefundenen Auszüge gehen zusammen mit der Frage an ein Sprachmodell. Die Anweisung lautet, nur aus diesen Auszügen zu antworten und anzugeben, aus welchem Auszug eine Aussage stammt.

Das Sprachmodell formuliert, die Fakten kommen aus den eigenen Dokumenten. **Damit verschiebt sich die Frage, ob eine Antwort stimmt, vom Modell auf die Daten.**

## Was es schwierig macht: Die Antwort ist nur so gut wie die Daten im Index

Ein RAG-System lässt sich schnell aufsetzen. Verlässliche Antworten liefert es erst, wenn die folgenden Punkte gelöst sind.

**Datenqualität und Aktualität.** Das Modell gibt wieder, was im Index steht. Enthält er veraltete Datenblätter, widersprüchliche Angaben oder drei Fassungen derselben Anleitung, enthält die Antwort dieselben Fehler – jetzt mit einer Quellenangabe, die sie glaubwürdig wirken lässt. Ein Index, der einmal befüllt und dann nicht nachgeführt wird, hat dasselbe Problem wie das Sprachmodell selbst: einen festen Wissensstand.

**Zerlegung in Abschnitte.** Zu kurze Abschnitte verlieren den Zusammenhang; zu lange behandeln mehrere Themen, und ihr Vektor beschreibt keines davon genau. Tabellen in Datenblättern, Fußnoten und Kopfzeilen sind schwer sinnvoll zu teilen. Ein Abschnitt „Technische Daten“ ohne den Produktnamen ist für die Suche kaum zuzuordnen.

**Metadaten.** Ein Textabschnitt allein sagt nicht, zu welchem Produkt, welcher Variante oder welcher Sprache er gehört. Ohne diese Angaben lässt sich die Suche nicht eingrenzen, und die Antwort kann Werte zweier ähnlicher Produkte vermischen.

**Versionen und Gültigkeit.** Produktdaten ändern sich. Eine Antwort sollte sich auf den Stand beziehen, der freigegeben ist und heute gilt – nicht auf einen Entwurf und nicht auf ein Dokument, dessen Gültigkeit abgelaufen ist.

**Rechte.** Nicht jede Information ist für jeden Empfänger bestimmt. Interne Kalkulationen oder unveröffentlichte Produkte gehören nicht in einen Index, aus dem ein Händlerportal antwortet.

**Mehrsprachigkeit.** Eine Frage auf Deutsch soll auch einen englischen Abschnitt finden, und die Antwort soll in der Sprache der Frage kommen. Dazu braucht es ein mehrsprachiges Einbettungsmodell und Inhalte, die je Sprache sauber getrennt vorliegen.

**Halluzinationen trotz RAG.** Auch mit passenden Auszügen kann ein Modell Aussagen ergänzen, die dort nicht stehen, oder Auszüge falsch kombinieren. Die Anweisung, nur aus den Auszügen zu antworten, senkt das Risiko, beseitigt es aber nicht.

**Nachvollziehbarkeit.** Darum ist die **Quellenangabe** der eigentliche Gewinn: Jede Aussage verweist auf einen Auszug, jeder Auszug auf ein Dokument, eine Seite und einen Stand. Wer die Antwort prüfen will, kann es.

## Wen es betrifft: alle, die Fragen zu Produkten beantworten

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

**Der Export für eigene Systeme.** Das Plugin **KI-Wissensbasis** schreibt als Job **je Knoten und Sprache ein Markdown-Dokument** sowie eine Datei `nodes.jsonl` mit einer Zeile je Dokument. Das Dokument enthält Name, Art des Knotens, Pfad im Baum, die Schlüssel und jedes gepflegte Attribut mit Bezeichnung, Wert und Einheit – geerbte Werte eingeschlossen, Formeln ausgerechnet, Listenwerte als lesbare Bezeichnung. Dazu kommen die **freigegebene Version** mit Nummer, Journalstand und Datum, die Belege dieser Version und der Text der Dokumente am Knoten mit Seite und Überschrift. Ausgeleitet werden nur Medien, die gültig und freigegeben sind. Jede Zeile der `nodes.jsonl` trägt einen Link zurück zum Knoten in journali. Der Job liest alles über die API von journali. Details stehen im Beitrag [RAG-ready](/?p=46).

**Die Suche in journali selbst.** Das Plugin **embed** rechnet je Abschnitt eines Dokuments und je Knoten einen Vektor mit 384 Zahlen – mit einem mehrsprachigen Modell, **lokal auf dem eigenen Server und ohne Grafikkarte**. Die Vektoren liegen in derselben PostgreSQL-Datenbank wie alle anderen Daten, über die Erweiterung pgvector. Sie sind aus Text und Modell jederzeit neu zu berechnen; neu eingebettet wird nur, was sich geändert hat. Die Suche kann Wortsuche und Ähnlichkeitssuche verbinden: Was in beiden Ergebnislisten weit vorn steht, steht vorn.

Die **Frage an die Dokumente** folgt dem beschriebenen Prinzip: Die besten Abschnitte gehen nummeriert an die KI des Teams, mit der Anweisung, nur aus diesen Auszügen zu antworten, jede Aussage mit der Nummer ihres Auszugs zu versehen und in einem Satz zu sagen, wenn die Auszüge keine Antwort enthalten. Die Antwort nennt zu jeder Nummer Dokument, Seite, Überschrift und die Produkte, an denen das Dokument hängt. Mehr dazu im Beitrag [Suche nach Sinn](/?p=34).

## Quellen

- Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks (2020): [arxiv.org/abs/2005.11401](https://arxiv.org/abs/2005.11401)
