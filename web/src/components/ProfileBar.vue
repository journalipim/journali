<script setup>
// Konfigurationen je Import-Plugin (Taloan, 17.09.2026): mehrere benannte Profile (Quelle, Wurzel, Ziel, Zuordnung …),
// gespeichert im Journal unter plugin:<key> als PluginDataSet „config:<name>“ — damit gelten sie für alle, nicht nur
// für diesen Browser, und jede Änderung ist nachvollziehbar. get() liefert den Stand der Ansicht, set(obj) stellt ihn her.
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'

// scope: „config“ (Ansicht des Plugins) oder „run“ (Parameter des Prozesses) — getrennte Namensräume im selben Strom
const props = defineProps({ plugin: String, get: Function, set: Function, scope: { type: String, default: 'config' } })
const PREFIX = props.scope + ':'
const names = ref([])
const current = ref('')
const name = ref('')
const busy = ref(false)
// Ungespeichert? (Taloan, 21.09.: „ich ändere unten Regeln und vergesse das Profil zu speichern“): der Stand der Ansicht (get()) wird jede
// Sekunde mit dem gespeicherten verglichen. Ist ein Profil gewählt, speichert es sich von selbst (1,5 s nach der letzten Änderung —
// jede Fassung steht im Journal, nichts geht verloren); ohne Profil pulsiert 💾 und der Hinweis sagt es.
const saved = ref('')          // JSON des gespeicherten Standes
const dirty = ref(false)
let timer = null, autoTimer = null
const snapshot = () => { try { return JSON.stringify(props.get() ?? {}) } catch { return '' } }
function tick() {
  const now = snapshot()
  const d = now !== saved.value && now !== '{}'
  if (d !== dirty.value) dirty.value = d
  if (d && current.value && !busy.value && (name.value === current.value || !name.value)) { clearTimeout(autoTimer); autoTimer = setTimeout(() => { if (snapshot() !== saved.value) save(true) }, 1500) }
}
onUnmounted(() => { clearInterval(timer); clearTimeout(autoTimer) })

async function load() {
  try { names.value = (await api.get(`/api/plugins/${props.plugin}/data`)).filter(n => n.startsWith(PREFIX)).map(n => n.slice(PREFIX.length)) }
  catch { names.value = [] }
  // zuletzt benutztes Profil dieses Browsers wieder anwenden
  const last = localStorage.getItem(`journali.profile.${props.plugin}.${props.scope}`)
  if (last && names.value.includes(last)) await apply(last)
}
async function apply(n) {
  // „— Profil —“: Felder leeren (set(null)), nichts gemerkt — Taloan, 17.09.
  if (!n) { current.value = ''; name.value = ''; localStorage.removeItem(`journali.profile.${props.plugin}.${props.scope}`); props.set(null); return }
  busy.value = true
  try { const data = await api.get(`/api/plugins/${props.plugin}/data/${encodeURIComponent(PREFIX + n)}`); props.set(data ?? {}); current.value = n; name.value = n; localStorage.setItem(`journali.profile.${props.plugin}.${props.scope}`, n); setTimeout(() => { saved.value = snapshot(); dirty.value = false }, 0) }
  catch (e) { store.toast(`Profil ${n}: ${e.message}`) }
  finally { busy.value = false }
}
async function save(auto = false) {
  const n = (name.value || current.value).trim()
  if (!n) { store.toast('Profil: Name fehlt — oben eintragen, dann 💾'); return }
  busy.value = true
  try {
    const data = props.get()
    await api.post(`/api/plugins/${props.plugin}/data/${encodeURIComponent(PREFIX + n)}`, data, 'PUT')
    if (!names.value.includes(n)) names.value = [...names.value, n].sort()
    current.value = n; localStorage.setItem(`journali.profile.${props.plugin}.${props.scope}`, n)
    saved.value = JSON.stringify(data ?? {}); dirty.value = false
    store.toast(auto ? `💾 Profil „${n}“ automatisch gespeichert` : `💾 Profil „${n}“ gespeichert`, 'ok')
  } catch (e) { store.toast(e.message) }
  finally { busy.value = false }
}
async function remove() {
  const n = current.value; if (!n) return
  if (!await dialog.confirm({ title: `Profil „${n}“ löschen?`, ok: '🗑 Löschen', danger: true })) return
  try { await api.del(`/api/plugins/${props.plugin}/data/${encodeURIComponent(PREFIX + n)}`); names.value = names.value.filter(x => x !== n); current.value = ''; name.value = ''; localStorage.removeItem(`journali.profile.${props.plugin}.${props.scope}`) }
  catch (e) { store.toast(e.message) }
}
onMounted(() => { load(); timer = setInterval(tick, 1000) })
defineExpose({ load })
</script>

<template>
  <div class="profiles" :title="`Konfigurationen des Plugins ${plugin} — im Journal (plugin:${plugin}), für alle`">
    <span class="muted">⚙</span>
    <select :value="current" @change="apply($event.target.value)" :disabled="busy" title="gespeichertes Profil laden">
      <option value="">— Profil —</option>
      <option v-for="n in names" :key="n" :value="n">{{ n }}</option>
    </select>
    <input v-model="name" type="text" placeholder="Name" style="width:200px" title="Name zum Speichern (neu oder vorhanden = überschreiben)" @keydown.enter="save" />
    <button class="x" :class="{ pulse: dirty && !current }" @click="save()" :disabled="busy" :title="name && name !== current ? `als „${name}“ speichern` : 'Profil speichern (überschreiben)'">💾</button>
    <button class="x" @click="remove" :disabled="!current || busy" title="Profil löschen">✕</button>
    <span v-if="dirty && !current" class="unsaved" title="Zuordnung und Umwandlungen sind nur hier im Browser — Name eintragen und 💾, sonst sind sie beim nächsten Mal weg">● ungespeichert — Name eintragen, 💾</span>
    <span v-else-if="dirty" class="muted" style="font-size:11px">● speichert …</span>
  </div>
</template>

<style scoped>
.unsaved { color: var(--warn); font-size: 12px; font-weight: 600; }
.x.pulse { color: var(--warn); animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
.profiles { display: flex; align-items: center; gap: 4px; }
.profiles select { min-width: 160px; max-width: 260px; }   /* Profilnamen lesbar (Taloan, 21.09.) */
</style>
