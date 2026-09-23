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
const tage = ref([])   // KI-Austauschvolumen je Tag — was journali hingeschickt und zurückbekommen hat
const kb = b => {
  const z = (x, e) => (x / e).toLocaleString('de-DE', { maximumFractionDigits: 1 })
  return !b ? '0KB' : b >= 1073741824 ? z(b, 1073741824) + 'GB' : b >= 1048576 ? z(b, 1048576) + 'MB' : Math.max(1, Math.round(b / 1024)) + 'KB'
}
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

/// Was noch zur Verfügung steht — nie unter 0
const rest = zeitraum => Math.max(0, (jt.value?.limits?.[zeitraum] ?? 0) - (jt.value?.used?.[zeitraum] ?? 0))
/// Viel verfügbar ist grün; wird es knapp, gelb; ist nichts mehr da, rot
const freiTon = zeitraum => {
  const grenze = jt.value?.limits?.[zeitraum] ?? 0
  if (!grenze) return 'muted'
  const anteil = Math.round((rest(zeitraum) / grenze) * 100)
  return anteil <= 10 ? 'neg' : anteil <= 30 ? 'warn' : 'pos'
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
  try { tage.value = (await api.get(`/api/teams/${p}/usage?days=14`)).days ?? [] } catch { tage.value = [] }
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
/// Was gezählt wird — die Vorgänge hinter Kinds.Counts im Kern (data, publish). Über Nichtgezähltes steht hier nichts.
function hilfeToken() {
  dialog.help({
    title: '✦ journali Limits · gezählt wird',
    rows: [
      ['Anlegen', 'Artikel, Varianten, Zeilen einer Mehrfachangabe, Assets, Relationen'],
      ['Ändern', 'jeder Wert, Status, Kennung, die Reihenfolge von Zeilen'],
      ['Zurückziehen', 'Artikel, Zeilen, Assets, Relationen — und das Zurückholen'],
      ['Einordnen', 'ein Asset in einen Ordner, eine Kennung an ein Fremdsystem'],
      ['Übernehmen', 'Import und Kopieren schreiben dieselben Einträge wie Handarbeit'],
      ['Freigeben', 'eine Freigabe erteilen, eine Freigabe zurücknehmen'],
      ['Versionieren', 'Version anlegen, Dokument anhängen, Version zurückziehen'],
      ['Workflow', 'einen Schritt setzen, eine Zuständigkeit vergeben'],
      ['Übersetzen', 'Auftrag hinaus, Rückläufer herein, Stand am Knoten markieren'],
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


    <LicenceSettings />

    <div class="section">
      <h2>✦ journali Limits
        <button class="x" title="Was gezählt wird" @click="hilfeToken">?</button>
      </h2>
      <table class="grid form" style="width:auto"><colgroup><col style="width:150px" /><col style="width:320px" /><col /></colgroup><tbody>
        <tr>
          <td class="muted" title="Was diesem Team in diesem Zeitraum noch zur Verfügung steht">Verfügbar</td>
          <td class="mono">
            <span :class="freiTon('week')">▤ {{ zahl(rest('week')) }} / Woche</span> ·
            <span :class="freiTon('month')">▦ {{ zahl(rest('month')) }} / Monat</span>
          </td>
          <td class="muted" style="font-size:12px"><span v-if="!jt?.limits?.week && !jt?.limits?.month">kein eigenes Kontingent</span></td>
        </tr>
        <tr>
          <td class="muted" title="Das Kontingent dieses Teams — der Administrator trägt es aus der Lizenz ein">Kontingent</td>
          <td class="mono muted">
            ▤ {{ zahl(jt?.limits?.week) }} / Woche · ▦ {{ zahl(jt?.limits?.month) }} / Monat
          </td>
          <td class="muted" style="font-size:12px">
            <span v-if="jt && jt.payer !== jt.team">gemeinsam mit {{ jt.payerLabel }} · eigener Anteil ▦ {{ zahl(jt.mine?.month) }}</span>
          </td>
        </tr>
        <tr>
          <td class="muted" title="Was die Mitglieder in diesem Zeitraum geschrieben haben">Genutzt</td>
          <td class="mono muted">
            ▤ {{ zahl(jt?.used?.week) }} · ▦ {{ zahl(jt?.used?.month) }} · heute {{ zahl(jt?.used?.day) }}
          </td>
          <td></td>
        </tr>
      </tbody></table>
      <UsageBars v-if="jt" :usage="teamUsage" />
    </div>

    <div class="section">
      <h2 title="Schlüssel und Modell dieses Teams; der Schlüssel bleibt beim Server.">✧ KI API Keys</h2>
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
      <h2 title="Was journali an den Anbieter geschickt und von ihm zurückbekommen hat; über Tokens und Kosten sagt journali nichts.">✧ KI Austauschvolumen</h2>
      <table v-if="tage.length" class="grid" style="width:auto"><thead><tr><th style="width:110px">Tag</th><th class="num" style="width:70px">Aufrufe</th><th class="num" style="width:90px" title="hingeschickt">↑ hin</th><th class="num" style="width:90px" title="zurückbekommen">↓ zurück</th><th class="num" style="width:90px">Σ</th><th>Anlass</th></tr></thead><tbody>
        <tr v-for="t in tage" :key="t.day" class="row">
          <td class="mono">{{ t.day }}</td>
          <td class="num mono">{{ t.calls }}</td>
          <td class="num mono">{{ kb(t.bytesIn) }}</td>
          <td class="num mono">{{ kb(t.bytesOut) }}</td>
          <td class="num mono">{{ kb(t.bytes) }}</td>
          <td class="muted" style="font-size:12px">{{ Object.entries(t.byPurpose ?? {}).map(([a, v]) => `${a} ${kb(v)}`).join(' · ') }}</td>
        </tr>
      </tbody></table>
      <div v-else class="muted" style="font-size:12px">noch nichts gemessen</div>
    </div>
  </template>
</template>
