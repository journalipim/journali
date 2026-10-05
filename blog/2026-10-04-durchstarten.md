---
title: Durchstarten vom ersten Moment an – journali mit Docker Compose und PostgreSQL
excerpt: Zwei Befehle, ein Browserfenster, ein Einrichtungscode – und ihr pflegt Produktdaten. journali kommt als Docker-Paket mit PostgreSQL und bringt mit, was ihr am ersten Tag braucht.
slug: durchstarten
tags: [Betrieb, Docker, PostgreSQL]
categories: [Entwicklung]
wp: 74
---
Kein Installationsmarathon, keine Wochen mit Einrichtung: **journali kommt als Docker-Paket** – Server und PostgreSQL zusammen in einer `compose.yaml`. Zwei Befehle, ein Browserfenster, und ihr pflegt eure ersten Produktdaten.

## Zwei Befehle, und es geht los

```
docker compose pull
docker compose up -d
```

Das war's. Das Image kommt fertig gebaut, die Datenbank ist **PostgreSQL 18 mit der Erweiterung `vector`** – gleich dabei. Und das Datenbankpasswort? **Das erzeugt der erste Start selbst**, zufällig, und legt es in ein eigenes Volume. Niemand denkt sich eines aus, niemand trägt es irgendwo ein. Datenbank, Tabellen und die Erweiterung legt journali selbst an.

Danach öffnet ihr `http://localhost:8080`.

## Ein Code, und ihr seid Administrator

Die Anmeldeseite fragt nach dem ersten Administrator – und nach dem **Einrichtungscode**. Den schreibt der Server in seine Konsole (`docker compose logs server`) und in eine Datei im Datenverzeichnis. Wer den Code sieht, hat ohnehin Zugang zum Server. Wer nur den Port erreicht, kann **weder die Verbindung umlenken noch sich zum Administrator machen**. Ist alles eingerichtet, ist der Code weg.

Steht eure Datenbank woanders? Dann zeigt der Browser den Dialog **Datenbank**: Host, Port, Datenbank, Anmeldename, Passwort – prüfen, speichern, weiter. Ist die Datenbank nur kurz nicht erreichbar, versucht der Server es von selbst weiter.

## Ab der ersten Minute eingerichtet

Ihr startet nicht bei null. journali bringt **eingebaute Vorgaben** mit – und alle stehen als Einträge im Journal, ihr ändert sie also wie alles andere:

- **Modell**: Deutsch und Englisch, die Kanäle Web und Print, Einheiten, Attributgruppen, eine Farbliste mit RAL-Nummern, Relationen wie Zubehör, Bestandteil und Stückliste
- **Rollen**: Administrator, PIM-Manager, PIM-Editor, Team-Admin und Leser
- **Workflows**: Redaktion mit Korrekturschleife und Übersetzung mit einem Zustand je Sprache
- **Vorschauen**: Kachel, Web und Druck für eure Bilder
- **Init Team**: euer erster Administrator gehört hinein – umbenennbar, nicht löschbar

## Plugins: austauschen ohne neues Image

Die Plugins liegen als **Verzeichnis neben dem Paket** – per Bind-Mount im Container. Eine Datei dort tauschen, und das Plugin ist aktualisiert: Der Server liest Manifeste und Module bei jedem Zugriff, eine neue Version zeigt er unter Plugins als ↑ Update. **Kein neues Image, kein neues Deployment.**

Und das Image bringt alle Plugins schon mit – samt den Paketen, die Vorschaubilder, Dokumente, Vektoren und Texterkennung brauchen.

## Medien: dort, wo ihr sie haben wollt

Bilder und Dokumente liegen wahlweise

- **in PostgreSQL** – die Vorgabe; eine Sicherung der Datenbank enthält dann alles,
- **im Dateisystem**,
- **in S3-kompatiblem Object Storage**.

Umgestellt wird unter ⚙ Einstellungen → ▨ Storage. Der Wechsel ist ein Kopierlauf, **ohne neue Ids**. Mehr zu S3 steht in einem eigenen Beitrag.

## Sichern und zurück – auf Knopfdruck

Unter ⚙ Einstellungen → ⇅ B&R sichert ihr auf Knopfdruck: das Journal mit allen Einträgen, die Medien aus der Datenbank, Anmeldungen und Einstellungen, die Plugin-Verzeichnisse. Die Sicherung hängt an nichts – **nicht an der Version von PostgreSQL, nicht am Schema**. Als Job mit Zeitplan erledigt das Plugin Sicherung dasselbe regelmäßig.

Zurück geht sie in ein leeres System, und der Server baut seine Abbilder daraus neu. Auf demselben Weg entsteht eine **Testinstanz neben der Produktion**: Sicherung der Produktion einspielen. Diese Probe zeigt zugleich, ob sich eure Sicherung einspielen lässt – Sicherung, Aufbewahrung und Probe liegen beim Betreiber.

## Auf Unraid? Auch.

Für Unraid liegen **zwei Vorlagen** im Repo: eine für journali, eine für die Datenbank – PostgreSQL 18 mit der Erweiterung `vector`. Die Verbindung tragt ihr beim ersten Aufruf im Einrichtungsdialog ein.

## Neuer Stand? Wieder zwei Befehle.

`docker compose pull && docker compose up -d` – und ihr habt den neuesten Stand. Eure Daten bleiben in ihren Volumes. Und braucht ein Standort einen eigenen Server: Mehrere Server auf einer Datenbank sind ebenfalls drin.

## Und jetzt?

journali ist noch in Entwicklung – durchstarten könnt ihr trotzdem schon vom ersten Moment an. Hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
