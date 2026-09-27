// Der Balken der Systemjobs im Tasker (27.09.2026): probe, embed und derive stehen immer da — mit Füllstand
// (erledigt von gesamt), den Zahlen und ▶ zum Nachholen, auch ohne angelegten Job. Echtes DOM, gefälschte Antworten.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win } from './ui.mjs'
import { systemRows, systemBlock } from '../../plugins/tasker/entry.js'

const PLUGINS = [
  { key: 'probe', service: '', label: { de: 'Masse der Dateien lesen' }, system: true, progress: '/api/media/probe' },
  { key: 'embed', service: '', label: { de: 'Einbettungen (Vektoren)' }, system: true, progress: '/api/docs/embed' },
  { key: 'csv', service: 'export', label: { de: 'CSV' }, system: false, progress: null },
  { key: 'csv', service: 'import', label: { de: 'CSV' }, system: false, progress: null },
]
const JOBS = [{ key: 'probe', plugin: 'probe', label: 'Masse', running: true }]
const PROGRESS = { probe: { total: 200, gelesen: 150, offen: 50 }, embed: { ready: false, reason: 'Erweiterung vector fehlt in dieser Datenbank.' } }

test('je Systemjob eine Zeile — mit Fortschritt, Job und Prozentzahl; Dienste zählen einmal', () => {
  const rows = systemRows(PLUGINS, JOBS, PROGRESS)
  assert.deepEqual(rows.map(r => r.plugin), ['probe', 'embed'], 'csv ist kein Systemjob, und probe steht einmal')
  const probe = rows[0]
  assert.deepEqual([probe.gelesen, probe.total, probe.offen, probe.pct], [150, 200, 50, 75])
  assert.equal(probe.job?.running, true)
  assert.equal(probe.label, 'Masse der Dateien lesen')
  const embed = rows[1]
  assert.equal(embed.ready, false); assert.equal(embed.pct, null); assert.equal(embed.job, null)
})

test('ohne Antwort des Endpunkts steht die Zeile trotzdem da', () => {
  const [r] = systemRows(PLUGINS.slice(0, 1), [], {})
  assert.equal(r.progress, null); assert.equal(r.ready, null); assert.equal(r.pct, null)
})

test('der Block: Balken als Füllstand, Zahlen, ▶ startet das Nachholen — ein laufender zeigt nur, dass er läuft', () => {
  const gestartet = []
  const box = systemBlock(systemRows(PLUGINS, JOBS, PROGRESS), p => gestartet.push(p))
  const zeilen = box.querySelectorAll('.sysrow')
  assert.equal(zeilen.length, 2)
  assert.equal(zeilen[0].querySelector('.fill').style.width, '75%', 'der Balken füllt sich mit dem Erledigten')
  assert.match(zeilen[0].textContent, /150 \/ 200/); assert.match(zeilen[0].textContent, /50 offen/)
  assert.equal(zeilen[0].querySelector('button'), null, 'läuft schon — kein zweiter Start')
  assert.match(zeilen[0].textContent, /▶/)
  // embed: nicht bereit, der Grund im Tooltip, ▶ gesperrt
  assert.match(zeilen[1].textContent, /nicht bereit/)
  assert.match(zeilen[1].querySelector('span[title]').getAttribute('title'), /vector fehlt/)
  assert.ok(zeilen[1].querySelector('button').disabled)
  // ein bereiter ohne Job: ▶ ruft mit dem Plugin
  const box2 = systemBlock(systemRows(PLUGINS.slice(1, 2), [], { embed: { ready: true, total: 10, gelesen: 0, offen: 10 } }), p => gestartet.push(p))
  box2.querySelector('button').dispatchEvent(new win.Event('click'))
  assert.deepEqual(gestartet, ['embed'])
  assert.equal(box2.querySelector('.fill').style.width, '0%')
})
