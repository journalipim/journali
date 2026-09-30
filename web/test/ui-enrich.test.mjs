// Plugin enrich (30.09.2026): Knotenwähler und Suchknopf.
// Prüft: treePicker wird mit Container+Rückruf aufgerufen (nicht als Promise), der Suchknopf ist
// nur deaktiviert, wenn nichts gewählt oder KI fehlt — nicht pauschal.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

// Baum und Modell vorbereiten
tree.loaded = true
tree.rows = [
  { id: 'g1', role: 'group', label: 'Klebstoffe', parent: null },
  { id: 'p1', role: 'product', label: '1-K Acrylat', parent: 'g1' },
]
tree.byId = new Map(tree.rows.map(r => [r.id, r]))
tree.kids = id => tree.rows.filter(r => r.parent === id)
tree.ancestors = id => { const a = []; let r = tree.byId.get(id); while (r?.parent) { r = tree.byId.get(r.parent); if (r) a.push(r) } return a }
tree.load = async () => {}
tree.keyHit = () => false
tree.keyText = () => ''

store.model = {
  masterLocale: 'de',
  attributes: [
    { key: 'farbe', label: { de: 'Farbe' }, type: 'text', group: 'phys' },
    { key: 'gewicht', label: { de: 'Gewicht' }, type: 'number', group: 'phys', unit: 'kg' },
  ],
  groups: [{ key: 'phys', label: { de: 'Physisch' } }],
}

test('enrich: treePicker bekommt ein DOM-Element und onPick-Rückruf', async () => {
  const get = api.get
  let pickerAufruf = null
  const ctx = {
    api, store, tree, dialog: {}, ai: { available: () => true, label: () => 'Test' },
    treePicker(container, opts) {
      pickerAufruf = { container, opts }
      // Picker wird in den Container gemalt — hier sofort einen Knoten wählen
      if (opts.onPick) opts.onPick({ id: 'g1', label: 'Klebstoffe', role: 'group' })
    },
  }
  // Tabelle für den Teilbaum
  api.get = async p => {
    if (String(p).includes('/table')) return {
      columns: [
        { key: 'farbe', type: 'text' },
        { key: 'gewicht', type: 'number' },
      ],
      rows: [
        { row: { id: 'p1', label: '1-K Acrylat', role: 'product' }, values: { farbe: { value: 'rot' }, gewicht: { value: null } } },
      ],
    }
    return []
  }
  try {
    const root = document.createElement('div')
    const enrich = (await import('../../plugins/enrich/entry.js')).default
    await enrich.views[0].mount(root, ctx)
    // Wähler-Knopf finden und klicken
    const btn = [...root.querySelectorAll('button')].find(b => b.textContent.includes('▤'))
    assert.ok(btn, 'Wähler-Knopf ▤ vorhanden')
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // treePicker muss mit DOM-Element und onPick aufgerufen worden sein
    assert.ok(pickerAufruf, 'treePicker wurde aufgerufen')
    assert.ok(pickerAufruf.container instanceof HTMLElement, 'erster Parameter ist ein DOM-Element')
    assert.equal(typeof pickerAufruf.opts.onPick, 'function', 'opts.onPick ist ein Rückruf')
    assert.deepEqual(pickerAufruf.opts.roles, ['group', 'product'], 'Rollen stimmen')
  } finally { api.get = get }
})

test('enrich: Suchknopf ist aktiv, wenn Attribute gewählt und KI verfügbar', async () => {
  const get = api.get
  api.get = async p => {
    if (String(p).includes('/table')) return {
      columns: [{ key: 'farbe', type: 'text' }, { key: 'gewicht', type: 'number' }],
      rows: [{ row: { id: 'p1', label: '1-K', role: 'product' }, values: { farbe: { value: null }, gewicht: { value: null } } }],
    }
    return []
  }
  try {
    const root = document.createElement('div')
    const enrich = (await import('../../plugins/enrich/entry.js')).default
    await enrich.views[0].mount(root, {
      api, store, tree, dialog: {}, ai: { available: () => true, label: () => 'Test' },
      treePicker() {},
    })
    // leere Attribute als Chips: einzeln anklicken (drawAuswahl baut das DOM nach jedem Klick neu)
    let chips = [...root.querySelectorAll('.view-chip')]
    assert.ok(chips.length > 0, 'leere Attribute als Chips vorhanden')
    chips[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // nach dem Klick: DOM ist neu, zweiten Chip frisch holen
    chips = [...root.querySelectorAll('.view-chip')]
    if (chips.length > 1) chips.find(c => !c.classList.contains('on'))?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // Suchknopf finden
    const startBtn = [...root.querySelectorAll('button.primary')].find(b => b.textContent.includes('Suche starten'))
    assert.ok(startBtn, 'Suchknopf vorhanden')
    assert.ok(!startBtn.hasAttribute('disabled'), 'Suchknopf ist aktiv (nicht deaktiviert)')
  } finally { api.get = get }
})
