// ⧉ Reiter der Knotenansicht (28.09.2026): bei Reitern bleibt die Reiterzeile beim Rollen sichtbar — sie klebt unter
// Band und Sicht-Zeile wie diese selbst. happy-dom rechnet kein Layout; die Regel wird im Stil der Ansicht geprüft
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const NodeView = (await import('../src/views/NodeView.vue')).default
const QUELLE = readFileSync(new URL('../src/views/NodeView.vue', import.meta.url), 'utf8')

const MODELL = { masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], lists: [], views: [], families: [], units: [],
  attributes: [{ key: 'weight', label: { de: 'Gewicht' }, type: 'decimal', group: 'physical' }, { key: 'color', label: { de: 'Farbe' }, type: 'text', group: 'look' }],
  groups: [{ key: 'physical', label: { de: 'Physisch' } }, { key: 'look', label: { de: 'Aussehen' } }], relationTypes: [] }

function welt() {
  store.actor = 'u1'; store.toasts = []; store.model = MODELL; store.pendingDocTables = null; store.poll = async () => {}; store.layout = 'tabs'
  globalThis.HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: s => ({ width: String(s).length * 7 }) })
  const p1 = { id: 'p1', role: 'product', label: 'Bohrer', parent: null, axes: [] }
  tree.byId = new Map([['p1', p1]]); tree.rows = [p1]; tree.children = new Map([['', [p1]]]); tree.loaded = true; tree.load = async () => {}
  const knoten = { id: 'p1', role: 'product', label: {}, values: [], status: 'draft', children: 0, axes: [], attachedGroups: ['physical', 'look'], ancestors: [],
    groups: [{ key: 'physical', from: 'p1', fromLabel: 'Bohrer', active: true, attributes: ['weight'] }, { key: 'look', from: 'p1', fromLabel: 'Bohrer', active: true, attributes: ['color'] }] }
  globalThis.fetch = async (url) => {
    const pfad = String(url)
    const antwort = /\/nodes\/p1$/.test(pfad) ? knoten : /\/relations/.test(pfad) ? { out: [], in: [], inherited: [] } : /\/api\/model/.test(pfad) ? MODELL : /\/api\/plugins/.test(pfad) ? [] : /\/api\/streams\//.test(pfad) || /\/workflow$/.test(pfad) ? [] : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  const router = { path: '/tree/p1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  return mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true, PluginBands: true, VersionsPanel: true, DocTables: true } } })
}

test('Reiter: je Gruppe einer, der gewählte zeigt nur seine Attribute', async () => {
  const w = welt(); await flushPromises()
  const reiter = w.findAll('.tabs .tabbtn')
  assert.deepEqual(reiter.map(b => b.text()), ['Physisch', 'Aussehen'])
  await reiter[1].trigger('click'); await flushPromises()
  assert.ok(reiter[1].classes('on'))
  const zeilen = w.findAll('table.values tbody tr').map(tr => tr.text())
  assert.ok(zeilen.some(z => /Farbe/.test(z)) && !zeilen.some(z => /Gewicht/.test(z)), `nur die Gruppe des Reiters: ${zeilen.join(' | ')}`)
})

test('Reiter kleben beim Rollen unter Band und Sicht-Zeile', () => {
  const regel = s => { const m = QUELLE.match(new RegExp('^' + s.replace('.', '\\.') + ' \\{([^}]*)\\}', 'm')); assert.ok(m, `Regel ${s} fehlt`); return m[1] }
  const band = regel('.section h2, h2.band'), sicht = regel('.view'), tabs = regel('.tabs')
  assert.match(band, /position: sticky; top: 0/); assert.match(sicht, /position: sticky; top: 26px/)
  assert.match(tabs, /position: sticky/)
  // Bandhöhe + Höhe der Sicht-Zeile = Oberkante der Reiter
  const hoehe = s => Number((s.match(/(?:^|; )height: (\d+)px/) ?? [])[1])
  assert.equal(Number(tabs.match(/top: (\d+)px/)[1]), hoehe(band) + hoehe(sicht), `Band ${hoehe(band)} + Sicht ${hoehe(sicht)}`)
  assert.match(tabs, /z-index: 3/)
})

test('Reiter und Werte stehen in einem Block — sonst klebten die Reiter weiter, während der nächste Abschnitt läuft', async () => {
  const w = welt(); await flushPromises()
  const block = w.find('.attr-block')
  assert.ok(block.exists(), 'der Abschnitt Attribute ist ein Block')
  assert.ok(block.find('.tabs').exists(), 'die Reiter stehen darin')
  assert.ok(block.find('table.values').exists(), 'die Werte auch')
  // das Band des nächsten Abschnitts steht ausserhalb
  const bands = w.findAll('h2.band').map(b => b.text())
  assert.ok(bands.some(x => /Attribute/.test(x)))
  assert.equal(block.findAll('h2.band').length, 0, 'kein Band im Block — es würde mitkleben')
})

test('die Reiterzeile rollt in sich, wenn es viele Gruppen sind', () => {
  const regel = QUELLE.match(/^\.tabs \{([^}]*)\}/m)[1]
  assert.match(regel, /max-height:/); assert.match(regel, /overflow-y: auto/)
})
