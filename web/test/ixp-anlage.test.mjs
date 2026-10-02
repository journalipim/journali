// IXP-Import: neue Attribute und Gruppen nach denselben Regeln wie Solr (plugins/table/anlage.mjs) — eine Ebene je Gruppe, aktiv ab dieser Ebene, vererbbar oberhalb
// der Varianten, lesbare Bezeichnungen. Eine Gruppe, die es schon gibt oder die der Anwender gewählt hat, bleibt, wie sie ist.
import test from 'node:test'
import assert from 'node:assert/strict'

const { planSummary, run } = await import('../../plugins/ixp/core.mjs')

const prop = (level, extra = {}) => ({ count: 3, html: false, classes: [], values: [], def: null, level, srcType: 'text', ...extra })
const plan = (props, groupOf = {}, extra = {}) => ({
  props, groupOf, items: [], missing: [], unknown: [], cleanPrefix: 'ixp_', importGroup: 'ixp_import', picked: 1, propDefs: {}, selectedLocales: ['de'],
  mapping: Object.fromEntries(Object.keys(props).map(k => [k, 'new:text'])), ...extra,
})
const model = (groups = []) => ({ groups, attributes: [], lists: [], locales: [{ code: 'de' }] })

test('planSummary: eine neue Gruppe je Ebene, aktiv ab dieser Ebene, vererbbar oberhalb der Varianten, lesbare Bezeichnung', () => {
  const p = plan({ breite_mm: prop(1), tiefe_mm: prop(1), farbe: prop(2) }, { breite_mm: 'ixp_technik', tiefe_mm: 'ixp_technik', farbe: 'ixp_technik' })
  const s = planSummary(p, model())
  const attr = Object.fromEntries(s.newAttrs.map(a => [a.from, a]))
  assert.equal(attr.breite_mm.group, 'ixp_technik_product'); assert.equal(attr.farbe.group, 'ixp_technik_variant')
  assert.equal(attr.breite_mm.inheritable, true); assert.equal(attr.farbe.inheritable, false)
  assert.equal(attr.breite_mm.label, 'Breite mm', 'Bezeichnung statt Schlüssel')
  assert.deepEqual(s.newGroups.sort(), ['ixp_technik_product', 'ixp_technik_variant'])
  assert.deepEqual(s.groupDefs.get('ixp_technik_product'), { label: { de: 'Technik (Produkt)', en: 'Technik (Product)' }, activeFrom: 'product' })
  assert.equal(s.groupDefs.get('ixp_technik_variant').activeFrom, 'variant')
})

test('planSummary: ein Thema auf einer Ebene behält seinen Namen', () => {
  const s = planSummary(plan({ farbe: prop(2), gewicht: prop(2) }, { farbe: 'ixp_technik', gewicht: 'ixp_technik' }), model())
  assert.deepEqual(s.newGroups, ['ixp_technik'])
  assert.deepEqual(s.groupDefs.get('ixp_technik'), { label: { de: 'Technik', en: 'Technik' }, activeFrom: 'variant' })
})

test('planSummary: eine Gruppe, die es schon gibt, bleibt — nur vererbbar wird das Attribut, wo es oberhalb der Varianten steht', () => {
  const s = planSummary(plan({ breite_mm: prop(1), farbe: prop(2) }, { breite_mm: 'ixp_technik', farbe: 'ixp_technik' }), model([{ key: 'ixp_technik', defined: true }]))
  assert.deepEqual(s.newGroups, []); assert.equal(s.groupDefs.size, 0)
  assert.deepEqual(s.newAttrs.map(a => [a.from, a.group, a.inheritable]), [['breite_mm', 'ixp_technik', true], ['farbe', 'ixp_technik', false]])
})

test('run: legt die Gruppen mit „aktiv ab“ an und schreibt vererbbare Attribute mit lesbarer Bezeichnung', async () => {
  const gesendet = [], gesagt = []
  const env = {
    api: { get: async () => ({ groups: [], attachedGroups: [], values: [] }), post: async (p, b, m) => { gesendet.push([m ?? 'POST', p, b]); return { results: [], batch: 'b' } }, batchChunked: async () => ({ batch: 'b', results: [], errors: [], refs: new Map() }) },
    tree: { rows: [], byId: new Map() }, model: model(), say: z => gesagt.push(z), progress() {},
  }
  const p = plan({ breite_mm: prop(1), farbe: prop(2) }, { breite_mm: 'ixp_technik', farbe: 'ixp_technik' })
  await run(env, { policy: {}, target: null }, p)
  const gruppen = Object.fromEntries(gesendet.filter(([, u]) => u.startsWith('/api/model/groups/')).map(([, u, b]) => [u.split('/').pop(), b]))
  assert.equal(gruppen.ixp_technik_product.activeFrom, 'product'); assert.equal(gruppen.ixp_technik_variant.activeFrom, 'variant')
  assert.deepEqual(gruppen.ixp_technik_product.label, { de: 'Technik (Produkt)', en: 'Technik (Product)' })
  const attribute = Object.fromEntries(gesendet.filter(([, u]) => u.startsWith('/api/model/attributes/')).map(([, u, b]) => [b.key, b]))
  assert.equal(attribute.ixp_breite_mm.group, 'ixp_technik_product'); assert.equal(attribute.ixp_breite_mm.inheritable, true)
  assert.equal(attribute.ixp_farbe.group, 'ixp_technik_variant'); assert.equal(attribute.ixp_farbe.inheritable, false)
  assert.deepEqual(attribute.ixp_breite_mm.label, { de: 'Breite mm', en: 'Breite mm' })
  assert.ok(gesagt.some(z => z.startsWith('Gruppe ixp_technik_product (ab product) angelegt')), gesagt.join('\n'))
})
