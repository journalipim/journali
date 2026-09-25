// Umwandlung je Spalte: jede Kette rein, Beispiele aus dem Vergleich mit anderen Systemen (Einheiten, Ja/Nein, Datum, Verbinden)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apply, describe } from '../src/transform.js'

test('Zahl aus „22 mm“, „1.234,5“, „2,5 l“ — Dezimalzeichen geraten oder gesetzt', () => {
  assert.equal(apply([{ op: 'number' }], '22 mm'), '22')
  assert.equal(apply([{ op: 'number' }], '1.234,5'), '1234.5')
  assert.equal(apply([{ op: 'number' }], '2,5 l'), '2.5')
  assert.equal(apply([{ op: 'number', decimal: '.' }], '1,234.5'), '1234.5')
  assert.equal(apply([{ op: 'number' }], ''), '')
  assert.equal(apply([{ op: 'number' }], 'k.A.'), 'k.A.')   // keine Zahl: bleibt, die Prüfung des Attributs meldet es
})
test('Wahrheitswert, Datum, Ersetzen, Aufteilen, Verbinden', () => {
  assert.equal(apply([{ op: 'boolean' }], 'Ja'), 'true')
  assert.equal(apply([{ op: 'boolean', yes: 'vorhanden' }], 'vorhanden'), 'true')
  assert.equal(apply([{ op: 'boolean', yes: 'vorhanden' }], 'x'), 'false')   // das Feld ersetzt die Vorgabe (vorbelegt, Benutzer streicht oder ergänzt)
  assert.equal(apply([{ op: 'boolean' }], 'nein'), 'false')
  assert.equal(apply([{ op: 'boolean' }], 'T'), 'true'); assert.equal(apply([{ op: 'boolean' }], 'F'), 'false')   // T/F
  assert.equal(apply([{ op: 'date' }], '21.09.2026'), '2026-09-21')
  assert.equal(apply([{ op: 'date', format: 'MM/dd/yyyy' }], '09/21/2026'), '2026-09-21')
  assert.equal(apply([{ op: 'date' }], '21.09.26'), '2026-09-21')                      // zweistelliges Jahr
  assert.equal(apply([{ op: 'date' }], '2026-09-21T10:30:00Z'), '2026-09-21')          // ISO mit Uhrzeit, raten
  assert.equal(apply([{ op: 'date' }], '1790000000'), '2026-09-21')                    // Unix-Sekunden (2026-09-21 14:13 UTC)
  assert.equal(apply([{ op: 'date', format: 'unixms' }], '1790000000000'), '2026-09-21')
  assert.equal(apply([{ op: 'date', format: 'exceladdin' }], '46286'), '2026-09-21')        // Excel-Zahl
  assert.equal(apply([{ op: 'date' }], '46286'), '2026-09-21')                         // raten: Excel
  assert.equal(apply([{ op: 'date', format: 'dd/MM/yyyy' }], '21/09/2026'), '2026-09-21')
  assert.equal(apply([{ op: 'date' }], 'kein Datum'), 'kein Datum')
  assert.equal(apply([{ op: 'replace', find: ' WLAN', with: '' }], 'WLAN 2,4 GHz, WLAN 5 GHz'), 'WLAN 2,4 GHz, 5 GHz')
  assert.equal(apply([{ op: 'replace', find: String.raw`\s*GHz`, with: '', regex: true }], 'WLAN 2,4 GHz, WLAN 5 GHz'), 'WLAN 2,4, WLAN 5')
  assert.equal(apply([{ op: 'split', sep: ',', index: 0 }, { op: 'trim' }], 'iOS, Android'), 'iOS')
  assert.equal(apply([{ op: 'split', sep: ',', index: -1 }, { op: 'trim' }], 'iOS, Android'), 'Android')
  const ctx = { get: c => ({ brand: 'robolox', model: 'ORBIS X1' })[c] }
  assert.equal(apply([{ op: 'combine', columns: 'brand,{}', sep: ' ' }], 'ORBIS X1', ctx), 'robolox ORBIS X1')
  assert.equal(apply([{ op: 'static', text: 'Saugroboter' }], 'irgendwas'), 'Saugroboter')
  assert.equal(apply([{ op: 'default', text: '—' }], '  '), '—')
})
test('Bedingung, Werte übersetzen, HTML, Kette und kaputter Schritt', () => {
  assert.equal(apply([{ op: 'when', test: 'contains', value: 'lidar', then: 'LiDAR', else: '{}' }], 'LiDAR SLAM'), 'LiDAR')
  assert.equal(apply([{ op: 'when', test: 'empty', then: 'unbekannt' }], ''), 'unbekannt')
  assert.equal(apply([{ op: 'map', pairs: 'true=ja; false=nein', other: '?' }], 'TRUE'), 'ja')
  assert.equal(apply([{ op: 'map', pairs: 'a=b' }], 'z'), 'z')
  assert.equal(apply([{ op: 'htmldecode' }], 'Fu&amp;Ba &#65;'), 'Fu&Ba A')
  assert.equal(apply([{ op: 'striphtml' }], '<p>Hallo <b>Welt</b></p>'), 'Hallo Welt')
  assert.equal(apply([{ op: 'trim' }, { op: 'upper' }, { op: 'suffix', text: '!' }], '  abc  d '), 'ABC D!')
  assert.equal(apply([{ op: 'replace', find: '(', with: '', regex: true }], 'a(b'), 'a(b')   // ungültige Regex: Wert bleibt
  assert.equal(apply(null, 5), 5)
  assert.equal(describe([{ op: 'trim' }, { op: 'number', decimal: ',' }]), 'Leerzeichen kürzen → Zahl (,)')
})
