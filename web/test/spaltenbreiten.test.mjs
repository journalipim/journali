// Spaltenbreiten ziehen (columnWidths in panes.js). Sitzt der Griff am linken Rand einer rechtsbündigen Spalte,
// muss sie nach links wachsen — sonst läuft sie der Maus entgegen und die Spalten daneben wandern verkehrt herum
// (25.09.2026, ⌁ Plugins).
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { columnWidths } from '../src/panes.js'

// Ein Mausereignis, wie es der Griff im Spaltenkopf schickt
const maus = (x, klassen = '') => ({
  clientX: x,
  currentTarget: { classList: { contains: (c) => klassen.split(' ').includes(c) } },
  preventDefault() {}, stopPropagation() {},
})
const bewege = (x) => window.dispatchEvent(Object.assign(new window.Event('mousemove'), { clientX: x }))
const los = () => window.dispatchEvent(new window.Event('mouseup'))

test('ein Griff rechts: nach rechts ziehen macht breiter', () => {
  localStorage.clear()
  const cols = columnWidths('probe-rechts', { key: 100 }, { min: 40, max: 400 })
  cols.zieh('key', maus(500))
  bewege(560)
  assert.equal(cols.w.key, 160)
  los()
})

test('ein Griff links: nach links ziehen macht breiter', () => {
  localStorage.clear()
  const cols = columnWidths('probe-links', { art: 100 }, { min: 40, max: 400 })
  cols.zieh('art', maus(500, 'grip left'))
  bewege(440)          // 60 px nach links
  assert.equal(cols.w.art, 160, 'die Spalte waechst nach links, sie schrumpft nicht')
  los()
})

test('die Grenzen halten in beide Richtungen', () => {
  localStorage.clear()
  const cols = columnWidths('probe-grenzen', { art: 100 }, { min: 40, max: 200 })
  cols.zieh('art', maus(500, 'grip left'))
  bewege(100)          // weit nach links
  assert.equal(cols.w.art, 200)
  bewege(900)          // weit nach rechts
  assert.equal(cols.w.art, 40)
  los()
})

test('losgelassen wird die Breite gemerkt und beim naechsten Mal genommen', () => {
  localStorage.clear()
  const cols = columnWidths('probe-merken', { art: 100 }, { min: 40, max: 400 })
  cols.zieh('art', maus(500, 'grip left'))
  bewege(450)
  los()
  assert.equal(cols.w.art, 150)
  const wieder = columnWidths('probe-merken', { art: 100 }, { min: 40, max: 400 })
  assert.equal(wieder.w.art, 150)
  // Doppelklick setzt auf die Vorgabe zurueck
  wieder.zurueck()
  assert.equal(wieder.w.art, 100)
})
