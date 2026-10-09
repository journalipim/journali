// Das Chat-Fenster des Produktberaters (plugins/advisor/widget.js) im echten DOM (happy-dom): öffnen, fragen, eingrenzen, vergleichen — und kein
// Wert aus den Produktdaten wird als HTML gezeichnet. Seit 09.10.2026 (pflegestruktur 44) zeigt das Fenster nur an: es schickt Eingaben und Klicks
// mit der Kennung des Gesprächs, der Kern im Dienst versteht und setzt die Sätze zusammen. Der Dienst ist hier vorgetäuscht (fetch) — eine
// Attrappe des Kerns mit Gedächtnis; was der Kern selbst tut, prüft advisor-kern.test.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { win } from './ui.mjs'

const quelle = fs.readFileSync(new URL('../../plugins/advisor/widget.js', import.meta.url), 'utf8')
const satz = b => (b.querySelector('.satz') ?? b).textContent   // der Satz einer Antwort, ohne ihre Knöpfe
const warte = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setTimeout(r, 0)) }

function laden() {
  win.document.body.innerHTML = ''
  delete win.journaliAdvisor
  vm.runInNewContext(quelle, { window: win, document: win.document, navigator: win.navigator, URL, console, setTimeout })
  return win.journaliAdvisor
}

const HIT = (id, name, extra = {}) => ({ id, name, keys: { sku: 'S-' + id }, image: null, variants: 1, values: [{ key: 'leistung', label: 'Leistung', value: '800 W' }], ...extra })
const FACETTEN = [{ key: 'color', label: 'Farbe', type: 'list', n: 2, values: [{ value: 'red', label: 'Rot', n: 1 }, { value: 'blue', label: 'Blau', n: 1 }] },
  { key: 'leistung', label: 'Leistung', type: 'range', unit: 'W', min: 300, max: 800, split: 550, n: 2 }]

/// Eine Attrappe des Kerns: sie merkt sich Wörter und Filter je Gespräch und antwortet mit Sätzen wie der Kern
function kernAttrappe() {
  const g = { woerter: [], filter: [] }
  return body => {
    const s = body.schritt
    const en = body.locale === 'en'
    if (s?.art === 'neu') { g.woerter = []; g.filter = []; return [200, { reset: true, texte: { satz: en ? 'New search' : 'Neue Suche', hinweise: [] } }] }
    if (s?.art === 'filter') g.filter.push({ attribute: s.attribute, op: s.op, value: s.value, label: 'Farbe', valueLabel: 'Rot' })
    if (s?.art === 'weg') { if (s.kind === 'word') g.woerter = g.woerter.filter(w => w !== s.word); else g.filter = g.filter.filter(f => !(f.attribute === s.attribute && f.value === s.value)) }
    for (const w of String(body.q ?? '').toLowerCase().split(/\s+/).filter(Boolean)) if (!g.woerter.includes(w)) g.woerter.push(w)
    const eins = g.filter.length > 0
    return [200, {
      total: eins ? 1 : 2, hits: eins ? [HIT('p1', 'Bohrhammer Pro')] : [HIT('p1', 'Bohrhammer Pro'), HIT('p2', 'Akkuschrauber', { seen: true })],
      facets: eins ? [] : FACETTEN, filter: [...g.filter], words: [...g.woerter], answer: null,
      texte: {
        satz: eins ? '1 Produkt passt.' : en ? `2 products match "${g.woerter.join(' ')}".` : `2 Produkte passen zu „${g.woerter.join(' ')}“.`,
        frage: eins ? 'Passt eines davon?' : 'Passt eines davon? Oder soll ich nach Farbe oder Leistung eingrenzen?', hinweise: [],
      },
    }]
  }
}

function dienst(antworten) {
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

const standard = () => ({
  '/api/info': [200, { label: 'Werkzeugberater', greeting: { de: 'Wobei darf ich helfen?' }, locales: ['de'], locale: 'de' }],
  '/api/ask': kernAttrappe(),
  '/api/event': [204, null],
  '/api/compare': [200, { products: [{ id: 'p1', name: 'Bohrhammer Pro' }, { id: 'p2', name: 'Akkuschrauber' }], rows: [{ key: 'leistung', label: 'Leistung', values: ['800 W', '300 W'], same: false }, { key: 'color', label: 'Farbe', values: ['Rot', 'Rot'], same: true }] }],
  '/api/product/p1': [200, { id: 'p1', name: 'Bohrhammer Pro', images: ['m1'], texts: [{ key: 'description', label: 'Beschreibung', value: 'Schlägt <b>kräftig</b>.\n\nMit Koffer.' }],
    values: [{ label: 'Leistung', value: '800 W' }], variants: [] }],
})

/// Eine Antwort, wie der Kern sie gibt — für Tests, die einen bestimmten Fall vorgeben
const antwort = (x, texte = {}) => [200, { total: 0, hits: [], facets: [], filter: [], words: [], ...x, texte: { hinweise: [], ...texte } }]

function starte(antworten = standard(), o = {}) {
  const d = dienst(antworten)
  const b = laden().start({ base: 'https://advisor.test/', fetch: d.fetch, locale: 'de', ...o })
  const $ = sel => b.schatten.querySelector(sel)
  const $$ = sel => [...b.schatten.querySelectorAll(sel)]
  const klick = async el => { el.dispatchEvent(new win.MouseEvent('click', { bubbles: true })); await warte() }
  const frage = async text => { $('input[type=text]').value = text; $('form').dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true })); await warte() }
  const fragen = () => d.rufe.filter(r => r.url.endsWith('/api/ask'))
  return { ...d, b, $, $$, klick, frage, fragen }
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
  const d = dienst(standard())
  laden()
  const ziel = win.document.createElement('div'); ziel.id = 'advisor'; win.document.body.append(ziel)
  const b = win.journaliAdvisor.start({ base: 'https://advisor.test', fetch: d.fetch, locale: 'de', target: '#advisor' })
  await warte()
  assert.ok(ziel.contains(b.wirt))
  assert.ok(!b.schatten.querySelector('.knopf'))
  assert.ok(b.schatten.querySelector('.fenster.eingebettet'))
  assert.ok(!b.schatten.querySelector('.kopf .zu'))
})

test('eine Eingabe geht mit der Kennung des Gesprächs an den Dienst — nur die Eingabe, keine gesammelten Angaben', async () => {
  const w = starte()
  await warte()
  await w.frage('Bohrhammer')
  const [eins] = w.fragen()
  assert.match(eins.body.gespraech, /^[0-9a-f]{32}$/, 'zufällig, ohne Person')
  assert.deepEqual({ ...eins.body, gespraech: 'x' }, { gespraech: 'x', locale: 'de', q: 'Bohrhammer' })
  await w.frage('leise')
  assert.equal(w.fragen()[1].body.gespraech, eins.body.gespraech, 'dasselbe Gespräch')
  // ein neues Fenster: ein neues Gespräch
  const v = starte(); await warte(); await v.frage('x')
  assert.notEqual(v.fragen()[0].body.gespraech, eins.body.gespraech)
})

test('eine Frage zeigt Treffer, fragt nach dem Merkmal, das sie am besten teilt, und bietet die weiteren an; ein Klick grenzt ein, ein zweiter nimmt es zurück', async () => {
  const w = starte()
  await warte()
  await w.frage('Bohrhammer')
  assert.equal(w.$('.blase.ich').textContent, 'Bohrhammer')
  assert.deepEqual(w.$$('.karte .name').map(e => e.textContent), ['Bohrhammer Pro', 'Akkuschrauber'])
  assert.ok(w.$$('.blase').some(b => satz(b) === '2 Produkte passen zu „bohrhammer“.'), 'der Satz des Kerns')
  // die Frage des Kerns nennt die Merkmale; das Fenster bietet sie in derselben Blase an: das erste offen, seine Werte darunter
  assert.equal(w.$('.rueckfrage .blase .frage').textContent, 'Passt eines davon? Oder soll ich nach Farbe oder Leistung eingrenzen?')
  assert.deepEqual(w.$$('.abschluss .blase .facette').map(c => c.textContent), ['Farbe ▾', 'Leistung ▾'])
  assert.ok(w.$('.abschluss .blase .facette').classList.contains('offen'))
  assert.deepEqual(w.$$('.abschluss .blase .werte .chip').map(c => c.textContent), ['Rot (1)', 'Blau (1)'])
  await w.klick(w.$$('.abschluss .facette').find(c => c.textContent === 'Leistung ▾'))
  assert.deepEqual(w.$$('.abschluss .werte .chip').map(c => c.textContent), ['bis 550 W', 'ab 550 W'], 'eine Zahl teilt sich in bis und ab')
  await w.klick(w.$$('.abschluss .facette').find(c => c.textContent === 'Farbe ▾'))
  await w.klick(w.$$('.rueckfrage .chip').find(c => c.textContent === 'Rot (1)'))
  // der Klick ist ein Schritt im Gespräch — das Fenster hält die Angaben nicht selbst
  const letzte = w.fragen().at(-1)
  assert.equal(letzte.body.q, undefined, 'keine neue Eingabe')
  assert.deepEqual(letzte.body.schritt, { art: 'filter', attribute: 'color', op: 'eq', value: 'red' })
  assert.ok(w.$$('.chip.an').some(c => c.textContent === 'Farbe: Rot ×'), 'der Filter steht als Chip da')
  await w.klick(w.$$('.chip.an').find(c => c.textContent === 'Farbe: Rot ×'))
  assert.deepEqual(w.fragen().at(-1).body.schritt, { art: 'weg', kind: 'filter', attribute: 'color', op: 'eq', value: 'red' })
})

test('Werte aus den Produktdaten werden nie als HTML gezeichnet', async () => {
  const boese = '<img src=x onerror="window.angegriffen=1">'
  const w = starte({ ...standard(), '/api/ask': antwort({ total: 1, hits: [HIT('p1', boese, { values: [{ label: '<b>L</b>', value: boese }] })], answer: boese }, { satz: boese }) })
  await warte()
  await w.frage('x')
  assert.equal(w.$$('img').length, 0, 'kein Bild aus dem Text')
  assert.equal(w.$('.karte .name').textContent, boese)
  assert.equal(win.angegriffen, undefined)
})

test('der Text einer KI ersetzt den Satz und ist als solcher gekennzeichnet', async () => {
  const w = starte({ ...standard(), '/api/ask': antwort({ total: 1, hits: [HIT('p1', 'Bohrhammer Pro')], answer: 'Für Beton passt [1].' }, { satz: '1 Produkt passt.' }) })
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

test('Details zeigen die Werte und die Bilder über den Dienst — das geöffnete Produkt kommt mit der Kennung, der Kern hat es im Blick', async () => {
  const w = starte()
  await warte()
  await w.frage('Bohrhammer')
  await w.klick(w.$('.karte .details'))
  const g = w.fragen()[0].body.gespraech
  assert.ok(w.rufe.some(r => r.url === `https://advisor.test/api/product/p1?locale=de&gespraech=${g}`))
  const produkt = w.$('.produkt')
  assert.equal(produkt.querySelector('.name').textContent, 'Bohrhammer Pro')
  assert.equal(produkt.querySelector('img').getAttribute('src'), 'https://advisor.test/api/image/m1?gross=1')
  // die Beschreibung steht als Absatz gleich unter dem Kopf, als Text — nie als HTML
  const absatz = produkt.querySelector('.tafelinhalt').firstElementChild
  assert.ok(absatz.classList.contains('absatz'))
  assert.equal(absatz.textContent, 'Schlägt <b>kräftig</b>.\n\nMit Koffer.')
  assert.ok(!absatz.querySelector('b'))
  assert.equal(absatz.title, 'Beschreibung')
  assert.deepEqual([...produkt.querySelectorAll('tr')].map(t => t.textContent), ['Leistung800 W'])
})

test('zu viele Fragen und ein Ausfall stehen als Satz im Verlauf', async () => {
  const w = starte({ ...standard(), '/api/ask': [429, { error: 'x' }] })
  await warte()
  await w.frage('a')
  assert.ok(w.$$('.blase').some(b => satz(b) === 'Zu viele Fragen in kurzer Zeit.'))
  const w2 = starte({ ...standard(), '/api/ask': [502, { error: 'x' }] })
  await warte()
  await w2.frage('a')
  assert.ok(w2.$$('.blase').some(b => b.textContent === 'Der Berater antwortet gerade nicht.'))
})

test('englisch, wenn die Seite es sagt', async () => {
  const w = starte(standard(), { locale: 'en-GB' })
  await warte()
  await w.frage('drill')
  assert.equal(w.fragen()[0].body.locale, 'en')
  assert.ok(w.$$('.blase').some(b => satz(b) === '2 products match "drill".'))
  assert.equal(w.$('input[type=text]').placeholder, 'What are you looking for?')
})

// ---- Gespräch: jede Eingabe ergänzt die Angaben — der Kern merkt sie sich, das Fenster zeigt sie

test('die Angaben stehen als Chips in der Blase der letzten Antwort; ein Wort lässt sich einzeln entfernen, die Chips älterer Antworten sind aus', async () => {
  const w = starte()
  await warte()
  await w.frage('Bohrhammer')
  await w.frage('leise')
  const letzteBlase = w.$$('.ergebnis').at(-1)
  const woerter = [...letzteBlase.querySelectorAll('.angaben .chip.wort')]
  assert.deepEqual(woerter.map(c => c.textContent), ['bohrhammer ×', 'leise ×'])
  assert.ok([...w.$$('.ergebnis')[0].querySelectorAll('.angaben .chip')].every(c => c.disabled))
  await w.klick(woerter.find(c => c.textContent === 'bohrhammer ×'))
  assert.deepEqual(w.fragen().at(-1).body.schritt, { art: 'weg', kind: 'word', word: 'bohrhammer' })
  assert.deepEqual([...w.$$('.ergebnis').at(-1).querySelectorAll('.angaben .chip.wort')].map(c => c.textContent), ['leise ×'])
})

test('„Neue Suche“ ist ein Schritt im Gespräch — danach fängt es von vorn an', async () => {
  const w = starte()
  await warte()
  await w.frage('Bohrhammer')
  await w.klick(w.$$('.chip.neu').at(-1))
  assert.deepEqual(w.fragen().at(-1).body.schritt, { art: 'neu' })
  assert.ok(w.$$('.blase').some(b => satz(b) === 'Neue Suche'))
  await w.frage('Schrauber')
  assert.deepEqual(w.$$('.karten').at(-1).querySelector('.angaben .chip.wort').textContent, 'schrauber ×')
})

test('was der Kern nicht fand oder anders las, steht als Hinweis in der Antwort; ist nichts übrig, lässt sich eine Angabe lockern', async () => {
  const w = starte({
    ...standard(),
    '/api/ask': body => body.q === 'auto'
      ? antwort({ words: ['zelt', 'blau'], unknown: ['auto'], relax: [{ kind: 'word', word: 'blau', label: 'blau', n: 3 }] }, { satz: 'Kein Produkt passt dazu.', hinweise: ['„auto“ steht in keinem Produkt.'] })
      : antwort({ total: 3, hits: [HIT('z1', 'Zelt')], words: ['zelt'] }, { satz: '3 Produkte passen zu „zelt“.' }),
  })
  await warte()
  await w.frage('auto')
  const sb = w.$$('.ergebnis').at(-1)
  assert.equal(sb.querySelector('.gelesen').textContent, '„auto“ steht in keinem Produkt.')
  assert.equal(satz(sb), 'Kein Produkt passt dazu.')
  const ohne = w.$$('.lockern .chip')
  // der Knopf nennt, was bleibt, nicht, was wegfällt
  assert.deepEqual(ohne.map(c => c.textContent), ['zelt (3)'])
  assert.equal(ohne[0].title, 'Angabe entfernen: blau')
  await w.klick(ohne[0])
  assert.deepEqual(w.fragen().at(-1).body.schritt, { art: 'weg', kind: 'word', word: 'blau' })
})

test('wechselt das Thema, fragt das Fenster mit dem Satz des Kerns, ob es stattdessen danach sucht — ja ist ein Schritt', async () => {
  const w = starte({
    ...standard(),
    '/api/ask': body => body.q === 'pullover'
      ? antwort({ filter: [{ attribute: 'color', op: 'eq', value: 'green', label: 'Farbe', valueLabel: 'Grün' }], words: ['hose', 'pullover'],
          relax: [{ kind: 'word', word: 'pullover', label: 'pullover', n: 23 }], instead: { words: ['pullover'], filter: [], n: 17 } },
          { satz: 'Kein Produkt passt dazu.', statt: 'Stattdessen nach „pullover“ suchen?' })
      : antwort({ total: 17, hits: [HIT('u1', 'Pullover')], words: ['pullover'] }, { satz: '17 Produkte passen zu „pullover“.', frage: 'Passt eines davon?' }),
  })
  await warte()
  await w.frage('pullover')
  assert.ok(w.$$('.statt .blase').some(b => b.textContent === 'Stattdessen nach „pullover“ suchen?'))
  // die Frage steht zuletzt, direkt über der Eingabe; was gesucht wird und das Lockern stehen in der Blase der Antwort
  const a = w.$$('.antwort').at(-1)
  assert.ok(a.lastElementChild === w.$('.statt'), 'die Frage zuletzt')
  const sb = a.querySelector('.ergebnis')
  assert.deepEqual([...sb.querySelectorAll('.angaben .chip.an')].map(c => c.textContent), ['hose ×', 'pullover ×', 'Farbe: Grün ×'])
  assert.ok(sb.querySelector('.lockern .chip'))
  assert.ok(sb.querySelector('.angaben .chip.neu'), 'ohne Treffer gibt es keinen Abschluss — „Neue Suche“ bleibt bei den Angaben')
  const ja = w.$('.statt .ja')
  assert.equal(ja.textContent, 'Ja, 17 Produkte')
  await w.klick(ja)
  assert.deepEqual(w.fragen().at(-1).body.schritt, { art: 'statt' })
  assert.ok(w.$$('.blase').some(b => satz(b) === '17 Produkte passen zu „pullover“.'))
  // die Knöpfe der älteren Antwort gelten nicht mehr
  assert.ok([...sb.querySelectorAll('button')].every(b => b.disabled))
  assert.ok([...w.$$('.ergebnis').at(-1).querySelectorAll('button')].every(b => !b.disabled))
})

test('passen Abschnitte aus den Unterlagen, stehen sie zuerst — der erste ganz, die weiteren gekürzt, je mit „Dokument öffnen“', async () => {
  const lang = 'Klemmt der Reißverschluss, reiben Sie die Zähne mit Kerzenwachs ein. '.repeat(8)
  const w = starte({
    ...standard(),
    '/api/ask': antwort({ total: 17, hits: [HIT('h1', 'Kilden Hose')], words: ['hose'],
      docs: [{ n: 1, media: 'm-1', name: 'Pflege – Hosen.pdf', page: 1, heading: 'Reparatur: Reißverschluss', text: 'Schieber mit einer Zange <b>zusammendrücken</b>.', node: { id: 'g-1', label: 'Hosen' } },
             { n: 2, media: 'm/2', name: 'Häufige Fragen – Hosen.pdf', page: 2, heading: null, text: lang, node: null }] }, { satz: '17 Produkte passen zu „hose“.' }),
  })
  await warte()
  await w.frage('reissverschluss an hose ist kaputt')
  const a = w.$$('.antwort').at(-1)
  assert.ok(a.firstElementChild.classList.contains('unterlagen'), 'die Unterlagen zuerst')
  const [x, y] = a.querySelectorAll('.auszug')
  assert.equal(x.querySelector('.titel').textContent, 'Reparatur: Reißverschluss')
  assert.equal(x.querySelector('.quelle').textContent, 'Pflege – Hosen.pdf · S. 1 · Hosen')
  assert.equal(x.querySelector('.text').textContent, 'Schieber mit einer Zange <b>zusammendrücken</b>.', 'Text, nie HTML')
  assert.ok(!x.querySelector('.text b'))
  assert.ok(!x.querySelector('.ganz'), 'der erste steht ganz da')
  assert.equal(x.querySelector('a').getAttribute('href'), 'https://advisor.test/api/doc/m-1')
  assert.equal(x.querySelector('a').getAttribute('rel'), 'noopener')
  assert.equal(y.querySelector('.titel').textContent, 'Häufige Fragen – Hosen.pdf')
  assert.ok(y.querySelector('.text').textContent.endsWith(' …'))
  assert.equal(y.querySelector('a').getAttribute('href'), 'https://advisor.test/api/doc/m%2F2')
  await w.klick(y.querySelector('.ganz'))
  assert.equal(y.querySelector('.text').textContent, lang)
  assert.ok(!y.querySelector('.ganz'))
})

test('eine Frage zum Produkt im Blick: seine Werte antworten, darunter die Unterlagen — die Sätze kommen vom Kern', async () => {
  const w = starte({ ...standard(), '/api/ask': body => String(body.q).endsWith('?')
    ? [200, { total: 0, hits: [], facets: [], about: { id: 'z1', name: 'Fjell 5 Zelt', values: [{ key: 'ws', label: 'Wassersäule Außenzelt', value: '3 000 mm' }] },
        docs: [{ n: 1, media: 'm1', name: 'Häufige Fragen – Zelte.pdf', heading: 'Wie wasserdicht muss ein Zelt sein?', text: '…' }],
        texte: { ueber: 'Zu „Fjell 5 Zelt“:', satz: null, frage: 'Alle Angaben zu diesem Produkt?', hinweise: [] } }]
    : antwort({ total: 1, hits: [HIT('z1', 'Fjell 5 Zelt')], words: ['zelt'] }, { satz: '1 Produkt passt zu „zelt“.', frage: 'Passt eines davon?' }) })
  await warte()
  await w.frage('zelt')
  await w.frage('ist das zelt wasserdicht?')
  assert.equal(w.fragen().at(-1).body.fokus, undefined, 'das Produkt im Blick kennt der Kern, das Fenster schickt es nicht')
  const a = w.$$('.antwort').at(-1)
  assert.equal(a.firstElementChild.querySelector('.leise').textContent, 'Zu „Fjell 5 Zelt“:')
  assert.deepEqual([...a.querySelectorAll('.ueber table tr')].map(tr => [...tr.children].map(c => c.textContent)), [['Wassersäule Außenzelt', '3 000 mm']])
  assert.ok(a.children[1].classList.contains('unterlagen'), 'darunter die Unterlagen')
  assert.equal(a.lastElementChild.querySelector('.frage').textContent, 'Alle Angaben zu diesem Produkt?')
  await w.klick(a.querySelector('.chip.neu'))
  assert.deepEqual(w.fragen().at(-1).body.schritt, { art: 'neu' })
})

test('einen Tippfehler liest der Kern als Produktnamen — der Hinweis steht über dem Satz', async () => {
  const w = starte({ ...standard(), '/api/ask': antwort({ total: 10, hits: [HIT('z1', 'Brenna 5 Zelt')], words: ['zelt'], corrected: [{ from: 'zeit', to: 'zelt' }] },
    { satz: '10 Produkte passen zu „zelt“.', hinweise: ['„zeit“ habe ich als „zelt“ gelesen.'] }) })
  await warte()
  await w.frage('das zeit soll leicht sein')
  const sb = w.$$('.ergebnis').at(-1)
  assert.equal(sb.querySelector('.gelesen').textContent, '„zeit“ habe ich als „zelt“ gelesen.')
  assert.equal(satz(sb), '10 Produkte passen zu „zelt“.')
})

// Oben der Satz mit der Suche, dann die ersten drei Karten, zuletzt die Frage des Beraters mit Auswahl und „weitere zeigen“ (09.10.2026)
test('nach den Karten fragt der Berater, ob eines passt oder wonach er eingrenzen soll — die Frage bleibt zuletzt', async () => {
  const fuenf = ['Brede Hose', 'Kilden Hose', 'Heia Hose', 'Selje Hose', 'Tind Hose'].map((n, i) => HIT('h' + i, n))
  const w = starte({ ...standard(), '/api/ask': antwort({ total: 17, hits: fuenf, words: ['hose'],
    facets: [{ key: 'size', label: 'Grösse', type: 'list', n: 5, values: [{ value: 'm', label: 'M', n: 3 }, { value: 'l', label: 'L', n: 2 }] }] },
    { satz: '17 Produkte passen zu „hose“.', frage: 'Passt eines davon? Oder soll ich nach Grösse eingrenzen?' }) })
  await warte()
  await w.frage('hose')
  const a = w.$$('.karten').at(-1)
  const kinder = [...a.children]
  assert.ok(kinder.indexOf(a.querySelector('.rueckfrage')) > kinder.indexOf(a.querySelector('.karte')), 'die Frage nach den Karten')
  assert.ok(a.lastElementChild === a.querySelector('.rueckfrage.abschluss'), 'die Frage zuletzt, direkt über der Eingabe')
  assert.equal(a.querySelector('.abschluss .blase .frage').textContent, 'Passt eines davon? Oder soll ich nach Grösse eingrenzen?')
  assert.ok(!a.querySelector('.abschluss .facette'), 'ein Merkmal: nur seine Werte, kein Knopf dafür')
  assert.deepEqual([...a.querySelectorAll('.abschluss .werte .chip')].map(c => c.textContent), ['M (3)', 'L (2)'])
  assert.ok(a.querySelector('.mehr').nextElementSibling === a.querySelector('.abschluss'))
  assert.ok(a.querySelector('.abschluss .blase .chip.neu'))
  assert.ok(!a.querySelector('.ergebnis .chip.neu'))
  assert.deepEqual([...a.querySelectorAll('.ergebnis .angaben .chip.wort')].map(c => c.textContent), ['hose ×'])
  assert.equal(a.querySelectorAll('.karte').length, 3)
  const mehr = a.querySelector('.mehr')
  assert.equal(mehr.textContent, '2 weitere zeigen')
  await w.klick(mehr)
  assert.deepEqual([...a.querySelectorAll('.karte .name')].map(e => e.textContent), fuenf.map(h => h.name))
  assert.ok(a.lastElementChild === a.querySelector('.abschluss'), 'die weiteren Karten kommen vor die Frage')
})

// ---- Gedächtnis (09.10.2026): „Nicht das“, angesehen, gemerkt

test('„Nicht das“ an einer Karte ist ein Schritt — der Kern zeigt das Produkt nicht mehr vorn; ein gesehenes Produkt ist gekennzeichnet', async () => {
  const w = starte()
  await warte()
  await w.frage('Bohrhammer')
  const karten = w.$$('.karte')
  assert.ok(!karten[0].querySelector('.gesehen'))
  assert.equal(karten[1].querySelector('.gesehen').textContent, 'angesehen')
  const nicht = karten[0].querySelector('.nicht')
  assert.equal(nicht.textContent, 'Nicht das')
  await w.klick(nicht)
  assert.deepEqual(w.fragen().at(-1).body.schritt, { art: 'ablehnen', id: 'p1', name: 'Bohrhammer Pro' })
  assert.ok(nicht.disabled, 'die Karte gehört jetzt zu einer älteren Antwort')
})

test('ohne Auswahl ist der Knopf zum Vergleichen nicht da — hidden gilt auch gegen die eigenen Regeln', async () => {
  const w = starte()
  await warte()
  assert.equal(w.$('.leiste').hidden, true)
  assert.match(w.$('style').textContent, /\[hidden\] \{ display: none !important; \}/)
})

// Fall aus der Bedienung (09.10.2026): an der Karte sah „Details“ anders aus als „☆ Merken“ und „Nicht das“ (die brachen um),
// „Vergleichen“ war ein blosses Kästchen mit Text — alle vier tragen jetzt dieselbe Regel
test('die Bedienelemente einer Karte sehen gleich aus und brechen nicht um', async () => {
  const w = starte()
  await warte()
  await w.frage('Bohrhammer')
  const teile = [...w.$('.karte .aktion').children]
  assert.deepEqual(teile.map(t => t.textContent), ['Details', '☆ Merken', 'Vergleichen', 'Nicht das'])
  assert.ok(teile.every(t => t.classList.contains('tat')), teile.map(t => t.className).join(' | '))
  const stil = w.$('style').textContent
  assert.match(stil, /\.tat \{[^}]*white-space: nowrap;[^}]*border: 1px solid var\(--linie\);/)
  assert.match(stil, /\.karte \.aktion \{[^}]*flex-wrap: wrap;/)
  assert.doesNotMatch(stil, /\.karte \.aktion button \{/, 'eine Regel nur für Knöpfe lässt das Kästchen aussen vor und überdeckt .an')
  const merken = teile[1]
  await w.klick(merken)
  assert.ok(merken.classList.contains('an'))
  assert.match(stil, /\.tat\.an, \.tat:has\(input:checked\) \{ background: var\(--akzent\);/)
})

// happy-dom rechnet kein Layout: geprüft wird die Regel — ohne flex: none staucht die Ansicht die Tafel, und der Rest ist nicht zu erreichen
test('eine Tafel wird in der Ansicht nicht gestaucht, die Ansicht scrollt', async () => {
  const w = starte()
  await warte()
  const stil = w.$('style').textContent
  assert.match(stil, /\.tafel \{ flex: none;/)
  assert.match(stil, /\.ansicht \{[^}]*overflow-y: auto;/)
})

// ---- Variante ganz öffnen, Merkzettel (08.10.2026) — der Merkzettel liegt nur im Arbeitsspeicher der Seite

const mitVarianten = () => ({
  ...standard(),
  '/api/product/p1': [200, { id: 'p1', name: 'Skjold Hose', images: [], values: [{ label: 'Gewicht', value: '0.40 kg' }],
    variants: [{ id: 'v1', name: 'Skjold Hose · Braun · M', values: [{ label: 'Grösse', value: 'M' }] }, { id: 'v2', name: 'Skjold Hose · Braun · L', values: [{ label: 'Grösse', value: 'L' }] }] }],
  '/api/variant/v1': [200, { id: 'v1', product: { id: 'p1', name: 'Skjold Hose' }, name: 'Skjold Hose · Braun · M', keys: { sku: 'TW-1-M' }, images: ['m1'],
    values: [{ key: 'size', label: 'Grösse', value: 'M', axis: true }, { key: 'weight', label: 'Gewicht', value: '0.40 kg', axis: false }] }],
})

test('eine Variante lässt sich aus den Details ganz öffnen: Name mit Achsen, SKU, alle Werte, Bilder', async () => {
  const w = starte(mitVarianten())
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
  await w.klick([...v.querySelectorAll('.chip')].find(c => c.textContent === 'Zum Produkt'))
  assert.equal(w.$$('.produkt').length, 1, 'die Ansicht zeigt eines — das Produkt ersetzt die Variante')
  assert.ok(!w.$('.variante'))
})

test('Produkte und Varianten kommen auf den Merkzettel; er steht im Kopf, öffnet und nimmt weg — gemerkt wird dem Dienst gemeldet', async () => {
  const w = starte(mitVarianten())
  await warte()
  assert.equal(w.$('.kopf .merk').hidden, true, 'leer: kein Merkzettel im Kopf')
  await w.frage('hose')
  const merken = w.$$('.karte .merken')[0]
  assert.equal(merken.textContent, '☆ Merken')
  await w.klick(merken)
  assert.equal(merken.textContent, '★ Gemerkt')
  assert.equal(w.$('.kopf .merk').textContent, '☆ 1')
  const ereignis = w.rufe.find(r => r.url.endsWith('/api/event'))
  assert.deepEqual({ ...ereignis.body, gespraech: 'x' }, { gespraech: 'x', art: 'gemerkt', id: 'p1', name: 'Bohrhammer Pro' })
  await w.klick(w.$$('.karte .details')[0])
  await w.klick(w.$$('.produkt tr').find(tr => tr.textContent.includes('Braun · M')).querySelector('td.aktion button'))
  await w.klick(w.$('.variante .merken'))
  assert.equal(w.$('.kopf .merk').textContent, '☆ 2')
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

test('Details öffnen in einem eigenen Fenster neben dem Gespräch, das Gespräch bleibt; × schliesst es', async () => {
  const w = starte(mitVarianten())
  await warte()
  await w.klick(w.$('.knopf'))
  await w.frage('hose')
  assert.equal(w.$('.ansicht').hidden, true)
  const vorher = w.$('.fenster').className
  await w.klick(w.$$('.karte .details')[0])
  assert.equal(w.$('.ansicht').hidden, false)
  assert.ok(w.$('.ansicht').classList.contains('daneben'), 'schwebend ein eigenes Fenster')
  assert.ok(!w.$('.fenster .ansicht'), 'nicht im Fenster des Gesprächs')
  assert.equal(w.$('.fenster').className, vorher, 'das Gespräch ändert weder Breite noch Lage')
  assert.ok(w.$('.ansicht .produkt'), 'das Produkt steht in der Ansicht, nicht im Gespräch')
  assert.ok(!w.$('.verlauf .produkt'))
  assert.equal(w.$('.ansicht .tafelkopf .art').textContent, 'Produkt')
  await w.klick(w.$('.ansicht .tafelkopf .zu'))
  assert.equal(w.$('.ansicht').hidden, true)
  assert.equal(w.$('.fenster').hidden, false, 'das Gespräch bleibt offen')
  await w.klick(w.$$('.karte .merken')[0])
  await w.klick(w.$('.kopf .merk'))
  assert.ok(w.$('.ansicht .merkzettel'))
  await w.klick(w.$('.kopf .zu'))
  assert.equal(w.$('.ansicht').hidden, true)
})

// Vergrössern (09.10.2026): schwebend stellt ⤢ das Fenster auf fast die ganze Höhe und eine grössere Breite, ⤡ zurück — die Ansicht daneben rückt mit
test('das schwebende Fenster lässt sich vergrössern und wieder verkleinern; eingebettet gibt es den Knopf nicht', async () => {
  const w = starte()
  await warte()
  await w.klick(w.$('.knopf'))
  const k = w.$('.kopf .groesse')
  assert.equal(k.textContent, '⤢')
  assert.equal(k.title, 'Fenster vergrössern')
  await w.klick(k)
  assert.ok(w.b.wirt.classList.contains('gross'))
  assert.equal(k.textContent, '⤡')
  assert.equal(k.getAttribute('aria-label'), 'Fenster verkleinern')
  await w.klick(k)
  assert.ok(!w.b.wirt.classList.contains('gross'))
  const stil = w.$('style').textContent
  assert.match(stil, /:host\(\.gross\) \{ --breite: min\(720px, calc\(100vw - 32px\)\); --hoehe: calc\(100vh - 32px\); \}/)
  assert.match(stil, /\.schwebend \{[^}]*width: var\(--breite\); height: var\(--hoehe\);/)
  assert.match(stil, /\.ansicht\.daneben \{[^}]*right: calc\(16px \+ var\(--breite\) \+ 12px\);/, 'die Ansicht rückt mit')
  // eingebettet bestimmt die Seite die Grösse
  win.document.body.innerHTML = ''
  const d = dienst(standard()); laden()
  const ziel = win.document.createElement('div'); ziel.id = 'advisor'; win.document.body.append(ziel)
  const e = win.journaliAdvisor.start({ base: 'https://advisor.test', fetch: d.fetch, locale: 'de', target: '#advisor' })
  await warte()
  assert.ok(!e.schatten.querySelector('.kopf .groesse'))
})
