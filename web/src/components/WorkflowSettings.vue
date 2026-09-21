<script setup>
// Einstellungen → Workflows (27, Taloan 21.09.2026: „Workflow-Designer mit Freigaben, Korrekturschleifen“): je Workflow die Zustände
// (Kacheln in der Skizze), die Übergänge (Pfeile: von → nach, Rolle, Notiz-Pflicht, Wirkungen) und wofür er gilt. Alles im Journal
// (WorkflowDefined); Speichern schreibt die ganze Definition. Die Skizze ist eine Vorschau — gezeichnet wird in den Tabellen.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'

const list = ref([]); const cur = ref(null); const roles = ref([]); const dirty = ref(false)
const COLORS = [['muted', 'grau'], ['warn', 'gelb'], ['neg', 'rot'], ['accent', 'blau'], ['pos', 'grün']]
const ROLES = [['group', '▣ Gruppe'], ['product', '▦ Produkt'], ['variant', '◆ Variante']]
const EFFECTS = computed(() => { const m = store.model; const out = []; for (const c of m?.channels ?? []) { out.push([`release:${c.key}`, `Freigabe ${c.key}`], [`revoke:${c.key}`, `Freigabe ${c.key} zurück`]) } out.push(['status:active', 'Status aktiv'], ['status:draft', 'Status Entwurf'], ['status:discontinued', 'Status ausgelaufen']); return out })
async function load() { try { list.value = await api.get('/api/workflows'); if (cur.value) cur.value = clone(list.value.find(w => w.key === cur.value.key) ?? list.value[0] ?? null); else cur.value = clone(list.value[0] ?? null) } catch (e) { store.toast(e.message) } try { roles.value = (await api.get('/api/auth/roles')).map(r => r.key) } catch { roles.value = ['admin', 'editor'] } }
const clone = w => w ? JSON.parse(JSON.stringify({ key: w.key, label: w.label ?? {}, start: w.start, roles: w.roles ?? [], families: w.families ?? [], states: w.states.map(s => ({ key: s.key, label: s.label ?? {}, color: s.color ?? 'muted', final: !!s.final, count: s.count ?? 0 })), transitions: w.transitions.map(t => ({ key: t.key, label: t.label ?? {}, from: t.from, to: t.to, roles: t.roles ?? [], noteRequired: !!t.noteRequired, effects: t.effects ?? [] })) })) : null
function pick(w) { cur.value = clone(w); dirty.value = false }
function touch() { dirty.value = true }
async function save() {
  const w = cur.value; if (!w) return
  try {
    await api.post(`/api/workflows/${encodeURIComponent(w.key)}`, { label: w.label, states: w.states.map(s => ({ key: s.key, label: s.label, color: s.color, final: s.final })), transitions: w.transitions.map(t => ({ key: t.key, label: t.label, from: t.from, to: t.to, roles: t.roles.length ? t.roles : null, noteRequired: t.noteRequired, effects: t.effects.length ? t.effects : null })), start: w.start, roles: w.roles.length ? w.roles : null, families: null }, 'PUT')
    dirty.value = false; store.toast(`Workflow „${w.label?.de || w.key}“ gespeichert`, 'ok'); await load()
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
const drag = ref(null)   // { kind: 'state' | 'link', i }
function stateDown(i, e) { drag.value = { kind: e.shiftKey ? 'link' : 'state', i }; selState.value = i; selTrans.value = null }
function linkDown(i) { drag.value = { kind: 'link', i }; selState.value = i }
function stateUp(j) {
  const d = drag.value; drag.value = null; if (!d || d.i === j) return
  const w = cur.value
  if (d.kind === 'state') { const [s] = w.states.splice(d.i, 1); w.states.splice(j, 0, s); selState.value = j; touch(); return }
  // neuer Übergang von d.i nach j
  const k = 'step' + (w.transitions.length + 1); w.transitions.push({ key: k, label: { de: k, en: k }, from: w.states[d.i].key, to: w.states[j].key, roles: [], noteRequired: false, effects: [], escalateAfterDays: null, escalateRoles: [] }); selTrans.value = w.transitions.length - 1; touch()
}
function toggleIn(arr, v) { const i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); touch() }
const stateLabel = k => cur.value?.states.find(s => s.key === k)?.label?.de || k
const color = c => ({ pos: 'var(--pos)', neg: 'var(--neg)', warn: 'var(--warn)', accent: 'var(--accent)' })[c] ?? 'var(--muted)'
// Skizze: Zustände in einer Reihe, Pfeile darüber (vorwärts) und darunter (zurück — die Korrekturschleife)
const sketch = computed(() => {
  const w = cur.value; if (!w) return null
  const W = 150, G = 40, H = 46, top = 70, x = i => 20 + i * (W + G)
  const idx = Object.fromEntries(w.states.map((s, i) => [s.key, i]))
  const arrows = w.transitions.map((t, n) => { const a = idx[t.from] ?? 0, b = idx[t.to] ?? 0; const fwd = b > a || a === b; const x1 = x(a) + W / 2, x2 = x(b) + W / 2; const y = fwd ? top : top + H; const lift = fwd ? -(22 + 14 * Math.abs(b - a)) : 22 + 14 * Math.abs(b - a); const cx = (x1 + x2) / 2
    return { t, d: a === b ? `M${x1 - 20},${y} C${x1 - 40},${y - 40} ${x1 + 40},${y - 40} ${x1 + 20},${y}` : `M${x1},${y} Q${cx},${y + lift} ${x2},${y}`, lx: cx, ly: y + lift / 2 - (fwd ? 4 : -12), back: !fwd } })
  return { W, H, top, x, width: 40 + w.states.length * (W + G), height: top + H + 90 + 14 * w.states.length, arrows }
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
      <svg v-if="sketch" :viewBox="`0 0 ${sketch.width} ${sketch.height}`" :style="`width:100%;max-width:${sketch.width}px;height:auto;background:var(--bg);border:1px solid var(--line);border-radius:6px;margin-bottom:8px`" font-size="11" font-family="system-ui">
        <defs><marker id="wf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" /></marker></defs>
        <g v-for="(a, n) in sketch.arrows" :key="a.t.key" style="cursor:pointer" @click="selTrans = n; selState = null"><path :d="a.d" fill="none" :stroke="selTrans === n ? 'var(--accent)' : 'var(--muted)'" :stroke-width="selTrans === n ? 2 : 1.2" marker-end="url(#wf-arrow)" :stroke-dasharray="a.t.noteRequired ? '4 3' : ''" /><path :d="a.d" fill="none" stroke="transparent" stroke-width="12" /><text :x="a.lx" :y="a.ly" text-anchor="middle" :fill="selTrans === n ? 'var(--accent)' : 'var(--text)'">{{ a.t.label?.de || a.t.key }}<tspan v-if="a.t.roles.length" fill="var(--muted)"> · {{ a.t.roles.join('/') }}</tspan></text></g>
        <g v-for="(s, i) in cur.states" :key="s.key" style="cursor:grab" @mousedown.prevent="stateDown(i, $event)" @mouseup="stateUp(i)" @dblclick="cur.start = s.key; touch()"><title>ziehen = Reihenfolge · vom ● ziehen = neuer Übergang · Doppelklick = Start</title><rect :x="sketch.x(i)" :y="sketch.top" :width="sketch.W" :height="sketch.H" rx="6" :fill="selState === i ? 'var(--accent-soft)' : 'var(--pane)'" :stroke="color(s.color)" :stroke-width="s.key === cur.start ? 2.5 : 1.5" /><circle v-if="s.key === cur.start" :cx="sketch.x(i) - 12" :cy="sketch.top + sketch.H / 2" r="5" fill="var(--text)"><title>Start</title></circle><g v-if="s.final"><circle :cx="sketch.x(i) + sketch.W + 12" :cy="sketch.top + sketch.H / 2" r="6" fill="none" stroke="var(--text)" stroke-width="1.5" /><circle :cx="sketch.x(i) + sketch.W + 12" :cy="sketch.top + sketch.H / 2" r="3" fill="var(--text)" /></g><circle :cx="sketch.x(i) + sketch.W" :cy="sketch.top + sketch.H - 8" r="5" fill="var(--accent)" style="cursor:crosshair" @mousedown.stop.prevent="linkDown(i)"><title>von hier auf einen anderen Zustand ziehen = neuer Übergang</title></circle><text :x="sketch.x(i) + sketch.W / 2" :y="sketch.top + 20" text-anchor="middle" fill="var(--text)" font-weight="600">{{ s.label?.de || s.key }}</text><text :x="sketch.x(i) + sketch.W / 2" :y="sketch.top + 36" text-anchor="middle" fill="var(--muted)">{{ s.count }} Knoten{{ s.final ? ' · Ende' : '' }}{{ s.key === cur.start ? ' · Start' : '' }}</text></g>
      </svg>
      <div class="row" style="gap:16px;align-items:flex-start;flex-wrap:wrap">
        <table class="grid form" style="width:auto"><thead><tr><th colspan="6">Zustände <button class="x" @click="addState" title="Zustand hinzufügen">+</button></th></tr><tr><th>Key</th><th>Bezeichnung</th><th>Farbe</th><th title="Ende des Wegs">Ende</th><th>Knoten</th><th></th></tr></thead><tbody>
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
