---
title: Das Journal – eure Single Source of Truth, in der keine Änderung verloren geht
excerpt: In journali ist jede Änderung ein nummerierter Eintrag mit Urheber und Zeitpunkt – auch das Datenmodell. Nichts wird überschrieben, nichts gelöscht, und jeder frühere Stand lässt sich nachrechnen.
slug: journal-single-source-of-truth
tags: [Journal, Architektur, Versionen]
categories: [Entwicklung]
wp: 68
description: In journali ist jede Änderung ein nummerierter Eintrag mit Urheber und Zeitpunkt. Nichts wird überschrieben, jeder frühere Stand lässt sich nachrechnen.
---
Ein Wert wird korrigiert, eine Übersetzung kommt dazu, ein Produkt wird freigegeben. Der neue Wert ersetzt einfach den alten? **Nicht in journali.** Jede Änderung ist ein neuer Eintrag im Journal – und dieses Journal ist die **Single Source of Truth** für alles, was in journali steht.

## Jede Änderung ist ein Eintrag

Ein Eintrag hält fest:

- **Nummer** – laufend und lückenlos ab 1
- **Zeitpunkt** – wann es passiert ist
- **Urheber** – ein Anwender, ein Import, das System
- **Strom** – wozu der Eintrag gehört, etwa ein Produkt
- **Typ und Inhalt** – was genau passiert ist: Wert gesetzt, Knoten umgehängt, Freigabe erteilt

Einträge werden nur angehängt. **Nie geändert, nie gelöscht** – auch ein Löschen ist selbst ein Eintrag. Alles, was ihr in einer Aktion speichert, ob Import oder Sitzung in der Massenbearbeitung, trägt dieselbe Stapelkennung.

## Der aktuelle Stand ist abgeleitet

Was ihr im Baum, in der Tabelle oder in der Knotenansicht seht, sind **Abbilder**: aus den Einträgen gebaut und bei jedem neuen Eintrag sofort nachgezogen. Speichern heißt in journali: erst der Eintrag ins Journal, dann das Abbild – in einem Schritt, unter einer Sperre. Niemand sieht einen Stapel halb.

Und weil die Abbilder nur abgeleitet sind, gilt: **Ein Abbild wird neu gebaut, nie repariert.** journali liest das Journal noch einmal – und der Stand stimmt wieder.

## Auch das Datenmodell steht im Journal

Sprachen, Kanäle, Attribute, Attributgruppen, Einheiten, Wertelisten, Sichten, Status – **das Modell steht im Journal, nie im Code.** Jede Definition ist ein Eintrag mit Nummer, Zeitpunkt und Urheber, genau wie ein Wert. Selbst die eingebauten Vorgaben eines neuen Systems kommen als Einträge des Urhebers `system` hinein.

Das Schöne daran: Ein Stand von damals bringt **sein Modell von damals** mit. Zieht ihr heute ein Attribut zurück, bleiben seine Werte im Journal erhalten.

## Wie sah das Produkt bei Eintrag #n aus?

Den Stand bei einem beliebigen Eintrag rechnet journali aus dem Journal nach – Baum und Modell, genau so, wie sie damals waren. Das steckt schon heute in mehreren Funktionen:

- **Versionen**: Eine Freigabe erzeugt eine Version – ein Zeiger auf den Journalstand plus die Dokumente, die nach draußen gingen. journali vergleicht die Werte von damals mit denen von heute.
- **Eingefrorene Publikation**: Eine Rubrik lässt sich auf einen Journalstand festsetzen. Die Publikation liest die Pflege dann wie zu diesem Zeitpunkt – **ohne eine einzige Kopie**.
- **Verlauf**: Zu jedem Wert steht, wer ihn wann gesetzt hat und was vorher galt.

Unter ≡ Journal seht ihr alle Einträge, die neuesten oben – filterbar nach Strom, Typ, Name und Inhalt und nach Art: Pflege, Ausleitung, Modell, Struktur, Referenz, Einrichtung, Betrieb.

## Rückgängig ist ein Schritt nach vorn

↶ nimmt den letzten Stapel zurück, ↷ wiederholt ihn. **Beides sind neue Einträge** – das Journal bleibt vollständig, und auch das Rückgängig lässt sich wieder zurücknehmen.

Ein zurückgezogener Knoten kommt in den Papierkorb und von dort mit allem zurück, was er hatte: Werte, Gruppen, Kennungen. Und das Zurückrollen auf eine frühere Version? Ein Stapel mit den Werten von damals – **ein Schritt vorwärts, kein Löschen.**

## Schneller Start, auch wenn das Journal wächst

Ein Journal wird lang. Damit der Start nicht mit ihm wächst, hält journali zwei Kopien bereit:

- Der **Spiegel** hält die Journaleinträge als Datei neben dem Server. Beim Start kommt alles bis zum Spiegelstand von der Platte, nur der Rest aus der Datenbank.
- Der **Schnappschuss** hält den Stand aller Abbilder. journali lädt ihn und wendet nur die Einträge an, die danach kamen. Er übersteht sogar ein Update, solange sich die Logik der Abbilder nicht ändert.

Beide sind **nur Cache**: journali prüft sie gegen die Datenbank, und passt etwas nicht, wird wie gewohnt aus dem Journal gelesen. Ihr könnt beide jederzeit wegwerfen – die Single Source of Truth bleibt das Journal.

## Daten abholen ohne „geändert seit“

Wer Daten aus journali abholt, merkt sich die Nummer des zuletzt gelesenen Eintrags und fragt beim nächsten Mal nur nach dem, was danach kam. **Kein Änderungsdatum, das jemand vergessen kann zu setzen** – die Nummer ist lückenlos, und jede Änderung hat eine.

## Und jetzt?

journali ist noch in Entwicklung – das Journal ist von Anfang an die Grundlage von allem. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
