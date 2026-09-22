// Workflow je Sprache in der Knotenansicht (Taloan, 22.09.2026: „Französisch in Korrektur, Deutsch freigegeben“).
// Geprüft wird die Leiste selbst: eine Zeile je Sprache, der eigene Zustand, die erlaubten Schritte — und dass ein Klick
// die Sprache mitschickt (sonst geht der Schritt an den ganzen Knoten und reisst die anderen Sprachen mit).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, textOf } from './ui.mjs'

const WorkflowLocales = (await import('../src/components/WorkflowLocales.vue')).default

const wf = {
  workflow: 'translation', label: { de: 'Übersetzung' }, perLocale: true, state: 'none',
  locales: [
    { locale: 'de', master: true, state: 'checked', stateLabel: { de: 'geprüft' }, color: 'pos', own: true, since: '2026-09-22T08:00:00Z', actor: 'taloan', transitions: [{ key: 'again', label: { de: 'erneut zur Übersetzung' }, to: 'to_translate', toLabel: { de: 'zur Übersetzung' } }] },
    { locale: 'fr', master: false, state: 'to_translate', stateLabel: { de: 'zur Übersetzung' }, color: 'warn', own: true, note: 'Agentur', transitions: [{ key: 'done', label: { de: 'übersetzt' }, to: 'translated', toLabel: { de: 'übersetzt' } }] },
    { locale: 'en', master: false, state: 'none', stateLabel: { de: 'nicht angefordert' }, color: 'muted', own: false, transitions: [{ key: 'request', label: { de: 'zur Übersetzung geben' }, to: 'to_translate', toLabel: { de: 'zur Übersetzung' } }] },
  ],
}

test('je Sprache eine Zeile mit eigenem Zustand', () => {
  const w = mount(WorkflowLocales, { props: { wf } })
  const rows = w.findAll('.wf-loc')
  assert.equal(rows.length, 3, 'drei Sprachen, drei Zeilen')
  assert.match(rows[0].text(), /★ de/, 'die Mastersprache ist gekennzeichnet')
  assert.match(rows[0].text(), /geprüft/)
  assert.match(rows[1].text(), /zur Übersetzung/, 'Französisch steht woanders als Deutsch')
  assert.match(rows[2].text(), /nicht angefordert/)
  // die Sprache ohne eigenen Zustand zeigt, dass sie vom Knoten kommt, und hat kein ↑ zum Aufheben
  assert.match(rows[2].text(), /↑/, 'geerbter Zustand ist als solcher zu sehen')
  assert.equal(rows[2].findAll('button').filter(b => b.text() === '↑').length, 0, 'ohne eigenen Zustand gibt es nichts aufzuheben')
  assert.equal(rows[1].findAll('button').filter(b => b.text() === '↑').length, 1, 'mit eigenem Zustand schon')
  w.unmount()
})

test('ein Schritt geht mit seiner Sprache hinaus, nicht an den ganzen Knoten', async () => {
  const w = mount(WorkflowLocales, { props: { wf } })
  const frRow = w.findAll('.wf-loc')[1]
  await frRow.findAll('button').find(b => b.text().includes('übersetzt')).trigger('click')
  const ev = w.emitted('step')
  assert.ok(ev, 'ein Klick meldet einen Schritt')
  assert.equal(ev[0][0], 'fr', 'und zwar für Französisch')
  assert.equal(ev[0][1].key, 'done')
  // Aufheben meldet ebenfalls die Sprache
  await frRow.findAll('button').find(b => b.text() === '↑').trigger('click')
  assert.equal(w.emitted('clear')[0][0], 'fr')
  w.unmount()
})

test('gesperrte Schritte sind zu sehen und nicht zu klicken', async () => {
  const blocked = { ...wf, locales: [{ ...wf.locales[1], transitions: [{ key: 'done', label: { de: 'übersetzt' }, to: 'translated', blocked: 'Pflichtwerte fehlen' }] }] }
  const w = mount(WorkflowLocales, { props: { wf: blocked } })
  const b = w.findAll('button').find(x => x.text().includes('übersetzt'))
  assert.match(b.text(), /⊘/, 'gesperrt ist als Symbol zu sehen')
  assert.ok(b.attributes('disabled') !== undefined, 'und nicht zu klicken')
  await b.trigger('click')
  assert.equal(w.emitted('step'), undefined)
  w.unmount()
})

test('ohne Sprachen im Workflow bleibt die Leiste leer (kein Absturz)', () => {
  const w = mount(WorkflowLocales, { props: { wf: { workflow: 'review', perLocale: false } } })
  assert.equal(textOf(w), '')
  w.unmount()
})
