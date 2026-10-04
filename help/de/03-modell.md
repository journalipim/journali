# Das Modell

Das Modell beschreibt, welche Daten es gibt: Attribute mit Typ und Achsen, Gruppen, Wertelisten, Sichten, Einheiten, Sprachen, Kanäle und Status. Es steht im Journal wie alles andere und wird unter ⊞ Modell gepflegt.

## Attribute

Ein Attribut hat:

- einen **Schlüssel**, klein geschrieben, für immer;
- eine **Bezeichnung** je Sprache, die die Oberfläche in ihrer Sprache zeigt;
- einen **Typ**: Text, HTML, ganze Zahl, Dezimalzahl, Ja/Nein, Datum, Liste, Tabelle, Formel, Vorlage (siehe Attribut-Typen);
- eine **Gruppe**, über die es an Knoten des Baums gilt;
- **Achsen**: sprachabhängig, kanalabhängig oder beides;
- **Pflicht** je Kanal und Sprache: ohne Wert keine Freigabe in diesem Kanal;
- Kennzeichen: **vererbbar** (der Wert gilt nach unten weiter), **vermehrbar** (mehrere Werte je Zelle), **eindeutig** (kein zweiter Knoten mit demselben Wert, etwa SKU oder EAN);
- ein **Muster** als regulärer Ausdruck, dem jeder Wert entsprechen muss;
- **Ebenen**: an welchen Knotentypen es gesetzt werden darf.

Ein Attribut lässt sich zurückziehen, solange kein Knoten es als Namensattribut trägt. Werte im Journal bleiben dabei erhalten.

## Attribut-Typen

Der Typ legt fest, was ein Wert ist, wie die Zelle ihn erfasst und wie journali ihn prüft. Er wird in der Modellansicht unter **Typ** gewählt. Ändert man den Typ eines Attributs mit Werten, prüft journali die vorhandenen Werte gegen die neue Definition und meldet, wie viele nicht passen.

| Typ | Ein Wert ist | Geeignet für |
|---|---|---|
| Text (Aa) | ein Text ohne Format | Namen, Kennungen, Kurztexte |
| HTML (‹›) | ein Text mit Formatierung | Beschreibungen, längere Texte |
| ganze Zahl (12) | eine ganze Zahl | Stückzahlen, Anzahlen |
| Dezimalzahl (1.5) | eine Zahl mit Nachkommastellen, auf Wunsch mit Einheit | Maße, Gewichte, Preise |
| Ja/Nein (☑) | wahr oder falsch | Eigenschaften, die ein Produkt hat oder nicht hat |
| Datum (📅) | ein Kalendertag | Fristen, Termine |
| Liste (☰) | ein Eintrag einer Werteliste | feste Auswahl wie Farbe oder Material |
| Tabelle (⊞) | n Zeilen aus Spalten | zusammengehörige Angaben, die sich wiederholen |
| Formel (ƒ) | das Ergebnis eines Skripts | gerechnete Werte |
| Vorlage ({}) | das Ergebnis einer Textvorlage | aus Attributen zusammengesetzte Texte |

### Text

Ein Text ohne Format. Nur bei diesem Typ gibt es ein **Muster**, einen regulären Ausdruck, dem jeder Wert genügen muss, samt einem **Hinweis**, der in der Fehlermeldung steht. Ein Text kann **eindeutig** sein (Kennungen wie SKU oder EAN), **vermehrbar** (mehrere Werte je Zelle) und **sprachabhängig**.

### HTML

Ein Text mit Formatierung. Die Zelle zeigt den Anfang des Textes; Enter oder Doppelklick öffnet den Editor mit einem einfachen Schreibmodus (fett, kursiv, Listen, Überschrift, Link) und einem Umschalter auf den Quelltext. Strg+Enter speichert, Esc verwirft. HTML ist nicht vermehrbar, nicht eindeutig und hat kein Muster.

### Ganze Zahl und Dezimalzahl

Beide prüfen, dass der Wert eine Zahl ist: „keine ganze Zahl“ bzw. „keine Zahl“ ist die Meldung. Bei der Dezimalzahl werden Eingaben wie 1.234,56 (deutsch), 1,234.56 oder 1234.56 erkannt und als Zahl mit Punkt gespeichert; bei der ganzen Zahl fallen Leerzeichen, Punkt und Hochkomma als Tausendertrenner weg. Beide Typen können eine **Einheit** nennen, die aus den Einheiten des Modells gewählt wird, und **eindeutig** sein, wenn sie einwertig sind.

### Ja/Nein

Gespeichert wird wahr oder falsch; die Zelle zeigt ✓ oder ✗. Beim Import und bei Vorschlägen werden ja, j, yes, y, true, wahr, x, 1, on und an als wahr gelesen, nein, n, no, false, falsch, 0, off, aus, ein Strich und ein leeres Feld als falsch. Ein anderer Wert wird als nicht ja/nein gemeldet.

### Datum

Gespeichert wird JJJJ-MM-TT. Eine Eingabe als TT.MM.JJJJ wird umgerechnet. Alles andere meldet die Prüfung als „kein Datum“.

### Liste

Der Wert ist ein Eintrag einer Werteliste, nicht ein freies Wort. Die Werteliste wird am Attribut unter **Werteliste** gewählt; ohne sie lässt sich kein Wert setzen. Jeder Eintrag hat einen Schlüssel und eine Bezeichnung je Sprache. Ein Wert, der nicht in der Liste steht, wird als „nicht in Liste“ gemeldet. Eine Liste kann **vermehrbar** sein: dann hat eine Zelle mehrere Einträge.

### Tabelle

Eine Tabelle hat n Zeilen, jede aus den **Spalten** des Attributs. Jede Spalte ist selbst ein Attribut und bringt ihren Typ und ihre Prüfung mit; die Spalten werden kommagetrennt eingetragen. Ohne Spalten hat eine Zeile keinen Inhalt. Eine Spalte darf keine Tabelle sein. Zeilen lassen sich hinzufügen, entfernen und umordnen. Eine Tabelle ist nicht vermehrbar, nicht sprachabhängig und nicht kanalabhängig.

### Formel

Der Wert am Knoten ist ein kleines Skript, das beim Lesen läuft; sein Ergebnis ist der Wert. Das Skript steht wie jeder Wert am Knoten, wird vererbt, wenn das Attribut vererbbar ist, und gilt je Sprache, wenn das Attribut sprachabhängig ist. Das Ergebnis erscheint in der Knotenansicht, in der Tabelle, im Export und in der Suche; ein leeres Ergebnis heißt: kein Wert.

```
h = $height
if (h >= 100) {
  return `${format(h / 100, 2)} m`
}
return `${h} cm`
```

- `$schlüssel` ist der Wert eines Attributs am Knoten; ein geerbter Wert zählt.
- Werte sind Zahlen, Texte, Textvorlagen mit `${…}`, true, false und null. Fehlt ein Wert, ist das Ergebnis null, und `??`, `isblank` und `coalesce` fangen das ab.
- Es gelten die Operatoren wie in JavaScript, dazu `if`, `else` und `return`.
- Funktionen: round, trunc, floor, ceil, abs, min, max, sqrt, len, upper, lower, trim, left, right, contains, replace, split, pad, number, str, format, isblank, coalesce.
- Einheiten rechnet die Formel nicht um; wer cm³ in Liter will, teilt durch 1000.

Die Zelle des Attributs, markiert mit ƒ, öffnet den Editor. Er prüft die Syntax beim Tippen über den Server, und „Übernehmen“ geht nur, wenn die Prüfung stimmt. Wer unterbrochen wird, behält den Entwurf im Browser. Strg+Enter übernimmt, Esc schließt.

### Vorlage

Der Wert am Knoten ist ein Textbaustein mit Platzhaltern; der Server baut daraus den Text beim Lesen. Vorlagen sind für Texte gedacht, nicht für Rechnen.

```
{name} mit {cpu}[, {ram} GB RAM][ · {weight|1|unit}]
```

- `{schlüssel}` ist der Wert eines Attributs; ein geerbter Wert zählt, eine Liste zeigt ihre Bezeichnung in der Sprache der Spalte.
- Zusätze mit `|`, beliebig verkettet: `|unit` hängt die Einheit an, `|0`, `|1`, `|2` setzen die Nachkommastellen, `|upper`, `|lower` und `|capitalize` ändern die Schreibung, `|plain` nimmt HTML-Tags weg.
- `[ … ]` ist ein optionaler Abschnitt: Ist darin ein Platzhalter leer, entfällt der ganze Abschnitt, und es bleibt kein „, GB RAM“ stehen. Abschnitte dürfen ineinander liegen.
- `\{`, `\[` und `\\` stehen für die Zeichen selbst. Zeilenumbrüche bleiben, doppelte Leerzeichen werden zu einem. Ein leeres Ergebnis heißt: kein Wert.

Im Editor zeigt `{` die Attribute, `|` die Zusätze, und die Vorschau am Knoten erscheint beim Tippen.

### Formel oder Vorlage

Einen Text aus mehreren Attributen zusammenzusetzen ist Sache der Vorlage. Zu rechnen oder je nach Wert Verschiedenes zu liefern ist Sache der Formel. Beide haben keinen eigenen Wert im Sinn einer Eingabe: Was am Knoten steht, ist die Vorlage oder das Skript, und ein fester Text ist eine Vorlage ohne Platzhalter.

### Einstellungen je Typ

| Einstellung | gilt für |
|---|---|
| Muster, Hinweis | Text |
| Einheit | ganze Zahl, Dezimalzahl |
| Werteliste | Liste |
| Spalten | Tabelle |
| eindeutig | Text, ganze Zahl, Dezimalzahl, jeweils einwertig |
| vermehrbar | Text, ganze Zahl, Dezimalzahl, Datum, Liste (nicht HTML, Ja/Nein, Tabelle, Formel, Vorlage) |
| kanalabhängig | alle außer Tabelle, Formel, Vorlage |
| sprachabhängig | alle außer Tabelle |
| vererbbar, Pflicht, Ebenen | alle |

## Attributgruppen

Eine Gruppe bündelt Attribute und hängt an einem Knoten des Baums; von dort gilt sie nach unten. **Aktiv ab** legt fest, ab welchem Knotentyp Werte erfasst werden: darüber ist die Gruppe sichtbar, aber gesperrt. Beispiel aus den eingebauten Vorgaben: Logistik mit SKU und EAN ist ab Variante aktiv.

Eine Gruppe kann an mehreren Knoten hängen. Hängt sie an einem Vorfahren, ist ein zweites Anhängen darunter überflüssig; die Knotenansicht zeigt das an.

## Wertelisten

Ein Attribut vom Typ Liste zeigt auf einen Eintrag der Werteliste, nicht auf ein Wort. Der Eintrag hat einen Schlüssel, eine Bezeichnung je Sprache und eigene Spalten. Eine **geschlossene** Liste nimmt nur Werte aus der Quelle, etwa aus einer ETIM-Freigabe; in der Zelle gibt es dann kein „neuer Wert“.

## Sichten

Eine Sicht gilt für einen Knotentyp und legt fest, welche Gruppen in welcher Reihenfolge erscheinen und darin welche Attribute. Vorbelegt ist je Knotentyp eine Sicht mit allen aktiven Gruppen, dazu die Sicht Verkaufbares für Varianten.

## Einheiten

Je Grösse gibt es eine Basis mit Faktor 1; andere Einheiten rechnen über ihren Faktor um. Ein Attribut vom Typ Zahl nennt seine Einheit.

## Sprachen und Kanäle

Sprachen sind die Achse für sprachabhängige Werte, Kanäle die für kanalabhängige. Beide haben einen **Master**: die Mastersprache ist die Basis für alle anderen Sprachen, der Masterkanal bekommt die Werte des Sterns und gibt sie an die anderen Kanäle weiter. Ein **Fallback** zwischen zwei Sprachen oder Kanälen wirkt vor dem Master, zum Beispiel fr-ch → fr-fr → Master.

## Status

Der Status ist der Lebenszyklus eines Produkts oder einer Variante: Entwurf, aktiv, ausgelaufen, frei erweiterbar mit Bezeichnung je Sprache, Symbol und Farbe. Entwurf ist der Startstatus neuer Knoten. Der Import bildet Fremdstatus darauf ab, ein Workflow kann ihn als Wirkung setzen.

## Relationstypen

Ein Relationstyp verbindet Knoten: Zubehör, Bestandteil, Verwandt, Stückliste, dazu Bild und Dokument als Verbindung zu Medien. Er hat eine Bezeichnung in beide Richtungen, erlaubte Knotentypen und optional eine Attributgruppe, deren Attribute an der Relation stehen, etwa eine Menge.
