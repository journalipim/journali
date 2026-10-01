// GPC am Knoten, wie bei ETIM: das Band in der Knotenansicht, der Menüpunkt, der den Dialog öffnet. Jede Klasse hat ihre Attributgruppe
// (sie heisst wie die Klasse); das Band zeigt, ob sie hier gilt, und hängt sie an, wo sie fehlt. Geprüft wird das Plugin so, wie die
// Oberfläche es einbindet (entry.js).
import test from 'node:test'
import assert from 'node:assert/strict'
import { flushPromises } from './ui.mjs'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { dialog } from '../src/dialog.js'

const BAUM = [
  { id: 'g1', parent: null, label: 'Leuchten', role: 'group', groups: 'class_gpc,class_gpc_19900001' },
  { id: 'p1', parent: 'g1', label: 'Stehlampe', role: 'product' },
  { id: 'p2', parent: 'g1', label: 'Tischlampe', role: 'product' },
]
const calls = []
let knoten = {}
globalThis.fetch = async (url, opts = {}) => {
  const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
  calls.push({ path, method: opts.method ?? 'GET', body: opts.body ? JSON.parse(opts.body) : null })
  let out = {}
  if (/^\/api\/nodes\/[^/]+$/.test(path)) out = knoten
  return { ok: true, status: 200, text: async () => JSON.stringify(out), json: async () => out }
}

const MODELL = {
  masterLocale: 'de', locales: [{ code: 'de' }], views: [],
  groups: [{ key: 'class_gpc', attributes: ['class_gpc'] }, { key: 'class_gpc_19900001', attributes: ['gpc29900001', 'gpc29900002'] }],
  lists: [{ key: 'class_gpc', columns: ['group'], values: [{ value: '19900001', label: { de: 'Sample Lamps' } }, { value: '19900002', label: { de: 'Sample Cables' } }] }],
  attributes: [{ key: 'class_gpc', type: 'enum', list: 'class_gpc', group: 'class_gpc' }],
}
store.model = MODELL; store.poll = async () => {}
tree.rows = BAUM; tree.byId = new Map(BAUM.map(r => [r.id, r])); tree.loaded = true; tree.load = async () => {}
tree.kids = id => BAUM.filter(r => r.parent === id); tree.ancestors = () => []
const { default: plugin } = await import('../../plugins/gpc/src/entry.js')
const ruhe = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }
const gruppen = (...keys) => keys.map(key => ({ key, active: true }))

async function band(nodeId) {
  const head = document.createElement('span'), body = document.createElement('div'); document.body.append(body)
  const zu = await plugin.nodeBands[0].mount({ head, body }, nodeId, {})
  await ruhe()
  return { head, body, zu, knoepfe: () => [...body.querySelectorAll('button')].map(b => b.textContent.trim()) }
}

test('Band an einem Knoten mit eigener Klasse: Name, Zahl der Attribute in ihrer Gruppe und die Knöpfe', async () => {
  knoten = { values: [{ attribute: 'class_gpc', value: '19900001' }], ancestors: [], groups: gruppen('class_gpc', 'class_gpc_19900001') }
  const { head, body, zu, knoepfe } = await band('g1')
  assert.equal(head.textContent, '· 19900001 Sample Lamps')
  assert.match(body.textContent, /19900001 Sample Lamps/); assert.match(body.textContent, /2 Attribute/)
  assert.deepEqual(knoepfe(), ['⌗ andere Klasse …', '✕ Klasse'])
  zu()
})

test('Band an einem Knoten mit geerbter Klasse: ohne ✕, mit dem Hinweis woher', async () => {
  knoten = { values: [], ancestors: [{ id: 'g1', label: 'Leuchten', values: [{ attribute: 'class_gpc', value: '19900001' }] }], groups: gruppen('class_gpc', 'class_gpc_19900001') }
  const { head, body, zu, knoepfe } = await band('p1')
  assert.equal(head.textContent, '· 19900001 Sample Lamps ↑')
  assert.match(body.textContent, /↑ Leuchten/)
  assert.deepEqual(knoepfe(), ['⌗ andere Klasse …'])
  zu()
})

test('Band ohne Klasse und ohne Gruppe: „Klasse zuweisen“ und „Gruppe anhängen“; der Knopf hängt die Gruppe an diesen Knoten', async () => {
  knoten = { values: [], ancestors: [], groups: [] }
  const { head, body, zu, knoepfe } = await band('p2')
  assert.equal(head.textContent, '· keine Klasse')
  assert.deepEqual(knoepfe(), ['⌗ Klasse zuweisen …', '⌗ Gruppe class_gpc anhängen'])
  const vorher = calls.length
  ;[...body.querySelectorAll('button')].find(b => /Gruppe class_gpc anhängen/.test(b.textContent)).click(); await ruhe()
  const neu = calls.slice(vorher).find(c => c.path === '/api/nodes/p2/groups')
  assert.equal(neu.method, 'PUT'); assert.deepEqual(neu.body, { groups: ['class_gpc'] })
  zu()
})

test('gilt die Gruppe der Klasse hier nicht, bietet das Band sie an', async () => {
  knoten = { values: [{ attribute: 'class_gpc', value: '19900001' }], ancestors: [], groups: gruppen('class_gpc') }
  const { body, zu, knoepfe } = await band('p2')
  assert.deepEqual(knoepfe(), ['⌗ andere Klasse …', '✕ Klasse', '⌗ Gruppe class_gpc_19900001 anhängen'])
  const vorher = calls.length
  ;[...body.querySelectorAll('button')].find(b => /Gruppe class_gpc_19900001 anhängen/.test(b.textContent)).click(); await ruhe()
  assert.deepEqual(calls.slice(vorher).find(c => c.path === '/api/nodes/p2/groups').body, { groups: ['class_gpc_19900001'] })
  zu()
})

test('gibt es die Gruppe der Klasse nicht mehr, führt das Band zur Wahl der Klasse statt sie anzuhängen', async () => {
  knoten = { values: [{ attribute: 'class_gpc', value: '19900002' }], ancestors: [], groups: gruppen('class_gpc') }
  const { body, zu, knoepfe } = await band('p2')
  assert.deepEqual(knoepfe(), ['⌗ andere Klasse …', '✕ Klasse'], 'die Gruppe class_gpc_19900002 gibt es im Modell nicht')
  assert.ok(body.querySelector('button.primary'), 'die Wahl ist der Weg')
  zu()
})

test('die eigene Klasse entfernen: nach der Rückfrage ruft das Band den Server, der auch die Gruppe abnimmt', async () => {
  knoten = { values: [{ attribute: 'class_gpc', value: '19900001' }], ancestors: [], groups: gruppen('class_gpc', 'class_gpc_19900001') }
  const { body, zu } = await band('g1')
  dialog.confirm = async () => true
  const vorher = calls.length
  ;[...body.querySelectorAll('button')].find(b => /✕ Klasse/.test(b.textContent)).click(); await ruhe()
  const c = calls.slice(vorher).find(x => x.path === '/api/classification/clear')
  assert.equal(c.method, 'POST'); assert.deepEqual(c.body, { node: 'g1', system: { group: 'class_gpc', classAttr: 'class_gpc' } })
  zu()
})

test('der Menüpunkt am Knoten öffnet den Dialog als Fenster; Esc schliesst ihn', async () => {
  knoten = { values: [], ancestors: [], groups: [] }
  const aktion = plugin.nodeActions[0]
  assert.deepEqual(aktion.roles, ['group', 'product'])
  await aktion.run('p1'); await ruhe()
  const fenster = document.body.querySelector('.klasse.modal')
  assert.ok(fenster, 'der Dialog steht über der Oberfläche')
  assert.match(fenster.textContent, /GPC-Klasse/); assert.match(fenster.textContent, /Stehlampe/)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await ruhe()
  assert.equal(document.body.querySelector('.klasse.modal'), null)
})

test('das Plugin trägt Ansicht, Band und Menüpunkt im Thema Klassifikation — keine Sammelgruppe mit Abschnitten mehr', () => {
  assert.equal(plugin.views[0].topic, 'classification'); assert.equal(plugin.views[0].path, 'gpc')
  assert.equal(plugin.nodeBands[0].key, 'gpc'); assert.deepEqual(plugin.nodeBands[0].roles, ['group', 'product', 'variant'])
  assert.equal(plugin.nodeActions[0].topic, 'classification')
  assert.equal(plugin.nodeViews, undefined, 'die Gruppe einer Klasse ist ein eigener Reiter, eine Gliederung nach Klassenmengen braucht es nicht')
})
