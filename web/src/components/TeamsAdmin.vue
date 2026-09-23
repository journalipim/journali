<script setup>
// Teams verwalten (Recht users): anlegen, entfernen, Grundkontingent, wer für wen zahlt. Das gehört zu den Personen —
// wer im Team ist, was es verbraucht und welche Schlüssel es hat, steht auf der Teamseite (Taloan, 23.09.2026:
// „Teams anlegen kann man hier aber nicht“).
import { ref, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'

const teams = ref([])
const neu = ref('')

async function load() { try { teams.value = await api.get('/api/teams') } catch (e) { store.toast(e.message) } }
onMounted(load)
const zahl = n => (n ?? 0).toLocaleString('de-DE')

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
</script>

<template>
  <div class="section">
    <h2>👥 Teams <span class="muted">· {{ teams.length }}</span></h2>
    <table class="grid" style="width:auto">
      <thead>
        <tr>
          <th>Team</th>
          <th title="Eigene Schlüssel = eigene Rechnung; ohne eigene zahlt ein anderes Team">zahlt</th>
          <th title="Grundkontingent je Monat — nur am ersten Team">◷ inklusive</th>
          <th title="Warnschwelle je Monat: zeigt und warnt, sperrt nicht">⚠ Monat</th>
          <th title="Reissleine je Tag: hier wird abgewiesen">⛔ Tag</th>
          <th>👤</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in teams" :key="t.key" class="row">
          <td>
            <input type="text" :value="t.label" style="width:140px" @change="speichern(t, 'label', $event.target.value)" />
            <span class="mono muted" style="font-size:12px"> {{ t.key }}</span>
            <span v-if="t.primary" class="accent" title="Team 1: hier hängt das Grundkontingent, und hierher fällt, wer kein eigenes Team hat"> ①</span>
          </td>
          <td>
            <select :value="t.keysFrom ?? ''" :disabled="t.keys.length > 0" :title="t.keys.length ? 'eigene Schlüssel — es zahlt selbst' : 'welches Team die Schlüssel stellt'"
                    @change="speichern(t, 'keysFrom', $event.target.value)">
              <option value="">selbst</option>
              <option v-for="z in teams.filter(x => x.key !== t.key && !x.keysFrom)" :key="z.key" :value="z.key">↑ {{ z.label }}</option>
            </select>
          </td>
          <td>
            <input v-if="t.primary" type="number" min="0" :value="t.includedTokens" style="width:90px" @change="speichern(t, 'includedTokens', Number($event.target.value))" />
            <span v-else class="muted" title="Das Grundkontingent gibt es einmal, am ersten Team">–</span>
          </td>
          <td><input type="number" min="0" :value="t.monthlyTokens" style="width:90px" @change="speichern(t, 'monthlyTokens', Number($event.target.value))" /></td>
          <td><input type="number" min="0" :value="t.dailyTokens" style="width:90px" @change="speichern(t, 'dailyTokens', Number($event.target.value))" /></td>
          <td class="muted" :title="`${t.members} im Team · ${zahl(t.month)} Token diesen Monat`">{{ t.members }}</td>
          <td><button v-if="!t.primary" class="x" title="Team entfernen" @click="entfernen(t)">✕</button></td>
        </tr>
        <tr>
          <td><input v-model="neu" type="text" placeholder="neues Team" style="width:140px"
                     title="Eigene Schlüssel = eigene Rechnung. Ohne eigene zahlt ein anderes Team; das Grundkontingent bleibt bei Team 1."
                     @keydown.enter="anlegen" /></td>
          <td colspan="6"><button class="x" title="Team anlegen" @click="anlegen">+</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
