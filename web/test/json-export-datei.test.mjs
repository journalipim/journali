// JSON-Export (04.10.2026): Rohdaten kommen als Datei vom Server — der Browser holt den Teilbaum nicht mehr ins Fenster; die Vorschau zeigt den
// Knoten selbst; ausgewertet (Baum, Liste) über 5 000 Knoten lehnt die Ansicht ab.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { mountExport } from '../../plugins/json/export.js'

function welt(kinder) {
  const rows = [{ id: 'g', role: 'group', label: 'Zweig', parent: null }, ...Array.from({ length: kinder }, (_, i) => ({ id: `p-${i}`, role: 'product', label: `P${i}`, parent: 'g' }))]
  const byId = new Map(rows.map(r => [r.id, r]))
  const gefragt = []
  const ctx = {
    api: { get: async p => { gefragt.push(p); return { node: { id: 'g', children: [] }, model: { groups: [], attributes: [], lists: [], units: [] } } } },
    store: { model: { masterLocale: 'de', locales: [{ code: 'de' }] }, toast() {} },
    tree: { loaded: true, rows, byId, kids: id => rows.filter(r => r.parent === id) },
    data: { get: async () => ({ format: 'raw' }), set: async () => {} },
    treePicker: () => {}, use: () => ({ tableExport: { build: async () => { throw new Error('darf nicht laufen') } } }),
  }
  return { ctx, gefragt }
}
const knopf = (root, text) => [...root.querySelectorAll('button')].find(b => b.textContent.includes(text))

test('Rohdaten herunterladen: ein Verweis auf die Datei des Servers, nichts wird ins Fenster geholt', async () => {
  localStorage.setItem('journali.export.root', 'g')
  const { ctx, gefragt } = welt(3)
  const root = document.createElement('div'); document.body.append(root)
  const geklickt = []
  const orig = HTMLAnchorElement.prototype.click
  HTMLAnchorElement.prototype.click = function () { geklickt.push(this.getAttribute('href')) }
  try {
    await mountExport(root, ctx)
    knopf(root, 'herunterladen').click(); await new Promise(r => setTimeout(r, 5))
    assert.deepEqual(geklickt, ['/api/nodes/g/export/file?deep=true'])
    assert.equal(gefragt.length, 0)
    knopf(root, 'Vorschau').click(); await new Promise(r => setTimeout(r, 5))
    assert.deepEqual(gefragt, ['/api/nodes/g/export?deep=false'], 'die Vorschau holt nur den Knoten')
  } finally { HTMLAnchorElement.prototype.click = orig; root.remove() }
})

test('ausgewertet über 5 000 Knoten: abgelehnt mit Meldung, nichts geladen', async () => {
  localStorage.setItem('journali.export.root', 'g')
  const { ctx } = welt(5001)
  ctx.data.get = async () => ({ format: 'flat', locales: ['de'] })
  const root = document.createElement('div'); document.body.append(root)
  try {
    await mountExport(root, ctx)
    knopf(root, 'Vorschau').click(); await new Promise(r => setTimeout(r, 5))
    assert.match(root.textContent, /5002 Knoten, höchstens 5000/)
  } finally { root.remove() }
})
