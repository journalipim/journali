// Der Job-Dialog als Assistent. Vier Schritte:
// ① Was, ② Womit, ③ Ablage, ④ Wann. Welche davon es gibt, steht erst nach der Wahl von Plugin und Profil fest
// — ein Prozess
// ohne Fächer hat keine Ablage, einer ohne Parameter kein „Womit“. Leere Seiten werden übersprungen, nicht gezeigt.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'   // echtes DOM (happy-dom) — der Fokustest braucht eines
import { naechsteSeite, profilPflicht, seiteZeigen } from '../../plugins/tasker/entry.js'

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

// Eine Meldung gehoert auf den Schritt, auf dem man sie beheben kann. Dahinter steckte ein zweiter Fehler: die Sicherung liess sich ohne
// Profil nicht speichern, obwohl ihr Feld ausdruecklich „(leer = Werte unten)“ anbietet.
test('ein Profil, das leer sein darf, ist keine Pflicht', () => {
  assert.equal(profilPflicht({ label: 'Profil — ✎ hier anlegen: Teilbaum, Format, Sprachen … (leer = Werte unten)' }), false)
  assert.equal(profilPflicht({ label: 'Profil (⇩ Import → JSON → Profil speichern: Zuordnung, Praefix, Ziel; leer = gleiche Keys, kein Praefix)' }), false)
})

test('ohne diesen Hinweis bleibt es Pflicht', () => {
  assert.equal(profilPflicht({ label: 'Profil (⇩ Import → IXP → Profil speichern: Quelle, Sprachen, Ziel)' }), true)
  assert.equal(profilPflicht({ label: 'Profil (Zielsprache aus dem Profil, sonst aus der Datei)' }), true)
})

test('kein Profil-Feld, keine Pflicht', () => {
  assert.equal(profilPflicht(undefined), false)
  assert.equal(profilPflicht(null), false)
})

// 27.09.2026 gemeldet: „wenn ich etwas eintippe, springt der Cursor bei jedem Buchstaben in ein anderes Feld“. Jedes
// `input` im Dialog ruft die Prüfung, und die stellte die Seite neu auf die Bühne — das Neueinhängen nahm dem Feld den
// Fokus. Dieselbe Seite wird darum nicht mehr angefasst.
test('dieselbe Seite bleibt hängen — der Fokus im Feld auch', () => {
  const buehne = document.createElement('div')
  const seite = document.createElement('div')
  const feld = document.createElement('input')
  seite.append(feld)
  document.body.append(buehne)

  assert.equal(seiteZeigen(buehne, seite), true, 'die erste Seite muss eingehängt werden')
  feld.focus()
  assert.equal(document.activeElement, feld)

  assert.equal(seiteZeigen(buehne, seite), false, 'dieselbe Seite wurde noch einmal eingehängt')
  assert.equal(document.activeElement, feld, 'der Fokus ging beim Tippen verloren')
  assert.equal(buehne.childElementCount, 1)
})

test('eine andere Seite kommt auf die Bühne, die alte geht', () => {
  const buehne = document.createElement('div')
  const eins = document.createElement('div'); eins.textContent = 'eins'
  const zwei = document.createElement('div'); zwei.textContent = 'zwei'
  seiteZeigen(buehne, eins)
  assert.equal(seiteZeigen(buehne, zwei), true)
  assert.equal(buehne.childElementCount, 1)
  assert.equal(buehne.firstChild.textContent, 'zwei')
})
