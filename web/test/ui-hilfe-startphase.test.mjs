// Hilfe in der Startphase (05.10.2026): Kapitel, die nur mit Lizenz gelten, fallen weg; im Text stehen die Blöcke der Startphase statt der
// Lizenzblöcke, und die Suche findet nur, was dasteht. Gebaut wird das in build-help.mjs aus Markierungen im Markdown.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mount, flushPromises } from './ui.mjs'
import { store } from '../src/store.js'
import { bloecke } from '../build-help.mjs'

const HelpPanel = (await import('../src/components/HelpPanel.vue')).default
const { hilfe, openHelp, closeHelp } = await import('../src/help.js')

const INDEX = [{ slug: 'teams', title: 'Teams', nr: '02' }, { slug: 'limits', title: 'Nutzungslimits', nr: '12', lizenz: true }]
const TEXT = bloecke('# Teams\n\n<!-- lizenz -->\nDas Team trägt das Kontingent.\n<!-- /lizenz -->\n<!-- startphase -->\nDas Team trägt die KI-Schlüssel.\n<!-- /startphase -->\n')
function server() {
  globalThis.fetch = async url => {
    const p = String(url)
    if (p.endsWith('index.json')) return { ok: true, json: async () => INDEX }
    return { ok: true, text: async () => p.includes('teams') ? TEXT : '<h1>Limits</h1>' }
  }
}

test('bloecke: Lizenz- und Startphasen-Teile werden eigene Blöcke, der Rest bleibt', () => {
  assert.match(TEXT, /<div class="nur-lizenz">\s*<p>Das Team trägt das Kontingent\.<\/p>\s*<\/div>/)
  assert.match(TEXT, /<div class="nur-startphase">\s*<p>Das Team trägt die KI-Schlüssel\.<\/p>\s*<\/div>/)
  assert.match(TEXT, /^<h1>Teams<\/h1>/)
})

test('die Hilfe im Repo: das Kapitel Nutzungslimits ist als Lizenzkapitel markiert, Teams hat beide Fassungen', () => {
  for (const l of ['de', 'en']) {
    const kap = fs.readdirSync(`../help/${l}`)
    assert.match(fs.readFileSync(`../help/${l}/${kap.find(f => f.startsWith('12-'))}`, 'utf8'), /<!-- nur-mit-lizenz -->/)
    const teams = bloecke(fs.readFileSync(`../help/${l}/${kap.find(f => f.startsWith('02-'))}`, 'utf8'))
    assert.match(teams, /nur-lizenz/); assert.match(teams, /nur-startphase/)
  }
})

for (const startphase of [true, false]) {
  test(`Hilfefenster ${startphase ? 'in der Startphase: ohne Lizenzkapitel, Text der Startphase' : 'ohne Startphase: alle Kapitel'}`, async () => {
    server(); closeHelp(); hilfe.chapter = ''; store.startphase = startphase
    const w = mount(HelpPanel); await flushPromises()
    openHelp('teams'); for (let i = 0; i < 4; i++) await flushPromises()
    const kapitel = [...document.querySelectorAll('.help-chapter')].map(a => a.textContent.trim())
    assert.deepEqual(kapitel, startphase ? ['02 Teams'] : ['02 Teams', '12 Nutzungslimits'])
    assert.equal(document.querySelector('.help-text').classList.contains('startphase'), startphase, 'die Klasse entscheidet, welcher Block sichtbar ist')
    // die Suche findet nur, was dasteht
    const suche = document.querySelector('.help-search'); suche.value = 'kontingent'; suche.dispatchEvent(new window.Event('input'))
    for (let i = 0; i < 4; i++) await flushPromises()
    assert.equal(document.querySelectorAll('.help-chapter').length, startphase ? 0 : 1)
    closeHelp(); await flushPromises(); w.unmount(); store.startphase = false
  })
}
