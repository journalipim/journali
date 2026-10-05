<script setup>
// Teams verwalten (Recht users): anlegen, entfernen, Limits eintragen, wer für wen zahlt. Das gehört zu den Personen —
// wer im Team ist, was es verbraucht und welche Schlüssel es hat, steht auf der Teamseite.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { t as t_ } from '../i18n.js'

const teams = ref([])
const neu = ref('')
const neuManager = ref('')
const leute = ref([])
const lizenz = ref(null)
const n = x => x >= 2147483647 ? '∞' : (x ?? 0).toLocaleString('de-DE')   // Unlimited: keine Grenze
/// Was aus der Lizenz schon an Teams vergeben ist — sonst merkt niemand, dass die Summe darüber hinausgeht
const verteilt = computed(() => ({
  week: teams.value.reduce((a, t) => a + (t.entriesWeek ?? 0), 0),
  month: teams.value.reduce((a, t) => a + (t.entriesMonth ?? 0), 0),
}))
const zuviel = computed(() => (lizenz.value?.entriesWeek ?? 0) > 0 && (verteilt.value.week > lizenz.value.entriesWeek || verteilt.value.month > lizenz.value.entriesMonth))

async function load() {
  try { teams.value = await api.get('/api/teams') } catch (e) { store.toast(e.message) }
  try { leute.value = await api.get('/api/auth/people') } catch { leute.value = [] }
  try { lizenz.value = await api.get('/api/licence') } catch { lizenz.value = null }
}
onMounted(load)

async function speichern(t, feld, wert) {
  try { await api.post(`/api/teams/${encodeURIComponent(t.key)}`, { [feld]: wert }, 'PUT'); await load() }
  catch (e) { store.toast(e.message); await load() }
}
async function anlegen() {
  const k = (neu.value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  if (!k) { store.toast(t_('Kurzname fehlt')); return }
  if (!neuManager.value) { store.toast(t_('Wer führt das Team?')); return }
  try { await api.post(`/api/teams/${encodeURIComponent(k)}`, { label: neu.value.trim(), managers: [neuManager.value] }, 'PUT'); neu.value = ''; neuManager.value = ''; await load() }
  catch (e) { store.toast(e.message) }
}
/// Die Führung ändern — mehrere sind erlaubt, keiner nicht
function fuehrung(t, key, an) {
  const set = new Set(t.managers ?? []); an ? set.add(key) : set.delete(key)
  if (!set.size) { store.toast(t_('Mindestens einer führt das Team')); return }
  speichern(t, 'managers', [...set])
}
async function entfernen(t) {
  if (!await dialog.confirm({ title: `Team „${t.label}“ entfernen?`, text: t_('Der Verbrauch bleibt als Beleg stehen; die hinterlegten Schlüssel gehen weg.'), ok: t_('✕ Entfernen') })) return
  try { await api.del(`/api/teams/${encodeURIComponent(t.key)}`); await load() } catch (e) { store.toast(e.message) }
}
</script>

<template>
  <div class="section">
    <h2>{{ $t("◍ Teams") + ' ' }}<span class="muted" :title="store.startphase ? '' : $t('Die Limits kommen aus der Lizenz: das Init Team trägt sie, jedes weitere startet bei 0.')">· {{ teams.length }}</span></h2>
    <table class="grid" style="width:auto">
      <thead>
        <tr>
          <th>{{ $t("Team") }}</th>
          <th :title="$t('Wer das Team führt: Schlüssel, Modell, Mitglieder ein und aus')">{{ $t("★ Teammanager") }}</th>
          <th v-if="store.startphase" :title="$t('Woher die KI-Schlüssel kommen: eigene oder die eines anderen Teams')">{{ $t("KI-Schlüssel") }}</th>
          <th v-else :title="$t('Woher die Token kommen: eigenes Kontingent oder das eines anderen Teams')">{{ $t("Token") }}</th>
          <template v-if="!store.startphase">
          <th class="num" :title="$t('journali-Token je Woche — aus der Lizenz, hier nicht einstellbar')">{{ $t("▤ Woche ⊞") }}</th>
          <th class="num" :title="$t('journali-Token je Monat — aus der Lizenz, hier nicht einstellbar')">{{ $t("▦ Monat ⊞") }}</th>
          </template>
          <th>👤</th><th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in teams" :key="t.key" class="row">
          <td>
            <input type="text" :value="t.label" style="width:140px" @change="speichern(t, 'label', $event.target.value)" />
            <span class="mono muted" style="font-size:12px"> {{ t.key }}</span>
            <span v-if="t.primary" class="accent" :title="store.startphase ? $t('Init Team: bleibt') : $t('Init Team: bleibt, trägt die Limits der Lizenz')"> ①</span>
          </td>
          <td>
            <span v-for="m in (t.managers ?? [])" :key="m" class="chip" style="margin-right:4px">{{ leute.find(p => p.key === m)?.name || m }}
              <button class="x" :title="$t('Führung abgeben')" @click="fuehrung(t, m, false)">×</button>
            </span>
            <select value="" style="width:130px" :title="$t('jemanden zur Führung dazunehmen')" @change="fuehrung(t, $event.target.value, true); $event.target.value = ''">
              <option value="">+</option>
              <option v-for="p in leute.filter(p => !(t.managers ?? []).includes(p.key))" :key="p.key" :value="p.key">{{ p.name || p.key }}</option>
            </select>
          </td>
          <td>
            <select :value="t.keysFrom ?? ''" :disabled="t.keys.length > 0" :title="t.keys.length ? $t('eigene Schlüssel hinterlegt') : $t('woher die Token kommen')"
                    @change="speichern(t, 'keysFrom', $event.target.value)">
              <option value="">{{ store.startphase ? $t("eigene") : $t("eigenes Kontingent") }}</option>
              <option v-for="z in teams.filter(x => x.key !== t.key)" :key="z.key" :value="z.key">{{ $t("über Team {0}", [z.label]) }}</option>
            </select>
          </td>
          <template v-if="!store.startphase">
          <td class="num mono" :class="t.entriesWeek ? '' : 'muted'">{{ n(t.entriesWeek) }}</td>
          <td class="num mono" :class="t.entriesMonth ? '' : 'muted'">{{ n(t.entriesMonth) }}</td>
          </template>
          <td class="muted" :title="$t('{0} im Team', [t.members])">{{ t.members }}</td>
          <td><button v-if="!t.primary" class="x" :title="$t('Team entfernen')" @click="entfernen(t)">✕</button></td>
        </tr>
        <tr>
          <td><input v-model="neu" type="text" :placeholder="$t('neues Team')" style="width:140px" @keydown.enter="anlegen" /></td>
          <td>
            <select v-model="neuManager" style="width:130px" :title="$t('Wer führt es? Notfalls du selbst.')">
              <option value="">{{ $t("— Teammanager —") }}</option>
              <option v-for="p in leute" :key="p.key" :value="p.key">{{ p.name || p.key }}</option>
            </select>
          </td>
          <td :colspan="store.startphase ? 3 : 5"><button class="x" :title="$t('Team anlegen')" @click="anlegen">+</button></td>
        </tr>
      </tbody>
    </table>
    <div v-if="lizenz && !store.startphase" style="display:flex;gap:16px;align-items:baseline;margin-top:6px;font-size:12px">
      <span class="muted">{{ $t("aus der Lizenz vergeben") }}</span>
      <span class="mono" :class="zuviel ? 'neg' : ''" :title="$t('Summe der Kontingente aller Teams gegen die Lizenz')">▤ {{ n(verteilt.week) }} / {{ n(lizenz.entriesWeek) }} ⊞</span>
      <span class="mono" :class="zuviel ? 'neg' : ''">▦ {{ n(verteilt.month) }} / {{ n(lizenz.entriesMonth) }} ⊞</span>
    </div>
  </div>
</template>
