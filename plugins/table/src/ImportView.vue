<script setup>
// ⇩ Import → Tabelle (Basis-Plugin table; Taloan, 17.09.2026): eine Tabelle aus Datei (CSV, Excel, JSON — die Quelle liefert ein Plugin
// über importers) oder aus der Zwischenablage; der Datenmapper (mapper.js) schlägt die Zuordnung vor, der Mensch
// richtet nach, der Plan sagt, was passiert, der Stapel schreibt. Profile (Zuordnung, Ziel, Rolle) im Journal.
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api, store, tree, icon, plugins, mapper, transform, recentFiles, Splitter, ImportHead, TreePicker, paneWidth } from 'journali'
import { t as t_ } from 'journali'
import { L } from 'journali'
const { suggest, plan: makePlan, parseDelimited, childAttributes, childRoleOf } = mapper
const leftW = paneWidth('import.table', 720)
const router = useRouter()
const route = useRoute()
// Knotenmodus (Taloan, 17.09.: Rechtsklick auf Gruppe/Produkt → Excel importieren): die Tabelle passt 1:1 zum Knoten —
// Ziel und Rolle sind fest, jede Spalte muss ein Attribut sein, das dort für die Kinder gilt; nichts Neues wird angelegt.
const fixed = ref(null)         // { row, childRole, allowed: Set<attr> }
async function fixNode(id) {
  if (!id) { fixed.value = null; return }
  if (!tree.loaded) await tree.load()
  const row = tree.byId.get(id); if (!row) { store.toast(t_('Knoten {0} unbekannt', [id])); return }
  const n = await api.get(`/api/nodes/${encodeURIComponent(id)}`)
  const childRole = childRoleOf(row, tree.kids(id))
  const allowed = new Set(childAttributes(model.value, n, childRole).map(a => a.key))
  for (const a of row.axes ?? []) allowed.add(a)
  fixed.value = { row, childRole, allowed }
  pickTarget(row); role.value = childRole; external.value = ''
  if (source.value) resuggest()
}
watch(() => route.query.node, id => fixNode(id), { immediate: true })

const model = computed(() => store.model)
const locales = computed(() => model.value?.locales.map(l => l.code) ?? [])
const source = ref(null)        // { name, columns, rows, sheets?, sheet? , importer? }
const mapping = ref([])         // aus suggest(), vom Menschen geändert
const target = ref(null)        // Baumzeile
const role = ref('')            // '' = automatisch (unter Gruppe: Produkt, unter Produkt: Variante)
const external = ref('')        // System der externen Kennung (Spalte „external“)
const busy = ref('')
const planned = ref(null)
const result = ref(null)
const log = ref([])
const pasteText = ref('')
const dragOver = ref(false)
const say = m => log.value.unshift(`${new Date().toLocaleTimeString('de-DE')} ${m}`)

const attrs = computed(() => (model.value?.attributes ?? []).filter(a => a.type !== 'rows'))
const targetPick = ref(false)
// Ziel per Auswahlbaum (Taloan): ohne Ziel steht der Baum offen, mit Ziel ein Chip — Klick auf den Chip klappt ihn wieder auf
function pickTarget(r) { target.value = r; targetPick.value = false; planned.value = null }

// ---- Quelle
// Datei-Handle (File System Access API, Chrome/Edge): damit liest ↻ die Datei jederzeit neu von der Platte —
// ein File aus <input type=file> ist ein Schnappschuss und lässt sich nach einer Änderung nicht mehr lesen.
const fileHandle = ref(null)
const canPick = typeof window.showOpenFilePicker === 'function'
// Zuletzt gewählte Dateien (Taloan, 21.09.): 5 Chips im Ablagebereich — mit Handle wieder zu öffnen, hineingezogene nur dem Namen nach
const recent = ref([])
async function loadRecent() { recent.value = await recentFiles.list('table') }
async function remember(name, handle) { await recentFiles.remember('table', name, handle); await loadRecent() }
async function openRecent(r) {
  const f = await recentFiles.reopen(r)
  if (!f) { store.toast(r.handle ? t_('{0}: nicht mehr lesbar — neu wählen', [r.name]) : t_('{0}: war hineingezogen — bitte wieder ziehen oder wählen', [r.name])); return }
  fileHandle.value = r.handle; await takeFile(f); remember(f.name, r.handle)
}
async function pickFile(e) {
  if (!canPick) return   // Fallback: das <input type=file> im Label
  e.preventDefault()
  try {
    const [h] = await window.showOpenFilePicker({ multiple: false })
    fileHandle.value = h
    const f = await h.getFile()
    await takeFile(f); remember(f.name, h)
  } catch (err) { if (err?.name !== 'AbortError') store.toast(err.message) }
}
async function reloadFile() {
  if (fileHandle.value) {
    try { await takeFile(await fileHandle.value.getFile(), true); store.toast(t_('{0}: neu gelesen', [source.value?.name]), 'ok') } catch (err) { store.toast(err.message) }
  } else document.querySelector('#table-file-input')?.click()
}
async function takeFile(file, keepSheet = false) {
  // Rohdaten-JSON (Knotenbaum { model, node } oder Knoten mit id/role/values) gehört in den JSON-Import, nicht in die Tabelle (Taloan)
  if (/\.json$/i.test(file.name)) {
    try { const j = JSON.parse(await file.text()); const n = j?.node ?? j; if (n && !Array.isArray(n) && n.id && n.role && Array.isArray(n.values)) { store.toast(t_('Knotenbaum erkannt → JSON-Import'), 'ok'); store.pendingImport = { file, parent: target.value || null }; router.push('/p/json/import'); return } } catch { /* dann wie eine Tabelle */ }
  }
  const sheet = keepSheet ? source.value?.sheet : null
  const imp = plugins.importerFor(file.name)
  busy.value = `lese ${file.name} …`
  try {
    let t
    if (imp) t = await imp.parse(file, plugins.ctx(imp.key))
    else if (/\.(csv|txt|tsv)$/i.test(file.name)) t = parseDelimited(await file.text())
    else if (/\.json$/i.test(file.name)) { const { fromObjects } = mapper; const j = JSON.parse(await file.text()); t = fromObjects(Array.isArray(j) ? j : (j.rows ?? j.items ?? j.data ?? [])) }
    else throw new Error(t_('Kein Importer für {0} — Plugin für dieses Format einschalten (⌁ Plugins)', [file.name]))
    setSource({ ...t, name: file.name, importer: imp?.key ?? null })
    if (sheet && source.value?.sheets?.some(s => s.name === sheet)) pickSheet(sheet)
  } catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
// Zuordnung des gewählten Profils — gilt auch für eine Datei, die erst danach kommt (Taloan, 21.09.: „Profil gespeichert, raus, rein, Datei gedroppt — wo ist meine Funktion?“)
let profileMapping = null
function applyProfile() {
  if (!profileMapping) return
  for (const m of mapping.value) { const s = profileMapping[m.column]; if (s) Object.assign(m, JSON.parse(JSON.stringify(s))) }
  // Datei geladen, Profil darübergelegt = der Ausgangsstand — nicht „geändert“ (Taloan, 21.09.: „kommt sofort die Meldung, ist das richtig?“ — nein)
  setTimeout(() => window.dispatchEvent(new CustomEvent('journali:profile-applied')), 0)
}
function setSource(t) {
  if (t.sheets && !t.columns) { t.sheet = t.sheets[0]?.name; const s = t.sheets[0]; t.columns = s?.columns ?? []; t.rows = s?.rows ?? [] }
  source.value = t
  mapping.value = strictify(suggest(t.columns, t.rows, model.value, { external: external.value || null }))
  applyProfile()
  planned.value = null; result.value = null
  say(t_('{0}: {1} Zeilen, {2} Spalten — {3} Spalten zugeordnet, {4} neu, {5} übergangen', [t.name, t.rows.length, t.columns.length, mapping.value.filter(m => m.target === 'attr').length, mapping.value.filter(m => m.target === 'new').length, mapping.value.filter(m => m.target === 'skip').length]))
}
function pickSheet(name) { const s = source.value.sheets.find(x => x.name === name); if (!s) return; setSource({ ...source.value, sheet: name, columns: s.columns, rows: s.rows }) }
function takePaste() { const t = parseDelimited(pasteText.value); if (!t.columns.length) return; setSource({ ...t, name: t_('Zwischenablage') }); pasteText.value = '' }
// Strg+V irgendwo in der Ansicht (kein Eingabefeld): die Zwischenablage als Tabelle — die eigene Zeile dafür ist weg (Taloan, 21.09.)
function onPasteAnywhere(e) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) return
  const text = e.clipboardData?.getData('text/plain') ?? ''
  if (!text.includes('\n') && !text.includes('\t')) return
  pasteText.value = text; takePaste(); e.preventDefault()
}
async function onDrop(e) {
  dragOver.value = false
  // mit Handle, wenn der Browser es hergibt (Chrome/Edge: getAsFileSystemHandle) — dann ist die Datei später wieder zu öffnen
  // Datei und Handle-Anfrage SOFORT greifen — nach dem ersten await ist der DataTransfer leer (Taloan, 21.09.: „liest nichts mehr ein“)
  const f = e.dataTransfer.files?.[0]; if (!f) return
  const item = e.dataTransfer.items?.[0]
  const handleP = item?.getAsFileSystemHandle ? item.getAsFileSystemHandle().catch(() => null) : Promise.resolve(null)
  let h = null; try { const x = await handleP; if (x?.kind === 'file') h = x } catch {}
  fileHandle.value = h; await takeFile(f); remember(f.name, h)
}
// ↻ Zuordnung neu vorschlagen: bewusst OHNE das Profil — sonst tut der Knopf nichts (Taloan, 21.09.: „funktioniert nicht“); Kennung ändern behält es
function resuggest(keepProfile = false) { if (source.value) { mapping.value = strictify(suggest(source.value.columns, source.value.rows, model.value, { external: external.value || null })); if (keepProfile) applyProfile() } planned.value = null }
// Knotenmodus: was nicht zum Knoten passt, wird übergangen und gezählt — Vorlage vom Knoten exportieren, dann passt es
function strictify(m) {
  if (!fixed.value) return m
  for (const x of m) {
    if (x.target === 'new') { x.target = 'skip'; x.why = t_('unbekannt — nicht in der Vorlage dieses Knotens'); x.unknown = true }
    else if (x.target === 'attr' && !fixed.value.allowed.has(x.attribute)) { x.target = 'skip'; x.why = t_('{0} gilt hier nicht für {1}', [x.attribute, roleLabel[fixed.value.childRole]]); x.unknown = true }
    else if (x.target === 'parent' || x.target === 'external') { x.target = 'skip'; x.why = t_('im Knotenmodus ohne Bedeutung') }
  }
  return m
}
const roleLabel = { group: t_('Gruppen'), product: t_('Produkte'), variant: t_('Varianten') }
const unknown = computed(() => mapping.value.filter(m => m.unknown).length)

// ---- Zuordnung: Zeile je Spalte
const TARGETS = [['attr', t_('Attribut')], ['new', t_('neues Attribut')], ['status', t_('Status')], ['id', 'journali-Id'], ['external', t_('externe Kennung')], ['parent', t_('Elternteil')], ['skip', t_('übergehen')]]
const sample = (i) => source.value.rows.slice(0, 200).map(r => r[i]).filter(v => String(v ?? '').trim() !== '').slice(0, 3).map(v => String(v).slice(0, 30)).join(' · ')
// Umwandlung je Spalte (Taloan, 21.09., OpenDXP-Importer: „Werte umwandeln, in die Daten eingreifen“): Kette in m.steps, Editor je Zeile, Vorschau der Beispiele
const stepsOpen = ref(null)   // Spalte, deren Kette gerade offen ist
// Zuordnung als Zeilen (eine je Spalte) oder als Spalten wie in Excel — nach rechts scrollen statt nach unten (Taloan, 21.09.:
// „was hindert mich, endlos nach rechts zu scrollen?“ — nichts; beides bleibt lesbar, die Felder werden nie mehr gequetscht)
const layout = ref(localStorage.getItem('journali.import.layout') || 'rows')
function setLayout(l) { layout.value = l; localStorage.setItem('journali.import.layout', l) }
const samples = i => source.value.rows.slice(0, 200).map(r => r[i]).filter(v => String(v ?? '').trim() !== '').slice(0, 3).map(v => String(v).slice(0, 40))
const OPS = transform.OPS
const { FIELDS, FIELD_LABEL, FIELD_HINT, opHint } = transform   // Felder je Schritt liegen bei der Kette (auch die ETIM-Zuordnung nutzt sie)
function addColumn(step, col) { if (!col) return; const cur = String(step.columns ?? '').trim(); step.columns = cur ? cur.replace(/,\s*$/, '') + ',' + col : col; planned.value = null }
function addStep(m, op) { if (!op) return; (m.steps ??= []).push(op === 'boolean' ? { op, yes: transform.YES_DEFAULT } : { op }); planned.value = null }
function delStep(m, i) { m.steps.splice(i, 1); if (!m.steps.length) delete m.steps; planned.value = null }
function moveStep(m, i, d) { const j = i + d; if (j < 0 || j >= m.steps.length) return; [m.steps[i], m.steps[j]] = [m.steps[j], m.steps[i]]; planned.value = null }
const preview = (m, i) => { const rows = source.value.rows.slice(0, 200).filter(r => String(r[i] ?? '').trim() !== '').slice(0, 3); const cols = source.value.columns; return rows.map(r => String(transform.apply(m.steps, r[i], { get: c => { const j = cols.indexOf(c); return j < 0 ? '' : r[j] } })).slice(0, 30)).join(' · ') }
const stepsText = m => m.steps?.length ? transform.describe(m.steps) : ''
// Ziel Status (Taloan, 22.09.): Quellwert → Status aus dem Modell als Tabelle; gespeichert als Schritt „map“ (alt=neu; …) und damit im Profil
const distinctValues = m => { const i = source.value?.columns.indexOf(m.column) ?? -1; const set = new Set(); if (i < 0) return []; for (const r of source.value.rows) { const v = String(r[i] ?? '').trim(); if (v) set.add(v); if (set.size >= 60) break } return [...set] }
const mapStep = m => { let s = (m.steps ?? []).find(x => x.op === 'map'); if (!s) (m.steps ??= []).push(s = { op: 'map', pairs: '', other: '' }); return s }
const pairsOf = s => Object.fromEntries(String(s.pairs ?? '').split(';').map(p => p.split('=')).filter(p => p.length === 2).map(([a, b]) => [a.trim().toLowerCase(), b.trim()]))
const statusFor = (m, v) => pairsOf(mapStep(m))[v.toLowerCase()] ?? (store.status(v) ? v : '')
function setStatusFor(m, v, key) { const s = mapStep(m); const p = Object.fromEntries(String(s.pairs ?? '').split(';').map(x => x.split('=')).filter(x => x.length === 2).map(([a, b]) => [a.trim(), b.trim()])); for (const k of Object.keys(p)) if (k.toLowerCase() === v.toLowerCase()) delete p[k]; if (key) p[v] = key; s.pairs = Object.entries(p).map(([a, b]) => `${a}=${b}`).join('; '); planned.value = null }
function onTarget(m) { planned.value = null; if (m.target === 'status') { mapStep(m); stepsOpen.value = m.column }; if (m.target === 'attr' && !m.attribute) m.attribute = attrs.value[0]?.key ?? null; if (m.target === 'new' && !m.newKey) m.newKey = m.column.toLowerCase().replace(/[^a-z0-9]+/g, '_'); syncLocale(m) }
function syncLocale(m) { const a = attrs.value.find(x => x.key === m.attribute); if (m.target === 'attr' && a && !a.perLocale) m.locale = null; if (m.target === 'attr' && a?.perLocale && !m.locale) m.locale = model.value?.masterLocale ?? locales.value[0] }
const uniqueKeys = computed(() => new Set((model.value?.attributes ?? []).filter(a => a.unique).map(a => a.key)))
const keyColumn = computed(() => mapping.value.find(m => ['id', 'external'].includes(m.target) || (m.target === 'attr' && uniqueKeys.value.has(m.attribute))))   // eindeutige Attribute finden (Taloan, 21.09.)
// Eigene Ids in der Datei (Taloan, 21.09.: „dann dürfen id und parent auf keinen Fall änderbar sein — stillschweigend versteckt, und den Baum
// braucht man nicht auszusuchen“): trägt die Id-Spalte Ids, die es im Baum gibt, sind id und parent fest und weg aus der Zuordnung;
// das Ziel braucht es nur für Zeilen, deren Id der Baum nicht kennt (neu) — dann sagt es die Analyse
// Id + Wurzel (Taloan, 21.09.: „zwei Datenbanken, per Excel übertragen — ein Zufallstreffer bei der Id reicht nicht“): nennt die Datei
// journali_root, gilt eine Id nur, wenn der Knoten hier unter genau dieser Wurzel hängt; sonst ist die Zeile fremd (neu)
const rootOfNode = id => { const a = tree.ancestors(id); return a.length ? a[0].id : id }
const idOk = row => { const m = mapping.value.find(x => x.target === 'id'); if (!m) return false; const i = mapping.value.indexOf(m); const id = String(row[i] ?? '').trim(); if (!tree.byId.has(id)) return false; const ir = mapping.value.findIndex(x => x.target === 'root'); const want = ir >= 0 ? String(row[ir] ?? '').trim() : (m.root ?? ''); return !want || rootOfNode(id) === want }
const idLocked = computed(() => { if (!source.value || !mapping.value.some(x => x.target === 'id')) return false; return source.value.rows.slice(0, 200).some(idOk) })
const unknownIds = computed(() => idLocked.value ? source.value.rows.filter(r => !idOk(r)).length : 0)
const foreignRoot = computed(() => { if (!source.value) return 0; const m = mapping.value.find(x => x.target === 'id'); if (!m) return 0; const i = mapping.value.indexOf(m); if (!m.root && !mapping.value.some(x => x.target === 'root')) return 0; return source.value.rows.filter(r => tree.byId.has(String(r[i] ?? '').trim()) && !idOk(r)).length })
// gesperrt: alle eigenen Spalten (journali_*, id, parent, role, status) verschwinden aus der Zuordnung (Taloan, 21.09.: „beim Import verstecken“)
const visibleMapping = computed(() => idLocked.value ? mapping.value.filter(m => !m.internal && m.target !== 'id' && m.target !== 'parent' && m.target !== 'root') : mapping.value.filter(m => m.target !== 'root'))
const groups = computed(() => model.value?.groups ?? [])
// Schreiben erst, wenn nichts mehr im Weg steht: ungültige Zellen (korrigieren), neue Spalten ohne Gruppe, im Knotenmodus gar keine ungültigen
const blockers = computed(() => {
  const p = planned.value; if (!p) return []
  const out = []
  if (p.stats.invalid.length) out.push(fixed.value ? t_('{0} Werte passen nicht zum Typ — Datei abgelehnt, in Excel korrigieren', [p.stats.invalid.length]) : t_('{0} Werte passen nicht zum Typ — unten korrigieren', [p.stats.invalid.length]))
  if (p.stats.missingGroup.length) out.push(t_('neue Attribute ohne Attributgruppe: {0}', [p.stats.missingGroup.join(', ')]))
  return out
})
// Korrektur einer Zelle direkt in der Quelle; danach neu analysieren
const changeTab = ref('update'); const openRow = ref(null)
// Vorschau öffnet den ersten Reiter, in dem etwas steht (Taloan, 21.09.: „2 neue Zeilen, aber nichts angezeigt“ — der Reiter stand auf „geändert“)
watch(() => planned.value?.stats, st => { if (!st) return; changeTab.value = st.create ? 'create' : st.update ? 'update' : 'unchanged'; openRow.value = null })
const attrLabel = key => { const a = attrs.value.find(x => x.key === key) ?? store.model?.attributes?.find(x => x.key === key); return L(a?.label) || key }
function fixCell(inv, v) { source.value.rows[inv.row][inv.column] = v; planned.value = { ...planned.value, stale: true } }
// Was das Attribut erwartet (Taloan, 21.09.: „warum ganze Zahl?“ — weil das Attribut so definiert ist; das steht jetzt dabei)
const TYPE_DE = { text: t_('Text'), html: 'HTML', integer: t_('ganze Zahl'), decimal: t_('Zahl'), boolean: 'ja/nein', date: t_('Datum'), enum: t_('Listenwert') }
function typeHint(inv) { const a = attrs.value.find(x => x.key === inv.key) ?? store.model?.attributes?.find(x => x.key === inv.key); return a ? t_('Attribut {0} ist {1}{2}{3} — im Modell änderbar', [a.key, TYPE_DE[a.type] ?? a.type, a.multiple ? ', mehrfach' : '', a.list ? ' ' + t_('(Liste') + ' ' + a.list + ')' : '']) : t_('Attribut {0}', [inv.key]) }

// ---- Plan
async function analyse() {
  if (!source.value) return
  if (!target.value && !mapping.value.some(m => m.target === 'parent') && !(idLocked.value && unknownIds.value === 0)) { store.toast(idLocked.value ? t_('Ziel wählen — {0} Zeilen haben Ids, die der Baum nicht kennt (neu)', [unknownIds.value]) : t_('Ziel wählen (Gruppe oder Produkt) — oder eine Spalte „Elternteil“')); return }
  busy.value = t_('vergleiche mit dem Bestand …')
  try {
    await tree.load(true)
    // Bestand: Werte der betroffenen Attribute unter dem Ziel (je Sprache ein Aufruf), zum Vergleichen
    const keys = [...new Set(mapping.value.filter(m => m.target === 'attr').map(m => m.attribute))]
    const locs = [...new Set(mapping.value.filter(m => m.target === 'attr').map(m => m.locale ?? ''))]
    const existing = new Map()
    // Bestand nur für die Zeilen holen, die es schon gibt (Taloan, 21.09.: „darf das Vergleichen bei 11 Zeilen eine Minute dauern?“ — vorher die
    // ganze Wurzel tief): gefunden über Id, externe Kennung oder ein eindeutiges Attribut; je Elternteil ein Aufruf (die Subitems als Tabelle), je Sprache
    const iId = mapping.value.findIndex(m => m.target === 'id'), iExt = mapping.value.findIndex(m => m.target === 'external')
    const keyCols = mapping.value.map((m, i) => m.target === 'attr' && uniqueKeys.value.has(m.attribute) && !m.locale ? i : -1).filter(i => i >= 0)
    const byKey = new Map(); for (const r of tree.rows) for (const [k, v] of Object.entries(r.keys ?? {})) byKey.set(k + '\u0001' + String(v).trim(), r)
    const byExt = new Map(external.value ? tree.rows.filter(r => r.external?.[external.value]).map(r => [String(r.external[external.value]), r]) : [])
    const parents = new Map()   // Elternteil → Ids der gefundenen Knoten darunter
    for (const row of source.value.rows) {
      const id = String(row[iId] ?? '').trim(), ext = String(row[iExt] ?? '').trim()
      const viaKey = keyCols.map(i => byKey.get(mapping.value[i].attribute + '\u0001' + String(row[i] ?? '').trim())).find(Boolean)   // über jedes eindeutige Attribut
      const n = (iId >= 0 && id && tree.byId.get(id)) || (iExt >= 0 && ext && byExt.get(ext)) || viaKey || null
      if (n) { const key = n.parent ?? '#root'; if (!parents.has(key)) parents.set(key, new Set()); parents.get(key).add(n.id) }
    }
    let done = 0
    for (const [pid, ids] of parents) for (const loc of locs) {
      busy.value = t_('vergleiche mit dem Bestand … {0}/{1}', [++done, parents.size * locs.length])
      const url = pid === '#root' ? null : `/api/nodes/${encodeURIComponent(pid)}/table?attributes=${encodeURIComponent(keys.join(','))}${loc ? '&locale=' + loc : ''}`
      const t = url ? await api.get(url) : { rows: [] }
      for (const r of t.rows) {
        if (!ids.has(r.row.id)) continue
        const cur = existing.get(r.row.id) ?? {}
        for (const [k, v] of Object.entries(r.values)) if (v.value != null) { cur[`${k}|${loc}`] = v.value; cur[`${k}|${loc}#own`] = v.own }
        existing.set(r.row.id, cur)
      }
      // Wurzelknoten selbst (ohne Elternteil) einzeln
      if (pid === '#root') for (const id of ids) { const t2 = await api.get(`/api/nodes/${encodeURIComponent(id)}/table?self=true&attributes=${encodeURIComponent(keys.join(','))}${loc ? '&locale=' + loc : ''}`); for (const r of t2.rows) { if (r.row.id !== id) continue; const cur = existing.get(id) ?? {}; for (const [k, v] of Object.entries(r.values)) if (v.value != null) { cur[`${k}|${loc}`] = v.value; cur[`${k}|${loc}#own`] = v.own }; existing.set(id, cur) } }
    }
    planned.value = makePlan({ columns: source.value.columns, rows: source.value.rows, mapping: mapping.value.map(m => ({ ...m })), model: model.value, tree, target: target.value, role: role.value || null, existing, external: external.value || null })
    const s = planned.value.stats
    const nlv = Object.entries(s.newListValues ?? {}).map(([l, v]) => `${l}: ${Object.values(v).join(', ')}`)
    say(t_('Plan: {0} neu, {1} geändert, {2} unverändert, {3} Werte, {4} neue Attribute{5}{6}', [s.create, s.update, s.unchanged, s.values, planned.value.newAttributes.length, nlv.length ? t_(', neue Listenwerte — {0}', [nlv.join('; ')]) : '', s.problems.length ? t_(', {0} Probleme', [s.problems.length]) : '']))
  } catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
async function run() {
  if (!planned.value || !store.actor) { if (!store.actor) store.toast(t_('👤 Name fehlt → Einstellungen')); return }
  if (blockers.value.length || planned.value.stale) { store.toast(blockers.value[0] ?? t_('erst neu analysieren')); return }
  const p = planned.value
  busy.value = 'schreibe …'; result.value = null
  try {
    for (const a of p.newAttributes) await api.post(`/api/model/attributes/${a.key}`, a, 'PUT')
    // neue Listenwerte zuerst (Taloan, 20.09.): Schlüssel normiert, Bezeichnung in allen Sprachen der Text der Datei
    let nlv = 0
    for (const [list, vals] of Object.entries(p.stats.newListValues ?? {})) for (const [key, label] of Object.entries(vals)) { await api.post(`/api/model/lists/${list}/values/${encodeURIComponent(key)}`, { value: key, label: Object.fromEntries(model.value.locales.map(l => [l.code, label])) }, 'PUT'); nlv++ }
    if (nlv) say(t_('{0} Listenwerte angelegt', [nlv]))
    if (p.newAttributes.length) { await store.poll(true); say(t_('{0} Attribute angelegt: {1}', [p.newAttributes.length, p.newAttributes.map(a => a.key + ' → ' + a.group).join(', ')])) }
    const cmds = [...p.attach.map(x => ({ op: 'groups.attach', args: { node: x.node, groups: [...(tree.byId.get(x.node)?.groups ?? '').split(',').filter(Boolean), ...x.groups] } })), ...p.commands]   // groups.attach setzt die ganze Liste
    // Stapel in Happen: neue Knoten samt ihren Werten zusammen (Refs gelten nur im selben Aufruf)
    const batch = 'imp-' + Date.now().toString(36)
    const res = await api.batchChunked(cmds, { batch, size: 1000, label: 'Import (Tabelle): schreiben', onProgress: p => { busy.value = `schreibe … ${p.done}/${p.total}` } })
    const done = res.results.length
    if (res.error) throw new Error(`Befehl ${res.error.index + 1} (${res.error.op}): ${res.error.message} — ${done} geschrieben`)
    result.value = { written: done, batch: res.batch }
    say(`fertig: ${done} Einträge, Stapel ${batch}`)
    await tree.load(true); await store.poll(true)
    planned.value = null
  } catch (e) { store.toast(e.message); say('✗ ' + e.message) } finally { busy.value = '' }
}

// ---- Profil: Zuordnung (je Spaltenname), Ziel, Rolle, Kennung
const profileGet = () => ({ target: target.value?.id ?? null, role: role.value, external: external.value, mapping: Object.fromEntries(mapping.value.map(m => [m.column, { target: m.target, attribute: m.attribute, locale: m.locale, newKey: m.newKey, newType: m.newType, newGroup: m.newGroup, steps: m.steps?.length ? m.steps : undefined }])) })
function profileSet(p) {
  if (!p) { profileMapping = null; target.value = null; role.value = ''; external.value = ''; planned.value = null; return }
  role.value = p.role ?? ''; external.value = p.external ?? ''
  if (p.target && tree.byId.get(p.target)) pickTarget(tree.byId.get(p.target))
  profileMapping = p.mapping ?? null
  if (source.value) applyProfile()
  planned.value = null
}
onUnmounted(() => window.removeEventListener('paste', onPasteAnywhere))
onMounted(async () => {
  window.addEventListener('paste', onPasteAnywhere)
  loadRecent()
  if (!tree.loaded) await tree.load()
  // vom Baum gezogen (Drag & Drop auf einen Knoten): Datei lesen, Ziel setzen, Analyse gleich starten
  const p = store.pendingImport
  if (p?.file && !/\.json(\.gz)?$/i.test(p.file.name)) {
    store.pendingImport = null
    await takeFile(p.file)
    if (p.parent && tree.byId.get(p.parent)) pickTarget(tree.byId.get(p.parent))
    if (p.analyse && source.value && target.value) await analyse()
  }
})
</script>

<template>
  <div class="pane" :style="`width:${leftW}px;flex:none`">
    <ImportHead source="table" plugin="table" :busy="busy" :get="profileGet" :set="profileSet">
      <tr><td class="attr">{{ $t("Datei") }}</td><td class="row drop" :class="{ over: dragOver, empty: !source }" :title="source ? '' : $t('Datei hierher ziehen — oder aus Excel kopieren und hier Strg+V (erste Zeile = Spaltennamen)')" @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="onDrop">
        <label class="primary btn" :title="'CSV, TSV, JSON' + (plugins.importers.length ? ', ' + plugins.importers.flatMap(i => i.accept ?? []).join(', ') : '') + ' ' + $t('— oder hierher ziehen')" @click="pickFile">{{ $t("📂 wählen") }}<input id="table-file-input" type="file" style="display:none" @change="fileHandle = null; takeFile($event.target.files[0])" /></label>
        <span v-if="source" class="chip" :title="`${source.rows.length} Zeilen · ${source.columns.length} Spalten`">📄 {{ source.name }} <span class="muted">{{ source.rows.length }}</span></span>
        <button v-if="source" class="x" @click="reloadFile" :title="fileHandle ? $t('Datei neu von der Platte lesen (zwischendurch in Excel geändert?)') : $t('Datei neu wählen — dieser Browser kann Dateien nicht erneut lesen')">↻</button>
        <select v-if="source?.sheets?.length > 1" :value="source.sheet" @change="pickSheet($event.target.value)" :title="$t('Blatt')" style="width:140px"><option v-for="s in source.sheets" :key="s.name" :value="s.name">{{ s.name }} ({{ s.rows.length }})</option></select>
        <span v-else-if="!source" class="muted" style="font-size:12px">{{ $t("oder hierher ziehen · oder aus Excel kopieren und Strg+V") }}</span>
        <span class="grow" />
      </td></tr>
      <tr v-if="recent.length"><td class="attr muted" style="font-size:11px">{{ $t("zuletzt") }}</td><td class="recent" :title="$t('zuletzt gewählt — Klick öffnet wieder (Chrome/Edge fragt einmal nach Leserecht)')">
        <span v-for="r in recent" :key="r.name" class="chip" :class="{ dim: !r.handle }" :title="r.handle ? $t('{0} — wieder öffnen', [r.name]) : $t('{0} — war hineingezogen, kein Zugriff: wieder ziehen', [r.name])" @click="openRecent(r)">{{ r.name }}<button @click.stop="recentFiles.forget('table', r.name).then(loadRecent)" :title="$t('aus der Liste')">×</button></span>
      </td></tr>
      <tr class="step"><td colspan="2">{{ $t("2 · Ziel") + ' ' }}<span class="muted" style="font-weight:400">· {{ fixed ? 'fest: die Tabelle passt 1:1 zu diesem Knoten' : $t('wohin neue Zeilen kommen; vorhandene werden über Id, SKU oder Kennung gefunden') }}</span></td></tr>
      <tr v-if="fixed"><td class="attr">{{ $t("Knoten") }}</td><td class="row">
        <router-link :to="`/tree/${fixed.row.id}`" class="chip" :title="fixed.row.id">{{ icon(fixed.row.role) }} {{ fixed.row.label }}</router-link>
        <span class="muted">{{ $t("→ {0} · {1} mögliche Spalten", [roleLabel[fixed.childRole], fixed.allowed.size]) }}</span>
        <span class="grow" /><button class="x" @click="router.replace('/p/table/import')" :title="$t('Knotenmodus verlassen — frei zuordnen')">×</button>
      </td></tr>
      <tr v-if="!fixed && idLocked && !unknownIds"><td class="attr">{{ $t("Ziel") }}</td><td class="muted">{{ $t("🔒 aus der Datei — die Zeilen haben journali-Ids{0}, jede wird an ihrem Platz aktualisiert{1}", [mapping.some(m => m.target === 'root') ? ' ' + $t('samt Wurzel') : '', mapping.some(m => m.target === 'parent') ? $t('; Elternteil steht in der Datei') : '']) }}</td></tr>
      <tr v-if="!fixed && foreignRoot"><td class="attr"></td><td class="warn" style="font-size:12px">{{ $t("⚠ {0} Zeilen haben Ids, die es hier gibt — aber unter einer anderen Wurzel: fremde Datenbank, Zufallstreffer. Sie gelten als neu und kommen unter das Ziel.", [foreignRoot]) }}</td></tr>
      <tr v-if="!fixed && !(idLocked && !unknownIds)"><td class="attr">{{ $t("Ziel") }}</td><td>
        <div class="row" style="margin-bottom:4px"><span v-if="target" class="chip" :title="target.id + ' ' + $t('— Klick: im Baum ändern')" style="cursor:pointer" @click="targetPick = !targetPick">{{ icon(target.role) }} {{ target.label }} <button @click.stop="target = null; planned = null" :title="$t('Ziel entfernen')">×</button></span><span v-else class="muted">{{ $t("Gruppe oder Produkt — wohin neue Zeilen kommen") }}</span></div>
        <TreePicker v-if="!target || targetPick" :model-value="target?.id ?? ''" :height="200" @pick="pickTarget" />
      </td></tr>
      <tr v-if="!fixed && !(idLocked && !unknownIds)"><td class="attr">{{ $t("Neue als") }}</td><td><select v-model="role" :title="$t('Rolle neuer Zeilen')" @change="planned = null" style="width:100%">
        <option value="">{{ $t("automatisch (unter Gruppe → Produkt, unter Produkt → Variante)") }}</option><option value="group">{{ $t("▣ Gruppen") }}</option><option value="product">{{ $t("▦ Produkte") }}</option><option value="variant">{{ $t("◆ Varianten") }}</option>
      </select></td></tr>
      <tr v-if="!fixed && !idLocked"><td class="attr">{{ $t("Kennung") }}</td><td><input v-model="external" type="text" :placeholder="$t('System der externen Kennung (z. B. erp) — findet vorhandene Knoten')" @change="resuggest(true)" /></td></tr>
    </ImportHead>
    <div class="scroll">
      <div v-if="!keyColumn && source" class="muted" style="font-size:12px;padding:6px 8px">{{ $t("⚠ Keine Schlüsselspalte (Id, SKU, Kennung) — jede Zeile wird neu angelegt.") }}</div>
      <!-- Lücke bei ausgeblendeten Spalten (Taloan, 21.09.): sieht aus wie unser Export, aber die Id-Spalte fehlt — in Excel entfernt oder ohne die versteckten Spalten weitergegeben -->
      <div v-if="source && mapping.some(m => m.internal) && !mapping.some(m => m.target === 'id')" class="warn" style="font-size:12px;padding:6px 8px">{{ $t("⚠ Das ist ein journali-Export, aber die Spalte") + ' ' }}<code>journali_id_…</code>{{ ' ' + $t("fehlt (ausgeblendete Spalten gelöscht oder nur die sichtbaren kopiert?). Ohne Ids werden Zeilen über SKU gefunden — oder neu angelegt, mit Dubletten.") }}</div>
      <div v-if="unknown" class="warn" style="font-size:12px;padding:6px 8px">{{ $t("⚠ {0} Spalten passen nicht zu diesem Knoten und werden übergangen — Vorlage per Rechtsklick am Knoten exportieren, dann stimmen die Spalten.", [unknown]) }}</div>

      <div class="section" v-if="source">
        <h2 class="step-band" style="margin:0 -8px 6px">{{ $t("3 · Zuordnung") + ' ' }}<span class="muted">{{ $t("· {0} von {1} Spalten", [visibleMapping.filter(m => m.target !== 'skip').length, visibleMapping.length]) }}</span><span v-if="idLocked" class="chip" :title="$t('eigene Spalten ({0}) kommen aus der Datei und sind fest — nicht in der Zuordnung', [mapping.filter(m => m.internal || m.target === 'id' || m.target === 'parent').map(m => m.column).join(', ')])">{{ $t("🔒 {0} eigene Spalten", [mapping.filter(m => m.internal || m.target === 'id' || m.target === 'parent').length]) }}</span>
          <button class="x" @click="resuggest()" :title="$t('Zuordnung neu vorschlagen — verwirft die Zuordnung des Profils (mit gewähltem Profil wird der neue Vorschlag gespeichert)')">{{ $t("↻ neu vorschlagen") }}</button>
          <span class="grow" /><span class="layout"><button :class="{ on: layout === 'rows' }" @click="setLayout('rows')" :title="$t('eine Zeile je Spalte — nach unten scrollen')">{{ $t("≡ Zeilen") }}</button><button :class="{ on: layout === 'cols' }" @click="setLayout('cols')" :title="$t('wie in Excel: eine Spalte je Spalte, Zuordnung in den Kopfzeilen — nach rechts scrollen')">{{ $t("⫼ Spalten") }}</button></span></h2>
        <!-- Spalten wie in Excel: Kopfzeilen = Zuordnung, darunter die ersten Zeilen der Datei; erste Spalte klebt -->
        <div v-if="layout === 'cols'" class="colsWrap">
          <table class="grid cols">
            <tbody>
              <tr><th class="stick">{{ $t("Spalte") }}</th><td v-for="m in visibleMapping" :key="m.column" :class="{ off: m.target === 'skip' }" :title="m.column"><b>{{ m.column }}</b><div class="muted" style="font-size:11px">{{ $t("{0} · {1} versch.", [m.sniff?.type, m.sniff?.distinct]) }}</div></td></tr>
              <tr><th class="stick">{{ $t("Ziel") }}</th><td v-for="m in visibleMapping" :key="m.column"><select v-model="m.target" @change="onTarget(m)" style="width:100%"><option v-for="[k, l] in TARGETS.filter(([k]) => !fixed || !['new', 'parent', 'external'].includes(k))" :key="k" :value="k">{{ l }}</option></select></td></tr>
              <tr><th class="stick">{{ $t("Attribut") }}</th><td v-for="m in visibleMapping" :key="m.column">
                <select v-if="m.target === 'attr'" v-model="m.attribute" @change="syncLocale(m); planned = null; m.unknown = false" style="width:100%"><option v-for="a in attrs.filter(a => !fixed || fixed.allowed.has(a.key))" :key="a.key" :value="a.key">{{ $L(a.label) || a.key }} · {{ a.key }}</option></select>
                <span v-else-if="m.target === 'new'" style="display:flex;flex-direction:column;gap:3px"><input v-model="m.newKey" type="text" :placeholder="$t('schlüssel')" @change="planned = null" /><select v-model="m.newType" @change="planned = null"><option v-for="t in ['text', 'html', 'integer', 'decimal', 'boolean', 'date', 'enum']" :key="t" :value="t">{{ t }}</option></select><select v-model="m.newGroup" :class="{ neg: !m.newGroup }" :title="$t('Attributgruppe — Pflicht')" @change="planned = null"><option :value="undefined">{{ $t("● Gruppe wählen …") }}</option><option v-for="g in groups" :key="g.key" :value="g.key">▤ {{ $L(g.label) || g.key }}</option></select></span>
                <span v-else class="muted">—</span></td></tr>
              <tr><th class="stick">{{ $t("Sprache") }}</th><td v-for="m in visibleMapping" :key="m.column"><select v-if="(m.target === 'attr' && attrs.find(a => a.key === m.attribute)?.perLocale) || m.target === 'new'" v-model="m.locale" style="width:100%" @change="planned = null"><option :value="null">*</option><option v-for="l in locales" :key="l" :value="l">{{ l }}</option></select><span v-else class="muted">—</span></td></tr>
              <tr><th class="stick">ƒ</th><td v-for="m in visibleMapping" :key="m.column"><button class="x" :class="{ on: m.steps?.length }" :title="m.steps?.length ? stepsText(m) + ' — Klick: bearbeiten' : $t('Umwandlung hinzufügen')" @click="stepsOpen = stepsOpen === m.column ? null : m.column">ƒ{{ m.steps?.length ? m.steps.length : '' }}</button><span v-if="m.steps?.length" class="muted" style="font-size:11px;margin-left:4px">{{ stepsText(m) }}</span></td></tr>
              <tr><th class="stick">{{ $t("Warum") }}</th><td v-for="m in visibleMapping" :key="m.column" class="muted" style="font-size:11px;white-space:normal">{{ m.why }}</td></tr>
              <tr v-for="r in 3" :key="r" class="sample"><th class="stick muted">{{ $t("Zeile {0}", [r + 1]) }}</th><td v-for="m in visibleMapping" :key="m.column" class="muted" :title="String(source.rows[r - 1]?.[mapping.indexOf(m)] ?? '')">{{ String(source.rows[r - 1]?.[mapping.indexOf(m)] ?? '').slice(0, 40) }}</td></tr>
            </tbody>
          </table>
        </div>
        <div v-if="layout === 'cols' && stepsOpen && mapping.find(m => m.column === stepsOpen)" class="tsteps" style="margin-top:6px;padding:6px 8px;background:var(--bg);border-radius:6px">
          <div class="muted" style="font-size:12px">{{ $t("ƒ Umwandlung für") + ' ' }}<b>{{ stepsOpen }}</b> <button class="x" @click="stepsOpen = null">×</button></div>
          <template v-for="m in [mapping.find(m => m.column === stepsOpen)]" :key="m.column">
            <div v-if="m.target === 'status'" class="tstep" style="flex-wrap:wrap;gap:4px 14px"><span class="muted" style="font-size:12px;width:100%">{{ $t("Quellwert → Status") }}<span v-if="!distinctValues(m).length">{{ ' ' + $t("· diese Spalte hat keine Werte — die Zuordnung erscheint, sobald welche vorhanden sind") }}</span></span>
              <span v-for="v in distinctValues(m)" :key="v" class="fld"><code>{{ v }}</code> → <select :value="statusFor(m, v)" @change="setStatusFor(m, v, $event.target.value)"><option value="">–</option><option v-for="s in (model?.statuses ?? [])" :key="s.key" :value="s.key">{{ store.statusText(s.key) }}</option></select></span></div>
            <div v-for="(s, si) in (m.steps ?? [])" :key="si" class="tstep">
              <span class="muted mono" style="width:18px">{{ si + 1 }}</span>
              <select v-model="s.op" @change="planned = null" :title="opHint(s.op)"><option v-for="o in OPS" :key="o[0]" :value="o[0]">{{ o[1] }}</option></select>
              <template v-for="f in (FIELDS[s.op] ?? [])" :key="f">
                <label v-if="f === 'regex'" :title="$t('als regulärer Ausdruck (Flags gi)')"><input type="checkbox" v-model="s.regex" @change="planned = null" />{{ ' ' + $t("regex") }}</label>
                <span v-else-if="f === 'test'" class="fld"><span class="muted">{{ $t("Quelle ist") }}</span><select v-model="s.test" @change="planned = null"><option value="empty">{{ $t("leer") }}</option><option value="equals">{{ $t("gleich") }}</option><option value="contains">{{ $t("enthält") }}</option><option value="matches">{{ $t("passt auf (regex)") }}</option></select></span>
                <span v-else-if="f === 'decimal'" class="fld"><span class="muted">{{ $t("Dezimalzeichen") }}</span><select v-model="s.decimal" @change="planned = null"><option :value="undefined">{{ $t("raten") }}</option><option value=",">{{ $t("Komma") }}</option><option value=".">{{ $t("Punkt") }}</option></select></span>
                <span v-else-if="f === 'format'" class="fld"><span class="muted">{{ $t("Quelle im Format") }}</span><select v-model="s.format" @change="planned = null"><option v-for="[k, l] in transform.DATE_FORMATS" :key="k" :value="k">{{ l }}</option></select></span>
                <span v-else class="fld"><span class="muted">{{ FIELD_LABEL[f] ?? f }}</span><input type="text" v-model="s[f]" :placeholder="FIELD_HINT[f] ?? f" :title="(FIELD_HINT[f] ?? f) + ' — ' + opHint(s.op)" @input="planned = null" style="width:200px" /></span>
                <select v-if="f === 'columns'" :value="''" :title="$t('Spalte anklicken statt tippen — wird mit Komma angehängt')" @change="addColumn(s, $event.target.value); $event.target.value = ''"><option value="">{{ $t("+ Spalte …") }}</option><option value="{}">{{ $t("{} · diese Spalte") }}</option><option v-for="c in source.columns" :key="c" :value="c">{{ c }}</option></select>
              </template>
              <span class="grow" /><button class="x" @click="moveStep(m, si, -1)">↑</button><button class="x" @click="moveStep(m, si, 1)">↓</button><button class="x" @click="delStep(m, si)">×</button>
            </div>
            <div class="tstep"><select :value="''" @change="addStep(m, $event.target.value); $event.target.value = ''"><option value="">{{ $t("+ Schritt …") }}</option><option v-for="o in OPS" :key="o[0]" :value="o[0]" :title="o[2]">{{ o[1] }}</option></select>
              <span class="muted" style="font-size:11px">{{ m.steps?.length ? $t('Vorschau:') + ' ' + preview(m, mapping.indexOf(m)) : $t('Kette zwischen Quelle und Ziel') }}</span></div>
          </template>
        </div>
        <table v-if="layout === 'rows'" class="grid map">
          <thead><tr><th style="width:170px">{{ $t("Spalte") }}</th><th>{{ $t("Beispiele") }}</th><th style="width:130px">{{ $t("Ziel") }}</th><th style="width:220px">{{ $t("Attribut") }}</th><th style="width:60px">{{ $t("Sprache") }}</th><th style="width:150px">{{ $t("Warum") }}</th><th style="width:34px" :title="$t('Umwandlung: Schritte zwischen Quelle und Ziel (Zahl, Ja/Nein, Datum, Ersetzen, Aufteilen, Verbinden, Bedingung …)')">ƒ</th></tr></thead>
          <tbody>
            <template v-for="m in visibleMapping" :key="m.column">
            <tr :class="{ off: m.target === 'skip' }">
              <td class="attr" :title="m.column"><b>{{ m.column }}</b><div class="muted" style="font-size:11px">{{ $t("{0} · {1} versch.", [m.sniff?.type, m.sniff?.distinct]) }}</div></td>
              <td class="muted samples">{{ sample(mapping.indexOf(m)) }}</td>
              <td><select v-model="m.target" @change="onTarget(m)" style="width:100%"><option v-for="[k, l] in TARGETS.filter(([k]) => !fixed || !['new', 'parent', 'external'].includes(k))" :key="k" :value="k">{{ l }}</option></select></td>
              <td>
                <select v-if="m.target === 'attr'" v-model="m.attribute" @change="syncLocale(m); planned = null; m.unknown = false" style="width:100%"><option v-for="a in attrs.filter(a => !fixed || fixed.allowed.has(a.key))" :key="a.key" :value="a.key">{{ $L(a.label) || a.key }} · {{ a.key }}</option></select>
                <span v-else-if="m.target === 'new'" style="display:flex;gap:4px;flex-wrap:wrap"><input v-model="m.newKey" type="text" style="flex:1;min-width:90px" :placeholder="$t('schlüssel')" @change="planned = null" /><select v-model="m.newType" style="width:84px" @change="planned = null"><option v-for="t in ['text', 'html', 'integer', 'decimal', 'boolean', 'date']" :key="t" :value="t">{{ t }}</option></select>
                  <select v-model="m.newGroup" style="width:100%" :class="{ neg: !m.newGroup }" :title="$t('Attributgruppe — Pflicht: ohne Gruppe gilt das Attribut nirgends')" @change="planned = null"><option :value="undefined">{{ $t("● Gruppe wählen …") }}</option><option v-for="g in groups" :key="g.key" :value="g.key">▤ {{ $L(g.label) || g.key }}</option></select></span>
                <span v-else class="muted">—</span>
              </td>
              <td><select v-if="(m.target === 'attr' && attrs.find(a => a.key === m.attribute)?.perLocale) || m.target === 'new'" v-model="m.locale" style="width:100%" @change="planned = null"><option :value="null">*</option><option v-for="l in locales" :key="l" :value="l">{{ l }}</option></select></td>
              <td class="muted" style="font-size:11px">{{ m.why }}</td>
              <td><button class="x" :class="{ on: m.steps?.length }" :title="m.steps?.length ? stepsText(m) + ' — Klick: bearbeiten' : $t('Umwandlung hinzufügen')" @click="stepsOpen = stepsOpen === m.column ? null : m.column">ƒ{{ m.steps?.length ? m.steps.length : '' }}</button></td>
            </tr>
            <tr v-if="stepsOpen === m.column" class="steps-row"><td colspan="7">
              <div class="tsteps">
                <div v-if="m.target === 'status'" class="tstep" style="flex-wrap:wrap;gap:4px 14px"><span class="muted" style="font-size:12px;width:100%">{{ $t("Quellwert → Status") }}<span v-if="!distinctValues(m).length">{{ ' ' + $t("· diese Spalte hat keine Werte — die Zuordnung erscheint, sobald welche vorhanden sind") }}</span></span>
                  <span v-for="v in distinctValues(m)" :key="v" class="fld"><code>{{ v }}</code> → <select :value="statusFor(m, v)" @change="setStatusFor(m, v, $event.target.value)"><option value="">–</option><option v-for="s in (model?.statuses ?? [])" :key="s.key" :value="s.key">{{ store.statusText(s.key) }}</option></select></span></div>
                <div v-for="(s, si) in (m.steps ?? [])" :key="si" class="tstep">
                  <span class="muted mono" style="width:18px">{{ si + 1 }}</span>
                  <select v-model="s.op" @change="planned = null" :title="opHint(s.op)"><option v-for="o in OPS" :key="o[0]" :value="o[0]">{{ o[1] }}</option></select>
                  <template v-for="f in (FIELDS[s.op] ?? [])" :key="f">
                    <label v-if="f === 'regex'" :title="$t('als regulärer Ausdruck (Flags gi)')"><input type="checkbox" v-model="s.regex" @change="planned = null" />{{ ' ' + $t("regex") }}</label>
                    <span v-else-if="f === 'test'" class="fld"><span class="muted">{{ $t("Quelle ist") }}</span><select v-model="s.test" @change="planned = null"><option value="empty">{{ $t("leer") }}</option><option value="equals">{{ $t("gleich") }}</option><option value="contains">{{ $t("enthält") }}</option><option value="matches">{{ $t("passt auf (regex)") }}</option></select></span>
                    <span v-else-if="f === 'decimal'" class="fld"><span class="muted">{{ $t("Dezimalzeichen") }}</span><select v-model="s.decimal" @change="planned = null"><option :value="undefined">{{ $t("raten") }}</option><option value=",">{{ $t("Komma") }}</option><option value=".">{{ $t("Punkt") }}</option></select></span>
                    <span v-else-if="f === 'format'" class="fld"><span class="muted">{{ $t("Quelle im Format") }}</span><select v-model="s.format" @change="planned = null"><option v-for="[k, l] in transform.DATE_FORMATS" :key="k" :value="k">{{ l }}</option></select></span>
                    <span v-else class="fld"><span class="muted">{{ FIELD_LABEL[f] ?? f }}</span><input type="text" v-model="s[f]" :placeholder="FIELD_HINT[f] ?? f" :title="(FIELD_HINT[f] ?? f) + ' — ' + opHint(s.op)" @input="planned = null" :style="f === 'pairs' || f === 'columns' || f === 'index' || f === 'then' || f === 'else' || f === 'yes' ? 'width:250px' : 'width:130px'" /></span>
                    <select v-if="f === 'columns'" :value="''" :title="$t('Spalte anklicken statt tippen (Taloan, 21.09.) — wird mit Komma angehängt')" @change="addColumn(s, $event.target.value); $event.target.value = ''"><option value="">{{ $t("+ Spalte …") }}</option><option value="{}">{{ $t("{} · diese Spalte") }}</option><option v-for="c in source.columns" :key="c" :value="c">{{ c }}</option></select>
                  </template>
                  <span class="muted" style="font-size:11px">{{ opHint(s.op) }}</span>
                  <span class="grow" />
                  <button class="x" @click="moveStep(m, si, -1)" :title="$t('nach oben')">↑</button><button class="x" @click="moveStep(m, si, 1)" :title="$t('nach unten')">↓</button><button class="x" @click="delStep(m, si)" :title="$t('Schritt entfernen')">×</button>
                </div>
                <div class="tstep"><select :value="''" @change="addStep(m, $event.target.value); $event.target.value = ''"><option value="">{{ $t("+ Schritt …") }}</option><option v-for="o in OPS" :key="o[0]" :value="o[0]" :title="o[2]">{{ o[1] }}</option></select>
                  <span class="muted" style="font-size:11px">{{ m.steps?.length ? $t('Vorschau:') + ' ' + preview(m, mapping.indexOf(m)) : $t('Kette zwischen Quelle und Ziel — die Prüfung des Attributs läuft danach; steht im Profil') }}</span></div>
              </div>
            </td></tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <Splitter v-model="leftW" :min="480" :max="1400" />
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>{{ $t("4 · Plan") }}</h1>
      <button class="primary" :disabled="!source || !!busy" @click="analyse">{{ $t("analysieren") }}</button>
      <button class="primary" :disabled="!planned || !!busy || !planned.commands.length || blockers.length > 0 || planned.stale" @click="run" :title="!planned ? $t('erst analysieren') : blockers[0] ?? (planned.stale ? $t('erst erneut analysieren') : $t('{0} Befehle schreiben', [planned.commands.length]))">{{ $t("▶ schreiben") }}</button>
      <span class="grow" /><span class="muted">{{ store.actor ? '👤 ' + store.actor : $t('👤 Name fehlt') }}</span>
    </div>
    <div class="scroll" style="padding:8px">
      <div v-if="planned" class="stats">
        <span class="muted">{{ $t("{0} Werte · {1} Befehle", [planned.stats.values, planned.commands.length]) }}</span><template v-if="Object.keys(planned.stats.newListValues ?? {}).length"> · <span class="pos" :title="Object.entries(planned.stats.newListValues).map(([l, v]) => l + ': ' + Object.values(v).join(', ')).join(' · ')">{{ $t("+{0} Listenwerte", [Object.values(planned.stats.newListValues).reduce((n, v) => n + Object.keys(v).length, 0)]) }}</span></template>
        <span v-if="planned.newAttributes.length"> · <span class="warn">{{ $t("{0} neue Attribute:", [planned.newAttributes.length]) }}</span> {{ planned.newAttributes.map(a => a.key + ' (' + a.type + ')').join(', ') }}</span>
        <div v-if="planned.stats.notes?.length" class="muted" style="margin-top:6px;white-space:pre-wrap;font-size:12px">ℹ {{ planned.stats.notes.slice(0, 30).join('\nℹ ') }}</div>
        <div v-if="planned.stats.problems.length" class="neg" style="margin-top:6px;white-space:pre-wrap">{{ planned.stats.problems.slice(0, 30).join('\n') }}<span v-if="planned.stats.problems.length > 30"> … +{{ planned.stats.problems.length - 30 }}</span></div>
        <div v-for="b in blockers" :key="b" class="neg" style="margin-top:6px">✗ {{ b }}</div>
        <div v-if="planned.stale" class="warn" style="margin-top:6px">{{ $t("✎ Zellen korrigiert —") + ' ' }}<button class="primary" @click="analyse">{{ $t("erneut analysieren") }}</button></div>
        <div v-if="planned.stats.invalid.length" class="section" style="margin-top:8px;padding:0">
          <h2 class="step-band" style="margin:0 0 4px">{{ $t("Werte prüfen") + ' ' }}<span class="muted">{{ $t("· {0} Zellen{1}", [planned.stats.invalid.length, fixed ? ' ' + $t('— im Knotenmodus in Excel korrigieren und neu laden') : ' ' + $t('— hier korrigieren, dann erneut analysieren')]) }}</span></h2>
          <table class="grid" style="width:100%;table-layout:fixed"><thead><tr><th style="width:50px">{{ $t("Zeile") }}</th><th style="width:150px">{{ $t("Spalte") }}</th><th style="width:260px" :title="$t('warum der Wert abgelehnt wird — und was das Attribut erwartet')">{{ $t("Grund") }}</th><th>{{ $t("Wert") }}</th><th style="width:260px">{{ $t("Korrektur") }}</th></tr></thead><tbody>
            <tr v-for="inv in planned.stats.invalid.slice(0, 200)" :key="inv.row + '|' + inv.column">
              <td class="mono muted">{{ inv.row + 2 }}</td><td class="mono" style="overflow:hidden;text-overflow:ellipsis" :title="source.columns[inv.column]">{{ source.columns[inv.column] }}</td>
              <td class="neg" style="white-space:normal" :title="typeHint(inv)">{{ inv.message }}<span class="muted"> · {{ typeHint(inv) }}</span></td>
              <td class="muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="String(inv.value ?? '')">{{ inv.value }}</td>
              <td><input v-if="!fixed" type="text" :value="inv.value" style="width:100%" :title="$t('korrigierter Wert — Enter, dann erneut analysieren')" @change="fixCell(inv, $event.target.value)" /><span v-else class="muted">{{ inv.value }}</span></td>
            </tr>
          </tbody></table>
        </div>
        <!-- Was passiert, je Zeile (Taloan, 21.09.): Reiter neu / geändert / unverändert, je Knoten die Werte alt → neu -->
        <div v-if="planned.stats.changes?.length" class="section" style="margin-top:8px;padding:0">
          <h2 class="step-band" style="margin:0 0 4px;gap:4px">{{ $t("Vorschau") + ' ' }}<span class="tabs"><button :class="{ on: changeTab === 'create' }" @click="changeTab = 'create'" class="pos">{{ $t("+{0} neu", [planned.stats.create]) }}</button><button :class="{ on: changeTab === 'update' }" @click="changeTab = 'update'" class="warn">{{ $t("{0} geändert", [planned.stats.update]) }}</button><button :class="{ on: changeTab === 'unchanged' }" @click="changeTab = 'unchanged'" class="muted">{{ $t("{0} unverändert", [planned.stats.unchanged]) }}</button></span></h2>
          <table class="grid" style="width:100%">
            <tbody>
              <template v-for="c in planned.stats.changes.filter(c => c.kind === changeTab).slice(0, 300)" :key="c.row">
                <tr class="row" style="cursor:pointer" @click="openRow = openRow === c.row ? null : c.row">
                  <td style="width:20px" class="muted">{{ c.values.length && changeTab !== 'unchanged' ? (openRow === c.row ? '▾' : '▸') : '' }}</td>
                  <td class="mono muted" style="width:50px">{{ c.row + 2 }}</td>
                  <td><span v-if="c.node">{{ icon(c.role) }} {{ c.label }} <a :href="`/tree/${c.node}`" target="_blank" class="muted" :title="$t('im Baum ansehen — neues Fenster, der Import bleibt')" @click.stop>↗</a></span><span v-else>+ {{ c.label }}</span></td>
                  <td class="muted" style="text-align:right;white-space:nowrap">{{ c.values.length ? c.values.length + ' ' + $t('Werte') : '' }}</td>
                </tr>
                <tr v-if="openRow === c.row && c.values.length"><td></td><td colspan="3">
                  <table class="grid diff"><tbody>
                    <tr v-for="d in c.values" :key="d.attribute + '|' + d.locale"><td class="attr muted">{{ attrLabel(d.attribute) }}<span v-if="d.locale" class="muted"> · {{ d.locale }}</span></td>
                      <td class="old" :title="d.from ?? ''">{{ d.from == null ? '' : String(d.from).slice(0, 80) }}</td><td class="muted" style="width:20px">{{ d.from == null ? '+' : '→' }}</td><td :class="d.from == null ? 'new' : 'chg'" :title="d.to ?? ''">{{ d.to == null ? '— (leeren)' : String(d.to).slice(0, 80) }}</td></tr>
                  </tbody></table>
                </td></tr>
              </template>
              <tr v-if="!planned.stats.changes.some(c => c.kind === changeTab)"><td colspan="4" class="muted" style="padding:8px">{{ $t("nichts") }}</td></tr>
            </tbody>
          </table>
        </div>
        <details style="margin-top:8px"><summary class="muted">{{ $t("Befehle (erste 200)") }}</summary>
          <pre class="out">{{ planned.commands.slice(0, 200).map(c => `${c.op} ${JSON.stringify(c.args)}`).join('\n') }}</pre></details>
      </div>
      <div v-else-if="source" class="muted">{{ $t("Zuordnung prüfen, Ziel wählen, dann analysieren. Nichts wird geschrieben, bevor Du „schreiben“ drückst.") }}</div>
      <div v-else class="empty">{{ $t("Datei ablegen oder aus Excel einfügen.") }}<br /><span class="muted" style="font-size:12px">{{ $t("Der Mapper erkennt Spalten an Schlüssel, Label, Synonymen (Artikelnummer → sku …), Sprache im Namen (name_en) und rät den Typ neuer Attribute aus den Werten.") }}</span></div>
      <div v-if="result" class="pos" style="margin-top:8px">{{ $t("✓ {0} Einträge geschrieben · Stapel {1} —", [result.written, result.batch]) + ' ' }}<router-link :to="{ path: '/journal', query: { q: result.batch } }">{{ $t("im Journal") }}</router-link></div>
      <div class="section" v-if="log.length"><h2>{{ $t("Protokoll") }}</h2><div class="mono" style="font-size:12px;white-space:pre-wrap"><div v-for="(l, i) in log" :key="i" :class="/^\S+ ✗/.test(l) ? 'fehler' : ''">{{ l }}</div></div></div>
    </div>
  </div>
</template>

<style scoped>
/* Zuordnung als Zeilen: feste Mindestbreite, im schmalen Fenster nach rechts scrollen statt Felder quetschen (Taloan, 21.09.) */
.section { overflow-x: auto; }
table.map { min-width: 960px; }
/* Zuordnung als Spalten (wie Excel): erste Spalte klebt, jede Dateispalte 200 px */
.colsWrap { overflow-x: auto; }
table.cols { border-collapse: separate; border-spacing: 0; }
table.cols th.stick { position: sticky; left: 0; background: var(--pane); z-index: 1; width: 70px; min-width: 70px; border-right: 1px solid var(--line); box-shadow: 4px 0 6px -4px rgba(0,0,0,.5); text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; vertical-align: top; }
table.cols td { min-width: 200px; max-width: 200px; vertical-align: top; overflow: hidden; text-overflow: ellipsis; }
table.cols td.off { opacity: .5; }
table.cols tr.sample td { white-space: nowrap; font-size: 12px; }
.layout button { border: 1px solid var(--line); background: none; color: var(--muted); padding: 1px 8px; font-size: 11px; font-weight: 400; }
.layout button.on { background: var(--accent-soft); color: var(--text); border-color: var(--accent); }
/* Umwandlung je Spalte (ƒ): Kette unter der Zeile */
.steps-row td { background: var(--bg); padding: 4px 8px 6px 30px; }
.tsteps { display: flex; flex-direction: column; gap: 3px; }
.tstep { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; font-size: 12px; }
.tstep select, .tstep input[type=text] { font-size: 12px; }
.fld { display: inline-flex; gap: 4px; align-items: center; font-size: 11px; }
/* Vorschau: Reiter neu / geändert / unverändert; Werte alt → neu */
/* Reiter, die wie Reiter aussehen (Taloan, 21.09.: „ach so, das kann man anklicken“) */
.tabs { display: inline-flex; gap: 0; margin-left: 8px; }
.tabs button { border: 1px solid var(--line); background: var(--bg); padding: 2px 12px; font-size: 12px; font-weight: 600; cursor: pointer; border-radius: 0; }
.tabs button:first-child { border-radius: 6px 0 0 6px; } .tabs button:last-child { border-radius: 0 6px 6px 0; }
.tabs button:hover { background: var(--hover); }
.tabs button.on { background: var(--accent); color: #fff !important; border-color: var(--accent); }
table.diff td { font-size: 12px; white-space: normal; }
table.diff td.old { color: var(--muted); text-decoration: line-through; max-width: 300px; }
table.diff td.new { color: var(--pos); max-width: 300px; }      /* neuer Wert (vorher keiner) */
table.diff td.chg { color: var(--warn); max-width: 300px; }      /* geänderter Wert */
/* ƒ leuchtet, wenn eine Umwandlung hinterlegt ist (Taloan, 21.09.) */
.x.on { background: var(--accent); color: #fff; font-weight: 700; border-radius: 4px; padding: 0 6px; }
.section { padding: 8px; border-bottom: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; font-weight: 600; }
.section h2 .muted { font-weight: 400; }
.drop.over { outline: 2px dashed var(--accent); outline-offset: -2px; }
/* ohne Datei ein grosser Ablagebereich (Taloan, 21.09.: „höher“) */
.drop.empty { min-height: 84px; border: 2px dashed var(--line); border-radius: 6px; margin: 4px 0; flex-wrap: wrap; }
.recent { display: flex; gap: 4px; align-items: center; flex-wrap: wrap; white-space: normal; }
.recent .chip { cursor: pointer; }
.recent .chip.dim { opacity: .55; cursor: default; }
.btn { display: inline-block; padding: 2px 10px; border-radius: 6px; cursor: pointer; }
.map td { vertical-align: top; padding: 3px 4px; }
.map tr.off td { opacity: .5; }
.samples { font-size: 11px; white-space: normal; max-width: 260px; }
.stats { font-size: 13px; }
.out { font-size: 11px; max-height: 400px; overflow: auto; background: var(--bg); padding: 6px; border-radius: 6px; }
.picker { max-height: 240px; overflow: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--pane); margin-top: 4px; }
.pick { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 8px; white-space: nowrap; cursor: pointer; }
.pick:hover { background: var(--hover); }
</style>
