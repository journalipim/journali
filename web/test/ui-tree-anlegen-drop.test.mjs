// Shift+Drop (28.09.2026): je Datenblatt ein neuer Knoten darunter — Produkt unter einer Gruppe, Variante unter einem
// Produkt —, benannt nach der Datei, mit dem Datenblatt als Asset. Ein Dokument: der Baum springt hin und öffnet die
// Auswertung; mehrere: er bleibt stehen und zählt. Ohne Shift wird wie bisher angehängt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const TreeView = (await import('../src/views/TreeView.vue')).default

function welt() {
  const rows = [
    { id: 'g1', role: 'group', label: 'Mastertree', parent: null, axes: [] },
    { id: 'p1', role: 'product', label: 'Bohrer', parent: 'g1', axes: [] },
    { id: 'p2', role: 'product', label: 'Fräser', parent: 'g1', axes: ['size'] },
    { id: 'v1', role: 'variant', label: 'Bohrer 6 mm', parent: 'p1', axes: [] },
  ]
  tree.byId = new Map(rows.map(r => [r.id, r])); tree.rows = rows
  tree.children = new Map([['', [rows[0]]], ['g1', [rows[1], rows[2]]], ['p1', [rows[3]]]])
  tree.expanded = new Set(['g1', 'p1']); tree.loaded = true; tree.load = async () => {}
  store.actor = 'u1'; store.toasts = []; store.pendingDocTables = null; store.poll = async () => {}
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], statuses: [],
    relationTypes: [{ key: 'image', label: { de: 'Bild' }, to: ['media'] }, { key: 'document', label: { de: 'Dokument' }, to: ['media'] }] }
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url); const methode = opt.method ?? 'GET'
    rufe.push({ pfad, methode, rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : opt.body })
    let antwort = {}
    if (pfad.endsWith('/api/media') && methode === 'POST') antwort = { id: 'm-' + rufe.length, name: opt.body?.get?.('file')?.name ?? 'x', existed: false }
    else if (pfad.includes('/api/relations')) antwort = { stream: 'r-1' }
    else if (pfad.endsWith('/api/batch')) antwort = { batch: 'b', results: [{ index: 0, ref: 'n', node: 'n-' + rufe.length }], error: null }
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}
const datei = (name, type) => new File([new Uint8Array([1, 2, 3])], name, { type })
function baum() {
  const router = { path: '/tree/g1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const w = mount(TreeView, { props: { id: 'g1' }, global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, NodeView: true } } })
  return { w, router }
}
async function ablegen(w, id, files, shift) {
  const zeile = w.findAll('.node').find(n => n.attributes('title') === id)
  assert.ok(zeile, `die Zeile ${id} steht nicht im Baum`)
  await zeile.trigger('drop', { dataTransfer: { files, types: ['Files'], getData: () => '' }, shiftKey: shift })
  await flushPromises()
}
const stapel = rufe => rufe.filter(r => r.pfad.endsWith('/api/batch') && r.methode === 'POST').map(r => r.rumpf.commands)

test('Shift + zwei Datenblätter auf eine Gruppe: je Datei ein Produkt, benannt nach der Datei, mit dem Datenblatt — der Baum bleibt stehen', async () => {
  const rufe = welt(); const { w, router } = baum(); await flushPromises()
  await ablegen(w, 'g1', [datei('PCI 20 MINI Q211.pdf', 'application/pdf'), datei('PCI 20 MINI Q221.pdf', 'application/pdf')], true)
  const s = stapel(rufe)
  assert.equal(s.length, 2, 'je Datei ein Stapel')
  assert.deepEqual(s[0].map(c => c.op), ['product.create', 'node.rename'])
  assert.deepEqual(s[0][0].args, { group: 'g1' }); assert.deepEqual(s[0][1].args, { node: '@n', name: 'PCI 20 MINI Q211' }, 'der Name ist die Datei ohne Endung')
  assert.equal(s[1][1].args.name, 'PCI 20 MINI Q221')
  const rel = rufe.filter(r => r.pfad.endsWith('/api/relations') && r.methode === 'POST')
  assert.equal(rel.length, 2, 'je Knoten das Datenblatt als Asset')
  assert.ok(rel.every(r => r.rumpf.type === 'document' && /^n-/.test(r.rumpf.from)), 'zugeordnet an den neuen Knoten')
  assert.match(store.toasts.at(-1)?.text ?? '', /2 Knoten angelegt/)
  assert.equal(router.path, '/tree/g1', 'bei mehreren bleibt der Baum stehen')
  assert.equal(store.pendingDocTables, null)
})

test('Shift + ein Datenblatt auf ein Produkt: eine Variante — der Baum springt sofort hin, der Dialog lädt die Datei hoch', async () => {
  const rufe = welt(); const { w, router } = baum(); await flushPromises()
  await ablegen(w, 'p1', [datei('6 mm.pdf', 'application/pdf')], true)
  const s = stapel(rufe)
  assert.equal(s.length, 1); assert.deepEqual(s[0][0], { op: 'variant.create', ref: 'n', args: { product: 'p1', axisValues: {} } })
  assert.equal(rufe.some(r => r.pfad.endsWith('/api/media') && r.methode === 'POST'), false, 'der Baum lädt nicht hoch — das tut der Dialog, mit Fortschritt')
  const id = store.pendingDocTables?.node
  assert.ok(id, 'die Auswertung öffnet sich am neuen Knoten')
  assert.match(router.path, new RegExp(`^/tree/${id}$`), 'zum neuen Knoten')
  assert.deepEqual([store.pendingDocTables.media.length, store.pendingDocTables.dateien.map(f => f.name), store.pendingDocTables.typen.map(t => t.key)], [0, ['6 mm.pdf'], ['image', 'document']])
})

test('Shift auf ein Produkt mit Achsen: keine Variante ohne Achsenwerte — nichts angelegt', async () => {
  const rufe = welt(); const { w } = baum(); await flushPromises()
  await ablegen(w, 'p2', [datei('x.pdf', 'application/pdf')], true)
  assert.equal(stapel(rufe).length, 0)
  assert.match(store.toasts.at(-1)?.text ?? '', /Achsen/)
})

test('Shift ohne Dokument dabei: nichts angelegt, nichts angehängt', async () => {
  const rufe = welt(); const { w } = baum(); await flushPromises()
  await ablegen(w, 'g1', [datei('foto.jpg', 'image/jpeg')], true)
  assert.equal(stapel(rufe).length, 0)
  assert.equal(rufe.filter(r => r.pfad.endsWith('/api/media') && r.methode === 'POST').length, 0)
  assert.match(store.toasts.at(-1)?.text ?? '', /Kein Dokument/)
})

test('Shift auf eine Variante: kein Ziel', async () => {
  const rufe = welt(); const { w } = baum(); await flushPromises()
  await ablegen(w, 'v1', [datei('x.pdf', 'application/pdf')], true)
  assert.equal(stapel(rufe).length, 0)
  assert.match(store.toasts.at(-1)?.text ?? '', /Gruppe oder ein Produkt/)
})

test('ohne Shift wird wie bisher angehängt, nicht angelegt', async () => {
  const rufe = welt(); const { w } = baum(); await flushPromises()
  await ablegen(w, 'p1', [datei('x.pdf', 'application/pdf')], false)
  assert.equal(stapel(rufe).length, 0)
  assert.equal(rufe.filter(r => r.pfad.endsWith('/api/relations') && r.methode === 'POST').length, 1)
})
