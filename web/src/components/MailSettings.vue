<script setup>
// Einstellungen → Mail (Taloan, 23.09.2026: „was wir in den Settings noch brauchen, ist eine Mailserver-Konfiguration
// zum Versenden von Mails"). Liegt als mail.json im Datenverzeichnis, nie im Journal — da steht ein Passwort drin.
// Das Passwort kommt maskiert zurück; wer es nicht anfasst, lässt es stehen.
import { ref, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'

const c = ref({ host: '', port: 587, security: 'starttls', user: '', password: '', from: '', fromName: '', replyTo: '' })
// Welcher Port zu welcher Verschlüsselung gehört — beim Umschalten mitgesetzt, solange der übliche eingetragen ist
const PORTS = { starttls: 587, ssl: 465, none: 25 }
function security(v) {
  const vorher = PORTS[c.value.security]
  c.value.security = v
  if (c.value.port === vorher) c.value.port = PORTS[v]
}
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
    <h2>{{ $t("✉ Mailserver") + ' ' }}<span class="muted">{{ $t("· SMTP") }}</span></h2>

    <table class="grid form" style="width:auto"><colgroup><col style="width:170px" /><col style="width:340px" /></colgroup><tbody>
      <tr><td class="attr">{{ $t("Server") }}</td><td><input v-model="c.host" type="text" :placeholder="$t('smtp.beispiel.de')" style="width:100%" /></td></tr>
      <tr><td class="attr">{{ $t("Verschlüsselung") }}</td><td>
        <select :value="c.security" style="width:150px" @change="security($event.target.value)">
          <option value="starttls">{{ $t("STARTTLS") }}</option>
          <option value="ssl">{{ $t("TLS (implizit)") }}</option>
          <option value="none">{{ $t("keine") }}</option>
        </select>
        <span class="muted" style="margin-left:10px;font-size:12px">{{ $t("Port") }}</span>
        <input v-model.number="c.port" type="number" min="1" max="65535" style="width:80px;margin-left:6px" />
      </td></tr>
      <tr><td class="attr">{{ $t("Kennung") }}</td><td><input v-model="c.user" type="text" autocomplete="off" style="width:100%" /></td></tr>
      <tr><td class="attr">{{ $t("Passwort") }}</td><td><input v-model="c.password" type="password" autocomplete="new-password" :placeholder="$t('unverändert')" style="width:100%" /></td></tr>
      <tr><td class="attr">{{ $t("Absender") }}</td><td><input v-model="c.from" type="text" :placeholder="$t('pim@beispiel.de')" style="width:100%" /></td></tr>
      <tr><td class="attr">{{ $t("Anzeigename") }}</td><td><input v-model="c.fromName" type="text" :placeholder="$t('journali PIM')" style="width:100%" /></td></tr>
      <tr><td class="attr">{{ $t("Antwort an") }}</td><td><input v-model="c.replyTo" type="text" :placeholder="$t('leer = Absender')" style="width:100%" /></td></tr>
    </tbody></table>

    <div class="row" style="gap:8px;margin-top:8px;align-items:center">
      <button class="primary" :disabled="!!busy" @click="speichern">{{ busy || '💾 Speichern' }}</button>
      <span class="grow" />
      <input v-model="probe" type="text" :placeholder="$t('Probe an …')" style="width:220px" @keydown.enter="testen" />
      <button :disabled="!!busy || !ready" :title="ready ? 'eine Probe senden' : 'erst Server und Absender eintragen'" @click="testen">{{ $t("✉ Probe") }}</button>
    </div>

    <div v-if="said" :class="said.startsWith('✗') ? 'fehler' : 'pos'" style="font-size:12px;margin-top:6px">{{ said }}</div>
    <div v-if="!ready" class="muted" style="font-size:12px;margin-top:6px">{{ $t("Ohne Server und Absender sendet journali nichts.") }}</div>
  </div>
</template>
