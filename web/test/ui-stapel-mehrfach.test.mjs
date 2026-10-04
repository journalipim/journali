// Mehrfachauswahl in Stapeln (04.10.2026): Medien in einen Ordner verschieben und Knoten in eine Rubrik hängen gehen als ein Stapel an den Server —
// vorher eine Anfrage je Element, nacheinander.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, createRouter, createMemoryHistory } from 'vue-router'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const MediaView = (await import('../src/views/MediaView.vue')).default
const PubView = (await import('../src/views/PubView.vue')).default

const medium = (id, name) => ({ id, sha256: id.padEnd(64, '0'), bytes: 1000, mime: 'image/png', name, isImage: true, renderable: true, hasThumb: true, values: [], external: {},
  used: 0, entries: 1, lastNumber: 1, lastAt: '2026-10-04T08:00:00Z', lastActor: 'u1', folder: null, probe: null, pixels: 0, source: null, createdAt: '2026-10-04T08:00:00Z', createdBy: 'u1' })

test('Medien in einen Ordner: ein Stapel media.file, nicht ein PUT je Medium', async () => {
  store.actor = 'u1'; store.toasts = []; store.poll = async () => {}
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], statuses: [] }
  const MEDIEN = [medium('m1', 'a.png'), medium('m2', 'b.png'), medium('m3', 'c.png')]
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url); rufe.push({ pfad, methode: opt.method ?? 'GET' })
    const antwort = pfad.includes('/api/media/folders') ? { total: 3, unfiled: 3, folders: [{ id: 'f1', name: 'Bilder', parent: null, n: 0 }] } : /\/api\/media\?/.test(pfad) ? MEDIEN : []
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  let gesendet = null
  const orig = api.batchChunked
  api.batchChunked = async cmds => { gesendet = cmds; return { results: cmds, errors: [] } }
  try {
    const router = { path: '/media', push(p) { this.path = p }, replace(p) { this.path = p } }
    const w = mount(MediaView, { global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true } } })
    await flushPromises()
    // zwei Kacheln auf den Ordner „Bilder“ ziehen
    const ordner = w.findAll('.pick').find(x => x.text().includes('Bilder'))
    assert.ok(ordner, 'Ordner Bilder')
    await ordner.trigger('drop', { dataTransfer: { getData: () => 'm1,m3' } }); await flushPromises()
    assert.deepEqual(gesendet, [{ op: 'media.file', args: { media: 'm1', folder: 'f1' } }, { op: 'media.file', args: { media: 'm3', folder: 'f1' } }])
    assert.equal(rufe.filter(r => r.methode === 'PUT').length, 0)
    w.unmount()
  } finally { api.batchChunked = orig }
})

test('Knoten in eine Rubrik: ein Stapel rubric.place, nicht ein POST je Knoten', async () => {
  const origGet = api.get, origChunked = api.batchChunked
  api.get = async p => p.startsWith('/api/pub/') ? { tree: { id: 'r-web' }, in: 0, out: 0, rows: [] } : p.includes('/rules/expand') ? { groups: [] } : []
  let gesendet = null
  api.batchChunked = async cmds => { gesendet = cmds; return { results: cmds, errors: [] } }
  store.poll = async () => {}
  const rows = [{ id: 'r-web', role: 'rubric', parent: null, label: 'Web', channel: 'web', rules: [] }, { id: 'g1', role: 'group', parent: null, label: 'G' },
    { id: 'p1', role: 'product', parent: 'g1', label: 'P1' }, { id: 'p2', role: 'product', parent: 'g1', label: 'P2' }]
  Object.assign(tree, { rows, byId: new Map(rows.map(r => [r.id, r])), children: new Map([['#pub', [rows[0]]], ['', [rows[1]]], ['g1', rows.slice(2)]]), pubTrees: [rows[0]], loaded: true, load: async () => {} })
  store.model = { attributes: [], locales: [{ code: 'de' }], channels: [], groups: [], lists: [], views: [] }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/pub', component: PubView }, { path: '/pub/:id', component: PubView, props: true }] })
  router.push('/pub/r-web'); await router.isReady()
  const w = mount({ template: '<router-view />' }, { global: { plugins: [router], stubs: { NodeView: true, TreePicker: true, Splitter: true } } })
  try {
    for (let i = 0; i < 5; i++) await flushPromises()
    // „noch nicht einsortiert“ aufklappen, dann „alle in „Web““
    const zeigen = w.findAll('button').find(b => /noch nicht einsortierte/.test(b.attributes('title') ?? ''))
    assert.ok(zeigen, 'Knopf der nicht einsortierten')
    await zeigen.trigger('click'); await flushPromises()
    const alle = w.findAll('.unplaced button').find(b => /alle in/.test(b.text()))
    assert.ok(alle && alle.attributes('disabled') === undefined, 'alle in „Web“')
    await alle.trigger('click'); for (let i = 0; i < 3; i++) await flushPromises()
    assert.deepEqual(gesendet, [{ op: 'rubric.place', args: { rubric: 'r-web', node: 'p1' } }, { op: 'rubric.place', args: { rubric: 'r-web', node: 'p2' } }])
  } finally { w.unmount(); api.get = origGet; api.batchChunked = origChunked }
})
