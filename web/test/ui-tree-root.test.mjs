// Neue Gruppe: unter dem offenen Knoten oder an der Wurzel. Bisher ging das nur, wenn kein Knoten offen war — und offen heisst:
// steht in der Adresse, wohin das Baum-Symbol ausdrücklich zurückführt. Jetzt ist es im Dialog umschaltbar.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, button } from './ui.mjs'
import { store } from '../src/store.js'
import { tree } from '../src/tree.js'

const TreeView = (await import('../src/views/TreeView.vue')).default

/// Ein Baum mit einer Gruppe, ohne Server
function welt() {
  tree.byId = new Map([['g1', { id: 'g1', role: 'group', label: 'Mastertree', parent: null, axes: [] }]])
  tree.rows = [tree.byId.get('g1')]
  tree.loaded = true
  tree.load = async () => {}
  store.actor = 'u1'
  store.model = { masterLocale: 'de', locales: [{ code: 'de' }], attributes: [], groups: [], statuses: [] }
  // start() fragt den Vater nach seinen Attributgruppen — hier hat er keine
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ groups: [] }) })
}

/// Der Schalter im Anlegen-Dialog (er trägt beide Beschriftungen)
const schalter = w => w.findAll('.view-chip').find(c => /unter |an der Wurzel/.test(c.text()))

test('mit offenem Knoten: die Gruppe kommt darunter — umschaltbar auf die Wurzel', async () => {
  welt()
  const w = mount(TreeView, { props: { id: 'g1' }, global: { stubs: { RouterLink: true, 'router-link': true, NodeView: true } } })
  await flushPromises()
  await button(w, '+ ▣').trigger('click')
  await flushPromises()
  const s = schalter(w)
  assert.ok(s, 'der Schalter fehlt im Dialog')
  assert.match(s.text(), /unter Mastertree/)
  assert.equal(s.classes('on'), false)
  await s.trigger('click')
  assert.match(schalter(w).text(), /an der Wurzel/)
  assert.ok(schalter(w).classes('on'), 'an der Wurzel ist der eingeschaltete Zustand')
  assert.match(schalter(w).attributes('title') ?? '', /neuer Baum/)
})

test('ohne offenen Knoten steht es fest: an der Wurzel', async () => {
  welt()
  const w = mount(TreeView, { props: { id: null }, global: { stubs: { RouterLink: true, 'router-link': true, NodeView: true } } })
  await flushPromises()
  await button(w, '+ ▣').trigger('click')
  await flushPromises()
  assert.match(w.find('.dialog').text(), /an der Wurzel/)
  assert.equal(schalter(w), undefined, 'nichts umzuschalten — es gibt keinen offenen Knoten')
})
