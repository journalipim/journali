// Massenbearbeitung von Attributen (Taloan, 22.09.2026). Der Kern der Prüfung ist der Stand der Auswahl:
// „alle an“, „alle aus“ oder „gemischt · 69 von 70 an“ — und dass ein Klick durchschaltet (gemischt → alle an → alle aus).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, textOf } from './ui.mjs'

const AttrBulk = (await import('../src/components/AttrBulk.vue')).default
const roles = ['group', 'product', 'variant']
const roleLabel = { group: '▣ Produktgruppe', product: '▦ Produkt', variant: '◆ Variante' }
const A = (key, o = {}) => ({ key, type: 'text', group: 'etim', inheritable: true, axes: [], levels: null, ...o })
const base = {
  groups: [{ key: 'etim', label: { de: 'ETIM' } }],
  units: [{ key: 'mm', label: { de: 'Millimeter' }, quantity: 'length' }],
  roles, roleLabel,
}
const chipOf = (w, label) => w.findAll('.view-chip').find(c => c.text().startsWith(label))   // ▣ Produktgruppe und ▦ Produkt auseinanderhalten
const rowOf = (w, label) => w.findAll('.row').find(r => r.text().includes(label))

test('alle gleich: der Stand sagt „alle an“, die Kachel ist voll', () => {
  const w = mount(AttrBulk, { props: { ...base, attrs: [A('a'), A('b')] } })
  const chip = chipOf(w, '▣ Produktgruppe')
  assert.ok(chip.classes('on') && !chip.classes('mixed'))
  assert.match(rowOf(w, 'vererbbar').text(), /alle an/)
})

test('gemischt wird gezeigt — Kachel gestrichelt, Zahl dahinter (Taloan, 22.09.)', () => {
  // 69 Attribute ohne Produktgruppe, eines mit — genau Taloans Fall
  const attrs = [...Array(69)].map((_, i) => A('ef' + i, { levels: ['product', 'variant'] })).concat(A('etim_class'))
  const w = mount(AttrBulk, { props: { ...base, attrs } })
  const chip = chipOf(w, '▣ Produktgruppe')
  assert.ok(chip.classes('mixed'), 'gemischt ist zu sehen')
  assert.ok(!chip.classes('on'))
  assert.match(chip.text(), /1\/70/)
  assert.match(chip.attributes('title') ?? '', /gemischt · 1 von 70 an · Klick setzt alle an/)
  // die anderen beiden Ebenen stehen bei allen an
  assert.ok(chipOf(w, '▦ Produkt').classes('on') && !chipOf(w, '▦ Produkt').classes('mixed'))
})

test('Klick schaltet durch: gemischt → alle an → alle aus', async () => {
  const gemischt = [A('a', { levels: ['product'] }), A('b')]
  const w = mount(AttrBulk, { props: { ...base, attrs: gemischt } })
  await chipOf(w, '▣ Produktgruppe').trigger('click')
  assert.deepEqual(w.emitted('apply'), [[{ kind: 'lv_group', value: true }]], 'gemischt → alle an')

  const alle = mount(AttrBulk, { props: { ...base, attrs: [A('a'), A('b')] } })
  await chipOf(alle, '▣ Produktgruppe').trigger('click')
  assert.deepEqual(alle.emitted('apply'), [[{ kind: 'lv_group', value: false }]], 'alle an → alle aus')

  const keine = mount(AttrBulk, { props: { ...base, attrs: [A('a', { levels: ['variant'] })] } })
  await chipOf(keine, '▣ Produktgruppe').trigger('click')
  assert.deepEqual(keine.emitted('apply'), [[{ kind: 'lv_group', value: true }]], 'alle aus → alle an')
})

test('Schalter zeigen den Stand und melden an/aus', async () => {
  const w = mount(AttrBulk, { props: { ...base, attrs: [A('a', { axes: ['locale'] }), A('b')] } })
  const row = rowOf(w, 'sprachabhängig')
  assert.match(row.text(), /gemischt · 1 von 2 an/)
  await row.findAll('button')[0].trigger('click')
  assert.deepEqual(w.emitted('apply'), [[{ kind: 'locale', value: true }]])
  // wo alle gleich stehen, ist der zutreffende Schalter hervorgehoben
  const aus = mount(AttrBulk, { props: { ...base, attrs: [A('a'), A('b')] } })
  assert.ok(rowOf(aus, 'sprachabhängig').findAll('button')[1].classes('on'))
})

test('Einheit nur, wenn alle Gewählten Zahlen sind', () => {
  assert.ok(!textOf(mount(AttrBulk, { props: { ...base, attrs: [A('a'), A('b', { type: 'decimal' })] } })).includes('⚖ Einheit'))
  assert.ok(textOf(mount(AttrBulk, { props: { ...base, attrs: [A('a', { type: 'decimal' }), A('b', { type: 'integer' })] } })).includes('⚖ Einheit'))
})

test('während des Schreibens ist alles gesperrt und der Fortschritt steht da', () => {
  const w = mount(AttrBulk, { props: { ...base, attrs: [A('a')], busy: '12 von 70 …' } })
  assert.match(textOf(w), /12 von 70/)
  assert.ok(w.findAll('button').every(b => b.attributes('disabled') !== undefined))
})
