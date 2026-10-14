// „angehakte übernehmen“ in der Prüfansicht (DPP, PPWR): applySuggestions schreibt je Vorschlag den Wert in der Form des Modells und den Beleg
// als einen Stapel. 14.10.2026: der Aufruf brach mit „convert is not defined“ ab — der Import aus mapper.js fehlte seit dem 21.09.2026.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { applySuggestions } from '../src/compliance.js'

async function uebernehmen(list, mapping, attributes) {
  const post = api.post, model = store.model
  const gesendet = []
  api.post = async (pfad, body) => { gesendet.push({ pfad, body }); return { ok: true } }
  store.model = { masterLocale: 'de', attributes, lists: [], units: [], groups: [] }
  try { await applySuggestions(list, mapping, 'de') } finally { api.post = post; store.model = model }
  return gesendet
}

test('die angehakten Vorschläge gehen als ein Stapel ins Journal: Wert in der Form des Modells, dazu der Beleg', async () => {
  const name = { key: 'trade_name', label: 'Handelsname' }, anteil = { key: 'recycled_content', label: 'Rezyklatanteil' }
  const gesendet = await uebernehmen([
    { node: { id: 'p-1' }, item: name, value: 'Deckenleuchte rund 40 cm', why: 'aus dem Namen im Baum', source: 'rule' },
    { node: { id: 'p-1' }, item: anteil, value: '12,5', why: 'aus dem Datenblatt', source: 'rule' },
  ], { trade_name: { to: 'name_dpp' }, recycled_content: { to: 'rezyklat' } },
  [{ key: 'name_dpp', type: 'text', perLocale: true }, { key: 'rezyklat', type: 'decimal' }])
  assert.equal(gesendet.length, 1, 'ein Stapel')
  assert.equal(gesendet[0].pfad, '/api/batch')
  const ops = gesendet[0].body.commands
  assert.deepEqual(ops.filter(c => c.op === 'attribute.set').map(c => [c.args.attribute, c.args.locale, c.args.value]),
    [['name_dpp', 'de', 'Deckenleuchte rund 40 cm'], ['rezyklat', null, '12.5']])
  assert.equal(ops.filter(c => c.op === 'value.source').length, 2, 'jeder Wert mit Beleg')
})

test('ein Vorschlag ohne zugeordnetes Attribut wird nicht geschrieben', async () => {
  const gesendet = await uebernehmen([{ node: { id: 'p-1' }, item: { key: 'batch' }, value: 'L-1', source: 'rule' }], {}, [])
  assert.equal(gesendet.length, 0)
})
