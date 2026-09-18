<script setup>
// ⌁ Plugins (docs/pflegestruktur.md, 19): links alles, was unter plugins/ liegt oder das Journal kennt,
// mit Stand und Fassung; rechts das gewählte — installieren, ein/aus, aktualisieren, entfernen,
// und bei Prozess-Plugins der Start mit Parametern und der Ausgabe.
import { ref, computed, onMounted } from 'vue'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { plugins } from '../plugins.js'
import Splitter from '../components/Splitter.vue'
import ProfileBar from '../components/ProfileBar.vue'
import { paneWidth } from '../panes.js'

const listW = paneWidth('plugins.list', 380)
const cur = ref(null)
const busy = ref('')
const run = ref({ params: {}, out: null })
const KIND = { import: '⇩ Import', export: '⇧ Export', quality: '✓ Qualität', tool: '🛠 Werkzeug' }
const current = computed(() => plugins.list.find(p => p.key === cur.value) ?? null)
const manifest = computed(() => current.value?.manifest ?? {})
const label = m => m?.label?.de || m?.label?.en || ''
const stateOf = p => !p.installed ? '— nicht installiert' : p.enabled ? '● an' : '○ aus'

onMounted(async () => { await plugins.load(); if (!cur.value) cur.value = plugins.list[0]?.key ?? null })
async function act(path, method = 'POST') {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  busy.value = '…'
  try { method === 'DELETE' ? await api.del(path) : await api.post(path, {}); await store.poll(true); await plugins.load() }
  catch (e) { store.toast(e.message) }
  finally { busy.value = '' }
}
function startParams() {
  const ps = manifest.value.process?.params ?? []
  run.value = { params: Object.fromEntries(ps.map(p => [p.key, p.type === 'bool' ? String(p.default ?? false) : String(p.default ?? '')])), out: null }
}
async function execute() {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  busy.value = 'läuft …'
  run.value.out = null
  try { run.value.out = await api.post(`/api/plugins/${cur.value}/run`, { params: run.value.params }); await store.poll(true) }
  catch (e) { store.toast(e.message) }
  finally { busy.value = '' }
}
function pick(k) { cur.value = k; startParams() }
</script>

<template>
  <div class="pane" :style="`width:${listW}px;flex:none`">
    <div class="toolbar"><h1>⌁ Plugins</h1><span class="muted">{{ plugins.list.length }}</span><span class="grow" /><span v-if="busy" class="muted">{{ busy }}</span></div>
    <div class="scroll">
      <div v-for="p in plugins.list" :key="p.key" class="li" :class="{ current: cur === p.key, off: !p.enabled }" @click="pick(p.key)" :title="p.key">
        <span class="k">{{ p.key }}</span>
        <span class="l">{{ label(p.manifest) || p.key }}</span>
        <span class="r">
          <span v-if="p.version" class="mono">{{ p.version }}</span>
          <span v-if="p.update" class="warn" :title="`auf der Platte: ${p.diskVersion}`">↑ {{ p.diskVersion }}</span>
          <span v-if="!p.onDisk" class="neg" title="Verzeichnis fehlt">✗</span>
          <span :class="p.enabled ? 'pos' : 'muted'">{{ stateOf(p) }}</span>
        </span>
      </div>
      <div v-if="plugins.loaded && !plugins.list.length" class="empty">Kein Plugin — ein Verzeichnis mit plugin.json unter plugins/ anlegen.</div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">plugins/&lt;key&gt;/plugin.json · Stand im Journal (plugin:&lt;key&gt;)</div>
  </div>
  <Splitter v-model="listW" :min="260" :max="800" />

  <div class="pane" style="flex:1" v-if="current">
    <div class="toolbar">
      <h1>⌁ {{ label(manifest) || current.key }}</h1><span class="mono muted">{{ current.key }}</span>
      <span class="muted">· {{ KIND[manifest.kind] ?? manifest.kind }} · {{ manifest.runs === 'process' ? '⚙ Prozess' : manifest.runs === 'office' ? (current.key === 'onlyoffice' ? '📗 OnlyOffice' : '📗 Excel-Add-in') : '🖥 Browser' }}{{ manifest.process ? ' + ⚙ Prozess' : '' }}</span>
      <span class="grow" />
      <template v-if="current.onDisk && !current.installed"><button class="primary" @click="act(`/api/plugins/${current.key}/install`)">⇩ installieren {{ current.diskVersion }}</button></template>
      <template v-else-if="current.installed">
        <button v-if="current.update" class="primary" @click="act(`/api/plugins/${current.key}/install`)" :title="`${current.version} → ${current.diskVersion}`">↑ aktualisieren auf {{ current.diskVersion }}</button>
        <button v-if="current.enabled" @click="act(`/api/plugins/${current.key}/disable`)">○ ausschalten</button>
        <button v-else class="primary" @click="act(`/api/plugins/${current.key}/enable`)">● einschalten</button>
        <button class="x" @click="act(`/api/plugins/${current.key}`, 'DELETE')" title="aus dem Journal entfernen — die Dateien bleiben">🗑</button>
      </template>
    </div>
    <div class="toolbar meta muted">
      <span>Fassung {{ current.version ?? '—' }}</span><span v-if="current.diskVersion && current.diskVersion !== current.version">· auf der Platte {{ current.diskVersion }}</span>
      <span v-if="!current.onDisk" class="neg">· Verzeichnis plugins/{{ current.key }} fehlt</span>
      <span class="grow" /><span v-if="current.lastAt">{{ when(current.lastAt) }} 👤 {{ current.lastActor }}</span>
    </div>
    <div class="scroll">
      <p style="padding:8px 8px 0">{{ manifest.description?.de || manifest.description?.en || '' }}</p>
      <div class="section" v-if="manifest.builtin">
        <h2>Ansicht</h2>
        <div class="muted" style="font-size:12px">Eingebaut in die Oberfläche — <router-link :to="manifest.builtin === 'solr' ? '/import/solr' : '/import/ixp'">⇩ Import → {{ manifest.builtin }}</router-link>{{ current.enabled ? '' : ' (aus — erst einschalten)' }}</div>
      </div>
      <div class="section" v-if="manifest.runs === 'office' && current.key === 'onlyoffice'">
        <h2>📗 In OnlyOffice einrichten</h2>
        <div class="muted" style="font-size:12px;line-height:1.6">
          Paket: <a :href="`/plugins/${current.key}/package.plugin`" download="journali.plugin">journali.plugin herunterladen</a> — in OnlyOffice Tabellen über Plugins → Plugin-Manager → „Plugin hinzufügen“ einbinden;
          Anleitung: <a :href="`/plugins/${current.key}/README.md`" target="_blank">README</a>. Leiste: <a :href="`/plugins/${current.key}/index.html`" target="_blank">index.html</a> (ausserhalb von OnlyOffice nur zur Ansicht).
        </div>
      </div>
      <div class="section" v-if="manifest.runs === 'office' && current.key !== 'onlyoffice'">
        <h2>📗 In Excel einrichten</h2>
        <div class="muted" style="font-size:12px;line-height:1.6">
          Manifest: <a :href="`/plugins/${current.key}/manifest.xml`" download="manifest.xml">manifest.xml herunterladen</a> — in Excel über einen vertrauenswürdigen Add-In-Katalog (freigegebener Ordner) oder „Mein Add-In hochladen“ einbinden;
          Anleitung: <a :href="`/plugins/${current.key}/README.md`" target="_blank">README</a>. Aufgabenbereich: <a :href="`/plugins/${current.key}/taskpane.html`" target="_blank">taskpane.html</a> (ausserhalb von Excel nur zur Ansicht).
          Office verlangt HTTPS — ausser für localhost.
        </div>
      </div>
      <div class="section" v-if="manifest.runs === 'browser' && !manifest.builtin">
        <h2>Ansichten</h2>
        <div class="chips"><router-link v-for="v in plugins.views.filter(x => x.key === current.key)" :key="v.path" :to="`/p/${current.key}/${v.path}`" class="chip">{{ v.icon }} {{ v.label }}</router-link>
          <span v-if="!plugins.views.some(x => x.key === current.key)" class="muted">{{ current.enabled ? 'keine (oder Modul nicht geladen — neu laden)' : 'aus' }}</span></div>
      </div>
      <div class="section" v-if="manifest.process">
        <h2>⚙ Prozess starten <span class="muted">· {{ manifest.process.command }} {{ (manifest.process.args ?? []).join(' ') }}</span></h2>
        <div class="chips" style="padding:4px 8px"><ProfileBar :key="current.key" :plugin="current.key" scope="run" :get="() => run.params" :set="p => { if (p) run.params = { ...run.params, ...p }; else startParams() }" /><span class="muted" style="font-size:12px">Parametersätze — im Journal, für alle</span></div>
        <table class="grid form"><colgroup><col style="width:180px" /><col style="width:420px" /></colgroup><tbody>
          <tr v-for="p in manifest.process.params ?? []" :key="p.key"><td class="attr" :title="p.key">{{ p.label || p.key }}</td>
            <td style="padding:2px 4px">
              <select v-if="p.type === 'bool'" v-model="run.params[p.key]" style="width:100%"><option value="true">✓ ja</option><option value="false">✗ nein</option></select>
              <input v-else v-model="run.params[p.key]" type="text" style="width:100%" :placeholder="p.placeholder || ''" />
            </td></tr>
        </tbody></table>
        <div class="chips" style="padding:6px 8px"><button class="primary" :disabled="!current.enabled || !!busy" @click="execute">▶ starten</button><span class="muted" style="font-size:12px">läuft im eigenen Prozess, redet nur über /api; Ausgabe kommt am Ende</span></div>
        <div v-if="run.out" class="section">
          <h2>Ausgabe <span :class="run.out.exit === 0 ? 'pos' : 'neg'">· Rückgabe {{ run.out.exit }}</span><span class="muted"> · {{ (run.out.ms / 1000).toFixed(1) }} s</span></h2>
          <pre class="out">{{ run.out.output || '(keine Ausgabe)' }}</pre>
        </div>
      </div>
      <div class="section">
        <h2>Manifest <span class="mono muted">plugins/{{ current.key }}/plugin.json</span></h2>
        <pre class="out">{{ JSON.stringify(manifest, null, 2) }}</pre>
      </div>
    </div>
  </div>
  <div v-else class="pane" style="flex:1"><div class="empty">Plugin links wählen.</div></div>
</template>

<style scoped>
.li { display: flex; align-items: center; gap: 8px; height: 26px; padding: 0 8px; white-space: nowrap; cursor: default; }
.li:hover { background: var(--hover); }
.li.current { background: var(--accent-soft); box-shadow: inset 2px 0 0 var(--accent); }
.li.off .l { color: var(--muted); }
.li .k { font-family: var(--mono); font-size: 12px; color: var(--muted); width: 70px; overflow: hidden; text-overflow: ellipsis; }
.li .l { overflow: hidden; text-overflow: ellipsis; }
.li .r { margin-left: auto; font-size: 11px; display: flex; gap: 8px; }
.section { padding: 10px 8px; border-top: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600; }
.form { width: auto; }
.form td.attr { white-space: nowrap; color: var(--muted); }
.out { margin: 0; padding: 8px; background: var(--cell); border-radius: 4px; font: 12px/1.4 var(--mono); white-space: pre-wrap; max-height: 420px; overflow: auto; }
.x { border: 0; background: none; color: var(--muted); padding: 0 3px; }
.x:hover { color: var(--neg); }
</style>
