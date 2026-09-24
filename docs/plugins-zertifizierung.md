# Zertifizierte Plugins

Ein Plugin ist ein Verzeichnis unter `plugins/<key>/` mit `plugin.json`. Ein **zertifiziertes** Plugin trägt daneben
ein `certificate.json`, das der Herausgeber signiert hat. „Zertifiziert“ ist der Name im Quelltext; **in der Oberfläche
heisst es nie so** — dort steht, was das Siegel wirklich aussagt: **Native journali PIM Plugin**, also ein Original von
journali. „Zertifiziert“ klänge nach einer Prüfstelle, die es nicht gibt. Ein Siegel eines anderen Herausgebers nennt
diesen namentlich. Die Oberfläche zeigt es unter ⌁ Plugins als Siegel ❖;
der Katalog des Herausgebers listet nur zertifizierte Plugins, und der Server holt nur, was ein gültiges Siegel trägt.

## Was das Siegel aussagt

- Schlüssel und Fassung des Plugins sind die, die der Herausgeber geprüft hat.
- Keine Datei im Verzeichnis wurde seither verändert, hinzugefügt oder entfernt.

Mehr nicht. Ein Plugin ohne Siegel läuft genauso; es trägt nur keins. Ein Plugin mit gebrochenem Siegel (⚠) ist
verändert worden — von wem, sagt das Siegel nicht.

## certificate.json

```json
{
 "key": "csv",
 "version": "1.0.0",
 "hash": "ef03…4195",
 "issued": "2026-09-24",
 "issuer": "journali",
 "ignore": ["export"],
 "sig": "H0/C…8CQ=="
}
```

| Feld | Bedeutung |
|---|---|
| `key`, `version` | müssen zum Manifest passen |
| `hash` | SHA-256 über alle Dateien des Verzeichnisses (siehe unten) |
| `issued` | Datum der Ausstellung |
| `issuer` | wer signiert hat |
| `ignore` | Pfade, die sich ändern dürfen (Ausgabeverzeichnisse eines Jobs) — optional, mitsigniert |
| `sig` | ECDSA P-256 über `key\nversion\nhash\nissued\nissuer\nignore,…`, SHA-256, Signatur IEEE P1363 (r‖s), Base64 |

**Hash:** alle Dateien unter dem Verzeichnis ausser `node_modules`, `__pycache__`, `.git`, `certificate.json` und den
Pfaden unter `ignore`; Pfade relativ mit `/`, ordinal sortiert; je Datei `pfad\0sha256hex\n` in einen SHA-256.
`Journali.Server/PluginSeal.cs` und `tools/plugin-cert.mjs` rechnen denselben Hash; der Test
`Core_Plugins_mit_Zertifikat_sind_gueltig` belegt das für jedes Core-Plugin (die mit journali ausgelieferten).

## Schlüssel

Der öffentliche Schlüssel steht in `PluginSeal.DefaultKey`; `JOURNALI_PLUGIN_KEY` (Base64, SubjectPublicKeyInfo)
überschreibt ihn — wer eigene Plugins mit eigenem Schlüssel signiert, setzt ihn dort. Der private Schlüssel liegt
**nie im Repo**: `~/.journali/plugin-signing.pem` oder `JOURNALI_PLUGIN_SIGNING_KEY` (Pfad).

```
node tools/plugin-cert.mjs keys                         Schlüsselpaar erzeugen
node tools/plugin-cert.mjs sign csv xlsx                 signieren (nach dem Bau: entry.js ist Teil des Hashs)
node tools/plugin-cert.mjs sign xport --ignore export    mit veränderlichem Verzeichnis
node tools/plugin-cert.mjs verify                        alle Siegel prüfen
node tools/plugin-cert.mjs catalog ../plugins-katalog    catalog.json und ein Zip je Plugin schreiben
```

Vor dem Commit: `verify` — ein geändertes Plugin wird neu signiert, sonst bricht der Kern-Test.

## Katalog

Der Katalog ist ein Verzeichnis beim Herausgeber mit `catalog.json` und einem Zip je Plugin
(`https://raw.githubusercontent.com/journalipim/plugins/main/catalog.json`; `JOURNALI_PLUGIN_CATALOG` nennt einen
anderen). Der Server liest ihn unter `GET /api/plugins/catalog` (eine Stunde gepuffert, `?fresh=true` lädt neu) und
holt ein Plugin mit `POST /api/plugins/catalog/{key}/fetch` (Recht `plugins`): Zip laden, in ein Temporärverzeichnis
entpacken, Siegel prüfen, dann nach `plugins/<key>/` — ein vorhandenes Verzeichnis wird ersetzt. Installiert und
eingeschaltet wird danach wie jedes Plugin von der Platte. Ohne Netz ist der Katalog leer.

```json
{
 "issuer": "journali",
 "updated": "2026-09-24",
 "plugins": [
  { "key": "csv", "version": "1.0.0", "label": {"de": "…", "en": "…"}, "description": {"de": "…"}, "kind": "import",
    "runs": "browser", "requires": ["table"], "issued": "2026-09-24", "file": "csv-1.0.0.zip" }
 ]
}
```

`file` ist relativ zur `catalog.json`. Das Zip enthält das Verzeichnis `<key>/` mit allen Dateien und dem Zertifikat.

## Fremde Plugins zertifizieren lassen

Wer ein Plugin in den Katalog bringen will, reicht das Verzeichnis ein (Discussions im Katalog-Repo). Geprüft wird,
was das Manifest verspricht, was das Plugin an den Server schickt und dass es keine Kundendaten enthält; dann wird es
signiert und mit Zip in den Katalog gestellt. Der Quelltext des Kerns nimmt keine Pull Requests an
(`.github/workflows/pull-requests.yml`); Ergänzungen sind Plugins.
