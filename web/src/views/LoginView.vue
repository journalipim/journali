<script setup>
// Anmeldung (Taloan, 19.09.2026: Benutzer & Rollen). Gibt es noch keinen Benutzer, wird hier der erste Administrator angelegt —
// danach ist der Server gesperrt und der Urheber jedes Eintrags kommt aus der Sitzung.
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api.js'
import { store } from '../store.js'

const router = useRouter()
const user = ref(''); const name = ref(''); const password = ref(''); const error = ref(''); const busy = ref(false)
onMounted(async () => { await store.loadAuth(); if (store.auth.enabled && store.auth.user) router.replace('/tree') })
async function go() {
  error.value = ''; busy.value = true
  try {
    if (store.auth.setup) await api.post('/api/auth/setup', { user: user.value, name: name.value, password: password.value })
    else await api.post('/api/auth/login', { user: user.value, password: password.value })
    await store.loadAuth(); await store.poll(true)
    router.replace(sessionStorage.getItem('journali.after') || '/tree'); sessionStorage.removeItem('journali.after')
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <div class="pane" style="flex:1;display:grid;place-items:center">
    <form class="box" @submit.prevent="go">
      <div class="row" style="gap:10px;align-items:center;margin-bottom:14px"><img src="/logo-128.png" width="36" height="36" alt="" style="border-radius:8px" /><b style="font-size:18px">journali</b></div>
      <template v-if="store.auth.setup">
        <h2>Ersten Administrator anlegen</h2>
        <p class="muted" style="font-size:12px;margin:0 0 10px" title="Bearbeiter, Rollen und API-Token stehen danach unter ⚙ Einstellungen. Das Passwort liegt nur beim Server (auth.json), nie im Journal.">Danach braucht jeder Zugriff eine Anmeldung</p>
      </template>
      <h2 v-else>Anmelden</h2>
      <label>Benutzername<input v-model="user" type="text" autocomplete="username" autofocus placeholder="a-z, 0-9, ., _, -" /></label>
      <label v-if="store.auth.setup">Anzeigename<input v-model="name" type="text" autocomplete="name" placeholder="steht als Urheber im Journal" /></label>
      <label>Passwort<input v-model="password" type="password" :autocomplete="store.auth.setup ? 'new-password' : 'current-password'" placeholder="mindestens 8 Zeichen" /></label>
      <div v-if="error" class="neg" style="font-size:13px;margin:6px 0">✗ {{ error }}</div>
      <button class="primary" type="submit" :disabled="busy" style="width:100%;margin-top:8px">{{ store.auth.setup ? 'Anlegen und anmelden' : 'Anmelden' }}</button>
    </form>
  </div>
</template>

<style scoped>
.box { width: 340px; background: var(--pane); border: 1px solid var(--line); border-radius: 10px; padding: 20px; }
.box h2 { font-size: 16px; margin: 0 0 8px; }
label { display: block; font-size: 12px; color: var(--muted); margin-top: 8px; }
label input { display: block; width: 100%; margin-top: 3px; }
.row { display: flex; }
</style>
