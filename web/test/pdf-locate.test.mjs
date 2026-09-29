// Fundstelle im PDF (29.09.2026): aus den Textstücken einer Seite die Spanne finden, die das Zitat abdeckt — robust
// gegen Leerzeichen und Umbrüche —, und daraus den umschliessenden Kasten. Reine Logik, ohne pdf.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { findeSpanne, kastenAus } from '../src/pdf-locate.js'

const stuecke = strs => strs.map(s => ({ str: s }))

test('die Spanne umfasst genau die Stücke des Zitats — über Stückgrenzen hinweg', () => {
  const items = stuecke(['Nenn', 'leistung', '50', 'W'])
  assert.deepEqual(findeSpanne(items, 'leistung 50'), { von: 1, bis: 2 })
  assert.deepEqual(findeSpanne(items, 'Nennleistung'), { von: 0, bis: 1 }, 'ein Wort über zwei Stücke')
  assert.deepEqual(findeSpanne(items, '50 W'), { von: 2, bis: 3 })
})

test('Leerzeichen und Umbrüche stören nicht — normalisiert wird auf einen Trenner', () => {
  const items = stuecke(['Schutzart', '  IP20  ', '\nklasse'])
  assert.deepEqual(findeSpanne(items, 'schutzart ip20'), { von: 0, bis: 1 })
  assert.deepEqual(findeSpanne(items, 'IP20\n\nKLASSE'), { von: 1, bis: 2 })
})

test('Rückfall auf die erste Hälfte, wenn das ganze Zitat nicht steht', () => {
  const items = stuecke(['Gewicht', 'ohne', 'Verpackung', '2,4', 'kg', 'brutto'])
  // das Zitat weicht ab („netto laut Norm“ statt „brutto“) — die erste Hälfte trifft trotzdem
  const sp = findeSpanne(items, 'Gewicht ohne Verpackung 2,4 kg netto laut Norm')
  assert.equal(sp.von, 0, 'ab dem ersten Stück')
  assert.ok(sp.bis >= 2, 'deckt mehrere Stücke ab')
})

test('nichts Passendes, zu kurz, leer → null', () => {
  assert.equal(findeSpanne(stuecke(['abc', 'def']), 'xyz'), null)
  assert.equal(findeSpanne(stuecke(['abc']), 'a'), null, 'ein Zeichen ist zu wenig')
  assert.equal(findeSpanne([], 'abc'), null)
  assert.equal(findeSpanne(stuecke(['abc']), ''), null)
})

test('der Kasten umschliesst die Lagen der Stücke, mit Rand', () => {
  const items = [
    { str: 'a', left: 10, top: 20, width: 8, height: 12 },
    { str: 'b', left: 20, top: 22, width: 30, height: 10 },
    { str: 'c', left: 100, top: 200, width: 5, height: 5 },
  ]
  const k = kastenAus(items, { von: 0, bis: 1 }, 2)
  assert.deepEqual(k, { left: 8, top: 18, width: 44, height: 16 })   // 10..50 breit, 20..32 hoch, +2 Rand
  assert.equal(kastenAus(items, null), null)
  assert.equal(kastenAus([{ str: 'x' }], { von: 0, bis: 0 }), null, 'ohne Lagen kein Kasten')
})
