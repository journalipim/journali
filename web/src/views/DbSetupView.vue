<script setup>
// Datenbank einrichten: erscheint, solange der Server keine Verbindung hat — keine eingerichtet, nicht erreichbar,
// Anmeldung abgewiesen. Jede Eingabe geht sofort; bei „nicht erreichbar“ versucht der Server es von selbst weiter, bis
// hier jemand prüft oder speichert. Den Einrichtungscode zeigt der Server in seiner Konsole und in einrichtungscode.txt.
// Nach dem Speichern startet der Server mit dieser Datenbank; die Seite wartet und geht dann zur Anmeldung.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api.js'
import { store } from '../store.js'
import { t } from '../i18n.js'

const router = useRouter()
const stand = ref(null)
const form = ref({ host: '', port: 5432, database: 'journali', user: 'postgres', password: '', code: '', ssl: 'Prefer' })
const busy = ref('')
const msg = ref(null)          // { ok, text, title }
const startet = ref(false)     // gespeichert: der Server lädt jetzt die Datenbank
let timer = null
let befuellt = false

// Gründe vom Server → was hier steht
const GRUND = {
  none: t('Keine Datenbank eingerichtet'),
  host: t('Host unbekannt'),
  port: t('Port abgewiesen'),
  timeout: t('Zeitüberschreitung'),
  auth: t('Anmeldung an der Datenbank abgewiesen'),
  rights: t('Keine Berechtigung, die Datenbank anzulegen'),
  error: t('Fehler der Datenbank'),
}
const grund = g => GRUND[g] ?? g ?? ''
/// Was eine Antwort sagt — belegt nennt den Server, der schon läuft (04.10.2026: mehrere Server nur mit Lizenz)
const text = r => r.grund === 'belegt' ? t('Auf dieser Datenbank läuft schon {0}; für einen weiteren Server fehlt die Lizenz.', [r.detail]) : grund(r.grund)
const lage = computed(() => {
  const s = stand.value
  if (!s) return ''
  if (s.lage === 'unerreichbar') return t('Nicht erreichbar · {0} · Versuch {1}', [grund(s.grund), s.versuch])
  return grund(s.grund)
})
const quelle = computed(() => stand.value?.quelle === 'datei' ? t('Gespeichert im Datenverzeichnis') : stand.value?.quelle === 'umgebung' ? t('Aus der Umgebung des Servers') : '')

async function laden() {
  try {
    const st = await api.get('/api/auth/state')
    if (!st.dbSetup) {   // der eigentliche Server läuft
      clearInterval(timer)
      store.auth = { known: true, ...st }
      router.replace('/login')
      return
    }
    stand.value = await api.get('/api/setup/state')
    if (!befuellt && stand.value.ziel) {
      const z = stand.value.ziel
      Object.assign(form.value, { host: z.host, port: z.port, database: z.database, user: z.user, ssl: z.ssl ?? 'Prefer' })
      befuellt = true
    }
  } catch { /* der Server startet gerade neu — weiter warten */ }
}
const body = () => ({ ...form.value, port: Number(form.value.port) })

async function pruefen() {
  busy.value = 'test'; msg.value = null
  try {
    const r = await api.post('/api/setup/db/test', body())
    msg.value = { ok: r.ok, text: r.ok ? t('Verbindung steht') : text(r), title: r.detail }
  } catch (e) { msg.value = { ok: false, text: e.message } }
  finally { busy.value = '' }
  laden()
}
async function speichern() {
  busy.value = 'save'; msg.value = null
  try {
    const r = await api.post('/api/setup/db', body())
    if (r.ok) { startet.value = true; msg.value = { ok: true, text: t('Server startet mit dieser Datenbank') } }
    else msg.value = { ok: false, text: text(r), title: r.detail }
  } catch (e) { msg.value = { ok: false, text: e.message } }
  finally { busy.value = '' }
  laden()
}
async function verwerfen() {
  busy.value = 'reset'; msg.value = null
  try { stand.value = await api.post('/api/setup/db/reset', { code: form.value.code }); befuellt = false; laden() }
  catch (e) { msg.value = { ok: false, text: e.message } }
  finally { busy.value = '' }
}

onMounted(() => { laden(); timer = setInterval(laden, 2000) })
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="pane" style="flex:1;display:grid;place-items:center">
    <form class="box" @submit.prevent="speichern">
      <div class="row" style="gap:10px;align-items:center;margin-bottom:14px"><img src="/logo-128.png" width="36" height="36" alt="" style="border-radius:8px" /><b style="font-size:18px">{{ $t("journali") }}</b></div>
      <h2 :title="$t('Die Verbindung gilt für diesen Server und liegt in seinem Datenverzeichnis (db.json).')">{{ $t("Datenbank") }}</h2>
      <div v-if="stand && !startet" class="lage" :class="stand.lage === 'unerreichbar' ? 'warn' : 'neg'" :title="stand.detail">
        {{ lage }}<span v-if="stand.auto" class="muted" :title="$t('versucht es alle 5 Sekunden neu, bis hier geprüft oder gespeichert wird')"> · ↻</span>
      </div>
      <div v-if="startet" class="lage starten pos">{{ $t("Server lädt das Journal …") }}</div>
      <fieldset :disabled="startet">
        <label>{{ $t("Einrichtungscode") }}<input v-model="form.code" type="text" autocomplete="off" autofocus placeholder="XXXX-XXXX" :title="$t('steht in der Konsole des Servers und in einrichtungscode.txt im Datenverzeichnis')" /></label>
        <div class="row" style="gap:8px">
          <label style="flex:1">{{ $t("Host") }}<input v-model="form.host" type="text" autocomplete="off" /></label>
          <label style="width:90px">{{ $t("Port") }}<input v-model="form.port" type="number" min="1" max="65535" /></label>
        </div>
        <label>{{ $t("Datenbank") }}<input v-model="form.database" type="text" autocomplete="off" /></label>
        <label>{{ $t("Anmeldename") }}<input v-model="form.user" type="text" autocomplete="username" /></label>
        <label>{{ $t("Passwort") }}<input v-model="form.password" type="password" autocomplete="current-password" :placeholder="stand?.ziel?.password ? $t('unverändert') : ''" /></label>
        <label :title="$t('Die Verbindung zwischen diesem Server und der Datenbank. Wie sie verschlüsselt wird, entscheidet der Betreiber der Datenbank.')">{{ $t("Verschlüsselung") }}
          <select v-model="form.ssl" style="display:block;width:100%;margin-top:3px">
            <option value="Prefer">{{ $t("wenn möglich (Prefer)") }}</option>
            <option value="Require">{{ $t("immer (Require)") }}</option>
            <option value="VerifyCA">{{ $t("immer, Aussteller geprüft (VerifyCA)") }}</option>
            <option value="VerifyFull">{{ $t("immer, Aussteller und Name geprüft (VerifyFull)") }}</option>
            <option value="Disable">{{ $t("nie (Disable)") }}</option>
          </select>
        </label>
        <div v-if="msg" class="msg" :class="msg.ok ? 'pos' : 'neg'" :title="msg.title">{{ msg.ok ? '✓' : '✗' }} {{ msg.text }}</div>
        <div class="row" style="gap:8px;margin-top:10px">
          <button type="button" :disabled="!!busy" @click="pruefen" :title="$t('verbindet sich einmal, ohne zu speichern')">{{ $t("Prüfen") }}</button>
          <button class="primary" type="submit" :disabled="!!busy" style="flex:1">{{ $t("Speichern und verbinden") }}</button>
        </div>
      </fieldset>
      <div v-if="quelle" class="muted quelle">
        <span>{{ quelle }}</span>
        <button v-if="stand?.quelle === 'datei'" type="button" class="x" :disabled="!!busy || startet" @click="verwerfen" :title="$t('db.json löschen — dann gilt wieder die Umgebung des Servers')">{{ $t("⟲ verwerfen") }}</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.box { width: 360px; background: var(--pane); border: 1px solid var(--line); border-radius: 10px; padding: 20px; }
.box h2 { font-size: 16px; margin: 0 0 8px; }
fieldset { border: 0; padding: 0; margin: 0; }
label { display: block; font-size: 12px; color: var(--muted); margin-top: 8px; }
label input { display: block; width: 100%; margin-top: 3px; }
.row { display: flex; }
.lage { font-size: 13px; margin: 0 0 6px; }
.starten { font-weight: 700; }
.msg { font-size: 13px; margin-top: 8px; }
.quelle { font-size: 11px; margin-top: 10px; display: flex; gap: 6px; align-items: center; }
.x { border: 0; background: none; color: var(--muted); padding: 0 3px; font-size: 11px; }
.x:hover { color: var(--neg); }
</style>
