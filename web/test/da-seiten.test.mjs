// Datenqualität, seitenweise (04.10.2026): die Prüfung liest die Tabelle mit take/skip, je Seite alle Sprachen, und prüft Seite für Seite —
// ein Zweig mit 17 782 Zeilen × 783 Spalten waren in einem Stück 1 GB JSON. Eine doppelte SKU fällt auch auf, wenn die Varianten auf
// verschiedenen Seiten stehen: gezählt wird über den Baum der Oberfläche.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import plugin from '../../plugins/da/entry.js'

const ZEILEN = Array.from({ length: 1200 }, (_, i) => ({ id: `v-${i}`, role: 'variant', parent: 'g', label: `V ${i}`, keys: { sku: i === 1100 ? 'DOPPELT' : i === 3 ? 'DOPPELT' : `S-${i}` } }))
const TREE = { rows: [{ id: 'g', role: 'group', parent: null, label: 'G' }, ...ZEILEN] }
const COLUMNS = [{ key: 'titel', type: 'text', perLocale: true, required: { web: ['*'] } }]

test('die Prüfung liest nur Seiten, je Seite jede Sprache, und findet die doppelte SKU über Seitengrenzen hinweg', async () => {
  const gefragt = []
  const alle = [{ id: 'g', role: 'group', label: 'G' }, ...ZEILEN]
  const api = {
    get: async p => {
      gefragt.push(p)
      const u = new URL('http://x' + p)
      assert.ok(u.searchParams.has('take'), 'nie ohne Seite: ' + p)
      const take = +u.searchParams.get('take'), skip = +u.searchParams.get('skip')
      const page = alle.slice(skip, skip + take)
      return { columns: COLUMNS, total: alle.length, next: skip + page.length < alle.length ? skip + page.length : null,
        rows: page.map(r => ({ row: r, inactive: [], values: { titel: { value: r.id === 'v-5' ? '' : 'x', own: true } } })) }
    },
  }
  const model = { masterLocale: 'de', locales: [{ code: 'de' }, { code: 'en' }], attributes: [] }
  const r = await plugin.check({ api, store: { model }, tree: TREE, checks: [] }, 'g', new Set(['sku', 'required']), () => {})
  assert.equal(r.nodes, 1201)
  assert.equal(gefragt.length, 3 * 2, 'drei Seiten zu 500, je zwei Sprachen')
  const sku = r.findings.filter(f => f.rule === 'sku')
  assert.deepEqual(sku.map(f => f.node.id).sort(), ['v-1100', 'v-3'])
  assert.ok(r.findings.some(f => f.rule === 'required' && f.node.id === 'v-5'), 'Pflicht leer auf Seite 1')
})
