<script setup>
// Mein Konto (Taloan, 23.09.2026: „hier habe ich alles quer gemischt — Einstellungen für mein eigenes Konto und die
// Verwaltung der Benutzer und Rechte“): Passwort und die eigenen API-Token. Wer sonst im System arbeitet, steht unter
// ⚙ Anlage — das ist Verwaltung, nicht mein Konto.
import { ref, onMounted } from 'vue'
import { api, when } from '../api.js'
import { store } from '../store.js'

const me = ref(null)
const pw = ref({ current: '', password: '', again: '' }); const pwState = ref('')
const tokenLabel = ref(''); const newToken = ref(null)

async function load() { try { me.value = await api.get('/api/auth/me') } catch { me.value = null } }
onMounted(load)

async function changePw() {
  if (pw.value.password !== pw.value.again) { pwState.value = '✗ Wiederholung stimmt nicht'; return }
  try { await api.post('/api/auth/password', { current: pw.value.current, password: pw.value.password }); pwState.value = '✓ geändert'; pw.value = { current: '', password: '', again: '' } }
  catch (e) { pwState.value = '✗ ' + e.message }
}
async function makeToken() {
  try { newToken.value = await api.post('/api/auth/tokens', { label: tokenLabel.value || 'Token' }); tokenLabel.value = ''; await load() } catch (e) { store.toast(e.message) }
}
/// Ohne sicheren Kontext (http auf einem fremden Rechner) gibt es keine Zwischenablage — dann bleibt der Text markierbar
async function copyToken() {
  try { await navigator.clipboard.writeText(newToken.value.token); store.toast('kopiert', 'ok') }
  catch { store.toast('Zwischenablage nicht verfügbar — Text markieren und mit Strg+C kopieren') }
}
async function dropToken(t) { try { await api.del(`/api/auth/tokens/${t.id}`); await load() } catch (e) { store.toast(e.message) } }
</script>

<template>
  <div class="section">
    <h2>👤 Zugangsdaten <span class="muted">· {{ me?.name || store.auth.user }} · {{ store.auth.role }}<span v-if="me?.team"> · ◍ {{ me.team }}</span></span></h2>
    <table class="grid form" style="width:auto"><colgroup><col style="width:140px" /><col style="width:300px" /><col /></colgroup><tbody>
      <tr><td class="muted">aktuelles Passwort</td><td><input v-model="pw.current" type="password" autocomplete="current-password" style="width:100%" /></td><td></td></tr>
      <tr><td class="muted">neues Passwort</td><td><input v-model="pw.password" type="password" autocomplete="new-password" style="width:100%" placeholder="mindestens 8 Zeichen" /></td><td></td></tr>
      <tr><td class="muted">wiederholen</td><td><input v-model="pw.again" type="password" autocomplete="new-password" style="width:100%" /></td>
        <td class="row" style="gap:8px"><button class="primary" @click="changePw">Passwort ändern</button><span class="muted" style="font-size:12px">{{ pwState }}</span></td></tr>
    </tbody></table>
  </div>

  <div class="section">
    <h2>⚿ API-Token <span class="muted" title="Authorization: Bearer — nur beim Anlegen sichtbar. Ein Token arbeitet mit meinen Rechten; was damit geschrieben wird, ist meinem Team zugeordnet.">· Excel-Add-in, OnlyOffice, Skripte</span></h2>
    <div class="row" style="gap:6px;margin-bottom:6px">
      <input v-model="tokenLabel" type="text" placeholder="Bezeichnung (z. B. Excel Laptop)" style="width:260px" />
      <button class="primary" @click="makeToken">＋ Token</button>
    </div>
    <div v-if="newToken" class="picker" style="padding:8px;margin-bottom:6px">
      <b>{{ newToken.label }}</b> · <span class="mono" style="user-select:all">{{ newToken.token }}</span>
      <button class="x" @click="copyToken()">⧉</button>
      <div class="muted" style="font-size:12px">{{ newToken.hint }}</div>
    </div>
    <div class="chips">
      <span v-for="t in me?.tokens ?? []" :key="t.id" class="chip" :title="when(t.at)">{{ t.label }} <button @click="dropToken(t)" title="Token widerrufen">×</button></span>
      <span v-if="!me?.tokens?.length" class="muted" style="font-size:12px">keine</span>
    </div>
  </div>
</template>
