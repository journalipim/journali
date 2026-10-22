---
title: Wo ihr journali findet – Webseite, Blog und GitHub
excerpt: journali.de für alles, was entsteht, GitHub für den öffentlichen Quellcode unter AGPL-3.0 – hier ist der Überblick, wo was zu finden ist.
slug: wo-ihr-journali-findet
tags: [GitHub, Betrieb, Architektur]
categories: [Entwicklung]
wp: 124
description: journali.de für alles, was entsteht, und GitHub für den öffentlichen Quellcode unter AGPL-3.0 – der Überblick, wo was zu finden ist.
keyphrase: GitHub
---
journali hat mehrere Orte, an denen ihr es findet. Hier ist der Überblick: **wo was liegt – und dass der Quellcode seit dem 22. Oktober 2026 öffentlich ist.**

## journali.de – hier passiert alles zuerst

Auf **[journali.de](https://journali.de)** zeigen wir, was entsteht:

- **[Entwicklung](https://journali.de/category/entwicklung/)** – jede neue Funktion als eigener Beitrag: vom [Journal als Single Source of Truth](https://journali.de/2026/09/01/journal-single-source-of-truth/) über den [Datenblatt-Designer](https://journali.de/2026/10/04/datenblatt-designer/) bis zu [mehreren Servern auf einer Datenbank](https://journali.de/2026/10/04/multi-server/).
- **[Wissen](https://journali.de/category/wissen/)** – Fachartikel zu den Themen, die Produktdaten gerade verändern: [Digitaler Produktpass](https://journali.de/2026/09/06/digitaler-produktpass-erklaert/), [Verpackungsverordnung](https://journali.de/2026/09/06/ppwr-verpackungsverordnung-erklaert/), [EmpCo](https://journali.de/2026/09/05/empco-umweltaussagen-erklaert/), [GEO](https://journali.de/2026/09/26/geo-generative-engine-optimization-erklaert/) und [MCP](https://journali.de/2026/09/20/mcp-model-context-protocol-erklaert/).
- **[Demo](https://journali.de/journali-testen/)** – journali im Browser ausprobieren, ohne Installation.

## GitHub – Quellcode, Image und Katalog

Auf GitHub ist journali unter **[github.com/journalipim](https://github.com/journalipim)** zu Hause:

- **[journalipim/journali](https://github.com/journalipim/journali)** – der **Quellcode** von journali: Kern, Server, Oberfläche und die mitgelieferten Plugins. Das Repository ist auf Englisch geführt (`README.md`); die deutsche Fassung steht in `README.de.md`.
- **`ghcr.io/journalipim/journali`** – das **Image** zum Starten mit Docker. Es ist öffentlich, `docker compose pull` genügt.
- **[journalipim/plugins](https://github.com/journalipim/plugins)** – der **Katalog der zertifizierten Plugins**. Jedes Plugin liegt dort als Paket mit seinem Zertifikat; journali liest den Katalog und zeigt, welche Plugins es gibt und welche Version die neueste ist.

## Die Lizenz: AGPL-3.0

journali steht unter der **GNU Affero General Public License, Version 3** – einer Open-Source-Lizenz. Ihr dürft journali nutzen, ändern und weitergeben; wer eine geänderte Fassung weitergibt oder als Dienst im Netz anbietet, gibt den Nutzern den Quelltext unter derselben Lizenz. Andere Lizenzbedingungen sind auf Anfrage möglich, und der Name „journali PIM“ ist als Marke angemeldet und von der Lizenz ausgenommen. Mehr dazu: [journali ist Open Source](/2026/10/23/open-source-agpl/).

Pull Requests nimmt das Repository nicht an; Fehler und Fragen gehören in die Issues auf GitHub, Sicherheitslücken meldet ihr vertraulich nach `SECURITY.md`.

## Unraid

Für Unraid gibt es Vorlagen für journali, die Datenbank und den Dienst eines Produktberaters. Sie sind bei den Community Applications eingereicht, die Prüfung läuft. Bis dahin kopiert ihr sie aus dem Repository: [journali auf Unraid](/2026/10/24/journali-auf-unraid/).

## Und jetzt?

Folgt journali auf **[GitHub](https://github.com/journalipim)** und hier im Blog – hier entsteht etwas ganz Großes, und ihr könnt dabei sein: [Bleibt dran](/#kontakt).
