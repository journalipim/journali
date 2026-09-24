<script setup>
// ⌁ Plugins (docs/pflegestruktur.md, 19): links alles, was unter plugins/ liegt oder das Journal kennt,
// mit Stand und Fassung; rechts das gewählte — installieren, ein/aus, aktualisieren, entfernen,
// und bei Prozess-Plugins der Start mit Parametern und der Ausgabe.
import { ref, computed, onMounted } from 'vue'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { plugins } from '../plugins.js'
import { baseTopics, topicOf, entries } from '../topics.js'
import { dialog } from '../dialog.js'
import Splitter from '../components/Splitter.vue'
import { paneWidth } from '../panes.js'

const listW = paneWidth('plugins.list', 380)
const cur = ref(null)
const busy = ref('')
// Symbol in der Leiste je Plugin (Taloan): Einstellung des Nutzers, nicht des Plugins
// Jobs je Plugin (für „Jobs verwalten“): einmal geladen, wenn der Tasker an ist
const jobs = ref([])
onMounted(async () => { try { jobs.value = await api.get('/api/jobs') } catch {} })
const jobCount = key => jobs.value.filter(j => j.plugin === key).length
// Leisten-Schalter nur, wenn das Plugin seine Gruppe allein bildet (Taloan: json gehört zu Import/Export, ppwr zu Datenanalyse —
// Gruppen mit Basis oder mehreren Plugins sind sowieso da; datasheet ist seine Gruppe)
const railToggle = key => plugins.views.some(v => v.key === key && !baseTopics.value.has(topicOf(key, v.topic)) && (entries.value[topicOf(key, v.topic)] ?? []).every(e => e.plugin === key))
function toggleRail(key) { const s = new Set(store.railOff); s.has(key) ? s.delete(key) : s.add(key); store.railOff = [...s]; store.save() }
const KIND = { import: '⇩ Import', export: '⇧ Export', quality: '✓ Qualität', tool: '⌁ Werkzeug', output: '▤ Ausgabe', edit: '✎ Pflege', classification: '⌗ Klassifikation' }
const TOPIC_LABEL = { import: '⇩ Import', export: '⇪ Export', analysis: '✓ Datenanalyse', jobs: '⏱ Jobs', datasheet: '▤ Datenblatt', tools: '⌁ Werkzeuge' }
const current = computed(() => plugins.list.find(p => p.key === cur.value) ?? null)
const manifest = computed(() => current.value?.manifest ?? {})
// Dienste: process (Schlüssel '') und processes[] (Taloan, 19.09.: mehrere Dienste je Plugin)
const services = computed(() => [...(manifest.value.process ? [{ key: '', ...manifest.value.process }] : []), ...(manifest.value.processes ?? [])])
const label = m => m?.label?.de || m?.label?.en || ''
// Suche und Filter in der Liste (Taloan): Text über Key, Name, Beschreibung; Art (kind) und Zustand (an, aus, Update, nicht installiert)
const q = ref('')
const kindFilter = ref('')
const stateFilter = ref('')
const kinds = computed(() => [...new Set(plugins.list.map(p => p.manifest?.kind).filter(Boolean))].sort())
const shown = computed(() => {
  const s = q.value.trim().toLowerCase()
  const list = plugins.list.filter(p => (!kindFilter.value || p.manifest?.kind === kindFilter.value)
    && (!stateFilter.value || (stateFilter.value === 'on' ? p.enabled : stateFilter.value === 'off' ? p.installed && !p.enabled : stateFilter.value === 'update' ? p.update : !p.installed))
    && (!s || p.key.includes(s) || label(p.manifest).toLowerCase().includes(s) || (p.manifest?.description?.de ?? '').toLowerCase().includes(s) || (p.manifest?.kind ?? '').includes(s)))
  return [...list].sort((a, b) => cmp(a, b) || a.key.localeCompare(b.key, 'de'))
})

// Sortierung über die Spaltenköpfe (Taloan, 23.09.2026: „Spaltenköpfe, damit ich die Plugins sortieren kann").
// Key ist die Vorgabe und zugleich der zweite Schlüssel — gleiche Fassung oder gleicher Zustand bleiben so vorhersehbar.
const sortBy = ref('key')
const sortDesc = ref(false)
const caret = c => sortBy.value !== c ? '' : sortDesc.value ? ' ▾' : ' ▴'
/// Zustand als Rang: an, an mit fehlender Basis, aus, nicht installiert — so, wie man es sucht
const rank = p => !p.installed ? 3 : !p.enabled ? 2 : plugins.active(p.key) ? 0 : 1
/// Fassungen vergleichen sich nach Zahlen, nicht nach Zeichen: 1.10.0 steht über 1.9.0
const ver = v => String(v ?? '').split('.').map(x => parseInt(x, 10) || 0)
function verCmp(a, b) { const x = ver(a), y = ver(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] ?? 0) - (y[i] ?? 0); if (d) return d } return 0 }
function cmp(a, b) {
  const d = sortBy.value === 'label' ? label(a.manifest).localeCompare(label(b.manifest), 'de')
    : sortBy.value === 'version' ? verCmp(a.version, b.version)
    : sortBy.value === 'state' ? rank(a) - rank(b)
    : a.key.localeCompare(b.key, 'de')
  return sortDesc.value ? -d : d
}
function sortByCol(col) { if (sortBy.value === col) sortDesc.value = !sortDesc.value; else { sortBy.value = col; sortDesc.value = false } }
// Tarife (Taloan, 24.09.2026): was nicht zum Tarif der Instanz gehört, steht mit dem Tarif da, der es hat
const TARIF = { free: 'Kostenlos', pro: 'Pro', proplus: 'Pro+', enterprise: 'Enterprise', unlimited: 'Unlimited' }
const tarifOf = p => TARIF[p.tarif] ?? p.tarif ?? ''
const stateOf = p => p.allowed === false ? `◇ ${tarifOf(p)}` : !p.installed ? '— nicht installiert' : !p.enabled ? '○ aus' : plugins.active(p.key) ? '● an' : '◐ an, Basis aus'
const missing = key => plugins.requires(key).filter(r => !plugins.active(r))   // was fehlt, damit es wirkt
// Ein/Aus (Taloan: Basis-Plugins sind der Container): Einschalten braucht die Basis; Ausschalten einer Basis nimmt die Ergänzungen mit
async function toggle(p) {
  if (!p.enabled) { const m = missing(p.key); if (m.length) { store.toast(`braucht ${m.join(', ')} — zuerst einschalten`); return } await act(`/api/plugins/${p.key}/enable`); return }
  const dep = plugins.dependents(p.key).filter(k => plugins.list.find(x => x.key === k)?.enabled)
  if (dep.length && !await dialog.confirm({ title: `${label(p.manifest) || p.key} deaktivieren?`, warn: `Damit aus: ${dep.join(', ')}`, ok: 'Deaktivieren' })) return
  plugins.forgetInstalled(p.key)   // beim nächsten Einschalten wieder einrichten (install)
  await act(`/api/plugins/${p.key}/disable`)
}

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
    <div class="toolbar"><h1>{{ $t("⌁ Plugins") }}</h1><span class="muted">{{ shown.length === plugins.list.length ? plugins.list.length : shown.length + ' von ' + plugins.list.length }}</span><span class="grow" /><span v-if="busy" class="muted">{{ busy }}</span></div>
    <div class="toolbar" style="gap:4px;flex-wrap:wrap;font-size:12px">
      <input v-model="q" type="search" :placeholder="$t('🔍 Key, Name, Beschreibung')" style="flex:1;min-width:120px" @keydown.esc="q = ''" />
      <span v-for="k in kinds" :key="k" class="view-chip" :class="{ on: kindFilter === k }" @click="kindFilter = kindFilter === k ? '' : k" :title="'Art: ' + k">{{ KIND[k] ?? k }}</span>
      <span class="sep">·</span>
      <span v-for="[v, l] in [['on', '● an'], ['off', '○ aus'], ['update', '↑ Update'], ['new', '⇩ nicht installiert']]" :key="v" class="view-chip" :class="{ on: stateFilter === v }" @click="stateFilter = stateFilter === v ? '' : v">{{ l }}</span>
    </div>
    <div class="li head">
      <span class="k" :title="`nach Key sortieren${sortBy === 'key' ? ' — Klick dreht die Richtung' : ''}`" @click="sortByCol('key')">{{ $t("Key{0}", [caret('key')]) }}</span>
      <span class="l" :title="`nach Bezeichnung sortieren${sortBy === 'label' ? ' — Klick dreht die Richtung' : ''}`" @click="sortByCol('label')">{{ $t("Bezeichnung{0}", [caret('label')]) }}</span>
      <span class="r">
        <span :title="`nach Fassung sortieren${sortBy === 'version' ? ' — Klick dreht die Richtung' : ''}`" @click="sortByCol('version')">{{ $t("Fassung{0}", [caret('version')]) }}</span>
        <span :title="`nach Zustand sortieren (an, Basis fehlt, aus, nicht installiert)${sortBy === 'state' ? ' — Klick dreht die Richtung' : ''}`" @click="sortByCol('state')">{{ $t("Zustand{0}", [caret('state')]) }}</span>
      </span>
    </div>
    <div class="scroll">
      <div v-for="p in shown" :key="p.key" class="li" :class="{ current: cur === p.key, off: !p.enabled }" @click="pick(p.key)" :title="p.key">
        <span class="k">{{ p.key }}</span>
        <span class="l">{{ label(p.manifest) || p.key }}</span>
        <span class="r">
          <span v-if="p.version" class="mono">{{ p.version }}</span>
          <span v-if="p.update" class="warn" :title="`auf der Platte: ${p.diskVersion}`">↑ {{ p.diskVersion }}</span>
          <span v-if="!p.onDisk" class="neg" :title="$t('Verzeichnis fehlt')">✗</span>
          <span :class="p.enabled && plugins.active(p.key) ? 'pos' : p.enabled ? 'warn' : 'muted'">{{ stateOf(p) }}</span>
        </span>
      </div>
      <div v-if="plugins.loaded && !plugins.list.length" class="empty"><span :title="$t('Ein Verzeichnis mit plugin.json unter plugins/ anlegen.')">{{ $t("Kein Plugin") }}</span></div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px"><span :title="$t('Stand im Journal unter plugin:<key>')">{{ $t("plugins/<key>/plugin.json") }}</span></div>
  </div>
  <Splitter v-model="listW" :min="260" :max="800" />

  <div class="pane" style="flex:1" v-if="current">
    <div class="toolbar">
      <h1>⌁ {{ label(manifest) || current.key }}</h1><span class="mono muted">{{ current.key }}</span>
      <span class="muted">· {{ KIND[manifest.kind] ?? manifest.kind }} · {{ manifest.runs === 'process' ? '⚙ Prozess' : manifest.runs === 'office' ? (current.key === 'onlyoffice' ? '▤ OnlyOffice' : '▤ Excel-Add-in') : '▭ Browser' }}{{ services.length ? ' + ⚙ ' + (services.length > 1 ? services.length + ' Dienste' : 'Prozess') : '' }}</span>
      <span class="grow" />
      <template v-if="current.onDisk && !current.installed"><button class="primary" :disabled="current.allowed === false" :title="current.allowed === false ? `Tarif ${tarifOf(current)}` : ''" @click="act(`/api/plugins/${current.key}/install`)">{{ $t("⇩ installieren {0}", [current.diskVersion]) }}</button></template>
      <template v-else-if="current.installed">
        <button v-if="current.update" class="primary" @click="act(`/api/plugins/${current.key}/install`)" :title="`${current.version} → ${current.diskVersion}`">{{ $t("↑ aktualisieren auf {0}", [current.diskVersion]) }}</button>
        <button v-if="current.enabled && railToggle(current.key)" :class="{ primary: !store.railOff.includes(current.key) }" @click="toggleRail(current.key)" :title="store.railOff.includes(current.key) ? 'In die Leiste links aufnehmen (unter sein Thema)' : 'Aus der Leiste links nehmen (nur für dich, in den Einstellungen)'">{{ store.railOff.includes(current.key) ? '▯ nicht in der Leiste' : '▮ in der Leiste' }}</button>
        <!-- Zustandsschalter wie „in der Leiste“ (Taloan): leuchtet, wenn an; Klick kippt -->
        <button :class="{ primary: current.enabled }" :disabled="current.allowed === false && !current.enabled" @click="toggle(current)" :title="current.allowed === false ? `Tarif ${tarifOf(current)}` : current.enabled ? (plugins.active(current.key) ? 'Deaktivieren (jetzt aktiviert)' : 'aktiviert, aber ohne Wirkung: ' + missing(current.key).join(', ') + ' ist aus') : missing(current.key).length ? 'braucht ' + missing(current.key).join(', ') : 'Aktivieren (jetzt deaktiviert)'">{{ current.enabled ? (plugins.active(current.key) ? '● aktiviert' : '◐ aktiviert') : '○ deaktiviert' }}</button>
        <button class="x" @click="act(`/api/plugins/${current.key}`, 'DELETE')" :title="$t('aus dem Journal entfernen — die Dateien bleiben')">🗑</button>
      </template>
    </div>
    <div class="toolbar meta muted">
      <span>{{ $t("Fassung {0}", [current.version ?? '—']) }}</span><span v-if="current.diskVersion && current.diskVersion !== current.version">{{ $t("· auf der Platte {0}", [current.diskVersion]) }}</span>
      <span v-if="!current.onDisk" class="neg">{{ $t("· Verzeichnis plugins/{0} fehlt", [current.key]) }}</span>
      <span class="grow" /><span v-if="current.lastAt">{{ when(current.lastAt) }} 👤 {{ current.lastActor }}</span>
    </div>
    <div class="scroll">
      <p style="padding:8px 8px 0">{{ manifest.description?.de || manifest.description?.en || '' }}</p>
      <!-- Basis-Plugin und Abhängigkeiten (Taloan, 19.09.): Basis = Grundfunktion einer Gruppe und Container für Ergänzungen -->
      <div class="chips" style="padding:4px 8px" v-if="manifest.base?.length || manifest.requires?.length || plugins.dependents(current.key).length">
        <span v-if="manifest.base?.length" class="chip" :title="$t('Basis-Plugin: Grundfunktion dieser Gruppe(n) der Leiste — solange es an ist, ist die Gruppe da')">{{ $t("◆ Basis · {0}", [manifest.base.map(t => TOPIC_LABEL[t] ?? t).join(', ')]) }}</span>
        <span v-for="r in manifest.requires ?? []" :key="r" class="chip" :class="{ neg: !plugins.active(r) }" :title="plugins.active(r) ? 'braucht dieses Plugin — ist an' : 'braucht dieses Plugin — ist aus, daher ohne Wirkung'" style="cursor:pointer" @click="pick(r)">{{ $t("braucht {0}", [r]) }}</span>
        <span v-for="d in plugins.dependents(current.key)" :key="d" class="chip muted" :title="$t('hängt an diesem Plugin — geht mit aus')" style="cursor:pointer" @click="pick(d)">↳ {{ d }}</span>
      </div>
      <div class="section" v-if="manifest.runs === 'office' && current.key === 'onlyoffice'">
        <h2>{{ $t("▤ In OnlyOffice einrichten") }}</h2>
        <div class="muted" style="font-size:12px;line-height:1.6">{{ ' ' + $t("Paket:") + ' ' }}<a :href="`/plugins/${current.key}/package.plugin`" download="journali.plugin">{{ $t("journali.plugin herunterladen") }}</a> <span :title="$t('In OnlyOffice: Tabellen → Plugins → Plugin-Manager → Plugin hinzufügen.')">{{ $t("— einbinden") }}</span>{{ ' ' + $t("· Anleitung:") + ' ' }}<a :href="`/plugins/${current.key}/README.md`" target="_blank">{{ $t("README") }}</a>{{ $t(". Leiste:") + ' ' }}<a :href="`/plugins/${current.key}/index.html`" target="_blank">{{ $t("index.html") }}</a>{{ ' ' + $t("(ausserhalb von OnlyOffice nur zur Ansicht).") + ' ' }}</div>
      </div>
      <div class="section" v-if="manifest.runs === 'office' && current.key !== 'onlyoffice'">
        <h2>{{ $t("▤ In Excel einrichten") }}</h2>
        <div class="muted" style="font-size:12px;line-height:1.6">{{ ' ' + $t("Manifest:") + ' ' }}<a :href="`/plugins/${current.key}/manifest.xml`" download="manifest.xml">{{ $t("manifest.xml herunterladen") }}</a> <span :title="$t('In Excel über einen vertrauenswürdigen Add-In-Katalog (freigegebener Ordner) oder „Mein Add-In hochladen“.')">{{ $t("— einbinden") }}</span>{{ ' ' + $t("· Anleitung:") + ' ' }}<a :href="`/plugins/${current.key}/README.md`" target="_blank">{{ $t("README") }}</a>{{ $t(". Aufgabenbereich:") + ' ' }}<a :href="`/plugins/${current.key}/taskpane.html`" target="_blank">{{ $t("taskpane.html") }}</a> <span :title="$t('Ausserhalb von Excel nur zur Ansicht.')">{{ $t("· Ansicht") }}</span>{{ ' ' + $t("· HTTPS ausser für localhost") + ' ' }}</div>
      </div>
      <div class="section" v-if="manifest.runs === 'browser'">
        <h2>{{ $t("Ansichten") }}</h2>
        <div class="chips"><router-link v-for="v in plugins.views.filter(x => x.key === current.key)" :key="v.path" :to="`/p/${current.key}/${v.path}`" class="chip">{{ v.icon }} {{ v.label }}</router-link>
          <span v-if="!plugins.views.some(x => x.key === current.key)" class="muted">{{ current.enabled ? 'keine (oder Modul nicht geladen — neu laden)' : 'aus' }}</span></div>
      </div>
      <!-- Starten und Konfigurieren gehören nicht in die Verwaltung (Taloan, 19.09.): Prozesse laufen als Job (⏱ Jobs) -->
      <!-- ein Abschnitt je Dienst (Taloan: mehrere Dienste je Plugin) — process oder processes[] -->
      <div class="section" v-for="svc in services" :key="svc.key">
        <h2>⚙ {{ svc.label || 'Prozess' }} <span class="muted">· {{ svc.command }} {{ (svc.args ?? []).join(' ') }}</span></h2>
        <div class="muted" style="font-size:12px;line-height:1.6">{{ svc.description || 'Läuft als Kindprozess des Servers, unabhängig vom Browser.' }}
          <span v-if="svc.params?.length">{{ $t("Parameter: {0}.", [svc.params.map(p => p.label || p.key).join(' · ')]) }}</span></div>
        <div class="chips" style="padding:6px 0"><router-link class="primary" :to="`/p/tasker/jobs?new=${current.key}${svc.key ? '&service=' + svc.key : ''}`" custom v-slot="{ navigate }"><button class="primary" :disabled="!current.enabled" :title="$t('neuer Job mit diesem Plugin — der Assistent unter ⏱ Jobs')" @click="navigate">{{ $t("⏱ Als Job einrichten") }}</button></router-link><router-link :to="`/p/tasker/jobs?plugin=${current.key}`" custom v-slot="{ navigate }"><button :title="$t('die Jobs dieses Plugins unter ⏱ Jobs — Zeitplan, Läufe, Logs')" @click="navigate">{{ $t("⏱ Jobs verwalten") }}<span v-if="jobCount(current.key)" class="muted"> · {{ jobCount(current.key) }}</span></button></router-link><span class="muted" style="font-size:12px"><span :title="$t('Zeitplan oder nur von Hand; Parameter, Geheimnisse und Logs stehen beim Job.')">{{ $t("Zeitplan · Parameter beim Job") }}</span></span></div>
      </div>
      <div class="section">
        <h2>{{ $t("Manifest") + ' ' }}<span class="mono muted">{{ $t("plugins/{0}/plugin.json", [current.key]) }}</span></h2>
        <pre class="out">{{ JSON.stringify(manifest, null, 2) }}</pre>
      </div>
    </div>
  </div>
  <div v-else class="pane" style="flex:1"><div class="empty">{{ $t("Plugin links wählen.") }}</div></div>
</template>

<style scoped>
/* Manifest umbrechen — sonst schiebt eine lange Zeile die Seite breiter als das Fenster und die Knöpfe oben rechts aus dem Bild (Taloan) */
.out { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
.li { display: flex; align-items: center; gap: 8px; height: 26px; padding: 0 8px; white-space: nowrap; cursor: default; }
/* Spaltenköpfe (Taloan, 23.09.2026): sortieren per Klick, sonst still — gedämpft, abgesetzt, nicht auswählbar */
.li.head { color: var(--muted); font-size: 11px; border-bottom: 1px solid var(--line); height: 22px; user-select: none; }
.li.head span { cursor: pointer; }
.li.head span:hover { color: var(--fg); }
.li:hover { background: var(--hover); }
.li.current { background: var(--accent-soft); box-shadow: inset 2px 0 0 var(--accent); }
.li.off .l { color: var(--muted); }
.li .k { font-family: var(--mono); font-size: 12px; color: var(--muted); width: 70px; overflow: hidden; text-overflow: ellipsis; }
.li .l { overflow: hidden; text-overflow: ellipsis; }
.li .r { margin-left: auto; font-size: 11px; display: flex; gap: 8px; }
.form { width: auto; }
.form td.attr { white-space: nowrap; color: var(--muted); }
.x { border: 0; background: none; color: var(--muted); padding: 0 3px; }
.x:hover { color: var(--neg); }
</style>
