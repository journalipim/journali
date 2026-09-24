<script setup>
// Einstellungen → B&R, Sichern und Wiederherstellen. Sichern von Hand gehört zu jedem Tarif; als Zeitplan
// ist es ein Job des Plugins backup (Tasker, ab Pro) — beide rufen POST /api/backup. Oben die Vollsicherung hin und
// zurück (zurück nur in ein leeres System), unten der einzelne Teilbaum aus einer Rohdaten-Datei.
import { ref, onMounted } from 'vue'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { filePicker } from '../filePicker.js'
import { t } from '../i18n.js'

const dir = ref(localStorage.getItem('journali.backup.dir') ?? '')
const stand = ref(null)        // { hier: {entries, media, storage}, dort: Meta|null }
const busy = ref('')
const said = ref('')
// Was mitgeht — beim Sichern wie beim Einspielen (fehlte bis 24.09.2026: Einspielen brach mit „mit is not defined“ ab)
const mit = ref({ media: true, config: true, plugins: true })

// Teilbaum aus einer Datei: gewählt wird sie im Dateibrowser des Servers
const gewaehlt = ref(localStorage.getItem('journali.restore.file') ?? '')
const probe = ref(null)
const tsaid = ref('')
const dateiName = () => gewaehlt.value.split(/[\\/]/).filter(Boolean).pop() ?? gewaehlt.value

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

async function sichern() {
  if (!dir.value.trim()) return
  busy.value = '…'; said.value = ''
  try {
    const r = await api.post('/api/backup', { dir: dir.value.trim(), ...mit.value })
    said.value = t('✓ {0} Einträge, {1} Assets, {2} Dateien, {3} Plugins{4}', [n(r.entries), n(r.media), r.config, r.plugins, r.hinweis ? ' · ' + r.hinweis : ''])
    localStorage.setItem('journali.backup.dir', dir.value.trim())
    stand.value = await api.get(`/api/backup/status?dir=${encodeURIComponent(dir.value.trim())}`)
  } catch (e) { said.value = '✗ ' + e.message }
  finally { busy.value = '' }
}

async function zurueck() {
  const dort = stand.value?.dort
  if (!dort) { said.value = t('✗ keine Sicherung in diesem Verzeichnis'); return }
  const ok = await dialog.confirm({
    title: t('Sicherung einspielen?'),
    warn: t('{0} Einträge · {1} Medien · {2} Dateien · {3} Plugins', [n(dort.entries), n(dort.media), dort.config, dort.plugins]),
    list: [`vom ${when(dort.at)}`, t('geht nur in ein leeres System')],
    ok: t('Einspielen'),
    danger: true,
  })
  if (!ok) return
  busy.value = '…'
  try {
    const r = await api.post('/api/backup/restore', { dir: dir.value.trim(), ...mit.value })
    said.value = t('✓ {0} Einträge, {1} Medien, {2} Dateien, {3} Plugins{4}', [n(r.entries), n(r.media), r.config, r.plugins, r.hinweis ? ' · ' + r.hinweis : ''])
  } catch (e) { said.value = '✗ ' + e.message }
  finally { busy.value = '' }
}

function waehleDatei() {
  filePicker({ value: gewaehlt.value, title: t('📁 Rohdaten-JSON auf dem Server'), onPick: v => {
    gewaehlt.value = v; probe.value = null; tsaid.value = ''
    try { localStorage.setItem('journali.restore.file', v) } catch {}
  } })
}

async function pruefen() {
  if (!gewaehlt.value) return
  probe.value = null; tsaid.value = ''
  try { probe.value = await api.post('/api/restore', { path: gewaehlt.value, dryRun: true }) }
  catch (e) { tsaid.value = '✗ ' + e.message }
}

async function einspielen() {
  const p = probe.value
  if (!p) return
  const ok = await dialog.confirm({
    title: t('Teilbaum einspielen?'),
    warn: t('{0} neu · {1} angeglichen · {2} zurückgeholt{3}', [p.created, p.updated, p.restored, p.model ? ' ' + t('· {0} Modellteile', [p.model]) : '']),
    list: [dateiName()], ok: t('Einspielen'), danger: true,
  })
  if (!ok) return
  try {
    const r = await api.post('/api/restore', { path: gewaehlt.value, dryRun: false })
    tsaid.value = t('✓ {0} angelegt, {1} angeglichen, {2} zurückgeholt · {3} Einträge', [r.created, r.updated, r.restored, r.entries])
    probe.value = null
    await store.poll(true)
  } catch (e) { tsaid.value = '✗ ' + e.message }
}

onMounted(lies)
</script>

<template>
  <div class="section">
    <h2 :title="$t('Vollsicherung in ein Verzeichnis auf dem Server; zurück nur in ein leeres System.')">{{ $t("⇅ Sichern und wiederherstellen") + ' ' }}<span class="muted">{{ $t("· Journal, Assets, Zugänge, Plugins") }}</span></h2>

    <div class="row" style="gap:6px;margin-bottom:6px">
      <input v-model="dir" type="text" class="pfad" :placeholder="$t('Verzeichnis der Sicherung')" @keydown.enter="lies" />
      <button :title="$t('Verzeichnis auf dem Server wählen — der Stand kommt beim Wählen')" @click="filePicker({ value: dir, dirOnly: true, onPick: v => { dir = v; lies() } })">📁</button>
    </div>

    <table v-if="stand?.hier" class="grid"><tbody>
      <tr><td class="muted" style="width:130px">{{ $t("dieses System") }}</td>
        <td>{{ $t("{0} Einträge · {1} Assets · Speicher {2}", [n(stand.hier.entries), n(stand.hier.media), stand.hier.storage]) }}</td></tr>
      <tr><td class="muted">{{ $t("im Verzeichnis") }}</td>
        <td v-if="stand.dort">{{ $t("{0} Einträge · {1} Assets ({2}) · {3} Dateien · {4} Plugins · {5}", [n(stand.dort.entries), n(stand.dort.media), kb(stand.dort.bytes), stand.dort.config, stand.dort.plugins, when(stand.dort.at)]) }}</td>
        <td v-else class="muted">{{ $t("keine Sicherung") }}</td></tr>
    </tbody></table>

    <div class="row mit" style="gap:12px;align-items:center;margin-top:6px">
      <label :title="$t('Assets aus der Datenbank; S3 und Verzeichnisse sichert der Betrieb')"><input v-model="mit.media" type="checkbox" />{{ ' ' + $t("▨ Assets") }}</label>
      <label :title="$t('Anmeldungen, Token, Speicher- und Mail-Einstellungen')"><input v-model="mit.config" type="checkbox" />{{ ' ' + $t("⚿ Zugänge") }}</label>
      <label :title="$t('Plugin-Verzeichnisse ohne node_modules')"><input v-model="mit.plugins" type="checkbox" />{{ ' ' + $t("⌁ Plugins") }}</label>
    </div>

    <div class="row" style="gap:8px;align-items:center;margin-top:8px">
      <button class="primary sichern" :disabled="!!busy || !dir.trim()" :title="$t('Vollsicherung in dieses Verzeichnis schreiben')" @click="sichern">{{ $t("⇩ Sichern") }}</button>
      <button :disabled="!!busy || !stand?.dort || (stand.hier?.entries ?? 0) > 0"
        :title="!stand?.dort ? $t('keine Sicherung im Verzeichnis') : stand.hier.entries > 0 ? $t('hier stehen {0} Einträge', [n(stand.hier.entries)]) : $t('Sicherung einspielen')"
        @click="zurueck">{{ $t("↺ Einspielen") }}</button>
      <span v-if="(stand?.hier?.entries ?? 0) > 0" class="muted" style="font-size:12px">{{ $t("dieses System ist nicht leer") }}</span>
      <span v-else-if="stand && !stand.dort" class="muted" style="font-size:12px">{{ $t("keine Sicherung im Verzeichnis") }}</span>
    </div>
    <div v-if="said" :class="said.startsWith('✗') ? 'fehler' : 'pos'" style="font-size:12px;margin-top:6px">{{ said }}</div>
  </div>

  <div class="section">
    <h2>{{ $t("↺ Teilbaum einspielen") + ' ' }}<span class="muted">{{ $t("· einzelne Datei, Rohdaten-JSON") }}</span></h2>

    <div class="row" style="gap:6px;margin-bottom:6px;align-items:center">
      <button :title="$t('Datei auf dem Server wählen')" @click="waehleDatei">📁</button>
      <span v-if="gewaehlt" class="mono" :title="gewaehlt">{{ dateiName() }}</span>
      <span v-else class="muted">{{ $t("keine Datei gewählt") }}</span>
    </div>

    <div v-if="gewaehlt" class="row" style="gap:8px;margin-top:8px;align-items:center">
      <button @click="pruefen">{{ $t("Prüfen") }}</button>
      <button v-if="probe" class="primary" @click="einspielen">{{ $t("↺ Einspielen") }}</button>
      <span v-if="probe" class="muted" style="font-size:12px">{{ $t("{0} neu · {1} angeglichen · {2} zurückgeholt", [probe.created, probe.updated, probe.restored]) }}<template v-if="probe.model">{{ ' ' + $t("· {0} Modellteile", [probe.model]) }}</template></span>
    </div>

    <div v-if="tsaid" :class="tsaid.startsWith('✗') ? 'fehler' : 'pos'" style="font-size:12px;margin-top:6px">{{ tsaid }}</div>
  </div>
</template>
