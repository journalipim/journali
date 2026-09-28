// Prüfwerkzeug: die Zeilen eines PDF, wie der Leser (job.mjs) sie in den Index legt — Zellen mit zwei Leerzeichen
// getrennt. Aufruf: node zeilen.mjs <datei.pdf> [seite]. Zum Nachsehen, warum eine Regel im Dialog etwas findet oder nicht.
import fs from 'node:fs'
import { cellsOf, dropRunningLines, joinHyphens, findTables } from './core.mjs'

const [,, datei, nurSeite] = process.argv
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(datei)), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise
const pages = [], rows = []
for (let n = 1; n <= doc.numPages; n++) {
  const page = await doc.getPage(n)
  const content = await page.getTextContent()
  let y = null, line = [], lines = []
  for (const item of content.items) {
    const ty = Math.round(item.transform?.[5] ?? 0)
    if (y !== null && Math.abs(ty - y) > 2) { lines.push(line); line = [] }
    y = ty
    line.push({ x: item.transform?.[4] ?? 0, w: item.width ?? 0, str: item.str + (item.hasEOL ? '\n' : '') })
  }
  if (line.length) lines.push(line)
  pages.push(lines.map(l => cellsOf(l).join('  ')).filter(Boolean).join('\n'))
  rows.push(lines.map(l => cellsOf(l)).filter(c => c.length))
  page.cleanup()
}
await doc.destroy()
const text = dropRunningLines(pages).map(joinHyphens)
text.forEach((t, i) => { if (!nurSeite || Number(nurSeite) === i + 1) { console.log(`\n=== Seite ${i + 1} ===`); console.log(t) } })
const tabellen = findTables(rows)
console.log(`\n=== Tabellen (Schlüssel/Wert, ≥3 Zeilen): ${tabellen.length} ===`)
for (const t of tabellen) console.log(`S. ${t.page} ${t.heading ?? ''}: ${t.rows.length} Zeilen — ${t.rows.slice(0, 3).map(r => r.join(' | ')).join(' ; ')}`)
