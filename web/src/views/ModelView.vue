<script setup>
// Das Modell: Sprachen, Kanäle, Attribute, Wertelisten, Familien — jede Zelle ein
// Eintrag mit der ganzen Definition (docs/pflegestruktur.md). Links die Bereiche,
// rechts das Gitter; bei Wertelisten und Familien darunter das Detail.
import { ref, computed } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import EditGrid from '../components/EditGrid.vue'

const sections = [
  { key: 'attributes', icon: '⊞', label: 'Attribute' },
  { key: 'lists', icon: '☰', label: 'Wertelisten' },
  { key: 'families', icon: '⌂', label: 'Familien' },
  { key: 'locales', icon: '🗣', label: 'Sprachen' },
  { key: 'channels', icon: '⇶', label: 'Kanäle' },
]
const section = ref('attributes')
const model = computed(() => store.model)
const newKey = ref('')
const selectedList = ref(null)
const selectedFamily = ref(null)
const newValue = ref('')
const addAttr = ref('')

async function send(fn) {
  if (!store.actor) { store.toast('Name fehlt → Einstellungen'); return }
  try { await fn(); await store.poll(true) } catch (e) { store.toast(e.message) }
}
const put = (path, body) => send(() => api.post(path, body, 'PUT'))
const del = path => send(() => api.del(path))

// ---- Sprachen, Kanäle
const localeCols = [{ key: 'code', label: 'Code', type: 'ro', width: '80px' }, { key: 'label', label: 'Name' }]
const channelCols = [{ key: 'key', label: 'Kanal', type: 'ro', width: '100px' }, { key: 'label_de', label: 'Name de' }, { key: 'label_en', label: 'Name en' }]
const channelRows = computed(() => model.value.channels.map(c => ({ key: c.key, label_de: c.label?.de, label_en: c.label?.en, _c: c })))

// ---- Attribute
const attrCols = computed(() => [
  { key: 'key', label: 'Key', type: 'ro', width: '120px' },
  { key: 'label_de', label: 'Name de' },
  { key: 'label_en', label: 'Name en' },
  { key: 'type', label: 'Typ', type: 'select', options: model.value.types, width: '110px' },
  { key: 'unit', label: 'Einheit', width: '60px', title: 'nur bei Zahlen' },
  { key: 'group', label: 'Gruppe', width: '90px' },
  { key: 'locale', label: '🗣', type: 'bool', width: '36px', title: 'je Sprache' },
  { key: 'channel', label: '⇶', type: 'bool', width: '36px', title: 'je Kanal' },
  { key: 'list', label: 'Werteliste', type: 'select', options: model.value.lists.map(l => l.key), width: '110px', title: 'bei enum' },
  { key: 'multiple', label: '≣', type: 'bool', width: '36px', title: 'mehrfach' },
  { key: 'lv_group', label: '▣', type: 'bool', width: '36px', title: 'an Produktgruppen setzbar' },
  { key: 'lv_product', label: '▦', type: 'bool', width: '36px', title: 'an Produkten setzbar' },
  { key: 'lv_variant', label: '◆', type: 'bool', width: '36px', title: 'an Varianten setzbar' },
])
const attrRows = computed(() => model.value.attributes.map(a => ({
  key: a.key, label_de: a.label?.de, label_en: a.label?.en, type: a.type, unit: a.unit, group: a.group,
  locale: a.perLocale, channel: a.perChannel, list: a.list, multiple: a.multiple,
  lv_group: !a.levels || a.levels.includes('group'), lv_product: !a.levels || a.levels.includes('product'), lv_variant: !a.levels || a.levels.includes('variant'), _a: a,
})))
function attrChange(r, col, v) {
  const a = { ...r._a, label: { ...(r._a.label || {}) } }
  if (col === 'label_de') a.label.de = v
  else if (col === 'label_en') a.label.en = v
  else if (col === 'locale' || col === 'channel') {
    const axes = new Set(a.axes || [])
    v ? axes.add(col) : axes.delete(col)
    a.axes = [...axes]
  } else if (col.startsWith('lv_')) {
    const all = ['group', 'product', 'variant']
    const lv = new Set(a.levels ?? all)
    v ? lv.add(col.slice(3)) : lv.delete(col.slice(3))
    a.levels = lv.size === all.length ? null : all.filter(x => lv.has(x))   // alle drei = keine Einschränkung
  } else a[col] = v
  put(`/api/model/attributes/${r.key}`, a)
}
function attrAdd() {
  const k = newKey.value.trim(); if (!k) return
  newKey.value = ''
  put(`/api/model/attributes/${k}`, { key: k, label: {}, type: 'text' })
}

// ---- Wertelisten
const listCols = [{ key: 'key', label: 'Key', type: 'ro', width: '120px' }, { key: 'label_de', label: 'Name de' }, { key: 'label_en', label: 'Name en' }]
const listRows = computed(() => model.value.lists.map(l => ({ key: l.key, label_de: l.label?.de, label_en: l.label?.en, _l: l })))
const valueCols = [{ key: 'value', label: 'Wert', type: 'ro', width: '120px' }, { key: 'label_de', label: 'Name de' }, { key: 'label_en', label: 'Name en' }, { key: 'order', label: '#', width: '50px' }]
const currentList = computed(() => model.value.lists.find(l => l.key === selectedList.value))
const valueRows = computed(() => (currentList.value?.values ?? []).map(v => ({ value: v.value, label_de: v.label?.de, label_en: v.label?.en, order: String(v.order ?? 0), _v: v })))
function listChange(r, col, v) {
  put(`/api/model/lists/${r.key}`, { key: r.key, label: { ...(r._l.label || {}), [col.slice(6)]: v } })
}
function listAdd() {
  const k = newKey.value.trim(); if (!k) return
  newKey.value = ''
  put(`/api/model/lists/${k}`, { key: k, label: {} })
  selectedList.value = k
}
function valueChange(r, col, v) {
  const d = { ...r._v, label: { ...(r._v.label || {}) } }
  if (col.startsWith('label_')) d.label[col.slice(6)] = v
  else if (col === 'order') d.order = parseInt(v) || 0
  put(`/api/model/lists/${selectedList.value}/values/${encodeURIComponent(r.value)}`, d)
}
function valueAdd() {
  const v = newValue.value.trim(); if (!v || !selectedList.value) return
  newValue.value = ''
  put(`/api/model/lists/${selectedList.value}/values/${encodeURIComponent(v)}`, { value: v, label: {}, order: valueRows.value.length + 1 })
}

// ---- Familien
const familyCols = [{ key: 'key', label: 'Key', type: 'ro', width: '120px' }, { key: 'label_de', label: 'Name de' }, { key: 'label_en', label: 'Name en' }, { key: 'axes', label: 'Variantenachsen', title: 'Attribute, kommagetrennt' }]
const familyRows = computed(() => model.value.families.map(f => ({ key: f.key, label_de: f.label?.de, label_en: f.label?.en, axes: (f.axes || []).join(', '), _f: f })))
const currentFamily = computed(() => model.value.families.find(f => f.key === selectedFamily.value))
const famAttrCols = computed(() => [
  { key: 'key', label: 'Attribut', type: 'ro', width: '120px' },
  { key: 'group', label: 'Gruppe', width: '100px' },
  ...model.value.channels.map(c => ({ key: 'req_' + c.key, label: '● ' + c.key, title: 'Pflicht: Sprachen kommagetrennt oder *', width: '90px' })),
])
const famAttrRows = computed(() => (currentFamily.value?.attributes ?? []).map(a => {
  const r = { key: a.key, group: a.group, _a: a }
  for (const c of model.value.channels) r['req_' + c.key] = (a.required?.[c.key] || []).join(',')
  return r
}))
function familyChange(r, col, v) {
  const f = { ...r._f, label: { ...(r._f.label || {}) } }
  if (col.startsWith('label_')) f.label[col.slice(6)] = v
  else if (col === 'axes') f.axes = v.split(',').map(s => s.trim()).filter(Boolean)
  put(`/api/model/families/${r.key}`, f)
}
function familyAdd() {
  const k = newKey.value.trim(); if (!k) return
  newKey.value = ''
  put(`/api/model/families/${k}`, { key: k, label: {}, attributes: [] })
  selectedFamily.value = k
}
function famAttrChange(r, col, v) {
  const f = { ...currentFamily.value, attributes: currentFamily.value.attributes.map(a => ({ ...a, required: { ...(a.required || {}) } })) }
  const a = f.attributes.find(x => x.key === r.key)
  if (col === 'group') a.group = v || null
  else if (col.startsWith('req_')) {
    const ch = col.slice(4)
    const locales = v.split(',').map(s => s.trim()).filter(Boolean)
    if (locales.length) a.required[ch] = locales; else delete a.required[ch]
  }
  put(`/api/model/families/${f.key}`, f)
}
function famAttrAdd() {
  const k = addAttr.value; if (!k || !currentFamily.value) return
  addAttr.value = ''
  put(`/api/model/families/${currentFamily.value.key}`, { ...currentFamily.value, attributes: [...currentFamily.value.attributes, { key: k }] })
}
function famAttrRemove(r) {
  put(`/api/model/families/${currentFamily.value.key}`, { ...currentFamily.value, attributes: currentFamily.value.attributes.filter(a => a.key !== r.key) })
}
const freeAttrs = computed(() => model.value.attributes.map(a => a.key).filter(k => !(currentFamily.value?.attributes ?? []).some(a => a.key === k)))
</script>

<template>
  <div class="pane" style="width:160px;flex:none">
    <div class="toolbar"><h1>⊞ Modell</h1></div>
    <div class="sections">
      <button v-for="s in sections" :key="s.key" class="section-btn" :class="{ active: section === s.key }" @click="section = s.key">
        <span class="icon">{{ s.icon }}</span> {{ s.label }}
        <span class="muted count">{{ model?.[s.key]?.length ?? '' }}</span>
      </button>
    </div>
  </div>

  <div class="pane" style="flex:1" v-if="model">
    <!-- Attribute -->
    <template v-if="section === 'attributes'">
      <div class="toolbar">
        <h1>Attribute</h1><span class="muted">{{ attrRows.length }}</span><span class="grow" />
        <input v-model="newKey" type="text" placeholder="neuer key (a-z, 0-9, _)" style="width:180px" @keydown.enter="attrAdd" />
        <button class="primary" :disabled="!newKey.trim()" @click="attrAdd">+ Attribut</button>
      </div>
      <div class="scroll">
        <EditGrid :columns="attrCols" :rows="attrRows" removable @change="attrChange" @remove="r => del(`/api/model/attributes/${r.key}`)" />
      </div>
    </template>

    <!-- Wertelisten -->
    <template v-else-if="section === 'lists'">
      <div class="toolbar">
        <h1>Wertelisten</h1><span class="grow" />
        <input v-model="newKey" type="text" placeholder="neue Liste (key)" style="width:160px" @keydown.enter="listAdd" />
        <button class="primary" :disabled="!newKey.trim()" @click="listAdd">+ Liste</button>
      </div>
      <div class="scroll" style="flex:0 0 auto;max-height:40%">
        <EditGrid :columns="listCols" :rows="listRows" :selected="selectedList" @change="listChange" @select="r => selectedList = r.key" />
      </div>
      <div class="toolbar" style="border-top:1px solid var(--line)">
        <h1 class="mono">{{ selectedList ?? '— Liste wählen' }}</h1><span class="muted">{{ valueRows.length }}</span><span class="grow" />
        <input v-model="newValue" type="text" placeholder="neuer Wert" style="width:160px" :disabled="!selectedList" @keydown.enter="valueAdd" />
        <button class="primary" :disabled="!newValue.trim() || !selectedList" @click="valueAdd">+ Wert</button>
      </div>
      <div class="scroll">
        <EditGrid v-if="selectedList" :columns="valueCols" :rows="valueRows" row-key="value" removable @change="valueChange"
          @remove="r => del(`/api/model/lists/${selectedList}/values/${encodeURIComponent(r.value)}`)" />
      </div>
    </template>

    <!-- Familien -->
    <template v-else-if="section === 'families'">
      <div class="toolbar">
        <h1>Familien</h1><span class="grow" />
        <input v-model="newKey" type="text" placeholder="neue Familie (key)" style="width:160px" @keydown.enter="familyAdd" />
        <button class="primary" :disabled="!newKey.trim()" @click="familyAdd">+ Familie</button>
      </div>
      <div class="scroll" style="flex:0 0 auto;max-height:40%">
        <EditGrid :columns="familyCols" :rows="familyRows" :selected="selectedFamily" removable @change="familyChange" @select="r => selectedFamily = r.key" @remove="r => del(`/api/model/families/${r.key}`)" />
      </div>
      <div class="toolbar" style="border-top:1px solid var(--line)">
        <h1 class="mono">{{ selectedFamily ?? '— Familie wählen' }}</h1><span class="muted">{{ famAttrRows.length }} Attribute</span><span class="grow" />
        <select v-model="addAttr" :disabled="!selectedFamily" style="width:160px">
          <option value="">Attribut …</option>
          <option v-for="k in freeAttrs" :key="k" :value="k">{{ k }}</option>
        </select>
        <button class="primary" :disabled="!addAttr" @click="famAttrAdd">+ dazu</button>
      </div>
      <div class="scroll">
        <EditGrid v-if="selectedFamily" :columns="famAttrCols" :rows="famAttrRows" removable @change="famAttrChange" @remove="famAttrRemove" />
      </div>
    </template>

    <!-- Sprachen -->
    <template v-else-if="section === 'locales'">
      <div class="toolbar">
        <h1>Sprachen</h1><span class="grow" />
        <input v-model="newKey" type="text" placeholder="code, z. B. fr" style="width:120px" @keydown.enter="put(`/api/model/locales/${newKey.trim()}`, { code: newKey.trim(), label: '' }); newKey = ''" />
        <button class="primary" :disabled="!newKey.trim()" @click="put(`/api/model/locales/${newKey.trim()}`, { code: newKey.trim(), label: '' }); newKey = ''">+ Sprache</button>
      </div>
      <div class="scroll">
        <EditGrid :columns="localeCols" :rows="model.locales" row-key="code" @change="(r, c, v) => put(`/api/model/locales/${r.code}`, { code: r.code, label: v })" />
      </div>
    </template>

    <!-- Kanäle -->
    <template v-else-if="section === 'channels'">
      <div class="toolbar">
        <h1>Kanäle</h1><span class="grow" />
        <input v-model="newKey" type="text" placeholder="key, z. B. amazon" style="width:140px" @keydown.enter="put(`/api/model/channels/${newKey.trim()}`, { key: newKey.trim(), label: {} }); newKey = ''" />
        <button class="primary" :disabled="!newKey.trim()" @click="put(`/api/model/channels/${newKey.trim()}`, { key: newKey.trim(), label: {} }); newKey = ''">+ Kanal</button>
      </div>
      <div class="scroll">
        <EditGrid :columns="channelCols" :rows="channelRows" @change="(r, c, v) => put(`/api/model/channels/${r.key}`, { key: r.key, label: { ...(r._c.label || {}), [c.slice(6)]: v } })" />
      </div>
    </template>
  </div>
  <div v-else class="empty">Modell wird geladen …</div>
</template>

<style scoped>
.sections { display: flex; flex-direction: column; padding: 4px; gap: 2px; }
.section-btn { text-align: left; border: 0; background: none; padding: 6px 8px; border-radius: 4px; display: flex; gap: 6px; align-items: center; }
.section-btn:hover { background: var(--bg); }
.section-btn.active { background: var(--accent-soft); color: var(--accent); }
.section-btn .icon { width: 16px; text-align: center; }
.section-btn .count { margin-left: auto; font-size: 11px; }
</style>
