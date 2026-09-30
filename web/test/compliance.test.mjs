// Prüfkern der Datenanalyse: die Fälle, die in der Bedienung schiefgingen.
// Läuft ohne Browser und ohne Server: `npm test` in web/ (node --test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyze, resolvePlaceholders } from '../src/compliance-core.js'
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

// Baum: Gruppe „HP EliteBook“ → Produkt „HP EliteBook 6 G1q“ → Variante. Geprüft wird am Produkt (erste Zeile = es selbst).
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

// ── Platzhalter im Wert: {key} wird durch den Wert des Ziel-Attributs am selben Knoten ersetzt
// (mit Vererbung, so wie r.values das Attribut fuehrt). Rekursiv, mit Zyklus-Schutz.

test('resolvePlaceholders: kein Platzhalter → der Text unveraendert', () => {
  assert.equal(resolvePlaceholders('WAKOL Sealing', { name: { value: 'X' } }), 'WAKOL Sealing')
  assert.equal(resolvePlaceholders('', {}), '')
  assert.equal(resolvePlaceholders(null, {}), null)
})

test('resolvePlaceholders: ein Platzhalter → der Wert am Knoten', () => {
  assert.equal(resolvePlaceholders('{name}', { name: { value: 'EliteBook' } }), 'EliteBook')
})

test('resolvePlaceholders: mehrere Platzhalter mit Literalen dazwischen', () => {
  const v = { name: { value: 'EliteBook' }, sku: { value: 'A1' } }
  assert.equal(resolvePlaceholders('{name} · {sku}', v), 'EliteBook · A1')
})

test('resolvePlaceholders: leeres Ziel → der Platzhalter wird nichts, der Rest bleibt', () => {
  const v = { name: { value: 'EliteBook' }, sku: { value: '' } }
  assert.equal(resolvePlaceholders('{name} · {sku}', v), 'EliteBook · ')
})

test('resolvePlaceholders: verschachtelter Platzhalter (Ziel enthaelt selbst {key})', () => {
  const v = { a: { value: '{b}' }, b: { value: 'X' } }
  assert.equal(resolvePlaceholders('{a}', v), 'X')
})

test('resolvePlaceholders: Zyklus (a → b → a) → null', () => {
  const v = { a: { value: '{b}' }, b: { value: '{a}' } }
  assert.equal(resolvePlaceholders('{a}', v), null)
})

test('resolvePlaceholders: Selbst-Referenz (a → a) → null', () => {
  const v = { a: { value: '{a}' } }
  assert.equal(resolvePlaceholders('{a}', v), null)
})

test('resolvePlaceholders: nicht existierendes Ziel → nichts (wie ein leeres Ziel)', () => {
  assert.equal(resolvePlaceholders('vor {fehlt} nach', {}), 'vor  nach')
})

test('resolvePlaceholders: leere Klammern {} bleiben unangetastet', () => {
  assert.equal(resolvePlaceholders('a{}b', {}), 'a{}b')
})

test('analyze: dpp_handelsname = {name} → aufgeloest zum Namen des Knotens (state ok)', () => {
  const m = { ...mapping }
  const rowsMitTpl = [
    { row: product, values: V({ name: 'EliteBook', ean: '4000000000006', sku: 'A1' }) },
    { row: variant, values: V({ name: 'EliteBook 16', dpp_batch: 'L1' }) },
  ]
  // Der 'name'-Wert im Modell existiert; das Mapping trade_name → name gilt.
  // Wir setzen jetzt einen Wert auf 'name' der ein Platzhalter ist: das Attribut, das den Wert traegt, ist name selbst.
  // Ein direktes Beispiel: das Attribut 'name' hat den Wert '{sku}' → aufgeloest = 'A1'.
  const rowsRef = [
    { row: product, values: V({ name: '{sku}', sku: 'A1', ean: '4000000000006' }) },
  ]
  const res = analyze({ catalog: dpp, mapping: m, model, rows: rowsRef, scopeAttr: 'dpp_scope' })
  const node = res.nodes.find(n => n.row.id === 'p-1')
  // trade_name ist auf 'name' gemappt; 'name' = '{sku}' → 'A1' → also ok
  assert.equal(node.states['trade_name'], 'ok')
})

test('analyze: Wert ist reiner Platzhalter, Ziel leer → state empty', () => {
  const m = { ...mapping }
  const rowsRef = [
    { row: product, values: V({ name: '{sku}', sku: '', ean: '4000000000006' }) },
  ]
  const res = analyze({ catalog: dpp, mapping: m, model, rows: rowsRef, scopeAttr: 'dpp_scope' })
  const node = res.nodes.find(n => n.row.id === 'p-1')
  assert.equal(node.states['trade_name'], 'empty')
})
