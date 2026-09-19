// JSON-Export als Job (Taloan, 19.09.2026: „json export auch als job“): ein Teilbaum als Datei in ein Verzeichnis —
// Rohdaten (wiederherstellbar, mit Modellteil; GET /api/nodes/{id}/export), ausgewerteter Baum oder flache Liste
// (derselbe Kern wie ⇪ Export → Tabelle, plugins/table/core.mjs). Ohne root alle Wurzeln, je Wurzel eine Datei;
// behält je Wurzel und Job die letzten n. Aufruf: node export-job.mjs <journali> <actor> [root] [dir] [format] [locales] [ownOnly] [gzip] [keep]
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { build, toJson, toJsonTree } from '../table/core.mjs'

const [,, serverArg, actorArg, rootArg, dirArg, fmtArg, locArg, ownArg, gzArg, keepArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/+$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:json'
const root = rootArg || E.JOURNALI_ROOT || ''
const dir = path.resolve(dirArg || E.JOURNALI_DIR || 'json')
const format = (fmtArg || E.JOURNALI_FORMAT || 'raw').toLowerCase()      // raw | tree | flat
const locales = (locArg || E.JOURNALI_LOCALES || '').split(/[,\s]+/).filter(Boolean)
const ownOnly = (ownArg || E.JOURNALI_OWNONLY || 'false') === 'true'
const gz = (gzArg || E.JOURNALI_GZIP || 'true') === 'true'
const keep = Math.max(1, parseInt(keepArg || E.JOURNALI_KEEP || '14', 10) || 14)
const jobKey = E.JOURNALI_JOB ? E.JOURNALI_JOB + '-' : ''   // vom JobRunner; von Hand: ohne
const headers = { 'X-Actor': actor }
const api = { get: async p => { const r = await fetch(server + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r.json() } }
const countNodes = n => { let c = 1; for (const k of n.children ?? []) c += countNodes(k); return c }

;(async () => {
  if (!['raw', 'tree', 'flat'].includes(format)) throw new Error(`Format ${format}: raw, tree oder flat`)
  const model = await api.get('/api/model')
  const locs = locales.length ? locales : [model.masterLocale ?? model.locales[0]?.code ?? 'de']
  const rows = await api.get('/api/tree')
  const roots = root ? rows.filter(r => r.id === root) : rows.filter(r => !r.parent)
  if (!roots.length) throw new Error(`kein Knoten ${root || '(Wurzel)'}`)
  fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  let total = 0
  for (const r of roots) {
    let text, count
    if (format === 'raw') { const raw = await api.get(`/api/nodes/${encodeURIComponent(r.id)}/export?deep=true`); count = countNodes(raw.node); text = JSON.stringify(raw, null, 1) }
    else { const t = await build({ api, model }, { root: r.id, role: '', locales: locs, ownOnly, viewKey: '', say: m => console.log(m) }); count = t.count; text = format === 'tree' ? toJsonTree(t, r.id) : toJson(t) }
    const safe = String(r.label ?? r.id).replace(/[^\w.-]+/g, '_').slice(0, 40)
    const file = path.join(dir, `${jobKey}${safe}-${r.id}-${format}-${stamp}.json${gz ? '.gz' : ''}`)
    fs.writeFileSync(file, gz ? zlib.gzipSync(text, { level: 9 }) : text)
    total += count
    console.log(`${file}: ${count} Knoten (${format}), ${(fs.statSync(file).size / 1024).toFixed(0)} KB${gz ? ` (roh ${(text.length / 1024).toFixed(0)} KB)` : ''}`)
    // alte Stände dieser Wurzel, dieses Jobs und Formats wegräumen
    const old = fs.readdirSync(dir).filter(f => f.startsWith(jobKey) && f.includes(`-${r.id}-${format}-`) && (f.endsWith('.json') || f.endsWith('.json.gz'))).sort()
    for (const f of old.slice(0, Math.max(0, old.length - keep))) { fs.unlinkSync(path.join(dir, f)); console.log(`alt entfernt: ${f}`) }
  }
  console.log(`✓ ${roots.length} Wurzel${roots.length > 1 ? 'n' : ''}, ${total} Knoten als JSON (${format}) nach ${dir}`)
})().catch(e => { console.error('✗ ' + (e.message ?? e)); process.exit(1) })
