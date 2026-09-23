// Zwei schmale Balken in der Statusleiste (Taloan, 22.09.2026: „mach mir oben in die Leiste neben die KI-Nutzung 2
// Balken für Woche und Monat“). Ein Balken füllt sich mit dem, was genutzt wurde (Taloan, 23.09.2026); was verfügbar
// ist, sagt der Tooltip. Die Prozentzahl steht links an ihrem eigenen Balken — nicht am nächsten (Taloan, 23.09.2026).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, textOf } from './ui.mjs'

const UsageMini = (await import('../src/components/UsageMini.vue')).default
const usage = {
  week: { used: 16800, max: 20000, resetAt: '2026-09-28' },
  month: { used: 45000, max: 100000, resetAt: '2026-10-01' },
}

test('zwei Balken mit Symbol und dem, was genutzt wurde', () => {
  const w = mount(UsageMini, { props: { usage } })
  const us = w.findAll('.u')
  assert.equal(us.length, 2)
  assert.match(us[0].text(), /▤/); assert.match(us[0].text(), /84%/, '16.800 von 20.000 sind genutzt')
  assert.match(us[1].text(), /▦/); assert.match(us[1].text(), /45%/)
})

test('der Balken füllt sich mit dem Verbrauch', () => {
  const w = mount(UsageMini, { props: { usage } })
  const fills = w.findAll('.fill')
  assert.match(fills[0].attributes('style') ?? '', /width:\s*84%/, 'der Balken zeigt das Genutzte')
  assert.ok(fills[0].classes('warn'), '84 % genutzt: gelb')
  assert.ok(fills[1].classes('pos'), '45 % genutzt: grün')
  const eng = mount(UsageMini, { props: { usage: { ...usage, week: { used: 19500, max: 20000 } } } })
  assert.ok(eng.findAll('.fill')[0].classes('neg'), '98 % genutzt: rot')
})

test('der Tooltip sagt beides: genutzt und noch verfügbar', () => {
  const w = mount(UsageMini, { props: { usage } })
  assert.match(w.findAll('.u')[0].attributes('title') ?? '', /Woche: 16\.800 von 20\.000 genutzt · noch 3\.200 verfügbar, wieder voll am 2026-09-28/)
})

test('die Prozentzahl steht an ihrem eigenen Balken, nicht am nächsten', () => {
  const w = mount(UsageMini, { props: { usage } })
  const zahl = w.findAll('.u')[0].find('.pc')
  assert.ok(zahl.exists(), 'die Zahl gehört in die Gruppe ihres Balkens')
  assert.equal(w.findAll('.u')[0].findAll('.track').length, 1, 'eine Gruppe, ein Balken, eine Zahl')
})

test('ohne Zahlen bleibt die Leiste leer, statt zu wackeln', () => {
  const w = mount(UsageMini, { props: { usage: null } })
  assert.equal(textOf(w), '')
})
