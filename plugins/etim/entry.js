// Plugin etim (Taloan, 19.09.2026: „wie sieht es mit Plugins aus wie ETIM Export beziehungsweise BMEcat“ — die Freigaben liegen frei
// unter etim.de/daten/downloads): ETIM-Klassifikation in journali. Eine Freigabe (IXF 3.1) wird im Browser gelesen, die Klassen,
// die man braucht, kommen als Datensätze ins Journal (class:<EC>, aufgelöst), die Klasse steht als Attribut am Produkt
// (Werteliste der übernommenen Klassen), je ETIM-Attribut ein Attribut (ef000040: Zahl mit Einheit, Ja/Nein, Werteliste mit
// EV-Codes, Bereich als Text) in der Attributgruppe ETIM — oder eine Zuordnung auf vorhandene Attribute. Prüfregeln in
// ✓ Datenqualität (Klasse unbekannt, Wert passt nicht zum ETIM-Attribut, Belegung), ETIM-Attribute für ‹› Vorlagen-Export (BMEcat).
// Umbau (Taloan, 22.09.2026, pflegestruktur.md 29): ETIM ist Klassifikation, kein Export — die Ansicht geht vom Knoten aus
// (Klasse → Attribute → Daten → Ausleitung), bearbeitet wird in der Subitems-Tabelle, nicht hier; die Zuordnung ETIM-Attribut → Attribut
// hat ƒ (Umwandlungskette); die Regeln der Ausleitung (unbekannt, Klasse Pflicht, Vollständigkeit) stehen im BMEcat-Profil (xport).
import { parseIxf, classRecord, nameOf, classText, featureText, featuresOf, checkNode, resolveValue, gate, mapEntry, throughSteps, audit } from './core.mjs'
import { OPS, FIELDS, FIELD_LABEL, FIELD_HINT, DATE_FORMATS, YES_DEFAULT, describe as describeSteps, opHint } from '../table/transform.mjs'

function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else if (k === 'disabled') { if (v) e.setAttribute(k, '') } else if (v != null && v !== false) e.setAttribute(k, v) } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : String(c)); return e }
const ICON = { group: '▣', product: '▦', variant: '◆' }
const SEV = { error: '✗', warn: '⚠', info: 'ℹ', ok: '✓' }
const TYPE = { Alphanumeric: 'Liste', Numeric: 'Zahl', Range: 'Bereich', Logical: 'Ja/Nein' }
const DEFAULTS = { classAttr: 'etim_class', unknownAs: 'UN', requireClass: false, group: 'etim' }
const groupKey = () => cache.settings.group || 'etim'

// Klassen und Einstellungen im Speicher — die Prüfregeln laufen synchron (Datenqualität) und brauchen sie ohne Nachschlagen
// Klassen je Version (Taloan, 20.09.: mehrere Versionen nebeneinander): class:<version>:<EC>; release:<version> die Freigabe dazu;
// release = die aktuelle Version (Zuweisen, Prüfen, Export). Alte Datensätze class:<EC> ohne Version zählen zur Version der damaligen Freigabe.
// Mit der ganzen Freigabe im Journal (5 640 Klassen, 17 000 ETIM-Attribute) heisst „übernommen“ nicht mehr „in Gebrauch“: Attribute, Zuordnung und
// Datenanalyse richten sich nach den Klassen, die im Baum zugewiesen sind (used); die Freigabe ist der Suchpool.
const cache = { classes: new Map(), settings: { ...DEFAULTS }, map: {}, mapping: {}, loaded: null, version: null, versions: [], used: new Set(), usedBy: new Map(), classOf: new Map() }   // classOf: Knoten → { code, own } (auch geerbt) — fürs Baummenü
async function loadUsed() {
  try {
    const key = cache.settings.classAttr; const rows = await (await fetch('/api/tree')).json(); const used = new Set(); const by = new Map(); const classOf = new Map()
    for (const r of rows.filter(r => !r.parent && r.role !== 'rubric')) { const t = await (await fetch(`/api/nodes/${encodeURIComponent(r.id)}/table?deep=true&attributes=${encodeURIComponent(key)}`)).json(); for (const row of t.rows ?? []) { const v = row.values?.[key]; const c = String(v?.value ?? '').trim().toUpperCase(); if (!c) continue; used.add(c); classOf.set(row.row.id, { code: c, own: !!v.own }); if (v.own) { if (!by.has(c)) by.set(c, []); by.get(c).push({ id: row.row.id, label: row.row.label, role: row.row.role }) } } }
    cache.used = used; cache.usedBy = by; cache.classOf = classOf
  } catch { }
}
/// Klassen in Gebrauch: die im Baum zugewiesenen; ohne Zuweisung und bei kleinem Bestand (von Hand übernommen) alle
const usedClasses = () => { const out = [...cache.used].map(c => cache.classes.get(c)).filter(Boolean); return out.length || cache.classes.size > 50 ? out : [...cache.classes.values()] }
const classKeyOf = code => `class:${cache.version ?? '0'}:${code}`
/// Attribut eines ETIM-Attributs: Zuordnung (map: Schlüssel oder { to, steps }), sonst die der Datenanalyse (mapping), sonst das eigene ef…
const attrKeyOf = code => { if (cache.map[code]) return mapEntry(cache.map, code).key; const m = cache.mapping?.[code.toLowerCase()]; return m?.to && !/ähnlich|vielleicht/.test(m.why ?? '') ? m.to : code.toLowerCase() }
const stepsOf = code => mapEntry(cache.map, code).steps
// dieselbe Auflösung wie attrKeyOf: Vermutungen der Datenanalyse („ähnlich“, „vielleicht“) zählen nicht — sonst prüft die Regel ein anderes Attribut, als die Zuordnung zeigt
const mergedMap = () => { const m = {}; for (const [k, v] of Object.entries(cache.mapping ?? {})) if (v?.to && !/ähnlich|vielleicht/.test(v.why ?? '')) m[k.toUpperCase()] = v.to; return { ...m, ...cache.map } }
/// wirksame Klasse an einem Knoten: eigen oder geerbt (vom nächsten Vorfahren mit Wert)
async function classAt(api, key, nodeId) {
  const node = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}`)
  const ownCode = String(node.values?.find(v => v.attribute === key && !v.locale && !v.channel && !v.row)?.value ?? '').trim().toUpperCase()
  let inherited = null
  if (!ownCode) for (const a of node.ancestors ?? []) { const v = a.values?.find(v => v.attribute === key && !v.locale && !v.channel)?.value; if (v) { inherited = { code: String(v).toUpperCase(), from: a.label, id: a.id }; break } }
  return { node, ownCode, inherited, current: ownCode || inherited?.code || null }
}
/// Subitems-Tabelle im eigenen Fenster mit genau den Spalten der Klasse (Taloan, 22.09.: „wir haben im Baum die Tabellenansicht, Excel“)
// Gruppe: alles darunter (tief); Produkt/Variante: die Geschwister unter dem Elternteil, die eigene Zeile ist dabei (Taloan, 22.09.:
// „Keine Varianten unter a“ — die Tabelle zeigt Kinder, also am Elternteil öffnen)
function openTable(tree, nodeId, keys, role) {
  const w = Math.min(1400, screen.availWidth - 80), h = Math.min(800, screen.availHeight - 80)
  const row = tree.byId.get(nodeId)
  const at = row && row.role !== 'group' && row.parent ? row.parent : nodeId
  const deep = !row || row.role === 'group'
  const r = deep ? role : row.role
  const path = `/table/${at}?popup=1${r ? '&role=' + r : ''}${deep ? '&deep=1' : ''}&attrs=${encodeURIComponent(keys.join(','))}`
  const win = window.open(path, 'journali-table', `popup=yes,width=${w},height=${h},left=${(screen.availWidth - w) / 2},top=${(screen.availHeight - h) / 2}`)
  if (win) win.focus(); else window.open(path.replace(/[?&]popup=1/, ''), '_blank')
}
async function loadCache() {
  try {
    const names = await (await fetch('/api/plugins/etim/data')).json()
    if (!Array.isArray(names)) return
    const get = async n => { const r = await fetch('/api/plugins/etim/data/' + encodeURIComponent(n)); return r.ok ? r.json() : null }
    cache.settings = { ...DEFAULTS, ...((await get('settings')) ?? {}) }; cache.map = (await get('map')) ?? {}; cache.mapping = (await get('mapping')) ?? {}
    const current = await get('release')
    cache.versions = []
    for (const n of names.filter(n => n.startsWith('release:'))) { const r = await get(n); if (r) cache.versions.push({ ...r, version: r.version ?? n.slice(8) }) }
    // Altbestand ohne Version: zählt zur Version der Freigabe, die damals gelesen wurde
    const legacy = names.filter(n => /^class:[^:]+$/.test(n))
    if (legacy.length && current && !cache.versions.some(v => v.version === String(current.number ?? '0'))) cache.versions.push({ ...current, version: String(current.number ?? '0'), legacy: true })
    cache.versions.sort((a, b) => parseFloat(b.version) - parseFloat(a.version))
    cache.version = current?.version ?? (current?.number != null ? String(current.number) : null) ?? cache.versions[0]?.version ?? null
    cache.classes = new Map()
    if (cache.version != null) {
      const all = await (await fetch(`/api/plugins/etim/data?values=true&prefix=${encodeURIComponent('class:' + cache.version + ':')}`)).json()
      for (const c of Object.values(all)) cache.classes.set(c.code, c)
      if (cache.versions.find(v => v.version === cache.version)?.legacy) { const old = await (await fetch('/api/plugins/etim/data?values=true&prefix=class%3A')).json(); for (const [n, c] of Object.entries(old)) if (/^class:[^:]+$/.test(n) && !cache.classes.has(c.code)) cache.classes.set(c.code, c) }
    }
    await loadUsed()
  } catch { }
}
cache.loaded = loadCache()
const cfg = locale => ({ ...cache.settings, map: mergedMap(), locale })

/// Modell anlegen: Gruppe ETIM, Klassenattribut (Werteliste der übernommenen Klassen), je ETIM-Attribut ein Attribut ef…
function modelOps(ctx) {
  const { api, store } = ctx
  const model = () => store.model
  const locale = model().masterLocale ?? 'de'
  const hasAttr = key => model().attributes.some(a => a.key === key)
  // Bezeichnung je Sprache des Modells; fehlt die Mastersprache (ETIM International: nur Englisch), steht dort der englische Name — sonst zeigt die Oberfläche den Schlüssel
  const labelsOf = names => { const out = {}; for (const l of model().locales.map(x => x.code)) if (names?.[l]) out[l] = names[l]; if (!out[locale]) out[locale] = nameOf(names, locale); return out }
  const put = (path, body) => api.post('/api/model' + path, body, 'PUT')
  // Die Gruppe gilt überall — die Klasse steht an der Gruppe („Mobile Geräte“) und erbt nach unten (Taloan, 22.09.: „verstehe ich nicht“ —
  // die Gruppe war erst ab product aktiv, damit liess sich die Klasse an keiner Gruppe setzen); die ETIM-Attribute selbst gibt es nur an
  // Produkt und Variante (levels), nicht an der Gruppe. Eine alte Gruppe mit activeFrom wird einmal repariert.
  async function ensureGroup() {
    const g = groupKey(); const have = (model().groups ?? []).find(x => x.key === g)
    if (!have) await put(`/groups/${g}`, { key: g, label: { de: g === 'etim' ? 'ETIM' : g, en: g === 'etim' ? 'ETIM' : g } })
    else if (have.activeFrom) await put(`/groups/${g}`, { ...have, activeFrom: null })
  }
  const FEATURE_LEVELS = ['product', 'variant']
  async function ensureClassAttr() {
    const key = cache.settings.classAttr
    await ensureGroup()   // Gruppe überall aktiv (repariert eine alte mit activeFrom) — sonst „etim_class gilt hier nicht“ an der Gruppe
    await ensureGroup()
    const existing = model().attributes.find(a => a.key === key)
    if (existing && !(existing.type === 'enum' && existing.list === key)) return key   // ein vorhandenes Text-/Listenattribut bleibt, wie es ist
    if (!(model().lists ?? []).some(l => l.key === key)) await put(`/lists/${key}`, { key, label: { de: 'ETIM-Klasse', en: 'ETIM class' }, columns: ['group'], closed: true })
    let rewrite = false
    if (!((model().lists ?? []).find(l => l.key === key)?.columns ?? []).includes('group')) { const l = (model().lists ?? []).find(x => x.key === key); if (l) { await put(`/lists/${key}`, { ...l, columns: [...(l.columns ?? []), 'group'] }); rewrite = true } }   // Gruppe nachtragen: alle Werte neu schreiben
    const have = rewrite ? new Set() : new Set((model().lists ?? []).find(l => l.key === key)?.values?.map(v => v.value) ?? [])
    // alle Klassen der Version als Listenwerte, ein Stapel (Taloan, 20.09.: „wo habe ich die Chance, die Klasse festzulegen?“ — in der Zelle am Produkt, mit Suche)
    const missing = [...cache.classes.values()].filter(c => !have.has(c.code)).sort((a, b) => a.code.localeCompare(b.code)).map(c => ({ value: c.code, label: Object.fromEntries(Object.entries(labelsOf(c.name)).map(([l, n]) => [l, `${n}`])), extra: c.group ? { group: nameOf(c.group.name, locale) || c.group.code } : null }))
    for (let k = 0; k < missing.length; k += 1000) await put(`/lists/${key}/values`, missing.slice(k, k + 1000))
    let i = 0
    if (!hasAttr(key)) await put(`/attributes/${key}`, { key, label: { de: 'ETIM-Klasse', en: 'ETIM class' }, type: 'enum', list: key, group: groupKey(), inheritable: true })
    else { const a = model().attributes.find(x => x.key === key); if (a.levels) await put(`/attributes/${key}`, { ...a, levels: null }) }   // die Klasse darf an jeder Ebene stehen
    for (const l of (model().lists ?? []).filter(l => (l.key === key || /^ef\d+$/.test(l.key)) && !l.closed)) await put(`/lists/${l.key}`, { ...l, closed: true })
    // ETIM-Attribute ohne Bedingung (aus früheren Läufen) bekommen sie nachgetragen — sonst gälten sie an jedem Knoten
    for (const a of model().attributes.filter(a => a.group === groupKey() && /^ef\d+$/.test(a.key) && !a.label?.[locale] && Object.keys(a.label ?? {}).length)) await put(`/attributes/${a.key}`, { ...a, label: { ...a.label, [locale]: nameOf(a.label, locale) } })
    for (const a of model().attributes.filter(a => a.group === groupKey() && /^ef\d+$/.test(a.key) && (!a.when || !a.inheritable))) { const w = a.when ?? { attribute: key, values: [...cache.classes.values()].filter(c => c.features.some(x => x.code === a.key.toUpperCase())).map(c => c.code) }; if (w.values.length) await put(`/attributes/${a.key}`, { ...a, when: w, inheritable: true }) }
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
  // ein ETIM-Attribut → Attribut ef… (Numeric: decimal + Einheit, Logical: boolean, Alphanumeric: enum mit Werteliste EV-Code → Name, Range: text mit Muster)
  // Bedingung: das ETIM-Attribut gilt nur an Knoten, deren Klasse es hat — alle Klassen der Version, die das ETIM-Attribut führen
  const whenOf = code => ({ attribute: cache.settings.classAttr, values: [...cache.classes.values()].filter(c => c.features.some(x => x.code === code)).map(c => c.code) })
  async function createFeature(f) {
    await ensureGroup()
    const key = f.code.toLowerCase()
    if (hasAttr(key)) { const a = model().attributes.find(x => x.key === key); const w = whenOf(f.code); if (a.group === groupKey() && (JSON.stringify(a.when?.values ?? []) !== JSON.stringify(w.values) || !a.inheritable || !a.levels)) await put(`/attributes/${key}`, { ...a, when: w, inheritable: true, levels: a.levels ?? FEATURE_LEVELS }); return key }
    const base = { key, label: labelsOf(f.name), group: groupKey(), when: whenOf(f.code), inheritable: true, levels: FEATURE_LEVELS }   // ETIM-Attribute nur an Produkt und Variante
    if (f.type === 'Numeric') await put(`/attributes/${key}`, { ...base, type: 'decimal', unit: await unitKeyFor(f.unit) })
    else if (f.type === 'Logical') await put(`/attributes/${key}`, { ...base, type: 'boolean' })
    else if (f.type === 'Range') await put(`/attributes/${key}`, { ...base, type: 'text', pattern: '^\\s*-?[\\d.,]+(\\s*(-|\\.\\.|…)\\s*-?[\\d.,]+)?\\s*$', patternHint: `von - bis${f.unit ? ' in ' + (nameOf(f.unit.abbr, locale) || f.unit.code) : ''}` })
    else {
      if (!(model().lists ?? []).some(l => l.key === key)) await put(`/lists/${key}`, { key, label: labelsOf(f.name), closed: true })   // EV-Werte sind Norm: geschlossen
      let i = 0; for (const v of f.values) await put(`/lists/${key}/values/${v.code}`, { value: v.code, label: labelsOf(v.name), order: i++ })
      await put(`/attributes/${key}`, { ...base, type: 'enum', list: key })
    }
    if (cache.map[f.code] && cache.map[f.code] !== key) delete cache.map[f.code]
    return key
  }
  return { ensureGroup, ensureClassAttr, createFeature, hasAttr }
}
/// Alle ETIM-Attribute der übernommenen Klassen, je Code einmal (Werte vereinigt), mit den Klassen, in denen es vorkommt
function allFeatures() {
  const feats = new Map()
  for (const c of usedClasses()) for (const f of c.features) { if (!feats.has(f.code)) feats.set(f.code, { ...f, values: [...f.values], classes: [c] }); else { const have = feats.get(f.code); have.classes.push(c); for (const v of f.values) if (!have.values.some(x => x.code === v.code)) have.values.push(v) } }
  return feats
}

/// Katalog für die Datenanalyse (ctx.compliance, wie DPP/PPWR — Taloan, 20.09.: „was ich beim Export brauche, vorher analysieren und
/// vervollständigen“): Datenpunkte = Klasse + alle ETIM-Attribute der übernommenen Klassen; ein ETIM-Attribut gilt an einem Knoten nur, wenn
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
    to: ops.hasAttr(attrKeyOf(f.code)) ? attrKeyOf(f.code) : '',   // fest: das ETIM-Attribut (oder die Zuordnung aus 4) — nie nach Namen raten
    hint: `${f.code} · ${f.type}${f.type === 'Range' ? ' (von - bis)' : ''} · in ${f.classes.length} Klasse${f.classes.length === 1 ? '' : 'n'}: ${f.classes.slice(0, 3).map(c => c.code).join(', ')}${f.classes.length > 3 ? ' …' : ''}`,
    appliesIf: (r, mapping) => { const c = classOf(r, mapping); return !!c && c.features.some(x => x.code === f.code) },
    rule: v => resolveValue(f, v) === null ? `passt nicht zu ${f.type}${f.type === 'Alphanumeric' ? ' — erlaubt: ' + f.values.slice(0, 5).map(x => nameOf(x.name, locale)).join(', ') + (f.values.length > 5 ? ' …' : '') : ''}` : null,
    feature: f,
  }))
  const n = cache.classes.size
  return {
    key: 'etim', label: 'ETIM-Attribute', icon: '⌗', source: 'https://etim.de/daten/downloads/', sourceLabel: 'etim.de ↗',
    autoCreate: true,   // Attribute der ETIM-Attribute und die Gruppe entstehen beim Prüfen von selbst — der Anwender wählt die Klasse und füllt (Taloan, 20.09.)
    description: n ? `${n} Klasse${n === 1 ? '' : 'n'} übernommen (⇪ Export → ⌗ ETIM) mit ${feats.length} ETIM-Attributen. Ein ETIM-Attribut zählt an einem Knoten nur, wenn seine Klasse es hat; Knoten ohne Klasse bleiben aussen vor. Fehlende Attribute legt der Katalog als ef… mit Werteliste und Einheit an.` : 'Noch keine Klasse übernommen — erst unter ⇪ Export → ⌗ ETIM eine Freigabe lesen und Klassen übernehmen.',
    groupKey: groupKey(), groupLabel: groupKey() === 'etim' ? 'ETIM' : groupKey(), prefix: '',
    groups: [
      { key: 'class', label: 'Klasse', items: [{ key: classKey, label: 'ETIM-Klasse', level: 'must', type: 'enum', to: ops.hasAttr(classKey) ? classKey : '', synonyms: ['etim', 'etim_class', 'etim klasse', 'etim class'], values: [...cache.classes.values()].map(c => `${c.code} ${nameOf(c.name, locale)}`), hint: 'EC-Code der Klasse — ohne Klasse gilt kein ETIM-Attribut; die KI schlägt eine der übernommenen Klassen vor', rule: v => cache.classes.has(String(v).trim().toUpperCase()) ? null : `Klasse ${v} nicht übernommen` }] },
      { key: 'features', label: 'ETIM-Attribute', items },
    ],
    createAttribute: async it => it.key === classKey ? ops.ensureClassAttr() : it.feature ? ops.createFeature(it.feature) : null,
    // Erster Schritt je Knoten (Taloan, 20.09.): die Klasse sagt, welche ETIM-Attribute erforderlich sind — ohne Klasse steht hier „zuweisen“
    rowNote: (n, mapping, c) => {
      const key = mapping?.[classKey]?.to || classKey; const code = String(n.raw?.[key] ?? '').trim().toUpperCase(); const cls = cache.classes.get(code)
      if (cls) return `${code} · ${cls.features.length} ETIM-Attribute`
      if (n.states[classKey] === 'inactive') return ''   // Gruppe fehlt — der ⊘-Knopf oben löst es
      if (n.leaf || n.row.role !== 'group') { const b = document.createElement('button'); b.className = 'x'; b.textContent = '⌗ Klasse zuweisen …'; b.title = 'ETIM-Klasse für diesen Knoten wählen — sie bestimmt die erforderlichen ETIM-Attribute'; b.addEventListener('click', () => classDialog(n.row.id, c)); return b }
      return ''
    },
    // ohne Klasse: das Wesentliche zuerst — der Knopf zum Dialog, bei einem Knoten direkt dafür
    summary: (r, mapping, c) => { const noClass = r.nodes.filter(n => n.leaf && n.states[classKey] === 'empty'); if (!noClass.length) return null; const b = document.createElement('button'); b.className = 'primary'; b.textContent = '⌗ Klasse zuweisen …'; b.addEventListener('click', () => classDialog(noClass.length === 1 ? noClass[0].row.id : r.nodes[0].row.id, c)); const w = document.createElement('span'); w.append(`⌗ ${noClass.length} Knoten ohne ETIM-Klasse — sie bestimmt die ETIM-Attribute `, b); return w },
  }
}

/// ETIM-Attribute eines Knotens für xport (env.featuresOf) — pctx ist der Produktkontext von xport
/// rules (BMEcat-Profil, Taloan 22.09.): { unknownAs, requireClass, minCompleteness, strict } — überschreiben die Voreinstellung
export async function etimFeatures(pctx, rules = null) { await cache.loaded; return featuresOf(pctx, { ...cfg(pctx.locale), ...(rules ?? {}), version: cache.version, getClass: async code => cache.classes.get(code) ?? null }) }

/// Sperre für xport: ein Knoten, der die Analyse nicht besteht, wird nicht exportiert
export async function etimGate(pctx, rules = null) { await cache.loaded; return gate(pctx, { ...cfg(pctx.locale), ...(rules ?? {}), version: cache.version, getClass: async code => cache.classes.get(code) ?? null }) }

/// Prüfregeln für ✓ Datenqualität

// ── Der Assistent am Knoten (Taloan, 20.09.: „Knoten → ETIM-Klasse vorhanden? ja/nein → Dialog mit Auswahl aus den ETIM-Katalogen,
// sonst Download“). Ein Fenster, drei Fälle: keine Bibliothek → holen; Klasse da → zeigen, ändern; keine → wählen (✦ Vorschlag,
// Umfeld, Suche, Gruppen). ⇢ schreibt die Klasse (Gruppe kommt automatisch), danach die Prüfung mit den ETIM-Attributen der Klasse.
async function classDialog(nodeId, ctx, onDone = null) {
  const { api, store, tree } = ctx
  await cache.loaded; if (!tree.loaded) await tree.load()
  const model = () => store.model
  const locale = model().masterLocale ?? 'de'
  const row = tree.byId.get(nodeId); if (!row) return
  const ops = modelOps(ctx)
  const path = tree.ancestors(nodeId).map(a => a.label)
  const key = cache.settings.classAttr
  const gname = c => c.group ? (nameOf(c.group.name, locale) || c.group.code) : '—'
  const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:40' })
  const box = el('div', { style: 'width:min(820px,94vw);max-height:88vh;display:flex;flex-direction:column;background:var(--pane);border:1px solid var(--line);border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.4);font-size:13px' })
  const head = el('div', { class: 'toolbar', style: 'padding:8px 12px' }, el('b', {}, `⌗ ETIM-Klasse · ${ICON[row.role] ?? ''} ${row.label}`), el('span', { class: 'muted', style: 'font-size:12px' }, path.join(' › ')), el('span', { class: 'grow' }), el('button', { class: 'x', title: 'schliessen (Esc)', onclick: () => close() }, '✕'))
  const body = el('div', { class: 'scroll', style: 'padding:8px 12px;flex:1' })
  const status = el('span', { class: 'muted', style: 'font-size:12px' })
  const foot = el('div', { class: 'toolbar', style: 'padding:6px 12px;border-top:1px solid var(--line)' }, status)
  box.append(head, body, foot); overlay.append(box); document.body.append(overlay)
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close() } }
  document.addEventListener('keydown', onKey, true)
  overlay.addEventListener('mousedown', e => { if (e.target === overlay) close() })
  function close() { overlay.remove(); document.removeEventListener('keydown', onKey, true) }
  const say = m => status.textContent = m
  let busy = false
  const run = async (label, fn) => { if (busy) return; busy = true; say(label); try { await fn() } catch (e) { say('✗ ' + e.message); store.toast(e.message) } finally { busy = false } }

  // wirksame Klasse am Knoten (eigen oder geerbt)
  const { ownCode, inherited, current } = await classAt(api, key, nodeId)

  // Schritt 2 (Taloan, 20.09.: „lade die Attribute der Klasse → zuweisen ja/nein → fertig“): zeigen, was passiert, dann tun, dann fertig
  async function levels(code) {
    const chain = [...tree.ancestors(nodeId), row]   // Wurzel … hier
    const top = chain[0]
    let vals = new Map()
    try { const t = await api.get(`/api/nodes/${encodeURIComponent(top.id)}/table?deep=true&attributes=${encodeURIComponent(key)}`); for (const r of t.rows ?? []) vals.set(r.row.id, String(r.values?.[key]?.value ?? '').toUpperCase()) } catch { }
    const under = id => { const out = []; const walk = x => { for (const k of tree.kids(x)) { if (k.role !== 'group') out.push(k); walk(k.id) } }; walk(id); return out }   // Produkte und Varianten — Klassen können an beiden stehen
    const subgroups = id => tree.kids(id).filter(k => k.role === 'group').length
    const out = chain.map(n => { const ns = n.role === 'group' ? under(n.id) : [n, ...under(n.id)]; const other = ns.filter(p => { const v = vals.get(p.id); return v && v !== code }).length; const same = ns.filter(p => vals.get(p.id) === code).length; return { node: n, products: ns.filter(x => x.role === 'product').length || ns.length, other, same, groups: n.role === 'group' ? subgroups(n.id) : 0 } })
    // Empfehlung (Taloan, 20.09.): eine Klasse gilt für eine Sorte Produkt — also die höchste Ebene, die nur Produkte enthält (keine Untergruppen)
    // und keinen Widerspruch hat; eine Gruppe mit Untergruppen (Wurzel, „Hardware“) ist fast immer zu grob
    let rec = out.length - 1; for (let i = 0; i < out.length; i++) if (out[i].other === 0 && out[i].products > 0 && out[i].groups === 0) { rec = i; break }
    return { out, rec }
  }
  async function assign(code) {
    const c = cache.classes.get(code); if (!c) return
    const missing = c.features.filter(f => !ops.hasAttr(attrKeyOf(f.code)))
    body.innerHTML = ''; say('rechne Ebenen …')
    const { out, rec } = await levels(code); say('')
    let target = out[rec].node
    const lvBtns = out.map((l, i) => el('button', { class: l.node.id === target.id ? 'primary' : '', title: `${l.products} Produkt${l.products === 1 ? '' : 'e'} darunter${l.other ? ` · ${l.other} mit anderer Klasse` : ''}${l.same ? ` · ${l.same} schon ${code}` : ''}${i === rec ? ' · Empfehlung' : ''}`, onclick: () => { target = l.node; lvBtns.forEach((b, k) => b.className = k === i ? 'primary' : ''); lvNote.textContent = noteOf(l, i) } }, `${ICON[l.node.role] ?? ''} ${l.node.id === nodeId ? 'hier' : l.node.label} `, el('span', { class: l.other ? 'neg' : l.groups ? 'warn' : 'muted', style: 'font-size:11px' }, `${l.products}${l.groups ? ` · ${l.groups} ▣` : ''}${l.other ? ` · ${l.other} ≠` : ''}`)))
    const noteOf = (l, i) => l.other ? `⚠ ${l.other} Produkte darunter haben schon eine andere Klasse — ab hier wäre die Klasse zu grob; granularer setzen (weiter rechts).` : l.groups ? `⚠ ${l.groups} Untergruppen mit ${l.products} Produkten darunter — eine Klasse für alle? Meist zu grob: an den Produktgruppen setzen${i < out.length - 1 ? ' (weiter rechts)' : ' — dort Rechtsklick → ETIM prüfen'}.` : l.products > 1 ? `gilt für ${l.products} Produkte darunter (vererbbar)${i === rec ? ' — Empfehlung: die höchste Ebene ohne Untergruppen und ohne Widerspruch' : ''}` : l.products === 1 ? 'gilt für dieses eine Produkt' : 'keine Produkte darunter — die Klasse gilt, sobald welche kommen'
    const lvNote = el('div', { class: 'muted', style: 'font-size:12px;margin:2px 0 8px' }, noteOf(out[rec], rec))
    body.append(el('div', { style: 'font-size:14px;margin:6px 0' }, el('b', {}, `${code} ${nameOf(c.name, locale)}`), ` → ${ICON[row.role] ?? ''} ${row.label}`),
      el('div', { class: 'muted', style: 'margin-bottom:8px' }, `${c.features.length} ETIM-Attribute der Klasse gelten dann ${row.role === 'group' ? 'an allen Produkten darunter (die Klasse steht an der Gruppe und erbt)' : 'an diesem Knoten'}${missing.length ? ` — ${missing.length} davon werden als Attribute angelegt (Gruppe ${groupKey()}, nur an Produkt und Variante)` : ''}.`),
      el('div', { class: 'scroll', style: 'max-height:40vh;border:1px solid var(--line);border-radius:4px;padding:4px 8px;font-size:12px' }, ...c.features.map(f => el('div', {}, el('span', { class: 'mono muted' }, f.code), ' ', featureText(f, locale), el('span', { class: 'muted' }, ` · ${TYPE[f.type] ?? f.type}${ops.hasAttr(attrKeyOf(f.code)) ? '' : ' · neu'}`)))),
      el('div', { style: 'margin-top:10px' }, el('div', { class: 'muted', style: 'font-size:12px' }, 'Gilt ab (Pfad von der Wurzel bis hier — Zahl: Produkte darunter · ▣ Untergruppen · ≠ mit anderer Klasse):'), el('div', { class: 'chips', style: 'margin:4px 0' }, ...lvBtns), lvNote),
      el('div', { class: 'chips', style: 'margin-top:6px' }, el('button', { class: 'primary', onclick: () => doAssign(code, target.id) }, '✓ zuweisen'), el('button', { onclick: () => draw() }, 'zurück')))
  }
  async function doAssign(code, atId = nodeId) {
    const c = cache.classes.get(code); const at = tree.byId.get(atId) ?? row
    await run(`weise ${code} zu …`, async () => {
      const k = await ops.ensureClassAttr(); await store.poll(true)
      // Gruppe an die Wurzel des Pflegebaums — mit Bedingungen an den ETIM-Attributen stört sie nirgends
      const root = (() => { let x = row; while (x.parent && tree.byId.get(x.parent)) x = tree.byId.get(x.parent); return x })()
      const have = (root.groups ?? '').split(',').filter(Boolean)
      if (!have.includes(groupKey())) await api.post(`/api/nodes/${encodeURIComponent(root.id)}/groups`, { groups: [...have, groupKey()] }, 'PUT')
      await api.post(`/api/nodes/${encodeURIComponent(atId)}/attributes`, { attribute: k, locale: null, channel: null, value: code, row: null })
      cache.used.add(code); if (atId !== nodeId) store.toast(`✓ ${code} ab ${at.label}`, 'ok')
      loadUsed()   // Klassen je Knoten für Baummenü und Band
      let n = 0
      for (const f of c.features) { if (!ops.hasAttr(attrKeyOf(f.code))) { say(`lege an ${++n}: ${featureText(f, locale)} …`); await ops.createFeature(f); await store.poll(true) } else await ops.createFeature(f) }
      await store.poll(true); await tree.load()
      say('')
      checkStep(code)
    })
  }

  // Schritt 3 (Taloan, 22.09.: „grenzwertig — wir haben im Baum die Tabellenansicht, Excel“): keine eigene Tabelle mehr — nach dem Zuweisen
  // geht es in die ETIM-Übersicht des Knotens (Klasse → Attribute → Daten → Ausleitung); bearbeitet wird in der Subitems-Tabelle
  function checkStep(code) { close(); onDone ? onDone(code) : ctx.go?.(`/tree/${encodeURIComponent(nodeId)}`) }
  const line = (code, why) => { const c = cache.classes.get(code); return el('div', { class: 'pick', style: 'display:flex;gap:8px;align-items:center' }, el('span', { class: 'mono muted' }, code), el('span', { class: 'grow' }, c ? nameOf(c.name, locale) : el('i', { class: 'muted' }, 'nicht in der Bibliothek'), el('span', { class: 'muted', style: 'font-size:11px' }, why ? ' · ' + why : ''), c ? el('span', { class: 'muted', style: 'font-size:11px' }, ` · ${c.features.length} ETIM-Attribute`) : null), c && code !== current ? el('button', { class: 'primary', onclick: () => assign(code) }, '⇢ zuweisen') : null) }

  // Version im Dialog wechseln (Taloan, 22.09.: „wer sagt, dass ich nicht schnell die ETIM-Version wechseln will“): die Auswahl gilt
  // ab sofort für Zuweisen, Prüfen und Export (release im Journal) — die Liste der Klassen darunter wird neu gelesen
  function versionBar() {
    if (cache.versions.length < 2 && cache.version) return el('span', { class: 'muted', style: 'font-size:12px' }, `ETIM ${cache.version} · ${cache.classes.size} Klassen`)
    const sel = el('select', { title: 'ETIM-Version — gilt für Zuweisen, Prüfen und Export', onchange: async e => {
      const v = cache.versions.find(x => x.version === e.target.value); if (!v) return
      say(`wechsle auf ETIM ${v.version} …`)
      try { await ctx.data.set('release', v); await loadCache(); await ops.ensureClassAttr(); await store.poll(true); say(''); draw() } catch (err) { say('✗ ' + err.message) }
    } }, ...cache.versions.map(v => el('option', { value: v.version }, `ETIM ${v.version}${v.name ? ' · ' + v.name : ''} · ${v.classes ?? '?'} Klassen`)))
    sel.value = cache.version ?? ''
    return el('span', { style: 'display:inline-flex;gap:6px;align-items:center' }, el('span', { class: 'muted', style: 'font-size:12px' }, 'Version'), sel,
      el('button', { class: 'x', title: 'Versionen verwalten: holen, Datei lesen, wechseln (⌗ ETIM)', onclick: () => { close(); ctx.go?.('/p/etim/etim') } }, '⌗ ETIM …'))
  }
  function draw() {
    body.innerHTML = ''
    const P = [...cache.classes.values()]
    // Fall 1: keine Bibliothek
    if (!P.length) {
      body.append(el('div', { class: 'empty' }, 'Keine ETIM-Version im Journal.'),
        el('div', { class: 'chips' }, el('button', { class: 'primary', onclick: () => run('hole Liste …', async () => {
          const r = await api.post('/api/plugins/etim/run', { params: { mode: 'list', url: '', langs: '' } }); const j = jsonOfOut(r.output); const best = j?.releases?.[0]; if (!best) throw new Error('keine Liste von etim-international.com')
          const h0 = (await api.get('/api/health')).head; const t0 = Date.now()
          const tick = setInterval(async () => { try { const h = (await api.get('/api/health')).head; say(`lade ${best.name} … ${h - h0} Klassen · ${Math.round((Date.now() - t0) / 1000)} s`) } catch { } }, 2000)
          try { const r2 = await api.post('/api/plugins/etim/run', { params: { mode: 'load', url: best.url, langs: model().locales.map(l => l.code).join(',') } }); const j2 = jsonOfOut(r2.output); if (!j2?.classes) throw new Error((r2.output ?? '').slice(-300)) } finally { clearInterval(tick) }
          await loadCache(); await store.poll(true); await ops.ensureClassAttr(); await store.poll(true); say(''); draw()
        }) }, '⇩ ETIM (neueste, alle Sektoren) holen'), el('span', { class: 'muted' }, 'von etim-international.com — öffentlich, englische Namen; oder ⇪ Export → ⌗ ETIM: Datei')))
      return
    }
    body.append(el('div', { class: 'chips', style: 'margin-bottom:8px' }, versionBar()))
    // Stand
    body.append(current
      ? el('div', { style: 'margin-bottom:10px;padding:8px 10px;border:1px solid var(--pos);border-radius:6px;background:var(--accent-soft)' },
          el('div', { style: 'display:flex;gap:10px;align-items:baseline;flex-wrap:wrap' }, el('span', { class: 'pos', style: 'font-weight:600' }, '✓ Klasse'), el('span', { class: 'mono', style: 'font-size:16px;font-weight:600' }, current), el('span', { style: 'font-size:16px' }, nameOf(cache.classes.get(current)?.name, locale) || ''), el('span', { class: 'muted' }, ownCode ? '· an diesem Knoten' : `· geerbt von ${inherited.from}`), el('span', { class: 'muted' }, `· ${cache.classes.get(current)?.features.length ?? '?'} ETIM-Attribute`)),
          el('div', { class: 'chips', style: 'margin-top:6px' },
            el('button', { class: 'primary', title: 'zum Knoten — das Band ⌗ ETIM zeigt Klasse, Attribute, Daten, Ausleitung', onclick: () => checkStep(current) }, '→ zum Knoten'), el('button', { style: 'display:none', onclick: () => run('bereite vor …', async () => { const c = cache.classes.get(current); for (const f of c.features) await ops.createFeature(f); await store.poll(true); await checkStep(current) }) }, '✓ ETIM-Attribute prüfen und füllen'),
            el('button', { onclick: () => { close(); ctx.go?.(`/tree/${nodeId}`) } }, `${ICON[row.role] ?? ''} Werte am Knoten`),
            el('span', { class: 'muted', style: 'font-size:12px' }, 'andere Klasse: unten wählen')))
      : el('div', { style: 'margin-bottom:8px;padding:8px 10px;border:1px solid var(--warn);border-radius:6px' }, el('span', { class: 'warn', style: 'font-weight:600' }, 'Noch keine Klasse'), el('span', { class: 'muted' }, ' — unten wählen: Vorschlag, Umfeld, Suche oder Gruppen')))
    if (current) body.append(el('div', { class: 'step-band', style: 'margin:4px 0' }, 'Andere Klasse wählen'))
    if (row.parent && tree.byId.get(row.parent)?.role === 'group' && tree.kids(row.parent).length > 1)
      body.append(el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:6px' }, `Tipp: die Klasse an ${ICON.group} ${tree.byId.get(row.parent).label} gilt für alle ${tree.kids(row.parent).length} darunter (vererbbar) — `, el('a', { href: '#', onclick: e => { e.preventDefault(); close(); classDialog(row.parent, ctx) } }, 'dort wählen')))
    // ✦ Vorschlag (KI, wenn da)
    const ai = ctx.ai; const suggest = el('div', { style: 'margin:4px 0' })
    if (ai?.available()) {
      suggest.append(el('span', { class: 'muted' }, '✦ …'))
      ;(async () => {
        try {
          const groupsAll = [...new Set(P.map(gname))].sort()
          const g = await ai.ask({ system: 'Du ordnest Produkte ETIM-Klassengruppen zu. Antworte nur als JSON {"groups":["…","…"]} mit 1 bis 3 Namen exakt aus der Liste.', user: `Produkt: ${row.label}\nPfad: ${path.join(' › ')}\nGruppen:\n${groupsAll.join('\n')}`, json: true, maxTokens: 200 })
          const picked = (g.groups ?? []).filter(x => groupsAll.includes(x)); if (!picked.length) throw new Error('keine Gruppe erkannt')
          const cands = P.filter(c => picked.includes(gname(c)))
          const list = cands.map(c => `${c.code} ${nameOf(c.name, locale)}${Object.values(c.synonyms ?? {}).flat().length ? ' (' + Object.values(c.synonyms ?? {}).flat().slice(0, 4).join(', ') + ')' : ''}`).join('\n')
          const j = await ai.ask({ system: 'Du ordnest ein Produkt genau einer ETIM-Klasse zu. Antworte nur als JSON {"suggestions":[{"code":"EC…","why":"…"}]} mit 1 bis 3 Vorschlägen, Codes exakt aus der Liste, bester zuerst, why in einem kurzen Satz auf Deutsch.', user: `Produkt: ${row.label}\nPfad: ${path.join(' › ')}\nKlassen:\n${list}`, json: true, maxTokens: 400 })
          suggest.innerHTML = ''; suggest.append(el('div', { class: 'muted', style: 'font-size:12px' }, `✦ Vorschlag (KI, ${ai.label()}) — ${picked.join(', ')}`))
          const out = (j.suggestions ?? []).filter(s => cands.some(c => c.code === String(s.code).toUpperCase()))
          if (!out.length) suggest.append(el('div', { class: 'muted' }, 'kein Vorschlag'))
          for (const s of out) suggest.append(line(String(s.code).toUpperCase(), s.why ?? ''))
        } catch (e) { suggest.innerHTML = ''; suggest.append(el('span', { class: 'neg' }, '✗ ' + e.message)) }
      })()
    } else suggest.append(el('div', { class: 'muted', style: 'font-size:12px' }, '✦ Vorschläge aus Name und Pfad brauchen einen KI-Schlüssel (⚙ Einstellungen)'))
    body.append(suggest)
    // Umfeld: Klassen an Geschwistern und darunter
    const env = el('div', { class: 'muted', style: 'font-size:12px;margin:4px 0' }, 'Umfeld …'); body.append(env)
    ;(async () => {
      try {
        const counts = new Map(); const add = (c, why) => { if (!c) return; const k = String(c).toUpperCase(); if (!counts.has(k)) counts.set(k, new Map()); counts.get(k).set(why, (counts.get(k).get(why) ?? 0) + 1) }
        if (row.parent) { const t = await api.get(`/api/nodes/${encodeURIComponent(row.parent)}/table?attributes=${key}`); for (const r of t.rows) if (r.row.id !== row.id) add(r.values[key]?.value, 'Geschwister') }
        const below = await api.get(`/api/nodes/${encodeURIComponent(row.id)}/table?deep=true&attributes=${key}`); for (const r of below.rows) add(r.values[key]?.value, 'darunter')
        env.innerHTML = ''
        if (!counts.size) { env.textContent = 'Umfeld: keine Klasse an Geschwistern oder darunter'; return }
        env.append(el('div', {}, 'Umfeld'))
        for (const [c, whys] of [...counts].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0))) env.append(line(c, [...whys].map(([w, n]) => `${w} × ${n}`).join(', ')))
      } catch (e) { env.textContent = 'Umfeld: ' + e.message }
    })()
    // Suche und Gruppen
    const hits = el('div'); let grp = null
    const q = el('input', { placeholder: `suchen in ${P.length} Klassen — Code, Name, Synonym`, style: 'width:100%;margin:6px 0', oninput: () => search() })
    const groupsOf = () => { const m = new Map(); for (const c of P) { const g = gname(c); if (!m.has(g)) m.set(g, []); m.get(g).push(c) } return [...m].sort((a, b) => a[0].localeCompare(b[0], 'de')) }
    const browse = () => {
      hits.innerHTML = ''
      if (grp) { hits.append(el('div', { class: 'pick', style: 'font-weight:600', onclick: () => { grp = null; browse() } }, `‹ ${grp}`)); for (const c of (groupsOf().find(([g]) => g === grp)?.[1] ?? []).sort((a, b) => nameOf(a.name, locale).localeCompare(nameOf(b.name, locale)))) hits.append(line(c.code, '')); return }
      const wrap = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:2px 12px' })
      for (const [g, cs] of groupsOf()) wrap.append(el('div', { class: 'pick', style: 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis', title: g, onclick: () => { grp = g; browse() } }, `▸ ${g} `, el('span', { class: 'muted' }, String(cs.length))))
      hits.append(wrap)
    }
    const search = () => {
      const s = q.value.trim().toLowerCase(); if (s.length < 2) { browse(); return }
      hits.innerHTML = ''
      const found = P.filter(c => c.code.toLowerCase().includes(s) || Object.values(c.name).some(n => n.toLowerCase().includes(s)) || Object.values(c.synonyms ?? {}).some(l => l.some(n => n.toLowerCase().includes(s)))).slice(0, 40)
      for (const c of found) hits.append(line(c.code, gname(c)))
      if (!found.length) hits.append(el('div', { class: 'muted', style: 'padding:4px' }, 'nichts gefunden'))
    }
    body.append(q, hits); browse()
    setTimeout(() => q.focus(), 0)
  }
  draw()
}
const jsonOfOut = out => { for (const line of String(out ?? '').split('\n')) { const s = line.trim(); if (s.startsWith('{')) { try { return JSON.parse(s) } catch { } } } return null }

const checks = [
  { key: 'etim', label: '⌗ ETIM: Klasse und ETIM-Attribute', severity: 'warn', run({ values, columns, locale }) { return checkNode({ values, columns, classes: cache.classes, cfg: cfg(locale) }) } },
]

// ── Das Band ⌗ ETIM in der Knotenansicht (Taloan, 22.09.: „die Bedienung erfolgt beim Gegenstand“): eine Zeile — Klasse (eigen/geerbt,
// ≠ abweichende darunter) · Attribute n von m (zugeordnet, ƒ, fehlend) · Daten % gefüllt (leer, passen nicht) — und die Knöpfe, die
// ins vorhandene Werkzeug springen: Zuweisen-Dialog, Zuordnung (auf die Klasse gefiltert), Subitems-Tabelle mit den Spalten der Klasse,
// Prüfung (Befunde im Körper). Gilt an Gruppe, Produkt, Variante; die Zahlen zählen den Knoten und alles darunter mit dieser Klasse.
async function stageData(ctx, nodeId, locale = 'de') {
  const { api, tree } = ctx; const ops = modelOps(ctx); const hasAttr = ops.hasAttr
  const key = cache.settings.classAttr; const row = tree.byId.get(nodeId); if (!row) return null
  const at = hasAttr(key) ? await classAt(api, key, nodeId) : { ownCode: '', inherited: null, current: null, node: null }
  const groupOn = (at.node?.groups ?? []).some(g => g.key === groupKey() && g.active !== false)   // gilt die Gruppe hier? (Taloan, 22.09.: Gruppe entfernt → Sackgasse)
  const cls = at.current ? cache.classes.get(at.current) ?? null : null
  const stage = { row, ...at, groupOn, cls, feats: [], products: [], other: 0, filled: 0, cells: 0, bad: 0, empty: 0, keys: [], tbl: null, byClass: [] }
  if (!cls) return stage
  // Merkmale der Klasse am Knoten und aller Klassen im Teilbaum (Taloan, 22.09.: Prozent je Klasse am obersten Knoten mit ETIM)
  const featsOf = c => c.features.map(f => { const k = attrKeyOf(f.code); return { f, key: k, has: hasAttr(k), own: k === f.code.toLowerCase(), steps: stepsOf(f.code) } })
  stage.feats = featsOf(cls)
  // 1. welche Klassen kommen darunter vor? 2. dann eine Tabelle mit den Attributen aller dieser Klassen
  const seen = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}/table?deep=true&attributes=${encodeURIComponent(key)}`)
  const codes = new Set([at.current, ...(seen.rows ?? []).map(r => String(r.values?.[key]?.value ?? '').toUpperCase()).filter(c => /^EC\d{6}$/.test(c))])
  const featsByCode = new Map(); for (const c of codes) { const cc = cache.classes.get(c); if (cc) featsByCode.set(c, featsOf(cc)) }
  const keys = [...new Set([key, ...[...featsByCode.values()].flat().filter(x => x.has).map(x => x.key)])]
  const q = `attributes=${encodeURIComponent(keys.join(','))}`
  const tbl = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}/table?deep=true&${q}`)
  let rows = (tbl.rows ?? []).filter(r => r.row.role !== 'group')
  if (row.role !== 'group') { const me = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}/table?self=true&${q}`).catch(() => null); const mine = me?.rows?.find(r => r.row.id === nodeId); if (mine) rows = [mine, ...rows.filter(r => r.row.id !== nodeId)] }
  stage.other = rows.filter(r => { const v = String(r.values?.[key]?.value ?? '').toUpperCase(); return v && v !== at.current }).length
  stage.products = rows.filter(r => String(r.values?.[key]?.value ?? '').toUpperCase() === at.current)
  // Zahlen und Befunde aus einer Rechnung (core: audit) — die Tabelle je Klasse und die Liste der Befunde belegen dieselben Zahlen
  const a = audit({ rows, classAttr: key, classes: cache.classes, map: mergedMap(), locale, hasAttr, complete: true })   // jeder Knoten eine Zeile, auch die vollständigen (Taloan, 22.09.)
  stage.byClass = a.byClass; stage.sum = a.sum; stage.findings = a.findings
  const mine = a.byClass.find(c => c.code === at.current)
  if (mine) { stage.filled = mine.filled; stage.cells = mine.cells; stage.bad = mine.bad; stage.empty = mine.cells - mine.filled - mine.bad }
  stage.keys = keys; stage.tbl = tbl
  return stage
}
async function bandMount({ head, body: bodyEl }, nodeId, ctx) {
  // head: kurzer Text in der Überschrift (wie „Redaktion: Freigegeben“); line: die Zeile mit Chips und Knöpfen im Körper; darunter die Befunde
  const line = el('div', { class: 'row' }); const table = el('div'); const found = el('div'); bodyEl.append(line, table, found)
  const { store, tree } = ctx
  await cache.loaded; if (!tree.loaded) await tree.load()
  const locale = store.model?.masterLocale ?? 'de'; const ops = modelOps(ctx)
  let gone = false
  const chip = (text, cls = '', title = '') => el('span', { class: 'chip ' + cls, title }, text)
  async function render() {
    if (gone) return
    head.textContent = ''; line.innerHTML = ''; table.innerHTML = ''; found.innerHTML = ''
    if (!cache.classes.size) { head.textContent = '· keine ETIM-Version im Journal'; line.append(el('button', { class: 'x', onclick: () => ctx.go?.('/p/etim/etim') }, '⇩ ETIM holen …')); return }
    head.textContent = '· …'
    let S; try { S = await stageData(ctx, nodeId, locale) } catch (e) { head.textContent = '· ✗ ' + e.message; return }
    if (gone || !S) return
    head.textContent = ''
    const again = () => render()
    const assignBtn = el('button', { class: S.cls ? 'x' : 'primary', title: S.cls ? 'andere Klasse wählen (Vorschlag, Umfeld, Suche, Ebene)' : 'ETIM-Klasse wählen (Vorschlag, Umfeld, Suche, Ebene mit Empfehlung)', onclick: () => classDialog(nodeId, ctx, again) }, S.cls ? '⌗ Klasse ändern …' : '⌗ Klasse zuweisen …')
    // Klasse entfernen (Taloan, 22.09.: „ich kann die Klasse an keiner Stelle wieder entfernen“) — nur die eigene; danach gilt die geerbte oder keine
    const clearBtn = S.ownCode ? el('button', { class: 'x', title: 'Klasse an diesem Knoten entfernen — danach gilt die geerbte Klasse, sonst keine', onclick: async () => {
      const ok = await (ctx.dialog?.confirm?.({ title: `ETIM-Klasse ${S.ownCode} entfernen?`, text: S.inherited ? `Danach gilt wieder ${S.inherited.code} von ${S.inherited.from}.` : 'Danach hat dieser Knoten keine Klasse.', ok: 'entfernen', danger: true }) ?? Promise.resolve(true))
      if (!ok) return
      try { await api.post(`/api/nodes/${encodeURIComponent(nodeId)}/attributes`, { attribute: cache.settings.classAttr, locale: null, channel: null, value: '', row: null }); await store.poll(true); loadUsed(); store.toast('✓ Klasse entfernt', 'ok'); again() } catch (e) { store.toast(e.message) }
    } }, '✕ Klasse') : null
    // Gruppe anhängen, wenn sie hier nicht gilt — sonst ist kein ETIM-Attribut verfügbar und man kommt nicht weiter
    const attachBtnEl = !S.groupOn ? el('button', { class: 'primary', title: `die Attributgruppe ${groupKey()} an diesem Knoten anhängen — erst dann gelten die ETIM-Attribute hier und darunter`, onclick: async () => {
      try { const have = (S.row.groups ?? '').split(',').filter(Boolean); await api.post(`/api/nodes/${encodeURIComponent(nodeId)}/groups`, { groups: [...new Set([...have, groupKey()])] }, 'PUT'); await store.poll(true); await tree.load?.(); store.toast(`✓ Gruppe ${groupKey()} hängt jetzt hier`, 'ok'); again() } catch (e) { store.toast(e.message) }
    } }, `⌗ Gruppe ${groupKey()} anhängen`) : null
    if (!S.cls) { head.textContent = '· ' + (S.current ? `${S.current} nicht in ETIM ${cache.version ?? '?'}` : 'keine Klasse'); line.append(...[el('span', { class: 'muted' }, S.current ? `${S.current} nicht in ETIM ${cache.version ?? '?'}` : 'keine Klasse — weder hier noch darüber'), assignBtn, clearBtn, attachBtnEl].filter(Boolean)); return }
    const code = S.current
    line.append(chip(`${code} ${nameOf(S.cls.name, locale)}`, '', S.ownCode ? 'Klasse am Knoten selbst' : `Klasse geerbt von ${S.inherited.from}`), el('span', { class: 'muted' }, S.ownCode ? 'hier' : `von ${S.inherited.from}`))
    if (S.other) line.append(chip(`≠ ${S.other}`, 'warn', `${S.other} darunter mit anderer Klasse`))
    const has = S.feats.filter(x => x.has), miss = S.feats.filter(x => !x.has), mapped = has.filter(x => !x.own), fx = S.feats.filter(x => x.steps)
    line.append(el('span', { class: 'muted' }, '·'), chip(`zugeordnet ${has.length}/${S.feats.length}`, miss.length ? 'warn' : 'pos', `${has.length - mapped.length} eigene ef… · ${mapped.length} zugeordnet${fx.length ? ` · ${fx.length} mit ƒ` : ''}${miss.length ? ` · ${miss.length} nicht zugeordnet` : ''}`))
    const pct = S.cells ? Math.round(S.filled * 100 / S.cells) : 0
    head.textContent = `· ${code} ${nameOf(S.cls.name, locale)}${S.ownCode ? '' : ' (geerbt)'} · zugeordnet ${has.length}/${S.feats.length} · Daten ${S.products.length ? pct + ' %' : '—'}${S.ownCode && S.byClass.length > 1 ? ` · Teilbaum ${String(S.sum.pct).replace('.', ',')} %` : ''}${S.other ? ` · ≠ ${S.other}` : ''}`
    line.append(el('span', { class: 'muted' }, '·'), chip(S.products.length ? `Daten ${pct} %` : 'Daten —', S.bad ? 'neg' : pct >= 80 ? 'pos' : '', `${S.products.length} Produkte/Varianten × ${has.length} ETIM-Attribute: ${S.filled} gefüllt · ${S.empty} leer${S.bad ? ` · ${S.bad} passen nicht` : ''}`))
    // Knöpfe direkt hinter den Chips, nicht rechtsbündig (Taloan, 22.09.: der Bereich ist so breit wie die Attributtabelle — „prüfen“ stand hinter dem Rollbalken)
    if (!S.groupOn) line.append(chip(`⚠ Gruppe ${groupKey()} gilt hier nicht`, 'warn', `die Attributgruppe ${groupKey()} hängt an keinem Knoten des Pfads — deshalb gilt kein ETIM-Attribut an diesem Knoten; „Gruppe anhängen“ behebt es`))
    line.append(...[el('span', { class: 'muted' }, '·'), assignBtn, clearBtn, attachBtnEl,
      el('button', { class: miss.length ? 'primary' : 'x', title: 'Zuordnung der ETIM-Attribute dieser Klasse: vorhandenes Attribut, ƒ Umwandlung, oder eigenes anlegen (⌗ ETIM)', onclick: () => ctx.go?.(`/p/etim/etim?class=${code}&node=${encodeURIComponent(nodeId)}`) }, '⇄ zuordnen …'),
      miss.length ? el('button', { class: 'x', title: `${miss.length} fehlende ETIM-Attribute als eigene Attribute ef… anlegen (Gruppe ${groupKey()}, nur an Produkt und Variante)`, onclick: async () => { try { await ops.ensureClassAttr(); for (const x of miss) await ops.createFeature(x.f); await store.poll(true); store.toast(`✓ ${miss.length} Attribute angelegt`, 'ok'); again() } catch (e) { store.toast(e.message) } } }, `＋ ${miss.length} anlegen`) : null,
      S.products.length ? el('button', { class: 'x', title: 'Subitems-Tabelle im eigenen Fenster — nur die Spalten dieser Klasse; Bedienung wie Excel', onclick: () => openTable(tree, nodeId, S.keys, S.products.some(r => r.row.role === 'product') ? 'product' : 'variant') }, '⊞ Tabelle') : null,
    ].filter(Boolean))
    // Befunde je Knoten — immer sichtbar, mit Sprungziel in der letzten Spalte
    const jump = x => x.go === 'map'
      ? el('button', { class: 'x', title: `zur Zuordnung — ${x.attribute} markiert`, onclick: () => ctx.go?.(`/p/etim/etim?class=${code}&node=${encodeURIComponent(nodeId)}&ef=${x.attribute}`) }, '⇄')
      : el('button', { class: 'x', title: `zum Knoten ${x.node.label}, Gruppe ${groupKey()}`, onclick: () => ctx.go?.(`/tree/${x.node.id}?group=${encodeURIComponent(groupKey())}`) }, '↗')
    const barOf = p => el('span', { style: 'display:inline-flex;align-items:center;gap:8px' }, `${p.filled} von ${p.total} gefüllt`, el('span', { style: 'display:inline-block;width:120px;height:8px;border:1px solid var(--line);border-radius:4px;overflow:hidden;background:var(--bg)' }, el('span', { style: `display:block;height:100%;width:${p.pct}%;background:${p.pct >= 80 ? 'var(--pos)' : 'var(--accent)'}` })), `${String(p.pct).replace('.', ',')} %`)
    found.append(S.findings.length
      ? el('table', { class: 'grid', style: 'width:100%;margin-top:6px' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:30px' }, ''), el('th', { style: 'width:260px' }, 'Knoten'), el('th', { style: 'width:110px' }, 'Feld'), el('th', {}, 'Befund'), el('th', { style: 'width:36px' }, ''))),
          el('tbody', {}, ...S.findings.slice(0, 500).map(x => el('tr', {}, el('td', { class: x.severity === 'error' ? 'neg' : x.severity === 'warn' ? 'warn' : x.severity === 'ok' ? 'pos' : 'muted' }, SEV[x.severity] ?? ''),
            el('td', {}, el('a', { href: `/tree/${x.node.id}`, onclick: e => { e.preventDefault(); ctx.go?.(`/tree/${x.node.id}`) } }, `${ICON[x.node.role] ?? ''} ${x.node.label}`)),
            el('td', { class: 'mono muted', title: x.label ?? '' }, x.attribute ?? ''), el('td', { title: x.title ?? '' }, x.progress ? barOf(x.progress) : x.message), el('td', {}, jump(x))))))
      : el('div', { class: 'muted', style: 'padding:4px 0' }, `✓ keine Befunde in ${S.sum.nodes} Knoten`))
    // Körper (Taloan, 22.09.: „da stand doch eben noch eine saubere Auflistung“): Kennzahl je Klasse — am Knoten, an dem die Klasse
    // gesetzt ist (nicht bis ganz nach oben) — und darunter immer die Befunde je Knoten; kein Knopf, nichts verschwindet
    if (S.ownCode && S.byClass.length) {
      const bar = p => el('span', { style: 'display:inline-block;width:120px;height:8px;border:1px solid var(--line);border-radius:4px;overflow:hidden;background:var(--bg);vertical-align:middle' }, el('span', { style: `display:block;height:100%;width:${p}%;background:${p >= 80 ? 'var(--pos)' : 'var(--accent)'}` }))
      const tb = el('tbody')
      for (const c of S.byClass) tb.append(el('tr', {}, el('td', { class: 'mono' }, c.code), el('td', { title: `${c.nodes} Knoten mit dieser Klasse darunter` }, nameOf(cache.classes.get(c.code)?.name, locale) || ''), el('td', { class: 'num muted' }, String(c.nodes)),
        el('td', { class: 'num' }, `${c.filled} von ${c.cells}`), el('td', {}, bar(c.pct)), el('td', { class: 'num' }, `${String(c.pct).replace('.', ',')} %`), el('td', { class: c.bad ? 'neg' : 'muted' }, c.bad ? `✗ ${c.bad}` : '')))
      if (S.byClass.length > 1) tb.append(el('tr', {}, el('td', {}), el('td', { class: 'muted' }, 'Teilbaum'), el('td', { class: 'num muted' }, String(S.sum.nodes)), el('td', { class: 'num muted' }, `${S.sum.filled} von ${S.sum.cells}`), el('td', {}, bar(S.sum.pct)), el('td', { class: 'num' }, `${String(S.sum.pct).replace('.', ',')} %`), el('td', {})))
      table.append(el('table', { class: 'grid', style: 'width:auto;min-width:520px;margin-top:4px' },
        el('thead', {}, el('tr', {}, el('th', { style: 'width:90px' }, 'Klasse'), el('th', {}, 'Name'), el('th', { style: 'width:50px' }, 'Knoten'), el('th', { style: 'width:110px' }, 'gefüllt'), el('th', { style: 'width:130px' }, ''), el('th', { style: 'width:60px' }, '%'), el('th', { style: 'width:50px' }, ''))), tb))
    }
  }
  render()
  return () => { gone = true }
}

async function mount(root, ctx) {
  const { api, store, tree } = ctx
  if (!tree.loaded) await tree.load()
  await cache.loaded
  const model = () => store.model
  const locale = model().masterLocale ?? 'de'
  const params = new URLSearchParams(location.search); const assignParam = params.get('assign'); const classParam = params.get('class'); const backNode = params.get('node'); const efParam = (params.get('ef') ?? '').toUpperCase(); if (assignParam || classParam) history.replaceState(null, '', location.pathname)
  const st = { assign: null, rel: null, q: '', hits: [], root: localStorage.getItem('journali.etim.root') || tree.rows.find(r => !r.parent)?.id, result: null, busy: false, mapFilter: classParam && cache.classes.has(classParam.toUpperCase()) ? classParam.toUpperCase() : null, backNode: backNode && tree.byId.has(backNode) ? backNode : null }
  if (assignParam && tree.byId.has(assignParam)) setTimeout(() => classDialog(assignParam, ctx), 0)
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  const body = el('div', { class: 'scroll', style: 'flex:1;padding:0 8px 8px' })
  const attrs = () => model().attributes.filter(a => a.type !== 'rows')
  const lbl = a => a.label?.[locale] || a.label?.de || a.key
  const ops = modelOps(ctx); const hasAttr = ops.hasAttr
  const saveSettings = () => ctx.data.set('settings', cache.settings)
  const saveMap = async () => { await ctx.data.set('map', cache.map); store.toast('✓ Zuordnung gespeichert — gilt sofort für Prüfung und Export', 'ok') }   // jede Änderung sofort (Taloan, 22.09.: „muss ich speichern?“)
  const section = (title, hint, ...kids) => el('div', { class: 'section', style: 'margin-top:10px' }, el('div', { class: 'step-band' }, title, hint ? el('span', { class: 'muted' }, ' · ' + hint) : null), ...kids)
  const busy = async (label, fn) => { if (st.busy) return; st.busy = true; say(label); try { await fn() } catch (e) { say('✗ ' + e.message); store.toast(e.message) } finally { st.busy = false } }

  // ── Freigabe: IXF-Datei lesen (bleibt im Speicher — nur übernommene Klassen gehen ins Journal)
  const file = el('input', { type: 'file', accept: '.xml,.ixf', style: 'display:none' })
  file.addEventListener('change', async () => {
    const f = file.files?.[0]; if (!f) return
    await busy(`lese ${f.name} (${(f.size / 1048576).toFixed(1)} MB) …`, async () => {
      const t0 = performance.now(); const text = await f.text(); st.rel = parseIxf(text)
      const h = st.rel.header
      say(`${h.name ?? 'ETIM'} Nr. ${h.number ?? '?'} · ${st.rel.classes.length} Klassen · ${st.rel.features.size} ETIM-Attribute · ${st.rel.values.size} Werte · ${Math.round(performance.now() - t0)} ms`)
      st.relInfo = { name: h.name, number: h.number, date: h.date, exportDate: h.exportDate, classes: st.rel.classes.length, features: st.rel.features.size, languages: [...new Set(st.rel.classes.slice(0, 50).flatMap(c => Object.keys(c.name)))], file: f.name, at: new Date().toISOString() }
      draw()
    })
    file.value = ''
  })
  // Kontext beim Zuweisen (Taloan, 20.09.: „ich weiss hier gar nicht mehr, um welches Produkt es ging … kein best guess, gar nix“):
  // Pfad des Knotens, die Klasse, die dort schon gilt, das Umfeld (Klassen an Geschwistern und darunter, mit Zahl), Treffer über die
  // Namen am Pfad — und die KI, wenn ein Schlüssel da ist. Jeder Vorschlag hat sein ⇢ zuweisen.
  function assignBox(row, P) {
    const key = cache.settings.classAttr
    const path = tree.ancestors(row.id).map(a => a.label)
    const current = ((tree.byId.get(row.id)?.values ?? {})[key]) ?? null
    const byCode = c => cache.classes.get(c) ?? P.find(x => x.code === c) ?? null
    const line = (code, why) => { const c = byCode(code); return el('div', { class: 'pick', style: 'display:flex;gap:8px;align-items:center' }, el('span', { class: 'mono muted' }, code), el('span', { class: 'grow' }, c ? nameOf(c.name, locale) : el('i', { class: 'muted' }, 'nicht übernommen und nicht in der Freigabe'), el('span', { class: 'muted', style: 'font-size:11px' }, ' · ' + why)), c ? assignBtn(code) : null) }
    // Umfeld: Klassen an Geschwistern, an Kindern, am Pfad darüber — aus dem Baum (Tabelle liefert die Werte je Knoten)
    const env = el('div', { class: 'muted', style: 'font-size:12px;padding:2px 0' }, 'Umfeld …')
    ;(async () => {
      try {
        const counts = new Map(); const add = (c, why) => { if (!c) return; const k = c.toUpperCase(); if (!counts.has(k)) counts.set(k, new Map()); counts.get(k).set(why, (counts.get(k).get(why) ?? 0) + 1) }
        const parent = row.parent ? tree.byId.get(row.parent) : null
        if (parent) { const t = await api.get(`/api/nodes/${encodeURIComponent(parent.id)}/table?attributes=${key}`); for (const r of t.rows) if (r.row.id !== row.id) add(r.values[key]?.value, 'Geschwister') }
        const below = await api.get(`/api/nodes/${encodeURIComponent(row.id)}/table?deep=true&attributes=${key}`); for (const r of below.rows) add(r.values[key]?.value, 'darunter')
        for (const a of tree.ancestors(row.id)) { const v = (a.values ?? {})[key]; if (v) add(v, 'am Pfad: ' + a.label) }
        env.innerHTML = ''
        if (!counts.size) { env.append('Umfeld: keine Klasse an Geschwistern, darunter oder am Pfad'); return }
        env.append(el('div', { class: 'muted' }, 'Umfeld'))
        for (const [c, whys] of [...counts].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0))) env.append(line(c, [...whys].map(([w, n]) => `${w} × ${n}`).join(', ')))
      } catch (e) { env.textContent = 'Umfeld: ' + e.message }
    })()
    // Namen: Wörter aus dem Namen und dem Pfad gegen Klassennamen und Synonyme
    // Wörter: eigener Name und der direkte Vater zählen doppelt, ganze Wörter mehr als Teile — sonst trifft „mobile“ jedes Telefon
    const wordsOf = s => String(s ?? '').split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 4).map(w => w.toLowerCase())
    const near = new Set([...wordsOf(row.label), ...wordsOf(path[path.length - 1])]); const words = [...near]
    const nameHits = P.map(c => { const names = [...Object.values(c.name ?? {}), ...Object.values(c.synonyms ?? {}).flat()].map(n => String(n).toLowerCase()); let score = 0; for (const w of words) if (names.some(n => new RegExp(`(^|[^\p{L}])${w}([^\p{L}]|$)`, 'u').test(n))) score++; return { c, score } }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 8)
    const ai = ctx.ai; const suggest = el('div', { style: 'margin-top:4px' })
    const gname = c => c.group ? (nameOf(c.group.name, locale) || c.group.code) : '—'
    const askAi = async () => {
      suggest.innerHTML = ''; suggest.append(el('span', { class: 'muted' }, '✦ …'))
      try {
        const groupsAll = [...new Set(P.map(gname))].sort()
        const g = await ai.ask({ system: 'Du ordnest Produkte ETIM-Klassengruppen zu. Antworte nur als JSON {"groups":["…","…"]} mit 1 bis 3 Namen exakt aus der Liste.', user: `Produkt: ${row.label}\nPfad: ${path.join(' › ')}\nGruppen:\n${groupsAll.join('\n')}`, json: true, maxTokens: 200 })
        const picked = (g.groups ?? []).filter(x => groupsAll.includes(x)); if (!picked.length) throw new Error('keine Gruppe erkannt')
        const cands = P.filter(c => picked.includes(gname(c)))
        const list = cands.map(c => `${c.code} ${nameOf(c.name, locale)}${Object.values(c.synonyms ?? {}).flat().length ? ' (' + Object.values(c.synonyms ?? {}).flat().slice(0, 4).join(', ') + ')' : ''}`).join('\n')
        const j = await ai.ask({ system: 'Du ordnest ein Produkt genau einer ETIM-Klasse zu. Antworte nur als JSON {"suggestions":[{"code":"EC…","why":"…"}]} mit 1 bis 3 Vorschlägen, Codes exakt aus der Liste, bester zuerst, why in einem kurzen Satz auf Deutsch.', user: `Produkt: ${row.label}\nPfad: ${path.join(' › ')}\nKlassen:\n${list}`, json: true, maxTokens: 400 })
        suggest.innerHTML = ''; suggest.append(el('div', { class: 'muted', style: 'font-size:12px' }, `✦ Vorschlag (KI, ${ai.label()}) — Gruppe${picked.length > 1 ? 'n' : ''} ${picked.join(', ')}`))
        const out = (j.suggestions ?? []).filter(s => cands.some(c => c.code === String(s.code).toUpperCase()))
        if (!out.length) suggest.append(el('div', { class: 'muted' }, 'kein Vorschlag — unten blättern'))
        for (const s of out) suggest.append(line(String(s.code).toUpperCase(), s.why ?? ''))
      } catch (e) { suggest.innerHTML = ''; suggest.append(el('span', { class: 'neg' }, '✗ ' + e.message)) }
    }
    if (ai?.available()) { if (P.length) askAi(); else suggest.append(el('span', { class: 'muted' }, 'erst eine ETIM-Version holen')) }
    else suggest.append(el('div', { class: 'muted', style: 'font-size:12px' }, '✦ Vorschläge aus Name und Pfad brauchen einen KI-Schlüssel (⚙ Einstellungen) — ohne: unten blättern oder suchen'))
    const names = el('div', {}, el('div', { class: 'muted', style: 'font-size:12px' }, nameHits.length ? `Namenstreffer für ${words.map(w => '„' + w + '“').join(', ')}` : P.length ? `keine Klasse heisst wie ${words.map(w => '„' + w + '“').join(', ')} — unten suchen (ETIM International: englische Namen)` : 'erst eine ETIM-Version holen'), ...nameHits.map(x => line(x.c.code, `${x.score} Wort${x.score > 1 ? 'e' : ''}`)))
    return el('div', { style: 'padding:6px 0;border:1px solid var(--accent);border-radius:6px;padding:8px;margin:6px 0' },
      el('div', { class: 'chips' }, el('b', {}, `Klasse zuweisen an ${ICON[row.role] ?? ''} ${row.label}`), el('span', { class: 'muted', style: 'font-size:12px' }, path.length ? path.join(' › ') : ''), el('span', { class: 'grow' }), el('button', { class: 'x', title: 'ohne Zuweisung weiter', onclick: () => { st.assign = null; draw() } }, '✕')),
      current ? line(current, 'gilt hier schon') : el('div', { class: 'muted', style: 'font-size:12px' }, 'hier gilt noch keine Klasse', row.parent && tree.byId.get(row.parent)?.role === 'group' && tree.kids(row.parent).length > 1 ? el('span', {}, ' — ', el('a', { href: '#', onclick: e => { e.preventDefault(); st.assign = row.parent; draw() } }, `an ${ICON.group} ${tree.byId.get(row.parent).label} zuweisen`), ` gilt für alle ${tree.kids(row.parent).length} darunter (vererbbar)`) : null),
      env, names, suggest)
  }
  // Klasse einem Knoten zuweisen (Taloan, 20.09.: „muss der Anwender nicht irgendwo definieren, zu welcher Klasse ein Produkt gehört?“):
  // Wert im Klassenattribut (vererbbar — an der Gruppe gesetzt gilt es für alles darunter); fehlt die Gruppe ETIM am Pfad, kommt sie an den Knoten
  async function assignClass(nodeId, code) {
    const row = tree.byId.get(nodeId); if (!row) return
    if (!cache.classes.has(code)) { const cls = st.rel?.classes.find(x => x.code === code); if (!cls) { store.toast(`Klasse ${code} nicht übernommen`); return } await takeClass(cls, true) }
    await busy(`weise ${code} zu …`, async () => {
      cache.used.add(code)
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
    const rec = classRecord(st.rel, cls, model().locales.map(l => l.code)); await ensureVersion(); await ctx.data.set(classKeyOf(rec.code), rec); cache.classes.set(rec.code, rec)
    if (!silent) say(`${classText(rec, locale)} übernommen · ${rec.features.length} ETIM-Attribute`)
  }
  // Die ganze Freigabe ins Journal (Taloan, 20.09.: „warum nicht gegrabbt und lokal gespeichert?“): je Klasse ein Datensatz class:<EC>,
  // nur in den Sprachen des Modells, in Stapeln zu 400 — danach geht Suche, Zuweisen und Prüfen ohne die Datei
  // Version der gelesenen Datei als Freigabe eintragen und zur aktuellen machen, wenn keine da ist; Namen anderer Sprachen derselben Version bleiben (Datei von etim.de ergänzt die englische)
  async function ensureVersion() {
    const h = st.rel.header; const ver = String(h.number ?? '0')
    if (!cache.versions.some(v => v.version === ver)) { const info = { version: ver, name: h.name, number: h.number, date: h.date, exportDate: h.exportDate, classes: st.rel.classes.length, features: st.rel.features.size, file: st.relInfo?.file, at: new Date().toISOString() }; await ctx.data.set('release:' + ver, info); cache.versions.unshift(info) }
    if (cache.version == null) { cache.version = ver; await ctx.data.set('release', { ...cache.versions.find(v => v.version === ver) }) }
    if (cache.version !== ver) { cache.version = ver; await ctx.data.set('release', { ...cache.versions.find(v => v.version === ver) }); await loadCache() }
  }
  const merge = (a, b) => !a ? b : { ...b, name: { ...(a.name ?? {}), ...(b.name ?? {}) }, synonyms: { ...(a.synonyms ?? {}), ...(b.synonyms ?? {}) }, features: b.features.map(f => { const o = a.features?.find(x => x.code === f.code); return o ? { ...f, name: { ...(o.name ?? {}), ...(f.name ?? {}) }, values: f.values.map(v => ({ ...v, name: { ...(o.values?.find(x => x.code === v.code)?.name ?? {}), ...(v.name ?? {}) } })) } : f }) }
  async function takeAll() {
    if (!st.rel) return
    const langs = model().locales.map(l => l.code); const all = st.rel.classes; const CH = 400
    await busy(`übernehme ${all.length} Klassen …`, async () => {
      await ensureVersion()
      for (let i = 0; i < all.length; i += CH) {
        const chunk = all.slice(i, i + CH); const items = {}
        for (const cls of chunk) { const rec = merge(cache.classes.get(cls.code), classRecord(st.rel, cls, langs)); items[classKeyOf(rec.code)] = rec; cache.classes.set(rec.code, rec) }
        await api.post('/api/plugins/etim/data', items, 'PUT'); say(`${Math.min(i + CH, all.length)} / ${all.length} Klassen übernommen …`)
      }
      const v = cache.versions.find(x => x.version === cache.version); if (v) { v.all = true; v.classes = all.length; v.languages = [...new Set([...(v.languages ?? []), ...Object.keys(all[0]?.name ?? {})])]; await ctx.data.set('release:' + v.version, v); if (cache.version === v.version) await ctx.data.set('release', v) }
      await store.poll(true); await ops.ensureClassAttr(); await store.poll(true)
      say(`${all.length} Klassen im Journal — Suche und Zuweisen gehen jetzt ohne die Datei`); draw()
    })
  }
  // Klassen, in denen gesucht wird: die gelesene Freigabe, sonst die übernommenen (als Datensätze gleich aufgebaut)
  const pool = () => st.rel ? st.rel.classes : [...cache.classes.values()]
  async function classesFromTree() {
    if (!pool().length) { store.toast('erst eine ETIM-Version holen'); return }
    const key = cache.settings.classAttr; if (!hasAttr(key)) { store.toast(`Attribut ${key} gibt es nicht`); return }
    await busy('suche Klassen im Baum …', async () => {
      const codes = new Set()
      for (const r of tree.rows.filter(r => !r.parent)) { const t = await api.get(`/api/nodes/${encodeURIComponent(r.id)}/table?deep=true&attributes=${key}`); for (const row of t.rows) { const c = String(row.values[key]?.value ?? '').trim().toUpperCase(); if (/^EC\d{6}$/.test(c)) codes.add(c) } }
      let n = 0, miss = 0
      for (const c of codes) { if (cache.classes.has(c)) continue; const cls = st.rel?.classes.find(x => x.code === c); if (cls) { await takeClass(cls, true); n++ } else miss++ }
      say(`${codes.size} Klassen im Baum · ${n} neu übernommen${miss ? ` · ${miss} nicht in Version ${cache.version}` : ''}`); draw()
    })
  }

  // ── Attribute anlegen (modelOps): Klassenattribut, je ETIM-Attribut ein Attribut in der Gruppe ETIM
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
      st.result = { findings, nodes: t.rows.length }; say(`${findings.length} Befunde in ${t.rows.length} Knoten`); draw()
    })
  }

  // ── ƒ an der Zuordnung (Taloan, 22.09.): Kette wie im Datenmapper — Probe zeigt, was am ETIM-Attribut ankommt
  function stepsDialog(f) {
    const cur = cache.map[f.code]; const to = typeof cur === 'string' ? cur : cur?.to ?? ''
    const steps = JSON.parse(JSON.stringify(stepsOf(f.code) ?? []))
    const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:41' })
    const box = el('div', { style: 'width:min(720px,94vw);max-height:80vh;display:flex;flex-direction:column;background:var(--pane);border:1px solid var(--line);border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.4);font-size:13px' })
    const list = el('div', { style: 'display:flex;flex-direction:column;gap:6px' })
    const probe = el('input', { placeholder: 'Probe: ein Wert, wie er im Attribut steht', style: 'width:100%' })
    const out = el('div', { class: 'muted', style: 'font-size:12px;min-height:18px' })
    // auch die leere Probe zeigt, was die Kette macht (Taloan, 22.09.: „leer → 0“ mit Bedingung) — nur ohne Kette gibt es nichts zu zeigen
    const show = () => { const v = probe.value; if (!v && !steps.length) { out.textContent = ''; return } const t = throughSteps(steps.length ? steps : null, v); const r = resolveValue(f, t); out.innerHTML = ''; out.append(`${v ? `„${v}“` : '(leer)'} → ${t ? `„${t}“` : '(leer)'} → `, el('span', { class: r === null ? 'neg' : r?.unknown ? 'muted' : 'pos' }, r === null ? `✗ passt nicht zu ${TYPE[f.type] ?? f.type}` : r.unknown ? 'leer (unbekannt)' : r.values.join(' - '))) }
    probe.addEventListener('input', show)
    const field = (s, k) => {
      const lab = el('span', { class: 'muted', style: 'font-size:11px' }, FIELD_LABEL[k] ?? k)
      if (k === 'regex') { const cb = el('input', { type: 'checkbox' }); cb.checked = !!s.regex; cb.addEventListener('change', () => { s.regex = cb.checked; show() }); return el('label', { style: 'display:inline-flex;gap:3px;align-items:center' }, cb, 'regex') }
      if (k === 'test') { const sel = el('select', {}, ...[['empty', 'leer'], ['equals', 'gleich'], ['contains', 'enthält'], ['matches', 'passt auf (regex)']].map(([v, l]) => el('option', { value: v }, l))); sel.value = s.test ?? 'empty'; sel.addEventListener('change', () => { s.test = sel.value; show() }); return el('span', {}, lab, ' ', sel) }
      if (k === 'decimal') { const sel = el('select', {}, el('option', { value: '' }, 'raten'), el('option', { value: ',' }, 'Komma'), el('option', { value: '.' }, 'Punkt')); sel.value = s.decimal ?? ''; sel.addEventListener('change', () => { if (sel.value) s.decimal = sel.value; else delete s.decimal; show() }); return el('span', {}, lab, ' ', sel) }
      if (k === 'format') { const sel = el('select', {}, ...DATE_FORMATS.map(([v, l]) => el('option', { value: v }, l))); sel.value = s.format ?? 'auto'; sel.addEventListener('change', () => { s.format = sel.value; show() }); return el('span', {}, lab, ' ', sel) }
      const inp = el('input', { placeholder: FIELD_HINT[k] ?? k, title: (FIELD_HINT[k] ?? k) + ' — ' + opHint(s.op), style: k === 'pairs' ? 'width:320px' : 'width:160px' }); inp.value = s[k] ?? (k === 'yes' ? YES_DEFAULT : ''); inp.addEventListener('input', () => { s[k] = inp.value; show() })
      return el('span', {}, lab, ' ', inp)
    }
    const evHint = f.type === 'Alphanumeric' ? el('div', { class: 'muted', style: 'font-size:11px' }, 'erlaubte Werte: ', f.values.slice(0, 12).map(v => `${nameOf(v.name, locale)} = ${v.code}`).join(' · '), f.values.length > 12 ? ' …' : '') : null
    const render = () => {
      list.innerHTML = ''
      steps.forEach((s, i) => {
        const sel = el('select', { title: opHint(s.op) }, ...OPS.map(o => el('option', { value: o[0] }, o[1]))); sel.value = s.op; sel.addEventListener('change', () => { steps[i] = { op: sel.value }; if (sel.value === 'boolean') steps[i].yes = YES_DEFAULT; render(); show() })
        list.append(el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:4px 6px;border:1px solid var(--line);border-radius:4px' }, el('span', { class: 'muted mono' }, String(i + 1)), sel, ...(FIELDS[s.op] ?? []).map(k => field(s, k)),
          el('span', { class: 'grow' }), el('button', { class: 'x', title: 'Schritt entfernen', onclick: () => { steps.splice(i, 1); render(); show() } }, '✕')))
      })
      const add = el('select', {}, el('option', { value: '' }, '+ Schritt …'), ...OPS.map(o => el('option', { value: o[0] }, o[1]))); add.addEventListener('change', () => { if (!add.value) return; const s = { op: add.value }; if (s.op === 'boolean') s.yes = YES_DEFAULT; steps.push(s); render(); show() })
      list.append(el('div', {}, add))
      show()
    }
    render()
    const close = () => overlay.remove()
    const save = async () => { const clean = steps.filter(x => x.op); if (!clean.length && (!to || to === f.code.toLowerCase())) delete cache.map[f.code]; else cache.map[f.code] = clean.length ? { to: to || f.code.toLowerCase(), steps: clean } : to; await saveMap(); close(); draw() }
    box.append(el('div', { class: 'toolbar', style: 'padding:8px 12px' }, el('b', {}, `ƒ ${f.code} ${featureText(f, locale)}`), el('span', { class: 'muted', style: 'font-size:12px' }, `← ${to || f.code.toLowerCase()} · ${TYPE[f.type] ?? f.type}`), el('span', { class: 'grow' }), el('button', { class: 'x', onclick: close }, '✕')),
      el('div', { class: 'scroll', style: 'padding:8px 12px;flex:1' }, el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:6px' }, 'Der Wert des Attributs läuft durch die Kette, dann wird er als ETIM-Attribut gelesen — Zahl, Ja/Nein, Werteliste (EV-Code oder Name), Bereich.'), evHint, list, el('div', { style: 'margin-top:10px' }, probe, out)),
      el('div', { class: 'toolbar', style: 'padding:6px 12px;border-top:1px solid var(--line)' }, el('span', { class: 'grow' }), el('button', { onclick: close }, 'abbrechen'), el('button', { class: 'primary', onclick: save }, 'Kette speichern')))
    overlay.append(box); document.body.append(overlay); overlay.addEventListener('mousedown', e => { if (e.target === overlay) close() })
  }

  // Ergebnis eines Prozesslaufs: die JSON-Zeile in der Ausgabe (stdout), der Rest ist Fortschritt (stderr)
  const jsonOf = out => { for (const line of String(out ?? '').split('\n')) { const s = line.trim(); if (s.startsWith('{')) { try { return JSON.parse(s) } catch { } } } return null }
  // Die Ansicht des Plugins ist nur, was das Plugin selbst ist (Taloan, 22.09.: „beim Plugin lege ich nur die Quelle fest“):
  // Versionen, Klassen in Gebrauch, Attribute, Zuordnung mit ƒ. Bedient wird am Knoten (Band ⌗ ETIM in der Knotenansicht).
  function draw() {
    body.innerHTML = ''
    const m = model(); const rel = st.rel; const relInfo = st.relInfo
    // 1 · Klassifikation (Taloan, 20.09.: „Felder durcheinander“): eine Tabelle der ETIM-Versionen im Journal — je Zeile Version,
    // Quelle, Klassen, Sprachen, geladen am, ● aktuell. Darunter EINE Zeile zum Holen (Liste → Auswahl → laden, oder URL, oder Datei).
    const langs = m.locales.map(l => l.code)
    const verRows = cache.versions.map(v => el('tr', {},
      el('td', {}, el('button', { class: 'toggle', style: 'width:28px', title: v.version === cache.version ? 'aktuelle Version — gilt für Zuweisen, Prüfen, Export' : 'zur aktuellen Version machen', onclick: async () => { await ctx.data.set('release', v); await loadCache(); await store.poll(true); await ops.ensureClassAttr(); await store.poll(true); draw() } }, v.version === cache.version ? '●' : '○')),
      el('td', { class: 'mono' }, `ETIM ${v.version}`),
      el('td', {}, v.url ? el('a', { href: v.url, target: '_blank', rel: 'noopener', title: v.url }, v.file ?? v.name ?? v.url.split('/').pop()) : (v.file ?? v.name ?? '')),
      el('td', { class: 'num' }, String(v.classes ?? '')),
      el('td', {}, (v.languages ?? []).join('/')),
      el('td', { class: 'muted' }, (v.at ?? '').slice(0, 10))))
    // Holen: Liste von etim-international.com (Prozess), Auswahl oder URL, laden — Fortschritt am Journalstand
    const urlIn = el('input', { placeholder: 'URL (Zip/XML)', value: st.url ?? '', style: 'width:360px', oninput: e => { st.url = e.target.value } })
    const sel = el('select', { style: 'max-width:420px', onchange: e => { st.url = e.target.value; urlIn.value = st.url } }, el('option', { value: '' }, st.list ? `${st.list.length} Versionen bei ETIM International …` : '↻ Liste erst holen'), ...(st.list ?? []).map(r => el('option', { value: r.url, selected: r.url === st.url ? '' : null }, r.name.replace(/\.zip$/, ''))))
    const listBtn = el('button', { class: 'x', title: 'etim-international.com/downloads lesen — die IXF-Versionen als Auswahl', onclick: () => busy('hole Liste …', async () => { const r = await api.post('/api/plugins/etim/run', { params: { mode: 'list', url: '', langs: '' } }); const j = jsonOf(r.output); if (!j?.releases) throw new Error(r.output?.slice(0, 200) || 'keine Liste'); st.list = j.releases; st.url ||= j.releases[0]?.url ?? ''; say(`${j.releases.length} Versionen`); draw() }) }, '↻ Liste')
    const loadBtn = el('button', { class: 'primary', title: 'laden und alle Klassen ins Journal (Sprachen des Modells; ETIM International = englisch)', onclick: async () => { if (!st.url) { store.toast('erst eine Version wählen oder eine URL eintragen'); return }
      // schon da? (Taloan klickte dreimal — jedes Mal 5 640 Einträge) — dann fragen
      const have = cache.versions.find(v => v.url === st.url || (v.file && st.url.endsWith(v.file.replace(/\.xml$/i, '.zip'))))
      if (have && !(await ctx.dialog.confirm({ title: `ETIM ${have.version} ist schon im Journal`, warn: `${have.classes} Klassen vom ${(have.at ?? '').slice(0, 10)}`, text: 'Erneut laden überschreibt die Klassen dieser Version (neue Einträge im Journal).', ok: 'Erneut laden' }))) return
      busy(`lade ${st.url.split('/').pop()} …`, async () => {
      const h0 = (await api.get('/api/health')).head; const t0 = Date.now()
      const tick = setInterval(async () => { try { const h = (await api.get('/api/health')).head; say(`lade ${st.url.split('/').pop()} … ${h - h0} Klassen geschrieben · ${Math.round((Date.now() - t0) / 1000)} s`) } catch { } }, 2000)
      try {
        const r = await api.post('/api/plugins/etim/run', { params: { mode: 'load', url: st.url, langs: langs.join(',') } }); const j = jsonOf(r.output); if (!j?.classes) throw new Error((r.output ?? '').slice(-300) || 'Laden fehlgeschlagen'); await loadCache(); await store.poll(true); await ops.ensureClassAttr(); await store.poll(true); say(`ETIM ${j.version}: ${j.classes} Klassen in ${Math.round(j.ms / 1000)} s${j.current !== j.version ? ` — aktuell bleibt ETIM ${j.current}` : ''}`); draw()
      } finally { clearInterval(tick) }
    }) } }, '⇩ laden')
    const fileBtn = el('button', { class: 'x', title: 'IXF-3.1-Datei vom Rechner (z. B. ETIM Deutschland mit deutschen Namen — ergänzt dieselbe Version)', onclick: () => file.click() }, '⇩ Datei …')
    const fileState = rel ? el('span', { class: 'muted' }, `gelesen: ETIM ${rel.header.number ?? '?'} · ${rel.classes.length} Klassen · ${[...new Set(rel.classes.slice(0, 50).flatMap(c => Object.keys(c.name)))].join('/')} `, el('button', { class: 'primary', onclick: takeAll }, `⇩ ${rel.classes.length} Klassen übernehmen`)) : null
    body.append(section('1 · Klassifikation', 'ETIM-Versionen im Journal · ● die aktuelle gilt für Zuweisen, Prüfen und Export',
      cache.versions.length ? el('table', { class: 'grid', style: 'width:auto;min-width:640px' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:34px' }, ''), el('th', { style: 'width:90px' }, 'Version'), el('th', {}, 'Quelle'), el('th', { style: 'width:80px' }, 'Klassen'), el('th', { style: 'width:90px' }, 'Sprachen'), el('th', { style: 'width:100px' }, 'geladen'))), el('tbody', {}, ...verRows))
        : el('div', { class: 'empty' }, 'noch keine ETIM-Version im Journal'),
      el('div', { style: 'display:flex;gap:8px;align-items:center;padding:8px 0 2px;flex-wrap:wrap' }, el('span', { class: 'muted' }, 'dazu:'), listBtn, sel, el('span', { class: 'muted' }, 'oder'), urlIn, loadBtn, el('span', { class: 'muted' }, 'oder'), fileBtn, file, fileState)))
    // Klassen
    // ohne gelesene Freigabe (bleibt im Browser, je Sitzung) gibt es nichts zu suchen — Feld und Knopf sagen das, statt nach dem Klick zu meckern (Taloan, 20.09.)
    const P = pool()
    const wizPick = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:6;width:380px;display:none;padding:6px;background:var(--pane)' })
    ctx.treePicker(wizPick, { roles: ['group', 'product', 'variant'], height: 300, onPick: r => { wizPick.style.display = 'none'; classDialog(r.id, ctx) } })
    const wizBtn = el('button', { class: 'primary', title: 'Knoten wählen, dann die Klasse — mit Vorschlag, Umfeld, Suche und Gruppen', onclick: () => { wizPick.style.display = wizPick.style.display === 'none' ? 'block' : 'none' } }, '⌗ Klasse zuweisen … (Knoten wählen)')
    const q = el('input', { placeholder: P.length ? `Klasse suchen — Code, Name, Synonym (${P.length})` : 'erst oben „⇩ IXF lesen“ — dann suchen', value: st.q, style: 'width:360px', disabled: !P.length, oninput: e => { st.q = e.target.value; search() } })
    const hits = el('div')
    // Blättern nach Klassengruppen (Taloan, 20.09.: „wenn ich keine Ahnung habe, wie die Klasse heisst“): ohne Suchbegriff die Gruppen, Klick zeigt die Klassen der Gruppe
    const groupsOf = () => { const m = new Map(); for (const c of P) { const g = c.group ? (nameOf(c.group.name, locale) || c.group.code) : '—'; if (!m.has(g)) m.set(g, []); m.get(g).push(c) } return [...m].sort((a, b) => a[0].localeCompare(b[0], 'de')) }
    const row = c => el('div', { class: 'pick', style: 'display:flex;gap:8px;align-items:center' }, el('span', { class: 'mono muted' }, c.code), el('span', { class: 'grow' }, nameOf(c.name, locale), el('span', { class: 'muted', style: 'font-size:11px' }, ` · ${c.features.length} ETIM-Attribute · ${c.status}`)), cache.classes.has(c.code) ? assignBtn(c.code) : el('button', { class: 'x', title: 'Klasse übernehmen', onclick: async () => { await takeClass(c); draw() } }, '+'))
    const browse = () => {
      hits.innerHTML = ''
      if (st.grp) { hits.append(el('div', { class: 'pick', style: 'font-weight:600', onclick: () => { st.grp = null; browse() } }, `‹ ${st.grp}`)); for (const c of (groupsOf().find(([g]) => g === st.grp)?.[1] ?? []).sort((a, b) => nameOf(a.name, locale).localeCompare(nameOf(b.name, locale)))) hits.append(row(c)); return }
      const wrap = el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:2px 12px' })
      for (const [g, cs] of groupsOf()) wrap.append(el('div', { class: 'pick', onclick: () => { st.grp = g; browse() } }, `▸ ${g} `, el('span', { class: 'muted' }, String(cs.length))))
      hits.append(wrap)
    }
    const search = () => {
      hits.innerHTML = ''; if (!P.length || st.q.trim().length < 2) { if (P.length) browse(); return }
      const s = st.q.trim().toLowerCase()
      const found = P.filter(c => c.code.toLowerCase().includes(s) || Object.values(c.name).some(n => n.toLowerCase().includes(s)) || Object.values(c.synonyms).some(l => l.some(n => n.toLowerCase().includes(s)))).slice(0, 40)
      for (const c of found) hits.append(el('div', { class: 'pick', style: 'display:flex;gap:8px;align-items:center' }, el('span', { class: 'mono muted' }, c.code), el('span', { class: 'grow' }, nameOf(c.name, locale), el('span', { class: 'muted', style: 'font-size:11px' }, ` · ${c.features.length} ETIM-Attribute · ${c.status}`)), cache.classes.has(c.code) ? el('span', { class: 'muted' }, '✓') : el('button', { class: 'x', title: 'Klasse übernehmen (ins Journal)', onclick: async () => { await takeClass(c); draw() } }, '+'), st.assign ? el('button', { class: 'primary', title: `übernehmen und ${tree.byId.get(st.assign)?.label} zuweisen`, onclick: async () => { await assignClass(st.assign, c.code); draw() } }, '⇢ zuweisen') : null))
      if (!found.length) hits.append(el('div', { class: 'muted', style: 'padding:4px' }, 'nichts gefunden'))
    }
    if (P.length) search()
    const taken = usedClasses().sort((a, b) => a.code.localeCompare(b.code))
    const tbl = el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:90px' }, 'Klasse'), el('th', {}, 'Name'), el('th', { style: 'width:70px' }, 'ETIM-Attribute'), el('th', { style: 'width:90px' }, 'nicht zugeordnet'), el('th', { style: 'width:110px' }, 'Version'), el('th', { style: 'width:200px' }, 'Knoten'), el('th', { style: 'width:100px' }, ''), el('th', { style: 'width:60px' }, ''))),
      el('tbody', {}, ...taken.map(c => { const missing = c.features.filter(f => !hasAttr(attrKeyOf(f.code))).length; return el('tr', {}, el('td', { class: 'mono' }, c.code), el('td', {}, nameOf(c.name, locale), el('span', { class: 'muted', style: 'font-size:11px' }, c.group ? ` · ${nameOf(c.group.name, locale)}` : '')), el('td', { class: 'num' }, c.features.length), el('td', { class: missing ? 'warn num' : 'muted num' }, missing || '—'), el('td', { class: 'muted', style: 'font-size:11px' }, `${c.release?.name ?? ''} v${c.version}`),
        el('td', { style: 'position:relative' }, assignBtn(c.code)),
        el('td', {}, rel && rel.classes.some(x => x.code === c.code && x.version !== c.version) ? el('button', { class: 'x', title: 'aus der gelesenen Freigabe aktualisieren', onclick: async () => { await takeClass(rel.classes.find(x => x.code === c.code)); draw() } }, '↻') : null, el('button', { class: 'x', title: `Zuweisung an ${(cache.usedBy.get(c.code) ?? []).length} Knoten entfernen — die Klasse bleibt in Version ${cache.version}`, onclick: async () => { const nodes = cache.usedBy.get(c.code) ?? []; if (!(await ctx.dialog.confirm({ title: `${c.code} an ${nodes.length} Knoten entfernen?`, list: nodes.map(n => `${ICON[n.role] ?? ''} ${n.label}`), text: 'Das Klassenattribut wird dort geleert; die Klasse bleibt in der Version.', ok: '✕ Zuweisungen entfernen', danger: true }))) return; await busy(`entferne ${c.code} …`, async () => { await ctx.batch(nodes.map(n => ({ op: 'attribute.set', args: { node: n.id, attribute: cache.settings.classAttr, locale: null, value: '' } }))); await store.poll(true); await loadUsed(); draw() }) } }, '✕')), el('td', { class: 'muted', style: 'font-size:11px' }, (cache.usedBy.get(c.code) ?? []).slice(0, 3).map(n => n.label).join(', ') + ((cache.usedBy.get(c.code) ?? []).length > 3 ? ` … (${cache.usedBy.get(c.code).length})` : ''))) })))
    const assignRow = st.assign ? tree.byId.get(st.assign) : null
    body.append(section('2 · Klassen', `${taken.length} in Gebrauch · ${cache.classes.size} in Version ${cache.version ?? '?'}`,
      el('div', { style: 'display:flex;gap:8px;align-items:center;padding:4px 0' }, el('span', { style: 'position:relative' }, wizBtn, wizPick), el('span', { class: 'muted', style: 'font-size:12px' }, 'oder im Baum: Rechtsklick → Datenanalyse → ⌗ ETIM-Klasse …')),
      el('div', { style: 'display:flex;gap:8px;align-items:center;padding:6px 0;flex-wrap:wrap' }, q, el('button', { class: 'x', disabled: !P.length, title: P.length ? `alle Klassen, die im Attribut ${cache.settings.classAttr} im Baum stehen, übernehmen` : 'braucht eine ETIM-Version (oben holen)', onclick: classesFromTree }, '⇩ aus dem Baum')),
      hits, taken.length ? tbl : el('div', { class: 'empty' }, cache.classes.size ? 'noch keine Klasse im Baum zugewiesen — oben suchen und ⇢ zuweisen' : 'erst eine ETIM-Version holen')))
    // Attribute
    // Gruppe der ETIM-Daten: „etim“ legen wir an (Attribute direkt zugewiesen); eine vorhandene Gruppe heißt: hier zuordnen (Best Guess über die Namen)
    const groupSel = el('select', { title: 'Attributgruppe der ETIM-Daten — gibt es sie nicht, wird sie angelegt', onchange: e => { cache.settings.group = e.target.value; saveSettings(); draw() } },
      el('option', { value: 'etim' }, `etim${(model().groups ?? []).some(g => g.key === 'etim') ? '' : ' (anlegen)'}`),
      ...(model().groups ?? []).filter(g => g.key !== 'etim').map(g => el('option', { value: g.key }, `${g.label?.[locale] || g.label?.de || g.key} (${g.key})`)))
    groupSel.value = groupKey()
    const inGroup = () => attrs().filter(a => a.group === groupKey())
    const guessInGroup = () => {   // ETIM-Attribut → Attribut der gewählten Gruppe nach Namen (alle Sprachen, Code)
      const { norm, similarity } = ctx.mapper; let n = 0
      for (const f of allFeatures().values()) {
        if (cache.map[f.code] || hasAttr(f.code.toLowerCase())) continue
        const wanted = [f.code, ...Object.values(f.name)].map(norm); let best = null, score = 0
        for (const a of inGroup()) for (const w of wanted) for (const nme of [a.key, ...Object.values(a.label ?? {})].map(norm)) { const s = nme === w ? 1 : similarity(nme, w); if (s > score) { score = s; best = a } }
        if (best && score >= 0.8) { cache.map[f.code] = best.key; n++ }
      }
      saveMap(); say(`${n} ETIM-Attribute in Gruppe ${groupKey()} zugeordnet`); draw()
    }
    const classSel = el('select', { onchange: e => { cache.settings.classAttr = e.target.value; saveSettings(); draw() } }, el('option', { value: DEFAULTS.classAttr }, `${DEFAULTS.classAttr}${hasAttr(DEFAULTS.classAttr) ? '' : ' (anlegen)'}`), ...attrs().filter(a => a.key !== DEFAULTS.classAttr && (a.type === 'text' || a.type === 'enum')).map(a => el('option', { value: a.key }, `${lbl(a)} (${a.key})`)))
    classSel.value = cache.settings.classAttr
    // Regeln der Ausleitung (unbekannt, Klasse Pflicht, Vollständigkeit) stehen seit 22.09. im BMEcat-Profil (xport), nicht hier
    // Gruppe ETIM gilt erst, wenn sie an einem Knoten des Pfads hängt (GroupsAttached) — hier an einen Teilbaum hängen
    const attached = tree.rows.filter(r => (r.groups ?? '').split(',').includes(groupKey()))
    const attachBtn = el('button', { class: 'x', title: `die Attributgruppe ${groupKey()} an einen Teilbaum hängen — erst dann gelten die Attribute an den Knoten darunter` }, `⌗ Gruppe an Teilbaum${attached.length ? ` · ${attached.length}` : ''}`)
    const attachPick = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:5;width:380px;display:none;padding:6px;background:var(--pane)' })
    ctx.treePicker(attachPick, { roles: ['group'], height: 300, onPick: async r => { attachPick.style.display = 'none'; const groups = [...new Set([...(r.groups ?? '').split(',').filter(Boolean), groupKey()])]; await api.post(`/api/nodes/${encodeURIComponent(r.id)}/groups`, { groups }, 'PUT'); await tree.load?.(); say(`Gruppe ${groupKey()} hängt an ${r.label}`); draw() } })
    attachBtn.addEventListener('click', () => { attachPick.style.display = attachPick.style.display === 'none' ? 'block' : 'none' })
    const allFeats = allFeatures(); for (const f of allFeats.values()) f.n = f.classes.length
    const missing = [...allFeats.values()].filter(f => !hasAttr(attrKeyOf(f.code)))
    body.append(section('3 · Attribute', `${allFeats.size} ETIM-Attribute · ${missing.length} nicht zugeordnet`,
      el('div', { style: 'display:flex;gap:12px;align-items:center;padding:6px 0;flex-wrap:wrap' }, el('label', { class: 'muted' }, 'Gruppe ', groupSel), groupKey() !== 'etim' ? el('button', { class: 'x', title: `ETIM-Attribute den vorhandenen Attributen der Gruppe ${groupKey()} nach Namen zuordnen (ab 80 % Ähnlichkeit); der Rest wird angelegt`, onclick: guessInGroup }, `↻ in ${groupKey()} zuordnen`) : null, el('label', { class: 'muted' }, 'Klasse in ', classSel),
        el('button', { class: 'primary', title: `Klassenattribut ${cache.settings.classAttr} als Werteliste der übernommenen Klassen und je fehlendem ETIM-Attribut ein Attribut (ef…) in der Gruppe ${groupKey()} anlegen`, onclick: createAttributes }, `＋ Attribute anlegen (${missing.length + (hasAttr(cache.settings.classAttr) ? 0 : 1)})`),
        el('span', { style: 'position:relative' }, attachBtn, attachPick))))
    // Zuordnung
    // Zuordnung: Standard ist ein vorhandenes Attribut (Taloan, 22.09.: „die Werte existieren schon, nur nicht in der Form“) mit ƒ; das eigene ef… ist der Ausweg
    const mapBody = el('tbody')
    const filterCls = st.mapFilter ? cache.classes.get(st.mapFilter) : null
    const featList = [...allFeats.values()].filter(f => !filterCls || filterCls.features.some(x => x.code === f.code)).sort((a, b) => a.code.localeCompare(b.code))
    for (const f of featList) {
      const cur = attrKeyOf(f.code); const steps = stepsOf(f.code)
      const sel = el('select', { style: 'width:100%', onchange: e => { const v = e.target.value; const keep = steps ? { steps } : null; if ((v === f.code.toLowerCase() || !v) && !keep) delete cache.map[f.code]; else cache.map[f.code] = keep ? { to: v || f.code.toLowerCase(), ...keep } : v; saveMap(); draw() } }, el('option', { value: '' }, hasAttr(f.code.toLowerCase()) ? `${f.code.toLowerCase()} (eigenes)` : '— eigenes ef… anlegen —'), ...attrs().map(a => el('option', { value: a.key }, `${lbl(a)} (${a.key})`)))
      sel.value = typeof cache.map[f.code] === 'string' ? cache.map[f.code] : cache.map[f.code]?.to ?? ''
      const fx = el('button', { class: steps ? 'primary' : 'x', title: steps ? `ƒ ${describeSteps(steps)} — ändern` : 'ƒ Umwandlung: Einheit umrechnen, ja/x → Ja/Nein, Text → EV-Code nach Tabelle, von/bis verbinden', onclick: () => stepsDialog(f) }, 'ƒ')
      mapBody.append(el('tr', { 'data-ef': f.code, style: f.code === efParam ? 'outline:2px solid var(--warn);outline-offset:-2px' : '' }, el('td', { class: 'mono' }, f.code), el('td', {}, featureText(f, locale)), el('td', { class: 'muted' }, TYPE[f.type] ?? f.type, f.type === 'Alphanumeric' ? ` (${f.values.length})` : ''), el('td', { class: 'num muted' }, f.n), el('td', { class: hasAttr(cur) ? '' : 'warn' }, sel), el('td', {}, fx)))
    }
    const backRow = st.backNode ? tree.byId.get(st.backNode) : null
    const mapSec = section('4 · Zuordnung', `ETIM-Attribut ← Attribut, ƒ = Umwandlung; leer = eigenes Attribut ef… (wird angelegt) · jede Änderung wird sofort gespeichert${filterCls ? ` · nur ${filterCls.code}` : ''}`,
      filterCls ? el('div', { class: 'chips', style: 'padding:4px 0' },
        backRow ? el('button', { class: 'primary', title: `zurück zum Knoten ${backRow.label} — in die Gruppe ${groupKey()}`, onclick: () => ctx.go?.(`/tree/${encodeURIComponent(backRow.id)}?group=${encodeURIComponent(groupKey())}`) }, `← ${ICON[backRow.role] ?? ''} ${backRow.label}`) : null,
        el('span', { class: 'chip' }, `${filterCls.code} ${nameOf(filterCls.name, locale)} · ${featList.length} ETIM-Attribute`), el('button', { class: 'x', title: 'alle ETIM-Attribute aller Klassen in Gebrauch', onclick: () => { st.mapFilter = null; st.backNode = null; draw() } }, '✕ Filter'),
        el('span', { class: 'muted', style: 'font-size:12px' }, 'Auswahl im Feld = gespeichert; ƒ öffnet die Umwandlung')) : null,
      allFeats.size ? el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:90px' }, 'ETIM-Attribut'), el('th', {}, 'Name [Einheit]'), el('th', { style: 'width:100px' }, 'Typ'), el('th', { style: 'width:50px' }, 'Kl.'), el('th', { style: 'width:280px' }, 'Attribut'), el('th', { style: 'width:36px' }, 'ƒ'))), mapBody) : el('div', { class: 'empty' }, 'keine Klassen übernommen'))
    mapSec.id = 'etim-map'
    body.append(mapSec)
    // (5 · Prüfung war hier — seit 22.09. die Stufe „Daten“ der Übersicht; check() prüft den gewählten Knoten)
  }
  st.relInfo = await ctx.data.get('release')
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, '⌗ ETIM'), el('span', { class: 'muted', style: 'font-size:12px' }, 'Quelle, Klassen, Attribute, Zuordnung — bedient wird am Knoten (Band ⌗ ETIM)'), el('span', { class: 'grow' }), status), body)
  if (st.mapFilter) setTimeout(() => (document.querySelector(`tr[data-ef="${efParam}"]`) ?? document.getElementById('etim-map'))?.scrollIntoView({ block: 'center' }), 0)
  draw()
  return () => {}
}

export default {
  views: [
    { path: 'etim', label: 'ETIM', icon: '⌗', topic: 'classification', hint: 'ETIM: Quelle und Versionen, Klassen in Gebrauch, Attribute, Zuordnung ETIM-Attribut ← Attribut mit ƒ — bedient wird am Knoten (Band ⌗ ETIM)', mount },
    { path: 'coverage', label: 'ETIM-Attribute', icon: '⌗', topic: 'analysis', hint: 'Datenanalyse wie DPP/PPWR: welche ETIM-Attribute der ETIM-Klassen fehlen — Attribute anlegen, Vorschläge aus Regeln, KI oder Recherche im Internet, übernehmen', mount: async (root, ctx) => { await cache.loaded; return ctx.compliance.mount(root, ctx, buildCatalog(ctx)) } },
  ],
  nodeBands: [
    { key: 'etim', label: 'ETIM', icon: '⌗', roles: ['group', 'product', 'variant'], mount: bandMount },   // Klasse · Attribute · Daten am Knoten (Taloan, 22.09.)
  ],
  nodeActions: [
    // die zugewiesene Klasse (auch geerbt) als eigener Punkt (Taloan, 22.09.): Klick → Knotenansicht, direkt in der Attributgruppe (Reiter oder Liste)
    { label: row => { const c = cache.classOf.get(row.id); return c ? `${c.code} ${nameOf(cache.classes.get(c.code)?.name, 'de') || ''}`.trim() : null }, hint: row => { const c = cache.classOf.get(row.id); return c ? (c.own ? 'Klasse hier · ETIM-Attribute pflegen' : 'Klasse geerbt · ETIM-Attribute pflegen') : '' }, icon: '⌗', topic: 'classification', roles: ['group', 'product', 'variant'], run(id, ctx) { return ctx.go?.(`/tree/${encodeURIComponent(id)}?group=${encodeURIComponent(groupKey())}`) } },
    { label: row => cache.classOf.get(row.id) ? 'ETIM-Klasse ändern (+)' : 'ETIM-Klasse (+)', hint: 'Klasse wählen — Vorschlag, Umfeld, Suche', icon: '⌗', topic: 'classification', roles: ['group', 'product'], run(id, ctx) { return classDialog(id, ctx) } },   // (+): auch zum Zufügen (Taloan, 22.09.)
  ],
  checks,
  featuresOf: etimFeatures,
  gate: etimGate,
  resolveValue,
}
