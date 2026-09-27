// ▨ Medien: der Workflow am Asset — derselbe wie am Knoten. Rechts der Zustand mit den Schritten, die meine Rolle
// gehen darf; über der Liste die Zustände als Facette; an der Kachel die Fahne in der Farbe des Zustands.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'
import { dialog } from '../src/dialog.js'
import { tree } from '../src/tree.js'

const MediaView = (await import('../src/views/MediaView.vue')).default

const ZUSTAND = { workflow: 'bild', label: { de: 'Bildfreigabe' }, state: 'draft', stateLabel: { de: 'Entwurf' }, color: 'muted', final: false }
const medium = (id, name) => ({
  id, name, mime: 'image/jpeg', isImage: true, sha256: id.repeat(8), bytes: 1000, renderable: true, hasThumb: true,
  values: [], external: {}, used: 0, entries: 1, lastNumber: 1, lastAt: '2026-09-27T08:00:00Z', lastActor: 'u1', folder: null,
  probe: null, pixels: 0, source: null, createdAt: '2026-09-27T08:00:00Z', createdBy: 'u1', supersededBy: null, supersedes: null,
  valid: true, expired: false, workflow: [ZUSTAND],
})
const WF = [{ ...ZUSTAND, since: null, actor: null, note: null, transition: null, assigned: null, states: [],
  transitions: [{ key: 'release', label: { de: 'freigeben' }, to: 'ok', noteRequired: false, effects: ['release:web'], toLabel: { de: 'Freigegeben' } },
                { key: 'back', label: { de: 'zurück' }, to: 'draft', noteRequired: true, effects: null, toLabel: { de: 'Entwurf' } }],
  all: [] }]
const FACETS = { art: [], herkunft: [], stichworte: [], ohneStichwort: 0, abgelaufen: 0, total: 1,
  zustaende: [{ key: 'bild:draft', workflow: 'bild', label: { de: 'Bildfreigabe' }, state: 'draft', stateLabel: { de: 'Entwurf' }, color: 'muted', n: 1 }] }
const MODELL = { masterLocale: 'de', locales: [{ code: 'de' }], channels: [], attributes: [], groups: [], statuses: [], lists: [], relationTypes: [] }

function welt() {
  store.actor = 'u1'; store.toasts = []; store.model = MODELL; tree.load = async () => {}
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url); rufe.push({ pfad, methode: opt.method ?? 'GET', rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : null })
    const antwort = /\/usage|\/suggestions/.test(pfad) ? [] : /\/workflow$/.test(pfad) ? WF
      : /\/workflow\//.test(pfad) ? { stream: 'm1' }
      : /\/api\/health/.test(pfad) ? { head: 1, nodes: 0 } : /\/api\/model/.test(pfad) ? MODELL
      : /\/facets/.test(pfad) ? FACETS : pfad.includes('/api/media/folders') ? { total: 1, unfiled: 1, folders: [] }
      : /\/api\/media\?/.test(pfad) ? [medium('m1', 'vorne.jpg')] : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}
async function bibliothek() {
  const rufe = welt()
  const router = { path: '/media', push(p) { this.path = p }, replace(p) { this.path = p } }
  const w = mount(MediaView, { global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, TreePicker: true } } })
  await flushPromises(); return { w, rufe }
}
const kachel = (w, name) => w.findAll('.tile').find(t => t.find('.name')?.text() === name)

test('rechts steht der Zustand mit den Schritten, die ich gehen darf', async () => {
  const { w } = await bibliothek()
  await kachel(w, 'vorne.jpg').trigger('click'); await flushPromises()
  const wf = w.find('.wf'); assert.ok(wf.exists(), 'der Abschnitt fehlt')
  assert.match(wf.find('.chip').text(), /Entwurf/)
  const knoepfe = wf.findAll('button').map(b => b.text())
  assert.deepEqual(knoepfe, ['freigeben →', 'zurück →'])
  assert.match(wf.findAll('button')[0].attributes('title') ?? '', /am Asset ohne Wirkung: release:web/)
})

test('ein Schritt ohne Notizpflicht geht sofort', async () => {
  const { w, rufe } = await bibliothek()
  await kachel(w, 'vorne.jpg').trigger('click'); await flushPromises()
  await w.find('.wf').findAll('button')[0].trigger('click'); await flushPromises()
  const schritt = rufe.find(r => /\/api\/media\/m1\/workflow\/bild\/release$/.test(r.pfad) && r.methode === 'POST')
  assert.ok(schritt, 'der Schritt wurde nicht geschrieben'); assert.deepEqual(schritt.rumpf, { note: null })
})

test('ein Schritt mit Notizpflicht fragt und schreibt die Notiz', async () => {
  const { w, rufe } = await bibliothek()
  dialog.prompt = async () => 'Logo fehlt'
  await kachel(w, 'vorne.jpg').trigger('click'); await flushPromises()
  await w.find('.wf').findAll('button')[1].trigger('click'); await flushPromises()
  const schritt = rufe.find(r => /\/workflow\/bild\/back$/.test(r.pfad))
  assert.ok(schritt); assert.deepEqual(schritt.rumpf, { note: 'Logo fehlt' })
})

test('die Zustände sind eine Facette, und die Kachel trägt die Fahne', async () => {
  const { w, rufe } = await bibliothek()
  assert.match(kachel(w, 'vorne.jpg').find('.meta').text(), /⚑/)
  const facette = w.findAll('.facets .chip').find(c => /Entwurf/.test(c.text()))
  assert.ok(facette, 'die Facette fehlt')
  await facette.trigger('click'); await flushPromises()
  assert.match(rufe.filter(r => /\/api\/media\?/.test(r.pfad)).at(-1).pfad, /state=bild%3Adraft/)
})
