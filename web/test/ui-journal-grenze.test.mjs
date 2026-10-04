// Journal-Ansicht (04.10.2026): sie hielt jeden Eintrag, der dazukam — ein Import mit 100 000 Einträgen bei offenem Journal liess sie wachsen, bis
// der Tab abstürzte. Jetzt: gekürzte Nutzlasten (brief), höchstens 20 000 Einträge, und bei einer grossen Lücke beginnt sie bei den neuesten.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { createRouter, createMemoryHistory } from 'vue-router'
import { api } from '../src/api.js'
import { store } from '../src/store.js'

const JournalView = (await import('../src/views/JournalView.vue')).default
const eintrag = n => ({ number: n, at: '2026-10-04T08:00:00Z', actor: 'u', stream: 'v-1', type: 'AttributeSet', kind: 'data', batch: null, payload: { attribute: 'a', value: 'x' } })

test('die Ansicht fragt gekürzt, springt bei einer grossen Lücke zu den neuesten und hält nicht mehr als 20 000', async () => {
  const gefragt = []
  const orig = api.get
  api.get = async p => {
    if (p === '/api/health') return { head: store.head }
    if (!p.startsWith('/api/journal')) return []   // Baum und Modell laden bei jedem neuen Stand mit — hier nicht gefragt
    gefragt.push(p)
    const u = new URL('http://x' + p); const after = +u.searchParams.get('after'), limit = +u.searchParams.get('limit')
    const out = []; for (let n = after + 1; n <= Math.min(store.head, after + limit); n++) out.push(eintrag(n))
    return out
  }
  store.head = 100_000
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/journal', component: JournalView }] })
  router.push('/journal'); await router.isReady()
  const w = mount({ template: '<router-view />' }, { global: { plugins: [router] } })
  try {
    for (let i = 0; i < 5; i++) await flushPromises()
    assert.ok(gefragt.every(p => p.includes('brief=true')), gefragt.join('\n'))
    assert.match(gefragt[0], /after=95000/)
    // ein Import schreibt 100 000 Einträge: die Ansicht lädt nicht alle nach, sondern beginnt bei den neuesten
    store.head = 200_000
    for (let i = 0; i < 5; i++) await flushPromises()
    assert.match(gefragt.at(-1), /after=195000/)
    assert.match(w.text(), /#200000/)
    // viele kleine Schritte: nie mehr als 20 000
    for (let k = 0; k < 6; k++) { store.head += 4000; for (let i = 0; i < 4; i++) await flushPromises() }
    const zahl = Number((w.find('.toolbar .muted').text().match(/^(\d+)/) ?? [])[1])
    assert.ok(zahl <= 20_000, `hält ${zahl}`)
    assert.ok(w.findAll('tbody tr').length <= 1100, 'gezeichnet werden nicht alle')
    assert.ok(w.find('button.weitere').exists())
  } finally { w.unmount(); api.get = orig }
})
