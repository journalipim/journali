---
title: journali ist Open Source – Quellcode und Image sind öffentlich
excerpt: journali steht unter der AGPL-3.0: Der Quellcode liegt öffentlich auf GitHub, das Image ist öffentlich – nutzen, ändern, weitergeben und selbst betreiben.
slug: open-source-agpl
tags: [Open Source, Lizenz, GitHub, Betrieb]
categories: [Entwicklung]
date: 2026-10-23 06:00
description: journali ist Open Source unter der AGPL-3.0: Quellcode und Image sind öffentlich – nutzen, ändern, weitergeben und selbst betreiben.
keyphrase: Open Source
wp: 327
---
**journali ist Open Source.** Seit dem 22. Oktober 2026 liegt der Quellcode öffentlich auf GitHub, das Image dazu ist öffentlich, und die Lizenz ist die **GNU Affero General Public License, Version 3 (AGPL-3.0)**. Ihr könnt journali lesen, starten, ändern und selbst betreiben.

## Was die Lizenz erlaubt

- **Nutzen und kopieren:** auf eigenen Servern und im eigenen Unternehmen.
- **Ändern und weitergeben:** ihr dürft journali anpassen und die Fassung weitergeben.
- **Für Dritte betreiben:** auch als gehosteter Dienst für andere.
- **Offen bleiben:** wer eine geänderte Fassung weitergibt oder als Dienst im Netz anbietet, gibt den Nutzern den Quelltext unter derselben Lizenz. Genau dafür ist die AGPL gemacht – für Software, die auf einem Server läuft und im Browser benutzt wird.
- **Hinweise erhalten:** Lizenz- und Urheberhinweise bleiben stehen.

## Was nicht zur Lizenz gehört

- **Der Name „journali PIM“.** Er ist beim Deutschen Patent- und Markenamt als Marke angemeldet. Die Lizenz räumt keine Rechte daran ein: Eine geänderte oder abgeleitete Fassung wird nicht unter diesem Namen weitergegeben oder angeboten.
- **Bibliotheken anderer.** journali enthält Bibliotheken, jede unter ihrer eigenen Lizenz. `THIRD-PARTY-NOTICES.md` nennt sie, die Lizenztexte liegen im Image.
- **Andere Bedingungen.** Wer journali unter anderen Lizenzbedingungen braucht, fragt an – sie sind auf Anfrage möglich.

## Selbst starten

```
git clone https://github.com/journalipim/journali.git
cd journali
docker compose pull
docker compose up -d
```

Danach öffnet ihr `http://localhost:8080`; der erste Besuch legt den Administrator an. Das Image heißt `ghcr.io/journalipim/journali`, die Datenbank ist PostgreSQL 18 aus der `compose.yaml`. Plugins liegen als Verzeichnis daneben, Jobs und Medien in Volumes. Auf Unraid geht es mit Vorlagen: [journali auf Unraid](/2026/10/24/journali-auf-unraid/).

## Erweitern mit Plugins

Erweiterungen sind Plugins: ein Verzeichnis mit Manifest, das nie im Serverprozess läuft. Die mitgelieferten Plugins tragen ein Siegel, das der Server prüft; Siegel und Katalog gelten für die Plugins von journali selbst. Mehr dazu: [Plugins mit Siegel](/?p=160).

## Fehler, Fragen, Sicherheit

Pull Requests nimmt das Repository nicht an. Fehler und Fragen gehören in die Issues auf GitHub, eine Sicherheitslücke meldet ihr vertraulich nach `SECURITY.md`. Schwerwiegende bekannte Fehler stehen in `BEKANNTE-FEHLER.md`.

## Zurzeit ohne Tarife

In der Startphase gibt es keine Tarife und keine Grenzen: Jede Instanz hat den vollen Umfang, ob selbst betrieben oder bei einem Hoster.

## Ein Stand zum Testen

journali ist eine **Testversion** zum Testen und Evaluieren und noch nicht für den produktiven Einsatz freigegeben. Wer nur schauen will, probiert die [Demo im Browser](https://journali.de/journali-testen/) aus – ohne Installation.

## Und jetzt?

Schaut in den Quellcode auf **[GitHub](https://github.com/journalipim/journali)**, startet journali mit Docker Compose oder folgt dem Blog – hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
