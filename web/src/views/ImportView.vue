<script setup>
// ⇩ Import aus der IXP-API: links der Quellbaum (Haken = Teilbaum), in der Mitte
// die Zuordnung (Ziel, Sprachen, Familie, Attribute), rechts Vorschau und der
// Stapel. Alles läuft im Browser; der Server sieht nur /api/batch.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { tree, icon } from '../tree.js'
import { ixp, IXP_DEMO, SYSTEM, ROLE, isNode } from '../ixp.js'

const saved = JSON.parse(localStorage.getItem('journali.import.ixp') || '{}')
const base = ref(saved.base || IXP_DEMO)
const token = ref(saved.token || '')
const lang = ref(saved.lang || 'de')
const target = ref(saved.target || '')
const family = ref(saved.family || '')
const importLocales = ref(saved.importLocales || null)
const persist = () => localStorage.setItem('journali.import.ixp', JSON.stringify({ base: base.value, token: token.value, lang: lang.value, target: target.value, family: family.value, importLocales: importLocales.value }))

let client = null
const connected = ref(false)
const languages = ref([])
const rows = ref([])            // Quellbaum flach: { doc, depth, parent, loaded }
const expanded = ref(new Set())
const checked = ref(new Set())  // Haken = dieser Knoten (Teilbaum folgt beim Analysieren)
const busy = ref('')
const log = ref([])
const plan = ref(null)          // Ergebnis von analyse()
const mapping = ref({})         // property identifier → attribute key | 'new:text' | 'new:html' | ''
const result = ref(null)

const model = computed(() => store.model)
const groups = computed(() => tree.rows.filter(r => r.role === 'group'))
const modelLocales = computed(() => model.value?.locales.map(l => l.code) ?? [])
const localeAttrs = computed(() => (model.value?.attributes ?? []).filter(a => a.perLocale && (a.type === 'text' || a.type === 'html')))
const selectedLocales = computed(() => (importLocales.value ?? modelLocales.value).filter(l => modelLocales.value.includes(l) && languages.value.some(x => x.code === l)))

onMounted(() => { if (!tree.loaded) tree.load() })

function say(text) { log.value.unshift(`${new Date().toLocaleTimeString('de-DE')} ${text}`); if (log.value.length > 200) log.value.pop() }

async function connect() {
  busy.value = 'verbinde …'
  try {
    client = ixp(base.value, token.value)
    languages.value = await client.languages()
    const roots = (await client.roots()).filter(d => d.meta?.lang === lang.value)
    rows.value = roots.map(d => ({ doc: d, depth: 0, parent: null, loaded: false }))
    expanded.value = new Set(); checked.value = new Set(); plan.value = null; result.value = null
    connected.value = true
    persist()
    say(`verbunden: ${languages.value.length} Sprachen, ${roots.length} Wurzeln (${lang.value})`)
    for (const r of [...rows.value]) await expand(r)   // Kopie: expand fügt Zeilen ein
  } catch (e) { store.toast(e.message); say('Fehler: ' + e.message) }
  finally { busy.value = '' }
}

async function expand(row) {
  if (!row.loaded) {
    row.loaded = true
    const kids = (await client.children(row.doc.id)).filter(isNode)
    const i = rows.value.indexOf(row)
    rows.value.splice(i + 1, 0, ...kids.map(d => ({ doc: d, depth: row.depth + 1, parent: row, loaded: false })))
  }
  expanded.value.add(row.doc.id)
}
function collapse(row) { expanded.value.delete(row.doc.id) }
async function toggle(row) { expanded.value.has(row.doc.id) ? collapse(row) : await expand(row) }
const visible = computed(() => rows.value.filter(r => { for (let p = r.parent; p; p = p.parent) if (!expanded.value.has(p.doc.id)) return false; return true }))
function check(row) { checked.value.has(row.doc.id) ? checked.value.delete(row.doc.id) : checked.value.add(row.doc.id) }
function checkedAbove(row) { for (let p = row.parent; p; p = p.parent) if (checked.value.has(p.doc.id)) return true; return false }

// ---- Analysieren: Teilbäume vollständig laden, Sprachfassungen holen, Eigenschaften sammeln
async function analyse() {
  if (!checked.value.size) { store.toast('Nichts angehakt'); return }
  busy.value = 'lade …'
  plan.value = null; result.value = null
  try {
    // Ausgewählte Wurzeln des Imports: angehakt, aber kein angehakter Vorfahr
    const picked = rows.value.filter(r => checked.value.has(r.doc.id) && !checkedAbove(r))
    const items = []   // { doc, parentMaster, role, versions: {lang: doc} }
    let n = 0
    async function walk(doc, parentMaster) {
      const item = { doc, parentMaster, role: ROLE[doc.type], versions: {} }
      items.push(item)
      busy.value = `lade … ${++n}`
      for (const v of await client.versions(doc.masterId)) if (selectedLocales.value.includes(v.meta?.lang)) item.versions[v.meta.lang] = v
      if (doc.type !== 'productVariant')
        for (const k of (await client.children(doc.id)).filter(isNode)) await walk(k, doc.masterId)
    }
    for (const r of picked) await walk(r.doc, r.parent?.doc.masterId ?? null)

    // Eigenschaften über alle Fassungen zählen, Zuordnung vorschlagen
    const props = {}
    for (const it of items) for (const v of Object.values(it.versions)) for (const [k, val] of Object.entries(v.properties || {})) {
      props[k] ??= { count: 0, html: false }
      props[k].count++
      if (typeof val === 'string' && /<[a-z][\s\S]*>/i.test(val)) props[k].html = true
    }
    const attrKeys = new Set(localeAttrs.value.map(a => a.key))
    for (const k of Object.keys(props)) {
      // Gibt es das Attribut inzwischen (voriger Lauf hat es angelegt), nicht mehr „neu anlegen“.
      if (mapping.value[k]?.startsWith('new:') && attrKeys.has(k)) mapping.value[k] = k
      mapping.value[k] ??= k === 'title' ? 'name' : attrKeys.has(k) ? k : (props[k].html ? 'new:html' : 'new:text')
    }

    // Neu oder vorhanden? Über die externe Kennung im eigenen Baum.
    const known = new Map(tree.rows.filter(r => r.external?.[SYSTEM]).map(r => [r.external[SYSTEM], r]))
    for (const it of items) it.existing = known.get(it.doc.masterId) ?? null
    plan.value = { items, props, picked: picked.length }
    say(`analysiert: ${items.length} Knoten, ${Object.keys(props).length} Eigenschaften, ${items.filter(i => i.existing).length} vorhanden`)
  } catch (e) { store.toast(e.message); say('Fehler: ' + e.message) }
  finally { busy.value = '' }
}

const counts = computed(() => {
  const c = { group: [0, 0], product: [0, 0], variant: [0, 0] }
  for (const it of plan.value?.items ?? []) c[it.role][it.existing ? 1 : 0]++
  return c
})
const newAttrs = computed(() => Object.entries(mapping.value).filter(([, v]) => v.startsWith('new:')).map(([k, v]) => ({ key: k.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]/, 'p_'), type: v.slice(4), from: k })))

// ---- Schreiben: fehlende Attribute anlegen, dann ein Stapel
async function run() {
  if (!store.actor) { store.toast('Name fehlt → Einstellungen'); return }
  if (!plan.value) return
  if (plan.value.items.some(i => i.role === 'product' && !i.existing) && !family.value) { store.toast('Familie für neue Produkte wählen'); return }
  busy.value = 'schreibe …'
  result.value = null
  try {
    for (const a of newAttrs.value) {
      if (model.value.attributes.some(x => x.key === a.key)) continue
      await api.post(`/api/model/attributes/${a.key}`, { key: a.key, label: { de: a.from, en: a.from }, type: a.type, group: 'import', axes: ['locale'] }, 'PUT')
      say(`Attribut ${a.key} (${a.type}) angelegt`)
    }
    const attrOf = k => { const m = mapping.value[k]; if (!m) return null; if (m.startsWith('new:')) return newAttrs.value.find(a => a.from === k)?.key; return m }

    // Vorhandene Knoten: eigene Werte holen, damit nur Geändertes geschrieben wird.
    const own = new Map()
    for (const it of plan.value.items) if (it.existing) {
      const n = await api.get(`/api/nodes/${it.existing.id}`)
      own.set(it.existing.id, new Map(n.values.map(v => [`${v.attribute}|${v.locale ?? ''}`, v.value])))
    }

    const cmds = []
    const refOf = new Map()   // masterId → '@ref' oder Knoten-Id
    let refNo = 0
    for (const it of plan.value.items) {
      let node
      if (it.existing) node = it.existing.id
      else {
        const ref = 'n' + (++refNo)
        const parent = it.parentMaster && refOf.has(it.parentMaster) ? refOf.get(it.parentMaster) : (target.value || null)
        const labels = Object.fromEntries(Object.entries(it.versions).map(([l, v]) => [l, v.name]))
        if (it.role === 'group') cmds.push({ op: 'group.create', ref, args: { parent, label: labels } })
        else if (it.role === 'product') {
          if (!parent) throw new Error(`Produkt ${it.doc.name}: keine Zielgruppe`)
          cmds.push({ op: 'product.create', ref, args: { group: parent, family: family.value } })
        } else {
          if (!parent || !parent.startsWith('@') && tree.byId.get(parent)?.role !== 'product') throw new Error(`Variante ${it.doc.name}: kein Produkt darüber`)
          cmds.push({ op: 'variant.create', ref, args: { product: parent, axisValues: {} } })
        }
        node = '@' + ref
        cmds.push({ op: 'external.link', args: { node, system: SYSTEM, id: it.doc.masterId } })
      }
      refOf.set(it.doc.masterId, node)
      if (it.role === 'group') continue   // Gruppen: nur Label
      const have = own.get(node) ?? new Map()
      for (const [l, v] of Object.entries(it.versions)) {
        const values = { ...(v.properties || {}) }
        if (!values.title && v.name) values.title = v.name
        for (const [k, val] of Object.entries(values)) {
          const attribute = attrOf(k)
          if (!attribute || val == null || val === '') continue
          if (have.get(`${attribute}|${l}`) === val) continue
          cmds.push({ op: 'attribute.set', args: { node, attribute, locale: l, value: String(val) } })
        }
      }
    }
    if (!cmds.length) { say('nichts zu schreiben — alles schon so'); result.value = { batch: null, results: [] }; return }
    say(`Stapel mit ${cmds.length} Befehlen …`)
    const res = await api.post('/api/batch', { commands: cmds })
    result.value = res
    say(res.error ? `Fehler bei Befehl ${res.error.index} (${res.error.op}): ${res.error.message} — ${res.results.length} geschrieben` : `fertig: ${res.results.length} Einträge, Stapel ${res.batch}`)
    await store.poll(true); await tree.load()
    plan.value = null
  } catch (e) { store.toast(e.message); say('Fehler: ' + e.message) }
  finally { busy.value = '' }
}
function toggleLocale(l) {
  const s = new Set(selectedLocales.value); s.has(l) ? s.delete(l) : s.add(l)
  importLocales.value = modelLocales.value.filter(c => s.has(c)); persist()
}
</script>

<template>
  <div class="pane" style="width:340px;flex:none">
    <div class="toolbar"><h1>⇩ Quelle: IXP</h1><span class="grow" /><span v-if="busy" class="muted">{{ busy }}</span></div>
    <div class="form">
      <input v-model="base" type="text" placeholder="https://…/api" title="Basis-URL der IXP-API" />
      <div class="row">
        <input v-model="token" type="password" placeholder="Token (leer für Demo)" style="flex:1" />
        <select v-model="lang" title="Sprache zum Blättern"><option v-for="l in (languages.length ? languages : [{ code: lang }])" :key="l.code" :value="l.code">{{ l.code }}</option></select>
        <button class="primary" @click="connect" :disabled="!!busy">Verbinden</button>
      </div>
    </div>
    <div class="scroll src">
      <div v-for="r in visible" :key="r.doc.id" class="node" :class="[r.doc.type, { on: checked.has(r.doc.id) || checkedAbove(r) }]" :style="`padding-left:${6 + r.depth * 14}px`" :title="r.doc.masterId">
        <span class="twisty" @click="toggle(r)">{{ r.doc.type === 'productVariant' ? '' : (expanded.has(r.doc.id) ? '▾' : '▸') }}</span>
        <input type="checkbox" :checked="checked.has(r.doc.id) || checkedAbove(r)" :disabled="checkedAbove(r)" @change="check(r)" title="Teilbaum importieren" />
        <span class="icon">{{ icon(ROLE[r.doc.type]) }}</span>
        <span class="label">{{ r.doc.name }}</span>
      </div>
      <div v-if="!connected" class="empty">Verbinden — die Demo geht ohne Token.</div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">Haken = Teilbaum · {{ checked.size }} gewählt</div>
  </div>

  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>Zuordnung</h1><span class="grow" /><button class="primary" @click="analyse" :disabled="!connected || !checked.size || !!busy">Analysieren</button></div>
    <div class="scroll">
      <table class="grid form-grid">
        <tbody>
          <tr><td class="muted">Ziel ▣</td><td>
            <select v-model="target" @change="persist"><option value="">— Wurzel —</option><option v-for="g in groups" :key="g.id" :value="g.id">{{ g.label }}</option></select>
            <span class="muted">neue Gruppen und Produkte hängen hier unter; im Quellbaum tiefere unter ihre importierten Eltern</span>
          </td></tr>
          <tr><td class="muted">Familie ▦</td><td>
            <select v-model="family" @change="persist"><option value="">— wählen —</option><option v-for="f in model?.families ?? []" :key="f.key" :value="f.key">{{ f.label?.de || f.key }}</option></select>
            <span class="muted">für neue Produkte; IXP kennt <span class="mono">class_identifier</span>, das Modell muss eine Familie dazu haben</span>
          </td></tr>
          <tr><td class="muted">Sprachen 🗣</td><td>
            <span v-for="l in languages" :key="l.code" class="view-chip" :class="{ on: selectedLocales.includes(l.code), off: !modelLocales.includes(l.code) }" :title="modelLocales.includes(l.code) ? l.languageName : l.languageName + ' — nicht im Modell'" @click="modelLocales.includes(l.code) && toggleLocale(l.code)">{{ l.code }}</span>
            <span class="muted">nur Sprachen des Modells</span>
          </td></tr>
        </tbody>
      </table>

      <div class="section" v-if="plan">
        <h2>Eigenschaften → Attribute</h2>
        <table class="grid">
          <thead><tr><th>IXP</th><th class="num">#</th><th>Attribut</th></tr></thead>
          <tbody>
            <tr v-for="[k, p] in Object.entries(plan.props)" :key="k">
              <td class="mono">{{ k }} <span v-if="p.html" class="muted" title="enthält HTML">‹›</span></td>
              <td class="num">{{ p.count }}</td>
              <td>
                <select v-model="mapping[k]">
                  <option value="">— überspringen —</option>
                  <option v-for="a in localeAttrs" :key="a.key" :value="a.key">{{ a.label?.de || a.key }} ({{ a.type }})</option>
                  <option value="new:text">neu anlegen: text</option>
                  <option value="new:html">neu anlegen: html</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="muted" v-if="newAttrs.length">Neu im Modell: {{ newAttrs.map(a => `${a.key} (${a.type})`).join(', ') }} — Gruppe „import“, je Sprache.</p>
      </div>
    </div>
  </div>

  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>Vorschau</h1><span class="grow" /><button class="primary" @click="run" :disabled="!plan || !!busy">Schreiben</button></div>
    <div class="scroll">
      <table v-if="plan" class="grid" style="width:auto">
        <thead><tr><th></th><th class="num pos">neu</th><th class="num">vorhanden</th></tr></thead>
        <tbody>
          <tr v-for="r in ['group', 'product', 'variant']" :key="r"><td>{{ icon(r) }} {{ r }}</td><td class="num pos">{{ counts[r][0] }}</td><td class="num">{{ counts[r][1] }}</td></tr>
        </tbody>
      </table>
      <table v-if="plan" class="grid">
        <thead><tr><th>Knoten</th><th>Sprachen</th><th></th></tr></thead>
        <tbody>
          <tr v-for="it in plan.items" :key="it.doc.id">
            <td :title="it.doc.masterId">{{ icon(it.role) }} {{ it.doc.name }}</td>
            <td class="mono muted">{{ Object.keys(it.versions).join(' ') }}</td>
            <td><router-link v-if="it.existing" :to="`/tree/${it.existing.id}`" class="muted">vorhanden →</router-link><span v-else class="pos">neu</span></td>
          </tr>
        </tbody>
      </table>
      <div v-if="result" class="section">
        <h2>Ergebnis</h2>
        <div v-if="result.error" class="neg">Abbruch bei Befehl {{ result.error.index }} ({{ result.error.op }}): {{ result.error.message }} — {{ result.results.length }} Einträge davor geschrieben, Stapel <span class="mono">{{ result.batch }}</span>.</div>
        <div v-else-if="result.batch" class="pos">{{ result.results.length }} Einträge, Stapel <span class="mono">{{ result.batch }}</span> → <router-link to="/journal">Journal</router-link></div>
        <div v-else class="muted">Nichts zu schreiben.</div>
      </div>
      <div class="section">
        <h2>Protokoll</h2>
        <div v-for="(l, i) in log" :key="i" class="mono muted" style="font-size:11px">{{ l }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.form { padding: 6px 8px; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 4px; }
.form input { width: 100%; }
.row { display: flex; gap: 4px; }
.src .node { display: flex; align-items: center; gap: 4px; height: 24px; white-space: nowrap; }
.src .node.on { background: var(--accent-soft); }
.twisty { width: 12px; color: var(--muted); font-size: 11px; cursor: pointer; }
.icon { width: 16px; text-align: center; }
.node.group .icon { color: var(--muted); }
.node.product .icon { color: var(--accent); }
.node.productVariant .icon { color: var(--warn); }
.label { overflow: hidden; text-overflow: ellipsis; }
.form-grid td { white-space: normal; vertical-align: middle; height: 34px; }
.form-grid select { margin-right: 8px; }
.view-chip.off { opacity: .4; cursor: default; }
.section { padding: 10px 8px; border-top: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600; }
</style>
