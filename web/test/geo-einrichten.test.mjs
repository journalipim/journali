// Einschalten von GEO-Texte (wie dpp und ppwr): der Hinweis nennt Gruppe und Zahl der Attribute; lehnt der Anwender ab, wird nichts angelegt;
// angenommen entstehen die Gruppe enrich_geo und fünf Attribute geo_*, die Gruppe hängt an den Wurzeln, die erzeugten Texte haben ihre Zielattribute,
// das Plugin meldet sich an. Ist schon alles da, kommt kein Hinweis. Der Server ist ein Stellvertreter: geprüft wird, was das Plugin ihm schickt.
import test from 'node:test'
import assert from 'node:assert/strict'
import './ui.mjs'

const geo = (await import('../../plugins/geo/entry.js')).default

const wurzeln = () => [{ id: 'w1', role: 'group', label: 'Sortiment A', parent: null, groups: '' }, { id: 'w2', role: 'group', label: 'Sortiment B', parent: null, groups: 'andere' },
  { id: 'k1', role: 'product', label: 'Kind', parent: 'w1', groups: '' }, { id: 'p1', role: 'rubric', label: 'Webbaum', parent: null, groups: '' }]
function welt({ modell = {}, annehmen = true, gemerkt = null } = {}) {
  const gepostet = [], hinweise = [], gespeichert = [], angemeldet = []
  const model = { masterLocale: 'de', locales: [{ code: 'de' }], groups: [], attributes: [], lists: [], units: [], ...modell }
  const rows = wurzeln()
  const ctx = {
    api: { post: async (p, b, m) => { gepostet.push([p, b, m ?? 'POST']); return {} } },
    store: { model, poll: async () => {}, toast: () => {} },
    tree: { loaded: true, rows, byId: new Map(rows.map(r => [r.id, r])), load: async () => {} },
    data: { get: async () => gemerkt, set: async (k, v) => { gespeichert.push([k, JSON.parse(JSON.stringify(v))]) } },
    system: { ankuendigen: async o => { hinweise.push(o); return annehmen }, melden: async (g, a) => { angemeldet.push([g, a]) } },
  }
  return { ctx, gepostet, hinweise, gespeichert, angemeldet }
}
const KEYS = ['geo_definition', 'geo_description', 'geo_faq', 'geo_keywords', 'geo_jsonld']
const alle = KEYS.map(key => ({ key, type: 'text', group: 'enrich_geo' }))

test('Einschalten: Hinweis mit Gruppe und Zahl, dann Gruppe und fünf Attribute, an die Wurzeln, Zielattribute, Anmeldung', async () => {
  const w = welt()
  assert.equal(await geo.install(w.ctx), true)
  assert.equal(w.hinweise.length, 1)
  assert.match(w.hinweise[0].text, /enrich_geo/); assert.match(w.hinweise[0].text, /5 Attributen/)
  const gruppe = w.gepostet.find(([p]) => p === '/api/model/groups/enrich_geo')
  assert.equal(gruppe[2], 'PUT'); assert.equal(gruppe[1].key, 'enrich_geo')
  const attribute = w.gepostet.filter(([p]) => p.startsWith('/api/model/attributes/'))
  assert.deepEqual(attribute.map(([p]) => p.split('/').pop()), KEYS)
  for (const [, b] of attribute) { assert.equal(b.group, 'enrich_geo'); assert.equal(b.type, 'text'); assert.deepEqual(b.axes, ['locale'], 'je Sprache') }
  const wurzel = w.gepostet.filter(([p, , m]) => /^\/api\/nodes\/[^/]+\/groups$/.test(p) && m === 'PUT')
  assert.deepEqual(wurzel.map(([p, b]) => [p, b.groups]), [['/api/nodes/w1/groups', ['enrich_geo']], ['/api/nodes/w2/groups', ['andere', 'enrich_geo']]], 'an die Wurzeln, nicht an Kinder und nicht an Publikationsbäume')
  assert.deepEqual(w.gespeichert, [['targets', { definition: 'geo_definition', description: 'geo_description', faq: 'geo_faq', keywords: 'geo_keywords', jsonld: 'geo_jsonld' }]],
    'die erzeugten Texte gehen standardmässig in die Attribute des Plugins')
  assert.deepEqual(w.angemeldet, [[['enrich_geo'], KEYS]])
})

test('lehnt der Anwender den Hinweis ab, entsteht nichts und das Plugin meldet false', async () => {
  const w = welt({ annehmen: false })
  assert.equal(await geo.install(w.ctx), false)
  assert.equal(w.gepostet.length, 0); assert.equal(w.gespeichert.length, 0); assert.equal(w.angemeldet.length, 0)
})

test('ist schon alles da, kommt kein Hinweis: nur Wurzeln, Ziele und Anmeldung', async () => {
  const w = welt({ modell: { groups: [{ key: 'enrich_geo' }], attributes: alle } })
  assert.equal(await geo.install(w.ctx), true)
  assert.equal(w.hinweise.length, 0)
  assert.equal(w.gepostet.some(([p]) => p.startsWith('/api/model/')), false, 'im Modell wird nichts neu angelegt')
  assert.equal(w.gepostet.filter(([p]) => p.endsWith('/groups')).length, 2)
  assert.deepEqual(w.angemeldet, [[['enrich_geo'], KEYS]])
})

test('fehlt nur ein Attribut, legt das Plugin nur dieses an; ein gemerktes Ziel bleibt', async () => {
  const w = welt({ modell: { groups: [{ key: 'enrich_geo' }], attributes: alle.filter(a => a.key !== 'geo_faq') }, gemerkt: { faq: 'eigenes_faq' } })
  await geo.install(w.ctx)
  assert.match(w.hinweise[0].text, /1 Attributen/)
  assert.deepEqual(w.gepostet.filter(([p]) => p.startsWith('/api/model/')).map(([p]) => p), ['/api/model/attributes/geo_faq'])
  assert.equal(w.gespeichert[0][1].faq, 'eigenes_faq')
})
