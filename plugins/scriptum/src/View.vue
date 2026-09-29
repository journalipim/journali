<script setup>
// ⌨ Skripte (docs/pflegestruktur.md 37): links die Liste, rechts das gewählte Skript — sein Formular, sein Lauf und
// sein Ergebnis. Der Quelltext steht im Journal und gehört dem Recht „Skripte schreiben“; wer nur ausführen darf,
// sieht Formular, ▶ und Ergebnis, nie den Quelltext.
//
// Gelaufen wird als Job: ▶ startet den Lauf (POST /api/scriptum/scripts/<key>/run) und fragt dann nach Stand und
// Ergebnis. Das Ergebnis ist eine Tabelle, ein Text oder eine Datei im Fach out/ des Laufs.
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api, store, plugins, Splitter, ScriptEditor, paneWidth } from 'journali'
import { t as t_ } from 'journali'
import { kopfLesen, paramsAus } from '../kopf.mjs'
import { refresh as refreshNodeScripts } from './nodescripts.js'
import { beispiele } from '../beispiele.mjs'
const listW = paneWidth('scriptum.list', 280)

const liste = ref([])
const cur = ref(null)            // das gewählte Skript, mit Quelltext wenn erlaubt
const busy = ref('')
const editor = ref(false)
const neu = ref('')
const werte = ref({})            // Werte des Formulars
const lauf = ref(null)           // { job, run, laeuft, status, ergebnis, log }
const zugaenge = ref([])         // eingerichtete Zugaenge — fuer Parameter vom Typ driver
const darfSchreiben = computed(() => store.can('scriptum.write'))
const rollen = ref([])
const RECHTE = ref([])

let poll = null
onMounted(async () => {
  await laden()
  try { zugaenge.value = await api.get('/api/drivers') } catch { zugaenge.value = [] }
  if (darfSchreiben.value) {
    try { rollen.value = await api.get('/api/auth/roles') } catch { rollen.value = [] }
    try { RECHTE.value = await api.get('/api/auth/rights') } catch { RECHTE.value = [] }
  }
  // ein Lauf vom Knoten-Kontextmenü: das Skript wählen und sein Ergebnis (mit Download-Link) zeigen
  try {
    const roh = localStorage.getItem('journali.scriptum.run')
    if (roh) {
      localStorage.removeItem('journali.scriptum.run')
      const { key, job, run } = JSON.parse(roh)
      const s = liste.value.find(x => x.key === key)
      if (s && job && run) { await waehlen(s); lauf.value = { job, run, laeuft: true }; busy.value = t_('läuft …'); frage() }
    }
  } catch { /* egal */ }
})

onUnmounted(() => clearTimeout(poll))

async function laden(key = cur.value?.key) {
  try { liste.value = await api.get('/api/scriptum/scripts') } catch (e) { store.toast(e.message); return }
  if (key) await waehlen(liste.value.find(s => s.key === key) ?? null)
  else if (!cur.value && liste.value.length) await waehlen(liste.value[0])
}

async function waehlen(s) {
  lauf.value = null; clearTimeout(poll)
  if (!s) { cur.value = null; return }
  // mit dem Schreibrecht kommt der Quelltext dazu — sonst nur, was das Formular braucht
  if (darfSchreiben.value) { try { cur.value = await api.get(`/api/scriptum/scripts/${encodeURIComponent(s.key)}`) } catch (e) { store.toast(e.message); cur.value = s } }
  else cur.value = s
  werte.value = Object.fromEntries((cur.value.params ?? []).map(p => [p.key, p.default ?? '']))
}

async function speichern(quelle) {
  const kopf = kopfLesen(quelle)
  const params = kopf ? paramsAus(kopf) : (cur.value.params ?? [])
  const leib = { source: quelle, params }
  if (kopf?.label) leib.label = String(kopf.label)
  if (kopf?.role) leib.role = String(kopf.role)
  if (kopf) leib.nodes = !!kopf.nodes   // meta.nodes: true → im Knoten-Kontextmenü, läuft auf der Auswahl
  try {
    await api.post(`/api/scriptum/scripts/${encodeURIComponent(cur.value.key)}`, leib, 'PUT')
    editor.value = false
    store.toast(kopf ? t_('✓ Gespeichert · {0} Parameter aus dem Kopf', [params.length]) : t_('✓ Gespeichert — ohne Kopf (export const meta) hat das Skript kein Formular'), kopf ? 'ok' : 'error')
    await laden(cur.value.key); refreshNodeScripts()
  } catch (e) { store.toast(e.message) }
}

async function feldSetzen(feld, wert) {
  try { await api.post(`/api/scriptum/scripts/${encodeURIComponent(cur.value.key)}`, { [feld]: wert }, 'PUT'); await laden(cur.value.key) }
  catch (e) { store.toast(e.message) }
}

async function anlegen() {
  const key = neu.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
  if (!key) return
  try {
    await api.post(`/api/scriptum/scripts/${encodeURIComponent(key)}`, { label: key, source: '' }, 'PUT')
    neu.value = ''
    await laden(key)
    editor.value = true
  } catch (e) { store.toast(e.message) }
}

async function entfernen() {
  if (!cur.value) return
  try { await api.del(`/api/scriptum/scripts/${encodeURIComponent(cur.value.key)}`); cur.value = null; await laden(null); refreshNodeScripts() }
  catch (e) { store.toast(e.message) }
}

// ---- Lauf: als Job, wie alles andere auch. ▶ startet, dann wird nach Stand und Ergebnis gefragt
async function ausfuehren() {
  if (!cur.value || busy.value) return
  busy.value = t_('startet …'); lauf.value = null
  try {
    const r = await api.post(`/api/scriptum/scripts/${encodeURIComponent(cur.value.key)}/run`, { params: Object.fromEntries(Object.entries(werte.value).map(([k, v]) => [k, String(v ?? '')])) })
    lauf.value = { job: r.job, run: r.run, laeuft: true }
    busy.value = t_('läuft …')
    frage()
  } catch (e) { busy.value = ''; store.toast(e.message) }
}
function frage() {
  clearTimeout(poll)
  poll = setTimeout(async () => {
    if (!lauf.value) return
    try {
      const r = await api.get(`/api/scriptum/runs/${lauf.value.job}/${lauf.value.run}`)
      lauf.value = { ...lauf.value, ...r }
      if (r.laeuft) return frage()
      busy.value = ''
    } catch (e) { busy.value = ''; store.toast(e.message) }
  }, 700)
}
const ergebnis = computed(() => lauf.value?.ergebnis ?? null)
const dateiLink = computed(() => ergebnis.value?.file
  ? `${store.server}/api/scriptum/runs/${lauf.value.job}/${lauf.value.run}/file?name=${encodeURIComponent(ergebnis.value.file)}` : null)
</script>

<template>
  <div class="pane" :style="`width:${listW}px;flex:none`">
    <div class="toolbar"><h1>{{ $t("⌨ Skripte") }}</h1><span class="grow" /><span class="muted">{{ liste.length }}</span></div>
    <div v-if="darfSchreiben" class="toolbar" style="border-bottom:1px solid var(--line)">
      <input v-model="neu" type="text" :placeholder="$t('neues Skript (key)')" style="flex:1" @keydown.enter="anlegen" />
      <button class="primary" :disabled="!neu.trim()" @click="anlegen">+</button>
    </div>
    <div class="scroll">
      <div v-for="s in liste" :key="s.key" class="zeile" :class="{ on: cur?.key === s.key }" @click="waehlen(s)" :title="s.key">
        <span class="lbl">{{ s.label || s.key }}</span>
        <span v-if="s.released" class="pos" :title="$t('freigegeben: sein Lauf braucht das Recht {0}', [s.run])">●</span>
        <span v-else class="muted" :title="$t('nicht freigegeben — nur wer Skripte schreiben darf, kann es anstossen')">○</span>
      </div>
      <div v-if="!liste.length" class="empty">{{ darfSchreiben ? $t('Noch kein Skript.') : $t('Kein Skript freigegeben.') }}</div>
    </div>
  </div>

  <Splitter v-model="listW" :min="200" :max="520" />

  <div class="pane" style="flex:1">
    <template v-if="cur">
      <div class="toolbar">
        <h1>⌨ {{ cur.label || cur.key }}</h1><span class="mono muted">{{ cur.key }}</span>
        <span class="grow" />
        <span v-if="busy" class="muted">{{ busy }}</span>
        <button v-if="darfSchreiben" class="editor" @click="editor = true" :title="$t('Quelltext bearbeiten — der Kopf ist das Formular')">{{ $t("⌨ Quelltext") }}</button>
        <button v-if="darfSchreiben" class="x" @click="entfernen" :title="$t('Skript entfernen — die Läufe bleiben im Journal')">✕</button>
        <button class="primary start" :disabled="!!busy" @click="ausfuehren" :title="$t('Als Lauf anstossen — Log und Ergebnis stehen danach hier')">{{ $t("▶ Ausführen") }}</button>
      </div>
      <div class="scroll">
        <table v-if="darfSchreiben" class="grid form"><colgroup><col style="width:150px" /><col /></colgroup><tbody>
          <tr><td class="attr">{{ $t("Bezeichnung") }}</td><td class="muted">{{ cur.label }} <span class="muted" style="font-size:11px">{{ $t("· aus dem Kopf des Skripts") }}</span></td></tr>
          <tr><td class="attr" :title="$t('Mit dieser Rolle arbeitet der Lauf — er darf nie mehr als ein Anwender mit ihr')">{{ $t("Rolle des Laufs") }}</td>
            <td><select class="rolle" :value="cur.role ?? ''" @change="e => feldSetzen('role', e.target.value)">
              <option value="">{{ $t("— editor —") }}</option>
              <option v-for="r in rollen" :key="r.key" :value="r.key">{{ r.label || r.key }}</option>
            </select></td></tr>
          <tr><td class="attr" :title="$t('Mit welchem Recht andere es anstossen dürfen; ohne Recht kann es nur, wer Skripte schreibt')">{{ $t("Freigabe") }}</td>
            <td><select class="freigabe" :value="cur.run ?? ''" @change="e => feldSetzen('run', e.target.value)">
              <option value="">{{ $t("— nicht freigegeben —") }}</option>
              <option v-for="r in RECHTE" :key="r.key" :value="r.key">{{ r.label }}</option>
            </select></td></tr>
          <tr><td class="attr" :title="$t('Der Lauf wird abgebrochen, wenn er länger braucht')">{{ $t("Zeitgrenze (s)") }}</td>
            <td><input class="limit" type="number" min="5" max="3600" :value="cur.limit" @change="e => feldSetzen('limit', Number(e.target.value) || 60)" style="width:90px" /></td></tr>
        </tbody></table>

        <div class="section">
          <h2>{{ $t("Parameter") + ' ' }}<span class="muted">{{ $t("· aus dem Kopf des Skripts") }}</span></h2>
          <table v-if="(cur.params ?? []).length" class="grid form"><colgroup><col style="width:150px" /><col /></colgroup><tbody>
            <tr v-for="p in cur.params" :key="p.key"><td class="attr" :title="p.key">{{ p.label || p.key }}</td>
              <td><select v-if="p.type === 'driver'" class="param" :data-key="p.key" v-model="werte[p.key]" style="width:100%" :title="$t('ein eingerichteter Zugang — der Server hängt die Anmeldung an')">
                  <option value="">{{ $t("— Zugang wählen —") }}</option>
                  <option v-for="z in zugaenge" :key="z.key" :value="z.key">{{ z.label || z.key }}</option>
                </select>
                <input v-else-if="p.type !== 'boolean'" class="param" :data-key="p.key" :type="p.type === 'number' ? 'number' : 'text'" v-model="werte[p.key]" style="width:100%" />
                <input v-else class="param" :data-key="p.key" type="checkbox" :checked="String(werte[p.key]) === 'true'" @change="e => werte[p.key] = String(e.target.checked)" /></td></tr>
          </tbody></table>
          <div v-else class="muted">{{ $t("Dieses Skript hat keine Parameter.") }}</div>
        </div>

        <div v-if="lauf" class="section ergebnis">
          <h2>{{ $t("Ergebnis") + ' ' }}<span class="muted">{{ lauf.laeuft ? $t('· läuft') : $t('· {0}', [lauf.status ?? '—']) }}</span>
            <span class="grow" />
            <a v-if="plugins.enabled('tasker')" :href="`#/p/tasker/jobs?job=${lauf.job}`" class="muted" :title="$t('Der Lauf steht als Job unter ⏱ Jobs — mit seinem Log')">{{ $t("⏱ Lauf") }}</a></h2>
          <table v-if="ergebnis?.table" class="grid tabelle">
            <thead><tr><th v-for="c in ergebnis.table.columns" :key="c">{{ c }}</th></tr></thead>
            <tbody><tr v-for="(r, i) in ergebnis.table.rows" :key="i"><td v-for="(z, j) in r" :key="j">{{ z }}</td></tr></tbody>
          </table>
          <div v-if="ergebnis?.gekuerzt" class="warn">{{ $t("{0} Zeilen — gezeigt werden die ersten {1}", [ergebnis.gekuerzt, ergebnis.table.rows.length]) }}</div>
          <pre v-if="ergebnis?.text" class="text">{{ ergebnis.text }}</pre>
          <div v-if="ergebnis?.file" class="datei">
            <a :href="dateiLink" :download="ergebnis.file" class="download">{{ $t("⤓ {0}", [ergebnis.file]) }}</a>
            <span class="muted">{{ $t("· im Fach out/ des Laufs") }}</span>
          </div>
          <div v-if="ergebnis?.fehler" class="neg">{{ ergebnis.fehler }}</div>
          <div v-if="!ergebnis && !lauf.laeuft" class="muted">{{ $t("Der Lauf hat nichts gemeldet.") }}</div>
          <pre v-if="lauf.log" class="log">{{ lauf.log }}</pre>
        </div>
      </div>
    </template>
    <div v-else class="empty">{{ $t("Links ein Skript wählen.") }}</div>

    <ScriptEditor v-if="editor && cur" lang="js" :model-value="cur.source ?? ''" :title="cur.label || cur.key"
      :templates="beispiele" :draft-key="'scriptum.' + cur.key" @save="speichern" @close="editor = false" />
  </div>
</template>

<style scoped>
.zeile { display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 8px; cursor: pointer; white-space: nowrap; }
.zeile.on { background: var(--accent-soft); }
.zeile .lbl { overflow: hidden; text-overflow: ellipsis; flex: 1; }
.form { width: 100%; border-bottom: 1px solid var(--line); }
.form td { height: 30px; vertical-align: middle; white-space: normal; padding: 2px 4px; }
.form td.attr { color: var(--muted); white-space: nowrap; padding-left: 8px; }
.section { padding: 10px 8px; border-top: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600; display: flex; align-items: center; gap: 6px; }
.tabelle { width: auto; }
.text, .log { font-family: ui-monospace, Consolas, monospace; font-size: 12px; white-space: pre-wrap; margin: 4px 0 0; }
.log { color: var(--muted); border-top: 1px solid var(--line); padding-top: 6px; margin-top: 8px; }
.datei { display: flex; gap: 6px; align-items: center; }
</style>
