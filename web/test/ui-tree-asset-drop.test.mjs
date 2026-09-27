// Eine Datei auf eine Baumzeile: ein Bild oder PDF wird ein Asset und wird dem Knoten zugeordnet — vorher gab es
// dafür nur „Kein Importer für …“. JSON und Tabellen gehen weiter in ihren Import, und sie brauchen eine Gruppe
// oder ein Produkt; ein Asset darf auch an eine Variante.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { plugins } from '../src/plugins.js'

const TreeView = (await import('../src/views/TreeView.vue')).default

/// Ein Baum mit Gruppe, Produkt und Variante; das Modell kennt die zwei Medien-Relationstypen.
function welt() {
  const rows = [
    { id: 'g1', role: 'group', label: 'Mastertree', parent: null, axes: [] },
    { id: 'p1', role: 'product', label: 'Bohrer', parent: 'g1', axes: [] },
    { id: 'v1', role: 'variant', label: 'Bohrer 6 mm', parent: 'p1', axes: [] },
  ]
  tree.byId = new Map(rows.map(r => [r.id, r]))
  tree.rows = rows
  // visible baut die Zeilen über tree.kids, und das liest children — der Schlüssel '' ist die Wurzel
  tree.children = new Map([['', [rows[0]]], ['g1', [rows[1]]], ['p1', [rows[2]]]])
  tree.expanded = new Set(['g1', 'p1'])
  tree.loaded = true
  tree.load = async () => {}
  store.actor = 'u1'
  store.toasts = []
  store.model = {
    masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], statuses: [],
    relationTypes: [
      { key: 'image', label: { de: 'Bild' }, to: ['media'] },
      { key: 'document', label: { de: 'Dokument' }, to: ['media'] },
      { key: 'accessory', label: { de: 'Zubehör' }, to: [] },
    ],
  }
  store.pendingImport = null
}

/// Was der Server gefragt wurde, und die Antworten darauf
function server() {
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url)
    rufe.push({ pfad, methode: opt.method ?? 'GET', rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : opt.body })
    let antwort = {}
    if (pfad.endsWith('/api/media') && (opt.method ?? 'GET') === 'POST') antwort = { id: 'm-' + rufe.length, name: 'x', existed: false }
    else if (pfad.includes('/api/relations')) antwort = { stream: 'r-1' }
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}

const datei = (name, type) => new File([new Uint8Array([1, 2, 3])], name, { type })

/// Eine Datei auf der Zeile dieses Knotens ablegen
async function ablegen(w, id, files) {
  const zeile = w.findAll('.node').find(n => n.attributes('title') === id)
  assert.ok(zeile, `die Zeile ${id} steht nicht im Baum`)
  await zeile.trigger('drop', { dataTransfer: { files, types: ['Files'], getData: () => '' } })
  await flushPromises()
}

/// Router-Ersatz: merkt sich, wohin die Ansicht will (useRouter holt ihn über routerKey)
function baum() {
  const router = { path: '/tree/g1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const w = mount(TreeView, { props: { id: 'g1' }, global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, NodeView: true } } })
  return { w, router }
}

test('ein Bild auf einem Produkt wird angelegt und als Bild zugeordnet', async () => {
  welt(); const rufe = server()
  const { w } = baum(); await flushPromises()
  await ablegen(w, 'p1', [datei('vorne.jpg', 'image/jpeg')])

  const hoch = rufe.filter(r => r.pfad.endsWith('/api/media') && r.methode === 'POST')
  assert.equal(hoch.length, 1, 'die Datei wurde nicht hochgeladen')
  const rel = rufe.find(r => r.pfad.endsWith('/api/relations') && r.methode === 'POST')
  assert.ok(rel, 'es wurde keine Zuordnung angelegt')
  assert.deepEqual({ type: rel.rumpf.type, from: rel.rumpf.from }, { type: 'image', from: 'p1' })
  assert.match(store.toasts.at(-1)?.text ?? '', /1 angelegt/)
})

test('ein PDF wird ein Dokument, nicht ein Bild', async () => {
  welt(); const rufe = server()
  const { w } = baum(); await flushPromises()
  await ablegen(w, 'p1', [datei('datenblatt.pdf', 'application/pdf')])

  const rel = rufe.find(r => r.pfad.endsWith('/api/relations') && r.methode === 'POST')
  assert.equal(rel.rumpf.type, 'document')
})

test('mehrere Dateien auf einmal — jede wird angelegt und zugeordnet', async () => {
  welt(); const rufe = server()
  const { w } = baum(); await flushPromises()
  await ablegen(w, 'p1', [datei('a.jpg', 'image/jpeg'), datei('b.png', 'image/png'), datei('c.pdf', 'application/pdf')])

  assert.equal(rufe.filter(r => r.pfad.endsWith('/api/media') && r.methode === 'POST').length, 3)
  assert.equal(rufe.filter(r => r.pfad.endsWith('/api/relations') && r.methode === 'POST').length, 3)
  assert.match(store.toasts.at(-1)?.text ?? '', /3 angelegt/)
})

/// Eine Variante ist ein gültiges Ziel für ein Asset — für einen Tabellen-Import nicht.
test('ein Asset darf an eine Variante', async () => {
  welt(); const rufe = server()
  const { w } = baum(); await flushPromises()
  await ablegen(w, 'v1', [datei('detail.jpg', 'image/jpeg')])

  const rel = rufe.find(r => r.pfad.endsWith('/api/relations') && r.methode === 'POST')
  assert.ok(rel, 'an einer Variante wurde nichts zugeordnet')
  assert.equal(rel.rumpf.from, 'v1')
})

test('eine Tabelle an einer Variante wird abgewiesen, nicht als Asset angelegt', async () => {
  welt(); const rufe = server()
  plugins.enabled = k => k === 'table'
  const { w } = baum(); await flushPromises()
  await ablegen(w, 'v1', [datei('daten.csv', 'text/csv')])

  assert.equal(rufe.filter(r => r.pfad.endsWith('/api/media')).length, 0, 'eine CSV wurde als Asset angelegt')
  assert.match(store.toasts.at(-1)?.text ?? '', /Gruppe oder ein Produkt/)
})

test('eine Tabelle auf einem Produkt geht weiter in den Tabellen-Import', async () => {
  welt(); server()
  plugins.enabled = k => k === 'table'
  const { w, router } = baum(); await flushPromises()
  await ablegen(w, 'p1', [datei('daten.csv', 'text/csv')])

  assert.equal(store.pendingImport?.parent, 'p1')
  assert.equal(store.pendingImport?.analyse, true)
  assert.equal(router.path, '/p/table/import')
})

test('ohne Namen wird nichts angelegt', async () => {
  welt(); const rufe = server()
  store.actor = ''
  const { w } = baum(); await flushPromises()
  await ablegen(w, 'p1', [datei('vorne.jpg', 'image/jpeg')])

  assert.equal(rufe.filter(r => r.pfad.endsWith('/api/media')).length, 0)
  assert.match(store.toasts.at(-1)?.text ?? '', /Name fehlt/)
})

test('ohne Relationstyp zu Medien im Modell wird nichts angelegt', async () => {
  welt(); const rufe = server()
  store.model.relationTypes = [{ key: 'accessory', label: { de: 'Zubehör' }, to: [] }]
  const { w } = baum(); await flushPromises()
  await ablegen(w, 'p1', [datei('vorne.jpg', 'image/jpeg')])

  assert.equal(rufe.filter(r => r.pfad.endsWith('/api/media')).length, 0)
  assert.match(store.toasts.at(-1)?.text ?? '', /Kein Relationstyp/)
})
