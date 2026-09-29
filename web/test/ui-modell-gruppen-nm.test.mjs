// Attribut und Gruppe n:m (29.09.2026): eine Gruppe ist eine Auswahl, kein Besitz. Am Attribut steht eine
// Mehrfachauswahl, die Gruppe zeigt ihre Mitglieder und nimmt welche auf. Geschrieben wird je Änderung ein Aufruf
// mit der ganzen Menge; group bleibt als Heimatgruppe die erste daraus.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, win } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const ModelView = (await import('../src/views/ModelView.vue')).default

const MODELL = () => ({
  masterLocale: 'de', locales: [{ code: 'de' }], channels: [{ key: 'web' }], statuses: [], lists: [], views: [], units: [], relationTypes: [], types: ['text', 'decimal'],
  groups: [
    { key: 'zuendung', label: { de: 'Zündung' }, attributes: ['spannung'] },
    { key: 'dimmung', label: { de: 'Dimmung' }, attributes: ['spannung'] },
    { key: 'gehaeuse', label: { de: 'Gehäuse' }, attributes: ['breite'] },
  ],
  attributes: [
    { key: 'spannung', label: { de: 'Spannung' }, type: 'decimal', group: 'zuendung', groups: ['dimmung', 'zuendung'] },
    { key: 'breite', label: { de: 'Breite' }, type: 'decimal', group: 'gehaeuse', groups: ['gehaeuse'] },
  ],
})

function welt(query = {}) {
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
  const route = { path: '/model', query, params: {}, name: 'model', hash: '', fullPath: '/model', matched: [], meta: {} }
  const w = mount(ModelView, { global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, Splitter: true, AttrBulk: true, EditGrid: true } } })
  return { w, gesendet }
}
const gruppenZeile = w => w.findAll('tr').find(tr => /▤ Gruppen/.test(tr.find('td.attr')?.text() ?? ''))

test('am Attribut stehen alle seine Gruppen; die Heimatgruppe ist hervorgehoben', async () => {
  const { w } = welt({ section: 'attributes', key: 'spannung' })
  await flushPromises()
  const zeile = gruppenZeile(w)
  assert.ok(zeile, 'die Zeile ▤ Gruppen steht da')
  assert.deepEqual(zeile.findAll('.chip').map(c => c.text().replace('×', '').trim()), ['Dimmung', 'Zündung'])
  assert.equal(zeile.findAll('.chip.heim').length, 1, 'genau eine Heimatgruppe')
  assert.match(zeile.find('.chip.heim').text(), /Zündung/)
  // zur Wahl stehen nur Gruppen, in denen es noch nicht Mitglied ist
  assert.deepEqual(zeile.findAll('select.zu option').map(o => o.text()), ['+ Gruppe …', 'Gehäuse'])
})

test('eine weitere Gruppe aufnehmen schreibt einmal die ganze Menge — die Heimatgruppe bleibt', async () => {
  const { w, gesendet } = welt({ section: 'attributes', key: 'spannung' })
  await flushPromises()
  const sel = gruppenZeile(w).find('select.zu')
  sel.element.value = 'gehaeuse'; await sel.trigger('change')
  await flushPromises()
  assert.equal(gesendet.length, 1, 'ein Aufruf')
  assert.match(gesendet[0].pfad, /\/api\/model\/attributes\/spannung$/)
  assert.deepEqual(gesendet[0].body.groups, ['dimmung', 'gehaeuse', 'zuendung'])
  assert.equal(gesendet[0].body.group, 'zuendung', 'die Heimatgruppe bleibt, solange sie in der Menge steht')
})

test('aus einer Gruppe nehmen lässt die anderen stehen; fällt die Heimatgruppe weg, rückt die erste nach', async () => {
  const { w, gesendet } = welt({ section: 'attributes', key: 'spannung' })
  await flushPromises()
  const chip = gruppenZeile(w).findAll('.chip').find(c => /Zündung/.test(c.text()))
  await chip.find('button.raus').trigger('click')
  await flushPromises()
  assert.equal(gesendet.length, 1)
  assert.deepEqual(gesendet[0].body.groups, ['dimmung'])
  assert.equal(gesendet[0].body.group, 'dimmung')
})

test('die Gruppe zeigt ihre Mitglieder — auch die, deren Heimatgruppe eine andere ist', async () => {
  const { w, gesendet } = welt({ section: 'groups', key: 'dimmung' })
  await flushPromises()
  const mitglieder = w.findAll('.section').find(s => /⊞ Attribute/.test(s.find('h2')?.text() ?? ''))
  assert.ok(mitglieder)
  assert.deepEqual(mitglieder.findAll('.chip').map(c => c.text().replace('×', '').trim()), ['Spannung'])
  // herausnehmen trifft nur diese Gruppe
  await mitglieder.find('.chip button.raus').trigger('click')
  await flushPromises()
  assert.deepEqual(gesendet.at(-1).body.groups, ['zuendung'])
})

test('zuordnen nimmt auf, statt die alte Gruppe zu ersetzen', async () => {
  const { w, gesendet } = welt({ section: 'groups', key: 'dimmung' })
  await flushPromises()
  const zuordnen = w.findAll('.section').find(s => /Attribute zuordnen/.test(s.find('h2')?.text() ?? ''))
  const zeile = zuordnen.findAll('label.pick').find(l => /Breite/.test(l.text()))
  assert.ok(zeile, 'Attribute anderer Gruppen stehen zur Wahl')
  await zeile.find('input[type="checkbox"]').trigger('change')
  await zuordnen.findAll('button').find(b => /zuordnen/.test(b.text())).trigger('click')
  await flushPromises()
  assert.equal(gesendet.length, 1)
  assert.deepEqual(gesendet[0].body.groups, ['dimmung', 'gehaeuse'])
  assert.equal(gesendet[0].body.group, 'gehaeuse', 'die Heimatgruppe bleibt')
})
