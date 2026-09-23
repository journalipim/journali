<script setup>
// Einstellungen: ein Reiter je Sache, sichtbar nach Recht (Taloan, 23.09.2026: „im Moment ist alles durcheinander wie es
// gewachsen ist“ · „die Seite Anlage heisst völlig bescheuert und wirft alles Kraut und Rüben durcheinander — im Grunde
// ist das der Tab für den Administrator, den wir jetzt in seine Bestandteile zerlegen“):
// ◐ Ich · 👥 Team · ◈ Rollen & Rechte (mit den Teams) · ▨ Storage · 🖼 Assets · ✉ Mail · ▣ Backup & Recovery · ⚑ Workflows.
// Storage und Assets sind getrennt, weil die Ableitungsgrössen später auch ein Medienmanager pflegen darf, der an den
// Speicher selbst nicht heranmuss (Taloan, 23.09.2026).
// Wer mit seinen Rechten und seinem Team hierher kommt, sieht, was er sehen oder ändern darf — alles andere nicht.
import { ref } from 'vue'
import { store } from '../store.js'
import MatrixPicker from '../components/MatrixPicker.vue'
import { ai } from '../ai.js'
import StorageSettings from '../components/StorageSettings.vue'
import RestoreSettings from '../components/RestoreSettings.vue'
import MailSettings from '../components/MailSettings.vue'
import TeamsSettings from '../components/TeamsSettings.vue'
import UsersSettings from '../components/UsersSettings.vue'
import AccountSettings from '../components/AccountSettings.vue'
import TeamsAdmin from '../components/TeamsAdmin.vue'
import WorkflowSettings from '../components/WorkflowSettings.vue'
import { api } from '../api.js'
// Sprungmarken von aussen (#storage, #users, #mail, #backup, #teams) treffen weiter ihren Reiter
const tab = ref({ '#storage': 'storage', '#users': 'users', '#mail': 'mail', '#backup': 'backup', '#teams': 'team' }[location.hash] ?? 'ich')
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
  if (!store.auth.enabled) store.actor = actor.value.trim()   // mit Anmeldung gehört der Urheber der Sitzung
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
      <span class="tab" :class="{ on: tab === 'ich' }" @click="tab = 'ich'" title="gilt nur für mich">◐ Ich</span>
      <span v-if="store.auth.enabled" class="tab" :class="{ on: tab === 'team' }" @click="tab = 'team'" title="die Gruppe, in der ich arbeite">👥 Team</span>
      <span v-if="store.can('users')" class="tab" :class="{ on: tab === 'users' }" @click="tab = 'users'" title="wer im System arbeitet, mit welcher Rolle und in welchem Team">◈ Rollen &amp; Rechte</span>
      <span v-if="store.can('storage')" class="tab" :class="{ on: tab === 'storage' }" @click="tab = 'storage'" title="wo die Bytes liegen">▨ Storage</span>
      <span v-if="store.can('model') || store.can('storage')" class="tab" :class="{ on: tab === 'assets' }" @click="tab = 'assets'" title="Vorschau-Ableitungen und ihr Bestand">🖼 Assets</span>
      <span v-if="store.can('users')" class="tab" :class="{ on: tab === 'mail' }" @click="tab = 'mail'" title="ausgehender Mailserver">✉ Mail</span>
      <span v-if="store.can('users')" class="tab" :class="{ on: tab === 'backup' }" @click="tab = 'backup'" title="Sichern und Wiederherstellen">▣ Backup &amp; Recovery</span>
      <span v-if="store.can('model')" class="tab" :class="{ on: tab === 'workflows' }" @click="tab = 'workflows'" title="Zustände und Übergänge über den Daten">⚑ Workflows</span>
    </div>
    <div class="scroll" v-if="tab === 'team'"><TeamsSettings /></div>
    <div class="scroll" v-else-if="tab === 'workflows'"><WorkflowSettings /></div>
    <div class="scroll" v-else-if="tab === 'storage'"><StorageSettings teil="speicher" /></div>
    <div class="scroll" v-else-if="tab === 'assets'"><StorageSettings teil="assets" /></div>
    <div class="scroll" v-else-if="tab === 'mail'"><MailSettings /></div>
    <div class="scroll" v-else-if="tab === 'backup'"><RestoreSettings /></div>
    <div class="scroll" v-else-if="tab === 'users'"><UsersSettings /><TeamsAdmin /></div>
    <div class="scroll" v-else>
      <table class="grid form">
        <tbody>
          <!-- Der Name steht nur ohne Anmeldung hier (Taloan, 23.09.2026: „kann jetzt weg, wir haben ein Benutzersystem“) —
               mit Benutzern kommt der Urheber aus der Sitzung und das Feld hätte nichts zu sagen. -->
          <tr v-if="!store.auth.enabled">
            <td class="muted">👤 Name</td>
            <td><input v-model="actor" type="text" style="width:240px" placeholder="steht als Urheber in jedem Eintrag" @keydown.enter="save" /></td>
            <td class="muted">Urheber jedes Eintrags, den du schreibst — bis es eine Anmeldung gibt.</td>
          </tr>
          <tr>
            <td class="muted" title="gilt nur auf diesem Rechner">🖧 Server</td>
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
            <td class="muted" title="Welche Zellen der Matrix Sprache × Kanal als Spalten stehen. Im Knoten jederzeit umschaltbar.">Spalten der Matrix Sprache × Kanal</td>
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

      <AccountSettings v-if="store.auth.enabled" />

      <div class="section">
        <h2>✦ KI <span class="muted">· <span v-if="ai.server?.ready">über Team „{{ ai.server.label }}“</span><span v-else>eigene Schlüssel — journali bietet keine KI an</span></span></h2>
        <!-- Teams (Taloan, 23.09.2026): liegt am Team ein Schlüssel, fragt der Server und zählt mit; ein eigener Schlüssel hier geht vor und zahlt selbst -->
        <p v-if="ai.server?.team" class="muted" style="font-size:12px;margin:0 0 6px"
           title="Mit Teamschlüssel fragt der Server und zählt mit; ein eigener Schlüssel unten fragt direkt.">
          <span v-if="ai.server.ready">👥 {{ ai.server.label }} · {{ ai.server.providers.join(', ') }}<span v-if="ai.server.payer !== ai.server.team"> ↑ {{ ai.server.payerLabel }}</span>
            · ✦ {{ (ai.server.used?.month ?? 0).toLocaleString('de-DE') }}<span v-if="ai.server.limits?.included"> / {{ ai.server.limits.included.toLocaleString('de-DE') }}</span></span>
          <span v-else class="warn">👥 {{ ai.server.label ?? ai.server.team }} · kein Schlüssel</span>
        </p>
        <p class="muted" style="font-size:12px;margin:0 0 6px" title="Werte des Knotens gehen an den Anbieter — über den Server mit Teamschlüssel, sonst direkt aus dem Browser.">Schlüssel des Teams oder eigener · nichts ohne Klick · ohne Schlüssel regelbasiert</p>
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
.tab { padding: 2px 10px; border-radius: 4px; color: var(--muted); cursor: pointer; font-size: 13px; }
.tab.on { background: var(--accent-soft); color: var(--text); }
</style>
