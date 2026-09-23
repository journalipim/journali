// Welche Fächer ein Job zeigt (Taloan, 23.09.2026: „Überschreiben und Fächer brauch ich doch nur bei Import-Jobs?“).
// Nein — aber der Dialog nannte bisher immer alle vier, auch bei der Sicherung, die nur ablegt. Sie hat ein out-Fach
// (`process.files.out` im Manifest), kein in/: von „in/, done/, failed/“ zu sprechen, führt dort in die Irre.
import test from 'node:test'
import assert from 'node:assert/strict'
import { fachNames, nutztFach } from '../../plugins/tasker/entry.js'

test('wer nur ablegt, hat nur out/ — die Sicherung', () => {
  assert.deepEqual(fachNames({ out: { many: true, param: 'dir' } }), ['out/'])
})

test('wer Dateien frisst, hat Eingang, Erledigt und Gescheitert', () => {
  assert.deepEqual(fachNames({ in: { pattern: '*.json', mode: 'one' } }), ['in/', 'done/', 'failed/'])
})

test('wer beides tut, hat alle vier', () => {
  assert.deepEqual(fachNames({ in: { pattern: '*.csv' }, out: { many: true } }), ['in/', 'done/', 'failed/', 'out/'])
})

test('ohne files gar keine — dann blendet der Dialog den ganzen Block aus', () => {
  assert.deepEqual(fachNames(null), [])
  assert.deepEqual(fachNames(undefined), [])
  assert.deepEqual(fachNames({}), [])
})

// Ein Fach gilt nur, wenn der Job seinen Parameter leer laesst — sonst schreibt oder liest er selbst und der Tasker
// sieht die Dateien nie. Aufbewahrung, latest und Archiv liefen dann ins Leere, standen aber einstellbar da
// (Taloan, 23.09.2026: „das sind genau diese Themen: vorsaetzlich Datenverlust herbeigefuehrt“).
test('eigenes Verzeichnis im Job: das out-Fach gilt nicht mehr', () => {
  const files = { out: { many: true, param: 'dir' } }
  assert.deepEqual(fachNames(files, { dir: '' }), ['out/'])
  assert.deepEqual(fachNames(files, { dir: 'C:/DATA/_jsicherung' }), [])
  assert.equal(nutztFach(files.out, { dir: 'C:/DATA' }), false)
  assert.equal(nutztFach(files.out, {}), true)
})

test('eigene Quelle im Job: das in-Fach gilt nicht mehr', () => {
  const files = { in: { pattern: '*.json', param: 'source' }, out: { many: true, param: 'dir' } }
  assert.deepEqual(fachNames(files, { source: 'C:/ablage/x.json' }), ['out/'])
  assert.deepEqual(fachNames(files, {}), ['in/', 'done/', 'failed/', 'out/'])
})
