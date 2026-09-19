// Export mit Vorlagen (Taloan, 19.09.2026: „viele gehen nach Standard, verschiedene Versionen, und Kunden haben eigene
// Definitionen“ — also Vorlagen als Daten statt ein Plugin je Format). Dieselbe Schreibweise wie die Vorlagen-Attribute
// (Template.cs): {feld}, Zusätze {feld|unit|2|dec2|upper|plain|xml|raw|max80}, [ … ] fällt weg, wenn ein Platzhalter darin leer ist.
// Dazu Schleifen {#name} … {/name} über products, children, media, features, rows.<attribut>, locales — und {^name} … {/name}
// für „wenn leer“. Werte werden je Ausgabeart entkommen (xml: &<>"; csv: Anführungszeichen; json: JSON-String) — {x|raw} lässt sie roh.
// Wörtlich: \{ \[ \] \\ — ein { ohne Namen dahinter ({"id": …) bleibt ohnehin Text, JSON-Listen brauchen \[ … \].
// Kein DOM: env = { api: { get }, model, tree: { rows, byId } } — Browser (Vorschau) und Job (job.mjs) benutzen denselben Kern.

const ESC = {
  xml: s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  csv: s => /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s,
  json: s => JSON.stringify(s).slice(1, -1),
  text: s => s,
}

/// Vorlage rendern. ctx: Objekt mit Feldern und Listen; mode: xml | csv | json | text
export function render(template, ctx, mode = 'text', locale = 'de') {
  const esc = ESC[mode] ?? ESC.text
  const fmtNum = (v, d) => { const n = Number(String(v).replace(',', '.')); return isNaN(n) ? String(v) : n.toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }) }
  const get = (scope, path) => { let o = scope; for (const p of path.split('.')) { if (o == null) return undefined; o = o[p] } return o }
  const value = (scope, expr) => {
    const [path, ...mods] = expr.split('|')
    let v = get(scope, path); let raw = false; let unit = null
    if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v) { unit = v.unit ?? null; v = v.value }
    if (Array.isArray(v)) v = v.map(x => x?.value ?? x).join(', ')
    if (v == null || v === '') return ''
    let s = String(v)
    for (const m of mods) {
      if (/^\d$/.test(m)) s = fmtNum(s, Number(m))
      else if (/^dec\d$/.test(m)) { const n = Number(String(s).replace(',', '.')); if (!isNaN(n)) s = n.toFixed(Number(m.slice(3))) }
      else if (m === 'unit') s = unit ? s + ' ' + unit : s
      else if (m === 'upper') s = s.toUpperCase()
      else if (m === 'lower') s = s.toLowerCase()
      else if (m === 'capitalize') s = s.charAt(0).toUpperCase() + s.slice(1)
      else if (m === 'plain') s = s.replace(/<[^>]+>/g, ' ').replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' })[e]).replace(/\s+/g, ' ').trim()
      else if (m === 'raw') raw = true
      else if (m === 'xml') s = ESC.xml(s)
      else if (m === 'trim') s = s.trim()
      else if (/^max\d+$/.test(m)) s = s.slice(0, Number(m.slice(3)))
    }
    return raw ? s : esc(s)
  }
  // Blöcke: {#list}…{/list}, {^list}…{/list}; Optionales [ … ]; Platzhalter {expr}
  function run(tpl, scope) {
    let out = ''; let i = 0
    while (i < tpl.length) {
      const ch = tpl[i]
      if (ch === '\\' && i + 1 < tpl.length) { out += tpl[i + 1]; i += 2; continue }
      if (ch === '{' && (tpl[i + 1] === '#' || tpl[i + 1] === '^')) {
        const neg = tpl[i + 1] === '^'; const close = tpl.indexOf('}', i); const name = tpl.slice(i + 2, close).trim()
        const end = findEnd(tpl, close + 1, name); const inner = tpl.slice(close + 1, end)
        let list = get(scope, name)
        if (list && !Array.isArray(list)) list = [list]
        if (neg) { if (!list || !list.length) out += run(inner, scope) }
        else for (const [idx, item] of (Array.isArray(list) ? list : []).entries()) out += run(inner, { ...scope, ...(typeof item === 'object' && item ? item : { value: item }), _index: idx + 1, _first: idx === 0, _last: idx === list.length - 1, _parent: scope })
        i = end + name.length + 3; continue
      }
      if (ch === '{' && /[A-Za-z_]/.test(tpl[i + 1] ?? '')) { const close = tpl.indexOf('}', i); if (close < 0) { out += ch; i++; continue } out += value(scope, tpl.slice(i + 1, close).trim()); i = close + 1; continue }
      if (ch === '[') {
        const end = findBracket(tpl, i); const inner = tpl.slice(i + 1, end)
        // weg, wenn ein Platzhalter im Abschnitt leer ist
        let empty = false
        let probe = inner
        for (let guard = 0; guard < 20; guard++) {   // Schleifen herausnehmen, äußere zuerst; {#x} mit leerer Liste → weg
          const next = probe.replace(/\{([#^])\s*([^}]+?)\s*\}[\s\S]*?\{\/\2\}/, (_, kind, name) => { if (kind === '#') { const l = get(scope, name); if (l == null || l === false || l === '' || (Array.isArray(l) && !l.length)) empty = true } return '' })
          if (next === probe) break; probe = next
        }
        probe.replace(/\{[#^/][^}]*\}/g, '').replace(/\{([A-Za-z_][^}]*)\}/g, (_, e) => { if (value(scope, e) === '') empty = true; return '' })
        if (!empty) out += run(inner, scope)
        i = end + 1; continue
      }
      out += ch; i++
    }
    return out
  }
  function findEnd(tpl, from, name) {   // passendes {/name}, verschachtelt
    const open = new RegExp('\\{[#^]\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\}', 'g'); const closeTag = '{/' + name + '}'
    let depth = 1; let pos = from
    while (depth > 0) { const c = tpl.indexOf(closeTag, pos); if (c < 0) return tpl.length; open.lastIndex = pos; const o = open.exec(tpl); if (o && o.index < c) { depth++; pos = o.index + o[0].length } else { depth--; if (depth === 0) return c; pos = c + closeTag.length } }
    return tpl.length
  }
  function findBracket(tpl, from) { let d = 0; for (let j = from; j < tpl.length; j++) { if (tpl[j] === '\\') { j++; continue } if (tpl[j] === '[') d++; else if (tpl[j] === ']') { d--; if (d === 0) return j } } return tpl.length }
  return run(template, ctx).replace(/[ \t]+\n/g, '\n')
}

/// Kontext eines Knotens: Felder aus der Zuordnung (f.*), alle Attribute (attr.*: { value, unit, label }), Medien, Zeilen, Kinder
export async function contextOf(env, id, { locale, mapping = {}, depth = 0, withChildren = true, withMedia = true } = {}) {
  const { api, model, tree } = env
  const n = await api.get(`/api/nodes/${encodeURIComponent(id)}`)
  const defs = new Map(model.attributes.map(a => [a.key, a]))
  const key = v => `${v.attribute}|${v.locale ?? ''}|${v.channel ?? ''}|${v.row ?? ''}`
  const own = new Map(n.values.map(v => [key(v), v]))
  const anc = n.ancestors.map(a => new Map(a.values.map(v => [key(v), v])))
  const pick = v => v.values ? v.values.join(', ') : v.value
  const look = (m, k, loc, row = '') => m.get(`${k}|${loc}||${row}`) ?? (loc ? m.get(`${k}|||${row}`) : null) ?? null
  const val = (d, row = '') => {
    const loc = d.perLocale ? locale : ''
    const o = look(own, d.key, loc, row)
    let v = d.type === 'formula' ? n.computed?.find(c => c.attribute === d.key && (c.locale ?? null) === (d.perLocale ? locale : null))?.value ?? null : (o ? pick(o) : null)
    if (v == null && d.inheritable && !row) for (const m of anc) { const x = look(m, d.key, loc); if (x) { v = pick(x); break } }
    if (v != null && d.type === 'enum') { const list = model.lists.find(x => x.key === d.list); v = String(v).split(',').map(x => list?.values.find(y => y.value === x.trim())?.label?.[locale] ?? x.trim()).join(', ') }
    return v
  }
  const attr = {}; const label = {}
  for (const d of model.attributes) { if (d.type === 'rows') continue; const v = val(d); label[d.key] = d.label?.[locale] || d.label?.de || d.key; attr[d.key] = v == null ? null : { value: v, unit: d.unit ?? null, label: label[d.key], key: d.key } }
  // Zeilen vermehrbarer Attribute: rows.<attribut> = [{ <spalte>: { value, unit } }]
  const rows = {}
  for (const d of model.attributes.filter(a => a.type === 'rows')) rows[d.key] = (n.rows?.[d.key] ?? []).map(rid => Object.fromEntries((d.columns ?? []).map(c => { const cd = defs.get(c); return [c, cd ? { value: val(cd, rid), unit: cd.unit ?? null, label: cd.label?.[locale] || c } : null] })))
  const row = tree.byId.get(id)
  const crumbs = []; for (let p = row?.parent; p; p = tree.byId.get(p)?.parent) crumbs.unshift({ id: p, name: tree.byId.get(p)?.label ?? p })
  const f = {}; for (const [field, ak] of Object.entries(mapping)) f[field] = ak && attr[ak] ? attr[ak].value : (ak === '$sku' ? row?.sku : ak === '$name' ? row?.label : ak === '$id' ? id : null)
  let media = []
  if (withMedia) { try { const rels = await api.get(`/api/nodes/${encodeURIComponent(id)}/relations`); media = [...(rels.out ?? []), ...(rels.inherited ?? [])].filter(r => r.other?.role == null && r.other?.mime && !(r.values ?? []).some(v => v.attribute === 'stop' && v.value === 'true')).map(r => ({ id: r.other.id, name: r.other.name, mime: r.other.mime, url: `${env.server ?? ''}/api/media/${r.other.id}/file`, type: r.type, isImage: !!r.other.isImage })) } catch { } }
  // ETIM & Co.: features = [{ code, attr, unit? }] aus dem Profil → Merkmale mit Wert aus dem Attribut
  const features = (env.features ?? []).map(fe => { const a = attr[fe.attr]; return a ? { code: fe.code, value: a.value, unit: fe.unit ?? a.unit ?? null, label: a.label } : null }).filter(Boolean)
  const ctx = { id, role: n.role, sku: row?.sku ?? '', name: row?.label ?? n.name ?? id, status: n.status, parentId: row?.parent ?? null, features, path: crumbs, pathText: crumbs.map(c => c.name).join(' / '), locale, attr, label, rows, f, media, axes: n.axisValues ?? {}, today: new Date().toISOString().slice(0, 10), now: new Date().toISOString() }
  if (withChildren && depth === 0) { const kids = tree.kids(id); ctx.children = []; for (const k of kids) ctx.children.push(await contextOf(env, k.id, { locale, mapping, depth: 1, withChildren: false, withMedia })) }
  return ctx
}

/// Welche Felder {f.x} und Kopfvariablen {x} eine Vorlage braucht — für die Zuordnung in der Ansicht
export function needs(template) {
  const fields = new Set(), vars = new Set()
  const known = new Set(['products', 'groups', 'children', 'media', 'features', 'rows', 'path', 'count', 'locale', 'languageCode', 'today', 'now', 'rootName', 'id', 'role', 'sku', 'name', 'status', 'parentId', 'pathText', 'attr', 'label', 'f', 'axes', '_index', '_first', '_last', '_parent', 'value', 'url', 'mime', 'code', 'unit', 'isImage', 'type', 'parent'])
  for (const m of template.matchAll(/\{([A-Za-z_][\w.]*)(?:\|[^}]*)?\}/g)) { const p = m[1]; if (p.startsWith('f.')) fields.add(p.slice(2)); else if (!p.includes('.') && !known.has(p)) vars.add(p) }
  return { fields: [...fields], vars: [...vars] }
}

/// Alle Knoten eines Teilbaums (nach Rolle) als Produktkontexte + Kopf
export async function build(env, { root, role = 'product', locale, mapping = {}, vars = {}, features = [], limit = 0, say }) {
  env = { ...env, features }
  const { tree } = env
  const under = id => { for (let p = tree.byId.get(id)?.parent; p; p = tree.byId.get(p)?.parent) if (p === root) return true; return false }
  let targets = tree.rows.filter(r => (root ? r.id === root || under(r.id) : true) && (role === 'all' || r.role === role))
  if (limit > 0) targets = targets.slice(0, limit)
  const products = []
  for (const [i, r] of targets.entries()) { say?.(`${i + 1}/${targets.length} ${r.label}`); products.push(await contextOf(env, r.id, { locale, mapping })) }
  const groups = tree.rows.filter(r => r.role === 'group' && (root ? r.id === root || under(r.id) : true)).map(g => ({ id: g.id, name: g.label, parent: g.parent && (g.id === root ? null : g.parent), children: tree.kids(g.id).filter(k => k.role === 'group').map(k => ({ id: k.id, name: k.label })) }))
  return { ...vars, products, groups, count: products.length, locale, languageCode: { de: 'deu', en: 'eng', fr: 'fra', it: 'ita', es: 'spa', nl: 'nld' }[locale] ?? locale, today: new Date().toISOString().slice(0, 10), now: new Date().toISOString(), rootName: tree.byId.get(root)?.label ?? '' }
}
