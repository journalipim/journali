<script setup>
// Einstellungen → Sicherung (Taloan, 23.09.2026). Zwei Dinge, die nichts miteinander zu tun haben:
// oben die Vollsicherung — Journal, Medien, die Dateien neben dem Journal und die Plugins; sie geht in ein leeres
// System zurück („neuer Docker irgendwo, Sicherung einspielen, muss das System wiederherstellen"). Ein pg_dump kann
// das nicht: Plugins und auth.json liegen im Dateisystem, nicht in der Datenbank.
// Unten der einzelne Teilbaum aus einer Rohdaten-Datei — zum Zurückholen, nicht zum Wiederaufbauen.
import { ref, onMounted } from 'vue'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { filePicker } from '../filePicker.js'

const dir = ref(localStorage.getItem('journali.backup.dir') ?? '')
const mit = ref({ media: true, config: true, plugins: true })
const stand = ref(null)        // { hier: {entries, media, storage}, dort: Meta|null }
const busy = ref('')
const said = ref('')

// Teilbaum aus einer Datei
const tdir = ref(localStorage.getItem('journali.restore.dir') ?? '')
const files = ref([])
const gewaehlt = ref(null)
const probe = ref(null)
const tsaid = ref('')

const kb = n => !n ? '0' : n >= 1073741824 ? (n / 1073741824).toFixed(1) + ' GB' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'
const n = x => (x ?? 0).toLocaleString('de-DE')

async function lies() {
  busy.value = '…'; said.value = ''
  try {
    stand.value = await api.get(`/api/backup/status${dir.value.trim() ? `?dir=${encodeURIComponent(dir.value.trim())}` : ''}`)
    if (dir.value.trim()) localStorage.setItem('journali.backup.dir', dir.value.trim())
  } catch (e) { said.value = '✗ ' + e.message }
  finally { busy.value = '' }
}

async function sichern() {
  if (!dir.value.trim()) { said.value = '✗ Verzeichnis fehlt'; return }
  busy.value = '…'; said.value = ''
  try {
    const r = await api.post('/api/backup', { dir: dir.value.trim(), ...mit.value })
    said.value = `✓ ${n(r.entries)} Einträge, ${n(r.media)} Medien (${kb(r.bytes)}), ${r.config} Dateien, ${r.plugins} Plugins`
    await lies()
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
    <h2>▣ Sichern <span class="muted">· Journal, Medien, Zugänge, Plugins</span></h2>

    <div class="row" style="gap:6px;margin-bottom:6px">
      <input v-model="dir" type="text" placeholder="Verzeichnis der Sicherung" style="flex:1" @keydown.enter="lies" />
      <button title="Verzeichnis auf dem Server wählen" @click="filePicker({ value: dir, dirOnly: true, onPick: v => { dir = v; lies() } })">📁</button>
      <button :disabled="!!busy" @click="lies">Lesen</button>
    </div>

    <div class="row" style="gap:14px;font-size:12px;margin-bottom:8px">
      <label title="die Dateien des Medienspeichers — bei postgres liegen sie in der Datenbank"><input type="checkbox" v-model="mit.media" /> Medien</label>
      <label title="auth.json, media.json, jobs/secrets.json — enthalten Passwort-Hashes und Token"><input type="checkbox" v-model="mit.config" /> Zugänge</label>
      <label title="die Plugin-Verzeichnisse ohne node_modules"><input type="checkbox" v-model="mit.plugins" /> Plugins</label>
      <span class="grow" />
      <button class="primary" :disabled="!!busy" @click="sichern">{{ busy || '▣ Sichern' }}</button>
    </div>

    <table v-if="stand?.hier" class="grid"><tbody>
      <tr><td class="muted" style="width:130px">dieses System</td>
        <td>{{ n(stand.hier.entries) }} Einträge · {{ n(stand.hier.media) }} Medien · Speicher {{ stand.hier.storage }}</td></tr>
      <tr><td class="muted">im Verzeichnis</td>
        <td v-if="stand.dort">{{ n(stand.dort.entries) }} Einträge · {{ n(stand.dort.media) }} Medien ({{ kb(stand.dort.bytes) }}) · {{ stand.dort.config }} Dateien · {{ stand.dort.plugins }} Plugins · {{ when(stand.dort.at) }}</td>
        <td v-else class="muted">keine Sicherung</td></tr>
    </tbody></table>

    <div v-if="said" :class="said.startsWith('✗') ? 'neg' : 'pos'" style="font-size:12px;margin-top:6px">{{ said }}</div>
  </div>

  <div class="section">
    <h2>↺ Wiederherstellen <span class="muted">· aus dem Verzeichnis oben, nur in ein leeres System</span></h2>
    <div class="row" style="gap:8px;align-items:center">
      <button :disabled="!!busy || !stand?.dort || (stand.hier?.entries ?? 0) > 0"
        :title="!stand?.dort ? 'keine Sicherung im Verzeichnis oben' : stand.hier.entries > 0 ? `hier stehen ${n(stand.hier.entries)} Einträge` : 'Sicherung einspielen'"
        @click="zurueck">↺ Einspielen</button>
      <span v-if="(stand?.hier?.entries ?? 0) > 0" class="muted" style="font-size:12px">dieses System ist nicht leer</span>
      <span v-else-if="stand && !stand.dort" class="muted" style="font-size:12px">keine Sicherung im Verzeichnis</span>
    </div>
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
