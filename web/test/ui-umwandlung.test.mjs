// Editor der Umwandlungskette (ƒ): Schritte anlegen, Felder füllen, Reihenfolge, Vorschau; als Dialog: Übernehmen und Abbrechen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises, win } from './ui.mjs'
import StepsEditor from '../src/components/StepsEditor.vue'
import Dialog from '../src/components/Dialog.vue'
import { dialog } from '../src/dialog.js'

const attribute = [{ key: 'name', label: 'Name' }, { key: 'material', label: 'Material' }]
const editor = (value = [], values = {}) => mount(StepsEditor, { props: { modelValue: value, attributes: attribute, values } })
const letzte = w => w.emitted('update:modelValue').at(-1)[0]

test('ƒ-Editor: ein Schritt aus der Liste kommt an die Kette, ohne Schritte steht „Kette ohne Schritte“', async () => {
  const w = editor()
  assert.match(w.text(), /Kette ohne Schritte/)
  const wahl = w.findAll('select').at(-1)
  await wahl.setValue('combine')
  assert.deepEqual(letzte(w), [{ op: 'combine' }])
})

test('ƒ-Editor: combine — Attribut aus der Liste wird mit Komma angehängt, die Vorschau rechnet mit den Werten', async () => {
  const w = editor([{ op: 'combine', columns: 'name', sep: ' ' }], { name: 'WAKOL', material: 'Acrylat' })
  await w.find('input.attr-wahl[data-feld="columns"]').setValue('Material (material)')
  assert.equal(letzte(w)[0].columns, 'name,material')
  const w2 = editor([{ op: 'combine', columns: 'name,material', sep: ' - ' }], { name: 'WAKOL', material: 'Acrylat' })
  assert.match(w2.text(), /Vorschau: WAKOL - Acrylat/)
})

test('ƒ-Editor: Text eintippen, Reihenfolge ändern, Schritt entfernen', async () => {
  const w = editor([{ op: 'prefix', text: 'A' }, { op: 'suffix', text: 'B' }])
  await w.find('input[type=text]').setValue('X')
  assert.equal(letzte(w)[0].text, 'X')
  await w.findAll('button').find(b => b.text() === '↓').trigger('click')
  assert.deepEqual(letzte(w).map(s => s.op), ['suffix', 'prefix'])
  await w.findAll('button').find(b => b.text() === '×').trigger('click')
  assert.deepEqual(letzte(w).map(s => s.op), ['suffix'])
})

const dlg = () => mount(Dialog, { attachTo: document.body })
const knopf = text => [...document.querySelectorAll('.dlg button')].find(b => b.textContent.trim() === text)
const klick = async el => { el.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); await flushPromises() }

test('dialog.steps: Übernehmen liefert die Kette, Abbrechen liefert null', async () => {
  const w = dlg()
  const p1 = dialog.steps({ title: 'Umwandlung', value: [{ op: 'upper' }], attributes: attribute, ok: 'Übernehmen' })
  await flushPromises()
  assert.ok(document.querySelector('.steps-editor'), 'der Editor steht im Dialog')
  await klick(knopf('Übernehmen'))
  assert.deepEqual(await p1, [{ op: 'upper' }])
  const p2 = dialog.steps({ title: 'Umwandlung', value: [{ op: 'upper' }], attributes: attribute, ok: 'Übernehmen' })
  await flushPromises()
  await klick(knopf('Abbrechen'))
  assert.equal(await p2, null)
  w.unmount()
})

test('dialog.steps: der Dialog ändert die übergebene Kette nicht, bis übernommen wird', async () => {
  const w = dlg()
  const vorgabe = [{ op: 'prefix', text: 'A' }]
  const p = dialog.steps({ title: 'Umwandlung', value: vorgabe, attributes: attribute, ok: 'Übernehmen' })
  await flushPromises()
  const eingabe = document.querySelector('.steps-editor input[type=text]')
  eingabe.value = 'Z'; eingabe.dispatchEvent(new win.Event('input', { bubbles: true })); await flushPromises()
  await klick(knopf('Übernehmen'))
  assert.equal((await p)[0].text, 'Z')
  assert.equal(vorgabe[0].text, 'A', 'die Vorgabe bleibt unverändert')
  w.unmount()
})

test('ƒ-Editor: neben Textfeldern setzt eine Auswahl {attribut} ein, die Vorschau rechnet damit', async () => {
  const w = editor([{ op: 'prefix', text: 'Marke: ' }], { name: 'WAKOL' })
  const einsetzen = w.find('input.attr-wahl[data-feld="text"]')
  assert.ok(einsetzen, 'Suchfeld neben dem Textfeld')
  await einsetzen.setValue('Name (name)')
  assert.equal(letzte(w)[0].text, 'Marke: {name}')
  const w2 = editor([{ op: 'static', text: 'Marke: {name}' }], { name: 'WAKOL' })
  assert.match(w2.text(), /Vorschau: Marke: WAKOL/)
})

test('ƒ-Editor: die Attribut-Vorschläge sind nach Bezeichnung sortiert, tippen des Schlüssels genügt', async () => {
  const w = mount(StepsEditor, { props: { modelValue: [{ op: 'static', text: '' }], attributes: [{ key: 'z_sku', label: 'SKU' }, { key: 'a_name', label: 'Name' }, { key: 'm', label: 'Material' }], values: {} } })
  const texte = w.findAll('datalist option').map(o => o.attributes('value'))
  assert.deepEqual(texte.slice(1), ['Material (m)', 'Name (a_name)', 'SKU (z_sku)'])
  await w.find('input.attr-wahl').setValue('z_sku')
  assert.equal(letzte(w)[0].text, '{z_sku}')
})

test('dialog.steps: bleibt der Startschritt leer, wird nichts gespeichert (Kette leer)', async () => {
  const w = dlg()
  const p = dialog.steps({ title: 'Umwandlung', value: [{ op: 'static', text: '' }], attributes: attribute, ok: 'Übernehmen' })
  await flushPromises()
  await klick(knopf('Übernehmen'))
  assert.deepEqual(await p, [{ op: 'static', text: '' }])
  w.unmount()
})
