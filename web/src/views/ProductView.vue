<script setup>
// Ein Produkt: Werte als Gitter Attribut × Achse mit Zelle nach Typ (Text,
// Schalter, Auswahl), Gruppen als Abschnitte, Kategorien als Chips, Freigaben
// als Schalter, rechts der Strom im Journal. Jede Änderung ist ein Befehl an
// den Server = ein Eintrag; die Antwort landet sofort in Abbild und Liste.
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api, when } from '../api.js'
import { store } from '../store.js'
import Cell from '../components/Cell.vue'
import ToggleCell from '../components/ToggleCell.vue'
import SelectCell from '../components/SelectCell.vue'
import EntryList from '../components/EntryList.vue'

const props = defineProps({ sku: String })
const router = useRouter()

const product = ref(null)     // null = gibt es noch nicht (erster Eintrag legt es an)
const entries = ref([])
const newCategory = ref('')
const busy = ref(false)

const model = computed(() => store.model)
const locales = computed(() => model.value?.locales.map(l => l.code) ?? [])
const channels = computed(() => model.value?.channels.map(c => c.key) ?? [])

// Spalten: * (alle), je Sprache, je Kanal ohne Sprache, je Sprache × Kanal
const columns = computed(() => {
  const cols = [{ locale: null, channel: null, label: '*' }]
  for (const l of locales.value) cols.push({ locale: l, channel: null, label: l })
  for (const c of channels.value) cols.push({ locale: null, channel: c, label: `*/${c}` })
  for (const c of channels.value)
    for (const l of locales.value) cols.push({ locale: l, channel: c, label: `${l}/${c}` })
  return cols
})

// Attribute nach Gruppe, Gruppe ohne Namen zuletzt
const groups = computed(() => {
  const g = new Map()
  for (const a of model.value?.attributes ?? []) {
    const k = a.group ?? ''
    if (!g.has(k)) g.set(k, [])
    g.get(k).push(a)
  }
  return [...g.entries()].sort((a, b) => (a[0] === '' ? 1 : b[0] === '' ? -1 : a[0].localeCompare(b[0])))
})

const values = computed(() => {
  const m = new Map()
  for (const v of product.value?.values ?? []) m.set(key(v.attribute, v.locale, v.channel), v.values ? v.values.join(', ') : v.value)
  return m
})

function key(a, l, c) { return `${a}|${l ?? ''}|${c ?? ''}` }
function own(a, col) { return values.value.get(key(a, col.locale, col.channel)) ?? null }
// Rückfall wie ProductState.Resolve: genaue Achse, dann ohne Kanal, dann ohne Sprache.
function inherited(a, col) {
  if (col.channel && values.value.has(key(a, col.locale, null))) return values.value.get(key(a, col.locale, null))
  if ((col.locale || col.channel) && values.value.has(key(a, null, null))) return values.value.get(key(a, null, null))
  return null
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
function released(channel, locale) { return product.value?.releases.some(r => r.channel === channel && r.locale === locale) ?? false }

async function load() {
  try {
    product.value = await api.get(`/api/products/${encodeURIComponent(props.sku)}`)
    entries.value = (await api.get(`/api/streams/${encodeURIComponent(props.sku)}`)).reverse()
  } catch (e) {
    if (e.message.startsWith('404')) { product.value = null; entries.value = [] }
    else store.toast(e.message)
  }
}
onMounted(load)
watch(() => props.sku, load)

// Esc ausserhalb einer Zelle: zurück zur Liste.
function onKey(e) {
  if (e.key === 'Escape' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) router.push('/products')
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
// Fremde Änderungen: wenn der Serverstand über unseren letzten Eintrag hinaus ist, nachziehen.
watch(() => store.head, h => { if (h > (entries.value[0]?.number ?? 0)) load() })

async function command(fn) {
  if (!store.actor) { store.toast('Name fehlt → Einstellungen'); return }
  busy.value = true
  try {
    const entry = await fn()
    entries.value.unshift(entry)
    if (!product.value) await load()          // erster Eintrag: Produkt gibt es jetzt
    else apply(entry)
  } catch (e) { store.toast(e.message) }
  finally { busy.value = false }
}

// Dasselbe wie ProductCatalog.Apply, nur für die Anzeige — der Server hat es schon getan.
function apply(e) {
  const p = product.value, d = e.payload
  switch (e.type) {
    case 'AttributeSet': {
      const i = p.values.findIndex(v => v.attribute === d.attribute && (v.locale ?? null) === (d.locale ?? null) && (v.channel ?? null) === (d.channel ?? null))
      const empty = d.values ? d.values.length === 0 : (d.value == null || d.value === '')
      if (empty) { if (i >= 0) p.values.splice(i, 1) }
      else {
        const v = { attribute: d.attribute, locale: d.locale ?? null, channel: d.channel ?? null, value: d.value ?? null, values: d.values ?? null }
        if (i >= 0) p.values[i] = v; else p.values.push(v)
      }
      break
    }
    case 'CategoryAssigned': if (!p.categories.includes(d.category)) p.categories.push(d.category); p.categories.sort(); break
    case 'CategoryRemoved': p.categories = p.categories.filter(c => c !== d.category); break
    case 'ReleaseGranted': if (!released(d.channel, d.locale ?? null)) p.releases.push({ channel: d.channel, locale: d.locale ?? null }); break
    case 'ReleaseRevoked': p.releases = p.releases.filter(r => !(r.channel === d.channel && r.locale === (d.locale ?? null))); break
  }
  p.entries++; p.lastNumber = e.number; p.lastAt = e.at; p.lastActor = e.actor
}

const setValue = (def, col, value) => command(() =>
  api.post(`/api/products/${encodeURIComponent(props.sku)}/attributes`,
    def.multiple
      ? { attribute: def.key, locale: col.locale, channel: col.channel, values: value.split(',').map(s => s.trim()).filter(Boolean) }
      : { attribute: def.key, locale: col.locale, channel: col.channel, value }))

function addCategory() {
  const c = newCategory.value.trim()
  if (!c) return
  newCategory.value = ''
  command(() => api.post(`/api/products/${encodeURIComponent(props.sku)}/categories`, { category: c }))
}
const removeCategory = c => command(() => api.del(`/api/products/${encodeURIComponent(props.sku)}/categories/${encodeURIComponent(c)}`))

function toggleRelease(channel, locale) {
  const q = `channel=${encodeURIComponent(channel)}` + (locale ? `&locale=${encodeURIComponent(locale)}` : '')
  command(() => released(channel, locale)
    ? api.del(`/api/products/${encodeURIComponent(props.sku)}/releases?${q}`)
    : api.post(`/api/products/${encodeURIComponent(props.sku)}/releases`, { channel, locale }))
}
</script>

<template>
  <div class="pane" style="flex:3">
    <div class="toolbar">
      <router-link to="/products" title="zurück zur Liste  (Esc)">◀</router-link>
      <h1 class="mono">{{ sku }}</h1>
      <span v-if="product" class="muted">≡ {{ product.entries }} · zuletzt #{{ product.lastNumber }} {{ when(product.lastAt) }} 👤 {{ product.lastActor }}</span>
      <span v-else class="warn">neu — der erste Wert legt es an</span>
      <span class="grow" />
      <span v-if="busy" class="muted">…</span>
    </div>

    <div class="scroll" v-if="model">
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
            <td class="attr" :title="def.key">
              {{ def.label?.de || def.key }}
              <span v-if="def.unit" class="muted">{{ def.unit }}</span>
              <span v-if="def.multiple" class="muted" title="mehrfach, kommagetrennt">≣</span>
            </td>
            <template v-for="c in columns" :key="c.label">
              <ToggleCell v-if="def.type === 'boolean'" :value="own(def.key, c)" :inherited="inherited(def.key, c)" :disabled="!enabled(def, c)" @save="v => setValue(def, c, v)" />
              <SelectCell v-else-if="def.type === 'enum'" :value="own(def.key, c)" :inherited="inherited(def.key, c)" :disabled="!enabled(def, c)" :options="listOptions(def)" :label-of="listLabel(def)" @save="v => setValue(def, c, v)" />
              <Cell v-else :value="own(def.key, c)" :inherited="inherited(def.key, c)" :disabled="!enabled(def, c)" @save="v => setValue(def, c, v)" />
            </template>
          </tr>
        </tbody>
      </table>

      <div class="section">
        <h2>▤ Kategorien</h2>
        <div class="chips">
          <span v-for="c in product?.categories ?? []" :key="c" class="chip">{{ c }} <button @click="removeCategory(c)" title="entfernen">×</button></span>
          <input v-model="newCategory" type="text" placeholder="+ Kategorie" style="width:180px" @keydown.enter="addCategory" />
        </div>
      </div>

      <div class="section">
        <h2>✓ Freigaben</h2>
        <table class="grid releases">
          <thead>
            <tr><th>Kanal</th><th>*</th><th v-for="l in locales" :key="l">{{ l }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="ch in channels" :key="ch">
              <td class="mono muted">{{ ch }}</td>
              <td v-for="l in [null, ...locales]" :key="l ?? '*'">
                <button class="toggle" :class="{ on: released(ch, l) }" @click="toggleRelease(ch, l)">
                  {{ released(ch, l) ? '✓' : '·' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-else class="empty">Modell wird geladen …</div>

    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">
      <kbd>Tab</kbd> Zelle · <kbd>Enter</kbd> bearbeiten/speichern · <kbd>Esc</kbd> verwerfen · <kbd>Entf</kbd> eigenen Wert löschen · schraffiert = Achse gibt es nicht · <i>kursiv</i> = geerbt
    </div>
  </div>

  <div class="pane" style="flex:2">
    <div class="toolbar"><h1>≡ Journal {{ sku }}</h1><span class="muted">{{ entries.length }}</span></div>
    <div class="scroll"><EntryList :entries="entries" /></div>
  </div>
</template>

<style scoped>
.section { padding: 10px 8px; border-top: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600; }
.group-row td { background: var(--bg); color: var(--muted); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; height: 22px; }
td.attr { white-space: nowrap; }
table.releases { width: auto; }
table.releases td { text-align: center; }
.toggle { width: 28px; color: var(--muted); }
.toggle.on { color: var(--pane); background: var(--pos); border-color: var(--pos); }
</style>
