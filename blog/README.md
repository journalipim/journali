# Blog und Seiten auf journali.de

Die Seite läuft mit WordPress. Beiträge und Seiten entstehen hier und kommen als **Entwurf** dorthin; veröffentlicht wird in WordPress,
nachdem Screenshots dazugekommen sind. Das Werkzeug ist `tools/blog.mjs` (Node, ohne Pakete).

## Zugang

Ein Anwendungspasswort aus WordPress: Benutzer → Profil → Anwendungspasswörter. Es steht nie im Repo, sondern in
`%USERPROFILE%\.journali\wordpress.json`:

```json
{ "url": "https://journali.de", "user": "<Anmeldename>", "password": "xxxx xxxx xxxx xxxx xxxx xxxx" }
```

Alternativ die Umgebungsvariablen `JOURNALI_WP_URL`, `JOURNALI_WP_USER`, `JOURNALI_WP_PASSWORD`. `node tools/blog.mjs check` prüft die
Anmeldung. Anwendungspasswörter verlangt WordPress über HTTPS.

## Meta-Beschreibung und Keyphrase

Das SEO-Plugin der Seite zeigt Suchmaschinen eine Meta-Beschreibung, höchstens 155 Zeichen. Bei einem Beitrag kommt sie aus `description:` im
Kopf, sonst aus `excerpt:`, wenn der Auszug höchstens 155 Zeichen hat; ist er länger, braucht der Beitrag eine `description:`. Die
Fokus-Keyphrase steht in `keyphrase:` — wörtlich in Titel und Beschreibung, je Beitrag eine andere (sonst meldet das Plugin, dass sie schon
verwendet wird). Die Seiten haben beides in `site/seiten-beschreibungen.json`. `draft` setzt es beim Anlegen; für alles andere:

```
node tools/blog.mjs meta --dry        zeigt, was gesetzt würde
node tools/blog.mjs meta              alle Beiträge in blog/ und alle Seiten
node tools/blog.mjs meta blog/<datei>.md --replace
```

Was in WordPress schon anders steht, bleibt — es kann dort geschrieben sein. `--replace` überschreibt es.

## Beiträge

Ein Beitrag ist eine Markdown-Datei in `blog/`, Name `JJJJ-MM-TT-<slug>.md`, mit Kopf:

```markdown
---
title: Mehrere Server auf einer Datenbank
excerpt: Ein Satz für Übersicht und Suchmaschinen.
tags: [Betrieb, Lizenz]
categories: [Entwicklung]
---
## Abschnitt

Text mit **fett**, *kursiv*, `Code` und [Verweis](https://journali.de).

![Screenshot: Reiter Server mit zwei Servern]()
```

- `date: 2026-10-07` (optional, auch `2026-10-07 14:30`) setzt das Veröffentlichungsdatum: Ein Datum ohne Uhrzeit gilt für 09:00. Der Beitrag bleibt Entwurf; wer ihn in WordPress
  veröffentlicht, veröffentlicht ihn zu diesem Datum, liegt es in der Zukunft, ist er geplant. Ohne `date` gilt der Tag der Veröffentlichung.
- `# ` und `## ` werden Überschrift 2 (der Titel ist Überschrift 1), `### ` Überschrift 3.
- Listen, nummerierte Listen, Code (```), Zitate (`>`), Trennlinie (`---`) und Tabellen werden Blöcke des Editors.
- `![Screenshot: …]()` ohne Adresse wird ein leerer Bildblock; darüber steht kursiv, was hinein soll. Den Hinweis löscht, wer das Bild einsetzt.

`node tools/blog.mjs draft blog/<datei>.md` legt den Entwurf an und schreibt seine Nummer als `wp: …` in den Kopf. Ein zweiter Aufruf legt
keinen zweiten Beitrag an; `--replace` schreibt einen Entwurf neu — was in WordPress daran geändert wurde, ist dann weg. Einen
veröffentlichten Beitrag ändert das Werkzeug nicht. `node tools/blog.mjs drafts` listet die Entwürfe.

## Seiten und ihr CSS

Eigene Seiten (die Startseite aus `site/index.html` und weitere) stehen in einem Block „Individuelles HTML“ in `<div class="jx"><div class="inhalt">`.
Ihre Regeln stehen einmal im CSS-Plugin und gelten nur unter `.jx` — das Theme bleibt unberührt.

- `node tools/blog.mjs css site/index.html` schreibt `site/wordpress.css`: das CSS der Seite, jede Regel unter `.jx`, ohne dunklen Modus (den
  bestimmt das Theme). Der Inhalt kommt ins CSS-Plugin; nach einer Änderung am CSS wieder.
- `node tools/blog.mjs page site/index.html` legt die Seite als Entwurf an: der Inhalt von `<main>`, dazu JSON-LD. Kopf und Fuß bringt das
  Theme; relative Adressen (`logo-128.png`, `impressum.html`) gelten ab der Wurzel der Seite — die Dateien bleiben dort liegen.
- Eine Seite in voller Breite braucht im Theme die Vorlage ohne Seitenleiste.

Weitere Seiten verwenden dieselben Klassen (`hero`, `eyebrow`, `grid`, `card`, `steps`, `two`, `journal`, `kicker`, `cta` …) und brauchen kein
eigenes CSS.

## Inhalt

**Ein Beitrag ist Werbung, kein Handbuch** (04.10.2026): er zeigt, was ein Feature bringt, mit Begeisterung — kurze Abschnitte, Überschriften mit
Aussage, das Wichtigste fett, am Ende ein Verweis auf die Seite. Angesprochen wird mit „ihr“ wie auf der Startseite. Jede Aussage stimmt trotzdem:
nichts, was journali nicht kann. Die sachliche Beschreibung steht in `docs/` und in der Hilfe.

**Leitgedanke: Zukunft hat Herkunft** (16.10.2026). In journali stecken Erfahrungen aus 40 Jahren Programmierung, Arbeit mit Produktdaten
und Berufspraxis. Das gehört in die Begründung, nicht als Schlagwort in jeden Beitrag: dort, wo eine Entscheidung aus dieser Erfahrung kommt –
etwa das Journal, weil überschriebene Daten in der Praxis immer wieder Ärger machen, oder die Pflege wie in einer Tabelle, weil Fachabteilungen so
arbeiten. Formuliert ohne Namen und ohne Person: „In journali stecken Erfahrungen aus 40 Jahren …“ oder mit „wir“, nicht „der Entwickler …“.
Es ersetzt nicht den Nutzen: zuerst das Problem und was es löst (Merkmal, Vorteil, Nutzen), die Herkunft sagt, warum man darauf vertrauen kann.

**Wortwahl wörtlich prüfen**: eine Überschrift wird im Alltagssinn gelesen. Nicht „Das Journal ist die Wahrheit“, sondern „Single Source of
Truth“; nicht „Belege“ (Kassenquittung), sondern eingefrorene Dokumente; nicht „mitlaufen“, sondern „mitwachsen“; nicht „ein Paket, das läuft“,
sondern „durchstarten vom ersten Moment an“.

**Kein Startdatum des Projekts** (Datum des ersten Commits, „seit wenigen Wochen“): es wirkt wie schnell zusammengebaut. Zahlen wie Commits und
Tests stehen ohne Zeitraum.

**Fachartikel (Kategorie Wissen)** enden vor „## Quellen“ mit `*Erstellt mit Unterstützung von KI.*` (05.10.2026) — nach dem Hinweis
zur Rechtsberatung, wo es einen gibt. In WordPress steht der Satz in kleiner Schrift.

**Nicht öffentlich** (04.10.2026): das Plugin und die Schnittstelle **IXP** — eine interne Schnittstelle. Sie kommt in keinem Beitrag und
auf keiner Seite vor.

**Keine Platzhalter für Screenshots** — die setzt ein, wer den Entwurf in WordPress fertig macht, an der Stelle, die er für richtig hält.

Wie überall im Projekt: kein Name, kein Zitat, keine Beschreibung, wer sich etwas gewünscht hat; fremde Produkte nicht als Vergleich.
