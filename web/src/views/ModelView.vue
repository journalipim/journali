<script setup>
// Das Modell (Taloans Struktur, 17.09.2026):
//   Struktur: Attributgruppen · Attribute · Wertelisten · Attributsichten
//   Basics:   Einheiten · Sprachen · Kanäle · Baum (Name je Knotentyp)
// Jede Zelle ein Eintrag mit der ganzen Definition. Mehrfachauswahl: Shift/Strg,
// alle/keine, dann Stapelaktionen (Gruppe zuweisen, entfernen).
import { ref, computed } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import EditGrid from '../components/EditGrid.vue'

const sections = [
  { key: 'groups', icon: '▤', label: 'Attributgruppen', part: 'Struktur' },
  { key: 'attributes', icon: '⊞', label: 'Attribute', part: 'Struktur' },
  { key: 'lists', icon: '☰', label: 'Wertelisten', part: 'Struktur' },
  { key: 'views', icon: '◫', label: 'Attributsichten', part: 'Struktur' },
  { key: 'units', icon: '⚖', label: 'Einheiten', part: 'Basics' },
  { key: 'locales', icon: '🗣', label: 'Sprachen', part: 'Basics' },
  { key: 'channels', icon: '⇶', label: 'Kanäle', part: 'Basics' },
]
const section = ref('attributes')
const model = computed(() => store.model)
const newKey = ref('')
const selectedList = ref(null)
const selectedView = ref(null)
const selectedGroup = ref(null)
const newValue = ref('')
const addViewGroup = ref('')
const sel = ref(new Set())          // Mehrfachauswahl im aktuellen Gitter
const bulkGroup = ref('')
const roleLabel = { group: '▣ Produktgruppe', product: '▦ Produkt', variant: '◆ Variante' }
const roles = ['group', 'product', 'variant']

async function send(fn) {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  try { await fn(); await store.poll(true) } catch (e) { store.toast(e.message) }
}
const put = (path, body) => send(() => api.post(path, body, 'PUT'))
const del = path => send(() => api.del(path))
function switchTo(k) { section.value = k; sel.value = new Set() }
const count = computed(() => sel.value.size)

// ---- Attributgruppen
const groupCols = [{ key: 'key', label: 'Gruppe', type: 'ro', width: '130px' }, { key: 'label_de', label: 'Name de' }, { key: 'label_en', label: 'Name en' },
  { key: 'activeFrom', label: 'aktiv ab', type: 'select', options: roles, labelOf: k => roleLabel[k] ?? k, width: '150px', title: 'ab welchem Knotentyp Werte erfasst werden; leer = überall. Darüber sichtbar, aber gesperrt.' },
  { key: 'count', label: '#', type: 'ro', width: '40px' }, { key: 'defined', label: '', type: 'ro', width: '60px' }]
const groupRows = computed(() => (model.value.groups ?? []).map(g => ({ key: g.key, label_de: g.label?.de, label_en: g.label?.en, activeFrom: g.activeFrom ?? '', count: String(g.attributes.length), defined: g.defined ? '' : 'nur Verweis', _g: g })))
function groupChange(r, col, v) {
  const g = r._g
  const d = { key: r.key, label: { ...(g.label || {}) }, activeFrom: g.activeFrom ?? null }
  if (col.startsWith('label_')) d.label[col.slice(6)] = v
  else if (col === 'activeFrom') d.activeFrom = v || null
  put(`/api/model/groups/${r.key}`, d)
}
function groupAdd() {
  const k = newKey.value.trim(); if (!k) return
  newKey.value = ''
  put(`/api/model/groups/${k}`, { key: k, label: {}, activeFrom: null })
}

// ---- Attribute
const attrCols = computed(() => [
  { key: 'key', label: 'Key', type: 'ro', width: '130px' },
  { key: 'label_de', label: 'Name de' },
  { key: 'label_en', label: 'Name en' },
  { key: 'type', label: 'Typ', type: 'select', options: model.value.types, width: '100px' },
  { key: 'unit', label: 'Einheit', type: 'select', options: (model.value.units ?? []).map(u => u.key), width: '70px', title: 'nur bei Zahlen; Einheiten unter ⚖' },
  { key: 'group', label: 'Gruppe', type: 'select', options: (model.value.groups ?? []).map(g => g.key), width: '120px', title: 'Attributgruppe (▤)' },
  { key: 'locale', label: '🗣', type: 'bool', width: '34px', title: 'je Sprache' },
  { key: 'channel', label: '⇶', type: 'bool', width: '34px', title: 'je Kanal' },
  { key: 'inheritable', label: '↓', type: 'bool', width: '34px', title: 'vererbbar: der Wert gilt nach unten (Kategorie ja, Name nein)' },
  { key: 'list', label: 'Werteliste', type: 'select', options: model.value.lists.map(l => l.key), width: '110px', title: 'bei enum: der Wert ist ein Eintrag der Liste' },
  { key: 'multiple', label: '≣', type: 'bool', width: '34px', title: 'mehrfach' },
  ...model.value.channels.map(c => ({ key: 'req_' + c.key, label: '● ' + c.key, width: '70px', title: `Pflicht für ${c.key}: Sprachen kommagetrennt oder * — gilt überall gleich` })),
  { key: 'columns', label: 'Spalten', width: '140px', title: 'bei rows: Attribute, kommagetrennt' },
  { key: 'lv_group', label: '▣', type: 'bool', width: '34px', title: 'Ausnahme: an Produktgruppen setzbar' },
  { key: 'lv_product', label: '▦', type: 'bool', width: '34px', title: 'Ausnahme: an Produkten setzbar' },
  { key: 'lv_variant', label: '◆', type: 'bool', width: '34px', title: 'Ausnahme: an Varianten setzbar' },
])
const attrRows = computed(() => model.value.attributes.map(a => {
  const r = { key: a.key, label_de: a.label?.de, label_en: a.label?.en, type: a.type, unit: a.unit, group: a.group,
    locale: a.perLocale, channel: a.perChannel, inheritable: !!a.inheritable, list: a.list, multiple: a.multiple, columns: (a.columns ?? []).join(', '),
    lv_group: !a.levels || a.levels.includes('group'), lv_product: !a.levels || a.levels.includes('product'), lv_variant: !a.levels || a.levels.includes('variant'), _a: a }
  for (const c of model.value.channels) r['req_' + c.key] = (a.required?.[c.key] || []).join(',')
  return r
}))
function attrDef(r, col, v) {
  const a = { ...r._a, label: { ...(r._a.label || {}) }, required: { ...(r._a.required || {}) } }
  if (col === 'label_de') a.label.de = v
  else if (col === 'label_en') a.label.en = v
  else if (col === 'locale' || col === 'channel') { const axes = new Set(a.axes || []); v ? axes.add(col) : axes.delete(col); a.axes = [...axes] }
  else if (col === 'columns') a.columns = v.split(',').map(s => s.trim()).filter(Boolean)
  else if (col.startsWith('req_')) { const l = v.split(',').map(s => s.trim()).filter(Boolean); if (l.length) a.required[col.slice(4)] = l; else delete a.required[col.slice(4)] }
  else if (col.startsWith('lv_')) {
    const all = ['group', 'product', 'variant']; const lv = new Set(a.levels ?? all)
    v ? lv.add(col.slice(3)) : lv.delete(col.slice(3))
    a.levels = lv.size === all.length ? null : all.filter(x => lv.has(x))
  } else a[col] = v
  return a
}
const attrChange = (r, col, v) => put(`/api/model/attributes/${r.key}`, attrDef(r, col, v))
function attrAdd() {
  const k = newKey.value.trim(); if (!k) return
  newKey.value = ''
  put(`/api/model/attributes/${k}`, { key: k, label: {}, type: 'text' })
}
// Stapel: allen gewählten eine Gruppe geben / entfernen
async function bulkAssignGroup() {
  const g = bulkGroup.value; if (!g) return
  for (const r of attrRows.value.filter(x => sel.value.has(x.key))) await put(`/api/model/attributes/${r.key}`, attrDef(r, 'group', g))
  bulkGroup.value = ''
}
async function bulkRemove(path) {
  if (!window.confirm(`${sel.value.size} Einträge zurückziehen?`)) return
  for (const k of [...sel.value]) await del(path(k))
  sel.value = new Set()
}
const selectAll = rows => { sel.value = new Set(rows.map(r => r.key)) }

// ---- Wertelisten: Einträge mit Namen je Sprache und eigenen Spalten (Farbe: ral)
const listCols = [{ key: 'key', label: 'Key', type: 'ro', width: '130px' }, { key: 'label_de', label: 'Name de' }, { key: 'label_en', label: 'Name en' }, { key: 'columns', label: 'Spalten', width: '200px', title: 'eigene Felder je Eintrag, kommagetrennt (z. B. ral, hex)' }]
const listRows = computed(() => model.value.lists.map(l => ({ key: l.key, label_de: l.label?.de, label_en: l.label?.en, columns: (l.columns ?? []).join(', '), _l: l })))
const currentList = computed(() => model.value.lists.find(l => l.key === selectedList.value))
const valueCols = computed(() => [{ key: 'value', label: 'Wert', type: 'ro', width: '130px' }, { key: 'label_de', label: 'Name de' }, { key: 'label_en', label: 'Name en' },
  ...(currentList.value?.columns ?? []).map(c => ({ key: 'x_' + c, label: c, width: '120px' })), { key: 'order', label: '#', width: '50px' }])
const valueRows = computed(() => (currentList.value?.values ?? []).map(v => { const r = { value: v.value, label_de: v.label?.de, label_en: v.label?.en, order: String(v.order ?? 0), _v: v }; for (const c of currentList.value.columns ?? []) r['x_' + c] = v.extra?.[c]; return r }))
function listChange(r, col, v) {
  const d = { key: r.key, label: { ...(r._l.label || {}) }, columns: r._l.columns ?? [] }
  if (col.startsWith('label_')) d.label[col.slice(6)] = v
  else if (col === 'columns') d.columns = v.split(',').map(s => s.trim()).filter(Boolean)
  put(`/api/model/lists/${r.key}`, d)
}
function listAdd() {
  const k = newKey.value.trim(); if (!k) return
  newKey.value = ''
  put(`/api/model/lists/${k}`, { key: k, label: {} })
  selectedList.value = k
}
function valueChange(r, col, v) {
  const d = { ...r._v, label: { ...(r._v.label || {}) }, extra: { ...(r._v.extra || {}) } }
  if (col.startsWith('label_')) d.label[col.slice(6)] = v
  else if (col.startsWith('x_')) { if (v) d.extra[col.slice(2)] = v; else delete d.extra[col.slice(2)] }
  else if (col === 'order') d.order = parseInt(v) || 0
  put(`/api/model/lists/${selectedList.value}/values/${encodeURIComponent(r.value)}`, d)
}
function valueAdd() {
  const v = newValue.value.trim(); if (!v || !selectedList.value) return
  newValue.value = ''
  put(`/api/model/lists/${selectedList.value}/values/${encodeURIComponent(v)}`, { value: v, label: {}, order: valueRows.value.length + 1 })
}

// ---- Attributsichten: je Knotentyp, Gruppen in Reihenfolge, darin Attribute in Reihenfolge (Drag & Drop)
const viewCols = [{ key: 'key', label: 'Key', type: 'ro', width: '130px' }, { key: 'label_de', label: 'Name de' }, { key: 'label_en', label: 'Name en' },
  { key: 'level', label: 'Knotentyp', type: 'select', options: roles, labelOf: k => roleLabel[k] ?? k, width: '150px', title: 'eine Sicht gilt für einen Knotentyp' }]
const viewRows = computed(() => (model.value.views ?? []).map(v => ({ key: v.key, label_de: v.label?.de, label_en: v.label?.en, level: v.level, _v: v })))
const currentView = computed(() => (model.value.views ?? []).find(v => v.key === selectedView.value))
const viewItems = computed(() => currentView.value?.items ?? [])
const dragging = ref(null)   // { group } | { group, key }
function viewChange(r, col, v) {
  const d = { ...r._v, label: { ...(r._v.label || {}) } }
  if (col.startsWith('label_')) d.label[col.slice(6)] = v
  else if (col === 'level') d.level = v
  put(`/api/model/views/${r.key}`, d)
}
function viewAdd() {
  const k = newKey.value.trim(); if (!k) return
  newKey.value = ''
  put(`/api/model/views/${k}`, { key: k, label: {}, level: 'product', items: [] })
  selectedView.value = k
}
const saveItems = items => put(`/api/model/views/${currentView.value.key}`, { ...currentView.value, items })
function viewGroupAdd() { const g = addViewGroup.value; if (!g) return; addViewGroup.value = ''; saveItems([...viewItems.value, { group: g }]) }
function viewGroupRemove(g) { saveItems(viewItems.value.filter(it => it.group !== g)) }
function viewFillAll() { saveItems((model.value.groups ?? []).map(g => ({ group: g.key }))) }
const freeViewGroups = computed(() => (model.value.groups ?? []).map(g => g.key).filter(k => !viewItems.value.some(it => it.group === k)))
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

// ---- Einheiten
const unitCols = [{ key: 'key', label: 'Einheit', type: 'ro', width: '80px' }, { key: 'label_de', label: 'Name de' }, { key: 'label_en', label: 'Name en' }, { key: 'quantity', label: 'Grösse', width: '110px', title: 'mass, length, volume, data, count …' }, { key: 'factor', label: '× Basis', width: '90px', title: 'Faktor zur Basiseinheit der Grösse (Basis = 1)' }]
const unitRows = computed(() => (model.value.units ?? []).map(u => ({ key: u.key, label_de: u.label?.de, label_en: u.label?.en, quantity: u.quantity, factor: String(u.factor), _u: u })))
function unitChange(r, col, v) {
  const u = { ...r._u, label: { ...(r._u.label || {}) } }
  if (col.startsWith('label_')) u.label[col.slice(6)] = v
  else if (col === 'factor') u.factor = parseFloat(v.replace(',', '.')) || 1
  else u[col] = v
  put(`/api/model/units/${encodeURIComponent(r.key)}`, u)
}
function unitAdd() {
  const k = newKey.value.trim(); if (!k) return
  newKey.value = ''
  put(`/api/model/units/${encodeURIComponent(k)}`, { key: k, label: {}, quantity: 'other', factor: 1 })
}

// ---- Sprachen, Kanäle, Baum
const localeCols = [{ key: 'code', label: 'Code', type: 'ro', width: '80px' }, { key: 'label', label: 'Name' }]
const channelCols = [{ key: 'key', label: 'Kanal', type: 'ro', width: '100px' }, { key: 'label_de', label: 'Name de' }, { key: 'label_en', label: 'Name en' }]
const channelRows = computed(() => model.value.channels.map(c => ({ key: c.key, label_de: c.label?.de, label_en: c.label?.en, _c: c })))
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

  <div class="pane" style="flex:1" v-if="model">
    <!-- Attributgruppen -->
    <template v-if="section === 'groups'">
      <div class="toolbar">
        <h1>▤ Attributgruppen</h1>
        <span class="muted" title="Eine Gruppe bündelt Attribute und hängt an Baumknoten; ihre Definition vererbt sich nach unten. „aktiv ab“ sagt, ab welchem Knotentyp Werte erfasst werden.">ⓘ hängen an Knoten, Definition vererbt nach unten</span>
        <span class="grow" />
        <input v-model="newKey" type="text" placeholder="neue Gruppe (key)" style="width:160px" @keydown.enter="groupAdd" />
        <button class="primary" :disabled="!newKey.trim()" @click="groupAdd">+ Gruppe</button>
      </div>
      <div class="toolbar sel" v-if="count"><span>{{ count }} gewählt</span><button @click="sel = new Set()">keine</button><button class="x" @click="bulkRemove(k => `/api/model/groups/${k}`)">🗑 zurückziehen</button></div>
      <div class="scroll">
        <EditGrid :columns="groupCols" :rows="groupRows" :selection="sel" removable @selection="s => sel = s" @change="groupChange" @remove="r => del(`/api/model/groups/${r.key}`)" />
      </div>
    </template>

    <!-- Attribute -->
    <template v-else-if="section === 'attributes'">
      <div class="toolbar">
        <h1>⊞ Attribute</h1><span class="muted">{{ attrRows.length }}</span><span class="grow" />
        <input v-model="newKey" type="text" placeholder="neuer key (a-z, 0-9, _)" style="width:180px" @keydown.enter="attrAdd" />
        <button class="primary" :disabled="!newKey.trim()" @click="attrAdd">+ Attribut</button>
      </div>
      <div class="toolbar sel">
        <span class="muted">{{ count }} gewählt · <kbd>Shift</kbd>/<kbd>Strg</kbd>+Klick auf den Key</span>
        <button @click="selectAll(attrRows)">alle</button><button @click="sel = new Set()">keine</button>
        <template v-if="count">
          <span class="sep">·</span>
          <select v-model="bulkGroup" style="width:140px"><option value="">Gruppe zuweisen …</option><option v-for="g in model.groups" :key="g.key" :value="g.key">{{ g.key }}</option></select>
          <button class="primary" :disabled="!bulkGroup" @click="bulkAssignGroup">→ {{ count }}</button>
          <span class="sep">·</span>
          <button class="x" @click="bulkRemove(k => `/api/model/attributes/${k}`)">🗑 {{ count }} zurückziehen</button>
        </template>
      </div>
      <div class="scroll">
        <EditGrid :columns="attrCols" :rows="attrRows" :selection="sel" removable @selection="s => sel = s" @change="attrChange" @remove="r => del(`/api/model/attributes/${r.key}`)" />
      </div>
    </template>

    <!-- Wörterbücher -->
    <template v-else-if="section === 'lists'">
      <div class="toolbar">
        <h1>☰ Wertelisten</h1><span class="muted" title="Ein Attribut vom Typ enum zeigt auf einen Eintrag der Liste, nicht auf ein Wort. Der Eintrag hat Namen je Sprache und eigene Spalten (Farbe: ral) — wer die Liste erweitert, erweitert alle Verweise.">ⓘ referenzierte Einträge mit Namen je Sprache und eigenen Spalten</span><span class="grow" />
        <input v-model="newKey" type="text" placeholder="neue Werteliste (key)" style="width:160px" @keydown.enter="listAdd" />
        <button class="primary" :disabled="!newKey.trim()" @click="listAdd">+ Werteliste</button>
      </div>
      <div class="scroll" style="flex:0 0 auto;max-height:40%">
        <EditGrid :columns="listCols" :rows="listRows" :selected="selectedList" @change="listChange" @select="r => selectedList = r.key" />
      </div>
      <div class="toolbar" style="border-top:1px solid var(--line)">
        <h1 class="mono">{{ selectedList ?? '— Werteliste wählen' }}</h1><span class="muted">{{ valueRows.length }}</span><span class="grow" />
        <input v-model="newValue" type="text" placeholder="neuer Wert" style="width:160px" :disabled="!selectedList" @keydown.enter="valueAdd" />
        <button class="primary" :disabled="!newValue.trim() || !selectedList" @click="valueAdd">+ Wert</button>
      </div>
      <div class="toolbar sel" v-if="selectedList"><span class="muted">{{ count }} gewählt</span><button @click="selectAll(valueRows.map(v => ({ key: v.value })))">alle</button><button @click="sel = new Set()">keine</button><button v-if="count" class="x" @click="bulkRemove(k => `/api/model/lists/${selectedList}/values/${encodeURIComponent(k)}`)">🗑 {{ count }} zurückziehen</button></div>
      <div class="scroll">
        <EditGrid v-if="selectedList" :columns="valueCols" :rows="valueRows" row-key="value" :selection="sel" removable @selection="s => sel = s" @change="valueChange"
          @remove="r => del(`/api/model/lists/${selectedList}/values/${encodeURIComponent(r.value)}`)" />
      </div>
    </template>

    <!-- Attributsichten -->
    <template v-else-if="section === 'views'">
      <div class="toolbar">
        <h1>◫ Attributsichten</h1>
        <span class="muted" title="Je Knotentyp: welche Gruppen in welcher Reihenfolge, und darin die Attribute in welcher Reihenfolge — redaktionell, technisch, Preise, alles. Der Knoten zeigt in einer Sicht nur deren Gruppen; neu zugeordnete Attribute hängen unten an ihrer Gruppe. Im Knoten wählbar: alles oder eine Sicht dieses Typs.">ⓘ je Knotentyp: Gruppen und Attribute in Reihenfolge</span>
        <span class="grow" />
        <input v-model="newKey" type="text" placeholder="neue Sicht (key)" style="width:160px" @keydown.enter="viewAdd" />
        <button class="primary" :disabled="!newKey.trim()" @click="viewAdd">+ Sicht</button>
      </div>
      <div class="scroll" style="flex:0 0 auto;max-height:35%">
        <EditGrid :columns="viewCols" :rows="viewRows" :selected="selectedView" removable @change="viewChange" @select="r => selectedView = r.key" @remove="r => del(`/api/model/views/${r.key}`)" />
      </div>
      <div class="toolbar" style="border-top:1px solid var(--line)">
        <h1 class="mono">{{ selectedView ?? '— Sicht wählen' }}</h1><span class="muted">{{ viewItems.length }} Gruppen · Drag & Drop: Gruppen und Attribute darin</span><span class="grow" />
        <button v-if="currentView" @click="viewFillAll" title="alle Gruppen">⇊ alle Gruppen</button>
        <select v-model="addViewGroup" :disabled="!selectedView" style="width:150px"><option value="">▤ Gruppe …</option><option v-for="k in freeViewGroups" :key="k" :value="k">{{ k }}</option></select>
        <button class="primary" :disabled="!addViewGroup" @click="viewGroupAdd">+ dazu</button>
      </div>
      <div class="scroll viewedit">
        <div v-for="it in viewItems" :key="it.group" class="vgroup" draggable="true" @dragstart="onDragStart($event, { group: it.group })" @dragover="onDragOver" @drop="onDrop({ group: it.group })">
          <div class="vhead"><span class="handle">⋮⋮</span> ▤ {{ model.groups.find(g => g.key === it.group)?.label?.de || it.group }} <span class="muted mono">{{ it.group }}</span>
            <span class="muted" v-if="model.groups.find(g => g.key === it.group)?.activeFrom"> · aktiv ab {{ roleLabel[model.groups.find(g => g.key === it.group).activeFrom] }}</span>
            <span class="grow" /><button class="x" @click.stop="viewGroupRemove(it.group)">×</button></div>
          <div v-for="k in orderedAttrs(it)" :key="k" class="vattr" draggable="true" @dragstart.stop="onDragStart($event, { group: it.group, key: k })" @dragover="onDragOver" @drop.stop="onDrop({ group: it.group, key: k })">
            <span class="handle">⋮⋮</span> {{ model.attributes.find(a => a.key === k)?.label?.de || k }} <span class="muted mono">{{ k }}</span>
            <span v-if="!(it.order ?? []).includes(k)" class="muted" title="neu in der Gruppe — hängt unten an, bis du es einsortierst">· neu</span>
          </div>
        </div>
        <div v-if="selectedView && !viewItems.length" class="empty">Leer — „⇊ alle Gruppen“ oder einzeln dazu, dann ziehen.</div>
      </div>
    </template>

    <!-- Einheiten -->
    <template v-else-if="section === 'units'">
      <div class="toolbar">
        <h1>⚖ Einheiten</h1><span class="muted">je Grösse eine Basis mit Faktor 1; die Anzeige rechnet über den Faktor um</span><span class="grow" />
        <input v-model="newKey" type="text" placeholder="z. B. oz" style="width:100px" @keydown.enter="unitAdd" />
        <button class="primary" :disabled="!newKey.trim()" @click="unitAdd">+ Einheit</button>
      </div>
      <div class="scroll">
        <EditGrid :columns="unitCols" :rows="unitRows" removable @change="unitChange" @remove="r => del(`/api/model/units/${encodeURIComponent(r.key)}`)" />
      </div>
    </template>

    <!-- Sprachen -->
    <template v-else-if="section === 'locales'">
      <div class="toolbar">
        <h1>🗣 Sprachen</h1><span class="grow" />
        <input v-model="newKey" type="text" placeholder="code, z. B. fr" style="width:120px" @keydown.enter="put(`/api/model/locales/${newKey.trim()}`, { code: newKey.trim(), label: '' }); newKey = ''" />
        <button class="primary" :disabled="!newKey.trim()" @click="put(`/api/model/locales/${newKey.trim()}`, { code: newKey.trim(), label: '' }); newKey = ''">+ Sprache</button>
      </div>
      <div class="scroll">
        <EditGrid :columns="localeCols" :rows="model.locales" row-key="code" @change="(r, c, v) => put(`/api/model/locales/${r.code}`, { code: r.code, label: v })" />
      </div>
    </template>

    <!-- Kanäle -->
    <template v-else-if="section === 'channels'">
      <div class="toolbar">
        <h1>⇶ Kanäle</h1><span class="grow" />
        <input v-model="newKey" type="text" placeholder="key, z. B. amazon" style="width:140px" @keydown.enter="put(`/api/model/channels/${newKey.trim()}`, { key: newKey.trim(), label: {} }); newKey = ''" />
        <button class="primary" :disabled="!newKey.trim()" @click="put(`/api/model/channels/${newKey.trim()}`, { key: newKey.trim(), label: {} }); newKey = ''">+ Kanal</button>
      </div>
      <div class="scroll">
        <EditGrid :columns="channelCols" :rows="channelRows" @change="(r, c, v) => put(`/api/model/channels/${r.key}`, { key: r.key, label: { ...(r._c.label || {}), [c.slice(6)]: v } })" />
      </div>
    </template>

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
.toolbar.sel { font-size: 12px; gap: 6px; min-height: 30px; }
.x { border: 0; background: none; color: var(--muted); padding: 0 3px; }
.x:hover:not(:disabled) { color: var(--neg); }
.viewedit { padding: 6px 8px; }
.vgroup { border: 1px solid var(--line); border-radius: 6px; margin-bottom: 8px; background: var(--pane); }
.vhead { display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: var(--bg); font-weight: 600; cursor: grab; border-radius: 6px 6px 0 0; }
.vattr { display: flex; align-items: center; gap: 6px; padding: 4px 8px 4px 24px; cursor: grab; border-top: 1px solid var(--line); }
.vattr:hover, .vhead:hover { outline: 1px dashed var(--accent); }
.handle { color: var(--muted); }
</style>
