// Prüfkern der Datenanalyse: die Fälle, die in der Bedienung schiefgingen (Taloan, 21.09.: „dafür bist du da — Use Cases durchtesten“).
// Läuft ohne Browser und ohne Server: `npm test` in web/ (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyze } from '../src/compliance-core.js'
import dpp from '../../plugins/dpp/catalog.js'

// Modell: die Attribute, die die Zuordnung braucht, dazu das Geltungsattribut dpp_scope (vererbbar, Gruppe dpp)
const model = {
  attributes: [
    { key: 'ean', type: 'text', group: 'mastergroup' }, { key: 'sku', type: 'text', group: 'mastergroup' }, { key: 'name', type: 'text', group: 'mastergroup' },
    { key: 'dpp_batch', type: 'text', group: 'dpp' }, { key: 'akku_typ', type: 'text', group: 'physical' }, { key: 'dpp_battery_capacity', type: 'decimal', group: 'dpp' },
    { key: 'dpp_scope', type: 'enum', multiple: true, inheritable: true, group: 'dpp' },
  ],
  lists: [], units: [],
}
const mapping = { gtin: { to: 'ean' }, model_number: { to: 'sku' }, trade_name: { to: 'name' }, batch: { to: 'dpp_batch' }, battery_chemistry: { to: 'akku_typ' }, battery_capacity: { to: 'dpp_battery_capacity' } }
const V = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'object' && v !== null ? v : { value: v }]))

// Baum wie bei Taloan: Gruppe „HP EliteBook“ → Produkt „HP EliteBook 6 G1q“ → Variante. Geprüft wird am Produkt (erste Zeile = es selbst).
const product = { id: 'p-1', role: 'product', label: 'HP EliteBook 6 G1q', parent: 'g-1' }
const variant = { id: 'v-1', role: 'variant', label: 'HP EliteBook 6 G1q · 16 GB', parent: 'p-1' }
const rows = (scope, extra = {}) => [
  { row: product, values: V({ ean: '4000000000006', sku: 'A1', name: 'EliteBook', ...(scope ? { dpp_scope: { value: scope, from: 'g-1' } } : {}), ...extra.product }) },
  { row: variant, values: V({ ean: '4000000000013', sku: 'A1-16', name: 'EliteBook 16', ...(scope ? { dpp_scope: { value: scope, from: 'g-1' } } : {}), ...extra.variant }) },
]
const run = (r, o = {}) => analyze({ catalog: dpp, mapping, model, rows: r, scopeAttr: 'dpp_scope', ...o })
const st = (res, id, key) => res.nodes.find(n => n.row.id === id).states[key]

test('Batteriepass am Vater gesetzt (geerbt) → Batterie-Datenpunkte gelten am Produkt und an der Variante, nicht „gilt hier nicht“', () => {
  const res = run(rows('battery'))
  assert.equal(st(res, 'p-1', 'battery_chemistry'), 'empty')
  assert.equal(st(res, 'v-1', 'battery_chemistry'), 'empty')
  assert.equal(st(res, 'v-1', 'battery_capacity'), 'empty')
  assert.equal(res.byItem.get('battery_chemistry').na, 0)
})

test('Batteriepass nicht gesetzt → Batterie-Datenpunkte „gilt nicht“ (na) an allen Knoten — die Zahl „leer“ bleibt 0', () => {
  const res = run(rows(null))
  assert.equal(st(res, 'p-1', 'battery_chemistry'), 'na')
  assert.equal(res.byItem.get('battery_chemistry').na, res.nodes.length)
  assert.equal(res.byItem.get('battery_chemistry').empty, 0)
})

test('Name sagt nichts: „Akku-Pack“ ohne Geltung gilt nicht, „EliteBook“ mit Geltung gilt — allein die Entscheidung des Anwenders zählt', () => {
  const akku = [{ row: { ...product, label: 'Akku-Pack 2 kWh' }, values: V({ ean: '4000000000006' }) }]
  assert.equal(st(run(akku), 'p-1', 'battery_chemistry'), 'na')
  const res = run(rows('battery'))
  assert.equal(st(res, 'p-1', 'battery_chemistry'), 'empty')
})

test('Geltung als Liste („battery, hazmat“) — der Eintrag zählt, nicht der ganze String', () => {
  const res = run(rows('hazmat, battery'))
  assert.equal(st(res, 'p-1', 'battery_chemistry'), 'empty')
  assert.equal(st(run(rows('hazmat')), 'p-1', 'battery_chemistry'), 'na')
})

test('Rollen: Charge/Los gilt nur an der Variante — am Produkt na, an der Variante leer', () => {
  const res = run(rows(null))
  assert.equal(st(res, 'p-1', 'batch'), 'na')
  assert.equal(st(res, 'v-1', 'batch'), 'empty')
})

test('angefragt (⏳): leer mit Beleg pending zählt als pending, nicht als leer; Wiedervorlage in der Vergangenheit = überfällig', () => {
  const res = run(rows(null, { variant: { dpp_batch: { value: null, source: { method: 'pending', source: 'herbert', checkedAt: '2026-10-04' } } } }), { today: '2026-09-21' })
  assert.equal(st(res, 'v-1', 'batch'), 'pending')
  assert.equal(res.byItem.get('batch').pending, 1)
  assert.equal(res.byItem.get('batch').empty, 0)
  assert.equal(res.nodes.find(n => n.row.id === 'v-1').overdue, undefined)
  const late = run(rows(null, { variant: { dpp_batch: { value: null, source: { method: 'pending', source: 'herbert', checkedAt: '2026-10-04' } } } }), { today: '2026-10-05' })
  assert.equal(late.nodes.find(n => n.row.id === 'v-1').overdue, 1)
})

test('Wert gefüllt → ok; Wert eingetragen, obwohl angefragt → ok (der Wert schlägt die Anfrage)', () => {
  const res = run(rows(null, { variant: { dpp_batch: { value: 'L-2026-09', source: { method: 'pending', source: 'herbert' } } } }))
  assert.equal(st(res, 'v-1', 'batch'), 'ok')
})

test('falscher Wert (GTIN-Prüfziffer) → bad mit Meldung', () => {
  const res = run(rows(null, { variant: { ean: '4000000000019' } }))
  assert.equal(st(res, 'v-1', 'gtin'), 'bad')
  assert.ok(res.nodes.find(n => n.row.id === 'v-1').findings.some(f => f.item.key === 'gtin'))
})

test('Produkt mit Varianten: leer am Produkt, aber alle Varianten belegt → ↓ below (zählt als erfüllt)', () => {
  const res = run(rows(null, { product: { ean: null } }))
  assert.equal(st(res, 'p-1', 'gtin'), 'below')
  const p = res.nodes.find(n => n.row.id === 'p-1'); assert.ok(p.mustOk >= 1)   // ↓ zählt als erfüllt in der Pflicht-Quote
})

test('Gruppe fehlt am Pfad (⊘): nur dann „anhängen“ vorschlagen, wenn ⊘ bleibt und die Gruppe wirklich an keinem Knoten des Pfads hängt', () => {
  const r = rows(null, { variant: { ean: null } }); r[1].inactive = ['ean']
  const notOnPath = run(r, { onPath: () => false })
  assert.equal(st(notOnPath, 'v-1', 'gtin'), 'inactive')
  assert.deepEqual([...notOnPath.inactiveGroups], ['mastergroup'])
  const onPath = run(r, { onPath: () => true })
  assert.equal(st(onPath, 'v-1', 'gtin'), 'inactive')
  assert.deepEqual([...onPath.inactiveGroups], [])   // Gruppe hängt schon — anhängen hilft nicht, also nicht vorschlagen
  // ⊘ am Produkt, aber alle Varianten belegt → ↓, und keine Gruppe vorgeschlagen
  const r2 = rows(null, { product: { ean: null } }); r2[0].inactive = ['ean']
  const below = run(r2, { onPath: () => false })
  assert.equal(st(below, 'p-1', 'gtin'), 'below')
  assert.deepEqual([...below.inactiveGroups], [])
})

test('ohne Zuordnung → unmapped, in unmapped gelistet, zählt in keiner Spalte', () => {
  const res = analyze({ catalog: dpp, mapping: { gtin: { to: 'ean' } }, model, rows: rows(null), scopeAttr: 'dpp_scope' })
  assert.equal(st(res, 'v-1', 'trade_name'), 'unmapped')
  assert.ok(res.unmapped.some(it => it.key === 'trade_name'))
  assert.equal(Object.values(res.byItem.get('trade_name')).reduce((a, b) => a + b, 0), 0)
})

test('Pflicht-Quote: nur Pflicht-Datenpunkte zählen; na zählt nicht mit', () => {
  const res = run(rows(null))
  const p = res.nodes.find(n => n.row.id === 'p-1')
  assert.ok(p.must > 0 && p.mustOk <= p.must)
  assert.equal(p.score, Math.round(p.mustOk / p.must * 100))
})
