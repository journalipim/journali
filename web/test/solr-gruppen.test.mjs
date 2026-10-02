// Neue Attribute beim Import (Solr; dieselben Regeln in plugins/table/anlage.mjs für jede Quelle): Gruppen, die sich vererben lassen, und Namen, die ein Anwender liest.
//  · Eine Gruppe enthält Attribute einer Ebene (Gruppe, Produkt, Variante) und ist dort „aktiv ab“; Attribute oberhalb der Varianten sind vererbbar, und was oben
//    steht, steht unten nicht noch einmal. Spannt ein Thema mehrere Ebenen, wird je Ebene eine Gruppe daraus.
//  · Das Thema nennt die Quelle; sonst der Anfang des Schlüssels (abmessung_a_max → Abmessung); wer zu wenige Verwandte hat, kommt in „Weitere Merkmale“.
//  · Früher kam alles ohne Gruppe der Quelle in eine einzige Gruppe „solr“ — 737 Attribute in einer Liste — und hiess wie der Schlüssel.
import test from 'node:test'
import assert from 'node:assert/strict'

const { humanize, themeOf, themesByPrefix, groupsByLevel, WEITERE } = await import('../../plugins/table/anlage.mjs')
const { modelNeeds, valueCommands, inheritedValues } = await import('../../plugins/solr/solr.js')
const { plane, ordneNeu } = await import('../../plugins/solr/lauf.mjs')

const viele = (anfang, n) => Array.from({ length: n }, (_, i) => `${anfang}_${i}`)
const doc = (keys, type = 'product', id = 'p') => ({ id, master_id: id, type, ...Object.fromEntries(keys.map(k => [`property__${k}__string`, 'x'])) })
const gruppenVon = needs => Object.fromEntries([...needs.newAttrs.values()].map(a => [a.key, a.group]))

// ---- Namen

test('humanize: Wörter statt Schlüssel, Kennungen fallen weg', () => {
  assert.equal(humanize('abmessung_a_max'), 'Abmessung a max')
  assert.equal(humanize('ctrl_isSubNode'), 'Ctrl is sub node')
  assert.equal(humanize('wsc_d28e55178_dp_kugel_bolzen'), 'Wsc dp kugel bolzen', 'die Kennung d28e55178 ist weg')
  assert.equal(humanize('Size insert'), 'Size insert')
  assert.equal(humanize('d28e55178'), 'D28e55178', 'bleibt nichts übrig, bleibt die Kennung')
  assert.equal(humanize(''), '')
})

test('ein Thema ist ein Wort ab vier Buchstaben, das nichts Technisches nennt', () => {
  assert.equal(themeOf('abmessung_a'), 'abmessung'); assert.equal(themeOf('material_x'), 'material')
  for (const k of ['dp_kugel', 'wsc_x', 'ctrl_isSubNode', 'abc', 'x', '1_a']) assert.equal(themeOf(k), '', k)
  const t = themesByPrefix([...viele('abmessung', 6), ...viele('winkel', 4), 'hub'], 5)
  assert.deepEqual(t.get('abmessung_1'), { group: 'abmessung', label: { de: 'Abmessung', en: 'Abmessung' } })
  assert.deepEqual(t.get('winkel_1'), WEITERE, 'vier sind kein Thema'); assert.deepEqual(t.get('hub'), WEITERE)
  assert.equal(WEITERE.label.de, 'Weitere Merkmale'); assert.equal(WEITERE.label.en, 'Other attributes')
})

// ---- Gruppen nach Ebene

test('ein Thema auf einer Ebene behält seinen Namen; auf mehreren bekommt jede Gruppe die Ebene dazu', () => {
  const thema = { group: 'abmessung', label: { de: 'Abmessung', en: 'Dimension' } }
  const eine = groupsByLevel([{ key: 'a', theme: thema, level: 2 }, { key: 'b', theme: thema, level: 2 }])
  assert.deepEqual(eine.get('a'), { group: 'abmessung', label: thema.label, activeFrom: 'variant', inheritable: false })
  const zwei = groupsByLevel([{ key: 'a', theme: thema, level: 1 }, { key: 'b', theme: thema, level: 2 }, { key: 'c', theme: thema, level: 0 }])
  assert.deepEqual(zwei.get('a'), { group: 'abmessung_product', label: { de: 'Abmessung (Produkt)', en: 'Dimension (Product)' }, activeFrom: 'product', inheritable: true })
  assert.deepEqual(zwei.get('b'), { group: 'abmessung_variant', label: { de: 'Abmessung (Variante)', en: 'Dimension (Variant)' }, activeFrom: 'variant', inheritable: false })
  assert.deepEqual(zwei.get('c'), { group: 'abmessung_group', label: { de: 'Abmessung (Gruppe)', en: 'Dimension (Group)' }, activeFrom: null, inheritable: true })
})

test('modelNeeds: Ebene, aktiv ab und Vererbbarkeit folgen den Werten in der Quelle; es gibt keine Gruppe „solr“ mehr', () => {
  const docs = [doc([...viele('abmessung', 3)], 'product', 'p'), doc([...viele('abmessung', 6).slice(3), 'sonst_a'], 'productVariant', 'v')]
  const n = modelNeeds(docs, new Map(), new Map(), {}, [], { min: 3 })
  const g = gruppenVon(n)
  assert.deepEqual([g.abmessung_0, g.abmessung_4], ['abmessung_product', 'abmessung_variant'])
  assert.equal(g.sonst_a, 'weitere')
  assert.equal(n.newGroups.get('abmessung_product').activeFrom, 'product')
  assert.equal(n.newGroups.get('abmessung_product').label, 'Abmessung (Produkt)'); assert.equal(n.newGroups.get('abmessung_product').en, 'Abmessung (Product)')
  assert.equal(n.newGroups.get('abmessung_variant').activeFrom, 'variant')
  assert.equal(n.newAttrs.get('abmessung_0').inheritable, true, 'am Produkt: vererbbar')
  assert.equal(n.newAttrs.get('abmessung_4').inheritable, false, 'an der Variante: nicht')
  assert.equal(n.newAttrs.get('abmessung_0').label.de, 'Abmessung 0', 'Bezeichnung statt Schlüssel')
  assert.deepEqual([...n.levels].filter(([k]) => k === 'abmessung_0' || k === 'abmessung_4'), [['abmessung_0', 1], ['abmessung_4', 2]])
  assert.ok(![...n.newGroups.keys()].includes('solr'))
})

test('ein Wert an Gruppe und Produkt: die oberste Ebene gilt', () => {
  const docs = [doc(['farbe_a'], 'productVariant', 'v'), doc(['farbe_a'], 'product', 'p'), doc(['farbe_a'], 'group', 'g')]
  const n = modelNeeds(docs, new Map(), new Map(), {}, [], { min: 1 })
  assert.equal(n.levels.get('farbe_a'), 0)
  assert.equal(n.newAttrs.get('farbe_a').inheritable, true)
  assert.equal(n.newGroups.get('farbe').activeFrom, null, 'an der Gruppe: überall aktiv')
})

test('nennt die Quelle eine Gruppe, gilt sie — mit ihrem Namen; was keine hat, wird nach dem Anfang geordnet', () => {
  const keys = [...viele('abmessung', 6), 'farbe', 'gewicht']
  const pdefs = { farbe: { name: 'Farbe', section: 'techData_Optik', sectionName: 'Optik' }, gewicht: { name: 'Gewicht', section: 'techData_Optik', sectionName: 'Optik' } }
  const n = modelNeeds([doc(keys)], new Map(), new Map(), pdefs, [])
  const g = gruppenVon(n)
  assert.equal(g.farbe, 'techdata_optik'); assert.equal(g.gewicht, 'techdata_optik'); assert.equal(g.abmessung_0, 'abmessung')
  assert.equal(n.newGroups.get('techdata_optik').label, 'Optik')
  assert.equal(n.newAttrs.get('farbe').label.de, 'Farbe', 'der Name aus der Definition')
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

test('eine Gruppe, die es schon gibt, wird nicht noch einmal angelegt', () => {
  const gruppen = new Map([['abmessung', { key: 'abmessung' }]])
  const n = modelNeeds([doc(viele('abmessung', 6), 'productVariant', 'v')], new Map(), gruppen, {}, [])
  assert.equal(n.newGroups.size, 0); assert.ok(n.used.includes('abmessung'))
})

test('der Plan nennt jede neue Gruppe mit der Zahl ihrer Attribute — im Probelauf steht dort, was angelegt würde', async () => {
  const DOCS = [{ id: 'g1', master_id: 'G1', type: 'group', name: 'G', main_parent_id: '' }, { ...doc([...viele('abmessung', 6), ...viele('material', 5)], 'product', 'p1'), main_parent_id: 'g1', name: 'P' }]
  const zeilen = []
  const umgebung = { sag: z => zeilen.push(z), modell: { attributes: [], groups: [] }, baum: [], frisch: async () => {}, api: {} }
  const client = { subtree: async (w, on) => { on?.(DOCS.length, DOCS.length, DOCS); return DOCS }, byIds: async () => [], propertyDefs: async () => ({}) }
  await plane({ client, umgebung, wurzeln: ['g1'], skip: [] })
  assert.ok(zeilen.includes('neue Gruppe abmessung (Abmessung): 6 Attribute'), zeilen.join('\n'))
  assert.ok(zeilen.includes('neue Gruppe material (Material): 5 Attribute'))
})

// ---- Vererbung beim Schreiben

const ATTRS = new Map([
  ['farbe', { key: 'farbe', type: 'text', inheritable: true }],
  ['hub', { key: 'hub', type: 'text', inheritable: false }],
  ['tags', { key: 'tags', type: 'text', inheritable: true, multiple: true }],
])
const mit = (typ, werte, id = 'x') => ({ id, master_id: id, type: typ, lang: 'de', ...Object.fromEntries(Object.entries(werte).map(([k, v]) => [`property__${k}__${Array.isArray(v) ? 'multi_string' : 'string'}`, v])) })

test('was das Produkt an einem vererbbaren Attribut trägt, schreibt die Variante nicht noch einmal', () => {
  const produkt = mit('product', { farbe: 'rot', hub: '5', tags: ['a', 'b'] }, 'p')
  const geerbt = inheritedValues(produkt, ATTRS)
  assert.deepEqual([...geerbt.keys()].sort(), ['farbe|', 'tags|'], 'nur Vererbbares')
  const variante = mit('productVariant', { farbe: 'rot', hub: '5', tags: ['a', 'b'] }, 'v')
  const cmds = valueCommands(variante, 'v-1', ATTRS, new Map(), [], geerbt)
  assert.deepEqual(cmds.map(c => c.args.attribute), ['hub'], 'farbe und tags stehen schon oben')
})

test('ein anderer Wert an der Variante wird geschrieben und überschreibt den vererbten', () => {
  const geerbt = inheritedValues(mit('product', { farbe: 'rot', tags: ['a'] }, 'p'), ATTRS)
  const cmds = valueCommands(mit('productVariant', { farbe: 'blau', tags: ['a', 'b'] }, 'v'), 'v-1', ATTRS, new Map(), [], geerbt)
  assert.deepEqual(cmds.map(c => [c.args.attribute, c.args.value ?? c.args.values]), [['farbe', 'blau'], ['tags', ['a', 'b']]])
})

test('ohne Vererbung (kein Knoten darüber) schreibt valueCommands alles wie bisher', () => {
  const cmds = valueCommands(mit('productVariant', { farbe: 'rot', hub: '5' }, 'v'), 'v-1', ATTRS, new Map(), [])
  assert.deepEqual(cmds.map(c => c.args.attribute), ['farbe', 'hub'])
})

// ---- die vorhandenen Attribute der Gruppe solr

function welt({ gruppen = [{ key: 'solr', activeFrom: 'variant' }], knoten, levels } = {}) {
  const attrs = [...viele('abmessung', 6), ...viele('material', 5), 'sonst_a'].map(k => ({ key: k, label: { de: k, en: k }, type: 'text', group: 'solr' }))
  attrs.push({ key: 'name', type: 'text', group: 'stamm' })
  // abmessung_0–2 und material_* stehen am Produkt, abmessung_3–5 an der Variante, sonst_a an der Variante
  const stufen = new Map(attrs.filter(a => a.group === 'solr').map(a => [a.key, /^abmessung_[345]$/.test(a.key) || a.key === 'sonst_a' ? 2 : 1]))
  const gesendet = [], zeilen = []
  return {
    gesendet, zeilen, plan: { needs: { levels: levels ?? stufen } },
    umgebung: {
      sag: z => zeilen.push(z),
      modell: { attributes: attrs, groups: gruppen },
      baum: knoten ?? [{ id: 'w1', groups: 'solr' }, { id: 'w2', groups: 'andere,solr' }, { id: 'w3', groups: 'andere' }],
      frisch: async () => {},
      api: { post: async (p, b, m) => { gesendet.push([m ?? 'POST', p, b]); return {} } },
    },
  }
}

test('ordneNeu im Probelauf zählt nur: Gruppen mit Ebene und Größe, Knoten, nichts wird geschrieben', async () => {
  const w = welt()
  const r = await ordneNeu({ umgebung: w.umgebung, plan: w.plan, trocken: true })
  assert.deepEqual(w.gesendet, [])
  assert.equal(r.gruppen, 4)
  assert.ok(w.zeilen.includes('12 Attribute der Gruppe solr → 4 Gruppen'), w.zeilen.join('\n'))
  assert.ok(w.zeilen.includes('  abmessung_product (Abmessung (Produkt)) ab product: 3'), w.zeilen.join('\n'))
  assert.ok(w.zeilen.includes('  abmessung_variant (Abmessung (Variante)) ab variant: 3'))
  assert.ok(w.zeilen.includes('  material (Material) ab product: 5'))
  assert.ok(w.zeilen.includes('  weitere (Weitere Merkmale) ab variant: 1'))
  assert.ok(w.zeilen.includes('2 Knoten tragen die Gruppe solr'))
})

test('ordneNeu legt Gruppen mit „aktiv ab“ an, macht Attribute oberhalb der Varianten vererbbar, benennt sie lesbar und hängt die Gruppen an', async () => {
  const w = welt()
  const r = await ordneNeu({ umgebung: w.umgebung, plan: w.plan })
  assert.equal(r.bewegt, 12)
  const gruppen = Object.fromEntries(w.gesendet.filter(([, p]) => p.startsWith('/api/model/groups/')).map(([, p, b]) => [p.split('/').pop(), b]))
  assert.deepEqual(Object.keys(gruppen).sort(), ['abmessung_product', 'abmessung_variant', 'material', 'weitere'])
  assert.equal(gruppen.abmessung_product.activeFrom, 'product'); assert.equal(gruppen.abmessung_variant.activeFrom, 'variant')
  assert.deepEqual(gruppen.material.label, { de: 'Material', en: 'Material' })
  const attribute = Object.fromEntries(w.gesendet.filter(([, p]) => p.startsWith('/api/model/attributes/')).map(([, p, b]) => [p.split('/').pop(), b]))
  assert.equal(attribute.abmessung_1.group, 'abmessung_product'); assert.equal(attribute.abmessung_1.inheritable, true)
  assert.equal(attribute.abmessung_4.group, 'abmessung_variant'); assert.equal(attribute.abmessung_4.inheritable, false)
  assert.equal(attribute.sonst_a.group, 'weitere')
  assert.deepEqual(attribute.abmessung_1.label, { de: 'Abmessung 1', en: 'Abmessung 1' })
  assert.ok(!('name' in attribute), 'Attribute anderer Gruppen bleiben')
  const knoten = Object.fromEntries(w.gesendet.filter(([, p]) => p.startsWith('/api/nodes/')).map(([, p, b]) => [p.split('/')[3], b.groups]))
  assert.deepEqual(knoten.w1.sort(), ['abmessung_product', 'abmessung_variant', 'material', 'weitere'])
  assert.deepEqual(knoten.w2.sort(), ['abmessung_product', 'abmessung_variant', 'andere', 'material', 'weitere'])
  assert.equal(knoten.w3, undefined, 'ein Knoten ohne solr bleibt unberührt')
})

test('ordneNeu: Attribute ohne Wert in der Quelle bleiben in solr — und mit ihnen die Gruppe an den Knoten', async () => {
  const w = welt({ levels: new Map([['abmessung_0', 1], ['abmessung_1', 1], ['abmessung_2', 1], ['abmessung_3', 1], ['abmessung_4', 1], ['abmessung_5', 1]]) })
  const r = await ordneNeu({ umgebung: w.umgebung, plan: w.plan })
  assert.equal(r.bewegt, 6)
  assert.ok(w.zeilen.includes('6 Attribute ohne Wert in der Quelle bleiben in solr'))
  const knoten = Object.fromEntries(w.gesendet.filter(([, p]) => p.startsWith('/api/nodes/')).map(([, p, b]) => [p.split('/')[3], b.groups]))
  assert.ok(knoten.w1.includes('solr') && knoten.w1.includes('abmessung'))
})

test('ordneNeu: eine Gruppe, die es schon gibt, wird nicht überschrieben; ohne Attribute in solr geschieht nichts', async () => {
  const w = welt({ gruppen: [{ key: 'solr' }, { key: 'material' }] })
  await ordneNeu({ umgebung: w.umgebung, plan: w.plan })
  assert.ok(!w.gesendet.some(([, p]) => p === '/api/model/groups/material'))
  const leer = { sag: () => {}, modell: { attributes: [{ key: 'a', group: 'x' }], groups: [] }, baum: [], api: { post: async () => assert.fail('nichts zu schreiben') } }
  assert.deepEqual(await ordneNeu({ umgebung: leer, plan: w.plan }), { bewegt: 0, gruppen: 0 })
})
