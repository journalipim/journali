// ⌨ Skripte (docs/pflegestruktur.md 37, 29.09.2026): das Formular steht im Skript, ▶ startet einen Lauf, und das
// Ergebnis ist eine Tabelle, ein Text oder eine Datei. Wer nur ausführen darf, sieht kein Quelltextfeld — aber den ▶.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, win } from './ui.mjs'
import { store } from '../src/store.js'
import { kopfLesen, paramsAus } from '../../plugins/scriptum/kopf.mjs'
import { beispiele } from '../../plugins/scriptum/beispiele.mjs'

const View = (await import('../../plugins/scriptum/src/View.vue')).default

const SKRIPT = {
  key: 'preise', label: 'Preise prüfen', role: 'editor', run: 'read', released: true, limit: 60,
  params: [{ key: 'root', label: 'Teilbaum', type: 'text', default: 'g1' }],
  source: "export const meta = { label: 'Preise prüfen', params: [{ key: 'root', label: 'Teilbaum', default: 'g1' }] }\nexport default async ({ out }) => out.text('ok')",
}

function welt({ rechte = ['read', 'scriptum.write', 'scriptum.run'], laeufe = [], skript = SKRIPT, drivers = [] } = {}) {
  store.actor = 'u1'; store.toasts = []; store.server = ''
  store.auth = { known: true, enabled: true, user: 'u1', role: 'admin', name: 'A', rights: rechte }
  const rufe = []
  let i = 0
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url); rufe.push({ pfad, opt })
    const json = opt.body ? JSON.parse(opt.body) : null
    let antwort = {}
    if (/\/api\/scriptum\/scripts$/.test(pfad)) antwort = [{ ...skript, source: undefined }]
    else if (/\/api\/scriptum\/scripts\/preise$/.test(pfad) && opt.method === 'PUT') antwort = { ...skript, ...json }
    else if (/\/api\/scriptum\/scripts\/preise$/.test(pfad)) antwort = skript
    else if (/\/api\/drivers(\?|$)/.test(pfad)) antwort = drivers
    else if (/\/run$/.test(pfad)) antwort = { job: 'scriptum_preise', run: 'r1' }
    else if (/\/api\/scriptum\/runs\//.test(pfad)) antwort = laeufe[Math.min(i++, laeufe.length - 1)] ?? { laeuft: false }
    else if (/\/api\/auth\/roles/.test(pfad)) antwort = [{ key: 'editor', label: 'PIM-Editor' }]
    else if (/\/api\/auth\/rights/.test(pfad)) antwort = [{ key: 'read', label: 'Lesen' }, { key: 'scriptum.run', label: 'Skripte ausführen' }]
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  const w = mount(View, { global: { stubs: { Splitter: true, ScriptEditor: true } } })
  return { w, rufe }
}
const warte = async (w, n = 6) => { for (let i = 0; i < n; i++) { await new Promise(r => setTimeout(r, 0)); await w.vm.$nextTick() } }

test('der Kopf des Skripts ist das Formular — gelesen wird nur der Ausdruck hinter meta', () => {
  const kopf = kopfLesen(SKRIPT.source)
  assert.equal(kopf.label, 'Preise prüfen')
  assert.deepEqual(paramsAus(kopf), [{ key: 'root', label: 'Teilbaum', type: null, default: 'g1' }])
  // ohne Kopf, mit kaputtem Kopf, mit fremdem Text: kein Formular, kein Absturz
  assert.equal(kopfLesen('export default () => 1'), null)
  assert.equal(kopfLesen('export const meta = { label: }'), null)
  assert.equal(kopfLesen('export const meta = { label: "x"'), null)
  assert.equal(kopfLesen(''), null)
  // geschachtelt und mit Klammern im Text
  assert.deepEqual(kopfLesen('export const meta = { a: { b: "}" }, c: 1 }\nexport default () => 1'), { a: { b: '}' }, c: 1 })
})

test('das Formular kommt aus dem Skript, mit den Vorgaben des Kopfs', async () => {
  const { w } = welt()
  await warte(w)
  const feld = w.find('input.param')
  assert.ok(feld.exists(), 'ein Feld je Parameter')
  assert.equal(feld.attributes('data-key'), 'root')
  assert.equal(feld.element.value, 'g1', 'die Vorgabe aus dem Kopf')
  assert.match(w.text(), /Teilbaum/)
})

test('▶ startet einen Lauf und zeigt danach die Tabelle', async () => {
  const { w, rufe } = welt({ laeufe: [
    { laeuft: true, log: 'Preise prüfen: 1 Parameter' },
    { laeuft: false, status: 'ok', exit: 0, log: 'Preise prüfen: 1 Parameter\nfertig in 0.2 s', ergebnis: { table: { columns: ['id', 'preis'], rows: [['p1', '9,90']] } } },
  ] })
  await warte(w)
  await w.find('input.param').setValue('g7')
  await w.find('button.start').trigger('click')
  await warte(w)
  const start = rufe.find(r => /\/run$/.test(r.pfad))
  assert.ok(start, 'der Lauf geht über die Job-Maschinerie')
  assert.deepEqual(JSON.parse(start.opt.body).params, { root: 'g7' }, 'die Werte des Formulars gehen mit')
  // der Stand wird gefragt, bis der Lauf fertig ist
  await new Promise(r => setTimeout(r, 900)); await warte(w)
  await new Promise(r => setTimeout(r, 900)); await warte(w)
  assert.ok(rufe.filter(r => /\/api\/scriptum\/runs\//.test(r.pfad)).length >= 2, 'nachgefragt wird, bis er fertig ist')
  const tabelle = w.find('table.tabelle')
  assert.ok(tabelle.exists(), 'das Ergebnis steht als Tabelle da')
  assert.deepEqual(tabelle.findAll('th').map(x => x.text()), ['id', 'preis'])
  assert.deepEqual(tabelle.findAll('td').map(x => x.text()), ['p1', '9,90'])
  assert.match(w.text(), /fertig in 0\.2 s/, 'das Protokoll des Laufs steht darunter')
})

test('ein Ergebnis als Text und eines als Datei', async () => {
  const { w } = welt({ laeufe: [{ laeuft: false, status: 'ok', ergebnis: { text: '42 Knoten geprüft' } }] })
  await warte(w)
  await w.find('button.start').trigger('click')
  await new Promise(r => setTimeout(r, 900)); await warte(w)
  assert.match(w.find('pre.text').text(), /42 Knoten geprüft/)

  const { w: w2 } = welt({ laeufe: [{ laeuft: false, status: 'ok', ergebnis: { file: 'liste.csv', bytes: 120 } }] })
  await warte(w2)
  await w2.find('button.start').trigger('click')
  await new Promise(r => setTimeout(r, 900)); await warte(w2)
  const link = w2.find('a.download')
  assert.ok(link.exists(), 'die Datei lässt sich holen')
  assert.equal(link.attributes('href'), '/api/scriptum/runs/scriptum_preise/r1/file?name=liste.csv')
  assert.equal(link.attributes('download'), 'liste.csv')
})

test('ohne das Schreibrecht: kein Quelltext, kein Anlegen — der ▶ bleibt', async () => {
  const { w, rufe } = welt({ rechte: ['read', 'scriptum.run'] })
  await warte(w)
  assert.equal(w.findAll('button.editor').length, 0, 'kein Quelltext-Knopf')
  assert.equal(w.findAll('button.x').length, 0, 'kein Entfernen')
  assert.equal(w.findAll('select.freigabe').length, 0, 'keine Freigabe, keine Rolle')
  assert.ok(w.find('button.start').exists(), 'anstossen darf er')
  assert.ok(!rufe.some(r => /\/api\/scriptum\/scripts\/preise$/.test(r.pfad)), 'der Quelltext wird gar nicht erst geholt')
})

test('speichern schreibt den Kopf als Parameter mit', async () => {
  const { w, rufe } = welt()
  await warte(w)
  await w.find('button.editor').trigger('click')
  await warte(w)
  await w.findComponent({ name: 'ScriptEditor' }).vm.$emit('save',
    "export const meta = { label: 'Neu', role: 'admin', params: [{ key: 'n', label: 'Anzahl', type: 'number', default: '5' }] }\nexport default () => 1")
  await warte(w)
  const put = rufe.filter(r => r.opt.method === 'PUT').at(-1)
  assert.ok(put, 'gespeichert')
  const leib = JSON.parse(put.opt.body)
  assert.equal(leib.label, 'Neu', 'die Bezeichnung kommt aus dem Kopf')
  assert.equal(leib.role, 'admin')
  assert.deepEqual(leib.params, [{ key: 'n', label: 'Anzahl', type: 'number', default: '5' }])
  assert.match(leib.source, /export default/)
})

test('ein Parameter vom Typ driver ist eine Auswahl eingerichteter Zugänge', async () => {
  const skript = { ...SKRIPT, params: [{ key: 'sys', label: 'System', type: 'driver', default: '' }] }
  const { w } = welt({ skript, drivers: [{ key: 'sap', label: 'ERP Prod' }, { key: 'frontify', label: 'Frontify' }] })
  await warte(w)
  const sel = w.find('select.param')
  assert.ok(sel.exists(), 'der driver-Parameter ist eine Auswahl, kein Textfeld')
  assert.equal(sel.attributes('data-key'), 'sys')
  const opts = sel.findAll('option').map(o => o.text())
  assert.ok(opts.includes('ERP Prod') && opts.includes('Frontify'), 'die eingerichteten Zugänge stehen zur Wahl')
})

test('der Editor bietet die Beispiele als Vorlagen (＋ Beispiel gehört in den Editor)', async () => {
  const { w } = welt()
  await warte(w)
  await w.find('button.editor').trigger('click')   // Quelltext-Editor öffnen
  await warte(w)
  const ed = w.findComponent({ name: 'ScriptEditor' })
  assert.ok(ed.exists(), 'der Editor ist offen')
  assert.equal(ed.props('templates').length, beispiele.length, 'alle Beispiele stehen im Editor als Vorlagen zur Wahl')
})
