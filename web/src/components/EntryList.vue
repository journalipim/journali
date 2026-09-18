<script setup>
// Einträge als dichte Zeilen: Nummer, Zeit, Urheber, [Strom], Typ, Inhalt.
import { reactive } from 'vue'
import { when, describe, api } from '../api.js'
import { store } from '../store.js'
import { tree } from '../tree.js'
defineProps({ entries: Array, showStream: { type: Boolean, default: false } })
// ↶ an NodeRetired, solange der Knoten nicht im Baum steht (Taloan: Rückgängig nach Löschen)
// Mouseover (Taloan): was würde der Schritt tun? Vorschau je Stapel, einmal geladen
const previews = reactive({})
async function preview(e) {
  const k = e.batch ?? e.stream; if (previews[k]) return
  if (!e.batch) { previews[k] = `stellt 1 Knoten wieder her: ${e.stream}`; return }
  try {
    const p = await api.get(`/api/batches/${encodeURIComponent(e.batch)}/preview`)
    const gone = p.retired.filter(r => r.gone), back = p.retired.length - gone.length
    const icon = { group: '▣', product: '▦', variant: '◆' }
    previews[k] = `Rückgängig stellt ${gone.length} Knoten wieder her (Stapel ${e.batch}, ${p.actor})` + (back ? ` — ${back} sind schon zurück` : '') + ':\n' + gone.slice(0, 15).map(r => `${icon[r.role] ?? ''} ${r.label}`).join('\n') + (gone.length > 15 ? `\n… und ${gone.length - 15} weitere` : '')
  } catch (err) { previews[k] = err.message }
}
async function restore(id, batch) {
  try { const x = batch ? await api.post(`/api/batches/${encodeURIComponent(batch)}/undo`) : await api.post(`/api/nodes/${encodeURIComponent(id)}/restore`); store.toast(`${x.restored} Knoten wiederhergestellt (Stapel ${x.batch})`, 'ok'); await store.poll(true); await tree.load() }
  catch (e) { store.toast(e.message) }
}
</script>

<template>
  <table class="grid">
    <thead>
      <tr>
        <th class="num">#</th>
        <th>Zeit</th>
        <th>👤</th>
        <th v-if="showStream">▦</th>
        <th>Typ</th>
        <th>Inhalt</th>
        <th title="Stapel">⧉</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="e in entries" :key="e.number" class="row">
        <td class="num">{{ e.number }}</td>
        <td class="mono muted">{{ when(e.at) }}</td>
        <td>{{ e.actor }}</td>
        <td v-if="showStream"><router-link v-if="!e.stream.includes(':')" :to="`/tree/${e.stream}`" class="mono link">{{ e.stream }}</router-link><router-link v-else to="/model" class="mono link muted">{{ e.stream }}</router-link></td>
        <td class="muted">{{ e.type }}</td>
        <td :class="{ pos: e.type.endsWith('Granted') || e.type.endsWith('Assigned') || e.type.endsWith('Created'), neg: e.type.endsWith('Revoked') || e.type.endsWith('Removed') || e.type.endsWith('Retired') }">
          {{ describe(e) }}
          <button v-if="e.type === 'NodeRetired' && !tree.byId.has(e.stream)" class="x" style="margin-left:8px" @click="restore(e.stream, e.batch)" @mouseenter="preview(e)" :title="previews[e.batch ?? e.stream] ?? 'lade Vorschau …'">↶ wiederherstellen</button>
        </td>
        <td class="mono muted" :title="e.batch ? 'Stapel ' + e.batch : ''">{{ e.batch ? e.batch.slice(2, 6) : '' }}</td>
      </tr>
    </tbody>
  </table>
  <div v-if="!entries.length" class="empty">Keine Einträge</div>
</template>

<style scoped>
.link:hover { color: var(--accent); text-decoration: underline; }
</style>
