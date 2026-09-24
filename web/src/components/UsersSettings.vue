<script setup>
// Einstellungen → ⚙ Anlage → Anwender und Rollen (Recht users): wer im System arbeitet, welche Rolle und welches Team.
// Rollen (Taloan, 20.09.): Namen und Rechte bestimmt der Anwender — Tabelle Rollen × Rechte, Saatgut admin/manager/editor/reader.
// Das eigene Konto (Passwort, API-Token) steht unter ◐ Ich — Verwaltung und eigenes Konto sind zweierlei (Taloan, 23.09.2026).
import { ref, onMounted } from 'vue'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { menu } from '../menu.js'

const roles = ref([]); const rights = ref([]); const newRole = ref(''); const teams = ref([])
const isAdmin = () => store.can('users')
const users = ref([]); const me = ref(null)
const form = ref(null)   // { key, name, email, role, password, isNew }
async function load() {
  try { me.value = await api.get('/api/auth/me') } catch { me.value = null }
  try { rights.value = await api.get('/api/auth/rights'); roles.value = await api.get('/api/auth/roles') } catch (e) { store.toast(e.message) }
  try { teams.value = await api.get('/api/teams') } catch { teams.value = [] }   // Team = Kostenstelle der KI (Taloan, 23.09.)
  if (isAdmin()) { try { users.value = await api.get('/api/auth/users') } catch (e) { store.toast(e.message) } }
}
function edit(u) { form.value = u ? { key: u.key, name: u.name, email: u.email ?? '', role: u.role, team: u.team ?? '', password: '', isNew: false } : { key: '', name: '', email: '', role: 'editor', team: '', password: '', isNew: true } }
async function save() {
  const f = form.value
  if (f.isNew && !f.password) { store.toast('Passwort für den neuen Anwender'); return }
  try { await api.post(`/api/auth/users/${encodeURIComponent(f.key.trim().toLowerCase())}`, { name: f.name, email: f.email || null, role: f.role, team: f.team || '', password: f.password || null }, 'PUT'); form.value = null; await load(); store.toast('✓ gespeichert', 'ok') }
  catch (e) { store.toast(e.message) }
}
async function toggle(u) { try { await api.post(`/api/auth/users/${u.key}`, { enabled: !u.enabled }, 'PUT'); await load() } catch (e) { store.toast(e.message) } }
async function remove(u) {
  if (!await dialog.confirm({ title: `${u.name || u.key} entfernen?`, warn: 'Anmeldung, Token und Sitzungen weg; Journaleinträge bleiben', ok: 'Entfernen', danger: true })) return
  try { await api.del(`/api/auth/users/${u.key}`); await load() } catch (e) { store.toast(e.message) }
}
// Rollen: Recht an/aus, umbenennen, anlegen, zurückziehen (Kontextmenü — wie überall)
async function roleToggle(r, right) {
  const set = new Set(r.rights); set.has(right) ? set.delete(right) : set.add(right)
  try { await api.post(`/api/auth/roles/${r.key}`, { rights: [...set] }, 'PUT'); await load(); if (r.key === store.auth.role) await store.loadAuth() } catch (e) { store.toast(e.message) }
}
async function roleLabel(r, label) { try { await api.post(`/api/auth/roles/${r.key}`, { label }, 'PUT'); await load() } catch (e) { store.toast(e.message) } }
async function roleAdd() {
  const k = newRole.value.trim().toLowerCase(); if (!k) return
  try { await api.post(`/api/auth/roles/${k}`, { label: newRole.value.trim(), rights: ['read'] }, 'PUT'); newRole.value = ''; await load() } catch (e) { store.toast(e.message) }
}
function roleMenu(e, r) {
  menu.open(e, [
    { label: `Rolle ${r.label || r.key}`, disabled: true }, { sep: true },
    { label: 'Rolle zurückziehen', icon: '✕', key: 'Delete', disabled: r.key === 'admin' || r.users > 0, hint: r.key === 'admin' ? 'admin bleibt' : r.users ? `${r.users} Anwender` : '', action: async () => { if (!await dialog.confirm({ title: `Rolle ${r.label || r.key} zurückziehen?`, ok: 'Zurückziehen', danger: true })) return; try { await api.del(`/api/auth/roles/${r.key}`); await load() } catch (err) { store.toast(err.message) } } },
  ])
}
onMounted(load)
</script>

<template>
  <div class="section" v-if="isAdmin()">
    <h2>{{ $t("👥 Anwender") + ' ' }}<span class="muted" :title="$t('Passwörter liegen beim Server (auth.json), nie im Journal.')">· {{ users.length }}</span></h2>
    <table class="grid" style="width:100%">
      <thead><tr><th style="width:120px">{{ $t("Anwender") }}</th><th>{{ $t("Name") }}</th><th>{{ $t("E-Mail") }}</th><th style="width:80px">{{ $t("Rolle") }}</th><th style="width:90px" :title="$t('Wessen Schlüssel gelten und welchem Team die Nutzung zugeordnet wird')">{{ $t("Team") }}</th><th style="width:60px"></th><th style="width:150px">{{ $t("zuletzt") }}</th><th style="width:130px"></th></tr></thead>
      <tbody>
        <tr v-for="u in users" :key="u.key" :class="{ off: !u.enabled }">
          <td class="mono">{{ u.key }}</td><td>{{ u.name }}</td><td class="muted">{{ u.email ?? '' }}</td><td :title="u.role">{{ roles.find(r => r.key === u.role)?.label || u.role }}</td>
          <td :class="u.team ? '' : 'muted'" :title="u.team ? `Team ${u.team}` : 'kein eigenes Team — es gilt Team 1'">{{ teams.find(t => t.key === u.team)?.label || u.team || '①' }}</td>
          <td><button class="toggle" :class="{ on: u.enabled, off: !u.enabled }" @click="toggle(u)" :title="u.enabled ? 'Sperren (jetzt aktiv)' : 'Freischalten (jetzt gesperrt)'">{{ u.enabled ? '✓' : '✗' }}</button></td>
          <td class="muted" style="font-size:12px">{{ when(u.lastAt) }} 👤 {{ u.lastActor }}</td>
          <td class="row" style="gap:4px"><button class="x" @click="edit(u)">✎</button><button class="x" @click="remove(u)" :disabled="u.key === store.auth.user" :title="$t('entfernen')">🗑</button></td>
        </tr>
      </tbody>
    </table>
    <div class="row" style="gap:6px;margin-top:6px"><button class="primary" @click="edit(null)">{{ $t("＋ Anwender") }}</button></div>
    <div v-if="form" class="picker" style="padding:8px;margin-top:6px">
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <input v-model="form.key" type="text" :placeholder="$t('benutzername')" style="width:140px" :disabled="!form.isNew" />
        <input v-model="form.name" type="text" :placeholder="$t('Anzeigename')" style="width:180px" />
        <input v-model="form.email" type="email" :placeholder="$t('E-Mail')" style="width:200px" />
        <select v-model="form.role"><option v-for="r in roles" :key="r.key" :value="r.key">{{ r.label || r.key }} · {{ r.key }}</option></select>
        <select v-model="form.team" :title="$t('Kostenstelle der KI — leer: es gilt das erste Team')"><option value="">{{ $t("— Team 1 —") }}</option><option v-for="t in teams" :key="t.key" :value="t.key">{{ t.label }}</option></select>
        <input v-model="form.password" type="password" autocomplete="new-password" :placeholder="form.isNew ? 'Passwort (Pflicht)' : 'neues Passwort (leer = bleibt)'" style="width:200px" />
        <button class="primary" @click="save">{{ $t("Speichern") }}</button><button @click="form = null">{{ $t("Abbrechen") }}</button>
      </div>
    </div>
  </div>

  <div class="section" v-if="isAdmin()">
    <h2>{{ $t("◈ Rollen") + ' ' }}<span class="muted" :title="$t('Welche Rechte eine Rolle hat, bestimmen Sie; Rechtsklick zieht eine Rolle zurück.')">· {{ roles.length }}</span></h2>
    <table class="grid" style="width:auto">
      <thead><tr><th style="width:110px">{{ $t("Rolle") }}</th><th style="width:160px">{{ $t("Bezeichnung") }}</th><th v-for="rt in rights" :key="rt.key" style="text-align:center;min-width:64px" :title="rt.key">{{ rt.label }}</th><th style="width:70px" class="num">{{ $t("Anwender") }}</th></tr></thead>
      <tbody>
        <tr v-for="r in roles" :key="r.key" @contextmenu="roleMenu($event, r)">
          <td class="mono">{{ r.key }}</td>
          <td><input :value="r.label" style="width:100%" @change="e => roleLabel(r, e.target.value)" /></td>
          <td v-for="rt in rights" :key="rt.key" style="text-align:center"><button class="toggle" :class="{ on: r.rights.includes(rt.key) }" :disabled="r.key === 'admin'" @click="roleToggle(r, rt.key)" :title="r.rights.includes(rt.key) ? rt.label + ' entziehen' : rt.label + ' geben'">{{ r.rights.includes(rt.key) ? '✓' : '✗' }}</button></td>
          <td class="num muted">{{ r.users || '' }}</td>
        </tr>
      </tbody>
    </table>
    <div class="row" style="gap:6px;margin-top:6px"><input v-model="newRole" type="text" :placeholder="$t('neue Rolle (key)')" style="width:180px" @keydown.enter="roleAdd" /><button class="primary" :disabled="!newRole.trim()" @click="roleAdd">{{ $t("＋ Rolle") }}</button></div>
  </div>
</template>

<style scoped>
.toggle { width: 28px; color: var(--muted); font-weight: 600; }
.toggle.on { color: var(--pos); }
.toggle.off { color: var(--neg); }
.toggle:disabled { opacity: .8; }
table.form td { white-space: normal; vertical-align: middle; height: 34px; }
.row { display: flex; align-items: center; }
tr.off td { opacity: .55; }
</style>
