// Einheit an Relationswerten (30.09.2026): die Einheit gilt je Relation, nicht je Attribut — sonst stellt eine Zeile alle um.
// Bis eine gewählt ist, zeigt die Zeile die günstigste Einheit des Werts (2000 mg = 2 g). Die Werte sind auf beiden Seiten der
// Relation bearbeitbar.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const NodeView = (await import('../src/views/NodeView.vue')).default

const MODELL = {
  masterLocale: 'de', locales: [{ code: 'de' }], channels: [], statuses: [], views: [], families: [], lists: [],
  groups: [{ key: 'rezept', label: { de: 'Rezept' } }],
  relationTypes: [{ key: 'zutaten', label: { de: 'Zutaten' }, reverse: { de: 'Zutat von' }, group: 'rezept', groups: ['rezept'] }],
  units: [
    { key: 'kg', label: { de: 'Kilogramm' }, quantity: 'mass', factor: 1 }, { key: 'g', label: { de: 'Gramm' }, quantity: 'mass', factor: 0.001 },
    { key: 'mg', label: { de: 'Milligramm' }, quantity: 'mass', factor: 0.000001 },
  ],
  attributes: [{ key: 'menge', label: { de: 'Menge' }, type: 'integer', unit: 'mg', group: 'rezept', groups: ['rezept'] }],
}
const wert = v => [{ attribute: 'menge', locale: null, channel: null, value: v }]
const RELATIONEN = {
  out: [
    { id: 'r1', type: 'zutaten', other: { id: 'p2', role: 'product', label: 'Vitamin C' }, values: wert('60') },
    { id: 'r2', type: 'zutaten', other: { id: 'p3', role: 'product', label: 'Zucker' }, values: wert('2000') },
    // Salz: 2000 mg, eingegeben in mg — der Eintrag hat es sich gemerkt, die günstigste Einheit (g) gilt hier nicht
    { id: 'r4', type: 'zutaten', other: { id: 'p5', role: 'product', label: 'Salz' }, values: [{ attribute: 'menge', locale: null, channel: null, value: '2000', unit: 'mg' }] },
  ],
  in: [{ id: 'r3', type: 'zutaten', other: { id: 'p4', role: 'product', label: 'Multivitamin' }, values: wert('2000') }],
  inherited: [],
}

async function ansicht() {
  store.actor = 'u1'; store.toasts = []; store.model = MODELL; store.pendingDocTables = null
  globalThis.HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: s => ({ width: String(s).length * 7 }) })
  const p1 = { id: 'p1', role: 'product', label: 'Mix', parent: null, axes: [] }
  tree.byId = new Map([['p1', p1]]); tree.rows = [p1]; tree.children = new Map([['', [p1]]]); tree.loaded = true; tree.load = async () => {}
  const knoten = { id: 'p1', role: 'product', label: {}, status: 'draft', children: 0, axes: [], attachedGroups: [], ancestors: [], values: [], groups: [] }
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url); const methode = opt.method ?? 'GET'
    rufe.push({ pfad, methode, rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : opt.body })
    const antwort = /\/nodes\/p1$/.test(pfad) ? knoten : /\/nodes\/p1\/relations$/.test(pfad) ? RELATIONEN : /\/api\/model/.test(pfad) ? MODELL
      : /\/api\/streams\//.test(pfad) || /\/workflow$/.test(pfad) || /\/api\/plugins/.test(pfad) || /\/api\/jobs/.test(pfad) ? [] : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  const router = { path: '/tree/p1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  const w = mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route },
    stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true, PluginBands: true, VersionsPanel: true, DocTables: true } } })
  await flushPromises()
  return { w, rufe }
}
// die Zeilen tragen die Id ihrer Relation als title (der Verweis auf den Knoten ist im Test ein leerer Platzhalter)
const ID = { 'Vitamin C': 'r1', 'Zucker': 'r2', 'Multivitamin': 'r3', 'Salz': 'r4' }
const zeile = (w, name) => w.find(`tr[title="${ID[name]}"]`)
const angezeigt = (w, name) => zeile(w, name).find('.cell-box').text()
const einheit = (w, name) => zeile(w, name).find('select.unitsel').element.value

test('jede Zeile zeigt ihren Wert in der günstigsten Einheit: 60 mg bleiben 60 mg, 2000 mg sind 2 g', async () => {
  const { w } = await ansicht()
  assert.deepEqual([angezeigt(w, 'Vitamin C'), einheit(w, 'Vitamin C')], ['60', 'mg'])
  assert.deepEqual([angezeigt(w, 'Zucker'), einheit(w, 'Zucker')], ['2', 'g'])
  w.unmount()
})

test('die Einheit der Eingabe steht im Eintrag und geht vor: Salz wurde in mg eingegeben und bleibt in mg', async () => {
  const { w } = await ansicht()
  assert.deepEqual([angezeigt(w, 'Salz'), einheit(w, 'Salz')], ['2000', 'mg'])
  assert.deepEqual([angezeigt(w, 'Zucker'), einheit(w, 'Zucker')], ['2', 'g'], 'ohne Hinweis die günstigste Einheit')
  w.unmount()
})

test('die Eingabe geht mit ihrer Einheit hinaus, damit der Eintrag sie sich merkt; in mg ohne Hinweis', async () => {
  const { w, rufe } = await ansicht()
  const eingabe = async (name, text) => {
    const z = zeile(w, name)
    await z.find('.cell-box').trigger('keydown', { key: 'Enter' }); await flushPromises()
    await z.find('input.cell-input').setValue(text); await z.find('input.cell-input').trigger('keydown', { key: 'Enter' }); await flushPromises()
  }
  await eingabe('Zucker', '3')                                     // angezeigt in g
  const g = rufe.filter(r => r.methode === 'POST' && /\/api\/relations\/r2\/attributes$/.test(r.pfad)).at(-1)
  assert.deepEqual([g.rumpf.value, g.rumpf.unit], ['3000', 'g'])
  await eingabe('Vitamin C', '70')                                 // angezeigt in mg, der Einheit des Attributs
  const mg = rufe.filter(r => r.methode === 'POST' && /\/api\/relations\/r1\/attributes$/.test(r.pfad)).at(-1)
  assert.equal(mg.rumpf.value, '70')
  assert.equal('unit' in mg.rumpf, false)
  w.unmount()
})

test('eine Einheit umstellen stellt nur diese Zeile um', async () => {
  const { w, rufe } = await ansicht()
  await zeile(w, 'Vitamin C').find('select.unitsel').setValue('g'); await flushPromises()
  assert.equal(angezeigt(w, 'Vitamin C'), '0.06')
  assert.deepEqual([angezeigt(w, 'Zucker'), einheit(w, 'Zucker')], ['2', 'g'], 'Zucker bleibt, wie er war')
  assert.equal(rufe.filter(r => r.methode !== 'GET').length, 0, 'Umstellen schreibt nichts')
  w.unmount()
})

test('in der Einheit der Zeile eingegeben geht umgerechnet in mg hinaus', async () => {
  const { w, rufe } = await ansicht()
  const z = zeile(w, 'Zucker')
  await z.find('.cell-box').trigger('keydown', { key: 'Enter' }); await flushPromises()
  await z.find('input.cell-input').setValue('3'); await z.find('input.cell-input').trigger('keydown', { key: 'Enter' }); await flushPromises()
  const p = rufe.find(r => r.methode === 'POST' && /\/api\/relations\/r2\/attributes$/.test(r.pfad))
  assert.ok(p, 'die Relation r2 wurde beschrieben')
  assert.equal(p.rumpf.value, '3000', '3 g sind 3000 mg')
  w.unmount()
})

test('auch die eingehende Seite ist bearbeitbar, mit eigener Einheit', async () => {
  const { w, rufe } = await ansicht()
  const z = zeile(w, 'Multivitamin')
  assert.deepEqual([z.find('.cell-box').text(), z.find('select.unitsel').element.value], ['2', 'g'])
  await z.find('select.unitsel').setValue('mg'); await flushPromises()
  assert.equal(zeile(w, 'Multivitamin').find('.cell-box').text(), '2000')
  assert.deepEqual([angezeigt(w, 'Zucker'), einheit(w, 'Zucker')], ['2', 'g'], 'die ausgehende Zeile bleibt')
  await zeile(w, 'Multivitamin').find('.cell-box').trigger('keydown', { key: 'Enter' }); await flushPromises()
  const f = zeile(w, 'Multivitamin').find('input.cell-input')
  await f.setValue('2500'); await f.trigger('keydown', { key: 'Enter' }); await flushPromises()
  const p = rufe.find(r => r.methode === 'POST' && /\/api\/relations\/r3\/attributes$/.test(r.pfad))
  assert.ok(p, 'die Relation r3 wurde beschrieben')
  assert.equal(p.rumpf.value, '2500')
  w.unmount()
})
