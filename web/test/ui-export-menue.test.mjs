// Nach dem Plugin-Umbau (Art „io“, ein Format ein Plugin) fehlten drei Wege in der Oberfläche (28.09.2026):
// der Excel-Export war aus dem Kontextmenü nicht mehr erreichbar (der eine Eintrag traf immer CSV), die JSON-Ansicht
// blieb beim Umschalten leer, und der per Rechtsklick vorbelegte Knoten war im Auswahlbaum nicht zu sehen.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { mount, flushPromises } from '@vue/test-utils'
import { h } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import { plugins } from '../src/plugins.js'
import { tree } from '../src/tree.js'

const BAUM = [
  { id: 'w', parent: null, label: 'Mastertree', role: 'group' },
  { id: 'g-1', parent: 'w', label: 'Vorschaltgeräte', role: 'group' },
  { id: 'g-11', parent: 'g-1', label: 'Konventionelle', role: 'group' },
  { id: 'p-1', parent: 'g-11', label: 'Ein Produkt', role: 'product' },
]
function baum() {
  tree.rows = BAUM
  tree.byId = new Map(BAUM.map(r => [r.id, r]))
  tree.children = new Map()
  for (const r of BAUM) { const k = r.parent ?? ''; if (!tree.children.has(k)) tree.children.set(k, []); tree.children.get(k).push(r) }
  tree.loaded = true
  tree.load = async () => {}
}
const an = keys => { plugins.list = keys.map(key => ({ key, installed: true, enabled: true, allowed: true, onDisk: true, manifest: {} })) }

// ── Kontextmenü: je Format ein Eintrag ──────────────────────────────────────────────────────────────────────

/// Die Einträge, die das Kontextmenü an diesem Knoten zeigen würde — dieselbe Auswahl wie in TreeView
const eintraege = (mod, row) => (mod.nodeActions ?? [])
  .filter(a => !a.roles || a.roles.includes(row.role))
  .map(a => ({ ...a, _label: typeof a.label === 'function' ? a.label(row, 148) : a.label }))
  .filter(a => a._label)

test('an einer Gruppe stehen Excel und CSV je als eigener Eintrag', async () => {
  baum(); an(['table', 'csv', 'excel'])
  const mod = (await import('../../plugins/table/src/entry.js')).default
  const labels = eintraege(mod, { id: 'g-11', role: 'group' }).map(a => a._label)
  assert.ok(labels.some(l => l.startsWith('Excel: Teilbaum')), `Excel fehlt — da sind: ${labels.join(' | ')}`)
  assert.ok(labels.some(l => l.startsWith('CSV: Teilbaum')), `CSV fehlt — da sind: ${labels.join(' | ')}`)
})

test('jeder Eintrag führt auf die Kachel seines Formats — nicht beide auf dieselbe', async () => {
  baum(); an(['table', 'csv', 'excel'])
  const mod = (await import('../../plugins/table/src/entry.js')).default
  const wege = []
  for (const a of eintraege(mod, { id: 'g-11', role: 'group' })) {
    if (!a._label.includes('Teilbaum exportieren')) continue
    a.run('g-11', { go: p => wege.push([a._label.split(':')[0], p]) })
  }
  assert.deepEqual(wege, [['Excel', '/p/table/export-xlsx?node=g-11'], ['CSV', '/p/table/export?node=g-11']])
})

test('ist ein Format-Plugin aus, fehlt sein Eintrag', async () => {
  baum(); an(['table', 'csv'])
  const mod = (await import('../../plugins/table/src/entry.js')).default
  const labels = eintraege(mod, { id: 'g-11', role: 'group' }).map(a => a._label)
  assert.ok(!labels.some(l => l.startsWith('Excel:')), `Excel ist aus, steht aber da: ${labels.join(' | ')}`)
  assert.ok(labels.some(l => l.startsWith('CSV: Teilbaum')))
})

test('die JSON-Aktion nennt ihr Thema — die Art „io“ tut es nicht', async () => {
  const mod = (await import('../../plugins/json/entry.js')).default
  for (const a of mod.nodeActions ?? []) assert.equal(a.topic, 'export', `${a.icon}: ohne topic landet der Eintrag unter ⌁ Werkzeuge`)
})

// ── Auswahlbaum: der vorbelegte Knoten ist zu sehen ──────────────────────────────────────────────────────────

test('ein angehakter Knoten ist sichtbar — der Baum klappt bis zu ihm auf', async () => {
  baum()
  const TreePicker = (await import('../src/components/TreePicker.vue')).default
  const w = mount(TreePicker, { props: { modelValue: ['g-11'], multi: true } })
  await flushPromises()
  const zeilen = [...w.element.querySelectorAll('.pick')].map(e => e.textContent.replace(/\s+/g, ' ').trim())
  assert.ok(zeilen.some(z => z.includes('Konventionelle')), `nicht aufgeklappt — zu sehen ist nur: ${zeilen.join(' | ')}`)
  const haken = [...w.element.querySelectorAll('input[type=checkbox]')].filter(c => c.checked)
  assert.equal(haken.length, 1, 'der gewählte Knoten trägt den Haken — was darunter liegt, bleibt zugeklappt')
})

test('ohne Auswahl bleibt der Baum bei den Wurzeln', async () => {
  baum()
  const TreePicker = (await import('../src/components/TreePicker.vue')).default
  const w = mount(TreePicker, { props: { modelValue: [], multi: true } })
  await flushPromises()
  const zeilen = [...w.element.querySelectorAll('.pick')].map(e => e.textContent.replace(/\s+/g, ' ').trim())
  assert.ok(!zeilen.some(z => z.includes('Konventionelle')), 'nichts gewählt — dann klappt auch nichts auf')
})

// ── Umschalten zwischen den Reitern ─────────────────────────────────────────────────────────────────────────

async function fenster(views) {
  baum()
  plugins.loaded = true
  plugins.views = views
  plugins.ctx = () => ({})
  const PluginHost = (await import('../src/views/PluginHost.vue')).default
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/p/:key/:path', component: PluginHost }] })
  router.push('/p/table/export')
  await router.isReady()
  const w = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
  await flushPromises()
  return { w, router }
}

test('vom Reiter Tabelle auf JSON: die Ansicht wird gezeichnet, nicht leer gelassen', async () => {
  const gezeichnet = []
  const { w, router } = await fenster([
    { key: 'table', path: 'export', component: { render: () => h('div', 'Tabellen-Export') } },
    { key: 'json', path: 'export', mount: el => { el.textContent = 'JSON-Export'; gezeichnet.push('json') } },
  ])
  await flushPromises()
  assert.ok(w.text().includes('Tabellen-Export'))
  router.push('/p/json/export')
  await flushPromises()
  assert.deepEqual(gezeichnet, ['json'], 'die Ansicht wurde nie gezeichnet — das Fenster stand erst nach dem Rendern')
  assert.ok(w.text().includes('JSON-Export'), `leer geblieben: „${w.text()}“`)
})

test('scheitert das Zeichnen, steht der Fehler da — kein leeres Fenster', async () => {
  const { w, router } = await fenster([
    { key: 'table', path: 'export', component: { render: () => h('div', 'Tabellen-Export') } },
    { key: 'json', path: 'export', mount: () => { throw new Error('Baum nicht geladen') } },
  ])
  router.push('/p/json/export')
  await flushPromises()
  assert.ok(w.text().includes('Baum nicht geladen'), `der Fehler fehlt: „${w.text()}“`)
  assert.ok(w.text().includes('json/export'), 'woran es lag, steht dabei')
})
