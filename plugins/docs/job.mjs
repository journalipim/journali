// Plugin docs: liest den Text der Dokumente und legt
// ihn in den Index (pflegestruktur §32).
// Aufruf: node job.mjs <journali> <actor> [limit] — der JobRunner setzt die Werte auch als JOURNALI_* in die Umgebung.
// Holt /api/docs/status?pending=1 (was noch keinen Text hat), lädt die Datei, liest sie je nach Art, schneidet sie in
// Abschnitte, findet die Tabellen (Schlüssel/Wert) und legt beides per PUT /api/docs/{id} ab. Läuft in Runden, bis nichts mehr fehlt.
// Rückgabe 0 = alles gelesen, 3 = einzelne Dokumente scheiterten (Log), 1 = Abbruch.
import { chunk, numbered, fromHtml, dropRunningLines, joinHyphens, pack, cellsOf, findTables, pairsFromText, numberedTables } from './core.mjs'

const [,, serverArg, actorArg, limitArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:docs'
const limit = Math.max(1, parseInt(limitArg || E.JOURNALI_LIMIT || '50', 10) || 50)
const headers = { 'X-Actor': actor, ...(E.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + E.JOURNALI_TOKEN } : {}) }

async function get(p) { const r = await fetch(server + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r.json() }
async function put(p, body) {
  const r = await fetch(server + p, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`)
  return r.json()
}

/// PDF je Seite lesen — die Seitenzahl gehört zum Abschnitt, damit ein Treffer „Seite 4“ sagen kann.
/// Liefert je Seite den Text und die Zeilen als Zellen (aus der x-Lage der Stücke) — daraus werden die Tabellen.
async function pdfPages(bytes) {
  let pdfjs
  try { pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs') }
  catch (e) { throw new Error('pdfjs-dist fehlt — im Plugin-Verzeichnis einmal „npm install“ ausführen (' + e.message + ')') }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise
  const pages = [], rows = []
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const content = await page.getTextContent()
    // Zeilen aus den Textstücken bauen: ein neues Stück beginnt eine Zeile, wenn es tiefer steht als das vorige.
    // Je Stück bleibt die x-Lage — daraus werden die Zellen einer Tabellenzeile (cellsOf).
    let y = null, line = [], lines = []
    for (const item of content.items) {
      const ty = Math.round(item.transform?.[5] ?? 0)
      if (y !== null && Math.abs(ty - y) > 2) { lines.push(line); line = [] }
      y = ty
      line.push({ x: item.transform?.[4] ?? 0, w: item.width ?? 0, str: item.str + (item.hasEOL ? '\n' : '') })
    }
    if (line.length) lines.push(line)
    pages.push(lines.map(l => l.map(i => i.str).join('').trim()).filter(Boolean).join('\n'))
    rows.push(lines.map(l => cellsOf(l)).filter(c => c.length))
    page.cleanup()
  }
  await doc.destroy()
  return { pages, rows }
}

/// Alles, was wir lesen können, wird zu Abschnitten — PDF seitenweise, der Rest am Stück.
/// Liefert auch den Zustand: „scan“ heisst, das PDF hat keine Textebene — der Text steckt in Bildern und bräuchte OCR
///. Ohne diese Unterscheidung sähe ein Scan aus wie ein leeres Dokument.
async function read(medium, bytes) {
  const mime = medium.mime ?? ''
  if (mime === 'application/pdf') {
    const { pages: roh, rows } = await pdfPages(bytes)
    const pages = dropRunningLines(roh).map(joinHyphens)   // Kopf- und Fusszeilen raus, Silbentrennung zusammen
    const chunks = numbered(pack(pages.flatMap((text, i) => chunk(text, { page: i + 1 }))))
    const zeichen = roh.join('').replace(/\s/g, '').length
    // Faustregel: ein PDF mit Textebene bringt je Seite mehr als ein paar Zeichen. Darunter ist es ein Scan
    // (oder eine reine Bildseite) — wir merken es uns, statt es als gelesen abzuhaken.
    if (zeichen < pages.length * 20) return { chunks: [], tables: [], state: 'scan', pages: pages.length, note: `nur ${zeichen} Zeichen Textebene auf ${pages.length} Seiten — vermutlich ein Scan, braucht OCR` }
    return { chunks, tables: numberedTables(findTables(rows)), state: 'text', pages: pages.length }
  }
  const text = Buffer.from(bytes).toString('utf8')
  const html = mime === 'text/html' || mime === 'application/xml' || mime === 'text/xml'
  const plain = html ? fromHtml(text) : text
  const chunks = numbered(pack(chunk(plain)))
  return { chunks, tables: numberedTables(pairsFromText(plain)), state: chunks.length ? 'text' : 'scan', pages: null, note: chunks.length ? null : 'kein Text gefunden' }
}

async function main() {
  const t0 = Date.now()
  let gelesen = 0, abschnitte = 0, tabellen = 0, fehler = 0, scans = 0
  for (let runde = 1; ; runde++) {
    const status = await get(`/api/docs/status?pending=true&limit=${limit}`)
    if (!status.ready) { console.error('✗ Kein Dokumentindex — der Server läuft ohne Postgres'); process.exit(1) }
    const offen = status.pending ?? []
    if (!offen.length) break
    console.error(`Runde ${runde}: ${offen.length} Dokumente · im Index ${status.media} Dokumente, ${status.chunks} Abschnitte${status.scans ? `, ${status.scans} warten auf OCR` : ''}`)
    for (const m of offen) {
      try {
        const res = await fetch(`${server}/api/media/${encodeURIComponent(m.id)}/file`, { headers })
        if (!res.ok) throw new Error(`Datei: ${res.status}`)
        const bytes = await res.arrayBuffer()
        const r = await read(m, bytes)
        await put(`/api/docs/${encodeURIComponent(m.id)}`, { sha256: m.sha256, chunks: r.chunks, tables: r.tables ?? [], state: r.state, pages: r.pages, note: r.note })
        if (r.state === 'scan') { scans++; console.error(`  ◌ ${m.name} · ${r.note}`) }
        else { gelesen++; abschnitte += r.chunks.length; tabellen += r.tables?.length ?? 0; console.error(`  ✓ ${m.name} · ${r.chunks.length} Abschnitte${r.tables?.length ? ` · ${r.tables.length} Tabellen` : ''}${r.pages ? ` · ${r.pages} Seiten` : ''}`) }
      } catch (e) {
        fehler++
        console.error(`  ✗ ${m.name}: ${e.message}`)
        // damit der Job nicht ewig an derselben Datei hängt: als Fehler vermerken, dann gilt sie als behandelt
        try { await put(`/api/docs/${encodeURIComponent(m.id)}`, { sha256: m.sha256, chunks: [], state: 'fehler', note: e.message }) } catch { }
      }
    }
    if (offen.length < limit) break
  }
  const s = ((Date.now() - t0) / 1000).toFixed(1)
  console.log(JSON.stringify({ gelesen, abschnitte, tabellen, scans, fehler, sekunden: +s }))
  process.exit(fehler ? 3 : 0)
}

main().catch(e => { console.error('✗ ' + e.message); process.exit(1) })
