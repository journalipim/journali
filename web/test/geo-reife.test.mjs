// GEO-Reife: vier Kriterien zu je 25 Punkten, aus den Daten gerechnet — Faktenbasis, Fragen & Antworten, Relation zu einem anderen Produkt, Mengenangabe.
// Geprüft wird die Rechnung (reifeVon, die Regeln) und der Weg durch ✓ Datenqualität: die Relationen holt sie nur, wenn eine gewählte Regel sie braucht.
import test from 'node:test'
import assert from 'node:assert/strict'
import { flushPromises } from './ui.mjs'

const geoModul = await import('../../plugins/geo/entry.js')
const geo = geoModul.default
const { reifeVon } = geoModul
const da = (await import('../../plugins/da/entry.js')).default
const ruhe = async () => { for (let i = 0; i < 5; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }
const regel = key => geo.checks.find(c => c.key === key)

const SPALTEN = [
  { key: 'name', type: 'text' }, { key: 'sku', type: 'text' }, { key: 'beschreibung', type: 'text' },
  { key: 'dicke', type: 'decimal', unit: 'mm' }, { key: 'dichte', type: 'decimal' }, { key: 'emicode', type: 'enum' }, { key: 'pumpbar', type: 'boolean' },
  { key: 'farbe', type: 'text' }, { key: 'verbrauch', type: 'decimal', unit: 'kg/m²', label: { de: 'Verbrauch' } }, { key: 'geo_faq', type: 'text' },
]
const WERTE = (extra = {}) => Object.fromEntries(Object.entries({ name: 'Z 625', sku: 'A1', beschreibung: 'Text', dicke: '20', dichte: '1.5', emicode: 'EC1', pumpbar: 'true', farbe: 'grau', verbrauch: '1.5', ...extra }).map(([k, v]) => [k, { value: v }]))
const produkt = (extra = {}, relations = {}) => ({ row: { id: 'p1', role: 'product', label: 'Z 625' }, values: WERTE(extra), columns: SPALTEN, relations })
const FAQ = 'Wofür?\nFür Böden.\n\nWie dick?\nBis 20 mm.\n\nWann begehbar?\nNach 2 Stunden.'

test('Fakten: Zahl, Einheit, Liste und Ja/Nein zählen; Name, SKU, freier Text und die geo_*-Attribute nicht', () => {
  assert.equal(reifeVon(produkt()).fakten, 5, 'dicke, dichte, emicode, pumpbar, verbrauch')
  assert.equal(reifeVon(produkt({ emicode: '' })).fakten, 4, 'ein leerer Wert zählt nicht')
})

test('Punkte: Fakten bis 8, Fragen bis 3, Relation 25, Menge 25', () => {
  const r = reifeVon(produkt({ geo_faq: FAQ }, { p1: [{ type: 'alt', direction: 'out', other: { id: 'p2', label: 'Z 610' } }] }))
  assert.deepEqual(r.punkte, { fakten: Math.round(25 * 5 / 8), fragen: 25, entscheidung: 25, berechnung: 25 })
  assert.deepEqual(reifeVon(produkt()).punkte, { fakten: Math.round(25 * 5 / 8), fragen: 0, entscheidung: 0, berechnung: 25 })
  assert.equal(reifeVon(produkt({ geo_faq: 'Eine Frage?\nAntwort.' })).fragen, 1)
})

test('Menge: ein Attribut Verbrauch oder Ergiebigkeit mit Zahl und Einheit — ohne Einheit nicht', () => {
  assert.equal(reifeVon(produkt()).menge, true)
  const ohne = { ...produkt(), columns: SPALTEN.map(c => c.key === 'verbrauch' ? { ...c, unit: undefined } : c) }
  assert.equal(reifeVon(ohne).menge, false)
  const imText = { ...produkt({ verbrauch: 'ca. 1,5 kg/m² je mm' }), columns: SPALTEN.map(c => c.key === 'verbrauch' ? { ...c, type: 'text', unit: undefined } : c) }
  assert.equal(reifeVon(imText).menge, false, 'ein Text zählt nur, wenn er eine Zahl ist')
})

test('die Regeln melden, was fehlt — nur an Produkten, nicht an Gruppen oder Varianten', () => {
  const leer = produkt({ dicke: '', dichte: '', emicode: '', pumpbar: '', verbrauch: '' })
  assert.equal(regel('facts').run(leer)[0].severity, 'warn'); assert.match(regel('facts').run(leer)[0].message, /1 konkrete Werte|0 konkrete Werte/)
  assert.equal(regel('answers').run(leer)[0].severity, 'warn'); assert.equal(regel('answers').run(leer)[0].attribute, 'geo_faq')
  assert.equal(regel('decision').run(leer).length, 1); assert.equal(regel('calc').run(leer).length, 1)
  const voll = produkt({ geo_faq: FAQ, extra1: '1', extra2: '2', extra3: '3' }, { p1: [{ other: { id: 'p2' } }] })
  voll.columns = [...SPALTEN, ...[1, 2, 3].map(i => ({ key: 'extra' + i, type: 'decimal' }))]
  for (const k of ['facts', 'answers', 'decision', 'calc']) assert.deepEqual(regel(k).run(voll), [], k)
  for (const rolle of ['group', 'variant']) for (const k of ['facts', 'answers', 'decision', 'calc', 'score']) assert.deepEqual(regel(k).run({ ...leer, row: { id: 'x', role: rolle } }), [], `${k} an ${rolle}`)
})

test('die Summenzeile nennt Punktzahl und Teile', () => {
  const m = regel('score').run(produkt({ geo_faq: FAQ }, { p1: [{ other: { id: 'p2' } }] }))[0].message
  assert.equal(m, `GEO-Reife ${16 + 25 + 25 + 25}/100 · Fakten 16 · Antworten 25 · Entscheidung 25 · Berechnung 25`)
})

// ---- durch die Datenqualität
async function pruefen(gewaehlt) {
  const gerufen = [], gegangen = []
  const rows = [{ id: 'g1', role: 'group', label: 'Alles', parent: null }]
  const tabelle = { columns: SPALTEN, rows: [{ row: { id: 'p1', role: 'product', label: 'Z 625', keys: {} }, values: WERTE(), inactive: [] }] }
  const ctx = {
    go: p => gegangen.push(p),
    api: { get: async p => { gerufen.push(p); return p.includes('/relations/tree') ? { p1: [{ other: { id: 'p2' } }] } : tabelle } },
    store: { model: { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], lists: [] }, toast: () => {} },
    tree: { loaded: true, rows, byId: new Map(rows.map(r => [r.id, r])), load: async () => {} }, treePicker: () => {},
    checks: geo.checks.map(c => ({ ...c, key: 'geo', check: c.key, quelle: { de: 'GEO' } })),
    data: { get: async () => ({ rules: gewaehlt }), set: async () => {} },
  }
  localStorage.setItem('journali.dq.root', 'g1')
  const root = document.createElement('div'); document.body.append(root)
  await da.views[0].mount(root, ctx); await ruhe()
  ;[...root.querySelectorAll('button')].find(b => /prüfen/.test(b.textContent)).click(); await ruhe()
  return { gerufen, gegangen, root, text: root.textContent }
}

test('Datenqualität: die Relationen werden geholt, wenn eine gewählte Regel sie braucht — und dann zeigt die Summenzeile die Entscheidung', async () => {
  const { gerufen, text } = await pruefen(['geo:score'])
  assert.equal(gerufen.filter(p => p.includes('/relations/tree')).length, 1)
  assert.match(text, /GEO-Reife 66\/100 · Fakten 16 · Antworten 0 · Entscheidung 25 · Berechnung 25/)
})

test('Datenqualität: braucht keine gewählte Regel Relationen, werden sie nicht geholt', async () => {
  const { gerufen } = await pruefen(['geo:facts', 'geo:calc'])
  assert.equal(gerufen.some(p => p.includes('/relations/tree')), false)
})

test('Datenqualität: wird die Auswahl nach einer Prüfung geändert, sagt die Statuszeile, dass neu zu prüfen ist', async () => {
  const gerufen = []
  const rows = [{ id: 'g1', role: 'group', label: 'Alles', parent: null }]
  const tabelle = { columns: SPALTEN, rows: [{ row: { id: 'p1', role: 'product', label: 'Z 625', keys: {} }, values: WERTE(), inactive: [] }] }
  const ctx = {
    api: { get: async p => { gerufen.push(p); return p.includes('/relations/tree') ? {} : tabelle } },
    store: { model: { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], lists: [] }, toast: () => {} },
    tree: { loaded: true, rows, byId: new Map(rows.map(r => [r.id, r])), load: async () => {} }, treePicker: () => {},
    checks: geo.checks.map(c => ({ ...c, key: 'geo', check: c.key, quelle: { de: 'GEO' } })), data: { get: async () => ({ rules: ['geo:facts'] }), set: async () => {} },
  }
  localStorage.setItem('journali.dq.root', 'g1')
  const root = document.createElement('div'); document.body.append(root)
  await da.views[0].mount(root, ctx); await ruhe()
  const gruppe = [...root.querySelectorAll('.regelgruppe')].at(-1)
  gruppe.querySelector('label.gruppe input').click(); await ruhe()
  assert.doesNotMatch(root.textContent, /Auswahl geändert/, 'vor der ersten Prüfung gibt es nichts, das veraltet')
  ;[...root.querySelectorAll('button')].find(b => /prüfen/.test(b.textContent)).click(); await ruhe()
  gruppe.querySelector('label.gruppe input').click(); await ruhe()
  assert.match(root.textContent, /Auswahl geändert — ▶ prüfen/)
})

test('Datenqualität prüft den gewählten Knoten mit: ein Produkt als Wurzel wird nicht übersprungen', async () => {
  const { gerufen } = await pruefen(['geo:score'])
  assert.ok(gerufen.some(p => p.includes('/table?deep=true&self=true')), gerufen.join(' '))
})
