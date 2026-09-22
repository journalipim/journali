<script setup>
// Nutzung in der Statusleiste (Taloan, 22.09.2026): zwei schmale Balken — Woche und Monat — neben dem KI-Verbrauch.
// Zahlen aus /api/health (läuft ohnehin alle 3 s); Klick führt in die Einstellungen, wo Verlauf und Details stehen.
import { computed } from 'vue'

const props = defineProps({ usage: Object })   // { week: {used,max}, month: {used,max} }
const PARTS = [['week', '▤'], ['month', '▦']]
const n = v => (v ?? 0).toLocaleString('de-DE')
const pct = p => p?.max ? Math.min(100, Math.round((p.used / p.max) * 100)) : 0
const tone = p => pct(p) >= 85 ? 'neg' : pct(p) >= 60 ? 'warn' : 'pos'
const parts = computed(() => PARTS.map(([key, icon]) => ({ key, icon, p: props.usage?.[key] ?? null })))
const label = key => key === 'week' ? 'Woche' : 'Monat'
</script>

<template>
  <span v-if="usage" class="usage-mini">
    <span v-for="{ key, icon, p } in parts" :key="key" class="u" :title="`${label(key)}: ${n(p?.used)} von ${n(p?.max)} Einträgen (${pct(p)} %), zurück auf 0 am ${p?.resetAt ?? '—'}`">
      <span class="ico">{{ icon }}</span>
      <span class="track"><span class="fill" :class="tone(p)" :style="`width:${pct(p)}%`" /></span>
      <span class="mono pc" :class="tone(p)">{{ pct(p) }}%</span>
    </span>
  </span>
</template>

<style scoped>
/* feste Breiten: die Leiste wackelt nicht, wenn die Zahlen wachsen (Taloan, 22.09.) */
.usage-mini { display: inline-flex; align-items: center; gap: 8px; }
.u { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; }
.ico { font-size: 11px; opacity: .7; }
.track { width: 44px; height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; }
.fill { display: block; height: 100%; }
.fill.pos { background: var(--pos); } .fill.warn { background: var(--warn); } .fill.neg { background: var(--neg); }
.pc { width: 32px; text-align: right; font-size: 11px; }
.pc.pos { color: var(--muted); } .pc.warn { color: var(--warn); } .pc.neg { color: var(--neg); }
</style>
