// Warnung vor dem Kontingent (03.10.2026): ein Import fragt vor dem Start, was sein Team noch schreiben darf und was der letzte Trockenlauf schätzte —
// reicht es nicht, steht das in der Rückfrage. Hält ein Lauf wegen des Kontingents an, sagt es eine Meldung.
import test from 'node:test'
import assert from 'node:assert/strict'
import { startFrage, kontingentAngehalten, OHNE } from '../../plugins/tasker/entry.js'

const imp = o => ({ key: 'solr_import', label: 'Solr', import: true, trockenlauf: true, ...o })

test('kein Import: keine Rückfrage', () => {
  assert.equal(startFrage({ key: 'x', label: 'X', import: false }), null)
})

test('reicht nicht: Warnung, Knopf „Trotzdem starten“, rot', () => {
  const f = startFrage(imp({ verfuegbar: { woche: 5406, monat: 46147 }, schaetzung: { eintraege: 1320000, am: '2026-10-03T14:20:00Z' } }))
  assert.equal(f.title, 'Solr starten')
  assert.deepEqual(f.list, ['Verfügbar · 5.406 / Woche · 46.147 / Monat', 'Trockenlauf 2026-10-03 14:20 · etwa 1.320.000 Einträge'])
  assert.equal(f.danger, true); assert.equal(f.ok, '▶ Trotzdem starten')
  assert.match(f.warn, /reicht nicht/)
})

test('reicht: keine Warnung; ohne Trockenlauf der Hinweis auf ≈; unbegrenzt ist ∞', () => {
  const f = startFrage(imp({ verfuegbar: { woche: OHNE, monat: OHNE }, schaetzung: { eintraege: 1320000, am: '2026-10-03T14:20:00Z' } }))
  assert.equal(f.warn, ''); assert.equal(f.danger, false); assert.equal(f.ok, '▶ Starten')
  assert.equal(f.list[0], 'Verfügbar · ∞ / Woche · ∞ / Monat')
  const g = startFrage(imp({ verfuegbar: { woche: 100, monat: 100 } }))
  assert.match(g.list[1], /Noch kein Trockenlauf/)
  assert.equal(g.warn, '', 'ohne Schätzung wird nicht gewarnt — nur genannt, was verfügbar ist')
})

test('Meldung nur beim Übergang in das Anhalten wegen des Kontingents', () => {
  const laeuft = { running: 'r1', paused: false }
  const halt = { running: 'r1', paused: true, pauseReason: 'Kontingent' }
  assert.equal(kontingentAngehalten(laeuft, halt), true)
  assert.equal(kontingentAngehalten(halt, halt), false, 'nicht bei jedem Neuladen wieder')
  assert.equal(kontingentAngehalten(laeuft, { running: 'r1', paused: true, pauseReason: 'Import' }), false)
})
