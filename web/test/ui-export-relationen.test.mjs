// ⇪ Export → Excel: der Schalter „Relationen“ gibt dem Export ein zweites Blatt. CSV hat nur ein Blatt und zeigt den Schalter nicht.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { mount, flushPromises } from '@vue/test-utils'
import { routerKey, routeLocationKey } from 'vue-router'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'
import { api } from '../src/api.js'

const BAUM = [{ id: 'g1', parent: null, label: 'Mittel', role: 'group' }]

async function ansicht(festesFormat) {
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], views: [], attributes: [], groups: [], lists: [] }
  tree.rows = BAUM; tree.byId = new Map(BAUM.map(r => [r.id, r])); tree.loaded = true; tree.load = async () => {}
  const { default: ExportView } = await import('../../plugins/table/src/ExportView.vue')
  const w = mount(ExportView, { props: { festesFormat, plugin: 'excel' }, global: { provide: { [routerKey]: { push() {} }, [routeLocationKey]: { path: '/p/table/export', query: { node: 'g1' } } }, stubs: { TreePicker: true, RouterLink: true, ProfileBar: true } } })
  await flushPromises()
  return w
}
const aufrufe = async (w, klick) => {
  const get = api.get, liste = []
  api.get = async p => { liste.push(p); return /\/table\?/.test(p) ? { columns: [], rows: [] } : /\/relations\/tree/.test(p) ? {} : [] }
  try { await klick(); await flushPromises() } finally { api.get = get }
  return liste
}
const schalter = w => w.findAll('label').find(l => l.text().includes('Relationen'))

test('Excel: der Schalter Relationen ist da und aus; eingeschaltet liest die Vorschau die Relationen des Teilbaums', async () => {
  const w = await ansicht('excel')
  assert.ok(schalter(w), 'Schalter sichtbar')
  assert.equal(schalter(w).find('input').element.checked, false)
  assert.equal((await aufrufe(w, () => w.findAll('button').find(b => b.text() === 'Vorschau').trigger('click'))).some(p => /relations\/tree/.test(p)), false)
  await schalter(w).find('input').setValue(true)
  const liste = await aufrufe(w, () => w.findAll('button').find(b => b.text() === 'Vorschau').trigger('click'))
  assert.ok(liste.some(p => /\/nodes\/g1\/relations\/tree\?deep=true/.test(p)))
})

test('CSV: kein Schalter, die Relationen werden nicht gelesen', async () => {
  const w = await ansicht('csv')
  assert.equal(schalter(w), undefined)
  const liste = await aufrufe(w, () => w.findAll('button').find(b => b.text() === 'Vorschau').trigger('click'))
  assert.equal(liste.some(p => /relations\/tree/.test(p)), false)
})

test('das Profil nimmt den Schalter mit', async () => {
  const w = await ansicht('excel')
  await schalter(w).find('input').setValue(true)
  const profil = w.findComponent({ name: 'ProfileBar' })
  // ProfileBar ist ersetzt; die Ansicht gibt get/set als Eigenschaften weiter
  const get = profil.props('get'), set = profil.props('set')
  assert.equal(get().relations, true)
  set({ roots: ['g1'], relations: false })
  await w.vm.$nextTick()
  assert.equal(schalter(w).find('input').element.checked, false)
})
