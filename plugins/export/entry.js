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
  const fmtSel = el('select', { style: 'width:100%', onchange: e => { state.format = e.target.value; remember() } }, el('option', { value: 'xlsx' }, 'Excel (.xlsx)'), el('option', { value: 'csv' }, 'CSV (; UTF-8, Excel-tauglich)'), el('option', { value: 'json' }, 'JSON (Liste von Objekten)')); fmtSel.value = state.format
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  const preview = el('div', { class: 'scroll', style: 'flex:1' })
  async function run(downloadIt) {
    if (!state.root) return; if (!state.locales.length) { store.toast('mindestens eine Sprache'); return }
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
      else if (state.format === 'json') download(new Blob([toJson(t)], { type: 'application/json' }), name + '.json')
      else download(await toXlsx(ctx, t), name + '.xlsx')
      store.toast(`⇪ ${t.count} Zeilen exportiert`)
    } catch (e) { say('✗ ' + e.message); store.toast(e.message) }
  }
  const row = (label, ...kids) => el('tr', {}, el('td', { class: 'attr', style: 'color:var(--muted);white-space:nowrap;padding-left:8px;width:84px' }, label), el('td', { style: 'padding:2px 4px;position:relative' }, ...kids))
  const step = t => el('tr', { class: 'step' }, el('td', { colspan: '2', class: 'step-band', style: 'display:table-cell;height:24px' }, t))
  root.append(
    el('div', { class: 'toolbar' }, el('h1', {}, '⇪ Export'), el('span', { class: 'grow' }), status),
    el('table', { class: 'grid', style: 'width:100%;border-bottom:1px solid var(--line)' }, el('tbody', {},
      step('1 · Was'), row('Teilbaum', rootIn, pick), row('Knoten', roleSel), row('Sprachen', locBox), row('Attribute', viewSel), row('Werte', el('label', {}, ownCb, ' nur eigene Werte (geerbte leer lassen)')),
      step('2 · Wie'), row('Format', fmtSel), row('', el('span', { class: 'row', style: 'display:flex;gap:6px' }, el('button', { onclick: () => run(false) }, 'Vorschau'), el('button', { class: 'primary', onclick: () => run(true) }, '⇪ herunterladen'))))),
    el('div', { class: 'step-band' }, '3 · Vorschau ', el('span', { class: 'muted' }, '· erste 200 Zeilen')),
    preview)
  return () => {}
}

export default {
  views: [{ path: 'export', label: 'Export', icon: '⇪', mount }],
  nodeActions: [{ label: 'Exportieren …', icon: '⇪', run(nodeId, ctx) { localStorage.setItem('journali.export.root', nodeId); ctx.go?.('/p/export/export') } }],
  build, toCsv, toJson, toXlsx,
}
