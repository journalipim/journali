// Berechnete Spalte in einer Tabelle (30.09.2026): die Zelle zeigt das Ergebnis der Zeile, ist nicht bearbeitbar, und die
// Spaltenüberschrift (ƒ) öffnet das Skript, das für jede Zeile rechnet.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const NodeView = (await import('../src/views/NodeView.vue')).default

const MODELL = {
  masterLocale: 'de', locales: [{ code: 'de' }], channels: [], statuses: [], lists: [], views: [], families: [], units: [], relationTypes: [],
  groups: [{ key: 'technik', label: { de: 'Technik' } }],
  attributes: [
    { key: 'kennlinie', label: { de: 'Kennlinie' }, type: 'rows', group: 'technik', columns: ['u_ein', 'u_aus'] },
    { key: 'u_ein', label: { de: 'Eingangsspannung' }, type: 'decimal', unit: 'V' },
    { key: 'u_aus', label: { de: 'Ausgangsspannung' }, type: 'formula' },
  ],
}

async function ansicht() {
  store.actor = 'u1'; store.toasts = []; store.model = MODELL; store.pendingDocTables = null; store.poll = async () => {}; store.layout = 'tabs'
  globalThis.HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: s => ({ width: String(s).length * 7 }) })
  const p1 = { id: 'p1', role: 'product', label: 'Netzteil', parent: null, axes: [] }
  tree.byId = new Map([['p1', p1]]); tree.rows = [p1]; tree.children = new Map([['', [p1]]]); tree.loaded = true; tree.load = async () => {}
  const knoten = { id: 'p1', role: 'product', label: {}, status: 'draft', children: 0, axes: [], attachedGroups: ['technik'], ancestors: [],
    rows: { kennlinie: ['r1', 'r2'] },
    values: [{ attribute: 'u_ein', locale: null, channel: null, value: '12', row: 'r1' }, { attribute: 'u_ein', locale: null, channel: null, value: '24', row: 'r2' }],
    computed: [{ attribute: 'u_aus', value: '6', locale: null, row: 'r1' }, { attribute: 'u_aus', value: '12', locale: null, row: 'r2' }],
    groups: [{ key: 'technik', from: 'p1', fromLabel: 'Netzteil', active: true, attributes: ['kennlinie'] }] }
  globalThis.fetch = async url => {
    const p = String(url)
    const a = /\/nodes\/p1$/.test(p) ? knoten : /\/relations/.test(p) ? { out: [], in: [], inherited: [] } : /\/api\/model\/formula\/check/.test(p) ? { ok: true, result: '6' } : /\/api\/model/.test(p) ? MODELL
      : /\/api\/plugins/.test(p) || /\/api\/streams\//.test(p) || /\/workflow$/.test(p) ? [] : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(a), json: async () => a }
  }
  const router = { path: '/tree/p1', push(x) { this.path = x }, replace(x) { this.path = x } }
  const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  const w = mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route },
    stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true, PluginBands: true, VersionsPanel: true, DocTables: true } } })
  await flushPromises()
  await w.findAll('.tabs .tabbtn').find(x => /Technik/.test(x.text()))?.trigger('click'); await flushPromises()
  return w
}

test('die berechnete Spalte zeigt je Zeile das Ergebnis und hat kein Eingabefeld', async () => {
  const w = await ansicht()
  const zeilen = w.findAll('table.rows tbody tr')
  assert.equal(zeilen.length, 2)
  const ergebnisse = zeilen.map(z => z.find('.cell-box.formula .res').text())
  assert.deepEqual(ergebnisse, ['6', '12'])
  assert.equal(zeilen[0].findAll('.cell-box.formula').length, 1, 'nur die Formelspalte ist berechnet')
  await zeilen[0].find('.cell-box.formula').trigger('click'); await flushPromises()
  assert.equal(zeilen[0].find('input.cell-input').exists(), false, 'das Ergebnis ist nicht zu bearbeiten')
  w.unmount()
})

test('die gewöhnliche Spalte bleibt eine Zelle mit dem Wert der Zeile', async () => {
  const w = await ansicht()
  const eingaben = w.findAll('table.rows tbody tr').map(z => z.findAll('td.cell')[0].text())
  assert.deepEqual(eingaben, ['12', '24'])
  w.unmount()
})

test('ƒ in der Überschrift öffnet das Skript der Spalte', async () => {
  const w = await ansicht()
  const fx = w.find('table.rows thead .fx')
  assert.ok(fx.exists(), 'die Formelspalte trägt ƒ')
  assert.equal(w.findAll('table.rows thead .fx').length, 1, 'nur sie')
  await fx.trigger('click'); await flushPromises()
  assert.ok(w.findComponent({ name: 'ScriptEditor' }).exists(), 'der Skript-Editor ist offen')
  assert.match(w.findComponent({ name: 'ScriptEditor' }).props('title'), /Ausgangsspannung/, 'es ist das Skript dieser Spalte')
  w.unmount()
})
