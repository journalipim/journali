// journali advisor (18.10.2026): das Fenster unten rechts — fragen, die Abschnitte der Hilfe sehen, einen anklicken und im Kapitel an der Stelle
// landen; mit KI darüber eine Antwort mit Hinweis. Geöffnet im Hilfemenü, in der Demo auch mit dem blauen Knopf oben neben dem grünen „product
// advisor“.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mount, flushPromises, press, win } from './ui.mjs'

const JournaliAdvisor = (await import('../src/components/JournaliAdvisor.vue')).default
const HelpPanel = (await import('../src/components/HelpPanel.vue')).default
const { advisor, openAdvisor, closeAdvisor, hilfe, closeHelp, helpItems } = await import('../src/help.js')
const { vorratLeeren } = await import('../src/journaliAdvisor.js')
const { ai } = await import('../src/ai.js')

const KAPITEL = {
  'index.json': JSON.stringify([{ slug: 'baum', title: 'Der Baum', nr: '04' }, { slug: 'modell', title: 'Das Modell', nr: '03' }]),
  'baum.html': '<h1>Der Baum</h1><p>Der Pflegebaum hält die Produktdaten.</p><h2>Anlegen</h2><p>Die Knöpfe über dem Baum legen eine Gruppe, ein Produkt oder eine Variante an.</p>',
  'modell.html': '<h1>Das Modell</h1><p>Das Modell beschreibt die Daten.</p><h2>Attribute</h2><p>Ein Attribut hat einen Schlüssel und einen Typ.</p><h2>Wertelisten</h2><p>Eine Liste hat Werte.</p>',
}
function server() {
  globalThis.fetch = async url => {
    const datei = decodeURIComponent(String(url).split('/').pop())
    return datei in KAPITEL ? { ok: true, json: async () => JSON.parse(KAPITEL[datei]), text: async () => KAPITEL[datei] } : { ok: false }
  }
}
const ruhe = async () => { for (let i = 0; i < 6; i++) { await flushPromises(); await new Promise(r => setTimeout(r, 0)) } }
const fenster = () => document.querySelector('.ja-fenster')
async function frage(text) {
  const feld = document.querySelector('.ja-feld')
  feld.value = text; feld.dispatchEvent(new win.Event('input'))
  await ruhe()
  document.querySelector('.ja-eingabe').dispatchEvent(new win.Event('submit', { cancelable: true }))
  await ruhe()
}

test('zu steht nichts da; offen: Begrüssung, Feld, blauer Kopf mit Namen', async () => {
  server(); vorratLeeren(); closeAdvisor()
  const w = mount(JournaliAdvisor)
  assert.equal(fenster(), null)
  openAdvisor(); await ruhe()
  assert.ok(fenster())
  assert.equal(document.querySelector('.ja-titel').textContent, 'journali advisor')
  assert.match(document.querySelector('.ja-gruss').textContent, /aus der Hilfe/)
  assert.equal(document.querySelector('.ja-feld').placeholder, 'Wie mache ich …?')
  closeAdvisor(); await ruhe(); assert.equal(fenster(), null)
  w.unmount()
})

test('ohne KI: die Abschnitte der Hilfe — ein Klick öffnet das Kapitel an der Stelle', async () => {
  server(); vorratLeeren(); closeHelp(); hilfe.chapter = ''
  const verfuegbar = ai.available; ai.available = () => false
  const w = mount(JournaliAdvisor)
  try {
    openAdvisor(); await ruhe()
    await frage('Wie lege ich ein Attribut an?')
    assert.equal(document.querySelector('.ja-frage').textContent, 'Wie lege ich ein Attribut an?')
    assert.equal(document.querySelector('.ja-satz').textContent, 'Dazu steht in der Hilfe:')
    const abschnitte = [...document.querySelectorAll('.ja-abschnitt')]
    assert.equal(abschnitte[0].querySelector('.ja-ort').textContent.replace(/\s+/g, ' ').trim(), 'H1 Das Modell › Attribute')
    assert.match(abschnitte[0].querySelector('.ja-auszug').textContent, /Schlüssel/)
    assert.equal(document.querySelector('.ja-antwort'), null, 'ohne KI keine Antwort')
    abschnitte[0].click(); await ruhe()
    assert.deepEqual([hilfe.open, hilfe.chapter, hilfe.abschnitt], [true, 'modell', 'Attribute'])
    // nichts gefunden
    await frage('Bananenbrot')
    assert.equal(document.querySelector('.ja-leer').textContent, 'Dazu steht nichts in der Hilfe.')
  } finally { ai.available = verfuegbar; closeAdvisor(); closeHelp(); hilfe.abschnitt = ''; await ruhe(); w.unmount() }
})

test('mit KI: die Antwort über den Abschnitten, mit Hinweis — ein Fehler der KI steht als Warnung da', async () => {
  server(); vorratLeeren()
  const verfuegbar = ai.available, ask = ai.ask
  ai.available = () => true; ai.ask = async () => '1. Unter Modell ein Attribut anlegen [H1]'
  const w = mount(JournaliAdvisor)
  try {
    openAdvisor(); await ruhe()
    await frage('Wie lege ich ein Attribut an?')
    assert.equal(document.querySelector('.ja-antwort').textContent, '1. Unter Modell ein Attribut anlegen [H1]')
    assert.equal(document.querySelector('.ja-ki').textContent, 'Text von einer KI erstellt')
    assert.equal(document.querySelector('.ja-satz'), null)
    assert.ok(document.querySelectorAll('.ja-abschnitt').length >= 1, 'die Abschnitte bleiben darunter')
    ai.ask = async () => { throw new Error('KI nicht verfügbar') }
    await frage('Wertelisten')
    assert.match([...document.querySelectorAll('.ja-warnung')].at(-1).textContent, /KI nicht verfügbar/)
  } finally { ai.available = verfuegbar; ai.ask = ask; closeAdvisor(); await ruhe(); w.unmount() }
})

test('Esc schliesst das Fenster', async () => {
  server(); vorratLeeren()
  const w = mount(JournaliAdvisor)
  openAdvisor(); await ruhe()
  press('Escape', { target: document.querySelector('.ja-feld') }); await ruhe()
  assert.equal(advisor.open, false)
  w.unmount()
})

test('das Hilfefenster springt zum Abschnitt und markiert ihn', async () => {
  server(); closeHelp(); hilfe.chapter = ''
  const gesprungen = []
  const alt = Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = function () { gesprungen.push(this.textContent) }
  const w = mount(HelpPanel)
  try {
    const { openHelp } = await import('../src/help.js')
    openHelp('modell', 'Wertelisten'); await ruhe()
    assert.deepEqual(gesprungen, ['Wertelisten'])
    assert.ok(document.querySelector('.help-text h2.markiert')?.textContent === 'Wertelisten')
    assert.equal(hilfe.abschnitt, '', 'einmal')
    // dasselbe Kapitel, ein anderer Abschnitt
    openHelp('modell', 'Attribute'); await ruhe()
    assert.deepEqual(gesprungen, ['Wertelisten', 'Attribute'])
  } finally { Element.prototype.scrollIntoView = alt; closeHelp(); await ruhe(); w.unmount() }
})

test('im Hilfemenü gleich nach der Hilfe zur Ansicht', () => {
  const items = helpItems(() => {}, '/tree')
  assert.match(items[0].label, /Hilfe/)
  assert.equal(items[1].label, 'journali advisor')
  closeAdvisor(); items[1].action()
  assert.equal(advisor.open, true)
  closeAdvisor()
})

test('oben: in der Demo der blaue Knopf, daneben der grüne „product advisor“', () => {
  const app = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  assert.match(app, /<button v-if="store\.demo && !abgemeldet" class="journali-advisor-start"[^>]*@click="openAdvisor\(\)">journali advisor<\/button>/)
  assert.ok(app.indexOf('class="journali-advisor-start"') < app.indexOf('class="berater-start"'), 'erst journali advisor, dann product advisor')
  assert.match(app, /@click="chatStarten">product advisor<\/button>/)
  assert.match(app, /<JournaliAdvisor \/>/)
  const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')
  assert.match(css, /\.status \.journali-advisor-start \{ background: var\(--accent\);/, 'blau wie journali')
})
