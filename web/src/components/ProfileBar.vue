<script setup>
// Konfigurationen je Import-Plugin (Taloan, 17.09.2026): mehrere benannte Profile (Quelle, Wurzel, Ziel, Zuordnung …),
// gespeichert im Journal unter plugin:<key> als PluginDataSet „config:<name>“ — damit gelten sie für alle, nicht nur
// für diesen Browser, und jede Änderung ist nachvollziehbar. get() liefert den Stand der Ansicht, set(obj) stellt ihn her.
import { ref, onMounted } from 'vue'
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
  try { const data = await api.get(`/api/plugins/${props.plugin}/data/${encodeURIComponent(PREFIX + n)}`); props.set(data ?? {}); current.value = n; name.value = n; localStorage.setItem(`journali.profile.${props.plugin}.${props.scope}`, n) }
  catch (e) { store.toast(`Profil ${n}: ${e.message}`) }
  finally { busy.value = false }
}
async function save() {
  const n = (name.value || current.value).trim()
  if (!n) { store.toast('Profil: Name fehlt'); return }
  busy.value = true
  try {
    await api.post(`/api/plugins/${props.plugin}/data/${encodeURIComponent(PREFIX + n)}`, props.get(), 'PUT')
    if (!names.value.includes(n)) names.value = [...names.value, n].sort()
    current.value = n; localStorage.setItem(`journali.profile.${props.plugin}.${props.scope}`, n)
    store.toast(`💾 Profil „${n}“ gespeichert`)
  } catch (e) { store.toast(e.message) }
  finally { busy.value = false }
}
async function remove() {
  const n = current.value; if (!n) return
  if (!await dialog.confirm({ title: `Profil „${n}“ löschen?`, ok: '🗑 Löschen', danger: true })) return
  try { await api.del(`/api/plugins/${props.plugin}/data/${encodeURIComponent(PREFIX + n)}`); names.value = names.value.filter(x => x !== n); current.value = ''; name.value = ''; localStorage.removeItem(`journali.profile.${props.plugin}.${props.scope}`) }
  catch (e) { store.toast(e.message) }
}
onMounted(load)
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
    <button class="x" @click="save" :disabled="busy" :title="name && name !== current ? `als „${name}“ speichern` : 'Profil speichern (überschreiben)'">💾</button>
    <button class="x" @click="remove" :disabled="!current || busy" title="Profil löschen">✕</button>
  </div>
</template>

<style scoped>
.profiles { display: flex; align-items: center; gap: 4px; }
.profiles select { min-width: 160px; max-width: 260px; }   /* Profilnamen lesbar (Taloan, 21.09.) */
</style>
