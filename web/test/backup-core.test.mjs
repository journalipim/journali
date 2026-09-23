// Die Sicherung scheiterte an sich selbst (Taloan, 23.09.2026, Lauf 08:23: „✗ Cannot access 'count' before
// initialization“). Die Zählung war als sofort aufgerufene Funktion geschrieben, die sich rekursiv beim eigenen
// Namen nannte — den es zu dem Zeitpunkt noch nicht gab. Ein Baum ohne Kinder lief durch, jeder echte nicht:
// die Sicherung brach ab, bevor eine Datei geschrieben war.
import test from 'node:test'
import assert from 'node:assert/strict'
import { knoten, zuLoeschen } from '../../plugins/backup/core.mjs'

test('ein Knoten ohne Kinder ist einer', () => {
  assert.equal(knoten({ id: 'g1' }), 1)
  assert.equal(knoten({ id: 'g1', children: [] }), 1)
})

test('gezählt wird der ganze Teilbaum, beliebig tief', () => {
  const baum = { id: 'g1', children: [{ id: 'g2', children: [{ id: 'p1' }, { id: 'p2' }] }, { id: 'p3' }] }
  assert.equal(knoten(baum), 5)
})

test('auch ein tiefer Baum zählt durch — hier scheiterte der Job', () => {
  let tief = { id: 'blatt' }
  for (let i = 0; i < 50; i++) tief = { id: 'n' + i, children: [tief] }
  assert.equal(knoten(tief), 51)
})

test('aufgeräumt werden die ältesten, keep bleibt stehen', () => {
  const dateien = ['b-x-2026-09-20.json', 'b-x-2026-09-23.json', 'b-x-2026-09-21.json', 'b-x-2026-09-22.json']
  assert.deepEqual(zuLoeschen(dateien, 2), ['b-x-2026-09-20.json', 'b-x-2026-09-21.json'])
  assert.deepEqual(zuLoeschen(dateien, 4), [])
  assert.deepEqual(zuLoeschen(dateien, 9), [])
  // keep 0 wäre „alles weg“ — mindestens ein Stand bleibt immer
  assert.deepEqual(zuLoeschen(dateien, 0), ['b-x-2026-09-20.json', 'b-x-2026-09-21.json', 'b-x-2026-09-22.json'])
})
