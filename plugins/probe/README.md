# probe — Masse der Dateien lesen

Liest aus dem Kopf jeder Datei, was darin steht: Mass in Pixeln, Auflösung in Punkten je Zoll, Farbraum,
Transparenz. Die Angaben stehen danach am Medium (`MediaProbed`) und tragen die Filter der Bibliothek — etwa
„mindestens 2000 px“ — und später den Zuschnitt.

## Wer was tut

Gelesen wird **im Server** (`Journali.Server/MediaProbe.cs`): dort liegen die Bytes, und ein Dateikopf ist eine
Handvoll Felder an festen Stellen — es braucht keine Bibliothek dafür. Dieser Job ist nur der Antrieb. Er ruft
`POST /api/media/probe` in Runden, bis nichts mehr offen ist.

Der Umweg über einen Job hat einen Grund: so führt der **Tasker** die Arbeit. Anhalten, fortsetzen, abbrechen und
ein Zeitplan gelten damit auch für das Lesen der Köpfe, und ein Import von tausend Assets wartet nicht darauf —
er legt die Medien an, der Job liest danach.

## Wiederaufnahme

Ist keine gebaut und muss keine gebaut werden. Die offenen Posten sind die Medien ohne `MediaProbed`, also eine
Frage an das Journal. Ein abgebrochener Lauf, ein Absturz, ein Neustart des Servers: der nächste Lauf findet
genau dieselben Posten. Es gibt keinen Zustand, der mit dem Prozess stirbt.

Ein Format, das der Leser nicht kennt, bekommt seinen Eintrag mit Mass 0 × 0 — sonst bliebe der Posten für immer
offen und jede Runde läse ihn erneut. Kennt eine neue Fassung des Servers mehr Formate, liest `again=true` diese
Medien wieder.

## Gelesene Formate

JPEG, PNG, GIF, WebP, BMP, TIFF. Bei JPEG und TIFF tauscht die EXIF-Orientierung Breite und Höhe, wenn das Bild
quer steht — dieselbe Ansicht, die auch das Plugin `derive` rechnet.

PDF ist nicht darunter: Seitenzahl und Seitenmass stehen dort nicht im Kopf. Sie kommen über `derive` (erste
Seite) und über den Text der Dokumente.

## Parameter

| Parameter | Bedeutung |
|---|---|
| `limit` | Dateien je Runde (Vorgabe 200) |
| `again` | auch die mit Mass 0 × 0 erneut lesen |

Kein `npm install` — der Job braucht nur Node.
