// Ein Skript aus dem Journal ausführen (docs/pflegestruktur.md 37). Läuft als Kindprozess des Servers wie jedes
// Prozess-Plugin — nie im Serverprozess.
//
// Der Weg: den Quelltext über /api holen (Dienst-Token des Laufs), in eine Datei im Laufverzeichnis schreiben, als
// ES-Modul importieren und seine Standardfunktion mit einem Kontext aufrufen. Das Ergebnis ist eine Zeile auf stdout,
// die mit der Marke beginnt; alles andere, was das Skript ausgibt, ist Protokoll und steht im Log des Laufs.
//
// Aufruf: node runner.mjs <journali> <actor> <script> — oder alles aus JOURNALI_* der Umgebung:
//   JOURNALI_TOKEN   Dienst-Token des Laufs (Bearer); trägt die Rolle, die am Skript steht
//   JOURNALI_SCRIPT  Schlüssel des Skripts
//   JOURNALI_ARGS    Werte der Parameter als JSON-Objekt (leer = die Vorgaben aus dem Kopf)
//   JOURNALI_ARG_<KEY>  ein einzelner Wert — er schlägt JOURNALI_ARGS (so schreibt der Job-Dialog seine Felder)
//   JOURNALI_LIMIT   Zeitgrenze in Sekunden (Vorgabe 60)
//   JOURNALI_OUTDIR  Fach out/ des Laufs — dorthin schreibt ctx.out.file()
// Rückgabe: 0 = gelaufen, 1 = gescheitert (Meldung auf stderr), 2 = falsch aufgerufen.
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { pathToFileURL } from 'node:url'
import { lib, pruefeSchema } from './lib.mjs'

export const MARKE = '⟦scriptum⟧'
/// Grenzen gehören an den Runner, nicht an das Skript: ein Fehler darf weder das Log fluten noch den Server beschäftigen.
export const GRENZEN = { bytes: 5_000_000, zeilen: 20_000, zelle: 4_000, text: 200_000, sekunden: 60 }

/// Was der Lauf meldet: eine Zeile, die mit der Marke beginnt — die letzte gilt.
export const melde = (wert, schreib = s => process.stdout.write(s)) => schreib(MARKE + JSON.stringify(wert) + '\n')

/// Den Prozess sicher beenden: erst stdout/stderr leeren, dann den Ausgang setzen und den Prozess von selbst enden lassen.
/// Sonst kappt process.exit() eine noch nicht geleerte Pipe und die Ergebniszeile geht verloren (der Lauf zeigt „nichts
/// gemeldet“ bei Exit 0). process.exit() gleich nach Abrufen des Servers bricht unter Node 24 auf Windows mit
/// „Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)“ ab — der Lauf gilt dann als gescheitert, obwohl das Skript fertig ist.
/// Der Zeitgeber beendet erst, wenn etwas den Prozess über Gebühr am Leben hält (eine hängende Verbindung).
export const raus = async (code) => {
  try { await new Promise(r => process.stdout.write('', () => r())) } catch { /* egal */ }
  try { await new Promise(r => process.stderr.write('', () => r())) } catch { /* egal */ }
  process.exitCode = code
  setTimeout(() => process.exit(code), 5000).unref()
}

/// Die Werte der Parameter: die Vorgaben aus dem Kopf, darüber JOURNALI_ARGS, darüber einzelne JOURNALI_ARG_<KEY>.
export function werte(meta, env = process.env) {
  const aus = {}
  for (const p of meta?.params ?? []) if (p?.key) aus[p.key] = p.default ?? ''
  let json = {}
  try { json = JSON.parse(env.JOURNALI_ARGS || '{}') } catch { json = {} }
  for (const [k, v] of Object.entries(json ?? {})) if (v !== null && v !== undefined) aus[k] = typeof v === 'string' ? v : JSON.stringify(v)
  for (const [k, v] of Object.entries(env)) {
    const m = /^JOURNALI_ARG_(.+)$/.exec(k)
    if (m && v !== '') aus[m[1].toLowerCase()] = v
  }
  return aus
}

/// Was das Skript zurückgibt, in die eine Form bringen: Tabelle, Text oder Datei — und auf die Grenzen kürzen.
export function ergebnis(wert, grenzen = GRENZEN) {
  if (wert === undefined || wert === null) return { text: '' }
  if (typeof wert === 'string') return { text: kurz(wert, grenzen.text) }
  if (Array.isArray(wert)) return tabelleAus(wert, grenzen)
  if (typeof wert !== 'object') return { text: String(wert) }
  if (wert.file) return { file: String(wert.file), bytes: wert.bytes ?? null }
  if (wert.text !== undefined) return { text: kurz(String(wert.text), grenzen.text) }
  if (wert.table) {
    const t = wert.table
    const columns = (t.columns ?? []).map(c => String(c))
    const alle = t.rows ?? []
    const rows = alle.slice(0, grenzen.zeilen).map(r => (Array.isArray(r) ? r : columns.map(c => r?.[c])).map(z => z === null || z === undefined ? '' : kurz(String(z), grenzen.zelle)))
    return { table: { columns, rows }, ...(alle.length > rows.length ? { gekuerzt: alle.length } : {}) }
  }
  return { text: kurz(JSON.stringify(wert, null, 1), grenzen.text) }
}

const kurz = (s, n) => s.length > n ? s.slice(0, n) + ' …' : s
/// Eine Liste von Objekten wird eine Tabelle: die Spalten sind die Schlüssel, in der Reihenfolge ihres ersten Auftretens.
function tabelleAus(liste, grenzen) {
  const columns = []
  for (const r of liste.slice(0, grenzen.zeilen)) for (const k of Object.keys(r ?? {})) if (!columns.includes(k)) columns.push(k)
  return ergebnis({ table: { columns, rows: liste } }, grenzen)
}

/// Der Kontext, den ein Skript bekommt: journali über die API (mit dem Token des Laufs), seine Parameter, Protokoll
/// und die drei Wege, ein Ergebnis zu geben. Mehr gibt es nicht — kein Paket, kein zweites Skript.
export function kontext({ server, token, actor, params, outDir, log = console.log }) {
  const kopf = (mitTyp = false) => ({ 'X-Actor': actor, ...(mitTyp ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) })
  async function anfrage(method, pfad, body, extra) {
    const res = await fetch(server + pfad, { method, headers: { ...kopf(body !== undefined), ...(extra || {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { if (!res.ok) throw new Error(`${method} ${pfad}: ${res.status} ${text.slice(0, 300)}`); return text }
    if (!res.ok) throw new Error(`${method} ${pfad}: ${data?.error ?? res.status}`)
    return data
  }
  const api = {
    get: p => anfrage('GET', p),
    post: (p, b) => anfrage('POST', p, b ?? {}),
    put: (p, b) => anfrage('PUT', p, b ?? {}),
    del: p => anfrage('DELETE', p),
  }
  const out = {
    table: (columns, rows) => ({ table: { columns, rows } }),
    text: s => ({ text: String(s) }),
    /// Eine Datei ins Fach out/ des Laufs — der Tasker räumt sie auf, legt sie ab und archiviert sie wie jede Ausgabe.
    file: (name, inhalt) => {
      if (!outDir) throw new Error('kein Fach out/ — der Job braucht Fächer für eine Datei')
      const sicher = String(name).replace(/[^\w.@-]+/g, '_')
      const ziel = path.join(outDir, sicher)
      fs.writeFileSync(ziel, typeof inhalt === 'string' || Buffer.isBuffer(inhalt) ? inhalt : JSON.stringify(inhalt, null, 1))
      return { file: sicher, bytes: fs.statSync(ziel).size }
    },
  }
  // Schritte und Snapshots (docs/pflegestruktur.md 37): ein Skript in benannte Teile gliedern — jeder mit Start, Dauer
  // und Ausgang im Log, optional gegen ein JSON-Schema geprueft und als Snapshot ins Fach out/. Kein Pipeline-Motor,
  // nur Struktur in einem Skript.
  let schritt = 0
  const snapshot = (name, daten) => {
    const datei = String(name).replace(/[^\w.@-]+/g, '_').replace(/(\.json)?$/, '.json')
    if (!outDir) { log('· Schnappschuss ' + datei + ' (kein Fach out/)'); return null }
    const ziel = path.join(outDir, datei)
    fs.writeFileSync(ziel, JSON.stringify(daten ?? null, null, 1))
    return { file: datei, bytes: fs.statSync(ziel).size }
  }
  const step = async (name, fn, opts = {}) => {
    const nr = ++schritt, t0 = Date.now()
    log('▸ ' + nr + ' ' + name)
    let res
    try { res = typeof fn === 'function' ? await fn() : fn }
    catch (e) { log('✗ ' + nr + ' ' + name + ': ' + (e?.message ?? e)); throw e }
    if (opts.schema) { const f = pruefeSchema(res, opts.schema); if (f) { log('✗ ' + nr + ' ' + name + ': ' + f); throw new Error('Schritt „' + name + '“: ' + f) } }
    log('✓ ' + nr + ' ' + name + ' · ' + (Date.now() - t0) + ' ms')
    if (opts.snapshot) snapshot(nr + '-' + name, res)
    return res
  }
  /// Ein Zugang: der Server (Weiterleitung) haengt die Anmeldung an und spricht das Fremdsystem an — das Geheimnis
  /// bleibt bei ihm, das Skript sieht es nie. Der Pfad ist relativ zur Adresse des Zugangs; die Antwort ist geparstes
  /// JSON, sonst Text. Der Name kommt aus einem Parameter (Typ driver) oder steht im Skript. Jede Methode nimmt
  /// optional { headers } mit; roh(method, pfad, { body, headers }) gibt die ganze Antwort { status, headers, body }
  /// zurueck — fuer Ablaeufe, die eine Kopfzeile brauchen (ERP: X-CSRF-Token holen, dann mit Sitzungskeks schreiben).
  const zugang = name => {
    if (!name) throw new Error('kein Zugang genannt')
    const ziel = pfad => `/api/drivers/${encodeURIComponent(name)}/relay?path=${encodeURIComponent(pfad || '/')}`
    const weiter = (method, pfad, body, opt) => anfrage(method, ziel(pfad), body, opt && opt.headers)
    const roh = (method, pfad, opt) => anfrage(method, ziel(pfad) + '&raw=1', opt && opt.body, opt && opt.headers)
    return {
      get: (pfad, opt) => weiter('GET', pfad, undefined, opt),
      post: (pfad, body, opt) => weiter('POST', pfad, body === undefined ? {} : body, opt),
      put: (pfad, body, opt) => weiter('PUT', pfad, body === undefined ? {} : body, opt),
      del: (pfad, opt) => weiter('DELETE', pfad, undefined, opt),
      roh,
    }
  }
  return { api, params, journali: server, actor, out, log, zugang, step, snapshot, lib }
}

/// Den Quelltext in eine Datei schreiben und als Modul laden — ein Skript ist ein ES-Modul, kein String im Server.
export async function lade(quelle, verzeichnis) {
  const datei = path.join(verzeichnis, 'skript.mjs')
  fs.writeFileSync(datei, quelle)
  return import(`file://${datei}?t=${Date.now()}`)
}

async function main() {
  const E = process.env
  const [, , serverArg, actorArg, scriptArg] = process.argv
  const server = (serverArg || E.JOURNALI_JOURNALI || 'http://localhost:5000').replace(/\/+$/, '')
  const actor = actorArg || E.JOURNALI_ACTOR || 'job:scriptum'
  const key = (scriptArg || E.JOURNALI_SCRIPT || '').trim()
  const token = E.JOURNALI_TOKEN || ''
  const sekunden = Math.max(5, Math.min(3600, parseInt(E.JOURNALI_LIMIT || '', 10) || GRENZEN.sekunden))
  if (!key) { console.error('✗ Kein Skript genannt (Parameter script).'); return raus(2) }

  const res = await fetch(`${server}/api/scriptum/scripts/${encodeURIComponent(key)}/source`, {
    headers: { 'X-Actor': actor, ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  })
  if (!res.ok) { console.error(`✗ Quelltext von ${key}: ${res.status} ${(await res.text()).slice(0, 300)}`); return raus(1) }
  const quelle = await res.text()

  const verzeichnis = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptum-'))
  const uhr = Date.now()
  let code = 0
  try {
    const modul = await lade(quelle, verzeichnis)
    const meta = modul.meta ?? {}
    const params = werte(meta)
    const lauf = modul.default ?? modul.run
    if (typeof lauf !== 'function') throw new Error('Das Skript hat keine Standardfunktion (export default).')
    console.log(`${meta.label ?? key}: ${Object.keys(params).length} Parameter, Zeitgrenze ${sekunden} s`)
    // Die Zeitgrenze gehört an den Runner: ein Skript, das nicht zurückkommt, beendet den Lauf, nicht den Server
    let wecker
    const grenze = new Promise((_, weg) => { wecker = setTimeout(() => weg(new Error(`Zeitgrenze ${sekunden} s überschritten`)), sekunden * 1000) })
    const ctx = kontext({ server, token, actor, params, outDir: E.JOURNALI_OUTDIR || null })
    try { melde(ergebnis(await Promise.race([lauf(ctx), grenze]))) } finally { clearTimeout(wecker) }
  } catch (e) {
    console.error('✗ ' + (e?.stack ?? e?.message ?? String(e)))
    melde({ fehler: e?.message ?? String(e) })
    code = 1
  } finally {
    fs.rmSync(verzeichnis, { recursive: true, force: true })
    console.log(`fertig in ${((Date.now() - uhr) / 1000).toFixed(1)} s`)
  }
  await raus(code)
}

// Als Modul geladen (Prüfstand) tut die Datei nichts von selbst.
// process.argv[1] ist auf Windows relativ (runner.mjs), import.meta.url absolut (file:///C:/…/runner.mjs) —
// pathToFileURL(path.resolve(…)) bringt beides auf denselben Stand.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(e => { console.error('✗ ' + e.message); return raus(1) })
