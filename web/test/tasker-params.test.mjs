// Wohin ein Parameter im Job-Dialog gehört (Taloan, 23.09.2026: „nö, immer noch da, selbst bei einem neuen Job“).
// „Überschreiben“ heisst: von dem abweichen, was im Profil steht. Ohne gewähltes Profil gibt es nichts, wovon man
// abweichen könnte — dann sind diese Felder die einzige Quelle und stehen oben. Das Profil-Feld sagt es selbst:
// „leer = Werte unten“.
import test from 'node:test'
import assert from 'node:assert/strict'
import { stelle } from '../../plugins/tasker/entry.js'

// die Parameter des Sicherungs-Plugins
const PROFIL = { key: 'profile', type: 'profile' }
const ROOT = { key: 'root', type: 'node' }
const DIR = { key: 'dir', type: 'dir' }
const KEEP = { key: 'keep', type: 'number' }
const GZIP = { key: 'gzip', type: 'boolean' }

test('ohne gewähltes Profil steht alles oben — es gibt nichts zu überschreiben', () => {
  for (const d of [PROFIL, ROOT, DIR, KEEP, GZIP]) assert.equal(stelle(d, ''), 'oben', d.key)
})

test('mit Profil bleiben oben: Profil, Pfade, Schalter', () => {
  assert.equal(stelle(PROFIL, 'mastertree'), 'oben')
  assert.equal(stelle(DIR, 'mastertree'), 'oben')
  assert.equal(stelle(GZIP, 'mastertree'), 'oben')
})

test('mit Profil wandert das Inhaltliche unter Überschreiben', () => {
  assert.equal(stelle(ROOT, 'mastertree'), 'unten')   // Teilbaum
  assert.equal(stelle(KEEP, 'mastertree'), 'unten')   // Aufbewahrung
  assert.equal(stelle({ key: 'format', type: 'text' }, 'p'), 'unten')
  assert.equal(stelle({ key: 'pub', type: 'pub' }, 'p'), 'unten')
})
