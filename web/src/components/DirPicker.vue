<script setup>
// Verzeichnisbrowser (Taloan, 19.09.2026: Treiber Verzeichnis „mit Verzeichnisbrowser“): blättert vom Server aus —
// Laufwerke bzw. /, hoch, hinein; „hier wählen“ übernimmt den Pfad. Nur Verzeichnisse, keine Dateien.
import { ref, watch } from 'vue'
import { api } from '../api.js'

const props = defineProps({ modelValue: String })
const emit = defineEmits(['update:modelValue', 'close'])
const cur = ref({ path: '', parent: null, dirs: [], files: 0, blobs: 0, here: '' })
const error = ref('')
async function go(path) {
  error.value = ''
  try { cur.value = await api.get(`/api/media/dirs?path=${encodeURIComponent(path ?? '')}`) } catch (e) { error.value = e.message }
}
const name = d => d.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || d
watch(() => props.modelValue, v => go(v), { immediate: true })
</script>

<template>
  <div class="picker" style="padding:6px;width:min(560px,100%)">
    <div class="row" style="gap:6px;margin-bottom:4px">
      <button class="x" :disabled="!cur.path" @click="go(cur.parent ?? '')" title="eine Ebene hoch">↑</button>
      <span class="mono" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="cur.path">{{ cur.path || 'Laufwerke' }}</span>
      <button class="x" @click="go(cur.here)" title="Verzeichnis des Servers">⌂</button>
      <button class="primary" :disabled="!cur.path" @click="emit('update:modelValue', cur.path); emit('close')">hier wählen</button>
    </div>
    <div v-if="error" class="neg" style="font-size:12px">{{ error }}</div>
    <div v-if="cur.path" class="muted" style="font-size:11px;margin-bottom:4px">{{ cur.dirs.length }} Verzeichnisse · {{ cur.files }} Dateien<span v-if="cur.blobs"> · sieht nach einem Medienspeicher aus ({{ cur.blobs }} Hash-Ordner)</span></div>
    <div style="max-height:220px;overflow:auto">
      <div v-for="d in cur.dirs" :key="d" class="pick" @click="go(d)" :title="d">▸ {{ name(d) }}</div>
      <div v-if="!cur.dirs.length" class="muted" style="padding:4px 8px">keine Unterverzeichnisse</div>
    </div>
  </div>
</template>
