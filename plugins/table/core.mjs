// Tabellen-Export, der Kern (Basis-Plugin table, Taloan 19.09.2026; der Job dazu ist das Plugin export, es braucht table):
// ein Teilbaum als Tabelle — Spalten id, role, parent, sku, journali_label (Name im Baum, nur Anzeige), status, Achsen,
// dann die Attribute (je Sprache eine Spalte key_de, key_en; ohne Sprachachse key). Genau die Form, die ⇩ Import → Tabelle
// wieder liest. Kein DOM: env = { api: { get }, model }. Browser (browser.js) und Job (plugins/export/job.mjs) benutzen ihn.

export async function build(env, { root, role = '', locales, ownOnly = false, viewKey = '', say }) {
  const { api, model } = env
  const byLocale = new Map(); let cols = [], nodes = []
  for (const l of locales) {
    say?.(`lese ${l} …`)
    const t = await api.get(`/api/nodes/${encodeURIComponent(root)}/table?deep=true&locale=${l}${role ? '&role=' + role : ''}`)
    cols = t.columns; nodes = t.rows; byLocale.set(l, new Map(t.rows.map(r => [r.row.id, r.values])))
  }
  // Spalten der Sicht, sonst alle; Formeln, Vorlagen und Zeilenattribute bleiben draussen (kein Rückweg)
  const v = model.views.find(x => x.key === viewKey)
  if (v) { const order = v.items.flatMap(it => it.order ?? []); const groups = new Map(model.groups.map(g => [g.key, g.attributes])); const wanted = new Set([...order, ...v.items.flatMap(it => it.group ? groups.get(it.group) ?? [] : [])]); cols = cols.filter(c => wanted.has(c.key)).sort((a, b) => (order.indexOf(a.key) + 1 || 999) - (order.indexOf(b.key) + 1 || 999)) }
  cols = cols.filter(c => c.type !== 'rows' && !c.computed)
  const axes = [...new Set(nodes.flatMap(r => Object.keys(r.row.axisValues ?? {})))]
  const columns = [{ key: 'id' }, { key: 'role' }, { key: 'parent' }, { key: 'sku' }, { key: 'journali_label' }, { key: 'status' }, ...axes.map(a => ({ key: 'axis:' + a })),
    ...cols.flatMap(c => c.perLocale ? locales.map(l => ({ key: `${c.key}_${l}`, attr: c.key, locale: l })) : [{ key: c.key, attr: c.key, locale: locales[0] }])]
  const rows = nodes.map(r => columns.map(c => {
    if (c.attr) { const x = byLocale.get(c.locale)?.get(r.row.id)?.[c.attr]; return x == null || (ownOnly && !x.own) ? '' : x.value ?? '' }
    if (c.key.startsWith('axis:')) return r.row.axisValues?.[c.key.slice(5)] ?? ''
    return c.key === 'journali_label' ? r.row.label : c.key === 'parent' ? r.row.parent ?? '' : r.row[c.key] ?? ''
  }))
  return { columns, rows, count: nodes.length }
}

export function toCsv({ columns, rows }) {
  const esc = v => { const s = v == null ? '' : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  return '﻿' + [columns.map(c => c.key).join(';'), ...rows.map(r => r.map(esc).join(';'))].join('\r\n')
}
export function toJson({ columns, rows }) { return JSON.stringify(rows.map(r => Object.fromEntries(columns.map((c, i) => [c.key, r[i] === '' ? null : r[i]]))), null, 1) }
// JSON als Baum (Taloan: „einfach nur eine flache Liste, keine Struktur“): der Teilbaum verschachtelt, je Knoten
// id, role, name, sku, status, axes, attributes (je Sprache verschachtelt: { de, en }), children
export function toJsonTree({ columns, rows }) {
  const byId = new Map()
  for (const r of rows) {
    const o = { id: r[0], role: '', parent: null, name: '', sku: null, status: null, axes: {}, attributes: {}, children: [] }
    columns.forEach((c, i) => {
      const v = r[i] === '' ? null : r[i]
      if (c.attr) { if (c.locale && columns.some(x => x.attr === c.attr && x.locale !== c.locale)) (o.attributes[c.attr] ??= {})[c.locale] = v; else o.attributes[c.attr] = v }
      else if (c.key.startsWith('axis:')) { if (v != null) o.axes[c.key.slice(5)] = v }
      else if (c.key === 'journali_label') o.name = v
      else if (c.key === 'parent') o.parent = v
      else o[c.key] = v
    })
    for (const k of Object.keys(o.attributes)) { const a = o.attributes[k]; if (a && typeof a === 'object' && Object.values(a).every(x => x == null)) delete o.attributes[k]; else if (a == null) delete o.attributes[k] }
    byId.set(o.id, o)
  }
  const roots = []
  for (const o of byId.values()) { const p = o.parent && byId.get(o.parent); if (p) p.children.push(o); else roots.push(o) }
  const strip = o => { delete o.parent; if (!o.children.length) delete o.children; else o.children.forEach(strip); if (!Object.keys(o.axes).length) delete o.axes; return o }
  return JSON.stringify(roots.length === 1 ? strip(roots[0]) : roots.map(strip), null, 1)
}
/// Excel-Arbeitsmappe (SheetJS X aus dem Plugin xlsx): Blatt „Daten“, wahlweise ein Blatt „Legende“ (Zeilen)
export function workbook(X, { columns, rows }, legendRows = null, sheet = 'Daten') {
  const ws = X.utils.aoa_to_sheet([columns.map(c => c.key), ...rows])
  ws['!cols'] = columns.map(c => ({ wch: Math.min(40, Math.max(8, c.key.length + 2)) }))
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, sheet)
  if (legendRows) { const lg = X.utils.aoa_to_sheet(legendRows); lg['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 60 }]; X.utils.book_append_sheet(wb, lg, 'Legende') }
  return wb
}
