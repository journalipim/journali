<script setup>
// Einstellungen → Benutzer (admin) und Konto (jeder): Benutzer anlegen, Rolle, sperren, Passwort setzen, entfernen;
// eigenes Passwort ändern; API-Token für Excel-Add-in, OnlyOffice und Skripte (Authorization: Bearer).
import { ref, onMounted } from 'vue'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'

const ROLES = [['admin', 'admin — alles, auch Modell, Plugins, Benutzer, Storage'], ['editor', 'editor — Daten pflegen, Importe, Versionen'], ['reader', 'reader — nur lesen']]
const users = ref([]); const me = ref(null)
const form = ref(null)   // { key, name, email, role, password, isNew }
const pw = ref({ current: '', password: '', again: '' }); const pwState = ref('')
const tokenLabel = ref(''); const newToken = ref(null)

async function load() {
  try { me.value = await api.get('/api/auth/me') } catch { me.value = null }
  if (store.auth.role === 'admin') { try { users.value = await api.get('/api/auth/users') } catch (e) { store.toast(e.message) } }
}
function edit(u) { form.value = u ? { key: u.key, name: u.name, email: u.email ?? '', role: u.role, password: '', isNew: false } : { key: '', name: '', email: '', role: 'editor', password: '', isNew: true } }
async function save() {
  const f = form.value
  if (f.isNew && !f.password) { store.toast('Passwort für den neuen Benutzer'); return }
  try { await api.post(`/api/auth/users/${encodeURIComponent(f.key.trim().toLowerCase())}`, { name: f.name, email: f.email || null, role: f.role, password: f.password || null }, 'PUT'); form.value = null; await load(); store.toast('✓ gespeichert', 'ok') }
  catch (e) { store.toast(e.message) }
}
async function toggle(u) { try { await api.post(`/api/auth/users/${u.key}`, { enabled: !u.enabled }, 'PUT'); await load() } catch (e) { store.toast(e.message) } }
async function remove(u) {
  if (!await dialog.confirm({ title: `${u.name || u.key} entfernen`, warn: 'Anmeldung, Token und Sitzungen weg — die Einträge im Journal bleiben', ok: 'Entfernen', danger: true })) return
  try { await api.del(`/api/auth/users/${u.key}`); await load() } catch (e) { store.toast(e.message) }
}
async function changePw() {
  if (pw.value.password !== pw.value.again) { pwState.value = '✗ Wiederholung stimmt nicht'; return }
  try { await api.post('/api/auth/password', { current: pw.value.current, password: pw.value.password }); pwState.value = '✓ geändert'; pw.value = { current: '', password: '', again: '' } } catch (e) { pwState.value = '✗ ' + e.message }
}
async function makeToken() {
  try { newToken.value = await api.post('/api/auth/tokens', { label: tokenLabel.value || 'Token' }); tokenLabel.value = ''; await load() } catch (e) { store.toast(e.message) }
}
async function dropToken(t) { try { await api.del(`/api/auth/tokens/${t.id}`); await load() } catch (e) { store.toast(e.message) } }
onMounted(load)
</script>

<template>
  <div class="section">
    <h2>👤 Konto <span class="muted">· {{ me?.name || store.auth.user }} · {{ store.auth.role }}</span></h2>
    <table class="grid form" style="width:auto"><colgroup><col style="width:140px" /><col style="width:300px" /><col /></colgroup><tbody>
      <tr><td class="muted">aktuelles Passwort</td><td><input v-model="pw.current" type="password" autocomplete="current-password" style="width:100%" /></td><td></td></tr>
      <tr><td class="muted">neues Passwort</td><td><input v-model="pw.password" type="password" autocomplete="new-password" style="width:100%" placeholder="mindestens 8 Zeichen" /></td><td></td></tr>
      <tr><td class="muted">wiederholen</td><td><input v-model="pw.again" type="password" autocomplete="new-password" style="width:100%" /></td><td class="row" style="gap:8px"><button class="primary" @click="changePw">Passwort ändern</button><span class="muted" style="font-size:12px">{{ pwState }}</span></td></tr>
    </tbody></table>
  </div>

  <div class="section">
    <h2>🔑 API-Token <span class="muted">· für Excel-Add-in, OnlyOffice, Skripte — Authorization: Bearer; nur beim Anlegen sichtbar</span></h2>
    <div class="row" style="gap:6px;margin-bottom:6px"><input v-model="tokenLabel" type="text" placeholder="Bezeichnung (z. B. Excel Laptop)" style="width:260px" /><button class="primary" @click="makeToken">＋ Token</button></div>
    <div v-if="newToken" class="picker" style="padding:8px;margin-bottom:6px"><b>{{ newToken.label }}</b> · <span class="mono" style="user-select:all">{{ newToken.token }}</span> <button class="x" @click="navigator.clipboard.writeText(newToken.token).then(() => store.toast('kopiert', 'ok'))">⧉</button><div class="muted" style="font-size:12px">{{ newToken.hint }}</div></div>
    <div class="chips"><span v-for="t in me?.tokens ?? []" :key="t.id" class="chip" :title="when(t.at)">{{ t.label }} <button @click="dropToken(t)" title="Token widerrufen">×</button></span><span v-if="!me?.tokens?.length" class="muted" style="font-size:12px">keine</span></div>
  </div>

  <div class="section" v-if="store.auth.role === 'admin'">
    <h2>👥 Benutzer <span class="muted">· {{ users.length }} · Rollen: admin, editor, reader · Passwörter liegen beim Server (auth.json), nie im Journal</span></h2>
    <table class="grid" style="width:100%">
      <thead><tr><th style="width:120px">Benutzer</th><th>Name</th><th>E-Mail</th><th style="width:80px">Rolle</th><th style="width:60px"></th><th style="width:150px">zuletzt</th><th style="width:130px"></th></tr></thead>
      <tbody>
        <tr v-for="u in users" :key="u.key" :class="{ off: !u.enabled }">
          <td class="mono">{{ u.key }}</td><td>{{ u.name }}</td><td class="muted">{{ u.email ?? '' }}</td><td class="mono">{{ u.role }}</td>
          <td><button class="toggle" :class="{ on: u.enabled }" @click="toggle(u)" :title="u.enabled ? 'aktiv — Klick sperrt' : 'gesperrt — Klick aktiviert'">{{ u.enabled ? '●' : '○' }}</button></td>
          <td class="muted" style="font-size:12px">{{ when(u.lastAt) }} 👤 {{ u.lastActor }}</td>
          <td class="row" style="gap:4px"><button class="x" @click="edit(u)">✎</button><button class="x" @click="remove(u)" :disabled="u.key === store.auth.user" title="entfernen">🗑</button></td>
        </tr>
      </tbody>
    </table>
    <div class="row" style="gap:6px;margin-top:6px"><button class="primary" @click="edit(null)">＋ Benutzer</button></div>
    <div v-if="form" class="picker" style="padding:8px;margin-top:6px">
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <input v-model="form.key" type="text" placeholder="benutzername" style="width:140px" :disabled="!form.isNew" />
        <input v-model="form.name" type="text" placeholder="Anzeigename" style="width:180px" />
        <input v-model="form.email" type="email" placeholder="E-Mail" style="width:200px" />
        <select v-model="form.role"><option v-for="[v, l] in ROLES" :key="v" :value="v">{{ l }}</option></select>
        <input v-model="form.password" type="password" autocomplete="new-password" :placeholder="form.isNew ? 'Passwort (Pflicht)' : 'neues Passwort (leer = bleibt)'" style="width:200px" />
        <button class="primary" @click="save">Speichern</button><button @click="form = null">Abbrechen</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
table.form td { white-space: normal; vertical-align: middle; height: 34px; }
.section { padding: 10px 8px; border-top: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600; }
.row { display: flex; align-items: center; }
tr.off td { opacity: .55; }
</style>
