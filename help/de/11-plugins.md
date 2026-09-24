# Plugins

Alles, was über den Kern hinausgeht, ist ein Plugin: Import und Export, Datenblatt, Übersetzung, Klassifikation, Datenanalyse, Werkzeuge. Ein Plugin ist ein Verzeichnis mit einer Beschreibung, das sich ohne neue Auslieferung austauschen lässt.

## Arten

- **Browser-Plugins** laufen in der Oberfläche und bringen Ansichten, Knoten-Aktionen, Importer, Prüfregeln und Bänder in der Knotenansicht mit.
- **Prozess-Plugins** laufen als Kindprozess des Servers und sind die Grundlage der Jobs.

Beide sprechen mit journali nur über die Schnittstelle; keines läuft im Serverprozess.

## Basis und Ergänzung

Ein **Basis-Plugin** bringt die Grundfunktion einer Gruppe der Leiste mit und ist der Container für Ergänzungen: Tabelle für Import und Export, Datenanalyse für die Prüfungen, Jobs für die Prozesse. Eine Ergänzung nennt, was sie braucht; geht die Basis aus, ist die Ergänzung ohne Wirkung.

| Gruppe | Basis | Ergänzungen |
|---|---|---|
| Import, Export | Tabelle | CSV, Excel, JSON, IXP, Solr, Vorlagen-Export |
| Datenanalyse | Datenqualität | Digitaler Produktpass, Verpackung, EmpCo, Anreicherung, GEO-Texte, ETIM |
| Jobs | Jobs | Sicherung, Export als Job, Vorschauen, Dokumente lesen, Übersetzung |

## Verwaltung

⌁ Plugins zeigt alle Plugins mit Fassung und Zustand: installiert, an, aus, Basis fehlt, nicht installiert. Installieren nimmt ein Plugin ins Journal auf, einschalten macht es wirksam, aktualisieren übernimmt eine neue Fassung von der Platte. Beim Einschalten legt ein Plugin an, was es braucht, etwa eine Attributgruppe. Jedes Plugin lässt sich für die eigene Leiste ein- und ausblenden.

## Was der Tarif erlaubt

Welche Plugins sich installieren und einschalten lassen, hängt am Tarif der Instanz: Kostenlos enthält Tabelle, Excel-Add-in, OnlyOffice, Vorschauen und Export; Pro dazu Datenblatt, Übersetzung, Vorlagen-Export, ETIM, Datenanalyse und Sicherung als Job; ab Pro+ alle. Es zählt der höchste Tarif, den ein Team der Instanz hat.

## Profile

Ein Import- oder Export-Plugin speichert seine Einstellungen als Profil im Journal, für alle sichtbar. Zugangsdaten am Profil liegen beim Server. Ein Profil ist die Grundlage, um denselben Lauf als Job zu wiederholen.

## Eigene Plugins

Ein Plugin ist ein Verzeichnis unter plugins mit einer plugin.json: Schlüssel, Fassung, Bezeichnung, Art, ob es im Browser oder als Prozess läuft, Einstieg oder Befehl, Parameter. Beitragspunkte für Browser-Plugins sind Ansichten, Knoten-Aktionen, Importer, Prüfregeln und Bänder; Plugin-Daten liegen im Journal.
