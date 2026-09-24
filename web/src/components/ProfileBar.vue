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
// Ungespeichert? (Taloan, 21.09.: „ich ändere unten Regeln und vergesse das Profil zu speichern“ — und: „automatisch speichern nervt,
// ich will eine Vorlage auch mal nur mit zwei geänderten Werten benutzen, ohne sie dauerhaft zu ändern“): der Stand der Ansicht (get())
// wird jede Sekunde mit dem gespeicherten verglichen; weicht er ab, schwebt unten eine Leiste — speichern, als neues Profil, verwerfen,
// oder ✕ (Leiste weg, Änderungen bleiben im Browser; bei der nächsten Änderung kommt sie wieder). Nichts speichert sich von selbst.
const saved = ref('')          // JSON des gespeicherten Standes
const dirty = ref(false)
const dismissed = ref('')      // Stand, bei dem die Leiste weggeklickt wurde — bei einer weiteren Änderung kommt sie wieder
let timer = null
const snapshot = () => { try { return JSON.stringify(props.get() ?? {}) } catch { return '' } }
function tick() { const now = snapshot(); const d = now !== saved.value && now !== '{}'; if (d !== dirty.value) dirty.value = d; if (!d) dismissed.value = '' }
const showBar = () => dirty.value && snapshot() !== dismissed.value
async function saveAs() {
  const n = await dialog.prompt({ title: 'Als neues Profil speichern', value: current.value ? current.value + '-2' : '', placeholder: 'Name', ok: '💾 Speichern' })
  if (!n?.trim()) return
  name.value = n.trim(); await save()
}
async function discard() { if (current.value) await apply(current.value); else { props.set(null); saved.value = ''; dirty.value = false } }
onUnmounted(() => { clearInterval(timer); window.removeEventListener('journali:profile-applied', rebase) })

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
async function save() {
  const n = (name.value || current.value).trim()
  if (!n) { store.toast('Profil: Name fehlt — oben eintragen, dann 💾'); return }
  busy.value = true
  try {
    const data = props.get()
    await api.post(`/api/plugins/${props.plugin}/data/${encodeURIComponent(PREFIX + n)}`, data, 'PUT')
    if (!names.value.includes(n)) names.value = [...names.value, n].sort()
    current.value = n; localStorage.setItem(`journali.profile.${props.plugin}.${props.scope}`, n)
    saved.value = JSON.stringify(data ?? {}); dirty.value = false
    store.toast(`💾 Profil „${n}“ gespeichert`, 'ok')
  } catch (e) { store.toast(e.message) }
  finally { busy.value = false }
}
async function remove() {
  const n = current.value; if (!n) return
  if (!await dialog.confirm({ title: `Profil „${n}“ löschen?`, ok: '🗑 Löschen', danger: true })) return
  try { await api.del(`/api/plugins/${props.plugin}/data/${encodeURIComponent(PREFIX + n)}`); names.value = names.value.filter(x => x !== n); current.value = ''; name.value = ''; localStorage.removeItem(`journali.profile.${props.plugin}.${props.scope}`) }
  catch (e) { store.toast(e.message) }
}
// die Ansicht sagt, wenn sie das Profil auf eine neu geladene Datei gelegt hat — das ist dann der Ausgangsstand
const rebase = () => { saved.value = snapshot(); dirty.value = false; dismissed.value = '' }
onMounted(() => { load(); timer = setInterval(tick, 1000); window.addEventListener('journali:profile-applied', rebase) })
defineExpose({ load })
</script>

<template>
  <div class="profiles" :title="`Konfigurationen des Plugins ${plugin} — im Journal (plugin:${plugin}), für alle`">
    <span class="muted">⚙</span>
    <select :value="current" @change="apply($event.target.value)" :disabled="busy" :title="$t('gespeichertes Profil laden')">
      <option value="">{{ $t("— Profil —") }}</option>
      <option v-for="n in names" :key="n" :value="n">{{ n }}</option>
    </select>
    <input v-model="name" type="text" :placeholder="$t('Name')" style="width:200px" :title="$t('Name zum Speichern (neu oder vorhanden = überschreiben)')" @keydown.enter="save" />
    <button class="x" @click="save()" :disabled="busy" :title="name && name !== current ? `als „${name}“ speichern` : 'Profil speichern (überschreiben)'">💾</button>
    <button class="x" @click="remove" :disabled="!current || busy" :title="$t('Profil löschen')">✕</button>
    <span v-if="dirty" class="unsaved" :title="$t('der Stand hier weicht vom gespeicherten Profil ab')">{{ $t("● geändert") }}</span>
  </div>
  <!-- schwebende Leiste unten (Taloan, 21.09.): geändert — speichern, als neues, verwerfen oder weg damit -->
  <Teleport to="body">
    <div v-if="showBar()" class="savebar">
      <span>{{ current ? `Profil „${current}“ geändert` : 'Einstellungen geändert — noch kein Profil' }}</span>
      <button v-if="current" class="primary" @click="save()" :disabled="busy" :title="$t('das gewählte Profil überschreiben')">{{ $t("💾 Speichern") }}</button>
      <button @click="saveAs" :disabled="busy" :title="$t('unter neuem Namen speichern — das gewählte Profil bleibt, wie es war')">{{ $t("Als neues Profil speichern …") }}</button>
      <button v-if="current" @click="discard" :disabled="busy" :title="$t('zurück zum gespeicherten Stand')">{{ $t("↶ Verwerfen") }}</button>
      <button class="x" @click="dismissed = snapshot()" :title="$t('Leiste schliessen — gespeichert wird nichts')">✕</button>
    </div>
  </Teleport>
</template>

<style scoped>
.unsaved { color: var(--warn); font-size: 12px; font-weight: 600; }
.savebar { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 60; display: flex; gap: 8px; align-items: center; padding: 8px 14px; background: var(--pane); border: 1px solid var(--warn); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.45); font-size: 13px; }
.savebar .x { border: 0; background: none; color: var(--muted); padding: 0 4px; }
.profiles { display: flex; align-items: center; gap: 4px; }
.profiles select { min-width: 160px; max-width: 260px; }   /* Profilnamen lesbar (Taloan, 21.09.) */
</style>
