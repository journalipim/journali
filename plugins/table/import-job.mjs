// Tabellen-Import als Job — der Kern, den die Format-Plugins aufrufen: csv/import-job.mjs und excel/import-job.mjs
// geben nur ihr Format mit. Dieselbe Zuordnung wie die Ansicht: der Datenmapper (web/src/mapper.js) läuft ohne
// Browser, also rechnet der Job denselben Plan und schreibt denselben Stapel (25.09.2026).
//
// Was WAS importiert wird, steht im Profil (Zuordnung, Ziel im Baum, Rolle, Kennung) — angelegt in der Ansicht des
// Plugins, nicht hier: 180 Spalten mit Umwandlungen richtet man nicht in einem Job-Dialog ein. Am Job steht nur,
// WOHER die Datei kommt und WANN.
//
// Argumente (auch als JOURNALI_*): <journali> <actor> <source> <profile> [dryRun]
import fs from 'node:fs'
import path from 'node:path'
import { plan as makePlan, parseDelimited } from '../../web/src/mapper.js'
import { trenne, bestandLaden, planRelationen } from '../../web/src/relationen-import.js'

/// Ein Baum-Abbild, wie der Mapper es erwartet: rows, byId, ancestors.
function baum(rows) {
  const byId = new Map(rows.map(r => [r.id, r]))
  const ancestors = (id) => {
    const aus = []
    for (let n = byId.get(id)?.parent ? byId.get(byId.get(id).parent) : null; n; n = n.parent ? byId.get(n.parent) : null) aus.unshift(n)
    return aus
  }
  return { rows, byId, ancestors, kids: (id) => rows.filter(r => r.parent === id) }
}

export async function lauf(format) {
  const [,, serverArg, actorArg, sourceArg, profileArg, dryArg] = process.argv
  const E = process.env
  const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/+$/, '')
  const actor = actorArg || E.JOURNALI_ACTOR || 'job:' + format
  const quelle = sourceArg || E.JOURNALI_SOURCE || ''
  const profilName = profileArg || E.JOURNALI_PROFILE || ''
  const dryRun = (dryArg || E.JOURNALI_DRYRUN || 'false') === 'true'
  if (!quelle) { console.error('✗ Quelle fehlt (Datei oder Verzeichnis)'); process.exit(1) }
  if (!profilName) { console.error('✗ Profil fehlt — in der Ansicht des Plugins anlegen'); process.exit(1) }

  const headers = { 'X-Actor': actor, 'Content-Type': 'application/json', ...(E.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + E.JOURNALI_TOKEN } : {}) }
  const api = {
    get: async p => { const r = await fetch(server + p, { headers }); if (!r.ok) throw new Error(`${p}: ${r.status} ${await r.text()}`); return r.json() },
    post: async (p, body) => { const r = await fetch(server + p, { method: 'POST', headers, body: JSON.stringify(body) }); const t = await r.text(); if (!r.ok) throw new Error(`${p}: ${r.status} ${t}`); return t ? JSON.parse(t) : null },
  }

  // Die Datei: ein Verzeichnis liefert die neueste passende — den Rest macht der Tasker über die Fächer
  const endungen = format === 'csv' ? ['.csv', '.tsv', '.txt'] : ['.xlsx', '.xlsm']
  let datei = path.resolve(quelle)
  if (fs.existsSync(datei) && fs.statSync(datei).isDirectory()) {
    const kandidaten = fs.readdirSync(datei).filter(f => endungen.includes(path.extname(f).toLowerCase()))
      .map(f => ({ f, at: fs.statSync(path.join(datei, f)).mtimeMs })).sort((a, b) => b.at - a.at)
    if (!kandidaten.length) throw new Error(`keine ${endungen.join('/')} in ${datei}`)
    datei = path.join(datei, kandidaten[0].f)
  }
  if (!fs.existsSync(datei)) throw new Error(`Datei nicht gefunden: ${datei}`)
  console.log(`lese ${datei}`)

  // Tabelle einlesen — CSV selbst, Excel über SheetJS aus dem Plugin excel
  let tabelle, relBlatt = null   // relBlatt: das Blatt Relationen einer Excel-Datei
  if (format === 'csv') tabelle = parseDelimited(fs.readFileSync(datei, 'utf8'))
  else {
    const X = await import(new URL('../excel/xlsx.mjs', import.meta.url).href)
    const wb = X.read(fs.readFileSync(datei), { type: 'buffer', cellDates: true })
    const blatt = name => {
      const aoa = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: true })
      const kopf = (aoa[0] ?? []).map((c, i) => String(c ?? '').trim() || `Spalte ${i + 1}`)
      return { name, columns: kopf, rows: aoa.slice(1).filter(r => r.some(v => v !== '' && v != null))
        .map(r => kopf.map((_, i) => { const v = r[i]; return v instanceof Date ? v.toISOString().slice(0, 10) : v == null ? '' : v })) }
    }
    // das erste Blatt, das nicht Relationen ist, wird zugeordnet; das Blatt Relationen folgt dem Plan der Knoten
    const alle = wb.SheetNames.map(blatt)
    const { blaetter, relationen } = trenne({ sheets: alle })
    relBlatt = relationen
    tabelle = blaetter[0] ?? alle[0]
  }
  console.log(`${tabelle.rows.length} Zeilen, ${tabelle.columns.length} Spalten`)

  // Das Profil: dieselbe Form, die die Ansicht speichert (config:<name> im Plugin-Strom)
  const plugin = format === 'csv' ? 'csv' : 'excel'
  let profil
  // Das Profil des Dienstes: import:<name> beim Format-Plugin — ein Exportprofil steht in einem anderen Namensraum
  try { profil = await api.get(`/api/plugins/${plugin}/data/${encodeURIComponent('import:' + profilName)}`) }
  catch { throw new Error(`Profil ${profilName} gibt es beim Plugin ${plugin} nicht`) }
  if (!profil?.mapping) throw new Error(`Profil ${profilName} hat keine Zuordnung`)

  const model = await api.get('/api/model')
  const tree = baum(await api.get('/api/tree').then(x => Array.isArray(x) ? x : x.rows ?? []))
  const target = profil.target ? tree.byId.get(profil.target) ?? null : null
  if (profil.target && !target) throw new Error(`Ziel ${profil.target} gibt es im Baum nicht`)

  // Zuordnung je Spalte der Datei — was das Profil nicht kennt, wird übersprungen
  const mapping = tabelle.columns.map(c => ({ column: c, ...(profil.mapping[c] ?? { target: 'skip' }) }))
  const ohne = tabelle.columns.filter(c => !profil.mapping[c])
  if (ohne.length) console.log(`nicht im Profil, übersprungen: ${ohne.join(', ')}`)

  // Bestand der Zielknoten, damit unveränderte Werte nicht neu geschrieben werden — sie kosten sonst Kontingent
  const existing = new Map()
  const attrKeys = [...new Set(mapping.filter(m => m.target === 'attr' && m.attribute).map(m => m.attribute))]
  if (target && attrKeys.length) {
    const locales = [...new Set(mapping.map(m => m.locale).filter(Boolean))]
    for (const loc of locales.length ? locales : [model.masterLocale ?? 'de']) {
      const t = await api.get(`/api/nodes/${encodeURIComponent(target.id)}/table?deep=true&attributes=${encodeURIComponent(attrKeys.join(','))}&locale=${encodeURIComponent(loc)}`)
      for (const r of t.rows) {
        const cur = existing.get(r.row.id) ?? {}
        for (const [k, v] of Object.entries(r.values)) if (v.value != null) { cur[`${k}|${loc}`] = v.value; cur[`${k}|${loc}#own`] = v.own }
        existing.set(r.row.id, cur)
      }
    }
  }

  const p = makePlan({ columns: tabelle.columns, rows: tabelle.rows, mapping, model, tree, target, role: profil.role || null, existing, external: profil.external || null })
  const s = p.stats
  console.log(`Plan: ${s.create} neu, ${s.update} geändert, ${s.unchanged} unverändert, ${s.values} Werte${s.problems.length ? `, ${s.problems.length} Probleme` : ''}`)
  for (const pr of s.problems.slice(0, 20)) console.log(`  ⚠ ${typeof pr === 'string' ? pr : JSON.stringify(pr)}`)
  if (relBlatt) {
    const bestand = await bestandLaden(api, relBlatt, p.ids, tree)
    const rp = planRelationen({ blatt: relBlatt, model, tree, ids: p.ids, bestand })
    p.commands.push(...rp.commands)
    console.log(`Relationen: ${rp.stats.create} neu, ${rp.stats.update} geändert, ${rp.stats.unchanged} unverändert, ${rp.stats.values} Werte${rp.stats.problems.length + rp.stats.invalid.length ? `, ${rp.stats.problems.length + rp.stats.invalid.length} Probleme` : ''}`)
    for (const pr of rp.stats.problems.slice(0, 20)) console.log(`  ⚠ ${pr}`)
    for (const x of rp.stats.invalid.slice(0, 20)) console.log(`  ⚠ Relationen, Zeile ${x.row + 2}: ${x.key} ${x.message}`)
  }
  if (p.newAttributes?.length) console.log(`  neue Attribute: ${p.newAttributes.map(a => a.key ?? a).join(', ')}`)

  // Wie viele Einträge der Lauf schreibt — im Trockenlauf, was er schreiben würde. Der Tasker warnt damit vor dem Kontingent (03.10.2026)
  console.log(`journali:eintraege=${p.commands?.length ?? 0}`)
  if (dryRun) { console.log(`Trockenlauf — nichts geschrieben · ${p.commands?.length ?? 0} Befehle`); return }
  if (!p.commands?.length) { console.log('nichts zu schreiben'); return }

  // Ein Stapel: er lässt sich als Ganzes zurücknehmen
  const r = await api.post('/api/batch', { commands: p.commands })
  if (r?.error) throw new Error(`Stapel ${r.batch}: ${r.error.message ?? JSON.stringify(r.error)}`)
  console.log(`✓ ${p.commands.length} Befehle geschrieben, Stapel ${r?.batch ?? '—'}`)
}
