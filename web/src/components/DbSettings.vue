<script setup>
// Einstellungen → B&R → Datenbank: womit dieser Server verbunden ist. Das Passwort braucht, wer die Datenbank selbst
// sichert (pg_dump); im Paket erzeugt es der erste Start. Angezeigt wird es erst nach dem eigenen Passwort, und nach
// einer Minute ist es wieder verdeckt.
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '../api.js'
import { t } from '../i18n.js'

const d = ref(null)
const eigenes = ref('')
const frage = ref(false)       // Feld für das eigene Passwort offen
const klar = ref('')           // das angezeigte Datenbankpasswort
const said = ref('')
const busy = ref(false)
let verdecken = null

const QUELLE = { datei: t('Einrichtungsdialog'), umgebung: t('Umgebung des Servers') }

onMounted(async () => { try { d.value = await api.get('/api/backup/db') } catch (e) { said.value = '✗ ' + e.message } })
onUnmounted(() => clearTimeout(verdecken))

async function zeigen() {
  busy.value = true; said.value = ''
  try {
    const r = await api.post('/api/backup/db/password', { password: eigenes.value })
    klar.value = r.password ?? ''
    frage.value = false; eigenes.value = ''
    clearTimeout(verdecken); verdecken = setTimeout(() => { klar.value = '' }, 60000)
  } catch (e) { said.value = '✗ ' + e.message }
  finally { busy.value = false }
}
async function kopieren() { try { await navigator.clipboard.writeText(klar.value); said.value = t('✓ kopiert') } catch {} }
</script>

<template>
  <div class="section" v-if="d">
    <h2 :title="$t('Die Verbindung dieses Servers. Das Passwort braucht, wer die Datenbank selbst sichert.')">{{ $t("⛁ Datenbank") + ' ' }}<span class="muted mono">· {{ d.host }}:{{ d.port }}/{{ d.database }}</span></h2>
    <table class="form">
      <tr><td class="attr">{{ $t("Host") }}</td><td class="mono">{{ d.host }}</td></tr>
      <tr><td class="attr">{{ $t("Port") }}</td><td class="mono">{{ d.port }}</td></tr>
      <tr><td class="attr">{{ $t("Datenbank") }}</td><td class="mono">{{ d.database }}</td></tr>
      <tr><td class="attr">{{ $t("Anmeldename") }}</td><td class="mono">{{ d.user }}</td></tr>
      <tr><td class="attr">{{ $t("Quelle") }}</td><td>{{ QUELLE[d.quelle] ?? d.quelle }}</td></tr>
      <tr><td class="attr">{{ $t("Passwort") }}</td>
        <td>
          <template v-if="klar"><span class="mono klar">{{ klar }}</span> <button class="x" @click="kopieren" :title="$t('in die Zwischenablage')">⧉</button> <button class="x" @click="klar = ''" :title="$t('wieder verdecken')">◌</button></template>
          <template v-else-if="frage">
            <form class="row" @submit.prevent="zeigen">
              <input v-model="eigenes" type="password" autocomplete="current-password" autofocus :placeholder="$t('eigenes Passwort')" />
              <button class="primary" type="submit" :disabled="busy || !eigenes">{{ $t("Anzeigen") }}</button>
            </form>
          </template>
          <template v-else-if="d.password"><span class="muted">••••••••</span> <button @click="frage = true" :title="$t('verlangt das eigene Passwort; nach einer Minute wieder verdeckt')">{{ $t("◉ anzeigen") }}</button></template>
          <span v-else class="muted">—</span>
        </td></tr>
    </table>
    <div v-if="said" class="muted" style="font-size:12px;margin-top:4px">{{ said }}</div>
  </div>
</template>

<style scoped>
.form td.attr { white-space: nowrap; color: var(--muted); padding-right: 12px; }
.row { display: flex; gap: 6px; }
.klar { user-select: all; }
.x { border: 0; background: none; color: var(--muted); padding: 0 3px; }
.x:hover { color: var(--fg); }
</style>
