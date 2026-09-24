// Journal-Inhalt (24.09.2026): ProductCreated zeigte „undefined unter g-…“, weil family (Altlast) null ist.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'   // api.js zieht store.js nach, und das liest beim Laden localStorage — happy-dom stellt es
const { describe } = await import('../src/api.js')

test('ProductCreated ohne family nennt das Produkt, nicht undefined', () => {
  const s = describe({ type: 'ProductCreated', payload: { group: 'g-1', family: null, axes: ['color', 'size'] } })
  assert.equal(s, '▦ Produkt unter g-1 · color, size')
  assert.ok(!s.includes('undefined'))
})

test('ProductCreated mit family behält sie', () => {
  assert.equal(describe({ type: 'ProductCreated', payload: { group: 'g-1', family: 'Jacken' } }), '▦ Jacken unter g-1')
})
