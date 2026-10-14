// Plugin derive (14.10.2026): die Kachel eines Datenblatts war eine weisse Seite — das PDF nennt Helvetica, bringt sie aber nicht mit, und in Node
// gibt es keine Systemschriften. pdfFirstPage nimmt jetzt die Schriften von pdfjs. Geprüft an einem kleinen PDF wie die Datenblätter der Demo.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const derive = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'plugins', 'derive')
const da = fs.existsSync(path.join(derive, 'node_modules', 'pdfjs-dist')) && fs.existsSync(path.join(derive, 'node_modules', '@napi-rs', 'canvas'))

/// Ein PDF mit einer Seite und Text in Helvetica, ohne eingebettete Schrift
function pdf(text) {
  const inhalt = `BT /F1 28 Tf 72 720 Td (${text}) Tj ET\nBT /F1 12 Tf 72 690 Td (${text} ${text} ${text}) Tj ET\n`
  const objekte = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${inhalt.length} >>\nstream\n${inhalt}endstream`,
  ]
  let s = '%PDF-1.4\n'; const lagen = []
  objekte.forEach((o, i) => { lagen.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = s.length
  s += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n` + lagen.map(l => String(l).padStart(10, '0') + ' 00000 n \n').join('')
  s += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(s, 'latin1')
}

test('die erste Seite eines PDF ohne eingebettete Schrift zeigt ihren Text', { skip: !da && 'plugins/derive ohne node_modules' }, async () => {
  const { pdfFirstPage } = await import(new URL('file:///' + path.join(derive, 'pdf.mjs').replaceAll('\\', '/')).href)
  const { loadImage, createCanvas } = createRequire(path.join(derive, 'pdf.mjs'))('@napi-rs/canvas')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'derive-pdf-'))
  try {
    const datei = path.join(dir, 'datenblatt.pdf'); fs.writeFileSync(datei, pdf('Datenblatt Test'))
    const bild = await loadImage(await pdfFirstPage(datei, 400))
    const c = createCanvas(bild.width, bild.height); const ctx = c.getContext('2d'); ctx.drawImage(bild, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let dunkel = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 300) dunkel++
    assert.ok(dunkel > 200, `${dunkel} dunkle Pixel — der Text fehlt`)
  } finally { fs.rmSync(dir, { recursive: true, force: true }) }
})
