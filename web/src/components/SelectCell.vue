<script setup>
// Zelle für enum: Auswahl aus einer Werteliste. Leer = eigener Wert weg.
// required: keine leere Auswahl (Typ, Knotentyp) — sonst wäre „—“ ein sinnloser Wert (Taloan, 17.09.)
// clickEdit=false (Tabelle, Taloan): Zellbox wie bei Text — Klick markiert nur, Doppelklick/Enter/F2 öffnet die Liste,
// ein getippter Buchstabe springt zur nächsten passenden Option, Entf leert. Das native <select> erscheint nur zum Wählen.
import { ref, nextTick } from 'vue'
const props = defineProps({ value: String, inherited: String, disabled: Boolean, options: Array, labelOf: Function, required: Boolean, clickEdit: { type: Boolean, default: true } })
const emit = defineEmits(['save'])
const open = ref(false)
const box = ref(null)
const sel = ref(null)
const label = v => v == null || v === '' ? '' : (props.labelOf ? props.labelOf(v) : v)
async function show() {
  if (props.disabled) return
  open.value = true; await nextTick(); sel.value?.focus()
  try { sel.value?.showPicker?.() } catch { /* nicht überall erlaubt */ }
}
function pick(v) { emit('save', v); close() }
function close() { open.value = false; nextTick(() => box.value?.focus()) }
function onKey(e) {
  if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); show() }
  else if (e.key === 'Delete') { if (!props.required && props.value != null) emit('save', '') }
  else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault()
    const q = e.key.toLowerCase()
    const hits = (props.options ?? []).filter(o => String(label(o)).toLowerCase().startsWith(q) || String(o).toLowerCase().startsWith(q))
    if (!hits.length) return
    const i = hits.indexOf(props.value ?? props.inherited ?? '')
    emit('save', hits[(i + 1) % hits.length])
  }
}
</script>

<template>
  <td class="cell">
    <div v-if="disabled" class="cell-box disabled"></div>
    <div v-else-if="!clickEdit && !open" ref="box" class="cell-box" :class="{ inherited: value == null && inherited != null }" tabindex="0"
      :title="value == null && inherited != null ? 'geerbt — Enter wählt' : 'Doppelklick oder Enter öffnet die Liste, Buchstabe springt'"
      @dblclick="show" @keydown="onKey">{{ label(value ?? inherited) }}<span class="caret">▾</span></div>
    <select v-else ref="sel" class="cell-select" :class="{ inherited: value == null && inherited != null }"
      :value="value ?? inherited ?? ''" @change="pick($event.target.value)" @blur="clickEdit || (open = false)" @keydown.esc.prevent="clickEdit || close()">
      <option v-if="!required" value="">{{ inherited != null ? '' : '—' }}</option>
      <option v-for="o in options" :key="o" :value="o">{{ labelOf ? labelOf(o) : o }}</option>
    </select>
  </td>
</template>

<style scoped>
.cell-select { width: 100%; height: 24px; border: 1px solid var(--cell-line); border-radius: 3px; background: var(--cell); color: var(--text); padding: 0 4px; font: inherit; }
.cell-select:focus { border-color: var(--accent); outline: none; background: var(--pane); }
.cell-select option { background: var(--pane); color: var(--text); }
.cell-select.inherited { color: var(--muted); font-style: italic; }
.cell-box { display: flex; justify-content: space-between; align-items: center; }
.caret { color: var(--muted); font-size: 10px; margin-left: 4px; }
</style>
