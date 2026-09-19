<script setup>
// Produktgruppe → … → Produkt → Variante als Baum links; Anlegen inline in
// der Werkzeugleiste; rechts der gewählte Knoten (NodeView). Tastatur: ↑↓
// wählen, → auf, ← zu, Enter öffnen, / Filter.
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog as ask } from '../dialog.js'
import { tree, icon } from '../tree.js'
import { menu } from '../menu.js'
import { groupsAt, neededByNode, missingGroups, confirmMove } from '../orphans.js'
import { plugins } from '../plugins.js'
import NodeView from './NodeView.vue'
import Splitter from '../components/Splitter.vue'
import { paneWidth } from '../panes.js'
const treeW = paneWidth('tree', 300)

const props = defineProps({ id: String })
const router = useRouter()
const q = ref('')
const search = ref(null)
const hits = ref(new Map())   // Server-Suche: id → Fundstelle
// Suche mit Bedingungen (Taloan): Chips key:value in der Zeile; Vorschläge am Cursor wie in einer IDE —
// ohne ':' die Schlüssel, danach die passenden Werte. Kein Formular (Taloan: "gut gemeint, schlecht gemacht").
const hasTerms = computed(() => /(^|\s)-?[a-z]+:/.test(q.value))
const KEYS = [
  ['attr:', 'Attribut hat eigenen Wert · =Muster · = leer'], ['empty:', 'fehlt, auch geerbt nicht (Attribut/Sprache)'],
  ['incomplete:', 'Vollständigkeit nicht erreicht (Kanal)'], ['role:', 'Gruppe / Produkt / Variante'],
  ['status:', 'Entwurf / aktiv / ausgelaufen'], ['group:', 'Attributgruppe gilt hier'],
  ['under:', 'nur im Teilbaum eines Knotens'], ['by:', 'Urheber der letzten Änderung'], ['since:', 'geändert seit (Datum)'],
  ['media:', 'hat Medien: any · image / document · Name (*.pdf)'], ['rel:', 'hat Relation: any · Typ · Typ=Partner (Name, SKU, Id)'],
]
const sugg = ref([])          // [{ value, label, hint }]
const suggIdx = ref(0)
const de = x => x?.label?.de || x?.key
function tokenAt() {
  const el = search.value; if (!el) return null
  const pos = el.selectionStart ?? q.value.length
  const before = q.value.slice(0, pos); const start = before.search(/\S+$/)
  return { start: start < 0 ? pos : start, end: pos, token: start < 0 ? '' : before.slice(start) }
}
function suggest() {
  const t = tokenAt(); if (!t) { sugg.value = []; return }
  const tok = t.token, m = store.model, out = []
  const day = d => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10)
  const neg = tok.startsWith('-') ? '-' : ''
  const word = neg ? tok.slice(1) : tok
  if (!word.includes(':')) {
    const low = word.toLowerCase()
    // Schlüssel nur, wenn das Feld leer ist oder gerade ein Schlüssel getippt wird — nicht nach jedem Chip
    if (!low && q.value.trim()) { sugg.value = []; return }
    for (const [k, h] of KEYS) if (!low || k.startsWith(low)) out.push({ value: neg + k, label: neg + k, hint: neg ? 'NICHT: ' + h : h })
    if (!low) out.push({ value: '-', label: '-', hint: 'Minus davor verneint: -empty:x, -role:variant, -Wort' })
  } else {
    const [key, rest] = [word.slice(0, word.indexOf(':') + 1), word.slice(word.indexOf(':') + 1)]
    const low = rest.toLowerCase()
    const attrs = (m?.attributes ?? []).filter(a => !low || a.key.toLowerCase().includes(low) || (a.label?.de ?? '').toLowerCase().includes(low))
    if (key === 'attr:' && !rest.includes('=')) {
      const exact = (m?.attributes ?? []).find(a => a.key === rest)
      if (exact) { out.push({ value: `attr:${rest}`, label: `${de(exact)} hat Wert`, hint: 'eigener Wert, nicht geerbt' }, { value: `attr:${rest}=`, label: `${de(exact)} leer`, hint: 'kein eigener Wert' }, { value: `attr:${rest}=*`, label: `${de(exact)} = Muster…`, hint: '* steht für beliebig, z. B. *sku*' }) }
      for (const a of attrs.slice(0, 12)) if (a.key !== rest) out.push({ value: `attr:${a.key}`, label: de(a), hint: a.key })
    } else if (key === 'empty:') {
      const [ak, loc] = rest.split('/')
      if (rest.includes('/')) { const a = (m?.attributes ?? []).find(x => x.key === ak); for (const l of (a?.perLocale ? m.locales : [])) if (!loc || l.code.startsWith(loc)) out.push({ value: `empty:${ak}/${l.code}`, label: `${de(a)} / ${l.code}`, hint: 'in dieser Sprache leer' }) }
      else for (const a of attrs.slice(0, 12)) out.push({ value: `empty:${a.key}` + (a.perLocale ? '/' : ''), label: de(a), hint: a.perLocale ? a.key + ' — dann Sprache' : a.key })
    } else if (key === 'incomplete:') for (const c of (m?.channels ?? []).filter(c => c.key.startsWith(low))) out.push({ value: `incomplete:${c.key}`, label: de(c), hint: c.key })
    else if (key === 'role:') for (const [v, l] of [['group', '▣ Gruppe'], ['product', '▦ Produkt'], ['variant', '◆ Variante']]) if (v.startsWith(low)) out.push({ value: `role:${v}`, label: l, hint: v })
    else if (key === 'status:') for (const [v, l] of [['draft', '○ Entwurf'], ['active', '● aktiv'], ['discontinued', '✗ ausgelaufen']]) if (v.startsWith(low)) out.push({ value: `status:${v}`, label: l, hint: v })
    else if (key === 'group:') for (const g of (m?.groups ?? []).filter(g => !low || g.key.toLowerCase().includes(low) || (g.label?.de ?? '').toLowerCase().includes(low))) out.push({ value: `group:${g.key}`, label: de(g), hint: g.key })
    else if (key === 'under:') { for (const a of [...(props.id ? tree.ancestors(props.id) : []), selected.value].filter(Boolean).reverse()) if (!low || a.label.toLowerCase().includes(low) || a.id.includes(low)) out.push({ value: `under:${a.id}`, label: `${icon(a.role)} ${a.label}`, hint: a.id === props.id ? 'hier' : a.id }) }
    else if (key === 'media:') { out.push({ value: 'media:any', label: 'irgendein Medium', hint: 'hat mindestens eines' }); for (const t of (m?.relationTypes ?? []).filter(t => (t.to ?? []).includes('media') && t.key.startsWith(low))) out.push({ value: `media:${t.key}`, label: t.label?.de || t.key, hint: 'Relationstyp' }); if (low) out.push({ value: `media:${low}`, label: `Name enthält „${low}“`, hint: '* = beliebig' }) }
    else if (key === 'rel:' && rest.includes('=')) { const [t, p] = rest.split('='); for (const r of tree.rows.filter(r => p && (r.label.toLowerCase().includes(p.toLowerCase()) || (r.sku ?? '').toLowerCase().includes(p.toLowerCase()))).slice(0, 8)) out.push({ value: `rel:${t}=${r.sku || r.id}`, label: `${icon(r.role)} ${r.label}`, hint: `Partner der Relation${r.sku ? ' · ' + r.sku : ''}` }) }
    else if (key === 'rel:') { out.push({ value: 'rel:any', label: 'irgendeine Relation', hint: 'zu anderen Knoten' }); for (const t of (m?.relationTypes ?? []).filter(t => !(t.to ?? []).includes('media') && t.key.startsWith(low))) out.push({ value: `rel:${t.key}`, label: t.label?.de || t.key, hint: (t.symmetric ? 'symmetrisch' : 'gerichtet') + ' — mit = danach der Partner' }) }
    else if (key === 'since:') for (const [d, l] of [[0, 'heute'], [1, 'seit gestern'], [7, 'letzte 7 Tage'], [30, 'letzte 30 Tage']]) out.push({ value: `since:${day(d)}`, label: l, hint: day(d) })
    else if (key === 'by:' && store.actor && store.actor.toLowerCase().startsWith(low)) out.push({ value: `by:${store.actor}`, label: `👤 ${store.actor}`, hint: 'ich' })
  }
  sugg.value = neg ? out.map(s => s.value.startsWith('-') ? s : { ...s, value: '-' + s.value, label: '¬ ' + s.label }) : out; suggIdx.value = 0
}
function accept(s) {
  const t = tokenAt(); if (!t) return
  const tail = /[:=/-]$/.test(s.value) ? '' : ' '
  q.value = q.value.slice(0, t.start) + s.value + tail + q.value.slice(t.end).replace(/^\s+/, '')
  nextTick(() => { const pos = t.start + s.value.length + tail.length; search.value?.setSelectionRange(pos, pos); suggest() })
}
function onSearchKey(e) {
  if (sugg.value.length) {
    if (e.key === 'ArrowDown') { e.preventDefault(); suggIdx.value = (suggIdx.value + 1) % sugg.value.length; return }
    if (e.key === 'ArrowUp') { e.preventDefault(); suggIdx.value = (suggIdx.value + sugg.value.length - 1) % sugg.value.length; return }
    if (e.key === 'Enter' || (e.key === 'Tab' && tokenAt()?.token)) { e.preventDefault(); accept(sugg.value[suggIdx.value]); return }   // Tab im leeren Feld wandert weiter
    if (e.key === 'Escape') { e.preventDefault(); sugg.value = []; return }
  }
  if (e.key === 'ArrowDown') { e.preventDefault(); list.value?.focus() }
  if (e.key === 'Escape') { q.value = '' }
}
// Erkannte Bedingungen als Chips (× nimmt sie raus); freier Text bleibt nur in der Zeile
const terms = computed(() => q.value.split(/\s+/).filter(w => /^-?[a-z]+:/.test(w)))
// „setTimeout“ gibt es in Vue-Vorlagen nicht (Absturz „K.setTimeout is not a function“, Taloan) — darum hier
function hideSugg() { setTimeout(() => { sugg.value = [] }, 150) }
function dropTerm(t) { q.value = q.value.split(/\s+/).filter(w => w !== t).join(' ') }
let searchTimer = null
const list = ref(null)
const creating = ref(null)     // null | 'group' | 'product' | 'variant'
const form = ref({})

onMounted(async () => { if (!tree.loaded) await tree.load(); reveal() })
// Der Pfad zum gewählten Knoten ist immer aufgeklappt.
function reveal() { if (props.id) for (const a of tree.ancestors(props.id)) tree.expand(a.id) }
watch(() => props.id, reveal)
// merken, wo man war — der Leistenknopf ▣ Baum kehrt dorthin zurück (auch nach Modell, Plugin …)
watch(() => props.id, id => { if (id) { store.lastNode = id; try { sessionStorage.setItem('journali.lastNode', id) } catch {} } }, { immediate: true })

const selected = computed(() => props.id ? tree.byId.get(props.id) : null)

// Filter: Label/SKU/Id sofort im Client, ab 2 Zeichen zusätzlich die Server-Suche über alle Werte.
watch(q, v => {
  clearTimeout(searchTimer)
  const s = v.trim()
  if (s.length < 2 && !/^-?[a-z]+:/.test(s)) { hits.value = new Map(); return }
  searchTimer = setTimeout(async () => {
    try { hits.value = new Map((await api.get(`/api/search?q=${encodeURIComponent(s)}`)).map(h => [h.row.id, h.hit])) }
    catch (e) { store.toast(e.message) }
  }, 250)
})

// Sichtbare Zeilen: aufgeklappt oder — mit Filter — alle Treffer samt Pfad.
const visible = computed(() => {
  const f = q.value.trim().toLowerCase()
  const out = []
  if (f) {
    const keep = new Set()
    for (const r of tree.rows)
      if (hits.value.has(r.id) || (!hasTerms.value && (r.label.toLowerCase().includes(f) || (r.sku ?? '').toLowerCase().includes(f) || r.id.includes(f)))) {
        keep.add(r.id)
        for (const a of tree.ancestors(r.id)) keep.add(a.id)
      }
    const walk = (parent, depth) => {
      for (const r of tree.kids(parent)) if (keep.has(r.id)) { out.push({ r, depth, isOpen: true }); walk(r.id, depth + 1) }
    }
    walk(null, 0)
  } else {
    const walk = (parent, depth) => {
      for (const r of tree.kids(parent)) {
        const isOpen = tree.expanded.has(r.id)
        out.push({ r, depth, isOpen })
        if (isOpen) walk(r.id, depth + 1)
      }
    }
    walk(null, 0)
  }
  return out
})

function openTable(path) {
  const w = Math.min(1400, screen.availWidth - 80), h = Math.min(800, screen.availHeight - 80)
  const win = window.open(path, 'journali-table', `popup=yes,width=${w},height=${h},left=${(screen.availWidth - w) / 2},top=${(screen.availHeight - h) / 2}`)
  if (win) win.focus(); else router.push(path.replace(/[?&]popup=1/, ''))
}
function open(row) { router.push(`/tree/${row.id}`) }

// ---- Die Auswahl (Taloan, 17.09.; Wort „Auswahl“ statt „Menge“): Strg+Klick sammelt, Shift+Klick nimmt den Bereich
// der sichtbaren Zeilen, „☑ Treffer“ nimmt alle sichtbaren (z. B. ein Suchergebnis). Ein einfacher Klick öffnet nur — die Auswahl bleibt.
const picked = ref(new Set())
const pickAnchor = ref(null)
function onRowClick(e, r) {
  if (e.ctrlKey || e.metaKey) { const s = new Set(picked.value); s.has(r.id) ? s.delete(r.id) : s.add(r.id); picked.value = s; pickAnchor.value = r.id; return }
  if (e.shiftKey && pickAnchor.value) {
    const ids = visible.value.map(x => x.r.id); const a = ids.indexOf(pickAnchor.value), b = ids.indexOf(r.id)
    if (a >= 0 && b >= 0) { const s = new Set(picked.value); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) s.add(ids[i]); picked.value = s }
    return
  }
  pickAnchor.value = r.id
  open(r)
}
const pickVisible = () => { picked.value = new Set(visible.value.map(x => x.r.id)) }
const pickedRows = computed(() => [...picked.value].map(id => tree.byId.get(id)).filter(Boolean))

// ---- Verknüpfen: Auswahl → Ziel (per Shift+Ablegen oder Suche), dann Typ, Richtung, Werte je Eintrag; ein Stapel
const link = ref(null)   // { target, type, dir: 'target-first' | 'set-first', q, vals: { id: { attr: v } }, existing }
const relTypes = computed(() => (store.model?.relationTypes ?? []).filter(t => !(t.to ?? []).includes('media')))
const linkType = computed(() => relTypes.value.find(t => t.key === link.value?.type) ?? null)
const linkAttrs = computed(() => { const g = linkType.value?.group; return g ? (store.model?.attributes ?? []).filter(a => a.group === g && a.type !== 'rows' && a.type !== 'html') : [] })
async function openLink(target) {
  if (!pickedRows.value.length) { store.toast('Erst auswählen: Strg+Klick im Baum'); return }
  link.value = { target, type: relTypes.value[0]?.key ?? '', dir: 'target-first', q: '', vals: {}, existing: null, all: {} }
  await loadExisting()
}
async function loadExisting() {
  if (!link.value?.target) return
  try {
    const rs = await api.get(`/api/nodes/${encodeURIComponent(link.value.target.id)}/relations`)
    link.value.existing = { out: new Set(rs.out.map(r => `${r.type}|${r.to}`)), in: new Set(rs.in.map(r => `${r.type}|${r.from}`)) }
  } catch (e) { store.toast(e.message) }
}
const linkMatches = computed(() => {
  const q = (link.value?.q ?? '').trim().toLowerCase(); if (!q) return []
  return tree.rows.filter(r => !picked.value.has(r.id) && (r.label.toLowerCase().includes(q) || (r.sku ?? '').toLowerCase().includes(q) || r.id.includes(q))).slice(0, 12)
})
// Welche der Auswahl sind für Typ und Richtung erlaubt, welche gibt es schon?
const linkRows = computed(() => {
  // ohne Ziel (⇄ aus der Leiste: Ziel wird erst gesucht) keine Zeilen — sonst l.target.id auf null (Taloan, 17.09.: Absturz)
  const l = link.value, t = linkType.value; if (!l || !t || !l.target) return []
  const targetFirst = l.dir === 'target-first'   // Ziel → Eintrag (Ziel hat Zubehör: Eintrag)
  return pickedRows.value.map(r => {
    const from = targetFirst ? l.target : r, to = targetFirst ? r : l.target
    const roleOk = (!t.from || t.from.includes(from.role)) && (!t.to || t.to.includes(to.role))
    const exists = l.existing && (targetFirst ? l.existing.out.has(`${t.key}|${r.id}`) : l.existing.in.has(`${t.key}|${r.id}`))
      || (t.symmetric && l.existing && (l.existing.out.has(`${t.key}|${r.id}`) || l.existing.in.has(`${t.key}|${r.id}`)))
    return { r, ok: roleOk && r.id !== l.target.id, exists: !!exists }
  })
})
const linkCount = computed(() => linkRows.value.filter(x => x.ok && !x.exists).length)
function fillAll(attr, v) { for (const x of linkRows.value) { link.value.vals[x.r.id] ??= {}; link.value.vals[x.r.id][attr] = v } }
async function runLink() {
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  const l = link.value, t = linkType.value; if (!l || !t) return
  const cmds = []
  let n = 0
  for (const x of linkRows.value) {
    if (!x.ok || x.exists) continue
    const ref = 'l' + (++n)
    const from = l.dir === 'target-first' ? l.target.id : x.r.id, to = l.dir === 'target-first' ? x.r.id : l.target.id
    cmds.push({ op: 'relation.create', ref, args: { type: t.key, from, to } })
    for (const a of linkAttrs.value) {
      const v = (l.vals[x.r.id]?.[a.key] ?? '').trim(); if (!v) continue
      cmds.push({ op: 'relation.attribute.set', args: { relation: '@' + ref, attribute: a.key, locale: null, ...(a.multiple ? { values: v.split(',').map(s => s.trim()).filter(Boolean) } : { value: v }) } })
    }
  }
  if (!cmds.length) { store.toast('Nichts zu verknüpfen'); return }
  try {
    const res = await api.post('/api/batch', { commands: cmds })
    if (res.error) store.toast(`${res.error.message} — ${res.results.length} Einträge davor geschrieben`)
    else store.toast(`${n} Relationen ${t.label?.de || t.key} → ${res.results.length} Einträge (Stapel ${res.batch})`, 'ok')
    link.value = null
    await store.poll(true)
  } catch (e) { store.toast(e.message) }
}
function onLinkKey(e) { if (e.key === 'Escape') { e.preventDefault(); link.value = null } }

function onListKey(e) {
  const rows = visible.value
  const i = rows.findIndex(x => x.r.id === props.id)
  if (e.key === 'ArrowDown') { e.preventDefault(); const n = rows[Math.min(rows.length - 1, i + 1)]; if (n) open(n.r) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); const n = rows[Math.max(0, i - 1)]; if (n) open(n.r) }
  else if (e.key === 'ArrowRight' && i >= 0) { e.preventDefault(); tree.expand(rows[i].r.id) }
  else if (e.key === 'ArrowLeft' && i >= 0) {
    e.preventDefault()
    if (tree.expanded.has(rows[i].r.id)) tree.toggle(rows[i].r.id)
    else if (rows[i].r.parent) router.push(`/tree/${rows[i].r.parent}`)
  }
  else if (e.key === 'Delete' && i >= 0) { e.preventDefault(); retire(rows[i].r) }
  else if (e.key === 'Home' && rows.length) open(rows[0].r)
  else if (e.key === 'End' && rows.length) open(rows[rows.length - 1].r)
}
function countBelow(id) { let n = 0; for (const k of tree.kids(id)) n += 1 + countBelow(k.id); return n }
// Wiederherstellen (Taloan): der Knoten mit allem, was darunter zurückgezogen wurde — die Einträge bleiben, es kommt NodeRestored dazu
// Zurückgezogene Wurzel (Taloan): der Rückzug liegt im Stapel '' — den gibt es in keiner Knotenansicht, also hier in der Baum-Leiste
const rootUndo = computed(() => { const h = store.undo['']?.history ?? []; return h.length ? h[h.length - 1] : null })
async function undoRoot() { const s = store.undo['']; const h = s?.history.pop(); if (!h) return; s.redo.push(h); await restore(h.id, h.batch) }
async function restore(id, batch) {
  try {
    const res = batch ? await api.post(`/api/batches/${encodeURIComponent(batch)}/undo`) : await api.post(`/api/nodes/${encodeURIComponent(id)}/restore`)
    store.toast(`${res.undone ?? 1} Knoten wiederhergestellt (Stapel ${res.batch})${res.failed?.length ? ` — ${res.failed.length} nicht: ${res.failed[0]}` : ''}`, 'ok')
    await store.poll(true); await tree.load(); router.push(`/tree/${id}`)
  } catch (e) { store.toast(e.message) }
}
async function retire(r) {
  const below = countBelow(r.id)
  const b = tree.below(r.id)
  if (!await ask.confirm({ title: `${icon(r.role)} ${r.label} zurückziehen?`, warn: b.total ? `Mit allen ${b.total} Knoten darunter: ${b.summary}` : '', list: b.names, ok: b.total ? `🗑 ${b.total + 1} Knoten zurückziehen` : '🗑 Zurückziehen', danger: true })) return
  try {
    const res = await api.del(`/api/nodes/${encodeURIComponent(r.id)}${below ? '?recursive=true' : ''}`)
    const ps = (store.undo[r.parent ?? ''] ??= { history: [], redo: [] }); ps.history.push({ kind: 'retire', id: r.id, parent: r.parent, label: r.label, count: res?.retired ?? 1, batch: res?.batch ?? null }); ps.redo.length = 0
    if (res?.retired) store.toast(`${res.retired} Knoten zurückgezogen (Stapel ${res.batch})`, 'ok', { label: '↶ wiederherstellen', run: () => restore(r.id, res.batch), title: `stellt ${res.retired} Knoten wieder her: ${icon(r.role)} ${r.label}${res.retired > 1 ? ` mit ${res.retired - 1} darunter` : ''}` })
    await tree.load(); if (props.id === r.id || !tree.byId.has(props.id)) router.push(r.parent ? `/tree/${r.parent}` : '/tree')
  } catch (e) { store.toast(e.message) }
}
// Umhängen per Drag & Drop (Taloan, 17.09.): Zeile ziehen, auf einer Zeile ablegen = darunter hängen.
// Dieselben Regeln wie der Server (Commands.Move): Variante unter Produkt, sonst unter Gruppe, nie unter sich selbst.
const dragId = ref(null)
const dropId = ref(null)
// Zugeklappte Äste öffnen sich, wenn man beim Ziehen eine Weile darüber steht (Taloan, 17.09.).
let hoverTimer = null, hoverId = null
function hoverOpen(r) {
  if (hoverId === r.id) return
  clearTimeout(hoverTimer); hoverId = r.id
  if (tree.kids(r.id).length && !tree.expanded.has(r.id)) hoverTimer = setTimeout(() => { if (hoverId === r.id) tree.expand(r.id) }, 700)
}
function hoverStop() { clearTimeout(hoverTimer); hoverId = null }
function canDrop(src, target) {
  if (!src || !target || src.id === target.id || src.parent === target.id) return false
  if (target.role !== (src.role === 'variant' ? 'product' : 'group')) return false
  for (const a of tree.ancestors(target.id)) if (a.id === src.id) return false
  return true
}
// Ziehen: gehört die Zeile zur Auswahl, zieht die ganze Auswahl mit. Shift beim Ablegen = verknüpfen statt umhängen.
// effectAllowed 'all': mit gedrückter Shift-Taste erzwingt Windows/Chrome den Effekt „move“, mit Strg „copy“ — passt der nicht zu
// effectAllowed, zeigt der Browser das Verbotsschild und liefert kein drop (Taloan, 17.09.). Was Shift bedeutet, entscheiden wir selbst.
function onDragStart(e, r) { dragId.value = r.id; e.dataTransfer.effectAllowed = 'all'; e.dataTransfer.setData('text/plain', r.id) }
const dragIds = () => picked.value.has(dragId.value) ? [...picked.value] : [dragId.value]
function onDragOver(e, r) {
  // Datei aus dem Explorer (JSON) auf einen Knoten: der JSON-Import startet mit diesem Ziel (Taloan)
  if (!dragId.value && e.dataTransfer?.types?.includes('Files')) { if (r.role !== 'variant') { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; dropId.value = r.id } else dropId.value = null; return }
  const src = tree.byId.get(dragId.value)
  if (src) hoverOpen(r)
  const ok = e.shiftKey ? dragIds().some(id => id !== r.id) : dragIds().some(id => canDrop(tree.byId.get(id), r))
  if (!ok) { dropId.value = null; return }
  e.preventDefault(); e.dataTransfer.dropEffect = e.shiftKey ? 'move' : e.ctrlKey ? 'copy' : 'move'; dropId.value = r.id
}
async function onDrop(e, r) {
  if (!dragId.value && e.dataTransfer?.files?.length) {
    dropId.value = null; const f = e.dataTransfer.files[0]
    if (!/\.json(\.gz)?$/i.test(f.name)) { store.toast('Nur JSON-Dateien lassen sich auf den Baum ziehen (Tabellen: ⇩ Import → Tabelle)'); return }
    if (r.role === 'variant') { store.toast('Ziel muss eine Gruppe oder ein Produkt sein'); return }
    store.pendingImport = { file: f, parent: r.id }; router.push('/p/json/import'); return
  }
  const ids = dragIds()
  dragId.value = null; dropId.value = null; hoverStop()
  if (e.shiftKey) {   // verknüpfen: die Auswahl (oder die eine Zeile) mit diesem Ziel
    if (!picked.value.has(ids[0])) picked.value = new Set(ids)
    await openLink(r); return
  }
  let moved = 0, below = 0
  try {
    // Vorher prüfen, ob eigene Werte am neuen Ort verwaisen (orphans.js) — derselbe Dialog wie beim JSON-Import (Taloan, 18.09.)
    const todo = ids.map(id => tree.byId.get(id)).filter(src => canDrop(src, r))
    if (!todo.length) return
    const have = await groupsAt(r.id)
    const checks = []
    for (const src of todo) { const { need, own } = await neededByNode(src.id, store.model); checks.push({ src, missing: missingGroups(need, have, own) }) }
    const missing = new Map(); for (const c of checks) for (const m of c.missing) { if (!missing.has(m.group)) missing.set(m.group, new Set()); for (const a of m.attrs) missing.get(m.group).add(a) }
    const missingAll = [...missing].map(([group, attrs]) => ({ group, attrs: [...attrs] }))
    const what = todo.length === 1 ? `${icon(todo[0].role)} ${todo[0].label}${countBelow(todo[0].id) ? ` mit ${countBelow(todo[0].id)} darunter` : ''}` : `${todo.length} Einträge`
    const res = missingAll.length
      ? await confirmMove({ title: `${what} → ${icon(r.role)} ${r.label}`, warn: '', missing: missingAll, rootLabel: todo.length === 1 ? `${icon(todo[0].role)} ${todo[0].label}` : 'jedem verschobenen Eintrag', ok: 'Umhängen' })
      : { attach: false }
    if (!res) return
    for (const c of checks) {
      const src = c.src
      await api.post(`/api/nodes/${encodeURIComponent(src.id)}/move`, { parent: r.id }); moved++; below += countBelow(src.id)
      if (res.attach && c.missing.length) await api.post(`/api/nodes/${encodeURIComponent(src.id)}/groups`, { groups: [...new Set([...(src.groups ?? '').split(',').filter(Boolean), ...c.missing.map(m => m.group)])] }, 'PUT')
    }
    if (moved) store.toast(`${moved === 1 ? icon(tree.byId.get(ids[0]).role) + ' ' + tree.byId.get(ids[0]).label : moved + ' Einträge'}${below ? ` mit ${below} darunter` : ''} → ${icon(r.role)} ${r.label}`, 'ok')
    await store.poll(true); await tree.load(); tree.expand(r.id)
  } catch (e) { store.toast(e.message) }
}
// Auswahl: Status für alle, Zurückziehen für alle — je Knoten ein Aufruf; ein Dialog vorher mit den Zahlen (Taloan, 18.09.)
async function setStatusAll(rows, status) {
  for (const x of rows) { try { await api.post(`/api/nodes/${encodeURIComponent(x.id)}/status`, { status }) } catch (e) { store.toast(`${x.label}: ${e.message}`) } }
  await store.poll(true); await tree.load()
}
async function retireAll(rows) {
  // nur die obersten der Auswahl: ein Knoten, dessen Vorfahr auch ausgewählt ist, geht mit dem Vorfahren
  const ids = new Set(rows.map(x => x.id))
  const tops = rows.filter(x => !tree.ancestors(x.id).some(a => ids.has(a.id)))
  const below = tops.reduce((k, x) => k + countBelow(x.id), 0)
  if (!await ask.confirm({ title: `${tops.length} Knoten zurückziehen?`, warn: below ? `Mit allen ${below} Knoten darunter — insgesamt ${tops.length + below}` : `${tops.length} Knoten`, list: tops.slice(0, 8).map(x => `${icon(x.role)} ${x.label}`), ok: `🗑 ${tops.length + below} Knoten zurückziehen`, danger: true })) return
  let n = 0
  for (const x of tops) { try { const res = await api.del(`/api/nodes/${encodeURIComponent(x.id)}${countBelow(x.id) ? '?recursive=true' : ''}`); n += res?.retired ?? 1 } catch (e) { store.toast(`${x.label}: ${e.message}`) } }
  picked.value = new Set()
  store.toast(`${n} Knoten zurückgezogen`, 'ok')
  await tree.load(); if (!tree.byId.has(props.id)) router.push('/tree')
}
async function setStatus(r, status) {
  try { await api.post(`/api/nodes/${encodeURIComponent(r.id)}/status`, { status }); await store.poll(true); await tree.load() } catch (e) { store.toast(e.message) }
}
// Eigener Name im Baum (jede Rolle) = angeheftet (📌); leer = Automatik (★ Attribut, bei Varianten SKU/Achsen, sonst Id).
async function setName(r, name) {
  try { await api.post(`/api/nodes/${encodeURIComponent(r.id)}/name`, { name }, 'PUT'); await store.poll(true); await tree.load() } catch (e) { store.toast(e.message) }
}
async function rename(r) {
  const name = await ask.prompt({ title: 'Name im Baum', text: `${r.label} — leer = Automatik (★ Attribut)`, value: r.name ?? r.label, placeholder: 'leer = Automatik', ok: '✎ Umbenennen' })
  if (name != null) await setName(r, name)
}
// Fixieren übernimmt den Namen, den die Automatik gerade zeigt, als eigenen; Freigeben nimmt ihn weg.
const fix = r => setName(r, r.name ? '' : r.label)
async function duplicate(r, deep) {
  try {
    const res = await api.post(`/api/nodes/${encodeURIComponent(r.id)}/duplicate?deep=${deep}`)
    store.toast(`Kopie: ${res.entries} Einträge (Stapel ${res.batch})`, 'ok')
    await store.poll(true); await tree.load(); router.push(`/tree/${res.id}`)
  } catch (e) { store.toast(e.message) }
}
// Rechtsklick: was man mit diesem Knoten tun kann — die Tastenkürzel gelten im Menü.
// Was unter einem Knoten liegt, heisst „Subitems“ — nicht „Kinder“ (Taloan, 17.09.)
const below = () => 'Subitems'
function contextMenu(e, r) {
  router.push(`/tree/${r.id}`)
  const kids = tree.kids(r.id).length
  // Mehrfachauswahl (Taloan, 18.09.): liegt die Zeile in der Auswahl, gilt das Menü für die ganze Auswahl — Zurückziehen, Status,
  // Duplizieren für alle; was nur einzeln geht (Umbenennen, Tabelle, Plugins), ist ausgegraut mit Hinweis
  const sel = picked.value.has(r.id) && picked.value.size > 1 ? pickedRows.value : null
  const only1 = sel ? { disabled: true, hint: `nur einzeln (${sel.length} ausgewählt)` } : {}
  const st = s => (sel ? sel.some(x => x.role !== 'group' && x.status !== s) : (r.role !== 'group' && r.status !== s))
    ? { label: (s === 'draft' ? '○ Entwurf' : s === 'active' ? '● aktiv' : '✗ ausgelaufen') + (sel ? ` (${sel.filter(x => x.role !== 'group' && x.status !== s).length})` : ''), action: () => sel ? setStatusAll(sel.filter(x => x.role !== 'group' && x.status !== s), s) : setStatus(r, s) } : null
  // Aufgeräumt (Taloan): kein Neu-anlegen (die Knöpfe oben), kein Auf-/Zuklappen, kein Id kopieren (Id steht im Tooltip und im Kopf);
  // Plugin-Einträge je Plugin in einem Untermenü
  // Plugin-Einträge nach Thema (Taloan, 18.09.: „Menü komprimieren“): ein Untermenü je Thema — Import, Export, Datenblatt,
  // Datenanalyse — darin alles dazu, quer über die Plugins. Das Thema nennt die Aktion (topic), sonst die Art des Plugins (kind).
  const TOPICS = [['import', '⇩ Import'], ['export', '⇪ Export'], ['datasheet', '📄 Datenblatt'], ['analysis', '✓ Datenanalyse'], ['tools', '⌁ Werkzeuge']]
  const KIND_TOPIC = { import: 'import', export: 'export', output: 'datasheet', quality: 'analysis' }
  const byTopic = new Map()
  const add = (topic, item) => { if (!byTopic.has(topic)) byTopic.set(topic, []); byTopic.get(topic).push(item) }
  for (const a of plugins.nodeActions.filter(a => !a.roles || a.roles.includes(r.role))) {
    const kind = plugins.list.find(p => p.key === a.key)?.manifest?.kind
    add(a.topic ?? KIND_TOPIC[kind] ?? 'tools', { label: typeof a.label === 'function' ? a.label(r, below(r)) : a.label, icon: a.icon || '⌁', hint: a.key, action: () => Promise.resolve(a.run(r.id, { ...plugins.ctx(a.key), tree })).catch(e => store.toast(`${a.key}: ${e.message}`)) })
  }
  if (r.role !== 'variant') add('import', { label: 'JSON: Rohdaten hierher …', icon: '⇩', hint: 'json', action: () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = () => { if (i.files[0]) { store.pendingImport = { file: i.files[0], parent: r.id }; router.push('/p/json/import') } }; i.click() } })
  const topicMenus = TOPICS.filter(([k]) => byTopic.has(k)).map(([k, label]) => ({ label: label.slice(2), icon: label.slice(0, 1), items: byTopic.get(k), ...(picked.value.has(r.id) && picked.value.size > 1 ? { disabled: true, hint: 'nur einzeln' } : {}) }))
  menu.open(e, [
    { label: 'Umbenennen', icon: '✎', key: 'u', hint: r.name ? '📌 fixiert' : '★ Automatik', action: () => rename(r), ...only1 },
    // Symbol ist der Pin — bei beiden (Taloan: der Pin gehört zu „lösen“); der Hinweis rechts sagt, was danach gilt
    { label: r.name ? 'Benennung lösen' : 'Benennung fixieren', icon: '📌', key: 'f', hint: r.name ? '★ gilt wieder' : r.label, action: () => fix(r), ...only1 },
    { sep: true },
    // Massenbearbeitung wie in Excel (Taloan, 17.09.): die Kinder als Tabelle — beim Produkt die Varianten, bei der Gruppe die Produkte, dazu alle Varianten darunter
    // Taloan (17.09.): eigenes Fenster, Excel-ähnlich pflegen, Schliessen übernimmt — Popup blockiert? dann im Hauptfenster
    r.role !== 'variant' && kids ? { label: `Subitems tabellarisch bearbeiten (${kids})`, icon: '⊞', key: 'b', hint: '↗ Fenster', action: () => openTable(`/table/${r.id}?popup=1`), ...only1 } : null,
    r.role === 'group' && kids ? { label: 'Alle Varianten darunter tabellarisch', icon: '⊞', key: 'w', hint: '↗ Fenster', action: () => openTable(`/table/${r.id}?role=variant&deep=1&popup=1`) } : null,
    (r.role !== 'variant' && kids) ? { sep: true } : null,
    sel ? { label: `Duplizieren (${sel.length})`, icon: '⧉', key: 'd', hint: 'ohne SKU/Freigaben', disabled: sel.some(x => x.role === 'variant' && Object.keys(x.axisValues).length > 0), action: async () => { for (const x of sel) await duplicate(x, false) } }
        : { label: 'Duplizieren', icon: '⧉', key: 'd', hint: 'ohne SKU/Freigaben', disabled: r.role === 'variant' && Object.keys(r.axisValues).length > 0, action: () => duplicate(r, false) },
    !sel && r.role !== 'variant' && kids ? { label: `Duplizieren mit ${countBelow(r.id)} darunter`, icon: '⧉', key: 't', action: () => duplicate(r, true) } : null,
    { sep: true },
    ...(r.role !== 'group' ? [st('draft'), st('active'), st('discontinued'), { sep: true }] : []),
    { label: picked.value.has(r.id) ? 'Abwählen' : 'Auswählen', icon: '☑', key: 'm', hint: 'Strg+Klick', action: () => { const s = new Set(picked.value); s.has(r.id) ? s.delete(r.id) : s.add(r.id); picked.value = s } },
    picked.value.size ? { label: `Auswahl aufheben (${picked.value.size})`, icon: '☐', key: 'Escape', hint: 'Esc', action: () => { picked.value = new Set() } } : null,
    { label: 'Im Journal zeigen', icon: '≡', key: 'j', action: () => router.push({ path: '/journal', query: { q: r.id } }), ...only1 },
    ...(topicMenus.length ? [{ sep: true }, ...topicMenus] : []),
    { sep: true },
    sel ? { label: `${sel.length} ausgewählte zurückziehen${sel.reduce((k, x) => k + countBelow(x.id), 0) ? ` (mit ${sel.reduce((k, x) => k + countBelow(x.id), 0)} darunter)` : ''}`, icon: '🗑', key: 'Delete', danger: true, action: () => retireAll(sel) }
        : { label: kids ? `Zurückziehen mit ${countBelow(r.id)} darunter` : 'Zurückziehen', icon: '🗑', key: 'Delete', danger: true, action: () => retire(r) },
  ])
}
function onGlobalKey(e) {
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) { e.preventDefault(); search.value?.focus() }
  // Esc hebt die Auswahl auf (wenn kein Dialog offen ist) — Taloan, 17.09.: „Wie löse ich eine Selektion wieder auf?“
  if (e.key === 'Escape' && picked.value.size && !creating.value && !link.value && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) { e.preventDefault(); picked.value = new Set() }
}
onMounted(() => window.addEventListener('keydown', onGlobalKey))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKey))

// ---- Anlegen: wo hängt es hin?
const groupTarget = computed(() => {
  let n = selected.value
  while (n && n.role !== 'group') n = tree.byId.get(n.parent)
  return n ?? null
})
const productTarget = computed(() => {
  let n = selected.value
  while (n && n.role !== 'product') n = tree.byId.get(n.parent)
  return n ?? null
})
function attrDef(key) { return store.model?.attributes.find(a => a.key === key) }
function listValues(key) { const d = attrDef(key); return (store.model?.lists.find(l => l.key === d?.list)?.values ?? []) }

// Anlegen (Taloan, 17.09.): ein Dialog mit den Pflichtfeldern — die Attribute, die am neuen Knoten gelten
// (Gruppen am Pfad des Elternknotens, dort aktiv) und für irgendeinen Kanal Pflicht sind, sprachabhängige
// nur in der Mastersprache. Erst wenn alles gefüllt ist, wird geschrieben: Anlegen + Werte als ein Stapel.
const DEPTH = { group: 0, product: 1, variant: 2 }
const required = ref([])      // [{ def, locale }]
const vals = ref({})          // key → Wert
const master = computed(() => store.model?.masterLocale ?? store.model?.locales[0]?.code ?? null)
async function start(kind) {
  const parent = kind === 'variant' ? productTarget.value : groupTarget.value
  creating.value = kind
  form.value = kind === 'variant' ? Object.fromEntries((productTarget.value?.axes ?? []).map(a => [a, ''])) : {}
  vals.value = {}; required.value = []
  try {
    const m = store.model
    const onPath = parent ? (await api.get(`/api/nodes/${encodeURIComponent(parent.id)}`)).groups.map(g => g.key) : []
    const active = onPath.filter(k => { const g = m.groups.find(x => x.key === k); return !g?.activeFrom || DEPTH[kind] >= DEPTH[g.activeFrom] })
    required.value = m.attributes
      .filter(a => active.includes(a.group) && a.required && Object.keys(a.required).length && (!a.levels || a.levels.includes(kind)) && a.type !== 'rows' && a.type !== 'html')
      .filter(a => !(kind === 'variant' && (productTarget.value?.axes ?? []).includes(a.key)))   // Achsenwerte fragt der Dialog ohnehin
      .map(a => ({ def: a, locale: a.perLocale ? master.value : null }))
  } catch (e) { store.toast(e.message) }
  // Cursor gleich ins erste Feld — autofocus greift bei nachträglich eingefügten Elementen nicht (Taloan, 17.09.)
  await nextTick(); dialog.value?.querySelector('input, select')?.focus()
}
const dialog = ref(null)
const complete = computed(() => required.value.every(r => (vals.value[r.def.key] ?? '').trim() !== '') && Object.values(form.value).every(v => v !== ''))
async function create() {
  if (!complete.value) return
  if (!store.actor) { store.toast('👤 Name fehlt → Einstellungen'); return }
  const kind = creating.value
  const parent = kind === 'variant' ? productTarget.value : groupTarget.value
  const cmds = [kind === 'group' ? { op: 'group.create', ref: 'n', args: { parent: parent?.id ?? null } }
    : kind === 'product' ? { op: 'product.create', ref: 'n', args: { group: parent.id } }
    : { op: 'variant.create', ref: 'n', args: { product: parent.id, axisValues: form.value } }]
  for (const r of required.value) {
    const v = vals.value[r.def.key].trim()
    cmds.push({ op: 'attribute.set', args: { node: '@n', attribute: r.def.key, locale: r.locale, ...(r.def.multiple ? { values: v.split(',').map(x => x.trim()).filter(Boolean) } : { value: v }) } })
  }
  try {
    const res = await api.post('/api/batch', { commands: cmds })
    if (res.error) { store.toast(`${res.error.message} — ${res.results.length} Einträge geschrieben`); }
    const id = res.results.find(x => x.ref === 'n')?.node
    creating.value = null
    await store.poll(true); await tree.load()
    if (parent) tree.expand(parent.id)
    if (id) router.push(`/tree/${id}`)
  } catch (e) { store.toast(e.message) }
}
function onDialogKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); creating.value = null }
  else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); create() }
}
</script>

<template>
  <div class="pane" :style="`width:${treeW}px;flex:none`">
    <div class="toolbar">
      <h1>▣ Baum</h1>
      <span class="muted">{{ tree.rows.length }}</span>
      <input ref="search" v-model="q" type="search" placeholder="Suche in allem  /" style="flex:1;min-width:0" autocomplete="off"
        @input="suggest" @focus="suggest" @click="suggest" @blur="hideSugg" @keydown="onSearchKey"
        title="Text — oder Bedingungen (Vorschläge beim Tippen): attr:function · attr:function=*sku* · attr:x= (leer) · empty:name/en · incomplete:web · role:variant · status:active · group:logistics · under:<id> · by:Taloan · since:2026-09-10" />
    </div>
    <div v-if="sugg.length" class="sugg">
      <div v-for="(s, i) in sugg" :key="s.value" class="sugg-row" :class="{ on: i === suggIdx }" @mousedown.prevent="accept(s)" @mousemove="suggIdx = i">
        <span>{{ s.label }}</span><span class="muted mono">{{ s.hint }}</span>
      </div>
    </div>
    <div v-if="terms.length" class="chips terms">
      <span v-for="t in terms" :key="t" class="chip mono" :class="{ not: t.startsWith('-') }" :title="t.startsWith('-') ? 'verneint — Klick dreht um' : 'Klick verneint (Gegenteil)'" @click="q = q.split(/\s+/).map(w => w === t ? (t.startsWith('-') ? t.slice(1) : '-' + t) : w).join(' ')">{{ t }}<button @click.stop="dropTerm(t)" @click="dropTerm(t)" title="Bedingung entfernen">×</button></span>
    </div>
    <div class="toolbar create">
      <button @click="start('group')" :title="groupTarget ? `Gruppe unter ${groupTarget.label}` : 'Gruppe an der Wurzel'">+ ▣</button>
      <button @click="start('product')" :disabled="!groupTarget" :title="groupTarget ? `Produkt unter ${groupTarget.label}` : 'erst eine Gruppe wählen'">+ ▦</button>
      <button @click="start('variant')" :disabled="!productTarget" :title="productTarget ? `Variante unter ${productTarget.label}` : 'erst ein Produkt wählen'">+ ◆</button>
      <span class="grow" />
      <button v-if="rootUndo" class="x" @click="undoRoot" :title="`↶ ${rootUndo.label}${rootUndo.count > 1 ? ` mit ${rootUndo.count - 1} darunter` : ''} wiederherstellen (Wurzel)`">↶ Wurzel</button>
      <button v-if="q" @click="pickVisible" title="alle sichtbaren Treffer auswählen">☑ Treffer</button>
      <template v-if="picked.size">
        <span class="chip" title="die Auswahl — Strg+Klick sammelt, Shift+Klick nimmt den Bereich; × oder Esc hebt sie auf">☑ {{ picked.size }} <button @click="picked = new Set()" title="Auswahl aufheben (Esc)">×</button></span>
        <button class="primary" @click="openLink(null)" title="die Auswahl mit einem Ziel verknüpfen (oder mit Shift auf ein Ziel ziehen)">⇄</button>
      </template>
    </div>

    <!-- Verknüpfen: Auswahl → Ziel, dann Typ und Richtung (Taloan, 17.09.) -->
    <div v-if="link" class="overlay" @click.self="link = null" @keydown="onLinkKey">
      <div class="dialog" style="min-width:640px;max-width:92vw">
        <div class="toolbar"><h1>⇄ {{ pickedRows.length }} Einträge verknüpfen</h1><span class="grow" /><button class="x" @click="link = null" title="Esc">×</button></div>
        <table class="grid form"><colgroup><col style="width:130px" /><col /></colgroup><tbody>
          <tr><td class="attr">Ziel</td><td>
            <span v-if="link.target" class="chip">{{ icon(link.target.role) }} {{ link.target.label }} <button @click="link.target = null; link.existing = null" title="anderes Ziel">×</button></span>
            <input v-else v-model="link.q" type="search" placeholder="🔍 Name, SKU, Id" style="width:320px" autofocus />
            <div v-if="!link.target && linkMatches.length" class="picker" style="max-width:420px">
              <div v-for="m in linkMatches" :key="m.id" class="pick" @click="link.target = m; link.q = ''; loadExisting()">{{ icon(m.role) }} {{ m.label }}<span class="muted mono" style="margin-left:auto;font-size:11px">{{ m.sku ?? m.id }}</span></div>
            </div>
          </td></tr>
          <tr><td class="attr">Relation</td><td>
            <select v-model="link.type" style="width:260px"><option v-for="t in relTypes" :key="t.key" :value="t.key">{{ t.symmetric ? '⇄' : '→' }} {{ t.label?.de || t.key }}{{ t.group ? ' · ▤ ' + t.group : '' }}</option></select>
            <span v-if="linkType" class="muted" style="margin-left:8px">{{ linkType.symmetric ? 'beidseitig — liest sich von beiden Enden gleich' : 'einseitig — zwei Lesarten' }}</span>
          </td></tr>
          <tr v-if="linkType && link.target"><td class="attr">Richtung</td><td class="dirs">
            <label :class="{ on: link.dir === 'target-first' }"><input type="radio" value="target-first" v-model="link.dir" />
              <b>{{ link.target.label }}</b> — {{ linkType.label?.de || linkType.key }} → <b>{{ pickedRows.length }} Einträge</b>
              <div v-if="!linkType.symmetric" class="muted reading">die Einträge sind „{{ linkType.reverse?.de || '…' }}“ {{ link.target.label }}</div></label>
            <label v-if="!linkType.symmetric" :class="{ on: link.dir === 'set-first' }"><input type="radio" value="set-first" v-model="link.dir" />
              <b>{{ pickedRows.length }} Einträge</b> — {{ linkType.label?.de || linkType.key }} → <b>{{ link.target.label }}</b>
              <div class="muted reading">{{ link.target.label }} ist „{{ linkType.reverse?.de || '…' }}“ jedes Eintrags</div></label>
          </td></tr>
        </tbody></table>
        <div class="scroll" style="max-height:340px">
          <table class="grid" style="width:auto">
            <thead><tr><th style="width:320px">Eintrag</th><th v-for="a in linkAttrs" :key="a.key" style="width:140px" :title="a.key">{{ a.label?.de || a.key }}<span v-if="a.unit" class="muted"> {{ a.unit }}</span></th><th style="width:120px"></th></tr>
              <tr v-if="linkAttrs.length" class="muted"><td style="font-size:11px;padding:2px 8px">für alle:</td><td v-for="a in linkAttrs" :key="a.key" style="padding:2px 4px"><input type="text" style="width:100%" :placeholder="a.label?.de || a.key" @change="fillAll(a.key, $event.target.value)" /></td><td></td></tr>
            </thead>
            <tbody>
              <tr v-for="x in linkRows" :key="x.r.id" :class="{ muted: !x.ok || x.exists }">
                <td :title="x.r.id">{{ icon(x.r.role) }} {{ x.r.label }}</td>
                <td v-for="a in linkAttrs" :key="a.key" style="padding:2px 4px"><input v-if="x.ok && !x.exists" type="text" style="width:100%" :value="link.vals[x.r.id]?.[a.key] ?? ''" @input="(link.vals[x.r.id] ??= {})[a.key] = $event.target.value" /></td>
                <td class="muted" style="font-size:11px">{{ x.exists ? 'gibt es schon' : !x.ok ? 'Typ erlaubt das nicht' : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="chips" style="padding:8px">
          <button class="primary" :disabled="!link.target || !linkType || !linkCount" @click="runLink">⇄ {{ linkCount }} verknüpfen</button>
          <button @click="link = null">Abbrechen</button>
          <span class="grow" /><span class="muted">ein Stapel · <kbd>Esc</kbd></span>
        </div>
      </div>
    </div>

    <!-- Anlegen: Dialog mit Pflichtfeldern (Mastersprache); erst vollständig, dann ein Stapel -->
    <div v-if="creating" class="overlay" @click.self="creating = null" @keydown="onDialogKey">
      <div class="dialog" ref="dialog">
        <div class="toolbar"><h1>{{ icon(creating) }} {{ creating === 'group' ? 'Neue Gruppe' : creating === 'product' ? 'Neues Produkt' : 'Neue Variante' }}</h1>
          <span class="muted">{{ creating === 'variant' ? 'unter ' + productTarget.label : groupTarget ? 'unter ' + groupTarget.label : 'an der Wurzel' }}</span></div>
        <table class="grid form"><colgroup><col style="width:170px" /><col style="width:300px" /></colgroup><tbody>
          <tr v-for="a in (creating === 'variant' ? productTarget.axes : [])" :key="'ax-' + a">
            <td class="attr" :title="a + ' — Variantenachse'">◆ {{ attrDef(a)?.label?.de || a }}</td>
            <td>
              <select v-if="attrDef(a)?.type === 'enum'" v-model="form[a]" style="width:100%"><option value="">…</option><option v-for="v in listValues(a)" :key="v.value" :value="v.value">{{ v.label?.de || v.value }}</option></select>
              <input v-else v-model="form[a]" type="text" style="width:100%" />
            </td>
          </tr>
          <tr v-for="(r, i) in required" :key="r.def.key">
            <td class="attr" :title="r.def.key + (r.locale ? ' · ' + r.locale : '')">● {{ r.def.label?.de || r.def.key }}<span v-if="r.locale" class="muted">&nbsp;{{ r.locale }}</span></td>
            <td>
              <select v-if="r.def.type === 'enum'" v-model="vals[r.def.key]" style="width:100%"><option value="">…</option><option v-for="v in listValues(r.def.key)" :key="v.value" :value="v.value">{{ v.label?.de || v.value }}</option></select>
              <select v-else-if="r.def.type === 'boolean'" v-model="vals[r.def.key]" style="width:100%"><option value="">…</option><option value="true">✓ ja</option><option value="false">✗ nein</option></select>
              <input v-else v-model="vals[r.def.key]" :type="r.def.type === 'date' ? 'date' : 'text'" style="width:100%" :placeholder="r.def.multiple ? 'kommagetrennt' : ''" :autofocus="i === 0" />
            </td>
          </tr>
        </tbody></table>
        <div v-if="!required.length && !(creating === 'variant' && productTarget.axes.length)" class="muted" style="padding:6px 8px;font-size:12px">Keine Pflichtfelder an diesem Knotentyp — Anlegen, dann rechts pflegen.</div>
        <div class="chips" style="padding:8px">
          <button class="primary" :disabled="!complete" @click="create">Anlegen</button>
          <button @click="creating = null">Abbrechen</button>
          <span class="grow" /><span class="muted"><kbd>Enter</kbd> · <kbd>Esc</kbd></span>
        </div>
      </div>
    </div>

    <div ref="list" class="scroll tree" tabindex="0" @keydown="onListKey">
      <!-- Flag heisst isOpen, nicht open — sonst verdeckt es die Funktion open(r) des Klicks. -->
      <div v-for="{ r, depth, isOpen } in visible" :key="r.id" class="node" :class="[r.role, { selected: r.id === id, picked: picked.has(r.id), [r.status]: true, drop: dropId === r.id, dragging: dragId === r.id }]"
        :style="`padding-left:${8 + depth * 16}px`" @click="onRowClick($event, r)" @contextmenu="contextMenu($event, r)" :title="r.id"
        draggable="true" @dragstart="onDragStart($event, r)" @dragover="onDragOver($event, r)" @dragleave="dropId === r.id && (dropId = null)" @drop.prevent="onDrop($event, r)" @dragend="dragId = null; dropId = null; hoverStop()">
        <span class="twisty" :class="{ leaf: !tree.kids(r.id).length }" @click.stop="tree.toggle(r.id)">{{ tree.kids(r.id).length ? (isOpen ? '▾' : '▸') : '' }}</span>
        <span class="icon">{{ icon(r.role) }}</span>
        <span class="label" :class="{ pinned: r.name }" :title="r.name ? 'Name angeheftet (kursiv) — die ★-Automatik gilt hier nicht. Rechtsklick → Benennung lösen' : ''">{{ r.label }}</span>
        <span v-if="hits.get(r.id) && !r.label.toLowerCase().includes(q.trim().toLowerCase())" class="muted hit" :title="hits.get(r.id)">{{ hits.get(r.id) }}</span>
        <span v-if="r.role === 'variant' && r.sku && Object.keys(r.axisValues).length" class="muted axis">{{ Object.values(r.axisValues).join(' · ') }}</span>
        <span v-if="r.status === 'discontinued'" class="neg" title="ausgelaufen">✗</span>
        <span v-else-if="r.status === 'active'" class="pos" title="aktiv">●</span>
        <span v-if="tree.kids(r.id).length" class="muted count">{{ tree.kids(r.id).length }}</span>
      </div>
      <div v-if="tree.loaded && !tree.rows.length" class="empty">Leer — oben <b>+ ▣</b> legt die erste Gruppe an.</div>
      <div v-else-if="q && !visible.length" class="empty">Nichts zu „{{ q }}“</div>
    </div>
    <div class="toolbar hint muted" style="border-top:1px solid var(--line);border-bottom:0;font-size:12px">
      <kbd>↑</kbd><kbd>↓</kbd> · <kbd>Entf</kbd> zurückziehen · <kbd>/</kbd> Suche · <kbd>Strg</kbd>+Klick auswählen · ziehen = umhängen, mit <kbd>Shift</kbd> = verknüpfen · <i>kursiv</i> = angeheftet
    </div>
  </div>

  <Splitter v-model="treeW" :min="200" :max="800" />
  <NodeView v-if="id" :id="id" :key="id" />
  <div v-else class="pane" style="flex:1"><div class="empty">Knoten wählen — oder oben anlegen.</div></div>
</template>

<style scoped>
.create { gap: 4px; }
.sugg { border-bottom: 1px solid var(--line); background: var(--pane); font-size: 12px; max-height: 240px; overflow: auto; }
.sugg-row { display: flex; justify-content: space-between; gap: 8px; padding: 3px 10px; cursor: pointer; }
.sugg-row.on { background: var(--accent-soft); }
.sugg-row .mono { font-size: 11px; }
.terms { padding: 4px 8px; border-bottom: 1px solid var(--line); font-size: 12px; }
.terms .chip { cursor: pointer; }
.terms .chip.not { border-color: var(--neg); color: var(--neg); }
.x.on { color: var(--accent); }
.create button { min-width: 40px; }
.overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, .45); display: grid; place-items: center; z-index: 5; }
.dialog { background: var(--pane); border: 1px solid var(--line); border-radius: 8px; min-width: 500px; box-shadow: 0 12px 40px rgba(0, 0, 0, .4); }
.dialog .form { width: auto; margin: 0; }
.dialog td.attr { white-space: nowrap; color: var(--muted); }
.dialog td { padding: 3px 8px; }

.tree { outline: none; }
.node { display: flex; align-items: center; gap: 4px; height: 24px; cursor: default; white-space: nowrap; padding-right: 8px; }
.node:hover { background: var(--hover); }
.node.selected { background: var(--accent-soft); }
.node.drop { outline: 1px dashed var(--accent); outline-offset: -1px; background: var(--accent-soft); }
.node.picked { box-shadow: inset 3px 0 0 var(--warn); }
.node.picked .label::after { content: ' ☑'; color: var(--warn); font-size: 10px; }
.dirs label { display: block; padding: 4px 6px; border-radius: 4px; cursor: pointer; }
.dirs label.on { background: var(--accent-soft); }
.dirs .reading { font-size: 12px; padding-left: 22px; }
.picker { max-height: 240px; overflow: auto; border: 1px solid var(--line); border-radius: 6px; background: var(--pane); margin-top: 4px; }
.pick { display: flex; align-items: center; gap: 8px; height: 24px; padding: 0 8px; white-space: nowrap; cursor: pointer; }
.pick:hover { background: var(--hover); }
.node.dragging { opacity: .5; }
.twisty { width: 14px; color: var(--muted); font-size: 11px; text-align: center; cursor: pointer; }
.twisty.leaf { cursor: default; }
.icon { width: 16px; text-align: center; }
.node.group .icon { color: var(--muted); }
.node.product .icon { color: var(--accent); }
.node.variant .icon { color: var(--warn); }
.label { overflow: hidden; text-overflow: ellipsis; }
.axis { font-size: 11px; }
/* angehefteter Name: kursiv, kein Symbol — die Information ist klein (Taloan, 17.09.) */
.label.pinned { font-style: italic; }
.hit { font-size: 11px; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.count { margin-left: auto; font-size: 11px; }
</style>
