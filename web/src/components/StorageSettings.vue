<script setup>
// Einstellungen → Storage (Taloan, 19.09.2026: „wo ich das alles einstellen kann“): Treiber des Medienspeichers — Postgres,
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
const missing = ref(null)
const copyFrom = ref({ driver: 'file', path: 'media', bucket: '', endpoint: '', key: '', secret: '', region: 'garage', pathStyle: true })
const copyResult = ref(null)

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
async function findMissing() {
  busy.value = 'zähle …'
  try { missing.value = await api.get('/api/media/missing') } catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
async function copy() {
  if (!store.actor) { store.toast('👤 Name fehlt'); return }
  if (!await dialog.confirm({ title: 'Blobs herüberkopieren', warn: `${copyFrom.value.driver === 'file' ? copyFrom.value.path : copyFrom.value.driver === 's3' ? 's3://' + copyFrom.value.bucket : 'postgres'} → ${state.value.kind}`, text: 'kopiert alles, was hier fehlt — Hash-geprüft, nichts wird gelöscht', ok: 'Kopieren' })) return
  busy.value = 'kopiere …'; copyResult.value = null
  try { copyResult.value = await api.post('/api/media/copy', { from: clean(copyFrom.value) }); missing.value = null }
  catch (e) { store.toast(e.message) }
  finally { busy.value = '' }
}
onMounted(load)
</script>

<template>
  <div class="section">
    <h2>▨ Medienspeicher <span class="muted">· aktiv: <span class="mono">{{ state.kind }}</span> · {{ state.total }} Medien<span v-if="state.error" class="neg"> · ✗ {{ state.error }}</span></span></h2>
    <table class="grid form" style="width:auto"><colgroup><col style="width:120px" /><col style="width:460px" /><col /></colgroup><tbody>
      <tr><td class="muted">Treiber</td><td><select v-model="cfg.driver" style="width:100%"><option v-for="[v, l] in DRIVERS" :key="v" :value="v">{{ l }}</option></select></td>
        <td class="muted" style="font-size:12px">Bytes nach SHA-256; das Journal kennt nur den Hash — der Treiber ist jederzeit wechselbar</td></tr>
      <tr v-if="cfg.driver === 'file'"><td class="muted">Verzeichnis</td><td>
        <div class="row"><input v-model="cfg.path" type="text" style="flex:1" placeholder="media (relativ zum Server) oder /data/media" /><button class="x" @click="filePicker({ value: cfg.path, dirOnly: true, title: '📁 Verzeichnis des Medienspeichers (auf dem Server)', onPick: p => { cfg.path = p } })" title="Verzeichnis auswählen">…</button></div>
      </td><td class="muted" style="font-size:12px">vom Server aus gesehen — im Container z. B. /data/media</td></tr>
      <template v-if="cfg.driver === 's3'">
        <tr><td class="muted">Endpoint</td><td><input v-model="cfg.endpoint" type="text" style="width:100%" placeholder="http://garage:3900" /></td><td class="muted" style="font-size:12px">Garage: 3900 ist die S3-API</td></tr>
        <tr><td class="muted">Bucket</td><td><input v-model="cfg.bucket" type="text" style="width:100%" placeholder="journali" /></td><td></td></tr>
        <tr><td class="muted">Key</td><td><input v-model="cfg.key" type="text" style="width:100%" placeholder="GK…" autocomplete="off" /></td><td></td></tr>
        <tr><td class="muted">Secret</td><td><input v-model="cfg.secret" type="password" style="width:100%" autocomplete="new-password" /></td><td class="muted" style="font-size:12px">liegt nur in media.json beim Server — nie im Journal</td></tr>
        <tr><td class="muted">Region</td><td class="row" style="gap:10px"><input v-model="cfg.region" type="text" style="width:160px" placeholder="garage" /><label><input type="checkbox" v-model="cfg.pathStyle" /> Pfad-Stil (endpoint/bucket/…)</label></td><td></td></tr>
      </template>
      <tr><td></td><td class="row"><button @click="check">prüfen</button><button class="primary" @click="save">Speichern</button><span class="muted" style="font-size:12px">{{ probe || busy }}</span></td><td></td></tr>
    </tbody></table>
  </div>

  <div class="section">
    <h2>Bestand</h2>
    <div class="row" style="gap:8px;align-items:center">
      <button @click="findMissing">Fehlbestand zählen</button>
      <span v-if="missing" :class="missing.missing.length ? 'neg' : 'pos'">{{ missing.missing.length ? `✗ ${missing.missing.length} von ${missing.total} ohne Bytes` : `✓ alle ${missing.total} da` }}</span>
    </div>
    <div v-if="missing?.missing.length" class="muted" style="font-size:12px;margin-top:4px;max-height:120px;overflow:auto">{{ missing.missing.slice(0, 50).map(m => m.name).join(' · ') }}{{ missing.missing.length > 50 ? ' …' : '' }}</div>
  </div>

  <div class="section">
    <h2>Herüberkopieren <span class="muted">· alle Blobs eines anderen Speichers, die hier fehlen — nach einem Treiberwechsel oder von einem alten Verzeichnis</span></h2>
    <table class="grid form" style="width:auto"><colgroup><col style="width:120px" /><col style="width:460px" /></colgroup><tbody>
      <tr><td class="muted">Quelle</td><td><select v-model="copyFrom.driver" style="width:100%"><option v-for="[v, l] in DRIVERS" :key="v" :value="v">{{ l }}</option></select></td></tr>
      <tr v-if="copyFrom.driver === 'file'"><td class="muted">Verzeichnis</td><td>
        <div class="row"><input v-model="copyFrom.path" type="text" style="flex:1" /><button class="x" @click="filePicker({ value: copyFrom.path, dirOnly: true, title: '📁 Verzeichnis des alten Speichers (auf dem Server)', onPick: p => { copyFrom.path = p } })" title="Verzeichnis auswählen">📁</button></div>
      </td></tr>
      <template v-if="copyFrom.driver === 's3'">
        <tr><td class="muted">Endpoint</td><td><input v-model="copyFrom.endpoint" type="text" style="width:100%" /></td></tr>
        <tr><td class="muted">Bucket</td><td><input v-model="copyFrom.bucket" type="text" style="width:100%" /></td></tr>
        <tr><td class="muted">Key</td><td><input v-model="copyFrom.key" type="text" style="width:100%" autocomplete="off" /></td></tr>
        <tr><td class="muted">Secret</td><td><input v-model="copyFrom.secret" type="password" style="width:100%" autocomplete="new-password" /></td></tr>
        <tr><td class="muted">Region</td><td><input v-model="copyFrom.region" type="text" style="width:160px" /></td></tr>
      </template>
      <tr><td></td><td class="row"><button class="primary" @click="copy">⇥ kopieren</button>
        <span v-if="copyResult" class="muted" style="font-size:12px">{{ copyResult.copied }} kopiert · {{ copyResult.skipped }} schon da<span v-if="copyResult.failed" class="neg"> · {{ copyResult.failed }} fehlgeschlagen</span></span></td></tr>
    </tbody></table>
  </div>
</template>

<style scoped>
table.form td { white-space: normal; vertical-align: middle; height: 34px; }
.section { padding: 10px 8px; border-top: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600; }
.row { display: flex; gap: 6px; align-items: center; }
</style>
