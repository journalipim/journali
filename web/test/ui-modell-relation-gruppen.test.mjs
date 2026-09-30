// Relationstyp und Attributgruppen (30.09.2026): ein Typ hat eine Menge von Gruppen, nicht nur eine. Die Attribute aller
// Gruppen stehen an der Relation. Geschrieben wird je Änderung die ganze Menge; group bleibt die erste daraus.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const ModelView = (await import('../src/views/ModelView.vue')).default

const MODELL = () => ({
  masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], lists: [], views: [], units: [], types: ['text', 'decimal'],
  relationTypes: [{ key: 'bom', label: { de: 'Stückliste' }, reverse: { de: 'Stückliste von' }, group: 'bestandteil' }],
  groups: [
    { key: 'bestandteil', label: { de: 'Bestandteil' }, attributes: ['menge'] },
    { key: 'naehrwerte', label: { de: 'Nährwerte' }, attributes: ['gehalt'] },
  ],
  attributes: [
    { key: 'menge', label: { de: 'Menge' }, type: 'integer', group: 'bestandteil', groups: ['bestandteil'] },
    { key: 'gehalt', label: { de: 'Gehalt' }, type: 'decimal', group: 'naehrwerte', groups: ['naehrwerte'] },
  ],
})

function welt() {
  store.actor = 'u1'; store.toasts = []; store.model = MODELL(); store.poll = async () => {}
  tree.rows = []; tree.byId = new Map(); tree.loaded = true; tree.load = async () => {}
  const gesendet = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url)
    if (opt.method === 'PUT') { gesendet.push({ pfad, body: JSON.parse(opt.body) }); return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) } }
    const antwort = /\/api\/model$/.test(pfad) ? store.model : []
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  const router = { path: '/model', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/model', query: { section: 'relationTypes', key: 'bom' }, params: {}, name: 'model', hash: '', fullPath: '/model', matched: [], meta: {} }
  const w = mount(ModelView, { global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, Splitter: true, AttrBulk: true, EditGrid: true } } })
  return { w, gesendet }
}
const gruppenZeile = w => w.findAll('tr').find(tr => /Werte aus Gruppen/.test(tr.find('td.attr')?.text() ?? ''))
const chips = zeile => zeile.findAll('.chip').map(c => c.text().replace('×', '').trim())

test('der Typ zeigt seine Gruppe als Chip; zur Wahl stehen nur die übrigen', async () => {
  const { w } = welt()
  await flushPromises()
  const zeile = gruppenZeile(w)
  assert.ok(zeile, 'die Zeile „Werte aus Gruppen“ steht da')
  assert.equal(zeile.findAll('td.chips').length, 0, 'die Zelle selbst ist keine Flex-Box')
  assert.ok(zeile.find('td > div.chips.gruppen'), 'die Chips stehen in einem div in der Zelle')
  assert.deepEqual(chips(zeile), ['Bestandteil'])
  assert.deepEqual(zeile.findAll('select.zu option').map(o => o.text()), ['+ Gruppe …', 'Nährwerte'])
})

test('eine weitere Gruppe hinzufügen schreibt die ganze Menge; group bleibt die erste', async () => {
  const { w, gesendet } = welt()
  await flushPromises()
  const sel = gruppenZeile(w).find('select.zu')
  sel.element.value = 'naehrwerte'; await sel.trigger('change')
  await flushPromises()
  assert.equal(gesendet.length, 1)
  assert.match(gesendet[0].pfad, /\/api\/model\/relations\/bom$/)
  assert.deepEqual(gesendet[0].body.groups, ['bestandteil', 'naehrwerte'])
  assert.equal(gesendet[0].body.group, 'bestandteil')
})

test('die letzte Gruppe herausnehmen lässt den Typ ohne Gruppe (group leer)', async () => {
  const { w, gesendet } = welt()
  await flushPromises()
  await gruppenZeile(w).find('.chip button.raus').trigger('click')
  await flushPromises()
  assert.deepEqual(gesendet.at(-1).body.groups, [])
  assert.equal(gesendet.at(-1).body.group, null)
})

test('unter der Tabelle stehen die Attribute aller Gruppen', async () => {
  store.model = null
  const { w } = welt()
  store.model.relationTypes[0].groups = ['bestandteil', 'naehrwerte']
  await flushPromises()
  assert.match(w.text(), /an der Relation: Gehalt, Menge|an der Relation: Menge, Gehalt/)
})
