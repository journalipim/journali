// Kontextmenü am Knoten (01.10.2026): das Modell kennt beliebig viele Status — sie stehen nicht mehr einzeln im Menü, sondern in einem Untermenü „Status“,
// gleich unter „Workflow“. Darin: die Status, die der Knoten noch nicht hat, und „Status ab Datum …“.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { menu } from '../src/menu.js'

const TreeView = (await import('../src/views/TreeView.vue')).default

const ROWS = [{ id: 'g1', role: 'group', label: 'Mastertree', parent: null, axes: [] }, { id: 'p1', role: 'product', label: 'Bohrer', parent: 'g1', axes: [], hasStatus: true, status: 'active' }]
const STATUS = ['draft', 'active', 'discontinued', 'review', 'archived'].map(key => ({ key, label: { de: key } }))

async function menueAm(zeile, { workflow = false } = {}) {
  tree.byId = new Map(ROWS.map(r => [r.id, r])); tree.rows = ROWS
  tree.children = new Map([['', [ROWS[0]]], ['g1', [ROWS[1]]]]); tree.expanded = new Set(['g1']); tree.loaded = true; tree.load = async () => {}
  store.actor = 'u1'; store.toasts = []
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], statuses: STATUS, relationTypes: [] }
  store.statusText = k => '● ' + k
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url)
    const antwort = /\/api\/workflows\/applicable/.test(pfad) ? [{ workflow: 'pruefung', workflowLabel: { de: 'Prüfung' }, key: 'freigeben', label: { de: 'freigeben' }, to: 'frei', toLabel: { de: 'freigegeben' }, count: 1, of: 1 }]
      : /\/api\/workflows$/.test(pfad) ? (workflow ? [{ key: 'pruefung' }] : []) : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  const router = { path: '/tree/g1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const w = mount(TreeView, { props: { id: 'g1' }, global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, NodeView: true } } })
  await flushPromises()
  await w.findAll('.node').find(n => n.attributes('title') === zeile).trigger('contextmenu'); await flushPromises()
  return { w, items: menu.items }
}

test('die Status stehen in einem Untermenü, nicht einzeln im Menü', async () => {
  const { w, items } = await menueAm('p1')
  for (const k of STATUS) assert.equal(items.some(i => i.label === '● ' + k.key), false, `${k.key} steht nicht oben im Menü`)
  const status = items.find(i => /^Status/.test(i.label ?? ''))
  assert.ok(status, 'das Untermenü Status steht da'); assert.ok(Array.isArray(status.items))
  assert.deepEqual(status.items.filter(i => i.label).map(i => i.label), ['● draft', '● discontinued', '● review', '● archived', 'Status ab Datum …'], 'ohne den Status, den der Knoten schon hat (active)')
  w.unmount()
})

test('Workflow und Status folgen aufeinander, danach ein Trenner; „Status ab Datum …“ steht unten im Untermenü', async () => {
  const { w, items } = await menueAm('p1', { workflow: true })
  const iw = items.findIndex(i => /^Workflow/.test(i.label ?? '')), is = items.findIndex(i => /^Status/.test(i.label ?? ''))
  assert.ok(iw >= 0 && is === iw + 1, 'Status gleich unter Workflow')
  assert.equal(items[is + 1].sep, true, 'dann ein Trenner')
  const st = items[is].items
  assert.equal(st.at(-1).label, 'Status ab Datum …'); assert.equal(st.at(-2).sep, true)
  w.unmount()
})
