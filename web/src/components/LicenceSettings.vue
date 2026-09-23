<script setup>
// Die Lizenz (Taloan, 23.09.2026: „die Grenzen setzt der Lizenzkey“). Sie wird nicht gepflegt, sondern eingespielt —
// darum eine Datei, kein Stammdatum. Was sie sagt, gilt für die ganze Anlage: Einträge je Woche und Monat, das
// Was ein Team an KI verbraucht, geht an seinen Anbieter — journali lizenziert das nicht (Taloan, 23.09.2026).
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'

const emit = defineEmits(['eingespielt'])
// Das Team, das oben im Team-Reiter gewählt ist — für es wird ein Schlüssel eingelöst
const props = defineProps({ team: { type: Object, default: null } })
// Einlösen nur beim Team, das sein Kontingent selbst trägt; wer über ein anderes abrechnet, bekommt keinen Schlüssel
const eigenes = computed(() => !!props.team && (props.team.payer ?? props.team.key) === props.team.key)
const lic = ref(null)
const roh = ref('')
const said = ref('')
const darf = () => store.can('users')

async function load() {
  try { lic.value = await api.get('/api/licence') } catch (e) { store.toast(e.message) }
  if (!darf()) return
  try {
    const [a, e] = await Promise.all([api.get('/api/licence/requests'), api.get('/api/licence/keys')])
    anforderungen.value = a; einloesungen.value = e
  } catch (e) { store.toast(e.message) }
}
onMounted(load)

// Schlüssel (Taloan, 23.09.2026): die Instanz fordert an und signiert, der Shop gibt frei, der Aussteller stellt aus —
// eingelöst wird nur, was hier angefordert wurde. Auf Vorrat und ohne Team; das Team wählt die IT beim Einlösen.
const anforderungen = ref([])
const einloesungen = ref([])
const neu = ref({ kind: 'reset', entriesWeek: 0, entriesMonth: 0, days: 30, count: 1 })
const angefordert = ref('')
const schluessel = ref('')
const saidKey = ref('')

async function anfordern() {
  try {
    const r = await api.post('/api/licence/requests', neu.value)
    angefordert.value = r.length === 1 ? r[0].text : '[' + r.map(x => x.text).join(',\n') + ']'
    saidKey.value = `✓ ${r.length} angefordert`
    await load()
  }
  catch (e) { saidKey.value = '✗ ' + e.message }
}

async function einloesen() {
  if (!schluessel.value.trim() || !eigenes.value) return
  try {
    const r = await api.post('/api/licence/keys', { key: schluessel.value.trim(), team: props.team.key })
    schluessel.value = ''
    saidKey.value = (r.until ? `✓ ${r.id} bis ${r.until}` : `✓ ${r.id} ab ${r.from}`) + (r.carried ? ` · +${r.carried} Tage` : '') + (r.geprueft ? '' : ` · ${r.grund ?? ''}`)
    await load(); await store.poll(true)
    emit('eingespielt')
  }
  catch (e) { saidKey.value = '✗ ' + e.message }
}
const art = k => k === 'reset' ? '↺' : '⇡'
const zahl = n => (n ?? 0).toLocaleString('de-DE')

async function einspielen() {
  let daten
  try { daten = JSON.parse(roh.value) } catch { said.value = '✗ kein gültiger Schlüssel'; return }
  try {
    const r = await api.post('/api/licence', daten, 'PUT')
    roh.value = ''
    said.value = r.geprueft ? '✓ eingespielt und geprüft' : `✓ eingespielt · ${r.grund ?? ''}`
    await load(); await store.poll(true)
    emit('eingespielt')   // die Limits daneben hängen an der Lizenz — sie sollen es sofort zeigen
  }
  catch (e) { said.value = '✗ ' + e.message }
}

/// Die Kennung dieser Instanz kopieren — ohne Zwischenablage bleibt sie markierbar stehen
async function kopiere(text) {
  try { await navigator.clipboard.writeText(text); store.toast('kopiert', 'ok') }
  catch { store.toast('Zwischenablage nicht verfügbar — Text markieren und mit Strg+C kopieren') }
}
</script>

<template>
  <div class="section">
    <h2>⚿ journali Lizenz <span v-if="lic?.holder" class="muted">· {{ lic.holder }}</span></h2>
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
      <tr v-if="lic?.countFrom"><td class="muted" title="Was vor diesem Tag im Journal steht, zählt nicht mehr mit.">◷ gezählt ab</td><td class="mono">{{ lic.countFrom }}</td><td></td></tr>
      <tr v-if="lic?.instanz"><td class="muted" title="Diese Instanz. Eine Lizenz wird auf diese Kennung ausgestellt und gilt nur hier.">⌗ Instanz</td>
        <td class="mono" style="user-select:all">{{ lic.instanz }}</td>
        <td><button class="x" title="Kennung kopieren" @click="kopiere(lic.instanz)">⧉</button></td></tr>
    </tbody></table>

    <div v-if="darf()" style="margin-top:8px">
      <textarea v-model="roh" rows="4" style="width:100%;max-width:640px" placeholder='{"plan":"…","entriesWeek":20000,…}'></textarea>
      <div class="row" style="gap:8px;margin-top:4px">
        <button class="primary" @click="einspielen">⚿ Einspielen</button>
        <span :class="said.startsWith('✗') ? 'fehler' : 'muted'" style="font-size:12px">{{ said }}</span>
      </div>
    </div>

    <div v-if="darf()" class="schluessel" style="margin-top:16px">
      <h3>⚷ Schlüssel</h3>
      <div class="row anfordern" style="gap:6px;flex-wrap:wrap;align-items:center">
        <select v-model="neu.kind" title="Reset: das Team zählt ab dem Einlösen neu. Limit: höheres Kontingent für eine Dauer ab dem Einlösen.">
          <option value="reset">↺ Reset</option>
          <option value="limit">⇡ Limit</option>
        </select>
        <template v-if="neu.kind === 'limit'">
          <label title="Token je Woche">▤ <input v-model.number="neu.entriesWeek" type="number" min="0" style="width:90px" /></label>
          <label title="Token je Monat">▦ <input v-model.number="neu.entriesMonth" type="number" min="0" style="width:90px" /></label>
          <label title="Laufzeit in Tagen ab dem Einlösen">◷ <input v-model.number="neu.days" type="number" min="1" style="width:60px" /></label>
        </template>
        <label title="Anzahl Anforderungen">× <input v-model.number="neu.count" type="number" min="1" max="20" style="width:50px" /></label>
        <button @click="anfordern" title="Anforderung erstellen und mit dem Schlüssel dieser Instanz signieren">⚷ Anfordern</button>
      </div>
      <div v-if="angefordert" class="row" style="gap:6px;margin-top:4px;align-items:flex-start">
        <textarea class="angefordert mono" readonly rows="3" style="width:100%;max-width:640px" :value="angefordert"></textarea>
        <button class="x" title="Anforderung kopieren" @click="kopiere(angefordert)">⧉</button>
      </div>

      <table v-if="anforderungen.length" class="grid anforderungen" style="width:auto;margin-top:8px"><thead><tr>
        <th>Id</th><th title="Art">⚷</th><th title="Token je Woche">▤</th><th title="Token je Monat">▦</th><th title="Tage">◷</th><th>erstellt</th><th>Stand</th><th></th>
      </tr></thead><tbody>
        <tr v-for="a in anforderungen" :key="a.id">
          <td class="mono">{{ a.id }}</td><td :title="a.kind">{{ art(a.kind) }}</td>
          <td class="mono">{{ a.kind === 'limit' ? zahl(a.week) : '' }}</td><td class="mono">{{ a.kind === 'limit' ? zahl(a.month) : '' }}</td>
          <td class="mono">{{ a.kind === 'limit' ? a.days : '' }}</td>
          <td class="mono">{{ String(a.created).slice(0, 10) }}</td>
          <td><span v-if="a.team" class="pos" :title="'eingelöst für ' + a.teamLabel">✓ {{ a.teamLabel }}</span><span v-else class="muted" title="angefordert, noch nicht eingelöst">● offen</span></td>
          <td><button v-if="!a.team" class="x" title="Anforderung kopieren" @click="kopiere(a.text)">⧉</button></td>
        </tr>
      </tbody></table>

      <div v-if="eigenes" class="row einloesen" style="gap:6px;margin-top:8px;align-items:flex-start">
        <textarea v-model="schluessel" rows="3" style="width:100%;max-width:520px" placeholder='{"id":"k-…","kind":"…","request":"…",…}'></textarea>
        <button class="primary" :disabled="!schluessel.trim()" :title="'Schlüssel für ' + team.label + ' einlösen'" @click="einloesen">⚿ Einlösen · {{ team.label }}</button>
      </div>
      <div class="said-key" :class="saidKey.startsWith('✗') ? 'fehler' : 'muted'" style="font-size:12px;margin-top:4px">{{ saidKey }}</div>

      <table v-if="einloesungen.length" class="grid einloesungen" style="width:auto;margin-top:8px"><thead><tr>
        <th>Id</th><th title="Art">⚷</th><th>Team</th><th>ab</th><th>bis</th><th title="Tage aus einem laufenden Limit übernommen">+◷</th>
      </tr></thead><tbody>
        <tr v-for="e in einloesungen" :key="e.id">
          <td class="mono">{{ e.id }}</td><td :title="e.kind">{{ art(e.kind) }}</td><td>{{ e.teamLabel }}</td>
          <td class="mono">{{ e.from }}</td><td class="mono">{{ e.until ?? '' }}</td><td class="mono">{{ e.carried || '' }}</td>
        </tr>
      </tbody></table>
    </div>
  </div>
</template>
