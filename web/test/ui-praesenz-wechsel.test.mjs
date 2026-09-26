// Präsenz beim Wechsel der Ansicht (26.09.2026): Vue mountet die neue Ansicht, bevor es die alte entfernt. Räumt die
// alte dann den Ort auf, löscht sie den der neuen — der Puls ging ohne Ort hinaus, und niemand sah mehr jemanden.
// Aufgeräumt wird darum nur, was noch der eigene Ort ist.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { store } from '../src/store.js'

/// Dieselbe Reihenfolge wie in NodeView: erst der Watcher der neuen Ansicht, dann das Aufräumen der alten.
function wechsel(von, nach, nurEigenen) {
  store.ort = von
  store.ort = nach                                        // neue Ansicht: watch(() => props.id, immediate)
  if (!nurEigenen || store.ort === von) store.ort = null   // alte Ansicht: onUnmounted
  return store.ort
}

test('nach dem Wechsel steht der neue Ort — nicht null', () => {
  assert.equal(wechsel('v-1', 'v-2', true), 'v-2')
})

test('ohne die Prüfung löschte die alte Ansicht den neuen Ort', () => {
  assert.equal(wechsel('v-1', 'v-2', false), null, 'so war der Fehler')
})

test('wer die letzte Knotenansicht verlässt, meldet keinen Ort mehr', () => {
  store.ort = 'v-1'
  if (store.ort === 'v-1') store.ort = null
  assert.equal(store.ort, null)
})
