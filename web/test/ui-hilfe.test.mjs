// Hilfe-Knopf in der Kopfzeile (Taloan, 24.09.2026): ein ? rechts oben, Klick öffnet das Menü mit den Hilfe-Links;
// der erste Link ist die Website journali.de und öffnet in einem neuen Fenster.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount } from './ui.mjs'

const HelpButton = (await import('../src/components/HelpButton.vue')).default
const { menu } = await import('../src/menu.js')
const { HELP_LINKS, helpItems } = await import('../src/help.js')

test('der Knopf zeigt nur ein ? und erklärt sich im Tooltip', () => {
  const w = mount(HelpButton)
  const b = w.find('button.help')
  assert.equal(b.text(), '?')
  assert.match(b.attributes('title') ?? '', /Hilfe/)
})

test('Klick öffnet das Menü mit journali.de als erstem Eintrag', async () => {
  const w = mount(HelpButton)
  await w.find('button.help').trigger('click')
  assert.equal(menu.visible, true)
  assert.equal(menu.items[0].label, 'journali.de')
  assert.equal(menu.items.length, HELP_LINKS.length)
  menu.close()
})

test('ein Eintrag öffnet seine Adresse in einem neuen Fenster', () => {
  const opened = []
  const items = helpItems(url => opened.push(url))
  items[0].action()
  assert.deepEqual(opened, ['https://journali.de'])
})

test('jeder Link hat Name, Adresse mit https und einen Hinweis für den Tooltip', () => {
  for (const l of HELP_LINKS) {
    assert.ok(l.label && !l.label.includes(' '), `Name ohne Satz: ${l.label}`)
    assert.match(l.url, /^https:\/\//)
    assert.ok(l.hint)
  }
})
