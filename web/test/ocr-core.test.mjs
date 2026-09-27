// Plugin ocr, Kern (27.09.2026, 34 J): aus dem Ergebnis der Erkennung werden Seiten, Zellen, Abschnitte und Tabellen —
// mit denselben Werkzeugen wie beim Leser. Ohne Erkennung, ohne Netz.
import test from 'node:test'
import assert from 'node:assert/strict'
import { linesOf, itemsOf, gapOf, pageOf, assemble, note } from '../../plugins/ocr/core.mjs'

const wort = (text, x0, x1) => ({ text, bbox: { x0, y0: 0, x1, y1: 20 } })
const zeile = (text, words) => ({ text, words })

test('Zeilen kommen flach oder in Blöcken — beides wird eine Liste', () => {
  const l = zeile('a', [])
  assert.deepEqual(linesOf({ lines: [l] }), [l])
  assert.deepEqual(linesOf({ blocks: [{ paragraphs: [{ lines: [l, l] }] }, { paragraphs: [] }] }), [l, l])
  assert.deepEqual(linesOf({}), [])
})

test('Wörter werden Stücke mit Lage; der Zellenabstand folgt der Zeichenbreite der Seite', () => {
  const l = zeile('Gewicht 1,2 kg', [wort('Gewicht', 10, 80), wort('1,2', 300, 330), wort('kg', 336, 356)])
  assert.deepEqual(itemsOf(l).map(i => [i.x, i.w, i.str]), [[10, 70, 'Gewicht '], [300, 30, '1,2 '], [336, 20, 'kg ']])
  assert.equal(Math.round(gapOf([l])), 25, '10 px je Zeichen, das Zweieinhalbfache')
  assert.equal(gapOf([]), 20)
})

test('eine Seite: Text, Zeilen als Zellen — ein weiter Sprung trennt, ein Wortabstand nicht', () => {
  const data = { confidence: 88, lines: [
    zeile('Technische Daten', [wort('Technische', 10, 110), wort('Daten', 116, 166)]),
    zeile('Gewicht 1,2 kg', [wort('Gewicht', 10, 80), wort('1,2', 300, 330), wort('kg', 336, 356)]),
    zeile('Durchmesser 22 mm', [wort('Durchmesser', 10, 120), wort('22', 300, 320), wort('mm', 326, 350)]),
    zeile('Farbe blau', [wort('Farbe', 10, 60), wort('blau', 300, 340)]),
  ] }
  const p = pageOf(data)
  assert.equal(p.confidence, 88)
  assert.equal(p.text.split('\n').length, 4)
  assert.deepEqual(p.rows[0], ['Technische Daten'])
  assert.deepEqual(p.rows[1], ['Gewicht', '1,2 kg'])
  assert.deepEqual(p.rows[3], ['Farbe', 'blau'])
})

test('aus den Seiten Abschnitte und Tabellen wie beim Leser, dazu Vertrauen und Zeichen', () => {
  const seite = pageOf({ confidence: 90, lines: [
    zeile('Technische Daten', [wort('Technische', 10, 110), wort('Daten', 116, 166)]),
    zeile('Gewicht 1,2 kg', [wort('Gewicht', 10, 80), wort('1,2', 300, 330), wort('kg', 336, 356)]),
    zeile('Durchmesser 22 mm', [wort('Durchmesser', 10, 120), wort('22', 300, 320), wort('mm', 326, 350)]),
    zeile('Farbe blau', [wort('Farbe', 10, 60), wort('blau', 300, 340)]),
  ] })
  const a = assemble([seite, { ...seite, confidence: 70 }])
  assert.equal(a.confidence, 80)
  assert.ok(a.zeichen > 40)
  assert.equal(a.tables.length, 2, 'je Seite eine Tabelle')
  assert.deepEqual(a.tables[0].rows, [['Gewicht', '1,2 kg'], ['Durchmesser', '22 mm'], ['Farbe', 'blau']])
  assert.equal(a.tables[0].heading, 'Technische Daten'); assert.equal(a.tables[1].page, 2)
  assert.ok(a.chunks.length >= 1); assert.equal(a.chunks[0].page, 1)
  assert.equal(note(80, 2), 'ocr · Vertrauen 80 % · 2 Seiten')
})

test('eine leere Erkennung hat null Zeichen — der Job hält das als Fehler fest, nicht als Text', () => {
  const a = assemble([pageOf({ confidence: 0, lines: [] })])
  assert.equal(a.zeichen, 0); assert.deepEqual(a.chunks, []); assert.deepEqual(a.tables, [])
})
