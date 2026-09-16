<script setup>
// Einstellungen: wer schreibt (X-Actor), welcher Server, und was er sagt.
import { ref } from 'vue'
import { store } from '../store.js'

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
    <div class="toolbar"><h1>⚙ Einstellungen</h1></div>
    <div class="scroll">
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
</style>
