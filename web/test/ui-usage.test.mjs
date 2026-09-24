// Zwei Balken in den Einstellungen: Woche und Monat, mit dem Genutzten, dem Kontingent und dem
// Anteil, darunter der Verlauf. Ein Balken füllt sich mit dem Verbrauch; was verfügbar ist, steht
// als Zeile darüber. Kein Tageslimit („macht man 3 Testimporte und muss aufhören“), der Tag steht nur als Zahl.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mount, textOf } from './ui.mjs'

const UsageBars = (await import('../src/components/UsageBars.vue')).default

const usage = {
  today: '2026-09-22', head: 123456,
  day: { key: 'day', used: 1250, max: null, start: '2026-09-22', resetAt: '2026-09-23' },
  week: { key: 'week', used: 16800, max: 20000, start: '2026-09-21', resetAt: '2026-09-28' },
  month: { key: 'month', used: 97000, max: 100000, start: '2026-09-01', resetAt: '2026-10-01' },
  all: { day: 5788, week: 45000, month: 131000 },   // darin: Modell, Struktur, Kataloge, Betrieb — die zählen nicht
}
// echte Tage aus die Journal: am 20.09. kam der ETIM-Katalog (29.371 Einträge, davon 724 Tagesgeschäft)
const history = [{ start: '2026-09-22', count: 47, all: 5788 }, { start: '2026-09-21', count: 1306, all: 1323 }, { start: '2026-09-20', count: 724, all: 29371 }]

test('zwei Balken — Woche und Monat — mit Genutztem, Kontingent und Anteil', () => {
  const w = mount(UsageBars, { props: { usage, history, period: 'day' } })
  const rows = w.findAll('.bar-row')
  assert.equal(rows.length, 2, 'kein Tagesbalken')
  assert.match(rows[0].text(), /▤ Woche/)
  assert.match(rows[0].text(), /16\.800/, 'Zahl, Balken und Prozent zeigen dasselbe')
  assert.match(rows[0].text(), /20\.000/); assert.match(rows[0].text(), /84 %/)
  assert.match(rows[1].text(), /▦ Monat/)
})

test('der Tag wird gezählt, aber nicht begrenzt', () => {
  const w = mount(UsageBars, { props: { usage, history } })
  assert.match(textOf(w), /heute 1\.250/)
  assert.doesNotMatch(textOf(w), /◷ Tag 1\.250 \//, 'keine Grenze am Tag')
})

test('Farbe sagt, wie eng es wird', () => {
  const w = mount(UsageBars, { props: { usage, history } })
  const fills = w.findAll('.fill')
  assert.ok(fills[0].classes('warn'), '84 %: gelb')
  assert.ok(fills[1].classes('neg'), '97 %: rot')
  const ruhig = mount(UsageBars, { props: { usage: { ...usage, week: { ...usage.week, used: 2000 } }, history } })
  assert.ok(ruhig.findAll('.fill')[0].classes('pos'), '10 %: grün')
})

test('der Balken läuft nie über die Spur hinaus', () => {
  const voll = { ...usage, week: { ...usage.week, used: 33333 } }
  const w = mount(UsageBars, { props: { usage: voll, history } })
  assert.match(w.findAll('.fill')[0].attributes('style') ?? '', /width:\s*100%/)
  const zeile = w.findAll('.bar-row')[0].text()
  assert.match(zeile, /33\.333/, 'die echte Zahl steht trotzdem da')
  assert.ok(!zeile.includes('-'), 'und nichts wird negativ')
})

test('Verlauf: eine Zeile je Periode, Umschalten meldet die neue Periode', async () => {
  const w = mount(UsageBars, { props: { usage, history, period: 'day' } })
  assert.equal(w.findAll('.hrow').length, 3)
  assert.match(w.findAll('.hrow')[1].text(), /1\.306/)
  const chip = w.findAll('.view-chip').find(c => c.text().includes('Woche'))
  await chip.trigger('click')
  assert.deepEqual(w.emitted('period'), [['week']])
})

test('ohne Daten stürzt nichts ab und der Verlauf sagt, woran es liegt', () => {
  const leer = mount(UsageBars, { props: { usage: null, history: [], busy: true } })
  assert.equal(leer.findAll('.bar-row').length, 2)
  assert.match(textOf(leer), /wird geladen/)
  const fertig = mount(UsageBars, { props: { usage: null, history: [], busy: false } })
  assert.match(textOf(fertig), /noch nichts aufgezeichnet/)
})

test('was nicht zählt, steht als Zuschlag daneben', () => {
  const w = mount(UsageBars, { props: { usage, history } })
  assert.match(w.findAll('.bar-row')[0].text(), /\+28\.200/, 'Woche: 45.000 gesamt minus 16.800 Tagesgeschäft')
  assert.match(w.findAll('.bar-row')[0].text(), /16\.800/, 'der Balken selbst bleibt das Tagesgeschäft')
})

test('Verlauf: der helle Teil ist, was nicht zählt', () => {
  const w = mount(UsageBars, { props: { usage, history, period: 'day' } })
  const row = w.findAll('.hrow')[2]   // 20.09., der Katalogtag
  assert.match(row.text(), /724/)
  const [rest, work] = row.findAll('.hfill')
  assert.match(rest.attributes('style') ?? '', /width:\s*100%/, 'der Katalogtag ist der längste Balken')
  assert.match(work.attributes('style') ?? '', /width:\s*2%/, 'davon zählt fast nichts')
})
