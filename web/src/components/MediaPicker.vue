<script setup>
// Medien aus der Bibliothek wählen (Taloan, 21.09.2026: „Medien am Knoten aus der Bibliothek zuordnen“): dasselbe Bild wie
// ▨ Medien — links die Ordner, Mitte Kacheln mit Suche und Sortierung, Mehrfachauswahl per Klick (Strg nicht nötig),
// unten der Relationstyp und „✓ zuordnen“. Was schon am Knoten hängt, ist ausgegraut. Ein Fenster über allem; Esc schliesst.
// props: types = Relationstypen zu Medien, die von diesem Knotentyp ausgehen [{key,label}]; exclude = Medien-Ids, die schon hängen
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import MediaThumb from './MediaThumb.vue'

const props = defineProps({ types: { type: Array, default: () => [] }, exclude: { type: Array, default: () => [] } })
const emit = defineEmits(['pick', 'close'])
const folders = ref({ total: 0, unfiled: 0, folders: [] })
const folder = ref('all'); const deep = ref(true)
const open = ref(new Set())
const items = ref([]); const q = ref(''); const sort = ref('recent')
const sel = ref(new Set())
const type = ref('auto')   // auto = Bild → image, sonst document (bzw. der erste Typ)
const busy = ref('')
const byId = computed(() => new Map(folders.value.folders.map(f => [f.id, f])))
const kids = id => folders.value.folders.filter(f => (f.parent ?? null) === id).sort((a, b) => a.name.localeCompare(b.name, 'de'))
const rows = computed(() => { const out = []; const rec = (parent, depth) => { for (const f of kids(parent)) { out.push({ f, depth, kids: kids(f.id).length }); if (open.value.has(f.id)) rec(f.id, depth + 1) } }; rec(null, 0); return out })
const pathOf = id => { const out = []; for (let f = byId.value.get(id); f; f = f.parent ? byId.value.get(f.parent) : null) { if (out.includes(f)) break; out.unshift(f) } return out }
const title = computed(() => folder.value === 'all' ? 'Alle Medien' : folder.value === '-' ? 'ohne Ordner' : pathOf(folder.value).map(f => f.name).join(' › '))
const excluded = computed(() => new Set(props.exclude))
const typeOf = m => type.value !== 'auto' ? type.value : (m.isImage && props.types.some(t => t.key === 'image') ? 'image' : (props.types.find(t => t.key === 'document') ?? props.types[0])?.key)
function toggle(id) { open.value.has(id) ? open.value.delete(id) : open.value.add(id); open.value = new Set(open.value) }
function pickFolder(id) { folder.value = id; load() }
async function load() {
  try {
    const f = folder.value === 'all' ? '' : folder.value
    items.value = await api.get(`/api/media?q=${encodeURIComponent(q.value.trim())}&limit=2000&folder=${encodeURIComponent(f)}&deep=${deep.value}&sort=${sort.value}`)
  } catch (e) { store.toast(e.message) }
}
let t = null
function search() { clearTimeout(t); t = setTimeout(load, 200) }
function click(m) { if (excluded.value.has(m.id)) return; const s = new Set(sel.value); s.has(m.id) ? s.delete(m.id) : s.add(m.id); sel.value = s }
function all() { sel.value = new Set(items.value.filter(m => !excluded.value.has(m.id)).map(m => m.id)) }
function done() {
  const picked = items.value.filter(m => sel.value.has(m.id)).map(m => ({ medium: m, type: typeOf(m) })).filter(x => x.type)
  if (!picked.length) return
  emit('pick', picked)
}
function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); emit('close') } }
onMounted(async () => { window.addEventListener('keydown', onKey, true); try { folders.value = await api.get('/api/media/folders') } catch {} ; await load() })
onUnmounted(() => window.removeEventListener('keydown', onKey, true))
const kb = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} kB` : `${(b / 1048576).toFixed(1)} MB`
</script>

<template>
  <div class="mp-overlay" @mousedown.self="emit('close')">
    <div class="mp">
      <div class="toolbar"><h1>{{ $t("▨ Aus der Bibliothek zuordnen") }}</h1><span class="muted">{{ title }} · {{ items.length }}</span><span class="grow" /><button class="x" @click="emit('close')" :title="$t('schliessen (Esc)')">✕</button></div>
      <div class="mp-body">
        <div class="mp-folders scroll">
          <div class="pick" :class="{ on: folder === 'all' }" @click="pickFolder('all')">{{ $t("▦ Alle") + ' ' }}<span class="muted cnt">{{ folders.total }}</span></div>
          <div class="pick" :class="{ on: folder === '-' }" @click="pickFolder('-')">{{ $t("⌂ ohne Ordner") + ' ' }}<span class="muted cnt">{{ folders.unfiled }}</span></div>
          <div v-for="r in rows" :key="r.f.id" class="pick" :class="{ on: folder === r.f.id }" :style="`padding-left:${8 + r.depth * 14}px`" @click="pickFolder(r.f.id)">
            <span class="muted caret" @click.stop="toggle(r.f.id)">{{ r.kids ? (open.has(r.f.id) ? '▾' : '▸') : '' }}</span>📁 {{ r.f.name }} <span class="muted cnt">{{ r.f.media }}</span>
          </div>
          <label class="muted" style="display:block;padding:6px 8px;font-size:12px"><input type="checkbox" v-model="deep" @change="load" />{{ ' ' + $t("mit Unterordnern") }}</label>
        </div>
        <div class="mp-main">
          <div class="toolbar" style="gap:4px">
            <input v-model="q" type="search" :placeholder="$t('🔍 Name, Id, Werte')" style="flex:1;min-width:0" @input="search" autofocus />
            <select v-model="sort" @change="load" :title="$t('Sortierung')"><option value="recent">{{ $t("zuletzt geändert") }}</option><option value="name">{{ $t("Name") }}</option><option value="date">{{ $t("Datum") }}</option><option value="size">{{ $t("Größe") }}</option><option value="used">{{ $t("Verwendung") }}</option></select>
            <button class="x" @click="all" :title="$t('Alle sichtbaren wählen')">{{ $t("Alle") }}</button><button class="x" @click="sel = new Set()" :title="$t('Auswahl leeren')">{{ $t("Keine") }}</button>
          </div>
          <div class="scroll tiles">
            <div v-for="m in items" :key="m.id" class="tile" :class="{ sel: sel.has(m.id), dim: excluded.has(m.id) }" @click="click(m)" :title="excluded.has(m.id) ? `${m.name} — hängt schon hier` : `${m.name} · ${kb(m.bytes)} · ${m.mime}${m.folder ? ' · 📁 ' + pathOf(m.folder).map(f => f.name).join(' › ') : ''}`">
              <MediaThumb v-if="m.isImage || m.hasThumb" :id="m.id" :self="m.isImage" /><div v-else class="doc">{{ m.mime.split('/')[1]?.slice(0, 6) || '▤' }}</div>
              <div class="name">{{ m.name }}</div>
            </div>
            <div v-if="!items.length" class="empty">{{ $t("nichts") }}</div>
          </div>
        </div>
      </div>
      <div class="toolbar mp-foot">
        <span class="muted">{{ $t("Relation") }}</span>
        <select v-model="type" :title="'Relationstyp der Zuordnung — automatisch: Bild → image, sonst document'"><option value="auto">{{ $t("automatisch") }}</option><option v-for="t in types" :key="t.key" :value="t.key">{{ t.label?.de || t.key }}</option></select>
        <span class="grow" /><span v-if="busy" class="muted">{{ busy }}</span>
        <button @click="emit('close')">{{ $t("Abbrechen") }}</button>
        <button class="primary" :disabled="!sel.size" @click="done">{{ $t("✓ {0} zuordnen", [sel.size || '']) }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: grid; place-items: center; z-index: 50; }
.mp { width: min(1000px, 96vw); height: min(680px, 92vh); background: var(--pane); border: 1px solid var(--line); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
.mp-body { display: flex; flex: 1; min-height: 0; }
.mp-folders { width: 220px; flex: none; border-right: 1px solid var(--line); }
.mp-folders .pick.on { background: var(--accent-soft); }
.mp-folders .caret { width: 12px; display: inline-block; }
.mp-folders .cnt { font-size: 11px; margin-left: auto; }
.mp-main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.mp-foot { border-top: 1px solid var(--line); gap: 8px; }
.tiles { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; align-content: flex-start; }
.tile { width: 120px; border: 1px solid var(--line); border-radius: 6px; padding: 4px; background: var(--pane); cursor: pointer; }
.tile:hover { background: var(--hover); }
.tile.sel { border-color: var(--accent); background: var(--accent-soft); }
.tile.dim { opacity: .35; cursor: default; }
.tile img, .tile .doc { width: 110px; height: 90px; object-fit: contain; display: grid; place-items: center; background: var(--bg); border-radius: 4px; color: var(--muted); font-size: 12px; }
.tile .name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px; }
.x { border: 0; background: none; color: var(--muted); padding: 0 4px; }
.x:hover { color: var(--text); }
</style>
