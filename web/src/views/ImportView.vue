<script setup>
// ⇩ Import aus der IXP-API: links der Quellbaum (Haken = Teilbaum), in der Mitte
// die Zuordnung (Ziel, Sprachen, Familie, Attribute), rechts Vorschau und der
// Stapel. Alles läuft im Browser; der Server sieht nur /api/batch.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { tree, icon } from '../tree.js'
import { ixp, IXP_DEMO, SYSTEM, ROLE, isNode, attrType } from '../ixp.js'
import { plugins } from '../plugins.js'
import Splitter from '../components/Splitter.vue'
import ImportHead from '../components/ImportHead.vue'
import { paneWidth } from '../panes.js'
const srcW = paneWidth('import.src', 340)

const saved = JSON.parse(localStorage.getItem('journali.import.ixp') || '{}')
const base = ref(saved.base || '')   // keine Vorgabe; Quellen stehen im Profil (Taloan, 17.09.)
const token = ref(saved.token || '')
const lang = ref(saved.lang || 'de')
const target = ref(saved.target || '')
const importLocales = ref(saved.importLocales || null)
// Präfix je Quellsystem (Taloan, 17.09.): neue Attribute heissen <prefix><key>, ihre Gruppe <prefix>import —
// so kollidieren title aus IXP und title aus Solr nicht, und man sieht dem Attribut die Herkunft an.
const prefix = ref(saved.prefix ?? 'ixp_')
const cleanPrefix = computed(() => prefix.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z]+/, ''))
const importGroup = computed(() => (cleanPrefix.value || '') + 'import')
const withImages = ref(saved.withImages ?? true)   // Bilder der Quelle (doc.image) als Medien holen und per Relation „image“ anhängen (Taloan, 17.09.)
const persist = () => localStorage.setItem('journali.import.ixp', JSON.stringify({ base: base.value, token: token.value, lang: lang.value, target: target.value, prefix: prefix.value, importLocales: importLocales.value, withImages: withImages.value }))

let client = null
const connected = ref(false)
const languages = ref([])
const rows = ref([])            // Quellbaum flach: { doc, depth, parent, loaded }
const expanded = ref(new Set())
const checked = ref(new Set())  // Haken = dieser Knoten (Teilbaum folgt beim Analysieren)
const busy = ref('')
const log = ref([])
const plan = ref(null)          // Ergebnis von analyse()
const mapping = ref({})         // property identifier → attribute key | 'new:<typ>' | ''
const groupOf = ref({})         // property identifier → Gruppe für ein neues Attribut (Vorschlag: <prefix><class_identifier>)
const propDefs = ref({})        // Eigenschaftsdefinitionen der Quelle: key → { type, ez }
const result = ref(null)

const model = computed(() => store.model)
const groups = computed(() => tree.rows.filter(r => r.role === 'group'))
const modelLocales = computed(() => model.value?.locales.map(l => l.code) ?? [])
const localeAttrs = computed(() => (model.value?.attributes ?? []).filter(a => a.perLocale && (a.type === 'text' || a.type === 'html')))
const selectedLocales = computed(() => (importLocales.value ?? modelLocales.value).filter(l => modelLocales.value.includes(l) && languages.value.some(x => x.code === l)))

onMounted(() => { if (!tree.loaded) tree.load() })

function say(text) { log.value.unshift(`${new Date().toLocaleTimeString('de-DE')} ${text}`); if (log.value.length > 200) log.value.pop() }

// Profile (ProfileBar): Quelle, Sprache, Ziel, Sprachen, Zuordnung — ohne Token (der bleibt im Browser, nicht im Journal)
const profileGet = () => ({ base: base.value, lang: lang.value, target: target.value, importLocales: importLocales.value, mapping: mapping.value, groupOf: groupOf.value, withImages: withImages.value, prefix: prefix.value })
async function profileSet(p) {
  if (!p) {   // „— Profil —“: alles leer, Quelle zu
    base.value = ''; token.value = ''; lang.value = 'de'; target.value = ''; importLocales.value = null; withImages.value = true; mapping.value = {}
    connected.value = false; rows.value = []; checked.value = new Set(); plan.value = null; result.value = null; persist(); return
  }
  base.value = p.base ?? ''; lang.value = p.lang ?? 'de'; target.value = p.target ?? ''; importLocales.value = p.importLocales ?? null; prefix.value = p.prefix ?? 'ixp_'; groupOf.value = p.groupOf ?? {}; withImages.value = p.withImages ?? true
  if (p.mapping) mapping.value = { ...p.mapping }
  if (base.value) await connect()
}
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
// Bilder: doc.image (Vorschau-URL der Quelle) holt der Server (POST /api/media/fetch — der Browser scheiterte an CORS),
// gleiche Datei = gleiches Medium (sha256); dann Relation „image“ Knoten → Medium, wenn sie nicht schon da ist.
async function importImages(refOf, res) {
  const byRef = new Map(res.results.filter(r => r.ref).map(r => ['@' + r.ref, r.node]))
  const items = plan.value.items.filter(it => it.role !== 'group')
  if (!items.length) return
  busy.value = `Medien …`; let n = 0, had = 0, fail = 0, seen = 0
  const origin = (() => { try { return new URL(base.value).origin } catch { return '' } })()
  const abs = u => /^https?:\/\//.test(u) ? u : origin + (u.startsWith('/') ? '' : '/') + u
  for (const it of items) {
    const node = (refOf.get(it.doc.masterId) ?? '').startsWith('@') ? byRef.get(refOf.get(it.doc.masterId)) : refOf.get(it.doc.masterId)
    if (!node) continue
    // Quellen: 1. Asset-Dokumente unter dem Knoten (Typen image/media/file, mit uri und mimeType), 2. das Vorschaubild (image-Feld)
    const wanted = []   // { url, name, type }
    try {
      for (const a of await client.assets(it.doc.id)) {
        let asset = a; if (!a.uri) { try { asset = await client.asset(a.id) } catch {} }
        const url = asset.uri || asset.path || asset.image; if (!url) continue
        const mime = asset.mimeType || ''
        wanted.push({ url: abs(url), name: asset.name || decodeURIComponent(url.split('/').pop().split('?')[0]), type: mime.startsWith('image/') || a.type === 'image' ? 'image' : 'document' })
      }
    } catch (e) { say(`Assets ${it.doc.name}: ${e.message}`) }
    const preview = it.doc.image || Object.values(it.versions).find(v => v.image)?.image
    if (preview && !wanted.some(w => w.url === preview)) wanted.push({ url: preview, name: decodeURIComponent(preview.split('/').pop().split('?')[0]), type: 'image' })
    if (!wanted.length) continue
    let rels = null
    for (const w of wanted) {
      seen++
      try {
        const m = await api.post('/api/media/fetch', { url: w.url, name: w.name })
        rels ??= await api.get(`/api/nodes/${encodeURIComponent(node)}/relations`)
        if ((rels.out ?? []).some(r => r.to === m.id)) { had++; continue }
        const type = mediaTypes.value.some(t => t.key === w.type) ? w.type : (mediaTypes.value[0]?.key ?? 'image')
        await api.post('/api/relations', { type, from: node, to: m.id }); n++
      } catch (e) { fail++; say(`Medium ${w.name} (${it.doc.name}): ${e.message}`) }
      busy.value = `Medien … ${seen} (${n} neu)`
    }
  }
  say(`Medien: ${n} angehängt, ${had} waren schon da${fail ? `, ${fail} fehlgeschlagen` : ''}${seen ? '' : ' — die Quelle liefert an diesen Knoten keine Assets und keine Vorschaubilder'}`)
}
// Relationstypen für Medien (image, document …) aus dem Modell
const mediaTypes = computed(() => (model.value?.relationTypes ?? []).filter(t => (t.to ?? []).includes('media')))
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

    // Eigenschaftsdefinitionen der Quelle (Typ), Klasse je Produkt (Gruppe), Werte je Eigenschaft (Wertelisten)
    busy.value = 'lade Eigenschaftsdefinitionen …'
    try { propDefs.value = await client.properties(lang.value) } catch (e) { say('keine Eigenschaftsdefinitionen: ' + e.message); propDefs.value = {} }
    const props = {}
    for (const it of items) {
      const cls = Object.values(it.versions).map(v => v.metaProperties?.class_identifier).find(Boolean) ?? null
      it.cls = cls
      for (const v of Object.values(it.versions)) for (const [k, val] of Object.entries(v.properties || {})) {
        props[k] ??= { count: 0, html: false, classes: new Set(), values: new Set(), def: propDefs.value[k] ?? null }
        props[k].count++
        if (cls) props[k].classes.add(cls)
        if (typeof val === 'string' && /<[a-z][\s\S]*>/i.test(val)) props[k].html = true
        if (props[k].def?.ez === 'ezselection' && val != null && val !== '') props[k].values.add(String(val))
      }
    }
    for (const p of Object.values(props)) { p.srcType = attrType(p.def, p.html); p.classes = [...p.classes]; p.values = [...p.values] }
    const attrKeys = new Set(localeAttrs.value.map(a => a.key))
    for (const k of Object.keys(props)) {
      // Gibt es das Attribut inzwischen (voriger Lauf hat es angelegt), nicht mehr „neu anlegen“.
      if (mapping.value[k]?.startsWith('new:') && attrKeys.has(k)) mapping.value[k] = k
      const pk = cleanPrefix.value + k.toLowerCase().replace(/[^a-z0-9_]/g, '_')
      if (mapping.value[k]?.startsWith('new:') && attrKeys.has(pk)) mapping.value[k] = pk
      mapping.value[k] ??= k === 'title' ? 'name' : attrKeys.has(pk) ? pk : attrKeys.has(k) ? k : 'new:' + props[k].srcType
      // Gruppe für ein neues Attribut: aus der Klasse des Produkts im Quellsystem, sonst <prefix>import
      groupOf.value[k] ??= props[k].classes[0] ? cleanPrefix.value + props[k].classes[0].toLowerCase().replace(/[^a-z0-9_]/g, '_') : importGroup.value
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
const newAttrs = computed(() => Object.entries(mapping.value).filter(([k, v]) => v.startsWith('new:') && plan.value?.props[k]).map(([k, v]) => {
  const p = plan.value.props[k]
  const key = (cleanPrefix.value + k.toLowerCase().replace(/[^a-z0-9_]/g, '_')).replace(/^[^a-z]/, 'p_')
  return { key, type: v.slice(4), from: k, group: groupOf.value[k] || importGroup.value, multiple: p.def?.type === 'multi_string', list: v.slice(4) === 'enum' ? key : null, values: p.values }
}))
const newGroups = computed(() => [...new Set(newAttrs.value.map(a => a.group))].filter(g => !model.value.groups.some(x => x.key === g && x.defined)))
const groupOptions = computed(() => [...new Set([...(model.value?.groups ?? []).map(g => g.key), ...Object.values(groupOf.value)])].sort())
const typeOptions = ['text', 'html', 'integer', 'decimal', 'boolean', 'date', 'enum']

// ---- Schreiben: fehlende Attribute anlegen, dann ein Stapel
async function run() {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  if (!plan.value) return
  busy.value = 'schreibe …'
  result.value = null
  try {
    for (const g of newGroups.value) {
      const label = g.startsWith(cleanPrefix.value) ? g.slice(cleanPrefix.value.length) : g
      await api.post(`/api/model/groups/${g}`, { key: g, label: { de: label, en: label }, activeFrom: null }, 'PUT')
      say(`Gruppe ${g} angelegt`)
    }
    for (const a of newAttrs.value) {
      if (model.value.attributes.some(x => x.key === a.key)) continue
      if (a.list && !model.value.lists.some(l => l.key === a.list)) {
        await api.post(`/api/model/lists/${a.list}`, { key: a.list, label: { de: a.from, en: a.from } }, 'PUT')
        let i = 0
        for (const v of a.values) await api.post(`/api/model/lists/${a.list}/values/${encodeURIComponent(v.toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'x')}`, { value: v.toLowerCase().replace(/[^a-z0-9_]/g, '_') || 'x', label: { de: v, en: v }, order: ++i }, 'PUT')
        say(`Werteliste ${a.list}: ${a.values.length} Werte`)
      }
      await api.post(`/api/model/attributes/${a.key}`, { key: a.key, label: { de: a.from, en: a.from }, type: a.type, group: a.group, axes: a.type === 'enum' || a.type === 'boolean' || a.type === 'decimal' || a.type === 'integer' ? [] : ['locale'], multiple: a.multiple, list: a.list }, 'PUT')
      say(`Attribut ${a.key} (${a.type}${a.multiple ? ', mehrfach' : ''}) in ${a.group} angelegt`)
    }
    const attrOf = k => { const m = mapping.value[k]; if (!m) return null; if (m.startsWith('new:')) return newAttrs.value.find(a => a.from === k)?.key; return m }
    // Die Gruppen der zugeordneten Attribute hängen an der Zielgruppe (oder an jeder neuen Wurzelgruppe), sonst gilt dort nichts.
    const neededGroups = [...new Set(Object.keys(mapping.value).map(attrOf).filter(Boolean).map(k => model.value.attributes.find(a => a.key === k)?.group ?? newAttrs.value.find(a => a.key === k)?.group ?? null).filter(Boolean))]
    if (target.value && neededGroups.length) {
      const t = await api.get(`/api/nodes/${target.value}`)
      const have = new Set((t.groups ?? []).map(g => g.key))
      const add = neededGroups.filter(g => !have.has(g))
      if (add.length) { await api.post(`/api/nodes/${target.value}/groups`, { groups: [...t.attachedGroups, ...add] }, 'PUT'); say(`Zielgruppe: ${add.join(', ')} angehängt`) }
    }

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
        if (it.role === 'group') {
          cmds.push({ op: 'group.create', ref, args: { parent, label: labels } })
          if (!parent && neededGroups.length) cmds.push({ op: 'groups.attach', args: { node: '@' + ref, groups: neededGroups } })
        }
        else if (it.role === 'product') {
          if (!parent) throw new Error(`Produkt ${it.doc.name}: keine Zielgruppe`)
          cmds.push({ op: 'product.create', ref, args: { group: parent } })
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
          const def = model.value.attributes.find(a => a.key === attribute) ?? newAttrs.value.find(a => a.key === attribute)
          const perLocale = def?.perLocale ?? (def?.axes ? def.axes.includes('locale') : !['enum', 'boolean', 'decimal', 'integer'].includes(def?.type))
          const loc = perLocale ? l : null
          if (!perLocale && l !== Object.keys(it.versions)[0]) continue   // sprachunabhängig: einmal reicht
          if (have.get(`${attribute}|${loc ?? ''}`) === val) continue
          if (def?.type === 'enum') cmds.push({ op: 'attribute.set', args: { node, attribute, locale: loc, value: String(val).toLowerCase().replace(/[^a-z0-9_]/g, '_') } })
          else if (def?.multiple) cmds.push({ op: 'attribute.set', args: { node, attribute, locale: loc, values: String(val).split(/[;,|]\s*/).map(s => s.trim()).filter(Boolean) } })
          else cmds.push({ op: 'attribute.set', args: { node, attribute, locale: loc, value: String(val) } })
        }
      }
    }
    // nichts zu schreiben — die Medien trotzdem nachholen (zweiter Lauf nach einem Import ohne Medien, Taloan 18.09.)
    if (!cmds.length) { say('nichts zu schreiben — alles schon so'); result.value = { batch: null, results: [] }; if (withImages.value) await importImages(refOf, { results: [] }); return }
    say(`Stapel mit ${cmds.length} Befehlen …`)
    const res = await api.batchChunked(cmds, { label: 'IXP schreibt', onProgress: p => { busy.value = `schreibe … ${p.done}/${p.total}` } })
    result.value = res
    say(res.error ? `Fehler bei Befehl ${res.error.index} (${res.error.op}): ${res.error.message} — ${res.results.length} geschrieben` : `fertig: ${res.results.length} Einträge, Stapel ${res.batch}`)
    await store.poll(true); await tree.load()
    if (withImages.value && !res.error) await importImages(refOf, res)
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
  <div class="pane" :style="`width:${srcW}px;flex:none`">
    <ImportHead source="ixp" plugin="ixp" :busy="busy" :get="profileGet" :set="profileSet">
      <tr><td class="attr">Quelle</td><td>
        <input v-model="base" type="text" :placeholder="'https://…/api  (Demo: ' + IXP_DEMO + ')'" title="Basis-URL der IXP-API" @keydown.enter="connect" />
      </td></tr>
      <tr><td class="attr">Token</td><td class="row"><input v-model="token" type="password" placeholder="leer für die Demo" title="bleibt im Browser, nicht im Profil" style="flex:1" />
        <button class="primary" @click="connect" :disabled="!!busy">Verbinden</button></td></tr>
      <tr><td class="attr">Medien</td><td><label title="Asset-Dokumente unter dem Knoten (Bilder als „image“, Dateien als „document“) und das Vorschaubild als Medien holen; gleiche Datei = ein Medium; der Server lädt"><input type="checkbox" v-model="withImages" @change="persist" /> Bilder und Dateien der Quelle als Medien holen</label></td></tr>
    </ImportHead>
    <div class="step-band">2 · Auswahl <span class="muted">· Haken = Teilbaum</span><span class="grow" />
      <span class="muted" title="nur zum Lesen der Namen im Quellbaum — importiert werden die Sprachen aus 3">blättern in</span>
      <select v-model="lang" @change="connected && connect()" title="Sprache zum Blättern — importiert werden die Sprachen aus 3" style="width:70px;font-size:12px"><option v-for="l in (languages.length ? languages : [{ code: lang }])" :key="l.code" :value="l.code">{{ l.code }}</option></select>
      <span class="muted">{{ checked.size }} gewählt</span></div>
    <div class="scroll src">
      <div v-for="r in visible" :key="r.doc.id" class="node" :class="[r.doc.type, { on: checked.has(r.doc.id) || checkedAbove(r) }]" :style="`padding-left:${6 + r.depth * 14}px`" :title="r.doc.masterId">
        <span class="twisty" @click="toggle(r)">{{ r.doc.type === 'productVariant' ? '' : (expanded.has(r.doc.id) ? '▾' : '▸') }}</span>
        <input type="checkbox" :checked="checked.has(r.doc.id) || checkedAbove(r)" :disabled="checkedAbove(r)" @change="check(r)" title="Teilbaum importieren" />
        <span class="icon">{{ icon(ROLE[r.doc.type]) }}</span>
        <span class="label">{{ r.doc.name }}</span>
        <span v-if="r.depth === 0 && r.doc.meta?.market?.length" class="muted" title="Markt der Wurzel">· {{ r.doc.meta.market.join(', ') }}</span>
      </div>
      <div v-if="!connected" class="empty">Verbinden — die Demo geht ohne Token.</div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">Haken = Teilbaum · {{ checked.size }} gewählt</div>
  </div>

  <Splitter v-model="srcW" :min="240" :max="800" />
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>3 · Zuordnung</h1><span class="grow" /><button class="primary" @click="analyse" :disabled="!connected || !checked.size || !!busy">Analysieren</button></div>
    <div class="scroll">
      <table class="grid form-grid"><colgroup><col style="width:84px" /><col /></colgroup>
        <tbody>
          <tr><td class="muted">Präfix ⊞</td><td class="row">
            <input v-model="prefix" type="text" style="width:90px" placeholder="z. B. sap_" @change="persist" title="vor jedem neu angelegten Attribut und als Gruppe — je Quellsystem eins; nach dem ersten Lauf nicht mehr ändern" />
            <span class="muted" :title="`neue Attribute heissen ${cleanPrefix}<key>, Gruppe ${importGroup}`">→ {{ cleanPrefix }}‹key› · ▤ {{ importGroup }}</span>
          </td></tr>
        </tbody>
      </table>

      <div class="section" v-if="plan">
        <h2>Eigenschaften → Attribute</h2>
        <table class="grid">
          <thead><tr><th>IXP</th><th class="num">#</th><th title="Typ laut Quelle (property-Dokument), Klasse des Produkts">Quelle</th><th>Attribut</th><th title="Gruppe für ein neues Attribut — Vorschlag: Klasse des Produkts im Quellsystem">Gruppe</th></tr></thead>
          <tbody>
            <tr v-for="[k, p] in Object.entries(plan.props)" :key="k">
              <td class="mono">{{ k }} <span v-if="p.html" class="muted" title="enthält HTML">‹›</span></td>
              <td class="num">{{ p.count }}</td>
              <td class="muted mono" :title="(p.def ? `${p.def.type}${p.def.ez ? ' / ' + p.def.ez : ''}` : 'keine Definition in der Quelle') + (p.classes.length ? ' · Klassen: ' + p.classes.join(', ') : '')">{{ p.def ? p.def.type : '?' }}<span v-if="p.def?.ez === 'ezselection'"> ☰{{ p.values.length }}</span><span v-if="p.classes.length"> · {{ p.classes[0] }}{{ p.classes.length > 1 ? ' +' + (p.classes.length - 1) : '' }}</span></td>
              <td>
                <select v-model="mapping[k]">
                  <option value="">— überspringen —</option>
                  <option v-for="a in model.attributes" :key="a.key" :value="a.key">{{ a.label?.de || a.key }} ({{ a.type }})</option>
                  <option v-for="t in typeOptions" :key="t" :value="'new:' + t">neu anlegen: {{ t }}{{ t === p.srcType ? ' ← Quelle' : '' }}</option>
                </select>
              </td>
              <td>
                <template v-if="mapping[k]?.startsWith('new:')">
                  <input v-model="groupOf[k]" type="text" list="import-groups" style="width:180px" :title="'Gruppe des neuen Attributs; Vorschlag aus der Klasse ' + (p.classes[0] ?? '—')" />
                </template>
                <span v-else class="muted">{{ model.attributes.find(a => a.key === mapping[k])?.group ?? '' }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <datalist id="import-groups"><option v-for="g in groupOptions" :key="g" :value="g" /></datalist>
        <p class="muted" v-if="newAttrs.length">Neu im Modell: {{ newAttrs.length }} Attribute<span v-if="newGroups.length">, {{ newGroups.length }} Gruppen ({{ newGroups.join(', ') }})</span><span v-if="newAttrs.some(a => a.list)">, {{ newAttrs.filter(a => a.list).length }} Wertelisten</span>.</p>
      </div>
    </div>
  </div>

  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>4 · Ziel & Plan</h1><span class="grow" /><button class="primary" @click="run" :disabled="!plan || !!busy">Schreiben</button></div>
    <div class="scroll">
      <table class="grid form-grid"><colgroup><col style="width:84px" /><col /></colgroup>
        <tbody>
          <tr><td class="muted">Ziel ▣</td><td>
            <select v-model="target" @change="persist"><option value="">— Wurzel —</option><option v-for="g in groups" :key="g.id" :value="g.id">{{ g.label }}</option></select>
            <span class="muted">neue Gruppen und Produkte hängen hier unter; im Quellbaum tiefere unter ihre importierten Eltern</span>
          </td></tr>
          <tr><td class="muted">Sprachen 🗣</td><td>
            <template v-if="languages.length">
              <span v-for="l in languages" :key="l.code" class="view-chip" :class="{ on: selectedLocales.includes(l.code), off: !modelLocales.includes(l.code) }" :title="modelLocales.includes(l.code) ? l.languageName : l.languageName + ' — nicht im Modell'" @click="modelLocales.includes(l.code) && toggleLocale(l.code)">{{ l.code }}</span>
            </template>
            <span v-else class="muted">nach Verbinden</span>
            <span v-if="languages.length" class="muted" :title="`Quelle: ${languages.length} Sprachen, Modell: ${modelLocales.length} — weitere unter ⊞ Modell → Sprachen anlegen, dann sind sie hier wählbar`"> importieren · nur Sprachen des Modells ({{ modelLocales.length }})</span>
          </td></tr>
        </tbody>
      </table>
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
.form-grid { width: 100%; }
.form-grid td { white-space: normal; vertical-align: middle; height: 30px; padding: 2px 4px; }
.form-grid td:first-child { padding-left: 8px; white-space: nowrap; }
.form-grid select { margin-right: 8px; min-width: 220px; }
.view-chip.off { opacity: .4; cursor: default; }
.section { padding: 10px 8px; border-top: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600; }
</style>
