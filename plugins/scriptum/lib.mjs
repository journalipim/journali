// Kuratierte Helfer für Skripte (29.09.2026, docs/pflegestruktur.md 37). Reine, abhängigkeitsfreie Funktionen —
// mit journali ausgeliefert und geprüft, statt beliebiger npm-Pakete. Ein Skript bekommt sie als `ctx.lib`.
// Dazu ein minimaler JSON-Schema-Prüfer für `ctx.step(..., { schema })` — genug, um die Form eines Zwischenergebnisses
// zu prüfen (type, required, properties, items, enum), ohne ein Paket.

/// Warten (Promise) — für Wiederholungen und höfliches Takten gegen ein Fremdsystem.
export const sleep = ms => new Promise(r => setTimeout(r, Math.max(0, Number(ms) || 0)))

/// Eine Liste in Häppchen fester Grösse — etwa um einen grossen Stapel in mehreren /api/batch-Aufrufen zu schreiben.
export function chunk(arr, size) {
  const n = Math.max(1, Math.floor(Number(size) || 0) || 1)
  const out = []
  const a = Array.isArray(arr) ? arr : []
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n))
  return out
}

/// Etwas wiederholen, das schiefgehen darf (ein Fremdsystem antwortet mal nicht) — zwischen den Versuchen eine Pause.
export async function retry(fn, { times = 3, delayMs = 500 } = {}) {
  const mal = Math.max(1, Math.floor(times) || 1)
  let last
  for (let i = 0; i < mal; i++) {
    try { return await fn() } catch (e) { last = e; if (i + 1 < mal) await sleep(delayMs) }
  }
  throw last
}

/// Ein verschachtelter Zugriff, der nicht wirft: get(o, 'a.b.c', fallback) oder get(o, ['a', 'b'], fallback).
export function get(obj, path, fallback = undefined) {
  const teile = Array.isArray(path) ? path : String(path ?? '').split('.').filter(Boolean)
  let cur = obj
  for (const t of teile) { if (cur == null) return fallback; cur = cur[t] }
  return cur === undefined ? fallback : cur
}

/// CSV bauen — mit richtiger Maskierung (Trenner, Anführungszeichen, Zeilenumbruch). rows sind Objekte (Spalten aus den
/// Schlüsseln oder aus `columns`) oder Arrays. Trenner und Kopfzeile einstellbar.
export function csv(rows, { sep = ';', columns = null, header = true } = {}) {
  const NL = '\n'
  const liste = Array.isArray(rows) ? rows : []
  const objekte = liste.length > 0 && !Array.isArray(liste[0])
  let cols = columns
  if (objekte && !cols) { cols = []; for (const r of liste) for (const k of Object.keys(r ?? {})) if (!cols.includes(k)) cols.push(k) }
  const feld = w => { const s = String(w == null ? '' : w); return (s.includes(sep) || s.includes('"') || s.includes(NL)) ? '"' + s.split('"').join('""') + '"' : s }
  const zeile = r => (objekte ? (cols || []).map(c => feld(r?.[c])) : (Array.isArray(r) ? r : []).map(feld)).join(sep)
  const out = []
  if (header && cols) out.push(cols.map(feld).join(sep))
  for (const r of liste) out.push(zeile(r))
  return out.join(NL)
}

/// CSV lesen — mit Anführungszeichen und doppelten Anführungszeichen als Maskierung; Zeilen als Arrays.
export function parseCsv(text, { sep = ';' } = {}) {
  const s = String(text ?? '')
  const rows = []
  let feld = '', zeile = [], q = false, offen = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) { if (c === '"') { if (s[i + 1] === '"') { feld += '"'; i++ } else q = false } else feld += c; offen = true }
    else if (c === '"') { q = true; offen = true }
    else if (c === sep) { zeile.push(feld); feld = ''; offen = true }
    else if (c === '\n') { zeile.push(feld); rows.push(zeile); zeile = []; feld = ''; offen = false }
    else if (c === '\r') { /* überspringen */ }
    else { feld += c; offen = true }
  }
  if (offen || feld !== '' || zeile.length) { zeile.push(feld); rows.push(zeile) }
  return rows
}

/// Ein minimaler JSON-Schema-Prüfer: null = gültig, sonst eine Meldung. Kennt type (auch integer und Listen von Typen),
/// required, properties, items, enum — genug für die Form eines Zwischenergebnisses, ohne ein Paket.
export function pruefeSchema(wert, schema, pfad = '') {
  if (!schema || typeof schema !== 'object') return null
  const wo = pfad || 'Wert'
  const ist = Array.isArray(wert) ? 'array' : wert === null ? 'null' : typeof wert
  if (schema.type) {
    const typen = Array.isArray(schema.type) ? schema.type : [schema.type]
    const passt = typen.some(t => t === 'integer' ? (ist === 'number' && Number.isInteger(wert)) : t === ist)
    if (!passt) return `${wo}: erwartet ${typen.join('/')}, ist ${ist}`
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(wert)) return `${wo}: nicht unter den erlaubten Werten`
  if (ist === 'object' && Array.isArray(schema.required)) {
    for (const k of schema.required) if (!(k in wert)) return `${pfad ? pfad + '.' : ''}${k}: fehlt`
  }
  if (ist === 'object' && schema.properties) {
    for (const [k, s] of Object.entries(schema.properties)) {
      if (k in wert) { const f = pruefeSchema(wert[k], s, pfad ? pfad + '.' + k : k); if (f) return f }
    }
  }
  if (ist === 'array' && schema.items) {
    for (let i = 0; i < wert.length; i++) { const f = pruefeSchema(wert[i], schema.items, `${wo}[${i}]`); if (f) return f }
  }
  return null
}

/// Alles zusammen als ctx.lib.
export const lib = { sleep, chunk, retry, get, csv, parseCsv }
