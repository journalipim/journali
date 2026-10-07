<script setup>
import { RECHTLICHES } from '../help.js'   // Impressum und Datenschutz — in der Demo unter dem Zugang
// Anmeldung. Gibt es noch keinen Benutzer, wird hier der erste Administrator angelegt —
// danach ist der Server gesperrt und der Urheber jedes Eintrags kommt aus der Sitzung.
// Stehen im Journal Administratoren, von denen keiner ein Passwort hat (Datenbank von einem anderen Server), legt man hier
// für einen von ihnen eines fest. Beides verlangt den Einrichtungscode aus der Konsole des Servers.
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api.js'
import { store } from '../store.js'

const router = useRouter()
const user = ref(''); const name = ref(''); const password = ref(''); const code = ref(''); const error = ref(''); const busy = ref(false)
// Gesperrt (zu viele Fehlversuche): die Sekunden laufen herunter, der Knopf wartet. Ein Versuch in der Sperre setzt sie am Server wieder auf eine ganze Minute —
// darum versucht die Seite es erst gar nicht, bevor sie abgelaufen ist.
const sperre = ref(0); let uhr = null
function sperreStart(sek) {
  sperre.value = sek; clearInterval(uhr)
  uhr = setInterval(() => { sperre.value = Math.max(0, sperre.value - 1); if (sperre.value === 0) { clearInterval(uhr); error.value = '' } }, 1000)
}
onUnmounted(() => clearInterval(uhr))
onMounted(async () => {
  await store.loadAuth()
  if (store.auth.enabled && store.auth.user) router.replace('/tree')
  else if (store.auth.claim?.length) user.value = store.auth.claim[0]
})
async function go() {
  if (sperre.value > 0) return
  error.value = ''; busy.value = true
  try {
    if (store.auth.setup) await api.post('/api/auth/setup', { user: user.value, name: name.value, password: password.value, code: code.value })
    else if (store.auth.claim) await api.post('/api/auth/claim', { user: user.value, password: password.value, code: code.value })
    else await api.post('/api/auth/login', { user: user.value, password: password.value })
    await store.loadAuth(); await store.poll(true)
    router.replace(sessionStorage.getItem('journali.after') || '/tree'); sessionStorage.removeItem('journali.after')
  } catch (e) {
    if (e.status === 429 && e.retryAfter) sperreStart(e.retryAfter)
    else error.value = e.message
  } finally { busy.value = false }
}
</script>

<template>
  <div class="pane" style="flex:1;display:grid;place-items:center">
    <form class="box" @submit.prevent="go">
      <div class="row" style="gap:10px;align-items:center;margin-bottom:14px"><img src="/logo-128.png" width="36" height="36" alt="" style="border-radius:8px" /><b style="font-size:18px">{{ $t("journali") }}</b></div>
      <template v-if="store.auth.setup">
        <h2>{{ $t("Ersten Administrator anlegen") }}</h2>
        <p class="muted" style="font-size:12px;margin:0 0 10px" :title="$t('Bearbeiter, Rollen und API-Token stehen danach unter ⚙ Einstellungen. Das Passwort liegt als Hash in der Datenbank, nie im Journal.')">{{ $t("Danach braucht jeder Zugriff eine Anmeldung") }}</p>
      </template>
      <template v-else-if="store.auth.claim">
        <h2>{{ $t("Administrator-Passwort festlegen") }}</h2>
        <p class="muted" style="font-size:12px;margin:0 0 10px" :title="$t('Die Anwender stehen im Journal, ihre Passwörter nicht. Weitere Passwörter setzt danach ein Administrator unter ◈ IAM.')">{{ $t("Kein Administrator hat ein Passwort") }}</p>
      </template>
      <h2 v-else>{{ $t("Anmelden") }}</h2>
      <p v-if="store.demo && !store.auth.setup && !store.auth.claim" class="demo-zugang" style="font-size:13px;margin:0 0 6px" :title="$t('Die Demo wird täglich zurückgesetzt.')">{{ $t("Demo: Anmeldename demo, Passwort demo.") }}</p>
      <p v-if="store.demo" class="rechtliches muted" style="font-size:12px;margin:0 0 6px"><a v-for="l in RECHTLICHES" :key="l.url" :href="l.url" target="_blank" rel="noopener" style="margin-right:12px">{{ l.label }}</a></p>
      <label v-if="store.auth.claim">{{ $t("Administrator") }}<select v-model="user" style="display:block;width:100%;margin-top:3px"><option v-for="k in store.auth.claim" :key="k" :value="k">{{ k }}</option></select></label>
      <label v-else>{{ $t("Anmeldename") }}<input v-model="user" type="text" autocomplete="username" autofocus placeholder="a-z, 0-9, ., _, -" /></label>
      <label v-if="store.auth.setup">{{ $t("Anzeigename") }}<input v-model="name" type="text" autocomplete="name" :placeholder="$t('steht als Urheber im Journal')" /></label>
      <label>{{ $t("Passwort") }}<input v-model="password" type="password" :autocomplete="store.auth.setup || store.auth.claim ? 'new-password' : 'current-password'" :placeholder="$t('mindestens 8 Zeichen')" /></label>
      <label v-if="store.auth.code && (store.auth.setup || store.auth.claim)">{{ $t("Einrichtungscode") }}<input v-model="code" type="text" autocomplete="off" placeholder="XXXX-XXXX" :title="$t('steht in der Konsole des Servers und in einrichtungscode.txt im Datenverzeichnis')" /></label>
      <div v-if="sperre > 0" class="neg sperre" style="font-size:13px;margin:6px 0">✗ {{ $t("Zu viele Anmeldeversuche — gesperrt für {0} Sekunden.", [sperre]) }}</div>
      <div v-else-if="error" class="neg" style="font-size:13px;margin:6px 0">✗ {{ error }}</div>
      <button class="primary" type="submit" :disabled="busy || sperre > 0" style="width:100%;margin-top:8px">{{ store.auth.setup ? $t('Anlegen und anmelden') : store.auth.claim ? $t('Festlegen und anmelden') : $t('Anmelden') }}</button>
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
