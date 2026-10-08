// Kontextmenü: ein Eintrag kann am Zeilenende ein eigenes Zeichen tragen (end: { icon, title, action }) — das ✕ der Lesezeichen. Ein Klick darauf wählt den
// Eintrag nicht; liefert die Aktion eine neue Liste, bleibt das Menü offen und zeigt sie, sonst schliesst es.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, flushPromises } from './ui.mjs'
import { menu } from '../src/menu.js'

globalThis.innerWidth = 1280; globalThis.innerHeight = 800   // das Menü hält sich im Fenster
const ContextMenu = (await import('../src/components/ContextMenu.vue')).default
const oeffnen = items => menu.open({ preventDefault() {}, clientX: 10, clientY: 10 }, items)

test('das Zeichen am Zeilenende ist für sich anklickbar und wählt den Eintrag nicht', async () => {
  const w = mount(ContextMenu, { attachTo: document.body })
  let geoeffnet = 0, entfernt = 0
  oeffnen([{ label: 'Bohrer', hint: 'Mastertree', action: () => geoeffnet++, end: { icon: '×', title: 'Lesezeichen entfernen', action: () => { entfernt++ } } }])
  await flushPromises()
  const ende = document.body.querySelector('.ctx .end')
  assert.ok(ende, 'das Zeichen steht am Ende der Zeile'); assert.equal(ende.textContent, '×'); assert.equal(ende.getAttribute('title'), 'Lesezeichen entfernen')
  ende.click(); await flushPromises()
  assert.equal(entfernt, 1); assert.equal(geoeffnet, 0, 'der Eintrag selbst wurde nicht gewählt')
  assert.equal(menu.visible, false, 'ohne neue Liste schliesst das Menü')
  w.unmount()
})

test('liefert die Aktion eine neue Liste, bleibt das Menü offen und zeigt sie', async () => {
  const w = mount(ContextMenu, { attachTo: document.body })
  const liste = n => Array.from({ length: n }, (_, i) => ({ label: 'Eintrag ' + i, end: { icon: '×', action: async () => liste(n - 1) } }))
  oeffnen(liste(3)); await flushPromises()
  assert.equal(document.body.querySelectorAll('.ctx .item').length, 3)
  document.body.querySelector('.ctx .end').click(); await flushPromises()
  assert.equal(menu.visible, true, 'das Menü bleibt offen')
  assert.equal(document.body.querySelectorAll('.ctx .item').length, 2, 'es zeigt die kürzere Liste')
  w.unmount()
})

test('ohne end gibt es kein Zeichen am Ende', async () => {
  const w = mount(ContextMenu, { attachTo: document.body })
  oeffnen([{ label: 'Nur ein Eintrag', action() {} }]); await flushPromises()
  assert.ok(!document.body.querySelector('.ctx .end'))
  w.unmount()
})
