// Vom Knoten ins Modell (07.10.2026): der Name eines Attributs oder einer Gruppe führt dorthin — vorher ein ✎ an der Gruppe, dann
// das Attribut in der Liste suchen und anklicken.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const NodeView = (await import('../src/views/NodeView.vue')).default
// happy-dom kennt kein Canvas: die Breite der Namensspalte wird gemessen — hier genügt eine Schätzung
HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: s => ({ width: String(s).length * 7 }) })

const MODELL = {
  masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], lists: [], views: [], families: [], relationTypes: [],
  groups: [{ key: 'licht', label: { de: 'Lichttechnik' }, attributes: ['power'] }],
  attributes: [{ key: 'power', label: { de: 'Leistung' }, type: 'decimal', group: 'licht' }],
}

async function knoten() {
  store.actor = 'u1'
  store.model = MODELL
  tree.byId = new Map([['p1', { id: 'p1', role: 'product', label: 'Strahler', parent: null, axes: [] }]])
  tree.rows = [tree.byId.get('p1')]
  tree.children = new Map([['', tree.rows]])
  tree.loaded = true
  tree.load = async () => {}
  globalThis.fetch = async url => {
    const pfad = String(url)
    const antwort = /\/relations/.test(pfad) ? { out: [], in: [], inherited: [] }
      : /\/api\/model/.test(pfad) ? MODELL
      : /\/api\/plugins/.test(pfad) ? []
      : /\/nodes\/p1/.test(pfad) ? { id: 'p1', role: 'product', label: 'Strahler', values: [], status: 'draft', children: 0, axes: [],
          groups: [{ key: 'licht', from: 'p1', fromLabel: 'Strahler', active: true, attributes: ['power'] }] }
      : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  const router = { path: null, push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  const w = mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true } } })
  await flushPromises()
  return { w, router }
}

test('der Name der Gruppe führt ins Modell zur Gruppe — ohne ✎', async () => {
  const { w, router } = await knoten()
  const gruppe = w.find('.group-row .glbl')
  assert.ok(gruppe.exists(), 'die Gruppe steht als anklickbarer Name da')
  assert.equal(gruppe.text(), 'Lichttechnik')
  assert.equal(w.find('.group-row .edit').exists(), false, 'kein ✎ mehr')
  await gruppe.trigger('click')
  assert.deepEqual(router.path, { path: '/model', query: { section: 'groups', key: 'licht' } })
})

test('der Name des Attributs führt ins Modell zum Attribut', async () => {
  const { w, router } = await knoten()
  const attr = w.findAll('td.attr .lbl').find(x => x.text() === 'Leistung')
  assert.ok(attr, 'das Attribut steht als anklickbarer Name da')
  await attr.trigger('click')
  assert.deepEqual(router.path, { path: '/model', query: { section: 'attributes', key: 'power' } })
})
