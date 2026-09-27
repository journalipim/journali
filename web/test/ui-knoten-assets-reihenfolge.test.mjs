// ▩ Assets am Knoten: die Reihenfolge durch Ziehen, statt Zahlen zu tippen.
// Die Reihenfolge stand schon als Wert „position“ an der Zuordnung und die Kacheln sortierten danach — nur setzen
// liess sie sich allein im Zahlenfeld. Wer drei Bilder umstellt, tippt sonst drei Zahlen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const NodeView = (await import('../src/views/NodeView.vue')).default

/// Eine Zuordnung eines Mediums an den Knoten, mit ihrer Stelle in der Reihenfolge
const rel = (id, name, position) => ({
  id, type: 'image', from: 'p1', to: id, dir: 'out',
  other: { id: 'm-' + id, role: 'media', label: name, missing: false, mime: 'image/jpeg', isImage: true, bytes: 1, hasThumb: true },
  values: position === null ? [] : [{ attribute: 'position', locale: null, channel: null, value: String(position), values: null }],
  external: {}, entries: 1, lastNumber: Number(id.slice(1)), lastAt: '2026-09-27T08:00:00Z', lastActor: 'u1',
})

const RELS = [rel('r1', 'vorne.jpg', 1), rel('r2', 'mitte.jpg', 2), rel('r3', 'hinten.jpg', 3)]

/// Das Modell steht auch hinter /api/model — die Ansicht frischt es auf, und dann muss dasselbe zurückkommen.
const MODELL = {
    masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], groups: [], lists: [], views: [], families: [],
    attributes: [
      { key: 'position', label: { de: 'Reihenfolge' }, type: 'integer', group: 'relation_media' },
      { key: 'inherit', label: { de: 'an Subitems vererben' }, type: 'boolean', group: 'relation_media' },
      { key: 'stop', label: { de: 'unterbinden' }, type: 'boolean', group: 'relation_media' },
    ],
  relationTypes: [{ key: 'image', label: { de: 'Bild' }, to: ['media'], group: 'relation_media' }],
}

function welt() {
  store.actor = 'u1'
  store.toasts = []
  store.model = MODELL
  tree.byId = new Map([['p1', { id: 'p1', role: 'product', label: 'Bohrer', parent: null, axes: [] }]])
  tree.rows = [tree.byId.get('p1')]
  tree.children = new Map([['', tree.rows]])
  tree.loaded = true
  tree.load = async () => {}

  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url)
    rufe.push({ pfad, methode: opt.method ?? 'GET', rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : null })
    const antwort = /\/relations/.test(pfad) ? { out: RELS, in: [], inherited: [] }
      : /\/api\/model/.test(pfad) ? MODELL
      : /\/api\/plugins/.test(pfad) ? []
      : /\/nodes\/p1/.test(pfad) ? { id: 'p1', role: 'product', label: 'Bohrer', values: [], status: 'draft', children: 0, axes: [], groups: [] }
      : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}

async function knoten() {
  const rufe = welt()
  const router = { path: '/tree/p1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  const w = mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true, PluginBands: true, VersionsPanel: true, WorkflowLocales: true } } })
  await flushPromises()
  return { w, rufe }
}

const kacheln = w => w.findAll('.tiles .tile').filter(t => !t.classes('inherited'))
const namen = w => kacheln(w).map(t => (t.attributes('title') ?? '').split(' · ')[0])
const geschrieben = rufe => rufe.filter(r => /\/api\/relations\/.*\/attributes/.test(r.pfad)).map(r => [r.pfad.split('/')[3], r.rumpf.attribute, r.rumpf.value])

test('die Kacheln stehen in der Reihenfolge, die an der Zuordnung steht', async () => {
  const { w } = await knoten()
  assert.deepEqual(namen(w), ['vorne.jpg', 'mitte.jpg', 'hinten.jpg'])
})

test('die erste Kachel ist als erste gekennzeichnet', async () => {
  const { w } = await knoten()
  assert.equal(kacheln(w)[0].classes('first'), true)
  assert.equal(kacheln(w)[1].classes('first'), false)
  assert.match(kacheln(w)[0].find('.pos1').attributes('title') ?? '', /Hauptbild/)
})

test('die letzte nach vorn ziehen schreibt die neuen Nummern — und nur die geänderten', async () => {
  const { w, rufe } = await knoten()
  const ks = kacheln(w)
  await ks[2].trigger('dragstart', { dataTransfer: { effectAllowed: '', setData() {} } })
  await ks[0].trigger('dragover', { dataTransfer: { dropEffect: '' } })
  await ks[0].trigger('drop')
  await flushPromises()

  // neu: hinten, vorne, mitte — hinten bekommt 1, vorne 2, mitte 3
  assert.deepEqual(geschrieben(rufe), [['r3', 'position', '1'], ['r1', 'position', '2'], ['r2', 'position', '3']])
})

test('auf sich selbst ablegen schreibt nichts', async () => {
  const { w, rufe } = await knoten()
  const ks = kacheln(w)
  await ks[1].trigger('dragstart', { dataTransfer: { effectAllowed: '', setData() {} } })
  await ks[1].trigger('drop')
  await flushPromises()

  assert.deepEqual(geschrieben(rufe), [])
})

test('das Ziel zeigt an, dass dort abgelegt wird', async () => {
  const { w } = await knoten()
  const ks = kacheln(w)
  await ks[0].trigger('dragstart', { dataTransfer: { effectAllowed: '', setData() {} } })
  await ks[2].trigger('dragover', { dataTransfer: { dropEffect: '' } })
  await flushPromises()

  assert.equal(kacheln(w)[2].classes('drop'), true)
  assert.equal(kacheln(w)[0].classes('dragging'), true)
})
