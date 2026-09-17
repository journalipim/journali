<script setup>
// Generisches Gitter für Definitionen: Spalten mit Typ (text | bool | select | ro),
// jede Zelle sofort speichernd. Mehrfachauswahl über die Schlüsselspalte (erste ro-Spalte)
// oder die Zeile: Klick wählt, Strg+Klick schaltet um, Shift+Klick wählt den Bereich.
import { ref } from 'vue'
import Cell from './Cell.vue'
import ToggleCell from './ToggleCell.vue'
import SelectCell from './SelectCell.vue'

const props = defineProps({
  columns: Array,      // [{ key, label, type, options?, labelOf?, width?, title? }]
  rows: Array,         // flache Objekte, Schlüssel = column.key
  rowKey: { type: String, default: 'key' },
  removable: Boolean,
  selected: String,    // einfache Auswahl (Detail unten)
  selection: Set,      // Mehrfachauswahl — vom Aufrufer gehalten
})
const emit = defineEmits(['change', 'remove', 'select', 'selection'])
const anchor = ref(null)

function pick(e, r) {
  emit('select', r)
  if (!props.selection) return
  const k = r[props.rowKey]
  const s = new Set(props.selection)
  if (e.shiftKey && anchor.value != null) {
    const keys = props.rows.map(x => x[props.rowKey])
    const a = keys.indexOf(anchor.value), b = keys.indexOf(k)
    if (a >= 0 && b >= 0) { if (!e.ctrlKey) s.clear(); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) s.add(keys[i]) }
  } else if (e.ctrlKey || e.metaKey) {
    s.has(k) ? s.delete(k) : s.add(k)
    anchor.value = k
  } else {
    s.clear(); s.add(k); anchor.value = k
  }
  emit('selection', s)
}
</script>

<template>
  <table class="grid" :class="{ multi: !!selection }">
    <thead>
      <tr>
        <th v-for="c in columns" :key="c.key" :style="c.width ? `width:${c.width}` : ''" :title="c.title">{{ c.label }}</th>
        <th v-if="removable" style="width:28px"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="r in rows" :key="r[rowKey]" class="row" :class="{ selected: selected === r[rowKey] || selection?.has(r[rowKey]) }" @click="pick($event, r)">
        <template v-for="c in columns" :key="c.key">
          <td v-if="c.type === 'ro'" class="mono muted pick">{{ r[c.key] }}</td>
          <ToggleCell v-else-if="c.type === 'bool'" :value="String(!!r[c.key])" dot @save="v => emit('change', r, c.key, v === 'true')" @click.stop />
          <SelectCell v-else-if="c.type === 'select'" :value="r[c.key] ?? ''" :options="typeof c.options === 'function' ? c.options(r) : c.options" :label-of="c.labelOf" @save="v => emit('change', r, c.key, v || null)" @click.stop />
          <Cell v-else :value="r[c.key] ?? null" @save="v => emit('change', r, c.key, v)" @click.stop />
        </template>
        <td v-if="removable" class="num"><button class="x" title="entfernen" @click.stop="emit('remove', r)">×</button></td>
      </tr>
    </tbody>
  </table>
  <div v-if="!rows.length" class="empty">Noch nichts</div>
</template>

<style scoped>
.x { border: 0; background: none; color: var(--muted); padding: 0 4px; }
.x:hover { color: var(--neg); }
/* Zeilen wählen, nicht Text markieren */
table.multi tr.row { user-select: none; }
td.pick { cursor: default; }
</style>
