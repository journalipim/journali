// „Produktberater starten“ (15.10.2026): in der Demo mit Chat-Dienst steht rechts neben „Testversion“ ein grüner Knopf. Er lädt das Chat-Fenster
// vom Dienst, so wie eine Website es einbindet, und öffnet es; ein zweiter Klick öffnet dasselbe wieder, statt ein zweites zu laden.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { win } from './ui.mjs'
import { api } from '../src/api.js'
import { store } from '../src/store.js'
import { beraterStarten, chat, diensteLaden } from '../src/berater.js'

const skripte = () => [...win.document.querySelectorAll('script[data-journali-advisor]')]

test('der erste Klick lädt das Fenster und öffnet es gleich, ein weiterer lädt kein zweites', () => {
  skripte().forEach(s => s.remove()); delete win.journaliAdvisor
  assert.equal(beraterStarten('https://chat.example/', 'de'), 'geladen')
  const [s] = skripte()
  assert.equal(s.getAttribute('src'), 'https://chat.example/widget.js')
  assert.equal(s.dataset.open, '1', 'gleich offen')
  assert.equal(s.dataset.locale, 'de')
  assert.equal(beraterStarten('https://chat.example', 'de'), 'laedt', 'solange es lädt: nichts Neues')
  assert.equal(skripte().length, 1)
  skripte().forEach(s => s.remove())
})

test('ist das Fenster geladen, öffnet der Knopf dasselbe wieder', () => {
  let geoeffnet = 0
  win.journaliAdvisor = { fenster: { oeffnen: () => geoeffnet++ } }
  try {
    assert.equal(beraterStarten('https://chat.example', 'en'), 'offen')
    assert.equal(geoeffnet, 1)
    assert.equal(skripte().length, 0, 'kein zweites Skript')
  } finally { delete win.journaliAdvisor }
})

test('ohne eigene Sprache die des Browsers — nie „null“', () => {
  skripte().forEach(s => s.remove()); delete win.journaliAdvisor
  beraterStarten('https://chat.example', null)
  assert.notEqual(skripte()[0].dataset.locale, 'null')
  assert.match(skripte()[0].dataset.locale, /^[a-z]{2}$/)
  skripte().forEach(s => s.remove())
})

test('der Knopf steht rechts neben „Testversion“, nur mit Adresse eines Dienstes und nicht auf der Anmeldeseite', () => {
  const app = fs.readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
  const testversion = app.indexOf('class="testversion"'), knopf = app.indexOf('class="berater-start"')
  assert.ok(testversion > 0 && knopf > testversion, 'gleich danach')
  assert.match(app, /<button v-if="chatDienste\.length && !abgemeldet" class="berater-start"[^>]*@click="chatStarten">product advisor<\/button>/)
  assert.match(app, /const chatDienste = computed\(\(\) => store\.berater \? \[\{ key: 'demo', label: 'Beispielshop Tannwald Outdoor', url: store\.berater \}\] : chat\.dienste\)/, 'in der Demo der Dienst aus /api/health')
  assert.match(fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8'), /\.status \.berater-start \{ background: #15803d;/, 'grün')
})

test('die Adresse kommt aus /api/health — ohne sie kein Knopf', async () => {
  const get = api.get
  try {
    api.get = async p => p.startsWith('/api/health') ? { ok: true, demo: true, testversion: true, berater: 'https://chat.example', head: 1, nodes: 1 } : {}
    await store.poll(); assert.equal(store.berater, 'https://chat.example')
    api.get = async p => p.startsWith('/api/health') ? { ok: true, demo: true, testversion: true, head: 1, nodes: 1 } : {}
    await store.poll(); assert.equal(store.berater, null)
  } finally { api.get = get }
})

test('ausserhalb der Demo (18.10.2026): die Berater mit Adresse ihres Dienstes — ohne Adresse oder mit Fehlern keiner', async () => {
  const get = api.get
  try {
    api.get = async p => p === '/api/advisor' ? [
      { key: 'shop', label: 'Shop', url: 'http://localhost:8190/', errors: [] },
      { key: 'ohne', label: 'Ohne Dienst', url: null, errors: [] },
      { key: 'kaputt', label: 'Kaputt', url: 'http://x', errors: ['Publikationsbaum fehlt.'] },
    ] : {}
    await diensteLaden()
    assert.deepEqual(chat.dienste, [{ key: 'shop', label: 'Shop', url: 'http://localhost:8190' }])
    api.get = async () => { throw new Error('403') }
    await diensteLaden()
    assert.deepEqual(chat.dienste, [], 'ohne Leserecht kein Knopf')
  } finally { api.get = get }
})

test('ein anderer Dienst: das Fenster des bisherigen fällt weg, das neue lädt', () => {
  skripte().forEach(s => s.remove()); delete win.journaliAdvisor
  beraterStarten('http://localhost:8190', 'de')
  const wirt = win.document.createElement('div'); wirt.setAttribute('data-journali-advisor', ''); win.document.body.append(wirt)   // das Fenster des ersten
  let geoeffnet = 0
  win.journaliAdvisor = { fenster: { oeffnen: () => geoeffnet++ } }
  assert.equal(beraterStarten('http://localhost:8190/', 'de'), 'offen', 'derselbe Dienst: dasselbe Fenster')
  assert.equal(beraterStarten('https://advisor.example', 'de'), 'geladen')
  assert.deepEqual(skripte().map(s => s.getAttribute('src')), ['https://advisor.example/widget.js'])
  assert.equal(win.document.querySelectorAll('div[data-journali-advisor]').length, 0, 'das alte Fenster ist weg')
  assert.equal(win.journaliAdvisor, undefined)
  assert.equal(geoeffnet, 1)
  skripte().forEach(s => s.remove())
})
