// Der Datenmapper (Taloan, 17.09.2026): Spalten einer Tabelle (CSV, Excel, JSON, Zwischenablage — die Quelle liefert
// ein Plugin) auf das Modell abbilden, mit so viel Verstand wie möglich:
//   - Spalte → Attribut über Schlüssel, Label (alle Sprachen), Synonyme, normalisierte Namen, Ähnlichkeit
//   - Sprache aus dem Spaltennamen (name_de, Name (EN), name.en)
//   - Schlüsselspalten erkennen: Id, SKU, externe Kennung, Elternteil, Variantenachsen
//   - Typ aus den Werten raten (Zahl, Ja/Nein, Datum, Werteliste, Text/HTML) für neue Attribute
//   - Werte in die Form des Modells bringen (Dezimalkomma, ja/nein, Datum, Listenwert über Label)
//   - Plan: was wird angelegt, was geändert, was ist unverändert — als Stapel für /api/batch
// Reine Funktionen; die Ansicht (TableImportView) und Plugins (ctx.mapper) rufen sie.

import { apply as applySteps } from './transform.js'
export { apply as transform, describe as describeSteps, OPS as TRANSFORM_OPS } from './transform.js'

export const SYNONYMS = {
  sku: ['sku', 'artikelnummer', 'artikel_nr', 'artnr', 'art_nr', 'artikel', 'article', 'article_number', 'item_number', 'item_no', 'product_number', 'productnumber', 'materialnummer', 'material', 'part_number', 'partno', 'nummer', 'number', 'code'],
  name: ['name', 'bezeichnung', 'titel', 'title', 'produktname', 'product_name', 'artikelbezeichnung', 'label', 'benennung'],
  description: ['beschreibung', 'description', 'text', 'langtext', 'long_description', 'desc', 'kurztext', 'short_description'],
  ean: ['ean', 'gtin', 'barcode', 'ean13', 'upc'],
  price: ['preis', 'price', 'vk', 'listenpreis', 'list_price', 'uvp', 'netto', 'brutto'],
  weight: ['gewicht', 'weight', 'masse', 'mass'],
  width: ['breite', 'width'], height: ['hoehe', 'height'], length: ['laenge', 'length', 'tiefe', 'depth'],
  color: ['farbe', 'color', 'colour'], size: ['groesse', 'size'],
  manufacturer: ['hersteller', 'manufacturer', 'marke', 'brand', 'vendor', 'lieferant', 'supplier'],
  id: ['id', 'journali', 'journali_id', 'knoten', 'node'],
  parent: ['parent', 'eltern', 'produkt', 'product', 'parent_sku', 'parent_id', 'gruppe', 'group', 'uebergeordnet', 'master'],
}

export function norm(s) {
  return String(s ?? '').toLowerCase().trim()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// Sprache aus dem Spaltennamen: „name_de“, „Name (EN)“, „name.en“, „Name DE“, „name-en“ → { base: 'name', locale: 'de' }
export function splitLocale(col, locales) {
  const s = String(col ?? '').trim()
  for (const l of locales) {
    const re = new RegExp(`^(.*?)[\\s_.\\-/(\\[]+${l}[)\\]]?$`, 'i')
    const m = s.match(re)
    if (m && m[1].trim()) return { base: m[1].trim(), locale: l }
    const pre = s.match(new RegExp(`^${l}[\\s_.\\-:/]+(.+)$`, 'i'))
    if (pre) return { base: pre[1].trim(), locale: l }
  }
  return { base: s, locale: null }
}

// Ähnlichkeit zweier normalisierter Namen: 1 = gleich, sonst Anteil gemeinsamer Zeichen-Bigramme (Dice)
export function similarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) / Math.max(a.length, b.length) * 0.9 + 0.1
  const grams = s => { const g = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); g.set(k, (g.get(k) ?? 0) + 1) } return g }
  const ga = grams(a), gb = grams(b); let hit = 0
  for (const [k, n] of ga) hit += Math.min(n, gb.get(k) ?? 0)
  return (2 * hit) / (a.length - 1 + b.length - 1)
}

const BOOL_TRUE = new Set(['ja', 'j', 'yes', 'y', 'true', 'wahr', 'x', '1', 'on', 'an'])
const BOOL_FALSE = new Set(['nein', 'n', 'no', 'false', 'falsch', '0', 'off', 'aus', '-', ''])
const RE_INT = /^[+-]?\d{1,15}$/
const RE_DEC = /^[+-]?(\d{1,3}([.\s']\d{3})*|\d+)([.,]\d+)?$/
const RE_DATE_DE = /^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/
const RE_DATE_ISO = /^(\d{4})-(\d{2})-(\d{2})(T.*)?$/
const RE_HTML = /<\/?[a-z][^>]*>/i
const RE_ID = /^[gpv]-[0-9a-f]{6,}$/

// Typ einer Spalte aus ihren Werten raten. Leere zählen nicht. Liefert { type, distinct, samples, confidence }.
export function sniffType(values) {
  const vs = values.map(v => String(v ?? '').trim()).filter(v => v !== '')
  if (!vs.length) return { type: 'text', distinct: 0, samples: [], confidence: 0 }
  const distinct = [...new Set(vs)]
  const all = re => vs.every(v => re.test(v))
  const isBool = vs.every(v => BOOL_TRUE.has(v.toLowerCase()) || BOOL_FALSE.has(v.toLowerCase())) && distinct.length <= 3
  const r = (type, confidence = 1) => ({ type, distinct: distinct.length, samples: distinct.slice(0, 5), confidence })
  if (all(RE_ID)) return r('id')
  if (isBool && distinct.some(v => isNaN(Number(v)) || distinct.length <= 2)) return r('boolean', distinct.length <= 2 ? 1 : 0.7)
  if (all(RE_INT) && vs.every(v => v.length < 10)) return r('integer')
  if (all(RE_DEC)) return r('decimal')
  if (all(RE_DATE_DE) || all(RE_DATE_ISO)) return r('date')
  if (vs.some(v => RE_HTML.test(v))) return r('html', 0.9)
  if (vs.length >= 5 && distinct.length <= Math.max(3, Math.min(25, vs.length / 3)) && distinct.every(v => v.length <= 40)) return r('enum', 0.7)
  if (distinct.some(v => v.length > 200 || v.includes('\n'))) return r('text', 0.9)
  return r('text', 0.6)
}

// Wert in die Form des Modells bringen (was der Server erwartet): Zahlen mit Punkt, boolean true/false, Datum ISO.
// Liefert null, wenn leer; wirft nicht — was nicht passt, bleibt Text (der Server prüft Muster).
export function convert(raw, def, model) {
  let s = raw == null ? '' : String(raw).trim()
  if (s === '') return null
  switch (def?.type) {
    case 'integer': { const m = s.replace(/[\s'.]/g, '').replace(',', '.'); return RE_INT.test(m) ? String(parseInt(m, 10)) : s }
    case 'decimal': {
      // 1.234,56 (de) / 1,234.56 (en) / 1234.56 / 1234,56
      let t = s.replace(/\s|'/g, '')
      if (/,\d{1,2}$/.test(t) || (t.includes(',') && !t.includes('.'))) t = t.replace(/\./g, '').replace(',', '.')
      else t = t.replace(/,/g, '')
      return isNaN(Number(t)) ? s : String(Number(t))
    }
    case 'boolean': { const l = s.toLowerCase(); return BOOL_TRUE.has(l) ? 'true' : BOOL_FALSE.has(l) ? 'false' : s }
    case 'date': { const m = s.match(RE_DATE_DE); if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` } return s.match(RE_DATE_ISO) ? s.slice(0, 10) : s }
    case 'enum': return def.multiple ? s.split(/[,;|]/).map(v => matchListValue(v.trim(), def, model)).filter(Boolean).join(',') : matchListValue(s, def, model)
    default: return s
  }
}

// Passt der (schon umgeformte) Wert zum Typ? null = ja, sonst der Grund. Was hier durchfällt, kommt nicht in den Stapel:
// im Knotenmodus wird die Datei abgelehnt, im Assistenten muss die Zelle korrigiert werden (Taloan, 17.09.).
export function validate(v, def, model) {
  if (v == null || v === '') return null
  switch (def?.type) {
    // Grund ohne den ganzen Wert (Taloan, 21.09.: „den Grund sieht man erst einen Kilometer rechts“) — der Wert steht daneben
    case 'integer': return /^[+-]?\d+$/.test(v) ? null : 'keine ganze Zahl'
    case 'decimal': return /^[+-]?\d+(\.\d+)?$/.test(v) ? null : 'keine Zahl'
    case 'boolean': return v === 'true' || v === 'false' ? null : 'nicht ja/nein'
    case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? null : 'kein Datum (TT.MM.JJJJ)'
    case 'enum': {
      const list = model?.lists?.find(l => l.key === def.list); if (!list) return null
      const bad = String(v).split(',').map(x => x.trim()).filter(x => x && !list.values.some(y => y.value === x))
      return bad.length ? `„${bad.join(', ')}“ nicht in Liste ${def.list}` : null
    }
    default: {
      if (def?.pattern) { try { if (!new RegExp(def.pattern).test(v)) return `„${String(v).slice(0, 40)}“ passt nicht zum Muster${def.patternHint ? ' (' + def.patternHint + ')' : ''}` } catch {} }
      return null
    }
  }
}

// Listenwert finden: Schlüssel genau, sonst Label in irgendeiner Sprache, sonst normalisiert — sonst der Rohtext (der Server lehnt ab)
export function matchListValue(s, def, model) {
  const list = model?.lists?.find(l => l.key === def.list)
  if (!list) return s
  const hit = list.values.find(v => v.value === s)
    ?? list.values.find(v => Object.values(v.label ?? {}).some(l => l?.toLowerCase() === s.toLowerCase()))
    ?? list.values.find(v => norm(v.value) === norm(s) || Object.values(v.label ?? {}).some(l => norm(l) === norm(s)))
  return hit ? hit.value : s
}

// ---- Vorschlag: jede Spalte bekommt ein Ziel
//   { column, target, attribute?, locale?, newType?, newKey?, score, why }
//   target: 'attr' (vorhandenes Attribut) | 'new' (neues Attribut) | 'id' | 'parent' | 'external' | 'skip'
//   (Altlast 'sku' aus gespeicherten Profilen: wird beim Planen wie 'attr' auf ein eindeutiges Attribut gleichen Namens gelesen)
//   Ein Attribut mit unique (Taloan, 21.09.: „alles über eindeutig“) findet vorhandene Knoten über seinen Wert — SKU, EAN, MATNR, jedes für sich.
export function suggest(columns, rows, model, { locales = null, external = null } = {}) {
  const locs = locales ?? (model?.locales ?? []).map(l => l.code)
  const attrs = model?.attributes ?? []
  const index = attrs.map(a => ({ a, keys: new Set([norm(a.key), ...Object.values(a.label ?? {}).map(norm).filter(Boolean)]) }))
  const colValues = i => rows.slice(0, 500).map(r => Array.isArray(r) ? r[i] : r[columns[i]])
  const seen = new Set()
  return columns.map((col, i) => {
    const { base, locale } = splitLocale(col, locs)
    const n = norm(base)
    const values = colValues(i)
    const sniff = sniffType(values)
    const out = { column: col, target: 'skip', attribute: null, locale, newType: sniff.type === 'id' ? 'text' : sniff.type, newKey: n, score: 0, why: '', sniff }
    const pick = (target, attribute, score, why) => { if (score > out.score) Object.assign(out, { target, attribute, score, why }) }
    // 0. Spalten des eigenen Exports (Plugin export): role/status/journali_label sind Anzeige, axis_<key> ist die Achse
    // eigene Spalten (Taloan, 21.09.): journali_<feld>_<wurzel> — die Wurzel steht im Kopf; alte Form (id, parent, role, status, journali_label, journali_root) weiter
    // Wurzel-Ids sind nicht immer g-<hex> (Saatgut: g-mastertree) — alles nach journali_<feld>_ ist die Wurzel
    const own = String(col).trim().match(/^journali_(id|parent|role|status|label|root)(?:_(.+))?$/i)
    if (own) {
      const sys = own[1].toLowerCase(); out.internal = true; out.root = own[2]?.toLowerCase() ?? null
      if (sys === 'id') { out.target = 'id'; out.why = 'journali-Id' + (out.root ? ' · Wurzel ' + out.root : '') }
      else if (sys === 'parent') { out.target = 'parent'; out.why = 'Elternteil aus der Datei' }
      else if (sys === 'root') { out.target = 'root'; out.why = 'Wurzel — macht die Id eineindeutig' }
      else out.why = 'Exportspalte, nur Anzeige'
      return out
    }
    if (n === 'status') { out.target = 'status'; out.why = 'Status — Schlüssel oder Tabelle → Status'; return out }   // Fremdstatus (SAP 300/400 …) über die Umwandlung „Tabelle“ abbilden (Taloan, 22.09.)
    if (n === 'role' || n === 'journali_label') { out.internal = true; out.why = 'Exportspalte, nur Anzeige'; return out }
    if (n === 'journali_root') { out.target = 'root'; out.internal = true; out.why = 'Wurzel — macht die Id eineindeutig'; return out }
    if (n.startsWith('axis_') && attrs.some(a => norm(a.key) === n.slice(5))) pick('attr', attrs.find(a => norm(a.key) === n.slice(5)).key, 1, 'Variantenachse')
    // 1. Schlüsselspalten
    // Elternteil vor der Id-Erkennung: eine Spalte „parent“ voller p-…-Ids ist der Vater, nicht die Id des Knotens (Taloan, 21.09.: „doppelt — warum?“)
    if (SYNONYMS.parent.includes(n)) pick('parent', null, n.startsWith('parent') || sniff.type === 'id' ? 1 : 0.85, 'Elternteil (SKU oder Id des Produkts / der Gruppe)')
    if (sniff.type === 'id' || n === 'id' || n === 'journali_id') pick('id', null, 1, 'journali-Id')
    if (external && (n === norm(external) || n === norm(external) + '_id' || n === 'external' || n === 'externe_kennung' || n === 'remote_id')) pick('external', null, 0.95, `Kennung ${external}`)
    // 2. Attribute: Schlüssel, Label, Synonyme, Ähnlichkeit
    for (const { a, keys } of index) {
      if (keys.has(n)) pick('attr', a.key, n === norm(a.key) ? 1 : 0.95, n === norm(a.key) ? 'Schlüssel' : 'Label')
    }
    if (out.score < 0.95) {
      for (const [canon, words] of Object.entries(SYNONYMS)) {
        if (!words.includes(n)) continue
        const a = attrs.find(x => norm(x.key) === canon) ?? attrs.find(x => words.includes(norm(x.key))) ?? index.find(x => [...x.keys].some(k => words.includes(k)))?.a
        if (a) pick('attr', a.key, 0.9, `Synonym für ${a.key}`)
        else if (canon === 'sku') { const u = attrs.find(x => x.unique); if (u) pick('attr', u.key, 0.8, `Schlüssel — ${u.key} ist eindeutig`) }
        else if (canon === 'id') pick('id', null, 0.9, 'journali-Id')
      }
    }
    if (out.score < 0.9) {
      let best = null, bs = 0
      for (const { a, keys } of index) for (const k of keys) { const s = similarity(n, k); if (s > bs) { bs = s; best = a } }
      if (best && bs >= 0.72) pick('attr', best.key, bs * 0.85, `ähnlich ${best.key} (${Math.round(bs * 100)} %)`)
    }
    // 3. nichts gefunden: neues Attribut vorschlagen, wenn die Spalte Werte hat
    if (out.target === 'skip' && values.some(v => String(v ?? '').trim() !== '')) { out.target = 'new'; out.why = `neu als ${out.newType}` }
    // Sprache: nur, wenn das Attribut sie kennt; Attribut ohne Sprachachse → Sprache weg
    if (out.target === 'attr') { const a = attrs.find(x => x.key === out.attribute); if (a && !a.perLocale) out.locale = null; if (a?.perLocale && !out.locale) out.locale = model?.masterLocale ?? locs[0] ?? null }
    // Doppelte Ziele (zwei Spalten → dasselbe Attribut, dieselbe Sprache) — die zweite wird übersprungen
    const sig = out.target === 'attr' ? `${out.attribute}|${out.locale ?? ''}` : out.target === 'new' ? `new:${out.newKey}|${out.locale ?? ''}` : out.target
    if (['attr', 'new', 'id', 'parent', 'external', 'status'].includes(out.target)) { if (seen.has(sig)) { out.target = 'skip'; out.why = 'doppelt' } else seen.add(sig) }
    return out
  })
}

// ---- Plan: Zeilen → Befehle für /api/batch. Eingabe: mapping = Ergebnis von suggest (ggf. vom Menschen geändert).
//   target: Knoten (Zeile aus tree), unter den neue Zeilen kommen; role: Rolle neuer Zeilen ('product' | 'variant' | 'group')
//   existing: Map id → { attr → value } (aufgelöst, aus /api/nodes/{id}/table) zum Vergleichen; tree: das Baum-Abbild
//   external: System der externen Kennung (Spalte target 'external')
export function plan({ columns, rows, mapping, model, tree, target, role, existing, external = null, actorNote = null }) {
  const col = t => mapping.findIndex(m => m.target === t)
  // Schlüsselspalten: eigene Ziele — und jedes eindeutige Attribut (wird geschrieben und findet zugleich)
  const iId = col('id'), iParent = col('parent'), iExt = col('external'), iRoot = col('root')
  // Id + Wurzel (Taloan, 21.09.): nennt die Datei journali_root, zählt eine Id nur unter genau dieser Wurzel — sonst fremde Datenbank, die Zeile ist neu
  const rootOf = id => { const a = tree.ancestors?.(id) ?? []; return a.length ? a[0].id : id }
  const uniq = new Set((model.attributes ?? []).filter(a => a.unique).map(a => a.key))
  // Altlast: Ziel 'sku' aus alten Profilen = das eindeutige Attribut sku, wenn es eins gibt
  mapping = mapping.map(m => m.target === 'sku' ? (uniq.has('sku') ? { ...m, target: 'attr', attribute: 'sku' } : { ...m, target: 'skip' }) : m)
  const keyCols = mapping.map((m, i) => m.target === 'attr' && uniq.has(m.attribute) && !m.locale ? i : -1).filter(i => i >= 0)   // Spalten eindeutiger Attribute
  const raw = (row, i) => i < 0 ? null : (Array.isArray(row) ? row[i] : row[columns[i]])
  // Umwandlung je Spalte (transform.js, Taloan 21.09.: „zwischendurch in die Daten eingreifen“) — vor Typprüfung und Schreiben
  const cell = (row, i) => { if (i < 0) return null; const steps = mapping[i]?.steps; const v = raw(row, i); return steps?.length ? applySteps(steps, v, { get: c => { const j = columns.indexOf(c); return j < 0 ? '' : raw(row, j) } }) : v }
  const byKey = new Map(); const byExt = new Map()   // byKey: „attribut\u0001wert“ → Zeile
  for (const r of tree.rows) { for (const [k, v] of Object.entries(r.keys ?? {})) byKey.set(k + '\u0001' + String(v).trim(), r); if (external && r.external?.[external]) byExt.set(String(r.external[external]), r) }
  // Schlüssel einer Dateizeile: { attribut: wert } über die Spalten eindeutiger Attribute; findKey: der erste Knoten, den einer davon trifft
  const keysOf = row => { const o = {}; for (const i of keyCols) { const v = String(cell(row, i) ?? '').trim(); if (v) o[mapping[i].attribute] = v } return o }
  const keyText = row => Object.values(keysOf(row))[0] ?? ''
  const findKey = row => { for (const [k, v] of Object.entries(keysOf(row))) { const hit = byKey.get(k + '\u0001' + v); if (hit) return { node: hit, k, v } } return null }
  // Eindeutig (Taloan, 21.09.: „Import-Plugins müssen auf Eindeutigkeit prüfen“): ein Wert eines eindeutigen Attributs darf weder einem anderen
  // Knoten im Bestand gehören noch zweimal in der Datei stehen — der Server lehnt es ohnehin ab, hier steht es schon in der Vorschau
  const seenUnique = new Map()   // „attribut\u0001wert“ → Zeile, die ihn zuerst hatte
  const uniqueBad = (def, v, node, ri) => {
    if (!def.unique || v == null || v === '') return null
    const k = def.key + '\u0001' + String(v).trim()
    const other = byKey.get(k); if (other && other.id !== node?.id) return `${def.key} ${v} gehört schon zu „${other.label}“ (${other.id}) — eindeutig`
    if (seenUnique.has(k)) return `${def.key} ${v} steht schon in Zeile ${seenUnique.get(k) + 2} — eindeutig`
    seenUnique.set(k, ri); return null
  }
  const attrs = new Map((model.attributes ?? []).map(a => [a.key, a]))
  // neue Attribute: einmal je newKey (+ Sprache macht nur die Achse)
  const newAttrs = new Map()
  for (const m of mapping) if (m.target === 'new') {
    const key = m.newKey || norm(m.column)
    if (!key || attrs.has(key)) { m.target = attrs.has(key) ? 'attr' : 'skip'; m.attribute = key; continue }
    const have = newAttrs.get(key)
    if (have) { if (m.locale) have.axes = ['locale']; continue }
    // Gruppe ist Pflicht (Taloan, 17.09.): ohne Attributgruppe kein neues Attribut — der Plan meldet es, der Import wartet
    newAttrs.set(key, { key, label: { de: splitLocale(m.column, (model.locales ?? []).map(l => l.code)).base, en: splitLocale(m.column, (model.locales ?? []).map(l => l.code)).base }, type: m.newType === 'enum' ? 'text' : (m.newType || 'text'), group: m.newGroup || null, axes: m.locale ? ['locale'] : [], inheritable: false })
  }
  const requiredNew = [...newAttrs.values()].filter(a => !a.group).map(a => a.key)
  const defOf = m => attrs.get(m.attribute ?? m.newKey) ?? (newAttrs.get(m.newKey) ? { key: m.newKey, type: newAttrs.get(m.newKey).type, perLocale: newAttrs.get(m.newKey).axes.includes('locale') } : null)

  // Zeilennummern in Meldungen sind Excel-Zeilen (Kopfzeile = 1)
  const combos = new Map()   // je Produkt die Achsen-Kombinationen (Bestand + Datei)
  // changes: je Zeile, was passiert — zum Anschauen vor dem Schreiben (Taloan, 21.09.: „die geänderten und die neuen anschauen“)
  const commands = []; const stats = { rows: rows.length, create: 0, update: 0, unchanged: 0, values: 0, skipped: 0, problems: [], invalid: [], missingGroup: requiredNew, newListValues: {}, changes: [] }
  // Listenwerte, die es noch nicht gibt (Taloan, 20.09.: „Werte sollten zugefügt werden — genau dazu ist die Excel-Bearbeitung da“): der Plan
  // merkt sie je Liste (Schlüssel = normierter Text, Bezeichnung = der Text), das Schreiben legt sie vor dem Stapel an
  const conv = (raw, def) => {
    let v = convert(raw, def, model)
    if (def.type !== 'enum' || !def.list || v == null || v === '') return v
    const list = model.lists?.find(l => l.key === def.list); if (!list) return v
    const known = new Set(list.values.map(x => x.value))
    return (def.multiple ? String(v).split(',') : [String(v)]).map(x => { x = x.trim(); if (!x || known.has(x)) return x; const key = norm(x) || x; (stats.newListValues[def.list] ??= {})[key] = x; return key }).join(',')
  }
  const check = (v, def) => def.type === 'enum' && def.list && stats.newListValues[def.list] ? (() => { const ok = new Set([...(model.lists?.find(l => l.key === def.list)?.values.map(x => x.value) ?? []), ...Object.keys(stats.newListValues[def.list])]); const bad = String(v ?? '').split(',').map(x => x.trim()).filter(x => x && !ok.has(x)); return bad.length ? `„${bad.join(', ')}“ nicht in Liste ${def.list}` : null })() : validate(v, def, model)
  const targetGroups = new Set()
  // Pflichtattribute der Kindrolle (irgendein Kanal verlangt sie): beim Anlegen müssen sie da sein
  const requiredFor = r => [...attrs.values()].filter(a => a.required && Object.keys(a.required).length && (!a.levels || a.levels.includes(r)) && a.type !== 'rows' && a.type !== 'formula' && a.type !== 'html')
  // Lücke bei ausgeblendeten Spalten (Taloan, 21.09.: „der Anwender nimmt die letzte Zeile, fügt sie mehrfach ein, ändert Werte — und kopiert die
  // versteckte Id mit … oder schneidet sie aus und fügt sie als erste ein“): dieselbe Id mehrmals in der Datei. Die Reihenfolge sagt nichts.
  // Das Original ist die Zeile, die zum Knoten im Bestand passt: erst die SKU des Knotens, sonst die Zeile mit den meisten gleichen Werten.
  // Alle anderen sind Kopien → neue Knoten (Id fällt weg, gemeldet); eine Kopie ohne jede Änderung (gleiche SKU wie das Original) ist ein Duplikat und wird übergangen.
  const byIdRows = new Map()
  rows.forEach((row, ri) => { const id = String(cell(row, iId) ?? '').trim(); if (id) { if (!byIdRows.has(id)) byIdRows.set(id, []); byIdRows.get(id).push(ri) } })
  const similarity = (row, nodeId) => { const cur = existing?.get(nodeId); if (!cur) return 0; let n = 0; mapping.forEach((m, ci) => { if (m.target !== 'attr') return; const def = attrs.get(m.attribute); if (!def) return; const k = `${def.key}|${def.perLocale ? m.locale ?? '' : ''}`; if (k in cur && String(cur[k] ?? '') === String(convert(cell(row, ci), def, model) ?? '')) n++ }); return n }
  const dropId = new Map(), dupRow = new Set()   // Zeilen, deren Id nicht zählt (Kopie: Zeile → Text fürs Protokoll) / die ganz übergangen werden (Duplikat)
  stats.notes = []   // Hinweise, keine Fehler (Taloan, 21.09.: rot und „neu“ neben „0 neu“ war verwirrend)
  for (const [id, ris] of byIdRows) {
    if (ris.length < 2) continue
    const node = tree.byId.get(id)
    const skuOf = ri => JSON.stringify(keysOf(rows[ri]))
    // das Original: die Zeile, deren Schlüssel mit denen des Knotens übereinstimmen (irgendeiner)
    let orig = node?.keys ? ris.find(ri => Object.entries(keysOf(rows[ri])).some(([k, v]) => String(node.keys[k] ?? '').trim() === v)) : undefined
    if (orig === undefined) { let best = -1; for (const ri of ris) { const sc = node ? similarity(rows[ri], id) : 0; if (sc > best) { best = sc; orig = ri } } }
    for (const ri of ris) {
      if (ri === orig) continue
      if (skuOf(ri) !== '{}' && skuOf(ri) === skuOf(orig)) { dupRow.add(ri); stats.problems.push(`Zeile ${ri + 2}: Duplikat von Zeile ${orig + 2} (gleiche Id, gleiche Schlüssel) — übergangen`) }
      else dropId.set(ri, `Zeile ${ri + 2}: kopierte Zeile — die Id ${id} gehört zu Zeile ${orig + 2} (${node?.keys ? 'Schlüssel ' + Object.values(node.keys).join(' · ') : 'meiste gleiche Werte'}) und zählt hier nicht`)
    }
  }
  stats.copied = dropId.size
  rows.forEach((row, ri) => {
    if (dupRow.has(ri)) { stats.skipped++; return }
    const id = dropId.has(ri) ? '' : String(cell(row, iId) ?? '').trim(); const sku = keyText(row), ext = String(cell(row, iExt) ?? '').trim()
    const want = iRoot >= 0 ? String(cell(row, iRoot) ?? '').trim() : (mapping.find(m => m.target === 'id')?.root ?? '')   // Wurzel aus der Spalte oder aus dem Kopf journali_id_<wurzel>
    const byId = id && tree.byId.get(id); const foreign = !!(byId && want && rootOf(id) !== want)
    const viaKey = !foreign && !byId && !(ext && byExt.get(ext)) ? findKey(row) : null
    let node = (!foreign && byId) || (!foreign && ext && byExt.get(ext)) || viaKey?.node || null
    if (dropId.has(ri)) stats.notes.push(dropId.get(ri) + (node ? ` — über ${ext && byExt.get(ext) ? 'Kennung ' + ext : `${viaKey?.k ?? 'Schlüssel'} ${viaKey?.v ?? sku}`} gefunden: „${node.label}“ wird aktualisiert` : ' — wird als neuer Knoten angelegt'))
    let ref = null, newRole = null
    if (!node) {
      // anlegen — wo? Elternteil aus der Spalte (Id oder ein Schlüsselwert), sonst das Ziel
      const p = String(cell(row, iParent) ?? '').trim()
      const parent = p ? (tree.byId.get(p) ?? [...uniq].map(k => byKey.get(k + '' + p)).find(Boolean) ?? null) : target
      if (!parent) { stats.problems.push(`Zeile ${ri + 2}: Elternteil „${p || '?'}“ nicht gefunden`); stats.skipped++; return }
      const r = role ?? (parent.role === 'product' ? 'variant' : 'product'); newRole = r
      if (r === 'variant' && parent.role !== 'product') { stats.problems.push(`Zeile ${ri + 2}: Variante braucht ein Produkt als Elternteil, „${parent.label}“ ist ${parent.role}`); stats.skipped++; return }
      if (r !== 'variant' && parent.role !== 'group') { stats.problems.push(`Zeile ${ri + 2}: ${r} braucht eine Gruppe als Elternteil, „${parent.label}“ ist ${parent.role}`); stats.skipped++; return }
      // Pflicht beim Anlegen: was die Rolle verlangt, muss die Zeile mitbringen (Achsen prüft der Variantenzweig)
      const miss = requiredFor(r).filter(a => !(parent.axes ?? []).includes(a.key) && !mapping.some((m, ci) => (m.target === 'attr' && m.attribute === a.key) && convert(cell(row, ci), a, model) != null)).map(a => a.key)
      // die Meldung nennt die Spalte der Datei, nicht nur das Attribut (Taloan, 20.09.: „ich habe keine Spalte name in der Excel“ — es war name_de)
      if (miss.length) { const colOf = k => { const cs = mapping.filter(m => m.target === 'attr' && m.attribute === k).map(m => m.column); return cs.length ? `${k} (Spalte ${cs.join(' / ')} leer)` : `${k} (keine Spalte zugeordnet)` }; stats.problems.push(`Zeile ${ri + 2}: Pflicht fehlt — ${miss.map(colOf).join(', ')}`); stats.skipped++; return }
      ref = `r${ri}`
      if (r === 'variant') {
        const axisValues = {}
        for (const a of parent.axes ?? []) { const m = mapping.find(x => x.target === 'attr' && x.attribute === a); const v = m ? conv(cell(row, mapping.indexOf(m)), attrs.get(a)) : null; if (v == null) { stats.problems.push(`Zeile ${ri + 2}: Achse ${a} fehlt`); } else axisValues[a] = v }
        if (Object.keys(axisValues).length < (parent.axes ?? []).length) { stats.skipped++; return }
        // Kombination aller Achsen je Produkt eindeutig (Taloan, 20.09.): gegen den Bestand und gegen die Datei selbst — der Server prüft es auch, aber erst beim Schreiben
        if ((parent.axes ?? []).length) {
          const combo = parent.axes.map(a => axisValues[a]).join('\u0001')
          if (!combos.has(parent.id)) combos.set(parent.id, new Set((tree?.rows ?? []).filter(x => x.role === 'variant' && x.parent === parent.id).map(x => parent.axes.map(a => x.axisValues?.[a] ?? '').join('\u0001'))))
          if (combos.get(parent.id).has(combo)) { stats.problems.push(`Zeile ${ri + 2}: Variante ${parent.axes.map(a => `${a}=${axisValues[a]}`).join(', ')} gibt es schon unter „${parent.label}“ (im Bestand oder doppelt in der Datei)`); stats.skipped++; return }
          combos.get(parent.id).add(combo)
        }
        commands.push({ op: 'variant.create', ref, args: { product: parent.id, axisValues } })
      } else if (r === 'group') commands.push({ op: 'group.create', ref, args: { parent: parent.id, label: {}, name: sku || null } })
      else commands.push({ op: 'product.create', ref, args: { group: parent.id, axes: [] } })
      if (ext && external) commands.push({ op: 'external.link', args: { node: '@' + ref, system: external, id: ext } })
      stats.create++
      targetGroups.add(parent.id)
    }
    const nodeRef = node ? node.id : '@' + ref
    const cur = node ? existing?.get(node.id) ?? null : null
    let changed = 0
    const diffs = []
    mapping.forEach((m, ci) => {
      if (m.target !== 'attr' && m.target !== 'new') return
      const def = defOf(m); if (!def) return
      if (node && node.role === 'variant' && (tree.byId.get(node.parent)?.axes ?? []).includes(def.key)) return   // Achsenwert ist fest
      const v = conv(cell(row, ci), def)
      const bad = check(v, def) ?? uniqueBad(def, v, node, ri)
      if (bad) { stats.invalid.push({ row: ri, column: ci, key: def.key, value: cell(row, ci), message: bad }); return }
      const loc = def.perLocale ? m.locale : null
      const k = `${def.key}|${loc ?? ''}`
      if (cur && (cur[k] ?? null) === v) return
      if (v == null && !cur) return   // neu und leer: nichts schreiben
      if (v == null && cur && !(k in cur)) return
      if (cur && v == null && !cur[k + '#own']) return   // geerbt und Quelle leer: nicht löschen
      commands.push({ op: 'attribute.set', args: { node: nodeRef, attribute: def.key, locale: loc, value: v ?? '' } })
      diffs.push({ attribute: def.key, locale: loc, from: cur ? cur[k] ?? null : null, to: v ?? null })
      changed++
    })
    // Status (Taloan, 22.09.): Spalte → Status-Schlüssel des Modells, meist über die Umwandlung „Werte ersetzen nach Tabelle“ (SAP 300 → review …);
    // ein Wert, der kein Status ist, wird gemeldet und nicht geschrieben
    const iSt = mapping.findIndex(m => m.target === 'status')
    if (iSt >= 0 && (node ? node.role : newRole) !== 'group') {
      const sv = String(cell(row, iSt) ?? '').trim()
      if (sv) {
        if (!(model?.statuses ?? []).some(s => s.key === sv)) stats.invalid.push({ row: ri, column: iSt, key: 'status', value: raw(row, iSt), message: `kein Status im Modell: „${sv}“` })
        else if (!node || node.status !== sv) { commands.push({ op: 'status.set', args: { node: nodeRef, status: sv } }); diffs.push({ attribute: 'status', locale: null, from: node?.status ?? null, to: sv }); changed++ }
      }
    }
    stats.values += changed
    if (node) { if (changed) stats.update++; else stats.unchanged++ }
    stats.changes.push({ row: ri, kind: node ? (changed ? 'update' : 'unchanged') : 'create', node: node?.id ?? null, label: node ? node.label : (sku || ext || id || `Zeile ${ri + 2}`), role: node?.role ?? null, values: diffs })
  })
  // Die Gruppen der neuen Attribute an die Zielknoten hängen, wo sie nicht schon gelten
  const groupsNeeded = [...new Set([...newAttrs.values()].map(a => a.group).filter(Boolean))]
  const attach = groupsNeeded.length ? [...(target ? [target.id] : []), ...targetGroups].filter((id, i, a) => a.indexOf(id) === i).map(id => ({ node: id, groups: groupsNeeded.filter(g => !(tree.byId.get(id)?.groups ?? '').split(',').includes(g)) })).filter(x => x.groups.length) : []
  return { commands, stats, newAttributes: [...newAttrs.values()], attach }
}

// Tabellen aus Text (Zwischenablage aus Excel = Tab-getrennt; sonst ; oder ,): { columns, rows } — rows als Arrays
export function parseDelimited(text, delimiter = null) {
  text = text.replace(/^﻿/, '')
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const d = delimiter ?? (['\t', ';', ',', '|'].map(c => [c, (firstLine.match(new RegExp(c === '|' ? '\\|' : c, 'g')) ?? []).length]).sort((a, b) => b[1] - a[1])[0][0])
  const rows = []; let row = [], field = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else q = false } else field += c; continue }
    if (c === '"') { q = true; continue }
    if (c === d) { row.push(field); field = ''; continue }
    if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); field = ''; if (row.some(f => f !== '')) rows.push(row); row = []; continue }
    field += c
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(f => f !== '')) rows.push(row) }
  const columns = (rows.shift() ?? []).map((c, i) => String(c).trim() || `Spalte ${i + 1}`)
  return { columns, rows: rows.map(r => { while (r.length < columns.length) r.push(''); return r.slice(0, columns.length) }), delimiter: d }
}

// Verschachteltes JSON flach: { a: { b: 1 } } → { 'a.b': 1 }; Arrays von Skalaren als kommagetrennt
export function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out)
    else if (Array.isArray(v)) out[key] = v.every(x => x == null || typeof x !== 'object') ? v.join(', ') : JSON.stringify(v)
    else out[key] = v
  }
  return out
}
export function fromObjects(list) {
  const rows = list.map(o => flatten(o))
  const columns = [...new Set(rows.flatMap(r => Object.keys(r)))]
  return { columns, rows: rows.map(r => columns.map(c => r[c] ?? '')) }
}

// ---- Die Spalten, die unter einem Knoten für seine Kinder gelten (Taloan, 17.09.: „eine Excel passt immer 1:1 zum Importknoten“):
// Attribute der Gruppen, die am Knoten gelten (angehängt oder geerbt) und an der Kindrolle aktiv sind (activeFrom),
// erlaubt an der Rolle (levels), ohne Zeilen- und Formelattribute. Vorlage, Export und strenger Import nehmen dieselbe Liste.
export const DEPTH = { group: 0, product: 1, variant: 2 }
export function childRoleOf(row, kids) { return row.role === 'product' ? 'variant' : (kids?.[0]?.role ?? 'product') }
export function childAttributes(model, nodeView, childRole) {
  const out = []; const seen = new Set()
  for (const g of nodeView.groups ?? []) {
    const gd = model.groups.find(x => x.key === g.key)
    if (gd?.activeFrom && DEPTH[childRole] < DEPTH[gd.activeFrom]) continue
    for (const k of gd?.attributes ?? g.attributes ?? []) {
      const a = model.attributes.find(x => x.key === k)
      if (!a || seen.has(k) || a.type === 'rows' || a.type === 'formula' || (a.levels && !a.levels.includes(childRole))) continue
      seen.add(k); out.push({ ...a, group: g.key, required: !!(a.required && Object.keys(a.required).length) })
    }
  }
  return out
}
// Spaltenköpfe für Vorlage und Export: id, eindeutige Attribute (Schlüssel), Achsen, dann je Attribut (je Sprache eine Spalte)
export function childColumns(model, nodeView, childRole, axes, locales) {
  const all = childAttributes(model, nodeView, childRole)
  const attrs = all.filter(a => !a.unique)
  const isReq = a => !!a.required && (typeof a.required !== 'object' || Object.keys(a.required).length > 0)   // am Knoten ist required schon ein Ja/Nein
  const cols = a => a.perLocale ? locales.map(l => ({ key: `${a.key}_${l}`, attr: a.key, locale: l, def: a })) : [{ key: a.key, attr: a.key, def: a }]
  // Pflicht direkt nach id, sku und Achsen (Taloan, 20.09.) — was fehlen darf, steht hinten
  return [{ key: 'id', note: 'leer = neu anlegen; gefüllt = diesen Knoten ändern' },
    ...all.filter(a => a.unique).flatMap(a => cols(a).map(c => ({ ...c, note: 'eindeutig — findet vorhandene Knoten, wenn id leer ist' }))),   // Schlüssel (Taloan, 21.09.); Pflicht, wenn das Attribut Pflicht ist
    ...(childRole === 'variant' ? (axes ?? []).map(a => ({ key: 'axis:' + a, note: 'Variantenachse — Pflicht beim Anlegen', attr: a })) : []),
    ...attrs.filter(isReq).flatMap(cols), ...attrs.filter(a => !isReq(a)).flatMap(cols)]
}
