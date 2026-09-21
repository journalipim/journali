// Datenmapper: Vorschlag je Spalte — Fälle aus der Bedienung (Taloan, 21.09.: Re-Import des eigenen Exports)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { suggest } from '../src/mapper.js'

const model = { masterLocale: 'de', locales: [{ code: 'de' }, { code: 'en' }], attributes: [{ key: 'sku', label: { de: 'SKU' }, type: 'text' }, { key: 'name', label: { de: 'Name' }, type: 'text', perLocale: true }] }

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
