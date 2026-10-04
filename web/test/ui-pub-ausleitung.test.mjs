// Publikation (04.10.2026): die Ausleitung kam mit allen Zeilen bei jedem neuen Baum, und die Regeln wurden je Rubrik nacheinander geholt. Jetzt nur die
// Zahlen, solange die Ausleitung zugeklappt ist; aufgeklappt mit den Zeilen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { createRouter, createMemoryHistory } from 'vue-router'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const PubView = (await import('../src/views/PubView.vue')).default

test('die Ausleitung kommt ohne Zeilen, bis sie aufgeklappt wird', async () => {
  const gefragt = []
  const orig = api.get
  api.get = async p => {
    gefragt.push(p)
    if (p.startsWith('/api/pub/r-web/export')) return { tree: { id: 'r-web' }, in: 3, out: 1, rows: p.includes('rows=false') ? [] : [{ product: { id: 'p1', label: 'P1' }, in: true, variants: [], path: [] }] }
    if (p.includes('/rules/expand')) return { groups: [] }
    return []
  }
  const rows = [{ id: 'r-web', role: 'rubric', parent: null, label: 'Web', channel: 'web', rules: [] }, { id: 'g1', role: 'group', parent: null, label: 'G' }]
  Object.assign(tree, { rows, byId: new Map(rows.map(r => [r.id, r])), children: new Map([['#pub', [rows[0]]], ['', [rows[1]]]]), pubTrees: [rows[0]], loaded: true })
  store.model = { attributes: [], locales: [{ code: 'de' }], channels: [], groups: [], lists: [], views: [] }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/pub', component: PubView }, { path: '/pub/:id', component: PubView, props: true }] })
  router.push('/pub'); await router.isReady()
  const w = mount({ template: '<router-view />' }, { global: { plugins: [router], stubs: { NodeView: true, TreePicker: true, Splitter: true } } })
  try {
    for (let i = 0; i < 5; i++) await flushPromises()
    const ausleitung = gefragt.filter(p => p.startsWith('/api/pub/r-web/export'))
    assert.ok(ausleitung.length >= 1, gefragt.join('\n'))
    assert.ok(ausleitung.every(p => p.includes('rows=false')), 'zugeklappt: nur die Zahlen')
    const knopf = w.findAll('button').find(b => (b.attributes('title') ?? '').startsWith('Ausleitung anzeigen'))
    assert.ok(knopf, 'Knopf der Ausleitung')
    await knopf.trigger('click'); for (let i = 0; i < 5; i++) await flushPromises()
    assert.ok(gefragt.filter(p => p.startsWith('/api/pub/r-web/export')).some(p => !p.includes('rows=false')), 'aufgeklappt: mit Zeilen')
  } finally { w.unmount(); api.get = orig }
})
