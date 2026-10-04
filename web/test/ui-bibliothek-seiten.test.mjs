// ▨ Medien in Seiten (04.10.2026): die Bibliothek lädt 300 Kacheln, nicht 2 000 — „▼ weitere“ holt die nächsten, die Gesamtzahl steht in den Facetten.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'

const MediaView = (await import('../src/views/MediaView.vue')).default

const medium = i => ({
  id: 'm' + i, sha256: String(i).padStart(64, '0'), bytes: 1000, mime: 'image/jpeg', name: `bild${String(i).padStart(3, '0')}.jpg`, isImage: true, renderable: true, hasThumb: true,
  values: [], external: {}, used: 0, entries: 1, lastNumber: i, lastAt: '2026-10-04T08:00:00Z', lastActor: 'u1', folder: null, probe: null, pixels: 0, source: null,
  createdAt: '2026-10-04T08:00:00Z', createdBy: 'u1',
})
const ALLE = Array.from({ length: 420 }, (_, i) => medium(i))

test('300 Kacheln, „▼ weitere 120“ holt den Rest ab skip=300, danach kein Knopf mehr', async () => {
  store.actor = 'u1'; store.toasts = []
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], statuses: [] }
  const rufe = []
  globalThis.fetch = async url => {
    const pfad = String(url); rufe.push(pfad)
    const q = new URL(pfad, 'http://x').searchParams
    const antwort = pfad.includes('/api/media/folders') ? { total: ALLE.length, unfiled: ALLE.length, folders: [] }
      : pfad.includes('/api/media/facets') ? { art: [], herkunft: [], stichworte: [], zustaende: [], total: ALLE.length }
      : /\/workflow$/.test(pfad) ? []
      : pfad.startsWith('/api/media?') ? ALLE.slice(Number(q.get('skip') ?? 0), Number(q.get('skip') ?? 0) + Number(q.get('limit')))
      : []
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  const router = { path: '/media', push(p) { this.path = p }, replace(p) { this.path = p } }
  const w = mount(MediaView, { global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true } } })
  await flushPromises()
  assert.ok(rufe.some(p => p.startsWith('/api/media?limit=300&')), rufe.join('\n'))
  assert.equal(w.findAll('.tile').length, 300)
  assert.match(w.find('.toolbar .muted').text(), /300 von 420/)
  const knopf = w.find('button.mehr')
  assert.match(knopf.text(), /weitere 120/)
  await knopf.trigger('click'); await flushPromises()
  assert.ok(rufe.some(p => /^\/api\/media\?limit=300&skip=300&/.test(p)))
  assert.equal(w.findAll('.tile').length, 420)
  assert.equal(w.find('button.mehr').exists(), false)
  w.unmount()
})
