// ✂ Zuschneiden und Ausrichten: im Browser auf der Leinwand, das Ergebnis ein neues Medium mit Abstammung —
// wahlweise gleich als neue Version. Geprüft an ersetzter Leinwand: was gezeichnet und was hochgeladen wird.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'
import { menu } from '../src/menu.js'
import { tree } from '../src/tree.js'

const MediaView = (await import('../src/views/MediaView.vue')).default
const CropEditor = (await import('../src/components/CropEditor.vue')).default

const medium = (id, name, mime, isImage, extra = {}) => ({
  id, name, mime, isImage, sha256: id.repeat(8), bytes: 1000, renderable: isImage, hasThumb: isImage,
  values: [], external: {}, used: 0, entries: 1, lastNumber: 1, lastAt: '2026-09-27T08:00:00Z', lastActor: 'u1', folder: null,
  probe: null, pixels: 0, source: null, createdAt: '2026-09-27T08:00:00Z', createdBy: 'u1', supersededBy: null, supersedes: null, ...extra,
})
const MODELL = { masterLocale: 'de', locales: [{ code: 'de' }], channels: [], attributes: [], groups: [], statuses: [], lists: [], relationTypes: [] }

/// Bild und Leinwand ersetzen: ein Bild von 4000 × 3000, eine Leinwand, die aufschreibt, was auf sie gezeichnet wird
const gezeichnet = []
function leinwand() {
  globalThis.Image = class {
    constructor() { this.naturalWidth = 4000; this.naturalHeight = 3000 }
    set src(v) { this._src = v; queueMicrotask(() => this.onload?.()) }
    get src() { return this._src }
  }
  HTMLCanvasElement.prototype.getContext = function () {
    const c = this
    return { translate() {}, rotate() {}, fillRect() {}, strokeRect() {}, drawImage(...a) { gezeichnet.push({ ziel: [c.width, c.height], args: a.length }) }, set fillStyle(v) {}, set strokeStyle(v) {}, set lineWidth(v) {} }
  }
  HTMLCanvasElement.prototype.toBlob = function (cb, type) { cb(new Blob([new Uint8Array([1, 2, 3])], { type })) }
  HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0 })
  gezeichnet.length = 0
}

function welt(medien) {
  store.actor = 'u1'; store.toasts = []; store.model = MODELL
  tree.load = async () => {}
  leinwand()
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url)
    rufe.push({ pfad, methode: opt.method ?? 'GET', rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : opt.body })
    const antwort = /\/usage|\/suggestions/.test(pfad) ? []
      : /\/api\/health/.test(pfad) ? { head: 1, nodes: 0 }
      : /\/api\/model/.test(pfad) ? MODELL
      : /\/facets/.test(pfad) ? { art: [], herkunft: [], stichworte: [], ohneStichwort: 0, total: medien.length }
      : pfad.includes('/api/media/folders') ? { total: medien.length, unfiled: medien.length, folders: [] }
      : pfad.endsWith('/api/media') && opt.method === 'POST' ? { id: 'm-neu', name: 'vorne-zuschnitt.jpg', existed: false }
      : /\/supersede/.test(pfad) ? { stream: 'm1' }
      : /\/api\/media\?/.test(pfad) ? medien
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
const knopf = (w, text) => w.findAll('button').find(b => new RegExp(text).test(b.text()))
const BILD = medium('m1', 'vorne.jpg', 'image/jpeg', true)

test('der Zuschnitt steht nur für ein Bild im Menü, nicht für ein PDF', async () => {
  const { w } = await bibliothek([BILD, medium('m2', 'blatt.pdf', 'application/pdf', false)])
  await kachel(w, 'vorne.jpg').trigger('contextmenu')
  assert.ok(eintrag('Zuschneiden'), 'für ein Bild fehlt der Eintrag')
  await kachel(w, 'blatt.pdf').trigger('contextmenu')
  assert.equal(eintrag('Zuschneiden'), undefined, 'für ein PDF darf es ihn nicht geben')
})

test('der Editor öffnet mit dem ganzen Bild als Ausschnitt', async () => {
  const { w } = await bibliothek([BILD])
  await kachel(w, 'vorne.jpg').trigger('contextmenu')
  eintrag('Zuschneiden').action()
  await flushPromises(); await flushPromises()
  const ed = w.findComponent(CropEditor)
  assert.ok(ed.exists(), 'der Editor fehlt')
  assert.deepEqual(ed.vm.crop, { x: 0, y: 0, w: 4000, h: 3000 })
})

test('eine Vierteldrehung tauscht das Mass, der Ausschnitt folgt', async () => {
  const { w } = await bibliothek([BILD])
  await kachel(w, 'vorne.jpg').trigger('contextmenu')
  eintrag('Zuschneiden').action()
  await flushPromises(); await flushPromises()
  const ed = w.findComponent(CropEditor)
  await knopf(ed, '⟳').trigger('click')
  await flushPromises()
  assert.deepEqual(ed.vm.rahmen, { w: 3000, h: 4000 })
  assert.deepEqual(ed.vm.crop, { x: 0, y: 0, w: 3000, h: 4000 })
})

test('der Ausschnitt bleibt in den Grenzen', async () => {
  const { w } = await bibliothek([BILD])
  await kachel(w, 'vorne.jpg').trigger('contextmenu')
  eintrag('Zuschneiden').action()
  await flushPromises(); await flushPromises()
  const ed = w.findComponent(CropEditor)
  Object.assign(ed.vm.crop, { x: 3900, y: -10, w: 900, h: 9000 })
  ed.vm.begrenzen()
  assert.deepEqual(ed.vm.crop, { x: 3900, y: 0, w: 100, h: 3000 })
})

test('„Neues Asset“ rechnet in voller Auflösung, lädt mit Abstammung hoch und ersetzt nichts', async () => {
  const { w, rufe } = await bibliothek([BILD])
  await kachel(w, 'vorne.jpg').trigger('contextmenu')
  eintrag('Zuschneiden').action()
  await flushPromises(); await flushPromises()
  const ed = w.findComponent(CropEditor)
  Object.assign(ed.vm.crop, { x: 100, y: 200, w: 800, h: 600 })
  await knopf(ed, 'Neues Asset').trigger('click')
  await flushPromises(); await flushPromises()

  // der Ausschnitt wird in Pixeln des Originals gezeichnet (drawImage mit Quell- und Zielrechteck, neun Argumente) —
  // die verkleinerte Vorschau (fünf Argumente) zeichnet daneben weiter, auch noch während des Wartens auf toBlob
  const ziel = gezeichnet.find(z => z.args === 9)
  assert.ok(ziel, 'kein Zuschnitt in voller Auflösung gezeichnet')
  assert.deepEqual(ziel.ziel, [800, 600])
  const hoch = rufe.find(r => r.pfad.endsWith('/api/media') && r.methode === 'POST')
  assert.ok(hoch, 'nichts hochgeladen')
  assert.equal(hoch.rumpf.get('from'), 'm1')                             // die Abstammung geht mit
  assert.equal(hoch.rumpf.get('file').name, 'vorne-zuschnitt.jpg')       // Format des Originals
  assert.equal(rufe.some(r => /\/supersede$/.test(r.pfad)), false, 'ein neues Asset ersetzt nichts')
})

test('„Neue Version“ ersetzt das Original', async () => {
  const { w, rufe } = await bibliothek([BILD])
  await kachel(w, 'vorne.jpg').trigger('contextmenu')
  eintrag('Zuschneiden').action()
  await flushPromises(); await flushPromises()
  await knopf(w.findComponent(CropEditor), 'Neue Version').trigger('click')
  await flushPromises(); await flushPromises()
  const ersetzt = rufe.find(r => /\/api\/media\/m1\/supersede/.test(r.pfad))
  assert.ok(ersetzt, 'nichts ersetzt')
  assert.deepEqual(ersetzt.rumpf, { by: 'm-neu' })
  assert.match(store.toasts.at(-1)?.text ?? '', /ersetzt durch/)
})

test('ein abgelöstes Original bietet keine neue Version mehr an', async () => {
  const { w } = await bibliothek([medium('m1', 'vorne.jpg', 'image/jpeg', true, { supersededBy: 'm9' })])
  await kachel(w, 'vorne.jpg').trigger('click')
  await flushPromises()
  await knopf(w, '✂').trigger('click')
  await flushPromises(); await flushPromises()
  const ed = w.findComponent(CropEditor)
  assert.ok(knopf(ed, 'Neues Asset'))
  assert.equal(knopf(ed, 'Neue Version'), undefined)
})
