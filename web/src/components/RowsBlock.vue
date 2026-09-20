<script setup>
// Vermehrbares Attribut (docs/pflegestruktur.md, 13): Zeilen × Spalten, jede Spalte
// ein Attribut mit seiner Zelle. + Zeile, × Zeile, ↑↓ Reihenfolge — jede Aktion ein Eintrag.
import { computed } from 'vue'
import { store } from '../store.js'
import Cell from './Cell.vue'
import ToggleCell from './ToggleCell.vue'
import SelectCell from './SelectCell.vue'
import DateCell from './DateCell.vue'
import HtmlCell from './HtmlCell.vue'

const props = defineProps({ def: Object, rows: Array, values: Map, locale: String })
const emit = defineEmits(['set', 'add', 'remove', 'order'])

const model = computed(() => store.model)
const columns = computed(() => (props.def.columns ?? []).map(k => model.value.attributes.find(a => a.key === k)).filter(Boolean))
function locOf(col) { return col.perLocale ? props.locale : null }
function key(a, l, row) { return `${a}|${l ?? ''}||${row}` }
function val(col, row) { return props.values.get(key(col.key, locOf(col), row)) ?? null }
function cellType(col) { return col.type === 'boolean' ? ToggleCell : col.type === 'enum' ? SelectCell : col.type === 'date' ? DateCell : col.type === 'html' ? HtmlCell : Cell }
function listOptions(col) { return (model.value.lists.find(l => l.key === col.list)?.values ?? []).map(v => v.value) }
function move(i, d) {
  const r = [...props.rows]; const j = i + d
  if (j < 0 || j >= r.length) return
  ;[r[i], r[j]] = [r[j], r[i]]
  emit('order', r)
}
</script>

<template>
  <table class="grid rows" :style="`width:${40 + columns.length * 180 + 80}px`">
    <colgroup><col style="width:40px" /><col v-for="c in columns" :key="c.key" style="width:180px" /><col style="width:80px" /></colgroup>
    <thead>
      <tr>
        <th class="num">#</th>
        <th v-for="c in columns" :key="c.key" :title="c.key">{{ c.label?.de || c.key }}<span v-if="c.unit" class="muted" style="margin-left:4px">{{ c.unit }}</span><span v-if="c.perLocale" class="muted" style="margin-left:4px">{{ locale }}</span></th>
        <th style="width:70px"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, i) in rows" :key="row">
        <td class="num muted">{{ i + 1 }}</td>
        <component v-for="c in columns" :key="c.key" :is="cellType(c)" :value="val(c, row)" :options="c.type === 'enum' ? listOptions(c) : undefined" :list="c.type === 'enum' ? c.list : undefined"
          :title="c.label?.de || c.key" @save="v => emit('set', c, row, v)" />
        <td class="num ops">
          <button class="x" @click="move(i, -1)" :disabled="i === 0" title="nach oben">↑</button>
          <button class="x" @click="move(i, 1)" :disabled="i === rows.length - 1" title="nach unten">↓</button>
          <button class="x" @click="emit('remove', row)" title="Zeile entfernen">×</button>
        </td>
      </tr>
    </tbody>
  </table>
  <div class="chips" style="padding:4px 8px"><button @click="emit('add')">+ Zeile</button><span class="muted">{{ rows.length }}</span></div>
</template>

<style scoped>
table.rows th { overflow: hidden; text-overflow: ellipsis; }
.ops { white-space: nowrap; }
.x { border: 0; background: none; color: var(--muted); padding: 0 3px; }
.x:hover:not(:disabled) { color: var(--accent); }
.x:disabled { opacity: .3; }
</style>
