// Ein Skript als Job (docs/pflegestruktur.md 37, 29.09.2026): der Tasker sieht scriptum wie jedes Prozess-Plugin.
// Das Skript ist der Parameter — und weil das Formular im Skript steht, stehen seine Parameter gleich darunter;
// ihre Werte gehen als arg_<key> an den Lauf.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win } from './ui.mjs'

const plugin = (await import('../../plugins/tasker/entry.js')).default
const mountView = plugin.views[0].mount

const SCRIPTUM = {
  key: 'scriptum', service: '', label: { de: 'Skripte' }, description: 'führt ein Skript aus',
  params: [
    { key: 'script', type: 'script', label: 'Skript (⌨ Skripte)' },
    { key: 'limit', type: 'number', label: 'Zeitgrenze des Laufs (Sekunden)', default: '60' },
  ],
}
const SKRIPTE = [
  { key: 'preise', label: 'Preise prüfen', params: [{ key: 'root', label: 'Teilbaum', type: 'text', default: 'g1' }, { key: 'tief', label: 'Tiefe', type: 'number', default: '3' }] },
  { key: 'leer', label: 'Ohne Parameter', params: [] },
]

let ende
test.afterEach(() => { ende?.(); ende = null })

async function oeffnen() {
  document.body.innerHTML = ''
  const rufe = []
  const antworten = { '/api/jobs': [], '/api/jobs/plugins': [SCRIPTUM], '/api/scriptum/scripts': SKRIPTE }
  const api = {
    get: async p => { rufe.push(['GET', p]); return antworten[p] ?? [] },
    post: async (p, body, m = 'POST') => { rufe.push([m, p, body]); return {} },
    del: async p => { rufe.push(['DELETE', p]); return {} },
  }
  const ctx = {
    api, store: { toast() {}, can: () => true, tarif: { schedules: true }, server: '' }, dialog: { confirm: async () => true },
    tree: { loaded: true, byId: new Map(), load: async () => {} },
    plugins: { active: () => true, list: [] }, treePicker() {}, filePicker() {},
  }
  const root = document.createElement('div'); document.body.append(root)
  ende = await mountView(root, ctx)
  await new Promise(r => setTimeout(r, 0))
  ;[...root.querySelectorAll('button')].find(b => b.textContent === '+ Job').dispatchEvent(new win.Event('click'))
  await new Promise(r => setTimeout(r, 0))
  const dlg = document.querySelector('.overlay')
  const seite = name => [...dlg.querySelectorAll('.view-chip')].find(c => c.textContent.startsWith(name)).dispatchEvent(new win.Event('click'))
  return { dlg, rufe, seite }
}
const setze = (feld, wert) => { feld.value = wert; feld.dispatchEvent(new win.Event('input')); feld.dispatchEvent(new win.Event('change')) }
const feldNach = (dlg, text) => [...dlg.querySelectorAll('label')].find(l => l.textContent.includes(text))?.nextElementSibling

test('der Parameter vom Typ script ist eine Auswahl der Skripte', async () => {
  const { dlg, rufe, seite } = await oeffnen()
  seite('②')
  assert.ok(rufe.some(r => r[1] === '/api/scriptum/scripts'), 'gefragt wird nach den Skripten')
  const sel = feldNach(dlg, 'Skript (⌨ Skripte)')
  assert.equal(sel.tagName, 'SELECT')
  assert.deepEqual([...sel.options].map(o => o.textContent), ['— kein Skript —', 'Preise prüfen', 'Ohne Parameter'])
})

test('das Formular steht im Skript: seine Parameter erscheinen unter der Auswahl und gehen als arg_<key> an den Job', async () => {
  const { dlg, rufe, seite } = await oeffnen()
  seite('②')
  const sel = feldNach(dlg, 'Skript (⌨ Skripte)')
  setze(sel, 'preise')
  const root = feldNach(dlg, 'Teilbaum'), tief = feldNach(dlg, 'Tiefe')
  assert.ok(root && tief, 'je Parameter ein Feld')
  assert.equal(root.value, 'g1', 'die Vorgabe aus dem Kopf des Skripts')
  assert.equal(tief.type, 'number')
  setze(root, 'g7')

  seite('①')
  setze(dlg.querySelector('input[placeholder^="key"]'), 'preislauf')
  ;[...dlg.querySelectorAll('button')].find(b => /Speichern/.test(b.textContent)).dispatchEvent(new win.Event('click'))
  await new Promise(r => setTimeout(r, 0))
  const put = rufe.find(r => r[0] === 'PUT' && r[1] === '/api/jobs/preislauf')
  assert.ok(put, 'gespeichert')
  assert.equal(put[2].params.script, 'preise')
  assert.equal(put[2].params.arg_root, 'g7')
  assert.equal(put[2].params.arg_tief, '3', 'auch die unveränderte Vorgabe steht am Job')
  assert.equal(put[2].params.limit, '60')
})

test('ein anderes Skript wechselt das Formular; ohne Parameter steht das da', async () => {
  const { dlg, seite } = await oeffnen()
  seite('②')
  const sel = feldNach(dlg, 'Skript (⌨ Skripte)')
  setze(sel, 'preise')
  assert.ok(feldNach(dlg, 'Teilbaum'))
  setze(sel, 'leer')
  assert.equal(feldNach(dlg, 'Teilbaum'), undefined, 'die Felder des anderen Skripts sind weg')
  assert.match(dlg.textContent, /Dieses Skript hat keine Parameter/)
})
