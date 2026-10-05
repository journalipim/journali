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

⬡ Plugins zeigt alle Plugins mit Version und Zustand: installiert, an, aus, Basis fehlt, nicht installiert. Installieren nimmt ein Plugin ins Journal auf, einschalten macht es wirksam, aktualisieren übernimmt eine neue Version von der Platte. Beim Einschalten legt ein Plugin an, was es braucht, etwa eine Attributgruppe. Jedes Plugin lässt sich für die eigene Leiste ein- und ausblenden.

<!-- lizenz -->
## Was der Tarif erlaubt

Welche Plugins sich installieren und einschalten lassen, hängt am Tarif der Instanz: Kostenlos enthält Tabelle, Excel-Add-in, OnlyOffice, Vorschauen und Export; Pro dazu Datenblatt, Übersetzung, Vorlagen-Export, ETIM, Konfigurator, Datenanalyse und Sicherung als Job; ab Pro+ alle. Es zählt der höchste Tarif, den ein Team der Instanz hat.
<!-- /lizenz -->

## journali Core Plugins

Ein **journali Core Plugin** stammt von journali und ist unverändert. Es trägt neben dem Manifest eine Signatur
über Schlüssel, Version und alle Dateien. ⬡ Plugins zeigt es als ❖ mit dem Datum; wird eine Datei verändert, steht ⚠ mit
dem Grund. Ein Plugin ohne Signatur läuft genauso und trägt kein Zeichen — das Zeichen sagt, woher es kommt, nicht, ob
es gut ist.

Der **Katalog** unter der Liste zeigt, was der Herausgeber an solchen Plugins hat. ⇩ holen lädt das Zip auf den
Server, der das Siegel prüft und das Verzeichnis unter plugins/ ablegt; ↑ steht, wenn dort eine neuere Version liegt.
Danach wird das Plugin wie jedes andere installiert und eingeschaltet. Ohne Verbindung ist der Katalog leer.

## Profile

Ein Import- oder Export-Plugin speichert seine Einstellungen als Profil im Journal, für alle sichtbar. Zugangsdaten am Profil liegen beim Server. Ein Profil ist die Grundlage, um denselben Lauf als Job zu wiederholen.

## Eigene Plugins

Ein Plugin ist ein Verzeichnis unter plugins mit einer plugin.json: Schlüssel, Version, Bezeichnung, Art, ob es im Browser oder als Prozess läuft, Einstieg oder Befehl, Parameter. Beitragspunkte für Browser-Plugins sind Ansichten, Knoten-Aktionen, Importer, Prüfregeln und Bänder; Plugin-Daten liegen im Journal.
