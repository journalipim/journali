// Datenqualität: die wählbaren Prüfregeln stehen nach Herkunft gruppiert da — die eingebauten, dann je Plugin —, als Gruppe und einzeln an- und abwählbar.
// Dazu: die Herkunft einer Regel ist das Plugin (vorher überschrieb der Schlüssel der Regel den des Plugins).
import test from 'node:test'
import assert from 'node:assert/strict'
import { flushPromises } from './ui.mjs'
import { plugins } from '../src/plugins.js'

const da = (await import('../../plugins/da/entry.js')).default
const ruhe = async () => { for (let i = 0; i < 4; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }

const regel = (key, label) => ({ key, label, severity: 'warn', run: () => [] })
const EMPCO = { label: { de: 'Werbeaussagen', en: 'Claims' }, checks: [regel('generic', 'Allgemeine Aussage'), regel('neutral', 'Klimaneutral')] }
const GEO = { label: { de: 'GEO-Texte (KI)', en: 'GEO texts' }, checks: ['short', 'definition', 'superlatives', 'nofacts', 'sameasname'].map(k => regel(k, 'GEO ' + k)) }

/// Die Regeln so, wie plugins.load() sie einsammelt: ohne Netz, die Module sind schon da
async function eingesammelt() {
  const eintrag = (key, mod) => ({ key, installed: true, enabled: true, onDisk: true, allowed: true, manifest: { label: mod.label, entry: 'entry.js' } })
  const module = { empco: EMPCO, geo: GEO }
  const liste = Object.entries(module).map(([k, m]) => eintrag(k, m))
  globalThis.fetch = async url => ({ ok: true, status: 200, text: async () => JSON.stringify(String(url) === '/api/plugins' ? liste : {}), json: async () => (String(url) === '/api/plugins' ? liste : {}) })
  plugins.modules.clear(); for (const [k, m] of Object.entries(module)) plugins.modules.set(k, m)
  plugins.installedSet = () => new Set(Object.keys(module))   // nichts mehr einzurichten
  await plugins.load()
  return plugins.checks
}

async function ansicht(gespeichert) {
  const checks = await eingesammelt()
  const gesetzt = []
  const rows = [{ id: 'g1', role: 'group', label: 'Alles', parent: null }]
  const ctx = {
    api: { get: async () => ({}) },
    store: { model: { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], lists: [] }, toast: () => {} },
    tree: { loaded: true, rows, byId: new Map(rows.map(r => [r.id, r])), load: async () => {} },
    treePicker: () => {}, checks,
    data: { get: async () => gespeichert, set: async (k, v) => { gesetzt.push([k, v]) } },
  }
  const root = document.createElement('div'); document.body.append(root)
  await da.views[0].mount(root, ctx); await ruhe()
  return { root, gesetzt }
}
const gruppen = root => [...root.querySelectorAll('.regelgruppe')]
const kopf = g => g.querySelector('label.gruppe')
const chips = g => [...g.querySelectorAll('label.chip:not(.gruppe)')]

test('die Herkunft einer Regel ist das Plugin, die Regel selbst steht in check', async () => {
  const checks = await eingesammelt()
  assert.deepEqual(checks.map(c => `${c.key}:${c.check}`), ['empco:generic', 'empco:neutral', 'geo:short', 'geo:definition', 'geo:superlatives', 'geo:nofacts', 'geo:sameasname'])
  assert.deepEqual(checks[0].quelle, EMPCO.label)
})

test('die Regeln stehen nach Herkunft gruppiert: eingebaute, dann je Plugin — mit der Zahl der gewählten', async () => {
  const { root } = await ansicht(null)
  const g = gruppen(root)
  assert.deepEqual(g.map(x => `${kopf(x).querySelector('span').textContent} ${kopf(x).lastChild.textContent}`), ['Datenqualität 10/10', 'Werbeaussagen 0/2', 'GEO-Texte (KI) 0/5'])
  assert.deepEqual(g.map(x => chips(x).length), [10, 2, 5])
})

test('eine Gruppe lässt sich als Ganzes an- und abwählen; die Auswahl geht ins Journal', async () => {
  const { root, gesetzt } = await ansicht(null)
  const geo = gruppen(root)[2]; const cb = kopf(geo).querySelector('input')
  cb.click(); await ruhe()
  assert.equal(chips(geo).every(c => c.querySelector('input').checked), true)
  assert.match(kopf(geo).textContent, /5\/5/)
  assert.deepEqual(gesetzt.at(-1)[1].rules.filter(k => k.startsWith('geo:')), ['geo:short', 'geo:definition', 'geo:superlatives', 'geo:nofacts', 'geo:sameasname'])
  cb.click(); await ruhe()
  assert.equal(gesetzt.at(-1)[1].rules.some(k => k.startsWith('geo:')), false)
  assert.equal(gruppen(root)[0].querySelectorAll('input:checked').length, 11, 'die anderen Gruppen bleiben, wie sie sind (Kopf und 10 Regeln)')
})

test('einzeln wählen: die Gruppe zeigt „teils“ (unbestimmt) und zählt mit', async () => {
  const { root, gesetzt } = await ansicht(null)
  const emp = gruppen(root)[1]; const erste = chips(emp)[0].querySelector('input')
  erste.click(); await ruhe()
  const gcb = kopf(emp).querySelector('input')
  assert.equal(gcb.indeterminate, true); assert.equal(gcb.checked, false)
  assert.match(kopf(emp).textContent, /1\/2/)
  assert.ok(gesetzt.at(-1)[1].rules.includes('empco:generic'))
  const zweite = chips(emp)[1].querySelector('input'); zweite.click(); await ruhe()
  assert.equal(gcb.checked, true); assert.equal(gcb.indeterminate, false)
})

test('eine frühere Auswahl unter dem Schlüssel der Regel gilt unter dem des Plugins weiter', async () => {
  const { root } = await ansicht({ rules: ['required', 'generic:generic', 'sameasname:sameasname'] })
  const g = gruppen(root)
  assert.equal(chips(g[1])[0].querySelector('input').checked, true, 'empco:generic')
  assert.equal(chips(g[2])[4].querySelector('input').checked, true, 'geo:sameasname')
  assert.equal(chips(g[2])[0].querySelector('input').checked, false)
})
