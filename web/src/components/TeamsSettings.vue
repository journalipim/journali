<script setup>
// Teams (Taloan, 23.09.2026: „je Team gibt es Limits und API-Keys, Benutzer gehören einem Team an“): die Kostenstelle der KI.
// Wer „Benutzer und Rollen“ hat, sieht und pflegt alle; ein Team-Admin (Recht „team“) sein eigenes.
// Das Grundkontingent gibt es einmal — am ersten Team; jedes weitere bringt eigene Schlüssel mit oder hängt an einem Zahler.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'

const teams = ref([])
const usage = ref(null)        // { team, days[] } des aufgeklappten Teams
const offen = ref(null)        // Key des Teams, dessen Verbrauch gezeigt wird
const neu = ref('')
const keyIn = ref({})          // je Team { anbieter, wert }
const ANBIETER = [['anthropic', 'Anthropic'], ['openai', 'OpenAI']]
const darfAlles = computed(() => store.can('users'))

async function load() {
  try {
    teams.value = await api.get('/api/teams')
    // Eingabefelder je Team vorbereiten — im Template wird nichts angelegt (eine Zuweisung im v-model bricht das Zeichnen)
    keyIn.value = Object.fromEntries(teams.value.map(t => [t.key, keyIn.value[t.key] ?? { anbieter: 'anthropic', wert: '' }]))
  } catch (e) { store.toast(e.message) }
}
onMounted(load)

const zahl = n => (n ?? 0).toLocaleString('de-DE')
function anteil(t) { const g = t.includedTokens || t.monthlyTokens; return g ? Math.min(100, Math.round((t.month / g) * 100)) : null }

async function speichern(t, feld, wert) {
  try { await api.post(`/api/teams/${encodeURIComponent(t.key)}`, { [feld]: wert }, 'PUT'); await load() }
  catch (e) { store.toast(e.message); await load() }
}
async function anlegen() {
  const k = (neu.value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  if (!k) { store.toast('Kurzname fehlt'); return }
  try { await api.post(`/api/teams/${encodeURIComponent(k)}`, { label: neu.value.trim() }, 'PUT'); neu.value = ''; await load() }
  catch (e) { store.toast(e.message) }
}
async function entfernen(t) {
  if (!await dialog.confirm({ title: `Team „${t.label}“ entfernen?`, text: 'Der Verbrauch bleibt als Beleg stehen; die hinterlegten Schlüssel gehen weg.', ok: '✕ Entfernen' })) return
  try { await api.del(`/api/teams/${encodeURIComponent(t.key)}`); await load() } catch (e) { store.toast(e.message) }
}
async function schluessel(t) {
  const feld = keyIn.value[t.key] ?? {}
  if (!feld.anbieter || !feld.wert) { store.toast('Anbieter und Schlüssel'); return }
  try {
    await api.post(`/api/teams/${encodeURIComponent(t.key)}/keys`, { keys: { [feld.anbieter]: feld.wert } }, 'PUT')
    keyIn.value = { ...keyIn.value, [t.key]: { anbieter: feld.anbieter, wert: '' } }
    await load(); store.toast(`Schlüssel für ${feld.anbieter} hinterlegt — er bleibt beim Server`, 'ok')
  } catch (e) { store.toast(e.message) }
}
async function schluesselWeg(t, anbieter) {
  if (!await dialog.confirm({ title: `Schlüssel ${anbieter} entfernen?`, text: `„${t.label}“ kann dann keine KI mehr über diesen Anbieter.`, ok: '✕ Entfernen' })) return
  try { await api.post(`/api/teams/${encodeURIComponent(t.key)}/keys`, { keys: { [anbieter]: '' } }, 'PUT'); await load() } catch (e) { store.toast(e.message) }
}
async function verbrauch(t) {
  if (offen.value === t.key) { offen.value = null; usage.value = null; return }
  try { usage.value = await api.get(`/api/teams/${encodeURIComponent(t.key)}/usage?days=14`); offen.value = t.key } catch (e) { store.toast(e.message) }
}
</script>

<template>
  <table class="grid" style="width:auto">
    <thead>
      <tr>
        <th>Team</th><th title="Wer zahlt: eigene Schlüssel oder die eines anderen Teams">Schlüssel</th>
        <th title="Grundkontingent je Monat — gibt es nur am ersten Team">◷ inklusive</th>
        <th title="Warnschwelle je Monat: sie zeigt und warnt, sie sperrt nicht">⚠ Monat</th>
        <th title="Reissleine je Tag: hier wird abgewiesen. Hoch ansetzen — sie soll den Amoklauf stoppen, nicht die Arbeit">⛔ Tag</th>
        <th title="verbraucht diesen Monat">✦ Monat</th><th>👤</th><th></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="t in teams" :key="t.key" class="row">
        <td>
          <input v-if="darfAlles" type="text" :value="t.label" style="width:140px" @change="speichern(t, 'label', $event.target.value)" />
          <span v-else>{{ t.label }}</span>
          <span class="mono muted" style="font-size:12px"> {{ t.key }}</span>
          <span v-if="t.primary" class="accent" title="Team 1: hier hängt das Grundkontingent, und hierher fällt, wer kein Team hat"> ①</span>
        </td>
        <td>
          <span v-for="k in t.keys" :key="k" class="chip" style="margin-right:4px">{{ k }}
            <button class="x" title="Schlüssel entfernen" @click="schluesselWeg(t, k)">×</button>
          </span>
          <span v-if="!t.keys.length && t.keysFrom" class="muted" :title="`zahlt über das Team ${t.keysFrom}`">↑ {{ t.keysFrom }}</span>
          <span v-else-if="!t.keys.length" class="neg" title="Ohne Schlüssel gibt es für dieses Team keine KI über den Server">—</span>
          <select v-if="keyIn[t.key]" v-model="keyIn[t.key].anbieter" style="width:100px;margin-left:4px">
            <option v-for="[k, l] in ANBIETER" :key="k" :value="k">{{ l }}</option>
          </select>
          <input v-if="keyIn[t.key]" v-model="keyIn[t.key].wert" type="password" placeholder="Schlüssel" style="width:130px" @keydown.enter="schluessel(t)" />
          <button class="x" title="Schlüssel hinterlegen — er bleibt beim Server, nie im Journal, nie im Browser" @click="schluessel(t)">🔒</button>
        </td>
        <td>
          <input v-if="darfAlles && t.primary" type="number" min="0" :value="t.includedTokens" style="width:90px" @change="speichern(t, 'includedTokens', Number($event.target.value))" />
          <span v-else-if="t.includedTokens" class="mono">{{ zahl(t.includedTokens) }}</span>
          <span v-else class="muted" title="Das Grundkontingent gibt es einmal, am ersten Team — sonst wäre jedes neue Team ein neuer Freibetrag">–</span>
        </td>
        <td><input type="number" min="0" :value="t.monthlyTokens" style="width:90px" @change="speichern(t, 'monthlyTokens', Number($event.target.value))" /></td>
        <td><input type="number" min="0" :value="t.dailyTokens" style="width:90px" @change="speichern(t, 'dailyTokens', Number($event.target.value))" /></td>
        <td class="mono" :class="anteil(t) >= 100 ? 'neg' : anteil(t) >= 80 ? 'warn' : ''" :title="`heute ${zahl(t.today)} Token · ${t.calls} Aufrufe`">
          {{ zahl(t.month) }}<span v-if="anteil(t) !== null" class="muted"> · {{ anteil(t) }} %</span>
        </td>
        <td class="muted" :title="`${t.members} Person(en) in diesem Team`">{{ t.members }}</td>
        <td>
          <button class="x" title="Verbrauch der letzten 14 Tage" @click="verbrauch(t)">≡</button>
          <button v-if="darfAlles && !t.primary" class="x" title="Team entfernen" @click="entfernen(t)">✕</button>
        </td>
      </tr>
      <tr v-if="darfAlles">
        <td><input v-model="neu" type="text" placeholder="neues Team" style="width:140px"
                   title="Eigene Schlüssel = eigene Rechnung. Ohne eigene hängt es an einem Zahler; das Grundkontingent bleibt bei Team 1."
                   @keydown.enter="anlegen" /></td>
        <td colspan="7"><button class="x" title="Team anlegen" @click="anlegen">+</button></td>
      </tr>
    </tbody>
  </table>

  <div v-if="usage" style="margin-top:8px">
    <table class="grid" style="width:auto">
      <thead><tr><th>Tag</th><th>✦ Token</th><th>Aufrufe</th><th>je Anbieter</th><th>je Person</th></tr></thead>
      <tbody>
        <tr v-for="d in (usage.days ?? [])" :key="d.day" class="row">
          <td class="mono">{{ d.day }}</td>
          <td class="mono">{{ zahl(d.tokens) }}</td>
          <td class="muted">{{ d.calls }}</td>
          <td class="muted">{{ Object.entries(d.byProvider ?? {}).map(([k, v]) => `${k} ${zahl(v)}`).join(' · ') }}</td>
          <td class="muted">{{ Object.entries(d.byUser ?? {}).map(([k, v]) => `${k} ${zahl(v)}`).join(' · ') }}</td>
        </tr>
        <tr v-if="!(usage.days ?? []).length"><td colspan="5" class="muted">noch nichts verbraucht</td></tr>
      </tbody>
    </table>
    <div v-if="usage?.dependents?.length" class="muted" style="font-size:12px;margin-top:4px">
      Auf diese Rechnung gehen auch: {{ usage.dependents.join(', ') }}
    </div>
  </div>
</template>
