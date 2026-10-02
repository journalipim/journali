// Neue Attribute beim Import (Solr; dieselben Regeln in plugins/table/anlage.mjs für jede Quelle): Gruppen, die sich vererben lassen, und Namen, die ein Anwender liest.
//  · Eine Gruppe enthält Attribute einer Ebene (Gruppe, Produkt, Variante) und ist dort „aktiv ab“; Attribute oberhalb der Varianten sind vererbbar, und was oben
//    steht, steht unten nicht noch einmal. Spannt ein Thema mehrere Ebenen, wird je Ebene eine Gruppe daraus.
//  · Das Thema nennt die Quelle; sonst der Anfang des Schlüssels (abmessung_a_max → Abmessung); wer zu wenige Verwandte hat, kommt in „Weitere Merkmale“.
//  · Früher kam alles ohne Gruppe der Quelle in eine einzige Gruppe „solr“ — 737 Attribute in einer Liste — und hiess wie der Schlüssel.
import test from 'node:test'
import assert from 'node:assert/strict'

const { humanize, themeOf, themesByPrefix, groupsByLevel, placeByPosition, WEITERE } = await import('../../plugins/table/anlage.mjs')
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
  const n = modelNeeds(docs, new Map(), new Map(), {}, [], { groupBy: 'prefix', min: 1 })
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
  await plane({ client, umgebung, wurzeln: ['g1'], skip: [], gruppen: { groupBy: 'prefix' } })
  assert.ok(zeilen.includes('neue Gruppe abmessung (Abmessung) ab product: 6 Attribute'), zeilen.join('\n'))
  assert.ok(zeilen.includes('neue Gruppe material (Material) ab product: 5 Attribute'))
  // nach Position: eine Gruppe am Knoten, unter dem alles steht
  zeilen.length = 0
  await plane({ client, umgebung, wurzeln: ['g1'], skip: [] })
  assert.ok(zeilen.includes('neue Gruppe g (G) an G ab product: 11 Attribute'), zeilen.join('\n'))
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

// ---- die vorhandenen Attribute der Gruppe solr: an ihre Position

// Die Quelle: Wurzel „Wurzel“ mit den Kategorien „Spannen“ und „Bohren“.
//   abmessung_0–2 stehen am Produkt, abmessung_3–5 an der Variante — beide unter Spannen
//   material_0–4 stehen am Produkt, unter Spannen und unter Bohren — also an der Wurzel
//   sonst_a steht an der Variante unter Bohren — allein, darum wandert es nach oben
const G = (id, name, parent) => ({ id, master_id: id, type: 'group', name, main_parent_id: parent })
const QUELLE = [G('r', 'Wurzel', ''), G('a', 'Spannen', 'r'), G('b', 'Bohren', 'r')]
function welt({ gruppen = [{ key: 'solr', activeFrom: 'variant' }], levels, nurMit } = {}) {
  const stufen = new Map(); const nutzer = new Map()
  const setze = (keys, level, ...pos) => keys.forEach(k => { stufen.set(k, level); nutzer.set(k, new Set(pos)) })
  setze(viele('abmessung', 6).slice(0, 3), 1, 'a'); setze(viele('abmessung', 6).slice(3), 2, 'a')
  setze(viele('material', 5), 1, 'a', 'b'); setze(['sonst_a'], 2, 'b')
  const attrs = [...stufen.keys()].map(k => ({ key: k, label: { de: k, en: k }, type: 'text', group: 'solr' }))
  attrs.push({ key: 'name', type: 'text', group: 'stamm' })
  const gesendet = [], zeilen = []
  const items = QUELLE.map(d => ({ doc: d, existing: { id: 'j-' + d.id } }))
  return {
    gesendet, zeilen, plan: { items, needs: { levels: levels ?? stufen, usage: nutzer } },
    umgebung: {
      sag: z => zeilen.push(z),
      modell: { attributes: nurMit ? attrs.filter(a => nurMit.includes(a.key) || a.key === 'name') : attrs, groups: gruppen },
      baum: [{ id: 'j-r', groups: 'solr' }, { id: 'j-a', groups: 'solr,andere' }, { id: 'x', groups: 'andere' }],
      frisch: async () => {},
      api: { post: async (p, b, m) => { gesendet.push([m ?? 'POST', p, b]); return {} } },
    },
  }
}

test('ordneNeu im Probelauf zählt nur: Gruppen an ihrer Position, mit Ebene und Größe; nichts wird geschrieben', async () => {
  const w = welt()
  const r = await ordneNeu({ umgebung: w.umgebung, plan: w.plan, trocken: true })
  assert.deepEqual(w.gesendet, [])
  assert.equal(r.gruppen, 4)
  assert.ok(w.zeilen.includes('12 Attribute der Gruppe solr → 4 Gruppen'), w.zeilen.join('\n'))
  assert.ok(w.zeilen.includes('  spannen_product (Spannen · Produktmerkmale) an Spannen ab product: 3'), w.zeilen.join('\n'))
  assert.ok(w.zeilen.includes('  spannen_variant (Spannen · Variantenmerkmale) an Spannen ab variant: 3'))
  assert.ok(w.zeilen.includes('  wurzel_product (Wurzel · Produktmerkmale) an Wurzel ab product: 5'), 'material steht unter Spannen und Bohren: Wurzel')
  assert.ok(w.zeilen.includes('  wurzel_variant (Wurzel · Variantenmerkmale) an Wurzel ab variant: 1'), 'sonst_a allein: von Bohren nach oben')
  assert.ok(w.zeilen.includes('2 Knoten tragen die Gruppe solr'))
})

test('ordneNeu legt die Gruppen an, setzt Gruppe, Vererbbarkeit und Bezeichnung der Attribute und hängt jede Gruppe an den Knoten ihrer Position', async () => {
  const w = welt()
  const r = await ordneNeu({ umgebung: w.umgebung, plan: w.plan })
  assert.equal(r.bewegt, 12)
  const gruppen = Object.fromEntries(w.gesendet.filter(([, p]) => p.startsWith('/api/model/groups/')).map(([, p, b]) => [p.split('/').pop(), b]))
  assert.deepEqual(Object.keys(gruppen).sort(), ['spannen_product', 'spannen_variant', 'wurzel_product', 'wurzel_variant'])
  assert.equal(gruppen.spannen_product.activeFrom, 'product'); assert.equal(gruppen.wurzel_variant.activeFrom, 'variant')
  assert.deepEqual(gruppen.spannen_product.label, { de: 'Spannen · Produktmerkmale', en: 'Spannen · Product attributes' })
  const attribute = Object.fromEntries(w.gesendet.filter(([, p]) => p.startsWith('/api/model/attributes/')).map(([, p, b]) => [p.split('/').pop(), b]))
  assert.equal(attribute.abmessung_1.group, 'spannen_product'); assert.equal(attribute.abmessung_1.inheritable, true)
  assert.equal(attribute.abmessung_4.group, 'spannen_variant'); assert.equal(attribute.abmessung_4.inheritable, false)
  assert.equal(attribute.material_2.group, 'wurzel_product'); assert.equal(attribute.sonst_a.group, 'wurzel_variant')
  assert.deepEqual(attribute.abmessung_1.label, { de: 'Abmessung 1', en: 'Abmessung 1' })
  assert.ok(!('name' in attribute), 'Attribute anderer Gruppen bleiben')
  // die Gruppen der Knoten: jede an ihrer Position, „solr“ geht, andere bleiben
  const knoten = Object.fromEntries(w.gesendet.filter(([, p]) => p.startsWith('/api/nodes/')).map(([, p, b]) => [p.split('/')[3], b.groups.slice().sort()]))
  assert.deepEqual(knoten['j-r'], ['wurzel_product', 'wurzel_variant'])
  assert.deepEqual(knoten['j-a'], ['andere', 'spannen_product', 'spannen_variant'])
  assert.equal(knoten.x, undefined, 'ein Knoten ohne solr und ohne Position bleibt unberührt')
})

test('ordneNeu: Attribute ohne Wert in der Quelle bleiben in solr — und mit ihnen die Gruppe an den Knoten', async () => {
  const w = welt({ nurMit: [...viele('abmessung', 6), ...viele('material', 5), 'sonst_a'], levels: new Map(viele('abmessung', 6).map(k => [k, 1])) })
  const r = await ordneNeu({ umgebung: w.umgebung, plan: w.plan })
  assert.equal(r.bewegt, 6)
  assert.ok(w.zeilen.includes('6 Attribute ohne Wert in der Quelle bleiben in solr'))
  const knoten = Object.fromEntries(w.gesendet.filter(([, p]) => p.startsWith('/api/nodes/')).map(([, p, b]) => [p.split('/')[3], b.groups]))
  assert.ok(knoten['j-a'].includes('solr'))
})

test('ordneNeu: eine Gruppe, die es schon gibt, wird nicht überschrieben; ohne Attribute in solr geschieht nichts', async () => {
  const w = welt({ gruppen: [{ key: 'solr' }, { key: 'wurzel_product' }] })
  await ordneNeu({ umgebung: w.umgebung, plan: w.plan })
  assert.ok(!w.gesendet.some(([, p]) => p === '/api/model/groups/wurzel_product'))
  const leer = { sag: () => {}, modell: { attributes: [{ key: 'a', group: 'x' }], groups: [] }, baum: [], api: { post: async () => assert.fail('nichts zu schreiben') } }
  assert.deepEqual(await ordneNeu({ umgebung: leer, plan: w.plan }), { bewegt: 0, gruppen: 0 })
})

// ---- die Position: der tiefste gemeinsame Vorfahre

const BAUM = { R: null, A: 'R', A1: 'A', A2: 'A', B: 'R' }
const baum = { parentOf: id => BAUM[id] ?? null, name: id => id }
const e = (key, level, ...pos) => ({ key, level, positions: new Set(pos) })

test('placeByPosition: ein Attribut gehört an den tiefsten gemeinsamen Vorfahren der Knoten, die es benutzen', () => {
  const r = placeByPosition([
    ...['a1', 'a2', 'a3'].map(k => e(k, 2, 'A1')),           // nur A1
    ...['u1', 'u2', 'u3'].map(k => e(k, 2, 'A1', 'A2')),     // A1 und A2: darüber, A
    ...['z1', 'z2', 'z3'].map(k => e(k, 2, 'A1', 'B')),      // A1 und B: R
  ], baum)
  assert.equal(r.byKey.get('a1').position, 'A1'); assert.equal(r.byKey.get('u1').position, 'A'); assert.equal(r.byKey.get('z1').position, 'R')
  assert.deepEqual([...r.groups.keys()].sort(), ['a', 'a1', 'r'])
  assert.equal(r.byKey.get('a1').label.de, 'A1', 'der Name des Knotens'); assert.equal(r.byKey.get('a1').group, 'a1')
})

test('placeByPosition: eine Gruppe mit weniger als drei Attributen geht zum Knoten darüber, Schritt für Schritt', () => {
  const r = placeByPosition([e('x', 2, 'A1'), e('y', 2, 'A2')], baum)
  assert.equal(r.byKey.get('x').position, 'R', 'A1 hat eins, A hat dann zwei, R bekommt beide')
  assert.deepEqual([...r.groups.keys()], ['r'])
  const drei = placeByPosition([e('x', 2, 'A1'), e('y', 2, 'A2'), e('w', 2, 'A2'), e('v', 2, 'A2')], baum)
  assert.equal(drei.byKey.get('y').position, 'A2'); assert.equal(drei.byKey.get('x').position, 'R', 'das eine von A1 ist in A allein und wandert weiter nach R')
})

test('placeByPosition: die Ebene steht im Namen, wo ein Knoten mehrere hat; aktiv ab und vererbbar folgen der Ebene', () => {
  const r = placeByPosition([...['p1', 'p2', 'p3'].map(k => e(k, 1, 'B')), ...['v1', 'v2', 'v3'].map(k => e(k, 2, 'B'))], baum)
  assert.deepEqual(r.byKey.get('p1'), { group: 'b_product', label: { de: 'B · Produktmerkmale', en: 'B · Product attributes' }, activeFrom: 'product', inheritable: true, position: 'B' })
  assert.deepEqual(r.byKey.get('v1'), { group: 'b_variant', label: { de: 'B · Variantenmerkmale', en: 'B · Variant attributes' }, activeFrom: 'variant', inheritable: false, position: 'B' })
  const eine = placeByPosition(['a', 'b', 'c'].map(k => e(k, 2, 'B')), baum)
  assert.equal(eine.byKey.get('a').group, 'b'); assert.equal(eine.byKey.get('a').label.de, 'B', 'eine Ebene: nur der Name')
})

test('placeByPosition: eine zu grosse Gruppe wird nach Thema geteilt', () => {
  const keys = [...viele('abmessung', 8), ...viele('material', 7), 'x']
  const r = placeByPosition(keys.map(k => e(k, 2, 'B')), baum, { max: 10 })
  assert.equal(r.byKey.get('abmessung_1').group, 'b_abmessung'); assert.equal(r.byKey.get('abmessung_1').label.de, 'B · Abmessung')
  assert.equal(r.byKey.get('material_1').group, 'b_material'); assert.equal(r.byKey.get('x').group, 'b_weitere')
  assert.equal(r.byKey.get('x').label.de, 'B · Weitere Merkmale')
})

test('placeByPosition: gleiche Namen an verschiedenen Knoten ergeben verschiedene Schlüssel', () => {
  const t = { parentOf: id => ({ x1: 'R', x2: 'R' })[id] ?? null, name: () => 'Zubehör' }
  const r = placeByPosition([...['a', 'b', 'c'].map(k => e(k, 2, 'x1')), ...['d', 'e', 'f'].map(k => e(k, 2, 'x2'))], t)
  assert.deepEqual([...r.groups.keys()].sort(), ['zubehoer', 'zubehoer_2'])
})

// ---- im Import: Gruppen an Positionen

const DOCS_BAUM = (() => {
  const prod = (id, parent, keys) => ({ ...doc(keys, 'product', id), main_parent_id: parent })
  const variante = (id, parent, keys) => ({ ...doc(keys, 'productVariant', id), main_parent_id: parent })
  return [
    G('r', 'Wurzel', ''), G('a', 'Spannen', 'r'), G('b', 'Bohren', 'r'),
    prod('pa', 'a', viele('breite', 3)), variante('va', 'pa', viele('laenge', 3)),
    prod('pb', 'b', viele('tiefe', 3)), variante('vb', 'pb', viele('weite', 3)),
  ]
})()

test('modelNeeds (Position): jede Gruppe hängt am Knoten, unter dem ihre Attribute stehen, mit „aktiv ab“ und Vererbbarkeit', () => {
  const n = modelNeeds(DOCS_BAUM, new Map(), new Map(), {}, [])
  const g = gruppenVon(n)
  assert.equal(g.breite_0, 'spannen_product'); assert.equal(g.laenge_0, 'spannen_variant'); assert.equal(g.tiefe_0, 'bohren_product'); assert.equal(g.weite_0, 'bohren_variant')
  assert.deepEqual([...n.attach].map(([k, v]) => [k, v.sort()]).sort(), [['a', ['spannen_product', 'spannen_variant']], ['b', ['bohren_product', 'bohren_variant']]])
  assert.equal(n.newGroups.get('spannen_product').ort, 'Spannen'); assert.equal(n.newGroups.get('spannen_product').activeFrom, 'product')
  assert.equal(n.newAttrs.get('breite_0').inheritable, true); assert.equal(n.newAttrs.get('laenge_0').inheritable, false)
  assert.deepEqual(n.used, [], 'nichts hängt oben — jede Gruppe an ihrer Position')
  assert.deepEqual([...n.usage.get('breite_0')], ['a'])
})

test('modelNeeds: ein Attribut unter mehreren Kategorien kommt an deren gemeinsamen Vorfahren', () => {
  const docs = [
    ...DOCS_BAUM.filter(d => ['r', 'a', 'b'].includes(d.id)),
    { ...doc(viele('farbe', 3), 'product', 'p1'), main_parent_id: 'a' }, { ...doc(viele('farbe', 3), 'product', 'p2'), main_parent_id: 'b' },
  ]
  const n = modelNeeds(docs, new Map(), new Map(), {}, [])
  assert.equal(gruppenVon(n).farbe_0, 'wurzel'); assert.equal(n.newGroups.get('wurzel').ort, 'Wurzel')
  assert.deepEqual(n.attach.get('r'), ['wurzel'])
})

test('Die Gruppen der Quelle gehen vor: ein Attribut mit Gruppe in der Definition kommt nicht an eine Position', () => {
  const docs = [...DOCS_BAUM.filter(d => ['r', 'a'].includes(d.id)), { ...doc(['breite_0'], 'product', 'p1'), main_parent_id: 'a' }]
  const n = modelNeeds(docs, new Map(), new Map(), { breite_0: { section: 'techData_Mass', sectionName: 'Masse' } }, [])
  assert.equal(gruppenVon(n).breite_0, 'techdata_mass'); assert.equal(n.attach.size, 0)
})

test('der Lauf hängt die Gruppen an die Gruppenknoten: neue Knoten im Stapel, vorhandene mit ihren bisherigen Gruppen', async () => {
  const gestapelt = []
  const mkUmgebung = baumZeilen => ({
    sag: () => {}, modell: { attributes: [{ key: 'name', type: 'text', group: 'stamm' }, { key: 'sku', type: 'text', group: 'stamm' }], groups: [{ key: 'stamm' }] }, baum: baumZeilen,
    frisch: async function () {}, api: {
      get: async () => ({ values: [] }), post: async () => ({}),
      batchChunked: async cmds => { gestapelt.push(cmds); return { batch: 'b', results: cmds.map((c, i) => ({ index: i, ref: c.ref, node: c.ref ? 'n-' + c.ref : undefined })), error: null, errors: [], refs: new Map() } },
    },
  })
  const client = { subtree: async (w, on) => { on?.(DOCS_BAUM.length, DOCS_BAUM.length, DOCS_BAUM); return DOCS_BAUM }, byIds: async () => [], propertyDefs: async () => ({}) }
  const { schreibe } = await import('../../plugins/solr/lauf.mjs')
  const u = mkUmgebung([])
  // die Modellanlage legt die Attribute an, danach kennt das Modell sie
  u.api.post = async (p, b) => { if (p.startsWith('/api/model/attributes/')) u.modell.attributes.push(b); return {} }
  const plan = await plane({ client, umgebung: u, wurzeln: ['r'], skip: [] })
  await schreibe({ plan, umgebung: u, ziel: 'z' })
  const attach = gestapelt.flat().filter(c => c.op === 'groups.attach')
  const anKnoten = ref => attach.find(c => c.args.node === ref)?.args.groups
  const refs = Object.fromEntries(gestapelt.flat().filter(c => c.op === 'external.link').map(c => [c.args.id, c.args.node]))
  assert.deepEqual(anKnoten(refs.a), ['spannen_product', 'spannen_variant'])
  assert.deepEqual(anKnoten(refs.b), ['bohren_product', 'bohren_variant'])
  assert.deepEqual(anKnoten(refs.r), ['stamm'], 'an der Wurzel hängt, was schon galt — keine neue Gruppe')
  assert.equal(anKnoten(refs.pa), undefined, 'an Produkten und Varianten hängt nichts')
})
