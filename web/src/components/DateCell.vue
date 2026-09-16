<script setup>
// Zelle für date: Datumsfeld des Browsers, Wert JJJJ-MM-TT. Leeren = eigener Wert weg.
defineProps({ value: String, inherited: String, disabled: Boolean })
const emit = defineEmits(['save'])
</script>

<template>
  <td class="cell">
    <div v-if="disabled" class="cell-box disabled"></div>
    <input v-else type="date" class="cell-date" :class="{ inherited: value == null && inherited != null }"
      :value="value ?? inherited ?? ''" @change="emit('save', $event.target.value)" @keydown.delete="value != null && emit('save', '')" />
  </td>
</template>

<style scoped>
.cell-date { width: 100%; height: 24px; border: 1px solid var(--cell-line); border-radius: 3px; background: var(--cell); color: var(--text); padding: 0 4px; font: inherit; }
.cell-date:focus { border-color: var(--accent); outline: none; }
.cell-date.inherited { color: var(--muted); font-style: italic; }
</style>
