<script setup>
// Zelle für boolean: ✓ / · / geerbt; Klick, Leertaste oder Enter schaltet, Entf löscht den eigenen Wert.
// dot: false als Punkt statt ✗ (Modell-Gitter, wo „nein“ der Normalfall ist)
defineProps({ value: String, inherited: String, disabled: Boolean, dot: Boolean })
const emit = defineEmits(['save'])
function shown(value, inherited) { return value ?? inherited }
function next(value, inherited) { return shown(value, inherited) === 'true' ? 'false' : 'true' }
function onKey(e, value, inherited) {
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); emit('save', next(value, inherited)) }
  else if (e.key === 'Delete' && value != null) emit('save', '')
}
</script>

<template>
  <td class="cell">
    <div class="cell-box toggle-box" :class="{ inherited: !disabled && value == null && inherited != null, disabled, on: shown(value, inherited) === 'true' }"
      :tabindex="disabled ? undefined : 0" @click="!disabled && emit('save', next(value, inherited))" @keydown="onKey($event, value, inherited)">
      <template v-if="!disabled">{{ shown(value, inherited) === 'true' ? '✓' : shown(value, inherited) === 'false' && !dot ? '✗' : '·' }}</template>
    </div>
  </td>
</template>

<style scoped>
.toggle-box { cursor: pointer; text-align: center; color: var(--muted); }
.toggle-box.on { color: var(--pos); font-weight: 600; }
</style>
