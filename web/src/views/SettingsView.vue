<script setup>
// Einstellungen: wer schreibt (X-Actor), welcher Server, und was er sagt.
import { ref } from 'vue'
import { store } from '../store.js'
import { ai } from '../ai.js'
import StorageSettings from '../components/StorageSettings.vue'
// Reiter (Taloan, 19.09.): Allgemein | Storage
const tab = ref(location.hash === '#storage' ? 'storage' : 'general')
// KI-Schlüssel (Taloan, 18.09.): bleibt im Browser (localStorage), nie im Journal — Plugins fragen Claude nur, wenn er da ist
const aiKey = ref(ai.key), aiModel = ref(ai.model), aiState = ref('')
async function saveAi() {
  ai.key = aiKey.value.trim(); ai.model = aiModel.value; ai.save()
  if (!ai.key) { aiState.value = 'kein Schlüssel — Plugins arbeiten regelbasiert'; return }
  aiState.value = 'prüfe …'
  try { aiState.value = (await ai.test()) ? `✓ ${ai.model} antwortet` : '✗ unerwartete Antwort' } catch (e) { aiState.value = '✗ ' + e.message }
}

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
    </div>
    <div class="scroll" v-if="tab === 'storage'"><StorageSettings /></div>
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
        <h2>✦ KI (Claude) <span class="muted">· eigener Schlüssel — journali bietet keine KI an</span></h2>
        <p class="muted" style="font-size:12px;margin:0 0 6px">Was die KI sieht: die Daten des jeweils gewählten Knotens (Attribute, Werte) gehen direkt aus diesem Browser an api.anthropic.com — mit Ihrem Schlüssel, unter Ihrem Vertrag mit Anthropic, ohne Umweg über den journali-Server. Nichts geschieht ohne Klick; ohne Schlüssel arbeiten alle Plugins regelbasiert.</p>
        <table class="grid" style="width:auto"><colgroup><col style="width:120px" /><col style="width:420px" /><col /></colgroup><tbody>
          <tr><td class="muted">API-Schlüssel</td><td><input v-model="aiKey" type="password" style="width:100%" placeholder="sk-ant-…" autocomplete="off" @keydown.enter="saveAi" /></td><td class="muted" style="font-size:12px">bleibt in diesem Browser — nicht im Journal, nicht auf dem Server</td></tr>
          <tr><td class="muted">Modell</td><td><select v-model="aiModel" style="width:100%"><option v-for="m in ai.models" :key="m" :value="m">{{ m }}</option></select></td><td class="muted" style="font-size:12px">Sonnet: schnell und günstig für Vorschläge; Opus: gründlicher</td></tr>
          <tr><td></td><td><button class="primary" @click="saveAi">Speichern und prüfen</button> <span class="muted" style="font-size:12px">{{ aiState }}</span></td><td class="muted" style="font-size:12px">ohne Schlüssel arbeiten Datenqualität, DPP und PPWR regelbasiert</td></tr>
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
