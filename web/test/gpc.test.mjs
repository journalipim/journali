// Plugin gpc: die Veröffentlichung lesen, in Häppchen fürs Journal bringen, suchen und als neutrale Beschreibung für den Server
// aufbereiten. Die Probe (plugins/gpc/sample.json) ist erfunden und hat dieselbe Form wie die echte Datei.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import zlib from 'node:zlib'
import {
  isZip, jsonInZip, inflateInBrowser, parseGpc, toRecords, mergeDict, searchBricks, brickText, pathText, titleOf,
  featureSpecs, classesByAttribute, classSpec, systemSpec, attrKey,
} from '../../plugins/gpc/core.mjs'

const text = fs.readFileSync(new URL('../../plugins/gpc/sample.json', import.meta.url), 'utf8')

/// Ein Zip aus Einträgen [name, bytes, deflate?] — so viel, wie die Leser brauchen
function zipOf(entries) {
  const parts = [], central = []; let off = 0
  for (const [name, data, deflate] of entries) {
    const n = Buffer.from(name), raw = Buffer.from(data), body = deflate ? zlib.deflateRawSync(raw) : raw
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(deflate ? 8 : 0, 8); h.writeUInt32LE(body.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(n.length, 26)
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(deflate ? 8 : 0, 10); c.writeUInt32LE(body.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42)
    parts.push(h, n, body); central.push(c, n); off += 30 + n.length + body.length
  }
  const cd = Buffer.concat(central); const e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 8); e.writeUInt16LE(entries.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16)
  return new Uint8Array(Buffer.concat([...parts, cd, e]))
}

test('die Veröffentlichung wird gelesen: Kopf, Zahlen, Bricks mit Weg und Attributen', () => {
  const rel = parseGpc(text)
  assert.deepEqual(rel.meta, { language: 'en', date: '2026-01-01', version: '2026-01', counts: { segments: 1, families: 1, classes: 2, bricks: 3, attributes: 3, values: 7 } })
  const lamps = rel.bricks.find(b => b.code === '19900001')
  assert.deepEqual(lamps.path, ['99000000', '99010000', '99010100'])
  assert.deepEqual(lamps.t.en.slice(0, 3), ['Sample Lamps', 'Sample lamps of any kind.', 'Excludes sample cables.'])
  assert.deepEqual(lamps.a, [['29900001', ['39900001', '39900002', '39900003']], ['29900002', ['39900004', '39900005']]])
  assert.equal(rel.attributes['29900001'].en, 'Sample Colour')
  assert.equal(rel.values['39900006'].en, 'YELLOW')
  assert.equal(pathText(lamps, rel.hierarchy, 'en'), 'Sample Segment › Sample Electrical › Sample Lighting')
})

test('eine Datei mit Byte-Order-Marke und eine, die keine GPC-Datei ist', () => {
  assert.equal(parseGpc('﻿' + text).bricks.length, 3)
  assert.throws(() => parseGpc('{"a":1}'), /keine GPC-Datei/)
})

test('das Zip: die Veröffentlichung steht neben Tabelle und Änderungsliste — gelesen wird die .json, nicht die Delta', async () => {
  const zip = zipOf([['GPC as of Jan 2026 EN.xlsx', 'x'.repeat(5000), true], ['Delta - GPC as of Jan 2026 EN.json', '{"Delta":true}'.padEnd(9000, ' '), true], ['GPC as of Jan 2026 EN.json', text, true]])
  assert.equal(isZip(zip), true)
  const e = jsonInZip(zip)
  assert.equal(e.name, 'GPC as of Jan 2026 EN.json')
  const roh = await inflateInBrowser(e).catch(() => zlib.inflateRawSync(e.data))
  assert.equal(parseGpc(new TextDecoder().decode(roh)).bricks.length, 3)
  assert.equal(isZip(new TextEncoder().encode('{"a":1}')), false)
  assert.throws(() => jsonInZip(zipOf([['a.xlsx', 'x', false]])), /Zip ohne \.json/)
})

test('Häppchen fürs Journal: je Segment ein Datensatz, dazu Wörterbuch und Kopf', () => {
  const rel = parseGpc(text)
  const items = toRecords(rel)
  assert.deepEqual(Object.keys(items).sort(), ['bricks:99000000', 'dict', 'release'])
  assert.equal(items['bricks:99000000'].bricks.length, 3)
  assert.deepEqual(items.release, { key: '2026-01', version: '2026-01', date: '2026-01-01', languages: ['en'], counts: rel.meta.counts })
  assert.equal(items.dict.values['39900001'].en, 'RED', 'jeder Wert steht einmal, nicht je Brick')
})

test('eine weitere Sprache kommt zu den vorhandenen Titeln, die Struktur bleibt', () => {
  const en = parseGpc(text)
  const de = parseGpc(text.replace('"LanguageCode": "EN"', '"LanguageCode": "DE"').replace('Sample Lamps', 'Musterlampen').replaceAll('"RED"', '"ROT"'))
  const have = toRecords(en)
  const items = toRecords(de, { bricks: new Map([['99000000', have['bricks:99000000'].bricks]]), dict: have.dict, release: have.release })
  const lamps = items['bricks:99000000'].bricks.find(b => b.code === '19900001')
  assert.equal(brickText(lamps, 'de')[0], 'Musterlampen')
  assert.equal(brickText(lamps, 'en')[0], 'Sample Lamps')
  assert.equal(titleOf(items.dict.values['39900001'], 'de'), 'ROT')
  assert.equal(titleOf(items.dict.values['39900001'], 'en'), 'RED')
  assert.equal(titleOf(items.dict.values['39900001'], 'fr'), 'RED', 'fehlt die Sprache, gilt Englisch')
  assert.deepEqual(items.release.languages, ['en', 'de'])
})

test('Suche: Code, Titel und Weg — alle Wörter müssen passen, der Titel zählt mehr als der Weg', () => {
  const rel = parseGpc(text)
  const q = s => searchBricks(rel.bricks, rel.hierarchy, s, 'en').map(b => b.code)
  assert.deepEqual(q('lamps'), ['19900001'])
  assert.deepEqual(q('1990000'), ['19900001', '19900002', '19900003'], 'Anfang des Codes')
  assert.deepEqual(q('wiring sample'), ['19900002', '19900003'], 'der Weg nennt Wiring')
  assert.deepEqual(q('lamps wiring'), [], 'beide Wörter müssen passen')
  assert.deepEqual(q('  '), [])
  assert.deepEqual(q('excludes cables'), [], 'Ausschluss ist kein Suchtext')
  const inaktiv = rel.bricks.map(b => b.code === '19900001' ? { ...b, active: false } : b)
  assert.deepEqual(searchBricks(inaktiv, rel.hierarchy, 'lamps', 'en'), [], 'ein stillgelegter Brick wird nicht angeboten')
})

test('die Beschreibung für den Server: Klasse, Merkmale als Listen, Bedingung über alle Bricks, die das Attribut führen', () => {
  const rel = parseGpc(text)
  const dict = { attributes: rel.attributes, values: rel.values }
  const by = classesByAttribute(rel.bricks)
  assert.deepEqual(by.get('29900001'), ['19900001', '19900002'], 'Sample Colour führen zwei Bricks')
  const lamps = rel.bricks.find(b => b.code === '19900001'), cables = rel.bricks.find(b => b.code === '19900002')
  const f = featureSpecs(lamps, dict, by)
  assert.deepEqual(f.map(x => [x.key, x.type, x.classes, x.values.length]), [['gpc29900001', 'enum', ['19900001', '19900002'], 3], ['gpc29900002', 'enum', ['19900001'], 2]])
  assert.deepEqual(f[0].values[0], { code: '39900001', name: { en: 'RED' } })
  assert.equal(attrKey('29900001'), 'gpc29900001')
  // dasselbe Attribut am anderen Brick hat andere Werte — der Server vereinigt sie in der Liste
  assert.deepEqual(featureSpecs(cables, dict, by)[0].values.map(v => v.code), ['39900001', '39900006'])
  assert.deepEqual(classSpec(lamps, rel.hierarchy), { code: '19900001', name: { en: 'Sample Lamps' }, section: 'Sample Segment › Sample Electrical › Sample Lighting' })
  assert.deepEqual(featureSpecs(rel.bricks.find(b => b.code === '19900003'), dict, by), [], 'ein Brick ohne Attribute hat keine Merkmale')
})

test('das System: Schlüssel, Bezeichnungen, Ausweichnamen und das Muster der eigenen Attribute', () => {
  const s = systemSpec()
  assert.deepEqual([s.group, s.classAttr, s.ownPattern, s.plugin], ['class_gpc', 'gpc_class', '^gpc\\d+$', 'gpc'])
  assert.ok(new RegExp(s.ownPattern).test('gpc29900001') && !new RegExp(s.ownPattern).test('gpc_class'))
  assert.deepEqual(systemSpec({ group: 'class_gpc_std', classAttr: 'gpc_klasse' }).group, 'class_gpc_std', 'ausgewichen: der gemerkte Schlüssel gilt')
  assert.deepEqual(mergeDict(null, { attributes: { 1: { en: 'a' } } }).attributes, { 1: { en: 'a' } })
})
