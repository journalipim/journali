// Tabellenbearbeitung „Alle Varianten darunter“ (04.10.2026): an einer grossen Gruppe waren es 12 000 Zeilen × 783 Spalten, rund 700 MB —
// der Browser stürzte ab. Jetzt kommen 200 Zeilen, „▼ weitere“ holt die nächsten, und keine Anfrage geht ohne Seite an den Server.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { createRouter, createMemoryHistory } from 'vue-router'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const TableEditView = (await import('../src/views/TableEditView.vue')).default

const ALLE = Array.from({ length: 450 }, (_, i) => ({ row: { id: `v-${i}`, role: 'variant', parent: 'p', label: `V ${i}`, axisValues: {} }, inactive: [], values: { titel: { value: `T ${i}`, own: true } } }))

test('die Tabelle lädt 200 Zeilen, nennt die Gesamtzahl, und „weitere“ holt die nächsten — nie ohne Seite', async () => {
  const gefragt = []
  const orig = api.get
  api.get = async p => {
    gefragt.push(p)
    const u = new URL('http://x' + p)
    assert.ok(u.searchParams.has('take'), 'ohne Seite: ' + p)
    const take = +u.searchParams.get('take'), skip = +u.searchParams.get('skip')
    const rows = ALLE.slice(skip, skip + take)
    return { node: { id: 'g', role: 'group', label: 'Gruppe' }, columns: [{ key: 'titel', type: 'text', label: { de: 'Titel' } }], rows, total: ALLE.length, next: skip + rows.length < ALLE.length ? skip + rows.length : null }
  }
  store.model = { locales: [{ code: 'de' }], attributes: [{ key: 'titel', type: 'text', label: { de: 'Titel' } }], groups: [], lists: [], views: [] }
  tree.loaded = true
  // happy-dom hat kein Canvas: die Spaltenbreite misst Text — eine einfache Messung genügt
  globalThis.HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: t => ({ width: String(t).length * 7 }) })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/table/:id', component: TableEditView, props: r => ({ id: r.params.id, role: 'variant', deep: '1' }) }] })
  router.push('/table/g'); await router.isReady()
  const w = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
  try {
    for (let i = 0; i < 5; i++) await flushPromises()
    assert.match(w.find('h1').text(), /200 von 450/)
    assert.equal(w.findAll('tbody tr').length >= 200, true)
    await w.find('button.mehr').trigger('click'); for (let i = 0; i < 5; i++) await flushPromises()
    assert.match(w.find('h1').text(), /400 von 450/)
    await w.find('button.mehr').trigger('click'); for (let i = 0; i < 5; i++) await flushPromises()
    assert.match(w.find('h1').text(), /· 450/)
    assert.equal(w.find('button.mehr').exists(), false, 'alles geladen: kein Knopf mehr')
    assert.ok(gefragt.every(p => p.includes('take=')))
  } finally { w.unmount(); api.get = orig }
})
