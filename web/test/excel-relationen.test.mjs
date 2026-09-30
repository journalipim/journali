// Relationen im Excel-Export (30.09.2026): das Blatt „Relationen“ hat eine Zeile je Relation; der Tabellenimport liest es wieder
// und legt die Relationen nach den Knoten an — auch in einem anderen System, in dem die Knoten neue Ids bekommen.
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import * as X from '../../plugins/excel/xlsx.mjs'
import excel from '../../plugins/excel/entry.js'
import { polish } from '../../plugins/excel/polish.mjs'
import { build, workbook, relationenTabelle } from '../../plugins/table/core.mjs'
import { plan as makePlan } from '../src/mapper.js'
import { istRelationenBlatt, trenne, planRelationen, bestandLaden } from '../src/relationen-import.js'

const RELATIONEN = {
  p1: [{ id: 'r-1', type: 'component', direction: 'out', label: 'Bestandteil', other: { id: 'p2', label: 'Vitamin C' }, values: { gehalt: { value: '20000', unit: 'g' }, stufe: [{ locale: 'de', value: 'hoch' }, { locale: 'en', value: 'high' }] } }],
  p2: [{ id: 'r-1', type: 'component', direction: 'in', label: 'verbaut in', other: { id: 'p1', label: 'Tablette' }, values: { gehalt: { value: '20000', unit: 'g' } } }],
}
const MODELL = {
  masterLocale: 'de', locales: [{ code: 'de' }, { code: 'en' }],
  attributes: [
    { key: 'sku', type: 'text', unique: true, group: 'master' },
    { key: 'name', type: 'text', group: 'master' },
    { key: 'gehalt', type: 'decimal', unit: 'g', group: 'naehr' },
    { key: 'stufe', type: 'text', perLocale: true, group: 'naehr' },
  ],
  groups: [], lists: [], views: [], units: [],
  relationTypes: [{ key: 'component', label: { de: 'Bestandteil' }, reverse: { de: 'verbaut in' }, symmetric: false }],
}
const ZEILEN = [
  { row: { id: 'p1', role: 'product', parent: 'g1', label: 'Tablette', status: 'draft', axisValues: {} }, values: { name: { value: 'Tablette', own: true } } },
  { row: { id: 'p2', role: 'product', parent: 'g1', label: 'Vitamin C', status: 'draft', axisValues: {} }, values: { name: { value: 'Vitamin C', own: true } } },
]
function antwort(p) {
  if (/\/relations\/tree/.test(p)) return RELATIONEN
  if (/\/table\?/.test(p)) return { columns: [{ key: 'name', type: 'text', label: { de: 'Name' }, perLocale: false }], rows: ZEILEN }
  if (/\/api\/tree/.test(p)) return [{ id: 'g1', parent: null, role: 'group', label: 'Mittel' }, { id: 'p1', parent: 'g1', role: 'product', label: 'Tablette' }, { id: 'p2', parent: 'g1', role: 'product', label: 'Vitamin C' }]
  if (/\/api\/model/.test(p)) return { masterLocale: 'de', locales: [{ code: 'de' }], views: [] }
  return {}
}
const api = { get: async p => antwort(p) }

async function tabelle() {
  const t = await build({ api, model: { views: [] } }, { root: 'g1', locales: ['de'], relations: true })
  return t
}

test('das Blatt hat eine Zeile je Relation, ausgehend gezählt, mit Wert, Einheit und Sprache', async () => {
  const r = relationenTabelle([await tabelle()])
  assert.deepEqual(r.columns.map(c => c.key), ['journali_von', 'journali_von_name', 'journali_typ', 'journali_nach', 'journali_nach_name', 'gehalt', 'gehalt_einheit', 'stufe_de', 'stufe_en'])
  assert.equal(r.rows.length, 1, 'die eingehende Seite am Vitamin C ist dieselbe Relation')
  assert.deepEqual(r.rows[0], ['p1', 'Tablette', 'component', 'p2', 'Vitamin C', '20000', 'g', 'hoch', 'high'])
})

test('ohne Relationen gibt es kein Blatt', async () => {
  const t = await tabelle(); delete t.relations
  assert.equal(relationenTabelle([t]), null)
})

test('mehrere Wurzeln ergeben ein Blatt, eine Relation steht nur einmal', async () => {
  const t = await tabelle()
  assert.equal(relationenTabelle([t, t]).rows.length, 1)
})

test('eine Relation, die von ausserhalb des Teilbaums kommt, fehlt', async () => {
  const t = await tabelle()
  t.relations = { fremd: [{ id: 'r-9', type: 'component', direction: 'out', other: { id: 'p1', label: 'Tablette' }, values: {} }] }
  assert.equal(relationenTabelle([t]), null)
})

test('Excel-Datei: Blatt Daten und Blatt Relationen, mit Politur wieder lesbar', async () => {
  const t = await tabelle(); const rel = relationenTabelle([t])
  const wb = workbook(X, t, null, 'Daten', rel)
  assert.deepEqual(wb.SheetNames, ['Daten', 'Relationen'])
  const roh = X.write(wb, { type: 'array', bookType: 'xlsx' })
  const blob = await polish(roh, { columns: t.columns, rowCount: t.rows.length, tableName: 'Daten', relationen: { columns: rel.columns, rowCount: rel.rows.length } })
  const gelesen = X.read(await blob.arrayBuffer(), { type: 'array' })
  assert.deepEqual(gelesen.SheetNames, ['Daten', 'Relationen'])
  // der Importer der Oberfläche liest beide Blätter; das Relationenblatt behält seine Spaltenköpfe
  const base = new URL('../../plugins/excel/', import.meta.url).href
  const { sheets } = await excel.importers[0].parse({ arrayBuffer: async () => await blob.arrayBuffer() }, { plugin: { base } })
  assert.deepEqual(sheets.map(b => b.name), ['Daten', 'Relationen'])
  assert.deepEqual(sheets[1].columns, rel.columns.map(c => c.key))
  assert.equal(sheets[1].rows[0][0], 'p1')
  assert.equal(trenne({ sheets }).relationen.name, 'Relationen')
})

test('trenne: das Relationenblatt wird erkannt und vom Rest getrennt', async () => {
  const t = await tabelle(); const rel = relationenTabelle([t])
  const daten = { name: 'Daten', columns: t.columns.map(c => c.key), rows: t.rows }
  const blatt = { name: 'Relationen', columns: rel.columns.map(c => c.key), rows: rel.rows }
  assert.equal(istRelationenBlatt(blatt), true)
  assert.equal(istRelationenBlatt(daten), false)
  const r = trenne({ sheets: [daten, blatt] })
  assert.deepEqual(r.blaetter.map(b => b.name), ['Daten'])
  assert.equal(r.relationen.name, 'Relationen')
})

// ---- Import: Ziel ist ein anderes System, in dem es die Knoten der Datei noch nicht gibt
function baum(rows) {
  const byId = new Map(rows.map(r => [r.id, r]))
  const ancestors = id => { const aus = []; for (let n = byId.get(id)?.parent ? byId.get(byId.get(id).parent) : null; n; n = n.parent ? byId.get(n.parent) : null) aus.unshift(n); return aus }
  return { rows, byId, ancestors, kids: id => rows.filter(r => r.parent === id) }
}
async function dateiBlaetter() {
  const t = await tabelle(); const rel = relationenTabelle([t])
  return {
    daten: { columns: t.columns.map(c => c.key), rows: t.rows },
    relationen: { name: 'Relationen', columns: rel.columns.map(c => c.key), rows: rel.rows },
  }
}
function planKnoten(daten, tree, target) {
  const mapping = daten.columns.map(c => /^journali_id_/.test(c) ? { column: c, target: 'id', root: 'g1' } : c === 'name' ? { column: c, target: 'attr', attribute: 'name' } : { column: c, target: 'skip' })
  return makePlan({ columns: daten.columns, rows: daten.rows, mapping, model: MODELL, tree, target, role: 'product', existing: new Map(), external: null })
}

test('Import in ein anderes System: die Relation hängt an den neu angelegten Knoten, mit Wert und Sprache', async () => {
  const { daten, relationen } = await dateiBlaetter()
  const tree = baum([{ id: 'z1', parent: null, label: 'Ziel', role: 'group', keys: {} }])
  const p = planKnoten(daten, tree, tree.byId.get('z1'))
  assert.equal(p.stats.create, 2)
  const rp = planRelationen({ blatt: relationen, model: MODELL, tree, ids: p.ids })
  assert.deepEqual(rp.stats.problems, [])
  assert.equal(rp.stats.create, 1)
  const [neu, ...werte] = rp.commands
  assert.equal(neu.op, 'relation.create')
  assert.ok(neu.args.from.startsWith('@') && neu.args.to.startsWith('@') && neu.args.from !== neu.args.to, 'beide Enden sind Verweise auf neue Knoten')
  assert.deepEqual(werte.map(c => [c.op, c.args.relation, c.args.attribute, c.args.locale ?? null, c.args.value]), [
    ['relation.attribute.set', '@' + neu.ref, 'gehalt', null, '20000'],
    ['relation.attribute.set', '@' + neu.ref, 'stufe', 'de', 'hoch'],
    ['relation.attribute.set', '@' + neu.ref, 'stufe', 'en', 'high'],
  ])
})

test('Import ins selbe System: dieselbe Relation ist unverändert, ein anderer Wert wird gesetzt', async () => {
  const { daten, relationen } = await dateiBlaetter()
  const tree = baum([{ id: 'g1', parent: null, label: 'Mittel', role: 'group', keys: {} }, { id: 'p1', parent: 'g1', label: 'Tablette', role: 'product', keys: {} }, { id: 'p2', parent: 'g1', label: 'Vitamin C', role: 'product', keys: {} }])
  const p = planKnoten(daten, tree, tree.byId.get('g1'))
  const bestand = await bestandLaden(api, relationen, p.ids, tree)
  assert.equal(bestand.size, 1)
  let rp = planRelationen({ blatt: relationen, model: MODELL, tree, ids: p.ids, bestand })
  assert.deepEqual([rp.stats.create, rp.stats.update, rp.stats.unchanged, rp.commands.length], [0, 0, 1, 0])
  const geaendert = { ...relationen, rows: relationen.rows.map(r => r.map((v, i) => relationen.columns[i] === 'gehalt' ? '5000' : v)) }
  rp = planRelationen({ blatt: geaendert, model: MODELL, tree, ids: p.ids, bestand })
  assert.deepEqual([rp.stats.create, rp.stats.update], [0, 1])
  assert.deepEqual(rp.commands.map(c => [c.op, c.args.relation, c.args.attribute, c.args.value]), [['relation.attribute.set', 'r-1', 'gehalt', '5000']])
})

test('was es nicht gibt, wird gemeldet und übergangen, der Rest bleibt', async () => {
  const { relationen } = await dateiBlaetter()
  const tree = baum([{ id: 'z1', parent: null, label: 'Ziel', role: 'group', keys: {} }])
  const zeilen = [relationen.rows[0], relationen.rows[0].map((v, i) => relationen.columns[i] === 'journali_typ' ? 'gibtsnicht' : v)]
  const rp = planRelationen({ blatt: { ...relationen, rows: zeilen }, model: MODELL, tree, ids: new Map([['p1', 'z1']]) })
  assert.equal(rp.stats.skipped, 2)
  assert.match(rp.stats.problems[0], /Zeile 2: das Ziel p2 gibt es hier nicht/)
  assert.match(rp.stats.problems[1], /Zeile 3: Relationstyp gibtsnicht gibt es nicht/)
  assert.equal(rp.commands.length, 0)
})

test('ein Wert, der nicht zum Typ passt, wird gemeldet und nicht geschrieben', async () => {
  const { relationen } = await dateiBlaetter()
  const tree = baum([{ id: 'z1', parent: null, label: 'Ziel', role: 'group', keys: {} }])
  const falsch = { ...relationen, rows: relationen.rows.map(r => r.map((v, i) => relationen.columns[i] === 'gehalt' ? 'viel' : v)) }
  const rp = planRelationen({ blatt: falsch, model: MODELL, tree, ids: new Map([['p1', 'z1'], ['p2', 'z1x']]) })
  assert.equal(rp.stats.invalid.length, 1)
  assert.equal(rp.stats.invalid[0].key, 'gehalt')
  assert.ok(!rp.commands.some(c => c.args.attribute === 'gehalt'))
})

// ---- Job: derselbe Export, als Prozess gegen einen Server
test('Export-Job excel mit relations: die Datei hat das Blatt Relationen', async () => {
  const server = http.createServer((req, res) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(antwort(req.url))) })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'excel-rel-'))
  const job = fileURLToPath(new URL('../../plugins/excel/export-job.mjs', import.meta.url))
  const laufen = relations => new Promise(resolve => {
    const p = spawn(process.execPath, [job], { env: { ...process.env, JOURNALI_JOURNALI: `http://127.0.0.1:${server.address().port}`, JOURNALI_ROOT: 'g1', JOURNALI_DIR: dir, JOURNALI_RELATIONS: relations } })
    let aus = ''; p.stdout.on('data', d => { aus += d }); p.stderr.on('data', d => { aus += d }); p.on('close', code => resolve({ code, aus }))
  })
  try {
    let r = await laufen('true'); assert.equal(r.code, 0, r.aus)
    let datei = fs.readdirSync(dir).find(f => f.endsWith('.xlsx'))
    let wb = X.read(fs.readFileSync(path.join(dir, datei)), { type: 'buffer' })
    assert.deepEqual(wb.SheetNames, ['Daten', 'Relationen'])
    assert.equal(X.utils.sheet_to_json(wb.Sheets.Relationen, { header: 1 })[1][0], 'p1')
    fs.rmSync(path.join(dir, datei))
    r = await laufen('false'); assert.equal(r.code, 0, r.aus)
    datei = fs.readdirSync(dir).find(f => f.endsWith('.xlsx'))
    wb = X.read(fs.readFileSync(path.join(dir, datei)), { type: 'buffer' })
    assert.deepEqual(wb.SheetNames, ['Daten'], 'ohne den Schalter bleibt die Datei wie bisher')
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }) }
})
