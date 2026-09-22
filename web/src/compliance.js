// Prüfkataloge (Taloan, 18.09.2026: „Plugins für DPP und PPWR — prüfen, Best-Guess-Vorschläge, autark oder mit KI“):
// Ein Katalog (das Plugin liefert ihn) beschreibt die Datenpunkte einer Vorschrift — Schlüssel, Bezeichnung, Pflichtgrad,
// Typ, Einheit, Hinweis, Synonyme, Rollen, Prüfregel. Die Maschine hier ist für alle Kataloge dieselbe:
//   1. Zuordnung Datenpunkt → Attribut im Modell (Best Guess über Schlüssel, Label, Synonyme; im Journal gemerkt: „mapping“)
//   2. Prüfung eines Teilbaums: je Knoten und Datenpunkt — erfüllt, leer, kein Attribut, Wert fraglich (Regel)
//   3. Vorschläge: fehlende Attribute anlegen (mit Gruppe), leere Werte ergänzen — regelbasiert (aus vorhandenen Werten
//      ableiten), und mit KI-Schlüssel (Einstellungen) Vorschläge der KI aus den vorhandenen Werten des Knotens
// Nichts wird ohne Klick geschrieben; Übernehmen geht als ein Stapel ins Journal.
import { api } from './api.js'
import { store } from './store.js'
import { tree } from './tree.js'
import { dialog } from './dialog.js'
import { ai } from './ai.js'
import { norm, similarity } from './mapper.js'
import { analyze } from './compliance-core.js'
import { treePicker } from './treePicker.js'

export function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v) } for (const k of kids) if (k != null) e.append(k); return e }

// ---- 1 Zuordnung: Best Guess je Datenpunkt
export function guessMapping(catalog, model) {
  const attrs = model.attributes
  const index = attrs.map(a => ({ a, names: [norm(a.key), ...Object.values(a.label ?? {}).map(norm)].filter(Boolean) }))
  const out = {}
  for (const g of catalog.groups) for (const it of g.items) {
    // feste Zuordnung (Katalog nennt das Attribut, z. B. ETIM ef… → ef…): nie raten — „Height ≈ Gewicht (80 %)“ war Unsinn (Taloan, 20.09.)
    if (it.to !== undefined) { const ok = it.to && attrs.some(a => a.key === it.to); out[it.key] = { to: ok ? it.to : '', why: ok ? 'fest' : 'kein Attribut', sure: ok, fixed: true }; continue }
    const wanted = [it.key, ...(it.synonyms ?? [])].map(norm)
    let best = null, score = 0, why = ''
    for (const { a, names } of index) {
      for (const w of wanted) for (const n of names) {
        const s = n === w ? 1 : similarity(n, w)
        if (s > score) { score = s; best = a; why = s === 1 ? 'gleicher Name' : `ähnlich (${Math.round(s * 100)} %)` }
      }
    }
    if (best && score >= 0.8 && (!it.type || !best.type || sameKind(it.type, best.type))) out[it.key] = { to: best.key, why, sure: score === 1 }
    else out[it.key] = { to: '', why: 'kein Attribut', sure: false }
  }
  return out
}
const sameKind = (want, have) => want === have || (want === 'decimal' && have === 'integer') || (want === 'text' && ['text', 'html', 'enum'].includes(have)) || (want === 'enum' && have === 'text')

// ---- 2 Prüfung eines Teilbaums — Zeilen holen, rechnen tut compliance-core.js (testbar ohne Browser)
export async function check(catalog, mapping, rootId, say = () => {}) {
  const model = store.model
  const locale = model.masterLocale ?? model.locales[0]?.code ?? 'de'
  // Schritt 0 (Taloan, 20.09.: „der Anwender legt fest, was für den Knoten gilt — Richtlinie oder Sondergruppe“): Gruppen des Katalogs mit
  // scope gelten nur an Knoten, deren Geltungsattribut (vererbbar, z. B. dpp_scope = battery) die Geltung nennt
  const scopeAttr = catalog.groups.some(g => g.scope) ? `${catalog.key}_scope` : null
  const keys = [...new Set([...Object.values(mapping).map(m => m.to).filter(Boolean), ...(scopeAttr && model.attributes.some(a => a.key === scopeAttr) ? [scopeAttr] : [])])]
  say('lese …')
  const t = await api.get(`/api/nodes/${encodeURIComponent(rootId)}/table?deep=true&self=true&locale=${locale}${keys.length ? '&attributes=' + encodeURIComponent(keys.join(',')) : ''}`)
  const root = t.node
  // Wurzel als erste Zeile, aufgelöst wie die Nachfahren — geerbt zählt (Taloan, 21.09.: Geltung am Vater, Prüfung am Kind sagte „gilt hier nicht“).
  // Älterer Server ohne self: wie bisher nur die eigenen Werte der Wurzel (Listenwerte stehen dort in values, nicht value)
  const selfRow = root ? t.rows.find(r => r.row.id === root.id) : null
  const rows = [root && !selfRow ? { row: root, values: {} } : null, ...t.rows].filter(Boolean)
  if (root && !selfRow) { try { const n = await api.get(`/api/nodes/${encodeURIComponent(rootId)}`); const own = new Map(n.values.map(v => [`${v.attribute}|${v.locale ?? ''}`, v.value ?? (v.values ? v.values.join(', ') : null)])); for (const k of keys) { const v = own.get(`${k}|${locale}`) ?? own.get(`${k}|`) ?? null; if (v != null) rows[0].values[k] = { value: v, own: true } } } catch {} }
  const onPath = (id, g) => [tree.byId.get(id), ...tree.ancestors(id)].some(x => (x?.groups ?? '').split(',').includes(g))
  return analyze({ catalog, mapping, model, rows, locale, scopeAttr, onPath })
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

// Mit KI: je Knoten die leeren Pflicht-Datenpunkte, dazu die vorhandenen Werte des Knotens (alle Attribute) — die KI schlägt vor,
// mit Sicherheit und Begründung; nichts wird geschrieben, der Mensch hakt ab.
// web: true (Taloan, 20.09.2026: Produkte, die ich handle, nicht herstelle — die Daten stehen beim Hersteller, nicht bei mir):
// die KI sucht im Internet nach Hersteller, Typ, EAN und liest Datenblätter; jeder Vorschlag nennt seine Quelle.
export async function aiSuggestions(catalog, mapping, res, nodeIds, say = () => {}, { web = false } = {}) {
  const out = []; const model = store.model
  const locale = res.locale
  for (const id of nodeIds) {
    const n = res.nodes.find(x => x.row.id === id); if (!n) continue
    const missing = res.items.filter(it => n.states[it.key] === 'empty')
    if (!missing.length) continue
    say(`${web ? 'Recherche' : 'KI'}: ${n.row.label} …`)
    const view = await api.get(`/api/nodes/${encodeURIComponent(id)}`)
    const known = view.values.filter(v => !v.locale || v.locale === locale).map(v => `${model.attributes.find(a => a.key === v.attribute)?.label?.[locale] ?? v.attribute}: ${String(v.values ? v.values.join(', ') : v.value).replace(/<[^>]+>/g, ' ').slice(0, 300)}`).join('\n')
    const ask = missing.map(it => `- ${it.key}: ${it.label}${it.type ? ` (${it.type}${it.unit ? ' ' + it.unit : ''})` : ''}${it.hint ? ` — ${it.hint}` : ''}${it.values ? ` — erlaubt: ${it.values.join(' | ')}` : ''}`).join('\n')
    const system = `Du bist Datenpfleger in einem PIM. Vorschrift: ${catalog.label} (${catalog.source}). Du bekommst die vorhandenen Attributwerte eines Produkts und eine Liste fehlender Datenpunkte. Schlage nur vor, was sich aus den vorhandenen Werten belastbar ableiten oder als allgemein bekannt für dieses Produkt annehmen lässt; sonst lass den Datenpunkt weg. Antworte NUR mit JSON: { "<key>": { "value": "<Wert im geforderten Typ>", "confidence": 0.0-1.0, "why": "<ein Satz>" } }. Zahlen ohne Einheit, Datum als JJJJ-MM-TT, ja/nein als true/false.`
    const user = `Produkt: ${n.row.label} (${n.row.role}${n.row.keys ? ', ' + Object.entries(n.row.keys).map(([k, v]) => `${k} ${v}`).join(', ') : ''})\n\nVorhandene Werte:\n${known || '(keine)'}\n\nFehlende Datenpunkte:\n${ask}`
    const research = web ? `\n\nRecherchiere im Internet: Suche das Produkt über Hersteller, Typ-/Artikelnummer, EAN/GTIN und SKU (Herstellerseite, Datenblatt, Katalog, Händler). Nimm nur Werte, die du dort findest; nenne je Datenpunkt die Quelle (url) in "source". Was du nicht findest, lässt du weg. Antworte nur mit dem JSON-Objekt, ohne Text davor oder danach.` : ''
    const ids = web ? Object.entries(view.external ?? {}).map(([k, v]) => `${k}: ${v}`).join(', ') : ''
    try {
      const j = await ai.ask({ system: system + research, user: user + (ids ? `\nKennungen: ${ids}` : ''), json: true, maxTokens: web ? 3000 : 1500, web, maxSearches: 6 })
      const src = ai.lastSources
      for (const it of missing) { const s = j?.[it.key]; if (s && s.value != null && s.value !== '') out.push({ node: n.row, item: it, value: String(s.value), why: s.why ?? '', confidence: s.confidence ?? null, source: web ? 'web' : 'ai', url: s.source ?? src[0]?.url ?? null, sources: src }) }
    } catch (e) { out.push({ node: n.row, item: null, value: '', why: '✗ ' + e.message, source: 'ai', error: true }) }
  }
  return out
}

// Vorschläge schreiben: attribute.set je Vorschlag (nur zugeordnete Datenpunkte) und dazu der Beleg (value.source: Quelle, Weg,
// Prüfdatum — Taloan, 20.09.: „Quelle: URL, geprüft am …“ am Wert, nicht nur am Vorschlag), ein Stapel
export async function applySuggestions(list, mapping, locale) {
  const model = store.model; const today = new Date().toISOString().slice(0, 10)
  const commands = list.filter(s => s.item && mapping[s.item.key]?.to).flatMap(s => {
    const def = model.attributes.find(a => a.key === mapping[s.item.key].to); const loc = def.perLocale ? locale : null
    const source = s.url ?? (s.source === 'ai' ? `KI (${ai.label()})` : s.source === 'web' ? `Recherche (${ai.label()})` : `Regel: ${s.why || 'abgeleitet'}`)
    return [{ op: 'attribute.set', args: { node: s.node.id, attribute: def.key, locale: loc, value: convert(s.value, def, model) ?? s.value } },
      { op: 'value.source', args: { node: s.node.id, attribute: def.key, locale: loc, source, title: s.url ? (s.why || null) : null, note: s.confidence != null ? `Sicherheit ${Math.round(s.confidence * 100)} %` : null, method: s.source === 'web' ? 'web' : s.source === 'ai' ? 'ai' : 'rule', checkedAt: today } }]
  })
  if (!commands.length) return null
  return api.post('/api/batch', { commands, batch: 'cmp-' + Date.now().toString(36) })
}

// Fehlende Attribute anlegen (Gruppe des Katalogs; die Gruppe wird angelegt, wenn es sie nicht gibt) und die Zuordnung setzen
// Einheit sicherstellen: Symbol wie „kg“, „%“, „kWh“ → vorhandener Schlüssel oder neu (u_…, Grösse = Symbol)
const UNIT_NAMES = { '%': 'Prozent', 'kg': 'Masse', 'g': 'Masse', 'mm': 'Länge', 'cm': 'Länge', 'm': 'Länge', 'kWh': 'Energie', 'Wh': 'Energie', 'W': 'Leistung', 'V': 'Spannung', 'A': 'Strom', 'l': 'Volumen', 'ml': 'Volumen', 'mg/kg': 'Konzentration', 'ppm': 'Konzentration', 'kg CO₂e': 'Treibhausgas', 'h': 'Zeit', 'a': 'Zeit', 'Jahre': 'Zeit' }
export async function ensureUnit(sym) {
  const units = store.model.units ?? []
  const hit = units.find(u => u.key === sym || u.key === sym.toLowerCase() || Object.values(u.label ?? {}).some(l => l === sym)); if (hit) return hit.key
  // Einheitenschlüssel ist das Symbol selbst (wie kg, cm, %): höchstens 8 Zeichen, ohne Leerraum — „kg CO₂e“ → „kgCO2e“
  const key = sym.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').slice(0, 8) || 'x'
  if (!units.some(u => u.key === key)) { await api.post(`/api/model/units/${key}`, { key, label: { de: sym, en: sym }, quantity: UNIT_NAMES[sym] ?? sym, factor: 1 }, 'PUT'); await store.poll(true) }
  return key
}

export async function createAttributes(catalog, items, mapping) {
  const model = store.model
  const gkey = catalog.groupKey
  if (!model.groups.some(g => g.key === gkey)) await api.post(`/api/model/groups/${gkey}`, { key: gkey, label: { de: catalog.groupLabel ?? catalog.label, en: catalog.groupLabel ?? catalog.label }, activeFrom: null }, 'PUT')
  for (const it of items) {
    if (catalog.createAttribute) { const key = await catalog.createAttribute(it); if (key) mapping[it.key] = { to: key, why: 'angelegt', sure: true }; continue }   // der Katalog weiß es besser (etim: Listen, Einheiten)
    const key = (catalog.prefix ?? '') + it.key.replace(/[^a-z0-9_]/g, '_')
    // Einheit: vorhandene nehmen (Schlüssel oder Bezeichnung), sonst anlegen — „Unbekannte Einheit: %“ war der Abbruch (Taloan, 20.09.)
    const unit = it.unit ? await ensureUnit(it.unit) : null
    const body = { key, label: { de: it.label, en: it.labelEn ?? it.label }, type: it.type === 'enum' && !it.values ? 'text' : (it.type ?? 'text'), group: gkey, unit, axes: it.perLocale ? ['locale'] : [], inheritable: !!it.inheritable, required: it.level === 'must' && it.requiredChannels ? it.requiredChannels : null }
    await api.post(`/api/model/attributes/${key}`, body, 'PUT')
    mapping[it.key] = { to: key, why: 'angelegt', sure: true }
  }
  await store.poll(true)
}

// Geltungen vorschlagen: (1) Regeln des Katalogs gegen die wirksame ETIM-Klasse des Knotens (Code, Name, Gruppe), (2) die KI mit
// Produkt, Pfad, Klasse und den Geltungen samt Hinweis — Antwort je Geltung ja/nein mit Begründung. Null, wenn beides fehlt.
async function suggestScopes(catalog, rootRow, scopes, have) {
  if (!rootRow) return null
  // wirksame ETIM-Klasse: eigen oder von oben
  let code = null
  try {
    const n = await api.get(`/api/nodes/${encodeURIComponent(rootRow.id)}`)
    code = n.values?.find(v => v.attribute === 'etim_class' && !v.locale && !v.channel && !v.row)?.value ?? null
    if (!code) for (const a of n.ancestors ?? []) { const v = a.values?.find(v => v.attribute === 'etim_class' && !v.locale && !v.channel)?.value; if (v) { code = v; break } }
  } catch { }
  let cls = null
  if (code) { try { const rel = await api.get('/api/plugins/etim/data/release'); const ver = rel?.version ?? (rel?.number != null ? String(rel.number) : null); cls = (ver != null ? await api.get('/api/plugins/etim/data/' + encodeURIComponent(`class:${ver}:${code}`)).catch(() => null) : null) ?? await api.get('/api/plugins/etim/data/' + encodeURIComponent('class:' + code)).catch(() => null) } catch { } }
  const loc = store.model.masterLocale ?? 'de'
  const clsText = cls ? `${cls.code} ${cls.name?.[loc] ?? cls.name?.en ?? ''}${cls.group ? ' · Gruppe ' + (cls.group.name?.[loc] ?? cls.group.name?.en ?? cls.group.code) : ''}` : (code ?? '')
  const items = []
  const rules = catalog.scopeRules ?? []
  if (cls) for (const s of scopes) {
    const hay = `${cls.code} ${Object.values(cls.name ?? {}).join(' ')} ${Object.values(cls.synonyms ?? {}).flat().join(' ')} ${cls.group ? Object.values(cls.group.name ?? {}).join(' ') + ' ' + cls.group.code : ''}`
    const rule = rules.find(r => r.scope === s.key)
    if (rule) { const hit = (rule.match ?? []).find(re => re.test(hay)); items.push({ key: s.key, applies: !!hit, why: hit ? `${rule.why ?? 'ETIM'}: ${clsText}` : `ETIM ${cls.code} ${cls.name?.[loc] ?? cls.name?.en ?? ''}` }) }
  }
  let usedAi = false
  if (ai.available()) {
    try {
      const j = await ai.ask({ system: 'Du prüfst, welche Sonderregelungen für ein Produkt gelten. Antworte nur als JSON {"items":[{"key":"…","applies":true,"why":"…"}]} für jede Geltung aus der Liste, why in einem kurzen Satz auf Deutsch, vorsichtig: im Zweifel nein mit Begründung.', user: `Produkt: ${rootRow.label}\nPfad: ${tree.ancestors(rootRow.id).map(a => a.label).join(' › ')}\nETIM-Klasse: ${clsText || 'unbekannt'}\nGeltungen:\n${scopes.map(s => `${s.key}: ${s.label}${s.hint ? ' — ' + s.hint : ''}`).join('\n')}`, json: true, maxTokens: 600 })
      for (const it of j.items ?? []) { const s = scopes.find(x => x.key === it.key); if (!s) continue; const cur = items.find(x => x.key === it.key); if (cur) { if (cur.applies !== !!it.applies) cur.why += ` · KI: ${it.applies ? 'ja' : 'nein'} — ${it.why ?? ''}`; else cur.why = it.why ?? cur.why } else items.push({ key: it.key, applies: !!it.applies, why: it.why ?? '' }) }
      usedAi = true
    } catch (e) { if (!items.length) throw e }
  }
  if (!items.length) return null
  return { items: scopes.map(s => items.find(x => x.key === s.key)).filter(Boolean), ai: usedAi, class: clsText }
}

// Ebene wählen (Taloan, 20.09.: „wir wissen nicht, wo der Anwender anfängt“): der Pfad von der Wurzel bis zum Knoten als Chips —
// je Ebene Produkte darunter, Untergruppen, Knoten mit anderem Wert (≠). Empfehlung: die höchste Ebene ohne Untergruppen und ohne
// Widerspruch. Liefert die gewählte Zeile oder null. attr/wanted: welches Attribut und welcher Wert gesetzt werden soll (für ≠).
async function pickLevel(row, title, { attr = null, wanted = null } = {}) {
  const chain = [...tree.ancestors(row.id), row]
  const vals = new Map()
  if (attr && store.model.attributes.some(a => a.key === attr)) { try { const t = await api.get(`/api/nodes/${encodeURIComponent(chain[0].id)}/table?deep=true&self=true&attributes=${encodeURIComponent(attr)}`); for (const r of t.rows ?? []) vals.set(r.row.id, String(r.values?.[attr]?.value ?? '')) } catch { } }
  const under = id => { const out = []; const walk = x => { for (const k of tree.kids(x)) { if (k.role !== 'group') out.push(k); walk(k.id) } }; walk(id); return out }
  const conflicts = v => { if (!wanted) return false; const list = v.split(',').map(s => s.trim()).filter(Boolean); return list.length > 0 && !list.includes(wanted) }
  const out = chain.map(n => { const ns = n.role === 'group' ? under(n.id) : [n, ...under(n.id)]; return { node: n, products: ns.filter(x => x.role === 'product').length || ns.length, groups: n.role === 'group' ? tree.kids(n.id).filter(k => k.role === 'group').length : 0, other: ns.filter(x => conflicts(vals.get(x.id) ?? '')).length } })
  let rec = out.length - 1; for (let i = 0; i < out.length; i++) if (out[i].other === 0 && out[i].products > 0 && out[i].groups === 0) { rec = i; break }
  return new Promise(resolve => {
    const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:30' })
    const box = el('div', { style: 'width:min(640px,94vw);background:var(--pane);border:1px solid var(--line);border-radius:8px;padding:12px;font-size:13px' })
    let target = out[rec].node
    const note = el('div', { class: 'muted', style: 'font-size:12px;margin:4px 0 8px' })
    const noteOf = (l, i) => l.other ? `⚠ ${l.other} Knoten darunter sind schon anders eingeordnet — ab hier zu grob; granularer setzen.` : l.groups ? `⚠ ${l.groups} Untergruppen mit ${l.products} Produkten darunter — gilt das wirklich für alle? Meist zu grob.` : l.products > 1 ? `gilt für ${l.products} Produkte darunter (vererbbar)${i === rec ? ' — Empfehlung' : ''}` : l.products === 1 ? 'gilt für dieses eine Produkt' : 'keine Produkte darunter — gilt, sobald welche kommen'
    const btns = out.map((l, i) => el('button', { class: i === rec ? 'primary' : '', title: `${l.products} Produkte darunter${l.groups ? ` · ${l.groups} Untergruppen` : ''}${l.other ? ` · ${l.other} anders eingeordnet` : ''}${i === rec ? ' · Empfehlung' : ''}`, onclick: () => { target = l.node; btns.forEach((b, k) => b.className = k === i ? 'primary' : ''); note.textContent = noteOf(l, i) } }, `${l.node.label} `, el('span', { class: l.other ? 'neg' : l.groups ? 'warn' : 'muted', style: 'font-size:11px' }, `${l.products}${l.groups ? ` · ${l.groups} ▣` : ''}${l.other ? ` · ${l.other} ≠` : ''}`)))
    note.textContent = noteOf(out[rec], rec)
    const done = v => { overlay.remove(); resolve(v) }
    box.append(el('div', { style: 'font-weight:600;margin-bottom:6px' }, title), el('div', { class: 'muted', style: 'font-size:12px' }, `Gilt ab (Pfad von der Wurzel bis „${row.label}“ — Zahl: Produkte darunter · ▣ Untergruppen · ≠ anders eingeordnet):`), el('div', { class: 'chips', style: 'margin:4px 0' }, ...btns), note,
      el('div', { class: 'chips', style: 'justify-content:flex-end;margin-top:8px' }, el('button', { onclick: () => done(null) }, 'Abbrechen'), el('button', { class: 'primary', onclick: () => done(target) }, 'OK')))
    overlay.append(box); document.body.append(overlay)
  })
}

// Knoten wählen: kleiner Auswahlbaum als Fenster, Vorgabe vorbelegt — liefert die Zeile oder null
function pickNode(preset, title) {
  return new Promise(resolve => {
    const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:30' })
    const box = el('div', { style: 'width:420px;background:var(--pane);border:1px solid var(--line);border-radius:8px;padding:10px;font-size:13px' })
    let chosen = preset ?? null
    const host = el('div')
    treePicker(host, { value: preset?.id ?? null, roles: ['group', 'product', 'variant'], height: 320, onPick: r => { chosen = r } })
    const done = v => { overlay.remove(); resolve(v) }
    box.append(el('div', { style: 'font-weight:600;margin-bottom:6px' }, title), host, el('div', { class: 'chips', style: 'justify-content:flex-end;margin-top:8px' }, el('button', { onclick: () => done(null) }, 'Abbrechen'), el('button', { class: 'primary', onclick: () => done(chosen) }, 'OK')))
    overlay.append(box); document.body.append(overlay)
  })
}

// ---- Die Ansicht — dieselbe für jeden Katalog (das Plugin ruft mount(root, ctx, catalog))
export async function mount(root, ctx, catalog) {
  if (!tree.loaded) await tree.load()
  const model = store.model
  const st = { root: localStorage.getItem(`journali.cmp.${catalog.key}.root`) || tree.rows.find(r => !r.parent)?.id, mapping: null, res: null, sugg: [], filter: 'all', picked: new Set(), levels: new Set(['must', 'should', 'may']), only: 'all' }
  const saved = await ctx.data.get('mapping')
  const savedGroup = await ctx.data.get('group').catch(() => null); if (typeof savedGroup === 'string' && savedGroup) catalog.groupKey = savedGroup
  // Abgelehnte Vorschläge zur Geltung („nein“ zu „Vorschlag ja“) je Knoten — gemerkt, damit die Frage nicht wiederkommt (Taloan, 21.09.)
  st.declined = (await ctx.data.get('scopes_declined').catch(() => null)) ?? {}
  const decline = async (nodeId, key, on) => { const l = new Set(st.declined[nodeId] ?? []); on ? l.add(key) : l.delete(key); st.declined[nodeId] = [...l]; await ctx.data.set('scopes_declined', st.declined).catch(() => {}) }
  st.mapping = guessMapping(catalog, model)
  if (saved) for (const [k, v] of Object.entries(saved)) if (v?.to && model.attributes.some(a => a.key === v.to) && !st.mapping[k]?.fixed) st.mapping[k] = { ...v, why: 'gemerkt', sure: true }
  const remember = () => ctx.data.set('mapping', st.mapping).catch(() => {})
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => { status.textContent = m }
  const body = el('div', { class: 'scroll', style: 'flex:1;padding:0 8px 12px' })
  const band = t => el('div', { class: 'step-band', style: 'margin:10px -8px 6px' }, t)
  // Teilbaum per Auswahlbaum (Taloan: statt Namenssuche); Knopf zeigt den gewählten, Klick klappt den Baum auf
  const rootLabel = id => { const r = tree.byId.get(id); return r ? `${r.role === 'group' ? '▣' : r.role === 'product' ? '▦' : '◆'} ${r.label}` : 'Teilbaum wählen' }
  const rootIn = el('button', { class: 'x', title: 'Teilbaum wählen (Gruppe oder Produkt)' }, rootLabel(st.root))
  const pick = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:5;width:380px;display:none;padding:6px;background:var(--pane)' })
  treePicker(pick, { value: st.root, roles: ['group', 'product'], height: 300, onPick: r => { st.root = r.id; rootIn.textContent = rootLabel(r.id); pick.style.display = 'none'; localStorage.setItem(`journali.cmp.${catalog.key}.root`, r.id); run() } })
  rootIn.addEventListener('click', () => { pick.style.display = pick.style.display === 'none' ? 'block' : 'none' })
  const s1 = el('div'), s2 = el('div'), s3 = el('div')
  // Keine Rechtsberatung (Taloan, 20.09.: „bei allen Berichten dick fett“): Kataloge, Vorschläge und Geltungen sind Hinweise und Empfehlungen —
  // verbindlich ist der Rechtstext; die Einordnung verantwortet der Anwender. Steht in jeder Prüfansicht oben, fett, und in jedem Bericht.
  const disclaimer = el('div', { class: 'warn', style: 'font-weight:700;font-size:12px;padding:4px 8px;border-bottom:1px solid var(--line)', title: 'Die Datenpunkte, Hinweise, Fristen und Vorschläge (auch der KI) sind eine Arbeitshilfe nach bestem Wissen — keine Rechtsberatung. Massgeblich ist der Rechtstext (Quelle oben); ob und wie eine Vorschrift für ein Produkt gilt, entscheidet der Anwender.' },
    `⚠ Keine Rechtsberatung — Datenpunkte, Fristen, Geltungen und Vorschläge sind Hinweise und Empfehlungen. Massgeblich ist der Rechtstext (${catalog.sourceLabel ?? 'Quelle'}).`)
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, `${catalog.icon ?? '✓'} ${catalog.label}`), el('a', { href: catalog.source, target: '_blank', class: 'muted', style: 'font-size:12px', title: 'Quelle' }, catalog.sourceLabel ?? 'Quelle ↗'), el('span', { class: 'grow' }), status), disclaimer, body)
  body.append(s2, s3, s1)   // 1 Prüfen · 2 Ergebnis · 3 Modell — erst der Knoten, dann was fehlt, dann das Modell dazu (Taloan, 20.09.)

  // -- 1 Zuordnung
  function drawMapping() {
    s1.innerHTML = ''
    if (catalog.autoCreate) return   // das Modell pflegt der Katalog selbst — nichts für den Anwender
    const n = catalog.groups.reduce((k, g) => k + g.items.length, 0), mapped = Object.values(st.mapping).filter(m => m.to).length
    const openMissing = catalog.groups.flatMap(g => g.items).filter(it => !st.mapping[it.key]?.to && st.levels.has(it.level)).length
    st.mapOpen ??= false   // zu — zuordnen und anlegen geht im Ergebnis, Zeile für Zeile; hier nur die ganze Liste zum Nachsehen
    const b1 = band(`${st.mapOpen ? '▾' : '▸'} 3 · Modell: Datenpunkte → Attribute · ${mapped} von ${n} zugeordnet${!st.mapOpen && openMissing ? ` · ${openMissing} ohne Attribut` : ''}`)
    b1.style.cursor = 'pointer'; b1.title = st.mapOpen ? 'zuklappen' : 'aufklappen — welches Attribut im Modell den Datenpunkt trägt: ändern, fehlende anlegen; danach erneut prüfen'
    b1.addEventListener('click', () => { st.mapOpen = !st.mapOpen; drawMapping() })
    s1.append(b1)
    if (!st.mapOpen) return
    s1.append(el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:6px' }, 'Modellpflege, unabhängig vom Knoten: welches Attribut im Modell den Datenpunkt trägt. Fehlt eines, hier anlegen — ob es am Knoten gilt (Gruppe am Pfad), sagt das Ergebnis oben mit ⊘. ' + (catalog.description ?? '')))
    // Filter (Taloan, 18.09.): Pflichtgrad an/aus, dazu nur zugeordnete / nur offene
    const all = catalog.groups.flatMap(g => g.items)
    const cnt = lv => all.filter(it => it.level === lv).length
    const chip = (on, label, title, fn) => el('span', { class: 'view-chip' + (on ? ' on' : ''), title, onclick: fn }, label)
    const show = it => st.levels.has(it.level) && (st.only === 'all' || (st.only === 'open' ? !st.mapping[it.key]?.to : !!st.mapping[it.key]?.to))
    s1.append(el('div', { class: 'chips', style: 'margin-bottom:6px' },
      chip(st.levels.has('must'), `● Pflicht ${cnt('must')}`, 'Pflicht — in Anhang III / Art. 7 genannt', () => { st.levels.has('must') ? st.levels.delete('must') : st.levels.add('must'); drawMapping() }),
      chip(st.levels.has('should'), `◐ empfohlen ${cnt('should')}`, 'empfohlen — produktgruppenabhängig', () => { st.levels.has('should') ? st.levels.delete('should') : st.levels.add('should'); drawMapping() }),
      chip(st.levels.has('may'), `○ optional ${cnt('may')}`, 'optional — freiwillig', () => { st.levels.has('may') ? st.levels.delete('may') : st.levels.add('may'); drawMapping() }),
      el('span', { class: 'sep' }, '·'),
      chip(st.only === 'all', 'alle', '', () => { st.only = 'all'; drawMapping() }),
      chip(st.only === 'open', `offen ${all.filter(it => st.levels.has(it.level) && !st.mapping[it.key]?.to).length}`, 'ohne Attribut (in den gewählten Pflichtgraden)', () => { st.only = 'open'; drawMapping() }),
      chip(st.only === 'mapped', `zugeordnet ${all.filter(it => st.levels.has(it.level) && !!st.mapping[it.key]?.to).length}`, 'mit Attribut (in den gewählten Pflichtgraden)', () => { st.only = 'mapped'; drawMapping() }),
      el('span', { class: 'muted', style: 'font-size:12px' }, `${all.filter(show).length} von ${n} gezeigt`)))
    const tbl = el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:34px' }, ''), el('th', { style: 'width:280px' }, 'Datenpunkt'), el('th', { style: 'width:70px' }, 'Typ'), el('th', { style: 'width:280px' }, 'Attribut im Modell'), el('th', {}, 'Hinweis'))))
    const tb = el('tbody'); tbl.append(tb)
    for (const g of catalog.groups) {
      const items = g.items.filter(show); if (!items.length) continue
      tb.append(el('tr', { class: 'group-row' }, el('td', { colspan: '5' }, `▤ ${g.label}`, el('span', { class: 'muted', style: 'font-weight:400' }, ` · ${items.length}`))))
      for (const it of items) {
        const m = st.mapping[it.key]
        const sel = m?.fixed ? el('span', { class: m.to ? '' : 'warn' }, m.to ? `${model.attributes.find(a => a.key === m.to)?.label?.de || m.to} · ${m.to}` : '— fehlt, wird angelegt —') : el('select', { style: 'width:100%' }, el('option', { value: '' }, '— kein Attribut —'), ...model.attributes.filter(a => !['rows', 'formula'].includes(a.type)).map(a => el('option', { value: a.key }, `${a.label?.de || a.key} · ${a.key}`)))
        if (!m?.fixed) sel.value = m?.to ?? ''
        if (!m?.to) sel.style.color = 'var(--warn)'
        sel.addEventListener('change', () => { st.mapping[it.key] = { to: sel.value, why: 'gewählt', sure: true }; remember(); st.dirty = !!st.res; drawMapping(); drawResult() })
        tb.append(el('tr', {}, el('td', { title: it.level === 'must' ? 'Pflicht' : it.level === 'should' ? 'empfohlen' : 'optional' }, it.level === 'must' ? '●' : it.level === 'should' ? '◐' : '○'),
          el('td', {}, el('b', {}, it.label), el('div', { class: 'mono muted', style: 'font-size:11px' }, it.key)),
          el('td', { class: 'muted' }, `${it.type ?? 'text'}${it.unit ? ' ' + it.unit : ''}`),
          el('td', {}, sel, el('div', { class: 'muted', style: 'font-size:11px' }, m?.why ?? '')),
          // Sondergruppe ohne Geltung am geprüften Knoten (Taloan, 20.09.: „warum fehlen die 4?“): nichts fehlt — sie gilt hier nicht, darum wurde nichts angelegt
          el('td', { class: 'muted', style: 'font-size:12px;white-space:normal' }, g.scope && st.res && !st.res.items.some(x => x.key === it.key && st.res.byItem.get(x.key).na < st.res.nodes.length) ? el('span', { class: 'warn' }, `gilt am geprüften Knoten nicht (Geltung „${g.scope.label}“ nicht gesetzt) — darum kein Attribut nötig`) : (it.hint ?? ''))))
      }
    }
    s1.append(tbl)
    const missing = all.filter(it => !st.mapping[it.key]?.to && st.levels.has(it.level))
    const bar = el('div', { class: 'chips', style: 'margin-top:6px' })
    if (st.dirty) bar.append(el('button', { class: 'primary', onclick: run, title: 'Zuordnung geändert — den Teilbaum mit der neuen Zuordnung prüfen' }, '↻ erneut prüfen'))
    s1.append(bar)
  }

  // -- 2 Prüfung
  function drawRun() {
    s2.innerHTML = ''
    s2.append(band('1 · Prüfen'))
    s2.append(el('div', { class: 'chips' }, el('span', { style: 'position:relative' }, rootIn, pick), el('button', { class: 'primary', onclick: run }, '▶ prüfen'),
      el('span', { class: 'muted', style: 'font-size:12px' }, '● Pflicht · ◐ empfohlen · ○ optional — Anteil erfüllter Pflicht-Datenpunkte je Knoten; ↓ = in allen Varianten darunter belegt (zählt als erfüllt)')))
  }
  async function run() {
    if (!st.root) return
    try {
      st.res = await check(catalog, st.mapping, st.root, say)
      if (catalog.autoCreate) {
        // Modellpflege automatisch (Taloan, 20.09.: der Anwender wählt die Klasse und füllt Werte — Attribute und Gruppe sind Sache des Programms):
        // fehlende Attribute, die an mindestens einem geprüften Knoten gelten, anlegen; die Gruppe des Katalogs an die Wurzel des Teilbaums
        let again = false
        const need = st.res.items.filter(it => !st.mapping[it.key]?.to && st.res.byItem.get(it.key).na < st.res.nodes.length)
        if (need.length) { say(`lege ${need.length} Attribute an …`); await createAttributes(catalog, need, st.mapping); await remember(); again = true }
        const rootRow = tree.byId.get(st.root)
        if (rootRow && st.res.inactiveGroups?.size) { const have = (rootRow.groups ?? '').split(',').filter(Boolean); await api.post(`/api/nodes/${encodeURIComponent(rootRow.id)}/groups`, { groups: [...new Set([...have, ...st.res.inactiveGroups])] }, 'PUT'); await tree.load(); again = true }
        if (again) { await store.poll(true); st.res = await check(catalog, st.mapping, st.root, say) }
      }
      st.sugg = deriveSuggestions(catalog, st.mapping, st.res); st.dirty = false; say(`${st.res.nodes.length} Knoten geprüft`); drawResult(); drawMapping()
    }
    catch (e) { say('✗ ' + e.message); store.toast(e.message) }
  }
  // Steckbrief: was ist gemeint · wo steht es · ab wann · was, wenn es fehlt · woher man es bekommt — aus dem Katalog (what, law, from,
  // ifMissing, source), sonst aus hint. Angehängt: Attribut im Modell und der Hinweis „keine Rechtsberatung“.
  function explain(it) {
    const rows = []
    if (it.what || it.hint) rows.push(['Was', it.what || it.hint])
    if (it.law) rows.push(['Wo steht es', it.law])
    if (it.from) rows.push(['Ab wann', it.from])
    if (it.ifMissing) rows.push(['Wenn es fehlt', it.ifMissing])
    if (it.source) rows.push(['Woher', it.source])
    if (it.type) rows.push(['Form', `${it.type}${it.unit ? ' in ' + it.unit : ''}${it.values ? ' — ' + it.values.slice(0, 8).join(', ') + (it.values.length > 8 ? ' …' : '') : ''}`])
    rows.push(['Pflicht', it.level === 'must' ? '● Pflicht' : it.level === 'should' ? '◐ empfohlen' : '○ optional'])
    const to = st.mapping[it.key]?.to; rows.push(['Attribut', to ? `${store.model.attributes.find(a => a.key === to)?.label?.de || to} · ${to}` : '— noch keins —'])
    rows.push(['Hinweis', 'keine Rechtsberatung — Hinweis nach bestem Wissen, massgeblich ist der Rechtstext'])
    return dialog.help({ title: `${it.label} · ${catalog.label}`, rows })
  }
  // Leere Zelle: Wert eintragen — oder „weiss ich nicht, frage bei …“ mit Wiedervorlage (Beleg method pending am Wert)
  // Liste der Knoten, an denen der Datenpunkt leer ist — je Zeile ein Eingabefeld (Enter schreibt) und ⏳ angefragt
  function fillList(it) {
    const to = st.mapping[it.key]?.to; if (!to) return
    const nodes = st.res.nodes.filter(n => n.states[it.key] === 'empty' || n.states[it.key] === 'pending')
    const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:30' })   // unter dem Dialog (40), damit Rückfragen davor liegen
    const box = el('div', { style: 'width:min(640px,94vw);max-height:80vh;display:flex;flex-direction:column;background:var(--pane);border:1px solid var(--line);border-radius:8px;padding:12px;font-size:13px' })
    let written = false   // etwas geschrieben → beim Schliessen erneut prüfen, egal wie geschlossen wird
    const close = () => { overlay.remove(); if (written) run() }
    overlay.addEventListener('mousedown', e => { if (e.target === overlay) close() })
    const rows = el('div', { class: 'scroll', style: 'flex:1' })
    const def = store.model.attributes.find(a => a.key === to)
    const listVals = def?.list ? (store.model.lists.find(l => l.key === def.list)?.values ?? []) : null
    for (const n of nodes) {
      const pend = n.pendingInfo?.[it.key]
      let inp
      if (listVals) inp = el('select', { style: 'width:220px' }, el('option', { value: '' }, '—'), ...listVals.map(v => el('option', { value: v.value }, v.label?.de || v.label?.en || v.value)))
      else if (def?.type === 'boolean') inp = el('select', { style: 'width:220px' }, el('option', { value: '' }, '—'), el('option', { value: 'true' }, 'ja'), el('option', { value: 'false' }, 'nein'))
      else inp = el('input', { style: 'width:220px', placeholder: it.unit ? `Wert in ${it.unit}` : 'Wert' })
      const write = async () => { const v = inp.value.trim(); if (!v) return; try { await api.post(`/api/nodes/${encodeURIComponent(n.row.id)}/attributes`, { attribute: to, locale: null, channel: null, value: v, row: null }); written = true; state.textContent = '✓'; state.className = 'pos'; state.title = '' } catch (e) { state.textContent = '✗ ' + e.message; state.className = 'neg'; state.title = e.message } }
      inp.addEventListener('change', write); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); write() } })
      const state = el('span', { class: pend ? 'warn' : 'muted', style: 'width:120px;font-size:12px' }, pend ? `⏳ ${pend.source ?? 'angefragt'} · ${pend.checkedAt ?? ''}` : '')
      const who = el('input', { style: 'width:170px;display:none', placeholder: 'bei wem? (Lieferant, Abteilung, Person)', value: pend?.source ?? '' })
      const due = el('input', { type: 'date', style: 'width:140px;display:none', title: 'Wiedervorlage — danach gilt es als überfällig', value: pend?.checkedAt ?? new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10) })
      const ok = el('button', { class: 'primary', style: 'display:none', title: 'als angefragt merken', onclick: async () => {
        try { await api.post(`/api/nodes/${encodeURIComponent(n.row.id)}/sources`, { attribute: to, locale: null, channel: null, row: null, source: who.value.trim() || null, title: null, note: null, method: 'pending', checkedAt: due.value || null }); written = true; state.textContent = `⏳ ${who.value.trim() || 'angefragt'} · ${due.value}`; state.className = 'warn'; for (const x of [who, due, ok]) x.style.display = 'none'; inp.style.display = '' } catch (e) { state.textContent = '✗ ' + e.message; state.className = 'neg'; state.title = e.message }
      } }, '✓')
      const pendBtn = el('button', { class: 'x', title: 'weiss ich noch nicht — bei wem angefragt, bis wann (Wiedervorlage)', onclick: () => { const open = who.style.display === 'none'; for (const x of [who, due, ok]) x.style.display = open ? '' : 'none'; inp.style.display = open ? 'none' : ''; if (open) who.focus() } }, '⏳')
      who.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok.click() } })
      rows.append(el('div', { style: 'display:flex;gap:8px;align-items:center;padding:3px 0;border-bottom:1px solid var(--line)' }, el('span', { style: 'flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', title: n.row.id }, `${n.row.role === 'variant' ? '◆' : n.row.role === 'product' ? '▦' : '▣'} ${n.row.label}`), inp, who, due, ok, pendBtn, state))
    }
    box.append(el('div', { class: 'chips', style: 'margin-bottom:6px' }, el('b', {}, `${it.label} · ${nodes.length} leer`), el('span', { class: 'grow' }), el('button', { class: 'x', onclick: () => explain(it) }, 'ⓘ'), el('button', { class: 'x', onclick: close }, '✕')),
      el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:6px' }, 'Wert eintragen (Enter schreibt sofort) — oder ⏳ „angefragt bei …“ mit Wiedervorlage'), rows,
      el('div', { class: 'chips', style: 'justify-content:flex-end;margin-top:8px' }, el('button', { class: 'primary', onclick: () => { written = true; close() } }, 'fertig — erneut prüfen')))
    overlay.append(box); document.body.append(overlay)
    setTimeout(() => rows.querySelector('input, select')?.focus(), 0)
  }
  async function askPending(n, it, pend, bad = null) {
    const to = st.mapping[it.key]?.to; if (!to) return
    const v = await dialog.prompt({ title: `${it.label} · ${n.row.label}`, value: bad?.value ?? '', text: bad ? `✗ ${bad.message} — Wert korrigieren${it.unit ? ` (in ${it.unit})` : ''}.` : pend ? `⏳ angefragt${pend.source ? ' bei ' + pend.source : ''}, Wiedervorlage ${pend.checkedAt ?? '—'}. Wert eintragen — oder leer lassen und die Anfrage ändern.` : 'Wert eintragen — oder leer lassen: dann „weiss ich noch nicht, frage bei …“ mit Wiedervorlage.', value: '', placeholder: it.unit ? `Wert in ${it.unit}` : 'Wert', ok: 'Eintragen' })
    if (v == null) return
    try {
      if (v.trim()) { await api.post(`/api/nodes/${encodeURIComponent(n.row.id)}/attributes`, { attribute: to, locale: null, channel: null, value: v.trim(), row: null }); await run(); return }
      const who = await dialog.prompt({ title: 'Anfragen bei …', text: 'Lieferant, Abteilung, Person', value: pend?.source ?? '', ok: 'Weiter' }); if (who == null) return
      const due = await dialog.prompt({ title: 'Wiedervorlage setzen', text: 'Datum JJJJ-MM-TT (danach überfällig)', value: pend?.checkedAt ?? new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), ok: '⏳ Anfragen' }); if (due == null) return
      await api.post(`/api/nodes/${encodeURIComponent(n.row.id)}/sources`, { attribute: to, locale: null, channel: null, row: null, source: who.trim() || null, title: null, note: null, method: 'pending', checkedAt: due.trim() || null })
      await run()
    } catch (e) { store.toast(e.message) }
  }
  const infoBtn = it => el('button', { class: 'x', style: 'padding:0 5px;font-size:11px', title: 'Was ist das? Wo steht es? Woher bekomme ich es?', onclick: () => explain(it) }, 'ⓘ')
  const SYM = { ok: '✓', empty: '·', bad: '✗', unmapped: '—', na: '', below: '↓', inactive: '⊘', pending: '⏳' }
  const CLS = { ok: 'pos', empty: 'muted', bad: 'neg', unmapped: 'muted', na: 'muted', below: 'pos', inactive: 'warn', pending: 'warn' }
  function drawResult() {
    s3.innerHTML = ''
    const r = st.res; if (!r) return
    const scored = r.nodes.filter(n => n.score != null)
    const avg = scored.length ? Math.round(scored.reduce((k, n) => k + n.score, 0) / scored.length) : null
    s3.append(band(`2 · Ergebnis · ${r.nodes.length} Knoten${avg != null ? ` · Pflicht im Schnitt ${avg} %` : ''}${r.unmapped.length ? ` · ${r.unmapped.length} Datenpunkte ohne Attribut im Modell (3)` : ''}${st.dirty ? ' · Zuordnung geändert — ↻ erneut prüfen' : ''}`))
    // je Datenpunkt: Zusammenfassung
    const sum = el('table', { class: 'grid', style: 'width:auto' }, el('thead', {}, el('tr', {}, el('th', {}, 'Datenpunkt'), el('th', { class: 'num' }, '✓'), el('th', { class: 'num' }, 'leer'), el('th', { class: 'num' }, '✗'), el('th', {}, ''))))
    const sb = el('tbody'); sum.append(sb)
    // Datenpunkte, die an keinem geprüften Knoten gelten (Rolle, Klasse), stehen nicht in der Liste — ein Notebook bekommt keine
    // Leitungsschutzschalter-Merkmale vorgehalten (Taloan, 20.09.); eine Zeile nennt, wie viele es sind
    const hidden = r.nodes.length ? r.items.filter(it => r.byItem.get(it.key).na === r.nodes.length) : []
    // fehlendes Attribut: in der Zeile zuordnen (Auswahl) oder anlegen — nicht „siehe unter 3“
    const mapCell = it => {
      const sel = el('select', { style: 'max-width:220px;color:var(--warn)' }, el('option', { value: '' }, 'zuordnen …'), ...model.attributes.filter(a => !['rows', 'formula'].includes(a.type)).map(a => el('option', { value: a.key }, `${a.label?.de || a.key} · ${a.key}`)))
      sel.addEventListener('change', async () => { if (!sel.value) return; st.mapping[it.key] = { to: sel.value, why: 'gewählt', sure: true }; await remember(); await run() })
      const mk = el('button', { class: 'x', title: `Attribut ${(catalog.prefix ?? '') + it.key} in Gruppe ${catalog.groupKey} anlegen`, onclick: async () => { say('lege an …'); try { await createAttributes(catalog, [it], st.mapping); await remember(); say(''); await run() } catch (e) { store.toast(e.message); say('✗ ' + e.message) } } }, '+ anlegen')
      mk.textContent = `+ anlegen in ${catalog.groupKey}`
      return el('span', { style: 'display:inline-flex;gap:4px;align-items:center' }, sel, mk)
    }
    const unm = r.items.filter(it => !st.mapping[it.key]?.to && !hidden.includes(it))
    for (const it of r.items) { const c = r.byItem.get(it.key); const to = st.mapping[it.key]?.to; if (hidden.includes(it)) continue; sb.append(el('tr', {}, el('td', {}, `${it.level === 'must' ? '●' : it.level === 'should' ? '◐' : '○'} ${it.label} `, infoBtn(it)), el('td', { class: 'num ' + (c.ok + c.below ? 'pos' : 'muted'), title: c.below ? `${c.ok} selbst, ${c.below} über die Varianten darunter` : '' }, String(c.ok + c.below)), el('td', { class: 'num ' + (c.empty + c.inactive ? (it.level === 'must' ? 'neg' : 'warn') : 'muted'), style: c.empty || c.pending ? 'cursor:pointer;text-decoration:underline dotted' : '', onclick: c.empty || c.pending ? () => fillList(it) : null, title: c.empty ? `${c.empty} leer eintragen (Knoten für Knoten, Wert oder „angefragt bei …“)` + (c.inactive ? ` · ${c.inactive} ohne gültiges Attribut` : '') : c.inactive ? `davon ${c.inactive} ohne gültiges Attribut (Gruppe nicht am Pfad)` : '' }, String(c.empty + c.inactive), c.pending ? el('span', { class: 'warn', title: `${c.pending} Anfragen anzeigen (bei wem, bis wann)` }, ` ⏳${c.pending}`) : null), el('td', { class: 'num ' + (c.bad ? 'neg' : 'muted') }, String(c.bad)), el('td', { class: to ? 'muted' : it.level === 'must' ? 'neg' : it.level === 'should' ? 'warn' : 'muted', style: 'font-size:11px' }, to ? '' : mapCell(it)))) }   // Farbe sagt den Stand (Taloan, 20.09.: eine 0 ist nicht grün): grün nur, wo etwas erfüllt ist; leer/kein Attribut bei Pflicht rot, bei empfohlen orange
    if (hidden.length) sb.append(el('tr', {}, el('td', { class: 'muted', colspan: '5' }, `… ${hidden.length} weitere Datenpunkte gelten an keinem der ${r.nodes.length} Knoten (andere Klasse oder Rolle)`)))
    // Gruppe fürs Anlegen: wählbar (vorhandene oder neuer Schlüssel), je Katalog gemerkt — steht am Knopf und in jeder Zeile
    const grpSel = el('select', { title: 'Attributgruppe, in der fehlende Attribute angelegt werden — vorhandene wählen oder neu' }, ...[...new Set([catalog.groupKey, ...(model.groups ?? []).map(g => g.key)])].map(k => el('option', { value: k }, `${(model.groups ?? []).find(g => g.key === k)?.label?.de || (k === catalog.groupKey ? catalog.groupLabel || k : k)} (${k})${(model.groups ?? []).some(g => g.key === k) ? '' : ' — neu'}`)), el('option', { value: '__new__' }, '+ neue Gruppe …'))
    grpSel.value = catalog.groupKey
    grpSel.addEventListener('change', async () => { let k = grpSel.value; if (k === '__new__') { k = await dialog.prompt({ title: 'Attributgruppe anlegen', value: '', placeholder: 'Schlüssel (a-z, 0-9, _)', ok: '+ Anlegen' }); k = (k ?? '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_'); if (!k) { grpSel.value = catalog.groupKey; return } } catalog.groupKey = k; await ctx.data.set('group', k).catch(() => {}); drawResult(); drawMapping() })
    const scopes = catalog.groups.filter(g => g.scope).map(g => g.scope)
    if (scopes.length) {
      const scopeAttr = `${catalog.key}_scope`; const rootRow = tree.byId.get(st.root)
      const have = String(r.nodes.find(n => n.row.id === st.root)?.raw?.[scopeAttr] ?? '').split(',').map(s => s.trim()).filter(Boolean)
      const line = el('div', { class: 'muted', style: 'margin:6px 0 0;font-size:12px' }, `Sonderregeln für ${rootRow?.label ?? ''} — je Zeile der Stand, der Grund, und ob etwas zu tun ist:`)
      const setScope = async (s, on) => {
        if (on === have.includes(s.key)) return
        try {
          if (!store.model.attributes.some(a => a.key === scopeAttr)) {
            if (!store.model.lists?.some(l => l.key === scopeAttr)) await api.post(`/api/model/lists/${scopeAttr}`, { key: scopeAttr, label: { de: `${catalog.label} — Geltung`, en: `${catalog.label} — scope` } }, 'PUT')
            await api.post(`/api/model/lists/${scopeAttr}/values`, scopes.map(x => ({ value: x.key, label: { de: x.label, en: x.label } })), 'PUT')
            await api.post(`/api/model/attributes/${scopeAttr}`, { key: scopeAttr, label: { de: `${catalog.label} — Geltung`, en: `${catalog.label} — scope` }, type: 'enum', list: scopeAttr, multiple: true, inheritable: true, group: catalog.groupKey }, 'PUT')
            await store.poll(true)
          }
          const next = have.includes(s.key) ? have.filter(x => x !== s.key) : [...have, s.key]
          // wegnehmen: an dem Knoten, an dem es steht (geerbt: der Vater) — keine Ebenenfrage; setzen: Ebene wählen
          const fromId = r.nodes.find(n => n.row.id === st.root)?.from?.[scopeAttr]
          const target = have.includes(s.key)
            ? ((await dialog.confirm({ title: `${s.label} wegnehmen?`, text: `Gesetzt an „${(fromId ? tree.byId.get(fromId)?.label : null) ?? rootRow?.label ?? ''}“; gilt danach dort und darunter nicht mehr`, ok: 'Wegnehmen' })) ? (fromId ? tree.byId.get(fromId) : null) ?? rootRow : null)
            : await pickLevel(rootRow, `${s.label}: gilt ab welchem Knoten? (vererbbar)`, { attr: scopeAttr, wanted: s.key })
          if (!target) return
          const th = (target.groups ?? '').split(',').filter(Boolean); if (!th.includes(catalog.groupKey) && !tree.ancestors(target.id).some(a => (a.groups ?? '').split(',').includes(catalog.groupKey))) await api.post(`/api/nodes/${encodeURIComponent(target.id)}/groups`, { groups: [...th, catalog.groupKey] }, 'PUT')
          await api.post(`/api/nodes/${encodeURIComponent(target.id)}/attributes`, { attribute: scopeAttr, locale: null, channel: null, value: null, values: next.length ? next : null, row: null })
          if (on) await decline(st.root, s.key, false)
          await store.poll(true); await tree.load(); await run()
        } catch (e) { store.toast(e.message) }
      }
      // Eine Zeile je Sonderregel, keine Frage, die schon beantwortet ist (Taloan, 21.09.: „was für eine Bedienung“):
      //   Stand und Vorschlag einig → Aussage mit Grund und „ändern“ · uneinig → die Frage mit beiden Seiten · kein Vorschlag → ja/nein
      s3.append(line)
      const rowsBox = el('div', { style: 'margin:2px 0 6px' }); s3.append(rowsBox)
      const render = (list) => {
        rowsBox.innerHTML = ''
        for (const s of scopes) {
          const on = have.includes(s.key); const sg = list?.items.find(x => x.key === s.key) ?? null
          const why = sg?.why ? ` (${sg.why})` : ''
          const row = el('div', { class: 'chips', style: 'margin:2px 0;font-size:12px', title: s.hint ?? '' })
          if (on) {
            const fromId = r.nodes.find(n => n.row.id === st.root)?.from?.[scopeAttr]; const at = fromId ? tree.byId.get(fromId)?.label ?? fromId : rootRow?.label ?? ''
            row.append(el('span', { class: 'pos' }, `${s.label}: gilt hier — gesetzt an „${at}“ (vererbbar)`), el('button', { class: 'x', title: 'wegnehmen — am Knoten, an dem es gesetzt ist', onclick: () => setScope(s, false) }, 'ändern'),
              sg && !sg.applies ? el('span', { class: 'muted', title: 'nur ein Hinweis — deine Entscheidung gilt' }, `Hinweis: Vorschlag wäre „nein“${why}`) : null)
          } else if ((st.declined[st.root] ?? []).includes(s.key)) {
            row.append(el('span', { class: 'muted' }, `${s.label}: gilt hier nicht — deine Entscheidung${sg?.applies ? ` (Vorschlag wäre „ja“${why})` : ''}`), el('button', { class: 'x', title: 'doch setzen — ab welchem Knoten, fragt der nächste Schritt', onclick: async () => { await decline(st.root, s.key, false); setScope(s, true) } }, 'ändern'))
          } else if (sg && !sg.applies) {
            row.append(el('span', { class: 'muted' }, `${s.label}: gilt hier nicht${why}`), el('button', { class: 'x', title: 'doch setzen — ab welchem Knoten, fragt der nächste Schritt', onclick: () => setScope(s, true) }, 'ändern'))
          } else if (sg) {
            row.append(el('span', { class: 'warn' }, `${s.label}: nicht gesetzt, Vorschlag „ja“${why} —`), el('button', { class: 'primary', title: 'setzen — ab welchem Knoten, fragt der nächste Schritt', onclick: () => setScope(s, true) }, '→ ja'), el('button', { class: 'x', title: 'gilt hier nicht — wird gemerkt, die Frage kommt nicht wieder', onclick: async () => { await decline(st.root, s.key, true); drawResult() } }, 'nein'))
          } else {
            row.append(el('span', {}, `${s.label}?`), el('button', { class: on ? 'primary' : '', onclick: () => setScope(s, true) }, 'ja'), el('button', { class: on ? '' : 'primary', onclick: () => setScope(s, false) }, 'nein'), el('span', { class: 'muted' }, list === null ? '— kein Vorschlag möglich: ETIM-Klasse setzen oder KI-Schlüssel (⚙ Einstellungen)' : ''))
          }
          rowsBox.append(row)
        }
      }
      render(undefined)
      suggestScopes(catalog, rootRow, scopes, have).then(list => render(list)).catch(() => render(null))
    }
    const inactiveN = r.nodes.reduce((k, x) => k + Object.values(x.states).filter(s => s === 'inactive').length, 0)
    const emptyN = r.nodes.reduce((k, x) => k + Object.values(x.states).filter(s => s === 'empty').length, 0), badN = r.nodes.reduce((k, x) => k + Object.values(x.states).filter(s => s === 'bad').length, 0)
    // Der Assistent (Taloan, 20.09.): Analyse → Deltas (zuordnen/anlegen, in welcher Gruppe) → Gruppe im Baum anhängen → erneut → bis alles zugeordnet ist oder der Anwender aufgibt
    const pendN = r.nodes.reduce((k, x) => k + (x.pending ?? 0), 0), overN = r.nodes.reduce((k, x) => k + (x.overdue ?? 0), 0)
    const next = unm.length ? `Schritt: ${unm.length} Datenpunkte ohne Attribut — unten zuordnen oder anlegen` : inactiveN ? 'Schritt: die Gruppe im Baum anhängen — dann erneut prüfen' : (emptyN || badN) ? `Zuordnung vollständig — ${emptyN} leere${badN ? `, ${badN} falsche` : ''} Werte füllen (Klick auf die Zahl „leer“ oder in die Zelle der Knoten-Tabelle)${pendN ? ` · ⏳ ${pendN} angefragt${overN ? `, ${overN} überfällig` : ''}` : ''}` : pendN ? `⏳ ${pendN} angefragt${overN ? `, ${overN} überfällig` : ''} — sonst alles da` : '✓ alles zugeordnet und gefüllt'
    s3.append(el('div', { class: 'chips', style: 'margin:4px 0;font-weight:600' }, el('span', { class: unm.length || inactiveN ? 'warn' : (emptyN || badN) ? '' : 'pos' }, next)))
    if (unm.length) s3.append(el('div', { class: 'chips', style: 'margin:4px 0' }, el('button', { class: 'primary', onclick: async () => { if (!(await dialog.confirm({ title: `${unm.length} Attribute anlegen?`, warn: `Gruppe „${catalog.groupKey}“`, list: unm.map(it => `${(catalog.prefix ?? '') + it.key} · ${it.label}`), ok: '+ Anlegen' }))) return; say('lege an …'); try { await createAttributes(catalog, unm, st.mapping); await remember(); say(''); await run() } catch (e) { store.toast(e.message); say('✗ ' + e.message) } } }, `+ ${unm.length} fehlende Attribute anlegen`), el('span', { class: 'muted' }, 'in Gruppe'), grpSel))
    if (catalog.summary) { const s = catalog.summary(r, st.mapping, ctx); if (s) s3.append(el('div', { class: 'chips', style: 'margin-top:6px' }, s)) }
    if (r.inactiveGroups?.size) {
      // Schritt: die Gruppe hängt an keinem Knoten des Pfads — WO im Baum sie hängen soll, sagt der Anwender (Taloan, 20.09.); Vorgabe: der geprüfte Knoten
      const groups = [...r.inactiveGroups]; let target = tree.byId.get(st.root)
      const n = r.nodes.reduce((k, x) => k + Object.values(x.states).filter(s => s === 'inactive').length, 0)
      const tBtn = el('button', { class: 'x', title: 'Knoten wählen, an dem die Gruppe hängen soll — gilt für alles darunter' }, `${target ? `${target.label}` : 'Knoten wählen'} ▾`)
      const pickBox = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:6;width:380px;display:none;padding:6px;background:var(--pane)' })
      treePicker(pickBox, { value: target?.id ?? null, roles: ['group', 'product'], height: 300, onPick: r2 => { target = r2; tBtn.textContent = `${r2.label} ▾`; pickBox.style.display = 'none' } })
      tBtn.addEventListener('click', () => { pickBox.style.display = pickBox.style.display === 'none' ? 'block' : 'none' })
      s3.append(el('div', { class: 'chips', style: 'margin-top:6px' }, el('span', { class: 'warn' }, `⊘ ${n} Werte gelten hier nicht — Gruppe ${groups.map(g => '„' + (store.model.groups.find(x => x.key === g)?.label?.de || g) + '“').join(', ')} hängt an keinem Knoten des Pfads. Anhängen an`),
        el('span', { style: 'position:relative' }, tBtn, pickBox),
        el('button', { class: 'primary', onclick: async () => {
          if (!target) return
          try { const have = (target.groups ?? '').split(',').filter(Boolean); await api.post(`/api/nodes/${encodeURIComponent(target.id)}/groups`, { groups: [...new Set([...have, ...groups])] }, 'PUT'); await tree.load(); store.toast(`✓ ${groups.join(', ')} an ${target.label}`); await run() } catch (e) { store.toast(e.message) }
        } }, '▤ anhängen und erneut prüfen')))
    }
    s3.append(el('details', { open: '' }, el('summary', { class: 'muted' }, 'je Datenpunkt'), sum))
    // je Knoten: Matrix
    const items = r.items.filter(it => st.mapping[it.key]?.to && st.levels.has(it.level))
    const tbl = el('table', { class: 'grid', style: 'width:auto;margin-top:8px' })
    // wenige Spalten (≤ 6): Köpfe waagerecht wie überall — gedreht nur, wenn es eng wird (Taloan, 20.09.: „wieso ist das so gross?“)
    const rotate = items.length > 6
    const headH = Math.min(110, 16 + 5.6 * Math.max(4, ...items.map(it => Math.min(22, it.label.length))))
    tbl.append(el('thead', {}, el('tr', {}, el('th', { style: 'width:28px' }, el('input', { type: 'checkbox', title: 'alle für KI-Vorschläge', onchange: e => { st.picked = e.target.checked ? new Set(r.nodes.map(n => n.row.id)) : new Set(); drawResult() } })), el('th', { style: 'width:300px' }, 'Knoten'), el('th', { class: 'num', style: 'width:60px' }, 'Pflicht'), ...(catalog.rowNote ? [el('th', { style: 'width:150px' }, '')] : []), ...items.map(it => rotate
      ? el('th', { title: `${it.label} → ${st.mapping[it.key].to}`, style: 'height:auto;vertical-align:bottom;padding:4px 2px' }, el('div', { style: 'writing-mode:vertical-rl;transform:rotate(180deg);height:' + headH + 'px;font-weight:400;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, it.label.slice(0, 22)))
      : el('th', { title: `${it.label} → ${st.mapping[it.key].to}`, style: 'font-weight:400;font-size:11px;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:2px 6px' }, it.label)))))
    const tb = el('tbody'); tbl.append(tb)
    // Einrückung nach Tiefe im geprüften Teilbaum (Taloan, 20.09.: keine flache Liste, die sich nur am Symbol unterscheidet)
    const inRun = new Map(r.nodes.map(n => [n.row.id, n.row.parent]))
    const depthOf = id => { let d = 0; for (let p = inRun.get(id); p && inRun.has(p); p = inRun.get(p)) d++; return d }
    for (const n of r.nodes) {
      const cb = el('input', { type: 'checkbox' }); cb.checked = st.picked.has(n.row.id); cb.addEventListener('change', () => { cb.checked ? st.picked.add(n.row.id) : st.picked.delete(n.row.id) })
      tb.append(el('tr', {}, el('td', {}, cb), el('td', { style: `padding-left:${6 + depthOf(n.row.id) * 18}px` }, el('a', { href: `/tree/${n.row.id}`, onclick: e => { e.preventDefault(); ctx.go?.(`/tree/${n.row.id}`) }, title: n.row.id }, `${n.row.role === 'variant' ? '◆' : n.row.role === 'product' ? '▦' : '▣'} ${n.row.label}`)),
        el('td', { class: 'num ' + (n.score == null ? 'muted' : n.score === 100 ? 'pos' : n.score < 50 ? 'neg' : 'warn') }, n.score == null ? '–' : n.score + ' %'),
        ...(catalog.rowNote ? [el('td', { style: 'font-size:12px' }, catalog.rowNote(n, st.mapping, ctx))] : []),
        ...items.map(it => { const s = n.states[it.key]; const f = n.findings.find(x => x.item.key === it.key); const pend = n.pendingInfo?.[it.key]; return el('td', { class: CLS[s], style: 'text-align:center' + (s === 'empty' || s === 'pending' || s === 'bad' ? ';cursor:pointer' : ''), onclick: s === 'empty' || s === 'pending' || s === 'bad' ? () => askPending(n, it, pend, s === 'bad' ? { value: n.raw[st.mapping[it.key]?.to], message: f?.message } : null) : null, title: s === 'pending' ? `⏳ angefragt${pend?.source ? ' bei ' + pend.source : ''}${pend?.checkedAt ? ' · Wiedervorlage ' + pend.checkedAt + (pend.checkedAt < new Date().toISOString().slice(0, 10) ? ' — überfällig' : '') : ''}${pend?.note ? ' · ' + pend.note : ''} · Wert eintragen oder Anfrage ändern` : f ? f.message : s === 'ok' ? 'erfüllt' : s === 'below' ? 'in allen Varianten darunter belegt' : s === 'empty' ? 'leer' : s === 'inactive' ? `gilt hier nicht — Gruppe „${store.model.attributes.find(a => a.key === st.mapping[it.key]?.to)?.group ?? '?'}“ hängt an keinem Knoten des Pfads` : '' }, SYM[s]) })))
    }
    s3.append(tbl)
    // Befunde (fragliche Werte)
    const bad = r.nodes.flatMap(n => n.findings.map(f => ({ n, f })))
    if (bad.length) s3.append(el('div', { style: 'margin-top:8px' }, el('b', { class: 'neg' }, `✗ ${bad.length} fragliche Werte`), el('ul', { style: 'margin:4px 0 0 18px;font-size:12px' }, ...bad.slice(0, 50).map(({ n, f }) => el('li', {}, `${n.row.label} · ${f.item.label}: ${f.message}`)))))
    // Vorschläge
    const box = el('div', { style: 'margin-top:10px' })
    const bar = el('div', { class: 'chips' },
      el('button', { onclick: () => { st.sugg = deriveSuggestions(catalog, st.mapping, r); drawSugg() }, title: 'aus vorhandenen Werten ableiten (Regeln des Katalogs)' }, '⚙ Vorschläge (regelbasiert)'),
      el('button', { class: ai.available() ? 'primary' : '', disabled: ai.available() ? null : 'disabled', title: ai.available() ? `KI (${ai.label()}) schlägt Werte für die angehakten Knoten vor` : 'kein KI-Schlüssel — Einstellungen → KI', onclick: async () => {
        const ids = st.picked.size ? [...st.picked] : r.nodes.filter(n => n.leaf && n.score != null && n.score < 100).slice(0, 10).map(n => n.row.id)
        if (!ids.length) { store.toast('keine Knoten mit Lücken'); return }
        if (ids.length > 25 && !(await dialog.confirm({ title: `${ids.length} Knoten an die KI schicken?`, warn: `${ids.length} Anfragen an ${ai.label()}`, ok: '✦ Schicken' }))) return
        const s = await aiSuggestions(catalog, st.mapping, r, ids, say); st.sugg = [...st.sugg.filter(x => x.source !== 'ai'), ...s]; say(`${s.filter(x => !x.error).length} KI-Vorschläge`); drawSugg()
      } }, `✦ Vorschläge mit KI${ai.available() ? '' : ' (kein Schlüssel)'}`),
      // Fremde Produkte (Handelsware): die Daten stehen beim Hersteller — die KI sucht im Internet, jeder Wert mit Quelle
      el('button', { class: ai.available() ? 'primary' : '', disabled: ai.available() ? null : 'disabled', title: ai.available() ? `KI (${ai.label()}) sucht im Internet nach Hersteller, Typ, EAN — Datenblätter, Kataloge; je Wert die Quelle. Kostet je Suche extra beim Anbieter` : 'kein KI-Schlüssel — Einstellungen → KI', onclick: async () => {
        const ids = st.picked.size ? [...st.picked] : r.nodes.filter(n => n.leaf && n.score != null && n.score < 100).slice(0, 5).map(n => n.row.id)
        if (!ids.length) { store.toast('keine Knoten mit Lücken'); return }
        if (ids.length > 10 && !(await dialog.confirm({ title: `${ids.length} Knoten recherchieren?`, warn: `${ids.length} Anfragen mit bis zu 6 Suchen an ${ai.label()}`, ok: '✦ Recherchieren' }))) return
        const s = await aiSuggestions(catalog, st.mapping, r, ids, say, { web: true }); st.sugg = [...st.sugg.filter(x => x.source !== 'web'), ...s]; say(`${s.filter(x => !x.error).length} Vorschläge aus der Recherche`); drawSugg()
      } }, `⌕ Recherche im Internet${ai.available() ? '' : ' (kein Schlüssel)'}`),
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
        tb.append(el('tr', { class: s.error ? 'neg' : '' }, el('td', {}, cb), el('td', {}, s.node.label), el('td', {}, s.item ? s.item.label : '—'), el('td', {}, s.error ? '' : val), el('td', { class: 'muted', style: 'font-size:11px' }, s.source === 'web' ? `⌕ ${s.confidence != null ? Math.round(s.confidence * 100) + ' %' : ''}` : s.source === 'ai' ? `✦ ${s.confidence != null ? Math.round(s.confidence * 100) + ' %' : ''}` : '⚙'), el('td', { class: 'muted', style: 'font-size:12px;white-space:normal' }, s.why, s.url ? el('a', { href: s.url, target: '_blank', style: 'margin-left:6px', title: s.url }, '↗ Quelle') : null)))
      }
      list.append(t, el('div', { class: 'chips', style: 'margin-top:6px' }, el('button', { class: 'primary', onclick: async () => {
        const chosen = [...take]; if (!chosen.length) return
        const ok = await dialog.confirm({ title: `${chosen.length} Werte übernehmen?`, warn: `${chosen.length} Attributwerte als ein Stapel ins Journal`, list: chosen.slice(0, 8).map(s => `${s.node.label} · ${s.item.label} = ${s.value}`), ok: 'Übernehmen' })
        if (!ok) return
        try { const res = await applySuggestions(chosen, st.mapping, r.locale); store.toast(`✓ ${res?.results.length ?? 0} Werte geschrieben`); await store.poll(true); await run() } catch (e) { store.toast(e.message) }
      } }, '💾 angehakte übernehmen'), el('span', { class: 'muted', style: 'font-size:12px' }, 'Vorschläge ab 70 % Sicherheit sind vorangehakt — jeder Wert lässt sich vorher ändern; Quelle, Weg und Prüfdatum kommen als Beleg an den Wert (↗ in der Zelle)')))
    }
    drawSugg()
  }
  drawMapping(); drawRun(); drawResult()
  // aus dem Knoten-Menü (?run=1): nicht erst „prüfen“ drücken müssen — der Teilbaum steht schon fest
  if (new URLSearchParams(location.search).get('run') === '1') { history.replaceState(null, '', location.pathname); run() }
  return () => {}
}
