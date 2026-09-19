<script setup>
// ⇪ Export → Tabelle (fest eingebaut, Taloan 19.09.2026 — wie ⇩ Import → Tabelle): ein Teilbaum als Excel oder CSV,
// genau in der Form, die der Tabellenimport wieder liest. Strukturierte Daten (JSON) macht das Plugin json.
// Als Job: Plugin export (Prozess) mit denselben Einstellungen — ⏱ Jobs → + Job → Export: Tabelle.
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { store } from '../store.js'
import { tree, icon } from '../tree.js'
import { plugins } from '../plugins.js'
import { build, toCsv, toXlsx, download } from '../tableExport.js'
import TreePicker from '../components/TreePicker.vue'

const route = useRoute()
const saved = JSON.parse(localStorage.getItem('journali.export.table') || '{}')
// mehrere Teilbäume mit Haken (Taloan: „mit selektierbaren Knoten“) — Zeilen aller gewählten, jeder Knoten einmal
const roots = ref(route.query.node ? [route.query.node] : (saved.roots ?? []))
const role = ref(saved.role ?? '')
const locales = ref(saved.locales ?? [store.model?.masterLocale ?? 'de'])
const ownOnly = ref(saved.ownOnly ?? false)
const viewKey = ref(saved.viewKey ?? '')
const format = ref(saved.format ?? 'xlsx')
const rootRows = computed(() => roots.value.map(id => tree.byId.get(id)).filter(Boolean))
const busy = ref(''); const table = ref(null)
const persist = () => localStorage.setItem('journali.export.table', JSON.stringify({ roots: roots.value, role: role.value, locales: locales.value, ownOnly: ownOnly.value, viewKey: viewKey.value, format: format.value }))
onMounted(async () => { if (!tree.loaded) await tree.load(); if (!roots.value.length) roots.value = tree.rows.filter(r => !r.parent).slice(0, 1).map(r => r.id) })
function toggleLocale(c) { const s = new Set(locales.value); s.has(c) ? s.delete(c) : s.add(c); locales.value = store.model.locales.map(l => l.code).filter(x => s.has(x)); persist() }
async function run(downloadIt) {
  if (!roots.value.length) { store.toast('Teilbaum im Baum anhaken'); return } if (!locales.value.length) { store.toast('mindestens eine Sprache'); return }
  try {
    persist()
    // je gewählter Wurzel eine Tabelle, zusammengeführt — gleiche Spalten in derselben Reihenfolge, Zeilen einmal
    const parts = []; for (const r of roots.value) parts.push(await build({ root: r, role: role.value, locales: locales.value, ownOnly: ownOnly.value, viewKey: viewKey.value, say: m => { busy.value = m } }))
    const colKeys = [...new Set(parts.flatMap(p => p.columns.map(c => c.key)))]
    const columns = colKeys.map(k => parts.flatMap(p => p.columns).find(c => c.key === k))
    const seen = new Set(); const rows = []
    for (const p of parts) { const idx = p.columns.map(c => colKeys.indexOf(c.key)); for (const r of p.rows) { if (seen.has(r[0])) continue; seen.add(r[0]); const line = colKeys.map(() => ''); r.forEach((v, i) => { line[idx[i]] = v }); rows.push(line) } }
    const t = { columns, rows, count: rows.length }
    table.value = t; busy.value = `${t.count} Zeilen · ${t.columns.length} Spalten`
    if (!downloadIt) return
    const name = `${rootRows.value.map(r => r.label).join('+') || 'export'}-${role.value || 'alle'}-${locales.value.join('-')}`.replace(/[^\w.-]+/g, '_').slice(0, 80)
    if (format.value === 'csv') download(new Blob([toCsv(t)], { type: 'text/csv;charset=utf-8' }), name + '.csv')
    else download(await toXlsx(t), name + '.xlsx')
    store.toast(`⇪ ${t.count} Zeilen exportiert`, 'ok')
  } catch (e) { busy.value = '✗ ' + e.message; store.toast(e.message) }
}
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>⇪ Export</h1>
      <router-link to="/export/table" class="tab on">⊞ Tabelle</router-link>
      <router-link v-if="plugins.enabled('json')" to="/p/json/export" class="tab">{} JSON</router-link>
      <span class="grow" /><span class="muted">{{ busy }}</span></div>
    <table class="grid form"><colgroup><col style="width:84px" /><col /></colgroup><tbody>
      <tr class="step"><td colspan="2" class="step-band" style="display:table-cell;height:24px">1 · Was</td></tr>
      <tr><td class="attr">Teilbaum</td><td>
        <div class="chips" style="margin:2px 0 4px"><span v-for="r in rootRows" :key="r.id" class="chip">{{ icon(r.role) }} {{ r.label }}</span><span v-if="!rootRows.length" class="muted">Teilbäume anhaken — ein Haken gilt für alles darunter</span></div>
        <TreePicker v-model="roots" multi :height="220" />
      </td></tr>
      <tr><td class="attr">Knoten</td><td><select v-model="role" @change="persist" style="width:100%"><option value="">alle Knoten darunter</option><option value="group">▣ nur Gruppen</option><option value="product">▦ nur Produkte</option><option value="variant">◆ nur Varianten</option></select></td></tr>
      <tr><td class="attr">Sprachen</td><td><div class="chips"><span v-for="l in store.model?.locales ?? []" :key="l.code" class="view-chip" :class="{ on: locales.includes(l.code) }" @click="toggleLocale(l.code)">{{ l.code }}</span></div></td></tr>
      <tr><td class="attr">Attribute</td><td><select v-model="viewKey" @change="persist" style="width:100%"><option value="">◫ alle Attribute</option><option v-for="v in store.model?.views ?? []" :key="v.key" :value="v.key">◫ {{ v.label?.de || v.key }} ({{ v.level }})</option></select></td></tr>
      <tr><td class="attr">Werte</td><td><label><input type="checkbox" v-model="ownOnly" @change="persist" /> nur eigene Werte (geerbte leer lassen)</label></td></tr>
      <tr class="step"><td colspan="2" class="step-band" style="display:table-cell;height:24px">2 · Wie</td></tr>
      <tr><td class="attr">Format</td><td><select v-model="format" @change="persist" style="width:100%"><option value="xlsx">Excel (.xlsx)</option><option value="csv">CSV (; UTF-8, Excel-tauglich)</option></select></td></tr>
      <tr><td class="attr"></td><td><div class="row"><button @click="run(false)">Vorschau</button><button class="primary" @click="run(true)">⇪ herunterladen</button>
        <router-link v-if="plugins.enabled('export')" to="/jobs?new=export" custom v-slot="{ navigate }"><button @click="navigate" title="denselben Export regelmäßig als Datei in ein Verzeichnis — Plugin export (Prozess)">⏱ als Job</button></router-link><router-link v-if="plugins.enabled('export')" to="/jobs?plugin=export" custom v-slot="{ navigate }"><button @click="navigate" title="die Export-Jobs unter ⏱ Jobs — Zeitplan, Läufe, Logs">⏱ Jobs verwalten</button></router-link></div></td></tr>
    </tbody></table>
    <div class="step-band">3 · Vorschau <span class="muted">· erste 200 Zeilen</span></div>
    <div class="scroll">
      <table v-if="table" class="grid" style="width:auto"><thead><tr><th v-for="c in table.columns" :key="c.key" :title="c.attr ? `${c.attr} · ${c.locale}` : c.key">{{ c.key }}</th></tr></thead>
        <tbody><tr v-for="(r, i) in table.rows.slice(0, 200)" :key="i"><td v-for="(v, j) in r" :key="j" class="muted" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ v }}</td></tr></tbody></table>
      <div v-if="table && table.rows.length > 200" class="muted" style="padding:8px">… {{ table.rows.length - 200 }} weitere Zeilen in der Datei</div>
      <div v-if="!table" class="empty">Teilbaum wählen, dann Vorschau oder herunterladen.</div>
    </div>
  </div>
</template>

<style scoped>
.form { width: 100%; border-bottom: 1px solid var(--line); }
.form td { height: 30px; vertical-align: middle; white-space: normal; padding: 2px 4px; }
.form td.attr { color: var(--muted); white-space: nowrap; padding-left: 8px; }
.row { display: flex; gap: 6px; align-items: center; }
.row > input { flex: 1; min-width: 0; }
.tab { padding: 2px 10px; border-radius: 4px; color: var(--muted); text-decoration: none; font-size: 13px; }
.tab.on, .tab.router-link-active { background: var(--accent-soft); color: var(--text); }
</style>
