import test from 'node:test'
import assert from 'node:assert/strict'
import { moveRows, moveTarget, orderCommands, pickRows } from '../src/rowOps.js'

const mk = (...ids) => ids.map(id => ({ row: { id }, isNew: id.startsWith('new-') }))
const ids = rows => rows.map(r => r.row.id)

test('Zeilen verschieben: vor einen Platz, Reihenfolge der Bewegten bleibt', () => {
  const rows = mk('a', 'b', 'c', 'd')
  assert.deepEqual(ids(moveRows(rows, ['c', 'd'], 0)), ['c', 'd', 'a', 'b'])
  assert.deepEqual(ids(moveRows(mk('a', 'b', 'c', 'd'), ['a'], 4)), ['b', 'c', 'd', 'a'])
  assert.deepEqual(ids(moveRows(mk('a', 'b', 'c', 'd'), ['a', 'c'], 2)), ['b', 'a', 'c', 'd'])
  assert.deepEqual(ids(moveRows(mk('a', 'b', 'c', 'd'), ['b'], 1)), ['a', 'b', 'c', 'd'], 'an denselben Platz = nichts')
})

test('nach oben/unten/Anfang/Ende', () => {
  const rows = mk('a', 'b', 'c', 'd')
  assert.equal(moveTarget(rows, ['c'], 'up'), 1)
  assert.deepEqual(ids(moveRows(rows, ['c'], moveTarget(rows, ['c'], 'up'))), ['a', 'c', 'b', 'd'])
  assert.deepEqual(ids(moveRows(mk('a', 'b', 'c', 'd'), ['b'], moveTarget(mk('a', 'b', 'c', 'd'), ['b'], 'down'))), ['a', 'c', 'b', 'd'])
  assert.deepEqual(ids(moveRows(mk('a', 'b', 'c', 'd'), ['d'], moveTarget(mk('a', 'b', 'c', 'd'), ['d'], 'top'))), ['d', 'a', 'b', 'c'])
  assert.deepEqual(ids(moveRows(mk('a', 'b', 'c', 'd'), ['a', 'b'], moveTarget(mk('a', 'b', 'c', 'd'), ['a', 'b'], 'bottom'))), ['c', 'd', 'a', 'b'])
  assert.equal(moveTarget(rows, ['a'], 'up'), 0, 'oben bleibt oben')
})

test('node.order-Befehle: von unten nach oben, vor die Nachfolgerin — Nachspielen ergibt die Endreihenfolge', () => {
  // [a b c d] → d nach vorn, c dahinter: [d c a b]
  let rows = mk('a', 'b', 'c', 'd')
  rows = moveRows(rows, ['d'], 0); rows = moveRows(rows, ['c'], 1)
  assert.deepEqual(ids(rows), ['d', 'c', 'a', 'b'])
  const cmds = orderCommands(rows, 'p')
  assert.deepEqual(cmds.map(c => [c.args.node, c.args.before]), [['c', 'a'], ['d', 'c']])
  // nachspielen auf dem Server-Stand [a b c d]
  let server = ['a', 'b', 'c', 'd']
  for (const c of cmds) { server = server.filter(x => x !== c.args.node); const at = c.args.before ? server.indexOf(c.args.before) : server.length; server.splice(at, 0, c.args.node) }
  assert.deepEqual(server, ['d', 'c', 'a', 'b'])
  assert.ok(cmds.every(c => c.args.parent === 'p' && c._key.startsWith('order|')))
})

test('node.order: gelöschte Zeilen sind keine Nachfolgerin, neue Zeilen heissen @ref, ans Ende = before null', () => {
  let rows = mk('a', 'b', 'c', 'new-1')
  rows[2].retired = true
  rows = moveRows(rows, ['a'], 3)          // [b c✕ a new-1]
  assert.deepEqual(orderCommands(rows, 'p').map(c => [c.args.node, c.args.before]), [['a', '@new-1']])
  rows = moveRows(rows, ['new-1'], 2)      // [b c✕ new-1 a]
  const cmds = orderCommands(rows, 'p').map(c => [c.args.node, c.args.before])
  assert.deepEqual(cmds, [['a', null], ['@new-1', 'a']])
})

test('Zeilenauswahl: Klick, Strg, Shift', () => {
  const rows = mk('a', 'b', 'c', 'd', 'e')
  let s = pickRows(rows, new Set(), null, 1)
  assert.deepEqual([...s.sel], ['b']); assert.equal(s.anchor, 1)
  s = pickRows(rows, s.sel, s.anchor, 3, { ctrl: true })
  assert.deepEqual([...s.sel].sort(), ['b', 'd'])
  s = pickRows(rows, s.sel, s.anchor, 3, { ctrl: true })
  assert.deepEqual([...s.sel], ['b'], 'Strg noch einmal nimmt weg')
  s = pickRows(rows, s.sel, 1, 4, { shift: true })
  assert.deepEqual([...s.sel], ['b', 'c', 'd', 'e'], 'Shift vom Anker')
  s = pickRows(rows, s.sel, 1, 0, { shift: true })
  assert.deepEqual([...s.sel], ['a', 'b'], 'Shift nach oben ersetzt den Bereich')
  s = pickRows(rows, new Set(['e']), 4, 1, { shift: true, ctrl: true })
  assert.deepEqual([...s.sel].sort(), ['b', 'c', 'd', 'e'], 'Strg+Shift ergänzt')
})
