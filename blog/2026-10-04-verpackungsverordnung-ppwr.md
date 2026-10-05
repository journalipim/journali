---
title: Verpackungsdaten im Griff – journali prüft eure Produkte gegen die PPWR
excerpt: Material, Rezyklat, Recyclingfähigkeit, Leerraum, Stoffgrenzen, Kennzeichnung, Register – das Plugin Verpackung (PPWR) zeigt für jeden Teilbaum, welche Verpackungsdaten fehlen, und hilft, sie zu füllen.
slug: verpackungsverordnung-ppwr
tags: [Compliance, PPWR, Datenqualität, KI]
categories: [Entwicklung]
wp: 48
---
Die Verpackungsverordnung (EU) 2025/40 gilt seit dem 12. August 2026. Damit geht es um jede Faltschachtel, jedes Inlay und jeden Beutel: Material, Gewicht, Rezyklat, Recyclingfähigkeit, Kennzeichnung. **journali zeigt euch mit einem Klick, was davon in euren Produktdaten fehlt** – für eine ganze Produktgruppe auf einmal. Das Plugin dafür heißt **Verpackung (PPWR)**.

## 29 Datenpunkte, fertig hinterlegt

Die Verordnung erst selbst in Attribute übersetzen? Nicht nötig. Der Katalog des Plugins bringt **29 Datenpunkte** mit – 16 Pflicht, 11 empfohlen, 2 optional:

- **Verpackungseinheit**: Kennung, Verpackungsart (Verkaufs-, Um-, Transport-, Versand-, Serviceverpackung), Gesamtgewicht, Maße, Stück je Einheit
- **Material**: Hauptmaterial, Bestandteile mit Material und Gewicht je Teil, Rezyklatanteil Kunststoff, Recyclingfähigkeitsklasse A, B oder C, recyclingfähiger Anteil, kompostierbar
- **Wiederverwendung und Minimierung**: Mehrweg, Leerraumanteil, Minimierung belegt
- **Stoffe**: Summe aus Blei, Cadmium, Quecksilber und Chrom(VI), PFAS-frei, Lebensmittelkontakt
- **Kennzeichnung und Nachweise**: Materiallabel, QR/Data Carrier, Konformitätserklärung, Herstellerregister-Nummer, Inverkehrbringer

Hinter jedem Datenpunkt steht ein **Steckbrief**: was gemeint ist, wo es in der Verordnung steht, ab wann es gilt, was passiert, wenn es fehlt – und woher ihr den Wert bekommt.

## Einschalten, und das Modell steht

Beim Einschalten legt das Plugin nach einem Hinweis **die Attributgruppe mit allen fehlenden Attributen an** – samt Einheiten wie g, % und mg/kg. Was euer Modell schon hat, bleibt, wo es ist: journali ordnet vorhandene Attribute über Schlüssel, Bezeichnung und Synonyme zu. Euer Attribut heißt „Tara“, „PCR“ oder „LUCID“? Wird erkannt. Die Zuordnung merkt sich journali im Journal.

Konformitätserklärung, Registernummer und Inverkehrbringer entstehen als **vererbbare** Attribute: einmal an der Gruppe gepflegt, gilt der Wert für alles darunter.

## Ein Klick, ein ganzer Teilbaum

Unter ✓ Datenanalyse oder direkt am Knoten mit **„PPWR prüfen“**: journali prüft die Produktgruppe oder das Produkt samt allem darunter – sofort beim Öffnen, ohne weiteren Klick. Ihr seht:

- je Datenpunkt, wie oft er **erfüllt, leer oder fraglich** ist
- je Knoten den **Anteil erfüllter Pflicht-Datenpunkte**
- was in allen Varianten darunter belegt ist, zählt am Produkt als erfüllt

Und die Werte selbst werden geprüft: **mehr als 100 mg/kg Schwermetalle** oder **mehr als 50 % Leerraum** markiert journali als Befund, mit dem Artikel dazu.

## Sonderfälle? Kennt journali.

Gefahrgut, Medizin und Pharma, Lebensmittelkontakt, geschütztes Design: dafür gibt es **eigene Datenpunkte**, etwa die UN-Zulassungsnummer oder den PFAS-Gehalt. Ob ein Sonderfall gilt, setzt ihr am Knoten – vererbbar für alles darunter. **journali schlägt die Geltung vor**, aus der ETIM-Klasse des Knotens und auf Wunsch mit KI. Entscheiden tut ihr.

## Lücken füllen – von Hand, mit Regel, mit KI

- **Direkt eintragen**: Liste der leeren Knoten, Wert rein, Enter schreibt.
- **Noch nicht bekannt?** ⏳ „angefragt bei …“ mit Wiedervorlage. Ist das Datum vorbei, zeigt journali es als überfällig.
- **Regelbasiert**: Aus der Recyclingfähigkeitsklasse folgt der recyclingfähige Anteil als Untergrenze.
- **Mit KI**: Vorschläge aus den vorhandenen Werten des Knotens, mit Sicherheit und Begründung.
- **Recherche im Internet**: Bei Handelsware sucht die KI nach Hersteller, Typ und EAN – **jeder Wert mit Quelle**.

Geschrieben wird **nichts ohne euren Klick**. Was ihr übernehmt, geht als ein Stapel ins Journal, und an jedem Wert hängt der Beleg: Quelle, Weg, Prüfdatum.

## Klar gesagt: keine Rechtsberatung

Datenpunkte, Fristen, Geltungen und Vorschläge sind eine Arbeitshilfe. **Maßgeblich bleibt der Rechtstext** – der Verweis auf EUR-Lex steht in jeder Prüfansicht ganz oben, zusammen mit diesem Hinweis.

## Und jetzt?

journali ist noch in Entwicklung – die Prüfung der Verpackungsdaten steckt schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
