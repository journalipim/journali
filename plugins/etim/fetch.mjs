// ETIM-Freigaben holen (Taloan, 20.09.2026: „alles ist öffentlich abrufbar — warum muss ich IXF neu einlesen?“). Läuft als
// Kindprozess des Servers (Browser-Plugins dürfen etim-international.com wegen CORS nicht lesen), spricht nur über /api.
//   node fetch.mjs <journali> <actor> list                → JSON: die Freigaben der Download-Seite (IXF, alle Sektoren zuerst)
//   node fetch.mjs <journali> <actor> load <url> <langs>  → Zip oder XML laden, IXF lesen, alle Klassen (Sprachen des Modells)
//                                                            als class:<EC> ins Journal (Sammel-PUT), Freigabe merken
// JOURNALI_TOKEN (Bearer) kommt vom Server je Lauf.
import { inflateRawSync } from 'node:zlib'
import { parseIxf, classRecord, variantOf } from './core.mjs'

const [,, server, actor, mode, url, langsArg] = process.argv
if (!server || !mode) { console.error('Aufruf: fetch.mjs <journali> <actor> list | load <url> <langs>'); process.exit(2) }
const headers = { 'X-Actor': actor || 'job:etim', 'Content-Type': 'application/json', ...(process.env.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + process.env.JOURNALI_TOKEN } : {}) }
const DOWNLOADS = 'https://www.etim-international.com/downloads/?_sft_downloadcategory=model-releases'
const out = o => console.log(JSON.stringify(o))

async function list() {
  const html = await (await fetch(DOWNLOADS, { headers: { 'User-Agent': 'journali-etim/1.0' } })).text()
  // je Karte: <h4 class="download__title">NAME</h4> … <span class="download__post-date">Added on: …</span> … <a class="downloads__link" href="…zip">
  const items = []
  const re = /<h4 class="download__title">([^<]+)<\/h4>([\s\S]*?)<a class="downloads__link" href="([^"]+)"/g
  let m
  while ((m = re.exec(html))) items.push({ name: m[1].trim(), added: (m[2].match(/Added on:\s*([^<]+)</)?.[1] ?? '').trim(), url: m[3] })
  const ixf = items.filter(i => /IXF/i.test(i.name))
  // Reihenfolge: neueste Version, alle Sektoren, ohne Änderungscodes, metrisch, ETIM English zuerst
  const score = i => (/ALL-SECTORS/i.test(i.name) ? 8 : 0) + (/NO-CHANGE/i.test(i.name) ? 4 : 0) + (/-METRIC-/i.test(i.name) && !/IMPERIAL/i.test(i.name) ? 2 : 0) + (/-EI-/i.test(i.name) ? 1 : 0)
  const ver = i => parseFloat((i.name.match(/ETIM-(\d+(?:\.\d+)?)/) ?? [])[1] ?? '0')
  ixf.sort((a, b) => ver(b) - ver(a) || score(b) - score(a) || a.name.localeCompare(b.name))
  out({ releases: ixf, all: items.length })
}

// Minimaler Zip-Leser: Zentralverzeichnis → Einträge → inflateRaw (Methode 8) oder roh (0)
function unzip(buf) {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('kein Zip (Zentralverzeichnis fehlt)')
  const count = view.getUint16(eocd + 10, true); const cdOff = view.getUint32(eocd + 16, true)
  const files = []; let p = cdOff
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('Zip: Eintrag beschädigt')
    const method = view.getUint16(p + 10, true); const csize = view.getUint32(p + 20, true); const usize = view.getUint32(p + 24, true)
    const nLen = view.getUint16(p + 28, true); const eLen = view.getUint16(p + 30, true); const cLen = view.getUint16(p + 32, true); const lOff = view.getUint32(p + 42, true)
    const name = buf.subarray(p + 46, p + 46 + nLen).toString('utf8')
    files.push({ name, method, csize, usize, lOff }); p += 46 + nLen + eLen + cLen
  }
  return files.map(f => ({ name: f.name, size: f.usize, read() {
    const ln = view.getUint16(f.lOff + 26, true); const le = view.getUint16(f.lOff + 28, true); const start = f.lOff + 30 + ln + le
    const data = buf.subarray(start, start + f.csize)
    return f.method === 8 ? inflateRawSync(data) : f.method === 0 ? data : (() => { throw new Error(`Zip-Methode ${f.method} nicht unterstützt`) })()
  } }))
}

async function load(probe = false) {
  if (!url) throw new Error('URL fehlt')
  const langs = (langsArg ?? 'de,en').split(',').map(s => s.trim()).filter(Boolean)
  const t0 = Date.now()
  const res = await fetch(url, { headers: { 'User-Agent': 'journali-etim/1.0' } })
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  let text, file = url.split('/').pop()
  if (buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50) {
    const entries = unzip(buf).filter(e => /\.(xml|ixf)$/i.test(e.name)).sort((a, b) => b.size - a.size)
    if (!entries.length) throw new Error('Zip ohne .xml/.ixf')
    file = entries[0].name; text = entries[0].read().toString('utf8')
  } else text = buf.toString('utf8')
  const rel = parseIxf(text); const h = rel.header
  console.error(`${h.name ?? 'ETIM'} Nr. ${h.number ?? '?'} · ${rel.classes.length} Klassen · ${rel.features.size} Merkmale · ${(buf.length / 1048576).toFixed(1)} MB · ${Date.now() - t0} ms gelesen`)
  const languages = [...new Set(rel.classes.slice(0, 200).flatMap(c => Object.keys(c.name)))]
  if (probe) { out({ name: h.name, number: h.number, date: h.date, classes: rel.classes.length, features: rel.features.size, languages, file, mb: +(buf.length / 1048576).toFixed(1) }); return }
  const ver = String(h.number ?? '0')
  const variant = variantOf(file); const key = [ver, variant].filter(Boolean).join('-')   // Ausführung im Schlüssel (Taloan, 22.09.)
  const CH = 400; let done = 0
  for (let i = 0; i < rel.classes.length; i += CH) {
    const items = {}
    for (const cls of rel.classes.slice(i, i + CH)) { const rec = classRecord(rel, cls, langs); items[`class:${key}:${rec.code}`] = rec }
    const r = await fetch(`${server}/api/plugins/etim/data`, { method: 'PUT', headers, body: JSON.stringify(items) })
    if (!r.ok) throw new Error(`Journal: ${r.status} ${await r.text()}`)
    done += Object.keys(items).length; console.error(`${done} / ${rel.classes.length} Klassen …`)
  }
  const info = { key, version: ver, variant, name: h.name, number: h.number, date: h.date, exportDate: h.exportDate, classes: rel.classes.length, features: rel.features.size, languages, kept: langs, file, url, at: new Date().toISOString(), all: true }
  await fetch(`${server}/api/plugins/etim/data/release:${key}`, { method: 'PUT', headers, body: JSON.stringify(info) })
  // aktuelle Version: die geladene, wenn noch keine gesetzt ist — sonst bleibt sie (umschalten in der Oberfläche)
  const cur = await fetch(`${server}/api/plugins/etim/data/release`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null)
  if (!cur?.key && !cur?.version) await fetch(`${server}/api/plugins/etim/data/release`, { method: 'PUT', headers, body: JSON.stringify(info) })
  out({ ...info, current: cur?.version ?? ver, ms: Date.now() - t0 })
}

;(mode === 'list' ? list() : load(mode === 'probe')).catch(e => { console.error('✗ ' + e.message); process.exit(1) })
