// Tabellen-Export als Job — der Kern, den die Format-Plugins aufrufen: csv/export-job.mjs und excel/export-job.mjs
// geben nur ihr Format mit. Ein Format, ein Plugin: frueher war das ein eigenes Plugin `export`, das das Format als
// Parameter fuehrte — die Umkehrung des Modells (25.09.2026). Derselbe Aufbau wie die Ansicht (core.mjs).
//
// Argumente (wie gehabt auch als JOURNALI_*): <journali> <actor> <root> <dir> <name> <locales> <role> <view>
// <ownOnly> <relations> <keep> <pub>. name ist die Vorlage fuer den Dateinamen, leer = <wurzel>-<id>-<zeit>.
// pub: Publikationsbaum statt Teilbaum — exportiert wird die Ausleitung (GET /api/pub/{id}/export), je Zeile der
// Rubrikpfad; was zurueckgehalten wird, steht mit Grund im Protokoll.

import fs from 'node:fs'
import path from 'node:path'
import { build, toCsv, workbook, relationenTabelle } from './core.mjs'

export async function lauf(format) {
  const [,, serverArg, actorArg, rootArg, dirArg, nameArg, locArg, roleArg, viewArg, ownArg, relArg, keepArg, pubArg] = process.argv
  const E = process.env
  const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/+$/, '')
  const actor = actorArg || E.JOURNALI_ACTOR || 'job:' + format
  const root = rootArg || E.JOURNALI_ROOT || ''
  const dir = path.resolve(dirArg || E.JOURNALI_DIR || 'export')
  const locales = (locArg || E.JOURNALI_LOCALES || '').split(/[,\s]+/).filter(Boolean)
  const role = roleArg || E.JOURNALI_ROLE || ''
  const viewKey = viewArg || E.JOURNALI_VIEW || ''
  const ownOnly = (ownArg || E.JOURNALI_OWNONLY || 'false') === 'true'
  const relations = format === 'excel' && (relArg || E.JOURNALI_RELATIONS || 'false') === 'true'   // nur Excel hat ein zweites Blatt
  const keep = Math.max(1, parseInt(keepArg || E.JOURNALI_KEEP || '14', 10) || 14)
  const pub = pubArg || E.JOURNALI_PUB || ''
  const nameVorlage = (nameArg || E.JOURNALI_NAME || '').trim()
  const headers = { 'X-Actor': actor, ...(process.env.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + process.env.JOURNALI_TOKEN } : {}) }   // mit Benutzern: Dienst-Token des Laufs
  const jobKey = E.JOURNALI_JOB ? E.JOURNALI_JOB + '-' : ''   // vom JobRunner; von Hand: ohne
  const api = { get: async p => { const r = await fetch(server + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r.json() } }


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
      const t = await build({ api, model }, { root: r.id, role, locales: locs, ownOnly, viewKey, channel, only, at, relations, extra: pathOf ? [{ key: 'rubric', of: id => (pathOf.get(id) ?? []).join(' | ') }] : [], say: m => console.log(m) })
      if (only && !t.count) { console.log(`${r.label}: nichts in der Ausleitung`); continue }
      const safe = String(r.file ?? r.label ?? r.id).replace(/[^\w.-]+/g, '_').slice(0, 40)
      const endung = format === 'csv' ? 'csv' : 'xlsx'
      // Dateiname aus der Vorlage; ohne Vorlage wie bisher. Der Job-Key davor haelt die Staende je Job auseinander
      const aus = nameVorlage
        ? nameVorlage.replace(/\{(wurzel|id|zeit|format)\}/g, (_, w) => ({ wurzel: safe, id: r.id, zeit: stamp, format: endung })[w])
        : `${jobKey}${safe}-${r.id}-${stamp}`
      const file = path.join(dir, /\.\w+$/.test(aus) ? aus : `${aus}.${endung}`)
      if (format === 'csv') fs.writeFileSync(file, toCsv(t), 'utf8')
      else fs.writeFileSync(file, Buffer.from(X.write(workbook(X, t, null, 'Daten', relationenTabelle([t])), { type: 'array', bookType: 'xlsx' })))
      console.log(`${file}: ${t.count} Zeilen, ${t.columns.length} Spalten, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`)
      const old = fs.readdirSync(dir).filter(f => f.startsWith(jobKey) && f.includes(`-${r.id}-`) && /\.(xlsx|csv)$/.test(f)).sort()
      for (const f of old.slice(0, Math.max(0, old.length - keep))) { fs.unlinkSync(path.join(dir, f)); console.log(`alt entfernt: ${f}`) }
    }
    console.log(`✓ ${roots.length} Wurzel${roots.length > 1 ? 'n' : ''} exportiert nach ${dir}`)
}
