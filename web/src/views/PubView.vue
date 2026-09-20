<script setup>
// ⇶ Publikation (Taloan, 20.09.2026): links die Publikationsbäume — je Kanal (× Markt) die Maximalstruktur aus Rubriken, darin
// Produktgruppen und Produkte per Verweis (↗); rechts der gewählte Knoten (Rubrik mit ihren Texten, oder der verwiesene
// Pflegeknoten). Ableiten aus dem Pflegebaum als Start, danach frei umbauen: ziehen = Rubrik oder Verweis umhängen,
// Rechtsklick = Rubrik/Verweis/Ableiten/Zurückziehen. „nicht einsortiert“ zählt die Produkte, die in diesem Baum nirgends hängen.
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { tree, icon } from '../tree.js'
import { menu } from '../menu.js'
import NodeView from './NodeView.vue'
import Splitter from '../components/Splitter.vue'
import TreePicker from '../components/TreePicker.vue'
import { paneWidth } from '../panes.js'
const pubW = paneWidth('pub', 320)
const props = defineProps({ id: String })
const router = useRouter()

const trees = computed(() => tree.pubTrees)
const treeKey = ref(localStorage.getItem('journali.pubtree') || '')
const current = computed(() => trees.value.find(t => t.id === treeKey.value) ?? trees.value[0] ?? null)
watch(current, t => { if (t) { treeKey.value = t.id; localStorage.setItem('journali.pubtree', t.id) } }, { immediate: true })
const expanded = ref(new Set(JSON.parse(localStorage.getItem('journali.pubexpanded') || '[]')))
function toggle(id) { expanded.value.has(id) ? expanded.value.delete(id) : expanded.value.add(id); expanded.value = new Set(expanded.value); localStorage.setItem('journali.pubexpanded', JSON.stringify([...expanded.value])) }

// Zeilen: Rubriken (Kinder im Baum) und darunter ihre Verweise; ein Verweis zeigt den Pflegeknoten, dessen Kinder bleiben zu
const rows = computed(() => {
  const out = []
  const walk = (r, depth) => {
    const isOpen = expanded.value.has(r.id)
    const placed = (r.placed ?? []).map(id => tree.byId.get(id)).filter(Boolean)
    const has = tree.kids(r.id).length + placed.length > 0
    out.push({ r, depth, isOpen, has, kind: 'rubric', n: placed.length })
    if (!isOpen) return
    for (const k of tree.kids(r.id)) walk(k, depth + 1)
    for (const p of placed) out.push({ r: p, depth: depth + 1, kind: 'placed', rubric: r.id })
  }
  if (current.value) walk(current.value, 0)
  return out
})
// nicht einsortiert: Produkte, die weder selbst noch über einen Vorfahren in diesem Baum hängen
const placedSet = computed(() => { const s = new Set(); const walk = r => { for (const p of r.placed ?? []) s.add(p); for (const k of tree.kids(r.id)) walk(k) }; if (current.value) walk(current.value); return s })
const unplaced = computed(() => {
  if (!current.value) return []
  const inTree = id => { for (let x = tree.byId.get(id); x; x = tree.byId.get(x.parent)) if (placedSet.value.has(x.id)) return true; return false }
  return tree.rows.filter(r => r.role === 'product' && !inTree(r.id))
})
const showUnplaced = ref(false)
const selRubric = computed(() => { const r = tree.byId.get(props.id); return r?.role === 'rubric' ? r : null })

async function run(fn) { try { await fn(); await store.poll(true); await tree.load() } catch (e) { store.toast(e.message) } }
const post = (url, body, m) => api.post(url, body, m)

async function newTree() {
  const channels = store.model?.channels ?? []
  const name = await dialog.prompt({ title: 'Neuer Publikationsbaum', value: '', placeholder: 'Name — z. B. Web Schweiz', ok: '+ Baum' })
  if (!name) return
  const channel = channels.length === 1 ? channels[0].key : await dialog.prompt({ title: 'Kanal', text: channels.map(c => c.key).join(' · '), value: store.model?.masterChannel ?? channels[0]?.key ?? '', ok: 'OK' })
  if (!channel) return
  const market = await dialog.prompt({ title: 'Markt (leer = alle)', value: '', placeholder: 'z. B. cn', ok: 'OK' })
  if (market == null) return
  await run(async () => { const e = await post('/api/rubrics', { parent: null, label: {}, name, channel, market: market || null }); treeKey.value = e.stream })
}
async function newRubric(parent) {
  const name = await dialog.prompt({ title: 'Neue Rubrik', text: `unter ${parent.label}`, value: '', ok: '+ Rubrik' })
  if (!name) return
  await run(async () => { await post('/api/rubrics', { parent: parent.id, label: {}, name }); expanded.value.add(parent.id); toggle(parent.id); toggle(parent.id) })
}
async function rename(r) {
  const name = await dialog.prompt({ title: 'Rubrik umbenennen', value: r.name ?? r.label, ok: '✎ Umbenennen' })
  if (name) await run(() => post(`/api/nodes/${encodeURIComponent(r.id)}/name`, { name }, 'PUT'))
}
async function retire(r) {
  const n = tree.kids(r.id).length; const p = (r.placed ?? []).length
  if (!await dialog.confirm({ title: 'Rubrik zurückziehen', warn: r.label, text: (n ? `${n} Rubriken darunter, ` : '') + (p ? `${p} Verweise` : ''), ok: '✕ Zurückziehen', danger: true })) return
  await run(() => api.del(`/api/nodes/${encodeURIComponent(r.id)}?recursive=true`))
}
// Verweise anlegen: Auswahlbaum (Taloan: Knoten immer per Auswahlbaum), mehrere auf einmal
const picking = ref(null)   // { rubric, values: [] }
async function placePicked() {
  const p = picking.value; if (!p?.values?.length) return
  await run(async () => { for (const id of p.values) await post(`/api/rubrics/${encodeURIComponent(p.rubric.id)}/place`, { node: id }).catch(e => { if (!/schon/.test(e.message)) throw e }); expanded.value.add(p.rubric.id) })
  picking.value = null
}
async function unplace(rubricId, nodeId) { await run(() => api.del(`/api/rubrics/${encodeURIComponent(rubricId)}/place/${encodeURIComponent(nodeId)}`)) }
// Ableiten: ab einer Produktgruppe des Pflegebaums — Gruppen werden Rubriken, Produkte Verweise
const deriving = ref(null)  // { rubric, from }
// Vorschau: was aus der Gruppe wird — Untergruppen (rekursiv) zu Rubriken, Produkte zu Verweisen
function deriveWhat(id) { const c = { group: 0, product: 0 }; const walk = x => { for (const k of tree.kids(x)) { if (k.role in c) c[k.role]++; walk(k.id) } }; walk(id); return `${c.group} ${c.group === 1 ? 'Untergruppe wird Rubrik' : 'Untergruppen werden Rubriken'}, ${c.product} ${c.product === 1 ? 'Produkt wird Verweis' : 'Produkte werden Verweise'}` }
async function deriveRun() {
  const d = deriving.value; if (!d?.from) return
  await run(async () => { await post(`/api/rubrics/${encodeURIComponent(d.rubric.id)}/derive`, { from: d.from }); expanded.value.add(d.rubric.id) })
  deriving.value = null
}
async function placeUnplaced(ids) {
  if (!selRubric.value) { store.toast('erst eine Rubrik wählen (links anklicken)'); return }
  await run(async () => { for (const id of ids) await post(`/api/rubrics/${encodeURIComponent(selRubric.value.id)}/place`, { node: id }) })
}

function contextMenu(e, row) {
  const r = row.r
  if (row.kind === 'placed') {
    menu.open(e, [
      { label: 'im Pflegebaum zeigen', icon: '▣', action: () => router.push(`/tree/${r.id}`) },
      { sep: true },
      { label: 'Verweis entfernen', icon: '✕', danger: true, action: () => unplace(row.rubric, r.id) },
    ]); return
  }
  router.push(`/pub/${r.id}`)
  menu.open(e, [
    { label: 'Rubrik darunter …', icon: '+', action: () => newRubric(r) },
    { label: 'Verweise dazu …', icon: '↗', hint: 'Produktgruppen und Produkte aus dem Pflegebaum', action: () => { picking.value = { rubric: r, values: [] } } },
    { label: 'aus dem Pflegebaum ableiten …', icon: '⇊', hint: 'ab einer Produktgruppe: Gruppen → Rubriken, Produkte → Verweise', action: () => { deriving.value = { rubric: r, from: null } } },
    { sep: true },
    { label: 'Umbenennen', icon: '✎', action: () => rename(r) },
    ...(r.parent ? [{ label: 'Zurückziehen', icon: '✕', danger: true, action: () => retire(r) }] : [{ label: 'Kanal / Markt …', icon: '⇶', action: () => editTree(r) }]),
  ])
}
async function editTree(r) {
  const channel = await dialog.prompt({ title: 'Kanal', text: (store.model?.channels ?? []).map(c => c.key).join(' · '), value: r.channel ?? '', ok: 'OK' }); if (!channel) return
  const market = await dialog.prompt({ title: 'Markt (leer = alle)', value: r.market ?? '', ok: 'OK' }); if (market == null) return
  await run(() => post(`/api/rubrics/${encodeURIComponent(r.id)}/tree`, { channel, market: market || null }, 'PUT'))
}
// Ziehen: Rubrik auf Rubrik = umhängen; Verweis auf Rubrik = Verweis umhängen
const drag = ref(null); const dropId = ref(null)
function onDragStart(e, row) { drag.value = row; e.dataTransfer.effectAllowed = 'move' }
function onDragOver(e, row) { if (row.kind !== 'rubric' || !drag.value || drag.value.r.id === row.r.id) return; e.preventDefault(); dropId.value = row.r.id }
async function onDrop(row) {
  const d = drag.value; drag.value = null; dropId.value = null
  if (!d || row.kind !== 'rubric') return
  if (d.kind === 'rubric') await run(() => post(`/api/nodes/${encodeURIComponent(d.r.id)}/move`, { parent: row.r.id }))
  else await run(async () => { await post(`/api/rubrics/${encodeURIComponent(row.r.id)}/place`, { node: d.r.id }); await api.del(`/api/rubrics/${encodeURIComponent(d.rubric)}/place/${encodeURIComponent(d.r.id)}`) })
}
function open(row) { router.push(`/pub/${row.r.id}`) }
onMounted(() => { if (!tree.loaded) tree.load() })
</script>

<template>
  <div class="pane" :style="`width:${pubW}px;flex:none`">
    <div class="toolbar">
      <h1>⇶ Publikation</h1>
      <select v-if="trees.length" v-model="treeKey" title="Publikationsbaum — je Kanal (× Markt) die Maximalstruktur">
        <option v-for="t in trees" :key="t.id" :value="t.id">{{ t.label }} · {{ t.channel }}{{ t.market ? '/' + t.market : '' }}</option>
      </select>
      <button class="x" @click="newTree" title="neuer Publikationsbaum">+</button>
      <span class="grow" />
      <button v-if="current && unplaced.length" :class="{ primary: showUnplaced }" @click="showUnplaced = !showUnplaced" :title="`${unplaced.length} Produkte sind in „${current.label}“ noch nicht einsortiert — Klick zeigt sie`">⚠ {{ unplaced.length }}</button>
    </div>
    <div v-if="showUnplaced" class="unplaced">
      <div class="toolbar"><span class="muted">{{ unplaced.length }} Produkte noch nicht einsortiert</span><span class="grow" /><button class="x" :disabled="!selRubric" @click="placeUnplaced(unplaced.map(r => r.id))" :title="selRubric ? `alle ${unplaced.length} in die Rubrik „${selRubric.label}“ einsortieren` : 'erst links eine Rubrik anklicken, dann hier alle einsortieren'">alle in {{ selRubric ? '„' + selRubric.label + '“' : 'Rubrik …' }}</button></div>
      <div class="scroll" style="max-height:200px">
        <div v-for="r in unplaced" :key="r.id" class="node" :title="tree.ancestors(r.id).map(a => a.label).join(' › ')">
          <span class="icon">{{ icon(r.role) }}</span><span class="label">{{ r.label }}</span><span class="grow" />
          <button class="x" :disabled="!selRubric" @click="placeUnplaced([r.id])" :title="selRubric ? `in ${selRubric.label} hängen` : 'links eine Rubrik wählen'">↗</button>
        </div>
      </div>
    </div>
    <div v-if="picking" class="picker-box">
      <div class="toolbar"><span class="muted">↗ Verweise in {{ picking.rubric.label }}</span><span class="grow" /><button class="primary" :disabled="!picking.values.length" @click="placePicked">{{ picking.values.length }} hängen</button><button class="x" @click="picking = null">✕</button></div>
      <TreePicker v-model="picking.values" :roles="['group', 'product']" :height="260" multi />
    </div>
    <div v-if="deriving" class="picker-box">
      <div class="toolbar"><b>⇊ Ableiten in „{{ deriving.rubric.label }}“</b><span class="grow" /><button class="x" @click="deriving = null">✕</button></div>
      <div class="muted" style="font-size:12px;padding:0 8px 6px">Eine Produktgruppe des Pflegebaums <b>anklicken</b>: ihre Untergruppen werden Rubriken, ihre Produkte Verweise — der Aufbau wird kopiert, nicht die Produkte (nichts ziehen).</div>
      <TreePicker v-model="deriving.from" :roles="['group']" :height="240" />
      <div class="toolbar" style="border-top:1px solid var(--line);border-bottom:0">
        <span v-if="deriving.from" class="muted" style="font-size:12px">▣ {{ tree.byId.get(deriving.from)?.label }}: {{ deriveWhat(deriving.from) }}</span>
        <span v-else class="muted" style="font-size:12px">noch keine Gruppe gewählt</span>
        <span class="grow" /><button class="primary" :disabled="!deriving.from" @click="deriveRun">⇊ ableiten</button>
      </div>
    </div>
    <div class="scroll tree">
      <div v-for="row in rows" :key="row.kind + row.r.id + (row.rubric ?? '')" class="node" :class="[row.kind, { selected: row.r.id === id, drop: dropId === row.r.id }]"
        :style="`padding-left:${8 + row.depth * 16}px`" @click="open(row)" @contextmenu.prevent="contextMenu($event, row)" :title="row.r.id"
        draggable="true" @dragstart="onDragStart($event, row)" @dragover="onDragOver($event, row)" @dragleave="dropId === row.r.id && (dropId = null)" @drop.prevent="onDrop(row)" @dragend="drag = null; dropId = null">
        <span v-if="row.kind === 'rubric'" class="twisty" :class="{ leaf: !row.has }" @click.stop="toggle(row.r.id)">{{ row.has ? (row.isOpen ? '▾' : '▸') : '' }}</span>
        <span v-else class="twisty muted">↗</span>
        <span class="icon">{{ row.kind === 'rubric' ? '▥' : icon(row.r.role) }}</span>
        <span class="label">{{ row.r.label }}</span>
        <span v-if="row.kind === 'rubric' && row.n" class="muted count" :title="`${row.n} Verweise`">{{ row.n }}</span>
        <span v-if="row.kind === 'placed' && row.r.role === 'group'" class="muted count" :title="`Produktgruppe mit ${tree.below(row.r.id).total} darunter`">{{ tree.below(row.r.id).total }}</span>
      </div>
      <div v-if="!trees.length" class="empty">Kein Publikationsbaum — <b>+</b> legt einen an (Kanal, optional Markt), dann Rechtsklick → ableiten.</div>
      <div v-else-if="rows.length === 1" class="empty">Noch leer. <div class="chips" style="justify-content:center;margin-top:8px"><button class="primary" @click="deriving = { rubric: current, from: null }" title="ab einer Produktgruppe: Untergruppen → Rubriken, Produkte → Verweise">⇊ aus dem Pflegebaum ableiten</button><button @click="newRubric(current)">+ Rubrik</button></div></div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">▥ Rubrik · ↗ Verweis auf den Pflegebaum · ziehen = umhängen · Rechtsklick</div>
  </div>
  <Splitter v-model="pubW" :min="220" :max="800" />
  <NodeView v-if="id" :id="id" :key="id" />
  <div v-else class="pane" style="flex:1"><div class="empty">Rubrik links wählen — ihre Texte und Bilder stehen hier wie an jedem Knoten.</div></div>
</template>

<style scoped>
.node { display: flex; align-items: center; gap: 4px; height: 24px; cursor: default; white-space: nowrap; padding-right: 8px; }
.node:hover { background: var(--hover); }
.node.selected { background: var(--accent-soft); }
.node.drop { outline: 1px dashed var(--accent); outline-offset: -1px; background: var(--accent-soft); }
.node.placed .label { color: var(--muted); }
.twisty { width: 14px; color: var(--muted); font-size: 11px; text-align: center; cursor: pointer; }
.count { font-size: 11px; margin-left: auto; }
.unplaced, .picker-box { border-bottom: 1px solid var(--line); background: var(--pane); }
.picker-box { padding-bottom: 4px; }
</style>
