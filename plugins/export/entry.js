// Plugin export (Taloan, 17.09.2026: „um Excel und JSON zu testen, brauche ich erst mal die Exporte“):
// ein Teilbaum als Tabelle — CSV, Excel (SheetJS aus dem Plugin xlsx) oder JSON. Spalten: id, role, parent, sku,
// journali_label (Name im Baum, nur Anzeige), Achsen, dann die Attribute (je Sprache eine Spalte key_de, key_en; ohne Sprachachse key). Genau die Form,
// die ⇩ Import → Tabelle wieder liest: id findet den Knoten, Spaltennamen finden die Attribute und die Sprache.
// Quelle: GET /api/nodes/{id}/table?deep=true — je Sprache ein Aufruf; Werte aufgelöst (geerbt zählt) oder nur eigene.

function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v) } for (const k of kids) e.append(k); return e }
const download = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000) }

// ---- Tabelle bauen: { columns: [{key, label}], rows: [[...]] }
async function build(ctx, { root, role, locales, ownOnly, viewKey, say }) {
  const { api, store, tree } = ctx; const model = store.model
  const byLocale = new Map(); let cols = [], nodes = []
  for (const l of locales) {
    say?.(`lese ${l} …`)
    const t = await api.get(`/api/nodes/${encodeURIComponent(root)}/table?deep=true&locale=${l}${role ? '&role=' + role : ''}`)
    cols = t.columns; nodes = t.rows; byLocale.set(l, new Map(t.rows.map(r => [r.row.id, r.values])))
  }
  // Spalten der Sicht, sonst alle; Formeln und Zeilenattribute bleiben draussen (kein Rückweg)
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

function toCsv({ columns, rows }) {
  const esc = v => { const s = v == null ? '' : String(v); return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  return '﻿' + [columns.map(c => c.key).join(';'), ...rows.map(r => r.map(esc).join(';'))].join('\r\n')
}
function toJson({ columns, rows }) { return JSON.stringify(rows.map(r => Object.fromEntries(columns.map((c, i) => [c.key, r[i] === '' ? null : r[i]]))), null, 1) }
// JSON als Baum (Taloan: „einfach nur eine flache Liste, keine Struktur“): der Teilbaum verschachtelt, je Knoten
// id, role, name, sku, status, axes, attributes (je Sprache verschachtelt: { de, en }), children
function toJsonTree({ columns, rows }, rootId) {
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
async function toXlsx(ctx, { columns, rows }, sheet = 'Daten') {
  const X = await import('/plugins/xlsx/xlsx.mjs')
  const ws = X.utils.aoa_to_sheet([columns.map(c => c.key), ...rows])
  ws['!cols'] = columns.map(c => ({ wch: Math.min(40, Math.max(8, c.key.length + 2)) }))
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, sheet)
  return new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

async function mount(root, ctx) {
  const { store, tree } = ctx
  if (!tree.loaded) await tree.load()
  const sett = (await ctx.data.get('settings')) ?? {}
  const state = { root: localStorage.getItem('journali.export.root') || tree.rows.find(r => !r.parent)?.id, role: sett.role ?? '', locales: sett.locales ?? [store.model.masterLocale ?? 'de'], ownOnly: sett.ownOnly ?? false, viewKey: sett.viewKey ?? '', format: sett.format ?? 'xlsx' }
  const remember = () => ctx.data.set('settings', { role: state.role, locales: state.locales, ownOnly: state.ownOnly, viewKey: state.viewKey, format: state.format }).catch(() => {})
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const rootIn = el('input', { type: 'search', placeholder: '🔍 Gruppe oder Produkt', style: 'width:100%', value: tree.byId.get(state.root)?.label ?? '' })
  const pick = el('div', { class: 'picker', style: 'position:absolute;left:4px;top:28px;z-index:5;width:380px;display:none' })
  rootIn.addEventListener('input', () => { const q = rootIn.value.trim().toLowerCase(); pick.innerHTML = ''; const hits = q ? tree.rows.filter(r => r.role !== 'variant' && (r.label.toLowerCase().includes(q) || r.id.includes(q))).slice(0, 12) : []; for (const r of hits) pick.append(el('div', { class: 'pick', onmousedown: e => { e.preventDefault(); state.root = r.id; rootIn.value = r.label; pick.style.display = 'none'; localStorage.setItem('journali.export.root', r.id) } }, `${r.role === 'group' ? '▣' : '▦'} ${r.label}`, el('span', { class: 'muted mono', style: 'margin-left:auto;font-size:11px' }, r.id))); pick.style.display = hits.length ? 'block' : 'none' })
  rootIn.addEventListener('blur', () => setTimeout(() => pick.style.display = 'none', 150))
  const roleSel = el('select', { style: 'width:100%', onchange: e => { state.role = e.target.value; remember() } }, el('option', { value: '' }, 'alle Knoten darunter'), el('option', { value: 'group' }, '▣ nur Gruppen'), el('option', { value: 'product' }, '▦ nur Produkte'), el('option', { value: 'variant' }, '◆ nur Varianten')); roleSel.value = state.role
  const locBox = el('div', { class: 'chips' }); for (const l of store.model.locales) { const on = () => state.locales.includes(l.code); const c = el('span', { class: 'view-chip' + (on() ? ' on' : ''), onclick: () => { state.locales = on() ? state.locales.filter(x => x !== l.code) : [...state.locales, l.code]; c.className = 'view-chip' + (on() ? ' on' : ''); remember() } }, l.code); locBox.append(c) }
  const viewSel = el('select', { style: 'width:100%', onchange: e => { state.viewKey = e.target.value; remember() } }, el('option', { value: '' }, '◫ alle Attribute'), ...store.model.views.map(v => el('option', { value: v.key }, `◫ ${v.label?.de || v.key} (${v.level})`))); viewSel.value = state.viewKey
  const ownCb = el('input', { type: 'checkbox' }); ownCb.checked = state.ownOnly; ownCb.addEventListener('change', () => { state.ownOnly = ownCb.checked; remember() })
  const fmtSel = el('select', { style: 'width:100%', onchange: e => { state.format = e.target.value; remember() } }, el('option', { value: 'xlsx' }, 'Excel (.xlsx)'), el('option', { value: 'csv' }, 'CSV (; UTF-8, Excel-tauglich)'), el('option', { value: 'jsonraw' }, 'JSON Rohdaten (wiederherstellbar)'), el('option', { value: 'json' }, 'JSON ausgewertet (Baum)'), el('option', { value: 'jsonflat' }, 'JSON ausgewertet (flache Liste)')); fmtSel.value = state.format
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  const preview = el('div', { class: 'scroll', style: 'flex:1' })
  async function run(downloadIt) {
    if (!state.root) return; if (!state.locales.length) { store.toast('mindestens eine Sprache'); return }
    // Rohdaten (Taloan): eigene Werte je Achse, Skripte als Skripte — genau das, was /nodes/import wieder einspielt
    if (state.format === 'jsonraw') {
      try {
        const raw = await api.get(`/api/nodes/${encodeURIComponent(state.root)}/export?deep=true`)
        const count = (n => { let c = 1; for (const k of n.children ?? []) c += count(k); return c })
        const total = count(raw.node)
        preview.innerHTML = ''; preview.append(el('pre', { class: 'mono', style: 'padding:8px;font-size:11px;white-space:pre-wrap' }, JSON.stringify(raw, null, 1).slice(0, 6000) + (total > 30 ? '\n…' : '')))
        say(`${total} Knoten roh · Modell: ${raw.model.groups.length} Gruppen, ${raw.model.attributes.length} Attribute, ${raw.model.lists.length} Listen, ${raw.model.units.length} Einheiten`)
        if (!downloadIt) return
        download(new Blob([JSON.stringify(raw, null, 1)], { type: 'application/json' }), `${tree.byId.get(state.root)?.label ?? 'export'}-rohdaten`.replace(/[^\w.-]+/g, '_') + '.json')
        store.toast(`⇪ ${total} Knoten als Rohdaten gesichert`, 'ok')
      } catch (e) { say('✗ ' + e.message); store.toast(e.message) }
      return
    }
    try {
      const t = await build(ctx, { ...state, say })
      say(`${t.count} Zeilen · ${t.columns.length} Spalten`)
      preview.innerHTML = ''
      const tbl = el('table', { class: 'grid', style: 'width:auto' }, el('thead', {}, el('tr', {}, ...t.columns.map(c => el('th', { title: c.attr ? `${c.attr} · ${c.locale}` : c.key }, c.key)))))
      const tb = el('tbody'); for (const r of t.rows.slice(0, 200)) tb.append(el('tr', {}, ...r.map(v => el('td', { class: 'muted', style: 'max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', title: String(v ?? '') }, String(v ?? '').replace(/<[^>]+>/g, ' ').slice(0, 80))))); tbl.append(tb); preview.append(tbl)
      if (t.rows.length > 200) preview.append(el('div', { class: 'muted', style: 'padding:8px' }, `… ${t.rows.length - 200} weitere Zeilen in der Datei`))
      if (!downloadIt) return
      const name = `${tree.byId.get(state.root)?.label ?? 'export'}-${state.role || 'alle'}-${state.locales.join('-')}`.replace(/[^\w.-]+/g, '_')
      if (state.format === 'csv') download(new Blob([toCsv(t)], { type: 'text/csv;charset=utf-8' }), name + '.csv')
      else if (state.format === 'json') download(new Blob([toJsonTree(t, state.root)], { type: 'application/json' }), name + '.json')
      else if (state.format === 'jsonflat') download(new Blob([toJson(t)], { type: 'application/json' }), name + '.json')
      else download(await toXlsx(ctx, t), name + '.xlsx')
      store.toast(`⇪ ${t.count} Zeilen exportiert`)
    } catch (e) { say('✗ ' + e.message); store.toast(e.message) }
  }
  // Rohdaten zurück (Taloan: exportieren → löschen → importieren → alles wie vorher)
  async function importRaw() {
    const input = el('input', { type: 'file', accept: '.json,application/json' })
    input.addEventListener('change', async () => {
      const file = input.files[0]; if (!file) return
      let raw; try { raw = JSON.parse(await file.text()) } catch { store.toast('keine JSON-Datei'); return }
      const node = raw?.node ?? raw, modelPart = raw?.model ?? null
      if (!node?.id || !node?.role || !Array.isArray(node.values)) { store.toast('Das ist kein Rohdaten-Export (id, role, values fehlen) — ausgewertete Exporte lassen sich nicht einspielen, sie würden Formeln überschreiben'); return }
      const count = (n => { let c = 1; for (const k of n.children ?? []) c += count(k); return c }); const total = count(node)
      const parentOk = node.parent && tree.byId.has(node.parent)
      const parent = parentOk ? node.parent : state.root
      const missing = modelPart ? [...modelPart.groups.filter(g => !store.model.groups.some(x => x.key === g.key)).map(g => '▤ ' + g.key), ...modelPart.attributes.filter(a => !store.model.attributes.some(x => x.key === a.key)).map(a => a.key)] : []
      const ok = await ctx.dialog.confirm({ title: `${total} Knoten aus ${file.name} einspielen?`, warn: `${node.role === 'group' ? '▣' : node.role === 'product' ? '▦' : '◆'} ${node.name ?? node.id} → unter ${tree.byId.get(parent)?.label ?? 'Wurzel'}${parentOk ? '' : ' (der frühere Vater fehlt — der gewählte Teilbaum wird das Ziel)'}`, list: missing.length ? [`Neu im Modell (${missing.length}):`, ...missing] : [], ok: '⇩ Einspielen' })
      if (!ok) return
      try {
        say('spiele ein …')
        const r = await api.post('/api/nodes/import', { node, parent, model: modelPart })
        say(`${r.created} neu · ${r.restored} zurückgeholt · ${r.updated} angeglichen · ${r.model} Modellteile · ${r.entries} Einträge (Stapel ${r.batch})${r.errors?.length ? ' · ' + r.errors.length + ' Fehler: ' + r.errors[0] : ''}`)
        if (r.model) store.reloadModel?.()
        store.toast(`⇩ ${r.entries} Einträge — ${r.created} neu, ${r.restored} zurückgeholt, ${r.updated} angeglichen`, r.errors?.length ? 'error' : 'ok')
        await store.poll(true); await tree.load()
      } catch (e) { say('✗ ' + e.message); store.toast(e.message) }
    })
    input.click()
  }
  const row = (label, ...kids) => el('tr', {}, el('td', { class: 'attr', style: 'color:var(--muted);white-space:nowrap;padding-left:8px;width:84px' }, label), el('td', { style: 'padding:2px 4px;position:relative' }, ...kids))
  const step = t => el('tr', { class: 'step' }, el('td', { colspan: '2', class: 'step-band', style: 'display:table-cell;height:24px' }, t))
  root.append(
    el('div', { class: 'toolbar' }, el('h1', {}, '⇪ Export'), el('span', { class: 'grow' }), status),
    el('table', { class: 'grid', style: 'width:100%;border-bottom:1px solid var(--line)' }, el('tbody', {},
      step('1 · Was'), row('Teilbaum', rootIn, pick), row('Knoten', roleSel), row('Sprachen', locBox), row('Attribute', viewSel), row('Werte', el('label', {}, ownCb, ' nur eigene Werte (geerbte leer lassen)')),
      step('2 · Wie'), row('Format', fmtSel), row('', el('span', { class: 'row', style: 'display:flex;gap:6px' }, el('button', { onclick: () => run(false) }, 'Vorschau'), el('button', { class: 'primary', onclick: () => run(true) }, '⇪ herunterladen'), el('span', { class: 'sep' }, '·'), el('button', { onclick: importRaw, title: 'Rohdaten-JSON (aus „JSON Rohdaten“) einspielen: vorhandene Knoten angleichen, zurückgezogene zurückholen, fehlende anlegen — ein Stapel, rückgängig im Journal' }, '⇩ Rohdaten importieren …'))))),
    el('div', { class: 'step-band' }, '3 · Vorschau ', el('span', { class: 'muted' }, '· erste 200 Zeilen')),
    preview)
  return () => {}
}

// ---- Excel am Knoten (Taloan, 17.09.: Rechtsklick auf Gruppe/Produkt → Vorlage, Varianten/Produkte exportieren, Excel importieren):
// dieselben Spalten in allen drei — id, sku, Achsen, dann die Attribute, die hier eine Ebene tiefer gelten (childColumns).
// Blatt „Legende“ erklärt jede Spalte (Label, Typ, Pflicht, Einheit, Listenwerte). Der Import am selben Knoten ist streng.
async function nodeColumns(ctx, nodeId) {
  const { api, store, tree } = ctx; if (!tree.loaded) await tree.load()
  const row = tree.byId.get(nodeId); const n = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}`)
  const childRole = ctx.mapper.childRoleOf(row, tree.kids(nodeId))
  const locales = store.model.locales.map(l => l.code)
  return { row, childRole, columns: ctx.mapper.childColumns(store.model, n, childRole, row.axes ?? [], locales) }
}
function legend(ctx, columns) {
  const model = ctx.store.model
  const rows = [['Spalte', 'Label', 'Typ', 'Pflicht', 'Einheit', 'Sprache', 'Werte / Hinweis']]
  for (const c of columns) {
    const d = c.def ?? (c.attr ? model.attributes.find(a => a.key === c.attr) : null)
    const list = d?.list ? model.lists.find(l => l.key === d.list) : null
    rows.push([c.key, d?.label?.de ?? '', d?.type ?? '', d?.required && Object.keys(d.required).length ? 'ja' : '', d?.unit ?? '', c.locale ?? '', c.note ?? (list ? list.values.map(v => `${v.value} = ${v.label?.de ?? ''}`).join(' | ') : d?.type === 'boolean' ? 'ja / nein' : d?.pattern ? 'Muster: ' + d.pattern : '')])
  }
  return rows
}
async function nodeWorkbook(ctx, nodeId, withData) {
  const X = await import('/plugins/xlsx/xlsx.mjs')
  const { row, childRole, columns } = await nodeColumns(ctx, nodeId)
  let data = []
  if (withData) {
    const { api, store } = ctx; const locales = store.model.locales.map(l => l.code); const byLocale = new Map(); let nodes = []
    for (const l of locales) { const t = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}/table?locale=${l}&role=${childRole}`); nodes = t.rows; byLocale.set(l, new Map(t.rows.map(r => [r.row.id, r.values]))) }
    data = nodes.map(r => columns.map(c => c.key === 'id' ? r.row.id : c.key === 'sku' ? r.row.sku ?? '' : c.key.startsWith('axis:') ? r.row.axisValues?.[c.attr] ?? '' : (byLocale.get(c.locale ?? locales[0])?.get(r.row.id)?.[c.attr]?.value ?? '')))
  }
  const ws = X.utils.aoa_to_sheet([columns.map(c => c.key), ...data])
  ws['!cols'] = columns.map(c => ({ wch: Math.min(40, Math.max(10, c.key.length + 2)) }))
  const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Daten')
  const lg = X.utils.aoa_to_sheet(legend(ctx, columns)); lg['!cols'] = [{ wch: 24 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 60 }]
  X.utils.book_append_sheet(wb, lg, 'Legende')
  const name = `${row.label}-${childRole}${withData ? '' : '-vorlage'}`.replace(/[^\w.-]+/g, '_') + '.xlsx'
  download(new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name)
  ctx.store.toast(`⇪ ${name}: ${columns.length} Spalten${withData ? `, ${data.length} Zeilen` : ''}`)
}

export default {
  views: [{ path: 'export', label: 'Export', icon: '⇪', mount }],
  nodeActions: [
    { label: (r, below) => `Excel: Vorlage für ${below}`, icon: '⇪', roles: ['group', 'product'], run: (id, ctx) => nodeWorkbook(ctx, id, false).catch(e => ctx.store.toast(e.message)) },
    { label: (r, below) => `Excel: ${below} exportieren`, icon: '⇪', roles: ['group', 'product'], run: (id, ctx) => nodeWorkbook(ctx, id, true).catch(e => ctx.store.toast(e.message)) },
    { label: (r, below) => `Excel: ${below} importieren …`, icon: '⇩', roles: ['group', 'product'], run: (id, ctx) => ctx.go?.(`/import/table?node=${encodeURIComponent(id)}`) },
    { label: 'Exportieren … (Teilbaum)', icon: '⇪', roles: ['group', 'product'], run(nodeId, ctx) { localStorage.setItem('journali.export.root', nodeId); ctx.go?.('/p/export/export') } },
    { label: (r, below) => `JSON: Rohdaten sichern (mit ${below})`, icon: '⇪', roles: ['group', 'product', 'variant'], async run(nodeId, ctx) { try { const raw = await ctx.api.get(`/api/nodes/${encodeURIComponent(nodeId)}/export?deep=true`); download(new Blob([JSON.stringify(raw, null, 1)], { type: 'application/json' }), `${ctx.tree.byId.get(nodeId)?.label ?? nodeId}-rohdaten`.replace(/[^\w.-]+/g, '_') + '.json') } catch (e) { ctx.store.toast(e.message) } } },
  ],
  build, toCsv, toJson, toJsonTree, toXlsx, nodeWorkbook,
}
