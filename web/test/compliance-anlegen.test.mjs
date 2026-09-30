// Attribute aus einem Katalog anlegen: die Rollen des Datenpunkts kommen als Levels ins Modell,
// damit der Server das Attribut nur an diesen Rollen zulässt (Charge/Los nur an der Variante).
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { createAttributes } from '../src/compliance.js'
import dpp from '../../plugins/dpp/catalog.js'

async function anlegen(items) {
  const post = api.post, poll = store.poll, model = store.model
  const gesendet = []
  api.post = async (pfad, body) => { gesendet.push({ pfad, body }); return {} }
  store.poll = async () => {}
  store.model = { groups: [{ key: 'dpp' }], units: [], attributes: [] }
  try { await createAttributes(dpp, items, {}) } finally { api.post = post; store.poll = poll; store.model = model }
  return gesendet.filter(g => g.pfad.startsWith('/api/model/attributes/'))
}
const item = key => dpp.groups.flatMap(g => g.items).find(i => i.key === key)

test('Charge/Los gilt nur an der Variante: das Attribut wird mit levels ["variant"] angelegt', async () => {
  const [a] = await anlegen([item('batch')])
  assert.equal(a.pfad, '/api/model/attributes/dpp_batch')
  assert.deepEqual(a.body.levels, ['variant'])
})

test('GTIN gilt an Produkt und Variante, nicht an der Gruppe', async () => {
  const [a] = await anlegen([item('gtin')])
  assert.deepEqual(a.body.levels, ['product', 'variant'])
})

test('ein Datenpunkt ohne Rollen wird ohne Beschränkung angelegt (levels null: die Regel der Gruppe gilt)', async () => {
  const [a] = await anlegen([item('manufacturer')])
  assert.equal(a.body.levels, null)
})
