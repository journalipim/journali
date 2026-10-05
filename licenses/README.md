# Lizenztexte

Die Lizenzen der fremden Bestandteile, die mit journali im Image liegen. Welche Bestandteile das sind und wofür, steht in
`THIRD-PARTY-NOTICES.md`.

| Verzeichnis | Inhalt |
|---|---|
| `texte/` | die Lizenztexte wörtlich: GPL-3.0, LGPL-3.0, Apache-2.0, MIT (Vorlage), MPL-1.1, die PostgreSQL License von Npgsql |
| `oberflaeche/` | je Paket der Oberfläche seine LICENSE- und NOTICE-Dateien — die Oberfläche ist gebündelt, in `wwwroot` fehlen sie; `PAKETE.txt` nennt Paket, Version und Lizenz |
| `server/` | je NuGet-Paket des Servers seine Lizenz- und Hinweisdateien, sonst der Lizenztext mit dem Copyright des Pakets; `PAKETE.txt` wie oben |
| `libvips.md` | libvips im Plugin `derive`: LGPL, Quelltext, Austausch |

Die Plugins bringen ihre Pakete mit eigenen LICENSE- und NOTICE-Dateien mit (`plugins/<key>/node_modules/<paket>/`).

`oberflaeche/` und `server/` erzeugt `node tools/lizenzen.mjs` aus den installierten Paketen — nach jedem Paketwechsel neu.
