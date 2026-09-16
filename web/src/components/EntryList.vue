<script setup>
// Einträge als dichte Zeilen: Nummer, Zeit, Urheber, [Strom], Typ, Inhalt.
import { when, describe } from '../api.js'
defineProps({ entries: Array, showStream: { type: Boolean, default: false } })
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
