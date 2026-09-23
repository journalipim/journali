<script setup>
// Die Lizenz (Taloan, 23.09.2026: „die Grenzen setzt der Lizenzkey“). Sie wird nicht gepflegt, sondern eingespielt —
// darum eine Datei, kein Stammdatum. Was sie sagt, gilt für die ganze Anlage: Einträge je Woche und Monat, das
// Was ein Team an KI verbraucht, geht an seinen Anbieter — journali lizenziert das nicht (Taloan, 23.09.2026).
import { ref, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'

const lic = ref(null)
const roh = ref('')
const said = ref('')
const darf = () => store.can('users')

async function load() { try { lic.value = await api.get('/api/licence') } catch (e) { store.toast(e.message) } }
onMounted(load)
const zahl = n => (n ?? 0).toLocaleString('de-DE')

async function einspielen() {
  let daten
  try { daten = JSON.parse(roh.value) } catch { said.value = '✗ kein gültiger Schlüssel'; return }
  try { const r = await api.post('/api/licence', daten, 'PUT'); roh.value = ''; said.value = r.geprueft ? '✓ eingespielt und geprüft' : `✓ eingespielt · ${r.grund ?? ''}`; await load(); await store.poll(true) }
  catch (e) { said.value = '✗ ' + e.message }
}
</script>

<template>
  <div class="section">
    <h2>⚿ Lizenz <span v-if="lic?.holder" class="muted">· {{ lic.holder }}</span></h2>
    <table class="grid form" style="width:auto"><colgroup><col style="width:170px" /><col style="width:200px" /><col /></colgroup><tbody>
      <tr>
        <td class="muted">Stand</td>
        <td>
          <span v-if="lic?.abgelaufen" class="neg">● abgelaufen</span>
          <span v-else-if="lic?.geprueft" class="pos">● geprüft</span>
          <span v-else class="warn">● ungeprüft</span>
        </td>
        <td class="muted">{{ lic?.grund ?? '' }}</td>
      </tr>
      <tr v-if="lic?.validUntil"><td class="muted">gültig bis</td><td class="mono">{{ lic.validUntil }}</td><td></td></tr>
      <tr><td class="muted" title="journali-Token je Woche: jede Pflege schreibt einen Eintrag ins Journal.">▤ Token / Woche</td><td class="mono">{{ zahl(lic?.entriesWeek) }}</td><td></td></tr>
      <tr><td class="muted" title="journali-Token je Monat: jede Pflege schreibt einen Eintrag ins Journal.">▦ Token / Monat</td><td class="mono">{{ zahl(lic?.entriesMonth) }}</td><td></td></tr>
    </tbody></table>

    <div v-if="darf()" style="margin-top:8px">
      <textarea v-model="roh" rows="4" style="width:100%;max-width:640px" placeholder='{"plan":"…","entriesWeek":20000,…}'></textarea>
      <div class="row" style="gap:8px;margin-top:4px">
        <button class="primary" @click="einspielen">⚿ Einspielen</button>
        <span class="muted" style="font-size:12px">{{ said }}</span>
      </div>
    </div>
  </div>
</template>
