<script setup>
// Produktgruppe → … → Produkt → Variante als Baum links; Anlegen inline in
// der Werkzeugleiste; rechts der gewählte Knoten (NodeView). Tastatur: ↑↓
// wählen, → auf, ← zu, Enter öffnen, / Filter.
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api.js'
import { store } from '../store.js'
import { tree, icon } from '../tree.js'
import { menu } from '../menu.js'
import NodeView from './NodeView.vue'

const props = defineProps({ id: String })
const router = useRouter()
const q = ref('')
const search = ref(null)
const hits = ref(new Map())   // Server-Suche: id → Fundstelle
let searchTimer = null
const list = ref(null)
const creating = ref(null)     // null | 'group' | 'product' | 'variant'
const form = ref({})

onMounted(async () => { if (!tree.loaded) await tree.load(); reveal() })
// Der Pfad zum gewählten Knoten ist immer aufgeklappt.
function reveal() { if (props.id) for (const a of tree.ancestors(props.id)) tree.expand(a.id) }
watch(() => props.id, reveal)

const selected = computed(() => props.id ? tree.byId.get(props.id) : null)

// Filter: Label/SKU/Id sofort im Client, ab 2 Zeichen zusätzlich die Server-Suche über alle Werte.
watch(q, v => {
  clearTimeout(searchTimer)
  const s = v.trim()
  if (s.length < 2) { hits.value = new Map(); return }
  searchTimer = setTimeout(async () => {
    try { hits.value = new Map((await api.get(`/api/search?q=${encodeURIComponent(s)}`)).map(h => [h.row.id, h.hit])) }
    catch (e) { store.toast(e.message) }
  }, 250)
})

// Sichtbare Zeilen: aufgeklappt oder — mit Filter — alle Treffer samt Pfad.
const visible = computed(() => {
  const f = q.value.trim().toLowerCase()
  const out = []
  if (f) {
    const keep = new Set()
    for (const r of tree.rows)
      if (hits.value.has(r.id) || r.label.toLowerCase().includes(f) || (r.sku ?? '').toLowerCase().includes(f) || r.id.includes(f)) {
        keep.add(r.id)
        for (const a of tree.ancestors(r.id)) keep.add(a.id)
      }
    const walk = (parent, depth) => {
      for (const r of tree.kids(parent)) if (keep.has(r.id)) { out.push({ r, depth, open: true }); walk(r.id, depth + 1) }
    }
    walk(null, 0)
  } else {
    const walk = (parent, depth) => {
      for (const r of tree.kids(parent)) {
        const open = tree.expanded.has(r.id)
        out.push({ r, depth, open })
        if (open) walk(r.id, depth + 1)
      }
    }
    walk(null, 0)
  }
  return out
})

function open(row) { router.push(`/tree/${row.id}`) }

function onListKey(e) {
  const rows = visible.value
  const i = rows.findIndex(x => x.r.id === props.id)
  if (e.key === 'ArrowDown') { e.preventDefault(); const n = rows[Math.min(rows.length - 1, i + 1)]; if (n) open(n.r) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); const n = rows[Math.max(0, i - 1)]; if (n) open(n.r) }
  else if (e.key === 'ArrowRight' && i >= 0) { e.preventDefault(); tree.expand(rows[i].r.id) }
  else if (e.key === 'ArrowLeft' && i >= 0) {
    e.preventDefault()
    if (tree.expanded.has(rows[i].r.id)) tree.toggle(rows[i].r.id)
    else if (rows[i].r.parent) router.push(`/tree/${rows[i].r.parent}`)
  }
  else if (e.key === 'Delete' && i >= 0) { e.preventDefault(); retire(rows[i].r) }
  else if (e.key === 'Home' && rows.length) open(rows[0].r)
  else if (e.key === 'End' && rows.length) open(rows[rows.length - 1].r)
}
function countBelow(id) { let n = 0; for (const k of tree.kids(id)) n += 1 + countBelow(k.id); return n }
async function retire(r) {
  const below = countBelow(r.id)
  if (!window.confirm(below ? `${r.label} mit allen ${below} Knoten darunter zurückziehen?\n\nDas Journal behält alles; der Baum zeigt sie nicht mehr.` : `${r.label} zurückziehen?`)) return
  try {
    const res = await api.del(`/api/nodes/${encodeURIComponent(r.id)}${below ? '?recursive=true' : ''}`)
    if (res?.retired) store.toast(`${res.retired} Knoten zurückgezogen (Stapel ${res.batch})`, 'ok')
    await tree.load(); if (props.id === r.id || !tree.byId.has(props.id)) router.push(r.parent ? `/tree/${r.parent}` : '/tree')
  } catch (e) { store.toast(e.message) }
}
function expandAll(id) { tree.expand(id); for (const k of tree.kids(id)) expandAll(k.id) }
function collapseAll(id) { for (const k of tree.kids(id)) collapseAll(k.id); if (tree.expanded.has(id)) tree.toggle(id) }
async function setStatus(r, status) {
  try { await api.post(`/api/nodes/${encodeURIComponent(r.id)}/status`, { status }); await store.poll(true); await tree.load() } catch (e) { store.toast(e.message) }
}
// Rechtsklick: was man mit diesem Knoten tun kann — die Tastenkürzel gelten im Menü.
function contextMenu(e, r) {
  router.push(`/tree/${r.id}`)
  const kids = tree.kids(r.id).length
  const st = s => r.role !== 'group' && r.status !== s ? { label: s === 'draft' ? '○ Entwurf' : s === 'active' ? '● aktiv' : '✗ ausgelaufen', action: () => setStatus(r, s) } : null
  menu.open(e, [
    r.role === 'group' ? { label: 'Neue Gruppe darunter', icon: '▣', key: 'g', action: () => start('group') } : null,
    r.role === 'group' ? { label: 'Neues Produkt darunter', icon: '▦', key: 'p', disabled: !families.value.length, hint: families.value.length ? '' : 'keine Familie', action: () => start('product') } : null,
    r.role === 'product' ? { label: 'Neue Variante darunter', icon: '◆', key: 'v', action: () => start('variant') } : null,
    r.role === 'group' ? { label: 'Umbenennen', icon: '✎', key: 'u', hint: 'im Knoten', action: () => router.push(`/tree/${r.id}`) } : null,
    { sep: true },
    ...(r.role !== 'group' ? [st('draft'), st('active'), st('discontinued'), { sep: true }] : []),
    kids ? { label: 'Alles aufklappen', icon: '▾', key: 'a', action: () => expandAll(r.id) } : null,
    kids ? { label: 'Alles zuklappen', icon: '▸', key: 'z', action: () => collapseAll(r.id) } : null,
    { label: 'Id kopieren', icon: '⧉', key: 'i', hint: r.id, action: () => navigator.clipboard?.writeText(r.id) },
    { label: 'Im Journal zeigen', icon: '≡', key: 'j', action: () => router.push({ path: '/journal', query: { q: r.id } }) },
    { sep: true },
    { label: kids ? `Zurückziehen mit ${countBelow(r.id)} darunter` : 'Zurückziehen', icon: '🗑', key: 'Delete', danger: true, action: () => retire(r) },
  ])
}
function onGlobalKey(e) {
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) { e.preventDefault(); search.value?.focus() }
}
onMounted(() => window.addEventListener('keydown', onGlobalKey))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKey))

// ---- Anlegen: wo hängt es hin?
const groupTarget = computed(() => {
  let n = selected.value
  while (n && n.role !== 'group') n = tree.byId.get(n.parent)
  return n ?? null
})
const productTarget = computed(() => {
  let n = selected.value
  while (n && n.role !== 'product') n = tree.byId.get(n.parent)
  return n ?? null
})
const families = computed(() => store.model?.families ?? [])
const familyOf = key => families.value.find(f => f.key === key)
function attrDef(key) { return store.model?.attributes.find(a => a.key === key) }
function listValues(key) { const d = attrDef(key); return (store.model?.lists.find(l => l.key === d?.list)?.values ?? []) }

function start(kind) {
  creating.value = kind
  form.value = kind === 'group' ? { de: '', en: '' }
    : kind === 'product' ? { family: families.value[0]?.key ?? '', axes: [] }
    : Object.fromEntries((productTarget.value?.axes ?? []).map(a => [a, '']))
}
async function create() {
  const kind = creating.value
  try {
    let entry
    if (kind === 'group') entry = await api.post('/api/groups', { parent: groupTarget.value?.id ?? null, label: { de: form.value.de, en: form.value.en } })
    else if (kind === 'product') entry = await api.post('/api/products', { group: groupTarget.value.id, family: form.value.family, axes: form.value.axes })
    else entry = await api.post('/api/variants', { product: productTarget.value.id, axisValues: form.value })
    creating.value = null
    await tree.load()
    if (entry.payload.parent) tree.expand(entry.payload.parent)
    if (entry.payload.group) tree.expand(entry.payload.group)
    if (entry.payload.product) tree.expand(entry.payload.product)
    router.push(`/tree/${entry.stream}`)
  } catch (e) { store.toast(e.message) }
}
function toggleAxis(a) {
  const s = new Set(form.value.axes); s.has(a) ? s.delete(a) : s.add(a); form.value.axes = [...s]
}
</script>

<template>
  <div class="pane" style="width:300px;flex:none">
    <div class="toolbar">
      <h1>▣ Baum</h1>
      <span class="muted">{{ tree.rows.length }}</span>
      <input ref="search" v-model="q" type="search" placeholder="Suche in allem  /" style="flex:1;min-width:0" @keydown.down.prevent="list?.focus()" />
    </div>
    <div class="toolbar create">
      <button @click="start('group')" :title="groupTarget ? `Gruppe unter ${groupTarget.label}` : 'Gruppe an der Wurzel'">+ ▣</button>
      <button @click="start('product')" :disabled="!groupTarget || !families.length" :title="groupTarget ? `Produkt unter ${groupTarget.label}` : 'erst eine Gruppe wählen'">+ ▦</button>
      <button @click="start('variant')" :disabled="!productTarget" :title="productTarget ? `Variante unter ${productTarget.label}` : 'erst ein Produkt wählen'">+ ◆</button>
      <span class="grow" />
      <span v-if="!families.length" class="warn" title="Ohne Familie kein Produkt → Modell">⚠ keine Familie</span>
    </div>

    <div v-if="creating" class="create-form">
      <template v-if="creating === 'group'">
        <div class="muted">▣ neue Gruppe {{ groupTarget ? 'unter ' + groupTarget.label : 'an der Wurzel' }}</div>
        <input v-model="form.de" type="text" placeholder="Name de" @keydown.enter="create" @keydown.esc="creating = null" autofocus />
        <input v-model="form.en" type="text" placeholder="Name en" @keydown.enter="create" @keydown.esc="creating = null" />
      </template>
      <template v-else-if="creating === 'product'">
        <div class="muted">▦ neues Produkt unter {{ groupTarget.label }}</div>
        <select v-model="form.family" @change="form.axes = []">
          <option v-for="f in families" :key="f.key" :value="f.key">{{ f.label?.de || f.key }}</option>
        </select>
        <div v-if="familyOf(form.family)?.axes?.length" class="chips">
          <span class="muted">variiert nach:</span>
          <button v-for="a in familyOf(form.family).axes" :key="a" :class="{ primary: form.axes.includes(a) }" @click="toggleAxis(a)">{{ attrDef(a)?.label?.de || a }}</button>
        </div>
      </template>
      <template v-else>
        <div class="muted">◆ neue Variante unter {{ productTarget.label }}</div>
        <div v-if="!productTarget.axes.length" class="muted">Produkt variiert nach nichts — eine Variante ohne Achsen.</div>
        <template v-for="a in productTarget.axes" :key="a">
          <select v-if="attrDef(a)?.type === 'enum'" v-model="form[a]">
            <option value="">{{ attrDef(a)?.label?.de || a }} …</option>
            <option v-for="v in listValues(a)" :key="v.value" :value="v.value">{{ v.label?.de || v.value }}</option>
          </select>
          <input v-else v-model="form[a]" type="text" :placeholder="attrDef(a)?.label?.de || a" @keydown.enter="create" @keydown.esc="creating = null" />
        </template>
      </template>
      <div class="chips">
        <button class="primary" @click="create">Anlegen</button>
        <button @click="creating = null">Abbrechen</button>
        <span class="muted"><kbd>Enter</kbd> · <kbd>Esc</kbd></span>
      </div>
    </div>

    <div ref="list" class="scroll tree" tabindex="0" @keydown="onListKey">
      <div v-for="{ r, depth, open } in visible" :key="r.id" class="node" :class="[r.role, { selected: r.id === id, [r.status]: true }]"
        :style="`padding-left:${8 + depth * 16}px`" @click="open(r)" @contextmenu="contextMenu($event, r)" :title="r.id">
        <span class="twisty" :class="{ leaf: !tree.kids(r.id).length }" @click.stop="tree.toggle(r.id)">{{ tree.kids(r.id).length ? (open ? '▾' : '▸') : '' }}</span>
        <span class="icon">{{ icon(r.role) }}</span>
        <span class="label">{{ r.label }}</span>
        <span v-if="hits.get(r.id) && !r.label.toLowerCase().includes(q.trim().toLowerCase())" class="muted hit" :title="hits.get(r.id)">{{ hits.get(r.id) }}</span>
        <span v-if="r.role === 'variant' && r.sku && Object.keys(r.axisValues).length" class="muted axis">{{ Object.values(r.axisValues).join(' · ') }}</span>
        <span v-if="r.status === 'discontinued'" class="neg" title="ausgelaufen">✗</span>
        <span v-else-if="r.status === 'active'" class="pos" title="aktiv">●</span>
        <span v-if="tree.kids(r.id).length" class="muted count">{{ tree.kids(r.id).length }}</span>
      </div>
      <div v-if="tree.loaded && !tree.rows.length" class="empty">Leer — oben <b>+ ▣</b> legt die erste Gruppe an.</div>
      <div v-else-if="q && !visible.length" class="empty">Nichts zu „{{ q }}“</div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">
      <kbd>↑</kbd><kbd>↓</kbd> · <kbd>→</kbd><kbd>←</kbd> auf/zu · <kbd>Entf</kbd> zurückziehen · <kbd>/</kbd> Suche · Rechtsklick
    </div>
  </div>

  <NodeView v-if="id" :id="id" :key="id" />
  <div v-else class="pane" style="flex:1"><div class="empty">Knoten wählen — oder oben anlegen.</div></div>
</template>

<style scoped>
.create { gap: 4px; }
.create button { min-width: 40px; }
.create-form { padding: 8px; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px; background: var(--bg); }
.create-form input, .create-form select { width: 100%; }
.tree { outline: none; }
.node { display: flex; align-items: center; gap: 4px; height: 24px; cursor: default; white-space: nowrap; padding-right: 8px; }
.node:hover { background: var(--hover); }
.node.selected { background: var(--accent-soft); }
.twisty { width: 14px; color: var(--muted); font-size: 11px; text-align: center; cursor: pointer; }
.twisty.leaf { cursor: default; }
.icon { width: 16px; text-align: center; }
.node.group .icon { color: var(--muted); }
.node.product .icon { color: var(--accent); }
.node.variant .icon { color: var(--warn); }
.label { overflow: hidden; text-overflow: ellipsis; }
.axis { font-size: 11px; }
.hit { font-size: 11px; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.count { margin-left: auto; font-size: 11px; }
</style>
