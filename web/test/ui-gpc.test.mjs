// ⌗ GPC: Datei einlesen, übernehmen, Brick suchen und einem Knoten zuweisen. Der Server ist ein Stellvertreter,
// der die Plugin-Daten hält — geprüft wird, was die Ansicht ihm schickt.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const probe = fs.readFileSync(new URL('../../plugins/gpc/sample.json', import.meta.url), 'utf8')
const BAUM = [{ id: 'g1', parent: null, label: 'Leuchten', role: 'group' }, { id: 'p1', parent: 'g1', label: 'Stehlampe', role: 'product' }]

function server({ assign = {}, node = { values: [], ancestors: [] } } = {}) {
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
    else if (path === '/api/classification/assign') out = { group: 'gpc', classAttr: 'gpc_class', attributes: 2, groupAttached: true, readiness: { ready: true, groupExists: true, groupOn: true, missing: [] }, ...assign }
    else if (path.startsWith('/api/nodes/')) out = node
    return { ok: true, status: 200, text: async () => JSON.stringify(out) }
  }
  return { calls, daten }
}
const ruhe = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }

async function ansicht(query = {}) {
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }, { code: 'en' }], views: [], attributes: [], groups: [], lists: [] }
  tree.rows = BAUM; tree.byId = new Map(BAUM.map(r => [r.id, r])); tree.loaded = true; tree.load = async () => {}
  store.poll = async () => {}
  const { default: View } = await import('../../plugins/gpc/src/View.vue')
  const w = mount(View, { global: { provide: { [routerKey]: { push() {} }, [routeLocationKey]: { path: '/p/gpc/gpc', query } }, stubs: { TreePicker: true } } })
  await ruhe()
  return w
}

test('ohne Daten: nichts übernommen, die Suche ist gesperrt', async () => {
  server()
  const w = await ansicht()
  assert.match(w.text(), /nichts übernommen/)
  assert.equal(w.find('input[type=text]').attributes('disabled') !== undefined, true)
})

test('eine gelesene Datei wird übernommen: Segment, Wörterbuch und Kopf gehen in einem Aufruf ans Journal', async () => {
  const { calls } = server()
  const w = await ansicht()
  await w.vm.datei(new File([probe], 'GPC.json'))
  await ruhe()
  assert.match(w.text(), /2026-01 · EN · 3 Bricks/)
  await w.findAll('button').find(b => b.text() === 'übernehmen').trigger('click'); await ruhe()
  const put = calls.find(c => c.method === 'PUT' && c.path === '/api/plugins/gpc/data')
  assert.deepEqual(Object.keys(put.body).sort(), ['bricks:99000000', 'dict', 'release'])
  assert.match(w.text(), /2026-01 · 2026-01-01 · 3 Bricks/, 'danach steht der Stand da')
  assert.equal(w.vm.gelesen, null)
})

test('eine Datei, die keine GPC-Datei ist, wird gemeldet und übernimmt nichts', async () => {
  const { calls } = server()
  const w = await ansicht()
  await w.vm.datei(new File(['{"a":1}'], 'x.json')); await ruhe()
  assert.match(w.text(), /keine GPC-Datei/)
  assert.equal(calls.some(c => c.method === 'PUT'), false)
})

async function mitDaten(query = {}, opts = {}) {
  const s = server(opts)
  const w = await ansicht(query)
  await w.vm.datei(new File([probe], 'GPC.json')); await ruhe()
  await w.vm.uebernehmen(); await ruhe()
  return { w, ...s }
}

test('suchen, einen Brick wählen, einen Knoten wählen, zuweisen: der Server bekommt Klasse, System und Merkmale', async () => {
  const { w, calls } = await mitDaten()
  await w.find('input[type=text]').setValue('lamps'); await ruhe()
  const zeilen = w.findAll('.pick')
  assert.equal(zeilen.length, 1)
  assert.match(zeilen[0].text(), /19900001 Sample Lamps · Sample Segment › Sample Electrical › Sample Lighting/)
  await zeilen[0].trigger('click')
  assert.match(w.text(), /Sample Colour · 3/); assert.match(w.text(), /Sample Size · 2/)
  assert.equal(w.findAll('button').find(b => b.text() === '✓ zuweisen').attributes('disabled') !== undefined, true, 'ohne Knoten nicht')
  w.vm.zielWahl('p1'); await ruhe()
  await w.findAll('button').find(b => b.text() === '✓ zuweisen').trigger('click'); await ruhe()
  const a = calls.find(c => c.path === '/api/classification/assign')
  assert.equal(a.body.node, 'p1'); assert.equal(a.body.class, '19900001')
  assert.deepEqual([a.body.system.group, a.body.system.classAttr, a.body.system.ownPattern], ['gpc', 'gpc_class', '^gpc\\d+$'])
  assert.deepEqual(a.body.features.map(f => [f.key, f.type, f.values.length, f.classes]), [['gpc29900001', 'enum', 3, ['19900001', '19900002']], ['gpc29900002', 'enum', 2, ['19900001']]])
  assert.deepEqual(a.body.classes.map(c => c.code).sort(), ['19900001', '19900002', '19900003'], 'die Liste der Klassen gibt es noch nicht: alle gehen mit')
  assert.deepEqual(a.body.classes.find(c => c.code === '19900002').name, { en: 'Sample Cables' })
})

test('kommt der Knoten aus dem Band, steht er schon da — mit der Klasse, die dort gilt, eigen oder geerbt', async () => {
  const eigen = await mitDaten({ node: 'p1' }, { node: { values: [{ attribute: 'gpc_class', value: '19900001' }], ancestors: [] } })
  assert.equal(eigen.w.vm.ziel, 'p1')
  assert.match(eigen.w.text(), /Stehlampe/)
  assert.match(eigen.w.text(), /19900001 Sample Lamps/)
  assert.doesNotMatch(eigen.w.text(), /Sample Lamps ↑/)
  const geerbt = await mitDaten({ node: 'p1' }, { node: { values: [], ancestors: [{ label: 'Leuchten', values: [{ attribute: 'gpc_class', value: '19900002' }] }] } })
  assert.match(geerbt.w.text(), /19900002 Sample Cables ↑/)
})

test('weicht der Server wegen einer Namenskollision aus, merkt sich die Ansicht den Schlüssel', async () => {
  const { w, calls, daten } = await mitDaten({}, { assign: { group: 'gpc_std', classAttr: 'gpc_klasse', groupRenamed: { from: 'gpc', to: 'gpc_std' } } })
  await w.find('input[type=text]').setValue('cables'); await ruhe()
  await w.find('.pick').trigger('click')
  w.vm.zielWahl('g1'); await ruhe()
  await w.findAll('button').find(b => b.text() === '✓ zuweisen').trigger('click'); await ruhe()
  assert.deepEqual(daten.settings, { group: 'gpc_std', classAttr: 'gpc_klasse' })
  assert.ok(calls.some(c => c.method === 'PUT' && c.path === '/api/plugins/gpc/data/settings'))
})

test('ein Brick ohne Attribute wird trotzdem zugewiesen — ohne Merkmale', async () => {
  const { w, calls } = await mitDaten()
  await w.find('input[type=text]').setValue('boxes'); await ruhe()
  await w.find('.pick').trigger('click')
  assert.match(w.text(), /keine Attribute/)
  w.vm.zielWahl('p1'); await ruhe()
  await w.findAll('button').find(b => b.text() === '✓ zuweisen').trigger('click'); await ruhe()
  assert.deepEqual(calls.find(c => c.path === '/api/classification/assign').body.features, [])
})

test('beim Einschalten entsteht nur die Gruppe und hängt an der Wurzel; weicht der Server aus, wird der Schlüssel gemerkt', async () => {
  const { default: plugin } = await import('../../plugins/gpc/src/entry.js')
  const calls = []
  const wurzel = { id: 'g1', parent: null, role: 'group', label: 'Leuchten', groups: '' }
  const ctx = {
    api: {
      get: async () => { throw new Error('404') },
      post: async (p, b, m) => { calls.push({ p, b, m }); return p === '/api/classification/ensure' ? { group: 'gpc_std', classAttr: 'gpc_class', groupRenamed: { from: 'gpc', to: 'gpc_std' } } : {} },
    },
    store: { poll: async () => {} }, tree: { loaded: true, rows: [wurzel], load: async () => {} },
  }
  await plugin.install(ctx)
  const ensure = calls.find(c => c.p === '/api/classification/ensure')
  assert.equal(ensure.b.groupOnly, true); assert.equal(ensure.b.system.group, 'gpc'); assert.equal(ensure.b.features, undefined)
  assert.deepEqual(calls.find(c => c.p === '/api/plugins/gpc/data/settings').b, { group: 'gpc_std' })
  assert.deepEqual(calls.find(c => c.p === '/api/nodes/g1/groups').b, { groups: ['gpc_std'] })
})

test('der Menüpunkt am Knoten führt in die Ansicht mit diesem Knoten', async () => {
  const { default: plugin } = await import('../../plugins/gpc/src/entry.js')
  let ziel = null
  plugin.nodeActions[0].run('p 1', { go: p => { ziel = p } })
  assert.equal(ziel, '/p/gpc/gpc?node=p%201')
  assert.deepEqual(plugin.nodeActions[0].roles, ['group', 'product'])
  assert.equal(plugin.views[0].path, 'gpc'); assert.equal(plugin.views[0].topic, 'classification')
})

test('dieselbe Datei ein zweites Mal: nichts Neues, nichts wird geschrieben', async () => {
  const { w, calls } = await mitDaten()
  const puts = () => calls.filter(c => c.method === 'PUT' && c.path === '/api/plugins/gpc/data').length
  assert.equal(puts(), 1)
  assert.equal(w.find('.drop').exists(), false, 'mit übernommenen Daten lädt die Ansicht nicht zum Ablegen ein')
  await w.findAll('button').find(b => b.text().startsWith('Weitere Fassung')).trigger('click')
  assert.equal(w.find('.drop').exists(), true)
  await w.vm.datei(new File([probe], 'GPC.json')); await ruhe()
  assert.match(w.text(), /schon im Journal/)
  assert.equal(w.vm.vorhaben.neu.length, 0)
  const knopf = w.findAll('button').find(b => b.text() === 'übernehmen')
  assert.equal(knopf.attributes('disabled') !== undefined, true)
  await w.vm.uebernehmen(); await ruhe()
  assert.equal(puts(), 1, 'kein zweiter Schreibvorgang')
})

test('eine weitere Sprache schreibt nur, was sich ändert: die Bricks und das Wörterbuch tragen neue Titel, der Kopf die Sprache', async () => {
  const { w, calls } = await mitDaten()
  await w.findAll('button').find(b => b.text().startsWith('Weitere Fassung')).trigger('click')
  await w.vm.datei(new File([probe.replace('"LanguageCode": "EN"', '"LanguageCode": "DE"').replaceAll('Sample', 'Muster')], 'GPC-DE.json')); await ruhe()
  assert.match(w.text(), /3 von 3 Datensätzen neu oder geändert/)
  await w.vm.uebernehmen(); await ruhe()
  const puts = calls.filter(c => c.method === 'PUT' && c.path === '/api/plugins/gpc/data')
  assert.equal(puts.length, 2)
  assert.deepEqual(puts[1].body.release.languages, ['en', 'de'])
  // und danach ist auch diese Datei nichts Neues mehr
  await w.findAll('button').find(b => b.text().startsWith('Weitere Fassung')).trigger('click')
  await w.vm.datei(new File([probe.replace('"LanguageCode": "EN"', '"LanguageCode": "DE"').replaceAll('Sample', 'Muster')], 'GPC-DE.json')); await ruhe()
  assert.equal(w.vm.vorhaben.neu.length, 0)
})
