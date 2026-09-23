<script setup>
// ⇩ Import aus einem Solr-Kern (infolox/prodexa-Export): links der Quellbaum,
// Knoten für Knoten beim Aufklappen nachgeladen (Haken = Teilbaum); in der Mitte
// der gewählte Knoten mit allem, was er hat; rechts der Plan und der Stapel.
// Solr lesen geht per JSONP im Browser; geschrieben wird nur über /api/model und /api/batch.
import { ref, computed, onMounted } from 'vue'
import { api, store, tree, icon, plugins, Splitter, ImportHead, TreePicker, paneWidth } from 'journali'
import { useRouter } from 'vue-router'
import { solr, SYSTEM, roleOf, ownValues, DEFAULT_SKIP, TYPES, REL_GROUP } from '../solr.js'
import { plane, schreibe, planeRelationen, schreibeRelationen } from '../lauf.mjs'
const srcW = paneWidth('import.src', 340)
const router = useRouter()

const saved = JSON.parse(localStorage.getItem('journali.import.solr') || '{}')
const base = ref(saved.base || '')   // keine Vorgabe — das Plugin ist allgemein, Kundendaten gehören nicht ins Repo (Taloan, 17.09.)
const target = ref(saved.target || '')
const skipText = ref(saved.skip || '')
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
const relPlan = ref(null)       // Plan für die Relationen der angehakten Teilbäume
const relResult = ref(null)

const model = computed(() => store.model)
const groups = computed(() => tree.rows.filter(r => r.role === 'group'))
const attrs = computed(() => new Map((model.value?.attributes ?? []).map(a => [a.key, a])))
const modelGroups = computed(() => new Map((model.value?.groups ?? []).map(g => [g.key, g])))
const skip = computed(() => [...DEFAULT_SKIP, ...skipText.value.split(/[,\s]+/).filter(Boolean)])
const known = computed(() => new Map(tree.rows.filter(r => r.external?.[SYSTEM]).map(r => [r.external[SYSTEM], r])))

onMounted(() => { if (!tree.loaded) tree.load(); if (saved.base && saved.auto) connect() })
function say(text) { log.value.unshift(`${new Date().toLocaleTimeString('de-DE')} ${text}`); if (log.value.length > 200) log.value.pop() }

// Was der Ablauf (lauf.mjs) von der Umgebung braucht — im Job kommt dasselbe aus der API
const umgebung = {
  api,
  sag: t => { busy.value = t; say(t) },
  get modell() { return store.model },
  get baum() { return tree.rows },
  frisch: async () => { await store.poll(true); await tree.load() },
}

// Profile (ProfileBar): Quelle, Ziel, Auslassungen und die angehakten Wurzeln — im Journal unter plugin:solr
// root: die angehakten Wurzeln mit Komma — so heisst der Parameter des Jobs; der JobRunner füllt ihn aus dem Profil (Taloan, 21.09.: alles im Profil)
const profileGet = () => ({ base: base.value, target: target.value, skip: skipText.value, checked: [...checked.value], root: [...checked.value].join(',') })
async function profileSet(p) {
  if (!p) {   // „— Profil —“: alles leer, Quelle zu
    base.value = ''; target.value = ''; skipText.value = ''; connected.value = false; rows.value = []; checked.value = new Set(); plan.value = null; result.value = null; current.value = null; persist(); return
  }
  base.value = p.base ?? ''; target.value = p.target ?? ''; skipText.value = p.skip ?? ''
  if (!base.value) return
  await connect()
  for (const id of p.checked ?? []) { await reveal(id); checked.value.add(id) }
  checked.value = new Set(checked.value)
}
// Zeile mit dieser Kennung sichtbar machen: Ebene für Ebene aufklappen, bis sie da ist (höchstens 60 Nachladungen)
async function reveal(id) {
  let n = 0
  while (!rows.value.some(r => r.doc.id === id) && n < 60) {
    const next = rows.value.find(r => !r.loaded && r.doc.hasChilds !== false && roleOf(r.doc) !== 'variant')
    if (!next) return
    await expand(next); n++
  }
}
async function connect() {
  busy.value = 'verbinde …'
  try {
    client = solr(base.value)
    total.value = await client.count()
    const roots = await client.roots()
    rows.value = roots.map(d => ({ doc: d, depth: 0, parent: null, loaded: false, kids: null }))
    expanded.value = new Set(); checked.value = new Set(); plan.value = null; result.value = null; current.value = null
    connected.value = true
    persist()
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
/// Die angehakten Teilbäume — ohne die, die schon unter einem anderen Haken liegen
function gewaehlt() {
  const picked = rows.value.filter(r => checked.value.has(r.doc.id) && !checkedAbove(r))
  return { wurzeln: picked.map(r => r.doc.id), eltern: new Map(picked.map(r => [r.doc.id, r.parent?.doc.id ?? null])), anzahl: picked.length }
}

async function analyse() {
  if (!checked.value.size) { store.toast('Nichts angehakt'); return }
  busy.value = 'lade …'; plan.value = null; result.value = null
  try {
    const { wurzeln, eltern, anzahl } = gewaehlt()
    const p = await plane({ client, umgebung, wurzeln, eltern, skip: skip.value, pdefs: pdefs.value })
    plan.value = { ...p, picked: anzahl }
  } catch (e) { store.toast(e.message); say('Fehler: ' + e.message) }
  finally { busy.value = '' }
}
const counts = computed(() => {
  const c = { group: [0, 0], product: [0, 0], variant: [0, 0] }
  for (const it of plan.value?.items ?? []) c[it.role][it.existing ? 1 : 0]++
  return c
})

// ---- Relationen (18): zweiter Lauf nach den Knoten — Kanten aus *_doc_rel und den complex_relation-Dokumenten
async function analyseRelations() {
  if (!checked.value.size) { store.toast('Nichts angehakt'); return }
  busy.value = 'lade …'; relPlan.value = null; relResult.value = null
  try {
    relPlan.value = await planeRelationen({ client, umgebung, wurzeln: gewaehlt().wurzeln })
  } catch (e) { store.toast(e.message); say('Fehler: ' + e.message) }
  finally { busy.value = '' }
}
async function runRelations() {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  if (!relPlan.value) return
  busy.value = 'schreibe …'; relResult.value = null
  let written = 0, batches = 0
  try {
    const r = await schreibeRelationen({ plan: relPlan.value, umgebung })
    written = r.geschrieben; batches = r.stapel
    relResult.value = { written, batches, error: null }
    await store.poll(true)
    relPlan.value = null
  } catch (e) { relResult.value = { written, batches, error: e.message }; store.toast(e.message); say('Fehler: ' + e.message) }
  finally { busy.value = '' }
}

// ---- Schreiben: Modell, dann Wurzel + Gruppen, dann je Produkt ein Stapel (unter der Obergrenze)
/// Der Lauf geht an den Tasker: dort läuft er weiter, auch wenn dieses Fenster zugeht (Taloan, 23.09.2026).
const JOB = 'solr_import'
async function run() {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  if (!plan.value) return
  busy.value = 'übergebe …'; result.value = null
  try {
    const { wurzeln } = gewaehlt()
    const r = await api.post(`/api/jobs/${JOB}/uebergabe`, {
      label: `Import (Solr) · ${wurzeln.length} Wurzel${wurzeln.length === 1 ? '' : 'n'}`,
      service: 'solr',
      params: {
        base: base.value,
        roots: wurzeln.join(','),
        target: target.value || '',
        skip: skipText.value || '',
        relations: 'false',
        dry_run: 'false',
      },
    })
    result.value = { job: r.job, run: r.run, error: null }
    say(`an den Tasker übergeben · Lauf ${r.run}`)
    store.toast('▶ An den Tasker übergeben', 'ok', { label: '⏱ Jobs', title: 'Fortschritt, Abbrechen und das Protokoll', run: () => router.push('/p/tasker/jobs') })
    plan.value = null
  } catch (e) {
    result.value = { error: e.message }
    store.toast(e.message); say('Fehler: ' + e.message)
  } finally { busy.value = '' }
}
</script>

<template>
  <div class="pane" :style="`width:${srcW}px;flex:none`">
    <ImportHead source="solr" plugin="solr" :busy="busy" :get="profileGet" :set="profileSet">
      <template #status><span v-if="connected" class="muted" :title="base">☰ {{ total }}</span></template>
      <tr><td class="attr">Quelle</td><td class="row">
        <input v-model="base" type="text" placeholder="https://…/solr/<kern>" title="URL des Solr-Kerns" @keydown.enter="connect" />
        <button class="primary" @click="connect" :disabled="!!busy">Verbinden</button>
      </td></tr>
    </ImportHead>
    <div class="step-band">2 · Auswahl <span class="muted">· Haken = Teilbaum, Klick zeigt den Knoten</span><span class="grow" /><span class="muted">{{ checked.size }} gewählt</span></div>
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
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px"><kbd>↑</kbd><kbd>↓</kbd> · <kbd>→</kbd><kbd>←</kbd> · <kbd>Leer</kbd> Haken · Klick zeigt den Knoten · {{ checked.size }} gewählt</div>
  </div>

  <Splitter v-model="srcW" :min="240" :max="800" />
  <!-- Der angeklickte Knoten: nur dann, sonst gehört der Platz dem Plan (Taloan, 17.09.) -->
  <div class="pane" style="flex:1" v-if="current">
    <div class="toolbar"><h1>{{ icon(roleOf(current)) + ' ' + (current.name || current.master_id) }}</h1><span class="mono muted">{{ current.master_id }}</span><span class="grow" /><button class="x" @click="current = null" title="zuklappen">×</button></div>
    <div class="scroll">
        <!-- kein nacktes <template> hier: Vue 3 rendert es als echtes <template>-Element, dessen Inhalt unsichtbar ist (Taloan, 17.09.: „mittlere Spalte leer“) -->
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
    </div>
  </div>

  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>3 · Plan</h1><span class="grow" /><button class="primary" @click="analyse" :disabled="!connected || !checked.size || !!busy">Analysieren</button><button class="primary" @click="run" :disabled="!plan || !!busy">Schreiben</button></div>
    <div class="scroll">
      <table class="grid form-grid"><colgroup><col style="width:84px" /><col /></colgroup>
        <tbody>
          <tr><td class="muted">Ziel ▣</td><td>
            <div class="muted" style="margin-bottom:4px">{{ target ? '▣ ' + (tree.byId.get(target)?.label ?? target) : '⌂ Wurzel' }} · angehakte Wurzeln kommen hier unter; tiefere unter ihre importierten Eltern</div>
            <TreePicker v-model="target" :roles="['group']" allow-root :height="180" @pick="persist" />
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
      <div class="section">
        <h2>⇄ Relationen <span class="muted">· zweiter Lauf, wenn die Knoten drin sind (beide Enden müssen importiert sein)</span></h2>
        <div class="chips">
          <button class="primary" @click="analyseRelations" :disabled="!connected || !checked.size || !!busy">⇄ analysieren</button>
          <button class="primary" @click="runRelations" :disabled="!relPlan || !!busy">⇄ schreiben</button>
          <span v-if="relPlan" class="muted">{{ relPlan.docs }} Knoten mit Kanten · {{ relPlan.cmds }} Befehle<span v-if="relPlan.needs.missingFrom" class="warn"> · {{ relPlan.needs.missingFrom }} Quellen nicht importiert</span></span>
        </div>
        <table v-if="relPlan" class="grid" style="width:auto;margin-top:6px">
          <thead><tr><th>Typ</th><th class="num pos">neu</th><th class="num">vorhanden</th><th class="num warn">geändert</th><th class="num neg">Ziel fehlt</th><th class="num muted">auf sich selbst</th></tr></thead>
          <tbody>
            <tr v-for="[t, s] in relPlan.needs.stats" :key="t"><td>⇄ {{ t }}<span v-if="relPlan.needs.newTypes.has(t)" class="pos"> +</span></td><td class="num pos">{{ s.neu }}</td><td class="num">{{ s.gleich }}</td><td class="num warn">{{ s.geaendert }}</td><td class="num neg">{{ s.zielFehlt }}</td><td class="num muted">{{ s.selbst }}</td></tr>
          </tbody>
        </table>
        <p v-if="relPlan?.needs.newAttrs.size" class="muted" style="font-size:12px">Neu in ▤ {{ REL_GROUP }}: {{ [...relPlan.needs.newAttrs.keys()].join(', ') }}</p>
        <div v-if="relResult" style="margin-top:6px">
          <div v-if="relResult.error" class="neg">{{ relResult.error }} — {{ relResult.written }} Einträge davor geschrieben.</div>
          <div v-else-if="relResult.written" class="pos">{{ relResult.written }} Einträge in {{ relResult.batches }} Stapeln</div>
          <div v-else class="muted">Nichts zu schreiben.</div>
        </div>
      </div>
      <div v-if="result" class="section">
        <h2>Ergebnis</h2>
        <div v-if="result.error" class="neg">{{ result.error }}</div>
        <div v-else-if="result.job" class="pos">an den Tasker übergeben · Lauf <span class="mono">{{ result.run }}</span> → <router-link to="/p/tasker/jobs">⏱ Jobs</router-link></div>
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
.x { border: 0; background: none; color: var(--muted); padding: 0 4px; }
.x:hover { color: var(--neg); }
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
.form-grid { width: 100%; }
.form-grid td { white-space: normal; vertical-align: middle; height: 30px; padding: 2px 4px; }
.form-grid td:first-child { padding-left: 8px; white-space: nowrap; }
.form-grid select { margin-right: 8px; min-width: 220px; }
.val { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.section { padding: 10px 8px; border-top: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; color: var(--muted); font-weight: 600; }
</style>
