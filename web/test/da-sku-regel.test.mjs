// Datenqualität (24.09.2026): die Regel „SKU fehlt / doppelt“ las row.sku — das Feld gibt es in der Tabellenzeile nicht,
// die Kennungen stehen in row.keys (Tree.KeysOf). Folge: „Variante ohne SKU“ für jede Variante, auch mit SKU daneben.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import plugin from '../../plugins/da/entry.js'

const rule = plugin.rules.find(r => r.key === 'sku')
const row = (id, sku, role = 'variant') => ({ row: { id, role, label: id, keys: sku ? { sku } : null } })

test('Variante mit SKU in row.keys ist kein Befund', () => {
  const all = [row('v-1', 'TW-1'), row('v-2', 'TW-2')]
  assert.deepEqual(rule.run({ row: all[0].row, all }), [])
})

test('Variante ohne Kennung wird gemeldet', () => {
  const all = [row('v-1', null)]
  assert.deepEqual(rule.run({ row: all[0].row, all }), [{ attribute: 'sku', message: 'Variante ohne SKU' }])
})

test('dieselbe SKU an zwei Varianten wird als doppelt gemeldet, Produkte prüft die Regel nicht', () => {
  const all = [row('v-1', 'TW-1'), row('v-2', 'TW-1'), row('p-1', null, 'product')]
  assert.deepEqual(rule.run({ row: all[0].row, all }), [{ attribute: 'sku', message: 'SKU TW-1 2× vergeben' }])
  assert.deepEqual(rule.run({ row: all[2].row, all }), [])
})
