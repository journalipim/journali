# Oberflächensprache und Hilfe — Plan

Stand 24.09.2026, Entwurf. Auslöser: die Screenshots für Lemon Squeezy und der Wunsch nach einer Hilfe in der
laufenden Instanz, die die Community übersetzen kann. Entscheidungen sind als solche markiert; alles andere
ist Vorschlag.

## Was heute da ist

- Die Oberfläche ist deutsch, fest im Quelltext. Gezählt am 24.09.2026 (grob, per grep):

  | Wo | Was | Anzahl |
  |---|---|---|
  | `web/src` (50 .vue, 26 .js) + `plugins/*/src` | `title="…"` | 631 |
  | | `:title="…"` mit Text | 255 |
  | | sichtbarer Text in Templates | ~570 |
  | | Strings in JS (toast, label, hint, placeholder) | ~560 |
  | `Journali.Server` | `Bad("…")` / `Outcome.Bad("…")` | ~330 |

  Zusammen rund 2 300 Texte. Zweisprachig sind heute nur Modell-Saatgut (`Labels.Of(de, en)`), die Plugin-Manifeste
  (`label`/`description` je Sprache) und die Werte im Journal.
- Anwender-Einstellungen liegen je Person im Journal (`PUT /api/auth/me/prefs`, `store.applyPrefs`) — dort gehört die
  Sprache hin (◐ Ich → Dieser Rechner ist falsch: die Sprache hängt an der Person, nicht am Rechner).
- Hilfe: ?-Knöpfe an einigen Stellen (Kurzhilfe je Ansicht), seit heute der ?-Knopf in der Kopfzeile mit Links
  (`web/src/help.js`: journali.de; journalipim.de/.com zeigen nur dorthin).
- Prüfstände, die auf die deutschen Texte bauen: `sichtbare-texte.test.mjs`, `servermeldungen.test.mjs`,
  `kein-name.test.mjs`, `ui-section-stil.test.mjs`. Sie prüfen nach dem Umbau die Sprachdatei statt des Quelltexts.

## Teil 1 — Oberflächensprache

### Mechanik (Vorschlag)

- **Sprachdateien ausserhalb des Codes**: `web/lang/<code>.json` für die Oberfläche, `plugins/<key>/lang/<code>.json`
  je Plugin. Beides liegt im Repo neben dem, was es übersetzt, und wird beim Bau nach `wwwroot/lang/` bzw. mit dem
  Plugin ausgeliefert (im Container ist `plugins/` ein Bind-Mount, also auch dort austauschbar ohne Image).
- **Schlüssel = der deutsche Text.** `t('Knoten wählen — oder oben anlegen.')` liefert in `de` den Text selbst, in
  `en` den Wert aus `en.json`; fehlt er, den deutschen. Gründe: keine 2 300 erfundenen Schlüssel, die Umstellung ist
  mechanisch (Skript), ein Übersetzer sieht den Quelltext, und ein geänderter deutscher Text macht die alte
  Übersetzung sichtbar ungültig — das ist richtig so. Platzhalter wie `{n}` bleiben im Schlüssel.
  *Alternative:* sprechende Schlüssel (`tree.pick_node`) — sauberer, aber Wochen Handarbeit für denselben Effekt.
- **Kein Paket.** `web/src/i18n.js` mit `t()`, Laden der Datei, Umschalten zur Laufzeit — unter 60 Zeilen. vue-i18n
  wäre ein Paket und damit eine Entscheidung; gebraucht wird es nicht (Plural und Datum kommen über `Intl`).
- **Sprache der Person**: `prefs.lang`, Vorgabe aus `navigator.language`, die Anmeldeseite folgt dem Browser. Die
  Sprachen der Oberfläche sind eine eigene Liste (was es an `lang/*.json` gibt), nicht die Sprachen des Modells —
  wer in `fr` pflegt, bedient trotzdem eine englische Oberfläche, wenn es kein `fr.json` gibt.
- **Servermeldungen** (`Bad("…")`) in einer dritten Stufe: der Server schickt weiter den deutschen Text als
  Schlüssel, die Oberfläche übersetzt ihn wie jeden anderen; `Journali.Server/lang/` braucht es erst, wenn jemand die
  API ohne unsere Oberfläche bedient. Bis dahin sind Servermeldungen deutsch.
- **Der Baum und die Werte bleiben, was sie sind** — Modellsprachen sind Daten, nicht Oberfläche
  (`docs/pflegestruktur.md`: „ob der Baum der Oberflächensprache folgen soll, ist offen“).

### Vorgehen

1. `i18n.js`, Sprachwahl unter ◐ Ich, `de.json` als Referenz — plus ein Skript `web/tools/texte-heben.mjs`, das
   `title="…"`, Templatetext und die JS-Strings mechanisch nach `t('…')` umschreibt und `de.json` daraus füllt.
   Prüfstand: kein deutscher Text mehr ausserhalb von `t()` (Umlaute, Artikel), jeder Schlüssel in `en.json` existiert
   in `de.json`, kein Schlüssel in `de.json` ohne Verwendung.
2. `en.json`: maschinell vorübersetzt, dann durchgesehen — ein Text ist höchstens ein Satz, Symbole bleiben.
3. Plugins, dann Servermeldungen.
4. Community: eine neue Sprache ist eine Datei; der Prüfstand sagt, was fehlt. Auf Git ein `lang/README` dazu.

## Teil 2 — Hilfe in der Instanz

### Mechanik (Vorschlag)

- **Kapitel als Markdown** unter `help/<code>/NN-<slug>.md` im Repo (Wurzel, neben `docs/`). `de` ist die Referenz,
  `en` die zweite Sprache, weitere kommen aus der Community — dieselbe Sprachliste wie die Oberfläche; fehlt ein
  Kapitel in einer Sprache, kommt das englische, dann das deutsche.
- **Beim Bau nach HTML**: `node build-help.mjs` rendert nach `wwwroot/help/<code>/<slug>.html` plus `index.json`
  (Titel, Reihenfolge). Zur Laufzeit braucht es dann kein Markdown-Paket; beim Bau eines (`marked`, nur
  devDependency — sonst ein eigener kleiner Renderer für Überschrift, Absatz, Liste, Link, Bild,
  Code).
- **Ansicht `/help/:kapitel`**: links die Kapitel, rechts der Text, Suche über alle Kapitel (Text ist ja da).
- **Kontextsensitiv, billig**: jede Ansicht nennt ihr Kapitel (`help: 'baum'` im Routeneintrag bzw. im
  Plugin-Manifest). Der ?-Knopf in der Kopfzeile zeigt als ersten Eintrag „Hilfe zu dieser Ansicht“, dann
  „Alle Kapitel“, dann die Links. Die bestehenden ?-Knöpfe in den Ansichten bleiben (Kurzhilfe an Ort und Stelle).
- **Links im ?-Menü** (`help.js`): Website · Docker-Image · Quelltext auf Git · Fragen und Diskussion (Git
  Discussions) · Fehler melden (Git Issues). Adressen für Docker und Git gibt es noch nicht — bis dahin stehen sie
  als Platzhalter mit `hint` „noch nicht veröffentlicht“ drin und werden nicht angezeigt.

### Kapitel (Entwurf — deutsch zuerst, englisch dazu)

| Nr | Kapitel | Inhalt |
|---|---|---|
| 00 | Was journali ist | das Journal als Wahrheit, Abbilder, warum nichts verloren geht; eine Seite |
| 01 | Erste Schritte | die Reihenfolge nach der Installation: Admin und Passwort, Init Team, Sprachen und Kanäle, Attributgruppen und Attribute, Wertelisten, Baum anlegen oder importieren, Medien, Publikationsbaum, Export |
| 02 | Anwender, Rollen, Teams | Anwender vs. Rolle vs. Team, Rechte je Rolle, Init Team, Manager vs. Mitglied, Zahlerkette, API-Token, Dienst-Token für Jobs |
| 03 | Das Modell | Attribute, Typen, Achsen Sprache × Kanal, Master und Fallback, Gruppen am Baum, Sichten, Einheiten, Status |
| 04 | Der Baum | Gruppen, Produkte, Varianten, Achsen, Vererbung, das ★ am Namen, Kennungen, Umhängen, Zurückziehen |
| 05 | Werte pflegen | Zellen, Tastatur, Matrix Sprache × Kanal, Stapel, Rückgängig, Relationen |
| 06 | Medien | Bibliothek, Zuordnung, Vererbung an Subitems, Presets und Ableitungen, Speicherorte |
| 07 | Import und Export | Tabelle (CSV, Excel, JSON, Zwischenablage), Datenmapper, Profile, Plan vor dem Schreiben, JSON-Export als Sicherung, Vorlagen-Export |
| 08 | Freigabe und Publikation | Pflichtfelder, Freigabe je Kanal × Sprache, Publikationsbäume, Märkte, Versionen mit Belegen |
| 09 | Workflows | Zustände, Übergänge, Rollen, Wirkungen, je Sprache |
| 10 | Jobs | Tasker, Zeitplan, Fächer, Logs, was Jobs kosten und was nicht |
| 11 | Plugins | was ein Plugin ist, an/aus, Basis-Plugins und Ergänzungen, was der Tarif erlaubt |
| 12 | Nutzungslimits und Lizenzierung | Token = Journaleinträge, was zählt und was nicht, Woche/Monat, Tarife und Grenzen, Test, Kostenlos, Lizenzschlüssel, Reset, Abo je Team, ohne Internet, 7 Tage Kulanz |
| 13 | Sicherung und Wiederherstellung | von Hand (⇅ B&R), als Job (backup), was gesichert wird, zurück in ein leeres System, Spiegel und Schnappschuss |
| 14 | Datenschutz | was journali über Personen speichert, crypto-shredding (geplant), KI-Schlüssel und Volumen |
| 15 | Lizenz | Elastic License 2.0 in drei Sätzen, Zusatzerlaubnis Hosting; Wortlaut in `LICENSE` |
| 16 | Tastatur | die Kürzel der Leiste, des Baums, der Zellen |
| 17 | Glossar | Anwender, Team, Kanal, Achse, Fassung, Kennung, Abbild, Strom … |

Nicht in die Hilfe: Installation, Docker, Voraussetzungen, Update — das ist die README auf Git (wer die Hilfe liest,
hat eine laufende Instanz). Regeln für die Texte wie in der Oberfläche: kein Name, kein Zitat, keine Belehrung —
der Prüfstand `kein-name.test.mjs` liest auch `help/`.

## Teil 3 — auf Git

- README als Installationsanleitung: Voraussetzungen, `compose.yaml`, Umgebungsvariablen, erster Start mit
  `JOURNALI_ADMIN_PASSWORD`, Update, Sicherung; Verweis auf die Hilfe in der Instanz.
- Discussions statt Forum, Issues statt Support-Postfach.
- `LICENSE` in der Wurzel (heute gibt es keine), Lizenzhinweis im Startbanner und unter Hilfe → Lizenz.

## Entschieden

1. **Schlüssel = deutscher Text.** Keine de.json — die Quellen sind die Referenz; `tools/texte-pruefen.mjs` sagt je
   Sprache, was fehlt und was verwaist ist; `test/sprachdateien.test.mjs` hält die Dateien sauber.
2. **vue-i18n als Paket** — mit eigenem Nachrichten-Übersetzer (`{0}`, `{name}`; kein Maskieren von `{ | @`) und
   flachem Auflöser (Punkte im Schlüssel). Fehlt ein Schlüssel, ist er selbst die Nachricht — der Rückfall auf Deutsch.
3. **`marked` als devDependency** für die Hilfe beim Bau.
4. **Lizenz: Elastic License 2.0 plus veröffentlichte Zusatzerlaubnis für Hosting.** Nicht AGPL — sie erlaubt Forks,
   die Limits entfernen und neu veröffentlichen. ELv2 verbietet genau das Umgehen der
   Lizenzschlüssel-Funktion; das Hosting-Verbot der ELv2 hebt die Zusatzerlaubnis auf — Hoster (etwa Hetzner) dürfen
   journali als Paket anbieten, die Tarife kaufen die Kunden weiter bei journali. Einzelne Verträge daneben bleiben
   möglich, solange journali alleiniger Rechteinhaber ist (Beitragsvereinbarung/CLA für Beiträge). Keine Rechtsberatung.
5. **Adressen** für Docker-Image und Git kommen, sobald es sie gibt (Platzhalter in `help.js`).
6. **Servermeldungen bleiben deutsch** bis Stufe 3.

Stand: Stufe 1 gebaut am 24.09.2026 — `web/src/i18n.js`, Sprachwahl unter ◐ Ich (`store.lang`, an der Person),
`tools/texte-heben.mjs` hat 1 059 Stellen in 48 Vorlagen nach `$t('…')` gehoben (925 Schlüssel); 279 Stellen mit Text in
Ausdrücken und die Strings im `<script>` sind Handarbeit (Liste: `node tools/texte-heben.mjs --dry`). `public/lang/en.json`
ist die erste Sprachdatei.

Stufe 2/2b gebaut am 24.09.2026: `tools/texte-heben-ausdruecke.mjs` hebt Zeichenketten in Ausdrücken und im Skriptteil
(1 284 Stellen); `en.json` ist mit allen 2 019 Schlüsseln der Oberfläche übersetzt (`node tools/texte-pruefen.mjs en`).
Was noch deutsch ist: `ScriptEditor.vue` (regulärer Ausdruck im Vorlagen-Literal, Handarbeit), mehrzeilige Texte
(KI-Prompts, Meldungen mit Umbruch), das `<script>` von Modulen, deren Konstanten beim Laden gerechnet werden
(sie zeigen nach dem Sprachwechsel bis zum Neuladen die alte Sprache), die Plugins (`plugins/*/src`, `plugins/*/entry.js`)
und die Servermeldungen (Stufe 3). Für Plugins: `t` steht in `window.journali` (host.js), fehlt aber noch im Shim
`HOST_NAMES` von `build-plugins.mjs` und als `ctx.t` für Plugins ohne Bau; Sprachdateien je Plugin unter
`plugins/<key>/lang/<code>.json` muss `setLang` mitladen.

Stufe 3 gebaut am 24.09.2026: Plugins übersetzt (17 Sprachdateien `plugins/<key>/lang/en.json`), `t`/`L`/`setLang`
im Shim, Bezeichnungen des Modells folgen der Oberflächensprache (`L()`).

Teil 2 gebaut am 24.09.2026: 18 Kapitel unter `help/de` und `help/en`, `web/build-help.mjs` baut sie zu
`wwwroot/help/<code>/`, `HelpPanel.vue` als Fenster über der Ansicht (seit 25.09.2026; davor eine Ansicht unter `/help/:chapter`), der ?-Knopf öffnet das Kapitel zur Ansicht
(`help.js: chapterFor`). `LICENSE` in der Wurzel (ELv2 plus Zusatzerlaubnis). Offen: README zur Installation
auf Git, Lizenzhinweis im Startbanner, `ScriptEditor.vue`, mehrzeilige Texte, Servermeldungen (Stufe 4).

Stufe 4 gebaut am 24.09.2026: Servermeldungen kommen als `{ error, template, args }` — die Vorlage ist der deutsche Text
und damit der Schlüssel in `en.json`, `api.js` (`serverText`) übersetzt und füllt die Werte; `Bad("…{0}…", x)`,
`Err(…)`, `Outcome.Bad(…)` im Server, `texte-pruefen.mjs` liest die Schlüssel aus `Journali.Server`. `ScriptEditor.vue`
ist übersetzt. Deutsch bleiben Meldungen aus Ausnahmen mit Werten (`$"…"` in `throw`) und die Job-Läufe (`JobRunner`).
