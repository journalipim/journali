// Client für einen Solr-Kern (infolox/prodexa-Export) — plugins/import-tools/solr/README.md.
// Solr schickt keinen CORS-Kopf, antwortet aber auf json.wrf mit JSONP: ein <script>-Tag
// je Anfrage, nur Lesen. Der journali-Server bleibt unbeteiligt; die Abbildung ist
// dieselbe wie im Skript solr_import.py.
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

export function solr(core) {
  const base = core.replace(/\/+$/, '')
  const NODES = '(type:group OR type:product OR type:productVariant)'
  async function select(q, { fq = [], fl = '*', rows = 500, sort = 'sort_nr asc,id asc', cursor = null } = {}) {
    const p = new URLSearchParams({ q, fl, rows, sort })
    for (const f of fq) p.append('fq', f)
    if (cursor) p.set('cursorMark', cursor)
    const d = await jsonp(`${base}/select?${p}`)
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
    status: () => jsonp(`${base}/admin/ping`).catch(() => null),
    count: async () => (await select('*:*', { rows: 0 })).response.numFound,
    /// Wurzeln des Baums: Baumknoten ohne Eltern.
    roots: async () => (await select(NODES, { fq: ['main_parent_id:""'], rows: 200 })).response.docs.filter(isNode),
    children: async id => (await select(NODES, { fq: [`main_parent_id:"${id}"`], rows: 1000 })).response.docs.filter(isNode),
    doc: async id => (await select(`id:"${id}"`, { rows: 1 })).response.docs[0] ?? null,
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
