# Workflows

Ein Workflow ist der Bearbeitungszustand über den Daten: Zustände, Übergänge zwischen ihnen, wer einen Schritt gehen darf, ob eine Notiz Pflicht ist und was der Schritt bewirkt.

## Eingebaute Vorgaben

Zwei Workflows sind vorbelegt:

- **Redaktion**: Entwurf → Prüfung → Freigegeben, mit Korrekturschleife zurück zur Korrektur. Freigeben löst die Freigabe für den Kanal Web aus, Zurückziehen nimmt sie zurück.
- **Übersetzung**: nicht angefordert → zur Übersetzung → übersetzt → geprüft, **je Sprache** ein eigener Zustand.

Beide lassen sich unter ⚙ Einstellungen → ⚑ Workflows ändern oder durch eigene ersetzen.

## Bausteine

| Baustein | Bedeutung |
|---|---|
| Zustand | Name je Sprache, Farbe, Kennzeichen Ende |
| Übergang | von einem Zustand zu einem anderen, mit Bezeichnung |
| Rollen | wer den Schritt gehen darf; leer heisst jede Rolle mit Schreibrecht |
| Notiz | der Schritt verlangt eine Begründung, etwa in der Korrekturschleife |
| Eskalation | nach n Tagen dürfen auch andere Rollen |
| Wirkung | was der Schritt auslöst: Freigabe erteilen oder zurücknehmen, Status setzen |
| gilt für | Knotentypen, auf die der Workflow anwendbar ist |

Der Designer zeigt Zustände als Kacheln und Übergänge als Pfeile; Ziehen verschiebt, Ziehen vom Rand verbindet, Doppelklick benennt um.

## Am Knoten

Ein Zustand wird am Knoten gesetzt und vererbt sich nach unten, bis ein Knoten einen eigenen bekommt; Erben stellt die Vererbung wieder her. Der nächste Schritt steht am Knoten mit dem Zuständigen, den man wählen oder zuweisen kann. Der Verlauf zeigt jeden Schritt mit Urheber, Zeit und Notiz.

Kann ein Schritt nicht gehen, weil seine Wirkung nicht möglich ist, etwa eine Freigabe ohne freigabefähige Variante, sagt der Knoten vorher, woran es liegt.

## Aufgaben

⚑ Aufgaben listet alle Knoten, die auf einen Schritt der eigenen Rolle warten: Workflow, Zustand, seit wann, wer zuständig ist. Von dort geht es zum Knoten.

## Je Sprache

Ein Workflow je Sprache führt für jede Sprache einen eigenen Zustand; ein Schritt wirkt nur auf diese Sprache. Das Plugin Übersetzung schaltet Knoten nach dem Schreiben der Ziele von zur Übersetzung auf übersetzt weiter.
