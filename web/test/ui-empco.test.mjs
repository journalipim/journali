// Plugin empco: Befund in der Liste beheben (Stift → Wert mit markiertem Begriff → Speichern → Befund entfällt).
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { win } from './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

tree.loaded = true
tree.rows = [{ id: 'g1', role: 'group', label: 'Klebstoffe', parent: null }]
tree.byId = new Map(tree.rows.map(r => [r.id, r]))
tree.load = async () => {}
store.model = { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [{ key: 'beschreibung', type: 'text', label: { de: 'Beschreibung' } }], groups: [] }

const warte = () => new Promise(r => setTimeout(r, 0))
const klick = el => { el.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); return warte() }

async function ansicht(werte) {
  const get = api.get, post = api.post, poll = store.poll
  const geschrieben = []
  api.get = async p => String(p).includes('/table')
    ? { columns: [{ key: 'beschreibung', type: 'text' }], rows: [{ row: { id: 'p1', label: 'Kleber', role: 'product' }, values: { beschreibung: { value: werte.wert } } }] }
    : []
  api.post = async (p, body) => { geschrieben.push({ p, body }); werte.wert = body.value; return {} }
  store.poll = async () => {}
  const root = document.createElement('div')
  const empco = (await import('../../plugins/empco/entry.js')).default
  await empco.views[0].mount(root, { api, store, tree, treePicker() {}, go() {} })
  return { root, geschrieben, zurueck() { api.get = get; api.post = post; store.poll = poll } }
}
const knopf = (root, text) => [...root.querySelectorAll('button')].find(b => b.textContent.includes(text))

test('empco: der Stift zeigt den Wert mit markiertem Begriff, Speichern schreibt ihn und der Befund entfällt', async () => {
  const w = { wert: 'Ein umweltfreundliches Produkt' }
  const a = await ansicht(w)
  try {
    await klick(knopf(a.root, '▶ prüfen')); await warte()
    assert.ok(a.root.textContent.includes('1 in 1 Knoten'), 'ein Befund')
    await klick(knopf(a.root, '✎'))
    const ta = a.root.querySelector('textarea')
    assert.ok(ta, 'Textfeld unter dem Befund')
    assert.equal(ta.value, 'Ein umweltfreundliches Produkt')
    assert.equal(a.root.querySelector('mark')?.textContent, 'umweltfreundliches', 'der gefundene Begriff ist markiert')
    ta.value = 'Ein Produkt mit 30 % Rezyklat'
    await klick(knopf(a.root, 'Speichern')); await warte()
    assert.equal(a.geschrieben.length, 1)
    assert.match(a.geschrieben[0].p, /\/nodes\/p1\/attributes$/)
    assert.deepEqual({ ...a.geschrieben[0].body }, { attribute: 'beschreibung', locale: null, channel: null, value: 'Ein Produkt mit 30 % Rezyklat', row: null })
    assert.ok(a.root.textContent.includes('✓ keine Befunde'), 'der Befund ist weg')
    assert.equal(a.root.querySelector('textarea'), null, 'das Textfeld ist zu')
  } finally { a.zurueck() }
})

test('empco: trifft der neue Wert weiter, bleibt der Befund mit dem neuen Begriff stehen', async () => {
  const w = { wert: 'Ein umweltfreundliches Produkt' }
  const a = await ansicht(w)
  try {
    await klick(knopf(a.root, '▶ prüfen')); await warte()
    await klick(knopf(a.root, '✎'))
    a.root.querySelector('textarea').value = 'Ein nachhaltiges Produkt'
    await klick(knopf(a.root, 'Speichern')); await warte()
    assert.ok(a.root.textContent.includes('„nachhaltiges“'), 'neuer Befund mit neuem Begriff')
    assert.ok(a.root.textContent.includes('1 in 1 Knoten'))
  } finally { a.zurueck() }
})

test('empco: Abbrechen schreibt nichts', async () => {
  const w = { wert: 'Ein umweltfreundliches Produkt' }
  const a = await ansicht(w)
  try {
    await klick(knopf(a.root, '▶ prüfen')); await warte()
    await klick(knopf(a.root, '✎'))
    await klick(knopf(a.root, 'Abbrechen'))
    assert.equal(a.geschrieben.length, 0)
    assert.equal(a.root.querySelector('textarea'), null)
  } finally { a.zurueck() }
})
