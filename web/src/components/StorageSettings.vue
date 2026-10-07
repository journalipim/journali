<script setup>
// Zwei Dinge, die verschiedenen Leuten gehören: der <b>Speicher</b> (Treiber, Zugang, Umzug) und die
// <b>Assets</b> (Vorschau-Ableitungen, Bestand). Der Schalter sagt, welcher Teil gezeigt wird — die Logik bleibt eine.
defineProps({ teil: { type: String, default: 'speicher' } })
// Einstellungen → Storage: Treiber des Assetspeichers — Postgres,
// Verzeichnis, S3 (Garage, MinIO, AWS, R2 …); prüfen, speichern (media.json beim
// Server, nie im Journal), Fehlbestand sehen, Blobs von einem anderen Speicher herüberkopieren.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { filePicker } from '../filePicker.js'   // Dateibrowser des Servers — derselbe wie bei den Jobs
import { t } from '../i18n.js'
import { L } from '../i18n.js'

const DRIVERS = [['postgres', t('Postgres — Tabelle media_blob in der Journal-Datenbank')], ['file', t('Verzeichnis')], ['s3', 'S3 — Garage, MinIO, AWS, R2, Hetzner …']]
const cfg = ref({ driver: 'postgres', path: '', bucket: '', endpoint: '', key: '', secret: '', region: 'garage', pathStyle: true })
const state = ref({ kind: '', total: 0, error: null })
const probe = ref(''); const busy = ref('')
const zaehlBusy = ref('')   // Fehlbestand zählen
const kopierBusy = ref('')  // Assetmigration
const missing = ref(null)
const fehlen = computed(() => missing.value?.count ?? missing.value?.missing.length ?? 0)   // alle fehlenden; die Liste nennt höchstens 200
const stats = ref(null)      // was im Speicher liegt: Zahl, Grösse, Arten
const betrieb = ref(null)    // Spiegel und Schnappschuss: Schalter und Dateigrössen
const n = x => (x ?? 0).toLocaleString('de-DE')
const kb = b => {
  const z = (x, e) => (x / e).toLocaleString('de-DE', { maximumFractionDigits: 1 })
  return !b ? '0kb' : b >= 1073741824 ? z(b, 1073741824) + 'gb' : b >= 1048576 ? z(b, 1048576) + 'mb' : Math.max(1, Math.round(b / 1024)) + 'kb'
}
const copyFrom = ref({ driver: 'file', path: 'media', bucket: '', endpoint: '', key: '', secret: '', region: 'garage', pathStyle: true })
const copyResult = ref(null)

// Vorschau-Presets
const presets = ref([]); const presetBusy = ref('')
const FORMATS = ['webp', 'jpeg', 'png', 'avif']
async function loadPresets() { try { presets.value = (await api.get('/api/media/presets')).map(p => ({ ...p, labelDe: L(p.label) ?? p.key })) } catch (e) { store.toast(e.message) } }
async function savePreset(p) {
  try {
    const r = await api.post(`/api/media/presets/${encodeURIComponent(p.key)}`, { label: { de: p.labelDe, en: p.label?.en ?? p.labelDe }, width: Number(p.width), height: Number(p.height), format: p.format, quality: Number(p.quality), auto: p.auto }, 'PUT')
    await loadPresets()
    store.toast(r?.job ? t('Preset „{0}“ gespeichert · Job „{1}“ rechnet nach', [p.key, r.job]) : `Preset „${p.key}“ gespeichert`, 'ok')
    if (r?.job) setTimeout(loadPresets, 3000)
  } catch (e) { store.toast(e.message) }
}
async function newPreset() {
  const key = await dialog.prompt({ title: t('Vorschau-Preset anlegen'), text: 'Key (a-z, 0-9, _)', placeholder: 'z. B. shop, katalog, print_hires', ok: t('+ Anlegen') })
  if (!key) return
  try { await api.post(`/api/media/presets/${encodeURIComponent(key.trim().toLowerCase())}`, { label: { de: key, en: key }, width: 1200, height: 1200, format: 'webp', quality: 82, auto: true }, 'PUT'); await loadPresets() } catch (e) { store.toast(e.message) }
}
async function deletePreset(p) {
  if (!await dialog.confirm({ title: `Preset „${p.key}“ entfernen?`, text: t('Gerechnete Ableitungen bleiben im Store, werden aber nicht mehr ausgeliefert.'), ok: t('🗑 Entfernen'), danger: true })) return
  try { await api.del(`/api/media/presets/${encodeURIComponent(p.key)}`); await loadPresets() } catch (e) { store.toast(e.message) }
}
async function derive() { presetBusy.value = t('stoße an …'); try { const r = await api.post('/api/media/derive', {}); store.toast(t('Job „{0}“ läuft — ⏱ Jobs zeigt den Fortschritt', [r.job]), 'ok'); setTimeout(loadPresets, 3000) } catch (e) { store.toast(e.message) } finally { presetBusy.value = '' } }
onMounted(loadPresets)

const clean = c => ({ ...c, path: c.path || null, bucket: c.bucket || null, endpoint: c.endpoint || null, key: c.key || null, secret: c.secret || null, region: c.region || null })
async function load() {
  try {
    const s = await api.get('/api/media/store')
    state.value = { kind: s.kind, total: s.total ?? 0, error: s.error ?? (s.config ? null : t('Server älter als die Oberfläche — neu starten')) }
    if (!s.config) return
    cfg.value = { driver: s.config.driver, path: s.config.path ?? '', bucket: s.config.bucket ?? '', endpoint: s.config.endpoint ?? '', key: s.config.key ?? '', secret: s.config.secret ?? '', region: s.config.region ?? 'garage', pathStyle: s.config.pathStyle ?? true }
  } catch (e) { state.value.error = e.message }
}
async function check() {
  probe.value = t('prüfe …')
  try { const r = await api.post('/api/media/store/probe', clean(cfg.value)); probe.value = r.error ? '✗ ' + r.error : '✓ ' + r.kind } catch (e) { probe.value = '✗ ' + e.message }
}
async function save() {
  if (!store.actor) { store.toast(t('👤 Name fehlt')); return }
  busy.value = 'speichere …'
  try { await api.post('/api/media/store', clean(cfg.value), 'PUT'); store.toast(t('Medienspeicher umgestellt — Blobs ggf. herüberkopieren'), 'ok'); missing.value = null; await load() }
  catch (e) { store.toast(e.message) }
  finally { busy.value = '' }
}
async function ladeBetrieb() {
  try { betrieb.value = await api.get('/api/betrieb') } catch { betrieb.value = null }
}
async function setzeBetrieb(feld, wert) {
  try {
    await api.post('/api/betrieb', { [feld]: wert }, 'PUT')
    await ladeBetrieb()
    store.toast(t('gespeichert — gilt ab dem nächsten Start'), 'ok')
  } catch (e) { store.toast(e.message) }
}
async function wirfWeg(was) {
  const d = was === 'spiegel' ? betrieb.value?.spiegel : betrieb.value?.schnappschuss
  if (!await dialog.confirm({ title: `${was === 'spiegel' ? 'Spiegel' : 'Schnappschuss'} wegwerfen?`, text: t('{0} — beim nächsten Start wird neu gelesen.', [kb(d?.bytes)]), ok: t('🗑 Wegwerfen') })) return
  try { await api.del(`/api/betrieb/${was}`); await ladeBetrieb() } catch (e) { store.toast(e.message) }
}

async function loadStats() {
  // ein älterer Server kennt den Weg noch nicht — dann bleibt der Block weg statt halb gefüllt
  try { const x = await api.get('/api/media/stats'); stats.value = Array.isArray(x?.kinds) ? x : null } catch { stats.value = null }
}
async function findMissing() {
  zaehlBusy.value = t('zähle …')
  try { missing.value = await api.get('/api/media/missing') } catch (e) { store.toast(e.message) } finally { zaehlBusy.value = '' }
}
async function copy() {
  if (!store.actor) { store.toast(t('👤 Name fehlt')); return }
  if (!await dialog.confirm({ title: t('Assets aus dem anderen Speicher holen?'), warn: `${copyFrom.value.driver === 'file' ? copyFrom.value.path : copyFrom.value.driver === 's3' ? 's3://' + copyFrom.value.bucket : 'postgres'} → ${state.value.kind}`, text: t('Alles, was hier fehlt (Hash-geprüft, nichts wird gelöscht)'), ok: t('Kopieren') })) return
  kopierBusy.value = 'kopiere …'; copyResult.value = null
  try { copyResult.value = await api.post('/api/media/copy', { from: clean(copyFrom.value) }); missing.value = null }
  catch (e) { store.toast(e.message) }
  finally { kopierBusy.value = '' }
}
onMounted(() => { load(); loadStats(); ladeBetrieb() })
</script>

<template>
  <div class="section" v-if="teil === 'speicher'">
    <h2>{{ $t("▨ Assetspeicher") + ' ' }}<span class="muted">{{ $t("· aktiv:") + ' ' }}<span class="mono">{{ state.kind }}</span>{{ ' ' + $t("· {0} Assets", [state.total]) }}<span v-if="state.error" class="neg"> · ✗ {{ state.error }}</span></span></h2>
    <table class="grid form" style="width:auto"><colgroup><col style="width:120px" /><col style="width:460px" /><col /></colgroup><tbody>
      <tr><td class="muted" :title="$t('Bytes werden nach SHA-256 abgelegt; das Journal kennt nur den Hash, der Treiber ist wechselbar.')">{{ $t("Treiber") }}</td><td><select v-model="cfg.driver" style="width:100%"><option v-for="[v, l] in DRIVERS" :key="v" :value="v">{{ l }}</option></select></td>
        <td></td></tr>
      <tr v-if="cfg.driver === 'file'"><td class="muted" :title="$t('Vom Server aus gesehen — im Container z. B. /data/media.')">{{ $t("Verzeichnis") }}</td><td>
        <div class="row"><input v-model="cfg.path" type="text" class="pfad" :placeholder="$t('media (relativ zum Server) oder /data/media')" /><button class="x" @click="filePicker({ value: cfg.path, dirOnly: true, title: $t('📁 Verzeichnis des Assetspeichers (auf dem Server)'), onPick: p => { cfg.path = p } })" :title="$t('Verzeichnis auswählen')">…</button></div>
      </td><td></td></tr>
      <template v-if="cfg.driver === 's3'">
        <tr><td class="muted" :title="$t('Garage: 3900 ist die S3-API.')">{{ $t("Endpoint") }}</td><td><input v-model="cfg.endpoint" type="text" style="width:100%" :placeholder="$t('http://garage:3900')" /></td><td></td></tr>
        <tr><td class="muted">{{ $t("Bucket") }}</td><td><input v-model="cfg.bucket" type="text" style="width:100%" :placeholder="$t('journali')" /></td><td></td></tr>
        <tr><td class="muted">{{ $t("Key") }}</td><td><input v-model="cfg.key" type="text" style="width:100%" :placeholder="$t('GK…')" autocomplete="off" /></td><td></td></tr>
        <tr><td class="muted" :title="$t('Liegt verschlüsselt im Tresor beim Server, nie im Journal und nie im Browser.')">{{ $t("Secret") }}</td><td><input v-model="cfg.secret" type="password" style="width:100%" autocomplete="new-password" /></td><td></td></tr>
        <tr><td class="muted">{{ $t("Region") }}</td><td class="row" style="gap:10px"><input v-model="cfg.region" type="text" style="width:160px" :placeholder="$t('garage')" /><label><input type="checkbox" v-model="cfg.pathStyle" />{{ ' ' + $t("Pfad-Stil (endpoint/bucket/…)") }}</label></td><td></td></tr>
      </template>
      <tr><td></td><td class="row"><button @click="check">{{ $t("Prüfen") }}</button><button class="primary" @click="save">{{ $t("Speichern") }}</button><span :class="String(probe || busy || '').startsWith('✗') ? 'fehler' : 'muted'" style="font-size:12px">{{ probe || busy }}</span></td><td></td></tr>
    </tbody></table>
  </div>

  <div class="section" v-if="teil === 'speicher' && betrieb">
    <h2 :title="$t('Zwei Kopien, die den Start schnell machen: der Spiegel hält die Journaleinträge, der Schnappschuss die fertigen Abbilder.')">{{ $t("▨ Start") + ' ' }}<span class="muted">{{ $t("· Spiegel und Schnappschuss") }}</span></h2>
    <table class="grid form" style="width:auto"><colgroup><col style="width:170px" /><col style="width:150px" /><col /></colgroup><tbody>
      <tr>
        <td class="muted" :title="$t('Jeder gelesene Eintrag liegt als Zeile auf der Platte; der Start holt nur den Rest aus der Datenbank.')">{{ $t("Spiegel") }}</td>
        <td><label><input type="checkbox" :checked="betrieb.journalCache" @change="setzeBetrieb('journalCache', $event.target.checked)" />{{ ' ' + $t("an") }}</label></td>
        <td class="muted mono" style="font-size:12px">
          <span v-if="betrieb.spiegel.da">{{ kb(betrieb.spiegel.bytes) }}
            <button class="x" :title="$t('wegwerfen — beim nächsten Start wird neu gelesen')" @click="wirfWeg('spiegel')">🗑</button>
          </span>
          <span v-else>{{ $t("keine Datei") }}</span>
        </td>
      </tr>
      <tr>
        <td class="muted" :title="$t('Der Stand aller Abbilder als Datei; ohne ihn liest der Start das Journal von vorn.')">{{ $t("Schnappschuss") }}</td>
        <td><label><input type="checkbox" :checked="betrieb.snapshot" @change="setzeBetrieb('snapshot', $event.target.checked)" />{{ ' ' + $t("an") }}</label></td>
        <td class="muted mono" style="font-size:12px">
          <span v-if="betrieb.schnappschuss.da">{{ kb(betrieb.schnappschuss.bytes) }}
            <button class="x" :title="$t('wegwerfen — beim nächsten Start wird neu gelesen')" @click="wirfWeg('schnappschuss')">🗑</button>
          </span>
          <span v-else>{{ $t("keine Datei") }}</span>
        </td>
      </tr>
      <tr><td></td><td colspan="2" class="muted" style="font-size:12px">{{ $t("Eine Änderung gilt ab dem nächsten Start.") }}<span v-if="!betrieb.eingestellt">{{ ' ' + $t("Bisher aus der Umgebung.") }}</span></td></tr>
    </tbody></table>
  </div>

  <div class="section" v-if="teil === 'assets'">
    <h2 :title="$t('Für jedes ableitbare Asset vorausgerechnet, nie live; rechnet das Plugin derive nach jedem Hochladen.')">{{ $t("▨ Vorschau-Presets") + ' ' }}<span class="muted">{{ $t("· Ableitungen") }}</span></h2>
    <table class="grid form" style="width:auto"><thead><tr><th>{{ $t("Key") }}</th><th>{{ $t("Bezeichnung") }}</th><th :title="$t('längste Seite wird eingepasst, nie vergrößert')">{{ $t("max B × H") }}</th><th>{{ $t("Format") }}</th><th>{{ $t("Qualität") }}</th><th :title="$t('beim Import automatisch rechnen')">{{ $t("auto") }}</th><th :title="$t('gerechnet / ableitbare Assets (Bild, PDF)')">{{ $t("Stand") }}</th><th></th></tr></thead><tbody>
      <tr v-for="p in presets" :key="p.key">
        <td class="mono">{{ p.key }}</td>
        <td><input v-model="p.labelDe" type="text" style="width:140px" @change="savePreset(p)" /></td>
        <td class="row" style="gap:4px"><input v-model="p.width" type="number" min="16" max="20000" style="width:70px" @change="savePreset(p)" /> × <input v-model="p.height" type="number" min="16" max="20000" style="width:70px" @change="savePreset(p)" /></td>
        <td><select v-model="p.format" @change="savePreset(p)"><option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option></select></td>
        <td><input v-model="p.quality" type="number" min="1" max="100" style="width:60px" @change="savePreset(p)" /></td>
        <td><input v-model="p.auto" type="checkbox" @change="savePreset(p)" /></td>
        <td :class="p.pending ? 'warn' : 'pos'" :title="$t('{0} von {1} ableitbaren Assets gerechnet{2}', [p.have, p.images, p.pending ? ' — ' + p.pending + ' fehlen' : ''])">{{ p.have }} / {{ p.images }}</td>
        <td><button class="x" data-demo="aus" @click="deletePreset(p)" :disabled="p.key === 'thumb'" :title="p.key === 'thumb' ? $t('Kachel der Bibliothek — bleibt') : $t('Preset entfernen')">🗑</button></td>
      </tr>
    </tbody></table>
    <div class="row" data-demo="aus" style="gap:8px;margin-top:6px"><button @click="newPreset">{{ $t("+ Preset") }}</button><button @click="derive" :disabled="!!presetBusy" :title="$t('Der Job läuft nach jedem Hochladen und nach jeder Änderung an einem Preset von selbst; hier von Hand.')">{{ $t("▶ Jetzt rechnen") }}</button><span class="muted" style="font-size:12px">{{ presetBusy }}</span></div>
  </div>

  <div class="section" v-if="teil === 'assets'">
    <h2>{{ $t("▨ Bestand") + ' ' }}<span v-if="stats" class="muted">{{ $t("· {0} Assets · {1}", [n(stats.total), kb(stats.bytes)]) }}</span></h2>
    <table v-if="stats" class="grid form" style="width:auto;margin-bottom:8px"><colgroup><col style="width:150px" /><col style="width:260px" /><col /></colgroup><tbody>
      <tr><td class="muted" :title="$t('Alle Assets im Journal, nach Art des Inhalts')">{{ $t("Arten") }}</td>
        <td class="mono">{{ stats.kinds.map(k => `${k.art} ${n(k.count)}`).join(' · ') }}</td>
        <td class="muted" style="font-size:12px">{{ stats.kinds.map(k => `${k.art} ${kb(k.bytes)}`).join(' · ') }}</td></tr>
      <tr><td class="muted" :title="$t('Bild oder PDF — nur daraus rechnet sich eine Vorschau; der Stand oben misst sich daran')">{{ $t("ableitbar") }}</td>
        <td class="mono">{{ $t("{0} von {1}", [n(stats.renderable), n(stats.total)]) }}</td>
        <td class="muted" style="font-size:12px">{{ $t("davon Bilder {0}", [n(stats.images)]) }}</td></tr>
      <tr><td class="muted" :title="$t('Gerechnete Vorschauen über alle Presets — sie liegen zusätzlich im Speicher')">{{ $t("Ableitungen") }}</td>
        <td class="mono">{{ n(stats.derived?.count) }}</td>
        <td class="muted" style="font-size:12px">{{ kb(stats.derived?.bytes) }}</td></tr>
      <tr><td class="muted" :title="$t('An keinem Knoten und in keiner Relation — sie liegen nur in der Bibliothek')">{{ $t("ohne Verwendung") }}</td>
        <td :class="stats.unused ? 'warn mono' : 'mono'">{{ n(stats.unused) }}</td>
        <td class="muted" style="font-size:12px"><span v-if="stats.unfiled">{{ $t("{0} in keinem Ordner", [n(stats.unfiled)]) }}</span></td></tr>
      <tr><td class="muted" :title="$t('Gleiche Bytes unter mehreren Assets — im Speicher liegen sie nur einmal')">{{ $t("gleicher Inhalt") }}</td>
        <td class="mono">{{ n(stats.shared) }}</td>
        <td class="muted" style="font-size:12px">{{ (stats.largest ?? []).map(g => `${g.name} ${kb(g.bytes)}`).join(' · ') }}</td></tr>
    </tbody></table>
    <div class="row" style="gap:8px;align-items:center">
      <button :disabled="!!zaehlBusy" @click="findMissing">{{ $t("Fehlbestand zählen") }}</button>
      <span v-if="zaehlBusy" class="muted" style="font-size:12px">{{ zaehlBusy }}</span>
      <span v-else-if="missing" :class="fehlen ? 'neg' : 'pos'">{{ fehlen ? $t('✗ {0} von {1} Assets fehlen im Speicher', [fehlen, missing.total]) : $t('✓ alle {0} Assets vorhanden', [missing.total]) }}</span>
    </div>
    <div v-if="missing?.missing.length" class="muted" style="font-size:12px;margin-top:4px;max-height:120px;overflow:auto">{{ missing.missing.slice(0, 50).map(m => m.name).join(' · ') }}{{ missing.missing.length > 50 ? ' …' : '' }}</div>
  </div>

  <div class="section" v-if="teil === 'speicher'">
    <h2 :title="$t('Holt die Assets eines anderen Speichers, die hier fehlen — nach einem Treiberwechsel oder aus einem alten Verzeichnis.')">{{ $t("▨ Assetmigration") + ' ' }}<span class="muted">{{ $t("· fehlende Assets") }}</span></h2>
    <table class="grid form" style="width:auto"><colgroup><col style="width:120px" /><col style="width:460px" /></colgroup><tbody>
      <tr><td class="muted">{{ $t("Quelle") }}</td><td><select v-model="copyFrom.driver" style="width:100%"><option v-for="[v, l] in DRIVERS" :key="v" :value="v">{{ l }}</option></select></td></tr>
      <tr v-if="copyFrom.driver === 'file'"><td class="muted">{{ $t("Verzeichnis") }}</td><td>
        <div class="row"><input v-model="copyFrom.path" type="text" class="pfad" /><button class="x" @click="filePicker({ value: copyFrom.path, dirOnly: true, title: $t('📁 Verzeichnis des alten Speichers (auf dem Server)'), onPick: p => { copyFrom.path = p } })" :title="$t('Verzeichnis auswählen')">📁</button></div>
      </td></tr>
      <template v-if="copyFrom.driver === 's3'">
        <tr><td class="muted">{{ $t("Endpoint") }}</td><td><input v-model="copyFrom.endpoint" type="text" style="width:100%" /></td></tr>
        <tr><td class="muted">{{ $t("Bucket") }}</td><td><input v-model="copyFrom.bucket" type="text" style="width:100%" /></td></tr>
        <tr><td class="muted">{{ $t("Key") }}</td><td><input v-model="copyFrom.key" type="text" style="width:100%" autocomplete="off" /></td></tr>
        <tr><td class="muted" :title="$t('Liegt verschlüsselt im Tresor beim Server, nie im Journal und nie im Browser.')">{{ $t("Secret") }}</td><td><input v-model="copyFrom.secret" type="password" style="width:100%" autocomplete="new-password" /></td></tr>
        <tr><td class="muted">{{ $t("Region") }}</td><td><input v-model="copyFrom.region" type="text" style="width:160px" /></td></tr>
      </template>
      <tr><td></td><td class="row"><button class="primary" :disabled="!!kopierBusy" @click="copy">{{ $t("⇥ Kopieren") }}</button>
        <span v-if="kopierBusy" class="muted" style="font-size:12px">{{ kopierBusy }}</span>
        <span v-else-if="copyResult" class="muted" style="font-size:12px">{{ $t("{0} kopiert · {1} bereits vorhanden", [copyResult.copied, copyResult.skipped]) }}<span v-if="copyResult.failed" class="neg">{{ ' ' + $t("· {0} fehlgeschlagen", [copyResult.failed]) }}</span></span></td></tr>
    </tbody></table>
  </div>
</template>

<style scoped>
table.form td { white-space: normal; vertical-align: middle; height: 34px; }
.row { display: flex; gap: 6px; align-items: center; }
</style>
