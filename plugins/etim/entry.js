// Plugin etim (Taloan, 19.09.2026: „wie sieht es mit Plugins aus wie ETIM Export beziehungsweise BMEcat“ — die Freigaben liegen frei
// unter etim.de/daten/downloads): ETIM-Klassifikation in journali. Eine Freigabe (IXF 3.1) wird im Browser gelesen, die Klassen,
// die man braucht, kommen als Datensätze ins Journal (class:<EC>, aufgelöst), die Klasse steht als Attribut am Produkt
// (Werteliste der übernommenen Klassen), je Merkmal ein Attribut (ef000040: Zahl mit Einheit, Ja/Nein, Werteliste mit
// EV-Codes, Bereich als Text) in der Attributgruppe ETIM — oder eine Zuordnung auf vorhandene Attribute. Prüfregeln in
// ✓ Datenqualität (Klasse unbekannt, Wert passt nicht zum Merkmal, Belegung), Merkmale für ‹› Vorlagen-Export (BMEcat).
import { parseIxf, classRecord, nameOf, classText, featureText, featuresOf, checkNode, resolveValue, gate } from './core.mjs'

function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else e.setAttribute(k, v) } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : String(c)); return e }
const ICON = { group: '▣', product: '▦', variant: '◆' }
const SEV = { error: '✗', warn: '⚠', info: 'ℹ' }
const TYPE = { Alphanumeric: 'Liste', Numeric: 'Zahl', Range: 'Bereich', Logical: 'Ja/Nein' }
const DEFAULTS = { classAttr: 'etim_class', unknownAs: 'UN', requireClass: false, group: 'etim' }
const groupKey = () => cache.settings.group || 'etim'

// Klassen und Einstellungen im Speicher — die Prüfregeln laufen synchron (Datenqualität) und brauchen sie ohne Nachschlagen
const cache = { classes: new Map(), settings: { ...DEFAULTS }, map: {}, mapping: {}, loaded: null }
/// Attribut eines Merkmals: Zuordnung (map), sonst die der Datenanalyse (mapping), sonst das eigene ef…
const attrKeyOf = code => cache.map[code] ?? cache.mapping?.[code.toLowerCase()]?.to ?? code.toLowerCase()
const mergedMap = () => { const m = {}; for (const [k, v] of Object.entries(cache.mapping ?? {})) if (v?.to) m[k.toUpperCase()] = v.to; return { ...m, ...cache.map } }
async function loadCache() {
  try {
    const names = await (await fetch('/api/plugins/etim/data')).json()
    if (!Array.isArray(names)) return
    const get = async n => { const r = await fetch('/api/plugins/etim/data/' + encodeURIComponent(n)); return r.ok ? r.json() : null }
    cache.settings = { ...DEFAULTS, ...((await get('settings')) ?? {}) }; cache.map = (await get('map')) ?? {}; cache.mapping = (await get('mapping')) ?? {}
    cache.classes = new Map()
    for (const n of names.filter(n => n.startsWith('class:'))) { const c = await get(n); if (c) cache.classes.set(c.code, c) }
  } catch { }
}
cache.loaded = loadCache()
const cfg = locale => ({ ...cache.settings, map: mergedMap(), locale })

/// Modell anlegen: Gruppe ETIM, Klassenattribut (Werteliste der übernommenen Klassen), je Merkmal ein Attribut ef…
function modelOps(ctx) {
  const { api, store } = ctx
  const model = () => store.model
  const locale = model().masterLocale ?? 'de'
  const hasAttr = key => model().attributes.some(a => a.key === key)
  const labelsOf = names => { const out = {}; for (const l of model().locales.map(x => x.code)) if (names?.[l]) out[l] = names[l]; if (!Object.keys(out).length) out[locale] = nameOf(names, locale); return out }
  const put = (path, body) => api.post('/api/model' + path, body, 'PUT')
  async function ensureGroup() { const g = groupKey(); if (!(model().groups ?? []).some(x => x.key === g)) await put(`/groups/${g}`, { key: g, label: { de: g === 'etim' ? 'ETIM' : g, en: g === 'etim' ? 'ETIM' : g }, activeFrom: 'product' }) }
  async function ensureClassAttr() {
    const key = cache.settings.classAttr
    await ensureGroup()
    const existing = model().attributes.find(a => a.key === key)
    if (existing && !(existing.type === 'enum' && existing.list === key)) return key   // ein vorhandenes Text-/Listenattribut bleibt, wie es ist
    if (!(model().lists ?? []).some(l => l.key === key)) await put(`/lists/${key}`, { key, label: { de: 'ETIM-Klasse', en: 'ETIM class' } })
    const have = new Set((model().lists ?? []).find(l => l.key === key)?.values?.map(v => v.value) ?? [])
    let i = 0
    for (const c of [...cache.classes.values()].sort((a, b) => a.code.localeCompare(b.code))) if (!have.has(c.code)) await put(`/lists/${key}/values/${c.code}`, { value: c.code, label: Object.fromEntries(Object.entries(labelsOf(c.name)).map(([l, n]) => [l, `${c.code} ${n}`])), order: i++ })
    if (!hasAttr(key)) await put(`/attributes/${key}`, { key, label: { de: 'ETIM-Klasse', en: 'ETIM class' }, type: 'enum', list: key, group: groupKey(), inheritable: true })
    return key
  }
  async function unitKeyFor(u) {
    if (!u) return null
    const abbr = nameOf(u.abbr, locale) || u.code; const units = model().units ?? []
    const hit = units.find(x => x.key === abbr.toLowerCase() || Object.values(x.label ?? {}).some(l => l === abbr)); if (hit) return hit.key
    const key = ('u_' + abbr.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '')).slice(0, 30)
    if (!units.some(x => x.key === key)) await put(`/units/${key}`, { key, label: { de: abbr, en: abbr }, quantity: nameOf(u.name, locale) || abbr, factor: 1 })
    return key
  }
  // ein Merkmal → Attribut ef… (Numeric: decimal + Einheit, Logical: boolean, Alphanumeric: enum mit Werteliste EV-Code → Name, Range: text mit Muster)
  async function createFeature(f) {
    await ensureGroup()
    const key = f.code.toLowerCase()
    if (hasAttr(key)) return key
    const base = { key, label: labelsOf(f.name), group: groupKey() }
    if (f.type === 'Numeric') await put(`/attributes/${key}`, { ...base, type: 'decimal', unit: await unitKeyFor(f.unit) })
    else if (f.type === 'Logical') await put(`/attributes/${key}`, { ...base, type: 'boolean' })
    else if (f.type === 'Range') await put(`/attributes/${key}`, { ...base, type: 'text', pattern: '^\\s*-?[\\d.,]+(\\s*(-|\\.\\.|…)\\s*-?[\\d.,]+)?\\s*$', patternHint: `von - bis${f.unit ? ' in ' + (nameOf(f.unit.abbr, locale) || f.unit.code) : ''}` })
    else {
      if (!(model().lists ?? []).some(l => l.key === key)) await put(`/lists/${key}`, { key, label: labelsOf(f.name) })
      let i = 0; for (const v of f.values) await put(`/lists/${key}/values/${v.code}`, { value: v.code, label: labelsOf(v.name), order: i++ })
      await put(`/attributes/${key}`, { ...base, type: 'enum', list: key })
    }
    if (cache.map[f.code] && cache.map[f.code] !== key) delete cache.map[f.code]
    return key
  }
  return { ensureGroup, ensureClassAttr, createFeature, hasAttr }
}
/// Alle Merkmale der übernommenen Klassen, je Code einmal (Werte vereinigt), mit den Klassen, in denen es vorkommt
function allFeatures() {
  const feats = new Map()
  for (const c of cache.classes.values()) for (const f of c.features) { if (!feats.has(f.code)) feats.set(f.code, { ...f, values: [...f.values], classes: [c] }); else { const have = feats.get(f.code); have.classes.push(c); for (const v of f.values) if (!have.values.some(x => x.code === v.code)) have.values.push(v) } }
  return feats
}

/// Katalog für die Datenanalyse (ctx.compliance, wie DPP/PPWR — Taloan, 20.09.: „was ich beim Export brauche, vorher analysieren und
/// vervollständigen“): Datenpunkte = Klasse + alle Merkmale der übernommenen Klassen; ein Merkmal gilt an einem Knoten nur, wenn
/// seine Klasse es hat. Attribute legt der Katalog selbst an (Listen, Einheiten). Vorschläge: Regeln, KI, Recherche im Internet.
function buildCatalog(ctx) {
  const locale = ctx.store.model.masterLocale ?? 'de'
  const ops = modelOps(ctx)
  const classKey = cache.settings.classAttr
  const classOf = (r, mapping) => { const key = mapping?.[classKey]?.to || classKey; const code = String(r.values?.[key]?.value ?? '').trim().toUpperCase(); return cache.classes.get(code) ?? null }
  const TYPE = { Numeric: 'decimal', Logical: 'boolean', Alphanumeric: 'enum', Range: 'text' }
  const feats = [...allFeatures().values()].sort((a, b) => b.classes.length - a.classes.length || a.code.localeCompare(b.code))
  const items = feats.map(f => ({
    key: f.code.toLowerCase(), label: nameOf(f.name, locale) || f.code, labelEn: f.name.en, level: 'must', type: TYPE[f.type] ?? 'text', unit: f.unit ? (nameOf(f.unit.abbr, locale) || f.unit.code) : null,
    values: f.type === 'Alphanumeric' ? f.values.map(v => nameOf(v.name, locale)) : null,
    synonyms: [f.code, ...Object.values(f.name)],
    hint: `${f.code} · ${f.type}${f.type === 'Range' ? ' (von - bis)' : ''} · in ${f.classes.length} Klasse${f.classes.length === 1 ? '' : 'n'}: ${f.classes.slice(0, 3).map(c => c.code).join(', ')}${f.classes.length > 3 ? ' …' : ''}`,
    appliesIf: (r, mapping) => { const c = classOf(r, mapping); return !!c && c.features.some(x => x.code === f.code) },
    rule: v => resolveValue(f, v) === null ? `passt nicht zu ${f.type}${f.type === 'Alphanumeric' ? ' — erlaubt: ' + f.values.slice(0, 5).map(x => nameOf(x.name, locale)).join(', ') + (f.values.length > 5 ? ' …' : '') : ''}` : null,
    feature: f,
  }))
  const n = cache.classes.size
  return {
    key: 'etim', label: 'ETIM-Merkmale', icon: '⌗', source: 'https://etim.de/daten/downloads/', sourceLabel: 'etim.de ↗',
    description: n ? `${n} Klasse${n === 1 ? '' : 'n'} übernommen (⇪ Export → ⌗ ETIM) mit ${feats.length} Merkmalen. Ein Merkmal zählt an einem Knoten nur, wenn seine Klasse es hat; Knoten ohne Klasse bleiben aussen vor. Fehlende Attribute legt der Katalog als ef… mit Werteliste und Einheit an.` : 'Noch keine Klasse übernommen — erst unter ⇪ Export → ⌗ ETIM eine Freigabe lesen und Klassen übernehmen.',
    groupKey: groupKey(), groupLabel: groupKey() === 'etim' ? 'ETIM' : groupKey(), prefix: '',
    groups: [
      { key: 'class', label: 'Klasse', items: [{ key: classKey, label: 'ETIM-Klasse', level: 'must', type: 'enum', synonyms: ['etim', 'etim_class', 'etim klasse', 'etim class'], values: [...cache.classes.values()].map(c => `${c.code} ${nameOf(c.name, locale)}`), hint: 'EC-Code der Klasse — ohne Klasse gilt kein Merkmal; die KI schlägt eine der übernommenen Klassen vor', rule: v => cache.classes.has(String(v).trim().toUpperCase()) ? null : `Klasse ${v} nicht übernommen` }] },
      { key: 'features', label: 'Merkmale', items },
    ],
    createAttribute: async it => it.key === classKey ? ops.ensureClassAttr() : it.feature ? ops.createFeature(it.feature) : null,
    // Erster Schritt je Knoten (Taloan, 20.09.): die Klasse sagt, welche Merkmale erforderlich sind — ohne Klasse steht hier „zuweisen“
    rowNote: (n, mapping, c) => {
      const key = mapping?.[classKey]?.to || classKey; const code = String(n.raw?.[key] ?? '').trim().toUpperCase(); const cls = cache.classes.get(code)
      if (cls) return `${code} · ${cls.features.length} Merkmale`
      if (n.states[classKey] === 'inactive') return ''   // Gruppe fehlt — der ⊘-Knopf oben löst es
      if (n.leaf || n.row.role !== 'group') { const b = document.createElement('button'); b.className = 'x'; b.textContent = '⌗ Klasse zuweisen …'; b.title = 'ETIM-Klasse für diesen Knoten wählen — sie bestimmt die erforderlichen Merkmale'; b.addEventListener('click', () => c.go?.(`/p/etim/etim?assign=${encodeURIComponent(n.row.id)}`)); return b }
      return ''
    },
    summary: r => { const noClass = r.nodes.filter(n => n.leaf && n.states[classKey] === 'empty').length; return noClass ? `⌗ ${noClass} Knoten ohne ETIM-Klasse — erst die Klasse zuweisen (sie sagt, welche Merkmale erforderlich sind), dann füllen` : null },
  }
}

/// Merkmale eines Knotens für xport (env.featuresOf) — pctx ist der Produktkontext von xport
export async function etimFeatures(pctx) { await cache.loaded; return featuresOf(pctx, { ...cfg(pctx.locale), getClass: async code => cache.classes.get(code) ?? null }) }

/// Sperre für xport: ein Knoten, der die Analyse nicht besteht, wird nicht exportiert
export async function etimGate(pctx) { await cache.loaded; return gate(pctx, { ...cfg(pctx.locale), getClass: async code => cache.classes.get(code) ?? null }) }

/// Prüfregeln für ✓ Datenqualität
const checks = [
  { key: 'etim', label: '⌗ ETIM: Klasse und Merkmale', severity: 'warn', run({ values, columns, locale }) { return checkNode({ values, columns, classes: cache.classes, cfg: cfg(locale) }) } },
]

async function mount(root, ctx) {
  const { api, store, tree } = ctx
  if (!tree.loaded) await tree.load()
  await cache.loaded
  const model = () => store.model
  const locale = model().masterLocale ?? 'de'
  const assignParam = new URLSearchParams(location.search).get('assign'); if (assignParam) history.replaceState(null, '', location.pathname)
  const st = { assign: assignParam && tree.byId.has(assignParam) ? assignParam : null, rel: null, q: '', hits: [], root: localStorage.getItem('journali.etim.root') || tree.rows.find(r => !r.parent)?.id, result: null, busy: false }
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  const body = el('div', { class: 'scroll', style: 'flex:1;padding:0 8px 8px' })
  const attrs = () => model().attributes.filter(a => a.type !== 'rows')
  const lbl = a => a.label?.[locale] || a.label?.de || a.key
  const ops = modelOps(ctx); const hasAttr = ops.hasAttr
  const saveSettings = () => ctx.data.set('settings', cache.settings)
  const saveMap = () => ctx.data.set('map', cache.map)
  const section = (title, hint, ...kids) => el('div', { class: 'section', style: 'margin-top:10px' }, el('div', { class: 'step-band' }, title, hint ? el('span', { class: 'muted' }, ' · ' + hint) : null), ...kids)
  const busy = async (label, fn) => { if (st.busy) return; st.busy = true; say(label); try { await fn() } catch (e) { say('✗ ' + e.message); store.toast(e.message) } finally { st.busy = false } }

  // ── Freigabe: IXF-Datei lesen (bleibt im Speicher — nur übernommene Klassen gehen ins Journal)
  const file = el('input', { type: 'file', accept: '.xml,.ixf', style: 'display:none' })
  file.addEventListener('change', async () => {
    const f = file.files?.[0]; if (!f) return
    await busy(`lese ${f.name} (${(f.size / 1048576).toFixed(1)} MB) …`, async () => {
      const t0 = performance.now(); const text = await f.text(); st.rel = parseIxf(text)
      const h = st.rel.header
      say(`${h.name ?? 'ETIM'} Nr. ${h.number ?? '?'} · ${st.rel.classes.length} Klassen · ${st.rel.features.size} Merkmale · ${st.rel.values.size} Werte · ${Math.round(performance.now() - t0)} ms`)
      await ctx.data.set('release', { name: h.name, number: h.number, date: h.date, exportDate: h.exportDate, classes: st.rel.classes.length, features: st.rel.features.size, languages: [...new Set(st.rel.classes.slice(0, 50).flatMap(c => Object.keys(c.name)))], file: f.name, at: new Date().toISOString() })
      draw()
    })
    file.value = ''
  })
  // Klasse einem Knoten zuweisen (Taloan, 20.09.: „muss der Anwender nicht irgendwo definieren, zu welcher Klasse ein Produkt gehört?“):
  // Wert im Klassenattribut (vererbbar — an der Gruppe gesetzt gilt es für alles darunter); fehlt die Gruppe ETIM am Pfad, kommt sie an den Knoten
  async function assignClass(nodeId, code) {
    const row = tree.byId.get(nodeId); if (!row) return
    if (!cache.classes.has(code)) { const cls = st.rel?.classes.find(x => x.code === code); if (!cls) { store.toast(`Klasse ${code} nicht übernommen`); return } await takeClass(cls, true) }
    await busy(`weise ${code} zu …`, async () => {
      const key = await ops.ensureClassAttr(); await store.poll(true)
      const onPath = id => { for (let p = id; p; p = tree.byId.get(p)?.parent) if ((tree.byId.get(p)?.groups ?? '').split(',').includes(groupKey())) return true; return false }
      if (!onPath(nodeId)) { const groups = [...new Set([...(row.groups ?? '').split(',').filter(Boolean), groupKey()])]; await api.post(`/api/nodes/${encodeURIComponent(nodeId)}/groups`, { groups }, 'PUT') }
      await api.post(`/api/nodes/${encodeURIComponent(nodeId)}/attributes`, { attribute: key, locale: null, channel: null, value: code, row: null })
      await tree.load?.()
      say(`${code} → ${row.label}${onPath(nodeId) ? '' : ` (Gruppe ${groupKey()} angehängt)`}`); store.toast(`✓ ${code} an ${row.label}`, 'ok')
    })
  }
  const assignPick = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:6;width:380px;display:none;padding:6px;background:var(--pane)' })
  let assignCode = null
  ctx.treePicker(assignPick, { roles: ['group', 'product', 'variant'], height: 300, onPick: async r => { assignPick.style.display = 'none'; if (assignCode) await assignClass(r.id, assignCode); draw() } })
  const assignBtn = code => st.assign
    ? el('button', { class: 'primary', title: `${code} dem gewählten Knoten zuweisen`, onclick: async () => { await assignClass(st.assign, code); draw() } }, '⇢ zuweisen')
    : el('button', { class: 'x', title: `${code} einem Knoten zuweisen — Auswahlbaum`, onclick: e => { assignCode = code; const host = e.currentTarget.parentElement; host.style.position = 'relative'; host.append(assignPick); assignPick.style.display = assignPick.style.display === 'none' ? 'block' : 'none' } }, '⇢')
  async function takeClass(cls, silent) {
    const rec = classRecord(st.rel, cls); await ctx.data.set('class:' + rec.code, rec); cache.classes.set(rec.code, rec)
    if (!silent) say(`${classText(rec, locale)} übernommen · ${rec.features.length} Merkmale`)
  }
  async function classesFromTree() {
    if (!st.rel) { store.toast('erst eine Freigabe lesen'); return }
    const key = cache.settings.classAttr; if (!hasAttr(key)) { store.toast(`Attribut ${key} gibt es nicht`); return }
    await busy('suche Klassen im Baum …', async () => {
      const codes = new Set()
      for (const r of tree.rows.filter(r => !r.parent)) { const t = await api.get(`/api/nodes/${encodeURIComponent(r.id)}/table?deep=true&attributes=${key}`); for (const row of t.rows) { const c = String(row.values[key]?.value ?? '').trim().toUpperCase(); if (/^EC\d{6}$/.test(c)) codes.add(c) } }
      let n = 0, miss = 0
      for (const c of codes) { if (cache.classes.has(c)) continue; const cls = st.rel.classes.find(x => x.code === c); if (cls) { await takeClass(cls, true); n++ } else miss++ }
      say(`${codes.size} Klassen im Baum · ${n} neu übernommen${miss ? ` · ${miss} nicht in der Freigabe` : ''}`); draw()
    })
  }

  // ── Attribute anlegen (modelOps): Klassenattribut, je Merkmal ein Attribut in der Gruppe ETIM
  async function createAttributes() {
    await busy('lege Attribute an …', async () => {
      await store.poll(true); await ops.ensureClassAttr()
      let n = 0; const todo = [...allFeatures().values()].filter(f => !hasAttr(attrKeyOf(f.code)))
      for (const f of todo) { say(`${++n}/${todo.length} ${f.code} ${nameOf(f.name, locale)}`); await ops.createFeature(f) }
      await saveMap(); await store.poll(true)
      say(`${todo.length} Attribute angelegt · Klassenattribut ${cache.settings.classAttr} mit ${cache.classes.size} Klassen`); draw()
    })
  }

  // ── Prüfung eines Teilbaums mit denselben Regeln wie die Datenqualität
  async function check() {
    await busy('prüfe …', async () => {
      const t = await api.get(`/api/nodes/${encodeURIComponent(st.root)}/table?deep=true&locale=${locale}`)
      const findings = []
      for (const r of t.rows) for (const f of checkNode({ values: r.values, columns: t.columns.filter(x => !(r.inactive ?? []).includes(x.key)), classes: cache.classes, cfg: cfg(locale) })) findings.push({ ...f, node: r.row })
      st.result = { findings, nodes: t.rows.length }; say(`${findings.length} Funde in ${t.rows.length} Knoten`); draw()
    })
  }

  function draw() {
    body.innerHTML = ''
    const m = model(); const rel = st.rel; const relInfo = st.relInfo
    // Freigabe
    const relLine = rel ? `${rel.header.name ?? 'ETIM'} Nr. ${rel.header.number ?? '?'} vom ${(rel.header.date ?? '').slice(0, 10)} · ${rel.classes.length} Klassen · ${rel.features.size} Merkmale · ${rel.values.size} Werte · ${rel.units.size} Einheiten`
      : relInfo ? `zuletzt gelesen: ${relInfo.name ?? 'ETIM'} Nr. ${relInfo.number ?? '?'} (${relInfo.file}, ${(relInfo.at ?? '').slice(0, 10)}) — für Suche und Übernahme die Datei erneut lesen` : 'noch keine Freigabe gelesen'
    body.append(section('Freigabe', 'IXF 3.1 — etim.de/daten/downloads bzw. ETIM CMT, frei',
      el('div', { style: 'display:flex;gap:8px;align-items:center;padding:6px 0' }, el('button', { class: 'x', title: 'ETIM-Freigabe als IXF-3.1-Datei lesen — bleibt im Browser; ins Journal kommen nur die übernommenen Klassen', onclick: () => file.click() }, '⇩ IXF lesen'), file, el('span', { class: 'muted', style: 'font-size:12px' }, relLine))))
    // Klassen
    // ohne gelesene Freigabe (bleibt im Browser, je Sitzung) gibt es nichts zu suchen — Feld und Knopf sagen das, statt nach dem Klick zu meckern (Taloan, 20.09.)
    const q = el('input', { placeholder: rel ? 'Klasse suchen — Code, Name, Synonym' : 'erst oben „⇩ IXF lesen“ — dann suchen', value: st.q, style: 'width:360px', disabled: !rel, oninput: e => { st.q = e.target.value; search() } })
    const hits = el('div')
    const search = () => {
      hits.innerHTML = ''; if (!rel || st.q.trim().length < 2) return
      const s = st.q.trim().toLowerCase()
      const found = rel.classes.filter(c => c.code.toLowerCase().includes(s) || Object.values(c.name).some(n => n.toLowerCase().includes(s)) || Object.values(c.synonyms).some(l => l.some(n => n.toLowerCase().includes(s)))).slice(0, 40)
      for (const c of found) hits.append(el('div', { class: 'pick', style: 'display:flex;gap:8px;align-items:center' }, el('span', { class: 'mono muted' }, c.code), el('span', { class: 'grow' }, nameOf(c.name, locale), el('span', { class: 'muted', style: 'font-size:11px' }, ` · ${c.features.length} Merkmale · ${c.status}`)), cache.classes.has(c.code) ? el('span', { class: 'muted' }, '✓') : el('button', { class: 'x', title: 'Klasse übernehmen (ins Journal)', onclick: async () => { await takeClass(c); draw() } }, '+'), st.assign ? el('button', { class: 'primary', title: `übernehmen und ${tree.byId.get(st.assign)?.label} zuweisen`, onclick: async () => { await assignClass(st.assign, c.code); draw() } }, '⇢ zuweisen') : null))
      if (!found.length) hits.append(el('div', { class: 'muted', style: 'padding:4px' }, 'nichts gefunden'))
    }
    const taken = [...cache.classes.values()].sort((a, b) => a.code.localeCompare(b.code))
    const tbl = el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:90px' }, 'Klasse'), el('th', {}, 'Name'), el('th', { style: 'width:70px' }, 'Merkmale'), el('th', { style: 'width:90px' }, 'ohne Attribut'), el('th', { style: 'width:110px' }, 'Freigabe'), el('th', { style: 'width:100px' }, ''), el('th', { style: 'width:60px' }, ''))),
      el('tbody', {}, ...taken.map(c => { const missing = c.features.filter(f => !hasAttr(attrKeyOf(f.code))).length; return el('tr', {}, el('td', { class: 'mono' }, c.code), el('td', {}, nameOf(c.name, locale), el('span', { class: 'muted', style: 'font-size:11px' }, c.group ? ` · ${nameOf(c.group.name, locale)}` : '')), el('td', { class: 'num' }, c.features.length), el('td', { class: missing ? 'warn num' : 'muted num' }, missing || '—'), el('td', { class: 'muted', style: 'font-size:11px' }, `${c.release?.name ?? ''} v${c.version}`),
        el('td', { style: 'position:relative' }, assignBtn(c.code)),
        el('td', {}, rel && rel.classes.some(x => x.code === c.code && x.version !== c.version) ? el('button', { class: 'x', title: 'aus der gelesenen Freigabe aktualisieren', onclick: async () => { await takeClass(rel.classes.find(x => x.code === c.code)); draw() } }, '↻') : null, el('button', { class: 'x', title: 'Klasse entfernen (Datensatz; Attribute und Werte bleiben)', onclick: async () => { if (!(await ctx.dialog.confirm({ title: `${c.code} entfernen?`, ok: 'entfernen', danger: true }))) return; await ctx.data.del('class:' + c.code); cache.classes.delete(c.code); draw() } }, '✕'))) })))
    const assignRow = st.assign ? tree.byId.get(st.assign) : null
    body.append(section('Klassen', `${taken.length} übernommen`,
      assignRow ? el('div', { class: 'chips', style: 'padding:6px 0' }, el('b', {}, `Klasse zuweisen an ${ICON[assignRow.role] ?? ''} ${assignRow.label}`), el('span', { class: 'muted', style: 'font-size:12px' }, '— unten „⇢ zuweisen“ bei einer übernommenen Klasse oder einem Suchtreffer; vererbbar: an der Gruppe gesetzt gilt sie für alles darunter'), el('button', { class: 'x', title: 'ohne Zuweisung weiter', onclick: () => { st.assign = null; draw() } }, '✕')) : null,
      el('div', { style: 'display:flex;gap:8px;align-items:center;padding:6px 0;flex-wrap:wrap' }, q, el('button', { class: 'x', disabled: !rel, title: rel ? `alle Klassen, die im Attribut ${cache.settings.classAttr} im Baum stehen, aus der Freigabe übernehmen` : 'braucht die gelesene Freigabe (oben ⇩ IXF lesen)', onclick: classesFromTree }, '⇩ aus dem Baum')),
      hits, taken.length ? tbl : el('div', { class: 'empty' }, rel ? 'Klasse suchen und mit + übernehmen' : 'erst eine Freigabe lesen')))
    // Attribute
    // Gruppe der ETIM-Daten: „etim“ legen wir an (Attribute direkt zugewiesen); eine vorhandene Gruppe heißt: hier zuordnen (Best Guess über die Namen)
    const groupSel = el('select', { title: 'Attributgruppe, die die ETIM-Daten trägt — gibt es sie nicht, wird sie angelegt', onchange: e => { cache.settings.group = e.target.value; saveSettings(); draw() } },
      el('option', { value: 'etim' }, `etim${(model().groups ?? []).some(g => g.key === 'etim') ? '' : ' (anlegen)'}`),
      ...(model().groups ?? []).filter(g => g.key !== 'etim').map(g => el('option', { value: g.key }, `${g.label?.[locale] || g.label?.de || g.key} (${g.key})`)))
    groupSel.value = groupKey()
    const inGroup = () => attrs().filter(a => a.group === groupKey())
    const guessInGroup = () => {   // Merkmal → Attribut der gewählten Gruppe nach Namen (alle Sprachen, Code)
      const { norm, similarity } = ctx.mapper; let n = 0
      for (const f of allFeatures().values()) {
        if (cache.map[f.code] || hasAttr(f.code.toLowerCase())) continue
        const wanted = [f.code, ...Object.values(f.name)].map(norm); let best = null, score = 0
        for (const a of inGroup()) for (const w of wanted) for (const nme of [a.key, ...Object.values(a.label ?? {})].map(norm)) { const s = nme === w ? 1 : similarity(nme, w); if (s > score) { score = s; best = a } }
        if (best && score >= 0.8) { cache.map[f.code] = best.key; n++ }
      }
      saveMap(); say(`${n} Merkmale in Gruppe ${groupKey()} zugeordnet`); draw()
    }
    const classSel = el('select', { onchange: e => { cache.settings.classAttr = e.target.value; saveSettings(); draw() } }, el('option', { value: DEFAULTS.classAttr }, `${DEFAULTS.classAttr}${hasAttr(DEFAULTS.classAttr) ? '' : ' (anlegen)'}`), ...attrs().filter(a => a.key !== DEFAULTS.classAttr && (a.type === 'text' || a.type === 'enum')).map(a => el('option', { value: a.key }, `${lbl(a)} (${a.key})`)))
    classSel.value = cache.settings.classAttr
    const unkSel = el('select', { onchange: e => { cache.settings.unknownAs = e.target.value; saveSettings() } }, el('option', { value: 'UN' }, 'unbekannt: „-“ + UN (Guideline)'), el('option', { value: 'NA' }, 'unbekannt: „-“ + NA'), el('option', { value: 'skip' }, 'unbekannt: weglassen')); unkSel.value = cache.settings.unknownAs
    const reqCb = el('input', { type: 'checkbox' }); reqCb.checked = !!cache.settings.requireClass; reqCb.addEventListener('change', () => { cache.settings.requireClass = reqCb.checked; saveSettings() })
    // Gruppe ETIM gilt erst, wenn sie an einem Knoten des Pfads hängt (GroupsAttached) — hier an einen Teilbaum hängen
    const attached = tree.rows.filter(r => (r.groups ?? '').split(',').includes(groupKey()))
    const attachBtn = el('button', { class: 'x', title: `die Attributgruppe ${groupKey()} an einen Teilbaum hängen — erst dann gelten die Attribute an den Knoten darunter` }, `⌗ Gruppe an Teilbaum${attached.length ? ` · ${attached.length}` : ''}`)
    const attachPick = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:5;width:380px;display:none;padding:6px;background:var(--pane)' })
    ctx.treePicker(attachPick, { roles: ['group'], height: 300, onPick: async r => { attachPick.style.display = 'none'; const groups = [...new Set([...(r.groups ?? '').split(',').filter(Boolean), groupKey()])]; await api.post(`/api/nodes/${encodeURIComponent(r.id)}/groups`, { groups }, 'PUT'); await tree.load?.(); say(`Gruppe ${groupKey()} hängt an ${r.label}`); draw() } })
    attachBtn.addEventListener('click', () => { attachPick.style.display = attachPick.style.display === 'none' ? 'block' : 'none' })
    const allFeats = allFeatures(); for (const f of allFeats.values()) f.n = f.classes.length
    const missing = [...allFeats.values()].filter(f => !hasAttr(attrKeyOf(f.code)))
    body.append(section('Attribute', `${allFeats.size} Merkmale · ${missing.length} ohne Attribut`,
      el('div', { style: 'display:flex;gap:12px;align-items:center;padding:6px 0;flex-wrap:wrap' }, el('label', { class: 'muted' }, 'Gruppe ', groupSel), groupKey() !== 'etim' ? el('button', { class: 'x', title: `Merkmale den vorhandenen Attributen der Gruppe ${groupKey()} nach Namen zuordnen (ab 80 % Ähnlichkeit); der Rest wird angelegt`, onclick: guessInGroup }, `↻ in ${groupKey()} zuordnen`) : null, el('label', { class: 'muted' }, 'Klasse in ', classSel), unkSel, el('label', {}, reqCb, ' Klasse ist Pflicht (Prüfung)'),
        el('button', { class: 'primary', title: `Klassenattribut ${cache.settings.classAttr} als Werteliste der übernommenen Klassen und je fehlendem Merkmal ein Attribut (ef…) in der Gruppe ${groupKey()} anlegen`, onclick: createAttributes }, `＋ Attribute anlegen (${missing.length + (hasAttr(cache.settings.classAttr) ? 0 : 1)})`),
        el('span', { style: 'position:relative' }, attachBtn, attachPick))))
    // Zuordnung
    const mapBody = el('tbody')
    for (const f of [...allFeats.values()].sort((a, b) => a.code.localeCompare(b.code))) {
      const cur = attrKeyOf(f.code); const sel = el('select', { style: 'width:100%', onchange: e => { const v = e.target.value; if (v === f.code.toLowerCase() || !v) delete cache.map[f.code]; else cache.map[f.code] = v; saveMap(); draw() } }, el('option', { value: '' }, hasAttr(f.code.toLowerCase()) ? `${f.code.toLowerCase()} (eigenes)` : '— fehlt —'), ...attrs().map(a => el('option', { value: a.key }, `${lbl(a)} (${a.key})`)))
      sel.value = cache.map[f.code] ?? ''
      mapBody.append(el('tr', {}, el('td', { class: 'mono' }, f.code), el('td', {}, featureText(f, locale)), el('td', { class: 'muted' }, TYPE[f.type] ?? f.type, f.type === 'Alphanumeric' ? ` (${f.values.length})` : ''), el('td', { class: 'num muted' }, f.n), el('td', { class: hasAttr(cur) ? '' : 'warn' }, sel)))
    }
    body.append(section('Zuordnung', 'Merkmal → Attribut; leer = eigenes Attribut ef… (wird angelegt)',
      allFeats.size ? el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:90px' }, 'Merkmal'), el('th', {}, 'Name [Einheit]'), el('th', { style: 'width:100px' }, 'Typ'), el('th', { style: 'width:50px' }, 'Kl.'), el('th', { style: 'width:280px' }, 'Attribut'))), mapBody) : el('div', { class: 'empty' }, 'keine Klassen übernommen')))
    // Prüfung
    const rootBtn = el('button', { class: 'x' }, st.root ? `${ICON[tree.byId.get(st.root)?.role] ?? ''} ${tree.byId.get(st.root)?.label ?? ''}` : 'Teilbaum wählen')
    const pick = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:5;width:380px;display:none;padding:6px;background:var(--pane)' })
    ctx.treePicker(pick, { value: st.root, roles: ['group', 'product'], height: 300, onPick: r => { st.root = r.id; rootBtn.textContent = `${ICON[r.role]} ${r.label}`; pick.style.display = 'none'; localStorage.setItem('journali.etim.root', r.id) } })
    rootBtn.addEventListener('click', () => { pick.style.display = pick.style.display === 'none' ? 'block' : 'none' })
    const res = st.result
    body.append(section('Prüfung', 'dieselbe Regel läuft in ✓ Datenqualität',
      el('div', { style: 'display:flex;gap:8px;align-items:center;padding:6px 0' }, el('span', { style: 'position:relative' }, rootBtn, pick), el('button', { class: 'primary', onclick: check }, '▶ prüfen'), res ? el('span', { class: 'muted' }, `${res.findings.length} Funde in ${res.nodes} Knoten`) : null),
      res ? (res.findings.length ? el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:30px' }, ''), el('th', { style: 'width:280px' }, 'Knoten'), el('th', { style: 'width:140px' }, 'Feld'), el('th', {}, 'Fund'))),
        el('tbody', {}, ...res.findings.slice(0, 1000).map(x => el('tr', {}, el('td', { class: x.severity === 'error' ? 'neg' : x.severity === 'warn' ? 'warn' : 'muted' }, SEV[x.severity] ?? ''), el('td', {}, el('a', { href: `/tree/${x.node.id}`, onclick: e => { e.preventDefault(); ctx.go?.(`/tree/${x.node.id}`) } }, `${ICON[x.node.role] ?? ''} ${x.node.label}`)), el('td', { class: 'mono' }, x.attribute ?? ''), el('td', {}, x.message))))) : el('div', { class: 'empty' }, '✓ keine Funde')) : null))
  }
  st.relInfo = await ctx.data.get('release')
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, '⌗ ETIM'), el('span', { class: 'grow' }), status), body)
  draw()
  return () => {}
}

export default {
  views: [
    { path: 'etim', label: 'ETIM', icon: '⌗', topic: 'export', hint: 'ETIM-Klassifikation: Freigabe (IXF) lesen, Klassen übernehmen, Attribute je Merkmal, Zuordnung, Prüfung — Merkmale für den BMEcat-Export', mount },
    { path: 'coverage', label: 'ETIM-Merkmale', icon: '⌗', topic: 'analysis', hint: 'Datenanalyse wie DPP/PPWR: welche Merkmale der ETIM-Klassen fehlen — Attribute anlegen, Vorschläge aus Regeln, KI oder Recherche im Internet, übernehmen', mount: async (root, ctx) => { await cache.loaded; return ctx.compliance.mount(root, ctx, buildCatalog(ctx)) } },
  ],
  nodeActions: [
    { label: 'ETIM-Merkmale prüfen', icon: '⌗', topic: 'analysis', roles: ['group', 'product'], run(id, ctx) { localStorage.setItem('journali.cmp.etim.root', id); ctx.go?.('/p/etim/coverage?run=1') } },
    { label: 'ETIM-Klasse zuweisen …', icon: '⌗', topic: 'analysis', roles: ['group', 'product', 'variant'], run(id, ctx) { ctx.go?.(`/p/etim/etim?assign=${encodeURIComponent(id)}`) } },
  ],
  checks,
  featuresOf: etimFeatures,
  gate: etimGate,
  resolveValue,
}
