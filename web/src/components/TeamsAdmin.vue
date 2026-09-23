<script setup>
// Teams verwalten (Recht users): anlegen, entfernen, Limits eintragen, wer für wen zahlt. Das gehört zu den Personen —
// wer im Team ist, was es verbraucht und welche Schlüssel es hat, steht auf der Teamseite (Taloan, 23.09.2026:
// „Teams anlegen kann man hier aber nicht“).
import { ref, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'

const teams = ref([])
const neu = ref('')
const neuManager = ref('')
const leute = ref([])

async function load() {
  try { teams.value = await api.get('/api/teams') } catch (e) { store.toast(e.message) }
  try { leute.value = await api.get('/api/auth/people') } catch { leute.value = [] }
}
onMounted(load)

async function speichern(t, feld, wert) {
  try { await api.post(`/api/teams/${encodeURIComponent(t.key)}`, { [feld]: wert }, 'PUT'); await load() }
  catch (e) { store.toast(e.message); await load() }
}
async function anlegen() {
  const k = (neu.value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  if (!k) { store.toast('Kurzname fehlt'); return }
  if (!neuManager.value) { store.toast('Wer führt das Team?'); return }
  try { await api.post(`/api/teams/${encodeURIComponent(k)}`, { label: neu.value.trim(), managers: [neuManager.value] }, 'PUT'); neu.value = ''; neuManager.value = ''; await load() }
  catch (e) { store.toast(e.message) }
}
/// Die Führung ändern — mehrere sind erlaubt, keiner nicht
function fuehrung(t, key, an) {
  const set = new Set(t.managers ?? []); an ? set.add(key) : set.delete(key)
  if (!set.size) { store.toast('Mindestens einer führt das Team'); return }
  speichern(t, 'managers', [...set])
}
async function entfernen(t) {
  if (!await dialog.confirm({ title: `Team „${t.label}“ entfernen?`, text: 'Der Verbrauch bleibt als Beleg stehen; die hinterlegten Schlüssel gehen weg.', ok: '✕ Entfernen' })) return
  try { await api.del(`/api/teams/${encodeURIComponent(t.key)}`); await load() } catch (e) { store.toast(e.message) }
}
</script>

<template>
  <div class="section">
    <h2>◍ Teams <span class="muted" title="Die Limits kommen aus der Lizenz: das Init Team trägt sie, jedes weitere startet bei 0.">· {{ teams.length }}</span></h2>
    <table class="grid" style="width:auto">
      <thead>
        <tr>
          <th>Team</th>
          <th title="Wer das Team führt: Schlüssel, Modell, Mitglieder ein und aus">★ Führung</th>
          <th title="Woher die Token kommen: eigenes Kontingent oder das eines anderen Teams">Token</th>
          <th title="journali-Token je Woche — aus der Lizenz">▤ Woche</th>
          <th title="journali-Token je Monat — aus der Lizenz">▦ Monat</th>
          <th>👤</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in teams" :key="t.key" class="row">
          <td>
            <input type="text" :value="t.label" style="width:140px" @change="speichern(t, 'label', $event.target.value)" />
            <span class="mono muted" style="font-size:12px"> {{ t.key }}</span>
            <span v-if="t.primary" class="accent" title="Init Team: bleibt, trägt die Limits der Lizenz"> ①</span>
          </td>
          <td>
            <span v-for="m in (t.managers ?? [])" :key="m" class="chip" style="margin-right:4px">{{ leute.find(p => p.key === m)?.name || m }}
              <button class="x" title="Führung abgeben" @click="fuehrung(t, m, false)">×</button>
            </span>
            <select value="" style="width:130px" title="jemanden zur Führung dazunehmen" @change="fuehrung(t, $event.target.value, true); $event.target.value = ''">
              <option value="">+</option>
              <option v-for="p in leute.filter(p => !(t.managers ?? []).includes(p.key))" :key="p.key" :value="p.key">{{ p.name || p.key }}</option>
            </select>
          </td>
          <td>
            <select :value="t.keysFrom ?? ''" :disabled="t.keys.length > 0" :title="t.keys.length ? 'eigene Schlüssel hinterlegt' : 'woher die Token kommen'"
                    @change="speichern(t, 'keysFrom', $event.target.value)">
              <option value="">eigenes Kontingent</option>
              <option v-for="z in teams.filter(x => x.key !== t.key && !x.keysFrom)" :key="z.key" :value="z.key">über Team {{ z.label }}</option>
            </select>
          </td>
          <td><input type="number" min="0" :value="t.entriesWeek" style="width:80px" @change="speichern(t, 'entriesWeek', Number($event.target.value))" /></td>
          <td><input type="number" min="0" :value="t.entriesMonth" style="width:80px" @change="speichern(t, 'entriesMonth', Number($event.target.value))" /></td>
          <td class="muted" :title="`${t.members} im Team`">{{ t.members }}</td>
          <td><button v-if="!t.primary" class="x" title="Team entfernen" @click="entfernen(t)">✕</button></td>
        </tr>
        <tr>
          <td><input v-model="neu" type="text" placeholder="neues Team" style="width:140px" @keydown.enter="anlegen" /></td>
          <td>
            <select v-model="neuManager" style="width:130px" title="Wer führt es? Notfalls du selbst.">
              <option value="">— Führung —</option>
              <option v-for="p in leute" :key="p.key" :value="p.key">{{ p.name || p.key }}</option>
            </select>
          </td>
          <td colspan="5"><button class="x" title="Team anlegen" @click="anlegen">+</button></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
