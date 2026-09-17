<script setup>
// Griff zwischen zwei Fenstern: ziehen ändert die Breite des Fensters davor (side=left, Vorgabe)
// oder danach (side=right). Die Breite hält der Aufrufer (paneWidth in panes.js) — im localStorage.
const props = defineProps({ modelValue: Number, min: { type: Number, default: 160 }, max: { type: Number, default: 1200 }, side: { type: String, default: 'left' } })
const emit = defineEmits(['update:modelValue'])
function down(e) {
  e.preventDefault()
  const x0 = e.clientX, w0 = props.modelValue
  const move = ev => emit('update:modelValue', Math.min(props.max, Math.max(props.min, w0 + (props.side === 'left' ? ev.clientX - x0 : x0 - ev.clientX))))
  const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); document.body.style.cursor = '' }
  window.addEventListener('mousemove', move); window.addEventListener('mouseup', up)
  document.body.style.cursor = 'col-resize'
}
</script>

<template>
  <div class="splitter" @mousedown="down" title="ziehen: Breite ändern" />
</template>

<style scoped>
.splitter { width: 5px; margin: 0 -2px; cursor: col-resize; flex: none; z-index: 2; position: relative; }
.splitter:hover, .splitter:active { background: var(--accent-soft); }
</style>
