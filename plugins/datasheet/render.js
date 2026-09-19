// Belegerzeuger (Taloan, 19.09.2026: „Version erzeugen → finales Datenblatt wird mit der Version weggespeichert“): rendert für
// einen Knoten das Datenblatt (Layout der Rolle oder ein benanntes), lädt es als Medium hoch (POST /api/media, hash-adressiert,
// unveränderlich) und hängt es an die Version (POST /api/nodes/{id}/versions/{nr}/documents). Heute HTML; ein PDF/A-Erzeuger
// ist dasselbe Muster mit anderem Rendering. Aufruf durch den Server bei „Version erzeugen“ oder von Hand:
// node render.js <journali> <actor> <node> <version> [layout] [locale] — oder JOURNALI_* aus der Umgebung.
import { dataOf } from './entry.js'
import { renderSheet, layoutFor, preloadCompare, DEFAULT_LAYOUT } from './designer.js'

const [,, serverArg, actorArg, nodeArg, versionArg, layoutArg, localeArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/+$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'renderer:datasheet'
const node = nodeArg || E.JOURNALI_NODE || ''
const version = parseInt(versionArg || E.JOURNALI_VERSION || '0', 10)
const layoutName = layoutArg || E.JOURNALI_LAYOUT || ''
const localeArgv = localeArg || E.JOURNALI_LOCALE || ''
const kind = E.JOURNALI_KIND || 'datasheet'
if (!node) { console.error('Knoten fehlt'); process.exit(2) }
const headers = { 'X-Actor': actor }
const api = {
  get: async p => { const r = await fetch(server + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r.json() },
  post: async (p, body) => { const r = await fetch(server + p, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r.json() },
}

;(async () => {
  const model = await api.get('/api/model'); const rows = await api.get('/api/tree')
  const byId = new Map(rows.map(r => [r.id, r])); const kidsOf = new Map()
  for (const r of rows) { if (!kidsOf.has(r.parent ?? '')) kidsOf.set(r.parent ?? '', []); kidsOf.get(r.parent ?? '').push(r) }
  const tree = { rows, byId, kids: id => kidsOf.get(id ?? '') ?? [], loaded: true }
  const data = { get: async name => { try { return await api.get(`/api/plugins/datasheet/data/${encodeURIComponent(name)}`) } catch { return null } } }
  const ctx = { api, tree, store: { model, server }, data }
  const r = byId.get(node); if (!r) throw new Error(`Knoten ${node} unbekannt`)
  // Version und Sprache: die Version nennt ggf. Kanal/Sprache — die Sprache gilt dann fürs Blatt
  let v = null
  if (version) { const all = await api.get(`/api/nodes/${encodeURIComponent(node)}/versions`); v = all.find(x => x.nr === version) ?? null; if (!v) throw new Error(`Version ${version} von ${node} unbekannt`) }
  const l = await layoutFor(ctx, r.role)
  const layout = layoutName ? ((await data.get('layout:' + layoutName)) ?? DEFAULT_LAYOUT()) : l.layout
  const locale = localeArgv || v?.locale || l.locale
  const types = Object.fromEntries(model.attributes.map(a => [a.key, a.type]))
  const d = await dataOf(ctx, r.id, locale); d.types = types; d.locale = locale
  await preloadCompare(ctx, layout, d, locale)
  let html = renderSheet(layout, d, model, tree)
  // Belegkopf: Version, Stand, Datum — damit das Dokument für sich spricht
  if (v) html = html.replace('</body>', `<footer style="margin-top:24px;padding-top:8px;border-top:1px solid #999;font:11px sans-serif;color:#555">Version ${v.nr} · Stand #${v.journalNumber} · ${new Date(v.at).toLocaleString('de-DE')} · ${v.channel ?? ''} ${v.locale ?? ''} · ${r.label} (${r.id})</footer></body>`)
  const name = `${String(r.label ?? r.id).replace(/[^\w.-]+/g, '_').slice(0, 60)}-v${version || 0}-${locale}.html`
  const form = new FormData(); form.append('file', new Blob([html], { type: 'text/html' }), name)
  const up = await fetch(server + '/api/media', { method: 'POST', headers, body: form })
  if (!up.ok) throw new Error(`Hochladen: ${up.status} ${await up.text()}`)
  const m = await up.json()
  console.log(`${name}: ${(html.length / 1024).toFixed(0)} KB → ${m.id}${m.existed ? ' (gab es schon)' : ''}`)
  if (version) { await api.post(`/api/nodes/${encodeURIComponent(node)}/versions/${version}/documents`, { kind, mediaId: m.id, renderer: 'datasheet' }); console.log(`✓ an Version ${version} angehängt (${kind})`) }
})().catch(e => { console.error('✗ ' + (e.message ?? e)); process.exit(1) })
