# Datenschutz

Was journali über Personen speichert, wo es liegt und was damit geschieht.

## Personen im Journal

Je Anwender stehen im Journal: Anmeldename, Anzeigename, E-Mail, Rolle, Team und ob das Konto aktiv ist. Jeder Journaleintrag trägt den Anmeldenamen seines Urhebers; das ist die Grundlage des Verlaufs und lässt sich nicht entfernen, weil ein Eintrag nie geändert wird.

## Was nicht im Journal liegt

| Was | Wo |
|---|---|
| Passwörter | als Hash im Tresor der Datenbank, verschlüsselt |
| API-Token und Sitzungen | als Hash im selben Tresor |
| KI-Schlüssel, Zugangsdaten von Jobs, Mail-Passwort | im selben Tresor, am Team oder am Profil |
| Speicher-Zugänge, Verbindung zur Datenbank | Einstellungsdateien beim Server |

Diese Dateien gehen mit der Sicherung, nicht mit einem Export.

## Sperren und Entfernen

Ein Anwender lässt sich sperren; die Anmeldung erlischt, die Einträge bleiben. Entfernen nimmt Anmeldung, Token und Sitzungen weg; auch dann bleiben die Einträge mit dem Anmeldenamen als Urheber.

## Künstliche Intelligenz

journali hat keinen eigenen KI-Anbieter und keinen eigenen Schlüssel. Ein Team hinterlegt den Schlüssel seines Anbieters; der Anbieter ist Vertragspartner des Teams. Gefragt wird über den Server; der Browser sieht den Schlüssel nie. journali misst nur, was hingeschickt und zurückgekommen ist, in Bytes, und zeigt es als Austauschvolumen; über Tokens und Kosten des Anbieters sagt journali nichts und speichert nichts.

Was an den Anbieter geht, sind die Produktdaten des jeweiligen Knotens und die Aufgabe. Personendaten von Anwendern gehen nicht mit.

<!-- lizenz -->
## Lizenzserver

Bei einem Abo bestätigt die Instanz ihren Schlüssel täglich beim Lizenzserver. Übertragen werden die Kennung der Instanz, das Team und der Schlüssel; die Antwort ist der Tarif mit Laufzeit. Adressen von Anwendern gehen nicht an den Lizenzserver.
<!-- /lizenz -->
<!-- startphase -->
## Lizenzserver

Diese Version fragt keinen Lizenzserver: weder die Kennung der Instanz noch Angaben zu Teams oder Anwendern gehen an journali.
<!-- /startphase -->

## Dateien beim ersten Lauf

Zwei Plugins holen beim ersten Lauf eine Datei aus dem Netz: Einbettungen das Modell (huggingface.co), Texterkennung die Sprachdaten (cdn.jsdelivr.net). Dabei geht keine Produktdatei und kein Wert hinaus; die Adressen sehen nur den Abruf. Ein Rechner ohne Netz bekommt die Dateien kopiert. Beim Einschalten eines dieser Plugins fragt journali nach, mit Zweck, Datei, Adresse und Grösse; ohne Zustimmung bleibt das Plugin aus.

## Geplant

Für Personenbezogenes in Produktdaten ist ein Verfahren vorgesehen, bei dem solche Werte mit einem Schlüssel je Person verschlüsselt im Journal liegen; Löschen heisst dann, den Schlüssel zu vernichten, während das Journal unverändert bleibt.
