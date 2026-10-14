// Die Ansicht ⌗ ETIM (14.10.2026): sie zu öffnen holt keine Freigabe. „⌕ Klassen laden“ liest die Suchliste über den Prozess (fetch.mjs index);
// „✕ n Klassen ohne Zuweisung“ nimmt die Klassen heraus, die das frühere Holen ins Journal gebracht hat und die nirgends zugewiesen sind —
// die zugewiesene bleibt. Echtes DOM, Klicks wie beim Anwender.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win } from './ui.mjs'

const URL_ETIM = 'https://example.test/etim-10.zip'
const LAPTOP = { code: 'EC004718', version: 2, status: '3', name: { de: 'Laptop' }, synonyms: {}, group: { code: 'EG1', name: { de: 'Computer' } }, features: [] }
const DATA = {
  settings: { classAttr: 'class_etim' },
  release: { key: '10-x', version: '10', number: 10, name: 'ETIM 10.0', classes: 3, url: URL_ETIM },
  'release:10-x': { key: '10-x', version: '10', number: 10, name: 'ETIM 10.0', classes: 3, url: URL_ETIM },
  'class:10-x:EC004718': LAPTOP,                                                    // zugewiesen
  'class:10-x:EC000001': { ...LAPTOP, code: 'EC000001', name: { de: 'Eins' } },     // vom früheren Holen, nirgends zugewiesen
  'class:EC000002': { ...LAPTOP, code: 'EC000002', name: { de: 'Zwei' } },          // Altbestand ohne Version, nirgends zugewiesen
}
const laeufe = [], gesetzt = []
globalThis.fetch = async (url, opt = {}) => {
  const u = String(url)
  const json = (d, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => d, text: async () => JSON.stringify(d) })
  if (u === '/api/plugins/etim/run') {
    const p = JSON.parse(opt.body).params; laeufe.push(p)
    return json({ exit: 0, output: JSON.stringify({ key: '10-x', version: '10', classes: 3, liste: [{ code: 'EC009999', name: { de: 'Neu' }, synonyms: {}, group: null, features: 4, status: '3' }] }) })
  }
  if (u === '/api/plugins/etim/data') return json(Object.keys(DATA))
  if (u.startsWith('/api/plugins/etim/data/')) { const n = decodeURIComponent(u.slice('/api/plugins/etim/data/'.length)); return n in DATA ? json(DATA[n]) : json(null, false) }
  if (u.startsWith('/api/values/')) return json({ values: [{ id: 'g-1', value: 'EC004718', label: 'Computer', role: 'group' }] })
  return json({})
}

const { default: plugin } = await import('../../plugins/etim/entry.js')
const warte = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 2)) }
const ROWS = [{ id: 'g-1', role: 'group', label: 'Computer', parent: null, groups: '' }]
const byId = new Map(ROWS.map(r => [r.id, r]))
const store = { model: { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], lists: [], views: [] }, toast() {}, poll: async () => {} }
globalThis.journali.store = store
const ctx = {
  api: {
    get: async () => ({ rows: [] }), del: async () => ({}),
    post: async (url, body, method) => { if (url === '/api/plugins/etim/data' && method === 'PUT') { gesetzt.push(body); for (const [n, v] of Object.entries(body)) if (v === null) delete DATA[n] } return {} },
  },
  store, tree: { loaded: true, load: async () => {}, rows: ROWS, byId, ancestors: () => [], kids: () => [] },
  data: { list: async () => Object.keys(DATA), get: async n => DATA[n] ?? null, set: async (n, v) => { DATA[n] = v }, del: async n => { delete DATA[n] } },
  dialog: { confirm: async () => true }, treePicker() {}, mapper: { norm: s => String(s).toLowerCase(), similarity: () => 0 }, go() {}, ai: null,
}

test('die Ansicht zu öffnen holt nichts; „⌕ Klassen laden“ holt die Suchliste von der URL', async () => {
  const root = document.createElement('div'); document.body.append(root)
  await plugin.views.find(v => v.path === 'etim').mount(root, ctx)
  await warte()
  assert.equal(laeufe.length, 0, 'öffnen holt keine Freigabe')
  const laden = [...root.querySelectorAll('button')].find(b => b.textContent.includes('⌕ Klassen laden'))
  assert.ok(laden, 'Knopf „⌕ Klassen laden“')
  laden.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); await warte()
  assert.deepEqual(laeufe.map(p => [p.mode, p.url]), [['index', URL_ETIM]])
  const feld = [...root.querySelectorAll('input')].find(i => /Klasse suchen/.test(i.placeholder))
  assert.ok(feld && !feld.disabled, 'danach lässt sich suchen')
  root.remove()
})

test('„✕ Klassen ohne Zuweisung“ nimmt die nicht zugewiesenen Klassen aus dem Journal — die zugewiesene bleibt', async () => {
  const root = document.createElement('div'); document.body.append(root)
  await plugin.views.find(v => v.path === 'etim').mount(root, ctx)
  await warte()
  const weg = [...root.querySelectorAll('button')].find(b => b.textContent.includes('Klassen ohne Zuweisung'))
  assert.ok(weg, 'Knopf zum Aufräumen')
  assert.match(weg.textContent, /2 Klassen ohne Zuweisung/)
  weg.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); await warte()
  assert.deepEqual(gesetzt.flatMap(b => Object.keys(b)).sort(), ['class:10-x:EC000001', 'class:EC000002'])
  assert.ok(gesetzt.every(b => Object.values(b).every(v => v === null)), 'entfernen heisst: null')
  assert.ok('class:10-x:EC004718' in DATA, 'die zugewiesene Klasse bleibt')
  assert.ok(![...root.querySelectorAll('button')].some(b => b.textContent.includes('Klassen ohne Zuweisung')), 'danach ist nichts mehr aufzuräumen')
  root.remove()
})
