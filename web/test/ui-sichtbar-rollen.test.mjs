// Sichtbar für Rollen (27.09.2026): am Ordner der Bibliothek (🔒) und am Knoten im Baum (Kontextmenü). Der Dialog fragt
// die Rollen mit Komma, leer heisst für alle; gespeichert wird als Liste. Ein eingeschränkter Ordner trägt das Schloss.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { dialog } from '../src/dialog.js'
import { menu } from '../src/menu.js'

const MediaView = (await import('../src/views/MediaView.vue')).default
const TreeView = (await import('../src/views/TreeView.vue')).default

function server(antworten) {
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url); const methode = opt.method ?? 'GET'
    rufe.push({ pfad, methode, rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : null })
    let antwort = {}
    for (const [re, a] of antworten) if (re.test(pfad)) { antwort = typeof a === 'function' ? a(pfad, methode) : a; break }
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}
const ROLLEN = [{ key: 'admin' }, { key: 'editor' }, { key: 'viewer' }]

test('Bibliothek: ein eingeschränkter Ordner trägt das Schloss; 🔒 fragt die Rollen und setzt sie', async () => {
  store.actor = 'u1'; store.toasts = []
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], statuses: [], lists: [], relationTypes: [] }
  const rufe = server([
    [/\/api\/auth\/roles/, ROLLEN],
    [/\/api\/media\/folders\/mf-1\/roles/, {}],
    [/\/api\/media\/folders/, { total: 0, unfiled: 0, folders: [{ id: 'mf-1', name: 'Geheim', parent: null, media: 0, roles: ['editor'] }, { id: 'mf-2', name: 'Offen', parent: null, media: 0, roles: [] }] }],
    [/\/facets/, { art: [], herkunft: [], stichworte: [], zustaende: [], ohneStichwort: 0, abgelaufen: 0, total: 0 }],
    [/\/api\/media\?/, []],
  ])
  const router = { path: '/media', push(p) { this.path = p }, replace(p) { this.path = p } }
  const w = mount(MediaView, { global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, TreePicker: true } } })
  await flushPromises()
  const zeilen = w.findAll('.ftree .pick').filter(p => p.find('.fname').exists())
  const geheim = zeilen.find(p => p.text().includes('Geheim')), offen = zeilen.find(p => p.text().includes('Offen'))
  assert.ok(geheim.find('.lock').exists(), 'der eingeschränkte Ordner trägt das Schloss')
  assert.match(geheim.find('.lock').attributes('title'), /editor/)
  assert.equal(offen.find('.lock').exists(), false)

  let gefragt = null
  dialog.prompt = async opt => { gefragt = opt; return 'editor, viewer' }
  await geheim.findAll('button').find(b => b.text() === '🔒').trigger('click'); await flushPromises()
  assert.equal(gefragt.value, 'editor', 'die heutigen Rollen stehen im Feld')
  assert.match(gefragt.text, /admin, editor, viewer/, 'die vorhandenen Rollen stehen dabei')
  const put = rufe.find(r => r.methode === 'PUT' && /\/api\/media\/folders\/mf-1\/roles$/.test(r.pfad))
  assert.deepEqual(put.rumpf, { roles: ['editor', 'viewer'] })
  assert.match(store.toasts.at(-1)?.text ?? '', /sichtbar für editor, viewer/)

  // leer = für alle
  dialog.prompt = async () => ''
  await geheim.findAll('button').find(b => b.text() === '🔒').trigger('click'); await flushPromises()
  assert.deepEqual(rufe.filter(r => r.methode === 'PUT').at(-1).rumpf, { roles: [] })
  // abgebrochen: nichts geschrieben
  const vorher = rufe.filter(r => r.methode === 'PUT').length
  dialog.prompt = async () => null
  await geheim.findAll('button').find(b => b.text() === '🔒').trigger('click'); await flushPromises()
  assert.equal(rufe.filter(r => r.methode === 'PUT').length, vorher)
})

test('Baum: „Sichtbar für Rollen …“ im Kontextmenü setzt die Rollen am Knoten', async () => {
  const rows = [{ id: 'g1', role: 'group', label: 'Mastertree', parent: null, axes: [], visibleTo: null }, { id: 'p1', role: 'product', label: 'Bohrer', parent: 'g1', axes: [], visibleTo: ['editor'] }]
  tree.byId = new Map(rows.map(r => [r.id, r])); tree.rows = rows
  tree.children = new Map([['', [rows[0]]], ['g1', [rows[1]]]]); tree.expanded = new Set(['g1']); tree.loaded = true; tree.load = async () => {}
  store.actor = 'u1'; store.toasts = []
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], statuses: [], relationTypes: [] }
  const rufe = server([[/\/api\/auth\/roles/, ROLLEN], [/\/api\/workflows/, []], [/\/api\/nodes\/p1\/roles/, {}]])
  const router = { path: '/tree/g1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const w = mount(TreeView, { props: { id: 'g1' }, global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, NodeView: true } } })
  await flushPromises()
  const zeile = w.findAll('.node').find(n => n.attributes('title') === 'p1')
  await zeile.trigger('contextmenu'); await flushPromises()
  const eintrag = menu.items.find(i => i.label && /Sichtbar für Rollen/.test(i.label))
  assert.ok(eintrag, 'der Eintrag steht im Menü'); assert.equal(eintrag.hint, 'editor', 'der Hinweis nennt die heutigen Rollen')
  let gefragt = null
  dialog.prompt = async opt => { gefragt = opt; return 'viewer' }
  await eintrag.action(); await flushPromises()
  assert.equal(gefragt.value, 'editor')
  const put = rufe.find(r => r.methode === 'PUT' && /\/api\/nodes\/p1\/roles$/.test(r.pfad))
  assert.deepEqual(put.rumpf, { roles: ['viewer'] })
})
