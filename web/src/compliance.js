// Prüfkataloge:
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
import { norm, similarity, convert } from './mapper.js'
import { analyze, einrichtungsBedarf, berechneterTyp } from './compliance-core.js'
import { tablePages } from './tablePages.js'
import { gruppenVon } from './gruppen.js'
import { treePicker } from './treePicker.js'
import { t as t_, i18n } from './i18n.js'
import { createApp, h } from 'vue'
import ScriptEditor from './components/ScriptEditor.vue'
import { L } from './i18n.js'

export function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v) } for (const k of kids) if (k != null) e.append(k); return e }

// ---- 1 Zuordnung: Best Guess je Datenpunkt
export function guessMapping(catalog, model) {
  const attrs = model.attributes
  const index = attrs.map(a => ({ a, names: [norm(a.key), ...Object.values(a.label ?? {}).map(norm)].filter(Boolean) }))
  const out = {}
  for (const g of catalog.groups) for (const it of g.items) {
    // feste Zuordnung (Katalog nennt das Attribut, z. B. ETIM ef… → ef…): nie raten — „Height ≈ Gewicht (80 %)“ war Unsinn
    if (it.to !== undefined) { const ok = it.to && attrs.some(a => a.key === it.to); out[it.key] = { to: ok ? it.to : '', why: ok ? 'fest' : t_('kein Attribut'), sure: ok, fixed: true }; continue }
    const wanted = [it.key, ...(it.synonyms ?? [])].map(norm)
    let best = null, score = 0, why = ''
    for (const { a, names } of index) {
      for (const w of wanted) for (const n of names) {
        const s = n === w ? 1 : similarity(n, w)
        if (s > score) { score = s; best = a; why = s === 1 ? t_('gleicher Name') : t_('ähnlich ({0} %)', [Math.round(s * 100)]) }
      }
    }
    if (best && score >= 0.8 && (!it.type || !best.type || sameKind(it.type, best.type))) out[it.key] = { to: best.key, why, sure: score === 1 }
    else out[it.key] = { to: '', why: t_('kein Attribut'), sure: false }
  }
  return out
}
const sameKind = (want, have) => want === have || (want === 'decimal' && have === 'integer') || (want === 'text' && ['text', 'html', 'enum'].includes(have)) || (want === 'enum' && have === 'text')

// ---- 2 Prüfung eines Teilbaums — Zeilen holen, rechnen tut compliance-core.js (testbar ohne Browser)
export async function check(catalog, mapping, rootId, say = () => {}) {
  const model = store.model
  const locale = model.masterLocale ?? model.locales[0]?.code ?? 'de'
  // Schritt 0: Gruppen des Katalogs mit
  // scope gelten nur an Knoten, deren Geltungsattribut (vererbbar, z. B. dpp_scope = battery) die Geltung nennt
  const scopeAttr = catalog.groups.some(g => g.scope) ? `${catalog.key}_scope` : null
  const keys = [...new Set([...Object.values(mapping).map(m => m.to).filter(Boolean), ...(scopeAttr && model.attributes.some(a => a.key === scopeAttr) ? [scopeAttr] : [])])]
  say('lese …')
  // Nur die zugeordneten Spalten, seitenweise (04.10.2026): ohne Zuordnung gibt es nichts zu lesen — die Zeilen kommen dann aus dem Baum;
  // die ganze Tabelle eines grossen Zweigs (alle Spalten) waren 1 GB JSON
  const t = keys.length
    ? await tablePages(api, `/api/nodes/${encodeURIComponent(rootId)}/table?deep=true&self=true&locale=${locale}&attributes=${encodeURIComponent(keys.join(','))}`, { onPage: null })
    : { node: tree.byId.get(rootId) ?? null, rows: [tree.byId.get(rootId), ...unterhalb(rootId)].filter(Boolean).map(r => ({ row: r, values: {}, inactive: [] })) }
  const root = t.node
  // Wurzel als erste Zeile, aufgelöst wie die Nachfahren — geerbt zählt.
  // Älterer Server ohne self: wie bisher nur die eigenen Werte der Wurzel (Listenwerte stehen dort in values, nicht value)
  const selfRow = root ? t.rows.find(r => r.row.id === root.id) : null
  const rows = [root && !selfRow ? { row: root, values: {} } : null, ...t.rows].filter(Boolean)
  if (root && !selfRow) { try { const n = await api.get(`/api/nodes/${encodeURIComponent(rootId)}`); const own = new Map(n.values.map(v => [`${v.attribute}|${v.locale ?? ''}`, v.value ?? (v.values ? v.values.join(', ') : null)])); for (const k of keys) { const v = own.get(`${k}|${locale}`) ?? own.get(`${k}|`) ?? null; if (v != null) rows[0].values[k] = { value: v, own: true } } } catch {} }
  const onPath = (id, g) => [tree.byId.get(id), ...tree.ancestors(id)].some(x => (x?.groups ?? '').split(',').includes(g))
  return analyze({ catalog, mapping, model, rows, locale, scopeAttr, onPath })
}

/// Alle Knoten unter id aus dem Baum der Oberfläche (ohne Werte)
function unterhalb(id) { const out = []; const stapel = [...tree.kids(id)]; while (stapel.length) { const k = stapel.pop(); out.push(k); stapel.push(...tree.kids(k.id)) } return out }

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
// web: true:
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
    const system = t_('Du bist Datenpfleger in einem PIM. Vorschrift: {0} ({1}). Du bekommst die vorhandenen Attributwerte eines Produkts und eine Liste fehlender Datenpunkte. Schlage nur vor, was sich aus den vorhandenen Werten belastbar ableiten oder als allgemein bekannt für dieses Produkt annehmen lässt; sonst lass den Datenpunkt weg. Antworte NUR mit JSON: { "<key>": { "value": "<Wert im geforderten Typ>", "confidence": 0.0-1.0, "why": "<ein Satz>" } }. Zahlen ohne Einheit, Datum als JJJJ-MM-TT, ja/nein als true/false.', [catalog.label, catalog.source])
    const user = `Produkt: ${n.row.label} (${n.row.role}${n.row.keys ? ', ' + Object.entries(n.row.keys).map(([k, v]) => `${k} ${v}`).join(', ') : ''})\n\nVorhandene Werte:\n${known || '(keine)'}\n\nFehlende Datenpunkte:\n${ask}`
    const research = web ? `\n\nRecherchiere im Internet: Suche das Produkt über Hersteller, Typ-/Artikelnummer, EAN/GTIN und SKU (Herstellerseite, Datenblatt, Katalog, Händler). Nimm nur Werte, die du dort findest; nenne je Datenpunkt die Quelle (url) in "source". Was du nicht findest, lässt du weg. Antworte nur mit dem JSON-Objekt, ohne Text davor oder danach.` : ''
    const ids = web ? Object.entries(view.external ?? {}).map(([k, v]) => `${k}: ${v}`).join(', ') : ''
    try {
      const j = await ai.ask({ system: system + research, user: user + (ids ? `\nKennungen: ${ids}` : ''), json: true, maxTokens: web ? 3000 : 1500, web, maxSearches: 6, purpose: t_('Prüfung') })
      const src = ai.lastSources
      for (const it of missing) { const s = j?.[it.key]; if (s && s.value != null && s.value !== '') out.push({ node: n.row, item: it, value: String(s.value), why: s.why ?? '', confidence: s.confidence ?? null, source: web ? 'web' : 'ai', url: s.source ?? src[0]?.url ?? null, sources: src }) }
    } catch (e) { out.push({ node: n.row, item: null, value: '', why: '✗ ' + e.message, source: 'ai', error: true }) }
  }
  return out
}

// Vorschläge schreiben: attribute.set je Vorschlag (nur zugeordnete Datenpunkte) und dazu der Beleg (value.source: Quelle, Weg,
// Prüfdatum), ein Stapel
export async function applySuggestions(list, mapping, locale) {
  const model = store.model; const today = new Date().toISOString().slice(0, 10)
  const commands = list.filter(s => s.item && mapping[s.item.key]?.to).flatMap(s => {
    const def = model.attributes.find(a => a.key === mapping[s.item.key].to); const loc = def.perLocale ? locale : null
    const source = s.url ?? (s.source === 'ai' ? `KI (${ai.label()})` : s.source === 'web' ? t_('Recherche ({0})', [ai.label()]) : t_('Regel: {0}', [s.why || 'abgeleitet']))
    return [{ op: 'attribute.set', args: { node: s.node.id, attribute: def.key, locale: loc, value: convert(s.value, def, model) ?? s.value } },
      { op: 'value.source', args: { node: s.node.id, attribute: def.key, locale: loc, source, title: s.url ? (s.why || null) : null, note: s.confidence != null ? t_('Sicherheit {0} %', [Math.round(s.confidence * 100)]) : null, method: s.source === 'web' ? 'web' : s.source === 'ai' ? 'ai' : 'rule', checkedAt: today } }]
  })
  if (!commands.length) return null
  return api.post('/api/batch', { commands, batch: 'cmp-' + Date.now().toString(36) })
}

// Fehlende Attribute anlegen (Gruppe des Katalogs; die Gruppe wird angelegt, wenn es sie nicht gibt) und die Zuordnung setzen
// Einheit sicherstellen: Symbol wie „kg“, „%“, „kWh“ → vorhandener Schlüssel oder neu.
// Bekannte Symbole: Grösse (wie im Saatgut: mass, length, volume …) und Faktor zur Basiseinheit der Grösse (Basis = 1).
// Die Einheit in der Zelle rechnet damit um (units.js); ein Faktor 1 für alles hiesse, dass 1 kWh als 1 Wh erscheint.
// Dritter Wert: Verschiebung (Basis = Wert × Faktor + Verschiebung), nur bei Temperatur; Basis ist °C.
// Ein Symbol, das hier fehlt, ist seine eigene Grösse: dann gibt es nichts umzurechnen.
const BEKANNT = {
  '°C': ['temperature', 1, 0], '°F': ['temperature', 5 / 9, -160 / 9], 'K': ['temperature', 1, -273.15],
  '%': ['percent', 1], 'kg': ['mass', 1], 'g': ['mass', 0.001], 'mg': ['mass', 0.000001], 't': ['mass', 1000],
  'mm': ['length', 0.001], 'cm': ['length', 0.01], 'm': ['length', 1], 'l': ['volume', 1], 'ml': ['volume', 0.001],
  'kWh': ['energy', 1], 'Wh': ['energy', 0.001], 'W': ['power', 1], 'V': ['voltage', 1], 'A': ['current', 1],
  'mg/kg': ['concentration', 1], 'ppm': ['concentration', 1], 'kg CO₂e': ['ghg', 1],
  'h': ['time', 1], 'a': ['time', 8766], 'Jahre': ['time', 8766],
}
export async function ensureUnit(sym) {
  const units = store.model.units ?? []
  const hit = units.find(u => u.key === sym || u.key === sym.toLowerCase() || Object.values(u.label ?? {}).some(l => l === sym)); if (hit) return hit.key
  // Einheitenschlüssel ist das Symbol selbst (wie kg, cm, %): höchstens 8 Zeichen, ohne Leerraum — „kg CO₂e“ → „kgCO2e“
  const key = sym.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').slice(0, 8) || 'x'
  if (!units.some(u => u.key === key)) { const [quantity, factor, offset = 0] = BEKANNT[sym] ?? [sym, 1]; await api.post(`/api/model/units/${encodeURIComponent(key)}`, { key, label: { de: sym, en: sym }, quantity, factor, offset }, 'PUT'); await store.poll(true) }
  return key
}

export async function createAttributes(catalog, items, mapping) {
  const model = store.model
  const gkey = catalog.groupKey
  if (!model.groups.some(g => g.key === gkey)) await api.post(`/api/model/groups/${gkey}`, { key: gkey, label: { de: catalog.groupLabel ?? catalog.label, en: catalog.groupLabel ?? catalog.label }, activeFrom: null }, 'PUT')
  for (const it of items) {
    if (catalog.createAttribute) { const key = await catalog.createAttribute(it); if (key) mapping[it.key] = { to: key, why: 'angelegt', sure: true }; continue }   // der Katalog weiß es besser (etim: Listen, Einheiten)
    const key = (catalog.prefix ?? '') + it.key.replace(/[^a-z0-9_]/g, '_')
    // Einheit: vorhandene nehmen (Schlüssel oder Bezeichnung), sonst anlegen — „Unbekannte Einheit: %“ war der Abbruch
    const unit = it.unit ? await ensureUnit(it.unit) : null
    const body = { key, label: { de: it.label, en: it.labelEn ?? it.label }, type: berechneterTyp(it) ?? (it.type === 'enum' && !it.values ? 'text' : it.type), group: gkey, levels: it.roles?.length ? it.roles : null, unit, axes: it.perLocale ? ['locale'] : [], inheritable: it.inheritable !== false, required: it.level === 'must' && it.requiredChannels ? it.requiredChannels : null }
    await api.post(`/api/model/attributes/${key}`, body, 'PUT')
    mapping[it.key] = { to: key, why: 'angelegt', sure: true }
  }
  await store.poll(true)
}

/// Die vom Anwender gewählte Gruppe (Plugin-Daten „group“) gilt nur, wenn es sie im Modell gibt; sonst gilt die Gruppe des Katalogs,
/// und der veraltete Eintrag fällt weg (eine frühere Version nannte die Gruppen dpp und ppwr).
export async function gewaehlteGruppe(ctx, catalog) {
  const gespeichert = await ctx.data.get('group').catch(() => null)
  if (typeof gespeichert !== 'string' || !gespeichert) return
  if ((store.model?.groups ?? []).some(g => g.key === gespeichert)) catalog.groupKey = gespeichert
  else await ctx.data.del?.('group').catch?.(() => {})
}

/// Beim Einschalten des Plugins (install): die Attributgruppe des Katalogs und die Attribute, die es noch nicht gibt, entstehen — nach einem Hinweis.
/// Was der Katalog schon einem vorhandenen Attribut zuordnen kann, bleibt dort. Danach meldet das Plugin die Gruppe und ihre Attribute an:
/// solange es an ist, braucht es sie, und der Server lässt sie nicht einzeln zurückziehen. Lehnt der Anwender den Hinweis ab, ist das Plugin wieder aus.
export async function setup(ctx, catalog) {
  if (!tree.loaded) await tree.load()
  const model = store.model
  await gewaehlteGruppe(ctx, catalog)
  const mapping = guessMapping(catalog, model)
  const saved = await ctx.data.get('mapping')
  if (saved) for (const [k, v] of Object.entries(saved)) if (v?.to && model.attributes.some(a => a.key === v.to) && !mapping[k]?.fixed) mapping[k] = { ...v, why: 'gemerkt', sure: true }
  const items = catalog.groups.flatMap(g => g.items)
  const fehlen = items.filter(it => !mapping[it.key]?.to)
  const ohneGruppe = !model.groups.some(g => g.key === catalog.groupKey)
  if (fehlen.length || ohneGruppe) {
    const ok = await ctx.system?.ankuendigen?.({
      label: catalog.label,
      text: t_('Das Plugin legt die Attributgruppe {0} mit {1} Attributen an. Ohne sie arbeitet es nicht, und solange es an ist, lassen sie sich nicht zurückziehen.', [catalog.groupKey, fehlen.length]),
    }) ?? true
    if (!ok) return false
    await createAttributes(catalog, fehlen, mapping)
    await ctx.data.set('mapping', mapping).catch(() => {})
  }
  const gruppe = (store.model.groups ?? []).find(g => g.key === catalog.groupKey)
  await ctx.system?.melden?.([catalog.groupKey], gruppe?.attributes ?? [])
  return true
}

// Geltungen vorschlagen: (1) Regeln des Katalogs gegen die wirksame ETIM-Klasse des Knotens (Code, Name, Gruppe), (2) die KI mit
// Produkt, Pfad, Klasse und den Geltungen samt Hinweis — Antwort je Geltung ja/nein mit Begründung. Null, wenn beides fehlt.
async function suggestScopes(catalog, rootRow, scopes, have) {
  if (!rootRow) return null
  // wirksame ETIM-Klasse: eigen oder von oben — im Klassenattribut, das ETIM eingestellt hat (nach einer Namenskollision nicht class_etim, 05.10.2026)
  let code = null
  try {
    const klasse = (await api.get('/api/plugins/etim/data/settings').catch(() => null))?.classAttr || 'class_etim'
    const n = await api.get(`/api/nodes/${encodeURIComponent(rootRow.id)}`)
    code = n.values?.find(v => v.attribute === klasse && !v.locale && !v.channel && !v.row)?.value ?? null
    if (!code) for (const a of n.ancestors ?? []) { const v = a.values?.find(v => v.attribute === klasse && !v.locale && !v.channel)?.value; if (v) { code = v; break } }
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
      const j = await ai.ask({ system: t_('Du prüfst, welche Sonderregelungen für ein Produkt gelten. Antworte nur als JSON {"items":[{"key":"…","applies":true,"why":"…"}]} für jede Geltung aus der Liste, why in einem kurzen Satz auf Deutsch, vorsichtig: im Zweifel nein mit Begründung.'), user: `Produkt: ${rootRow.label}\nPfad: ${tree.ancestors(rootRow.id).map(a => a.label).join(' › ')}\nETIM-Klasse: ${clsText || 'unbekannt'}\nGeltungen:\n${scopes.map(s => `${s.key}: ${s.label}${s.hint ? ' — ' + s.hint : ''}`).join('\n')}`, json: true, maxTokens: 600, purpose: t_('Prüfung') })
      for (const it of j.items ?? []) { const s = scopes.find(x => x.key === it.key); if (!s) continue; const cur = items.find(x => x.key === it.key); if (cur) { if (cur.applies !== !!it.applies) cur.why += ` · KI: ${it.applies ? 'ja' : 'nein'} — ${it.why ?? ''}`; else cur.why = it.why ?? cur.why } else items.push({ key: it.key, applies: !!it.applies, why: it.why ?? '' }) }
      usedAi = true
    } catch (e) { if (!items.length) throw e }
  }
  if (!items.length) return null
  return { items: scopes.map(s => items.find(x => x.key === s.key)).filter(Boolean), ai: usedAi, class: clsText }
}

// Ebene wählen: der Pfad von der Wurzel bis zum Knoten als Chips —
// je Ebene Produkte darunter, Untergruppen, Knoten mit anderem Wert (≠). Empfehlung: die höchste Ebene ohne Untergruppen und ohne
// Widerspruch. Liefert die gewählte Zeile oder null. attr/wanted: welches Attribut und welcher Wert gesetzt werden soll (für ≠).
export async function pickLevel(row, title, { attr = null, wanted = null } = {}) {
  const chain = [...tree.ancestors(row.id), row]
  const vals = new Map()
  // Nur die Knoten mit eigenem Wert (04.10.2026) — vorher die Tabelle des ganzen Baums ab der Wurzel für eine Spalte
  if (attr && store.model.attributes.some(a => a.key === attr)) { try { const t = await api.get(`/api/values/${encodeURIComponent(attr)}?root=${encodeURIComponent(chain[0].id)}`); for (const v of t.values ?? []) vals.set(v.id, String(v.value ?? '')) } catch { } }
  const conflicts = v => { if (!wanted) return false; const list = v.split(',').map(s => s.trim()).filter(Boolean); return list.length > 0 && !list.includes(wanted) }
  // Zählen in einem Durchgang von den tiefsten Knoten aufwärts: Produkte, Nicht-Gruppen und Abweichungen darunter (vorher je Pfadknoten den
  // Teilbaum neu gelaufen). Ohne Rekursion — ein Pfad mit tausenden Ebenen sprengt sonst den Stapel.
  const breite = [chain[0]]; for (let i = 0; i < breite.length; i++) for (const k of tree.kids(breite[i].id)) breite.push(k)
  const zahl = new Map()
  for (let i = breite.length - 1; i >= 0; i--) {
    const z = { products: 0, nodes: 0, other: 0 }
    for (const k of tree.kids(breite[i].id)) {
      const u = zahl.get(k.id); z.products += u.products; z.nodes += u.nodes; z.other += u.other
      if (k.role !== 'group') { z.nodes++; if (k.role === 'product') z.products++; if (conflicts(vals.get(k.id) ?? '')) z.other++ }
    }
    zahl.set(breite[i].id, z)
  }
  const out = chain.map(n => {
    const z = zahl.get(n.id) ?? { products: 0, nodes: 0, other: 0 }; const selbst = n.role !== 'group'
    const products = z.products + (selbst && n.role === 'product' ? 1 : 0), nodes = z.nodes + (selbst ? 1 : 0)
    return { node: n, products: products || nodes, groups: n.role === 'group' ? tree.kids(n.id).filter(k => k.role === 'group').length : 0, other: z.other + (selbst && conflicts(vals.get(n.id) ?? '') ? 1 : 0) }
  })
  let rec = out.length - 1; for (let i = 0; i < out.length; i++) if (out[i].other === 0 && out[i].products > 0 && out[i].groups === 0) { rec = i; break }
  return new Promise(resolve => {
    const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:30' })
    const box = el('div', { style: 'width:min(640px,94vw);background:var(--pane);border:1px solid var(--line);border-radius:8px;padding:12px;font-size:13px' })
    let target = out[rec].node
    const note = el('div', { class: 'muted', style: 'font-size:12px;margin:4px 0 8px' })
    const noteOf = (l, i) => l.other ? t_('⚠ {0} Knoten darunter sind schon anders eingeordnet — ab hier zu grob; granularer setzen.', [l.other]) : l.groups ? t_('⚠ {0} Untergruppen mit {1} Produkten darunter — gilt das wirklich für alle? Meist zu grob.', [l.groups, l.products]) : l.products > 1 ? t_('gilt für {0} Produkte darunter (vererbbar){1}', [l.products, i === rec ? ' ' + t_('— Empfehlung') : '']) : l.products === 1 ? t_('gilt für dieses eine Produkt') : t_('keine Produkte darunter — gilt, sobald welche kommen')
    const btns = out.map((l, i) => el('button', { class: i === rec ? 'primary' : '', title: t_('{0} Produkte darunter{1}{2}{3}', [l.products, l.groups ? ' ' + t_('· {0} Untergruppen', [l.groups]) : '', l.other ? ' ' + t_('· {0} anders eingeordnet', [l.other]) : '', i === rec ? ' ' + t_('· Empfehlung') : '']), onclick: () => { target = l.node; btns.forEach((b, k) => b.className = k === i ? 'primary' : ''); note.textContent = noteOf(l, i) } }, `${l.node.label} `, el('span', { class: l.other ? 'neg' : l.groups ? 'warn' : 'muted', style: 'font-size:11px' }, `${l.products}${l.groups ? ` · ${l.groups} ▣` : ''}${l.other ? ` · ${l.other} ≠` : ''}`)))
    note.textContent = noteOf(out[rec], rec)
    const done = v => { overlay.remove(); resolve(v) }
    box.append(el('div', { style: 'font-weight:600;margin-bottom:6px' }, title), el('div', { class: 'muted', style: 'font-size:12px' }, t_('Gilt ab (Pfad von der Wurzel bis „{0}“ — Zahl: Produkte darunter · ▣ Untergruppen · ≠ anders eingeordnet):', [row.label])), el('div', { class: 'chips', style: 'margin:4px 0' }, ...btns), note,
      el('div', { class: 'chips', style: 'justify-content:flex-end;margin-top:8px' }, el('button', { onclick: () => done(null) }, t_('Abbrechen')), el('button', { class: 'primary', onclick: () => done(target) }, 'OK')))
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
    box.append(el('div', { style: 'font-weight:600;margin-bottom:6px' }, title), host, el('div', { class: 'chips', style: 'justify-content:flex-end;margin-top:8px' }, el('button', { onclick: () => done(null) }, t_('Abbrechen')), el('button', { class: 'primary', onclick: () => done(chosen) }, 'OK')))
    overlay.append(box); document.body.append(overlay)
  })
}

// Der vorhandene Editor für Vorlage und Formel (ScriptEditor) aus dem DOM-Code dieser Ansicht heraus: er hängt sich selbst an den body.
// props wie am Knoten (title, draftKey, type, node, locale, attributes); onSave bekommt den geprüften Text, onClose kommt immer.
export function editorOeffnen({ onSave, onClose, ...props }) {
  const wirt = document.createElement('div'); document.body.append(wirt)
  const zu = () => { app.unmount(); wirt.remove(); onClose?.() }
  const app = createApp({ render: () => h(ScriptEditor, { ...props, onSave: v => { onSave?.(v); zu() }, onClose: zu }) })
  app.use(i18n); app.mount(wirt)
}

// ---- Die Ansicht — dieselbe für jeden Katalog (das Plugin ruft mount(root, ctx, catalog))
// Rechtsstand (05.10.2026): bis wann die Datenpunkte und Fristen des Katalogs am Rechtstext geprüft sind — asOf im Katalog, als TT.MM.JJJJ
const rechtsstand = catalog => /^\d{4}-\d{2}-\d{2}$/.test(catalog.asOf ?? '') ? catalog.asOf.split('-').reverse().join('.') : null

export async function mount(root, ctx, catalog) {
  if (!tree.loaded) await tree.load()
  // KI-Status frisch: die Knöpfe werden einmal gezeichnet — wenn ai.server hier null ist,
  // bleiben sie deaktiviert, auch wenn die KI längst bereit ist.
  try { await ai.loadState() } catch { /* egal, Knöpfe bleiben dann deaktiviert */ }
  const model = store.model
  const st = { root: localStorage.getItem(`journali.cmp.${catalog.key}.root`) || tree.rows.find(r => !r.parent)?.id, mapping: null, res: null, sugg: [], filter: 'all', picked: new Set(), levels: new Set(['must', 'should', 'may']), only: 'all' }
  const saved = await ctx.data.get('mapping')
  await gewaehlteGruppe(ctx, catalog)
  // Abgelehnte Vorschläge zur Geltung („nein“ zu „Vorschlag ja“) je Knoten — gemerkt, damit die Frage nicht wiederkommt
  st.declined = (await ctx.data.get('scopes_declined').catch(() => null)) ?? {}
  const decline = async (nodeId, key, on) => { const l = new Set(st.declined[nodeId] ?? []); on ? l.add(key) : l.delete(key); st.declined[nodeId] = [...l]; await ctx.data.set('scopes_declined', st.declined).catch(() => {}) }
  st.mapping = guessMapping(catalog, model)
  if (saved) for (const [k, v] of Object.entries(saved)) if (v?.to && model.attributes.some(a => a.key === v.to) && !st.mapping[k]?.fixed) st.mapping[k] = { ...v, why: 'gemerkt', sure: true }
  const remember = () => ctx.data.set('mapping', st.mapping).catch(() => {})
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => { status.textContent = m; status.className = String(m).startsWith('✗') ? 'fehler' : 'muted' }
  const body = el('div', { class: 'scroll', style: 'flex:1;padding:0 8px 12px' })
  const band = t => el('div', { class: 'step-band', style: 'margin:10px -8px 6px' }, t)
  // Teilbaum per Auswahlbaum; Knopf zeigt den gewählten, Klick klappt den Baum auf
  const rootLabel = id => { const r = tree.byId.get(id); return r ? `${r.role === 'group' ? '▣' : r.role === 'product' ? '▦' : '◆'} ${r.label}` : t_('Teilbaum wählen') }
  const rootIn = el('button', { class: 'x', title: t_('Teilbaum wählen (Gruppe oder Produkt)') }, rootLabel(st.root))
  const pick = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:5;width:380px;display:none;padding:6px;background:var(--pane)' })
  treePicker(pick, { value: st.root, roles: ['group', 'product'], height: 300, onPick: r => { st.root = r.id; rootIn.textContent = rootLabel(r.id); pick.style.display = 'none'; localStorage.setItem(`journali.cmp.${catalog.key}.root`, r.id); run() } })
  rootIn.addEventListener('click', () => { pick.style.display = pick.style.display === 'none' ? 'block' : 'none' })
  const s1 = el('div'), s2 = el('div'), s3 = el('div')
  // Keine Rechtsberatung: Kataloge, Vorschläge und Geltungen sind Hinweise und Empfehlungen —
  // verbindlich ist der Rechtstext; die Einordnung verantwortet der Anwender. Steht in jeder Prüfansicht oben, fett, und in jedem Bericht.
  const disclaimer = el('div', { class: 'warn', style: 'font-weight:700;font-size:12px;padding:4px 8px;border-bottom:1px solid var(--line)', title: t_('Die Datenpunkte, Hinweise, Fristen und Vorschläge (auch der KI) sind eine Arbeitshilfe nach bestem Wissen — keine Rechtsberatung. Massgeblich ist der Rechtstext (Quelle oben); ob und wie eine Vorschrift für ein Produkt gilt, entscheidet der Anwender.') },
    t_('⚠ Keine Rechtsberatung — Datenpunkte, Fristen, Geltungen und Vorschläge sind Hinweise und Empfehlungen. Massgeblich ist der Rechtstext ({0}).', [catalog.sourceLabel ?? t_('Quelle')]))
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, `${catalog.icon ?? '✓'} ${catalog.label}`), el('a', { href: catalog.source, target: '_blank', class: 'muted', style: 'font-size:12px', title: t_('Quelle') }, catalog.sourceLabel ?? t_('Quelle ↗')), rechtsstand(catalog) && el('span', { class: 'muted rechtsstand', style: 'font-size:12px', title: t_('Stand, zu dem Datenpunkte und Fristen am Rechtstext geprüft sind') }, t_('Rechtsstand {0}', [rechtsstand(catalog)])), el('span', { class: 'grow' }), status), disclaimer, body)
  body.append(s2, s3, s1)   // 1 Prüfen · 2 Ergebnis · 3 Modell — erst der Knoten, dann was fehlt, dann das Modell dazu

  // -- 1 Zuordnung
  function drawMapping() {
    s1.innerHTML = ''
    if (catalog.autoCreate) return   // das Modell pflegt der Katalog selbst — nichts für den Anwender
    const n = catalog.groups.reduce((k, g) => k + g.items.length, 0), mapped = Object.values(st.mapping).filter(m => m.to).length
    const openMissing = catalog.groups.flatMap(g => g.items).filter(it => !st.mapping[it.key]?.to && st.levels.has(it.level)).length
    st.mapOpen ??= false   // zu — zuordnen und anlegen geht im Ergebnis, Zeile für Zeile; hier nur die ganze Liste zum Nachsehen
    const b1 = band(t_('{0} 3 · Modell: Datenpunkte → Attribute · {1} von {2} zugeordnet{3}', [st.mapOpen ? '▾' : '▸', mapped, n, !st.mapOpen && openMissing ? ' ' + t_('· {0} ohne Attribut', [openMissing]) : '']))
    b1.style.cursor = 'pointer'; b1.title = st.mapOpen ? 'zuklappen' : t_('aufklappen — welches Attribut im Modell den Datenpunkt hat: ändern, fehlende anlegen; danach erneut prüfen')
    b1.addEventListener('click', () => { st.mapOpen = !st.mapOpen; drawMapping() })
    s1.append(b1)
    if (!st.mapOpen) return
    s1.append(el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:6px' }, t_('Modellpflege, unabhängig vom Knoten: welches Attribut im Modell den Datenpunkt hat. Fehlt eines, hier anlegen — ob es am Knoten gilt (Gruppe am Pfad), sagt das Ergebnis oben mit ⊘.') + ' ' + (catalog.description ?? '')))
    // Filter: Pflichtgrad an/aus, dazu nur zugeordnete / nur offene
    const all = catalog.groups.flatMap(g => g.items)
    const cnt = lv => all.filter(it => it.level === lv).length
    const chip = (on, label, title, fn) => el('span', { class: 'view-chip' + (on ? ' on' : ''), title, onclick: fn }, label)
    const show = it => st.levels.has(it.level) && (st.only === 'all' || (st.only === 'open' ? !st.mapping[it.key]?.to : !!st.mapping[it.key]?.to))
    s1.append(el('div', { class: 'chips', style: 'margin-bottom:6px' },
      chip(st.levels.has('must'), t_('● Pflicht {0}', [cnt('must')]), t_('Pflicht — in Anhang III / Art. 7 genannt'), () => { st.levels.has('must') ? st.levels.delete('must') : st.levels.add('must'); drawMapping() }),
      chip(st.levels.has('should'), `◐ empfohlen ${cnt('should')}`, t_('empfohlen — produktgruppenabhängig'), () => { st.levels.has('should') ? st.levels.delete('should') : st.levels.add('should'); drawMapping() }),
      chip(st.levels.has('may'), `○ optional ${cnt('may')}`, 'optional — freiwillig', () => { st.levels.has('may') ? st.levels.delete('may') : st.levels.add('may'); drawMapping() }),
      el('span', { class: 'sep' }, '·'),
      chip(st.only === 'all', 'alle', '', () => { st.only = 'all'; drawMapping() }),
      chip(st.only === 'open', `offen ${all.filter(it => st.levels.has(it.level) && !st.mapping[it.key]?.to).length}`, t_('ohne Attribut (in den gewählten Pflichtgraden)'), () => { st.only = 'open'; drawMapping() }),
      chip(st.only === 'mapped', `zugeordnet ${all.filter(it => st.levels.has(it.level) && !!st.mapping[it.key]?.to).length}`, t_('mit Attribut (in den gewählten Pflichtgraden)'), () => { st.only = 'mapped'; drawMapping() }),
      el('span', { class: 'muted', style: 'font-size:12px' }, t_('{0} von {1} gezeigt', [all.filter(show).length, n]))))
    const tbl = el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:34px' }, ''), el('th', { style: 'width:280px' }, t_('Datenpunkt')), el('th', { style: 'width:70px' }, 'Typ'), el('th', { style: 'width:280px' }, t_('Attribut im Modell')), el('th', {}, t_('Hinweis')))))
    const tb = el('tbody'); tbl.append(tb)
    for (const g of catalog.groups) {
      const items = g.items.filter(show); if (!items.length) continue
      tb.append(el('tr', { class: 'group-row' }, el('td', { colspan: '5' }, `▤ ${g.label}`, el('span', { class: 'muted', style: 'font-weight:400' }, ` · ${items.length}`))))
      for (const it of items) {
        const m = st.mapping[it.key]
        const sel = m?.fixed ? el('span', { class: m.to ? '' : 'warn' }, m.to ? `${L(model.attributes.find(a => a.key === m.to)?.label) || m.to} · ${m.to}` : t_('— fehlt, wird angelegt —')) : el('select', { style: 'width:100%' }, el('option', { value: '' }, t_('— kein Attribut —')), ...model.attributes.filter(a => !['rows', 'formula'].includes(a.type)).map(a => el('option', { value: a.key }, `${L(a.label) || a.key} · ${a.key}`)))
        if (!m?.fixed) sel.value = m?.to ?? ''
        if (!m?.to) sel.style.color = 'var(--warn)'
        sel.addEventListener('change', () => { st.mapping[it.key] = { to: sel.value, why: t_('gewählt'), sure: true }; remember(); st.dirty = !!st.res; drawMapping(); drawResult() })
        tb.append(el('tr', {}, el('td', { title: it.level === 'must' ? t_('Pflicht') : it.level === 'should' ? 'empfohlen' : 'optional' }, it.level === 'must' ? '●' : it.level === 'should' ? '◐' : '○'),
          el('td', {}, el('b', {}, it.label), el('div', { class: 'mono muted', style: 'font-size:11px' }, it.key)),
          el('td', { class: 'muted' }, `${it.type ?? 'text'}${it.unit ? ' ' + it.unit : ''}`),
          el('td', {}, sel, el('div', { class: 'muted', style: 'font-size:11px' }, m?.why ?? '')),
          // Sondergruppe ohne Geltung am geprüften Knoten: nichts fehlt — sie gilt hier nicht, darum wurde nichts angelegt
          el('td', { class: 'muted', style: 'font-size:12px;white-space:normal' }, g.scope && st.res && !st.res.items.some(x => x.key === it.key && st.res.byItem.get(x.key).na < st.res.nodes.length) ? el('span', { class: 'warn' }, t_('gilt am geprüften Knoten nicht (Geltung „{0}“ nicht gesetzt) — darum kein Attribut nötig', [g.scope.label])) : (it.hint ?? ''))))
      }
    }
    s1.append(tbl)
    const missing = all.filter(it => !st.mapping[it.key]?.to && st.levels.has(it.level))
    const bar = el('div', { class: 'chips', style: 'margin-top:6px' })
    if (st.dirty) bar.append(el('button', { class: 'primary', onclick: run, title: t_('Zuordnung geändert — den Teilbaum mit der neuen Zuordnung prüfen') }, t_('↻ erneut prüfen')))
    s1.append(bar)
  }

  // -- 2 Prüfung
  function drawRun() {
    s2.innerHTML = ''
    s2.append(band(t_('1 · Prüfen')))
    s2.append(el('div', { class: 'chips' }, el('span', { style: 'position:relative' }, rootIn, pick), el('button', { class: 'primary', onclick: run }, t_('▶ prüfen')),
      el('span', { class: 'muted', style: 'font-size:12px' }, t_('● Pflicht · ◐ empfohlen · ○ optional — Anteil erfüllter Pflicht-Datenpunkte je Knoten; ↓ = in allen Varianten darunter belegt (zählt als erfüllt)'))))
  }
  async function run() {
    if (!st.root) return
    try {
      st.res = await check(catalog, st.mapping, st.root, say)
      let again = false
      // Immer: eine zugeordnete/angelegte Gruppe muss am Pfad hängen, sonst 'gilt hier nicht' —
      // ein Regelaufsatz ohne diesen Schritt ist eine leere Zeremonie.
      const rootRow = tree.byId.get(st.root)
      if (rootRow && st.res.inactiveGroups?.size) {
        const have = (rootRow.groups ?? '').split(',').filter(Boolean)
        const neu = [...st.res.inactiveGroups].filter(g => !have.includes(g))
        if (neu.length) {
          await api.post(`/api/nodes/${encodeURIComponent(rootRow.id)}/groups`, { groups: [...have, ...neu] }, 'PUT')
          await tree.load()
          say(t_('Gruppe {0} an „{1}“ angehängt', [neu.join(', '), rootRow.label]))
          again = true
        }
      }
      if (catalog.autoCreate) {
        // Fehlende Attribute anlegen — nur, wenn der Katalog es will (PPWR, DPP).
        const need = st.res.items.filter(it => !st.mapping[it.key]?.to && st.res.byItem.get(it.key).na < st.res.nodes.length)
        if (need.length) { say(t_('lege {0} Attribute an …', [need.length])); await createAttributes(catalog, need, st.mapping); await remember(); again = true }
      }
      if (again) { await store.poll(true); st.res = await check(catalog, st.mapping, st.root, say) }
      st.sugg = deriveSuggestions(catalog, st.mapping, st.res); st.dirty = false; say(t_('{0} Knoten geprüft', [st.res.nodes.length])); drawResult(); drawMapping()
    }
    catch (e) { say('✗ ' + e.message); store.toast(e.message) }
  }
  // Steckbrief: was ist gemeint · wo steht es · ab wann · was, wenn es fehlt · woher man es bekommt — aus dem Katalog (what, law, from,
  // ifMissing, source), sonst aus hint. Angehängt: Attribut im Modell und der Hinweis „keine Rechtsberatung“.
  function explain(it) {
    const rows = []
    if (it.what || it.hint) rows.push(['Was', it.what || it.hint])
    if (it.law) rows.push([t_('Wo steht es'), it.law])
    if (it.from) rows.push([t_('Ab wann'), it.from])
    if (it.ifMissing) rows.push([t_('Wenn es fehlt'), it.ifMissing])
    if (it.source) rows.push([t_('Woher'), it.source])
    if (it.type) rows.push([t_('Form'), `${it.type}${it.unit ? ' in ' + it.unit : ''}${it.values ? ' — ' + it.values.slice(0, 8).join(', ') + (it.values.length > 8 ? ' …' : '') : ''}`])
    rows.push([t_('Pflicht'), it.level === 'must' ? t_('● Pflicht') : it.level === 'should' ? '◐ empfohlen' : '○ optional'])
    const to = st.mapping[it.key]?.to; rows.push([t_('Attribut'), to ? `${L(store.model.attributes.find(a => a.key === to)?.label) || to} · ${to}` : t_('— noch keins —')])
    if (rechtsstand(catalog)) rows.push([t_('Rechtsstand'), rechtsstand(catalog)])
    rows.push([t_('Hinweis'), t_('keine Rechtsberatung — Hinweis nach bestem Wissen, massgeblich ist der Rechtstext')])
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
      if (listVals) inp = el('select', { style: 'width:220px' }, el('option', { value: '' }, '—'), ...listVals.map(v => el('option', { value: v.value }, L(v.label) || v.label?.en || v.value)))
      else if (def?.type === 'template' || def?.type === 'formula') {
        // Vorlage und Formel schreibt man im Editor, der die Attribute des Knotens zeigt; der Knopf zeigt danach den Text
        const zeichen = def.type === 'template' ? '{} ' : 'ƒ '
        inp = el('button', { class: 'x', style: 'width:220px;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', title: t_('Im Editor schreiben — er zeigt die Attribute des Knotens und das Ergebnis'), onclick: () => {
          const vorher = overlay.style.zIndex; overlay.style.zIndex = '10'   // der Editor liegt bei 20 und muss über dieser Liste stehen
          editorOeffnen({ title: `${it.label} · ${n.row.label}`, draftKey: `${n.row.id}.${to}.pruefung`, type: def.type, node: n.row.id, locale: def.perLocale ? st.res.locale : undefined,
            attributes: (store.model.attributes ?? []).filter(a => a.key !== to && a.type !== 'rows' && a.type !== 'html'),
            onSave: async v => {
              try { await api.post(`/api/nodes/${encodeURIComponent(n.row.id)}/attributes`, { attribute: to, locale: def.perLocale ? st.res.locale : null, channel: null, value: v, row: null }); written = true; inp.textContent = zeichen + v; state.textContent = '✓'; state.className = 'pos'; state.title = '' }
              catch (e) { state.textContent = '✗ ' + e.message; state.className = 'fehler'; state.title = e.message }
            },
            onClose: () => { overlay.style.zIndex = vorher } })
        } }, zeichen + t_('Editor öffnen …'))
      }
      else if (def?.type === 'boolean') inp = el('select', { style: 'width:220px' }, el('option', { value: '' }, '—'), el('option', { value: 'true' }, 'ja'), el('option', { value: 'false' }, 'nein'))
      else inp = el('input', { style: 'width:220px', placeholder: it.unit ? t_('Wert in {0}', [it.unit]) : t_('Wert') })
      const write = async () => { const v = inp.value.trim(); if (!v) return; try { await api.post(`/api/nodes/${encodeURIComponent(n.row.id)}/attributes`, { attribute: to, locale: null, channel: null, value: v, row: null }); written = true; state.textContent = '✓'; state.className = 'pos'; state.title = '' } catch (e) { state.textContent = '✗ ' + e.message; state.className = 'fehler'; state.title = e.message } }
      inp.addEventListener('change', write); inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); write() } })
      const state = el('span', { class: pend ? 'warn' : 'muted', style: 'width:120px;font-size:12px' }, pend ? `⏳ ${pend.source ?? 'angefragt'} · ${pend.checkedAt ?? ''}` : '')
      const who = el('input', { style: 'width:170px;display:none', placeholder: t_('bei wem? (Lieferant, Abteilung, Person)'), value: pend?.source ?? '' })
      const due = el('input', { type: 'date', style: 'width:140px;display:none', title: t_('Wiedervorlage — danach gilt es als überfällig'), value: pend?.checkedAt ?? new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10) })
      const ok = el('button', { class: 'primary', style: 'display:none', title: t_('als angefragt merken'), onclick: async () => {
        try { await api.post(`/api/nodes/${encodeURIComponent(n.row.id)}/sources`, { attribute: to, locale: null, channel: null, row: null, source: who.value.trim() || null, title: null, note: null, method: 'pending', checkedAt: due.value || null }); written = true; state.textContent = `⏳ ${who.value.trim() || 'angefragt'} · ${due.value}`; state.className = 'warn'; for (const x of [who, due, ok]) x.style.display = 'none'; inp.style.display = '' } catch (e) { state.textContent = '✗ ' + e.message; state.className = 'fehler'; state.title = e.message }
      } }, '✓')
      const pendBtn = el('button', { class: 'x', title: t_('weiss ich noch nicht — bei wem angefragt, bis wann (Wiedervorlage)'), onclick: () => { const open = who.style.display === 'none'; for (const x of [who, due, ok]) x.style.display = open ? '' : 'none'; inp.style.display = open ? 'none' : ''; if (open) who.focus() } }, '⏳')
      who.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok.click() } })
      rows.append(el('div', { style: 'display:flex;gap:8px;align-items:center;padding:3px 0;border-bottom:1px solid var(--line)' }, el('span', { style: 'flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis', title: n.row.id }, `${n.row.role === 'variant' ? '◆' : n.row.role === 'product' ? '▦' : '▣'} ${n.row.label}`), inp, who, due, ok, pendBtn, state))
    }
    box.append(el('div', { class: 'chips', style: 'margin-bottom:6px' }, el('b', {}, `${it.label} · ${nodes.length} leer`), el('span', { class: 'grow' }), el('button', { class: 'x', onclick: () => explain(it) }, 'ⓘ'), el('button', { class: 'x', onclick: close }, '✕')),
      el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:6px' }, t_('Wert eintragen (Enter schreibt sofort) — oder ⏳ „angefragt bei …“ mit Wiedervorlage')), rows,
      el('div', { class: 'chips', style: 'justify-content:flex-end;margin-top:8px' }, el('button', { class: 'primary', onclick: () => { written = true; close() } }, t_('fertig — erneut prüfen'))))
    overlay.append(box); document.body.append(overlay)
    setTimeout(() => rows.querySelector('input, select')?.focus(), 0)
  }
  async function askPending(n, it, pend, bad = null) {
    const to = st.mapping[it.key]?.to; if (!to) return
    const def = store.model.attributes.find(a => a.key === to)
    if (def?.type === 'template' || def?.type === 'formula') {
      // Vorlage und Formel schreibt man im Editor; er lädt den Text des Knotens, sonst den des Vorfahren, von dem er kommt
      const locale = def.perLocale ? st.res.locale : null
      let text = ''
      try { const ansicht = await api.get(`/api/nodes/${encodeURIComponent(n.from?.[to] ?? n.row.id)}`); text = (ansicht.values ?? []).find(x => x.attribute === to && (x.locale ?? null) === locale && !x.row)?.value ?? '' } catch { /* leer beginnen */ }
      editorOeffnen({ title: `${it.label} · ${n.row.label}`, draftKey: `${n.row.id}.${to}.pruefung`, type: def.type, node: n.row.id, locale: locale ?? undefined, modelValue: text,
        attributes: (store.model.attributes ?? []).filter(a => a.key !== to && a.type !== 'rows' && a.type !== 'html'),
        onSave: async v => { try { await api.post(`/api/nodes/${encodeURIComponent(n.row.id)}/attributes`, { attribute: to, locale, channel: null, value: v, row: null }); await run() } catch (e) { store.toast(e.message) } } })
      return
    }
    const v = await dialog.prompt({ title: `${it.label} · ${n.row.label}`, value: bad?.value ?? '', text: bad ? t_('✗ {0} — Wert korrigieren{1}.', [bad.message, it.unit ? ` (in ${it.unit})` : '']) : pend ? t_('⏳ angefragt{0}, Wiedervorlage {1}. Wert eintragen — oder leer lassen und die Anfrage ändern.', [pend.source ? ' bei ' + pend.source : '', pend.checkedAt ?? '—']) : t_('Wert eintragen — oder leer lassen: dann „weiss ich noch nicht, frage bei …“ mit Wiedervorlage.'), value: '', placeholder: it.unit ? t_('Wert in {0}', [it.unit]) : t_('Wert'), ok: t_('Eintragen') })
    if (v == null) return
    try {
      if (v.trim()) { await api.post(`/api/nodes/${encodeURIComponent(n.row.id)}/attributes`, { attribute: to, locale: null, channel: null, value: v.trim(), row: null }); await run(); return }
      const who = await dialog.prompt({ title: t_('Anfragen bei …'), text: 'Lieferant, Abteilung, Person', value: pend?.source ?? '', ok: t_('Weiter') }); if (who == null) return
      const due = await dialog.prompt({ title: t_('Wiedervorlage setzen'), text: t_('Datum JJJJ-MM-TT (danach überfällig)'), value: pend?.checkedAt ?? new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10), ok: t_('⏳ Anfragen') }); if (due == null) return
      await api.post(`/api/nodes/${encodeURIComponent(n.row.id)}/sources`, { attribute: to, locale: null, channel: null, row: null, source: who.trim() || null, title: null, note: null, method: 'pending', checkedAt: due.trim() || null })
      await run()
    } catch (e) { store.toast(e.message) }
  }
  const infoBtn = it => el('button', { class: 'x', style: 'padding:0 5px;font-size:11px', title: t_('Was ist das? Wo steht es? Woher bekomme ich es?'), onclick: () => explain(it) }, 'ⓘ')
  const SYM = { ok: '✓', empty: '·', bad: '✗', unmapped: '—', na: '', below: '↓', inactive: '⊘', pending: '⏳' }
  const CLS = { ok: 'pos', empty: 'muted', bad: 'neg', unmapped: 'muted', na: 'muted', below: 'pos', inactive: 'warn', pending: 'warn' }
  // Beim Klick nicht auf den (moeglicherweise veralteten) reactive-Zustand vertrauen — frisch nachladen,
  // dann entscheiden. So bleibt der Knopf klickbar, auch wenn ai.server beim Zeichnen noch null war.
  async function kiPruefen() {
    if (ai.available()) return true
    try { await ai.loadState() } catch { /* egal */ }
    if (ai.available()) return true
    store.toast(t_('KI nicht bereit — Einstellungen → Team → KI'))
    return false
  }

  function drawResult() {
    s3.innerHTML = ''
    const r = st.res; if (!r) return
    const scored = r.nodes.filter(n => n.score != null)
    const avg = scored.length ? Math.round(scored.reduce((k, n) => k + n.score, 0) / scored.length) : null
    s3.append(band(`2 · Ergebnis · ${r.nodes.length} Knoten${avg != null ? ` · Pflicht im Schnitt ${avg} %` : ''}${r.unmapped.length ? ` · ${r.unmapped.length} Datenpunkte ohne Attribut im Modell (3)` : ''}${st.dirty ? ' · Zuordnung geändert — ↻ erneut prüfen' : ''}`))
    // je Datenpunkt: Zusammenfassung
    const sum = el('table', { class: 'grid', style: 'width:auto' }, el('thead', {}, el('tr', {}, el('th', {}, t_('Datenpunkt')), el('th', { class: 'num' }, '✓'), el('th', { class: 'num' }, 'leer'), el('th', { class: 'num' }, '✗'), el('th', {}, ''))))
    const sb = el('tbody'); sum.append(sb)
    // Datenpunkte, die an keinem geprüften Knoten gelten (Rolle, Klasse), stehen nicht in der Liste — ein Notebook bekommt keine
    // Leitungsschutzschalter-Merkmale vorgehalten; eine Zeile nennt, wie viele es sind
    const hidden = r.nodes.length ? r.items.filter(it => r.byItem.get(it.key).na === r.nodes.length) : []
    // fehlendes Attribut: in der Zeile zuordnen (Auswahl) oder anlegen — nicht „siehe unter 3“
    const mapCell = it => {
      const sel = el('select', { style: 'max-width:220px;color:var(--warn)' }, el('option', { value: '' }, 'zuordnen …'), ...model.attributes.filter(a => !['rows', 'formula'].includes(a.type)).map(a => el('option', { value: a.key }, `${L(a.label) || a.key} · ${a.key}`)))
      sel.addEventListener('change', async () => { if (!sel.value) return; st.mapping[it.key] = { to: sel.value, why: t_('gewählt'), sure: true }; await remember(); await run() })
      const mk = el('button', { class: 'x', title: t_('Attribut {0} in Gruppe {1} anlegen', [(catalog.prefix ?? '') + it.key, catalog.groupKey]), onclick: async () => { say(t_('lege an …')); try { await createAttributes(catalog, [it], st.mapping); await remember(); say(''); await run() } catch (e) { store.toast(e.message); say('✗ ' + e.message) } } }, '+ anlegen')
      mk.textContent = t_('+ anlegen in {0}', [catalog.groupKey])
      return el('span', { style: 'display:inline-flex;gap:4px;align-items:center' }, sel, mk)
    }
    const unm = r.items.filter(it => !st.mapping[it.key]?.to && !hidden.includes(it))
    for (const it of r.items) { const c = r.byItem.get(it.key); const to = st.mapping[it.key]?.to; if (hidden.includes(it)) continue; sb.append(el('tr', {}, el('td', {}, `${it.level === 'must' ? '●' : it.level === 'should' ? '◐' : '○'} ${it.label} `, infoBtn(it)), el('td', { class: 'num ' + (c.ok + c.below ? 'pos' : 'muted'), title: c.below ? t_('{0} selbst, {1} über die Varianten darunter', [c.ok, c.below]) : '' }, String(c.ok + c.below)), el('td', { class: 'num ' + (c.empty + c.inactive ? (it.level === 'must' ? 'neg' : 'warn') : 'muted'), style: c.empty || c.pending ? 'cursor:pointer;text-decoration:underline dotted' : '', onclick: c.empty || c.pending ? () => fillList(it) : null, title: c.empty ? t_('{0} leer eintragen (Knoten für Knoten, Wert oder „angefragt bei …“)', [c.empty]) + (c.inactive ? ' ' + t_('· {0} ohne gültiges Attribut', [c.inactive]) : '') : c.inactive ? t_('davon {0} ohne gültiges Attribut (Gruppe nicht am Pfad)', [c.inactive]) : '' }, String(c.empty + c.inactive), c.pending ? el('span', { class: 'warn', title: t_('{0} Anfragen anzeigen (bei wem, bis wann)', [c.pending]) }, ` ⏳${c.pending}`) : null), el('td', { class: 'num ' + (c.bad ? 'neg' : 'muted') }, String(c.bad)), el('td', { class: to ? 'muted' : it.level === 'must' ? 'neg' : it.level === 'should' ? 'warn' : 'muted', style: 'font-size:11px' }, to ? '' : mapCell(it)))) }   // Farbe sagt den Stand: grün nur, wo etwas erfüllt ist; leer/kein Attribut bei Pflicht rot, bei empfohlen orange
    if (hidden.length) sb.append(el('tr', {}, el('td', { class: 'muted', colspan: '5' }, t_('… {0} weitere Datenpunkte gelten an keinem der {1} Knoten (andere Klasse oder Rolle)', [hidden.length, r.nodes.length]))))
    // Gruppe fürs Anlegen: wählbar (vorhandene oder neuer Schlüssel), je Katalog gemerkt — steht am Knopf und in jeder Zeile
    const grpSel = el('select', { title: t_('Attributgruppe, in der fehlende Attribute angelegt werden — vorhandene wählen oder neu') }, ...[...new Set([catalog.groupKey, ...(model.groups ?? []).map(g => g.key)])].map(k => el('option', { value: k }, `${L((model.groups ?? []).find(g => g.key === k)?.label) || (k === catalog.groupKey ? catalog.groupLabel || k : k)} (${k})${(model.groups ?? []).some(g => g.key === k) ? '' : ' — neu'}`)), el('option', { value: '__new__' }, t_('+ neue Gruppe …')))
    grpSel.value = catalog.groupKey
    grpSel.addEventListener('change', async () => { let k = grpSel.value; if (k === '__new__') { k = await dialog.prompt({ title: t_('Attributgruppe anlegen'), value: '', placeholder: t_('Schlüssel (a-z, 0-9, _)'), ok: t_('+ Anlegen') }); k = (k ?? '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_'); if (!k) { grpSel.value = catalog.groupKey; return } } catalog.groupKey = k; await ctx.data.set('group', k).catch(() => {}); drawResult(); drawMapping() })
    const scopes = catalog.groups.filter(g => g.scope).map(g => g.scope)
    if (scopes.length) {
      const scopeAttr = `${catalog.key}_scope`; const rootRow = tree.byId.get(st.root)
      const have = String(r.nodes.find(n => n.row.id === st.root)?.raw?.[scopeAttr] ?? '').split(',').map(s => s.trim()).filter(Boolean)
      const line = el('div', { class: 'muted', style: 'margin:6px 0 0;font-size:12px' }, t_('Sonderregeln für {0} — je Zeile der Stand, der Grund, und ob etwas zu tun ist:', [rootRow?.label ?? '']))
      const setScope = async (s, on) => {
        if (on === have.includes(s.key)) return
        try {
          if (!store.model.attributes.some(a => a.key === scopeAttr)) {
            if (!store.model.lists?.some(l => l.key === scopeAttr)) await api.post(`/api/model/lists/${scopeAttr}`, { key: scopeAttr, label: { de: t_('{0} — Geltung', [catalog.label]), en: `${catalog.label} — scope` } }, 'PUT')
            await api.post(`/api/model/lists/${scopeAttr}/values`, scopes.map(x => ({ value: x.key, label: { de: x.label, en: x.label } })), 'PUT')
            await api.post(`/api/model/attributes/${scopeAttr}`, { key: scopeAttr, label: { de: t_('{0} — Geltung', [catalog.label]), en: `${catalog.label} — scope` }, type: 'enum', list: scopeAttr, multiple: true, inheritable: true, group: catalog.groupKey }, 'PUT')
            await store.poll(true)
          }
          const next = have.includes(s.key) ? have.filter(x => x !== s.key) : [...have, s.key]
          // wegnehmen: an dem Knoten, an dem es steht (geerbt: der Vater) — keine Ebenenfrage; setzen: Ebene wählen
          const fromId = r.nodes.find(n => n.row.id === st.root)?.from?.[scopeAttr]
          const target = have.includes(s.key)
            ? ((await dialog.confirm({ title: `${s.label} wegnehmen?`, text: t_('Gesetzt an „{0}“; gilt danach dort und darunter nicht mehr', [(fromId ? tree.byId.get(fromId)?.label : null) ?? rootRow?.label ?? '']), ok: t_('Wegnehmen') })) ? (fromId ? tree.byId.get(fromId) : null) ?? rootRow : null)
            : await pickLevel(rootRow, t_('{0}: gilt ab welchem Knoten? (vererbbar)', [s.label]), { attr: scopeAttr, wanted: s.key })
          if (!target) return
          const th = (target.groups ?? '').split(',').filter(Boolean); if (!th.includes(catalog.groupKey) && !tree.ancestors(target.id).some(a => (a.groups ?? '').split(',').includes(catalog.groupKey))) await api.post(`/api/nodes/${encodeURIComponent(target.id)}/groups`, { groups: [...th, catalog.groupKey] }, 'PUT')
          await api.post(`/api/nodes/${encodeURIComponent(target.id)}/attributes`, { attribute: scopeAttr, locale: null, channel: null, value: null, values: next.length ? next : null, row: null })
          if (on) await decline(st.root, s.key, false)
          await store.poll(true); await tree.load(); await run()
        } catch (e) { store.toast(e.message) }
      }
      // Eine Zeile je Sonderregel, keine Frage, die schon beantwortet ist:
      //   Stand und Vorschlag einig → Aussage mit Grund und „ändern“ · uneinig → die Frage mit beiden Seiten · kein Vorschlag → ja/nein
      s3.append(line)
      const rowsBox = el('div', { style: 'margin:2px 0 6px' }); s3.append(rowsBox)
      const render = (list) => {
        rowsBox.innerHTML = ''
        // ohne Vorschlag: einmal über den Zeilen, was Vorschläge möglich macht (05.10.2026 — vorher je Zeile ein Ratschlag)
        if (list === null) rowsBox.append(el('div', { class: 'muted vorschlag-quelle', style: 'margin:2px 0;font-size:12px', title: t_('Vorschläge kommen aus der ETIM-Klasse des Knotens (eigen oder geerbt) und von der KI (Schlüssel unter ⚙ Einstellungen) — entschieden wird hier mit ja oder nein') }, t_('Mit gesetzter ETIM-Klasse oder KI sind Vorschläge möglich.')))
        for (const s of scopes) {
          const on = have.includes(s.key); const sg = list?.items.find(x => x.key === s.key) ?? null
          const why = sg?.why ? ` (${sg.why})` : ''
          const row = el('div', { class: 'chips', style: 'margin:2px 0;font-size:12px', title: s.hint ?? '' })
          if (on) {
            const fromId = r.nodes.find(n => n.row.id === st.root)?.from?.[scopeAttr]; const at = fromId ? tree.byId.get(fromId)?.label ?? fromId : rootRow?.label ?? ''
            row.append(el('span', { class: 'pos' }, t_('{0}: gilt hier — gesetzt an „{1}“ (vererbbar)', [s.label, at])), el('button', { class: 'x', title: t_('wegnehmen — am Knoten, an dem es gesetzt ist'), onclick: () => setScope(s, false) }, t_('ändern')),
              sg && !sg.applies ? el('span', { class: 'muted', title: t_('nur ein Hinweis — deine Entscheidung gilt') }, t_('Hinweis: Vorschlag wäre „nein“{0}', [why])) : null)
          } else if ((st.declined[st.root] ?? []).includes(s.key)) {
            row.append(el('span', { class: 'muted' }, t_('{0}: gilt hier nicht — deine Entscheidung{1}', [s.label, sg?.applies ? ' ' + t_('(Vorschlag wäre „ja“{0})', [why]) : ''])), el('button', { class: 'x', title: t_('doch setzen — ab welchem Knoten, fragt der nächste Schritt'), onclick: async () => { await decline(st.root, s.key, false); setScope(s, true) } }, t_('ändern')))
          } else if (sg && !sg.applies) {
            row.append(el('span', { class: 'muted' }, t_('{0}: gilt hier nicht{1}', [s.label, why])), el('button', { class: 'x', title: t_('doch setzen — ab welchem Knoten, fragt der nächste Schritt'), onclick: () => setScope(s, true) }, t_('ändern')))
          } else if (sg) {
            row.append(el('span', { class: 'warn' }, t_('{0}: nicht gesetzt, Vorschlag „ja“{1} —', [s.label, why])), el('button', { class: 'primary', title: t_('setzen — ab welchem Knoten, fragt der nächste Schritt'), onclick: () => setScope(s, true) }, '→ ja'), el('button', { class: 'x', title: t_('gilt hier nicht — wird gemerkt, die Frage kommt nicht wieder'), onclick: async () => { await decline(st.root, s.key, true); drawResult() } }, 'nein'))
          } else {
            row.append(el('span', {}, `${s.label}?`), el('button', { class: on ? 'primary' : '', onclick: () => setScope(s, true) }, 'ja'), el('button', { class: on ? '' : 'primary', onclick: () => setScope(s, false) }, 'nein'))
          }
          rowsBox.append(row)
        }
      }
      render(undefined)
      suggestScopes(catalog, rootRow, scopes, have).then(list => render(list)).catch(() => render(null))
    }
    const inactiveN = r.nodes.reduce((k, x) => k + Object.values(x.states).filter(s => s === 'inactive').length, 0)
    const emptyN = r.nodes.reduce((k, x) => k + Object.values(x.states).filter(s => s === 'empty').length, 0), badN = r.nodes.reduce((k, x) => k + Object.values(x.states).filter(s => s === 'bad').length, 0)
    // Der Assistent: Analyse → Deltas (zuordnen/anlegen, in welcher Gruppe) → Gruppe im Baum anhängen → erneut → bis alles zugeordnet ist oder der Anwender aufgibt
    const pendN = r.nodes.reduce((k, x) => k + (x.pending ?? 0), 0), overN = r.nodes.reduce((k, x) => k + (x.overdue ?? 0), 0)
    const next = unm.length ? t_('Schritt: {0} Datenpunkte ohne Attribut — unten zuordnen oder anlegen', [unm.length]) : inactiveN ? t_('Schritt: die Gruppe im Baum anhängen — dann erneut prüfen') : (emptyN || badN) ? t_('Zuordnung vollständig — {0} leere{1} Werte füllen (Klick auf die Zahl „leer“ oder in die Zelle der Knoten-Tabelle){2}', [emptyN, badN ? `, ${badN} falsche` : '', pendN ? ` · ⏳ ${pendN} angefragt${overN ? `, ${overN} überfällig` : ''}` : '']) : pendN ? t_('⏳ {0} angefragt{1} — sonst alles da', [pendN, overN ? t_(', {0} überfällig', [overN]) : '']) : t_('✓ alles zugeordnet und gefüllt')
    s3.append(el('div', { class: 'chips', style: 'margin:4px 0;font-weight:600' }, el('span', { class: unm.length || inactiveN ? 'warn' : (emptyN || badN) ? '' : 'pos' }, next)))
    if (unm.length) s3.append(el('div', { class: 'chips', style: 'margin:4px 0' }, el('button', { class: 'primary', onclick: async () => { if (!(await dialog.confirm({ title: t_('{0} Attribute anlegen?', [unm.length]), warn: t_('Gruppe „{0}“', [catalog.groupKey]), list: unm.map(it => `${(catalog.prefix ?? '') + it.key} · ${it.label}`), ok: t_('+ Anlegen') }))) return; say(t_('lege an …')); try { await createAttributes(catalog, unm, st.mapping); await remember(); say(''); await run() } catch (e) { store.toast(e.message); say('✗ ' + e.message) } } }, t_('+ {0} fehlende Attribute anlegen', [unm.length])), el('span', { class: 'muted' }, t_('in Gruppe')), grpSel))
    if (catalog.summary) { const s = catalog.summary(r, st.mapping, ctx); if (s) s3.append(el('div', { class: 'chips', style: 'margin-top:6px' }, s)) }
    if (r.inactiveGroups?.size) {
      // Schritt: die Gruppe hängt an keinem Knoten des Pfads — WO im Baum sie hängen soll, sagt der Anwender; Vorgabe: der geprüfte Knoten
      const groups = [...r.inactiveGroups]; let target = tree.byId.get(st.root)
      const n = r.nodes.reduce((k, x) => k + Object.values(x.states).filter(s => s === 'inactive').length, 0)
      const tBtn = el('button', { class: 'x', title: t_('Knoten wählen, an dem die Gruppe hängen soll — gilt für alles darunter') }, `${target ? `${target.label}` : 'Knoten wählen'} ▾`)
      const pickBox = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:6;width:380px;display:none;padding:6px;background:var(--pane)' })
      treePicker(pickBox, { value: target?.id ?? null, roles: ['group', 'product'], height: 300, onPick: r2 => { target = r2; tBtn.textContent = `${r2.label} ▾`; pickBox.style.display = 'none' } })
      tBtn.addEventListener('click', () => { pickBox.style.display = pickBox.style.display === 'none' ? 'block' : 'none' })
      s3.append(el('div', { class: 'chips', style: 'margin-top:6px' }, el('span', { class: 'warn' }, t_('⊘ {0} Werte gelten hier nicht — Gruppe {1} hängt an keinem Knoten des Pfads. Anhängen an', [n, groups.map(g => '„' + (L(store.model.groups.find(x => x.key === g)?.label) || g) + '“').join(', ')])),
        el('span', { style: 'position:relative' }, tBtn, pickBox),
        el('button', { class: 'primary', onclick: async () => {
          if (!target) return
          try { const have = (target.groups ?? '').split(',').filter(Boolean); await api.post(`/api/nodes/${encodeURIComponent(target.id)}/groups`, { groups: [...new Set([...have, ...groups])] }, 'PUT'); await tree.load(); store.toast(`✓ ${groups.join(', ')} an ${target.label}`); await run() } catch (e) { store.toast(e.message) }
        } }, t_('▤ anhängen und erneut prüfen'))))
    }
    s3.append(el('details', { open: '' }, el('summary', { class: 'muted' }, t_('je Datenpunkt')), sum))
    // je Knoten: Matrix
    const items = r.items.filter(it => st.mapping[it.key]?.to && st.levels.has(it.level))
    const tbl = el('table', { class: 'grid', style: 'width:auto;margin-top:8px' })
    // wenige Spalten (≤ 6): Köpfe waagerecht wie überall — gedreht nur, wenn es eng wird
    const rotate = items.length > 6
    const headH = Math.min(110, 16 + 5.6 * Math.max(4, ...items.map(it => Math.min(22, it.label.length))))
    tbl.append(el('thead', {}, el('tr', {}, el('th', { style: 'width:28px' }, el('input', { type: 'checkbox', title: t_('alle für KI-Vorschläge'), onchange: e => { st.picked = e.target.checked ? new Set(r.nodes.map(n => n.row.id)) : new Set(); drawResult() } })), el('th', { style: 'width:300px' }, t_('Knoten')), el('th', { class: 'num', style: 'width:60px' }, t_('Pflicht')), ...(catalog.rowNote ? [el('th', { style: 'width:150px' }, '')] : []), ...items.map(it => rotate
      ? el('th', { title: `${it.label} → ${st.mapping[it.key].to}`, style: 'height:auto;vertical-align:bottom;padding:4px 2px' }, el('div', { style: 'writing-mode:vertical-rl;transform:rotate(180deg);height:' + headH + 'px;font-weight:400;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, it.label.slice(0, 22)))
      : el('th', { title: `${it.label} → ${st.mapping[it.key].to}`, style: 'font-weight:400;font-size:11px;max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:2px 6px' }, it.label)))))
    const tb = el('tbody'); tbl.append(tb)
    // Einrückung nach Tiefe im geprüften Teilbaum
    const inRun = new Map(r.nodes.map(n => [n.row.id, n.row.parent]))
    const depthOf = id => { let d = 0; for (let p = inRun.get(id); p && inRun.has(p); p = inRun.get(p)) d++; return d }
    for (const n of r.nodes) {
      const cb = el('input', { type: 'checkbox' }); cb.checked = st.picked.has(n.row.id); cb.addEventListener('change', () => { cb.checked ? st.picked.add(n.row.id) : st.picked.delete(n.row.id) })
      tb.append(el('tr', {}, el('td', {}, cb), el('td', { style: `padding-left:${6 + depthOf(n.row.id) * 18}px` }, el('a', { href: `/tree/${n.row.id}`, onclick: e => { e.preventDefault(); ctx.go?.(`/tree/${n.row.id}`) }, title: n.row.id }, `${n.row.role === 'variant' ? '◆' : n.row.role === 'product' ? '▦' : '▣'} ${n.row.label}`)),
        el('td', { class: 'num ' + (n.score == null ? 'muted' : n.score === 100 ? 'pos' : n.score < 50 ? 'neg' : 'warn') }, n.score == null ? '–' : n.score + ' %'),
        ...(catalog.rowNote ? [el('td', { style: 'font-size:12px' }, catalog.rowNote(n, st.mapping, ctx))] : []),
        ...items.map(it => { const s = n.states[it.key]; const f = n.findings.find(x => x.item.key === it.key); const pend = n.pendingInfo?.[it.key]; return el('td', { class: CLS[s], style: 'text-align:center' + (s === 'empty' || s === 'pending' || s === 'bad' ? ';cursor:pointer' : ''), onclick: s === 'empty' || s === 'pending' || s === 'bad' ? () => askPending(n, it, pend, s === 'bad' ? { value: n.raw[st.mapping[it.key]?.to], message: f?.message } : null) : null, title: s === 'pending' ? t_('⏳ angefragt{0}{1}{2} · Wert eintragen oder Anfrage ändern', [pend?.source ? ' bei ' + pend.source : '', pend?.checkedAt ? ' ' + t_('· Wiedervorlage') + ' ' + pend.checkedAt + (pend.checkedAt < new Date().toISOString().slice(0, 10) ? ' ' + t_('— überfällig') : '') : '', pend?.note ? ' · ' + pend.note : '']) : f ? f.message : s === 'ok' ? t_('erfüllt') : s === 'below' ? t_('in allen Varianten darunter belegt') : s === 'empty' ? 'leer' : s === 'inactive' ? t_('gilt hier nicht — Gruppe „{0}“ hängt an keinem Knoten des Pfads', [store.model.attributes.find(a => a.key === st.mapping[it.key]?.to)?.group ?? '?']) : '' }, SYM[s]) })))
    }
    s3.append(tbl)
    // Befunde (fragliche Werte)
    const bad = r.nodes.flatMap(n => n.findings.map(f => ({ n, f })))
    if (bad.length) s3.append(el('div', { style: 'margin-top:8px' }, el('b', { class: 'neg' }, t_('✗ {0} fragliche Werte', [bad.length])), el('ul', { style: 'margin:4px 0 0 18px;font-size:12px' }, ...bad.slice(0, 50).map(({ n, f }) => el('li', {}, `${n.row.label} · ${f.item.label}: ${f.message}`)))))
    // Vorschläge
    const box = el('div', { style: 'margin-top:10px' })
    const bar = el('div', { class: 'chips' },
      el('button', { onclick: () => { st.sugg = deriveSuggestions(catalog, st.mapping, r); drawSugg() }, title: t_('aus vorhandenen Werten ableiten (Regeln des Katalogs)') }, t_('⚙ Vorschläge (regelbasiert)')),
      el('button', { class: 'primary ai', title: t_('KI ({0}) schlägt Werte für die angehakten Knoten vor', [ai.label()]), onclick: async () => {
        if (!(await kiPruefen())) return
        const ids = st.picked.size ? [...st.picked] : r.nodes.filter(n => n.leaf && n.score != null && n.score < 100).slice(0, 10).map(n => n.row.id)
        if (!ids.length) { store.toast(t_('keine Knoten mit Lücken')); return }
        if (ids.length > 25 && !(await dialog.confirm({ title: t_('{0} Knoten an die KI schicken?', [ids.length]), warn: t_('{0} Anfragen an {1}', [ids.length, ai.label()]), ok: t_('✦ Schicken') }))) return
        const s = await aiSuggestions(catalog, st.mapping, r, ids, say); st.sugg = [...st.sugg.filter(x => x.source !== 'ai'), ...s]; say(t_('{0} KI-Vorschläge', [s.filter(x => !x.error).length])); drawSugg()
      } }, t_('✦ Vorschläge mit KI')),
      // Fremde Produkte (Handelsware): die Daten stehen beim Hersteller — die KI sucht im Internet, jeder Wert mit Quelle
      el('button', { class: 'primary ai', title: t_('KI ({0}) sucht im Internet nach Hersteller, Typ, EAN — Datenblätter, Kataloge; je Wert die Quelle. Kostet je Suche extra beim Anbieter', [ai.label()]), onclick: async () => {
        if (!(await kiPruefen())) return
        const ids = st.picked.size ? [...st.picked] : r.nodes.filter(n => n.leaf && n.score != null && n.score < 100).slice(0, 5).map(n => n.row.id)
        if (!ids.length) { store.toast(t_('keine Knoten mit Lücken')); return }
        if (ids.length > 10 && !(await dialog.confirm({ title: t_('{0} Knoten recherchieren?', [ids.length]), warn: t_('{0} Anfragen mit bis zu 6 Suchen an {1}', [ids.length, ai.label()]), ok: t_('✦ Recherchieren') }))) return
        const s = await aiSuggestions(catalog, st.mapping, r, ids, say, { web: true }); st.sugg = [...st.sugg.filter(x => x.source !== 'web'), ...s]; say(t_('{0} Vorschläge aus der Recherche', [s.filter(x => !x.error).length])); drawSugg()
      } }, t_('⌕ Recherche im Internet')),
      el('span', { class: 'muted', style: 'font-size:12px' }, st.picked.size ? t_('{0} Knoten angehakt', [st.picked.size]) : t_('ohne Haken: die ersten 10 mit Lücken')))
    box.append(bar); const list = el('div'); box.append(list); s3.append(box)
    function drawSugg() {
      list.innerHTML = ''
      if (!st.sugg.length) { list.append(el('div', { class: 'muted', style: 'font-size:12px;margin-top:4px' }, t_('keine Vorschläge'))); return }
      const t = el('table', { class: 'grid', style: 'width:100%;margin-top:6px' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:28px' }, ''), el('th', { style: 'width:260px' }, t_('Knoten')), el('th', { style: 'width:220px' }, t_('Datenpunkt')), el('th', { style: 'width:220px' }, t_('Vorschlag')), el('th', { style: 'width:50px' }, ''), el('th', {}, t_('Warum')))))
      const tb = el('tbody'); t.append(tb)
      const take = new Set(st.sugg.filter(s => !s.error && (s.confidence == null || s.confidence >= 0.7)))
      for (const s of st.sugg) {
        const cb = el('input', { type: 'checkbox' }); cb.checked = take.has(s); cb.disabled = !!s.error; cb.addEventListener('change', () => { cb.checked ? take.add(s) : take.delete(s) })
        const val = el('input', { type: 'text', value: s.value, style: 'width:100%' }); val.addEventListener('input', () => { s.value = val.value })
        tb.append(el('tr', { class: s.error ? 'neg' : '' }, el('td', {}, cb), el('td', {}, s.node.label), el('td', {}, s.item ? s.item.label : '—'), el('td', {}, s.error ? '' : val), el('td', { class: s.source === 'web' || s.source === 'ai' ? 'ai' : 'muted', style: 'font-size:11px' }, s.source === 'web' ? `⌕ ${s.confidence != null ? Math.round(s.confidence * 100) + ' %' : ''}` : s.source === 'ai' ? `✦ ${s.confidence != null ? Math.round(s.confidence * 100) + ' %' : ''}` : '⚙'), el('td', { class: 'muted', style: 'font-size:12px;white-space:normal' }, s.why, s.url ? el('a', { href: s.url, target: '_blank', style: 'margin-left:6px', title: s.url }, t_('↗ Quelle')) : null)))
      }
      list.append(t, el('div', { class: 'chips', style: 'margin-top:6px' }, el('button', { class: 'primary', onclick: async () => {
        const chosen = [...take]; if (!chosen.length) return
        const ok = await dialog.confirm({ title: t_('{0} Werte übernehmen?', [chosen.length]), warn: t_('{0} Attributwerte als ein Stapel ins Journal', [chosen.length]), list: chosen.slice(0, 8).map(s => `${s.node.label} · ${s.item.label} = ${s.value}`), ok: t_('Übernehmen') })
        if (!ok) return
        try { const res = await applySuggestions(chosen, st.mapping, r.locale); store.toast(t_('✓ {0} Werte geschrieben', [res?.results.length ?? 0])); await store.poll(true); await run() } catch (e) { store.toast(e.message) }
      } }, t_('💾 angehakte übernehmen')), el('span', { class: 'muted', style: 'font-size:12px' }, t_('Vorschläge ab 70 % Sicherheit sind vorangehakt — jeder Wert lässt sich vorher ändern; Quelle, Weg und Prüfdatum kommen als Beleg an den Wert (↗ in der Zelle)'))))
    }
    drawSugg()
  }
  drawMapping(); drawRun(); drawResult()
  // Der Zweck der Ansicht ist die Antwort auf „was fehlt zur Konformität?" — die Prüfung läuft darum
  // beim Öffnen automatisch, ohne Extra-Klick. Setup (Gruppe an Knoten, Attribute anlegen bei autoCreate) macht run() gleich mit.
  const _einger = await einrichten()
  if (_einger) run()
  else { body.innerHTML = ''; body.append(el('div', { class: 'empty', style: 'padding:24px' }, t_('Einrichtung abgebrochen — die Prüfung braucht die Attributgruppe {0} am obersten Knoten des Astes.', [catalog.groupKey]))) }
  // aus dem Knoten-Menue (?run=1): die URL aufraeumen
  if (new URLSearchParams(location.search).get('run') === '1') history.replaceState(null, '', location.pathname)
  return () => {}

  // Analyse (kein Schreiben): was fehlt, damit der Katalog am aktuellen Ast greift.
  // Rueckgabe: { wurzel, gruppeFehlt, fehlendeItems[], zuOrdnende[{item,attr}], haengtNicht, allesOk }
  //   fehlendeItems: das Modell-Attribut fehlt und wird neu angelegt
  //   zuOrdnende:   das Modell-Attribut existiert, ist aber nicht in der Katalog-Gruppe
  function analyseEinrichtung() {
    let wurzel = tree.byId.get(st.root)
    while (wurzel?.parent) wurzel = tree.byId.get(wurzel.parent) ?? wurzel
    if (!wurzel) return { allesOk: true }
    return { wurzel, ...einrichtungsBedarf(catalog, model, wurzel) }
  }

  async function einrichten() {
    const a = analyseEinrichtung()
    if (a.allesOk) return true
    // Titel und Knopf nach der grössten Wirkung: Anlegen > Zuordnen > Umwandeln > Ebenen > Anhängen
    const stufen = [
      [a.gruppeFehlt || a.fehlendeItems.length, t_('{0} einrichten für „{1}“', [catalog.label, a.wurzel.label]), t_('Einrichten')],
      [a.zuOrdnende.length && a.haengtNicht, t_('{0}: {1} Attribute der Gruppe zuordnen und an „{2}“ anhängen', [catalog.label, a.zuOrdnende.length, a.wurzel.label]), t_('Zuordnen und anhängen')],
      [a.zuOrdnende.length, t_('{0}: {1} Attribute der Gruppe {2} zuordnen', [catalog.label, a.zuOrdnende.length, catalog.groupKey]), t_('Zuordnen')],
      [a.umwandeln.length && !a.haengtNicht, t_('{0}: {1} Attribute in Vorlagen und Formeln umwandeln', [catalog.label, a.umwandeln.length]), t_('Umwandeln')],
      [a.nachziehen.length && !a.haengtNicht, t_('{0}: {1} Attribute auf ihre Ebenen beschränken', [catalog.label, a.nachziehen.length]), t_('Beschränken')],
      [true, t_('{0}: Gruppe an „{1}“ anhängen', [catalog.label, a.wurzel.label]), t_('Anhängen')],
    ]
    const [, titel, knopf] = stufen.find(s => s[0])
    const zeilen = []
    if (a.gruppeFehlt) zeilen.push(t_('Attributgruppe {0} anlegen', [catalog.groupKey]))
    if (a.fehlendeItems.length) zeilen.push(t_('{0} Attribute anlegen: {1}', [a.fehlendeItems.length, a.fehlendeItems.slice(0, 6).map(x => x.label).join(', ') + (a.fehlendeItems.length > 6 ? ', …' : '')]))
    if (a.zuOrdnende.length) zeilen.push(t_('{0} vorhandene Attribute der Gruppe {1} zuordnen (kein Kopieren): {2}', [a.zuOrdnende.length, catalog.groupKey, a.zuOrdnende.slice(0, 6).map(x => x.item.label).join(', ') + (a.zuOrdnende.length > 6 ? ', …' : '')]))
    if (a.umwandeln.length) zeilen.push(t_('{0} vorhandene Attribute in Vorlagen und Formeln umwandeln (vorhandene Werte bleiben erhalten): {1}', [a.umwandeln.length, a.umwandeln.slice(0, 6).map(x => x.item.label).join(', ') + (a.umwandeln.length > 6 ? ', …' : '')]))
    if (a.nachziehen.length) zeilen.push(t_('{0} vorhandene Attribute auf die Ebenen des Katalogs beschränken: {1}', [a.nachziehen.length, a.nachziehen.slice(0, 6).map(x => x.item.label).join(', ') + (a.nachziehen.length > 6 ? ', …' : '')]))
    if (a.haengtNicht) zeilen.push(t_('Gruppe {0} an „{1}“ anhängen', [catalog.groupKey, a.wurzel.label]))
    const ok = await dialog.confirm({ title: titel, warn: t_('Modellpflege — Auswirkung auf das Modell und den Baum'), list: zeilen, ok: knopf })
    if (!ok) return false
    try {
      if (a.fehlendeItems.length) { say(t_('lege {0} Attribute an …', [a.fehlendeItems.length])); await createAttributes(catalog, a.fehlendeItems, st.mapping); await remember() }
      // Zuordnen, Ebenen und Typ in einem Schreiben je Attribut (zwei Schreiben mit demselben alten Stand überschrieben sich)
      const aendern = new Map()
      for (const { attr } of a.zuOrdnende) aendern.set(attr.key, { attr, gruppe: true })
      for (const { attr, item } of a.nachziehen) aendern.set(attr.key, { ...aendern.get(attr.key), attr, ebenen: item.roles })
      for (const { attr, zu } of a.umwandeln) aendern.set(attr.key, { ...aendern.get(attr.key), attr, typ: zu })
      if (aendern.size) {
        say(t_('passe {0} Attribute an …', [aendern.size]))
        const nichtGeaendert = []; let grund = ''
        for (const { attr, gruppe, ebenen, typ } of aendern.values()) {
          const body = { ...attr }
          if (gruppe) body.groups = [...new Set([...gruppenVon(attr), catalog.groupKey])].sort()
          if (ebenen) body.levels = ebenen
          if (typ) body.type = typ
          const url = `/api/model/attributes/${encodeURIComponent(attr.key)}`
          try { await api.post(url, body, 'PUT') }
          catch (e) {
            if (!ebenen && !typ) throw e
            nichtGeaendert.push(attr.key); grund ||= e.message
            if (gruppe) { body.levels = attr.levels ?? null; body.type = attr.type; await api.post(url, body, 'PUT') }
          }
        }
        if (nichtGeaendert.length) store.toast(t_('Nicht geändert an {0} — {1}', [nichtGeaendert.join(', '), grund]))
      }
      if (a.haengtNicht) {
        const have = (a.wurzel.groups ?? '').split(',').map(s => s.trim()).filter(Boolean)
        if (!have.includes(catalog.groupKey)) { await api.post(`/api/nodes/${encodeURIComponent(a.wurzel.id)}/groups`, { groups: [...have, catalog.groupKey] }, 'PUT') }
      }
      await store.poll(true); await tree.load()
      say(t_('Eingerichtet.'))
      return true
    } catch (e) { store.toast(e.message); say('✗ ' + e.message); return false }
  }
}
