// Solr und IXP im Browser (04.10.2026): höchstens 20 000 Knoten je Analyse — der Teilbaum liegt dabei mit allen Feldern im Speicher.
// Solr zählt vorher, ohne zu laden (rows=0); IXP bricht beim Laden ab. Der Job hat keine Grenze.
import test from 'node:test'
import assert from 'node:assert/strict'

const { solr } = await import('../../plugins/solr/solr.js')
const { analyse } = await import('../../plugins/ixp/core.mjs')

test('Solr: zaehle fragt numFound des Teilbaums mit rows=0 — kein Dokument kommt mit', async () => {
  const gefragt = []
  const client = solr('http://solr.invalid/core', async url => { gefragt.push(url); return { response: { numFound: 123456, docs: [] } } })
  assert.equal(await client.zaehle('g-1'), 123456)
  const q = new URL(gefragt[0]).searchParams
  assert.equal(q.get('rows'), '0')
  assert.deepEqual(q.getAll('fq'), ['main_path_id:"g-1"'])
})

test('IXP: mit hoechstens bricht die Analyse beim Laden ab, mit der Meldung der Ansicht; ohne Grenze lädt sie alles', async () => {
  // ein Baum: eine Gruppe mit 30 Produkten
  const kinder = Array.from({ length: 30 }, (_, i) => ({ id: 'p' + i, masterId: 'mp' + i, type: 'product' }))
  const client = { languages: async () => [{ code: 'de' }], versions: async () => [], children: async id => id === 'g' ? kinder : [], properties: async () => ({}) }
  const env = extra => ({ client, tree: { rows: [], byId: new Map() }, model: { locales: [{ code: 'de' }], attributes: [], groups: [], lists: [] }, say: () => {}, ...extra })
  const gruppe = [{ doc: { id: 'g', masterId: 'mg', type: 'group' }, parentMaster: null }]
  await assert.rejects(analyse(env({ hoechstens: 10, zuViele: n => `mehr als ${n}` }), {}, gruppe), /mehr als 10/)
  const p = await analyse(env(), {}, gruppe)
  assert.equal(p.items.length, 31)
})
