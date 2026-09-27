# ocr — Texterkennung für gescannte Dokumente

Ein PDF ohne Textebene ist für die Suche ein Bild. Der Leser (Plugin `docs`) erkennt das und legt es als `scan`
in den Index; dieser Job holt genau diese Dokumente, erkennt ihren Text und legt ihn ab, wo der Leser seinen ablegt —
mit Seiten, Abschnitten und Tabellen. Danach ist ein gescanntes Datenblatt durchsuchbar wie ein gesetztes.

## Wer was tut

- `GET /api/docs/scans` ist die offene Postenliste: Dokumente im Zustand `scan` mit dem Hash, den der Index kennt.
- Der Job lädt die Datei, rendert die Seiten (`pdfjs-dist`, `@napi-rs/canvas`), erkennt sie (`tesseract.js`) und
  baut aus Zeilen und Wortkästen dieselben Abschnitte und Tabellen wie der Leser (`../docs/core.mjs`).
- `PUT /api/docs/{id}` mit `state: text` und `note: "ocr · Vertrauen n %"` schliesst den Posten.

Ein Dokument, in dem nichts zu erkennen ist, wird `fehler` mit dem Grund — sonst käme es in jeder Runde wieder.
`POST /api/docs/retry` gibt Gescheiterte frei (⌕ Dokumente, ✗).

## Wiederaufnahme

Ist keine gebaut und muss keine gebaut werden: die offenen Posten stehen im Index. Ein abgebrochener Lauf lässt sie
offen, der nächste findet dieselben. Anhalten über den Tasker wirkt zwischen zwei Runden.

## Einrichten

Im Plugin-Verzeichnis einmal `npm install`. Die Sprachdaten (`deu`, `eng`, …) holt der erste Lauf in das Verzeichnis
`.cache` des Plugins (`JOURNALI_OCR_CACHE` setzt einen anderen Ort); danach braucht nichts mehr das Netz. Im Paket
liegen die Pakete im Image, `.cache` ist ein Volume.

## Parameter

| Parameter | Bedeutung |
|---|---|
| `limit` | Dokumente je Runde (Vorgabe 10) |
| `langs` | Sprachen der Erkennung, tesseract-Codes mit `+` (Vorgabe `deu+eng`) |
| `scale` | Auflösung beim Rendern: 1 = 72 dpi, 2 = 144 dpi, 3 = 216 dpi (Vorgabe 2) |
| `maxPages` | Seiten je Dokument höchstens (Vorgabe 40) |

Bilder (JPEG, PNG) erkennt der Job ebenfalls, sobald sie in der Liste stehen; heute nimmt der Leser nur Dokumente
in den Index. Ob und wie Bilder hineinkommen, ist offen (pflegestruktur 34 J).
