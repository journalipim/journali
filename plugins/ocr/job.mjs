// Plugin ocr: den Text gescannter Dokumente erkennen und in den Index legen (27.09.2026, pflegestruktur 34 J).
//
// Die offene Postenliste ist GET /api/docs/scans: Dokumente, die der Leser als „scan“ erkannt hat — keine Textebene,
// ein Bild von Text. Der Erkenner lädt die Datei, rendert die Seiten (pdfjs + canvas), erkennt sie (tesseract.js),
// baut Abschnitte und Tabellen wie der Leser und legt sie per PUT /api/docs/{id} ab — state text, note "ocr".
// Ein Dokument, in dem nichts zu erkennen ist, wird „fehler“ mit dem Grund, damit es nicht in jeder Runde neu kommt;
// /docs/retry gibt es wieder frei. Ein abgebrochener Lauf lässt die offenen Posten offen, der nächste findet dieselben.
//
// Aufruf: node job.mjs <journali> <actor> [limit] [langs] [scale] [maxPages] — der JobRunner setzt alles auch als JOURNALI_*.
// Rückgabe 0 = nichts mehr offen, 2 = angehalten (der Tasker setzt fort), 3 = einzelne Dokumente scheiterten, 1 = Abbruch.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pageOf, assemble, note } from './core.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const [, , serverArg, actorArg, limitArg, langsArg, scaleArg, maxPagesArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:ocr'
const jobKey = E.JOURNALI_JOB || 'ocr'
const limit = Math.min(500, Math.max(1, parseInt(limitArg || E.JOURNALI_LIMIT || '10', 10) || 10))
const langs = (langsArg || E.JOURNALI_LANGS || 'deu+eng').trim()
const scale = Math.min(4, Math.max(1, parseFloat(scaleArg || E.JOURNALI_SCALE || '2') || 2))
const maxPages = Math.min(500, Math.max(1, parseInt(maxPagesArg || E.JOURNALI_MAXPAGES || '40', 10) || 40))
const headers = { 'X-Actor': actor, ...(E.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + E.JOURNALI_TOKEN } : {}) }

async function get(p) { const r = await fetch(server + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status} ${(await r.text()).slice(0, 300)}`); return r.json() }
async function put(p, body) {
  const r = await fetch(server + p, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!r.ok) throw new Error(`${p}: ${r.status} ${(await r.text()).slice(0, 300)}`)
  return r.json()
}
async function angehalten() {
  try { return (await get(`/api/jobs/${encodeURIComponent(jobKey)}/signal`)).paused === true } catch { return false }
}

/// Die Seiten eines PDF als Bilder (PNG) — gerendert, denn ein Scan hat keine Textebene, nur Pixel
async function renderPdf(bytes) {
  let pdfjs, canvas
  try { pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'); canvas = await import('@napi-rs/canvas') }
  catch (e) { throw new Error('pdfjs-dist oder @napi-rs/canvas fehlt — im Plugin-Verzeichnis einmal „npm install“ ausführen (' + e.message + ')') }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise
  const out = []
  const n = Math.min(doc.numPages, maxPages)
  for (let i = 1; i <= n; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale })
    const c = canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    out.push(c.toBuffer('image/png'))
    page.cleanup()
  }
  await doc.destroy()
  return { images: out, pages: doc.numPages }
}

/// Die Erkennung: ein Arbeiter je Lauf, die Sprachdaten im Verzeichnis .cache des Plugins
let worker = null
async function erkenner() {
  if (worker) return worker
  let tess
  try { tess = await import('tesseract.js') }
  catch (e) { throw new Error('tesseract.js fehlt — im Plugin-Verzeichnis einmal „npm install“ ausführen (' + e.message + ')') }
  const cache = E.JOURNALI_OCR_CACHE || path.join(here, '.cache')
  worker = await tess.createWorker(langs, 1, { cachePath: cache, logger: () => {} })
  return worker
}
async function recognize(image) {
  const w = await erkenner()
  const { data } = await w.recognize(image, {}, { text: true, blocks: true })
  return pageOf(data)
}

async function main() {
  const t0 = Date.now()
  let erkannt = 0, fehler = 0, leer = 0, runde = 0
  for (;;) {
    if (await angehalten()) { console.log(`angehalten nach ${runde} Runden — ${erkannt} erkannt`); await worker?.terminate(); process.exit(2) }
    const r = await get(`/api/docs/scans?limit=${limit}`)
    if (r.ready === false) { console.error('✗ Kein Dokumentindex — der Server läuft ohne Postgres'); process.exit(1) }
    const offen = r.scans ?? []
    if (!offen.length) break
    runde++
    console.error(`Runde ${runde}: ${offen.length} Dokumente warten auf Texterkennung · Sprachen ${langs}`)
    for (const m of offen) {
      try {
        const res = await fetch(`${server}/api/media/${encodeURIComponent(m.id)}/file`, { headers })
        if (!res.ok) throw new Error(`Datei: ${res.status}`)
        const bytes = Buffer.from(await res.arrayBuffer())
        let images, pages
        if (m.mime === 'application/pdf') ({ images, pages } = await renderPdf(bytes))
        else if ((m.mime ?? '').startsWith('image/')) { images = [bytes]; pages = 1 }
        else throw new Error(`${m.mime}: keine Seiten zu rendern`)
        const seiten = []
        for (const img of images) seiten.push(await recognize(img))
        const a = assemble(seiten)
        // Faustregel wie beim Leser: unter 20 Zeichen je Seite ist nichts erkannt — als Fehler festhalten, nicht ewig neu versuchen
        if (a.zeichen < seiten.length * 20) {
          leer++
          await put(`/api/docs/${encodeURIComponent(m.id)}`, { sha256: m.sha256, chunks: [], tables: [], state: 'fehler', pages, note: `ocr: kein Text erkannt (Vertrauen ${a.confidence} %)` })
          console.error(`  ◌ ${m.name} · kein Text erkannt`)
          continue
        }
        await put(`/api/docs/${encodeURIComponent(m.id)}`, { sha256: m.sha256, chunks: a.chunks, tables: a.tables, state: 'text', pages, note: note(a.confidence, pages) })
        erkannt++
        console.error(`  ✓ ${m.name} · ${a.chunks.length} Abschnitte${a.tables.length ? ` · ${a.tables.length} Tabellen` : ''} · ${pages} Seiten · Vertrauen ${a.confidence} %`)
      } catch (e) {
        fehler++
        console.error(`  ✗ ${m.name}: ${e.message}`)
        try { await put(`/api/docs/${encodeURIComponent(m.id)}`, { sha256: m.sha256, chunks: [], state: 'fehler', note: 'ocr: ' + e.message }) } catch { }
      }
    }
    if (offen.length < limit) break
  }
  await worker?.terminate()
  console.log(JSON.stringify({ erkannt, leer, fehler, sekunden: +((Date.now() - t0) / 1000).toFixed(1) }))
  process.exit(fehler ? 3 : 0)
}

main().catch(async e => { console.error('✗ ' + e.message); await worker?.terminate(); process.exit(1) })
