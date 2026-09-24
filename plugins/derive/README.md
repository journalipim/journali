# derive — Vorschauen rechnen

Rechnet die Ableitungen der Bilder nach den **Vorschau-Presets** (Einstellungen → Medien) voraus:
Kante (Breite × Höhe, längste Seite eingepasst, nie vergrössert), Format (webp, jpeg, png, avif), Qualität.
Was fehlt, sagt `GET /api/media/pending`; das Ergebnis geht mit `PUT /api/media/{id}/derived/{preset}`
in den Medienspeicher (`sha.<preset>`), der Server schreibt den Beleg `MediaDerived`. Ausliefern:
`GET /api/media/{id}/{preset}`.

Warum ein Prozess: 200-MB-TIFFs aus der Konstruktion rechnet man nicht live und nicht im Serverprozess. sharp (libvips) liest TIFF, PNG, JPEG, WebP, AVIF, GIF, SVG und streamt grosse Bilder.

## Einrichten

    cd plugins/derive
    npm install

Im Container (Linux) baut der `Dockerfile` die `node_modules` für linux-x64; ein unter Windows installiertes
`node_modules` passt dort nicht (native Binärdateien) — der Bind-Mount `./plugins` überdeckt es dann; in dem Fall
`npm install --os=linux --cpu=x64 sharp` auf dem Host oder `node_modules` im Container nachinstallieren.

## Lauf

Der Server stösst den Job `derive` nach jedem Hochladen/Holen an (legt ihn an, wenn er fehlt); ⏱ Jobs → ▶ oder
Einstellungen → Medien → „▶ jetzt rechnen“ von Hand; ein Zeitplan (z. B. nachts) fängt Reste. Rückgabe 0 = alles,
3 = einzelne Bilder scheiterten (im Log), 1 = Abbruch.
