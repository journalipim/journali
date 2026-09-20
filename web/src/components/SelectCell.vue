<script setup>
// Zelle für enum: Auswahl aus einer Werteliste. Leer = eigener Wert weg.
// required: keine leere Auswahl (Typ, Knotentyp) — sonst wäre „—“ ein sinnloser Wert (Taloan, 17.09.)
// clickEdit=false (Tabelle, Taloan): Zellbox wie bei Text — Klick markiert nur, Doppelklick/Enter/F2 öffnet die Liste,
// ein getippter Buchstabe springt zur nächsten passenden Option, Entf leert. Das native <select> erscheint nur zum Wählen.
// list (Schlüssel der Werteliste): „+ neuer Wert …“ am Ende der Liste — ein Text, Enter legt den Wert an und wählt ihn
// (Taloan, 20.09.: ad hoc zufügen wie in Excel); passt ein getippter Buchstabe auf keine Option, beginnt damit ein neuer Wert.
import { ref, nextTick } from 'vue'
import { NEW, mayAddListValue, ensureListValue } from '../lists.js'
import { store } from '../store.js'
const props = defineProps({ value: String, inherited: String, disabled: Boolean, options: Array, labelOf: Function, required: Boolean, clickEdit: { type: Boolean, default: true }, list: String })
const emit = defineEmits(['save'])
const open = ref(false)
const adding = ref(false)
const draft = ref('')
const box = ref(null)
const sel = ref(null)
const inp = ref(null)
const label = v => v == null || v === '' ? '' : (props.labelOf ? props.labelOf(v) : v)
async function show() {
  if (props.disabled) return
  open.value = true; await nextTick(); sel.value?.focus()
  try { sel.value?.showPicker?.() } catch { /* nicht überall erlaubt */ }
}
function pick(v) { if (v === NEW) return startNew(''); emit('save', v); close() }
function close() { open.value = false; adding.value = false; nextTick(() => box.value?.focus()) }
async function startNew(text) {
  if (!mayAddListValue(props.list)) return
  draft.value = text; adding.value = true; open.value = true; await nextTick(); inp.value?.focus(); inp.value?.setSelectionRange(draft.value.length, draft.value.length)
}
async function commitNew() {
  const t = draft.value.trim(); if (!t) { close(); return }
  try { const key = await ensureListValue(props.list, t); emit('save', key); close() }
  catch (e) { store.toast(e.message) }
}
function onNewKey(e) {
  if (e.key === 'Enter') { e.preventDefault(); commitNew() }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
  else if (e.key === 'Tab') { e.preventDefault(); commitNew() }
}
function onKey(e) {
  if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); show() }
  else if (e.key === 'Delete') { if (!props.required && props.value != null) emit('save', '') }
  else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault()
    const q = e.key.toLowerCase()
    const hits = (props.options ?? []).filter(o => String(label(o)).toLowerCase().startsWith(q) || String(o).toLowerCase().startsWith(q))
    if (!hits.length) { if (e.key.trim()) startNew(e.key); return }
    const i = hits.indexOf(props.value ?? props.inherited ?? '')
    emit('save', hits[(i + 1) % hits.length])
  }
}
</script>

<template>
  <td class="cell">
    <div v-if="disabled" class="cell-box disabled"></div>
    <input v-else-if="adding" ref="inp" v-model="draft" class="cell-input" placeholder="neuer Wert — Enter legt an" @keydown="onNewKey" @blur="commitNew" />
    <div v-else-if="!clickEdit && !open" ref="box" class="cell-box" :class="{ inherited: value == null && inherited != null }" tabindex="0"
      :title="value == null && inherited != null ? 'geerbt — Enter wählt' : 'Doppelklick oder Enter öffnet die Liste, Buchstabe springt' + (mayAddListValue(list) ? ' — unbekannter Buchstabe beginnt einen neuen Wert' : '')"
      @dblclick="show" @keydown="onKey">{{ label(value ?? inherited) }}<span class="caret">▾</span></div>
    <select v-else ref="sel" class="cell-select" :class="{ inherited: value == null && inherited != null }"
      :value="value ?? inherited ?? ''" @change="pick($event.target.value)" @blur="clickEdit || (open = false)" @keydown.esc.prevent="clickEdit || close()">
      <option v-if="!required" value="">{{ inherited != null ? '' : '—' }}</option>
      <option v-for="o in options" :key="o" :value="o">{{ labelOf ? labelOf(o) : o }}</option>
      <option v-if="mayAddListValue(list)" :value="NEW">+ neuer Wert …</option>
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
