# Erste Schritte

Die Reihenfolge nach der Installation. Jeder Schritt baut auf dem vorigen auf; alles lässt sich später ändern, weil jede Änderung ein Journaleintrag ist.

## 1. Datenbank, Administrator und Team

Im Paket ist die Datenbank dabei, der Server findet sie selbst. Findet er keine, oder weist sie die Anmeldung ab,
zeigt der Browser den Dialog **Datenbank**: Host, Port, Datenbank, Anmeldename, Passwort. Dazu gehört der
**Einrichtungscode**, den der Server in seine Konsole schreibt. Ist die Datenbank nur kurz nicht erreichbar, versucht der
Server es von selbst weiter.

<!-- lizenz -->
Danach legt man den ersten Administrator an, ebenfalls mit dem Einrichtungscode. Danach braucht jeder Zugriff eine Anmeldung. Der Administrator gehört zum **Init Team**, das jede Anlage mitbringt: es trägt die Grenzen der Lizenz und lässt sich umbenennen, aber nicht löschen.
<!-- /lizenz -->
<!-- startphase -->
Danach legt man den ersten Administrator an, ebenfalls mit dem Einrichtungscode. Danach braucht jeder Zugriff eine Anmeldung. Der Administrator gehört zum **Init Team**, das jede Anlage mitbringt: es lässt sich umbenennen, aber nicht löschen.
<!-- /startphase -->

Unter ⚙ Einstellungen → ◈ IAM kommen weitere Anwender mit Rolle und Team dazu. Rollen bündeln Rechte; die vorbelegten sind Administrator, PIM-Manager, PIM-Editor, Team-Admin und Leser.

Wer die Anlage verwaltet, bestätigt danach einmal die **Hinweise zum Betrieb**: journali ist eine Testversion zu Test- und Evaluationszwecken, die Nutzung erfolgt auf eigene Gefahr; Sicherung und die Probe der Wiederherstellung liegen beim Betreiber. Die Bestätigung steht mit Version und Wortlaut im Journal; ändert sich der Wortlaut, wird wieder gefragt.

## 2. Sprachen und Kanäle

Unter ⊞ Modell → Sprachen und Kanäle stehen die Achsen der Daten. Vorbelegt sind Deutsch und Englisch sowie die Kanäle Web und Print. Die Mastersprache ist die Sprache, in der Pflichtfelder erfasst werden; ändert sich dort ein Wert, gelten die anderen Sprachen als zu überarbeiten.

## 3. Attributgruppen und Attribute

Ein Attribut hat einen Schlüssel, einen Typ, eine Gruppe und Achsen: sprachabhängig, kanalabhängig oder beides. Die Gruppe hängt an einem Knoten des Baums und gilt von dort nach unten; **aktiv ab** sagt, ab welchem Knotentyp Werte erfasst werden. Der Schlüssel eines Attributs ist für immer.

Wertelisten liefern die erlaubten Werte für Attribute vom Typ Liste. Ein Eintrag hat einen Schlüssel, eine Bezeichnung je Sprache und eigene Spalten, zum Beispiel eine RAL-Nummer bei Farben.

## 4. Der Baum

Der Pflegebaum beginnt mit einer Wurzel, an der die eingebauten Attributgruppen hängen. Darunter entstehen Produktgruppen, Produkte und Varianten, von Hand über ＋ im Baum oder per Import.

## 5. Import

⇩ Import → Tabelle nimmt CSV, Excel, JSON und die Zwischenablage. Der Datenmapper erkennt Spalten an Schlüssel, Bezeichnung und Synonymen, schlägt Typen für neue Attribute vor und zeigt einen Plan, bevor etwas geschrieben wird. Eine Zuordnung lässt sich als Profil speichern und als Job wiederholen.

## 6. Medien

Bilder und Dokumente kommen unter ▨ Medien in die Bibliothek oder direkt am Knoten. Ein Medium wird einmal gespeichert und an beliebig viele Knoten zugeordnet; eine Zuordnung kann an alle Subitems vererbt werden. Vorschaubilder rechnet ein Job im Hintergrund.

## 7. Freigabe und Publikation

Eine Variante ist freigabefähig, wenn ihre Pflichtfelder für Kanal und Sprache gefüllt sind. Ein Publikationsbaum je Kanal legt fest, welche Rubriken es gibt und welche Produkte darin stehen. Hinaus geht, was freigegeben ist und den Markt des Baums bedient.

## 8. Export

⇪ Export liefert Tabellen, JSON und Ausgaben nach Vorlage, etwa BMEcat mit ETIM oder Google Merchant. Jeder Export lässt sich als Job mit Zeitplan einrichten.

## Was jederzeit hilft

- ≡ Journal zeigt jede Änderung mit Urheber, Zeit und Inhalt.
- ↶ am Knoten macht den letzten Stapel rückgängig.
- Der ?-Knopf oben rechts öffnet das Kapitel zur aktuellen Ansicht.
