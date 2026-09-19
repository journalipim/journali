<script setup>
// ⇩ Import aus der IXP-API: links der Quellbaum (Haken = Teilbaum), in der Mitte
// die Zuordnung (Ziel, Sprachen, Familie, Attribute), rechts Vorschau und der
// Stapel. Alles läuft im Browser; der Server sieht nur /api/batch.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { tree, icon } from '../tree.js'
import { ixp, IXP_DEMO, SYSTEM, ROLE, isNode, attrType, POLICY, POLICY_TEXT, policyOf, analyse as coreAnalyse, planSummary, run as coreRun } from '../ixp.js'
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
const withImages = ref(saved.withImages ?? true)
const policy = ref({ ...POLICY, ...(saved.policy ?? {}) })   // Regeln: was passiert bei was (Taloan) — im Profil, gelten im Browser und im Job   // Bilder der Quelle (doc.image) als Medien holen und per Relation „image“ anhängen (Taloan, 17.09.)
const persist = () => localStorage.setItem('journali.import.ixp', JSON.stringify({ policy: policy.value, base: base.value, token: token.value, lang: lang.value, target: target.value, prefix: prefix.value, importLocales: importLocales.value, withImages: withImages.value }))

let client = null
let pendingRoots = null   // Auswahl aus dem Profil: nach dem Verbinden anhaken
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
const profileGet = () => ({ base: base.value, lang: lang.value, target: target.value, importLocales: importLocales.value, mapping: mapping.value, groupOf: groupOf.value, withImages: withImages.value, prefix: prefix.value, policy: { ...policy.value, media: withImages.value }, roots: [...checked.value] })
async function profileSet(p) {
  if (!p) {   // „— Profil —“: alles leer, Quelle zu
    base.value = ''; token.value = ''; lang.value = 'de'; target.value = ''; importLocales.value = null; withImages.value = true; mapping.value = {}
    connected.value = false; rows.value = []; checked.value = new Set(); plan.value = null; result.value = null; persist(); return
  }
  policy.value = { ...POLICY, ...(p.policy ?? {}) }; if (p.policy?.media != null) withImages.value = !!p.policy.media
  pendingRoots = p.roots ?? null
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
    if (pendingRoots?.length) { checked.value = new Set(rows.value.filter(r => pendingRoots.includes(r.doc.id)).map(r => r.doc.id)); pendingRoots = null }
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
async function analyse() {
  if (!checked.value.size) { store.toast('Nichts angehakt'); return }
  busy.value = 'lade …'
  plan.value = null; result.value = null
  try {
    const picked = rows.value.filter(r => checked.value.has(r.doc.id) && !checkedAbove(r)).map(r => ({ doc: r.doc, parentMaster: r.parent?.doc.masterId ?? null }))
    const p = await coreAnalyse(env(), { ...profileGet(), mapping: mapping.value, groupOf: groupOf.value }, picked)
    mapping.value = p.mapping; groupOf.value = p.groupOf; propDefs.value = p.propDefs
    plan.value = p
  } catch (e) { store.toast(e.message); say('Fehler: ' + e.message) }
  finally { busy.value = '' }
}
// Der Kern (plugins/ixp/core.mjs) sieht nur das: Client, API, Baum, Modell, Meldungen, Fortschritt
const env = () => ({ client, api, tree, model: model.value, say, progress: (done, total, text) => { busy.value = text; if (total) store.progress = { done, total, text } } })

const summary = computed(() => plan.value ? planSummary({ ...plan.value, mapping: mapping.value, groupOf: groupOf.value }, model.value) : { newAttrs: [], newGroups: [], counts: { group: [0, 0], product: [0, 0], variant: [0, 0] } })
const counts = computed(() => summary.value.counts)
const newAttrs = computed(() => summary.value.newAttrs)
const newGroups = computed(() => summary.value.newGroups)
const groupOptions = computed(() => [...new Set([...(model.value?.groups ?? []).map(g => g.key), ...Object.values(groupOf.value)])].sort())
const typeOptions = ['text', 'html', 'integer', 'decimal', 'boolean', 'date', 'enum']

// ---- Schreiben: der Kern legt fehlende Modellteile an, schreibt den Stapel, wendet die Regeln an, holt Medien
async function run() {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  if (!plan.value) return
  busy.value = 'schreibe …'
  result.value = null
  const guard = e => { e.preventDefault(); e.returnValue = '' }; window.addEventListener('beforeunload', guard)
  try {
    const res = await coreRun(env(), { ...profileGet(), mapping: mapping.value, groupOf: groupOf.value }, { ...plan.value, mapping: mapping.value, groupOf: groupOf.value })
    result.value = res
    if (res.errors?.length) store.toast(`⚠ ${res.errors.length} Befehle übersprungen — Protokoll`, 'error')
    if (res.error) store.toast(`✗ abgebrochen: ${res.error.message}`, 'error')
    await store.poll(true); await tree.load()
    if (!res.dryRun) plan.value = null
  } catch (e) { store.toast(e.message); say('Fehler: ' + e.message) }
  finally { window.removeEventListener('beforeunload', guard); store.progress = null; busy.value = '' }
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
          <!-- Regeln (Taloan, 19.09.): was passiert bei was — gelten hier und im Job (Profil) -->
          <tr><td class="muted" title="Regeln des Imports — stehen im Profil und gelten auch, wenn der Import als Job läuft">Regeln ⚖</td><td style="padding:0">
            <table class="grid rules"><colgroup><col style="width:220px" /><col style="width:360px" /></colgroup><tbody>
              <tr v-for="k in ['unknownAttrs', 'onError', 'missing', 'emptyValues']" :key="k">
                <td class="muted">{{ POLICY_TEXT[k][0] }}</td>
                <td><select v-model="policy[k]" @change="persist" style="width:100%"><option v-for="(text, v) in POLICY_TEXT[k][1]" :key="v" :value="v">{{ text }}</option></select></td>
              </tr>
              <tr><td class="muted" title="scheitern mehr als so viel Prozent der Befehle (ab 5 Fehlern), wird abgebrochen — 0 = nie">Abbruch ab Fehleranteil</td>
                <td><input type="number" v-model.number="policy.abortAbovePercent" min="0" max="100" style="width:70px" @change="persist" /> <span class="muted">%</span></td></tr>
              <tr><td class="muted" title="nur analysieren und den Plan melden, nichts schreiben">Trockenlauf</td>
                <td><label style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" v-model="policy.dryRun" @change="persist" /> nur analysieren, nichts schreiben</label></td></tr>
            </tbody></table>
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
.rules td { padding: 2px 6px; border-bottom: 0; height: 26px; font-size: 12px; }
.rules select, .rules input { font-size: 12px; }
</style>
