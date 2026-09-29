// Kuratierte Helfer für Skripte (29.09.2026, docs/pflegestruktur.md 37): reine, geprüfte Funktionen statt beliebiger
// npm-Pakete, dazu ein minimaler JSON-Schema-Prüfer für ctx.step({ schema }).
import test from 'node:test'
import assert from 'node:assert/strict'
import { chunk, retry, get, csv, parseCsv, pruefeSchema } from '../../plugins/scriptum/lib.mjs'

test('chunk teilt in Häppchen fester Grösse', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
  assert.deepEqual(chunk([], 3), [])
  assert.deepEqual(chunk([1, 2], 0), [[1], [2]])   // Grösse < 1 gilt als 1
})

test('retry wiederholt bis zum Erfolg, sonst wirft es den letzten Fehler', async () => {
  let n = 0
  const ok = await retry(() => { n++; if (n < 3) throw new Error('nope'); return 'gut' }, { times: 5, delayMs: 0 })
  assert.equal(ok, 'gut'); assert.equal(n, 3)
  await assert.rejects(() => retry(() => { throw new Error('immer') }, { times: 2, delayMs: 0 }), /immer/)
})

test('get liest verschachtelt, ohne zu werfen', () => {
  assert.equal(get({ a: { b: { c: 7 } } }, 'a.b.c'), 7)
  assert.equal(get({ a: {} }, 'a.b.c', 'x'), 'x')
  assert.equal(get(null, 'a', 'x'), 'x')
  assert.equal(get({ a: 1 }, ['a']), 1)
})

test('csv maskiert Trenner, Anführungszeichen und Umbruch', () => {
  assert.equal(csv([{ a: 1, b: 'x' }, { a: 2, b: 'y;z' }]), 'a;b\n1;x\n2;"y;z"')
  assert.equal(csv([['a', 'b'], ['1', '2']], { header: false }), 'a;b\n1;2')
  assert.equal(csv([{ a: 'sagt "hi"' }]), 'a\n"sagt ""hi"""')
})

test('parseCsv liest mit Anführungszeichen und doppelten Anführungszeichen', () => {
  assert.deepEqual(parseCsv('a;b\n1;2\n'), [['a', 'b'], ['1', '2']])
  assert.deepEqual(parseCsv('"a;1";b'), [['a;1', 'b']])
  assert.deepEqual(parseCsv('"sagt ""hi"""'), [['sagt "hi"']])
})

test('pruefeSchema prüft Typ, required, properties, items und enum', () => {
  assert.equal(pruefeSchema([1, 2], { type: 'array', items: { type: 'number' } }), null)
  assert.match(pruefeSchema([1, 'x'], { type: 'array', items: { type: 'number' } }), /erwartet number/)
  assert.equal(pruefeSchema({ a: 1 }, { type: 'object', required: ['a'] }), null)
  assert.match(pruefeSchema({}, { type: 'object', required: ['a'] }), /a: fehlt/)
  assert.match(pruefeSchema('gross', { enum: ['klein', 'mittel'] }), /erlaubten/)
  assert.equal(pruefeSchema(3, { type: 'integer' }), null)
  assert.match(pruefeSchema(3.5, { type: 'integer' }), /erwartet integer/)
  assert.equal(pruefeSchema({ a: { b: 1 } }, { properties: { a: { properties: { b: { type: 'number' } } } } }), null)
})
