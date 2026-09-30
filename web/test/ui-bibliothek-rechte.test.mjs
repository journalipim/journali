// ▨ Medien und das Recht „download“ (27.09.2026): sehen ist nicht haben. Ohne das Recht fehlt der Weg zur Datei —
// kein Link, kein PDF-Rahmen, kein Zuschnitt, kein Doppelklick —, nicht bloss ein gesperrter Knopf. Dazu die
// Frist: eine abgelaufene Kachel ist als solche zu sehen, und die Facette „abgelaufen“ filtert danach.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'
import { menu } from '../src/menu.js'

const MediaView = (await import('../src/views/MediaView.vue')).default

const medium = (id, name, mime, isImage, extra = {}) => ({
  id, name, mime, isImage, sha256: id.repeat(8), bytes: 1000, renderable: isImage, hasThumb: true,
  values: [], external: {}, used: 0, entries: 1, lastNumber: 1, lastAt: '2026-09-27T08:00:00Z', lastActor: 'u1', folder: null,
  probe: null, pixels: 0, source: null, createdAt: '2026-09-27T08:00:00Z', createdBy: 'u1', supersededBy: null, supersedes: null,
  valid: true, expired: false, ...extra,
})
const MEDIEN = [medium('m1', 'vorne.jpg', 'image/jpeg', true), medium('m2', 'blatt.pdf', 'application/pdf', false),
  medium('m3', 'alt.jpg', 'image/jpeg', true, { valid: false, expired: true })]
const FACETS = { art: [], herkunft: [], stichworte: [], ohneStichwort: 0, abgelaufen: 1, total: 3 }

function welt(rechte) {
  store.actor = 'u1'; store.toasts = []
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], statuses: [], lists: [], relationTypes: [] }
  // Anmeldung an: die Rechte kommen vom Server, can() liest sie
  store.auth = { known: true, enabled: true, setup: false, user: 'u1', role: 'x', name: 'U', rights: rechte }
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url); rufe.push({ pfad, methode: opt.method ?? 'GET' })
    const antwort = /\/usage|\/suggestions/.test(pfad) ? [] : /\/facets/.test(pfad) ? FACETS
      : pfad.includes('/api/media/folders') ? { total: 3, unfiled: 3, folders: [] }
      : /\/api\/media\?/.test(pfad) ? (/valid=expired/.test(pfad) ? MEDIEN.filter(m => m.expired) : MEDIEN) : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}
async function bibliothek(rechte) {
  const rufe = welt(rechte)
  const router = { path: '/media', push(p) { this.path = p }, replace(p) { this.path = p } }
  const w = mount(MediaView, { global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, TreePicker: true } } })
  await flushPromises()
  return { w, rufe }
}
const kachel = (w, name) => w.findAll('.tile').find(t => t.find('.name')?.text() === name)
const eintrag = label => menu.items.find(i => i.label && new RegExp(label).test(i.label))
test.afterEach(() => { store.auth = { known: false, enabled: false, setup: false, user: null, role: null, name: null, rights: null } })

test('ohne download: kein Link zur Datei, kein PDF-Rahmen, kein Zuschnitt, kein Doppelklick', async () => {
  const { w } = await bibliothek(['read'])
  await kachel(w, 'blatt.pdf').trigger('click'); await flushPromises()
  assert.equal(w.find('a[href*="/file?name="]').exists(), false, 'der Datei-Link steht da')
  assert.equal(w.findComponent({ name: 'PdfPane' }).exists(), false, 'die PDF-Anzeige lädt die Datei')

  await kachel(w, 'vorne.jpg').trigger('click'); await flushPromises()
  assert.equal(w.find('.preview-full img[src$="/file"]').exists(), false, 'die Vorschau lädt das Original')
  assert.ok(w.find('.preview-full img[src*="/thumb"]').exists(), 'die Kachel darf, wer liest')
  assert.equal(w.findAll('button').some(b => b.text() === '✂'), false, 'der Zuschnitt steht da')
  await kachel(w, 'vorne.jpg').trigger('contextmenu')
  assert.equal(eintrag('Zuschneiden'), undefined)

  const gerufen = []; globalThis.window.open = (...a) => { gerufen.push(a); return null }
  await kachel(w, 'vorne.jpg').trigger('dblclick')
  assert.equal(gerufen.length, 0, 'der Doppelklick öffnet die Datei')
})

test('mit download ist der Weg da', async () => {
  const { w } = await bibliothek(['read', 'download'])
  await kachel(w, 'blatt.pdf').trigger('click'); await flushPromises()
  assert.ok(w.find('a[href*="/file?name="]').exists())
  assert.ok(w.findComponent({ name: 'PdfPane' }).exists())
  await kachel(w, 'vorne.jpg').trigger('contextmenu')
  assert.ok(eintrag('Zuschneiden'))
})

test('ohne Anmeldung gilt alles wie bisher', async () => {
  const { w } = await bibliothek(null)
  store.auth.enabled = false
  await kachel(w, 'blatt.pdf').trigger('click'); await flushPromises()
  assert.ok(w.find('a[href*="/file?name="]').exists())
})

test('eine abgelaufene Kachel ist zu erkennen, und die Facette filtert danach', async () => {
  const { w, rufe } = await bibliothek(['read'])
  assert.ok(kachel(w, 'alt.jpg').classes('ungueltig'))
  assert.match(kachel(w, 'alt.jpg').find('.meta').text(), /⌛/)
  assert.equal(kachel(w, 'vorne.jpg').classes('ungueltig'), false)

  const facette = w.findAll('.facets .chip').find(c => /abgelaufen/.test(c.text()))
  assert.ok(facette, 'die Facette fehlt'); assert.match(facette.text(), /1/)
  await facette.trigger('click'); await flushPromises()
  assert.match(rufe.filter(r => /\/api\/media\?/.test(r.pfad)).at(-1).pfad, /valid=expired/)
  assert.equal(w.findAll('.tile').length, 1)
})
