<script setup>
// Spaltenwahl als Matrix (Taloan, 20.09.: „wie das Tabelle-einfügen-Dropdown in der Textverarbeitung, nur ankreuzen wie
// ein Lottoschein“): Zeilen die Sprachen, Spalten die Kanäle, je ein Stern (ohne Sprache / ohne Kanal). Jede Zelle
// einzeln wählbar — Kanal web mit de und en, Kanal print nur mit de. Kopf einer Zeile/Spalte kreuzt die ganze Reihe an
// oder ab. */* ist immer da: der eine Wert. Der Wert ist eine Liste von „sprache|kanal“ ('' = Stern).
import { ref, computed, onMounted, onUnmounted } from 'vue'
const props = defineProps({ modelValue: Array, locales: Array, channels: Array, masterLocale: String, masterChannel: String })
const emit = defineEmits(['update:modelValue'])
const open = ref(false)
const box = ref(null)
const at = ref({ top: 0, left: 0 })
function openPop() { if (!open.value) { const r = box.value?.getBoundingClientRect(); if (r) at.value = { top: r.bottom + 4, left: r.left } } open.value = !open.value }
const cellKey = (l, c) => `${l ?? ''}|${c ?? ''}`
const rows = computed(() => [null, ...(props.locales ?? [])])
const cols = computed(() => [null, ...(props.channels ?? [])])
const has = (l, c) => (l == null && c == null) || (props.modelValue ?? []).includes(cellKey(l, c))
function set(cells) { emit('update:modelValue', [...new Set(['|', ...cells])]) }
function toggle(l, c) {
  if (l == null && c == null) return
  const k = cellKey(l, c); const cur = props.modelValue ?? []
  set(cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k])
}
// Kopf: alles an, wenn nicht alles an ist — sonst alles aus (der Stern bleibt)
function toggleRow(l) { const all = cols.value.every(c => has(l, c)); const keys = cols.value.map(c => cellKey(l, c)); const cur = (props.modelValue ?? []).filter(x => !keys.includes(x)); set(all ? cur : [...cur, ...keys]) }
function toggleCol(c) { const all = rows.value.every(l => has(l, c)); const keys = rows.value.map(l => cellKey(l, c)); const cur = (props.modelValue ?? []).filter(x => !keys.includes(x)); set(all ? cur : [...cur, ...keys]) }
// Zusammenfassung im Knopf: je Kanal die Sprachen — „de en · web: de en · print: de“
const summary = computed(() => cols.value.map(c => { const ls = rows.value.filter(l => has(l, c)).map(l => l ?? '*'); if (!ls.length) return null; return (c ? c + ': ' : '') + ls.join(' ') }).filter(Boolean).join(' · '))
function onDoc(e) { if (open.value && box.value && !box.value.contains(e.target)) open.value = false }
function onKey(e) { if (e.key === 'Escape' && open.value) { e.stopPropagation(); open.value = false } }
onMounted(() => { document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey, true) })
onUnmounted(() => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey, true) })
</script>

<template>
  <span ref="box" class="mp">
    <button :class="{ primary: open }" @click="openPop" title="Spalten: Sprache × Kanal — ankreuzen, was als Spalte steht"><span class="sum">⊞ {{ summary }}</span></button>
    <div v-if="open" class="pop" :style="`top:${at.top}px;left:${at.left}px`">
      <table>
        <thead><tr><th></th><th v-for="c in cols" :key="c ?? '*'" class="hd" :class="{ master: c && c === masterChannel }" :title="c ? (c === masterChannel ? 'Masterkanal — ganze Spalte an/aus' : `Kanal ${c} — ganze Spalte an/aus`) : 'ohne Kanal — ganze Spalte an/aus'" @click="toggleCol(c)">{{ c ?? '*' }}</th></tr></thead>
        <tbody>
          <tr v-for="l in rows" :key="l ?? '*'">
            <th class="hd" :class="{ master: l && l === masterLocale }" :title="l ? (l === masterLocale ? 'Mastersprache — ganze Zeile an/aus' : `Sprache ${l} — ganze Zeile an/aus`) : 'ohne Sprache — ganze Zeile an/aus'" @click="toggleRow(l)">{{ l ?? '*' }}</th>
            <td v-for="c in cols" :key="c ?? '*'" class="cell" :class="{ on: has(l, c), fixed: l == null && c == null }" :title="l == null && c == null ? 'der eine Wert — immer da' : `${l ?? '*'}/${c ?? '*'}`" @click="toggle(l, c)">{{ has(l, c) ? '✓' : '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </span>
</template>

<style scoped>
.mp { position: relative; display: inline-block; }
.sum { display: inline-block; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
.pop { position: fixed; z-index: 35; margin-top: 4px; background: var(--pane); border: 1px solid var(--line); border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,.35); padding: 6px; }
table { border-collapse: collapse; font-size: 12px; }
th, td { padding: 0; }
.hd { cursor: pointer; color: var(--muted); font-weight: 600; padding: 2px 6px; text-align: center; user-select: none; }
.hd:hover { color: var(--text); }
.hd.master { color: var(--accent); }
.cell { width: 30px; height: 26px; text-align: center; border: 1px solid var(--line); cursor: pointer; color: var(--pos); font-weight: 600; user-select: none; }
.cell:hover { background: var(--bg); }
.cell.on { background: var(--accent-soft); }
.cell.fixed { cursor: default; color: var(--muted); }
</style>
