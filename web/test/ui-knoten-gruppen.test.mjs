// ▤ Attributgruppen ab diesem Knoten (28.09.2026): eine Gruppe, die von einem Vorfahren gilt, steht hier nicht noch einmal
// als eigene Zeile mit Warnung — sie gilt von dort. Der Server heftet so etwas nicht mehr an; was aus alter Zeit noch da
// ist, zeigt das Band nicht.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const NodeView = (await import('../src/views/NodeView.vue')).default

const MODELL = { masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], lists: [], views: [], families: [], units: [], attributes: [],
  groups: [{ key: 'physical', label: { de: 'Physisch' } }, { key: 'from_document', label: { de: 'aus Dokument' } }], relationTypes: [] }

function welt({ eigene, oben }) {
  store.actor = 'u1'; store.toasts = []; store.model = MODELL; store.pendingDocTables = null; store.poll = async () => {}
  globalThis.HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: s => ({ width: String(s).length * 7 }) })
  const g1 = { id: 'g1', role: 'group', label: 'Mastertree', parent: null, axes: [], groups: oben }
  const p1 = { id: 'p1', role: 'product', label: 'Bohrer', parent: 'g1', axes: [] }
  tree.byId = new Map([['g1', g1], ['p1', p1]]); tree.rows = [g1, p1]; tree.children = new Map([['', [g1]], ['g1', [p1]]]); tree.loaded = true; tree.load = async () => {}
  const knoten = { id: 'p1', role: 'product', label: {}, values: [], status: 'draft', children: 0, axes: [], attachedGroups: eigene, ancestors: [{ id: 'g1', role: 'group', label: 'Mastertree', values: [] }],
    groups: [...(oben ? [{ key: oben, from: 'g1', fromLabel: 'Mastertree', active: true, attributes: [] }] : []), ...eigene.map(k => ({ key: k, from: 'p1', fromLabel: 'Bohrer', active: true, attributes: [] }))] }
  globalThis.fetch = async (url) => {
    const pfad = String(url)
    const antwort = /\/nodes\/p1$/.test(pfad) ? knoten : /\/relations/.test(pfad) ? { out: [], in: [], inherited: [] } : /\/api\/model/.test(pfad) ? MODELL : /\/api\/plugins/.test(pfad) ? [] : /\/api\/streams\//.test(pfad) || /\/workflow$/.test(pfad) ? [] : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  const router = { path: '/tree/p1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  return mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true, PluginBands: true, VersionsPanel: true, DocTables: true } } })
}
const band = w => w.findAll('.section').find(s => /Attributgruppen ab diesem Knoten/.test(s.find('h2')?.text() ?? ''))

test('eine Gruppe, die von oben gilt, steht nicht als eigene Zeile da — keine Warnung, kein „überflüssig“', async () => {
  const w = welt({ eigene: ['from_document', 'physical'], oben: 'from_document' })
  await flushPromises()
  const b = band(w); assert.ok(b)
  if (!/▾/.test(b.find('h2').text())) { await b.find('h2').trigger('click'); await flushPromises() }
  // der Link zur Gruppe ist gestubbt — der Schlüssel steht im title der Zeile
  const zeilen = b.findAll('tbody tr')
  assert.deepEqual(zeilen.map(tr => tr.attributes('title')), ['physical'], 'nur die eigene, die nicht von oben kommt')
  assert.match(zeilen[0].text(), /ab hier nach unten/)
  assert.doesNotMatch(b.text(), /überflüssig|⚠/)
})

test('ohne Vorfahren mit der Gruppe steht die eigene Zeile wie immer da', async () => {
  const w = welt({ eigene: ['from_document'], oben: null })
  await flushPromises()
  const b = band(w)
  if (!/▾/.test(b.find('h2').text())) { await b.find('h2').trigger('click'); await flushPromises() }
  assert.deepEqual(b.findAll('tbody tr').map(tr => tr.attributes('title')), ['from_document']); assert.match(b.text(), /ab hier nach unten/)
})
