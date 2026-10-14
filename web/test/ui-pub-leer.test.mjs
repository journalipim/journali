// Publikation (14.10.2026): „Noch leer — einen Ast … ziehen“ stand auch bei einem Baum mit Rubriken, solange er zugeklappt war — die Ansicht
// zählte nur die sichtbaren Zeilen. Leer ist ein Baum ohne Rubriken und ohne Verweise.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { createRouter, createMemoryHistory } from 'vue-router'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const PubView = (await import('../src/views/PubView.vue')).default

async function ansicht(kinder) {
  localStorage.removeItem('journali.pubexpanded'); localStorage.removeItem('journali.pubtree')
  const orig = api.get
  api.get = async p => p.startsWith('/api/pub/') ? { tree: { id: 'r-web' }, in: 0, out: 0, rows: [] } : []
  const wurzel = { id: 'r-web', role: 'rubric', parent: null, label: 'Online-Shop', channel: 'web', rules: [] }
  const rows = [wurzel, ...kinder, { id: 'g1', role: 'group', parent: null, label: 'G' }]
  Object.assign(tree, { rows, byId: new Map(rows.map(r => [r.id, r])), children: new Map([['#pub', [wurzel]], ['r-web', kinder], ['', [rows.at(-1)]]]), pubTrees: [wurzel], loaded: true })
  store.model = { attributes: [], locales: [{ code: 'de' }], channels: [], groups: [], lists: [], views: [] }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/pub', component: PubView }, { path: '/pub/:id', component: PubView, props: true }] })
  router.push('/pub'); await router.isReady()
  const w = mount({ template: '<router-view />' }, { global: { plugins: [router], stubs: { NodeView: true, TreePicker: true, Splitter: true } } })
  for (let i = 0; i < 5; i++) await flushPromises()
  return { w, ende: () => { w.unmount(); api.get = orig } }
}

test('ein zugeklappter Baum mit Rubriken ist nicht leer', async () => {
  const { w, ende } = await ansicht([{ id: 'r-a', role: 'rubric', parent: 'r-web', label: 'Aussenleuchten' }])
  try {
    assert.equal(w.text().includes('Noch leer'), false)
  } finally { ende() }
})

test('ein Baum ohne Rubriken und Verweise sagt, dass er leer ist', async () => {
  const { w, ende } = await ansicht([])
  try {
    assert.equal(w.text().includes('Noch leer'), true)
  } finally { ende() }
})
