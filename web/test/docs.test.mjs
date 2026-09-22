// Dokumente lesen (pflegestruktur §32): aus Text werden Abschnitte — mit Überschrift und Seitenzahl, damit ein Treffer
// „Datenblatt, Seite 4“ sagen kann. Ohne Node-Abhängigkeiten, wie im Job.
import test from 'node:test'
import assert from 'node:assert/strict'
import { chunk, numbered, isHeading, fromHtml } from '../../plugins/docs/core.mjs'

test('Überschriften erkennen — kurz, ohne Satzzeichen am Ende, kein Fliesstext', () => {
  assert.ok(isHeading('Technische Daten'))
  assert.ok(isHeading('1. Verarbeitung'))
  assert.ok(isHeading('EIGENSCHAFTEN'))
  assert.ok(!isHeading('Der Klebstoff ist lösemittelfrei und wird mit der Zahnspachtel aufgetragen'))
  assert.ok(!isHeading('Hinweis:'))
  assert.ok(!isHeading(''))
})

test('Absätze werden Abschnitte, die Überschrift bleibt am Text', () => {
  const text = `Technische Daten

Viskosität 3500 mPas bei 20 °C. Offene Zeit 20 Minuten.

Verarbeitung

Mit der Zahnspachtel B1 auftragen.`
  const cs = chunk(text)
  assert.equal(cs.length, 2)
  assert.equal(cs[0].heading, 'Technische Daten')
  assert.match(cs[0].body, /3500 mPas/)
  assert.equal(cs[1].heading, 'Verarbeitung')
  assert.match(cs[1].body, /Zahnspachtel/)
})

test('lange Absätze werden an Satzenden geteilt, nichts geht verloren', () => {
  const satz = 'Der Klebstoff ist für saugende und nicht saugende Untergründe geeignet. '
  const cs = chunk(satz.repeat(40), { max: 400 })
  assert.ok(cs.length >= 5, 'geteilt')
  assert.ok(cs.every(c => c.body.length <= 500), JSON.stringify(cs.map(c => c.body.length)))
  const zusammen = cs.map(c => c.body).join(' ').replace(/\s+/g, ' ')
  assert.ok(zusammen.includes('saugende Untergründe geeignet'))
})

test('Seitenzahl bleibt am Abschnitt, Nummerierung läuft über die Seiten durch', () => {
  const seiten = ['Seite eins Text.', 'Seite zwei Text.']
  const cs = numbered(seiten.flatMap((t, i) => chunk(t, { page: i + 1 })))
  assert.deepEqual(cs.map(c => [c.seq, c.page]), [[0, 1], [1, 2]])
})

test('HTML: Tags weg, Blockenden werden Absätze, Entities aufgelöst', () => {
  const t = fromHtml('<h2>Vorteile</h2><p>Hält bis 120&nbsp;°C</p><script>weg()</script><p>L&ouml;semittelfrei</p>')
  assert.ok(!/</.test(t))
  assert.ok(!t.includes('weg()'))
  assert.match(t, /Hält bis 120 °C/)
  const cs = chunk(t)
  assert.ok(cs.length >= 1)
})

test('leerer Text ergibt keine Abschnitte', () => {
  assert.deepEqual(chunk(''), [])
  assert.deepEqual(chunk('   \n\n  '), [])
})
