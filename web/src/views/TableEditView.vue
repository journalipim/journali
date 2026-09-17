<script setup>
// Massenbearbeitung wie in Excel (Taloan, 17.09.2026): die Kinder eines Knotens — oder alle Nachfahren einer Rolle —
// als Zeilen, Attribute als Spalten; Zellen wie in der Knotenansicht, Änderungen sammeln sich (gelb) und gehen als
// ein Stapel ins Journal. Einfügen aus Excel (Tab-getrennt) füllt ab der markierten Zelle nach rechts und unten.
// Quelle: GET /api/nodes/{id}/table — Werte aufgelöst (geerbt kursiv), eigene Werte kennt der Server (own).
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../api.js'
import { store } from '../store.js'
import { tree, icon } from '../tree.js'
import Cell from '../components/Cell.vue'
import ToggleCell from '../components/ToggleCell.vue'
import SelectCell from '../components/SelectCell.vue'
import DateCell from '../components/DateCell.vue'
import HtmlCell from '../components/HtmlCell.vue'

const props = defineProps({ id: String, role: String, deep: String })
const router = useRouter()
// Eigenes Fenster (Taloan, 17.09.): Schliessen übernimmt die Änderungen — ohne Nachfrage, ohne Speichern-Knopf drücken
const popup = !!useRoute().query.popup
const model = computed(() => store.model)
const locales = computed(() => model.value?.locales.map(l => l.code) ?? [])
const locale = ref(store.viewLocales?.[0] ?? 'de')
const data = ref(null)          // { node, columns, rows }
const busy = ref('')
const dirty = ref(new Map())    // `${id}|${attr}` → neuer Wert ('' = eigenen Wert löschen)
const viewKey = ref('')
const filter = ref('')
const roleLabel = { group: 'Gruppen', product: 'Produkte', variant: 'Varianten' }
const childRole = computed(() => props.role || (data.value?.rows[0]?.row.role ?? (data.value?.node.role === 'product' ? 'variant' : 'product')))
const views = computed(() => (model.value?.views ?? []).filter(v => v.level === childRole.value))

async function load() {
  busy.value = 'lade …'
  try {
    const q = new URLSearchParams({ locale: locale.value })
    if (props.role) q.set('role', props.role)
    if (props.deep === '1') q.set('deep', 'true')
    data.value = await api.get(`/api/nodes/${encodeURIComponent(props.id)}/table?${q}`)
    dirty.value = new Map()
    if (popup) document.title = `⊞ ${data.value.node.label} · journali`
  } catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
watch(() => [props.id, props.role, props.deep], load)
watch(locale, load)
onMounted(async () => { if (!tree.loaded) await tree.load(); load() })

// Spalten: nach Sicht geordnet (und beschränkt), sonst alle in Gruppenreihenfolge des Modells; Achsen der Variante sind fest
// Feste Spalten sind virtuelle Spalten in derselben Liste (Taloan: ★-Spalte links fest, je Zeile ihr eigenes Attribut):
// #label = die Zelle des ★-Attributs der Zeile (bearbeitbar), #sku und #axes nur lesend. Ein Attribut, das ALLE Zeilen
// benennt, steht rechts nicht noch einmal.
const VIRTUAL = [
  { key: '#label', virtual: 'label', type: 'text', label: { de: '★' } },
  { key: '#sku', virtual: 'sku', type: 'text', label: { de: 'SKU' } },
  { key: '#axes', virtual: 'axes', type: 'text', label: { de: 'Achsen' } },
]
// Kein ★ (auch kein geerbtes) und kein fixierter Name: die erste Spalte (Taloan)
const labelKeyOf = r => r.row.labelAttribute ?? (r.row.name ? null : baseColumns.value[0]?.key ?? null)
const labelCol = r => { const k = labelKeyOf(r); return k ? data.value?.columns.find(c => c.key === k) ?? null : null }
const commonDef = computed(() => commonLabel.value ? data.value?.columns.find(x => x.key === commonLabel.value) : null)
const headText = c => c.virtual === 'label' ? '★ ' + (commonDef.value ? (commonDef.value.label?.de || commonDef.value.key) : roleLabel[childRole.value]) : (c.label?.de || c.key)
const headLocale = c => c.perLocale || (c.virtual === 'label' && commonDef.value?.perLocale)
const headTitle = c => c.virtual === 'label'
  ? (commonDef.value ? `★ ${commonDef.value.label?.de || commonDef.value.key} benennt alle Zeilen — hier bearbeiten` : 'je Zeile ihr ★-Attribut (Tooltip an der Zelle); fixierte Namen sind fest')
  : c.virtual ? 'fest' : `${c.key} · ${c.type}${c.perLocale ? ' · je Sprache' : ''}${c.unit ? ' · ' + c.unit : ''}`
// Die wirkliche Spalte hinter einer Zelle: bei #label das ★-Attribut der Zeile
const eff = (r, c) => c.virtual === 'label' ? labelCol(r) : c
const commonLabel = computed(() => { const keys = new Set((data.value?.rows ?? []).map(labelKeyOf)); return keys.size === 1 && !keys.has(null) ? [...keys][0] : null })
const columns = computed(() => [...VIRTUAL, ...attrColumns.value])
const attrColumns = computed(() => baseColumns.value.filter(c => c.key !== commonLabel.value))
const baseColumns = computed(() => {
  if (!data.value) return []
  const all = data.value.columns
  const v = views.value.find(x => x.key === viewKey.value)
  if (!v) return all
  const order = v.items.flatMap(it => it.order ?? [])
  const groupsOf = new Map((model.value?.groups ?? []).map(g => [g.key, g.attributes]))
  const wanted = new Set([...order, ...v.items.flatMap(it => it.group ? groupsOf.get(it.group) ?? [] : [])])
  return all.filter(c => wanted.has(c.key)).sort((a, b) => (order.indexOf(a.key) + 1 || 999) - (order.indexOf(b.key) + 1 || 999))
})
const editable = c => !c.virtual && !['rows', 'formula'].includes(c.type)   // html: eigener Editor (HtmlCell); virtuelle: siehe canWrite
const rows = computed(() => {
  if (!data.value) return []
  const q = filter.value.trim().toLowerCase()
  if (!q) return data.value.rows
  return data.value.rows.filter(r => r.row.label.toLowerCase().includes(q) || (r.row.sku ?? '').toLowerCase().includes(q) || Object.values(r.values).some(v => String(v.value ?? '').toLowerCase().includes(q)))
})
const key = (r, c) => `${r.row.id}|${eff(r, c)?.key ?? c.key}`
const shown = (r, c0) => { const c = eff(r, c0); if (!c) return null; return dirty.value.has(key(r, c)) ? (dirty.value.get(key(r, c)) || null) : (r.values[c.key]?.own ? r.values[c.key].value : null) }
const inherited = (r, c0) => { const c = eff(r, c0); if (!c) return c0.virtual === 'label' ? r.row.label : null; if (c.virtual === 'sku') return r.row.sku ?? null; if (c.virtual === 'axes') return Object.values(r.row.axisValues ?? {}).join(' · ') || null; return r.values[c.key]?.own ? null : r.values[c.key]?.value ?? null }
const isAxis = (r, c) => r.row.role === 'variant' && (tree.byId.get(r.row.parent)?.axes ?? []).includes(c.key)
function set(r, c0, v) {
  const c = eff(r, c0); if (!c || c.virtual) return
  const k = key(r, c); const cur = r.values[c.key]?.own ? r.values[c.key].value : null
  const val = v == null ? '' : String(v)
  const m = new Map(dirty.value)
  if ((val || null) === cur) m.delete(k); else m.set(k, val)
  dirty.value = m
}
async function save() {
  if (!dirty.value.size) return
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  busy.value = `schreibe ${dirty.value.size} …`
  try {
    const commands = commandsOf()
    const res = await api.post('/api/batch', { commands, batch: 'tab-' + Date.now().toString(36) })
    if (res.error) store.toast(`✗ ${res.error.message} — ${res.results.length} geschrieben`)
    else store.toast(`✓ ${res.results.length} Werte geschrieben`)
    await store.poll(true); await load()
  } catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
function discard() { dirty.value = new Map() }
function commandsOf() {
  const defs = new Map(data.value.columns.map(c => [c.key, c]))
  return [...dirty.value].map(([k, v]) => { const [node, attribute] = k.split('|'); const d = defs.get(attribute); return { op: 'attribute.set', args: { node, attribute, locale: d?.perLocale ? locale.value : null, value: v } } })
}
// Fenster zu (X, Alt+F4): was noch offen ist, geht jetzt — keepalive überlebt das Schliessen (bis ~64 KB Stapel)
function onPageHide() {
  if (!popup || !dirty.value.size || !store.actor) return
  fetch(store.server + '/api/batch', { method: 'POST', keepalive: true, headers: { 'X-Actor': store.actor, 'Content-Type': 'application/json' }, body: JSON.stringify({ commands: commandsOf(), batch: 'tab-' + Date.now().toString(36) }) })
  dirty.value = new Map()
}
async function applyAndClose() { await save(); if (!dirty.value.size) window.close() }
function discardAndClose() { discard(); window.close() }

// Einfügen aus Excel: Tab-getrennt, Zeilen mit Umbruch — ab der markierten Zelle nach rechts (nur bearbeitbare Spalten) und unten
function onPaste(e) {
  const td = document.activeElement?.closest?.('td.cell'); if (!td) return
  const text = e.clipboardData?.getData('text/plain'); if (!text || !text.includes('\t') && !text.includes('\n')) return
  e.preventDefault()
  const tr = td.parentElement; const ri = rows.value.findIndex(r => r.row.id === tr.dataset.id); const ci = [...tr.children].indexOf(td) - FIXED
  if (ri < 0 || ci < 0) return
  const lines = text.replace(/\r/g, '').split('\n').filter((l, i, a) => l !== '' || i < a.length - 1)
  // Spaltenlage bleibt wie in Excel (Taloan): gesperrte Zellen werden ausgelassen, nicht übersprungen
  let n = 0, locked = 0, bad = 0
  lines.forEach((line, dy) => {
    const r = rows.value[ri + dy]; if (!r) return
    line.split('\t').forEach((v, dx) => { const c = columns.value[ci + dx]; if (!c) return; const w = write(r, c, v); if (w === 'locked') locked++; else if (w === 'bad') bad++; else n++ })
  })
  store.toast(`${n} Zellen eingefügt${locked ? `, ${locked} gesperrt` : ''}${bad ? `, ${bad} nicht in der Liste` : ''} — noch nicht gespeichert`)
}
const FIXED = 0   // alle Spalten in einer Liste (virtuelle voran), td-Index = Spaltenindex
// Spaltenbreite wie Excel-Autofit (Taloan: „viel zu breit“): längster sichtbarer Wert oder Kopf, 70–260 px; am Kopfrand ziehbar
const widths = ref({})   // key → px (von Hand gezogen)
// gemessen, nicht geschätzt (Taloan: „0537…“ bei sechs Zeichen): Textbreite im Zellfont + Innenabstand der Box
const measure = (() => { let ctx = null; return (s, font) => { ctx ??= document.createElement('canvas').getContext('2d'); ctx.font = font; return ctx.measureText(s).width } })()
const autoWidth = computed(() => {
  const out = {}
  const font = scrollBox.value ? getComputedStyle(scrollBox.value).font : '13px system-ui'
  const pad = 30   // Zellrand, Innenabstand, Zeilenrand — und etwas Luft, damit nie „…“ am Ende steht
  for (const c of columns.value) {
    let w = measure((c.label?.de || c.key) + (c.perLocale ? ' ' + locale.value : '') + (c.unit ? ' ' + c.unit : ''), 'bold ' + font)
    for (const r of rows.value.slice(0, 300)) { const v = c.type === 'enum' && !c.multiple ? labelOf(c)(textOf(r, c)) : textOf(r, c); if (v) w = Math.max(w, measure(String(v).replace(/<[^>]+>/g, '').slice(0, 60), font)) }
    out[c.key] = Math.ceil(Math.max(c.virtual === 'label' ? 140 : 60, Math.min(320, w + pad + (c.virtual === 'label' ? 20 : 0))))
  }
  return out
})
const colWidth = c => widths.value[c.key] ?? autoWidth.value[c.key] ?? 120
const tableWidth = computed(() => columns.value.reduce((s, c) => s + colWidth(c), 0))
function startResize(e, c) { e.preventDefault(); e.stopPropagation(); drag = { kind: 'resize', key: c.key, x: e.clientX, w: colWidth(c) } }

// ---- Bereich wie in Excel (Taloan): Klick = Anker, Shift+Klick = Rechteck, Strg+A = alles; Zeilen/Spalten als Indizes
// über die sichtbaren Zeilen und die Attributspalten (columns), Achsen und gesperrte Spalten werden beim Schreiben übersprungen.
const sel = ref(null)          // { r0, c0, r1, c1 } normalisiert
const anchor = ref(null)
const replaceOpen = ref(false)
const rep = ref({ find: '', with: '', all: false, caseSensitive: false, whole: false })
function cellAt(el) {
  const td = el?.closest?.('td.cell'); if (!td) return null
  const tr = td.parentElement; const ri = rows.value.findIndex(r => r.row.id === tr.dataset.id); const ci = [...tr.children].indexOf(td) - FIXED
  return ri < 0 || ci < 0 ? null : { ri, ci }
}
// Maus wie in Excel (Taloan): Drücken und Ziehen zieht den Bereich auf — kein Textmarkieren des Browsers;
// das Ausfüllkästchen (kleines Quadrat unten rechts am Bereich) zieht die Werte nach unten.
let drag = null   // { kind: 'select' | 'fill', base }
function onMouseDown(e) {
  if (e.button !== 0) return
  if (e.target.closest('.fill-handle')) { e.preventDefault(); drag = { kind: 'fill', base: { ...sel.value } }; return }
  const at = cellAt(e.target); if (!at) return
  if (e.target.closest('input, select, textarea')) return   // in der Eingabe: der Browser markiert Text
  e.preventDefault()
  setTimeout(() => focusCell(at.ri, at.ci), 0)
  if (e.shiftKey && anchor.value) sel.value = norm(anchor.value, at)
  else { anchor.value = at; sel.value = norm(at, at) }
  drag = { kind: 'select' }
}
function onMouseMove(e) {
  if (!drag) return
  if (drag.kind === 'resize') { widths.value = { ...widths.value, [drag.key]: Math.max(50, drag.w + e.clientX - drag.x) }; return }
  const at = cellAt(document.elementFromPoint(e.clientX, e.clientY)); if (!at) return
  if (drag.kind === 'select') sel.value = norm(anchor.value, at)
  else { const b = drag.base; sel.value = { r0: b.r0, c0: b.c0, c1: b.c1, r1: Math.max(b.r1, at.ri) } }
}
function onMouseUp() {
  if (drag?.kind === 'fill' && sel.value.r1 > drag.base.r1) fillFrom(drag.base)
  drag = null
}
// Ausfüllen aus dem Ursprungsbereich in die aufgezogenen Zeilen: ein Wert wird wiederholt, zwei Zahlen (oder Text
// mit Zahl am Ende) setzen die Reihe fort, mehrere Texte wiederholen sich im Muster
function fillFrom(base) {
  const s = sel.value; let n = 0
  const num = x => /^-?\d+([.,]\d+)?$/.test(String(x).trim()) ? parseFloat(String(x).replace(',', '.')) : null
  for (let ci = s.c0; ci <= s.c1; ci++) {
    const c = columns.value[ci]; if (!c) continue
    const src = []; for (let ri = base.r0; ri <= base.r1; ri++) src.push(textOf(rows.value[ri], c))
    const a = src[0], b = src[1]
    const tail = /^(.*?)(\d+)$/.exec(a)
    let gen
    if (src.length >= 2 && num(a) != null && num(b) != null) { const step = num(b) - num(a); const dec = Math.max((a.split(/[.,]/)[1] || '').length, (b.split(/[.,]/)[1] || '').length); gen = i => (num(a) + step * i).toFixed(dec).replace('.', a.includes(',') ? ',' : '.') }
    else if (src.length >= 2 && tail) { const w = tail[2].length; const start = parseInt(tail[2]); const t2 = /^(.*?)(\d+)$/.exec(b); const step = t2 && t2[1] === tail[1] ? parseInt(t2[2]) - start : 1; gen = i => tail[1] + String(start + step * i).padStart(w, '0') }
    else gen = i => src[i % src.length]
    for (let ri = base.r1 + 1; ri <= s.r1; ri++) { const r = rows.value[ri]; if (r && write(r, c, gen(ri - base.r0)) === 'ok') n++ }
  }
  if (n) store.toast(`${n} Zellen gefüllt — noch nicht gespeichert`)
}
// Lage des Ausfüllkästchens: unten rechts an der letzten Zelle des Bereichs, im Rollbereich mitrollend
const scrollBox = ref(null)
const handle = ref(null)   // { top, left }
async function placeHandle() {
  handle.value = null; const s = sel.value; if (!s || !scrollBox.value) return
  await nextTick()
  const r = rows.value[s.r1]; if (!r) return
  const tr = scrollBox.value.querySelector(`tr[data-id="${r.row.id}"]`); const td = tr?.children[FIXED + s.c1]; if (!td) return
  const a = td.getBoundingClientRect(), b = scrollBox.value.getBoundingClientRect()
  handle.value = { top: a.bottom - b.top + scrollBox.value.scrollTop - 4, left: a.right - b.left + scrollBox.value.scrollLeft - 4 }
}
watch(sel, placeHandle, { deep: true })
// auch wenn sich die Spalten verschieben — ein neuer Wert macht die Spalte breiter (Autofit), gezogene Breite, Filter (Taloan)
watch([tableWidth, dirty, rows], placeHandle)
const norm = (a, b) => ({ r0: Math.min(a.ri, b.ri), r1: Math.max(a.ri, b.ri), c0: Math.min(a.ci, b.ci), c1: Math.max(a.ci, b.ci) })
const inSel = (ri, ci) => !!sel.value && ri >= sel.value.r0 && ri <= sel.value.r1 && ci >= sel.value.c0 && ci <= sel.value.c1
const selCells = () => { const s = sel.value; if (!s) return []; const out = []; for (let ri = s.r0; ri <= s.r1; ri++) for (let ci = s.c0; ci <= s.c1; ci++) { const r = rows.value[ri], c = columns.value[ci]; if (r && c) out.push({ r, c, ri, ci }) } return out }
const canWrite = (r, c) => c.virtual === 'label' ? !!labelCol(r) && editable(labelCol(r)) : editable(c) && !isAxis(r, c)
// Text in eine Zelle schreiben, je Typ aufgelöst: Auswahl über Wert oder Label (Gross/Klein egal), Ja/Nein über
// ja/nein/true/false/1/0; leer löscht den eigenen Wert. Gibt 'ok' | 'locked' | 'bad' zurück.
function write(r, c0, text) {
  if (!canWrite(r, c0)) return 'locked'
  const c = eff(r, c0)
  const t = String(text ?? '').trim()
  if (c.type === 'enum' && !c.multiple) {
    if (!t) { set(r, c, ''); return 'ok' }
    const opts = listOf(c)?.values ?? []; const q = t.toLowerCase()
    const hit = opts.find(o => o.value.toLowerCase() === q) ?? opts.find(o => Object.values(o.label ?? {}).some(l => String(l).toLowerCase() === q))
    if (!hit) return 'bad'
    set(r, c, hit.value); return 'ok'
  }
  if (c.type === 'boolean') {
    if (!t) { set(r, c, ''); return 'ok' }
    const q = t.toLowerCase()
    if (['ja', 'true', '1', 'x', 'yes', 'wahr'].includes(q)) { set(r, c, 'true'); return 'ok' }
    if (['nein', 'false', '0', 'no', 'falsch', '-'].includes(q)) { set(r, c, 'false'); return 'ok' }
    return 'bad'
  }
  set(r, c, t); return 'ok'
}
const textOf = (r, c) => shown(r, c) ?? inherited(r, c) ?? ''
// Strg+D: oberste Zelle des Bereichs in alle darunter; bei einer Zelle: die Zelle darüber hinein
function fillDown() {
  const s = sel.value; if (!s) return
  let n = 0
  for (let ci = s.c0; ci <= s.c1; ci++) {
    const c = columns.value[ci]; if (!c) continue
    const srcRow = s.r0 === s.r1 ? rows.value[s.r0 - 1] : rows.value[s.r0]
    if (!srcRow) continue
    const v = textOf(srcRow, c)
    for (let ri = (s.r0 === s.r1 ? s.r0 : s.r0 + 1); ri <= s.r1; ri++) { const r = rows.value[ri]; if (r && write(r, c, v) === 'ok') n++ }
  }
  store.toast(`${n} Zellen gefüllt — noch nicht gespeichert`)
}
// Strg+Shift+D: Reihe fortsetzen — die ersten zwei Zellen geben Start und Schritt (1, 2 → 3, 4; 10, 20 → 30);
// Text mit Zahl am Ende zählt hoch (Art-001 → Art-002); ein einzelner Wert wird wiederholt
function fillSeries() {
  const s = sel.value; if (!s || s.r1 === s.r0) { store.toast('Bereich über mehrere Zeilen markieren: erste Zellen = Muster'); return }
  let n = 0
  for (let ci = s.c0; ci <= s.c1; ci++) {
    const c = columns.value[ci]; if (!c) continue
    const a = textOf(rows.value[s.r0], c), b = s.r1 > s.r0 ? textOf(rows.value[s.r0 + 1], c) : ''
    const num = x => /^-?\d+([.,]\d+)?$/.test(x.trim()) ? parseFloat(x.replace(',', '.')) : null
    const tail = /^(.*?)(\d+)$/.exec(a)
    let gen
    if (num(a) != null && num(b) != null) { const step = num(b) - num(a); const dec = Math.max((a.split(/[.,]/)[1] || '').length, (b.split(/[.,]/)[1] || '').length); gen = i => (num(a) + step * i).toFixed(dec).replace('.', a.includes(',') ? ',' : '.') }
    else if (num(a) != null && !b) { gen = i => String(num(a) + i) }
    else if (tail) { const w = tail[2].length; const start = parseInt(tail[2]); const stepT = /^(.*?)(\d+)$/.exec(b); const step = stepT && stepT[1] === tail[1] ? parseInt(stepT[2]) - start : 1; gen = i => tail[1] + String(start + step * i).padStart(w, '0') }
    else gen = () => a
    for (let ri = s.r0; ri <= s.r1; ri++) { const r = rows.value[ri]; if (r && write(r, c, gen(ri - s.r0)) === 'ok') n++ }
  }
  store.toast(`Reihe: ${n} Zellen — noch nicht gespeichert`)
}
// Entf: eigene Werte im Bereich löschen (geerbte bleiben, sie sind nicht hier)
function clearSel() { let n = 0; for (const { r, c } of selCells()) if (canWrite(r, c) && shown(r, c) != null) { set(r, c, ''); n++ }; if (n) store.toast(`${n} eigene Werte gelöscht — noch nicht gespeichert`) }
// Strg+C: Bereich als Tab-Text (Excel nimmt das direkt)
function copySel() {
  const s = sel.value; if (!s) return
  const lines = []
  for (let ri = s.r0; ri <= s.r1; ri++) { const r = rows.value[ri]; if (!r) continue; lines.push(columns.value.slice(s.c0, s.c1 + 1).map(c => c.type === 'enum' && !c.multiple ? labelOf(c)(textOf(r, c)) : textOf(r, c)).join('\t')) }
  navigator.clipboard?.writeText(lines.join('\n')); store.toast(`${lines.length} Zeilen kopiert`)
}
// Suchen & Ersetzen (Strg+H): im Bereich oder in der ganzen Tabelle, nur beschreibbare Zellen
function matcher() {
  const f = rep.value.find; if (!f) return null
  const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(rep.value.whole ? `^${esc}$` : esc, rep.value.caseSensitive ? 'g' : 'gi')
}
function targets() { return rep.value.all || !sel.value ? rows.value.flatMap(r => columns.value.map(c => ({ r, c }))) : selCells() }
const replaceHits = computed(() => { const m = matcher(); if (!m) return 0; return targets().filter(({ r, c }) => canWrite(r, c) && m.test(textOf(r, c)) && (m.lastIndex = 0, true)).length })
function replaceAll() {
  const m = matcher(); if (!m) return
  let n = 0
  for (const { r, c } of targets()) { if (!canWrite(r, c)) continue; const v = textOf(r, c); m.lastIndex = 0; if (!m.test(v)) continue; m.lastIndex = 0; if (write(r, c, v.replace(m, rep.value.with)) === 'ok') n++ }
  store.toast(`${n} Zellen ersetzt — noch nicht gespeichert`)
}
// ---- Cursor wie in Excel: der Fokus liegt auf einer Zellbox; Pfeile bewegen ihn, Shift+Pfeil zieht den Bereich auf.
function focusCell(ri, ci) {
  ri = Math.max(0, Math.min(rows.value.length - 1, ri)); ci = Math.max(0, Math.min(columns.value.length - 1, ci))
  const r = rows.value[ri]; if (!r) return
  const tr = document.querySelector(`table.tab tr[data-id="${r.row.id}"]`); const td = tr?.children[FIXED + ci]; if (!td) return
  const box = td.querySelector('.cell-box, .cell-select, .cell-date, .cell-input'); if (!box) return
  box.focus({ preventScroll: false }); td.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  return { ri, ci }
}
function move(e, dr, dc) {
  const at = cellAt(e.target); if (!at) return false
  e.preventDefault()
  const to = focusCell(at.ri + dr, at.ci + dc); if (!to) return true
  if (e.shiftKey) { anchor.value ??= at; sel.value = norm(anchor.value, to) }
  else { anchor.value = to; sel.value = norm(to, to) }
  return true
}
// Eingabe übernehmen (die Zelle macht das auf Enter) und den Cursor versetzen
function commitAndMove(e, dr, dc) {
  const at = cellAt(e.target); if (!at) return
  e.preventDefault(); e.target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
  setTimeout(() => { const to = focusCell(at.ri + dr, at.ci + dc); if (to) { anchor.value = to; sel.value = norm(to, to) } }, 0)
}
function onKey(e) {
  const inField = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) && !e.target.closest('td.cell')
  const editing = e.target.classList?.contains('cell-input')
  // im Eingabefeld: Enter speichert (macht die Zelle) und springt nach unten, Tab nach rechts
  if (editing && (e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) { commitAndMove(e, e.key === 'Enter' ? 1 : 0, e.key === 'Tab' ? 1 : 0); return }
  // Pfeile in der Eingabe (Taloan): hoch/runter übernehmen und wechseln; links/rechts nur, wenn die Zelle durch Tippen
  // geöffnet wurde (Excel: Eingeben-Modus) oder der Cursor schon am Rand steht (Bearbeiten-Modus: F2, Doppelklick)
  if (editing && e.key.startsWith('Arrow')) {
    const typed = e.target.dataset.mode === 'typed', len = e.target.value.length
    const s0 = e.target.selectionStart, s1 = e.target.selectionEnd
    if (e.key === 'ArrowUp') commitAndMove(e, -1, 0)
    else if (e.key === 'ArrowDown') commitAndMove(e, 1, 0)
    else if (e.key === 'ArrowLeft' && (typed || (s0 === 0 && s1 === 0))) commitAndMove(e, 0, -1)
    else if (e.key === 'ArrowRight' && (typed || (s0 === len && s1 === len))) commitAndMove(e, 0, 1)
    return
  }
  if (!inField && !editing && e.target.closest?.('td.cell')) {
    const page = 15
    if (e.key === 'ArrowDown' && move(e, 1, 0)) return
    if (e.key === 'ArrowUp' && move(e, -1, 0)) return
    if (e.key === 'ArrowRight' && !e.target.classList.contains('cell-select') && move(e, 0, 1)) return
    if (e.key === 'ArrowLeft' && !e.target.classList.contains('cell-select') && move(e, 0, -1)) return
    if (e.key === 'PageDown' && move(e, page, 0)) return
    if (e.key === 'PageUp' && move(e, -page, 0)) return
    if (e.key === 'Home' && !e.ctrlKey && move(e, 0, -999)) return
    if (e.key === 'End' && !e.ctrlKey && move(e, 0, 999)) return
    if (e.key === 'Home' && e.ctrlKey && move(e, -99999, -999)) return
    if (e.key === 'End' && e.ctrlKey && move(e, 99999, 999)) return
    if (e.key === 'Tab') { const at = cellAt(e.target); if (at) { e.preventDefault(); const to = focusCell(at.ri + (e.shiftKey ? (at.ci === 0 ? -1 : 0) : (at.ci === columns.value.length - 1 ? 1 : 0)), e.shiftKey ? (at.ci === 0 ? 999 : at.ci - 1) : (at.ci === columns.value.length - 1 ? 0 : at.ci + 1)); if (to) { anchor.value = to; sel.value = norm(to, to) } } return }
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); save(); return }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') { e.preventDefault(); replaceOpen.value = !replaceOpen.value; return }
  if (inField || e.target.classList?.contains('cell-input')) return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); e.shiftKey ? fillSeries() : fillDown() }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && document.activeElement?.closest?.('table.tab')) { e.preventDefault(); sel.value = { r0: 0, r1: rows.value.length - 1, c0: 0, c1: columns.value.length - 1 } }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && sel.value && !window.getSelection()?.toString()) { e.preventDefault(); copySel() }
  else if (e.key === 'Delete' && sel.value && (sel.value.r0 !== sel.value.r1 || sel.value.c0 !== sel.value.c1)) { e.preventDefault(); clearSel() }
  else if (e.key === 'Escape' && sel.value) { sel.value = null }
}
onMounted(() => { document.addEventListener('paste', onPaste); document.addEventListener('keydown', onKey); document.addEventListener('mousedown', onMouseDown, true); document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); window.addEventListener('pagehide', onPageHide) })
onUnmounted(() => { document.removeEventListener('paste', onPaste); document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onMouseDown, true); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); window.removeEventListener('pagehide', onPageHide) })

// Export der Tabelle, wie sie dasteht (CSV, Semikolon, UTF-8 mit BOM — Excel öffnet das direkt)
function exportCsv() {
  const esc = v => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
  const head = ['id', 'name', 'sku', ...attrColumns.value.map(c => c.perLocale ? `${c.key}_${locale.value}` : c.key)]
  const lines = [head.join(';'), ...rows.value.map(r => [r.row.id, r.row.label, r.row.sku ?? '', ...attrColumns.value.map(c => shown(r, c) ?? inherited(r, c) ?? '')].map(esc).join(';'))]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${data.value.node.label}-${childRole.value}-${locale.value}.csv`; a.click(); URL.revokeObjectURL(a.href)
}
const listOf = c => model.value?.lists?.find(l => l.key === c.list)
const labelOf = c => v => { const lv = listOf(c)?.values.find(x => x.value === v); return lv?.label?.[locale.value] || lv?.label?.de || v }
</script>

<template>
  <div class="pane" style="flex:1" v-if="data">
    <div class="toolbar path">
      <router-link v-for="a in tree.ancestors(id)" :key="a.id" :to="`/tree/${a.id}`" class="crumb">{{ icon(a.role) }} {{ a.label }} ›</router-link>
      <router-link :to="`/tree/${id}`" class="crumb">{{ icon(data.node.role) }} {{ data.node.label }}</router-link>
      <h1>⊞ {{ deep === '1' ? 'Alle ' + (roleLabel[childRole] ?? childRole) + ' darunter' : 'Subitems' }} <span class="muted">· {{ rows.length }}{{ filter ? ' von ' + data.rows.length : '' }}</span></h1>
      <span class="grow" />
      <span v-if="busy" class="muted">{{ busy }}</span>
      <span v-if="dirty.size" class="chip dirty" :title="`${dirty.size} geänderte Zellen — Strg+S speichert`">✎ {{ dirty.size }}</span>
      <template v-if="popup">
        <button class="primary" :disabled="!!busy" @click="applyAndClose" title="Änderungen als ein Stapel ins Journal und Fenster schliessen — Schliessen über X tut dasselbe">✓ übernehmen &amp; schliessen</button>
        <button :disabled="!!busy" @click="discardAndClose" title="Änderungen verwerfen und Fenster schliessen">✗ verwerfen</button>
      </template>
      <template v-else>
        <button class="primary" :disabled="!dirty.size || !!busy" @click="save" title="alle Änderungen als ein Stapel ins Journal (Strg+S)">💾 speichern</button>
        <button :disabled="!dirty.size" @click="discard" title="Änderungen verwerfen">verwerfen</button>
      </template>
      <button class="x" @click="exportCsv" title="Tabelle als CSV (Excel) herunterladen — Spalte id bringt sie über ⇩ Import → Tabelle zurück">⇪ CSV</button>
    </div>
    <div class="toolbar view">
      <span class="muted">Sprache</span>
      <span v-for="l in locales" :key="l" class="view-chip" :class="{ on: locale === l }" @click="locale = l">{{ l }}</span>
      <span class="sep">·</span>
      <select v-model="viewKey" title="Attributsicht: welche Spalten, in welcher Reihenfolge"><option value="">◫ alle Attribute ({{ data.columns.length }})</option><option v-for="v in views" :key="v.key" :value="v.key">◫ {{ v.label?.de || v.key }}</option></select>
      <input v-model="filter" type="search" placeholder="🔍 filtern" style="width:200px" />
      <span class="grow" />
      <button @click="fillDown" :disabled="!sel" title="runterziehen: oberste Zelle des Bereichs in alle darunter (Strg+D)">⇩ füllen</button>
      <button @click="fillSeries" :disabled="!sel" title="Reihe fortsetzen: 1, 2 → 3, 4 · Art-001 → Art-002 (Strg+Shift+D)">⇣ Reihe</button>
      <button :class="{ primary: replaceOpen }" @click="replaceOpen = !replaceOpen" title="Suchen & Ersetzen (Strg+H)">⇄ ersetzen</button>
      <span class="muted" style="font-size:12px" title="Pfeile bewegen den Cursor, Shift+Pfeil zieht den Bereich auf, Enter speichert und springt nach unten, Tab nach rechts, Tippen überschreibt, F2 bearbeitet · Strg+D füllen, Strg+Shift+D Reihe, Strg+H ersetzen, Strg+C/V mit Excel, Entf leert, Strg+A alles">🖱 ziehen = Bereich · Doppelklick/F2/Tippen = bearbeiten (lang/HTML: grosser Editor) · ▪ Kästchen ziehen = füllen · Strg+D/H/C/V · <i>kursiv</i> = geerbt</span>
    </div>
    <div v-if="replaceOpen" class="toolbar replace">
      <span class="muted">⇄</span>
      <input v-model="rep.find" type="text" placeholder="suchen" style="width:180px" @keydown.enter="replaceAll" @keydown.esc="replaceOpen = false" autofocus />
      <input v-model="rep.with" type="text" placeholder="ersetzen durch" style="width:180px" @keydown.enter="replaceAll" @keydown.esc="replaceOpen = false" />
      <label><input type="checkbox" v-model="rep.all" /> ganze Tabelle</label>
      <label><input type="checkbox" v-model="rep.caseSensitive" /> Gross/Klein</label>
      <label><input type="checkbox" v-model="rep.whole" /> ganze Zelle</label>
      <span class="muted">{{ rep.find ? replaceHits + ' Treffer' + (rep.all || !sel ? '' : ' im Bereich') : '' }}</span>
      <button class="primary" :disabled="!replaceHits" @click="replaceAll">alle ersetzen</button>
      <button class="x" @click="replaceOpen = false" title="schliessen (Esc)">×</button>
    </div>
    <div class="scroll" ref="scrollBox" style="position:relative">
      <div v-if="handle" class="fill-handle" :style="`top:${handle.top}px;left:${handle.left}px`" title="Ausfüllkästchen: nach unten ziehen füllt — ein Wert wiederholt sich, zwei Zahlen setzen die Reihe fort" />
      <table class="grid values tab" :style="`width:${tableWidth}px`">
        <colgroup><col v-for="c in columns" :key="c.key" :style="`width:${colWidth(c)}px`" /></colgroup>
        <thead><tr>
          <th v-for="c in columns" :key="c.key" :title="headTitle(c)" :class="{ ro: !editable(c) && c.virtual !== 'label' }" style="position:sticky">{{ headText(c) }}<span v-if="headLocale(c)" class="muted"> {{ locale }}</span><span v-if="c.unit" class="muted"> {{ c.unit }}</span><span class="col-resize" title="Breite ziehen · Doppelklick = Autofit" @mousedown="startResize($event, c)" @dblclick.stop="delete widths[c.key]; widths = { ...widths }" /></th>
        </tr></thead>
        <tbody>
          <tr v-for="(r, ri) in rows" :key="r.row.id" :data-id="r.row.id">
            <template v-for="(c, ci) in columns" :key="c.key">
              <!-- ★-Spalte: die Zelle des Attributs, das diese Zeile benennt; ohne ★ (fixierter Name, SKU/Id) nur lesend -->
              <td v-if="c.virtual === 'label' && !labelCol(r)" class="cell label" :class="{ sel: inSel(ri, ci) }"><div class="cell-box locked" tabindex="0" :title="r.row.name ? 'fixierter Name (Rechtsklick im Baum → Benennung lösen)' : 'kein ★-Attribut gilt hier — Name aus SKU/Achsen/Id'">{{ icon(r.row.role) }} {{ r.row.label }}</div></td>
              <SelectCell v-else-if="c.virtual === 'label' && labelCol(r).type === 'enum' && !labelCol(r).multiple" :click-edit="false" class="label" :class="{ dirty: dirty.has(key(r, c)), sel: inSel(ri, ci) }" :value="shown(r, c)" :inherited="inherited(r, c)" :options="listOf(labelCol(r))?.values.map(v => v.value) ?? []" :label-of="labelOf(labelCol(r))" :required="!!labelCol(r).required" @save="v => set(r, c, v)" />
              <Cell v-else-if="c.virtual === 'label'" :click-edit="false" class="label" :class="{ dirty: dirty.has(key(r, c)), sel: inSel(ri, ci) }" :value="shown(r, c)" :inherited="inherited(r, c)" :origin="`★ ${labelCol(r).label?.de || labelCol(r).key}`" @save="v => set(r, c, v)" />
              <td v-else-if="c.virtual" class="cell" :class="{ sel: inSel(ri, ci) }"><div class="cell-box locked mono" tabindex="0" :title="c.virtual === 'sku' ? 'SKU — fest' : 'Variantenachsen — fest'">{{ inherited(r, c) ?? '' }}</div></td>
              <td v-else-if="!editable(c) || isAxis(r, c)" class="cell" :class="{ sel: inSel(ri, ci) }"><div class="cell-box locked" tabindex="0" :title="isAxis(r, c) ? 'Variantenachse — fest' : c.type + ' — in der Knotenansicht bearbeiten'" @dblclick="popup || router.push(`/tree/${r.row.id}`)">{{ (shown(r, c) ?? inherited(r, c) ?? '').toString().replace(/<[^>]+>/g, ' ').slice(0, 80) }}<span v-if="isAxis(r, c)"> 🔒</span></div></td>
              <ToggleCell v-else-if="c.type === 'boolean'" :class="{ dirty: dirty.has(key(r, c)), sel: inSel(ri, ci) }" :value="shown(r, c)" :inherited="inherited(r, c)" @save="v => set(r, c, v)" />
              <SelectCell v-else-if="c.type === 'enum' && !c.multiple" :click-edit="false" :class="{ dirty: dirty.has(key(r, c)), sel: inSel(ri, ci) }" :value="shown(r, c)" :inherited="inherited(r, c)" :options="listOf(c)?.values.map(v => v.value) ?? []" :label-of="labelOf(c)" :required="!!c.required" @save="v => set(r, c, v)" />
              <HtmlCell v-else-if="c.type === 'html'" :click-edit="false" :class="{ dirty: dirty.has(key(r, c)), sel: inSel(ri, ci) }" :value="shown(r, c)" :inherited="inherited(r, c)" :title="`${c.label?.de || c.key} · ${r.row.label}`" @save="v => set(r, c, v)" />
              <DateCell v-else-if="c.type === 'date'" :class="{ dirty: dirty.has(key(r, c)), sel: inSel(ri, ci) }" :value="shown(r, c)" :inherited="inherited(r, c)" @save="v => set(r, c, v)" />
              <Cell v-else :click-edit="false" :class="{ dirty: dirty.has(key(r, c)), sel: inSel(ri, ci) }" :value="shown(r, c)" :inherited="inherited(r, c)" @save="v => set(r, c, v)" />
            </template>
          </tr>
        </tbody>
      </table>
      <div v-if="!data.rows.length" class="empty">Keine {{ roleLabel[childRole] }} unter {{ data.node.label }}.</div>
    </div>
  </div>
  <div v-else class="pane" style="flex:1"><div class="empty">…</div></div>
</template>

<style scoped>
.path { flex-wrap: wrap; row-gap: 2px; }
.crumb { color: var(--muted); text-decoration: none; }
.crumb:hover { color: var(--text); }
.tab th.ro { color: var(--muted); font-style: italic; }
/* Tabellengefühl (Taloan): Zellen dicht an dicht mit Gitterlinien statt Kästchen mit Luft; Zeilen flacher */
.tab th, .tab td { padding: 0; border-right: 1px solid var(--line); height: 24px; }
.tab th { padding: 0 6px; }
.tab td.attr, .tab td.mono { padding: 0 6px; }
.tab :deep(td.cell) { padding: 0; }
.tab :deep(.cell-box), .tab :deep(.cell-input), .tab :deep(.cell-select), .tab :deep(.cell-date) { height: 24px; border-radius: 0; border-color: transparent; background: transparent; }
.tab :deep(.cell-box:focus) { border-color: var(--accent); background: transparent; }
.tab :deep(.cell-input) { border-color: var(--accent); background: var(--pane); }
/* Erste Spalte (Name) bleibt beim Rollen nach rechts stehen — man muss wissen, was man bearbeitet (Taloan) */
.tab th:first-child, .tab :deep(td:first-child) { position: sticky; left: 0; z-index: 2; background: var(--bg); box-shadow: 1px 0 0 var(--line); }
.tab :deep(td.label .cell-box:not(.locked)) { font-weight: 600; }
.tab th:first-child { z-index: 3; }
.tab :deep(td.cell.dirty .cell-box), .tab :deep(td.dirty .cell-box) { background: var(--dirty); color: var(--dirty-text); font-style: normal; }
.cell-box.locked { color: var(--muted); font-style: italic; cursor: default; }
.chip.dirty { background: var(--dirty); color: var(--dirty-text); }
/* markierter Bereich wie in Excel */
.tab :deep(td.cell.sel) { outline: 1px solid var(--accent); outline-offset: -1px; background: var(--accent-soft); }
.tab :deep(td.cell.sel .cell-box) { background: transparent; }
.tab :deep(.cell-box), .tab td.attr, .tab td.mono, .tab th { user-select: none; }
.tab :deep(.cell-box) { cursor: cell; }
.tab th { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.col-resize { position: absolute; top: 0; right: -3px; width: 7px; height: 100%; cursor: col-resize; z-index: 1; }
.col-resize:hover { background: var(--accent); opacity: .5; }
.fill-handle { position: absolute; width: 7px; height: 7px; background: var(--accent); border: 1px solid var(--bg); cursor: crosshair; z-index: 2; }
.replace { gap: 6px; font-size: 12px; background: var(--bg); }
.replace label { display: inline-flex; gap: 3px; align-items: center; }
</style>
