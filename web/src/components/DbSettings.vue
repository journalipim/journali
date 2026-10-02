<script setup>
// Einstellungen → B&R → Datenbank: womit dieser Server verbunden ist. Das Passwort braucht, wer die Datenbank selbst
// sichert (pg_dump); im Paket erzeugt es der erste Start. Angezeigt wird es erst nach dem eigenen Passwort, und nach
// einer Minute ist es wieder verdeckt.
import { ref, onMounted, onUnmounted } from 'vue'
import { api } from '../api.js'
import { dialog } from '../dialog.js'
import { store } from '../store.js'
import { t } from '../i18n.js'

const d = ref(null)
const klar = ref('')           // das angezeigte Datenbankpasswort
const said = ref('')
const busy = ref(false)
const modus = ref('Prefer')    // die Wahl in der Zeile Verschlüsselung
let verdecken = null

const QUELLE = { datei: t('Einrichtungsdialog'), umgebung: t('Umgebung des Servers') }

const MODI = [['Prefer', t('wenn möglich (Prefer)')], ['Require', t('immer (Require)')], ['VerifyCA', t('immer, Aussteller geprüft (VerifyCA)')], ['VerifyFull', t('immer, Aussteller und Name geprüft (VerifyFull)')], ['Disable', t('nie (Disable)')]]
async function laden() {
  try { d.value = await api.get('/api/backup/db'); modus.value = d.value.ssl?.vorgemerkt ?? d.value.ssl?.modus ?? 'Prefer' } catch (e) { said.value = '✗ ' + e.message }
}
onMounted(laden)
/// Was nach dem nächsten Start gilt: das Vorgemerkte, sonst der laufende Modus
const gilt = () => d.value?.ssl?.vorgemerkt ?? d.value?.ssl?.modus
async function sslUebernehmen() {
  busy.value = true; said.value = ''
  try {
    const r = await api.post('/api/backup/db/ssl', { modus: modus.value }, 'PUT')
    said.value = t('✓ {0} gespeichert — gilt nach dem nächsten Start des Servers.', [r.modus])
    await laden()
  } catch (e) { said.value = '✗ ' + e.message }
  finally { busy.value = false }
}
onUnmounted(() => clearTimeout(verdecken))

// Die Rückfrage steht in einem eigenen Fenster, nicht in der Zeile des Datenbankpassworts: dort sähe sie aus,
// als würde man dieses überschreiben. Gefragt ist das Anmeldepasswort der Person, die gerade angemeldet ist.
async function zeigen() {
  const eigenes = await dialog.prompt({
    title: t('Datenbankpasswort anzeigen'),
    text: t('Die Anzeige verlangt das Anmeldepasswort von {0}.', [store.auth.user ?? '']),
    placeholder: t('Anmeldepasswort'), secret: true, ok: t('Anzeigen'),
  })
  if (!eigenes) return
  busy.value = true; said.value = ''
  try {
    const r = await api.post('/api/backup/db/password', { password: eigenes })
    klar.value = r.password ?? ''
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
      <!-- Was die Verbindung wirklich ist (Postgres sagt es: pg_stat_ssl), daneben, was eingestellt ist -->
      <tr class="ssl"><td class="attr" :title="$t('Die Verbindung zwischen diesem Server und der Datenbank. Ob sie verschlüsselt wird, entscheidet der Betreiber der Datenbank.')">{{ $t("Verschlüsselung") }}</td>
        <td>
          <span v-if="d.ssl?.verschluesselt === true" class="pos">✓ {{ $t("verschlüsselt") }}</span>
          <span v-else-if="d.ssl?.verschluesselt === false" class="neg" :title="$t('Postgres bietet keine Verschlüsselung an (ssl = off) oder die Verbindung ist älter als diese Einstellung.')">✗ {{ $t("im Klartext") }}</span>
          <span v-else class="muted" :title="$t('Postgres hat die Frage nicht beantwortet.')">—</span>
          <span v-if="d.ssl?.version" class="muted mono"> {{ d.ssl.version }}</span>
          <span v-if="d.ssl?.modus" class="muted mono" :title="$t('Eingestellt in der Verbindung (SSL Mode)')"> · {{ d.ssl.modus }}</span>
          <span v-if="d.ssl?.vorgemerkt" class="warn mono" :title="$t('Gespeichert in db.json; gilt nach dem nächsten Start des Servers.')"> → {{ d.ssl.vorgemerkt }}</span>
        </td></tr>
      <tr class="sslwahl"><td class="attr"></td>
        <td>
          <select v-model="modus" :disabled="busy || !d.ssl?.aenderbar" :title="d.ssl?.aenderbar ? $t('Wie die Verbindung verschlüsselt wird; gilt nach dem nächsten Start des Servers.') : $t('Die Verbindung kommt aus der Umgebung des Servers (JOURNALI_DB): dort steht SSL Mode.')">
            <option v-for="[k, l] in MODI" :key="k" :value="k">{{ l }}</option>
          </select>
          <button v-if="d.ssl?.aenderbar && modus !== gilt()" :disabled="busy" @click="sslUebernehmen" :title="$t('Probiert die Verbindung mit diesem Modus; nur wenn sie klappt, wird er gespeichert')">{{ $t("Übernehmen") }}</button>
        </td></tr>
      <tr><td class="attr">{{ $t("Passwort") }}</td>
        <td>
          <template v-if="klar"><span class="mono klar">{{ klar }}</span> <button class="x" @click="kopieren" :title="$t('in die Zwischenablage')">⧉</button> <button class="x" @click="klar = ''" :title="$t('wieder verdecken')">◌</button></template>
          <template v-else-if="d.password"><span class="muted">••••••••</span> <button :disabled="busy" @click="zeigen" :title="$t('fragt nach dem eigenen Anmeldepasswort; nach einer Minute wieder verdeckt')">{{ $t("◉ anzeigen") }}</button></template>
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
