<script setup>
// ⚑ Aufgaben (27, Taloan 21.09.2026): alle Knoten, deren nächster Workflow-Schritt meiner Rolle (oder mir) gehört — nach Alter im
// Zustand; Filter je Workflow und Zustand; der Schritt direkt aus der Zeile (Notiz-Pflicht → Dialog). Der Rest ist die Knotenansicht.
import { ref, computed, onMounted } from 'vue'
import { api, when } from '../api.js'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { icon } from '../tree.js'

const tasks = ref([]); const defs = ref([]); const wf = ref(''); const state = ref(''); const busy = ref('')
const color = c => ({ pos: 'var(--pos)', neg: 'var(--neg)', warn: 'var(--warn)', accent: 'var(--accent)' })[c] ?? 'var(--muted)'
const states = computed(() => defs.value.find(d => d.key === wf.value)?.states ?? [])
async function load() {
  busy.value = 'lade …'
  try { defs.value = await api.get('/api/workflows'); tasks.value = await api.get(`/api/workflows/tasks?workflow=${wf.value}&state=${state.value}`) } catch (e) { store.toast(e.message) }
  busy.value = ''
}
// Zuweisen aus der Liste (Taloan, 21.09.): Vorschlagsliste wie am Knoten — Personen mit der Rolle des nächsten Schritts zuerst
let people = null
async function assign(t) {
  if (!people) { try { people = await api.get('/api/auth/people') } catch { people = [] } }
  const roles = new Set(t.roles ?? []); const fits = p => roles.size === 0 || roles.has(p.role) || p.role === 'admin'
  const choices = [{ value: '', label: roles.size ? `— Rolle ${[...roles].join('/')} (jede Person damit)` : '— jede Rolle mit Schreibrecht' },
    ...people.filter(fits).map(p => ({ value: p.key, label: `${p.name || p.key} · ${p.role}` })),
    ...people.filter(p => !fits(p)).map(p => ({ value: p.key, label: `${p.name || p.key} · ${p.role} (nicht die Rolle des Schritts)` }))]
  const user = people.length ? await dialog.prompt({ title: `Zuständig · ${t.label}`, value: t.assigned ?? '', choices }) : await dialog.prompt({ title: `Zuständig · ${t.label}`, text: 'Benutzer-Key (leer = Rolle)', value: t.assigned ?? '' })
  if (user === null) return
  try { await api.post(`/api/nodes/${encodeURIComponent(t.node)}/workflow/${t.workflow}/assign`, { user: user.trim() || null }, 'PUT'); await load() } catch (e) { store.toast(e.message) }
}
async function step(t, tr) {
  let note = null
  if (tr.noteRequired) { note = await dialog.prompt({ title: `${tr.label?.de || tr.key} · ${t.label}`, text: 'Notiz ist Pflicht — was ist zu tun?', placeholder: 'Notiz' }); if (!note?.trim()) return }
  try { await api.post(`/api/nodes/${encodeURIComponent(t.node)}/workflow/${t.workflow}/${tr.key}`, { note }); await store.poll(true); await load() } catch (e) { store.toast(e.message) }
}
const age = iso => { if (!iso) return ''; const d = (Date.now() - new Date(iso)) / 864e5; return d < 1 ? 'heute' : d < 2 ? 'gestern' : `${Math.floor(d)} Tage` }
onMounted(load)
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>⚑ Aufgaben</h1><span class="muted">{{ tasks.length }}</span><span class="grow" /><span class="muted">{{ busy }}</span></div>
    <div class="toolbar" style="gap:6px">
      <select v-model="wf" @change="state = ''; load()"><option value="">alle Workflows</option><option v-for="d in defs" :key="d.key" :value="d.key">{{ d.label?.de || d.key }}</option></select>
      <select v-model="state" @change="load" :disabled="!wf" title="Zustand — leer: alles, wo meine Rolle dran ist"><option value="">wo ich dran bin</option><option v-for="s in states" :key="s.key" :value="s.key">{{ s.label?.de || s.key }} ({{ s.count }})</option></select>
      <button class="x" @click="load" title="neu laden">⟳</button>
    </div>
    <div class="scroll">
      <table class="grid" style="width:100%">
        <thead><tr><th>Knoten</th><th>Workflow</th><th>Zustand</th><th>seit</th><th>Notiz</th><th>zuständig</th><th>Schritt</th></tr></thead>
        <tbody>
          <tr v-for="t in tasks" :key="t.node + t.workflow" class="row">
            <td><router-link :to="`/tree/${t.node}`" :title="t.node">{{ icon(t.role) }} {{ t.label }}</router-link></td>
            <td class="muted">{{ t.workflowLabel?.de || t.workflow }}</td>
            <td><span class="chip" :style="`border-color:${color(t.color)};color:${color(t.color)}`">{{ t.stateLabel?.de || t.state }}</span></td>
            <td class="muted" :title="t.since ? `${when(t.since)} · ${t.actor}` : ''">{{ age(t.since) }}</td>
            <td class="muted" style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="t.note ?? ''">{{ t.note }}</td>
            <td><button class="x" @click="assign(t)" :title="t.assigned ? `zuständig: ${t.assigned} — ändern` : 'jemandem zuweisen'">{{ t.assigned ? '👤 ' + t.assigned : '👤' }}</button></td>
            <td class="row" style="gap:4px;flex-wrap:wrap"><button v-for="tr in t.transitions" :key="tr.key" @click="step(t, tr)" :title="tr.noteRequired ? 'Notiz Pflicht' : (tr.effects?.join(', ') ?? '')">{{ tr.label?.de || tr.key }} →</button></td>
          </tr>
        </tbody>
      </table>
      <div v-if="!tasks.length && !busy" class="empty">Nichts zu tun — kein Knoten wartet auf einen Schritt deiner Rolle.</div>
    </div>
  </div>
</template>

<style scoped>
.x { border: 0; background: none; color: var(--muted); padding: 0 4px; }
</style>
