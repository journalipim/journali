// Attributzelle: Tippen von f: öffnet den Editor der Umwandlungskette, ein Wert f:[…] öffnet ihn beim Bearbeiten
// und steht als „ƒ Beschreibung“ in der Zelle. Ohne die Option formel bleibt die Zelle wie sie war.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, win } from './ui.mjs'
import Cell from '../src/components/Cell.vue'
import { dialog } from '../src/dialog.js'
import { store } from '../src/store.js'

store.model = { attributes: [{ key: 'name', type: 'text', label: { de: 'Name' } }, { key: 'dpp_batch', type: 'text', label: { de: 'Charge' } }] }
const taste = (el, key) => el.dispatchEvent(new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
const zelle = (props = {}) => mount({ components: { Cell }, template: '<table><tbody><tr><Cell v-bind="p" @save="v => $emit(\'gespeichert\', v)" /></tr></tbody></table>', props: ['p'], emits: ['gespeichert'] }, { props: { p: props }, attachTo: document.body })
const gespeichert = w => w.emitted('gespeichert')?.map(e => e[0]) ?? []
const zu = async ja => { dialog.done(ja); await flushPromises() }

test('f: getippt → der Editor öffnet (statt eines Eingabefelds), Übernehmen speichert die Kette', async () => {
  const w = zelle({ formel: true, formelAttribut: 'dpp_batch', label: 'Charge', value: null, formelWerte: () => ({ name: 'WAKOL' }) })
  taste(w.find('.cell-box').element, 'f'); await flushPromises()
  const eingabe = w.find('input.cell-input'); assert.ok(eingabe.exists(), 'nach f steht das Eingabefeld')
  eingabe.element.value = 'f:'; eingabe.element.dispatchEvent(new win.Event('input', { bubbles: true })); await flushPromises()
  assert.equal(dialog.open, true); assert.equal(dialog.kind, 'steps')
  assert.equal(w.find('input.cell-input').exists(), false, 'das Eingabefeld ist weg')
  dialog.value = [{ op: 'combine', columns: 'name' }]
  await zu(true)
  assert.deepEqual(gespeichert(w), ['f:[{"op":"combine","columns":"name"}]'])
  w.unmount()
})

test('f: getippt, Abbrechen → nichts gespeichert', async () => {
  const w = zelle({ formel: true, formelAttribut: 'dpp_batch', value: null })
  taste(w.find('.cell-box').element, 'f'); await flushPromises()
  const eingabe = w.find('input.cell-input')
  eingabe.element.value = 'f:'; eingabe.element.dispatchEvent(new win.Event('input', { bubbles: true })); await flushPromises()
  await zu(false)
  assert.deepEqual(gespeichert(w), [])
  w.unmount()
})

test('ein Wert f:[…] steht als ƒ Beschreibung da und öffnet beim Bearbeiten den Editor mit der Kette', async () => {
  const w = zelle({ formel: true, formelAttribut: 'dpp_batch', value: 'f:[{"op":"combine","columns":"name,material"}]' })
  assert.match(w.find('.cell-box').text(), /^ƒ verbinde name,material/)
  taste(w.find('.cell-box').element, 'Enter'); await flushPromises()
  assert.equal(dialog.kind, 'steps'); assert.deepEqual(dialog.value, [{ op: 'combine', columns: 'name,material' }])
  await zu(false); w.unmount()
})

test('Kreis: die Kette liest das eigene Attribut → nicht gespeichert, Meldung', async () => {
  const w = zelle({ formel: true, formelAttribut: 'dpp_batch', value: null, formelWerte: () => ({}) })
  store.toasts.length = 0
  taste(w.find('.cell-box').element, 'f'); await flushPromises()
  const eingabe = w.find('input.cell-input')
  eingabe.element.value = 'f:'; eingabe.element.dispatchEvent(new win.Event('input', { bubbles: true })); await flushPromises()
  dialog.value = [{ op: 'combine', columns: 'dpp_batch' }]
  await zu(true)
  assert.deepEqual(gespeichert(w), [])
  assert.ok(store.toasts.some(x => /Kreis/.test(x.text)), 'die Meldung nennt den Kreis')
  w.unmount()
})

test('ohne formel bleibt f: ein gewöhnlicher Text', async () => {
  const w = zelle({ value: null })
  taste(w.find('.cell-box').element, 'f'); await flushPromises()
  const eingabe = w.find('input.cell-input')
  eingabe.element.value = 'f:'; eingabe.element.dispatchEvent(new win.Event('input', { bubbles: true })); await flushPromises()
  assert.equal(dialog.open, false)
  assert.ok(w.find('input.cell-input').exists(), 'das Eingabefeld bleibt')
  w.unmount()
})

test('eine geerbte Kette steht grau als ƒ Beschreibung da (der eigene Wert fehlt)', async () => {
  const w = zelle({ formel: true, formelAttribut: 'dpp_batch', value: null, inherited: 'f:[{"op":"upper"}]' })
  const box = w.find('.cell-box')
  assert.match(box.text(), /^ƒ /)
  assert.ok(box.classes().includes('inherited'))
  w.unmount()
})
