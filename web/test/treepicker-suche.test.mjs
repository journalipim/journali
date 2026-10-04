// Baumauswahl (04.10.2026): die Suche rechnet die Treffer und ihre Vorfahren einmal je Eingabe (entprellt) — vorher je gezeigter Zeile über alle Knoten.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { tree } from '../src/tree.js'
import { treePicker } from '../src/treePicker.js'

test('die Suche zeigt Treffer mit ihrem Pfad und sonst nichts', async () => {
  const rows = [{ id: 'g1', role: 'group', parent: null, label: 'Werkzeug' }, { id: 'g2', role: 'group', parent: 'g1', label: 'Zangen' }, { id: 'p1', role: 'product', parent: 'g2', label: 'Seitenschneider' },
    { id: 'g3', role: 'group', parent: null, label: 'Garten' }, { id: 'p2', role: 'product', parent: 'g3', label: 'Schere' }]
  const children = new Map(); for (const r of rows) { const k = r.parent ?? ''; if (!children.has(k)) children.set(k, []); children.get(k).push(r) }
  Object.assign(tree, { rows, byId: new Map(rows.map(r => [r.id, r])), children, loaded: true, keyHit: () => false })
  const box = document.createElement('div'); document.body.append(box)
  treePicker(box, { roles: ['group', 'product'] })
  const feld = box.querySelector('input[type=search]')
  feld.value = 'schneider'; feld.dispatchEvent(new Event('input'))
  await new Promise(r => setTimeout(r, 200))
  const text = box.textContent
  assert.ok(text.includes('Seitenschneider') && text.includes('Zangen') && text.includes('Werkzeug'), text)
  assert.ok(!text.includes('Garten') && !text.includes('Schere'), 'andere Zweige nicht')
  box.remove()
})
