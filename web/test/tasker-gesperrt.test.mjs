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

test('der Grund nennt den Tarif, wenn er das Plugin nicht trägt, sonst die fehlende Aktivierung', () => {
  // Die Ansicht fragt plugins.list nach allowed; hier nur die Regel dahinter
  const grund = (liste, plugin) => liste.find(p => p.key === plugin)?.allowed === false ? 'tarif' : 'aus'
  assert.equal(grund([{ key: 'docs', allowed: false }], 'docs'), 'tarif')
  assert.equal(grund([{ key: 'docs', allowed: true, enabled: false }], 'docs'), 'aus')
  assert.equal(grund([], 'weg'), 'aus', 'ein Plugin, das es nicht mehr gibt')
})
