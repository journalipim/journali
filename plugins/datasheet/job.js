// Datenblätter als Job (Taloan, 19.09.2026): für einen Teilbaum je Knoten ein fertiges Blatt als HTML in ein Verzeichnis —
// dieselbe Wiedergabe wie „Datenblatt erstellen“ (designer.js, Layout der Rolle oder ein benanntes), dazu index.html.
// Aufruf: node job.js <journali> <actor> <root> <dir> [role] [layout] [locale] — oder JOURNALI_* aus der Umgebung.
import fs from 'node:fs'
import path from 'node:path'
import { dataOf } from './entry.js'
import { renderSheet, layoutFor, preloadCompare, DEFAULT_LAYOUT } from './designer.js'

const [,, serverArg, actorArg, rootArg, dirArg, roleArg, layoutArg, localeArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/+$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:datasheet'
const root = rootArg || E.JOURNALI_ROOT || ''
const dir = path.resolve(dirArg || E.JOURNALI_DIR || 'datenblaetter')
const roleFilter = roleArg || E.JOURNALI_ROLE || 'product'
const layoutName = layoutArg || E.JOURNALI_LAYOUT || ''
const localeArgv = localeArg || E.JOURNALI_LOCALE || ''
const headers = { 'X-Actor': actor, ...(process.env.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + process.env.JOURNALI_TOKEN } : {}) }   // mit Benutzern: Dienst-Token des Laufs
const api = { get: async p => { const r = await fetch(server + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r.json() } }

;(async () => {
  const model = await api.get('/api/model'); const rows = await api.get('/api/tree')
  const byId = new Map(rows.map(r => [r.id, r])); const kidsOf = new Map()
  for (const r of rows) { if (!kidsOf.has(r.parent ?? '')) kidsOf.set(r.parent ?? '', []); kidsOf.get(r.parent ?? '').push(r) }
  const tree = { rows, byId, kids: id => kidsOf.get(id ?? '') ?? [], loaded: true }
  const store = { model, server }
  const data = { get: async name => { try { return await api.get(`/api/plugins/datasheet/data/${encodeURIComponent(name)}`) } catch { return null } } }
  const ctx = { api, tree, store, data }
  const under = id => { for (let p = byId.get(id)?.parent; p; p = byId.get(p)?.parent) if (p === root) return true; return false }
  const targets = rows.filter(r => (root ? r.id === root || under(r.id) : true) && (roleFilter === 'all' || r.role === roleFilter))
  if (!targets.length) throw new Error(`keine Knoten (${roleFilter}) unter ${root || 'Wurzel'}`)
  fs.mkdirSync(dir, { recursive: true })
  const types = Object.fromEntries(model.attributes.map(a => [a.key, a.type]))
  const index = []
  let n = 0
  for (const r of targets) {
    const l = await layoutFor(ctx, r.role)
    const layout = layoutName ? ((await data.get('layout:' + layoutName)) ?? DEFAULT_LAYOUT()) : l.layout
    const locale = localeArgv || l.locale
    const d = await dataOf(ctx, r.id, locale); d.types = types; d.locale = locale
    await preloadCompare(ctx, layout, d, locale)
    const html = renderSheet(layout, d, model, tree)
    const file = path.join(dir, `${String(r.label ?? r.id).replace(/[^\w.-]+/g, '_').slice(0, 60)}-${r.id}.html`)
    fs.writeFileSync(file, html, 'utf8'); index.push([path.basename(file), r]); n++
    if (n % 10 === 0) console.log(`${n}/${targets.length} …`)
  }
  const icon = { group: '▣', product: '▦', variant: '◆' }
  const items = index.map(([f, r]) => `<li>${icon[r.role] ?? ''} <a href="${f}">${r.label}</a> <small>${r.sku ?? ''}</small></li>`).join('')
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><title>Datenblätter</title><style>body{font:14px system-ui;margin:24px}a{text-decoration:none}li{margin:4px 0}</style></head><body><h1>Datenblätter · ${new Date().toLocaleString('de-DE')}</h1><ul>${items}</ul></body></html>`, 'utf8')
  console.log(`✓ ${n} Datenblätter nach ${dir} (index.html)`)
})().catch(e => { console.error('✗ ' + e.message); process.exit(1) })
