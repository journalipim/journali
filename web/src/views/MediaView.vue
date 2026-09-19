<script setup>
// ▨ Medien (docs/pflegestruktur.md, 20): links die Bibliothek als Kacheln (Suche, Hochladen per
// Knopf oder Ablegen), rechts das gewählte Medium — Datei, Werte (Alt-Text, Rechte), wo es hängt.
// Die Bytes liegen im Store des Servers; hier laufen nur /api/media und die Zellen.
import { ref, computed, onMounted } from 'vue'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import Cell from '../components/Cell.vue'
import Splitter from '../components/Splitter.vue'
import { paneWidth } from '../panes.js'

const listW = paneWidth('media.list', 520)
const items = ref([])
const q = ref('')
const cur = ref(null)
const busy = ref('')
const dragOver = ref(false)
const fileInput = ref(null)
const model = computed(() => store.model)
const locales = computed(() => model.value?.locales.map(l => l.code) ?? [])
const master = computed(() => model.value?.masterLocale ?? locales.value[0] ?? null)
const mediaAttrs = computed(() => (model.value?.attributes ?? []).filter(a => a.group === 'media' && a.type !== 'rows' && a.type !== 'html'))
const current = computed(() => items.value.find(m => m.id === cur.value) ?? null)

async function load() {
  try { items.value = await api.get(`/api/media?q=${encodeURIComponent(q.value.trim())}&limit=500`) } catch (e) { store.toast(e.message) }
}
onMounted(load)
let t = null
function search() { clearTimeout(t); t = setTimeout(load, 200) }

async function upload(files) {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  let n = 0, same = 0
  for (const f of files) {
    busy.value = `lade hoch … ${++n}/${files.length} ${f.name}`
    try { const r = await api.upload('/api/media', f); if (r.existed) same++; cur.value = r.id } catch (e) { store.toast(`${f.name}: ${e.message}`) }
  }
  busy.value = ''
  await store.poll(true); await load()
  if (same) store.toast(`${same} davon gab es schon (gleiche Datei)`, 'ok')
}
function onDrop(e) { dragOver.value = false; upload([...e.dataTransfer.files]) }
const value = (m, def) => { const loc = def.perLocale ? master.value : null; return m.values.find(v => v.attribute === def.key && (v.locale ?? null) === loc && !v.channel)?.value ?? null }
async function setValue(m, def, v) {
  try { await api.post(`/api/media/${m.id}/attributes`, { attribute: def.key, locale: def.perLocale ? master.value : null, value: v }); await store.poll(true); await load() }
  catch (e) { store.toast(e.message) }
}
async function retire(m) {
  if (!await dialog.confirm({ title: `${m.name} zurückziehen?`, text: m.used ? `hängt an ${m.used} Knoten` : '', ok: '🗑 Zurückziehen', danger: true })) return
  try { await api.del(`/api/media/${m.id}`); cur.value = null; await store.poll(true); await load() } catch (e) { store.toast(e.message) }
}
const kb = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} kB` : `${(b / 1048576).toFixed(1)} MB`
</script>

<template>
  <div class="pane" :style="`width:${listW}px;flex:none`" @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="onDrop" :class="{ over: dragOver }">
    <div class="toolbar"><h1>▨ Medien</h1><span class="muted">{{ items.length }}</span><span class="grow" /><span v-if="busy" class="muted">{{ busy }}</span></div>
    <div class="toolbar" style="gap:4px">
      <input v-model="q" type="search" placeholder="🔍 Name, Id, Werte" style="flex:1;min-width:0" @input="search" />
      <button class="primary" @click="fileInput.click()" title="Dateien hochladen — oder hierher ziehen">⇧ hochladen</button>
      <input ref="fileInput" type="file" multiple style="display:none" @change="upload([...$event.target.files]); $event.target.value = ''" />
    </div>
    <div class="scroll tiles">
      <div v-for="m in items" :key="m.id" class="tile" :class="{ current: cur === m.id }" @click="cur = m.id" :title="`${m.name} · ${kb(m.bytes)} · ${m.mime}`">
        <img v-if="m.isImage" :src="`/api/media/${m.id}/file`" loading="lazy" alt="" />
        <div v-else class="doc">{{ m.mime.split('/')[1]?.slice(0, 6) || '▤' }}</div>
        <div class="name">{{ m.name }}</div>
        <div class="muted meta">{{ kb(m.bytes) }}<span v-if="m.used"> · ⇄ {{ m.used }}</span></div>
      </div>
      <div v-if="!items.length" class="empty">Noch nichts — Dateien hierher ziehen oder ⇧ hochladen.</div>
    </div>
  </div>
  <Splitter v-model="listW" :min="300" :max="1200" />

  <div class="pane" style="flex:1" v-if="current">
    <div class="toolbar"><h1>▨ {{ current.name }}</h1><span class="mono muted">{{ current.id }}</span><span class="grow" />
      <a :href="`/api/media/${current.id}/file`" target="_blank" class="muted" title="Datei öffnen">↗ Datei</a>
      <button class="x" @click="retire(current)" title="Medium zurückziehen (die Datei bleibt im Store)">🗑</button></div>
    <div class="toolbar meta muted"><span>{{ current.mime }}</span><span>· {{ kb(current.bytes) }}</span><span>· ⇄ {{ current.used }} Knoten</span><span class="grow" /><span>≡ {{ current.entries }} · #{{ current.lastNumber }} {{ when(current.lastAt) }} 👤 {{ current.lastActor }}</span></div>
    <div class="scroll">
      <div class="preview" v-if="current.isImage"><img :src="`/api/media/${current.id}/file`" alt="" /></div>
      <table class="grid form"><colgroup><col style="width:150px" /><col style="width:320px" /></colgroup><tbody>
        <tr v-for="d in mediaAttrs" :key="d.key"><td class="attr" :title="d.key">{{ d.label?.de || d.key }}<span v-if="d.perLocale" class="muted"> {{ master }}</span></td><Cell :value="value(current, d)" @save="v => setValue(current, d, v)" /></tr>
        <tr><td class="attr muted">SHA-256</td><td class="mono muted" style="font-size:11px">{{ current.sha256 }}</td></tr>
        <tr v-for="(v, k) in current.external" :key="k"><td class="attr muted">⇩ {{ k }}</td><td class="mono muted">{{ v }}</td></tr>
      </tbody></table>
    </div>
  </div>
  <div v-else class="pane" style="flex:1"><div class="empty">Medium links wählen — oder hochladen.</div></div>
</template>

<style scoped>
.pane.over { outline: 2px dashed var(--accent); outline-offset: -4px; }
.tiles { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; align-content: flex-start; }
.tile { width: 120px; border: 1px solid var(--line); border-radius: 6px; padding: 4px; background: var(--pane); cursor: default; }
.tile:hover { background: var(--hover); }
.tile.current { border-color: var(--accent); background: var(--accent-soft); }
.tile img, .tile .doc { width: 110px; height: 90px; object-fit: contain; display: grid; place-items: center; background: var(--bg); border-radius: 4px; color: var(--muted); font-size: 12px; }
.tile .name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px; }
.tile .meta { font-size: 11px; }
.preview { padding: 8px; }
.preview img { max-width: 100%; max-height: 360px; border-radius: 4px; background: var(--bg); }
.form { width: auto; }
.form td.attr { white-space: nowrap; color: var(--muted); }
.x { border: 0; background: none; color: var(--muted); padding: 0 3px; }
.x:hover { color: var(--neg); }
</style>
