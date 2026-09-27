// ▨ Medien: eine neue Fassung — die Datei wird ein neues Medium und ersetzt das alte. Die Zuordnungen wandern
// (Server), der Vorgänger bleibt für Belege und Versionen auflösbar, die Liste zeigt ihn nur auf Wunsch.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'
import { menu } from '../src/menu.js'
import { tree } from '../src/tree.js'

const MediaView = (await import('../src/views/MediaView.vue')).default

const medium = (id, name, extra = {}) => ({
  id, name, mime: 'image/jpeg', isImage: true, sha256: id.repeat(8), bytes: 1000, renderable: true, hasThumb: true,
  values: [], external: {}, used: 0, entries: 1, lastNumber: 1, lastAt: '2026-09-27T08:00:00Z', lastActor: 'u1', folder: null,
  probe: null, pixels: 0, source: null, createdAt: '2026-09-27T08:00:00Z', createdBy: 'u1', supersededBy: null, supersedes: null, ...extra,
})

/// Das Modell steht auch hinter /api/model — store.poll(true) holt es nach dem Ersetzen neu, und dann muss dasselbe zurückkommen
const MODELL = { masterLocale: 'de', locales: [{ code: 'de' }], channels: [], attributes: [], groups: [], statuses: [], lists: [], relationTypes: [] }

function welt(medien) {
  store.actor = 'u1'
  store.toasts = []
  store.model = MODELL
  tree.load = async () => {}
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url)
    rufe.push({ pfad, methode: opt.method ?? 'GET', rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : null })
    const antwort = /\/usage|\/suggestions/.test(pfad) ? []
      : /\/api\/health/.test(pfad) ? { head: 1, nodes: 0 }
      : /\/api\/model/.test(pfad) ? MODELL
      : /\/facets/.test(pfad) ? { art: [], herkunft: [], stichworte: [], ohneStichwort: 0, total: medien.length }
      : pfad.includes('/api/media/folders') ? { total: medien.length, unfiled: medien.length, folders: [] }
      : pfad.endsWith('/api/media') && opt.method === 'POST' ? { id: 'm-neu', name: 'v2.jpg', existed: false }
      : /\/supersede/.test(pfad) ? { stream: 'm1' }
      : /\/api\/media\?/.test(pfad) ? medien.filter(m => /superseded=true/.test(pfad) || !m.supersededBy)
      : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}

async function bibliothek(medien) {
  const rufe = welt(medien)
  const router = { path: '/media', push(p) { this.path = p }, replace(p) { this.path = p } }
  const w = mount(MediaView, { global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, TreePicker: true } } })
  await flushPromises()
  return { w, rufe }
}

const kachel = (w, name) => w.findAll('.tile').find(t => t.find('.name')?.text() === name)
const eintrag = label => menu.items.find(i => i.label && new RegExp(label).test(i.label))
const datei = new File([new Uint8Array([1, 2, 3])], 'v2.jpg', { type: 'image/jpeg' })

test('das Menü bietet die neue Fassung — nur für eine einzelne Kachel', async () => {
  const { w } = await bibliothek([medium('m1', 'v1.jpg'), medium('m2', 'x.jpg')])
  await kachel(w, 'v1.jpg').trigger('contextmenu')
  assert.ok(eintrag('Neue Fassung'), 'der Eintrag fehlt')

  await kachel(w, 'v1.jpg').trigger('click')
  await kachel(w, 'x.jpg').trigger('click', { ctrlKey: true })
  await kachel(w, 'x.jpg').trigger('contextmenu')
  assert.equal(eintrag('Neue Fassung'), undefined, 'bei einer Auswahl darf es den Eintrag nicht geben')
})

test('die Datei wird hochgeladen und ersetzt dann das alte Medium', async () => {
  const { w, rufe } = await bibliothek([medium('m1', 'v1.jpg')])
  await kachel(w, 'v1.jpg').trigger('contextmenu')
  eintrag('Neue Fassung').action()
  // der Dateidialog: die Auswahl kommt über das verborgene Feld
  const feld = w.find('input[type=file]:not([multiple])')
  Object.defineProperty(feld.element, 'files', { value: [datei] })
  await feld.trigger('change')
  await flushPromises()

  const hoch = rufe.find(r => r.pfad.endsWith('/api/media') && r.methode === 'POST')
  assert.ok(hoch, 'nichts hochgeladen')
  const ersetzt = rufe.find(r => /\/api\/media\/m1\/supersede/.test(r.pfad))
  assert.ok(ersetzt, 'nichts ersetzt')
  assert.deepEqual(ersetzt.rumpf, { by: 'm-neu' })
  assert.match(store.toasts.at(-1)?.text ?? '', /v1.jpg ersetzt durch v2.jpg/)
})

test('ein abgelöstes Medium ist als solches zu sehen und führt zur aktuellen Fassung', async () => {
  const alt = medium('m1', 'v1.jpg', { supersededBy: 'm2' }); const neu = medium('m2', 'v2.jpg', { supersedes: 'm1' })
  const { w, rufe } = await bibliothek([alt, neu])
  assert.equal(kachel(w, 'v1.jpg'), undefined, 'die Liste zeigt den Vorgänger ungefragt')

  await w.findAll('.facets .chip').find(c => /abgelöste/.test(c.text())).trigger('click')
  await flushPromises()
  assert.match(rufe.filter(r => /\/api\/media\?/.test(r.pfad)).at(-1).pfad, /superseded=true/)
  assert.ok(kachel(w, 'v1.jpg').classes('abgeloest'))

  await kachel(w, 'v1.jpg').trigger('click')
  await flushPromises()
  const sprung = w.find('button.ersetzt')
  assert.match(sprung.text(), /m2/)
})

test('der Nachfolger nennt, wen er abgelöst hat', async () => {
  const { w } = await bibliothek([medium('m2', 'v2.jpg', { supersedes: 'm1' })])
  await kachel(w, 'v2.jpg').trigger('click')
  await flushPromises()
  const zeile = w.findAll('.form tr').find(tr => tr.find('td')?.text() === 'ersetzt')
  assert.ok(zeile, 'die Zeile „ersetzt“ fehlt')
  assert.match(zeile.text(), /m1/)
})
