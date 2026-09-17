<script setup>
// Ein Knoten: Pfad, Kopf nach Rolle, die Attributgruppen, die hier gelten (am Pfad
// angehängt, Definition vererbt), darin die Attribute als Gitter Attribut × Achse.
// Gruppen, die hier nicht aktiv sind (aktiv ab tieferem Knotentyp), sind sichtbar,
// aber gesperrt — oder mit „nur bearbeitbare“ weg. Sicht je Knotentyp ordnet
// Gruppen und Attribute; flach untereinander oder als Reiter. Jede Änderung ist
// ein Befehl an den Server = ein Eintrag.
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { tree, icon } from '../tree.js'
import { menu } from '../menu.js'
import Cell from '../components/Cell.vue'
import ToggleCell from '../components/ToggleCell.vue'
import SelectCell from '../components/SelectCell.vue'
import DateCell from '../components/DateCell.vue'
import HtmlCell from '../components/HtmlCell.vue'
import RowsBlock from '../components/RowsBlock.vue'
import EntryList from '../components/EntryList.vue'

const props = defineProps({ id: String })
const router = useRouter()

const node = ref(null)
const entries = ref([])
const newCategory = ref('')
const busy = ref(false)
const tab = ref('')
const addGroup = ref('')

const model = computed(() => store.model)
const locales = computed(() => model.value?.locales.map(l => l.code) ?? [])
const channels = computed(() => model.value?.channels.map(c => c.key) ?? [])
const path = computed(() => tree.ancestors(props.id))
const roleLabel = { group: 'Produktgruppe', product: 'Produkt', variant: 'Variante' }

// ---- Sicht (Sprachen/Kanal als Spalten)
const viewLocales = computed(() => locales.value.filter(l => store.viewLocales.includes(l)))
const columns = computed(() => {
  const cols = [{ locale: null, channel: null, label: '*' }]
  for (const l of viewLocales.value) cols.push({ locale: l, channel: null, label: l })
  const c = store.viewChannel
  if (c && channels.value.includes(c)) {
    cols.push({ locale: null, channel: c, label: `*/${c}` })
    for (const l of viewLocales.value) cols.push({ locale: l, channel: c, label: `${l}/${c}` })
  }
  return cols
})
function toggleLocale(l) { const s = new Set(store.viewLocales); s.has(l) ? s.delete(l) : s.add(l); store.viewLocales = locales.value.filter(c => s.has(c)); store.save() }
function setChannel(c) { store.viewChannel = c || null; store.save() }

// ---- Attributsicht je Knotentyp
const views = computed(() => (model.value?.views ?? []).filter(v => v.level === node.value?.role))
const view = computed(() => views.value.find(v => v.key === store.viewKey[node.value?.role]) ?? null)
// „alles“ ordnet nach der Standardsicht des Knotentyps (defaultview_<rolle>), wenn es sie gibt — sonst alphabetisch.
const orderView = computed(() => view.value ?? views.value.find(v => v.key === 'defaultview_' + node.value?.role) ?? null)
function setView(k) { store.viewKey = { ...store.viewKey, [node.value.role]: k }; store.save() }
function setLayout(l) { store.layout = l; store.save() }
function toggleEditableOnly() { store.editableOnly = !store.editableOnly; store.save() }

// ---- Die Gruppen, die hier gelten, in Sichtreihenfolge; darin die Attribute in Sichtreihenfolge
const blocks = computed(() => {
  if (!model.value || !node.value) return []
  const eff = node.value.groups ?? []               // [{ key, from, fromLabel, active, attributes }]
  const byKey = new Map(eff.map(g => [g.key, g]))
  const ov = orderView.value
  const order = ov ? ov.items.map(it => it.group).filter(k => byKey.has(k)) : eff.map(g => g.key)
  // „alles“: Gruppen, die die Standardsicht nicht nennt, unten dran. Eine gewählte Sicht zeigt nur ihre Gruppen (Taloan, 17.09.).
  if (ov && !view.value) for (const g of eff) if (!order.includes(g.key)) order.push(g.key)
  const req = k => model.value.attributes.find(a => a.key === k)?.required
  return order.map(k => {
    const g = byKey.get(k)
    const it = ov?.items.find(x => x.group === k)
    const ord = (it?.order ?? []).filter(a => g.attributes.includes(a))
    const keys = [...ord, ...g.attributes.filter(a => !ord.includes(a))]
    const defs = keys.map(a => model.value.attributes.find(x => x.key === a)).filter(Boolean).map(a => ({ ...a, required: req(a.key) }))
    const def = model.value.groups.find(x => x.key === k)
    return { key: k, label: def?.label?.de || k, activeFrom: def?.activeFrom, from: g.from, fromLabel: g.fromLabel, active: g.active, defs }
  }).filter(b => b.defs.length && (!store.editableOnly || b.active))
})
watch(blocks, b => { if (store.layout === 'tabs' && !b.some(x => x.key === tab.value)) tab.value = b[0]?.key ?? '' }, { immediate: true })
const shownBlocks = computed(() => store.layout === 'tabs' ? blocks.value.filter(b => b.key === tab.value) : blocks.value)

// ---- Werte
const own = computed(() => valueMap(node.value?.values ?? []))
function valueMap(values) {
  const m = new Map()
  for (const v of values) m.set(key(v.attribute, v.locale, v.channel, v.row), v.values ? v.values.join(', ') : v.value)
  return m
}
function key(a, l, c, row) { return `${a}|${l ?? ''}|${c ?? ''}${row ? '|' + row : ''}` }
function ownValue(a, col) { return own.value.get(key(a, col.locale, col.channel)) ?? null }
function fallback(m, a, col) {
  if (col.channel && m.has(key(a, col.locale, null))) return m.get(key(a, col.locale, null))
  if ((col.locale || col.channel) && m.has(key(a, null, null))) return m.get(key(a, null, null))
  return null
}
const ancestorMaps = computed(() => (node.value?.ancestors ?? []).map(an => ({ an, m: valueMap(an.values) })))
// Wie Tree.Resolve: hier (genaue Achse, ohne Kanal, ohne Sprache), dann den Pfad hinauf — nur wenn das Attribut vererbbar ist.
function inherited(def, col) {
  const here = fallback(own.value, def.key, col)
  if (here != null) return { value: here, from: null }
  if (!def.inheritable) return { value: null, from: null }
  for (const { an, m } of ancestorMaps.value) {
    const v = m.get(key(def.key, col.locale, col.channel)) ?? fallback(m, def.key, col)
    if (v != null) return { value: v, from: an }
  }
  return { value: null, from: null }
}
function enabled(def, col, block) {
  return block.active && (!col.locale || def.perLocale) && (!col.channel || def.perChannel)
    && (!col.channel || !def.channels || def.channels.includes(col.channel))
}
function listOptions(def) { return (model.value.lists.find(l => l.key === def.list)?.values ?? []).map(v => v.value) }
function listLabel(def) { const vals = model.value.lists.find(l => l.key === def.list)?.values ?? []; return v => vals.find(x => x.value === v)?.label?.de || v }
function released(channel, locale) { return node.value?.releases.some(r => r.channel === channel && r.locale === locale) ?? false }
function axisLabel(a) { return model.value?.attributes.find(x => x.key === a)?.label?.de || a }
function axisValue(a, col) { return node.value?.role === 'variant' && !col.locale && !col.channel && a in node.value.axisValues ? node.value.axisValues[a] : null }
function completeness(channel, locale) { return (node.value?.completeness ?? []).find(c => c.channel === channel && c.locale === locale) ?? null }
function incomplete(channel, locale) {
  if (locale) return completeness(channel, locale)?.missing?.length ? completeness(channel, locale) : null
  const all = (node.value?.completeness ?? []).filter(c => c.channel === channel && c.missing.length)
  return all.length ? { missing: all.flatMap(c => c.missing.map(m => m + (m.includes('/') ? '' : '/' + c.locale))) } : null
}
// ---- Name im Baum: eigener Name (Rechtsklick im Baum → Umbenennen) oder das ★ an einem Attribut unten
const shownLabel = computed(() => tree.byId.get(props.id)?.label ?? props.id)
// Alle ★ am Pfad, das nächste zuerst; es zählt das erste, dessen Attribut hier gilt und einen Wert hat.
const star = key => (node.value?.stars ?? []).find(s => s.attribute === key) ?? null
const starOwn = key => star(key)?.from === props.id
function starTitle(def) {
  const s = star(def.key)
  if (!s) return `☆ ab hier nach unten mit ${def.label?.de || def.key} benennen`
  const where = s.from === props.id ? 'hier gesetzt, gilt ab hier nach unten' : `geerbt von ${s.fromLabel} — gilt, bis hier ein eigenes gesetzt wird`
  const applies = s.applies ? '' : ` — gilt hier nicht (erst wo ${def.label?.de || def.key} erfasst wird), bis dahin zählt das nächste ★ weiter oben`
  return `★ benennt ${where}${applies} — Klick ${s.from === props.id ? 'nimmt es weg' : 'setzt es hier neu'}`
}
const freeGroups = computed(() => (model.value?.groups ?? []).map(g => g.key).filter(k => !(node.value?.groups ?? []).some(g => g.key === k)))

// ---- Laden
async function load() {
  try {
    node.value = await api.get(`/api/nodes/${encodeURIComponent(props.id)}`)
    entries.value = (await api.get(`/api/streams/${encodeURIComponent(props.id)}`)).reverse()
  } catch (e) {
    if (e.message.startsWith('404')) router.push('/tree')
    else store.toast(e.message)
  }
}
onMounted(load)
function onKey(e) {
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return
  if (e.key === 'Escape') router.push('/tree')
  else if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo() }
  else if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
watch(() => store.head, h => { if (h > (entries.value[0]?.number ?? 0)) load() })

// ---- Befehle
async function command(fn) {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  busy.value = true
  try { const entry = await fn(); entries.value.unshift(entry); await load(); tree.load() }
  catch (e) { store.toast(e.message) }
  finally { busy.value = false }
}
const nodeUrl = () => `/api/nodes/${encodeURIComponent(props.id)}`
// Rückgängig/Wiederholen je Knoten: das Journal bleibt append-only — der alte Wert wird als neuer Eintrag geschrieben.
const history = ref([])   // { def, col, row, before, after }
const redoStack = ref([])
const setValue = (def, col, value, row = null) => {
  const before = own.value.get(key(def.key, col.locale, col.channel, row)) ?? ''
  history.value.push({ def, col, row, before, after: value }); redoStack.value = []
  return writeValue(def, col, value, row)
}
function undo() { const h = history.value.pop(); if (!h) return; redoStack.value.push(h); writeValue(h.def, h.col, h.before, h.row) }
function redo() { const h = redoStack.value.pop(); if (!h) return; history.value.push(h); writeValue(h.def, h.col, h.after, h.row) }
const writeValue = (def, col, value, row = null) => command(() =>
  api.post(`${nodeUrl()}/attributes`, def.multiple
    ? { attribute: def.key, locale: col.locale, channel: col.channel, values: value.split(',').map(s => s.trim()).filter(Boolean), row }
    : { attribute: def.key, locale: col.locale, channel: col.channel, value, row }))
const addRow = def => command(() => api.post(`${nodeUrl()}/rows`, { attribute: def.key, row: '' }))
const removeRow = (def, row) => command(() => api.del(`${nodeUrl()}/rows/${def.key}/${row}`))
const orderRows = (def, rows) => command(() => api.post(`${nodeUrl()}/rows/${def.key}`, { attribute: def.key, rows }, 'PUT'))
// ★ am eigenen Sternchen nimmt es weg; sonst setzt es dieses Attribut ab hier.
const setStar = def => command(() => api.post(`${nodeUrl()}/label-attribute`, { attribute: starOwn(def.key) ? null : def.key }, 'PUT'))
const setStatus = s => command(() => api.post(`${nodeUrl()}/status`, { status: s }))
const attach = groups => command(() => api.post(`${nodeUrl()}/groups`, { groups }, 'PUT'))
function attachAdd() { const g = addGroup.value; if (!g) return; addGroup.value = ''; attach([...node.value.attachedGroups, g]) }
function addCategory() { const c = newCategory.value.trim(); if (!c) return; newCategory.value = ''; command(() => api.post(`${nodeUrl()}/categories`, { category: c })) }
const removeCategory = c => command(() => api.del(`${nodeUrl()}/categories/${encodeURIComponent(c)}`))
function toggleRelease(channel, locale) {
  const q = `channel=${encodeURIComponent(channel)}` + (locale ? `&locale=${encodeURIComponent(locale)}` : '')
  command(() => released(channel, locale) ? api.del(`${nodeUrl()}/releases?${q}`) : api.post(`${nodeUrl()}/releases`, { channel, locale }))
}
function countBelow(id) { let n = 0; for (const k of tree.kids(id)) n += 1 + countBelow(k.id); return n }
async function retire() {
  const kids = node.value.children
  if (kids && !window.confirm(`${tree.byId.get(props.id)?.label ?? props.id} mit allen ${countBelow(props.id)} Knoten darunter zurückziehen?\n\nDas Journal behält alles; der Baum zeigt sie nicht mehr.`)) return
  try {
    const r = await api.del(nodeUrl() + (kids ? '?recursive=true' : ''))
    if (r?.retired) store.toast(`${r.retired} Knoten zurückgezogen (Stapel ${r.batch})`, 'ok')
    const p = node.value.parent; await tree.load(); router.push(p ? `/tree/${p}` : '/tree')
  } catch (e) { store.toast(e.message) }
}
function cellMenu(e, def, col, block) {
  if (!enabled(def, col, block)) return
  const ownV = ownValue(def.key, col)
  const inh = inherited(def, col)
  const shown = ownV ?? inh.value
  menu.open(e, [
    { label: `${def.label?.de || def.key} · ${col.label}`, disabled: true },
    { sep: true },
    { label: 'Eigenen Wert löschen', icon: '✗', key: 'Delete', disabled: ownV == null, hint: ownV == null ? 'kein eigener' : (inh.value != null ? 'dann geerbt' : ''), action: () => setValue(def, col, '') },
    inh.from ? { label: `Zur Herkunft ${icon(inh.from.role)} ${inh.from.label}`, icon: '↑', key: 'h', action: () => router.push(`/tree/${inh.from.id}`) } : null,
    { label: 'Wert kopieren', icon: '⧉', key: 'c', disabled: shown == null, action: () => navigator.clipboard?.writeText(shown ?? '') },
    def.type !== 'html' && def.type !== 'rows' ? { label: starOwn(def.key) ? '★ weg — es gilt das von oben' : '★ Name im Baum ab hier', icon: '★', key: 's', action: () => setStar(def) } : null,
    { label: 'Attribut im Modell', icon: '⊞', key: 'm', hint: '→ Modell → Attribute', action: () => router.push({ path: '/model', query: { section: 'attributes', key: def.key } }) },
  ])
}
</script>

<template>
  <div class="pane" style="flex:3" v-if="node">
    <div class="toolbar path">
      <template v-for="a in path" :key="a.id">
        <router-link :to="`/tree/${a.id}`" class="crumb">{{ icon(a.role) }} {{ a.label }}</router-link><span class="sep">›</span>
      </template>
      <h1>{{ icon(node.role) }} {{ shownLabel }}</h1>
      <span class="grow" />
      <select v-if="node.role !== 'group'" :value="node.status" @change="setStatus($event.target.value)" class="status" :class="node.status" title="Status">
        <option value="draft">○ Entwurf</option><option value="active">● aktiv</option><option value="discontinued">✗ ausgelaufen</option>
      </select>
      <button class="x" @click="store.journalOpen = !store.journalOpen; store.save()" :title="store.journalOpen ? 'Journal zuklappen' : 'Journal aufklappen'">{{ store.journalOpen ? '≡▸' : '◂≡' }}</button>
      <button class="x" @click="undo" :disabled="!history.length" :title="history.length ? `↶ ${history.length} rückgängig: ${history[history.length - 1].def.label?.de || history[history.length - 1].def.key} ← „${history[history.length - 1].before}“  (Strg+Z) — schreibt den alten Wert als neuen Eintrag` : 'nichts rückgängig zu machen'">↶<span v-if="history.length" class="muted"> {{ history.length }}</span></button>
      <button class="x" @click="redo" :disabled="!redoStack.length" :title="redoStack.length ? `↷ ${redoStack.length} wiederholen  (Strg+Y)` : 'nichts zu wiederholen'">↷<span v-if="redoStack.length" class="muted"> {{ redoStack.length }}</span></button>
      <button class="x" @click="retire" :title="node.children ? `mit ${countBelow(id)} Knoten darunter zurückziehen  (Entf im Baum)` : 'Knoten zurückziehen  (Entf im Baum)'">🗑</button>
    </div>
    <div class="toolbar meta muted">
      <span class="mono">{{ node.id }}</span>
      <span>· {{ roleLabel[node.role] }}</span>
      <span v-if="node.role === 'product' && node.axes.length">· variiert nach {{ node.axes.map(axisLabel).join(', ') }}</span>
      <span v-if="node.role === 'variant'">· <span v-for="(v, a) in node.axisValues" :key="a" class="chip">{{ axisLabel(a) }}: {{ v }}</span></span>
      <span v-if="node.children">· {{ node.children }} Kinder</span>
      <span class="grow" />
      <span>≡ {{ node.entries }} · #{{ node.lastNumber }} {{ when(node.lastAt) }} 👤 {{ node.lastActor }}</span>
      <span v-if="busy">…</span>
    </div>

    <div class="toolbar view">
      <span class="muted">Sicht:</span>
      <span v-for="l in locales" :key="l" class="view-chip" :class="{ on: store.viewLocales.includes(l) }" @click="toggleLocale(l)">{{ l }}</span>
      <select :value="store.viewChannel ?? ''" @change="setChannel($event.target.value)" title="Kanal der Sicht">
        <option value="">nur *</option><option v-for="c in channels" :key="c" :value="c">{{ c }}</option>
      </select>
      <span class="sep">·</span>
      <select :value="store.viewKey[node.role] ?? ''" @change="setView($event.target.value)" :title="`Attributsicht für ${roleLabel[node.role]} — ⊞ Modell → Attributsichten`">
        <option value="">◫ alles{{ views.some(v => v.key === "defaultview_" + node.role) ? " · Reihenfolge DefaultView" : "" }}</option>
        <option v-for="v in views" :key="v.key" :value="v.key">◫ {{ v.label?.de || v.key }}</option>
      </select>
      <router-link :to="{ path: '/model', query: { section: 'views', key: orderView?.key } }" class="x edit" :title="orderView ? `${orderView.key} bearbeiten → Modell → Attributsichten` : '→ Modell → Attributsichten'">✎</router-link>
      <button :class="{ primary: store.layout === 'flat' }" @click="setLayout('flat')" title="alle Gruppen untereinander">☰</button>
      <button :class="{ primary: store.layout === 'tabs' }" @click="setLayout('tabs')" title="Gruppen als Reiter">⧉</button>
      <button :class="{ primary: store.editableOnly }" @click="toggleEditableOnly" title="nur Gruppen zeigen, die hier bearbeitbar sind (gesperrte weg)">✎ nur bearbeitbare</button>
      <span class="grow" />
      <span class="muted">{{ columns.length }} Spalten</span>
    </div>

    <div v-if="store.layout === 'tabs' && blocks.length" class="tabs">
      <button v-for="b in blocks" :key="b.key" class="tabbtn" :class="{ on: tab === b.key, locked: !b.active }" @click="tab = b.key" :title="`${b.key} · ${b.defs.length} Attribute` + (b.active ? '' : ` · gesperrt: aktiv ab ${roleLabel[b.activeFrom]}`)">{{ b.label }}<span class="muted n"> {{ b.defs.length }}</span><span v-if="!b.active"> 🔒</span></button>
    </div>

    <div class="scroll" v-if="model">

      <table class="grid values" :style="`width:${180 + columns.length * 220}px`">
        <colgroup><col style="width:180px" /><col v-for="c in columns" :key="c.label" style="width:220px" /></colgroup>
        <thead>
          <tr>
            <th>Attribut</th>
            <th v-for="c in columns" :key="c.label">{{ c.label }}</th>
          </tr>
        </thead>
        <tbody v-for="b in shownBlocks" :key="b.key">
          <tr class="group-row" :class="{ locked: !b.active }">
            <td :colspan="columns.length + 1">
              ▤ {{ b.label }}
              <router-link :to="{ path: '/model', query: { section: 'groups', key: b.key } }" class="muted edit" :title="`${b.key} bearbeiten → Modell → Attributgruppen`">✎</router-link>
              <span class="muted from" :title="`Gruppe hängt an ${b.fromLabel}`">· von {{ b.from === id ? 'hier' : b.fromLabel }}</span>
              <span v-if="!b.active" class="warn" :title="`Werte erst ab ${roleLabel[b.activeFrom]} — hier nur sichtbar`">🔒 ab {{ roleLabel[b.activeFrom] }}</span>
            </td>
          </tr>
          <template v-for="def in b.defs" :key="def.key">
          <tr v-if="def.type === 'rows'">
            <td class="attr" :title="def.key">{{ def.label?.de || def.key }} <span class="muted">≣ Zeilen</span><span v-if="def.required" class="warn" title="Pflicht: mindestens eine Zeile">●</span></td>
            <td :colspan="columns.length" style="padding:0">
              <RowsBlock v-if="b.active" :def="def" :rows="node.rows?.[def.key] ?? []" :values="own" :locale="viewLocales[0] ?? locales[0]"
                @set="(col, row, v) => setValue(col, { locale: col.perLocale ? (viewLocales[0] ?? locales[0]) : null, channel: null }, v, row)"
                @add="addRow(def)" @remove="row => removeRow(def, row)" @order="rows => orderRows(def, rows)" />
              <div v-else class="muted" style="padding:4px 8px">🔒</div>
            </td>
          </tr>
          <tr v-else>
            <td class="attr" :title="def.key + (def.required ? ' · Pflicht: ' + Object.entries(def.required).map(([c, l]) => c + ':' + l.join(',')).join(' ') : '') + (def.inheritable ? ' · vererbbar' : '')">
              <button v-if="def.type !== 'html'" class="star" :class="{ on: !!star(def.key), own: starOwn(def.key), idle: star(def.key) && !star(def.key).applies }" :title="starTitle(def)" @click.stop="setStar(def)">{{ star(def.key) ? '★' : '☆' }}</button>
              {{ def.label?.de || def.key }}
              <span v-if="def.unit" class="muted">{{ def.unit }}</span>
              <span v-if="def.multiple" class="muted" title="mehrfach, kommagetrennt">≣</span>
              <span v-if="def.inheritable" class="muted" title="vererbbar: gilt nach unten">↓</span>
              <span v-if="def.required" class="warn" title="Pflicht">●</span>
            </td>
            <template v-for="c in columns" :key="c.label">
              <ToggleCell v-if="def.type === 'boolean'" :value="ownValue(def.key, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
              <SelectCell v-else-if="def.type === 'enum'" :value="ownValue(def.key, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" :options="listOptions(def)" :label-of="listLabel(def)" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
              <DateCell v-else-if="def.type === 'date'" :value="ownValue(def.key, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
              <HtmlCell v-else-if="def.type === 'html'" :value="ownValue(def.key, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)" :title="`${def.label?.de || def.key} · ${c.label}`"
                :origin="inherited(def, c).from ? `${icon(inherited(def, c).from.role)} ${inherited(def, c).from.label}` : null" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
              <td v-else-if="axisValue(def.key, c) != null" class="cell"><div class="cell-box locked" title="Variantenachse — festgelegt beim Anlegen">{{ axisValue(def.key, c) }} 🔒</div></td>
              <Cell v-else :value="ownValue(def.key, c)" :inherited="inherited(def, c).value" :disabled="!enabled(def, c, b)"
                :origin="inherited(def, c).from ? `${icon(inherited(def, c).from.role)} ${inherited(def, c).from.label}` : null" @save="v => setValue(def, c, v)" @contextmenu="cellMenu($event, def, c, b)" />
            </template>
          </tr>
          </template>
        </tbody>
      </table>
      <div v-if="!blocks.length" class="empty">Keine Attributgruppe gilt hier — unten eine anhängen, oder oben am Pfad.</div>

      <div class="section">
        <h2>▤ Attributgruppen an diesem Knoten <span class="muted">· gelten ab hier nach unten</span></h2>
        <div class="chips">
          <span v-for="g in node.attachedGroups" :key="g" class="chip" :title="model.groups.find(x => x.key === g)?.label?.de">{{ g }} <button @click="attach(node.attachedGroups.filter(x => x !== g))" title="abhängen">×</button></span>
          <select v-model="addGroup" style="width:160px"><option value="">+ Gruppe …</option><option v-for="k in freeGroups" :key="k" :value="k">{{ k }}</option></select>
          <button class="primary" :disabled="!addGroup" @click="attachAdd">anhängen</button>
          <span class="muted" v-if="node.groups?.some(g => g.from !== id)">· geerbt: {{ node.groups.filter(g => g.from !== id).map(g => g.key).join(', ') }}</span>
        </div>
      </div>

      <div class="section" v-if="node.orphans?.length">
        <h2 class="warn">⚠ Verwaiste Werte</h2>
        <div class="muted">Eigene Werte für Attribute, die hier über keine Gruppe gelten (z. B. nach dem Umhängen): <span class="mono">{{ node.orphans.join(', ') }}</span> — Gruppe anhängen, dann sind sie wieder da.</div>
      </div>

      <div class="section">
        <h2>▤ Kategorien</h2>
        <div class="chips">
          <span v-for="c in node.categories" :key="c" class="chip">{{ c }} <button @click="removeCategory(c)" title="entfernen">×</button></span>
          <input v-model="newCategory" type="text" placeholder="+ Kategorie" style="width:180px" @keydown.enter="addCategory" />
        </div>
      </div>

      <div class="section" v-if="node.role !== 'group'">
        <h2>✓ Freigaben <span class="muted">· Vollständigkeit aus der Pflicht der aktiven Attribute; unvollständig = keine Freigabe</span></h2>
        <table class="grid releases">
          <thead><tr><th>Kanal</th><th v-if="node.role === 'variant'">*</th><th v-for="l in locales" :key="l">{{ l }}</th></tr></thead>
          <tbody>
            <tr v-for="ch in channels" :key="ch">
              <td class="mono muted">{{ ch }}</td>
              <td v-if="node.role === 'variant'">
                <button class="toggle" :class="{ on: released(ch, null) }" :disabled="!released(ch, null) && !!incomplete(ch, null)" :title="incomplete(ch, null) ? 'fehlt: ' + incomplete(ch, null).missing.join(', ') : 'alle Sprachen'" @click="toggleRelease(ch, null)">{{ released(ch, null) ? '✓' : '·' }}</button>
              </td>
              <td v-for="l in locales" :key="l" class="rel">
                <button v-if="node.role === 'variant'" class="toggle" :class="{ on: released(ch, l) }" :disabled="!released(ch, l) && !!incomplete(ch, l)" :title="incomplete(ch, l) ? 'fehlt: ' + incomplete(ch, l).missing.join(', ') : ''" @click="toggleRelease(ch, l)">{{ released(ch, l) ? '✓' : '·' }}</button>
                <span v-if="completeness(ch, l)" class="mono" :class="completeness(ch, l).missing.length ? 'neg' : 'pos'" :title="completeness(ch, l).missing.length ? 'fehlt: ' + completeness(ch, l).missing.join(', ') : 'vollständig'">{{ completeness(ch, l).filled }}/{{ completeness(ch, l).required }}</span>
                <span v-else class="muted" title="hier ist nichts Pflicht">–</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">
      <kbd>Tab</kbd> Zelle · <kbd>Enter</kbd> bearbeiten/speichern · <kbd>Esc</kbd> verwerfen · <kbd>Entf</kbd> eigenen Wert löschen · schraffiert = Achse gibt es nicht · 🔒 = Gruppe hier nicht aktiv · <i>kursiv</i> = geerbt
    </div>
  </div>
  <div v-else class="pane" style="flex:3"><div class="empty">…</div></div>

  <div v-if="store.journalOpen" class="pane" style="flex:2">
    <div class="toolbar"><h1>≡ Journal</h1><span class="muted mono">{{ id }}</span><span class="muted">{{ entries.length }}</span><span class="grow" /><button class="x" @click="store.journalOpen = false; store.save()" title="Journal zuklappen">▸</button></div>
    <div class="scroll"><EntryList :entries="entries" /></div>
  </div>
  <div v-else class="pane rail-pane" @click="store.journalOpen = true; store.save()" title="Journal aufklappen">
    <span class="vert">◂ ≡ Journal · {{ entries.length }}</span>
  </div>
</template>

<style scoped>
.path { flex-wrap: wrap; row-gap: 2px; }
.crumb { color: var(--muted); }
.crumb:hover { color: var(--accent); }
.meta { font-size: 12px; min-height: 28px; }
.view { gap: 4px; font-size: 12px; min-height: 30px; }
.view select, .view button { font-size: 12px; padding: 1px 6px; }
/* Reiter: einzeilig, klein, umbrechend — mit Echtdaten sind es zwanzig und mehr (Taloan, 17.09.) */
.tabs { display: flex; flex-wrap: wrap; gap: 2px; padding: 4px 8px 0; border-bottom: 1px solid var(--line); background: var(--bg); }
.tabbtn { border: 1px solid var(--line); border-bottom: 0; border-radius: 6px 6px 0 0; background: var(--bg); color: var(--muted); padding: 1px 8px; font-size: 12px; line-height: 18px; white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis; }
.tabbtn .n { font-size: 10px; }
.tabbtn.on { background: var(--pane); color: var(--text); font-weight: 600; }
.tabbtn.locked { opacity: .6; }
.section { padding: 10px 8px; border-top: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600; }
.group-row td { background: var(--bg); color: var(--muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; height: 22px; }
.group-row .edit { text-decoration: none; margin-left: 4px; opacity: .5; }
.group-row:hover .edit { opacity: 1; }
.group-row .from { text-transform: none; font-weight: 400; letter-spacing: 0; }
.group-row.locked td { color: var(--warn); }
td.attr { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
/* ★ Name im Baum: hohl = nicht gesetzt, blau = geerbt (von oben), gelb = hier gesetzt, halb durchsichtig = gesetzt, gilt hier nicht (Taloan, 17.09.) */
.star { border: 0; background: none; padding: 0 2px 0 0; color: var(--muted); opacity: .45; cursor: pointer; font-size: 12px; line-height: 1; }
tr:hover .star { opacity: 1; }
.star.idle { opacity: .5; }
.star.on { opacity: 1; color: var(--accent); }
.star.own { color: var(--warn); }
table.releases { width: auto; }
table.releases td { text-align: center; }
table.releases td.rel { white-space: nowrap; }
table.releases td.rel .toggle { margin-right: 6px; }
.toggle { width: 28px; color: var(--muted); }
.toggle.on { color: var(--pane); background: var(--pos); border-color: var(--pos); }
.toggle:disabled { opacity: .35; cursor: not-allowed; }
.status { border: 1px solid var(--line); border-radius: 4px; padding: 2px 4px; background: var(--pane); }
.status.active { color: var(--pos); }
.status.discontinued { color: var(--neg); }
.x { border: 0; background: none; }
.rail-pane { width: 26px; flex: none; cursor: pointer; align-items: center; padding-top: 8px; }
.rail-pane:hover { background: var(--hover); }
.vert { writing-mode: vertical-rl; color: var(--muted); font-size: 12px; white-space: nowrap; }
</style>
