// ▨ Medien: das Kontextmenü an einer Kachel — zuordnen und zurückziehen, für eine einzelne und für die Auswahl.
// Beides gab es bisher nur am Knoten oder als Knopf rechts; in der Bibliothek fehlte der Weg über die rechte Maustaste.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { routerKey } from 'vue-router'
import { store } from '../src/store.js'
import { menu } from '../src/menu.js'
import { dialog } from '../src/dialog.js'

const MediaView = (await import('../src/views/MediaView.vue')).default
const TreePicker = (await import('../src/components/TreePicker.vue')).default

const medium = (id, name, mime, isImage) => ({
  id, name, mime, isImage, sha256: id.repeat(8), bytes: 1000, renderable: isImage, hasThumb: isImage,
  values: [], external: {}, used: 0, entries: 1, lastNumber: 1, lastAt: '2026-09-27T08:00:00Z', lastActor: 'u1', folder: null,
  probe: null, pixels: 0, source: null, createdAt: '2026-09-27T08:00:00Z', createdBy: 'u1',
})
const MEDIEN = [medium('m1', 'vorne.jpg', 'image/jpeg', true), medium('m2', 'datenblatt.pdf', 'application/pdf', false), medium('m3', 'hinten.png', 'image/png', true)]

function welt() {
  store.actor = 'u1'
  store.toasts = []
  store.model = {
    masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], statuses: [],
    relationTypes: [{ key: 'image', label: { de: 'Bild' }, to: ['media'] }, { key: 'document', label: { de: 'Dokument' }, to: ['media'] }],
  }
  const rufe = []
  globalThis.fetch = async (url, opt = {}) => {
    const pfad = String(url)
    rufe.push({ pfad, methode: opt.method ?? 'GET', rumpf: typeof opt.body === 'string' ? JSON.parse(opt.body) : null })
    const antwort = /\/usage/.test(pfad) ? []
      : pfad.includes('/api/media/folders') ? { total: MEDIEN.length, unfiled: MEDIEN.length, folders: [] }
      : /\/api\/media\?/.test(pfad) ? MEDIEN
      : {}
    return { ok: true, status: 200, text: async () => JSON.stringify(antwort), json: async () => antwort }
  }
  return rufe
}

async function bibliothek() {
  const rufe = welt()
  const router = { path: '/media', push(p) { this.path = p }, replace(p) { this.path = p } }
  const w = mount(MediaView, { global: { provide: { [routerKey]: router }, stubs: { RouterLink: true, 'router-link': true, MediaThumb: true, TreePicker: true } } })
  await flushPromises()
  return { w, rufe }
}

const kachel = (w, name) => w.findAll('.tile').find(t => t.find('.name')?.text() === name)
const eintrag = label => menu.items.find(i => i.label && new RegExp(label).test(i.label))

test('die rechte Maustaste öffnet ein Menü mit Zuordnen und Zurückziehen', async () => {
  const { w } = await bibliothek()
  await kachel(w, 'vorne.jpg').trigger('contextmenu')

  assert.equal(menu.visible, true)
  assert.ok(eintrag('Zuordnen'), 'Zuordnen fehlt im Menü')
  assert.ok(eintrag('Zurückziehen'), 'Zurückziehen fehlt im Menü')
})

test('eine Kachel ausserhalb der Auswahl wird zur Auswahl', async () => {
  const { w } = await bibliothek()
  await kachel(w, 'vorne.jpg').trigger('click')
  await kachel(w, 'datenblatt.pdf').trigger('contextmenu')

  assert.match(eintrag('Zurückziehen').label, /^Zurückziehen$/)   // eine, nicht zwei
  assert.equal(w.findAll('.tile.current').length, 1)
  assert.match(w.find('.tile.current .name').text(), /datenblatt/)
})

test('bei Mehrfachauswahl nennt das Menü die Anzahl', async () => {
  const { w } = await bibliothek()
  await kachel(w, 'vorne.jpg').trigger('click')
  await kachel(w, 'hinten.png').trigger('click', { ctrlKey: true })
  await kachel(w, 'hinten.png').trigger('contextmenu')

  assert.match(eintrag('zuordnen').label, /2 Assets zuordnen/)
  assert.match(eintrag('zurückziehen').label, /2 Assets zurückziehen/)
})

test('Zuordnen: Knoten wählen, dann eine Relation je Asset — Bild als Bild, PDF als Dokument', async () => {
  const { w, rufe } = await bibliothek()
  await kachel(w, 'vorne.jpg').trigger('click')
  await kachel(w, 'datenblatt.pdf').trigger('click', { ctrlKey: true })
  await kachel(w, 'datenblatt.pdf').trigger('contextmenu')
  eintrag('zuordnen').action()
  await flushPromises()

  const picker = w.findComponent(TreePicker)
  assert.ok(picker.exists(), 'der Auswahlbaum fehlt')
  picker.vm.$emit('pick', { id: 'p1', role: 'product' })
  await flushPromises()

  const knopf = w.findAll('button').find(b => /Zuordnen/.test(b.text()) && b.classes('primary'))
  assert.equal(knopf.attributes('disabled'), undefined, 'der Knopf bleibt gesperrt')
  await knopf.trigger('click')
  await flushPromises()

  const rel = rufe.filter(r => r.pfad.endsWith('/api/relations') && r.methode === 'POST')
  assert.equal(rel.length, 2)
  assert.deepEqual(rel.map(r => [r.rumpf.type, r.rumpf.to, r.rumpf.from]), [['image', 'm1', 'p1'], ['document', 'm2', 'p1']])
})

test('ohne gewählten Knoten ordnet nichts zu', async () => {
  const { w, rufe } = await bibliothek()
  await kachel(w, 'vorne.jpg').trigger('contextmenu')
  eintrag('Zuordnen').action()
  await flushPromises()

  const knopf = w.findAll('button').find(b => /Zuordnen/.test(b.text()) && b.classes('primary'))
  assert.ok(knopf.attributes('disabled') !== undefined, 'der Knopf ist offen, obwohl kein Knoten gewählt ist')
  assert.equal(rufe.filter(r => r.pfad.endsWith('/api/relations')).length, 0)
})

test('Zurückziehen fragt nach und trifft die ganze Auswahl', async () => {
  const { w, rufe } = await bibliothek()
  const gefragt = []
  dialog.confirm = async o => { gefragt.push(o); return true }
  await kachel(w, 'vorne.jpg').trigger('click')
  await kachel(w, 'hinten.png').trigger('click', { ctrlKey: true })
  await kachel(w, 'hinten.png').trigger('contextmenu')
  await eintrag('zurückziehen').action()
  await flushPromises()

  assert.equal(gefragt.length, 1)
  assert.match(gefragt[0].title, /2 Medien zurückziehen/)
  const weg = rufe.filter(r => r.methode === 'DELETE').map(r => r.pfad)
  assert.deepEqual(weg.map(p => p.split('/').pop()).sort(), ['m1', 'm3'])
})
