// ⊞ Struktur: der Baum als Tabelle heraus, in Excel entworfen und in einem Zug hinein — ohne Inhalte.
// Geprüft wird die Ansicht am echten DOM: Vorschau, Datei lesen, Plan, Einspielen als Stapel.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { mount } from '@vue/test-utils'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { api } from '../src/api.js'

const BAUM = [
  { id: 'w', parent: null, label: 'Wurzel', role: 'group' },
  { id: 'g-1', parent: 'w', label: 'Kleber', role: 'group' },
  { id: 'g-11', parent: 'g-1', label: 'Schaum', role: 'group' },
  { id: 'p-1', parent: 'g-11', label: 'Ein Produkt', role: 'product' },
]

async function welt() {
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], views: [], attributes: [], groups: [], lists: [] }
  tree.rows = BAUM
  tree.byId = new Map(BAUM.map(r => [r.id, r]))
  tree.loaded = true
  tree.load = async () => {}
  tree.kids = (id) => BAUM.filter(r => r.parent === id)
  const { default: StrukturView } = await import('../../plugins/table/src/StrukturView.vue')
  return mount(StrukturView, { global: { stubs: { TreePicker: true, RouterLink: true } } })
}

test('die Vorschau zeigt eine Spalte je Ebene und nur Gruppen', async () => {
  const w = await welt()
  await w.vm.$nextTick()
  // ohne Knoten steht der Hinweis da, nicht eine leere Tabelle
  assert.match(w.text(), /Knoten wählen/)

  w.vm.wurzel = ['w']
  w.vm.bauen()
  await w.vm.$nextTick()
  const kopf = w.findAll('thead th').map(th => th.text())
  assert.deepEqual(kopf, ['journali_id', 'Ebene 1', 'Ebene 2'])
  // das Produkt gehoert nicht in die Struktur
  assert.ok(!w.text().includes('Ein Produkt'), 'Produkte sind Inhalt, nicht Struktur')
  assert.ok(w.text().includes('Kleber') && w.text().includes('Schaum'))
})

test('eine gelesene Datei ergibt einen Plan, und erst der Knopf schreibt', async () => {
  const w = await welt()
  w.vm.wurzel = ['w']
  // eine Datei, die eine Gruppe umbenennt und eine neue anlegt
  const { plan } = await import('../../plugins/table/struktur.mjs')
  w.vm.vorschau = plan(['journali_id', 'Ebene 1', 'Ebene 2'],
    [['g-1', 'Klebstoffe', ''], ['', '', 'Reaktiv']], BAUM, 'w')
  await w.vm.$nextTick()
  assert.match(w.text(), /1 neu/)
  assert.match(w.text(), /1 umbenannt/)

  // bis hierher wurde nichts geschrieben
  let gesendet = null
  const orig = api.batchChunked
  api.batchChunked = async (cmds) => { gesendet = cmds; return { batch: 'b1', results: [], error: null, errors: [] } }
  const { dialog } = await import('../src/dialog.js')
  const od = dialog.confirm; dialog.confirm = async () => true
  try {
    await w.vm.einspielen()
  } finally { api.batchChunked = orig; dialog.confirm = od }

  assert.ok(gesendet, 'erst der Knopf schreibt')
  assert.deepEqual(gesendet.map(c => c.op), ['group.create', 'group.rename'])
  // group.rename, nicht node.rename: NodeNamed waere Datenpflege und wuerde Kontingent kosten
  assert.deepEqual(gesendet[1].args, { node: 'g-1', label: { de: 'Klebstoffe' } })
})

test('ein Plan mit Fehlern bietet kein Einspielen an', async () => {
  const w = await welt()
  w.vm.wurzel = ['w']
  const { plan } = await import('../../plugins/table/struktur.mjs')
  w.vm.vorschau = plan(['journali_id', 'Ebene 1'], [['g-999', 'Gibtsnicht']], BAUM, 'w')
  await w.vm.$nextTick()
  assert.match(w.text(), /g-999/)
  const knoepfe = w.findAll('button').map(b => b.text())
  assert.ok(!knoepfe.some(x => x.includes('Einspielen')), 'mit Fehlern wird nicht geschrieben')
})
