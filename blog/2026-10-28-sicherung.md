---
title: Sicherung – neuer Server, Sicherung rein, journali steht
excerpt: Eine Vollsicherung per Knopfdruck oder als Job mit Zeitplan, zurück in ein leeres System – und weil im Journal nie etwas überschrieben wird, baut der Server alle Abbilder daraus von selbst neu.
slug: sicherung
tags: [Betrieb, Jobs, Journal, Architektur, PostgreSQL]
categories: [Entwicklung]
date: 2026-10-28 06:00
wp: 159
---
Der Server ist weg. Festplatte defekt, Umzug auf neue Hardware oder ein Update, das schiefgelaufen ist. Bei vielen Systemen beginnt jetzt ein Wochenende aus Datenbank-Dump, Dateikopien und der Frage, was man vergessen hat. **Bei journali startet ihr einen neuen Server, spielt die Sicherung ein und startet neu.** Dann steht das System wieder da – mit allen Einträgen, Medien, Zugängen und Plugins.

## Eine Sicherung ist ein Verzeichnis

Die Vollsicherung schreibt ein Verzeichnis auf den Server. Darin liegen:

- das **Journal** mit jedem Eintrag, eine Zeile je Eintrag, mit Nummer, Zeit und Urheber,
- die **Assets** nach Prüfsumme – alles, was in der Datenbank liegt,
- die **Zugänge**: Anmeldungen und Passwort-Hashes, Token, Speicher- und Mail-Einstellungen, Geheimnisse der Jobs,
- die **Plugin-Verzeichnisse**,
- eine kleine Beschreibung: Zeitpunkt, Anzahl der Einträge, Art des Speichers.

Das Format **hängt an nichts**: nicht an der Postgres-Version, nicht am Schema, nicht am Treiber des Medienspeichers. Ihr könnt es lesen, kopieren und ablegen, wo ihr wollt.

## Von Hand: ein Knopf in B&R

Unter ⚙ Einstellungen → ⇅ B&R wählt ihr ein Verzeichnis auf dem Server. Bevor ihr etwas tut, **zeigt journali beide Seiten**: was dieses System hat – Einträge, Assets, Speicher – und was im Verzeichnis liegt: Einträge, Assets, Dateien, Plugins und den Zeitpunkt der Sicherung.

Mit drei Häkchen entscheidet ihr, was mitgeht: **Assets, Zugänge, Plugins**. Dann **⇩ Sichern**.

## Nach Zeitplan: das Plugin Sicherung

Wer nicht jeden Abend daran denken will, nimmt das **Plugin Sicherung** und lässt es als Job laufen. Zeitplan wie bei jedem Job – täglich, wöchentlich oder so genau, wie ihr es braucht. Je Lauf entsteht **ein Ordner mit Zeitstempel**. Wie viele Stände ihr behalten wollt, stellt ihr ein (Vorgabe: 14), ältere räumt der Job selbst weg. Wohin gesichert wird, steht am Job: im Verzeichnis eurer Wahl oder im Fach `out/` des Jobs.

Es ruft denselben Weg auf wie der Knopf – von Hand und nach Zeitplan entsteht also dieselbe Sicherung.

## Zurück in ein leeres System

Neuer Container, leere Datenbank, **↺ Einspielen**. journali zeigt vorher, was kommt: Einträge, Medien, Dateien, Plugins und von wann die Sicherung ist. Nach der Bestätigung spielt der Server alles ein, und die Einträge kommen **mit ihren alten Nummern, Zeiten und Urhebern** zurück. Die Zählung läuft danach normal weiter.

Zwei Dinge sind Absicht:

- **Eingespielt wird nur in ein leeres System.** Sonst kollidierten die Eintragsnummern. Ist das System nicht leer, bleibt der Knopf aus und sagt, wie viele Einträge schon da sind.
- **Was schon da ist, wird nicht überschrieben.** Zugänge und Plugin-Verzeichnisse, die im neuen System bereits stehen, bleiben, wie sie sind.

Danach startet ihr den Server einmal neu. Plugins mit eigenen Paketen brauchen einmal `npm install` – die Pakete sind für ein Betriebssystem gebaut und gehören darum nicht in die Sicherung.

## Warum das so einfach geht

Der Grund steht im Kern von journali: **Im Journal wird nie etwas überschrieben.** Jede Änderung ist ein neuer Eintrag, hinten angehängt. Das Journal ist die einzige Wahrheit – alles andere, der Baum, das Modell, die Suche, ist ein **Abbild**, das sich jederzeit löschen und aus dem Journal neu bauen lässt.

Für die Sicherung heißt das: **Für alles Fachliche genügt das Journal.** Kein Stand von Tabellen, die zueinander passen müssen, keine Zwischenergebnisse. Modell, Baum, Werte, Rollen und Rechte, Workflows, Jobs und der Stand der Plugins stehen als Einträge im Journal und kommen damit zurück. Beim Start baut der Server seine Abbilder daraus neu – das ist derselbe Weg, den er bei jedem Start geht.

Auch eine Testinstanz neben der Produktion ist dadurch kein Aufwand: Ihr spielt eine Sicherung der Produktion in die leere Testinstanz ein. Sie bekommt ihre eigene Kennung.

## Spiegel und Schnappschuss: schneller Start, nie die Wahrheit

Zwei Kopien machen den Start schnell, beide sind **nur Cache**:

- Der **Spiegel** hält die Journaleinträge als Datei neben dem Server. Beim Start kommt alles bis zum Spiegelstand von der Platte, nur der Rest aus der Datenbank. Der letzte Eintrag wird dabei gegen die Datenbank geprüft – stimmt etwas nicht, liest journali alles neu.
- Der **Schnappschuss** hält den Stand aller Abbilder. Beim Start lädt journali ihn und wendet nur an, was danach dazukam.

Beide lassen sich unter ▨ Storage → Start ein- und ausschalten und **jederzeit wegwerfen**. Der nächste Start liest dann neu aus dem Journal. Es kann nichts verloren gehen, was nicht ohnehin im Journal steht.

## Auch ein einzelner Teilbaum kommt zurück

Nicht jeder Fall ist ein totaler Ausfall. Ein **Teilbaum aus einem JSON-Export** lässt sich auch in ein **volles System** einspielen – mit Modellteil. **Prüfen** zeigt vorher, wie viele Knoten neu wären, wie viele angeglichen und wie viele zurückgeholt würden; erst danach schreibt ihr.

## Gut zu wissen

- **Medien in einem Verzeichnis oder in S3** sichert der Betrieb des Servers; journali sagt es beim Sichern. Die Verweise stimmen nach der Wiederherstellung trotzdem, solange der Speicher derselbe bleibt: Im Journal steht der Hash, und der Hash ist der Schlüssel im Speicher.
- Mit **Zugängen** enthält die Sicherung Passwort-Hashes und Token. Legt sie dorthin, wo auch das Datenverzeichnis hingehört.
- Wer die Datenbank mit **eigenen Mitteln** sichert, findet ihre Verbindung unter ⇅ B&R → ⛁ Datenbank. Das Passwort ist verdeckt und erscheint erst, wenn ihr euer eigenes Anmeldepasswort eingebt, und nur für eine Minute.

## Und jetzt?

journali ist noch in Entwicklung – Sichern und Wiederherstellen sind schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
