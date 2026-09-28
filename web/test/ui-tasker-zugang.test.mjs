// Der Job-Dialog mit Zugängen (28.09.2026): ein Parameter vom Typ driver wird eine Auswahl der Zugänge seiner Art,
// und die Fächer können an einem Zugang liegen — Eingang von, Ausgabe nach. Der Dialog wird wirklich geöffnet,
// gewählt und gespeichert; geprüft wird, was beim Server ankommt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win } from './ui.mjs'

const plugin = (await import('../../plugins/tasker/entry.js')).default
const mountView = plugin.views[0].mount

const QUELLE = {
  key: 'quelle', service: '', label: { de: 'Quelle lesen' }, description: 'liest eine Quelle',
  params: [{ key: 'zugang', type: 'driver', art: 'ixp', label: 'Zugang zur Quelle' }, { key: 'tief', type: 'boolean', label: 'tief' }],
  files: { in: { pattern: '*.csv', mode: 'one' }, out: { many: true } },
}

let ende
test.afterEach(() => { ende?.(); ende = null })

async function oeffnen() {
  document.body.innerHTML = ''
  const rufe = []
  const antworten = {
    '/api/jobs': [], '/api/jobs/plugins': [QUELLE],
    '/api/drivers?art=ixp': [{ key: 'ixp_live', art: 'ixp', label: 'IXP Live' }],
    '/api/drivers?dateien=true': [{ key: 'lokal', art: 'file', label: '⌂ Dieser Server' }, { key: 'ablage', art: 'webdav', label: 'WebDAV Ablage' }],
  }
  const api = {
    get: async p => { rufe.push(['GET', p]); return antworten[p] ?? [] },
    post: async (p, body, m = 'POST') => { rufe.push([m, p, body]); return {} },
    del: async p => { rufe.push(['DELETE', p]); return {} },
  }
  const gepickt = []
  const ctx = {
    api, store: { toast() {}, can: () => true, tarif: { schedules: true }, server: '' }, dialog: { confirm: async () => true },
    tree: { loaded: true, byId: new Map(), load: async () => {} },
    plugins: { active: () => true, list: [] }, treePicker() {}, filePicker: opt => gepickt.push(opt),
  }
  const root = document.createElement('div'); document.body.append(root)
  ende = await mountView(root, ctx)
  await new Promise(r => setTimeout(r, 0))
  ;[...root.querySelectorAll('button')].find(b => b.textContent === '+ Job').dispatchEvent(new win.Event('click'))
  await new Promise(r => setTimeout(r, 0))
  const dlg = document.querySelector('.overlay')
  return { dlg, rufe, gepickt }
}
const seite = (dlg, name) => [...dlg.querySelectorAll('.view-chip')].find(c => c.textContent.startsWith(name)).dispatchEvent(new win.Event('click'))
const setze = (feld, wert) => { feld.value = wert; feld.dispatchEvent(new win.Event('input')); feld.dispatchEvent(new win.Event('change')) }

test('ein Parameter vom Typ driver ist eine Auswahl der Zugänge seiner Art', async () => {
  const { dlg, rufe } = await oeffnen()
  assert.ok(dlg, 'der Dialog ist offen')
  assert.ok(rufe.some(r => r[1] === '/api/drivers?art=ixp'), 'gefragt wird nur nach Zugängen der Art ixp')
  seite(dlg, '②')
  const label = [...dlg.querySelectorAll('label')].find(l => l.textContent.includes('Zugang zur Quelle'))
  assert.ok(label, 'der Parameter steht im Dialog')
  const sel = label.nextElementSibling
  assert.equal(sel.tagName, 'SELECT')
  assert.deepEqual([...sel.options].map(o => o.textContent), ['— kein Zugang —', 'IXP Live'])
})

test('Eingang und Ausgabe an einem Zugang: nur Zugänge, die Dateien liefern — und gespeichert wird, was gewählt ist', async () => {
  const { dlg, rufe, gepickt } = await oeffnen()
  const keyIn = dlg.querySelector('input[placeholder^="key"]')
  seite(dlg, '③')
  const zeilen = [...dlg.querySelectorAll('.zugang-zeile')]
  assert.equal(zeilen.length, 2)
  const [ein, aus] = zeilen
  assert.match(ein.textContent, /Eingang von/); assert.match(aus.textContent, /Ausgabe nach/)
  const einSel = ein.querySelector('select')
  assert.deepEqual([...einSel.options].map(o => o.textContent), ['— nur das Fach —', 'WebDAV Ablage'], 'das Dateisystem des Servers ist die Basis, kein Zugang')
  assert.ok(ein.querySelector('input').disabled, 'ohne Zugang kein Pfad')
  setze(einSel, 'ablage')
  assert.equal(ein.querySelector('input').disabled, false)
  // 📁 blättert im Zugang, nicht auf dem Server
  ein.querySelector('button').dispatchEvent(new win.Event('click'))
  assert.equal(gepickt.at(-1).zugang, 'ablage')
  setze(ein.querySelector('input'), '/eingang')

  setze(keyIn, 'preise')
  seite(dlg, '②')
  const zugang = [...dlg.querySelectorAll('label')].find(l => l.textContent.includes('Zugang zur Quelle')).nextElementSibling
  setze(zugang, 'ixp_live')
  const speichern = [...dlg.querySelectorAll('button')].find(b => /Speichern/.test(b.textContent))
  speichern.dispatchEvent(new win.Event('click'))
  await new Promise(r => setTimeout(r, 0))
  const put = rufe.find(r => r[0] === 'PUT' && r[1] === '/api/jobs/preise')
  assert.ok(put, 'gespeichert')
  assert.equal(put[2].params.zugang, 'ixp_live')
  assert.deepEqual({ inZugang: put[2].files.inZugang, inPfad: put[2].files.inPfad, outZugang: put[2].files.outZugang, outPfad: put[2].files.outPfad },
    { inZugang: 'ablage', inPfad: '/eingang', outZugang: null, outPfad: null })
})
