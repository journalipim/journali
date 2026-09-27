<script setup>
// Zelle für vermehrbare Attribute (multiple): die Werte als Liste,
// je Zeile ein Griff zum Umsortieren (ziehen), das Feld (bei enum eine Auswahl) und −; unten +. Enter im letzten Feld fügt
// eine Zeile an, Esc verwirft, Speichern schreibt die Liste (kommagetrennt, wie bisher AttributeSet.values). Geerbt zeigt kursiv.
import { ref, nextTick } from 'vue'
import { NEW, mayAddListValue, ensureListValue } from '../lists.js'
import { store } from '../store.js'
// list: Schlüssel der Werteliste — „+ neuer Wert …“ macht die Zeile zum Textfeld, ✓ legt den Wert an
const props = defineProps({ value: String, inherited: String, disabled: Boolean, options: Array, labelOf: Function, title: String, check: Function, list: String })   // check(wert) → Fehlertext oder null
const free = ref(new Set())   // Zeilen, die bei enum als Text eingegeben werden (neuer Wert)
function onRowChange(i) { if (rows.value[i] === NEW) { rows.value[i] = ''; free.value = new Set([...free.value, i]); nextTick(() => focusRow(i)) } }
const emit = defineEmits(['save'])
const open = ref(false)
const box = ref(null)
const editor = ref(null)
const rows = ref([])          // Entwurf: Strings
const drag = ref(null)        // Index der gezogenen Zeile
const error = ref(null)       // { i, message } — ✓ meckert sofort, nicht erst der Server danach
const split = s => String(s ?? '').split(',').map(x => x.trim()).filter(Boolean)
const label = v => props.labelOf ? props.labelOf(v) : v
const shown = () => split(props.value ?? props.inherited)
function show() {
  if (props.disabled) return
  rows.value = split(props.value ?? props.inherited); if (!rows.value.length) rows.value = ['']
  free.value = new Set(); open.value = true; nextTick(() => focusRow(rows.value.length - 1))
}
function focusRow(i) { const el = editor.value?.querySelectorAll('.lrow input, .lrow select')[i]; el?.focus(); el?.select?.() }
function add(i = rows.value.length) { rows.value.splice(i, 0, ''); nextTick(() => focusRow(i)) }
function remove(i) { rows.value.splice(i, 1); if (!rows.value.length) rows.value = [''] }
async function save() {
  error.value = null
  // neue Werte (Textzeilen bei enum) zuerst anlegen — danach prüft check wie sonst
  if (props.list && free.value.size) { for (const i of free.value) { const x = rows.value[i].trim(); if (!x) continue; try { rows.value[i] = await ensureListValue(props.list, x) } catch (e) { error.value = { i, message: e.message }; focusRow(i); return } } free.value = new Set() }
  if (props.check) for (const [i, x] of rows.value.entries()) { const m = x.trim() ? props.check(x.trim()) : null; if (m) { error.value = { i, message: m }; focusRow(i); return } }
  open.value = false
  const v = rows.value.map(x => x.trim()).filter(Boolean).join(',')
  // Leer über einem geerbten Wert heisst „hier gilt nichts“ und geht hinaus, obwohl der eigene Wert schon leer war
  // (27.09.2026: dieselbe Stelle wie in Cell.vue — die Knotenansicht macht daraus einen eigenen leeren Wert)
  if (v !== (props.value ?? '') || (v === '' && props.value == null && props.inherited != null)) emit('save', v)
}
function cancel() { open.value = false; error.value = null }
function onKey(e, i) {
  // Enter: neue Zeile darunter, Cursor dorthin; ↑ ↓ wechseln die Zeile
  if (e.key === 'Enter') { e.preventDefault(); add(i + 1) }
  else if (e.key === 'ArrowDown') { e.preventDefault(); focusRow(Math.min(rows.value.length - 1, i + 1)) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); focusRow(Math.max(0, i - 1)) }
  else if (e.key === 'Escape') { e.preventDefault(); cancel() }
  else if (e.key === 'Backspace' && rows.value[i] === '' && rows.value.length > 1) { e.preventDefault(); remove(i); nextTick(() => focusRow(Math.max(0, i - 1))) }
}
function onBoxKey(e) { if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); show() } else if (e.key === 'Delete' && props.value != null) emit('save', '') }
// Umsortieren: Griff ziehen, auf eine Zeile fallen lassen
function dropOn(i) { const from = drag.value; drag.value = null; if (from == null || from === i) return; const [x] = rows.value.splice(from, 1); rows.value.splice(i, 0, x) }
</script>

<template>
  <td class="cell" :style="open ? 'position:relative;overflow:visible;z-index:5' : 'position:relative'">
    <div v-if="disabled" class="cell-box disabled"></div>
    <div v-else ref="box" class="cell-box list" :class="{ inherited: value == null && inherited != null }" tabindex="0"
      :title="value == null && inherited != null ? $t('geerbt — Enter bearbeitet') : $t('vermehrbar — Enter oder Doppelklick öffnet die Liste')"
      @dblclick="show" @click="show" @keydown="onBoxKey">
      <span v-for="(v, i) in shown()" :key="i" class="chip">{{ label(v) }}</span>
      <span class="n muted">{{ shown().length || '' }}</span>
    </div>
    <div v-if="open" ref="editor" class="editor" @mousedown.stop>
      <div v-for="(v, i) in rows" :key="i" class="lrow" :class="{ over: drag != null && drag !== i }" @dragover.prevent @drop="dropOn(i)">
        <span class="grip" draggable="true" :title="$t('ziehen: umsortieren')" @dragstart="drag = i" @dragend="drag = null">⋮⋮</span>
        <select v-if="options && !free.has(i)" v-model="rows[i]" @keydown="onKey($event, i)" @change="onRowChange(i)"><option value="">—</option><option v-for="o in options" :key="o" :value="o">{{ label(o) }}</option><option v-if="mayAddListValue(list)" :value="NEW">{{ $t("+ neuer Wert …") }}</option></select>
        <input v-else v-model="rows[i]" :class="{ bad: error?.i === i }" :placeholder="free.has(i) ? $t('neuer Wert') : ''" @keydown="onKey($event, i)" @input="error = null" />
        <button class="x" :title="$t('Zeile entfernen')" tabindex="-1" @click="remove(i)">−</button>
      </div>
      <div v-if="error" class="neg" style="font-size:12px;padding:2px 4px">✗ {{ error.message }}</div>
      <div class="bar">
        <button class="x" :title="$t('Zeile anfügen')" @click="add()">+</button>
        <span class="grow" />
        <button class="x" :title="$t('verwerfen (Esc)')" @click="cancel">✕</button>
        <button class="primary" :title="$t('speichern')" @click="save">✓</button>
      </div>
    </div>
  </td>
</template>

<style scoped>
.cell-box.list { display: flex; flex-wrap: wrap; gap: 3px; align-items: center; cursor: text; min-height: 24px; }
.chip { border: 1px solid var(--line); border-radius: 10px; padding: 0 6px; font-size: 12px; background: var(--pane); white-space: nowrap; }
.n { margin-left: auto; font-size: 11px; }
.editor { position: absolute; left: 2px; top: 100%; z-index: 6; min-width: 260px; width: calc(100% - 4px); background: var(--pane); border: 1px solid var(--accent); border-radius: 4px; padding: 4px; box-shadow: 0 4px 16px rgba(0,0,0,.35); }
.lrow { display: flex; align-items: center; gap: 4px; padding: 1px 0; }
.lrow.over { border-top: 1px dashed var(--accent); }
.lrow input, .lrow select { flex: 1; min-width: 0; height: 24px; border: 1px solid var(--cell-line); border-radius: 3px; background: var(--cell); color: var(--text); padding: 0 4px; font: inherit; }
.lrow input:focus, .lrow select:focus { border-color: var(--accent); outline: none; }
.lrow input.bad { border-color: var(--neg); }
.grip { cursor: grab; color: var(--muted); user-select: none; letter-spacing: -3px; font-size: 12px; padding: 0 2px; }
.grip:active { cursor: grabbing; }
.bar { display: flex; gap: 4px; align-items: center; margin-top: 4px; }
.grow { flex: 1; }
</style>
