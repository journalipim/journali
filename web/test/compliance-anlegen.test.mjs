// Attribute aus einem Katalog anlegen: die Rollen des Datenpunkts kommen als Levels ins Modell,
// damit der Server das Attribut nur an diesen Rollen zulässt (Charge/Los nur an der Variante).
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { createAttributes, ensureUnit } from '../src/compliance.js'
import dpp from '../../plugins/dpp/catalog.js'
import ppwr from '../../plugins/ppwr/catalog.js'

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

test('Text wird Vorlage, Zahl wird Formel, Liste bleibt Liste', async () => {
  const [text, zahl, liste] = await anlegen([item('gtin'), item('recycled_content'), item('energy_class')])
  assert.equal(text.body.type, 'template')
  assert.equal(zahl.body.type, 'formula')
  assert.equal(liste.body.type, 'enum')
})

test('eine Einheit mit Schrägstrich (mg/kg) geht kodiert in den Pfad: sonst passt keine Route und der Server antwortet 405', async () => {
  const post = api.post, poll = store.poll, model = store.model
  const gesendet = []
  api.post = async (pfad, body, methode) => { gesendet.push({ pfad, methode }); return {} }
  store.poll = async () => {}
  store.model = { groups: [{ key: 'ppwr' }], units: [], attributes: [] }
  try { await createAttributes(ppwr, ppwr.groups.flatMap(g => g.items).filter(i => i.unit === 'mg/kg'), {}) } finally { api.post = post; store.poll = poll; store.model = model }
  const einheit = gesendet.find(g => g.pfad.startsWith('/api/model/units/'))
  assert.equal(einheit.pfad, '/api/model/units/mg%2Fkg')
  assert.equal(einheit.methode, 'PUT')
})

test('eine neu angelegte Einheit bekommt Grösse und Faktor: Wh ist ein Tausendstel kWh, nicht dasselbe', async () => {
  const post = api.post, poll = store.poll, model = store.model
  const gesendet = []
  api.post = async (pfad, body) => { gesendet.push(body); return {} }
  store.poll = async () => {}
  store.model = { units: [] }
  try { for (const s of ['kWh', 'Wh', 'mg', 'a', 'oz', '°F']) await ensureUnit(s) } finally { api.post = post; store.poll = poll; store.model = model }
  const je = Object.fromEntries(gesendet.map(b => [b.key, [b.quantity, b.factor]]))
  assert.equal(gesendet.find(b => b.key === '°F').offset, -160 / 9, 'Fahrenheit hat eine Verschiebung zu Celsius')
  assert.equal(gesendet.find(b => b.key === 'kWh').offset, 0)
  assert.deepEqual(je.kWh, ['energy', 1])
  assert.deepEqual(je.Wh, ['energy', 0.001], 'gleiche Grösse, Faktor zur Basis')
  assert.deepEqual(je.mg, ['mass', 0.000001], 'mg gehört zu mass wie kg und g im Saatgut')
  assert.deepEqual(je.a, ['time', 8766], 'ein Jahr sind 8766 Stunden')
  assert.deepEqual(je.oz, ['oz', 1], 'ein unbekanntes Symbol ist seine eigene Grösse')
  assert.deepEqual(je['°F'], ['temperature', 5 / 9])
})

test('Handelsname und Modell sind vererbbar: eine Vorlage am oberen Knoten gilt darunter', async () => {
  const [name, modell, gtin] = await anlegen([item('trade_name'), item('model_number'), item('gtin')])
  assert.equal(name.body.inheritable, true)
  assert.equal(modell.body.inheritable, true)
  assert.equal(gtin.body.inheritable, false, 'eine GTIN erbt nicht')
})
