// Prüfansicht: für Vorlage- und Formel-Attribute öffnet ein Knopf den vorhandenen Editor (ScriptEditor) am Knoten.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win } from './ui.mjs'
import { api } from '../src/api.js'
import { editorOeffnen } from '../src/compliance.js'

const warte = (ms = 0) => new Promise(r => setTimeout(r, ms))
const knopf = text => [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(text))

test('editorOeffnen: der Editor steht im Dokument mit Titel, Übernehmen ruft onSave mit dem Text und schliesst', async () => {
  const post = api.post
  api.post = async () => ({ ok: true, error: null, keys: ['name'] })
  const gespeichert = [], zu = []
  try {
    editorOeffnen({ title: 'Handelsname · Kleber', draftKey: 'p1.dpp_trade_name.test', type: 'template', node: 'p1', attributes: [{ key: 'name', label: { de: 'Name' }, type: 'text' }],
      modelValue: '{name}', onSave: v => gespeichert.push(v), onClose: () => zu.push(true) })
    await warte(20)
    assert.ok(document.querySelector('.overlay'), 'der Editor steht im Dokument')
    assert.match(document.body.textContent, /Handelsname · Kleber/)
    const uebernehmen = knopf('Übernehmen'); assert.ok(uebernehmen, 'Knopf Übernehmen')
    uebernehmen.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); await warte(20)
    assert.deepEqual(gespeichert, ['{name}'])
    assert.deepEqual(zu, [true])
    assert.equal(document.querySelector('.overlay'), null, 'der Editor ist wieder weg')
  } finally { api.post = post }
})

test('editorOeffnen: Schliessen ruft nur onClose, nichts wird gespeichert', async () => {
  const post = api.post
  api.post = async () => ({ ok: true, error: null, keys: [] })
  const gespeichert = [], zu = []
  try {
    editorOeffnen({ title: 'Modell', draftKey: 'p1.x.test2', type: 'template', node: 'p1', attributes: [], modelValue: '', onSave: v => gespeichert.push(v), onClose: () => zu.push(true) })
    await warte(20)
    knopf('Schliessen').dispatchEvent(new win.MouseEvent('click', { bubbles: true })); await warte(20)
    assert.deepEqual(gespeichert, [])
    assert.deepEqual(zu, [true])
  } finally { api.post = post }
})

// ---- die Ansicht selbst: Liste „leer eintragen“ und Klick auf eine Zelle der Matrix öffnen den Editor
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

tree.loaded = true
tree.rows = [{ id: 'g1', role: 'group', label: 'Klebstoffe', parent: null, groups: 'k' }, { id: 'v1', role: 'variant', label: 'Variante 1', parent: 'g1' }]
tree.byId = new Map(tree.rows.map(r => [r.id, r]))
tree.kids = id => tree.rows.filter(r => r.parent === id)
tree.ancestors = id => { const a = []; let r = tree.byId.get(id); while (r?.parent) { r = tree.byId.get(r.parent); if (r) a.push(r) } return a }
tree.load = async () => {}
store.model = { masterLocale: 'de', locales: [{ code: 'de' }], groups: [{ key: 'k', label: { de: 'K' } }], lists: [], units: [],
  attributes: [{ key: 'k_tpl', type: 'template', label: { de: 'Vorlage' }, group: 'k' }, { key: 'name', type: 'text', label: { de: 'Name' }, group: 'k' }] }
const katalog = { key: 'k', label: 'Test', icon: '▧', groupKey: 'k', prefix: 'k_', source: 'https://example.org', sourceLabel: 'Quelle',
  groups: [{ key: 'g', label: 'Gruppe', items: [{ key: 'tpl', label: 'Vorlagenwert', level: 'must', type: 'text' }] }] }
const tabelle = { node: { id: 'g1', role: 'group', label: 'Klebstoffe', parent: null }, columns: [],
  rows: [{ row: { id: 'g1', role: 'group', label: 'Klebstoffe', parent: null }, values: { k_tpl: { value: null } } }, { row: { id: 'v1', role: 'variant', label: 'Variante 1', parent: 'g1' }, values: { k_tpl: { value: null } } }] }

async function ansicht() {
  const get = api.get, post = api.post, poll = store.poll
  const gepostet = []
  api.get = async p => String(p).includes('/table') ? tabelle : /\/api\/nodes\/[^/?]+$/.test(String(p)) ? { values: [] } : []
  api.post = async (p, body) => { gepostet.push({ p, body }); return String(p).includes('/formula/check') ? { ok: true, error: null, keys: [] } : {} }
  store.poll = async () => {}
  const root = document.createElement('div'); document.body.append(root)
  const { mount } = await import('../src/compliance.js')
  await mount(root, { data: { get: async k => k === 'mapping' ? { tpl: { to: 'k_tpl' } } : null, set: async () => {} }, api, store, tree, treePicker() {}, go() {} }, katalog)
  await warte(60)
  return { root, gepostet, zurueck() { api.get = get; api.post = post; store.poll = poll; root.remove() } }
}
const klick = async el => { el.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); await warte(30) }
const schreibeUndSpeichere = async text => {
  const ta = document.querySelector('.overlay textarea'); ta.value = text; ta.dispatchEvent(new win.Event('input', { bubbles: true })); await warte(30)
  await klick(knopf('Übernehmen'))
}

test('Ansicht: „leer“ öffnet die Liste, der Knopf öffnet den Editor am Knoten, Übernehmen schreibt den Text', async () => {
  const a = await ansicht()
  try {
    const zaehler = [...a.root.querySelectorAll('td.num')].find(td => td.style.cursor === 'pointer')
    assert.ok(zaehler, 'die Zahl „leer“ ist anklickbar')
    await klick(zaehler)
    const editorKnopf = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Editor öffnen'))
    assert.ok(editorKnopf, 'statt der Eingabezeile steht ein Knopf für den Editor')
    await klick(editorKnopf)
    assert.ok(document.querySelector('.overlay textarea'), 'der Editor ist offen')
    await schreibeUndSpeichere('{name} Kleber')
    const geschrieben = a.gepostet.find(g => /\/nodes\/g1\/attributes$/.test(g.p))
    assert.equal(geschrieben?.body.value, '{name} Kleber')
    assert.equal(geschrieben?.body.attribute, 'k_tpl')
  } finally { a.zurueck() }
})

test('Ansicht: Klick auf eine leere Zelle der Matrix öffnet den Editor statt der Eingabezeile', async () => {
  const a = await ansicht()
  try {
    const zelle = a.root.querySelector('td[title="leer"]')
    assert.ok(zelle, 'eine leere Zelle der Matrix')
    await klick(zelle); await warte(30)
    assert.ok(document.querySelector('.overlay textarea'), 'der Editor ist offen')
    assert.equal(document.querySelector('.dlg input.cell-input'), null, 'keine Eingabezeile')
    await schreibeUndSpeichere('{name}')
    assert.ok(a.gepostet.some(g => /\/nodes\/g1\/attributes$/.test(g.p) && g.body.value === '{name}'))
  } finally { a.zurueck() }
})
