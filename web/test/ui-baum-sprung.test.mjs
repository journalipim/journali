// Der Baum springt zum Knoten (01.10.2026): wird ein Knoten geöffnet, der im Baum zugeklappt oder ausserhalb des sichtbaren Teils liegt (Lesezeichen, Link),
// klappt der Pfad auf und die Zeile kommt ins Bild. Was schon im Bild ist, bleibt, wo es ist.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const TreeView = (await import('../src/views/TreeView.vue')).default

const ROWS = [
  { id: 'g1', role: 'group', label: 'Ordner A', parent: null, axes: [] }, { id: 'g2', role: 'group', label: 'Ordner B', parent: null, axes: [] },
  { id: 'g3', role: 'group', label: 'Unterordner', parent: 'g2', axes: [] }, { id: 'p1', role: 'product', label: 'Tief unten', parent: 'g3', axes: [] },
  { id: 'p0', role: 'product', label: 'Oben', parent: 'g1', axes: [] },
]
function welt() {
  tree.byId = new Map(ROWS.map(r => [r.id, r])); tree.rows = ROWS
  tree.children = new Map([['', [ROWS[0], ROWS[1]]], ['g1', [ROWS[4]]], ['g2', [ROWS[2]]], ['g3', [ROWS[3]]]])
  tree.expanded = new Set(['g1']); tree.loaded = true; tree.load = async () => {}
  tree.ancestors = id => { const out = []; let n = tree.byId.get(id); while (n?.parent) { n = tree.byId.get(n.parent); if (n) out.push(n) } return out }
  store.actor = 'u1'; store.toasts = []
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], statuses: [], relationTypes: [] }
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => '[]', json: async () => [] })
}
const router = () => ({ path: '/tree/p0', push(p) { this.path = p }, replace(p) { this.path = p } })

/// happy-dom rechnet kein Layout: der Rahmen der Liste und die Lage der Zeile werden vorgegeben (Zeile 1000 px unterhalb eines 500 px hohen Rahmens)
function lage(zeileTop) {
  const alt = Element.prototype.getBoundingClientRect, gerufen = []
  Element.prototype.getBoundingClientRect = function () {
    if (this.classList?.contains('tree')) return { top: 0, bottom: 500, left: 0, right: 300, width: 300, height: 500 }
    if (this.classList?.contains('selected')) return { top: zeileTop, bottom: zeileTop + 24, left: 0, right: 300, width: 300, height: 24 }
    return alt.call(this)
  }
  const altScroll = Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = function (o) { gerufen.push({ id: this.getAttribute('title'), ...o }) }
  return { gerufen, zurueck() { Element.prototype.getBoundingClientRect = alt; Element.prototype.scrollIntoView = altScroll } }
}

test('ein zugeklappter, weit unten liegender Knoten: der Pfad klappt auf und die Zeile kommt in die Mitte', async () => {
  welt()
  const l = lage(1000)
  const w = mount(TreeView, { props: { id: 'p0' }, global: { provide: { [routerKey]: router() }, stubs: { RouterLink: true, 'router-link': true, NodeView: true } } })
  await flushPromises()
  l.gerufen.length = 0
  await w.setProps({ id: 'p1' }); await flushPromises()
  assert.ok(tree.expanded.has('g2') && tree.expanded.has('g3'), 'der Pfad ist aufgeklappt')
  assert.deepEqual(l.gerufen.map(g => [g.id, g.block]), [['p1', 'center']], 'die Zeile wurde in die Mitte geholt')
  l.zurueck(); w.unmount()
})

test('liegt der Knoten schon im Bild, springt nichts', async () => {
  welt()
  const l = lage(100)
  const w = mount(TreeView, { props: { id: 'p0' }, global: { provide: { [routerKey]: router() }, stubs: { RouterLink: true, 'router-link': true, NodeView: true } } })
  await flushPromises(); l.gerufen.length = 0
  await w.setProps({ id: 'p1' }); await flushPromises()
  assert.equal(l.gerufen.length, 0, 'ein Klick im Baum lässt ihn nicht springen')
  l.zurueck(); w.unmount()
})
