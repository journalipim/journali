<script setup>
// Produktliste: Filter oben, Pfeiltasten durch die Zeilen, Enter öffnet,
// „/“ springt in den Filter. Zieht bei jedem neuen Journalstand nach.
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, when } from '../api.js'
import { store } from '../store.js'

const router = useRouter()
const q = ref('')
const rows = ref([])
const sel = ref(0)
const newSku = ref('')
const search = ref(null)
const list = ref(null)

async function load() {
  try {
    rows.value = await api.get('/api/products' + (q.value ? '?q=' + encodeURIComponent(q.value) : ''))
    if (sel.value >= rows.value.length) sel.value = Math.max(0, rows.value.length - 1)
  } catch (e) { store.toast(e.message) }
}

watch(q, load)
watch(() => store.head, load)
onMounted(load)

function open(i) {
  const r = rows.value[i]
  if (r) router.push(`/products/${r.sku}`)
}

function onListKey(e) {
  if (e.key === 'ArrowDown') { e.preventDefault(); sel.value = Math.min(rows.value.length - 1, sel.value + 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); sel.value = Math.max(0, sel.value - 1) }
  else if (e.key === 'Enter') { open(sel.value) }
  else if (e.key === 'Home') { sel.value = 0 }
  else if (e.key === 'End') { sel.value = rows.value.length - 1 }
}

function onGlobalKey(e) {
  if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); search.value?.focus() }
}
onMounted(() => window.addEventListener('keydown', onGlobalKey))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKey))

function create() {
  const sku = newSku.value.trim()
  if (sku) router.push(`/products/${sku}`)
}
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar">
      <h1>▦ Produkte</h1>
      <span class="muted">{{ rows.length }}</span>
      <input ref="search" v-model="q" type="search" placeholder="Filter  /" style="width:220px"
        @keydown.down.prevent="list?.focus()" @keydown.enter="list?.focus()" />
      <span class="grow" />
      <input v-model="newSku" type="text" placeholder="neue SKU" style="width:140px" @keydown.enter="create" />
      <button class="primary" :disabled="!newSku.trim()" @click="create">+ Anlegen</button>
    </div>
    <div ref="list" class="scroll" tabindex="0" @keydown="onListKey">
      <table class="grid">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Name</th>
            <th class="num" title="Kategorien">▤</th>
            <th class="num" title="Freigaben">✓</th>
            <th class="num" title="Einträge">≡</th>
            <th>zuletzt</th>
            <th>👤</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="r.sku" class="row" :class="{ selected: i === sel }"
            @click="sel = i" @dblclick="open(i)">
            <td class="mono">{{ r.sku }}</td>
            <td>{{ r.name ?? '' }}<span v-if="r.name == null" class="muted">—</span></td>
            <td class="num">{{ r.categories }}</td>
            <td class="num" :class="{ pos: r.releases > 0 }">{{ r.releases }}</td>
            <td class="num">{{ r.entries }}</td>
            <td class="mono muted">{{ when(r.lastAt) }}</td>
            <td>{{ r.lastActor }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="!rows.length" class="empty">
        <template v-if="q">Nichts zu „{{ q }}“</template>
        <template v-else>Noch kein Produkt — oben eine SKU eingeben und anlegen.</template>
      </div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">
      <kbd>↑</kbd><kbd>↓</kbd> wählen · <kbd>Enter</kbd> öffnen · <kbd>/</kbd> Filter · <kbd>Alt+2</kbd> Journal · <kbd>Alt+3</kbd> Modell
    </div>
  </div>
</template>
