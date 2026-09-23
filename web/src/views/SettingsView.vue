<script setup>
// Einstellungen: wer schreibt (X-Actor), welcher Server, und was er sagt.
import { ref, onMounted } from 'vue'
import { store } from '../store.js'
import MatrixPicker from '../components/MatrixPicker.vue'
import { ai } from '../ai.js'
import StorageSettings from '../components/StorageSettings.vue'
import RestoreSettings from '../components/RestoreSettings.vue'
import MailSettings from '../components/MailSettings.vue'
import UsersSettings from '../components/UsersSettings.vue'
import WorkflowSettings from '../components/WorkflowSettings.vue'
import UsageBars from '../components/UsageBars.vue'
import { api } from '../api.js'
// Reiter (Taloan, 19.09.): Allgemein | Storage
const tab = ref(location.hash === '#storage' ? 'storage' : location.hash === '#users' ? 'users' : 'general')
// Nutzung (Taloan, 22.09.): drei Balken und der Verlauf — gezählt wird, was ins Journal geht
const usage = ref(null), usageHist = ref([]), usagePeriod = ref('day'), usageBusy = ref(false)
async function loadUsage(period = usagePeriod.value) {
  usagePeriod.value = period; usageBusy.value = true
  try { const u = await api.get(`/api/usage?history=${period}&limit=${period === 'day' ? 30 : period === 'week' ? 26 : 24}`); usage.value = u; usageHist.value = u.history ?? [] }
  catch (e) { store.toast(e.message) }
  finally { usageBusy.value = false }
}
onMounted(() => { loadUsage() })
// KI-Schlüssel (Taloan, 18.09.): bleiben im Browser (localStorage), nie im Journal — Plugins fragen die KI nur, wenn ein Schlüssel da ist.
// Je Anbieter ein Schlüssel und ein Modell (Taloan, 20.09.: kein Anbieter fest im Code); die Plugins fragen den gewählten.
const aiAcc = ref(Object.fromEntries(ai.providers.map(p => [p.key, { ...ai.accounts[p.key] }]))), aiProvider = ref(ai.provider), aiState = ref({})
async function saveAi(pk) {
  ai.accounts[pk] = { key: aiAcc.value[pk].key.trim(), model: aiAcc.value[pk].model }; ai.provider = aiProvider.value; ai.save()
  if (!ai.accounts[pk].key) { aiState.value = { ...aiState.value, [pk]: 'kein Schlüssel' }; return }
  aiState.value = { ...aiState.value, [pk]: 'prüfe …' }
  try { aiState.value = { ...aiState.value, [pk]: (await ai.test(pk)) ? `✓ ${ai.accounts[pk].model} antwortet` : '✗ unerwartete Antwort' } } catch (e) { aiState.value = { ...aiState.value, [pk]: '✗ ' + e.message } }
}
function setAiProvider() { ai.provider = aiProvider.value; ai.save() }

const actor = ref(store.actor)
const server = ref(store.server)
const theme = ref(store.theme)
function setTheme(t) { theme.value = t; store.theme = t; store.save() }
const checking = ref(false)

async function save() {
  store.actor = actor.value.trim()
  store.server = server.value.trim().replace(/\/+$/, '')
  store.save()
  checking.value = true
  await store.poll()
  checking.value = false
  store.toast(store.online ? `Verbunden · #${store.head}` : `Nicht erreichbar: ${store.error}`, store.online ? 'ok' : 'error')
}
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>⚙ Einstellungen</h1>
      <span class="tab" :class="{ on: tab === 'general' }" @click="tab = 'general'">Allgemein</span>
      <span v-if="store.can('storage')" class="tab" :class="{ on: tab === 'storage' }" @click="tab = 'storage'">▨ Storage</span>
      <span v-if="store.auth.enabled" class="tab" :class="{ on: tab === 'users' }" @click="tab = 'users'">👤 {{ store.can('users') ? 'Benutzer & Rollen' : 'Konto' }}</span>
      <span v-if="store.can('model')" class="tab" :class="{ on: tab === 'workflows' }" @click="tab = 'workflows'">⚑ Workflows</span>
      <span v-if="store.can('users')" class="tab" :class="{ on: tab === 'backup' }" @click="tab = 'backup'">▣ Sicherung</span>
      <span v-if="store.can('users')" class="tab" :class="{ on: tab === 'mail' }" @click="tab = 'mail'">✉ Mail</span>
    </div>
    <div class="scroll" v-if="tab === 'storage'"><StorageSettings /></div>
    <div class="scroll" v-else-if="tab === 'backup'"><RestoreSettings /></div>
    <div class="scroll" v-else-if="tab === 'mail'"><MailSettings /></div>
    <div class="scroll" v-else-if="tab === 'users'"><UsersSettings /></div>
    <div class="scroll" v-else-if="tab === 'workflows'"><WorkflowSettings /></div>
    <div class="scroll" v-else>
      <table class="grid form">
        <tbody>
          <tr>
            <td class="muted">👤 Name</td>
            <td><input v-model="actor" type="text" style="width:240px" placeholder="steht als Urheber in jedem Eintrag" @keydown.enter="save" /></td>
            <td class="muted">Urheber jedes Eintrags, den du schreibst — bis es eine Anmeldung gibt.</td>
          </tr>
          <tr>
            <td class="muted">🖧 Server</td>
            <td><input v-model="server" type="text" style="width:240px" placeholder="leer = dieser Server" @keydown.enter="save" /></td>
            <td class="muted">z. B. <span class="mono">http://localhost:8080</span>; leer heisst: der Server, der diese Seite liefert.</td>
          </tr>
          <tr>
            <td class="muted">◐ Darstellung</td>
            <td>
              <button v-for="t in [['system', 'System'], ['light', 'Hell'], ['dark', 'Dunkel']]" :key="t[0]" :class="{ primary: theme === t[0] }" @click="setTheme(t[0])" style="margin-right:4px">{{ t[1] }}</button>
            </td>
            <td class="muted">System folgt der Windows-Einstellung.</td>
          </tr>
          <tr v-if="store.model">
            <td class="muted">🗣 Sicht</td>
            <td>
              <MatrixPicker :model-value="store.viewCells" @update:model-value="v => { store.viewCells = v; store.save() }" :locales="store.model.locales.map(l => l.code)" :channels="store.model.channels.map(c => c.key)" :master-locale="store.model.masterLocale" :master-channel="store.model.masterChannel" />
            </td>
            <td class="muted">Welche Zellen der Matrix Sprache × Kanal als Spalten stehen — 27 Sprachen × 6 Kanäle passen auf keinen Schirm. Im Knoten jederzeit umschaltbar.</td>
          </tr>
          <tr>
            <td class="muted">Stand</td>
            <td>
              <span v-if="store.online" class="pos">● erreichbar</span>
              <span v-else-if="store.online === false" class="neg">● nicht erreichbar</span>
              <span v-else class="muted">● …</span>
            </td>
            <td class="muted mono">#{{ store.head }} · ▣ {{ store.nodes }}<span v-if="store.error"> · {{ store.error }}</span></td>
          </tr>
          <tr>
            <td></td>
            <td><button class="primary" :disabled="checking" @click="save">Speichern und prüfen</button></td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div class="section">
        <h2>◷ Nutzung <span class="muted">· Einträge im Journal — Ansehen und Exportieren zählen nicht mit</span></h2>
        <UsageBars :usage="usage" :history="usageHist" :period="usagePeriod" :busy="usageBusy" @period="loadUsage" />
      </div>

      <div class="section">
        <h2>✦ KI <span class="muted">· eigene Schlüssel — journali bietet keine KI an</span></h2>
        <p class="muted" style="font-size:12px;margin:0 0 6px">Was die KI sieht: die Daten des jeweils gewählten Knotens (Attribute, Werte) gehen direkt aus diesem Browser an den Anbieter — mit Ihrem Schlüssel, unter Ihrem Vertrag mit dem Anbieter, ohne Umweg über den journali-Server. Nichts geschieht ohne Klick; ohne Schlüssel arbeiten alle Plugins regelbasiert. Recherche im Internet (Anreicherung) kostet je Suche extra.</p>
        <table class="grid" style="width:auto"><colgroup><col style="width:120px" /><col style="width:360px" /><col style="width:220px" /><col /></colgroup>
          <thead><tr><th>Anbieter</th><th>API-Schlüssel</th><th>Modell</th><th></th></tr></thead><tbody>
          <tr v-for="p in ai.providers" :key="p.key">
            <td :class="ai.accounts[p.key].key ? 'pos' : 'muted'" :title="'Anfragen gehen an ' + p.endpoint">{{ ai.accounts[p.key].key ? '●' : '○' }} {{ p.label }}</td>
            <td><input v-model="aiAcc[p.key].key" type="password" style="width:100%" :placeholder="p.placeholder" autocomplete="off" @keydown.enter="saveAi(p.key)" /></td>
            <td><select v-model="aiAcc[p.key].model" style="width:100%" :title="p.hint"><option v-for="m in p.models" :key="m" :value="m">{{ p.modelLabels?.[m] ?? m }}</option></select></td>
            <td class="muted" style="font-size:12px;white-space:nowrap" :title="ai.usedOf(p.key).calls ? `seit ${ai.used.since}: ${ai.usedOf(p.key).calls} Anfragen · ${ai.usedOf(p.key).in.toLocaleString('de-DE')} Token hinein · ${ai.usedOf(p.key).out.toLocaleString('de-DE')} hinaus` : 'noch keine Anfrage über diesen Anbieter'"><span :class="ai.usedOf(p.key).calls ? 'ai' : 'muted'">✦ {{ (ai.usedOf(p.key).in + ai.usedOf(p.key).out).toLocaleString('de-DE') }}</span> Token <button class="x" v-if="ai.usedOf(p.key).calls" @click="ai.resetUsed(p.key)" title="Zähler dieses Anbieters zurücksetzen">↺</button></td>
            <td><button class="primary" @click="saveAi(p.key)">Speichern und prüfen</button> <span class="muted" style="font-size:12px">{{ aiState[p.key] ?? '' }}</span></td>
          </tr>
          <tr><td class="muted">Plugins fragen</td><td colspan="3"><select v-model="aiProvider" @change="setAiProvider" style="width:200px"><option v-for="p in ai.providers" :key="p.key" :value="p.key" :disabled="!ai.accounts[p.key].key">{{ p.label }}{{ ai.accounts[p.key].key ? '' : ' (kein Schlüssel)' }}</option></select> <span class="muted" style="font-size:12px">{{ ai.active().length ? 'eingerichtet: ' + ai.active().map(p => p.label).join(', ') : 'kein Anbieter eingerichtet — Datenqualität, DPP, PPWR, ETIM arbeiten regelbasiert' }} · Schlüssel bleiben in diesem Browser, nicht im Journal, nicht auf dem Server</span></td></tr>
        </tbody></table>
      </div>

      <div class="section" v-if="false && store.model">
        <h2>Modell</h2>
        <table class="grid" style="width:auto">
          <thead><tr><th>Attribut</th><th>sprachabhängig</th><th>kanalabhängig</th></tr></thead>
          <tbody>
            <tr v-for="a in store.model.attributes" :key="a.name">
              <td class="mono">{{ a.name }}</td>
              <td :class="a.perLocale ? 'pos' : 'muted'">{{ a.perLocale ? '✓' : '·' }}</td>
              <td :class="a.perChannel ? 'pos' : 'muted'">{{ a.perChannel ? '✓' : '·' }}</td>
            </tr>
          </tbody>
        </table>
        <p class="muted">Sprachen: <span class="mono">{{ store.model.locales.join(', ') }}</span> · Kanäle: <span class="mono">{{ store.model.channels.join(', ') }}</span></p>
      </div>
    </div>
  </div>
</template>

<style scoped>
table.form td { white-space: normal; vertical-align: middle; height: 34px; }
.section { padding: 10px 8px; border-top: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600; }
.tab { padding: 2px 10px; border-radius: 4px; color: var(--muted); cursor: pointer; font-size: 13px; }
.tab.on { background: var(--accent-soft); color: var(--text); }
</style>
