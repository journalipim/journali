// Der gewählte Reiter bleibt beim Wechsel zu einem anderen Knoten (07.10.2026) — bei den Attributgruppen wie bei den Bereichen darunter.
// Hat der andere Knoten den Reiter nicht, gilt dort der erste; die Wahl bleibt und gilt am nächsten Knoten, der ihn hat, wieder.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const NodeView = (await import('../src/views/NodeView.vue')).default
HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: s => ({ width: String(s).length * 7 }) })

const MODELL = {
  masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], lists: [], views: [], families: [], relationTypes: [],
  groups: [{ key: 'licht', label: { de: 'Lichttechnik' }, attributes: ['power'] }, { key: 'etim', label: { de: 'ETIM' }, attributes: ['klasse'] }],
  attributes: [{ key: 'power', label: { de: 'Leistung' }, type: 'decimal', group: 'licht' }, { key: 'klasse', label: { de: 'ETIM-Klasse' }, type: 'text', group: 'etim' }],
}
const gruppe = key => ({ key, from: 'x', fromLabel: 'X', active: true, attributes: key === 'licht' ? ['power'] : ['klasse'] })
const KNOTEN = {
  p1: { role: 'product', groups: [gruppe('licht'), gruppe('etim')] },
  p2: { role: 'product', groups: [gruppe('licht'), gruppe('etim')] },
  g1: { role: 'group', groups: [gruppe('licht')] },
}

function welt() {
  store.actor = 'u1'; store.model = MODELL; store.layout = 'tabs'; store.bandLayout = 'tabs'; store.collapsed = []; store.reiterWahl = ''
  try { localStorage.removeItem('journali.bandTab') } catch {}
  tree.byId = new Map(Object.entries(KNOTEN).map(([id, k]) => [id, { id, role: k.role, label: id, parent: null, axes: [] }]))
  tree.rows = [...tree.byId.values()]; tree.children = new Map([['', tree.rows]]); tree.loaded = true; tree.load = async () => {}
  globalThis.fetch = async url => {
    const pfad = String(url)
    const id = Object.keys(KNOTEN).find(k => pfad.includes(`/nodes/${k}`))
    const antwort = /\/relations/.test(pfad) ? { out: [], in: [], inherited: [] } : /\/api\/model/.test(pfad) ? MODELL : /\/api\/plugins/.test(pfad) ? []
      : id && /\/nodes\/[a-z0-9]+(\?|$)/.test(pfad) ? { id, role: KNOTEN[id].role, label: id, values: [], status: 'draft', children: 0, axes: [], groups: KNOTEN[id].groups } : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
}
/// Die Knotenansicht für einen Knoten — je Knoten neu eingehängt, wie die Baumansicht es tut (:key="id")
async function ansicht(id = 'p1') {
  const router = { path: null, push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/' + id, query: {}, params: { id }, name: 'tree', hash: '', fullPath: '/tree/' + id, matched: [], meta: {} }
  const w = mount(NodeView, { props: { id }, global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true } } })
  await flushPromises(); await flushPromises()
  return w
}
const gehe = async (w, id) => { w.unmount(); return ansicht(id) }
const gruppenReiter = w => w.findAll('.tabs .tabbtn.on').map(b => b.text())
const bereich = w => w.findAll('.band-leiste .tabbtn.on').map(b => b.text())

test('der Reiter der Attributgruppen bleibt am nächsten Knoten, der ihn hat', async () => {
  welt()
  let w = await ansicht()
  await w.findAll('.tabs .tabbtn').find(b => /ETIM/.test(b.text())).trigger('click'); await flushPromises()
  assert.match(gruppenReiter(w)[0], /ETIM/)
  w = await gehe(w, 'p2')
  assert.match(gruppenReiter(w)[0], /ETIM/, 'p2 hat ETIM: der Reiter bleibt')
  w = await gehe(w, 'g1')
  assert.match(gruppenReiter(w)[0], /Lichttechnik/, 'g1 hat kein ETIM: der erste')
  w = await gehe(w, 'p1')
  assert.match(gruppenReiter(w)[0], /ETIM/, 'zurück an einem Knoten mit ETIM: wieder die Wahl')
})

test('der Reiter der Bereiche bleibt am nächsten Knoten, der ihn hat', async () => {
  welt()
  let w = await ansicht()
  await w.findAll('.band-leiste .tabbtn').find(b => /Variantenachsen/.test(b.text())).trigger('click'); await flushPromises()
  assert.match(bereich(w)[0], /Variantenachsen/)
  w = await gehe(w, 'p2')
  assert.match(bereich(w)[0], /Variantenachsen/, 'ein Produkt hat Variantenachsen: der Reiter bleibt')
  w = await gehe(w, 'g1')
  assert.doesNotMatch(bereich(w)[0], /Variantenachsen/, 'eine Gruppe hat keine: der erste')
  w = await gehe(w, 'p1')
  assert.match(bereich(w)[0], /Variantenachsen/, 'zurück am Produkt: wieder die Wahl')
})
