// Tabellen-Export, der Kern (Basis-Plugin table):
// ein Teilbaum als Tabelle — Spalten id, role, parent, journali_label (Name im Baum, nur Anzeige), status, Achsen, eindeutige Attribute (Schlüssel) zuerst,
// dann die Attribute (je Sprache eine Spalte key_de, key_en; ohne Sprachachse key). Genau die Form, die ⇩ Import → Tabelle
// wieder liest. Kein DOM: env = { api: { get }, model }. Browser (browser.js) und Job (plugins/export/job.mjs) benutzen ihn.

// channel: Werte auf der Kanalachse dieses Kanals (Ausleitung); only: nur diese Knoten-Ids (Set), extra: zusätzliche Spalten je Zeile ({ key, of: rowId → Wert })
// at: Journalnummer — die Tabelle von damals (eingefrorener Publikationsstand)
export async function build(env, { root, role = '', locales, ownOnly = false, viewKey = '', channel = '', only = null, extra = [], at = null, say }) {
  const { api, model } = env
  const byLocale = new Map(); let cols = [], nodes = []
  for (const l of locales) {
    say?.(`lese ${l} …`)
    const t = await api.get(`/api/nodes/${encodeURIComponent(root)}/table?deep=true&locale=${l}${channel ? '&channel=' + encodeURIComponent(channel) : ''}${role ? '&role=' + role : ''}${at ? '&at=' + at : ''}`)
    cols = t.columns; nodes = only ? t.rows.filter(r => only.has(r.row.id)) : t.rows; byLocale.set(l, new Map(t.rows.map(r => [r.row.id, r.values])))
  }
  // Spalten der Sicht, sonst alle; Formeln, Vorlagen und Zeilenattribute bleiben draussen (kein Rückweg)
  const v = model.views.find(x => x.key === viewKey)
  if (v) { const order = v.items.flatMap(it => it.order ?? []); const groups = new Map(model.groups.map(g => [g.key, g.attributes])); const wanted = new Set([...order, ...v.items.flatMap(it => it.group ? groups.get(it.group) ?? [] : [])]); cols = cols.filter(c => wanted.has(c.key)).sort((a, b) => (order.indexOf(a.key) + 1 || 999) - (order.indexOf(b.key) + 1 || 999)) }
  cols = cols.filter(c => c.type !== 'rows' && !c.computed)
  cols = [...cols.filter(c => c.unique), ...cols.filter(c => !c.unique)]   // Schlüssel (eindeutig) zuerst — sie finden beim Import den Knoten wieder
  const axes = [...new Set(nodes.flatMap(r => Object.keys(r.row.axisValues ?? {})))]
  // journali_root: die Wurzel des Baums — Id + Wurzel macht die Zeile über Datenbanken hinweg eineindeutig; der Import prüft beides
  let rootId = root
  try { const all = await api.get('/api/tree'); const byId = new Map((Array.isArray(all) ? all : all.rows ?? []).map(r => [r.id, r])); for (let p = byId.get(root)?.parent; p; p = byId.get(p)?.parent) rootId = p } catch {}
  // eigene Spalten: journali_<feld>_<wurzel> — die Wurzel steckt im Spaltenkopf. Sichtbar und vorne, nicht ausgeblendet („sonst sieht der
  // Anwender nicht mal, was er tut“ — kopierte Zeilen nehmen die Id mit) und nicht ganz rechts („bei 180 Spalten kommt er da nie hin“); der Kommentar am Kopf erklärt es
  // die Ausweg (21.09.): nur die Id-Spalte sichtbar — sie erklärt, was der Anwender tut; parent, role, status ausgeblendet (Kopieren ändert sie nicht)
  const sysCol = (sys, note) => ({ key: `journali_${sys}_${rootId}`, sys, note, hidden: sys !== 'id' && sys !== 'label' })
  const columns = [sysCol('id', 'journali-Id des Knotens — nicht ändern. Zeile kopiert? Dann diese Zelle leeren, sonst erkennt der Import die Kopie an den Werten'), sysCol('parent', 'Elternteil (journali-Id) — nicht ändern'), sysCol('role', 'Knotentyp — nur zum Lesen'), sysCol('status', 'Status — nur zum Lesen'),
    sysCol('label', 'Name im Baum — nur zum Lesen'), ...extra.map(x => ({ key: x.key, of: x.of })), ...axes.map(a => ({ key: 'axis:' + a })),
    ...cols.flatMap(c => c.perLocale ? locales.map(l => ({ key: `${c.key}_${l}`, attr: c.key, locale: l })) : [{ key: c.key, attr: c.key, locale: locales[0] }])]
  const rows = nodes.map(r => columns.map(c => {
    if (c.attr) { const x = byLocale.get(c.locale)?.get(r.row.id)?.[c.attr]; return x == null || (ownOnly && !x.own) ? '' : x.value ?? '' }
    if (c.of) return c.of(r.row.id) ?? ''
    if (c.key.startsWith('axis:')) return r.row.axisValues?.[c.key.slice(5)] ?? ''
    return c.sys === 'label' ? r.row.label : c.sys === 'parent' ? r.row.parent ?? '' : c.sys ? r.row[c.sys] ?? '' : r.row[c.key] ?? ''
  }))
  return { columns, rows, count: nodes.length }
}

export function toCsv({ columns, rows }) {
  const esc = v => { const s = v == null ? '' : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  return '﻿' + [columns.map(c => c.key).join(';'), ...rows.map(r => r.map(esc).join(';'))].join('\r\n')
}
export function toJson({ columns, rows }) { return JSON.stringify(rows.map(r => Object.fromEntries(columns.map((c, i) => [c.key, r[i] === '' ? null : r[i]]))), null, 1) }
// JSON als Baum: der Teilbaum verschachtelt, je Knoten
// id, role, name, status, axes, attributes (je Sprache verschachtelt: { de, en }; die Schlüssel stehen darin), children
export function toJsonTree({ columns, rows }) {
  const byId = new Map()
  for (const r of rows) {
    const o = { id: r[columns.findIndex(c => c.sys === 'id' || c.key === 'id')] ?? r[0], role: '', parent: null, name: '', status: null, axes: {}, attributes: {}, children: [] }
    columns.forEach((c, i) => {
      const v = r[i] === '' ? null : r[i]
      if (c.attr) { if (c.locale && columns.some(x => x.attr === c.attr && x.locale !== c.locale)) (o.attributes[c.attr] ??= {})[c.locale] = v; else o.attributes[c.attr] = v }
      else if (c.key.startsWith('axis:')) { if (v != null) o.axes[c.key.slice(5)] = v }
      else if (c.sys === 'label') o.name = v
      else if (c.sys === 'parent') o.parent = v
      else if (c.sys) o[c.sys] = v
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
  ws['!cols'] = columns.map(c => ({ wch: Math.min(40, Math.max(8, c.key.length + 2)), hidden: !!c.hidden }))   // parent/role/status ausgeblendet, Id sichtbar
  // Pflicht und Achsen am Spaltenkopf kennzeichnen: SheetJS schreibt
  // keine Farben, aber Kommentare — rotes Dreieck in Excel, Text beim Zeigen; die Legende sagt es ausserdem
  columns.forEach((c, i) => { const req = c.def?.required; const note = c.note ?? (req && typeof req === 'object' && Object.keys(req).length ? 'Pflicht: ' + Object.entries(req).map(([ch, l]) => `${ch} ${l.join(',')}`).join(' · ') : req ? 'Pflicht' : null); if (!note) return; const ref = X.utils.encode_cell({ r: 0, c: i }); ws[ref] ??= { t: 's', v: c.key }; ws[ref].c = [{ a: 'journali', t: note }]; ws[ref].c.hidden = true })
  // Komfort: Autofilter über Kopf und Daten — Sortieren und Filtern in Excel sofort da; eine echte „Tabelle“ (ListObject)
  // schreibt die freie SheetJS-Fassung nicht, Excel: Einfügen → Tabelle auf dem Bereich
  if (columns.length) ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, rows.length), c: columns.length - 1 } }) }
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, sheet)
  if (legendRows) { const lg = X.utils.aoa_to_sheet(legendRows); lg['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 60 }]; lg['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, legendRows.length - 1), c: legendRows[0].length - 1 } }) }; X.utils.book_append_sheet(wb, lg, 'Legende') }
  return wb
}
