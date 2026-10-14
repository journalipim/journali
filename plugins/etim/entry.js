// Plugin etim: ETIM-Klassifikation in journali. Eine Freigabe (IXF 3.1) wird im Browser gelesen, die Klassen,
// die man braucht, kommen als Datensätze ins Journal (class:<EC>, aufgelöst), die Klasse steht als Attribut am Produkt
// (Werteliste der übernommenen Klassen), je ETIM-Attribut ein Attribut (ef000040: Zahl mit Einheit, Ja/Nein, Werteliste mit
// EV-Codes, Bereich als Text) in der Attributgruppe ETIM — oder eine Zuordnung auf vorhandene Attribute. Prüfregeln in
// ✓ Datenqualität (Klasse unbekannt, Wert passt nicht zum ETIM-Attribut, Belegung), ETIM-Attribute für ‹› Vorlagen-Export (BMEcat).
// Umbau: ETIM ist Klassifikation, kein Export — die Ansicht geht vom Knoten aus
// (Klasse → Attribute → Daten → Ausleitung), bearbeitet wird in der Subitems-Tabelle, nicht hier; die Zuordnung ETIM-Attribut → Attribut
// hat ƒ (Umwandlungskette); die Regeln der Ausleitung (unbekannt, Klasse Pflicht, Vollständigkeit) stehen im BMEcat-Profil (xport).
import { parseIxf, classRecord, nameOf, classText, featureText, featuresOf, checkNode, resolveValue, gate, mapEntry, throughSteps, audit, variantOf, releaseKey, readiness, isZip, ixfInZip, inflateInBrowser, featureCount } from './core.mjs'
import { OPS, FIELDS, FIELD_LABEL, FIELD_HINT, DATE_FORMATS, YES_DEFAULT, describe as describeSteps, opHint } from '../table/transform.mjs'
const L = l => globalThis.journali?.L ? globalThis.journali.L(l) : (l?.de ?? Object.values(l ?? {})[0] ?? '')   // Bezeichnung in der Oberflächensprache
const t_ = (k, p) => globalThis.journali?.t ? globalThis.journali.t(k, p) : String(k).replace(/\{(\w+)\}/g, (m, i) => p?.[i] ?? m)   // Oberflächensprache: spät gebunden, im Test ohne Fenster ladbar

function el(tag, attrs = {}, ...kids) { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else if (k === 'disabled') { if (v) e.setAttribute(k, '') } else if (v != null && v !== false) e.setAttribute(k, v) } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : String(c)); return e }
const ICON = { group: '▣', product: '▦', variant: '◆' }
const SEV = { error: '✗', warn: '⚠', info: 'ℹ', ok: '✓' }
const TYPE = { Alphanumeric: t_('Liste'), Numeric: t_('Zahl'), Range: t_('Bereich'), Logical: 'Ja/Nein' }
// Demo (07.10.2026): Holen, Zuweisen, Entfernen und Anlegen tragen data-demo — in der Demo ist die Klasse fest zugewiesen (Demo.cs)
const DEFAULTS = { classAttr: 'class_etim', unknownAs: 'UN', requireClass: false }
/// Gruppe und Klassenattribut des Systems heissen class_etim (die Gruppe einer Klasse class_etim_<klasse>); die Gruppe trägt das Klassenattribut.
const SYSTEMGRUPPE = 'class_etim'
const hatGruppe = k => (globalThis.journali?.store?.model?.groups ?? []).some(g => g.key === k)
const groupKey = () => cache.settings.group || SYSTEMGRUPPE
/// Die Gruppe einer Klasse: die Gruppe des Systems, ein Unterstrich, der Code in Kleinschrift — so legt der Server sie an (ClassificationApi.ClassGroupKey).
/// Jede Klasse hat ihre Attributgruppe mit ihren Attributen; die Gruppe des Systems trägt nur das Klassenattribut.
const classGroupKey = code => `${groupKey()}_${String(code ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`
/// Gehört ein Attribut dem System? Die Attribute der Klassengruppen und das Klassenattribut.
const ofSystem = a => a.group === groupKey() || String(a.group ?? '').startsWith(groupKey() + '_') || a.key === cache.settings.classAttr

// Klassen und Einstellungen im Speicher — die Prüfregeln laufen synchron (Datenqualität) und brauchen sie ohne Nachschlagen
// Klassen je Version: class:<version>:<EC>; release:<version> die Freigabe dazu;
// release = die aktuelle Version (Zuweisen, Prüfen, Export). Alte Datensätze class:<EC> ohne Version zählen zur Version der damaligen Freigabe.
// Mit der ganzen Freigabe im Journal (5 640 Klassen, 17 000 ETIM-Attribute) heisst „übernommen“ nicht mehr „in Gebrauch“: Attribute, Zuordnung und
// Datenanalyse richten sich nach den Klassen, die im Baum zugewiesen sind (used); die Freigabe ist der Suchpool.
// Seit 14.10.2026 steht keine ganze Freigabe mehr im Journal: classes hält die Klassen in Gebrauch (vollständig, aus dem Journal), liste die
// Suchliste der aktuellen Freigabe (Code, Namen, Synonyme, Gruppe, Zahl der ETIM-Attribute) — nur im Browser, geholt von der URL der Freigabe,
// wenn jemand sucht oder zuweist, und weg, wenn die Seite geschlossen wird.
const cache = { classes: new Map(), liste: new Map(), settings: { ...DEFAULTS }, map: {}, mapping: {}, loaded: null, version: null, releaseKey: null, release: null, versions: [], used: new Set(), usedBy: new Map(), ownClass: new Map(), pool: false, poolError: null }   // ownClass: Knoten → Code der eigenen Klasse (klasseVon rechnet die geerbte dazu); pool: die Suchliste ist geholt
// Wo eine Klasse zugewiesen ist: GET /api/values/{klassenattribut} — nur die eigenen Werte (Id, Wert, Name, Rolle). Vorher kam der ganze Baum noch
// einmal und je Wurzel eine Tabelle (rund 15 MB je Abruf, bei jedem Seitenaufruf, 04.10.2026). Die geerbte Klasse rechnet klasseVon über den Baum.
async function loadUsed() {
  try {
    const key = cache.settings.classAttr
    const r = await (await fetch(`/api/values/${encodeURIComponent(key)}`)).json()
    const used = new Set(); const by = new Map(); const own = new Map()
    for (const x of r.values ?? []) {
      const c = String(x.value ?? '').trim().toUpperCase(); if (!c) continue
      used.add(c); own.set(x.id, c)
      if (!by.has(c)) by.set(c, []); by.get(c).push({ id: x.id, label: x.label, role: x.role })
    }
    cache.used = used; cache.usedBy = by; cache.ownClass = own
  } catch { }
}
/// Die Klasse an einem Knoten: die eigene, sonst die des nächsten Vorfahren (Baum der Oberfläche) — { code, own } oder null
function klasseVon(id) {
  const own = cache.ownClass.get(id); if (own) return { code: own, own: true }
  const byId = globalThis.journali?.tree?.byId
  for (let p = byId?.get(id)?.parent; p; p = byId.get(p)?.parent) { const c = cache.ownClass.get(p); if (c) return { code: c, own: false } }
  return null
}
/// Klassen in Gebrauch: die im Baum zugewiesenen; ohne Zuweisung und bei kleinem Bestand (von Hand übernommen) alle
const usedClasses = () => { const out = [...cache.used].map(c => cache.classes.get(c)).filter(Boolean); return out.length || cache.classes.size > 50 ? out : [...cache.classes.values()] }
// Schlüssel je Freigabe: Nummer und Ausführung
// Herkunft eines Umfeld-Vorschlags in Worten
const whyText = (why, n) => why === t_('Geschwister') ? t_('{0} Geschwister{1} {2} diese Klasse zugewiesen', [n, n === 1 ? '' : 'n', n === 1 ? 'ist' : 'sind'])
  : why === 'darunter' ? t_('{0} Knoten im Teilbaum {1} diese Klasse zugewiesen', [n, n === 1 ? 'ist' : 'sind'])
  : why.startsWith(t_('am Pfad:') + ' ') ? t_('{0} am Pfad ist diese Klasse zugewiesen — sie erbt schon hierher', [why.slice(9)])
  : `${why}: ${n}`
const classKeyOf = code => `class:${cache.releaseKey ?? cache.version ?? '0'}:${code}`
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
/// Subitems-Tabelle im eigenen Fenster mit genau den Spalten der Klasse
// Gruppe: alles darunter (tief); Produkt/Variante: die Geschwister unter dem Elternteil, die eigene Zeile ist dabei
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
    for (const n of names.filter(n => n.startsWith('release:'))) { const r = await get(n); if (r) { const k = n.slice(8); cache.versions.push({ ...r, key: k, version: r.version ?? k.split('-')[0], variant: r.variant ?? variantOf(r.file ?? r.url ?? '') }) } }
    // Altbestand ohne Version: zählt zur Version der Freigabe, die damals gelesen wurde
    const legacy = names.filter(n => /^class:[^:]+$/.test(n))
    if (current && !cache.versions.length) cache.versions.push({ ...current, key: releaseKey(current), version: String(current.version ?? current.number ?? '0') })
    if (legacy.length && current && !cache.versions.some(v => v.version === String(current.number ?? '0'))) cache.versions.push({ ...current, key: String(current.number ?? '0'), version: String(current.number ?? '0'), legacy: true })
    cache.versions.sort((a, b) => parseFloat(b.version) - parseFloat(a.version) || String(a.variant ?? '').localeCompare(String(b.variant ?? '')))
    const cur = current ? cache.versions.find(v => v.key === releaseKey(current)) ?? cache.versions.find(v => v.version === String(current.version ?? current.number ?? '')) : null
    const use = cur ?? cache.versions[0] ?? null
    cache.releaseKey = use?.key ?? null; cache.version = use?.version ?? null; cache.release = use
    cache.classes = new Map(); cache.liste = new Map(); cache.pool = false; cache.poolError = null
    await loadUsed()
    if (cache.releaseKey != null) {
      // Nur die Klassen in Gebrauch, einzeln (wenige). Sind keine zugewiesen und nur wenige übernommen (von Hand), kommen diese — die Suchliste
      // der ganzen Freigabe holt ensurePool, wenn jemand sucht oder zuweist.
      const imBestand = names.filter(n => n.startsWith(`class:${cache.releaseKey}:`)).length
      if (!cache.used.size && imBestand <= 50) {
        if (imBestand) { const all = await (await fetch(`/api/plugins/etim/data?values=true&prefix=${encodeURIComponent('class:' + cache.releaseKey + ':')}`)).json(); for (const c of Object.values(all)) cache.classes.set(c.code, c) }
        return
      }
      const codes = [...cache.used]
      for (let i = 0; i < codes.length; i += 8)
        await Promise.all(codes.slice(i, i + 8).map(async code => { const k = await get(`class:${cache.releaseKey}:${code}`) ?? (use?.legacy ? await get(`class:${code}`) : null); if (k) cache.classes.set(k.code, k) }))
    }
  } catch { }
}
/// Ein Lauf des Prozesses fetch.mjs (Server, wegen CORS): sein Ergebnis ist die JSON-Zeile der Ausgabe
async function etimLauf(params) {
  const r = await fetch('/api/plugins/etim/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ params: { mode: '', url: '', langs: '', codes: '', ...params } }) })
  const j = await r.json().catch(() => null)
  if (!r.ok) throw new Error(j?.error ?? `${r.status}`)
  const out = jsonOfOut(j?.output)
  if (!out) throw new Error(String(j?.output ?? '').split('\n').filter(z => z.startsWith('✗')).pop()?.slice(2) || t_('ETIM nicht gelesen'))
  return out
}
const sprachen = () => (globalThis.journali?.store?.model?.locales ?? []).map(l => l.code).join(',') || 'de,en'
/// Die Suchliste der aktuellen Freigabe — erst, wenn jemand sucht oder zuweist (14.10.2026): der Server holt die Freigabe von ihrer URL, liest sie
/// und gibt die Liste zurück; der Browser hält sie, solange die Seite offen ist. Ohne URL (aus einer Datei gelesen) wird in den Klassen in Gebrauch
/// gesucht — für mehr ist die Datei neu zu lesen.
async function ensurePool() {
  if (cache.pool || cache.releaseKey == null) return
  for (const c of cache.classes.values()) cache.liste.set(c.code, c)
  const url = cache.release?.url
  if (!url) { cache.pool = true; return }
  try {
    const j = await etimLauf({ mode: 'index', url, langs: sprachen() })
    for (const c of j.liste ?? []) if (!cache.classes.has(c.code)) cache.liste.set(c.code, c)
    cache.pool = true; cache.poolError = null
  } catch (e) { cache.poolError = e.message }
}
/// Klassen vollständig ins Journal und in den Speicher — wenn jemand sie übernimmt oder zuweist: der Server holt die Freigabe und schreibt genau
/// diese Klassen (fetch.mjs classes). Liefert, was es in der Freigabe nicht gibt.
async function holeKlassen(codes) {
  const fehlt = [...new Set(codes.map(c => String(c).toUpperCase()))].filter(c => !cache.classes.has(c))
  if (!fehlt.length) return []
  if (!cache.release?.url) return fehlt
  await etimLauf({ mode: 'classes', url: cache.release.url, langs: sprachen(), codes: fehlt.join(',') })
  for (const code of fehlt) {
    const r = await fetch('/api/plugins/etim/data/' + encodeURIComponent(`class:${cache.releaseKey}:${code}`))
    if (r.ok) { const k = await r.json(); cache.classes.set(k.code, k); cache.liste.set(k.code, k) }
  }
  return fehlt.filter(c => !cache.classes.has(c))
}
/// Was gesucht wird: die Suchliste, darin die Klassen in Gebrauch vollständig
const suchliste = () => [...new Map([...cache.liste, ...cache.classes]).values()]
cache.loaded = loadCache()
const cfg = locale => ({ ...cache.settings, map: mergedMap(), locale })

/// Modell anlegen: Gruppe ETIM, Klassenattribut (Werteliste der übernommenen Klassen), je ETIM-Attribut ein Attribut ef…
function modelOps(ctx) {
  const { api, store } = ctx
  const model = () => store.model
  const locale = model().masterLocale ?? 'de'
  const hasAttr = key => model().attributes.some(a => a.key === key)
  // Was im Modell anzulegen ist, macht der Server (/api/classification, ClassificationApi.cs): Gruppe, Klassenattribut mit Werteliste,
  // ein Attribut je Merkmal mit Bedingung, Einheit und Liste; bei einer Namenskollision weicht er aus und sagt es. Hier steht nur,
  // was ETIM ausmacht: wie ein ETIM-Attribut auf die neutralen Typen abgebildet wird.
  const system = () => ({ group: groupKey(), groupLabel: { de: 'ETIM', en: 'ETIM' }, classAttr: cache.settings.classAttr, classLabel: { de: 'ETIM-Klasse', en: t_('ETIM class') },
    classAttrAlternatives: ['etim_klasse', 'etim_class_std'], ownPattern: '^ef\\d+$', plugin: 'etim' })
  const classSpec = c => ({ code: c.code, name: c.name, section: c.group ? (nameOf(c.group.name, locale) || c.group.code) : null })
  const TYPES = { Numeric: 'decimal', Logical: 'boolean', Range: 'text', Alphanumeric: 'enum' }
  const RANGE = '^\\s*-?[\\d.,]+(\\s*(-|\\.\\.|…)\\s*-?[\\d.,]+)?\\s*$'
  /// Merkmal → Klassen, die es führen: einmal je Anlegen gerechnet (04.10.2026) — vorher je Merkmal über alle Klassen und ihre Merkmale
  const merkmalIndex = () => { const idx = new Map(); for (const c of cache.classes.values()) for (const x of c.features) { if (!idx.has(x.code)) idx.set(x.code, []); idx.get(x.code).push(c.code) } return idx }
  const featureSpec = (f, idx = merkmalIndex()) => {
    const classes = [...new Set(idx.get(f.code) ?? [])]   // Bedingung: alle Klassen, die es führen
    const spec = { key: f.code.toLowerCase(), name: f.name, type: TYPES[f.type] ?? 'text', classes, target: attrKeyOf(f.code) }
    if (f.type === 'Numeric' && f.unit) spec.unit = { code: f.unit.code, abbr: f.unit.abbr, name: f.unit.name }
    if (f.type === 'Range') { spec.pattern = RANGE; spec.patternHint = `von - bis${f.unit ? ' in ' + (nameOf(f.unit.abbr, locale) || f.unit.code) : ''}` }
    if (f.type === 'Alphanumeric') spec.values = f.values.map(v => ({ code: v.code, name: v.name }))
    return spec
  }
  /// Die Klassen, die dem Server mitgehen: die in der Werteliste noch fehlen — alle, wenn es die Liste oder ihre Spalte „group“ nicht gibt
  /// oder das Klassenattribut einem anderen gehört (dann legt der Server ein eigenes an)
  function classesToSend(also = null) {
    const key = cache.settings.classAttr
    const list = (model().lists ?? []).find(l => l.key === key), a = model().attributes.find(x => x.key === key)
    const foreign = a && !(a.group === groupKey() || (a.type === 'enum' && a.list === key))
    const have = !list || foreign || !(list.columns ?? []).includes('group') ? new Set() : new Set((list.values ?? []).map(v => v.value))
    const out = [...cache.classes.values()].filter(c => !have.has(c.code))
    if (also && !out.some(c => c.code === also.code)) out.push(also)
    return out.sort((a, b) => a.code.localeCompare(b.code)).map(classSpec)
  }
  /// Was der Server wegen einer Namenskollision gewählt hat, gilt ab jetzt
  async function adopt(r) {
    let changed = false
    if (r?.groupRenamed) { cache.settings.group = r.group; changed = true; store.toast(t_('⚠ Gruppe {0} gehört schon anderen Attributen — ETIM benutzt {1}', [r.groupRenamed.from, r.group])) }
    if (r?.classAttrRenamed) { cache.settings.classAttr = r.classAttr; changed = true; store.toast(t_('⚠ {0} gehört schon einem anderen Attribut — ETIM benutzt {1}', [r.classAttrRenamed.from, r.classAttr])) }
    if (changed) await ctx.data.set('settings', cache.settings)
    return r
  }
  /// Die Klassen, deren Gruppen ein Aufruf anlegt: die ausdrücklich genannten, sonst die in Gebrauch, die eines der Merkmale führen
  function groupClasses(list, explicit = null) {
    if (explicit) return explicit.map(classSpec)
    const codes = new Set()
    for (const f of list) for (const c of cache.classes.values()) if (cache.used.has(c.code) && c.features.some(x => x.code === f.code)) codes.add(c.code)
    return [...codes].map(code => classSpec(cache.classes.get(code)))
  }
  async function ensure({ groupOnly = false, features = [], classes = null } = {}) {
    return adopt(await api.post('/api/classification/ensure', { system: system(), groupOnly, classes: groupOnly ? [] : classesToSend(), features: (idx => features.map(f => featureSpec(f, idx)))(merkmalIndex()), classGroups: groupOnly ? [] : groupClasses(features, classes) }))
  }
  const ensureGroup = async () => (await ensure({ groupOnly: true })).group
  const ensureClassAttr = async () => (await ensure()).classAttr
  /// Merkmale anlegen und den Gruppen ihrer Klassen zuordnen — ein Aufruf für alle. `classes`: die Klassen, deren Gruppen gemeint sind (sonst die in Gebrauch)
  async function createFeatures(list, classes = null) { return ensure({ features: list, classes }) }
  const createFeature = async (f, classes = null) => { await createFeatures([f], classes); return f.code.toLowerCase() }
  /// Klasse zuweisen: Modell, Gruppe an den Pfad des Knotens, Klasse an den Knoten — und ob sie danach pflegbar ist
  async function assign(nodeId, cls, { withFeatures = true } = {}) {
    return adopt(await api.post('/api/classification/assign', { node: nodeId, class: cls.code, system: system(), classes: classesToSend(cls), features: withFeatures ? (idx => cls.features.map(f => featureSpec(f, idx)))(merkmalIndex()) : [] }))
  }
  // Attributsicht je Klasse: ein Reiter am Knoten mit genau den
  // Attributen dieser Klasse, in der Reihenfolge der Klasse — je Rolle eine Sicht (eine Sicht gilt für einen Knotentyp).
  // Die Sicht wird bei jeder Zuweisung neu geschrieben; zugeordnete Attribute stehen in ihrer eigenen Gruppe.
  const viewKeyOf = (code, role) => `etim_${code.toLowerCase()}_${role}`
  /// Die Gruppen und Attribute einer Klasse in Klassenreihenfolge — die Form einer Attributsicht, aber nur im Arbeitsspeicher.
  function viewItems(cls) {
    if (!cls) return []
    const defs = new Map((model().attributes ?? []).map(a => [a.key, a]))
    const keys = cls.features.map(f => mapEntry(cache.map, f.code).key).filter(k => defs.has(k))
    const byGroup = new Map()
    for (const k of [cache.settings.classAttr, ...keys]) { const g = defs.get(k)?.group; if (!g) continue; if (!byGroup.has(g)) byGroup.set(g, []); if (!byGroup.get(g).includes(k)) byGroup.get(g).push(k) }
    return [...byGroup].map(([group, order]) => ({ group, order }))
  }
  /// Alte, fest angelegte Klassensichten wegräumen — im Modell stehen nur Sichten, die der Anwender anlegt.
  async function dropOldViews() {
    const mine = (model().views ?? []).filter(v => /^etim_ec\d{6}_(group|product|variant)$/.test(v.key) && String(L(v.label) ?? '').startsWith('⌗ '))
    for (const v of mine) await api.del(`/api/model/views/${encodeURIComponent(v.key)}`).catch(() => {})
    return mine.length
  }
  return { system, ensureGroup, ensureClassAttr, createFeature, createFeatures, assign, hasAttr, viewItems, dropOldViews, viewKeyOf }
}
/// Alle ETIM-Attribute der übernommenen Klassen, je Code einmal (Werte vereinigt), mit den Klassen, in denen es vorkommt
function allFeatures() {
  const feats = new Map()
  for (const c of usedClasses()) for (const f of c.features) { if (!feats.has(f.code)) feats.set(f.code, { ...f, values: [...f.values], classes: [c] }); else { const have = feats.get(f.code); have.classes.push(c); for (const v of f.values) if (!have.values.some(x => x.code === v.code)) have.values.push(v) } }
  return feats
}

/// Katalog für die Datenanalyse (ctx.compliance, wie DPP/PPWR): Datenpunkte = Klasse + alle ETIM-Attribute der übernommenen Klassen; ein ETIM-Attribut gilt an einem Knoten nur, wenn
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
    values: f.type === t_('Alphanumeric') ? f.values.map(v => nameOf(v.name, locale)) : null,
    synonyms: [f.code, ...Object.values(f.name)],
    to: ops.hasAttr(attrKeyOf(f.code)) ? attrKeyOf(f.code) : '',   // fest: das ETIM-Attribut (oder die Zuordnung aus 4) — nie nach Namen raten
    hint: t_('{0} · {1}{2} · in {3} Klasse{4}: {5}{6}', [f.code, f.type, f.type === t_('Range') ? ' (von - bis)' : '', f.classes.length, f.classes.length === 1 ? '' : 'n', f.classes.slice(0, 3).map(c => c.code).join(', '), f.classes.length > 3 ? ' …' : '']),
    appliesIf: (r, mapping) => { const c = classOf(r, mapping); return !!c && c.features.some(x => x.code === f.code) },
    rule: v => resolveValue(f, v) === null ? t_('passt nicht zu {0}{1}', [f.type, f.type === t_('Alphanumeric') ? ' — erlaubt: ' + f.values.slice(0, 5).map(x => nameOf(x.name, locale)).join(', ') + (f.values.length > 5 ? ' …' : '') : '']) : null,
    feature: f,
  }))
  const n = cache.classes.size
  return {
    key: 'etim', label: 'ETIM-Attribute', icon: '⌗', source: 'https://etim.de/daten/downloads/', sourceLabel: 'etim.de ↗',
    autoCreate: true,   // Attribute der ETIM-Attribute und die Gruppe entstehen beim Prüfen von selbst — der Anwender wählt die Klasse und füllt
    description: n ? t_('{0} Klasse{1} übernommen (⇪ Export → ⌗ ETIM) mit {2} ETIM-Attributen. Ein ETIM-Attribut zählt an einem Knoten nur, wenn seine Klasse es hat; Knoten ohne Klasse bleiben aussen vor. Fehlende Attribute legt der Katalog als ef… mit Werteliste und Einheit an.', [n, n === 1 ? '' : 'n', feats.length]) : t_('Noch keine Klasse übernommen — erst unter ⇪ Export → ⌗ ETIM eine Freigabe lesen und Klassen übernehmen.'),
    groupKey: groupKey(), groupLabel: 'ETIM', prefix: '',
    groups: [
      { key: 'class', label: t_('Klasse'), items: [{ key: classKey, label: 'ETIM-Klasse', level: 'must', type: 'enum', to: ops.hasAttr(classKey) ? classKey : '', synonyms: ['etim', 'etim_class', t_('etim klasse'), t_('etim class')], values: [...cache.classes.values()].map(c => `${c.code} ${nameOf(c.name, locale)}`), hint: t_('EC-Code der Klasse — ohne Klasse gilt kein ETIM-Attribut; die KI schlägt eine der übernommenen Klassen vor'), rule: v => cache.classes.has(String(v).trim().toUpperCase()) ? null : t_('Klasse {0} nicht übernommen', [v]) }] },
      { key: 'features', label: 'ETIM-Attribute', items },
    ],
    createAttribute: async it => it.key === classKey ? ops.ensureClassAttr() : it.feature ? ops.createFeature(it.feature) : null,
    // Erster Schritt je Knoten: die Klasse sagt, welche ETIM-Attribute erforderlich sind — ohne Klasse steht hier „zuweisen“
    rowNote: (n, mapping, c) => {
      const key = mapping?.[classKey]?.to || classKey; const code = String(n.raw?.[key] ?? '').trim().toUpperCase(); const cls = cache.classes.get(code)
      if (cls) return t_('{0} · {1} ETIM-Attribute', [code, cls.features.length])
      if (n.states[classKey] === 'inactive') return ''   // Gruppe fehlt — der ⊘-Knopf oben löst es
      if (n.leaf || n.row.role !== 'group') { const b = document.createElement('button'); b.dataset.demo = 'aus'; b.className = 'x'; b.textContent = t_('⌗ Klasse zuweisen …'); b.title = t_('ETIM-Klasse für diesen Knoten wählen — sie bestimmt die erforderlichen ETIM-Attribute'); b.addEventListener('click', () => classDialog(n.row.id, c)); return b }
      return ''
    },
    // ohne Klasse: das Wesentliche zuerst — der Knopf zum Dialog, bei einem Knoten direkt dafür
    summary: (r, mapping, c) => { const noClass = r.nodes.filter(n => n.leaf && n.states[classKey] === 'empty'); if (!noClass.length) return null; const b = document.createElement('button'); b.dataset.demo = 'aus'; b.className = 'primary'; b.textContent = t_('⌗ Klasse zuweisen …'); b.addEventListener('click', () => classDialog(noClass.length === 1 ? noClass[0].row.id : r.nodes[0].row.id, c)); const w = document.createElement('span'); w.append(t_('⌗ {0} Knoten ohne ETIM-Klasse — sie bestimmt die ETIM-Attribute', [noClass.length]) + ' ', b); return w },
  }
}

/// ETIM-Attribute eines Knotens für xport (env.featuresOf) — pctx ist der Produktkontext von xport
/// rules (BMEcat-Profil): { unknownAs, requireClass, minCompleteness, strict } — überschreiben die Voreinstellung
export async function etimFeatures(pctx, rules = null) { await cache.loaded; return featuresOf(pctx, { ...cfg(pctx.locale), ...(rules ?? {}), version: cache.version, getClass: async code => cache.classes.get(code) ?? null }) }

/// Sperre für xport: ein Knoten, der die Analyse nicht besteht, wird nicht exportiert
export async function etimGate(pctx, rules = null) { await cache.loaded; return gate(pctx, { ...cfg(pctx.locale), ...(rules ?? {}), version: cache.version, getClass: async code => cache.classes.get(code) ?? null }) }

/// Prüfregeln für ✓ Datenqualität

// ── Der Assistent am Knoten. Ein Fenster, drei Fälle: keine Bibliothek → holen; Klasse da → zeigen, ändern; keine → wählen (✦ Vorschlag,
// Umfeld, Suche, Gruppen). ⇢ schreibt die Klasse (Gruppe kommt automatisch), danach die Prüfung mit den ETIM-Attributen der Klasse.
async function classDialog(nodeId, ctx, onDone = null) {
  const { api, store, tree } = ctx
  await cache.loaded; if (!tree.loaded) await tree.load()
  await ensurePool()   // suchen und durchsehen braucht die ganze Freigabe
  const model = () => store.model
  const locale = model().masterLocale ?? 'de'
  const row = tree.byId.get(nodeId); if (!row) return
  const ops = modelOps(ctx)
  const path = tree.ancestors(nodeId).map(a => a.label)
  const key = cache.settings.classAttr
  const gname = c => c.group ? (nameOf(c.group.name, locale) || c.group.code) : '—'
  const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:40' })
  const box = el('div', { style: 'width:min(820px,94vw);max-height:88vh;display:flex;flex-direction:column;background:var(--pane);border:1px solid var(--line);border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.4);font-size:13px' })
  const head = el('div', { class: 'toolbar', style: 'padding:8px 12px' }, el('b', {}, t_('⌗ ETIM-Klasse · {0} {1}', [ICON[row.role] ?? '', row.label])), el('span', { class: 'muted', style: 'font-size:12px' }, path.join(' › ')), el('span', { class: 'grow' }), el('button', { class: 'x', title: 'schliessen (Esc)', onclick: () => close() }, '✕'))
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
  // Zone „Ziel“: hier oder an der Gruppe darüber — eine Entscheidung, die im Dialog bleibt (kein Sprung in einen anderen Dialog)
  const parentRow = row.parent ? tree.byId.get(row.parent) : null
  const canUp = !!parentRow && parentRow.role === 'group'
  let target = nodeId
  // Die Kette vom obersten Knoten bis hierher — je Ebene: Produkte darunter,
  // Untergruppen, wie viele schon eine eigene Klasse haben; empfohlen ist die höchste Ebene ohne Untergruppen und ohne Widerspruch.
  const chain = [...tree.ancestors(nodeId), row]
  const belowOf = id => { const out = []; const walk = x => { for (const k of tree.kids(x)) { if (k.role !== 'group') out.push(k); walk(k.id) } }; walk(id); return out }
  const levelInfo = chain.map(n => {
    const below = n.id === nodeId && row.role !== 'group' ? [row, ...belowOf(n.id)] : belowOf(n.id)
    const own = below.filter(x => klasseVon(x.id)?.own).length
    return { node: n, products: below.length, groups: tree.kids(n.id).filter(k => k.role === 'group').length, own }
  })
  let rec = levelInfo.length - 1
  for (let k = 0; k < levelInfo.length; k++) if (levelInfo[k].products > 0 && levelInfo[k].groups === 0 && levelInfo[k].own === 0) { rec = k; break }
  target = levelInfo[rec].node.id

  // Schritt 2: nur noch zeigen, was passiert, und zuweisen — das Ziel wurde oben gewählt
  async function assign(code) {
    if (!cache.classes.has(code)) {
      say(t_('hole {0} aus ETIM {1} …', [code, cache.version]))
      try { if ((await holeKlassen([code])).length) { say(t_('{0} gibt es in ETIM {1} nicht', [code, cache.version])); return } } catch (e) { say('✗ ' + e.message); return }
      say('')
    }
    const c = cache.classes.get(code); if (!c) return
    const at = tree.byId.get(target) ?? row
    const missing = c.features.filter(f => !ops.hasAttr(attrKeyOf(f.code)))
    const under = (() => { const out = []; const walk = x => { for (const k of tree.kids(x)) { if (k.role !== 'group') out.push(k); walk(k.id) } }; walk(at.id); return out })()
    const others = under.filter(n => { const v = klasseVon(n.id); return v && v.code !== code && v.own }).length
    body.innerHTML = ''
    body.append(
      el('div', { style: 'font-size:14px;margin:6px 0' }, el('b', {}, `${code} ${nameOf(c.name, locale)}`), ` → ${ICON[at.role] ?? ''} ${at.label}`),
      el('div', { class: 'muted', style: 'margin-bottom:8px' },
        at.role === 'group'
          ? t_('Die Klasse wird an dieser Gruppe gesetzt und vererbt sich nach unten: die {0} ETIM-Attribute gelten dann an {1} Produkten und Varianten darunter.', [c.features.length, under.length])
          : t_('Die Klasse wird an diesem Knoten gesetzt: die {0} ETIM-Attribute gelten dann hier{1}.', [c.features.length, under.length ? ' ' + t_('und an {0} Varianten darunter', [under.length]) : '']),
        missing.length ? ' ' + t_('{0} davon werden als Attribute angelegt (Gruppe {1}).', [missing.length, classGroupKey(code)]) : ' ' + t_('Alle haben schon ein Attribut im Modell.')),
      others ? el('div', { class: 'warn', style: 'font-size:12px;margin-bottom:8px' }, t_('{0} Knoten darunter haben eine eigene Klasse — die behalten sie.', [others])) : '',
      el('div', { class: 'scroll', style: 'max-height:40vh;border:1px solid var(--line);border-radius:4px;padding:4px 8px;font-size:12px' },
        ...c.features.map(f => el('div', {}, el('span', { class: 'mono muted' }, f.code), ' ', featureText(f, locale), el('span', { class: 'muted' }, ` · ${TYPE[f.type] ?? f.type}${ops.hasAttr(attrKeyOf(f.code)) ? '' : ' · neu'}`)))),
      el('div', { class: 'chips', style: 'margin-top:10px' },
        el('button', { 'data-demo': 'aus', class: 'primary', onclick: () => doAssign(code, at.id) }, '✓ zuweisen'),
        el('button', { onclick: () => draw() }, 'abbrechen')))
  }
  async function doAssign(code, atId = nodeId) {
    const c = cache.classes.get(code); const at = tree.byId.get(atId) ?? row
    await run(t_('weise {0} zu …', [code]), async () => {
      // Jede Zuweisung stellt sicher, dass die Klasse danach pflegbar ist: Gruppe da und am Pfad, Klassenattribut,
      // je ETIM-Attribut ein Attribut im Modell — das macht der Server in einem Aufruf und sagt, ob danach alles da ist.
      const r = await ops.assign(atId, c)
      await store.poll(true)
      if (r.groupAttached) say(t_('Gruppe {0} angehängt …', [r.group]))
      cache.used.add(code); if (atId !== nodeId) store.toast(`✓ ${code} ab ${at.label}`, 'ok')
      loadUsed()   // Klassen je Knoten für Baummenü und Band
      await tree.load()
      const rd = r.readiness
      say('')
      store.toast(rd.ready
        ? `✓ ${code} an ${at.label} · ${c.features.length} Attribute${r.attributes ? ` · ${r.attributes} neu` : ''}`
        : `⚠ ${code} an ${at.label} · ${!rd.groupExists ? `Gruppe ${r.classGroup} fehlt` : !rd.groupOn ? `Gruppe ${r.classGroup} gilt hier nicht` : `${rd.missing.length} ohne Attribut`}`, rd.ready ? 'ok' : 'error')
      checkStep(code)
    })
  }

  // Schritt 3: keine eigene Tabelle mehr — nach dem Zuweisen
  // geht es in die ETIM-Übersicht des Knotens (Klasse → Attribute → Daten → Ausleitung); bearbeitet wird in der Subitems-Tabelle
  function checkStep(code) { close(); onDone ? onDone(code) : ctx.go?.(`/tree/${encodeURIComponent(nodeId)}`) }
  const line = (code, why) => { const c = cache.classes.get(code) ?? cache.liste.get(code); return el('div', { class: 'pick', style: 'display:flex;gap:8px;align-items:center', title: [c && code !== current ? t_('{0} {1} wählen', [code, nameOf(c.name, locale)]) : '', why].filter(Boolean).join('\n'), onclick: () => { if (c && code !== current) assign(code) } }, el('span', { class: 'mono muted' }, code), el('span', { class: 'grow' }, c ? nameOf(c.name, locale) : el('i', { class: 'muted' }, t_('nicht in der Bibliothek')), c ? el('span', { class: 'muted', style: 'font-size:11px' }, ' ' + t_('· {0} ETIM-Attribute', [featureCount(c)])) : null, why ? el('span', { class: 'muted', style: 'font-size:11px' }, `  (${why})`) : null), c && code !== current ? el('button', { class: 'primary', onclick: () => assign(code) }, '⇢ zuweisen') : null) }

  // Version im Dialog wechseln: die Auswahl gilt
  // ab sofort für Zuweisen, Prüfen und Export (release im Journal) — die Liste der Klassen darunter wird neu gelesen
  function versionBar() {
    if (cache.versions.length < 2 && cache.version) return el('span', { class: 'muted', style: 'font-size:12px' }, t_('ETIM {0} · {1} Klassen', [cache.version, cache.release?.classes ?? cache.liste.size]))
    const sel = el('select', { title: t_('ETIM-Version — gilt für Zuweisen, Prüfen und Export'), onchange: async e => {
      const v = cache.versions.find(x => x.version === e.target.value); if (!v) return
      say(t_('wechsle auf ETIM {0} …', [v.version]))
      try { await ctx.data.set('release', v); await loadCache(); await ops.ensureClassAttr(); await store.poll(true); say(''); draw() } catch (err) { say('✗ ' + err.message) }
    } }, ...cache.versions.map(v => el('option', { value: v.version }, t_('ETIM {0}{1} · {2} Klassen', [v.version, v.name ? ' · ' + v.name : '', v.classes ?? '?']))))
    sel.value = cache.version ?? ''
    return el('span', { style: 'display:inline-flex;gap:6px;align-items:center' }, el('span', { class: 'muted', style: 'font-size:12px' }, t_('Version')), sel,
      el('button', { class: 'x', title: t_('Versionen verwalten: holen, Datei lesen, wechseln (⌗ ETIM)'), onclick: () => { close(); ctx.go?.('/p/etim/etim') } }, '⌗ ETIM …'))
  }
  function draw() {
    body.innerHTML = ''
    const P = suchliste()
    // Fall 1: keine Freigabe — holen heisst: die Freigabe merken (mit URL) und ihre Suchliste lesen; ins Journal kommt erst die zugewiesene Klasse
    if (cache.releaseKey == null) {
      body.append(el('div', { class: 'empty' }, t_('Keine ETIM-Version im Journal.')),
        el('div', { class: 'chips' }, el('button', { 'data-demo': 'aus', class: 'primary', onclick: () => run(t_('hole Liste …'), async () => {
          const j = await etimLauf({ mode: 'list' }); const best = j?.releases?.[0]; if (!best) throw new Error(t_('keine Liste von etim-international.com'))
          const t0 = Date.now(); const tick = setInterval(() => say(t_('lese {0} … {1} s', [best.name, Math.round((Date.now() - t0) / 1000)])), 1000)
          let j2; try { j2 = await etimLauf({ mode: 'index', url: best.url, langs: sprachen() }) } finally { clearInterval(tick) }
          await loadCache(); for (const c of j2.liste ?? []) cache.liste.set(c.code, c); cache.pool = true
          await store.poll(true); await ops.ensureClassAttr(); await store.poll(true); say(''); draw()
        }) }, t_('⇩ ETIM (neueste, alle Sektoren) holen')), el('span', { class: 'muted' }, t_('von etim-international.com — öffentlich, englische Namen; oder ⇪ Export → ⌗ ETIM: Datei'))))
      return
    }
    if (!P.length && cache.poolError) body.append(el('div', { class: 'neg', style: 'font-size:12px;margin-bottom:6px' }, t_('✗ ETIM {0} nicht gelesen: {1}', [cache.version, cache.poolError])))
    body.append(el('div', { class: 'chips', style: 'margin-bottom:8px' }, versionBar()))
    // Stand
    // Zustand in einer Zeile, dann die Zielwahl — keine Kästen
    body.append(current
      ? el('div', { style: 'display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;margin-bottom:6px' },
          el('span', { class: 'pos', style: 'font-weight:600' }, '✓'), el('span', { class: 'mono', style: 'font-weight:600' }, current),
          el('span', {}, nameOf(cache.classes.get(current)?.name, locale) || ''),
          el('span', { class: 'muted', style: 'font-size:12px' }, ownCode ? t_('an diesem Knoten') : t_('geerbt von {0}', [inherited.from])),
          el('span', { class: 'muted', style: 'font-size:12px' }, t_('· {0} ETIM-Attribute', [cache.classes.get(current)?.features.length ?? '?'])),
          el('span', { class: 'grow' }),
          ownCode ? el('button', { 'data-demo': 'aus', class: 'x', title: t_('die Klasse an diesem Knoten entfernen'), onclick: async () => { try { await api.post(`/api/nodes/${encodeURIComponent(nodeId)}/attributes`, { attribute: key, locale: null, channel: null, value: '', row: null }); await store.poll(true); loadUsed(); store.toast(t_('✓ Klasse entfernt'), 'ok'); close(); onDone?.(null) } catch (e) { store.toast(e.message) } } }, '✕ entfernen') : null)
      : el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:6px' }, t_('Noch keine ETIM-Klasse an diesem Knoten.')))
    // 1 · Ziel: irgendein Knoten des Pfads — je Chip die Zahlen, ✦ ist die Empfehlung
    {
      const chips = levelInfo.map((l, k) => el('button', {
        class: target === l.node.id ? 'primary' : '',
        title: t_('{0} Produkt{1}/Varianten darunter{2}{3}{4}', [l.products, l.products === 1 ? '' : 'e', l.groups ? ' ' + t_('· {0} Untergruppen', [l.groups]) : '', l.own ? ' ' + t_('· {0} mit eigener Klasse', [l.own]) : '', k === rec ? ' ' + t_('· Empfehlung: die höchste Ebene ohne Untergruppen und ohne Widerspruch') : '']),
        onclick: () => { target = l.node.id; draw() },
      }, `${ICON[l.node.role] ?? ''} ${l.node.label}`, el('span', { class: 'muted', style: 'font-size:11px' }, ` ${l.products}`), l.own ? el('span', { class: 'warn', style: 'font-size:11px' }, ` ≠${l.own}`) : null, k === rec ? el('span', { class: 'ai', style: 'font-size:11px' }, ' ✦') : null))
      const cur = levelInfo.find(l => l.node.id === target)
      body.append(el('div', { class: 'chips', style: 'margin-bottom:4px' }, el('span', { class: 'muted', style: 'font-size:12px' }, t_('Klasse setzen an')), ...chips),
        el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:6px' }, cur ? t_('Die Klasse gilt dann für {0} Produkte und Varianten unter {1}{2}.', [cur.products, cur.node.label, cur.own ? ' ' + t_('— {0} davon haben eine eigene Klasse und behalten sie', [cur.own]) : '']) : ''))
    }

    // ✦ Vorschlag (KI, wenn da)
    const ai = ctx.ai; const suggest = el('div', { style: 'margin:4px 0' })
    // KI nur auf Knopfdruck — jede Anfrage kostet Token; Ergebnisse stehen in Magenta
    const aiBtn = ai?.available()
      ? el('button', { class: 'x ai', title: t_('die KI nach passenden Klassen fragen ({0}) — kostet Token', [ai.label()]), onclick: () => askAiNow() }, t_('✦ KI fragen'))
      : el('span', { class: 'muted', style: 'font-size:12px' }, t_('✦ KI-Vorschläge brauchen einen Schlüssel (⚙ Einstellungen)'))
    async function askAiNow() {
      suggest.innerHTML = ''; suggest.append(el('span', { class: 'ai' }, '✦ …'))
      try {
        try {
          const groupsAll = [...new Set(P.map(gname))].sort()
          const g = await ai.ask({ system: t_('Du ordnest Produkte ETIM-Klassengruppen zu. Antworte nur als JSON {"groups":["…","…"]} mit 1 bis 3 Namen exakt aus der Liste.'), user: `Produkt: ${row.label}\nPfad: ${path.join(' › ')}\nGruppen:\n${groupsAll.join('\n')}`, json: true, maxTokens: 200, purpose: t_('Klassifikation') })
          const picked = (g.groups ?? []).filter(x => groupsAll.includes(x)); if (!picked.length) throw new Error(t_('keine Gruppe erkannt'))
          const cands = P.filter(c => picked.includes(gname(c)))
          const list = cands.map(c => `${c.code} ${nameOf(c.name, locale)}${Object.values(c.synonyms ?? {}).flat().length ? ' (' + Object.values(c.synonyms ?? {}).flat().slice(0, 4).join(', ') + ')' : ''}`).join('\n')
          const j = await ai.ask({ system: t_('Du ordnest ein Produkt genau einer ETIM-Klasse zu. Antworte nur als JSON {"suggestions":[{"code":"EC…","why":"…"}]} mit 1 bis 3 Vorschlägen, Codes exakt aus der Liste, bester zuerst, why in einem kurzen Satz auf Deutsch.'), user: `Produkt: ${row.label}\nPfad: ${path.join(' › ')}\nKlassen:\n${list}`, json: true, maxTokens: 400, purpose: t_('Klassifikation') })
          suggest.innerHTML = ''; suggest.append(el('div', { class: 'ai', style: 'font-size:12px' }, `✦ KI (${ai.label()}) — ${picked.join(', ')}`))
          const out = (j.suggestions ?? []).filter(s => cands.some(c => c.code === String(s.code).toUpperCase())).filter(s => String(s.code).toUpperCase() !== current)
          if (!out.length) suggest.append(el('div', { class: 'muted' }, t_('kein Vorschlag')))
          for (const s of out) { const r = line(String(s.code).toUpperCase(), s.why ?? ''); r.className = 'pick ai'; suggest.append(r) }
        } catch (e) { suggest.innerHTML = ''; suggest.append(el('span', { class: 'neg' }, '✗ ' + e.message)) }
      } catch (e) { suggest.innerHTML = ''; suggest.append(el('span', { class: 'neg' }, '✗ ' + e.message)) }
    }
    body.append(el('div', { class: 'step-band', style: 'margin:6px 0 2px;display:flex;gap:8px;align-items:center', title: t_('aus dem Bestand — eine Zeile anklicken übernimmt die Klasse') }, t_('Empfehlung'), el('span', { class: 'grow' }), aiBtn), suggest)
    // Umfeld: Klassen an Geschwistern und darunter
    const env = el('div', { style: 'font-size:12px;margin:0 0 4px' }, el('span', { class: 'muted' }, t_('lese den Bestand …'))); body.append(env)
    ;(async () => {
      try {
        const counts = new Map(); const add = (c, why) => { if (!c) return; const k = String(c).toUpperCase(); if (!counts.has(k)) counts.set(k, new Map()); counts.get(k).set(why, (counts.get(k).get(why) ?? 0) + 1) }
        if (row.parent) { const t = await api.get(`/api/nodes/${encodeURIComponent(row.parent)}/table?attributes=${key}`); for (const r of t.rows) if (r.row.id !== row.id) add(r.values[key]?.value, t_('Geschwister')) }
        const below = await api.get(`/api/nodes/${encodeURIComponent(row.id)}/table?deep=true&attributes=${key}`); for (const r of below.rows) add(r.values[key]?.value, 'darunter')
        env.innerHTML = ''
        if (!counts.size) { env.innerHTML = ''; env.append(el('span', { class: 'muted' }, t_('Im Umfeld ist noch keine Klasse gesetzt: weder an Geschwistern noch im Teilbaum.'))); return }
        // was hier schon gilt, ist kein Vorschlag
        const rows = [...counts].filter(([c]) => c !== current).sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0))
        if (!rows.length) { env.append(el('span', { class: 'muted' }, t_('Im Umfeld steht keine andere Klasse — unten suchen oder blättern.'))); return }
        for (const [c, whys] of rows) env.append(line(c, [...whys].map(([w, n]) => whyText(w, n)).join(' · ')))
      } catch (e) { env.textContent = t_('Umfeld:') + ' ' + e.message }
    })()
    // Suche und Gruppen
    const hits = el('div'); let grp = null
    const q = el('input', { placeholder: t_('suchen in {0} Klassen — Code, Name, Synonym', [P.length]), style: 'width:100%;margin:6px 0', oninput: () => search() })
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
      if (!found.length) hits.append(el('div', { class: 'muted', style: 'padding:4px' }, t_('nichts gefunden')))
    }
    body.append(q, hits); browse()
    setTimeout(() => q.focus(), 0)
  }
  draw()
}
const jsonOfOut = out => { for (const line of String(out ?? '').split('\n')) { const s = line.trim(); if (s.startsWith('{')) { try { return JSON.parse(s) } catch { } } } return null }

const checks = [
  { key: 'etim', label: t_('⌗ ETIM: Klasse und ETIM-Attribute'), severity: 'warn', run({ values, columns, locale }) { return checkNode({ values, columns, classes: cache.classes, cfg: cfg(locale) }) } },
]

// ── Das Band ⌗ ETIM in der Knotenansicht: eine Zeile — Klasse (eigen/geerbt,
// ≠ abweichende darunter) · Attribute n von m (zugeordnet, ƒ, fehlend) · Daten % gefüllt (leer, passen nicht) — und die Knöpfe, die
// ins vorhandene Werkzeug springen: Zuweisen-Dialog, Zuordnung (auf die Klasse gefiltert), Subitems-Tabelle mit den Spalten der Klasse,
// Prüfung (Befunde im Körper). Gilt an Gruppe, Produkt, Variante; die Zahlen zählen den Knoten und alles darunter mit dieser Klasse.
async function stageData(ctx, nodeId, locale = 'de') {
  const { api, tree } = ctx; const ops = modelOps(ctx); const hasAttr = ops.hasAttr
  const key = cache.settings.classAttr; const row = tree.byId.get(nodeId); if (!row) return null
  const at = hasAttr(key) ? await classAt(api, key, nodeId) : { ownCode: '', inherited: null, current: null, node: null }
  // Zwei Gruppen müssen hier gelten: die des Systems (sie trägt das Klassenattribut) und die der Klasse (ihre Attribute)
  const on = k => (at.node?.groups ?? []).some(g => g.key === k && g.active !== false)
  const exists = k => (ctx.store.model?.groups ?? []).some(g => g.key === k)
  const todo = [groupKey(), ...(at.current ? [classGroupKey(at.current)] : [])].filter(k => !on(k))   // was hier noch nicht gilt
  const groupOn = todo.length === 0, groupExists = todo.every(exists), fehlt = todo.filter(k => !exists(k))
  const cls = at.current ? cache.classes.get(at.current) ?? null : null
  const stage = { row, ...at, groupOn, groupExists, todo, fehlt, cls, feats: [], products: [], other: 0, filled: 0, cells: 0, bad: 0, empty: 0, keys: [], tbl: null, byClass: [] }
  if (!cls) return stage
  // Merkmale der Klasse am Knoten und aller Klassen im Teilbaum
  const featsOf = c => c.features.map(f => { const k = attrKeyOf(f.code); return { f, key: k, has: hasAttr(k), own: k === f.code.toLowerCase(), steps: stepsOf(f.code) } })
  stage.feats = featsOf(cls)
  // 1. welche Klassen kommen darunter vor? 2. dann eine Tabelle mit den Attributen aller dieser Klassen
  const seen = await api.get(`/api/nodes/${encodeURIComponent(nodeId)}/table?deep=true&attributes=${encodeURIComponent(key)}`)
  const codes = new Set([at.current, ...(seen.rows ?? []).map(r => String(r.values?.[key]?.value ?? '').toUpperCase()).filter(c => /^EC\d{6}$/.test(c))])
  const featsByCode = new Map(); for (const c of codes) { const cc = cache.classes.get(c); if (cc) featsByCode.set(c, featsOf(cc)) }
  const keys = [...new Set([key, ...[...featsByCode.values()].flat().filter(x => x.has).map(x => x.key)])]
  // Die Merkmale aller Klassen im Teilbaum: oft hunderte Spalten — darum als POST (Spalten im Rumpf, die Adresse wäre zu lang) und seitenweise
  // (sonst über die Grenze des Servers von 1 Mio. Zellen, 04.10.2026)
  const tabelle = (extra, skip) => api.post(`/api/nodes/${encodeURIComponent(nodeId)}/table`, { attributes: keys, ...extra, take: 1000, skip })
  const tbl = { rows: [], columns: [] }
  for (let skip = 0; skip != null;) { const t = await tabelle({ deep: true }, skip); tbl.columns = t.columns ?? tbl.columns; tbl.rows.push(...(t.rows ?? [])); skip = t.next != null && t.next > skip ? t.next : null }
  let rows = tbl.rows.filter(r => r.row.role !== 'group')
  if (row.role !== 'group') { const me = await tabelle({ self: true, children: false }, 0).catch(() => null); const mine = me?.rows?.find(r => r.row.id === nodeId); if (mine) rows = [mine, ...rows.filter(r => r.row.id !== nodeId)] }
  stage.other = rows.filter(r => { const v = String(r.values?.[key]?.value ?? '').toUpperCase(); return v && v !== at.current }).length
  stage.products = rows.filter(r => String(r.values?.[key]?.value ?? '').toUpperCase() === at.current)
  // Zahlen und Befunde aus einer Rechnung (core: audit) — die Tabelle je Klasse und die Liste der Befunde belegen dieselben Zahlen
  const a = audit({ rows, classAttr: key, classes: cache.classes, map: mergedMap(), locale, hasAttr, complete: true })   // jeder Knoten eine Zeile, auch die vollständigen
  stage.byClass = a.byClass; stage.sum = a.sum; stage.findings = a.findings
  const mine = a.byClass.find(c => c.code === at.current)
  if (mine) { stage.filled = mine.filled; stage.cells = mine.cells; stage.bad = mine.bad; stage.empty = mine.cells - mine.filled - mine.bad }
  stage.keys = keys; stage.tbl = tbl
  return stage
}
let angemeldet = false   // einmal je Sitzung: Bestand von früher meldet sich beim ersten Band an
async function bandMount({ head, body: bodyEl }, nodeId, ctx) {
  // head: kurzer Text in der Überschrift (wie „Redaktion: Freigegeben“); line: die Zeile mit Chips und Knöpfen im Körper; darunter die Befunde
  const line = el('div', { class: 'row' }); const table = el('div'); const found = el('div'); bodyEl.append(line, table, found)
  const { api, store, tree } = ctx
  await cache.loaded; if (!tree.loaded) await tree.load()
  ctx.touch?.()   // die Klassen stehen — die Abschnitte der Knotenansicht neu rechnen
  const locale = store.model?.masterLocale ?? 'de'; const ops = modelOps(ctx)
  if (!angemeldet) { angemeldet = true; api.post('/api/classification/register', { system: ops.system() }).catch(() => {}) }
  let gone = false
  const chip = (text, cls = '', title = '') => el('span', { class: 'chip ' + cls, title }, text)
  const viewsDone = new Set()   // je Klasse einmal prüfen, nicht bei jedem Zeichnen
  async function render() {
    if (gone) return
    head.textContent = ''; line.innerHTML = ''; table.innerHTML = ''; found.innerHTML = ''
    if (cache.releaseKey == null) { head.textContent = t_('· keine ETIM-Version im Journal'); line.append(el('button', { class: 'x', onclick: () => ctx.go?.('/p/etim/etim') }, t_('⇩ ETIM holen …'))); return }
    head.textContent = '· …'
    let S; try { S = await stageData(ctx, nodeId, locale) } catch (e) { head.textContent = '· ✗ ' + e.message; return }
    if (gone || !S) return
    // Klassensichten früherer Versionen einmal wegräumen: die Sicht ist jetzt flüchtig (früher nodeViews), im Modell hat sie nichts verloren
    if (!viewsDone.has('cleanup') && store.can?.('model') !== false && (store.model?.views ?? []).some(v => /^etim_ec\d{6}_/.test(v.key))) {
      viewsDone.add('cleanup')
      try { const n = await ops.dropOldViews(); if (n) { await store.poll(true); store.toast(t_('{0} feste ETIM-Sichten aufgeräumt — die Klassensicht entsteht jetzt beim Öffnen', [n]), 'ok') } } catch { /* ohne Modellrecht bleiben sie stehen */ }
      if (gone) return
    }
    head.textContent = ''
    const again = () => render()
    const assignBtn = el('button', { 'data-demo': 'aus', class: S.cls ? 'x' : 'primary', title: S.cls ? t_('andere Klasse wählen (Vorschlag, Umfeld, Suche, Ebene)') : t_('ETIM-Klasse wählen (Vorschlag, Umfeld, Suche, Ebene mit Empfehlung)'), onclick: () => classDialog(nodeId, ctx, again) }, S.cls ? t_('⌗ Klasse ändern …') : t_('⌗ Klasse zuweisen …'))
    // Klasse entfernen — nur die eigene; danach gilt die geerbte oder keine
    const clearBtn = S.ownCode ? el('button', { 'data-demo': 'aus', class: 'x', title: t_('Klasse an diesem Knoten entfernen — danach gilt die geerbte Klasse, sonst keine'), onclick: async () => {
      const ok = await (ctx.dialog?.confirm?.({ title: t_('ETIM-Klasse {0} entfernen?', [S.ownCode]), text: S.inherited ? t_('Danach gilt wieder {0} von {1}.', [S.inherited.code, S.inherited.from]) : t_('Danach hat dieser Knoten keine Klasse.'), ok: 'entfernen', danger: true }) ?? Promise.resolve(true))
      if (!ok) return
      try { await api.post('/api/classification/clear', { node: nodeId, system: ops.system() }); await store.poll(true); await tree.load?.(true); loadUsed(); store.toast(t_('✓ Klasse entfernt'), 'ok'); again() } catch (e) { store.toast(e.message) }
    } }, t_('✕ Klasse')) : null
    // Gruppe anhängen, wenn sie hier nicht gilt — sonst ist kein ETIM-Attribut verfügbar und man kommt nicht weiter
    const attachBtnEl = !S.groupOn ? el('button', { 'data-demo': 'aus', class: 'primary', title: S.groupExists ? t_('die Attributgruppe {0} an diesem Knoten anhängen — erst dann gelten die ETIM-Attribute hier und darunter', [groupKey()]) : t_('die Attributgruppe {0} gibt es im Modell nicht mehr — sie wird neu angelegt und hier angehängt; die ETIM-Attribute gehören ihr weiterhin an', [groupKey()]), onclick: async () => {
      try {
        const cg = S.current ? classGroupKey(S.current) : null
        if (!S.groupExists) {
          // gelöscht: die Gruppe des Systems legt der Server allein an; die einer Klasse entsteht mit ihrer Zuweisung — an dem Knoten, der die Klasse trägt
          if (S.todo.includes(groupKey()) && !(ctx.store.model?.groups ?? []).some(g => g.key === groupKey())) { await ops.ensureGroup(); await store.poll(true) }
          if (cg && S.todo.includes(cg) && !(ctx.store.model?.groups ?? []).some(g => g.key === cg) && S.cls) { await ops.assign(S.ownCode ? nodeId : S.inherited.id, S.cls); await store.poll(true); await tree.load?.(true); loadUsed(); again(); return }
        }
        // an DIESEN Knoten — und im selben Zug unter ihm abnehmen, wo sie schon hing: sie gilt ab hier ohnehin nach unten
        let have = (S.row.groups ?? '').split(',').filter(Boolean)
        for (const gk of S.todo) {
          have = [...new Set([...have, gk])]
          await api.post(`/api/nodes/${encodeURIComponent(nodeId)}/groups`, { groups: have }, 'PUT')
          const below = []; const walk = id => { for (const k of tree.kids(id)) { if ((k.groups ?? '').split(',').includes(gk)) below.push(k); walk(k.id) } }; walk(nodeId)
          for (const k of below) await api.post(`/api/nodes/${encodeURIComponent(k.id)}/groups`, { groups: (k.groups ?? '').split(',').filter(x => x && x !== gk) }, 'PUT')
        }
        await store.poll(true); await tree.load?.()
        store.toast(`✓ ${S.todo.join(', ')} ab ${S.row.label}`, 'ok'); again()
      } catch (e) { store.toast(e.message) }
    } }, S.groupExists ? t_('⌗ Gruppe {0} anhängen', [S.todo.join(', ')]) : t_('⌗ Gruppe {0} anlegen und anhängen', [S.todo.join(', ')])) : null
    // Bestand der früheren Bauart (eine Sammelgruppe, Attribute mit Bedingung): der Server stellt ihn auf Klassengruppen um
    const altAttr = (ctx.store.model?.attributes ?? []).filter(a => a.when?.attribute === cache.settings.classAttr).length
    const umstellBtn = altAttr ? el('button', { 'data-demo': 'aus', class: 'primary', title: t_('Die {0} Attribute kommen in die Gruppen ihrer Klassen, die Bedingung entfällt, und jeder Knoten mit einer Klasse bekommt deren Gruppe', [altAttr]), onclick: async () => {
      try {
        const r = await api.post('/api/classification/migrate', { system: ops.system(), dryRun: false })
        await store.poll(true); await tree.load?.(true); loadUsed()
        store.toast(t_('✓ {0} Gruppen, {1} Attribute, {2} Knoten umgestellt', [r.groups, r.attributes, r.nodes]), 'ok'); again()
      } catch (e) { store.toast(e.message) }
    } }, t_('⌗ auf Klassengruppen umstellen')) : null
    if (!S.cls) { head.textContent = '· ' + (S.current ? t_('{0} nicht in ETIM {1}', [S.current, cache.version ?? '?']) : t_('keine Klasse')); line.append(...[S.current ? el('span', { class: 'muted' }, t_('{0} nicht in ETIM {1}', [S.current, cache.version ?? '?'])) : null, assignBtn, clearBtn, attachBtnEl, umstellBtn].filter(Boolean)); return }   // der Text steht schon in der Überschrift
    const code = S.current
    line.append(chip(`${code} ${nameOf(S.cls.name, locale)}`, '', S.ownCode ? t_('Klasse am Knoten selbst') : t_('Klasse geerbt von {0}', [S.inherited.from])), el('span', { class: 'muted' }, S.ownCode ? 'hier' : `von ${S.inherited.from}`))
    if (S.other) line.append(chip(`≠ ${S.other}`, 'warn', t_('{0} darunter mit anderer Klasse', [S.other])))
    const has = S.feats.filter(x => x.has), miss = S.feats.filter(x => !x.has), mapped = has.filter(x => !x.own), fx = S.feats.filter(x => x.steps)
    line.append(el('span', { class: 'muted' }, '·'), chip(`zugeordnet ${has.length}/${S.feats.length}`, miss.length ? 'warn' : 'pos', t_('{0} eigene ef… · {1} zugeordnet{2}{3}', [has.length - mapped.length, mapped.length, fx.length ? ` · ${fx.length} mit ƒ` : '', miss.length ? ' ' + t_('· {0} nicht zugeordnet', [miss.length]) : ''])))
    const pct = S.cells ? Math.round(S.filled * 100 / S.cells) : 0
    head.textContent = `· ${code} ${nameOf(S.cls.name, locale)}${S.ownCode ? '' : ' (geerbt)'} · zugeordnet ${has.length}/${S.feats.length} · Daten ${S.products.length ? pct + ' %' : '—'}${S.ownCode && S.byClass.length > 1 ? ` · Teilbaum ${String(S.sum.pct).replace('.', ',')} %` : ''}${S.other ? ` · ≠ ${S.other}` : ''}`
    line.append(el('span', { class: 'muted' }, '·'), chip(S.products.length ? t_('Daten {0} %', [pct]) : t_('Daten —'), S.bad ? 'neg' : pct >= 80 ? 'pos' : '', t_('{0} Produkte/Varianten × {1} ETIM-Attribute: {2} gefüllt · {3} leer{4}', [S.products.length, has.length, S.filled, S.empty, S.bad ? ' ' + t_('· {0} passen nicht', [S.bad]) : ''])))
    // Knöpfe direkt hinter den Chips, nicht rechtsbündig
    if (!S.groupOn) line.append(chip(S.groupExists ? t_('⚠ Gruppe {0} gilt hier nicht', [S.todo.join(', ')]) : t_('⚠ Gruppe {0} fehlt im Modell', [S.fehlt.join(', ')]), 'warn', t_('die Attributgruppe {0} hängt an keinem Knoten des Pfads — deshalb gilt kein ETIM-Attribut an diesem Knoten; „Gruppe anhängen“ behebt es', [S.todo.join(', ')])))
    line.append(...[el('span', { class: 'muted' }, '·'), assignBtn, clearBtn, attachBtnEl, umstellBtn,
      el('button', { class: miss.length ? 'primary' : 'x', title: t_('Zuordnung der ETIM-Attribute dieser Klasse: vorhandenes Attribut, ƒ Umwandlung, oder eigenes anlegen (⌗ ETIM)'), onclick: () => ctx.go?.(`/p/etim/etim?class=${code}&node=${encodeURIComponent(nodeId)}`) }, '⇄ zuordnen …'),
      miss.length ? el('button', { class: 'x', title: t_('{0} fehlende ETIM-Attribute als eigene Attribute ef… anlegen (Gruppe {1}, nur an Produkt und Variante)', [miss.length, classGroupKey(code)]), onclick: async () => { try { await ops.createFeatures(miss.map(x => x.f), [S.cls]); await store.poll(true); store.toast(t_('✓ {0} Attribute angelegt', [miss.length]), 'ok'); again() } catch (e) { store.toast(e.message) } } }, `＋ ${miss.length} anlegen`) : null,
      S.products.length ? el('button', { class: 'x', title: t_('Subitems-Tabelle im eigenen Fenster — nur die Spalten dieser Klasse; Bedienung wie Excel'), onclick: () => openTable(tree, nodeId, S.keys, S.products.some(r => r.row.role === 'product') ? 'product' : 'variant') }, t_('⊞ Tabelle')) : null,
    ].filter(Boolean))
    // Befunde je Knoten — immer sichtbar, mit Sprungziel in der letzten Spalte
    const jump = x => x.go === 'map'
      ? el('button', { class: 'x', title: t_('zur Zuordnung — {0} markiert', [x.attribute]), onclick: () => ctx.go?.(`/p/etim/etim?class=${code}&node=${encodeURIComponent(nodeId)}&ef=${x.attribute}`) }, '⇄')
      : el('button', { class: 'x', title: t_('zum Knoten {0}, Gruppe {1}', [x.node.label, groupKey()]), onclick: () => ctx.go?.(`/tree/${x.node.id}?group=${encodeURIComponent(groupKey())}`) }, '↗')
    const barOf = p => el('span', { style: 'display:inline-flex;align-items:center;gap:8px' }, t_('{0} von {1} gefüllt', [p.filled, p.total]), el('span', { style: 'display:inline-block;width:120px;height:8px;border:1px solid var(--line);border-radius:4px;overflow:hidden;background:var(--bg)' }, el('span', { style: `display:block;height:100%;width:${p.pct}%;background:${p.pct >= 80 ? 'var(--pos)' : 'var(--accent)'}` })), `${String(p.pct).replace('.', ',')} %`)
    found.append(S.findings.length
      ? el('table', { class: 'grid', style: 'width:100%;margin-top:6px' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:30px' }, ''), el('th', { style: 'width:260px' }, t_('Knoten')), el('th', { style: 'width:110px' }, t_('Feld')), el('th', {}, t_('Befund')), el('th', { style: 'width:36px' }, ''))),
          el('tbody', {}, ...S.findings.slice(0, 500).map(x => el('tr', {}, el('td', { class: x.severity === 'error' ? 'neg' : x.severity === 'warn' ? 'warn' : x.severity === 'ok' ? 'pos' : 'muted' }, SEV[x.severity] ?? ''),
            el('td', {}, el('a', { href: `/tree/${x.node.id}`, onclick: e => { e.preventDefault(); ctx.go?.(`/tree/${x.node.id}`) } }, `${ICON[x.node.role] ?? ''} ${x.node.label}`)),
            el('td', { class: 'mono muted', title: x.label ?? '' }, x.attribute ?? ''), el('td', { title: x.title ?? '' }, x.progress ? barOf(x.progress) : x.message), el('td', {}, jump(x))))))
      : el('div', { class: 'muted', style: 'padding:4px 0' }, t_('✓ keine Befunde in {0} Knoten', [S.sum.nodes])))
    // Körper: Kennzahl je Klasse — am Knoten, an dem die Klasse
    // gesetzt ist (nicht bis ganz nach oben) — und darunter immer die Befunde je Knoten; kein Knopf, nichts verschwindet
    if (S.ownCode && S.byClass.length) {
      const bar = p => el('span', { style: 'display:inline-block;width:120px;height:8px;border:1px solid var(--line);border-radius:4px;overflow:hidden;background:var(--bg);vertical-align:middle' }, el('span', { style: `display:block;height:100%;width:${p}%;background:${p >= 80 ? 'var(--pos)' : 'var(--accent)'}` }))
      const tb = el('tbody')
      for (const c of S.byClass) tb.append(el('tr', {}, el('td', { class: 'mono' }, c.code), el('td', { title: t_('{0} Knoten mit dieser Klasse darunter', [c.nodes]) }, nameOf(cache.classes.get(c.code)?.name, locale) || ''), el('td', { class: 'num muted' }, String(c.nodes)),
        el('td', { class: 'num' }, `${c.filled} von ${c.cells}`), el('td', {}, bar(c.pct)), el('td', { class: 'num' }, `${String(c.pct).replace('.', ',')} %`), el('td', { class: c.bad ? 'neg' : 'muted' }, c.bad ? `✗ ${c.bad}` : '')))
      if (S.byClass.length > 1) tb.append(el('tr', {}, el('td', {}), el('td', { class: 'muted' }, t_('Teilbaum')), el('td', { class: 'num muted' }, String(S.sum.nodes)), el('td', { class: 'num muted' }, `${S.sum.filled} von ${S.sum.cells}`), el('td', {}, bar(S.sum.pct)), el('td', { class: 'num' }, `${String(S.sum.pct).replace('.', ',')} %`), el('td', {})))
      table.append(el('table', { class: 'grid', style: 'width:auto;min-width:520px;margin-top:4px' },
        el('thead', {}, el('tr', {}, el('th', { style: 'width:90px' }, t_('Klasse')), el('th', {}, t_('Name')), el('th', { style: 'width:50px' }, t_('Knoten')), el('th', { style: 'width:110px' }, t_('gefüllt')), el('th', { style: 'width:130px' }, ''), el('th', { style: 'width:60px' }, '%'), el('th', { style: 'width:50px' }, ''))), tb))
    }
  }
  render()
  return () => { gone = true }
}

async function mount(root, ctx) {
  const { api, store, tree } = ctx
  if (!tree.loaded) await tree.load()
  await cache.loaded   // die Suchliste holt erst „⌕ Klassen laden“ (14.10.2026) — die Ansicht zu öffnen lädt keine Freigabe
  const model = () => store.model
  const locale = model().masterLocale ?? 'de'
  const params = new URLSearchParams(location.search); const assignParam = params.get('assign'); const classParam = params.get('class'); const backNode = params.get('node'); const efParam = (params.get('ef') ?? '').toUpperCase(); if (assignParam || classParam) history.replaceState(null, '', location.pathname)
  const st = { assign: null, rel: null, q: '', hits: [], root: localStorage.getItem('journali.etim.root') || tree.rows.find(r => !r.parent)?.id, result: null, busy: false, mapFilter: classParam && cache.classes.has(classParam.toUpperCase()) ? classParam.toUpperCase() : null, backNode: backNode && tree.byId.has(backNode) ? backNode : null }
  if (assignParam && tree.byId.has(assignParam)) setTimeout(() => classDialog(assignParam, ctx), 0)
  root.style.cssText = 'display:flex;flex-direction:column;height:100%;padding:0'
  const status = el('span', { class: 'muted' }); const say = m => status.textContent = m
  const body = el('div', { class: 'scroll', style: 'flex:1;padding:0 8px 8px' })
  const attrs = () => model().attributes.filter(a => a.type !== 'rows')
  const lbl = a => a.label?.[locale] || L(a.label) || a.key
  const ops = modelOps(ctx); const hasAttr = ops.hasAttr
  const saveSettings = () => ctx.data.set('settings', cache.settings)
  const saveMap = async () => { await ctx.data.set('map', cache.map); store.toast(t_('✓ Zuordnung gespeichert'), 'ok') }   // jede Änderung sofort
  const section = (title, hint, ...kids) => el('div', { class: 'section', style: 'margin-top:10px' }, el('div', { class: 'step-band' }, title, hint ? el('span', { class: 'muted' }, ' · ' + hint) : null), ...kids)
  const busy = async (label, fn) => { if (st.busy) return; st.busy = true; say(label); try { await fn() } catch (e) { say('✗ ' + e.message); store.toast(e.message) } finally { st.busy = false } }

  // ── Freigabe: IXF-Datei lesen (bleibt im Speicher — nur übernommene Klassen gehen ins Journal)
  const file = el('input', { type: 'file', accept: '.xml,.ixf,.zip', style: 'display:none' })
  file.addEventListener('change', async () => {
    const f = file.files?.[0]; if (!f) return
    // Datei, entpackte Bytes und Text liegen gleichzeitig im Speicher; über rund 500 MB scheitert schon das Dekodieren (04.10.2026)
    if (f.size > 300 * 1048576) { say(t_('{0}: {1} MB, im Browser höchstens {2} MB.', [f.name, (f.size / 1048576).toFixed(0), 300])); return }
    await busy(`lese ${f.name} (${(f.size / 1048576).toFixed(1)} MB) …`, async () => {
      const t0 = performance.now()
      // Zip direkt lesen: die Freigaben kommen als Zip — die grösste .xml/.ixf darin zählt
      const raw = new Uint8Array(await f.arrayBuffer())
      let text
      if (isZip(raw)) { const e = ixfInZip(raw); say(`entpacke ${e.name} (${(e.size / 1048576).toFixed(1)} MB) …`); text = new TextDecoder().decode(await inflateInBrowser(e)) }
      else text = new TextDecoder().decode(raw)
      st.rel = parseIxf(text)
      const h = st.rel.header
      say(`${h.name ?? 'ETIM'} Nr. ${h.number ?? '?'} · ${st.rel.classes.length} Klassen · ${st.rel.features.size} ETIM-Attribute · ${st.rel.values.size} Werte · ${Math.round(performance.now() - t0)} ms`)
      st.relInfo = { name: h.name, number: h.number, date: h.date, exportDate: h.exportDate, classes: st.rel.classes.length, features: st.rel.features.size, languages: [...new Set(st.rel.classes.slice(0, 50).flatMap(c => Object.keys(c.name)))], file: f.name, at: new Date().toISOString() }
      draw()
    })
    file.value = ''
  })
  // Kontext beim Zuweisen:
  // Pfad des Knotens, die Klasse, die dort schon gilt, das Umfeld (Klassen an Geschwistern und darunter, mit Zahl), Treffer über die
  // Namen am Pfad — und die KI, wenn ein Schlüssel da ist. Jeder Vorschlag hat sein ⇢ zuweisen.
  function assignBox(row, P) {
    const key = cache.settings.classAttr
    const path = tree.ancestors(row.id).map(a => a.label)
    const current = ((tree.byId.get(row.id)?.values ?? {})[key]) ?? null
    const byCode = c => cache.classes.get(c) ?? P.find(x => x.code === c) ?? null
    const line = (code, why) => { const c = byCode(code); return el('div', { class: 'pick', style: 'display:flex;gap:8px;align-items:center' }, el('span', { class: 'mono muted' }, code), el('span', { class: 'grow' }, c ? nameOf(c.name, locale) : el('i', { class: 'muted' }, t_('nicht übernommen und nicht in der Freigabe')), c ? el('span', { class: 'muted', style: 'font-size:11px' }, ' ' + t_('· {0} ETIM-Attribute', [c.features.length])) : null, why ? el('span', { class: 'muted', style: 'font-size:11px' }, `  (${why})`) : null), c ? assignBtn(code) : null) }
    // Umfeld: Klassen an Geschwistern, an Kindern, am Pfad darüber — aus dem Baum (Tabelle liefert die Werte je Knoten)
    const env = el('div', { class: 'muted', style: 'font-size:12px;padding:2px 0' }, t_('Umfeld …'))
    ;(async () => {
      try {
        const counts = new Map(); const add = (c, why) => { if (!c) return; const k = c.toUpperCase(); if (!counts.has(k)) counts.set(k, new Map()); counts.get(k).set(why, (counts.get(k).get(why) ?? 0) + 1) }
        const parent = row.parent ? tree.byId.get(row.parent) : null
        if (parent) { const t = await api.get(`/api/nodes/${encodeURIComponent(parent.id)}/table?attributes=${key}`); for (const r of t.rows) if (r.row.id !== row.id) add(r.values[key]?.value, t_('Geschwister')) }
        const below = await api.get(`/api/nodes/${encodeURIComponent(row.id)}/table?deep=true&attributes=${key}`); for (const r of below.rows) add(r.values[key]?.value, 'darunter')
        for (const a of tree.ancestors(row.id)) { const v = (a.values ?? {})[key]; if (v) add(v, t_('am Pfad:') + ' ' + a.label) }
        env.innerHTML = ''
        if (!counts.size) { env.append(t_('Im Umfeld ist keine Klasse gesetzt: weder an Geschwistern noch darunter oder am Pfad.')); return }
        env.append(el('div', { class: 'muted' }, t_('Umfeld')))
        for (const [c, whys] of [...counts].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0))) env.append(line(c, [...whys].map(([w, n]) => whyText(w, n)).join(' · ')))
      } catch (e) { env.textContent = t_('Umfeld:') + ' ' + e.message }
    })()
    // Namen: Wörter aus dem Namen und dem Pfad gegen Klassennamen und Synonyme
    // Wörter: eigener Name und der direkte Vater zählen doppelt, ganze Wörter mehr als Teile — sonst trifft „mobile“ jedes Telefon
    const wordsOf = s => String(s ?? '').split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 4).map(w => w.toLowerCase())
    const near = new Set([...wordsOf(row.label), ...wordsOf(path[path.length - 1])]); const words = [...near]
    const nameHits = P.map(c => { const names = [...Object.values(c.name ?? {}), ...Object.values(c.synonyms ?? {}).flat()].map(n => String(n).toLowerCase()); let score = 0; for (const w of words) if (names.some(n => new RegExp(`(^|[^\p{L}])${w}([^\p{L}]|$)`, 'u').test(n))) score++; return { c, score } }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 8)
    const ai = ctx.ai; const suggest = el('div', { style: 'margin-top:4px' })
    const gname = c => c.group ? (nameOf(c.group.name, locale) || c.group.code) : '—'
    const askAi = async () => {
      suggest.innerHTML = ''; suggest.append(el('span', { class: 'ai' }, '✦ …'))
      try {
        const groupsAll = [...new Set(P.map(gname))].sort()
        const g = await ai.ask({ system: t_('Du ordnest Produkte ETIM-Klassengruppen zu. Antworte nur als JSON {"groups":["…","…"]} mit 1 bis 3 Namen exakt aus der Liste.'), user: `Produkt: ${row.label}\nPfad: ${path.join(' › ')}\nGruppen:\n${groupsAll.join('\n')}`, json: true, maxTokens: 200, purpose: t_('Klassifikation') })
        const picked = (g.groups ?? []).filter(x => groupsAll.includes(x)); if (!picked.length) throw new Error(t_('keine Gruppe erkannt'))
        const cands = P.filter(c => picked.includes(gname(c)))
        const list = cands.map(c => `${c.code} ${nameOf(c.name, locale)}${Object.values(c.synonyms ?? {}).flat().length ? ' (' + Object.values(c.synonyms ?? {}).flat().slice(0, 4).join(', ') + ')' : ''}`).join('\n')
        const j = await ai.ask({ system: t_('Du ordnest ein Produkt genau einer ETIM-Klasse zu. Antworte nur als JSON {"suggestions":[{"code":"EC…","why":"…"}]} mit 1 bis 3 Vorschlägen, Codes exakt aus der Liste, bester zuerst, why in einem kurzen Satz auf Deutsch.'), user: `Produkt: ${row.label}\nPfad: ${path.join(' › ')}\nKlassen:\n${list}`, json: true, maxTokens: 400, purpose: t_('Klassifikation') })
        suggest.innerHTML = ''; suggest.append(el('div', { class: 'ai', style: 'font-size:12px' }, t_('✦ KI ({0}) — Gruppe{1} {2}', [ai.label(), picked.length > 1 ? 'n' : '', picked.join(', ')])))
        const out = (j.suggestions ?? []).filter(s => cands.some(c => c.code === String(s.code).toUpperCase()))
        if (!out.length) suggest.append(el('div', { class: 'muted' }, t_('kein Vorschlag — unten blättern')))
        for (const s of out) suggest.append(line(String(s.code).toUpperCase(), s.why ?? ''))
      } catch (e) { suggest.innerHTML = ''; suggest.append(el('span', { class: 'neg' }, '✗ ' + e.message)) }
    }
    if (ai?.available()) suggest.append(el('button', { class: 'x ai', title: t_('die KI nach passenden Klassen fragen ({0}) — kostet Token', [ai.label()]), onclick: () => P.length ? askAi() : store.toast(t_('erst eine ETIM-Version holen')) }, t_('✦ KI fragen')))
    else suggest.append(el('div', { class: 'muted', style: 'font-size:12px' }, t_('✦ Vorschläge aus Name und Pfad brauchen einen KI-Schlüssel (⚙ Einstellungen) — ohne: unten blättern oder suchen')))
    const names = el('div', {}, el('div', { class: 'muted', style: 'font-size:12px' }, nameHits.length ? t_('Namenstreffer für {0}', [words.map(w => '„' + w + '“').join(', ')]) : P.length ? t_('keine Klasse heisst wie {0} — unten suchen (ETIM International: englische Namen)', [words.map(w => '„' + w + '“').join(', ')]) : t_('erst eine ETIM-Version holen')), ...nameHits.map(x => line(x.c.code, t_('{0} Wort{1}', [x.score, x.score > 1 ? 'e' : '']))))
    return el('div', { style: 'padding:6px 0;border:1px solid var(--accent);border-radius:6px;padding:8px;margin:6px 0' },
      el('div', { class: 'chips' }, el('b', {}, t_('Klasse zuweisen an {0} {1}', [ICON[row.role] ?? '', row.label])), el('span', { class: 'muted', style: 'font-size:12px' }, path.length ? path.join(' › ') : ''), el('span', { class: 'grow' }), el('button', { class: 'x', title: t_('ohne Zuweisung weiter'), onclick: () => { st.assign = null; draw() } }, '✕')),
      current ? line(current, t_('gilt hier schon')) : el('div', { class: 'muted', style: 'font-size:12px' }, t_('hier gilt noch keine Klasse'), row.parent && tree.byId.get(row.parent)?.role === 'group' && tree.kids(row.parent).length > 1 ? el('span', {}, ' — ', el('a', { href: '#', onclick: e => { e.preventDefault(); st.assign = row.parent; draw() } }, t_('an {0} {1} zuweisen', [ICON.group, tree.byId.get(row.parent).label])), ' ' + t_('gilt für alle {0} darunter (vererbbar)', [tree.kids(row.parent).length])) : null),
      env, names, suggest)
  }
  // Klasse einem Knoten zuweisen:
  // Wert im Klassenattribut (vererbbar — an der Gruppe gesetzt gilt es für alles darunter); fehlt die Gruppe ETIM am Pfad, kommt sie an den Knoten
  async function assignClass(nodeId, code) {
    const row = tree.byId.get(nodeId); if (!row) return
    if (!cache.classes.has(code)) {
      const cls = st.rel?.classes.find(x => x.code === code)
      if (cls) await takeClass(cls, true)
      else { const rest = await holeKlassen([code]).catch(e => { store.toast(e.message); return [code] }); if (rest.length) { store.toast(t_('Klasse {0} nicht übernommen', [code])); return } }
    }
    await busy(t_('weise {0} zu …', [code]), async () => {
      cache.used.add(code)
      const r = await ops.assign(nodeId, cache.classes.get(code), { withFeatures: false }); await store.poll(true)
      await tree.load?.()
      say(`${code} → ${row.label}${r.groupAttached ? ` (Gruppe ${r.group} angehängt)` : ''}`); store.toast(`✓ ${code} an ${row.label}`, 'ok')
    })
  }
  const assignPick = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:6;width:380px;display:none;padding:6px;background:var(--pane)' })
  let assignCode = null
  ctx.treePicker(assignPick, { roles: ['group', 'product', 'variant'], height: 300, onPick: async r => { assignPick.style.display = 'none'; if (assignCode) await assignClass(r.id, assignCode); draw() } })
  const assignBtn = code => st.assign
    ? el('button', { class: 'primary', title: t_('{0} dem gewählten Knoten zuweisen', [code]), onclick: async () => { await assignClass(st.assign, code); draw() } }, '⇢ zuweisen')
    : el('button', { class: 'x', title: t_('{0} einem Knoten zuweisen — Auswahlbaum', [code]), onclick: e => { assignCode = code; const host = e.currentTarget.parentElement; host.style.position = 'relative'; host.append(assignPick); assignPick.style.display = assignPick.style.display === 'none' ? 'block' : 'none' } }, '⇢')
  async function takeClass(cls, silent) {
    // aus der Suchliste (von der URL): der Server holt die Freigabe und schreibt die Klasse; aus einer gelesenen Datei: hier
    if (!st.rel || !st.rel.classes.includes(cls)) {
      await busy(t_('hole {0} aus ETIM {1} …', [cls.code, cache.version]), async () => { if ((await holeKlassen([cls.code])).length) throw new Error(t_('{0} gibt es in ETIM {1} nicht', [cls.code, cache.version])) })
      const rec = cache.classes.get(cls.code); if (rec && !silent) say(t_('{0} übernommen · {1} ETIM-Attribute', [classText(rec, locale), rec.features.length]))
      return
    }
    const rec = classRecord(st.rel, cls, model().locales.map(l => l.code)); await ensureVersion(); await ctx.data.set(classKeyOf(rec.code), rec); cache.classes.set(rec.code, rec)
    if (!silent) say(t_('{0} übernommen · {1} ETIM-Attribute', [classText(rec, locale), rec.features.length]))
  }
  // Version der gelesenen Datei als Freigabe eintragen und zur aktuellen machen, wenn keine da ist; Namen anderer Sprachen derselben Version bleiben (Datei von etim.de ergänzt die englische)
  async function ensureVersion() {
    const h = st.rel.header; const ver = String(h.number ?? '0'); const variant = variantOf(st.relFile ?? ''); const key = [ver, variant].filter(Boolean).join('-')
    if (!cache.versions.some(v => v.key === key)) { const info = { key, version: ver, variant, name: h.name, number: h.number, date: h.date, exportDate: h.exportDate, classes: st.rel.classes.length, features: st.rel.features.size, file: st.relInfo?.file, at: new Date().toISOString() }; await ctx.data.set('release:' + ver, info); cache.versions.unshift(info) }
    if (cache.version == null) { cache.version = ver; await ctx.data.set('release', { ...cache.versions.find(v => v.version === ver) }) }
    if (cache.version !== ver) { cache.version = ver; await ctx.data.set('release', { ...cache.versions.find(v => v.version === ver) }); await loadCache() }
  }
  // Klassen, in denen gesucht wird: die gelesene Freigabe, sonst die Suchliste der aktuellen Version (erst nach „⌕ Klassen laden“)
  const pool = () => st.rel ? st.rel.classes : suchliste()
  async function classesFromTree() {
    if (cache.releaseKey == null && !st.rel) { store.toast(t_('erst eine ETIM-Version holen')); return }
    const key = cache.settings.classAttr; if (!hasAttr(key)) { store.toast(t_('Attribut {0} gibt es nicht', [key])); return }
    await busy(t_('suche Klassen im Baum …'), async () => {
      const codes = new Set()
      for (const r of tree.rows.filter(r => !r.parent)) { const t = await api.get(`/api/nodes/${encodeURIComponent(r.id)}/table?deep=true&attributes=${key}`); for (const row of t.rows) { const c = String(row.values[key]?.value ?? '').trim().toUpperCase(); if (/^EC\d{6}$/.test(c)) codes.add(c) } }
      const fehlt = [...codes].filter(c => !cache.classes.has(c)); let n = 0
      const ausDatei = fehlt.map(c => st.rel?.classes.find(x => x.code === c)).filter(Boolean)
      for (const cls of ausDatei) { await takeClass(cls, true); n++ }
      const rest = fehlt.filter(c => !cache.classes.has(c))
      const miss = rest.length ? (await holeKlassen(rest)).length : 0
      n += rest.length - miss
      say(t_('{0} Klassen im Baum · {1} neu übernommen{2}', [codes.size, n, miss ? ' ' + t_('· {0} nicht in Version {1}', [miss, cache.version]) : ''])); draw()
    })
  }
  // Klassen im Journal, die keiner verwendet (14.10.2026): vorher kam beim Holen die ganze Freigabe ins Journal — aufräumen nimmt sie heraus
  // (im Journal steht das Entfernen; die Historie bleibt). Gezählt beim Öffnen der Ansicht.
  st.unbenutzt = (await ctx.data.list().catch(() => [])).filter(n => n.startsWith('class:') && !cache.used.has(n.split(':').pop().toUpperCase()))
  async function aufraeumen() {
    const weg = st.unbenutzt; if (!weg.length) return
    if (!(await ctx.dialog.confirm({ title: t_('{0} Klassen ohne Zuweisung aus dem Journal nehmen?', [weg.length]), text: t_('Die Klassen in Gebrauch bleiben. Gesucht wird danach in der Freigabe selbst — sie wird von ihrer URL gelesen, wenn jemand sucht oder zuweist.'), ok: t_('✕ {0} Klassen entfernen', [weg.length]), danger: true }))) return
    await busy(t_('entferne {0} Klassen …', [weg.length]), async () => {
      for (let i = 0; i < weg.length; i += 2000) { say(t_('{0} / {1} Klassen entfernt …', [Math.min(i + 2000, weg.length), weg.length])); await api.post('/api/plugins/etim/data', Object.fromEntries(weg.slice(i, i + 2000).map(n => [n, null])), 'PUT') }
      await loadCache(); st.unbenutzt = []; say(t_('{0} Klassen entfernt', [weg.length])); draw()
    })
  }
  async function klassenLaden() {
    await busy(t_('lese ETIM {0} von {1} …', [cache.version, (cache.release?.url ?? '').split('/').pop()]), async () => { await ensurePool(); if (cache.poolError) throw new Error(cache.poolError); say(t_('ETIM {0}: {1} Klassen zum Suchen', [cache.version, cache.liste.size])); draw() })
  }

  // ── Attribute anlegen (modelOps): Klassenattribut, je ETIM-Attribut ein Attribut in der Gruppe ETIM
  async function createAttributes() {
    await busy(t_('lege Attribute an …'), async () => {
      await store.poll(true); await ops.ensureClassAttr()
      let n = 0; const todo = [...allFeatures().values()].filter(f => !hasAttr(attrKeyOf(f.code)))
      say(t_('lege {0} Attribute an …', [todo.length])); if (todo.length) await ops.createFeatures(todo)
      await saveMap(); await store.poll(true)
      say(t_('{0} Attribute angelegt · Klassenattribut {1} mit {2} Klassen', [todo.length, cache.settings.classAttr, cache.classes.size])); draw()
    })
  }

  // (Die Prüfung eines Teilbaums lief hier über die ganze Tabelle — ungenutzt seit der Stufe „Daten“ der Übersicht, darum entfernt, 04.10.2026)

  // ── ƒ an der Zuordnung: Kette wie im Datenmapper — Probe zeigt, was am ETIM-Attribut ankommt
  function stepsDialog(f) {
    const cur = cache.map[f.code]; const to = typeof cur === 'string' ? cur : cur?.to ?? ''
    const steps = JSON.parse(JSON.stringify(stepsOf(f.code) ?? []))
    const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:41' })
    const box = el('div', { style: 'width:min(720px,94vw);max-height:80vh;display:flex;flex-direction:column;background:var(--pane);border:1px solid var(--line);border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.4);font-size:13px' })
    const list = el('div', { style: 'display:flex;flex-direction:column;gap:6px' })
    const probe = el('input', { placeholder: t_('Probe: ein Wert, wie er im Attribut steht'), style: 'width:100%' })
    const out = el('div', { class: 'muted', style: 'font-size:12px;min-height:18px' })
    // auch die leere Probe zeigt, was die Kette macht — nur ohne Kette gibt es nichts zu zeigen
    const show = () => { const v = probe.value; if (!v && !steps.length) { out.textContent = ''; return } const t = throughSteps(steps.length ? steps : null, v); const r = resolveValue(f, t); out.innerHTML = ''; out.append(`${v ? `„${v}“` : '(leer)'} → ${t ? `„${t}“` : '(leer)'} → `, el('span', { class: r === null ? 'neg' : r?.unknown ? 'muted' : 'pos' }, r === null ? t_('✗ passt nicht zu {0}', [TYPE[f.type] ?? f.type]) : r.unknown ? 'leer (unbekannt)' : r.values.join(' - '))) }
    probe.addEventListener('input', show)
    const field = (s, k) => {
      const lab = el('span', { class: 'muted', style: 'font-size:11px' }, FIELD_LABEL[k] ?? k)
      if (k === 'regex') { const cb = el('input', { type: 'checkbox' }); cb.checked = !!s.regex; cb.addEventListener('change', () => { s.regex = cb.checked; show() }); return el('label', { style: 'display:inline-flex;gap:3px;align-items:center' }, cb, 'regex') }
      if (k === 'test') { const sel = el('select', {}, ...[['empty', 'leer'], ['equals', 'gleich'], ['contains', t_('enthält')], ['matches', t_('passt auf (regex)')]].map(([v, l]) => el('option', { value: v }, l))); sel.value = s.test ?? 'empty'; sel.addEventListener('change', () => { s.test = sel.value; show() }); return el('span', {}, lab, ' ', sel) }
      if (k === 'decimal') { const sel = el('select', {}, el('option', { value: '' }, 'raten'), el('option', { value: ',' }, t_('Komma')), el('option', { value: '.' }, t_('Punkt'))); sel.value = s.decimal ?? ''; sel.addEventListener('change', () => { if (sel.value) s.decimal = sel.value; else delete s.decimal; show() }); return el('span', {}, lab, ' ', sel) }
      if (k === 'format') { const sel = el('select', {}, ...DATE_FORMATS.map(([v, l]) => el('option', { value: v }, l))); sel.value = s.format ?? 'auto'; sel.addEventListener('change', () => { s.format = sel.value; show() }); return el('span', {}, lab, ' ', sel) }
      const inp = el('input', { placeholder: FIELD_HINT[k] ?? k, title: (FIELD_HINT[k] ?? k) + ' — ' + opHint(s.op), style: k === 'pairs' ? 'width:320px' : 'width:160px' }); inp.value = s[k] ?? (k === 'yes' ? YES_DEFAULT : ''); inp.addEventListener('input', () => { s[k] = inp.value; show() })
      return el('span', {}, lab, ' ', inp)
    }
    const evHint = f.type === t_('Alphanumeric') ? el('div', { class: 'muted', style: 'font-size:11px' }, t_('erlaubte Werte:') + ' ', f.values.slice(0, 12).map(v => `${nameOf(v.name, locale)} = ${v.code}`).join(' · '), f.values.length > 12 ? ' …' : '') : null
    const render = () => {
      list.innerHTML = ''
      steps.forEach((s, i) => {
        const sel = el('select', { title: opHint(s.op) }, ...OPS.map(o => el('option', { value: o[0] }, o[1]))); sel.value = s.op; sel.addEventListener('change', () => { steps[i] = { op: sel.value }; if (sel.value === 'boolean') steps[i].yes = YES_DEFAULT; render(); show() })
        list.append(el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:4px 6px;border:1px solid var(--line);border-radius:4px' }, el('span', { class: 'muted mono' }, String(i + 1)), sel, ...(FIELDS[s.op] ?? []).map(k => field(s, k)),
          el('span', { class: 'grow' }), el('button', { class: 'x', title: t_('Schritt entfernen'), onclick: () => { steps.splice(i, 1); render(); show() } }, '✕')))
      })
      const add = el('select', {}, el('option', { value: '' }, t_('+ Schritt …')), ...OPS.map(o => el('option', { value: o[0] }, o[1]))); add.addEventListener('change', () => { if (!add.value) return; const s = { op: add.value }; if (s.op === 'boolean') s.yes = YES_DEFAULT; steps.push(s); render(); show() })
      list.append(el('div', {}, add))
      show()
    }
    render()
    const close = () => overlay.remove()
    const save = async () => { const clean = steps.filter(x => x.op); if (!clean.length && (!to || to === f.code.toLowerCase())) delete cache.map[f.code]; else cache.map[f.code] = clean.length ? { to: to || f.code.toLowerCase(), steps: clean } : to; await saveMap(); close(); draw() }
    box.append(el('div', { class: 'toolbar', style: 'padding:8px 12px' }, el('b', {}, `ƒ ${f.code} ${featureText(f, locale)}`), el('span', { class: 'muted', style: 'font-size:12px' }, `← ${to || f.code.toLowerCase()} · ${TYPE[f.type] ?? f.type}`), el('span', { class: 'grow' }), el('button', { class: 'x', onclick: close }, '✕')),
      el('div', { class: 'scroll', style: 'padding:8px 12px;flex:1' }, el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:6px' }, t_('Der Wert des Attributs läuft durch die Kette, dann wird er als ETIM-Attribut gelesen — Zahl, Ja/Nein, Werteliste (EV-Code oder Name), Bereich.')), evHint, list, el('div', { style: 'margin-top:10px' }, probe, out)),
      el('div', { class: 'toolbar', style: 'padding:6px 12px;border-top:1px solid var(--line)' }, el('span', { class: 'grow' }), el('button', { onclick: close }, 'abbrechen'), el('button', { class: 'primary', onclick: save }, t_('Kette speichern'))))
    overlay.append(box); document.body.append(overlay); overlay.addEventListener('mousedown', e => { if (e.target === overlay) close() })
  }


  // ---- Anfangszustand
  // Nimmt in dieser Reihenfolge zurück: Klassen an den Knoten, Sichten, Attribute der Gruppe, Werteliste der Klassen, die Gruppe,
  // Zuordnung und Einstellungen — und auf Wunsch die geladenen Freigaben. Werte bleiben im Journal (append-only), nur das Modell wird leer.
  async function resetDialog() {
    const key = cache.settings.classAttr
    const attrs = () => (model().attributes ?? []).filter(ofSystem)
    const views = () => (model().views ?? []).filter(v => v.key.startsWith('etim_'))
    const names = await ctx.data.list().catch(() => [])
    const lib = names.filter(n => n.startsWith('class:') || n === 'release' || n.startsWith('release:'))
    const nodes = [...cache.usedBy.values()].flat()
    const overlay = el('div', { style: 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:grid;place-items:center;z-index:41' })
    const box = el('div', { style: 'width:min(620px,94vw);background:var(--pane);border:1px solid var(--line);border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.4);font-size:13px' })
    const log = el('div', { class: 'muted', style: 'font-size:12px;min-height:18px;padding:4px 0' })
    const opt = (checked, label, hint) => { const cb = el('input', { type: 'checkbox' }); cb.checked = checked; return { cb, row: el('label', { style: 'display:flex;gap:6px;align-items:baseline;padding:3px 0' }, cb, el('span', {}, label, el('span', { class: 'muted' }, ' · ' + hint))) } }
    const oNodes = opt(true, t_('Klassen an {0} Knoten entfernen', [nodes.length]), t_('die Zuweisungen im Baum'))
    const oModel = opt(true, `Modell: Gruppe ${groupKey()}, ${attrs().length} Attribute, ${views().length} Sichten`, t_('Werte bleiben im Journal'))
    const oMap = opt(true, t_('Zuordnung und Einstellungen'), 'map, mapping, settings')
    const oLib = opt(false, t_('Bibliothek: {0} Einträge', [lib.length]), t_('geladene Freigaben — danach neu laden (dauert)'))
    const close = () => overlay.remove()
    const go = async () => {
      const say2 = t => { log.textContent = t }
      try {
        if (oNodes.cb.checked && nodes.length) {
          say2(t_('nehme die Klasse an {0} Knoten zurück …', [nodes.length]))
          const cmds = nodes.map(n => ({ op: 'attribute.set', args: { node: n.id, attribute: key, locale: null, channel: null, value: '' } }))
          await api.post('/api/batch?skipErrors=true', { commands: cmds })
        }
        if (oModel.cb.checked) {
          for (const v of views()) { say2(t_('Sicht {0} …', [v.key])); await api.del(`/api/model/views/${encodeURIComponent(v.key)}`).catch(() => {}) }
          for (const a of attrs()) { say2(t_('Attribut {0} …', [a.key])); await api.del(`/api/model/attributes/${encodeURIComponent(a.key)}`).catch(() => {}) }
          say2(t_('Werteliste …')); await api.del(`/api/model/lists/${encodeURIComponent(key)}`).catch(() => {})
          say2(t_('Gruppe …')); await api.del(`/api/model/groups/${encodeURIComponent(groupKey())}`).catch(() => {})
        }
        if (oMap.cb.checked) for (const n of ['map', 'mapping', 'settings']) await ctx.data.del(n).catch(() => {})
        // Bibliothek in Stapeln zu 2 000 (null = weg) statt einer Anfrage je Datensatz (04.10.2026)
        if (oLib.cb.checked) for (let i = 0; i < lib.length; i += 2000) { say2(t_('Bibliothek {0}/{1} …', [Math.min(i + 2000, lib.length), lib.length])); await api.post('/api/plugins/etim/data', Object.fromEntries(lib.slice(i, i + 2000).map(n => [n, null])), 'PUT') }
        await store.poll(true); await tree.load?.()
        cache.settings = { ...DEFAULTS }; cache.map = {}; cache.mapping = {}
        await loadCache()
        close(); store.toast(t_('✓ ETIM zurückgesetzt'), 'ok'); draw()
      } catch (e) { say2('✗ ' + e.message) }
    }
    box.append(el('div', { class: 'toolbar', style: 'padding:8px 12px' }, el('b', {}, t_('⟲ ETIM zurücksetzen')), el('span', { class: 'grow' }), el('button', { class: 'x', onclick: close }, '✕')),
      el('div', { style: 'padding:8px 12px' }, el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:6px' }, t_('Anfangszustand zum Testen — was weg soll:')),
        oNodes.row, oModel.row, oMap.row, oLib.row, log),
      el('div', { class: 'toolbar', style: 'padding:6px 12px;border-top:1px solid var(--line)' }, el('span', { class: 'grow' }), el('button', { onclick: close }, 'abbrechen'), el('button', { class: 'primary', onclick: go }, t_('⟲ zurücksetzen'))))
    overlay.append(box); document.body.append(overlay); overlay.addEventListener('mousedown', e => { if (e.target === overlay) close() })
  }

  // Ergebnis eines Prozesslaufs: die JSON-Zeile in der Ausgabe (stdout), der Rest ist Fortschritt (stderr)
  const jsonOf = out => { for (const line of String(out ?? '').split('\n')) { const s = line.trim(); if (s.startsWith('{')) { try { return JSON.parse(s) } catch { } } } return null }
  // Die Ansicht des Plugins ist nur, was das Plugin selbst ist:
  // Versionen, Klassen in Gebrauch, Attribute, Zuordnung mit ƒ. Bedient wird am Knoten (Band ⌗ ETIM in der Knotenansicht).
  function draw() {
    body.innerHTML = ''
    const m = model(); const rel = st.rel; const relInfo = st.relInfo
    // 1 · Klassifikation: eine Tabelle der ETIM-Versionen im Journal — je Zeile Version,
    // Quelle, Klassen, Sprachen, geladen am, ● aktuell. Darunter EINE Zeile zum Holen (Liste → Auswahl → laden, oder URL, oder Datei).
    const langs = m.locales.map(l => l.code)
    const verRows = cache.versions.map(v => el('tr', {},
      el('td', {}, el('button', { 'data-demo': 'aus', class: 'toggle', style: 'width:28px', title: v.key === cache.releaseKey ? t_('aktuelle Freigabe — gilt für Zuweisen, Prüfen, Export') : t_('zur aktuellen Freigabe machen'), onclick: async () => { await ctx.data.set('release', v); await loadCache(); await store.poll(true); await ops.ensureClassAttr(); await store.poll(true); draw() } }, v.key === cache.releaseKey ? '●' : '○')),
      el('td', { class: 'mono', title: v.key }, `ETIM ${v.version}`, v.variant ? el('div', { class: 'muted', style: 'font-size:11px' }, v.variant) : null),
      el('td', {}, v.url ? el('a', { href: v.url, target: '_blank', rel: 'noopener', title: v.url }, v.file ?? v.name ?? v.url.split('/').pop()) : (v.file ?? v.name ?? '')),
      el('td', { class: 'num' }, String(v.classes ?? '')),
      el('td', {}, (v.languages ?? []).join('/')),
      el('td', { class: 'muted' }, (v.at ?? '').slice(0, 10))))
    // Holen: Liste von etim-international.com (Prozess), Auswahl oder URL, laden — Fortschritt am Journalstand
    const urlIn = el('input', { placeholder: 'URL (Zip/XML)', value: st.url ?? '', style: 'width:360px', oninput: e => { st.url = e.target.value } })
    const sel = el('select', { style: 'max-width:420px', onchange: e => { st.url = e.target.value; urlIn.value = st.url } }, el('option', { value: '' }, st.list ? t_('{0} Versionen bei ETIM International …', [st.list.length]) : t_('↻ Liste erst holen')), ...(st.list ?? []).map(r => el('option', { value: r.url, selected: r.url === st.url ? '' : null }, r.name.replace(/\.zip$/, ''))))
    const listBtn = el('button', { 'data-demo': 'aus', class: 'x', title: t_('etim-international.com/downloads lesen — die IXF-Versionen als Auswahl'), onclick: () => busy(t_('hole Liste …'), async () => { const r = await api.post('/api/plugins/etim/run', { params: { mode: 'list', url: '', langs: '' } }); const j = jsonOf(r.output); if (!j?.releases) throw new Error(r.output?.slice(0, 200) || t_('keine Liste')); st.list = j.releases; st.url ||= j.releases[0]?.url ?? ''; say(t_('{0} Versionen', [j.releases.length])); draw() }) }, t_('↻ Liste'))
    const loadBtn = el('button', { 'data-demo': 'aus', class: 'primary', title: t_('die Version merken (mit URL) und ihre Klassen zum Suchen lesen — ins Journal kommen nur die Klassen, die übernommen oder zugewiesen werden'), onclick: async () => { if (!st.url) { store.toast(t_('erst eine Version wählen oder eine URL eintragen')); return }
      busy(`lese ${st.url.split('/').pop()} …`, async () => {
        const t0 = Date.now(); const tick = setInterval(() => say(t_('lese {0} … {1} s', [st.url.split('/').pop(), Math.round((Date.now() - t0) / 1000)])), 1000)
        let j; try { j = await etimLauf({ mode: 'index', url: st.url, langs: langs.join(',') }) } finally { clearInterval(tick) }
        await loadCache()
        if (j.key === cache.releaseKey) { for (const c of j.liste ?? []) if (!cache.classes.has(c.code)) cache.liste.set(c.code, c); cache.pool = true }
        await store.poll(true); await ops.ensureClassAttr(); await store.poll(true)
        say(t_('ETIM {0}: {1} Klassen in {2} s{3}', [j.version, j.classes, Math.round(j.ms / 1000), j.current !== j.version ? ' ' + t_('— aktuell bleibt ETIM {0}', [j.current]) : ''])); draw()
      })
    } }, '⇩ laden')
    const fileBtn = el('button', { 'data-demo': 'aus', class: 'x', title: t_('IXF-3.1-Datei vom Rechner — ergänzt dieselbe Version'), onclick: () => file.click() }, t_('⇩ Datei …'))
    const fileState = rel ? el('span', { class: 'muted', title: t_('bleibt im Browser, solange die Seite offen ist — ins Journal kommen nur übernommene Klassen') }, `gelesen: ETIM ${rel.header.number ?? '?'} · ${rel.classes.length} Klassen · ${[...new Set(rel.classes.slice(0, 50).flatMap(c => Object.keys(c.name)))].join('/')}`) : null
    const aufraeumBtn = st.unbenutzt?.length ? el('button', { 'data-demo': 'aus', class: 'x', title: t_('Klassen, die beim früheren Holen ins Journal kamen und nirgends zugewiesen sind, herausnehmen'), onclick: aufraeumen }, t_('✕ {0} Klassen ohne Zuweisung', [st.unbenutzt.length])) : null
    body.append(section(t_('1 · Klassifikation'), t_('ETIM-Versionen im Journal · ● die aktuelle gilt für Zuweisen, Prüfen und Export'),
      cache.versions.length ? el('table', { class: 'grid', style: 'width:auto;min-width:640px' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:34px' }, ''), el('th', { style: 'width:90px' }, t_('Version')), el('th', {}, t_('Quelle')), el('th', { style: 'width:80px' }, t_('Klassen')), el('th', { style: 'width:90px' }, t_('Sprachen')), el('th', { style: 'width:100px' }, 'geladen'))), el('tbody', {}, ...verRows))
        : el('div', { class: 'empty' }, t_('noch keine ETIM-Version im Journal')),
      el('div', { 'data-demo': 'aus', style: 'display:flex;gap:8px;align-items:center;padding:8px 0 2px;flex-wrap:wrap' }, el('span', { class: 'muted' }, 'dazu:'), listBtn, sel, el('span', { class: 'muted' }, 'oder'), urlIn, loadBtn, el('span', { class: 'muted' }, 'oder'), fileBtn, file, fileState),
      aufraeumBtn ? el('div', { style: 'padding:4px 0' }, aufraeumBtn) : null))
    // Klassen
    // ohne gelesene Freigabe (bleibt im Browser, je Sitzung) gibt es nichts zu suchen — Feld und Knopf sagen das, statt nach dem Klick zu meckern
    const P = pool()
    const wizPick = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:6;width:380px;display:none;padding:6px;background:var(--pane)' })
    ctx.treePicker(wizPick, { roles: ['group', 'product', 'variant'], height: 300, onPick: r => { wizPick.style.display = 'none'; classDialog(r.id, ctx) } })
    const wizBtn = el('button', { 'data-demo': 'aus', class: 'primary', title: t_('Knoten wählen, dann die Klasse — mit Vorschlag, Umfeld, Suche und Gruppen'), onclick: () => { wizPick.style.display = wizPick.style.display === 'none' ? 'block' : 'none' } }, t_('⌗ Klasse zuweisen … (Knoten wählen)'))
    const q = el('input', { placeholder: P.length ? t_('Klasse suchen — Code, Name, Synonym ({0})', [P.length]) : t_('erst „⌕ Klassen laden“ — dann suchen'), value: st.q, style: 'width:360px', disabled: !P.length, oninput: e => { st.q = e.target.value; search() } })
    const ladenBtn = !st.rel && !cache.pool && cache.release?.url ? el('button', { class: 'x', title: t_('ETIM {0} von ihrer URL lesen — die Liste bleibt im Browser, solange die Seite offen ist', [cache.version]), onclick: klassenLaden }, t_('⌕ Klassen laden')) : null
    const hits = el('div')
    // Blättern nach Klassengruppen: ohne Suchbegriff die Gruppen, Klick zeigt die Klassen der Gruppe
    const groupsOf = () => { const m = new Map(); for (const c of P) { const g = c.group ? (nameOf(c.group.name, locale) || c.group.code) : '—'; if (!m.has(g)) m.set(g, []); m.get(g).push(c) } return [...m].sort((a, b) => a[0].localeCompare(b[0], 'de')) }
    const row = c => el('div', { class: 'pick', style: 'display:flex;gap:8px;align-items:center' }, el('span', { class: 'mono muted' }, c.code), el('span', { class: 'grow' }, nameOf(c.name, locale), el('span', { class: 'muted', style: 'font-size:11px' }, ' ' + t_('· {0} ETIM-Attribute · {1}', [featureCount(c), c.status]))), cache.classes.has(c.code) ? assignBtn(c.code) : el('button', { class: 'x', title: t_('Klasse übernehmen'), onclick: async () => { await takeClass(c); draw() } }, '+'))
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
      for (const c of found) hits.append(el('div', { class: 'pick', style: 'display:flex;gap:8px;align-items:center' }, el('span', { class: 'mono muted' }, c.code), el('span', { class: 'grow' }, nameOf(c.name, locale), el('span', { class: 'muted', style: 'font-size:11px' }, ' ' + t_('· {0} ETIM-Attribute · {1}', [featureCount(c), c.status]))), cache.classes.has(c.code) ? el('span', { class: 'muted' }, '✓') : el('button', { class: 'x', title: t_('Klasse übernehmen (ins Journal)'), onclick: async () => { await takeClass(c); draw() } }, '+'), st.assign ? el('button', { class: 'primary', title: t_('übernehmen und {0} zuweisen', [tree.byId.get(st.assign)?.label]), onclick: async () => { await assignClass(st.assign, c.code); draw() } }, '⇢ zuweisen') : null))
      if (!found.length) hits.append(el('div', { class: 'muted', style: 'padding:4px' }, t_('nichts gefunden')))
    }
    if (P.length) search()
    const taken = usedClasses().sort((a, b) => a.code.localeCompare(b.code))
    const tbl = el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:90px' }, t_('Klasse')), el('th', {}, t_('Name')), el('th', { style: 'width:70px' }, 'ETIM-Attribute'), el('th', { style: 'width:90px' }, t_('nicht zugeordnet')), el('th', { style: 'width:110px' }, t_('Version')), el('th', { style: 'width:200px' }, t_('Knoten')), el('th', { style: 'width:100px' }, ''), el('th', { style: 'width:60px' }, ''))),
      el('tbody', {}, ...taken.map(c => { const missing = c.features.filter(f => !hasAttr(attrKeyOf(f.code))).length; return el('tr', {}, el('td', { class: 'mono' }, c.code), el('td', {}, nameOf(c.name, locale), el('span', { class: 'muted', style: 'font-size:11px' }, c.group ? ` · ${nameOf(c.group.name, locale)}` : '')), el('td', { class: 'num' }, c.features.length), el('td', { class: missing ? t_('warn num') : t_('muted num') }, missing || '—'), el('td', { class: 'muted', style: 'font-size:11px' }, `${c.release?.name ?? ''} v${c.version}`),
        el('td', { style: 'position:relative' }, assignBtn(c.code)),
        el('td', {}, rel && rel.classes.some(x => x.code === c.code && x.version !== c.version) ? el('button', { class: 'x', title: t_('aus der gelesenen Freigabe aktualisieren'), onclick: async () => { await takeClass(rel.classes.find(x => x.code === c.code)); draw() } }, '↻') : null, el('button', { class: 'x', title: t_('Zuweisung an {0} Knoten entfernen — die Klasse bleibt in Version {1}', [(cache.usedBy.get(c.code) ?? []).length, cache.version]), onclick: async () => { const nodes = cache.usedBy.get(c.code) ?? []; if (!(await ctx.dialog.confirm({ title: t_('{0} an {1} Knoten entfernen?', [c.code, nodes.length]), list: nodes.map(n => `${ICON[n.role] ?? ''} ${n.label}`), text: t_('Das Klassenattribut wird dort geleert; die Klasse bleibt in der Version.'), ok: t_('✕ Zuweisungen entfernen'), danger: true }))) return; await busy(`entferne ${c.code} …`, async () => { await ctx.batch(nodes.map(n => ({ op: 'attribute.set', args: { node: n.id, attribute: cache.settings.classAttr, locale: null, value: '' } }))); await store.poll(true); await loadUsed(); draw() }) } }, '✕')), el('td', { class: 'muted', style: 'font-size:11px' }, (cache.usedBy.get(c.code) ?? []).slice(0, 3).map(n => n.label).join(', ') + ((cache.usedBy.get(c.code) ?? []).length > 3 ? ` … (${cache.usedBy.get(c.code).length})` : ''))) })))
    const assignRow = st.assign ? tree.byId.get(st.assign) : null
    body.append(section(t_('2 · Klassen'), t_('{0} in Gebrauch · {1} in Version {2}', [taken.length, cache.release?.classes ?? '?', cache.version ?? '?']),
      el('div', { style: 'display:flex;gap:8px;align-items:center;padding:4px 0' }, el('span', { style: 'position:relative' }, wizBtn, wizPick), el('span', { class: 'muted', style: 'font-size:12px' }, t_('oder im Baum: Rechtsklick → Datenanalyse → ⌗ ETIM-Klasse …'))),
      el('div', { style: 'display:flex;gap:8px;align-items:center;padding:6px 0;flex-wrap:wrap' }, ladenBtn, q, el('button', { class: 'x', disabled: cache.releaseKey == null && !st.rel, title: cache.releaseKey != null || st.rel ? t_('alle Klassen, die im Attribut {0} im Baum stehen, übernehmen', [cache.settings.classAttr]) : t_('braucht eine ETIM-Version (oben holen)'), onclick: classesFromTree }, t_('⇩ aus dem Baum'))),
      hits, taken.length ? tbl : el('div', { class: 'empty' }, cache.releaseKey != null ? t_('noch keine Klasse im Baum zugewiesen — oben suchen und ⇢ zuweisen') : t_('erst eine ETIM-Version holen'))))
    // Attribute
    // Gruppe der ETIM-Daten: „etim“ legen wir an (Attribute direkt zugewiesen); eine vorhandene Gruppe heißt: hier zuordnen (Best Guess über die Namen)
    const groupSel = el('select', { title: t_('Attributgruppe der ETIM-Daten — gibt es sie nicht, wird sie angelegt'), onchange: e => { cache.settings.group = e.target.value; saveSettings(); draw() } },
      el('option', { value: SYSTEMGRUPPE }, `${SYSTEMGRUPPE}${(model().groups ?? []).some(g => g.key === SYSTEMGRUPPE) ? '' : ' (anlegen)'}`),
      ...(model().groups ?? []).filter(g => g.key !== SYSTEMGRUPPE).map(g => el('option', { value: g.key }, `${g.label?.[locale] || L(g.label) || g.key} (${g.key})`)))
    groupSel.value = groupKey()
    const inGroup = () => attrs().filter(a => a.key !== key)
    const guessInGroup = () => {   // ETIM-Attribut → Attribut der gewählten Gruppe nach Namen (alle Sprachen, Code)
      const { norm, similarity } = ctx.mapper; let n = 0
      for (const f of allFeatures().values()) {
        if (cache.map[f.code] || hasAttr(f.code.toLowerCase())) continue
        const wanted = [f.code, ...Object.values(f.name)].map(norm); let best = null, score = 0
        for (const a of inGroup()) for (const w of wanted) for (const nme of [a.key, ...Object.values(a.label ?? {})].map(norm)) { const s = nme === w ? 1 : similarity(nme, w); if (s > score) { score = s; best = a } }
        if (best && score >= 0.8) { cache.map[f.code] = best.key; n++ }
      }
      saveMap(); say(t_('{0} ETIM-Attribute in Gruppe {1} zugeordnet', [n, groupKey()])); draw()
    }
    const classSel = el('select', { onchange: e => { cache.settings.classAttr = e.target.value; saveSettings(); draw() } }, el('option', { value: DEFAULTS.classAttr }, `${DEFAULTS.classAttr}${hasAttr(DEFAULTS.classAttr) ? '' : ' (anlegen)'}`), ...attrs().filter(a => a.key !== DEFAULTS.classAttr && (a.type === 'text' || a.type === 'enum')).map(a => el('option', { value: a.key }, `${lbl(a)} (${a.key})`)))
    classSel.value = cache.settings.classAttr
    // Regeln der Ausleitung (unbekannt, Klasse Pflicht, Vollständigkeit) stehen seit 22.09. im BMEcat-Profil (xport), nicht hier
    // Gruppe ETIM gilt erst, wenn sie an einem Knoten des Pfads hängt (GroupsAttached) — hier an einen Teilbaum hängen
    const attached = tree.rows.filter(r => (r.groups ?? '').split(',').includes(groupKey()))
    const attachBtn = el('button', { 'data-demo': 'aus', class: 'x', title: t_('die Attributgruppe {0} an einen Teilbaum hängen — erst dann gelten die Attribute an den Knoten darunter', [groupKey()]) }, t_('⌗ Gruppe an Teilbaum{0}', [attached.length ? ` · ${attached.length}` : '']))
    const attachPick = el('div', { class: 'picker', style: 'position:absolute;left:0;top:28px;z-index:5;width:380px;display:none;padding:6px;background:var(--pane)' })
    ctx.treePicker(attachPick, { roles: ['group'], height: 300, onPick: async r => { attachPick.style.display = 'none'; const groups = [...new Set([...(r.groups ?? '').split(',').filter(Boolean), groupKey()])]; await api.post(`/api/nodes/${encodeURIComponent(r.id)}/groups`, { groups }, 'PUT'); await tree.load?.(); say(t_('Gruppe {0} hängt an {1}', [groupKey(), r.label])); draw() } })
    attachBtn.addEventListener('click', () => { attachPick.style.display = attachPick.style.display === 'none' ? 'block' : 'none' })
    const allFeats = allFeatures(); for (const f of allFeats.values()) f.n = f.classes.length
    const missing = [...allFeats.values()].filter(f => !hasAttr(attrKeyOf(f.code)))
    body.append(section(t_('3 · Attribute'), t_('{0} ETIM-Attribute · {1} nicht zugeordnet', [allFeats.size, missing.length]),
      el('div', { style: 'display:flex;gap:12px;align-items:center;padding:6px 0;flex-wrap:wrap' }, el('label', { class: 'muted' }, t_('Gruppe') + ' ', groupSel), groupKey() !== 'etim' ? el('button', { class: 'x', title: t_('ETIM-Attribute den vorhandenen Attributen der Gruppe {0} nach Namen zuordnen (ab 80 % Ähnlichkeit); der Rest wird angelegt', [groupKey()]), onclick: guessInGroup }, t_('↻ in {0} zuordnen', [groupKey()])) : null, el('label', { class: 'muted' }, t_('Klasse in') + ' ', classSel),
        el('button', { 'data-demo': 'aus', class: 'primary', title: t_('Klassenattribut {0} als Werteliste der übernommenen Klassen und je fehlendem ETIM-Attribut ein Attribut (ef…) in der Gruppe {1} anlegen', [cache.settings.classAttr, groupKey()]), onclick: createAttributes }, t_('＋ Attribute anlegen ({0})', [missing.length + (hasAttr(cache.settings.classAttr) ? 0 : 1)])),
        el('span', { style: 'position:relative' }, attachBtn, attachPick))))
    // Zuordnung
    // Zuordnung: Standard ist ein vorhandenes Attribut mit ƒ; das eigene ef… ist der Ausweg
    const mapBody = el('tbody')
    const filterCls = st.mapFilter ? cache.classes.get(st.mapFilter) : null
    const featList = [...allFeats.values()].filter(f => !filterCls || filterCls.features.some(x => x.code === f.code)).sort((a, b) => a.code.localeCompare(b.code))
    for (const f of featList) {
      const cur = attrKeyOf(f.code); const steps = stepsOf(f.code)
      const sel = el('select', { style: 'width:100%', onchange: e => { const v = e.target.value; const keep = steps ? { steps } : null; if ((v === f.code.toLowerCase() || !v) && !keep) delete cache.map[f.code]; else cache.map[f.code] = keep ? { to: v || f.code.toLowerCase(), ...keep } : v; saveMap(); draw() } }, el('option', { value: '' }, hasAttr(f.code.toLowerCase()) ? `${f.code.toLowerCase()} (eigenes)` : t_('— eigenes ef… anlegen —')), ...attrs().map(a => el('option', { value: a.key }, `${lbl(a)} (${a.key})`)))
      sel.value = typeof cache.map[f.code] === 'string' ? cache.map[f.code] : cache.map[f.code]?.to ?? ''
      const fx = el('button', { class: steps ? 'primary' : 'x', title: steps ? t_('ƒ {0} — ändern', [describeSteps(steps)]) : t_('ƒ Umwandlung: Einheit umrechnen, ja/x → Ja/Nein, Text → EV-Code nach Tabelle, von/bis verbinden'), onclick: () => stepsDialog(f) }, 'ƒ')
      mapBody.append(el('tr', { 'data-ef': f.code, style: f.code === efParam ? 'outline:2px solid var(--warn);outline-offset:-2px' : '' }, el('td', { class: 'mono' }, f.code), el('td', {}, featureText(f, locale)), el('td', { class: 'muted' }, TYPE[f.type] ?? f.type, f.type === t_('Alphanumeric') ? ` (${f.values.length})` : ''), el('td', { class: 'num muted' }, f.n), el('td', { class: hasAttr(cur) ? '' : 'warn' }, sel), el('td', {}, fx)))
    }
    const backRow = st.backNode ? tree.byId.get(st.backNode) : null
    const mapSec = section(t_('4 · Zuordnung'), t_('ETIM-Attribut ← Attribut, ƒ = Umwandlung; leer = eigenes Attribut ef… (wird angelegt) · jede Änderung wird sofort gespeichert{0}', [filterCls ? ` · nur ${filterCls.code}` : '']),
      filterCls ? el('div', { class: 'chips', style: 'padding:4px 0' },
        backRow ? el('button', { class: 'primary', title: t_('zurück zum Knoten {0} — in die Gruppe {1}', [backRow.label, groupKey()]), onclick: () => ctx.go?.(`/tree/${encodeURIComponent(backRow.id)}?group=${encodeURIComponent(groupKey())}`) }, `← ${ICON[backRow.role] ?? ''} ${backRow.label}`) : null,
        el('span', { class: 'chip' }, t_('{0} {1} · {2} ETIM-Attribute', [filterCls.code, nameOf(filterCls.name, locale), featList.length])), el('button', { class: 'x', title: t_('alle ETIM-Attribute aller Klassen in Gebrauch'), onclick: () => { st.mapFilter = null; st.backNode = null; draw() } }, t_('✕ Filter')),
        el('span', { class: 'muted', style: 'font-size:12px' }, t_('Auswahl im Feld = gespeichert; ƒ öffnet die Umwandlung'))) : null,
      allFeats.size ? el('table', { class: 'grid', style: 'width:100%' }, el('thead', {}, el('tr', {}, el('th', { style: 'width:90px' }, 'ETIM-Attribut'), el('th', {}, 'Name [Einheit]'), el('th', { style: 'width:100px' }, 'Typ'), el('th', { style: 'width:50px' }, 'Kl.'), el('th', { style: 'width:280px' }, t_('Attribut')), el('th', { style: 'width:36px' }, 'ƒ'))), mapBody) : el('div', { class: 'empty' }, t_('keine Klassen übernommen')))
    mapSec.id = 'etim-map'
    body.append(mapSec)
    // (5 · Prüfung war hier — seit 22.09. die Stufe „Daten“ der Übersicht; check() prüft den gewählten Knoten)
  }
  st.relInfo = await ctx.data.get('release')
  root.append(el('div', { class: 'toolbar' }, el('h1', {}, '⌗ ETIM'), el('span', { class: 'muted', style: 'font-size:12px' }, t_('Quelle, Klassen, Attribute, Zuordnung — bedient wird am Knoten (Band ⌗ ETIM)')), el('span', { class: 'grow' }), status, el('button', { class: 'x', title: t_('Anfangszustand zum Testen: Zuweisungen, Modell (Gruppe, Attribute, Sichten), Zuordnung — auf Wunsch auch die geladenen Freigaben'), onclick: resetDialog }, t_('⟲ zurücksetzen …'))), body)
  if (st.mapFilter) setTimeout(() => (document.querySelector(`tr[data-ef="${efParam}"]`) ?? document.getElementById('etim-map'))?.scrollIntoView({ block: 'center' }), 0)
  draw()
  return () => {}
}

/// Einstellungen aus früheren Versionen nennen eine Gruppe oder ein Klassenattribut, die es im Modell nicht (mehr) gibt: es gelten wieder die Namen des Systems
async function veralteteEinstellungen(ctx) {
  const m = ctx.store.model; let geaendert = false
  if (cache.settings.group && !(m?.groups ?? []).some(g => g.key === cache.settings.group)) { delete cache.settings.group; geaendert = true }
  if (cache.settings.classAttr !== DEFAULTS.classAttr && !(m?.attributes ?? []).some(a => a.key === cache.settings.classAttr)) { cache.settings.classAttr = DEFAULTS.classAttr; geaendert = true }
  if (geaendert) await ctx.data.set('settings', cache.settings)
}

// Einmal beim Einschalten. Die Attribute selbst entstehen erst mit der
// ersten Klasse — die Gruppe allein kostet nichts: die ETIM-Attribute tragen Bedingungen und gelten nur, wo ihre Klasse gilt.
async function install(ctx) {
  const { api, store, tree } = ctx; const ops = modelOps(ctx)
  await cache.loaded; if (!tree.loaded) await tree.load()
  await veralteteEinstellungen(ctx)
  // Die Systemobjekte des Plugins, ohne die es nicht arbeiten kann: die Gruppe ETIM und das Klassenattribut. Der Server meldet sie an — solange
  // das Plugin an ist, lassen sie sich nicht zurückziehen.
  const sys = ops.system()
  const fehlt = !(store.model?.groups ?? []).some(g => g.key === sys.group) || !(store.model?.attributes ?? []).some(a => a.key === sys.classAttr)
  if (fehlt && !(await ctx.system?.ankuendigen?.({ label: 'ETIM', text: t_('Das Plugin legt die Attributgruppe {0} mit dem Attribut {1} an und hängt die Gruppe an die Wurzeln. Ohne sie arbeitet es nicht, und solange es an ist, lassen sie sich nicht zurückziehen.', [sys.group, sys.classAttr]) }) ?? true)) return false   // abgelehnt: das Plugin ist wieder aus
  await ops.ensureClassAttr(); await store.poll(true)
  const roots = tree.rows.filter(r => !r.parent && r.role !== 'rubric')
  for (const root of roots) {
    const have = (root.groups ?? '').split(',').filter(Boolean)
    if (have.includes(groupKey())) continue
    await api.post(`/api/nodes/${encodeURIComponent(root.id)}/groups`, { groups: [...have, groupKey()] }, 'PUT')
  }
  await store.poll(true); await tree.load?.()
}

/// Die Klasse, die an einer Zeile gilt (eigen oder geerbt) — aus dem Cache, den das Plugin ohnehin führt
function classOfRow(row) { const v = klasseVon(row?.id); return v ? cache.classes.get(v.code) ?? null : null }
/// Alle Nachfahren — falls der Baum kein below() mitbringt
export default {
  install,
  views: [
    { path: 'etim', label: 'ETIM', icon: '⌗', topic: 'classification', hint: t_('ETIM: Quelle und Versionen, Klassen in Gebrauch, Attribute, Zuordnung ETIM-Attribut ← Attribut mit ƒ — bedient wird am Knoten (Band ⌗ ETIM)'), mount },
    { path: 'coverage', label: 'ETIM-Attribute', icon: '⌗', topic: 'analysis', hint: t_('Datenanalyse wie DPP/PPWR: welche ETIM-Attribute der ETIM-Klassen fehlen — Attribute anlegen, Vorschläge aus Regeln, KI oder Recherche im Internet, übernehmen'), mount: async (root, ctx) => { await cache.loaded; return ctx.compliance.mount(root, ctx, buildCatalog(ctx)) } },
  ],
  nodeBands: [
    { key: 'etim', label: 'ETIM', icon: '⌗', roles: ['group', 'product', 'variant'], mount: bandMount },   // Klasse · Attribute · Daten am Knoten
  ],
  nodeActions: [
    // die zugewiesene Klasse (auch geerbt) als eigener Punkt: Klick → Knotenansicht, direkt in der Attributgruppe (Reiter oder Liste)
    { label: row => { const c = klasseVon(row.id); return c ? `${c.code} ${nameOf(cache.classes.get(c.code)?.name, 'de') || ''}`.trim() : null }, hint: row => { const c = klasseVon(row.id); return c ? (c.own ? t_('Klasse hier · ETIM-Attribute pflegen') : t_('Klasse geerbt · ETIM-Attribute pflegen')) : '' }, icon: '⌗', topic: 'classification', roles: ['group', 'product', 'variant'], run(id, ctx) { return ctx.go?.(`/tree/${encodeURIComponent(id)}?group=${encodeURIComponent(groupKey())}`) } },
    { label: row => klasseVon(row.id) ? t_('ETIM-Klasse ändern (+)') : t_('ETIM-Klasse (+)'), hint: t_('Klasse wählen — Vorschlag, Umfeld, Suche'), icon: '⌗', topic: 'classification', roles: ['group', 'product'], run(id, ctx) { return classDialog(id, ctx) } },   // (+): auch zum Zufügen
  ],
  checks,
  featuresOf: etimFeatures,
  gate: etimGate,
  resolveValue,
}
