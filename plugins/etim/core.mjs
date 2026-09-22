// Plugin etim — Kern ohne DOM (Taloan, 19.09.2026: ETIM/BMEcat-Export; die Freigaben liegen frei unter etim.de/daten/downloads).
// Liest eine ETIM-Freigabe im IXF 3.1 (XSD: etim-international.com/etimixf/31 — Units, Features, Values, Groups, Classes,
// je Klasse Features mit UnitCode und erlaubten Values), legt je übernommener Klasse einen Datensatz an (class:<EC>, alles
// aufgelöst: Namen, Typ, Einheit, Werte — damit Job und Prüfung nichts nachschlagen müssen) und löst je Produkt die ETIM-Attribute
// aus den zugeordneten Attributen auf, wie die ETIM-BMEcat-Guideline 5.0 sie will: Logical true/false, Numeric mit Punkt,
// Range zwei FVALUE, Alphanumeric der EV-Code, unbekannt „-“ mit FVALUE_DETAILS UN. Kein FUNIT — die Einheit steckt im ETIM-Attribut.
// Zuordnung mit ƒ (Taloan, 22.09.: „viele Werte existieren schon, nur nicht in der Form, wie das ETIM-Attribut sie braucht“): ein Eintrag
// der Zuordnung ist ein Schlüssel oder { to, steps } — die Kette aus plugins/table/transform.mjs läuft vor der Auflösung.
import { apply as applySteps } from '../table/transform.mjs'

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const unesc = s => s.replace(/&(amp|lt|gt|quot|apos|#(\d+)|#x([0-9a-fA-F]+));/g, (m, e, d, h) => d ? String.fromCodePoint(+d) : h ? String.fromCodePoint(parseInt(h, 16)) : ENT[e])
const tag = (xml, name) => { const m = xml.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([^<]*)</' + name + '>')); return m ? unesc(m[1].trim()) : null }
const each = (xml, name) => [...xml.matchAll(new RegExp('<' + name + '(\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'g'))].map(m => ({ attrs: m[1] ?? '', body: m[2] }))
const attrOf = (attrs, name) => { const m = attrs.match(new RegExp(name + '="([^"]*)"')); return m ? unesc(m[1]) : null }
/// IXF-Sprachen (de-DE, EN, nl-NL) → journali-Sprachcodes (de, en, nl); die erste je Code gewinnt
export const lang = code => String(code ?? '').slice(0, 2).toLowerCase()
function translations(xml, field = 'Description') {
  const out = {}
  for (const t of each(xml, 'Translation')) { const l = lang(attrOf(t.attrs, 'language')); const v = tag(t.body, field); if (v && !(l in out)) out[l] = v }
  return out
}

/// Eine IXF-3.1-Datei (Text) → { header, units, features, values, groups, classes } — Maps nach Code; Klassen als Liste
export function parseIxf(text) {
  if (!/<IXF[\s>]/.test(text)) throw new Error('keine IXF-Datei (Wurzel <IXF> fehlt)')
  const headerXml = each(text, 'Header')[0]?.body ?? ''
  const pub = each(headerXml, 'Publication')[0]?.body ?? ''
  const header = { description: tag(headerXml, 'Description'), exportDate: tag(headerXml, 'ExportDate'), name: tag(pub, 'Name'), number: tag(pub, 'Number'), date: tag(pub, 'Date'), prerelease: tag(pub, 'Prerelease') === 'true' }
  const units = new Map(); const features = new Map(); const values = new Map(); const groups = new Map(); const featureGroups = new Map()
  const section = name => { const m = text.match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>')); return m ? m[1] : '' }
  for (const u of each(section('Units'), 'Unit')) { const code = tag(u.body, 'Code'); const abbr = {}; for (const t of each(u.body, 'Translation')) { const l = lang(attrOf(t.attrs, 'language')); const a = tag(t.body, 'Abbreviation'); if (a && !(l in abbr)) abbr[l] = a } units.set(code, { code, name: translations(u.body), abbr }) }
  for (const f of each(section('Features'), 'Feature')) { const code = tag(f.body, 'Code'); features.set(code, { code, type: tag(f.body, 'Type'), group: tag(f.body, 'FeatureGroupCode'), name: translations(f.body) }) }
  for (const g of each(section('FeatureGroups'), 'FeatureGroup')) { const code = tag(g.body, 'Code'); featureGroups.set(code, { code, name: translations(g.body) }) }
  for (const v of each(section('Values'), 'Value')) { const code = tag(v.body, 'Code'); values.set(code, { code, name: translations(v.body) }) }
  for (const g of each(section('Groups'), 'Group')) { const code = tag(g.body, 'Code'); groups.set(code, { code, name: translations(g.body) }) }
  const classes = []
  for (const c of each(section('Classes'), 'Class')) {
    const code = tag(c.body, 'Code'); if (!code) continue
    const name = {}; const synonyms = {}
    for (const t of each(c.body, 'Translation')) { const l = lang(attrOf(t.attrs, 'language')); const d = tag(t.body, 'Description'); if (d && !(l in name)) name[l] = d; const syn = each(t.body, 'Synonym').map(s => unesc(s.body.trim())).filter(Boolean); if (syn.length && !(l in synonyms)) synonyms[l] = syn }
    const feats = []
    const featXml = each(c.body, 'Features')[0]?.body ?? ''
    for (const f of each(featXml, 'Feature')) feats.push({ code: tag(f.body, 'FeatureCode'), unit: tag(f.body, 'UnitCode'), order: Number(tag(f.body, 'OrderNumber') ?? 0), values: each(f.body, 'Value').map(v => tag(v.body, 'ValueCode')).filter(Boolean), change: attrOf(f.attrs, 'changeCode') })
    classes.push({ code, version: Number(tag(c.body, 'Version') ?? 0), status: tag(c.body, 'Status'), group: tag(c.body, 'GroupCode'), change: attrOf(c.attrs, 'changeCode'), name, synonyms, features: feats.sort((a, b) => a.order - b.order) })
  }
  return { header, units, features, values, groups, featureGroups, classes }
}

/// Klasse aufgelöst — der Datensatz class:<EC> im Journal: alles drin, was Job, Prüfung und Ansicht brauchen
/// langs: nur diese Sprachen in Namen und Synonymen behalten (eine ganze Freigabe ins Journal — 5000 Klassen × alle Sprachen wären zu viel)
export function classRecord(rel, cls, langs = null) {
  const L = o => { if (!langs || !o) return o; const kept = Object.fromEntries(Object.entries(o).filter(([k]) => langs.includes(k))); return Object.keys(kept).length ? kept : o }
  return {
    code: cls.code, version: cls.version, status: cls.status, change: cls.change, name: L(cls.name), synonyms: L(cls.synonyms),
    group: cls.group ? { code: cls.group, name: L(rel.groups.get(cls.group)?.name ?? {}) } : null,
    release: { name: rel.header.name, number: rel.header.number, date: rel.header.date },
    features: cls.features.map(f => {
      const def = rel.features.get(f.code) ?? { type: 'Alphanumeric', name: {} }
      const u = f.unit ? rel.units.get(f.unit) : null
      return { code: f.code, type: def.type, name: L(def.name), group: def.group ?? null, order: f.order, change: f.change,
        unit: u ? { code: u.code, abbr: u.abbr, name: L(u.name) } : null,
        values: f.values.map(v => ({ code: v, name: L(rel.values.get(v)?.name ?? {}) })) }
    }),
  }
}

/// Zuordnung eines ETIM-Attributs: { key, steps } — Zeiger (Text) oder { to, steps }; ohne Zuordnung das eigene Attribut ef… (Code klein)
export function mapEntry(map, code) {
  const m = map?.[code] ?? map?.[code.toUpperCase()]
  if (!m) return { key: code.toLowerCase(), steps: null }
  if (typeof m === 'string') return { key: m, steps: null }
  return { key: m.to || code.toLowerCase(), steps: Array.isArray(m.steps) && m.steps.length ? m.steps : null }
}
/// Rohwert durch die Kette der Zuordnung (leer bleibt leer, ausser die Kette sagt etwas)
export const throughSteps = (steps, raw) => steps ? applySteps(steps, raw == null ? '' : Array.isArray(raw) ? raw.join(', ') : String(raw)) : raw

/// Ausführung einer Freigabe aus dem Dateinamen (Taloan, 22.09.2026: „davon gibt es allein bei ETIM 9 sechs Stück“):
/// ETIM-9.0-ALL-SECTORS-IXF-NO-CHANGE-CODES-METRIC-EI-2022-12-05.xml → all-sectors-no-change-codes-metric-ei.
/// Ohne Dateinamen leer — dann ist der Schlüssel nur die Nummer (Altbestand).
export function variantOf(file) {
  let v = String(file ?? '').replace(/\.(xml|ixf|zip)$/i, '')
  v = v.replace(/^etim[-_ ]?\d+(\.\d+)?[-_ ]?/i, '').replace(/[-_ ]?\d{4}-\d{2}-\d{2}$/, '').replace(/[-_ ]?ixf[-_ ]?/i, '-')
  return v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
/// Schlüssel einer Freigabe im Journal: release:<key>, class:<key>:<EC>
export const releaseKey = info => info?.key ?? [String(info?.version ?? info?.number ?? '0'), variantOf(info?.file ?? info?.url ?? '')].filter(Boolean).join('-')

/// Ein Name in der Sprache, sonst de, en, irgendeine
export const nameOf = (names, locale) => names?.[locale] ?? names?.de ?? names?.en ?? Object.values(names ?? {})[0] ?? ''
export const classText = (cls, locale) => `${cls.code} ${nameOf(cls.name, locale)}`
export const featureText = (f, locale) => `${nameOf(f.name, locale) || f.code}${f.unit ? ' [' + (nameOf(f.unit.abbr, locale) || f.unit.code) + ']' : ''}`

const TRUE = new Set(['true', 'ja', 'yes', '1', 'y', 'j', 'wahr', 'x'])
const FALSE = new Set(['false', 'nein', 'no', '0', 'n', 'falsch', '-'])
const num = s => { const n = Number(String(s).trim().replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : n }
const fmt = n => String(Math.round(n * 1e6) / 1e6)

/// Rohwert eines Attributs → FVALUE(s) nach Typ des ETIM-Attributs; null = nicht auflösbar (Prüfregel), { unknown } = leer
export function resolveValue(feature, raw) {
  const s = raw == null ? '' : Array.isArray(raw) ? raw.join(', ') : String(raw).trim()
  if (!s) return { unknown: true }
  switch (feature.type) {
    case 'Logical': { const l = s.toLowerCase(); if (TRUE.has(l)) return { values: ['true'] }; if (FALSE.has(l)) return { values: ['false'] }; return null }
    case 'Numeric': { const n = num(s); return n == null ? null : { values: [fmt(n)] } }
    case 'Range': {
      const m = s.match(/^\s*(-?[\d.,]+)\s*(?:\.\.\.?|…|–|-|;|\/|bis|to)\s*(-?[\d.,]+)\s*$/i)
      if (m) { const a = num(m[1]), b = num(m[2]); return a == null || b == null ? null : { values: [fmt(a), fmt(b)] } }
      const n = num(s); return n == null ? null : { values: [fmt(n), fmt(n)] }
    }
    default: {   // Alphanumeric: EV-Code direkt, sonst der Name in irgendeiner Sprache
      const parts = s.split(/\s*[,;|]\s*/).filter(Boolean); const out = []
      for (const p of parts) {
        if (/^EV\d{6}$/i.test(p)) { if (feature.values.some(v => v.code === p.toUpperCase())) { out.push(p.toUpperCase()); continue } return null }
        const hit = feature.values.find(v => Object.values(v.name).some(n => n.toLowerCase() === p.toLowerCase()))
        if (!hit) return null
        out.push(hit.code)
      }
      return out.length ? { values: out } : { unknown: true }
    }
  }
}

/// ETIM-Attribute eines Produkts für den Export. pctx: { attr: { key: { value, raw } } } (xport-Kontext); cfg: { classAttr, map, unknownAs, getClass }
/// map: EF-Code → Attributschlüssel oder { to, steps }; ohne Zuordnung gilt das Attribut mit dem Schlüssel des Codes in Kleinbuchstaben (ef000040).
/// Liefert auch die Vollständigkeit: filled / total (nur ETIM-Attribute mit Attribut zählen als füllbar) und completeness in Prozent aller ETIM-Attribute.
export async function featuresOf(pctx, cfg) {
  const code = String(pctx.attr?.[cfg.classAttr]?.raw ?? pctx.attr?.[cfg.classAttr]?.value ?? '').trim().toUpperCase()
  if (!/^EC\d{6}$/.test(code)) return { classCode: code || null, features: [], known: false, filled: 0, total: 0, completeness: 0 }
  const cls = await cfg.getClass(code)
  if (!cls) return { classCode: code, features: [], known: false, filled: 0, total: cls?.features?.length ?? 0, completeness: 0 }
  const features = []; let filled = 0
  for (const f of cls.features) {
    const { key, steps } = mapEntry(cfg.map, f.code)
    const a = pctx.attr?.[key]
    const r = resolveValue(f, throughSteps(steps, a ? (a.raw ?? a.value) : null))
    if (r && !r.unknown) filled++
    const label = nameOf(f.name, pctx.locale)
    if (r === null) { features.push({ code: f.code, value: null, values: [], unit: null, details: 'UN', label, bad: String(a?.value ?? '') }); continue }
    if (r.unknown) { if (cfg.unknownAs === 'skip') continue; features.push({ code: f.code, value: '-', values: ['-'], unit: null, details: cfg.unknownAs || 'UN', label }); continue }
    features.push({ code: f.code, value: r.values.join(' - '), values: r.values, unit: null, details: null, label })
  }
  // nicht auflösbare Werte nach der Guideline als unbekannt ausgeben — die Prüfregel meldet sie
  for (const f of features) if (f.value === null) { f.value = '-'; f.values = ['-'] }
  const total = cls.features.length
  return { classCode: code, features, known: true, version: cls.release?.name ?? null, filled, total, completeness: total ? Math.round(filled * 100 / total) : 0 }
}

/// Sperre für den Export (Taloan, 20.09.: „der Export führt stillschweigend die Analyse aus, bevor er tätig wird“ — und: „ob die Attribute
/// gefüllt sind, verantwortet der Anwender über Pflichtfelder; aber die Struktur muss da und zugeordnet sein“): null = bestanden, sonst der
/// Grund. Geprüft wird die Struktur: Klasse am Knoten, Klasse übernommen, je ETIM-Attribut ein Attribut, das am Knoten gilt (Gruppe am Pfad).
/// Leere oder unpassende Werte sperren nicht — sie gehen als „-“/UN hinaus und werden gezählt (Kopf: stats).
/// Regeln der Ausleitung (BMEcat-Profil, Taloan 22.09.): requireClass = ohne Klasse sperren (sonst geht das Produkt ohne ETIM-Attribute hinaus);
/// minCompleteness = Prozent der ETIM-Attribute, die gefüllt sein müssen (0 = keine Schwelle) — die Empfänger rechnen genau das;
/// strict = ein Wert, der nicht zum ETIM-Attribut passt, sperrt (sonst geht er als „-“/UN hinaus und wird gezählt).
export async function gate(pctx, cfg) {
  const code = String(pctx.attr?.[cfg.classAttr]?.raw ?? pctx.attr?.[cfg.classAttr]?.value ?? '').trim().toUpperCase()
  if (!code) return cfg.requireClass ? 'keine ETIM-Klasse' : null
  const cls = await cfg.getClass(code)
  if (!cls) return `Klasse ${code} nicht in ETIM ${cfg.version ?? '?'}`
  const noAttr = [], notHere = [], bad = []; let filled = 0
  for (const f of cls.features) {
    const { key, steps } = mapEntry(cfg.map, f.code)
    if (!(key in (pctx.attr ?? {}))) { noAttr.push(f.code); continue }          // kein Attribut im Modell
    if (pctx.active && !pctx.active.has(key)) { notHere.push(f.code); continue } // Attribut da, gilt aber nicht an diesem Knoten
    const a = pctx.attr[key]; const r = resolveValue(f, throughSteps(steps, a ? (a.raw ?? a.value) : null))
    if (r === null) bad.push(f.code); else if (!r.unknown) filled++
  }
  const say = (l, w) => l.length ? `${l.length} ${w}: ${l.slice(0, 4).join(', ')}${l.length > 4 ? ' …' : ''}` : ''
  const out = [say(noAttr, `von ${cls.features.length} ETIM-Attributen nicht zugeordnet (kein Attribut im Modell)`), say(notHere, 'gelten hier nicht (Gruppe nicht am Pfad)')]
  if (cfg.strict && bad.length) out.push(say(bad, 'Werte passen nicht zum ETIM-Attribut'))
  const pct = cls.features.length ? Math.round(filled * 100 / cls.features.length) : 100
  if (cfg.minCompleteness > 0 && pct < cfg.minCompleteness) out.push(`Vollständigkeit ${pct} % unter ${cfg.minCompleteness} % (${filled} von ${cls.features.length} ETIM-Attributen)`)
  const why = out.filter(Boolean).join('; ')
  return why || null
}

export const TYPE_LABEL = { Alphanumeric: 'Liste', Numeric: 'Zahl', Range: 'Bereich', Logical: 'Ja/Nein' }

/// Eine Rechnung für Zahlen und Befunde (Taloan, 22.09.2026: die Klassentabelle sagte „9 von 175“, die Prüfung „keine Befunde“ —
/// das waren zwei Wege). rows: Zeilen aus /table ({ row, values, inactive }); jede Zeile zählt in IHRER Klasse.
/// Liefert { byClass: [{ code, nodes, filled, cells, bad, pct }], sum, findings } — dieselben Zahlen, die die Befunde belegen.
/// complete: auch vollständige Knoten in die Liste (Band — Taloan, 22.09.: „die Unterknoten wurden aufgeschlüsselt“); false = nur, wo etwas fehlt
export function audit({ rows, classAttr, classes, map, locale = 'de', hasAttr = () => true, complete = false }) {
  const featsOf = cls => cls.features.map(f => { const m = mapEntry(map, f.code); return { f, key: m.key, steps: m.steps, has: hasAttr(m.key) } })
  const byCode = new Map(); const acc = new Map(); const findings = []
  for (const r of rows) {
    const code = String(r.values?.[classAttr]?.value ?? '').trim().toUpperCase()
    const cls = classes.get(code); if (!cls) continue
    if (!byCode.has(code)) byCode.set(code, featsOf(cls))
    if (!acc.has(code)) acc.set(code, { code, nodes: 0, filled: 0, cells: 0, bad: 0 })
    const a = acc.get(code); a.nodes++
    const inactive = r.inactive ?? []
    let filled = 0, mapped = 0; const notHere = [], noAttr = []
    for (const x of byCode.get(code)) {
      if (!x.has) { noAttr.push(x); continue }
      if (inactive.includes(x.key)) { notHere.push(x); continue }
      mapped++; a.cells++
      const raw = r.values?.[x.key]?.value; const v = resolveValue(x.f, throughSteps(x.steps, raw))
      if (v === null) { a.bad++; findings.push({ node: r.row, attribute: x.f.code, label: nameOf(x.f.name, locale), message: `„${raw}“ passt nicht (${TYPE_LABEL[x.f.type] ?? x.f.type}${x.f.type === 'Alphanumeric' ? ': ' + x.f.values.slice(0, 6).map(y => nameOf(y.name, locale)).join(', ') + (x.f.values.length > 6 ? ' …' : '') : ''})`, go: 'node', severity: 'warn' }) }
      else if (!v.unknown) { a.filled++; filled++ }
    }
    // gleiche Lage bündeln (Taloan, 22.09.: 35 Zeilen „nicht verfügbar“ nach dem Entfernen der Gruppe): bis drei einzeln, darüber eine Zeile
    const many = (list, one, all, title) => {
      if (!list.length) return
      if (list.length <= 3) for (const x of list) findings.push({ node: r.row, attribute: x.f.code, label: nameOf(x.f.name, locale), message: one(x), title, go: 'map', severity: 'info' })
      else findings.push({ node: r.row, attribute: null, label: null, message: all(list), title, go: 'map', severity: 'info' })
    }
    const codes = l => l.slice(0, 4).map(x => x.f.code).join(', ') + (l.length > 4 ? ` … +${l.length - 4}` : '')
    many(notHere, x => `zugeordnetes Attribut ${x.key} ist an diesem Knoten nicht verfügbar`,
      l => `${l.length} von ${byCode.get(code).length} ETIM-Attributen sind hier nicht verfügbar — die zugeordneten Attribute gelten an diesem Knoten nicht (${codes(l)})`,
      'die zugeordneten Attribute gibt es im Modell, aber nicht an diesem Knoten: ihre Gruppe hängt nicht am Pfad, oder sie sind auf andere Rollen beschränkt')
    many(noAttr, () => 'nicht zugeordnet — kein Attribut im Modell',
      l => `${l.length} von ${byCode.get(code).length} ETIM-Attributen nicht zugeordnet — kein Attribut im Modell (${codes(l)})`,
      '⇄ zuordnen oder ＋ anlegen')
    if (mapped && (complete || filled < mapped)) findings.push({ node: r.row, attribute: null, message: null, progress: { filled, total: mapped, pct: pct(filled, mapped) }, severity: filled === mapped ? 'ok' : 'info', title: 'gefüllt = ein Wert, den das ETIM-Attribut lesen kann (Zahl, Ja/Nein, Listenwert) — gelesen wird das zugeordnete Attribut; leer geht als „-“/UN in den BMEcat', go: 'node' })
  }
  for (const a of acc.values()) a.pct = pct(a.filled, a.cells)
  const byClass = [...acc.values()].sort((x, y) => y.nodes - x.nodes || x.code.localeCompare(y.code))
  const sum = byClass.reduce((s, c) => ({ nodes: s.nodes + c.nodes, filled: s.filled + c.filled, cells: s.cells + c.cells, bad: s.bad + c.bad }), { nodes: 0, filled: 0, cells: 0, bad: 0 })
  sum.pct = pct(sum.filled, sum.cells)
  return { byClass, sum, findings }
}
const pct = (a, b) => b ? Math.round(a * 1000 / b) / 10 : 0

/// Prüfung eines Knotens (Datenqualität): values = { key: { value } } wie /table; classes = Map EC → Datensatz
/// inactive: Attribute, die es im Modell gibt, die an diesem Knoten aber nicht gelten (aus /table je Zeile) — dann sagt der Fund das
export function checkNode({ values, columns, classes, cfg, inactive = [] }) {
  const out = []
  const col = columns.find(c => c.key === cfg.classAttr); if (!col) return out
  const code = String(values[cfg.classAttr]?.value ?? '').trim().toUpperCase()
  if (!code) return cfg.requireClass ? [{ attribute: cfg.classAttr, message: 'keine ETIM-Klasse', severity: 'info' }] : out
  const cls = classes.get(code)
  if (!cls) return [{ attribute: cfg.classAttr, message: `ETIM-Klasse ${code} nicht übernommen (⌗ ETIM → Klassen)`, severity: 'warn' }]
  let filled = 0
  for (const f of cls.features) {
    const { key, steps } = mapEntry(cfg.map, f.code)
    if (!columns.some(c => c.key === key)) continue
    const r = resolveValue(f, throughSteps(steps, values[key]?.value))
    if (r === null) out.push({ attribute: key, go: 'node', message: `${f.code} ${nameOf(f.name, cfg.locale)}: „${values[key]?.value}“ passt nicht (${f.type}${f.type === 'Alphanumeric' ? ': ' + f.values.slice(0, 6).map(v => nameOf(v.name, cfg.locale)).join(', ') + (f.values.length > 6 ? ' …' : '') : ''})`, severity: 'warn' })
    else if (!r.unknown) filled++
  }
  // Zusammenfassung je Knoten (Taloan, 22.09.: „was heisst belegt?“): gefüllt = ein Wert, den das ETIM-Attribut lesen kann; ohne Spalte = kein
  // Attribut im Modell oder es gilt an diesem Knoten nicht (Gruppe nicht am Pfad, Rolle) — mit Namen, damit man weiss, welche
  const noCol = cls.features.filter(f => !columns.some(c => c.key === mapEntry(cfg.map, f.code).key))
  const mapped = cls.features.length - noCol.length
  // je ETIM-Attribut ein Fund, Feld = das ETIM-Attribut (EF-Code) — beanstandet ist aus ETIM-Sicht das EF, das sich nicht füllen lässt (Taloan, 22.09.)
  const notHere = noCol.filter(f => inactive.includes(mapEntry(cfg.map, f.code).key)), noAttr = noCol.filter(f => !inactive.includes(mapEntry(cfg.map, f.code).key))
  for (const f of notHere) out.push({ attribute: f.code, message: `zugeordnetes Attribut ${mapEntry(cfg.map, f.code).key} ist an diesem Knoten nicht verfügbar`, label: nameOf(f.name, cfg.locale), go: 'map', code: f.code, title: 'das zugeordnete Attribut gibt es im Modell, aber nicht an diesem Knoten: seine Gruppe hängt nicht am Pfad, oder es ist auf andere Rollen beschränkt (Modell → Attribut → verwendbar in der Hierarchie)', severity: 'info' })
  for (const f of noAttr) out.push({ attribute: f.code, message: 'nicht zugeordnet — kein Attribut im Modell', label: nameOf(f.name, cfg.locale), go: 'map', code: f.code, title: '⇄ zuordnen oder ＋ anlegen (Band ⌗ ETIM am Knoten)', severity: 'info' })
  // Fortschritt statt Aufzählung (Taloan, 22.09.): „2 von 34 gefüllt“ mit Balken und Prozent — die Einzelprozente lassen sich im Baum hochrechnen
  const pct = mapped ? Math.round(filled * 1000 / mapped) / 10 : 0
  if (filled < mapped) out.push({ attribute: null, go: 'node', message: `${filled} von ${mapped} gefüllt · ${String(pct).replace('.', ',')} %`, progress: { filled, total: mapped, pct }, title: 'gefüllt = ein Wert, den das ETIM-Attribut lesen kann (Zahl, Ja/Nein, Listenwert) — gelesen wird das zugeordnete Attribut; leer geht als „-“/UN in den BMEcat', severity: 'info' })
  return out
}
