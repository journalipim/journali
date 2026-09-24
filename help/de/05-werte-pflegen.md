# Werte pflegen

Werte stehen in Zellen: am Knoten in der Matrix aus Attributen und Spalten, in der Tabelle der Subitems als Zeilen.

## Die Knotenansicht

Die Attribute sind nach Gruppen geordnet, untereinander oder als Reiter. Die Spalten sind Sprache × Kanal; welche davon zu sehen sind, stellt ◐ Ich → Sicht ein, am Knoten lässt es sich jederzeit umschalten. Der Stern ist der Wert ohne Sprache und Kanal.

Eine Zelle zeigt drei Zustände: einen eigenen Wert, einen geerbten in kursiv, oder nichts. Ein Wert, der nur aus dem Master kommt, ist gedämpft gekennzeichnet; ein Wert, dessen Master später geändert wurde, trägt ⟳ als zu überarbeiten.

| Taste | Wirkung |
|---|---|
| Tab | nächste Zelle |
| Enter | bearbeiten, dann speichern |
| Esc | verwerfen |
| Entf | eigenen Wert löschen, der geerbte gilt wieder |

Lange Texte und HTML öffnen einen grossen Editor mit Formatierung, Link und Quelltext; Strg+Enter speichert. Listenwerte öffnen eine Auswahl, in der ein Buchstabe springt; vermehrbare Attribute zeigen eine Liste mit Hinzufügen, Entfernen und Umsortieren.

Die Suche im Sichtbaren filtert Attributnamen und Werte der gezeigten Spalten; die Sicht wählt Gruppen, der Umfang zeigt alle, nur die hier änderbaren oder nur die ausschliesslich hier änderbaren Attribute.

## Stapel und Rückgängig

Was auf einmal gespeichert wird, ist ein Stapel im Journal. ↶ nimmt den letzten Stapel zurück, ↷ wiederholt ihn. Beides sind neue Einträge; das Journal bleibt vollständig.

## Beleg am Wert

Ein Wert kann eine Quelle tragen: eine Adresse oder einen Text wie Datenblatt oder Katalogseite. Werte aus Recherche, Regel oder Import bringen ihren Beleg mit. Ändert sich der Wert später, gilt der Beleg als veraltet.

## Die Tabelle

Die Subitems eines Knotens, oder alle Varianten darunter, lassen sich in einer Tabelle bearbeiten, die wie eine Tabellenkalkulation reagiert:

| Bedienung | Wirkung |
|---|---|
| Klick, Bereich aufziehen | Zelle wählen, Bereich markieren |
| Tippen | überschreibt die Zelle; Enter nimmt die Ergänzung aus der Spalte |
| F2 oder Doppelklick | bearbeiten, langer Text im grossen Editor |
| Entf | Zelle leeren, der geerbte Wert gilt wieder |
| Strg+D | oberste Zelle in den Bereich darunter füllen |
| Strg+Shift+D | Reihe fortsetzen: 1, 2 → 3, 4 |
| Kästchen ziehen | füllen wie in Excel |
| Strg+C, Strg+V | mit Excel austauschen, Listen über Wert oder Bezeichnung |
| Strg+H | suchen und ersetzen |
| Strg+S | alle Änderungen als ein Stapel speichern |
| Strg+− | markierte Zeilen zum Löschen vormerken |

Die Zeilenspalte links markiert ganze Zeilen; Rechtsklick bietet kopieren, einfügen, duplizieren, verschieben und löschen. Neue Zeilen entstehen über oder unter einer markierten; speichern legt die Knoten an. Nichts wird geschrieben, bevor gespeichert wird.

## Relationen

Am Knoten stehen die Relationen zu anderen Knoten: Typ, Ziel, Werte an der Relation. Eine neue Relation entsteht über Typ und Ziel, oder im Baum durch Ziehen mit Shift, oder für eine Auswahl auf einmal. Beide Richtungen sind sichtbar.

## Workflow am Knoten

Ein Knoten kann in einem Workflow einen Zustand haben, mit dem nächsten Schritt, dem Zuständigen und dem Verlauf. Ein Zustand vererbt sich nach unten, bis ein Knoten einen eigenen bekommt. Siehe Workflows.
