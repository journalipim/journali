// Welche Fächer ein Job zeigt (Taloan, 23.09.2026: „Überschreiben und Fächer brauch ich doch nur bei Import-Jobs?“).
// Nein — aber der Dialog nannte bisher immer alle vier, auch bei der Sicherung, die nur ablegt. Sie hat ein out-Fach
// (`process.files.out` im Manifest), kein in/: von „in/, done/, failed/“ zu sprechen, führt dort in die Irre.
import test from 'node:test'
import assert from 'node:assert/strict'
import { fachNames } from '../../plugins/tasker/entry.js'

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
