<script setup>
// ⇩ Import aus einem Solr-Kern (infolox/prodexa-Export): links der Quellbaum,
// Knoten für Knoten beim Aufklappen nachgeladen (Haken = Teilbaum); in der Mitte
// der gewählte Knoten mit allem, was er hat; rechts der Plan und der Stapel.
// Solr lesen geht per JSONP im Browser; geschrieben wird nur über /api/model und /api/batch.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { tree, icon } from '../tree.js'
import { solr, SYSTEM, roleOf, ownValues, valueCommands, modelNeeds, DEFAULT_SKIP, TYPES } from '../solr.js'
import { recent, remember } from '../recent.js'

const saved = JSON.parse(localStorage.getItem('journali.import.solr') || '{}')
const base = ref(saved.base || 'https://solr-admin.144-bytec.preview.infolox.tools/solr/products')
const target = ref(saved.target || '')
const skipText = ref(saved.skip || '')
const recentBases = ref(recent('solr'))
const persist = () => localStorage.setItem('journali.import.solr', JSON.stringify({ base: base.value, target: target.value, skip: skipText.value, auto: connected.value }))

let client = null
const connected = ref(false)
const total = ref(0)
const pdefs = ref({})
const rows = ref([])            // Quellbaum flach: { doc, depth, parent, loaded, kids }
const expanded = ref(new Set())
const checked = ref(new Set())
const current = ref(null)       // angeklickter Knoten (Dokument)
const busy = ref('')
const log = ref([])
const plan = ref(null)
const result = ref(null)

const model = computed(() => store.model)
const groups = computed(() => tree.rows.filter(r => r.role === 'group'))
const attrs = computed(() => new Map((model.value?.attributes ?? []).map(a => [a.key, a])))
const modelGroups = computed(() => new Map((model.value?.groups ?? []).map(g => [g.key, g])))
const skip = computed(() => [...DEFAULT_SKIP, ...skipText.value.split(/[,\s]+/).filter(Boolean)])
const known = computed(() => new Map(tree.rows.filter(r => r.external?.[SYSTEM]).map(r => [r.external[SYSTEM], r])))

onMounted(() => { if (!tree.loaded) tree.load(); if (saved.base && saved.auto) connect() })
function say(text) { log.value.unshift(`${new Date().toLocaleTimeString('de-DE')} ${text}`); if (log.value.length > 200) log.value.pop() }

async function connect() {
  busy.value = 'verbinde …'
  try {
    client = solr(base.value)
    total.value = await client.count()
    const roots = await client.roots()
    rows.value = roots.map(d => ({ doc: d, depth: 0, parent: null, loaded: false, kids: null }))
    expanded.value = new Set(); checked.value = new Set(); plan.value = null; result.value = null; current.value = null
    connected.value = true
    persist(); recentBases.value = remember('solr', base.value)
    busy.value = 'lade Attribut-Definitionen …'
    pdefs.value = await client.propertyDefs()
    say(`verbunden: ${total.value} Dokumente, ${roots.length} Wurzeln, ${Object.keys(pdefs.value).length} Attribut-Definitionen`)
    for (const r of [...rows.value]) await expand(r)
  } catch (e) { store.toast(e.message); say('Fehler: ' + e.message); connected.value = false }
  finally { busy.value = '' }
}

// ---- Baum: Kinder erst beim Aufklappen; wie im eigenen Baum erst Gruppen, dann Produkte, dann Varianten
const ORDER = { group: 0, product: 1, variant: 2 }
const byRole = list => list.sort((a, b) => ORDER[roleOf(a)] - ORDER[roleOf(b)] || (a.sort_nr ?? 0) - (b.sort_nr ?? 0) || (a.name ?? '').localeCompare(b.name ?? '', 'de'))
async function expand(row) {
  if (!row.loaded) {
    row.loaded = true
    busy.value = 'lade …'
    try {
      const kids = byRole(await client.children(row.doc.id))
      row.kids = kids.length
      const i = rows.value.indexOf(row)
      rows.value.splice(i + 1, 0, ...kids.map(d => ({ doc: d, depth: row.depth + 1, parent: row, loaded: false, kids: d.hasChilds ? null : 0 })))
    } catch (e) { row.loaded = false; store.toast(e.message); return }
    finally { busy.value = '' }
  }
  expanded.value.add(row.doc.id)
}
function collapse(row) { expanded.value.delete(row.doc.id) }
async function toggle(row) { expanded.value.has(row.doc.id) ? collapse(row) : await expand(row) }
const visible = computed(() => rows.value.filter(r => { for (let p = r.parent; p; p = p.parent) if (!expanded.value.has(p.doc.id)) return false; return true }))
function check(row) { checked.value.has(row.doc.id) ? checked.value.delete(row.doc.id) : checked.value.add(row.doc.id) }
function checkedAbove(row) { for (let p = row.parent; p; p = p.parent) if (checked.value.has(p.doc.id)) return true; return false }
async function show(row) {
  current.value = row.doc
  if (row.doc.hasChilds !== false && !row.loaded && roleOf(row.doc) !== 'variant') await expand(row)
}
function onKey(e, row) {
  const i = visible.value.indexOf(row)
  if (e.key === 'ArrowDown') { e.preventDefault(); const n = visible.value[i + 1]; if (n) { show(n); focusRow(n) } }
  else if (e.key === 'ArrowUp') { e.preventDefault(); const n = visible.value[i - 1]; if (n) { show(n); focusRow(n) } }
  else if (e.key === 'ArrowRight') { e.preventDefault(); expand(row) }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); if (expanded.value.has(row.doc.id)) collapse(row); else if (row.parent) { show(row.parent); focusRow(row.parent) } }
  else if (e.key === ' ') { e.preventDefault(); if (!checkedAbove(row)) check(row) }
}
function focusRow(row) { requestAnimationFrame(() => document.querySelector(`[data-id="${CSS.escape(row.doc.id)}"]`)?.focus()) }

// ---- Der gewählte Knoten: was er hat, in Zeilen
const currentValues = computed(() => {
  const d = current.value
  if (!d) return []
  const out = []
  if (d.name) out.push({ key: 'name', type: 'text', value: d.name, attr: 'name' })
  if (d.description) out.push({ key: 'description', type: 'html', value: d.description, attr: 'description' })
  if (d.product_number) out.push({ key: 'product_number', type: 'text', value: d.product_number, attr: 'sku' })
  for (const v of ownValues(d, skip.value)) {
    const p = pdefs.value[v.raw]
    out.push({ key: v.raw, label: p?.name, section: p?.section, type: TYPES[v.suffix][0] + (TYPES[v.suffix][1] ? ' ≣' : ''), value: Array.isArray(v.value) ? v.value.join(', ') : String(v.value), attr: v.key })
  }
  return out
})
// Was am Knoten steht, aber nicht mitkommt (Relationen, Medien, übergangene Schlüssel).
const currentSkipped = computed(() => {
  if (!current.value) return []
  const taken = new Set(ownValues(current.value, skip.value).map(v => v.raw))
  return Object.keys(current.value).filter(k => k.startsWith('property__')).map(k => k.slice(10).replace(/__\w+$/, '')).filter(k => !taken.has(k))
})

// ---- Analysieren: angehakte Teilbäume vollständig laden, Modellbedarf und Stapel berechnen
async function analyse() {
  if (!checked.value.size) { store.toast('Nichts angehakt'); return }
  busy.value = 'lade …'; plan.value = null; result.value = null
  try {
    const picked = rows.value.filter(r => checked.value.has(r.doc.id) && !checkedAbove(r))
    const items = []   // { doc, parentRef (Solr-Id des Elternknotens oder null), role }
    const docsById = new Map()
    for (const r of picked) {
      const docs = await client.subtree(r.doc.id, (n, of) => { busy.value = `lade … ${n}/${of}` })
      for (const d of docs) docsById.set(d.id, d)
      const kids = new Map()
      for (const d of docs) { const k = d.main_parent_id || ''; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(d) }
      for (const l of kids.values()) byRole(l)
      const rootParent = r.parent?.doc.id ?? null
      const walk = (d, parentId, top) => {
        const role = roleOf(d)
        items.push({ doc: d, parentId, role, top })
        const below = kids.get(d.id) ?? []
        const direct = []
        for (const k of below) {
          if (roleOf(k) === 'variant' && role === 'group') direct.push(k)
          else walk(k, d.id, false)
        }
        if (direct.length) {
          // Varianten direkt unter einer Gruppe: Sammelprodukt mit dem Namen der Gruppe, Kennung <gruppe>#variants.
          const pseudo = { id: d.id + '#variants', master_id: d.master_id + '#variants', type: 'product', name: d.name || d.master_id, lang: d.lang, main_parent_id: d.id, pseudo: true }
          items.push({ doc: pseudo, parentId: d.id, role: 'product', top: false })
          for (const k of direct) items.push({ doc: k, parentId: pseudo.id, role: 'variant', top: false })
        }
      }
      walk(r.doc, rootParent, true)
    }
    for (const it of items) it.existing = known.value.get(it.doc.master_id) ?? null
    const needs = modelNeeds(items.map(i => i.doc), attrs.value, modelGroups.value, pdefs.value, skip.value)
    plan.value = { items, needs, picked: picked.length }
    say(`analysiert: ${items.length} Knoten (${items.filter(i => i.existing).length} vorhanden), ${needs.newAttrs.size} neue Attribute in ${needs.newGroups.size} neuen Gruppen`)
  } catch (e) { store.toast(e.message); say('Fehler: ' + e.message) }
  finally { busy.value = '' }
}
const counts = computed(() => {
  const c = { group: [0, 0], product: [0, 0], variant: [0, 0] }
  for (const it of plan.value?.items ?? []) c[it.role][it.existing ? 1 : 0]++
  return c
})

// ---- Schreiben: Modell, dann Wurzel + Gruppen, dann je Produkt ein Stapel (unter der Obergrenze)
async function run() {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  if (!plan.value) return
  busy.value = 'schreibe …'; result.value = null
  let written = 0, batches = 0
  try {
    const { items, needs } = plan.value
    for (const [k, g] of needs.newGroups) { await api.post(`/api/model/groups/${k}`, { key: k, label: { de: g.label, en: g.label }, activeFrom: g.activeFrom }, 'PUT'); say(`Attributgruppe ${k} (${g.label})${g.activeFrom ? ' ab ' + g.activeFrom : ''} angelegt`) }
    for (const [k, from] of needs.raise) { const g = modelGroups.value.get(k); await api.post(`/api/model/groups/${k}`, { key: k, label: g.label ?? {}, activeFrom: from }, 'PUT'); say(`Attributgruppe ${k}: aktiv ab ${from ?? 'überall'} (Werte kommen weiter oben vor)`) }
    for (const [k, d] of needs.newAttrs) { await api.post(`/api/model/attributes/${k}`, d, 'PUT'); }
    if (needs.newAttrs.size) say(`${needs.newAttrs.size} Attribute angelegt`)
    await store.poll(true)
    const attrMap = new Map((store.model?.attributes ?? []).map(a => [a.key, a]))

    const refOf = new Map()   // Solr-Id → '@ref' oder journali-Id
    const own = async id => { const n = await api.get(`/api/nodes/${id}`); return new Map(n.values.filter(v => !v.row).map(v => [`${v.attribute}|${v.locale ?? ''}`, v.values ?? v.value])) }
    let refNo = 0
    const emit = async (it, cmds) => {
      let node
      if (it.existing) {
        node = it.existing.id
        cmds.push(...valueCommands(it.doc, node, attrMap, await own(node), skip.value))
      } else {
        const ref = 'n' + (++refNo)
        const parent = it.parentId != null && refOf.has(it.parentId) ? refOf.get(it.parentId) : (target.value || null)
        if (it.role === 'group') cmds.push({ op: 'group.create', ref, args: { parent, name: it.doc.name || it.doc.remote_id || it.doc.master_id } })
        else if (it.role === 'product') { if (!parent) throw new Error(`Produkt ${it.doc.name}: keine Zielgruppe`); cmds.push({ op: 'product.create', ref, args: { group: parent } }) }
        else { if (!parent) throw new Error(`Variante ${it.doc.name}: kein Produkt darüber`); cmds.push({ op: 'variant.create', ref, args: { product: parent, axisValues: {} } }) }
        node = '@' + ref
        cmds.push({ op: 'external.link', args: { node, system: SYSTEM, id: it.doc.master_id } })
        if (it.top) {
          // Die importierte Wurzel trägt die Gruppen, die der Teilbaum braucht, und das ★ auf name.
          cmds.push({ op: 'groups.attach', args: { node, groups: needs.used } })
          if (it.role !== 'variant') cmds.push({ op: 'label.set', args: { node, attribute: 'name' } })
        }
        cmds.push(...valueCommands(it.doc, node, attrMap, new Map(), skip.value))
      }
      if (it.top && it.existing) {
        const have = (it.existing.groups ?? '').split(',').filter(Boolean)
        const merged = [...new Set([...have, ...needs.used])].sort()
        if (merged.length !== have.length) cmds.push({ op: 'groups.attach', args: { node, groups: merged } })
      }
      refOf.set(it.doc.id, node)
    }
    const send = async cmds => {
      if (!cmds.length) return
      const res = await api.post('/api/batch', { commands: cmds })
      written += res.results.length; batches++
      if (res.error) throw new Error(`Stapel ${res.batch} hielt an bei #${res.error.index} ${res.error.op}: ${res.error.message}`)
      // Nach dem Stapel sind die Verweise echte Knoten — für die nächsten Stapel auflösen.
      for (const r of res.results) if (r.ref) for (const [k, v] of refOf) if (v === '@' + r.ref) refOf.set(k, r.node)
    }
    // Erst alle Gruppen (ein Stapel), dann je Produkt mit seinen Varianten ein Stapel.
    const cmds = []
    for (const it of items) if (it.role === 'group') await emit(it, cmds)
    await send(cmds)
    const products = items.filter(i => i.role === 'product')
    let n = 0
    for (const p of products) {
      busy.value = `schreibe … ${++n}/${products.length}`
      const pc = []
      await emit(p, pc)
      for (const v of items) if (v.role === 'variant' && v.parentId === p.doc.id) await emit(v, pc)
      await send(pc)
    }
    for (const v of items) if (v.role === 'variant' && !products.some(p => p.doc.id === v.parentId)) { const vc = []; await emit(v, vc); await send(vc) }
    result.value = { written, batches, error: null }
    say(written ? `fertig: ${written} Einträge in ${batches} Stapeln` : 'nichts zu schreiben — alles schon so')
    await store.poll(true); await tree.load()
    plan.value = null
  } catch (e) {
    result.value = { written, batches, error: e.message }
    store.toast(e.message); say('Fehler: ' + e.message)
  } finally { busy.value = '' }
}
</script>

<template>
  <div class="pane" style="width:340px;flex:none">
    <div class="toolbar"><h1>⇩ Quelle: Solr</h1><span class="grow" /><span v-if="busy" class="muted">{{ busy }}</span></div>
    <div class="toolbar sources">
      <router-link to="/import" class="view-chip">IXP</router-link>
      <router-link to="/import/solr" class="view-chip on">Solr</router-link>
      <span class="grow" /><span v-if="connected" class="muted" :title="base">☰ {{ total }}</span>
    </div>
    <div class="form">
      <div class="row">
        <input v-model="base" type="text" list="solr-recent" placeholder="https://…/solr/<kern>" title="URL des Solr-Kerns — Pfeil ab: zuletzt benutzte" style="flex:1" @keydown.enter="connect" />
        <datalist id="solr-recent"><option v-for="u in recentBases" :key="u" :value="u" /></datalist>
        <button class="primary" @click="connect" :disabled="!!busy">Verbinden</button>
      </div>
    </div>
    <div class="scroll src">
      <div v-for="r in visible" :key="r.doc.id" class="node" :class="[roleOf(r.doc), { on: checked.has(r.doc.id) || checkedAbove(r), current: current?.id === r.doc.id }]"
        :style="`padding-left:${6 + r.depth * 14}px`" :title="r.doc.master_id" tabindex="0" :data-id="r.doc.id" @click="show(r)" @keydown="onKey($event, r)">
        <span class="twisty" @click.stop="toggle(r)">{{ roleOf(r.doc) === 'variant' || r.kids === 0 ? '' : (expanded.has(r.doc.id) ? '▾' : '▸') }}</span>
        <input type="checkbox" :checked="checked.has(r.doc.id) || checkedAbove(r)" :disabled="checkedAbove(r)" @click.stop @change="check(r)" title="Teilbaum importieren" />
        <span class="icon">{{ icon(roleOf(r.doc)) }}</span>
        <span class="label">{{ r.doc.name || r.doc.remote_id || r.doc.master_id }}</span>
        <span v-if="known.has(r.doc.master_id)" class="pos" title="schon in journali">✓</span>
        <span v-if="r.kids" class="muted count">{{ r.kids }}</span>
      </div>
      <div v-if="!connected" class="empty">Verbinden — Solr liest sich ohne Anmeldung.</div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px"><kbd>↑</kbd><kbd>↓</kbd> · <kbd>→</kbd><kbd>←</kbd> · <kbd>Leer</kbd> Haken · {{ checked.size }} gewählt</div>
  </div>

  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>{{ current ? icon(roleOf(current)) + ' ' + (current.name || current.master_id) : 'Knoten' }}</h1><span class="grow" /><span v-if="current" class="mono muted">{{ current.master_id }}</span></div>
    <div class="scroll">
      <div v-if="!current" class="empty">Knoten links anklicken — hier steht, was er hat und was davon nach journali geht.</div>
      <template v-else>
        <div class="toolbar meta muted">
          <span v-if="current.product_number">SKU {{ current.product_number }}</span>
          <span v-if="current.main_level != null">· Ebene {{ current.main_level }}</span>
          <span v-if="current.info__changedOn__dateTime">· geändert {{ current.info__changedOn__dateTime.slice(0, 10) }}</span>
          <span v-if="known.has(current.master_id)">· <router-link :to="`/tree/${known.get(current.master_id).id}`" class="pos">✓ in journali →</router-link></span>
        </div>
        <table class="grid">
          <thead><tr><th>Solr</th><th>Typ</th><th>→ Attribut</th><th>Wert</th></tr></thead>
          <tbody>
            <tr v-for="v in currentValues" :key="v.key">
              <td class="mono" :title="v.section ? `${v.label ?? ''} · ${v.section}` : ''">{{ v.key }}</td>
              <td class="muted">{{ v.type }}</td>
              <td :class="attrs.has(v.attr) ? '' : 'warn'" :title="attrs.has(v.attr) ? 'Attribut vorhanden' : 'wird angelegt' + (v.section ? ' in ' + v.section : '')">{{ v.attr }}<span v-if="!attrs.has(v.attr)" class="muted"> +</span></td>
              <td class="val" :title="v.value">{{ v.value.replace(/<[^>]+>/g, ' ').slice(0, 160) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="currentSkipped.length" class="muted" style="padding:0 8px;font-size:12px">übergangen: {{ currentSkipped.join(', ') }}</p>
      </template>
    </div>
  </div>

  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>Plan</h1><span class="grow" /><button class="primary" @click="analyse" :disabled="!connected || !checked.size || !!busy">Analysieren</button><button class="primary" @click="run" :disabled="!plan || !!busy">Schreiben</button></div>
    <div class="scroll">
      <table class="grid form-grid">
        <tbody>
          <tr><td class="muted">Ziel ▣</td><td>
            <select v-model="target" @change="persist"><option value="">— Wurzel —</option><option v-for="g in groups" :key="g.id" :value="g.id">{{ g.label }}</option></select>
            <span class="muted">angehakte Wurzeln kommen hier unter; tiefere unter ihre importierten Eltern</span>
          </td></tr>
          <tr><td class="muted">Übergehen</td><td>
            <input v-model="skipText" type="text" placeholder="weitere Schlüssel, Muster mit *" style="width:260px" @change="persist" />
            <span class="muted">immer: {{ DEFAULT_SKIP.join(', ') }}, Relationen, Medien</span>
          </td></tr>
        </tbody>
      </table>
      <template v-if="plan">
        <table class="grid" style="width:auto">
          <thead><tr><th></th><th class="num pos">neu</th><th class="num">vorhanden</th></tr></thead>
          <tbody>
            <tr v-for="r in ['group', 'product', 'variant']" :key="r"><td>{{ icon(r) }} {{ r }}</td><td class="num pos">{{ counts[r][0] }}</td><td class="num">{{ counts[r][1] }}</td></tr>
          </tbody>
        </table>
        <div class="section" v-if="plan.needs.newAttrs.size || plan.needs.newGroups.size">
          <h2>Neu im Modell: ▤ {{ plan.needs.newGroups.size }} · ⊞ {{ plan.needs.newAttrs.size }}<span v-if="plan.needs.raise.size" class="warn"> · {{ plan.needs.raise.size }} Gruppen „aktiv ab“ anheben: {{ [...plan.needs.raise].map(([k, r]) => `${k} → ${r ?? 'überall'}`).join(', ') }}</span></h2>
          <table class="grid">
            <thead><tr><th>Attribut</th><th>Typ</th><th>▤ Gruppe</th><th class="num">#</th></tr></thead>
            <tbody>
              <tr v-for="[k, d] in plan.needs.newAttrs" :key="k">
                <td :title="k">{{ d.label.de }} <span class="mono muted">{{ k }}</span></td>
                <td class="muted">{{ d.type }}{{ d.multiple ? ' ≣' : '' }}{{ d.axes ? ' 🗣' : '' }}</td>
                <td :class="{ pos: plan.needs.newGroups.has(d.group) }" :title="plan.needs.newGroups.get(d.group)?.label">{{ d.group }}<span v-if="plan.needs.newGroups.get(d.group)?.activeFrom" class="muted"> · ab {{ icon(plan.needs.newGroups.get(d.group).activeFrom) }}</span></td>
                <td class="num">{{ plan.needs.counts.get(k) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="section">
          <h2>Knoten</h2>
          <table class="grid">
            <tbody>
              <tr v-for="it in plan.items" :key="it.doc.id">
                <td :title="it.doc.master_id">{{ icon(it.role) }} {{ it.doc.name || it.doc.master_id }}<span v-if="it.doc.pseudo" class="muted"> · Sammelprodukt</span></td>
                <td><router-link v-if="it.existing" :to="`/tree/${it.existing.id}`" class="muted">vorhanden →</router-link><span v-else class="pos">neu</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
      <div v-if="result" class="section">
        <h2>Ergebnis</h2>
        <div v-if="result.error" class="neg">{{ result.error }} — {{ result.written }} Einträge in {{ result.batches }} Stapeln davor geschrieben.</div>
        <div v-else-if="result.written" class="pos">{{ result.written }} Einträge in {{ result.batches }} Stapeln → <router-link to="/journal">Journal</router-link></div>
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
.sources { gap: 4px; }
.form { padding: 6px 8px; border-bottom: 1px solid var(--line); display: flex; flex-direction: column; gap: 4px; }
.row { display: flex; gap: 4px; }
.src .node { display: flex; align-items: center; gap: 4px; height: 24px; white-space: nowrap; padding-right: 8px; outline: none; }
.src .node.on { background: var(--accent-soft); }
.src .node.current, .src .node:focus { box-shadow: inset 2px 0 0 var(--accent); }
.twisty { width: 12px; color: var(--muted); font-size: 11px; cursor: pointer; }
.icon { width: 16px; text-align: center; }
.node.group .icon { color: var(--muted); }
.node.product .icon { color: var(--accent); }
.node.variant .icon { color: var(--warn); }
.label { overflow: hidden; text-overflow: ellipsis; }
.count { margin-left: auto; font-size: 11px; }
.form-grid td { white-space: normal; vertical-align: middle; height: 34px; }
.form-grid select { margin-right: 8px; }
.val { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.section { padding: 10px 8px; border-top: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600; }
</style>
