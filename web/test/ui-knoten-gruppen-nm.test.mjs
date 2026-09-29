// Attribut in mehreren geltenden Gruppen (n:m, 29.09.2026): am Knoten steht es einmal da — in der ersten Gruppe am
// Pfad; die weiteren nennt der Tooltip seiner Zeile. Der Wert ist derselbe, die Zelle auch.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const NodeView = (await import('../src/views/NodeView.vue')).default

const MODELL = {
  masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], lists: [], views: [], families: [], units: [], relationTypes: [],
  groups: [
    { key: 'zuendung', label: { de: 'Zündung' }, attributes: ['spannung', 'zuendzeit'] },
    { key: 'dimmung', label: { de: 'Dimmung' }, attributes: ['spannung'] },
  ],
  attributes: [
    { key: 'spannung', label: { de: 'Spannung' }, type: 'decimal', group: 'zuendung', groups: ['dimmung', 'zuendung'] },
    { key: 'zuendzeit', label: { de: 'Zündzeit' }, type: 'decimal', group: 'zuendung', groups: ['zuendung'] },
  ],
}

function welt(query = {}) {
  store.actor = 'u1'; store.toasts = []; store.model = MODELL; store.pendingDocTables = null; store.poll = async () => {}
  store.layout = 'list'; store.scope = 'all'; store.viewKey = {}; store.collapsed = []
  globalThis.HTMLCanvasElement.prototype.getContext = () => ({ font: '', measureText: s => ({ width: String(s).length * 7 }) })
  const g1 = { id: 'g1', role: 'group', label: 'Leuchten', parent: null, axes: [], groups: ['zuendung', 'dimmung'] }
  const p1 = { id: 'p1', role: 'product', label: 'Treiber', parent: 'g1', axes: [] }
  tree.byId = new Map([['g1', g1], ['p1', p1]]); tree.rows = [g1, p1]; tree.children = new Map([['', [g1]], ['g1', [p1]]]); tree.loaded = true; tree.load = async () => {}
  const knoten = {
    id: 'p1', role: 'product', label: {}, values: [], status: 'draft', children: 0, axes: [], attachedGroups: [],
    ancestors: [{ id: 'g1', role: 'group', label: 'Leuchten', values: [] }],
    // der Server nennt je Gruppe ihre Attribute — spannung steht in beiden
    groups: [
      { key: 'zuendung', from: 'g1', fromLabel: 'Leuchten', active: true, attributes: ['spannung', 'zuendzeit'] },
      { key: 'dimmung', from: 'g1', fromLabel: 'Leuchten', active: true, attributes: ['spannung'] },
    ],
  }
  globalThis.fetch = async (url) => {
    const pfad = String(url)
    const antwort = /\/nodes\/p1$/.test(pfad) ? knoten : /\/relations/.test(pfad) ? { out: [], in: [], inherited: [] } : /\/api\/model/.test(pfad) ? MODELL : /\/api\/plugins/.test(pfad) ? [] : /\/api\/streams\//.test(pfad) || /\/workflow$/.test(pfad) ? [] : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  const router = { path: '/tree/p1', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/tree/p1', query, params: { id: 'p1' }, name: 'tree', hash: '', fullPath: '/tree/p1', matched: [], meta: {} }
  return mount(NodeView, { props: { id: 'p1' }, global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, EntryList: true, PluginBands: true, VersionsPanel: true, DocTables: true } } })
}
const attrZeilen = w => w.findAll('td.attr').map(td => ({ text: td.text().replace(/\s+/g, ' ').trim(), title: td.attributes('title') ?? '' }))

test('ein Attribut in zwei geltenden Gruppen steht einmal da', async () => {
  const w = welt()
  await flushPromises()
  const spannung = attrZeilen(w).filter(z => /Spannung/.test(z.text))
  assert.equal(spannung.length, 1, 'einmal, nicht je Gruppe')
  assert.match(spannung[0].title, /auch in Dimmung/, 'die weiteren Gruppen stehen im Tooltip')
})

test('die Gruppe, deren Attribute alle woanders stehen, hat keinen leeren Block', async () => {
  const w = welt()
  await flushPromises()
  const koepfe = w.findAll('tbody[data-group]').map(b => b.attributes('data-group'))
  assert.deepEqual(koepfe, ['zuendung'], 'Dimmung bringt hier nichts Eigenes mit')
  // die Attribute der Gruppe sind trotzdem zu sehen
  assert.deepEqual(attrZeilen(w).map(z => z.text.replace(/☆|★/g, '').trim()).filter(t => /Spannung|Zündzeit/.test(t)).sort(), ['Spannung', 'Zündzeit'])
})

test('der Sprung auf eine Gruppe ohne eigenen Block führt zu dem Block, der ihre Attribute zeigt', async () => {
  const w = welt({ group: 'dimmung' })
  await flushPromises()
  assert.deepEqual(store.toasts.map(t => t.text ?? t), [], 'keine Meldung, die Gruppe gilt ja')
})
