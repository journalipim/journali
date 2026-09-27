// Plugin rag: exportiert je Knoten ein sauberes,
// zitierfähiges Dokument für Vektor-Stores und RAG-Dienste — Markdown je Knoten und eine nodes.jsonl (Id, Rolle, Pfad,
// SKU, Sprache, Text, Version, Belege). Keine Datenbank anzapfen, kein Parsen von Datenblättern: das Journal liefert
// den Stand, die Version die Zitierstelle. Aufruf: node job.mjs <journali> <actor> [root] [dir] [role] [locales] [withVersions]
import fs from 'node:fs'
import path from 'node:path'

const [,, serverArg, actorArg, rootArg, dirArg, roleArg, locArg, verArg, docsArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/+$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:rag'
const root = rootArg || E.JOURNALI_ROOT || ''
const dir = path.resolve(dirArg || E.JOURNALI_DIR || 'rag')
const roleFilter = roleArg || E.JOURNALI_ROLE || 'product'
const locales = (locArg || E.JOURNALI_LOCALES || '').split(/[,\s]+/).filter(Boolean)
const withVersions = (verArg || E.JOURNALI_WITHVERSIONS || 'true') === 'true'
const withDocs = (docsArg || E.JOURNALI_WITHDOCS || 'true') === 'true'   // der Text der Dokumente am Knoten aus dem Dokumentindex (34 J)
const headers = { 'X-Actor': actor, ...(process.env.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + process.env.JOURNALI_TOKEN } : {}) }   // mit Benutzern: Dienst-Token des Laufs
const api = { get: async p => { const r = await fetch(server + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r.json() } }

;(async () => {
  const model = await api.get('/api/model'); const rows = await api.get('/api/tree')
  const locs = locales.length ? locales : [model.masterLocale ?? model.locales[0]?.code ?? 'de']
  const byId = new Map(rows.map(r => [r.id, r]))
  const pathOf = id => { const out = []; for (let p = byId.get(id)?.parent; p; p = byId.get(p)?.parent) out.unshift(byId.get(p)?.label ?? p); return out }
  const under = id => { for (let p = byId.get(id)?.parent; p; p = byId.get(p)?.parent) if (p === root) return true; return false }
  const targets = rows.filter(r => (root ? r.id === root || under(r.id) : true) && (roleFilter === 'all' || r.role === roleFilter))
  if (!targets.length) throw new Error(`keine Knoten (${roleFilter}) unter ${root || 'Wurzel'}`)
  fs.mkdirSync(dir, { recursive: true })
  const defs = new Map(model.attributes.map(a => [a.key, a]))
  const key = v => `${v.attribute}|${v.locale ?? ''}|${v.channel ?? ''}`
  const lines = []; let n = 0
  for (const r of targets) {
    const node = await api.get(`/api/nodes/${encodeURIComponent(r.id)}`)
    const own = new Map(node.values.map(v => [key(v), v.values ? v.values.join(', ') : v.value]))
    const anc = node.ancestors.map(a => new Map(a.values.map(v => [key(v), v.values ? v.values.join(', ') : v.value])))
    const look = (m, k, loc) => m.get(`${k}|${loc}|`) ?? (loc ? m.get(`${k}||`) : null) ?? null
    let version = null
    if (withVersions) { try { const vs = await api.get(`/api/nodes/${encodeURIComponent(r.id)}/versions`); version = [...vs].reverse().find(v => !v.withdrawn) ?? null } catch { } }
    // Die Dokumente am Knoten mit ihrem Text aus dem Index (GET /api/docs/{id}/text): erst damit hat ein fremder
    // Store die Datenblätter — bisher stand nur ihre Adresse im Export. Nicht gelesene bleiben eine Adresse.
    const texte = []
    if (withDocs) {
      try {
        const rels = await api.get(`/api/nodes/${encodeURIComponent(r.id)}/relations?export=true`)   // nur, was in die Ausleitung darf: gültig und freigegeben
        for (const rel of (rels.out ?? []).filter(x => x.other?.role === 'media')) {
          try { const t = await api.get(`/api/docs/${encodeURIComponent(rel.other.id)}/text`); if (t.chunks?.length) texte.push({ id: rel.other.id, name: rel.other.label, chunks: t.chunks.slice(0, 200) }) } catch { }
        }
      } catch { }
    }
    for (const locale of locs) {
      const facts = []
      for (const d of model.attributes) {
        if (['rows', 'template'].includes(d.type)) continue
        const loc = d.perLocale ? locale : ''
        let v = d.type === 'formula' ? node.computed.find(c => c.attribute === d.key && (c.locale ?? null) === (d.perLocale ? locale : null))?.value ?? null : look(own, d.key, loc)
        if (v == null && d.inheritable) for (const m of anc) { v = look(m, d.key, loc); if (v != null) break }
        if (v == null || v === '') continue
        if (d.type === 'enum') { const list = model.lists.find(x => x.key === d.list); v = String(v).split(',').map(x => list?.values.find(y => y.value === x.trim())?.label?.[locale] ?? x.trim()).join(', ') }
        if (d.type === 'html') v = String(v).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        facts.push({ label: d.label?.[locale] || d.label?.de || d.key, key: d.key, value: String(v), unit: d.unit ?? '' })
      }
      const crumbs = pathOf(r.id)
      const title = r.label; const ROLE = { group: 'Produktgruppe', product: 'Produkt', variant: 'Variante' }
      const md = [`# ${title}`, '', `${ROLE[r.role] ?? r.role} · ${crumbs.join(' › ')}${r.keys ? ' · ' + Object.entries(r.keys).map(([k, v]) => `${k} ${v}`).join(' · ') : ''} · Sprache ${locale}`,
        version ? `Version ${version.nr} · Stand #${version.journalNumber} · ${new Date(version.at).toISOString().slice(0, 10)}` : `Stand #${node.lastNumber ?? ''} (keine freigegebene Version)`, '',
        ...facts.map(f => `- **${f.label}:** ${f.value}${f.unit ? ' ' + f.unit : ''}`),
        ...texte.flatMap(d => ['', `## Dokument: ${d.name}`, ...d.chunks.map(c => (c.page ? `(Seite ${c.page}) ` : '') + (c.heading ? `**${c.heading}** ` : '') + c.body)]),
        ...(version?.documents?.length ? ['', '## Belege', ...version.documents.map(d => `- ${d.kind}: ${server}${d.url} (${d.name})`)] : [])].join('\n')
      const file = path.join(dir, `${String(r.label ?? r.id).replace(/[^\w.-]+/g, '_').slice(0, 60)}-${r.id}-${locale}.md`)
      fs.writeFileSync(file, md, 'utf8')
      lines.push(JSON.stringify({ id: r.id, role: r.role, title, path: crumbs, keys: r.keys ?? null, locale, docs: texte.map(d => ({ id: d.id, name: d.name, chunks: d.chunks.length })), version: version ? { nr: version.nr, journalNumber: version.journalNumber, at: version.at, documents: version.documents.map(d => ({ kind: d.kind, url: server + d.url })) } : null, url: `${server}/tree/${r.id}`, text: md, facts: Object.fromEntries(facts.map(f => [f.key, f.value + (f.unit ? ' ' + f.unit : '')])) }))
      n++
    }
    if (n % 25 === 0) console.log(`${n} …`)
  }
  fs.writeFileSync(path.join(dir, 'nodes.jsonl'), lines.join('\n') + '\n', 'utf8')
  console.log(`✓ ${n} Dokumente (${targets.length} Knoten × ${locs.join(', ')}) nach ${dir} — nodes.jsonl + Markdown je Knoten`)
})().catch(e => { console.error('✗ ' + (e.message ?? e)); process.exit(1) })
