// Ob ein Parameter im Job-Dialog steht (Taloan, 23.09.2026: „und jetzt zum dritten Mal: was hat diese verdammte Auswahl
// hier bei einem Backup zu suchen“ / „der ist doch nur für Importe“). Was im Profil steht, wird im Profil gepflegt —
// im Dialog steht nur, was man je Job einstellt: das Profil selbst, Pfade und Schalter. Ohne gewähltes Profil sind
// die Felder die einzige Quelle und stehen im Dialog; wer vom Profil abweichen will, legt ein zweites an.
import test from 'node:test'
import assert from 'node:assert/strict'
import { stelle } from '../../plugins/tasker/entry.js'

// die Parameter des Sicherungs-Plugins
const PROFIL = { key: 'profile', type: 'profile' }
const ROOT = { key: 'root', type: 'node' }
const DIR = { key: 'dir', type: 'dir' }
const KEEP = { key: 'keep', type: 'number' }
const GZIP = { key: 'gzip', type: 'boolean' }

test('ohne Profil steht alles im Dialog — es gibt keine andere Quelle', () => {
  for (const d of [PROFIL, ROOT, DIR, KEEP, GZIP]) assert.equal(stelle(d, ''), 'oben', d.key)
})

test('mit Profil bleiben die Sachen des Jobs: Profil, Pfade, Schalter', () => {
  assert.equal(stelle(PROFIL, 'mastertree'), 'oben')
  assert.equal(stelle(DIR, 'mastertree'), 'oben')
  assert.equal(stelle(GZIP, 'mastertree'), 'oben')
})

test('mit Profil verschwindet, was im Profil gepflegt wird', () => {
  assert.equal(stelle(ROOT, 'mastertree'), 'aus')   // Teilbaum
  assert.equal(stelle(KEEP, 'mastertree'), 'aus')   // Aufbewahrung
  assert.equal(stelle({ key: 'format', type: 'text' }, 'p'), 'aus')
  assert.equal(stelle({ key: 'pub', type: 'pub' }, 'p'), 'aus')
})
