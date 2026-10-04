// ⇩ Solr im Browser (04.10.2026): vor dem Laden zählt die Ansicht den angehakten Teilbaum (rows=0); über 20 000 Knoten sagt sie das und lädt nichts.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

test('Analysieren: 50 000 Knoten im Teilbaum — Meldung, der Teilbaum wird nicht geladen', async () => {
  localStorage.setItem('journali.import.solr', JSON.stringify({ zugang: 'z1', auto: true }))
  store.model = { attributes: [], groups: [], lists: [], locales: [{ code: 'de' }], views: [] }; store.toasts = []
  Object.assign(tree, { rows: [], byId: new Map(), children: new Map(), loaded: true, load: async () => {} })
  const anfragen = []
  const get = api.get, toast = store.toast, gezeigt = []
  store.toast = m => gezeigt.push(m)
  api.get = async pfad => {
    if (pfad.startsWith('/api/drivers?')) return [{ key: 'z1', label: 'Quelle', art: 'solr' }]
    const url = new URL(decodeURIComponent(new URL(pfad, 'http://x').searchParams.get('path')), 'http://solr.invalid')
    const q = url.searchParams, fq = q.getAll('fq').join(' ')
    anfragen.push({ q: q.get('q'), fq, rows: q.get('rows') })
    if (/main_path_id/.test(fq)) return { response: { numFound: 50000, docs: q.get('rows') === '0' ? [] : [{ id: 'g1', type: 'group' }] } }
    if (/main_parent_id:""/.test(fq)) return { response: { numFound: 1, docs: [{ id: 'g1', master_id: 'g1', type: 'group', name: 'Alles', hasChilds: false }] } }
    if (/main_parent_id/.test(fq)) return { response: { numFound: 0, docs: [] } }
    return { response: { numFound: 0, docs: [] } }
  }
  try {
    const { default: View } = await import('../../plugins/solr/src/View.vue')
    const w = mount(View, { global: { stubs: { ImportHead: true, TreePicker: true, Splitter: true, RouterLink: true }, mocks: { $router: { push() {} } } } })
    for (let i = 0; i < 6; i++) await flushPromises()
    const haken = w.find('input[type=checkbox]')
    assert.ok(haken.exists(), 'Wurzel mit Haken')
    await haken.trigger('change'); await flushPromises()
    const knopf = w.findAll('button').find(b => b.text() === 'Analysieren')
    await knopf.trigger('click'); for (let i = 0; i < 4; i++) await flushPromises()
    assert.ok(gezeigt.some(m => /50000 Knoten, im Browser höchstens 20000/.test(m)), JSON.stringify(gezeigt))
    assert.ok(anfragen.some(a => /main_path_id:"g1"/.test(a.fq) && a.rows === '0'), 'gezählt mit rows=0')
    assert.ok(!anfragen.some(a => /main_path_id/.test(a.fq) && a.rows !== '0'), 'der Teilbaum wurde nicht geladen')
    w.unmount()
  } finally { api.get = get; store.toast = toast; localStorage.removeItem('journali.import.solr') }
})
