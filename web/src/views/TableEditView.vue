<script setup>
// Massenbearbeitung wie in Excel (Taloan, 17.09.2026): die Kinder eines Knotens — oder alle Nachfahren einer Rolle —
// als Zeilen, Attribute als Spalten; Zellen wie in der Knotenansicht, Änderungen sammeln sich (gelb) und gehen als
// ein Stapel ins Journal. Einfügen aus Excel (Tab-getrennt) füllt ab der markierten Zelle nach rechts und unten.
// Quelle: GET /api/nodes/{id}/table — Werte aufgelöst (geerbt kursiv), eigene Werte kennt der Server (own).
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { tree, icon } from '../tree.js'
import { menu } from '../menu.js'
import { moveRows, moveTarget, orderCommands, pickRows } from '../rowOps.js'
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
]
// Kein ★ (auch kein geerbtes) und kein fixierter Name: die erste Spalte (Taloan)
const labelKeyOf = r => r.row.labelAttribute ?? (r.row.name ? null : baseColumns.value[0]?.key ?? null)
const labelCol = r => { const k = labelKeyOf(r); return k ? data.value?.columns.find(c => c.key === k) ?? null : null }
const commonDef = computed(() => commonLabel.value ? data.value?.columns.find(x => x.key === commonLabel.value) : null)
const headText = c => c.virtual === 'label' ? '★ ' + (commonDef.value ? store.name(commonDef.value) : roleLabel[childRole.value]) : c.virtual ? (c.label?.de || c.key) : store.name(c)
const headLocale = c => c.perLocale || (c.virtual === 'label' && commonDef.value?.perLocale)
const headTitle = c => c.virtual === 'label'
  ? (commonDef.value ? `★ ${commonDef.value.label?.de || commonDef.value.key} benennt alle Zeilen — hier bearbeiten` : 'je Zeile ihr ★-Attribut (Tooltip an der Zelle); fixierte Namen sind fest')
  : c.virtual ? 'fest' : `${c.key} · ${c.type}${c.perLocale ? ' · sprachabhängig' : ''}${c.unit ? ' · ' + c.unit : ''}`
// Die wirkliche Spalte hinter einer Zelle: bei #label das ★-Attribut der Zeile
const eff = (r, c) => c.virtual === 'label' ? labelCol(r) : c
const commonLabel = computed(() => { const keys = new Set((data.value?.rows ?? []).map(labelKeyOf)); return keys.size === 1 && !keys.has(null) ? [...keys][0] : null })
const columns = computed(() => [...VIRTUAL, ...attrColumns.value])
// Reihenfolge wie in der Excel-Vorlage (Taloan, 20.09.): Achsen, dann Pflicht, dann der Rest; in einer Sicht gilt deren Reihenfolge
const axisKeys = computed(() => new Set(childRole.value === 'variant' ? (data.value?.node?.axes ?? tree.byId.get(props.id)?.axes ?? []) : []))
const isReq = c => !!c.required && (typeof c.required !== 'object' || Object.keys(c.required).length > 0)
const kindOf = c => c.virtual ? '' : c.unique ? 'info' : axisKeys.value.has(c.key) ? 'axis' : isReq(c) ? 'required' : ''   // eindeutig = Schlüssel, grau wie im Export
// Spaltenfilter (Taloan, 20.09.): das Feld neben der Sicht sucht Spalten (Name oder Schlüssel), nicht Inhalte
const colMatch = c => { const q = filter.value.trim().toLowerCase(); return !q || store.name(c).toLowerCase().includes(q) || c.key.toLowerCase().includes(q) }
const tab = ref('')   // '' = alle, sonst Schlüssel der Attributgruppe
const tabs = computed(() => { const keys = new Set((data.value?.columns ?? []).map(c => c.key)); return (model.value?.groups ?? []).map(g => ({ key: g.key, label: g.label?.de || g.label?.en || g.key, n: (g.attributes ?? []).filter(k => keys.has(k)).length })).filter(g => g.n > 0) })
const inTab = c => !tab.value || (model.value?.groups.find(g => g.key === tab.value)?.attributes ?? []).includes(c.key)
watch(tabs, ts => { if (tab.value && !ts.some(g => g.key === tab.value)) tab.value = '' })
const attrColumns = computed(() => { const base = baseColumns.value.filter(c => c.key !== commonLabel.value && colMatch(c) && inTab(c)); if (viewKey.value) return base; const rank = c => c.unique ? -1 : axisKeys.value.has(c.key) ? 0 : isReq(c) ? 1 : 2; return [...base].sort((a, b) => rank(a) - rank(b)) })
const HELP = [
  ['Klick · ziehen', 'Zelle wählen · Bereich aufziehen'], ['Shift+Pfeil', 'Bereich vergrössern'], ['Strg+A', 'alles'],
  ['Tippen', 'überschreibt die Zelle (Ergänzung aus der Spalte: Enter nimmt sie)'], ['F2 · Doppelklick', 'bearbeiten — langer Text/HTML im grossen Editor'],
  ['Enter · Tab', 'speichern, weiter nach unten · rechts'], ['Esc', 'verwerfen'], ['Entf', 'Zelle leeren (geerbter Wert gilt wieder)'],
  ['Strg+D', 'füllen: oberste Zelle in den Bereich darunter'], ['Strg+Shift+D', 'Reihe: 1, 2 → 3, 4 · Art-001 → Art-002'], ['▪ Kästchen ziehen', 'füllen wie in Excel'],
  ['Strg+C · Strg+V', 'mit Excel austauschen (Listen über Wert oder Bezeichnung)'], ['Strg+H', 'ins Suchfeld für Ersetzen'], ['Strg+S', 'alle Änderungen als ein Stapel ins Journal'],
  ['Zeilenspalte links', 'Klick = ganze Zeile · Strg = dazu/weg · Shift = Bereich · Shift+Leertaste = Zeile der Zelle'], ['ziehen an markierten Zeilen', 'verschieben (Strich = Platz)'],
  ['Rechtsklick auf Zeile', 'kopieren · einfügen · duplizieren · verschieben · löschen'], ['Strg+−', 'markierte Zeilen löschen (beim Speichern)'],
  ['kursiv', 'geerbter Wert'], ['Buchstabe in Auswahl', 'springt zum passenden Wert; ohne Treffer beginnt ein neuer Listenwert'],
]
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
const editable = c => !c.virtual && !['rows', 'formula', 'template'].includes(c.type)   // html: eigener Editor (HtmlCell); virtuelle: siehe canWrite
const rows = computed(() => data.value?.rows ?? [])
const key = (r, c) => `${r.row.id}|${eff(r, c)?.key ?? c.key}`
const shown = (r, c0) => { const c = eff(r, c0); if (!c) return null; return dirty.value.has(key(r, c)) ? (dirty.value.get(key(r, c)) || null) : (r.values[c.key]?.own ? r.values[c.key].value : (r.row.axisValues?.[c.key] ?? null)) }
const inherited = (r, c0) => { const c = eff(r, c0); if (!c) return c0.virtual === 'label' ? r.row.label : null; if (c.virtual === 'axes') return Object.values(r.row.axisValues ?? {}).join(' · ') || null; return r.values[c.key]?.own ? null : r.values[c.key]?.value ?? null }
const isAxis = (r, c) => !r.isNew && r.row.role === 'variant' && (tree.byId.get(r.row.parent)?.axes ?? []).includes(c.key)   // neue Zeile: Achsenwert wird hier eingetragen
const inactive = (r, c) => !c.virtual && (r.inactive ?? []).includes(c.key)   // gilt an diesem Knoten nicht (Gruppe ab tieferer Rolle)
function set(r, c0, v) {
  const c = eff(r, c0); if (!c || c.virtual) return
  const k = key(r, c); const cur = r.values[c.key]?.own ? r.values[c.key].value : null
  const val = v == null ? '' : String(v)
  const m = new Map(dirty.value)
  if ((val || null) === cur) m.delete(k); else m.set(k, val)
  dirty.value = m
}
// Offene Änderungen: geänderte Zellen, neue, gelöschte, verschobene Zeilen — alles geht als ein Stapel (Taloan, 21.09.)
const fresh = computed(() => rows.value.filter(r => r.isNew).length)
const retired = computed(() => rows.value.filter(r => r.retired && !r.isNew).length)
const moved = computed(() => rows.value.filter(r => r.moved && !r.retired).length)
const hasChanges = computed(() => dirty.value.size > 0 || fresh.value > 0 || retired.value > 0 || moved.value > 0)
async function save() {
  if (!hasChanges.value) return
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  busy.value = `schreibe ${dirty.value.size} …`
  try {
    const commands = commandsOf()
    const res = await api.post('/api/batch', { commands: commands.map(({ _key, ...c }) => c), batch: 'tab-' + Date.now().toString(36) })
    if (res.error) {
      // Fehler (Taloan, 21.09.: „SKU 14 gibt es schon — 0 geschrieben, und alle Änderungen waren weg“): was nicht geschrieben wurde, bleibt
      // als Änderung stehen (grün, Zähler), damit man es korrigiert — nur die geschriebenen Zellen fallen aus der Liste
      const written = new Set(commands.slice(0, res.results.length).map(c => c._key).filter(Boolean))
      const keep = new Map([...dirty.value].filter(([k]) => !written.has(k)))
      const keepRetired = new Set(commands.slice(res.results.length).filter(c => c.op === 'node.retire').map(c => c.args.node))
      store.toast(`✗ ${res.error.message} — ${res.results.length} geschrieben, ${keep.size + keepRetired.size} Änderungen bleiben offen: korrigieren und noch einmal speichern`)
      await store.poll(true); await load(); dirty.value = keep
      for (const r of rows.value) if (keepRetired.has(r.row.id)) r.retired = true
      return
    }
    store.toast(`✓ ${res.results.length} Werte geschrieben`)
    await store.poll(true); await load()
  } catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
// verwerfen: gelöschte und verschobene Zeilen stehen nur hier — der Serverstand kommt zurück
function discard() { dirty.value = new Map(); rowSel.value = new Set(); if (data.value) { data.value.rows = data.value.rows.filter(r => !r.isNew); if (data.value.rows.some(r => r.retired || r.moved)) load() } }
let newSeq = 0
const parentAxes = computed(() => data.value?.node?.axes ?? tree.byId.get(props.id)?.axes ?? [])
// neue Zeile — ans Ende, oder an einen Platz (Rechtsklick: „darunter einfügen“; dann zählt sie als verschoben, damit der Platz bleibt)
function addRow(at = null) {
  if (!data.value || props.deep === '1') return null
  const sample = data.value.rows.find(r => !r.isNew)
  const row = { id: `new-${++newSeq}`, role: childRole.value, parent: props.id, label: '', name: null, sku: null, axisValues: {}, labelAttribute: sample?.row.labelAttribute ?? data.value.node?.labelAttribute ?? null, external: {} }
  const r = { row, values: {}, inactive: sample?.inactive ?? [], isNew: true, moved: at != null && at < data.value.rows.length }
  if (at == null || at >= data.value.rows.length) data.value.rows.push(r); else data.value.rows.splice(at, 0, r)
  const ri = data.value.rows.indexOf(r)
  nextTick(() => { const ci = columns.value.findIndex(c => !c.virtual || c.virtual === 'label'); const to = focusCell(ri, Math.max(0, ci)); if (to) { anchor.value = to; sel.value = norm(to, to) } })
  return r
}
function commandsOf() {
  const defs = new Map(data.value.columns.map(c => [c.key, c]))
  const out = []
  // neue Zeilen zuerst anlegen — Achsenwerte einer Variante kommen aus den Spalten der Achsenattribute
  for (const r of data.value.rows.filter(x => x.isNew)) {
    const id = r.row.id; const ref = id
    const val = a => dirty.value.get(`${id}|${a}`) || null
    if (r.row.role === 'variant') {
      const axisValues = {}; for (const a of parentAxes.value) { const v = val(a); if (!v) throw new Error(`neue Zeile: Achse ${store.name(defs.get(a) ?? { key: a })} braucht einen Wert`); axisValues[a] = v }
      out.push({ op: 'variant.create', ref, args: { product: props.id, axisValues } })
    } else if (r.row.role === 'product') out.push({ op: 'product.create', ref, args: { group: props.id, axes: [] } })
    else out.push({ op: 'group.create', ref, args: { parent: props.id, label: {}, name: val('name') } })
  }
  const axesSet = new Set(parentAxes.value)
  const gone = new Set(data.value.rows.filter(r => r.retired).map(r => r.row.id))
  for (const [k, v] of dirty.value) {
    const [node, attribute] = k.split('|'); const d = defs.get(attribute); const isNew = node.startsWith('new-')
    if (gone.has(node)) continue   // gelöschte Zeile: ihre Zellen sind egal
    if (isNew && childRole.value === 'variant' && axesSet.has(attribute)) continue   // steckt schon im variant.create
    if (isNew && !v) continue
    out.push({ op: 'attribute.set', args: { node: isNew ? '@' + node : node, attribute, locale: d?.perLocale ? locale.value : null, value: v }, _key: k })   // _key: welche Zelle — bleibt bei einem Fehler stehen
  }
  // gelöschte Zeilen (Taloan, 21.09.: Rechtsklick → löschen), dann die Reihenfolge der verschobenen — beide erst jetzt, im selben Stapel
  for (const r of data.value.rows) if (r.retired && !r.isNew) out.push({ op: 'node.retire', args: { node: r.row.id }, _key: 'retire|' + r.row.id })
  if (props.deep !== '1') out.push(...orderCommands(data.value.rows, props.id))
  return out
}
// neue Zeilen, die schon gelöscht sind, gibt es gar nicht erst: raus aus der Liste
function dropNewRetired() { if (data.value) data.value.rows = data.value.rows.filter(r => !(r.isNew && r.retired)) }
// Fenster zu (X, Alt+F4): was noch offen ist, geht jetzt — keepalive überlebt das Schliessen (bis ~64 KB Stapel)
function onPageHide() {
  if (!popup || !hasChanges.value || !store.actor) return
  fetch(store.server + '/api/batch', { method: 'POST', keepalive: true, headers: { 'X-Actor': store.actor, 'Content-Type': 'application/json' }, body: JSON.stringify({ commands: commandsOf(), batch: 'tab-' + Date.now().toString(36) }) })
  dirty.value = new Map()
}
async function applyAndClose() { await save(); if (!hasChanges.value) window.close() }
function discardAndClose() { discard(); window.close() }

// Einfügen aus Excel: Tab-getrennt, Zeilen mit Umbruch — ab der markierten Zelle nach rechts (nur bearbeitbare Spalten) und unten
function onPaste(e) {
  const td = document.activeElement?.closest?.('td.cell'); if (!td) return
  const text = e.clipboardData?.getData('text/plain'); if (!text) return
  if (document.activeElement?.classList?.contains('cell-input')) return   // in der Eingabe: normales Einfügen
  e.preventDefault()
  const tr = td.parentElement; const ri = rows.value.findIndex(r => r.row.id === tr.dataset.id); const ci = [...tr.children].indexOf(td) - FIXED
  if (ri < 0 || ci < 0) return
  // ein einzelner Wert (Taloan, 21.09.: „Strg+C, Zeile runter, Strg+V — nichts“): in die Zelle, oder in den ganzen markierten Bereich wie in Excel
  if (!text.includes('\t') && !text.includes('\n')) {
    const v = text.trim(); const s0 = sel.value && (sel.value.r0 !== sel.value.r1 || sel.value.c0 !== sel.value.c1) ? sel.value : { r0: ri, r1: ri, c0: ci, c1: ci }
    let n = 0, locked = 0, bad = 0
    for (let r = s0.r0; r <= s0.r1; r++) for (let c = s0.c0; c <= s0.c1; c++) { const row = rows.value[r], col = columns.value[c]; if (!row || !col) continue; const w = write(row, col, v); if (w === 'locked') locked++; else if (w === 'bad') bad++; else n++ }
    store.toast(`${n} Zellen eingefügt${locked ? `, ${locked} gesperrt` : ''}${bad ? `, ${bad} nicht in der Liste` : ''} — noch nicht gespeichert`)
    return
  }
  const lines = text.replace(/\r/g, '').split('\n').filter((l, i, a) => l !== '' || i < a.length - 1)
  // Spaltenlage bleibt wie in Excel (Taloan): gesperrte Zellen werden ausgelassen, nicht übersprungen
  let n = 0, locked = 0, bad = 0
  lines.forEach((line, dy) => {
    const r = rows.value[ri + dy]; if (!r) return
    line.split('\t').forEach((v, dx) => { const c = columns.value[ci + dx]; if (!c) return; const w = write(r, c, v); if (w === 'locked') locked++; else if (w === 'bad') bad++; else n++ })
  })
  store.toast(`${n} Zellen eingefügt${locked ? `, ${locked} gesperrt` : ''}${bad ? `, ${bad} nicht in der Liste` : ''} — noch nicht gespeichert`)
}
const FIXED = 1   // vorn die Zeilenspalte (Nummer, Zeile markieren), dann alle Spalten in einer Liste (virtuelle voran): td-Index = FIXED + Spaltenindex
const ROWSEL_W = 40
// Spaltenbreite wie Excel-Autofit (Taloan: „viel zu breit“): längster sichtbarer Wert oder Kopf, 70–260 px; am Kopfrand ziehbar
const widths = ref({})   // key → px (von Hand gezogen)
// gemessen, nicht geschätzt (Taloan: „0537…“ bei sechs Zeichen): Textbreite im Zellfont + Innenabstand der Box
const measure = (() => { let ctx = null; return (s, font) => { ctx ??= document.createElement('canvas').getContext('2d'); ctx.font = font; return ctx.measureText(s).width } })()
const autoWidth = computed(() => {
  const out = {}
  const font = scrollBox.value ? getComputedStyle(scrollBox.value).font : '13px system-ui'
  const pad = 30   // Zellrand, Innenabstand, Zeilenrand — und etwas Luft, damit nie „…“ am Ende steht
  for (const c of columns.value) {
    let w = measure(headText(c) + (c.perLocale ? ' ' + locale.value : '') + (c.unit ? ' ' + c.unit : ''), 'bold ' + font)
    for (const r of rows.value.slice(0, 300)) { const v = c.type === 'enum' && !c.multiple ? labelOf(c)(textOf(r, c)) : textOf(r, c); if (v) w = Math.max(w, measure(String(v).replace(/<[^>]+>/g, '').slice(0, 60), font)) }
    out[c.key] = Math.ceil(Math.max(c.virtual === 'label' ? 140 : 60, Math.min(320, w + pad + (c.virtual === 'label' ? 20 : 0))))
  }
  return out
})
const colWidth = c => widths.value[c.key] ?? autoWidth.value[c.key] ?? 120
const tableWidth = computed(() => ROWSEL_W + columns.value.reduce((s, c) => s + colWidth(c), 0))
function startResize(e, c) { e.preventDefault(); e.stopPropagation(); drag = { kind: 'resize', key: c.key, x: e.clientX, w: colWidth(c) } }

// ---- Bereich wie in Excel (Taloan): Klick = Anker, Shift+Klick = Rechteck, Strg+A = alles; Zeilen/Spalten als Indizes
// über die sichtbaren Zeilen und die Attributspalten (columns), Achsen und gesperrte Spalten werden beim Schreiben übersprungen.
const sel = ref(null)          // { r0, c0, r1, c1 } normalisiert
const anchor = ref(null)
const repFind = ref(null)
const rep = ref({ find: '', with: '', all: false, caseSensitive: false, whole: false })
function cellAt(el) {
  const td = el?.closest?.('td.cell'); if (!td) return null
  const tr = td.parentElement; const ri = rows.value.findIndex(r => r.row.id === tr.dataset.id); const ci = [...tr.children].indexOf(td) - FIXED
  return ri < 0 || ci < 0 ? null : { ri, ci }
}
// Maus wie in Excel (Taloan): Drücken und Ziehen zieht den Bereich auf — kein Textmarkieren des Browsers;
// das Ausfüllkästchen (kleines Quadrat unten rechts am Bereich) zieht die Werte nach unten.
let drag = null   // { kind: 'select' | 'fill' | 'resize' | 'rows' | 'rowsel', base }
// ---- Ganze Zeilen (Taloan, 21.09.): Klick in die Zeilenspalte markiert die Zeile, Strg dazu/weg, Shift den Bereich; ziehen über
// unmarkierte Zeilen zieht die Auswahl auf, ziehen an markierten Zeilen verschiebt sie (Strich zeigt den Platz).
// Rechtsklick auf eine Zeile öffnet das Menü: kopieren, einfügen, duplizieren, verschieben, löschen.
const rowSel = ref(new Set())   // Ids der markierten Zeilen
const rowAnchor = ref(null)     // Index des Ankers
const dropAt = ref(null)        // Index, vor den verschoben wird (rows.length = ans Ende)
const rowIndexAt = el => { const tr = el?.closest?.('tr[data-id]'); return tr ? rows.value.findIndex(r => r.row.id === tr.dataset.id) : -1 }
const selectedRows = () => rows.value.filter(r => rowSel.value.has(r.row.id))
function pick(ri, e) { const p = pickRows(rows.value, rowSel.value, rowAnchor.value, ri, { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey }); rowSel.value = p.sel; rowAnchor.value = p.anchor; sel.value = null }
function onMouseDown(e) {
  if (e.button !== 0) return
  if (e.target.closest('.fill-handle')) { e.preventDefault(); drag = { kind: 'fill', base: { ...sel.value } }; return }
  const rs = e.target.closest?.('td.rowsel, th.rowsel')
  if (rs) {
    e.preventDefault()
    if (rs.tagName === 'TH') { rowSel.value = new Set(rows.value.map(r => r.row.id)); rowAnchor.value = 0; sel.value = null; return }
    const ri = rowIndexAt(rs); if (ri < 0) return
    if (rowSel.value.has(rows.value[ri].row.id) && !e.ctrlKey && !e.shiftKey && props.deep !== '1') { drag = { kind: 'rows', from: ri, y: e.clientY }; return }
    pick(ri, e); drag = { kind: 'rowsel' }
    return
  }
  const at = cellAt(e.target); if (!at) return
  if (rowSel.value.size) rowSel.value = new Set()
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
  const under = document.elementFromPoint(e.clientX, e.clientY)
  if (drag.kind === 'rowsel') { const ri = rowIndexAt(under); if (ri >= 0 && rowAnchor.value != null) rowSel.value = pickRows(rows.value, rowSel.value, rowAnchor.value, ri, { shift: true }).sel; return }
  if (drag.kind === 'rows') {
    const tr = under?.closest?.('tr[data-id]'); if (!tr) return
    const ri = rowIndexAt(tr); const b = tr.getBoundingClientRect()
    dropAt.value = e.clientY > b.top + b.height / 2 ? ri + 1 : ri
    return
  }
  const at = cellAt(under); if (!at) return
  if (drag.kind === 'select') sel.value = norm(anchor.value, at)
  else { const b = drag.base; sel.value = { r0: b.r0, c0: b.c0, c1: b.c1, r1: Math.max(b.r1, at.ri) } }
}
function onMouseUp(e) {
  if (drag?.kind === 'fill' && sel.value.r1 > drag.base.r1) fillFrom(drag.base)
  // Klick auf eine markierte Zeile ohne Ziehen: nur noch diese (wie in Excel); gezogen: verschieben
  if (drag?.kind === 'rows') { if (dropAt.value != null && Math.abs(e.clientY - drag.y) > 3) doMove(dropAt.value); else if (Math.abs(e.clientY - drag.y) <= 3) pick(drag.from, e); dropAt.value = null }
  drag = null
}
// ---- Zeilen verschieben, löschen, kopieren, einfügen (alles erst beim Speichern im Journal)
function doMove(to) {
  if (props.deep === '1' || !data.value) return
  const before = data.value.rows.map(r => r.row.id).join()
  data.value.rows = moveRows(data.value.rows, rowSel.value, to)
  if (data.value.rows.map(r => r.row.id).join() !== before) store.toast(`${rowSel.value.size} Zeilen verschoben — noch nicht gespeichert`, 'ok')
}
function moveSel(where) { const to = moveTarget(rows.value, rowSel.value, where); if (to != null) doMove(to) }
const kidsOf = r => r.isNew ? 0 : tree.kids(r.row.id).length
function deleteRows() {
  const picked = selectedRows(); if (!picked.length) return
  const blocked = picked.filter(r => kidsOf(r) > 0)
  for (const r of picked) if (!kidsOf(r)) r.retired = true
  dropNewRetired(); rowSel.value = new Set(); sel.value = null
  const n = picked.length - blocked.length
  if (blocked.length) store.toast(`${blocked.length} Zeilen haben Kinder — erst die Kinder entfernen (im Baum)${n ? `; ${n} zum Löschen vorgemerkt` : ''}`)
  else store.toast(`${n} Zeilen zum Löschen vorgemerkt — speichern schreibt es, verwerfen holt sie zurück`, 'ok')
}
function undeleteRows() { for (const r of selectedRows()) r.retired = false }
// Zeilen als Tab-Text (alle Spalten, Listen über die Bezeichnung) — Excel nimmt das direkt
const rowText = r => columns.value.map(c => c.type === 'enum' && !c.multiple ? labelOf(c)(textOf(r, c)) : textOf(r, c)).join('\t')
function copyRows() { const picked = selectedRows(); if (!picked.length) return; navigator.clipboard?.writeText(picked.map(rowText).join('\n')); store.toast(`${picked.length} Zeilen kopiert`, 'ok') }
// Zeilen einfügen: aus dem Text neue Zeilen unter der Zeile — Spalten wie hier von links (die ★-Spalte zuerst)
function pasteRowsText(text, at) {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n').filter(l => l.trim() !== '')
  if (!lines.length) { store.toast('Zwischenablage ist leer'); return }
  let n = 0, locked = 0, bad = 0, i = at
  for (const line of lines) {
    const r = addRow(i++); if (!r) return
    line.split('\t').forEach((v, ci) => { const c = columns.value[ci]; if (!c || !String(v).trim()) return; const w = write(r, c, v); if (w === 'locked') locked++; else if (w === 'bad') bad++; else n++ })
  }
  store.toast(`${lines.length} Zeilen eingefügt, ${n} Zellen${locked ? `, ${locked} gesperrt` : ''}${bad ? `, ${bad} nicht in der Liste` : ''} — noch nicht gespeichert`, 'ok')
}
async function pasteRows(at) {
  let text = ''
  try { text = await navigator.clipboard.readText() } catch { store.toast('Zwischenablage nicht lesbar — Strg+V in einer Zelle fügt dort ein'); return }
  pasteRowsText(text, at)
}
function duplicateRows() {
  const picked = selectedRows(); if (!picked.length) return
  const at = rows.value.indexOf(picked[picked.length - 1]) + 1
  pasteRowsText(picked.map(rowText).join('\n'), at)
}
// Rechtsklick auf eine Zeile (Taloan, 21.09.): nicht markierte Zeile wird erst markiert, dann das Menü
function onRowMenu(e, ri) {
  if (e.target.closest('input, textarea, select, .cell-input')) return
  const r = rows.value[ri]; if (!r) return
  if (!rowSel.value.has(r.row.id)) { rowSel.value = new Set([r.row.id]); rowAnchor.value = ri; sel.value = null }
  const n = rowSel.value.size, picked = selectedRows(), one = n === 1 ? picked[0] : null
  const deep = props.deep === '1', lastAt = rows.value.indexOf(picked[picked.length - 1]) + 1
  const del = picked.filter(x => !x.retired), undel = picked.filter(x => x.retired)
  const label = roleLabel[childRole.value]?.replace(/n$/, '') ?? 'Zeile'
  // hint steht rechts in der Menüzeile (kurz), key ist die Taste im Menü; Sätze gehören in die Hilfe (?)
  menu.open(e, [
    { label: `${n} Zeile${n > 1 ? 'n' : ''} kopieren`, icon: '⧉', key: 'k', hint: 'Strg+C', action: copyRows },
    { label: 'darunter einfügen', icon: '⤵', key: 'e', hint: 'Zwischenablage → neue Zeilen', action: () => pasteRows(lastAt), disabled: deep },
    { label: `${n > 1 ? n + ' Zeilen' : label} duplizieren`, icon: '⧉', key: 'd', hint: 'Kopie darunter', action: duplicateRows, disabled: deep },
    { label: `neue ${label} darüber`, icon: '＋', key: 'n', action: () => addRow(rows.value.indexOf(picked[0])), disabled: deep },
    { sep: true },
    { label: 'nach oben', icon: '↑', key: 'o', action: () => moveSel('up'), disabled: deep },
    { label: 'nach unten', icon: '↓', key: 'u', action: () => moveSel('down'), disabled: deep },
    { label: 'an den Anfang', icon: '⤒', key: 'a', action: () => moveSel('top'), disabled: deep },
    { label: 'ans Ende', icon: '⤓', key: 'z', action: () => moveSel('bottom'), disabled: deep },
    { sep: true },
    one && !one.isNew ? { label: 'im Baum öffnen', icon: '↗', key: 'b', hint: '↗ Fenster', action: () => popup ? window.open(`/tree/${one.row.id}`, '_blank') : router.push(`/tree/${one.row.id}`) } : null,
    undel.length ? { label: `Löschen zurücknehmen (${undel.length})`, icon: '↶', key: 'r', action: undeleteRows } : null,
    { label: `${del.length} Zeile${del.length > 1 ? 'n' : ''} löschen`, icon: '✕', key: 'l', hint: del.some(kidsOf) ? `${del.filter(kidsOf).length} mit Kindern bleiben` : 'Strg+− · beim Speichern', action: deleteRows, danger: true, disabled: !del.length },
  ])
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
const inSel = (ri, ci) => (!!sel.value && ri >= sel.value.r0 && ri <= sel.value.r1 && ci >= sel.value.c0 && ci <= sel.value.c1) || (rowSel.value.size > 0 && rowSel.value.has(rows.value[ri]?.row.id))
const selCells = () => { const s = sel.value; if (!s) return []; const out = []; for (let ri = s.r0; ri <= s.r1; ri++) for (let ci = s.c0; ci <= s.c1; ci++) { const r = rows.value[ri], c = columns.value[ci]; if (r && c) out.push({ r, c, ri, ci }) } return out }
const canWrite = (r, c) => !r.retired && (c.virtual === 'label' ? !!labelCol(r) && editable(labelCol(r)) : editable(c) && !inactive(r, c))
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
// Ergänzungsvorschläge einer Spalte (Taloan, 20.09.): die Werte, die es in der Spalte schon gibt — nur Text, nicht bei langem Text
const suggestionsOf = c => { const seen = new Set(); for (const r of rows.value) { const v = String(textOf(r, c) ?? '').trim(); if (v && v.length <= 80 && !v.includes('\n')) seen.add(v) } return [...seen].sort((a, b) => a.localeCompare(b, 'de')) }
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
// Entf: eigene Werte im Bereich löschen — und sagen, warum nichts passiert (Taloan): gesperrt (Formel, Vorlage, Achse,
// gilt hier nicht) oder geerbt (der Wert steht am Vorfahren, hier gibt es nichts zu löschen)
function clearSel() {
  let n = 0, locked = 0, inheritedN = 0
  for (const { r, c } of selCells()) {
    if (!canWrite(r, c)) { locked++; continue }
    if (shown(r, c) != null) { set(r, c, ''); n++ } else if (inherited(r, c) != null) inheritedN++
  }
  if (n) store.toast(`${n} eigene Werte gelöscht — noch nicht gespeichert`)
  else if (locked || inheritedN) store.toast(`nichts zu löschen: ${locked ? locked + ' gesperrt (Formel/Vorlage/Achse)' : ''}${locked && inheritedN ? ', ' : ''}${inheritedN ? inheritedN + ' geerbt — der Wert steht am Vorfahren' : ''}`)
}
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
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') { e.preventDefault(); repFind.value?.focus(); repFind.value?.select(); return }
  if (inField || e.target.classList?.contains('cell-input')) return
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); e.shiftKey ? fillSeries() : fillDown() }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && document.activeElement?.closest?.('table.tab')) { e.preventDefault(); sel.value = { r0: 0, r1: rows.value.length - 1, c0: 0, c1: columns.value.length - 1 } }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && rowSel.value.size && !window.getSelection()?.toString()) { e.preventDefault(); copyRows() }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && sel.value && !window.getSelection()?.toString()) { e.preventDefault(); copySel() }
  else if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === 'Subtract') && rowSel.value.size) { e.preventDefault(); deleteRows() }
  else if (e.key === ' ' && e.shiftKey && document.activeElement?.closest?.('td.cell')) { const at = cellAt(document.activeElement); if (at) { e.preventDefault(); pick(at.ri, { ctrlKey: e.ctrlKey }) } }
  else if (e.key === 'Delete' && rowSel.value.size) { e.preventDefault(); const s0 = sel.value; sel.value = { r0: 0, r1: rows.value.length - 1, c0: 0, c1: columns.value.length - 1 }; const keep = rowSel.value; rowSel.value = new Set(); let n = 0; for (const { r, c } of selCells()) if (keep.has(r.row.id) && canWrite(r, c) && shown(r, c) != null) { set(r, c, ''); n++ } rowSel.value = keep; sel.value = s0; store.toast(n ? `${n} eigene Werte gelöscht — noch nicht gespeichert (Zeilen löschen: Strg+− oder Rechtsklick)` : 'nichts zu löschen — Zeilen selbst löschen: Strg+− oder Rechtsklick') }
  else if (e.key === 'Delete' && sel.value && (sel.value.r0 !== sel.value.r1 || sel.value.c0 !== sel.value.c1 || !canWrite(rows.value[sel.value.r0], columns.value[sel.value.c0]))) { e.preventDefault(); clearSel() }
  else if (e.key === 'Escape' && (sel.value || rowSel.value.size)) { sel.value = null; rowSel.value = new Set() }
}
// Enter auf einer markierten Zelle (nicht in der Eingabe) springt nach unten wie in Excel, Umschalt+Enter nach oben (Taloan, 21.09.) —
// vor der Zelle selbst (capture), die Enter sonst als „bearbeiten“ nimmt; bearbeiten bleibt F2, Doppelklick oder tippen
function onEnterCapture(e) {
  if (e.key !== 'Enter' || e.ctrlKey || e.altKey) return
  const t = e.target
  if (!t?.closest?.('td.cell') || t.classList?.contains('cell-input') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
  // in der letzten Zeile: Enter hängt eine neue Zeile an und springt hinein (Taloan, 21.09.)
  const at = cellAt(t)
  if (at && !e.shiftKey && at.ri === rows.value.length - 1 && data.value && props.deep !== '1') { e.preventDefault(); e.stopPropagation(); addRow(); nextTick(() => { const to = focusCell(rows.value.length - 1, at.ci); if (to) { anchor.value = to; sel.value = norm(to, to) } }); return }
  if (move(e, e.shiftKey ? -1 : 1, 0)) e.stopPropagation()
}
onMounted(() => { document.addEventListener('paste', onPaste); document.addEventListener('keydown', onKey); document.addEventListener('keydown', onEnterCapture, true); document.addEventListener('mousedown', onMouseDown, true); document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp); window.addEventListener('pagehide', onPageHide) })
onUnmounted(() => { document.removeEventListener('paste', onPaste); document.removeEventListener('keydown', onKey); document.removeEventListener('keydown', onEnterCapture, true); document.removeEventListener('mousedown', onMouseDown, true); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); window.removeEventListener('pagehide', onPageHide) })

const listOf = c => model.value?.lists?.find(l => l.key === c.list)
const labelOf = c => v => { const l = listOf(c)?.values.find(x => x.value === v)?.label; return l?.[locale.value] || l?.de || l?.en || Object.values(l ?? {}).find(Boolean) || v }
</script>

<template>
  <div class="pane" style="flex:1" v-if="data">
    <div class="toolbar path">
      <router-link v-for="a in tree.ancestors(id)" :key="a.id" :to="`/tree/${a.id}`" class="crumb">{{ icon(a.role) }} {{ a.label }} ›</router-link>
      <router-link :to="`/tree/${id}`" class="crumb">{{ icon(data.node.role) }} {{ data.node.label }}</router-link>
      <h1>⊞ {{ deep === '1' ? 'Alle ' + (roleLabel[childRole] ?? childRole) + ' darunter' : 'Subitems' }} <span class="muted">· {{ rows.length }}</span></h1>
      <span class="grow" />
      <span v-if="busy" class="muted">{{ busy }}</span>
      <span v-if="dirty.size" class="chip dirty" :title="`${dirty.size} geänderte Zellen — Strg+S speichert`">✎ {{ dirty.size }}</span>
      <span v-if="fresh" class="chip ok" :title="`${fresh} neue Zeilen — speichern legt die Knoten an`">＋ {{ fresh }}</span>
      <span v-if="retired" class="chip bad" :title="`${retired} Zeilen zum Löschen vorgemerkt — speichern schreibt es, verwerfen holt sie zurück`">✕ {{ retired }}</span>
      <span v-if="moved" class="chip" :title="`${moved} Zeilen verschoben — speichern schreibt die Reihenfolge`">↕ {{ moved }}</span>
      <span v-if="rowSel.size" class="chip" :title="`${rowSel.size} Zeilen markiert — Rechtsklick für kopieren, einfügen, verschieben, löschen`">▤ {{ rowSel.size }}</span>
      <template v-if="popup">
        <button class="primary" :disabled="!!busy" @click="applyAndClose" title="Änderungen als ein Stapel ins Journal und Fenster schliessen — Schliessen über X tut dasselbe">✓ übernehmen &amp; schliessen</button>
        <button :disabled="!!busy" @click="discardAndClose" title="Änderungen verwerfen und Fenster schliessen">✗ verwerfen</button>
      </template>
      <template v-else>
        <button class="primary" :disabled="!hasChanges || !!busy" @click="save" title="alle Änderungen als ein Stapel ins Journal (Strg+S)">💾 speichern</button>
        <button :disabled="!hasChanges" @click="discard" title="Änderungen verwerfen — auch gelöschte und verschobene Zeilen">verwerfen</button>
      </template>
    </div>
    <div class="toolbar view">
      <span class="muted">Sprache</span>
      <span v-for="l in locales" :key="l" class="view-chip" :class="{ on: locale === l }" @click="locale = l">{{ l }}</span>
      <span class="sep">·</span>
      <select v-model="viewKey" title="Attributsicht: welche Spalten, in welcher Reihenfolge"><option value="">◫ alle Attribute ({{ data.columns.length }})</option><option v-for="v in views" :key="v.key" :value="v.key">◫ {{ v.label?.de || v.key }}</option></select>
      <input v-model="filter" type="search" placeholder="Spalte …" style="width:160px" title="Spalten nach Name oder Schlüssel filtern" />
      <span v-if="filter" class="muted">{{ attrColumns.length }} von {{ data.columns.length }}</span>
      <span class="grow" />
      <button v-if="props.deep !== '1'" @click="addRow" :title="`neue ${roleLabel[childRole]?.replace(/n$/, '') ?? 'Zeile'} unter ${data?.node?.label ?? ''} — Werte eintragen, speichern legt den Knoten an`">+ Zeile</button>
      <button @click="fillDown" :disabled="!sel" title="runterziehen: oberste Zelle des Bereichs in alle darunter (Strg+D)">⇩ füllen</button>
      <button @click="fillSeries" :disabled="!sel" title="Reihe fortsetzen: 1, 2 → 3, 4 · Art-001 → Art-002 (Strg+Shift+D)">⇣ Reihe</button>
      <button class="x" title="Bedienung" @click="dialog.help({ title: 'Tabelle bedienen', rows: HELP })">?</button>
    </div>
    <div class="toolbar replace">
      <span class="muted">⇄</span>
      <input ref="repFind" v-model="rep.find" type="text" placeholder="suchen (Strg+H)" style="width:180px" @keydown.enter="replaceAll" @keydown.esc="rep.find = ''; rep.with = ''" />
      <input v-model="rep.with" type="text" placeholder="ersetzen durch" style="width:180px" @keydown.enter="replaceAll" @keydown.esc="rep.find = ''; rep.with = ''" />
      <label><input type="checkbox" v-model="rep.all" /> ganze Tabelle</label>
      <label><input type="checkbox" v-model="rep.caseSensitive" /> Gross/Klein</label>
      <label><input type="checkbox" v-model="rep.whole" /> ganze Zelle</label>
      <span class="muted">{{ rep.find ? replaceHits + ' Treffer' + (rep.all || !sel ? '' : ' im Bereich') : '' }}</span>
      <button class="primary" :disabled="!replaceHits" @click="replaceAll">alle ersetzen</button>
    </div>
    <div class="scroll" ref="scrollBox" style="position:relative">
      <div v-if="handle" class="fill-handle" :style="`top:${handle.top}px;left:${handle.left}px`" title="Ausfüllkästchen: nach unten ziehen füllt — ein Wert wiederholt sich, zwei Zahlen setzen die Reihe fort" />
      <table class="grid values tab" :style="`width:${tableWidth}px`">
        <colgroup><col :style="`width:${ROWSEL_W}px`" /><col v-for="c in columns" :key="c.key" :style="`width:${colWidth(c)}px`" /></colgroup>
        <thead><tr>
          <th class="rowsel" title="Klick markiert alle Zeilen" style="position:sticky">▤</th>
          <th v-for="c in columns" :key="c.key" :title="headTitle(c)" :class="[{ ro: !editable(c) && c.virtual !== 'label' }, kindOf(c)]" style="position:sticky">{{ headText(c) }}<span v-if="headLocale(c)" class="suffix" title="sprachabhängig — Spalte zeigt die gewählte Sprache">{{ locale }}</span><span v-if="c.unit" class="suffix">{{ c.unit }}</span><span class="col-resize" title="Breite ziehen · Doppelklick = Autofit" @mousedown="startResize($event, c)" @dblclick.stop="delete widths[c.key]; widths = { ...widths }" /></th>
        </tr></thead>
        <tbody>
          <tr v-for="(r, ri) in rows" :key="r.row.id" :data-id="r.row.id" :class="{ del: r.retired, 'drop-before': dropAt === ri, 'drop-after': dropAt === rows.length && ri === rows.length - 1 }" @contextmenu="onRowMenu($event, ri)">
            <td class="rowsel" :class="{ on: rowSel.has(r.row.id), new: r.isNew, moved: r.moved }" :title="(r.retired ? 'zum Löschen vorgemerkt · ' : r.isNew ? 'neue Zeile · ' : r.moved ? 'verschoben · ' : '') + 'Klick = Zeile markieren, Strg = dazu, Shift = Bereich · Rechtsklick = Menü · markierte Zeilen ziehen = verschieben'">{{ r.retired ? '✕' : r.isNew ? '＋' : ri + 1 }}</td>
            <template v-for="(c, ci) in columns" :key="c.key">
              <!-- ★-Spalte: die Zelle des Attributs, das diese Zeile benennt; ohne ★ (fixierter Name, SKU/Id) nur lesend -->
              <td v-if="c.virtual === 'label' && !labelCol(r)" class="cell label" :class="{ sel: inSel(ri, ci) }"><div class="cell-box locked" tabindex="0" :title="r.row.name ? 'fixierter Name (Rechtsklick im Baum → Benennung lösen)' : 'kein ★-Attribut gilt hier — Name aus SKU/Achsen/Id'">{{ icon(r.row.role) }} {{ r.row.label }}</div></td>
              <SelectCell v-else-if="c.virtual === 'label' && labelCol(r).type === 'enum' && !labelCol(r).multiple" :click-edit="false" class="label" :class="{ dirty: dirty.has(key(r, c)), sel: inSel(ri, ci) }" :value="shown(r, c)" :inherited="inherited(r, c)" :options="listOf(labelCol(r))?.values.map(v => v.value) ?? []" :label-of="labelOf(labelCol(r))" :required="!!labelCol(r).required" :list="labelCol(r).list" @save="v => set(r, c, v)" />
              <Cell v-else-if="c.virtual === 'label'" :click-edit="false" class="label" :class="{ dirty: dirty.has(key(r, c)), sel: inSel(ri, ci) }" :value="shown(r, c)" :inherited="inherited(r, c)" :origin="`★ ${labelCol(r).label?.de || labelCol(r).key}`" :suggest="suggestionsOf(c)" @save="v => set(r, c, v)" />
              <td v-else-if="c.virtual" class="cell" :class="{ sel: inSel(ri, ci) }"><div class="cell-box locked mono" tabindex="0" title="Variantenachsen — fest">{{ inherited(r, c) ?? '' }}</div></td>
              <td v-else-if="inactive(r, c)" class="cell" :class="{ sel: inSel(ri, ci) }"><div class="cell-box disabled" tabindex="0" title="gilt an diesem Knoten nicht"></div></td>
              <td v-else-if="!editable(c)" class="cell" :class="{ sel: inSel(ri, ci) }"><div class="cell-box locked" tabindex="0" :title="c.type + ' — in der Knotenansicht bearbeiten'" @dblclick="popup || router.push(`/tree/${r.row.id}`)">{{ (shown(r, c) ?? inherited(r, c) ?? '').toString().replace(/<[^>]+>/g, ' ').slice(0, 80) }}</div></td>
              <ToggleCell v-else-if="c.type === 'boolean'" :class="{ dirty: dirty.has(key(r, c)), sel: inSel(ri, ci) }" :value="shown(r, c)" :inherited="inherited(r, c)" @save="v => set(r, c, v)" />
              <SelectCell v-else-if="c.type === 'enum' && !c.multiple" :click-edit="false" :class="{ dirty: dirty.has(key(r, c)), sel: inSel(ri, ci) }" :value="shown(r, c)" :inherited="inherited(r, c)" :options="listOf(c)?.values.map(v => v.value) ?? []" :label-of="labelOf(c)" :required="!!c.required" :list="c.list" @save="v => set(r, c, v)" />
              <HtmlCell v-else-if="c.type === 'html'" :click-edit="false" :class="{ dirty: dirty.has(key(r, c)), sel: inSel(ri, ci) }" :value="shown(r, c)" :inherited="inherited(r, c)" :title="`${store.name(c)} · ${r.row.label}`" @save="v => set(r, c, v)" />
              <DateCell v-else-if="c.type === 'date'" :class="{ dirty: dirty.has(key(r, c)), sel: inSel(ri, ci) }" :value="shown(r, c)" :inherited="inherited(r, c)" @save="v => set(r, c, v)" />
              <Cell v-else :click-edit="false" :class="{ dirty: dirty.has(key(r, c)), sel: inSel(ri, ci) }" :value="shown(r, c)" :inherited="inherited(r, c)" :suggest="suggestionsOf(c)" @save="v => set(r, c, v)" />
            </template>
          </tr>
        </tbody>
      </table>
      <div v-if="!data.rows.length" class="empty">Keine {{ roleLabel[childRole] }} unter {{ data.node.label }}.</div>
    </div>
    <div v-if="tabs.length > 1" class="toolbar sheets">
      <span class="sheet" :class="{ on: !tab }" @click="tab = ''" title="alle Attribute">alle</span>
      <span v-for="g in tabs" :key="g.key" class="sheet" :class="{ on: tab === g.key }" @click="tab = g.key" :title="`${g.label} ⟨${g.key}⟩ · ${g.n} Spalten`"><span class="lbl">{{ g.label }}</span> <span class="muted">{{ g.n }}</span></span>
    </div>
  </div>
  <div v-else class="pane" style="flex:1"><div class="empty">…</div></div>
</template>

<style scoped>
.path { flex-wrap: wrap; row-gap: 2px; }
/* Blattreiter wie in Excel: unten, das gewählte hell */
.sheets { gap: 0; padding: 0 6px; border-top: 1px solid var(--line); overflow-x: auto; font-size: 12px; }
.sheet { padding: 3px 10px; border: 1px solid var(--line); border-top: 0; border-radius: 0 0 6px 6px; margin-right: 2px; color: var(--muted); cursor: pointer; white-space: nowrap; background: var(--pane); }
.sheet { display: inline-flex; gap: 4px; align-items: center; }
.sheet .lbl { max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
.sheet.on { color: var(--text); background: var(--bg); font-weight: 600; border-color: var(--accent); }
.crumb { color: var(--muted); text-decoration: none; }
.crumb:hover { color: var(--text); }
.tab th.ro { color: var(--muted); font-style: italic; }
/* Kopf wie im Excel-Export (Taloan, 20.09.): Pflicht dunkelrot, Achse dunkelgrün, Kennung dunkelgrau — weisse Schrift */
.tab th.required { background: #c00000; color: #fff; font-style: normal; }
.tab th.axis { background: #375623; color: #fff; font-style: normal; }
.tab th.info { background: #595959; color: #fff; font-style: normal; }
.tab th .suffix { margin-left: 5px; font-size: 10px; font-weight: normal; opacity: .6; }
/* Tabellengefühl (Taloan): Zellen dicht an dicht mit Gitterlinien statt Kästchen mit Luft; Zeilen flacher */
.tab th, .tab td { padding: 0; border-right: 1px solid var(--line); height: 24px; }
.tab th { padding: 0 6px; }
.tab td.attr, .tab td.mono { padding: 0 6px; }
.tab :deep(td.cell) { padding: 0; }
.tab :deep(.cell-box), .tab :deep(.cell-input), .tab :deep(.cell-select), .tab :deep(.cell-date) { height: 24px; border-radius: 0; border-color: transparent; background: transparent; }
.tab :deep(.cell-box:focus) { border-color: var(--accent); background: transparent; }
.tab :deep(.cell-input) { border-color: var(--accent); background: var(--pane); }
/* Zeilenspalte (Nummer) und die Namensspalte daneben bleiben beim Rollen nach rechts stehen — man muss wissen, was man bearbeitet (Taloan) */
.tab th:first-child, .tab :deep(td:first-child) { position: sticky; left: 0; z-index: 2; background: var(--pane); }
.tab th:nth-child(2), .tab :deep(td:nth-child(2)) { position: sticky; left: 40px; z-index: 2; background: var(--bg); box-shadow: 1px 0 0 var(--line); }
.tab :deep(td.label .cell-box:not(.locked)) { font-weight: 600; }
.tab th:first-child, .tab th:nth-child(2) { z-index: 3; }
/* Zeilenspalte wie in Excel: grau, Klick markiert die Zeile; markiert = Akzent; gelöscht = durchgestrichen; Strich = Ablageplatz beim Ziehen */
.tab td.rowsel, .tab th.rowsel { text-align: center; color: var(--muted); font-size: 11px; cursor: pointer; user-select: none; padding: 0; background: var(--pane); border-right: 1px solid var(--line); }
.tab th.rowsel { font-size: 12px; }
.tab td.rowsel:hover, .tab th.rowsel:hover { color: var(--text); }
.tab td.rowsel.on { background: var(--accent); color: #fff; }
.tab td.rowsel.new { color: var(--ok); }
.tab td.rowsel.moved::after { content: '↕'; margin-left: 2px; opacity: .6; }
.tab :deep(tr.del td) { text-decoration: line-through; opacity: .55; }
.tab :deep(tr.del td.rowsel) { color: var(--bad); text-decoration: none; opacity: 1; }
.tab :deep(tr.drop-before td) { box-shadow: inset 0 2px 0 var(--accent); }
.tab :deep(tr.drop-after td) { box-shadow: inset 0 -2px 0 var(--accent); }
.chip.ok { color: var(--ok); }
.chip.bad { color: var(--bad); }
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
