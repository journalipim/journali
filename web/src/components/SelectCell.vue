<script setup>
// Zelle für enum: Auswahl aus einer Werteliste. Leer = eigener Wert weg.
defineProps({ value: String, inherited: String, disabled: Boolean, options: Array, labelOf: Function })
const emit = defineEmits(['save'])
</script>

<template>
  <td class="cell">
    <div v-if="disabled" class="cell-box disabled" tabindex="-1"></div>
    <select v-else class="cell-select" :class="{ inherited: value == null && inherited != null }"
      :value="value ?? inherited ?? ''" @change="emit('save', $event.target.value)">
      <option value="">{{ inherited != null ? '' : '—' }}</option>
      <option v-for="o in options" :key="o" :value="o">{{ labelOf ? labelOf(o) : o }}</option>
    </select>
  </td>
</template>

<style scoped>
.cell-select { width: 100%; height: 26px; border: 1px solid transparent; background: transparent; padding: 0 4px; font: inherit; }
.cell-select:focus { border-color: var(--accent); outline: none; background: var(--pane); }
.cell-select option { background: var(--pane); color: var(--text); }
.cell-select.inherited { color: var(--muted); font-style: italic; }
</style>
