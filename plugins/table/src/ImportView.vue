<script setup>
// ⇩ Import → Tabelle (Basis-Plugin table; Taloan, 17.09.2026): eine Tabelle aus Datei (CSV, Excel, JSON — die Quelle liefert ein Plugin
// über importers) oder aus der Zwischenablage; der Datenmapper (mapper.js) schlägt die Zuordnung vor, der Mensch
// richtet nach, der Plan sagt, was passiert, der Stapel schreibt. Profile (Zuordnung, Ziel, Rolle) im Journal.
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api, store, tree, icon, plugins, mapper, Splitter, ImportHead, TreePicker, paneWidth } from 'journali'
const { suggest, plan: makePlan, parseDelimited, childAttributes, childRoleOf } = mapper
const leftW = paneWidth('import.table', 720)
const router = useRouter()
const route = useRoute()
// Knotenmodus (Taloan, 17.09.: Rechtsklick auf Gruppe/Produkt → Excel importieren): die Tabelle passt 1:1 zum Knoten —
// Ziel und Rolle sind fest, jede Spalte muss ein Attribut sein, das dort für die Kinder gilt; nichts Neues wird angelegt.
const fixed = ref(null)         // { row, childRole, allowed: Set<attr> }
async function fixNode(id) {
  if (!id) { fixed.value = null; return }
  if (!tree.loaded) await tree.load()
  const row = tree.byId.get(id); if (!row) { store.toast(`Knoten ${id} unbekannt`); return }
  const n = await api.get(`/api/nodes/${encodeURIComponent(id)}`)
  const childRole = childRoleOf(row, tree.kids(id))
  const allowed = new Set(childAttributes(model.value, n, childRole).map(a => a.key)); allowed.add('sku')
  for (const a of row.axes ?? []) allowed.add(a)
  fixed.value = { row, childRole, allowed }
  pickTarget(row); role.value = childRole; external.value = ''
  if (source.value) resuggest()
}
watch(() => route.query.node, id => fixNode(id), { immediate: true })

const model = computed(() => store.model)
const locales = computed(() => model.value?.locales.map(l => l.code) ?? [])
const source = ref(null)        // { name, columns, rows, sheets?, sheet? , importer? }
const mapping = ref([])         // aus suggest(), vom Menschen geändert
const target = ref(null)        // Baumzeile
const role = ref('')            // '' = automatisch (unter Gruppe: Produkt, unter Produkt: Variante)
const external = ref('')        // System der externen Kennung (Spalte „external“)
const busy = ref('')
const planned = ref(null)
const result = ref(null)
const log = ref([])
const pasteText = ref('')
const dragOver = ref(false)
const say = m => log.value.unshift(`${new Date().toLocaleTimeString('de-DE')} ${m}`)

const attrs = computed(() => (model.value?.attributes ?? []).filter(a => a.type !== 'rows'))
const targetPick = ref(false)
// Ziel per Auswahlbaum (Taloan): ohne Ziel steht der Baum offen, mit Ziel ein Chip — Klick auf den Chip klappt ihn wieder auf
function pickTarget(r) { target.value = r; targetPick.value = false; planned.value = null }

// ---- Quelle
// Datei-Handle (File System Access API, Chrome/Edge): damit liest ↻ die Datei jederzeit neu von der Platte —
// ein File aus <input type=file> ist ein Schnappschuss und lässt sich nach einer Änderung nicht mehr lesen.
const fileHandle = ref(null)
const canPick = typeof window.showOpenFilePicker === 'function'
async function pickFile(e) {
  if (!canPick) return   // Fallback: das <input type=file> im Label
  e.preventDefault()
  try {
    const [h] = await window.showOpenFilePicker({ multiple: false })
    fileHandle.value = h
    await takeFile(await h.getFile())
  } catch (err) { if (err?.name !== 'AbortError') store.toast(err.message) }
}
async function reloadFile() {
  if (fileHandle.value) {
    try { await takeFile(await fileHandle.value.getFile(), true); store.toast(`${source.value?.name}: neu gelesen`, 'ok') } catch (err) { store.toast(err.message) }
  } else document.querySelector('#table-file-input')?.click()
}
async function takeFile(file, keepSheet = false) {
  // Rohdaten-JSON (Knotenbaum { model, node } oder Knoten mit id/role/values) gehört in den JSON-Import, nicht in die Tabelle (Taloan)
  if (/\.json$/i.test(file.name)) {
    try { const j = JSON.parse(await file.text()); const n = j?.node ?? j; if (n && !Array.isArray(n) && n.id && n.role && Array.isArray(n.values)) { store.toast('Knotenbaum erkannt → JSON-Import', 'ok'); store.pendingImport = { file, parent: target.value || null }; router.push('/p/json/import'); return } } catch { /* dann wie eine Tabelle */ }
  }
  const sheet = keepSheet ? source.value?.sheet : null
  const imp = plugins.importerFor(file.name)
  busy.value = `lese ${file.name} …`
  try {
    let t
    if (imp) t = await imp.parse(file, plugins.ctx(imp.key))
    else if (/\.(csv|txt|tsv)$/i.test(file.name)) t = parseDelimited(await file.text())
    else if (/\.json$/i.test(file.name)) { const { fromObjects } = mapper; const j = JSON.parse(await file.text()); t = fromObjects(Array.isArray(j) ? j : (j.rows ?? j.items ?? j.data ?? [])) }
    else throw new Error(`Kein Importer für ${file.name} — Plugin für dieses Format einschalten (⌁ Plugins)`)
    setSource({ ...t, name: file.name, importer: imp?.key ?? null })
    if (sheet && source.value?.sheets?.some(s => s.name === sheet)) pickSheet(sheet)
  } catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
function setSource(t) {
  if (t.sheets && !t.columns) { t.sheet = t.sheets[0]?.name; const s = t.sheets[0]; t.columns = s?.columns ?? []; t.rows = s?.rows ?? [] }
  source.value = t
  mapping.value = strictify(suggest(t.columns, t.rows, model.value, { external: external.value || null }))
  planned.value = null; result.value = null
  say(`${t.name}: ${t.rows.length} Zeilen, ${t.columns.length} Spalten — ${mapping.value.filter(m => m.target === 'attr').length} Spalten zugeordnet, ${mapping.value.filter(m => m.target === 'new').length} neu, ${mapping.value.filter(m => m.target === 'skip').length} übergangen`)
}
function pickSheet(name) { const s = source.value.sheets.find(x => x.name === name); if (!s) return; setSource({ ...source.value, sheet: name, columns: s.columns, rows: s.rows }) }
function takePaste() { const t = parseDelimited(pasteText.value); if (!t.columns.length) return; setSource({ ...t, name: 'Zwischenablage' }); pasteText.value = '' }
function onDrop(e) { dragOver.value = false; const f = e.dataTransfer.files?.[0]; if (f) takeFile(f) }
function resuggest() { if (source.value) mapping.value = strictify(suggest(source.value.columns, source.value.rows, model.value, { external: external.value || null })); planned.value = null }
// Knotenmodus: was nicht zum Knoten passt, wird übergangen und gezählt — Vorlage vom Knoten exportieren, dann passt es
function strictify(m) {
  if (!fixed.value) return m
  for (const x of m) {
    if (x.target === 'new') { x.target = 'skip'; x.why = 'unbekannt — nicht in der Vorlage dieses Knotens'; x.unknown = true }
    else if (x.target === 'attr' && !fixed.value.allowed.has(x.attribute)) { x.target = 'skip'; x.why = `${x.attribute} gilt hier nicht für ${roleLabel[fixed.value.childRole]}`; x.unknown = true }
    else if (x.target === 'parent' || x.target === 'external') { x.target = 'skip'; x.why = 'im Knotenmodus ohne Bedeutung' }
  }
  return m
}
const roleLabel = { group: 'Gruppen', product: 'Produkte', variant: 'Varianten' }
const unknown = computed(() => mapping.value.filter(m => m.unknown).length)

// ---- Zuordnung: Zeile je Spalte
const TARGETS = [['attr', 'Attribut'], ['new', 'neues Attribut'], ['id', 'journali-Id'], ['sku', 'SKU (finden)'], ['external', 'externe Kennung'], ['parent', 'Elternteil'], ['skip', 'übergehen']]
const sample = (i) => source.value.rows.slice(0, 200).map(r => r[i]).filter(v => String(v ?? '').trim() !== '').slice(0, 3).map(v => String(v).slice(0, 30)).join(' · ')
function onTarget(m) { planned.value = null; if (m.target === 'attr' && !m.attribute) m.attribute = attrs.value[0]?.key ?? null; if (m.target === 'new' && !m.newKey) m.newKey = m.column.toLowerCase().replace(/[^a-z0-9]+/g, '_'); syncLocale(m) }
function syncLocale(m) { const a = attrs.value.find(x => x.key === m.attribute); if (m.target === 'attr' && a && !a.perLocale) m.locale = null; if (m.target === 'attr' && a?.perLocale && !m.locale) m.locale = model.value?.masterLocale ?? locales.value[0] }
const keyColumn = computed(() => mapping.value.find(m => ['id', 'sku', 'external'].includes(m.target)))
const groups = computed(() => model.value?.groups ?? [])
// Schreiben erst, wenn nichts mehr im Weg steht: ungültige Zellen (korrigieren), neue Spalten ohne Gruppe, im Knotenmodus gar keine ungültigen
const blockers = computed(() => {
  const p = planned.value; if (!p) return []
  const out = []
  if (p.stats.invalid.length) out.push(fixed.value ? `${p.stats.invalid.length} Werte passen nicht zum Typ — Datei abgelehnt, in Excel korrigieren` : `${p.stats.invalid.length} Werte passen nicht zum Typ — unten korrigieren`)
  if (p.stats.missingGroup.length) out.push(`neue Attribute ohne Attributgruppe: ${p.stats.missingGroup.join(', ')}`)
  return out
})
// Korrektur einer Zelle direkt in der Quelle; danach neu analysieren
function fixCell(inv, v) { source.value.rows[inv.row][inv.column] = v; planned.value = { ...planned.value, stale: true } }

// ---- Plan
async function analyse() {
  if (!source.value) return
  if (!target.value && !mapping.value.some(m => m.target === 'parent')) { store.toast('Ziel wählen (Gruppe oder Produkt) — oder eine Spalte „Elternteil“'); return }
  busy.value = 'vergleiche mit dem Bestand …'
  try {
    await tree.load(true)
    // Bestand: Werte der betroffenen Attribute unter dem Ziel (je Sprache ein Aufruf), zum Vergleichen
    const keys = [...new Set(mapping.value.filter(m => m.target === 'attr').map(m => m.attribute))]
    const locs = [...new Set(mapping.value.filter(m => m.target === 'attr').map(m => m.locale ?? ''))]
    const existing = new Map()
    const roots = target.value ? [target.value.id] : tree.rows.filter(r => !r.parent).map(r => r.id)
    for (const rid of roots) for (const loc of locs) {
      const t = await api.get(`/api/nodes/${encodeURIComponent(rid)}/table?deep=true&attributes=${encodeURIComponent(keys.join(','))}${loc ? '&locale=' + loc : ''}`)
      for (const r of t.rows) {
        const cur = existing.get(r.row.id) ?? {}
        for (const [k, v] of Object.entries(r.values)) if (v.value != null) { cur[`${k}|${loc}`] = v.value; cur[`${k}|${loc}#own`] = v.own }
        existing.set(r.row.id, cur)
      }
    }
    planned.value = makePlan({ columns: source.value.columns, rows: source.value.rows, mapping: mapping.value.map(m => ({ ...m })), model: model.value, tree, target: target.value, role: role.value || null, existing, external: external.value || null })
    const s = planned.value.stats
    const nlv = Object.entries(s.newListValues ?? {}).map(([l, v]) => `${l}: ${Object.values(v).join(', ')}`)
    say(`Plan: ${s.create} neu, ${s.update} geändert, ${s.unchanged} unverändert, ${s.values} Werte, ${planned.value.newAttributes.length} neue Attribute${nlv.length ? `, neue Listenwerte — ${nlv.join('; ')}` : ''}${s.problems.length ? `, ${s.problems.length} Probleme` : ''}`)
  } catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
async function run() {
  if (!planned.value || !store.actor) { if (!store.actor) store.toast('👤 Name fehlt → Einstellungen'); return }
  if (blockers.value.length || planned.value.stale) { store.toast(blockers.value[0] ?? 'erst neu analysieren'); return }
  const p = planned.value
  busy.value = 'schreibe …'; result.value = null
  try {
    for (const a of p.newAttributes) await api.post(`/api/model/attributes/${a.key}`, a, 'PUT')
    // neue Listenwerte zuerst (Taloan, 20.09.): Schlüssel normiert, Bezeichnung in allen Sprachen der Text der Datei
    let nlv = 0
    for (const [list, vals] of Object.entries(p.stats.newListValues ?? {})) for (const [key, label] of Object.entries(vals)) { await api.post(`/api/model/lists/${list}/values/${encodeURIComponent(key)}`, { value: key, label: Object.fromEntries(model.value.locales.map(l => [l.code, label])) }, 'PUT'); nlv++ }
    if (nlv) say(`${nlv} Listenwerte angelegt`)
    if (p.newAttributes.length) { await store.poll(true); say(`${p.newAttributes.length} Attribute angelegt: ${p.newAttributes.map(a => a.key + ' → ' + a.group).join(', ')}`) }
    const cmds = [...p.attach.map(x => ({ op: 'groups.attach', args: { node: x.node, groups: [...(tree.byId.get(x.node)?.groups ?? '').split(',').filter(Boolean), ...x.groups] } })), ...p.commands]   // groups.attach setzt die ganze Liste
    // Stapel in Happen: neue Knoten samt ihren Werten zusammen (Refs gelten nur im selben Aufruf)
    const batch = 'imp-' + Date.now().toString(36)
    const res = await api.batchChunked(cmds, { batch, size: 1000, label: 'Import (Tabelle): schreiben', onProgress: p => { busy.value = `schreibe … ${p.done}/${p.total}` } })
    const done = res.results.length
    if (res.error) throw new Error(`Befehl ${res.error.index + 1} (${res.error.op}): ${res.error.message} — ${done} geschrieben`)
    result.value = { written: done, batch: res.batch }
    say(`fertig: ${done} Einträge, Stapel ${batch}`)
    await tree.load(true); await store.poll(true)
    planned.value = null
  } catch (e) { store.toast(e.message); say('✗ ' + e.message) } finally { busy.value = '' }
}

// ---- Profil: Zuordnung (je Spaltenname), Ziel, Rolle, Kennung
const profileGet = () => ({ target: target.value?.id ?? null, role: role.value, external: external.value, mapping: Object.fromEntries(mapping.value.map(m => [m.column, { target: m.target, attribute: m.attribute, locale: m.locale, newKey: m.newKey, newType: m.newType, newGroup: m.newGroup }])) })
function profileSet(p) {
  if (!p) { target.value = null; role.value = ''; external.value = ''; planned.value = null; return }
  role.value = p.role ?? ''; external.value = p.external ?? ''
  if (p.target && tree.byId.get(p.target)) pickTarget(tree.byId.get(p.target))
  if (p.mapping && source.value) for (const m of mapping.value) { const s = p.mapping[m.column]; if (s) Object.assign(m, s) }
  planned.value = null
}
onMounted(async () => {
  if (!tree.loaded) await tree.load()
  // vom Baum gezogen (Drag & Drop auf einen Knoten): Datei lesen, Ziel setzen, Analyse gleich starten
  const p = store.pendingImport
  if (p?.file && !/\.json(\.gz)?$/i.test(p.file.name)) {
    store.pendingImport = null
    await takeFile(p.file)
    if (p.parent && tree.byId.get(p.parent)) pickTarget(tree.byId.get(p.parent))
    if (p.analyse && source.value && target.value) await analyse()
  }
})
</script>

<template>
  <div class="pane" :style="`width:${leftW}px;flex:none`">
    <ImportHead source="table" plugin="table" :busy="busy" :get="profileGet" :set="profileSet">
      <tr><td class="attr">Datei</td><td class="row drop" :class="{ over: dragOver }" @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="onDrop">
        <label class="primary btn" :title="'CSV, TSV, JSON' + (plugins.importers.length ? ', ' + plugins.importers.flatMap(i => i.accept ?? []).join(', ') : '') + ' — oder hierher ziehen'" @click="pickFile">📂 wählen<input id="table-file-input" type="file" style="display:none" @change="fileHandle = null; takeFile($event.target.files[0])" /></label>
        <span v-if="source" class="chip" :title="`${source.rows.length} Zeilen · ${source.columns.length} Spalten`">📄 {{ source.name }} <span class="muted">{{ source.rows.length }}</span></span>
        <button v-if="source" class="x" @click="reloadFile" :title="fileHandle ? 'Datei neu von der Platte lesen (zwischendurch in Excel geändert?)' : 'Datei neu wählen — dieser Browser kann Dateien nicht erneut lesen'">↻</button>
        <select v-if="source?.sheets?.length > 1" :value="source.sheet" @change="pickSheet($event.target.value)" title="Blatt" style="width:140px"><option v-for="s in source.sheets" :key="s.name" :value="s.name">{{ s.name }} ({{ s.rows.length }})</option></select>
        <span v-else-if="!source" class="muted" style="font-size:12px">oder hierher ziehen</span>
        <span class="grow" />
        <button v-if="source" class="x" @click="resuggest" title="Zuordnung neu vorschlagen">↻</button>
      </td></tr>
      <tr><td class="attr">Einfügen</td><td><input v-model="pasteText" type="text" placeholder="aus Excel kopieren, hier Strg+V (erste Zeile = Spaltennamen)" @paste="setTimeout(takePaste, 0)" /></td></tr>
      <tr class="step"><td colspan="2">2 · Ziel <span class="muted" style="font-weight:400">· {{ fixed ? 'fest: die Tabelle passt 1:1 zu diesem Knoten' : 'wohin neue Zeilen kommen; vorhandene werden über Id, SKU oder Kennung gefunden' }}</span></td></tr>
      <tr v-if="fixed"><td class="attr">Knoten</td><td class="row">
        <router-link :to="`/tree/${fixed.row.id}`" class="chip" :title="fixed.row.id">{{ icon(fixed.row.role) }} {{ fixed.row.label }}</router-link>
        <span class="muted">→ {{ roleLabel[fixed.childRole] }} · {{ fixed.allowed.size }} mögliche Spalten</span>
        <span class="grow" /><button class="x" @click="router.replace('/p/table/import')" title="Knotenmodus verlassen — frei zuordnen">×</button>
      </td></tr>
      <tr v-if="!fixed"><td class="attr">Ziel</td><td>
        <div class="row" style="margin-bottom:4px"><span v-if="target" class="chip" :title="target.id + ' — Klick: im Baum ändern'" style="cursor:pointer" @click="targetPick = !targetPick">{{ icon(target.role) }} {{ target.label }} <button @click.stop="target = null; planned = null" title="Ziel weg">×</button></span><span v-else class="muted">Gruppe oder Produkt — wohin neue Zeilen kommen</span></div>
        <TreePicker v-if="!target || targetPick" :model-value="target?.id ?? ''" :height="200" @pick="pickTarget" />
      </td></tr>
      <tr v-if="!fixed"><td class="attr">Neue als</td><td><select v-model="role" title="Rolle neuer Zeilen" @change="planned = null" style="width:100%">
        <option value="">automatisch (unter Gruppe → Produkt, unter Produkt → Variante)</option><option value="group">▣ Gruppen</option><option value="product">▦ Produkte</option><option value="variant">◆ Varianten</option>
      </select></td></tr>
      <tr v-if="!fixed"><td class="attr">Kennung</td><td><input v-model="external" type="text" placeholder="System der externen Kennung (z. B. erp) — findet vorhandene Knoten" @change="resuggest" /></td></tr>
    </ImportHead>
    <div class="scroll">
      <div v-if="!keyColumn && source" class="muted" style="font-size:12px;padding:6px 8px">⚠ Keine Schlüsselspalte (Id, SKU, Kennung) — jede Zeile wird neu angelegt.</div>
      <div v-if="unknown" class="warn" style="font-size:12px;padding:6px 8px">⚠ {{ unknown }} Spalten passen nicht zu diesem Knoten und werden übergangen — Vorlage per Rechtsklick am Knoten exportieren, dann stimmen die Spalten.</div>

      <div class="section" v-if="source">
        <h2 class="step-band" style="margin:0 -8px 6px">3 · Zuordnung <span class="muted">· {{ mapping.filter(m => m.target !== 'skip').length }} von {{ mapping.length }} Spalten</span></h2>
        <table class="grid map">
          <thead><tr><th style="width:170px">Spalte</th><th>Beispiele</th><th style="width:130px">Ziel</th><th style="width:220px">Attribut</th><th style="width:60px">Sprache</th><th style="width:150px">Warum</th></tr></thead>
          <tbody>
            <tr v-for="(m, i) in mapping" :key="m.column" :class="{ off: m.target === 'skip' }">
              <td class="attr" :title="m.column"><b>{{ m.column }}</b><div class="muted" style="font-size:11px">{{ m.sniff?.type }} · {{ m.sniff?.distinct }} versch.</div></td>
              <td class="muted samples">{{ sample(i) }}</td>
              <td><select v-model="m.target" @change="onTarget(m)" style="width:100%"><option v-for="[k, l] in TARGETS.filter(([k]) => !fixed || !['new', 'parent', 'external'].includes(k))" :key="k" :value="k">{{ l }}</option></select></td>
              <td>
                <select v-if="m.target === 'attr'" v-model="m.attribute" @change="syncLocale(m); planned = null; m.unknown = false" style="width:100%"><option v-for="a in attrs.filter(a => !fixed || fixed.allowed.has(a.key))" :key="a.key" :value="a.key">{{ a.label?.de || a.key }} · {{ a.key }}</option></select>
                <span v-else-if="m.target === 'new'" style="display:flex;gap:4px;flex-wrap:wrap"><input v-model="m.newKey" type="text" style="flex:1;min-width:90px" placeholder="schlüssel" @change="planned = null" /><select v-model="m.newType" style="width:84px" @change="planned = null"><option v-for="t in ['text', 'html', 'integer', 'decimal', 'boolean', 'date']" :key="t" :value="t">{{ t }}</option></select>
                  <select v-model="m.newGroup" style="width:100%" :class="{ neg: !m.newGroup }" title="Attributgruppe — Pflicht: ohne Gruppe gilt das Attribut nirgends" @change="planned = null"><option :value="undefined">● Gruppe wählen …</option><option v-for="g in groups" :key="g.key" :value="g.key">▤ {{ g.label?.de || g.key }}</option></select></span>
                <span v-else class="muted">—</span>
              </td>
              <td><select v-if="(m.target === 'attr' && attrs.find(a => a.key === m.attribute)?.perLocale) || m.target === 'new'" v-model="m.locale" style="width:100%" @change="planned = null"><option :value="null">*</option><option v-for="l in locales" :key="l" :value="l">{{ l }}</option></select></td>
              <td class="muted" style="font-size:11px">{{ m.why }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <Splitter v-model="leftW" :min="480" :max="1400" />
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>4 · Plan</h1>
      <button class="primary" :disabled="!source || !!busy" @click="analyse">analysieren</button>
      <button class="primary" :disabled="!planned || !!busy || !planned.commands.length || blockers.length > 0 || planned.stale" @click="run" :title="!planned ? 'erst analysieren' : blockers[0] ?? (planned.stale ? 'erst erneut analysieren' : `${planned.commands.length} Befehle schreiben`)">▶ schreiben</button>
      <span class="grow" /><span class="muted">{{ store.actor ? '👤 ' + store.actor : '👤 Name fehlt' }}</span>
    </div>
    <div class="scroll" style="padding:8px">
      <div v-if="planned" class="stats">
        <span class="pos">+{{ planned.stats.create }} neu</span> · <span>{{ planned.stats.update }} geändert</span> · <span class="muted">{{ planned.stats.unchanged }} unverändert</span> · {{ planned.stats.values }} Werte · {{ planned.commands.length }} Befehle<template v-if="Object.keys(planned.stats.newListValues ?? {}).length"> · <span class="pos" :title="Object.entries(planned.stats.newListValues).map(([l, v]) => l + ': ' + Object.values(v).join(', ')).join(' · ')">+{{ Object.values(planned.stats.newListValues).reduce((n, v) => n + Object.keys(v).length, 0) }} Listenwerte</span></template>
        <span v-if="planned.newAttributes.length"> · <span class="warn">{{ planned.newAttributes.length }} neue Attribute:</span> {{ planned.newAttributes.map(a => a.key + ' (' + a.type + ')').join(', ') }}</span>
        <div v-if="planned.stats.problems.length" class="neg" style="margin-top:6px;white-space:pre-wrap">{{ planned.stats.problems.slice(0, 30).join('\n') }}<span v-if="planned.stats.problems.length > 30"> … +{{ planned.stats.problems.length - 30 }}</span></div>
        <div v-for="b in blockers" :key="b" class="neg" style="margin-top:6px">✗ {{ b }}</div>
        <div v-if="planned.stale" class="warn" style="margin-top:6px">✎ Zellen korrigiert — <button class="primary" @click="analyse">erneut analysieren</button></div>
        <div v-if="planned.stats.invalid.length" class="section" style="margin-top:8px;padding:0">
          <h2 class="step-band" style="margin:0 0 4px">Werte prüfen <span class="muted">· {{ planned.stats.invalid.length }} Zellen{{ fixed ? ' — im Knotenmodus in Excel korrigieren und neu laden' : ' — hier korrigieren, dann erneut analysieren' }}</span></h2>
          <table class="grid" style="width:100%"><thead><tr><th style="width:60px">Zeile</th><th style="width:160px">Spalte</th><th>Grund</th><th style="width:220px">Korrektur</th></tr></thead><tbody>
            <tr v-for="inv in planned.stats.invalid.slice(0, 200)" :key="inv.row + '|' + inv.column">
              <td class="mono muted">{{ inv.row + 2 }}</td><td class="mono">{{ source.columns[inv.column] }}</td><td>{{ inv.message }}</td>
              <td><input v-if="!fixed" type="text" :value="inv.value" style="width:100%" @change="fixCell(inv, $event.target.value)" /><span v-else class="muted">{{ inv.value }}</span></td>
            </tr>
          </tbody></table>
        </div>
        <details style="margin-top:8px"><summary class="muted">Befehle (erste 200)</summary>
          <pre class="out">{{ planned.commands.slice(0, 200).map(c => `${c.op} ${JSON.stringify(c.args)}`).join('\n') }}</pre></details>
      </div>
      <div v-else-if="source" class="muted">Zuordnung prüfen, Ziel wählen, dann analysieren. Nichts wird geschrieben, bevor Du „schreiben“ drückst.</div>
      <div v-else class="empty">Datei ablegen oder aus Excel einfügen.<br /><span class="muted" style="font-size:12px">Der Mapper erkennt Spalten an Schlüssel, Label, Synonymen (Artikelnummer → sku …), Sprache im Namen (name_en) und rät den Typ neuer Attribute aus den Werten.</span></div>
      <div v-if="result" class="pos" style="margin-top:8px">✓ {{ result.written }} Einträge geschrieben · Stapel {{ result.batch }} — <router-link :to="{ path: '/journal', query: { q: result.batch } }">im Journal</router-link></div>
      <div class="section" v-if="log.length"><h2>Protokoll</h2><div class="mono" style="font-size:12px;white-space:pre-wrap">{{ log.join('\n') }}</div></div>
    </div>
  </div>
</template>

<style scoped>
.section { padding: 8px; border-bottom: 1px solid var(--line); }
.section h2 { font-size: 12px; margin: 0 0 6px; font-weight: 600; }
.section h2 .muted { font-weight: 400; }
.drop.over { outline: 2px dashed var(--accent); outline-offset: -2px; }
.btn { display: inline-block; padding: 2px 10px; border-radius: 6px; cursor: pointer; }
.map td { vertical-align: top; padding: 3px 4px; }
.map tr.off td { opacity: .5; }
.samples { font-size: 11px; white-space: normal; max-width: 260px; }
.stats { font-size: 13px; }
.out { font-size: 11px; max-height: 400px; overflow: auto; background: var(--bg); padding: 6px; border-radius: 6px; }
.picker { max-height: 240px; overflow: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--pane); margin-top: 4px; }
.pick { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 8px; white-space: nowrap; cursor: pointer; }
.pick:hover { background: var(--hover); }
</style>
