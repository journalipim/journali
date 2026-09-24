// Client für einen Solr-Kern (Export eines anderen PIM) — plugins/solr/README.md.
// Solr schickt keinen CORS-Kopf, antwortet aber auf json.wrf mit JSONP: ein <script>-Tag
// je Anfrage, nur Lesen. Im Job auf dem Server geht es ohne das: dort fragt fetch (holenMitFetch).
// Die Abbildung steht hier einmal und gilt für beide Wege.
export const SYSTEM = 'solr'
export const ROLE = { group: 'group', product: 'product', productvariant: 'variant' }
export const roleOf = d => ROLE[(d.type || '').toLowerCase()]
export const isNode = d => !!roleOf(d)

// Solr-Typsuffix (property__<key>__<suffix>) → [journali-Typ, mehrfach, Achse locale]
export const TYPES = {
  string: ['text', false, true], multi_string: ['text', true, true], text: ['text', false, true], url: ['text', false, false],
  xhtml: ['html', false, true], multi_xhtml: ['html', true, true],
  int: ['integer', false, false], multi_int: ['integer', true, false], long: ['integer', false, false], multi_long: ['integer', true, false],
  float: ['decimal', false, false], multi_float: ['decimal', true, false], double: ['decimal', false, false], multi_double: ['decimal', true, false],
  boolean: ['boolean', false, false], date: ['date', false, false], dateTime: ['date', false, false],
}
const SKIP_SUFFIX = ['_rel', 'image', 'file', 'json', 'loc', 'cur', 'coordinate']
export const DEFAULT_SKIP = ['*_finder', 'technical_details', 'group_title', 'prodexa_classification']

/// journali-Schlüssel: [a-z][a-z0-9_]* — für immer.
export const slug = s => { const k = s.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, ''); return /^[a-z]/.test(k) ? k : 'p_' + k }
const matches = (key, patterns) => patterns.some(p => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$').test(key))

let seq = 0
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const cb = '__solr' + (++seq)
    const tag = document.createElement('script')
    const done = () => { delete window[cb]; tag.remove(); clearTimeout(timer) }
    const timer = setTimeout(() => { done(); reject(new Error('Solr: keine Antwort (60 s)')) }, 60000)
    window[cb] = data => { done(); resolve(data) }
    tag.onerror = () => { done(); reject(new Error('Solr: Anfrage fehlgeschlagen — URL, Netz oder Kern?')) }
    tag.src = url + (url.includes('?') ? '&' : '?') + 'wt=json&json.wrf=' + cb
    document.head.appendChild(tag)
  })
}

/// Ohne Browser (Job auf dem Server): Solr antwortet auf wt=json ganz normal — CORS spielt dort keine Rolle.
export const holenMitFetch = async url => {
  const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'wt=json')
  if (!res.ok) throw new Error(`Solr: ${res.status} ${res.statusText}`)
  return res.json()
}

/// Ein Solr-Kern. `holen` ist der Weg zur Quelle: im Browser JSONP, im Job fetch.
export function solr(core, holen = jsonp) {
  const base = core.replace(/\/+$/, '')
  const NODES = '(type:group OR type:product OR type:productVariant)'
  async function select(q, { fq = [], fl = '*', rows = 500, sort = 'sort_nr asc,id asc', cursor = null } = {}) {
    const p = new URLSearchParams({ q, fl, rows, sort })
    for (const f of fq) p.append('fq', f)
    if (cursor) p.set('cursorMark', cursor)
    const d = await holen(`${base}/select?${p}`)
    if (d.error) throw new Error(`Solr: ${d.error.msg}`)
    return d
  }
  /// Alle Treffer, seitenweise mit cursorMark; `onPage` meldet den Fortschritt.
  async function all(q, opts = {}, onPage) {
    const out = []
    let cursor = '*'
    for (;;) {
      const d = await select(q, { ...opts, cursor })
      out.push(...d.response.docs)
      onPage?.(out.length, d.response.numFound)
      const next = d.nextCursorMark
      if (!next || next === cursor) return out
      cursor = next
    }
  }
  return {
    status: () => holen(`${base}/admin/ping`).catch(() => null),
    count: async () => (await select('*:*', { rows: 0 })).response.numFound,
    /// Wurzeln des Baums: Baumknoten ohne Eltern.
    roots: async () => (await select(NODES, { fq: ['main_parent_id:""'], rows: 200 })).response.docs.filter(isNode),
    children: async id => (await select(NODES, { fq: [`main_parent_id:"${id}"`], rows: 1000 })).response.docs.filter(isNode),
    doc: async id => (await select(`id:"${id}"`, { rows: 1 })).response.docs[0] ?? null,
    /// Dokumente zu Ids, in Stücken (die URL hat Grenzen).
    byIds: async (ids, onPage) => {
      const out = []
      for (let i = 0; i < ids.length; i += 80) {
        const chunk = ids.slice(i, i + 80)
        out.push(...(await select('*:*', { fq: [`id:(${chunk.map(x => `"${x}"`).join(' OR ')})`], rows: chunk.length, sort: 'id asc' })).response.docs)
        onPage?.(out.length, ids.length)
      }
      return out
    },
    /// Ein Teilbaum vollständig (inklusive Wurzel) — main_path_id enthält die eigene Id.
    subtree: (rootId, onPage) => all(NODES, { fq: [`main_path_id:"${rootId}"`] }, onPage).then(ds => ds.filter(isNode)),
    /// Die Attribut-Definitionen der Quelle: remote_id → { name, section, sectionName }.
    propertyDefs: async () => {
      const defs = {}
      for (const d of await all('type:property', { fl: 'remote_id,name,control__section_id__string,control__section_name__string', rows: 1000, sort: 'id asc' }))
        if (d.remote_id) defs[d.remote_id] = { name: d.name, section: d.control__section_id__string, sectionName: d.control__section_name__string }
      return defs
    },
  }
}

/// Die Werte eines Dokuments für journali: { key, suffix, raw, value } — mehrfach als Liste.
export function ownValues(doc, skip = DEFAULT_SKIP) {
  const out = []
  for (const [k, v] of Object.entries(doc)) {
    const m = /^property__(.+?)__(\w+)$/.exec(k)
    if (!m) continue
    const [, raw, suffix] = m
    if (matches(raw, skip) || SKIP_SUFFIX.some(s => suffix.endsWith(s)) || !TYPES[suffix]) continue
    if (v == null || v === '' || (Array.isArray(v) && !v.some(x => x !== ''))) continue
    out.push({ key: slug(raw), suffix, raw, value: v })
  }
  return out
}

/// Wert(e) als String, wie sie im Journal stehen: Datum als JJJJ-MM-TT, bool als true/false.
export function asStrings(suffix, v) {
  const one = x => typeof x === 'boolean' ? (x ? 'true' : 'false') : (suffix === 'date' || suffix === 'dateTime') ? String(x).slice(0, 10) : String(x)
  return Array.isArray(v) ? v.map(one) : one(v)
}

/// Was ein Knoten an Werten bekommt — nur, was sich von `seen` (eigene Werte: "attr|locale" → Wert) unterscheidet.
export function valueCommands(doc, node, attrs, seen, skip) {
  const lang = doc.lang || 'de'
  const cmds = []
  const put = (attr, value, multiple = false) => {
    const d = attrs.get(attr)
    if (!d) return
    const locale = d.perLocale ? lang : null
    const args = { node, attribute: attr, locale }
    if (multiple || d.multiple) {
      args.values = Array.isArray(value) ? value : [value]
      if (JSON.stringify(seen.get(`${attr}|${locale ?? ''}`)) === JSON.stringify(args.values)) return
    } else {
      args.value = Array.isArray(value) ? value.join(', ') : value
      if (seen.get(`${attr}|${locale ?? ''}`) === args.value) return
    }
    cmds.push({ op: 'attribute.set', args })
  }
  if (doc.name) put('name', doc.name)
  if (doc.description) put('description', doc.description)
  if (roleOf(doc) === 'variant' && doc.product_number) put('sku', doc.product_number)
  for (const { key, suffix, value } of ownValues(doc, skip)) put(key, asStrings(suffix, value), Array.isArray(value))
  return cmds
}

const DEPTH = { group: 0, product: 1, variant: 2 }
const ROLES = ['group', 'product', 'variant']

/// Welche Attribute und Gruppen ein Satz Dokumente braucht: fehlende Definitionen, benutzte Gruppen.
/// `groups` ist key → { activeFrom }. Eine neue Gruppe bekommt „aktiv ab“ = die oberste Rolle, an der
/// eine ihrer Werte vorkommt (nur Varianten → ab Variante); eine vorhandene Gruppe, deren „aktiv ab“
/// tiefer liegt als eine Fundstelle, wird angehoben (`raise`), sonst lehnte der Server den Wert ab.
export function modelNeeds(docs, attrs, groups, pdefs, skip) {
  const newGroups = new Map()   // key → { label, activeFrom }
  const newAttrs = new Map()    // key → Definition für PUT /api/model/attributes
  const used = new Set()
  const counts = new Map()      // key → wie oft ein Wert vorkommt
  const top = new Map()         // Gruppe → oberste Rolle (Tiefe), an der ein Wert vorkommt
  const seen = (gkey, role) => { const d = DEPTH[role] ?? 0; if (!top.has(gkey) || d < top.get(gkey)) top.set(gkey, d) }
  for (const d of docs) for (const { key, suffix, raw } of ownValues(d, skip)) {
    counts.set(key, (counts.get(key) ?? 0) + 1)
    if (attrs.has(key)) { used.add(attrs.get(key).group); seen(attrs.get(key).group, roleOf(d)); continue }
    const p = pdefs[raw]
    const gkey = newAttrs.get(key)?.group ?? slug(p?.section || 'solr')
    seen(gkey, roleOf(d))
    if (newAttrs.has(key)) continue
    if (!groups.has(gkey)) newGroups.set(gkey, { label: p?.sectionName || p?.section || 'solr', activeFrom: null })
    used.add(gkey)
    const [type, multiple, perLocale] = TYPES[suffix]
    const label = p?.name || raw
    newAttrs.set(key, { key, label: { de: label, en: label }, type, group: gkey, axes: perLocale ? ['locale'] : null, multiple })
  }
  for (const [gkey, g] of newGroups) { const t = top.get(gkey) ?? 0; g.activeFrom = t > 0 ? ROLES[t] : null }
  const raise = new Map()       // vorhandene Gruppe → flacheres „aktiv ab“
  for (const [gkey, t] of top) { const g = groups.get(gkey); if (g?.activeFrom && DEPTH[g.activeFrom] > t) raise.set(gkey, t > 0 ? ROLES[t] : null) }
  for (const k of ['name', 'description', 'sku']) if (attrs.has(k)) used.add(attrs.get(k).group)
  used.delete(undefined); used.delete(null); used.delete('')
  return { newGroups, newAttrs, raise, used: [...used].sort(), counts }
}

// ---- Relationen (docs/pflegestruktur.md, 18): *_doc_rel-Felder am Knoten sind einfache Kanten (Typ = Schlüssel),
// component_complex zeigt auf complex_relation-Dokumente — die attributierten Kanten des Typs component
// (Menge, Min/Max/Schritt, Slots …). Beide Enden müssen importiert sein (Kennung solr:<master_id>).
const REL_POINTER = 'component_complex'                     // kein eigener Typ: die Werte zur component-Kante
export const REL_GROUP = 'relation_component'               // Gruppe der Werte an der component-Kante (Saatgut)
export const stripLang = (id, lang) => lang && id.endsWith('_' + lang) ? id.slice(0, -(lang.length + 1)) : id

/// Die Kanten eines Dokuments: [{ type, targets[] (Solr-Ids) }] — Bilder/Dateien/Videos sind keine Relationen.
export function relFields(doc) {
  const out = []
  for (const [k, v] of Object.entries(doc)) {
    const m = /^property__(.+?)__(multi_)?doc_rel$/.exec(k)
    if (!m || m[1] === REL_POINTER) continue
    const targets = (Array.isArray(v) ? v : [v]).filter(Boolean)
    if (targets.length) out.push({ type: slug(m[1]), raw: m[1], targets })
  }
  return out
}
/// Die Ids der complex_relation-Dokumente, auf die ein Knoten zeigt.
export const complexIds = doc => { const v = doc[`property__${REL_POINTER}__multi_doc_rel`]; return Array.isArray(v) ? v : v ? [v] : [] }

/// Werte einer attributierten Kante aus dem complex_relation-Dokument: control__quantity* und direction, dazu property__* (ohne Zeiger).
export function complexValues(cdoc, skip = DEFAULT_SKIP) {
  const out = []
  for (const [k, v] of Object.entries(cdoc)) {
    let m = /^control__(quantity|quantity_min|quantity_max|quantity_step|direction)__(\w+)$/.exec(k)
    if (!m) { m = /^property__(.+?)__(\w+)$/.exec(k); if (!m || m[1] === 'relation') continue }
    const [, raw, suffix] = m
    if (matches(raw, skip) || !TYPES[suffix] || v == null || v === '') continue
    out.push({ key: slug(raw), suffix, raw, value: v })
  }
  return out
}

/// Der Plan für die Relationen eines Satzes Dokumente.
/// byExt: master_id → journali-Id; complexById: Solr-Id → complex_relation-Dokument;
/// existing: Kennung solr → { id, values: Map("attr|locale" → Wert) } der schon vorhandenen Relationen;
/// types/attrs/groups: das Modell. Liefert neue Typen/Attribute, Befehle je Quellknoten, Zahlen je Typ.
export function relationNeeds(docs, byExt, complexById, existing, model) {
  const types = new Map((model.relationTypes ?? []).map(t => [t.key, t]))
  const attrs = new Map(model.attributes.map(a => [a.key, a]))
  const groups = new Set((model.groups ?? []).map(g => g.key))
  const newTypes = new Map(), newAttrs = new Map()
  const perNode = new Map()      // from-Id → Befehle
  const stats = new Map()        // Typ → { neu, gleich, geaendert, zielFehlt }
  const st = t => { if (!stats.has(t)) stats.set(t, { neu: 0, gleich: 0, geaendert: 0, zielFehlt: 0, selbst: 0 }); return stats.get(t) }
  let missingFrom = 0, refNo = 0
  const needGroup = !groups.has(REL_GROUP)
  for (const d of docs) {
    const from = byExt.get(d.master_id)
    const fields = relFields(d)
    if (!fields.length) continue
    if (!from) { missingFrom++; continue }
    const cmds = perNode.get(from) ?? []; perNode.set(from, cmds)
    // attributierte Werte je Ziel (component): aus den complex_relation-Dokumenten dieses Knotens
    const valuesByTarget = new Map(), extByTarget = new Map()
    for (const cid of complexIds(d)) {
      const c = complexById.get(cid); if (!c) continue
      const tgt = (c.property__relation__multi_doc_rel ?? [])[0]; if (!tgt) continue
      valuesByTarget.set(tgt, complexValues(c)); extByTarget.set(tgt, c.master_id)
    }
    for (const f of fields) {
      if (!types.has(f.type) && !newTypes.has(f.type)) newTypes.set(f.type, { key: f.type, label: { de: f.raw, en: f.raw }, reverse: { de: f.raw + ' von', en: f.raw + ' of' }, group: f.type === 'component' ? REL_GROUP : null })
      const s = st(f.type)
      for (const t of f.targets) {
        const toMaster = stripLang(t, d.lang)
        if (toMaster === d.master_id) { s.selbst++; continue }   // die Quelle kennt Kanten auf sich selbst — journali nicht
        const to = byExt.get(toMaster)
        if (!to) { s.zielFehlt++; continue }
        const vals = f.type === 'component' ? (valuesByTarget.get(t) ?? []) : []
        const ext = extByTarget.get(t) ?? `${d.master_id}>${f.type}>${toMaster}`
        // Attribute der Werte: Gruppe relation_component, Typ nach Suffix, keine Achsen
        for (const v of vals) if (!attrs.has(v.key) && !newAttrs.has(v.key)) {
          const [type, multiple] = TYPES[v.suffix]
          newAttrs.set(v.key, { key: v.key, label: { de: v.raw, en: v.raw }, type, group: REL_GROUP, multiple })
        }
        const have = existing.get(ext)
        const rel = have ? have.id : '@r' + (++refNo)
        if (!have) cmds.push({ op: 'relation.create', ref: rel.slice(1), args: { type: f.type, from, to } }, { op: 'relation.external.link', args: { relation: rel, system: SYSTEM, id: ext } })
        let changed = 0
        for (const v of vals) {
          const def = attrs.get(v.key) ?? newAttrs.get(v.key)
          const value = asStrings(v.suffix, v.value)
          const args = { relation: rel, attribute: v.key, locale: null }
          if (def.multiple) args.values = Array.isArray(value) ? value : [value]; else args.value = Array.isArray(value) ? value.join(', ') : value
          const cur = have?.values.get(`${v.key}|`)
          if (have && JSON.stringify(cur) === JSON.stringify(args.values ?? args.value)) continue
          cmds.push({ op: 'relation.attribute.set', args }); changed++
        }
        if (!have) s.neu++; else if (changed) s.geaendert++; else s.gleich++
      }
    }
  }
  return { newTypes, newAttrs, needGroup, perNode, stats, missingFrom }
}
