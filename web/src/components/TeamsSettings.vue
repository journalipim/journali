<script setup>
// Die Teamseite (Taloan, 23.09.2026: „auf der Teamseite sehe ich alles, was zu meinem Team gehört, wer alles zu meinem Team
// gehört; wenn ich der Teamadministrator bin, kann ich da auch die API-Schlüssel eingeben“). Ein Team ist eine Gruppe von
// Personen, die am Gesamtsystem mitarbeitet — hier steht, wer dazugehört, womit die Gruppe arbeitet und was sie verbraucht.
// Teams anlegen und entfernen gehört nicht hierher, sondern zu den Personen (👤 Anwender & Rollen).
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import UsageBars from './UsageBars.vue'
import LicenceSettings from './LicenceSettings.vue'

const teams = ref([])
const gewaehlt = ref(null)     // gezeigtes Team; mit „users“ lässt sich wechseln
const mitglieder = ref([])
const keyIn = ref({ anbieter: 'anthropic', wert: '' })
const frei = ref([])           // wer in keinem Team ist — nur die lassen sich eintragen
const dazu = ref('')
const MODELLE = {
  anthropic: ['claude-sonnet-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-haiku-4-5'],
  openai: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
}
const jt = ref(null)   // journali-Token dieses Teams: Limits und Verbrauch
const ANBIETER = [['anthropic', 'Anthropic'], ['openai', 'OpenAI']]

const team = computed(() => teams.value.find(t => t.key === gewaehlt.value) ?? null)
/// Das Team führen: Schlüssel, Modell, Mitglieder ein und aus. Der Administrator darf es überall.
const fuehrt = computed(() => store.can('users') || (store.can('team') && (team.value?.managers ?? []).includes(store.auth.user)))
/// Wessen Schlüssel das Team benutzt — eigener oder der eines anderen Teams
const lizenz = ref(null)
const zahl = n => (n ?? 0).toLocaleString('de-DE')
/// Anteil am Limit — 0 heisst: nichts zugeteilt, dann gibt es auch keinen Anteil
/// Was UsageBars zeigt: die Zahlen dieses Teams gegen seine Limits — nicht die der ganzen Anlage
const teamUsage = computed(() => jt.value && {
  week: { used: jt.value.used?.week ?? 0, max: jt.value.limits?.week ?? 0 },
  month: { used: jt.value.used?.month ?? 0, max: jt.value.limits?.month ?? 0 },
  day: { used: jt.value.used?.day ?? 0 },
})
const anteilJt = zeitraum => {
  const grenze = jt.value?.limits?.[zeitraum] ?? 0
  return grenze ? Math.round(((jt.value?.used?.[zeitraum] ?? 0) / grenze) * 100) : 0
}

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
  try { frei.value = await api.get('/api/teams/free') } catch { frei.value = [] }
  try { lizenz.value = await api.get('/api/licence') } catch { lizenz.value = null }
  try { jt.value = await api.get(`/api/teams/${p}/tokens/journali`) } catch { jt.value = null }
}
onMounted(load)

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
async function modell(anbieter, wert) {
  try { await api.post(`/api/teams/${encodeURIComponent(gewaehlt.value)}`, { models: { [anbieter]: wert } }, 'PUT'); await load() } catch (e) { store.toast(e.message) }
}
/// Was auf die Limits geht und was nicht — die Liste ist Kinds.Counts im Kern (data, publish)
function hilfeToken() {
  dialog.help({
    title: '✦ journali PIM Token',
    rows: [
      ['Gezählt', ''],
      ['Datenpflege', 'Werte, Zeilen, Artikel und Varianten, Status, Kennungen, Medien, Relationen'],
      ['Ausleitung', 'Freigaben, Versionen, Workflow-Zustände, Übersetzungsschritte'],
      ['Nicht gezählt', ''],
      ['Modell', 'Attribute, Gruppen, Sichten, Listen, Sprachen, Kanäle, Einheiten, Wörterbuch'],
      ['Struktur', 'Baum anlegen, umhängen, ordnen, benennen, Achsen und Gruppen'],
      ['Referenzdaten', 'Kataloge wie ETIM und ihre Wertelisten'],
      ['Einrichtung', 'Plugins, Anwender, Rollen, Jobdefinitionen'],
      ['Betrieb', 'Jobläufe mit Protokoll, gerechnete Vorschauen'],
      ['Ohne Eintrag', 'Ansehen, Suchen, Exportieren'],
    ],
  })
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
</script>

<template>
  <div v-if="!team" class="section muted">kein Team</div>
  <template v-else>
    <div class="section">
      <h2>◍ {{ team.label }}
        <span class="muted">· {{ mitglieder.length }}<span v-if="team.primary" class="accent" title="Init Team: bleibt, trägt die Limits der Lizenz"> ①</span></span>
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
      <h2>✧ KI <span class="muted">· Zugang dieses Teams</span></h2>
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
      <table class="grid form" style="width:auto"><colgroup><col style="width:150px" /><col style="width:320px" /><col /></colgroup><tbody>
        <tr>
          <td class="muted" title="Wessen Schlüssel dieses Team benutzt">Schlüssel von</td>
          <td>
            <span v-if="team.keys.length" class="pos">diesem Team</span>
            <span v-else-if="team.keysFrom" class="muted">Team {{ team.keysFrom }}</span>
            <span v-else class="neg">keiner hinterlegt</span>
          </td><td></td>
        </tr>
      </tbody></table>
    </div>


    <div class="section">
      <h2>✦ journali PIM Token
        <span class="muted" title="Jede Pflege schreibt einen Eintrag ins Journal; Ansehen und Exportieren zählen nicht mit.">· Nutzung gegen die Limits</span>
        <button class="x" title="Was auf die Limits geht" @click="hilfeToken">?</button>
      </h2>
      <table class="grid form" style="width:auto"><colgroup><col style="width:150px" /><col style="width:320px" /><col /></colgroup><tbody>
        <tr>
          <td class="muted" title="Limits dieses Teams — der Administrator verteilt sie aus der Lizenz">Limit</td>
          <td class="mono">
            <span :class="jt?.limits?.week ? '' : 'muted'">▤ {{ zahl(jt?.limits?.week) }} / Woche</span> ·
            <span :class="jt?.limits?.month ? '' : 'muted'">▦ {{ zahl(jt?.limits?.month) }} / Monat</span>
          </td>
          <td class="muted" style="font-size:12px"><span v-if="!jt?.limits?.week && !jt?.limits?.month">nichts zugeteilt</span></td>
        </tr>
        <tr>
          <td class="muted" title="Was die Mitglieder verbraucht haben; rechnet das Team über ein anderes ab, zählt alles dort zusammen">Verbraucht</td>
          <td class="mono">
            <span :class="anteilJt('week') >= 100 ? 'neg' : anteilJt('week') >= 80 ? 'warn' : ''">▤ {{ zahl(jt?.used?.week) }}</span> ·
            <span :class="anteilJt('month') >= 100 ? 'neg' : anteilJt('month') >= 80 ? 'warn' : ''">▦ {{ zahl(jt?.used?.month) }}</span> ·
            heute {{ zahl(jt?.used?.day) }}
          </td>
          <td class="muted" style="font-size:12px">
            <span v-if="jt && jt.payer !== jt.team">über {{ jt.payerLabel }} · eigener Anteil ▦ {{ zahl(jt.mine?.month) }}</span>
          </td>
        </tr>
      </tbody></table>
      <UsageBars v-if="jt" :usage="teamUsage" />
    </div>

    <LicenceSettings />
  </template>
</template>
