// Datenmapper, Lage Schlüssel/Wert (27.09.2026, 34 L): eine technische Tabelle ist gedreht — Attribut links, Wert
// rechts, die Einheit im Wert. Fälle aus Datenblättern.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitUnit, keyOf, suggestPairs, DOC_GROUP } from '../src/mapper.js'

const model = {
  masterLocale: 'de', locales: [{ code: 'de' }],
  units: [{ key: 'kg', label: { de: 'Kilogramm' } }, { key: 'mm', label: { de: 'Millimeter' } }, { key: 'V', label: { de: 'Volt' } }],
  attributes: [
    { key: 'weight', label: { de: 'Gewicht' }, type: 'decimal', unit: 'kg' },
    { key: 'sku', label: { de: 'SKU' }, type: 'text', unique: true },
    { key: 'color', label: { de: 'Farbe' }, type: 'enum', list: 'color' },
    { key: 'only_variant', label: { de: 'Nur an Varianten' }, type: 'text', levels: ['variant'] },
  ],
  lists: [{ key: 'color', values: [{ value: 'blue', label: { de: 'Blau' } }] }],
}

test('Einheit aus dem Wert — nur, wenn das Modell sie kennt', () => {
  assert.deepEqual(splitUnit('22 mm', model), { number: '22', unit: 'mm' })
  assert.deepEqual(splitUnit('1,2kg', model), { number: '1,2', unit: 'kg' })
  assert.deepEqual(splitUnit('230 Volt', model), { number: '230', unit: 'V' }, 'die Bezeichnung zählt wie der Schlüssel')
  assert.equal(splitUnit('3 Stück', model), null, 'pc gibt es in diesem Modell nicht')
  assert.equal(splitUnit('blau', model), null)
  assert.equal(splitUnit('IP 65', model), null, 'eine Zahl hinter Buchstaben ist keine Einheit')
})

test('ein Schlüssel für ein neues Attribut: klein, ohne Umlaute, beginnt mit einem Buchstaben', () => {
  assert.equal(keyOf('Durchmesser (außen)'), 'durchmesser_aussen')
  assert.equal(keyOf('3-Phasen'), 'a_3_phasen')
  assert.equal(keyOf('Netzspannung:'), 'netzspannung')
  assert.equal(keyOf('###'), '')
})

test('gefunden, neu mit Einheit, neu als Text — und der Wert, wie er geschrieben wird', () => {
  const v = suggestPairs([{ key: 'Gewicht', value: '1,2 kg' }, { key: 'Durchmesser', value: '22 mm' }, { key: 'Farbe', value: 'Blau' }, { key: 'Werkstoff', value: 'Stahl' }], model)   // „Material“ ist im Mapper ein Synonym der Artikelnummer
  assert.deepEqual([v[0].target, v[0].attribute, v[0].converted, v[0].error], ['attr', 'weight', '1.2', null])
  assert.deepEqual([v[1].target, v[1].newKey, v[1].newType, v[1].unit, v[1].converted], ['new', 'durchmesser', 'integer', 'mm', '22'])
  assert.deepEqual([v[2].target, v[2].attribute, v[2].converted], ['attr', 'color', 'blue'], 'der Listenwert über die Bezeichnung')
  assert.deepEqual([v[3].target, v[3].newKey, v[3].newType, v[3].converted], ['new', 'werkstoff', 'text', 'Stahl'])
  assert.equal(DOC_GROUP, 'from_document')
})

test('was in dieser Lage nichts ist: Schlüsselspalten, Doppelte, Attribute anderer Knotentypen, leere Werte', () => {
  const v = suggestPairs([{ key: 'Artikelnummer', value: '4711' }, { key: 'Gewicht', value: '1 kg' }, { key: 'Gewicht', value: '2 kg' }, { key: 'Nur an Varianten', value: 'x' }, { key: 'Hinweis', value: '' }], model, { role: 'product' })
  assert.deepEqual([v[0].target, v[0].attribute], ['attr', 'sku'], 'die Artikelnummer ist ein Attribut wie jedes eindeutige — kein Sonderfall')
  assert.equal(v[1].target, 'attr')
  assert.deepEqual([v[2].target, v[2].why], ['skip', 'doppelt'])
  assert.equal(v[3].target, 'skip'); assert.match(v[3].why, /gilt nicht für product/)
  assert.equal(v[4].target, 'skip')
})

test('passt der Wert nicht zum geratenen Typ, wird das Attribut Text', () => {
  const [v] = suggestPairs([{ key: 'Schutzart', value: 'IP 65' }], model)
  assert.deepEqual([v.target, v.newType, v.converted, v.error], ['new', 'text', 'IP 65', null])
})
