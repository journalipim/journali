// Verfügbare Limits in der Statusleiste (Taloan, 22.09.2026: „mach mir oben in die Leiste neben die KI-Nutzung 2 Balken
// für Woche und Monat“). Gezeigt wird, was noch da ist (Taloan, 23.09.2026: „man stellt Begrenzungen als positive
// Eigenschaften dar, denn was verfügbar ist, ist gut“): der Balken leert sich, die Zahl ist der Rest.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, textOf } from './ui.mjs'

const UsageMini = (await import('../src/components/UsageMini.vue')).default
const usage = {
  week: { used: 16800, max: 20000, resetAt: '2026-09-28' },
  month: { used: 45000, max: 100000, resetAt: '2026-10-01' },
}

test('zwei Balken mit Symbol und dem, was noch verfügbar ist', () => {
  const w = mount(UsageMini, { props: { usage } })
  const us = w.findAll('.u')
  assert.equal(us.length, 2)
  assert.match(us[0].text(), /▤/); assert.match(us[0].text(), /16%/, '3.200 von 20.000 sind noch da')
  assert.match(us[1].text(), /▦/); assert.match(us[1].text(), /55%/)
})

test('Farbe und Breite folgen dem, was übrig ist', () => {
  const w = mount(UsageMini, { props: { usage } })
  const fills = w.findAll('.fill')
  assert.match(fills[0].attributes('style') ?? '', /width:\s*16%/, 'der Balken zeigt den Rest')
  assert.ok(fills[0].classes('warn'), '16 % übrig: gelb')
  assert.ok(fills[1].classes('pos'), '55 % übrig: grün')
  const eng = mount(UsageMini, { props: { usage: { ...usage, week: { used: 19500, max: 20000 } } } })
  assert.ok(eng.findAll('.fill')[0].classes('neg'), '3 % übrig: rot')
})

test('der Tooltip sagt, was verfügbar ist und wann es wieder voll ist', () => {
  const w = mount(UsageMini, { props: { usage } })
  assert.match(w.findAll('.u')[0].attributes('title') ?? '', /Woche: noch 3\.200 von 20\.000 verfügbar \(16 %\), wieder voll am 2026-09-28/)
})

test('ohne Zahlen bleibt die Leiste leer, statt zu wackeln', () => {
  const w = mount(UsageMini, { props: { usage: null } })
  assert.equal(textOf(w), '')
})
