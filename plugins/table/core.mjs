// Tabellen-Export, der Kern (Basis-Plugin table):
// ein Teilbaum als Tabelle — Spalten id, role, parent, journali_label (Name im Baum, nur Anzeige), status, Achsen, eindeutige Attribute (Schlüssel) zuerst,
// dann die Attribute (je Sprache eine Spalte key_de, key_en; ohne Sprachachse key). Genau die Form, die ⇩ Import → Tabelle
// wieder liest. Kein DOM: env = { api: { get }, model }. Browser (browser.js) und Job (plugins/export/job.mjs) benutzen ihn.

// channel: Werte auf der Kanalachse dieses Kanals (Ausleitung); only: nur diese Knoten-Ids (Set), extra: zusätzliche Spalten je Zeile ({ key, of: rowId → Wert })
// at: Journalnummer — die Tabelle von damals (eingefrorener Publikationsstand)
// relations: true — die Relationen des Teilbaums mitlesen (nur für JSON als Baum oder Liste; eine Tabelle hat dafür keine Spalte)
export async function build(env, { root, role = '', locales, ownOnly = false, viewKey = '', channel = '', only = null, extra = [], at = null, relations = false, say }) {
  const { api, model } = env
  const byLocale = new Map(); let cols = [], nodes = []
  // Mit Sicht: nur ihre Attribute vom Server holen (vorher kamen alle Spalten und die Sicht filterte danach)
  const v = model.views.find(x => x.key === viewKey)
  const sichtAttr = v ? [...new Set([...v.items.flatMap(it => it.order ?? []), ...v.items.flatMap(it => it.group ? model.groups.find(g => g.key === it.group)?.attributes ?? [] : [])])] : []
  // Seitenweise und knapp (sparse: nur Zellen mit Wert) — ein Zweig mit 17 782 Zeilen × 783 Spalten waren in einem Stück 1 GB JSON (04.10.2026)
  for (const l of locales) {
    say?.(`lese ${l} …`)
    const url = `/api/nodes/${encodeURIComponent(root)}/table?deep=true&sparse=true&locale=${l}${channel ? '&channel=' + encodeURIComponent(channel) : ''}${role ? '&role=' + role : ''}${at ? '&at=' + at : ''}${sichtAttr.length && sichtAttr.length <= 300 ? '&attributes=' + encodeURIComponent(sichtAttr.join(',')) : ''}`
    const werte = new Map(); const zeilen = []
    let skip = 0
    for (;;) {
      const t = await api.get(`${url}&take=1000&skip=${skip}`)
      cols = t.columns
      for (const r of t.rows) { if (only && !only.has(r.row.id)) continue; werte.set(r.row.id, r.values); zeilen.push(r) }
      if (t.next == null || t.next <= skip) break
      skip = t.next
      say?.(`lese ${l} … ${skip}/${t.total}`)
    }
    nodes = zeilen; byLocale.set(l, werte)
  }
  // Spalten der Sicht, sonst alle; Formeln, Vorlagen und Zeilenattribute bleiben draussen (kein Rückweg)
  if (v) { const order = v.items.flatMap(it => it.order ?? []); const groups = new Map(model.groups.map(g => [g.key, g.attributes])); const wanted = new Set([...order, ...v.items.flatMap(it => it.group ? groups.get(it.group) ?? [] : [])]); cols = cols.filter(c => wanted.has(c.key)).sort((a, b) => (order.indexOf(a.key) + 1 || 999) - (order.indexOf(b.key) + 1 || 999)) }
  cols = cols.filter(c => c.type !== 'rows' && !c.computed)
  cols = [...cols.filter(c => c.unique), ...cols.filter(c => !c.unique)]   // Schlüssel (eindeutig) zuerst — sie finden beim Import den Knoten wieder
  const axes = [...new Set(nodes.flatMap(r => Object.keys(r.row.axisValues ?? {})))]
  // journali_root: die Wurzel des Baums — Id + Wurzel macht die Zeile über Datenbanken hinweg eineindeutig; der Import prüft beides
  let rootId = root
  // die Wurzel aus dem Pfad des Knotens (vorher der ganze Baum, nur dafür); ancestors stehen vom Vater aufwärts, die Wurzel ist die letzte
  try { const n = await api.get(`/api/nodes/${encodeURIComponent(root)}`); const anc = n.ancestors ?? []; if (anc.length) rootId = anc[anc.length - 1].id } catch {}
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
  // je Knoten-Id die Relationen (ausgehend und eingehend), nur was es gibt
  let rel = null
  if (relations) { say?.('lese Relationen …'); try { rel = await api.get(`/api/nodes/${encodeURIComponent(root)}/relations/tree?deep=true`) } catch { rel = null } }
  return { columns, rows, count: nodes.length, ...(rel ? { relations: rel } : {}) }
}

/// Das Blatt „Relationen“ (30.09.2026): eine Zeile je Relation — Von, Typ, Nach, dann je Relationsattribut eine Spalte und, wo das Attribut eine
/// Einheit hat, daneben `<attribut>_einheit` (nur zum Lesen: der Wert steht in der Einheit des Attributs). Ein Wert mit Sprache steht in
/// `<attribut>_<sprache>`; Werte mit Kanal hat das Blatt nicht. Jede Relation steht einmal, bei dem Knoten, von dem sie ausgeht — eine, die von
/// ausserhalb des Teilbaums kommt, fehlt. `teile`: Ergebnisse von build() mit relations; mehrere Wurzeln ergeben ein Blatt.
export const RELATIONEN_SPALTEN = { von: 'journali_von', vonName: 'journali_von_name', typ: 'journali_typ', nach: 'journali_nach', nachName: 'journali_nach_name' }
export const EINHEIT = '_einheit'
export function relationenTabelle(teile) {
  const R = RELATIONEN_SPALTEN
  const gesehen = new Set(), zeilen = [], attribute = new Map()   // attribut → { einheit: bool, sprachen: Set }
  const text = v => Array.isArray(v) ? v.join(',') : v == null ? '' : v
  for (const t of teile) {
    if (!t.relations) continue
    const idAt = t.columns.findIndex(c => c.sys === 'id' || c.key === 'id'), nameAt = t.columns.findIndex(c => c.sys === 'label')
    const name = new Map(t.rows.map(r => [r[idAt], nameAt >= 0 ? r[nameAt] : '']))
    for (const [von, liste] of Object.entries(t.relations)) {
      if (!name.has(von)) continue
      for (const r of liste) {
        if (r.direction !== 'out') continue
        const key = `${von}\u0001${r.type}\u0001${r.other.id}`
        if (gesehen.has(key)) continue
        gesehen.add(key)
        const werte = {}
        for (const [a, w] of Object.entries(r.values ?? {})) {
          const a_ = attribute.get(a) ?? { einheit: false, sprachen: new Set() }; attribute.set(a, a_)
          for (const e of Array.isArray(w) ? w : [w]) {
            if (e.channel) continue
            const spalte = e.locale ? `${a}_${e.locale}` : a
            if (e.locale) a_.sprachen.add(e.locale)
            werte[spalte] = text(e.value)
            if (e.unit) { a_.einheit = true; werte[a + EINHEIT] = e.unit }
          }
        }
        zeilen.push({ von, vonName: name.get(von) ?? '', typ: r.type, nach: r.other.id, nachName: r.other.label ?? '', werte })
      }
    }
  }
  if (!zeilen.length) return null
  const spalten = [R.von, R.vonName, R.typ, R.nach, R.nachName]
  for (const [a, x] of attribute) {
    if (x.sprachen.size) spalten.push(...[...x.sprachen].map(l => `${a}_${l}`)); else spalten.push(a)
    if (x.einheit) spalten.push(a + EINHEIT)
  }
  const rows = zeilen.map(z => spalten.map(k => k === R.von ? z.von : k === R.vonName ? z.vonName : k === R.typ ? z.typ : k === R.nach ? z.nach : k === R.nachName ? z.nachName : z.werte[k] ?? ''))
  return { columns: spalten.map(k => ({ key: k })), rows }
}

export function toCsv({ columns, rows }) {
  const esc = v => { const s = v == null ? '' : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  return '﻿' + [columns.map(c => c.key).join(';'), ...rows.map(r => r.map(esc).join(';'))].join('\r\n')
}
// Liste: je Knoten ein Objekt mit den Spalten; Relationen (falls gelesen) als eigene Eigenschaft `relations`
export function toJson({ columns, rows, relations }) {
  const idAt = columns.findIndex(c => c.sys === 'id' || c.key === 'id')
  return JSON.stringify(rows.map(r => {
    const o = Object.fromEntries(columns.map((c, i) => [c.key, r[i] === '' ? null : r[i]]))
    const rel = relations?.[r[idAt >= 0 ? idAt : 0]]
    if (rel?.length) o.relations = rel
    return o
  }), null, 1)
}
// JSON als Baum: der Teilbaum verschachtelt, je Knoten
// id, role, name, status, axes, attributes (je Sprache verschachtelt: { de, en }; die Schlüssel stehen darin), children
export function toJsonTree({ columns, rows, relations }) {
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
    if (relations?.[o.id]?.length) o.relations = relations[o.id]
    byId.set(o.id, o)
  }
  const roots = []
  for (const o of byId.values()) { const p = o.parent && byId.get(o.parent); if (p) p.children.push(o); else roots.push(o) }
  const strip = o => { delete o.parent; if (!o.children.length) delete o.children; else o.children.forEach(strip); if (!Object.keys(o.axes).length) delete o.axes; return o }
  return JSON.stringify(roots.length === 1 ? strip(roots[0]) : roots.map(strip), null, 1)
}
/// Excel nimmt höchstens so viele Zeichen in eine Zelle. Ein längerer Wert liess bisher den ganzen Export
/// scheitern („Text length must not exceed 32767 characters“) — jetzt wird gekürzt und gesagt, wie oft.
export const ZellenGrenze = 32767

/// Kürzt jede Zelle auf die Grenze. Liefert die Zeilen und wie viele Zellen gekürzt wurden; die Hälfte des
/// Kennzeichens steht am Ende, damit man im Blatt sieht, dass dort etwas fehlt.
export function kuerzeZellen(rows) {
  let gekuerzt = 0
  const raus = rows.map(r => r.map(v => {
    if (typeof v !== 'string' || v.length <= ZellenGrenze) return v
    gekuerzt++
    return v.slice(0, ZellenGrenze - 1) + '\u2026'
  }))
  return { rows: raus, gekuerzt }
}

/// Excel-Arbeitsmappe (SheetJS X aus dem Plugin xlsx): Blatt „Daten“, wahlweise ein Blatt „Legende“ (Zeilen).
/// Zu lange Werte werden gekürzt; <c>wb.gekuerzt</c> sagt, wie viele Zellen es betraf.
export function workbook(X, { columns, rows }, legendRows = null, sheet = 'Daten', relationen = null) {
  const gek = kuerzeZellen(rows)
  rows = gek.rows
  const ws = X.utils.aoa_to_sheet([columns.map(c => c.key), ...rows])
  ws['!cols'] = columns.map(c => ({ wch: Math.min(40, Math.max(8, c.key.length + 2)), hidden: !!c.hidden }))   // parent/role/status ausgeblendet, Id sichtbar
  // Pflicht und Achsen am Spaltenkopf kennzeichnen: SheetJS schreibt
  // keine Farben, aber Kommentare — rotes Dreieck in Excel, Text beim Zeigen; die Legende sagt es ausserdem
  columns.forEach((c, i) => { const req = c.def?.required; const note = c.note ?? (req && typeof req === 'object' && Object.keys(req).length ? 'Pflicht: ' + Object.entries(req).map(([ch, l]) => `${ch} ${l.join(',')}`).join(' · ') : req ? 'Pflicht' : null); if (!note) return; const ref = X.utils.encode_cell({ r: 0, c: i }); ws[ref] ??= { t: 's', v: c.key }; ws[ref].c = [{ a: 'journali', t: note }]; ws[ref].c.hidden = true })
  // Komfort: Autofilter über Kopf und Daten — Sortieren und Filtern in Excel sofort da; eine echte „Tabelle“ (ListObject)
  // schreibt die freie SheetJS-Version nicht, Excel: Einfügen → Tabelle auf dem Bereich
  if (columns.length) ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, rows.length), c: columns.length - 1 } }) }
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, sheet)
  wb.gekuerzt = gek.gekuerzt
  if (legendRows) { const lg = X.utils.aoa_to_sheet(legendRows); lg['!cols'] = [{ wch: 8 }, { wch: 24 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 60 }]; lg['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, legendRows.length - 1), c: legendRows[0].length - 1 } }) }; X.utils.book_append_sheet(wb, lg, 'Legende') }
  if (relationen) {
    const rl = X.utils.aoa_to_sheet([relationen.columns.map(c => c.key), ...relationen.rows])
    rl['!cols'] = relationen.columns.map(c => ({ wch: Math.min(40, Math.max(10, c.key.length + 2)) }))
    rl['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, relationen.rows.length), c: relationen.columns.length - 1 } }) }
    X.utils.book_append_sheet(wb, rl, 'Relationen')
  }
  return wb
}
