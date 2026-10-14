// Erste Seite eines PDF als PNG — aus job.mjs herausgelöst (14.10.2026), damit sie sich ohne Lauf prüfen lässt.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// Die Schriften, die ein PDF nennt, aber nicht mitbringt (Helvetica, Times …), liefert pdfjs selbst mit. In Node gibt es keine Systemschriften:
// mit useSystemFonts blieb der Text eines solchen PDF weg, und jede Kachel eines Datenblatts war eine weisse Seite (14.10.2026).
const SCHRIFTEN = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts').replaceAll('\\', '/') + '/'

/// Erste Seite eines PDF als PNG. Einmal je Datei in der grössten gebrauchten Kante gerendert —
/// die Presets rechnen dann aus diesem Bild weiter, statt das PDF mehrfach zu öffnen. Weisser Grund: ein Datenblatt
/// ist auf Papier gedacht, durchsichtig sähe in der Kachel aus wie ein Fehler.
export async function pdfFirstPage(file, edge) {
  const [{ createCanvas }, pdfjs] = await Promise.all([import('@napi-rs/canvas'), import('pdfjs-dist/legacy/build/pdf.mjs')])
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: false, standardFontDataUrl: SCHRIFTEN, isEvalSupported: false, verbosity: 0 }).promise
  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(4, Math.max(0.2, edge / Math.max(base.width, base.height))) })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    return canvas.toBuffer('image/png')
  } finally { await doc.destroy() }
}
