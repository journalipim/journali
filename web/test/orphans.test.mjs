// Umhängen im Baum: vorher prüfen, welche Attributgruppen am Ziel fehlen. Die Attribute mit Werten im Teilbaum sagt der Server
// (/used-attributes) — die ganze Tabelle eines grossen Zweigs (17 782 Zeilen × 783 Spalten, 1 GB JSON) brachte den Browser zum Absturz.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'
import { api } from '../src/api.js'
import { neededByNode, missingGroups } from '../src/orphans.js'

test('neededByNode fragt nur die benutzten Attribute ab, nie die Tabelle des Teilbaums', async () => {
  const gefragt = []
  const orig = api.get
  api.get = async p => {
    gefragt.push(p)
    if (p === '/api/nodes/g-1') return { values: [{ attribute: 'name' }], rows: {}, attachedGroups: ['eigen'] }
    if (p === '/api/nodes/g-1/used-attributes') return { attributes: ['ean', 'farbe', 'name', 'preis'], nodes: 17783 }
    throw new Error('GET ' + p)
  }
  try {
    const model = { attributes: [{ key: 'name', groups: ['mastergroup'] }, { key: 'ean', groups: ['neuerkey'] }, { key: 'farbe', groups: ['physical', 'technik'] }, { key: 'preis', group: 'solr' }] }
    const { need, own } = await neededByNode('g-1', model)
    assert.ok(!gefragt.some(p => p.includes('/table')), gefragt.join(', '))
    assert.deepEqual([...need.keys()].sort(), ['mastergroup', 'neuerkey', 'physical', 'solr', 'technik'])
    assert.deepEqual(need.get('neuerkey'), ['ean'])
    assert.deepEqual([...own], ['eigen'])
    assert.deepEqual(missingGroups(need, new Set(['mastergroup', 'neuerkey', 'physical', 'solr', 'technik']), own), [], 'gilt alles am Ziel, fehlt nichts')
  } finally { api.get = orig }
})
