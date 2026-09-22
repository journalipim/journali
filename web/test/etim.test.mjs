// ETIM-Kern (Taloan, 22.09.: Zuordnung mit ƒ, Vollständigkeit, Regeln der Ausleitung) — ohne DOM, wie im Job
import test from 'node:test'
import assert from 'node:assert/strict'
import { featuresOf, gate, checkNode, mapEntry, resolveValue } from '../../plugins/etim/core.mjs'

const cls = { code: 'EC004718', name: { de: 'Laptop' }, release: { name: 'ETIM-9.0' }, features: [
  { code: 'EF000008', type: 'Numeric', name: { de: 'Breite' }, unit: { code: 'MM', abbr: { de: 'mm' } }, values: [] },
  { code: 'EF008851', type: 'Logical', name: { de: 'Wi-Fi' }, values: [] },
  { code: 'EF000007', type: 'Alphanumeric', name: { de: 'Farbe' }, values: [{ code: 'EV000123', name: { de: 'rot', en: 'red' } }, { code: 'EV000124', name: { de: 'blau' } }] },
  { code: 'EF000167', type: 'Numeric', name: { de: 'Gewicht' }, unit: { code: 'G', abbr: { de: 'g' } }, values: [] },
] }
const getClass = async code => code === 'EC004718' ? cls : null
// Zuordnung: Breite aus „breite“ in cm (× 10), Wi-Fi aus „wlan“ mit x/ja, Farbe aus „farbe“ über Tabelle; Gewicht ohne Zuordnung → ef000167
const map = {
  EF000008: { to: 'breite', steps: [{ op: 'number' }, { op: 'replace', find: '^(.*)$', with: '$1', regex: true }] },
  EF008851: { to: 'wlan', steps: [{ op: 'boolean', yes: 'x, ja' }] },
  EF000007: { to: 'farbe', steps: [{ op: 'map', pairs: 'Rot=EV000123; Blau=EV000124' }] },
}
const attr = { etim_class: { value: 'EC004718', raw: 'EC004718' }, breite: { value: '35 cm', raw: '35 cm' }, wlan: { value: 'x', raw: 'x' }, farbe: { value: 'Rot', raw: 'Rot' }, ef000167: null }

test('mapEntry: Zeiger, { to, steps } oder eigenes ef…', () => {
  assert.deepEqual(mapEntry({ EF000001: 'breite' }, 'EF000001'), { key: 'breite', steps: null })
  assert.deepEqual(mapEntry(map, 'EF008851'), { key: 'wlan', steps: map.EF008851.steps })
  assert.deepEqual(mapEntry(map, 'EF999999'), { key: 'ef999999', steps: null })
  assert.deepEqual(mapEntry({ EF000001: { to: '' } }, 'EF000001'), { key: 'ef000001', steps: null })
})

test('featuresOf: Werte laufen durch die Kette — „35 cm“ → 35, „x“ → true, „Rot“ → EV000123; Vollständigkeit zählt', async () => {
  const r = await featuresOf({ attr, locale: 'de' }, { classAttr: 'etim_class', map, unknownAs: 'UN', getClass })
  const by = Object.fromEntries(r.features.map(f => [f.code, f]))
  assert.equal(by.EF000008.value, '35')
  assert.equal(by.EF008851.value, 'true')
  assert.equal(by.EF000007.value, 'EV000123')
  assert.equal(by.EF000167.value, '-'); assert.equal(by.EF000167.details, 'UN')   // kein Wert: unbekannt nach Guideline
  assert.equal(r.filled, 3); assert.equal(r.total, 4); assert.equal(r.completeness, 75)
})

test('gate: Regeln des BMEcat-Profils — Klasse Pflicht, Vollständigkeit, strenge Werte', async () => {
  const cfg = { classAttr: 'etim_class', map, getClass, version: '9.0' }
  assert.equal(await gate({ attr }, cfg), null)   // alle Attribute da (ef000167 als null-Eintrag = Attribut im Modell)
  assert.equal(await gate({ attr: { etim_class: null } }, cfg), null, 'ohne Klasse: nicht gesperrt, wenn nicht Pflicht')
  assert.equal(await gate({ attr: { etim_class: null } }, { ...cfg, requireClass: true }), 'keine ETIM-Klasse')
  assert.match(await gate({ attr }, { ...cfg, minCompleteness: 80 }), /Vollständigkeit 75 % unter 80 %/)
  assert.equal(await gate({ attr }, { ...cfg, minCompleteness: 75 }), null)
  const badAttr = { ...attr, farbe: { value: 'Lila', raw: 'Lila' } }
  assert.equal(await gate({ attr: badAttr }, cfg), null, 'unpassender Wert sperrt nicht — geht als UN hinaus')
  assert.match(await gate({ attr: badAttr }, { ...cfg, strict: true }), /Werte passen nicht zum Merkmal: EF000007/)
  assert.match(await gate({ attr: { etim_class: { value: 'EC000001' } } }, cfg), /nicht in ETIM 9.0/)
  assert.match(await gate({ attr: { etim_class: attr.etim_class, breite: attr.breite } }, cfg), /3 von 4 Merkmalen ohne Attribut/)
})

test('checkNode (Datenqualität) nimmt die Kette mit: „35 cm“ passt nach number, „Lila“ nicht in der Tabelle', () => {
  const columns = [{ key: 'etim_class' }, { key: 'breite' }, { key: 'wlan' }, { key: 'farbe' }, { key: 'ef000167' }]
  const classes = new Map([[cls.code, cls]])
  const ok = checkNode({ values: { etim_class: { value: 'EC004718' }, breite: { value: '35 cm' }, wlan: { value: 'x' }, farbe: { value: 'Rot' } }, columns, classes, cfg: { classAttr: 'etim_class', map, locale: 'de' } })
  assert.ok(!ok.some(f => /passt nicht/.test(f.message)), JSON.stringify(ok))
  const bad = checkNode({ values: { etim_class: { value: 'EC004718' }, farbe: { value: 'Lila' } }, columns, classes, cfg: { classAttr: 'etim_class', map, locale: 'de' } })
  assert.ok(bad.some(f => f.attribute === 'farbe' && /passt nicht/.test(f.message)))
})

test('resolveValue bleibt: Range, Zahl mit Komma, EV-Name in irgendeiner Sprache', () => {
  assert.deepEqual(resolveValue(cls.features[0], '1,5'), { values: ['1.5'] })
  assert.deepEqual(resolveValue({ type: 'Range', values: [] }, '10 - 20'), { values: ['10', '20'] })
  assert.deepEqual(resolveValue(cls.features[2], 'red'), { values: ['EV000123'] })
  assert.equal(resolveValue(cls.features[2], 'lila'), null)
})

test('Bedingung „leer → 0, sonst 1“ auf ein Ja/Nein-Merkmal: ohne Wert false, mit irgendetwas true (Taloan, 22.09.)', async () => {
  const steps = [{ op: 'when', test: 'empty', then: '0', else: '1' }]
  const m = { EF003105: { to: 'tastatur_name', steps } }
  const c = { code: 'EC1', name: {}, features: [{ code: 'EF003105', type: 'Logical', name: { de: 'Numerische Tastatur' }, values: [] }] }
  const cfg = { classAttr: 'etim_class', map: m, unknownAs: 'UN', getClass: async () => c }
  const none = await featuresOf({ attr: { etim_class: { value: 'EC004718' } } }, cfg)          // Attribut fehlt ganz
  const empty = await featuresOf({ attr: { etim_class: { value: 'EC004718' }, tastatur_name: null } }, cfg)
  const some = await featuresOf({ attr: { etim_class: { value: 'EC004718' }, tastatur_name: { value: '212', raw: '212' } } }, cfg)
  assert.equal(none.features[0].value, 'false'); assert.equal(empty.features[0].value, 'false'); assert.equal(some.features[0].value, 'true')
  assert.equal(none.filled, 1, 'die Kette macht aus leer einen Wert — gefüllt')
})
