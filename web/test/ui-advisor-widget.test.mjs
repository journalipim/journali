// Das Chat-Fenster des Produktberaters (plugins/advisor/widget.js) im echten DOM (happy-dom): öffnen, fragen, eingrenzen, vergleichen — und kein
// Wert aus den Produktdaten wird als HTML gezeichnet. Der Dienst ist vorgetäuscht (fetch).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { win } from './ui.mjs'

const quelle = fs.readFileSync(new URL('../../plugins/advisor/widget.js', import.meta.url), 'utf8')
const warte = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setTimeout(r, 0)) }

function laden() {
  win.document.body.innerHTML = ''
  delete win.journaliAdvisor
  vm.runInNewContext(quelle, { window: win, document: win.document, navigator: win.navigator, URL, console, setTimeout })
  return win.journaliAdvisor
}

const HIT = (id, name, extra = {}) => ({ id, name, keys: { sku: 'S-' + id }, image: null, variants: 1, values: [{ key: 'leistung', label: 'Leistung', value: '800 W' }], ...extra })

function dienst(antworten = {}) {
  const rufe = []
  const fetch = async (url, o = {}) => {
    const body = o.body ? JSON.parse(o.body) : undefined
    rufe.push({ url, method: o.method ?? 'GET', body })
    const pfad = url.replace('https://advisor.test', '')
    const r = antworten[pfad.split('?')[0]] ?? antworten['*']
    const [status, json] = typeof r === 'function' ? r(body, rufe) : r ?? [404, { error: 'x' }]
    return { ok: status < 300, status, json: async () => json }
  }
  return { rufe, fetch }
}

const STANDARD = {
  '/api/info': [200, { label: 'Werkzeugberater', greeting: { de: 'Wobei darf ich helfen?' }, locales: ['de'], locale: 'de' }],
  '/api/ask': body => [200, {
    total: body.filter.length ? 1 : 2,
    hits: body.filter.length ? [HIT('p1', 'Bohrhammer Pro')] : [HIT('p1', 'Bohrhammer Pro'), HIT('p2', 'Akkuschrauber')],
    facets: body.filter.length ? [] : [{ key: 'color', label: 'Farbe', type: 'list', n: 2, values: [{ value: 'red', label: 'Rot', n: 1 }, { value: 'blue', label: 'Blau', n: 1 }] },
      { key: 'leistung', label: 'Leistung', type: 'range', unit: 'W', min: 300, max: 800, split: 550, n: 2 }],
    filter: body.filter.map(f => ({ ...f, label: 'Farbe', valueLabel: 'Rot' })), answer: null,
  }],
  '/api/compare': [200, { products: [{ id: 'p1', name: 'Bohrhammer Pro' }, { id: 'p2', name: 'Akkuschrauber' }], rows: [{ key: 'leistung', label: 'Leistung', values: ['800 W', '300 W'], same: false }, { key: 'color', label: 'Farbe', values: ['Rot', 'Rot'], same: true }] }],
  '/api/product/p1': [200, { id: 'p1', name: 'Bohrhammer Pro', images: ['m1'], values: [{ label: 'Leistung', value: '800 W' }], variants: [] }],
}

function starte(antworten = STANDARD, o = {}) {
  const d = dienst(antworten)
  const b = laden().start({ base: 'https://advisor.test/', fetch: d.fetch, locale: 'de', ...o })
  const $ = sel => b.schatten.querySelector(sel)
  const $$ = sel => [...b.schatten.querySelectorAll(sel)]
  const klick = async el => { el.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); await warte() }
  const frage = async text => { $('input[type=text]').value = text; $('form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true })); await warte() }
  return { ...d, b, $, $$, klick, frage }
}

test('der Knopf öffnet das Fenster mit Bezeichnung und Begrüssung des Beraters', async () => {
  const w = starte()
  await warte()
  assert.equal(w.$('.knopf').textContent, 'Werkzeugberater')
  assert.equal(w.$('.fenster').hidden, true)
  await w.klick(w.$('.knopf'))
  assert.equal(w.$('.fenster').hidden, false)
  assert.equal(w.$('.titel').textContent, 'Werkzeugberater')
  assert.equal(w.$('.blase').textContent, 'Wobei darf ich helfen?')
  await w.klick(w.$('.kopf button'))
  assert.equal(w.$('.fenster').hidden, true, '× schliesst')
})

test('eingebettet in ein Element gibt es keinen Knopf und kein Schliessen', async () => {
  win.document.body.innerHTML = ''
  const d = dienst(STANDARD)
  laden()
  const ziel = win.document.createElement('div'); ziel.id = 'advisor'; win.document.body.append(ziel)
  const b = win.journaliAdvisor.start({ base: 'https://advisor.test', fetch: d.fetch, locale: 'de', target: '#advisor' })
  await warte()
  assert.ok(ziel.contains(b.wirt))
  assert.equal(b.schatten.querySelector('.knopf'), null)
  assert.ok(b.schatten.querySelector('.fenster.eingebettet'))
  assert.equal(b.schatten.querySelector('.kopf button'), null)
})

test('eine Frage zeigt Treffer als Karten und Facetten zum Eingrenzen; ein Klick grenzt ein, ein zweiter nimmt es zurück', async () => {
  const w = starte()
  await warte()
  await w.frage('Bohrhammer')
  assert.equal(w.$('.blase.ich').textContent, 'Bohrhammer')
  assert.deepEqual(w.$$('.karte .name').map(e => e.textContent), ['Bohrhammer Pro', 'Akkuschrauber'])
  assert.ok(w.$$('.blase').some(b => b.textContent === '2 Produkte passen.'))
  const chips = w.$$('.chip').map(c => c.textContent)
  assert.ok(chips.includes('Farbe: Rot (1)'))
  assert.ok(chips.includes('Leistung bis 550 W') && chips.includes('Leistung ab 550 W'), 'eine Zahl teilt sich in bis und ab')
  await w.klick(w.$$('.chip').find(c => c.textContent === 'Farbe: Rot (1)'))
  const letzte = w.rufe.filter(r => r.url.endsWith('/api/ask')).at(-1)
  assert.equal(letzte.body.q, 'Bohrhammer', 'dieselbe Frage')
  assert.deepEqual(letzte.body.filter, [{ attribute: 'color', op: 'eq', value: 'red' }])
  assert.ok(w.$$('.chip.an').some(c => c.textContent === 'Farbe: Rot ×'), 'der Filter steht als Chip da')
  await w.klick(w.$$('.chip.an').at(-1))
  assert.deepEqual(w.rufe.filter(r => r.url.endsWith('/api/ask')).at(-1).body.filter, [])
})

test('Werte aus den Produktdaten werden nie als HTML gezeichnet', async () => {
  const boese = '<img src=x onerror="window.angegriffen=1">'
  const w = starte({ ...STANDARD, '/api/ask': [200, { total: 1, hits: [HIT('p1', boese, { values: [{ label: '<b>L</b>', value: boese }] })], facets: [], filter: [], answer: boese }] })
  await warte()
  await w.frage('x')
  assert.equal(w.$$('img').length, 0, 'kein Bild aus dem Text')
  assert.equal(w.$('.karte .name').textContent, boese)
  assert.equal(win.angegriffen, undefined)
})

test('der Text einer KI ist als solcher gekennzeichnet', async () => {
  const w = starte({ ...STANDARD, '/api/ask': [200, { total: 1, hits: [HIT('p1', 'Bohrhammer Pro')], facets: [], filter: [], answer: 'Für Beton passt [1].' }] })
  await warte()
  await w.frage('Beton')
  const b = w.$$('.blase').find(x => x.textContent.startsWith('Für Beton passt [1].'))
  assert.ok(b)
  assert.equal(b.querySelector('.hinweis').textContent, 'Text von einer KI erstellt')
})

test('zwei angehakte Produkte lassen sich vergleichen, gleiche Zeilen sind leiser', async () => {
  const w = starte()
  await warte()
  await w.frage('Bohrhammer')
  assert.equal(w.$('.leiste').hidden, true)
  for (const box of w.$$('.karte input[type=checkbox]')) { box.checked = true; box.dispatchEvent(new win.Event('change')) }
  assert.equal(w.$('.leiste').hidden, false)
  assert.equal(w.$('.vergleich').textContent, '2 vergleichen')
  await w.klick(w.$('.leiste button'))
  assert.deepEqual(w.rufe.find(r => r.url.endsWith('/api/compare')).body.ids, ['p1', 'p2'])
  const zeilen = w.$$('table.vergleich tr')
  assert.deepEqual([...zeilen[0].children].map(c => c.textContent), ['Merkmal', 'Bohrhammer Pro', 'Akkuschrauber'])
  assert.ok(zeilen.find(z => z.firstChild.textContent === 'Farbe').classList.contains('gleich'))
})

test('Details zeigen die Werte und die Bilder über den Dienst', async () => {
  const w = starte()
  await warte()
  await w.frage('Bohrhammer')
  await w.klick(w.$('.karte .details'))
  const produkt = w.$('.produkt')
  assert.equal(produkt.querySelector('.name').textContent, 'Bohrhammer Pro')
  assert.equal(produkt.querySelector('img').getAttribute('src'), 'https://advisor.test/api/image/m1?gross=1')
  assert.deepEqual([...produkt.querySelectorAll('tr')].map(t => t.textContent), ['Leistung800 W'])
})

test('zu viele Fragen und ein Ausfall stehen als Satz im Verlauf', async () => {
  const w = starte({ ...STANDARD, '/api/ask': [429, { error: 'x' }] })
  await warte()
  await w.frage('a')
  assert.ok(w.$$('.blase').some(b => b.textContent === 'Zu viele Fragen in kurzer Zeit.'))
  const w2 = starte({ ...STANDARD, '/api/ask': [502, { error: 'x' }] })
  await warte()
  await w2.frage('a')
  assert.ok(w2.$$('.blase').some(b => b.textContent === 'Der Berater antwortet gerade nicht.'))
})

test('englisch, wenn die Seite es sagt', async () => {
  const w = starte(STANDARD, { locale: 'en-GB' })
  await warte()
  await w.frage('drill')
  assert.equal(w.rufe.find(r => r.url.endsWith('/api/ask')).body.locale, 'en')
  assert.ok(w.$$('.blase').some(b => b.textContent === '2 products match.'))
  assert.equal(w.$('input[type=text]').placeholder, 'What are you looking for?')
})
