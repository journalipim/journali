// Der Balken der Systemjobs im Tasker (27.09.2026): probe, embed und derive stehen immer da — mit Füllstand
// (erledigt von gesamt), den Zahlen und ▶ zum Nachholen, auch ohne angelegten Job. Echtes DOM, gefälschte Antworten.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win } from './ui.mjs'
import { systemRows, systemBlock } from '../../plugins/tasker/entry.js'

const PLUGINS = [
  { key: 'probe', service: '', label: { de: 'Bildabmessungen lesen' }, system: true, progress: '/api/media/probe' },
  { key: 'embed', service: '', label: { de: 'Einbettungen (Vektoren)' }, system: true, progress: '/api/docs/embed' },
  { key: 'csv', service: 'export', label: { de: 'CSV' }, system: false, progress: null },
  { key: 'csv', service: 'import', label: { de: 'CSV' }, system: false, progress: null },
]
const JOBS = [{ key: 'probe', plugin: 'probe', label: 'Bildabmessungen', running: true, enabled: true }]
const PROGRESS = { probe: { total: 200, gelesen: 150, offen: 50 }, embed: { ready: false, reason: 'Erweiterung vector fehlt in dieser Datenbank.' } }

test('je Systemjob eine Zeile — mit Fortschritt, Job und Prozentzahl; Dienste zählen einmal', () => {
  const rows = systemRows(PLUGINS, JOBS, PROGRESS)
  assert.deepEqual(rows.map(r => r.plugin), ['probe', 'embed'], 'csv ist kein Systemjob, und probe steht einmal')
  const probe = rows[0]
  assert.deepEqual([probe.gelesen, probe.total, probe.offen, probe.pct], [150, 200, 50, 75])
  assert.equal(probe.job?.running, true)
  assert.equal(probe.label, 'Bildabmessungen lesen')
  const embed = rows[1]
  assert.equal(embed.ready, false); assert.equal(embed.pct, null); assert.equal(embed.job, null)
})

test('ohne Antwort des Endpunkts steht die Zeile trotzdem da', () => {
  const [r] = systemRows(PLUGINS.slice(0, 1), [], {})
  assert.equal(r.progress, null); assert.equal(r.ready, null); assert.equal(r.pct, null)
})

// Kacheln statt Zeilen (28.09.2026): die Systemjobs stehen oben in ihrer eigenen Fläche, mit Fortschritt und
// Steuerung; die Liste darunter gehört den Jobs, die jemand selbst angelegt hat.
test('die Kacheln: Füllstand, Zahlen, und je nach Lauf starten oder anhalten', () => {
  const gestartet = [], angehalten = [], geschaltet = []
  const box = systemBlock(systemRows(PLUGINS, JOBS, PROGRESS), p => gestartet.push(p), { pause: j => angehalten.push(j.key), toggle: j => geschaltet.push(j.key) })
  const kacheln = box.querySelectorAll('.sys-kachel')
  assert.equal(kacheln.length, 2)
  assert.equal(kacheln[0].querySelector('.fill').style.width, '75%', 'der Balken füllt sich mit dem Erledigten')
  assert.match(kacheln[0].textContent, /150 \/ 200/); assert.match(kacheln[0].textContent, /50 offen/)
  assert.ok(kacheln[0].classList.contains('laeuft'), 'ein laufender Systemjob ist zu sehen')

  // erster Knopf: läuft der Job von selbst? Danach ⏸ (er läuft gerade) und ⊘
  const knoepfe = kacheln[0].querySelectorAll('.tun button')
  assert.equal(knoepfe[0].textContent, '●', 'der Schalter fehlt')
  knoepfe[0].dispatchEvent(new win.Event('click'))
  assert.deepEqual(geschaltet, ['probe'])
  assert.equal(knoepfe[1].textContent, '⏸')
  knoepfe[1].dispatchEvent(new win.Event('click'))
  assert.deepEqual(angehalten, ['probe'])

  // embed: nicht bereit, der Grund im Tooltip, ▶ gesperrt
  assert.match(kacheln[1].textContent, /nicht bereit/)
  assert.match(kacheln[1].querySelector('span[title]').getAttribute('title'), /vector fehlt/)
  assert.ok(kacheln[1].querySelector('.tun button').disabled)

  // ein bereiter ohne Job: ▶ ruft mit dem Plugin
  const box2 = systemBlock(systemRows(PLUGINS.slice(1, 2), [], { embed: { ready: true, total: 10, gelesen: 0, offen: 10 } }), p => gestartet.push(p))
  box2.querySelector('.tun button').dispatchEvent(new win.Event('click'))   // ohne Job gibt es keinen Schalter: der erste Knopf ist ▶
  assert.deepEqual(gestartet, ['embed'])
  assert.equal(box2.querySelector('.fill').style.width, '0%')
})

// Abbrechen eines Systemjobs ist Anhalten (27.09.2026): die offenen Posten bleiben offen, der Text sagt es
import { abbruchText } from '../../plugins/tasker/entry.js'
test('bei einem Systemjob heisst Abbrechen anhalten bis zum nächsten Start', () => {
  const plugins = [{ key: 'probe', system: true }, { key: 'csv', system: false }]
  const s = abbruchText({ plugin: 'probe', label: 'Masse' }, plugins)
  assert.match(s.title, /anhalten bis zum nächsten Start/); assert.match(s.toast, /Masse angehalten/)
  const n = abbruchText({ plugin: 'csv', label: 'Export' }, plugins)
  assert.equal(n.title, 'abbrechen'); assert.match(n.toast, /Export abgebrochen/)
})

// 28.09.2026 gemeldet: „wenn nichts mehr offen ist, wieso ist der Balken dann nicht bei 100 %?“ — bei den
// Bildabmessungen zählt `gelesen` nur die mit Abmessungen; die 748 ohne bekanntes Format sind aber auch abgearbeitet.
test('der Balken zeigt, was erledigt ist — nicht nur, was etwas ergeben hat', () => {
  const plugins = [{ key: 'probe', service: '', label: { de: 'Bildabmessungen lesen' }, system: true, progress: '/api/media/probe' }]
  const [r] = systemRows(plugins, [], { probe: { ready: true, total: 939, gelesen: 191, offen: 0 } })
  assert.equal(r.pct, 100, 'nichts offen heisst fertig')
  assert.equal(r.gelesen, 939)

  const [halb] = systemRows(plugins, [], { probe: { ready: true, total: 1000, gelesen: 100, offen: 400 } })
  assert.equal(halb.pct, 60, '600 von 1000 sind abgearbeitet')
})

// 03.10.2026: die Systemjobs steuert nur der Hauptserver — auf einem anderen Server zeigt die Kachel Stand und Protokoll, keine Schalter
test('auf einem Arbeitsserver: kein ▶, kein ⏸, kein ⊘, an/aus nur als Zustand, ☰ bleibt', () => {
  const PL = [{ key: 'embed', system: true, steuerbar: false, haupt: 'Unraid', label: { de: 'Einbettungen' }, progress: '/api/docs/embed' }]
  const job = { key: 'embed', plugin: 'embed', enabled: true, running: 'r1', paused: false }
  const gerufen = []
  const box = systemBlock(systemRows(PL, [job], { embed: { ready: true, total: 10, gelesen: 5, offen: 5 } }), p => gerufen.push(p),
    { pause: () => gerufen.push('pause'), cancel: () => gerufen.push('cancel'), toggle: () => gerufen.push('toggle'), open: () => gerufen.push('open') })
  const kachel = box.querySelector('.sys-kachel')
  const knoepfe = [...kachel.querySelectorAll('button')].map(b => b.textContent)
  assert.deepEqual(knoepfe, ['☰'], 'nur das Protokoll ist ein Knopf')
  const zustand = [...kachel.querySelectorAll('.tun span')].filter(s => s.textContent).map(s => [s.textContent, s.title])
  assert.deepEqual(zustand, [['●', 'gesteuert auf dem Hauptserver Unraid'], ['▶', 'läuft · gesteuert auf dem Hauptserver Unraid']])
  const steuerbar = systemRows([{ ...PL[0], steuerbar: true }], [job], {})[0]
  assert.equal(steuerbar.steuerbar, true)
  assert.equal(systemRows([{ key: 'probe', system: true }], [], {})[0].steuerbar, true, 'ohne Angabe: steuerbar (ein Server allein)')
})
