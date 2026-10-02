# Konfigurator

Ein Konfigurator prüft eine Auswahl von Produkten gegen Gruppen und Regeln und sagt, ob sie zulässig und vollständig ist und welche Teile noch dazukommen können. Die Gruppen und Regeln pflegt ein Anwender unter ⚙ Werkzeuge → Konfigurator; ein Shop schickt seine Auswahl an die Schnittstelle und bekommt zurück, was geht. Die Prüfung steht nur auf dem Server, der Shop kennt die Regeln nicht. Das Plugin gehört ab Pro+ zum Tarif.

## Ausgangspunkt

Ein Konfigurator ist ein Ausgangspunkt. Seine Wurzel bestimmt, woraus gewählt werden darf; ohne Wurzel gilt der ganze Baum. Gewählt werden Varianten und Produkte ohne Varianten. Wer zwei Konfigurationen trennen will, legt zwei Konfiguratoren an.

## Gruppen und Zeilen

Eine **Konfiguratorgruppe** gilt für alle Konfiguratoren. Ein Teil gehört mit **Zeilen** zu ihr; eine Zeile nennt die Gruppe und ist entweder ein Mitglied oder eine Vorgabe:

| Art | Angaben | Das Teil zählt in der Gruppe |
|---|---|---|
| Mitglied | stellt bereit, verbraucht, Wert | ja |
| Vorgabe | mindestens, höchstens (Zahl der Mitglieder), erlaubte Werte | nein |

- **Summe.** Was die Mitglieder bereitstellen und verbrauchen, wird je Gruppe aufgerechnet. Ist die Summe kleiner als 0, ist die Auswahl ungültig; ein Teil, das den Bedarf deckt, bleibt wählbar.
- **Wert.** Der Wert eines Teils in der Gruppe ist eine eigene Angabe, unabhängig von den Attributen des Produkts. Mit „alle Werte gleich“ an der Gruppe sind zwei verschiedene Werte ungültig.
- **Vorgabe.** Ein Teil kann einer Gruppe Mengen und Werte vorgeben: ein Mainboard dem Arbeitsspeicher genau zwei Bausteine mit 8 oder 32 GB. Mehrere Vorgaben gelten zusammen. Ein Konfigurator kann dieselbe Grenze ohne ein Teil setzen (Reiter Gruppen, Grenzen dieses Konfigurators).
- **Bedingung.** Eine Zeile kann nur gelten, wenn bestimmte Teile gewählt sind: eine CPU stellt mit einem bestimmten Mainboard zwei Steckplätze bereit. Die Bedingung fragt nach Teilen, nicht nach der Summe einer Gruppe.
- **Alle Zeilen wirken**, deren Bedingung zutrifft. Zahlen derselben Gruppe addieren sich.
- **Vererbung.** Hat eine Variante keine eigenen Zeilen, gelten die ihres Produkts, sonst die der Gruppe darüber; eigene Zeilen ersetzen die geerbten ganz.

Die Zeilen eines Teils stehen im Band ⚙ Konfiguratorgruppen in der Knotenansicht und im Reiter Gruppen. Sollen zwei Teile derselben Konfiguration getrennt gerechnet werden, etwa zwei Mainboards mit je eigenem Arbeitsspeicher, bekommen sie getrennte Gruppen.

## Regeln

Was keine Gruppe abdeckt, steht als Regel: „wenn A, dann B“. Die einfachen Formen sind Sätze, in denen nur die Teile zu wählen sind: passt nicht zusammen, braucht, höchstens, mindestens. Die technische Form kennt Bedingungen über Menge, Summe eines Attributs und die Bilanz einer Gruppe, verknüpft mit und, oder, nicht.

## Zulässig und vollständig

- **Ungültig** ist eine Auswahl mit einem Verbot, einer überschrittenen Grenze, einer Summe im Minus, zwei verschiedenen Werten in einer Gruppe mit gleichen Werten oder einem nicht erlaubten Wert.
- **Unvollständig** ist eine Auswahl, in der etwas verlangt ist und fehlt, auch die Mindestmenge einer Gruppe.
- Bestellbar ist eine Auswahl, wenn sie zulässig und vollständig ist.
- Zu jedem Teil, das noch dazukommen könnte, sagt das Ergebnis, ob es geht und warum nicht. Gesperrt ist ein Teil, das einen neuen Verstoß verursacht; was nur fehlt oder die Summe ins Minus bringt, sperrt nichts. Ein Teil, das die Summe einer Gruppe im Minus anhebt, ist mit ↑ gekennzeichnet.

## Prüfen und Testfälle

Der Reiter Prüfen wählt Teile (Id oder SKU, Menge) und zeigt das Ergebnis wie für einen Shop: zulässig, vollständig, Verstöße, Fehlendes, Bilanz, Gruppen mit Vorgabe und die wählbaren Teile. Ein Testfall hält eine Auswahl mit dem erwarteten Ergebnis fest; Alle prüfen vergleicht nach jeder Änderung, was sich verschoben hat.

## Schnittstelle

`POST /api/configurator/{key}/check` mit der Auswahl, zum Beispiel `{ "selection": [{ "id": "SKU-1", "amount": 2 }], "selectable": true }`. Eine Id ist ein Knoten oder der eindeutige Wert eines Attributs. Die Antwort enthält `valid`, `complete`, `violations`, `missing`, `balance`, `groups` und mit `selectable` zu jedem wählbaren Teil `ok`, `reasons` und `lifts`. Prüfen braucht nur das Recht zu lesen; ein Teil, das die Rolle des Aufrufers nicht sieht, gibt es für ihn nicht.
