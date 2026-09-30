// Modell → Einheiten (30.09.2026): Faktor und Verschiebung einer Einheit. Basis = Wert × Faktor + Verschiebung; beide
// Felder nehmen auch einen Bruch (5/9), weil 0.5555 die Umrechnung verfälscht.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const ModelView = (await import('../src/views/ModelView.vue')).default

function welt() {
  store.actor = 'u1'; store.toasts = []; store.poll = async () => {}
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], channels: [], statuses: [], lists: [], views: [], groups: [], attributes: [], relationTypes: [], types: ['text'],
    units: [{ key: '°C', label: { de: 'Grad Celsius' }, quantity: 'temperature', factor: 1, offset: 0 }, { key: '°F', label: { de: 'Grad Fahrenheit' }, quantity: 'temperature', factor: 1, offset: 0 }] }
  tree.rows = []; tree.byId = new Map(); tree.loaded = true; tree.load = async () => {}
  const gesendet = []
  globalThis.fetch = async (url, opt = {}) => {
    if (opt.method === 'PUT') { gesendet.push({ pfad: String(url), body: JSON.parse(opt.body) }); return { ok: true, status: 200, text: async () => '{}', json: async () => ({}) } }
    const antwort = /\/api\/model$/.test(String(url)) ? store.model : []
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  const router = { path: '/model', push(p) { this.path = p }, replace(p) { this.path = p } }
  const route = { path: '/model', query: { section: 'units', key: '°F' }, params: {}, name: 'model', hash: '', fullPath: '/model', matched: [], meta: {} }
  const w = mount(ModelView, { global: { provide: { [routerKey]: router, [routeLocationKey]: route }, stubs: { RouterLink: true, 'router-link': true, Splitter: true, AttrBulk: true, EditGrid: true } } })
  return { w, gesendet }
}
const zeile = (w, name) => w.findAll('tr').find(tr => tr.find('td.attr')?.text() === name)
async function eintragen(w, name, text) {
  const z = zeile(w, name)
  await z.find('.cell-box').trigger('keydown', { key: 'Enter' }); await flushPromises()
  const feld = z.find('input.cell-input')
  await feld.setValue(text); await feld.trigger('keydown', { key: 'Enter' }); await flushPromises()
}

test('Faktor als Bruch: 5/9 geht als Zahl hinaus', async () => {
  const { w, gesendet } = welt(); await flushPromises()
  await eintragen(w, '× Basis', '5/9')
  assert.match(gesendet.at(-1).pfad, /\/api\/model\/units\/(%C2%B0F|°F)$/)
  assert.equal(gesendet.at(-1).body.factor, 5 / 9)
})

test('Verschiebung als Bruch: −160/9 geht als Zahl hinaus; der Faktor bleibt', async () => {
  const { w, gesendet } = welt(); await flushPromises()
  await eintragen(w, '+ Verschiebung', '-160/9')
  assert.equal(gesendet.at(-1).body.offset, -160 / 9)
  assert.equal(gesendet.at(-1).body.factor, 1)
})

test('die Verschiebung leeren setzt sie auf 0', async () => {
  const { w, gesendet } = welt(); await flushPromises()
  await eintragen(w, '+ Verschiebung', '-17.5')
  assert.equal(gesendet.at(-1).body.offset, -17.5)
  store.model.units[1].offset = -17.5; await flushPromises()
  await eintragen(w, '+ Verschiebung', '')
  assert.equal(gesendet.at(-1).body.offset, 0)
})
