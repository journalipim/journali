// Lesezeichen (01.10.2026): im Kontextmenü eines Knotens setzen und entfernen; in der Kopfleiste neben der Person öffnen oder entfernen. Sie hängen an keinem Plugin
// (auch bei ausgeschalteten Aufgaben bleiben sie erreichbar) und gehören der Person: mit Anmeldung gehen sie als Einstellung (bookmarks) an den Benutzer,
// ohne Anmeldung bleiben sie im Browser.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store, MAX_BOOKMARKS } from '../src/store.js'
import { tree } from '../src/tree.js'
import { menu } from '../src/menu.js'
import { lesezeichenMenue } from '../src/lesezeichen.js'

const TreeView = (await import('../src/views/TreeView.vue')).default

const ROWS = [{ id: 'g1', role: 'group', label: 'Mastertree', parent: null, axes: [] }, { id: 'p1', role: 'product', label: 'Bohrer', parent: 'g1', axes: [] }, { id: 'p2', role: 'product', label: 'Fräser', parent: 'g1', axes: [] }]
function welt() {
  tree.byId = new Map(ROWS.map(r => [r.id, r])); tree.rows = ROWS
  tree.children = new Map([['', [ROWS[0]]], ['g1', [ROWS[1], ROWS[2]]]]); tree.expanded = new Set(['g1']); tree.loaded = true; tree.load = async () => {}
  tree.ancestors = id => { const out = []; let n = tree.byId.get(id); while (n?.parent) { n = tree.byId.get(n.parent); if (n) out.push(n) } return out }
  store.actor = 'u1'; store.toasts = []; store.bookmarks = []; store.auth = { enabled: false }
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], statuses: [], relationTypes: [] }
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    rufe.push({ pfad: String(url), methode: opt.method ?? 'GET', rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : null })
    const antwort = /\/api\/workflows/.test(String(url)) ? [] : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}
const router = () => ({ path: '/tree/g1', ziele: [], push(p) { this.path = p; this.ziele.push(p) }, replace(p) { this.path = p } })

test('Kontextmenü: „Lesezeichen setzen“ legt das Lesezeichen an, danach steht „entfernen“ da', async () => {
  welt()
  const w = mount(TreeView, { props: { id: 'g1' }, global: { provide: { [routerKey]: router() }, stubs: { RouterLink: true, 'router-link': true, NodeView: true } } })
  await flushPromises()
  await w.findAll('.node').find(n => n.attributes('title') === 'p1').trigger('contextmenu'); await flushPromises()
  let eintrag = menu.items.find(i => i.label === 'Lesezeichen setzen')
  assert.ok(eintrag, 'der Eintrag steht im Menü'); assert.equal(eintrag.icon, '⚐')
  eintrag.action()
  assert.deepEqual(store.bookmarks, ['p1']); assert.match(store.toasts.at(-1).text, /Lesezeichen gesetzt/)
  await w.findAll('.node').find(n => n.attributes('title') === 'p1').trigger('contextmenu'); await flushPromises()
  eintrag = menu.items.find(i => i.label === 'Lesezeichen entfernen')
  assert.ok(eintrag, 'jetzt steht „entfernen“ da'); eintrag.action()
  assert.deepEqual(store.bookmarks, []); w.unmount()
})

test('Kopfleiste: das Menü nennt die Lesezeichen mit Pfad, öffnet den Knoten; das ✕ am Zeilenende entfernt und lässt das Menü offen', async () => {
  welt(); store.bookmarks = ['p2', 'p1']
  const r = router()
  const items = await lesezeichenMenue(r)
  assert.match(items[0].label, /Lesezeichen · 2/); assert.equal(items[0].disabled, true, 'Name und Zahl als Kopf')
  const eintraege = items.filter(i => i.hint === 'Mastertree')
  assert.equal(eintraege.length, 2, 'der Pfad steht dabei'); assert.match(eintraege[0].label, /Fräser/)
  eintraege[0].action(); assert.deepEqual(r.ziele, ['/tree/p2'], 'öffnen = der Knoten')
  assert.equal(items.some(i => i.label === 'Entfernen'), false, 'kein Untermenü Entfernen mehr')
  assert.equal(eintraege[0].end.icon, '×'); assert.match(eintraege[0].end.title, /Lesezeichen entfernen/)
  const neu = await eintraege[0].end.action()
  assert.deepEqual(store.bookmarks, ['p1'], 'Fräser ist weg')
  assert.match(neu[0].label, /Lesezeichen · 1/); assert.equal(neu.filter(i => i.hint === 'Mastertree').length, 1, 'das Menü bekommt die kürzere Liste')
})

test('ein Knoten, den es nicht mehr gibt, steht mit seiner Kennung da, ist nicht zu öffnen, aber über das ✕ zu entfernen', async () => {
  welt(); store.bookmarks = ['weg']
  const items = await lesezeichenMenue(router())
  const z = items.find(i => i.label === 'weg')
  assert.equal(z.disabled, true); assert.match(z.hint, /gibt es nicht mehr/)
  const neu = await z.end.action(); assert.deepEqual(store.bookmarks, [])
  assert.ok(neu.some(i => i.label === 'keine'), 'danach steht „keine“ da')
})

test('ohne Lesezeichen sagt das Menü „keine“ und nennt, wie man eines setzt', async () => {
  welt()
  const items = await lesezeichenMenue(router())
  assert.match(items[0].label, /Lesezeichen · 0/)
  const keine = items.find(i => i.label === 'keine'); assert.equal(keine.disabled, true); assert.match(keine.hint, /Kontextmenü/)
})

test('die Kopfleiste trägt den Knopf neben der Person und öffnet das Menü — die Datei übersetzt, der Knopf hängt an keinem Plugin', async () => {
  const App = (await import('../src/App.vue')).default
  assert.ok(App, 'App.vue übersetzt')
  const quelle = (await import('node:fs')).readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  const knopf = quelle.match(/<button[^>]*lesezeichen-knopf[^>]*>[^<]*<\/button>/)?.[0] ?? ''
  assert.match(knopf, /@click="lesezeichen"/); assert.match(knopf, /store\.bookmarks\.length/)
  assert.doesNotMatch(knopf, /plugins\./, 'er hängt an keinem Plugin: auch bei ausgeschalteten Aufgaben bleibt er')
  assert.ok(quelle.indexOf('lesezeichen-knopf') < quelle.indexOf('class="actor"'), 'er steht vor der Person')
})

test('Höchstzahl: darüber setzt das Lesezeichen nichts; mit Anmeldung geht die Liste als Einstellung an den Benutzer', async () => {
  const rufe = welt()
  store.auth = { enabled: true, user: 'u1' }
  store.bookmarks = Array.from({ length: MAX_BOOKMARKS }, (_, i) => 'n' + i)
  assert.equal(store.toggleBookmark('neu'), null); assert.equal(store.bookmarks.length, MAX_BOOKMARKS)
  store.bookmarks = []; store.toggleBookmark('p1')
  await new Promise(r => setTimeout(r, 600))
  const put = rufe.find(r => r.methode === 'PUT' && r.pfad === '/api/auth/me/prefs')
  assert.ok(put, 'die Einstellung geht an den Server')
  assert.equal(put.rumpf.prefs.bookmarks, JSON.stringify(['p1']))
  assert.ok(JSON.stringify(Array.from({ length: MAX_BOOKMARKS }, () => 'g-mastertree')).length < 4000, 'die Höchstzahl passt in den Wert des Benutzers')
  store.auth = { enabled: false }
})
