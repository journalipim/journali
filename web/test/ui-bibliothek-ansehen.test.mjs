// ▨ Medien, rechte Spalte: was der Server seit Block A liefert, muss auch zu sehen sein — Mass, Auflösung,
// Farbraum, Transparenz, Herkunft, Importdatum. Dazu ein PDF, das der Browser selbst zeigt, und der Doppelklick
// auf eine Kachel, der die Datei öffnet.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'

const MediaView = (await import('../src/views/MediaView.vue')).default

const BILD = {
  id: 'm1', sha256: 'a'.repeat(64), bytes: 240_000, mime: 'image/jpeg', name: 'vorne.jpg', isImage: true, renderable: true, hasThumb: true,
  values: [], external: {}, used: 2, entries: 3, lastNumber: 42, lastAt: '2026-09-27T08:00:00Z', lastActor: 'u1', folder: null,
  probe: { width: 4000, height: 3000, dpi: 300, space: 'srgb', alpha: false }, pixels: 12_000_000,
  source: { plugin: 'ixp', profile: 'import:lieferant', job: 'ixp', ref: 'https://example.invalid/bild.jpg', from: null },
  createdAt: '2026-09-27T07:30:00Z', createdBy: 'job:ixp',
}
const PDF = {
  ...BILD, id: 'm2', mime: 'application/pdf', name: 'datenblatt.pdf', isImage: false, sha256: 'b'.repeat(64),
  probe: { width: 0, height: 0, dpi: null, space: null, alpha: null }, pixels: 0,
  source: null, createdBy: 'u1',
}
const OHNE = { ...BILD, id: 'm3', name: 'neu.tif', mime: 'image/tiff', probe: null, pixels: 0, source: null, createdBy: 'u1' }

function welt(medien) {
  store.actor = 'u1'
  store.toasts = []
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], statuses: [] }
  globalThis.fetch = async url => {
    const pfad = String(url)
    const antwort = pfad.includes('/api/media/folders') ? { total: medien.length, unfiled: medien.length, folders: [] } : medien
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
}

async function bibliothek(medien) {
  welt(medien)
  const w = mount(MediaView, { global: { stubs: { RouterLink: true, 'router-link': true, MediaThumb: true } } })
  await flushPromises()
  return w
}

/// Die Zeile des Formulars rechts, deren erste Spalte diesen Text enthält
const feld = (w, label) => w.findAll('.form tr').find(tr => tr.find('td')?.text().includes(label))
const kachel = (w, name) => w.findAll('.tile').find(t => t.find('.name')?.text() === name)

test('das Mass des Originals steht rechts, mit Megapixeln', async () => {
  const w = await bibliothek([BILD])
  await kachel(w, 'vorne.jpg').trigger('click')
  await flushPromises()

  assert.match(feld(w, 'Maß').text(), /4000 × 3000 px/)
  assert.match(feld(w, 'Maß').text(), /12,0 MP/)
  assert.match(feld(w, 'Auflösung').text(), /300 dpi/)
  assert.match(feld(w, 'Farbraum').text(), /srgb/)
  assert.match(feld(w, 'Transparenz').text(), /–/)
})

test('die Herkunft nennt Schnittstelle, Profil, Job und Bezug', async () => {
  const w = await bibliothek([BILD])
  await kachel(w, 'vorne.jpg').trigger('click')
  await flushPromises()

  assert.match(feld(w, 'Herkunft').text(), /ixp/)
  assert.match(feld(w, 'Herkunft').text(), /import:lieferant/)
  assert.match(feld(w, 'Bezug').text(), /example\.invalid/)
  assert.match(feld(w, 'Angelegt').text(), /job:ixp/)
})

test('ohne Herkunft steht dort „von Hand“', async () => {
  const w = await bibliothek([OHNE])
  await kachel(w, 'neu.tif').trigger('click')
  await flushPromises()

  assert.match(feld(w, 'Herkunft').text(), /von Hand/)
  assert.equal(feld(w, 'Bezug'), undefined, 'ohne Bezug soll die Zeile fehlen')
})

/// Zwei Gründe für „kein Mass“, und sie bedeuten Verschiedenes — das sagt der Tooltip, nicht der sichtbare Text.
test('noch nicht gelesen und kein bekanntes Format sind zweierlei', async () => {
  const w = await bibliothek([OHNE, PDF])
  await kachel(w, 'neu.tif').trigger('click')
  await flushPromises()
  const offen = feld(w, 'Maß').findAll('td')[1]
  assert.equal(offen.text(), '—')
  assert.match(offen.attributes('title') ?? '', /liest die Masse nach/)

  await kachel(w, 'datenblatt.pdf').trigger('click')
  await flushPromises()
  const unbekannt = feld(w, 'Maß').findAll('td')[1]
  assert.equal(unbekannt.text(), '—')
  assert.match(unbekannt.attributes('title') ?? '', /Kein Format/)
})

test('ein PDF wird ganz gezeigt, nicht nur seine erste Seite', async () => {
  const w = await bibliothek([PDF])
  await kachel(w, 'datenblatt.pdf').trigger('click')
  await flushPromises()

  const rahmen = w.find('.preview iframe.pdf')
  assert.ok(rahmen.exists(), 'für ein PDF fehlt die Anzeige')
  assert.match(rahmen.attributes('src'), /\/api\/media\/m2\/file/)
  assert.equal(w.find('.preview img').exists(), false, 'neben dem PDF steht noch ein Bild')
})

test('ein Bild bleibt ein Bild — kein Rahmen für ein PDF', async () => {
  const w = await bibliothek([BILD])
  await kachel(w, 'vorne.jpg').trigger('click')
  await flushPromises()

  assert.equal(w.find('.preview iframe.pdf').exists(), false)
  assert.match(w.find('.preview img').attributes('src'), /\/api\/media\/m1\/file/)
})

test('Doppelklick auf eine Kachel öffnet die Datei', async () => {
  const w = await bibliothek([BILD])
  const gerufen = []
  globalThis.window.open = (...a) => { gerufen.push(a); return null }
  await kachel(w, 'vorne.jpg').trigger('dblclick')

  assert.equal(gerufen.length, 1)
  assert.equal(gerufen[0][0], '/api/media/m1/file')
  assert.equal(gerufen[0][1], '_blank')
})

test('der Tooltip der Kachel nennt den Doppelklick', async () => {
  const w = await bibliothek([BILD])
  assert.match(kachel(w, 'vorne.jpg').attributes('title') ?? '', /Doppelklick öffnet die Datei/)
})
