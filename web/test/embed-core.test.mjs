// Plugin embed, Kern (27.09.2026, 35): wie ein Text für das Modell vorbereitet wird, wie Posten gestapelt werden und
// wie der Server mit dem vorgehaltenen Prozess spricht — ohne Modell, ohne Netz.
import test from 'node:test'
import assert from 'node:assert/strict'
import { prepare, trim, batches, parseLine, replyLine, errorLine, compact } from '../../plugins/embed/core.mjs'

test('e5 bekommt seine Vorsilbe, andere Modelle den Text wie er ist', () => {
  assert.equal(prepare('Klebstoff', 'query', 'Xenova/multilingual-e5-small'), 'query: Klebstoff')
  assert.equal(prepare('Klebstoff', 'passage', 'Xenova/multilingual-e5-small'), 'passage: Klebstoff')
  assert.equal(prepare('Klebstoff', 'query', 'Xenova/all-MiniLM-L6-v2'), 'Klebstoff')
})

test('ein langer Abschnitt wird gekürzt, Weissraum zusammengezogen', () => {
  assert.equal(trim('  a \n\n b  '), 'a b')
  assert.equal(trim('x'.repeat(3000)).length, 2000)
})

test('Stapel für das Modell', () => {
  assert.deepEqual(batches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  assert.deepEqual(batches([], 2), [])
  assert.deepEqual(batches([1, 2], 0), [[1], [2]], 'ein Stapel hat mindestens einen Posten')
})

test('das Protokoll: eine Zeile JSON hin, eine zurück', () => {
  assert.deepEqual(parseLine('{"text":"Klebstoff","kind":"passage"}'), { text: 'Klebstoff', kind: 'passage' })
  assert.deepEqual(parseLine('{"text":"Klebstoff"}'), { text: 'Klebstoff', kind: 'query' }, 'ohne Art ist es eine Frage')
  assert.equal(parseLine('kein json'), null)
  assert.equal(parseLine('{"kind":"query"}'), null, 'ohne Text keine Anfrage')
  assert.deepEqual(JSON.parse(replyLine('m', [0.1, 0.2])), { model: 'm', dims: 2, vector: [0.1, 0.2] })
  assert.deepEqual(JSON.parse(errorLine('kaputt')), { error: 'kaputt' })
})

test('Zahlen gehen mit sieben Stellen über die Leitung', () => {
  assert.deepEqual(compact(new Float32Array([0.123456789, -1])), [0.1234568, -1])
})
