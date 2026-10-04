// Prüfkatalog, Ebene wählen (04.10.2026): liest nur die eigenen Werte des einen Attributs (/api/values) statt der Tabelle des ganzen Baums,
// zählt Produkte, Untergruppen und Abweichungen in einem Durchgang und hält auch einen Pfad mit tausenden Ebenen aus.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { pickLevel } from '../src/compliance.js'

function baum(rows) {
  const children = new Map(); for (const r of rows) { const k = r.parent ?? ''; if (!children.has(k)) children.set(k, []); children.get(k).push(r) }
  Object.assign(tree, { rows, byId: new Map(rows.map(r => [r.id, r])), children, loaded: true })
}

async function waehle(row, opts, rows, werte) {
  baum(rows)
  const get = api.get, model = store.model; const abrufe = []
  api.get = async pfad => { abrufe.push(pfad); return { values: werte } }
  store.model = { attributes: [{ key: 'scope', type: 'enum' }], groups: [], units: [] }
  try {
    const p = pickLevel(row, 'Geltung', opts)
    await new Promise(r => setTimeout(r, 0))
    const box = document.body.lastElementChild
    const chips = [...box.querySelectorAll('.chips')[0].querySelectorAll('button')].map(b => ({ text: b.textContent, primary: b.className === 'primary' }))
    const ok = [...box.querySelectorAll('button')].find(b => b.textContent === 'OK'); ok.click()
    return { chips, gewaehlt: await p, abrufe }
  } finally { api.get = get; store.model = model }
}

test('Ebene wählen: eigene Werte über /api/values, Zahlen je Ebene, Empfehlung die höchste Ebene ohne Untergruppen und ohne Abweichung', async () => {
  const rows = [
    { id: 'g1', role: 'group', parent: null, label: 'Alles' },
    { id: 'g2', role: 'group', parent: 'g1', label: 'Akkus' }, { id: 'g3', role: 'group', parent: 'g1', label: 'Kabel' },
    { id: 'p1', role: 'product', parent: 'g2', label: 'P1' }, { id: 'p2', role: 'product', parent: 'g2', label: 'P2' }, { id: 'v2', role: 'variant', parent: 'p2', label: 'V2' },
    { id: 'p3', role: 'product', parent: 'g3', label: 'P3' },
  ]
  const { chips, gewaehlt, abrufe } = await waehle(rows.find(r => r.id === 'p2'), { attr: 'scope', wanted: 'battery' }, rows, [{ id: 'p1', value: 'hazmat' }])
  assert.deepEqual(abrufe, ['/api/values/scope?root=g1'])
  assert.deepEqual(chips.map(c => c.text), ['Alles 3 · 2 ▣ · 1 ≠', 'Akkus 2 · 1 ≠', 'P2 1'])
  assert.deepEqual(chips.map(c => c.primary), [false, false, true])
  assert.equal(gewaehlt.id, 'p2')
})

test('Ebene wählen: ein Pfad mit 5 000 Ebenen wird gezählt, ohne den Stapel zu sprengen', async () => {
  const rows = [{ id: 'g0', role: 'group', parent: null, label: 'G' }]
  for (let i = 1; i < 5000; i++) rows.push({ id: 'n' + i, role: 'product', parent: i === 1 ? 'g0' : 'n' + (i - 1), label: 'N' + i })
  const { chips, gewaehlt } = await waehle(rows[1], {}, rows, [])
  assert.equal(chips[0].text, 'G 4999')
  assert.equal(gewaehlt.id, 'g0')
})
