# Das Modell

Das Modell beschreibt, welche Daten es gibt: Attribute mit Typ und Achsen, Gruppen, Wertelisten, Sichten, Einheiten, Sprachen, Kanäle und Status. Es steht im Journal wie alles andere und wird unter ⊞ Modell gepflegt.

## Attribute

Ein Attribut hat:

- einen **Schlüssel**, klein geschrieben, für immer;
- eine **Bezeichnung** je Sprache, die die Oberfläche in ihrer Sprache zeigt;
- einen **Typ**: Text, HTML, ganze Zahl, Zahl mit Einheit, Ja/Nein, Datum, Listenwert, Tabelle aus Zeilen;
- eine **Gruppe**, über die es an Knoten des Baums gilt;
- **Achsen**: sprachabhängig, kanalabhängig oder beides;
- **Pflicht** je Kanal und Sprache: ohne Wert keine Freigabe in diesem Kanal;
- Kennzeichen: **vererbbar** (der Wert gilt nach unten weiter), **vermehrbar** (mehrere Werte je Zelle), **eindeutig** (kein zweiter Knoten mit demselben Wert, etwa SKU oder EAN);
- ein **Muster** als regulärer Ausdruck, dem jeder Wert entsprechen muss;
- **Ebenen**: an welchen Knotentypen es gesetzt werden darf.

Ein Attribut lässt sich zurückziehen, solange kein Knoten es als Namensattribut trägt. Werte im Journal bleiben dabei erhalten.

## Attributgruppen

Eine Gruppe bündelt Attribute und hängt an einem Knoten des Baums; von dort gilt sie nach unten. **Aktiv ab** legt fest, ab welchem Knotentyp Werte erfasst werden: darüber ist die Gruppe sichtbar, aber gesperrt. Beispiel aus dem Saatgut: Logistik mit SKU und EAN ist ab Variante aktiv.

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
