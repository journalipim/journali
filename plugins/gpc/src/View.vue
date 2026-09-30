<script setup>
// ⌗ GPC: die GS1-Produktklassifikation. Die Veröffentlichung (JSON oder das Zip, das sie enthält) wird im Browser gelesen und
// als Häppchen ins Journal übernommen; danach sucht man einen Brick und weist ihn einem Knoten zu. Was im Modell anzulegen ist
// (Gruppe, Klassenattribut, ein Listenattribut je GPC-Attribut), macht der Server (/api/classification) — hier steht nur,
// was GPC ausmacht. Nichts von GPC liegt im Repo: die Datei holt der Anwender bei GS1.
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api, store, tree, icon, TreePicker, t as t_ } from 'journali'
import {
  isZip, jsonInZip, inflateInBrowser, parseGpc, toRecords, searchBricks, brickText, pathText, titleOf,
  featureSpecs, classesByAttribute, classSpec, systemSpec,
} from '../core.mjs'

const route = useRoute()
const locale = computed(() => store.model?.masterLocale ?? 'de')
const busy = ref('')
const fehler = ref('')
const dragOver = ref(false)

// Was im Journal liegt
const release = ref(null)          // { version, date, languages, counts }
const dict = ref({ attributes: {}, values: {}, hierarchy: {} })
const bricks = ref([])
const settings = ref({})
// Was gerade gelesen wurde und noch nicht übernommen ist
const gelesen = ref(null)
const gespeichert = ref({})       // die Datensätze, wie sie im Journal stehen — zum Vergleichen
const vorhaben = ref(null)        // { alle, neu }: was die gelesene Datei ergibt und davon, was im Journal anders ist
const dateiOffen = ref(false)     // mit übernommenen Daten braucht es die Datei nur für eine weitere Fassung oder Sprache

const byAttr = computed(() => classesByAttribute(bricks.value))
const hatDaten = computed(() => bricks.value.length > 0)

async function laden() {
  busy.value = t_('lese …')
  try {
    const all = await api.get('/api/plugins/gpc/data?values=true')
    gespeichert.value = all
    release.value = all.release ?? null
    settings.value = all.settings ?? {}
    dict.value = all.dict ?? { attributes: {}, values: {}, hierarchy: {} }
    bricks.value = Object.entries(all).filter(([k]) => k.startsWith('bricks:')).flatMap(([, v]) => v.bricks ?? [])
    fehler.value = ''
  } catch (e) { fehler.value = e.message } finally { busy.value = '' }
}

async function datei(file) {
  fehler.value = ''; gelesen.value = null
  busy.value = t_('lese {0} …', [file.name])
  try {
    let buf = new Uint8Array(await file.arrayBuffer())
    if (isZip(buf)) buf = await inflateInBrowser(jsonInZip(buf))
    gelesen.value = parseGpc(new TextDecoder().decode(buf))
    vorhaben.value = vergleichen(gelesen.value)
  } catch (e) { fehler.value = e.message } finally { busy.value = '' }
}
function gewaehlt(e) { const f = e.target.files?.[0]; if (f) datei(f); e.target.value = '' }
function abgelegt(e) { dragOver.value = false; const f = e.dataTransfer?.files?.[0]; if (f) datei(f) }

/// Was die gelesene Datei ergibt und was davon im Journal anders ist. Das Journal wächst nur: was schon genau so dasteht,
/// wird nicht noch einmal geschrieben — dieselbe Datei ein zweites Mal ergibt nichts.
function vergleichen(rel) {
  const have = { bricks: new Map(), dict: dict.value, release: release.value }
  for (const b of bricks.value) { const s = b.path[0]; if (!have.bricks.has(s)) have.bricks.set(s, []); have.bricks.get(s).push(b) }
  const alle = Object.entries(toRecords(rel, have))
  return { alle: alle.length, neu: alle.filter(([name, value]) => JSON.stringify(value) !== JSON.stringify(gespeichert.value[name])) }
}

/// In Häppchen übernehmen, aber nur das Neue: ein Segment ist bis zu 2 MB, mehr als ein paar Stück gehen nicht in einen Aufruf
async function uebernehmen() {
  if (!gelesen.value || !vorhaben.value?.neu.length) return
  const items = vorhaben.value.neu
  busy.value = t_('übernehme …')
  try {
    let chunk = {}, size = 0, done = 0
    const flush = async () => { if (!Object.keys(chunk).length) return; await api.post('/api/plugins/gpc/data', chunk, 'PUT'); chunk = {}; size = 0 }
    for (const [name, value] of items) {
      const n = JSON.stringify(value).length
      if (size + n > 3_000_000) await flush()
      chunk[name] = value; size += n; busy.value = t_('übernehme … {0}/{1}', [++done, items.length])
    }
    await flush()
    gelesen.value = null; vorhaben.value = null; dateiOffen.value = false
    await laden()
    store.toast(t_('✓ {0} Bricks übernommen', [bricks.value.length]), 'ok')
  } catch (e) { fehler.value = e.message; busy.value = '' }
}

// ---- Suchen und zuweisen
const suche = ref('')
const treffer = computed(() => searchBricks(bricks.value, dict.value.hierarchy, suche.value, locale.value))
const gewaehlterBrick = ref(null)
const ziel = ref(route.query.node ? String(route.query.node) : '')
const zielZeile = computed(() => ziel.value ? tree.byId?.get(ziel.value) ?? null : null)
const aktuell = ref(null)   // die Klasse, die am Ziel schon gilt

async function zielLesen() {
  aktuell.value = null
  if (!ziel.value) return
  try {
    const n = await api.get(`/api/nodes/${encodeURIComponent(ziel.value)}`)
    const key = settings.value.classAttr || systemSpec().classAttr
    const eigen = n.values?.find(v => v.attribute === key && !v.locale && !v.channel && !v.row)?.value
    if (eigen) { aktuell.value = { code: String(eigen), geerbt: false }; return }
    for (const a of n.ancestors ?? []) {
      const v = a.values?.find(v => v.attribute === key && !v.locale && !v.channel)?.value
      if (v) { aktuell.value = { code: String(v), geerbt: true, von: a.label }; return }
    }
  } catch { /* das Ziel ist neu oder gelöscht */ }
}
function zielWahl(id) { ziel.value = id || ''; zielLesen() }

const brickTitel = b => brickText(b, locale.value)[0]
const weg = b => pathText(b, dict.value.hierarchy, locale.value)
const attributName = ac => titleOf(dict.value.attributes?.[ac], locale.value)
const brickVon = code => bricks.value.find(b => b.code === code)

/// Die Klassen, die dem Server mitgehen: die in der Werteliste noch fehlen — alle, wenn es die Liste oder ihre Spalte „group“ nicht gibt
function klassenFuer(brick) {
  const key = settings.value.classAttr || systemSpec().classAttr
  const list = (store.model?.lists ?? []).find(l => l.key === key)
  const a = (store.model?.attributes ?? []).find(x => x.key === key)
  const fremd = a && !(a.group === (settings.value.group || systemSpec().group) || (a.type === 'enum' && a.list === key))
  const have = !list || fremd || !(list.columns ?? []).includes('group') ? new Set() : new Set((list.values ?? []).map(v => v.value))
  const out = bricks.value.filter(b => !have.has(b.code))
  if (!out.some(b => b.code === brick.code)) out.push(brick)
  return out.map(b => classSpec(b, dict.value.hierarchy, locale.value))
}

async function zuweisen() {
  const b = gewaehlterBrick.value
  if (!b || !ziel.value) return
  busy.value = t_('weise {0} zu …', [b.code]); fehler.value = ''
  try {
    const r = await api.post('/api/classification/assign', {
      node: ziel.value, class: b.code, system: systemSpec(settings.value), classes: klassenFuer(b),
      features: featureSpecs(b, dict.value, byAttr.value),
    })
    // Hat der Server wegen einer Namenskollision ausgewichen, gilt der neue Schlüssel ab jetzt
    if (r.groupRenamed || r.classAttrRenamed) {
      settings.value = { ...settings.value, group: r.group, classAttr: r.classAttr }
      await api.post('/api/plugins/gpc/data/settings', settings.value, 'PUT')
    }
    await store.poll?.(true); await tree.load?.(true)
    const rd = r.readiness
    store.toast(rd.ready ? t_('✓ {0} an {1}', [b.code, zielZeile.value?.label ?? ziel.value])
      : t_('⚠ {0} an {1}: {2}', [b.code, zielZeile.value?.label ?? ziel.value, !rd.groupExists ? t_('Gruppe fehlt') : !rd.groupOn ? t_('Gruppe gilt hier nicht') : t_('{0} ohne Attribut', [rd.missing.length])]), rd.ready ? 'ok' : 'error')
    await zielLesen()
  } catch (e) { fehler.value = e.message } finally { busy.value = '' }
}

onMounted(async () => { if (!tree.loaded) await tree.load?.(); await laden(); await zielLesen() })
defineExpose({ release, bricks, dict, gelesen, vorhaben, dateiOffen, suche, treffer, gewaehlterBrick, ziel, aktuell, datei, uebernehmen, zuweisen, laden, zielWahl })
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>{{ $t("⌗ GPC") }}</h1><span class="grow" />
      <span :class="fehler ? 'fehler' : 'muted'">{{ fehler ? '✗ ' + fehler : busy }}</span></div>
    <table class="grid form"><colgroup><col style="width:96px" /><col /></colgroup><tbody>
      <tr class="step"><td colspan="2" class="step-band" style="display:table-cell;height:24px">{{ $t("1 · Veröffentlichung") }}</td></tr>
      <tr><td class="attr">{{ $t("Stand") }}</td><td>
        <span v-if="release" :title="$t('Sprachen: {0}', [(release.languages ?? []).join(', ')])">{{ release.version }} · {{ release.date }} · {{ $t("{0} Bricks", [bricks.length]) }}</span>
        <span v-else class="muted">{{ $t("nichts übernommen") }}</span>
      </td></tr>
      <tr v-if="release && !dateiOffen && !gelesen"><td class="attr"></td><td>
        <button :title="$t('Die Veröffentlichung ist übernommen; eine Datei braucht es nur für eine weitere Fassung oder Sprache')" @click="dateiOffen = true">{{ $t("Weitere Fassung oder Sprache …") }}</button>
      </td></tr>
      <tr v-else><td class="attr">{{ $t("Datei") }}</td><td>
        <label class="drop" :class="{ over: dragOver }" @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="abgelegt"
          :title="$t('GPC-Paket (.zip) oder die .json darin; holen unter gpc-browser.gs1.org')">
          <input type="file" accept=".zip,.json" style="display:none" @change="gewaehlt" />{{ $t("Datei wählen oder hierher ziehen") }}
        </label>
        <span v-if="gelesen" style="margin-left:8px">{{ gelesen.meta.version }} · {{ gelesen.meta.language.toUpperCase() }} · {{ $t("{0} Bricks", [gelesen.meta.counts.bricks]) }}
          <span v-if="vorhaben?.neu.length" :title="$t('Nur Datensätze, die im Journal fehlen oder anders sind, werden geschrieben')">· {{ $t("{0} von {1} Datensätzen neu oder geändert", [vorhaben.neu.length, vorhaben.alle]) }}</span>
          <span v-else class="pos">· {{ $t("schon im Journal") }}</span>
          <button class="primary" :disabled="!!busy || !vorhaben?.neu.length" @click="uebernehmen">{{ $t("übernehmen") }}</button></span>
      </td></tr>
      <tr class="step"><td colspan="2" class="step-band" style="display:table-cell;height:24px">{{ $t("2 · Klasse zuweisen") }}</td></tr>
      <tr><td class="attr">{{ $t("Suche") }}</td><td>
        <input v-model="suche" type="text" :placeholder="$t('Code, Titel oder Weg')" :disabled="!hatDaten" style="width:100%" />
      </td></tr>
      <tr v-if="treffer.length"><td class="attr"></td><td>
        <div class="picker" style="max-height:240px;overflow:auto">
          <div v-for="b in treffer" :key="b.code" class="pick" :class="{ current: gewaehlterBrick?.code === b.code }" :title="weg(b)" @click="gewaehlterBrick = b">
            <span class="mono muted">{{ b.code }}</span> {{ brickTitel(b) }} <span class="muted">· {{ weg(b) }}</span>
          </div>
        </div>
      </td></tr>
      <tr v-if="gewaehlterBrick"><td class="attr">{{ $t("Brick") }}</td><td>
        <b>{{ gewaehlterBrick.code }} {{ brickTitel(gewaehlterBrick) }}</b>
        <div class="muted" style="font-size:12px;white-space:normal">{{ brickText(gewaehlterBrick, locale)[1] }}</div>
        <div v-if="brickText(gewaehlterBrick, locale)[2]" class="muted" style="font-size:12px;white-space:normal">{{ brickText(gewaehlterBrick, locale)[2] }}</div>
        <div class="chips" style="margin-top:4px"><span v-for="[ac, vs] in gewaehlterBrick.a" :key="ac" class="chip" :title="$t('{0} Werte', [vs.length])">{{ attributName(ac) }} · {{ vs.length }}</span>
          <span v-if="!gewaehlterBrick.a.length" class="muted">{{ $t("keine Attribute") }}</span></div>
      </td></tr>
      <tr><td class="attr">{{ $t("Knoten") }}</td><td>
        <div class="chips" style="margin:2px 0 4px"><span v-if="zielZeile" class="chip">{{ icon(zielZeile.role) }} {{ zielZeile.label }}</span>
          <span v-else class="muted">{{ $t("Knoten wählen") }}</span>
          <span v-if="aktuell" class="muted" :title="aktuell.geerbt ? $t('geerbt von {0}', [aktuell.von]) : $t('eigene Klasse')">{{ aktuell.code }}{{ brickVon(aktuell.code) ? ' ' + brickTitel(brickVon(aktuell.code)) : '' }}{{ aktuell.geerbt ? ' ↑' : '' }}</span></div>
        <TreePicker :model-value="ziel" :roles="['group', 'product', 'variant']" :height="200" @update:model-value="zielWahl" />
      </td></tr>
      <tr><td class="attr"></td><td>
        <button class="primary" :disabled="!gewaehlterBrick || !ziel || !!busy" :title="$t('Gruppe, Klassenattribut und Attribute anlegen, Klasse am Knoten setzen')" @click="zuweisen">{{ $t("✓ zuweisen") }}</button>
      </td></tr>
    </tbody></table>
  </div>
</template>

<style scoped>
.form { width: 100%; border-bottom: 1px solid var(--line); }
.form td { vertical-align: middle; white-space: normal; padding: 3px 4px; }
.form td.attr { color: var(--muted); white-space: nowrap; padding-left: 8px; vertical-align: top; }
.drop { display: inline-block; padding: 2px 10px; border: 1px dashed var(--line); border-radius: 6px; cursor: pointer; }
.drop.over { outline: 2px dashed var(--accent); outline-offset: -2px; }
.pick { cursor: pointer; padding: 1px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pick:hover { background: var(--hover); }
.pick.current { background: var(--accent-soft); }
</style>
