// ETIM-Freigaben holen. Läuft als
// Kindprozess des Servers (Browser-Plugins dürfen etim-international.com wegen CORS nicht lesen), spricht nur über /api.
//   node fetch.mjs <journali> <actor> list                          → JSON: die Freigaben der Download-Seite (IXF, alle Sektoren zuerst)
//   node fetch.mjs <journali> <actor> probe <url>                   → JSON: Name, Nummer, Zahl der Klassen — ohne etwas zu schreiben
//   node fetch.mjs <journali> <actor> index <url> <langs>           → JSON: die Suchliste aller Klassen (Code, Namen, Synonyme, Gruppe, Zahl der
//                                                                      ETIM-Attribute); ins Journal nur die Freigabe (release:<key>, mit URL)
//   node fetch.mjs <journali> <actor> classes <url> <langs> <codes> → die genannten Klassen aufgelöst ins Journal (class:<key>:<EC>)
// Seit 14.10.2026 kommt keine ganze Freigabe mehr ins Journal: wer sucht oder zuweist, holt sie von ihrer URL, nimmt, was er braucht, und
// verwirft den Rest. Ins Journal gehen die Klassen in Gebrauch — Prüfung, Datenanalyse und Export brauchen ihre ETIM-Attribute.
// JOURNALI_TOKEN (Bearer) kommt vom Server je Lauf.
import { inflateRawSync } from 'node:zlib'
import { parseIxf, classRecord, classSummary, variantOf, isZip, ixfInZip } from './core.mjs'

const [,, server, actor, mode, url, langsArg, codesArg] = process.argv
if (!server || !mode) { console.error('Aufruf: fetch.mjs <journali> <actor> list | probe <url> | index <url> <langs> | classes <url> <langs> <codes>'); process.exit(2) }
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

/// Die Freigabe von ihrer URL: Zip oder XML laden, IXF lesen — nur im Arbeitsspeicher dieses Laufs
async function lies() {
  if (!url) throw new Error('URL fehlt')
  const t0 = Date.now()
  const res = await fetch(url, { headers: { 'User-Agent': 'journali-etim/1.0' } })
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  let text, file = url.split('/').pop()
  if (isZip(buf)) {
    const e = ixfInZip(buf)
    file = e.name; text = (e.method === 8 ? inflateRawSync(e.data) : e.data).toString('utf8')
  } else text = buf.toString('utf8')
  const rel = parseIxf(text); const h = rel.header
  console.error(`${h.name ?? 'ETIM'} Nr. ${h.number ?? '?'} · ${rel.classes.length} Klassen · ${rel.features.size} Merkmale · ${(buf.length / 1048576).toFixed(1)} MB · ${Date.now() - t0} ms gelesen`)
  const ver = String(h.number ?? '0')
  const variant = variantOf(file)
  const key = [ver, variant].filter(Boolean).join('-')   // Ausführung im Schlüssel
  const languages = [...new Set(rel.classes.slice(0, 200).flatMap(c => Object.keys(c.name)))]
  return { rel, file, key, ver, variant, languages, mb: +(buf.length / 1048576).toFixed(1), t0 }
}

const langs = () => (langsArg ?? 'de,en').split(',').map(s => s.trim()).filter(Boolean)

async function probe() {
  const { rel, file, languages, mb } = await lies(); const h = rel.header
  out({ name: h.name, number: h.number, date: h.date, classes: rel.classes.length, features: rel.features.size, languages, file, mb })
}

/// Die Suchliste — und die Freigabe ins Journal, damit sie unter den Versionen steht und man sie wieder holen kann (die URL)
async function index() {
  const { rel, file, key, ver, variant, languages, t0 } = await lies(); const h = rel.header
  const kept = langs()
  const info = { key, version: ver, variant, name: h.name, number: h.number, date: h.date, exportDate: h.exportDate, classes: rel.classes.length, features: rel.features.size, languages, kept, file, url, at: new Date().toISOString() }
  const put = (name, wert) => fetch(`${server}/api/plugins/etim/data/${encodeURIComponent(name)}`, { method: 'PUT', headers, body: JSON.stringify(wert) })
  const r = await put('release:' + key, info)
  if (!r.ok) throw new Error(`Journal: ${r.status} ${await r.text()}`)
  // aktuelle Version: die geholte, wenn noch keine gesetzt ist — sonst bleibt sie (umschalten in der Oberfläche)
  const cur = await fetch(`${server}/api/plugins/etim/data/release`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null)
  if (!cur?.key && !cur?.version) await put('release', info)
  out({ ...info, current: cur?.version ?? ver, ms: Date.now() - t0, liste: rel.classes.map(c => classSummary(rel, c, kept)) })
}

/// Die genannten Klassen aufgelöst ins Journal — die Klassen, die jemand übernimmt oder zuweist
async function classes() {
  const codes = new Set(String(codesArg ?? '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean))
  if (!codes.size) throw new Error('keine Klasse genannt')
  const { rel, key, t0 } = await lies()
  const items = {}
  for (const cls of rel.classes) if (codes.has(cls.code)) items[`class:${key}:${cls.code}`] = classRecord(rel, cls, langs())
  const fehlen = [...codes].filter(c => !items[`class:${key}:${c}`])
  if (Object.keys(items).length) {
    const r = await fetch(`${server}/api/plugins/etim/data`, { method: 'PUT', headers, body: JSON.stringify(items) })
    if (!r.ok) throw new Error(`Journal: ${r.status} ${await r.text()}`)
  }
  out({ key, written: Object.keys(items).length, missing: fehlen, ms: Date.now() - t0 })
}

const LAEUFE = { list, probe, index, classes }
;(LAEUFE[mode] ?? (() => Promise.reject(new Error(`unbekannt: ${mode}`))))().catch(e => { console.error('✗ ' + e.message); process.exit(1) })
