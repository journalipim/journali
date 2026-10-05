# Fremde Bestandteile und ihre Lizenzen

journali selbst steht unter der Elastic License 2.0 mit einer zusätzlichen Erlaubnis (`LICENSE`). Diese Datei nennt,
was von anderen kommt, unter welcher Lizenz und woher — und dankt allen, die es geschrieben haben.

Die Lizenztexte liegen im Image unter `licenses/` (`licenses/README.md`): die Texte selbst, je Paket der Oberfläche und
des Servers seine Lizenz- und Hinweisdateien (auch die NOTICE-Dateien der Apache-Pakete) und die Angaben zu libvips. Die
Plugins bringen ihre Pakete mit deren eigenen LICENSE- und NOTICE-Dateien mit (`plugins/<key>/node_modules/<paket>/`).
Die Liste hier nennt die direkten Abhängigkeiten; die vollständige Liste mit Versionen steht in
`licenses/oberflaeche/PAKETE.txt` und `licenses/server/PAKETE.txt`.

## Beim ersten Lauf geladen, nicht im Image

Diese Dateien gibt journali nicht weiter. Der Server des Betreibers holt sie beim ersten Lauf des Plugins selbst
und legt sie in den Cache des Plugins (`docs/betrieb.md`, „Plugins im Container“).

| Bestandteil | Wofür | Quelle | Lizenz |
|---|---|---|---|
| multilingual-e5-small (ONNX-Umwandlung `Xenova/multilingual-e5-small` von `intfloat/multilingual-e5-small`) | Plugin `embed`: Vektoren für die Suche nach Sinn | huggingface.co | MIT (Original `intfloat/multilingual-e5-small`) |
| Sprachdaten der Texterkennung (`@tesseract.js-data/<sprache>`) | Plugin `ocr` | cdn.jsdelivr.net | MIT (laut Paket) |

## Im Image enthalten

### Server (.NET)

| Paket | Version | Lizenz |
|---|---|---|
| Npgsql | 10.0.3 | PostgreSQL License |
| MailKit | 4.18.0 | MIT |
| MimeKit (von MailKit) | 4.18.0 | MIT |
| BouncyCastle.Cryptography (von MimeKit) | 2.7.0 | MIT |
| Microsoft.Bcl.Cryptography, System.Formats.Asn1, System.Security.Cryptography.Pkcs, System.Diagnostics.DiagnosticSource, Microsoft.Extensions.*.Abstractions (von Npgsql und MimeKit) | 8.0 bis 10.0 | MIT |

Dazu die .NET-Laufzeit und ASP.NET Core aus dem Basis-Image `mcr.microsoft.com/dotnet/aspnet` (MIT) und die
Node.js-Binärdatei aus `node:22-bookworm-slim` (MIT, mit den Lizenzen ihrer Bestandteile in Node.js selbst).

### Oberfläche (im gebauten Paket unter `wwwroot`)

| Paket | Version | Lizenz |
|---|---|---|
| vue | 3.5.42 | MIT |
| vue-router | 4.6.4 | MIT |
| vue-i18n | 11.4.12 | MIT |
| pdfjs-dist | 4.10.38 | Apache-2.0 |

### Plugins

| Paket | Version | Plugin | Lizenz |
|---|---|---|---|
| @huggingface/transformers | 4.3.0 | embed | Apache-2.0 |
| onnxruntime-node, onnxruntime-common (von transformers) | 1.30.0 | embed | MIT |
| sharp | 0.35.5 | derive | Apache-2.0 |
| libvips (in `@img/sharp-libvips-*`, von sharp) | — | derive | LGPL-3.0-or-later |
| @napi-rs/canvas | 0.1.100 | derive, ocr | MIT |
| pdfjs-dist | 4.10.38 | derive, docs, ocr | Apache-2.0 |
| tesseract.js, tesseract.js-core | 5.1.1 | ocr | Apache-2.0 |

libvips ist dynamisch gebunden und liegt als eigene Bibliothek im Paket `@img/sharp-libvips-*`; sie lässt sich dort
austauschen. Sie enthält weitere Bibliotheken unter LGPL-3.0, MPL-1.1, MIT, BSD und ähnlichen Lizenzen. Lizenzen, Versionen,
Quelltext und Austausch: `licenses/libvips.md`. Die Lizenz von journali schränkt die Rechte aus der LGPL nicht ein (`LICENSE`,
Abschnitt „Third-party components“).

## Danke

An alle, die diese Bausteine geschrieben haben und pflegen — ohne sie gäbe es journali in dieser Form nicht.
