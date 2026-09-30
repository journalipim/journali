// Einheiten in der Pflege: umrechnen, Auswahl je Grösse, Eingabe zurück in die Einheit des Attributs
import test from 'node:test'
import assert from 'node:assert/strict'
import { wahl, angezeigt, beste, umrechnen, zeigen, speichern, zahlText, zahlOderBruch, gewaehlt } from '../src/units.js'

const units = [
  { key: 't', quantity: 'mass', factor: 1000 }, { key: 'kg', quantity: 'mass', factor: 1 }, { key: 'g', quantity: 'mass', factor: 0.001 }, { key: 'mg', quantity: 'mass', factor: 0.000001 },
  { key: 'm', quantity: 'length', factor: 1 },
  { key: 'pc', quantity: 'count', factor: 1 }, { key: 'dutzend', quantity: 'count', factor: 12 },
]
const model = { units }
const gewicht = { key: 'gewicht', type: 'decimal', unit: 'kg' }

test('zur Wahl stehen die Einheiten der Grösse des Attributs', () => {
  assert.deepEqual(wahl(model, gewicht).map(u => u.key), ['t', 'kg', 'g', 'mg'])
})

test('keine Wahl: keine Einheit, kein Zahlentyp, nur eine Einheit der Grösse', () => {
  assert.deepEqual(wahl(model, { key: 'a', type: 'decimal' }), [])
  assert.deepEqual(wahl(model, { key: 'a', type: 'text', unit: 'kg' }), [])
  assert.deepEqual(wahl(model, { key: 'a', type: 'decimal', unit: 'm' }), [], 'm ist die einzige Länge hier')
  assert.deepEqual(wahl(model, { key: 'a', type: 'decimal', unit: 'unbekannt' }), [])
})

test('anfangs gilt die Einheit des Attributs; eine gewählte bleibt, eine unpassende nicht', () => {
  delete gewaehlt.gewicht
  assert.equal(angezeigt(model, gewicht), 'kg')
  gewaehlt.gewicht = 'g'; assert.equal(angezeigt(model, gewicht), 'g')
  gewaehlt.gewicht = 'm'; assert.equal(angezeigt(model, gewicht), 'kg', 'm gehört nicht zur Grösse mass')
  delete gewaehlt.gewicht
})

test('umrechnen in beide Richtungen, ohne Gleitkommareste', () => {
  assert.equal(umrechnen('1.5', 'kg', 'g', units), '1500')
  assert.equal(umrechnen('500', 'g', 'kg', units), '0.5')
  assert.equal(umrechnen('250', 'mg', 'kg', units), '0.00025')
  assert.equal(umrechnen('0.1', 'kg', 'g', units), '100')
  assert.equal(umrechnen('1,5', 'kg', 'g', units), '1500', 'Komma wird gelesen')
  assert.equal(zahlText(0.1 + 0.2), '0.3')
  assert.equal(zahlText(1e-7), '0.0000001', 'kein Exponent')
})

test('was keine Zahl ist oder keine bekannte Einheit hat, bleibt', () => {
  assert.equal(umrechnen('abc', 'kg', 'g', units), 'abc')
  assert.equal(umrechnen('5', 'kg', 'xx', units), '5')
  assert.equal(umrechnen('', 'kg', 'g', units), '')
  assert.equal(umrechnen(null, 'kg', 'g', units), null)
})

test('zeigen rechnet in die gewählte Einheit; speichern rechnet zurück', () => {
  gewaehlt.gewicht = 'g'
  assert.equal(zeigen(model, gewicht, '0.5'), '500')
  assert.deepEqual(speichern(model, gewicht, '750'), { wert: '0.75' })
  assert.deepEqual(speichern(model, gewicht, ''), { wert: '' }, 'leer bleibt leer')
  assert.deepEqual(speichern(model, gewicht, 'abc'), { wert: 'abc' }, 'keine Zahl: die Prüfung beim Speichern sagt es')
  delete gewaehlt.gewicht
  assert.equal(zeigen(model, gewicht, '0.5'), '0.5', 'in der Einheit des Attributs bleibt der Wert, wie er ist')
})

const temperatur = [
  { key: '°C', quantity: 'temperature', factor: 1, offset: 0 },
  { key: '°F', quantity: 'temperature', factor: 5 / 9, offset: -160 / 9 },
  { key: 'K', quantity: 'temperature', factor: 1, offset: -273.15 },
]

test('Temperatur: Verschiebung und Faktor zusammen, in beide Richtungen', () => {
  assert.equal(umrechnen('100', '°C', '°F', temperatur), '212')
  assert.equal(umrechnen('212', '°F', '°C', temperatur), '100')
  assert.equal(umrechnen('32', '°F', '°C', temperatur), '0')
  assert.equal(umrechnen('0', '°C', 'K', temperatur), '273.15')
  assert.equal(umrechnen('0', 'K', '°C', temperatur), '-273.15')
  assert.equal(umrechnen('-40', '°C', '°F', temperatur), '-40', '−40 ist in beiden gleich')
  assert.equal(umrechnen('98.6', '°F', '°C', temperatur), '37')
})

test('Einheiten ohne offset (ältere Einträge) rechnen wie bisher', () => {
  assert.equal(umrechnen('1.5', 'kg', 'g', units), '1500')
})

test('Zahl oder Bruch aus einer Eingabe', () => {
  assert.equal(zahlOderBruch('0,5'), 0.5)
  assert.equal(zahlOderBruch('-273.15'), -273.15)
  assert.equal(zahlOderBruch('5/9'), 5 / 9)
  assert.equal(zahlOderBruch('-160 / 9'), -160 / 9)
  assert.equal(zahlOderBruch('1/0'), null)
  assert.equal(zahlOderBruch('abc'), null)
  assert.equal(zahlOderBruch(''), null)
})

test('die beste Einheit: die grösste, in der der Wert mindestens 1 ist und höchstens drei Nachkommastellen hat', () => {
  const menge = { key: 'menge', type: 'integer', unit: 'mg' }
  assert.equal(beste(model, menge, '2000'), 'g', '2000 mg sind 2 g')
  assert.equal(beste(model, menge, '20000'), 'g')
  assert.equal(beste(model, menge, '60'), 'mg')
  assert.equal(beste(model, menge, '500'), 'mg', '0.5 g ist kleiner als 1')
  assert.equal(beste(model, menge, '1500'), 'g', '1.5 g')
  assert.equal(beste(model, menge, '1234567'), 'g', '1234.567 g hat drei Nachkommastellen, 1.234567 kg sechs')
  assert.equal(beste(model, menge, '2000000'), 'kg')
  assert.equal(beste(model, menge, ''), 'mg', 'ohne Wert die Einheit des Attributs')
  assert.equal(beste(model, menge, '0'), 'mg')
  assert.equal(beste(model, { key: 'x', type: 'decimal', unit: 'm' }, '5000'), 'm', 'ohne Wahl die Einheit des Attributs')
  assert.equal(beste({ units: temperatur }, { key: 't', type: 'decimal', unit: '°C' }, '2000'), '°C', 'bei Verschiebung gilt die Einheit des Attributs')
})

test('zeigen mit ausdrücklicher Einheit unabhängig von der gewählten des Attributs', () => {
  gewaehlt.gewicht = 'mg'
  assert.equal(zeigen(model, gewicht, '0.5', 'g'), '500')
  delete gewaehlt.gewicht
})

test('ein ganzzahliges Attribut nimmt nur ein ganzzahliges Ergebnis', () => {
  const stueck = { key: 'menge', type: 'integer', unit: 'kg' }
  gewaehlt.menge = 'g'
  assert.deepEqual(speichern(model, stueck, '2000'), { wert: '2' })
  assert.deepEqual(speichern(model, stueck, '1'), { fehler: { eingabe: '1', von: 'g', wert: '0.001', nach: 'kg' } })
  delete gewaehlt.menge
})
