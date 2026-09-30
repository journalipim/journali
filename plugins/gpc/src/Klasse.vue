<script setup>
// GPC-Klasse wählen und einem Knoten zuweisen — als Dialog am Knoten (Band, Kontextmenü) und als Seite unter ⌗ Klassifikation.
// Oben die Veröffentlichung (was im Journal steht, die zuletzt gewählten Dateien, eine weitere einlesen), darunter gleich die
// Klassifikation: Umfeld, KI-Vorschlag, Suche und das Durchsehen von Segment bis Brick. Was im Modell anzulegen ist (Gruppe, Klassenattribut,
// ein Listenattribut je GPC-Attribut), macht der Server (/api/classification) — hier steht nur, was GPC ausmacht. Nichts von GPC liegt im
// Repo: die Datei holt der Anwender bei GS1, und was davon im Journal steht, liest nur noch das Journal.
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { api, store, tree, icon, ai, recentFiles, TreePicker, t as t_ } from 'journali'
import {
  isZip, jsonInZip, inflateInBrowser, parseGpc, toRecords, searchBricks, brickText, pathText, titleOf,
  featureSpecs, classesByAttribute, classSpec, systemSpec,
} from '../core.mjs'
import { schluessel, klasseAm } from './klasse.js'

const props = defineProps({ node: { type: String, default: '' }, modal: Boolean })
const emit = defineEmits(['close', 'done'])
const locale = computed(() => store.model?.masterLocale ?? 'de')
const busy = ref('')
const fehler = ref('')
const dragOver = ref(false)
const RECENT = 'gpc'

// Was im Journal liegt
const release = ref(null)          // { version, date, languages, counts }
const dict = ref({ attributes: {}, values: {}, hierarchy: {} })
const bricks = ref([])
const settings = ref({})
const gespeichert = ref({})        // die Datensätze, wie sie im Journal stehen — zum Vergleichen
// Was gerade gelesen wurde und noch nicht übernommen ist
const gelesen = ref(null)
const vorhaben = ref(null)         // { alle, neu }: was die gelesene Datei ergibt und davon, was im Journal anders ist
const quelleOffen = ref(false)     // mit übernommenen Daten braucht es die Datei nur für eine weitere Fassung oder Sprache
const recent = ref([])

const byAttr = computed(() => classesByAttribute(bricks.value))
const hatDaten = computed(() => bricks.value.length > 0)
const schl = computed(() => schluessel(settings.value))

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

// ---- Die Veröffentlichung: zuletzt gewählte Dateien, eine Datei lesen, das Neue übernehmen
async function merken() { try { recent.value = await recentFiles.list(RECENT) } catch { recent.value = [] } }
async function datei(file, handle = null) {
  fehler.value = ''; gelesen.value = null
  busy.value = t_('lese {0} …', [file.name])
  try {
    let buf = new Uint8Array(await file.arrayBuffer())
    if (isZip(buf)) buf = await inflateInBrowser(jsonInZip(buf))
    gelesen.value = parseGpc(new TextDecoder().decode(buf))
    vorhaben.value = vergleichen(gelesen.value)
    recentFiles.remember(RECENT, file.name, handle).then(merken).catch(() => {})
  } catch (e) { fehler.value = e.message } finally { busy.value = '' }
}
const canPick = typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'
/// Mit dem Dateidialog des Browsers (Chrome, Edge) bleibt ein Verweis auf die Datei, und sie lässt sich aus der Liste wieder öffnen
async function waehlen(e) {
  if (!canPick) return   // sonst das <input type=file> im Label
  e.preventDefault()
  try {
    const [h] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'GPC', accept: { 'application/octet-stream': ['.zip', '.json'] } }] })
    await datei(await h.getFile(), h)
  } catch (err) { if (err?.name !== 'AbortError') fehler.value = err.message }
}
function gewaehlt(e) { const f = e.target.files?.[0]; if (f) datei(f); e.target.value = '' }
function abgelegt(e) { dragOver.value = false; const f = e.dataTransfer?.files?.[0]; if (f) datei(f) }
async function wiederOeffnen(r) {
  const f = await recentFiles.reopen(r)
  if (!f) { store.toast(r.handle ? t_('{0}: nicht mehr lesbar — neu wählen', [r.name]) : t_('{0}: war hineingezogen — wieder ziehen oder wählen', [r.name])); return }
  await datei(f, r.handle)
}

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
    gelesen.value = null; vorhaben.value = null; quelleOffen.value = false
    await laden()
    store.toast(t_('✓ {0} Bricks übernommen', [bricks.value.length]), 'ok')
  } catch (e) { fehler.value = e.message; busy.value = '' }
}

// ---- Knoten und die Klasse, die dort gilt
const ziel = ref(props.node || '')
const zielWahlOffen = ref(!props.node && !props.modal)
const zielZeile = computed(() => ziel.value ? tree.byId?.get(ziel.value) ?? null : null)
const weg = computed(() => zielZeile.value ? (tree.ancestors?.(zielZeile.value.id) ?? []).map(a => a.label) : [])
const aktuell = ref(null)   // { code, geerbt, von }

async function zielLesen() {
  aktuell.value = null
  if (!ziel.value) return
  try {
    const k = await klasseAm(api, ziel.value, schl.value.classAttr)
    if (k.code) aktuell.value = { code: k.code, geerbt: k.geerbt, von: k.von }
  } catch { /* das Ziel ist neu oder gelöscht */ }
}
function zielWahl(id) { ziel.value = id || ''; zielWahlOffen.value = false; zielLesen(); umfeldLesen(); ki.value = null }

const brickTitel = b => brickText(b, locale.value)[0]
const wegText = b => pathText(b, dict.value.hierarchy, locale.value)
const attributName = ac => titleOf(dict.value.attributes?.[ac], locale.value)
const brickVon = code => bricks.value.find(b => b.code === code)
const brickZeile = code => { const b = brickVon(code); return b ? `${code} ${brickTitel(b)}` : code }

// ---- Umfeld: welche Klasse Geschwister und Knoten darunter schon haben
const umfeld = ref([])
async function umfeldLesen() {
  umfeld.value = []
  const row = zielZeile.value
  if (!row || !hatDaten.value) return
  const key = schl.value.classAttr, zaehle = new Map()
  const lies = async url => {
    try {
      const t = await api.get(url)
      for (const r of t.rows ?? []) { const c = String(r.values?.[key]?.value ?? '').trim(); if (c && r.row?.id !== row.id) zaehle.set(c, (zaehle.get(c) ?? 0) + 1) }
    } catch { /* ohne Klassenattribut gibt es kein Umfeld */ }
  }
  if (row.parent) await lies(`/api/nodes/${encodeURIComponent(row.parent)}/table?attributes=${encodeURIComponent(key)}`)
  await lies(`/api/nodes/${encodeURIComponent(row.id)}/table?deep=true&attributes=${encodeURIComponent(key)}`)
  umfeld.value = [...zaehle].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([code, n]) => ({ code, n }))
}

// ---- KI-Vorschlag: erst die Familie, dann der Brick — das Gespräch bleibt klein
const kiBereit = computed(() => !!ai?.available?.())
const ki = ref(null)   // { busy, familien, liste, fehler }
async function kiFragen() {
  const row = zielZeile.value
  if (!row || !hatDaten.value) return
  ki.value = { busy: true, liste: [] }
  try {
    const h = dict.value.hierarchy
    const famText = b => `${titleOf(h[b.path[0]], 'en')} › ${titleOf(h[b.path[1]], 'en')}`
    const familien = [...new Set(bricks.value.map(famText))].sort()
    const produkt = `Produkt: ${row.label}\nPfad: ${weg.value.join(' › ')}`
    const g = await ai.ask({
      system: t_('Du ordnest Produkte GPC-Familien zu. Antworte nur als JSON {"familien":["…","…"]} mit 1 bis 3 Namen exakt aus der Liste.'),
      user: `${produkt}\nFamilien:\n${familien.join('\n')}`, json: true, maxTokens: 200, purpose: t_('Klassifikation'),
    })
    const gewaehlt = (g.familien ?? []).filter(x => familien.includes(x))
    if (!gewaehlt.length) throw new Error(t_('keine Familie erkannt'))
    const kand = bricks.value.filter(b => gewaehlt.includes(famText(b)) && b.active !== false)
    const liste = kand.map(b => `${b.code} ${brickText(b, 'en')[0]}`).join('\n')
    const j = await ai.ask({
      system: t_('Du ordnest ein Produkt genau einem GPC-Brick zu. Antworte nur als JSON {"vorschlaege":[{"code":"…","warum":"…"}]} mit 1 bis 3 Vorschlägen, Codes exakt aus der Liste, bester zuerst, warum in einem kurzen Satz auf Deutsch.'),
      user: `${produkt}\nBricks:\n${liste}`, json: true, maxTokens: 400, purpose: t_('Klassifikation'),
    })
    const aus = (j.vorschlaege ?? []).map(s => ({ code: String(s.code), warum: s.warum ?? '' })).filter(s => kand.some(b => b.code === s.code))
    ki.value = { busy: false, familien: gewaehlt, liste: aus }
  } catch (e) { ki.value = { busy: false, liste: [], fehler: e.message } }
}

// ---- Suchen und durchsehen
const suche = ref('')
const treffer = computed(() => searchBricks(bricks.value, dict.value.hierarchy, suche.value, locale.value))
const gewaehlterBrick = ref(null)
const offen = ref({})
const umschalten = code => { offen.value = { ...offen.value, [code]: !offen.value[code] } }
const titel = code => titleOf(dict.value.hierarchy?.[code], locale.value)
/// Segment › Family › Class › Brick mit der Zahl der Bricks darunter; nur stillgelegte Bricks fehlen
const baum = computed(() => {
  const segs = new Map()
  for (const b of bricks.value) {
    if (b.active === false) continue
    const [s, f, c] = b.path
    const S = segs.get(s) ?? segs.set(s, { code: s, count: 0, fam: new Map() }).get(s)
    const F = S.fam.get(f) ?? S.fam.set(f, { code: f, count: 0, cls: new Map() }).get(f)
    const C = F.cls.get(c) ?? F.cls.set(c, { code: c, count: 0, bricks: [] }).get(c)
    S.count++; F.count++; C.count++; C.bricks.push(b)
  }
  const sort = (arr, name) => arr.sort((a, b) => name(a).localeCompare(name(b)))
  return sort([...segs.values()], x => titel(x.code)).map(S => ({
    ...S, fam: sort([...S.fam.values()], x => titel(x.code)).map(F => ({
      ...F, cls: sort([...F.cls.values()], x => titel(x.code)).map(C => ({ ...C, bricks: sort(C.bricks, brickTitel) })),
    })),
  }))
})

// ---- Bestand der früheren Bauart (eine Sammelgruppe, Attribute mit Bedingung) auf Klassengruppen umstellen
const umstellung = ref(null)   // { groups, attributes, nodes } — nur, wenn es etwas umzustellen gibt
async function umstellungPruefen() {
  try { const r = await api.post('/api/classification/migrate', { system: systemSpec(settings.value), dryRun: true }); umstellung.value = r?.attributes || r?.nodes ? r : null } catch { umstellung.value = null }
}
async function umstellen() {
  busy.value = t_('stelle um …'); fehler.value = ''
  try {
    const r = await api.post('/api/classification/migrate', { system: systemSpec(settings.value), dryRun: false })
    await store.poll?.(true); await tree.load?.(true)
    store.toast(t_('✓ {0} Gruppen, {1} Attribute, {2} Knoten umgestellt', [r.groups, r.attributes, r.nodes]), 'ok')
    umstellung.value = null; await zielLesen()
  } catch (e) { fehler.value = e.message } finally { busy.value = '' }
}

// ---- Zuweisen
/// Die Klassen, die dem Server mitgehen: die in der Werteliste noch fehlen — alle, wenn es die Liste oder ihre Spalte „group“ nicht gibt
function klassenFuer(brick) {
  const key = schl.value.classAttr
  const list = (store.model?.lists ?? []).find(l => l.key === key)
  const a = (store.model?.attributes ?? []).find(x => x.key === key)
  const fremd = a && !(a.group === schl.value.group || (a.type === 'enum' && a.list === key))
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
    const rd = r.readiness, name = zielZeile.value?.label ?? ziel.value
    store.toast(rd.ready ? t_('✓ {0} an {1}', [b.code, name])
      : t_('⚠ {0} an {1}: {2}', [b.code, name, !rd.groupExists ? t_('Gruppe fehlt') : !rd.groupOn ? t_('Gruppe gilt hier nicht') : t_('{0} ohne Attribut', [rd.missing.length])]), rd.ready ? 'ok' : 'error')
    await zielLesen()
    emit('done', b.code)
    if (props.modal) emit('close')
  } catch (e) { fehler.value = e.message } finally { busy.value = '' }
}

// das Umfeld gibt es erst, wenn Bricks da sind — etwa nach dem Übernehmen
watch(hatDaten, v => { if (v) umfeldLesen() })
const onKey = e => { if (props.modal && e.key === 'Escape') { e.stopPropagation(); emit('close') } }
onMounted(async () => {
  document.addEventListener('keydown', onKey, true)
  if (!tree.loaded) await tree.load?.()
  await Promise.all([laden(), merken()])
  quelleOffen.value = !hatDaten.value
  await zielLesen(); await umfeldLesen(); await umstellungPruefen()
})
onUnmounted(() => document.removeEventListener('keydown', onKey, true))
defineExpose({ umstellung, umstellen, release, bricks, dict, gelesen, vorhaben, quelleOffen, suche, treffer, gewaehlterBrick, ziel, aktuell, umfeld, ki, baum, recent, datei, uebernehmen, zuweisen, laden, zielWahl, kiFragen, umschalten, wiederOeffnen })
</script>

<template>
  <div class="klasse" :class="{ modal }">
    <div class="toolbar kopf"><b>{{ $t("⌗ GPC-Klasse") }}<template v-if="zielZeile"> · {{ icon(zielZeile.role) }} {{ zielZeile.label }}</template></b>
      <span class="muted" style="font-size:12px">{{ weg.join(' › ') }}</span><span class="grow" />
      <span :class="fehler ? 'fehler' : 'muted'" style="font-size:12px">{{ fehler ? '✗ ' + fehler : busy }}</span>
      <button v-if="modal" class="x" :title="$t('schliessen (Esc)')" @click="emit('close')">✕</button></div>
    <div class="scroll koerper">
      <div class="zeile"><span class="attr">{{ $t("Version") }}</span>
        <select v-if="release" :title="$t('Sprachen: {0}', [(release.languages ?? []).join(', ')])">
          <option>{{ release.version }} · {{ release.date }} · {{ $t("{0} Bricks", [bricks.length]) }}</option></select>
        <span v-else class="muted">{{ $t("nichts übernommen") }}</span>
        <button :class="{ on: quelleOffen }" :title="$t('Die Veröffentlichung ist übernommen; eine Datei braucht es nur für eine weitere Fassung oder Sprache')" @click="quelleOffen = !quelleOffen">⌗ GPC …</button>
      </div>
      <div v-if="umstellung" class="zeile"><span class="attr" /><span class="warn" :title="$t('Die Attribute kommen in die Gruppen ihrer Klassen, die Bedingung entfällt, und jeder Knoten mit einer Klasse bekommt deren Gruppe')">⚠ {{ $t("{0} Attribute und {1} Knoten in der früheren Bauart", [umstellung.attributes, umstellung.nodes]) }}</span>
        <button class="primary" :disabled="!!busy" @click="umstellen">{{ $t("auf Klassengruppen umstellen") }}</button></div>
      <div v-if="quelleOffen" class="zeile quelle">
        <span class="attr">{{ $t("Datei") }}</span>
        <span v-if="recent.length" class="recent" :title="$t('zuletzt gewählt — Klick öffnet wieder (Chrome/Edge fragt einmal nach Leserecht)')">
          <span v-for="r in recent" :key="r.name" class="chip" :class="{ dim: !r.handle }" :title="r.handle ? $t('{0} — wieder öffnen', [r.name]) : $t('{0} — war hineingezogen, kein Zugriff: wieder ziehen', [r.name])" @click="wiederOeffnen(r)">{{ r.name }}</span></span>
        <label class="drop" :class="{ over: dragOver }" @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop.prevent="abgelegt" @click="waehlen"
          :title="$t('GPC-Paket (.zip) oder die .json darin; holen unter gpc-browser.gs1.org')">
          <input type="file" accept=".zip,.json" style="display:none" @change="gewaehlt" />{{ $t("Datei wählen oder hierher ziehen") }}
        </label>
        <span v-if="gelesen">{{ gelesen.meta.version }} · {{ gelesen.meta.language.toUpperCase() }} · {{ $t("{0} Bricks", [gelesen.meta.counts.bricks]) }}
          <span v-if="vorhaben?.neu.length" :title="$t('Nur Datensätze, die im Journal fehlen oder anders sind, werden geschrieben')">· {{ $t("{0} von {1} Datensätzen neu oder geändert", [vorhaben.neu.length, vorhaben.alle]) }}</span>
          <span v-else class="pos">· {{ $t("schon im Journal") }}</span>
          <button class="primary" :disabled="!!busy || !vorhaben?.neu.length" @click="uebernehmen">{{ $t("übernehmen") }}</button></span>
      </div>
      <div class="zeile"><span class="attr">{{ $t("Knoten") }}</span>
        <span v-if="zielZeile" class="chip">{{ icon(zielZeile.role) }} {{ zielZeile.label }}</span>
        <span v-else class="muted">{{ $t("Knoten wählen") }}</span>
        <button v-if="!modal" class="x" @click="zielWahlOffen = !zielWahlOffen">{{ $t("ändern") }}</button>
        <span v-if="aktuell" class="muted" :title="aktuell.geerbt ? $t('geerbt von {0}', [aktuell.von]) : $t('eigene Klasse')">{{ $t("gilt hier") }}: {{ brickZeile(aktuell.code) }}{{ aktuell.geerbt ? ' ↑' : '' }}</span>
        <span v-else-if="zielZeile" class="muted">{{ $t("hier gilt noch keine Klasse") }}</span>
      </div>
      <TreePicker v-if="zielWahlOffen" :model-value="ziel" :roles="['group', 'product', 'variant']" :height="200" @update:model-value="zielWahl" />

      <template v-if="hatDaten">
        <div class="step-band">{{ $t("Empfehlung") }}<span class="grow" />
          <button v-if="kiBereit" class="x ai" :disabled="!zielZeile || ki?.busy" :title="$t('die KI nach passenden Bricks fragen ({0}) — kostet Token', [ai.label?.()])" @click="kiFragen">{{ $t("✦ KI fragen") }}</button></div>
        <div v-for="u in umfeld" :key="u.code" class="pick" :title="$t('{0} Knoten in der Nähe haben diese Klasse', [u.n])" @click="gewaehlterBrick = brickVon(u.code) ?? gewaehlterBrick">
          <span class="mono muted">{{ u.code }}</span> {{ brickVon(u.code) ? brickTitel(brickVon(u.code)) : '' }} <span class="muted">· {{ $t("{0} im Umfeld", [u.n]) }}</span></div>
        <div v-if="!umfeld.length && zielZeile" class="muted kl">{{ $t("Im Umfeld ist noch keine Klasse gesetzt.") }}</div>
        <div v-if="ki?.busy" class="ai kl">✦ …</div>
        <div v-if="ki && !ki.busy" class="ai kl">✦ KI ({{ ai.label?.() }}){{ ki.familien ? ' — ' + ki.familien.join(', ') : '' }}<span v-if="ki.fehler"> · ✗ {{ ki.fehler }}</span></div>
        <div v-for="s in ki?.liste ?? []" :key="s.code" class="pick ai" @click="gewaehlterBrick = brickVon(s.code)">
          <span class="mono muted">{{ s.code }}</span> {{ brickVon(s.code) ? brickTitel(brickVon(s.code)) : '' }} <span class="muted">· {{ s.warum }}</span></div>
        <div v-if="ki && !ki.busy && !ki.fehler && !ki.liste.length" class="muted kl">{{ $t("kein Vorschlag") }}</div>

        <input v-model="suche" type="text" class="suche" :placeholder="$t('suchen in {0} Bricks — Code, Name, Weg', [bricks.length])" />
        <div v-if="suche.trim()" class="liste">
          <div v-for="b in treffer" :key="b.code" class="pick" :class="{ current: gewaehlterBrick?.code === b.code }" :title="wegText(b)" @click="gewaehlterBrick = b">
            <span class="mono muted">{{ b.code }}</span> {{ brickTitel(b) }} <span class="muted">· {{ wegText(b) }}</span></div>
          <div v-if="!treffer.length" class="muted kl">{{ $t("nichts gefunden") }}</div>
        </div>
        <div v-else class="liste baum">
          <div v-for="s in baum" :key="s.code">
            <div class="pick" @click="umschalten(s.code)"><span class="caret">{{ offen[s.code] ? '▾' : '▸' }}</span> {{ titel(s.code) }} <span class="muted">{{ s.count }}</span></div>
            <div v-if="offen[s.code]" class="ein"><div v-for="f in s.fam" :key="f.code">
              <div class="pick" @click="umschalten(f.code)"><span class="caret">{{ offen[f.code] ? '▾' : '▸' }}</span> {{ titel(f.code) }} <span class="muted">{{ f.count }}</span></div>
              <div v-if="offen[f.code]" class="ein"><div v-for="c in f.cls" :key="c.code">
                <div class="pick" @click="umschalten(c.code)"><span class="caret">{{ offen[c.code] ? '▾' : '▸' }}</span> {{ titel(c.code) }} <span class="muted">{{ c.count }}</span></div>
                <div v-if="offen[c.code]" class="ein"><div v-for="b in c.bricks" :key="b.code" class="pick" :class="{ current: gewaehlterBrick?.code === b.code }" @click="gewaehlterBrick = b">
                  <span class="mono muted">{{ b.code }}</span> {{ brickTitel(b) }}</div></div>
              </div></div>
            </div></div>
          </div>
        </div>
      </template>

      <div v-if="gewaehlterBrick" class="brick">
        <b>{{ gewaehlterBrick.code }} {{ brickTitel(gewaehlterBrick) }}</b><span class="muted" style="font-size:12px"> · {{ wegText(gewaehlterBrick) }}</span>
        <div class="muted" style="font-size:12px;white-space:normal">{{ brickText(gewaehlterBrick, locale)[1] }}</div>
        <div v-if="brickText(gewaehlterBrick, locale)[2]" class="muted" style="font-size:12px;white-space:normal">{{ brickText(gewaehlterBrick, locale)[2] }}</div>
        <div class="chips" style="margin-top:4px"><span v-for="[ac, vs] in gewaehlterBrick.a" :key="ac" class="chip" :title="$t('{0} Werte', [vs.length])">{{ attributName(ac) }} · {{ vs.length }}</span>
          <span v-if="!gewaehlterBrick.a.length" class="muted">{{ $t("keine Attribute") }}</span></div>
      </div>
    </div>
    <div class="toolbar fuss">
      <span class="muted" style="font-size:12px">{{ gewaehlterBrick ? $t("{0} an {1}", [gewaehlterBrick.code, zielZeile?.label ?? '—']) : $t("Brick wählen") }}</span><span class="grow" />
      <button v-if="modal" @click="emit('close')">{{ $t("abbrechen") }}</button>
      <button class="primary" :disabled="!gewaehlterBrick || !ziel || !!busy" :title="$t('Gruppe, Klassenattribut und Attribute anlegen, Klasse am Knoten setzen')" @click="zuweisen">{{ $t("✓ zuweisen") }}</button>
    </div>
  </div>
</template>

<style scoped>
.klasse { display: flex; flex-direction: column; flex: 1; min-height: 0; font-size: 13px; }
.klasse.modal { width: min(820px, 94vw); max-height: 88vh; background: var(--pane); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 12px 32px rgba(0,0,0,.4); }
.kopf, .fuss { padding: 8px 12px; }
.fuss { border-top: 1px solid var(--line); }
.koerper { padding: 8px 12px; flex: 1; }
.zeile { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 3px 0; }
.attr { color: var(--muted); min-width: 64px; }
.kl { font-size: 12px; padding: 2px 0; }
.drop { display: inline-block; padding: 2px 10px; border: 1px dashed var(--line); border-radius: 6px; cursor: pointer; }
.drop.over { outline: 2px dashed var(--accent); outline-offset: -2px; }
.recent { display: inline-flex; gap: 4px; flex-wrap: wrap; }
.recent .chip { cursor: pointer; }
.recent .chip.dim { opacity: .55; cursor: default; }
button.on { background: var(--accent-soft); }
.suche { width: 100%; margin: 6px 0; box-sizing: border-box; }
.liste { max-height: 300px; overflow: auto; border: 1px solid var(--line); border-radius: 6px; }
.pick { cursor: pointer; padding: 1px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pick:hover { background: var(--hover); }
.pick.current { background: var(--accent-soft); }
.ein { padding-left: 16px; }
.caret { display: inline-block; width: 14px; color: var(--muted); }
.brick { margin-top: 8px; padding: 6px 8px; border: 1px solid var(--accent); border-radius: 6px; }
</style>
