// Prüfwerkzeug: was der Leser aus einem PDF macht — Blöcke mit Rolle (Überschrift, Text, Tabelle) je Seite, oder das
// ganze Dokument als Abschnitte und Tabellen. Aufruf: node zeilen.mjs <datei.pdf> [seite]
import fs from 'node:fs'
import { pdfPages } from './pdf.mjs'
import { layoutDocument, analysePage, bodyOf, blockText } from './layout.mjs'

const [,, datei, nurSeite] = process.argv
if (!datei) { console.error('node zeilen.mjs <datei.pdf> [seite]'); process.exit(2) }
const pages = await pdfPages(fs.readFileSync(datei))
const body = bodyOf(pages)
console.log(`Seiten ${pages.length} · Fliesstext ${body.bodySize} pt ${body.bodyFont}`)
if (nurSeite) {
  const p = pages[Number(nurSeite) - 1]
  if (!p) { console.error(`Seite ${nurSeite} gibt es nicht`); process.exit(2) }
  for (const b of analysePage(p.items, body).blocks) {
    console.log(`[${b.role}${b.level ?? ''}] x${Math.round(b.x0)}-${Math.round(b.x1)} y${Math.round(b.y0)}-${Math.round(b.y1)} ${b.size}pt ${b.font}`)
    if (b.table && b.header) console.log(`    KOPF: ${b.header.join(' | ')}`)
    console.log('    ' + blockText(b).replace(/\n/g, '\n    '))
  }
} else {
  const { chunks, tables, zeichen } = layoutDocument(pages)
  console.log(`Abschnitte ${chunks.length} · Tabellen ${tables.length} · Zeichen ${zeichen}`)
  for (const c of chunks) console.log(`S.${c.page} ${c.heading ? JSON.stringify(c.heading) : '—'}: ${c.body.replace(/\n/g, ' ').slice(0, 100)}`)
  for (const t of tables) console.log(`TAB S.${t.page} ${t.heading ?? ''}: ${t.rows.length} Zeilen — ${t.rows.slice(0, 3).map(r => r.join(' | ')).join(' ; ')}`)
}
