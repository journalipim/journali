<script setup>
// Zwei Dinge, die verschiedenen Leuten gehören (Taloan, 23.09.2026): der <b>Speicher</b> (Treiber, Zugang, Umzug) und die
// <b>Assets</b> (Vorschau-Ableitungen, Bestand). Der Schalter sagt, welcher Teil gezeigt wird — die Logik bleibt eine.
defineProps({ teil: { type: String, default: 'speicher' } })
// Einstellungen → Storage (Taloan, 19.09.2026: „wo ich das alles einstellen kann“): Treiber des Assetspeichers — Postgres,
// Verzeichnis, S3 (Garage, MinIO, AWS, R2 …); prüfen, speichern (media.json beim
// Server, nie im Journal), Fehlbestand sehen, Blobs von einem anderen Speicher herüberkopieren.
import { ref, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { filePicker } from '../filePicker.js'   // Dateibrowser des Servers — derselbe wie bei den Jobs (Taloan, 21.09.)

const DRIVERS = [['postgres', 'Postgres — Tabelle media_blob in der Journal-Datenbank'], ['file', 'Verzeichnis'], ['s3', 'S3 — Garage, MinIO, AWS, R2, Hetzner …']]
const cfg = ref({ driver: 'postgres', path: '', bucket: '', endpoint: '', key: '', secret: '', region: 'garage', pathStyle: true })
const state = ref({ kind: '', total: 0, error: null })
const probe = ref(''); const busy = ref('')
const zaehlBusy = ref('')   // Fehlbestand zählen
const kopierBusy = ref('')  // Assetmigration
const missing = ref(null)
const stats = ref(null)      // was im Speicher liegt: Zahl, Grösse, Arten
const n = x => (x ?? 0).toLocaleString('de-DE')
const kb = b => {
  const z = (x, e) => (x / e).toLocaleString('de-DE', { maximumFractionDigits: 1 })
  return !b ? '0kb' : b >= 1073741824 ? z(b, 1073741824) + 'gb' : b >= 1048576 ? z(b, 1048576) + 'mb' : Math.max(1, Math.round(b / 1024)) + 'kb'
}
const copyFrom = ref({ driver: 'file', path: 'media', bucket: '', endpoint: '', key: '', secret: '', region: 'garage', pathStyle: true })
const copyResult = ref(null)

// Vorschau-Presets (Taloan, 21.09.: „in den Einstellungen Basics definieren, welche Ableitungen beim Bilder-Import automatisch berechnet werden“)
const presets = ref([]); const presetBusy = ref('')
const FORMATS = ['webp', 'jpeg', 'png', 'avif']
async function loadPresets() { try { presets.value = (await api.get('/api/media/presets')).map(p => ({ ...p, labelDe: p.label?.de ?? p.key })) } catch (e) { store.toast(e.message) } }
async function savePreset(p) {
  try {
    const r = await api.post(`/api/media/presets/${encodeURIComponent(p.key)}`, { label: { de: p.labelDe, en: p.label?.en ?? p.labelDe }, width: Number(p.width), height: Number(p.height), format: p.format, quality: Number(p.quality), auto: p.auto }, 'PUT')
    await loadPresets()
    store.toast(r?.job ? `Preset „${p.key}“ gespeichert · Job „${r.job}“ rechnet nach` : `Preset „${p.key}“ gespeichert`, 'ok')
    if (r?.job) setTimeout(loadPresets, 3000)
  } catch (e) { store.toast(e.message) }
}
async function newPreset() {
  const key = await dialog.prompt({ title: 'Vorschau-Preset anlegen', text: 'Key (a-z, 0-9, _)', placeholder: 'z. B. shop, katalog, print_hires', ok: '+ Anlegen' })
  if (!key) return
  try { await api.post(`/api/media/presets/${encodeURIComponent(key.trim().toLowerCase())}`, { label: { de: key, en: key }, width: 1200, height: 1200, format: 'webp', quality: 82, auto: true }, 'PUT'); await loadPresets() } catch (e) { store.toast(e.message) }
}
async function deletePreset(p) {
  if (!await dialog.confirm({ title: `Preset „${p.key}“ entfernen?`, text: 'Gerechnete Ableitungen bleiben im Store, werden aber nicht mehr ausgeliefert.', ok: '🗑 Entfernen', danger: true })) return
  try { await api.del(`/api/media/presets/${encodeURIComponent(p.key)}`); await loadPresets() } catch (e) { store.toast(e.message) }
}
async function derive() { presetBusy.value = 'stoße an …'; try { const r = await api.post('/api/media/derive', {}); store.toast(`Job „${r.job}“ läuft — ⏱ Jobs zeigt den Fortschritt`, 'ok'); setTimeout(loadPresets, 3000) } catch (e) { store.toast(e.message) } finally { presetBusy.value = '' } }
onMounted(loadPresets)

const clean = c => ({ ...c, path: c.path || null, bucket: c.bucket || null, endpoint: c.endpoint || null, key: c.key || null, secret: c.secret || null, region: c.region || null })
async function load() {
  try {
    const s = await api.get('/api/media/store')
    state.value = { kind: s.kind, total: s.total ?? 0, error: s.error ?? (s.config ? null : 'Server älter als die Oberfläche — neu starten') }
    if (!s.config) return
    cfg.value = { driver: s.config.driver, path: s.config.path ?? '', bucket: s.config.bucket ?? '', endpoint: s.config.endpoint ?? '', key: s.config.key ?? '', secret: s.config.secret ?? '', region: s.config.region ?? 'garage', pathStyle: s.config.pathStyle ?? true }
  } catch (e) { state.value.error = e.message }
}
async function check() {
  probe.value = 'prüfe …'
  try { const r = await api.post('/api/media/store/probe', clean(cfg.value)); probe.value = r.error ? '✗ ' + r.error : '✓ ' + r.kind } catch (e) { probe.value = '✗ ' + e.message }
}
async function save() {
  if (!store.actor) { store.toast('👤 Name fehlt'); return }
  busy.value = 'speichere …'
  try { await api.post('/api/media/store', clean(cfg.value), 'PUT'); store.toast('Medienspeicher umgestellt — Blobs ggf. herüberkopieren', 'ok'); missing.value = null; await load() }
  catch (e) { store.toast(e.message) }
  finally { busy.value = '' }
}
async function loadStats() {
  // ein älterer Server kennt den Weg noch nicht — dann bleibt der Block weg statt halb gefüllt
  try { const x = await api.get('/api/media/stats'); stats.value = Array.isArray(x?.kinds) ? x : null } catch { stats.value = null }
}
async function findMissing() {
  zaehlBusy.value = 'zähle …'
  try { missing.value = await api.get('/api/media/missing') } catch (e) { store.toast(e.message) } finally { zaehlBusy.value = '' }
}
async function copy() {
  if (!store.actor) { store.toast('👤 Name fehlt'); return }
  if (!await dialog.confirm({ title: 'Assets aus dem anderen Speicher holen?', warn: `${copyFrom.value.driver === 'file' ? copyFrom.value.path : copyFrom.value.driver === 's3' ? 's3://' + copyFrom.value.bucket : 'postgres'} → ${state.value.kind}`, text: 'Alles, was hier fehlt (Hash-geprüft, nichts wird gelöscht)', ok: 'Kopieren' })) return
  kopierBusy.value = 'kopiere …'; copyResult.value = null
  try { copyResult.value = await api.post('/api/media/copy', { from: clean(copyFrom.value) }); missing.value = null }
  catch (e) { store.toast(e.message) }
  finally { kopierBusy.value = '' }
}
onMounted(() => { load(); loadStats() })
</script>

<template>
  <div class="section" v-if="teil === 'speicher'">
    <h2>▨ Assetspeicher <span class="muted">· aktiv: <span class="mono">{{ state.kind }}</span> · {{ state.total }} Assets<span v-if="state.error" class="neg"> · ✗ {{ state.error }}</span></span></h2>
    <table class="grid form" style="width:auto"><colgroup><col style="width:120px" /><col style="width:460px" /><col /></colgroup><tbody>
      <tr><td class="muted" title="Bytes werden nach SHA-256 abgelegt; das Journal kennt nur den Hash, der Treiber ist wechselbar.">Treiber</td><td><select v-model="cfg.driver" style="width:100%"><option v-for="[v, l] in DRIVERS" :key="v" :value="v">{{ l }}</option></select></td>
        <td></td></tr>
      <tr v-if="cfg.driver === 'file'"><td class="muted" title="Vom Server aus gesehen — im Container z. B. /data/media.">Verzeichnis</td><td>
        <div class="row"><input v-model="cfg.path" type="text" style="flex:1" placeholder="media (relativ zum Server) oder /data/media" /><button class="x" @click="filePicker({ value: cfg.path, dirOnly: true, title: '📁 Verzeichnis des Assetspeichers (auf dem Server)', onPick: p => { cfg.path = p } })" title="Verzeichnis auswählen">…</button></div>
      </td><td></td></tr>
      <template v-if="cfg.driver === 's3'">
        <tr><td class="muted" title="Garage: 3900 ist die S3-API.">Endpoint</td><td><input v-model="cfg.endpoint" type="text" style="width:100%" placeholder="http://garage:3900" /></td><td></td></tr>
        <tr><td class="muted">Bucket</td><td><input v-model="cfg.bucket" type="text" style="width:100%" placeholder="journali" /></td><td></td></tr>
        <tr><td class="muted">Key</td><td><input v-model="cfg.key" type="text" style="width:100%" placeholder="GK…" autocomplete="off" /></td><td></td></tr>
        <tr><td class="muted" title="Liegt nur in media.json beim Server, nie im Journal.">Secret</td><td><input v-model="cfg.secret" type="password" style="width:100%" autocomplete="new-password" /></td><td></td></tr>
        <tr><td class="muted">Region</td><td class="row" style="gap:10px"><input v-model="cfg.region" type="text" style="width:160px" placeholder="garage" /><label><input type="checkbox" v-model="cfg.pathStyle" /> Pfad-Stil (endpoint/bucket/…)</label></td><td></td></tr>
      </template>
      <tr><td></td><td class="row"><button @click="check">Prüfen</button><button class="primary" @click="save">Speichern</button><span class="muted" style="font-size:12px">{{ probe || busy }}</span></td><td></td></tr>
    </tbody></table>
  </div>

  <div class="section" v-if="teil === 'assets'">
    <h2 title="Für jedes ableitbare Asset vorausgerechnet, nie live; rechnet das Plugin derive nach jedem Hochladen.">▨ Vorschau-Presets <span class="muted">· Ableitungen</span></h2>
    <table class="grid form" style="width:auto"><thead><tr><th>Key</th><th>Bezeichnung</th><th title="längste Seite wird eingepasst, nie vergrößert">max B × H</th><th>Format</th><th>Qualität</th><th title="beim Import automatisch rechnen">auto</th><th title="gerechnet / ableitbare Assets (Bild, PDF)">Stand</th><th></th></tr></thead><tbody>
      <tr v-for="p in presets" :key="p.key">
        <td class="mono">{{ p.key }}</td>
        <td><input v-model="p.labelDe" type="text" style="width:140px" @change="savePreset(p)" /></td>
        <td class="row" style="gap:4px"><input v-model="p.width" type="number" min="16" max="20000" style="width:70px" @change="savePreset(p)" /> × <input v-model="p.height" type="number" min="16" max="20000" style="width:70px" @change="savePreset(p)" /></td>
        <td><select v-model="p.format" @change="savePreset(p)"><option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option></select></td>
        <td><input v-model="p.quality" type="number" min="1" max="100" style="width:60px" @change="savePreset(p)" /></td>
        <td><input v-model="p.auto" type="checkbox" @change="savePreset(p)" /></td>
        <td :class="p.pending ? 'warn' : 'pos'" :title="`${p.have} von ${p.images} ableitbaren Assets gerechnet${p.pending ? ' — ' + p.pending + ' fehlen' : ''}`">{{ p.have }} / {{ p.images }}</td>
        <td><button class="x" @click="deletePreset(p)" :disabled="p.key === 'thumb'" :title="p.key === 'thumb' ? 'Kachel der Bibliothek — bleibt' : 'Preset entfernen'">🗑</button></td>
      </tr>
    </tbody></table>
    <div class="row" style="gap:8px;margin-top:6px"><button @click="newPreset">+ Preset</button><button @click="derive" :disabled="!!presetBusy" title="Der Job läuft nach jedem Hochladen und nach jeder Änderung an einem Preset von selbst; hier von Hand.">▶ Jetzt rechnen</button><span class="muted" style="font-size:12px">{{ presetBusy }}</span></div>
  </div>

  <div class="section" v-if="teil === 'assets'">
    <h2>▨ Bestand <span v-if="stats" class="muted">· {{ n(stats.total) }} Assets · {{ kb(stats.bytes) }}</span></h2>
    <table v-if="stats" class="grid form" style="width:auto;margin-bottom:8px"><colgroup><col style="width:150px" /><col style="width:260px" /><col /></colgroup><tbody>
      <tr><td class="muted" title="Alle Assets im Journal, nach Art des Inhalts">Arten</td>
        <td class="mono">{{ stats.kinds.map(k => `${k.art} ${n(k.count)}`).join(' · ') }}</td>
        <td class="muted" style="font-size:12px">{{ stats.kinds.map(k => `${k.art} ${kb(k.bytes)}`).join(' · ') }}</td></tr>
      <tr><td class="muted" title="Bild oder PDF — nur daraus rechnet sich eine Vorschau; der Stand oben misst sich daran">ableitbar</td>
        <td class="mono">{{ n(stats.renderable) }} von {{ n(stats.total) }}</td>
        <td class="muted" style="font-size:12px">davon Bilder {{ n(stats.images) }}</td></tr>
      <tr><td class="muted" title="Gerechnete Vorschauen über alle Presets — sie liegen zusätzlich im Speicher">Ableitungen</td>
        <td class="mono">{{ n(stats.derived?.count) }}</td>
        <td class="muted" style="font-size:12px">{{ kb(stats.derived?.bytes) }}</td></tr>
      <tr><td class="muted" title="An keinem Knoten und in keiner Relation — sie liegen nur in der Bibliothek">ohne Verwendung</td>
        <td :class="stats.unused ? 'warn mono' : 'mono'">{{ n(stats.unused) }}</td>
        <td class="muted" style="font-size:12px"><span v-if="stats.unfiled">{{ n(stats.unfiled) }} in keinem Ordner</span></td></tr>
      <tr><td class="muted" title="Gleiche Bytes unter mehreren Assets — im Speicher liegen sie nur einmal">gleicher Inhalt</td>
        <td class="mono">{{ n(stats.shared) }}</td>
        <td class="muted" style="font-size:12px">{{ (stats.largest ?? []).map(g => `${g.name} ${kb(g.bytes)}`).join(' · ') }}</td></tr>
    </tbody></table>
    <div class="row" style="gap:8px;align-items:center">
      <button :disabled="!!zaehlBusy" @click="findMissing">Fehlbestand zählen</button>
      <span v-if="zaehlBusy" class="muted" style="font-size:12px">{{ zaehlBusy }}</span>
      <span v-else-if="missing" :class="missing.missing.length ? 'neg' : 'pos'">{{ missing.missing.length ? `✗ ${missing.missing.length} von ${missing.total} Assets fehlen im Speicher` : `✓ alle ${missing.total} Assets vorhanden` }}</span>
    </div>
    <div v-if="missing?.missing.length" class="muted" style="font-size:12px;margin-top:4px;max-height:120px;overflow:auto">{{ missing.missing.slice(0, 50).map(m => m.name).join(' · ') }}{{ missing.missing.length > 50 ? ' …' : '' }}</div>
  </div>

  <div class="section" v-if="teil === 'speicher'">
    <h2 title="Holt die Assets eines anderen Speichers, die hier fehlen — nach einem Treiberwechsel oder aus einem alten Verzeichnis.">▨ Assetmigration <span class="muted">· fehlende Assets</span></h2>
    <table class="grid form" style="width:auto"><colgroup><col style="width:120px" /><col style="width:460px" /></colgroup><tbody>
      <tr><td class="muted">Quelle</td><td><select v-model="copyFrom.driver" style="width:100%"><option v-for="[v, l] in DRIVERS" :key="v" :value="v">{{ l }}</option></select></td></tr>
      <tr v-if="copyFrom.driver === 'file'"><td class="muted">Verzeichnis</td><td>
        <div class="row"><input v-model="copyFrom.path" type="text" style="flex:1" /><button class="x" @click="filePicker({ value: copyFrom.path, dirOnly: true, title: '📁 Verzeichnis des alten Speichers (auf dem Server)', onPick: p => { copyFrom.path = p } })" title="Verzeichnis auswählen">📁</button></div>
      </td></tr>
      <template v-if="copyFrom.driver === 's3'">
        <tr><td class="muted">Endpoint</td><td><input v-model="copyFrom.endpoint" type="text" style="width:100%" /></td></tr>
        <tr><td class="muted">Bucket</td><td><input v-model="copyFrom.bucket" type="text" style="width:100%" /></td></tr>
        <tr><td class="muted">Key</td><td><input v-model="copyFrom.key" type="text" style="width:100%" autocomplete="off" /></td></tr>
        <tr><td class="muted" title="Liegt nur in media.json beim Server, nie im Journal.">Secret</td><td><input v-model="copyFrom.secret" type="password" style="width:100%" autocomplete="new-password" /></td></tr>
        <tr><td class="muted">Region</td><td><input v-model="copyFrom.region" type="text" style="width:160px" /></td></tr>
      </template>
      <tr><td></td><td class="row"><button class="primary" :disabled="!!kopierBusy" @click="copy">⇥ Kopieren</button>
        <span v-if="kopierBusy" class="muted" style="font-size:12px">{{ kopierBusy }}</span>
        <span v-else-if="copyResult" class="muted" style="font-size:12px">{{ copyResult.copied }} kopiert · {{ copyResult.skipped }} bereits vorhanden<span v-if="copyResult.failed" class="neg"> · {{ copyResult.failed }} fehlgeschlagen</span></span></td></tr>
    </tbody></table>
  </div>
</template>

<style scoped>
table.form td { white-space: normal; vertical-align: middle; height: 34px; }
.row { display: flex; gap: 6px; align-items: center; }
</style>
