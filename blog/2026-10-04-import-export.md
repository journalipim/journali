---
title: Rein, raus, wieder rein – Import und Export in journali
excerpt: CSV, Excel, JSON und die Zwischenablage: Der Datenmapper schlägt die Zuordnung vor, ein Plan zeigt vor dem Schreiben, was neu und was geändert ist, und der JSON-Export bringt Daten samt Modell vollständig zurück.
slug: import-export
tags: [Import & Export, Excel, Jobs]
categories: [Entwicklung]
wp: 71
---
Die Lieferantenliste kommt als Excel, das ERP legt jede Nacht eine CSV ab, der Shop will morgens eine frische Datei. **In journali ist das kein Projekt, sondern ein paar Klicks** – und danach ein Job, der es nach Zeitplan selbst erledigt.

## Vier Wege hinein

- **CSV und TSV** – Trennzeichen und Zeichensatz erkennt journali selbst.
- **Excel** – .xlsx, .xls oder .ods, jedes Blatt wählbar.
- **JSON** – eine Liste von Objekten wird zur Tabelle, verschachtelte Felder werden zu Spalten.
- **Zwischenablage** – Bereich in Excel kopieren, in der Import-Ansicht **Strg+V**, fertig.

Die erste Zeile sind die Spaltennamen.

## Der Datenmapper ordnet für euch zu

Niemand ordnet 180 Spalten gern von Hand zu. Der **Datenmapper** erkennt eure Spalten an Schlüssel, Bezeichnung in jeder Sprache, Synonymen und ähnlichen Namen. Er liest die **Sprache aus dem Spaltennamen** – `name_de`, `Name (EN)`, `name.en` – und findet die Schlüsselspalten: journali-Id, SKU, externe Kennung, Elternteil. Für Spalten ohne passendes Attribut **schlägt er den Typ aus den Werten vor**: Zahl, Ja/Nein, Datum, Werteliste, Text.

Passt eine Spalte noch nicht ganz, bekommt sie eine **Umwandlungskette**:

- **Zahl** – aus „22 mm“ wird 22, aus „1.234,5“ wird 1234.5
- **Datum** – deutsch, ISO, US, Unix-Zeit oder Excel-Zahl
- **Ersetzen, Aufteilen, Spalten verbinden, Werte nach Tabelle, Bedingung, HTML entfernen**

## Erst der Plan, dann wird geschrieben

Bevor ein Wert im Journal steht, zeigt der **Plan**: wie viele Knoten neu sind, wie viele sich ändern und wie viele unverändert bleiben, welche Attribute und Listenwerte neu dazukommen – und **welche Werte nicht zum Typ passen**. Eine falsche Zelle korrigiert ihr direkt in der Quelle und analysiert neu.

Geschrieben wird erst auf Knopfdruck, **als ein Stapel**. Und weil journali nur schreibt, was sich wirklich geändert hat, erzeugt **derselbe Import ein zweites Mal keinen einzigen Eintrag**.

## Einmal einrichten, immer wieder nutzen

Zuordnung, Umwandlungen, Ziel im Baum und Rolle speichert ihr als **Profil**. Beim nächsten Mal: Profil wählen, Datei hinein, Plan ansehen, schreiben. Jedes Profil gehört zu seinem Dienst – ein Exportprofil steht nicht in der Importauswahl.

## Als Job: nach Zeitplan, im Server

Jeder Import und jeder Export wird unter ⏱ Jobs zum **Job mit Zeitplan** – stündlich, täglich, wöchentlich, monatlich oder als Ausdruck mit Minute, Stunde und Wochentag. Er läuft im Server, ob ein Browser offen ist oder nicht.

- Das ERP legt seine Datei ins Fach `in/`. Nach dem Lauf liegt sie in `done/` – oder in `failed/`, mit dem Log daneben.
- **Dieselbe Datei zweimal? journali erkennt sie am Inhalt** und spielt sie nicht noch einmal ein.
- Exporte landen in `out/`, die letzten Stände bleiben, auf Wunsch zusätzlich als `latest` unter festem Namen.
- Beim Import rechnet der **Trockenlauf** nur und schreibt nichts.

## Vier Achsen, sauber getrennt

| Achse | Was | Wo es steht |
|---|---|---|
| Format | CSV, Excel, JSON | das Plugin |
| Transport | Dateisystem, HTTP, WebDAV, FTP | Pfad, URL oder Zugang |
| Inhalt | Zuordnung, Teilbaum, Sprachen, Sicht | das Profil |
| Ablage und Zeit | Verzeichnis, Dateiname, Zeitplan | der Job |

Das heißt: **Dasselbe Profil schreibt wöchentlich in das eine und täglich in ein anderes Verzeichnis.** Und eine CSV über WebDAV ist dieselbe CSV wie eine vom Laufwerk.

## Raus, so wie ihr es braucht

Der Tabellenexport liefert einen Teilbaum als **Excel oder CSV**: Rollen, Sprachen, Sicht, eigene oder auch geerbte Werte. **Der Import liest genau diese Datei wieder ein** – mit Kennungen. In Excel kommen auf Wunsch die Relationen als zweites Blatt dazu; der Import legt sie wieder an, auch in einem anderen System. Ein Export-Job nimmt statt eines Teilbaums auch einen Publikationsbaum – dann geht hinaus, was für den Kanal freigegeben ist. BMEcat mit ETIM und die KI-Wissensbasis haben eigene Beiträge: [ETIM](/?p=42), [RAG-ready](/?p=46).

## JSON: alles raus, alles wieder rein

Der JSON-Export in der Form **Rohdaten** enthält den Teilbaum so, wie ihr ihn gepflegt habt: eigene Werte je Sprache und Kanal, Formeln als Skript, Status, Kennungen, Relationen – und **den Teil des Modells, den der Teilbaum benutzt**: Gruppen, Attribute, Listen, Einheiten, Relationstypen.

**Exportieren, löschen, wieder importieren – und der Teilbaum ist wieder da, mit denselben Ids.** In ein anderes System eingespielt, bringt die Datei ihre Definitionen gleich mit; der Import-Manager schlägt dort die Zuordnung vor und versieht neue Attribute auf Wunsch mit einem Präfix. Eure Produktdaten und euer Modell liegen damit jederzeit in einer offenen Datei vor, auf Wunsch gzip-komprimiert.

## Und jetzt?

journali ist noch in Entwicklung – Import und Export stecken schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
