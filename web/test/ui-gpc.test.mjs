// ⌗ GPC: der Klassendialog — Veröffentlichung einlesen und übernehmen, Umfeld, KI-Vorschlag, Suche, Durchsehen und zuweisen.
// Der Server ist ein Stellvertreter, der die Plugin-Daten hält — geprüft wird, was die Ansicht ihm schickt.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { ai } from '../src/ai.js'
import { recentFiles } from '../src/recentFiles.js'

const probe = fs.readFileSync(new URL('../../plugins/gpc/sample.json', import.meta.url), 'utf8')
const BAUM = [
  { id: 'g1', parent: null, label: 'Leuchten', role: 'group' },
  { id: 'p1', parent: 'g1', label: 'Stehlampe', role: 'product' },
  { id: 'p2', parent: 'g1', label: 'Tischlampe', role: 'product' },
]

function server({ assign = {}, migrate = null, node = { values: [], ancestors: [] }, tabelle = { rows: [] } } = {}) {
  const daten = {}; const calls = []
  globalThis.fetch = async (url, opts = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    const method = opts.method ?? 'GET'
    const body = opts.body ? JSON.parse(opts.body) : null
    calls.push({ path, method, body })
    let out = {}
    if (path === '/api/plugins/gpc/data' && method === 'GET') out = daten
    else if (path === '/api/plugins/gpc/data' && method === 'PUT') Object.assign(daten, body)
    else if (path.startsWith('/api/plugins/gpc/data/') && method === 'PUT') daten[decodeURIComponent(path.split('/').pop())] = body
    else if (path === '/api/classification/assign') out = { group: 'class_gpc', classAttr: 'gpc_class', attributes: 2, groupAttached: true, readiness: { ready: true, groupExists: true, groupOn: true, missing: [] }, ...assign }
    else if (path === '/api/classification/migrate') out = body.dryRun ? (migrate ?? { groups: 0, attributes: 0, nodes: 0 }) : { groups: 2, attributes: 5, nodes: 3 }
    else if (path.endsWith('/table')) out = tabelle
    else if (path.startsWith('/api/nodes/')) out = node
    return { ok: true, status: 200, text: async () => JSON.stringify(out) }
  }
  return { calls, daten }
}
const ruhe = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }

async function dialog(node = '', extra = {}) {
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }, { code: 'en' }], views: [], attributes: [], groups: [], lists: [] }
  tree.rows = BAUM; tree.byId = new Map(BAUM.map(r => [r.id, r])); tree.loaded = true; tree.load = async () => {}
  tree.kids = id => BAUM.filter(r => r.parent === id); tree.ancestors = id => { const a = []; for (let p = tree.byId.get(id)?.parent; p; p = tree.byId.get(p)?.parent) a.unshift(tree.byId.get(p)); return a }
  store.poll = async () => {}
  recentFiles.list = async () => extra.recent ?? []
  recentFiles.remember = async () => {}
  const { default: Klasse } = await import('../../plugins/gpc/src/Klasse.vue')
  const w = mount(Klasse, { props: { node, modal: !!extra.modal }, global: { stubs: { TreePicker: true } } })
  await ruhe()
  return w
}
async function mitDaten(node = '', opts = {}, extra = {}) {
  const s = server(opts)
  const w = await dialog(node, extra)
  await w.vm.datei(new File([probe], 'GPC.json')); await ruhe()
  await w.vm.uebernehmen(); await ruhe()
  return { w, ...s }
}
const knopf = (w, text) => w.findAll('button').find(b => b.text() === text)

test('ohne Daten: nichts übernommen, die Datei wird angeboten, Suche und Durchsehen fehlen', async () => {
  server()
  const w = await dialog()
  assert.match(w.text(), /nichts übernommen/)
  assert.equal(w.find('.drop').exists(), true)
  assert.equal(w.find('input.suche').exists(), false)
})

test('eine gelesene Datei wird übernommen: Segment, Wörterbuch und Kopf gehen in einem Aufruf ans Journal', async () => {
  const { calls } = server()
  const w = await dialog()
  await w.vm.datei(new File([probe], 'GPC.json')); await ruhe()
  assert.match(w.text(), /2026-01 · EN · 3 Bricks/)
  await knopf(w, 'übernehmen').trigger('click'); await ruhe()
  const put = calls.find(c => c.method === 'PUT' && c.path === '/api/plugins/gpc/data')
  assert.deepEqual(Object.keys(put.body).sort(), ['bricks:99000000', 'dict', 'release'])
  assert.match(w.text(), /2026-01 · 2026-01-01 · 3 Bricks/, 'danach steht der Stand da')
  assert.equal(w.vm.gelesen, null)
  assert.equal(w.find('.drop').exists(), false, 'mit übernommenen Daten lädt der Dialog nicht zum Ablegen ein')
})

test('eine Datei, die keine GPC-Datei ist, wird gemeldet und übernimmt nichts', async () => {
  const { calls } = server()
  const w = await dialog()
  await w.vm.datei(new File(['{"a":1}'], 'x.json')); await ruhe()
  assert.match(w.text(), /keine GPC-Datei/)
  assert.equal(calls.some(c => c.method === 'PUT'), false)
})

test('suchen, einen Brick wählen, zuweisen: der Server bekommt Klasse, System und Merkmale', async () => {
  const { w, calls } = await mitDaten('p1')
  await w.find('input.suche').setValue('lamps'); await ruhe()
  const zeilen = w.findAll('.liste .pick')
  assert.equal(zeilen.length, 1)
  assert.match(zeilen[0].text(), /19900001 Sample Lamps · Sample Segment › Sample Electrical › Sample Lighting/)
  assert.equal(knopf(w, '✓ zuweisen').attributes('disabled') !== undefined, true, 'ohne Brick nicht')
  await zeilen[0].trigger('click')
  assert.match(w.text(), /Sample Colour · 3/); assert.match(w.text(), /Sample Size · 2/)
  await knopf(w, '✓ zuweisen').trigger('click'); await ruhe()
  const a = calls.find(c => c.path === '/api/classification/assign')
  assert.equal(a.body.node, 'p1'); assert.equal(a.body.class, '19900001')
  assert.deepEqual([a.body.system.group, a.body.system.classAttr, a.body.system.ownPattern], ['class_gpc', 'gpc_class', '^gpc\\d+$'])
  assert.deepEqual(a.body.features.map(f => [f.key, f.type, f.values.length, f.classes]), [['gpc29900001', 'enum', 3, ['19900001', '19900002']], ['gpc29900002', 'enum', 2, ['19900001']]])
  assert.deepEqual(a.body.classes.map(c => c.code).sort(), ['19900001', '19900002', '19900003'], 'die Liste der Klassen gibt es noch nicht: alle gehen mit')
})

test('durchsehen: Segment › Family › Class › Brick mit Zahlen, ein Klick wählt den Brick', async () => {
  const { w } = await mitDaten('p1')
  assert.match(w.find('.baum').text(), /Sample Segment\s*3/)
  assert.doesNotMatch(w.find('.baum').text(), /Sample Lamps/, 'zugeklappt')
  await w.findAll('.baum .pick')[0].trigger('click')
  assert.match(w.find('.baum').text(), /Sample Electrical\s*3/)
  await w.findAll('.baum .pick')[1].trigger('click')
  assert.match(w.find('.baum').text(), /Sample Lighting\s*1/); assert.match(w.find('.baum').text(), /Sample Wiring\s*2/)
  await w.findAll('.baum .pick').find(p => /Sample Wiring/.test(p.text())).trigger('click')
  await w.findAll('.baum .pick').find(p => /Sample Boxes/.test(p.text())).trigger('click')
  assert.equal(w.vm.gewaehlterBrick.code, '19900003')
})

test('der Knoten steht schon da — mit der Klasse, die dort gilt, eigen oder geerbt', async () => {
  const eigen = await mitDaten('p1', { node: { values: [{ attribute: 'gpc_class', value: '19900001' }], ancestors: [] } })
  assert.match(eigen.w.text(), /gilt hier: 19900001 Sample Lamps/)
  assert.doesNotMatch(eigen.w.text(), /Sample Lamps ↑/)
  const geerbt = await mitDaten('p1', { node: { values: [], ancestors: [{ label: 'Leuchten', values: [{ attribute: 'gpc_class', value: '19900002' }] }] } })
  assert.match(geerbt.w.text(), /gilt hier: 19900002 Sample Cables ↑/)
  const keine = await mitDaten('p1')
  assert.match(keine.w.text(), /hier gilt noch keine Klasse/)
})

test('Umfeld: die Klassen der Geschwister und der Knoten darunter, die häufigste zuerst, ein Klick wählt sie', async () => {
  // derselbe Stellvertreter antwortet auf beide Fragen (Geschwister, darunter): jede Klasse zählt zweimal
  const tabelle = { rows: [
    { row: { id: 'p2' }, values: { gpc_class: { value: '19900002', own: true } } },
    { row: { id: 'p3' }, values: { gpc_class: { value: '19900002', own: true } } },
    { row: { id: 'p4' }, values: { gpc_class: { value: '19900001', own: true } } },
    { row: { id: 'p1' }, values: { gpc_class: { value: '19900003', own: true } } },
  ] }
  const { w } = await mitDaten('p1', { tabelle })
  const zeilen = w.findAll('.pick').filter(p => /im Umfeld/.test(p.text()))
  assert.deepEqual(zeilen.map(z => z.text().replace(/\s+/g, ' ')), ['19900002 Sample Cables · 4 im Umfeld', '19900001 Sample Lamps · 2 im Umfeld'])
  await zeilen[0].trigger('click')
  assert.equal(w.vm.gewaehlterBrick.code, '19900002')
  assert.equal(w.vm.umfeld.find(u => u.code === '19900003'), undefined, 'der Knoten selbst zählt nicht')
})

test('KI: erst die Familie, dann der Brick; nur Bricks aus der Liste kommen in die Auswahl', async () => {
  const { w } = await mitDaten('p1')
  const fragen = []
  ai.available = () => true; ai.label = () => 'Test'
  ai.ask = async ({ user }) => {
    fragen.push(user)
    if (/Familien:/.test(user)) return { familien: ['Sample Segment › Sample Electrical', 'gibtsnicht'] }
    return { vorschlaege: [{ code: '19900001', warum: 'Lampe' }, { code: '12345678', warum: 'erfunden' }] }
  }
  await w.vm.kiFragen(); await ruhe()
  assert.equal(fragen.length, 2)
  assert.match(fragen[0], /Produkt: Stehlampe/); assert.match(fragen[0], /Sample Segment › Sample Electrical/)
  assert.match(fragen[1], /19900001 Sample Lamps/)
  assert.deepEqual(w.vm.ki.liste, [{ code: '19900001', warum: 'Lampe' }], 'ein Code, den es nicht gibt, fällt weg')
  assert.deepEqual(w.vm.ki.familien, ['Sample Segment › Sample Electrical'])
  ai.available = () => false
})

test('die zuletzt gewählten Dateien stehen in einer Liste und öffnen sich wieder', async () => {
  server()
  const datei = new File([probe], 'GPC-2026-05.zip')
  recentFiles.reopen = async r => r.handle ? datei : null
  const w = await dialog('', { recent: [{ name: 'GPC-2026-05.zip', handle: {} }, { name: 'alt.zip', handle: null }] })
  const chips = w.findAll('.recent .chip')
  assert.deepEqual(chips.map(c => c.text()), ['GPC-2026-05.zip', 'alt.zip'])
  assert.match(chips[1].classes().join(' '), /dim/)
  await chips[0].trigger('click'); await ruhe()
  assert.match(w.text(), /2026-01 · EN · 3 Bricks/, 'gelesen, ohne die Datei noch einmal zu ziehen')
})

test('weicht der Server wegen einer Namenskollision aus, merkt sich der Dialog den Schlüssel', async () => {
  const { w, calls, daten } = await mitDaten('g1', { assign: { group: 'class_gpc_std', classAttr: 'gpc_klasse', groupRenamed: { from: 'class_gpc', to: 'class_gpc_std' } } })
  await w.find('input.suche').setValue('cables'); await ruhe()
  await w.find('.liste .pick').trigger('click')
  await knopf(w, '✓ zuweisen').trigger('click'); await ruhe()
  assert.deepEqual(daten.settings, { group: 'class_gpc_std', classAttr: 'gpc_klasse' })
  assert.ok(calls.some(c => c.method === 'PUT' && c.path === '/api/plugins/gpc/data/settings'))
})

test('ein Brick ohne Attribute wird trotzdem zugewiesen — ohne Merkmale', async () => {
  const { w, calls } = await mitDaten('p1')
  await w.find('input.suche').setValue('boxes'); await ruhe()
  await w.find('.liste .pick').trigger('click')
  assert.match(w.text(), /keine Attribute/)
  await knopf(w, '✓ zuweisen').trigger('click'); await ruhe()
  assert.deepEqual(calls.find(c => c.path === '/api/classification/assign').body.features, [])
})

test('dieselbe Datei ein zweites Mal: nichts Neues, nichts wird geschrieben', async () => {
  const { w, calls } = await mitDaten()
  const puts = () => calls.filter(c => c.method === 'PUT' && c.path === '/api/plugins/gpc/data').length
  assert.equal(puts(), 1)
  await knopf(w, '⌗ GPC …').trigger('click')
  assert.equal(w.find('.drop').exists(), true)
  await w.vm.datei(new File([probe], 'GPC.json')); await ruhe()
  assert.match(w.text(), /schon im Journal/)
  assert.equal(w.vm.vorhaben.neu.length, 0)
  assert.equal(knopf(w, 'übernehmen').attributes('disabled') !== undefined, true)
  await w.vm.uebernehmen(); await ruhe()
  assert.equal(puts(), 1, 'kein zweiter Schreibvorgang')
})

test('eine weitere Sprache schreibt nur, was sich ändert: die Bricks und das Wörterbuch tragen neue Titel, der Kopf die Sprache', async () => {
  const { w, calls } = await mitDaten()
  await knopf(w, '⌗ GPC …').trigger('click')
  const de = probe.replace('"LanguageCode": "EN"', '"LanguageCode": "DE"').replaceAll('Sample', 'Muster')
  await w.vm.datei(new File([de], 'GPC-DE.json')); await ruhe()
  assert.match(w.text(), /3 von 3 Datensätzen neu oder geändert/)
  await w.vm.uebernehmen(); await ruhe()
  const puts = calls.filter(c => c.method === 'PUT' && c.path === '/api/plugins/gpc/data')
  assert.equal(puts.length, 2)
  assert.deepEqual(puts[1].body.release.languages, ['en', 'de'])
  await knopf(w, '⌗ GPC …').trigger('click')
  await w.vm.datei(new File([de], 'GPC-DE.json')); await ruhe()
  assert.equal(w.vm.vorhaben.neu.length, 0)
})

test('als Fenster schliesst Esc den Dialog, und ✕ auch', async () => {
  server()
  const w = await dialog('p1', { modal: true })
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  assert.equal(w.emitted('close')?.length, 1)
  await w.find('button.x[title]').trigger('click')
  assert.equal(w.emitted('close')?.length, 2)
})

test('Bestand der früheren Bauart: der Dialog zählt, was umzustellen ist, und stellt auf Klassengruppen um', async () => {
  const s = server({ migrate: { groups: 2, attributes: 5, nodes: 3 } })
  const w = await dialog('p1')
  assert.match(w.text(), /5 Attribute und 3 Knoten in der früheren Bauart/)
  await knopf(w, 'auf Klassengruppen umstellen').trigger('click'); await ruhe()
  const c = s.calls.filter(x => x.path === '/api/classification/migrate')
  assert.deepEqual(c.map(x => x.body.dryRun), [true, false])
  assert.equal(w.find('.warn').exists(), false, 'danach ist nichts mehr umzustellen')
})

test('ohne Bestand der früheren Bauart steht keine Umstellung da', async () => {
  server()
  const w = await dialog('p1')
  assert.doesNotMatch(w.text(), /früheren Bauart/)
})
