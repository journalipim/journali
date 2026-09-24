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
import { paneWidth, columnWidths } from '../panes.js'
import { t } from '../i18n.js'
import { L } from '../i18n.js'

const listW = paneWidth('plugins.list', 380)
// Spaltenbreiten: am Kopf ziehen, Doppelklick setzt zurück; gemerkt je Browser. Die Bezeichnung nimmt den Rest
const cols = columnWidths('plugins', { key: 70, ver: 58, state: 104 }, { min: 36, max: 320 })
const cur = ref(null)
const busy = ref('')
// Symbol in der Leiste je Plugin: Einstellung des Nutzers, nicht des Plugins
// Jobs je Plugin (für „Jobs verwalten“): einmal geladen, wenn der Tasker an ist
const jobs = ref([])
onMounted(async () => { try { jobs.value = await api.get('/api/jobs') } catch {}; await loadCatalog() })
const jobCount = key => jobs.value.filter(j => j.plugin === key).length
// Leisten-Schalter nur, wenn das Plugin seine Gruppe allein bildet
const railToggle = key => plugins.views.some(v => v.key === key && !baseTopics.value.has(topicOf(key, v.topic)) && (entries.value[topicOf(key, v.topic)] ?? []).every(e => e.plugin === key))
function toggleRail(key) { const s = new Set(store.railOff); s.has(key) ? s.delete(key) : s.add(key); store.railOff = [...s]; store.save() }
const KIND = { import: t('⇩ Import'), export: t('⇧ Export'), quality: t('✓ Qualität'), tool: t('⌁ Werkzeug'), output: t('▤ Ausgabe'), edit: t('✎ Pflege'), classification: t('⌗ Klassifikation') }
const TOPIC_LABEL = { import: t('⇩ Import'), export: t('⇪ Export'), analysis: t('✓ Datenanalyse'), jobs: t('⏱ Jobs'), datasheet: t('▤ Datenblatt'), tools: t('⌁ Werkzeuge') }
const current = computed(() => plugins.list.find(p => p.key === cur.value) ?? null)
const manifest = computed(() => current.value?.manifest ?? {})
// Dienste: process (Schlüssel '') und processes[]
const services = computed(() => [...(manifest.value.process ? [{ key: '', ...manifest.value.process }] : []), ...(manifest.value.processes ?? [])])
const label = m => L(m?.label) || m?.label?.en || ''
// Suche und Filter in der Liste: Text über Key, Name, Beschreibung; Art (kind) und Zustand (an, aus, Update, nicht installiert)
const q = ref('')
const kindFilter = ref('')
const stateFilter = ref('')
// „mein Tarif": nur, was diese Anlage verwenden darf. Der Schalter erscheint nur, wenn überhaupt etwas fehlt —
// bei Pro+, Enterprise und Unlimited ist alles erlaubt, dann gäbe es nichts zu filtern
const nurTarif = ref(false)
const eingeschraenkt = computed(() => plugins.list.some(p => p.allowed === false))
const kinds = computed(() => [...new Set(plugins.list.map(p => p.manifest?.kind).filter(Boolean))].sort())
const shown = computed(() => {
  const s = q.value.trim().toLowerCase()
  const list = plugins.list.filter(p => (!kindFilter.value || p.manifest?.kind === kindFilter.value)
    && (!nurTarif.value || p.allowed !== false)
    && (!stateFilter.value || (stateFilter.value === 'on' ? p.enabled : stateFilter.value === 'off' ? p.installed && !p.enabled : stateFilter.value === 'update' ? p.update : stateFilter.value === 'cert' ? p.certified : !p.installed))
    && (!s || p.key.includes(s) || label(p.manifest).toLowerCase().includes(s) || (L(p.manifest?.description) ?? '').toLowerCase().includes(s) || (p.manifest?.kind ?? '').includes(s)))
  return [...list].sort((a, b) => cmp(a, b) || a.key.localeCompare(b.key, 'de'))
})

// Sortierung über die Spaltenköpfe.
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
// Tarife: was nicht zum Tarif der Instanz gehört, steht mit dem Tarif da, der es hat
const TARIF = { free: t('Kostenlos'), pro: 'Pro', proplus: 'Pro+', enterprise: t('Enterprise'), unlimited: t('Unlimited') }
const tarifOf = p => TARIF[p.tarif] ?? p.tarif ?? ''
const stateOf = p => p.allowed === false ? `◇ ${tarifOf(p)}` : !p.installed ? t('— nicht installiert') : !p.enabled ? '○ aus' : plugins.active(p.key) ? '● an' : t('◐ an, Basis aus')
const missing = key => plugins.requires(key).filter(r => !plugins.active(r))   // was fehlt, damit es wirkt
// Siegel: ❖ für ein Original (Signatur des Herausgebers passt, keine Datei verändert), ⚠ für ein gebrochenes, sonst
// nichts. Nach aussen heisst ❖ nicht „zertifiziert“ — das klänge nach einer Prüfstelle —, sondern: es ist ein Original.
const HERAUSGEBER = 'journali'
const sealOf = p => p.certified ? '❖' : p.sealReason ? '⚠' : ''
const sealName = p => p.sealIssuer === HERAUSGEBER || !p.sealIssuer ? t('journali Core Plugin') : t('Original von {0}', [p.sealIssuer])
const sealTitle = p => p.certified ? `${sealName(p)} · ${p.sealIssued ?? ''}` : p.sealReason ? t('Siegel gebrochen: {0}', [p.sealReason]) : ''
// Katalog des Herausgebers: was es an zertifizierten Plugins gibt — holen legt das Verzeichnis unter plugins/ ab, installiert wird danach wie sonst
const catalog = ref(null)
async function loadCatalog(fresh = false) { try { catalog.value = await api.get('/api/plugins/catalog' + (fresh ? '?fresh=true' : '')) } catch (e) { catalog.value = { plugins: [], error: e.message } } }
const catalogRows = computed(() => (catalog.value?.plugins ?? []).map(c => ({ ...c, key: c.entry.key, newer: c.onDisk && verCmp(c.entry.version, c.diskVersion) > 0 })))
async function fetchPlugin(key) {
  if (!store.actor) { store.toast(t('👤 Name fehlt → Einstellungen')); return }
  busy.value = '…'
  try { await api.post(`/api/plugins/catalog/${key}/fetch`, {}); await plugins.load(); await loadCatalog(); cur.value = key }
  catch (e) { store.toast(e.message) }
  finally { busy.value = '' }
}
// Ein/Aus: Einschalten braucht die Basis; Ausschalten einer Basis nimmt die Ergänzungen mit
async function toggle(p) {
  if (!p.enabled) { const m = missing(p.key); if (m.length) { store.toast(t('braucht {0} — zuerst einschalten', [m.join(', ')])); return } await act(`/api/plugins/${p.key}/enable`); return }
  const dep = plugins.dependents(p.key).filter(k => plugins.list.find(x => x.key === k)?.enabled)
  if (dep.length && !await dialog.confirm({ title: `${label(p.manifest) || p.key} deaktivieren?`, warn: t('Damit aus: {0}', [dep.join(', ')]), ok: t('Deaktivieren') })) return
  plugins.forgetInstalled(p.key)   // beim nächsten Einschalten wieder einrichten (install)
  await act(`/api/plugins/${p.key}/disable`)
}

onMounted(async () => { await plugins.load(); if (!cur.value) cur.value = plugins.list[0]?.key ?? null })
async function act(path, method = 'POST') {
  if (!store.actor) { store.toast(t('👤 Name fehlt → Einstellungen')); return }
  busy.value = '…'
  try { method === 'DELETE' ? await api.del(path) : await api.post(path, {}); await store.poll(true); await plugins.load() }
  catch (e) { store.toast(e.message) }
  finally { busy.value = '' }
}
function pick(k) { cur.value = k }
</script>

<template>
  <div class="pane" :style="{ width: listW + 'px', flex: 'none', ...cols.vars() }">
    <div class="toolbar"><h1>{{ $t("⌁ Plugins") }}</h1><span class="muted">{{ shown.length === plugins.list.length ? plugins.list.length : shown.length + ' von ' + plugins.list.length }}</span><span class="grow" /><span v-if="busy" class="muted">{{ busy }}</span></div>
    <div class="toolbar" style="gap:4px;flex-wrap:wrap;font-size:12px">
      <input v-model="q" type="search" :placeholder="$t('🔍 Key, Name, Beschreibung')" style="flex:1;min-width:120px" @keydown.esc="q = ''" />
      <span v-for="k in kinds" :key="k" class="view-chip" :class="{ on: kindFilter === k }" @click="kindFilter = kindFilter === k ? '' : k" :title="'Art: ' + k">{{ KIND[k] ?? k }}</span>
      <span class="sep">·</span>
      <span v-for="[v, l] in [['on', '● an'], ['off', '○ aus'], ['update', $t('↑ Update')], ['new', $t('⇩ nicht installiert')], ['cert', $t('❖ Core')]]" :key="v" class="view-chip" :class="{ on: stateFilter === v }" @click="stateFilter = stateFilter === v ? '' : v">{{ l }}</span>
      <span v-if="eingeschraenkt" class="view-chip" :class="{ on: nurTarif }" @click="nurTarif = !nurTarif" :title="$t('nur, was diese Anlage verwenden darf — mit den anderen Filtern zusammen')">{{ $t("◆ mein Tarif") }}</span>
    </div>
    <div class="li head">
      <span class="k" :title="$t('nach Key sortieren{0}', [sortBy === 'key' ? ' ' + $t('— Klick dreht die Richtung') : ''])" @click="sortByCol('key')">{{ $t("Key{0}", [caret('key')]) }}<i class="grip" :title="$t('Spalte breiter oder schmaler ziehen; Doppelklick setzt zurück')" @mousedown="cols.zieh('key', $event)" @dblclick.stop="cols.zurueck()" /></span>
      <span class="l" :title="$t('nach Bezeichnung sortieren{0}', [sortBy === 'label' ? ' ' + $t('— Klick dreht die Richtung') : ''])" @click="sortByCol('label')">{{ $t("Bezeichnung{0}", [caret('label')]) }}</span>
      <span class="r">
        <span class="c-ver" :title="$t('nach Fassung sortieren{0}', [sortBy === 'version' ? ' ' + $t('— Klick dreht die Richtung') : ''])" @click="sortByCol('version')"><i class="grip left" :title="$t('Spalte breiter oder schmaler ziehen; Doppelklick setzt zurück')" @mousedown="cols.zieh('ver', $event)" @dblclick.stop="cols.zurueck()" />{{ $t("Fassung{0}", [caret('version')]) }}</span>
        <span class="c-seal" />
        <span class="c-state" :title="$t('nach Zustand sortieren (an, Basis fehlt, aus, nicht installiert){0}', [sortBy === 'state' ? ' ' + $t('— Klick dreht die Richtung') : ''])" @click="sortByCol('state')"><i class="grip left" :title="$t('Spalte breiter oder schmaler ziehen; Doppelklick setzt zurück')" @mousedown="cols.zieh('state', $event)" @dblclick.stop="cols.zurueck()" />{{ $t("Zustand{0}", [caret('state')]) }}</span>
      </span>
    </div>
    <div class="scroll">
      <div v-for="p in shown" :key="p.key" class="li" :class="{ current: cur === p.key, off: !p.enabled }" @click="pick(p.key)" :title="p.key">
        <span class="k">{{ p.key }}</span>
        <span class="l">{{ label(p.manifest) || p.key }}</span>
        <span class="r">
          <!-- feste Spalten: Fassung, Siegel, Zustand — damit sie untereinander stehen, gleich wie lang die Bezeichnung ist -->
          <span class="c-ver mono">{{ p.version ?? '' }}<span v-if="p.update" class="warn" :title="$t('auf der Platte: {0}', [p.diskVersion])"> ↑</span></span>
          <span class="c-seal"><span v-if="sealOf(p)" class="seal" :class="p.certified ? 'pos' : 'neg'" :title="sealTitle(p)">{{ sealOf(p) }}</span></span>
          <span class="c-state" :class="p.enabled && plugins.active(p.key) ? 'pos' : p.enabled ? 'warn' : 'muted'" :title="stateOf(p)">{{ stateOf(p) }}<span v-if="!p.onDisk" class="neg" :title="$t('Verzeichnis fehlt')"> ✗</span></span>
        </span>
      </div>
      <div v-if="plugins.loaded && !plugins.list.length" class="empty"><span :title="$t('Ein Verzeichnis mit plugin.json unter plugins/ anlegen.')">{{ $t("Kein Plugin") }}</span></div>
    </div>
    <div class="catalog" v-if="catalog">
      <div class="li head"><span :title="catalog.url">{{ $t("◇ Katalog · {0}", [catalogRows.length]) }}</span><span class="grow" /><span class="x" :title="$t('Katalog neu laden')" @click="loadCatalog(true)">↻</span></div>
      <div v-if="catalog.error" class="li muted" :title="catalog.error">{{ $t("nicht erreichbar") }}</div>
      <div v-for="c in catalogRows" :key="c.key" class="li" :title="$L(c.entry.description) || ''">
        <span class="k">{{ c.key }}</span>
        <span class="l">{{ $L(c.entry.label) || c.key }}</span>
        <span class="r">
          <span class="c-ver mono">{{ c.entry.version }}</span>
          <span v-if="c.onDisk && !c.newer" class="pos" :title="$t('liegt unter plugins/')">✓</span>
          <button v-else class="mini" :title="c.newer ? $t('neue Fassung holen: {0} → {1}', [c.diskVersion, c.entry.version]) : $t('Zip laden, Siegel prüfen, nach plugins/ legen')" @click.stop="fetchPlugin(c.key)">{{ c.newer ? '↑ ' + c.entry.version : $t('⇩ holen') }}</button>
        </span>
      </div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px"><span :title="$t('Stand im Journal unter plugin:<key>')">{{ $t("plugins/<key>/plugin.json") }}</span></div>
  </div>
  <Splitter v-model="listW" :min="260" :max="800" />

  <div class="pane" style="flex:1" v-if="current">
    <div class="toolbar">
      <h1>⌁ {{ label(manifest) || current.key }}</h1><span class="mono muted">{{ current.key }}</span>
      <span class="muted">· {{ KIND[manifest.kind] ?? manifest.kind }} · {{ manifest.runs === 'process' ? $t('⚙ Prozess') : manifest.runs === 'office' ? (current.key === 'onlyoffice' ? '▤ OnlyOffice' : '▤ Excel-Add-in') : $t('▭ Browser') }}{{ services.length ? ' + ⚙ ' + (services.length > 1 ? services.length + ' ' + $t('Dienste') : $t('Prozess')) : '' }}</span>
      <span class="grow" />
      <template v-if="current.onDisk && !current.installed"><button class="primary" :disabled="current.allowed === false" :title="current.allowed === false ? $t('Tarif {0}', [tarifOf(current)]) : ''" @click="act(`/api/plugins/${current.key}/install`)">{{ $t("⇩ installieren {0}", [current.diskVersion]) }}</button></template>
      <template v-else-if="current.installed">
        <button v-if="current.update" class="primary" @click="act(`/api/plugins/${current.key}/install`)" :title="`${current.version} → ${current.diskVersion}`">{{ $t("↑ aktualisieren auf {0}", [current.diskVersion]) }}</button>
        <button v-if="current.enabled && railToggle(current.key)" :class="{ primary: !store.railOff.includes(current.key) }" @click="toggleRail(current.key)" :title="store.railOff.includes(current.key) ? $t('In die Leiste links aufnehmen (unter sein Thema)') : $t('Aus der Leiste links nehmen (nur für dich, in den Einstellungen)')">{{ store.railOff.includes(current.key) ? $t('▯ nicht in der Leiste') : $t('▮ in der Leiste') }}</button>
        <!-- Zustandsschalter wie „in der Leiste“: leuchtet, wenn es wirkt; Klick kippt. Was der Tarif nicht trägt, wirkt
             nicht — auch wenn es im Journal an ist; dann steht der Tarif da, der es hätte -->
        <button :class="{ primary: plugins.active(current.key) }" :disabled="current.allowed === false && !current.enabled" @click="toggle(current)" :title="current.allowed === false ? (current.enabled ? $t('Aktiviert, aber ohne Wirkung — {0} gehört zum Tarif {1}', [current.key, tarifOf(current)]) : $t('Tarif {0}', [tarifOf(current)])) : current.enabled ? (plugins.active(current.key) ? $t('Deaktivieren (jetzt aktiviert)') : $t('aktiviert, aber ohne Wirkung:') + ' ' + missing(current.key).join(', ') + ' ' + $t('ist aus')) : missing(current.key).length ? 'braucht ' + missing(current.key).join(', ') : $t('Aktivieren (jetzt deaktiviert)')">{{ current.allowed === false ? `◇ ${tarifOf(current)}` : current.enabled ? (plugins.active(current.key) ? '● aktiviert' : '◐ aktiviert') : '○ deaktiviert' }}</button>
        <button class="x" @click="act(`/api/plugins/${current.key}`, 'DELETE')" :title="$t('aus dem Journal entfernen — die Dateien bleiben')">🗑</button>
      </template>
    </div>
    <div class="toolbar meta muted">
      <span>{{ $t("Fassung {0}", [current.version ?? '—']) }}</span><span v-if="current.diskVersion && current.diskVersion !== current.version">{{ $t("· auf der Platte {0}", [current.diskVersion]) }}</span>
      <span v-if="!current.onDisk" class="neg">{{ $t("· Verzeichnis plugins/{0} fehlt", [current.key]) }}</span>
      <span v-if="current.allowed === false && current.enabled" class="warn" :title="$t('Der Stand im Journal bleibt: kommt der Tarif zurück, wirkt es wieder.')">{{ $t("· aktiviert, ohne Wirkung") }}</span>
      <span v-if="current.certified" class="pos seal" :title="$t('Signatur des Herausgebers: Schlüssel, Fassung und alle Dateien sind unverändert')">· ❖ {{ sealName(current) }}</span>
      <span v-else-if="current.sealReason" class="neg seal" :title="current.sealReason">{{ $t("· ⚠ Siegel gebrochen") }}</span>
      <span class="grow" /><span v-if="current.lastAt">{{ when(current.lastAt) }} 👤 {{ current.lastActor }}</span>
    </div>
    <div class="scroll">
      <p style="padding:8px 8px 0">{{ $L(manifest.description) || manifest.description?.en || '' }}</p>
      <!-- Basis-Plugin und Abhängigkeiten: Basis = Grundfunktion einer Gruppe und Container für Ergänzungen -->
      <div class="chips" style="padding:4px 8px" v-if="manifest.base?.length || manifest.requires?.length || plugins.dependents(current.key).length">
        <span v-if="manifest.base?.length" class="chip" :title="$t('Basis-Plugin: Grundfunktion dieser Gruppe(n) der Leiste — solange es an ist, ist die Gruppe da')">{{ $t("◆ Basis · {0}", [manifest.base.map(t => TOPIC_LABEL[t] ?? t).join(', ')]) }}</span>
        <span v-for="r in manifest.requires ?? []" :key="r" class="chip" :class="{ neg: !plugins.active(r) }" :title="plugins.active(r) ? $t('braucht dieses Plugin — ist an') : $t('braucht dieses Plugin — ist aus, daher ohne Wirkung')" style="cursor:pointer" @click="pick(r)">{{ $t("braucht {0}", [r]) }}</span>
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
          <span v-if="!plugins.views.some(x => x.key === current.key)" class="muted">{{ current.enabled ? $t('keine (oder Modul nicht geladen — neu laden)') : 'aus' }}</span></div>
      </div>
      <!-- Starten und Konfigurieren gehören nicht in die Verwaltung: Prozesse laufen als Job (⏱ Jobs) -->
      <!-- ein Abschnitt je Dienst — process oder processes[] -->
      <div class="section" v-for="svc in services" :key="svc.key">
        <h2>⚙ {{ svc.label || $t('Prozess') }} <span class="muted">· {{ svc.command }} {{ (svc.args ?? []).join(' ') }}</span></h2>
        <div class="muted" style="font-size:12px;line-height:1.6">{{ svc.description || $t('Läuft als Kindprozess des Servers, unabhängig vom Browser.') }}
          <span v-if="svc.params?.length">{{ $t("Parameter: {0}.", [svc.params.map(p => p.label || p.key).join(' · ')]) }}</span></div>
        <div class="chips" style="padding:6px 0"><router-link class="primary" :to="`/p/tasker/jobs?new=${current.key}${svc.key ? '&service=' + svc.key : ''}`" custom v-slot="{ navigate }"><button class="primary" :disabled="!plugins.active(current.key)" :title="plugins.active(current.key) ? $t('neuer Job mit diesem Plugin — der Assistent unter ⏱ Jobs') : $t('Dieses Plugin ist in deinem Tarif nicht verfügbar. Ein Job damit liefe nicht.')" @click="navigate">{{ $t("⏱ Als Job einrichten") }}</button></router-link><router-link :to="`/p/tasker/jobs?plugin=${current.key}`" custom v-slot="{ navigate }"><button :title="$t('die Jobs dieses Plugins unter ⏱ Jobs — Zeitplan, Läufe, Logs')" @click="navigate">{{ $t("⏱ Jobs verwalten") }}<span v-if="jobCount(current.key)" class="muted"> · {{ jobCount(current.key) }}</span></button></router-link><span class="muted" style="font-size:12px"><span :title="$t('Zeitplan oder nur von Hand; Parameter, Geheimnisse und Logs stehen beim Job.')">{{ $t("Zeitplan · Parameter beim Job") }}</span></span></div>
      </div>
      <div class="section" v-if="current.certified || current.sealReason">
        <h2>{{ $t("❖ Herkunft") }} <span class="mono muted">{{ $t("plugins/{0}/certificate.json", [current.key]) }}</span></h2>
        <div class="muted" style="font-size:12px;line-height:1.6">
          <span v-if="current.certified" :title="$t('signiert vom Herausgeber; jede Änderung an den Dateien bricht das Siegel')">{{ sealName(current) }} · {{ current.sealIssued ?? '' }}</span>
          <span v-else class="neg">{{ current.sealReason }}</span>
        </div>
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
/* Manifest umbrechen — sonst schiebt eine lange Zeile die Seite breiter als das Fenster und die Knöpfe oben rechts aus dem Bild */
.out { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 12px; }
.li { display: flex; align-items: center; gap: 8px; height: 26px; padding: 0 8px; white-space: nowrap; cursor: default; }
/* Spaltenköpfe: sortieren per Klick, sonst still — gedämpft, abgesetzt, nicht auswählbar */
.li.head { color: var(--muted); font-size: 11px; border-bottom: 1px solid var(--line); height: 22px; user-select: none; }
.li.head span { cursor: pointer; }
.li.head span:hover { color: var(--fg); }
.li:hover { background: var(--hover); }
.li.current { background: var(--accent-soft); box-shadow: inset 2px 0 0 var(--accent); }
.li.off .l { color: var(--muted); }
.li .k { font-family: var(--mono); font-size: 12px; color: var(--muted); width: var(--c-key); flex: none; overflow: hidden; text-overflow: ellipsis; }
.li .l { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.li .r { margin-left: auto; flex: none; font-size: 11px; display: flex; gap: 8px; align-items: center; }
/* feste Breiten rechts: jede Spalte steht in jeder Zeile an derselben Stelle */
.c-ver { width: var(--c-ver); text-align: right; white-space: nowrap; }
.c-seal { width: 14px; flex: none; text-align: center; }
.c-state { width: var(--c-state); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.li.head .k, .li.head .c-ver, .li.head .c-state { position: relative; }
/* Griff am Rand der Kopfzelle: schmal, unsichtbar, bis die Maus darüber steht */
.grip { position: absolute; top: 0; bottom: 0; right: -4px; width: 9px; cursor: col-resize; }
.grip.left { right: auto; left: -8px; }
.grip:hover { background: var(--accent); opacity: .5; }
.form { width: auto; }
.form td.attr { white-space: nowrap; color: var(--muted); }
.x { border: 0; background: none; color: var(--muted); padding: 0 3px; }
.x:hover { color: var(--neg); }
.seal { font-size: 12px; }
.catalog { border-top: 1px solid var(--line); max-height: 40%; overflow: auto; }
.mini { font-size: 11px; padding: 0 6px; height: 20px; }
</style>
