// Die Ansicht GEO-Texte: die Zielattribute sind mit den Attributen des Plugins (geo_*) vorbelegt, „übernehmen“ schreibt den Text dorthin,
// auch das JSON-LD (das fünfte Feld). Ein gemerktes Ziel gilt vor der Vorgabe.
import test from 'node:test'
import assert from 'node:assert/strict'
import { flushPromises } from './ui.mjs'

const geo = (await import('../../plugins/geo/entry.js')).default
const ruhe = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }

const KEYS = ['geo_definition', 'geo_description', 'geo_faq', 'geo_keywords', 'geo_jsonld']
function ctx({ gemerkt = null } = {}) {
  const gepostet = []
  const rows = [{ id: 'p1', role: 'product', label: 'Klebstoff', parent: null, groups: 'enrich_geo' }]
  const model = {
    masterLocale: 'de', locales: [{ code: 'de' }], lists: [], units: [],
    groups: [{ key: 'enrich_geo' }],
    attributes: [{ key: 'name', label: { de: 'Name' }, type: 'text' }, ...KEYS.map(key => ({ key, label: { de: key }, type: 'text', perLocale: true }))],
  }
  return {
    gepostet,
    ctx: {
      api: {
        get: async p => String(p).startsWith('/api/nodes/') ? { role: 'product', name: 'Klebstoff', values: [{ attribute: 'name', value: 'Klebstoff' }], ancestors: [], computed: [], axisValues: {} } : null,
        post: async (p, b, m) => { gepostet.push([p, b, m ?? 'POST']); return {} },
      },
      store: { model, poll: async () => {}, toast: () => {} },
      tree: { loaded: true, rows, byId: new Map(rows.map(r => [r.id, r])), ancestors: () => [], load: async () => {} },
      treePicker: () => {},
      data: { get: async () => gemerkt, set: async () => {} },
      ai: { available: () => true, label: () => 'KI', ask: async () => ({ definition: 'D', description: 'K', faq: [{ q: 'F?', a: 'A.' }], keywords: ['a', 'b'] }) },
    },
  }
}
async function zeigen(opts) {
  localStorage.setItem('journali.geo.node', 'p1')
  const w = ctx(opts); const root = document.createElement('div'); document.body.append(root)
  await geo.views[0].mount(root, w.ctx); await ruhe()
  ;[...root.querySelectorAll('button')].find(b => /Vorschlagen/.test(b.textContent)).click(); await ruhe()
  return { ...w, root }
}

test('die fünf Felder tragen als Zielattribut ihr geo_*-Attribut', async () => {
  const { root } = await zeigen()
  const ziele = [...root.querySelectorAll('select[title="Zielattribut"]')].map(s => s.value)
  assert.deepEqual(ziele, KEYS)
})

test('übernehmen schreibt in das Attribut des Feldes — das JSON-LD eingeschlossen', async () => {
  const { root, gepostet } = await zeigen()
  const knoepfe = [...root.querySelectorAll('button')].filter(b => b.textContent.trim() === '⇥ übernehmen')
  assert.equal(knoepfe.length, 5)
  for (const k of knoepfe) { k.click(); await ruhe() }
  const geschrieben = gepostet.filter(([p]) => p === '/api/nodes/p1/attributes').map(([, b]) => b.attribute)
  assert.deepEqual(geschrieben, KEYS)
  const ld = gepostet.find(([, b]) => b.attribute === 'geo_jsonld')[1]
  assert.match(ld.value, /"@type": "Product"/); assert.equal(ld.locale, 'de')
})

test('ein gemerktes Ziel gilt vor der Vorgabe', async () => {
  const { root } = await zeigen({ gemerkt: { faq: 'name' } })
  const ziele = [...root.querySelectorAll('select[title="Zielattribut"]')].map(s => s.value)
  assert.equal(ziele[2], 'name'); assert.equal(ziele[0], 'geo_definition')
})

const alleKnopf = root => [...root.querySelectorAll('button')].find(b => /alle übernehmen/.test(b.textContent))

test('„alle übernehmen“ schreibt alle fünf Texte in ihre Zielattribute', async () => {
  const { root, gepostet } = await zeigen()
  alleKnopf(root).click(); await ruhe()
  const geschrieben = gepostet.filter(([p]) => p === '/api/nodes/p1/attributes').map(([, b]) => b.attribute)
  assert.deepEqual(geschrieben, KEYS)
  assert.equal(gepostet.find(([, b]) => b.attribute === 'geo_faq')[1].value, 'F?\nA.')
})

test('„alle übernehmen“ lässt ein Feld ohne Zielattribut liegen und sagt es', async () => {
  const { root, gepostet } = await zeigen({ gemerkt: {} })
  const sel = [...root.querySelectorAll('select[title="Zielattribut"]')][2]; sel.value = ''; sel.dispatchEvent(new window.Event('change', { bubbles: true })); await ruhe()
  alleKnopf(root).click(); await ruhe()
  assert.deepEqual(gepostet.filter(([p]) => p === '/api/nodes/p1/attributes').map(([, b]) => b.attribute), ['geo_definition', 'geo_description', 'geo_keywords', 'geo_jsonld'])
})

test('die Ansicht GEO-Texte erzeugt Texte: einen Knopf Analyse hat sie nicht (der steht in der Datenqualität)', async () => {
  const { root } = await zeigen()
  assert.equal([...root.querySelectorAll('button')].some(b => /Analyse/.test(b.textContent)), false)
})
