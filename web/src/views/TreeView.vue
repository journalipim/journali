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
import { plugins } from '../plugins.js'
import NodeView from './NodeView.vue'
import Splitter from '../components/Splitter.vue'
import { paneWidth } from '../panes.js'
const treeW = paneWidth('tree', 300)

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
      for (const r of tree.kids(parent)) if (keep.has(r.id)) { out.push({ r, depth, isOpen: true }); walk(r.id, depth + 1) }
    }
    walk(null, 0)
  } else {
    const walk = (parent, depth) => {
      for (const r of tree.kids(parent)) {
        const isOpen = tree.expanded.has(r.id)
        out.push({ r, depth, isOpen })
        if (isOpen) walk(r.id, depth + 1)
      }
    }
    walk(null, 0)
  }
  return out
})

function open(row) { router.push(`/tree/${row.id}`) }

// ---- Die Menge (Taloan, 17.09.): Strg+Klick sammelt, Shift+Klick nimmt den Bereich der sichtbaren Zeilen,
// „☑ Treffer“ nimmt alle sichtbaren (z. B. ein Suchergebnis). Ein einfacher Klick öffnet nur — die Menge bleibt.
const picked = ref(new Set())
const pickAnchor = ref(null)
function onRowClick(e, r) {
  if (e.ctrlKey || e.metaKey) { const s = new Set(picked.value); s.has(r.id) ? s.delete(r.id) : s.add(r.id); picked.value = s; pickAnchor.value = r.id; return }
  if (e.shiftKey && pickAnchor.value) {
    const ids = visible.value.map(x => x.r.id); const a = ids.indexOf(pickAnchor.value), b = ids.indexOf(r.id)
    if (a >= 0 && b >= 0) { const s = new Set(picked.value); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) s.add(ids[i]); picked.value = s }
    return
  }
  pickAnchor.value = r.id
  open(r)
}
const pickVisible = () => { picked.value = new Set(visible.value.map(x => x.r.id)) }
const pickedRows = computed(() => [...picked.value].map(id => tree.byId.get(id)).filter(Boolean))

// ---- Verknüpfen: Menge → Ziel (per Shift+Ablegen oder Suche), dann Typ, Richtung, Werte je Eintrag; ein Stapel
const link = ref(null)   // { target, type, dir: 'target-first' | 'set-first', q, vals: { id: { attr: v } }, existing }
const relTypes = computed(() => (store.model?.relationTypes ?? []).filter(t => !(t.to ?? []).includes('media')))
const linkType = computed(() => relTypes.value.find(t => t.key === link.value?.type) ?? null)
const linkAttrs = computed(() => { const g = linkType.value?.group; return g ? (store.model?.attributes ?? []).filter(a => a.group === g && a.type !== 'rows' && a.type !== 'html') : [] })
async function openLink(target) {
  if (!pickedRows.value.length) { store.toast('Erst eine Menge sammeln: Strg+Klick im Baum'); return }
  link.value = { target, type: relTypes.value[0]?.key ?? '', dir: 'target-first', q: '', vals: {}, existing: null, all: {} }
  await loadExisting()
}
async function loadExisting() {
  if (!link.value?.target) return
  try {
    const rs = await api.get(`/api/nodes/${encodeURIComponent(link.value.target.id)}/relations`)
    link.value.existing = { out: new Set(rs.out.map(r => `${r.type}|${r.to}`)), in: new Set(rs.in.map(r => `${r.type}|${r.from}`)) }
  } catch (e) { store.toast(e.message) }
}
const linkMatches = computed(() => {
  const q = (link.value?.q ?? '').trim().toLowerCase(); if (!q) return []
  return tree.rows.filter(r => !picked.value.has(r.id) && (r.label.toLowerCase().includes(q) || (r.sku ?? '').toLowerCase().includes(q) || r.id.includes(q))).slice(0, 12)
})
// Welche der Menge sind für Typ und Richtung erlaubt, welche gibt es schon?
const linkRows = computed(() => {
  const l = link.value, t = linkType.value; if (!l || !t) return []
  const targetFirst = l.dir === 'target-first'   // Ziel → Eintrag (Ziel hat Zubehör: Eintrag)
  return pickedRows.value.map(r => {
    const from = targetFirst ? l.target : r, to = targetFirst ? r : l.target
    const roleOk = (!t.from || t.from.includes(from.role)) && (!t.to || t.to.includes(to.role))
    const exists = l.existing && (targetFirst ? l.existing.out.has(`${t.key}|${r.id}`) : l.existing.in.has(`${t.key}|${r.id}`))
      || (t.symmetric && l.existing && (l.existing.out.has(`${t.key}|${r.id}`) || l.existing.in.has(`${t.key}|${r.id}`)))
    return { r, ok: roleOk && r.id !== l.target.id, exists: !!exists }
  })
})
const linkCount = computed(() => linkRows.value.filter(x => x.ok && !x.exists).length)
function fillAll(attr, v) { for (const x of linkRows.value) { link.value.vals[x.r.id] ??= {}; link.value.vals[x.r.id][attr] = v } }
async function runLink() {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  const l = link.value, t = linkType.value; if (!l || !t) return
  const cmds = []
  let n = 0
  for (const x of linkRows.value) {
    if (!x.ok || x.exists) continue
    const ref = 'l' + (++n)
    const from = l.dir === 'target-first' ? l.target.id : x.r.id, to = l.dir === 'target-first' ? x.r.id : l.target.id
    cmds.push({ op: 'relation.create', ref, args: { type: t.key, from, to } })
    for (const a of linkAttrs.value) {
      const v = (l.vals[x.r.id]?.[a.key] ?? '').trim(); if (!v) continue
      cmds.push({ op: 'relation.attribute.set', args: { relation: '@' + ref, attribute: a.key, locale: null, ...(a.multiple ? { values: v.split(',').map(s => s.trim()).filter(Boolean) } : { value: v }) } })
    }
  }
  if (!cmds.length) { store.toast('Nichts zu verknüpfen'); return }
  try {
    const res = await api.post('/api/batch', { commands: cmds })
    if (res.error) store.toast(`${res.error.message} — ${res.results.length} Einträge davor geschrieben`)
    else store.toast(`${n} Relationen ${t.label?.de || t.key} → ${res.results.length} Einträge (Stapel ${res.batch})`, 'ok')
    link.value = null
    await store.poll(true)
  } catch (e) { store.toast(e.message) }
}
function onLinkKey(e) { if (e.key === 'Escape') { e.preventDefault(); link.value = null } }

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
// Umhängen per Drag & Drop (Taloan, 17.09.): Zeile ziehen, auf einer Zeile ablegen = darunter hängen.
// Dieselben Regeln wie der Server (Commands.Move): Variante unter Produkt, sonst unter Gruppe, nie unter sich selbst.
const dragId = ref(null)
const dropId = ref(null)
// Zugeklappte Äste öffnen sich, wenn man beim Ziehen eine Weile darüber steht (Taloan, 17.09.).
let hoverTimer = null, hoverId = null
function hoverOpen(r) {
  if (hoverId === r.id) return
  clearTimeout(hoverTimer); hoverId = r.id
  if (tree.kids(r.id).length && !tree.expanded.has(r.id)) hoverTimer = setTimeout(() => { if (hoverId === r.id) tree.expand(r.id) }, 700)
}
function hoverStop() { clearTimeout(hoverTimer); hoverId = null }
function canDrop(src, target) {
  if (!src || !target || src.id === target.id || src.parent === target.id) return false
  if (target.role !== (src.role === 'variant' ? 'product' : 'group')) return false
  for (const a of tree.ancestors(target.id)) if (a.id === src.id) return false
  return true
}
// Ziehen: gehört die Zeile zur Menge, zieht die ganze Menge mit. Shift beim Ablegen = verknüpfen statt umhängen.
// effectAllowed 'all': mit gedrückter Shift-Taste erzwingt Windows/Chrome den Effekt „move“, mit Strg „copy“ — passt der nicht zu
// effectAllowed, zeigt der Browser das Verbotsschild und liefert kein drop (Taloan, 17.09.). Was Shift bedeutet, entscheiden wir selbst.
function onDragStart(e, r) { dragId.value = r.id; e.dataTransfer.effectAllowed = 'all'; e.dataTransfer.setData('text/plain', r.id) }
const dragIds = () => picked.value.has(dragId.value) ? [...picked.value] : [dragId.value]
function onDragOver(e, r) {
  const src = tree.byId.get(dragId.value)
  if (src) hoverOpen(r)
  const ok = e.shiftKey ? dragIds().some(id => id !== r.id) : dragIds().some(id => canDrop(tree.byId.get(id), r))
  if (!ok) { dropId.value = null; return }
  e.preventDefault(); e.dataTransfer.dropEffect = e.shiftKey ? 'move' : e.ctrlKey ? 'copy' : 'move'; dropId.value = r.id
}
async function onDrop(e, r) {
  const ids = dragIds()
  dragId.value = null; dropId.value = null; hoverStop()
  if (e.shiftKey) {   // verknüpfen: die Menge (oder die eine Zeile) mit diesem Ziel
    if (!picked.value.has(ids[0])) picked.value = new Set(ids)
    await openLink(r); return
  }
  let moved = 0, below = 0
  try {
    for (const id of ids) {
      const src = tree.byId.get(id); if (!canDrop(src, r)) continue
      await api.post(`/api/nodes/${encodeURIComponent(src.id)}/move`, { parent: r.id }); moved++; below += countBelow(src.id)
    }
    if (moved) store.toast(`${moved === 1 ? icon(tree.byId.get(ids[0]).role) + ' ' + tree.byId.get(ids[0]).label : moved + ' Einträge'}${below ? ` mit ${below} darunter` : ''} → ${icon(r.role)} ${r.label}`, 'ok')
    await store.poll(true); await tree.load(); tree.expand(r.id)
  } catch (e) { store.toast(e.message) }
}
function expandAll(id) { tree.expand(id); for (const k of tree.kids(id)) expandAll(k.id) }
function collapseAll(id) { for (const k of tree.kids(id)) collapseAll(k.id); if (tree.expanded.has(id)) tree.toggle(id) }
async function setStatus(r, status) {
  try { await api.post(`/api/nodes/${encodeURIComponent(r.id)}/status`, { status }); await store.poll(true); await tree.load() } catch (e) { store.toast(e.message) }
}
// Eigener Name im Baum (jede Rolle) = angeheftet (📌); leer = Automatik (★ Attribut, bei Varianten SKU/Achsen, sonst Id).
async function setName(r, name) {
  try { await api.post(`/api/nodes/${encodeURIComponent(r.id)}/name`, { name }, 'PUT'); await store.poll(true); await tree.load() } catch (e) { store.toast(e.message) }
}
async function rename(r) {
  const name = window.prompt(`Name im Baum — leer = Automatik (★)\n${r.label}`, r.name ?? r.label)
  if (name != null) await setName(r, name)
}
// Fixieren übernimmt den Namen, den die Automatik gerade zeigt, als eigenen; Freigeben nimmt ihn weg.
const fix = r => setName(r, r.name ? '' : r.label)
async function duplicate(r, deep) {
  try {
    const res = await api.post(`/api/nodes/${encodeURIComponent(r.id)}/duplicate?deep=${deep}`)
    store.toast(`Kopie: ${res.entries} Einträge (Stapel ${res.batch})`, 'ok')
    await store.poll(true); await tree.load(); router.push(`/tree/${res.id}`)
  } catch (e) { store.toast(e.message) }
}
// Rechtsklick: was man mit diesem Knoten tun kann — die Tastenkürzel gelten im Menü.
function contextMenu(e, r) {
  router.push(`/tree/${r.id}`)
  const kids = tree.kids(r.id).length
  const st = s => r.role !== 'group' && r.status !== s ? { label: s === 'draft' ? '○ Entwurf' : s === 'active' ? '● aktiv' : '✗ ausgelaufen', action: () => setStatus(r, s) } : null
  menu.open(e, [
    r.role === 'group' ? { label: 'Neue Gruppe darunter', icon: '▣', key: 'g', action: () => start('group') } : null,
    r.role === 'group' ? { label: 'Neues Produkt darunter', icon: '▦', key: 'p', action: () => start('product') } : null,
    r.role === 'product' ? { label: 'Neue Variante darunter', icon: '◆', key: 'v', action: () => start('variant') } : null,
    { label: 'Umbenennen', icon: '✎', key: 'u', hint: r.name ? '📌 fixiert' : '★ Automatik', action: () => rename(r) },
    { label: r.name ? 'Benennung lösen' : 'Benennung fixieren', icon: r.name ? '★' : '📌', key: 'f', hint: r.name ? '★ gilt wieder' : r.label, action: () => fix(r) },
    { sep: true },
    { label: 'Duplizieren', icon: '⧉', key: 'd', hint: 'ohne SKU/Freigaben', disabled: r.role === 'variant' && Object.keys(r.axisValues).length > 0, action: () => duplicate(r, false) },
    r.role !== 'variant' && kids ? { label: `Duplizieren mit ${countBelow(r.id)} darunter`, icon: '⧉', key: 't', action: () => duplicate(r, true) } : null,
    { sep: true },
    ...(r.role !== 'group' ? [st('draft'), st('active'), st('discontinued'), { sep: true }] : []),
    kids ? { label: 'Alles aufklappen', icon: '▾', key: 'a', action: () => expandAll(r.id) } : null,
    kids ? { label: 'Alles zuklappen', icon: '▸', key: 'z', action: () => collapseAll(r.id) } : null,
    { label: 'Id kopieren', icon: '⧉', key: 'i', hint: r.id, action: () => navigator.clipboard?.writeText(r.id) },
    { label: 'Im Journal zeigen', icon: '≡', key: 'j', action: () => router.push({ path: '/journal', query: { q: r.id } }) },
    ...(plugins.nodeActions.length ? [{ sep: true }, ...plugins.nodeActions.map(a => ({ label: a.label, icon: a.icon || '⌁', hint: a.key, action: () => Promise.resolve(a.run(r.id, { ...plugins.ctx(a.key), tree })).catch(e => store.toast(`${a.key}: ${e.message}`)) }))] : []),
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
function attrDef(key) { return store.model?.attributes.find(a => a.key === key) }
function listValues(key) { const d = attrDef(key); return (store.model?.lists.find(l => l.key === d?.list)?.values ?? []) }

// Anlegen (Taloan, 17.09.): ein Dialog mit den Pflichtfeldern — die Attribute, die am neuen Knoten gelten
// (Gruppen am Pfad des Elternknotens, dort aktiv) und für irgendeinen Kanal Pflicht sind, sprachabhängige
// nur in der Mastersprache. Erst wenn alles gefüllt ist, wird geschrieben: Anlegen + Werte als ein Stapel.
const DEPTH = { group: 0, product: 1, variant: 2 }
const required = ref([])      // [{ def, locale }]
const vals = ref({})          // key → Wert
const master = computed(() => store.model?.masterLocale ?? store.model?.locales[0]?.code ?? null)
async function start(kind) {
  const parent = kind === 'variant' ? productTarget.value : groupTarget.value
  creating.value = kind
  form.value = kind === 'variant' ? Object.fromEntries((productTarget.value?.axes ?? []).map(a => [a, ''])) : {}
  vals.value = {}; required.value = []
  try {
    const m = store.model
    const onPath = parent ? (await api.get(`/api/nodes/${encodeURIComponent(parent.id)}`)).groups.map(g => g.key) : []
    const active = onPath.filter(k => { const g = m.groups.find(x => x.key === k); return !g?.activeFrom || DEPTH[kind] >= DEPTH[g.activeFrom] })
    required.value = m.attributes
      .filter(a => active.includes(a.group) && a.required && Object.keys(a.required).length && (!a.levels || a.levels.includes(kind)) && a.type !== 'rows' && a.type !== 'html')
      .filter(a => !(kind === 'variant' && (productTarget.value?.axes ?? []).includes(a.key)))   // Achsenwerte fragt der Dialog ohnehin
      .map(a => ({ def: a, locale: a.perLocale ? master.value : null }))
  } catch (e) { store.toast(e.message) }
}
const complete = computed(() => required.value.every(r => (vals.value[r.def.key] ?? '').trim() !== '') && Object.values(form.value).every(v => v !== ''))
async function create() {
  if (!complete.value) return
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  const kind = creating.value
  const parent = kind === 'variant' ? productTarget.value : groupTarget.value
  const cmds = [kind === 'group' ? { op: 'group.create', ref: 'n', args: { parent: parent?.id ?? null } }
    : kind === 'product' ? { op: 'product.create', ref: 'n', args: { group: parent.id } }
    : { op: 'variant.create', ref: 'n', args: { product: parent.id, axisValues: form.value } }]
  for (const r of required.value) {
    const v = vals.value[r.def.key].trim()
    cmds.push({ op: 'attribute.set', args: { node: '@n', attribute: r.def.key, locale: r.locale, ...(r.def.multiple ? { values: v.split(',').map(x => x.trim()).filter(Boolean) } : { value: v }) } })
  }
  try {
    const res = await api.post('/api/batch', { commands: cmds })
    if (res.error) { store.toast(`${res.error.message} — ${res.results.length} Einträge geschrieben`); }
    const id = res.results.find(x => x.ref === 'n')?.node
    creating.value = null
    await store.poll(true); await tree.load()
    if (parent) tree.expand(parent.id)
    if (id) router.push(`/tree/${id}`)
  } catch (e) { store.toast(e.message) }
}
function onDialogKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); creating.value = null }
  else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); create() }
}
</script>

<template>
  <div class="pane" :style="`width:${treeW}px;flex:none`">
    <div class="toolbar">
      <h1>▣ Baum</h1>
      <span class="muted">{{ tree.rows.length }}</span>
      <input ref="search" v-model="q" type="search" placeholder="Suche in allem  /" style="flex:1;min-width:0" @keydown.down.prevent="list?.focus()" />
    </div>
    <div class="toolbar create">
      <button @click="start('group')" :title="groupTarget ? `Gruppe unter ${groupTarget.label}` : 'Gruppe an der Wurzel'">+ ▣</button>
      <button @click="start('product')" :disabled="!groupTarget" :title="groupTarget ? `Produkt unter ${groupTarget.label}` : 'erst eine Gruppe wählen'">+ ▦</button>
      <button @click="start('variant')" :disabled="!productTarget" :title="productTarget ? `Variante unter ${productTarget.label}` : 'erst ein Produkt wählen'">+ ◆</button>
      <span class="grow" />
      <button v-if="q" @click="pickVisible" title="alle sichtbaren Treffer in die Menge">☑ Treffer</button>
      <template v-if="picked.size">
        <span class="chip" title="die Menge — Strg+Klick sammelt, Shift+Klick nimmt den Bereich">☑ {{ picked.size }} <button @click="picked = new Set()" title="Menge leeren">×</button></span>
        <button class="primary" @click="openLink(null)" title="die Menge mit einem Ziel verknüpfen (oder mit Shift auf ein Ziel ziehen)">⇄</button>
      </template>
    </div>

    <!-- Verknüpfen: Menge → Ziel, dann Typ und Richtung (Taloan, 17.09.) -->
    <div v-if="link" class="overlay" @click.self="link = null" @keydown="onLinkKey">
      <div class="dialog" style="min-width:640px;max-width:92vw">
        <div class="toolbar"><h1>⇄ {{ pickedRows.length }} Einträge verknüpfen</h1><span class="grow" /><button class="x" @click="link = null" title="Esc">×</button></div>
        <table class="grid form"><colgroup><col style="width:130px" /><col /></colgroup><tbody>
          <tr><td class="attr">Ziel</td><td>
            <span v-if="link.target" class="chip">{{ icon(link.target.role) }} {{ link.target.label }} <button @click="link.target = null; link.existing = null" title="anderes Ziel">×</button></span>
            <input v-else v-model="link.q" type="search" placeholder="🔍 Name, SKU, Id" style="width:320px" autofocus />
            <div v-if="!link.target && linkMatches.length" class="picker" style="max-width:420px">
              <div v-for="m in linkMatches" :key="m.id" class="pick" @click="link.target = m; link.q = ''; loadExisting()">{{ icon(m.role) }} {{ m.label }}<span class="muted mono" style="margin-left:auto;font-size:11px">{{ m.sku ?? m.id }}</span></div>
            </div>
          </td></tr>
          <tr><td class="attr">Relation</td><td>
            <select v-model="link.type" style="width:260px"><option v-for="t in relTypes" :key="t.key" :value="t.key">{{ t.symmetric ? '⇄' : '→' }} {{ t.label?.de || t.key }}{{ t.group ? ' · ▤ ' + t.group : '' }}</option></select>
            <span v-if="linkType" class="muted" style="margin-left:8px">{{ linkType.symmetric ? 'beidseitig — liest sich von beiden Enden gleich' : 'einseitig — zwei Lesarten' }}</span>
          </td></tr>
          <tr v-if="linkType && link.target"><td class="attr">Richtung</td><td class="dirs">
            <label :class="{ on: link.dir === 'target-first' }"><input type="radio" value="target-first" v-model="link.dir" />
              <b>{{ link.target.label }}</b> — {{ linkType.label?.de || linkType.key }} → <b>{{ pickedRows.length }} Einträge</b>
              <span v-if="!linkType.symmetric" class="muted"> · die Einträge sind „{{ linkType.reverse?.de || '…' }}“ {{ link.target.label }}</span></label>
            <label v-if="!linkType.symmetric" :class="{ on: link.dir === 'set-first' }"><input type="radio" value="set-first" v-model="link.dir" />
              <b>{{ pickedRows.length }} Einträge</b> — {{ linkType.label?.de || linkType.key }} → <b>{{ link.target.label }}</b>
              <span class="muted"> · {{ link.target.label }} ist „{{ linkType.reverse?.de || '…' }}“ jedes Eintrags</span></label>
          </td></tr>
        </tbody></table>
        <div class="scroll" style="max-height:340px">
          <table class="grid" style="width:auto">
            <thead><tr><th style="width:320px">Eintrag</th><th v-for="a in linkAttrs" :key="a.key" style="width:140px" :title="a.key">{{ a.label?.de || a.key }}<span v-if="a.unit" class="muted"> {{ a.unit }}</span></th><th style="width:120px"></th></tr>
              <tr v-if="linkAttrs.length" class="muted"><td style="font-size:11px;padding:2px 8px">für alle:</td><td v-for="a in linkAttrs" :key="a.key" style="padding:2px 4px"><input type="text" style="width:100%" :placeholder="a.label?.de || a.key" @change="fillAll(a.key, $event.target.value)" /></td><td></td></tr>
            </thead>
            <tbody>
              <tr v-for="x in linkRows" :key="x.r.id" :class="{ muted: !x.ok || x.exists }">
                <td :title="x.r.id">{{ icon(x.r.role) }} {{ x.r.label }}</td>
                <td v-for="a in linkAttrs" :key="a.key" style="padding:2px 4px"><input v-if="x.ok && !x.exists" type="text" style="width:100%" :value="link.vals[x.r.id]?.[a.key] ?? ''" @input="(link.vals[x.r.id] ??= {})[a.key] = $event.target.value" /></td>
                <td class="muted" style="font-size:11px">{{ x.exists ? 'gibt es schon' : !x.ok ? 'Typ erlaubt das nicht' : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="chips" style="padding:8px">
          <button class="primary" :disabled="!link.target || !linkType || !linkCount" @click="runLink">⇄ {{ linkCount }} verknüpfen</button>
          <button @click="link = null">Abbrechen</button>
          <span class="grow" /><span class="muted">ein Stapel · <kbd>Esc</kbd></span>
        </div>
      </div>
    </div>

    <!-- Anlegen: Dialog mit Pflichtfeldern (Mastersprache); erst vollständig, dann ein Stapel -->
    <div v-if="creating" class="overlay" @click.self="creating = null" @keydown="onDialogKey">
      <div class="dialog">
        <div class="toolbar"><h1>{{ icon(creating) }} {{ creating === 'group' ? 'Neue Gruppe' : creating === 'product' ? 'Neues Produkt' : 'Neue Variante' }}</h1>
          <span class="muted">{{ creating === 'variant' ? 'unter ' + productTarget.label : groupTarget ? 'unter ' + groupTarget.label : 'an der Wurzel' }}</span></div>
        <table class="grid form"><colgroup><col style="width:170px" /><col style="width:300px" /></colgroup><tbody>
          <tr v-for="a in (creating === 'variant' ? productTarget.axes : [])" :key="'ax-' + a">
            <td class="attr" :title="a + ' — Variantenachse'">◆ {{ attrDef(a)?.label?.de || a }}</td>
            <td>
              <select v-if="attrDef(a)?.type === 'enum'" v-model="form[a]" style="width:100%"><option value="">…</option><option v-for="v in listValues(a)" :key="v.value" :value="v.value">{{ v.label?.de || v.value }}</option></select>
              <input v-else v-model="form[a]" type="text" style="width:100%" />
            </td>
          </tr>
          <tr v-for="(r, i) in required" :key="r.def.key">
            <td class="attr" :title="r.def.key + (r.locale ? ' · ' + r.locale : '')">● {{ r.def.label?.de || r.def.key }}<span v-if="r.locale" class="muted">&nbsp;{{ r.locale }}</span></td>
            <td>
              <select v-if="r.def.type === 'enum'" v-model="vals[r.def.key]" style="width:100%"><option value="">…</option><option v-for="v in listValues(r.def.key)" :key="v.value" :value="v.value">{{ v.label?.de || v.value }}</option></select>
              <select v-else-if="r.def.type === 'boolean'" v-model="vals[r.def.key]" style="width:100%"><option value="">…</option><option value="true">✓ ja</option><option value="false">✗ nein</option></select>
              <input v-else v-model="vals[r.def.key]" :type="r.def.type === 'date' ? 'date' : 'text'" style="width:100%" :placeholder="r.def.multiple ? 'kommagetrennt' : ''" :autofocus="i === 0" />
            </td>
          </tr>
        </tbody></table>
        <div v-if="!required.length && !(creating === 'variant' && productTarget.axes.length)" class="muted" style="padding:6px 8px;font-size:12px">Keine Pflichtfelder an diesem Knotentyp — Anlegen, dann rechts pflegen.</div>
        <div class="chips" style="padding:8px">
          <button class="primary" :disabled="!complete" @click="create">Anlegen</button>
          <button @click="creating = null">Abbrechen</button>
          <span class="grow" /><span class="muted"><kbd>Enter</kbd> · <kbd>Esc</kbd></span>
        </div>
      </div>
    </div>

    <div ref="list" class="scroll tree" tabindex="0" @keydown="onListKey">
      <!-- Flag heisst isOpen, nicht open — sonst verdeckt es die Funktion open(r) des Klicks. -->
      <div v-for="{ r, depth, isOpen } in visible" :key="r.id" class="node" :class="[r.role, { selected: r.id === id, picked: picked.has(r.id), [r.status]: true, drop: dropId === r.id, dragging: dragId === r.id }]"
        :style="`padding-left:${8 + depth * 16}px`" @click="onRowClick($event, r)" @contextmenu="contextMenu($event, r)" :title="r.id"
        draggable="true" @dragstart="onDragStart($event, r)" @dragover="onDragOver($event, r)" @dragleave="dropId === r.id && (dropId = null)" @drop.prevent="onDrop($event, r)" @dragend="dragId = null; dropId = null; hoverStop()">
        <span class="twisty" :class="{ leaf: !tree.kids(r.id).length }" @click.stop="tree.toggle(r.id)">{{ tree.kids(r.id).length ? (isOpen ? '▾' : '▸') : '' }}</span>
        <span class="icon">{{ icon(r.role) }}</span>
        <span class="label" :class="{ pinned: r.name }" :title="r.name ? 'Name angeheftet (kursiv) — die ★-Automatik gilt hier nicht. Rechtsklick → Benennung lösen' : ''">{{ r.label }}</span>
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
      <kbd>↑</kbd><kbd>↓</kbd> · <kbd>Entf</kbd> zurückziehen · <kbd>/</kbd> Suche · <kbd>Strg</kbd>+Klick Menge · ziehen = umhängen, mit <kbd>Shift</kbd> = verknüpfen · <i>kursiv</i> = angeheftet
    </div>
  </div>

  <Splitter v-model="treeW" :min="200" :max="800" />
  <NodeView v-if="id" :id="id" :key="id" />
  <div v-else class="pane" style="flex:1"><div class="empty">Knoten wählen — oder oben anlegen.</div></div>
</template>

<style scoped>
.create { gap: 4px; }
.create button { min-width: 40px; }
.overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, .45); display: grid; place-items: center; z-index: 5; }
.dialog { background: var(--pane); border: 1px solid var(--line); border-radius: 8px; min-width: 500px; box-shadow: 0 12px 40px rgba(0, 0, 0, .4); }
.dialog .form { width: auto; margin: 0; }
.dialog td.attr { white-space: nowrap; color: var(--muted); }
.dialog td { padding: 3px 8px; }

.tree { outline: none; }
.node { display: flex; align-items: center; gap: 4px; height: 24px; cursor: default; white-space: nowrap; padding-right: 8px; }
.node:hover { background: var(--hover); }
.node.selected { background: var(--accent-soft); }
.node.drop { outline: 1px dashed var(--accent); outline-offset: -1px; background: var(--accent-soft); }
.node.picked { box-shadow: inset 3px 0 0 var(--warn); }
.node.picked .label::after { content: ' ☑'; color: var(--warn); font-size: 10px; }
.dirs label { display: block; padding: 4px 6px; border-radius: 4px; cursor: pointer; }
.dirs label.on { background: var(--accent-soft); }
.picker { max-height: 240px; overflow: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--pane); margin-top: 4px; }
.pick { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 8px; white-space: nowrap; cursor: pointer; }
.pick:hover { background: var(--hover); }
.node.dragging { opacity: .5; }
.twisty { width: 14px; color: var(--muted); font-size: 11px; text-align: center; cursor: pointer; }
.twisty.leaf { cursor: default; }
.icon { width: 16px; text-align: center; }
.node.group .icon { color: var(--muted); }
.node.product .icon { color: var(--accent); }
.node.variant .icon { color: var(--warn); }
.label { overflow: hidden; text-overflow: ellipsis; }
.axis { font-size: 11px; }
/* angehefteter Name: kursiv, kein Symbol — die Information ist klein (Taloan, 17.09.) */
.label.pinned { font-style: italic; }
.hit { font-size: 11px; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.count { margin-left: auto; font-size: 11px; }
</style>
