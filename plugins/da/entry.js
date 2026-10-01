// Basis-Plugin da: ✓ Datenqualität — Grundfunktion der Gruppe Datenanalyse und zugleich ihr Container:
// dpp, ppwr hängen daran (requires: ["da"]) und liefern Regeln über checks. Prüft einen Teilbaum gegen Regeln und zeigt die Befunde als Liste (Schwere, Knoten,
// Attribut, Meldung) mit Sprung zum Knoten. Eingebaute Regeln unten; weitere Regeln liefern Plugins über `checks`
// (ctx.checks). Welche Regeln laufen, steht im Journal (ctx.data „settings“ unter plugin:dq).
// Quelle: GET /api/nodes/{id}/table?deep=true — alle Nachfahren mit aufgelösten Werten, je Sprache ein Aufruf.

const t_ = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, i) => p?.[i] ?? m)   // Oberflächensprache: spät gebunden, im Test ohne Fenster ladbar
const skuOf = row => row.keys?.sku ?? row.sku ?? null

const RULES = [
  { key: 'required', label: t_('Pflichtattribut fehlt'), severity: 'error',
    run({ row, values, columns, locale, master }) { return columns.filter(c => c.required && (c.perLocale || locale === master) && Object.values(c.required).some(ls => ls.includes('*') || ls.includes(locale)) && (values[c.key]?.value == null || values[c.key].value === '')).map(c => ({ attribute: c.key, message: c.perLocale ? `Pflicht (${locale}), leer` : 'Pflicht, leer' })) } },
  { key: 'pattern', label: t_('Muster verletzt'), severity: 'error',
    run({ values, columns }) { const out = []; for (const c of columns) { const v = values[c.key]?.value; if (c.pattern && v) { try { if (!new RegExp(c.pattern).test(v)) out.push({ attribute: c.key, message: t_('„{0}“ passt nicht zu {1}', [v, c.pattern]) }) } catch {} } } return out } },
  { key: 'number', label: t_('Zahl nicht lesbar'), severity: 'error',
    run({ values, columns }) { return columns.filter(c => (c.type === 'integer' || c.type === 'decimal') && values[c.key]?.value && isNaN(Number(values[c.key].value))).map(c => ({ attribute: c.key, message: t_('„{0}“ ist keine Zahl', [values[c.key].value]) })) } },
  { key: 'enum', label: t_('Wert nicht in der Liste'), severity: 'error',
    run({ values, columns, model }) { const out = []; for (const c of columns) { if (c.type !== 'enum' || !values[c.key]?.value) continue; const list = model.lists.find(l => l.key === c.list); if (!list) continue; for (const v of String(values[c.key].value).split(',')) if (!list.values.some(x => x.value === v.trim())) out.push({ attribute: c.key, message: t_('„{0}“ nicht in {1}', [v.trim(), c.list]) }) } return out } },
  { key: 'whitespace', label: t_('Leerzeichen am Rand / doppelt'), severity: 'warn',
    run({ values, columns }) { return columns.filter(c => c.type === 'text' && values[c.key]?.own && typeof values[c.key].value === 'string' && (values[c.key].value !== values[c.key].value.trim() || /\s{2,}/.test(values[c.key].value))).map(c => ({ attribute: c.key, message: t_('führende/abschliessende/doppelte Leerzeichen') })) } },
  { key: 'emptyhtml', label: t_('HTML ohne Inhalt'), severity: 'warn',
    run({ values, columns }) { return columns.filter(c => c.type === 'html' && values[c.key]?.own && values[c.key].value && !values[c.key].value.replace(/<[^>]+>|&nbsp;|\s/g, '')).map(c => ({ attribute: c.key, message: t_('nur Tags, kein Text') })) } },
  { key: 'sku', label: t_('SKU fehlt / doppelt'), severity: 'error',
    // Die SKU steht in row.keys (eindeutige Kennungen je Zeile, Tree.KeysOf), nicht als row.sku — sonst „Variante ohne SKU“ bei jeder Variante (24.09.2026)
    run({ row, all }) { if (row.role !== 'variant') return []; const sku = skuOf(row); if (!sku) return [{ attribute: 'sku', message: t_('Variante ohne SKU') }]; const n = all.filter(r => skuOf(r.row) === sku).length; return n > 1 ? [{ attribute: 'sku', message: `SKU ${sku} ${n}× vergeben` }] : [] } },
  { key: 'untranslated', label: t_('Übersetzung fehlt / gleich wie Master'), severity: 'warn',
    run({ values, columns, locale, master, byLocale, row }) { if (locale === master) return []; const out = []; for (const c of columns) { if (!c.perLocale || c.type !== 'text' && c.type !== 'html') continue; const m = byLocale.get(master)?.get(row.id)?.[c.key]?.value; const v = values[c.key]?.value; if (m && !v) out.push({ attribute: c.key, message: `${locale}: fehlt (${master} hat „${String(m).slice(0, 40)}“)` }); else if (m && v && m === v && String(m).length > 3) out.push({ attribute: c.key, message: t_('{0} gleich wie {1}', [locale, master]) }) } return out } },
  { key: 'formula', label: t_('Formel/Vorlage ohne Ergebnis'), severity: 'warn',
    run({ values, columns }) { return columns.filter(c => c.computed && values[c.key]?.value == null).map(c => ({ attribute: c.key, message: t_('kein Ergebnis — ein gelesener Wert fehlt oder Skript fehlt') })) } },
  { key: 'status', label: t_('Aktiv ohne Freigabe-Chance'), severity: 'info',
    run({ row, values, columns, locale }) { if (row.status !== 'active' || row.role !== 'variant') return []; const miss = columns.filter(c => c.required && Object.values(c.required).some(ls => ls.includes('*') || ls.includes(locale)) && !values[c.key]?.value).length; return miss ? [{ attribute: null, message: t_('aktiv, aber {0} Pflichtwerte ({1}) fehlen', [miss, locale]) }] : [] } },
]

function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v) } for (const k of kids) e.append(k); return e }

async function check(ctx, rootId, rules, say) {
  const { api, store } = ctx; const model = store.model
  const master = model.masterLocale ?? model.locales[0]?.code ?? 'de'
  const locales = model.locales.map(l => l.code)
  const byLocale = new Map(); let columns = [], all = []
  say(t_('lese {0} Sprachen …', [locales.length]))
  // Sprachen parallel: der Server rechnet je Anfrage nur einen Teilbaum, das Netz wartet nicht auf sich selbst.
  const tables = await Promise.all(locales.map(l => api.get(`/api/nodes/${encodeURIComponent(rootId)}/table?deep=true&self=true&locale=${l}`)))
  for (let i = 0; i < locales.length; i++) {
    const l = locales[i]; const t = tables[i]
    columns = t.columns; all = t.rows
    byLocale.set(l, new Map(t.rows.map(r => [r.row.id, r.values])))
  }
  const findings = []
  const extra = (ctx.checks ?? []).map(c => ({ key: `${c.key}:${c.check}`, label: c.label, severity: c.severity ?? 'warn', run: c.run, needs: c.needs ?? [] }))
  // Eine Regel kann Daten anfordern, die die Tabelle nicht trägt: relations = die Relationen des Teilbaums, je Knoten ({ knotenId: [{ type, direction, other: { id, label } }] }).
  // Geholt wird nur, wenn eine gewählte Regel sie braucht, und einmal je Prüfung.
  const gebraucht = new Set([...RULES, ...extra].filter(r => rules.has(r.key)).flatMap(r => r.needs ?? []))
  const relations = gebraucht.has('relations') ? await api.get(`/api/nodes/${encodeURIComponent(rootId)}/relations/tree?deep=true`).catch(() => ({})) : undefined
  for (const l of locales) for (const r of all) {
    const values = byLocale.get(l).get(r.row.id)
    const cols = columns.filter(c => !(r.inactive ?? []).includes(c.key))   // nur, was an diesem Knoten gilt
    for (const rule of [...RULES, ...extra]) {
      if (!rules.has(rule.key)) continue
      if (l !== master && !['required', 'untranslated', 'status', 'pattern'].includes(rule.key) && !rule.perLocale) continue   // sprachunabhängige Regeln einmal
      let out = []
      try { out = rule.run({ row: r.row, values, columns: cols, locale: l, master, byLocale, all, model, relations }) ?? [] } catch (e) { out = [{ attribute: null, message: t_('Regel {0}: {1}', [rule.key, e.message]) }] }
      for (const f of out) findings.push({ rule: rule.key, label: rule.label, severity: f.severity ?? rule.severity, locale: l, node: r.row, attribute: f.attribute, message: f.message })
    }
  }
  return { findings, nodes: all.length, columns: columns.length }
}

const bezeichnung = l => typeof l === 'string' ? l : (globalThis.journali?.L ? globalThis.journali.L(l) : l?.de ?? Object.values(l ?? {})[0] ?? '')
const URTEIL = { 'erfüllt': ['✓', 'pos'], 'auffällig': ['⚠', 'warn'], 'unklar': ['?', 'muted'] }

/// Die allgemeine KI-Analyse: die gewählten Kriterien (Regelgruppen) gegen die Daten eines Knotens. Die KI kennt nur diese Daten und die Befunde der Regelprüfung — keine Websuche.
async function regelAnalyse({ ctx, node, locale, gruppen, befunde, box, say }) {
  const { api, ai } = ctx
  say(t_('lese Daten …'))
  const tab = await api.get(`/api/nodes/${encodeURIComponent(node)}/table?self=true&locale=${locale}`)
  const zeile = (tab.rows ?? []).find(r => r.row.id === node)
  if (!zeile) throw new Error(t_('Knoten nicht gefunden'))
  const werte = (tab.columns ?? []).filter(c => String(zeile.values?.[c.key]?.value ?? '').trim() !== '')
    .map(c => `- ${bezeichnung(c.label) || c.key}: ${zeile.values[c.key].value}${c.unit ? ' ' + c.unit : ''}`)
  const kriterien = gruppen.map(g => `Gruppe ${g.label}:\n` + g.gewaehlt.map(r => `- ${r.label}`).join('\n')).join('\n')
  const gewaehlt = new Set(gruppen.flatMap(g => g.gewaehlt.map(r => r.key)))
  const fund = befunde.filter(f => gewaehlt.has(f.rule)).slice(0, 40).map(f => `- ${f.label}: ${f.node.label}${f.attribute ? ' · ' + f.attribute : ''} — ${f.message}`)
  say(`frage ${ai.label()} …`)
  const system = t_('Du prüfst ein Produkt gegen Prüfkriterien (Datenqualität, Werbeaussagen, Klassifikation …). Sprache: {0}. Du kennst nur die gelieferten Daten und die Befunde der Regelprüfung: keine Websuche, nichts erfinden. Antworte als JSON: { "kriterien": [{ "gruppe": string, "kriterium": string, "urteil": "erfüllt" | "auffällig" | "unklar", "begruendung": string, "vorschlag": string }] (ein Eintrag je genanntes Kriterium; Begründung und Vorschlag je ein kurzer Satz), "empfehlungen": string[] (höchstens vier, je ein kurzer Satz) }. Antworte knapp: die Länge der Antwort bestimmt die Wartezeit.', [locale])
  const user = `Produkt: ${zeile.row.label}\nEigenschaften:\n${werte.join('\n') || '(keine Werte)'}\n\nKriterien:\n${kriterien}\n\nBefunde der Regelprüfung:\n${fund.join('\n') || '(keine)'}`
  const j = await ai.ask({ system, user, json: true, maxTokens: 1500, purpose: t_('Datenanalyse') })
  const liste = Array.isArray(j.kriterien) ? j.kriterien : []
  box.innerHTML = ''
  const abschnitt = (titel, ...inhalt) => box.append(el('div', { class: 'section' }, el('h2', {}, titel), ...inhalt))
  for (const g of gruppen) {
    const zu = liste.filter(k => String(k.gruppe ?? '') === g.label || gruppen.length === 1)
    abschnitt(t_('KI-Analyse · {0} · {1}', [g.label, zeile.row.label]), el('table', { class: 'grid', style: 'width:100%' }, el('tbody', {}, ...zu.map(k => {
      const [zeichen, ton] = URTEIL[k.urteil] ?? URTEIL['unklar']
      return el('tr', {}, el('td', { style: 'width:300px' }, String(k.kriterium ?? '')), el('td', { class: ton, style: 'width:90px', title: String(k.urteil ?? '') }, `${zeichen} ${k.urteil ?? ''}`), el('td', {}, String(k.begruendung ?? '')), el('td', { class: 'muted' }, String(k.vorschlag ?? '')))
    }))))
  }
  const rest = Array.isArray(j.empfehlungen) ? j.empfehlungen : []
  if (rest.length) abschnitt(t_('Empfehlungen'), el('ul', { style: 'margin:4px 8px 4px 26px' }, ...rest.map(x => el('li', {}, String(x)))))
  say(t_('Analyse von {0}', [ai.label()]))
}

/// Die wählbaren Regeln nach Herkunft: die eingebauten zuerst, dann je Plugin in der Reihenfolge, in der es Regeln liefert
export function ruleGroups(checks) {
  const L = l => (l && globalThis.journali?.L ? globalThis.journali.L(l) : l?.de ?? Object.values(l ?? {})[0] ?? '')
  const groups = [{ id: '', label: t_('Datenqualität'), rules: RULES.map(r => ({ key: r.key, check: r.key, label: r.label, severity: r.severity })) }]
  for (const c of checks) {
    let g = groups.find(x => x.id === c.key)
    if (!g) groups.push(g = { id: c.key, label: L(c.quelle) || c.key, rules: [] })
    g.rules.push({ key: `${c.key}:${c.check}`, check: c.check, label: c.label, severity: c.severity ?? 'warn' })
  }
  return groups
}

async function mount(root, ctx) {
  const { store, tree } = ctx
  if (!tree.loaded) await tree.load()
  const sett = (await ctx.data.get('settings')) ?? { rules: RULES.map(r => r.key) }
  const rules = new Set(sett.rules)
  const state = { root: localStorage.getItem('journali.dq.root') || tree.rows.find(r => !r.parent)?.id, result: null, filter: 'all', q: '' }
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  // Teilbaum per Auswahlbaum: Knopf zeigt den gewählten, Klick klappt den Baum darunter auf; ?node= aus dem Kontextmenü
  const fromMenu = new URLSearchParams(location.search).get('node'); if (fromMenu && tree.byId.has(fromMenu)) { state.root = fromMenu; localStorage.setItem('journali.dq.root', fromMenu); history.replaceState(null, '', location.pathname) }
  const rootLabel = id => { const r = tree.byId.get(id); return r ? `${r.role === 'group' ? '▣' : r.role === 'product' ? '▦' : '◆'} ${r.label}` : t_('Teilbaum wählen') }
  const rootIn = el('button', { class: 'x', title: t_('Teilbaum wählen (Gruppe oder Produkt)') }, rootLabel(state.root))
  const pick = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:5;width:380px;display:none;padding:6px;background:var(--pane)' })
  ctx.treePicker(pick, { value: state.root, roles: ['group', 'product'], height: 300, onPick: r => { state.root = r.id; rootIn.textContent = rootLabel(r.id); pick.style.display = 'none'; localStorage.setItem('journali.dq.root', r.id) } })
  rootIn.addEventListener('click', () => { pick.style.display = pick.style.display === 'none' ? 'block' : 'none' })
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  const list = el('div', { class: 'scroll', style: 'flex:1' })
  const summary = el('div', { class: 'toolbar', style: 'gap:10px;font-size:12px' })
  const ruleBox = el('div', { class: 'regeln', style: 'padding:4px 8px;border-bottom:1px solid var(--line)' })
  // Die Regeln nach Herkunft: die eingebauten, dann je Plugin, das Regeln liefert. Eine Gruppe lässt sich als Ganzes an- und abwählen, jede Regel einzeln.
  const groups = ruleGroups(ctx.checks ?? [])
  for (const g of groups.slice(1)) for (const r of g.rules) { const alt = `${r.check}:${r.check}`; if (alt !== r.key && rules.has(alt) && !rules.has(r.key)) { rules.delete(alt); rules.add(r.key) } }   // frühere Auswahl: die Regel hieß unter ihrem eigenen Schlüssel
  // Die Befunde unten sind die der letzten Prüfung: ändert sich die Auswahl, sagt die Statuszeile, dass sie neu laufen muss
  const save = () => { if (state.result) say(t_('Auswahl geändert — ▶ prüfen')); return ctx.data.set('settings', { rules: [...rules] }) }
  for (const g of groups) {
    const gcb = el('input', { type: 'checkbox' }); const count = el('span', { class: 'muted' }); const einzeln = []
    const update = () => {
      const n = g.rules.filter(r => rules.has(r.key)).length
      gcb.checked = n === g.rules.length; gcb.indeterminate = n > 0 && n < g.rules.length; count.textContent = `${n}/${g.rules.length}`
      for (const [cb, r] of einzeln) cb.checked = rules.has(r.key)
    }
    gcb.addEventListener('change', async () => { for (const r of g.rules) gcb.checked ? rules.add(r.key) : rules.delete(r.key); update(); await save() })
    const chips = g.rules.map(r => {
      const cb = el('input', { type: 'checkbox' }); einzeln.push([cb, r])
      cb.addEventListener('change', async () => { cb.checked ? rules.add(r.key) : rules.delete(r.key); update(); await save() })
      return el('label', { class: 'chip', title: r.key, style: 'cursor:pointer' }, cb, ` ${sev(r.severity)} ${r.label}`)
    })
    // Die Gruppe hat eine eigene Kopfzeile (Kästchen für alle, Name, Zahl der gewählten); ihre Regeln stehen darunter, eingerückt
    const kopf = el('label', { class: 'gruppe', title: t_('Alle Regeln der Gruppe an- oder abwählen'), style: 'display:flex;align-items:center;gap:6px;cursor:pointer;font-weight:600;padding:2px 0' }, gcb, el('span', {}, g.label), count)
    ruleBox.append(el('div', { class: 'regelgruppe', style: 'margin:0 0 6px' }, kopf, el('div', { style: 'display:flex;flex-wrap:wrap;gap:4px;margin-left:22px' }, ...chips)))
    update()
  }
  function sev(s) { return s === 'error' ? '✗' : s === 'warn' ? '⚠' : 'ℹ' }
  function draw() {
    list.innerHTML = ''; summary.innerHTML = ''
    const res = state.result; if (!res) return
    const f = res.findings
    const count = s => f.filter(x => x.severity === s).length
    summary.append(el('span', { class: 'neg' }, `✗ ${count('error')}`), el('span', { class: 'warn' }, `⚠ ${count('warn')}`), el('span', { class: 'muted' }, `ℹ ${count('info')}`), el('span', { class: 'muted' }, t_('· {0} Knoten, {1} Attribute · {2} Knoten betroffen', [res.nodes, res.columns, new Set(f.map(x => x.node.id)).size])))
    for (const s of ['all', 'error', 'warn', 'info']) summary.append(el('span', { class: 'view-chip' + (state.filter === s ? ' on' : ''), onclick: () => { state.filter = s; draw() } }, s === 'all' ? 'alle' : sev(s)))
    const byRule = new Map(); for (const x of f) byRule.set(x.rule, (byRule.get(x.rule) ?? 0) + 1)
    summary.append(el('span', { class: 'muted' }, [...byRule].map(([k, n]) => `${k} ${n}`).join(' · ')))
    summary.append(el('span', { class: 'grow' }), el('button', { class: 'x', onclick: exportCsv, title: t_('Befunde als CSV') }, '⇪ CSV'))
    const q = state.q.toLowerCase()
    const rows = f.filter(x => (state.filter === 'all' || x.severity === state.filter) && (!q || x.node.label.toLowerCase().includes(q) || (x.attribute ?? '').includes(q) || x.message.toLowerCase().includes(q)))
    const tbl = el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:30px' }, ''), el('th', { style: 'width:300px' }, t_('Knoten')), el('th', { style: 'width:60px' }, 'SKU'), el('th', { style: 'width:40px' }, '🗣'), el('th', { style: 'width:160px' }, t_('Attribut')), el('th', {}, t_('Meldung')), el('th', { style: 'width:160px' }, t_('Regel')))))
    const tb = el('tbody'); tbl.append(tb)
    for (const x of rows.slice(0, 2000)) tb.append(el('tr', {}, el('td', { class: x.severity === 'error' ? 'neg' : x.severity === 'warn' ? 'warn' : 'muted' }, sev(x.severity)),
      el('td', {}, el('a', { href: `/tree/${x.node.id}`, onclick: e => { e.preventDefault(); ctx.go?.(`/tree/${x.node.id}`) ?? (location.href = `/tree/${x.node.id}`) }, title: x.node.id }, `${x.node.role === 'variant' ? '◆' : x.node.role === 'product' ? '▦' : '▣'} ${x.node.label}`)),
      el('td', { class: 'mono muted' }, Object.values(x.node.keys ?? {}).join(' · ')), el('td', { class: 'muted' }, x.locale), el('td', { class: 'mono' }, x.attribute ?? ''), el('td', { title: x.title ?? '' }, x.message), el('td', { class: 'muted' }, x.label)))   // title: Erklärung eines Funds im Tooltip, nicht in der Zeile
    if (rows.length > 2000) tb.append(el('tr', {}, el('td', { colspan: '7', class: 'muted' }, `… ${rows.length - 2000} weitere — filtern`)))
    list.append(tbl)
    if (!rows.length) list.append(el('div', { class: 'empty' }, f.length ? t_('nichts in diesem Filter') : t_('✓ keine Befunde')))
  }
  function exportCsv() {
    const esc = v => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
    const lines = ['schwere;knoten;id;sku;sprache;attribut;meldung;regel', ...state.result.findings.map(x => [x.severity, x.node.label, x.node.id, skuOf(x.node) ?? '', x.locale, x.attribute ?? '', x.message, x.rule].map(esc).join(';'))]
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })); a.download = 'datenqualitaet.csv'; a.click()
  }
  async function run() { if (!state.root) return; say(t_('prüfe …')); try { state.result = await check(ctx, state.root, rules, say); say(t_('{0} Befunde', [state.result.findings.length])); draw() } catch (e) { say('✗ ' + e.message); store.toast(e.message) } }
  const qIn = el('input', { type: 'search', placeholder: 'filtern', style: 'width:160px', oninput: e => { state.q = e.target.value; draw() } })
  // KI-Analyse: die gewählten Regelgruppen am gewählten Knoten. Hat das Plugin einer Gruppe eine Analyse beigesteuert (ctx.analyses, Schlüssel = Plugin), läuft diese;
  // alle übrigen Gruppen prüft die KI allgemein: die Kriterien der Gruppe gegen die Daten des Knotens und die Befunde der Regelprüfung.
  const analyseBox = el('div')
  async function analysieren() {
    if (!state.root) return
    const aktiv = groups.map(g => ({ ...g, gewaehlt: g.rules.filter(r => rules.has(r.key)) })).filter(g => g.gewaehlt.length)
    if (!aktiv.length) { store.toast(t_('Keine Regelgruppe gewählt')); return }
    const ai = ctx.ai
    if (!ai?.available?.() && !ai?.key) { store.toast(t_('Kein KI-Schlüssel — Einstellungen → KI')); return }
    const locale = store.model.masterLocale ?? 'de'
    analyseBox.innerHTML = ''
    try {
      if (!state.result) await run()   // die Befunde gehen in die Analyse ein
      const beitraege = (ctx.analyses ?? []).filter(a => aktiv.some(g => g.id === a.key))
      for (const a of beitraege) { const box = el('div'); analyseBox.append(box); await a.run({ ctx, node: state.root, locale, box, say }) }
      const allgemein = aktiv.filter(g => !beitraege.some(a => a.key === g.id))
      if (allgemein.length) { const box = el('div'); analyseBox.append(box); await regelAnalyse({ ctx, node: state.root, locale, gruppen: allgemein, befunde: state.result?.findings ?? [], box, say }) }
    } catch (e) { say('✗ ' + e.message); store.toast(e.message) }
  }
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, t_('✓ Datenqualität')), el('span', { style: 'position:relative' }, rootIn, pick), el('button', { class: 'primary', onclick: run }, t_('▶ prüfen')), el('button', { class: 'primary ai', title: t_('Gewählte Regelgruppen mit der KI analysieren (sie kennt nur die Daten dieses Knotens)'), onclick: analysieren }, t_('✦ KI-Analyse')), qIn, el('span', { class: 'grow' }), status), ruleBox, analyseBox, summary, list)
  return () => {}
}

export default {
  views: [{ path: 'check', topic: 'analysis', label: t_('Datenqualität'), icon: '✓', hint: t_('Regeln: Pflicht, Muster, Zahlen, Listen, Leerzeichen, leeres HTML, SKU, Übersetzung, Formel — plus Prüfregeln der Plugins'), mount }],
  nodeActions: [{ topic: 'analysis', roles: ['group', 'product'], icon: '✓', label: (r, below) => t_('Datenqualität: {0} prüfen', [below]), run: (id, ctx) => ctx.go(`/p/da/check?node=${encodeURIComponent(id)}`) }],
  rules: RULES,
}
