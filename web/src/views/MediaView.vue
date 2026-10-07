<script setup>
// ▨ Medien (docs/pflegestruktur.md, 20): links die Ordner, in der Mitte die Bibliothek als Kacheln (Suche, Sortierung,
// Gruppierung, Mehrfachauswahl, Ziehen in einen Ordner, Hochladen per Knopf oder Ablegen), rechts das gewählte Medium —
// Datei, Werte (Alt-Text, Rechte), Ordner, wo es hängt. Die Bytes liegen im Store des Servers; hier laufen nur /api/media.
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { inGruppe } from '../gruppen.js'
import { dialog } from '../dialog.js'
import { menu } from '../menu.js'
import { mediaTypesFor, attachMedia, meldung as medienMeldung } from '../media.js'
import TreePicker from '../components/TreePicker.vue'
import CropEditor from '../components/CropEditor.vue'
import Cell from '../components/Cell.vue'
import ListCell from '../components/ListCell.vue'
import SelectCell from '../components/SelectCell.vue'
import Splitter from '../components/Splitter.vue'
import MediaThumb from '../components/MediaThumb.vue'
import PdfPane from '../components/PdfPane.vue'
import { paneWidth } from '../panes.js'
import { t as t_, L } from '../i18n.js'

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
const mediaAttrs = computed(() => (model.value?.attributes ?? []).filter(a => inGruppe(a, 'media') && a.type !== 'rows' && a.type !== 'html'))
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
const folderTitle = computed(() => folder.value === 'all' ? t_('Alle Medien') : folder.value === '-' ? t_('ohne Ordner') : pathOf(folder.value).map(f => f.name).join(' › '))
// sichtbare Zeilen des Ordnerbaums (aufgeklappt) mit Tiefe
const rows = computed(() => { const out = []; const rec = (parent, depth) => { for (const f of kids(parent)) { out.push({ f, depth, kids: kids(f.id).length }); if (open.value.has(f.id)) rec(f.id, depth + 1) } }; rec(null, 0); return out })
function toggle(id) { open.value.has(id) ? open.value.delete(id) : open.value.add(id); open.value = new Set(open.value); localStorage.setItem('journali.media.open', JSON.stringify([...open.value])) }
function pickFolder(id) { folder.value = id; localStorage.setItem('journali.media.folder', id); sel.value = new Set(); load() }
watch(deep, v => { localStorage.setItem('journali.media.deep', v ? 'on' : 'off'); load() })
async function loadFolders() { try { folders.value = await api.get('/api/media/folders') } catch (e) { store.toast(e.message) } }
/// Sichtbar für Rollen (27.09.2026): der Ordner, seine Unterordner und die Medien darin — nur für diese Rollen. Leer = für alle.
async function restrictFolder(f) {
  let rollen = []
  try { rollen = (await api.get('/api/auth/roles')).map(r => r.key) } catch { rollen = [] }
  const eingabe = await dialog.prompt({ title: t_('Sichtbar für Rollen — {0}', [f.name]), text: t_('Rollen mit Komma, leer = für alle. Administratoren sehen immer alles.') + (rollen.length ? ' · ' + rollen.join(', ') : ''), value: (f.roles ?? []).join(', '), placeholder: rollen.join(', '), ok: t_('✓ Setzen') })
  if (eingabe === null) return
  const roles = eingabe.split(/[,\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean)
  try { await api.post(`/api/media/folders/${encodeURIComponent(f.id)}/roles`, { roles }, 'PUT'); await loadFolders(); store.toast(roles.length ? t_('{0}: sichtbar für {1}', [f.name, roles.join(', ')]) : t_('{0}: sichtbar für alle', [f.name]), 'ok') }
  catch (e) { store.toast(e.message) }
}

async function newFolder(parent = null) {
  const name = await dialog.prompt({ title: t_('Ordner anlegen'), text: parent ? `in „${byId.value.get(parent)?.name}“` : t_('oberste Ebene'), placeholder: t_('Name'), ok: t_('+ Anlegen') })
  if (!name) return
  try { const e = await api.post('/api/media/folders', { name, parent }); if (parent) { open.value.add(parent); toggle(parent); toggle(parent) } await loadFolders(); pickFolder(e.stream) } catch (e) { store.toast(e.message) }
}
async function renameFolder(f) {
  const name = await dialog.prompt({ title: t_('Ordner umbenennen'), ok: t_('✎ Umbenennen'), value: f.name })
  if (!name || name === f.name) return
  try { await api.post(`/api/media/folders/${f.id}/name`, { name }, 'PUT'); await loadFolders() } catch (e) { store.toast(e.message) }
}
async function deleteFolder(f) {
  const n = below(f.id), k = kids(f.id).length
  if (n || k) { store.toast(t_('„{0}“ ist nicht leer ({1} Unterordner, {2} Medien) — erst verschieben', [f.name, k, n])); return }
  if (!await dialog.confirm({ title: t_('Ordner „{0}“ löschen?', [f.name]), ok: t_('🗑 Löschen'), danger: true })) return
  try { await api.del(`/api/media/folders/${f.id}`); if (folder.value === f.id) pickFolder(f.parent ?? 'all'); await loadFolders() } catch (e) { store.toast(e.message) }
}
async function moveFolder(id, parent) {
  if (id === parent) return
  try { await api.post(`/api/media/folders/${id}/parent`, { parent }, 'PUT'); await loadFolders() } catch (e) { store.toast(e.message) }
}

// ---- Sortierung und Gruppierung
const SORTS = [['recent', t_('zuletzt geändert')], ['name', t_('Name')], ['date', t_('Datum')], ['size', t_('Größe')], ['used', t_('Verwendung')]]
const GROUPS = [['', t_('nicht gruppiert')], ['kind', 'Art (Bild / Dokument)'], ['type', t_('Dateityp')], ['month', t_('Monat')], ['used', 'verwendet / unverwendet'], ['folder', t_('Ordner')]]
const sort = ref(localStorage.getItem('journali.media.sort') || 'recent')
const desc = ref(localStorage.getItem('journali.media.desc') !== 'off')
const group = ref(localStorage.getItem('journali.media.group') || '')
watch([sort, desc], () => { localStorage.setItem('journali.media.sort', sort.value); localStorage.setItem('journali.media.desc', desc.value ? 'on' : 'off'); load() })
watch(group, v => localStorage.setItem('journali.media.group', v))
const month = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const groupKey = m => group.value === 'kind' ? (m.isImage ? t_('🖼 Bilder') : t_('▤ Dokumente')) : group.value === 'type' ? (m.mime.split('/')[1] || m.mime) : group.value === 'month' ? month(m.lastAt)
  : group.value === 'used' ? (m.used ? '⇄ verwendet' : '· unverwendet') : group.value === 'folder' ? (m.folder ? pathOf(m.folder).map(f => f.name).join(' › ') || '?' : t_('⌂ ohne Ordner')) : ''
const grouped = computed(() => {
  if (!group.value) return [{ key: '', items: items.value }]
  const map = new Map(); for (const m of items.value) { const k = groupKey(m); if (!map.has(k)) map.set(k, []); map.get(k).push(m) }
  const keys = [...map.keys()].sort((a, b) => group.value === 'month' ? b.localeCompare(a) : a.localeCompare(b, 'de'))
  return keys.map(k => ({ key: k, items: map.get(k) }))
})

// Seiten zu SEITE (04.10.2026, vorher 2 000 auf einmal); die Gesamtzahl steht in den Facetten
const SEITE = 300
async function load() {
  try {
    items.value = await api.get(`/api/media?limit=${SEITE}&sort=${sort.value}&desc=${desc.value}&${filterQuery()}`)
    if (cur.value && !items.value.some(m => m.id === cur.value)) cur.value = null
  } catch (e) { store.toast(e.message) }
  await loadFacets()
}
const weitere = computed(() => Math.max(0, (facets.value?.total ?? 0) - items.value.length))
const mehrLaedt = ref(false)
async function mehr() {
  mehrLaedt.value = true
  try {
    const neu = await api.get(`/api/media?limit=${SEITE}&skip=${items.value.length}&sort=${sort.value}&desc=${desc.value}&${filterQuery()}`)
    const da = new Set(items.value.map(m => m.id)); items.value = [...items.value, ...neu.filter(m => !da.has(m.id))]
  } catch (e) { store.toast(e.message) } finally { mehrLaedt.value = false }
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
  if (!todo.length) { store.toast(t_('liegt schon dort')); return }
  // ein Stapel statt einer Anfrage je Medium (04.10.2026)
  try { const r = await api.batchChunked(todo.map(id => ({ op: 'media.file', args: { media: id, folder: target } })), { label: t_('verschiebe'), continueOnError: true }); if (r.errors?.length) store.toast(t_('{0} Fehler', [r.errors.length])) } catch (e) { store.toast(e.message) }
  busy.value = ''; sel.value = new Set()   // Auswahl danach leer — sonst bleibt „1 gewählt“ stehen
  await store.poll(true); await loadFolders(); await load()
  store.toast(`${todo.length} ${todo.length === 1 ? 'Medium' : 'Medien'} → ${target ? pathOf(target).map(f => f.name).join(' › ') : 'ohne Ordner'}`, 'ok')
}
// Verschieben nur durch Ziehen auf einen Ordner links

// ---- Hochladen: in den gerade gezeigten Ordner
async function upload(files) {
  if (!store.actor) { store.toast(t_('👤 Name fehlt → Einstellungen')); return }
  let n = 0, same = 0
  const target = folder.value === 'all' || folder.value === '-' ? null : folder.value
  for (const f of files) {
    busy.value = t_('lade hoch … {0}/{1} {2}', [++n, files.length, f.name])
    try {
      const r = await api.upload('/api/media', f); if (r.existed) same++; cur.value = r.id
      if (target && !r.existed) await api.post(`/api/media/${r.id}/folder`, { folder: target }, 'PUT').catch(() => {})
    } catch (e) { store.toast(`${f.name}: ${e.message}`) }
  }
  busy.value = ''
  await store.poll(true); await loadFolders(); await load()
  if (same) store.toast(t_('{0} davon gab es schon (gleiche Datei)', [same]), 'ok')
}
function onDrop(e) { dragOver.value = false; if (dragKind.value) { dragKind.value = ''; return } if (store.demo) return; upload([...e.dataTransfer.files]) }   // Demo: kein Hochladen
/// Der eigene Wert auf der Achse — bei einem vermehrbaren Attribut die Liste, kommagetrennt wie in der Zelle.
const value = (m, def) => {
  const loc = def.perLocale ? master.value : null
  const v = m.values.find(x => x.attribute === def.key && (x.locale ?? null) === loc && !x.channel)
  return (def.multiple ? v?.values?.join(', ') : v?.value) ?? null
}
async function setValue(m, def, v) {
  const rumpf = { attribute: def.key, locale: def.perLocale ? master.value : null }
  if (def.multiple) rumpf.values = String(v ?? '').split(',').map(x => x.trim()).filter(Boolean)
  else rumpf.value = v
  try { await api.post(`/api/media/${m.id}/attributes`, rumpf); await store.poll(true); await load(); await loadSuggestions() }
  catch (e) { store.toast(e.message) }
}
/// Werte und Bezeichnungen einer Werteliste des Modells — wie in der Knotenansicht.
const listOptions = def => (model.value?.lists?.find(l => l.key === def.list)?.values ?? []).map(v => v.value)
const listLabel = def => {
  const vals = model.value?.lists?.find(l => l.key === def.list)?.values ?? []
  return v => { const l = vals.find(x => x.value === v)?.label; return l?.[master.value] || l?.de || l?.en || Object.values(l ?? {}).find(Boolean) || v }
}

// ---- Vorschläge für Stichwörter: bei automatischem Import verschlagwortet niemand von Hand
const suggestions = ref([])
async function loadSuggestions() {
  suggestions.value = []
  if (!cur.value) return
  try { suggestions.value = await api.get(`/api/media/${cur.value}/suggestions`) } catch { /* Vorschläge sind keine Pflicht */ }
}
watch(cur, loadSuggestions, { immediate: true })
/// Einen Vorschlag annehmen — erst das ist Pflege, und erst das zählt.
async function annehmen(v) {
  const def = mediaAttrs.value.find(a => a.key === 'keywords')
  if (!def || !current.value) return
  const jetzt = (value(current.value, def) ?? '').split(',').map(x => x.trim()).filter(Boolean)
  if (jetzt.includes(v.key)) return
  await setValue(current.value, def, [...jetzt, v.key].join(', '))
}
async function retire(m) {
  if (store.demo) return   // Demo: zurückziehen gibt es nicht (auch nicht mit Entf)
  const ids = sel.value.size > 1 && sel.value.has(m.id) ? [...sel.value] : [m.id]
  const used = ids.reduce((n, id) => n + (items.value.find(x => x.id === id)?.used ?? 0), 0)
  if (!await dialog.confirm({ title: ids.length > 1 ? t_('{0} Medien zurückziehen?', [ids.length]) : t_('{0} zurückziehen?', [m.name]), text: used ? t_('Hängen an {0} Knoten', [used]) : '', ok: t_('🗑 Zurückziehen'), danger: true })) return
  try { const r = await api.batchChunked(ids.map(id => ({ op: 'media.retire', args: { media: id } })), { label: t_('🗑 Zurückziehen'), continueOnError: true }); if (r.errors?.length) store.toast(t_('{0} Fehler', [r.errors.length])) } catch (e) { store.toast(e.message) }
  cur.value = null; sel.value = new Set(); await store.poll(true); await loadFolders(); await load()
}
const kb = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} kB` : `${(b / 1048576).toFixed(1)} MB`

// ---- Facetten: wonach sich filtern lässt, mit Anzahl. Sie zählen über denselben Filter wie die Liste.
const facets = ref(null)
const keyword = ref('')          // '' = alle, '-' = ohne Stichwort, sonst Komma-Liste
const plugin = ref('')           // '' = alle, '-' = von Hand
const superseded = ref(false)    // abgelöste Versionen mit zeigen
const valid = ref('')            // '' = alle, 'expired' = nur abgelaufene
async function loadFacets() {
  try { facets.value = await api.get(`/api/media/facets?${filterQuery()}`) } catch (e) { store.toast(e.message) }
}
/// Die Bedingungen, die Liste und Facetten gemeinsam haben
function filterQuery() {
  const f = folder.value === 'all' ? '' : folder.value
  return `q=${encodeURIComponent(q.value.trim())}&folder=${encodeURIComponent(f)}&deep=${deep.value}`
    + `&keyword=${encodeURIComponent(keyword.value)}&plugin=${encodeURIComponent(plugin.value)}&superseded=${superseded.value}&valid=${valid.value}&state=${encodeURIComponent(state.value)}`
}
/// Ein Stichwort an- oder abwählen; mehrere gelten zusammen.
function toggleKeyword(k) {
  if (k === '-') { keyword.value = keyword.value === '-' ? '' : '-'; return load() }
  const jetzt = keyword.value === '-' ? [] : keyword.value.split(',').filter(Boolean)
  keyword.value = (jetzt.includes(k) ? jetzt.filter(x => x !== k) : [...jetzt, k]).join(',')
  return load()
}
const keywordAktiv = k => k === '-' ? keyword.value === '-' : keyword.value !== '-' && keyword.value.split(',').filter(Boolean).includes(k)
function togglePlugin(k) { plugin.value = plugin.value === k ? '' : k; return load() }

// ---- Kontextmenü: für die Kachel unter dem Zeiger, oder für die Auswahl, wenn sie dazugehört
/// Auf welche Medien wirkt ein Befehl an dieser Kachel? Die Auswahl, wenn die Kachel darin liegt — sonst sie allein.
const betroffene = m => sel.value.size > 1 && sel.value.has(m.id) ? items.value.filter(x => sel.value.has(x.id)) : [m]
function contextMenu(e, m) {
  if (!sel.value.has(m.id)) { cur.value = m.id; sel.value = new Set([m.id]) }
  const n = betroffene(m).length
  menu.open(e, [
    { label: n > 1 ? t_('{0} Assets zuordnen …', [n]) : t_('Zuordnen …'), icon: '⇄', action: () => zuordnenOeffnen(m) },
    n === 1 && !m.supersededBy ? { demo: 'aus', label: t_('Neue Version hochladen …'), icon: '⇪', action: () => neueVersion(m) } : null,
    n === 1 && m.isImage && store.can('download') ? { demo: 'aus', label: t_('Zuschneiden und ausrichten …'), icon: '✂', action: () => zuschneiden(m) } : null,
    { sep: true },
    { demo: 'aus', label: n > 1 ? t_('{0} Assets zurückziehen', [n]) : t_('Zurückziehen'), icon: '🗑', danger: true, action: () => retire(m) },
  ])
}

// ---- Zuschneiden und Ausrichten (CropEditor): nur Bilder; das Ergebnis ist ein neues Medium mit Abstammung
const cropFuer = ref(null)
function zuschneiden(m) { if (m?.isImage) cropFuer.value = m }
async function zugeschnitten({ neu, version }) {
  cropFuer.value = null
  store.toast(version ? t_('{0} ersetzt durch {1}', [current.value?.name ?? '', neu.name]) : t_('{0} angelegt', [1]), 'ok')
  cur.value = neu.id
  await store.poll(true); await loadFolders(); await load()
}

// ---- Neue Version: die Datei wird ein neues Medium (ein Medium ist unveränderlich), dann ersetzt es das alte —
// die Zuordnungen wandern, der Vorgänger bleibt für Belege und Versionen auflösbar, die Liste zeigt ihn nicht mehr.
const versionFuer = ref(null)     // das Medium, das ersetzt wird — solange der Dateidialog offen ist
const versionInput = ref(null)
function neueVersion(m) { versionFuer.value = m; versionInput.value?.click() }
async function versionGewaehlt(files) {
  const alt = versionFuer.value; versionFuer.value = null
  const f = files[0]
  if (!alt || !f) return
  if (!store.actor) { store.toast(t_('👤 Name fehlt → Einstellungen')); return }
  busy.value = t_('neue Version …')
  try {
    const neu = await api.upload('/api/media', f)
    if (neu.id === alt.id) { store.toast(t_('Dieselbe Datei — keine neue Version')); return }
    await api.post(`/api/media/${alt.id}/supersede`, { by: neu.id })
    store.toast(t_('{0} ersetzt durch {1}', [alt.name, neu.name]), 'ok')
    cur.value = neu.id
    await store.poll(true); await loadFolders(); await load()
  } catch (e) { store.toast(e.message) }
  finally { busy.value = '' }
}

// ---- Zuordnen: Knoten wählen, dann eine Relation je Medium
const zuordnen = ref(null)   // { medien, node, role } — offen, solange gesetzt
function zuordnenOeffnen(m) { zuordnen.value = { medien: betroffene(m), node: null, role: null } }
function zuordnenZiel(r) { zuordnen.value.node = r?.id ?? null; zuordnen.value.role = r?.role ?? null }
const zuordnenTypen = computed(() => zuordnen.value?.role ? mediaTypesFor(model.value, zuordnen.value.role) : [])
async function zuordnenAusfuehren() {
  const z = zuordnen.value
  if (!z?.node) return
  busy.value = t_('zuordnen …')
  try {
    const erg = await attachMedia(z.medien, z.node, zuordnenTypen.value)
    for (const f of erg.fehler) store.toast(f)
    if (erg.zugeordnet) store.toast(medienMeldung(erg), 'ok')
    zuordnen.value = null
    await store.poll(true); await load(); await loadUsage()
  } finally { busy.value = '' }
}

// ---- Workflow am Asset: derselbe wie am Knoten, wenn seine Rollen „media“ nennen
const wfs = ref([])
async function loadWorkflow() {
  wfs.value = []
  if (!cur.value) return
  try { wfs.value = await api.get(`/api/media/${cur.value}/workflow`) } catch { /* ohne Workflow kein Abschnitt */ }
}
watch(cur, loadWorkflow, { immediate: true })
const wfColor = c => ({ pos: 'var(--pos)', neg: 'var(--neg)', warn: 'var(--warn)', accent: 'var(--accent)', muted: 'var(--muted)' })[c] ?? (c && /^#/.test(c) ? c : 'var(--muted)')
async function wfStep(w, t) {
  let note = null
  if (t.noteRequired) {
    note = await dialog.prompt({ title: `${L(t.label) || t.key} → ${L(t.toLabel) || t.to}`, text: t_('Notiz (Pflicht)'), placeholder: t_('Notiz'), ok: `⚑ ${L(t.label) || t.key}` })
    if (note === null) return
    if (!note.trim()) { store.toast(t_('Notiz ist Pflicht bei diesem Schritt')); return }
  }
  try { await api.post(`/api/media/${cur.value}/workflow/${w.workflow}/${t.key}`, { note: note || null }); await store.poll(true); await loadWorkflow(); await load() }
  catch (e) { store.toast(e.message) }
}
const state = ref('')            // '' = alle, sonst "workflow:zustand"
function toggleState(k) { state.value = state.value === k ? '' : k; return load() }

// ---- Verwendungsnachweis: an welchen Knoten dieses Asset hängt
const router = useRouter()
const usage = ref([])
const usageTotal = ref(0)   // alle Verwendungen — gezeigt werden höchstens 500
const ICON = { group: '▣', product: '▦', variant: '◆', rubric: '❖' }
/// Ein Stopp ist keine Verwendung, sondern eine Sperre an diesem Knoten und allem darunter.
const istStopp = r => (r.values ?? []).some(v => v.attribute === 'stop' && v.value === 'true')
async function loadUsage() {
  usage.value = []
  if (!cur.value) return
  try { const r = await api.get(`/api/media/${cur.value}/usage?take=500`); usage.value = r.items ?? r; usageTotal.value = r.total ?? usage.value.length } catch (e) { store.toast(e.message) }
}
watch(cur, loadUsage, { immediate: true })
/// Zum Knoten springen — der Baum öffnet ihn.
const springe = r => router.push(`/tree/${r.other.id}`)

// ---- Ansehen und Öffnen
/// Ein PDF zeigt der Browser selbst — dafür braucht es kein Plugin, nur den Rahmen um die Datei.
const istPdf = m => (m?.mime ?? '') === 'application/pdf'
const mediaTab = ref('vorschau')
const hatVorschau = computed(() => {
  const m = current.value
  if (!m) return false
  if (istPdf(m) && store.can('download')) return true
  if (m.isImage && store.can('download')) return true
  return !!m.hasThumb
})
watch(hatVorschau, v => { if (!v && mediaTab.value === 'vorschau') mediaTab.value = 'werte' })
/// Megapixel aus der Pixelzahl, mit Komma wie im Deutschen
const mp = n => (n / 1_000_000).toFixed(1).replace('.', ',')
/// Die Datei in einem neuen Fenster — was damit geschieht, entscheidet der Rechner des Anwenders.
// der Name als Parameter: eine andere Adresse als vor dem 28.09.2026 — die alte ist ein Jahr gecacht, ohne Dateinamen
const dateiLink = m => `/api/media/${encodeURIComponent(m.id)}/file?name=${encodeURIComponent(m.name ?? m.label ?? '')}`
const oeffnen = m => { if (store.can('download')) window.open(dateiLink(m), '_blank', 'noopener') }
</script>

<template>
  <div class="pane" :style="`width:${foldersW}px;flex:none`">
    <div class="toolbar"><h1>{{ $t("📁 Ordner") }}</h1><span class="grow" /><button class="x" data-demo="aus" @click="newFolder(null)" :title="$t('neuer Ordner auf der obersten Ebene')">+</button></div>
    <div class="scroll ftree">
      <div class="pick" :class="{ on: folder === 'all' }" @click="pickFolder('all')" :title="$t('alle Medien der Bibliothek')">{{ $t("▦ Alle") + ' ' }}<span class="muted cnt">{{ folders.total }}</span></div>
      <div class="pick" :class="{ on: folder === '-', over: dragTarget === '-' }" @click="pickFolder('-')" :title="$t('Medien, die in keinem Ordner liegen — hierher ziehen nimmt sie aus ihrem Ordner')"
        @dragover="canDrop(null) && ($event.preventDefault(), dragTarget = '-')" @dragleave="dragTarget = null" @drop="dropOn(null, $event)">{{ $t("⌂ ohne Ordner") + ' ' }}<span class="muted cnt">{{ folders.unfiled }}</span></div>
      <div v-for="r in rows" :key="r.f.id" class="pick" :class="{ on: folder === r.f.id, over: dragTarget === r.f.id }" :style="`padding-left:${8 + r.depth * 14}px`"
        draggable="true" @dragstart="dragFolder(r.f, $event)" @dragend="dragEnd"
        @dragover="canDrop(r.f.id) && ($event.preventDefault(), dragTarget = r.f.id)" @dragleave="dragTarget = null" @drop="dropOn(r.f.id, $event)"
        @click="pickFolder(r.f.id)" :title="$t('{0} hier · {1} mit Unterordnern — ziehen: Ordner verschieben', [r.f.media, below(r.f.id)])">
        <span class="muted caret" @click.stop="toggle(r.f.id)">{{ r.kids ? (open.has(r.f.id) ? '▾' : '▸') : '' }}</span>
        <span class="fname">📁 {{ r.f.name }}<span v-if="r.f.roles?.length" class="lock" :title="$t('sichtbar nur für: {0}', [r.f.roles.join(', ')])">{{ ' 🔒' }}</span></span><span class="muted cnt">{{ deep ? below(r.f.id) : r.f.media }}</span>
        <span class="acts" data-demo="aus"><button class="x" @click.stop="newFolder(r.f.id)" :title="$t('Unterordner anlegen')">+</button><button class="x" @click.stop="renameFolder(r.f)" :title="$t('umbenennen')">✎</button><button class="x" @click.stop="restrictFolder(r.f)" :title="$t('sichtbar für Rollen …')">🔒</button><button class="x" @click.stop="deleteFolder(r.f)" :title="$t('löschen (nur leer)')">🗑</button></span>
      </div>
      <div v-if="!rows.length" class="empty" style="padding:12px 8px"><span :title="$t('+ legt einen an; Kacheln lassen sich hineinziehen.')">{{ $t("Noch kein Ordner") }}</span></div>
    </div>
    <div class="toolbar" style="font-size:12px"><label :title="$t('Ordner zeigt auch, was in seinen Unterordnern liegt')"><input type="checkbox" v-model="deep" />{{ ' ' + $t("mit Unterordnern") }}</label></div>
  </div>
  <Splitter v-model="foldersW" :min="140" :max="500" />

  <div class="pane" :style="`width:${listW}px;flex:none`" @dragover.prevent="!dragKind && (dragOver = true)" @dragleave="dragOver = false" @drop.prevent="onDrop" :class="{ over: dragOver }">
    <div class="toolbar"><h1>▨ {{ folderTitle }}</h1><span class="muted">{{ weitere ? $t('{0} von {1}', [items.length, facets.total]) : items.length }}</span><span v-if="sel.size > 1" class="chip" :title="$t('Auswahl — Esc löst sie; Strg+A wählt alle')">{{ $t("{0} gewählt", [sel.size]) }}</span><span class="grow" /><span v-if="busy" class="muted">{{ busy }}</span></div>
    <div class="toolbar" style="gap:4px">
      <input v-model="q" type="search" :placeholder="$t('🔍 Name, Id, Werte')" style="flex:1;min-width:0" @input="search" />
      <select v-model="sort" :title="$t('Sortierung — nur die Anzeige')"><option v-for="[k, l] in SORTS" :key="k" :value="k">{{ l }}</option></select>
      <button class="x" @click="desc = !desc" :title="desc ? $t('Aufsteigend sortieren') : $t('Absteigend sortieren')">{{ desc ? '↓' : '↑' }}</button>
      <select v-model="group" :title="$t('Gruppierung — nur die Anzeige; der Ordnerfilter ist die Liste links')"><option v-for="[k, l] in GROUPS" :key="k" :value="k">{{ l }}</option></select>
      <button class="primary" data-demo="aus" @click="fileInput.click()" :title="folder === 'all' || folder === '-' ? $t('Dateien hochladen — oder hierher ziehen') : $t('hochladen in „{0}“ — oder hierher ziehen', [folderTitle])">{{ $t("⇧ Hochladen") }}</button>
      <input ref="fileInput" type="file" multiple style="display:none" @change="upload([...$event.target.files]); $event.target.value = ''" />
      <input ref="versionInput" type="file" style="display:none" @change="versionGewaehlt([...$event.target.files]); $event.target.value = ''" />
    </div>
    <!-- Facetten: anklicken schränkt ein, nochmal klicken hebt auf; mehrere Stichwörter gelten zusammen -->
    <div v-if="facets" class="toolbar facets">
      <span class="chip" :class="{ on: superseded }" @click="superseded = !superseded; load()"
        :title="$t('Abgelöste Versionen mit zeigen — sie bleiben für Belege und Versionen auflösbar')">{{ $t("abgelöste") }}</span>
      <span v-for="h in facets.herkunft" :key="'h' + h.key" class="chip" :class="{ on: plugin === h.key }" @click="togglePlugin(h.key)"
        :title="h.key === '-' ? $t('von Hand hochgeladen') : $t('über die Schnittstelle {0} gekommen', [h.key])">{{ (h.key === '-' ? $t('von Hand') : h.key) + ' ' }}<span class="muted">{{ h.n }}</span></span>
      <span v-for="z in facets.zustaende ?? []" :key="'z' + z.key" class="chip" :class="{ on: state === z.key }" :style="`border-color:${wfColor(z.color)}`" @click="toggleState(z.key)"
        :title="$t('Workflow „{0}“: nur Assets im Zustand „{1}“', [$L(z.label) || z.workflow, $L(z.stateLabel) || z.state])">{{ '⚑ ' + ($L(z.stateLabel) || z.state) + ' ' }}<span class="muted">{{ z.n }}</span></span>
      <span v-if="facets.abgelaufen" class="chip neg" :class="{ on: valid === 'expired' }" @click="valid = valid === 'expired' ? '' : 'expired'; load()"
        :title="$t('Assets, deren Frist vorbei ist — sie bleiben im Journal, fallen aber aus der Ausleitung')">{{ $t("abgelaufen") + ' ' }}<span class="muted">{{ facets.abgelaufen }}</span></span>
      <span v-if="facets.ohneStichwort" class="chip" :class="{ on: keywordAktiv('-') }" @click="toggleKeyword('-')"
        :title="$t('Assets, an denen kein Stichwort steht')">{{ $t("ohne Stichwort") + ' ' }}<span class="muted">{{ facets.ohneStichwort }}</span></span>
      <span v-for="k in facets.stichworte" :key="'k' + k.key" class="chip" :class="{ on: keywordAktiv(k.key) }" @click="toggleKeyword(k.key)"
        :title="$t('nur Assets mit diesem Stichwort — mehrere gelten zusammen')">{{ ($L(k.label) || k.key) + ' ' }}<span class="muted">{{ k.n }}</span></span>
    </div>
    <div class="scroll">
      <template v-for="g in grouped" :key="g.key">
        <div v-if="group" class="ghead"><span>{{ g.key }}</span><span class="muted">{{ g.items.length }}</span></div>
        <div class="tiles">
          <div v-for="m in g.items" :key="m.id" class="tile" :class="{ current: cur === m.id, sel: sel.has(m.id), abgeloest: m.supersededBy, ungueltig: m.valid === false }" draggable="true" @dragstart="dragTiles(m, $event)" @dragend="dragEnd"
            @click="clickTile(m, $event)" @dblclick="oeffnen(m)" @contextmenu="contextMenu($event, m)" :title="`${m.name} · ${kb(m.bytes)} · ${m.mime}${m.folder ? ' · 📁 ' + pathOf(m.folder).map(f => f.name).join(' › ') : ''}\nStrg-Klick nimmt dazu, Umschalt-Klick den Bereich — ziehen in einen Ordner, Doppelklick öffnet die Datei`">
            <MediaThumb v-if="m.isImage || m.hasThumb" :id="m.id" :self="m.isImage" />
            <div v-else class="doc">{{ m.mime.split('/')[1]?.slice(0, 6) || '▤' }}</div>
            <div class="name">{{ m.name }}</div>
            <div class="muted meta"><span v-for="z in m.workflow ?? []" :key="z.workflow" :style="`color:${wfColor(z.color)}`" :title="`${$L(z.label) || z.workflow}: ${$L(z.stateLabel) || z.state}`">⚑ </span><span v-if="m.valid === false" class="neg" :title="m.expired ? $t('abgelaufen — fällt aus der Ausleitung') : $t('gilt noch nicht')">⌛ </span>{{ kb(m.bytes) }}<span v-if="m.used"> · ⇄ {{ m.used }}</span><span v-if="folder === 'all' && m.folder && group !== 'folder'" :title="pathOf(m.folder).map(f => f.name).join(' › ')"> · 📁</span></div>
          </div>
        </div>
      </template>
      <button v-if="weitere" class="mehr" :disabled="mehrLaedt" :title="$t('Die nächsten Assets laden')" @click="mehr">▼ {{ $t('weitere {0}', [Math.min(SEITE, weitere)]) }}</button>
      <div v-if="!items.length" class="empty">{{ folder === 'all' ? $t('Noch nichts — Dateien hierher ziehen oder ⇧ hochladen.') : $t('Hier liegt nichts — Kacheln aus „Alle“ hierher ziehen oder ⇧ hochladen.') }}</div>
    </div>
  </div>
  <Splitter v-model="listW" :min="300" :max="1400" />

  <div class="pane" style="flex:1" v-if="current">
    <div class="toolbar"><h1>▨ {{ current.name }}</h1><span class="mono muted">{{ current.id }}</span><span class="grow" />
      <!-- Laden darf, wer das Recht hat — sehen ist nicht haben; ohne Recht fehlt der Weg, nicht nur der Knopf -->
      <a v-if="store.can('download')" :href="dateiLink(current)" target="_blank" class="muted" :title="$t('Datei öffnen')">{{ $t("↗ Datei") }}</a>
      <button v-if="current.isImage && store.can('download')" class="x" data-demo="aus" @click="zuschneiden(current)" :title="$t('Zuschneiden und ausrichten — das Ergebnis ist ein neues Medium')">✂</button>
      <button class="x" data-demo="aus" @click="retire(current)" :title="sel.size > 1 ? $t('{0} gewählte Medien zurückziehen (die Dateien bleiben im Store)', [sel.size]) : $t('Medium zurückziehen (die Datei bleibt im Store)')">🗑</button></div>
    <div class="toolbar meta muted"><span>{{ current.mime }}</span><span>· {{ kb(current.bytes) }}</span><span>{{ $t("· ⇄ {0} Knoten", [current.used]) }}</span>
      <span :title="current.folder ? $t('Ordner — zum Verschieben die Kachel auf einen Ordner links ziehen') : $t('in keinem Ordner — Kachel auf einen Ordner links ziehen')">· 📁 {{ current.folder ? pathOf(current.folder).map(f => f.name).join(' › ') : '—' }}</span>
      <span class="grow" /><span>≡ {{ current.entries }} · #{{ current.lastNumber }} · {{ when(current.lastAt) }} · {{ current.lastActor }}</span></div>
    <div class="toolbar tab-bar">
      <span v-if="hatVorschau" class="tab" :class="{ on: mediaTab === 'vorschau' }" @click="mediaTab = 'vorschau'" :title="$t('Vorschau')">◫</span>
      <span class="tab" :class="{ on: mediaTab === 'werte' }" @click="mediaTab = 'werte'" :title="$t('Werte und Abmessungen')">≡</span>
      <span class="tab" :class="{ on: mediaTab === 'verwendung' }" @click="mediaTab = 'verwendung'" :title="$t('Verwendung und Workflow')">⇄</span>
    </div>
    <!-- Vorschau: füllt den Platz -->
    <div class="media-tab-fill" v-if="mediaTab === 'vorschau' && hatVorschau">
      <PdfPane v-if="istPdf(current) && store.can('download')" :doc="current.id" />
      <div v-else class="preview-full">
        <img v-if="current.isImage && store.can('download')" :src="`/api/media/${current.id}/file`" alt="" />
        <img v-else-if="current.hasThumb" :src="`/api/media/${current.id}/thumb`" alt="" />
      </div>
    </div>
    <!-- Werte: pflegbare Attribute, gemessene Daten, Herkunft -->
    <div class="scroll" v-else-if="mediaTab === 'werte'">
      <table class="grid form"><colgroup><col style="width:150px" /><col style="width:320px" /></colgroup><tbody>
        <template v-for="d in mediaAttrs" :key="d.key">
          <tr><td class="attr" :title="d.key">{{ $L(d.label) || d.key }}<span v-if="d.perLocale" class="muted"> {{ master }}</span></td>
            <ListCell v-if="d.multiple" :value="value(current, d)" :options="d.type === 'enum' ? listOptions(d) : null" :label-of="d.type === 'enum' ? listLabel(d) : null" :list="d.list" @save="v => setValue(current, d, v)" />
            <SelectCell v-else-if="d.type === 'enum'" :value="value(current, d)" :options="listOptions(d)" :label-of="listLabel(d)" :list="d.list" @save="v => setValue(current, d, v)" />
            <Cell v-else :value="value(current, d)" @save="v => setValue(current, d, v)" /></tr>
          <tr v-if="d.key === 'keywords' && suggestions.length"><td></td><td class="sug">
            <span v-for="v in suggestions" :key="v.key" class="chip" @click="annehmen(v)"
              :title="$t('vorgeschlagen · {0} — Klick nimmt an', [v.why])">{{ '+ ' + ($L(v.label) || v.key) }}</span>
          </td></tr>
        </template>
        <tr><td class="attr muted" :title="$t('Abmessungen des fertigen Bildes — eine EXIF-Drehung ist eingerechnet.')">{{ $t("▭ Abmessungen") }}</td>
          <td v-if="current.probe?.width" class="mono">{{ current.probe.width }} × {{ current.probe.height }} px<span class="muted">{{ ' · ' + mp(current.pixels) + ' MP' }}</span></td>
          <td v-else class="muted" :title="current.probe ? $t('Kein Format, das der Server aus dem Kopf liest.') : $t('Der Job probe liest die Abmessungen nach.')">—</td></tr>
        <tr v-if="current.probe?.dpi"><td class="attr muted">{{ $t("Auflösung") }}</td><td class="mono">{{ current.probe.dpi }} dpi</td></tr>
        <tr v-if="current.probe?.space"><td class="attr muted">{{ $t("Farbraum") }}</td><td class="mono">{{ current.probe.space }}</td></tr>
        <tr v-if="current.probe && current.probe.alpha !== null"><td class="attr muted">{{ $t("Transparenz") }}</td><td>{{ current.probe.alpha ? '✓' : '–' }}</td></tr>
        <tr><td class="attr muted" :title="$t('Die Schnittstelle und das Profil, aus denen das Asset kam.')">{{ $t("↓ Herkunft") }}</td>
          <td v-if="current.source?.plugin || current.source?.profile">{{ current.source.plugin ?? '—' }}<span v-if="current.source.profile" class="muted">{{ ' · ' + current.source.profile }}</span></td>
          <td v-else class="muted">{{ $t("von Hand") }}</td></tr>
        <tr v-if="current.source?.ref"><td class="attr muted">{{ $t("Bezug") }}</td><td class="mono muted" style="font-size:11px">{{ current.source.ref }}</td></tr>
        <tr v-if="current.source?.job"><td class="attr muted">{{ $t("Job") }}</td><td class="mono muted">{{ current.source.job }}</td></tr>
        <tr v-if="current.source?.from"><td class="attr muted">{{ $t("Abstammung") }}</td>
          <td><button class="x mono" @click="cur = current.source.from" :title="$t('zu dem Medium, aus dem dieses entstand')">{{ '▨ ' + current.source.from }}</button></td></tr>
        <tr><td class="attr muted">{{ $t("Angelegt") }}</td><td class="muted">{{ when(current.createdAt) + ' · ' + current.createdBy }}</td></tr>
        <tr v-if="current.supersededBy"><td class="attr muted">{{ $t("ersetzt durch") }}</td>
          <td><button class="x mono ersetzt" @click="superseded = true; cur = current.supersededBy; load()" :title="$t('zur aktuellen Version')">{{ '▨ ' + current.supersededBy }}</button></td></tr>
        <tr v-if="current.supersedes"><td class="attr muted">{{ $t("ersetzt") }}</td>
          <td><button class="x mono" @click="superseded = true; cur = current.supersedes; load()" :title="$t('zur abgelösten Version — sie bleibt für Belege und Versionen auflösbar')">{{ '▨ ' + current.supersedes }}</button></td></tr>
        <tr><td class="attr muted">{{ $t("SHA-256") }}</td><td class="mono muted" style="font-size:11px">{{ current.sha256 }}</td></tr>
        <tr v-for="(v, k) in current.external" :key="k"><td class="attr muted">⇩ {{ k }}</td><td class="mono muted">{{ v }}</td></tr>
      </tbody></table>
    </div>
    <!-- Verwendung und Workflow -->
    <div class="scroll" v-else-if="mediaTab === 'verwendung'">
      <template v-if="wfs.length">
        <h2 class="use-h">{{ $t("⚑ Workflow") + ' ' }}<span class="muted">{{ '· ' + wfs.length }}</span></h2>
        <div v-for="w in wfs" :key="w.workflow" class="wf">
          <span class="muted wf-name" :title="w.workflow">{{ $L(w.label) || w.workflow }}</span>
          <span class="chip" :style="`border-color:${wfColor(w.color)};color:${wfColor(w.color)}`" :title="w.since ? `seit ${when(w.since)} · ${w.actor}${w.transition ? ' · Schritt ' + w.transition : ''}` : $t('Startzustand')">{{ $L(w.stateLabel) || w.state }}</span>
          <button v-for="t in w.transitions" :key="t.key" @click="wfStep(w, t)"
            :title="`→ ${$L(t.toLabel) || t.to}${t.noteRequired ? ' · ' + $t('Notiz Pflicht') : ''}${t.effects?.length ? ' · ' + $t('am Asset ohne Wirkung: {0}', [t.effects.join(', ')]) : ''}`">{{ ($L(t.label) || t.key) + ' →' }}</button>
          <span v-if="!w.transitions.length && w.all.length" class="muted" style="font-size:12px" :title="w.all.map(t => `${$L(t.label) || t.key}: ${(t.roles ?? []).join(', ') || $t('jede Rolle')}`).join(' · ')">{{ $t("nächster Schritt: {0}", [w.all.map(t => (t.roles ?? []).join('/') || $t('Rolle mit Schreibrecht')).join(', ')]) }}</span>
          <span v-if="!w.transitions.length && !w.all.length" class="muted" style="font-size:12px">{{ $t("Ende des Wegs") }}</span>
          <span v-if="w.note" class="muted wf-note" :title="w.note">✎ {{ w.note }}</span>
        </div>
      </template>
      <h2 class="use-h">{{ $t("⇄ Verwendung") + ' ' }}<span class="muted">{{ '· ' + (usageTotal > usage.length ? $t('{0} von {1}', [usage.length, usageTotal]) : usage.length) }}</span></h2>
      <div v-if="!usage.length" class="empty" style="padding:8px">{{ $t("An keinem Knoten") }}</div>
      <div v-else class="uses">
        <div v-for="r in usage" :key="r.id" class="use" :class="{ stopp: istStopp(r) }" @click="springe(r)"
          :title="$t('zum Knoten springen — {0}', [r.other.id])">
          <span class="ico">{{ ICON[r.other.role] ?? '▪' }}</span>
          <span class="lbl">{{ r.other.label }}</span>
          <span class="muted typ">{{ r.type }}</span>
          <span v-if="istStopp(r)" class="muted" :title="$t('hier und darunter unterbunden — keine Verwendung')">⛔</span>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="pane" style="flex:1"><div class="empty">{{ $t("Medium in der Mitte wählen — oder hochladen.") }}</div></div>

  <CropEditor v-if="cropFuer" :medium="cropFuer" @done="zugeschnitten" @close="cropFuer = null" />

  <!-- Zuordnen: ein Knoten aus dem Baum, dann eine Relation je gewähltem Asset -->
  <div v-if="zuordnen" class="zu-overlay">
    <div class="zu">
      <div class="toolbar"><h1>{{ $t("⇄ Zuordnen") + ' ' }}<span class="muted">{{ '· ' + zuordnen.medien.length }}</span></h1><span class="grow" />
        <button class="x" @click="zuordnen = null" :title="$t('schliessen')">✕</button></div>
      <TreePicker :model-value="zuordnen.node" :roles="['group', 'product', 'variant']" :height="300" @pick="zuordnenZiel" />
      <div class="toolbar">
        <span class="muted" style="font-size:12px" :title="$t('Ein Bild wird als Bild zugeordnet, alles andere als Dokument.')">{{ zuordnenTypen.map(t => $L(t.label) || t.key).join(' · ') || $t("Kein Relationstyp zu Medien für diesen Knotentyp") }}</span>
        <span class="grow" />
        <button class="primary" :disabled="!zuordnen.node || !zuordnenTypen.length" @click="zuordnenAusfuehren">{{ $t("✓ Zuordnen") }}</button>
      </div>
    </div>
  </div>
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
.tile.abgeloest { opacity: .55; border-style: dashed; }
.tile.ungueltig { border-color: var(--neg); }
.tile img, .tile .doc { width: 110px; height: 90px; object-fit: contain; display: grid; place-items: center; background: var(--bg); border-radius: 4px; color: var(--muted); font-size: 12px; }
.tile .name { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px; }
.tile .meta { font-size: 11px; }
.tab-bar { gap: 2px; }
.tab { padding: 2px 10px; border-radius: 4px; color: var(--muted); cursor: pointer; font-size: 13px; }
.tab.on { background: var(--accent-soft); color: var(--text); }
.media-tab-fill { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.preview-full { flex: 1; min-height: 0; display: grid; place-items: center; padding: 8px; overflow: auto; }
.preview-full img { max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 4px; background: var(--bg); }
.form { width: auto; }
.use-h { font-size: 13px; padding: 12px 8px 4px; margin: 0; border-top: var(--line); }
.uses { padding: 0 8px 8px; }
.use { display: flex; gap: 6px; align-items: baseline; padding: 3px 4px; border-radius: 4px; cursor: pointer; }
.use:hover { background: var(--hover); }
.use.stopp .lbl { text-decoration: line-through; }
.use .lbl { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.use .typ { font-size: 11px; }
.wf { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding: 3px 8px; }
.wf .wf-name { min-width: 90px; font-size: 12px; }
.wf .wf-note { font-size: 12px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.facets { flex-wrap: wrap; gap: 4px; padding-top: 0; }
.facets .chip { cursor: pointer; }
.mehr { display: block; margin: 8px auto; }
.facets .chip.on { background: var(--accent-soft); border-color: var(--accent); }
.sug { padding: 2px 4px 6px; }
.sug .chip { cursor: pointer; margin-right: 4px; }
.zu-overlay { position: fixed; inset: 0; background: #0008; display: grid; place-items: center; z-index: 50; }
.zu { width: 480px; max-width: 92vw; background: var(--pane); border: 1px solid var(--line); border-radius: 8px; }
.form td.attr { white-space: nowrap; color: var(--muted); }
.x { border: 0; background: none; color: var(--muted); padding: 0 3px; }
.x:hover { color: var(--text); }
</style>
