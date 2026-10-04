---
title: S3 Object Storage ready – eure Medien liegen, wo ihr wollt
excerpt: Bilder und Dokumente in PostgreSQL, im Dateisystem oder in jedem S3-kompatiblen Speicher – umgestellt in den Einstellungen, umgezogen per Kopierlauf, und keine einzige Id ändert sich.
slug: s3-object-storage
tags: [Medien, Storage, Betrieb]
categories: [Entwicklung]
wp: 49
---
Produktbilder, Datenblätter, Zertifikate, riesige TIFFs aus der Fotoproduktion – Medien wachsen schneller als alles andere. **Bei journali entscheidet ihr, wo sie liegen:** in PostgreSQL, in einem Verzeichnis auf dem Server oder in jedem S3-kompatiblen Object Storage. Und wenn ihr später woanders hinwollt, zieht ihr einfach um.

## Drei Speicher, eine Schnittstelle

- **PostgreSQL** – die Vorgabe. Die Bytes liegen in einer eigenen Tabelle neben dem Journal. Ein Paket, sofort lauffähig, und ein `pg_dump` sichert alles.
- **Verzeichnis** – ein Ordner auf dem Server, sauber aufgeteilt in Unterordner.
- **S3-kompatibel** – zum Beispiel Garage, MinIO, AWS, R2 oder Hetzner. Bucket, Endpoint, Key und Secret eintragen, fertig. Pfad-Stil oder Bucket als Subdomain, beides geht.

Für S3 bringt journali **kein SDK und kein zusätzliches Paket** mit: Die Anfragen signiert journali selbst nach Signature V4.

## Das Journal kennt nur den Hash

Jede Datei wird über ihren **SHA-256** adressiert. Im Journal steht nur dieser Hash, nie die Datei selbst. Das hat zwei schöne Folgen:

- **Gleiche Bytes, ein Medium.** Lädt jemand dasselbe Bild zweimal hoch, liegt es trotzdem nur einmal im Speicher.
- **Der Speicher ist austauschbar.** Weil der Hash zugleich der Schlüssel im Speicher ist, ist es dem Journal egal, ob die Bytes in PostgreSQL, im Verzeichnis oder im Bucket liegen.

## Umschalten mit zwei Klicks

Unter Einstellungen → **▨ Storage** wählt ihr den Treiber, tragt den Zugang ein und klickt auf **Prüfen**. journali sagt sofort, ob alles stimmt – und wenn nicht, warum: falscher Schlüssel, Bucket fehlt, Endpoint nicht erreichbar.

Beim **Speichern** baut journali den neuen Speicher, prüft ihn noch einmal und **übernimmt ihn erst dann**. Ein Tippfehler legt euch also nicht die Medien lahm.

## Umziehen per Kopierlauf – die Ids bleiben

Ihr startet mit PostgreSQL und der Bestand wird groß? Dann stellt ihr auf S3 um und startet in **▨ Assetmigration** den Kopierlauf aus dem alten Speicher:

1. journali geht alle Schlüssel der Quelle durch.
2. Was im neuen Speicher schon liegt, wird übersprungen.
3. Was fehlt, wird herüberkopiert.

Am Ende seht ihr: so viele kopiert, so viele bereits vorhanden, so viele fehlgeschlagen. **In der Quelle wird nichts gelöscht.** Und das Beste: **Keine Id ändert sich, kein Journaleintrag ändert sich.** Jede Relation, jedes Produktbild, jedes verknüpfte Datenblatt stimmt nach dem Umzug genau wie vorher.

Ob wirklich alles da ist, zeigt **Fehlbestand zählen** in ▩ Assets: entweder „alle vorhanden“ oder die Liste dessen, was noch fehlt.

## Vorschauen ziehen mit

Aus jedem Bild und jedem PDF rechnet das Plugin **derive** die Ableitungen nach euren **Vorschau-Presets** – ab Werk eine Kachel mit 256 Pixeln, eine Web-Fassung mit 1200 und eine Druckfassung mit 3000 Pixeln. Gerechnet wird nach jedem Hochladen, **nie im Server selbst**.

Die Ableitungen liegen **im selben Speicher** wie die Originale, unter dem Hash plus Preset. Damit gehen sie beim Kopierlauf **automatisch mit** – kein Neurechnen nach dem Umzug.

## Ein Journal, ein Speicher – für alle Server

Die Einstellung des Medienspeichers liegt im **Tresor**: verschlüsselt in der Datenbank, **nie im Journal**. Das Secret bekommt der Browser nicht zu sehen; er erhält nur einen maskierten Wert.

Und weil alle Server auf derselben Datenbank denselben Tresor lesen, gilt die Einstellung **für alle Server gleich**. Stellt einer um, folgen die anderen **binnen 10 Sekunden** – ohne Neustart. So liegen nie Bytes mal hier, mal dort.

Umstellen darf, wer das Recht **Storage** hat. Wer es nicht hat, sieht den Reiter gar nicht erst.

## Und jetzt?

journali ist noch in Entwicklung – S3 Object Storage steckt schon drin. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
