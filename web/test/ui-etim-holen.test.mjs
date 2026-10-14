// ETIM im Klassendialog (14.10.2026): keine Freigabe im Journal. Der Dialog holt die Suchliste über den Prozess (fetch.mjs index, von der URL
// der Freigabe), sucht darin und holt beim Zuweisen genau die gewählte Klasse (fetch.mjs classes) — echtes DOM, Klicks und Eingaben wie beim Anwender.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win } from './ui.mjs'

const URL_ETIM = 'https://example.test/etim-10.zip'
const DATA = {
  settings: { classAttr: 'class_etim' },
  release: { key: '10-x', version: '10', number: 10, name: 'ETIM 10.0', classes: 2, url: URL_ETIM },
  'release:10-x': { key: '10-x', version: '10', number: 10, name: 'ETIM 10.0', classes: 2, url: URL_ETIM },
}
const LAPTOP = { code: 'EC004718', version: 2, status: '3', name: { de: 'Laptop' }, synonyms: { de: ['Notebook'] }, group: { code: 'EG1', name: { de: 'Computer' } },
  features: [{ code: 'EF008851', type: 'Logical', name: { de: 'WLAN' }, values: [] }, { code: 'EF000008', type: 'Numeric', name: { de: 'Breite' }, unit: { code: 'MM', abbr: { de: 'mm' } }, values: [] }] }
const LISTE = [{ code: 'EC004718', version: 2, status: '3', name: { de: 'Laptop' }, synonyms: { de: ['Notebook'] }, group: { code: 'EG1', name: { de: 'Computer' } }, features: 2 },
  { code: 'EC000529', version: 1, status: '3', name: { de: 'Klebstoff' }, synonyms: {}, group: { code: 'EG2', name: { de: 'Chemie' } }, features: 5 }]

const laeufe = [], gelesen = []
globalThis.fetch = async (url, opt = {}) => {
  const u = String(url); gelesen.push(u)
  const json = (d, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => d, text: async () => JSON.stringify(d) })
  if (u === '/api/plugins/etim/run') {
    const p = JSON.parse(opt.body).params; laeufe.push(p)
    if (p.mode === 'index') return json({ exit: 0, output: JSON.stringify({ key: '10-x', version: '10', classes: 2, liste: LISTE }) })
    if (p.mode === 'classes') { DATA['class:10-x:EC004718'] = LAPTOP; return json({ exit: 0, output: JSON.stringify({ key: '10-x', written: 1, missing: [] }) }) }
  }
  if (u === '/api/plugins/etim/data') return json(Object.keys(DATA))
  if (u.startsWith('/api/plugins/etim/data/')) { const n = decodeURIComponent(u.slice('/api/plugins/etim/data/'.length)); return n in DATA ? json(DATA[n]) : json(null, false) }
  if (u.startsWith('/api/values/')) return json({ values: [] })
  return json({})
}

const { default: plugin } = await import('../../plugins/etim/entry.js')
const warte = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 2)) }

const ROWS = [{ id: 'g-1', role: 'group', label: 'Computer', parent: null }, { id: 'p-1', role: 'product', label: 'Notebook 15', parent: 'g-1' }]
const byId = new Map(ROWS.map(r => [r.id, r]))
const ctx = {
  api: {
    get: async u => /\/api\/nodes\/[^/?]+$/.test(u) ? { values: [], ancestors: [] } : { rows: [] },
    post: async () => ({ readiness: { ready: true, missing: [] } }), del: async () => ({}),
  },
  store: { model: { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], lists: [], views: [] }, toast() {}, poll: async () => {} },
  tree: { loaded: true, load: async () => {}, rows: ROWS, byId, ancestors: id => { const out = []; for (let p = byId.get(id)?.parent; p; p = byId.get(p)?.parent) out.unshift(byId.get(p)); return out }, kids: id => ROWS.filter(r => r.parent === id) },
  ai: null, go() {},
}
globalThis.journali.store = ctx.store   // wie in der Oberfläche: die Sprachen des Modells

test('beim Laden des Plugins wird keine Freigabe geholt', async () => {
  await warte()
  assert.equal(laeufe.length, 0, 'kein Prozess beim Start')
  assert.ok(!gelesen.some(u => u.includes('values=true')), 'keine Klassen aus dem Journal')
})

test('der Klassendialog holt die Suchliste von der URL, findet eine Klasse, die nicht im Journal steht, und holt beim Wählen genau diese', async () => {
  const aktion = plugin.nodeActions.find(a => /ETIM-Klasse/.test(typeof a.label === 'function' ? a.label({ id: 'p-1' }) : a.label))
  await aktion.run('p-1', ctx)
  await warte()
  assert.deepEqual(laeufe.map(p => [p.mode, p.url]), [['index', URL_ETIM]], 'die Suchliste von der URL der Freigabe')
  // suchen: „Notebook“ ist ein Synonym der Klasse Laptop
  const feld = [...document.querySelectorAll('input')].find(i => /suchen in/.test(i.placeholder))
  assert.ok(feld, 'Suchfeld')
  assert.match(feld.placeholder, /2 Klassen/)
  feld.value = 'notebook'; feld.dispatchEvent(new win.Event('input', { bubbles: true }))
  const treffer = [...document.querySelectorAll('.pick')].find(e => e.textContent.includes('EC004718'))
  assert.ok(treffer, 'die Klasse aus der Suchliste')
  assert.match(treffer.textContent, /2 ETIM-Attribute/)
  treffer.dispatchEvent(new win.MouseEvent('click', { bubbles: true }))
  await warte()
  assert.deepEqual(laeufe.at(-1), { mode: 'classes', url: URL_ETIM, langs: 'de', codes: 'EC004718' }, 'genau die gewählte Klasse')
  assert.ok(document.body.textContent.includes('WLAN') && document.body.textContent.includes('Breite'), 'danach ihre ETIM-Attribute')
  assert.ok([...document.querySelectorAll('button')].some(b => b.textContent.includes('✓ zuweisen')))
  assert.ok(!gelesen.some(u => u.includes('values=true')), 'die Suchliste kommt nicht aus dem Journal')
})
