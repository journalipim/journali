<script setup>
// Die Teamseite (Taloan, 23.09.2026: „auf der Teamseite sehe ich alles, was zu meinem Team gehört, wer alles zu meinem Team
// gehört; wenn ich der Teamadministrator bin, kann ich da auch die API-Schlüssel eingeben“). Ein Team ist eine Gruppe von
// Personen, die am Gesamtsystem mitarbeitet — hier steht, wer dazugehört, womit die Gruppe arbeitet und was sie verbraucht.
// Teams anlegen und entfernen gehört nicht hierher, sondern zu den Personen (👤 Benutzer & Rollen).
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import UsageBars from './UsageBars.vue'

const teams = ref([])
const gewaehlt = ref(null)     // gezeigtes Team; mit „users“ lässt sich wechseln
const mitglieder = ref([])
const tokens = ref([])
const tage = ref([])
const anhaengsel = ref([])     // Teams, die auf diese Rechnung gehen
const keyIn = ref({ anbieter: 'anthropic', wert: '' })
const frei = ref([])           // wer in keinem Team ist — nur die lassen sich eintragen
const dazu = ref('')
const MODELLE = {
  anthropic: ['claude-sonnet-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-haiku-4-5'],
  openai: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
}
const usage = ref(null), usageHist = ref([]), usagePeriod = ref('day'), usageBusy = ref(false)
const ANBIETER = [['anthropic', 'Anthropic'], ['openai', 'OpenAI']]

const team = computed(() => teams.value.find(t => t.key === gewaehlt.value) ?? null)
/// Das Team führen: Schlüssel, Modell, Mitglieder ein und aus. Der Administrator darf es überall.
const fuehrt = computed(() => store.can('users') || (store.can('team') && (team.value?.managers ?? []).includes(store.auth.user)))
/// Woher die Token kommen: eigener Schlüssel = eigene Rechnung; sonst das Grundrauschen der Lizenz
const lizenz = ref(null)
const zahl = n => (n ?? 0).toLocaleString('de-DE')

async function load() {
  try {
    teams.value = await api.get('/api/teams')
    if (!teams.value.some(t => t.key === gewaehlt.value)) gewaehlt.value = teams.value[0]?.key ?? null
    await details()
  } catch (e) { store.toast(e.message) }
}
async function details() {
  const k = gewaehlt.value; if (!k) return
  const p = encodeURIComponent(k)
  try { mitglieder.value = await api.get(`/api/teams/${p}/members`) } catch { mitglieder.value = [] }
  try { tokens.value = await api.get(`/api/teams/${p}/tokens`) } catch { tokens.value = [] }
  try { const u = await api.get(`/api/teams/${p}/usage?days=14`); tage.value = u.days ?? []; anhaengsel.value = u.dependents ?? [] } catch { tage.value = []; anhaengsel.value = [] }
  try { frei.value = await api.get('/api/teams/free') } catch { frei.value = [] }
  try { lizenz.value = await api.get('/api/licence') } catch { lizenz.value = null }
}
async function ladeNutzung(period = usagePeriod.value) {
  usagePeriod.value = period; usageBusy.value = true
  try { const u = await api.get(`/api/usage?history=${period}&limit=${period === 'day' ? 30 : period === 'week' ? 26 : 24}`); usage.value = u; usageHist.value = u.history ?? [] }
  catch (e) { store.toast(e.message) }
  finally { usageBusy.value = false }
}
onMounted(async () => { await load(); await ladeNutzung() })

async function schluessel() {
  if (!keyIn.value.wert) { store.toast('Schlüssel fehlt'); return }
  const anbieter = keyIn.value.anbieter
  try {
    await api.post(`/api/teams/${encodeURIComponent(gewaehlt.value)}/keys`, { keys: { [anbieter]: keyIn.value.wert } }, 'PUT')
    keyIn.value = { anbieter, wert: '' }
    await load(); store.toast(`Schlüssel für ${anbieter} liegt beim Server`, 'ok')
  } catch (e) { store.toast(e.message) }
}
async function schluesselWeg(anbieter) {
  if (!await dialog.confirm({ title: `Schlüssel ${anbieter} entfernen?`, text: `Ohne ihn arbeitet „${team.value.label}“ nicht mehr über diesen Anbieter.`, ok: '✕ Entfernen' })) return
  try { await api.post(`/api/teams/${encodeURIComponent(gewaehlt.value)}/keys`, { keys: { [anbieter]: '' } }, 'PUT'); await load() } catch (e) { store.toast(e.message) }
}
/// Was zählt und was nicht (Taloan, 23.09.2026). Die Liste kommt aus dem Code: gezählt wird jeder Aufruf über
/// POST /api/ai/ask — Ein- und Ausgabe-Token, wie der Anbieter sie meldet.
function hilfeTokens() {
  dialog.help({
    title: '✦ Token-Verbrauch',
    rows: [
      ['Gezählt wird', ''],
      ['Editor', 'überarbeiten, erzeugen, eigene Anweisung'],
      ['Übersetzung', 'KI-Vorübersetzung je Einheit'],
      ['Klassifikation', 'ETIM-Klasse vorschlagen, Merkmale zuordnen'],
      ['Prüfung', 'Sonderregelungen und Vorschriften recherchieren'],
      ['Geodaten', 'Herkunft und Zolltarif vorschlagen'],
      ['Recherche', 'Suche im Internet — je Suche berechnet der Anbieter zusätzlich'],
      ['Nicht gezählt', ''],
      ['Ansehen', 'Baum, Knoten, Journal, Verlauf'],
      ['Pflege', 'Werte setzen, Knoten anlegen, Freigaben, Workflows'],
      ['Regeln', 'Prüfungen und Ableitungen ohne KI'],
      ['Import, Export', 'Tabellen, XLIFF, Datenblätter, Sicherungen'],
      ['Fehlschlag', 'eine abgewiesene Anfrage kostet nichts'],
    ],
  })
}

async function modell(anbieter, wert) {
  try { await api.post(`/api/teams/${encodeURIComponent(gewaehlt.value)}`, { models: { [anbieter]: wert } }, 'PUT'); await load() } catch (e) { store.toast(e.message) }
}
async function eintragen() {
  if (!dazu.value) return
  try { await api.post(`/api/teams/${encodeURIComponent(gewaehlt.value)}/members/${encodeURIComponent(dazu.value)}`, {}); dazu.value = ''; await details() }
  catch (e) { store.toast(e.message) }
}
async function austragen(m) {
  if (!await dialog.confirm({ title: `${m.name || m.key} austragen?`, text: 'Danach ist die Person in keinem Team — ohne Schlüssel, ohne Kontingent.', ok: '✕ Austragen' })) return
  try { await api.del(`/api/teams/${encodeURIComponent(gewaehlt.value)}/members/${encodeURIComponent(m.key)}`); await details() } catch (e) { store.toast(e.message) }
}
async function widerrufen(tok) {
  if (!await dialog.confirm({ title: `Token „${tok.label}“ von ${tok.user} widerrufen?`, text: 'Wer damit arbeitet, kommt sofort nicht mehr herein.', ok: '✕ Widerrufen' })) return
  try { await api.del(`/api/teams/${encodeURIComponent(gewaehlt.value)}/tokens/${encodeURIComponent(tok.id)}`); await details() } catch (e) { store.toast(e.message) }
}
</script>

<template>
  <div v-if="!team" class="section muted">kein Team</div>
  <template v-else>
    <div class="section">
      <h2>👥 {{ team.label }}
        <span class="muted">· {{ mitglieder.length }}<span v-if="team.primary" class="accent" title="Init Team: bleibt, trägt das Grundkontingent"> ①</span></span>
        <select v-if="teams.length > 1" v-model="gewaehlt" style="margin-left:8px" @change="details">
          <option v-for="t in teams" :key="t.key" :value="t.key">{{ t.label }}</option>
        </select>
      </h2>
      <table class="grid" style="width:auto">
        <thead><tr><th>Person</th><th>Rolle</th><th>zuletzt</th><th></th></tr></thead>
        <tbody>
          <tr v-for="m in mitglieder" :key="m.key" class="row">
            <td>{{ m.name || m.key }} <span class="mono muted" style="font-size:12px">{{ m.key }}</span>
              <span v-if="(team.managers ?? []).includes(m.key)" class="accent" title="führt dieses Team">★</span>
              <span v-if="!m.enabled" class="neg" title="gesperrt">⊘</span></td>
            <td class="muted">{{ m.role }}</td>
            <td class="muted">{{ m.lastAt ? new Date(m.lastAt).toLocaleDateString() : '' }}</td>
            <td><button v-if="fuehrt && !(team.managers ?? []).includes(m.key)" class="x" title="aus dem Team austragen" @click="austragen(m)">✕</button></td>
          </tr>
          <tr v-if="!mitglieder.length"><td colspan="4" class="muted">niemand</td></tr>
          <tr v-if="fuehrt">
            <td colspan="4" class="row" style="gap:6px">
              <select v-model="dazu" style="width:200px" title="Eintragen lässt sich nur, wer in keinem Team ist">
                <option value="">—</option>
                <option v-for="f in frei" :key="f.key" :value="f.key">{{ f.name || f.key }} · {{ f.role }}</option>
              </select>
              <button class="x" title="in das Team eintragen" :disabled="!dazu" @click="eintragen">+</button>
              <span v-if="!frei.length" class="muted" style="font-size:12px" title="Wer wechseln soll, wird erst in seinem Team ausgetragen">niemand teamlos</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>✦ KI-Zugang <span class="muted">· womit dieses Team arbeitet</span></h2>
      <table class="grid form" style="width:auto"><colgroup><col style="width:150px" /><col style="width:320px" /><col /></colgroup><tbody>
        <tr>
          <td class="muted">Schlüssel</td>
          <td>
            <span v-for="k in team.keys" :key="k" class="chip" style="margin-right:4px">{{ k }}
              <button v-if="fuehrt" class="x" title="Schlüssel entfernen" @click="schluesselWeg(k)">×</button>
            </span>
            <span v-if="!team.keys.length && team.keysFrom" class="muted" :title="`zahlt über ${team.keysFrom}`">↑ {{ team.keysFrom }}</span>
            <span v-else-if="!team.keys.length" class="neg" title="ohne Schlüssel keine KI über den Server">—</span>
          </td>
          <td v-if="fuehrt" class="row" style="gap:4px">
            <select v-model="keyIn.anbieter" style="width:110px"><option v-for="[k, l] in ANBIETER" :key="k" :value="k">{{ l }}</option></select>
            <input v-model="keyIn.wert" type="password" placeholder="Schlüssel" style="width:150px" @keydown.enter="schluessel" />
            <button class="x" title="Schlüssel hinterlegen — er bleibt beim Server, nie im Journal, nie im Browser" @click="schluessel">🔒</button>
          </td><td v-else></td>
        </tr>
        <tr v-for="k in team.keys" :key="'m' + k">
          <td class="muted" :title="`welches Modell ${k} fragt — es bestimmt Kosten und Güte`">Modell {{ k }}</td>
          <td>
            <select :value="team.models?.[k] ?? ''" :disabled="!fuehrt" style="width:220px" @change="modell(k, $event.target.value)">
              <option value="">— Vorgabe —</option>
              <option v-for="m in (MODELLE[k] ?? [])" :key="m" :value="m">{{ m }}</option>
            </select>
          </td><td></td>
        </tr>
      </tbody></table>
    </div>

    <div class="section">
      <h2>✦ journali PIM Token
        <span class="muted">· {{ zahl(team.month) }} diesen Monat · heute {{ zahl(team.today) }}</span>
        <button class="x" title="Was in die Rechnung eingeht" @click="hilfeTokens">?</button>
      </h2>
      <table class="grid form" style="width:auto"><colgroup><col style="width:150px" /><col style="width:320px" /><col /></colgroup><tbody>
        <tr>
          <td class="muted" title="Wie der Verbrauch angerechnet wird">Abrechnung</td>
          <td>
            <span v-if="team.keys.length" class="pos">eigenes Kontingent</span>
            <span v-else-if="team.keysFrom" class="muted">über Team {{ team.keysFrom }}</span>
            <span v-else-if="lizenz?.aiTokensMonth" class="muted">Grundrauschen der Lizenz</span>
            <span v-else class="neg">kein Kontingent</span>
          </td>
          <td class="muted" style="font-size:12px">
            <span v-if="!team.keys.length && lizenz?.aiTokensMonth">{{ zahl(lizenz.aiTokensMonth) }} / Monat für die ganze Anlage</span>
            <span v-else-if="team.keys.length">Rechnung beim Anbieter</span>
          </td>
        </tr>
      </tbody></table>
      <table v-if="tage.length" class="grid" style="width:auto;margin-top:6px">
        <thead><tr><th>Tag</th><th>✦ Token</th><th>Aufrufe</th><th>je Anbieter</th><th>je Person</th></tr></thead>
        <tbody>
          <tr v-for="d in tage" :key="d.day" class="row">
            <td class="mono">{{ d.day }}</td><td class="mono">{{ zahl(d.tokens) }}</td><td class="muted">{{ d.calls }}</td>
            <td class="muted">{{ Object.entries(d.byProvider ?? {}).map(([k, v]) => `${k} ${zahl(v)}`).join(' · ') }}</td>
            <td class="muted">{{ Object.entries(d.byUser ?? {}).map(([k, v]) => `${k} ${zahl(v)}`).join(' · ') }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="anhaengsel.length" class="muted" style="font-size:12px;margin-top:4px">auf diese Rechnung: {{ anhaengsel.join(', ') }}</div>
    </div>

    <div class="section">
      <h2>🔑 API-Token <span class="muted" title="Ein Token arbeitet mit den Rechten seiner Person und auf die Rechnung dieses Teams.">· {{ tokens.length }}</span></h2>
      <table class="grid" style="width:auto">
        <thead><tr><th>Token</th><th>Person</th><th>angelegt</th><th></th></tr></thead>
        <tbody>
          <tr v-for="t in tokens" :key="t.id" class="row">
            <td>{{ t.label }} <span class="mono muted" style="font-size:12px">{{ t.id }}</span></td>
            <td class="mono">{{ t.user }}</td>
            <td class="muted">{{ new Date(t.at).toLocaleDateString() }}</td>
            <td><button v-if="fuehrt" class="x" title="Token widerrufen" @click="widerrufen(t)">×</button></td>
          </tr>
          <tr v-if="!tokens.length"><td colspan="4" class="muted">keine</td></tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>◷ Nutzung <span class="muted">· Einträge im Journal</span></h2>
      <UsageBars :usage="usage" :history="usageHist" :period="usagePeriod" :busy="usageBusy" @period="ladeNutzung" />
    </div>
  </template>
</template>
