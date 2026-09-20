<script setup>
// Zelle für enum: Auswahl aus einer Werteliste. Leer = eigener Wert weg.
// required: keine leere Auswahl (Typ, Knotentyp) — sonst wäre „—“ ein sinnloser Wert (Taloan, 17.09.)
// clickEdit=false (Tabelle, Taloan): Zellbox wie bei Text — Klick markiert nur, Doppelklick/Enter/F2 öffnet die Liste,
// ein getippter Buchstabe springt zur nächsten passenden Option, Entf leert. Das native <select> erscheint nur zum Wählen.
// list (Schlüssel der Werteliste): „+ neuer Wert …“ am Ende der Liste — ein Text, Enter legt den Wert an und wählt ihn
// (Taloan, 20.09.: ad hoc zufügen wie in Excel); passt ein getippter Buchstabe auf keine Option, beginnt damit ein neuer Wert.
// Grosse Listen (> 20, z. B. 5 640 ETIM-Klassen — Taloan, 20.09.: „wo habe ich die Chance, die Klasse festzulegen?“): statt <select>
// ein Suchfeld — tippen filtert über Wert und Bezeichnung, ↑↓ wählen, Enter nimmt, Esc schliesst.
import { ref, computed, nextTick } from 'vue'
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
const big = computed(() => (props.options?.length ?? 0) > 20)
// Suche in grossen Listen
const q = ref('')
const idx = ref(0)
const qIn = ref(null)
const hits = computed(() => {
  const s = q.value.trim().toLowerCase(); const opts = props.options ?? []
  const all = s ? opts.filter(o => String(o).toLowerCase().includes(s) || String(label(o)).toLowerCase().includes(s)) : opts
  // ganze Wort-/Anfangstreffer zuerst
  const rank = o => { const v = String(o).toLowerCase(), l = String(label(o)).toLowerCase(); return v === s || l === s ? 0 : v.startsWith(s) || l.startsWith(s) ? 1 : 2 }
  return (s ? [...all].sort((a, b) => rank(a) - rank(b)) : all).slice(0, 40)
})
async function show() {
  if (props.disabled) return
  open.value = true; await nextTick()
  if (big.value) { q.value = ''; idx.value = 0; qIn.value?.focus(); return }
  sel.value?.focus()
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
function onSearchKey(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); idx.value = Math.min(hits.value.length - 1, idx.value + 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); idx.value = Math.max(0, idx.value - 1) }
  else if (e.key === 'Enter') { e.preventDefault(); const h = hits.value[idx.value]; if (h != null) pick(h); else if (q.value.trim() && mayAddListValue(props.list)) { const t = q.value.trim(); adding.value = true; draft.value = t; commitNew() } }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
  else if (e.key === 'Delete' && !q.value && !props.required && props.value != null) { emit('save', ''); close() }
}
function onKey(e) {
  if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); show() }
  else if (e.key === 'Delete') { if (!props.required && props.value != null) emit('save', '') }
  else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault()
    if (big.value) { show().then(() => { q.value = e.key; idx.value = 0 }); return }
    const qq = e.key.toLowerCase()
    const found = (props.options ?? []).filter(o => String(label(o)).toLowerCase().startsWith(qq) || String(o).toLowerCase().startsWith(qq))
    if (!found.length) { if (e.key.trim()) startNew(e.key); return }
    const i = found.indexOf(props.value ?? props.inherited ?? '')
    emit('save', found[(i + 1) % found.length])
  }
}
</script>

<template>
  <td class="cell" :style="open && big ? 'position:relative;overflow:visible;z-index:5' : ''">
    <div v-if="disabled" class="cell-box disabled"></div>
    <input v-else-if="adding" ref="inp" v-model="draft" class="cell-input" placeholder="neuer Wert — Enter legt an" @keydown="onNewKey" @blur="commitNew" />
    <template v-else-if="big">
      <div v-if="!open" ref="box" class="cell-box" :class="{ inherited: value == null && inherited != null }" tabindex="0"
        :title="value == null && inherited != null ? 'geerbt — Enter wählt' : `${options.length} Werte — Enter oder Tippen sucht`"
        @click="clickEdit && show()" @dblclick="show" @keydown="onKey">{{ label(value ?? inherited) }}<span class="caret">▾</span></div>
      <template v-else>
        <input ref="qIn" v-model="q" class="cell-input" :placeholder="`suchen in ${options.length} …`" @input="idx = 0" @keydown="onSearchKey" @blur="close" />
        <div class="drop" @mousedown.prevent>
          <div v-if="!required && !q" class="hit muted" :class="{ on: idx === -1 }" @click="pick('')">— leer</div>
          <div v-for="(o, i) in hits" :key="o" class="hit" :class="{ on: i === idx, cur: o === (value ?? inherited) }" @mousemove="idx = i" @click="pick(o)"><span class="mono muted">{{ o }}</span> {{ label(o) }}</div>
          <div v-if="!hits.length" class="hit muted">nichts zu „{{ q }}“{{ mayAddListValue(list) ? ' — Enter legt es als neuen Wert an' : '' }}</div>
          <div v-else-if="hits.length === 40" class="hit muted">… weiter eingrenzen</div>
        </div>
      </template>
    </template>
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
.drop { position: absolute; left: 0; top: 100%; z-index: 6; min-width: 100%; max-width: 520px; max-height: 320px; overflow: auto; background: var(--pane); border: 1px solid var(--accent); border-radius: 4px; box-shadow: 0 4px 16px rgba(0,0,0,.35); }
.hit { padding: 3px 8px; white-space: nowrap; cursor: pointer; font-size: 12px; }
.hit.on { background: var(--accent-soft); }
.hit.cur { font-weight: 600; }
.hit .mono { margin-right: 6px; }
</style>
