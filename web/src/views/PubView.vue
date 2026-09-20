<script setup>
// ⇶ Publikation (Taloan, 20.09.2026): links die Publikationsbäume — je Kanal (× Markt) die Maximalstruktur aus Rubriken, darin
// Produktgruppen und Produkte per Verweis (↗); rechts der gewählte Knoten (Rubrik mit ihren Texten, oder der verwiesene
// Pflegeknoten). Ableiten aus dem Pflegebaum als Start, danach frei umbauen: ziehen = Rubrik oder Verweis umhängen,
// Rechtsklick = Rubrik/Verweis/Ableiten/Entfernen (nur aus dem Publikationsbaum — der Pflegebaum bleibt). „nicht einsortiert“ zählt die Produkte, die in diesem Baum nirgends hängen.
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
const pubW = paneWidth('pub', 340)
const srcW = paneWidth('pubsrc', 300)
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
// Links der Pflegebaum (Taloan, 21.09.: „links mein Pflegebaum, rechts der Publikationsbaum, und ich ziehe die Äste rüber, wie ich sie brauche“):
// Gruppen und Produkte, aufklappbar, ziehbar; ✓ = in diesem Publikationsbaum schon drin (selbst oder über einen Vorfahren als Verweis)
const srcExpanded = ref(new Set(JSON.parse(localStorage.getItem('journali.pubsrc.expanded') || '[]')))
function srcToggle(id) { srcExpanded.value.has(id) ? srcExpanded.value.delete(id) : srcExpanded.value.add(id); srcExpanded.value = new Set(srcExpanded.value); localStorage.setItem('journali.pubsrc.expanded', JSON.stringify([...srcExpanded.value])) }
const srcFilter = ref('')
const inTree = id => { for (let x = tree.byId.get(id); x; x = tree.byId.get(x.parent)) if (placedSet.value.has(x.id)) return true; return false }
const srcRows = computed(() => {
  const ok = r => r.role === 'group' || r.role === 'product'
  const q = srcFilter.value.trim().toLowerCase()
  if (q) return tree.rows.filter(r => ok(r) && r.label.toLowerCase().includes(q)).slice(0, 200).map(r => ({ r, depth: 0, has: false, isOpen: false, path: tree.ancestors(r.id).map(a => a.label).join(' › ') }))
  const out = []
  const walk = (n, depth) => { const kids = tree.kids(n.id).filter(ok); const isOpen = srcExpanded.value.has(n.id); out.push({ r: n, depth, has: kids.length > 0, isOpen }); if (isOpen) for (const k of kids) walk(k, depth + 1) }
  for (const r of tree.rows.filter(r => !r.parent && r.role === 'group')) walk(r, 0)
  return out
})
// Was ein gezogener Ast im Publikationsbaum wird: Gruppe → Rubrik mit ihrem Aufbau (umbaubar) oder → Verweis (folgt dem Pflegebaum); Produkt → immer Verweis
const dropMode = ref(localStorage.getItem('journali.pubsrc.mode') || 'copy')
watch(dropMode, m => localStorage.setItem('journali.pubsrc.mode', m))
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
  const below = (() => { let rub = 0, ref = 0; const walk = x => { for (const k of tree.kids(x.id)) { rub++; walk(k) } ref += (x.placed ?? []).length }; walk(r); return { rub, ref } })()
  if (!await dialog.confirm({ title: `Rubrik „${r.label}“ aus „${current.value?.label ?? ''}“ entfernen?`, text: `${below.rub ? `${below.rub} ${below.rub === 1 ? 'Unterrubrik' : 'Unterrubriken'} und ` : ''}${below.ref} ${below.ref === 1 ? 'Verweis verschwindet' : 'Verweise verschwinden'} aus diesem Publikationsbaum. Die Produkte und Gruppen bleiben im Pflegebaum unverändert; sie gelten hier danach als „noch nicht einsortiert“.`, ok: '✕ Entfernen', danger: true })) return
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
function deriveWhat(id) { const c = { group: 0, product: 0 }; const walk = x => { for (const k of tree.kids(x)) { if (k.role in c) c[k.role]++; walk(k.id) } }; walk(id); return `wird Rubrik „${tree.byId.get(id)?.label}“ mit ${c.group} ${c.group === 1 ? 'Unterrubrik' : 'Unterrubriken'} und ${c.product} ${c.product === 1 ? 'Verweis' : 'Verweisen'}` }
async function deriveRun() {
  const d = deriving.value; if (!d?.from) return
  await run(async () => { await post(`/api/rubrics/${encodeURIComponent(d.rubric.id)}/derive`, { from: d.from, self: true }); expanded.value.add(d.rubric.id) })
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
      { label: 'Verweis entfernen', icon: '✕', danger: true, hint: 'nur hier — das Produkt bleibt im Pflegebaum', action: () => unplace(row.rubric, r.id) },
    ]); return
  }
  if (sel.value.size > 1 && sel.value.has(r.id)) { menu.open(e, [{ label: `${sel.value.size} Rubriken entfernen`, icon: '✕', danger: true, hint: `nur aus „${current.value?.label ?? ''}“ — die Produkte bleiben`, action: () => retireMany([...sel.value]) }]); return }
  router.push(`/pub/${r.id}`)
  menu.open(e, [
    { label: 'Rubrik darunter …', icon: '+', action: () => newRubric(r) },
    { label: 'Verweise dazu …', icon: '↗', hint: 'Produktgruppen und Produkte aus dem Pflegebaum', action: () => { picking.value = { rubric: r, values: [] } } },
    { label: 'aus dem Pflegebaum ableiten …', icon: '⇊', hint: 'eine Produktgruppe mit ihrem Aufbau als Rubrik übernehmen', action: () => { deriving.value = { rubric: r, from: null } } },
    { sep: true },
    { label: 'Umbenennen', icon: '✎', action: () => rename(r) },
    ...(r.parent ? [{ label: 'Rubrik entfernen', icon: '✕', danger: true, hint: `nur aus „${current.value?.label ?? ''}“ — die Produkte bleiben im Pflegebaum`, action: () => retire(r) }]
      : [{ label: 'Kanal / Markt …', icon: '⇶', action: () => editTree(r) }, { sep: true },
         { label: 'Leeren', icon: '✕', danger: true, hint: 'alle Rubriken und Verweise raus, der Baum bleibt', action: () => clearTree(r) },
         { label: 'Publikationsbaum löschen', icon: '✕', danger: true, hint: 'der ganze Baum — die Produkte bleiben im Pflegebaum', action: () => deleteTree(r) }]),
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
function onSrcDragStart(e, row) { drag.value = { kind: 'src', r: row.r }; e.dataTransfer.effectAllowed = 'copy' }
function onDragOver(e, row) { if (row.kind !== 'rubric' || !drag.value || drag.value.r.id === row.r.id) return; e.preventDefault(); dropId.value = row.r.id }
async function onDrop(row) {
  const d = drag.value; drag.value = null; dropId.value = null
  if (!d || row.kind !== 'rubric') return
  if (d.kind === 'src') {
    // aus dem Pflegebaum: Gruppe → Rubrik mit Aufbau (copy) oder Verweis (ref); Produkt → Verweis
    if (d.r.role === 'group' && dropMode.value === 'copy') await run(async () => { await post(`/api/rubrics/${encodeURIComponent(row.r.id)}/derive`, { from: d.r.id, self: true }); expanded.value.add(row.r.id) })
    else await run(async () => { await post(`/api/rubrics/${encodeURIComponent(row.r.id)}/place`, { node: d.r.id }); expanded.value.add(row.r.id) })
    return
  }
  if (d.kind === 'rubric') await run(() => post(`/api/nodes/${encodeURIComponent(d.r.id)}/move`, { parent: row.r.id }))
  else await run(async () => { await post(`/api/rubrics/${encodeURIComponent(row.r.id)}/place`, { node: d.r.id }); await api.del(`/api/rubrics/${encodeURIComponent(d.rubric)}/place/${encodeURIComponent(d.r.id)}`) })
}
const sel = ref(new Set())   // Mehrfachauswahl von Rubriken: Strg-Klick toggelt, Umschalt-Klick nimmt den Bereich bis zur zuletzt geöffneten
function open(row, e) {
  if (row.kind === 'rubric' && e && (e.ctrlKey || e.metaKey)) { sel.value.has(row.r.id) ? sel.value.delete(row.r.id) : sel.value.add(row.r.id); sel.value = new Set(sel.value); return }
  if (row.kind === 'rubric' && e && e.shiftKey && props.id) {
    const ids = rows.value.filter(x => x.kind === 'rubric').map(x => x.r.id); const a = ids.indexOf(props.id), b = ids.indexOf(row.r.id)
    if (a >= 0 && b >= 0) { for (const x of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) sel.value.add(x); sel.value = new Set(sel.value); return }
  }
  sel.value = new Set(); router.push(`/pub/${row.r.id}`)
}
// mehrere Rubriken auf einmal entfernen (nur aus diesem Publikationsbaum); Wurzeln bleiben, verschachtelte nur einmal
async function retireMany(ids) {
  const list = ids.map(x => tree.byId.get(x)).filter(r => r && r.parent && !tree.ancestors(r.id).some(a => ids.includes(a.id)))
  if (!list.length) return
  if (!await dialog.confirm({ title: `${list.length} Rubriken aus „${current.value?.label ?? ''}“ entfernen?`, list: list.map(r => r.label), text: 'Mit allem darunter (Unterrubriken, Verweise). Die Produkte bleiben im Pflegebaum und gelten hier danach als „noch nicht einsortiert“.', ok: '✕ Entfernen', danger: true })) return
  await run(async () => { for (const r of list) await api.del(`/api/nodes/${encodeURIComponent(r.id)}?recursive=true`) })
  sel.value = new Set()
}
// Baum leeren oder ganz löschen — die Wurzel ist der Publikationsbaum (Kanal × Markt)
async function clearTree(r) {
  const kids = tree.kids(r.id); const refs = (r.placed ?? []).length
  if (!kids.length && !refs) { store.toast('schon leer'); return }
  if (!await dialog.confirm({ title: `„${r.label}“ leeren?`, text: `${kids.length} Rubriken und ${refs} Verweise an der Wurzel verschwinden. Die Produkte bleiben im Pflegebaum. Der Baum selbst (Kanal ${r.channel ?? ''}${r.market ? ' · Markt ' + r.market : ''}) bleibt.`, ok: '✕ Leeren', danger: true })) return
  await run(async () => { for (const k of kids) await api.del(`/api/nodes/${encodeURIComponent(k.id)}?recursive=true`); for (const p of r.placed ?? []) await api.del(`/api/rubrics/${encodeURIComponent(r.id)}/place/${encodeURIComponent(p)}`) })
}
async function deleteTree(r) {
  if (!await dialog.confirm({ title: `Publikationsbaum „${r.label}“ löschen?`, warn: `Kanal ${r.channel ?? ''}${r.market ? ' · Markt ' + r.market : ''}`, text: 'Mit allen Rubriken und Verweisen. Die Produkte bleiben im Pflegebaum. Wie alles im Journal: zurückholbar über den Papierkorb.', ok: '✕ Löschen', danger: true })) return
  await run(() => api.del(`/api/nodes/${encodeURIComponent(r.id)}?recursive=true`))
  treeKey.value = trees.value[0]?.id ?? ''; if (props.id === r.id) router.push('/pub')
}
onMounted(() => { if (!tree.loaded) tree.load() })
</script>

<template>
  <div class="pane" :style="`width:${srcW}px;flex:none`">
    <div class="toolbar">
      <h1>▣ Pflegebaum</h1>
      <span class="grow" />
      <span class="view-chip" :class="{ on: dropMode === 'copy' }" @click="dropMode = 'copy'" title="gezogene Gruppe wird Rubrik mit ihrem Aufbau — danach frei umbaubar (umhängen, umbenennen, entfernen)">⇊ kopieren</span>
      <span class="view-chip" :class="{ on: dropMode === 'ref' }" @click="dropMode = 'ref'" title="gezogene Gruppe wird ein Verweis — zeigt immer den aktuellen Stand des Pflegebaums">↗ verweisen</span>
    </div>
    <div class="toolbar" style="border-bottom:1px solid var(--line)"><input v-model="srcFilter" placeholder="filtern" style="width:100%" /></div>
    <div class="scroll tree">
      <div v-for="row in srcRows" :key="row.r.id" class="node" :style="`padding-left:${8 + row.depth * 16}px`" draggable="true" @dragstart="onSrcDragStart($event, row)" :title="row.path ?? row.r.id" @dblclick="router.push(`/tree/${row.r.id}`)">
        <span class="twisty" :class="{ leaf: !row.has }" @click.stop="srcToggle(row.r.id)">{{ row.has ? (row.isOpen ? '▾' : '▸') : '' }}</span>
        <span class="icon">{{ icon(row.r.role) }}</span>
        <span class="label">{{ row.r.label }}</span>
        <span v-if="row.r.role === 'group'" class="muted count" :title="`${tree.below(row.r.id).summary} darunter`">{{ tree.below(row.r.id).total }}</span>
        <span v-if="current && inTree(row.r.id)" class="pos count" :title="`in „${current.label}“ als Verweis drin`">✓</span>
      </div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">Ast nach rechts auf eine Rubrik ziehen · Doppelklick öffnet</div>
  </div>
  <Splitter v-model="srcW" :min="200" :max="600" />
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
      <div class="muted" style="font-size:12px;padding:0 8px 6px">Eine Produktgruppe des Pflegebaums <b>anklicken</b>: sie wird eine Rubrik mit ihrem Namen, ihre Untergruppen Unterrubriken, ihre Produkte Verweise — der Aufbau wird kopiert, nicht die Produkte.</div>
      <TreePicker v-model="deriving.from" :roles="['group']" :height="240" />
      <div class="toolbar" style="border-top:1px solid var(--line);border-bottom:0">
        <span v-if="deriving.from" class="muted" style="font-size:12px">▣ {{ tree.byId.get(deriving.from)?.label }} {{ deriveWhat(deriving.from) }}</span>
        <span v-else class="muted" style="font-size:12px">noch keine Gruppe gewählt</span>
        <span class="grow" /><button class="primary" :disabled="!deriving.from" @click="deriveRun">⇊ ableiten</button>
      </div>
    </div>
    <div class="scroll tree">
      <div v-for="row in rows" :key="row.kind + row.r.id + (row.rubric ?? '')" class="node" :class="[row.kind, { selected: row.r.id === id || sel.has(row.r.id), drop: dropId === row.r.id }]"
        :style="`padding-left:${8 + row.depth * 16}px`" @click="open(row, $event)" @contextmenu.prevent="contextMenu($event, row)" :title="row.r.id"
        draggable="true" @dragstart="onDragStart($event, row)" @dragover="onDragOver($event, row)" @dragleave="dropId === row.r.id && (dropId = null)" @drop.prevent="onDrop(row)" @dragend="drag = null; dropId = null">
        <span v-if="row.kind === 'rubric'" class="twisty" :class="{ leaf: !row.has }" @click.stop="toggle(row.r.id)">{{ row.has ? (row.isOpen ? '▾' : '▸') : '' }}</span>
        <span v-else class="twisty muted">↗</span>
        <span class="icon">{{ row.kind === 'rubric' ? '▥' : icon(row.r.role) }}</span>
        <span class="label">{{ row.r.label }}</span>
        <span v-if="row.kind === 'rubric' && row.n" class="muted count" :title="`${row.n} Verweise`">{{ row.n }}</span>
        <span v-if="row.kind === 'placed' && row.r.role === 'group'" class="muted count" :title="`Produktgruppe mit ${tree.below(row.r.id).total} darunter`">{{ tree.below(row.r.id).total }}</span>
      </div>
      <div v-if="!trees.length" class="empty">Kein Publikationsbaum — <b>+</b> legt einen an (Kanal, optional Markt), dann Rechtsklick → ableiten.</div>
      <div v-else-if="rows.length === 1" class="empty">Noch leer — einen Ast aus dem Pflegebaum links auf „{{ current.label }}“ ziehen. <div class="chips" style="justify-content:center;margin-top:8px"><button class="primary" @click="deriving = { rubric: current, from: null }" title="eine Produktgruppe mit ihrem Aufbau als Rubrik übernehmen">⇊ aus dem Pflegebaum ableiten</button><button @click="newRubric(current)">+ Rubrik</button></div></div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">▥ Rubrik · ↗ Verweis · von links ziehen = übernehmen · hier ziehen = umhängen · Strg-Klick = mehrere · Rechtsklick</div>
  </div>
  <Splitter v-model="pubW" :min="220" :max="800" />
  <NodeView v-if="id" :id="id" :key="id" />
  <div v-else class="pane" style="flex:1"><div class="empty">Rubrik wählen — ihre Texte und Bilder stehen hier wie an jedem Knoten.</div></div>
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
