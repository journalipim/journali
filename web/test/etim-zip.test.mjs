// ETIM-Freigaben kommen als Zip — der Dateiknopf in der Oberfläche liest sie jetzt selbst.
// Geprüft wird mit einem echten, hier gebauten Zip: Zentralverzeichnis lesen, grösste .xml/.ixf finden, im Browser
// entpacken (DecompressionStream). Dieselben Funktionen benutzt der Prozess fetch.mjs.
import test from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync, crc32 } from 'node:zlib'
import { isZip, zipEntries, ixfInZip, inflateInBrowser } from '../../plugins/etim/core.mjs'

/// Ein Zip aus { name, text } bauen — deflate, damit auch das Entpacken geprüft wird
function makeZip(files) {
  const locals = [], central = []; let off = 0
  for (const f of files) {
    const raw = Buffer.from(f.text, 'utf8'), data = deflateRawSync(raw), name = Buffer.from(f.name, 'utf8')
    const head = Buffer.alloc(30)
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(8, 8)
    head.writeUInt32LE(crc32(raw) >>> 0, 14); head.writeUInt32LE(data.length, 18); head.writeUInt32LE(raw.length, 22)
    head.writeUInt16LE(name.length, 26)
    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(8, 10)
    cd.writeUInt32LE(crc32(raw) >>> 0, 16); cd.writeUInt32LE(data.length, 20); cd.writeUInt32LE(raw.length, 24)
    cd.writeUInt16LE(name.length, 28); cd.writeUInt32LE(off, 42)
    locals.push(head, name, data); central.push(cd, name)
    off += head.length + name.length + data.length
  }
  const body = Buffer.concat(locals), dir = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(body.length, 16)
  return new Uint8Array(Buffer.concat([body, dir, end]))
}

const zip = makeZip([
  { name: 'readme.txt', text: 'Hinweise zur Freigabe' },
  { name: 'ETIM-10.0-ALL-SECTORS.xml', text: '<ETIM>' + 'x'.repeat(500) + '</ETIM>' },
  { name: 'klein.ixf', text: '<ETIM/>' },
])

test('ein Zip wird als solches erkannt, eine XML-Datei nicht', () => {
  assert.equal(isZip(zip), true)
  assert.equal(isZip(new TextEncoder().encode('<ETIM/>')), false)
})

test('alle Einträge mit Namen und Grösse', () => {
  const names = zipEntries(zip).map(e => e.name)
  assert.deepEqual(names, ['readme.txt', 'ETIM-10.0-ALL-SECTORS.xml', 'klein.ixf'])
})

test('aus dem Zip kommt die grösste .xml/.ixf — nicht die Textdatei', () => {
  assert.equal(ixfInZip(zip).name, 'ETIM-10.0-ALL-SECTORS.xml')
})

test('entpacken im Browser liefert den Text zurück', async () => {
  const text = new TextDecoder().decode(await inflateInBrowser(ixfInZip(zip)))
  assert.match(text, /^<ETIM>x+<\/ETIM>$/)
})

test('Zip ohne IXF sagt, was fehlt', () => {
  assert.throws(() => ixfInZip(makeZip([{ name: 'readme.txt', text: 'nur Text' }])), /Zip ohne \.xml\/\.ixf/)
})
