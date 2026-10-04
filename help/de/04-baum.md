# Der Baum

Der Pflegebaum unter ▣ Baum hält die Produktdaten in drei Rollen: **Produktgruppe**, **Produkt**, **Variante**. Jeder Knoten hat eine feste Kennung, die sich beim Umhängen nicht ändert.

## Rollen

| Rolle | Eltern | Kinder | Trägt |
|---|---|---|---|
| Produktgruppe | Wurzel oder Produktgruppe | Produktgruppen, Produkte | Struktur, gemeinsame Werte |
| Produkt | Produktgruppe | Varianten | Pflegewerte, die Variantenachsen |
| Variante | Produkt | keine | SKU, EAN, je Achse einen Wert, Abweichungen |

Verkaufsfähig ist die Variante. Ein Produkt „variiert nach“ einer oder mehreren Achsen, zum Beispiel Farbe und Grösse; jede Kombination ist eine Variante, und die Kombination ist eindeutig. Ein Produkt ohne Achsen kann beliebig viele Varianten haben.

## Anlegen

Die Knöpfe über dem Baum legen eine Gruppe, ein Produkt oder eine Variante unter dem gewählten Knoten an. Der Dialog fragt nach Pflichtfeldern und Achsenwerten. Per Import entstehen ganze Teilbäume auf einmal.

## Der Name

Der Baum zeigt je Knoten einen Namen. Er kommt aus dem Attribut, das am Pfad das ★ trägt, in den eingebauten Vorgaben ist das der Name an der Wurzel. Wer eine andere Benennung braucht, setzt das ★ tiefer im Baum auf ein anderes Attribut oder gibt einem Knoten per Rechtsklick einen festen Namen. Eine Variante ohne eigenen Namen heisst nach Kennung und Achsenwerten.

## Vererbung

Werte vererben sich den Pfad hinauf zu suchen: eigener Wert, sonst der des Produkts, sonst der der Gruppe und so weiter, sofern das Attribut vererbbar ist. Geerbte Werte stehen kursiv. Ein eigener Wert überschreibt den geerbten; ihn löschen lässt den geerbten wieder gelten.

Auch Medien vererben sich, wenn die Zuordnung so gekennzeichnet ist. Eine geerbte Zuordnung lässt sich an einem Knoten sperren, dann gilt sie dort und darunter nicht mehr.

## Umhängen und Zurückziehen

Ziehen im Baum hängt einen Knoten um; mit Shift entsteht stattdessen eine Relation. Entf zieht einen Knoten zurück, mit allem darunter. Zurückgezogene Knoten bleiben im Journal und lassen sich wiederherstellen; ↶ am Knoten macht den letzten Stapel rückgängig.

## Suche

Das Suchfeld über dem Baum durchsucht Namen und Werte und kennt Bedingungen: ein Attribut mit oder ohne Wert, ein leerer Wert in einer Sprache, ein unvollständiger Kanal, eine Rolle, ein Status, eine Gruppe, ein Teilbaum, ein Urheber, ein Datum. Die Vorschläge erscheinen beim Tippen; ein Minus davor verneint. Strg+Klick sammelt eine Auswahl, Shift+Klick nimmt einen Bereich.

## Duplizieren

Ein Knoten lässt sich mit oder ohne Teilbaum duplizieren. Die Kopie übernimmt keine eindeutigen Kennungen und keine Freigaben.

## Tabellarisch

Die Subitems eines Knotens lassen sich in einer Tabelle bearbeiten, mit Zellen, Bereichen, Ausfüllen und Austausch mit Excel. Siehe Werte pflegen.
