<script setup>
// Das Journal, neueste zuerst, lebendig: beim Einhängen die letzten CHUNK Einträge (Taloan, 20.09.: „wo ist mein Journal?“ — vorher kamen
// die ersten 10 000 ab Nummer 1, das Neueste nie), bei jedem neuen Serverstand nur die Einträge nach der letzten bekannten Nummer;
// ältere in Stücken nach unten (⇣ ältere).
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api, describe } from '../api.js'
import { store } from '../store.js'
import EntryList from '../components/EntryList.vue'

const route = useRoute()
const entries = ref([])
const filter = ref(String(route.query.q ?? ''))
watch(() => route.query.q, q => { if (q != null) filter.value = String(q) })
let pulling = null   // laufende Abfrage — Einhängen und erster Serverstand kommen fast gleichzeitig
const CHUNK = 5000
const oldest = computed(() => entries.value.length ? entries.value[entries.value.length - 1].number : null)
const loadingOlder = ref(false)

async function pull() {
  if (pulling) return pulling
  pulling = (async () => {
    try {
      let after = entries.value[0]?.number ?? 0
      if (!entries.value.length) { const head = store.head || (await api.get('/api/health')).head || 0; after = Math.max(0, head - CHUNK) }   // erst die neuesten
      const fresh = (await api.get(`/api/journal?after=${after}&limit=10000`)).filter(e => e.number > after)
      if (fresh.length) entries.value = [...fresh.reverse(), ...entries.value]
    } catch (e) { store.toast(e.message) }
    finally { pulling = null }
  })()
  return pulling
}
onMounted(pull)
// ältere Einträge: das Stück vor dem ältesten bekannten
async function older() {
  if (loadingOlder.value || !oldest.value || oldest.value <= 1) return
  loadingOlder.value = true
  try { const from = Math.max(0, oldest.value - 1 - CHUNK); const more = (await api.get(`/api/journal?after=${from}&limit=${CHUNK}`)).filter(e => e.number < oldest.value); entries.value = [...entries.value, ...more.reverse()] }
  catch (e) { store.toast(e.message) } finally { loadingOlder.value = false }
}
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
      <span class="muted" :title="oldest ? `geladen ab #${oldest}` : ''">{{ shown.length }}{{ shown.length !== entries.length ? ' / ' + entries.length : '' }}{{ oldest && oldest > 1 ? ` · ab #${oldest}` : '' }}</span>
      <input v-model="filter" type="search" placeholder="Filter: Strom, Typ, Name, Inhalt" style="width:300px" />
      <span class="grow" />
      <span class="muted mono">#{{ store.head }}</span>
    </div>
    <div class="scroll"><EntryList :entries="shown" show-stream />
      <div v-if="oldest && oldest > 1" class="chips" style="padding:8px"><button class="x" :disabled="loadingOlder" @click="older" title="die nächsten älteren Einträge laden">⇣ ältere{{ loadingOlder ? ' …' : ` (vor #${oldest})` }}</button></div>
    </div>
  </div>
</template>
