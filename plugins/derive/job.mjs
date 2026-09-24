// Plugin derive: fehlende Ableitungen nach den Vorschau-Presets rechnen.
// Bilder mit sharp; ein PDF bekommt seine erste Seite als Kachel — gerendert mit
// pdfjs auf eine Leinwand, dann derselbe Weg wie bei einem Bild.
// Aufruf: node job.mjs <journali> <actor> [limit] [preset] — der JobRunner setzt die Werte auch als JOURNALI_* in die Umgebung.
// Holt /api/media/pending (Preset-Spezifikation je Bild), lädt das Original in eine Temp-Datei (grosse TIFFs nicht in den Speicher),
// rechnet mit sharp (libvips), legt das Ergebnis per PUT /api/media/{id}/derived/{preset} ab. Läuft in Runden, bis nichts mehr fehlt.
// Rückgabe 0 = alles gerechnet, 3 = einzelne Bilder scheiterten (Log), 1 = Abbruch.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const [,, serverArg, actorArg, limitArg, presetArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:derive'
const limit = Math.max(1, parseInt(limitArg || E.JOURNALI_LIMIT || '200', 10) || 200)
const only = (presetArg || E.JOURNALI_PRESET || '').trim()
const headers = { 'X-Actor': actor, ...(E.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + E.JOURNALI_TOKEN } : {}) }

let sharp
try { sharp = (await import('sharp')).default } catch (e) { console.error('✗ sharp fehlt — im Plugin-Verzeichnis einmal „npm install“ ausführen (' + e.message + ')'); process.exit(1) }

/// Erste Seite eines PDF als PNG. Einmal je Datei in der grössten gebrauchten Kante gerendert —
/// die Presets rechnen dann aus diesem Bild weiter, statt das PDF mehrfach zu öffnen. Weisser Grund: ein Datenblatt
/// ist auf Papier gedacht, durchsichtig sähe in der Kachel aus wie ein Fehler.
async function pdfFirstPage(file, edge) {
  const [{ createCanvas }, pdfjs] = await Promise.all([import('@napi-rs/canvas'), import('pdfjs-dist/legacy/build/pdf.mjs')])
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), useSystemFonts: true, isEvalSupported: false, verbosity: 0 }).promise
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

async function get(p) { const r = await fetch(server + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r.json() }

async function download(id, file) {
  const r = await fetch(`${server}/api/media/${encodeURIComponent(id)}/file`, { headers })
  if (!r.ok || !r.body) throw new Error(`Original: ${r.status}`)
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(file))
}

async function render(item, src) {
  // src ist ein Pfad (Bild) oder ein Puffer (gerenderte PDF-Seite) — sharp nimmt beides
  const format = item.format === 'jpg' ? 'jpeg' : item.format
  // eingepasst in Breite × Höhe, nie vergrössert; EXIF-Drehung anwenden; CMYK/TIFF → sRGB; Transparenz bleibt bei webp/png/avif
  let img = sharp(src, { limitInputPixels: false, failOn: 'none' }).rotate().resize({ width: item.width, height: item.height, fit: 'inside', withoutEnlargement: true }).toColourspace('srgb')
  img = format === 'jpeg' ? img.flatten({ background: '#ffffff' }).jpeg({ quality: item.quality, mozjpeg: true })
    : format === 'png' ? img.png({ compressionLevel: 9 })
    : format === 'avif' ? img.avif({ quality: item.quality })
    : img.webp({ quality: item.quality })
  const { data, info } = await img.toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, mime: format === 'jpeg' ? 'image/jpeg' : `image/${format}` }
}

async function put(item, out) {
  const r = await fetch(`${server}/api/media/${encodeURIComponent(item.id)}/derived/${encodeURIComponent(item.preset)}`, {
    method: 'PUT', headers: { ...headers, 'Content-Type': out.mime, 'X-Width': String(out.width), 'X-Height': String(out.height), 'X-Fingerprint': item.fingerprint }, body: out.data,
  })
  if (!r.ok) throw new Error(`ablegen: ${r.status} ${await r.text()}`)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'journali-derive-'))
let done = 0, failed = 0, rounds = 0, code = 0
const failedIds = new Set()   // was scheiterte, nicht in der nächsten Runde wieder versuchen
try {
  for (;;) {
    const pending = await get(`/api/media/pending?limit=${limit}${only ? '&preset=' + encodeURIComponent(only) : ''}`)
    const items = pending.items.filter(x => !failedIds.has(x.id + '/' + x.preset))
    if (!items.length) break
    rounds++
    console.log(`Runde ${rounds}: ${items.length} Ableitungen (${pending.presets.map(p => `${p.key} ${p.pending} fehlend`).join(', ')})`)
    // je Bild einmal laden, alle Presets daraus rechnen
    const byId = new Map(); for (const it of items) { if (!byId.has(it.id)) byId.set(it.id, []); byId.get(it.id).push(it) }
    for (const [id, its] of byId) {
      const src = path.join(tmp, id)
      try {
        await download(id, src)
        // PDF: einmal rendern, in der grössten Kante, die eines der Presets braucht
        let quelle = src
        if ((its[0].mime ?? '') === 'application/pdf') {
          const edge = Math.max(...its.map(it => Math.max(it.width, it.height)), 256)
          quelle = await pdfFirstPage(src, edge)
        }
        for (const it of its) {
          try { const out = await render(it, quelle); await put(it, out); done++; console.log(`✓ ${it.name} → ${it.preset} ${out.width}×${out.height} ${(out.data.length / 1024).toFixed(0)} KB`) }
          catch (e) { failed++; failedIds.add(it.id + '/' + it.preset); console.error(`✗ ${it.name} → ${it.preset}: ${e.message}`) }
        }
      } catch (e) { failed += its.length; for (const it of its) failedIds.add(it.id + '/' + it.preset); console.error(`✗ ${its[0].name}: ${e.message}`) }
      finally { try { fs.unlinkSync(src) } catch {} }
    }
  }
  console.log(`${done} Ableitungen gerechnet${failed ? `, ${failed} gescheitert` : ''}${rounds ? '' : ' — nichts fehlte'}`)
  code = failed ? 3 : 0
} catch (e) { console.error('✗ ' + e.message); code = 1 }
finally { try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {} }
process.exit(code)
