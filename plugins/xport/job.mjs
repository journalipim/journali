// Export mit Vorlage als Job: gespeichertes Profil (Vorlage, Zuordnung, Kopfwerte, Teilbaum, Sprache) → eine Datei
// in ein Verzeichnis. Aufruf: node job.mjs <journali> <actor> <profil> [dir] [root] [locale] — oder JOURNALI_* aus der Umgebung.
import fs from 'node:fs'
import path from 'node:path'
import { render, build } from './core.mjs'

const [,, serverArg, actorArg, profileArg, dirArg, rootArg, localeArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/+$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:xport'
const profileName = profileArg || E.JOURNALI_PROFILE || ''
const dir = path.resolve(dirArg || E.JOURNALI_DIR || 'export')
const headers = { 'X-Actor': actor, ...(E.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + E.JOURNALI_TOKEN } : {}) }
const api = { get: async p => { const r = await fetch(server + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r.json() } }

;(async () => {
  if (!profileName) throw new Error('Profil fehlt (Name, wie in ⇪ Export → Vorlage gespeichert)')
  const profile = await api.get(`/api/plugins/xport/data/${encodeURIComponent('profile:' + profileName)}`).catch(() => null)
  if (!profile?.template) throw new Error(`Profil „${profileName}“ nicht gefunden oder ohne Vorlage`)
  const model = await api.get('/api/model'); const rows = await api.get('/api/tree')
  const byId = new Map(rows.map(r => [r.id, r])); const kidsOf = new Map()
  for (const r of rows) { if (!kidsOf.has(r.parent ?? '')) kidsOf.set(r.parent ?? '', []); kidsOf.get(r.parent ?? '').push(r) }
  const tree = { rows, byId, kids: id => kidsOf.get(id ?? '') ?? [] }
  const root = rootArg || E.JOURNALI_ROOT || profile.root || ''
  const locale = localeArg || E.JOURNALI_LOCALE || profile.locale || model.masterLocale || 'de'
  const ctx = await build({ api, model, tree, server }, { root, role: profile.role || 'product', locale, mapping: profile.mapping ?? {}, vars: profile.vars ?? {}, features: profile.features ?? [], say: m => { if (/^\d+\/\d+/.test(m) && Number(m.split('/')[0]) % 50 === 0) console.log(m) } })
  const out = render(profile.template, ctx, profile.mode || 'xml', locale)
  fs.mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const name = (profile.fileName || `${profileName}-{date}.xml`).replace('{date}', stamp).replace('{locale}', locale)
  const file = path.join(dir, name)
  fs.writeFileSync(file, out, 'utf8')
  console.log(`✓ ${file}: ${ctx.count} Produkte, ${(out.length / 1024).toFixed(0)} KB (Profil ${profileName}, ${locale})`)
})().catch(e => { console.error('✗ ' + (e.message ?? e)); process.exit(1) })
