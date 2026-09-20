<script setup>
// Ein Knoten: Pfad, Kopf nach Rolle, die Attributgruppen, die hier gelten (am Pfad
// angehängt, Definition vererbt), darin die Attribute als Gitter Attribut × Achse.
// Gruppen, die hier nicht aktiv sind (aktiv ab tieferem Knotentyp), sind sichtbar,
// aber gesperrt — oder mit „nur bearbeitbare“ weg. Sicht je Knotentyp ordnet
// Gruppen und Attribute; flach untereinander oder als Reiter. Jede Änderung ist
// ein Befehl an den Server = ein Eintrag.
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { tree, icon } from '../tree.js'
import { menu } from '../menu.js'
import Cell from '../components/Cell.vue'
import ToggleCell from '../components/ToggleCell.vue'
import SelectCell from '../components/SelectCell.vue'
import ListCell from '../components/ListCell.vue'
import { validate, convert } from '../mapper.js'
import DateCell from '../components/DateCell.vue'
import HtmlCell from '../components/HtmlCell.vue'
import RowsBlock from '../components/RowsBlock.vue'
import VersionsPanel from '../components/VersionsPanel.vue'
import MediaThumb from '../components/MediaThumb.vue'
import EntryList from '../components/EntryList.vue'
import ScriptEditor from '../components/ScriptEditor.vue'
import Splitter from '../components/Splitter.vue'
import { paneWidth } from '../panes.js'
const journalW = paneWidth('journal', 420)

const props = defineProps({ id: String })
const router = useRouter()

const node = ref(null)
const rels = ref({ out: [], in: [] })   // Relationen dieses Knotens: ausgehend, eingehend
const entries = ref([])
const busy = ref(false)
const tab = ref('')
const addGroup = ref('')

const model = computed(() => store.model)
const locales = computed(() => model.value?.locales.map(l => l.code) ?? [])
const channels = computed(() => model.value?.channels.map(c => c.key) ?? [])
const path = computed(() => tree.ancestors(props.id))
const roleLabel = { group: 'Produktgruppe', product: 'Produkt', variant: 'Variante' }

// ---- Sicht (Sprachen/Kanal als Spalten)
const viewLocales = computed(() => locales.value.filter(l => store.viewLocales.includes(l)))
const columns = computed(() => {
  const cols = [{ locale: null, channel: null, label: '*' }]
  for (const l of viewLocales.value) cols.push({ locale: l, channel: null, label: l })
  const c = store.viewChannel
  if (c && channels.value.includes(c)) {
    cols.push({ locale: null, channel: c, label: `*/${c}` })
    for (const l of viewLocales.value) cols.push({ locale: l, channel: c, label: `${l}/${c}` })
  }
  return cols
})
function toggleLocale(l) { const s = new Set(store.viewLocales); s.has(l) ? s.delete(l) : s.add(l); store.viewLocales = locales.value.filter(c => s.has(c)); store.save() }
function setChannel(c) { store.viewChannel = c || null; store.save() }

// ---- Attributsicht je Knotentyp
const views = computed(() => (model.value?.views ?? []).filter(v => v.level === node.value?.role))
const view = computed(() => views.value.find(v => v.key === store.viewKey[node.value?.role]) ?? null)
// „komplett“ ordnet nach der Standardsicht des Knotentyps (defaultview_<rolle>), wenn es sie gibt — sonst alphabetisch.
const orderView = computed(() => view.value ?? views.value.find(v => v.key === 'defaultview_' + node.value?.role) ?? null)
function setView(k) { store.viewKey = { ...store.viewKey, [node.value.role]: k }; store.save() }
function setLayout(l) { store.layout = l; store.save() }
// Abschnitte (attributes, axes, media, relations, groups, releases) per Klick aufs Band auf-/zuklappen (Taloan, 17.09.)
const open = k => !store.collapsed.includes(k)
function toggle(k) { store.collapsed = open(k) ? [...store.collapsed, k] : store.collapsed.filter(x => x !== k); store.save() }
// Pfad: Schrift verkleinern, bis er in eine Zeile passt (13 → 10 px), statt umzubrechen (Taloan)
const pathEl = ref(null)
async function fitPath() {
  await nextTick(); const el = pathEl.value; if (!el) return
  el.style.fontSize = ''; el.classList.add('rigid')   // rigid: Glieder schrumpfen nicht, damit die Breite messbar überläuft
  let size = parseFloat(getComputedStyle(el).fontSize) || 13
  while (el.scrollWidth > el.clientWidth && size > 10) { size -= 0.5; el.style.fontSize = size + 'px' }
  if (el.scrollWidth > el.clientWidth) el.classList.remove('rigid')   // reicht auch bei 10 px nicht: Ellipse an den Gliedern
}
watch(() => [props.id, path.value?.length, node.value?.label], fitPath)
onMounted(() => { fitPath(); window.addEventListener('resize', fitPath) })
onUnmounted(() => window.removeEventListener('resize', fitPath))
function toggleEditableOnly() { store.editableOnly = !store.editableOnly; store.save() }
// Attributnamen: Bezeichnung → Key → beides (Taloan: Vorlagen nutzen die Keys, da darf man nicht raten)
function cycleNames() { store.attrNames = { label: 'key', key: 'both', both: 'label' }[store.attrNames] ?? 'label'; store.save() }
const NAMES_TITLE = { label: 'Bezeichnung in der Sicht-Sprache — Klick: technische Keys', key: 'technische Keys — Klick: beides', both: 'Bezeichnung ⟨Key⟩ — Klick: nur Bezeichnung' }

// ---- Die Gruppen, die hier gelten, in Sichtreihenfolge; darin die Attribute in Sichtreihenfolge
const blocks = computed(() => {
  if (!model.value || !node.value) return []
  const eff = node.value.groups ?? []               // [{ key, from, fromLabel, active, attributes }]
  const byKey = new Map(eff.map(g => [g.key, g]))
  const ov = orderView.value
  const order = ov ? ov.items.map(it => it.group).filter(k => byKey.has(k)) : eff.map(g => g.key)
  // „komplett“: Gruppen, die die Standardsicht nicht nennt, unten dran. Eine gewählte Sicht zeigt nur ihre Gruppen (Taloan, 17.09.).
  if (ov && !view.value) for (const g of eff) if (!order.includes(g.key)) order.push(g.key)
  const req = k => model.value.attributes.find(a => a.key === k)?.required
  return order.map(k => {
    const g = byKey.get(k)
    const it = ov?.items.find(x => x.group === k)
    const ord = (it?.order ?? []).filter(a => g.attributes.includes(a))
    const keys = [...ord, ...g.attributes.filter(a => !ord.includes(a))]
    let defs = keys.map(a => model.value.attributes.find(x => x.key === a)).filter(Boolean).map(a => ({ ...a, required: req(a.key) }))
    // „nur eigene“ (Taloan, 20.09.): was der Knoten selbst trägt — dazu Variantenachsen und Pflichtfelder, damit Lücken sichtbar bleiben
    if (store.ownOnly) { const ownKeys = new Set([...own.value.keys()].map(k => k.split('|')[0])); const ax = node.value?.axisValues ?? {}; defs = defs.filter(a => ownKeys.has(a.key) || a.key in ax || a.required || (node.value?.rows?.[a.key]?.length)) }
    const def = model.value.groups.find(x => x.key === k)
    return { key: k, label: def?.label?.de || k, activeFrom: def?.activeFrom, from: g.from, fromLabel: g.fromLabel, active: g.active, defs }
  }).filter(b => b.defs.length && (!store.editableOnly || b.active))
    // „komplett“: gesperrte Gruppen ans Ende (Taloan, 17.09.); in einer Sicht bleibt deren Reihenfolge.
    .sort((x, y) => view.value ? 0 : (x.active === y.active ? 0 : x.active ? -1 : 1))
})
watch(blocks, b => { if (!b.some(x => x.key === tab.value)) tab.value = b[0]?.key ?? '' }, { immediate: true })
// Suche über das Sichtbare: Attributname/Key und die Werte in den gezeigten Spalten (eigen oder geerbt, Auswahl als Label)
const attrFilter = computed({ get: () => store.attrFilter, set: v => { store.attrFilter = v } })
const findBox = ref(null)
function cellText(def, col) {
  const v = ownValue(def.key, col) ?? inherited(def, col).value
  if (v == null) return ''
  if (def.type === 'enum') return `${v} ${listLabel(def)(v)}`
  if (def.type === 'html') return String(v).replace(/<[^>]+>/g, ' ')
  return String(v)
}
function matches(def, block) {
  const q = attrFilter.value.trim().toLowerCase(); if (!q) return true
  if (def.key.toLowerCase().includes(q) || (def.label?.de ?? '').toLowerCase().includes(q) || (def.label?.en ?? '').toLowerCase().includes(q)) return true
  if (def.type === 'rows') return Object.values(node.value?.rows?.[def.key] ?? {}).length > 0 && [...own.value.entries()].some(([k, v]) => k.startsWith(def.key + '|') && String(v ?? '').toLowerCase().includes(q))
  return columns.value.some(c => enabled(def, c, block) && cellText(def, c).toLowerCase().includes(q))
}
const filteredBlocks = computed(() => attrFilter.value.trim()
  ? blocks.value.map(b => ({ ...b, defs: b.defs.filter(d => matches(d, b)) })).filter(b => b.defs.length)
  : blocks.value)
const hitCount = computed(() => filteredBlocks.value.reduce((n, b) => n + b.defs.length, 0))
const shownBlocks = computed(() => store.layout === 'tabs' && !attrFilter.value.trim() ? filteredBlocks.value.filter(b => b.key === tab.value) : filteredBlocks.value)
// Breite der Namensspalte: gemessen am längsten sichtbaren Namen (Bezeichnung + abgegrauter Key), 180–360 px — nichts
// wird abgeschnitten (Taloan); der Rest der Breite gehört den Werten
const measure = (() => { let ctx = null; return (s, font) => { ctx ??= document.createElement('canvas').getContext('2d'); ctx.font = font; return ctx.measureText(s).width } })()
const attrColWidth = computed(() => {
  let w = 0
  for (const b of shownBlocks.value) for (const def of b.defs) {
    const label = store.label(def), key = store.attrNames !== 'label' ? def.key : ''
    w = Math.max(w, (label ? measure(label, '13px system-ui, "Segoe UI", sans-serif') : 0) + (key ? measure(key, '11px ui-monospace, Consolas, monospace') + 6 : 0) + (def.unit ? measure(' ' + def.unit, '13px system-ui') : 0))
  }
  return Math.ceil(Math.max(180, Math.min(360, w + 48)))   // Stern, Innenabstand, Pflichtpunkt — Deckel 360 (Taloan: 560 ist harter Tobak), darüber Ellipse an der Bezeichnung, der Key bleibt ganz
})

// ---- Werte
const computedValue = (key, locale = null) => (node.value?.computed ?? []).find(c => c.attribute === key && (c.locale ?? null) === locale)?.value ?? null
// Formel-Zelle: Klick öffnet den Skript-Editor; Übernehmen schreibt das Skript als Wert (AttributeSet)
const scriptCell = ref(null)   // { def, col }
const own = computed(() => valueMap(node.value?.values ?? []))
// Beleg je Wert (ValueSourced): Quelle, Weg, Prüfdatum — ↗ in der Zelle
const sources = computed(() => { const m = new Map(); for (const v of node.value?.values ?? []) if (v.source) m.set(key(v.attribute, v.locale, v.channel, v.row), v.source); return m })
function sourceOf(def, col) { return sources.value.get(key(def.key, col.locale, col.channel)) ?? null }
async function setSource(def, col) {
  const cur = sourceOf(def, col)
  const v = await dialog.prompt({ title: `Quelle für ${store.label(def)}`, text: 'URL oder Text (Datenblatt, Katalogseite …); leer = Beleg weg', value: cur?.source ?? '', placeholder: 'https://…' })
  if (v === null) return
  await command(() => api.post(`${nodeUrl()}/sources`, { attribute: def.key, locale: col.locale ?? null, channel: col.channel ?? null, source: v.trim(), method: 'manual', checkedAt: new Date().toISOString().slice(0, 10) }))
}
// Übersetzungsstand: Wert einer anderen Sprache ist „zu überarbeiten“, wenn der Master-Wert später geschrieben wurde (Eintragsnummer).
const master = computed(() => model.value?.masterLocale ?? locales.value[0] ?? null)
const ownAt = computed(() => { const m = new Map(); for (const v of node.value?.values ?? []) m.set(key(v.attribute, v.locale, v.channel, v.row), v.number ?? 0); return m })
function stale(def, col) {
  if (!def.perLocale || !col.locale || col.locale === master.value) return false
  const mine = ownAt.value.get(key(def.key, col.locale, col.channel)); if (!mine) return false
  const m = ownAt.value.get(key(def.key, master.value, col.channel)) ?? ownAt.value.get(key(def.key, master.value, null))
  return !!m && m > mine
}
function valueMap(values) {
  const m = new Map()
  for (const v of values) m.set(key(v.attribute, v.locale, v.channel, v.row), v.values ? v.values.join(', ') : v.value)
  return m
}
function key(a, l, c, row) { return `${a}|${l ?? ''}|${c ?? ''}${row ? '|' + row : ''}` }
function ownValue(a, col) { return own.value.get(key(a, col.locale, col.channel)) ?? null }
function fallback(m, a, col) {
  if (col.channel && m.has(key(a, col.locale, null))) return m.get(key(a, col.locale, null))
  if ((col.locale || col.channel) && m.has(key(a, null, null))) return m.get(key(a, null, null))
  return null
}
const ancestorMaps = computed(() => (node.value?.ancestors ?? []).map(an => ({ an, m: valueMap(an.values) })))
// Wie Tree.Resolve: hier (genaue Achse, ohne Kanal, ohne Sprache), dann den Pfad hinauf — nur wenn das Attribut vererbbar ist.
// Sprachabhängig (Taloan, 17.09.): * ist der sprachneutrale Grundtext (SAP-Kurzbezeichnung) und änderbar;
// leer zeigt * den Master (◌). Kette je Sprache: eigen → Master → * → dasselbe bei den Vorfahren (wenn vererbbar).
// Rückgabe: { value, from (Vorfahr oder null), master (true = kommt aus der Mastersprache) }
function resolveIn(m, def, col) {
  const at = (l, c) => m.get(key(def.key, l, c)) ?? (c ? m.get(key(def.key, l, null)) : undefined)
  if (!def.perLocale) { const v = fallback(m, def.key, col); return v != null ? { value: v } : null }
  const own = at(col.locale, col.channel); if (own != null) return { value: own }
  if (col.locale !== master.value) { const mv = at(master.value, col.channel); if (mv != null) return { value: mv, master: true } }
  if (col.locale) { const sv = at(null, col.channel); if (sv != null) return { value: sv } }
  return null
}
function inherited(def, col) {
  const here = resolveIn(own.value, def, col)
  if (here) return { ...here, from: null }
  if (!def.inheritable) return { value: null, from: null }
  for (const { an, m } of ancestorMaps.value) {
    const v = resolveIn(m, def, col)
    if (v) return { ...v, from: an }
  }
  return { value: null, from: null }
}
function enabled(def, col, block) {
  return block.active && (!col.locale || def.perLocale) && (!col.channel || def.perChannel)
    && (!col.channel || !def.channels || def.channels.includes(col.channel))
}
function listOptions(def) { return (model.value.lists.find(l => l.key === def.list)?.values ?? []).map(v => v.value) }
function listLabel(def) { const vals = model.value.lists.find(l => l.key === def.list)?.values ?? []; return v => vals.find(x => x.value === v)?.label?.de || v }
function released(channel, locale) { return node.value?.releases.some(r => r.channel === channel && r.locale === locale) ?? false }
function axisLabel(a) { return model.value?.attributes.find(x => x.key === a)?.label?.de || a }
function axisValue(a, col) { return node.value?.role === 'variant' && !col.locale && !col.channel && a in node.value.axisValues ? node.value.axisValues[a] : null }
function completeness(channel, locale) { return (node.value?.completeness ?? []).find(c => c.channel === channel && c.locale === locale) ?? null }
function incomplete(channel, locale) {
  if (locale) return completeness(channel, locale)?.missing?.length ? completeness(channel, locale) : null
  const all = (node.value?.completeness ?? []).filter(c => c.channel === channel && c.missing.length)
  return all.length ? { missing: all.flatMap(c => c.missing.map(m => m + (m.includes('/') ? '' : '/' + c.locale))) } : null
}
// ---- Name im Baum: eigener Name (Rechtsklick im Baum → Umbenennen) oder das ★ an einem Attribut unten
const shownLabel = computed(() => tree.byId.get(props.id)?.label ?? props.id)
// Alle ★ am Pfad, das nächste zuerst; es zählt das erste, dessen Attribut hier gilt und einen Wert hat.
const star = key => (node.value?.stars ?? []).find(s => s.attribute === key) ?? null
const starOwn = key => star(key)?.from === props.id
function starTitle(def) {
  const s = star(def.key)
  if (!s) return `☆ ab hier nach unten mit ${store.name(def)} benennen`
  const where = s.from === props.id ? 'hier gesetzt, gilt ab hier nach unten' : `geerbt von ${s.fromLabel} — gilt, bis hier ein eigenes gesetzt wird`
  const applies = s.applies ? '' : ` — gilt hier nicht (erst wo ${store.name(def)} erfasst wird), bis dahin zählt das nächste ★ weiter oben`
  return `★ benennt ${where}${applies} — Klick ${s.from === props.id ? 'nimmt es weg' : 'setzt es hier neu'}`
}
const freeGroups = computed(() => (model.value?.groups ?? []).filter(g => !(node.value?.groups ?? []).some(x => x.key === g.key)))
// Gruppen heissen überall gleich: Label wie im Reiter, Schlüssel nur im Tooltip.
const groupLabel = k => model.value?.groups.find(x => x.key === k)?.label?.de || k
const groupLocked = k => { const g = model.value?.groups.find(x => x.key === k); return g?.activeFrom && node.value && !(node.value.groups ?? []).find(x => x.key === k)?.active }
// Angehängte Gruppen zum Lesen sortiert (Taloan, 18.09.): alphabetisch nach Label, gesperrte 🔒 ans Ende — die Reihenfolge im Journal ist die des Anhängens und bedeutet nichts
const attachedSorted = computed(() => [...(node.value?.attachedGroups ?? [])].sort((a, b) => (groupLocked(a) ? 1 : 0) - (groupLocked(b) ? 1 : 0) || groupLabel(a).localeCompare(groupLabel(b), 'de', { sensitivity: 'base' })))

// ---- Laden
async function load() {
  try {
    node.value = await api.get(`/api/nodes/${encodeURIComponent(props.id)}`)
    rels.value = await api.get(`/api/nodes/${encodeURIComponent(props.id)}/relations`)
    entries.value = (await api.get(`/api/streams/${encodeURIComponent(props.id)}`)).reverse()
  } catch (e) {
    if (e.message.startsWith('404')) router.push('/tree')
    else store.toast(e.message)
  }
}
onMounted(load)
function onKey(e) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
  // im grossen Editor (contenteditable) oder in einem Overlay gilt Esc dort — nicht den Knoten verlassen (Taloan: „klick – Anzeige – Esc“ warf den Knoten raus)
  if (e.target.isContentEditable || e.target.closest?.('.editor, .overlay, .dialog')) return
  if (e.key === 'Escape') router.push('/tree')
  else if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo() }
  else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
watch(() => store.head, h => { if (h > (entries.value[0]?.number ?? 0)) load() })

// ---- Befehle
async function command(fn) {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  busy.value = true
  try { const entry = await fn(); entries.value.unshift(entry); await load(); tree.load() }
  catch (e) { store.toast(e.message) }
  finally { busy.value = false }
}
const nodeUrl = () => `/api/nodes/${encodeURIComponent(props.id)}`
// Rückgängig/Wiederholen je Knoten: das Journal bleibt append-only — der alte Wert wird als neuer Eintrag geschrieben.
// Schritte JE KNOTEN (Taloan): ↶ hier macht rückgängig, was an diesem Knoten geändert wurde — auch wenn man zwischendurch
// woanders war; nie die drei Schritte eines anderen Knotens. Der Stapel liegt im Store, weil NodeView je Knoten neu gebaut
// wird (:key=id). Ein Rückzug landet im Stapel des Vaters — dort steht man danach, dort holt ↶ ihn zurück.
const stacksOf = id => (store.undo[id] ??= { history: [], redo: [] })
const history = computed(() => stacksOf(props.id).history)
const redoStack = computed(() => stacksOf(props.id).redo)
const setValue = (def, col, value, row = null) => {
  const before = own.value.get(key(def.key, col.locale, col.channel, row)) ?? ''
  history.value.push({ kind: 'value', node: props.id, def, col, row, before, after: value }); redoStack.value.length = 0
  return writeValue(def, col, value, row)
}
// Mouseover auf ↶/↷ (Taloan): was würde der Schritt tun — Attribut, Spalte, alter → neuer Wert; und wie viele Schritte noch
function stepTitle(h, verb, n, key, redo = false) {
  if (!h) return redo ? 'nichts zu wiederholen' : 'nichts rückgängig zu machen'
  if (h.kind === 'retire') return redo ? `${h.label}${h.count > 1 ? ` mit ${h.count - 1} darunter` : ''} wieder zurückziehen  (${key})` : `${h.label}${h.count > 1 ? ` mit ${h.count - 1} darunter` : ''} wiederherstellen  (${key})`
  const show = v => v == null || v === '' ? 'leer' : `„${String(v).replace(/<[^>]+>/g, ' ').slice(0, 60)}“`
  const from = redo ? h.before : h.after, to = redo ? h.after : h.before
  return `${store.name(h.def)}${h.col?.label ? ' · ' + h.col.label : ''}${h.row ? ' · Zeile ' + h.row : ''}: ${show(from)} → ${show(to)}  (${key})`
}
// Rückzug als Schritt (Taloan: nach dem Löschen sagte ↶ „nichts rückgängig“): Rückgängig holt über den Stapel zurück,
// Wiederholen zieht wieder zurück; danach steht die Ansicht wieder auf dem Knoten
async function undoRetire(h) {
  try {
    const x = h.batch ? await api.post(`/api/batches/${encodeURIComponent(h.batch)}/undo`) : await api.post(`/api/nodes/${encodeURIComponent(h.id)}/restore`)
    store.toast(`${x.undone ?? 1} Knoten wiederhergestellt`, 'ok'); await store.poll(true); await tree.load(); router.push(`/tree/${h.id}`)
  } catch (e) { store.toast(e.message); stacksOf(h.parent ?? '').history.push(h); stacksOf(h.parent ?? '').redo.pop() }
}
async function redoRetire(h) {
  try {
    const r = await api.del(`/api/nodes/${encodeURIComponent(h.id)}${h.count > 1 ? '?recursive=true' : ''}`)
    h.batch = r?.batch ?? null; store.toast(`${r?.retired ?? 1} Knoten zurückgezogen`, 'ok'); await tree.load(); router.push(h.parent ? `/tree/${h.parent}` : '/tree')
  } catch (e) { store.toast(e.message); stacksOf(h.parent ?? '').redo.push(h); stacksOf(h.parent ?? '').history.pop() }
}
function undo() { const h = history.value.pop(); if (!h) return; redoStack.value.push(h); h.kind === 'retire' ? undoRetire(h) : writeValue(h.def, h.col, h.before, h.row, h.node) }
function redo() { const h = redoStack.value.pop(); if (!h) return; history.value.push(h); h.kind === 'retire' ? redoRetire(h) : writeValue(h.def, h.col, h.after, h.row, h.node) }
const writeValue = (def, col, value, row = null, node = props.id) => command(() =>
  api.post(`/api/nodes/${encodeURIComponent(node)}/attributes`, def.multiple
    ? { attribute: def.key, locale: col.locale, channel: col.channel, values: value.split(',').map(s => s.trim()).filter(Boolean), row }
    : { attribute: def.key, locale: col.locale, channel: col.channel, value, row }))
const addRow = def => command(() => api.post(`${nodeUrl()}/rows`, { attribute: def.key, row: '' }))
const removeRow = (def, row) => command(() => api.del(`${nodeUrl()}/rows/${def.key}/${row}`))
const orderRows = (def, rows) => command(() => api.post(`${nodeUrl()}/rows/${def.key}`, { attribute: def.key, rows }, 'PUT'))
// ★ am eigenen Sternchen nimmt es weg; sonst setzt es dieses Attribut ab hier.
const setStar = def => command(() => api.post(`${nodeUrl()}/label-attribute`, { attribute: starOwn(def.key) ? null : def.key }, 'PUT'))
const setStatus = s => command(() => api.post(`${nodeUrl()}/status`, { status: s }))
const attach = groups => command(() => api.post(`${nodeUrl()}/groups`, { groups }, 'PUT'))
// ---- Relationen (18): je Typ ausgehend (→) und eingehend (←, mit umgekehrter Bezeichnung); Werte an der Relation aus der Gruppe des Typs
const relTypes = computed(() => model.value?.relationTypes ?? [])
const relType = key => relTypes.value.find(t => t.key === key)
const relGroupAttrs = key => { const g = relType(key)?.group; return g ? (model.value?.attributes ?? []).filter(a => a.group === g && a.type !== 'rows' && a.type !== 'html') : [] }
const isMediaType = key => (relType(key)?.to ?? []).includes('media')
const relBlocks = computed(() => {
  const out = new Map()
  for (const r of rels.value.out ?? []) { if (isMediaType(r.type)) continue; if (!out.has(r.type)) out.set(r.type, { type: r.type, out: [], in: [] }); out.get(r.type).out.push(r) }
  for (const r of rels.value.in ?? []) { if (!out.has(r.type)) out.set(r.type, { type: r.type, out: [], in: [] }); out.get(r.type).in.push(r) }
  return [...out.values()].sort((a, b) => a.type.localeCompare(b.type))
})
const relCount = computed(() => (rels.value.out?.length ?? 0) + (rels.value.in?.length ?? 0))
const relValue = (r, def) => { const loc = def.perLocale ? (viewLocales.value[0] ?? locales.value[0]) : null; return r.values.find(v => v.attribute === def.key && (v.locale ?? null) === loc && !v.channel)?.value ?? null }
const setRelValue = (r, def, v) => command(() => api.post(`/api/relations/${r.id}/attributes`, { attribute: def.key, locale: def.perLocale ? (viewLocales.value[0] ?? locales.value[0]) : null, value: v }))
const retireRel = r => command(() => api.del(`/api/relations/${r.id}`))
// „Bilder der Subitems durch Vererbung ersetzen“ (Taloan, 18.09.): die eigenen Medien dieses Knotens werden vererbt (inherit=true);
// an allen Nachfahren werden Zuordnungen zu DEMSELBEN Medium (gleicher Typ) gelöst — aber nur, wenn der Nachfahr danach kein
// eigenes Medium dieses Typs mehr hätte (sonst bräche sein eigenes die Vererbung, und das gleiche Bild wäre weg). Ein Stapel.
const inheriting = ref('')
async function inheritToSubitems() {
  const own = mediaRels.value; if (!own.length) return
  inheriting.value = 'lese Subitems …'
  try {
    const below = []; const walk = id => { for (const k of tree.kids(id)) { below.push(k); walk(k.id) } }; walk(props.id)
    const mine = new Map(own.map(r => [`${r.type}|${r.other.id}`, r]))
    const retire = [], already = []; let i = 0
    for (const k of below) {
      inheriting.value = `lese … ${++i}/${below.length}`
      const rk = await api.get(`/api/nodes/${encodeURIComponent(k.id)}/relations`)
      const media = (rk.out ?? []).filter(r => isMediaType(r.type) && relValueRaw(r, 'stop') !== 'true')
      const dup = media.filter(r => mine.has(`${r.type}|${r.other.id}`))
      if (dup.length) retire.push(...dup.map(r => ({ node: k, rel: r })))
      else if ((rk.inherited ?? []).length) already.push(k)
    }
    const toInherit = own.filter(r => relValueRaw(r, 'inherit') !== 'true'), alreadyOn = own.length - toInherit.length
    // Der Dialog sagt, was ist — auch wenn nichts zu tun bleibt (Taloan, 18.09.: „0 hier auf vererben?“)
    const list = [
      ...(alreadyOn ? [`${alreadyOn} ${alreadyOn === 1 ? 'Medium ist' : 'Medien sind'} hier schon auf „vererben“`] : []),
      ...(already.length ? [`${already.length} Subitems erben bereits`] : []),
      ...retire.slice(0, 6).map(x => `lösen: ${x.node.label} · ${x.rel.other.label}`), ...(retire.length > 6 ? [`… und ${retire.length - 6} weitere`] : [])]
    const nothing = !toInherit.length && !retire.length
    const ok = await dialog.confirm({
      title: `Medien an ${below.length} Subitems vererben?`,
      warn: nothing ? 'nichts zu tun' : `${toInherit.length} Medien hier auf „vererben“ · ${retire.length} gleiche feste Zuordnungen an Subitems durch die Vererbung ersetzen`,
      list, text: nothing ? '' : 'Die Medien bleiben in der Bibliothek; an den Subitems erscheinen sie danach als geerbt (gestrichelt).', ok: nothing ? 'OK' : '↓ Vererben' })
    if (!ok || nothing) return
    const commands = [...toInherit.map(r => ({ op: 'relation.attribute.set', args: { relation: r.id, attribute: 'inherit', value: 'true' } })), ...retire.map(x => ({ op: 'relation.retire', args: { relation: x.rel.id } }))]
    const res = await api.batchChunked(commands, { label: 'Vererbung', continueOnError: true })
    store.toast(`✓ ${res.results.length} Einträge${res.errors.length ? ` · ${res.errors.length} Fehler` : ''}`, res.errors.length ? 'error' : 'ok')
    await store.poll(true); await load()
  } catch (e) { store.toast(e.message) } finally { inheriting.value = '' }
}
const newRel = ref({ type: '', q: '', to: null })
const relMatches = computed(() => {
  const q = newRel.value.q.trim().toLowerCase(); if (q.length < 1) return []
  const t = relType(newRel.value.type)
  return tree.rows.filter(r => r.id !== props.id && (!t?.to || t.to.includes(r.role)) && (r.label.toLowerCase().includes(q) || (r.sku ?? '').toLowerCase().includes(q) || r.id.includes(q))).slice(0, 12)
})
const addRel = () => { const n = newRel.value; if (!n.type || !n.to) return; command(() => api.post('/api/relations', { type: n.type, from: props.id, to: n.to })); newRel.value = { type: n.type, q: '', to: null } }
const relTypesFromHere = computed(() => relTypes.value.filter(t => !isMediaType(t.key) && (!t.from || t.from.includes(node.value?.role))))

// ---- Medien (20): Relationen zu Medien (image, document …) als Kacheln; hochladen per Ablegen oder Knopf, oder aus der Bibliothek wählen
// geerbte Medien (Server: inherited) — Kacheln ohne Bearbeitung, mit Herkunft; ein eigenes Medium desselben Typs bricht die Vererbung
const inheritedMedia = computed(() => (rels.value.inherited ?? []).map(x => ({ ...x.relation, from: x.from })))
// Stopps (Taloan, 18.09.): ein geerbtes Medium wird hier nicht „entfernt“, sondern gestoppt — eine Zuordnung zum selben Medium mit stop=true
const stopped = computed(() => (rels.value.out ?? []).filter(r => isMediaType(r.type) && relValueRaw(r, 'stop') === 'true'))
async function stopInherited(r) { await command(async () => { const e = await api.post('/api/relations', { type: r.type, from: props.id, to: r.other.id }); await api.post(`/api/relations/${e.stream}/attributes`, { attribute: 'stop', value: 'true' }); return e }) }
const mediaRels = computed(() => (rels.value.out ?? []).filter(r => isMediaType(r.type) && relValueRaw(r, 'stop') !== 'true').sort((a, b) => (Number(relValueRaw(a, 'position')) || 9e9) - (Number(relValueRaw(b, 'position')) || 9e9) || a.lastNumber - b.lastNumber))
const relValueRaw = (r, key) => r.values.find(v => v.attribute === key && !v.locale && !v.channel)?.value ?? null
const mediaTypes = computed(() => relTypes.value.filter(t => isMediaType(t.key) && (!t.from || t.from.includes(node.value?.role))))
const mediaDrag = ref(false)
const mediaFile = ref(null)
const mediaPick = ref({ open: false, q: '', items: [] })
const typeFor = file => (file.type || '').startsWith('image/') && mediaTypes.value.some(t => t.key === 'image') ? 'image' : (mediaTypes.value.find(t => t.key === 'document') ?? mediaTypes.value[0])?.key
async function uploadMedia(files) {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  busy.value = true
  try {
    for (const f of files) {
      const m = await api.upload('/api/media', f)
      const type = typeFor(f); if (!type) { store.toast('Kein Relationstyp zu Medien für diesen Knotentyp'); break }
      try { await api.post('/api/relations', { type, from: props.id, to: m.id }) } catch (e) { if (!e.message.includes('schon')) throw e }
    }
    await load(); store.poll(true)
  } catch (e) { store.toast(e.message) }
  finally { busy.value = false; mediaDrag.value = false }
}
async function pickSearch() { try { mediaPick.value.items = await api.get(`/api/media?q=${encodeURIComponent(mediaPick.value.q.trim())}&limit=60`) } catch (e) { store.toast(e.message) } }
const linkMedium = m => { const type = m.isImage ? 'image' : 'document'; mediaPick.value.open = false; command(() => api.post('/api/relations', { type: mediaTypes.value.some(t => t.key === type) ? type : mediaTypes.value[0]?.key, from: props.id, to: m.id })) }
const kb = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} kB` : `${(b / 1048576).toFixed(1)} MB`

// Variantenachsen am Produkt — änderbar, solange es keine Varianten hat (ProductAxesSet).
const addAxis = ref('')
const setAxes = axes => command(() => api.post(`${nodeUrl()}/axes`, { axes }, 'PUT'))
// Achse dazu mit Varianten (Taloan, 20.09.): Werte prüfen — leere zählen nicht —, nicht eindeutig → Warnung, nächste Achse ist Pflicht, so lange
// bis die Kombination eindeutig ist; dann alle zufügen oder abbrechen
const wiz = ref(null)   // { axes: [...], dupes: [{ combo, n }], empty: n, next: '' }
async function axisCheck(axes) {
  const t = await api.get(`${nodeUrl()}/table?role=variant&attributes=${encodeURIComponent(axes.join(','))}`)
  const seen = new Map(); let empty = 0
  for (const r of t.rows) {
    const vals = axes.map(a => r.row.axisValues?.[a] ?? r.values[a]?.value ?? '')
    if (vals.some(v => v === '')) { empty++; continue }
    const k = vals.join(' · '); seen.set(k, (seen.get(k) ?? 0) + 1)
  }
  return { dupes: [...seen].filter(([, n]) => n > 1).map(([combo, n]) => ({ combo, n })), empty, total: t.rows.length }
}
async function axisAdd() {
  const a = addAxis.value; if (!a) return; addAxis.value = ''
  if (!node.value.children) { await setAxes([...node.value.axes, a]); return }
  const axes = [...(wiz.value?.axes ?? node.value.axes), a]
  try { const r = await axisCheck(axes); wiz.value = { axes, ...r, next: '' } } catch (e) { store.toast(e.message) }
}
async function axisCommit() { if (!wiz.value || wiz.value.dupes.length) return; const axes = wiz.value.axes; wiz.value = null; await setAxes(axes) }
const axisChoices = computed(() => (model.value?.attributes ?? []).filter(a => ['enum', 'text', 'integer'].includes(a.type) && !a.multiple && !(node.value?.axes ?? []).includes(a.key))
  .sort((a, b) => (a.type === 'enum' ? 0 : 1) - (b.type === 'enum' ? 0 : 1) || (a.label?.de ?? a.key).localeCompare(b.label?.de ?? b.key, 'de')))
function attachAdd() { const g = addGroup.value; if (!g) return; addGroup.value = ''; attach([...node.value.attachedGroups, g]) }
// Kategorien gibt es in der Oberfläche nicht mehr (Taloan, 17.09.): kein zweiter Baum — ein Knoten in mehreren Ästen wird ein
// „Symlink“, Kanalbäume (Web, Print) werden eigene, rein logische Bäume. Die Einträge CategoryAssigned/Removed bleiben (Journal).
function toggleRelease(channel, locale) {
  const q = `channel=${encodeURIComponent(channel)}` + (locale ? `&locale=${encodeURIComponent(locale)}` : '')
  command(() => released(channel, locale) ? api.del(`${nodeUrl()}/releases?${q}`) : api.post(`${nodeUrl()}/releases`, { channel, locale }))
}
function countBelow(id) { let n = 0; for (const k of tree.kids(id)) n += 1 + countBelow(k.id); return n }
async function retire() {
  const kids = node.value.children
  // immer fragen (Taloan: der 🗑 oben fragte gar nicht) — eigener Dialog statt window.confirm
  const label = tree.byId.get(props.id)?.label ?? props.id
  const b = tree.below(props.id)
  if (!await dialog.confirm({ title: `${icon(node.value.role)} ${label} zurückziehen?`, warn: b.total ? `Mit allen ${b.total} Knoten darunter: ${b.summary}` : '', list: b.names, ok: b.total ? `🗑 ${b.total + 1} Knoten zurückziehen` : '🗑 Zurückziehen', danger: true })) return
  try {
    const r = await api.del(nodeUrl() + (kids ? '?recursive=true' : ''))
    const gone = props.id
    const ps = stacksOf(node.value.parent ?? ''); ps.history.push({ kind: 'retire', id: gone, parent: node.value.parent, label, count: r?.retired ?? 1, batch: r?.batch ?? null }); ps.redo.length = 0
    if (r?.retired) store.toast(`${r.retired} Knoten zurückgezogen (Stapel ${r.batch})`, 'ok', { label: '↶ wiederherstellen', run: async () => { try { const x = r.batch ? await api.post(`/api/batches/${encodeURIComponent(r.batch)}/undo`) : await api.post(`/api/nodes/${encodeURIComponent(gone)}/restore`); store.toast(`${x.undone ?? 1} Knoten wiederhergestellt`, 'ok'); await store.poll(true); await tree.load(); router.push(`/tree/${gone}`) } catch (e) { store.toast(e.message) } }, title: `stellt ${r.retired} Knoten wieder her: ${shownLabel.value}${r.retired > 1 ? ` mit ${r.retired - 1} darunter` : ''}` })
    const p = node.value.parent; await tree.load(); router.push(p ? `/tree/${p}` : '/tree')
  } catch (e) { store.toast(e.message) }
}
function cellMenu(e, def, col, block) {
  if (!enabled(def, col, block)) return
  const ownV = ownValue(def.key, col)
  const inh = inherited(def, col)
  const shown = ownV ?? inh.value
  menu.open(e, [
    { label: `${store.name(def)} · ${col.label}`, disabled: true },
    { sep: true },
    { label: 'Eigenen Wert löschen', icon: '✗', key: 'Delete', disabled: ownV == null, hint: ownV == null ? 'kein eigener' : (inh.value != null ? 'dann geerbt' : ''), action: () => setValue(def, col, '') },
    inh.from ? { label: `Zur Herkunft ${icon(inh.from.role)} ${inh.from.label}`, icon: '↑', key: 'h', action: () => router.push(`/tree/${inh.from.id}`) } : null,
    { label: 'Wert kopieren', icon: '⧉', key: 'c', disabled: shown == null, action: () => navigator.clipboard?.writeText(shown ?? '') },
    { label: sourceOf(def, col) ? 'Quelle ändern …' : 'Quelle …', icon: '↗', key: 'q', hint: sourceOf(def, col) ? `${sourceOf(def, col).method} · ${sourceOf(def, col).checkedAt}` : 'Beleg am Wert', disabled: ownV == null, action: () => setSource(def, col) },
    def.type !== 'html' && def.type !== 'rows' ? { label: starOwn(def.key) ? '★ weg — es gilt das von oben' : '★ Name im Baum ab hier', icon: '★', key: 's', action: () => setStar(def) } : null,
    { label: 'Attribut im Modell', icon: '⊞', key: 'm', hint: '→ Modell → Attribute', action: () => router.push({ path: '/model', query: { section: 'attributes', key: def.key } }) },
  ])
}
</script>

<template>
  <div class="pane" style="flex:3" v-if="node">
    <div class="toolbar path" ref="pathEl">
      <template v-for="a in path" :key="a.id">
        <router-link :to="`/tree/${a.id}`" class="crumb">{{ icon(a.role) }} {{ a.label }}</router-link><span class="sep">›</span>
      </template>
      <h1>{{ icon(node.role) }} {{ shownLabel }}</h1>
      <span class="grow" />
      <select v-if="node.role !== 'group'" :value="node.status" @change="setStatus($event.target.value)" class="status" :class="node.status" title="Status">
        <option value="draft">○ Entwurf</option><option value="active">● aktiv</option><option value="discontinued">✗ ausgelaufen</option>
      </select>
      <button class="x" @click="store.journalOpen = !store.journalOpen; store.save()" :title="store.journalOpen ? 'Journal zuklappen' : 'Journal aufklappen'">{{ store.journalOpen ? '≡▸' : '◂≡' }}</button>
      <button class="x" @click="undo" :disabled="!history.length" :title="stepTitle(history[history.length - 1], '↶ Rückgängig', history.length, 'Strg+Z')">↶<span v-if="history.length" class="muted"> {{ history.length }}</span></button>
      <button class="x" @click="redo" :disabled="!redoStack.length" :title="stepTitle(redoStack[redoStack.length - 1], '↷ Wiederholen', redoStack.length, 'Strg+Y', true)">↷<span v-if="redoStack.length" class="muted"> {{ redoStack.length }}</span></button>
      <button class="x" @click="retire" :title="node.children ? `mit ${countBelow(id)} Knoten darunter zurückziehen  (Entf im Baum)` : 'Knoten zurückziehen  (Entf im Baum)'">🗑</button>
    </div>
    <div class="toolbar meta muted">
      <span class="mono">{{ node.id }}</span>
      <span>· {{ roleLabel[node.role] }}</span>
      <span v-if="node.role === 'product' && node.axes.length">· variiert nach {{ node.axes.map(axisLabel).join(', ') }}</span>
      <span v-if="node.role === 'variant'">· <span v-for="(v, a) in node.axisValues" :key="a" class="chip">{{ axisLabel(a) }}: {{ v }}</span></span>
      <span v-if="node.children">· {{ node.children }} Subitems</span>
      <span class="grow" />
      <span>≡ {{ node.entries }} · #{{ node.lastNumber }} {{ when(node.lastAt) }} 👤 {{ node.lastActor }}</span>
      <span v-if="busy">…</span>
    </div>

    <div class="scroll" v-if="model">
    <!-- Alles rollt mit, die Bänder kleben oben (sticky) — nichts verschwindet hinter einem festen Kopf (Taloan, 17.09.).
         Die Sicht (Sprachen, Kanal, Attributsicht, Anordnung) gehört zum Abschnitt Attribute — darum unter dessen Band. -->
    <h2 class="band" @click="toggle('attributes')"><span class="caret">{{ open('attributes') ? '▾' : '▸' }}</span>▤ Attribute <span class="muted">· {{ blocks.length }} Gruppen · {{ blocks.reduce((n, b) => n + b.defs.length, 0) }} Attribute</span></h2>
    <template v-if="open('attributes')">
    <div class="toolbar view">
      <span class="muted">Sicht:</span>
      <span v-for="l in locales" :key="l" class="view-chip" :class="{ on: store.viewLocales.includes(l), master: l === master }" @click="toggleLocale(l)" :title="l === master ? 'Mastersprache' : ''">{{ l }}</span>
      <select :value="store.viewChannel ?? ''" @change="setChannel($event.target.value)" title="Kanal der Sicht">
        <option value="">nur *</option><option v-for="c in channels" :key="c" :value="c">{{ c }}</option>
      </select>
      <span class="sep">·</span>
      <select :value="store.viewKey[node.role] ?? ''" @change="setView($event.target.value)" :title="`Attributsicht für ${roleLabel[node.role]} — ⊞ Modell → Attributsichten`">
        <option value="">◫ komplett</option>
        <option v-for="v in views" :key="v.key" :value="v.key">◫ {{ v.label?.de || v.key }}</option>
      </select>
      <router-link :to="{ path: '/model', query: { section: 'views', key: orderView?.key } }" class="x edit" :title="orderView ? `${orderView.key} bearbeiten → Modell → Attributsichten` : '→ Modell → Attributsichten'">✎</router-link>
      <button :class="{ primary: store.layout === 'flat' }" @click="setLayout('flat')" title="alle Gruppen untereinander">☰</button>
      <button :class="{ primary: store.layout === 'tabs' }" @click="setLayout('tabs')" title="Gruppen als Reiter">⧉</button>
      <button :class="{ primary: store.editableOnly }" @click="toggleEditableOnly" title="nur Gruppen zeigen, die hier bearbeitbar sind (gesperrte weg)">✎ nur bearbeitbare</button>
      <button :class="{ primary: store.ownOnly }" @click="store.ownOnly = !store.ownOnly; if (store.ownOnly && store.layout === 'tabs') setLayout('flat')" title="nur Attribute, die dieser Knoten selbst trägt — dazu Variantenachsen und Pflichtfelder; geerbtes ohne eigenen Wert weg">● nur eigene</button>
      <button :class="{ primary: store.attrNames !== 'label' }" @click="cycleNames" :title="NAMES_TITLE[store.attrNames]">{{ store.attrNames === 'key' ? '⌨ key' : store.attrNames === 'both' ? '⌨ Aa⟨key⟩' : 'Aa' }}</button>
      <span class="grow" />
      <input ref="findBox" v-model="attrFilter" type="search" placeholder="🔍 Attribut oder Wert (sichtbar)" style="width:220px;font-size:12px" title="filtert live über Attributname und die Werte in den gezeigten Spalten; bei Reitern über alle Gruppen; Esc leert" @keydown.esc="attrFilter = ''" />
      <span v-if="attrFilter" class="muted">{{ hitCount }} Treffer</span>
      <span class="muted">{{ columns.length }} Spalten</span>
    </div>

    <div v-if="store.layout === 'tabs' && blocks.length" class="tabs">
      <button v-for="b in (attrFilter.trim() ? filteredBlocks : blocks)" :key="b.key" class="tabbtn" :class="{ on: tab === b.key, locked: !b.active }" @click="tab = b.key" :title="`${b.key} · ${b.defs.length} Attribute` + (b.active ? '' : ` · gesperrt: aktiv ab ${roleLabel[b.activeFrom]}`)">{{ b.label }}<span v-if="!b.active"> 🔒</span></button>
    </div>


      <table class="grid values" :style="`width:${180 + columns.length * 220}px`">
        <colgroup><col :style="`width:${attrColWidth}px`" /><col v-for="c in columns" :key="c.label" style="width:220px" /></colgroup>
        <thead>
          <tr>
            <th>Attribut</th>
            <th v-for="c in columns" :key="c.label" :class="{ master: c.locale === master }" :title="c.locale === master ? 'Mastersprache — Basis fuer alle anderen Sprachen' : ''">{{ c.label }}</th>
          </tr>
        </thead>
        <tbody v-for="b in shownBlocks" :key="b.key">
          <tr class="group-row" :class="{ locked: !b.active }">
            <td :colspan="columns.length + 1">
              {{ b.label }}
              <router-link :to="{ path: '/model', query: { section: 'groups', key: b.key } }" class="muted edit" :title="`${b.key} bearbeiten → Modell → Attributgruppen`">✎</router-link>
              <span class="muted from" :title="`Gruppe hängt an ${b.fromLabel}`">· von {{ b.from === id ? 'hier' : b.fromLabel }}</span>
              <span v-if="!b.active" class="warn" :title="`Werte erst ab ${roleLabel[b.activeFrom]} — hier nur sichtbar`">· 🔒 ab {{ roleLabel[b.activeFrom] }}</span>
            </td>
          </tr>
          <template v-for="def in b.defs" :key="def.key">
          <tr v-if="def.type === 'formula' || def.type === 'template'">
            <td class="attr" :title="def.key + (def.type === 'template' ? ' — Vorlage: Textbaustein {key}[ … ] aus Attributen, Ergebnis wird gebaut' : ' — Formel: der Wert ist ein Skript, das Ergebnis wird gerechnet')"><div class="nm">{{ def.type === 'template' ? '{}' : 'ƒ' }} <span class="lbl">{{ store.label(def) }}</span><span v-if="store.attrNames !== 'label'" class="key muted">{{ def.key }}</span><span v-if="def.required" class="warn" title="Pflicht">●</span></div></td>
            <template v-for="c in columns" :key="c.label">
              <td v-if="!enabled(def, c, b)" class="cell"><div class="cell-box disabled" /></td>
              <td v-else class="cell">
                <div class="cell-box formula" :class="{ inherited: ownValue(def.key, c) == null && inherited(def, c).value != null }" tabindex="0"
                  @click="scriptCell = { def, col: c }" @keydown.enter.prevent="scriptCell = { def, col: c }"
                  :title="(ownValue(def.key, c) ?? inherited(def, c).value ?? 'kein Skript — Klick öffnet den Editor') + (inherited(def, c).from && ownValue(def.key, c) == null ? '\n\ngeerbt von ' + inherited(def, c).from.label : '')">
                  <span class="res">{{ computedValue(def.key, c.locale) ?? '—' }}</span>
                  <span class="src muted">{{ (ownValue(def.key, c) ?? inherited(def, c).value ?? '').split('\n')[0].slice(0, 40) }}</span>
                </div>
              </td>
            </template>
          </tr>
          <tr v-else-if="def.type === 'rows'">
            <td class="attr" :title="def.key"><div class="nm"><span class="lbl">{{ store.label(def) }}</span><span v-if="store.attrNames !== 'label'" class="key muted">{{ def.key }}</span> <span class="muted">≣ Zeilen</span><span v-if="def.required" class="warn" title="Pflicht: mindestens eine Zeile">●</span></div></td>
            <td :colspan="columns.length" style="padding:0">
              <RowsBlock v-if="b.active" :def="def" :rows="node.rows?.[def.key] ?? []" :values="own" :locale="viewLocales[0] ?? locales[0]"
                @set="(col, row, v) => setValue(col, { locale: col.perLocale ? (viewLocales[0] ?? locales[0]) : null, channel: null }, v, row)"
                @add="addRow(def)" @remove="row => removeRow(def, row)" @order="rows => orderRows(def, rows)" />
              <div v-else class="muted" style="padding:4px 8px">🔒</div>
            </td>
          </tr>
          <tr v-else>
            <td class="attr" :title="def.key + (def.required ? ' · Pflicht: ' + Object.entries(def.required).map(([c, l]) => c + ':' + l.join(',')).join(' ') : '') + (def.inheritable ? ' · vererbbar' : '')"><div class="nm">
              <button v-if="def.type !== 'html'" class="star" :class="{ on: !!star(def.key), own: starOwn(def.key), idle: star(def.key) && !star(def.key).applies }" :title="starTitle(def)" @click.stop="setStar(def)">{{ star(def.key) ? '★' : '☆' }}</button>
              <span class="lbl">{{ store.label(def) }}</span><span v-if="store.attrNames !== 'label'" class="key muted">{{ def.key }}</span>
              <span v-if="def.unit" class="muted">{{ def.unit }}</span>
              <span v-if="def.pattern" class="muted" :title="`Muster: ${def.patternHint || def.pattern}`">⌗</span>
              <span v-if="def.multiple" class="muted" title="vermehrbar: mehrere Werte, Liste in der Zelle">≣</span>
              <span v-if="def.inheritable" class="muted" title="vererbbar: gilt nach unten">↓</span>
              <span v-if="def.required" class="warn" title="Pflicht">●</span>
            </div></td>
            <template v-for="c in columns" :key="c.label">
              <td v-if="axisValue(def.key, c) != null" class="cell"><div class="cell-box locked" title="Variantenachse — festgelegt beim Anlegen der Variante, hier nicht änderbar">{{ def.type === 'enum' ? listLabel(def)(axisValue(def.key, c)) : axisValue(def.key, c) }} <span class="muted">⌖</span></div></td>
              <ToggleCell v-else-if="def.type === 'boolean'" :value="ownValue(def.key, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
              <ListCell v-else-if="def.multiple" :value="ownValue(def.key, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" :options="def.type === 'enum' ? listOptions(def) : null" :label-of="def.type === 'enum' ? listLabel(def) : null" :check="v => validate(convert(v, def, store.model), def, store.model)" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
              <SelectCell v-else-if="def.type === 'enum'" :value="ownValue(def.key, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" :options="listOptions(def)" :label-of="listLabel(def)" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
              <DateCell v-else-if="def.type === 'date'" :value="ownValue(def.key, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
              <HtmlCell v-else-if="def.type === 'html'" :value="ownValue(def.key, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" :title="`${store.name(def)} · ${c.label}`" :node="id" :locale="c.locale ?? null" :label="store.label(def)"
                :origin="inherited(def, c).from ? `${icon(inherited(def, c).from.role)} ${inherited(def, c).from.label}` : null" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
              <Cell v-else :value="ownValue(def.key, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" :node="id" :locale="c.locale ?? null" :label="store.label(def)"
                :mark="stale(def, c) ? '⟳' : (inherited(def, c).master && ownValue(def.key, c) == null ? '◌' : null)" :mark-title="stale(def, c) ? `zu überarbeiten — ${master} wurde später geändert` : (c.locale ? `nicht übersetzt — zeigt ${master}; Enter überschreibt` : `kein Grundtext — zeigt ${master}; Enter setzt den sprachneutralen Text (z. B. Kurzbezeichnung)`)"
                :origin="inherited(def, c).from ? `${icon(inherited(def, c).from.role)} ${inherited(def, c).from.label}` : null" :source="sourceOf(def, c)" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
            </template>
          </tr>
          </template>
        </tbody>
      </table>
      <div v-if="!blocks.length" class="empty">Keine Attributgruppe gilt hier — unten eine anhängen, oder oben am Pfad.</div>
    </template>

      <div class="section" v-if="node.role === 'product'">
        <h2 @click="toggle('axes')"><span class="caret">{{ open('axes') ? '▾' : '▸' }}</span>◆ Variantenachsen <span class="muted">· sichern Eindeutigkeit in den gewählten Attributen über alle Varianten</span></h2>
        <template v-if="open('axes')">
        <table v-if="node.axes.length" class="grid" style="width:auto">
          <thead><tr><th style="width:180px">Achse</th><th style="width:260px">Attribut</th><th style="width:30px"></th></tr></thead>
          <tbody>
            <tr v-for="(k, i) in node.axes" :key="k" :title="k">
              <td class="muted">{{ i + 1 }}. {{ axisLabel(k) }}</td>
              <td><router-link :to="{ path: '/model', query: { section: 'attributes', key: k } }" class="mono">{{ k }}</router-link></td>
              <td class="num"><button class="x" @click="setAxes(node.axes.filter(x => x !== k))" title="Achse weg — ihr Wert bleibt als Attributwert an den Varianten">×</button></td>
            </tr>
          </tbody>
        </table>
        <div class="chips" style="margin-top:6px">
          <select v-model="addAxis" style="width:220px"><option value="">{{ wiz ? '+ weitere Achse (Pflicht) …' : '+ Achse …' }}</option><option v-for="a in axisChoices.filter(x => !(wiz?.axes ?? []).includes(x.key))" :key="a.key" :value="a.key">{{ a.type === 'enum' ? '☰' : a.type === 'integer' ? '12' : 'Aa' }} {{ a.label?.de || a.key }} · {{ a.key }}</option></select>
          <button class="primary" :disabled="!addAxis" @click="axisAdd">{{ wiz ? 'prüfen' : 'dazu' }}</button>
        </div>
        <div v-if="wiz" class="picker" style="padding:8px;margin-top:6px">
          <div class="chips"><span v-for="k in wiz.axes" :key="k" class="chip" :class="{ on: !node.axes.includes(k) }">{{ axisLabel(k) }}</span><span class="muted" style="font-size:12px">· {{ wiz.total }} Varianten{{ wiz.empty ? `, ${wiz.empty} ohne Wert (zählen nicht)` : '' }}</span></div>
          <div v-if="wiz.dupes.length" class="warn" style="margin-top:6px">⚠ nicht eindeutig — <span v-for="d in wiz.dupes.slice(0, 6)" :key="d.combo" class="chip" style="margin-right:4px">{{ d.combo }} × {{ d.n }}</span>{{ wiz.dupes.length > 6 ? ` … ${wiz.dupes.length}` : '' }} → oben eine weitere Achse wählen und prüfen</div>
          <div v-else class="pos" style="margin-top:6px">✓ eindeutig</div>
          <div class="chips" style="margin-top:6px"><button class="primary" :disabled="wiz.dupes.length > 0" @click="axisCommit">Achsen zufügen</button><button @click="wiz = null">Abbrechen</button></div>
        </div>
        </template>
      </div>
      <div class="section" :class="{ over: mediaDrag }" @dragover.prevent="mediaDrag = true" @dragleave="mediaDrag = false" @drop.prevent="uploadMedia([...$event.dataTransfer.files])">
        <h2 @click="toggle('media')"><span class="caret">{{ open('media') ? '▾' : '▸' }}</span>🖼 Medien <span class="muted">· {{ mediaRels.length }}<template v-if="inheritedMedia.length"> · {{ inheritedMedia.length }} geerbt</template> · Dateien hierher ziehen</span></h2>
        <template v-if="open('media')">
        <div class="tiles">
          <div v-for="r in mediaRels" :key="r.id" class="tile" :title="`${r.other.label} · ${r.other.mime ?? ''} · ${relType(r.type)?.label?.de || r.type}`">
            <a :href="`/api/media/${r.other.id}/file`" target="_blank"><MediaThumb v-if="r.other.isImage" :id="r.other.id" /><div v-else class="doc">{{ (r.other.mime ?? '').split('/')[1]?.slice(0, 6) || '📄' }}</div></a>
            <div class="name"><router-link :to="`/media`" class="muted">{{ r.other.label }}</router-link></div>
            <table class="grid" style="width:auto;margin:0"><tbody>
              <tr v-for="d in relGroupAttrs(r.type).filter(d => d.key !== 'stop')" :key="d.key"><td class="muted" style="font-size:11px;padding:0 4px" :title="d.key === 'inherit' ? 'gilt dann an allen Subitems — bis eines die Vererbung stoppt' : d.key">{{ d.label?.de || d.key }}</td>
                <ToggleCell v-if="d.type === 'boolean'" :value="relValue(r, d)" @save="v => setRelValue(r, d, v)" /><Cell v-else :value="relValue(r, d)" @save="v => setRelValue(r, d, v)" /></tr>
            </tbody></table>
            <div class="muted meta">{{ relType(r.type)?.label?.de || r.type }}<span v-if="relValueRaw(r, 'inherit') === 'true'" title="wird an die Subitems vererbt"> · ↓ vererbt</span><button class="x" style="float:right" @click="retireRel(r)" title="Zuordnung lösen (das Medium bleibt in der Bibliothek)">×</button></div>
          </div>
          <!-- geerbte Medien: kursiv, gedämpft, mit Herkunft — hier nicht änderbar; ein eigenes Medium dieses Typs bricht die Vererbung -->
          <div v-for="r in inheritedMedia" :key="'inh-' + r.id" class="tile inherited" :title="`geerbt von ${r.from.label} — nicht löschbar; ⛔ unterbindet Verwendung und Vererbung hier und an allen Subitems`">
            <a :href="`/api/media/${r.other.id}/file`" target="_blank"><MediaThumb v-if="r.other.isImage" :id="r.other.id" /><div v-else class="doc">{{ (r.other.mime ?? '').split('/')[1]?.slice(0, 6) || '📄' }}</div></a>
            <div class="name muted"><i>{{ r.other.label }}</i></div>
            <div class="muted meta">{{ relType(r.type)?.label?.de || r.type }} · <router-link :to="`/tree/${r.from.id}`" class="muted" title="zum Knoten, an dem das Medium hängt">↑ {{ r.from.label }}</router-link>
              <button class="x" style="float:right" @click="stopInherited(r)" title="Verwendung und Vererbung hier unterbinden — das Medium steht dann hier und an allen Subitems nicht zur Verfügung (lässt sich wieder zulassen)">⛔</button></div>
          </div>
        </div>
        <div v-if="stopped.length" class="chips" style="margin-top:6px">
          <span class="muted" style="font-size:12px" title="von oben vererbt — hier und an allem darunter weder verwendet (Ansicht, Datenblatt, Export, Suche) noch weitervererbt">⛔ Verwendung und Vererbung unterbunden:</span>
          <span v-for="r in stopped" :key="r.id" class="chip" :title="`${r.other.label} — von oben vererbt; hier und darunter weder verwendet noch weitervererbt`">{{ r.other.label }} <button @click="retireRel(r)" title="wieder zulassen — das Medium ist dann wieder geerbt da">×</button></span>
        </div>
        <div class="chips" style="margin-top:6px" v-if="mediaTypes.length">
          <button class="primary" @click="mediaFile.click()">⇧ hochladen</button>
          <button v-if="mediaRels.length && node.children" @click="inheritToSubitems" :disabled="!!inheriting" title="Aufräumen: die Medien hier auf „vererben“ setzen und gleiche feste Zuordnungen an den Subitems lösen — sie erben dann">{{ inheriting || '↓ feste Bilder der Subitems durch Vererbung ersetzen' }}</button>
          <input ref="mediaFile" type="file" multiple style="display:none" @change="uploadMedia([...$event.target.files]); $event.target.value = ''" />
          <button @click="mediaPick.open = !mediaPick.open; mediaPick.open && pickSearch()">🖼 aus Medien wählen</button>
          <input v-if="mediaPick.open" v-model="mediaPick.q" type="search" placeholder="🔍 Name" style="width:200px" @input="pickSearch" />
        </div>
        <div v-if="mediaPick.open" class="tiles" style="margin-top:6px;max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:6px">
          <div v-for="m in mediaPick.items.filter(x => !mediaRels.some(r => r.other.id === x.id))" :key="m.id" class="tile pickable" @click="linkMedium(m)" :title="`${m.name} · ${kb(m.bytes)}`">
            <MediaThumb v-if="m.isImage" :id="m.id" /><div v-else class="doc">{{ m.mime.split('/')[1]?.slice(0, 6) || '📄' }}</div>
            <div class="name">{{ m.name }}</div>
          </div>
          <div v-if="!mediaPick.items.length" class="muted" style="padding:8px;font-size:12px">nichts</div>
        </div>
        </template>
      </div>
      <div class="section">
        <h2 @click="toggle('relations')"><span class="caret">{{ open('relations') ? '▾' : '▸' }}</span>⇄ Relationen <span class="muted">· {{ relCount }}</span></h2>
        <template v-if="open('relations')">
        <div v-for="b in relBlocks" :key="b.type" class="relblock">
          <table class="grid" style="width:auto">
            <thead><tr><th style="width:180px">{{ relType(b.type)?.label?.de || b.type }}</th><th style="width:260px"></th><th v-for="d in relGroupAttrs(b.type)" :key="d.key" style="width:140px" :title="d.key">{{ d.label?.de || d.key }}<span v-if="d.unit" class="muted"> {{ d.unit }}</span></th><th style="width:28px"></th></tr></thead>
            <tbody>
              <tr v-for="r in b.out" :key="r.id" :title="r.id">
                <td class="muted">→ {{ relType(b.type)?.label?.de || b.type }}</td>
                <td><router-link v-if="!r.other.missing" :to="`/tree/${r.other.id}`">{{ icon(r.other.role) }} {{ r.other.label }}</router-link><span v-else class="neg" title="Knoten zurückgezogen">✗ {{ r.other.id }}</span></td>
                <Cell v-for="d in relGroupAttrs(b.type)" :key="d.key" :value="relValue(r, d)" @save="v => setRelValue(r, d, v)" />
                <td class="num"><button class="x" @click="retireRel(r)" title="Relation zurückziehen">×</button></td>
              </tr>
              <tr v-for="r in b.in" :key="r.id" :title="r.id">
                <td class="muted">{{ relType(b.type)?.symmetric ? '⇄' : '←' }} {{ relType(b.type)?.symmetric ? (relType(b.type)?.label?.de || b.type) : (relType(b.type)?.reverse?.de || relType(b.type)?.label?.de || b.type) }}</td>
                <td><router-link v-if="!r.other.missing" :to="`/tree/${r.other.id}`">{{ icon(r.other.role) }} {{ r.other.label }}</router-link><span v-else class="neg" title="Knoten zurückgezogen">✗ {{ r.other.id }}</span></td>
                <td v-for="d in relGroupAttrs(b.type)" :key="d.key" class="muted">{{ relValue(r, d) ?? '' }}</td>
                <td class="num"><button class="x" @click="retireRel(r)" title="Relation zurückziehen">×</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="chips" style="margin-top:6px">
          <select v-model="newRel.type" style="width:170px" title="Relationstyp — ⊞ Modell → Relationen"><option value="">⇄ Typ …</option><option v-for="t in relTypesFromHere" :key="t.key" :value="t.key">{{ t.label?.de || t.key }}</option></select>
          <input v-model="newRel.q" type="search" placeholder="🔍 Ziel: Name, SKU, Id" style="width:240px" :disabled="!newRel.type" @input="newRel.to = null" />
          <span v-if="newRel.to" class="chip">→ {{ tree.byId.get(newRel.to)?.label }} <button @click="newRel.to = null; newRel.q = ''">×</button></span>
          <button class="primary" :disabled="!newRel.type || !newRel.to" @click="addRel">verbinden</button>
        </div>
        <div v-if="newRel.q && !newRel.to" class="picker" style="max-width:520px">
          <div v-for="m in relMatches" :key="m.id" class="pick" @click="newRel.to = m.id; newRel.q = m.label">{{ icon(m.role) }} {{ m.label }}<span class="muted mono" style="margin-left:auto;font-size:11px">{{ m.sku ?? m.id }}</span></div>
          <div v-if="!relMatches.length" class="muted" style="padding:4px 8px;font-size:12px">nichts zu „{{ newRel.q }}“</div>
        </div>
        </template>
      </div>
      <div class="section">
        <h2 @click="toggle('groups')"><span class="caret">{{ open('groups') ? '▾' : '▸' }}</span>▤ Attributgruppen NEU ab diesem Knoten <span class="muted">· hier angehängt, gelten ab hier nach unten — geerbte stehen oben mit Herkunft</span></h2>
        <template v-if="open('groups')">
        <table v-if="attachedSorted.length" class="grid" style="width:auto">
          <thead><tr><th style="width:180px">Gruppe</th><th style="width:260px">gilt</th><th style="width:30px"></th></tr></thead>
          <tbody>
            <tr v-for="g in attachedSorted" :key="g" :title="g">
              <td><router-link :to="{ path: '/model', query: { section: 'groups', key: g } }">▤ {{ groupLabel(g) }}</router-link></td>
              <td class="muted">{{ groupLocked(g) ? '⌖ hier gesperrt — aktiv ab ' + roleLabel[model.groups.find(x => x.key === g).activeFrom] : 'ab hier nach unten' }}</td>
              <td class="num"><button class="x" @click="attach(node.attachedGroups.filter(x => x !== g))" title="Gruppe hier abnehmen">×</button></td>
            </tr>
          </tbody>
        </table>
        <div class="chips" style="margin-top:6px">
          <select v-model="addGroup" style="width:200px"><option value="">+ Gruppe …</option><option v-for="g in freeGroups" :key="g.key" :value="g.key" :title="g.key">{{ g.label?.de || g.key }}{{ g.activeFrom ? ' (ab ' + roleLabel[g.activeFrom] + ')' : '' }}</option></select>
          <button class="primary" :disabled="!addGroup" @click="attachAdd">anhängen</button>
        </div>
        </template>
      </div>

      <div class="section" v-if="node.orphans?.length">
        <h2 class="warn">⚠ Verwaiste Werte</h2>
        <div class="muted">Eigene Werte für Attribute, die hier über keine Gruppe gelten (z. B. nach dem Umhängen): <span class="mono">{{ node.orphans.join(', ') }}</span> — Gruppe anhängen, dann sind sie wieder da.</div>
      </div>

      <div class="section" v-if="node.role !== 'group'">
        <h2 @click="toggle('releases')"><span class="caret">{{ open('releases') ? '▾' : '▸' }}</span>✓ Freigaben <span class="muted">· Vollständigkeit aus der Pflicht der aktiven Attribute; unvollständig = keine Freigabe</span></h2>
        <template v-if="open('releases')">
        <table class="grid releases">
          <thead><tr><th>Kanal</th><th v-if="node.role === 'variant'">*</th><th v-for="l in locales" :key="l">{{ l }}</th></tr></thead>
          <tbody>
            <tr v-for="ch in channels" :key="ch">
              <td class="mono muted">{{ ch }}</td>
              <td v-if="node.role === 'variant'">
                <button class="toggle" :class="{ on: released(ch, null) }" :disabled="!released(ch, null) && !!incomplete(ch, null)" :title="incomplete(ch, null) ? 'fehlt: ' + incomplete(ch, null).missing.join(', ') : 'alle Sprachen'" @click="toggleRelease(ch, null)">{{ released(ch, null) ? '✓' : '·' }}</button>
              </td>
              <td v-for="l in locales" :key="l" class="rel">
                <button v-if="node.role === 'variant'" class="toggle" :class="{ on: released(ch, l) }" :disabled="!released(ch, l) && !!incomplete(ch, l)" :title="incomplete(ch, l) ? 'fehlt: ' + incomplete(ch, l).missing.join(', ') : ''" @click="toggleRelease(ch, l)">{{ released(ch, l) ? '✓' : '·' }}</button>
                <span v-if="completeness(ch, l)" class="mono" :class="completeness(ch, l).missing.length ? 'neg' : 'pos'" :title="completeness(ch, l).missing.length ? 'fehlt: ' + completeness(ch, l).missing.join(', ') : 'vollständig'">{{ completeness(ch, l).filled }}/{{ completeness(ch, l).required }}</span>
                <span v-else class="muted" title="hier ist nichts Pflicht">–</span>
              </td>
            </tr>
          </tbody>
        </table>
        </template>
      </div>

      <!-- Versionen (Taloan, 19.09.): Freigabe = Version, Zeiger auf den Journalstand + eingefrorene Belege; Stand ansehen, zurückrollen -->
      <div class="section">
        <h2 @click="toggle('versions')"><span class="caret">{{ open('versions') ? '▾' : '▸' }}</span>⎘ Versionen <span class="muted">· Stand einfrieren, Belege der Erzeuger, Stand ansehen, zurückrollen</span></h2>
        <VersionsPanel v-if="open('versions')" :id="id" :role="node.role" @changed="load(); store.poll(true)" />
      </div>
    </div>

    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">
      <kbd>Tab</kbd> Zelle · <kbd>Enter</kbd> bearbeiten/speichern · <kbd>Esc</kbd> verwerfen · <kbd>Entf</kbd> eigenen Wert löschen · schraffiert = Achse gibt es nicht · 🔒 = Gruppe hier nicht aktiv · <i>kursiv</i> = geerbt
    </div>
  </div>
  <div v-else class="pane" style="flex:3"><div class="empty">…</div></div>

  <Splitter v-if="store.journalOpen" v-model="journalW" side="right" :min="240" :max="1000" />
  <ScriptEditor v-if="scriptCell" :model-value="ownValue(scriptCell.def.key, scriptCell.col) ?? inherited(scriptCell.def, scriptCell.col).value ?? ''" :title="`${scriptCell.def.label?.de || scriptCell.def.key} · ${scriptCell.col.label} · ${shownLabel}`"
    :draft-key="`${id}.${scriptCell.def.key}.${scriptCell.col.label}`" :type="scriptCell.def.type" :node="id" :locale="scriptCell.col.locale ?? undefined"
    :attributes="(model?.attributes ?? []).filter(a => a.key !== scriptCell.def.key && a.type !== 'rows' && a.type !== 'html')"
    @save="v => { setValue(scriptCell.def, scriptCell.col, v); scriptCell = null }" @close="scriptCell = null" />
  <div v-if="store.journalOpen" class="pane" :style="`width:${journalW}px;flex:none`">
    <div class="toolbar"><h1>≡ Journal</h1><span class="muted mono">{{ id }}</span><span class="muted">{{ entries.length }}</span><span class="grow" /><button class="x" @click="store.journalOpen = false; store.save()" title="Journal zuklappen">▸</button></div>
    <div class="scroll"><EntryList :entries="entries" /></div>
  </div>
  <div v-else class="pane rail-pane" @click="store.journalOpen = true; store.save()" title="Journal aufklappen">
    <span class="vert">◂ ≡ Journal · {{ entries.length }}</span>
  </div>
</template>

<style scoped>
/* Pfad bricht nicht um — wird er zu lang, schrumpft die Schrift (fitPath), notfalls Ellipse an den Gliedern (Taloan) */
.path { flex-wrap: nowrap; white-space: nowrap; overflow: hidden; }
.path .crumb, .path h1 { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.path .crumb, .path h1 { flex: 0 1 auto; }
.path.rigid .crumb, .path.rigid h1 { flex: 0 0 auto; }
.crumb { color: var(--muted); }
.crumb:hover { color: var(--accent); }
.meta { font-size: 12px; min-height: 28px; }
/* Sicht-Zeile klebt unter dem Band, damit Sprachen, Sicht und Suchfeld beim Rollen bleiben (Taloan) */
.view { gap: 4px; font-size: 12px; min-height: 30px; height: 31px; box-sizing: border-box; flex-wrap: nowrap; overflow: hidden; position: sticky; top: 26px; z-index: 3; background: var(--pane); }
/* Mastersprache: fett und in Akzentfarbe — in der Sicht und im Spaltenkopf */
.view-chip.master { font-weight: 700; }
th.master { color: var(--accent); font-weight: 700; }
.view select, .view button { font-size: 12px; padding: 1px 6px; }
/* Reiter: einzeilig, klein, umbrechend — mit Echtdaten sind es zwanzig und mehr (Taloan, 17.09.) */
.tabs { display: flex; flex-wrap: wrap; gap: 2px; padding: 4px 8px 0; border-bottom: 1px solid var(--line); background: var(--bg); }
.tabbtn { border: 1px solid var(--line); border-bottom: 0; border-radius: 6px 6px 0 0; background: var(--bg); color: var(--muted); padding: 1px 8px; font-size: 12px; line-height: 18px; white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.tabbtn .n { font-size: 10px; }
/* aktiv: Farbe und Kante, nie fett — fett ist breiter und liesse die Reiterzeile anders umbrechen */
.tabbtn.on { background: var(--pane); color: var(--accent); border-color: var(--accent); }
.tabbtn.locked { opacity: .6; }
/* Abschnitte des Knotens: dieselbe Stufe wie ein Gruppenkopf im Gitter — Band in Akzentfarbe mit Oberkante (Taloan, 17.09.) */
.section { padding: 0 8px 10px; border-top: 0; }
.relblock { margin-bottom: 8px; }
.section.over { outline: 2px dashed var(--accent); outline-offset: -4px; }
.tiles { display: flex; flex-wrap: wrap; gap: 8px; }
.tile.inherited { opacity: .7; border-style: dashed; }
.tile { width: 150px; border: 1px solid var(--line); border-radius: 6px; padding: 4px; background: var(--pane); }
.tile.pickable { width: 110px; cursor: pointer; }
.tile.pickable:hover { background: var(--hover); }
.tile img, .tile .doc { width: 100%; height: 100px; object-fit: contain; display: grid; place-items: center; background: var(--bg); border-radius: 4px; color: var(--muted); font-size: 12px; }
.tile.pickable img, .tile.pickable .doc { height: 70px; }
.tile .name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 4px 0; }
.tile .name a { text-decoration: none; }
.tile .meta { font-size: 11px; margin-top: 2px; }
.relblock a { color: inherit; text-decoration: none; }
.relblock a:hover { text-decoration: underline; }
.picker { max-height: 240px; overflow: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--pane); margin-top: 4px; }
.pick { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 8px; white-space: nowrap; cursor: pointer; }
.pick:hover { background: var(--hover); }
/* Abschnittsüberschriften (Attribute, Medien, Relationen, …): oberste Stufe — Band in Akzentfarbe mit Oberkante */
.section h2, h2.band { font-size: 12px; margin: 0; padding: 0 8px; height: 26px; line-height: 24px; box-sizing: border-box; color: var(--text); font-weight: 600; letter-spacing: .02em; background: var(--accent-soft); border-top: 2px solid var(--accent);
  position: sticky; top: 0; left: 0; z-index: 3; cursor: pointer; user-select: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.section h2 { margin: 0 -8px 8px; }
.section h2 .muted, h2.band .muted { font-weight: 400; }
.section h2 .caret, h2.band .caret { display: inline-block; width: 14px; color: var(--muted); }
/* Tabellenkopf klebt unter dem Band (26px) */
table.values th { top: 57px; }   /* Band 26 + Sicht-Zeile 31 */
/* Gruppenköpfe (Taloan, 17.09.): eine Stufe unter der Abschnittsüberschrift, darum nicht dasselbe Band —
   Zellton mit Akzentkante links, Name in Akzentfarbe; gesperrte zurückgenommen (gedämpft, 🔒). */
.cell-box.formula { display: flex; gap: 8px; align-items: baseline; cursor: pointer; }
.cell-box.formula .res { font-weight: 600; }
.cell-box.formula .src { font: 11px var(--mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.group-row td { background: var(--cell); color: var(--accent); font-size: 12px; font-weight: 600; height: 26px; border-top: 1px solid var(--line); }
.group-row td:first-child { border-left: 3px solid var(--accent); padding-left: 6px; }
.group-row td::before { content: '▤ '; }
.group-row .edit { text-decoration: none; margin-left: 4px; opacity: .5; color: var(--text); }
.group-row:hover .edit { opacity: 1; }
.group-row .from { font-weight: 400; color: var(--muted); }
.group-row.locked td { background: var(--bg); color: var(--muted); font-weight: 500; }
.group-row.locked td:first-child { border-left-color: var(--line); }
.group-row.locked .warn { color: var(--muted); font-weight: 400; }
td.attr { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* technischer Key neben der Bezeichnung: abgegraut, Schreibmaschine (Taloan) */
td.attr .key { font-family: var(--mono); font-size: 11px; margin-left: 6px; flex: 0 0 auto; }
/* Namenszelle als Zeile: Bezeichnung darf mit Ellipse enden, der Key nie (Taloan: nicht raten) */
/* die Zelle bleibt Tabellenzelle (sonst stimmen die Zeilenhöhen nicht mehr, Taloan) — der Flex-Kasten ist ein Div darin */
td.attr .nm { display: flex; align-items: center; gap: 4px; min-width: 0; }
td.attr .lbl { flex: 0 1 auto; min-width: 2em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* ★ Name im Baum: hohl = nicht gesetzt, blau = geerbt (von oben), gelb = hier gesetzt, halb durchsichtig = gesetzt, gilt hier nicht (Taloan, 17.09.) */
.star { border: 0; background: none; padding: 0 2px 0 0; color: var(--muted); opacity: .45; cursor: pointer; font-size: 12px; line-height: 1; }
tr:hover .star { opacity: 1; }
.star.idle { opacity: .5; }
.star.on { opacity: 1; color: var(--accent); }
.star.own { color: var(--warn); }
table.releases { width: auto; }
table.releases td { text-align: center; }
table.releases td.rel { white-space: nowrap; }
table.releases td.rel .toggle { margin-right: 6px; }
.toggle { width: 28px; color: var(--muted); }
.toggle.on { color: var(--pane); background: var(--pos); border-color: var(--pos); }
.toggle:disabled { opacity: .35; cursor: not-allowed; }
.status { border: 1px solid var(--line); border-radius: 4px; padding: 2px 4px; background: var(--pane); }
.status.active { color: var(--pos); }
.status.discontinued { color: var(--neg); }
.x { border: 0; background: none; }
.rail-pane { width: 26px; flex: none; cursor: pointer; align-items: center; padding-top: 8px; }
.rail-pane:hover { background: var(--hover); }
.vert { writing-mode: vertical-rl; color: var(--muted); font-size: 12px; white-space: nowrap; }
</style>
