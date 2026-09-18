// Prüfkataloge (Taloan, 18.09.2026: „Plugins für DPP und PPWR — prüfen, Best-Guess-Vorschläge, autark oder mit KI“):
// Ein Katalog (das Plugin liefert ihn) beschreibt die Datenpunkte einer Vorschrift — Schlüssel, Bezeichnung, Pflichtgrad,
// Typ, Einheit, Hinweis, Synonyme, Rollen, Prüfregel. Die Maschine hier ist für alle Kataloge dieselbe:
//   1. Zuordnung Datenpunkt → Attribut im Modell (Best Guess über Schlüssel, Label, Synonyme; im Journal gemerkt: „mapping“)
//   2. Prüfung eines Teilbaums: je Knoten und Datenpunkt — erfüllt, leer, kein Attribut, Wert fraglich (Regel)
//   3. Vorschläge: fehlende Attribute anlegen (mit Gruppe), leere Werte ergänzen — regelbasiert (aus vorhandenen Werten
//      ableiten), und mit KI-Schlüssel (Einstellungen) Vorschläge von Claude aus den vorhandenen Werten des Knotens
// Nichts wird ohne Klick geschrieben; Übernehmen geht als ein Stapel ins Journal.
import { api } from './api.js'
import { store } from './store.js'
import { tree } from './tree.js'
import { dialog } from './dialog.js'
import { ai } from './ai.js'
import { norm, similarity, convert, validate } from './mapper.js'

export function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v) } for (const k of kids) if (k != null) e.append(k); return e }

// ---- 1 Zuordnung: Best Guess je Datenpunkt
export function guessMapping(catalog, model) {
  const attrs = model.attributes
  const index = attrs.map(a => ({ a, names: [norm(a.key), ...Object.values(a.label ?? {}).map(norm)].filter(Boolean) }))
  const out = {}
  for (const g of catalog.groups) for (const it of g.items) {
    const wanted = [it.key, ...(it.synonyms ?? [])].map(norm)
    let best = null, score = 0, why = ''
    for (const { a, names } of index) {
      for (const w of wanted) for (const n of names) {
        const s = n === w ? 1 : similarity(n, w)
        if (s > score) { score = s; best = a; why = s === 1 ? 'gleicher Name' : `ähnlich (${Math.round(s * 100)} %)` }
      }
    }
    if (best && score >= 0.8 && (!it.type || !best.type || sameKind(it.type, best.type))) out[it.key] = { to: best.key, why, sure: score === 1 }
    else out[it.key] = { to: '', why: best && score >= 0.6 ? `vielleicht ${best.key} (${Math.round(score * 100)} %)` : 'kein Attribut', sure: false }
  }
  return out
}
const sameKind = (want, have) => want === have || (want === 'decimal' && have === 'integer') || (want === 'text' && ['text', 'html', 'enum'].includes(have)) || (want === 'enum' && have === 'text')

// ---- 2 Prüfung eines Teilbaums
export async function check(catalog, mapping, rootId, say = () => {}) {
  const model = store.model
  const locale = model.masterLocale ?? model.locales[0]?.code ?? 'de'
  const keys = [...new Set(Object.values(mapping).map(m => m.to).filter(Boolean))]
  say('lese …')
  const t = await api.get(`/api/nodes/${encodeURIComponent(rootId)}/table?deep=true&locale=${locale}${keys.length ? '&attributes=' + encodeURIComponent(keys.join(',')) : ''}`)
  const root = t.node
  const rows = [root ? { row: root, values: {} } : null, ...t.rows].filter(Boolean)
  // Werte der Wurzel selbst (table liefert nur Nachfahren)
  if (root) { try { const n = await api.get(`/api/nodes/${encodeURIComponent(rootId)}`); const own = new Map(n.values.map(v => [`${v.attribute}|${v.locale ?? ''}`, v.value])); for (const k of keys) { const v = own.get(`${k}|${locale}`) ?? own.get(`${k}|`) ?? null; if (v != null) rows[0].values[k] = { value: v, own: true } } } catch {} }
  const items = catalog.groups.flatMap(g => g.items.map(it => ({ ...it, group: g })))
  const defs = new Map(model.attributes.map(a => [a.key, a]))
  const result = { nodes: [], items, byItem: new Map(), unmapped: items.filter(it => !mapping[it.key]?.to), locale }
  for (const it of items) result.byItem.set(it.key, { ok: 0, empty: 0, bad: 0, na: 0 })
  for (const r of rows) {
    const node = { row: r.row, raw: Object.fromEntries(Object.entries(r.values).map(([k, v]) => [k, v.value])), states: {}, must: 0, mustOk: 0, findings: [] }
    for (const it of items) {
      if (it.roles && !it.roles.includes(r.row.role)) { node.states[it.key] = 'na'; result.byItem.get(it.key).na++; continue }
      if (it.appliesIf && !it.appliesIf(r, mapping)) { node.states[it.key] = 'na'; result.byItem.get(it.key).na++; continue }
      const to = mapping[it.key]?.to
      const v = to ? r.values[to]?.value ?? null : null
      let state = !to ? 'unmapped' : v == null || v === '' ? 'empty' : 'ok'
      if (state === 'ok') {
        const def = defs.get(to)
        const bad = validate(convert(v, def, model), def, model) ?? (it.rule ? it.rule(v, r, model) : null)
        if (bad) { state = 'bad'; node.findings.push({ item: it, message: bad, value: v }) }
      }
      node.states[it.key] = state
      if (it.level === 'must') { node.must++; if (state === 'ok') node.mustOk++ }
      if (state !== 'unmapped') result.byItem.get(it.key)[state]++
    }
    node.score = node.must ? Math.round(node.mustOk / node.must * 100) : null
    result.nodes.push(node)
  }
  return result
}

// ---- 3 Vorschläge
// Regelbasiert: aus vorhandenen Werten ableiten (Katalog: item.derive(values, row, model) → Wert oder null)
export function deriveSuggestions(catalog, mapping, res) {
  const out = []
  for (const n of res.nodes) for (const it of res.items) {
    if (n.states[it.key] !== 'empty' || !it.derive) continue
    try { const v = it.derive(n.row, vals(res, n, mapping), store.model); if (v != null && v !== '') out.push({ node: n.row, item: it, value: String(v), why: it.deriveWhy ?? 'abgeleitet', source: 'rule' }) } catch {}
  }
  return out
}
// alle bekannten Werte eines Knotens (Zuordnung rückwärts: Datenpunkt → Wert), fürs Ableiten und für die KI
function vals(res, n, mapping) { const o = {}; for (const it of res.items) { const to = mapping[it.key]?.to; if (to && n.states[it.key] === 'ok') o[it.key] = n.raw[to] ?? null } return o }

// Mit KI: je Knoten die leeren Pflicht-Datenpunkte, dazu die vorhandenen Werte des Knotens (alle Attribute) — Claude schlägt vor,
// mit Sicherheit und Begründung; nichts wird geschrieben, der Mensch hakt ab.
export async function aiSuggestions(catalog, mapping, res, nodeIds, say = () => {}) {
  const out = []; const model = store.model
  const locale = res.locale
  for (const id of nodeIds) {
    const n = res.nodes.find(x => x.row.id === id); if (!n) continue
    const missing = res.items.filter(it => n.states[it.key] === 'empty')
    if (!missing.length) continue
    say(`KI: ${n.row.label} …`)
    const view = await api.get(`/api/nodes/${encodeURIComponent(id)}`)
    const known = view.values.filter(v => !v.locale || v.locale === locale).map(v => `${model.attributes.find(a => a.key === v.attribute)?.label?.[locale] ?? v.attribute}: ${String(v.values ? v.values.join(', ') : v.value).replace(/<[^>]+>/g, ' ').slice(0, 300)}`).join('\n')
    const ask = missing.map(it => `- ${it.key}: ${it.label}${it.type ? ` (${it.type}${it.unit ? ' ' + it.unit : ''})` : ''}${it.hint ? ` — ${it.hint}` : ''}${it.values ? ` — erlaubt: ${it.values.join(' | ')}` : ''}`).join('\n')
    const system = `Du bist Datenpfleger in einem PIM. Vorschrift: ${catalog.label} (${catalog.source}). Du bekommst die vorhandenen Attributwerte eines Produkts und eine Liste fehlender Datenpunkte. Schlage nur vor, was sich aus den vorhandenen Werten belastbar ableiten oder als allgemein bekannt für dieses Produkt annehmen lässt; sonst lass den Datenpunkt weg. Antworte NUR mit JSON: { "<key>": { "value": "<Wert im geforderten Typ>", "confidence": 0.0-1.0, "why": "<ein Satz>" } }. Zahlen ohne Einheit, Datum als JJJJ-MM-TT, ja/nein als true/false.`
    const user = `Produkt: ${n.row.label} (${n.row.role}${n.row.sku ? ', SKU ' + n.row.sku : ''})\n\nVorhandene Werte:\n${known || '(keine)'}\n\nFehlende Datenpunkte:\n${ask}`
    try {
      const j = await ai.ask({ system, user, json: true, maxTokens: 1500 })
      for (const it of missing) { const s = j?.[it.key]; if (s && s.value != null && s.value !== '') out.push({ node: n.row, item: it, value: String(s.value), why: s.why ?? '', confidence: s.confidence ?? null, source: 'ai' }) }
    } catch (e) { out.push({ node: n.row, item: null, value: '', why: '✗ ' + e.message, source: 'ai', error: true }) }
  }
  return out
}

// Vorschläge schreiben: attribute.set je Vorschlag (nur zugeordnete Datenpunkte), ein Stapel
export async function applySuggestions(list, mapping, locale) {
  const model = store.model
  const commands = list.filter(s => s.item && mapping[s.item.key]?.to).map(s => { const def = model.attributes.find(a => a.key === mapping[s.item.key].to); return { op: 'attribute.set', args: { node: s.node.id, attribute: def.key, locale: def.perLocale ? locale : null, value: convert(s.value, def, model) ?? s.value } } })
  if (!commands.length) return null
  return api.post('/api/batch', { commands, batch: 'cmp-' + Date.now().toString(36) })
}

// Fehlende Attribute anlegen (Gruppe des Katalogs; die Gruppe wird angelegt, wenn es sie nicht gibt) und die Zuordnung setzen
export async function createAttributes(catalog, items, mapping) {
  const model = store.model
  const gkey = catalog.groupKey
  if (!model.groups.some(g => g.key === gkey)) await api.post(`/api/model/groups/${gkey}`, { key: gkey, label: { de: catalog.groupLabel ?? catalog.label, en: catalog.groupLabel ?? catalog.label }, activeFrom: null }, 'PUT')
  for (const it of items) {
    const key = (catalog.prefix ?? '') + it.key.replace(/[^a-z0-9_]/g, '_')
    const body = { key, label: { de: it.label, en: it.labelEn ?? it.label }, type: it.type === 'enum' && !it.values ? 'text' : (it.type ?? 'text'), group: gkey, unit: it.unit ?? null, axes: it.perLocale ? ['locale'] : [], inheritable: !!it.inheritable, required: it.level === 'must' && it.requiredChannels ? it.requiredChannels : null }
    await api.post(`/api/model/attributes/${key}`, body, 'PUT')
    mapping[it.key] = { to: key, why: 'angelegt', sure: true }
  }
  await store.poll(true)
}

// ---- Die Ansicht — dieselbe für jeden Katalog (das Plugin ruft mount(root, ctx, catalog))
export async function mount(root, ctx, catalog) {
  if (!tree.loaded) await tree.load()
  const model = store.model
  const st = { root: localStorage.getItem(`journali.cmp.${catalog.key}.root`) || tree.rows.find(r => !r.parent)?.id, mapping: null, res: null, sugg: [], filter: 'all', picked: new Set() }
  const saved = await ctx.data.get('mapping')
  st.mapping = guessMapping(catalog, model)
  if (saved) for (const [k, v] of Object.entries(saved)) if (v?.to && model.attributes.some(a => a.key === v.to)) st.mapping[k] = { ...v, why: 'gemerkt', sure: true }
  const remember = () => ctx.data.set('mapping', st.mapping).catch(() => {})
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => { status.textContent = m }
  const body = el('div', { class: 'scroll', style: 'flex:1;padding:0 8px 12px' })
  const band = t => el('div', { class: 'step-band', style: 'margin:10px -8px 6px' }, t)
  const rootIn = el('input', { type: 'search', placeholder: '🔍 Teilbaum (Gruppe/Produkt)', style: 'width:280px', value: tree.byId.get(st.root)?.label ?? '' })
  const pick = el('div', { class: 'picker', style: 'position:absolute;z-index:5;width:380px;display:none' })
  rootIn.addEventListener('input', () => { const q = rootIn.value.trim().toLowerCase(); pick.innerHTML = ''; const hits = q ? tree.rows.filter(r => r.role !== 'variant' && (r.label.toLowerCase().includes(q) || r.id.includes(q))).slice(0, 12) : []; for (const r of hits) pick.append(el('div', { class: 'pick', onmousedown: e => { e.preventDefault(); st.root = r.id; rootIn.value = r.label; pick.style.display = 'none'; localStorage.setItem(`journali.cmp.${catalog.key}.root`, r.id) } }, `${r.role === 'group' ? '▣' : '▦'} ${r.label}`)); pick.style.display = hits.length ? 'block' : 'none' })
  rootIn.addEventListener('blur', () => setTimeout(() => pick.style.display = 'none', 150))
  const s1 = el('div'), s2 = el('div'), s3 = el('div')
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, `${catalog.icon ?? '✓'} ${catalog.label}`), el('a', { href: catalog.source, target: '_blank', class: 'muted', style: 'font-size:12px', title: 'Quelle' }, catalog.sourceLabel ?? 'Quelle ↗'), el('span', { class: 'grow' }), status), body)
  body.append(s1, s2, s3)

  // -- 1 Zuordnung
  function drawMapping() {
    s1.innerHTML = ''
    const n = catalog.groups.reduce((k, g) => k + g.items.length, 0), mapped = Object.values(st.mapping).filter(m => m.to).length
    s1.append(band(`1 · Datenpunkte → Attribute · ${mapped} von ${n} zugeordnet`))
    s1.append(el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:6px' }, catalog.description ?? ''))
    const tbl = el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:34px' }, ''), el('th', { style: 'width:280px' }, 'Datenpunkt'), el('th', { style: 'width:70px' }, 'Typ'), el('th', { style: 'width:280px' }, 'Attribut im Modell'), el('th', {}, 'Hinweis'))))
    const tb = el('tbody'); tbl.append(tb)
    for (const g of catalog.groups) {
      tb.append(el('tr', { class: 'group-row' }, el('td', { colspan: '5' }, `▤ ${g.label}`)))
      for (const it of g.items) {
        const m = st.mapping[it.key]
        const sel = el('select', { style: 'width:100%' }, el('option', { value: '' }, '— kein Attribut —'), ...model.attributes.filter(a => !['rows', 'formula'].includes(a.type)).map(a => el('option', { value: a.key }, `${a.label?.de || a.key} · ${a.key}`)))
        sel.value = m?.to ?? ''
        if (!m?.to) sel.style.color = 'var(--warn)'
        sel.addEventListener('change', () => { st.mapping[it.key] = { to: sel.value, why: 'gewählt', sure: true }; remember(); st.res = null; drawMapping(); drawResult() })
        tb.append(el('tr', {}, el('td', { title: it.level === 'must' ? 'Pflicht' : it.level === 'should' ? 'empfohlen' : 'optional' }, it.level === 'must' ? '●' : it.level === 'should' ? '◐' : '○'),
          el('td', {}, el('b', {}, it.label), el('div', { class: 'mono muted', style: 'font-size:11px' }, it.key)),
          el('td', { class: 'muted' }, `${it.type ?? 'text'}${it.unit ? ' ' + it.unit : ''}`),
          el('td', {}, sel, el('div', { class: 'muted', style: 'font-size:11px' }, m?.why ?? '')),
          el('td', { class: 'muted', style: 'font-size:12px;white-space:normal' }, it.hint ?? '')))
      }
    }
    s1.append(tbl)
    const missing = catalog.groups.flatMap(g => g.items).filter(it => !st.mapping[it.key]?.to)
    const bar = el('div', { class: 'chips', style: 'margin-top:6px' })
    if (missing.length) bar.append(el('button', { class: 'primary', onclick: async () => {
      const ok = await dialog.confirm({ title: `${missing.length} Attribute anlegen?`, warn: `Gruppe „${catalog.groupKey}“ mit ${missing.length} neuen Attributen im Modell`, list: missing.map(it => `${(catalog.prefix ?? '') + it.key} · ${it.type ?? 'text'}${it.unit ? ' ' + it.unit : ''} — ${it.label}`), text: 'Die Gruppe muss danach an den Knoten hängen, an denen sie gelten soll (Attributgruppen NEU ab diesem Knoten).', ok: 'Anlegen' })
      if (!ok) return
      say('lege an …'); try { await createAttributes(catalog, missing, st.mapping); await remember(); store.toast(`✓ ${missing.length} Attribute in ${catalog.groupKey}`); say('') } catch (e) { store.toast(e.message); say('✗ ' + e.message) }
      drawMapping()
    } }, `+ ${missing.length} fehlende Attribute anlegen (Gruppe ${catalog.groupKey})`))
    bar.append(el('button', { onclick: () => { st.mapping = guessMapping(catalog, model); remember(); drawMapping() }, title: 'Zuordnung neu raten' }, '↻ Best Guess'))
    s1.append(bar)
  }

  // -- 2 Prüfung
  function drawRun() {
    s2.innerHTML = ''
    s2.append(band('2 · Prüfen'))
    s2.append(el('div', { class: 'chips' }, el('span', { style: 'position:relative' }, rootIn, pick), el('button', { class: 'primary', onclick: run }, '▶ prüfen'),
      el('span', { class: 'muted', style: 'font-size:12px' }, '● Pflicht · ◐ empfohlen · ○ optional — Anteil erfüllter Pflicht-Datenpunkte je Knoten')))
  }
  async function run() {
    if (!st.root) return
    try { st.res = await check(catalog, st.mapping, st.root, say); st.sugg = deriveSuggestions(catalog, st.mapping, st.res); say(`${st.res.nodes.length} Knoten geprüft`); drawResult() }
    catch (e) { say('✗ ' + e.message); store.toast(e.message) }
  }
  const SYM = { ok: '✓', empty: '·', bad: '✗', unmapped: '—', na: '' }
  const CLS = { ok: 'pos', empty: 'muted', bad: 'neg', unmapped: 'muted', na: 'muted' }
  function drawResult() {
    s3.innerHTML = ''
    const r = st.res; if (!r) return
    const scored = r.nodes.filter(n => n.score != null)
    const avg = scored.length ? Math.round(scored.reduce((k, n) => k + n.score, 0) / scored.length) : null
    s3.append(band(`3 · Ergebnis · ${r.nodes.length} Knoten${avg != null ? ` · Pflicht im Schnitt ${avg} %` : ''}${r.unmapped.length ? ` · ${r.unmapped.length} Datenpunkte ohne Attribut` : ''}`))
    // je Datenpunkt: Zusammenfassung
    const sum = el('table', { class: 'grid', style: 'width:auto' }, el('thead', {}, el('tr', {}, el('th', {}, 'Datenpunkt'), el('th', { class: 'num' }, '✓'), el('th', { class: 'num' }, 'leer'), el('th', { class: 'num' }, '✗'), el('th', {}, ''))))
    const sb = el('tbody'); sum.append(sb)
    for (const it of r.items) { const c = r.byItem.get(it.key); const to = st.mapping[it.key]?.to; sb.append(el('tr', {}, el('td', {}, `${it.level === 'must' ? '●' : it.level === 'should' ? '◐' : '○'} ${it.label}`), el('td', { class: 'num pos' }, String(c.ok)), el('td', { class: 'num muted' }, String(c.empty)), el('td', { class: 'num ' + (c.bad ? 'neg' : 'muted') }, String(c.bad)), el('td', { class: 'muted', style: 'font-size:11px' }, to ? '' : 'kein Attribut — oben zuordnen oder anlegen'))) }
    s3.append(el('details', { open: '' }, el('summary', { class: 'muted' }, 'je Datenpunkt'), sum))
    // je Knoten: Matrix
    const items = r.items.filter(it => st.mapping[it.key]?.to)
    const tbl = el('table', { class: 'grid', style: 'width:auto;margin-top:8px' })
    tbl.append(el('thead', {}, el('tr', {}, el('th', { style: 'width:28px' }, el('input', { type: 'checkbox', title: 'alle für KI-Vorschläge', onchange: e => { st.picked = e.target.checked ? new Set(r.nodes.map(n => n.row.id)) : new Set(); drawResult() } })), el('th', { style: 'width:300px' }, 'Knoten'), el('th', { class: 'num', style: 'width:60px' }, 'Pflicht'), ...items.map(it => el('th', { title: `${it.label} → ${st.mapping[it.key].to}`, style: 'writing-mode:vertical-rl;transform:rotate(180deg);max-height:120px;font-weight:400;font-size:11px' }, it.label.slice(0, 22))))))
    const tb = el('tbody'); tbl.append(tb)
    for (const n of r.nodes) {
      const cb = el('input', { type: 'checkbox' }); cb.checked = st.picked.has(n.row.id); cb.addEventListener('change', () => { cb.checked ? st.picked.add(n.row.id) : st.picked.delete(n.row.id) })
      tb.append(el('tr', {}, el('td', {}, cb), el('td', {}, el('a', { href: `/tree/${n.row.id}`, onclick: e => { e.preventDefault(); ctx.go?.(`/tree/${n.row.id}`) }, title: n.row.id }, `${n.row.role === 'variant' ? '◆' : n.row.role === 'product' ? '▦' : '▣'} ${n.row.label}`)),
        el('td', { class: 'num ' + (n.score == null ? 'muted' : n.score === 100 ? 'pos' : n.score < 50 ? 'neg' : 'warn') }, n.score == null ? '–' : n.score + ' %'),
        ...items.map(it => { const s = n.states[it.key]; const f = n.findings.find(x => x.item.key === it.key); return el('td', { class: CLS[s], style: 'text-align:center', title: f ? f.message : s === 'ok' ? 'erfüllt' : s === 'empty' ? 'leer' : '' }, SYM[s]) })))
    }
    s3.append(tbl)
    // Befunde (fragliche Werte)
    const bad = r.nodes.flatMap(n => n.findings.map(f => ({ n, f })))
    if (bad.length) s3.append(el('div', { style: 'margin-top:8px' }, el('b', { class: 'neg' }, `✗ ${bad.length} fragliche Werte`), el('ul', { style: 'margin:4px 0 0 18px;font-size:12px' }, ...bad.slice(0, 50).map(({ n, f }) => el('li', {}, `${n.row.label} · ${f.item.label}: ${f.message}`)))))
    // Vorschläge
    const box = el('div', { style: 'margin-top:10px' })
    const bar = el('div', { class: 'chips' },
      el('button', { onclick: () => { st.sugg = deriveSuggestions(catalog, st.mapping, r); drawSugg() }, title: 'aus vorhandenen Werten ableiten (Regeln des Katalogs)' }, '⚙ Vorschläge (regelbasiert)'),
      el('button', { class: ai.available() ? 'primary' : '', disabled: ai.available() ? null : 'disabled', title: ai.available() ? `Claude (${ai.model}) schlägt Werte für die angehakten Knoten vor` : 'kein KI-Schlüssel — Einstellungen → KI (Claude)', onclick: async () => {
        const ids = st.picked.size ? [...st.picked] : r.nodes.filter(n => n.score != null && n.score < 100).slice(0, 10).map(n => n.row.id)
        if (!ids.length) { store.toast('keine Knoten mit Lücken'); return }
        if (ids.length > 25 && !(await dialog.confirm({ title: `${ids.length} Knoten an die KI?`, warn: `${ids.length} Anfragen an ${ai.model}`, ok: 'Ja' }))) return
        const s = await aiSuggestions(catalog, st.mapping, r, ids, say); st.sugg = [...st.sugg.filter(x => x.source !== 'ai'), ...s]; say(`${s.filter(x => !x.error).length} KI-Vorschläge`); drawSugg()
      } }, `✦ Vorschläge mit KI${ai.available() ? '' : ' (kein Schlüssel)'}`),
      el('span', { class: 'muted', style: 'font-size:12px' }, st.picked.size ? `${st.picked.size} Knoten angehakt` : 'ohne Haken: die ersten 10 mit Lücken'))
    box.append(bar); const list = el('div'); box.append(list); s3.append(box)
    function drawSugg() {
      list.innerHTML = ''
      if (!st.sugg.length) { list.append(el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px' }, 'keine Vorschläge')); return }
      const t = el('table', { class: 'grid', style: 'width:100%;margin-top:6px' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:28px' }, ''), el('th', { style: 'width:260px' }, 'Knoten'), el('th', { style: 'width:220px' }, 'Datenpunkt'), el('th', { style: 'width:220px' }, 'Vorschlag'), el('th', { style: 'width:50px' }, ''), el('th', {}, 'Warum'))))
      const tb = el('tbody'); t.append(tb)
      const take = new Set(st.sugg.filter(s => !s.error && (s.confidence == null || s.confidence >= 0.7)))
      for (const s of st.sugg) {
        const cb = el('input', { type: 'checkbox' }); cb.checked = take.has(s); cb.disabled = !!s.error; cb.addEventListener('change', () => { cb.checked ? take.add(s) : take.delete(s) })
        const val = el('input', { type: 'text', value: s.value, style: 'width:100%' }); val.addEventListener('input', () => { s.value = val.value })
        tb.append(el('tr', { class: s.error ? 'neg' : '' }, el('td', {}, cb), el('td', {}, s.node.label), el('td', {}, s.item ? s.item.label : '—'), el('td', {}, s.error ? '' : val), el('td', { class: 'muted', style: 'font-size:11px' }, s.source === 'ai' ? `✦ ${s.confidence != null ? Math.round(s.confidence * 100) + ' %' : ''}` : '⚙'), el('td', { class: 'muted', style: 'font-size:12px;white-space:normal' }, s.why)))
      }
      list.append(t, el('div', { class: 'chips', style: 'margin-top:6px' }, el('button', { class: 'primary', onclick: async () => {
        const chosen = [...take]; if (!chosen.length) return
        const ok = await dialog.confirm({ title: `${chosen.length} Werte übernehmen?`, warn: `${chosen.length} Attributwerte als ein Stapel ins Journal`, list: chosen.slice(0, 8).map(s => `${s.node.label} · ${s.item.label} = ${s.value}`), ok: 'Übernehmen' })
        if (!ok) return
        try { const res = await applySuggestions(chosen, st.mapping, r.locale); store.toast(`✓ ${res?.results.length ?? 0} Werte geschrieben`); await store.poll(true); await run() } catch (e) { store.toast(e.message) }
      } }, '💾 angehakte übernehmen'), el('span', { class: 'muted', style: 'font-size:12px' }, 'Vorschläge ab 70 % Sicherheit sind vorangehakt — jeder Wert lässt sich vorher ändern')))
    }
    drawSugg()
  }
  drawMapping(); drawRun(); drawResult()
  return () => {}
}
