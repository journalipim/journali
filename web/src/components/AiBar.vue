<script setup>
// ✦ KI-Leiste im Editor: Vorgaben (Verbessern, Kürzen, Ausführlicher, Aus Produktdaten) und eigene Anweisung —
// liefert den neuen Text als Ereignis; der Editor setzt ihn in den Entwurf, gespeichert wird erst mit Speichern.
import { ref } from 'vue'
import { ai } from '../ai.js'
import { store } from '../store.js'
import { PRESETS, rewrite } from '../aiText.js'

const props = defineProps({ current: String, html: Boolean, label: String, locale: String, node: String })
const emit = defineEmits(['result'])
const open = ref(false); const busy = ref(''); const own = ref('')
async function run(instruction) {
  if (!instruction) return
  busy.value = `fragt ${ai.label()} …`
  try { emit('result', await rewrite({ instruction, current: props.current, html: props.html, label: props.label, locale: props.locale, node: props.node })); open.value = false; own.value = '' }
  catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
</script>

<template>
  <button class="ai" :class="{ on: open }" @mousedown.prevent @click="open = !open" :title="ai.available() ? 'Text mit der KI (' + ai.label() + ') bearbeiten — mit den Produktdaten dieses Knotens' : 'Kein KI-Schlüssel — Einstellungen → KI'" :disabled="!ai.available()">✦ KI</button>
  <div v-if="open" class="aibar" @mousedown.stop>
    <button v-for="[k, l, hint] in PRESETS" :key="k" @click="run(k)" :title="hint" :disabled="!!busy">{{ l }}</button>
    <input v-model="own" type="text" placeholder="eigene Anweisung … (Enter)" @keydown.enter.stop="run(own)" @keydown.esc.stop="open = false" :disabled="!!busy" />
    <span class="muted" style="font-size:12px">{{ busy || 'ersetzt den Entwurf — Speichern entscheidet' }}</span>
  </div>
</template>

<style scoped>
.ai.on { background: var(--accent-soft); }
.aibar { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding: 4px 8px; border-bottom: 1px solid var(--line); background: var(--pane); }
.aibar input { flex: 1; min-width: 200px; }
</style>
