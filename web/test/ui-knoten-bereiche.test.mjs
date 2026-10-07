// Die Bereiche unter den Attributen (Assets, Relationen, Freigaben, …) als Liste oder als Reiter (07.10.2026) — wie die Attributgruppen.
// Als Reiter ist nur der gewählte Bereich da, offen und ohne eigene Überschrift; die Reiter stehen in der Leiste darüber.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const NodeView = (await import('../src/views/NodeView.vue')).default
HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: s => ({ width: String(s).length * 7 }) })

const MODELL = { masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], lists: [], views: [], families: [], relationTypes: [], groups: [], attributes: [] }

async function knoten(layout) {
  store.actor = 'u1'; store.model = MODELL; store.bandLayout = layout
  tree.byId = new Map([['p1', { id: 'p1', role: 'product', label: 'Strahler', parent: null, axes: [] }]])
  tree.rows = [tree.byId.get('p1')]; tree.children = new Map([['', tree.rows]]); tree.loaded = true; tree.load = async () => {}
  globalThis.fetch = async url => {
    const pfad = String(url)
    const antwort = /\/relations/.test(pfad) ? { out: [], in: [], inherited: [] } : /\/api\/model/.test(pfad) ? MODELL : /\/api\/plugins/.test(pfad) ? []
      : /\/nodes\/p1/.test(pfad) ? { id: 'p1', role: 'product', label: 'Strahler', values: [], status: 'draft', children: 0, axes: [], groups: [] } : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  const router = { path: null, push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  const w = mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true } } })
  await flushPromises(); await flushPromises()
  return w
}
const sichtbar = w => w.findAll('[data-band]').filter(s => s.element.style.display !== 'none').map(s => s.attributes('data-band'))

test('als Liste: alle Bereiche untereinander, keine Reiter', async () => {
  const w = await knoten('flat')
  assert.equal(w.findAll('.band-leiste .tabbtn').length, 0)
  assert.ok(sichtbar(w).length > 3, sichtbar(w).join(', '))
  assert.ok(sichtbar(w).includes('media') && sichtbar(w).includes('versions'))
})

test('als Reiter: nur der gewählte Bereich, ein Klick auf einen Reiter wechselt', async () => {
  const w = await knoten('tabs')
  const reiter = w.findAll('.band-leiste .tabbtn')
  assert.ok(reiter.length > 3, 'je Bereich ein Reiter')
  assert.deepEqual(sichtbar(w), ['media'])
  const versionen = reiter.find(r => /Versionen/.test(r.text()))
  await versionen.trigger('click'); await flushPromises()
  assert.deepEqual(sichtbar(w), ['versions'])
  assert.equal(w.find('[data-band="versions"]').classes('im-reiter'), true, 'die Überschrift steht im Reiter')
})

test('der Umschalter stellt die Anordnung um und merkt sie', async () => {
  const w = await knoten('flat')
  const [liste, reiter] = w.findAll('.band-leiste .grp button')
  await reiter.trigger('click'); await flushPromises()
  assert.equal(store.bandLayout, 'tabs')
  await liste.trigger('click'); await flushPromises()
  assert.equal(store.bandLayout, 'flat')
})
