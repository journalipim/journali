<script setup>
// Produktgruppe → … → Produkt → Variante als Baum links; Anlegen inline in
// der Werkzeugleiste; rechts der gewählte Knoten (NodeView). Tastatur: ↑↓
// wählen, → auf, ← zu, Enter öffnen, / Filter.
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '../api.js'
import { store } from '../store.js'
import { setStatus as setStatusScoped, setStatusAb } from '../status.js'
import { dialog as ask } from '../dialog.js'
import { tree, icon } from '../tree.js'
import { menu } from '../menu.js'
import { groupsAt, neededByNode, missingGroups, confirmMove } from '../orphans.js'
import { plugins } from '../plugins.js'
import { mediaTypesFor, attachFiles, meldung as medienMeldung, IST_ASSET, IST_DOKUMENT } from '../media.js'
import NodeView from './NodeView.vue'
import Splitter from '../components/Splitter.vue'
import { paneWidth } from '../panes.js'
import { t as t_ } from '../i18n.js'
import { L } from '../i18n.js'
const treeW = paneWidth('tree', 300)

const props = defineProps({ id: String })
const router = useRouter()
const q = ref('')
const search = ref(null)
const hits = ref(new Map())   // Server-Suche: id → Fundstelle
// Suche mit Bedingungen: Chips key:value in der Zeile; Vorschläge am Cursor wie in einer IDE —
// ohne ':' die Schlüssel, danach die passenden Werte. Kein Formular.
const hasTerms = computed(() => /(^|\s)-?[a-z]+:/.test(q.value))
const KEYS = [
  ['attr:', t_('Attribut hat eigenen Wert · =Muster · = leer')], ['empty:', t_('fehlt, auch geerbt nicht (Attribut/Sprache)')],
  ['incomplete:', t_('Vollständigkeit nicht erreicht (Kanal)')], ['role:', 'Gruppe / Produkt / Variante'],
  ['status:', 'Status (Modell → Status)'], ['group:', t_('Attributgruppe gilt hier')],
  ['under:', t_('nur im Teilbaum eines Knotens')], ['by:', t_('Urheber der letzten Änderung')], ['since:', t_('geändert seit (Datum)')],
  ['media:', t_('hat Medien: any · image / document · Name (*.pdf)')], ['folder:', t_('Medium im Medienordner: Name, Pfad (a/b) oder none')], ['rel:', t_('hat Relation: any · Typ · Typ=Partner (Name, SKU, Id)')],
  ['sem:', t_('semantische Suche (Vektoren)')],
]
const sugg = ref([])          // [{ value, label, hint }]
const suggIdx = ref(0)
const de = x => L(x?.label) || x?.key
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
    if (!low) out.push({ value: '-', label: '-', hint: t_('Minus davor verneint: -empty:x, -role:variant, -Wort') })
  } else {
    const [key, rest] = [word.slice(0, word.indexOf(':') + 1), word.slice(word.indexOf(':') + 1)]
    const low = rest.toLowerCase()
    const attrs = (m?.attributes ?? []).filter(a => !low || a.key.toLowerCase().includes(low) || (L(a.label) ?? '').toLowerCase().includes(low))
    if (key === 'attr:' && !rest.includes('=')) {
      const exact = (m?.attributes ?? []).find(a => a.key === rest)
      if (exact) { out.push({ value: `attr:${rest}`, label: t_('{0} hat Wert', [de(exact)]), hint: t_('eigener Wert, nicht geerbt') }, { value: `attr:${rest}=`, label: `${de(exact)} leer`, hint: t_('kein eigener Wert') }, { value: `attr:${rest}=*`, label: t_('{0} = Muster…', [de(exact)]), hint: t_('* steht für beliebig, z. B. *sku*') }) }
      for (const a of attrs.slice(0, 12)) if (a.key !== rest) out.push({ value: `attr:${a.key}`, label: de(a), hint: a.key })
    } else if (key === 'empty:') {
      const [ak, loc] = rest.split('/')
      if (rest.includes('/')) { const a = (m?.attributes ?? []).find(x => x.key === ak); for (const l of (a?.perLocale ? m.locales : [])) if (!loc || l.code.startsWith(loc)) out.push({ value: `empty:${ak}/${l.code}`, label: `${de(a)} / ${l.code}`, hint: t_('in dieser Sprache leer') }) }
      else for (const a of attrs.slice(0, 12)) out.push({ value: `empty:${a.key}` + (a.perLocale ? '/' : ''), label: de(a), hint: a.perLocale ? a.key + ' ' + t_('— dann Sprache') : a.key })
    } else if (key === 'incomplete:') for (const c of (m?.channels ?? []).filter(c => c.key.startsWith(low))) out.push({ value: `incomplete:${c.key}`, label: de(c), hint: c.key })
    else if (key === 'role:') for (const [v, l] of [['group', t_('▣ Gruppe')], ['product', t_('▦ Produkt')], ['variant', t_('◆ Variante')]]) if (v.startsWith(low)) out.push({ value: `role:${v}`, label: l, hint: v })
    else if (key === 'status:') for (const s of store.model?.statuses ?? []) if (s.key.startsWith(low) || store.statusLabel(s.key).toLowerCase().startsWith(low)) out.push({ value: `status:${s.key}`, label: store.statusText(s.key), hint: s.key })
    else if (key === 'group:') for (const g of (m?.groups ?? []).filter(g => !low || g.key.toLowerCase().includes(low) || (L(g.label) ?? '').toLowerCase().includes(low))) out.push({ value: `group:${g.key}`, label: de(g), hint: g.key })
    else if (key === 'under:') { for (const a of [...(props.id ? tree.ancestors(props.id) : []), selected.value].filter(Boolean).reverse()) if (!low || a.label.toLowerCase().includes(low) || a.id.includes(low)) out.push({ value: `under:${a.id}`, label: `${icon(a.role)} ${a.label}`, hint: a.id === props.id ? 'hier' : a.id }) }
    else if (key === 'media:') { out.push({ value: 'media:any', label: t_('irgendein Medium'), hint: t_('hat mindestens eines') }); for (const t of (m?.relationTypes ?? []).filter(t => (t.to ?? []).includes('media') && t.key.startsWith(low))) out.push({ value: `media:${t.key}`, label: L(t.label) || t.key, hint: t_('Relationstyp') }); if (low) out.push({ value: `media:${low}`, label: t_('Name enthält „{0}“', [low]), hint: '* = beliebig' }) }
    else if (key === 'folder:') { out.push({ value: 'folder:none', label: t_('⌂ ohne Ordner'), hint: t_('ein Medium des Knotens liegt in keinem Ordner') }); mediaFolders().then(fs => { for (const f of fs.filter(f => !low || f.name.toLowerCase().includes(low))) out.push({ value: `folder:${f.id}`, label: `📁 ${f.path}`, hint: t_('samt Unterordnern') }); sugg.value = [...out] }) }
    else if (key === 'rel:' && rest.includes('=')) { const [t, p] = rest.split('='); for (const r of tree.rows.filter(r => p && (r.label.toLowerCase().includes(p.toLowerCase()) || tree.keyHit(r, p.toLowerCase()))).slice(0, 8)) out.push({ value: `rel:${t}=${Object.values(r.keys ?? {})[0] || r.id}`, label: `${icon(r.role)} ${r.label}`, hint: t_('Partner der Relation{0}', [r.keys ? ' · ' + tree.keyText(r) : '']) }) }
    else if (key === 'rel:') { out.push({ value: 'rel:any', label: t_('irgendeine Relation'), hint: t_('zu anderen Knoten') }); for (const t of (m?.relationTypes ?? []).filter(t => !(t.to ?? []).includes('media') && t.key.startsWith(low))) out.push({ value: `rel:${t.key}`, label: L(t.label) || t.key, hint: (t.symmetric ? 'symmetrisch' : 'gerichtet') + ' ' + t_('— mit = danach der Partner') }) }
    else if (key === 'since:') for (const [d, l] of [[0, 'heute'], [1, t_('seit gestern')], [7, 'letzte 7 Tage'], [30, 'letzte 30 Tage']]) out.push({ value: `since:${day(d)}`, label: l, hint: day(d) })
    else if (key === 'by:' && store.actor && store.actor.toLowerCase().startsWith(low)) out.push({ value: `by:${store.actor}`, label: `👤 ${store.actor}`, hint: 'ich' })
  }
  sugg.value = neg ? out.map(s => s.value.startsWith('-') ? s : { ...s, value: '-' + s.value, label: '¬ ' + s.label }) : out; suggIdx.value = 0
}
// Medienordner für folder: — einmal geholt, Pfad a › b
let foldersCache = null
async function mediaFolders() { if (foldersCache) return foldersCache; try { const d = await api.get('/api/media/folders'); const byId = new Map(d.folders.map(f => [f.id, f])); const path = f => { const out = []; for (let x = f; x; x = x.parent ? byId.get(x.parent) : null) { if (out.includes(x.name)) break; out.unshift(x.name) } return out.join(' › ') }; foldersCache = d.folders.map(f => ({ id: f.id, name: f.name, path: path(f) })); setTimeout(() => { foldersCache = null }, 30000); return foldersCache } catch { return [] } }
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
// „setTimeout“ gibt es in Vue-Vorlagen nicht (Absturz „K.setTimeout is not a function“) — darum hier
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
// sem:Suchbegriff: semantische Suche über die Vektoren (29.09.2026) — findet sinnverwandte Knoten statt Wortübereinstimmungen.
const semMatch = s => /^sem:(.+)/.exec(s)
watch(q, v => {
  clearTimeout(searchTimer)
  const s = v.trim()
  if (s.length < 2 && !/^-?[a-z]+:/.test(s)) { hits.value = new Map(); return }
  const sem = semMatch(s)
  searchTimer = setTimeout(async () => {
    try {
      if (sem && sem[1].trim().length > 1) {
        const r = await api.get(`/api/nodes/semantic?q=${encodeURIComponent(sem[1].trim())}`)
        if (!r.ready) { store.toast(r.reason ?? t_('Semantische Suche nicht bereit')); return }
        hits.value = new Map((r.hits ?? []).map(h => [h.id, h.score != null ? `${(h.score * 100).toFixed(0)} %` : '≈']))
      } else {
        hits.value = new Map((await api.get(`/api/search?q=${encodeURIComponent(s)}`)).map(h => [h.row.id, h.hit]))
      }
    } catch (e) { store.toast(e.message) }
  }, sem ? 500 : 250)
})

// Sichtbare Zeilen: aufgeklappt oder — mit Filter — alle Treffer samt Pfad.
const visible = computed(() => {
  const f = q.value.trim().toLowerCase()
  const out = []
  if (f) {
    const keep = new Set()
    for (const r of tree.rows)
      if (hits.value.has(r.id) || (!hasTerms.value && (r.label.toLowerCase().includes(f) || tree.keyHit(r, f) || r.id.includes(f)))) {
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

// ---- Die Auswahl: Strg+Klick sammelt, Shift+Klick nimmt den Bereich
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
  if (!pickedRows.value.length) { store.toast(t_('Erst auswählen: Strg+Klick im Baum')); return }
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
  return tree.rows.filter(r => !picked.value.has(r.id) && (r.label.toLowerCase().includes(q) || tree.keyHit(r, q) || r.id.includes(q))).slice(0, 12)
})
// Welche der Auswahl sind für Typ und Richtung erlaubt, welche gibt es schon?
const linkRows = computed(() => {
  // ohne Ziel (⇄ aus der Leiste: Ziel wird erst gesucht) keine Zeilen — sonst l.target.id auf null
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
  if (!store.actor) { store.toast(t_('👤 Name fehlt → Einstellungen')); return }
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
  if (!cmds.length) { store.toast(t_('Nichts zu verknüpfen')); return }
  try {
    const res = await api.post('/api/batch', { commands: cmds })
    if (res.error) store.toast(t_('{0} — {1} Einträge davor geschrieben', [res.error.message, res.results.length]))
    else store.toast(t_('{0} Relationen {1} → {2} Einträge (Stapel {3})', [n, L(t.label) || t.key, res.results.length, res.batch]), 'ok')
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
// Wiederherstellen: der Knoten mit allem, was darunter zurückgezogen wurde — die Einträge bleiben, es kommt NodeRestored dazu
// Zurückgezogene Wurzel: der Rückzug liegt im Stapel '' — den gibt es in keiner Knotenansicht, also hier in der Baum-Leiste
const rootUndo = computed(() => { const h = store.undo['']?.history ?? []; return h.length ? h[h.length - 1] : null })
async function undoRoot() { const s = store.undo['']; const h = s?.history.pop(); if (!h) return; s.redo.push(h); await restore(h.id, h.batch) }
async function restore(id, batch) {
  try {
    const res = batch ? await api.post(`/api/batches/${encodeURIComponent(batch)}/undo`) : await api.post(`/api/nodes/${encodeURIComponent(id)}/restore`)
    store.toast(t_('{0} Knoten wiederhergestellt (Stapel {1}){2}', [res.undone ?? 1, res.batch, res.failed?.length ? ` — ${res.failed.length} nicht: ${res.failed[0]}` : '']), 'ok')
    await store.poll(true); await tree.load(); router.push(`/tree/${id}`)
  } catch (e) { store.toast(e.message) }
}
async function retire(r) {
  const below = countBelow(r.id)
  const b = tree.below(r.id)
  if (!await ask.confirm({ title: t_('{0} {1} zurückziehen?', [icon(r.role), r.label]), warn: b.total ? t_('Mit allen {0} Knoten darunter: {1}', [b.total, b.summary]) : '', list: b.names, ok: b.total ? t_('🗑 {0} Knoten zurückziehen', [b.total + 1]) : t_('🗑 Zurückziehen'), danger: true })) return
  try {
    const res = await api.del(`/api/nodes/${encodeURIComponent(r.id)}${below ? '?recursive=true' : ''}`)
    const ps = (store.undo[r.parent ?? ''] ??= { history: [], redo: [] }); ps.history.push({ kind: 'retire', id: r.id, parent: r.parent, label: r.label, count: res?.retired ?? 1, batch: res?.batch ?? null }); ps.redo.length = 0
    if (res?.retired) store.toast(t_('{0} Knoten zurückgezogen (Stapel {1})', [res.retired, res.batch]), 'ok', { label: t_('↶ Wiederherstellen'), run: () => restore(r.id, res.batch), title: t_('stellt {0} Knoten wieder her: {1} {2}{3}', [res.retired, icon(r.role), r.label, res.retired > 1 ? ' ' + t_('mit {0} darunter', [res.retired - 1]) : '']) })
    await tree.load(); if (props.id === r.id || !tree.byId.has(props.id)) router.push(r.parent ? `/tree/${r.parent}` : '/tree')
  } catch (e) { store.toast(e.message) }
}
// Umhängen per Drag & Drop: Zeile ziehen, auf einer Zeile ablegen = darunter hängen.
// Dieselben Regeln wie der Server (Commands.Move): Variante unter Produkt, sonst unter Gruppe, nie unter sich selbst.
const dragId = ref(null)
const dropId = ref(null)
// Zugeklappte Äste öffnen sich, wenn man beim Ziehen eine Weile darüber steht.
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
// effectAllowed, zeigt der Browser das Verbotsschild und liefert kein drop. Was Shift bedeutet, entscheiden wir selbst.
function onDragStart(e, r) { dragId.value = r.id; e.dataTransfer.effectAllowed = 'all'; e.dataTransfer.setData('text/plain', r.id) }
const dragIds = () => picked.value.has(dragId.value) ? [...picked.value] : [dragId.value]
function onDragOver(e, r) {
  // Dateien: jede Zeile nimmt sie an. Ein Asset darf auch an eine Variante; nur Tabellen und JSON brauchen
  // eine Gruppe oder ein Produkt, und das sagt onDrop, wenn es soweit ist.
  if (!dragId.value && e.dataTransfer?.types?.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; dropId.value = r.id; return }
  const src = tree.byId.get(dragId.value)
  if (src) hoverOpen(r)
  const ok = e.shiftKey ? dragIds().some(id => id !== r.id) : dragIds().some(id => canDrop(tree.byId.get(id), r))
  if (!ok) { dropId.value = null; return }
  e.preventDefault(); e.dataTransfer.dropEffect = e.shiftKey ? 'move' : e.ctrlKey ? 'copy' : 'move'; dropId.value = r.id
}
/// Dateien als Assets an diesen Knoten: anlegen und zuordnen. Die Masse liest danach der Job probe, die
/// Vorschauen rechnet derive — darauf wartet hier niemand.
async function dropAssets(files, r) {
  if (!store.actor) { store.toast(t_('👤 Name fehlt → Einstellungen')); return }
  const typen = mediaTypesFor(store.model, r.role)
  if (!typen.length) { store.toast(t_('Kein Relationstyp zu Medien für diesen Knotentyp')); return }
  const erg = await attachFiles(files, r.id, typen)
  for (const f of erg.fehler) store.toast(f)
  if (erg.zugeordnet) { store.toast(medienMeldung(erg), 'ok'); store.poll(true); tree.load() }
  return erg
}

/// Shift+Drop: je Dokument ein neuer Knoten darunter — Produkt unter einer Gruppe, Variante unter einem Produkt —, benannt
/// nach der Datei, mit dem Dokument als Asset (28.09.2026). Ein Stapel je Knoten: anlegen, benennen; dann das Asset.
/// Ein Dokument: der Baum springt sofort hin, der Dialog lädt die Datei hoch und zeigt dabei den Fortschritt — nicht erst,
/// wenn alles durch ist (28.09.2026); mehrere: der Baum bleibt stehen, lädt hoch und zählt
async function dropAnlegen(files, r) {
  if (!store.actor) { store.toast(t_('👤 Name fehlt → Einstellungen')); return }
  if (r.role !== 'group' && r.role !== 'product') { store.toast(t_('Ziel muss eine Gruppe oder ein Produkt sein')); return }
  const dokumente = files.filter(f => IST_DOKUMENT.test(f.name))
  if (!dokumente.length) { store.toast(t_('Kein Dokument dabei')); return }
  if (r.role === 'product' && (r.axes ?? []).length) { store.toast(t_('Produkt hat Achsen — eine Variante braucht Achsenwerte')); return }
  const rolle = r.role === 'group' ? 'product' : 'variant'
  const typen = mediaTypesFor(store.model, rolle)
  const anlegen = async f => {
    const name = f.name.replace(/\.[^.]+$/, '')
    const res = await api.post('/api/batch', { commands: [
      rolle === 'product' ? { op: 'product.create', ref: 'n', args: { group: r.id } } : { op: 'variant.create', ref: 'n', args: { product: r.id, axisValues: {} } },
      { op: 'node.rename', args: { node: '@n', name } }] })
    if (res.error) { store.toast(`${f.name}: ${res.error.message}`); return null }
    const id = res.results?.find(x => x.ref === 'n')?.node
    if (!id) { store.toast(`${f.name}: ${t_('Knoten nicht angelegt')}`); return null }
    return { id, name }
  }
  if (dokumente.length === 1 && typen.length) {
    const [f] = dokumente; let a = null
    try { a = await anlegen(f) } catch (e) { store.toast(`${f.name}: ${e.message}`) }
    if (!a) return
    await store.poll(true); await tree.load(); tree.expand(r.id)
    store.pendingDocTables = { node: a.id, media: [], names: {}, dateien: [f], typen }
    router.push(`/tree/${a.id}`)
    return
  }
  const angelegt = []
  for (const f of dokumente) {
    const name = f.name.replace(/\.[^.]+$/, '')
    try {
      const a = await anlegen(f); if (!a) continue
      const id = a.id
      let medien = []
      if (typen.length) { const erg = await attachFiles([f], id, typen); for (const x of erg.fehler) store.toast(x); medien = erg.medien ?? [] }
      else store.toast(t_('Kein Relationstyp zu Medien für diesen Knotentyp'))
      angelegt.push({ id, name, medien })
    } catch (e) { store.toast(`${f.name}: ${e.message}`) }
  }
  if (!angelegt.length) return
  await store.poll(true); await tree.load(); tree.expand(r.id)
  if (angelegt.length === 1) {
    const [a] = angelegt
    const docs = a.medien.filter(m => IST_DOKUMENT.test(m.name))
    if (docs.length) store.pendingDocTables = { node: a.id, media: docs.map(m => m.id), names: Object.fromEntries(docs.map(m => [m.id, m.name])) }
    router.push(`/tree/${a.id}`)
  } else store.toast(t_('{0} Knoten angelegt', [angelegt.length]), 'ok')
}

async function onDrop(e, r) {
  if (!dragId.value && e.dataTransfer?.files?.length) {
    dropId.value = null
    const files = [...e.dataTransfer.files]
    // Shift: nicht anhängen, sondern anlegen — je Dokument ein Knoten darunter
    if (e.shiftKey) { await dropAnlegen(files, r); return }
    const f = files[0]
    // Bilder und Dokumente sind Assets — sie gehen nie in einen Tabellen-Import, auch wenn ein Plugin die
    // Endung kennt. Alles Weitere: JSON und Tabellen in ihren Import, der Rest wird ebenfalls ein Asset.
    if (!IST_ASSET.test(f.name)) {
      if (/\.json(\.gz)?$/i.test(f.name)) {
        if (r.role === 'variant') { store.toast(t_('Ziel muss eine Gruppe oder ein Produkt sein')); return }
        store.pendingImport = { file: f, parent: r.id }; router.push('/p/json/import'); return
      }
      // Tabelle (Excel, CSV, …): in den Tabellen-Import mit diesem Ziel, Analyse läuft sofort
      if (plugins.importerFor(f.name) || /\.(csv|txt|tsv)$/i.test(f.name)) {
        if (r.role === 'variant') { store.toast(t_('Ziel muss eine Gruppe oder ein Produkt sein')); return }
        if (!plugins.enabled('table')) { store.toast(t_('Tabellen-Import ist aus (⌁ Plugins → table)')); return }
        store.pendingImport = { file: f, parent: r.id, analyse: true }; router.push('/p/table/import'); return
      }
    }
    const erg = await dropAssets(files, r)
    // Mit Strg wird ein Dokument ausgewertet (34 L): die Knotenansicht fragt, welche Tabellenzeilen Attribute werden
    const dokumente = (e.ctrlKey || e.metaKey) ? (erg?.medien ?? []).filter(m => IST_DOKUMENT.test(m.name)) : []
    if (dokumente.length) { store.pendingDocTables = { node: r.id, media: dokumente.map(m => m.id), names: Object.fromEntries(dokumente.map(m => [m.id, m.name])) }; router.push(`/tree/${r.id}`) }
    return
  }
  const ids = dragIds()
  dragId.value = null; dropId.value = null; hoverStop()
  if (e.shiftKey) {   // verknüpfen: die Auswahl (oder die eine Zeile) mit diesem Ziel
    if (!picked.value.has(ids[0])) picked.value = new Set(ids)
    await openLink(r); return
  }
  let moved = 0, below = 0
  try {
    // Vorher prüfen, ob eigene Werte am neuen Ort verwaisen (orphans.js) — derselbe Dialog wie beim JSON-Import
    const todo = ids.map(id => tree.byId.get(id)).filter(src => canDrop(src, r))
    if (!todo.length) return
    const have = await groupsAt(r.id)
    const checks = []
    for (const src of todo) { const { need, own } = await neededByNode(src.id, store.model); checks.push({ src, missing: missingGroups(need, have, own) }) }
    const missing = new Map(); for (const c of checks) for (const m of c.missing) { if (!missing.has(m.group)) missing.set(m.group, new Set()); for (const a of m.attrs) missing.get(m.group).add(a) }
    const missingAll = [...missing].map(([group, attrs]) => ({ group, attrs: [...attrs] }))
    const what = todo.length === 1 ? `${icon(todo[0].role)} ${todo[0].label}${countBelow(todo[0].id) ? ` mit ${countBelow(todo[0].id)} darunter` : ''}` : t_('{0} Einträge', [todo.length])
    const res = missingAll.length
      ? await confirmMove({ title: `${what} → ${icon(r.role)} ${r.label}`, warn: '', missing: missingAll, rootLabel: todo.length === 1 ? `${icon(todo[0].role)} ${todo[0].label}` : t_('jedem verschobenen Eintrag'), ok: t_('Umhängen') })
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
// Auswahl: Status für alle, Zurückziehen für alle — je Knoten ein Aufruf; ein Dialog vorher mit den Zahlen
// Workflows im Kontextmenü (27): ein Untermenü ⚑ mit allen Übergängen der Workflows, die für den Knotentyp gelten — für die Auswahl;
// der Server prüft je Knoten Zustand und Rolle, das Ergebnis sagt „n von m“
const wfDefs = ref([])
async function loadWorkflows() { try { wfDefs.value = await api.get('/api/workflows') } catch { wfDefs.value = [] } }
onMounted(loadWorkflows)
async function wfStepAll(rows, wf, t) {
  let note = null
  if (t.noteRequired) { note = await ask.prompt({ title: `${L(t.label) || t.key} (${rows.length})`, text: t_('Notiz ist Pflicht — was ist zu tun?'), placeholder: t_('Notiz') }); if (!note?.trim()) return }
  let ok = 0; const why = []
  for (const x of rows) { try { await api.post(`/api/nodes/${encodeURIComponent(x.id)}/workflow/${wf.key}/${t.key}`, { note }); ok++ } catch (e) { if (why.length < 3) why.push(`${x.label}: ${e.message}`) } }
  store.toast(`⚑ ${L(t.label) || t.key}: ${ok} von ${rows.length}${why.length ? ' — ' + why.join(' · ') : ''}`, ok ? 'ok' : 'warn')
  await store.poll(true)
}
async function setStatusAll(rows, status) {
  for (const x of rows) { try { await api.post(`/api/nodes/${encodeURIComponent(x.id)}/status`, { status }) } catch (e) { store.toast(`${x.label}: ${e.message}`) } }
  await store.poll(true); await tree.load()
}
async function retireAll(rows) {
  // nur die obersten der Auswahl: ein Knoten, dessen Vorfahr auch ausgewählt ist, geht mit dem Vorfahren
  const ids = new Set(rows.map(x => x.id))
  const tops = rows.filter(x => !tree.ancestors(x.id).some(a => ids.has(a.id)))
  const below = tops.reduce((k, x) => k + countBelow(x.id), 0)
  if (!await ask.confirm({ title: t_('{0} Knoten zurückziehen?', [tops.length]), warn: below ? t_('Mit allen {0} Knoten darunter — insgesamt {1}', [below, tops.length + below]) : t_('{0} Knoten', [tops.length]), list: tops.slice(0, 8).map(x => `${icon(x.role)} ${x.label}`), ok: t_('🗑 {0} Knoten zurückziehen', [tops.length + below]), danger: true })) return
  let n = 0
  for (const x of tops) { try { const res = await api.del(`/api/nodes/${encodeURIComponent(x.id)}${countBelow(x.id) ? '?recursive=true' : ''}`); n += res?.retired ?? 1 } catch (e) { store.toast(`${x.label}: ${e.message}`) } }
  picked.value = new Set()
  store.toast(t_('{0} Knoten zurückgezogen', [n]), 'ok')
  await tree.load(); if (!tree.byId.has(props.id)) router.push('/tree')
}
async function statusAb(r) {
  try { if (await setStatusAb(r)) store.toast(t_('Status gesetzt'), 'ok') } catch (e) { store.toast(e.message) }
}
async function setStatus(r, status) {
  // fragt bei Subitems „auch für die n Subitems?" (status.js)
  try { await setStatusScoped(r, status) } catch (e) { store.toast(e.message) }
}
// Eigener Name im Baum (jede Rolle) = angeheftet (📌); leer = Automatik (★ Attribut, bei Varianten SKU/Achsen, sonst Id).
async function setName(r, name) {
  try { await api.post(`/api/nodes/${encodeURIComponent(r.id)}/name`, { name }, 'PUT'); await store.poll(true); await tree.load() } catch (e) { store.toast(e.message) }
}
async function rename(r) {
  const name = await ask.prompt({ title: t_('Name im Baum'), text: `${r.label} — leer = Automatik (★ Attribut)`, value: r.name ?? r.label, placeholder: 'leer = Automatik', ok: t_('✎ Umbenennen') })
  if (name != null) await setName(r, name)
}
// Fixieren übernimmt den Namen, den die Automatik gerade zeigt, als eigenen; Freigeben nimmt ihn weg.
const fix = r => setName(r, r.name ? '' : r.label)
async function duplicate(r, deep) {
  try {
    const res = await api.post(`/api/nodes/${encodeURIComponent(r.id)}/duplicate?deep=${deep}`)
    store.toast(t_('Kopie: {0} Einträge (Stapel {1})', [res.entries, res.batch]), 'ok')
    await store.poll(true); await tree.load(); router.push(`/tree/${res.id}`)
  } catch (e) { store.toast(e.message) }
}
// Rechtsklick: was man mit diesem Knoten tun kann — die Tastenkürzel gelten im Menü.
// Was unter einem Knoten liegt, heisst „Subitems“ — nicht „Kinder“
const below = () => t_('Subitems')
/// Sichtbar für Rollen (27.09.2026): dieser Knoten und alles darunter — nur für diese Rollen, bis ein Nachfahre eigene nennt. Leer = für alle.
async function restrict(r) {
  let rollen = []
  try { rollen = (await api.get('/api/auth/roles')).map(x => x.key) } catch { rollen = [] }
  const eingabe = await ask.prompt({ title: t_('Sichtbar für Rollen — {0}', [r.label]), text: t_('Rollen mit Komma, leer = für alle. Administratoren sehen immer alles.') + (rollen.length ? ' · ' + rollen.join(', ') : ''), value: (r.visibleTo ?? []).join(', '), placeholder: rollen.join(', '), ok: t_('✓ Setzen') })
  if (eingabe === null) return
  const roles = eingabe.split(/[,\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean)
  try { await api.post(`/api/nodes/${encodeURIComponent(r.id)}/roles`, { roles }, 'PUT'); await store.poll(true); await tree.load(); store.toast(roles.length ? t_('{0}: sichtbar für {1}', [r.label, roles.join(', ')]) : t_('{0}: sichtbar für alle', [r.label]), 'ok') }
  catch (e) { store.toast(e.message) }
}
async function contextMenu(e, r) {
  e.preventDefault()   // vor dem await — sonst kommt das Browsermenü
  router.push(`/tree/${r.id}`)
  const kids = tree.kids(r.id).length
  // Mehrfachauswahl: liegt die Zeile in der Auswahl, gilt das Menü für die ganze Auswahl — Zurückziehen, Status,
  // Duplizieren für alle; was nur einzeln geht (Umbenennen, Tabelle, Plugins), ist ausgegraut mit Hinweis
  const sel = picked.value.has(r.id) && picked.value.size > 1 ? pickedRows.value : null
  const only1 = sel ? { disabled: true, hint: t_('nur einzeln ({0} ausgewählt)', [sel.length]) } : {}
  // Workflow-Schritte, die zur Auswahl passen (Server zählt je Übergang, wer jetzt dort steht und darf) — nichts anbieten, was nicht geht
  let wfItems = []
  if (r.role !== 'rubric' && wfDefs.value.length) {
    try {
      const app = await api.post('/api/workflows/applicable', { ids: (sel ?? [r]).map(x => x.id) })
      wfItems = app.map(a => ({ label: `${a.workflowLabel?.de || a.workflow}: ${L(a.label) || a.key} → ${a.toLabel?.de || a.to}${a.of > 1 ? ` (${a.count} von ${a.of})` : ''}`, icon: '⚑', disabled: a.count === 0,
        hint: [a.blocked ? t_('{0} gesperrt (Freigabe nicht möglich)', [a.blocked]) : '', a.noteRequired ? t_('Notiz Pflicht') : '', a.effects?.length ? a.effects.join(', ') : ''].filter(Boolean).join(' · '),
        action: () => wfStepAll(sel ?? [r], { key: a.workflow }, a) }))
    } catch { wfItems = [] }
  }
  const offen = (x, s) => x.role !== 'rubric' && (x.hasStatus === false || x.status !== s)
  const st = s => (sel ? sel.some(x => offen(x, s)) : offen(r, s))
    ? { label: store.statusText(s) + (sel ? ` (${sel.filter(x => offen(x, s)).length})` : ''), action: () => sel ? setStatusAll(sel.filter(x => offen(x, s)), s) : setStatus(r, s) } : null
  // Aufgeräumt: kein Neu-anlegen (die Knöpfe oben), kein Auf-/Zuklappen, kein Id kopieren (Id steht im Tooltip und im Kopf);
  // Plugin-Einträge je Plugin in einem Untermenü
  // Plugin-Einträge nach Thema: ein Untermenü je Thema — Import, Export, Datenblatt,
  // Datenanalyse — darin alles dazu, quer über die Plugins. Das Thema nennt die Aktion (topic), sonst die Art des Plugins (kind).
  const TOPICS = [['import', t_('⇩ Import')], ['export', t_('⇪ Export')], ['datasheet', t_('▤ Datenblatt')], ['analysis', t_('✓ Datenanalyse')], ['classification', t_('⌗ Klassifikation')], ['jobs', t_('⏱ Jobs')], ['tools', t_('⌁ Werkzeuge')]]
  const KIND_TOPIC = { import: 'import', export: 'export', output: 'datasheet', quality: 'analysis', classification: 'classification' }
  const byTopic = new Map()
  const add = (topic, item) => { if (!byTopic.has(topic)) byTopic.set(topic, []); byTopic.get(topic).push(item) }
  // label(row) darf null liefern — der Eintrag gilt dann hier nicht (ETIM: „EC004718 Laptop“ nur mit Klasse); hint darf eine Funktion sein
  for (const a of plugins.nodeActions.filter(a => !a.multi && (!a.roles || a.roles.includes(r.role))).map(a => ({ ...a, _label: typeof a.label === 'function' ? a.label(r, below(r)) : a.label })).filter(a => a._label)) {
    const kind = plugins.list.find(p => p.key === a.key)?.manifest?.kind
    add(a.topic ?? KIND_TOPIC[kind] ?? 'tools', { key: a.key, order: a.order, label: a._label, icon: a.icon || '⌁', hint: typeof a.hint === 'function' ? a.hint(r) : a.hint ?? a.key, action: () => Promise.resolve(a.run(r.id, { ...plugins.ctx(a.key), tree })).catch(e => store.toast(`${a.key}: ${e.message}`)) })
  }
  // Excel am Knoten, Tabellen-Export, Datenqualität kommen als nodeActions der Basis-Plugins table und da
  if (r.role !== 'variant' && plugins.enabled('json')) add('import', { label: t_('JSON-Rohdaten hierher importieren …'), icon: '⇩', hint: 'json', action: () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = () => { if (i.files[0]) { store.pendingImport = { file: i.files[0], parent: r.id }; router.push('/p/json/import') } }; i.click() } })
  // Skripte am Knoten: multi-fähige nodeActions mit items (scriptum) — auch bei Mehrfachauswahl, laufen auf allen selektierten
  const scriptMenu = []
  for (const a of plugins.nodeActions.filter(a => a.multi && typeof a.items === 'function' && (!a.roles || a.roles.includes(r.role)))) {
    for (const it of (a.items(r, below(r), sel) || [])) if (it && it.label) scriptMenu.push({ label: it.label, hint: it.hint, action: () => Promise.resolve(it.run({ ...plugins.ctx(a.key), tree })).catch(e => store.toast(`${a.key}: ${e.message}`)) })
  }
  const topicMenus = TOPICS.filter(([k]) => byTopic.has(k)).map(([k, label]) => ({ label: label.slice(2), icon: label.slice(0, 1), items: plugins.sorted(byTopic.get(k), k, x => x.label), ...(picked.value.has(r.id) && picked.value.size > 1 ? { disabled: true, hint: t_('nur einzeln') } : {}) }))
  menu.open(e, [
    { label: t_('Umbenennen'), icon: '✎', key: 'u', hint: r.name ? '📌 fixiert' : t_('★ Automatik'), action: () => rename(r), ...only1 },
    // Symbol ist der Pin — bei beiden; der Hinweis rechts sagt, was danach gilt
    { label: r.name ? t_('Benennung lösen') : t_('Benennung fixieren'), icon: '📌', key: 'f', hint: r.name ? t_('★ gilt wieder') : r.label, action: () => fix(r), ...only1 },
    { label: t_('Sichtbar für Rollen …'), icon: '🔒', key: 's', hint: r.visibleTo?.length ? r.visibleTo.join(', ') : t_('alle'), action: () => restrict(r), ...only1 },
    { sep: true },
    // Massenbearbeitung wie in Excel: die Kinder als Tabelle — beim Produkt die Varianten, bei der Gruppe die Produkte, dazu alle Varianten darunter
    // eigenes Fenster, Excel-ähnlich pflegen, Schliessen übernimmt — Popup blockiert? dann im Hauptfenster
    r.role !== 'variant' && kids ? { label: t_('Subitems tabellarisch bearbeiten ({0})', [kids]), icon: '⊞', key: 'b', hint: t_('↗ Fenster'), action: () => openTable(`/table/${r.id}?popup=1`), ...only1 } : null,
    r.role === 'group' && kids ? { label: t_('Alle Varianten darunter tabellarisch bearbeiten'), icon: '⊞', key: 'w', hint: t_('↗ Fenster'), action: () => openTable(`/table/${r.id}?role=variant&deep=1&popup=1`) } : null,
    (r.role !== 'variant' && kids) ? { sep: true } : null,
    sel ? { label: t_('Duplizieren ({0})', [sel.length]), icon: '⧉', key: 'd', hint: t_('ohne SKU/Freigaben'), disabled: sel.some(x => x.role === 'variant' && Object.keys(x.axisValues).length > 0), action: async () => { for (const x of sel) await duplicate(x, false) } }
        : { label: t_('Duplizieren'), icon: '⧉', key: 'd', hint: t_('ohne SKU/Freigaben'), disabled: r.role === 'variant' && Object.keys(r.axisValues).length > 0, action: () => duplicate(r, false) },
    !sel && r.role !== 'variant' && kids ? { label: t_('Mit {0} darunter duplizieren', [countBelow(r.id)]), icon: '⧉', key: 't', action: () => duplicate(r, true) } : null,
    { sep: true },
    ...(r.role !== 'rubric' ? [...(store.model?.statuses ?? []).map(s => st(s.key)),
      // Ein Status gilt ab einem Tag: zum Jahreswechsel auslaufen, einen Stand nachtragen (28.09.2026)
      { label: t_('Status ab Datum …'), icon: '⏱', hint: r.statusNext ? `${r.statusNextAb} ${store.statusLabel(r.statusNext)}` : '', action: () => statusAb(r), ...only1 },
      { sep: true }] : []),   // Status aus dem Modell
    ...(wfItems.length ? [{ label: t_('Workflow') + (sel ? ` (${sel.length})` : ''), icon: '⚑', items: wfItems }, { sep: true }] : []),
    { label: picked.value.has(r.id) ? t_('Abwählen') : t_('Auswählen'), icon: '☑', key: 'm', hint: 'Strg+Klick', action: () => { const s = new Set(picked.value); s.has(r.id) ? s.delete(r.id) : s.add(r.id); picked.value = s } },
    picked.value.size ? { label: t_('Auswahl aufheben ({0})', [picked.value.size]), icon: '☐', key: 'Escape', hint: 'Esc', action: () => { picked.value = new Set() } } : null,
    { label: t_('Im Journal zeigen'), icon: '≡', key: 'j', action: () => router.push({ path: '/journal', query: { q: r.id } }), ...only1 },
    ...(topicMenus.length ? [{ sep: true }, ...topicMenus] : []),
    ...(scriptMenu.length ? [{ label: t_('Skripte') + (sel ? ` (${sel.length})` : ''), icon: 'λ', items: scriptMenu }] : []),
    { sep: true },
    sel ? { label: t_('{0} Ausgewählte zurückziehen{1}', [sel.length, sel.reduce((k, x) => k + countBelow(x.id), 0) ? ' ' + t_('(mit {0} darunter)', [sel.reduce((k, x) => k + countBelow(x.id), 0)]) : '']), icon: '🗑', key: 'Delete', danger: true, action: () => retireAll(sel) }
        : { label: kids ? t_('Mit {0} darunter zurückziehen', [countBelow(r.id)]) : t_('Zurückziehen'), icon: '🗑', key: 'Delete', danger: true, action: () => retire(r) },
  ])
}
function onGlobalKey(e) {
  if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) { e.preventDefault(); search.value?.focus() }
  // Esc hebt die Auswahl auf (wenn kein Dialog offen ist) — „Wie löse ich eine Selektion wieder auf?“
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

// Anlegen: ein Dialog mit den Pflichtfeldern — die Attribute, die am neuen Knoten gelten
// (Gruppen am Pfad des Elternknotens, dort aktiv) und für irgendeinen Kanal Pflicht sind, sprachabhängige
// nur in der Mastersprache. Erst wenn alles gefüllt ist, wird geschrieben: Anlegen + Werte als ein Stapel.
const DEPTH = { group: 0, product: 1, variant: 2 }
const required = ref([])      // [{ def, locale }]
const vals = ref({})          // key → Wert
const master = computed(() => store.model?.masterLocale ?? store.model?.locales[0]?.code ?? null)
const atRoot = ref(false)     // Gruppe an der Wurzel statt unter dem offenen Knoten (ein neuer Baum)
/// Wohin die neue Gruppe kommt: der offene Knoten — oder die Wurzel, wenn keiner offen ist oder man es umschaltet
const newParent = computed(() => atRoot.value ? null : groupTarget.value)
async function start(kind) {
  atRoot.value = kind === 'group' && !groupTarget.value
  const parent = kind === 'variant' ? productTarget.value : newParent.value
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
  // Cursor gleich ins erste Feld — autofocus greift bei nachträglich eingefügten Elementen nicht
  await nextTick(); dialog.value?.querySelector('input, select')?.focus()
}
const dialog = ref(null)
const complete = computed(() => required.value.every(r => (vals.value[r.def.key] ?? '').trim() !== '') && Object.values(form.value).every(v => v !== ''))
async function create() {
  if (!complete.value) return
  if (!store.actor) { store.toast(t_('👤 Name fehlt → Einstellungen')); return }
  const kind = creating.value
  const parent = kind === 'variant' ? productTarget.value : kind === 'group' ? newParent.value : groupTarget.value
  const cmds = [kind === 'group' ? { op: 'group.create', ref: 'n', args: { parent: parent?.id ?? null } }
    : kind === 'product' ? { op: 'product.create', ref: 'n', args: { group: parent.id } }
    : { op: 'variant.create', ref: 'n', args: { product: parent.id, axisValues: form.value } }]
  for (const r of required.value) {
    const v = vals.value[r.def.key].trim()
    cmds.push({ op: 'attribute.set', args: { node: '@n', attribute: r.def.key, locale: r.locale, ...(r.def.multiple ? { values: v.split(',').map(x => x.trim()).filter(Boolean) } : { value: v }) } })
  }
  try {
    const res = await api.post('/api/batch', { commands: cmds })
    if (res.error) { store.toast(t_('{0} — {1} Einträge geschrieben', [res.error.message, res.results.length])); }
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
      <h1>{{ $t("▣ Baum") }}</h1>
      <span class="muted">{{ tree.rows.length }}</span>
      <input ref="search" v-model="q" type="search" :placeholder="$t('Suche in allem /')" style="flex:1;min-width:0" autocomplete="off"
        @input="suggest" @focus="suggest" @click="suggest" @blur="hideSugg" @keydown="onSearchKey"
        :title="$t('Text — oder Bedingungen (Vorschläge beim Tippen): attr:function · attr:function=*sku* · attr:x= (leer) · empty:name/en · incomplete:web · role:variant · status:active · group:logistics · under:<id> · by:<name> · since:2026-09-10')" />
    </div>
    <div v-if="sugg.length" class="sugg">
      <div v-for="(s, i) in sugg" :key="s.value" class="sugg-row" :class="{ on: i === suggIdx }" @mousedown.prevent="accept(s)" @mousemove="suggIdx = i">
        <span>{{ s.label }}</span><span class="muted mono">{{ s.hint }}</span>
      </div>
    </div>
    <div v-if="terms.length" class="chips terms">
      <span v-for="t in terms" :key="t" class="chip mono" :class="{ not: t.startsWith('-') }" :title="t.startsWith('-') ? $t('Verneinung aufheben') : 'Verneinen (Gegenteil)'" @click="q = q.split(/\s+/).map(w => w === t ? (t.startsWith('-') ? t.slice(1) : '-' + t) : w).join(' ')">{{ t }}<button @click.stop="dropTerm(t)" @click="dropTerm(t)" :title="$t('Bedingung entfernen')">×</button></span>
    </div>
    <div class="toolbar create">
      <button @click="start('group')" :title="groupTarget ? $t('Gruppe unter {0} anlegen (im Dialog auf die Wurzel umschaltbar — ein neuer Baum)', [groupTarget.label]) : $t('Gruppe an der Wurzel anlegen (ein neuer Baum)')">+ ▣</button>
      <button @click="start('product')" :disabled="!groupTarget" :title="groupTarget ? $t('Produkt unter {0}', [groupTarget.label]) : $t('erst eine Gruppe wählen')">+ ▦</button>
      <button @click="start('variant')" :disabled="!productTarget" :title="productTarget ? $t('Variante unter {0}', [productTarget.label]) : $t('erst ein Produkt wählen')">+ ◆</button>
      <span class="grow" />
      <button v-if="rootUndo" class="x" @click="undoRoot" :title="`↶ ${rootUndo.label}${rootUndo.count > 1 ? ` mit ${rootUndo.count - 1} darunter` : ''} wiederherstellen (Wurzel)`">{{ $t("↶ Wurzel") }}</button>
      <button v-if="q" @click="pickVisible" :title="$t('Alle sichtbaren Treffer auswählen')">{{ $t("☑ Treffer wählen") }}</button>
      <template v-if="picked.size">
        <span class="chip" :title="$t('die Auswahl — Strg+Klick sammelt, Shift+Klick nimmt den Bereich; × oder Esc hebt sie auf')">☑ {{ picked.size }} <button @click="picked = new Set()" :title="$t('Auswahl aufheben (Esc)')">×</button></span>
        <button class="primary" @click="openLink(null)" :title="$t('die Auswahl mit einem Ziel verknüpfen (oder mit Shift auf ein Ziel ziehen)')">⇄</button>
      </template>
    </div>

    <!-- Verknüpfen: Auswahl → Ziel, dann Typ und Richtung -->
    <div v-if="link" class="overlay" @keydown="onLinkKey">
      <div class="dialog" style="min-width:640px;max-width:92vw">
        <div class="toolbar"><h1>{{ $t("⇄ {0} Einträge verknüpfen", [pickedRows.length]) }}</h1><span class="grow" /><button class="x" @click="link = null" :title="$t('Esc')">×</button></div>
        <table class="grid form"><colgroup><col style="width:130px" /><col /></colgroup><tbody>
          <tr><td class="attr">{{ $t("Ziel") }}</td><td>
            <span v-if="link.target" class="chip">{{ icon(link.target.role) }} {{ link.target.label }} <button @click="link.target = null; link.existing = null" :title="$t('anderes Ziel')">×</button></span>
            <input v-else v-model="link.q" type="search" :placeholder="$t('🔍 Name, SKU, Id')" style="width:320px" autofocus />
            <div v-if="!link.target && linkMatches.length" class="picker" style="max-width:420px">
              <div v-for="m in linkMatches" :key="m.id" class="pick" @click="link.target = m; link.q = ''; loadExisting()">{{ icon(m.role) }} {{ m.label }}<span class="muted mono" style="margin-left:auto;font-size:11px">{{ tree.keyText(m) || m.id }}</span></div>
            </div>
          </td></tr>
          <tr><td class="attr">{{ $t("Relation") }}</td><td>
            <select v-model="link.type" style="width:260px"><option v-for="t in relTypes" :key="t.key" :value="t.key">{{ t.symmetric ? '⇄' : '→' }} {{ $L(t.label) || t.key }}{{ t.group ? ' · ▤ ' + t.group : '' }}</option></select>
            <span v-if="linkType" class="muted" style="margin-left:8px">{{ linkType.symmetric ? $t('beidseitig — liest sich von beiden Enden gleich') : $t('einseitig — zwei Lesarten') }}</span>
          </td></tr>
          <tr v-if="linkType && link.target"><td class="attr">{{ $t("Richtung") }}</td><td class="dirs">
            <label :class="{ on: link.dir === 'target-first' }"><input type="radio" value="target-first" v-model="link.dir" />
              <b>{{ link.target.label }}</b> — {{ $L(linkType.label) || linkType.key }} → <b>{{ $t("{0} Einträge", [pickedRows.length]) }}</b>
              <div v-if="!linkType.symmetric" class="muted reading">{{ $t("die Einträge sind „{0}“ {1}", [$L(linkType.reverse) || '…', link.target.label]) }}</div></label>
            <label v-if="!linkType.symmetric" :class="{ on: link.dir === 'set-first' }"><input type="radio" value="set-first" v-model="link.dir" />
              <b>{{ $t("{0} Einträge", [pickedRows.length]) }}</b> — {{ $L(linkType.label) || linkType.key }} → <b>{{ link.target.label }}</b>
              <div class="muted reading">{{ $t("{0} ist „{1}“ jedes Eintrags", [link.target.label, $L(linkType.reverse) || '…']) }}</div></label>
          </td></tr>
        </tbody></table>
        <div class="scroll" style="max-height:340px">
          <table class="grid" style="width:auto">
            <thead><tr><th style="width:320px">{{ $t("Eintrag") }}</th><th v-for="a in linkAttrs" :key="a.key" style="width:140px" :title="a.key">{{ $L(a.label) || a.key }}<span v-if="a.unit" class="muted"> {{ a.unit }}</span></th><th style="width:120px"></th></tr>
              <tr v-if="linkAttrs.length" class="muted"><td style="font-size:11px;padding:2px 8px">{{ $t("für alle:") }}</td><td v-for="a in linkAttrs" :key="a.key" style="padding:2px 4px"><input type="text" style="width:100%" :placeholder="$L(a.label) || a.key" @change="fillAll(a.key, $event.target.value)" /></td><td></td></tr>
            </thead>
            <tbody>
              <tr v-for="x in linkRows" :key="x.r.id" :class="{ muted: !x.ok || x.exists }">
                <td :title="x.r.id">{{ icon(x.r.role) }} {{ x.r.label }}</td>
                <td v-for="a in linkAttrs" :key="a.key" style="padding:2px 4px"><input v-if="x.ok && !x.exists" type="text" style="width:100%" :value="link.vals[x.r.id]?.[a.key] ?? ''" @input="(link.vals[x.r.id] ??= {})[a.key] = $event.target.value" /></td>
                <td class="muted" style="font-size:11px">{{ x.exists ? $t('gibt es schon') : !x.ok ? $t('Typ erlaubt das nicht') : '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="chips" style="padding:8px">
          <button class="primary" :disabled="!link.target || !linkType || !linkCount" @click="runLink">{{ $t("⇄ {0} verknüpfen", [linkCount]) }}</button>
          <button @click="link = null">{{ $t("Abbrechen") }}</button>
          <span class="grow" /><span class="muted">{{ $t("ein Stapel ·") + ' ' }}<kbd>{{ $t("Esc") }}</kbd></span>
        </div>
      </div>
    </div>

    <!-- Anlegen: Dialog mit Pflichtfeldern (Mastersprache); erst vollständig, dann ein Stapel -->
    <div v-if="creating" class="overlay" @keydown="onDialogKey">
      <div class="dialog" ref="dialog">
        <div class="toolbar"><h1>{{ icon(creating) }} {{ creating === 'group' ? $t('Neue Gruppe') : creating === 'product' ? $t('Neues Produkt') : $t('Neue Variante') }}</h1>
          <span v-if="creating === 'group' && groupTarget" class="view-chip" :class="{ on: atRoot }" role="button" tabindex="0"
            :title="atRoot ? $t('an der Wurzel — ein neuer Baum') : $t('unter {0} — Klick legt sie an der Wurzel an', [groupTarget.label])"
            @click="atRoot = !atRoot" @keydown.enter.prevent="atRoot = !atRoot" @keydown.space.prevent="atRoot = !atRoot">{{ atRoot ? $t('⌂ an der Wurzel') : '↳ unter ' + groupTarget.label }}</span>
          <span v-else class="muted">{{ creating === 'variant' ? 'unter ' + productTarget.label : $t('an der Wurzel') }}</span></div>
        <table class="grid form"><colgroup><col style="width:170px" /><col style="width:300px" /></colgroup><tbody>
          <tr v-for="a in (creating === 'variant' ? productTarget.axes : [])" :key="'ax-' + a">
            <td class="attr" :title="a + ' ' + $t('— Variantenachse')">◆ {{ $L(attrDef(a)?.label) || a }}</td>
            <td>
              <select v-if="attrDef(a)?.type === 'enum'" v-model="form[a]" style="width:100%"><option value="">…</option><option v-for="v in listValues(a)" :key="v.value" :value="v.value">{{ $L(v.label) || v.value }}</option></select>
              <input v-else v-model="form[a]" type="text" style="width:100%" />
            </td>
          </tr>
          <tr v-for="(r, i) in required" :key="r.def.key">
            <td class="attr" :title="r.def.key + (r.locale ? ' · ' + r.locale : '')">● {{ $L(r.def.label) || r.def.key }}<span v-if="r.locale" class="muted">&nbsp;{{ r.locale }}</span></td>
            <td>
              <select v-if="r.def.type === 'enum'" v-model="vals[r.def.key]" style="width:100%"><option value="">…</option><option v-for="v in listValues(r.def.key)" :key="v.value" :value="v.value">{{ $L(v.label) || v.value }}</option></select>
              <select v-else-if="r.def.type === 'boolean'" v-model="vals[r.def.key]" style="width:100%"><option value="">…</option><option value="true">{{ $t("✓ ja") }}</option><option value="false">{{ $t("✗ nein") }}</option></select>
              <input v-else v-model="vals[r.def.key]" :type="r.def.type === 'date' ? 'date' : 'text'" style="width:100%" :placeholder="r.def.multiple ? 'kommagetrennt' : ''" :autofocus="i === 0" />
            </td>
          </tr>
        </tbody></table>
        <div v-if="!required.length && !(creating === 'variant' && productTarget.axes.length)" class="muted" style="padding:6px 8px;font-size:12px"><span :title="$t('Anlegen, dann rechts pflegen.')">{{ $t("Keine Pflichtfelder an diesem Knotentyp") }}</span></div>
        <div class="chips" style="padding:8px">
          <button class="primary" :disabled="!complete" @click="create">{{ $t("Anlegen") }}</button>
          <button @click="creating = null">{{ $t("Abbrechen") }}</button>
          <span class="grow" /><span class="muted"><kbd>{{ $t("Enter") }}</kbd> · <kbd>{{ $t("Esc") }}</kbd></span>
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
        <span class="label" :class="{ pinned: r.name }" :title="r.name ? $t('Name angeheftet (kursiv) — die ★-Automatik gilt hier nicht. Rechtsklick → Benennung lösen') : ''">{{ r.label }}</span>
        <span v-if="hits.get(r.id) && !r.label.toLowerCase().includes(q.trim().toLowerCase())" class="muted hit" :title="hits.get(r.id)">{{ hits.get(r.id) }}</span>
        <span v-if="r.role === 'variant' && r.keys && Object.keys(r.axisValues).length" class="muted axis">{{ Object.values(r.axisValues).join(' · ') }}</span>
        <span v-if="r.status && r.status !== 'draft' && store.status(r.status)" :style="store.statusStyle(r.status)" :title="store.statusLabel(r.status)">{{ store.status(r.status).icon }}</span>
        <span v-if="tree.kids(r.id).length" class="muted count">{{ tree.kids(r.id).length }}</span>
      </div>
      <div v-if="tree.loaded && !tree.rows.length" class="empty">{{ $t("Leer — oben") + ' ' }}<b>+ ▣</b>{{ ' ' + $t("legt die erste Gruppe an.") }}</div>
      <div v-else-if="q && !visible.length" class="empty">{{ $t("Nichts zu „{0}“", [q]) }}</div>
    </div>
  </div>

  <Splitter v-model="treeW" :min="200" :max="800" />
  <NodeView v-if="id" :id="id" :key="id" />
  <div v-else class="pane" style="flex:1"><div class="empty">{{ $t("Knoten wählen — oder oben anlegen.") }}</div></div>
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
/* flex: 0 0 — Pfeil und Symbol schrumpfen nie: sonst fiel der leere Pfeil eines Blatts auf null, sobald eine lange
   Bezeichnung die Zeile überlaufen liess, und Geschwister sahen aus wie Ebenen (28.09.2026) */
.twisty { flex: 0 0 14px; width: 14px; color: var(--muted); font-size: 11px; text-align: center; cursor: pointer; }
.twisty.leaf { cursor: default; }
.icon { flex: 0 0 16px; width: 16px; text-align: center; }
.node.group .icon { color: var(--muted); }
.node.product .icon { color: var(--accent); }
.node.variant .icon { color: var(--warn); }
.label { overflow: hidden; text-overflow: ellipsis; }
.axis { font-size: 11px; }
/* angehefteter Name: kursiv, kein Symbol — die Information ist klein */
.label.pinned { font-style: italic; }
.hit { font-size: 11px; overflow: hidden; text-overflow: ellipsis; max-width: 45%; }
.count { margin-left: auto; font-size: 11px; flex-shrink: 0; }
</style>
