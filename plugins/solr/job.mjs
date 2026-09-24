// Solr-Import als Job. Derselbe Ablauf wie in der Ansicht — er steht in lauf.mjs und wird hier nur mit einer
// anderen Umgebung aufgerufen: Solr per fetch statt JSONP, journali über die API mit dem Dienst-Token des Laufs.
//
// Aufruf: node job.mjs <journali> <actor> — alles Weitere aus der Umgebung (der JobRunner setzt JOURNALI_*):
//   JOURNALI_BASE      URL des Solr-Kerns
//   JOURNALI_ROOTS     Solr-Ids der Wurzeln, mit Komma getrennt
//   JOURNALI_TARGET    Zielknoten in journali (leer = oberste Ebene)
//   JOURNALI_SKIP      zusätzlich zu überspringende Felder
//   JOURNALI_RELATIONS "true" = nach den Knoten auch die Kanten
//   JOURNALI_DRY_RUN   "true" = nur analysieren, nichts schreiben
// Rückgabe 0 = geschrieben, 2 = nichts zu tun, 1 = Abbruch.
import { solr, holenMitFetch } from './solr.js'
import { plane, schreibe, planeRelationen, schreibeRelationen, skipListe } from './lauf.mjs'

const [, , serverArg, actorArg] = process.argv
const E = process.env
const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/$/, '')
const actor = actorArg || E.JOURNALI_ACTOR || 'job:solr'
const base = (E.JOURNALI_BASE || '').trim()
const wurzeln = (E.JOURNALI_ROOTS || '').split(',').map(s => s.trim()).filter(Boolean)
const ziel = (E.JOURNALI_TARGET || '').trim() || null
const skip = skipListe(E.JOURNALI_SKIP || '')
const mitKanten = /^(true|1|ja)$/i.test(E.JOURNALI_RELATIONS || '')
const trocken = /^(true|1|ja)$/i.test(E.JOURNALI_DRY_RUN || '')
const headers = { 'X-Actor': actor, 'Content-Type': 'application/json', ...(E.JOURNALI_TOKEN ? { Authorization: 'Bearer ' + E.JOURNALI_TOKEN } : {}) }

if (!base) { console.error('✗ Solr-URL fehlt (base)'); process.exit(1) }
if (!wurzeln.length) { console.error('✗ keine Wurzel gewählt (roots)'); process.exit(1) }

const sag = text => console.log(text)

/// journali fragen — dieselben drei Wege, die die Ansicht benutzt
async function ruf(methode, pfad, koerper) {
  const res = await fetch(server + pfad, { method: methode, headers, body: koerper === undefined ? undefined : JSON.stringify(koerper) })
  const text = await res.text()
  if (!res.ok) {
    let grund = text
    try { grund = JSON.parse(text).error ?? text } catch { /* roher Text */ }
    throw new Error(`${res.status} ${methode} ${pfad.split('?')[0]} — ${grund}`)
  }
  return text ? JSON.parse(text) : null
}

const REF_KEYS = ['node', 'parent', 'group', 'product', 'from', 'to', 'relation', 'media']
const api = {
  get: pfad => ruf('GET', pfad),
  post: (pfad, koerper, methode = 'POST') => ruf(methode, pfad, koerper),
  /// Wie in der Oberfläche: in Stücken, Verweise (@ref) auflösen, Fehler zählen statt aufgeben
  batchChunked: async (commands, { batch = null, size = 2000, label = 'schreibe', continueOnError = false, maxErrorPercent = 0 } = {}) => {
    const refs = new Map()
    const results = []; const errors = []
    let error = null; let batchId = batch; let i = 0
    const ersetze = c => {
      const a = { ...c.args }
      for (const k of REF_KEYS) if (typeof a[k] === 'string' && a[k].startsWith('@') && refs.has(a[k].slice(1))) a[k] = refs.get(a[k].slice(1))
      return { ...c, args: a }
    }
    while (i < commands.length) {
      const ende = Math.min(i + size, commands.length)
      const stueck = commands.slice(i, ende).map(ersetze)
      let res
      for (;;) {
        try { res = await ruf('POST', '/api/batch' + (continueOnError ? '?skipErrors=true' : ''), { commands: stueck, batch: batchId }); break }
        catch (e) { if (!istKontingent(e)) throw e; await halt(); }
      }
      batchId = res.batch
      for (const r of res.results) { results.push({ ...r, index: r.index + i }); if (r.ref) refs.set(r.ref, r.node) }
      for (const s of res.skipped ?? []) errors.push({ ...s, index: s.index + i, command: commands[s.index + i] })
      if (!res.error && maxErrorPercent > 0 && errors.length >= 5 && errors.length * 100 / Math.max(1, ende) > maxErrorPercent) {
        const letzter = errors[errors.length - 1]
        error = { ...letzter, message: `Fehleranteil über ${maxErrorPercent} % (${errors.length} von ${ende}) — abgebrochen: ${letzter.message}` }
        break
      }
      if (res.error) {
        const an = i + res.error.index
        const e = { ...res.error, index: an, command: commands[an] }
        if (!continueOnError) { error = e; break }
        errors.push(e); i = an + 1
        if (maxErrorPercent > 0 && errors.length >= 5 && errors.length * 100 / Math.max(1, i) > maxErrorPercent) { error = { ...e, message: `Fehleranteil über ${maxErrorPercent} % (${errors.length} von ${i}) — abgebrochen: ${e.message}` }; break }
      } else i = ende
      sag(`${label}: ${i}/${commands.length}${errors.length ? ` · ${errors.length} übersprungen` : ''}`)
    }
    return { batch: batchId, results, error, errors, refs }
  },
}

/// Modell und Baum, wie die Ansicht sie aus dem Store nimmt — hier frisch von der API
/// Anhalten zwischen zwei Stapeln: weil jemand pausiert hat — oder weil das Kontingent voll ist.
/// Ein voller Zähler beendet den Lauf nicht; er wartet auf den Wochen- oder Monatswechsel oder auf eine neue Lizenz.
const jobKey = (E.JOURNALI_JOB || '').trim()
let grundVorher = ''
async function halt() {
  if (!jobKey) return
  for (;;) {
    let signal
    try { signal = await api.get(`/api/jobs/${encodeURIComponent(jobKey)}/signal`) } catch { return }   // kein Signal: weiterlaufen
    if (!signal?.paused) { if (grundVorher) { grundVorher = ''; sag('▶ weiter') } return }
    const grund = signal.reason ?? 'von Hand'
    if (grund !== grundVorher) { grundVorher = grund; sag(`⏸ angehalten (${grund}) — wartet auf „weiter“`) }
    await new Promise(r => setTimeout(r, 2000))
  }
}

/// Ein Stapel, der am Kontingent scheitert, ist nichts geschrieben (eine Transaktion) — also warten und ihn wiederholen.
const istKontingent = e => /Kontingent/i.test(e?.message ?? '')

const umgebung = { api, sag, halt, modell: null, baum: [], frisch: async () => {
  umgebung.modell = await api.get('/api/model')
  umgebung.baum = (await api.get('/api/tree')).rows ?? []
} }

try {
  await umgebung.frisch()
  const client = solr(base, holenMitFetch)
  const pdefs = await client.propertyDefs()
  sag(`Quelle ${base} · ${wurzeln.length} Wurzel(n) · Ziel ${ziel ?? 'oberste Ebene'}`)

  const plan = await plane({ client, umgebung, wurzeln, skip, pdefs })
  if (trocken) { sag('Probelauf — nichts geschrieben'); process.exit(plan.items.length ? 0 : 2) }
  if (!plan.items.length) { sag('nichts zu tun'); process.exit(2) }

  const { geschrieben, stapel } = await schreibe({ plan, umgebung, ziel, skip })

  let kanten = 0
  if (mitKanten) {
    await umgebung.frisch()
    const rp = await planeRelationen({ client, umgebung, wurzeln })
    if (rp.cmds) ({ geschrieben: kanten } = await schreibeRelationen({ plan: rp, umgebung }))
  }
  sag(`✓ ${geschrieben} Einträge in ${stapel} Stapeln${kanten ? ` · ${kanten} Kanten` : ''}`)
  process.exit(geschrieben || kanten ? 0 : 2)
} catch (e) {
  console.error('✗ ' + e.message)
  process.exit(1)
}
