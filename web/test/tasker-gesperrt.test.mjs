// Ein Job, dessen Plugin nicht wirkt (nicht installiert, aus, oder nicht im Tarif), lässt sich nur noch entfernen.
// Der Server lehnt Starten und Bearbeiten ohnehin ab; die Ansicht sperrt es, bevor jemand klickt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { jobGesperrt } from '../../plugins/tasker/entry.js'

test('gesperrt ist ein Job genau dann, wenn sein Plugin nicht wirkt', () => {
  const aktiv = k => k === 'backup'
  assert.equal(jobGesperrt({ plugin: 'docs' }, aktiv), true)
  assert.equal(jobGesperrt({ plugin: 'backup' }, aktiv), false)
  assert.equal(jobGesperrt({ plugin: 'docs' }, undefined), false, 'ohne Auskunft wird nichts gesperrt')
})
