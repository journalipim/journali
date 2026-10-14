// Der Kern des Produktberaters (plugins/advisor/kern/, pflegestruktur 44): der Berater versteht, journali wählt aus. Geprüft werden die Bausteine
// (Wörter, Tippfehler, Angaben im Text) und das Gespräch gegen ein vorgetäuschtes journali, das wie /api/advisor/{key}/select auswählt —
// Gedächtnis, Vorlieben über einen Themenwechsel, abgelehnte Produkte, Angaben der KI. Wie Kern und journali zusammen antworten, prüfen die
// C#-Tests über die Vorschau (AdvisorTests, der Kern als Kindprozess).
import test from 'node:test'
import assert from 'node:assert/strict'
import { woerter, formen, korrektur, abstand } from '../../plugins/advisor/kern/woerter.mjs'
import { erkenne, fragt, istArt, namenWoerter, istProblem } from '../../plugins/advisor/kern/verstehen.mjs'
import { erstelleKern } from '../../plugins/advisor/kern/gespraech.mjs'
import { stellen, trifft, treffer, saetze } from '../../plugins/advisor/kern/stellen.mjs'
import { erstelleAssoziationen } from '../../plugins/advisor/kern/assoziationen.mjs'
import { erstelleLernen, vorschlaege } from '../../plugins/advisor/kern/lernen.mjs'
import { alsText } from '../../plugins/advisor/vorschlaege.mjs'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// ---- ein kleiner Katalog und eine Auswahl wie in journali

const LISTE = (key, label, werte) => ({ key, label, labels: { de: label, en: label }, type: 'enum', facet: true, values: werte.map(([value, de, en]) => ({ value, label: de, labels: { de, en } })) })
const VOK = {
  locale: 'de', locales: ['de', 'en'], etag: '"1"', ki: false, products: 5,
  attributes: [
    LISTE('color', 'Farbe', [['red', 'Rot', 'Red'], ['blue', 'Blau', 'Blue']]),
    LISTE('groesse', 'Grösse', [['s', 'S', 'S'], ['m', 'M', 'M']]),
    { key: 'gewicht', label: 'Gewicht', labels: { de: 'Gewicht', en: 'Weight' }, type: 'decimal', unit: 'kg', unitLabels: ['Kilogramm', 'kilogram'], quantity: 'mass', facet: true },
    { key: 'leistung', label: 'Leistung', labels: { de: 'Leistung', en: 'Power' }, type: 'decimal', unit: 'W', unitLabels: [], quantity: null, facet: true },
    { key: 'wasserdicht', label: 'Wasserdicht', labels: { de: 'Wasserdicht', en: 'Waterproof' }, type: 'boolean', facet: true },
  ],
  groups: [{ key: 'k-schlafen', label: 'Schlafen', n: 3 }, { key: 'k-kleidung', label: 'Kleidung', n: 2 }],
  words: [{ word: 'zelt', n: 2 }, { word: 'schlafsack', n: 1 }, { word: 'hose', n: 2 }, { word: 'odda', n: 1 }, { word: 'ravik', n: 1 }, { word: 'kilden', n: 1 }, { word: 'brede', n: 1 }, { word: 'varm', n: 1 }],
}
const KATALOG = [
  { id: 'z1', name: 'Odda Zelt', text: 'wasserdicht kuppel', werte: { color: 'red', gewicht: '2.4' }, gruppe: 'k-schlafen' },
  { id: 'z2', name: 'Ravik Zelt', text: 'leicht luftig', werte: { color: 'blue', gewicht: '1.4' }, gruppe: 'k-schlafen' },
  { id: 's1', name: 'Varm Schlafsack', text: 'warm winter', werte: { color: 'red', groesse: 'm' }, gruppe: 'k-schlafen' },
  { id: 'h1', name: 'Kilden Hose', text: 'wandern', werte: { color: 'blue', groesse: 'm' }, gruppe: 'k-kleidung' },
  { id: 'h2', name: 'Brede Hose', text: 'wandern regen', werte: { color: 'red', groesse: 's' }, gruppe: 'k-kleidung' },
]
// was GET product/{id} liefert: alle Werte und Texte — die Antwort steht oft im Wert oder in der Beschreibung, nicht in einer Bezeichnung
const PRODUKTE = {
  z1: { values: [{ key: 'color', label: 'Farbe', value: 'Rot' }, { key: 'gewicht', label: 'Gewicht', value: '2.4 kg' }, { key: 'material', label: 'Material', value: 'Polyester, 3000 mm Wassersäule' }],
    texts: [{ key: 'description', label: 'Beschreibung', value: 'Kuppelzelt für zwei.\n\nAußenzelt mit 3 000 mm Wassersäule, Boden mit 5 000 mm. Lüftungen mindern Kondenswasser.' }] },
  z2: { values: [{ key: 'color', label: 'Farbe', value: 'Blau' }, { key: 'gewicht', label: 'Gewicht', value: '1.4 kg' }],
    texts: [{ key: 'description', label: 'Beschreibung', value: 'Leichtes Tunnelzelt für den Sommer. Der Boden ist aus Nylon.' }] },
}
const imNamen = (p, w) => p.name.toLowerCase().split(/\s+/).some(t => formen(w).some(f => t.startsWith(f)))
const imText = (p, w) => imNamen(p, w) || (p.name + ' ' + p.text).toLowerCase().split(/\s+/).some(t => formen(w).some(f => t.startsWith(f)))
const passt = (p, a) => a.op === 'le' ? Number(p.werte[a.attribute]) <= Number(a.value) : a.op === 'ge' ? Number(p.werte[a.attribute]) >= Number(a.value)
  : a.op === 'low' || a.op === 'high' ? p.werte[a.attribute] !== undefined : p.werte[a.attribute] === a.value
const label = a => {
  const def = VOK.attributes.find(x => x.key === a.attribute)
  return { ...a, label: def?.label ?? a.attribute, valueLabel: def?.values?.find(v => v.value === a.value)?.label ?? a.value }
}

function journali({ ki = null, docs = [] } = {}) {
  const rufe = []
  const waehle = b => {
    let r = KATALOG.filter(p => (!b.gruppe || p.gruppe === b.gruppe) && (b.angaben ?? []).every(a => passt(p, a)))
    if (b.art?.length) r = r.filter(p => b.art.every(w => imNamen(p, w)))
    else if (b.ordnen?.length) r = r.filter(p => b.ordnen.some(w => imText(p, w)))
    return r
  }
  const fn = async (pfad, body) => {
    rufe.push({ pfad, body })
    if (pfad.startsWith('vocabulary')) return { status: 200, json: { ...VOK, ki: !!ki } }
    if (pfad === 'docs') return { status: 200, json: { docs, warning: null } }
    if (pfad === 'ki') return { status: 200, json: ki(body) }
    if (pfad.startsWith('product/')) {
      const pid = decodeURIComponent(pfad.slice(8).split('?')[0]), p = KATALOG.find(x => x.id === pid)
      return p ? { status: 200, json: { id: p.id, name: p.name, values: [{ key: 'name', label: 'Name', value: p.name }, ...(PRODUKTE[p.id]?.values ?? [])], texts: PRODUKTE[p.id]?.texts ?? [] } } : { status: 404, json: { error: 'x' } }
    }
    if (pfad !== 'select') return { status: 404, json: { error: 'x' } }
    let r = waehle(body)
    const hinten = new Set(body.hinten ?? [])
    r = [...r.filter(p => !hinten.has(p.id)), ...r.filter(p => hinten.has(p.id))]
    const angaben = (body.angaben ?? []).filter(a => VOK.attributes.some(x => x.key === a.attribute))
    const relax = !body.lockern || r.length ? [] : [
      ...angaben.map(a => ({ kind: 'filter', ...label(a), n: waehle({ ...body, angaben: angaben.filter(x => x !== a) }).length })),
      ...(body.art ?? []).map(w => ({ kind: 'word', word: w, label: w, n: waehle({ ...body, art: body.art.filter(x => x !== w) }).length })),
    ].filter(x => x.n > 0)
    const fokus = KATALOG.find(p => p.id === body.fokus)
    return {
      status: 200, json: {
        locale: 'de', total: r.length, hits: r.slice(0, body.take ?? 6).map(p => ({ id: p.id, name: p.name, values: [] })), facets: [], similar: false, relax,
        present: [...new Set(r.flatMap(p => Object.keys(p.werte)))], filter: angaben.map(label),
        words: [...(body.art ?? []), ...(body.ordnen ?? [])].map(w => ({ word: w, n: KATALOG.filter(p => imText(p, w)).length, name: KATALOG.filter(p => imNamen(p, w)).length })),
        group: VOK.groups.find(g => g.key === body.gruppe) ? { key: body.gruppe, label: VOK.groups.find(g => g.key === body.gruppe).label } : null,
        focus: fokus ? { id: fokus.id, name: fokus.name, values: /wasserdicht/.test(body.satz) ? [{ key: 'wasserdicht', label: 'Wasserdicht', value: fokus.text.includes('wasserdicht') ? 'ja' : 'nein' }] : [] } : null,
        warning: null,
      },
    }
  }
  return { fn, rufe, auswahlen: () => rufe.filter(r => r.pfad === 'select') }
}

const G = 'gespraech-0001'

// ---- die Bausteine (vorher im Server: AdvisorApi.Erkenne, Korrektur, Fragt)

test('Suchwörter: klein, ohne Füllwörter, Zahlen bleiben; gebeugte Formen', () => {
  assert.deepEqual(woerter('Ich suche einen Bohrhammer mit 800 W'), ['bohrhammer', '800'])
  assert.deepEqual(woerter('Mein Zelt ist nicht mehr wasserdicht'), ['zelt', 'wasserdicht'])
  assert.deepEqual(woerter('my tent is not waterproof anymore'), ['tent', 'waterproof'])
  assert.deepEqual(formen('zelte'), ['zelte', 'zelt'])
  assert.deepEqual(formen('akku'), ['akku'])
})

test('ein Tippfehler wird zum nächsten Wort eines Produktnamens', () => {
  const namen = new Set(['zelt', 'hose', 'isomatte', 'bohrhammer'])
  assert.equal(korrektur('zeit', namen), 'zelt')
  assert.equal(korrektur('bohrhamer', namen), 'bohrhammer')
  assert.equal(korrektur('isomtate', namen), 'isomatte')   // zwei Nachbarn vertauscht
  assert.equal(korrektur('zelte', namen), null)            // gebeugt steht es im Namen
  assert.equal(korrektur('hut', namen), null)              // zu kurz
  assert.equal(korrektur('hoxe', new Set(['hose', 'hole'])), null)   // zwei gleich nah
  assert.equal(abstand('abc', 'abd', 1), 1)
})

test('Angaben im Text werden Filter, der Rest bleibt Suchwort', () => {
  const v = { attributes: [
    { key: 'leistung', label: 'Leistung', labels: { de: 'Leistung', en: 'Power' }, type: 'decimal', unit: 'W', unitLabels: [], facet: true },
    { key: 'wasserdicht', label: 'Wasserdicht', labels: { de: 'Wasserdicht', en: 'Waterproof' }, type: 'boolean', facet: true },
    LISTE('color', 'Farbe', [['red', 'Rot', 'Red'], ['blue', 'Blau', 'Blue']]),
  ] }
  const { angaben, rest } = erkenne(v, 'Bohrhammer unter 900 W, wasserdicht und rot')
  assert.deepEqual(angaben, [{ attribute: 'leistung', op: 'le', value: '900' }, { attribute: 'color', op: 'eq', value: 'red' }, { attribute: 'wasserdicht', op: 'eq', value: 'true' }])
  assert.deepEqual(woerter(rest), ['bohrhammer'])
  assert.deepEqual(erkenne(v, 'nicht wasserdicht').angaben, [{ attribute: 'wasserdicht', op: 'eq', value: 'false' }])
  assert.deepEqual(erkenne(v, 'ab 1,5 W').angaben, [{ attribute: 'leistung', op: 'ge', value: '1.5' }])
  // Fall aus der Bedienung (09.10.2026): „leichter als 1.8 kg“ wurde ein Suchwort
  const kg = { attributes: [{ key: 'gewicht', label: 'Gewicht', labels: { de: 'Gewicht' }, type: 'decimal', unit: 'kg', quantity: 'mass', facet: true }] }
  assert.deepEqual(erkenne(kg, 'leichter als 1.8 kg'), { angaben: [{ attribute: 'gewicht', op: 'le', value: '1.8' }], rest: '', offen: [] })
  assert.deepEqual(erkenne(kg, 'schwerer als 2 kg').angaben, [{ attribute: 'gewicht', op: 'ge', value: '2' }])
  assert.deepEqual(erkenne(v, '900 W').angaben, [], 'ohne „unter“ oder „ab“ ist eine Zahl kein Filter')
  // zwei Zahlenattribute mit derselben Einheit: nur mit Bezeichnung im Text
  const zwei = { attributes: [
    { key: 'laenge', label: 'Länge', labels: { de: 'Länge', en: 'Length' }, type: 'decimal', unit: 'cm', facet: true },
    { key: 'breite', label: 'Breite', labels: { de: 'Breite', en: 'Width' }, type: 'decimal', unit: 'cm', facet: true },
  ] }
  assert.deepEqual(erkenne(zwei, 'bis 50 cm').angaben, [])
  assert.deepEqual(erkenne(zwei, 'bis 50 cm').offen, [{ op: 'le', value: '50', attribute: ['laenge', 'breite'] }], 'offen: der Berater fragt, welches gemeint ist')
  assert.deepEqual(erkenne(zwei, 'Breite bis 50 cm').angaben, [{ attribute: 'breite', op: 'le', value: '50' }])
  assert.deepEqual(erkenne(zwei, 'bis 50 cm', { vorhanden: ['breite'] }).angaben, [{ attribute: 'breite', op: 'le', value: '50' }], 'nur eines bei den gezeigten Produkten')
  assert.deepEqual(erkenne(zwei, 'bis 60 cm', { gesetzt: ['laenge'] }).angaben, [{ attribute: 'laenge', op: 'le', value: '60' }], 'eines gilt schon: die neue Zahl ersetzt es')
})

// Fälle aus dem Prüfstand (14.10.2026, tools/berater-dialoge): Zahlwörter, Zahl vor der Bezeichnung, Geld, Zahl mit Einheit ohne Vergleich,
// Minus und Grad, Frost, Zeit über die Bezeichnung, Ja/Nein gebeugt, als Wortanfang und zusammengesetzt, die Zahl in einem Listenwert
test('Angaben aus Kundensätzen: Zahlwörter, Geld, Einheiten, Zeit, Ja/Nein mit mehreren Wörtern', () => {
  const Z = (key, de, en, type, unit, unitLabels = [], quantity = null) => ({ key, label: de, labels: { de, en }, type, unit, unitLabels, quantity, facet: true })
  const B = (key, de, en) => ({ key, label: de, labels: { de, en }, type: 'boolean', facet: true })
  const v = { attributes: [
    Z('price', 'Preis (EUR)', 'Price (EUR)', 'decimal'),
    Z('weight', 'Gewicht', 'Weight', 'decimal', 'kg', ['Kilogramm'], 'mass'),
    Z('persons', 'Personen', 'Persons', 'integer'),
    Z('volume_l', 'Volumen', 'Volume', 'integer', 'l', ['Liter', 'litre'], 'volume'),
    Z('pitch_min', 'Aufbauzeit', 'Pitching time', 'integer', 'min', ['Minute'], 'time'),
    Z('keeps_hot_h', 'Hält warm', 'Keeps hot', 'integer', 'h', ['Stunde'], 'time'),
    Z('keeps_cold_h', 'Hält kalt', 'Keeps cold', 'integer', 'h', ['Stunde'], 'time'),
    Z('comfort_c', 'Komforttemperatur', 'Comfort temperature', 'integer', '°C', ['Grad Celsius'], 'temperature'),
    Z('limit_c', 'Grenztemperatur', 'Limit temperature', 'integer', '°C', ['Grad Celsius'], 'temperature'),
    Z('lumen', 'Lichtstrom', 'Luminous flux', 'integer', 'lm', ['Lumen'], 'luminous flux'),
    { key: 'shoe_size', label: 'Schuhgrösse', labels: { de: 'Schuhgrösse' }, type: 'enum', facet: true, values: [42, 43].map(n => ({ value: 'eu' + n, label: 'EU ' + n, labels: { de: 'EU ' + n } })) },
    B('membrane', 'Wasserdichte Membran', 'Waterproof membrane'),
    B('helmet_hood', 'Helmtaugliche Kapuze', 'Helmet-compatible hood'),
    B('hydration', 'Trinksystemvorbereitet', 'Hydration compatible'),
  ] }
  const a = q => erkenne(v, q).angaben
  assert.deepEqual(a('Zelt für zwei Personen'), [{ attribute: 'persons', op: 'eq', value: '2' }])
  assert.deepEqual(a('tent for two people'), [{ attribute: 'persons', op: 'eq', value: '2' }])
  assert.deepEqual(a('Regenjacke unter 200 Euro'), [{ attribute: 'price', op: 'le', value: '200' }])
  assert.deepEqual(a('Jacke für 150 €'), [{ attribute: 'price', op: 'le', value: '150' }], 'ein Betrag ohne Vergleich ist eine Obergrenze')
  assert.deepEqual(a('ab 100 Euro'), [{ attribute: 'price', op: 'ge', value: '100' }])
  assert.deepEqual(a('Tagesrucksack mit 30 Litern'), [{ attribute: 'volume_l', op: 'eq', value: '30' }])
  assert.deepEqual(a('mit mindestens 400 Lumen'), [{ attribute: 'lumen', op: 'ge', value: '400' }])
  assert.deepEqual(a('in 43'), [{ attribute: 'shoe_size', op: 'eq', value: 'eu43' }])
  assert.deepEqual(a('wasserdicht mit Membran'), [{ attribute: 'membrane', op: 'eq', value: 'true' }])
  assert.deepEqual(a('mit wasserdichter Membran'), [{ attribute: 'membrane', op: 'eq', value: 'true' }])
  assert.deepEqual(a('mit Membran'), [], 'ein Teil der Bezeichnung genügt nicht')
  assert.deepEqual(a('mit helmkapuze'), [{ attribute: 'helmet_hood', op: 'eq', value: 'true' }])
  assert.deepEqual(a('mit Kapuze'), [], 'eine Kapuze ist nicht helmtauglich')
  assert.deepEqual(a('mit trinksystem'), [{ attribute: 'hydration', op: 'eq', value: 'true' }])
  // Zeit: welches Attribut, sagt seine Bezeichnung — und sie ist danach kein Suchwort
  assert.deepEqual(erkenne(v, 'eins, das schnell aufgebaut ist').angaben, [{ attribute: 'pitch_min', op: 'low', value: 'schnell' }])
  assert.deepEqual(woerter(erkenne(v, 'eins, das schnell aufgebaut ist').rest), [], '„eins“ antwortet auf die Rückfrage, es sucht nichts')
  assert.deepEqual(erkenne(v, 'Flasche, die Tee lange warm hält'), { angaben: [{ attribute: 'keeps_hot_h', op: 'high', value: 'lange' }], rest: 'Flasche, die Tee', offen: [] })
  assert.deepEqual(a('schnell'), [], 'ohne Bezeichnung keines von drei Zeitattributen')
  assert.deepEqual(erkenne(v, 'schnell', { vorhanden: ['pitch_min'] }).angaben, [{ attribute: 'pitch_min', op: 'low', value: 'schnell' }])
  // Grad und Frost: zwei Temperaturen — der Berater fragt; eine genannte gilt
  assert.deepEqual(erkenne(v, 'Schlafsack für Minusgrade').offen, [{ op: 'le', value: '0', attribute: ['comfort_c', 'limit_c'] }])
  assert.deepEqual(woerter(erkenne(v, 'Schlafsack für Minusgrade').rest), ['schlafsack'])
  assert.deepEqual(a('Komforttemperatur bis minus 10 grad'), [{ attribute: 'comfort_c', op: 'le', value: '-10' }])
  assert.deepEqual(erkenne(v, 'bis -5 °C', { gesetzt: ['comfort_c'] }).angaben, [{ attribute: 'comfort_c', op: 'le', value: '-5' }])
  // ein Preis aus einem Import heisst „price“, ohne Währung — er gilt trotzdem für Geld
  const importiert = { attributes: [{ key: 'price', label: 'price', labels: { de: 'price' }, type: 'decimal', facet: true }] }
  assert.deepEqual(erkenne(importiert, 'unter 200 Euro').angaben, [{ attribute: 'price', op: 'le', value: '200' }])
  // „leicht“: zwei Attribute messen Masse — es gilt das, das die Produkte der genannten Art haben
  const masse = { attributes: [Z('max_load_kg', 'Empfohlene Zuladung', 'Recommended load', 'integer', 'kg', ['Kilogramm'], 'mass'), Z('weight', 'Gewicht', 'Weight', 'decimal', 'kg', ['Kilogramm'], 'mass')] }
  assert.deepEqual(erkenne(masse, 'leichtes Zelt').angaben, [{ attribute: 'max_load_kg', op: 'low', value: 'leichtes' }], 'ohne Wissen über die Art: das erste')
  assert.deepEqual(erkenne(masse, 'leichtes Zelt', { vorhanden: ['weight', 'persons'] }).angaben, [{ attribute: 'weight', op: 'low', value: 'leichtes' }])
})

test('ein Tippfehler, der nur über den Wortanfang trifft, wird als gelesen gemeldet; die Art einer neuen Eingabe bestimmt die Attribute', async () => {
  const j = journali()
  const kern = erstelleKern({ journali: j.fn })
  const r = await kern.antworte({ gespraech: G, q: 'schlafsac' })   // „schlafsac“ beginnt „schlafsack“
  assert.deepEqual(r.corrected, [{ from: 'schlafsac', to: 'schlafsack' }])
  assert.deepEqual(r.words, ['schlafsack'])
  assert.ok(r.texte.hinweise.some(h => h.includes('gelesen')))
  // vor dem Erkennen fragt der Kern, welche Attribute die Produkte der genannten Art haben
  assert.ok(j.auswahlen().some(a => a.body.probe && a.body.art?.join() === 'schlafsac'))
})

test('„leicht“ ist wenig Masse am Zahlenattribut, dessen Einheit Masse misst; ein Wert aus einem Zeichen nur mit Bezeichnung', () => {
  const v = { attributes: [
    { key: 'gewicht', label: 'Gewicht', labels: { de: 'Gewicht' }, type: 'decimal', unit: 'kg', quantity: 'mass', facet: true },
    { key: 'volumen', label: 'Volumen', labels: { de: 'Volumen' }, type: 'integer', unit: 'l', quantity: 'volume', facet: true },
    LISTE('groesse', 'Grösse', [['m', 'M', 'M']]),
  ] }
  const { angaben, rest } = erkenne(v, 'ein leichtes Zelt, eher gross')
  assert.deepEqual(angaben, [{ attribute: 'gewicht', op: 'low', value: 'leichtes' }, { attribute: 'volumen', op: 'high', value: 'gross' }])
  assert.deepEqual(woerter(rest), ['zelt', 'eher'])
  assert.deepEqual(erkenne({ attributes: [v.attributes[1]] }, 'leicht').angaben, [], 'ohne Attribut für Masse kein Filter')
  assert.deepEqual(erkenne(v, 'Jacke M').angaben, [], 'ein „M“ allein ist kein Filter')
  assert.deepEqual(erkenne(v, 'Jacke Grösse M').angaben, [{ attribute: 'groesse', op: 'eq', value: 'm' }])
  assert.deepEqual(woerter(erkenne(v, 'Jacke Grösse M').rest), ['jacke'], '„Grösse“ ist kein Suchwort')
})

test('Fragen und Arten', () => {
  assert.ok(fragt('ist das zelt wasserdicht')); assert.ok(fragt('Zelt wasserdicht?')); assert.ok(!fragt('zelt wasserdicht'))
  const namen = namenWoerter({ words: [{ word: 'akkuschrauber' }, { word: 'multi-tool' }] })
  assert.ok(istArt('akku', namen), '„akku“ steht am Anfang von Akkuschrauber')
  assert.ok(istArt('tool', namen), 'ein Teil eines zusammengesetzten Namens')
  assert.ok(!istArt('wasserdicht', namen))
})

// ---- das Gespräch

test('ein Gespräch sammelt die Angaben: die Art grenzt ein, eine Angabe filtert, ein Klick nimmt weg — gemerkt an der Kennung', async () => {
  const j = journali()
  const kern = erstelleKern({ journali: j.fn })
  const eins = await kern.antworte({ gespraech: G, q: 'Zelt' })
  assert.equal(eins.total, 2)
  assert.deepEqual(j.auswahlen().at(-1).body.art, ['zelt'])
  assert.equal(eins.texte.satz, '2 Produkte passen zu „zelt“.')
  const zwei = await kern.antworte({ gespraech: G, q: 'in Rot' })
  assert.deepEqual(zwei.hits.map(h => h.name), ['Odda Zelt'])
  assert.deepEqual(zwei.filter.map(f => [f.attribute, f.value, f.quelle]), [['color', 'red', 'gesagt']])
  assert.equal(zwei.texte.frage, 'Passt eines davon?')
  const drei = await kern.antworte({ gespraech: G, schritt: { art: 'weg', kind: 'filter', attribute: 'color', op: 'eq', value: 'red' } })
  assert.equal(drei.total, 2)
  // ein anderes Gespräch weiss davon nichts, ohne Kennung auch nicht
  assert.equal((await kern.antworte({ gespraech: 'anderes-0001', q: 'rot' })).filter[0].value, 'red')
  assert.deepEqual(j.auswahlen().at(-1).body.art, [])
  const neu = await kern.antworte({ gespraech: G, schritt: { art: 'neu' } })
  assert.ok(neu.reset)
  assert.equal(neu.texte.satz, 'Neue Suche')
})

test('mit Treffern keine Datenblätter einzelner Produkte als Unterlagen — die Beschreibung steht auf der Karte; Unterlagen von Gruppen bleiben', async () => {
  const docs = [
    { n: 1, media: 'm1', name: 'Datenblatt Rime Zelt.pdf', heading: 'Beschreibung', text: 'Das Rime Zelt …', node: { id: 'p-rime', label: 'Rime Zelt' } },
    { n: 2, media: 'm2', name: 'Datenblatt Rime Zelt.pdf', heading: 'Ausführungen', text: '…', node: { id: 'v-rime-1', label: 'Rime Zelt rot' } },
    { n: 3, media: 'm3', name: 'Häufige Fragen – Zelte.pdf', heading: 'Wie wasserdicht muss ein Zelt sein?', text: '…', node: { id: 'g-zelte', label: 'Zelte' } },
  ]
  const kern = erstelleKern({ journali: journali({ docs }).fn })
  const r = await kern.antworte({ gespraech: 'karten-0001', q: 'zelt für den winter' })
  assert.ok(r.total > 0)
  assert.deepEqual(r.docs.map(d => [d.n, d.name]), [[1, 'Häufige Fragen – Zelte.pdf']])
  // ohne Treffer zählen auch die Datenblätter
  const k2 = erstelleKern({ journali: journali({ docs }).fn })
  const leer = await k2.antworte({ gespraech: 'karten-0002', q: 'reissverschluss kaputt' })
  if (!leer.total) assert.equal(leer.docs.length, 3)
})

test('eine Frage nach einem Problem ist keine Produktsuche: die Unterlagen der Art antworten, die Angaben bleiben', async () => {
  for (const q of ['meine hose hat ein loch', 'der reißverschluss klemmt', 'zelt wird innen nass', 'wie wasche ich die jacke', 'mein zelt ist nicht mehr wasserdicht', 'sohle löst sich'])
    assert.ok(istProblem(q), q)
  for (const q of ['jacke für nasses wetter', 'leichte hose', 'zelt für 2 personen', 'wasserdichte jacke'])
    assert.ok(!istProblem(q), q)
  const docs = [{ n: 1, media: 'm1', seq: 4, name: 'Pflege – Zelte.pdf', heading: 'Reparatur: Riss oder Loch', text: 'Reparaturband …', node: { id: 'g-zelte', label: 'Zelte' } }]
  const j = journali({ docs })
  const kern = erstelleKern({ journali: j.fn })
  await kern.antworte({ gespraech: 'problem-0001', q: 'zelt' })
  const vorher = j.auswahlen().length
  const r = await kern.antworte({ gespraech: 'problem-0001', q: 'mein zelt hat ein loch' })
  assert.ok(r.problem)
  assert.equal(j.auswahlen().length, vorher, 'keine Auswahl — keine Produktsuche')
  const anfrage = j.rufe.filter(x => x.pfad === 'docs').at(-1).body
  assert.deepEqual([anfrage.art, anfrage.problem], [['zelt'], true])
  assert.equal(r.docs[0].heading, 'Reparatur: Riss oder Loch')
  assert.deepEqual([r.texte.satz, r.texte.frage], [null, 'Hilft Ihnen das weiter?'])
  // die gesammelten Angaben bleiben: „loch“ ist kein Suchwort geworden
  const weiter = await kern.antworte({ gespraech: 'problem-0001', q: 'rot' })
  assert.deepEqual(weiter.words, ['zelt'])
  // „wie wasche ich die zelte“: „die“ vor einer Art ist ein Artikel — eine Pflegefrage
  assert.ok((await kern.antworte({ gespraech: 'problem-0001', q: 'wie wasche ich die zelte' })).problem)
  // ohne Unterlagen sagt der Berater es
  const k2 = erstelleKern({ journali: journali().fn })
  assert.equal((await k2.antworte({ gespraech: 'problem-0002', q: 'zelt hat ein loch' })).texte.satz, 'Dazu habe ich keine Anleitung in den Unterlagen.')
})

test('nach 30 Minuten ohne Eingabe ist ein Gespräch vergessen', async () => {
  let t = 0
  const j = journali()
  const kern = erstelleKern({ journali: j.fn, jetzt: () => t })
  await kern.antworte({ gespraech: G, q: 'Zelt' })
  t += 29 * 60_000
  assert.deepEqual((await kern.antworte({ gespraech: G, q: '' })).words, ['zelt'])
  t += 31 * 60_000
  assert.deepEqual((await kern.antworte({ gespraech: G, q: '' })).words, [])
})

test('ein Wort in keinem Produkt wird genannt und nicht gesammelt; ein Tippfehler wird gelesen und gesagt', async () => {
  const kern = erstelleKern({ journali: journali().fn })
  const a = await kern.antworte({ gespraech: G, q: 'auto' })
  assert.deepEqual([a.unknown, a.words, a.total], [['auto'], [], 0])
  assert.deepEqual(a.texte.hinweise, ['„auto“ steht in keinem Produkt.'])
  // nichts erkannt (09.10.2026): der Berater nennt, wobei er hilft — die Gruppen des Sortiments
  assert.deepEqual([a.texte.satz, a.sortiment.map(g => g.label), a.texte.nachsatz],
    ['Ich kann Ihnen mit den Produkten weiterhelfen, die wir im Angebot haben:', ['Schlafen', 'Kleidung'], 'Zu anderen Fragen kann ich leider keine Auskunft geben.'])
  const b = await kern.antworte({ gespraech: 'tipp-00000001', q: 'zeit' })
  assert.deepEqual(b.corrected, [{ from: 'zeit', to: 'zelt' }])
  assert.equal(b.total, 2)
  assert.equal(b.texte.hinweise[0], '„zeit“ habe ich als „zelt“ gelesen.')
})

test('wechselt das Thema, fragt der Kern; ja übernimmt die Vorlieben, deren Attribut es bei der neuen Art gibt, und sagt es', async () => {
  const j = journali()
  const kern = erstelleKern({ journali: j.fn })
  await kern.antworte({ gespraech: G, q: 'Hose' })
  const m = await kern.antworte({ gespraech: G, q: 'Grösse M' })
  assert.deepEqual(m.hits.map(h => h.name), ['Kilden Hose'])
  const s = await kern.antworte({ gespraech: G, q: 'Schlafsack' })   // Hose und Schlafsack zusammen: nichts
  assert.equal(s.total, 0)
  assert.deepEqual(s.instead, { words: ['schlafsack'], filter: [], n: 1 })
  assert.equal(s.texte.statt, 'Stattdessen nach „schlafsack“ suchen?')
  // „ohne hose“ lässt „schlafsack + Grösse M“ übrig — das ist nicht der Wechsel (nur „schlafsack“) und bleibt darum beim Lockern
  assert.ok(s.relax.some(l => l.kind === 'word' && l.word === 'hose'))
  const ja = await kern.antworte({ gespraech: G, schritt: { art: 'statt' } })
  assert.deepEqual(ja.words, ['schlafsack'])
  assert.deepEqual(ja.filter.map(f => [f.attribute, f.value, f.quelle]), [['groesse', 'm', 'vorliebe']], 'die Grösse gilt weiter')
  assert.deepEqual(ja.texte.hinweise, ['Grösse: M habe ich übernommen.'])
  assert.deepEqual(ja.hits.map(h => h.name), ['Varm Schlafsack'])
})

test('eine Vorliebe ruht, wo es ihr Attribut nicht gibt; wer sie wegnimmt, nimmt sie ganz weg', async () => {
  const j = journali()
  const kern = erstelleKern({ journali: j.fn })
  await kern.antworte({ gespraech: G, q: 'Hose Grösse M' })
  await kern.antworte({ gespraech: G, schritt: { art: 'neu' } })
  const zelt = await kern.antworte({ gespraech: G, q: 'Zelt' })
  assert.deepEqual(zelt.filter, [], 'Zelte haben keine Grösse — nichts übernommen')
  await kern.antworte({ gespraech: G, q: 'Schlafsack' })
  const sack = await kern.antworte({ gespraech: G, schritt: { art: 'statt' } })
  assert.deepEqual(sack.filter.map(f => f.value), ['m'], 'beim Schlafsack gilt sie wieder')
  await kern.antworte({ gespraech: G, schritt: { art: 'weg', kind: 'filter', attribute: 'groesse', op: 'eq', value: 'm' } })
  await kern.antworte({ gespraech: G, q: 'Hose' })
  const hose = await kern.antworte({ gespraech: G, schritt: { art: 'statt' } })
  assert.deepEqual(hose.filter, [], 'weggenommen ist keine Vorliebe mehr')
})

test('ein abgelehntes Produkt kommt nicht wieder nach vorn — es geht als hinten mit jeder Auswahl', async () => {
  const j = journali()
  const kern = erstelleKern({ journali: j.fn })
  const vorher = await kern.antworte({ gespraech: G, q: 'Zelt' })
  assert.equal(vorher.hits[0].id, 'z1')
  const nachher = await kern.antworte({ gespraech: G, schritt: { art: 'ablehnen', id: 'z1', name: 'Odda Zelt' } })
  assert.deepEqual(j.auswahlen().at(-1).body.hinten, ['z1'])
  assert.deepEqual(nachher.hits.map(h => h.id), ['z2', 'z1'])
  assert.deepEqual(nachher.texte.hinweise, ['Odda Zelt zeige ich nicht mehr vorn.'])
  // auch bei der nächsten Eingabe
  await kern.antworte({ gespraech: G, q: 'leicht' })
  assert.deepEqual(j.auswahlen().at(-1).body.hinten, ['z1'])
})

test('ein geöffnetes Produkt ist im Blick und gesehen: eine Frage danach beantworten seine Werte, die Angaben bleiben', async () => {
  const j = journali()
  const kern = erstelleKern({ journali: j.fn })
  await kern.antworte({ gespraech: G, q: 'Zelt' })
  kern.merke(G, { id: 'z1', name: 'Odda Zelt' })
  const f = await kern.antworte({ gespraech: G, q: 'ist es wasserdicht?' })
  assert.equal(f.about.name, 'Odda Zelt')
  assert.deepEqual(f.about.values.map(v => v.value), ['ja'])
  assert.equal(f.texte.ueber, 'Zu „Odda Zelt“:')
  assert.equal(f.texte.frage, 'Alle Angaben zu diesem Produkt?')
  const weiter = await kern.antworte({ gespraech: G, q: '' })
  assert.deepEqual(weiter.words, ['zelt'], 'die Frage hat die Angaben nicht verändert')
  assert.ok(weiter.hits.find(h => h.id === 'z1').seen, 'gesehen')
  // eine Frage nach einer anderen Art ist eine Suche
  assert.ok(!(await kern.antworte({ gespraech: G, q: 'ist die hose wasserdicht?' })).about)
})

// ---- eine Frage zu den gezeigten Produkten (09.10.2026) — Fall aus der Bedienung: „sind die wasserdicht?“ nach zwei Zelten wurde ein
// weiteres Suchwort („zuerst, was zu „wasserdicht“ passt“), statt die Frage zu beantworten

test('Stellen eines Produkts: Werte und Sätze, in denen ein Wort der Frage steht', () => {
  assert.ok(trifft('wasserdicht', 'Wassersäule'), 'gemeinsamer Anfang „wasser“')
  assert.ok(!trifft('wasserdicht', 'Kondenswasser'))
  assert.ok(trifft('dicht', 'wasserdicht'), 'das ganze Wort in einem längeren')
  assert.ok(!trifft('ist', 'ist'), 'unter vier Zeichen zählt nicht')
  assert.equal(treffer('wasserdicht', 'Das Zelt ist wasserdichtes Gewebe'), 'genau', 'das Wort selbst, gebeugt')
  assert.equal(treffer('wasserdicht', '3000 mm Wassersäule'), 'hinweis', 'nur verwandt')
  assert.deepEqual(saetze('Eins. <b>Zwei</b> drei!\n\nVier'), ['Eins.', 'Zwei drei!', 'Vier'])
  const p = { values: [{ key: 'name', label: 'Name', value: 'Odda Zelt' }, ...PRODUKTE.z1.values], texts: PRODUKTE.z1.texts }
  assert.deepEqual(stellen(p, { woerter: ['wasserdicht'] }).map(v => v.value), ['Polyester, 3000 mm Wassersäule', 'Außenzelt mit 3 000 mm Wassersäule, Boden mit 5 000 mm.'])
  assert.deepEqual(stellen(p, { attribute: ['gewicht'] }).map(v => [v.label, v.value, v.genau]), [['Gewicht', '2.4 kg', true]])
  assert.ok(stellen(p, { woerter: ['wasserdicht'] }).every(v => !v.genau), '„Wassersäule“ ist ein Hinweis auf „wasserdicht“')
  assert.deepEqual(stellen(p, { woerter: ['vorraum'] }), [])
})

test('„sind die wasserdicht?“ beantworten die Angaben der gezeigten Produkte — die gesammelten Angaben bleiben', async () => {
  const j = journali()
  const kern = erstelleKern({ journali: j.fn, assoziationen: {} })   // ohne verwandte Wörter: nur, was „wasserdicht“ selbst trifft
  await kern.antworte({ gespraech: G, q: 'Zelt' })
  const vorher = j.auswahlen().length
  const a = await kern.antworte({ gespraech: G, q: 'sind die wasserdicht?' })
  assert.equal(j.auswahlen().length, vorher, 'keine neue Auswahl')
  // Wortlaut (09.10.2026): „Wassersäule“ nennt „wasserdicht“ nicht selbst — der Satz sagt, dass es Hinweise sind
  assert.equal(a.texte.satz, 'Zu „wasserdicht“ konkret habe ich nichts gefunden, aber diese Merkmale geben Hinweise:')
  assert.deepEqual(a.antworten.map(x => [x.name, x.values.map(v => v.label)]), [['Odda Zelt', ['Material', 'Beschreibung']], ['Ravik Zelt', []]])
  assert.equal(a.texte.nichts, 'Dazu steht in den Angaben nichts.')
  const weiter = await kern.antworte({ gespraech: G, q: '' })
  assert.deepEqual([weiter.words, weiter.filter, weiter.total], [['zelt'], [], 2], '„wasserdicht“ ist kein Suchwort und kein Filter geworden')
  // ein Name grenzt auf das Produkt ein, „schwer“ fragt nach dem Gewicht, „wiegen“ auch
  const ravik = await kern.antworte({ gespraech: G, q: 'wie schwer ist das Ravik?' })
  assert.deepEqual(ravik.antworten.map(x => [x.name, x.values.map(v => v.value)]), [['Ravik Zelt', ['1.4 kg']]])
  assert.equal(ravik.texte.satz, 'Zu „schwer“ steht beim Produkt:', 'das Gewicht nennt das Gefragte')
  assert.deepEqual((await kern.antworte({ gespraech: G, q: 'wie viel wiegen die?' })).antworten.map(x => x.values.map(v => v.value)), [['2.4 kg'], ['1.4 kg']])
  const nichts = await kern.antworte({ gespraech: G, q: 'sind die für den Winter?' })
  assert.equal(nichts.texte.satz, 'Zu „winter“ steht bei diesen Produkten nichts in den Angaben.', '„winter“ steht beim Schlafsack, nicht bei den Zelten')
  // steht das Gefragte in keinem Produkt, ist es keine Frage zu den gezeigten — der Berater nennt, wobei er hilft
  const fremd = await kern.antworte({ gespraech: G, q: 'wer ist bundeskanzler?' })
  assert.deepEqual([fremd.antworten, fremd.texte.satz, fremd.texte.nachsatz],
    [undefined, 'Ich kann Ihnen mit den Produkten weiterhelfen, die wir im Angebot haben:', 'Zu anderen Fragen kann ich leider keine Auskunft geben.'])
})

// 14.10.2026 (Prüfstand): „Was kostet die Fjell Jacke?“ — die Frage trifft genau ein Produkt; seine Werte antworten, die Karte bleibt
test('eine Frage, die genau ein Produkt trifft, beantworten seine Werte — eine Eingrenzung bleibt eine Suche', async () => {
  const kern = erstelleKern({ journali: journali().fn })
  const r = await kern.antworte({ gespraech: G, q: 'wie schwer ist das Odda Zelt?' })
  assert.equal(r.about?.name, 'Odda Zelt')
  assert.ok(r.about.values.some(v => v.label === 'Gewicht'))
  assert.deepEqual(r.hits.map(h => h.name), ['Odda Zelt'])
  assert.ok(!r.about.values.some(v => v.key === 'name'), 'der Name ist keine Antwort')
  const k2 = erstelleKern({ journali: journali().fn })
  await k2.antworte({ gespraech: G, q: 'Zelt' })
  const blau = await k2.antworte({ gespraech: G, q: 'auch in blau?' })
  assert.ok(!blau.about, 'eine Angabe zu den gezeigten ist keine Frage zum Produkt')
})

// 14.10.2026: eine Zahl, die zwei Attribute meinen kann — der Kern fragt; ein Klick setzt die Angabe, eine weitere Zahl ersetzt sie
test('mehrdeutige Angabe: der Kern fragt, welches Attribut gemeint ist; gilt eines, ersetzt die nächste Zahl seinen Wert', async () => {
  const VOKZ = { ...VOK, attributes: [...VOK.attributes,
    { key: 'laenge', label: 'Länge', labels: { de: 'Länge' }, type: 'integer', unit: 'cm', unitLabels: ['Zentimeter'], facet: true },
    { key: 'breite', label: 'Breite', labels: { de: 'Breite' }, type: 'integer', unit: 'cm', unitLabels: ['Zentimeter'], facet: true }] }
  const j = journali()
  // die Auswahl gibt die Angaben zurück, wie sie kamen (die Attrappe kennt sonst nur das Grundvokabular)
  const fn = async (pfad, body) => {
    if (pfad.startsWith('vocabulary')) return { status: 200, json: VOKZ }
    const r = await j.fn(pfad, body)
    if (pfad === 'select') r.json.filter = (body.angaben ?? []).map(a => ({ ...a, label: a.attribute, valueLabel: a.value }))
    return r
  }
  const kern = erstelleKern({ journali: fn })
  const r = await kern.antworte({ gespraech: G, q: 'Zelt bis 200 cm' })
  assert.deepEqual(r.wahl.optionen.map(o => [o.attribute, o.op, o.value, o.text]), [['laenge', 'le', '200', 'Länge: bis 200 cm'], ['breite', 'le', '200', 'Breite: bis 200 cm']])
  assert.equal(r.texte.frage, 'Meinen Sie Länge oder Breite?')
  assert.deepEqual(r.words, ['zelt'], 'die Zahl ist kein Suchwort')
  const gesetzt = await kern.antworte({ gespraech: G, schritt: { art: 'filter', attribute: 'laenge', op: 'le', value: '200' } })
  assert.ok(!gesetzt.wahl)
  const neu = await kern.antworte({ gespraech: G, q: 'bis 250 cm' })
  assert.ok(!neu.wahl, 'Länge gilt schon — die neue Zahl ersetzt sie')
  assert.deepEqual(j.auswahlen().at(-1).body.angaben.filter(a => a.attribute === 'laenge').map(a => a.value), ['250'])
})

test('keine Frage zu den gezeigten: eine andere Art, „gibt es …“, oder noch nichts gezeigt — dann eine Suche', async () => {
  const j = journali()
  const kern = erstelleKern({ journali: j.fn })
  assert.ok(!(await kern.antworte({ gespraech: G, q: 'sind die wasserdicht?' })).antworten, 'nichts gezeigt')
  await kern.antworte({ gespraech: G, schritt: { art: 'neu' } })
  await kern.antworte({ gespraech: G, q: 'Zelt' })
  assert.ok(!(await kern.antworte({ gespraech: G, q: 'ist die hose wasserdicht?' })).antworten, 'eine andere Art')
  await kern.antworte({ gespraech: G, schritt: { art: 'neu' } })
  await kern.antworte({ gespraech: G, q: 'Zelt' })
  const blau = await kern.antworte({ gespraech: G, q: 'gibt es die auch in blau?' })
  assert.ok(!blau.antworten)
  assert.deepEqual(blau.filter.map(f => f.value), ['blue'])
})

test('ein Produkt im Blick: nennen die Bezeichnungen nichts, antworten seine Werte und Sätze', async () => {
  const kern = erstelleKern({ journali: journali().fn })
  await kern.antworte({ gespraech: G, q: 'Zelt' })
  kern.merke(G, { id: 'z2', name: 'Ravik Zelt' })
  const f = await kern.antworte({ gespraech: G, q: 'wie ist der boden?' })
  assert.equal(f.about.name, 'Ravik Zelt')
  assert.deepEqual(f.about.values.map(v => [v.label, v.value]), [['Beschreibung', 'Der Boden ist aus Nylon.']])
  assert.equal(f.texte.ueber, 'Zu „Ravik Zelt“:', 'der Boden ist genau das Gefragte')
  kern.merke(G, { id: 'z1', name: 'Odda Zelt' })
  const h = await kern.antworte({ gespraech: G, q: 'ist es wasserfest?' })
  assert.equal(h.texte.ueber, 'Zu „wasserfest“ konkret habe ich bei „Odda Zelt“ nichts gefunden, aber diese Merkmale geben Hinweise:')
  assert.deepEqual(h.about.values.map(v => v.label), ['Material', 'Beschreibung'])
})

// Fall aus der Bedienung (09.10.2026): „was verkauft ihr?“ und „welche artikel habt ihr im angebot?“ waren unbekannte Wörter
test('eine Frage nach dem Sortiment nennt die Gruppen; ein Klick grenzt ein, ein neues Thema ausserhalb fragt ohne die Gruppe', async () => {
  const j = journali()
  const kern = erstelleKern({ journali: j.fn })
  for (const q of ['was verkauft ihr?', 'Welche Artikel habt ihr im Angebot?', 'what do you sell?']) {
    const a = await kern.antworte({ gespraech: G, q })
    assert.deepEqual(a.sortiment.map(g => g.label), ['Schlafen', 'Kleidung'], q)
    assert.equal(a.texte.satz, 'Im Angebot sind 5 Produkte in 2 Bereichen:')
  }
  assert.equal(j.auswahlen().length, 0, 'keine Auswahl')
  const g = await kern.antworte({ gespraech: G, schritt: { art: 'gruppe', key: 'k-kleidung', label: 'Kleidung' } })
  assert.deepEqual([g.hits.map(h => h.id), g.group, g.texte.satz], [['h1', 'h2'], { key: 'k-kleidung', label: 'Kleidung' }, '2 Produkte in „Kleidung“.'])
  assert.deepEqual((await kern.antworte({ gespraech: G, q: 'rot' })).hits.map(h => h.id), ['h2'], 'die Gruppe gilt weiter')
  // ein Zelt gibt es in der Kleidung nicht: der Kern fragt ohne die Gruppe nach dem Wechsel
  const zelt = await kern.antworte({ gespraech: G, q: 'Zelt' })
  assert.equal(zelt.total, 0)
  assert.deepEqual(zelt.instead.words, ['zelt'])
  const ja = await kern.antworte({ gespraech: G, schritt: { art: 'statt' } })
  assert.equal(ja.group, null)
  assert.ok(ja.hits.some(h => h.id === 'z1'))
  await kern.antworte({ gespraech: G, schritt: { art: 'gruppe', key: 'k-schlafen', label: 'Schlafen' } })
  assert.equal((await kern.antworte({ gespraech: G, schritt: { art: 'weg', kind: 'gruppe' } })).total, 5, '× nimmt die Gruppe weg')
  assert.equal((await kern.antworte({ gespraech: G, schritt: { art: 'gruppe', key: 'k-gibtsnicht', label: 'X' } })).group, null, 'was journali nicht kennt, fällt weg')
  // ein Wort ausser den allgemeinen ist eine Suche
  assert.ok(!(await kern.antworte({ gespraech: 'anders-0001', q: 'welche zelte habt ihr?' })).sortiment)
})

// ---- das Grundwissen (kern/wissen.mjs, 09.10.2026)

test('Grundwissen: wer der Berater ist, was er kann, wie es ihm geht — ohne Suche; was er kann, nennt das Sortiment dazu', async () => {
  const j = journali()
  const kern = erstelleKern({ journali: j.fn })
  assert.match((await kern.antworte({ gespraech: G, q: 'Bist du ein Mensch?' })).texte.satz, /^Ich bin der Produktberater dieses Shops, ein Programm und kein Mensch\./)
  assert.match((await kern.antworte({ gespraech: G, q: 'wer bist du' })).texte.satz, /^Ich bin der Produktberater/)
  assert.equal((await kern.antworte({ gespraech: G, q: 'Wie geht es dir?' })).texte.satz, 'Danke, gut. Wobei kann ich helfen?')
  assert.equal((await kern.antworte({ gespraech: G, q: 'ok' })).texte.satz, 'Gut. Wobei kann ich noch helfen?')
  const hilfe = await kern.antworte({ gespraech: G, q: 'Was kannst du?' })
  assert.match(hilfe.texte.satz, /^Ich suche passende Produkte/)
  assert.deepEqual([hilfe.sortiment.length, hilfe.texte.nachsatz], [2, 'Im Angebot sind diese Bereiche.'])
  assert.equal(j.auswahlen().length, 0)
  assert.equal((await kern.antworte({ gespraech: G, q: 'ok, zelt' })).total, 2, 'mit einem Anliegen eine Suche')
})

test('eine Frage zum Shop (Versand, Rückgabe) und eine Frage ausserhalb führen auf das Sortiment zurück', async () => {
  // ohne Assoziationen: mit der Grundausstattung sucht „Wetter“ nach Regenkleidung (wetterfest, regenjacke …)
  const kern = erstelleKern({ journali: journali().fn, assoziationen: {} })
  const v = await kern.antworte({ gespraech: G, q: 'Wie lange dauert der Versand?' })
  assert.deepEqual([v.texte.hinweise, v.texte.satz, v.sortiment.length],
    [['Zu Versand, Lieferung, Bezahlung und Rückgabe kann ich keine Auskunft geben.'], 'Ich kann Ihnen mit den Produkten weiterhelfen, die wir im Angebot haben:', 2])
  assert.ok(!(await kern.antworte({ gespraech: 'anders-0002', q: 'Zelt mit schneller Lieferung' })).sortiment, 'mit einer Art eine Suche')
  const w = await kern.antworte({ gespraech: 'anders-0003', q: 'Wie wird das Wetter morgen?' })
  assert.deepEqual([w.texte.hinweise, w.texte.nachsatz], [[], 'Zu anderen Fragen kann ich leider keine Auskunft geben.'], 'eine Frage: ohne „steht in keinem Produkt“')
})

// ---- Assoziationen (kern/assoziationen.mjs, 09.10.2026): „winter“ → kalt, „wandern“ → sport

const ASSOZ = { de: { januar: ['kalt', 'warm', 'frost', 'schnee'], nass: ['regen', 'wasserdicht'], sommer: ['luftig', 'leicht'] } }

test('Assoziationen: je Sprache, auch gebeugt; die Grundausstattung liegt im Plugin', () => {
  const a = erstelleAssoziationen(ASSOZ)
  assert.deepEqual(a.zu('januar', 'de-DE'), ['kalt', 'warm', 'frost', 'schnee'])
  assert.deepEqual(a.zu('Januars', 'de'), ['kalt', 'warm', 'frost', 'schnee'], 'gebeugt')
  assert.deepEqual(a.zu('januar', 'en'), [], 'andere Sprache')
  assert.deepEqual(erstelleAssoziationen({ de: { 'fußball': ['sport'] } }).zu('fussball', 'de'), ['sport'], 'ss für ß')
  const g = erstelleAssoziationen()
  assert.ok(g.groesse() >= 10_000, `Grundausstattung: ${g.groesse()} Assoziationen`)
  for (const [w, nach] of [['winter', 'kalt'], ['tennis', 'sport'], ['fussball', 'sport'], ['wandern', 'sport'], ['regen', 'wasserdicht'], ['kälte', 'wärmend']])
    assert.ok(g.zu(w, 'de').includes(nach), `${w} → ${nach}: ${g.zu(w, 'de').join(', ')}`)
})

test('ein Wort in keinem Produkt mit Assoziationen sucht über deren Wörter, die im Sortiment stehen — und bleibt als Angabe', async () => {
  const j = journali()
  const kern = erstelleKern({ journali: j.fn, assoziationen: ASSOZ })
  const a = await kern.antworte({ gespraech: G, q: 'Januar' })
  assert.deepEqual(a.words, ['januar'])
  assert.deepEqual(a.hits.map(h => h.id), ['s1'], '„warm winter“ steht beim Schlafsack — von den Wörtern zu „januar“ steht nur „warm“ im Sortiment')
  assert.deepEqual(a.texte.hinweise, ['Zu „januar“ suche ich nach „warm“.'])
  assert.deepEqual(j.auswahlen().at(-1).body.ordnen, ['warm'])
  // die nächste Eingabe: das Wort gilt weiter und ordnet weiter über „warm“
  const rot = await kern.antworte({ gespraech: G, q: 'rot' })
  assert.deepEqual([rot.words, rot.hits.map(h => h.id), j.auswahlen().at(-1).body.ordnen], [['januar'], ['s1'], ['warm']])
  assert.deepEqual((await kern.antworte({ gespraech: G, schritt: { art: 'weg', kind: 'word', word: 'januar' } })).words, [])
  // „sommer“ → „luftig“, „leicht“: das Ravik Zelt
  assert.deepEqual((await kern.antworte({ gespraech: 'anders-0004', q: 'sommer' })).hits.map(h => h.id), ['z2'])
  // ohne Assoziation bleibt es unbekannt, und das Grundwissen führt zurück
  assert.ok((await kern.antworte({ gespraech: 'anders-0005', q: 'bundeskanzler' })).sortiment)
})

test('Fragen zu den gezeigten: assoziierte Wörter liefern Hinweise', async () => {
  const kern = erstelleKern({ journali: journali().fn, assoziationen: ASSOZ })
  await kern.antworte({ gespraech: G, q: 'Zelt' })
  const a = await kern.antworte({ gespraech: G, q: 'werden die nass?' })
  assert.equal(a.texte.satz, 'Zu „nass“ konkret habe ich nichts gefunden, aber diese Merkmale geben Hinweise:')
  assert.deepEqual(a.antworten.map(x => x.values.length > 0), [true, false], '„wasserdicht“ … beim Odda Zelt')
})

test('Gruss, Dank und Abschied bekommen eine kurze Antwort, keine Suche', async () => {
  const j = journali()
  const kern = erstelleKern({ journali: j.fn })
  assert.deepEqual((await kern.antworte({ gespraech: G, q: 'Hallo' })).texte.satz, 'Hallo. Wonach suchen Sie?')
  assert.ok((await kern.antworte({ gespraech: G, q: 'danke!' })).kurz)
  assert.equal((await kern.antworte({ gespraech: G, q: 'Tschüss', locale: 'en' })).texte.satz, 'Auf Wiedersehen.', 'die Sprache des Beraters (hier nur de)')
  assert.equal(j.auswahlen().length, 0)
  assert.equal((await kern.antworte({ gespraech: G, q: 'Hallo, ich suche ein Zelt' })).total, 2, 'mit einem Anliegen eine Suche')
})

test('mit KI: was die Regeln nicht erkannt haben, übersetzt die KI in Angaben — aus dem Rest fallen ihre Namen', async () => {
  const j = journali({ ki: b => b.auftrag === 'angaben' ? { angaben: [{ attribute: 'color', op: 'eq', value: 'blue', label: 'Farbe', valueLabel: 'Blau' }], names: ['himmelblau'] } : { text: 'Das Ravik passt [1].' } })
  const kern = erstelleKern({ journali: j.fn })
  const a = await kern.antworte({ gespraech: G, q: 'Zelt in himmelblau' })
  const ki = j.rufe.find(r => r.pfad === 'ki' && r.body.auftrag === 'angaben')
  assert.equal(ki.body.satz, 'Zelt in himmelblau', 'der Rest nach der Erkennung ohne KI')
  assert.deepEqual(a.filter.map(f => [f.value, f.quelle]), [['blue', 'ki']])
  assert.deepEqual(a.words, ['zelt'], '„himmelblau“ ist kein Suchwort mehr')
  assert.equal(a.answer, 'Das Ravik passt [1].')
  assert.deepEqual(j.rufe.find(r => r.pfad === 'ki' && r.body.auftrag === 'antwort').body.treffer, ['z2'])
  // ohne KI am Berater fragt der Kern sie nicht
  const ohne = journali()
  await erstelleKern({ journali: ohne.fn }).antworte({ gespraech: G, q: 'Zelt in himmelblau' })
  assert.ok(!ohne.rufe.some(r => r.pfad === 'ki'))
})

test('ohne Gespräch (MCP): verstehen, auswählen, Tippfehler — nichts wird gemerkt', async () => {
  const j = journali()
  const kern = erstelleKern({ journali: j.fn })
  const r = await kern.suche({ q: 'zeit rot', filter: [{ attribute: 'groesse', value: 'm' }] })
  assert.deepEqual(r.corrected, [{ from: 'zeit', to: 'zelt' }])
  assert.deepEqual(j.auswahlen().at(-1).body.angaben, [{ attribute: 'groesse', op: 'eq', value: 'm' }, { attribute: 'color', op: 'eq', value: 'red' }])
  assert.equal(kern.gespraeche.size, 0)
})

test('das Vokabular wird gemerkt und mit dem ETag nachgefragt', async () => {
  let t = 0
  const rufe = []
  const kern = erstelleKern({ journali: async (pfad, body, kopf) => {
    rufe.push([pfad, kopf])
    if (pfad.startsWith('vocabulary')) return kopf?.['if-none-match'] === '"1"' ? { status: 304, json: null } : { status: 200, json: VOK }
    return journali().fn(pfad, body)
  }, jetzt: () => t })
  await kern.antworte({ q: 'Zelt' }); await kern.antworte({ q: 'Hose' })
  assert.equal(rufe.filter(r => r[0].startsWith('vocabulary')).length, 1, 'gemerkt')
  t += 31_000
  await kern.antworte({ q: 'Zelt' })
  const v = rufe.filter(r => r[0].startsWith('vocabulary'))
  assert.equal(v.length, 2)
  assert.equal(v[1][1]['if-none-match'], '"1"')
})

// ---- Lernen (ohne Person, ohne Gespräch)

test('Lernen zählt Wörter ohne Treffer, gelesene Tippfehler und Wörter vor dem Merken — und macht Vorschläge', async () => {
  const lernen = erstelleLernen()
  const kern = erstelleKern({ journali: journali().fn, lernen })
  for (let i = 0; i < 3; i++) await kern.antworte({ gespraech: 'lernen-000' + i, q: 'auto' })
  for (let i = 0; i < 3; i++) await kern.antworte({ gespraech: 'lernen-100' + i, q: 'zeit' })
  for (let i = 0; i < 3; i++) { await kern.antworte({ gespraech: 'lernen-200' + i, q: 'Zelt' }); kern.merke('lernen-200' + i, { id: 'z2', name: 'Ravik Zelt', art: 'gemerkt' }) }
  const v = vorschlaege(lernen.stand())
  assert.deepEqual(v.ohneTreffer.map(x => [x.wort, x.n]), [['auto', 3]])
  assert.deepEqual(v.korrektur.map(x => [x.von, x.zu, x.n]), [['zeit', 'zelt', 3]])
  assert.deepEqual(v.gemerkt.map(x => [x.wort, x.id, x.n]), [['zelt', 'z2', 3]])
  assert.deepEqual(vorschlaege(lernen.stand(), { ab: 4 }).ohneTreffer, [], 'erst ab einer Zahl ein Vorschlag')
})

test('das Gelernte liegt in einer Datei des Dienstes, überlebt einen Neustart und wird als Vorschläge lesbar', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-lernen-'))
  const datei = path.join(dir, 'daten', 'lernen.json')
  let t = 0
  try {
    const l = erstelleLernen({ datei, jetzt: () => t, schreibenNach: 60_000 })
    l.notiere('ohneTreffer', { wort: 'auto' })
    assert.ok(!fs.existsSync(datei), 'nicht nach jedem Wort — höchstens einmal je Minute')
    t += 61_000
    l.notiere('ohneTreffer', { wort: 'auto' })
    assert.ok(fs.existsSync(datei))
    l.notiere('korrektur', { from: 'zeit', to: 'zelt' })
    l.schreibe()
    const nach = erstelleLernen({ datei })   // ein Neustart
    assert.equal(nach.stand().ohneTreffer.auto.n, 2)
    assert.equal(nach.stand().korrektur['zeit → zelt'].n, 1)
    const text = alsText(vorschlaege(nach.stand(), { ab: 1 }))
    assert.match(text, /Wörter ohne Treffer\n  2×  „auto“ — Synonym im Wörterbuch oder Attribut in der Sicht/)
    assert.match(text, /„zeit“ → „zelt“/)
    assert.equal(alsText(vorschlaege({}, {})), 'Noch keine Vorschläge.')
    // eine kaputte Datei fängt von vorn an, statt den Dienst anzuhalten
    fs.writeFileSync(datei, '{ kaputt')
    assert.deepEqual(erstelleLernen({ datei }).stand().ohneTreffer, {})
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
