// Status mit Geltungsdatum (28.09.2026): welcher Status, ab wann. Der Dialog nimmt beides, der Knoten zeigt,
// was ansteht. Geprüft am echten DOM: Auswahl, Datumsfeld, was an den Server geht.
import test from 'node:test'
import assert from 'node:assert/strict'
import { win, domButton } from './ui.mjs'
import { mount, flushPromises } from '@vue/test-utils'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { api } from '../src/api.js'
import { setStatusAb } from '../src/status.js'

const Dialog = (await import('../src/components/Dialog.vue')).default

const KNOTEN = { id: 'p-1', role: 'product', label: 'Ein Produkt', status: 'active', hasStatus: true }
// Der Dialog hängt per Teleport am body — gesucht wird im Dokument, nicht im Bauteil
const feld = sel => document.querySelector('.dlg ' + sel)
const setze = (sel, v) => {
  const el = feld(sel)
  if (!el) throw new Error(`${sel} fehlt — im Dialog steht: ${document.querySelector('.dlg')?.textContent}`)
  el.value = v
  el.dispatchEvent(new win.Event('input', { bubbles: true }))
  el.dispatchEvent(new win.Event('change', { bubbles: true }))
  return el
}
function welt() {
  store.model = { statuses: [{ key: 'draft' }, { key: 'active' }, { key: 'discontinued' }], locales: [{ code: 'de' }] }
  store.statusText = k => ({ draft: '○ Entwurf', active: '● aktiv', discontinued: '✗ ausgelaufen' })[k] ?? k
  store.statusLabel = k => store.statusText(k).slice(2)
  store.poll = async () => {}
  tree.children = new Map()
  tree.load = async () => {}
  const gesendet = []
  api.post = async (url, body) => { gesendet.push({ url, body }); return {} }
  return gesendet
}

test('der Dialog nimmt Status und Tag — beides geht an den Server', async () => {
  const gesendet = welt()
  mount(Dialog)
  const lauf = setStatusAb({ ...KNOTEN })
  await flushPromises()

  assert.deepEqual([...feld('select').options].map(o => o.textContent), ['○ Entwurf', '● aktiv', '✗ ausgelaufen'])
  setze('select', 'discontinued')
  setze('input[type=date]', '2027-01-01')
  await domButton('Setzen').trigger()
  await lauf

  assert.deepEqual(gesendet, [{ url: '/api/nodes/p-1/status', body: { status: 'discontinued', from: '2027-01-01' } }])
})

test('ohne Tag gilt der Status sofort — dann geht kein Datum mit', async () => {
  const gesendet = welt()
  mount(Dialog)
  const lauf = setStatusAb({ ...KNOTEN })
  await flushPromises()
  setze('select', 'draft')
  await domButton('Setzen').trigger()
  await lauf
  assert.deepEqual(gesendet[0].body, { status: 'draft', from: '' })
})

test('abgebrochen wird nichts geschrieben', async () => {
  const gesendet = welt()
  mount(Dialog)
  const lauf = setStatusAb({ ...KNOTEN })
  await flushPromises()
  await domButton('Abbrechen').trigger()
  assert.equal(await lauf, 0)
  assert.deepEqual(gesendet, [])
})

test('was ansteht, ist vorbelegt — ein zweiter Aufruf ändert denselben Plan', async () => {
  welt()
  mount(Dialog)
  const lauf = setStatusAb({ ...KNOTEN, statusNext: 'discontinued', statusNextAb: '2027-01-01' })
  await flushPromises()
  assert.equal(feld('select').value, 'discontinued')
  assert.equal(feld('input[type=date]').value, '2027-01-01')
  await domButton('Abbrechen').trigger()
  await lauf
})

test('mit Subitems fragt der Dialog, ob sie mitkommen — auch bei einem Tag in der Zukunft', async () => {
  // Ein Tag in der Zukunft ändert am heutigen Stand nichts; „hat den Status schon“ darf die Subitems darum
  // nicht aussortieren, sonst bekäme ein aktives Produkt kein Auslaufdatum
  const gesendet = welt()
  tree.children = new Map([['p-1', [{ id: 'v-1', role: 'variant', status: 'active', hasStatus: true }]]])
  const befehle = []
  api.batchChunked = async cmds => { befehle.push(...cmds); return { batch: 'b', results: [], error: null } }
  mount(Dialog)
  const lauf = setStatusAb({ ...KNOTEN })
  await flushPromises()
  setze('select', 'discontinued')
  setze('input[type=date]', '2027-01-01')
  await domButton('Setzen').trigger()
  await flushPromises()

  // jetzt die Rückfrage nach den Subitems
  assert.ok(document.querySelector('.dlg .option'), `keine Rückfrage — im Dialog steht: ${document.querySelector('.dlg')?.textContent}`)
  setze('input[type=checkbox]', 'on')
  feld('input[type=checkbox]').checked = true
  feld('input[type=checkbox]').dispatchEvent(new win.Event('change', { bubbles: true }))
  await domButton('Setzen').trigger()
  await lauf

  assert.equal(befehle.length, 2, 'Produkt und Variante')
  for (const c of befehle) assert.equal(c.args.from, '2027-01-01')
  assert.deepEqual(gesendet, [], 'als Stapel, nicht einzeln')
})
