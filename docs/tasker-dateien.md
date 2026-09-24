# Tasker: Dateien rund um die Jobs

**Gebaut 21.09.2026**: `JobFach.cs` (Fächer, Auswahl, Duplikat, Aufräumen, latest,
Aufbewahrung, Archiv), `JobRunner` (vor und nach dem Lauf), `JobFiles` in `JobDefined`, Belege `JobFileConsumed` /
`JobFileWritten` im Abbild `Jobs`, `GET /api/jobs/{key}/files`, Fächer im Job-Dialog und Dateien im Job-Detail (tasker 1.3.0),
Tests `JobFachTests`. Abweichungen vom Entwurf unten: der Vertrag heisst `files.in.param` / `files.out.param` — der
Tasker füllt den **vorhandenen** Parameter (`source`, `dir`), wenn der Job ihn leer lässt; so bleiben die Prozesse
unverändert, und ein Job kann weiterhin einen festen Pfad nennen. Ausgaben: alle Export-Prozesse sind `many: true` —
`{outDir}` ist der Laufordner `out/<key>-<JJJJMMTT>-<HHMMSS>-<lauf>/`, das Plugin benennt darin wie bisher, der Tasker
belegt jede Datei; `latest` ist der Ordner `out/<key>-latest/` (Kopie). Eingänge, die in den letzten 3 s geschrieben
wurden, bleiben liegen (ERP/SFTP schreibt noch). Die vier offenen Entscheidungen sind wie vorgeschlagen umgesetzt.

Entwurf:

„Das Plugin macht die inhaltliche Sache, aber den Dateinamen
müsste der Tasker übernehmen. Beim Import: welche Datei ist dran, welche war
schon, wohin damit — ein Around-Management des Taskers, nicht des Plugins.“

Stand heute (belegt in `plugins/*/plugin.json`, `JobRunner.cs`): jeder
Export-Job baut seinen Dateinamen selbst (`export/job.mjs`: `<job>-<Wurzel>-
<Id>-<Zeit>.xlsx`, behält n), jeder Import-Job bekommt „Quelle: Datei,
Verzeichnis (neueste Datei) oder URL“ und weiss nichts davon, was er schon
hatte. Der Tasker kennt nur Zeitplan, Parameter, Log je Lauf und
`JobRunStarted`/`JobRunFinished` im Journal.

## Das Prinzip

Der Tasker besitzt die **Ablage**, das Plugin besitzt den **Inhalt**. Ein Job
bekommt vom Tasker konkrete Pfade und liest oder schreibt genau dort — nie
ein Verzeichnis, nie eine Namensregel, nie ein „neueste Datei“.

Je Job vier Fächer unter `jobs/<key>/` (Basis `JOURNALI_JOBS`, je Job
überschreibbar, z. B. auf ein Share, auf dem ERP ablegt):

| Fach | Wer schreibt | Was |
|---|---|---|
| `in/` | die Aussenwelt (ERP, SFTP, Hand) | Eingang, wartet auf einen Lauf |
| `done/` | Tasker | verarbeitete Eingänge, umbenannt mit Lauf und Zeit — der Beleg |
| `failed/` | Tasker | Eingänge, deren Lauf scheiterte, mit dem Log daneben |
| `out/` | das Plugin, über `{outFile}` | Ausgaben, benannt vom Tasker |

## Ausgabe (Export)

Namenskonvention, eine für alle Jobs, vom Tasker vergeben:

    <job>-<JJJJMMTT>-<HHMMSS>-<lauf>.<ext>      z. B. json-web-20260921-003000-a1b2c3.json

Das Plugin sagt im Manifest nur die Endung (`files.out.ext`, mehrere
Dateien: `files.out.many: true`, dann ist `{outDir}` ein leerer Laufordner
und der Tasker benennt danach jede Datei mit dem Präfix). Dazu **`latest`**:
nach jedem erfolgreichen Lauf eine Kopie `<job>-latest.<ext>` — der stabile
Name für den, der die Datei abholt (Webserver, Shop). Das ist die Antwort auf
„alle 30 Minuten überschreibe ich die Datei“: Historie bleibt, `latest` ist
immer der aktuelle Stand, und beides ist eine Einstellung, keine Codezeile
im Plugin.

Aufbewahrung, ebenfalls Tasker: `keep: n Läufe` oder `keep: n Tage` oder
`alle`; gelöscht wird nur, was der Tasker selbst geschrieben hat (Präfix
`<job>-`). Das heutige `keep` in `export`, `backup`, `json` wandert dorthin.

## Eingang (Import)

Ein Import-Job sagt im Manifest, was er frisst: `files.in.pattern`
(`*.csv`), `files.in.mode: one | all` (eine Datei je Lauf oder alle
wartenden), `files.in.order: name | time`. Der Tasker

1. sieht vor dem Lauf in `in/` nach; nichts da → kein Lauf (kein leeres
   Log, keine leere Ausleitung), ausser der Job hat `files.in.required:
   false`;
2. wählt die Datei(en), rechnet je Datei den Hash (SHA-256);
3. **Duplikat**: derselbe Hash steht schon als `JobFileConsumed` im Journal →
   die Datei wandert nach `done/` mit Vermerk „schon verarbeitet in Lauf …“,
   ohne Lauf. Das ist das „wie merke ich mir, was schon importiert wurde“:
   nicht am Dateinamen (ERP nennt sie vielleicht immer gleich), sondern am
   Inhalt;
4. startet das Plugin mit `{inFile}` (oder `{inDir}` bei `all`);
5. Erfolg → `done/<JJJJMMTT-HHMMSS>-<lauf>-<originalname>`, Eintrag
   `JobFileConsumed(run, name, hash, bytes)`; Fehler → `failed/…`, Eintrag
   mit `status: failed`. Die Datei ist in beiden Fällen nicht mehr in `in/`,
   ein Wiederholungslauf nimmt nichts doppelt.

Das Plugin tut nur eins: die Datei lesen, die es bekommt.

## Archiv, Beweis

`done/` ist der Beleg auf Platte; wer mehr will, schaltet je Job **Archiv im
Medienspeicher** ein: der Tasker legt die verarbeitete Datei zusätzlich als
Medium ab (Postgres-Blob, Verzeichnis oder S3 — was `JOURNALI_MEDIA` sagt,
`docs/betrieb.md` → Medien), mit Verweis im Journal. Damit ist die
ERP-Lieferung vom 21.09. 00:30 auch dann noch da, wenn das Share
aufgeräumt wurde. Dasselbe für Ausgaben, wenn ein Export als
Nachweis gelten soll (Katalogstand, Datenblatt-Lauf).

## Im Journal (`job:<key>`)

Zwei neue Eintragstypen, beide Belege — die Dateien selbst liegen nicht im
Journal:

| Typ | Nutzdaten |
|---|---|
| `JobFileConsumed` | `run`, `name`, `hash`, `bytes`, `status` (ok/failed/duplicate), `mediaId?` |
| `JobFileWritten` | `run`, `name`, `hash`, `bytes`, `latest: bool`, `mediaId?` |

Daraus baut die Oberfläche je Job den Reiter **Dateien**: Eingang (n
wartend, mit Grösse und Alter), verarbeitet (Datum, Datei, Lauf, Hash,
Duplikate grau), Ausgaben (Datum, Datei, `latest` markiert), und die
Einstellungen (Fächer, Muster, Aufbewahrung, Archiv). Wer eine Datei sucht,
klickt auf den Lauf und ist im Log.

## Manifest (Vertrag Plugin ↔ Tasker)

```json
"files": {
  "in":  { "pattern": "*.csv", "mode": "one", "order": "name", "required": true },
  "out": { "ext": "json", "latest": true }
}
```

Ein Plugin ohne `files` läuft wie heute (Übergang). Die Platzhalter
`{inFile}`, `{inDir}`, `{outFile}`, `{outDir}` füllt der Tasker; `{dir}`
und „Quelle“ verschwinden aus den Import-/Export-Manifesten, sobald sie
umgestellt sind (`export`, `backup`, `json` Import/Export, `rag`, `ixp`).

## Nicht Sache des Taskers

Holen und Bringen über Netz (SFTP, HTTP, Mail) — das ist ein eigener,
kleiner Schritt vor `in/` bzw. nach `out/` („Transport“), den man je Job
anschalten kann, wenn er gebraucht wird. Erst die Fächer, dann der
Transport; ERP legt heute ohnehin auf ein Share.

## Entschieden (21.09.2026, wie vorgeschlagen)

- `latest` ist eine **Kopie** (Links auf Shares sind heikel).
- Duplikat nach Hash: **sichtbar** im Detail (≡, grau, „ohne Lauf“), Datei nach `done/…-dup-…`.
- Fach-Basis je Job frei wählbar (absoluter Pfad auf dem Server, 📁 im Dialog) — für das Share, auf dem ERP ablegt.
- Archiv im Medienspeicher: Vorgabe **aus**, je Job an.

Offen: Transport (SFTP/HTTP/Mail vor `in/` und nach `out/`); `keep` der Plugins (`export`, `backup`, `json`) ist noch
doppelt — die Aufbewahrung des Taskers gilt für den Laufordner, das Plugin-`keep` innerhalb; wer den Tasker nutzt,
lässt das Plugin-`keep` leer.
