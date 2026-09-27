// ▦ Tabellen aus dem Dokument (27.09.2026, 34 L): der Dialog am Knoten. Je Zeile Schlüssel und Wert aus dem Dokument,
// daneben der Vorschlag des Mappers — gefunden, neu oder nichts. Geschrieben wird erst mit ✓, und dann in der
// Reihenfolge Modell (neue Attribute, Gruppe „aus Dokument“) → Gruppe an den Knoten → ein Stapel für die Werte.
// Ein noch nicht gelesenes Dokument: der Dialog stösst den Job an und wartet, statt leere Tabellen zu zeigen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const DocTables = (await import('../src/components/DocTables.vue')).default
const NodeView = (await import('../src/views/NodeView.vue')).default

const MODELL = {
  masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], lists: [], views: [], families: [],
  groups: [{ key: 'physical', label: { de: 'Physisch' } }, { key: 'from_document', label: { de: 'aus Dokument' } }],
  units: [{ key: 'kg', label: { de: 'Kilogramm' } }, { key: 'mm', label: { de: 'Millimeter' } }],
  attributes: [
    { key: 'weight', label: { de: 'Gewicht' }, type: 'decimal', unit: 'kg', group: 'physical' },
    { key: 'name', label: { de: 'Name' }, type: 'text', group: 'physical', perLocale: true },
  ],
  relationTypes: [{ key: 'document', label: { de: 'Dokument' }, to: ['media'], group: 'relation_media' }],
}
const KNOTEN = { id: 'p1', role: 'product', label: 'Bohrer', values: [], status: 'draft', children: 0, axes: [], groups: [{ key: 'physical', from: 'g1', fromLabel: 'Mastertree', active: true, attributes: ['weight', 'name'] }], attachedGroups: [] }
const TABELLEN = { ready: true, state: 'text', tables: [{ seq: 0, page: 1, heading: 'Technische Daten', rows: [['Gewicht', '1,2 kg'], ['Durchmesser', '22 mm'], ['Farbe', 'blau'], ['Seite 1 von 3']] }] }

function welt({ tabellen = TABELLEN, jobs = [{ key: 'lesen', plugin: 'docs', enabled: true }] } = {}) {
  store.actor = 'u1'; store.toasts = []; store.model = MODELL; store.pendingDocTables = null
  // die Knotenansicht misst Spaltenbreiten am Canvas — happy-dom hat keines
  globalThis.HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: s => ({ width: String(s).length * 7 }) })
  tree.byId = new Map([['p1', { id: 'p1', role: 'product', label: 'Bohrer', parent: null, axes: [] }]])
  tree.rows = [tree.byId.get('p1')]; tree.children = new Map([['', tree.rows]]); tree.loaded = true; tree.load = async () => {}
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url); const methode = opt.method ?? 'GET'
    rufe.push({ pfad, methode, rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : opt.body })
    const antwort = /\/api\/docs\/[^/]+\/tables/.test(pfad) ? (typeof tabellen === 'function' ? tabellen() : tabellen)
      : /\/api\/jobs$/.test(pfad) ? jobs
      : /\/api\/batch/.test(pfad) ? { batch: 'b-1', results: opt.body ? JSON.parse(opt.body).commands.map((c, i) => ({ index: i })) : [], error: null }
      : /\/api\/media$/.test(pfad) && methode === 'POST' ? { id: 'm-' + rufe.length, existed: false }
      : /\/relations$/.test(pfad) && methode === 'POST' ? { stream: 'r-1' }
      : /\/relations/.test(pfad) ? { out: [], in: [], inherited: [] }
      : /\/api\/streams\//.test(pfad) || /\/workflow$/.test(pfad) ? []
      : /\/api\/model/.test(pfad) ? MODELL
      : /\/api\/plugins/.test(pfad) ? []
      : /\/nodes\/p1$/.test(pfad) ? KNOTEN
      : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}

async function dialog(opt) {
  const rufe = welt(opt)
  const w = mount(DocTables, { props: { node: KNOTEN, media: ['m1'] } })
  await flushPromises()
  return { w, rufe }
}
const zeile = (w, key) => w.findAll('tbody tr').find(tr => tr.find('td:nth-child(2)').text().startsWith(key))

test('die Zeilen der Tabelle mit dem Vorschlag: gefunden, neu mit Einheit, neu als Text — eine Zeile ohne Wert fehlt', async () => {
  const { w } = await dialog()
  const rows = w.vm.rows
  assert.equal(rows.length, 3, 'drei Zeilen Schlüssel/Wert; „Seite 1 von 3“ hat keinen Wert')
  const gewicht = rows.find(r => r.key === 'Gewicht'), dm = rows.find(r => r.key === 'Durchmesser'), farbe = rows.find(r => r.key === 'Farbe')
  assert.deepEqual([gewicht.target, gewicht.attribute, gewicht.converted], ['attr', 'weight', '1.2'], 'Gewicht ist das Attribut weight, der Wert ohne Einheit')
  assert.deepEqual([dm.target, dm.newKey, dm.newType, dm.unit, dm.converted], ['new', 'durchmesser', 'integer', 'mm', '22'])
  assert.deepEqual([farbe.target, farbe.newKey, farbe.newType, farbe.converted], ['new', 'farbe', 'text', 'blau'])
  assert.ok(rows.every(r => r.take), 'alle drei sind angehakt')
  assert.match(w.find('.dt-foot .primary').text(), /3/)
  assert.equal(w.vm.warten, false)
  // im DOM steht der Schlüssel aus dem Dokument, und das Ziel ist gewählt
  assert.equal(zeile(w, 'Gewicht').find('select').element.value, 'weight')
  assert.equal(zeile(w, 'Durchmesser').find('select').element.value, '+')
})

test('✓ schreibt: erst die neuen Attribute in die Gruppe „aus Dokument“, dann die Gruppe an den Knoten, dann ein Stapel', async () => {
  const { w, rufe } = await dialog()
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const puts = rufe.filter(r => r.methode === 'PUT' && /\/api\/model\/attributes\//.test(r.pfad))
  assert.deepEqual(puts.map(r => r.pfad.split('/').at(-1)).sort(), ['durchmesser', 'farbe'])
  const dm = puts.find(r => r.pfad.endsWith('/durchmesser')).rumpf
  assert.deepEqual({ type: dm.type, unit: dm.unit, group: dm.group, label: dm.label }, { type: 'integer', unit: 'mm', group: 'from_document', label: { de: 'Durchmesser' } })
  const gruppen = rufe.find(r => r.methode === 'PUT' && /\/nodes\/p1\/groups$/.test(r.pfad))
  assert.ok(gruppen, 'die Gruppe kommt an den Knoten — am Pfad gilt sie noch nicht')
  assert.deepEqual(gruppen.rumpf.groups, ['from_document'])
  const stapel = rufe.find(r => /\/api\/batch/.test(r.pfad))
  assert.ok(stapel); assert.match(stapel.pfad, /skipErrors=true/)
  assert.deepEqual(stapel.rumpf.commands.map(c => [c.op, c.args.attribute, c.args.value]), [['attribute.set', 'weight', '1.2'], ['attribute.set', 'durchmesser', '22'], ['attribute.set', 'farbe', 'blau']])
  // Reihenfolge: Modell vor Gruppe vor Stapel
  const at = re => rufe.findIndex(r => re.test(r.pfad) && r.methode !== 'GET')
  assert.ok(at(/\/api\/model\/attributes\//) < at(/\/groups$/) && at(/\/groups$/) < at(/\/api\/batch/))
  assert.ok(w.emitted('done'), 'der Dialog meldet fertig')
  assert.match(store.toasts.at(-1)?.text ?? '', /3 Werte/)
})

test('ohne Haken keine Zeile — und kein neues Attribut, das keiner nimmt', async () => {
  const { w, rufe } = await dialog()
  await zeile(w, 'Farbe').find('input[type=checkbox]').setValue(false)
  await zeile(w, 'Durchmesser').find('input[type=checkbox]').setValue(false)
  await flushPromises()
  assert.match(w.find('.dt-foot .primary').text(), /1/)
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  assert.equal(rufe.filter(r => r.methode === 'PUT' && /\/api\/model\/attributes\//.test(r.pfad)).length, 0)
  assert.equal(rufe.filter(r => r.methode === 'PUT' && /\/groups$/.test(r.pfad)).length, 0, 'ohne neues Attribut braucht der Knoten die Gruppe nicht')
  assert.deepEqual(rufe.find(r => /\/api\/batch/.test(r.pfad)).rumpf.commands.map(c => c.args.attribute), ['weight'])
})

test('das Ziel lässt sich umstellen: Farbe auf ein vorhandenes Attribut, mit Sprache', async () => {
  const { w, rufe } = await dialog()
  await zeile(w, 'Farbe').find('select').setValue('name'); await flushPromises()
  assert.equal(w.vm.rows.find(r => r.key === 'Farbe').target, 'attr')
  await w.find('.dt-foot .primary').trigger('click'); await flushPromises()
  const cmd = rufe.find(r => /\/api\/batch/.test(r.pfad)).rumpf.commands.find(c => c.args.attribute === 'name')
  assert.equal(cmd.args.locale, 'de', 'ein Attribut je Sprache bekommt die Mastersprache')
})

test('noch nicht gelesen: der Dialog stösst den Job „Dokumente lesen“ an und wartet', async () => {
  let n = 0
  const { w, rufe } = await dialog({ tabellen: () => (++n === 1 ? { ready: true, state: null, tables: [] } : TABELLEN) })
  assert.equal(w.vm.warten, true)
  assert.match(w.text(), /wird gelesen/)
  const start = rufe.find(r => r.methode === 'POST' && /\/api\/jobs\/lesen\/run$/.test(r.pfad))
  assert.ok(start, 'der Job des Plugins docs wird gestartet')
  assert.equal(rufe.filter(r => /\/api\/jobs\/lesen\/run$/.test(r.pfad)).length, 1, 'und nur einmal')
  w.unmount()
})

test('ohne Job des Plugins docs steht das da — ohne Ratschlag', async () => {
  const { w } = await dialog({ tabellen: { ready: true, state: null, tables: [] }, jobs: [] })
  assert.match(w.vm.hinweis, /Kein Job/)
  w.unmount()
})

test('am Knoten: Strg beim Ablegen öffnet den Dialog, ohne Strg nicht', async () => {
  const rufe = welt()
  const router = { path: '/tree/p1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  const w = mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true, PluginBands: true, VersionsPanel: true, DocTables: true } } })
  await flushPromises()
  const band = w.findAll('.section').find(s => /▩ Assets/.test(s.find('h2')?.text() ?? ''))
  assert.ok(band, 'das Medienband steht da')
  const datei = new File([new Uint8Array([1, 2, 3])], 'datenblatt.pdf', { type: 'application/pdf' })
  await band.trigger('drop', { dataTransfer: { files: [datei], types: ['Files'] } }); await flushPromises()
  assert.equal(w.findComponent({ name: 'DocTables' }).exists(), false, 'ohne Strg nur anhängen')
  await band.trigger('drop', { dataTransfer: { files: [datei], types: ['Files'] }, ctrlKey: true }); await flushPromises()
  const dt = w.findComponent({ name: 'DocTables' })
  assert.ok(dt.exists(), 'mit Strg öffnet sich der Dialog')
  assert.equal(dt.props('media').length, 1)
  assert.equal(rufe.filter(r => r.pfad.endsWith('/api/media') && r.methode === 'POST').length, 2, 'angehängt wird in beiden Fällen')
})

test('am Knoten: ein Strg-Drop aus dem Baum kommt über den Store an', async () => {
  welt()
  store.pendingDocTables = { node: 'p1', media: ['m7'] }
  const router = { path: '/tree/p1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  const w = mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true, PluginBands: true, VersionsPanel: true, DocTables: true } } })
  await flushPromises()
  const dt = w.findComponent({ name: 'DocTables' })
  assert.ok(dt.exists()); assert.deepEqual(dt.props('media'), ['m7'])
  assert.equal(store.pendingDocTables, null, 'der Auftrag ist verbraucht')
})
