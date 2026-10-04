// ▩ Assets am Knoten, „feste Bilder der Subitems durch Vererbung ersetzen“ (04.10.2026): eine Anfrage an den Server (/media-below) statt einer
// je Nachfahre — bei tausenden Varianten waren das tausende Anfragen nacheinander.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { api } from '../src/api.js'
import { dialog } from '../src/dialog.js'

const NodeView = (await import('../src/views/NodeView.vue')).default

const REL = {
  id: 'r1', type: 'image', from: 'p1', to: 'm1', dir: 'out',
  other: { id: 'm1', role: 'media', label: 'vorne.jpg', missing: false, mime: 'image/jpeg', isImage: true, bytes: 1, hasThumb: true },
  values: [], external: {}, entries: 1, lastNumber: 1, lastAt: '2026-10-04T08:00:00Z', lastActor: 'u1',
}
const MODELL = {
  masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], groups: [], lists: [], views: [], families: [],
  attributes: [
    { key: 'inherit', label: { de: 'an Subitems vererben' }, type: 'boolean', group: 'relation_media' },
    { key: 'stop', label: { de: 'unterbinden' }, type: 'boolean', group: 'relation_media' },
  ],
  relationTypes: [{ key: 'image', label: { de: 'Bild' }, to: ['media'], group: 'relation_media' }],
}

test('vererben fragt einmal den Server, zeigt, was gelöst wird, und schickt einen Stapel', async () => {
  store.actor = 'u1'; store.toasts = []; store.model = MODELL; store.poll = async () => {}
  const rows = [{ id: 'p1', role: 'product', label: 'Bohrer', parent: null, axes: [] },
    ...Array.from({ length: 50 }, (_, i) => ({ id: 'v' + i, role: 'variant', label: 'V' + i, parent: 'p1', axes: [] }))]
  tree.byId = new Map(rows.map(r => [r.id, r])); tree.rows = rows
  tree.children = new Map([['', [rows[0]]], ['p1', rows.slice(1)]]); tree.loaded = true; tree.load = async () => {}
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url); rufe.push(pfad)
    const antwort = /\/media-below/.test(pfad) ? { below: 50, already: 3, retire: [{ node: { id: 'v1', label: 'V1' }, relation: 'rx', medium: 'vorne.jpg' }] }
      : /\/relations/.test(pfad) ? { out: [REL], in: [], inherited: [] }
      : /\/api\/model/.test(pfad) ? MODELL
      : /\/api\/plugins/.test(pfad) ? []
      : /\/nodes\/p1/.test(pfad) ? { id: 'p1', role: 'product', label: 'Bohrer', values: [], status: 'draft', children: 50, axes: [], groups: [] }
      : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  let gefragt = null, gesendet = null
  const confirm = dialog.confirm, chunked = api.batchChunked
  dialog.confirm = async o => { gefragt = o; return true }
  api.batchChunked = async commands => { gesendet = commands; return { results: commands, errors: [] } }
  try {
    const router = { path: '/tree/p1', push(p) { this.path = p }, replace(p) { this.path = p } }
    const route = { path: '/tree/p1', query: {}, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
    const w = mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true, PluginBands: true, VersionsPanel: true, WorkflowLocales: true } } })
    await flushPromises()
    const knopf = w.findAll('button').find(b => /durch Vererbung ersetzen/.test(b.text()))
    assert.ok(knopf, 'Knopf da')
    const vorher = rufe.length
    await knopf.trigger('click'); await flushPromises(); await new Promise(r => setTimeout(r, 0)); await flushPromises()
    const neu = rufe.slice(vorher)
    assert.equal(neu.filter(p => /\/media-below/.test(p)).length, 1)
    assert.ok(!neu.some(p => /\/nodes\/v\d+\/relations/.test(p)), 'keine Anfrage je Nachfahre')
    assert.match(gefragt.title, /50 Subitems/)
    assert.ok(gefragt.list.some(z => /3 Subitems erben bereits/.test(z)))
    assert.ok(gefragt.list.some(z => /V1 · vorne\.jpg/.test(z)))
    assert.deepEqual(gesendet, [
      { op: 'relation.attribute.set', args: { relation: 'r1', attribute: 'inherit', value: 'true' } },
      { op: 'relation.retire', args: { relation: 'rx' } },
    ])
  } finally { dialog.confirm = confirm; api.batchChunked = chunked }
})
