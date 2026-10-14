// Wert + Einheit in der Zelle (30.09.2026): ein Zahlenattribut mit Einheit zeigt neben dem Wert eine Auswahl der Einheiten
// seiner Grösse. Anfangs gilt die Einheit des Attributs; umschalten rechnet die Anzeige um, schreibt aber nichts. Was in
// der anderen Einheit getippt wird, geht umgerechnet in der Einheit des Attributs hinaus.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { gewaehlt } from '../src/units.js'

const NodeView = (await import('../src/views/NodeView.vue')).default

const MODELL = {
  masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], views: [], families: [], lists: [],
  groups: [{ key: 'basis', label: { de: 'Basis' } }], relationTypes: [],
  units: [
    { key: 't', label: { de: 'Tonne' }, quantity: 'mass', factor: 1000 }, { key: 'kg', label: { de: 'Kilogramm' }, quantity: 'mass', factor: 1 },
    { key: 'g', label: { de: 'Gramm' }, quantity: 'mass', factor: 0.001 }, { key: 'mg', label: { de: 'Milligramm' }, quantity: 'mass', factor: 0.000001 },
    { key: 'm', label: { de: 'Meter' }, quantity: 'length', factor: 1 },
  ],
  attributes: [
    { key: 'gewicht', label: { de: 'Gewicht' }, type: 'decimal', unit: 'kg', group: 'basis' },
    { key: 'stueck', label: { de: 'Stückgewicht' }, type: 'integer', unit: 'kg', group: 'basis' },
    { key: 'laenge', label: { de: 'Länge' }, type: 'decimal', unit: 'm', group: 'basis' },
    { key: 'netto', label: { de: 'Nettogewicht' }, type: 'decimal', unit: 'kg', group: 'basis' },
  ],
}
const GRUPPE = [{ key: 'basis', from: 'g1', fromLabel: 'Mastertree', active: true, attributes: ['gewicht', 'stueck', 'laenge', 'netto'] }]

function welt() {
  for (const k of Object.keys(gewaehlt)) delete gewaehlt[k]
  store.actor = 'u1'; store.toasts = []; store.model = MODELL; store.pendingDocTables = null
  globalThis.HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: s => ({ width: String(s).length * 7 }) })
  tree.byId = new Map([['p1', { id: 'p1', role: 'product', label: 'Bohrer', parent: null, axes: [] }]])
  tree.rows = [tree.byId.get('p1')]; tree.children = new Map([['', [tree.byId.get('p1')]]]); tree.loaded = true; tree.load = async () => {}
  const knoten = { id: 'p1', role: 'product', label: 'Bohrer', status: 'draft', children: 0, axes: [], attachedGroups: [], groups: GRUPPE, ancestors: [],
    // netto: gespeichert 0.25 kg, eingegeben in g (der Eintrag hat es sich gemerkt)
    values: [{ attribute: 'gewicht', locale: null, channel: null, value: '0.5', row: null }, { attribute: 'stueck', locale: null, channel: null, value: '2', row: null },
      { attribute: 'netto', locale: null, channel: null, value: '0.25', row: null, unit: 'g' }] }
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url); const methode = opt.method ?? 'GET'
    rufe.push({ pfad, methode, rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : opt.body })
    const antwort = /\/nodes\/p1$/.test(pfad) ? knoten : /\/api\/model/.test(pfad) ? MODELL : /\/relations/.test(pfad) ? { out: [], in: [], inherited: [] }
      : /\/api\/streams\//.test(pfad) || /\/workflow$/.test(pfad) || /\/api\/plugins/.test(pfad) || /\/api\/jobs/.test(pfad) ? [] : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}
async function ansicht() {
  const rufe = welt()
  const router = { path: '/tree/p1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  const w = mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route },
    stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true, PluginBands: true, VersionsPanel: true, DocTables: true } } })
  await flushPromises()
  return { w, rufe }
}
const zeile = (w, name) => w.findAll('tbody tr').find(tr => tr.text().replace(/^[☆★]/, '').startsWith(name))
const raus = rufe => rufe.filter(r => r.methode === 'POST' && /\/attributes$/.test(r.pfad))
async function eintragen(zl, text) {
  await zl.find('.cell-box').trigger('keydown', { key: 'Enter' }); await flushPromises()
  const feld = zl.find('input.cell-input')
  await feld.setValue(text); await feld.trigger('keydown', { key: 'Enter' }); await flushPromises()
}

test('die Zelle zeigt den Wert in der Einheit des Attributs; zur Wahl stehen die Einheiten der Grösse', async () => {
  const { w } = await ansicht()
  const zl = zeile(w, 'Gewicht')
  assert.equal(zl.find('.cell-box').text(), '0.5')
  const sel = zl.find('select.unitsel')
  assert.ok(sel.exists(), 'die Einheitenauswahl steht in der Zelle')
  assert.equal(sel.element.value, 'kg', 'anfangs gilt die Einheit des Attributs')
  assert.deepEqual(sel.findAll('option').map(o => o.text()), ['t', 'kg', 'g', 'mg'])
  assert.equal(zeile(w, 'Länge').find('select.unitsel').exists(), false, 'eine Länge allein hat keine Wahl')
  // die Auswahl steht in einem eigenen Streifen der Zelle (Cell.vue: .mit-einheit), nicht im Feld
  assert.ok(zl.find('td.cell.mit-einheit').exists(), 'die Zelle reserviert den Streifen')
  assert.equal(zl.find('.cell-box select').exists(), false, 'die Auswahl liegt nicht im Feld')
  assert.ok(zl.find('td.cell > .unit-slot select.unitsel').exists(), 'sondern daneben')
  w.unmount()
})

test('umschalten rechnet die Anzeige um und schreibt nichts', async () => {
  const { w, rufe } = await ansicht()
  const zl = zeile(w, 'Gewicht')
  await zl.find('select.unitsel').setValue('g'); await flushPromises()
  assert.equal(zl.find('.cell-box').text(), '500')
  await zl.find('select.unitsel').setValue('mg'); await flushPromises()
  assert.equal(zl.find('.cell-box').text(), '500000')
  assert.equal(raus(rufe).length, 0, 'das Umschalten ist keine Änderung am Journal')
  w.unmount()
})

test('in der anderen Einheit eingegeben geht umgerechnet in der Einheit des Attributs hinaus', async () => {
  const { w, rufe } = await ansicht()
  const zl = zeile(w, 'Gewicht')
  await zl.find('select.unitsel').setValue('g'); await flushPromises()
  await eintragen(zl, '750')
  const posts = raus(rufe)
  assert.equal(posts.length, 1)
  assert.deepEqual([posts[0].rumpf.attribute, posts[0].rumpf.value], ['gewicht', '0.75'])
  w.unmount()
})

test('in der Einheit des Attributs bleibt die Eingabe, wie sie ist', async () => {
  const { w, rufe } = await ansicht()
  await eintragen(zeile(w, 'Gewicht'), '2.5')
  assert.equal(raus(rufe)[0].rumpf.value, '2.5')
  w.unmount()
})

test('eine Zahl mit Komma geht mit Punkt hinaus — der Server las „4,5“ als 45 (14.10.2026)', async () => {
  const { w, rufe } = await ansicht()
  await eintragen(zeile(w, 'Gewicht'), '4,5')
  assert.equal(raus(rufe).at(-1).rumpf.value, '4.5')
  await eintragen(zeile(w, 'Länge'), '1.234,75')
  assert.equal(raus(rufe).at(-1).rumpf.value, '1234.75', 'Tausenderpunkt und Dezimalkomma')
  w.unmount()
})

test('die Einheit der Eingabe steht im Eintrag: die Zelle zeigt den Wert wieder so, wie er eingegeben wurde', async () => {
  const { w } = await ansicht()
  const zl = zeile(w, 'Nettogewicht')
  assert.equal(zl.find('select.unitsel').element.value, 'g', 'eingegeben in g, nicht in der Einheit des Attributs')
  assert.equal(zl.find('.cell-box').text(), '250', '0.25 kg sind 250 g')
  assert.equal(zeile(w, 'Gewicht').find('select.unitsel').element.value, 'kg', 'ohne Hinweis gilt die Einheit des Attributs')
  w.unmount()
})

test('eine Eingabe in einer anderen Einheit geht mit dieser Einheit hinaus; in der des Attributs ohne', async () => {
  const { w, rufe } = await ansicht()
  const zl = zeile(w, 'Gewicht')
  await zl.find('select.unitsel').setValue('g'); await flushPromises()
  await eintragen(zl, '750')
  assert.deepEqual([raus(rufe).at(-1).rumpf.value, raus(rufe).at(-1).rumpf.unit], ['0.75', 'g'])
  await zeile(w, 'Gewicht').find('select.unitsel').setValue('kg'); await flushPromises()
  await eintragen(zeile(w, 'Gewicht'), '2')
  assert.equal(raus(rufe).at(-1).rumpf.value, '2')
  assert.equal('unit' in raus(rufe).at(-1).rumpf, false, 'in der Einheit des Attributs braucht es keinen Hinweis')
  w.unmount()
})

test('ein ganzzahliges Attribut lehnt ein Ergebnis mit Nachkommastellen ab: nichts geht hinaus, die Meldung sagt warum', async () => {
  const { w, rufe } = await ansicht()
  const zl = zeile(w, 'Stückgewicht')
  await zl.find('select.unitsel').setValue('g'); await flushPromises()
  assert.equal(zl.find('.cell-box').text(), '2000')
  await eintragen(zl, '1')
  assert.equal(raus(rufe).length, 0)
  assert.match(store.toasts.at(-1)?.text ?? '', /1 g sind 0\.001 kg/)
  await eintragen(zl, '3000')
  assert.equal(raus(rufe).at(-1).rumpf.value, '3', 'ein ganzes Ergebnis geht hinaus')
  w.unmount()
})
