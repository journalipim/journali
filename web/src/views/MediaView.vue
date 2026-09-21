<script setup>
// ▨ Medien (docs/pflegestruktur.md, 20): links die Ordner (Taloan, 21.09.2026: „Strukturbaum, um Medien dort zu organisieren,
// wie ein interner Dateimanager — sortieren, gruppieren“), in der Mitte die Bibliothek als Kacheln (Suche, Sortierung,
// Gruppierung, Mehrfachauswahl, Ziehen in einen Ordner, Hochladen per Knopf oder Ablegen), rechts das gewählte Medium —
// Datei, Werte (Alt-Text, Rechte), Ordner, wo es hängt. Die Bytes liegen im Store des Servers; hier laufen nur /api/media.
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import Cell from '../components/Cell.vue'
import Splitter from '../components/Splitter.vue'
import MediaThumb from '../components/MediaThumb.vue'
import { paneWidth } from '../panes.js'

const foldersW = paneWidth('media.folders', 220)
const listW = paneWidth('media.list', 560)
const items = ref([])
const q = ref('')
const cur = ref(null)                 // gezeigtes Medium (rechts)
const sel = ref(new Set())            // Mehrfachauswahl (Strg/Umschalt-Klick) — Ziehen und Verschieben gelten für alle
let anchor = null                     // für Umschalt-Klick: Anfang des Bereichs
const busy = ref('')
const dragOver = ref(false)
const fileInput = ref(null)
const model = computed(() => store.model)
const locales = computed(() => model.value?.locales.map(l => l.code) ?? [])
const master = computed(() => model.value?.masterLocale ?? locales.value[0] ?? null)
const mediaAttrs = computed(() => (model.value?.attributes ?? []).filter(a => a.group === 'media' && a.type !== 'rows' && a.type !== 'html'))
const current = computed(() => items.value.find(m => m.id === cur.value) ?? null)

// ---- Ordner: 'all' = alles, '-' = ohne Ordner, sonst Ordner-Id; deep = mit Unterordnern
const folders = ref({ total: 0, unfiled: 0, folders: [] })
const folder = ref(localStorage.getItem('journali.media.folder') || 'all')
const deep = ref(localStorage.getItem('journali.media.deep') !== 'off')
const open = ref(new Set(JSON.parse(localStorage.getItem('journali.media.open') || '[]')))
const byId = computed(() => new Map(folders.value.folders.map(f => [f.id, f])))
const kids = id => folders.value.folders.filter(f => (f.parent ?? null) === id).sort((a, b) => a.name.localeCompare(b.name, 'de'))
const below = id => { let n = byId.value.get(id)?.media ?? 0; for (const k of kids(id)) n += below(k.id); return n }   // Medien im Ordner und darunter
const pathOf = id => { const out = []; for (let f = byId.value.get(id); f; f = f.parent ? byId.value.get(f.parent) : null) { if (out.includes(f)) break; out.unshift(f) } return out }
const folderTitle = computed(() => folder.value === 'all' ? 'Alle Medien' : folder.value === '-' ? 'ohne Ordner' : pathOf(folder.value).map(f => f.name).join(' › '))
// sichtbare Zeilen des Ordnerbaums (aufgeklappt) mit Tiefe
const rows = computed(() => { const out = []; const rec = (parent, depth) => { for (const f of kids(parent)) { out.push({ f, depth, kids: kids(f.id).length }); if (open.value.has(f.id)) rec(f.id, depth + 1) } }; rec(null, 0); return out })
function toggle(id) { open.value.has(id) ? open.value.delete(id) : open.value.add(id); open.value = new Set(open.value); localStorage.setItem('journali.media.open', JSON.stringify([...open.value])) }
function pickFolder(id) { folder.value = id; localStorage.setItem('journali.media.folder', id); sel.value = new Set(); load() }
watch(deep, v => { localStorage.setItem('journali.media.deep', v ? 'on' : 'off'); load() })
async function loadFolders() { try { folders.value = await api.get('/api/media/folders') } catch (e) { store.toast(e.message) } }

async function newFolder(parent = null) {
  const name = await dialog.prompt({ title: parent ? `Neuer Ordner in „${byId.value.get(parent)?.name}“` : 'Neuer Ordner (oberste Ebene)', placeholder: 'Name' })
  if (!name) return
  try { const e = await api.post('/api/media/folders', { name, parent }); if (parent) { open.value.add(parent); toggle(parent); toggle(parent) } await loadFolders(); pickFolder(e.stream) } catch (e) { store.toast(e.message) }
}
async function renameFolder(f) {
  const name = await dialog.prompt({ title: 'Ordner umbenennen', value: f.name })
  if (!name || name === f.name) return
  try { await api.post(`/api/media/folders/${f.id}/name`, { name }, 'PUT'); await loadFolders() } catch (e) { store.toast(e.message) }
}
async function deleteFolder(f) {
  const n = below(f.id), k = kids(f.id).length
  if (n || k) { store.toast(`„${f.name}“ ist nicht leer (${k} Unterordner, ${n} Medien) — erst verschieben`); return }
  if (!await dialog.confirm({ title: `Ordner „${f.name}“ löschen?`, ok: '🗑 Löschen', danger: true })) return
  try { await api.del(`/api/media/folders/${f.id}`); if (folder.value === f.id) pickFolder(f.parent ?? 'all'); await loadFolders() } catch (e) { store.toast(e.message) }
}
async function moveFolder(id, parent) {
  if (id === parent) return
  try { await api.post(`/api/media/folders/${id}/parent`, { parent }, 'PUT'); await loadFolders() } catch (e) { store.toast(e.message) }
}

// ---- Sortierung und Gruppierung
const SORTS = [['recent', 'zuletzt geändert'], ['name', 'Name'], ['date', 'Datum'], ['size', 'Größe'], ['used', 'Verwendung']]
const GROUPS = [['', 'nicht gruppiert'], ['kind', 'Art (Bild / Dokument)'], ['type', 'Dateityp'], ['month', 'Monat'], ['used', 'verwendet / unverwendet'], ['folder', 'Ordner']]
const sort = ref(localStorage.getItem('journali.media.sort') || 'recent')
const desc = ref(localStorage.getItem('journali.media.desc') !== 'off')
const group = ref(localStorage.getItem('journali.media.group') || '')
watch([sort, desc], () => { localStorage.setItem('journali.media.sort', sort.value); localStorage.setItem('journali.media.desc', desc.value ? 'on' : 'off'); load() })
watch(group, v => localStorage.setItem('journali.media.group', v))
const month = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const groupKey = m => group.value === 'kind' ? (m.isImage ? '🖼 Bilder' : '▤ Dokumente') : group.value === 'type' ? (m.mime.split('/')[1] || m.mime) : group.value === 'month' ? month(m.lastAt)
  : group.value === 'used' ? (m.used ? '⇄ verwendet' : '· unverwendet') : group.value === 'folder' ? (m.folder ? pathOf(m.folder).map(f => f.name).join(' › ') || '?' : '⌂ ohne Ordner') : ''
const grouped = computed(() => {
  if (!group.value) return [{ key: '', items: items.value }]
  const map = new Map(); for (const m of items.value) { const k = groupKey(m); if (!map.has(k)) map.set(k, []); map.get(k).push(m) }
  const keys = [...map.keys()].sort((a, b) => group.value === 'month' ? b.localeCompare(a) : a.localeCompare(b, 'de'))
  return keys.map(k => ({ key: k, items: map.get(k) }))
})

async function load() {
  try {
    const f = folder.value === 'all' ? '' : folder.value
    items.value = await api.get(`/api/media?q=${encodeURIComponent(q.value.trim())}&limit=2000&folder=${encodeURIComponent(f)}&deep=${deep.value}&sort=${sort.value}&desc=${desc.value}`)
    if (cur.value && !items.value.some(m => m.id === cur.value)) cur.value = null
  } catch (e) { store.toast(e.message) }
}
onMounted(async () => { await loadFolders(); await load() })
let t = null
function search() { clearTimeout(t); t = setTimeout(load, 200) }

// ---- Auswahl: Klick zeigt und wählt; Strg-Klick nimmt dazu/weg; Umschalt-Klick den Bereich; Esc löscht
function clickTile(m, e) {
  const flat = grouped.value.flatMap(g => g.items)
  if (e.shiftKey && anchor) { const a = flat.findIndex(x => x.id === anchor), b = flat.findIndex(x => x.id === m.id); const [lo, hi] = a < b ? [a, b] : [b, a]; const s = e.ctrlKey || e.metaKey ? new Set(sel.value) : new Set(); for (let i = lo; i <= hi; i++) s.add(flat[i].id); sel.value = s }
  else if (e.ctrlKey || e.metaKey) { const s = new Set(sel.value); s.has(m.id) ? s.delete(m.id) : s.add(m.id); sel.value = s; anchor = m.id }
  else { sel.value = new Set([m.id]); anchor = m.id }
  cur.value = m.id
}
function onKey(e) {
  if (e.target.closest('input, textarea, select, [contenteditable]')) return
  if (e.key === 'Escape') { sel.value = new Set(); return }
  if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); sel.value = new Set(items.value.map(m => m.id)); anchor = null }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

// ---- Ziehen: Kacheln (die Auswahl) oder ein Ordner auf einen Ordner / „ohne Ordner“
const dragKind = ref('')   // 'media' | 'folder' | ''
const dragTarget = ref(null)
function dragTiles(m, e) {
  if (!sel.value.has(m.id)) { sel.value = new Set([m.id]); anchor = m.id }
  dragKind.value = 'media'; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', [...sel.value].join(','))
}
function dragFolder(f, e) { dragged = f.id; dragKind.value = 'folder'; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'folder:' + f.id); e.stopPropagation() }
function dragEnd() { dragKind.value = ''; dragTarget.value = null }
function canDrop(target) {   // target: Ordner-Id oder null (ohne Ordner)
  if (dragKind.value === 'media') return true
  if (dragKind.value === 'folder') { const id = draggedFolder(); return id && id !== target && !(target && pathOf(target).some(f => f.id === id)) }
  return false
}
let dragged = null
function draggedFolder() { return dragged }
function dropOn(target, e) {
  e.preventDefault(); dragTarget.value = null
  const data = e.dataTransfer.getData('text/plain') || ''
  if (data.startsWith('folder:')) { const id = data.slice(7); if (id !== target && !(target && pathOf(target).some(f => f.id === id))) moveFolder(id, target); return }
  const ids = data ? data.split(',').filter(Boolean) : [...sel.value]
  if (ids.length) fileMedia(ids, target)
}
async function fileMedia(ids, target) {
  const todo = ids.filter(id => (items.value.find(m => m.id === id)?.folder ?? null) !== target)
  if (!todo.length) { store.toast('liegt schon dort'); return }
  let n = 0
  for (const id of todo) { busy.value = `verschiebe … ${++n}/${todo.length}`; try { await api.post(`/api/media/${id}/folder`, { folder: target }, 'PUT') } catch (e) { store.toast(e.message) } }
  busy.value = ''; sel.value = new Set()   // Auswahl danach leer — sonst bleibt „1 gewählt“ stehen
  await store.poll(true); await loadFolders(); await load()
  store.toast(`${todo.length} ${todo.length === 1 ? 'Medium' : 'Medien'} → ${target ? pathOf(target).map(f => f.name).join(' › ') : 'ohne Ordner'}`, 'ok')
}
// Verschieben nur durch Ziehen auf einen Ordner links (Taloan, 21.09.: ein Knopf „verschieben“ in der Leiste verwirrt — weg damit)

// ---- Hochladen: in den gerade gezeigten Ordner
async function upload(files) {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  let n = 0, same = 0
  const target = folder.value === 'all' || folder.value === '-' ? null : folder.value
  for (const f of files) {
    busy.value = `lade hoch … ${++n}/${files.length} ${f.name}`
    try {
      const r = await api.upload('/api/media', f); if (r.existed) same++; cur.value = r.id
      if (target && !r.existed) await api.post(`/api/media/${r.id}/folder`, { folder: target }, 'PUT').catch(() => {})
    } catch (e) { store.toast(`${f.name}: ${e.message}`) }
  }
  busy.value = ''
  await store.poll(true); await loadFolders(); await load()
  if (same) store.toast(`${same} davon gab es schon (gleiche Datei)`, 'ok')
}
function onDrop(e) { dragOver.value = false; if (dragKind.value) { dragKind.value = ''; return } upload([...e.dataTransfer.files]) }
const value = (m, def) => { const loc = def.perLocale ? master.value : null; return m.values.find(v => v.attribute === def.key && (v.locale ?? null) === loc && !v.channel)?.value ?? null }
async function setValue(m, def, v) {
  try { await api.post(`/api/media/${m.id}/attributes`, { attribute: def.key, locale: def.perLocale ? master.value : null, value: v }); await store.poll(true); await load() }
  catch (e) { store.toast(e.message) }
}
async function retire(m) {
  const ids = sel.value.size > 1 && sel.value.has(m.id) ? [...sel.value] : [m.id]
  const used = ids.reduce((n, id) => n + (items.value.find(x => x.id === id)?.used ?? 0), 0)
  if (!await dialog.confirm({ title: ids.length > 1 ? `${ids.length} Medien zurückziehen?` : `${m.name} zurückziehen?`, text: used ? `hängen an ${used} Knoten` : '', ok: '🗑 Zurückziehen', danger: true })) return
  for (const id of ids) { try { await api.del(`/api/media/${id}`) } catch (e) { store.toast(e.message) } }
  cur.value = null; sel.value = new Set(); await store.poll(true); await loadFolders(); await load()
}
const kb = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} kB` : `${(b / 1048576).toFixed(1)} MB`
</script>

<template>
  <div class="pane" :style="`width:${foldersW}px;flex:none`">
    <div class="toolbar"><h1>📁 Ordner</h1><span class="grow" /><button class="x" @click="newFolder(null)" title="neuer Ordner auf der obersten Ebene">+</button></div>
    <div class="scroll ftree">
      <div class="pick" :class="{ on: folder === 'all' }" @click="pickFolder('all')" title="alle Medien der Bibliothek">▦ Alle <span class="muted cnt">{{ folders.total }}</span></div>
      <div class="pick" :class="{ on: folder === '-', over: dragTarget === '-' }" @click="pickFolder('-')" title="Medien, die in keinem Ordner liegen — hierher ziehen nimmt sie aus ihrem Ordner"
        @dragover="canDrop(null) && ($event.preventDefault(), dragTarget = '-')" @dragleave="dragTarget = null" @drop="dropOn(null, $event)">⌂ ohne Ordner <span class="muted cnt">{{ folders.unfiled }}</span></div>
      <div v-for="r in rows" :key="r.f.id" class="pick" :class="{ on: folder === r.f.id, over: dragTarget === r.f.id }" :style="`padding-left:${8 + r.depth * 14}px`"
        draggable="true" @dragstart="dragFolder(r.f, $event)" @dragend="dragEnd"
        @dragover="canDrop(r.f.id) && ($event.preventDefault(), dragTarget = r.f.id)" @dragleave="dragTarget = null" @drop="dropOn(r.f.id, $event)"
        @click="pickFolder(r.f.id)" :title="`${r.f.media} hier · ${below(r.f.id)} mit Unterordnern — ziehen: Ordner verschieben`">
        <span class="muted caret" @click.stop="toggle(r.f.id)">{{ r.kids ? (open.has(r.f.id) ? '▾' : '▸') : '' }}</span>
        <span class="fname">📁 {{ r.f.name }}</span><span class="muted cnt">{{ deep ? below(r.f.id) : r.f.media }}</span>
        <span class="acts"><button class="x" @click.stop="newFolder(r.f.id)" title="Unterordner anlegen">+</button><button class="x" @click.stop="renameFolder(r.f)" title="umbenennen">✎</button><button class="x" @click.stop="deleteFolder(r.f)" title="löschen (nur leer)">🗑</button></span>
      </div>
      <div v-if="!rows.length" class="empty" style="padding:12px 8px">Noch kein Ordner — + legt einen an; Kacheln lassen sich hineinziehen.</div>
    </div>
    <div class="toolbar" style="font-size:12px"><label title="Ordner zeigt auch, was in seinen Unterordnern liegt"><input type="checkbox" v-model="deep" /> mit Unterordnern</label></div>
  </div>
  <Splitter v-model="foldersW" :min="140" :max="500" />

  <div class="pane" :style="`width:${listW}px;flex:none`" @dragover.prevent="!dragKind && (dragOver = true)" @dragleave="dragOver = false" @drop.prevent="onDrop" :class="{ over: dragOver }">
    <div class="toolbar"><h1>▨ {{ folderTitle }}</h1><span class="muted">{{ items.length }}</span><span v-if="sel.size > 1" class="chip" title="Auswahl — Esc löst sie; Strg+A wählt alle">{{ sel.size }} gewählt</span><span class="grow" /><span v-if="busy" class="muted">{{ busy }}</span></div>
    <div class="toolbar" style="gap:4px">
      <input v-model="q" type="search" placeholder="🔍 Name, Id, Werte" style="flex:1;min-width:0" @input="search" />
      <select v-model="sort" title="Sortierung — nur die Anzeige"><option v-for="[k, l] in SORTS" :key="k" :value="k">{{ l }}</option></select>
      <button class="x" @click="desc = !desc" :title="desc ? 'Aufsteigend sortieren' : 'Absteigend sortieren'">{{ desc ? '↓' : '↑' }}</button>
      <select v-model="group" title="Gruppierung — nur die Anzeige; der Ordnerfilter ist die Liste links"><option v-for="[k, l] in GROUPS" :key="k" :value="k">{{ l }}</option></select>
      <button class="primary" @click="fileInput.click()" :title="folder === 'all' || folder === '-' ? 'Dateien hochladen — oder hierher ziehen' : `hochladen in „${folderTitle}“ — oder hierher ziehen`">⇧ hochladen</button>
      <input ref="fileInput" type="file" multiple style="display:none" @change="upload([...$event.target.files]); $event.target.value = ''" />
    </div>
    <div class="scroll">
      <template v-for="g in grouped" :key="g.key">
        <div v-if="group" class="ghead"><span>{{ g.key }}</span><span class="muted">{{ g.items.length }}</span></div>
        <div class="tiles">
          <div v-for="m in g.items" :key="m.id" class="tile" :class="{ current: cur === m.id, sel: sel.has(m.id) }" draggable="true" @dragstart="dragTiles(m, $event)" @dragend="dragEnd"
            @click="clickTile(m, $event)" :title="`${m.name} · ${kb(m.bytes)} · ${m.mime}${m.folder ? ' · 📁 ' + pathOf(m.folder).map(f => f.name).join(' › ') : ''}\nKlick wählt, Strg-Klick dazu, Umschalt-Klick Bereich — ziehen in einen Ordner`">
            <MediaThumb v-if="m.isImage" :id="m.id" />
            <div v-else class="doc">{{ m.mime.split('/')[1]?.slice(0, 6) || '▤' }}</div>
            <div class="name">{{ m.name }}</div>
            <div class="muted meta">{{ kb(m.bytes) }}<span v-if="m.used"> · ⇄ {{ m.used }}</span><span v-if="folder === 'all' && m.folder && group !== 'folder'" :title="pathOf(m.folder).map(f => f.name).join(' › ')"> · 📁</span></div>
          </div>
        </div>
      </template>
      <div v-if="!items.length" class="empty">{{ folder === 'all' ? 'Noch nichts — Dateien hierher ziehen oder ⇧ hochladen.' : 'Hier liegt nichts — Kacheln aus „Alle“ hierher ziehen oder ⇧ hochladen.' }}</div>
    </div>
  </div>
  <Splitter v-model="listW" :min="300" :max="1400" />

  <div class="pane" style="flex:1" v-if="current">
    <div class="toolbar"><h1>▨ {{ current.name }}</h1><span class="mono muted">{{ current.id }}</span><span class="grow" />
      <a :href="`/api/media/${current.id}/file`" target="_blank" class="muted" title="Datei öffnen">↗ Datei</a>
      <button class="x" @click="retire(current)" :title="sel.size > 1 ? `${sel.size} gewählte Medien zurückziehen (die Dateien bleiben im Store)` : 'Medium zurückziehen (die Datei bleibt im Store)'">🗑</button></div>
    <div class="toolbar meta muted"><span>{{ current.mime }}</span><span>· {{ kb(current.bytes) }}</span><span>· ⇄ {{ current.used }} Knoten</span>
      <span :title="current.folder ? 'Ordner — zum Verschieben die Kachel auf einen Ordner links ziehen' : 'in keinem Ordner — Kachel auf einen Ordner links ziehen'">· 📁 {{ current.folder ? pathOf(current.folder).map(f => f.name).join(' › ') : '—' }}</span>
      <span class="grow" /><span>≡ {{ current.entries }} · #{{ current.lastNumber }} · {{ when(current.lastAt) }} · {{ current.lastActor }}</span></div>
    <div class="scroll">
      <div class="preview" v-if="current.isImage"><img :src="`/api/media/${current.id}/file`" alt="" /></div>
      <table class="grid form"><colgroup><col style="width:150px" /><col style="width:320px" /></colgroup><tbody>
        <tr v-for="d in mediaAttrs" :key="d.key"><td class="attr" :title="d.key">{{ d.label?.de || d.key }}<span v-if="d.perLocale" class="muted"> {{ master }}</span></td><Cell :value="value(current, d)" @save="v => setValue(current, d, v)" /></tr>
        <tr><td class="attr muted">SHA-256</td><td class="mono muted" style="font-size:11px">{{ current.sha256 }}</td></tr>
        <tr v-for="(v, k) in current.external" :key="k"><td class="attr muted">⇩ {{ k }}</td><td class="mono muted">{{ v }}</td></tr>
      </tbody></table>
    </div>
  </div>
  <div v-else class="pane" style="flex:1"><div class="empty">Medium in der Mitte wählen — oder hochladen.</div></div>
</template>

<style scoped>
.pane.over { outline: 2px dashed var(--accent); outline-offset: -4px; }
.ftree .pick { position: relative; }
.ftree .pick.on { background: var(--accent-soft); }
.ftree .pick.over { outline: 2px solid var(--accent); outline-offset: -2px; }
.ftree .caret { width: 12px; display: inline-block; }
.ftree .fname { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.ftree .cnt { font-size: 11px; }
.ftree .acts { display: none; gap: 0; }
.ftree .pick:hover .acts { display: inline-flex; }
.ghead { display: flex; gap: 8px; align-items: baseline; padding: 8px 8px 0; font-weight: 600; font-size: 12px; }
.tiles { display: flex; flex-wrap: wrap; gap: 8px; padding: 8px; align-content: flex-start; }
.tile { width: 120px; border: 1px solid var(--line); border-radius: 6px; padding: 4px; background: var(--pane); cursor: default; }
.tile:hover { background: var(--hover); }
.tile.sel { border-color: var(--accent); }
.tile.current { border-color: var(--accent); background: var(--accent-soft); }
.tile img, .tile .doc { width: 110px; height: 90px; object-fit: contain; display: grid; place-items: center; background: var(--bg); border-radius: 4px; color: var(--muted); font-size: 12px; }
.tile .name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px; }
.tile .meta { font-size: 11px; }
.preview { padding: 8px; }
.preview img { max-width: 100%; max-height: 360px; border-radius: 4px; background: var(--bg); }
.form { width: auto; }
.form td.attr { white-space: nowrap; color: var(--muted); }
.x { border: 0; background: none; color: var(--muted); padding: 0 3px; }
.x:hover { color: var(--text); }
</style>
