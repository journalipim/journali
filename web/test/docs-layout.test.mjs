// Typografie-Leser (28.09.2026): ein PDF trägt sein Layout — Schriftgrösse, Schnitt und Lage sagen, was Überschrift,
// Spalte und Tabelle ist. Geprüft wird ohne PDF: die Textstücke sind gesetzt wie in einem Dokument (x/y linke
// Grundlinie, h Schriftgrösse, font der Schnitt), so wie pdf.mjs sie aus pdfjs liefert.
import test from 'node:test'
import assert from 'node:assert/strict'
import { lines, tables, blocks, order, roles, blockText, analysePage, layoutDocument, bodyOf, paragraphs, spaltenBahn, seitenBloecke } from '../../plugins/docs/layout.mjs'

const BUCH = 'Serif-Book', FETT = 'Serif-Bold'
/// Ein Textstück: Breite aus der Zeichenzahl, damit die Lage stimmt, ohne sie je Stück auszurechnen
const s = (str, x, y, { h = 10, font = BUCH, w = null } = {}) => ({ str, x, y, w: w ?? str.length * h * 0.5, h, font })
/// Ein Absatz: Zeilen untereinander, je Zeile ein Stück
const absatz = (zeilen, x, y, o = {}) => zeilen.map((z, i) => s(z, x, y - i * (o.h ?? 10) * 1.2, o))

test('Überschrift an der Grösse, Fliesstext ist die häufigste Grösse — die Stufe folgt der Grösse', () => {
  const items = [
    s('Tunable White', 30, 700, { h: 24, font: FETT }),
    ...absatz(['Die Farbtemperatur folgt dem Tageslicht und wird stufenlos geregelt.',
      'Der Treiber hält den Farbort über den ganzen Dimmbereich konstant.',
      'Die Module sind kalibriert und werden als Kit geliefert.'], 30, 660),
    s('Montage', 30, 600, { h: 14, font: FETT }),
    ...absatz(['Das Gerät wird flach auf Metall montiert, damit die Wärme abfliesst.',
      'Die Zuleitung ist zugentlastet zu führen und darf nicht scheuern.',
      'Der Abstand zur Leuchte beträgt mindestens zwanzig Millimeter.'], 30, 560),
  ]
  const { blocks: bs, bodySize } = analysePage(items)
  assert.equal(bodySize, 10, 'die Grösse mit den meisten Zeichen ist der Fliesstext')
  assert.deepEqual(bs.map(b => [b.role, b.level, blockText(b).split('\n')[0].slice(0, 20)]), [
    ['heading', 1, 'Tunable White'], ['text', null, 'Die Farbtemperatur f'],
    ['heading', 2, 'Montage'], ['text', null, 'Das Gerät wird flach'],
  ], 'zwei Stufen: 24 pt vor 14 pt')
})

test('zwei Textspalten sind zwei Blöcke, links vor rechts — und keine Tabelle', () => {
  const links = ['Die natürliche Farbveränderung, die das Licht im', 'Laufe des Tages erfährt, dient als Vorbild für die',
    'Technik. Feinste Nuancen verändern die Stimmung.', 'Sie wirken auf Menschen und auf Objekte.']
  const rechts = ['Der Mensch verbringt den Grossteil seines Tages', 'in geschlossenen Räumen. Stufenlos regelbare',
    'Farbtemperaturen bringen die Wirkung von aussen', 'nach innen und gehen auf Bedürfnisse ein.']
  const items = [...absatz(links, 30, 700), ...absatz(rechts, 300, 700)]
  const ls = lines(items)
  assert.equal(tables(ls).length, 0, 'zwei Absätze nebeneinander sind keine Tabelle')
  const bs = order(blocks(ls))
  assert.equal(bs.length, 2)
  assert.match(blockText(bs[0]), /^Die natürliche/, 'links zuerst')
  assert.match(blockText(bs[1]), /^Der Mensch/)
  assert.equal(paragraphs(ls).size, 8, 'alle acht Zeilen sind geschützter Fliesstext')
})

test('eine Zeile, die den Satz fortsetzt, bleibt im Absatz — sie wird keine Überschrift', () => {
  const items = [
    s('Human Centric Lighting', 30, 700, { h: 18, font: FETT }),
    ...absatz(['Neben perfekten Seh- und Arbeitsbedingungen zielt HCL vorrangig auf',
      'den circadianen Rhythmus ab, der die innere Uhr des Menschen steuert.',
      'Kaltweisses Licht wirkt aktivierend, warmweisses Licht beruhigt.'], 30, 660),
  ]
  const { blocks: bs } = analysePage(items)
  assert.deepEqual(bs.map(b => b.role), ['heading', 'text'])
  assert.match(blockText(bs[1]), /^Neben perfekten Seh- und Arbeitsbedingungen zielt HCL vorrangig auf\n/)
})

test('Tabelle: Spalten aus den Kanten, umbrochener Kopf je Spalte zusammengesetzt', () => {
  const kopf = { h: 7, font: FETT }, zelle = { h: 7 }
  const items = [
    s('Treiber PRE', 30, 700, { h: 10, font: FETT }),
    // Kopf über drei Zeilen: „Ausgangs-“ / „spannung“ / „(V)“
    s('Typ', 30, 640, kopf), s('Ausgangs-', 200, 648, kopf), s('Ausgangs-', 300, 648, kopf), s('Größe', 400, 644, kopf),
    s('strom', 200, 640, kopf), s('spannung', 300, 640, kopf), s('(mm)', 400, 636, kopf),
    s('(mA)', 200, 632, kopf), s('(V)', 300, 632, kopf),
    s('LCA 50W lp PRE', 30, 610, zelle), s('350–1.050', 200, 610, zelle), s('20–50', 300, 610, zelle), s('360 x 30', 400, 610, zelle),
    s('LCA 85W lp PRE', 30, 598, zelle), s('600–1.800', 200, 598, zelle), s('20–50', 300, 598, zelle), s('360 x 30', 400, 598, zelle),
    s('LCA 100W lp PRE', 30, 586, zelle), s('350–1.050', 200, 586, zelle), s('20–50', 300, 586, zelle), s('360 x 40', 400, 586, zelle),
  ]
  const [t] = tables(lines(items))
  assert.ok(t, 'eine Tabelle')
  assert.deepEqual(t.header, ['Typ', 'Ausgangsstrom (mA)', 'Ausgangsspannung (V)', 'Größe (mm)'])
  assert.deepEqual(t.rows, [
    ['LCA 50W lp PRE', '350–1.050', '20–50', '360 x 30'],
    ['LCA 85W lp PRE', '600–1.800', '20–50', '360 x 30'],
    ['LCA 100W lp PRE', '350–1.050', '20–50', '360 x 40'],
  ])
  assert.equal(t.table, true)
})

test('Schlüssel und Wert: drei Zeilen gehen als Tabelle in den Index, der Text bleibt daneben', () => {
  const pages = [{ page: 1, items: [
    s('Technische Daten', 30, 700, { h: 14, font: FETT }),
    s('Frequenzgang', 30, 660), s('10 Hz – 40 kHz', 230, 660),
    s('Impedanz', 30, 640), s('17 Ω', 230, 640),
    s('Treiber-Einheit', 30, 620), s('9,2 mm dynamisch', 230, 620),
  ] }]
  const { chunks, tables: tb } = layoutDocument(pages)
  assert.equal(tb.length, 1)
  assert.equal(tb[0].heading, 'Technische Daten')
  assert.deepEqual(tb[0].rows, [['Frequenzgang', '10 Hz – 40 kHz'], ['Impedanz', '17 Ω'], ['Treiber-Einheit', '9,2 mm dynamisch']])
  assert.ok(chunks.some(c => /Frequenzgang \| 10 Hz/.test(c.body)), 'im Text steht die Tabelle auch')
})

test('Kopf- und Fusszeilen, die auf den meisten Seiten stehen, fallen weg', () => {
  const seite = n => ({ page: n, items: [
    s('www.beispiel.example', 30, 780, { h: 6 }),
    s(`Datenblatt 01/20`, 400, 780, { h: 6 }),
    s(['Treiber', 'Module', 'Steuerung', 'Zubehör'][n - 1], 30, 700, { h: 14, font: FETT }),
    ...absatz([`Auf dieser Seite geht es um ${['Treiber', 'Module', 'Steuerung', 'Zubehör'][n - 1]} und ihre Eigenschaften.`,
      `Der Absatz füllt die Spalte und ist auf jeder Seite ein anderer Text, Nummer ${n}.`], 30, 660),
  ] })
  const { chunks } = layoutDocument([seite(1), seite(2), seite(3), seite(4)])
  assert.equal(chunks.some(c => /beispiel\.example/.test(c.body)), false, 'die Kopfzeile ist weg')
  assert.equal(chunks.some(c => /Datenblatt 01\/20/.test(c.body)), false)
  assert.deepEqual(chunks.map(c => c.heading), ['Treiber', 'Module', 'Steuerung', 'Zubehör'])
})

test('Zwerge derselben Überschrift werden ein Abschnitt, lange Blöcke bleiben getrennt', () => {
  const items = [s('Hinweise', 30, 700, { h: 14, font: FETT })]
  for (let i = 0; i < 6; i++) items.push(s(`Kurzer Hinweis Nummer ${i}.`, 30, 660 - i * 40))
  const { chunks } = layoutDocument([{ page: 1, items }])
  assert.equal(chunks.length, 1, 'sechs Schnipsel sind ein Abschnitt')
  assert.equal(chunks[0].heading, 'Hinweise')
  assert.match(chunks[0].body, /Nummer 0[\s\S]*Nummer 5/)
})

test('Fliesstext des ganzen Dokuments: eine Seite voller Tabellen bekommt keine eigene Norm', () => {
  const text = n => ({ page: n, items: absatz(['Ein Satz in der üblichen Schriftgrösse des Dokuments steht hier.',
    'Noch ein Satz in derselben Grösse, damit die Zeichen zählen.', 'Und ein dritter Satz, der die Spalte füllt.'], 30, 700) })
  const tabelle = { page: 3, items: [
    s('Typ', 30, 700, { h: 7, font: FETT }), s('Wert', 200, 700, { h: 7, font: FETT }),
    s('A', 30, 688, { h: 7 }), s('1', 200, 688, { h: 7 }),
    s('B', 30, 676, { h: 7 }), s('2', 200, 676, { h: 7 }),
  ] }
  const body = bodyOf([text(1), text(2), tabelle])
  assert.equal(body.bodySize, 10)
  assert.equal(body.bodyFont, BUCH)
})

test('zwei Spalten: die Bahn dazwischen trennt, die linke Spalte kommt ganz vor der rechten', () => {
  const links = ['Diese Deklaration basiert auf den Regeln:', 'PCR-B: Anforderungen an die Erklärung für',
    'Leuchten, Lichtquellen und Vorschaltgeräte.', 'Ausstellungsdatum', '2026-05-25']
  const rechts = ['Gültigkeitsbereich:', 'Die Deklaration gilt für eine Komponente', 'TW CLE 261 (Artikelnummer: 89603436).',
    'Das Produkt wird am Standort hergestellt.', 'Grundlage der Berechnung ist ein Mix.']
  const items = [
    s('1. Allgemeine Angaben', 30, 760, { h: 14, font: FETT }),   // über beide Spalten
    ...links.map((z, i) => s(z, 30, 720 - i * 14, { h: 8, font: i === 0 || i === 3 ? FETT : BUCH })),
    ...rechts.map((z, i) => s(z, 300, 720 - i * 14, { h: 8, font: i === 0 ? FETT : BUCH })),
  ]
  const ls = lines(items)
  assert.ok(spaltenBahn(ls) > 200 && spaltenBahn(ls) < 300, `Bahn bei ${spaltenBahn(ls)}`)
  const bs = seitenBloecke(ls)
  const texte = bs.map(b => blockText(b).split('\n')[0])
  assert.equal(texte[0], '1. Allgemeine Angaben')
  assert.ok(texte.indexOf('Ausstellungsdatum') < texte.indexOf('Gültigkeitsbereich:'), `links vor rechts: ${texte.join(' / ')}`)
  assert.equal(bs.some(b => b.table), false, 'zwei Spalten sind keine Tabelle')
})

test('eine Überschrift darf auf einen Doppelpunkt enden — der gehört nicht in den Namen', () => {
  const items = [
    s('Gültigkeitsbereich:', 30, 700, { h: 10, font: FETT }),
    ...absatz(['Die Deklaration gilt für eine Leuchtenkomponente mit der Artikelnummer 89603436.',
      'Das Produkt wird am Standort hergestellt und in Leuchten eingebaut.',
      'Grundlage der Berechnung ist ein gemittelter Mix der Energieaufwände.'], 30, 680),
  ]
  const { chunks } = layoutDocument([{ page: 1, items }])
  assert.equal(chunks[0].heading, 'Gültigkeitsbereich', 'ohne Doppelpunkt')
  assert.match(chunks[0].body, /^Die Deklaration gilt/)
})

test('Läufe in der Zeile: ein Sprung nach rechts trennt, ein Wortabstand nicht', () => {
  const ls = lines([s('Netzspannungsbereich', 30, 700), s('220 – 240', 200, 700), s('V', 248, 700)])
  assert.equal(ls.length, 1)
  assert.deepEqual(ls[0].runs.map(r => r.text), ['Netzspannungsbereich', '220 – 240 V'], 'der enge Abstand bleibt ein Lauf')
})

test('Rollen ohne Text: eine Zahl oder ein Aufzählungszeichen ist keine Überschrift', () => {
  const bs = blocks(lines([s('2', 30, 700, { h: 14, font: FETT }), s('•', 30, 680, { h: 14, font: FETT }),
    ...absatz(['Der Fliesstext des Dokuments steht hier und füllt die Spalte aus.',
      'Er hat mehrere Zeilen und ist damit die häufigste Grösse im Dokument.', 'Die dritte Zeile macht ihn zum Absatz.'], 30, 660)]))
  roles(bs)
  assert.deepEqual(bs.filter(b => b.role === 'heading').length, 0, 'weder „2“ noch „•“')
})
