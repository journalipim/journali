---
title: Integration – journali spricht mit eurer Tabelle, euren Quellsystemen und euren Skripten
excerpt: Pflegen direkt in Excel oder OnlyOffice, Quellsysteme und Solr-Kerne als Plugins, JSON per Job und eine REST-Schnittstelle, die sich selbst beschreibt – journali ist offen nach allen Seiten.
slug: integration
tags: [Integration, REST API, Excel, Import & Export]
categories: [Entwicklung]
wp: 75
description: Integration: Pflegen in Excel oder OnlyOffice, Quellsysteme und Solr als Plugins, JSON per Job und eine REST-Schnittstelle – offen nach allen Seiten.
keyphrase: Integration
---
Produktdaten kommen aus einem Quellsystem, werden in Tabellen gepflegt und gehen an Shops, Portale und Skripte weiter. **journali spricht mit all dem – und zwar über eine einzige Schnittstelle.**

## Pflegen in der Tabelle, speichern im Journal

Ihr arbeitet am liebsten in der Tabelle? Dann bleibt ihr dort. Das **Excel-Add-in** und das **OnlyOffice-Plugin** öffnen einen Bereich direkt neben dem Blatt:

1. Knoten suchen – nach Name, SKU oder Id.
2. Subitems, alle Varianten oder alle Produkte darunter ins Blatt laden – in der Sprache und mit der Sicht eurer Wahl.
3. Pflegen mit dem, was die Tabelle kann: ausfüllen, Reihen, Formeln, Suchen & Ersetzen.
4. **Geändertes speichern** – journali vergleicht mit dem Stand beim Laden und schreibt **nur die geänderten Zellen, als einen Stapel**.

Geerbte Werte erscheinen kursiv. Die Mappe dürft ihr zwischendurch speichern und später weiterpflegen – der Stand beim Laden liegt in der Datei. Das Add-in läuft in Excel für Windows und Excel im Web, das Plugin in den OnlyOffice Desktop Editors und in OnlyOffice Docs.

## Daten aus Solr übernehmen

Eure Daten liegen heute in einem Solr-Index? Das Plugin **Solr** holt sie herüber – und schreibt dabei nur über die Schnittstelle.

- **Den fremden Baum sehen**: aufklappen, Knoten anschauen, Teilbäume anhaken, Ziel wählen.
- **Erst analysieren, dann schreiben** – im Trockenlauf schreibt es gar nichts.
- **Der zweite Lauf aktualisiert**: Jeder Knoten kennt seine externe Kennung. Beim nächsten Import entstehen keine Dubletten, und es schreibt nur die Werte, die sich unterscheiden.
- **Große Bestände?** Derselbe Ablauf läuft als Job auf dem Server – unabhängig von einem offenen Browserfenster. Solr bringt auf Wunsch auch die Relationen mit.

## JSON per Job – vom Laufwerk oder per HTTP

Der **JSON-Import** spielt Rohdaten als Job ein: aus einer Datei, aus der neuesten Datei eines Verzeichnisses oder **direkt von einer URL**, auf Wunsch komprimiert als `.json.gz`. Ein Profil legt Zuordnung, Präfix und Ziel fest. Und weil es ein Job ist, gibt es **Zeitplan, Log und Zeitgrenze** gleich dazu.

## Zugänge: einmal einrichten, von jedem Plugin nutzbar

Adresse, Anmeldung, Passwort – das gebt ihr **einmal** ein, unter ⌁ Zugänge. Danach fragt ein Plugin einfach nach einem Zugang seiner Art.

- **Dateien liefern** das Dateisystem des Servers, **WebDAV** und **FTP** – jeweils mit eigenem Dateibrowser. Die Fächer eines Jobs dürfen dort liegen: Vor dem Lauf holt journali den Eingang ab, danach legt es die Ausgabe dort ab. Eine Datei, die schon verarbeitet wurde, erkennt journali am Inhalt und spielt sie nicht noch einmal ein.
- **Anmeldungen**, etwa für Solr.

**Das Geheimnis bleibt beim Server.** Es steht nicht im Journal und geht nie an den Browser – die Oberfläche kennt nur den Namen des Zugangs. Liest eine Ansicht die Quelle, meldet sich der Server dort an und reicht die Antwort weiter. Die Anmeldedaten selbst bekommt nur ein Job-Prozess auf dem Server.

## Eine REST-Schnittstelle für alles

journali ist headless: **Die Oberfläche ruft dieselbe Schnittstelle unter `/api`, die auch euer System ruft.** Einen zweiten Weg zu den Daten gibt es nicht.

- **OpenAPI 3.0** unter `/api/openapi.json` – erzeugt aus den Endpunkten des laufenden Servers. Die Beschreibung kann also nicht veralten. Zu jedem Aufruf steht dabei, welches Recht er braucht.
- **API-Token je Person**: unter ◐ Mein Account angelegt, nur beim Anlegen sichtbar, jederzeit widerrufbar. Ein Token arbeitet mit den Rechten seiner Person – nicht mit mehr. Genau damit melden sich auch das Excel-Add-in und das OnlyOffice-Plugin an.

```
curl -H "Authorization: Bearer $TOKEN" https://<server>/api/tree
```

## Eigene Prozesse, sauber getrennt

**Prozess-Plugins** laufen als Kindprozess des Servers, nie im Serverprozess selbst, und sprechen ebenfalls nur über `/api`. Jeder Lauf bekommt ein eigenes Dienst-Token, das mit dem Lauf erlischt. Eine neue Anbindung ist ein Verzeichnis mit einer `plugin.json`: Befehl, Parameter, fertig.

## Und jetzt?

journali ist noch in Entwicklung – Add-ins, Zugänge und Schnittstelle stecken schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
