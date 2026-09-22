// Nutzung in der Statusleiste (Taloan, 22.09.2026: „mach mir oben in die Leiste neben die KI-Nutzung 2 Balken für
// Woche und Monat“): zwei schmale Balken mit Prozent, feste Breiten, Farbe ab 60 und 85 Prozent.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, textOf } from './ui.mjs'

const UsageMini = (await import('../src/components/UsageMini.vue')).default
const usage = {
  week: { used: 16800, max: 20000, resetAt: '2026-09-28' },
  month: { used: 45000, max: 100000, resetAt: '2026-10-01' },
}

test('zwei Balken mit Symbol und Prozent', () => {
  const w = mount(UsageMini, { props: { usage } })
  const us = w.findAll('.u')
  assert.equal(us.length, 2)
  assert.match(us[0].text(), /▤/); assert.match(us[0].text(), /84%/)
  assert.match(us[1].text(), /▦/); assert.match(us[1].text(), /45%/)
})

test('Farbe und Breite folgen der Auslastung', () => {
  const w = mount(UsageMini, { props: { usage } })
  const fills = w.findAll('.fill')
  assert.match(fills[0].attributes('style') ?? '', /width:\s*84%/)
  assert.ok(fills[0].classes('warn'), '84 %: gelb')
  assert.ok(fills[1].classes('pos'), '45 %: grün')
  const eng = mount(UsageMini, { props: { usage: { ...usage, week: { used: 19500, max: 20000 } } } })
  assert.ok(eng.findAll('.fill')[0].classes('neg'), '98 %: rot')
})

test('Tooltip nennt Zahl, Grenze und Stichtag', () => {
  const w = mount(UsageMini, { props: { usage } })
  assert.match(w.findAll('.u')[0].attributes('title') ?? '', /Woche: 16\.800 von 20\.000 Einträgen \(84 %\), zurück auf 0 am 2026-09-28/)
})

test('ohne Zahlen bleibt die Leiste leer, statt zu wackeln', () => {
  const w = mount(UsageMini, { props: { usage: null } })
  assert.equal(textOf(w), '')
})
