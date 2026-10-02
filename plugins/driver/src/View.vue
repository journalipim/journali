<script setup>
// ⌁ Zugänge: einmal einrichten, von jedem Plugin nutzbar. Alle Arten gehören zu diesem einen Plugin (28.09.2026):
// Dateisystem, WebDAV und FTP liefern Dateien (Browser, Fächer der Jobs), IXP und Solr sind Anmeldungen. Ein Plugin fragt nach einem Zugang seiner Art statt
// selbst nach Adresse und Passwort. Wer Dateien liefert, bekommt einen Browser; eine Anmeldung hat keine
// Verzeichnisse — der Zugang ist keine Schicht über der Datenbank, er hält nur die Anmeldung bereit.
// Das Passwort geht hinein und nie zurück: es liegt beim Server, die Liste nennt nur seinen Namen.
import { ref, computed, onMounted } from 'vue'
import { api, store, dialog, filePicker, t as t_ } from 'journali'

const arten = ref([])
const zugaenge = ref([])
const busy = ref('')
// das Formular: leer = neuer Zugang
const form = ref({ key: '', art: 'ftp', label: '', felder: {}, geheim: {} })
const bearbeitet = ref('')

const art = computed(() => arten.value.find(a => a.key === form.value.art) ?? null)
// Wie Arten und Felder im Formular heissen — der Server kennt nur ihre Schlüssel
const ARTNAME = { file: t_('Dateisystem des Servers'), webdav: 'WebDAV', ftp: 'FTP', ixp: t_('IXP (Anmeldung)'), solr: t_('Solr (Anmeldung)'), http: 'HTTP/REST' }
const FELD = { url: t_('Adresse'), user: t_('Anwendername'), password: t_('Passwort'), host: t_('Rechner'), port: t_('Port'), pfad: t_('Startverzeichnis'), tls: t_('TLS'), token: t_('Token'), auth: t_('Anmeldung'), header: t_('Kopf'), secret: t_('Geheimnis') }
const HILFE = {
  url: t_('https://… — bei WebDAV das Verzeichnis, bei IXP die Basis der API, bei Solr der Kern, bei HTTP die Basis der Schnittstelle'),
  host: t_('nur der Name, ohne ftp:// und ohne Pfad'), port: t_('leer = 21'), pfad: t_('leer = das Verzeichnis nach der Anmeldung'),
  header: t_('Name des Kopfs, in dem das Geheimnis steht — z. B. X-API-Key'), secret: t_('Token, Schlüssel oder Passwort — bleibt beim Server'),
}
const artName = a => ARTNAME[a?.key ?? a] ?? a?.label ?? a
const feldName = f => FELD[f] ?? f
// Prüfen: kommt der Zugang an? Die Antwort steht an der Zeile
const pruefung = ref({})
async function pruefen(z) {
  pruefung.value = { ...pruefung.value, [z.key]: { text: '…' } }
  try {
    const r = await api.post(`/api/drivers/${encodeURIComponent(z.key)}/test`, {})
    pruefung.value = { ...pruefung.value, [z.key]: { ok: r.ok, text: r.ok ? t_('erreichbar') : t_('nicht erreichbar'), title: r.text } }
  } catch (e) { pruefung.value = { ...pruefung.value, [z.key]: { ok: false, text: t_('nicht erreichbar'), title: e.message } } }
}
// Anlegen laesst sich nur, was es als Art gibt und was nicht schon eingebaut ist. Steht hier nichts, gibt es
// heute nur den lokalen Zugang — dann zeigt die Ansicht das, statt ein Formular ohne Auswahl anzubieten
const anlegbar = computed(() => arten.value.filter(a => a.key !== 'file'))

async function laden() {
  try {
    arten.value = await api.get('/api/drivers/arten')
    zugaenge.value = await api.get('/api/drivers')
    busy.value = ''
  } catch (e) { busy.value = '✗ ' + e.message }
}
onMounted(laden)

function neu() {
  bearbeitet.value = ''
  form.value = { key: '', art: anlegbar.value[0]?.key ?? '', label: '', felder: {}, geheim: {} }
}
function bearbeiten(z) {
  bearbeitet.value = z.key
  // Felder kommen mit, Geheimnisse nie — leer lassen behält das hinterlegte
  form.value = { key: z.key, art: z.art, label: z.label, felder: { ...(z.felder ?? {}) }, geheim: {} }
}

async function speichern() {
  const f = form.value
  if (!f.key.trim()) { store.toast(t_('Name des Zugangs fehlt')); return }
  busy.value = t_('speichere …')
  try {
    await api.post(`/api/drivers/${encodeURIComponent(f.key.trim())}`, { art: f.art, label: f.label, felder: f.felder, geheim: f.geheim }, 'PUT')
    await laden()
    neu()
    store.toast(t_('Zugang gespeichert'), 'ok')
  } catch (e) { busy.value = '✗ ' + e.message; store.toast(e.message) }
}

async function entfernen(z) {
  const ok = await dialog.confirm({ title: t_('Zugang entfernen'), text: t_('{0} — Jobs und Profile, die ihn nennen, finden ihn danach nicht mehr.', [z.label || z.key]), ok: t_('Entfernen'), danger: true })
  if (!ok) return
  try { await api.del(`/api/drivers/${encodeURIComponent(z.key)}`); await laden(); if (bearbeitet.value === z.key) neu() }
  catch (e) { store.toast(e.message) }
}

// Den Browser eines Zugangs öffnen — nur bei einem, der Dateien liefert
function browsen(z) {
  filePicker({ dirOnly: true, title: t_('📁 {0}', [z.label || z.key]), zugang: z.key, onPick: () => {} })
}
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>{{ $t("⌁ Zugänge") }}</h1>
      <span class="grow" /><span :class="String(busy ?? '').startsWith('✗') ? 'fehler' : 'muted'">{{ busy }}</span></div>

    <table class="grid"><thead><tr>
      <th>{{ $t("Zugang") }}</th><th>{{ $t("Art") }}</th><th>{{ $t("Adresse") }}</th><th>{{ $t("Geheimnis") }}</th><th></th><th></th>
    </tr></thead><tbody>
      <tr v-for="z in zugaenge" :key="z.key" :class="{ current: bearbeitet === z.key }">
        <td>{{ z.label || z.key }} <span class="muted">{{ z.key }}</span></td>
        <td><span :title="z.dateien ? $t('liefert Dateien — mit Browser') : $t('nur Anmeldung — keine Verzeichnisse')">{{ z.dateien ? '📁' : '⚿' }} {{ artName(z.art) }}</span></td>
        <td class="muted">{{ z.felder?.host || z.felder?.url || (z.key === 'lokal' ? $t('dieser Server') : '') }}</td>
        <td class="muted">{{ (z.geheim ?? []).map(feldName).join(', ') || '—' }}</td>
        <td class="pruef" :class="pruefung[z.key]?.ok === true ? 'pos' : pruefung[z.key]?.ok === false ? 'neg' : 'muted'" :title="pruefung[z.key]?.title ?? ''">{{ pruefung[z.key]?.text ?? '' }}</td>
        <td style="text-align:right;white-space:nowrap">
          <button v-if="z.key !== 'lokal'" class="x" :title="$t('prüfen, ob der Zugang ankommt')" @click="pruefen(z)">⟳</button>
          <button v-if="z.dateien" class="x" :title="$t('Verzeichnisse ansehen')" @click="browsen(z)">📁</button>
          <button v-if="z.key !== 'lokal'" class="x" :title="$t('ändern')" @click="bearbeiten(z)">✎</button>
          <button v-if="z.key !== 'lokal'" class="x" :title="$t('entfernen')" @click="entfernen(z)">✕</button>
        </td>
      </tr>
    </tbody></table>

    <div class="step-band">{{ bearbeitet ? $t("Zugang ändern") : $t("Neuer Zugang") }}</div>
    <div v-if="!anlegbar.length" class="empty">{{ $t("Nur das Dateisystem dieses Servers — weitere Arten kommen, sobald ihr Treiber steht.") }}</div>
    <table v-else class="grid form"><colgroup><col style="width:120px" /><col /></colgroup><tbody>
      <tr><td class="attr">{{ $t("Name") }}</td><td>
        <input v-model="form.key" :readonly="!!bearbeitet" :placeholder="$t('kurz, ohne Leerzeichen — z. B. archiv-ftp')" style="width:240px" />
      </td></tr>
      <tr><td class="attr">{{ $t("Bezeichnung") }}</td><td><input v-model="form.label" :placeholder="$t('wie es in der Auswahl steht')" style="width:240px" /></td></tr>
      <tr><td class="attr">{{ $t("Art") }}</td><td>
        <select v-model="form.art" :disabled="!!bearbeitet" style="width:240px">
          <option v-for="a in anlegbar" :key="a.key" :value="a.key">{{ artName(a) }}</option>
        </select>
        <span v-if="art" class="muted">{{ ' ' + (art.dateien ? $t('liefert Dateien') : $t('nur Anmeldung')) }}</span>
      </td></tr>
      <tr v-for="f in art?.felder ?? []" :key="f"><td class="attr">{{ feldName(f) }}</td>
        <td><select v-if="f === 'tls'" v-model="form.felder[f]" style="width:240px"><option value="">{{ $t("nein") }}</option><option value="ja">{{ $t("ja — explizites TLS") }}</option></select>
          <select v-else-if="f === 'auth'" v-model="form.felder[f]" style="width:240px">
            <option value="">{{ $t("ohne") }}</option>
            <option value="bearer">{{ $t("Bearer-Token") }}</option>
            <option value="basic">{{ $t("Basic (Anwender und Geheimnis)") }}</option>
            <option value="header">{{ $t("eigener Kopf") }}</option>
          </select>
          <input v-else v-model="form.felder[f]" style="width:240px" autocomplete="off" :placeholder="HILFE[f] ?? ''" :title="HILFE[f] ?? ''" /></td></tr>
      <tr v-for="g in art?.geheim ?? []" :key="g"><td class="attr">{{ feldName(g) }}</td>
        <td><input v-model="form.geheim[g]" type="password" autocomplete="new-password" style="width:240px"
          :placeholder="bearbeitet ? $t('hinterlegt — leer lassen, um es zu behalten') : ''" />
          <span class="muted">{{ ' ' + $t("bleibt beim Server, nie im Journal") }}</span></td></tr>
      <tr><td class="attr"></td><td><div class="row">
        <button class="primary" @click="speichern">{{ bearbeitet ? $t("Ändern") : $t("Anlegen") }}</button>
        <button v-if="bearbeitet" @click="neu">{{ $t("Abbrechen") }}</button>
      </div></td></tr>
    </tbody></table>
  </div>
</template>

<style scoped>
.x { border: 0; background: none; color: var(--muted); padding: 0 4px; cursor: pointer; }
.x:hover { color: var(--accent); }
.form td.attr { white-space: nowrap; color: var(--muted); }
</style>
