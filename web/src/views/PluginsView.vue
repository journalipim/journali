<script setup>
// ⌁ Plugins (docs/pflegestruktur.md, 19): links alles, was unter plugins/ liegt oder das Journal kennt,
// mit Stand und Fassung; rechts das gewählte — installieren, ein/aus, aktualisieren, entfernen,
// und bei Prozess-Plugins der Start mit Parametern und der Ausgabe.
import { ref, computed, onMounted } from 'vue'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { plugins } from '../plugins.js'
import { FIXED_TOPICS, topicOf } from '../topics.js'
import Splitter from '../components/Splitter.vue'
import { paneWidth } from '../panes.js'

const listW = paneWidth('plugins.list', 380)
const cur = ref(null)
const busy = ref('')
// Symbol in der Leiste je Plugin (Taloan): Einstellung des Nutzers, nicht des Plugins
// Jobs je Plugin (für „Jobs verwalten“): einmal geladen, wenn der Tasker an ist
const jobs = ref([])
onMounted(async () => { if (plugins.enabled('tasker')) { try { jobs.value = await api.get('/api/jobs') } catch {} } })
const jobCount = key => jobs.value.filter(j => j.plugin === key).length
// Leisten-Schalter nur, wenn eine Ansicht des Plugins in einer Gruppe ohne feste Basis liegt (Taloan: Import/Export sind sowieso da)
const railToggle = key => plugins.views.some(v => v.key === key && !FIXED_TOPICS.includes(topicOf(key, v.topic)))
function toggleRail(key) { const s = new Set(store.railOff); s.has(key) ? s.delete(key) : s.add(key); store.railOff = [...s]; store.save() }
const KIND = { import: '⇩ Import', export: '⇧ Export', quality: '✓ Qualität', tool: '⌁ Werkzeug', output: '▤ Ausgabe', edit: '✎ Pflege' }
const current = computed(() => plugins.list.find(p => p.key === cur.value) ?? null)
const manifest = computed(() => current.value?.manifest ?? {})
const label = m => m?.label?.de || m?.label?.en || ''
// Suche und Filter in der Liste (Taloan): Text über Key, Name, Beschreibung; Art (kind) und Zustand (an, aus, Update, nicht installiert)
const q = ref('')
const kindFilter = ref('')
const stateFilter = ref('')
const kinds = computed(() => [...new Set(plugins.list.map(p => p.manifest?.kind).filter(Boolean))].sort())
const shown = computed(() => {
  const s = q.value.trim().toLowerCase()
  return plugins.list.filter(p => (!kindFilter.value || p.manifest?.kind === kindFilter.value)
    && (!stateFilter.value || (stateFilter.value === 'on' ? p.enabled : stateFilter.value === 'off' ? p.installed && !p.enabled : stateFilter.value === 'update' ? p.update : !p.installed))
    && (!s || p.key.includes(s) || label(p.manifest).toLowerCase().includes(s) || (p.manifest?.description?.de ?? '').toLowerCase().includes(s) || (p.manifest?.kind ?? '').includes(s)))
})
const stateOf = p => !p.installed ? '— nicht installiert' : p.enabled ? '● an' : '○ aus'

onMounted(async () => { await plugins.load(); if (!cur.value) cur.value = plugins.list[0]?.key ?? null })
async function act(path, method = 'POST') {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  busy.value = '…'
  try { method === 'DELETE' ? await api.del(path) : await api.post(path, {}); await store.poll(true); await plugins.load() }
  catch (e) { store.toast(e.message) }
  finally { busy.value = '' }
}
function pick(k) { cur.value = k }
</script>

<template>
  <div class="pane" :style="`width:${listW}px;flex:none`">
    <div class="toolbar"><h1>⌁ Plugins</h1><span class="muted">{{ shown.length === plugins.list.length ? plugins.list.length : shown.length + ' von ' + plugins.list.length }}</span><span class="grow" /><span v-if="busy" class="muted">{{ busy }}</span></div>
    <div class="toolbar" style="gap:4px;flex-wrap:wrap;font-size:12px">
      <input v-model="q" type="search" placeholder="🔍 Key, Name, Beschreibung" style="flex:1;min-width:120px" @keydown.esc="q = ''" />
      <span v-for="k in kinds" :key="k" class="view-chip" :class="{ on: kindFilter === k }" @click="kindFilter = kindFilter === k ? '' : k" :title="'Art: ' + k">{{ KIND[k] ?? k }}</span>
      <span class="sep">·</span>
      <span v-for="[v, l] in [['on', '● an'], ['off', '○ aus'], ['update', '↑ Update'], ['new', '⇩ nicht installiert']]" :key="v" class="view-chip" :class="{ on: stateFilter === v }" @click="stateFilter = stateFilter === v ? '' : v">{{ l }}</span>
    </div>
    <div class="scroll">
      <div v-for="p in shown" :key="p.key" class="li" :class="{ current: cur === p.key, off: !p.enabled }" @click="pick(p.key)" :title="p.key">
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
      <span class="muted">· {{ KIND[manifest.kind] ?? manifest.kind }} · {{ manifest.runs === 'process' ? '⚙ Prozess' : manifest.runs === 'office' ? (current.key === 'onlyoffice' ? '▤ OnlyOffice' : '▤ Excel-Add-in') : '▭ Browser' }}{{ manifest.process ? ' + ⚙ Prozess' : '' }}</span>
      <span class="grow" />
      <template v-if="current.onDisk && !current.installed"><button class="primary" @click="act(`/api/plugins/${current.key}/install`)">⇩ installieren {{ current.diskVersion }}</button></template>
      <template v-else-if="current.installed">
        <button v-if="current.update" class="primary" @click="act(`/api/plugins/${current.key}/install`)" :title="`${current.version} → ${current.diskVersion}`">↑ aktualisieren auf {{ current.diskVersion }}</button>
        <button v-if="current.enabled && railToggle(current.key)" :class="{ primary: !store.railOff.includes(current.key) }" @click="toggleRail(current.key)" :title="store.railOff.includes(current.key) ? 'nicht in der Leiste links — Klick nimmt es wieder hinein (unter sein Thema)' : 'in der Leiste links unter seinem Thema — Klick nimmt es ganz heraus (nur für dich, in den Einstellungen)'">{{ store.railOff.includes(current.key) ? '▯ nicht in der Leiste' : '▮ in der Leiste' }}</button>
        <!-- Zustandsschalter wie „in der Leiste“ (Taloan): leuchtet, wenn an; Klick kippt -->
        <button :class="{ primary: current.enabled }" @click="act(`/api/plugins/${current.key}/${current.enabled ? 'disable' : 'enable'}`)" :title="current.enabled ? 'aktiviert — Klick deaktiviert' : 'deaktiviert — Klick aktiviert'">{{ current.enabled ? '● aktiviert' : '○ deaktiviert' }}</button>
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
        <div class="muted" style="font-size:12px">Eingebaut in die Oberfläche — <router-link :to="manifest.builtin === 'solr' ? '/import/solr' : manifest.builtin === 'table' ? '/export/table' : '/import/ixp'">{{ manifest.builtin === 'table' ? '⇪ Export → Tabelle' : '⇩ Import → ' + manifest.builtin }}</router-link>{{ current.enabled ? '' : ' (aus — erst einschalten)' }}</div>
      </div>
      <div class="section" v-if="manifest.runs === 'office' && current.key === 'onlyoffice'">
        <h2>▤ In OnlyOffice einrichten</h2>
        <div class="muted" style="font-size:12px;line-height:1.6">
          Paket: <a :href="`/plugins/${current.key}/package.plugin`" download="journali.plugin">journali.plugin herunterladen</a> — in OnlyOffice Tabellen über Plugins → Plugin-Manager → „Plugin hinzufügen“ einbinden;
          Anleitung: <a :href="`/plugins/${current.key}/README.md`" target="_blank">README</a>. Leiste: <a :href="`/plugins/${current.key}/index.html`" target="_blank">index.html</a> (ausserhalb von OnlyOffice nur zur Ansicht).
        </div>
      </div>
      <div class="section" v-if="manifest.runs === 'office' && current.key !== 'onlyoffice'">
        <h2>▤ In Excel einrichten</h2>
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
      <!-- Starten und Konfigurieren gehören nicht in die Verwaltung (Taloan, 19.09.): Prozesse laufen als Job (⏱ Jobs) -->
      <div class="section" v-if="manifest.process">
        <h2>⚙ Prozess <span class="muted">· {{ manifest.process.command }} {{ (manifest.process.args ?? []).join(' ') }}</span></h2>
        <div class="muted" style="font-size:12px;line-height:1.6">{{ manifest.process.description || 'Läuft als Kindprozess des Servers, unabhängig vom Browser.' }}
          <span v-if="manifest.process.params?.length">Parameter: {{ manifest.process.params.map(p => p.label || p.key).join(' · ') }}.</span></div>
        <div class="chips" style="padding:6px 0"><router-link class="primary" :to="`/p/tasker/jobs?new=${current.key}`" custom v-slot="{ navigate }"><button class="primary" :disabled="!current.enabled || !plugins.enabled('tasker')" :title="plugins.enabled('tasker') ? 'neuer Job mit diesem Plugin — der Assistent des Taskers' : 'Jobs brauchen das Plugin tasker — erst einschalten'" @click="navigate">⏱ Als Job einrichten</button></router-link><router-link :to="`/p/tasker/jobs?plugin=${current.key}`" custom v-slot="{ navigate }"><button :disabled="!plugins.enabled('tasker')" title="die Jobs dieses Plugins im Tasker — Zeitplan, Läufe, Logs" @click="navigate">⏱ Jobs verwalten<span v-if="jobCount(current.key)" class="muted"> · {{ jobCount(current.key) }}</span></button></router-link><span class="muted" style="font-size:12px">{{ plugins.enabled('tasker') ? 'Zeitplan oder „nur von Hand“ — Parameter, Geheimnisse und Logs beim Job' : 'Jobs brauchen das Plugin tasker (⌁ Plugins → tasker → einschalten)' }}</span></div>
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
/* Manifest umbrechen — sonst schiebt eine lange Zeile die Seite breiter als das Fenster und die Knöpfe oben rechts aus dem Bild (Taloan) */
.out { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
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
.x { border: 0; background: none; color: var(--muted); padding: 0 3px; }
.x:hover { color: var(--neg); }
</style>
