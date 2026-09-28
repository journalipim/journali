// Datenblatt (28.09.2026): eine Vorlage ist wie eine Formel ein berechnetes Attribut. Das Blatt zeigte
// „{name} mit {cpu}[, {ram} GB RAM]“ statt „PCI 20 MINI Q211 mit · 0,1 kg“, weil nur Formeln aus computed gelesen wurden.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { dataOf } from '../../plugins/datasheet/entry.js'

const MODEL = { masterLocale: 'de', locales: [{ code: 'de' }], lists: [], groups: [],
  attributes: [
    { key: 'name', label: { de: 'Name' }, type: 'text', perLocale: true },
    { key: 'zusgesbez', label: { de: 'ZusGesBez' }, type: 'template', perLocale: true },
    { key: 'summe', label: { de: 'Summe' }, type: 'formula' },
    { key: 'weight', label: { de: 'Gewicht' }, type: 'decimal', unit: 'kg' },
  ] }
const KNOTEN = { id: 'p1', role: 'product', label: {}, axisValues: {}, groups: [], ancestors: [], children: 0,
  values: [
    { attribute: 'name', locale: 'de', value: 'PCI 20 MINI Q211' },
    { attribute: 'zusgesbez', locale: 'de', value: '{name} mit {cpu}[ · {weight|1|unit}]' },   // das Skript der Vorlage
    { attribute: 'weight', value: '0.1' },
  ],
  computed: [{ attribute: 'zusgesbez', locale: 'de', value: 'PCI 20 MINI Q211 mit · 0,1 kg' }, { attribute: 'summe', locale: null, value: '42' }] }

test('eine Vorlage geht mit ihrem Ergebnis ins Blatt, nicht mit ihrem Skript — wie eine Formel', async () => {
  const ctx = { store: { model: MODEL }, tree: { byId: new Map([['p1', { id: 'p1', role: 'product', label: 'PCI 20 MINI Q211', parent: null }]]), ancestors: () => [], kids: () => [] },
    api: { get: async url => /\/relations$/.test(url) ? { out: [] } : /\/api\/nodes\/p1$/.test(url) ? KNOTEN : {} } }
  const d = await dataOf(ctx, 'p1', 'de')
  assert.equal(d.attr.zusgesbez, 'PCI 20 MINI Q211 mit · 0,1 kg')
  assert.equal(d.attr.summe, '42')
  assert.equal(d.attr.name, 'PCI 20 MINI Q211')
})
