// Plugin etim — Kern ohne DOM (Taloan, 19.09.2026: ETIM/BMEcat-Export; die Freigaben liegen frei unter etim.de/daten/downloads).
// Liest eine ETIM-Freigabe im IXF 3.1 (XSD: etim-international.com/etimixf/31 — Units, Features, Values, Groups, Classes,
// je Klasse Features mit UnitCode und erlaubten Values), legt je übernommener Klasse einen Datensatz an (class:<EC>, alles
// aufgelöst: Namen, Typ, Einheit, Werte — damit Job und Prüfung nichts nachschlagen müssen) und löst je Produkt die Merkmale
// aus den zugeordneten Attributen auf, wie die ETIM-BMEcat-Guideline 5.0 sie will: Logical true/false, Numeric mit Punkt,
// Range zwei FVALUE, Alphanumeric der EV-Code, unbekannt „-“ mit FVALUE_DETAILS UN. Kein FUNIT — die Einheit steckt im Merkmal.

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
export function classRecord(rel, cls) {
  return {
    code: cls.code, version: cls.version, status: cls.status, change: cls.change, name: cls.name, synonyms: cls.synonyms,
    group: cls.group ? { code: cls.group, name: rel.groups.get(cls.group)?.name ?? {} } : null,
    release: { name: rel.header.name, number: rel.header.number, date: rel.header.date },
    features: cls.features.map(f => {
      const def = rel.features.get(f.code) ?? { type: 'Alphanumeric', name: {} }
      const u = f.unit ? rel.units.get(f.unit) : null
      return { code: f.code, type: def.type, name: def.name, group: def.group ?? null, order: f.order, change: f.change,
        unit: u ? { code: u.code, abbr: u.abbr, name: u.name } : null,
        values: f.values.map(v => ({ code: v, name: rel.values.get(v)?.name ?? {} })) }
    }),
  }
}

/// Ein Name in der Sprache, sonst de, en, irgendeine
export const nameOf = (names, locale) => names?.[locale] ?? names?.de ?? names?.en ?? Object.values(names ?? {})[0] ?? ''
export const classText = (cls, locale) => `${cls.code} ${nameOf(cls.name, locale)}`
export const featureText = (f, locale) => `${nameOf(f.name, locale) || f.code}${f.unit ? ' [' + (nameOf(f.unit.abbr, locale) || f.unit.code) + ']' : ''}`

const TRUE = new Set(['true', 'ja', 'yes', '1', 'y', 'j', 'wahr', 'x'])
const FALSE = new Set(['false', 'nein', 'no', '0', 'n', 'falsch', '-'])
const num = s => { const n = Number(String(s).trim().replace(/\s/g, '').replace(',', '.')); return isNaN(n) ? null : n }
const fmt = n => String(Math.round(n * 1e6) / 1e6)

/// Rohwert eines Attributs → FVALUE(s) nach Merkmalstyp; null = nicht auflösbar (Prüfregel), { unknown } = leer
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

/// Merkmale eines Produkts für den Export. pctx: { attr: { key: { value, raw } } } (xport-Kontext); cfg: { classAttr, map, unknownAs, getClass }
/// map: EF-Code → Attributschlüssel; ohne Zuordnung gilt das Attribut mit dem Schlüssel des Codes in Kleinbuchstaben (ef000040).
export async function featuresOf(pctx, cfg) {
  const code = String(pctx.attr?.[cfg.classAttr]?.raw ?? pctx.attr?.[cfg.classAttr]?.value ?? '').trim().toUpperCase()
  if (!/^EC\d{6}$/.test(code)) return { classCode: code || null, features: [], known: false }
  const cls = await cfg.getClass(code)
  if (!cls) return { classCode: code, features: [], known: false }
  const features = []
  for (const f of cls.features) {
    const key = cfg.map?.[f.code] ?? f.code.toLowerCase()
    const a = pctx.attr?.[key]
    const r = resolveValue(f, a ? (a.raw ?? a.value) : null)
    const label = nameOf(f.name, pctx.locale)
    if (r === null) { features.push({ code: f.code, value: null, values: [], unit: null, details: 'UN', label, bad: String(a?.value ?? '') }); continue }
    if (r.unknown) { if (cfg.unknownAs === 'skip') continue; features.push({ code: f.code, value: '-', values: ['-'], unit: null, details: cfg.unknownAs || 'UN', label }); continue }
    features.push({ code: f.code, value: r.values.join(' - '), values: r.values, unit: null, details: null, label })
  }
  // nicht auflösbare Werte nach der Guideline als unbekannt ausgeben — die Prüfregel meldet sie
  for (const f of features) if (f.value === null) { f.value = '-'; f.values = ['-'] }
  return { classCode: code, features, known: true, version: cls.release?.name ?? null }
}

/// Sperre für den Export (Taloan, 20.09.: „der Export führt stillschweigend die Analyse aus, bevor er tätig wird“ — und: „ob die Attribute
/// gefüllt sind, verantwortet der Anwender über Pflichtfelder; aber die Struktur muss da und zugeordnet sein“): null = bestanden, sonst der
/// Grund. Geprüft wird die Struktur: Klasse am Knoten, Klasse übernommen, je Merkmal ein Attribut, das am Knoten gilt (Gruppe am Pfad).
/// Leere oder unpassende Werte sperren nicht — sie gehen als „-“/UN hinaus und werden gezählt (Kopf: stats).
export async function gate(pctx, cfg) {
  const code = String(pctx.attr?.[cfg.classAttr]?.raw ?? pctx.attr?.[cfg.classAttr]?.value ?? '').trim().toUpperCase()
  if (!code) return 'keine ETIM-Klasse'
  const cls = await cfg.getClass(code)
  if (!cls) return `Klasse ${code} nicht übernommen`
  const noAttr = [], notHere = []
  for (const f of cls.features) {
    const key = cfg.map?.[f.code] ?? f.code.toLowerCase()
    if (!(key in (pctx.attr ?? {}))) noAttr.push(f.code)                       // kein Attribut im Modell
    else if (pctx.active && !pctx.active.has(key)) notHere.push(f.code)          // Attribut da, gilt aber nicht an diesem Knoten
  }
  if (!noAttr.length && !notHere.length) return null
  const say = (l, w) => l.length ? `${l.length} ${w}: ${l.slice(0, 4).join(', ')}${l.length > 4 ? ' …' : ''}` : ''
  return [say(noAttr, `von ${cls.features.length} Merkmalen ohne Attribut im Modell`), say(notHere, 'gelten hier nicht (Gruppe nicht am Pfad)')].filter(Boolean).join('; ')
}

/// Prüfung eines Knotens (Datenqualität): values = { key: { value } } wie /table; classes = Map EC → Datensatz
export function checkNode({ values, columns, classes, cfg }) {
  const out = []
  const col = columns.find(c => c.key === cfg.classAttr); if (!col) return out
  const code = String(values[cfg.classAttr]?.value ?? '').trim().toUpperCase()
  if (!code) return cfg.requireClass ? [{ attribute: cfg.classAttr, message: 'keine ETIM-Klasse', severity: 'info' }] : out
  const cls = classes.get(code)
  if (!cls) return [{ attribute: cfg.classAttr, message: `ETIM-Klasse ${code} nicht übernommen (⌗ ETIM → Klassen)`, severity: 'warn' }]
  let filled = 0
  for (const f of cls.features) {
    const key = cfg.map?.[f.code] ?? f.code.toLowerCase()
    if (!columns.some(c => c.key === key)) continue
    const r = resolveValue(f, values[key]?.value)
    if (r === null) out.push({ attribute: key, message: `${f.code} ${nameOf(f.name, cfg.locale)}: „${values[key]?.value}“ passt nicht (${f.type}${f.type === 'Alphanumeric' ? ': ' + f.values.slice(0, 6).map(v => nameOf(v.name, cfg.locale)).join(', ') + (f.values.length > 6 ? ' …' : '') : ''})`, severity: 'warn' })
    else if (!r.unknown) filled++
  }
  const mapped = cls.features.filter(f => columns.some(c => c.key === (cfg.map?.[f.code] ?? f.code.toLowerCase()))).length
  if (mapped < cls.features.length) out.push({ attribute: cfg.classAttr, message: `${code}: ${cls.features.length - mapped} von ${cls.features.length} Merkmalen ohne Attribut (⌗ ETIM → Zuordnung)`, severity: 'info' })
  if (filled < mapped) out.push({ attribute: cfg.classAttr, message: `${code}: ${filled} von ${mapped} zugeordneten Merkmalen belegt`, severity: 'info' })
  return out
}
