// ⚑ Workflows, Einstellungen: „gilt für“ mit ▩ Asset (27.09.2026). Eine leere Liste heisst „alle Pflegeknoten“ — nicht
// „auch jedes Bild“. Wer Assets dazunimmt, behält darum die Knoten; wer sie wieder abhakt, hat den Workflow ohne
// Medien. Gespeichert wird die Liste, wie sie steht.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'

const WorkflowSettings = (await import('../src/components/WorkflowSettings.vue')).default

const WF = (roles = null) => ({
  key: 'bild', label: { de: 'Bildfreigabe' }, start: 'draft', roles, families: null, perLocale: false,
  states: [{ key: 'draft', label: { de: 'Entwurf' }, color: 'muted' }, { key: 'ok', label: { de: 'freigegeben' }, color: 'pos', final: true }],
  transitions: [{ key: 'release', label: { de: 'freigeben' }, from: 'draft', to: 'ok', roles: [], effects: [] }],
})

function welt(wf) {
  store.actor = 'u1'; store.toasts = []
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], channels: [], statuses: [] }
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url); rufe.push({ pfad, methode: opt.method ?? 'GET', body: opt.body ? JSON.parse(opt.body) : null })
    const antwort = pfad.endsWith('/api/workflows') ? [wf] : pfad.includes('/api/auth/roles') ? [{ key: 'admin' }] : pfad.endsWith('/api/jobs') ? [{ key: 'export_web', label: 'Export Web' }] : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}
const haken = (w, key) => w.findAll('label').find(l => l.attributes('title') === key || (key === 'media' && l.text().includes('Asset'))).find('input')

test('nichts angehakt = alle Knoten, aber kein Asset', async () => {
  welt(WF(null))
  const w = mount(WorkflowSettings); await flushPromises()
  assert.equal(haken(w, 'product').element.checked, true)
  assert.equal(haken(w, 'media').element.checked, false, 'Assets gelten nur ausdrücklich')
})

test('Asset dazu: die Knoten bleiben, gespeichert wird die volle Liste', async () => {
  const rufe = welt(WF(null))
  const w = mount(WorkflowSettings); await flushPromises()
  await haken(w, 'media').setValue(true); await flushPromises()
  assert.equal(haken(w, 'media').element.checked, true)
  assert.equal(haken(w, 'group').element.checked, true, 'die Knoten fallen nicht heraus')
  await w.findAll('button').find(b => /Speichern/.test(b.text())).trigger('click'); await flushPromises()
  const put = rufe.find(r => r.methode === 'PUT' && /\/api\/workflows\/bild$/.test(r.pfad))
  assert.ok(put, 'gespeichert')
  assert.deepEqual([...put.body.roles].sort(), ['group', 'media', 'product', 'variant'])
})

test('Asset wieder weg: der Rest bleibt', async () => {
  const rufe = welt(WF(['product', 'media']))
  const w = mount(WorkflowSettings); await flushPromises()
  assert.equal(haken(w, 'media').element.checked, true)
  assert.equal(haken(w, 'group').element.checked, false)
  await haken(w, 'media').setValue(false); await flushPromises()
  await w.findAll('button').find(b => /Speichern/.test(b.text())).trigger('click'); await flushPromises()
  assert.deepEqual(rufe.find(r => r.methode === 'PUT').body.roles, ['product'])
})

/// Die Brücke zu Import und Export (34 I): ein Übergang darf einen Job des Tasker anstossen — gewählt aus den Jobs, gespeichert am Übergang.
test('ein Übergang bekommt einen Job aus dem Tasker; gespeichert wird sein Schlüssel', async () => {
  const rufe = welt(WF(null))
  const w = mount(WorkflowSettings); await flushPromises()
  const zeile = w.findAll('tbody tr').find(tr => tr.find('input.mono')?.element.value === 'release')
  const auswahl = zeile.findAll('select').at(-1)
  assert.ok(auswahl.findAll('option').some(o => o.text() === 'Export Web'), 'die Jobs des Tasker stehen zur Wahl')
  await auswahl.setValue('export_web'); await flushPromises()
  await w.findAll('button').find(b => /Speichern/.test(b.text())).trigger('click'); await flushPromises()
  const put = rufe.find(r => r.methode === 'PUT' && /\/api\/workflows\/bild$/.test(r.pfad))
  assert.equal(put.body.transitions[0].job, 'export_web')
  // ohne Wahl bleibt es null — kein leerer Text am Übergang
  await auswahl.setValue(''); await flushPromises()
  await w.findAll('button').find(b => /Speichern/.test(b.text())).trigger('click'); await flushPromises()
  assert.equal(rufe.filter(r => r.methode === 'PUT').at(-1).body.transitions[0].job, null)
})
