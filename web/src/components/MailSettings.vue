<script setup>
// Einstellungen → Mail (Taloan, 23.09.2026: „was wir in den Settings noch brauchen, ist eine Mailserver-Konfiguration
// zum Versenden von Mails"). Liegt als mail.json im Datenverzeichnis, nie im Journal — da steht ein Passwort drin.
// Das Passwort kommt maskiert zurück; wer es nicht anfasst, lässt es stehen.
import { ref, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'

const c = ref({ host: '', port: 587, startTls: true, user: '', password: '', from: '', fromName: '', replyTo: '' })
const ready = ref(false)
const busy = ref('')
const said = ref('')
const probe = ref(localStorage.getItem('journali.mail.test') ?? '')

async function lies() {
  try {
    const r = await api.get('/api/mail')
    c.value = { ...c.value, ...r.config }
    ready.value = r.ready
  } catch (e) { said.value = '✗ ' + e.message }
}

async function speichern() {
  busy.value = '…'; said.value = ''
  try {
    const r = await api.post('/api/mail', c.value, 'PUT')
    c.value = { ...c.value, ...r.config }
    ready.value = r.ready
    said.value = ready.value ? '✓ gespeichert' : '✓ gespeichert — ohne Server und Absender wird nichts gesendet'
  } catch (e) { said.value = '✗ ' + e.message }
  finally { busy.value = '' }
}

async function testen() {
  if (!probe.value.trim()) { said.value = '✗ Empfänger fehlt'; return }
  localStorage.setItem('journali.mail.test', probe.value.trim())
  busy.value = '…'; said.value = ''
  try {
    await api.post('/api/mail/test', { to: probe.value.trim() })
    said.value = `✓ Probe an ${probe.value.trim()} gesendet`
  } catch (e) { said.value = '✗ ' + e.message }
  finally { busy.value = '' }
}

onMounted(lies)
</script>

<template>
  <div class="section">
    <h2>✉ Mailserver <span class="muted">· SMTP · liegt beim Server (mail.json), nie im Journal</span></h2>

    <table class="grid form"><colgroup><col style="width:170px" /><col style="width:340px" /></colgroup><tbody>
      <tr><td class="attr">Server</td><td><input v-model="c.host" type="text" placeholder="smtp.beispiel.de" style="width:100%" /></td></tr>
      <tr><td class="attr">Port</td><td>
        <input v-model.number="c.port" type="number" min="1" max="65535" style="width:90px" />
        <label style="margin-left:10px" title="STARTTLS auf 587 oder 25; implizites TLS auf 465 geht nicht"><input type="checkbox" v-model="c.startTls" /> STARTTLS</label>
      </td></tr>
      <tr><td class="attr">Benutzer</td><td><input v-model="c.user" type="text" autocomplete="off" style="width:100%" /></td></tr>
      <tr><td class="attr">Passwort</td><td><input v-model="c.password" type="password" autocomplete="new-password" placeholder="unverändert" style="width:100%" /></td></tr>
      <tr><td class="attr">Absender</td><td><input v-model="c.from" type="text" placeholder="pim@beispiel.de" style="width:100%" /></td></tr>
      <tr><td class="attr">Anzeigename</td><td><input v-model="c.fromName" type="text" placeholder="journali PIM" style="width:100%" /></td></tr>
      <tr><td class="attr">Antwort an</td><td><input v-model="c.replyTo" type="text" placeholder="leer = Absender" style="width:100%" /></td></tr>
    </tbody></table>

    <div class="row" style="gap:8px;margin-top:8px;align-items:center">
      <button class="primary" :disabled="!!busy" @click="speichern">{{ busy || '💾 Speichern' }}</button>
      <span class="grow" />
      <input v-model="probe" type="text" placeholder="Probe an …" style="width:220px" @keydown.enter="testen" />
      <button :disabled="!!busy || !ready" :title="ready ? 'eine Probe senden' : 'erst Server und Absender eintragen'" @click="testen">✉ Probe</button>
    </div>

    <div v-if="said" :class="said.startsWith('✗') ? 'neg' : 'pos'" style="font-size:12px;margin-top:6px">{{ said }}</div>
    <div v-if="!ready" class="muted" style="font-size:12px;margin-top:6px">Ohne Server und Absender sendet journali nichts.</div>
  </div>
</template>
