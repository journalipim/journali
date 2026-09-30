// JSON-Export ausgewertet (30.09.2026): als Baum und als Liste tragen die Knoten ihre Relationen mit — ausgehend und eingehend,
// das andere Ende, die Werte. Eine Tabelle (CSV, Excel) hat dafür keine Spalte und liest sie nicht.
import test from 'node:test'
import assert from 'node:assert/strict'
import { build, toJson, toJsonTree } from '../../plugins/table/core.mjs'

const RELATIONEN = {
  p1: [{ type: 'component', direction: 'out', label: 'Bestandteil', other: { id: 'p2', label: 'Vitamin C' }, values: { gehalt: { value: '20000', unit: 'g' } } }],
  p2: [{ type: 'component', direction: 'in', label: 'verbaut in', other: { id: 'p1', label: 'Tablette' }, values: { gehalt: { value: '20000', unit: 'g' } } }],
}
function umgebung({ mitRelationen = true, fehler = false } = {}) {
  const aufrufe = []
  const api = {
    get: async p => {
      aufrufe.push(p)
      if (/\/relations\/tree/.test(p)) { if (fehler) throw new Error('404'); return mitRelationen ? RELATIONEN : {} }
      if (/\/table\?/.test(p)) return {
        columns: [{ key: 'name', type: 'text', label: { de: 'Name' }, perLocale: false }],
        rows: [
          { row: { id: 'p1', role: 'product', parent: null, label: 'Tablette', status: 'draft', axisValues: {} }, values: { name: { value: 'Tablette', own: true } } },
          { row: { id: 'p2', role: 'product', parent: 'p1', label: 'Vitamin C', status: 'draft', axisValues: {} }, values: { name: { value: 'Vitamin C', own: true } } },
        ],
      }
      if (/\/api\/tree/.test(p)) return [{ id: 'p1', parent: null }, { id: 'p2', parent: 'p1' }]
      return {}
    },
  }
  return { env: { api, model: { views: [] } }, aufrufe }
}

test('ohne relations liest build keine Relationen (Tabellen-Export bleibt, wie er war)', async () => {
  const { env, aufrufe } = umgebung()
  const t = await build(env, { root: 'p1', locales: ['de'] })
  assert.equal(aufrufe.some(a => /relations\/tree/.test(a)), false)
  assert.equal('relations' in t, false)
})

test('mit relations: true liest build die Relationen des Teilbaums', async () => {
  const { env, aufrufe } = umgebung()
  const t = await build(env, { root: 'p1', locales: ['de'], relations: true })
  assert.ok(aufrufe.some(a => a === '/api/nodes/p1/relations/tree?deep=true'))
  assert.deepEqual(Object.keys(t.relations), ['p1', 'p2'])
})

test('Liste: jeder Knoten trägt seine Relationen, einer ohne keine Eigenschaft', async () => {
  const { env } = umgebung()
  const t = await build(env, { root: 'p1', locales: ['de'], relations: true })
  const liste = JSON.parse(toJson(t))
  assert.equal(liste.length, 2)
  const tablette = liste.find(o => /journali_id/.test(Object.keys(o).join()) && Object.values(o).includes('p1'))
  assert.equal(tablette.relations[0].other.label, 'Vitamin C')
  assert.deepEqual(tablette.relations[0].values.gehalt, { value: '20000', unit: 'g' })
  const vitamin = liste.find(o => Object.values(o).includes('p2'))
  assert.equal(vitamin.relations[0].direction, 'in', 'die eingehende Seite steht am Vitamin C')
})

test('Baum: die Relationen stehen am Knoten, die Kinder darunter', async () => {
  const { env } = umgebung()
  const t = await build(env, { root: 'p1', locales: ['de'], relations: true })
  const baum = JSON.parse(toJsonTree(t))
  assert.equal(baum.id, 'p1')
  assert.equal(baum.relations[0].type, 'component')
  assert.equal(baum.children[0].id, 'p2')
  assert.equal(baum.children[0].relations[0].other.label, 'Tablette')
})

test('ohne Relationen im Teilbaum: keine Eigenschaft `relations`', async () => {
  const { env } = umgebung({ mitRelationen: false })
  const t = await build(env, { root: 'p1', locales: ['de'], relations: true })
  assert.equal(JSON.stringify(JSON.parse(toJson(t))).includes('relations'), false)
  assert.equal('relations' in JSON.parse(toJsonTree(t)), false)
})

test('antwortet der Server auf die Relationen nicht, bleibt der Export ohne sie stehen', async () => {
  const { env } = umgebung({ fehler: true })
  const t = await build(env, { root: 'p1', locales: ['de'], relations: true })
  assert.equal(t.count, 2)
  assert.equal('relations' in t, false)
  assert.equal(JSON.parse(toJson(t)).length, 2)
})
