// Einen geerbten Wert mit „nichts“ überschreiben (27.09.2026 gemeldet: „wird nicht gespeichert“). Leer hiess bisher
// immer „eigener Wert weg“ — über einem geerbten Wert kam der darum sofort zurück; in der Textzelle ging beim Leeren
// sogar gar nichts hinaus. Jetzt heisst leer über einem geerbten Wert „hier gilt nichts“ und geht als eigener leerer
// Wert hinaus (/attributes/clear); zurück zur Vererbung führt das ↓ an der Attributzeile.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const NodeView = (await import('../src/views/NodeView.vue')).default

const MODELL = {
  masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], views: [], families: [],
  lists: [{ key: 'farben', values: [{ key: 'rot', label: { de: 'rot' } }, { key: 'blau', label: { de: 'blau' } }] }],
  groups: [{ key: 'basis', label: { de: 'Basis' } }],
  units: [], relationTypes: [],
  attributes: [
    { key: 'name', label: { de: 'Name' }, type: 'text', group: 'basis', inheritable: true },
    { key: 'farbe', label: { de: 'Farbe' }, type: 'enum', list: 'farben', group: 'basis', inheritable: true },
  ],
}
const GRUPPE = [{ key: 'basis', from: 'g1', fromLabel: 'Mastertree', active: true, attributes: ['name', 'farbe'] }]
const KNOTEN = { id: 'p1', role: 'product', label: 'Bohrer', status: 'draft', children: 0, axes: [], attachedGroups: [], values: [], groups: GRUPPE }
/// Der Vorfahr trägt beide Werte — das Produkt erbt sie
const VORFAHR = {
  id: 'g1', role: 'group', label: 'Mastertree', status: 'draft', children: 1, axes: [], attachedGroups: [], groups: GRUPPE,
  values: [
    { attribute: 'name', locale: null, channel: null, value: 'Modellname', row: null },
    { attribute: 'farbe', locale: null, channel: null, value: 'rot', row: null },
  ],
}

function welt({ eigene = [], geerbt = true } = {}) {
  store.actor = 'u1'; store.toasts = []; store.model = MODELL; store.pendingDocTables = null
  globalThis.HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: s => ({ width: String(s).length * 7 }) })
  tree.byId = new Map([
    ['g1', { id: 'g1', role: 'group', label: 'Mastertree', parent: null, axes: [] }],
    ['p1', { id: 'p1', role: 'product', label: 'Bohrer', parent: 'g1', axes: [] }],
  ])
  tree.rows = [tree.byId.get('g1'), tree.byId.get('p1')]
  tree.children = new Map([['', [tree.byId.get('g1')]], ['g1', [tree.byId.get('p1')]]])
  tree.loaded = true; tree.load = async () => {}
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url); const methode = opt.method ?? 'GET'
    rufe.push({ pfad, methode, rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : opt.body })
    // Die Knotenansicht bekommt die Vorfahren mit ihren Werten in derselben Antwort (node.ancestors)
    const antwort = /\/nodes\/p1$/.test(pfad) ? { ...KNOTEN, values: eigene, ancestors: [geerbt ? VORFAHR : { ...VORFAHR, values: [] }] }
      : /\/nodes\/g1$/.test(pfad) ? (geerbt ? VORFAHR : { ...VORFAHR, values: [] })
      : /\/api\/model/.test(pfad) ? MODELL
      : /\/relations/.test(pfad) ? { out: [], in: [], inherited: [] }
      : /\/api\/streams\//.test(pfad) || /\/workflow$/.test(pfad) || /\/api\/plugins/.test(pfad) || /\/api\/jobs/.test(pfad) ? []
      : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}

async function knoten(opt) {
  const rufe = welt(opt)
  const router = { path: '/tree/p1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  const w = mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route },
    stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true, PluginBands: true, VersionsPanel: true, DocTables: true } } })
  await flushPromises()
  return { w, rufe }
}
/// Die Zeile eines Attributs in der Knotenansicht
const zeile = (w, name) => w.findAll('tbody tr').find(tr => tr.text().replace(/^[☆★]/, '').startsWith(name))
const raus = rufe => rufe.filter(r => r.methode === 'POST' && /\/attributes/.test(r.pfad))

test('Auswahlzelle: „—“ über einem geerbten Wert schreibt „hier gilt nichts“', async () => {
  const { w, rufe } = await knoten()
  const sel = zeile(w, 'Farbe').find('select')
  assert.equal(sel.element.value, 'rot', 'der geerbte Wert steht in der Zelle')
  await sel.setValue(''); await flushPromises()
  const posts = raus(rufe)
  assert.equal(posts.length, 1, 'es ging nichts oder zu viel hinaus')
  assert.match(posts[0].pfad, /\/api\/nodes\/p1\/attributes\/clear$/, 'es ging als gewöhnlicher Wert hinaus — der geerbte käme zurück')
  assert.deepEqual(posts[0].rumpf, { attribute: 'farbe', locale: null, channel: null, row: null })
  w.unmount()
})

test('Textzelle: das Feld leeren schreibt „hier gilt nichts“', async () => {
  const { w, rufe } = await knoten()
  const box = zeile(w, 'Name').find('.cell-box')
  await box.trigger('keydown', { key: 'Enter' }); await flushPromises()
  const feld = zeile(w, 'Name').find('input.cell-input')
  await feld.setValue('')
  await feld.trigger('keydown', { key: 'Enter' }); await flushPromises()
  const posts = raus(rufe)
  assert.equal(posts.length, 1, 'beim Leeren ging nichts hinaus')
  assert.match(posts[0].pfad, /\/api\/nodes\/p1\/attributes\/clear$/)
  assert.equal(posts[0].rumpf.attribute, 'name')
  w.unmount()
})

test('Ohne geerbten Wert bleibt leer das Löschen des eigenen Wertes', async () => {
  const { w, rufe } = await knoten({ geerbt: false, eigene: [{ attribute: 'farbe', locale: null, channel: null, value: 'blau', row: null }] })
  await zeile(w, 'Farbe').find('select').setValue(''); await flushPromises()
  const posts = raus(rufe)
  assert.equal(posts.length, 1)
  assert.match(posts[0].pfad, /\/api\/nodes\/p1\/attributes$/, 'ohne geerbten Wert braucht es kein „hier gilt nichts“')
  assert.equal(posts[0].rumpf.value, '')
  w.unmount()
})

test('↓ an der Attributzeile stellt die Vererbung wieder her', async () => {
  const { w, rufe } = await knoten({ eigene: [{ attribute: 'farbe', locale: null, channel: null, value: 'blau', row: null }] })
  const pfeil = zeile(w, 'Farbe').findAll('span').find(s => s.text() === '↓')
  assert.ok(pfeil, 'das ↓ steht nicht da')
  await pfeil.trigger('click'); await flushPromises()
  const posts = raus(rufe)
  assert.equal(posts.length, 1)
  assert.match(posts[0].pfad, /\/api\/nodes\/p1\/attributes$/, 'der Rückweg ging als „hier gilt nichts“ hinaus')
  assert.equal(posts[0].rumpf.value, '')
  w.unmount()
})
