// Sicherung als Prozess (Plugin backup): holt GET /api/nodes/{id}/export (Rohdaten, mit Modellteil) und schreibt
// <dir>/<label>-<id>-<zeitstempel>.json; ohne root alle Wurzeln. Behält je Wurzel die letzten <keep> Dateien.
// Aufruf: node backup.js <journali> <actor> [root] [dir] [keep] — der JobRunner setzt die Werte auch als JOURNALI_* in die Umgebung.
const fs = require('fs'); const path = require('path')
const [,, server, actor, rootArg, dirArg, keepArg] = process.argv
if (!server) { console.error('journali-Adresse fehlt'); process.exit(2) }
const dir = path.resolve(dirArg || 'backup'); const keep = Math.max(1, parseInt(keepArg || '14', 10) || 14)
const headers = { 'X-Actor': actor || 'job:backup' }
async function get(p) { const r = await fetch(server + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r.json() }
;(async () => {
  fs.mkdirSync(dir, { recursive: true })
  const tree = await get('/api/tree')
  const rows = Array.isArray(tree) ? tree : tree.rows ?? []
  const roots = rootArg ? rows.filter(r => r.id === rootArg) : rows.filter(r => !r.parent)
  if (!roots.length) { console.error(`kein Knoten ${rootArg ?? '(Wurzel)'}`); process.exit(1) }
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  let total = 0
  for (const r of roots) {
    const raw = await get(`/api/nodes/${encodeURIComponent(r.id)}/export?deep=true`)
    const count = (n => { let c = 1; for (const k of n.children ?? []) c += count(k); return c })(raw.node)
    const safe = String(r.label ?? r.id).replace(/[^\w.-]+/g, '_').slice(0, 40)
    const file = path.join(dir, `${safe}-${r.id}-${stamp}.json`)
    fs.writeFileSync(file, JSON.stringify(raw, null, 1))
    total += count
    console.log(`${file}: ${count} Knoten, ${raw.model.attributes.length} Attribute, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`)
    // alte Stände dieser Wurzel wegräumen
    const old = fs.readdirSync(dir).filter(f => f.includes(`-${r.id}-`) && f.endsWith('.json')).sort()
    for (const f of old.slice(0, Math.max(0, old.length - keep))) { fs.unlinkSync(path.join(dir, f)); console.log(`alt entfernt: ${f}`) }
  }
  console.log(`✓ ${roots.length} Wurzel${roots.length > 1 ? 'n' : ''}, ${total} Knoten gesichert nach ${dir}`)
})().catch(e => { console.error('✗ ' + e.message); process.exit(1) })
