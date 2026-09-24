// Vorlagen-Export auf einem Publikationsbaum — Kern ohne DOM
import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from '../../plugins/xport/core.mjs'

const model = { attributes: [{ key: 'name', type: 'text', label: { de: 'Name' } }, { key: 'etim_class', type: 'text', label: { de: 'ETIM' } }], lists: [] }
const rows = [
  { id: 'g-1', role: 'group', label: 'Pflege', parent: null }, { id: 'p-1', role: 'product', label: 'Laptop A', parent: 'g-1', keys: { sku: 'A' } }, { id: 'p-2', role: 'product', label: 'Laptop B', parent: 'g-1', keys: { sku: 'B' } },
  { id: 'v-1', role: 'variant', label: 'A rot', parent: 'p-1' },
]
const tree = { rows, byId: new Map(rows.map(r => [r.id, r])), kids: id => rows.filter(r => (r.parent ?? '') === (id ?? '')) }
const pubExport = { tree: { id: 'r-root', channel: 'bmecat', market: 'DE', label: 'Katalog 2026' }, in: 1, out: 1, rows: [
  { path: [{ id: 'r-root', role: 'rubric', label: 'Katalog 2026' }, { id: 'r-1', role: 'rubric', label: 'Notebooks' }], product: { id: 'p-1', label: 'Laptop A', keys: { sku: 'A' } }, in: true, why: [], variants: [{ id: 'v-1', label: 'A rot', in: true, why: [] }] },
  { path: [{ id: 'r-root', role: 'rubric', label: 'Katalog 2026' }, { id: 'r-1', role: 'rubric', label: 'Notebooks' }, { id: '', role: 'value', label: 'Business' }], product: { id: 'p-2', label: 'Laptop B', keys: { sku: 'B' } }, in: false, why: ['keine Freigabe für bmecat'], variants: [] },
] }
const api = { get: async path => {
  if (path.startsWith('/api/pub/r-root/export')) return pubExport
  if (/^\/api\/nodes\/[^/]+\/relations/.test(path)) return { out: [], inherited: [] }
  if (/^\/api\/nodes\/[^/?]+$/.test(path)) { const id = decodeURIComponent(path.slice(11)); return { id, role: tree.byId.get(id)?.role, values: [{ attribute: 'name', value: tree.byId.get(id)?.label }, { attribute: 'etim_class', value: 'EC004718' }], ancestors: [], groups: [], computed: [] } }
  throw new Error('unerwartet: ' + path)
} }

test('Publikationsbaum: nur Ausgeleitetes, Rubriken als Kataloggruppen, parentId zeigt auf die Rubrik', async () => {
  const featuresOf = async pctx => ({ classCode: 'EC004718', known: true, features: [], filled: 3, total: 4, completeness: 75 })
  const cx = await build({ api, model, tree, featuresOf }, { pub: 'r-root', role: 'product', locale: 'de' })
  assert.equal(cx.count, 1); assert.equal(cx.products[0].id, 'p-1')
  assert.equal(cx.products[0].parentId, 'r-1'); assert.equal(cx.products[0].pathText, 'Katalog 2026 / Notebooks')
  assert.deepEqual(cx.groups.map(g => [g.id, g.parent, g.type]), [['r-root', null, 'root'], ['r-1', 'r-root', 'node'], ['v-business', 'r-1', 'leaf']])
  assert.equal(cx.stats.held, 1); assert.equal(cx.stats.classified, 1); assert.equal(cx.stats.completeness, 75)
  assert.equal(cx.rootName, 'Katalog 2026'); assert.equal(cx.pub.channel, 'bmecat')
})

test('Publikationsbaum mit Rolle Variante: die ausgeleiteten Varianten', async () => {
  const cx = await build({ api, model, tree }, { pub: 'r-root', role: 'variant', locale: 'de' })
  assert.deepEqual(cx.products.map(p => p.id), ['v-1']); assert.equal(cx.products[0].parentId, 'r-1')
})

test('Teilbaum wie bisher: Pflegegruppen als Kataloggruppen; die Sperre nennt den Knoten', async () => {
  const cx = await build({ api, model, tree }, { root: 'g-1', role: 'product', locale: 'de' })
  assert.deepEqual(cx.products.map(p => p.id), ['p-1', 'p-2']); assert.equal(cx.products[0].parentId, 'g-1')
  await assert.rejects(build({ api, model, tree, gate: async p => p.id === 'p-2' ? 'Vollständigkeit 0 % unter 60 %' : null }, { root: 'g-1', role: 'product', locale: 'de' }), /Laptop B \(B\): Vollständigkeit 0 %/)
})
