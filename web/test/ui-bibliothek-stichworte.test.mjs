// ▨ Medien: Stichwörter am Asset, Vorschläge dazu und die Facetten über der Liste.
// Bei automatischem Import verschlagwortet niemand von Hand — darum schlägt der Server vor und ein Klick nimmt an.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'

const MediaView = (await import('../src/views/MediaView.vue')).default

const BILD = {
  id: 'm1', sha256: 'a'.repeat(64), bytes: 1000, mime: 'image/jpeg', name: 'bohrer_vorne.jpg', isImage: true, renderable: true, hasThumb: true,
  values: [{ attribute: 'keywords', locale: null, channel: null, value: null, values: ['bohrer'] }],
  external: {}, used: 0, entries: 1, lastNumber: 1, lastAt: '2026-09-27T08:00:00Z', lastActor: 'u1', folder: null,
  probe: null, pixels: 0, source: { plugin: 'ixp', profile: null, job: null, ref: null, from: null }, createdAt: '2026-09-27T08:00:00Z', createdBy: 'job:ixp',
}

const FACETS = {
  art: [{ key: 'image', label: 'Bilder', n: 1 }, { key: 'doc', label: 'Dokumente', n: 0 }],
  herkunft: [{ key: 'ixp', n: 7 }, { key: '-', n: 3 }],
  stichworte: [{ key: 'bohrer', label: { de: 'Bohrer', en: 'Drill' }, n: 5 }, { key: 'zubehoer', label: { de: 'Zubehör' }, n: 2 }],
  ohneStichwort: 4, total: 10,
}
const VORSCHLAEGE = [
  { key: 'metall', label: { de: 'Metall' }, why: 'Dateiname' },
  { key: 'zubehoer', label: { de: 'Zubehör' }, why: 'am selben Knoten' },
]

function welt() {
  store.actor = 'u1'
  store.toasts = []
  store.model = {
    masterLocale: 'de', locales: [{ code: 'de' }], statuses: [], groups: [],
    lists: [{ key: 'keyword', label: { de: 'Stichwörter' }, values: [
      { value: 'bohrer', label: { de: 'Bohrer', en: 'Drill' } },
      { value: 'metall', label: { de: 'Metall' } },
      { value: 'zubehoer', label: { de: 'Zubehör' } },
    ] }],
    attributes: [
      { key: 'alt_text', label: { de: 'Alt-Text' }, type: 'text', group: 'media', perLocale: true },
      { key: 'keywords', label: { de: 'Stichwörter' }, type: 'enum', group: 'media', list: 'keyword', multiple: true },
    ],
  }
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url)
    rufe.push({ pfad, methode: opt.method ?? 'GET', rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : null })
    const antwort = /\/facets/.test(pfad) ? FACETS
      : /\/suggestions/.test(pfad) ? VORSCHLAEGE
      : /\/usage/.test(pfad) ? []
      : pfad.includes('/api/media/folders') ? { total: 1, unfiled: 1, folders: [] }
      : /\/api\/media\?/.test(pfad) ? [BILD]
      : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}

async function bibliothek() {
  const rufe = welt()
  const router = { path: '/media', push(p) { this.path = p }, replace(p) { this.path = p } }
  const w = mount(MediaView, { global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true } } })
  await flushPromises()
  return { w, rufe }
}

const kachel = (w, name) => w.findAll('.tile').find(t => t.find('.name')?.text() === name)
const reiter = async (w, sym) => { const t = w.findAll('.tab').find(t => t.text() === sym); if (t) await t.trigger('click') }
const facette = (w, text) => w.findAll('.facets .chip').find(c => c.text().includes(text))
const letzteListe = rufe => rufe.filter(r => /\/api\/media\?/.test(r.pfad)).at(-1).pfad

test('die Facetten stehen mit Anzahl über der Liste', async () => {
  const { w } = await bibliothek()
  assert.ok(facette(w, 'ixp'), 'die Herkunft fehlt als Facette')
  assert.match(facette(w, 'ixp').text(), /7/)
  assert.match(facette(w, 'von Hand').text(), /3/)
  assert.match(facette(w, 'Bohrer').text(), /5/)
  assert.match(facette(w, 'ohne Stichwort').text(), /4/)
})

test('ein Stichwort anklicken schränkt die Liste ein, nochmal klicken hebt es auf', async () => {
  const { w, rufe } = await bibliothek()
  await facette(w, 'Bohrer').trigger('click')
  await flushPromises()
  assert.match(letzteListe(rufe), /keyword=bohrer/)
  assert.equal(facette(w, 'Bohrer').classes('on'), true)

  await facette(w, 'Bohrer').trigger('click')
  await flushPromises()
  assert.match(letzteListe(rufe), /keyword=(&|$)/)
  assert.equal(facette(w, 'Bohrer').classes('on'), false)
})

test('zwei Stichwörter gelten zusammen', async () => {
  const { w, rufe } = await bibliothek()
  await facette(w, 'Bohrer').trigger('click'); await flushPromises()
  await facette(w, 'Zubehör').trigger('click'); await flushPromises()

  assert.match(letzteListe(rufe), /keyword=bohrer%2Czubehoer/)
})

test('die Herkunft ist eine Facette für sich', async () => {
  const { w, rufe } = await bibliothek()
  await facette(w, 'von Hand').trigger('click')
  await flushPromises()
  assert.match(letzteListe(rufe), /plugin=-/)
})

test('die Stichwörter stehen als vermehrbare Zelle am Asset', async () => {
  const { w } = await bibliothek()
  await kachel(w, 'bohrer_vorne.jpg').trigger('click')
  await flushPromises()
  await reiter(w, '≡')

  const zeile = w.findAll('.form tr').find(tr => tr.find('td')?.text().includes('Stichwörter'))
  assert.ok(zeile, 'die Zeile der Stichwörter fehlt')
  assert.match(zeile.text(), /Bohrer/)   // die Bezeichnung aus der Werteliste, nicht der Schlüssel
})

test('ein Vorschlag wird erst durch Annehmen ein Wert', async () => {
  const { w, rufe } = await bibliothek()
  await kachel(w, 'bohrer_vorne.jpg').trigger('click')
  await flushPromises()
  await reiter(w, '≡')

  const chips = w.findAll('.sug .chip')
  assert.equal(chips.length, 2)
  assert.match(chips[0].text(), /Metall/)
  assert.match(chips[0].attributes('title') ?? '', /Dateiname/)
  assert.equal(rufe.filter(r => /attributes/.test(r.pfad)).length, 0, 'ein Vorschlag wurde ungefragt geschrieben')

  await chips[0].trigger('click')
  await flushPromises()
  const geschrieben = rufe.find(r => /attributes/.test(r.pfad))
  assert.ok(geschrieben, 'das Annehmen hat nichts geschrieben')
  assert.deepEqual(geschrieben.rumpf.values, ['bohrer', 'metall'])   // das Vorhandene bleibt
})
