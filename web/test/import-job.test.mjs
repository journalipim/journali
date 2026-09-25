// Der Import als Job rechnet denselben Plan wie die Ansicht: der Datenmapper läuft ohne Browser.
// Geprüft wird, dass ein gespeichertes Profil und eine Datei dieselben Befehle ergeben wie die Oberfläche —
// und dass unveränderte Werte nicht noch einmal geschrieben werden, denn sie kosten Kontingent (25.09.2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plan as makePlan, parseDelimited } from '../src/mapper.js'

const model = {
  masterLocale: 'de',
  locales: [{ code: 'de' }],
  attributes: [
    { key: 'sku', type: 'text', unique: true, group: 'master' },
    { key: 'name', type: 'text', perLocale: true, group: 'master' },
    { key: 'gewicht', type: 'decimal', group: 'master' },
  ],
  groups: [{ key: 'master', attributes: ['sku', 'name', 'gewicht'] }],
  lists: [], views: [], units: [],
}

// Baum wie im Job: rows, byId, ancestors
function baum(rows) {
  const byId = new Map(rows.map(r => [r.id, r]))
  const ancestors = (id) => {
    const aus = []
    for (let n = byId.get(id)?.parent ? byId.get(byId.get(id).parent) : null; n; n = n.parent ? byId.get(n.parent) : null) aus.unshift(n)
    return aus
  }
  return { rows, byId, ancestors, kids: (id) => rows.filter(r => r.parent === id) }
}

const ROWS = [
  { id: 'g-1', parent: null, label: 'Gruppe', role: 'group', keys: {} },
  { id: 'p-1', parent: 'g-1', label: 'Alt', role: 'product', keys: { sku: 'A1' } },
]
// Das Profil, wie die Ansicht es speichert: Zuordnung je Spaltenname, Ziel, Rolle
const PROFIL = {
  target: 'g-1',
  role: 'product',
  mapping: {
    sku: { target: 'attr', attribute: 'sku' },
    name: { target: 'attr', attribute: 'name', locale: 'de' },
    gewicht: { target: 'attr', attribute: 'gewicht' },
  },
}

function lauf(csv, existing = new Map()) {
  const t = parseDelimited(csv)
  const tree = baum(ROWS)
  const mapping = t.columns.map(c => ({ column: c, ...(PROFIL.mapping[c] ?? { target: 'skip' }) }))
  return makePlan({ columns: t.columns, rows: t.rows, mapping, model, tree,
    target: tree.byId.get(PROFIL.target), role: PROFIL.role, existing, external: null })
}

test('eine neue Zeile wird angelegt, eine bekannte über ihren Schlüssel gefunden', () => {
  const p = lauf('sku;name;gewicht\nA1;Neuer Name;2,5\nA2;Zweites;1\n')
  assert.equal(p.stats.create, 1, 'A2 ist neu')
  assert.equal(p.stats.update, 1, 'A1 gibt es schon — über die eindeutige sku gefunden')
  assert.ok(p.commands.length > 0)
})

test('unveraenderte Werte werden nicht noch einmal geschrieben', () => {
  const bestand = new Map([['p-1', { 'sku|': 'A1', 'name|de': 'Alt', 'gewicht|': '2.5' }]])
  const ohne = lauf('sku;name;gewicht\nA1;Alt;2,5\n')
  const mit = lauf('sku;name;gewicht\nA1;Alt;2,5\n', bestand)
  // Ohne Bestand schreibt der Plan jeden Wert; mit Bestand erkennt er, dass nichts anders ist
  assert.ok(mit.stats.values < ohne.stats.values, `mit Bestand ${mit.stats.values}, ohne ${ohne.stats.values}`)
  assert.equal(mit.stats.unchanged, 1)
})

test('eine Spalte, die das Profil nicht kennt, wird uebersprungen statt geraten', () => {
  const t = parseDelimited('sku;unbekannt\nA1;egal\n')
  const tree = baum(ROWS)
  const mapping = t.columns.map(c => ({ column: c, ...(PROFIL.mapping[c] ?? { target: 'skip' }) }))
  assert.equal(mapping[1].target, 'skip')
  const p = makePlan({ columns: t.columns, rows: t.rows, mapping, model, tree, target: tree.byId.get('g-1'), role: 'product', existing: new Map(), external: null })
  // die unbekannte Spalte erzeugt keinen Wert
  assert.ok(!JSON.stringify(p.commands).includes('unbekannt'))
})

test('die Befehle sind ein Stapel, der sich zuruecknehmen laesst', () => {
  const p = lauf('sku;name;gewicht\nA2;Zweites;1\n')
  // jeder Befehl hat op und args — genau das, was POST /api/batch nimmt
  assert.ok(p.commands.every(c => typeof c.op === 'string' && c.args && typeof c.args === 'object'))
})
