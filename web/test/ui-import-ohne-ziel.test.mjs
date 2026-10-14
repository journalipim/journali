// ⇩ Import → Tabelle (14.10.2026): Preise über die SKU ändern verlangte ein Ziel — „Ziel wählen (Gruppe oder Produkt)“ —, obwohl jede Zeile einen
// vorhandenen Knoten traf. Ohne Ziel geht die Analyse jetzt, wenn keine Zeile neu ist; sonst sagt die Meldung, wie viele es noch nicht gibt.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { mount, flushPromises } from '@vue/test-utils'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { api } from '../src/api.js'

const MODELL = {
  masterLocale: 'de', locales: [{ code: 'de' }], views: [], lists: [], units: [], groups: [],
  attributes: [{ key: 'name', type: 'text', group: 'master' }, { key: 'sku', label: { de: 'SKU' }, type: 'text', group: 'logistik', unique: true },
    { key: 'price', label: { de: 'Preis (EUR)' }, type: 'decimal', group: 'master' }],
  relationTypes: [],
}
const BAUM = [{ id: 'g1', parent: null, label: 'Ausrüstung', role: 'group', keys: {} }, { id: 'p1', parent: 'g1', label: 'Stock', role: 'product', keys: {} },
  { id: 'v1', parent: 'p1', label: 'Stock, Rot', role: 'variant', keys: { sku: 'TW-1-RED' } }]

async function welt() {
  store.model = MODELL; store.actor = 'test'; store.toasts = []
  tree.rows = BAUM; tree.byId = new Map(BAUM.map(r => [r.id, r])); tree.loaded = true
  tree.load = async () => {}
  tree.kids = id => BAUM.filter(r => r.parent === id)
  tree.ancestors = id => { const a = []; for (let n = tree.byId.get(id)?.parent ? tree.byId.get(tree.byId.get(id).parent) : null; n; n = n.parent ? tree.byId.get(n.parent) : null) a.unshift(n); return a }
  const { default: ImportView } = await import('../../plugins/table/src/ImportView.vue')
  const w = mount(ImportView, { global: { provide: { [routerKey]: { push() {}, replace() {} }, [routeLocationKey]: { path: '/p/table/import-paste', query: {} } }, stubs: { TreePicker: true, RouterLink: true, ProfileBar: true, Splitter: true, ImportHead: true } } })
  await flushPromises()
  return w
}
async function analysieren(w) {
  const post = api.post
  api.post = async () => ({ rows: [{ row: { id: 'v1' }, values: { price: { value: '88.95', own: true } } }] })
  try { await w.vm.analyse() } finally { api.post = post }
  await flushPromises()
}

test('ohne Ziel: jede Zeile trifft eine vorhandene Variante über die SKU — die Analyse geht', async () => {
  const w = await welt()
  w.vm.setSource({ name: 'Zwischenablage', columns: ['SKU', 'Preis (EUR)'], rows: [['TW-1-RED', '77,50']] })
  await w.vm.$nextTick()
  await analysieren(w)
  assert.equal(store.toasts.length, 0, store.toasts.map(t => t.text).join(' · '))
  assert.equal(w.vm.planned?.stats.update, 1)
  assert.ok(w.vm.planned.commands.some(c => c.op === 'attribute.set' && c.args.attribute === 'price' && c.args.value === '77.5'))
})

test('ohne Ziel mit einer neuen Zeile: die Meldung sagt, wie viele es noch nicht gibt', async () => {
  const w = await welt()
  w.vm.setSource({ name: 'Zwischenablage', columns: ['SKU', 'Preis (EUR)'], rows: [['TW-1-RED', '77,50'], ['TW-9-NEU', '12']] })
  await w.vm.$nextTick()
  await analysieren(w)
  assert.equal(w.vm.planned, null)
  assert.match(store.toasts.at(-1)?.text ?? '', /1 Zeilen gibt es noch nicht/)
})
