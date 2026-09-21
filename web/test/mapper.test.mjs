// Datenmapper: Vorschlag je Spalte — Fälle aus der Bedienung (Taloan, 21.09.: Re-Import des eigenen Exports); sku ist eindeutig (unique) und
// findet damit vorhandene Knoten — wie jedes andere eindeutige Attribut (Taloan: „alles über eindeutig“)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { suggest } from '../src/mapper.js'

const model = { masterLocale: 'de', locales: [{ code: 'de' }, { code: 'en' }], attributes: [{ key: 'sku', label: { de: 'SKU' }, type: 'text', unique: true }, { key: 'name', label: { de: 'Name' }, type: 'text', perLocale: true }] }

test('Spalte „parent“ voller Ids ist der Vater, nicht doppelt zur Id', () => {
  const columns = ['id', 'role', 'parent', 'sku', 'name_de']
  const rows = [['v-62e2b198', 'variant', 'p-c7f43467', '053735', 'HP PB 4'], ['v-87860183', 'variant', 'p-c7f43467', '053736', 'HP PB 4 G1i']]
  const m = suggest(columns, rows, model)
  assert.equal(m[0].target, 'id')
  assert.equal(m[1].target, 'skip'); assert.match(m[1].why, /Exportspalte/)
  assert.equal(m[2].target, 'parent'); assert.notEqual(m[2].why, 'doppelt')
  assert.equal(m[3].target, 'attr'); assert.equal(m[3].attribute, 'sku')
  assert.equal(m[4].target, 'attr'); assert.equal(m[4].attribute, 'name'); assert.equal(m[4].locale, 'de')
})

test('journali_root: Id zählt nur unter derselben Wurzel — sonst ist die Zeile neu', async () => {
  const { plan } = await import('../src/mapper.js')
  const rows = [['v-1', 'variant', 'p-1', 'g-1', 'A1', 'Neu'], ['v-2', 'variant', 'p-1', 'g-FREMD', 'A2', 'Fremd']]
  const columns = ['id', 'role', 'parent', 'journali_root', 'sku', 'name_de']
  const treeRows = [{ id: 'g-1', role: 'group', label: 'G' }, { id: 'p-1', role: 'product', parent: 'g-1', label: 'P', axes: [] }, { id: 'v-1', role: 'variant', parent: 'p-1', label: 'V1', axisValues: {} }, { id: 'v-2', role: 'variant', parent: 'p-1', label: 'V2', axisValues: {} }]
  const byId = new Map(treeRows.map(r => [r.id, r]))
  const tree = { rows: treeRows, byId, ancestors: id => { const out = []; for (let p = byId.get(id)?.parent; p; p = byId.get(p)?.parent) out.unshift(byId.get(p)); return out } }
  const m = suggest(columns, rows, model)
  assert.equal(m[3].target, 'root')
  const p = plan({ columns, rows, mapping: m, model, tree, target: byId.get('p-1'), role: 'variant', existing: new Map() })
  assert.equal(p.stats.update, 1)   // v-1 unter g-1: gefunden
  assert.equal(p.stats.create, 1)   // v-2 unter fremder Wurzel: neu, nicht v-2 hier überschreiben
})

test('journali_<feld>_<wurzel>: Wurzel aus dem Spaltenkopf, interne Spalten erkannt', () => {
  const m2 = suggest(['journali_id_g-mastertree', 'sku'], [['v-1', 'A']], model); assert.equal(m2[0].target, 'id'); assert.equal(m2[0].root, 'g-mastertree')   // Saatgut-Wurzel ohne Hex
  const columns = ['journali_id_g-1a2b3c4d', 'journali_role_g-1a2b3c4d', 'journali_parent_g-1a2b3c4d', 'sku', 'journali_label_g-1a2b3c4d', 'journali_status_g-1a2b3c4d', 'name_de']
  const rows = [['v-1', 'variant', 'p-1', 'A1', 'V1', 'draft', 'Eins']]
  const m = suggest(columns, rows, model)
  assert.equal(m[0].target, 'id'); assert.equal(m[0].root, 'g-1a2b3c4d'); assert.equal(m[0].internal, true)
  assert.equal(m[2].target, 'parent'); assert.equal(m[1].target, 'skip'); assert.equal(m[1].internal, true)
  assert.equal(m[3].attribute, 'sku'); assert.equal(m[6].attribute, 'name')
})

test('kopierte Zeilen mit versteckter Id: andere SKU → neuer Knoten, gleiche SKU → übergangen (Taloans Datei)', async () => {
  const { plan } = await import('../src/mapper.js')
  const columns = ['journali_id_g-1', 'journali_parent_g-1', 'sku', 'name_de']
  // Original steht NICHT zuerst (ausgeschnitten und als erste eingefügt): erkannt wird es über die SKU des Knotens, nicht über die Zeile
  const rows = [['v-1', 'p-1', '1', 'Kopie c1'], ['v-1', 'p-1', '053797', 'Original'], ['v-1', 'p-1', '2', 'Kopie c2'], ['v-1', 'p-1', '053797', 'echtes Duplikat']]
  const treeRows = [{ id: 'g-1', role: 'group', label: 'G' }, { id: 'p-1', role: 'product', parent: 'g-1', label: 'P', axes: [] }, { id: 'v-1', role: 'variant', parent: 'p-1', label: 'V1', keys: { sku: '053797' }, axisValues: {} }]
  const byId = new Map(treeRows.map(r => [r.id, r]))
  const tree = { rows: treeRows, byId, ancestors: id => { const out = []; for (let p = byId.get(id)?.parent; p; p = byId.get(p)?.parent) out.unshift(byId.get(p)); return out } }
  const m = suggest(columns, rows, model)
  const p = plan({ columns, rows, mapping: m, model, tree, target: null, role: null, existing: new Map([['v-1', { 'name|de': 'Original', 'name|de#own': true, 'sku|': '053797', 'sku|#own': true }]]) })
  assert.equal(p.stats.unchanged, 1)   // Original
  assert.equal(p.stats.create, 2)      // c1, c2 als neue Varianten unter p-1 (Elternteil aus der Datei)
  assert.equal(p.stats.copied, 2)
  assert.equal(p.stats.skipped, 1)     // echtes Duplikat
})

test('kopierte Zeilen, Original mit geänderter SKU: die Zeile mit den meisten gleichen Werten ist das Original', async () => {
  const { plan } = await import('../src/mapper.js')
  const columns = ['journali_id_g-1', 'journali_parent_g-1', 'sku', 'name_de']
  const rows = [['v-1', 'p-1', 'NEU-1', 'ganz anders'], ['v-1', 'p-1', 'NEU-2', 'Original']]
  const treeRows = [{ id: 'g-1', role: 'group', label: 'G' }, { id: 'p-1', role: 'product', parent: 'g-1', label: 'P', axes: [] }, { id: 'v-1', role: 'variant', parent: 'p-1', label: 'V1', keys: { sku: '053797' }, axisValues: {} }]
  const byId = new Map(treeRows.map(r => [r.id, r]))
  const tree = { rows: treeRows, byId, ancestors: id => { const out = []; for (let p = byId.get(id)?.parent; p; p = byId.get(p)?.parent) out.unshift(byId.get(p)); return out } }
  const m = suggest(columns, rows, model)
  const p = plan({ columns, rows, mapping: m, model, tree, target: null, role: null, existing: new Map([['v-1', { 'name|de': 'Original', 'name|de#own': true, 'sku|': '053797', 'sku|#own': true }]]) })
  assert.equal(p.stats.update, 1); assert.equal(p.stats.create, 1)
  assert.match(p.stats.notes[0], /Zeile 2: kopierte Zeile.*Zeile 3.*neuer Knoten/)   // Zeile 2 ist die Kopie, Zeile 3 (Name „Original“) das Original
})

test('jedes eindeutige Attribut findet den Knoten — auch matnr statt sku, und ohne Id', async () => {
  const { plan } = await import('../src/mapper.js')
  const m2 = { ...model, attributes: [...model.attributes, { key: 'matnr', label: { de: 'MATNR' }, type: 'text', unique: true }, { key: 'ean', label: { de: 'EAN' }, type: 'text' }] }
  const columns = ['matnr', 'ean', 'name_de']
  const rows = [['100', '4006', 'geändert'], ['200', '4006', 'neu']]
  const treeRows = [{ id: 'g-1', role: 'group', label: 'G' }, { id: 'p-1', role: 'product', parent: 'g-1', label: 'P', axes: [] }, { id: 'v-1', role: 'variant', parent: 'p-1', label: '100', keys: { matnr: '100', sku: 'S-1' }, axisValues: {} }]
  const byId = new Map(treeRows.map(r => [r.id, r]))
  const tree = { rows: treeRows, byId, ancestors: () => [] }
  const m = suggest(columns, rows, m2)
  assert.equal(m[0].target, 'attr'); assert.equal(m[0].attribute, 'matnr')
  const p = plan({ columns, rows, mapping: m, model: m2, tree, target: byId.get('p-1'), role: 'variant', existing: new Map([['v-1', { 'name|de': 'alt', 'name|de#own': true, 'matnr|': '100', 'matnr|#own': true }]]) })
  assert.equal(p.stats.update, 1); assert.equal(p.stats.create, 1)   // 100 gefunden über matnr, 200 neu; ean (nicht eindeutig) findet nichts
})
