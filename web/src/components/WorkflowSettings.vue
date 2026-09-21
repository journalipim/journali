<script setup>
// Einstellungen → Workflows (27, Taloan 21.09.2026: „Workflow-Designer mit Freigaben, Korrekturschleifen“): je Workflow die Zustände
// (Kacheln in der Skizze), die Übergänge (Pfeile: von → nach, Rolle, Notiz-Pflicht, Wirkungen) und wofür er gilt. Alles im Journal
// (WorkflowDefined); Speichern schreibt die ganze Definition. Die Grafik ist die Arbeitsfläche (Taloan, 21.09.: „verschieben und anordnen“):
// Kacheln frei ziehen (Lage wird gespeichert), vom ● auf eine andere Kachel ziehen = Übergang, Klick markiert die Zeile, Entf löscht.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'

const list = ref([]); const cur = ref(null); const roles = ref([]); const dirty = ref(false)
const COLORS = [['muted', 'grau'], ['warn', 'gelb'], ['neg', 'rot'], ['accent', 'blau'], ['pos', 'grün']]
const ROLES = [['group', '▣ Gruppe'], ['product', '▦ Produkt'], ['variant', '◆ Variante']]
const EFFECTS = computed(() => { const m = store.model; const out = []; for (const c of m?.channels ?? []) { out.push([`release:${c.key}`, `Freigabe ${c.key}`], [`revoke:${c.key}`, `Freigabe ${c.key} zurück`]) } out.push(['status:active', 'Status aktiv'], ['status:draft', 'Status Entwurf'], ['status:discontinued', 'Status ausgelaufen']); return out })
async function load() { try { list.value = await api.get('/api/workflows'); if (cur.value) cur.value = clone(list.value.find(w => w.key === cur.value.key) ?? list.value[0] ?? null); else cur.value = clone(list.value[0] ?? null) } catch (e) { store.toast(e.message) } try { roles.value = (await api.get('/api/auth/roles')).map(r => r.key) } catch { roles.value = ['admin', 'editor'] } }
const clone = w => w ? JSON.parse(JSON.stringify({ key: w.key, label: w.label ?? {}, start: w.start, roles: w.roles ?? [], families: w.families ?? [], states: w.states.map(s => ({ key: s.key, label: s.label ?? {}, color: s.color ?? 'muted', final: !!s.final, x: s.x ?? null, y: s.y ?? null, count: s.count ?? 0 })), transitions: w.transitions.map(t => ({ key: t.key, label: t.label ?? {}, from: t.from, to: t.to, roles: t.roles ?? [], noteRequired: !!t.noteRequired, effects: t.effects ?? [], escalateAfterDays: t.escalateAfterDays ?? null, escalateRoles: t.escalateRoles ?? [], fromPort: t.fromPort ?? null, toPort: t.toPort ?? null, labelX: t.labelX ?? null, labelY: t.labelY ?? null })) })) : null
function pick(w) { cur.value = clone(w); dirty.value = false }
function touch() { dirty.value = true }
async function save() {
  const w = cur.value; if (!w) return
  try {
    await api.post(`/api/workflows/${encodeURIComponent(w.key)}`, { label: w.label, states: w.states.map(s => ({ key: s.key, label: s.label, color: s.color, final: s.final, x: s.x, y: s.y })), transitions: w.transitions.map(t => ({ key: t.key, label: t.label, from: t.from, to: t.to, roles: t.roles.length ? t.roles : null, noteRequired: t.noteRequired, effects: t.effects.length ? t.effects : null, escalateAfterDays: t.escalateAfterDays ?? null, escalateRoles: t.escalateRoles?.length ? t.escalateRoles : null, fromPort: t.fromPort ?? null, toPort: t.toPort ?? null, labelX: t.labelX ?? null, labelY: t.labelY ?? null })), start: w.start, roles: w.roles.length ? w.roles : null, families: null }, 'PUT')
    const sent = w; dirty.value = false; await load()
    // Kam alles zurück, was gesendet wurde? Ein Server mit altem Bau-Stand kennt Lage, Andockpunkte, Beschriftungslage, Eskalation nicht
    const got = cur.value; const lost = sent.states.some((s, i) => s.x != null && got?.states[i]?.x == null) || sent.transitions.some((t, i) => (t.fromPort && !got?.transitions[i]?.fromPort) || (t.labelX != null && got?.transitions[i]?.labelX == null) || (t.escalateAfterDays != null && got?.transitions[i]?.escalateAfterDays == null))
    if (lost) store.toast('Gespeichert — aber der Server läuft mit einem alten Stand und hat Lage/Andockpunkte/Eskalation verworfen. Server neu starten, dann noch einmal speichern.')
    else store.toast(`Workflow „${w.label?.de || w.key}“ gespeichert`, 'ok')
  } catch (e) { store.toast(e.message) }
}
async function add() {
  const key = await dialog.prompt({ title: 'Neuer Workflow', text: 'Key (a-z, 0-9, _)', placeholder: 'z. B. shop' }); if (!key) return
  cur.value = { key: key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'), label: { de: key, en: key }, start: 'draft', roles: [], families: [], states: [{ key: 'draft', label: { de: 'Entwurf', en: 'Draft' }, color: 'muted', final: false }, { key: 'done', label: { de: 'Fertig', en: 'Done' }, color: 'pos', final: true }], transitions: [{ key: 'finish', label: { de: 'fertig', en: 'finish' }, from: 'draft', to: 'done', roles: [], noteRequired: false, effects: [] }] }
  dirty.value = true
}
async function remove() {
  const w = cur.value; if (!w) return
  if (!await dialog.confirm({ title: `Workflow „${w.label?.de || w.key}“ entfernen?`, text: 'Die Zustände der Knoten darin verfallen (der Verlauf bleibt im Journal).', ok: '🗑 Entfernen', danger: true })) return
  try { await api.del(`/api/workflows/${encodeURIComponent(w.key)}`); cur.value = null; await load() } catch (e) { store.toast(e.message) }
}
function addState() { const w = cur.value; const k = 'state' + (w.states.length + 1); w.states.push({ key: k, label: { de: k, en: k }, color: 'muted', final: false }); touch() }
function delState(i) { const w = cur.value; const k = w.states[i].key; if (w.transitions.some(t => t.from === k || t.to === k)) { store.toast('erst die Übergänge davon/dahin entfernen'); return } w.states.splice(i, 1); touch() }
function addTransition() { const w = cur.value; const k = 'step' + (w.transitions.length + 1); w.transitions.push({ key: k, label: { de: k, en: k }, from: w.states[0]?.key ?? '', to: w.states[1]?.key ?? w.states[0]?.key ?? '', roles: [], noteRequired: false, effects: [], escalateAfterDays: null, escalateRoles: [] }); touch() }
const selState = ref(null), selTrans = ref(null)   // markierte Zeile (Grafik ↔ Tabelle)
const W = 150, H = 46, GRID = 20
// Andockpunkte (Taloan, 21.09.): je Seite 0 · ¼ · ½ · ¾ · 1 — Ecken, Mitten, Viertel; Schlüssel „seite:anteil“
const PORTS = [] ; for (const side of ['top', 'bottom', 'left', 'right']) for (const f of [0, 0.25, 0.5, 0.75, 1]) PORTS.push(`${side}:${f}`)
function portXY(p, key) { const [side, f] = key.split(':'); const a = Number(f); return side === 'top' ? { x: p.x + W * a, y: p.y } : side === 'bottom' ? { x: p.x + W * a, y: p.y + H } : side === 'left' ? { x: p.x, y: p.y + H * a } : { x: p.x + W, y: p.y + H * a } }
// nächster Andockpunkt der Kachel zu einem Punkt
function nearestPort(p, to) { let best = null, bd = Infinity; for (const k of PORTS) { const q = portXY(p, k); const d = Math.hypot(q.x - to.x, q.y - to.y); if (d < bd) { bd = d; best = k } } return best }
const snap = v => Math.round(v / GRID) * GRID
const svgEl = ref(null)
// Lage: gespeichert (x/y) oder Reihe — beim ersten Ziehen bekommt jede Kachel ihre Lage
const posOf = (s, i) => ({ x: s.x ?? 20 + i * (W + 40), y: s.y ?? 70 })
function svgPoint(e) { const m = svgEl.value?.getScreenCTM(); if (!m) return { x: 0, y: 0 }; const p = m.inverse(); return { x: (e.clientX - m.e) / m.a, y: (e.clientY - m.f) / m.d } }
const drag = ref(null)   // { kind: 'move', i, dx, dy } | { kind: 'link', i, x, y }
function stateDown(i, e) {
  selState.value = i; selTrans.value = null
  const w = cur.value; w.states.forEach((s, k) => { const p = posOf(s, k); s.x = p.x; s.y = p.y })   // Lage festhalten, damit die anderen nicht springen
  const p = svgPoint(e); drag.value = { kind: 'move', i, dx: p.x - w.states[i].x, dy: p.y - w.states[i].y }
}
function linkDown(i, e, port = 'right:0.75') { selState.value = i; const q = portXY(posOf(cur.value.states[i], i), port); drag.value = { kind: 'link', i, port, x: q.x, y: q.y, tx: q.x, ty: q.y, snapJ: null, snapPort: null } }
// Einschnappen (Taloan, 21.09.): der nächste Andockpunkt irgendeiner Kachel (ausser der Startkachel des Pfeils), wenn er näher als 24 px ist
function snapTo(pt, exceptI) {
  const w = cur.value; let best = null
  w.states.forEach((s, j) => { if (j === exceptI) return; const p = posOf(s, j); for (const k of PORTS) { const q = portXY(p, k); const d = Math.hypot(q.x - pt.x, q.y - pt.y); if (d < 24 && (!best || d < best.d)) best = { j, port: k, x: q.x, y: q.y, d } } })
  return best
}
// Ende eines markierten Übergangs anfassen und an einen anderen Andockpunkt (auch einer anderen Kachel) ziehen
function endDown(n, end, e) { const a = sketch.value.arrows[n]; const q = end === 'from' ? a.p1 : a.p2; const o = end === 'from' ? a.p2 : a.p1; drag.value = { kind: 'reattach', n, end, x: q.x, y: q.y, tx: q.x, ty: q.y, fixed: { x: o.x, y: o.y }, snapJ: null, snapPort: null } }
function portUp(j, port) {
  const d = drag.value; if (!d) return; drag.value = null
  const w = cur.value
  if (d.kind === 'reattach') { const t = w.transitions[d.n]; if (d.end === 'from') { t.from = w.states[j].key; t.fromPort = port } else { t.to = w.states[j].key; t.toPort = port } touch(); return }
  if (d.kind !== 'link' || d.i === j) return
  const k = 'step' + (w.transitions.length + 1)
  w.transitions.push({ key: k, label: { de: k, en: k }, from: w.states[d.i].key, to: w.states[j].key, roles: [], noteRequired: false, effects: [], escalateAfterDays: null, escalateRoles: [], fromPort: d.port, toPort: port }); selTrans.value = w.transitions.length - 1; touch()
}
function canvasMove(e) {
  const d = drag.value; if (!d) return; const p = svgPoint(e)
  if (d.kind === 'move') { const s = cur.value.states[d.i]; s.x = Math.max(0, snap(p.x - d.dx)); s.y = Math.max(0, snap(p.y - d.dy)); touch() }
  else if (d.kind === 'label') { const tr = cur.value.transitions[d.n]; tr.labelX = Math.round(p.x - d.dx); tr.labelY = Math.round(p.y - d.dy); touch() }
  else {
    const other = d.kind === 'reattach' ? null : d.i
    const s = snapTo(p, other); d.snapJ = s?.j ?? null; d.snapPort = s?.port ?? null; d.tx = s ? s.x : p.x; d.ty = s ? s.y : p.y
  }
}
function stateUp(j, e) {
  // loslassen auf einer Kachel: eingeschnappter Punkt, sonst der nächste zur Maus
  const d = drag.value; if (!d || d.kind === 'move') { drag.value = null; return }
  if (d.snapJ != null) portUp(d.snapJ, d.snapPort); else portUp(j, nearestPort(posOf(cur.value.states[j], j), svgPoint(e)))
}
function canvasUp() { const d = drag.value; if (d && (d.kind === 'link' || d.kind === 'reattach') && d.snapJ != null) { portUp(d.snapJ, d.snapPort); return } drag.value = null }
// Automatisch anordnen (Taloan, 21.09.): Ebenen vom Start aus (längster Vorwärtsweg), Ebenen von links nach rechts, in der Ebene nach dem
// Schwerpunkt der Vorgänger sortiert (weniger Kreuzungen); Rückwege laufen als Bogen unten herum. Andockpunkte und Beschriftungslagen
// werden zurückgesetzt, damit Pfeil und Text wieder von selbst passen.
function autoLayout() {
  const w = cur.value; const keys = w.states.map(s => s.key); const idx = Object.fromEntries(keys.map((k, i) => [k, i]))
  const start = keys.includes(w.start) ? w.start : keys[0]
  const succ = Object.fromEntries(keys.map(k => [k, []])); for (const t of w.transitions) if (t.from !== t.to && idx[t.from] != null && idx[t.to] != null) succ[t.from].push(t.to)
  // Ebene = längster Weg vom Start ohne Rückwege (Tiefensuche, besuchte Knoten auf dem Pfad nicht erneut)
  const layer = Object.fromEntries(keys.map(k => [k, -1])); layer[start] = 0
  const visit = (k, path) => { for (const n of succ[k]) { if (path.has(n)) continue; if (layer[k] + 1 > layer[n]) { layer[n] = layer[k] + 1; const p2 = new Set(path); p2.add(n); visit(n, p2) } } }
  visit(start, new Set([start]))
  let next = Math.max(0, ...Object.values(layer)) + 1; for (const k of keys) if (layer[k] < 0) layer[k] = next++   // unerreichbare: rechts dahinter
  const cols = {}; for (const k of keys) (cols[layer[k]] ??= []).push(k)
  const pred = Object.fromEntries(keys.map(k => [k, []])); for (const t of w.transitions) if (layer[t.from] < layer[t.to]) pred[t.to].push(t.from)
  const rowOf = {}
  for (const l of Object.keys(cols).map(Number).sort((a, b) => a - b)) {
    const col = cols[l]
    if (l > 0) col.sort((a, b) => { const bc = k => pred[k].length ? pred[k].reduce((s, q) => s + (rowOf[q] ?? 0), 0) / pred[k].length : 0; return bc(a) - bc(b) })
    col.forEach((k, r) => { rowOf[k] = r })
  }
  const maxRows = Math.max(...Object.values(cols).map(c => c.length))
  for (const s of w.states) { const l = layer[s.key], r = rowOf[s.key], n = cols[l].length; s.x = 40 + l * (W + 80); s.y = snap(60 + (r + (maxRows - n) / 2) * 110) }
  for (const t of w.transitions) { t.fromPort = null; t.toPort = null; t.labelX = null; t.labelY = null }
  touch()
}
function labelDown(n, e) { selTrans.value = n; selState.value = null; const a = sketch.value.arrows[n]; const p = svgPoint(e); drag.value = { kind: 'label', n, dx: p.x - a.lx, dy: p.y - a.ly } }
async function editLabel(n) { const t = cur.value.transitions[n]; const v = await dialog.prompt({ title: 'Beschriftung des Übergangs', value: t.label?.de ?? '', ok: '✎ OK' }); if (v == null) return; t.label = { ...(t.label ?? {}), de: v.trim() }; touch() }
async function editState(i) { const s = cur.value.states[i]; const v = await dialog.prompt({ title: 'Bezeichnung des Zustands', value: s.label?.de ?? '', ok: '✎ OK' }); if (v == null) return; s.label = { ...(s.label ?? {}), de: v.trim() }; touch() }
function addStateAt() { const w = cur.value; const k = 'state' + (w.states.length + 1); const last = w.states.length ? posOf(w.states[w.states.length - 1], w.states.length - 1) : { x: -W - 40, y: 70 }; w.states.push({ key: k, label: { de: k, en: k }, color: 'muted', final: false, x: last.x + W + 40, y: last.y, count: 0 }); selState.value = w.states.length - 1; touch() }
function delSelected() {
  if (selTrans.value != null) { cur.value.transitions.splice(selTrans.value, 1); selTrans.value = null; touch(); return }
  if (selState.value != null) { const n = cur.value.states.length; delState(selState.value); if (cur.value.states.length < n) selState.value = null }
}
function toggleIn(arr, v) { const i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); touch() }
const stateLabel = k => cur.value?.states.find(s => s.key === k)?.label?.de || k
const color = c => ({ pos: 'var(--pos)', neg: 'var(--neg)', warn: 'var(--warn)', accent: 'var(--accent)' })[c] ?? 'var(--muted)'
// Skizze: Kacheln an ihrer Lage, Pfeile von Rand zu Rand (leicht gebogen, damit Hin und Zurück nicht aufeinanderliegen), Schleife oben
const sketch = computed(() => {
  const w = cur.value; if (!w) return null
  const pos = w.states.map((s, i) => posOf(s, i))
  const idx = Object.fromEntries(w.states.map((s, i) => [s.key, i]))
  const edge = (c, to) => {   // Schnittpunkt der Strecke Mitte→to mit dem Kachelrand
    const dx = to.x - c.x, dy = to.y - c.y; if (!dx && !dy) return c
    const sx = (W / 2) / Math.abs(dx || 1e-9), sy = (H / 2) / Math.abs(dy || 1e-9); const k = Math.min(sx, sy)
    return { x: c.x + dx * k, y: c.y + dy * k }
  }
  const d = drag.value
  const curve = (t, p1, p2) => {
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1
    const nx = -(p2.y - p1.y) / len, ny = (p2.x - p1.x) / len, bend = Math.min(40, 12 + len * 0.12)
    const cx = mx + nx * bend, cy = my + ny * bend
    const bx = 0.25 * p1.x + 0.5 * cx + 0.25 * p2.x, by = 0.25 * p1.y + 0.5 * cy + 0.25 * p2.y
    return { t, p1, p2, d: `M${p1.x},${p1.y} Q${cx},${cy} ${p2.x},${p2.y}`, lx: t.labelX ?? bx, ly: t.labelY ?? by + 4, anchor: 'middle' }
  }
  const arrows = w.transitions.map((t, n) => {
    if (d?.kind === 'reattach' && d.n === n) {   // das angefasste Ende hängt an der Maus (bzw. am eingeschnappten Punkt)
      return d.end === 'from' ? curve(t, { x: d.tx, y: d.ty }, d.fixed) : curve(t, d.fixed, { x: d.tx, y: d.ty })
    }
    const a = pos[idx[t.from] ?? 0], b = pos[idx[t.to] ?? 0]
    const ca = { x: a.x + W / 2, y: a.y + H / 2 }, cb = { x: b.x + W / 2, y: b.y + H / 2 }
    if (t.from === t.to) return { t, p1: { x: ca.x - 20, y: a.y }, p2: { x: ca.x + 20, y: a.y }, d: `M${ca.x - 20},${a.y} C${ca.x - 40},${a.y - 45} ${ca.x + 40},${a.y - 45} ${ca.x + 20},${a.y}`, lx: t.labelX ?? ca.x, ly: t.labelY ?? a.y - 36 }
    let p1, p2
    if (t.fromPort && t.toPort) { p1 = portXY(a, t.fromPort); p2 = portXY(b, t.toPort) }
    else { p1 = t.fromPort ? portXY(a, t.fromPort) : edge(ca, cb); p2 = t.toPort ? portXY(b, t.toPort) : edge(cb, ca); if (!t.fromPort) p1 = portXY(a, nearestPort(a, p2)); if (!t.toPort) p2 = portXY(b, nearestPort(b, p1)) }
    return curve(t, p1, p2)
  })
  // neuer Pfeil beim Ziehen vom ●
  if (d?.kind === 'link') arrows.push({ ...curve({ key: '__new', label: {}, roles: [] }, { x: d.x, y: d.y }, { x: d.tx, y: d.ty }), temp: true })
  const width = snap(Math.max(600, ...pos.map(p => p.x + W + 60))), height = snap(Math.max(240, ...pos.map(p => p.y + H + 60)))
  return { W, H, pos, width, height, arrows }
})
onMounted(load)
</script>

<template>
  <div class="section">
    <h2>⚑ Workflows <span class="muted">· Bearbeitungszustand über dem Status — Zustände, Übergänge mit Rolle, Notiz-Pflicht und Wirkung (Freigabe, Status)</span></h2>
    <div class="row" style="gap:6px;align-items:center;margin-bottom:8px">
      <span v-for="w in list" :key="w.key" class="view-chip" :class="{ on: cur?.key === w.key }" @click="pick(w)" :title="w.key">{{ w.label?.de || w.key }}</span>
      <button class="x" @click="add" title="neuer Workflow">+</button>
      <span class="grow" />
      <button v-if="cur" class="primary" :disabled="!dirty" @click="save">💾 Speichern</button>
      <button v-if="cur" class="x" @click="remove" title="Workflow entfernen">🗑</button>
    </div>
    <template v-if="cur">
      <div class="row" style="gap:12px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
        <label>Bezeichnung <input v-model="cur.label.de" type="text" style="width:160px" @input="touch" /></label>
        <label>Start <select v-model="cur.start" @change="touch"><option v-for="s in cur.states" :key="s.key" :value="s.key">{{ s.label?.de || s.key }}</option></select></label>
        <span class="muted">gilt für</span><label v-for="[k, l] in ROLES" :key="k" :title="k"><input type="checkbox" :checked="!cur.roles.length || cur.roles.includes(k)" @change="toggleIn(cur.roles, k)" /> {{ l }}</label>
        <span class="muted" style="font-size:11px">(nichts angehakt = alle)</span>
      </div>
      <div v-if="sketch" class="muted" style="font-size:12px;margin-bottom:4px">Kachel ziehen = verschieben · vom ● auf eine andere Kachel ziehen = Übergang (schnappt am Rand ein) · Pfeil markieren, Ende anfassen = umhängen · Beschriftung ziehen, Doppelklick = bearbeiten · Entf löscht <button class="x" style="margin-left:8px" @click="addStateAt">+ Zustand</button> <button class="x" @click="autoLayout" title="Ebenen vom Start aus, links nach rechts; Rückwege unten herum; Andockpunkte und Beschriftungen zurück auf Automatik">⟲ anordnen</button></div>
      <svg v-if="sketch" ref="svgEl" tabindex="0" :viewBox="`0 0 ${sketch.width} ${sketch.height}`" :style="`width:100%;max-width:${sketch.width}px;height:auto;background:var(--bg);border:1px solid var(--line);border-radius:6px;margin-bottom:8px;outline:none`" font-size="11" font-family="system-ui"
        @mousemove="canvasMove" @mouseup="canvasUp" @mouseleave="canvasUp" @keydown.delete.prevent="delSelected" @keydown.backspace.prevent="delSelected" @mousedown.self="selState = null; selTrans = null">
        <defs><pattern id="wf-grid" :width="GRID" :height="GRID" patternUnits="userSpaceOnUse"><path :d="`M ${GRID} 0 L 0 0 0 ${GRID}`" fill="none" stroke="var(--line)" stroke-width="0.5" opacity="0.6" /></pattern><marker id="wf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" /></marker></defs>
        <rect x="0" y="0" :width="sketch.width" :height="sketch.height" fill="url(#wf-grid)" @mousedown="selState = null; selTrans = null" />
        <g v-for="(a, n) in sketch.arrows" :key="a.t.key" style="cursor:pointer" @click="selTrans = n; selState = null"><path :d="a.d" fill="none" :stroke="selTrans === n || a.temp ? 'var(--accent)' : 'var(--muted)'" :stroke-width="selTrans === n || a.temp ? 2 : 1.2" marker-end="url(#wf-arrow)" :stroke-dasharray="a.t.noteRequired ? '4 3' : ''" /><path :d="a.d" fill="none" stroke="transparent" stroke-width="12" /><text :x="a.lx" :y="a.ly" :text-anchor="a.anchor ?? 'middle'" :fill="selTrans === n ? 'var(--accent)' : 'var(--text)'" stroke="var(--bg)" stroke-width="4" paint-order="stroke" stroke-linejoin="round" style="cursor:move;user-select:none" @mousedown.stop.prevent="labelDown(n, $event)" @dblclick.stop="editLabel(n)"><title>ziehen = verschieben · Doppelklick = bearbeiten</title>{{ a.t.label?.de || a.t.key }}<tspan v-if="a.t.roles.length" fill="var(--muted)"> · {{ a.t.roles.join('/') }}</tspan><tspan v-if="a.t.escalateAfterDays != null" fill="var(--warn)"> ⏰{{ a.t.escalateAfterDays }}d</tspan></text></g>
        <g v-if="selTrans != null && sketch.arrows[selTrans]"><circle :cx="sketch.arrows[selTrans].p1.x" :cy="sketch.arrows[selTrans].p1.y" r="5" fill="var(--accent)" style="cursor:move" @mousedown.stop.prevent="endDown(selTrans, 'from', $event)"><title>Anfang umhängen</title></circle><circle :cx="sketch.arrows[selTrans].p2.x" :cy="sketch.arrows[selTrans].p2.y" r="5" fill="var(--accent)" style="cursor:move" @mousedown.stop.prevent="endDown(selTrans, 'to', $event)"><title>Ende umhängen</title></circle></g>
        <g v-for="(s, i) in cur.states" :key="s.key" :style="drag?.kind === 'move' ? 'cursor:grabbing' : 'cursor:grab'" @mousedown.prevent.stop="stateDown(i, $event)" @mouseup.stop="stateUp(i, $event)" @dblclick="editState(i)">
          <rect :x="sketch.pos[i].x" :y="sketch.pos[i].y" :width="W" :height="H" rx="6" :fill="selState === i ? 'var(--accent-soft)' : 'var(--pane)'" :stroke="color(s.color)" :stroke-width="s.key === cur.start ? 2.5 : 1.5" />
          <text :x="sketch.pos[i].x + W / 2" :y="sketch.pos[i].y + 20" text-anchor="middle" fill="var(--text)" font-weight="600">{{ s.label?.de || s.key }}</text>
          <text :x="sketch.pos[i].x + W / 2" :y="sketch.pos[i].y + 36" text-anchor="middle" fill="var(--muted)">{{ s.count ?? 0 }} Knoten{{ s.final ? ' · Ende' : '' }}{{ s.key === cur.start ? ' · Start' : '' }}</text>
          <circle v-if="s.key === cur.start" :cx="sketch.pos[i].x - 12" :cy="sketch.pos[i].y + H / 2" r="5" fill="var(--text)"><title>Start</title></circle>
          <g v-if="s.final"><circle :cx="sketch.pos[i].x + W + 12" :cy="sketch.pos[i].y + H / 2" r="6" fill="none" stroke="var(--text)" stroke-width="1.5" /><circle :cx="sketch.pos[i].x + W + 12" :cy="sketch.pos[i].y + H / 2" r="3" fill="var(--text)" /></g>
          <circle :cx="sketch.pos[i].x + W" :cy="sketch.pos[i].y + H - 8" r="5" fill="var(--accent)" style="cursor:crosshair" @mousedown.stop.prevent="linkDown(i, $event)"><title>von hier auf eine andere Kachel ziehen = neuer Übergang — der Pfeil schnappt am nächsten Andockpunkt ein</title></circle>
          <circle v-if="drag?.snapJ === i" :cx="drag.tx" :cy="drag.ty" r="5" fill="none" stroke="var(--accent)" stroke-width="2" />
        </g>
      </svg>
      <div class="row" style="gap:32px;align-items:flex-start;flex-wrap:wrap;margin-top:12px">
        <table class="grid form" style="width:auto;margin-bottom:16px"><thead><tr><th colspan="6">Zustände <button class="x" @click="addState" title="Zustand hinzufügen">+</button></th></tr><tr><th>Key</th><th>Bezeichnung</th><th>Farbe</th><th title="Ende des Wegs">Ende</th><th>Knoten</th><th></th></tr></thead><tbody>
          <tr v-for="(s, i) in cur.states" :key="i" :class="{ selected: selState === i }" @click="selState = i; selTrans = null"><td><input v-model="s.key" type="text" class="mono" style="width:100px" @input="touch" /></td><td><input v-model="s.label.de" type="text" style="width:140px" @input="touch" /></td>
            <td><select v-model="s.color" @change="touch"><option v-for="[c, l] in COLORS" :key="c" :value="c">{{ l }}</option></select></td><td><input type="checkbox" v-model="s.final" @change="touch" /></td><td class="muted">{{ s.count }}</td><td><button class="x" @click="delState(i)">×</button></td></tr>
        </tbody></table>
        <table class="grid form" style="width:auto"><thead><tr><th colspan="9">Übergänge <button class="x" @click="addTransition" title="Übergang hinzufügen">+</button></th></tr><tr><th>Key</th><th>Bezeichnung</th><th>von</th><th>nach</th><th title="wer darf; nichts = jede Rolle mit Schreibrecht (admin immer)">Rollen</th><th title="Korrekturschleife: der Schritt braucht eine Notiz">Notiz</th><th title="Eskalation: steht der Zustand so viele Tage, dürfen auch diese Rollen (keine = jede Rolle mit Schreibrecht) — z. B. alle Redakteure im Urlaub">⏰ nach Tagen an</th><th title="was der Schritt auslöst">Wirkung</th><th></th></tr></thead><tbody>
          <tr v-for="(t, i) in cur.transitions" :key="i" :class="{ selected: selTrans === i }" @click="selTrans = i; selState = null"><td><input v-model="t.key" type="text" class="mono" style="width:90px" @input="touch" /></td><td><input v-model="t.label.de" type="text" style="width:150px" @input="touch" /></td>
            <td><select v-model="t.from" @change="touch"><option v-for="s in cur.states" :key="s.key" :value="s.key">{{ s.label?.de || s.key }}</option></select></td>
            <td><select v-model="t.to" @change="touch"><option v-for="s in cur.states" :key="s.key" :value="s.key">{{ s.label?.de || s.key }}</option></select></td>
            <td><label v-for="r in roles" :key="r" style="margin-right:6px"><input type="checkbox" :checked="t.roles.includes(r)" @change="toggleIn(t.roles, r)" /> {{ r }}</label></td>
            <td><input type="checkbox" v-model="t.noteRequired" @change="touch" /></td>
            <td><input type="number" min="0" style="width:50px" :value="t.escalateAfterDays ?? ''" @input="t.escalateAfterDays = $event.target.value === '' ? null : Number($event.target.value); touch()" placeholder="—" /> <label v-for="r in roles" :key="r" style="margin-right:6px" :class="{ muted: t.escalateAfterDays == null }"><input type="checkbox" :disabled="t.escalateAfterDays == null" :checked="(t.escalateRoles ?? []).includes(r)" @change="t.escalateRoles ??= []; toggleIn(t.escalateRoles, r)" /> {{ r }}</label></td>
            <td><select :value="''" @change="toggleIn(t.effects, $event.target.value); $event.target.value = ''"><option value="">+ …</option><option v-for="[e, l] in EFFECTS" :key="e" :value="e">{{ l }}</option></select><span v-for="e in t.effects" :key="e" class="chip" style="margin-left:3px">{{ e }} <button @click="toggleIn(t.effects, e)">×</button></span></td>
            <td><button class="x" @click="cur.transitions.splice(i, 1); touch()">×</button></td></tr>
        </tbody></table>
      </div>
    </template>
    <div v-else class="muted">Noch kein Workflow — + legt einen an.</div>
  </div>
</template>

<style scoped>
.form td { white-space: nowrap; }
.x { border: 0; background: none; color: var(--muted); padding: 0 4px; }
.x:hover { color: var(--text); }
</style>
