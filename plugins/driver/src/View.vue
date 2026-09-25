<script setup>
// ⌁ Zugänge: einmal einrichten, von jedem Plugin nutzbar. Ein Plugin fragt nach einem Zugang seiner Art statt
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
  form.value = { key: '', art: arten.value.find(a => a.key !== 'file')?.key ?? 'ftp', label: '', felder: {}, geheim: {} }
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
    await api.put(`/api/drivers/${encodeURIComponent(f.key.trim())}`, { art: f.art, label: f.label, felder: f.felder, geheim: f.geheim })
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
      <th>{{ $t("Zugang") }}</th><th>{{ $t("Art") }}</th><th>{{ $t("Adresse") }}</th><th>{{ $t("Geheimnis") }}</th><th></th>
    </tr></thead><tbody>
      <tr v-for="z in zugaenge" :key="z.key" :class="{ current: bearbeitet === z.key }">
        <td>{{ z.label || z.key }} <span class="muted">{{ z.key }}</span></td>
        <td><span :title="z.dateien ? $t('liefert Dateien — mit Browser') : $t('nur Anmeldung — keine Verzeichnisse')">{{ z.dateien ? '📁' : '⚿' }} {{ z.art }}</span></td>
        <td class="muted">{{ z.felder?.host || z.felder?.url || (z.key === 'lokal' ? $t('dieser Server') : '') }}</td>
        <td class="muted">{{ (z.geheim ?? []).join(', ') || '—' }}</td>
        <td style="text-align:right;white-space:nowrap">
          <button v-if="z.dateien" class="x" :title="$t('Verzeichnisse ansehen')" @click="browsen(z)">📁</button>
          <button v-if="z.key !== 'lokal'" class="x" :title="$t('ändern')" @click="bearbeiten(z)">✎</button>
          <button v-if="z.key !== 'lokal'" class="x" :title="$t('entfernen')" @click="entfernen(z)">✕</button>
        </td>
      </tr>
    </tbody></table>

    <div class="step-band">{{ bearbeitet ? $t("Zugang ändern") : $t("Neuer Zugang") }}</div>
    <table class="grid form"><colgroup><col style="width:120px" /><col /></colgroup><tbody>
      <tr><td class="attr">{{ $t("Name") }}</td><td>
        <input v-model="form.key" :readonly="!!bearbeitet" :placeholder="$t('kurz, ohne Leerzeichen — z. B. archiv-ftp')" style="width:240px" />
      </td></tr>
      <tr><td class="attr">{{ $t("Art") }}</td><td>
        <select v-model="form.art" :disabled="!!bearbeitet" style="width:240px">
          <option v-for="a in arten.filter(x => x.key !== 'file')" :key="a.key" :value="a.key">{{ a.label }}</option>
        </select>
        <span v-if="art" class="muted">{{ ' ' + (art.dateien ? $t('liefert Dateien') : $t('nur Anmeldung')) }}</span>
      </td></tr>
      <tr><td class="attr">{{ $t("Bezeichnung") }}</td><td><input v-model="form.label" :placeholder="$t('wie es in der Auswahl steht')" style="width:240px" /></td></tr>
      <tr v-for="f in art?.felder ?? []" :key="f"><td class="attr">{{ f }}</td>
        <td><input v-model="form.felder[f]" style="width:240px" autocomplete="off" /></td></tr>
      <tr v-for="g in art?.geheim ?? []" :key="g"><td class="attr">{{ g }}</td>
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
