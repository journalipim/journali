// Knotenansicht und grosse Wertelisten (04.10.2026): Werte, Bezeichnung und Gruppe je Liste einmal indiziert — vorher je Zelle bei jedem Zeichnen
// neu, und das Nachschlagen einer Bezeichnung lief über die ganze Liste. Dazu die Knoten darunter, einmal gezählt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const NodeView = (await import('../src/views/NodeView.vue')).default

const WERTE = Array.from({ length: 5000 }, (_, i) => ({ value: 'v' + i, label: { de: 'Farbe ' + i } }))
const MODELL = {
  masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], views: [], families: [], units: [], relationTypes: [],
  lists: [{ key: 'farben', label: { de: 'Farben' }, values: WERTE }],
  groups: [{ key: 'basis', label: { de: 'Basis' } }],
  attributes: [{ key: 'farbe', label: { de: 'Farbe' }, type: 'enum', list: 'farben', group: 'basis' }],
}

test('eine Liste mit 5 000 Werten: die Zelle zeigt die Bezeichnung, die Auswahl bekommt bei jedem Zeichnen dieselben Werte; Knoten darunter gezählt', async () => {
  store.actor = 'u1'; store.toasts = []; store.model = MODELL; store.pendingDocTables = null; store.viewLocales = ['de']
  globalThis.HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: s => ({ width: String(s).length * 7 }) })
  const rows = [{ id: 'p1', role: 'product', label: 'Bohrer', parent: null, axes: [] },
    { id: 'v1', role: 'variant', label: 'V1', parent: 'p1' }, { id: 'v2', role: 'variant', label: 'V2', parent: 'p1' }, { id: 'v3', role: 'variant', label: 'V3', parent: 'v2' }]
  tree.byId = new Map(rows.map(r => [r.id, r])); tree.rows = rows
  tree.children = new Map([['', [rows[0]]], ['p1', [rows[1], rows[2]]], ['v2', [rows[3]]]]); tree.loaded = true; tree.load = async () => {}
  const knoten = { id: 'p1', role: 'product', label: 'Bohrer', status: 'draft', children: 2, axes: [], attachedGroups: [], ancestors: [],
    groups: [{ key: 'basis', from: 'p1', fromLabel: 'Bohrer', active: true, attributes: ['farbe'] }],
    values: [{ attribute: 'farbe', locale: null, channel: null, value: 'v4999', row: null }] }
  globalThis.fetch = async url => {
    const pfad = String(url)
    const antwort = /\/nodes\/p1$/.test(pfad) ? knoten : /\/api\/model/.test(pfad) ? MODELL : /\/relations/.test(pfad) ? { out: [], in: [], inherited: [] }
      : /\/api\/streams\//.test(pfad) || /\/workflow$/.test(pfad) || /\/api\/plugins/.test(pfad) || /\/api\/jobs/.test(pfad) ? [] : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  const router = { path: '/tree/p1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  const w = mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route },
    stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true, PluginBands: true, VersionsPanel: true, DocTables: true } } })
  await flushPromises()
  const zl = w.findAll('tbody tr').find(tr => tr.text().replace(/^[☆★]/, '').startsWith('Farbe'))
  assert.ok(zl, 'Zeile Farbe')
  assert.match(zl.text(), /Farbe 4999/)
  const zelle = w.findComponent({ name: 'SelectCell' })
  const vorher = zelle.props('options'), labelVorher = zelle.props('labelOf')
  assert.equal(vorher.length, 5000)
  store.toasts = [{ text: 'neu zeichnen' }]; w.vm.$forceUpdate(); await flushPromises()
  assert.equal(w.findComponent({ name: 'SelectCell' }).props('options'), vorher, 'dieselbe Werteliste, nicht neu gebaut')
  assert.equal(w.findComponent({ name: 'SelectCell' }).props('labelOf'), labelVorher, 'dieselbe Funktion für die Bezeichnung')
  const t0 = performance.now(); for (const v of WERTE) labelVorher(v.value); assert.ok(performance.now() - t0 < 200, 'Bezeichnungen aller 5 000 Werte nachgeschlagen')
  assert.match(w.find('button[title*="Knoten darunter"]').attributes('title'), /mit 3 Knoten darunter/)
  w.unmount()
})
