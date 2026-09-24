<script setup>
// Einstellungen: ein Reiter je Sache, sichtbar nach Recht (Taloan, 23.09.2026: „im Moment ist alles durcheinander wie es
// gewachsen ist“ · „die Seite Anlage heisst völlig bescheuert und wirft alles Kraut und Rüben durcheinander — im Grunde
// ist das der Tab für den Administrator, den wir jetzt in seine Bestandteile zerlegen“):
// ◐ Ich · ◍ Team (mit der Lizenz) · ◈ IAM (Konten, Rollen, Rechte, Teams) · ⚑ Workflows · ▨ Storage · ▩ Assets · ✉ Mail · ⇅ B&R (Sichern und Wiederherstellen, Taloan 24.09.2026).
// Storage und Assets sind getrennt, weil die Ableitungsgrössen später auch ein Medienmanager pflegen darf, der an den
// Speicher selbst nicht heranmuss (Taloan, 23.09.2026).
// Wer mit seinen Rechten und seinem Team hierher kommt, sieht, was er sehen oder ändern darf — alles andere nicht.
import { ref, onMounted, onUnmounted } from 'vue'
import { store } from '../store.js'
import MatrixPicker from '../components/MatrixPicker.vue'
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
const MARKEN = { '#storage': 'storage', '#users': 'users', '#mail': 'mail', '#backup': 'backup', '#teams': 'team', '#workflows': 'workflows', '#assets': 'assets' }
const tab = ref(MARKEN[location.hash] ?? 'ich')
// Wer aus der Leiste hierher springt, landet auf dem gemeinten Reiter — auch wenn die Seite schon offen ist
const folgeMarke = () => { const t = MARKEN[location.hash]; if (t) tab.value = t }
onMounted(() => window.addEventListener('hashchange', folgeMarke))
onUnmounted(() => window.removeEventListener('hashchange', folgeMarke))
const actor = ref(store.actor)
const theme = ref(store.theme)
function setTheme(t) { theme.value = t; store.theme = t; store.save() }
const checking = ref(false)

async function save() {
  if (!store.auth.enabled) store.actor = actor.value.trim()   // mit Anmeldung gehört der Urheber der Sitzung
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
      <span v-if="store.auth.enabled" class="tab" :class="{ on: tab === 'team' }" @click="tab = 'team'" title="die Gruppe, in der ich arbeite">◍ Team</span>
      <span v-if="store.can('users')" class="tab" :class="{ on: tab === 'users' }" @click="tab = 'users'" title="Anwenderkonten, Rollen, Rechte und Teams">◈ IAM</span>
      <span v-if="store.can('model')" class="tab" :class="{ on: tab === 'workflows' }" @click="tab = 'workflows'" title="Zustände und Übergänge über den Daten">⚑ Workflows</span>
      <span v-if="store.can('storage')" class="tab" :class="{ on: tab === 'storage' }" @click="tab = 'storage'" title="wo die Bytes liegen">▨ Storage</span>
      <span v-if="store.can('model') || store.can('storage')" class="tab" :class="{ on: tab === 'assets' }" @click="tab = 'assets'" title="Vorschau-Ableitungen und ihr Bestand">▩ Assets</span>
      <span v-if="store.can('users')" class="tab" :class="{ on: tab === 'mail' }" @click="tab = 'mail'" title="ausgehender Mailserver">✉ Mail</span>
      <span v-if="store.can('users')" class="tab" :class="{ on: tab === 'backup' }" @click="tab = 'backup'" title="Sichern und wiederherstellen">⇅ B&amp;R</span>
    </div>
    <div class="scroll" v-if="tab === 'team'"><TeamsSettings /></div>
    <div class="scroll" v-else-if="tab === 'workflows'"><WorkflowSettings /></div>
    <div class="scroll" v-else-if="tab === 'storage'"><StorageSettings teil="speicher" /></div>
    <div class="scroll" v-else-if="tab === 'assets'"><StorageSettings teil="assets" /></div>
    <div class="scroll" v-else-if="tab === 'mail'"><MailSettings /></div>
    <div class="scroll" v-else-if="tab === 'backup'"><RestoreSettings /></div>
    <div class="scroll" v-else-if="tab === 'users'"><UsersSettings /><TeamsAdmin /></div>

    <div class="scroll" v-else>
      <div class="section">
      <h2 title="Gilt auf diesem Rechner; Darstellung und Sicht folgen der Anmeldung an jeden Rechner.">◐ Dieser Rechner</h2>
      <table class="grid form">
        <tbody>
          <!-- Der Name steht nur ohne Anmeldung hier (Taloan, 23.09.2026: „kann jetzt weg, wir haben ein Benutzersystem“) —
               mit Benutzern kommt der Urheber aus der Sitzung und das Feld hätte nichts zu sagen. -->
          <tr v-if="!store.auth.enabled">
            <td class="muted">👤 Name</td>
            <td><input v-model="actor" type="text" style="width:240px" placeholder="steht als Urheber in jedem Eintrag" @keydown.enter="save" /></td>
            <td class="muted" title="Bis es eine Anmeldung gibt, steht dieser Name als Urheber in jedem Eintrag.">Urheber jedes Eintrags</td>
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
      </div>

      <AccountSettings v-if="store.auth.enabled" />

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
