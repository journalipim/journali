// Dokumente lesen (pflegestruktur §32): aus Text werden Abschnitte — mit Überschrift und Seitenzahl, damit ein Treffer
// „Datenblatt, Seite 4“ sagen kann. Ohne Node-Abhängigkeiten, wie im Job.
import test from 'node:test'
import assert from 'node:assert/strict'
import { chunk, numbered, isHeading, fromHtml, dropRunningLines, joinHyphens, pack } from '../../plugins/docs/core.mjs'

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

// Am echten Datenblatt gelernt (Tridonic TALEXXdriver) — die drei Fälle, die dort schiefgingen
test('Tabellenzeilen sind keine Überschriften', () => {
  assert.ok(!isHeading('Netzspannungsbereich 220 – 240 V'))
  assert.ok(!isHeading('Leistungsaufnahme im Stand-by 0,16 W'))
  assert.ok(!isHeading('Nominale Lebensdauer 100.000 h'))
  assert.ok(isHeading('Technische Daten'), 'echte Überschriften bleiben')
  assert.ok(isHeading('Produktbeschreibung'))
})

test('Silbentrennung am Zeilenende wird zusammengezogen', () => {
  assert.equal(joinHyphens('Stoßstrom-\nverstärkung'), 'Stoßstromverstärkung')
  assert.equal(joinHyphens('LED-\nTreiber'), 'LED-\nTreiber', 'Bindestrich vor Grossbuchstabe bleibt')
  assert.ok(!isHeading('Leerlauf, Eingangsspannungsbereich, reduzierte Stoßstrom-'), 'umbrochene Zeile ist keine Überschrift')
})

test('Kopf- und Fusszeilen, die auf jeder Seite stehen, fallen weg', () => {
  const seiten = [
    'www.tridonic.com 1\nDatenblatt 01/20\nProduktbeschreibung\nDimmbarer Treiber',
    'www.tridonic.com 2\nDatenblatt 01/20\nTechnische Daten\nNetzspannung 220 V',
    'www.tridonic.com 3\nDatenblatt 01/20\nMasse\nLänge 150 mm',
  ]
  const sauber = dropRunningLines(seiten)
  assert.ok(sauber.every(p => !p.includes('tridonic')), 'die Kopfzeile ist weg — auch mit wechselnder Seitenzahl')
  assert.ok(sauber.every(p => !p.includes('Datenblatt 01/20')))
  assert.ok(sauber[1].includes('Netzspannung 220 V'), 'der Inhalt bleibt')
})

test('Zwerge werden zusammengelegt, die Überschrift bleibt im Text', () => {
  const klein = [
    { page: 1, heading: 'Gehäuse', body: 'Kunststoff, IP20' },
    { page: 1, heading: 'Schnittstellen', body: 'DALI, DSI' },
    { page: 2, heading: 'Masse', body: 'Länge 150 mm' },
  ]
  const p = pack(klein, { min: 200, max: 900 })
  assert.equal(p.length, 2, 'Seite 1 zusammen, Seite 2 eigen — über Seitengrenzen wird nicht gemischt')
  assert.match(p[0].body, /Kunststoff, IP20/)
  assert.match(p[0].body, /Schnittstellen: DALI, DSI/, 'die Überschrift des Zwergs steht im Text')
  assert.equal(p[1].page, 2)
})

// ---- Tabellen (27.09.2026, 34 L): Zellen aus der x-Lage, Schlüssel/Wert-Zeilen, Tabellen mit Überschrift
import { cellsOf, findTables, pairsFromText, isKeyValueRow, numberedTables } from '../../plugins/docs/core.mjs'

test('Zellen: ein Sprung nach rechts trennt, ein Wortabstand nicht', () => {
  // „Netzspannung“ (x 40–110) … „220 – 240 V“ ab x 300
  const items = [{ x: 40, w: 70, str: 'Netzspannung' }, { x: 300, w: 60, str: '220 – 240 ' }, { x: 361, w: 8, str: 'V' }]
  assert.deepEqual(cellsOf(items), ['Netzspannung', '220 – 240 V'])
  assert.deepEqual(cellsOf([{ x: 40, w: 30, str: 'Der ' }, { x: 71, w: 40, str: 'Klebstoff' }]), ['Der Klebstoff'])
  assert.deepEqual(cellsOf([{ str: 'ohne Lage' }, { str: ' bleibt eins' }]), ['ohne Lage bleibt eins'])
})

test('eine Zeile Schlüssel/Wert: Name links, Wert rechts — kein Satz, keine Einzelzelle', () => {
  assert.ok(isKeyValueRow(['Gewicht', '1,2 kg']))
  assert.ok(isKeyValueRow(['Netzspannung:', '220 – 240 V']))
  assert.ok(!isKeyValueRow(['Seite 1 von 3']))
  assert.ok(!isKeyValueRow(['Der Klebstoff ist lösemittelfrei und wird mit der Zahnspachtel aufgetragen.', 'x']))
  assert.ok(!isKeyValueRow(['12', 'Stück']), 'ein Schlüssel beginnt mit einem Buchstaben')
})

test('drei Zeilen hintereinander sind eine Tabelle, die Überschrift davor gehört dazu; zwei sind keine', () => {
  const seite = [
    ['Technische Daten'],
    ['Gewicht', '1,2 kg'], ['Durchmesser:', '22 mm'], ['Farbe', 'blau'],
    ['Der Klebstoff ist lösemittelfrei.'],
    ['Seite', '1'], ['von', '3'],
  ]
  const t = findTables([seite])
  assert.equal(t.length, 1)
  assert.equal(t[0].heading, 'Technische Daten'); assert.equal(t[0].page, 1)
  assert.deepEqual(t[0].rows, [['Gewicht', '1,2 kg'], ['Durchmesser', '22 mm'], ['Farbe', 'blau']], 'der Doppelpunkt am Schlüssel geht')
  assert.deepEqual(numberedTables(t).map(x => x.seq), [0])
})

test('aus blossem Text: „Schlüssel: Wert“, Tabulator oder zwei Leerzeichen', () => {
  const text = 'Technische Daten\nGewicht: 1,2 kg\nBreite\t22 mm\nFarbe  blau\n\nDer Klebstoff ist lösemittelfrei.'
  const t = pairsFromText(text)
  assert.equal(t.length, 1); assert.equal(t[0].page, null)
  assert.deepEqual(t[0].rows, [['Gewicht', '1,2 kg'], ['Breite', '22 mm'], ['Farbe', 'blau']])
  assert.deepEqual(pairsFromText('Hinweis: bitte lesen\nNoch einer: ja'), [], 'zwei Zeilen sind keine Tabelle')
})
