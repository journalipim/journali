<script setup>
// Einstellungen → Workflows (27, Taloan 21.09.2026: „Workflow-Designer mit Freigaben, Korrekturschleifen“): je Workflow die Zustände
// (Kacheln in der Skizze), die Übergänge (Pfeile: von → nach, Rolle, Notiz-Pflicht, Wirkungen) und wofür er gilt. Alles im Journal
// (WorkflowDefined); Speichern schreibt die ganze Definition. Die Grafik ist die Arbeitsfläche (Taloan, 21.09.: „verschieben und anordnen“):
// Kacheln frei ziehen (Lage wird gespeichert), vom ● auf eine andere Kachel ziehen = Übergang, Klick markiert die Zeile, Entf löscht.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { menu } from '../menu.js'

const list = ref([]); const cur = ref(null); const roles = ref([]); const dirty = ref(false)
const COLORS = [['muted', 'grau'], ['warn', 'gelb'], ['neg', 'rot'], ['accent', 'blau'], ['pos', 'grün']]
const ROLES = [['group', '▣ Gruppe'], ['product', '▦ Produkt'], ['variant', '◆ Variante']]
const EFFECTS = computed(() => { const m = store.model; const out = []; out.push(['release:*', 'Freigabe alle Kanäle'], ['revoke:*', 'Freigabe alle Kanäle zurück']); for (const c of m?.channels ?? []) { out.push([`release:${c.key}`, `Freigabe ${c.key}`], [`revoke:${c.key}`, `Freigabe ${c.key} zurück`]) } for (const s of m?.statuses ?? []) out.push([`status:${s.key}`, `Status ${store.statusLabel(s.key)}`]); return out })
async function load() { try { list.value = await api.get('/api/workflows'); if (cur.value) cur.value = clone(list.value.find(w => w.key === cur.value.key) ?? list.value[0] ?? null); else cur.value = clone(list.value[0] ?? null) } catch (e) { store.toast(e.message) } try { roles.value = (await api.get('/api/auth/roles')).map(r => r.key) } catch { roles.value = ['admin', 'editor'] } }
const clone = w => w ? JSON.parse(JSON.stringify({ key: w.key, label: w.label ?? {}, start: w.start, roles: w.roles ?? [], families: w.families ?? [], states: w.states.map(s => ({ key: s.key, label: s.label ?? {}, color: s.color ?? 'muted', final: !!s.final, x: s.x ?? null, y: s.y ?? null, count: s.count ?? 0 })), transitions: w.transitions.map(t => ({ key: t.key, label: t.label ?? {}, from: t.from, to: t.to, roles: t.roles ?? [], noteRequired: !!t.noteRequired, effects: t.effects ?? [], escalateAfterDays: t.escalateAfterDays ?? null, escalateRoles: t.escalateRoles ?? [], fromPort: t.fromPort ?? null, toPort: t.toPort ?? null, labelX: t.labelX ?? null, labelY: t.labelY ?? null, route: null })) })) : null
function pick(w) { cur.value = clone(w); dirty.value = false }
function touch() { dirty.value = true }
async function save() {
  const w = cur.value; if (!w) return
  try {
    await api.post(`/api/workflows/${encodeURIComponent(w.key)}`, { label: w.label, states: w.states.map(s => ({ key: s.key, label: s.label, color: s.color, final: s.final, x: s.x, y: s.y })), transitions: w.transitions.map(t => ({ key: t.key, label: t.label, from: t.from, to: t.to, roles: t.roles.length ? t.roles : null, noteRequired: t.noteRequired, effects: t.effects.length ? t.effects : null, escalateAfterDays: t.escalateAfterDays ?? null, escalateRoles: t.escalateRoles?.length ? t.escalateRoles : null, fromPort: t.fromPort ?? null, toPort: t.toPort ?? null, labelX: t.labelX ?? null, labelY: t.labelY ?? null, route: null })), start: w.start, roles: w.roles.length ? w.roles : null, families: null }, 'PUT')
    const sent = w; dirty.value = false; await load()
    // Kam alles zurück, was gesendet wurde? Ein Server mit altem Bau-Stand kennt Lage, Andockpunkte, Beschriftungslage, Eskalation nicht
    const got = cur.value; const lost = sent.states.some((s, i) => s.x != null && got?.states[i]?.x == null) || sent.transitions.some((t, i) => (t.fromPort && !got?.transitions[i]?.fromPort) || (t.labelX != null && got?.transitions[i]?.labelX == null) || (t.escalateAfterDays != null && got?.transitions[i]?.escalateAfterDays == null))
    if (lost) store.toast('Gespeichert — aber der Server läuft mit einem alten Stand und hat Lage/Andockpunkte/Eskalation verworfen. Server neu starten, dann noch einmal speichern.')
    else store.toast(`Workflow „${w.label?.de || w.key}“ gespeichert`, 'ok')
  } catch (e) { store.toast(e.message) }
}
async function add() {
  const key = await dialog.prompt({ title: 'Workflow anlegen', text: 'Key (a-z, 0-9, _)', placeholder: 'z. B. shop', ok: '+ Anlegen' }); if (!key) return
  cur.value = { key: key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'), label: { de: key, en: key }, start: 'draft', roles: [], families: [], states: [{ key: 'draft', label: { de: 'Entwurf', en: 'Draft' }, color: 'muted', final: false }, { key: 'done', label: { de: 'Fertig', en: 'Done' }, color: 'pos', final: true }], transitions: [{ key: 'finish', label: { de: 'fertig', en: 'finish' }, from: 'draft', to: 'done', roles: [], noteRequired: false, effects: [] }] }
  dirty.value = true
}
async function remove() {
  const w = cur.value; if (!w) return
  if (!await dialog.confirm({ title: `Workflow „${w.label?.de || w.key}“ entfernen?`, text: 'Zustände der Knoten darin verfallen (Verlauf bleibt im Journal).', ok: '🗑 Entfernen', danger: true })) return
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
const EDGE = 10
function nearEdge(i, p) { const b = posOf(cur.value.states[i], i); const dx = Math.min(p.x - b.x, b.x + W - p.x), dy = Math.min(p.y - b.y, b.y + H - p.y); return Math.min(dx, dy) <= EDGE }
const hoverEdge = ref(null)   // Kachel, an deren Rand der Zeiger steht
function stateHover(i, e) { hoverEdge.value = nearEdge(i, svgPoint(e)) ? i : null }
function stateDown(i, e) {
  selState.value = i; selTrans.value = null
  const w = cur.value; w.states.forEach((s, k) => { const p = posOf(s, k); s.x = p.x; s.y = p.y })   // Lage festhalten, damit die anderen nicht springen
  const p = svgPoint(e)
  if (nearEdge(i, p)) { linkDown(i, e, nearestPort(posOf(w.states[i], i), p)); return }   // vom Rand: neuer Pfeil ab dem nächsten Andockpunkt
  drag.value = { kind: 'move', i, dx: p.x - w.states[i].x, dy: p.y - w.states[i].y }
}
function linkDown(i, e, port = 'right:0.75') { selState.value = i; const q = portXY(posOf(cur.value.states[i], i), port); drag.value = { kind: 'link', i, port, x: q.x, y: q.y, tx: q.x, ty: q.y, snapJ: null, snapPort: null } }
// Einschnappen (Taloan, 21.09.): der nächste Andockpunkt irgendeiner Kachel (ausser der Startkachel des Pfeils), wenn er näher als 24 px ist
function snapTo(pt, exceptI) {
  const w = cur.value; let best = null
  w.states.forEach((s, j) => { if (j === exceptI) return; const p = posOf(s, j); for (const k of PORTS) { const q = portXY(p, k); const d = Math.hypot(q.x - pt.x, q.y - pt.y); if (d < 24 && (!best || d < best.d)) best = { j, port: k, x: q.x, y: q.y, d } } })
  return best
}
// Ende eines markierten Übergangs anfassen und an einen anderen Andockpunkt (auch einer anderen Kachel) ziehen
function endDown(n, end, e) { const a = sketch.value.arrows[n]; const q = end === 'from' ? a.p1 : a.p2; const o = end === 'from' ? a.p2 : a.p1; drag.value = { kind: 'reattach', n, end, x: q.x, y: q.y, tx: q.x, ty: q.y, fixed: { x: o.x, y: o.y }, label: { x: a.lx, y: a.ly }, snapJ: null, snapPort: null } }
function portUp(j, port) {
  const d = drag.value; if (!d) return; drag.value = null
  const w = cur.value
  if (d.kind === 'reattach') {
    const t = w.transitions[d.n]; const idx = Object.fromEntries(w.states.map((s, i) => [s.key, i]))
    t.labelX = null; t.labelY = null
    if (d.end === 'from') { if (!t.toPort) t.toPort = nearestPort(posOf(w.states[idx[t.to]], idx[t.to]), d.fixed); t.from = w.states[j].key; t.fromPort = port }
    else { if (!t.fromPort) t.fromPort = nearestPort(posOf(w.states[idx[t.from]], idx[t.from]), d.fixed); t.to = w.states[j].key; t.toPort = port }
    touch(); return
  }
  if (d.kind !== 'link' || d.i === j) return
  const k = 'step' + (w.transitions.length + 1)
  w.transitions.push({ key: k, label: { de: k, en: k }, from: w.states[d.i].key, to: w.states[j].key, roles: [], noteRequired: false, effects: [], escalateAfterDays: null, escalateRoles: [], fromPort: d.port, toPort: port }); selTrans.value = w.transitions.length - 1; touch()
}
function canvasMove(e) {
  const d = drag.value; if (!d) return; const p = svgPoint(e)
  if (d.kind === 'move') {
    const s = cur.value.states[d.i]; const nx = Math.max(0, snap(p.x - d.dx)), ny = Math.max(0, snap(p.y - d.dy)); const ddx = nx - s.x, ddy = ny - s.y
    if (!ddx && !ddy) return
    s.x = nx; s.y = ny
    for (const tr of cur.value.transitions) if (tr.labelX != null && (tr.from === s.key || tr.to === s.key)) { const f = tr.from === s.key && tr.to === s.key ? 1 : 0.5; tr.labelX = Math.round(tr.labelX + ddx * f); tr.labelY = Math.round(tr.labelY + ddy * f) }   // von Hand gesetzte Beschriftung geht zur Hälfte mit
    touch()
  }
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
function arrowMenu(e, n) {
  selTrans.value = n; selState.value = null; const t = cur.value.transitions[n]
  menu.open(e, [
    { label: 'Beschriftung ändern …', icon: '✎', action: () => editLabel(n) },
    { label: 'Beschriftung auf die Linie setzen', icon: '↺', disabled: t.labelX == null, action: () => { t.labelX = null; t.labelY = null; touch() } },
    { label: 'Andockpunkte automatisch wählen', icon: '↺', disabled: !t.fromPort && !t.toPort, action: () => { t.fromPort = null; t.toPort = null; touch() } },
    { sep: true },
    { label: 'Übergang entfernen', icon: '✕', danger: true, action: () => { cur.value.transitions.splice(n, 1); selTrans.value = null; touch() } },
  ])
}
function stateMenu(e, i) {
  selState.value = i; selTrans.value = null; const s = cur.value.states[i]
  menu.open(e, [
    { label: 'Umbenennen …', icon: '✎', action: () => editState(i) },
    { label: 'Als Start setzen', icon: '●', disabled: cur.value.start === s.key, action: () => { cur.value.start = s.key; touch() } },
    { label: s.final ? 'Ende aufheben' : 'Als Ende setzen', icon: '◎', action: () => { s.final = !s.final; touch() } },
    { sep: true },
    { label: 'Zustand entfernen', icon: '✕', danger: true, hint: 'nur ohne Übergänge davon/dahin', action: () => delState(i) },
  ])
}
function canvasUp() { const d = drag.value; if (d && (d.kind === 'link' || d.kind === 'reattach') && d.snapJ != null) { portUp(d.snapJ, d.snapPort); return } drag.value = null }
// Kräfte-Layout (Taloan, 21.09.: „sowas kann der Algo nicht?“ — die symmetrische Form kommt aus einem Federmodell, nicht aus Ebenen):
// Kanten sind Federn mit Wunschlänge, Kacheln stossen sich ab, der Start zieht nach links, die Enden nach rechts; 400 Schritte, dann Raster.
function forceLayout() {
  const w = cur.value; const n = w.states.length; if (!n) return
  const L = 240, K = 90000
  const pos = w.states.map((s, i) => ({ x: (s.x ?? 40 + i * (W + 40)) + W / 2 + (Math.random() - 0.5), y: (s.y ?? 70) + H / 2 + (Math.random() - 0.5) * 60 }))
  const idx = Object.fromEntries(w.states.map((s, i) => [s.key, i]))
  const edges = w.transitions.filter(t => t.from !== t.to && idx[t.from] != null && idx[t.to] != null).map(t => [idx[t.from], idx[t.to]])
  const startI = idx[w.start] ?? 0, finals = w.states.map((s, i) => s.final ? i : -1).filter(i => i >= 0)
  for (let step = 0; step < 400; step++) {
    const temp = 12 * (1 - step / 400) + 0.5
    const f = pos.map(() => ({ x: 0, y: 0 }))
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {   // Abstossung
      const dx = pos[j].x - pos[i].x, dy = pos[j].y - pos[i].y; const d2 = Math.max(400, dx * dx + dy * dy); const d = Math.sqrt(d2); const r = K / d2
      f[i].x -= r * dx / d; f[i].y -= r * dy / d; f[j].x += r * dx / d; f[j].y += r * dy / d
    }
    for (const [a, b] of edges) {   // Federn
      const dx = pos[b].x - pos[a].x, dy = pos[b].y - pos[a].y; const d = Math.max(1, Math.hypot(dx, dy)); const s = (d - L) * 0.05
      f[a].x += s * dx / d; f[a].y += s * dy / d; f[b].x -= s * dx / d; f[b].y -= s * dy / d
    }
    const cx = pos.reduce((k, p) => k + p.x, 0) / n, cy = pos.reduce((k, p) => k + p.y, 0) / n
    for (let i = 0; i < n; i++) { f[i].x -= (pos[i].x - cx) * 0.01; f[i].y -= (pos[i].y - cy) * 0.02 }   // leichte Mitte, flacher als hoch
    f[startI].x -= 6; for (const i of finals) f[i].x += 6                                                  // Start links, Ende rechts
    for (let i = 0; i < n; i++) { const m = Math.hypot(f[i].x, f[i].y) || 1; const k = Math.min(m, temp) / m; pos[i].x += f[i].x * k; pos[i].y += f[i].y * k }
  }
  const minX = Math.min(...pos.map(p => p.x)) - W / 2 - 40, minY = Math.min(...pos.map(p => p.y)) - H / 2 - 40
  w.states.forEach((s, i) => { s.x = snap(pos[i].x - W / 2 - minX); s.y = snap(pos[i].y - H / 2 - minY) })
  for (const t of w.transitions) { t.labelX = null; t.labelY = null }   // Andockpunkte bleiben, wie von Hand gesetzt; Beschriftungen hingen an der alten Lage
  touch()
}
function labelDown(n, e) { selTrans.value = n; selState.value = null; const a = sketch.value.arrows[n]; const p = svgPoint(e); drag.value = { kind: 'label', n, dx: p.x - a.lx, dy: p.y - a.ly } }
async function editLabel(n) { const t = cur.value.transitions[n]; const v = await dialog.prompt({ title: 'Beschriftung ändern', value: t.label?.de ?? '', ok: '✎ Übernehmen' }); if (v == null) return; t.label = { ...(t.label ?? {}), de: v.trim() }; touch() }
async function editState(i) { const s = cur.value.states[i]; const v = await dialog.prompt({ title: 'Zustand umbenennen', value: s.label?.de ?? '', ok: '✎ Übernehmen' }); if (v == null) return; s.label = { ...(s.label ?? {}), de: v.trim() }; touch() }
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
  const d = drag.value
  const twinOf = t => w.transitions.find(o => o !== t && o.from === t.to && o.to === t.from)   // Gegenpfeil zwischen denselben Kacheln
  // Seiten und Punkte aus der Lage: a → b; pair: -1 / 0 / +1 (untere / einzelne / obere Parallele)
  const autoPorts = (a, b, pair) => {
    const dx = (b.x + W / 2) - (a.x + W / 2), dy = (b.y + H / 2) - (a.y + H / 2)
    const horiz = Math.abs(dx) * H >= Math.abs(dy) * W * 0.9   // Verhältnis der Kachelmasse: erst wenn es deutlich steiler ist, oben/unten
    const f = 0.5 - pair * 0.25
    if (horiz) return dx >= 0 ? [`right:${f}`, `left:${f}`] : [`left:${f}`, `right:${f}`]
    return dy >= 0 ? [`bottom:${f}`, `top:${f}`] : [`top:${f}`, `bottom:${f}`]
  }
  const curve = (t, p1, p2, pairSide = 0) => {
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1
    const nx = -(p2.y - p1.y) / len, ny = (p2.x - p1.x) / len
    // Beschriftung neben die Linie: bei Parallelen nach aussen (vom Partner weg), sonst zur linken Seite der Richtung
    const side = pairSide || 1
    const off = 9 * side
    const steep = Math.abs(nx) > 0.6
    return { t, p1, p2, d: `M${p1.x},${p1.y} L${p2.x},${p2.y}`,
      lx: t.labelX ?? mx + nx * off, ly: t.labelY ?? my + ny * off + (ny * side > 0 ? 10 : -3), anchor: t.labelX != null ? 'middle' : steep ? (nx * side > 0 ? 'start' : 'end') : 'middle' }
  }
  const arrows = w.transitions.map((t, n) => {
    if (d?.kind === 'reattach' && d.n === n) {   // das angefasste Ende hängt an der Maus (bzw. am eingeschnappten Punkt)
      const c = d.end === 'from' ? curve(t, { x: d.tx, y: d.ty }, d.fixed) : curve(t, d.fixed, { x: d.tx, y: d.ty })
      return { ...c, lx: d.label.x, ly: d.label.y }   // Beschriftung bleibt, wo sie war
    }
    const a = pos[idx[t.from] ?? 0], b = pos[idx[t.to] ?? 0]
    const ca = { x: a.x + W / 2, y: a.y + H / 2 }
    if (t.from === t.to) return { t, p1: { x: ca.x - 20, y: a.y }, p2: { x: ca.x + 20, y: a.y }, d: `M${ca.x - 20},${a.y} C${ca.x - 40},${a.y - 45} ${ca.x + 40},${a.y - 45} ${ca.x + 20},${a.y}`, lx: t.labelX ?? ca.x, ly: t.labelY ?? a.y - 36 }
    const tw = twinOf(t); const pair = tw ? ((idx[t.from] < idx[t.to]) ? 1 : -1) : 0   // welche der beiden Parallelen
    const [fp, tp] = autoPorts(a, b, pair)
    const p1 = portXY(a, t.fromPort ?? fp), p2 = portXY(b, t.toPort ?? tp)
    return curve(t, p1, p2, pair)
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
      <div v-if="sketch" class="row" style="gap:6px;align-items:center;margin-bottom:6px">
        <button @click="addStateAt" title="Zustand anlegen">+ Zustand</button>
        <button @click="forceLayout" title="Zustände automatisch anordnen (Andockpunkte bleiben)">⟲ Anordnen</button>
        <button v-if="selState != null || selTrans != null" class="x" @click="delSelected" title="Markiertes löschen (auch Entf)">✕</button>
        <span class="grow" />
        <span class="x" style="cursor:help" title="Kachel von innen ziehen = verschieben · vom Kachelrand auf eine andere Kachel ziehen = Übergang (schnappt am Rand ein) · Pfeil markieren, Ende anfassen = umhängen · Beschriftung ziehen, Doppelklick = bearbeiten · Kachel doppelklicken = umbenennen · Entf löscht">?</span>
      </div>
      <svg v-if="sketch" ref="svgEl" tabindex="0" :viewBox="`0 0 ${sketch.width} ${sketch.height}`" :style="`width:100%;max-width:${sketch.width}px;height:auto;background:var(--bg);border:1px solid var(--line);border-radius:6px;margin-bottom:8px;outline:none;user-select:none`" font-size="11" font-family="system-ui"
        @mousemove="canvasMove" @mouseup="canvasUp" @mouseleave="canvasUp" @keydown.delete.prevent="delSelected" @keydown.backspace.prevent="delSelected" @mousedown.self="selState = null; selTrans = null">
        <defs><pattern id="wf-grid" :width="GRID" :height="GRID" patternUnits="userSpaceOnUse"><path :d="`M ${GRID} 0 L 0 0 0 ${GRID}`" fill="none" stroke="var(--line)" stroke-width="0.5" opacity="0.6" /></pattern><marker id="wf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" /></marker></defs>
        <rect x="0" y="0" :width="sketch.width" :height="sketch.height" fill="url(#wf-grid)" @mousedown="selState = null; selTrans = null" />
        <g v-for="(a, n) in sketch.arrows" :key="a.t.key" style="cursor:pointer" @click="selTrans = n; selState = null" @contextmenu.prevent.stop="arrowMenu($event, n)"><path :d="a.d" fill="none" :stroke="selTrans === n || a.temp ? 'var(--accent)' : 'var(--muted)'" :stroke-width="selTrans === n || a.temp ? 2 : 1.2" marker-end="url(#wf-arrow)" :stroke-dasharray="a.t.noteRequired ? '4 3' : ''" /><path :d="a.d" fill="none" stroke="transparent" stroke-width="12" /><text :x="a.lx" :y="a.ly" :text-anchor="a.anchor ?? 'middle'" :fill="selTrans === n ? 'var(--accent)' : 'var(--text)'" stroke="var(--bg)" stroke-width="4" paint-order="stroke" stroke-linejoin="round" style="cursor:move;user-select:none" @mousedown.stop.prevent="labelDown(n, $event)" @dblclick.stop="editLabel(n)"><title>ziehen = verschieben · Doppelklick = bearbeiten</title><tspan :x="a.lx">{{ a.t.label?.de || a.t.key }}</tspan><tspan v-if="a.t.roles.length" :x="a.lx" dy="1.15em" fill="var(--muted)">{{ a.t.roles.join(' / ') }}</tspan><tspan v-if="a.t.escalateAfterDays != null" :x="a.lx" dy="1.15em" fill="var(--warn)">⏰ nach {{ a.t.escalateAfterDays }} d{{ a.t.escalateRoles?.length ? ' → ' + a.t.escalateRoles.join('/') : '' }}</tspan></text></g>
        <g v-if="selTrans != null && sketch.arrows[selTrans]"><circle :cx="sketch.arrows[selTrans].p1.x" :cy="sketch.arrows[selTrans].p1.y" r="5" fill="var(--accent)" style="cursor:move" @mousedown.stop.prevent="endDown(selTrans, 'from', $event)"><title>Anfang umhängen</title></circle><circle :cx="sketch.arrows[selTrans].p2.x" :cy="sketch.arrows[selTrans].p2.y" r="5" fill="var(--accent)" style="cursor:move" @mousedown.stop.prevent="endDown(selTrans, 'to', $event)"><title>Ende umhängen</title></circle></g>
        <g v-for="(s, i) in cur.states" :key="s.key" :style="drag?.kind === 'move' ? 'cursor:grabbing' : hoverEdge === i ? 'cursor:crosshair' : 'cursor:grab'" @mousemove="stateHover(i, $event)" @mouseleave="hoverEdge === i && (hoverEdge = null)" @mousedown.prevent.stop="stateDown(i, $event)" @contextmenu.prevent.stop="stateMenu($event, i)" @mouseup.stop="stateUp(i, $event)" @dblclick="editState(i)">
          <rect :x="sketch.pos[i].x" :y="sketch.pos[i].y" :width="W" :height="H" rx="6" :fill="selState === i ? 'var(--accent-soft)' : 'var(--pane)'" :stroke="hoverEdge === i ? 'var(--accent)' : color(s.color)" :stroke-width="hoverEdge === i ? 2.5 : s.key === cur.start ? 2.5 : 1.5" />
          <text :x="sketch.pos[i].x + W / 2" :y="sketch.pos[i].y + 20" text-anchor="middle" fill="var(--text)" font-weight="600">{{ s.label?.de || s.key }}</text>
          <text :x="sketch.pos[i].x + W / 2" :y="sketch.pos[i].y + 36" text-anchor="middle" fill="var(--muted)">{{ s.count ?? 0 }} Knoten{{ s.final ? ' · Ende' : '' }}{{ s.key === cur.start ? ' · Start' : '' }}</text>
          <circle v-if="s.key === cur.start" :cx="sketch.pos[i].x - 12" :cy="sketch.pos[i].y + H / 2" r="5" fill="var(--text)"><title>Start</title></circle>
          <g v-if="s.final"><circle :cx="sketch.pos[i].x + W + 12" :cy="sketch.pos[i].y + H / 2" r="6" fill="none" stroke="var(--text)" stroke-width="1.5" /><circle :cx="sketch.pos[i].x + W + 12" :cy="sketch.pos[i].y + H / 2" r="3" fill="var(--text)" /></g>
          <circle v-if="drag?.snapJ === i" :cx="drag.tx" :cy="drag.ty" r="5" fill="none" stroke="var(--accent)" stroke-width="2" />
        </g>
      </svg>
      <div class="row" style="gap:32px;align-items:flex-start;flex-wrap:wrap;margin-top:12px">
        <table class="grid form" style="width:auto;margin-bottom:16px"><thead><tr><th colspan="6">Zustände <button class="x" @click="addState" title="Zustand hinzufügen">+</button></th></tr><tr><th>Key</th><th>Bezeichnung</th><th>Farbe</th><th title="Ende des Wegs">Ende</th><th>Knoten</th><th></th></tr></thead><tbody>
          <tr v-for="(s, i) in cur.states" :key="i" :class="{ selected: selState === i }" @click="selState = i; selTrans = null"><td><input v-model="s.key" type="text" class="mono" style="width:100px" @input="touch" /></td><td><input v-model="s.label.de" type="text" style="width:140px" @input="touch" /></td>
            <td><select v-model="s.color" @change="touch"><option v-for="[c, l] in COLORS" :key="c" :value="c">{{ l }}</option></select></td><td><input type="checkbox" v-model="s.final" @change="touch" /></td><td class="muted">{{ s.count }}</td><td><button class="x" @click="delState(i)">×</button></td></tr>
        </tbody></table>
        <table class="grid form" style="width:auto"><thead><tr><th colspan="9">Übergänge <button class="x" @click="addTransition" title="Übergang hinzufügen">+</button></th></tr><tr><th>Key</th><th>Bezeichnung</th><th>von</th><th>nach</th><th title="wer darf; nichts = jede Rolle mit Schreibrecht (admin immer)">Rollen</th><th title="Korrekturschleife: der Schritt braucht eine Notiz">Notiz</th><th title="Eskalation: nach n Tagen dürfen auch diese Rollen (keine = alle)">⏰ nach Tagen an</th><th title="was der Schritt auslöst">Wirkung</th><th></th></tr></thead><tbody>
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
