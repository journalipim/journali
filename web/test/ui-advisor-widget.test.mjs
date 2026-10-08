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
    words: [...new Set([...(body.woerter || []), ...(body.q ? [body.q.toLowerCase()] : [])])],
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
  await w.klick(w.$('.kopf .zu'))
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
  assert.equal(b.schatten.querySelector('.kopf .zu'), null)
})

test('eine Frage zeigt Treffer, fragt nach dem Merkmal, das sie am besten teilt, und bietet die weiteren an; ein Klick grenzt ein, ein zweiter nimmt es zurück', async () => {
  const w = starte()
  await warte()
  await w.frage('Bohrhammer')
  assert.equal(w.$('.blase.ich').textContent, 'Bohrhammer')
  assert.deepEqual(w.$$('.karte .name').map(e => e.textContent), ['Bohrhammer Pro', 'Akkuschrauber'])
  assert.ok(w.$$('.blase').some(b => b.textContent === '2 Produkte passen zu „bohrhammer“.'))
  // die erste Facette als Rückfrage, die übrigen zum Eingrenzen
  assert.equal(w.$('.rueckfrage .blase').textContent, 'Farbe?')
  assert.deepEqual(w.$$('.rueckfrage .chip').map(c => c.textContent), ['Rot (1)', 'Blau (1)'])
  // die weiteren Merkmale: je eines ein Knopf, die Werte auf Klick
  assert.ok(w.$$('.eingrenzen .facette').some(c => c.textContent === 'Leistung ▾'))
  assert.equal(w.$('.eingrenzen .werte').hidden, true)
  await w.klick(w.$$('.eingrenzen .facette').find(c => c.textContent === 'Leistung ▾'))
  assert.deepEqual(w.$$('.eingrenzen .werte .chip').map(c => c.textContent), ['bis 550 W', 'ab 550 W'], 'eine Zahl teilt sich in bis und ab')
  await w.klick(w.$$('.rueckfrage .chip').find(c => c.textContent === 'Rot (1)'))
  const letzte = w.rufe.filter(r => r.url.endsWith('/api/ask')).at(-1)
  assert.equal(letzte.body.q, '', 'keine neue Eingabe')
  assert.deepEqual(letzte.body.woerter, ['bohrhammer'], 'die gesammelten Wörter gehen mit')
  assert.deepEqual(letzte.body.filter, [{ attribute: 'color', op: 'eq', value: 'red' }])
  assert.ok(w.$$('.chip.an').some(c => c.textContent === 'Farbe: Rot ×'), 'der Filter steht als Chip da')
  await w.klick(w.$$('.chip.an').find(c => c.textContent === 'Farbe: Rot ×'))
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
  assert.ok(w.$$('.blase').some(b => b.textContent === '2 products match "drill".'))
  assert.equal(w.$('input[type=text]').placeholder, 'What are you looking for?')
})

// ---- Gespräch (08.10.2026): jede Eingabe ergänzt die Angaben, die Anfrage trägt sie mit, der Server merkt sich nichts

test('eine zweite Eingabe ergänzt die erste: Wörter, Filter und Verlauf gehen mit, nichts wird verworfen', async () => {
  const w = starte()
  await warte()
  await w.frage('Bohrhammer')
  await w.klick(w.$$('.rueckfrage .chip').find(c => c.textContent === 'Rot (1)'))
  await w.frage('leise')
  const letzte = w.rufe.filter(r => r.url.endsWith('/api/ask')).at(-1)
  assert.equal(letzte.body.q, 'leise')
  assert.deepEqual(letzte.body.woerter, ['bohrhammer'])
  assert.deepEqual(letzte.body.filter, [{ attribute: 'color', op: 'eq', value: 'red' }], 'der Filter bleibt')
  assert.deepEqual(letzte.body.verlauf, ['Bohrhammer'])
  // die Angaben stehen als Chips da, ein Wort lässt sich einzeln entfernen
  const woerter = w.$$('.angaben .chip.wort').map(c => c.textContent)
  assert.deepEqual(woerter.slice(-2), ['bohrhammer ×', 'leise ×'])
  await w.klick(w.$$('.angaben .chip.wort').find(c => c.textContent === 'bohrhammer ×'))
  assert.deepEqual(w.rufe.filter(r => r.url.endsWith('/api/ask')).at(-1).body.woerter, ['leise'])
})

test('„Neue Suche“ fängt von vorn an', async () => {
  const w = starte()
  await warte()
  await w.frage('Bohrhammer')
  await w.klick(w.$$('.chip.neu').at(-1))
  assert.ok(w.$$('.blase').some(b => b.textContent === 'Neue Suche'))
  await w.frage('Schrauber')
  const letzte = w.rufe.filter(r => r.url.endsWith('/api/ask')).at(-1)
  assert.deepEqual([letzte.body.woerter, letzte.body.filter, letzte.body.verlauf], [[], [], []])
})

test('ein Wort, das in keinem Produkt steht, wird genannt; ist nichts übrig, lässt sich eine Angabe lockern', async () => {
  const w = starte({
    ...STANDARD,
    '/api/ask': body => body.q === 'auto'
      ? [200, { total: 0, hits: [], facets: [], filter: [], words: ['zelt', 'blau'], unknown: ['auto'], relax: [{ kind: 'word', word: 'blau', label: 'blau', n: 3 }] }]
      : [200, { total: 3, hits: [HIT('z1', 'Zelt')], facets: [], filter: [], words: body.woerter ?? [] }],
  })
  await warte()
  await w.frage('auto')
  const blasen = w.$$('.blase').map(b => b.textContent)
  assert.ok(blasen.includes('„auto“ steht in keinem Produkt.'))
  assert.ok(blasen.includes('Kein Produkt passt dazu.'))
  const ohne = w.$$('.lockern .chip')
  assert.deepEqual(ohne.map(c => c.textContent), ['ohne blau (3)'])
  await w.klick(ohne[0])
  const letzte = w.rufe.filter(r => r.url.endsWith('/api/ask')).at(-1)
  assert.deepEqual([letzte.body.q, letzte.body.woerter], ['', ['zelt']], 'die zu enge Angabe ist weg')
})

test('Treffer nur nach dem Sinn heissen ähnliche Produkte', async () => {
  const w = starte({ ...STANDARD, '/api/ask': [200, { total: 2, similar: true, hits: [HIT('p1', 'Schlafsack'), HIT('p2', 'Decke')], facets: [], filter: [], words: [] }] })
  await warte()
  await w.frage('warm schlafen')
  assert.ok(w.$$('.blase').some(b => b.textContent === '2 ähnliche Produkte.'))
})

// Die Führung steht oben (08.10.2026): Satz mit der Suche, darunter die Rückfrage, dann die ersten drei Karten — der Rest auf Wunsch
test('die Rückfrage steht vor den Karten, gezeigt werden erst drei, der Rest mit „weitere zeigen“', async () => {
  const fuenf = ['Brede Hose', 'Kilden Hose', 'Heia Hose', 'Selje Hose', 'Tind Hose'].map((n, i) => HIT('h' + i, n))
  const w = starte({ ...STANDARD, '/api/ask': body => [200, { total: 17, hits: fuenf, filter: [], words: ['hose'],
    facets: [{ key: 'size', label: 'Grösse', type: 'list', n: 5, values: [{ value: 'm', label: 'M', n: 3 }, { value: 'l', label: 'L', n: 2 }] }] }] })
  await warte()
  await w.frage('hose')
  assert.ok(w.$$('.blase').some(b => b.textContent === '17 Produkte passen zu „hose“.'))
  const antwort = w.$$('.karten').at(-1)
  const kinder = [...antwort.children]
  assert.ok(kinder.indexOf(antwort.querySelector('.rueckfrage')) < kinder.indexOf(antwort.querySelector('.karte')), 'die Rückfrage vor den Karten')
  assert.equal(antwort.querySelectorAll('.karte').length, 3)
  const mehr = antwort.querySelector('.mehr')
  assert.equal(mehr.textContent, '2 weitere zeigen')
  await w.klick(mehr)
  assert.deepEqual([...antwort.querySelectorAll('.karte .name')].map(e => e.textContent), fuenf.map(h => h.name))
  assert.equal(antwort.querySelector('.mehr'), null)
})

test('ohne Auswahl ist der Knopf zum Vergleichen nicht da — hidden gilt auch gegen die eigenen Regeln', async () => {
  const w = starte()
  await warte()
  assert.equal(w.$('.leiste').hidden, true)
  assert.match(w.$('style').textContent, /\[hidden\] \{ display: none !important; \}/)
})

// ---- Variante ganz öffnen, Merkzettel (08.10.2026) — der Merkzettel liegt nur im Arbeitsspeicher der Seite

const MIT_VARIANTEN = {
  ...STANDARD,
  '/api/product/p1': [200, { id: 'p1', name: 'Skjold Hose', images: [], values: [{ label: 'Gewicht', value: '0.40 kg' }],
    variants: [{ id: 'v1', name: 'Skjold Hose · Braun · M', values: [{ label: 'Grösse', value: 'M' }] }, { id: 'v2', name: 'Skjold Hose · Braun · L', values: [{ label: 'Grösse', value: 'L' }] }] }],
  '/api/variant/v1': [200, { id: 'v1', product: { id: 'p1', name: 'Skjold Hose' }, name: 'Skjold Hose · Braun · M', keys: { sku: 'TW-1-M' }, images: ['m1'],
    values: [{ key: 'size', label: 'Grösse', value: 'M', axis: true }, { key: 'weight', label: 'Gewicht', value: '0.40 kg', axis: false }] }],
}

test('eine Variante lässt sich aus den Details ganz öffnen: Name mit Achsen, SKU, alle Werte, Bilder', async () => {
  const w = starte(MIT_VARIANTEN)
  await warte()
  await w.frage('hose')
  await w.klick(w.$$('.karte .details')[0])
  const zeilen = w.$$('.produkt tr')
  const m = zeilen.find(tr => tr.textContent.includes('Skjold Hose · Braun · M'))
  assert.ok(m, 'die Varianten heissen nach ihren Achsen')
  await w.klick(m.querySelector('td.aktion button'))
  assert.ok(w.rufe.some(r => r.url.endsWith('/api/variant/v1?locale=de')))
  const v = w.$('.variante')
  assert.equal(v.querySelector('.name').textContent, 'Skjold Hose · Braun · M')
  const tabelle = [...v.querySelectorAll('tr')].map(tr => [...tr.children].map(c => c.textContent))
  assert.deepEqual(tabelle, [['SKU', 'TW-1-M'], ['Grösse', 'M'], ['Gewicht', '0.40 kg']])
  assert.equal(v.querySelectorAll('.galerie img').length, 1)
  // zurück zum Produkt
  await w.klick([...v.querySelectorAll('.chip')].find(c => c.textContent === 'Zum Produkt'))
  assert.equal(w.$$('.produkt').length, 1, 'die Ansicht zeigt eines — das Produkt ersetzt die Variante')
  assert.equal(w.$('.variante'), null)
})

test('Produkte und Varianten kommen auf den Merkzettel; er steht im Kopf, öffnet und nimmt weg', async () => {
  const w = starte(MIT_VARIANTEN)
  await warte()
  assert.equal(w.$('.kopf .merk').hidden, true, 'leer: kein Merkzettel im Kopf')
  await w.frage('hose')
  const merken = w.$$('.karte .merken')[0]
  assert.equal(merken.textContent, '☆ Merken')
  await w.klick(merken)
  assert.equal(merken.textContent, '★ Gemerkt')
  assert.equal(w.$('.kopf .merk').textContent, '☆ 1')
  // die Variante dazu
  await w.klick(w.$$('.karte .details')[0])
  await w.klick(w.$$('.produkt tr').find(tr => tr.textContent.includes('Braun · M')).querySelector('td.aktion button'))
  await w.klick(w.$('.variante .merken'))
  assert.equal(w.$('.kopf .merk').textContent, '☆ 2')
  // der Merkzettel: zwei Einträge, öffnen, wegnehmen
  await w.klick(w.$('.kopf .merk'))
  const zettel = w.$$('.merkzettel').at(-1)
  assert.deepEqual([...zettel.querySelectorAll('tr td:first-child')].map(td => td.textContent), ['Bohrhammer Pro', 'Skjold Hose · Braun · M'])
  const vorher = w.rufe.length
  await w.klick(zettel.querySelectorAll('tr')[1].querySelector('td.aktion button'))
  assert.ok(w.rufe.slice(vorher).some(r => r.url.endsWith('/api/variant/v1?locale=de')), 'eine gemerkte Variante öffnet als Variante')
  await w.klick([...zettel.querySelectorAll('tr')[0].querySelectorAll('td.aktion button')].find(b => b.textContent === '×'))
  assert.equal(w.$('.kopf .merk').textContent, '☆ 1')
  assert.equal(zettel.querySelectorAll('tr').length, 1)
})

// Öffnen erweitert das Fenster (08.10.2026): die Ansicht steht neben dem Gespräch, das schwebende Fenster wird breiter, × schliesst sie
test('Details öffnen in einer Ansicht neben dem Gespräch, das Fenster wird breiter; × schliesst sie', async () => {
  const w = starte(MIT_VARIANTEN)
  await warte()
  await w.klick(w.$('.knopf'))
  await w.frage('hose')
  assert.equal(w.$('.ansicht').hidden, true)
  assert.equal(w.$('.fenster').classList.contains('breit'), false)
  await w.klick(w.$$('.karte .details')[0])
  assert.equal(w.$('.ansicht').hidden, false)
  assert.ok(w.$('.fenster').classList.contains('breit'))
  assert.ok(w.$('.ansicht .produkt'), 'das Produkt steht in der Ansicht, nicht im Gespräch')
  assert.equal(w.$('.verlauf .produkt'), null)
  assert.equal(w.$('.ansicht .tafelkopf .art').textContent, 'Produkt')
  await w.klick(w.$('.ansicht .tafelkopf .zu'))
  assert.equal(w.$('.ansicht').hidden, true)
  assert.equal(w.$('.fenster').classList.contains('breit'), false)
  // der Merkzettel öffnet ebenfalls dort
  await w.klick(w.$$('.karte .merken')[0])
  await w.klick(w.$('.kopf .merk'))
  assert.ok(w.$('.ansicht .merkzettel'))
})
