// Das Lämpchen an ⌁ Plugins in der Leiste (App.vue zeigt es, solange plugins.news() etwas nennt). Es leuchtet für ein
// Update — auf der Platte liegt eine neuere Fassung, als installiert ist. Ein Plugin, das nur daliegt und nie
// installiert wurde, steht nicht an (26.09.2026: als Lämpchen war es zu aufdringlich).
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { plugins } from '../src/plugins.js'

test('ein Plugin, das nur daliegt, steht nicht an', () => {
  plugins.list = [{ key: 'xport', onDisk: true, installed: false, enabled: false, manifest: {} }]
  assert.deepEqual(plugins.news(), [])
})

test('ein Update steht an, mit beiden Fassungen', () => {
  plugins.list = [
    { key: 'csv', onDisk: true, installed: true, enabled: true, update: true, version: '1.0.0', diskVersion: '1.1.0', manifest: {} },
    { key: 'json', onDisk: true, installed: true, enabled: true, version: '2.2.0', manifest: {} },
  ]
  assert.deepEqual(plugins.news(), ['↑ csv: 1.0.0 → 1.1.0'])
})
