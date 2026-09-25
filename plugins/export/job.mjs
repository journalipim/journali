// Tabellen-Export als Job: ein Teilbaum als Excel oder CSV in ein
// Verzeichnis — derselbe Kern wie ⇪ Export → Tabelle (plugins/table/core.mjs). Behält die letzten n Dateien je Wurzel.
// Aufruf: node job.mjs <journali> <actor> <root> <dir> [format] [locales] [role] [view] [ownOnly] [keep] [pub] — oder JOURNALI_*.
// pub: Publikationsbaum statt Teilbaum — exportiert wird die Ausleitung (GET /api/pub/{id}/export: Freigabe für den Kanal,
// Markt in den Verkaufsländern), Werte auf der Kanalachse des Baums, je Zeile der Rubrikpfad; was zurückgehalten wird, steht mit Grund im Protokoll.
import fs from 'node:fs'
import path from 'node:path'
import { build, toCsv, workbook } from '../table/core.mjs'

const [,, serverArg, actorArg, rootArg, dirArg, fmtArg, locArg, roleArg, viewArg, ownArg, keepArg, pubArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/+$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:export'
const root = rootArg || E.JOURNALI_ROOT || ''
const dir = path.resolve(dirArg || E.JOURNALI_DIR || 'export')
const format = (fmtArg || E.JOURNALI_FORMAT || 'excel').toLowerCase()
const locales = (locArg || E.JOURNALI_LOCALES || '').split(/[,\s]+/).filter(Boolean)
const role = roleArg || E.JOURNALI_ROLE || ''
const viewKey = viewArg || E.JOURNALI_VIEW || ''
const ownOnly = (ownArg || E.JOURNALI_OWNONLY || 'false') === 'true'
const keep = Math.max(1, parseInt(keepArg || E.JOURNALI_KEEP || '14', 10) || 14)
const pub = pubArg || E.JOURNALI_PUB || ''
const headers = { 'X-Actor': actor, ...(process.env.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + process.env.JOURNALI_TOKEN } : {}) }   // mit Benutzern: Dienst-Token des Laufs
const jobKey = E.JOURNALI_JOB ? E.JOURNALI_JOB + '-' : ''   // vom JobRunner; von Hand: ohne
const api = { get: async p => { const r = await fetch(server + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r.json() } }

;(async () => {
  const model = await api.get('/api/model')
  const locs = locales.length ? locales : [model.masterLocale ?? model.locales[0]?.code ?? 'de']
  const rows = await api.get('/api/tree')
  fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  let X = null
  if (format === 'excel') X = await import(new URL('../excel/xlsx.mjs', import.meta.url).href)
  // Ausleitung eines Publikationsbaums: die Zeilen sind die ausgeleiteten Produkte (und ihre ausgeleiteten Varianten), je Rubrik einmal; die Pflegebaum-Wurzeln liefern die Tabelle
  let roots, only = null, pathOf = null, channel = '', at = null
  if (pub) {
    const x = await api.get(`/api/pub/${encodeURIComponent(pub)}/export${locs[0] ? '?locale=' + encodeURIComponent(locs[0]) : ''}`)
    channel = x.tree.channel ?? ''
    only = new Set(); pathOf = new Map()
    for (const r of x.rows) {
      if (!r.in) { console.log(`zurückgehalten: ${r.product.label} — ${r.why.join(' · ')}`); continue }
      const p = r.path.map(s => s.label).join(' › ')
      only.add(r.product.id); pathOf.set(r.product.id, [...(pathOf.get(r.product.id) ?? []), p])
      for (const v of r.variants) if (v.in) { only.add(v.id); pathOf.set(v.id, [...(pathOf.get(v.id) ?? []), p]) }
    }
    console.log(`Ausleitung ${x.tree.label} · ${channel}${x.tree.market ? ' · ' + x.tree.market : ''}: ${x.in} Produkte ausgeleitet, ${x.out} zurückgehalten`)
    // Stand: ein Stand für alles, was ausgeleitet wird → die Werte von damals; gemischte Stände je Rubrik → Werte live, mit Hinweis
    const stands = [...new Set(x.rows.filter(r => r.in).map(r => r.stand ?? 0))]
    if (stands.length === 1 && stands[0]) { at = stands[0]; console.log(`Stand #${at}: Werte wie damals`) }
    else if (stands.length > 1) console.log(`⚠ gemischte Stände je Rubrik (${stands.map(s => s ? '#' + s : 'live').join(', ')}) — Zugehörigkeit je Stand, Werte live`)
    roots = rows.filter(r => !r.parent && r.role !== 'rubric').map(r => ({ ...r, file: `${x.tree.label}-${x.tree.id}` }))
  } else {
    roots = root ? rows.filter(r => r.id === root) : rows.filter(r => !r.parent && r.role !== 'rubric')
    if (!roots.length) throw new Error(`kein Knoten ${root || '(Wurzel)'}`)
  }
  for (const r of roots) {
    const t = await build({ api, model }, { root: r.id, role, locales: locs, ownOnly, viewKey, channel, only, at, extra: pathOf ? [{ key: 'rubric', of: id => (pathOf.get(id) ?? []).join(' | ') }] : [], say: m => console.log(m) })
    if (only && !t.count) { console.log(`${r.label}: nichts in der Ausleitung`); continue }
    const safe = String(r.file ?? r.label ?? r.id).replace(/[^\w.-]+/g, '_').slice(0, 40)
    const file = path.join(dir, `${jobKey}${safe}-${r.id}-${stamp}.${format === 'csv' ? 'csv' : 'xlsx'}`)   // Job-Key davor: Stände je Job
    if (format === 'csv') fs.writeFileSync(file, toCsv(t), 'utf8')
    else fs.writeFileSync(file, Buffer.from(X.write(workbook(X, t), { type: 'array', bookType: 'xlsx' })))
    console.log(`${file}: ${t.count} Zeilen, ${t.columns.length} Spalten, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`)
    const old = fs.readdirSync(dir).filter(f => f.startsWith(jobKey) && f.includes(`-${r.id}-`) && /\.(xlsx|csv)$/.test(f)).sort()
    for (const f of old.slice(0, Math.max(0, old.length - keep))) { fs.unlinkSync(path.join(dir, f)); console.log(`alt entfernt: ${f}`) }
  }
  console.log(`✓ ${roots.length} Wurzel${roots.length > 1 ? 'n' : ''} exportiert nach ${dir}`)
})().catch(e => { console.error('✗ ' + e.message); process.exit(1) })
