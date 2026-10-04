---
title: Jobs im Server – Importe, Exporte und Sicherungen laufen auch ohne offenes Browserfenster
excerpt: In journali laufen Importe, Exporte, Sicherungen, Datenblätter und eigene Skripte als Jobs auf dem Server – nach Zeitplan oder auf Knopfdruck, mit Log, Zeitgrenze und Trockenlauf.
slug: jobs-im-server
tags: [Jobs, Betrieb, Import & Export]
categories: [Entwicklung]
wp: 73
---
Der große Import läuft – und dann klappt jemand den Laptop zu. **In journali ist das egal.** Importe, Exporte, Sicherungen und Datenblätter laufen als **Jobs im Server**, nicht im Browser. Ob irgendwo ein Fenster offen ist, spielt keine Rolle.

## Jeder Job ist ein eigener Prozess

Der Server startet jeden Job als **Kindprozess** – nie im Serverprozess selbst. Mit journali spricht der Job nur über die Schnittstelle, und zwar mit einem **Token, das genau für diesen einen Lauf gilt** und danach erlischt. Je Job läuft höchstens ein Lauf gleichzeitig.

Als Job läuft unter anderem:

- **Import und Export** für CSV, Excel und JSON
- **Import aus Solr**
- **Export nach Vorlage** und Übersetzung per XLIFF
- **Datenblätter** für einen ganzen Teilbaum
- die **Sicherung** des ganzen Systems
- und eure **eigenen Skripte**

## Zeitplan: so einfach oder so genau, wie ihr wollt

Der Zeitplan-Assistent kennt alles, was man braucht: nur von Hand, alle paar Minuten, stündlich, täglich, wöchentlich, monatlich. Aber auch *alle zwei Wochen montags und donnerstags um 06:30* oder *am 3. Sonntag im Monat*. Wer cron kennt, schreibt den Ausdruck direkt hinein.

Zeitpläne gibt es **ab Pro** – von Hand startet ihr jeden Job in jedem Tarif.

## Jeder Lauf mit Log

Jeder Lauf steht im Journal: Start, Ende, Dauer und Ergebnis – **ok, mit Warnungen, gescheitert, Zeitgrenze oder abgebrochen**. Das Log lest ihr direkt am Job, auch während der Lauf noch arbeitet.

- **Zeitgrenze** je Job, Vorgabe 60 Minuten. Ist sie erreicht, bricht journali den Lauf ab und schreibt das ins Log.
- **Abbrechen** geht jederzeit per Klick.
- **Trockenlauf**: Ein Import aus CSV, Excel oder JSON zählt vorher, wie viele Einträge er schreiben würde – **und schreibt nichts**. Dazu seht ihr, was euer Team in dieser Woche und diesem Monat noch schreiben darf.

## Fächer: in/ rein, out/ raus

Jobs, die Dateien verarbeiten, bekommen **Fächer auf dem Server**: `in/`, `done/`, `failed/` und `out/`. Legt euer ERP eine Datei in `in/`, nimmt der nächste Lauf sie auf und legt sie danach in `done/` oder `failed/` ab.

- **Nichts doppelt**: journali erkennt eine Datei am Inhalt, nicht am Namen. Kommt dieselbe Lieferung noch einmal, wird sie nicht ein zweites Mal importiert.
- **Halbe Dateien bleiben liegen**: Was in den letzten Sekunden noch geschrieben wurde, nimmt erst der nächste Lauf.
- **Ausgaben mit festem Namen**: Auf Wunsch liegt nach jedem gelungenen Lauf eine Kopie unter `<job>-latest` – für jeden, der die Datei regelmäßig abholt.
- **Aufbewahrung**: die letzten n Läufe oder n Tage. Wer will, legt Eingänge und Ausgaben zusätzlich im Medienspeicher ab.

## Dateien direkt von WebDAV oder FTP

Eingang und Ausgabe dürfen auch an einem **Zugang** liegen. Vor dem Lauf holt journali die passenden Dateien von WebDAV oder FTP ins Fach, nach dem Lauf legt es die Ausgaben dort ab. **Das Format-Plugin merkt davon nichts** – eine CSV über WebDAV ist dieselbe CSV wie eine vom Laufwerk. Passwörter liegen beim Server im Tresor: **nie im Journal, nie im Browser**.

## Systemjobs erledigen den Rest von selbst

Manches muss niemand planen. **Vorschauen rechnen, Bildabmessungen lesen, Dokumente durchsuchbar machen, Vektoren für die Suche nach Sinn** – das sind Systemjobs. Eingeschaltet arbeiten sie ab, was offen ist, ohne Zeitplan und ohne Knopfdruck.

Und **ein Import hat Vorfahrt**: Solange er läuft, halten die Systemjobs an. Was offen ist, bleibt offen und kommt danach dran.

## Jeder Job gehört einem Team

Was ein Job schreibt, geht auf das **Kontingent seines Teams**. Starten, anhalten und abbrechen darf ihn dieses Team oder ein Administrator. Und mit mehreren Servern läuft ein Job auf dem Server, auf dem ihr ihn angelegt habt, mit dessen Verzeichnissen und Zugängen.

## Eure eigenen Skripte als Job

Mit **scriptum** schreibt ihr Skripte direkt in der Oberfläche: Auswertungen über Systemgrenzen, eigene Umwandlungen, Übergaben an Fremdsysteme. Das Skript steht **im Journal** – versioniert und in der Sicherung enthalten. Gestartet wird es wie jeder Job: von Hand, nach Zeitplan oder **über die Schnittstelle von einem anderen System aus**. Dasselbe Log, dieselbe Zeitgrenze, dieselben Fächer. Das Ergebnis ist eine Tabelle, ein Text oder eine Datei in `out/`. Skripte gibt es **ab Pro+**.

## Und jetzt?

journali ist noch in Entwicklung – die Jobs im Server sind schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
