<script setup>
// Ein Knoten: Pfad, Kopf nach Rolle, die Attributgruppen, die hier gelten (am Pfad
// angehängt, Definition vererbt), darin die Attribute als Gitter Attribut × Achse.
// Gruppen, die hier nicht aktiv sind (aktiv ab tieferem Knotentyp), und Attribute ohne
// Haken für diesen Knotentyp sind sichtbar, aber gesperrt (⌀) — der Umfang-Schalter
// (store.scope) engt ein: Alle · Editierbare · Nur hier editierbare Attribute. Sicht je Knotentyp ordnet
// Gruppen und Attribute; flach untereinander oder als Reiter. Jede Änderung ist
// ein Befehl an den Server = ein Eintrag.
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { setStatus as setStatusScoped, setStatusAb } from '../status.js'
import { dialog } from '../dialog.js'
import { tree, icon } from '../tree.js'
import { menu } from '../menu.js'
import { plugins } from '../plugins.js'
import Cell from '../components/Cell.vue'
import ToggleCell from '../components/ToggleCell.vue'
import SelectCell from '../components/SelectCell.vue'
import ListCell from '../components/ListCell.vue'
import PluginBands from '../components/PluginBands.vue'
import WorkflowLocales from '../components/WorkflowLocales.vue'
import { validate, convert } from '../mapper.js'
import DateCell from '../components/DateCell.vue'
import HtmlCell from '../components/HtmlCell.vue'
import RowsBlock from '../components/RowsBlock.vue'
import VersionsPanel from '../components/VersionsPanel.vue'
import MediaThumb from '../components/MediaThumb.vue'
import MediaPreview from '../components/MediaPreview.vue'
import { inGruppe, gruppenVon } from '../gruppen.js'
import MediaPicker from '../components/MediaPicker.vue'
import DocTables from '../components/DocTables.vue'
import { mediaTypesFor, attachFiles, meldung as medienMeldung, IST_DOKUMENT } from '../media.js'
import EntryList from '../components/EntryList.vue'
import ScriptEditor from '../components/ScriptEditor.vue'
import Splitter from '../components/Splitter.vue'
import MatrixPicker from '../components/MatrixPicker.vue'
import { paneWidth } from '../panes.js'
import { t as t_ } from '../i18n.js'
import { L } from '../i18n.js'
const journalW = paneWidth('journal', 420)

const props = defineProps({ id: String, pub: { type: String, default: null }, pubRubric: { type: String, default: null } })   // pubRubric: Rubrik, in der der Verweis hängt (für den Stand)   // pub: Id des Publikationsbaums — Ansicht als Verweis
// Im Publikationsbaum ist der Verweis ein Fenster auf den Pflegeknoten: Pflegewerte nur lesen (auch als admin — geändert wird an der Quelle),
// pflegbar nur, was eine Gruppe an einer Rubrik dieses Baums mitbringt (z. B. SEO fürs Web)
const pubTree = computed(() => props.pub ? tree.byId.get(props.pub) : null)
// Kopierte Rubrik: die Pflegewerte der Quellgruppe,
// aufgelöst wie in der Tabelle (geerbt zählt), je Spalte der Ansicht — nur zu lesen, geändert wird an der Quelle
const sourceRows = ref([])
async function loadSource() {
  sourceRows.value = []
  const src = node.value?.source; if (!props.pub || !src) return
  try {
    const per = await Promise.all(columns.value.map(c => api.get(`/api/nodes/${encodeURIComponent(src)}/table?self=true${pubStand.value ? '&at=' + pubStand.value.stand : ''}&locale=${c.locale ?? ''}&channel=${c.channel ?? ''}`).then(t => t.rows.find(r => r.row.id === src)).catch(() => null)))
    const cols = per.find(Boolean)?.values ? Object.keys(per.find(Boolean).values) : []
    const defs = cols.map(k => model.value.attributes.find(a => a.key === k)).filter(a => a && !['rows', 'formula', 'template'].includes(a.type))
    sourceRows.value = defs.map(def => ({ def, cells: columns.value.map((c, i) => { const v = per[i]?.values?.[def.key]; return v && (!c.locale || def.perLocale) && (!c.channel || def.perChannel) ? v.value ?? '' : null }) }))
      .filter(r => r.cells.some(v => v))
  } catch { sourceRows.value = [] }
}
const router = useRouter()
const route = useRoute()
// ?group=<key>: bei Reitern der Reiter, bei der Liste hinscrollen
async function focusGroup() {
  const g = route.query.group; if (!g || !node.value) return
  await nextTick()
  // die Gruppe gilt am Knoten, aber die gewählte Sicht zeigt sie nicht: Sicht auf „alle“
  if (!blocks.value.some(b => b.key === g) && (node.value.groups ?? []).some(x => x.key === g) && store.viewKey[node.value.role]) { setView(''); await nextTick() }
  // Ein Attribut steht nur einmal da (n:m): eine Gruppe, deren Attribute alle unter einer anderen stehen, hat keinen
  // eigenen Block — dann zum Block, der sie zeigt
  let ziel = blocks.value.some(b => b.key === g) ? g : null
  if (!ziel && (node.value.groups ?? []).some(x => x.key === g)) {
    const keys = (model.value?.groups ?? []).find(x => x.key === g)?.attributes ?? []
    ziel = blocks.value.find(b => b.defs.some(d => keys.includes(d.key)))?.key ?? null
  }
  if (!ziel) { store.toast(t_('Gruppe {0} gilt an diesem Knoten nicht', [g])); return }
  if (store.layout === 'tabs') tab.value = ziel
  else document.querySelector(`tbody[data-group="${ziel}"]`)?.scrollIntoView({ block: 'start' })
}

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
const roleLabel = { group: t_('Produktgruppe'), product: t_('Produkt'), variant: t_('Variante'), rubric: t_('Rubrik') }

// ---- Sicht: Spalten aus der Matrix Sprache × Kanal (store.viewCells); Reihenfolge Kanal (Stern zuerst), darin Sprache (Stern zuerst)
const columns = computed(() => {
  // Publikationsbaum: der Grundwert und die Spalten des Kanals dieses Baums — der Redakteur schreibt auf seiner Kanalachse
  if (pubTree.value?.channel) { const c = pubTree.value.channel; return [{ locale: null, channel: null, label: '*' }, ...[null, ...(store.viewLocales ?? [])].map(l => ({ locale: l, channel: c, label: `${l ?? '*'}/${c}` }))] }
  const cells = new Set(store.viewCells ?? ['|'])
  const cols = []
  for (const c of [null, ...channels.value]) for (const l of [null, ...locales.value])
    if ((l == null && c == null) || cells.has(`${l ?? ''}|${c ?? ''}`)) cols.push({ locale: l, channel: c, label: c ? `${l ?? '*'}/${c}` : (l ?? '*') })
  return cols
})
function setCells(cells) { store.viewCells = cells; store.save() }
// erst hier — der Getter läuft sofort und braucht node und columns (TDZ: „Cannot access before initialization“, jede Knotenansicht tot)
// Stand: Rubrik oder der Verweis erbt den Stand der nächsten Rubrik darüber — Pflegewerte dann wie bei #n
const pubStand = computed(() => { if (!props.pub) return null; const start = node.value?.role === 'rubric' ? tree.byId.get(props.id) : tree.byId.get(props.pubRubric); for (let n = start; n; n = tree.byId.get(n.parent)) if (n.stand != null) return { stand: n.stand, from: n }; return null })
const standAt = ref(null)   // Datum des Journaleintrags #n
watch(pubStand, async s => { standAt.value = null; if (!s) return; try { standAt.value = (await api.get(`/api/journal/${s.stand}`)).at } catch {} }, { immediate: true })
// Pflegewerte des Verweises bei #n (Verweis unter eingefrorener Rubrik): Tabelle von damals, je Spalte
const frozen = ref(null)   // Map key attr|locale|channel → Wert
async function loadFrozen() {
  frozen.value = null
  const s = pubStand.value; if (!s || !props.pub || node.value?.role === 'rubric') return
  try {
    const per = await Promise.all(columns.value.map(c => api.get(`/api/nodes/${encodeURIComponent(props.id)}/table?self=true&at=${s.stand}&locale=${c.locale ?? ''}&channel=${c.channel ?? ''}`).then(t => t.rows.find(r => r.row.id === props.id)).catch(() => null)))
    const m = new Map()
    columns.value.forEach((c, i) => { for (const [k, v] of Object.entries(per[i]?.values ?? {})) m.set(`${k}|${c.locale ?? ''}|${c.channel ?? ''}`, v.value ?? '') })
    frozen.value = m
  } catch { frozen.value = null }
}
watch(() => [pubStand.value?.stand, columns.value.length, props.id], loadFrozen, { immediate: true })
const roValue = (def, c) => frozen.value ? (frozen.value.get(`${def.key}|${c.locale ?? ''}|${c.channel ?? ''}`) ?? '') : (ownOrAxis(def, c) ?? inherited(def, c).value ?? '')
watch(() => [node.value?.source, columns.value.length, pubStand.value?.stand], loadSource)
// Kopfzeile Kanal: je Kanal (erst ohne) ein Block über 1 + Sprachen Spalten
const headGroups = computed(() => { const out = []; for (const c of columns.value) { const g = out.find(x => x.channel === c.channel); g ? g.n++ : out.push({ channel: c.channel, n: 1 }) } return out })

// ---- Attributsicht je Knotentyp
// Sichten: die aus dem Modell und die flüchtigen der Plugins
const pluginViews = computed(() => {
  plugins.rev   // hängt am Zähler: lädt ein Plugin seine Daten nach, rechnet die Ansicht neu
  const row = tree.byId.get(props.id); if (!row || !node.value) return []
  const out = []
  for (const v of plugins.nodeViews ?? []) {
    if (v.roles && !v.roles.includes(node.value.role)) continue
    const pctx = { node: node.value, model: model.value, tree }
    let items = null, custom = null
    try { custom = v.blocks?.(row, pctx) } catch { custom = null }
    try { items = v.items?.(row, pctx) } catch { items = null }
    if (!custom?.length && !items?.length) continue
    const label = typeof v.label === 'function' ? v.label(row, pctx) : v.label
    out.push({ key: `~${v.key}:${v.view}`, level: node.value.role, label: { de: label }, items: items ?? [], custom, replaces: v.replaces, plugin: v.key })
  }
  return out
})
// zur Wahl stehen nur die mit Namen; die anderen ersetzen still eine Gruppe (siehe blocks)
const views = computed(() => [...(model.value?.views ?? []).filter(v => v.level === node.value?.role), ...pluginViews.value.filter(v => L(v.label))])
const view = computed(() => views.value.find(v => v.key === store.viewKey[node.value?.role]) ?? null)
// „komplett“ ordnet nach der Standardsicht des Knotentyps (defaultview_<rolle>), wenn es sie gibt — sonst alphabetisch.
const orderView = computed(() => view.value ?? views.value.find(v => v.key === 'defaultview_' + node.value?.role) ?? null)
function setView(k) { store.viewKey = { ...store.viewKey, [node.value.role]: k }; store.save() }
function setLayout(l) { store.layout = l; store.save() }
// Abschnitte (attributes, axes, media, relations, groups, releases) per Klick aufs Band auf-/zuklappen
const open = k => !store.collapsed.includes(k)
function toggle(k) { store.collapsed = open(k) ? [...store.collapsed, k] : store.collapsed.filter(x => x !== k); store.save() }
// Pfad: Schrift verkleinern, bis er in eine Zeile passt (13 → 10 px), statt umzubrechen
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
// Filter am Knoten
const SCOPES = [
  { key: 'all', label: t_('Alle Attribute'), title: t_('alles, was am Knoten anliegt — gesperrtes (⌀) sichtbar') },
  { key: 'can', label: t_('Editierbare Attribute'), title: t_('was auf dieser Ebene änderbar ist') },
  { key: 'only', label: t_('Nur hier editierbare Attribute'), title: t_('was nur auf dieser Ebene änderbar ist — weder darüber noch darunter') },
]
function setScope(s) { store.scope = s; store.save() }
// Änderbar auf einer Ebene: Gruppe dort aktiv (aktiv ab, Untergrenze) und der Haken des Attributs für den Knotentyp gesetzt (levels) —
// dieselbe Regel wie am Server (TreeApi: AllowedAt × GroupActiveAt)
const DEPTH = { group: 0, product: 1, variant: 2 }
const ROLES = ['group', 'product', 'variant']
const canAt = (a, gdef, role) => (!a.levels || a.levels.includes(role)) && (!gdef?.activeFrom || DEPTH[role] >= DEPTH[gdef.activeFrom])
// Attributnamen: Bezeichnung → Key → beides
function cycleNames() { store.attrNames = { label: 'key', key: 'both', both: 'label' }[store.attrNames] ?? 'label'; store.save() }
const NAMES_TITLE = { label: t_('Technische Keys zeigen'), key: t_('Bezeichnung und Key zeigen'), both: t_('Nur Bezeichnung zeigen') }

// ---- Die Gruppen, die hier gelten, in Sichtreihenfolge; darin die Attribute in Sichtreihenfolge
const blocks = computed(() => {
  if (!model.value || !node.value) return []
  const eff = node.value.groups ?? []               // [{ key, from, fromLabel, active, attributes }]
  // Eine flüchtige Sicht darf ihre Abschnitte selbst bestimmen. Attribute quer über die Gruppen.
  if (view.value?.custom?.length) return customBlocks(view.value.custom, eff)
  const byKey = new Map(eff.map(g => [g.key, g]))
  const ov = orderView.value
  const order = ov ? ov.items.map(it => it.group).filter(k => byKey.has(k)) : eff.map(g => g.key)
  // „komplett“: Gruppen, die die Standardsicht nicht nennt, unten dran. Eine gewählte Sicht zeigt nur ihre Gruppen.
  if (ov && !view.value) for (const g of eff) if (!order.includes(g.key)) order.push(g.key)
  const req = k => model.value.attributes.find(a => a.key === k)?.required
  const built = order.map(k => {
    const g = byKey.get(k)
    const it = ov?.items.find(x => x.group === k)
    const ord = (it?.order ?? []).filter(a => g.attributes.includes(a))
    const def = model.value.groups.find(x => x.key === k)
    // alle Attribute der Gruppe (Modell), nicht nur die am Knotentyp erlaubten (Server) — total zeigt auch die gesperrten, wie ⌀-Gruppen
    const all = def?.attributes ?? g.attributes
    const keys = [...ord, ...all.filter(a => !ord.includes(a))]
    const role = node.value.role
    // Bedingung (when): wirksamer Wert des Bedingungsattributs am Knoten (eigen oder geerbt) muss einer der Werte sein — sonst ⌀ „nur bei …“
    const whenOk = a => { if (!a.when) return true; const v = effectiveValue(a.when.attribute); return v != null && a.when.values.some(x => x.toLowerCase() === String(v).toLowerCase()) }
    let defs = keys.map(a => model.value.attributes.find(x => x.key === a)).filter(Boolean).map(a => ({ ...a, required: req(a.key), hereLocked: !(!a.levels || a.levels.includes(role)), whenLocked: !whenOk(a) }))   // Gruppe ⌀ steht am Gruppenkopf, hier nur die Ebene des Attributs
    if (store.scope !== 'all') defs = defs.filter(a => !a.hereLocked && !a.whenLocked && g.active)
    if (store.scope === 'only') defs = defs.filter(a => !ROLES.some(r => r !== role && canAt(a, def, r)))
    return { key: k, label: L(def?.label) || k, activeFrom: def?.activeFrom, from: g.from, fromLabel: g.fromLabel, fromRole: g.fromRole, active: g.active, defs }
  }).filter(b => b.defs.length && (store.scope === 'all' || b.active))
    // „komplett“: gesperrte Gruppen ans Ende; in einer Sicht bleibt deren Reihenfolge.
    .sort((x, y) => view.value ? 0 : (x.active === y.active ? 0 : x.active ? -1 : 1))
  // Ein Attribut kann in mehreren Gruppen Mitglied sein (n:m, 29.09.2026). Es steht einmal da: in der ersten Gruppe,
  // die hier gilt; die weiteren nennt der Tooltip. Eine Gruppe, deren Attribute alle woanders stehen, fällt weg —
  // ihre Attribute sind ja zu sehen, und welche Gruppen ein Attribut hat, steht am Attribut.
  einmal(built)
  // Ein Plugin darf eine Gruppe gliedern: die Gruppe bleibt ein Reiter, seine Teile werden Zwischenüberschriften darin
  //.
  return built.map(b => {
    const rep = pluginViews.value.find(v => v.replaces === b.key && v.custom?.length)
    return rep ? withSections(b, rep.custom) : b
  })
})

/// Jedes Attribut nur im ersten Block, der es zeigt; in den anderen fällt es weg. `auchIn` sagt, welche Gruppen es
/// ebenfalls führen — das steht im Tooltip seiner Zeile. Ändert die Liste an der Stelle, leere Blöcke fallen weg.
function einmal(built) {
  const zuerst = new Map()   // Attribut → Block, der es zeigt
  for (const b of built) {
    const bleibt = []
    for (const d of b.defs) {
      if (d.divider) { bleibt.push(d); continue }
      const da = zuerst.get(d.key)
      if (da) { da.auchIn = [...(da.auchIn ?? []), b.label]; continue }
      zuerst.set(d.key, d); bleibt.push(d)
    }
    b.defs = bleibt
  }
  for (let i = built.length - 1; i >= 0; i--) if (!built[i].defs.some(d => !d.divider)) built.splice(i, 1)
  return built
}
const auchTitel = def => def.auchIn?.length ? ' · ' + t_('auch in {0}', [def.auchIn.join(', ')]) : ''

/// Die Attribute eines Blocks in der Reihenfolge des Plugins, mit Zwischenüberschriften; was das Plugin nicht nennt,
/// steht unverändert hinten. Nur eine Überschrift? Dann keine — sie stünde allein über allem.
function withSections(b, sections) {
  const byKey = new Map(b.defs.map(d => [d.key, d]))
  const teile = sections.map(s => ({ title: s.title, defs: (s.keys ?? []).map(k => byKey.get(k)).filter(Boolean) })).filter(s => s.defs.length)
  if (!teile.length) return b
  const genannt = new Set(teile.flatMap(s => s.defs.map(d => d.key)))
  const rest = b.defs.filter(d => !genannt.has(d.key))
  const defs = []
  for (const s of teile) {
    if (teile.length > 1) defs.push({ key: `~sub:${s.title}`, divider: s.title })
    defs.push(...s.defs)
  }
  if (rest.length) { if (teile.length > 1) defs.push({ key: '~sub:rest', divider: t_('ohne Klasse') }); defs.push(...rest) }
  return { ...b, defs }
}
/// Abschnitte, die ein Plugin vorgibt: eigene Überschrift, Attribute aus beliebigen Gruppen — sonst dieselben Regeln
/// (gesperrt am Knotentyp, Bedingung when, Pflicht, Filter der Sicht „Editierbare“).
function customBlocks(list, eff) {
  const role = node.value.role
  const byGroup = new Map(eff.map(g => [g.key, g]))
  const req = k => model.value.attributes.find(a => a.key === k)?.required
  const whenOk = a => { if (!a.when) return true; const v = effectiveValue(a.when.attribute); return v != null && a.when.values.some(x => x.toLowerCase() === String(v).toLowerCase()) }
  return list.map(b => {
    let defs = (b.keys ?? []).map(k => model.value.attributes.find(x => x.key === k)).filter(Boolean)
      .map(a => ({ ...a, required: req(a.key), hereLocked: !(!a.levels || a.levels.includes(role)), whenLocked: !whenOk(a) }))
    const activeOf = a => byGroup.get(a.group)?.active !== false
    if (store.scope !== 'all') defs = defs.filter(a => !a.hereLocked && !a.whenLocked && activeOf(a))
    if (store.scope === 'only') defs = defs.filter(a => !ROLES.some(r => r !== role && canAt(a, model.value.groups.find(g => g.key === a.group), r)))
    return { key: b.key, label: b.title, custom: true, active: true, defs }
  }).filter(b => b.defs.length)
}
watch(blocks, b => { if (!b.some(x => x.key === tab.value)) tab.value = b[0]?.key ?? '' }, { immediate: true })
watch([() => route.query.group, () => blocks.value.length], focusGroup)
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
  if (def.key.toLowerCase().includes(q) || (L(def.label) ?? '').toLowerCase().includes(q) || (def.label?.en ?? '').toLowerCase().includes(q)) return true
  if (def.type === 'rows') return Object.values(node.value?.rows?.[def.key] ?? {}).length > 0 && [...own.value.entries()].some(([k, v]) => k.startsWith(def.key + '|') && String(v ?? '').toLowerCase().includes(q))
  return columns.value.some(c => enabled(def, c, block) && cellText(def, c).toLowerCase().includes(q))
}
// „nur Fehlendes“:
// nach einer gescheiterten Freigabe die Pflichtwerte, die für den Kanal fehlen (Vollständigkeit ohne Master), als Filter; Klick auf den Chip hebt ihn auf
const missingOnly = ref(null)   // { channel, keys: Set<attr>, cells: Set<'attr/locale'> }
function showMissing(channel) {
  const list = (node.value?.completeness ?? []).filter(c => c.channel === channel && c.missing?.length)
  const cells = new Set(list.flatMap(c => c.missing)); if (!cells.size) { missingOnly.value = null; return }
  missingOnly.value = { channel, cells, keys: new Set([...cells].map(m => m.split('/')[0])) }
  attrFilter.value = ''; store.scope = 'all'
}
const filteredBlocks = computed(() => missingOnly.value
  ? blocks.value.map(b => ({ ...b, defs: b.defs.filter(d => missingOnly.value.keys.has(d.key)) })).filter(b => b.defs.length)
  : attrFilter.value.trim()
  ? blocks.value.map(b => ({ ...b, defs: b.defs.filter(d => matches(d, b)) })).filter(b => b.defs.length)
  : blocks.value)
const isMissing = (def, c) => !!missingOnly.value && missingOnly.value.cells.has(c.locale ? `${def.key}/${c.locale}` : def.key)
const hitCount = computed(() => filteredBlocks.value.reduce((n, b) => n + b.defs.length, 0))
const shownBlocks = computed(() => store.layout === 'tabs' && !attrFilter.value.trim() ? filteredBlocks.value.filter(b => b.key === tab.value) : filteredBlocks.value)
// Breite der Namensspalte: gemessen am längsten sichtbaren Namen (Bezeichnung + abgegrauter Key), 180–360 px — nichts
// wird abgeschnitten; der Rest der Breite gehört den Werten
const measure = (() => { let ctx = null; return (s, font) => { ctx ??= document.createElement('canvas').getContext('2d'); ctx.font = font; return ctx.measureText(s).width } })()
const attrColWidth = computed(() => {
  let w = 0
  for (const b of shownBlocks.value) for (const def of b.defs) {
    const label = store.label(def), key = store.attrNames !== 'label' ? def.key : ''
    w = Math.max(w, (label ? measure(label, '13px system-ui, "Segoe UI", sans-serif') : 0) + (key ? measure(key, '11px ui-monospace, Consolas, monospace') + 6 : 0) + (def.unit ? measure(' ' + def.unit, '13px system-ui') : 0))
  }
  return Math.ceil(Math.max(180, Math.min(360, w + 48)))   // Stern, Innenabstand, Pflichtpunkt — Deckel 360, darüber Ellipse an der Bezeichnung, der Key bleibt ganz
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
  const v = await dialog.prompt({ title: t_('Quelle für {0} angeben', [store.label(def)]), text: t_('URL oder Text: Datenblatt, Katalogseite … (leer = Beleg weg)'), ok: t_('↗ Übernehmen'), value: cur?.source ?? '', placeholder: 'https://…' })
  if (v === null) return
  await command(() => api.post(`${nodeUrl()}/sources`, { attribute: def.key, locale: col.locale ?? null, channel: col.channel ?? null, source: v.trim(), method: 'manual', checkedAt: new Date().toISOString().slice(0, 10) }))
}
// Übersetzungsstand: Wert einer anderen Sprache ist „zu überarbeiten“, wenn der Master-Wert später geschrieben wurde (Eintragsnummer).
const master = computed(() => model.value?.masterLocale ?? locales.value[0] ?? null)
const masterChannel = computed(() => model.value?.masterChannel ?? null)
const ownAt = computed(() => { const m = new Map(); for (const v of node.value?.values ?? []) m.set(key(v.attribute, v.locale, v.channel, v.row), v.number ?? 0); return m })
/// Blitzt diese Zelle gerade? — als Klasse am Aufruf, Vue reicht sie an das <td> der Zellkomponente durch
const frischCls = (def, col, row) => ({ frisch: frisch.value.has(key(def.key, col.locale, col.channel, row)) })
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
// wirksamer Wert eines Attributs ohne Achse am Knoten: eigen, sonst vom nächsten Vorfahren (für Bedingungen: etim_class)
function effectiveValue(a) { const k = key(a, null, null); if (own.value.has(k)) return own.value.get(k); for (const { m } of ancestorMaps.value) if (m.has(k)) return m.get(k); return null }
// Achsenwert einer Variante ohne eigenen Attributwert (beim Anlegen vergeben): steht in der Zelle, Bearbeiten schreibt den Attributwert — der wird zum Achsenwert
function ownOrAxis(def, col) { return ownValue(def.key, col) ?? axisValue(def.key, col) }
// Kette je Achse: Wert → Fallback(s) → Master → Stern; erst der Kanal, dann die Sprache — wie Node.Chain im Kern
const localeFb = computed(() => Object.fromEntries((model.value?.locales ?? []).filter(l => l.fallback).map(l => [l.code, l.fallback])))
const channelFb = computed(() => Object.fromEntries((model.value?.channels ?? []).filter(c => c.fallback).map(c => [c.key, c.fallback])))
function chain(v, m, fb) { if (v == null) return [null]; const out = [v]; const seen = new Set([v]); let cur = v; for (let i = 0; i < 8 && fb[cur] && !seen.has(fb[cur]); i++) { cur = fb[cur]; seen.add(cur); out.push(cur) } if (m && !seen.has(m)) out.push(m); out.push(null); return out }
function* axesOf(a, col) { const seen = new Set(); for (const l of chain(col.locale, master.value, localeFb.value)) for (const c of chain(col.channel, masterChannel.value, channelFb.value)) { const k = key(a, l, c); if (!seen.has(k)) { seen.add(k); yield { k, l, c } } } }
function fallback(m, a, col) {
  for (const { k, l, c } of axesOf(a, col)) { if (l === col.locale && c === col.channel) continue; if (m.has(k)) return m.get(k) }
  return null
}
const ancestorMaps = computed(() => (node.value?.ancestors ?? []).map(an => ({ an, m: valueMap(an.values) })))
// Wie Tree.Resolve: hier (genaue Achse, ohne Kanal, ohne Sprache), dann den Pfad hinauf — nur wenn das Attribut vererbbar ist.
// Sprachabhängig: * ist der sprachneutrale Grundtext (ERP-Kurzbezeichnung) und änderbar;
// leer zeigt * den Master (◌). Kette je Sprache: eigen → Master → * → dasselbe bei den Vorfahren (wenn vererbbar).
// Rückgabe: { value, from (Vorfahr oder null), master (true = kommt aus der Mastersprache) }
function resolveIn(m, def, col) {
  for (const { k, l, c } of axesOf(def.key, col)) if (m.has(k)) return { value: m.get(k), master: def.perLocale && col.locale != null && l === master.value && l !== col.locale }
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
  if (props.pub && block.fromRole !== 'rubric') return false   // Pflegewert: im Publikationsbaum nur lesen, geändert wird im Pflegebaum
  return block.active && !def.hereLocked && !def.whenLocked && (!col.locale || def.perLocale) && (!col.channel || def.perChannel)
    && (!col.channel || !def.channels || def.channels.includes(col.channel))
}
function listOptions(def) { return (model.value.lists.find(l => l.key === def.list)?.values ?? []).map(v => v.value) }
function listLabel(def) { const vals = model.value.lists.find(l => l.key === def.list)?.values ?? []; const first = store.viewLocales?.[0]; return v => { const l = vals.find(x => x.value === v)?.label; return l?.[first] || l?.[master.value] || l?.de || l?.en || Object.values(l ?? {}).find(Boolean) || v } }
// Gruppe eines Listenwerts (Spalte „group“ der Werteliste, z. B. ETIM-Klassengruppe) — zum Blättern in grossen Listen
function listGroup(def) { const list = model.value.lists.find(l => l.key === def.list); if (!(list?.columns ?? []).includes('group')) return null; const vals = list.values ?? []; return v => vals.find(x => x.value === v)?.extra?.group ?? null }
function released(channel, locale) { return node.value?.releases.some(r => r.channel === channel && r.locale === locale) ?? false }
// Freigabe über den Fallback-Kanal (Sortiment geerbt): nicht eigen, gilt aber — ◌ mit Herkunft
function releasedVia(channel, locale) { return node.value?.releasedVia?.find(r => r.channel === channel && r.locale === locale)?.via ?? null }
function axisLabel(a) { return L(model.value?.attributes.find(x => x.key === a)?.label) || a }
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
const nextStar = key => (node.value?.stars ?? []).find(x => x.attribute === key && x.from !== props.id) ?? null   // das ★, das nach dem Wegnehmen gilt
// Tooltip „Objekt Verb (Erläuterung)“; der Vorfahr wird beim Namen genannt, nie „von oben“
function starTitle(def) {
  const s = star(def.key), name = store.name(def)
  if (!s) return t_('Ab hier mit „{0}“ benennen', [name])
  if (s.from === props.id) {
    const next = nextStar(def.key)
    return t_('Benennung wegnehmen ({0})', [next ? t_('danach gilt wieder das ★ von {0}', [next.fromLabel]) : t_('danach keine Benennung')])
  }
  return t_('Ab hier mit „{0}“ benennen ({1})', [name, s.applies ? t_('bisher geerbt von {0}', [s.fromLabel]) : t_('wirkt erst, wo ein Wert steht — bis dahin zählt das ★ von {0}', [s.fromLabel])])
}
const freeGroups = computed(() => (model.value?.groups ?? []).filter(g => !(node.value?.groups ?? []).some(x => x.key === g.key)))
// Gruppen heissen überall gleich: Label wie im Reiter, Schlüssel nur im Tooltip.
const groupLabel = k => L(model.value?.groups.find(x => x.key === k)?.label) || k
const groupLocked = k => { const g = model.value?.groups.find(x => x.key === k); return g?.activeFrom && node.value && !(node.value.groups ?? []).find(x => x.key === k)?.active }
// Angehängte Gruppen zum Lesen sortiert: alphabetisch nach Label, gesperrte ⌀ ans Ende — die Reihenfolge im Journal ist die des Anhängens und bedeutet nichts
// Gruppe hängt schon weiter oben: dann steht sie hier nicht als eigene Zeile — sie gilt von dort, das Band nennt die
// Geerbten oben. Der Server heftet so etwas seit dem 28.09.2026 nicht mehr an und räumt es beim nächsten Anhängen weg
const fromAbove = g => path.value.find(a => (a.groups ?? '').split(',').includes(g)) ?? null
const attachedSorted = computed(() => [...(node.value?.attachedGroups ?? [])].filter(g => !fromAbove(g)).sort((a, b) => (groupLocked(a) ? 1 : 0) - (groupLocked(b) ? 1 : 0) || groupLabel(a).localeCompare(groupLabel(b), 'de', { sensitivity: 'base' })))

// ---- Laden
/// Zellen, die gerade von aussen geändert wurden — sie blitzen kurz auf (26.09.2026). Der Schlüssel ist derselbe wie
/// in own/ownAt; nach FRISCH_MS ist er wieder weg. Eigene Änderungen blitzen nicht: dafür steht fremd auf false.
const frisch = ref(new Set())
const FRISCH_MS = 2000
function frischMerken(vorher) {
  const neu = []
  for (const [k, nummer] of ownAt.value) if ((vorher.get(k) ?? 0) < nummer) neu.push(k)
  if (!neu.length) return
  frisch.value = new Set([...frisch.value, ...neu])
  setTimeout(() => { const s = new Set(frisch.value); for (const k of neu) s.delete(k); frisch.value = s }, FRISCH_MS)
}

async function load(fremd = false) {
  const vorher = fremd ? new Map(ownAt.value) : null
  try {
    node.value = await api.get(`/api/nodes/${encodeURIComponent(props.id)}`)
    rels.value = await api.get(`/api/nodes/${encodeURIComponent(props.id)}/relations`)
    api.get(`/api/nodes/${encodeURIComponent(props.id)}/workflow`).then(w => { workflows.value = w }).catch(() => { workflows.value = [] })
    entries.value = (await api.get(`/api/streams/${encodeURIComponent(props.id)}`)).reverse()
    ladeAusJournal()
    if (vorher) frischMerken(vorher)
  } catch (e) {
    if (e.message.startsWith('404')) router.push(router.currentRoute.value.path.startsWith('/pub') ? '/pub' : '/tree')   // Knoten weg: in derselben Ansicht bleiben
    else store.toast(e.message)
  }
}
onMounted(load)
// Präsenz: solange dieser Knoten offen ist, geht er mit dem Puls hinaus — und der Server sagt, wer sonst noch hier ist
watch(() => props.id, id => { store.ort = id; store.presence = []; store.poll(true) }, { immediate: true })
onUnmounted(() => { if (store.ort === props.id) { store.ort = null; store.presence = [] } })
function onKey(e) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
  // im grossen Editor (contenteditable) oder in einem Overlay gilt Esc dort — nicht den Knoten verlassen
  if (e.target.isContentEditable || e.target.closest?.('.editor, .overlay, .dialog')) return
  if (document.querySelector('.overlay, .dialog')) return   // offener Editor, auch wenn der Fokus woanders liegt
  if (e.key === 'Escape') router.push(router.currentRoute.value.path.startsWith('/pub') ? '/pub' : '/tree')
  else if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo() }
  else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
watch(() => store.head, h => { if (h > (entries.value[0]?.number ?? 0)) load(true) })

// ---- Befehle
async function command(fn, rethrow = false) {
  if (!store.actor) { store.toast(t_('👤 Name fehlt → Einstellungen')); return }
  busy.value = true
  try { const entry = await fn(); entries.value.unshift(entry); await load(); tree.load() }
  catch (e) { if (rethrow) throw e; store.toast(e.message) }
  finally { busy.value = false }
}
const nodeUrl = () => `/api/nodes/${encodeURIComponent(props.id)}`
// Rückgängig/Wiederholen je Knoten: das Journal bleibt append-only — der alte Wert wird als neuer Eintrag geschrieben.
// Schritte JE KNOTEN: ↶ hier macht rückgängig, was an diesem Knoten geändert wurde — auch wenn man zwischendurch
// woanders war; nie die drei Schritte eines anderen Knotens. Der Stapel liegt im Store, weil NodeView je Knoten neu gebaut
// wird (:key=id). Ein Rückzug landet im Stapel des Vaters — dort steht man danach, dort holt ↶ ihn zurück.
const stacksOf = id => (store.undo[id] ??= { history: [], redo: [] })
// Was der Server am Knoten zurücknehmen würde — der Weg für alles, was vor dieser Sitzung geschah
const ausJournal = ref(null)
async function ladeAusJournal() {
  try { ausJournal.value = await api.get(`/api/nodes/${encodeURIComponent(props.id)}/undo`) } catch { ausJournal.value = null }
}
const history = computed(() => stacksOf(props.id).history)
const redoStack = computed(() => stacksOf(props.id).redo)
// Einen Wert setzen. Leer über einem geerbten Wert heisst „hier gilt nichts“ (27.09.2026) und wird als eigener leerer
// Wert geschrieben — sonst käme der geerbte zurück, und das Löschen sah aus, als würde es nicht gespeichert. Zurück zur
// Vererbung führt das ↓ an der Attributzeile und „Eigenen Wert löschen“ im Kontextmenü (beide rufen unsetValue).
const setValue = (def, col, value, row = null) => {
  const k = key(def.key, col.locale, col.channel, row)
  const before = own.value.get(k) ?? ''
  if ((value === '' || value == null) && gaelteOhneEigenen(def, col)) return clearValue(def, col, row, before)
  history.value.push({ kind: 'value', node: props.id, def, col, row, before, after: value }); redoStack.value.length = 0
  return writeValue(def, col, value, row)
}
/// Stünde hier etwas, wenn der eigene Wert auf genau dieser Achse wegfiele? Der Master- oder Sternwert am Knoten
/// selbst zählt dazu, und bei vererbbaren Attributen die Vorfahren. Nur dann heisst Leeren „hier gilt nichts“.
function gaelteOhneEigenen(def, col) {
  if (fallback(own.value, def.key, col) != null) return true
  if (!def.inheritable) return false
  for (const { m } of ancestorMaps.value) if (resolveIn(m, def, col)) return true
  return false
}
/// Hier gilt nichts: ein eigener leerer Wert, der die Vererbung bricht
const clearValue = (def, col, row = null, before = '') => {
  history.value.push({ kind: 'clear', node: props.id, def, col, row, before, after: '' }); redoStack.value.length = 0
  return writeClear(def, col, row)
}
/// Eigenen Wert weg — der geerbte gilt wieder
const unsetValue = (def, col, row = null) => {
  const before = own.value.get(key(def.key, col.locale, col.channel, row)) ?? ''
  history.value.push({ kind: 'value', node: props.id, def, col, row, before, after: '' }); redoStack.value.length = 0
  return writeValue(def, col, '', row)
}
// Mouseover auf ↶/↷: was würde der Schritt tun — Attribut, Spalte, alter → neuer Wert; und wie viele Schritte noch
function stepTitle(h, verb, n, key, redo = false) {
  if (!h) return redo ? t_('nichts zu wiederholen') : t_('nichts rückgängig zu machen')
  if (h.kind === 'retire') return redo ? t_('{0}{1} wieder zurückziehen ({2})', [h.label, h.count > 1 ? ' ' + t_('mit {0} darunter', [h.count - 1]) : '', key]) : `${h.label}${h.count > 1 ? ` mit ${h.count - 1} darunter` : ''} wiederherstellen  (${key})`
  const show = v => v == null || v === '' ? 'leer' : `„${String(v).replace(/<[^>]+>/g, ' ').slice(0, 60)}“`
  const from = redo ? h.before : h.after, to = redo ? h.after : h.before
  return `${store.name(h.def)}${h.col?.label ? ' · ' + h.col.label : ''}${h.row ? ' · Zeile ' + h.row : ''}: ${show(from)} → ${show(to)}  (${key})`
}
// Rückzug als Schritt: Rückgängig holt über den Stapel zurück,
// Wiederholen zieht wieder zurück; danach steht die Ansicht wieder auf dem Knoten
async function undoRetire(h) {
  try {
    const x = h.batch ? await api.post(`/api/batches/${encodeURIComponent(h.batch)}/undo`) : await api.post(`/api/nodes/${encodeURIComponent(h.id)}/restore`)
    store.toast(t_('{0} Knoten wiederhergestellt', [x.undone ?? 1]), 'ok'); await store.poll(true); await tree.load(); router.push(`/tree/${h.id}`)
  } catch (e) { store.toast(e.message); stacksOf(h.parent ?? '').history.push(h); stacksOf(h.parent ?? '').redo.pop() }
}
async function redoRetire(h) {
  try {
    const r = await api.del(`/api/nodes/${encodeURIComponent(h.id)}${h.count > 1 ? '?recursive=true' : ''}`)
    h.batch = r?.batch ?? null; store.toast(t_('{0} Knoten zurückgezogen', [r?.retired ?? 1]), 'ok'); await tree.load(); router.push(h.parent ? `/tree/${h.parent}` : '/tree')
  } catch (e) { store.toast(e.message); stacksOf(h.parent ?? '').redo.push(h); stacksOf(h.parent ?? '').history.pop() }
}
async function undoAusJournal() {
  try {
    const x = await api.post(`/api/nodes/${encodeURIComponent(props.id)}/undo`, {})
    store.toast(x.what ?? t_('zurückgenommen'), 'ok'); await load(); await ladeAusJournal(); await store.poll(true)
  } catch (e) { store.toast(e.message) }
}
function undo() {
  const h = history.value.pop()
  if (!h) { if (ausJournal.value?.possible) undoAusJournal(); return }
  redoStack.value.push(h); h.kind === 'retire' ? undoRetire(h) : writeValue(h.def, h.col, h.before, h.row, h.node)
}
function redo() {
  const h = redoStack.value.pop(); if (!h) return; history.value.push(h)
  if (h.kind === 'retire') return redoRetire(h)
  if (h.kind === 'clear') return writeClear(h.def, h.col, h.row, h.node)
  writeValue(h.def, h.col, h.after, h.row, h.node)
}
const writeValue = (def, col, value, row = null, node = props.id) => command(() =>
  api.post(`/api/nodes/${encodeURIComponent(node)}/attributes`, def.multiple
    ? { attribute: def.key, locale: col.locale, channel: col.channel, values: value.split(',').map(s => s.trim()).filter(Boolean), row }
    : { attribute: def.key, locale: col.locale, channel: col.channel, value, row }))
const writeClear = (def, col, row = null, node = props.id) => command(() =>
  api.post(`/api/nodes/${encodeURIComponent(node)}/attributes/clear`, { attribute: def.key, locale: col.locale, channel: col.channel, row }))
const addRow = def => command(() => api.post(`${nodeUrl()}/rows`, { attribute: def.key, row: '' }))
const removeRow = (def, row) => command(() => api.del(`${nodeUrl()}/rows/${def.key}/${row}`))
const orderRows = (def, rows) => command(() => api.post(`${nodeUrl()}/rows/${def.key}`, { attribute: def.key, rows }, 'PUT'))
// ★ am eigenen Sternchen nimmt es weg; sonst setzt es dieses Attribut ab hier.
const setStar = def => command(() => api.post(`${nodeUrl()}/label-attribute`, { attribute: starOwn(def.key) ? null : def.key }, 'PUT'))
const setStatus = s => command(() => api.post(`${nodeUrl()}/status`, { status: s }))
/// Aus dem Wähler oben: bei Subitems erst fragen, dann hier und ggf. darunter setzen (status.js)
const pickStatus = async s => { if (!s || !node.value) return; try { await setStatusScoped(node.value, s); await load() } catch (e) { store.toast(e.message) } }
/// Status ab einem Tag — zum Jahreswechsel auslaufen, einen Stand nachtragen (28.09.2026)
const pickStatusAb = async () => { if (!node.value) return; try { if (await setStatusAb(node.value)) await load() } catch (e) { store.toast(e.message) } }
const attach = groups => command(() => api.post(`${nodeUrl()}/groups`, { groups }, 'PUT'))
// ---- Relationen (18): je Typ ausgehend (→) und eingehend (←, mit umgekehrter Bezeichnung); Werte an der Relation aus der Gruppe des Typs
const relTypes = computed(() => model.value?.relationTypes ?? [])
const relType = key => relTypes.value.find(t => t.key === key)
const relGroupAttrs = key => { const g = relType(key)?.group; return g ? (model.value?.attributes ?? []).filter(a => inGruppe(a, g) && a.type !== 'rows' && a.type !== 'html') : [] }
const isMediaType = key => (relType(key)?.to ?? []).includes('media')
const relBlocks = computed(() => {
  const out = new Map()
  for (const r of rels.value.out ?? []) { if (isMediaType(r.type)) continue; if (!out.has(r.type)) out.set(r.type, { type: r.type, out: [], in: [] }); out.get(r.type).out.push(r) }
  for (const r of rels.value.in ?? []) { if (!out.has(r.type)) out.set(r.type, { type: r.type, out: [], in: [] }); out.get(r.type).in.push(r) }
  return [...out.values()].sort((a, b) => a.type.localeCompare(b.type))
})
const relCount = computed(() => (rels.value.out?.length ?? 0) + (rels.value.in?.length ?? 0))
// zurück in den Publikationsbaum, aus dem wir gekommen sind: der Weg steht im Store
function backToPub() { const b = store.pubBack; store.pubBack = null; if (b) router.push(b.path) }
/// Die Sprachen der Sicht — die erste trägt Bezeichnungen und einspaltige Zellen (Zeilen, Relationen)
const viewLocales = computed(() => store.viewLocales ?? [])
const relValue = (r, def) => { const loc = def.perLocale ? (viewLocales.value[0] ?? locales.value[0]) : null; return r.values.find(v => v.attribute === def.key && (v.locale ?? null) === loc && !v.channel)?.value ?? null }
const setRelValue = (r, def, v) => command(() => api.post(`/api/relations/${r.id}/attributes`, { attribute: def.key, locale: def.perLocale ? (viewLocales.value[0] ?? locales.value[0]) : null, value: v }))
const retireRel = r => command(() => api.del(`/api/relations/${r.id}`))
// „Bilder der Subitems durch Vererbung ersetzen“: die eigenen Medien dieses Knotens werden vererbt (inherit=true);
// an allen Nachfahren werden Zuordnungen zu DEMSELBEN Medium (gleicher Typ) gelöst — aber nur, wenn der Nachfahr danach kein
// eigenes Medium dieses Typs mehr hätte (sonst bräche sein eigenes die Vererbung, und das gleiche Bild wäre weg). Ein Stapel.
const inheriting = ref('')
async function inheritToSubitems() {
  const own = mediaRels.value; if (!own.length) return
  inheriting.value = t_('lese Subitems …')
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
    // Der Dialog sagt, was ist — auch wenn nichts zu tun bleibt
    const list = [
      ...(alreadyOn ? [t_('{0} {1} hier schon auf „vererben“', [alreadyOn, alreadyOn === 1 ? t_('Medium ist') : t_('Medien sind')])] : []),
      ...(already.length ? [t_('{0} Subitems erben bereits', [already.length])] : []),
      ...retire.slice(0, 6).map(x => t_('lösen: {0} · {1}', [x.node.label, x.rel.other.label])), ...(retire.length > 6 ? [t_('… und {0} weitere', [retire.length - 6])] : [])]
    const nothing = !toInherit.length && !retire.length
    const ok = await dialog.confirm({
      title: t_('Medien an {0} Subitems vererben?', [below.length]),
      // zwei Dinge, getrennt gesagt. Rot nur, wo etwas gelöst wird.
      warn: nothing ? t_('nichts zu tun') : retire.length ? t_('{0} feste {1} an Subitems werden gelöst (sie erben dann)', [retire.length, retire.length === 1 ? t_('Zuordnung') : t_('Zuordnungen')]) : '',
      list, text: nothing ? '' : t_('{0} {1} von hier {2} auf „vererben“ gesetzt — {3} Subitems zeigen {4} danach als geerbt (gestrichelt).{5}', [toInherit.length, toInherit.length === 1 ? t_('Medium') : t_('Medien'), toInherit.length === 1 ? 'wird' : 'werden', below.length, toInherit.length === 1 ? 'es' : 'sie', retire.length ? '' : ' ' + t_('Keine feste Zuordnung an Subitems ist betroffen.')]), ok: nothing ? 'OK' : t_('↓ Vererben') })
    if (!ok || nothing) return
    const commands = [...toInherit.map(r => ({ op: 'relation.attribute.set', args: { relation: r.id, attribute: 'inherit', value: 'true' } })), ...retire.map(x => ({ op: 'relation.retire', args: { relation: x.rel.id } }))]
    const res = await api.batchChunked(commands, { label: t_('Vererbung'), continueOnError: true })
    store.toast(t_('✓ {0} Einträge{1}', [res.results.length, res.errors.length ? ' ' + t_('· {0} Fehler', [res.errors.length]) : '']), res.errors.length ? 'error' : 'ok')
    await store.poll(true); await load()
  } catch (e) { store.toast(e.message) } finally { inheriting.value = '' }
}
const newRel = ref({ type: '', q: '', to: null })
const relMatches = computed(() => {
  const q = newRel.value.q.trim().toLowerCase(); if (q.length < 1) return []
  const t = relType(newRel.value.type)
  return tree.rows.filter(r => r.id !== props.id && (!t?.to || t.to.includes(r.role)) && (r.label.toLowerCase().includes(q) || tree.keyHit(r, q) || r.id.includes(q))).slice(0, 12)
})
const addRel = () => { const n = newRel.value; if (!n.type || !n.to) return; command(() => api.post('/api/relations', { type: n.type, from: props.id, to: n.to })); newRel.value = { type: n.type, q: '', to: null } }
const relTypesFromHere = computed(() => relTypes.value.filter(t => !isMediaType(t.key) && (!t.from || t.from.includes(node.value?.role))))

// ---- Medien (20): Relationen zu Medien (image, document …) als Kacheln; hochladen per Ablegen oder Knopf, oder aus der Bibliothek wählen
// geerbte Medien (Server: inherited) — Kacheln ohne Bearbeitung, mit Herkunft; ein eigenes Medium desselben Typs bricht die Vererbung
const inheritedMedia = computed(() => (rels.value.inherited ?? []).map(x => ({ ...x.relation, from: x.from })))
// Stopps: ein geerbtes Medium wird hier nicht „entfernt“, sondern gestoppt — eine Zuordnung zum selben Medium mit stop=true
const stopped = computed(() => (rels.value.out ?? []).filter(r => isMediaType(r.type) && relValueRaw(r, 'stop') === 'true'))
async function stopInherited(r) { await command(async () => { const e = await api.post('/api/relations', { type: r.type, from: props.id, to: r.other.id }); await api.post(`/api/relations/${e.stream}/attributes`, { attribute: 'stop', value: 'true' }); return e }) }
const mediaRels = computed(() => (rels.value.out ?? []).filter(r => isMediaType(r.type) && relValueRaw(r, 'stop') !== 'true').sort((a, b) => (Number(relValueRaw(a, 'position')) || 9e9) - (Number(relValueRaw(b, 'position')) || 9e9) || a.lastNumber - b.lastNumber))
const relValueRaw = (r, key) => r.values.find(v => v.attribute === key && !v.locale && !v.channel)?.value ?? null
const mediaTypes = computed(() => mediaTypesFor(model.value, node.value?.role))
const mediaDrag = ref(false)
const mediaFile = ref(null)
const mediaPick = ref({ open: false })   // ▨ aus der Bibliothek … (MediaPicker)
// ▦ Werte aus dem Dokument (34 L): { media: [ids], names } öffnet den Dialog — nach einem Strg-Drop hier oder im Baum,
// oder per Rechtsklick auf ein Asset im Band (28.09.2026)
const docTables = ref(null)
watch(() => store.pendingDocTables, p => { if (p && p.node === props.id) { docTables.value = { media: p.media, names: p.names ?? {}, dateien: p.dateien ?? [], typen: p.typen ?? [] }; store.pendingDocTables = null } }, { immediate: true })

// ---- Auswahl im Band: Strg+Klick wählt, Rechtsklick öffnet das Menü für die Auswahl (oder die eine Kachel).
// Ein Datenblatt liegt meist längst am Knoten — es noch einmal zu ziehen, nur um die Auswertung zu starten, legte ein
// zweites Asset an. Mehrere zusammen sind ein Fall: Datenblatt und Massblatt desselben Produkts ergeben eine Liste
/// Der Link zur Datei, mit dem Namen als Parameter: die Datei ist ein Jahr lang unveränderlich gecacht — mit den Köpfen
/// von damals. Wer sie vor dem 28.09.2026 geöffnet hat, bekäme sie sonst weiter als „file“ (ohne Content-Disposition)
const dateiLink = m => `/api/media/${encodeURIComponent(m.id)}/file?name=${encodeURIComponent(m.label ?? m.name ?? '')}`
const pickedMedia = ref(new Set())
watch(() => props.id, () => { pickedMedia.value = new Set() })   // ein anderer Knoten, eine leere Auswahl
/// Ein Dokument, das der Leser (docs) versteht: nach Name oder Art — Bilder haben keinen Text
const istDokument = m => IST_DOKUMENT.test(m?.label ?? '') || m?.mime === 'application/pdf' || /^text\//.test(m?.mime ?? '')
// Die Vorschau: welche Medien darin blätterbar sind und welches zuerst steht
const vorschau = ref(null)   // { media: [...], start } oder null
const vorschauMedien = computed(() => [...mediaRels.value.map(r => r.other), ...inheritedMedia.value.map(r => r.other)])
function mediaClick(e, r) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()   // der Klick traf vielleicht das Bild — mit Strg wird gewählt, nicht geöffnet
    const s = new Set(pickedMedia.value); s.has(r.id) ? s.delete(r.id) : s.add(r.id); pickedMedia.value = s
    return
  }
  // ein Klick auf Bild oder Name zeigt das Medium gross; die Zellen daneben bleiben bedienbar
  if (e.target.closest('input, select, button, a, .cell-box, td')) return
  e.preventDefault()
  vorschau.value = { media: vorschauMedien.value, start: r.other.id }
}
function mediaMenu(e, r) {
  const sel = pickedMedia.value.has(r.id) ? mediaRels.value.filter(x => pickedMedia.value.has(x.id)) : [r]
  const dokumente = sel.filter(x => istDokument(x.other))
  const names = Object.fromEntries(dokumente.map(x => [x.other.id, x.other.label]))
  menu.open(e, [
    { label: sel.length > 1 ? t_('{0} Assets', [sel.length]) : r.other.label, disabled: true },
    { sep: true },
    { label: dokumente.length > 1 ? t_('{0} Dokumente auswerten …', [dokumente.length]) : t_('Dokument auswerten …'), icon: '▦', key: 'a', disabled: !dokumente.length,
      hint: dokumente.length ? t_('Tabellen und Text → Attribute') : t_('kein Dokument'), action: () => { docTables.value = { media: dokumente.map(x => x.other.id), names } } },
    { label: pickedMedia.value.has(r.id) ? t_('Abwählen') : t_('Auswählen'), icon: '☑', key: 'm', hint: 'Strg+Klick', action: () => { const s = new Set(pickedMedia.value); s.has(r.id) ? s.delete(r.id) : s.add(r.id); pickedMedia.value = s } },
    pickedMedia.value.size ? { label: t_('Auswahl aufheben ({0})', [pickedMedia.value.size]), icon: '☐', key: 'Escape', hint: 'Esc', action: () => { pickedMedia.value = new Set() } } : null,
    { sep: true },
    { label: sel.length > 1 ? t_('{0} Zuordnungen lösen', [sel.length]) : t_('Zuordnung lösen'), icon: '×', key: 'Delete', danger: true, hint: t_('das Medium bleibt in der Bibliothek'),
      action: async () => { for (const x of sel) await retireRel(x); pickedMedia.value = new Set() } },
  ])
}

// ---- Reihenfolge der Assets: ziehen statt Zahlen tippen.
// Die Reihenfolge steht als Wert „position“ an der Zuordnung (relation_media). Beim Ablegen bekommt jede
// Kachel ihre neue Nummer, 1 … n — geschrieben wird nur, was sich ändert.
const mediaDragId = ref(null)
const mediaDropId = ref(null)
function mediaDragStart(e, r) { mediaDragId.value = r.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', r.id) }
function mediaDragOver(e, r) {
  if (!mediaDragId.value || r.id === mediaDragId.value) return
  e.preventDefault(); e.dataTransfer.dropEffect = 'move'; mediaDropId.value = r.id
}
function mediaDragEnd() { mediaDragId.value = null; mediaDropId.value = null }
async function mediaDrop(r) {
  const von = mediaDragId.value
  mediaDragEnd()
  if (!von || von === r.id) return
  const liste = [...mediaRels.value]
  const i = liste.findIndex(x => x.id === von), j = liste.findIndex(x => x.id === r.id)
  if (i < 0 || j < 0) return
  liste.splice(j, 0, ...liste.splice(i, 1))
  const def = relGroupAttrs(liste[0].type).find(d => d.key === 'position')
  if (!def) { store.toast(t_('Das Modell kennt keine Reihenfolge an der Medienzuordnung')); return }
  for (const [n, rel] of liste.entries())
    if (String(relValueRaw(rel, 'position') ?? '') !== String(n + 1)) await setRelValue(rel, def, String(n + 1))
  await load()
}
/// auswerten: mit Strg abgelegt — die Tabellen der Dokumente werden danach zur Übernahme angeboten
async function uploadMedia(files, auswerten = false) {
  if (!store.actor) { store.toast(t_('👤 Name fehlt → Einstellungen')); return }
  busy.value = true
  try {
    const erg = await attachFiles(files, props.id, mediaTypes.value)
    for (const f of erg.fehler) store.toast(f)
    if (erg.zugeordnet) store.toast(medienMeldung(erg), 'ok')
    const dokumente = auswerten ? (erg.medien ?? []).filter(m => IST_DOKUMENT.test(m.name)) : []
    if (dokumente.length) docTables.value = { media: dokumente.map(m => m.id), names: Object.fromEntries(dokumente.map(m => [m.id, m.name])) }
    await load(); store.poll(true)
  } catch (e) { store.toast(e.message) }
  finally { busy.value = false; mediaDrag.value = false }
}
// Aus der Bibliothek zuordnen — eine Relation je Medium; „gibt es schon“ wird übergangen
async function linkMedia(picked) {
  mediaPick.value.open = false
  if (!store.actor) { store.toast(t_('👤 Name fehlt → Einstellungen')); return }
  busy.value = true; let n = 0
  try {
    for (const { medium, type } of picked) {
      try { await api.post('/api/relations', { type, from: props.id, to: medium.id }); n++ } catch (e) { if (!e.message.includes('schon')) store.toast(`${medium.name}: ${e.message}`) }
    }
    await load(); store.poll(true); tree.load()
    if (n) store.toast(`${n} ${n === 1 ? 'Medium' : 'Medien'} zugeordnet`, 'ok')
  } finally { busy.value = false }
}
const kb = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} kB` : `${(b / 1048576).toFixed(1)} MB`

// Workflows (27): je geltendem Workflow der Zustand und die Übergänge, die meine Rolle gehen darf; Notiz-Pflicht → Dialog
const workflows = ref([])
const wfColor = c => ({ pos: 'var(--pos)', neg: 'var(--neg)', warn: 'var(--warn)', accent: 'var(--accent)', muted: 'var(--muted)' })[c] ?? (c && /^#/.test(c) ? c : 'var(--muted)')
function wfBlocked(t) {
  const rel = (t.effects ?? []).find(x => x.startsWith('release:'))
  if (rel && node.value?.role === 'variant') { const ch = rel.slice(8) === '*' ? (model.value?.channels?.[0]?.key ?? 'web') : rel.slice(8); showMissing(ch); if (!open('attributes')) toggle('attributes') }
  store.toast(t.blocked)
}
async function wfStep(w, t, locale = null) {
  let note = null
  if (t.noteRequired || t.effects?.length) {
    note = await dialog.prompt({ title: `${L(t.label) || t.key} → ${t.toLabel?.de || t.to}`, text: (t.noteRequired ? 'Notiz (Pflicht)' : 'Notiz (optional)') + (t.effects?.length ? ' ' + t_('· Wirkung: {0}', [t.effects.join(', ')]) : ''), placeholder: t_('Notiz'), ok: `⚑ ${L(t.label) || t.key}` })
    if (note === null) return
    if (t.noteRequired && !note.trim()) { store.toast(t_('Notiz ist Pflicht bei diesem Schritt')); return }
  }
  try { await command(() => api.post(`${nodeUrl()}/workflow/${w.workflow}/${t.key}${locale ? '?locale=' + encodeURIComponent(locale) : ''}`, { note: note || null }), true) }
  catch (e) {
    store.toast(e.message)
    // Freigabe gescheitert: zeigen, woran es hängt (nur an der Variante selbst — am Produkt nennt die Meldung die Variante)
    const rel = (t.effects ?? []).find(x => x.startsWith('release:')); if (rel && node.value?.role === 'variant') { await load(); showMissing(rel.slice(8)); open('attributes') || toggle('attributes') }
  }
}
// Wirkung eines Schritts nachholen (release:web → Freigabe an allen vollständigen Varianten; revoke; status)
const effLabel = eff => { const [k, a] = eff.split(':'); return k === 'release' ? t_('für {0} freigeben', [a]) : k === 'revoke' ? t_('Freigabe {0} zurücknehmen', [a]) : t_('Status {0} setzen', [a]) }
async function wfEffect(eff) {
  const [k, a] = eff.split(':')
  await command(() => k === 'release' ? api.post(`${nodeUrl()}/releases`, { channel: a, locale: null }) : k === 'revoke' ? api.del(`${nodeUrl()}/releases?channel=${encodeURIComponent(a)}`) : setStatus(a))
  api.get(`${nodeUrl()}/workflow`).then(w => { workflows.value = w }).catch(() => {})
}
// Verlauf eines Workflows am Knoten: jeder Schritt mit Zeit, Wer, Schritt, Zustand, Notiz — aus dem Journalstrom des Knotens
async function wfHistory(w) {
  const label = k => L(w.states?.find(s => s.key === k)?.label) || k
  let src = entries.value; let title = t_('Verlauf „{0}“ · {1}', [L(w.label) || w.workflow, shownLabel.value])
  if (w.inheritedFrom) { try { src = (await api.get(`/api/streams/${encodeURIComponent(w.inheritedFrom.id)}`)).reverse(); title = t_('Verlauf „{0}“ · geerbt von „{1}“', [L(w.label) || w.workflow, w.inheritedFrom.label]) } catch { src = [] } }
  // nach Datum gruppiert: Datumszeile, darunter die Schritte mit Uhrzeit
  const list = src.filter(e => (e.type === 'WorkflowStateSet' || e.type === 'WorkflowAssigned') && e.payload?.workflow === w.workflow)
  const rows = []; let day = null
  for (const e of list) {
    const d = new Date(e.at); const key = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
    if (key !== day) { rows.push([key, '']); day = key }
    rows.push([d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }), e.type === 'WorkflowAssigned' ? t_('{0} · zuständig: {1}', [e.actor, e.payload.user || t_('— (Rolle)')]) : `${e.actor} · ${e.payload.transition ? e.payload.transition + ' → ' : ''}${label(e.payload.state)}${e.payload.note ? ' · ✎ ' + e.payload.note : ''}`])
  }
  dialog.help({ title, rows: rows.length ? rows : [['—', t_('noch kein Schritt')]] })
}
async function wfClear(w, locale = null) {
  if (!await dialog.confirm({ title: t_('Vererbung wiederherstellen · {0}{1}?', [L(w.label) || w.workflow, locale ? ' · ' + locale : '']), text: t_('Eigener Zustand fällt weg; es gilt wieder der geerbte.'), ok: t_('↑ Erben') })) return
  await command(() => api.del(`${nodeUrl()}/workflow/${w.workflow}${locale ? '?locale=' + encodeURIComponent(locale) : ''}`))
  api.get(`${nodeUrl()}/workflow`).then(x => { workflows.value = x }).catch(() => {})
}
async function wfAssign(w) {
  // Vorschlagsliste: Personen mit einer Rolle des nächsten Schritts zuerst, dann die anderen
  let people = []; try { people = await api.get('/api/auth/people') } catch {}
  const roles = new Set(w.all.flatMap(t => t.roles ?? []))
  const fits = p => roles.size === 0 || roles.has(p.role) || p.role === 'admin'
  const choices = [{ value: '', label: roles.size ? t_('— Rolle {0} (jede Person damit)', [[...roles].join('/')]) : t_('— jede Rolle mit Schreibrecht') },
    ...people.filter(fits).map(p => ({ value: p.key, label: `${p.name || p.key} · ${p.role}` })),
    ...people.filter(p => !fits(p)).map(p => ({ value: p.key, label: t_('{0} · {1} (nicht die Rolle des Schritts)', [p.name || p.key, p.role]) }))]
  const user = people.length
    ? await dialog.prompt({ title: t_('Zuständigen wählen · {0}', [L(w.label) || w.workflow]), value: w.assigned ?? '', choices, ok: t_('👤 Zuweisen') })
    : await dialog.prompt({ title: t_('Zuständigen wählen · {0}', [L(w.label) || w.workflow]), text: t_('Anwender-Key (leer = Rolle des nächsten Schritts)'), value: w.assigned ?? '', ok: t_('👤 Zuweisen') })
  if (user === null) return
  await command(() => api.post(`${nodeUrl()}/workflow/${w.workflow}/assign`, { user: user.trim() || null }, 'PUT'))
}

// Variantenachsen am Produkt — änderbar, solange es keine Varianten hat (ProductAxesSet).
const addAxis = ref('')
// Achsen setzen; ist das Ergebnis nicht eindeutig, fragt der Server — nach Hinweisdialog mit force: die betroffenen Varianten verlieren
// ihre Achsenzuordnung, die Werte bleiben
async function setAxes(axes) {
  try { await command(() => api.post(`${nodeUrl()}/axes`, { axes }, 'PUT'), true) }
  catch (e) {
    if (!/^Nicht eindeutig/.test(e.message)) { store.toast(e.message); return }
    const what = e.message.replace(/^Nicht eindeutig: /, '').replace(/ — mit force.*$/, '')
    if (!await dialog.confirm({ title: t_('Achsen trotzdem ändern?'), warn: what, text: t_('Diese Varianten verlieren ihre Achsenzuordnung (zählen nicht, bis sie unterscheidbar sind); ihre Werte bleiben. Oder abbrechen und eine weitere Achse wählen.'), ok: t_('Trotzdem ändern'), danger: true })) return
    await command(() => api.post(`${nodeUrl()}/axes`, { axes, force: true }, 'PUT'))
  }
}
// Achse dazu mit Varianten: Werte prüfen — leere zählen nicht —, nicht eindeutig → Warnung, nächste Achse ist Pflicht, so lange
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
// nur Attribute, die an den Varianten gelten: Gruppen am Pfad (node.groups), Attribut an der Variante erlaubt
const atVariant = computed(() => { const s = new Set(); for (const g of node.value?.groups ?? []) { const def = model.value?.groups.find(x => x.key === g.key); if (def?.activeFrom && def.activeFrom !== 'group' && def.activeFrom !== 'product' && def.activeFrom !== 'variant') continue; for (const k of g.attributes ?? []) s.add(k) } return s })
const axisChoices = computed(() => (model.value?.attributes ?? []).filter(a => ['enum', 'text', 'integer'].includes(a.type) && !a.multiple && !(node.value?.axes ?? []).includes(a.key) && atVariant.value.has(a.key) && (!a.levels || a.levels.includes('variant')))
  .sort((a, b) => (a.type === 'enum' ? 0 : 1) - (b.type === 'enum' ? 0 : 1) || (L(a.label) ?? a.key).localeCompare(L(b.label) ?? b.key, 'de')))
function attachAdd() { const g = addGroup.value; if (!g) return; addGroup.value = ''; attach([...node.value.attachedGroups, g]) }
// Kategorien gibt es in der Oberfläche nicht mehr: kein zweiter Baum — ein Knoten in mehreren Ästen wird ein
// „Symlink“, Kanalbäume (Web, Print) werden eigene, rein logische Bäume. Die Einträge CategoryAssigned/Removed bleiben (Journal).
function toggleRelease(channel, locale) {
  const q = `channel=${encodeURIComponent(channel)}` + (locale ? `&locale=${encodeURIComponent(locale)}` : '')
  command(() => released(channel, locale) ? api.del(`${nodeUrl()}/releases?${q}`) : api.post(`${nodeUrl()}/releases`, { channel, locale }))
}
function countBelow(id) { let n = 0; for (const k of tree.kids(id)) n += 1 + countBelow(k.id); return n }
async function retire() {
  const kids = node.value.children
  // immer fragen — eigener Dialog statt window.confirm
  const label = tree.byId.get(props.id)?.label ?? props.id
  const b = tree.below(props.id)
  if (!await dialog.confirm({ title: t_('{0} {1} zurückziehen?', [icon(node.value.role), label]), warn: b.total ? t_('Mit allen {0} Knoten darunter: {1}', [b.total, b.summary]) : '', list: b.names, ok: b.total ? t_('🗑 {0} Knoten zurückziehen', [b.total + 1]) : t_('🗑 Zurückziehen'), danger: true })) return
  try {
    const r = await api.del(nodeUrl() + (kids ? '?recursive=true' : ''))
    const gone = props.id
    const ps = stacksOf(node.value.parent ?? ''); ps.history.push({ kind: 'retire', id: gone, parent: node.value.parent, label, count: r?.retired ?? 1, batch: r?.batch ?? null }); ps.redo.length = 0
    if (r?.retired) store.toast(t_('{0} Knoten zurückgezogen (Stapel {1})', [r.retired, r.batch]), 'ok', { label: t_('↶ Wiederherstellen'), run: async () => { try { const x = r.batch ? await api.post(`/api/batches/${encodeURIComponent(r.batch)}/undo`) : await api.post(`/api/nodes/${encodeURIComponent(gone)}/restore`); store.toast(t_('{0} Knoten wiederhergestellt', [x.undone ?? 1]), 'ok'); await store.poll(true); await tree.load(); router.push(`/tree/${gone}`) } catch (e) { store.toast(e.message) } }, title: t_('stellt {0} Knoten wieder her: {1}{2}', [r.retired, shownLabel.value, r.retired > 1 ? ' ' + t_('mit {0} darunter', [r.retired - 1]) : '']) })
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
    { label: t_('Eigenen Wert löschen'), icon: '✗', key: 'Delete', disabled: ownV == null, hint: ownV == null ? t_('kein eigener') : (inh.value != null ? t_('geerbter gilt wieder') : ''), action: () => unsetValue(def, col) },
    inh.from ? { label: t_('Herkunft {0} {1} öffnen', [icon(inh.from.role), inh.from.label]), icon: '↑', key: 'h', action: () => router.push(`/tree/${inh.from.id}`) } : null,
    { label: t_('Wert kopieren'), icon: '⧉', key: 'c', disabled: shown == null, action: () => navigator.clipboard?.writeText(shown ?? '') },
    { label: sourceOf(def, col) ? t_('Quelle ändern …') : t_('Quelle angeben …'), icon: '↗', key: 'q', hint: sourceOf(def, col) ? `${sourceOf(def, col).method} · ${sourceOf(def, col).checkedAt}` : t_('Beleg am Wert'), disabled: ownV == null, action: () => setSource(def, col) },
    def.type !== 'html' && def.type !== 'rows' ? { label: starOwn(def.key) ? t_('Benennung wegnehmen') : t_('Ab hier damit benennen'), icon: '★', key: 's', hint: starOwn(def.key) ? (nextStar(def.key) ? `danach ★ von ${nextStar(def.key).fromLabel}` : t_('danach keine')) : t_('Name im Baum'), action: () => setStar(def) } : null,
    { label: t_('Attribut im Modell öffnen'), icon: '⊞', key: 'm', hint: '→ Modell → Attribute', action: () => router.push({ path: '/model', query: { section: 'attributes', key: def.key } }) },
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
      <button v-if="props.pub && node.role !== 'rubric'" class="x" :title="$t('Knoten im Pflegebaum öffnen (⇶ führt zurück)')" @click="store.pubBack = { path: $route.fullPath, label: pubTree?.label ?? $t('Publikation') }; router.push(`/tree/${id}`)">{{ $t("▣ Pflegebaum") }}</button>
      <button v-else-if="!props.pub && store.pubBack" class="x" :title="$t('zurück zur Publikation „{0}“', [store.pubBack.label])" @click="backToPub">⇶ {{ store.pubBack.label }}</button>
      <span class="grow" />
      <select v-if="node.role !== 'rubric'" :value="node.hasStatus === false ? '' : node.status" @change="pickStatus($event.target.value)" class="status"
        :style="node.hasStatus === false ? null : store.statusStyle(node.status)"
        :title="node.hasStatus === false ? $t('Kein Status — eine Gruppe bekommt einen, sobald jemand ihn setzt') : $t('Status: {0}', [store.statusLabel(node.status)])">
        <option v-if="node.hasStatus === false" value="" disabled>–</option>
        <option v-for="s in (store.model?.statuses ?? [])" :key="s.key" :value="s.key">{{ store.statusText(s.key) }}</option>
        <option v-if="node.status && node.hasStatus !== false && !store.status(node.status)" :value="node.status">{{ $t("{0} (nicht im Modell)", [node.status]) }}</option>
      </select>
      <button v-if="node.role !== 'rubric'" class="x" :style="node.statusNext ? store.statusStyle(node.statusNext) : null" @click="pickStatusAb"
        :title="node.statusNext ? $t('ab {0} {1}', [node.statusNextAb, store.statusLabel(node.statusNext)]) : $t('Status ab einem Tag setzen')">⏱<span v-if="node.statusNext" class="muted"> {{ node.statusNextAb }}</span></button>
      <button class="x" @click="store.journalOpen = !store.journalOpen; store.save()" :title="store.journalOpen ? $t('Journal zuklappen') : $t('Journal aufklappen')">{{ store.journalOpen ? '≡▸' : '◂≡' }}</button>
      <button class="x" @click="undo" :disabled="!history.length && !ausJournal?.possible"
        :title="history.length ? stepTitle(history[history.length - 1], $t('↶ Rückgängig'), history.length, $t('Strg+Z')) : (ausJournal?.possible ? $t('{0} (Strg+Z)', [ausJournal.what]) : $t('nichts rückgängig zu machen'))">↶<span v-if="history.length" class="muted"> {{ history.length }}</span></button>
      <button class="x" @click="redo" :disabled="!redoStack.length" :title="stepTitle(redoStack[redoStack.length - 1], $t('↷ Wiederholen'), redoStack.length, $t('Strg+Y'), true)">↷<span v-if="redoStack.length" class="muted"> {{ redoStack.length }}</span></button>
      <button class="x" @click="retire" :title="node.children ? $t('mit {0} Knoten darunter zurückziehen (Entf im Baum)', [countBelow(id)]) : $t('Knoten zurückziehen (Entf im Baum)')">🗑</button>
    </div>
    <div class="toolbar meta muted">
      <span class="mono">{{ node.id }}</span>
      <span>· {{ roleLabel[node.role] }}</span>
      <span v-if="node.role === 'product' && node.axes.length">{{ $t("· variiert nach {0}", [node.axes.map(axisLabel).join(', ')]) }}</span>
      <span v-if="node.role === 'variant'">· <span v-for="(v, a) in node.axisValues" :key="a" class="chip">{{ axisLabel(a) }}: {{ v }}</span></span>
      <span v-if="node.children">{{ $t("· {0} Subitems", [node.children]) }}</span>
      <span class="grow" />
      <span>≡ {{ node.entries }} · #{{ node.lastNumber }} 👤 {{ node.lastActor }} {{ when(node.lastAt) }}</span>
      <!-- Wer sonst gerade hier ist: ein Zeichen je Person, pulsierend — Präsenz, keine Sperre (26.09.2026) -->
      <span v-for="p in store.presence" :key="p.key" class="hier" :title="$t('{0} ist auch hier', [p.name])">👤</span>
      <span v-if="busy">…</span>
    </div>

    <div class="scroll" v-if="model">
    <!-- Alles rollt mit, die Bänder kleben oben (sticky) — nichts verschwindet hinter einem festen Kopf.
         Die Sicht (Sprachen, Kanal, Attributsicht, Anordnung) gehört zum Abschnitt Attribute — darum unter dessen Band. -->
    <h2 class="band" @click="toggle('attributes')"><span class="caret">{{ open('attributes') ? '▾' : '▸' }}</span>{{ $t("▤ Attribute") + ' ' }}<span class="muted">{{ $t("· {0} Gruppen · {1} Attribute", [blocks.length, blocks.reduce((n, b) => n + b.defs.length, 0)]) }}</span></h2>
    <template v-if="open('attributes')">
    <div class="attr-block">
    <!-- Leiste in drei Gruppen: WAS gezeigt wird (Sprachen, Kanal, Sicht, Filter, Suche) · WIE es angeordnet ist (flach/Reiter) · WIE es beschriftet ist (Namen) -->
    <div class="toolbar view">
      <MatrixPicker :model-value="store.viewCells" @update:model-value="setCells" :locales="locales" :channels="channels" :master-locale="master" :master-channel="masterChannel" />
      <span class="sep">·</span>
      <span class="grp" :title="$t('Zeilen: Attributsicht und Filter')">
        <select :value="store.viewKey[node.role] ?? ''" @change="setView($event.target.value)" :title="$t('Attributsicht für {0} — ⊞ Modell → Attributsichten', [roleLabel[node.role]])">
          <option value="">{{ $t("◫ komplett") }}</option>
          <option v-for="v in views" :key="v.key" :value="v.key">◫ {{ $L(v.label) || v.key }}</option>
        </select>
        <router-link :to="{ path: '/model', query: { section: 'views', key: orderView?.key } }" class="x edit" :title="orderView ? `${orderView.key} bearbeiten → Modell → Attributsichten` : '→ Modell → Attributsichten'">✎</router-link>
        <select :value="store.scope" @change="setScope($event.target.value)" :class="{ on: store.scope !== 'all' }" :title="$t('Filter — was von den Attributen gezeigt wird')">
          <option v-for="f in SCOPES" :key="f.key" :value="f.key" :title="f.title">{{ f.label }}</option>
        </select>
        <input ref="findBox" v-model="attrFilter" type="search" :placeholder="$t('Attribut oder Wert')" style="width:200px;font-size:12px" :title="$t('Suche im Sichtbaren: Attributname und die Werte der gezeigten Spalten; bei Reitern über alle Gruppen; Esc leert')" @keydown.esc="attrFilter = ''" />
        <span v-if="attrFilter" class="muted">{{ hitCount }}</span>
        <span v-if="missingOnly" class="view-chip on neg" style="cursor:pointer" :title="$t('Filter aufheben (zeigt wieder alle Attribute)')" @click="missingOnly = null">{{ $t("✗ fehlt für {0}", [missingOnly.channel]) + ' ' }}<b>{{ missingOnly.cells.size }}</b></span>
      </span>
      <span class="grow" />
      <span class="grp" :title="$t('Anordnung der Gruppen')">
        <button :class="{ primary: store.layout === 'flat' }" @click="setLayout('flat')" :title="$t('Gruppen untereinander')">☰</button>
        <button :class="{ primary: store.layout === 'tabs' }" @click="setLayout('tabs')" :title="$t('Gruppen als Reiter')">⧉</button>
      </span>
      <span class="sep">·</span>
      <button :class="{ primary: store.attrNames !== 'label' }" @click="cycleNames" :title="NAMES_TITLE[store.attrNames]">{{ store.attrNames === 'key' ? '⌨ key' : store.attrNames === 'both' ? '⌨ Aa⟨key⟩' : 'Aa' }}</button>
    </div>

    <div v-if="store.layout === 'tabs' && blocks.length" class="tabs">
      <button v-for="b in (attrFilter.trim() || missingOnly ? filteredBlocks : blocks)" :key="b.key" class="tabbtn" :class="{ on: tab === b.key, locked: !b.active }" @click="tab = b.key" :title="$t('{0} · {1} Attribute', [b.key, b.defs.length]) + (b.active ? '' : ' ' + $t('· gesperrt: aktiv ab {0}', [roleLabel[b.activeFrom]]))">{{ b.label }}<span v-if="!b.active"> ⌀</span></button>
    </div>


      <table class="grid values" :style="`width:${180 + columns.length * 220}px`">
        <colgroup><col :style="`width:${attrColWidth}px`" /><col v-for="c in columns" :key="c.label" style="width:220px" /></colgroup>
        <thead>
          <tr class="chan">
            <th rowspan="2">{{ $t("Attribut") }}</th>
            <th v-for="g in headGroups" :key="g.channel ?? '*'" :colspan="g.n" :class="{ master: g.channel && g.channel === masterChannel }" :title="g.channel ? (g.channel === masterChannel ? $t('Masterkanal — bekommt die Werte des Sterns, die anderen Kanäle beziehen ihren Wert aus ihm') : $t('Kanal {0} — ohne eigenen Wert gilt der Masterkanal', [g.channel])) : $t('ohne Kanal — der Stern: gilt, wo kein Kanal etwas anderes sagt')">{{ g.channel ?? '*' }}</th>
          </tr>
          <tr class="loc">
            <th v-for="c in columns" :key="c.label" :class="{ master: c.locale === master }" :title="(c.locale ? (c.locale === master ? $t('Mastersprache — Basis für alle anderen Sprachen') : $t('Sprache') + ' ' + c.locale) : $t('ohne Sprache — gilt für alle Sprachen')) + (c.channel ? ' ' + $t('· Kanal') + ' ' + c.channel : ' ' + $t('· alle Kanäle'))">{{ c.locale ?? '*' }}</th>
          </tr>
        </thead>
        <tbody v-for="b in shownBlocks" :key="b.key" :data-group="b.key">
          <tr class="group-row" :class="{ locked: !b.active }">
            <td :colspan="columns.length + 1">
              {{ b.label }}
              <router-link v-if="!b.custom" :to="{ path: '/model', query: { section: 'groups', key: b.key } }" class="muted edit" :title="`${b.key} bearbeiten → Modell → Attributgruppen`">✎</router-link>
              <span v-if="!b.custom" class="muted from" :title="b.fromRole === 'rubric' ? $t('Gruppe an Rubrik {0}', [b.fromLabel]) : (props.pub ? $t('Gruppe an {0} · nur lesen', [b.fromLabel]) : $t('Gruppe hängt an {0}', [b.fromLabel]))">{{ $t("· von {0}{1}", [b.from === id ? 'hier' : (b.fromRole === 'rubric' ? '▥ ' : '') + b.fromLabel, props.pub && b.fromRole !== 'rubric' ? ' ' + $t('· nur lesen') : '']) }}</span>
              <span v-if="!b.active" class="warn" :title="$t('Werte erst ab {0} — hier nur sichtbar', [roleLabel[b.activeFrom]])">{{ $t("· ⌀ ab {0}", [roleLabel[b.activeFrom]]) }}</span>
            </td>
          </tr>
          <template v-for="def in b.defs" :key="def.key">
          <!-- Zwischenüberschrift innerhalb einer Gruppe -->
          <tr v-if="def.divider" class="sub-row"><td class="sub" :colspan="columns.length + 1">{{ def.divider }}</td></tr>
          <tr v-else-if="def.type === 'formula' || def.type === 'template'">
            <td class="attr" :title="def.key + (def.type === 'template' ? ' ' + $t('— Vorlage: Textbaustein {key}[ … ] aus Attributen, Ergebnis wird gebaut') : ' ' + $t('— Formel: der Wert ist ein Skript, das Ergebnis wird gerechnet')) + auchTitel(def)"><div class="nm">{{ def.type === 'template' ? '{}' : 'ƒ' }} <span class="lbl">{{ store.label(def) }}</span><span v-if="store.attrNames !== 'label'" class="key muted">{{ def.key }}</span><span v-if="def.required" class="warn" :title="$t('Pflicht')">●</span></div></td>
            <template v-for="c in columns" :key="c.label">
              <td v-if="!enabled(def, c, b)" class="cell" :title="props.pub && b.fromRole !== 'rubric' ? $t('Pflegewert · ändern im Pflegebaum') : ''"><div class="cell-box disabled" :class="{ ro: props.pub && b.fromRole !== 'rubric' }">{{ props.pub && b.fromRole !== 'rubric' ? roValue(def, c) : '' }}</div></td>
              <td v-else class="cell">
                <div class="cell-box formula" :class="{ inherited: ownValue(def.key, c) == null && inherited(def, c).value != null }" tabindex="0"
                  @click="scriptCell = { def, col: c }" @keydown.enter.prevent="scriptCell = { def, col: c }"
                  :title="(ownValue(def.key, c) ?? inherited(def, c).value ?? $t('Skript anlegen (Editor öffnen)')) + (inherited(def, c).from && ownValue(def.key, c) == null ? '\n\ngeerbt von ' + inherited(def, c).from.label : '')">
                  <span class="res">{{ computedValue(def.key, c.locale) ?? '—' }}</span>
                </div>
              </td>
            </template>
          </tr>
          <tr v-else-if="def.type === 'rows'">
            <td class="attr" :title="def.key + auchTitel(def)"><div class="nm"><span class="lbl">{{ store.label(def) }}</span><span v-if="store.attrNames !== 'label'" class="key muted">{{ def.key }}</span> <span class="muted">{{ $t("≣ Zeilen") }}</span><span v-if="def.required" class="warn" :title="$t('Pflicht: mindestens eine Zeile')">●</span></div></td>
            <td :colspan="columns.length" style="padding:0">
              <RowsBlock v-if="b.active" :def="def" :rows="node.rows?.[def.key] ?? []" :values="own" :locale="viewLocales[0] ?? locales[0]"
                @set="(col, row, v) => setValue(col, { locale: col.perLocale ? (viewLocales[0] ?? locales[0]) : null, channel: null }, v, row)"
                @add="addRow(def)" @remove="row => removeRow(def, row)" @order="rows => orderRows(def, rows)" />
              <div v-else class="muted" style="padding:4px 8px">⌀</div>
            </td>
          </tr>
          <tr v-else>
            <td class="attr" :class="{ missing: missingOnly && missingOnly.keys.has(def.key) }" :title="def.key + (def.required ? ' ' + $t('· Pflicht:') + ' ' + Object.entries(def.required).map(([c, l]) => c + ':' + l.join(',')).join(' ') : '') + (def.inheritable ? ' · vererbbar' : '') + auchTitel(def)"><div class="nm">
              <button v-if="def.type !== 'html'" class="star" :class="{ on: !!star(def.key), own: starOwn(def.key), idle: star(def.key) && !star(def.key).applies }" :title="starTitle(def)" @click.stop="setStar(def)">{{ star(def.key) ? '★' : '☆' }}</button>
              <span class="lbl">{{ store.label(def) }}</span><span v-if="store.attrNames !== 'label'" class="key muted">{{ def.key }}</span>
              <span v-if="def.unit" class="muted">{{ def.unit }}</span>
              <span v-if="def.pattern" class="muted" :title="$t('Muster: {0}', [def.patternHint || def.pattern])">⌗</span>
              <span v-if="def.multiple" class="muted" :title="$t('vermehrbar: mehrere Werte, Liste in der Zelle')">≣</span>
              <span v-if="node.role === 'variant' && def.key in (node.axisValues ?? {})" class="muted" :title="$t('Variantenachse — der Wert unterscheidet die Varianten; die Kombination bleibt eindeutig')">⌖</span>
              <span v-if="def.inheritable" :class="columns.some(c => ownValue(def.key, c) != null) ? 'warn' : 'muted'" :style="columns.some(c => ownValue(def.key, c) != null) ? 'cursor:pointer' : ''" :title="columns.some(c => ownValue(def.key, c) != null) ? $t('Vererbung wiederherstellen (eigener Wert wird durch den geerbten ersetzt)') : 'vererbbar'" @click="columns.filter(c => ownValue(def.key, c) != null).forEach(c => unsetValue(def, c))">↓</span>
              <span v-if="def.required" class="warn" :title="$t('Pflicht')">●</span>
              <span v-if="def.hereLocked" class="warn" :title="$t('nicht an {0} — verwendbar an: {1}', [roleLabel[node.role], (def.levels ?? []).map(r => roleLabel[r]).join(', ')])">⌀</span>
              <span v-else-if="def.whenLocked" class="warn" :title="$t('gilt nur bei {0} = {1}{2}', [store.label(model.attributes.find(x => x.key === def.when.attribute) ?? { key: def.when.attribute }), def.when.values.slice(0, 6).join(', '), def.when.values.length > 6 ? ' …' : ''])">⌀</span>
            </div></td>
            <template v-for="c in columns" :key="c.label">
              <ToggleCell v-if="def.type === 'boolean'" :class="frischCls(def, c)" :value="ownOrAxis(def, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
              <ListCell v-else-if="def.multiple" :class="frischCls(def, c)" :value="ownOrAxis(def, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" :options="def.type === 'enum' ? listOptions(def) : null" :label-of="def.type === 'enum' ? listLabel(def) : null" :list="def.list" :check="v => validate(convert(v, def, store.model), def, store.model)" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
              <SelectCell v-else-if="def.type === 'enum'" :class="frischCls(def, c)" :value="ownOrAxis(def, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" :options="listOptions(def)" :label-of="listLabel(def)" :list="def.list" :group-of="listGroup(def)" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
              <DateCell v-else-if="def.type === 'date'" :class="frischCls(def, c)" :value="ownOrAxis(def, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
              <HtmlCell v-else-if="def.type === 'html'" :class="frischCls(def, c)" :value="ownOrAxis(def, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" :title="`${store.name(def)} · ${c.label}`" :node="id" :locale="c.locale ?? null" :label="store.label(def)"
                :origin="inherited(def, c).from ? `${icon(inherited(def, c).from.role)} ${inherited(def, c).from.label}` : null" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
              <Cell v-else :class="frischCls(def, c)" :value="ownOrAxis(def, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" :node="id" :locale="c.locale ?? null" :label="store.label(def)"
                :mark="stale(def, c) ? '⟳' : (inherited(def, c).master && ownValue(def.key, c) == null ? '◌' : null)" :mark-title="stale(def, c) ? $t('zu überarbeiten · {0} später geändert', [master]) : (c.locale ? $t('{0}-Text als Übersetzung übernehmen', [master]) : $t('{0}-Text als Grundtext übernehmen', [master]))" :mark-click="!stale(def, c) && inherited(def, c).master && ownValue(def.key, c) == null ? () => setValue(def, c, inherited(def, c).value) : null"
                :origin="inherited(def, c).from ? `${icon(inherited(def, c).from.role)} ${inherited(def, c).from.label}` : null" :source="sourceOf(def, c)" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
            </template>
          </tr>
          </template>
        </tbody>
      </table>
      <div v-if="pubStand" class="chips" style="margin:6px 0;font-size:12px"><span class="warn" :title="$t('Stand #{0}, gesetzt an „{1}“ (Rechtsklick auf die Rubrik ändert ihn)', [pubStand.stand, pubStand.from.label])">{{ $t("❄ Stand #{0}{1} · von „{2}“", [pubStand.stand, standAt ? ' · ' + new Date(standAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) : '', pubStand.from.label]) }}</span></div>
      <table v-if="sourceRows.length" class="grid values" :style="`width:${180 + columns.length * 220}px;margin-top:8px`">
        <tbody>
          <tr class="group-row locked"><td :colspan="1 + columns.length"><span class="muted">{{ $t("▣ Pflegewerte von „{0}“ · nur lesen", [node.sourceLabel]) }}</span> <router-link :to="`/tree/${node.source}`" class="x edit" :title="$t('im Pflegebaum öffnen — dort ändern')">▣</router-link></td></tr>
          <tr v-for="r in sourceRows" :key="r.def.key"><td class="attr"><span :title="r.def.key">{{ store.label(r.def) }}</span></td>
            <td v-for="(c, i) in columns" :key="c.label" class="cell" :title="$t('Pflegewert · ändern im Pflegebaum')"><div class="cell-box disabled ro">{{ r.cells[i] ?? '' }}</div></td></tr>
        </tbody>
      </table>
      <div v-if="!blocks.length && !sourceRows.length && props.pub && node.role === 'rubric'" class="empty" :title="$t('an der Wurzel angehängt gilt sie für alle Rubriken und Verweise darunter, hier nur ab dieser Rubrik')">{{ $t("Keine Attributgruppe — unten anhängen.") }}</div>
      <div v-else-if="!blocks.length" class="empty"><span :title="$t('Unten eine anhängen, oder oben am Pfad.')">{{ $t("Keine Attributgruppe gilt hier") }}</span></div>
    </div>
    </template>

      <div class="section" :class="{ over: mediaDrag }" @dragover.prevent="mediaDrag = true" @dragleave="mediaDrag = false" @drop.prevent="uploadMedia([...$event.dataTransfer.files], $event.ctrlKey || $event.metaKey)">
        <h2 @click="toggle('media')" :title="$t('Dateien hierher ziehen legt sie an diesem Knoten ab. Mit Strg wird ein Dokument ausgewertet — ein Rechtsklick auf ein Asset tut dasselbe.')"><span class="caret">{{ open('media') ? '▾' : '▸' }}</span>{{ $t("▩ Assets") + ' ' }}<span class="muted">· {{ mediaRels.length }}<template v-if="inheritedMedia.length">{{ ' ' + $t("· {0} geerbt", [inheritedMedia.length]) }}</template></span></h2>
        <template v-if="open('media')">
        <div class="tiles">
          <div v-for="(r, i) in mediaRels" :key="r.id" class="tile" :class="{ first: i === 0, drop: mediaDropId === r.id, dragging: mediaDragId === r.id, picked: pickedMedia.has(r.id) }"
            draggable="true" @dragstart="mediaDragStart($event, r)" @dragover="mediaDragOver($event, r)" @dragleave="mediaDropId === r.id && (mediaDropId = null)"
            @drop.prevent="mediaDrop(r)" @dragend="mediaDragEnd" @click="mediaClick($event, r)" @contextmenu="mediaMenu($event, r)"
            :title="`${r.other.label} · ${r.other.mime ?? ''} · ${$L(relType(r.type)?.label) || r.type}\n${$t('ziehen: Reihenfolge ändern · Strg+Klick: wählen · Rechtsklick: auswerten')}`">
            <div class="bild" :title="$t('anzeigen')"><MediaThumb v-if="r.other.isImage || r.other.hasThumb" :id="r.other.id" :self="r.other.isImage" /><div v-else class="doc">{{ (r.other.mime ?? '').split('/')[1]?.slice(0, 6) || '📄' }}</div></div>
            <div class="name"><span v-if="r.other.valid === false" class="neg" :title="$t('gilt heute nicht — fällt aus der Ausleitung')">⌛ </span><router-link :to="`/media`" class="muted">{{ r.other.label }}</router-link></div>
            <table class="grid" style="width:auto;margin:0"><tbody>
              <tr v-for="d in relGroupAttrs(r.type).filter(d => d.key !== 'stop')" :key="d.key"><td class="muted" style="font-size:11px;padding:0 4px" :title="d.key === 'inherit' ? $t('gilt dann an allen Subitems — bis eines die Vererbung stoppt') : d.key">{{ $L(d.label) || d.key }}</td>
                <ToggleCell v-if="d.type === 'boolean'" :value="relValue(r, d)" @save="v => setRelValue(r, d, v)" /><Cell v-else :value="relValue(r, d)" @save="v => setRelValue(r, d, v)" /></tr>
            </tbody></table>
            <div class="muted meta"><span v-if="i === 0" class="pos1" :title="$t('steht an erster Stelle — die Ausleitung nimmt sie als Hauptbild')">{{ '① ' }}</span>{{ $L(relType(r.type)?.label) || r.type }}<span v-if="relValueRaw(r, 'inherit') === 'true'" :title="$t('wird an die Subitems vererbt')">{{ ' ' + $t("· ↓ vererbt") }}</span><button class="x" style="float:right" @click="retireRel(r)" :title="$t('Zuordnung lösen (das Medium bleibt in der Bibliothek)')">×</button></div>
          </div>
          <!-- geerbte Medien: kursiv, gedämpft, mit Herkunft — hier nicht änderbar; ein eigenes Medium dieses Typs bricht die Vererbung -->
          <div v-for="r in inheritedMedia" :key="'inh-' + r.id" class="tile inherited" @click="vorschau = { media: vorschauMedien, start: r.other.id }" :title="$t('geerbt von {0} — nicht löschbar; ⛔ sperrt es hier und an allen Subitems', [r.from.label])">
            <div class="bild" :title="$t('anzeigen')"><MediaThumb v-if="r.other.isImage || r.other.hasThumb" :id="r.other.id" :self="r.other.isImage" /><div v-else class="doc">{{ (r.other.mime ?? '').split('/')[1]?.slice(0, 6) || '📄' }}</div></div>
            <div class="name muted"><i>{{ r.other.label }}</i></div>
            <div class="muted meta">{{ $L(relType(r.type)?.label) || r.type }} · <router-link :to="`/tree/${r.from.id}`" class="muted" :title="$t('zum Knoten, an dem das Medium hängt')">↑ {{ r.from.label }}</router-link>
              <button class="x" style="float:right" @click="stopInherited(r)" :title="$t('Medium hier und an allen Subitems sperren (rücknehmbar)')">⛔</button></div>
          </div>
        </div>
        <div v-if="stopped.length" class="chips" style="margin-top:6px">
          <span class="muted" style="font-size:12px" :title="$t('von oben vererbt — hier und an allem darunter gesperrt')">{{ $t("⛔ Verwendung und Vererbung unterbunden:") }}</span>
          <span v-for="r in stopped" :key="r.id" class="chip" :title="$t('{0} — von oben vererbt; hier und darunter weder verwendet noch weitervererbt', [r.other.label])">{{ r.other.label }} <button @click="retireRel(r)" :title="$t('wieder zulassen — das Medium gilt dann wieder als geerbt')">×</button></span>
        </div>
        <div class="chips" style="margin-top:6px" v-if="mediaTypes.length">
          <button class="primary" @click="mediaFile.click()">{{ $t("⇧ Hochladen") }}</button>
          <button v-if="mediaRels.length && node.children" @click="inheritToSubitems" :disabled="!!inheriting" :title="$t('Aufräumen: die Medien hier auf „vererben“ setzen und gleiche feste Zuordnungen an den Subitems lösen — sie erben dann')">{{ inheriting || $t('↓ feste Bilder der Subitems durch Vererbung ersetzen') }}</button>
          <input ref="mediaFile" type="file" multiple style="display:none" @change="uploadMedia([...$event.target.files]); $event.target.value = ''" />
          <button @click="mediaPick.open = true" :title="$t('Medien aus der Bibliothek zuordnen — Ordner, Suche, Mehrfachauswahl')">{{ $t("▨ Aus der Bibliothek wählen …") }}</button>
        </div>
        <MediaPicker v-if="mediaPick.open" :types="mediaTypes" :exclude="[...mediaRels, ...stopped].map(r => r.other.id)" @pick="linkMedia" @close="mediaPick.open = false" />
        <DocTables v-if="docTables" :node="node" :media="docTables.media" :names="docTables.names ?? {}" :dateien="docTables.dateien ?? []" :typen="docTables.typen ?? []" @close="docTables = null" @done="docTables = null; load(); store.poll(true)" />
        <MediaPreview v-if="vorschau" :media="vorschau.media" :start="vorschau.start" @close="vorschau = null" />
        </template>
      </div>

      <div class="section" v-if="node.role !== 'rubric' && !props.pub">
        <h2 @click="toggle('relations')"><span class="caret">{{ open('relations') ? '▾' : '▸' }}</span>{{ $t("⇄ Relationen") + ' ' }}<span class="muted">· {{ relCount }}</span></h2>
        <template v-if="open('relations')">
        <div v-for="b in relBlocks" :key="b.type" class="relblock">
          <table class="grid" style="width:auto">
            <thead><tr><th style="width:180px">{{ $L(relType(b.type)?.label) || b.type }}</th><th style="width:260px"></th><th v-for="d in relGroupAttrs(b.type)" :key="d.key" style="width:140px" :title="d.key">{{ $L(d.label) || d.key }}<span v-if="d.unit" class="muted"> {{ d.unit }}</span></th><th style="width:28px"></th></tr></thead>
            <tbody>
              <tr v-for="r in b.out" :key="r.id" :title="r.id">
                <td class="muted">→ {{ $L(relType(b.type)?.label) || b.type }}</td>
                <td><router-link v-if="!r.other.missing" :to="`/tree/${r.other.id}`">{{ icon(r.other.role) }} {{ r.other.label }}</router-link><span v-else class="neg" :title="$t('Knoten zurückgezogen')">✗ {{ r.other.id }}</span></td>
                <Cell v-for="d in relGroupAttrs(b.type)" :key="d.key" :value="relValue(r, d)" @save="v => setRelValue(r, d, v)" />
                <td class="num"><button class="x" @click="retireRel(r)" :title="$t('Relation zurückziehen')">×</button></td>
              </tr>
              <tr v-for="r in b.in" :key="r.id" :title="r.id">
                <td class="muted">{{ relType(b.type)?.symmetric ? '⇄' : '←' }} {{ relType(b.type)?.symmetric ? ($L(relType(b.type)?.label) || b.type) : ($L(relType(b.type)?.reverse) || $L(relType(b.type)?.label) || b.type) }}</td>
                <td><router-link v-if="!r.other.missing" :to="`/tree/${r.other.id}`">{{ icon(r.other.role) }} {{ r.other.label }}</router-link><span v-else class="neg" :title="$t('Knoten zurückgezogen')">✗ {{ r.other.id }}</span></td>
                <td v-for="d in relGroupAttrs(b.type)" :key="d.key" class="muted">{{ relValue(r, d) ?? '' }}</td>
                <td class="num"><button class="x" @click="retireRel(r)" :title="$t('Relation zurückziehen')">×</button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="chips" style="margin-top:6px">
          <select v-model="newRel.type" style="width:170px" :title="$t('Relationstyp — ⊞ Modell → Relationen')"><option value="">{{ $t("⇄ Typ …") }}</option><option v-for="t in relTypesFromHere" :key="t.key" :value="t.key">{{ $L(t.label) || t.key }}</option></select>
          <input v-model="newRel.q" type="search" :placeholder="$t('🔍 Ziel: Name, SKU, Id')" style="width:240px" :disabled="!newRel.type" @input="newRel.to = null" />
          <span v-if="newRel.to" class="chip">→ {{ tree.byId.get(newRel.to)?.label }} <button @click="newRel.to = null; newRel.q = ''">×</button></span>
          <button class="primary" :disabled="!newRel.type || !newRel.to" @click="addRel">{{ $t("Verbinden") }}</button>
        </div>
        <div v-if="newRel.q && !newRel.to" class="picker" style="max-width:520px">
          <div v-for="m in relMatches" :key="m.id" class="pick" @click="newRel.to = m.id; newRel.q = m.label">{{ icon(m.role) }} {{ m.label }}<span class="muted mono" style="margin-left:auto;font-size:11px">{{ tree.keyText(m) || m.id }}</span></div>
          <div v-if="!relMatches.length" class="muted" style="padding:4px 8px;font-size:12px">{{ $t("nichts zu „{0}“", [newRel.q]) }}</div>
        </div>
        </template>
      </div>

      <div class="section" v-if="workflows.length">
        <h2 @click="toggle('workflow')"><span class="caret">{{ open('workflow') ? '▾' : '▸' }}</span>{{ $t("⚑ Workflow") + ' ' }}<span class="muted">· <span v-for="(w, i) in workflows" :key="w.workflow"><span v-if="i"> · </span>{{ $L(w.label) || w.workflow }}: <span :style="`color:${wfColor(w.color)};font-weight:600`">{{ w.stateLabel?.de || w.state }}</span><span v-if="w.pending?.length" class="warn" :title="w.pending.map(pe => pe.canFix ? effLabel(pe.effect) : $t('nicht ausgeleitet')).join(' · ')"> ⚠</span></span></span></h2>
        <template v-if="open('workflow')">
        <table class="grid form"><colgroup><col style="width:150px" /><col /></colgroup><tbody>
          <template v-for="w in workflows" :key="w.workflow">
          <tr>
            <td class="attr" :title="w.workflow">{{ $L(w.label) || w.workflow }}</td>
            <td style="display:flex;gap:6px;flex-wrap:nowrap;align-items:center;width:100%;box-sizing:border-box;overflow:hidden">
              <span class="chip" :style="`border-color:${wfColor(w.color)};color:${wfColor(w.color)}`" :title="(w.inheritedFrom ? $t('Zustand geerbt von {0} „{1}“ ·', [w.inheritedFrom.role === 'product' ? $t('Produkt') : $t('Gruppe'), w.inheritedFrom.label]) + ' ' : '') + (w.since ? `seit ${when(w.since)} · ${w.actor}${w.transition ? ' · Schritt ' + w.transition : ''}` : $t('Startzustand'))">{{ w.stateLabel?.de || w.state }}<span v-if="w.inheritedFrom" class="muted"> ↑</span></span>
              <button v-for="t in w.transitions" :key="t.key" :class="{ blocked: t.blocked }" @click="t.blocked ? wfBlocked(t) : wfStep(w, t)" :title="t.blocked ? t.blocked : `→ ${t.toLabel?.de || t.to}${t.noteRequired ? ' · Notiz Pflicht' : ''}${t.effects?.length ? ' · ' + t.effects.join(', ') : ''}`">{{ t.blocked ? '⊘ ' : '' }}{{ $L(t.label) || t.key }} →</button>
              <button v-if="!w.inheritedFrom && w.since && node.parent" class="x" @click="wfClear(w)" :title="$t('Vererbung wiederherstellen (eigener Zustand wird aufgehoben)')">{{ $t("↑ Erben") }}</button>
              <span v-for="t in w.all.filter(t => t.escalateAfterDays != null)" :key="'esc' + t.key" :class="t.escalated ? 'warn' : 'muted'" style="font-size:12px;flex:0 0 auto;white-space:nowrap" :title="`${t.escalated ? 'eskaliert seit' : 'eskaliert am'} ${t.escalatesAt ? new Date(t.escalatesAt).toLocaleDateString('de-DE') : '—'} an ${(t.escalateRoles ?? []).join(', ') || 'alle Rollen'} · Schritt „${$L(t.label) || t.key}“`">⏰ {{ t.escalatesAt ? new Date(t.escalatesAt).toLocaleDateString('de-DE') : t.escalateAfterDays + ' d' }}</span>
              <span v-if="!w.transitions.length && w.all.length" class="muted" style="font-size:12px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="w.all.map(t => `${$L(t.label) || t.key}: ${(t.roles ?? []).join(', ') || 'jede Rolle'}`).join(' · ')">{{ $t("nächster Schritt: {0}", [w.all.map(t => (t.roles ?? []).join('/') || $t('Rolle mit Schreibrecht')).join(', ')]) }}</span>
              <span v-if="!w.transitions.length && !w.all.length" class="muted" style="font-size:12px">{{ $t("Ende des Wegs") }}</span>
              <span class="grow" />
              <template v-for="pe in (w.pending ?? [])" :key="pe.effect">
                <button v-if="pe.canFix" class="x warn" @click="wfEffect(pe.effect)" :title="$t('Wirkung „{0}“ nachholen (Schritt „{1}“ hat sie nicht ausgeführt)', [effLabel(pe.effect), w.transition])">⚠ {{ effLabel(pe.effect) }}</button>
                <span v-else class="warn" style="font-size:12px" :title="$t('{0}: keine Variante freigegeben{1}', [pe.effect.split(':')[1], pe.why ? ' · ' + pe.why : ''])">{{ $t("⚠ nicht ausgeleitet") }}</span>
              </template>
              <span v-if="w.note" class="muted" :title="w.transition ? $t('Notiz zum Schritt „{0}“: {1}', [w.transition, w.note]) : w.note" style="flex:0 0 300px;width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-left:auto;text-align:right">✎ {{ w.note }} <span class="mono">· {{ w.actor }}</span></span>
              <button class="x" @click="wfAssign(w)" :title="w.assigned ? $t('Zuständigen ändern (jetzt {0})', [w.assigned]) : $t('Zuständigen zuweisen')">{{ w.assigned ? '👤 ' + w.assigned : '👤' }}</button>
              <button class="x" @click="wfHistory(w)" :title="$t('Verlauf anzeigen')">≡</button>
            </td>
          </tr>
          <!-- Workflow je Sprache: eine Zeile je Sprache — Französisch in Korrektur, Deutsch freigegeben -->
          <tr v-if="w.perLocale">
            <td class="attr muted" :title="$t('Dieser Workflow läuft je Sprache: jede Sprache geht ihren eigenen Weg, und die Wirkung eines Schritts (Freigabe) trifft nur sie.')">{{ $t("🗣 je Sprache") }}</td>
            <td><WorkflowLocales :wf="w" @step="(loc, t) => wfStep(w, t, loc)" @clear="loc => wfClear(w, loc)" /></td>
          </tr>
          </template>
        </tbody></table>
        </template>
      </div>
      <!-- Bänder der Plugins (nodeBands): ETIM-Stand u. a. — beim Gegenstand, nicht im Plugin -->
      <PluginBands v-if="node.role !== 'rubric'" :id="id" :role="node.role" />
      <div class="section" v-if="node.role !== 'group' && node.role !== 'rubric'">
        <h2 @click="toggle('releases')" :title="$t('Vollständigkeit aus der Pflicht der aktiven Attribute; unvollständig heisst keine Freigabe.')"><span class="caret">{{ open('releases') ? '▾' : '▸' }}</span>{{ $t("✓ Freigaben") }}</h2>
        <template v-if="open('releases')">
        <table class="grid releases">
          <thead><tr><th>{{ $t("Kanal") }}</th><th v-if="node.role === 'variant'">*</th><th v-for="l in locales" :key="l">{{ l }}</th></tr></thead>
          <tbody>
            <tr v-for="ch in channels" :key="ch">
              <td class="mono muted">{{ ch }}</td>
              <td v-if="node.role === 'variant'">
                <button class="toggle" :class="{ on: released(ch, null), via: !released(ch, null) && releasedVia(ch, null) }" :disabled="!released(ch, null) && !!incomplete(ch, null)" :title="releasedVia(ch, null) && !released(ch, null) ? $t('Eigens freigeben (bisher über das Sortiment von {0})', [releasedVia(ch, null)]) : incomplete(ch, null) ? 'fehlt: ' + incomplete(ch, null).missing.join(', ') : $t('alle Sprachen')" @click="toggleRelease(ch, null)">{{ released(ch, null) ? '✓' : releasedVia(ch, null) ? '◌' : '·' }}</button>
              </td>
              <td v-for="l in locales" :key="l" class="rel">
                <button v-if="node.role === 'variant'" class="toggle" :class="{ on: released(ch, l), via: !released(ch, l) && releasedVia(ch, l) }" :disabled="!released(ch, l) && !!incomplete(ch, l)" :title="releasedVia(ch, l) && !released(ch, l) ? $t('Eigens freigeben (bisher über das Sortiment von {0})', [releasedVia(ch, l)]) : incomplete(ch, l) ? 'fehlt: ' + incomplete(ch, l).missing.join(', ') : ''" @click="toggleRelease(ch, l)">{{ released(ch, l) ? '✓' : releasedVia(ch, l) ? '◌' : '·' }}</button>
                <span v-if="completeness(ch, l)" class="mono" :class="completeness(ch, l).missing.length ? 'neg' : 'pos'" :title="completeness(ch, l).missing.length ? 'fehlt: ' + completeness(ch, l).missing.join(', ') : $t('vollständig')">{{ completeness(ch, l).filled }}/{{ completeness(ch, l).required }}</span>
                <span v-else class="muted" :title="$t('hier ist nichts Pflicht')">–</span>
              </td>
            </tr>
          </tbody>
        </table>
        </template>
      </div>

      <div class="section" v-if="node.orphans?.length">
        <h2 class="warn">{{ $t("⚠ Verwaiste Werte") }}</h2>
        <div class="muted"><span :title="$t('Werte für Attribute, die hier über keine Gruppe gelten — etwa nach dem Umhängen.')">{{ $t("Eigene Werte ohne Gruppe:") }}</span> <span class="mono">{{ node.orphans.join(', ') }}</span>{{ ' ' + $t("— Gruppe anhängen, dann gelten sie wieder.") }}</div>
      </div>

      <div class="section" v-if="node.role === 'product' && !props.pub">
        <h2 @click="toggle('axes')" :title="$t('Sichern Eindeutigkeit in den gewählten Attributen über alle Varianten.')"><span class="caret">{{ open('axes') ? '▾' : '▸' }}</span>{{ $t("◆ Variantenachsen") }}</h2>
        <template v-if="open('axes')">
        <table v-if="node.axes.length" class="grid" style="width:auto">
          <thead><tr><th style="width:180px">{{ $t("Achse") }}</th><th style="width:260px">{{ $t("Attribut") }}</th><th style="width:30px"></th></tr></thead>
          <tbody>
            <tr v-for="(k, i) in node.axes" :key="k" :title="k">
              <td class="muted">{{ i + 1 }}. {{ axisLabel(k) }}</td>
              <td><router-link :to="{ path: '/model', query: { section: 'attributes', key: k } }" class="mono">{{ k }}</router-link></td>
              <td class="num"><button class="x" @click="setAxes(node.axes.filter(x => x !== k))" :title="$t('Achse entfernen — ihr Wert bleibt als Attributwert an den Varianten')">×</button></td>
            </tr>
          </tbody>
        </table>
        <div class="chips" style="margin-top:6px">
          <select v-model="addAxis" style="width:220px"><option value="">{{ wiz ? $t('+ weitere Achse (Pflicht) …') : $t('+ Achse …') }}</option><option v-for="a in axisChoices.filter(x => !(wiz?.axes ?? []).includes(x.key))" :key="a.key" :value="a.key">{{ a.type === 'enum' ? '☰' : a.type === 'integer' ? '12' : 'Aa' }} {{ $L(a.label) || a.key }} · {{ a.key }}</option></select>
          <button class="primary" :disabled="!addAxis" @click="axisAdd">{{ wiz ? $t('prüfen') : 'dazu' }}</button>
        </div>
        <div v-if="wiz" class="picker" style="padding:8px;margin-top:6px">
          <div class="chips"><span v-for="k in wiz.axes" :key="k" class="chip" :class="{ on: !node.axes.includes(k) }">{{ axisLabel(k) }}</span><span class="muted" style="font-size:12px">{{ $t("· {0} Varianten{1}", [wiz.total, wiz.empty ? $t(', {0} ohne Wert (zählen nicht)', [wiz.empty]) : '']) }}</span></div>
          <div v-if="wiz.dupes.length" class="warn" style="margin-top:6px">{{ $t("⚠ nicht eindeutig —") + ' ' }}<span v-for="d in wiz.dupes.slice(0, 6)" :key="d.combo" class="chip" style="margin-right:4px">{{ d.combo }} × {{ d.n }}</span>{{ $t("{0} → oben eine weitere Achse wählen und prüfen", [wiz.dupes.length > 6 ? ` … ${wiz.dupes.length}` : '']) }}</div>
          <div v-else class="pos" style="margin-top:6px">{{ $t("✓ eindeutig") }}</div>
          <div class="chips" style="margin-top:6px"><button class="primary" :disabled="wiz.dupes.length > 0" @click="axisCommit">{{ $t("Achsen hinzufügen") }}</button><button @click="wiz = null">{{ $t("Abbrechen") }}</button></div>
        </div>
        </template>
      </div>

      <div class="section" v-if="!props.pub || node.role === 'rubric'">
        <h2 @click="toggle('groups')" :title="$t('Hier angehängt, gelten sie ab hier nach unten; geerbte stehen oben mit ihrer Herkunft.')"><span class="caret">{{ open('groups') ? '▾' : '▸' }}</span>{{ $t("▤ Attributgruppen ab diesem Knoten") }}</h2>
        <template v-if="open('groups')">
        <table v-if="attachedSorted.length" class="grid" style="width:auto">
          <thead><tr><th style="width:180px">{{ $t("Gruppe") }}</th><th style="width:260px">{{ $t("gilt") }}</th><th style="width:30px"></th></tr></thead>
          <tbody>
            <tr v-for="g in attachedSorted" :key="g" :title="g">
              <td><router-link :to="{ path: '/model', query: { section: 'groups', key: g } }">▤ {{ groupLabel(g) }}</router-link></td>
              <td class="muted">{{ groupLocked(g) ? $t('⌖ hier gesperrt — aktiv ab') + ' ' + roleLabel[model.groups.find(x => x.key === g).activeFrom] : $t('ab hier nach unten') }}</td>
              <td class="num"><button class="x" @click="attach(node.attachedGroups.filter(x => x !== g))" :title="$t('Gruppe hier abnehmen')">×</button></td>
            </tr>
          </tbody>
        </table>
        <div class="chips" style="margin-top:6px">
          <select v-model="addGroup" style="width:200px"><option value="">{{ $t("+ Gruppe …") }}</option><option v-for="g in freeGroups" :key="g.key" :value="g.key" :title="g.key">{{ $L(g.label) || g.key }}{{ g.activeFrom ? ' (ab ' + roleLabel[g.activeFrom] + ')' : '' }}</option></select>
          <button class="primary" :disabled="!addGroup" @click="attachAdd">{{ $t("Anhängen") }}</button>
        </div>
        </template>
      </div>

      <div class="section" v-if="node.role !== 'rubric' && !props.pub">
        <h2 @click="toggle('versions')"><span class="caret">{{ open('versions') ? '▾' : '▸' }}</span>{{ $t("⎘ Versionen") + ' ' }}<span class="muted"><span :title="$t('Stand einfrieren, Belege der Erzeuger, Stand ansehen, zurückrollen.')">{{ $t("· eingefrorene Stände") }}</span></span></h2>
        <VersionsPanel v-if="open('versions')" :id="id" :role="node.role" @changed="load(); store.poll(true)" />
      </div>
    </div>

  </div>
  <div v-else class="pane" style="flex:3"><div class="empty">…</div></div>

  <Splitter v-if="store.journalOpen" v-model="journalW" side="right" :min="240" :max="1000" />
  <ScriptEditor v-if="scriptCell" :model-value="ownValue(scriptCell.def.key, scriptCell.col) ?? inherited(scriptCell.def, scriptCell.col).value ?? ''" :title="`${$L(scriptCell.def.label) || scriptCell.def.key} · ${scriptCell.col.label} · ${shownLabel}`"
    :draft-key="`${id}.${scriptCell.def.key}.${scriptCell.col.label}`" :type="scriptCell.def.type" :node="id" :locale="scriptCell.col.locale ?? undefined"
    :attributes="(model?.attributes ?? []).filter(a => a.key !== scriptCell.def.key && a.type !== 'rows' && a.type !== 'html')"
    @save="v => { setValue(scriptCell.def, scriptCell.col, v); scriptCell = null }" @close="scriptCell = null" />
  <div v-if="store.journalOpen" class="pane" :style="`width:${journalW}px;flex:none`">
    <div class="toolbar"><h1>{{ $t("≡ Journal") }}</h1><span class="muted mono">{{ id }}</span><span class="muted">{{ entries.length }}</span><span class="grow" /><button class="x" @click="store.journalOpen = false; store.save()" :title="$t('Journal zuklappen')">▸</button></div>
    <div class="scroll"><EntryList :entries="entries" /></div>
  </div>
  <div v-else class="pane rail-pane" @click="store.journalOpen = true; store.save()" :title="$t('Journal aufklappen')">
    <span class="vert">{{ $t("◂ ≡ Journal · {0}", [entries.length]) }}</span>
  </div>
</template>

<style scoped>
.grp { display: inline-flex; align-items: center; gap: 4px; }
/* Filter-Dropdown: leuchtet, wenn ein Filter wirkt */
select.on { color: var(--accent); border-color: var(--accent); }
/* Pfad bricht nicht um — wird er zu lang, schrumpft die Schrift (fitPath), notfalls Ellipse an den Gliedern */
.path { flex-wrap: nowrap; white-space: nowrap; overflow: hidden; }
.path .crumb, .path h1 { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.path .crumb, .path h1 { flex: 0 1 auto; }
.path.rigid .crumb, .path.rigid h1 { flex: 0 0 auto; }
.crumb { color: var(--muted); }
.crumb:hover { color: var(--accent); }
.meta { font-size: 12px; min-height: 28px; }
/* Sicht-Zeile klebt unter dem Band, damit Sprachen, Sicht und Suchfeld beim Rollen bleiben */
.view { gap: 4px; font-size: 12px; min-height: 30px; height: 31px; box-sizing: border-box; flex-wrap: nowrap; overflow: hidden; position: sticky; top: 26px; z-index: 3; background: var(--pane); }
/* Mastersprache: fett und in Akzentfarbe — in der Sicht und im Spaltenkopf */
.view-chip.master { font-weight: 700; }
th.master { color: var(--accent); font-weight: 700; }
.view select, .view button { font-size: 12px; padding: 1px 6px; }
/* Reiter: einzeilig, klein, umbrechend — mit Echtdaten sind es zwanzig und mehr */
.tabs { display: flex; flex-wrap: wrap; gap: 2px; padding: 4px 8px 0; border-bottom: 1px solid var(--line); background: var(--bg); position: sticky; top: 57px; z-index: 3;
  max-height: 84px; overflow-y: auto; }   /* vierzig Gruppen sind vier Zeilen — darüber rollt die Leiste in sich */
.attr-block { position: relative; }
.tabbtn { border: 1px solid var(--line); border-bottom: 0; border-radius: 6px 6px 0 0; background: var(--bg); color: var(--muted); padding: 1px 8px; font-size: 12px; line-height: 18px; white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.tabbtn .n { font-size: 10px; }
/* aktiv: Farbe und Kante, nie fett — fett ist breiter und liesse die Reiterzeile anders umbrechen */
.tabbtn.on { background: var(--pane); color: var(--accent); border-color: var(--accent); }
.tabbtn.locked { opacity: .6; }
.cell-box.disabled.ro { background: none; color: var(--muted); padding: 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }   /* Pflegewert im Publikationsbaum: lesbar, nicht schraffiert */
/* Abschnitte des Knotens: dieselbe Stufe wie ein Gruppenkopf im Gitter — Band in Akzentfarbe mit Oberkante */
.section { padding: 0 8px 10px; border-top: 0; }
.relblock { margin-bottom: 8px; }
.section.over { outline: 2px dashed var(--accent); outline-offset: -4px; }
.tiles { display: flex; flex-wrap: wrap; gap: 8px; }
.tile.inherited { opacity: .7; border-style: dashed; }
.tile { width: 150px; border: 1px solid var(--line); border-radius: 6px; padding: 4px; background: var(--pane); }
.tile img, .tile .doc { width: 100%; height: 100px; object-fit: contain; display: grid; place-items: center; background: var(--bg); border-radius: 4px; color: var(--muted); font-size: 12px; }
.tile .bild { cursor: zoom-in; }
.tile .name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 4px 0; }
.tile .name a { text-decoration: none; }
.tile .meta { font-size: 11px; margin-top: 2px; }
.tile.first { border-color: var(--accent); }
.tile.picked { background: var(--accent-soft); }
.tile.drop { outline: 2px dashed var(--accent); outline-offset: -2px; }
.tile.dragging { opacity: .5; }
.tile .pos1 { color: var(--accent); }
.relblock a { color: inherit; text-decoration: none; }
.relblock a:hover { text-decoration: underline; }
.picker { max-height: 240px; overflow: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--pane); margin-top: 4px; }
.pick { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 8px; white-space: nowrap; cursor: pointer; }
.pick:hover { background: var(--hover); }
/* Abschnittsüberschriften (Attribute, Medien, Relationen, …): oberste Stufe — Band in Akzentfarbe mit Oberkante */
.section h2, h2.band { font-size: 12px; margin: 0; padding: 0 8px; height: 26px; line-height: 24px; box-sizing: border-box; color: var(--text); font-weight: 600; letter-spacing: .02em; background: var(--accent-soft); border-top: 2px solid var(--accent);
  position: sticky; top: 0; left: 0; z-index: 3; cursor: pointer; user-select: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.section h2 { margin: 0 -8px 8px; }
.attr.missing { box-shadow: inset 3px 0 0 var(--neg); }
button.blocked { opacity: .55; }   /* Schritt geht jetzt nicht — Grund im Tooltip und beim Klick */   /* fehlender Pflichtwert (nur Fehlendes) */
.section h2 .muted, h2.band .muted { font-weight: 400; }
.section h2 .caret, h2.band .caret { display: inline-block; width: 14px; color: var(--muted); }
/* Tabellenkopf klebt unter dem Band (26px) */
table.values tr.chan th { top: 57px; }   /* Band 26 + Sicht-Zeile 31 */
table.values tr.loc th { top: 80px; }    /* darunter die Sprachzeile (Kanalzeile 23) */
table.values tr.chan th { text-align: center; height: 23px; box-sizing: border-box; border-bottom: 1px solid var(--line); }
table.values tr.chan th:first-child { text-align: left; }
/* Gruppenköpfe: eine Stufe unter der Abschnittsüberschrift, darum nicht dasselbe Band —
   Zellton mit Akzentkante links, Name in Akzentfarbe; gesperrte zurückgenommen (gedämpft, 🔒). */
/* Von aussen geändert: die Zelle blitzt kurz auf — jemand anders (oder ein anderer Server) hat hier geschrieben */
.cell.frisch { animation: frisch 2s ease-out; }
@keyframes frisch {
  0%   { background: color-mix(in srgb, var(--a) 45%, transparent); }
  100% { background: transparent; }
}
/* Wer sonst gerade hier ist: je Person ein Personensymbol, pulsierend, gelb — hier arbeitet noch jemand (26.09.2026) */
.hier { margin-left: 4px; color: var(--warn); animation: hier 1.8s ease-in-out infinite; }
@keyframes hier { 0%, 100% { opacity: 1; } 50% { opacity: .25; } }
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
/* technischer Key neben der Bezeichnung: abgegraut, Schreibmaschine */
td.attr .key { font-family: var(--mono); font-size: 11px; margin-left: 6px; flex: 0 0 auto; }
/* Namenszelle als Zeile: Bezeichnung darf mit Ellipse enden, der Key nie */
/* die Zelle bleibt Tabellenzelle (sonst stimmen die Zeilenhöhen nicht mehr) — der Flex-Kasten ist ein Div darin */
td.attr .nm { display: flex; align-items: center; gap: 4px; min-width: 0; }
td.attr .lbl { flex: 0 1 auto; min-width: 2em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* ★ Name im Baum: hohl = nicht gesetzt, blau = geerbt (von oben), gelb = hier gesetzt, halb durchsichtig = gesetzt, gilt hier nicht */
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
.toggle.via { color: var(--pos); }
.toggle:disabled { opacity: .35; cursor: not-allowed; }
.status { border: 1px solid var(--line); border-radius: 4px; padding: 2px 4px; background: var(--pane); }
.x { border: 0; background: none; }
.rail-pane { width: 26px; flex: none; cursor: pointer; align-items: center; padding-top: 8px; }
.rail-pane:hover { background: var(--hover); }
.vert { writing-mode: vertical-rl; color: var(--muted); font-size: 12px; white-space: nowrap; }
</style>
