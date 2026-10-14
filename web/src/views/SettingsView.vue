<script setup>
// Einstellungen: ein Reiter je Sache, sichtbar nach Recht:
// ◐ Mein Account · ◍ Team (mit der Lizenz) · ◈ IAM (Konten, Rollen, Rechte, Teams) · ⚑ Workflows · ▨ Storage · ▩ Assets · ✉ Mail · ⇅ B&R (Sichern und Wiederherstellen)
// · ⧉ Server (welche Server auf die Datenbank zugreifen, pflegestruktur 41) — nur, wenn mehr als ein Server laufen darf (Unlimited oder Zusatz Multi-Server).
// Storage und Assets sind getrennt, weil die Ableitungsgrössen später auch ein Medienmanager pflegen darf, der an den
// Speicher selbst nicht heranmuss.
// Wer mit seinen Rechten und seinem Team hierher kommt, sieht, was er sehen oder ändern darf — alles andere nicht.
import { ref, onMounted, onUnmounted } from 'vue'
import { store } from '../store.js'
import MatrixPicker from '../components/MatrixPicker.vue'
import StorageSettings from '../components/StorageSettings.vue'
import RestoreSettings from '../components/RestoreSettings.vue'
import DbSettings from '../components/DbSettings.vue'
import ServerSettings from '../components/ServerSettings.vue'
import MailSettings from '../components/MailSettings.vue'
import TeamsSettings from '../components/TeamsSettings.vue'
import UsersSettings from '../components/UsersSettings.vue'
import AccountSettings from '../components/AccountSettings.vue'
import TeamsAdmin from '../components/TeamsAdmin.vue'
import WorkflowSettings from '../components/WorkflowSettings.vue'
import { api } from '../api.js'
import { LANGS, browserLang } from '../i18n.js'
import { t as t_ } from '../i18n.js'
// Sprungmarken von aussen (#storage, #users, #mail, #backup, #teams) treffen weiter ihren Reiter
const MARKEN = { '#storage': 'storage', '#users': 'users', '#mail': 'mail', '#backup': 'backup', '#teams': 'team', '#workflows': 'workflows', '#assets': 'assets', '#server': 'server' }
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
  store.toast(store.online ? t_('Verbunden · #{0}', [store.head]) : t_('Nicht erreichbar: {0}', [store.error]), store.online ? 'ok' : 'error')
}
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>{{ $t("⚙ Einstellungen") }}</h1>
      <span class="tab" :class="{ on: tab === 'ich' }" @click="tab = 'ich'" :title="$t('gilt nur für mich')">{{ $t("◐ Mein Account") }}</span>
      <span v-if="store.auth.enabled" class="tab" :class="{ on: tab === 'team' }" @click="tab = 'team'" :title="$t('die Gruppe, in der ich arbeite')">{{ $t("◍ Team") }}</span>
      <span v-if="store.can('users')" class="tab" :class="{ on: tab === 'users' }" @click="tab = 'users'" :title="$t('Anwenderkonten, Rollen, Rechte und Teams')">{{ $t("◈ IAM") }}</span>
      <span v-if="store.can('model')" class="tab" :class="{ on: tab === 'workflows' }" @click="tab = 'workflows'" :title="$t('Zustände und Übergänge über den Daten')">{{ $t("⚑ Workflows") }}</span>
      <span v-if="store.can('storage')" class="tab" :class="{ on: tab === 'storage' }" @click="tab = 'storage'" :title="$t('wo die Bytes liegen')">{{ $t("▨ Storage") }}</span>
      <span v-if="store.can('model') || store.can('storage')" class="tab" :class="{ on: tab === 'assets' }" @click="tab = 'assets'" :title="$t('Vorschau-Ableitungen und ihr Bestand')">{{ $t("▩ Assets") }}</span>
      <span v-if="store.can('users')" class="tab" :class="{ on: tab === 'mail' }" @click="tab = 'mail'" :title="$t('ausgehender Mailserver')">{{ $t("✉ Mail") }}</span>
      <span v-if="store.can('users')" class="tab" :class="{ on: tab === 'backup' }" @click="tab = 'backup'" :title="$t('Sichern und wiederherstellen')">⇅ B&amp;R</span>
      <span v-if="store.can('users') && (store.erlaubteServer ?? 1) > 1" class="tab" :class="{ on: tab === 'server' }" @click="tab = 'server'" :title="$t('Server, die auf diese Datenbank zugreifen')">{{ $t("⧉ Server") }}</span>
    </div>
    <div class="scroll" v-if="tab === 'team'"><TeamsSettings /></div>
    <div class="scroll" v-else-if="tab === 'workflows'"><WorkflowSettings /></div>
    <div class="scroll" v-else-if="tab === 'storage'"><StorageSettings teil="speicher" /></div>
    <div class="scroll" v-else-if="tab === 'assets'"><StorageSettings teil="assets" /></div>
    <div class="scroll" v-else-if="tab === 'mail'"><MailSettings /></div>
    <div class="scroll" v-else-if="tab === 'backup'"><DbSettings /><RestoreSettings /></div>
    <div class="scroll" v-else-if="tab === 'server'"><ServerSettings /></div>
    <div class="scroll" v-else-if="tab === 'users'"><UsersSettings /><TeamsAdmin /></div>

    <div class="scroll" v-else>
      <!-- Getrennt (26.09.2026): Darstellung, Sprache und Sicht hängen an der Person und folgen der Anmeldung an jeden
           Rechner (UserPrefsSet im Journal). Am Gerät bleibt nur, was das Gerät betrifft — darunter. -->
      <div class="section">
      <h2 :title="$t('Folgt der Anmeldung an jeden Rechner.')">{{ $t("◐ Meine Ansicht") }}</h2>
      <table class="grid form">
        <tbody>
          <tr>
            <td class="muted">{{ $t("◐ Darstellung") }}</td>
            <td>
              <button v-for="t in [['system', $t('System')], ['light', $t('Hell')], ['dark', $t('Dunkel')]]" :key="t[0]" :class="{ primary: theme === t[0] }" @click="setTheme(t[0])" style="margin-right:4px">{{ t[1] }}</button>
            </td>
            <td class="muted">{{ $t("System folgt der Einstellung des Betriebssystems.") }}</td>
          </tr>
          <!-- Oberflächensprache: hängt an der Person, nicht am Rechner; die Sprachen sind die Dateien unter lang/, nicht die des Modells -->
          <tr>
            <td class="muted">{{ $t("🗣 Sprache") }}</td>
            <td>
              <button v-for="l in LANGS" :key="l[0]" :class="{ primary: (store.lang || browserLang()) === l[0] }" @click="store.setLang(l[0])" style="margin-right:4px">{{ l[1] }}</button>
            </td>
            <td class="muted" :title="$t('Sprache der Oberfläche — Menüs, Knöpfe, Meldungen. Die Sprachen der Produktdaten stehen im Modell.')">{{ $t("Oberfläche") }}</td>
          </tr>
          <tr v-if="store.model">
            <td class="muted">{{ $t("🗣 Sicht") }}</td>
            <td>
              <MatrixPicker :model-value="store.viewCells" @update:model-value="v => { store.viewCells = v; store.save() }" :locales="store.model.locales.map(l => l.code)" :channels="store.model.channels.map(c => c.key)" :master-locale="store.model.masterLocale" :master-channel="store.model.masterChannel" />
            </td>
            <td class="muted" :title="$t('Welche Zellen der Matrix Sprache × Kanal als Spalten stehen. Im Knoten jederzeit umschaltbar.')">{{ $t("Spalten der Matrix Sprache × Kanal") }}</td>
          </tr>
        </tbody>
      </table>
      </div>

      <div class="section">
      <h2 :title="$t('Gilt nur auf diesem Rechner, nicht für die Person.')">{{ $t("▭ Dieser Rechner") }}</h2>
      <table class="grid form">
        <tbody>
          <!-- Der Name steht nur ohne Anmeldung hier —
               mit Benutzern kommt der Urheber aus der Sitzung und das Feld hätte nichts zu sagen. -->
          <tr v-if="!store.auth.enabled">
            <td class="muted">{{ $t("👤 Name") }}</td>
            <td><input v-model="actor" type="text" style="width:240px" :placeholder="$t('steht als Urheber in jedem Eintrag')" @keydown.enter="save" /></td>
            <td class="muted" :title="$t('Bis es eine Anmeldung gibt, steht dieser Name als Urheber in jedem Eintrag.')">{{ $t("Urheber jedes Eintrags") }}</td>
          </tr>
          <tr>
            <td class="muted">{{ $t("Stand") }}</td>
            <td>
              <span v-if="store.online" class="pos">{{ $t("● erreichbar") }}</span>
              <span v-else-if="store.online === false" class="neg">{{ $t("● nicht erreichbar") }}</span>
              <span v-else class="muted">● …</span>
            </td>
            <td class="muted mono">#{{ store.head }} · ▣ {{ store.nodes }}<span v-if="store.error"> · {{ store.error }}</span></td>
          </tr>
          <tr>
            <td></td>
            <td><button class="primary" :disabled="checking" @click="save">{{ $t("Speichern und prüfen") }}</button></td>
            <td></td>
          </tr>
        </tbody>
      </table>
      </div>

      <!-- Demo: Passwort und Token gibt es nicht, der Server sperrt sie -->
      <AccountSettings v-if="store.auth.enabled && !store.demo" />

      <div class="section" v-if="false && store.model">
        <h2>{{ $t("Modell") }}</h2>
        <table class="grid" style="width:auto">
          <thead><tr><th>{{ $t("Attribut") }}</th><th>{{ $t("sprachabhängig") }}</th><th>{{ $t("kanalabhängig") }}</th></tr></thead>
          <tbody>
            <tr v-for="a in store.model.attributes" :key="a.name">
              <td class="mono">{{ a.name }}</td>
              <td :class="a.perLocale ? 'pos' : 'muted'">{{ a.perLocale ? '✓' : '·' }}</td>
              <td :class="a.perChannel ? 'pos' : 'muted'">{{ a.perChannel ? '✓' : '·' }}</td>
            </tr>
          </tbody>
        </table>
        <p class="muted">{{ $t("Sprachen:") + ' ' }}<span class="mono">{{ store.model.locales.join(', ') }}</span>{{ ' ' + $t("· Kanäle:") + ' ' }}<span class="mono">{{ store.model.channels.join(', ') }}</span></p>
      </div>
    </div>
  </div>
</template>

<style scoped>
table.form td { white-space: normal; vertical-align: middle; height: 34px; }
.tab { padding: 2px 10px; border-radius: 4px; color: var(--muted); cursor: pointer; font-size: 13px; }
.tab.on { background: var(--accent-soft); color: var(--text); }
</style>
