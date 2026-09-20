<script setup>
// Einstellungen: wer schreibt (X-Actor), welcher Server, und was er sagt.
import { ref } from 'vue'
import { store } from '../store.js'
import { ai } from '../ai.js'
import StorageSettings from '../components/StorageSettings.vue'
import UsersSettings from '../components/UsersSettings.vue'
// Reiter (Taloan, 19.09.): Allgemein | Storage
const tab = ref(location.hash === '#storage' ? 'storage' : location.hash === '#users' ? 'users' : 'general')
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
function toggleLocale(l) {
  const s = new Set(store.viewLocales); s.has(l) ? s.delete(l) : s.add(l)
  store.viewLocales = (store.model?.locales ?? []).map(x => x.code).filter(c => s.has(c)); store.save()
}
function setChannel(c) { store.viewChannel = c || null; store.save() }
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
      <span class="tab" :class="{ on: tab === 'storage' }" @click="tab = 'storage'">▨ Storage</span>
      <span v-if="store.auth.enabled" class="tab" :class="{ on: tab === 'users' }" @click="tab = 'users'">👤 {{ store.auth.role === 'admin' ? 'Benutzer' : 'Konto' }}</span>
    </div>
    <div class="scroll" v-if="tab === 'storage'"><StorageSettings /></div>
    <div class="scroll" v-else-if="tab === 'users'"><UsersSettings /></div>
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
              <span v-for="l in store.model.locales" :key="l.code" class="view-chip" :class="{ on: store.viewLocales.includes(l.code) }" @click="toggleLocale(l.code)" style="margin-right:4px">{{ l.code }}</span>
              <select :value="store.viewChannel ?? ''" @change="setChannel($event.target.value)" style="margin-left:8px">
                <option value="">nur *</option><option v-for="c in store.model.channels" :key="c.key" :value="c.key">{{ c.key }}</option>
              </select>
            </td>
            <td class="muted">Welche Sprachen und welcher Kanal als Spalten stehen — 27 Sprachen × 6 Kanäle passen auf keinen Schirm. Im Knoten jederzeit umschaltbar.</td>
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
        <h2>✦ KI <span class="muted">· eigene Schlüssel — journali bietet keine KI an</span></h2>
        <p class="muted" style="font-size:12px;margin:0 0 6px">Was die KI sieht: die Daten des jeweils gewählten Knotens (Attribute, Werte) gehen direkt aus diesem Browser an den Anbieter — mit Ihrem Schlüssel, unter Ihrem Vertrag mit dem Anbieter, ohne Umweg über den journali-Server. Nichts geschieht ohne Klick; ohne Schlüssel arbeiten alle Plugins regelbasiert. Recherche im Internet (Anreicherung) kostet je Suche extra.</p>
        <table class="grid" style="width:auto"><colgroup><col style="width:120px" /><col style="width:360px" /><col style="width:220px" /><col /></colgroup>
          <thead><tr><th>Anbieter</th><th>API-Schlüssel</th><th>Modell</th><th></th></tr></thead><tbody>
          <tr v-for="p in ai.providers" :key="p.key">
            <td :class="ai.accounts[p.key].key ? 'pos' : 'muted'" :title="'Anfragen gehen an ' + p.endpoint">{{ ai.accounts[p.key].key ? '●' : '○' }} {{ p.label }}</td>
            <td><input v-model="aiAcc[p.key].key" type="password" style="width:100%" :placeholder="p.placeholder" autocomplete="off" @keydown.enter="saveAi(p.key)" /></td>
            <td><select v-model="aiAcc[p.key].model" style="width:100%" :title="p.hint"><option v-for="m in p.models" :key="m" :value="m">{{ m }}</option></select></td>
            <td><button class="primary" @click="saveAi(p.key)">Speichern und prüfen</button> <span class="muted" style="font-size:12px">{{ aiState[p.key] ?? '' }}</span></td>
          </tr>
          <tr><td class="muted">Plugins fragen</td><td colspan="3"><select v-model="aiProvider" @change="setAiProvider" style="width:200px"><option v-for="p in ai.providers" :key="p.key" :value="p.key" :disabled="!ai.accounts[p.key].key">{{ p.label }}{{ ai.accounts[p.key].key ? '' : ' (kein Schlüssel)' }}</option></select> <span class="muted" style="font-size:12px">{{ ai.active().length ? 'eingerichtet: ' + ai.active().map(p => p.label).join(', ') : 'kein Anbieter eingerichtet — Datenqualität, DPP, PPWR, ETIM arbeiten regelbasiert' }} · Schlüssel bleiben in diesem Browser, nicht im Journal, nicht auf dem Server</span></td></tr>
        </tbody></table>
      </div>

      <div class="section" v-if="false && store.model">
        <h2>Modell</h2>
        <table class="grid" style="width:auto">
          <thead><tr><th>Attribut</th><th>je Sprache</th><th>je Kanal</th></tr></thead>
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
