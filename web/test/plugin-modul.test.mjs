// Welches Plugin bringt ein Modul für die Oberfläche mit (29.09.2026)? Das sagt sein `entry`, nicht `runs`: runs
// nennt, wo die Arbeit geschieht. Bis dahin lud die Oberfläche nur Module von Plugins mit `runs: browser` — und
// verschluckte damit stillschweigend die Beiträge der anderen (das Band „≈ Ähnliche Knoten“ von embed, die Ansicht
// von scriptum). Der Fall gehört für immer in einen Prüfstand.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import './ui.mjs'   // die Oberfläche braucht ein Fenster (store.js liest localStorage)
import { ladbar } from '../src/plugins.js'

const DIR = path.resolve(import.meta.dirname, '../../plugins')
const manifeste = fs.readdirSync(DIR)
  .map(key => ({ key, datei: path.join(DIR, key, 'plugin.json') }))
  .filter(x => fs.existsSync(x.datei))
  .map(x => ({ ...x, m: JSON.parse(fs.readFileSync(x.datei, 'utf8')) }))

test('geladen wird, was ein Modul nennt — gleich, wo die Arbeit geschieht', () => {
  assert.equal(ladbar({ runs: 'browser', entry: 'entry.js' }), true)
  assert.equal(ladbar({ runs: 'process', entry: 'entry.js' }), true, 'ein Prozess-Plugin darf ein Band oder eine Ansicht mitbringen')
  assert.equal(ladbar({ runs: 'office', entry: 'taskpane.html' }), false, 'ein Add-in zeigt auf eine Seite, nicht auf ein Modul')
  assert.equal(ladbar({ runs: 'process' }), false)
  assert.equal(ladbar({}), false)
  assert.equal(ladbar(null), false)
})

test('jedes Plugin mit einer Oberfläche wird auch geladen', () => {
  const stumm = manifeste.filter(x => fs.existsSync(path.join(DIR, x.key, 'src', 'entry.js')) && !ladbar(x.m))
  assert.deepEqual(stumm.map(x => x.key), [], 'ein gebautes Oberflächenmodul, das die Oberfläche nie lädt')
})

test('jedes Plugin, dessen Modul etwas beiträgt, wird geladen — auch ein Prozess-Plugin', async () => {
  const stumm = []
  for (const { key, m } of manifeste) {
    if (!m.entry?.endsWith('.js')) continue
    if (fs.existsSync(path.join(DIR, key, 'src', 'entry.js'))) continue   // gebaut: lädt nur im Browser, oben geprüft
    let mod
    try { mod = (await import(path.join(DIR, key, m.entry))).default ?? {} } catch { continue }
    const beitraege = ['views', 'nodeActions', 'importers', 'checks', 'nodeBands', 'nodeViews'].filter(k => (mod[k] ?? []).length)
    if (beitraege.length && !ladbar(m)) stumm.push(`${key}: ${beitraege.join(', ')}`)
  }
  assert.deepEqual(stumm, [], 'Beiträge, die nie in der Oberfläche ankommen')
})

test('scriptum bringt seine Ansicht mit und läuft als Prozess', () => {
  const s = manifeste.find(x => x.key === 'scriptum')
  assert.ok(s, 'das Plugin liegt im Repo')
  assert.equal(s.m.runs, 'process', 'ein Skript läuft als Kindprozess, nicht im Browser')
  assert.ok(ladbar(s.m), 'seine Ansicht wird trotzdem geladen')
  assert.ok(s.m.process?.args?.includes('runner.mjs'), 'und der Runner steht im Manifest')
  assert.deepEqual(s.m.requires, ['tasker'], 'gelaufen wird über die Job-Maschinerie')
})
