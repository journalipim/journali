---
title: Mehrere Server auf einer Datenbank
excerpt: journali läuft jetzt mit mehreren Servern auf derselben Datenbank — ein Hauptserver für die Systemjobs, Arbeitsserver für Oberfläche, Schnittstelle und eigene Jobs.
slug: multi-server
tags: [Betrieb, Server, Lizenz]
categories: [Entwicklung]
wp: 26
---
Eine journali-Instanz besteht aus einer Datenbank mit dem Journal und einem Server, der die Abbilder im Speicher hält und Oberfläche und Schnittstelle bedient. Ab sofort dürfen mehrere Server auf dieselbe Datenbank zugreifen: etwa einer im Rechenzentrum und einer am Standort eines Teams, oder ein zweiter, der große Importe übernimmt, ohne die Oberfläche der anderen zu bremsen.

## Hauptserver und Arbeitsserver

Jeder Server hat eine von zwei Rollen.

- **Hauptserver**, genau einer: führt die Systemjobs aus (Vorschauen der Medien, Text aus Dokumenten, Einbettungen, Bildabmessungen), frischt die Lizenz auf und gleicht die Limits ab.
- **Arbeitsserver**, so viele die Lizenz erlaubt: bedienen Oberfläche und Schnittstelle und führen ihre eigenen Jobs aus.

Ein Job gehört dem Server, auf dem er angelegt wurde. Dort laufen sein Zeitplan und der Start von Hand, mit den Verzeichnissen, Fächern und Zugängen dieses Servers — ein Pfad meint immer die Platte, auf der der Job läuft. Starten, anhalten und abbrechen lässt sich ein Job von jedem Server aus; der Auftrag geht an seinen Server. Geändert wird er nur dort.

## Verständigung über die Datenbank

Die Server sprechen nicht direkt miteinander. Oft erreichen sie einander gar nicht (Firewall, anderer Standort), die Datenbank erreichen dagegen alle. Ein Auftrag an einen anderen Server steht deshalb als Zeile in einer Tabelle, und ein Signal der Datenbank stößt den Empfänger an. Geht das Signal verloren, findet er den Auftrag bei der nächsten Abfrage zwei Sekunden später.

Was ein Server ins Journal schreibt, liest jeder andere nach wenigen Sekunden nach. Das Journal bleibt die eine Wahrheit; jeder Server baut seine Abbilder daraus.

Dass es nie zwei Hauptserver gibt, sichert eine Sperre in PostgreSQL: Nur wer als Hauptserver festgelegt ist und die Sperre hält, führt Systemjobs aus. Endet sein Prozess, gibt die Datenbank die Sperre frei.

## Einstellungen → Server

Der Reiter **⧉ Server** listet alle Server der Datenbank: Name, Rechner, Rolle, Version und Build, Stand des Journals, letzter Puls, laufende Jobs und ob gerade ein Import läuft. Ein Administrator legt dort den Hauptserver fest, gibt einem Server einen Namen, sperrt einen Server oder entfernt einen, der nicht mehr erreichbar ist. Eine abweichende Version ist markiert: Ein neuerer Server kann Einträge schreiben, die ein älterer noch nicht kennt.

![Screenshot: Einstellungen → Server mit Hauptserver und Arbeitsserver]()

Den Reiter gibt es erst, wenn die Lizenz mehr als einen Server erlaubt.

## Wie viele Server laufen dürfen

- **Unlimited** erlaubt beliebig viele Server.
- **Jeder andere Tarif** erlaubt einen Server.
- Der **Zusatz Multi-Server** gibt weitere Server dazu. Er ist ein eigenes Produkt im Shop und lässt sich mit jedem Tarif kombinieren, auch mit Kostenlos. Er gilt für die ganze Instanz, gleich über welches Team er gekauft wurde.

Unter ⚿ Lizenz steht der Zusatz als eigene Zeile, mit der Zahl der zusätzlichen und der erlaubten Server.

![Screenshot: Lizenz mit der Zeile Zusatz Multi-Server]()

## Ein Server zu viel

Startet ein Server über die erlaubte Zahl hinaus, trägt er sich ein, führt aber keine Jobs aus und beantwortet keine Anfrage außer der nach seinem Zustand. Die Oberfläche zeigt dann nur eine Seite mit diesem Zustand — keine Anmeldung, keine Ansicht.

![Screenshot: Seite eines Servers ohne Lizenz]()

Welcher Server läuft, regelt eine feste Reihenfolge: zuerst der festgelegte Hauptserver, auch wenn er später startet als ein Arbeitsserver, danach die übrigen in der Reihenfolge ihres Starts.

Ein Server ohne Lizenz fragt den Lizenzserver selbst, gleich nach dem Start und danach alle fünf Minuten. Ist inzwischen ein Zusatz Multi-Server gekauft, arbeitet er beim nächsten Takt — ohne Neustart.

Ist nur ein Server erlaubt und läuft der festgelegte Hauptserver nicht, vertritt ihn der laufende Server. Festgelegt bleibt der Hauptserver aus den Einstellungen; sobald mehrere Server erlaubt sind, ist er wieder Hauptserver.

Auch die Einrichtung prüft das: Laufen auf einer Datenbank schon so viele Server, wie die Lizenz erlaubt, speichert der Einrichtungsdialog eines weiteren Servers die Verbindung nicht und nennt den Server, der dort läuft.

## Was für alle gleich ist

Der Medienspeicher ist für alle Server derselbe; seine Einstellung steht im Tresor der Datenbank. Das Kontingent zählt über alle Server. Je Server gelten nur die Schutzmaßnahmen des eigenen Prozesses, etwa die Begrenzung der Anmeldeversuche.

Noch offen: Eingänge, die im Fach eines Jobs auf einem anderen Server warten, zeigt die Oberfläche als „auf Server …“, nicht als Dateiliste.
