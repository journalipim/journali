// Solr-Import: zu welcher Gruppe ein neues Attribut kommt. Nennt die Quelle eine Gruppe (Definition des Attributs), gilt sie; sonst ordnet der Anfang
// des Schlüssels (abmessung_a_max → Abmessung), und wer zu wenige Verwandte hat, kommt in „Weitere Merkmale“. Früher kam alles ohne Gruppe der Quelle
// in eine einzige Gruppe „solr“ — 737 Attribute in einer Liste. Dazu: die vorhandenen Attribute dieser Gruppe auf Gruppen verteilen (ordneNeu).
import test from 'node:test'
import assert from 'node:assert/strict'

const { modelNeeds, prefixPlan, WEITERE } = await import('../../plugins/solr/solr.js')
const { plane, ordneNeu } = await import('../../plugins/solr/lauf.mjs')

const viele = (anfang, n, rolle = 'product') => Array.from({ length: n }, (_, i) => `${anfang}_${i}`)
const doc = (keys, type = 'product', id = 'p') => ({ id, master_id: id, type, ...Object.fromEntries(keys.map(k => [`property__${k}__string`, 'x'])) })
const gruppenVon = needs => Object.fromEntries([...needs.newAttrs.values()].map(a => [a.key, a.group]))

test('prefixPlan: ein Anfang, den genug Attribute teilen, wird eine Gruppe; der Rest kommt in „Weitere Merkmale“', () => {
  const keys = [...viele('abmessung', 6), ...viele('material', 5), ...viele('winkel', 4), 'hub', 'x']
  const p = prefixPlan(keys, 5)
  assert.deepEqual(p.get('abmessung_0'), { group: 'abmessung', label: 'Abmessung' })
  assert.deepEqual(p.get('material_3'), { group: 'material', label: 'Material' })
  assert.deepEqual(p.get('winkel_1'), WEITERE, 'vier sind keine Gruppe')
  assert.deepEqual(p.get('hub'), WEITERE); assert.deepEqual(p.get('x'), WEITERE, 'ein Buchstabe ist kein Anfang')
  assert.equal(WEITERE.label, 'Weitere Merkmale')
  assert.equal(prefixPlan(keys, 4).get('winkel_1').group, 'winkel', 'die Schwelle ist einstellbar')
})

test('ohne Gruppe in der Quelle ordnet der Anfang des Schlüssels; eine Gruppe „solr“ gibt es dafür nicht mehr', () => {
  const keys = [...viele('abmessung', 6), ...viele('material', 5), 'sonst_a']
  const n = modelNeeds([doc(keys)], new Map(), new Map(), {}, [])
  const g = gruppenVon(n)
  assert.equal(g.abmessung_0, 'abmessung'); assert.equal(g.material_2, 'material'); assert.equal(g.sonst_a, 'weitere')
  assert.deepEqual([...n.newGroups.keys()].sort(), ['abmessung', 'material', 'weitere'])
  assert.equal(n.newGroups.get('abmessung').label, 'Abmessung')
  assert.ok(![...n.newGroups.keys()].includes('solr'))
})

test('nennt die Quelle eine Gruppe, gilt sie; was keine hat, wird nach dem Anfang geordnet (auto)', () => {
  const keys = [...viele('abmessung', 6), 'farbe', 'gewicht']
  const pdefs = { farbe: { name: 'Farbe', section: 'techData_Optik', sectionName: 'Optik' }, gewicht: { name: 'Gewicht', section: 'techData_Optik', sectionName: 'Optik' } }
  const n = modelNeeds([doc(keys)], new Map(), new Map(), pdefs, [])
  const g = gruppenVon(n)
  assert.equal(g.farbe, 'techdata_optik'); assert.equal(g.gewicht, 'techdata_optik')
  assert.equal(g.abmessung_0, 'abmessung')
  assert.equal(n.newGroups.get('techdata_optik').label, 'Optik')
  assert.equal(n.newAttrs.get('farbe').label.de, 'Farbe', 'das Label aus der Definition')
})

test('groupBy: single legt alles in solr, section ohne Angabe der Quelle ebenso, prefix ignoriert die Gruppen der Quelle', () => {
  const keys = [...viele('abmessung', 6), 'farbe']
  const pdefs = { farbe: { section: 'optik' } }
  const eine = gruppenVon(modelNeeds([doc(keys)], new Map(), new Map(), pdefs, [], { groupBy: 'single' }))
  assert.deepEqual([...new Set(Object.values(eine))], ['solr'])
  const sektion = gruppenVon(modelNeeds([doc(keys)], new Map(), new Map(), pdefs, [], { groupBy: 'section' }))
  assert.equal(sektion.farbe, 'optik'); assert.equal(sektion.abmessung_0, 'solr')
  const anfang = gruppenVon(modelNeeds([doc(keys)], new Map(), new Map(), pdefs, [], { groupBy: 'prefix' }))
  assert.equal(anfang.farbe, 'weitere'); assert.equal(anfang.abmessung_0, 'abmessung')
})

test('eine Gruppe, die es schon gibt, wird nicht noch einmal angelegt; „aktiv ab“ folgt der obersten Rolle', () => {
  const keys = viele('abmessung', 6)
  const gruppen = new Map([['abmessung', { key: 'abmessung' }]])
  const n = modelNeeds([doc(keys, 'productVariant', 'v')], new Map(), gruppen, {}, [])
  assert.equal(n.newGroups.size, 0)
  assert.ok(n.used.includes('abmessung'))
  const m = modelNeeds([doc(keys, 'productVariant', 'v')], new Map(), new Map(), {}, [])
  assert.equal(m.newGroups.get('abmessung').activeFrom, 'variant', 'nur an Varianten: ab Variante')
})

test('der Plan nennt jede neue Gruppe mit der Zahl ihrer Attribute — im Probelauf steht dort, was angelegt würde', async () => {
  const keys = [...viele('abmessung', 6), ...viele('material', 5)]
  const DOCS = [{ id: 'g1', master_id: 'G1', type: 'group', name: 'G', main_parent_id: '' }, { ...doc(keys, 'product', 'p1'), main_parent_id: 'g1', name: 'P' }]
  const zeilen = []
  const umgebung = { sag: z => zeilen.push(z), modell: { attributes: [], groups: [] }, baum: [], frisch: async () => {}, api: {} }
  const client = { subtree: async (w, on) => { on?.(DOCS.length, DOCS.length, DOCS); return DOCS }, byIds: async () => [], propertyDefs: async () => ({}) }
  await plane({ client, umgebung, wurzeln: ['g1'], skip: [] })
  assert.ok(zeilen.includes('neue Gruppe abmessung (Abmessung): 6 Attribute'), zeilen.join('\n'))
  assert.ok(zeilen.includes('neue Gruppe material (Material): 5 Attribute'))
})

// ---- die vorhandenen Attribute der Gruppe solr

function welt({ gruppen = [{ key: 'solr', activeFrom: 'variant' }], knoten } = {}) {
  const attrs = [...viele('abmessung', 6), ...viele('material', 5), 'sonst_a'].map(k => ({ key: k, label: { de: k }, type: 'text', group: 'solr' }))
  attrs.push({ key: 'name', type: 'text', group: 'stamm' })
  const gesendet = [], zeilen = []
  return {
    gesendet, zeilen,
    umgebung: {
      sag: z => zeilen.push(z),
      modell: { attributes: attrs, groups: gruppen },
      baum: knoten ?? [{ id: 'w1', groups: 'solr' }, { id: 'w2', groups: 'andere,solr' }, { id: 'w3', groups: 'andere' }],
      frisch: async () => {},
      api: { post: async (p, b, m) => { gesendet.push([m ?? 'POST', p, b]); return {} } },
    },
  }
}

test('ordneNeu im Probelauf zählt nur: Gruppen mit ihrer Größe, Knoten, nichts wird geschrieben', async () => {
  const w = welt()
  const r = await ordneNeu({ umgebung: w.umgebung, trocken: true })
  assert.deepEqual(w.gesendet, [])
  assert.equal(r.gruppen, 3)
  assert.ok(w.zeilen.includes('12 Attribute der Gruppe solr → 3 Gruppen'), w.zeilen.join('\n'))
  assert.ok(w.zeilen.includes('  abmessung (Abmessung): 6')); assert.ok(w.zeilen.includes('  weitere (Weitere Merkmale): 1'))
  assert.ok(w.zeilen.includes('2 Knoten tragen die Gruppe solr'))
})

test('ordneNeu legt die Gruppen an, setzt die Gruppe der Attribute und hängt sie dort an, wo solr hing', async () => {
  const w = welt()
  const r = await ordneNeu({ umgebung: w.umgebung })
  assert.equal(r.bewegt, 12)
  const gruppen = w.gesendet.filter(([, p]) => p.startsWith('/api/model/groups/'))
  assert.deepEqual(gruppen.map(([m, p]) => `${m} ${p}`).sort(), ['PUT /api/model/groups/abmessung', 'PUT /api/model/groups/material', 'PUT /api/model/groups/weitere'])
  assert.equal(gruppen[0][2].activeFrom, 'variant', '„aktiv ab“ von solr')
  assert.deepEqual(gruppen.find(([, p]) => p.endsWith('/abmessung'))[2].label, { de: 'Abmessung', en: 'Abmessung' })
  const attribute = w.gesendet.filter(([, p]) => p.startsWith('/api/model/attributes/'))
  assert.equal(attribute.length, 12)
  assert.equal(attribute.find(([, p]) => p.endsWith('/abmessung_3'))[2].group, 'abmessung')
  assert.equal(attribute.find(([, p]) => p.endsWith('/sonst_a'))[2].group, 'weitere')
  assert.ok(!attribute.some(([, p]) => p.endsWith('/name')), 'Attribute anderer Gruppen bleiben')
  // die Gruppen der Knoten: solr geht, die neuen kommen dazu, andere bleiben
  const knoten = Object.fromEntries(w.gesendet.filter(([, p]) => p.startsWith('/api/nodes/')).map(([, p, b]) => [p.split('/')[3], b.groups]))
  assert.deepEqual(knoten.w1.sort(), ['abmessung', 'material', 'weitere'])
  assert.deepEqual(knoten.w2.sort(), ['abmessung', 'andere', 'material', 'weitere'])
  assert.equal(knoten.w3, undefined, 'ein Knoten ohne solr bleibt unberührt')
  assert.ok(w.zeilen.at(-1).startsWith('✓ 12 Attribute in 3 Gruppen, 2 Knoten angepasst'))
})

test('ordneNeu: eine Gruppe, die es schon gibt, wird nicht überschrieben; ohne Attribute in solr geschieht nichts', async () => {
  const w = welt({ gruppen: [{ key: 'solr' }, { key: 'abmessung' }] })
  await ordneNeu({ umgebung: w.umgebung })
  assert.ok(!w.gesendet.some(([, p]) => p === '/api/model/groups/abmessung'))
  const leer = { sag: () => {}, modell: { attributes: [{ key: 'a', group: 'x' }], groups: [] }, baum: [], api: { post: async () => assert.fail('nichts zu schreiben') } }
  assert.deepEqual(await ordneNeu({ umgebung: leer }), { bewegt: 0, gruppen: 0 })
})
