// Modell: etwas anlegen (30.09.2026). Der Anwender tippt einen Namen („Zutat“); der Server erlaubt als Schlüssel nur
// a-z, 0-9 und _, mit Buchstabe am Anfang. Aus dem Namen wird der Schlüssel, der Name bleibt als Bezeichnung.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const ModelView = (await import('../src/views/ModelView.vue')).default

function welt(section) {
  store.actor = 'u1'; store.toasts = []; store.poll = async () => {}
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], channels: [], statuses: [], lists: [], views: [], units: [], groups: [], attributes: [], relationTypes: [], types: ['text'] }
  tree.rows = []; tree.byId = new Map(); tree.loaded = true; tree.load = async () => {}
  const gesendet = []
  globalThis.fetch = async (url, opt = {}) => {
    if (opt.method === 'PUT') { gesendet.push({ pfad: String(url), body: JSON.parse(opt.body) }); return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) } }
    const antwort = /\/api\/model$/.test(String(url)) ? store.model : []
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  const router = { path: '/model', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/model', query: { section }, params: {}, name: 'model', hash: '', fullPath: '/model', matched: [], meta: {} }
  const w = mount(ModelView, { global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, Splitter: true, AttrBulk: true, EditGrid: true } } })
  return { w, gesendet }
}
async function anlegen(w, text) {
  const eingabe = w.find('input[type="text"][placeholder]')
  await eingabe.setValue(text)
  await w.find('button.primary[title="anlegen"]').trigger('click')
  await flushPromises()
}

test('ein Name mit Grossbuchstaben wird ein gültiger Schlüssel; der Name steht als Bezeichnung', async () => {
  const { w, gesendet } = welt('relationTypes')
  await flushPromises()
  await anlegen(w, 'Zutat')
  assert.equal(gesendet.length, 1)
  assert.match(gesendet[0].pfad, /\/api\/model\/relations\/zutat$/)
  assert.equal(gesendet[0].body.key, 'zutat')
  assert.deepEqual(gesendet[0].body.label, { de: 'Zutat' })
})

test('Umlaute und Leerzeichen werden aufgelöst', async () => {
  const { w, gesendet } = welt('groups')
  await flushPromises()
  await anlegen(w, 'Größe & Maße')
  assert.match(gesendet[0].pfad, /\/api\/model\/groups\/groesse_masse$/)
  assert.deepEqual(gesendet[0].body.label, { de: 'Größe & Maße' })
})

test('ein gültiger Schlüssel bleibt, wie er getippt wurde, ohne Bezeichnung', async () => {
  const { w, gesendet } = welt('relationTypes')
  await flushPromises()
  await anlegen(w, 'zutat')
  assert.match(gesendet[0].pfad, /\/api\/model\/relations\/zutat$/)
  assert.deepEqual(gesendet[0].body.label, {})
})

test('aus einem Namen ohne Buchstaben wird nichts angelegt', async () => {
  const { w, gesendet } = welt('groups')
  await flushPromises()
  await anlegen(w, '123')
  assert.equal(gesendet.length, 0)
  assert.ok(store.toasts.length > 0, 'eine Meldung sagt, was ist')
})

test('eine Einheit bleibt, wie getippt: das Symbol ist der Schlüssel', async () => {
  const { w, gesendet } = welt('units')
  await flushPromises()
  await anlegen(w, 'GB')
  assert.match(gesendet[0].pfad, /\/api\/model\/units\/GB$/)
})
