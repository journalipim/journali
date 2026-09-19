// JSON-Import als Job (Taloan, 19.09.2026: „import json → als Job einrichten“): eine Rohdaten-Datei (.json oder .json.gz,
// Pfad oder URL; bei einem Verzeichnis die neueste Datei) mit einem gespeicherten Profil des JSON-Imports (Zuordnung,
// Präfix, Ziel) einspielen — POST /api/nodes/import, ein Stapel. Rückgabe: 0 = ok, 3 = mit Fehlern, 1 = gescheitert.
// Aufruf: node job.mjs <journali> <actor> <source> [profile] [parent] [dryRun] — oder JOURNALI_* aus der Umgebung.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const [,, serverArg, actorArg, sourceArg, profileArg, parentArg, dryArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/+$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:json'
const source = sourceArg || E.JOURNALI_SOURCE
const profileName = profileArg || E.JOURNALI_PROFILE || ''
const parentArgv = parentArg || E.JOURNALI_PARENT || ''
const dryRun = (dryArg || E.JOURNALI_DRYRUN || 'false') === 'true'
if (!source) { console.error('✗ Quelle fehlt (Datei, Verzeichnis oder URL)'); process.exit(1) }

const headers = { 'X-Actor': actor, 'Content-Type': 'application/json', ...(process.env.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + process.env.JOURNALI_TOKEN } : {}) }   // mit Benutzern: Dienst-Token des Laufs
async function request(method, p, body) {
  const res = await fetch(server + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text(); let data = null
  try { data = text ? JSON.parse(text) : null } catch { throw new Error(`${res.status}: ${text.slice(0, 200)}`) }
  if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`)
  return data
}

async function read(src) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src); if (!res.ok) throw new Error(`${src}: ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    return { name: src, text: src.endsWith('.gz') ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8') }
  }
  let file = path.resolve(src)
  if (fs.statSync(file).isDirectory()) {
    const files = fs.readdirSync(file).filter(f => /\.json(\.gz)?$/i.test(f)).map(f => path.join(file, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    if (!files.length) throw new Error(`${file}: keine .json/.json.gz darin`)
    file = files[0]
  }
  const buf = fs.readFileSync(file)
  return { name: file, text: file.endsWith('.gz') ? zlib.gunzipSync(buf).toString('utf8') : buf.toString('utf8') }
}

;(async () => {
  const { name, text } = await read(source)
  const j = JSON.parse(text)
  const node = j?.node ?? j, model = j?.model ?? null
  if (!node?.id || !node?.role || !Array.isArray(node.values)) throw new Error(`${name}: kein Rohdaten-Export (id, role, values) — ausgewertete Exporte lassen sich nicht einspielen`)
  const count = (n => { let c = 1; for (const k of n.children ?? []) c += count(k); return c })(node)
  let profile = null
  if (profileName) { profile = await request('GET', `/api/plugins/json/data/${encodeURIComponent('profile:' + profileName)}`); if (!profile) throw new Error(`Profil „${profileName}“ gibt es nicht (⇩ Import → JSON → Profil speichern)`) }
  const parent = parentArgv || profile?.parent || node.parent || null
  const map = profile ? { attributes: profile.mapA ?? {}, groups: profile.mapG ?? {}, prefix: profile.prefix ?? '' } : null
  console.log(`${name}: ${count} Knoten${model ? ` · Modell: ${model.groups?.length ?? 0} Gruppen, ${model.attributes?.length ?? 0} Attribute` : ''} → ${parent ?? 'Wurzel'}${profile ? ` · Profil ${profileName}` : ' · ohne Zuordnung (gleiche Keys)'}${dryRun ? ' · Trockenlauf' : ''}`)
  const r = await request('POST', '/api/nodes/import', { node, model, parent, map, dryRun })
  const line = `${r.created} neu · ${r.restored} zurückgeholt · ${r.updated} angeglichen · ${r.model} Modellteile${dryRun ? ' (würden)' : ` · ${r.entries} Einträge (Stapel ${r.batch})`}`
  for (const e of r.errors ?? []) console.log('✗ ' + e)
  if (r.errors?.length) { console.log(`⚠ ${line} — ${r.errors.length} Fehler`); process.exit(3) }
  console.log(`✓ ${line}`)
})().catch(e => { console.error('✗ ' + e.message); process.exit(1) })
