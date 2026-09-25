// Excel nimmt hoechstens 32767 Zeichen je Zelle. Ein laengerer Wert liess den ganzen Export scheitern
// ("Text length must not exceed 32767 characters") — der Fall wird gekuerzt, nicht abgebrochen (25.09.2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { kuerzeZellen, ZellenGrenze } from '../../plugins/table/core.mjs'

test('ein zu langer Wert wird gekuerzt, alles andere bleibt', () => {
  const lang = 'x'.repeat(ZellenGrenze + 500)
  const { rows, gekuerzt } = kuerzeZellen([['kurz', lang], ['auch kurz', 'noch kurz']])
  assert.equal(gekuerzt, 1)
  assert.equal(rows[0][0], 'kurz')
  assert.equal(rows[0][1].length, ZellenGrenze)
  assert.ok(rows[0][1].endsWith('…'), 'am Ende steht, dass etwas fehlt')
  assert.deepEqual(rows[1], ['auch kurz', 'noch kurz'])
})

test('genau an der Grenze wird nicht angefasst', () => {
  const genau = 'y'.repeat(ZellenGrenze)
  const { rows, gekuerzt } = kuerzeZellen([[genau]])
  assert.equal(gekuerzt, 0)
  assert.equal(rows[0][0], genau)
})

test('Zahlen und Leerwerte bleiben, wie sie sind', () => {
  const { rows, gekuerzt } = kuerzeZellen([[42, null, undefined, '']])
  assert.equal(gekuerzt, 0)
  assert.deepEqual(rows[0], [42, null, undefined, ''])
})

test('mehrere zu lange Zellen werden gezaehlt', () => {
  const lang = 'z'.repeat(ZellenGrenze + 1)
  const { gekuerzt } = kuerzeZellen([[lang, lang], [lang]])
  assert.equal(gekuerzt, 3)
})
