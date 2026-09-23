<script setup>
// Einstellungen → Wiederherstellen (Taloan, 23.09.2026: „ich wollte in den Einstellungen lediglich das Restore haben“).
// Das Sichern selbst ist ein Job des Plugins backup — es ruft POST /api/backup, und der Zeitplan gehört zum Tasker.
// Hier steht nur der Weg zurück: oben die Vollsicherung in ein leeres System („neuer Docker irgendwo, Sicherung
// einspielen"), unten der einzelne Teilbaum aus einer Rohdaten-Datei — zum Zurückholen, nicht zum Wiederaufbauen.
import { ref, onMounted } from 'vue'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { filePicker } from '../filePicker.js'

const dir = ref(localStorage.getItem('journali.backup.dir') ?? '')
const stand = ref(null)        // { hier: {entries, media, storage}, dort: Meta|null }
const busy = ref('')
const said = ref('')

// Teilbaum aus einer Datei
const tdir = ref(localStorage.getItem('journali.restore.dir') ?? '')
const files = ref([])
const gewaehlt = ref(null)
const probe = ref(null)
const tsaid = ref('')

const kb = b => {
  const z = (x, e) => (x / e).toLocaleString('de-DE', { maximumFractionDigits: 1 })
  return !b ? '0kb' : b >= 1073741824 ? z(b, 1073741824) + 'gb' : b >= 1048576 ? z(b, 1048576) + 'mb' : Math.max(1, Math.round(b / 1024)) + 'kb'
}
const n = x => (x ?? 0).toLocaleString('de-DE')

async function lies() {
  busy.value = '…'; said.value = ''
  try {
    stand.value = await api.get(`/api/backup/status${dir.value.trim() ? `?dir=${encodeURIComponent(dir.value.trim())}` : ''}`)
    if (dir.value.trim()) localStorage.setItem('journali.backup.dir', dir.value.trim())
  } catch (e) { said.value = '✗ ' + e.message }
  finally { busy.value = '' }
}

async function zurueck() {
  const dort = stand.value?.dort
  if (!dort) { said.value = '✗ keine Sicherung in diesem Verzeichnis'; return }
  const ok = await dialog.confirm({
    title: 'Sicherung einspielen?',
    warn: `${n(dort.entries)} Einträge · ${n(dort.media)} Medien · ${dort.config} Dateien · ${dort.plugins} Plugins`,
    list: [`vom ${when(dort.at)}`, 'geht nur in ein leeres System'],
    ok: 'Einspielen',
    danger: true,
  })
  if (!ok) return
  busy.value = '…'
  try {
    const r = await api.post('/api/backup/restore', { dir: dir.value.trim(), ...mit.value })
    said.value = `✓ ${n(r.entries)} Einträge, ${n(r.media)} Medien, ${r.config} Dateien, ${r.plugins} Plugins · ${r.hinweis}`
  } catch (e) { said.value = '✗ ' + e.message }
  finally { busy.value = '' }
}

async function ladeTeilbaum() {
  if (!tdir.value.trim()) { files.value = []; return }
  tsaid.value = ''
  try {
    const r = await api.get(`/api/restore/files?path=${encodeURIComponent(tdir.value.trim())}`)
    files.value = r.files ?? []; tdir.value = r.path
    localStorage.setItem('journali.restore.dir', r.path)
    if (!files.value.length) tsaid.value = 'keine Dateien in diesem Verzeichnis'
  } catch (e) { files.value = []; tsaid.value = '✗ ' + e.message }
}

async function pruefen() {
  if (!gewaehlt.value) return
  probe.value = null; tsaid.value = ''
  try { probe.value = await api.post('/api/restore', { path: gewaehlt.value.path, dryRun: true }) }
  catch (e) { tsaid.value = '✗ ' + e.message }
}

async function einspielen() {
  const p = probe.value
  if (!p) return
  const ok = await dialog.confirm({
    title: 'Teilbaum einspielen?',
    warn: `${p.created} neu · ${p.updated} angeglichen · ${p.restored} zurückgeholt${p.model ? ` · ${p.model} Modellteile` : ''}`,
    list: [gewaehlt.value.name], ok: 'Einspielen', danger: true,
  })
  if (!ok) return
  try {
    const r = await api.post('/api/restore', { path: gewaehlt.value.path, dryRun: false })
    tsaid.value = `✓ ${r.created} angelegt, ${r.updated} angeglichen, ${r.restored} zurückgeholt · ${r.entries} Einträge`
    probe.value = null
    await store.poll(true)
  } catch (e) { tsaid.value = '✗ ' + e.message }
}

onMounted(lies)
</script>

<template>
  <div class="section">
    <h2>↺ Wiederherstellen <span class="muted">· Journal, Assets, Zugänge, Plugins</span></h2>

    <div class="row" style="gap:6px;margin-bottom:6px">
      <input v-model="dir" type="text" placeholder="Verzeichnis der Sicherung" style="flex:1" @keydown.enter="lies" />
      <button title="Verzeichnis auf dem Server wählen" @click="filePicker({ value: dir, dirOnly: true, onPick: v => { dir = v; lies() } })">📁</button>
      <button :disabled="!!busy" @click="lies">Lesen</button>
    </div>

    <table v-if="stand?.hier" class="grid"><tbody>
      <tr><td class="muted" style="width:130px">dieses System</td>
        <td>{{ n(stand.hier.entries) }} Einträge · {{ n(stand.hier.media) }} Assets · Speicher {{ stand.hier.storage }}</td></tr>
      <tr><td class="muted">im Verzeichnis</td>
        <td v-if="stand.dort">{{ n(stand.dort.entries) }} Einträge · {{ n(stand.dort.media) }} Assets ({{ kb(stand.dort.bytes) }}) · {{ stand.dort.config }} Dateien · {{ stand.dort.plugins }} Plugins · {{ when(stand.dort.at) }}</td>
        <td v-else class="muted">keine Sicherung</td></tr>
    </tbody></table>

    <div class="row" style="gap:8px;align-items:center;margin-top:8px">
      <button :disabled="!!busy || !stand?.dort || (stand.hier?.entries ?? 0) > 0"
        :title="!stand?.dort ? 'keine Sicherung im Verzeichnis' : stand.hier.entries > 0 ? `hier stehen ${n(stand.hier.entries)} Einträge` : 'Sicherung einspielen'"
        @click="zurueck">↺ Einspielen</button>
      <span v-if="(stand?.hier?.entries ?? 0) > 0" class="muted" style="font-size:12px">dieses System ist nicht leer</span>
      <span v-else-if="stand && !stand.dort" class="muted" style="font-size:12px">keine Sicherung im Verzeichnis</span>
    </div>
    <div v-if="said" :class="said.startsWith('✗') ? 'neg' : 'pos'" style="font-size:12px;margin-top:6px">{{ said }}</div>
  </div>

  <div class="section">
    <h2>↺ Teilbaum einspielen <span class="muted">· einzelne Datei, Rohdaten-JSON</span></h2>

    <div class="row" style="gap:6px;margin-bottom:6px">
      <input v-model="tdir" type="text" placeholder="Verzeichnis" style="flex:1" @keydown.enter="ladeTeilbaum" />
      <button title="Verzeichnis auf dem Server wählen" @click="filePicker({ value: tdir, dirOnly: true, onPick: v => { tdir = v; ladeTeilbaum() } })">📁</button>
      <button @click="ladeTeilbaum">Lesen</button>
    </div>

    <table v-if="files.length" class="grid"><tbody>
      <tr v-for="f in files" :key="f.path" :class="{ current: gewaehlt?.path === f.path }" style="cursor:pointer" @click="gewaehlt = f; probe = null">
        <td>{{ gewaehlt?.path === f.path ? '●' : '○' }} {{ f.name }}</td>
        <td class="muted" style="width:90px;text-align:right">{{ kb(f.size) }}</td>
        <td class="muted" style="width:130px">{{ when(f.at) }}</td>
      </tr>
    </tbody></table>

    <div v-if="gewaehlt" class="row" style="gap:8px;margin-top:8px;align-items:center">
      <button @click="pruefen">Prüfen</button>
      <button v-if="probe" class="primary" @click="einspielen">↺ Einspielen</button>
      <span v-if="probe" class="muted" style="font-size:12px">{{ probe.created }} neu · {{ probe.updated }} angeglichen · {{ probe.restored }} zurückgeholt<template v-if="probe.model"> · {{ probe.model }} Modellteile</template></span>
    </div>

    <div v-if="tsaid" :class="tsaid.startsWith('✗') ? 'neg' : 'pos'" style="font-size:12px;margin-top:6px">{{ tsaid }}</div>
  </div>
</template>
