<script setup>
// Das ganze Journal, neueste zuerst, lebendig: bei jedem neuen Serverstand
// werden nur die Einträge nach der letzten bekannten Nummer geholt.
import { ref, computed, watch, onMounted } from 'vue'
import { api, describe } from '../api.js'
import { store } from '../store.js'
import EntryList from '../components/EntryList.vue'

const entries = ref([])
const filter = ref('')
let pulling = null   // laufende Abfrage — Einhängen und erster Serverstand kommen fast gleichzeitig

async function pull() {
  if (pulling) return pulling
  pulling = (async () => {
    try {
      const after = entries.value[0]?.number ?? 0
      const fresh = (await api.get(`/api/journal?after=${after}&limit=10000`)).filter(e => e.number > after)
      if (fresh.length) entries.value = [...fresh.reverse(), ...entries.value]
    } catch (e) { store.toast(e.message) }
    finally { pulling = null }
  })()
  return pulling
}
onMounted(pull)
watch(() => store.head, pull)

const shown = computed(() => {
  const f = filter.value.trim().toLowerCase()
  if (!f) return entries.value
  return entries.value.filter(e =>
    e.stream.toLowerCase().includes(f) || e.type.toLowerCase().includes(f)
    || e.actor.toLowerCase().includes(f) || describe(e).toLowerCase().includes(f))
})
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar">
      <h1>≡ Journal</h1>
      <span class="muted">{{ shown.length }} / {{ entries.length }}</span>
      <input v-model="filter" type="search" placeholder="Filter: Strom, Typ, Name, Inhalt" style="width:300px" />
      <span class="grow" />
      <span class="muted mono">#{{ store.head }}</span>
    </div>
    <div class="scroll"><EntryList :entries="shown" show-stream /></div>
  </div>
</template>
