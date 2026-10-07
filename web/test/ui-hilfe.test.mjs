// Hilfe-Knopf in der Kopfzeile: ein ? rechts oben, Klick öffnet das Menü mit den Hilfe-Links;
// der erste Link ist die Website journali.de und öffnet in einem neuen Fenster.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount } from './ui.mjs'

const HelpButton = (await import('../src/components/HelpButton.vue')).default
const { menu } = await import('../src/menu.js')
const { HELP_LINKS, helpItems, chapterFor } = await import('../src/help.js')

test('der Knopf zeigt nur ein ? und erklärt sich im Tooltip', () => {
  const w = mount(HelpButton)
  const b = w.find('button.help')
  assert.equal(b.text(), '?')
  assert.match(b.attributes('title') ?? '', /Hilfe/)
})

test('Klick öffnet das Menü: erst die Hilfe in der Instanz, dann die Links', async () => {
  const w = mount(HelpButton)
  await w.find('button.help').trigger('click')
  assert.equal(menu.visible, true)
  assert.match(menu.items[0].label, /Hilfe/)
  assert.ok(menu.items.some(i => i.label === 'journali.de'))
  assert.equal(menu.items.filter(i => !i.sep).length, HELP_LINKS.length + 3)
  menu.close()
})

test('das Kapitel zur Ansicht kommt aus dem Pfad', () => {
  assert.equal(chapterFor('/tree/p-1'), 'baum')
  assert.equal(chapterFor('/p/tasker/jobs'), 'jobs')
  assert.equal(chapterFor('/irgendwas'), 'was-journali-ist')
  assert.equal(chapterFor('/p/configurator/regeln'), 'konfigurator', 'der Konfigurator hat ein eigenes Kapitel, nicht das der Plugins')
})

test('das Kapitel Konfigurator gibt es in deutsch und englisch und baut zu HTML', async () => {
  const fs = await import('node:fs'), path = await import('node:path')
  const root = path.resolve(new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  for (const code of ['de', 'en']) {
    const md = fs.readFileSync(path.join(root, 'help', code, '19-konfigurator.md'), 'utf8')
    assert.match(md, /^# \S/, `${code}: Überschrift`)
    for (const wort of ['/api/configurator/{key}/check', 'selectable']) assert.ok(md.includes(wort), `${code}: nennt ${wort}`)
  }
  const { marked } = await import('marked')
  assert.match(marked.parse(fs.readFileSync(path.join(root, 'help', 'de', '19-konfigurator.md'), 'utf8'), { gfm: true }), /<table>/, 'die Tabelle der Zeilen wird zur Tabelle')
})

test('ein Eintrag öffnet seine Adresse in einem neuen Fenster', () => {
  const opened = []
  const items = helpItems(url => opened.push(url), '/tree')
  items.find(i => i.label === 'journali.de').action()
  assert.deepEqual(opened, ['https://journali.de'])
})

test('jeder Link hat Name, Adresse mit https und einen Hinweis für den Tooltip', () => {
  for (const l of HELP_LINKS) {
    assert.ok(l.label && !l.label.includes(' '), `Name ohne Satz: ${l.label}`)
    assert.match(l.url, /^https:\/\//)
    assert.ok(l.hint)
  }
})

// Demo (07.10.2026): die Schnittstelle (API) steht nicht im Hilfemenü — sie ist dort gesperrt
test('in der Demo kein Eintrag Schnittstelle (API)', async () => {
  const { store } = await import('../src/store.js')
  store.demo = true
  try { assert.ok(!helpItems(() => {}, '/tree').some(i => /Schnittstelle/.test(i.label ?? ''))) } finally { store.demo = false }
  assert.ok(helpItems(() => {}, '/tree').some(i => /Schnittstelle/.test(i.label ?? '')))
})
