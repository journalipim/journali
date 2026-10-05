---
title: KI in journali – euer Schlüssel, euer Anbieter, euer letztes Wort
excerpt: journali bindet die KI eures Teams an – Anbieter nach Wahl, Schlüssel sicher beim Server. Und vieles läuft ganz ohne KI-Anbieter, direkt auf eurem Server.
slug: ki-in-journali
tags: [KI, Datenqualität, Übersetzung, Suche]
categories: [Entwicklung]
wp: 45
---
Eine KI im PIM ist nur so gut wie die Daten, die sie bekommt – und die Kontrolle, die ihr darüber behaltet. **journali gibt der KI eure echten Produktdaten und euch das letzte Wort.** Kein Vorschlag landet ungefragt im Journal.

## Euer Schlüssel, euer Anbieter

journali bringt keine eigene KI mit und bevorzugt keinen Anbieter. **Ihr hinterlegt den Schlüssel eures Anbieters am Team** – unter Einstellungen → ◍ Team → ✧ KI API Keys. Je Anbieter eine Zeile: Zugang, Modell und ein Schalter, welcher Anbieter gefragt wird. Euer Vertrag bleibt euer Vertrag: abgerechnet wird beim Anbieter.

Ein Team rechnet über ein anderes ab? Dann nutzt es dessen Schlüssel – die Einstellungen zeigen, von welchem Team er kommt.

## Der Schlüssel bleibt beim Server

Gefragt wird **immer über den Server**. Der Schlüssel liegt verschlüsselt im Tresor – **nie im Journal, nie im Browser**. Die Oberfläche sieht nur, *dass* ein Schlüssel hinterlegt ist.

Und weil der Server fragt, können sogar **Jobs die KI nutzen** – mit dem Token ihres Laufs.

## Wo die KI mit anpackt

- **Texte im Editor** – ✦ KI am Textfeld: verbessern, kürzen, ausführlicher – oder neu aus den Produktdaten: als Liste, als sachlicher, emotionaler oder vergleichender Marketingtext. Nur Fakten aus den Produktdaten, keine erfundenen Eigenschaften.
- **Anreicherung** – fehlende Attributwerte für einen ganzen Teilbaum: die KI schlägt vor, wahlweise mit **Recherche im Internet** (Hersteller, Typ, EAN → Datenblatt), je Wert mit Sicherheit und Quelle.
- **Digitaler Produktpass und Verpackung (PPWR)** – für leere Datenpunkte schlägt die KI Werte vor, mit Sicherheit und Begründung, auf Wunsch aus der Recherche im Netz.
- **Datenblätter lesen** – die KI liest ein technisches Dokument gegen die Attribute, die am Knoten gelten, und nennt je Wert **Seite, Stelle und Sicherheit**. Was zu keinem Attribut passt, geht durch den Mapper.
- **Klassifikation** – ETIM-Klasse oder GPC-Brick: die KI schlägt aus Name und Pfad passende Kandidaten vor.
- **Übersetzung** – das Plugin Übersetzung (XLIFF) übersetzt offene Einheiten vor, **mit eurem Glossar als verbindlicher Vorgabe**. HTML-Struktur, Zahlen, Einheiten, Marken- und Produktnamen bleiben, wie sie sind.
- **GEO-Texte** – Definitionssatz, Kurzbeschreibung, Fragen & Antworten, Suchbegriffe und Schema.org-JSON-LD aus euren echten Produktdaten. Dazu eine KI-Analyse des Knotens mit offenen Nutzerfragen und Empfehlungen.
- **Die Frage an die Dokumente** – ihr fragt in normaler Sprache, die KI antwortet **nur aus euren Dokumenten**, jede Aussage mit Quelle. Steht es nicht drin, sagt sie das.

## Ihr habt das letzte Wort

Die KI schlägt vor, ihr entscheidet. Vorschläge der Prüfungen hakt ihr ab, die Werte aus einem Datenblatt schreibt journali erst mit ✓, ein Text aus dem Editor landet im Entwurf und wird erst mit Speichern gespeichert. **Jeder übernommene Wert trägt seinen Beleg** – Quelle, Dokument, Seite, Stelle.

## Vieles läuft ganz ohne KI-Anbieter

- **Regelbasierte Vorschläge** in DPP und PPWR – aus vorhandenen Werten abgeleitet.
- **Tabellen aus Datenblättern** – Schlüssel/Wert-Zeilen ordnet der Mapper zu, ohne KI.
- **GEO-Prüfregeln und GEO-Reife** – erkennen Texte, die für Suchmaschinen und KI-Antworten nicht taugen, und bewerten jedes Produkt. Ohne KI.
- **Werbeaussagen (EmpCo)** – prüft eure Texte je Sprache auf Umweltaussagen, die unzulässig oder belegpflichtig sind. Heuristisch, ohne KI.
- **Einbettungen** – die Suche nach Sinn und „Ähnliche Knoten“ rechnet journali mit einem lokalen Modell auf eurem Server: rund 120 MB, auf der CPU, **ohne Schlüssel, ohne Grafikkarte**.

## Oder: die KI im eigenen Haus

Ihr wollt gar nichts nach draußen schicken? Dann bindet **ein Sprachmodell auf eurem eigenen Server** an – als Anbieter „lokal“, mit Adresse statt Schlüssel. Gemessen auf vier Kernen ohne Grafikkarte: eine kurze Zuordnungsfrage beantwortet es in rund acht Sekunden. Nur im Internet sucht es nicht.

## Und jetzt?

journali ist noch in Entwicklung – die KI-Anbindung steckt schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
