// Systemobjekte (30.09.2026): die Gruppe einer Klassifikation und ihr Klassenattribut braucht das Plugin zum Arbeiten. Solange es an ist, lassen sie
// sich nicht zurückziehen; ist es aus, geht es nur als Ganzes, nach einem Warndialog, der sagt, was in allen Bäumen weggeht — und nur für den, der
// Plugins verwalten darf (wer ausschalten darf, räumt auch weg).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { dialog } from '../src/dialog.js'
import { menu } from '../src/menu.js'

const ModelView = (await import('../src/views/ModelView.vue')).default

const MODELL = () => ({
  masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], lists: [], views: [], units: [], relationTypes: [], types: ['text', 'decimal'],
  groups: [
    { key: 'class_etim', label: { de: 'ETIM' }, attributes: ['etim_class'] },
    { key: 'class_etim_ec1', label: { de: 'EC1 Lampe' }, attributes: ['ef1'] },
    { key: 'master', label: { de: 'Stammdaten' }, attributes: ['name'] },
    { key: 'dpp', label: { de: 'DPP (ESPR)' }, attributes: ['dpp_batch', 'dpp_gtin'] },
  ],
  attributes: [
    { key: 'etim_class', label: { de: 'ETIM-Klasse' }, type: 'enum', list: 'etim_class', group: 'class_etim', groups: ['class_etim'] },
    { key: 'ef1', label: { de: 'Breite' }, type: 'decimal', group: 'class_etim_ec1', groups: ['class_etim_ec1'] },
    { key: 'name', label: { de: 'Name' }, type: 'text', group: 'master', groups: ['master'] },
    { key: 'dpp_batch', label: { de: 'Charge / Los' }, type: 'text', group: 'dpp', groups: ['dpp'] },
    { key: 'dpp_gtin', label: { de: 'GTIN' }, type: 'text', group: 'dpp', groups: ['dpp'] },
  ],
})

function welt(query, rechte, { an = false, dpp = false } = {}) {
  store.actor = 'u1'; store.toasts = []; store.model = MODELL(); store.poll = async () => {}
  store.auth = { enabled: true, user: 'u1', role: 'admin', rights: rechte }
  tree.rows = []; tree.byId = new Map(); tree.loaded = true; tree.load = async () => {}
  const calls = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url).replace(/^https?:\/\/[^/]+/, '')
    const body = opt.body ? JSON.parse(opt.body) : null
    calls.push({ pfad, method: opt.method ?? 'GET', body })
    const antwort = /\/api\/model$/.test(pfad) ? store.model
      : pfad === '/api/classification/systems' ? [{ plugin: 'etim', enabled: an, group: 'class_etim', classAttr: 'etim_class', classGroups: 1 }]
      : pfad === '/api/classification/protected' ? (dpp ? [{ plugin: 'dpp', groups: ['dpp'], attributes: ['dpp_batch', 'dpp_gtin'] }] : [])
      : pfad === '/api/classification/retire' ? { groups: 2, attributes: 2, nodes: 3, values: 7 } : []
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  const router = { path: '/model', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/model', query, params: {}, name: 'model', hash: '', fullPath: '/model', matched: [], meta: {} }
  const w = mount(ModelView, { global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, Splitter: true, AttrBulk: true, EditGrid: true } } })
  return { w, calls }
}
const knopfGruppe = w => w.findAll('.section').find(s => /⊞ Attribute/.test(s.find('h2')?.text() ?? '')).find('h2 button.x')
const toasts = () => store.toasts.map(x => x.text ?? x.message ?? String(x)).join(' ')

async function mitDialog(antwort, f) {
  const vorher = dialog.confirm, gefragt = []
  dialog.confirm = async o => { gefragt.push(o); return antwort }
  try { await f(gefragt) } finally { dialog.confirm = vorher }
}

test('Plugin aus: ✕ an der Systemgruppe zählt zuerst und fragt mit den Zahlen; erst die Antwort nimmt die ganze Klassifikation zurück', async () => {
  const { w, calls } = welt({ section: 'groups', key: 'class_etim' }, ['read', 'model', 'plugins'])
  await flushPromises()
  await mitDialog(true, async gefragt => {
    await knopfGruppe(w).trigger('click'); await flushPromises()
    assert.equal(gefragt.length, 1)
    assert.match(gefragt[0].title, /Klassifikation class_etim zurücknehmen/)
    assert.match(gefragt[0].warn, /3 Knoten mit Klasse, 7 Werte, 2 Gruppen und 2 Attribute/)
    assert.equal(gefragt[0].danger, true)
    const retire = calls.filter(c => c.pfad === '/api/classification/retire')
    assert.deepEqual(retire.map(c => c.body), [{ group: 'class_etim', dryRun: true }, { group: 'class_etim', dryRun: false }])
    assert.equal(calls.filter(c => c.method === 'DELETE').length, 0, 'es wird nichts einzeln gelöscht')
  })
})

test('Plugin an: die Ansicht sagt, dass das Plugin die Objekte braucht, und fragt gar nicht erst', async () => {
  const { w, calls } = welt({ section: 'groups', key: 'class_etim' }, ['read', 'model', 'plugins'], { an: true })
  await flushPromises()
  await mitDialog(true, async gefragt => {
    await knopfGruppe(w).trigger('click'); await flushPromises()
    assert.equal(gefragt.length, 0)
    assert.equal(calls.some(c => c.pfad === '/api/classification/retire'), false)
    assert.match(toasts(), /class_etim wird vom eingeschalteten Plugin etim gebraucht/)
  })
})

test('lehnt der Anwender ab, bleibt es beim Zählen', async () => {
  const { w, calls } = welt({ section: 'groups', key: 'class_etim' }, ['read', 'model', 'plugins'])
  await flushPromises()
  await mitDialog(false, async () => {
    await knopfGruppe(w).trigger('click'); await flushPromises()
    assert.deepEqual(calls.filter(c => c.pfad === '/api/classification/retire').map(c => c.body.dryRun), [true])
    assert.equal(calls.filter(c => c.method === 'DELETE').length, 0)
  })
})

test('ohne das Recht auf Plugins fragt die Ansicht nicht und sagt, was verlangt ist', async () => {
  const { w, calls } = welt({ section: 'groups', key: 'class_etim' }, ['read', 'model'])
  await flushPromises()
  await mitDialog(true, async gefragt => {
    await knopfGruppe(w).trigger('click'); await flushPromises()
    assert.equal(gefragt.length, 0)
    assert.equal(calls.some(c => c.pfad === '/api/classification/retire'), false)
    assert.match(toasts(), /verlangt das Recht, Plugins zu verwalten/)
  })
})

test('eine gewöhnliche Gruppe geht den bisherigen Weg: Attribute zurückziehen, dann die Gruppe', async () => {
  const { w, calls } = welt({ section: 'groups', key: 'master' }, ['read', 'model'])
  await flushPromises()
  await mitDialog(true, async gefragt => {
    await knopfGruppe(w).trigger('click'); await flushPromises()
    assert.match(gefragt[0].title, /Stammdaten mit 1 Attributen/)
    assert.deepEqual(calls.filter(c => c.method === 'DELETE').map(c => c.pfad), ['/api/model/attributes/name', '/api/model/groups/master'])
    assert.equal(calls.some(c => c.pfad === '/api/classification/retire'), false)
  })
})

test('DPP an: die Gruppe lässt sich nicht zurückziehen — gesagt wird es vor der Rückfrage, und es wird nichts gelöscht', async () => {
  const { w, calls } = welt({ section: 'groups', key: 'dpp' }, ['read', 'model'], { dpp: true })
  await flushPromises()
  await mitDialog(true, async gefragt => {
    await knopfGruppe(w).trigger('click'); await flushPromises()
    assert.equal(gefragt.length, 0, 'keine Rückfrage, die danach ins Leere läuft')
    assert.equal(calls.filter(c => c.method === 'DELETE').length, 0)
    assert.match(toasts(), /dpp wird vom eingeschalteten Plugin dpp gebraucht/)
  })
})

test('DPP an: ein einzelnes Attribut der Gruppe wird genauso vorab abgewiesen (Kontextmenü der Zeile)', async () => {
  const { w, calls } = welt({ section: 'attributes', key: 'dpp_batch' }, ['read', 'model'], { dpp: true })
  await flushPromises()
  await mitDialog(true, async gefragt => {
    const zeile = w.findAll('.list .li').find(li => li.attributes('title') === 'dpp_batch')
    assert.ok(zeile, 'die Zeile des Attributs steht in der Liste')
    await zeile.trigger('contextmenu'); await flushPromises()
    const eintrag = menu.items.find(x => x.key === 'Delete')
    assert.ok(eintrag && !eintrag.disabled, 'der Menüpunkt zum Zurückziehen ist da')
    await eintrag.action(); await flushPromises()
    assert.equal(gefragt.length, 0)
    assert.equal(calls.filter(c => c.method === 'DELETE').length, 0)
    assert.match(toasts(), /dpp_batch wird vom eingeschalteten Plugin dpp gebraucht/)
  })
})

test('DPP aus: dieselbe Gruppe geht den gewöhnlichen Weg mit Rückfrage', async () => {
  const { w, calls } = welt({ section: 'groups', key: 'dpp' }, ['read', 'model'])
  await flushPromises()
  await mitDialog(true, async gefragt => {
    await knopfGruppe(w).trigger('click'); await flushPromises()
    assert.equal(gefragt.length, 1)
    assert.deepEqual(calls.filter(c => c.method === 'DELETE').map(c => c.pfad), ['/api/model/attributes/dpp_batch', '/api/model/attributes/dpp_gtin', '/api/model/groups/dpp'])
  })
})
