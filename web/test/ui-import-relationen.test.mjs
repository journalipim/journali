// ⇩ Import → Excel mit dem Blatt „Relationen“: das Blatt ist kein Blatt zum Zuordnen, der Plan rechnet es hinter den Knoten,
// und erst der Knopf schreibt — Knoten und Relationen in einem Stapel.
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
  attributes: [{ key: 'name', type: 'text', group: 'master' }, { key: 'gehalt', type: 'decimal', unit: 'g', group: 'naehr' }],
  relationTypes: [{ key: 'component', label: { de: 'Bestandteil' }, symmetric: false }],
}
const BAUM = [{ id: 'z1', parent: null, label: 'Ziel', role: 'group', keys: {} }]

// die Datei: zwei Produkte aus einem anderen System (Ids p1, p2) und eine Relation zwischen ihnen
const DATEI = {
  name: 'mittel.xlsx',
  sheets: [
    { name: 'Daten', columns: ['journali_id_g1', 'name'], rows: [['p1', 'Tablette'], ['p2', 'Vitamin C']] },
    { name: 'Relationen', columns: ['journali_von', 'journali_von_name', 'journali_typ', 'journali_nach', 'journali_nach_name', 'gehalt', 'gehalt_einheit'], rows: [['p1', 'Tablette', 'component', 'p2', 'Vitamin C', '20000', 'g']] },
  ],
}

async function welt() {
  store.model = MODELL
  store.actor = 'test'
  tree.rows = BAUM; tree.byId = new Map(BAUM.map(r => [r.id, r])); tree.loaded = true
  tree.load = async () => {}
  tree.kids = id => BAUM.filter(r => r.parent === id)
  tree.ancestors = id => { const a = []; for (let n = tree.byId.get(id)?.parent ? tree.byId.get(tree.byId.get(id).parent) : null; n; n = n.parent ? tree.byId.get(n.parent) : null) a.unshift(n); return a }
  const { default: ImportView } = await import('../../plugins/table/src/ImportView.vue')
  const w = mount(ImportView, { global: { provide: { [routerKey]: { push() {}, replace() {} }, [routeLocationKey]: { path: '/p/table/import', query: {} } }, stubs: { TreePicker: true, RouterLink: true, ProfileBar: true, Splitter: true, ImportHead: true } } })
  await flushPromises()
  return w
}

test('das Blatt Relationen steht nicht in der Blattauswahl, die Knoten sind das erste Blatt', async () => {
  const w = await welt()
  w.vm.setSource(structuredClone(DATEI))
  await w.vm.$nextTick()
  assert.equal(w.vm.source.sheet, 'Daten')
  assert.deepEqual(w.vm.source.sheets.map(s => s.name), ['Daten'])
  assert.equal(w.vm.source.relationenBlatt.name, 'Relationen')
  assert.deepEqual(w.vm.source.columns, ['journali_id_g1', 'name'])
})

test('der Plan zählt die Relationen, der Knopf schreibt sie hinter den Knoten', async () => {
  const w = await welt()
  w.vm.setSource(structuredClone(DATEI))
  w.vm.pickTarget(tree.byId.get('z1'))
  await w.vm.$nextTick()
  const get = api.get
  api.get = async () => ({})
  try { await w.vm.analyse() } finally { api.get = get }
  await flushPromises()
  const p = w.vm.planned
  assert.deepEqual([p.stats.create, p.stats.relations.create], [2, 1])
  assert.match(w.text(), /1 Relationen neu/)
  const ops = p.commands.map(c => c.op)
  assert.ok(ops.lastIndexOf('product.create') < ops.indexOf('relation.create'), 'die Relation kommt nach den Knoten')

  let gesendet = null
  const orig = api.batchChunked
  api.batchChunked = async cmds => { gesendet = cmds; return { batch: 'b1', results: cmds.map((c, index) => ({ index })), error: null, errors: [] } }
  try { await w.vm.run() } finally { api.batchChunked = orig }
  assert.ok(gesendet.some(c => c.op === 'relation.create' && c.args.type === 'component'))
  assert.ok(gesendet.some(c => c.op === 'relation.attribute.set' && c.args.attribute === 'gehalt' && c.args.value === '20000'))
})

test('eine Datei ohne Relationenblatt rechnet wie bisher', async () => {
  const w = await welt()
  const ohne = structuredClone(DATEI); ohne.sheets.pop()
  w.vm.setSource(ohne)
  w.vm.pickTarget(tree.byId.get('z1'))
  const get = api.get; api.get = async () => ({})
  try { await w.vm.analyse() } finally { api.get = get }
  assert.equal(w.vm.planned.stats.relations, undefined)
  assert.equal(w.vm.planned.commands.some(c => c.op.startsWith('relation.')), false)
})
