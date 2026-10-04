---
title: Content-Generierung mit Vorlagen – eine Vorlage an der Produktgruppe, ein fertiger Text an jedem Produkt
excerpt: Vorlagen setzen Produkttexte aus euren Attributen zusammen – regelbasiert, in jeder Sprache, ganz ohne KI. Ändert sich ein Wert, ist der Text beim nächsten Öffnen schon neu.
slug: content-generierung-vorlagen
tags: [Content, Mehrsprachigkeit, Datenpflege]
categories: [Entwicklung]
wp: 76
---
Kurztitel, Katalogzeilen, Aufzählungen für den Shop: Ein großer Teil eurer Produkttexte steckt längst in euren Daten – Name, Farbe, Länge, Gewicht. **Mit Vorlagen setzt journali diese Texte selbst zusammen.** Regelbasiert, nachvollziehbar, in jeder Sprache – und **ganz ohne KI**.

## Eine Vorlage, so viele Texte wie Produkte

Die Vorlage ist ein eigener Attributtyp. Ihr schreibt den Textbaustein einmal, mit Platzhaltern für eure Attribute:

```
{name}[ in {farbe}][, {laenge|unit} lang][ · {gewicht|2|unit}]
```

Daraus wird zum Beispiel: *Kabeltrommel K25 in Schwarz, 25 m lang*.

Ist das Attribut vererbbar, setzt ihr die Vorlage **einmal an der Produktgruppe** – und jedes Produkt darunter baut daraus **seinen eigenen Text mit seinen eigenen Werten**. Braucht ein Produkt etwas anderes, bekommt es eine eigene Vorlage; dort gilt dann seine.

## Keine Reste, keine Lücken

Das Ärgerliche an Textbausteinen sind leere Felder: „, cm lang“ mitten im Satz. **Nicht in journali.** Alles in eckigen Klammern ist optional: Fehlt darin ein Wert, **entfällt der ganze Abschnitt**. Im Beispiel oben fehlt das Gewicht – also steht auch kein „·“ am Ende. Doppelte Leerzeichen und Leerzeichen vor Komma oder Punkt räumt journali auf, und Abschnitte dürfen ineinander liegen.

## Zahlen, Einheiten, Listen – automatisch richtig

Hinter jeden Platzhalter passen Zusätze, beliebig verkettet:

- `|unit` hängt **die Einheit aus dem Modell** an – kg, cm, m.
- `|0` bis `|6` setzt die Nachkommastellen, **im Zahlenformat der Sprache**: 0,85 kg auf Deutsch, 0.85 kg auf Englisch.
- `|upper`, `|lower` und `|capitalize` ändern die Schreibung, `|plain` nimmt HTML-Tags heraus.

Listenwerte erscheinen nicht als Schlüssel, sondern **mit ihrer Bezeichnung in der Sprache** – „Schwarz“ im deutschen Text, „Black“ im englischen. Geerbte Werte zählen selbstverständlich mit.

## Jede Sprache, ohne Übersetzung je Produkt

Ist das Vorlagen-Attribut sprachabhängig, schreibt ihr die Vorlage **einmal je Sprache** – nicht einmal je Produkt und Sprache. Texte kommen in der Sprache der Spalte, Listen mit ihrer Bezeichnung, Zahlen im passenden Format. Neue Produkte in der Gruppe haben ihren Text, sobald ihre Werte gepflegt sind – in allen Sprachen.

## Immer aktuell, ohne Generierungslauf

Im Journal steht **nur die Vorlage, nicht der fertige Text**. Den Text baut der Server beim Lesen. Ändert ihr die Länge, ist der Text beim nächsten Öffnen schon richtig – **kein Job, kein Nachziehen, kein veralteter Text**. Zu sehen in der Knotenansicht und in der Tabelle.

## Der Editor hilft beim Schreiben

- `{` zeigt eure Attribute zur Auswahl, `|` die passenden Zusätze.
- Die Syntax wird beim Tippen geprüft; **„Übernehmen“ geht nur, wenn sie stimmt.**
- Die **Vorschau** zeigt das Ergebnis am aktuellen Knoten, während ihr schreibt.
- Unterbrochen? Der Entwurf bleibt im Browser.

## Wenn es mehr braucht: Formeln

Vorlagen setzen Texte zusammen. **Soll der Text je nach Wert anders lauten, nehmt ihr eine Formel** – ein kleines Skript mit `if` und `else`, Rechnen und Textfunktionen von `round` über `format` bis `slug`:

```
h = $height
if (h >= 100) {
  return `${format(h / 100, 2)} m`
}
return `${h} cm`
```

Das Beste: **Vorlage und Formel lesen sich gegenseitig.** Eine Vorlage setzt das Ergebnis einer Formel ein wie jeden anderen Wert. Und in Tabellen-Attributen rechnet eine Formel- oder Vorlagen-Spalte **für jede Zeile ihren eigenen Wert**.

## Und wo es freie Sprache braucht: KI auf Klick

Für Fließtext gibt es einen zweiten Weg: **✦ KI im Editor eines Textfelds**. Die KI bekommt die echten Produktdaten des Knotens und überarbeitet euren Text – verbessern, kürzen, ausführlicher – oder schreibt einen neuen: als Liste aus den Produktdaten oder als Marketingtext, sachlich, emotional oder vergleichend. Eine eigene Anweisung geht auch. Das Ergebnis landet im Entwurf; **gespeichert wird erst, wenn ihr speichert.**

Mehr dazu in [KI in journali](/?p=45) – und wie eure Texte zur Quelle für KI-Antworten werden, zeigt der Beitrag zu [GEO](/?p=43).

## Und jetzt?

journali ist noch in Entwicklung – Vorlagen und Formeln stecken schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
