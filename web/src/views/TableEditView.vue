<script setup>
// Massenbearbeitung wie in Excel (Taloan, 17.09.2026): die Kinder eines Knotens — oder alle Nachfahren einer Rolle —
// als Zeilen, Attribute als Spalten; Zellen wie in der Knotenansicht, Änderungen sammeln sich (gelb) und gehen als
// ein Stapel ins Journal. Einfügen aus Excel (Tab-getrennt) füllt ab der markierten Zelle nach rechts und unten.
// Quelle: GET /api/nodes/{id}/table — Werte aufgelöst (geerbt kursiv), eigene Werte kennt der Server (own).
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api.js'
import { store } from '../store.js'
import { tree, icon } from '../tree.js'
import Cell from '../components/Cell.vue'
import ToggleCell from '../components/ToggleCell.vue'
import SelectCell from '../components/SelectCell.vue'
import DateCell from '../components/DateCell.vue'

const props = defineProps({ id: String, role: String, deep: String })
const router = useRouter()
const model = computed(() => store.model)
const locales = computed(() => model.value?.locales.map(l => l.code) ?? [])
const locale = ref(store.viewLocales?.[0] ?? 'de')
const data = ref(null)          // { node, columns, rows }
const busy = ref('')
const dirty = ref(new Map())    // `${id}|${attr}` → neuer Wert ('' = eigenen Wert löschen)
const viewKey = ref('')
const filter = ref('')
const roleLabel = { group: 'Gruppen', product: 'Produkte', variant: 'Varianten' }
const childRole = computed(() => props.role || (data.value?.rows[0]?.row.role ?? (data.value?.node.role === 'product' ? 'variant' : 'product')))
const views = computed(() => (model.value?.views ?? []).filter(v => v.level === childRole.value))

async function load() {
  busy.value = 'lade …'
  try {
    const q = new URLSearchParams({ locale: locale.value })
    if (props.role) q.set('role', props.role)
    if (props.deep === '1') q.set('deep', 'true')
    data.value = await api.get(`/api/nodes/${encodeURIComponent(props.id)}/table?${q}`)
    dirty.value = new Map()
  } catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
watch(() => [props.id, props.role, props.deep], load)
watch(locale, load)
onMounted(async () => { if (!tree.loaded) await tree.load(); load() })

// Spalten: nach Sicht geordnet (und beschränkt), sonst alle in Gruppenreihenfolge des Modells; Achsen der Variante sind fest
const columns = computed(() => {
  if (!data.value) return []
  const all = data.value.columns
  const v = views.value.find(x => x.key === viewKey.value)
  if (!v) return all
  const order = v.items.flatMap(it => it.order ?? [])
  const groupsOf = new Map((model.value?.groups ?? []).map(g => [g.key, g.attributes]))
  const wanted = new Set([...order, ...v.items.flatMap(it => it.group ? groupsOf.get(it.group) ?? [] : [])])
  return all.filter(c => wanted.has(c.key)).sort((a, b) => (order.indexOf(a.key) + 1 || 999) - (order.indexOf(b.key) + 1 || 999))
})
const editable = c => !['rows', 'html', 'formula'].includes(c.type)
const rows = computed(() => {
  if (!data.value) return []
  const q = filter.value.trim().toLowerCase()
  if (!q) return data.value.rows
  return data.value.rows.filter(r => r.row.label.toLowerCase().includes(q) || (r.row.sku ?? '').toLowerCase().includes(q) || Object.values(r.values).some(v => String(v.value ?? '').toLowerCase().includes(q)))
})
const key = (r, c) => `${r.row.id}|${c.key}`
const shown = (r, c) => dirty.value.has(key(r, c)) ? (dirty.value.get(key(r, c)) || null) : (r.values[c.key]?.own ? r.values[c.key].value : null)
const inherited = (r, c) => r.values[c.key]?.own ? null : r.values[c.key]?.value ?? null
const isAxis = (r, c) => r.row.role === 'variant' && (tree.byId.get(r.row.parent)?.axes ?? []).includes(c.key)
function set(r, c, v) {
  const k = key(r, c); const cur = r.values[c.key]?.own ? r.values[c.key].value : null
  const val = v == null ? '' : String(v)
  const m = new Map(dirty.value)
  if ((val || null) === cur) m.delete(k); else m.set(k, val)
  dirty.value = m
}
async function save() {
  if (!dirty.value.size) return
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  busy.value = `schreibe ${dirty.value.size} …`
  try {
    const defs = new Map(data.value.columns.map(c => [c.key, c]))
    const commands = [...dirty.value].map(([k, v]) => { const [node, attribute] = k.split('|'); const d = defs.get(attribute); return { op: 'attribute.set', args: { node, attribute, locale: d?.perLocale ? locale.value : null, value: v } } })
    const res = await api.post('/api/batch', { commands, batch: 'tab-' + Date.now().toString(36) })
    if (res.error) store.toast(`✗ ${res.error.message} — ${res.results.length} geschrieben`)
    else store.toast(`✓ ${res.results.length} Werte geschrieben`)
    await store.poll(true); await load()
  } catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
function discard() { dirty.value = new Map() }

// Einfügen aus Excel: Tab-getrennt, Zeilen mit Umbruch — ab der markierten Zelle nach rechts (nur bearbeitbare Spalten) und unten
function onPaste(e) {
  const td = document.activeElement?.closest?.('td.cell'); if (!td) return
  const text = e.clipboardData?.getData('text/plain'); if (!text || !text.includes('\t') && !text.includes('\n')) return
  e.preventDefault()
  const tr = td.parentElement; const ri = rows.value.findIndex(r => r.row.id === tr.dataset.id); const ci = [...tr.children].indexOf(td) - FIXED
  if (ri < 0 || ci < 0) return
  const lines = text.replace(/\r/g, '').split('\n').filter((l, i, a) => l !== '' || i < a.length - 1)
  const cols = columns.value.filter(editable)
  let n = 0
  lines.forEach((line, dy) => {
    const r = rows.value[ri + dy]; if (!r) return
    line.split('\t').forEach((v, dx) => { const c = columns.value.filter((_, i) => i >= ci).filter(editable)[dx]; if (c && !isAxis(r, c)) { set(r, c, v); n++ } })
  })
  store.toast(`${n} Zellen eingefügt — noch nicht gespeichert`)
}
const FIXED = 3   // feste Spalten vor den Attributen: Name, SKU, Achsen
function onKey(e) { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save() } }
onMounted(() => { document.addEventListener('paste', onPaste); document.addEventListener('keydown', onKey) })
onUnmounted(() => { document.removeEventListener('paste', onPaste); document.removeEventListener('keydown', onKey) })

// Export der Tabelle, wie sie dasteht (CSV, Semikolon, UTF-8 mit BOM — Excel öffnet das direkt)
function exportCsv() {
  const esc = v => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const head = ['id', 'name', 'sku', ...columns.value.map(c => c.perLocale ? `${c.key}_${locale.value}` : c.key)]
  const lines = [head.join(';'), ...rows.value.map(r => [r.row.id, r.row.label, r.row.sku ?? '', ...columns.value.map(c => shown(r, c) ?? inherited(r, c) ?? '')].map(esc).join(';'))]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${data.value.node.label}-${childRole.value}-${locale.value}.csv`; a.click(); URL.revokeObjectURL(a.href)
}
const listOf = c => model.value?.lists?.find(l => l.key === c.list)
const labelOf = c => v => { const lv = listOf(c)?.values.find(x => x.value === v); return lv?.label?.[locale.value] || lv?.label?.de || v }
</script>

<template>
  <div class="pane" style="flex:1" v-if="data">
    <div class="toolbar path">
      <router-link v-for="a in tree.ancestors(id)" :key="a.id" :to="`/tree/${a.id}`" class="crumb">{{ icon(a.role) }} {{ a.label }} ›</router-link>
      <router-link :to="`/tree/${id}`" class="crumb">{{ icon(data.node.role) }} {{ data.node.label }}</router-link>
      <h1>⊞ {{ roleLabel[childRole] ?? childRole }}{{ deep === '1' ? ' darunter' : '' }} <span class="muted">· {{ rows.length }}{{ filter ? ' von ' + data.rows.length : '' }}</span></h1>
      <span class="grow" />
      <span v-if="busy" class="muted">{{ busy }}</span>
      <span v-if="dirty.size" class="chip dirty" :title="`${dirty.size} geänderte Zellen — Strg+S speichert`">✎ {{ dirty.size }}</span>
      <button class="primary" :disabled="!dirty.size || !!busy" @click="save" title="alle Änderungen als ein Stapel ins Journal (Strg+S)">💾 speichern</button>
      <button :disabled="!dirty.size" @click="discard" title="Änderungen verwerfen">verwerfen</button>
      <button class="x" @click="exportCsv" title="Tabelle als CSV (Excel) herunterladen — Spalte id bringt sie über ⇩ Import → Tabelle zurück">⇪ CSV</button>
    </div>
    <div class="toolbar view">
      <span class="muted">Sprache</span>
      <span v-for="l in locales" :key="l" class="view-chip" :class="{ on: locale === l }" @click="locale = l">{{ l }}</span>
      <span class="sep">·</span>
      <select v-model="viewKey" title="Attributsicht: welche Spalten, in welcher Reihenfolge"><option value="">◫ alle Attribute ({{ data.columns.length }})</option><option v-for="v in views" :key="v.key" :value="v.key">◫ {{ v.label?.de || v.key }}</option></select>
      <input v-model="filter" type="search" placeholder="🔍 filtern" style="width:200px" />
      <span class="grow" />
      <span class="muted" style="font-size:12px">Einfügen aus Excel: Zelle markieren, Strg+V · <i>kursiv</i> = geerbt · 🔒 Achse</span>
    </div>
    <div class="scroll">
      <table class="grid values tab" :style="`width:${420 + columns.length * 180}px`">
        <colgroup><col style="width:220px" /><col style="width:110px" /><col style="width:90px" /><col v-for="c in columns" :key="c.key" style="width:180px" /></colgroup>
        <thead><tr>
          <th>{{ roleLabel[childRole] }}</th><th>SKU</th><th>Achsen</th>
          <th v-for="c in columns" :key="c.key" :title="`${c.key} · ${c.type}${c.perLocale ? ' · je Sprache' : ''}${c.unit ? ' · ' + c.unit : ''}`" :class="{ ro: !editable(c) }">{{ c.label?.de || c.key }}<span v-if="c.perLocale" class="muted"> {{ locale }}</span><span v-if="c.unit" class="muted"> {{ c.unit }}</span></th>
        </tr></thead>
        <tbody>
          <tr v-for="r in rows" :key="r.row.id" :data-id="r.row.id">
            <td class="attr"><router-link :to="`/tree/${r.row.id}`" :title="r.row.id">{{ icon(r.row.role) }} {{ r.row.label }}</router-link></td>
            <td class="mono muted">{{ r.row.sku ?? '' }}</td>
            <td class="muted" style="font-size:11px">{{ Object.values(r.row.axisValues ?? {}).join(' · ') }}</td>
            <template v-for="c in columns" :key="c.key">
              <td v-if="!editable(c) || isAxis(r, c)" class="cell"><div class="cell-box locked" :title="isAxis(r, c) ? 'Variantenachse — fest' : c.type + ' — in der Knotenansicht bearbeiten'" @dblclick="router.push(`/tree/${r.row.id}`)">{{ (shown(r, c) ?? inherited(r, c) ?? '').toString().replace(/<[^>]+>/g, ' ').slice(0, 80) }}<span v-if="isAxis(r, c)"> 🔒</span></div></td>
              <ToggleCell v-else-if="c.type === 'boolean'" :class="{ dirty: dirty.has(key(r, c)) }" :value="shown(r, c)" :inherited="inherited(r, c)" @save="v => set(r, c, v)" />
              <SelectCell v-else-if="c.type === 'enum' && !c.multiple" :class="{ dirty: dirty.has(key(r, c)) }" :value="shown(r, c)" :inherited="inherited(r, c)" :options="listOf(c)?.values.map(v => v.value) ?? []" :label-of="labelOf(c)" :required="!!c.required" @save="v => set(r, c, v)" />
              <DateCell v-else-if="c.type === 'date'" :class="{ dirty: dirty.has(key(r, c)) }" :value="shown(r, c)" :inherited="inherited(r, c)" @save="v => set(r, c, v)" />
              <Cell v-else :class="{ dirty: dirty.has(key(r, c)) }" :value="shown(r, c)" :inherited="inherited(r, c)" @save="v => set(r, c, v)" />
            </template>
          </tr>
        </tbody>
      </table>
      <div v-if="!data.rows.length" class="empty">Keine {{ roleLabel[childRole] }} unter {{ data.node.label }}.</div>
    </div>
  </div>
  <div v-else class="pane" style="flex:1"><div class="empty">…</div></div>
</template>

<style scoped>
.path { flex-wrap: wrap; row-gap: 2px; }
.crumb { color: var(--muted); text-decoration: none; }
.crumb:hover { color: var(--text); }
.tab th.ro { color: var(--muted); font-style: italic; }
.tab :deep(td.cell.dirty .cell-box), .tab :deep(td.dirty .cell-box) { background: var(--dirty); color: var(--toast); }
.cell-box.locked { color: var(--muted); font-style: italic; cursor: default; }
.chip.dirty { background: var(--dirty); color: var(--toast); }
</style>
