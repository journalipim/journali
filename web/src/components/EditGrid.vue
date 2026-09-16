<script setup>
// Generisches Gitter für Definitionen: Spalten mit Typ (text | bool | select | ro),
// jede Zelle sofort speichernd. Für Modell-Ansicht (Attribute, Wertelisten, Familien …).
import Cell from './Cell.vue'
import ToggleCell from './ToggleCell.vue'
import SelectCell from './SelectCell.vue'

defineProps({
  columns: Array,      // [{ key, label, type, options?, labelOf?, width?, title? }]
  rows: Array,         // flache Objekte, Schlüssel = column.key
  rowKey: { type: String, default: 'key' },
  removable: Boolean,
  selected: String,
})
const emit = defineEmits(['change', 'remove', 'select'])
</script>

<template>
  <table class="grid">
    <thead>
      <tr>
        <th v-for="c in columns" :key="c.key" :style="c.width ? `width:${c.width}` : ''" :title="c.title">{{ c.label }}</th>
        <th v-if="removable" style="width:28px"></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="r in rows" :key="r[rowKey]" class="row" :class="{ selected: selected === r[rowKey] }" @click="emit('select', r)">
        <template v-for="c in columns" :key="c.key">
          <td v-if="c.type === 'ro'" class="mono muted">{{ r[c.key] }}</td>
          <ToggleCell v-else-if="c.type === 'bool'" :value="String(!!r[c.key])" dot @save="v => emit('change', r, c.key, v === 'true')" />
          <SelectCell v-else-if="c.type === 'select'" :value="r[c.key] ?? ''" :options="typeof c.options === 'function' ? c.options(r) : c.options" :label-of="c.labelOf" @save="v => emit('change', r, c.key, v || null)" />
          <Cell v-else :value="r[c.key] ?? null" @save="v => emit('change', r, c.key, v)" />
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
</style>
