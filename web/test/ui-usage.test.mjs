// Nutzungsbalken in den Einstellungen (Taloan, 22.09.2026): drei Balken — Tag, Woche, Monat — mit Zahl, Grenze und Prozent,
// darunter der Verlauf. Geprüft wird, was der Anwender sieht: Breite des Balkens, Farbe bei Enge, Umschalten des Verlaufs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, textOf } from './ui.mjs'

const UsageBars = (await import('../src/components/UsageBars.vue')).default

const usage = {
  today: '2026-09-22', head: 123456,
  day: { key: 'day', used: 1250, max: 5000, start: '2026-09-22', resetAt: '2026-09-23' },
  week: { key: 'week', used: 42000, max: 50000, start: '2026-09-21', resetAt: '2026-09-28' },
  month: { key: 'month', used: 290000, max: 300000, start: '2026-09-01', resetAt: '2026-10-01' },
}
const history = [{ start: '2026-09-22', count: 1250 }, { start: '2026-09-21', count: 40750 }, { start: '2026-09-20', count: 0 }]

test('drei Balken mit Zahl, Grenze und Prozent', () => {
  const w = mount(UsageBars, { props: { usage, history, period: 'day' } })
  const rows = w.findAll('.bar-row')
  assert.equal(rows.length, 3)
  const t = textOf(w)
  assert.match(t, /◷ Tag/); assert.match(t, /▤ Woche/); assert.match(t, /▦ Monat/)
  assert.match(rows[0].text(), /1\.250/, 'Zahl mit Tausenderpunkt')
  assert.match(rows[0].text(), /5\.000/, 'die Grenze steht daneben')
  assert.match(rows[0].text(), /25 %/)
})

test('Balkenbreite ist der Anteil, die Farbe sagt, wie eng es wird', () => {
  const w = mount(UsageBars, { props: { usage, history } })
  const fills = w.findAll('.fill')
  assert.match(fills[0].attributes('style') ?? '', /width:\s*25%/)
  assert.ok(fills[0].classes('pos'), 'ein Viertel: grün')
  assert.ok(fills[1].classes('warn'), '84 %: gelb')
  assert.ok(fills[2].classes('neg'), '96,7 %: rot')
})

test('der Balken läuft nie über die Spur hinaus', () => {
  const voll = { ...usage, day: { ...usage.day, used: 9999 } }
  const w = mount(UsageBars, { props: { usage: voll, history } })
  assert.match(w.findAll('.fill')[0].attributes('style') ?? '', /width:\s*100%/)
  assert.match(w.findAll('.bar-row')[0].text(), /9\.999/, 'die echte Zahl steht trotzdem da')
})

test('Verlauf: eine Zeile je Periode, Umschalten meldet die neue Periode', async () => {
  const w = mount(UsageBars, { props: { usage, history, period: 'day' } })
  assert.equal(w.findAll('.hrow').length, 3)
  assert.match(w.findAll('.hrow')[1].text(), /40\.750/)
  const chip = w.findAll('.view-chip').find(c => c.text().includes('Woche'))
  await chip.trigger('click')
  assert.deepEqual(w.emitted('period'), [['week']])
})

test('ohne Daten stürzt nichts ab und der Verlauf sagt, woran es liegt', () => {
  const leer = mount(UsageBars, { props: { usage: null, history: [], busy: true } })
  assert.equal(leer.findAll('.bar-row').length, 3)
  assert.match(textOf(leer), /wird geladen/)
  const fertig = mount(UsageBars, { props: { usage: null, history: [], busy: false } })
  assert.match(textOf(fertig), /noch nichts aufgezeichnet/)
})
