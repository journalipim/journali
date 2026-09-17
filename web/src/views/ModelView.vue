<script setup>
// Das Modell (Taloans Struktur, 17.09.2026), überall dieselbe Aufteilung wie im Baum:
//   links die Abschnitte, in der Mitte eine schmale Liste (Key, Name, Kennzahlen als
//   Symbole), rechts das gewählte Ding mit allen Feldern und seinem Inhalt.
//   Struktur: Attributgruppen · Attribute · Wertelisten · Attributsichten
//   Basics:   Einheiten · Sprachen · Kanäle
// Jedes Feld speichert sofort = ein Eintrag mit der ganzen Definition. Mehrfachauswahl
// in der Liste: Shift/Strg+Klick, dann Stapelaktionen rechts (Gruppe zuweisen, zurückziehen).
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api.js'
import { store } from '../store.js'
import { icon } from '../tree.js'
import EditGrid from '../components/EditGrid.vue'
import Cell from '../components/Cell.vue'
import ToggleCell from '../components/ToggleCell.vue'
import SelectCell from '../components/SelectCell.vue'
import Splitter from '../components/Splitter.vue'
import { paneWidth } from '../panes.js'
const listW = paneWidth('model.list', 340)

const sections = [
  { key: 'groups', icon: '▤', label: 'Attributgruppen', part: 'Struktur', one: 'Gruppe', hint: 'Eine Gruppe bündelt Attribute und hängt an Baumknoten; ihre Definition vererbt sich nach unten. „aktiv ab“ sagt, ab welchem Knotentyp Werte erfasst werden.' },
  { key: 'attributes', icon: '⊞', label: 'Attribute', part: 'Struktur', one: 'Attribut', hint: 'Ein Attribut hat Typ, Gruppe, Achsen (Sprache, Kanal) und Pflicht je Kanal. Der Schlüssel ist für immer.' },
  { key: 'lists', icon: '☰', label: 'Wertelisten', part: 'Struktur', one: 'Werteliste', hint: 'Ein Attribut vom Typ enum zeigt auf einen Eintrag der Liste, nicht auf ein Wort. Der Eintrag hat Namen je Sprache und eigene Spalten (Farbe: ral).' },
  { key: 'views', icon: '◫', label: 'Attributsichten', part: 'Struktur', one: 'Sicht', hint: 'Je Knotentyp: welche Gruppen in welcher Reihenfolge, darin die Attribute in welcher Reihenfolge. Der Knoten zeigt in einer Sicht nur deren Gruppen.' },
  { key: 'relationTypes', icon: '⇄', label: 'Relationen', part: 'Struktur', one: 'Relationstyp', hint: 'Ein Relationstyp verbindet Knoten (Zubehör, Bestandteil …): Bezeichnung hin und zurück, erlaubte Knotentypen, und eine Attributgruppe, deren Attribute an der Relation stehen (Menge, Slot).' },
  { key: 'units', icon: '⚖', label: 'Einheiten', part: 'Basics', one: 'Einheit', hint: 'Je Grösse eine Basis mit Faktor 1; die Anzeige rechnet über den Faktor um.' },
  { key: 'locales', icon: '🗣', label: 'Sprachen', part: 'Basics', one: 'Sprache', hint: 'Die Achse locale der Attribute.' },
  { key: 'channels', icon: '⇶', label: 'Kanäle', part: 'Basics', one: 'Kanal', hint: 'Die Achse channel; Pflichtfelder und Freigaben gelten je Kanal.' },
]
const section = ref('attributes')
const model = computed(() => store.model)
const cur = ref(null)               // Schlüssel des gewählten Dings (rechts)
const sel = ref(new Set())          // Mehrfachauswahl in der Liste
const anchor = ref(null)
const filter = ref('')               // Suche: Text über Key und Name
const flt = ref({ group: '', type: '', locale: false, channel: false, multiple: false, activeFrom: '', level: '', quantity: '' })   // Filter: Eigenschaften
const resetFlt = () => { flt.value = { group: '', type: '', locale: false, channel: false, multiple: false, activeFrom: '', level: '', quantity: '' } }
const newKey = ref('')
const newValue = ref('')
const addViewGroup = ref('')
const bulkGroup = ref('')
const roleLabel = { group: '▣ Produktgruppe', product: '▦ Produkt', variant: '◆ Variante' }
const roles = ['group', 'product', 'variant']
const TYPES = ['text', 'html', 'integer', 'decimal', 'boolean', 'date', 'enum', 'rows', 'formula']
const TYPE_SYM = { text: 'Aa', html: '‹›', integer: '12', decimal: '1.5', boolean: '☑', date: '📅', enum: '☰', rows: '≣', formula: 'ƒ' }
const sec = computed(() => sections.find(s => s.key === section.value))

async function send(fn) {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  try { await fn(); await store.poll(true) } catch (e) { store.toast(e.message) }
}
const put = (path, body) => send(() => api.post(path, body, 'PUT'))
const del = path => send(() => api.del(path))

function switchTo(k) { section.value = k; sel.value = new Set(); cur.value = null; filter.value = ''; resetFlt() }
// Sprung aus dem Knoten: /model?section=groups&key=<gruppe> öffnet den Abschnitt mit dem Ding rechts.
const route = useRoute()
function fromQuery(q) {
  if (!q.section || !sections.some(x => x.key === q.section)) return
  switchTo(q.section)
  if (q.key) { cur.value = q.key; sel.value = new Set([q.key]) }
}
onMounted(() => fromQuery(route.query))
watch(() => route.query, fromQuery)

// ---- Die Liste in der Mitte: je Abschnitt Zeilen { key, label, right[] }
const byKey = (a, b) => a.key.localeCompare(b.key)
const rows = computed(() => {
  const m = model.value; if (!m) return []
  switch (section.value) {
    case 'groups': return (m.groups ?? []).map(g => ({ key: g.key, label: g.label?.de, right: [`⊞ ${g.attributes.length}`, g.activeFrom ? `🔒 ${icon(g.activeFrom)}` : ''], _: g })).sort(byKey)
    case 'attributes': return m.attributes.map(a => ({ key: a.key, label: a.label?.de, right: [TYPE_SYM[a.type] ?? a.type, a.pattern ? '⌗' : '', a.multiple ? '≣' : '', a.perLocale ? '🗣' : '', a.perChannel ? '⇶' : '', a.group ? '▤ ' + a.group : ''], _: a })).sort(byKey)
    case 'lists': return m.lists.map(l => ({ key: l.key, label: l.label?.de, right: [`☰ ${l.values.length}`], _: l })).sort(byKey)
    case 'views': return (m.views ?? []).map(v => ({ key: v.key, label: v.label?.de, right: [icon(v.level), `▤ ${v.items.length}`], _: v })).sort(byKey)
    case 'units': return (m.units ?? []).map(u => ({ key: u.key, label: u.label?.de, right: [u.quantity, `× ${u.factor}`], _: u })).sort(byKey)
    case 'relationTypes': return (m.relationTypes ?? []).map(r => ({ key: r.key, label: r.label?.de, right: [(r.from ?? roles).map(icon).join('') + (r.symmetric ? '⇄' : '→') + (r.to ?? roles).map(x => x === 'media' ? '🖼' : icon(x)).join(''), r.group ? '▤ ' + r.group : ''], _: r })).sort(byKey)
    case 'locales': return m.locales.map(l => ({ key: l.code, label: l.label, right: [m.masterLocale === l.code ? '★ Master' : ''] }))
    case 'channels': return m.channels.map(c => ({ key: c.key, label: c.label?.de, right: [] }))
  }
  return []
})
// Suche (Text) und Filter (Eigenschaften) zusammen
function passes(r) {
  const f = flt.value, x = r._ ?? {}
  switch (section.value) {
    case 'attributes':
      return (f.group === '' || (f.group === '-' ? !x.group : x.group === f.group)) && (!f.type || x.type === f.type)
        && (!f.locale || x.perLocale) && (!f.channel || x.perChannel) && (!f.multiple || x.multiple)
    case 'groups': return f.activeFrom === '' || (f.activeFrom === '-' ? !x.activeFrom : x.activeFrom === f.activeFrom)
    case 'views': return !f.level || x.level === f.level
    case 'units': return !f.quantity || x.quantity === f.quantity
  }
  return true
}
const shown = computed(() => { const f = filter.value.trim().toLowerCase(); return rows.value.filter(r => passes(r) && (!f || r.key.includes(f) || (r.label ?? '').toLowerCase().includes(f))) })
const filtered = computed(() => Object.entries(flt.value).some(([, v]) => v !== '' && v !== false))
const quantities = computed(() => [...new Set((model.value?.units ?? []).map(u => u.quantity))].sort())
function pick(e, r) {
  const keys = shown.value.map(x => x.key), k = r.key
  const s = new Set(sel.value)
  if (e.shiftKey && anchor.value != null) {
    const a = keys.indexOf(anchor.value), b = keys.indexOf(k)
    if (a >= 0 && b >= 0) { if (!e.ctrlKey) s.clear(); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) s.add(keys[i]) }
  } else if (e.ctrlKey || e.metaKey) { s.has(k) ? s.delete(k) : s.add(k); anchor.value = k }
  else { s.clear(); s.add(k); anchor.value = k }
  sel.value = s; cur.value = k
}
function onListKey(e) {
  const keys = shown.value.map(x => x.key); const i = keys.indexOf(cur.value)
  if (e.key === 'ArrowDown' && i < keys.length - 1) { e.preventDefault(); pick({}, shown.value[i + 1]) }
  else if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); pick({}, shown.value[i - 1]) }
}
const count = computed(() => sel.value.size)
const many = computed(() => sel.value.size > 1)

// ---- Das gewählte Ding
const curGroup = computed(() => (model.value?.groups ?? []).find(g => g.key === cur.value) ?? null)
const curAttr = computed(() => model.value?.attributes.find(a => a.key === cur.value) ?? null)
const curList = computed(() => model.value?.lists.find(l => l.key === cur.value) ?? null)
const curView = computed(() => (model.value?.views ?? []).find(v => v.key === cur.value) ?? null)
const curUnit = computed(() => (model.value?.units ?? []).find(u => u.key === cur.value) ?? null)
const curRel = computed(() => (model.value?.relationTypes ?? []).find(r => r.key === cur.value) ?? null)
function relSet(col, v) {
  const r = { ...curRel.value, label: { ...(curRel.value.label || {}) }, reverse: { ...(curRel.value.reverse || {}) } }
  if (col.startsWith('label_')) r.label[col.slice(6)] = v
  else if (col.startsWith('reverse_')) r.reverse[col.slice(8)] = v
  else if (col.startsWith('from_') || col.startsWith('to_')) {
    const [side, role] = col.split('_'); const all = side === 'to' ? [...roles, 'media'] : roles; const cur = new Set(r[side] ?? all)
    v ? cur.add(role) : cur.delete(role)
    r[side] = cur.size === all.length ? null : all.filter(x => cur.has(x))
  } else r[col] = v
  put(`/api/model/relations/${r.key}`, r)
}
const curLocale = computed(() => model.value?.locales.find(l => l.code === cur.value) ?? null)
const curChannel = computed(() => model.value?.channels.find(c => c.key === cur.value) ?? null)
const b = v => v ? 'true' : 'false'

// ---- Attributgruppen
const groupSet = (col, v) => {
  const g = curGroup.value
  const d = { key: g.key, label: { ...(g.label || {}) }, activeFrom: g.activeFrom ?? null }
  if (col.startsWith('label_')) d.label[col.slice(6)] = v; else if (col === 'activeFrom') d.activeFrom = v || null
  put(`/api/model/groups/${g.key}`, d)
}
const groupAttrs = computed(() => (model.value?.attributes ?? []).filter(a => a.group === curGroup.value?.key))
const otherAttrs = computed(() => (model.value?.attributes ?? []).filter(a => a.group !== curGroup.value?.key).sort((x, y) => (x.group ?? '').localeCompare(y.group ?? '') || x.key.localeCompare(y.key)))
function assign(a, gkey) { return put(`/api/model/attributes/${a.key}`, { ...a, group: gkey }) }
// Zuordnen in der Masse (Taloan: nicht hunderte einzeln im Dropdown): Filter nach Text und Herkunft
// (ohne Gruppe / eine Gruppe), Haken, dann alle Gehakten in einem Rutsch.
const pickText = ref('')
const pickFrom = ref('')            // '' = alle, '-' = ohne Gruppe, sonst Gruppenschlüssel
const picked = ref(new Set())
const pickRows = computed(() => {
  const f = pickText.value.trim().toLowerCase()
  return otherAttrs.value.filter(a => (pickFrom.value === '' || (pickFrom.value === '-' ? !a.group : a.group === pickFrom.value))
    && (!f || a.key.includes(f) || (a.label?.de ?? '').toLowerCase().includes(f)))
})
const pickSources = computed(() => {
  const n = new Map()
  for (const a of otherAttrs.value) n.set(a.group ?? '-', (n.get(a.group ?? '-') ?? 0) + 1)
  return [...n].sort((x, y) => (x[0] === '-' ? -1 : y[0] === '-' ? 1 : x[0].localeCompare(y[0])))
})
function togglePick(k) { const s = new Set(picked.value); s.has(k) ? s.delete(k) : s.add(k); picked.value = s }
async function assignPicked() {
  const g = curGroup.value?.key; if (!g) return
  for (const a of model.value.attributes.filter(x => picked.value.has(x.key))) await assign(a, g)
  picked.value = new Set()
}
watch(cur, () => { picked.value = new Set() })
function goto(s, k) { switchTo(s); cur.value = k; sel.value = new Set([k]) }

// ---- Attribute
function attrWith(a0, col, v) {
  const a = { ...a0, label: { ...(a0.label || {}) }, required: { ...(a0.required || {}) } }
  if (col === 'label_de') a.label.de = v
  else if (col === 'label_en') a.label.en = v
  else if (col === 'locale' || col === 'channel') { const axes = new Set(a.axes || []); v ? axes.add(col) : axes.delete(col); a.axes = [...axes] }
  else if (col === 'columns') a.columns = v.split(',').map(s => s.trim()).filter(Boolean)
  else if (col.startsWith('req_')) { const l = v.split(',').map(s => s.trim()).filter(Boolean); if (l.length) a.required[col.slice(4)] = l; else delete a.required[col.slice(4)] }
  else if (col.startsWith('lv_')) {
    const lv = new Set(a.levels ?? roles)
    v ? lv.add(col.slice(3)) : lv.delete(col.slice(3))
    a.levels = lv.size === roles.length ? null : roles.filter(x => lv.has(x))
  } else a[col] = v
  return a
}
const attrSet = (col, v) => put(`/api/model/attributes/${curAttr.value.key}`, attrWith(curAttr.value, col, v))
async function bulkAssignGroup() {
  const g = bulkGroup.value; if (!g) return
  for (const a of model.value.attributes.filter(x => sel.value.has(x.key))) await put(`/api/model/attributes/${a.key}`, attrWith(a, 'group', g))
  bulkGroup.value = ''
}
const removePath = {
  groups: k => `/api/model/groups/${k}`, attributes: k => `/api/model/attributes/${k}`, lists: null,
  views: k => `/api/model/views/${k}`, units: k => `/api/model/units/${encodeURIComponent(k)}`, locales: null, channels: null,
  relationTypes: k => `/api/model/relations/${k}`,
}
async function bulkRemove() {
  const p = removePath[section.value]; if (!p) return
  if (!window.confirm(`${sel.value.size} ${sec.value.label} zurückziehen?`)) return
  for (const k of [...sel.value]) await del(p(k))
  sel.value = new Set(); cur.value = null
}
async function removeCur() {
  const p = removePath[section.value]; if (!p || !cur.value) return
  if (!window.confirm(`${sec.value.one} ${cur.value} zurückziehen?`)) return
  await del(p(cur.value)); cur.value = null; sel.value = new Set()
}

// ---- Anlegen je Abschnitt
function add() {
  const k = newKey.value.trim(); if (!k) return
  newKey.value = ''
  const s = section.value
  if (s === 'groups') put(`/api/model/groups/${k}`, { key: k, label: {}, activeFrom: null })
  else if (s === 'attributes') put(`/api/model/attributes/${k}`, { key: k, label: {}, type: 'text' })
  else if (s === 'lists') put(`/api/model/lists/${k}`, { key: k, label: {} })
  else if (s === 'views') put(`/api/model/views/${k}`, { key: k, label: {}, level: 'product', items: [] })
  else if (s === 'units') put(`/api/model/units/${encodeURIComponent(k)}`, { key: k, label: {}, quantity: 'other', factor: 1 })
  else if (s === 'relationTypes') put(`/api/model/relations/${k}`, { key: k, label: {}, reverse: {} })
  else if (s === 'locales') put(`/api/model/locales/${k}`, { code: k, label: '' })
  else if (s === 'channels') put(`/api/model/channels/${k}`, { key: k, label: {} })
  cur.value = k; sel.value = new Set([k])
}
const addPlaceholder = { relationTypes: 'neuer Relationstyp (key)', groups: 'neue Gruppe (key)', attributes: 'neuer key (a-z, 0-9, _)', lists: 'neue Werteliste (key)', views: 'neue Sicht (key)', units: 'z. B. oz', locales: 'code, z. B. fr', channels: 'key, z. B. app' }

// ---- Wertelisten: Einträge mit Namen je Sprache und eigenen Spalten (Farbe: ral)
function listSet(col, v) {
  const l = curList.value
  const d = { key: l.key, label: { ...(l.label || {}) }, columns: l.columns ?? [] }
  if (col.startsWith('label_')) d.label[col.slice(6)] = v
  else if (col === 'columns') d.columns = v.split(',').map(s => s.trim()).filter(Boolean)
  put(`/api/model/lists/${l.key}`, d)
}
const valueCols = computed(() => [{ key: 'value', label: 'Wert', type: 'ro', width: '120px' }, { key: 'label_de', label: 'de', width: '180px' }, { key: 'label_en', label: 'en', width: '180px' },
  ...(curList.value?.columns ?? []).map(c => ({ key: 'x_' + c, label: c, width: '110px' })), { key: 'order', label: '#', width: '50px' }])
const valueRows = computed(() => (curList.value?.values ?? []).map(v => { const r = { value: v.value, label_de: v.label?.de, label_en: v.label?.en, order: String(v.order ?? 0), _v: v }; for (const c of curList.value.columns ?? []) r['x_' + c] = v.extra?.[c]; return r }))
function valueChange(r, col, v) {
  const d = { ...r._v, label: { ...(r._v.label || {}) }, extra: { ...(r._v.extra || {}) } }
  if (col.startsWith('label_')) d.label[col.slice(6)] = v
  else if (col.startsWith('x_')) { if (v) d.extra[col.slice(2)] = v; else delete d.extra[col.slice(2)] }
  else if (col === 'order') d.order = parseInt(v) || 0
  put(`/api/model/lists/${curList.value.key}/values/${encodeURIComponent(r.value)}`, d)
}
function valueAdd() {
  const v = newValue.value.trim(); if (!v || !curList.value) return
  newValue.value = ''
  put(`/api/model/lists/${curList.value.key}/values/${encodeURIComponent(v)}`, { value: v, label: {}, order: valueRows.value.length + 1 })
}

// ---- Attributsichten: je Knotentyp, Gruppen in Reihenfolge, darin Attribute in Reihenfolge (Drag & Drop)
const viewItems = computed(() => curView.value?.items ?? [])
const dragging = ref(null)   // { group } | { group, key }
function viewSet(col, v) {
  const d = { ...curView.value, label: { ...(curView.value.label || {}) } }
  if (col.startsWith('label_')) d.label[col.slice(6)] = v; else if (col === 'level') d.level = v
  put(`/api/model/views/${curView.value.key}`, d)
}
const saveItems = items => put(`/api/model/views/${curView.value.key}`, { ...curView.value, items })
function viewGroupAdd() { const g = addViewGroup.value; if (!g) return; addViewGroup.value = ''; saveItems([...viewItems.value, { group: g }]) }
function viewGroupRemove(g) { saveItems(viewItems.value.filter(it => it.group !== g)) }
function viewFillAll() { saveItems((model.value.groups ?? []).filter(g => activeAt(g, curView.value.level)).map(g => ({ group: g.key }))) }
// Gruppen, die noch nicht in der Sicht sind: erst die am Knotentyp der Sicht aktiven, dann die gesperrten (aktiv erst tiefer).
const DEPTH = { group: 0, product: 1, variant: 2 }
const activeAt = (g, role) => !g.activeFrom || DEPTH[role] >= DEPTH[g.activeFrom]
const freeViewGroups = computed(() => {
  const free = (model.value.groups ?? []).filter(g => !viewItems.value.some(it => it.group === g.key))
  const level = curView.value?.level
  return [...free.filter(g => activeAt(g, level)).map(g => ({ key: g.key, locked: false })),
          ...free.filter(g => !activeAt(g, level)).map(g => ({ key: g.key, locked: true, from: g.activeFrom }))]
})
// Attribute einer Gruppe in der Reihenfolge der Sicht; neu zugeordnete hängen unten an.
function orderedAttrs(it) {
  const all = model.value.groups.find(g => g.key === it.group)?.attributes ?? []
  const order = (it.order ?? []).filter(k => all.includes(k))
  return [...order, ...all.filter(k => !order.includes(k))]
}
function onDragStart(e, what) { dragging.value = what; e.dataTransfer.effectAllowed = 'move' }
function onDragOver(e) { if (dragging.value) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' } }
// Gruppe auf Gruppe: davor. Attribut auf Attribut derselben Gruppe: davor (Reihenfolge in der Sicht).
function onDrop(target) {
  const d = dragging.value; dragging.value = null
  if (!d) return
  if (d.key === undefined) {
    if (target.group === d.group) return
    const items = viewItems.value.filter(it => it.group !== d.group)
    const i = items.findIndex(it => it.group === target.group)
    items.splice(i < 0 ? items.length : i, 0, viewItems.value.find(it => it.group === d.group))
    saveItems(items)
  } else {
    if (target.key === undefined || target.group !== d.group || target.key === d.key) return
    const items = viewItems.value.map(it => {
      if (it.group !== d.group) return it
      const order = orderedAttrs(it).filter(k => k !== d.key)
      order.splice(order.indexOf(target.key), 0, d.key)
      return { group: it.group, order }
    })
    saveItems(items)
  }
}

// ---- Einheiten, Sprachen, Kanäle
function unitSet(col, v) {
  const u = { ...curUnit.value, label: { ...(curUnit.value.label || {}) } }
  if (col.startsWith('label_')) u.label[col.slice(6)] = v
  else if (col === 'factor') u.factor = parseFloat(v.replace(',', '.')) || 1
  else u[col] = v
  put(`/api/model/units/${encodeURIComponent(u.key)}`, u)
}
const localeSet = v => put(`/api/model/locales/${curLocale.value.code}`, { code: curLocale.value.code, label: v })
const setMaster = () => put('/api/model/master-locale', { code: curLocale.value.code })
const channelSet = (l, v) => put(`/api/model/channels/${curChannel.value.key}`, { key: curChannel.value.key, label: { ...(curChannel.value.label || {}), [l]: v } })
// Hilfe zur Formel — ein Skript wie JavaScript (Taloan, 17.09.)
const groupLabel = k => model.value.groups.find(g => g.key === k)?.label?.de || k
const attrLabel = k => model.value.attributes.find(a => a.key === k)?.label?.de || k
</script>

<template>
  <div class="pane" style="width:190px;flex:none">
    <div class="toolbar"><h1>⊞ Modell</h1></div>
    <div class="sections">
      <template v-for="part in ['Struktur', 'Basics']" :key="part">
        <div class="part">{{ part }}</div>
        <button v-for="s in sections.filter(x => x.part === part)" :key="s.key" class="section-btn" :class="{ active: section === s.key }" @click="switchTo(s.key)">
          <span class="icon">{{ s.icon }}</span> {{ s.label }}
          <span class="muted count">{{ model?.[s.key]?.length ?? '' }}</span>
        </button>
      </template>
    </div>
  </div>

  <!-- Mitte: die Liste -->
  <div class="pane" :style="`width:${listW}px;flex:none`" v-if="model">
    <div class="toolbar"><h1>{{ sec.icon }} {{ sec.label }}</h1><span class="muted">{{ shown.length }}</span><span class="muted" :title="sec.hint">ⓘ</span><span class="grow" /></div>
    <div class="toolbar" style="gap:4px">
      <input v-model="filter" type="search" placeholder="🔍 Suche in Key und Name" style="flex:1;min-width:0" />
      <input v-model="newKey" type="text" :placeholder="addPlaceholder[section]" style="width:130px" @keydown.enter="add" />
      <button class="primary" :disabled="!newKey.trim()" @click="add" title="anlegen">+</button>
    </div>
    <!-- Filter: Eigenschaften, je Abschnitt andere; leer = alles -->
    <div class="toolbar flt" v-if="['attributes', 'groups', 'views', 'units'].includes(section)">
      <template v-if="section === 'attributes'">
        <select v-model="flt.group" title="Gruppe"><option value="">▤ alle</option><option value="-">— ohne Gruppe</option><option v-for="g in model.groups" :key="g.key" :value="g.key">▤ {{ g.key }}</option></select>
        <select v-model="flt.type" title="Typ"><option value="">Typ</option><option v-for="t in TYPES" :key="t" :value="t">{{ TYPE_SYM[t] }} {{ t }}</option></select>
        <button :class="{ primary: flt.locale }" @click="flt.locale = !flt.locale" title="nur je Sprache">🗣</button>
        <button :class="{ primary: flt.channel }" @click="flt.channel = !flt.channel" title="nur je Kanal">⇶</button>
        <button :class="{ primary: flt.multiple }" @click="flt.multiple = !flt.multiple" title="nur mehrfach">≣</button>
      </template>
      <select v-else-if="section === 'groups'" v-model="flt.activeFrom" title="aktiv ab"><option value="">🔒 alle</option><option value="-">überall aktiv</option><option v-for="r in roles" :key="r" :value="r">🔒 ab {{ roleLabel[r] }}</option></select>
      <select v-else-if="section === 'views'" v-model="flt.level" title="Knotentyp"><option value="">alle Knotentypen</option><option v-for="r in roles" :key="r" :value="r">{{ roleLabel[r] }}</option></select>
      <select v-else-if="section === 'units'" v-model="flt.quantity" title="Grösse"><option value="">alle Grössen</option><option v-for="q in quantities" :key="q" :value="q">{{ q }}</option></select>
      <span class="grow" />
      <button v-if="filtered" class="x" @click="resetFlt" title="Filter zurücksetzen">✗ {{ shown.length }}</button>
    </div>
    <div class="scroll list" tabindex="0" @keydown="onListKey">
      <div v-for="r in shown" :key="r.key" class="li" :class="{ selected: sel.has(r.key), current: cur === r.key }" @click="pick($event, r)" :title="r.key">
        <span class="k">{{ r.key }}</span>
        <span class="l">{{ r.label }}</span>
        <span class="r"><span v-for="(x, i) in r.right.filter(Boolean)" :key="i">{{ x }}</span></span>
      </div>
      <div v-if="!shown.length" class="empty">{{ filter ? 'Nichts zu „' + filter + '“' : 'Noch nichts — oben anlegen.' }}</div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px"><kbd>↑</kbd><kbd>↓</kbd> · <kbd>Shift</kbd>/<kbd>Strg</kbd>+Klick mehrere · {{ count }} gewählt</div>
  </div>

  <Splitter v-if="model" v-model="listW" :min="220" :max="800" />
  <!-- Rechts: das gewählte Ding -->
  <div class="pane" style="flex:1" v-if="model">
    <!-- Stapel -->
    <template v-if="many">
      <div class="toolbar"><h1>{{ count }} {{ sec.label }} gewählt</h1><span class="grow" /><button @click="sel = new Set()">keine</button></div>
      <div class="scroll">
        <div class="section">
          <div class="chips" v-if="section === 'attributes'">
            <select v-model="bulkGroup" style="width:220px"><option value="">▤ Gruppe zuweisen …</option><option v-for="g in model.groups" :key="g.key" :value="g.key">{{ g.label?.de || g.key }} · {{ g.key }}</option></select>
            <button class="primary" :disabled="!bulkGroup" @click="bulkAssignGroup">→ {{ count }}</button>
          </div>
          <div class="chips" style="margin-top:8px" v-if="removePath[section]"><button class="x" @click="bulkRemove">🗑 {{ count }} zurückziehen</button></div>
          <div class="chips" style="margin-top:8px"><span v-for="k in sel" :key="k" class="chip mono">{{ k }}</span></div>
        </div>
      </div>
    </template>

    <!-- Attributgruppe -->
    <template v-else-if="section === 'groups' && curGroup">
      <div class="toolbar"><h1>▤ {{ curGroup.label?.de || curGroup.key }}</h1><span class="mono muted">{{ curGroup.key }}</span><span class="grow" /><button class="x" @click="removeCur" :disabled="groupAttrs.length > 0" :title="groupAttrs.length ? 'hat noch Attribute' : 'Gruppe zurückziehen'">🗑</button></div>
      <div class="scroll">
        <table class="grid form"><colgroup><col style="width:150px" /><col style="width:260px" /></colgroup><tbody>
          <tr><td class="attr">Name de</td><Cell :value="curGroup.label?.de ?? null" @save="v => groupSet('label_de', v)" /></tr>
          <tr><td class="attr">Name en</td><Cell :value="curGroup.label?.en ?? null" @save="v => groupSet('label_en', v)" /></tr>
          <tr><td class="attr" title="ab welchem Knotentyp Werte erfasst werden; leer = überall. Darüber sichtbar, aber gesperrt.">🔒 aktiv ab</td><SelectCell :value="curGroup.activeFrom ?? ''" :options="roles" :label-of="k => roleLabel[k]" @save="v => groupSet('activeFrom', v)" /></tr>
        </tbody></table>
        <div class="section">
          <h2>⊞ Attribute: {{ groupAttrs.length }}</h2>
          <div class="chips">
            <span v-for="a in groupAttrs" :key="a.key" class="chip" :title="`${a.key} · ${a.type}${a.multiple ? ' ≣' : ''}${a.perLocale ? ' 🗣' : ''}`">
              <a href="#" @click.prevent="goto('attributes', a.key)">{{ a.label?.de || a.key }}</a>
              <button @click="assign(a, null)" title="aus der Gruppe nehmen — das Attribut bleibt, ohne Gruppe gilt es an keinem Knoten">×</button>
            </span>
          </div>
        </div>
        <div class="section">
          <h2>+ Attribute zuordnen <span class="muted">· {{ pickRows.length }} von {{ otherAttrs.length }}</span></h2>
          <div class="chips" style="margin-bottom:6px">
            <input v-model="pickText" type="search" placeholder="Filter" style="width:180px" />
            <select v-model="pickFrom" style="width:240px" title="Herkunft: ohne Gruppe oder aus welcher Gruppe">
              <option value="">alle Herkünfte</option>
              <option v-for="[g, n] in pickSources" :key="g" :value="g">{{ g === '-' ? '— ohne Gruppe' : '▤ ' + groupLabel(g) + ' · ' + g }} ({{ n }})</option>
            </select>
            <button @click="picked = new Set(pickRows.map(a => a.key))" :disabled="!pickRows.length">alle {{ pickRows.length }}</button>
            <button @click="picked = new Set()" :disabled="!picked.size">keine</button>
            <button class="primary" :disabled="!picked.size" @click="assignPicked">→ {{ picked.size }} zuordnen</button>
          </div>
          <div class="picker">
            <label v-for="a in pickRows" :key="a.key" class="pick" :class="{ on: picked.has(a.key) }">
              <input type="checkbox" :checked="picked.has(a.key)" @change="togglePick(a.key)" />
              <span class="l">{{ a.label?.de || a.key }}</span><span class="mono muted k">{{ a.key }}</span>
              <span class="muted r">{{ TYPE_SYM[a.type] ?? a.type }} {{ a.group ? '▤ ' + a.group : '— ohne Gruppe' }}</span>
            </label>
            <div v-if="!pickRows.length" class="empty">Nichts zu „{{ pickText }}“</div>
          </div>
        </div>
      </div>
    </template>

    <!-- Attribut -->
    <template v-else-if="section === 'attributes' && curAttr">
      <div class="toolbar"><h1>⊞ {{ curAttr.label?.de || curAttr.key }}</h1><span class="mono muted">{{ curAttr.key }}</span><span class="grow" /><button class="x" @click="removeCur" title="Attribut zurückziehen">🗑</button></div>
      <div class="scroll">
        <table class="grid form"><colgroup><col style="width:150px" /><col style="width:260px" /></colgroup><tbody>
          <tr><td class="attr">Name de</td><Cell :value="curAttr.label?.de ?? null" @save="v => attrSet('label_de', v)" /></tr>
          <tr><td class="attr">Name en</td><Cell :value="curAttr.label?.en ?? null" @save="v => attrSet('label_en', v)" /></tr>
          <tr><td class="attr">Typ</td><SelectCell :value="curAttr.type" :options="TYPES" :label-of="t => `${TYPE_SYM[t]} ${t}`" @save="v => attrSet('type', v)" /></tr>
          <tr><td class="attr" title="Gruppe in der Pflege — ohne Gruppe gilt das Attribut an keinem Knoten">▤ Gruppe</td><SelectCell :value="curAttr.group ?? ''" :options="model.groups.map(g => g.key)" :label-of="groupLabel" @save="v => attrSet('group', v || null)" /></tr>
          <tr v-if="curAttr.type === 'integer' || curAttr.type === 'decimal'"><td class="attr">⚖ Einheit</td><SelectCell :value="curAttr.unit ?? ''" :options="(model.units ?? []).map(u => u.key)" @save="v => attrSet('unit', v || null)" /></tr>
          <tr v-if="curAttr.type === 'enum'"><td class="attr">☰ Werteliste</td><SelectCell :value="curAttr.list ?? ''" :options="model.lists.map(l => l.key)" @save="v => attrSet('list', v || null)" /></tr>
          <tr v-if="curAttr.type === 'rows'"><td class="attr" title="Spalten, jede ein Attribut, kommagetrennt">≣ Spalten</td><Cell :value="(curAttr.columns ?? []).join(', ') || null" @save="v => attrSet('columns', v)" /></tr>
          <!-- nur, was zum Typ passt (Taloan, 17.09.): Muster bei Text; Einheit bei Zahlen; Werteliste bei enum; Spalten bei rows -->
          <tr v-if="curAttr.type === 'text'"><td class="attr" title="Muster als regulärer Ausdruck — jeder Wert muss ganz dazu passen">⌗ Muster</td><Cell :value="curAttr.pattern ?? null" @save="v => attrSet('pattern', v || null)" /></tr>
          <tr v-if="curAttr.type === 'text'"><td class="attr" title="ein übliches Muster einsetzen">⌗ Vorlage</td><SelectCell :value="''" :options="PATTERNS.map(p => p.key)" :label-of="k => PATTERNS.find(p => p.key === k)?.label ?? k" @save="k => { const p = PATTERNS.find(x => x.key === k); if (p) attrSet('pattern', p.re) }" /></tr>
          <tr v-if="curAttr.type === 'text' && curAttr.pattern"><td class="attr" title="steht in der Fehlermeldung statt des Musters">⌗ Hinweis</td><Cell :value="curAttr.patternHint ?? null" @save="v => attrSet('patternHint', v || null)" /></tr>
          <tr v-if="curAttr.type !== 'rows'"><td class="attr" title="Wert je Sprache">🗣 je Sprache</td><ToggleCell :value="b(curAttr.perLocale)" @save="v => attrSet('locale', v === 'true')" /></tr>
          <tr v-if="!['rows', 'formula'].includes(curAttr.type)"><td class="attr" title="Wert je Kanal">⇶ je Kanal</td><ToggleCell :value="b(curAttr.perChannel)" @save="v => attrSet('channel', v === 'true')" /></tr>
          <tr><td class="attr" title="Wert vererbt sich nach unten (Kategorie ja, Name nein)">↓ vererbbar</td><ToggleCell :value="b(curAttr.inheritable)" @save="v => attrSet('inheritable', v === 'true')" /></tr>
          <tr v-if="!['rows', 'formula', 'boolean', 'html'].includes(curAttr.type)"><td class="attr" title="mehrere Werte, kommagetrennt">≣ mehrfach</td><ToggleCell :value="b(curAttr.multiple)" @save="v => attrSet('multiple', v === 'true')" /></tr>
          <tr v-for="c in model.channels" :key="c.key"><td class="attr" :title="`Pflicht für Kanal ${c.key}: Sprachen kommagetrennt oder * für alle; leer = keine Pflicht`">● Pflicht {{ c.key }}</td><Cell :value="(curAttr.required?.[c.key] ?? []).join(',') || null" @save="v => attrSet('req_' + c.key, v)" /></tr>
          <tr v-for="r in roles" :key="r"><td class="attr" :title="`Ausnahme: an ${roleLabel[r]} setzbar (sonst gilt die Regel der Gruppe)`">{{ roleLabel[r] }}</td><ToggleCell :value="b(!curAttr.levels || curAttr.levels.includes(r))" @save="v => attrSet('lv_' + r, v === 'true')" /></tr>
        </tbody></table>
      </div>
    </template>

    <!-- Werteliste -->
    <template v-else-if="section === 'lists' && curList">
      <div class="toolbar"><h1>☰ {{ curList.label?.de || curList.key }}</h1><span class="mono muted">{{ curList.key }}</span><span class="muted">· {{ valueRows.length }}</span><span class="grow" />
        <input v-model="newValue" type="text" placeholder="neuer Wert" style="width:140px" @keydown.enter="valueAdd" /><button class="primary" :disabled="!newValue.trim()" @click="valueAdd">+ Wert</button></div>
      <div class="scroll">
        <table class="grid form"><colgroup><col style="width:150px" /><col style="width:260px" /></colgroup><tbody>
          <tr><td class="attr">Name de</td><Cell :value="curList.label?.de ?? null" @save="v => listSet('label_de', v)" /></tr>
          <tr><td class="attr">Name en</td><Cell :value="curList.label?.en ?? null" @save="v => listSet('label_en', v)" /></tr>
          <tr><td class="attr" title="eigene Felder je Eintrag, kommagetrennt (z. B. ral, hex)">Spalten</td><Cell :value="(curList.columns ?? []).join(', ') || null" @save="v => listSet('columns', v)" /></tr>
        </tbody></table>
        <EditGrid :columns="valueCols" :rows="valueRows" row-key="value" removable @change="valueChange" @remove="r => del(`/api/model/lists/${curList.key}/values/${encodeURIComponent(r.value)}`)" />
      </div>
    </template>

    <!-- Attributsicht -->
    <template v-else-if="section === 'views' && curView">
      <div class="toolbar"><h1>◫ {{ curView.label?.de || curView.key }}</h1><span class="mono muted">{{ curView.key }}</span><span class="grow" />
        <button @click="viewFillAll" title="alle am Knotentyp aktiven Gruppen">⇊ alle Gruppen</button>
        <select v-model="addViewGroup" style="width:190px"><option value="">▤ Gruppe …</option><option v-for="g in freeViewGroups" :key="g.key" :value="g.key">{{ g.locked ? '🔒 ' : '' }}{{ g.key }}{{ g.locked ? ' · ab ' + roleLabel[g.from] : '' }}</option></select>
        <button class="primary" :disabled="!addViewGroup" @click="viewGroupAdd">+ dazu</button>
        <button class="x" @click="removeCur" title="Sicht zurückziehen">🗑</button></div>
      <div class="scroll">
        <table class="grid form"><colgroup><col style="width:150px" /><col style="width:260px" /></colgroup><tbody>
          <tr><td class="attr">Name de</td><Cell :value="curView.label?.de ?? null" @save="v => viewSet('label_de', v)" /></tr>
          <tr><td class="attr">Name en</td><Cell :value="curView.label?.en ?? null" @save="v => viewSet('label_en', v)" /></tr>
          <tr><td class="attr" title="eine Sicht gilt für einen Knotentyp">Knotentyp</td><SelectCell :value="curView.level" :options="roles" :label-of="k => roleLabel[k]" @save="v => viewSet('level', v)" /></tr>
        </tbody></table>
        <div class="viewedit">
          <div class="muted" style="font-size:12px;margin-bottom:6px">▤ {{ viewItems.length }} Gruppen · Drag & Drop: Gruppen und Attribute darin</div>
          <div v-for="it in viewItems" :key="it.group" class="vgroup" draggable="true" @dragstart="onDragStart($event, { group: it.group })" @dragover="onDragOver" @drop="onDrop({ group: it.group })">
            <div class="vhead"><span class="handle">⋮⋮</span> ▤ {{ groupLabel(it.group) }} <span class="muted mono">{{ it.group }}</span>
              <span class="muted" v-if="model.groups.find(g => g.key === it.group)?.activeFrom"> · 🔒 ab {{ roleLabel[model.groups.find(g => g.key === it.group).activeFrom] }}</span>
              <span class="grow" /><button class="x" @click.stop="viewGroupRemove(it.group)">×</button></div>
            <div v-for="k in orderedAttrs(it)" :key="k" class="vattr" draggable="true" @dragstart.stop="onDragStart($event, { group: it.group, key: k })" @dragover="onDragOver" @drop.stop="onDrop({ group: it.group, key: k })">
              <span class="handle">⋮⋮</span> {{ attrLabel(k) }} <span class="muted mono">{{ k }}</span>
              <span v-if="!(it.order ?? []).includes(k)" class="muted" title="neu in der Gruppe — hängt unten an, bis du es einsortierst">· neu</span>
            </div>
          </div>
          <div v-if="!viewItems.length" class="empty">Leer — „⇊ alle Gruppen“ oder einzeln dazu, dann ziehen.</div>
        </div>
      </div>
    </template>

    <!-- Relationstyp -->
    <template v-else-if="section === 'relationTypes' && curRel">
      <div class="toolbar"><h1>⇄ {{ curRel.label?.de || curRel.key }}</h1><span class="mono muted">{{ curRel.key }}</span><span class="grow" /><button class="x" @click="removeCur" title="Relationstyp zurückziehen (nicht, solange es Relationen gibt)">🗑</button></div>
      <div class="scroll">
        <table class="grid form"><colgroup><col style="width:150px" /><col style="width:260px" /></colgroup><tbody>
          <tr><td class="attr">Name de</td><Cell :value="curRel.label?.de ?? null" @save="v => relSet('label_de', v)" /></tr>
          <tr><td class="attr">Name en</td><Cell :value="curRel.label?.en ?? null" @save="v => relSet('label_en', v)" /></tr>
          <tr><td class="attr" title="beidseitig: liest sich von beiden Enden gleich (verwandt), je Paar nur einmal. Einseitig: Lesart hin und zurück (hat Zubehör / ist Zubehör von).">⇄ beidseitig</td><ToggleCell :value="b(!!curRel.symmetric)" @save="v => relSet('symmetric', v === 'true')" /></tr>
          <tr v-if="!curRel.symmetric"><td class="attr" title="Bezeichnung vom Ziel aus gesehen („Zubehör von“)">← umgekehrt de</td><Cell :value="curRel.reverse?.de ?? null" @save="v => relSet('reverse_de', v)" /></tr>
          <tr v-if="!curRel.symmetric"><td class="attr">← umgekehrt en</td><Cell :value="curRel.reverse?.en ?? null" @save="v => relSet('reverse_en', v)" /></tr>
          <tr v-for="r in roles" :key="'f' + r"><td class="attr" :title="`darf von ${roleLabel[r]} ausgehen`">von {{ roleLabel[r] }}</td><ToggleCell :value="b(!curRel.from || curRel.from.includes(r))" @save="v => relSet('from_' + r, v === 'true')" /></tr>
          <tr v-for="r in [...roles, 'media']" :key="'t' + r"><td class="attr" :title="`darf zu ${roleLabel[r] ?? '🖼 Medium'} führen`">zu {{ roleLabel[r] ?? '🖼 Medium' }}</td><ToggleCell :value="b(!curRel.to || curRel.to.includes(r))" @save="v => relSet('to_' + r, v === 'true')" /></tr>
          <tr><td class="attr" title="Attributgruppe, deren Attribute an der Relation stehen (Menge, Slot …); ohne Gruppe hat die Relation keine Werte">▤ Werte aus Gruppe</td><SelectCell :value="curRel.group ?? ''" :options="model.groups.map(g => g.key)" :label-of="groupLabel" @save="v => relSet('group', v || null)" /></tr>
        </tbody></table>
        <div class="section muted" style="font-size:12px" v-if="curRel.group">⊞ an der Relation: {{ model.attributes.filter(a => a.group === curRel.group).map(a => a.label?.de || a.key).join(', ') || '— die Gruppe hat noch keine Attribute' }}</div>
      </div>
    </template>

    <!-- Einheit -->
    <template v-else-if="section === 'units' && curUnit">
      <div class="toolbar"><h1>⚖ {{ curUnit.key }}</h1><span class="grow" /><button class="x" @click="removeCur" title="Einheit zurückziehen (nicht, solange ein Attribut sie benutzt)">🗑</button></div>
      <div class="scroll">
        <table class="grid form"><colgroup><col style="width:150px" /><col style="width:260px" /></colgroup><tbody>
          <tr><td class="attr">Name de</td><Cell :value="curUnit.label?.de ?? null" @save="v => unitSet('label_de', v)" /></tr>
          <tr><td class="attr">Name en</td><Cell :value="curUnit.label?.en ?? null" @save="v => unitSet('label_en', v)" /></tr>
          <tr><td class="attr" title="mass, length, volume, data, count …">Grösse</td><Cell :value="curUnit.quantity ?? null" @save="v => unitSet('quantity', v)" /></tr>
          <tr><td class="attr" title="Faktor zur Basiseinheit der Grösse (Basis = 1)">× Basis</td><Cell :value="String(curUnit.factor)" @save="v => unitSet('factor', v)" /></tr>
        </tbody></table>
      </div>
    </template>

    <!-- Sprache -->
    <template v-else-if="section === 'locales' && curLocale">
      <div class="toolbar"><h1>🗣 {{ curLocale.code }}</h1><span v-if="model.masterLocale === curLocale.code" class="warn">★ Mastersprache</span><span class="grow" />
        <button v-if="model.masterLocale !== curLocale.code" class="primary" @click="setMaster" title="Pflichtfelder beim Anlegen werden in der Mastersprache erfasst; ändert sich dort ein sprachabhängiger Wert, gelten die anderen Sprachen als zu überarbeiten (⟳)">★ als Mastersprache</button></div>
      <div class="scroll">
        <table class="grid form"><colgroup><col style="width:150px" /><col style="width:260px" /></colgroup><tbody>
          <tr><td class="attr">Name</td><Cell :value="curLocale.label ?? null" @save="localeSet" /></tr>
        </tbody></table>
        <div class="section muted" style="font-size:12px">★ Mastersprache: {{ model.masterLocale ?? '—' }} · In ihr werden Pflichtfelder beim Anlegen erfasst. Wird dort ein sprachabhängiger Wert geändert, zeigen die anderen Sprachen ⟳ „zu überarbeiten“, bis sie nachgezogen sind; Änderungen in einer anderen Sprache lösen nichts aus.</div>
      </div>
    </template>

    <!-- Kanal -->
    <template v-else-if="section === 'channels' && curChannel">
      <div class="toolbar"><h1>⇶ {{ curChannel.key }}</h1></div>
      <div class="scroll">
        <table class="grid form"><colgroup><col style="width:150px" /><col style="width:260px" /></colgroup><tbody>
          <tr><td class="attr">Name de</td><Cell :value="curChannel.label?.de ?? null" @save="v => channelSet('de', v)" /></tr>
          <tr><td class="attr">Name en</td><Cell :value="curChannel.label?.en ?? null" @save="v => channelSet('en', v)" /></tr>
        </tbody></table>
      </div>
    </template>

    <div v-else class="empty">{{ sec.one }} links wählen — oder oben anlegen.</div>
  </div>
  <div v-else class="empty">Modell wird geladen …</div>
</template>

<style scoped>
.sections { display: flex; flex-direction: column; padding: 4px; gap: 2px; }
.part { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; padding: 8px 8px 2px; }
.section-btn { text-align: left; border: 0; background: none; padding: 6px 8px; border-radius: 4px; display: flex; gap: 6px; align-items: center; }
.section-btn:hover { background: var(--bg); }
.section-btn.active { background: var(--accent-soft); color: var(--accent); }
.section-btn .icon { width: 16px; text-align: center; }
.section-btn .count { margin-left: auto; font-size: 11px; }
.flt { gap: 4px; min-height: 30px; font-size: 12px; }
.flt select { max-width: 150px; }
/* Die Liste: eine Zeile je Ding — Key, Name, rechts die Kennzahlen als Symbole */
.list { outline: none; }
.li { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 8px; white-space: nowrap; cursor: default; user-select: none; }
.li:hover { background: var(--hover); }
.li.selected { background: var(--accent-soft); }
.li.current { box-shadow: inset 2px 0 0 var(--accent); }
.li .k { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: var(--muted); max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.li .l { overflow: hidden; text-overflow: ellipsis; }
.li .r { margin-left: auto; font-size: 11px; color: var(--muted); display: flex; gap: 6px; }
/* Das Formular rechts: Bezeichnung links, Wert rechts, dieselben Zellen wie im Knoten */
.form { width: auto; margin-bottom: 4px; }
.form td.attr { white-space: nowrap; color: var(--muted); }
.section { padding: 10px 8px; border-top: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600; }
.chip a { color: inherit; text-decoration: none; }
/* Auswahlliste zum Zuordnen: gefiltert, mit Haken, viele auf einmal */
.picker { max-height: 360px; overflow: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--pane); }
.pick { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 8px; white-space: nowrap; cursor: default; }
.pick:hover { background: var(--hover); }
.pick.on { background: var(--accent-soft); }
.pick .k { font-size: 12px; }
.pick .r { margin-left: auto; font-size: 11px; }
.x { border: 0; background: none; color: var(--muted); padding: 0 3px; }
.x:hover:not(:disabled) { color: var(--neg); }
.viewedit { padding: 6px 8px; }
.vgroup { border: 1px solid var(--line); border-radius: 6px; margin-bottom: 8px; background: var(--pane); }
.vhead { display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: var(--bg); font-weight: 600; cursor: grab; border-radius: 6px 6px 0 0; }
.vattr { display: flex; align-items: center; gap: 6px; padding: 4px 8px 4px 24px; cursor: grab; border-top: 1px solid var(--line); }
.vattr:hover, .vhead:hover { outline: 1px dashed var(--accent); }
.handle { color: var(--muted); }
</style>
