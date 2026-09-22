// Massenbearbeitung von Attributen (Taloan, 22.09.2026: „jetzt wäre natürlich schön, wenn ich Massenbearbeitung von
// Attributen machen könnte“): je Eigenschaft eine Zeile. Geprüft wird, was die Leiste meldet — geschrieben wird draussen.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, textOf } from './ui.mjs'

const AttrBulk = (await import('../src/components/AttrBulk.vue')).default
const props = {
  count: 69,
  groups: [{ key: 'etim', label: { de: 'ETIM' } }, { key: 'techdata_cpu', label: { de: 'CPU' } }],
  units: [{ key: 'mm', label: { de: 'Millimeter' }, quantity: 'length' }],
  roles: ['group', 'product', 'variant'],
  roleLabel: { group: '▣ Produktgruppe', product: '▦ Produkt', variant: '◆ Variante' },
}
const btn = (w, text) => w.findAll('button').find(b => b.text().includes(text))

test('die Zahl der Gewählten steht auf jedem Knopf', () => {
  const w = mount(AttrBulk, { props })
  assert.ok(w.findAll('button').filter(b => b.text().includes('→ 69')).length >= 2)
})

test('Gruppe: der Knopf bleibt gesperrt, bis eine gewählt ist', async () => {
  const w = mount(AttrBulk, { props })
  const b = btn(w, '→ 69')
  assert.equal(b.attributes('disabled') !== undefined, true, 'ohne Auswahl gesperrt')
  await w.findAll('select')[0].setValue('etim')
  assert.equal(btn(w, '→ 69').attributes('disabled'), undefined)
  await btn(w, '→ 69').trigger('click')
  assert.deepEqual(w.emitted('apply'), [[{ kind: 'group', value: 'etim' }]])
})

test('Ebenen: Kacheln an- und abwählen, der Knopf meldet die Liste', async () => {
  const w = mount(AttrBulk, { props })
  const chips = w.findAll('.view-chip')
  assert.equal(chips.length, 3)
  assert.ok(chips.every(c => c.classes('on')), 'am Anfang alle drei')
  await chips[0].trigger('click')   // Produktgruppe heraus
  const go = w.findAll('.row')[1].find('button')
  await go.trigger('click')
  assert.deepEqual(w.emitted('apply'), [[{ kind: 'levels', value: ['product', 'variant'] }]])
})

test('Schalter melden an und aus', async () => {
  const w = mount(AttrBulk, { props })
  const row = w.findAll('.row').find(r => r.text().includes('vererbbar'))
  await row.findAll('button')[0].trigger('click')
  await row.findAll('button')[1].trigger('click')
  assert.deepEqual(w.emitted('apply'), [[{ kind: 'inheritable', value: true }], [{ kind: 'inheritable', value: false }]])
})

test('Einheit nur, wenn alle Gewählten Zahlen sind', () => {
  assert.ok(!textOf(mount(AttrBulk, { props })).includes('Einheit'))
  assert.ok(textOf(mount(AttrBulk, { props: { ...props, numericOnly: true } })).includes('⚖ Einheit'))
})

test('während des Schreibens ist alles gesperrt und der Fortschritt steht da', () => {
  const w = mount(AttrBulk, { props: { ...props, busy: '12 von 69 …' } })
  assert.match(textOf(w), /12 von 69/)
  assert.ok(w.findAll('button').every(b => b.attributes('disabled') !== undefined))
})
