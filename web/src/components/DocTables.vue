<script setup>
// Tabellen aus einem Dokument den Attributen zuordnen (27.09.2026, pflegestruktur 34 L).
// Ein technisches Dokument, mit Strg auf einen Knoten gezogen, wird nicht nur angehängt, sondern ausgewertet: der
// Leser (Plugin docs) legt die Tabellen darin neben den Text; hier steht je Zeile Schlüssel und Wert aus dem
// Dokument, daneben das Attribut, das der Mapper vorschlägt — gefunden oder neu. Es schreibt nichts ohne ✓.
// Erst dann: neue Attribute ins Modell (Gruppe „aus Dokument“, zählt nicht), die Gruppe an den Knoten, wenn sie dort
// noch nicht gilt, dann ein Stapel attribute.set (Pflege, zählt).
// props: node = die Knotenansicht (id, role, groups, attachedGroups); media = Ids der Dokumente
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { suggestPairs, convert, validate, DOC_GROUP } from '../mapper.js'
import { t as t_ } from '../i18n.js'
import { L } from '../i18n.js'

const props = defineProps({ node: { type: Object, required: true }, media: { type: Array, default: () => [] } })
const emit = defineEmits(['close', 'done'])

const TYPEN = ['text', 'integer', 'decimal', 'boolean', 'date']
const docs = ref(new Map())      // id → { state, tables }
const rows = ref([])
const warten = ref(true)          // ein Dokument ist noch nicht gelesen — der Job liest es, wir fragen nach
const hinweis = ref('')
const busy = ref(false)
let gestartet = false, timer = null
const t0 = Date.now()
const WARTEN_MS = 120_000, TAKT_MS = 3000

const model = computed(() => store.model ?? {})
const attrs = computed(() => (model.value.attributes ?? []).filter(a => !['rows', 'formula', 'template', 'html'].includes(a.type))
  .sort((a, b) => (L(a.label) || a.key).localeCompare(L(b.label) || b.key, 'de', { sensitivity: 'base' })))
const units = computed(() => model.value.units ?? [])
const gilt = key => (props.node.groups ?? []).some(g => g.key === key)
const gruppeHier = key => { const a = attrs.value.find(x => x.key === key); return !a?.group || gilt(a.group) }
const genommen = computed(() => rows.value.filter(r => r.take && r.target !== 'skip' && r.converted != null && r.converted !== ''))
const anzahl = computed(() => rows.value.length)

/// Aus den gelesenen Tabellen die Zeilen des Dialogs: Schlüssel links, Wert rechts, dazu der Vorschlag des Mappers.
function baue() {
  const paare = []
  for (const [id, d] of docs.value) for (const tb of d.tables ?? []) for (const cells of tb.rows ?? []) {
    if (!Array.isArray(cells) || cells.length < 2) continue
    const key = String(cells[0] ?? '').trim(), value = cells.slice(1).map(c => String(c ?? '').trim()).filter(Boolean).join(' ')
    if (key && value) paare.push({ key, value, doc: id, heading: tb.heading ?? null, page: tb.page ?? null })
  }
  const vorschlag = suggestPairs(paare, model.value, { role: props.node.role })
  rows.value = vorschlag.map((v, i) => {
    const r = { ...paare[i], ...v }
    // ein gefundenes Attribut, dessen Gruppe hier nicht gilt: der Server lehnte den Wert ab — als Hinweis, nicht als Sperre
    if (r.target === 'attr' && !gruppeHier(r.attribute)) { r.why = t_('Gruppe {0} gilt an diesem Knoten nicht', [attrs.value.find(a => a.key === r.attribute)?.group ?? '']); r.inaktiv = true }
    r.take = r.target !== 'skip' && !r.error && !r.inaktiv && r.converted != null
    return r
  })
}

/// Die Tabellen holen. Ein Dokument ohne Zustand ist noch nicht gelesen: einmal den Job „Dokumente lesen“ anstossen
/// und dann nachfragen, bis er fertig ist — der Job läuft im Hintergrund, der Dialog wartet auf ihn, nicht der Anwender.
async function lade() {
  const offen = []
  for (const id of props.media) {
    try {
      const r = await api.get(`/api/docs/${encodeURIComponent(id)}/tables`)
      if (r.ready === false) { hinweis.value = t_('Kein Dokumentindex — der Server läuft ohne Postgres'); warten.value = false; return }
      docs.value.set(id, r)
      if (!r.state) offen.push(id)
    } catch (e) { hinweis.value = e.message }
  }
  docs.value = new Map(docs.value)
  baue()
  if (!offen.length) { warten.value = false; return }
  await anstossen()
  if (Date.now() - t0 > WARTEN_MS) { warten.value = false; hinweis.value = t_('{0} Dokumente sind noch nicht gelesen — der Job „Dokumente lesen“ holt sie nach', [offen.length]); return }
  timer = setTimeout(lade, TAKT_MS)
}
async function anstossen() {
  if (gestartet) return
  gestartet = true
  try {
    const jobs = await api.get('/api/jobs')
    const job = (Array.isArray(jobs) ? jobs : []).find(j => j.plugin === 'docs')
    if (!job) { hinweis.value = t_('Kein Job des Plugins „Dokumente lesen“'); return }
    await api.post(`/api/jobs/${encodeURIComponent(job.key)}/run`, {})
  } catch { /* läuft schon oder ist aus — der Zustand kommt mit der nächsten Abfrage */ }
}

/// Der Anwender ändert das Ziel einer Zeile: ein vorhandenes Attribut, „neu“ oder nichts.
function ziel(r, v) {
  if (v === '') { r.target = 'skip'; r.take = false; return }
  if (v === '+') { r.target = 'new'; r.inaktiv = false; r.converted = convert(r.number ?? r.value, { type: r.newType }, model.value); r.error = validate(r.converted, { type: r.newType }, model.value); r.take = !r.error && r.converted != null; r.why = t_('neu als {0}', [r.newType]); return }
  const def = attrs.value.find(a => a.key === v)
  r.target = 'attr'; r.attribute = v; r.inaktiv = !gruppeHier(v)
  r.converted = convert(r.number ?? r.value, def, model.value); r.error = validate(r.converted, def, model.value)
  r.take = !r.inaktiv && !r.error; r.why = r.inaktiv ? t_('Gruppe {0} gilt an diesem Knoten nicht', [def?.group ?? '']) : ''
}
const zielWert = r => r.target === 'attr' ? r.attribute : r.target === 'new' ? '+' : ''

async function uebernehmen() {
  const liste = genommen.value; if (!liste.length) return
  if (!store.actor) { store.toast(t_('👤 Name fehlt → Einstellungen')); return }
  busy.value = true
  const master = model.value.masterLocale
  try {
    // 1. Modell: jedes neue Attribut einmal — Bezeichnung ist der Schlüssel aus dem Dokument, Gruppe „aus Dokument“
    const neu = new Map()
    for (const r of liste) if (r.target === 'new') neu.set(r.newKey, r)
    for (const [key, r] of neu)
      await api.post(`/api/model/attributes/${encodeURIComponent(key)}`, { key, label: { [master]: r.key }, type: r.newType, unit: r.unit ?? null, group: DOC_GROUP }, 'PUT')
    // 2. die Gruppe an den Knoten, wenn sie am Pfad noch nicht gilt — sonst gälte kein neues Attribut hier
    if (neu.size && !gilt(DOC_GROUP))
      await api.post(`/api/nodes/${encodeURIComponent(props.node.id)}/groups`, { groups: [...(props.node.attachedGroups ?? []), DOC_GROUP] }, 'PUT')
    // 3. ein Stapel für die Werte
    const commands = liste.map(r => {
      const def = r.target === 'attr' ? attrs.value.find(a => a.key === r.attribute) : null
      return { op: 'attribute.set', args: { node: props.node.id, attribute: r.target === 'new' ? r.newKey : r.attribute, locale: def?.perLocale ? master : null, channel: null, value: r.converted, values: null, row: null } }
    })
    const res = await api.post('/api/batch?skipErrors=true', { commands })
    const n = res.results?.length ?? 0
    for (const s of res.skipped ?? []) store.toast(`${liste[s.index]?.key ?? s.index}: ${s.message}`)
    if (res.error) store.toast(res.error.message)
    if (n) store.toast(t_('{0} Werte aus dem Dokument übernommen', [n]) + (neu.size ? ' · ' + t_('{0} Attribute neu', [neu.size]) : ''), 'ok')
    emit('done')
  } catch (e) { store.toast(e.message) }
  finally { busy.value = false }
}

function onKey(e) { if (e.key === 'Escape') emit('close') }
onMounted(() => { window.addEventListener('keydown', onKey); lade() })
onUnmounted(() => { window.removeEventListener('keydown', onKey); if (timer) clearTimeout(timer) })
defineExpose({ rows, warten, hinweis, genommen })
</script>

<template>
  <div class="dt-overlay" @mousedown.self="emit('close')">
    <div class="dt">
      <div class="toolbar">
        <h1 :title="$t('Zeilen der Tabellen im Dokument: Schlüssel und Wert. Rechts das Attribut — gefunden oder neu in der Gruppe „aus Dokument“. Geschrieben wird erst mit ✓.')">{{ $t("▦ Tabellen aus dem Dokument") + ' ' }}<span class="muted">· {{ anzahl }}</span></h1>
        <span v-if="warten" class="muted" :title="$t('Der Job „Dokumente lesen“ liest das Dokument gerade; die Zeilen erscheinen, sobald er fertig ist.')">{{ $t("◌ wird gelesen …") }}</span>
        <span v-if="hinweis" class="neg">{{ hinweis }}</span>
        <span class="grow" />
        <button class="x" @click="emit('close')" :title="$t('schliessen (Esc)')">×</button>
      </div>
      <div class="dt-body scroll">
        <table class="grid" v-if="rows.length">
          <thead><tr>
            <th style="width:24px"></th>
            <th :title="$t('die erste Spalte der Tabelle im Dokument')">{{ $t("Im Dokument") }}</th>
            <th :title="$t('Attribut am Knoten — gefunden über Schlüssel, Bezeichnung, Synonym oder Ähnlichkeit; „+ neu“ legt es an')">{{ $t("→ Attribut") }}</th>
            <th :title="$t('Typ und Einheit eines neuen Attributs — aus dem Wert geraten, änderbar')">{{ $t("Typ") }}</th>
            <th :title="$t('der Wert, wie er geschrieben wird — Zahl ohne Einheit, Datum als JJJJ-MM-TT')">{{ $t("Wert") }}</th>
            <th></th>
          </tr></thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="i" class="row" :class="{ aus: !r.take }">
              <td><input type="checkbox" v-model="r.take" :disabled="r.target === 'skip'" /></td>
              <td :title="(r.heading ? r.heading + ' · ' : '') + (r.page ? $t('Seite {0}', [r.page]) : '') + '\n' + r.value">{{ r.key }}<div class="muted roh">{{ r.value }}</div></td>
              <td>
                <select :value="zielWert(r)" @change="ziel(r, $event.target.value)">
                  <option value="">—</option>
                  <option value="+">{{ $t("+ neu: {0}", [r.newKey]) }}</option>
                  <option v-for="a in attrs" :key="a.key" :value="a.key">{{ $L(a.label) || a.key }}</option>
                </select>
              </td>
              <td>
                <template v-if="r.target === 'new'">
                  <select v-model="r.newType"><option v-for="ty in TYPEN" :key="ty" :value="ty">{{ ty }}</option></select>
                  <select v-if="units.length && (r.newType === 'decimal' || r.newType === 'integer')" v-model="r.unit"><option :value="null">—</option><option v-for="u in units" :key="u.key" :value="u.key">{{ u.key }}</option></select>
                </template>
                <span v-else-if="r.target === 'attr'" class="muted">{{ attrs.find(a => a.key === r.attribute)?.type }}<template v-if="attrs.find(a => a.key === r.attribute)?.unit">{{ ' ' + attrs.find(a => a.key === r.attribute)?.unit }}</template></span>
              </td>
              <td><input type="text" v-model="r.converted" style="width:140px" /></td>
              <td class="muted" :class="{ neg: r.error || r.inaktiv }" style="font-size:11px">{{ r.error || r.why }}</td>
            </tr>
          </tbody>
        </table>
        <div v-else-if="!warten" class="empty">{{ $t("Keine Tabelle mit Schlüssel und Wert im Dokument") }}</div>
      </div>
      <div class="toolbar dt-foot">
        <span class="muted" :title="$t('Neue Attribute kommen in die Gruppe „aus Dokument“ — im Modell später einzuordnen')">{{ $t("Neue Attribute → Gruppe „aus Dokument“") }}</span>
        <span class="grow" />
        <button @click="emit('close')">{{ $t("Abbrechen") }}</button>
        <button class="primary" :disabled="busy || !genommen.length" @click="uebernehmen">{{ $t("✓ {0} übernehmen", [genommen.length]) }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dt-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: grid; place-items: center; z-index: 50; }
.dt { width: min(1000px, 96vw); max-height: min(720px, 92vh); background: var(--pane); border: 1px solid var(--line); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
.dt-body { flex: 1; min-height: 0; overflow: auto; padding: 8px; }
.dt-foot { border-top: 1px solid var(--line); gap: 8px; }
tr.aus td { opacity: .55; }
.roh { font-size: 11px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty { padding: 24px; text-align: center; color: var(--muted); }
</style>
