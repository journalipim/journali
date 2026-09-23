// Der Job-Dialog als Assistent (Taloan, 23.09.2026: „jetzt hab ich Glück, dass ich so gerade noch an meine Buttons dran
// komme — wie wäre es damit, das auf verschiedene Tabs aufzuteilen, wie ein Assistent mit ← →“). Vier Schritte:
// ① Was, ② Womit, ③ Ablage, ④ Wann. Welche davon es gibt, steht erst nach der Wahl von Plugin und Profil fest
// (Taloan: „denn auch erst nach Aussuchen von Plugin/Profil steht ja fest, was ich als Nächstes anzeige“) — ein Prozess
// ohne Fächer hat keine Ablage, einer ohne Parameter kein „Womit“. Leere Seiten werden übersprungen, nicht gezeigt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { naechsteSeite } from '../../plugins/tasker/entry.js'

const ALLE = [true, true, true, true]

test('vorwärts und rückwärts durch alle vier', () => {
  assert.equal(naechsteSeite(ALLE, 0, 1), 1)
  assert.equal(naechsteSeite(ALLE, 2, 1), 3)
  assert.equal(naechsteSeite(ALLE, 3, -1), 2)
})

test('am Rand kommt nichts mehr — die Pfeile werden blind', () => {
  assert.equal(naechsteSeite(ALLE, 3, 1), null)
  assert.equal(naechsteSeite(ALLE, 0, -1), null)
})

test('leere Seiten werden übersprungen: ein Prozess ohne Fächer hat keine Ablage', () => {
  const ohneAblage = [true, true, false, true]
  assert.equal(naechsteSeite(ohneAblage, 1, 1), 3)   // von „Womit" direkt zu „Wann"
  assert.equal(naechsteSeite(ohneAblage, 3, -1), 1)
})

test('ein Prozess ganz ohne Parameter: von „Was" direkt zu „Wann"', () => {
  const nurRahmen = [true, false, false, true]
  assert.equal(naechsteSeite(nurRahmen, 0, 1), 3)
  assert.equal(naechsteSeite(nurRahmen, 3, -1), 0)
})
