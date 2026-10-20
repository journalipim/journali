# libvips im Plugin derive

Das Plugin `derive` rechnet Vorschauen mit sharp. sharp lädt libvips als eigene, dynamisch gebundene Bibliothek aus dem Paket
`@img/sharp-libvips-linux-x64` (im Image unter `plugins/derive/node_modules/@img/sharp-libvips-linux-x64/lib/`).

## Lizenzen

libvips steht unter der GNU Lesser General Public License 3.0 (`texte/LGPL-3.0.txt`; sie baut auf der GPL-3.0 auf,
`texte/GPL-3.0.txt`). In der Bibliothek enthalten sind weitere Bibliotheken: unter der LGPL-3.0 glib, pango, fribidi, libheif,
librsvg, libexif und proxy-libintl; cairo unter der MPL-1.1 (`texte/MPL-1.1.txt`); die übrigen unter MIT-, BSD-, zlib- und
ähnlichen Lizenzen. Die Liste je Bibliothek steht im Abschnitt „Licensing“ der README des Pakets:
https://github.com/lovell/sharp-libvips#licensing

Welche Versionen im Image liegen, steht in `plugins/derive/node_modules/@img/sharp-libvips-linux-x64/versions.json`
(Stand 05.10.2026: libvips 8.18.7 im Paket 1.3.4).

## Quelltext

journali verwendet libvips und die enthaltenen Bibliotheken unverändert. Der Quelltext liegt bei den Projekten selbst:

- libvips: https://github.com/libvips/libvips — der Tag zur Version aus `versions.json` (z. B. `v8.18.7`)
- der Bau des Pakets mit allen enthaltenen Bibliotheken und ihren Versionen: https://github.com/lovell/sharp-libvips — der Tag zur
  Version des Pakets (z. B. `v1.3.4`)

## Austauschen

libvips ist eine eigene Datei (`libvips-cpp.so.*`), die sharp zur Laufzeit lädt. Wer eine geänderte oder andere Version verwenden
will, ersetzt das Paket oder die Datei; im Container liegt `plugins/` als Bind-Mount, dazu ist kein neues Image nötig.

Die Lizenz von journali (AGPL-3.0, `LICENSE`) gilt nicht für diese Bibliotheken und verbietet weder ihr Ändern noch das Untersuchen
(Reverse Engineering), das zum Beheben von Fehlern in einer geänderten Version nötig ist.
