<script setup>
// Ein Knoten: Pfad oben, Kopf nach Rolle (Gruppe: Name; Produkt: Familie,
// Achsen, Status; Variante: Achsenwerte, Status), Werte als Gitter Attribut ×
// Achse mit Zelle nach Typ und Vererbung den Pfad hinauf (Herkunft im
// Tooltip), Kategorien, Freigaben (nur Variante), rechts das Journal.
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { tree, icon } from '../tree.js'
import Cell from '../components/Cell.vue'
import ToggleCell from '../components/ToggleCell.vue'
import SelectCell from '../components/SelectCell.vue'
import EntryList from '../components/EntryList.vue'

const props = defineProps({ id: String })
const router = useRouter()

const node = ref(null)
const entries = ref([])
const newCategory = ref('')
const busy = ref(false)

const model = computed(() => store.model)
const locales = computed(() => model.value?.locales.map(l => l.code) ?? [])
const channels = computed(() => model.value?.channels.map(c => c.key) ?? [])
const path = computed(() => tree.ancestors(props.id))

// Die Sicht: * (alle), die gewählten Sprachen, und bei gewähltem Kanal */kanal und sprache/kanal.
// Nicht alle Sprachen × alle Kanäle — 27 × 6 passen auf keinen Schirm.
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
function toggleLocale(l) {
  const s = new Set(store.viewLocales); s.has(l) ? s.delete(l) : s.add(l)
  store.viewLocales = locales.value.filter(c => s.has(c)); store.save()
}
function setChannel(c) { store.viewChannel = c || null; store.save() }
// Achsenwert der Variante (z. B. storage=256): steht in der *-Zelle, gesperrt — er ist die Identität der Variante.
function axisValue(a, col) { return node.value?.role === 'variant' && !col.locale && !col.channel && a in node.value.axisValues ? node.value.axisValues[a] : null }

// Welche Attribute hier: an der Rolle erlaubt; bei Produkt/Variante die der Familie in deren Reihenfolge.
const family = computed(() => {
  const productAncestor = node.value?.ancestors.find(a => a.role === 'product')
  const key = node.value?.family ?? (productAncestor ? tree.byId.get(productAncestor.id)?.family : null)
  return model.value?.families.find(f => f.key === key)
})
const groups = computed(() => {
  if (!model.value || !node.value) return []
  const allowed = a => !a.levels || a.levels.includes(node.value.role)
  let defs
  if (family.value) {
    defs = family.value.attributes.map(fa => ({ ...model.value.attributes.find(a => a.key === fa.key), group: fa.group ?? model.value.attributes.find(a => a.key === fa.key)?.group, required: fa.required })).filter(a => a.key)
    // sku gehört immer zur Variante, auch wenn die Familie es nicht nennt
    if (node.value.role === 'variant' && !defs.some(d => d.key === 'sku')) { const s = model.value.attributes.find(a => a.key === 'sku'); if (s) defs.unshift(s) }
  } else defs = model.value.attributes
  defs = defs.filter(allowed)
  const g = new Map()
  for (const a of defs) { const k = a.group ?? ''; if (!g.has(k)) g.set(k, []); g.get(k).push(a) }
  return [...g.entries()]
})

const own = computed(() => valueMap(node.value?.values ?? []))
function valueMap(values) {
  const m = new Map()
  for (const v of values) m.set(key(v.attribute, v.locale, v.channel), v.values ? v.values.join(', ') : v.value)
  return m
}
function key(a, l, c) { return `${a}|${l ?? ''}|${c ?? ''}` }
function ownValue(a, col) { return own.value.get(key(a, col.locale, col.channel)) ?? null }
// Wie Tree.Resolve: je Stufe genaue Achse, ohne Kanal, ohne Sprache; erst hier, dann den Pfad hinauf.
function fallback(m, a, col) {
  if (col.channel && m.has(key(a, col.locale, null))) return m.get(key(a, col.locale, null))
  if ((col.locale || col.channel) && m.has(key(a, null, null))) return m.get(key(a, null, null))
  return null
}
const ancestorMaps = computed(() => (node.value?.ancestors ?? []).map(an => ({ an, m: valueMap(an.values) })))
function inherited(a, col) {
  const here = fallback(own.value, a, col)
  if (here != null) return { value: here, from: null }
  for (const { an, m } of ancestorMaps.value) {
    const v = m.get(key(a, col.locale, col.channel)) ?? fallback(m, a, col)
    if (v != null) return { value: v, from: an }
  }
  return { value: null, from: null }
}
function enabled(def, col) {
  return (!col.locale || def.perLocale) && (!col.channel || def.perChannel)
    && (!col.channel || !def.channels || def.channels.includes(col.channel))
}
function listOptions(def) { return (model.value.lists.find(l => l.key === def.list)?.values ?? []).map(v => v.value) }
function listLabel(def) {
  const vals = model.value.lists.find(l => l.key === def.list)?.values ?? []
  return v => vals.find(x => x.value === v)?.label?.de || v
}
function released(channel, locale) { return node.value?.releases.some(r => r.channel === channel && r.locale === locale) ?? false }
function axisLabel(a) { return model.value?.attributes.find(x => x.key === a)?.label?.de || a }

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
watch(() => store.head, h => { if (h > (entries.value[0]?.number ?? 0)) load() })

async function command(fn) {
  if (!store.actor) { store.toast('Name fehlt → Einstellungen'); return }
  busy.value = true
  try {
    const entry = await fn()
    entries.value.unshift(entry)
    await load()             // Herkunft und Baum-Label können sich ändern — der Server hat es schon
    tree.load()
  } catch (e) { store.toast(e.message) }
  finally { busy.value = false }
}
const nodeUrl = () => `/api/nodes/${encodeURIComponent(props.id)}`
const setValue = (def, col, value) => command(() =>
  api.post(`${nodeUrl()}/attributes`,
    def.multiple
      ? { attribute: def.key, locale: col.locale, channel: col.channel, values: value.split(',').map(s => s.trim()).filter(Boolean) }
      : { attribute: def.key, locale: col.locale, channel: col.channel, value }))
const setLabel = (loc, v) => command(() => api.post(`/api/groups/${encodeURIComponent(props.id)}/label`, { label: { ...node.value.label, [loc]: v } }, 'PUT'))
const setStatus = s => command(() => api.post(`${nodeUrl()}/status`, { status: s }))
function addCategory() {
  const c = newCategory.value.trim(); if (!c) return
  newCategory.value = ''
  command(() => api.post(`${nodeUrl()}/categories`, { category: c }))
}
const removeCategory = c => command(() => api.del(`${nodeUrl()}/categories/${encodeURIComponent(c)}`))
function toggleRelease(channel, locale) {
  const q = `channel=${encodeURIComponent(channel)}` + (locale ? `&locale=${encodeURIComponent(locale)}` : '')
  command(() => released(channel, locale) ? api.del(`${nodeUrl()}/releases?${q}`) : api.post(`${nodeUrl()}/releases`, { channel, locale }))
}
async function retire() {
  if (node.value.children) { store.toast('Erst die Kinder entfernen'); return }
  try { await api.del(nodeUrl()); const p = node.value.parent; await tree.load(); router.push(p ? `/tree/${p}` : '/tree') }
  catch (e) { store.toast(e.message) }
}
</script>

<template>
  <div class="pane" style="flex:3" v-if="node">
    <div class="toolbar path">
      <template v-for="a in path" :key="a.id">
        <router-link :to="`/tree/${a.id}`" class="crumb">{{ icon(a.role) }} {{ a.label }}</router-link><span class="sep">›</span>
      </template>
      <h1>{{ icon(node.role) }} <span v-if="node.role === 'group'">{{ node.label?.de || node.id }}</span><span v-else class="mono">{{ tree.byId.get(id)?.label ?? id }}</span></h1>
      <span class="grow" />
      <select v-if="node.role !== 'group'" :value="node.status" @change="setStatus($event.target.value)" class="status" :class="node.status" title="Status">
        <option value="draft">○ Entwurf</option><option value="active">● aktiv</option><option value="discontinued">✗ ausgelaufen</option>
      </select>
      <button class="x" @click="retire" :disabled="node.children > 0" :title="node.children ? 'hat Kinder' : 'Knoten zurückziehen'">🗑</button>
    </div>
    <div class="toolbar meta muted">
      <span class="mono">{{ node.id }}</span>
      <span v-if="node.role === 'product'">· Familie <b>{{ family?.label?.de || node.family }}</b><span v-if="node.axes.length"> · variiert nach {{ node.axes.map(axisLabel).join(', ') }}</span></span>
      <span v-if="node.role === 'variant'">· <span v-for="(v, a) in node.axisValues" :key="a" class="chip">{{ axisLabel(a) }}: {{ v }}</span></span>
      <span v-if="node.role === 'group'">· {{ node.children }} Kinder</span>
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
      <span class="muted">{{ columns.length }} Spalten</span>
    </div>

    <div class="scroll" v-if="model">
      <table v-if="node.role === 'group'" class="grid" style="width:auto">
        <thead><tr><th>Name</th><th v-for="l in locales" :key="l">{{ l }}</th></tr></thead>
        <tbody><tr><td class="muted">Gruppe</td><Cell v-for="l in locales" :key="l" :value="node.label?.[l] ?? null" @save="v => setLabel(l, v)" /></tr></tbody>
      </table>

      <table class="grid values">
        <thead>
          <tr>
            <th>Attribut</th>
            <th v-for="c in columns" :key="c.label">{{ c.label }}</th>
          </tr>
        </thead>
        <tbody v-for="[group, defs] in groups" :key="group">
          <tr class="group-row"><td :colspan="columns.length + 1">{{ group || '—' }}</td></tr>
          <tr v-for="def in defs" :key="def.key">
            <td class="attr" :title="def.key + (def.required ? ' · Pflicht: ' + Object.entries(def.required).map(([c, l]) => c + ':' + l.join(',')).join(' ') : '')">
              {{ def.label?.de || def.key }}
              <span v-if="def.unit" class="muted">{{ def.unit }}</span>
              <span v-if="def.multiple" class="muted" title="mehrfach, kommagetrennt">≣</span>
              <span v-if="def.required" class="warn" title="Pflicht in der Familie">●</span>
            </td>
            <template v-for="c in columns" :key="c.label">
              <ToggleCell v-if="def.type === 'boolean'" :value="ownValue(def.key, c)" :inherited="inherited(def.key, c).value" :disabled="!enabled(def, c)" @save="v => setValue(def, c, v)" />
              <SelectCell v-else-if="def.type === 'enum'" :value="ownValue(def.key, c)" :inherited="inherited(def.key, c).value" :disabled="!enabled(def, c)" :options="listOptions(def)" :label-of="listLabel(def)" @save="v => setValue(def, c, v)" />
              <td v-else-if="axisValue(def.key, c) != null" class="cell"><div class="cell-box locked" :title="'Variantenachse — festgelegt beim Anlegen'">{{ axisValue(def.key, c) }} 🔒</div></td>
              <Cell v-else :value="ownValue(def.key, c)" :inherited="inherited(def.key, c).value" :disabled="!enabled(def, c)"
                :origin="inherited(def.key, c).from ? `${icon(inherited(def.key, c).from.role)} ${inherited(def.key, c).from.label}` : null" @save="v => setValue(def, c, v)" />
            </template>
          </tr>
        </tbody>
      </table>

      <div class="section">
        <h2>▤ Kategorien</h2>
        <div class="chips">
          <span v-for="c in node.categories" :key="c" class="chip">{{ c }} <button @click="removeCategory(c)" title="entfernen">×</button></span>
          <input v-model="newCategory" type="text" placeholder="+ Kategorie" style="width:180px" @keydown.enter="addCategory" />
        </div>
      </div>

      <div class="section" v-if="node.role === 'variant'">
        <h2>✓ Freigaben</h2>
        <table class="grid releases">
          <thead><tr><th>Kanal</th><th>*</th><th v-for="l in locales" :key="l">{{ l }}</th></tr></thead>
          <tbody>
            <tr v-for="ch in channels" :key="ch">
              <td class="mono muted">{{ ch }}</td>
              <td v-for="l in [null, ...locales]" :key="l ?? '*'">
                <button class="toggle" :class="{ on: released(ch, l) }" @click="toggleRelease(ch, l)">{{ released(ch, l) ? '✓' : '·' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">
      <kbd>Tab</kbd> Zelle · <kbd>Enter</kbd> bearbeiten/speichern · <kbd>Esc</kbd> verwerfen · <kbd>Entf</kbd> eigenen Wert löschen · schraffiert = Achse gibt es nicht · <i>kursiv</i> = geerbt (Herkunft im Tooltip)
    </div>
  </div>
  <div v-else class="pane" style="flex:3"><div class="empty">…</div></div>

  <div class="pane" style="flex:2">
    <div class="toolbar"><h1>≡ Journal</h1><span class="muted mono">{{ id }}</span><span class="muted">{{ entries.length }}</span></div>
    <div class="scroll"><EntryList :entries="entries" /></div>
  </div>
</template>

<style scoped>
.path { flex-wrap: wrap; row-gap: 2px; }
.crumb { color: var(--muted); }
.crumb:hover { color: var(--accent); }
.meta { font-size: 12px; min-height: 28px; }
.view { gap: 4px; font-size: 12px; min-height: 30px; }
.view select { font-size: 12px; padding: 1px 4px; }
.section { padding: 10px 8px; border-top: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600; }
.group-row td { background: var(--bg); color: var(--muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; height: 22px; }
td.attr { white-space: nowrap; }
table.releases { width: auto; }
table.releases td { text-align: center; }
.toggle { width: 28px; color: var(--muted); }
.toggle.on { color: var(--pane); background: var(--pos); border-color: var(--pos); }
.status { border: 1px solid var(--line); border-radius: 4px; padding: 2px 4px; background: var(--pane); }
.status.active { color: var(--pos); }
.status.discontinued { color: var(--neg); }
.x { border: 0; background: none; }
</style>
