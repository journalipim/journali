// Art der Arbeit in der Journalansicht:
// je Zeile ein Symbol, gezählte Arten hervorgehoben; im Stapelkopf die Arten des ganzen Stapels.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount } from './ui.mjs'

const EntryList = (await import('../src/components/EntryList.vue')).default
const e = (number, type, kind, batch = null) => ({ number, at: '2026-09-22T08:00:00Z', actor: 'u1', stream: 'v-1', type, kind, batch, payload: {} })

test('je Eintrag ein Symbol für die Art, mit Tooltip', () => {
  const w = mount(EntryList, { props: { entries: [e(3, 'AttributeSet', 'data'), e(2, 'AttributeDefined', 'model'), e(1, 'PluginDataSet', 'reference')] } })
  const cells = w.findAll('td.kind')
  assert.equal(cells.length, 3)
  assert.equal(cells[0].text(), '✎'); assert.match(cells[0].attributes('title') ?? '', /Datenpflege · zählt/)
  assert.equal(cells[1].text(), '◫'); assert.match(cells[1].attributes('title') ?? '', /Datenmodellierung/)
  assert.equal(cells[2].text(), '⇩'); assert.match(cells[2].attributes('title') ?? '', /Referenzdaten/)
})

test('was zählt, ist hervorgehoben — der Rest blass', () => {
  const w = mount(EntryList, { props: { entries: [e(2, 'AttributeSet', 'data'), e(1, 'GroupCreated', 'structure')] } })
  const cells = w.findAll('td.kind')
  assert.ok(cells[0].classes('counts'), 'Datenpflege zählt')
  assert.ok(!cells[1].classes('counts'), 'Struktur nicht')
})

test('alte Einträge ohne Art brechen nichts', () => {
  const w = mount(EntryList, { props: { entries: [e(1, 'AttributeSet', undefined)] } })
  assert.equal(w.findAll('td.kind')[0].text(), '·')
})

// Startphase (05.10.2026): es zählt nichts — die Art steht ohne „· zählt“ da und ohne Hervorhebung
test('in der Startphase kein „zählt“ an der Art', async () => {
  const { store } = await import('../src/store.js')
  const vorher = store.startphase
  store.startphase = true
  try {
    const w = mount(EntryList, { props: { entries: [e(2, 'AttributeSet', 'data'), e(1, 'ReleaseGranted', 'publish')] } })
    const cells = w.findAll('td.kind')
    assert.equal(cells[0].attributes('title'), 'Datenpflege')
    assert.equal(cells[1].attributes('title'), 'Ausleitung')
    assert.ok(!cells[0].classes('counts') && !cells[1].classes('counts'))
  } finally { store.startphase = vorher }
})
