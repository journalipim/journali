// Plugin dq (Taloan, 17.09.2026): Datenqualität. Prüft einen Teilbaum gegen Regeln und zeigt die Funde als Liste
// (Schwere, Knoten, Attribut, Meldung) mit Sprung zum Knoten. Eingebaute Regeln unten; weitere Regeln liefern
// andere Plugins über `checks` (ctx.checks). Welche Regeln laufen, steht im Journal (ctx.data „settings“).
// Quelle: GET /api/nodes/{id}/table?deep=true — alle Nachfahren mit aufgelösten Werten, je Sprache ein Aufruf.

const RULES = [
  { key: 'required', label: 'Pflichtattribut fehlt', severity: 'error',
    run({ row, values, columns, locale, master }) { return columns.filter(c => c.required && (c.perLocale || locale === master) && Object.values(c.required).some(ls => ls.includes('*') || ls.includes(locale)) && (values[c.key]?.value == null || values[c.key].value === '')).map(c => ({ attribute: c.key, message: c.perLocale ? `Pflicht (${locale}), leer` : 'Pflicht, leer' })) } },
  { key: 'pattern', label: 'Muster verletzt', severity: 'error',
    run({ values, columns }) { const out = []; for (const c of columns) { const v = values[c.key]?.value; if (c.pattern && v) { try { if (!new RegExp(c.pattern).test(v)) out.push({ attribute: c.key, message: `„${v}“ passt nicht zu ${c.pattern}` }) } catch {} } } return out } },
  { key: 'number', label: 'Zahl nicht lesbar', severity: 'error',
    run({ values, columns }) { return columns.filter(c => (c.type === 'integer' || c.type === 'decimal') && values[c.key]?.value && isNaN(Number(values[c.key].value))).map(c => ({ attribute: c.key, message: `„${values[c.key].value}“ ist keine Zahl` })) } },
  { key: 'enum', label: 'Wert nicht in der Liste', severity: 'error',
    run({ values, columns, model }) { const out = []; for (const c of columns) { if (c.type !== 'enum' || !values[c.key]?.value) continue; const list = model.lists.find(l => l.key === c.list); if (!list) continue; for (const v of String(values[c.key].value).split(',')) if (!list.values.some(x => x.value === v.trim())) out.push({ attribute: c.key, message: `„${v.trim()}“ nicht in ${c.list}` }) } return out } },
  { key: 'whitespace', label: 'Leerzeichen am Rand / doppelt', severity: 'warn',
    run({ values, columns }) { return columns.filter(c => c.type === 'text' && values[c.key]?.own && typeof values[c.key].value === 'string' && (values[c.key].value !== values[c.key].value.trim() || /\s{2,}/.test(values[c.key].value))).map(c => ({ attribute: c.key, message: 'führende/abschliessende/doppelte Leerzeichen' })) } },
  { key: 'emptyhtml', label: 'HTML ohne Inhalt', severity: 'warn',
    run({ values, columns }) { return columns.filter(c => c.type === 'html' && values[c.key]?.own && values[c.key].value && !values[c.key].value.replace(/<[^>]+>|&nbsp;|\s/g, '')).map(c => ({ attribute: c.key, message: 'nur Tags, kein Text' })) } },
  { key: 'sku', label: 'SKU fehlt / doppelt', severity: 'error',
    run({ row, all }) { if (row.role !== 'variant') return []; if (!row.sku) return [{ attribute: 'sku', message: 'Variante ohne SKU' }]; const n = all.filter(r => r.row.sku === row.sku).length; return n > 1 ? [{ attribute: 'sku', message: `SKU ${row.sku} ${n}× vergeben` }] : [] } },
  { key: 'untranslated', label: 'Übersetzung fehlt / gleich wie Master', severity: 'warn',
    run({ values, columns, locale, master, byLocale, row }) { if (locale === master) return []; const out = []; for (const c of columns) { if (!c.perLocale || c.type !== 'text' && c.type !== 'html') continue; const m = byLocale.get(master)?.get(row.id)?.[c.key]?.value; const v = values[c.key]?.value; if (m && !v) out.push({ attribute: c.key, message: `${locale}: fehlt (${master} hat „${String(m).slice(0, 40)}“)` }); else if (m && v && m === v && String(m).length > 3) out.push({ attribute: c.key, message: `${locale} gleich wie ${master}` }) } return out } },
  { key: 'formula', label: 'Formel/Vorlage ohne Ergebnis', severity: 'warn',
    run({ values, columns }) { return columns.filter(c => c.computed && values[c.key]?.value == null).map(c => ({ attribute: c.key, message: 'kein Ergebnis — ein gelesener Wert fehlt oder Skript fehlt' })) } },
  { key: 'status', label: 'Aktiv ohne Freigabe-Chance', severity: 'info',
    run({ row, values, columns, locale }) { if (row.status !== 'active' || row.role !== 'variant') return []; const miss = columns.filter(c => c.required && Object.values(c.required).some(ls => ls.includes('*') || ls.includes(locale)) && !values[c.key]?.value).length; return miss ? [{ attribute: null, message: `aktiv, aber ${miss} Pflichtwerte (${locale}) fehlen` }] : [] } },
]

function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v) } for (const k of kids) e.append(k); return e }

async function check(ctx, rootId, rules, say) {
  const { api, store } = ctx; const model = store.model
  const master = model.masterLocale ?? model.locales[0]?.code ?? 'de'
  const locales = model.locales.map(l => l.code)
  const byLocale = new Map(); let columns = [], all = []
  for (const l of locales) {
    say(`lese ${l} …`)
    const t = await api.get(`/api/nodes/${encodeURIComponent(rootId)}/table?deep=true&locale=${l}`)
    columns = t.columns; all = t.rows
    byLocale.set(l, new Map(t.rows.map(r => [r.row.id, r.values])))
  }
  const findings = []
  const extra = (ctx.checks ?? []).map(c => ({ key: `${c.key}:${c.check}`, label: c.label, severity: c.severity ?? 'warn', run: c.run }))
  for (const l of locales) for (const r of all) {
    const values = byLocale.get(l).get(r.row.id)
    const cols = columns.filter(c => !(r.inactive ?? []).includes(c.key))   // nur, was an diesem Knoten gilt
    for (const rule of [...RULES, ...extra]) {
      if (!rules.has(rule.key)) continue
      if (l !== master && !['required', 'untranslated', 'status', 'pattern'].includes(rule.key) && !rule.perLocale) continue   // sprachunabhängige Regeln einmal
      let out = []
      try { out = rule.run({ row: r.row, values, columns: cols, locale: l, master, byLocale, all, model }) ?? [] } catch (e) { out = [{ attribute: null, message: `Regel ${rule.key}: ${e.message}` }] }
      for (const f of out) findings.push({ rule: rule.key, label: rule.label, severity: f.severity ?? rule.severity, locale: l, node: r.row, attribute: f.attribute, message: f.message })
    }
  }
  return { findings, nodes: all.length, columns: columns.length }
}

async function mount(root, ctx) {
  const { store, tree } = ctx
  if (!tree.loaded) await tree.load()
  const sett = (await ctx.data.get('settings')) ?? { rules: RULES.map(r => r.key) }
  const rules = new Set(sett.rules)
  const state = { root: localStorage.getItem('journali.dq.root') || tree.rows.find(r => !r.parent)?.id, result: null, filter: 'all', q: '' }
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const rootIn = el('input', { type: 'search', placeholder: '🔍 Teilbaum (Gruppe/Produkt)', style: 'width:260px', value: tree.byId.get(state.root)?.label ?? '' })
  const pick = el('div', { class: 'picker', style: 'position:absolute;z-index:5;width:380px;display:none' })
  rootIn.addEventListener('input', () => { const q = rootIn.value.trim().toLowerCase(); pick.innerHTML = ''; const hits = q ? tree.rows.filter(r => r.role !== 'variant' && (r.label.toLowerCase().includes(q) || r.id.includes(q))).slice(0, 12) : []; for (const r of hits) pick.append(el('div', { class: 'pick', onmousedown: e => { e.preventDefault(); state.root = r.id; rootIn.value = r.label; pick.style.display = 'none'; localStorage.setItem('journali.dq.root', r.id) } }, `${r.role === 'group' ? '▣' : '▦'} ${r.label}`)); pick.style.display = hits.length ? 'block' : 'none' })
  rootIn.addEventListener('blur', () => setTimeout(() => pick.style.display = 'none', 150))
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  const list = el('div', { class: 'scroll', style: 'flex:1' })
  const summary = el('div', { class: 'toolbar', style: 'gap:10px;font-size:12px' })
  const ruleBox = el('div', { class: 'chips', style: 'padding:4px 8px;border-bottom:1px solid var(--line)' })
  const allRules = [...RULES, ...(ctx.checks ?? []).map(c => ({ key: `${c.key}:${c.check}`, label: `${c.label} (${c.key})`, severity: c.severity ?? 'warn' }))]
  for (const r of allRules) { const cb = el('input', { type: 'checkbox' }); cb.checked = rules.has(r.key); cb.addEventListener('change', async () => { cb.checked ? rules.add(r.key) : rules.delete(r.key); await ctx.data.set('settings', { rules: [...rules] }) }); ruleBox.append(el('label', { class: 'chip', title: r.key, style: 'cursor:pointer' }, cb, ` ${sev(r.severity)} ${r.label}`)) }
  function sev(s) { return s === 'error' ? '✗' : s === 'warn' ? '⚠' : 'ℹ' }
  function draw() {
    list.innerHTML = ''; summary.innerHTML = ''
    const res = state.result; if (!res) return
    const f = res.findings
    const count = s => f.filter(x => x.severity === s).length
    summary.append(el('span', { class: 'neg' }, `✗ ${count('error')}`), el('span', { class: 'warn' }, `⚠ ${count('warn')}`), el('span', { class: 'muted' }, `ℹ ${count('info')}`), el('span', { class: 'muted' }, `· ${res.nodes} Knoten, ${res.columns} Attribute · ${new Set(f.map(x => x.node.id)).size} Knoten betroffen`))
    for (const s of ['all', 'error', 'warn', 'info']) summary.append(el('span', { class: 'view-chip' + (state.filter === s ? ' on' : ''), onclick: () => { state.filter = s; draw() } }, s === 'all' ? 'alle' : sev(s)))
    const byRule = new Map(); for (const x of f) byRule.set(x.rule, (byRule.get(x.rule) ?? 0) + 1)
    summary.append(el('span', { class: 'muted' }, [...byRule].map(([k, n]) => `${k} ${n}`).join(' · ')))
    summary.append(el('span', { class: 'grow' }), el('button', { class: 'x', onclick: exportCsv, title: 'Funde als CSV' }, '⇪ CSV'))
    const q = state.q.toLowerCase()
    const rows = f.filter(x => (state.filter === 'all' || x.severity === state.filter) && (!q || x.node.label.toLowerCase().includes(q) || (x.attribute ?? '').includes(q) || x.message.toLowerCase().includes(q)))
    const tbl = el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:30px' }, ''), el('th', { style: 'width:300px' }, 'Knoten'), el('th', { style: 'width:60px' }, 'SKU'), el('th', { style: 'width:40px' }, '🗣'), el('th', { style: 'width:160px' }, 'Attribut'), el('th', {}, 'Meldung'), el('th', { style: 'width:160px' }, 'Regel'))))
    const tb = el('tbody'); tbl.append(tb)
    for (const x of rows.slice(0, 2000)) tb.append(el('tr', {}, el('td', { class: x.severity === 'error' ? 'neg' : x.severity === 'warn' ? 'warn' : 'muted' }, sev(x.severity)),
      el('td', {}, el('a', { href: `/tree/${x.node.id}`, onclick: e => { e.preventDefault(); ctx.go?.(`/tree/${x.node.id}`) ?? (location.href = `/tree/${x.node.id}`) }, title: x.node.id }, `${x.node.role === 'variant' ? '◆' : x.node.role === 'product' ? '▦' : '▣'} ${x.node.label}`)),
      el('td', { class: 'mono muted' }, x.node.sku ?? ''), el('td', { class: 'muted' }, x.locale), el('td', { class: 'mono' }, x.attribute ?? ''), el('td', {}, x.message), el('td', { class: 'muted' }, x.label)))
    if (rows.length > 2000) tb.append(el('tr', {}, el('td', { colspan: '7', class: 'muted' }, `… ${rows.length - 2000} weitere — filtern`)))
    list.append(tbl)
    if (!rows.length) list.append(el('div', { class: 'empty' }, f.length ? 'nichts in diesem Filter' : '✓ keine Funde'))
  }
  function exportCsv() {
    const esc = v => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
    const lines = ['schwere;knoten;id;sku;sprache;attribut;meldung;regel', ...state.result.findings.map(x => [x.severity, x.node.label, x.node.id, x.node.sku ?? '', x.locale, x.attribute ?? '', x.message, x.rule].map(esc).join(';'))]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = 'datenqualitaet.csv'; a.click()
  }
  async function run() { if (!state.root) return; say('prüfe …'); try { state.result = await check(ctx, state.root, rules, say); say(`${state.result.findings.length} Funde`); draw() } catch (e) { say('✗ ' + e.message); store.toast(e.message) } }
  const qIn = el('input', { type: 'search', placeholder: 'filtern', style: 'width:160px', oninput: e => { state.q = e.target.value; draw() } })
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, '✓ Datenqualität'), el('span', { style: 'position:relative' }, rootIn, pick), el('button', { class: 'primary', onclick: run }, '▶ prüfen'), qIn, el('span', { class: 'grow' }), status), ruleBox, summary, list)
  return () => {}
}

export default {
  views: [{ path: 'check', label: 'Datenqualität', icon: '✓', mount }],
  nodeActions: [{ label: 'Datenqualität prüfen', icon: '✓', run(nodeId, ctx) { localStorage.setItem('journali.dq.root', nodeId); ctx.go?.('/p/dq/check') ?? (location.href = '/p/dq/check') } }],
  rules: RULES,
}
