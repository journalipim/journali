// Tabellen-Export als Job (Taloan, 19.09.2026: „Export-Plugins jobfertig“): ein Teilbaum als Excel oder CSV in ein
// Verzeichnis — derselbe Kern wie ⇪ Export → Tabelle (plugins/table/core.mjs). Behält die letzten n Dateien je Wurzel.
// Aufruf: node job.mjs <journali> <actor> <root> <dir> [format] [locales] [role] [view] [ownOnly] [keep] — oder JOURNALI_*.
import fs from 'node:fs'
import path from 'node:path'
import { build, toCsv, workbook } from '../table/core.mjs'

const [,, serverArg, actorArg, rootArg, dirArg, fmtArg, locArg, roleArg, viewArg, ownArg, keepArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/+$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:export'
const root = rootArg || E.JOURNALI_ROOT || ''
const dir = path.resolve(dirArg || E.JOURNALI_DIR || 'export')
const format = (fmtArg || E.JOURNALI_FORMAT || 'xlsx').toLowerCase()
const locales = (locArg || E.JOURNALI_LOCALES || '').split(/[,\s]+/).filter(Boolean)
const role = roleArg || E.JOURNALI_ROLE || ''
const viewKey = viewArg || E.JOURNALI_VIEW || ''
const ownOnly = (ownArg || E.JOURNALI_OWNONLY || 'false') === 'true'
const keep = Math.max(1, parseInt(keepArg || E.JOURNALI_KEEP || '14', 10) || 14)
const headers = { 'X-Actor': actor, ...(process.env.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + process.env.JOURNALI_TOKEN } : {}) }   // mit Benutzern: Dienst-Token des Laufs
const jobKey = E.JOURNALI_JOB ? E.JOURNALI_JOB + '-' : ''   // vom JobRunner; von Hand: ohne
const api = { get: async p => { const r = await fetch(server + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r.json() } }

;(async () => {
  const model = await api.get('/api/model')
  const locs = locales.length ? locales : [model.masterLocale ?? model.locales[0]?.code ?? 'de']
  const rows = await api.get('/api/tree')
  const roots = root ? rows.filter(r => r.id === root) : rows.filter(r => !r.parent)
  if (!roots.length) throw new Error(`kein Knoten ${root || '(Wurzel)'}`)
  fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  let X = null
  if (format === 'xlsx') X = await import(new URL('../xlsx/xlsx.mjs', import.meta.url).href)
  for (const r of roots) {
    const t = await build({ api, model }, { root: r.id, role, locales: locs, ownOnly, viewKey, say: m => console.log(m) })
    const safe = String(r.label ?? r.id).replace(/[^\w.-]+/g, '_').slice(0, 40)
    const file = path.join(dir, `${jobKey}${safe}-${r.id}-${stamp}.${format === 'csv' ? 'csv' : 'xlsx'}`)   // Job-Key davor: Stände je Job (Taloan)
    if (format === 'csv') fs.writeFileSync(file, toCsv(t), 'utf8')
    else fs.writeFileSync(file, Buffer.from(X.write(workbook(X, t), { type: 'array', bookType: 'xlsx' })))
    console.log(`${file}: ${t.count} Zeilen, ${t.columns.length} Spalten, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`)
    const old = fs.readdirSync(dir).filter(f => f.startsWith(jobKey) && f.includes(`-${r.id}-`) && /\.(xlsx|csv)$/.test(f)).sort()
    for (const f of old.slice(0, Math.max(0, old.length - keep))) { fs.unlinkSync(path.join(dir, f)); console.log(`alt entfernt: ${f}`) }
  }
  console.log(`✓ ${roots.length} Wurzel${roots.length > 1 ? 'n' : ''} exportiert nach ${dir}`)
})().catch(e => { console.error('✗ ' + e.message); process.exit(1) })
