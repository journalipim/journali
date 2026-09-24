// Das Plugin sagt, was am Job eingestellt wird — der Tasker rät nicht.
// Im Manifest steht `perJob` je Parameter: true = am Job, false = gehört ins Profil. Ohne Profil steht auch das
// Profil-Zeug da, denn dann gibt es keine andere Quelle. Fehlt die Angabe, zeigt der Tasker den Parameter.
import test from 'node:test'
import assert from 'node:assert/strict'
import { stelle } from '../../plugins/tasker/entry.js'

// so steht es im Manifest der Sicherung
const PROFIL = { key: 'profile', type: 'profile', perJob: true }
const DIR = { key: 'dir', type: 'dir', perJob: true }
const GZIP = { key: 'gzip', type: 'boolean', perJob: true }
const ROOT = { key: 'root', type: 'node', perJob: false }
const KEEP = { key: 'keep', type: 'number', perJob: false }

test('mit Profil steht da, was am Job eingestellt wird', () => {
  for (const d of [PROFIL, DIR, GZIP]) assert.equal(stelle(d, 'mastertree'), 'oben', d.key)
})

test('mit Profil verschwindet, was ins Profil gehört', () => {
  assert.equal(stelle(ROOT, 'mastertree'), 'aus')
  assert.equal(stelle(KEEP, 'mastertree'), 'aus')
})

test('ohne Profil steht alles da — es gibt keine andere Quelle', () => {
  for (const d of [PROFIL, DIR, GZIP, ROOT, KEEP]) assert.equal(stelle(d, ''), 'oben', d.key)
})

test('ein fremdes Plugin ohne Angabe: der Tasker versteckt nichts', () => {
  const fremd = { key: 'irgendwas', type: 'text' }
  assert.equal(stelle(fremd, 'mit-profil'), 'oben')
  assert.equal(stelle(fremd, ''), 'oben')
})
