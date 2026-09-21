// Plugin xliff als Job (Taloan, 21.09.2026): export — XLIFF der offenen Einheiten nach out/ (Fächer des Taskers, latest für die
// Agentur); import — übersetzte XLIFF-Dateien aus in/ zurückschreiben (nur bei unveränderter Quelle). Alles Datenthematische
// steht im Profil (⇄ Übersetzung → 💾): Sprachen, Kanal, Umfang, Attribute, Teilbaum.
// Aufruf: node job.mjs <journali> <actor> export <profile> <dir> | node job.mjs <journali> <actor> import <profile> <source> [force]
import fs from 'node:fs'
import path from 'node:path'

const [,, serverArg, actorArg, mode, profileArg, pathArg, forceArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:xliff'
const profileName = profileArg || E.JOURNALI_PROFILE || ''
const headers = { 'X-Actor': actor, ...(E.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + E.JOURNALI_TOKEN } : {}) }
async function get(p) { const r = await fetch(server + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r }

let code = 0
try {
  const profile = profileName ? await (await get(`/api/plugins/xliff/data/${encodeURIComponent('profile:' + profileName)}`)).json() : null
  const from = E.JOURNALI_FROM || profile?.from || '', to = E.JOURNALI_TO || profile?.to || ''
  if (mode === 'export') {
    if (!to) throw new Error('Zielsprache fehlt — im Profil (⇄ Übersetzung → 💾) oder als Parameter to')
    const dir = path.resolve(pathArg || E.JOURNALI_DIR || 'export'); fs.mkdirSync(dir, { recursive: true })
    const qs = `root=${encodeURIComponent(profile?.root ?? '')}&from=${from}&to=${to}&channel=${encodeURIComponent(profile?.channel ?? '')}&attributes=${encodeURIComponent(profile?.attributes ?? '')}&scope=${profile?.scope ?? 'open'}`
    const r = await get(`/api/translate/xliff?${qs}`)
    const xml = await r.text()
    const units = (xml.match(/<unit\b/g) || []).length
    const file = path.join(dir, `xliff-${from || 'master'}-${to}-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)}.xlf`)
    fs.writeFileSync(file, xml)
    console.log(`${file}: ${units} Einheiten (${from || 'Master'} → ${to})`)
    if (!units) console.log('nichts offen — die Agentur bekommt eine leere Datei; Aufbewahrung räumt sie weg')
  } else if (mode === 'import') {
    const src = pathArg || E.JOURNALI_SOURCE || ''
    if (!src) throw new Error('Quelle fehlt (Datei oder Verzeichnis mit .xlf — oder das Fach in/ des Jobs)')
    const files = fs.statSync(src).isDirectory() ? fs.readdirSync(src).filter(f => /\.(xlf|xliff|xml)$/i.test(f)).sort().map(f => path.join(src, f)) : [src]
    if (!files.length) throw new Error('keine XLIFF-Datei in ' + src)
    const force = String(forceArg || E.JOURNALI_FORCE || 'false') === 'true'
    let total = 0, skipped = 0
    for (const f of files) {
      const xml = fs.readFileSync(f, 'utf8')
      const r = await fetch(`${server}/api/translate/xliff?force=${force}${to ? '&to=' + to : ''}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/xml' }, body: xml })
      const o = await r.json(); if (!r.ok) throw new Error(`${path.basename(f)}: ${o.error || r.status}`)
      total += o.written; skipped += o.skipped
      console.log(`${path.basename(f)}: ${o.written} geschrieben · ${o.unchanged} unverändert · ${o.skipped} übergangen · ${o.missing} unbekannt`)
      for (const e of o.errors ?? []) console.log('  ' + e)
    }
    console.log(`✓ ${total} Zieltexte geschrieben${skipped ? `, ${skipped} übergangen (Quelle geändert — force=true schreibt trotzdem)` : ''}`)
    if (skipped) code = 3
  } else throw new Error('Modus export oder import erwartet')
} catch (e) { console.error('✗ ' + e.message); code = 1 }
process.exit(code)
