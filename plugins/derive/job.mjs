// Plugin derive: fehlende Ableitungen nach den Vorschau-Presets rechnen.
// Bilder mit sharp; ein PDF bekommt seine erste Seite als Kachel — gerendert mit
// pdfjs auf eine Leinwand, dann derselbe Weg wie bei einem Bild.
// Aufruf: node job.mjs <journali> <actor> [limit] [preset] — der JobRunner setzt die Werte auch als JOURNALI_* in die Umgebung.
// Holt /api/media/pending (Preset-Spezifikation je Bild), lädt das Original in eine Temp-Datei (grosse TIFFs nicht in den Speicher),
// rechnet mit sharp (libvips), legt das Ergebnis per PUT /api/media/{id}/derived/{preset} ab. Läuft in Runden, bis nichts mehr fehlt.
// Rückgabe 0 = alles gerechnet, 2 = angehalten (ein Import hat Vorfahrt), 3 = einzelne Bilder scheiterten (Log), 1 = Abbruch.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { pdfFirstPage } from './pdf.mjs'

// Keine Preset-Auswahl: der Job rechnet alle Presets mit „automatisch". Welche das sind, steht in den
// Einstellungen — ein Job, der davon eines aussparte, liess den Rest fuer immer liegen. Auch JOURNALI_PRESET wird
// nicht mehr gelesen: der JobRunner setzt jeden Job-Parameter als Umgebungsvariable, ein alter Eintrag wirkte also
// weiter, obwohl das Manifest den Parameter nicht mehr kennt (28.09.2026)
const [,, serverArg, actorArg, limitArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:derive'
const jobKey = E.JOURNALI_JOB || 'derive'
const limit = Math.max(1, parseInt(limitArg || E.JOURNALI_LIMIT || '200', 10) || 200)
const headers = { 'X-Actor': actor, ...(E.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + E.JOURNALI_TOKEN } : {}) }

let sharp
try { sharp = (await import('sharp')).default } catch (e) { console.error('✗ sharp fehlt — im Plugin-Verzeichnis einmal „npm install“ ausführen (' + e.message + ')'); process.exitCode = 1 }

/// Hält der Tasker den Lauf an (ein Import hat Vorfahrt)? Dann endet der Prozess; der nächste Lauf findet dieselben Ableitungen.
async function angehalten() {
  try { return (await get(`/api/jobs/${encodeURIComponent(jobKey)}/signal`)).paused === true } catch { return false }
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

// Die Bytes gehen einzeln in den Speicher (sie sind gross), der Beleg wird gesammelt: beleg=false laesst den
// Journaleintrag weg. Frueher nahm jedes PUT die Schreibsperre, und waehrend einer Runde kam kein Leser mehr
// durch — die Kacheln standen sekundenlang still (28.09.2026)
async function put(item, out) {
  const r = await fetch(`${server}/api/media/${encodeURIComponent(item.id)}/derived/${encodeURIComponent(item.preset)}?beleg=false`, {
    method: 'PUT', headers: { ...headers, 'Content-Type': out.mime, 'X-Width': String(out.width), 'X-Height': String(out.height), 'X-Fingerprint': item.fingerprint }, body: out.data,
  })
  if (!r.ok) throw new Error(`ablegen: ${r.status} ${await r.text()}`)
  return { id: item.id, preset: item.preset, width: out.width, height: out.height, bytes: out.data.length, fingerprint: item.fingerprint }
}

/// Die Belege einer Runde in einem Zug — ein Stapel, eine Sperre
async function belege(liste) {
  if (!liste.length) return
  const r = await fetch(`${server}/api/media/derived`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ belege: liste }),
  })
  if (!r.ok) throw new Error(`Belege: ${r.status} ${await r.text()}`)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'journali-derive-'))
let done = 0, failed = 0, rounds = 0, code = 0
const failedIds = new Set()   // was scheiterte, nicht in der nächsten Runde wieder versuchen
try {
  for (;;) {
    if (await angehalten()) { console.log(`angehalten nach ${rounds} Runden — ${done} Ableitungen gerechnet`); code = 2; break }
    const pending = await get(`/api/media/pending?limit=${limit}`)
    const items = pending.items.filter(x => !failedIds.has(x.id + '/' + x.preset))
    if (!items.length) break
    rounds++
    console.log(`Runde ${rounds}: ${items.length} Ableitungen (${pending.presets.map(p => `${p.key} ${p.pending} fehlend`).join(', ')})`)
    const runde = []   // die Belege dieser Runde — sie gehen am Ende in einem Zug ins Journal
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
          try { const out = await render(it, quelle); runde.push(await put(it, out)); done++; console.log(`✓ ${it.name} → ${it.preset} ${out.width}×${out.height} ${(out.data.length / 1024).toFixed(0)} KB`) }
          catch (e) { failed++; failedIds.add(it.id + '/' + it.preset); console.error(`✗ ${it.name} → ${it.preset}: ${e.message}`) }
        }
      } catch (e) { failed += its.length; for (const it of its) failedIds.add(it.id + '/' + it.preset); console.error(`✗ ${its[0].name}: ${e.message}`) }
      finally { try { fs.unlinkSync(src) } catch {} }
    }
    // Erst jetzt ins Journal: eine Sperre je Runde statt einer je Ableitung. Bricht der Lauf vorher ab, liegen die
    // Bytes ohne Beleg im Speicher — die Ableitung gilt dann als fehlend und wird neu gerechnet, kein Schaden
    await belege(runde)
  }
  if (code !== 2) { console.log(`${done} Ableitungen gerechnet${failed ? `, ${failed} gescheitert` : ''}${rounds ? '' : ' — nichts fehlte'}`); code = failed ? 3 : 0 }
} catch (e) { console.error('✗ ' + e.message); code = 1 }
finally { try { fs.rmSync(tmp, { recursive: true, force: true }) } catch {} }
process.exitCode = code
