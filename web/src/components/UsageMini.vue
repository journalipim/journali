<script setup>
// Verfügbare Limits in der Statusleiste (Taloan, 22.09.2026): zwei schmale Balken — Woche und Monat.
// Gezeigt wird, was noch da ist (Taloan, 23.09.2026: „was verfügbar ist, ist gut“) — der Balken leert sich, statt zu
// wachsen. Zahlen aus /api/health (läuft ohnehin alle 3 s); Klick führt in die Einstellungen.
import { computed } from 'vue'

const props = defineProps({ usage: Object })   // { week: {used,max}, month: {used,max} }
const PARTS = [['week', '▤'], ['month', '▦']]
const n = v => (v ?? 0).toLocaleString('de-DE')
const frei = p => Math.max(0, (p?.max ?? 0) - (p?.used ?? 0))
const pct = p => p?.max ? Math.max(0, Math.round((frei(p) / p.max) * 100)) : 0
/// Viel verfügbar ist grün; wird es knapp, gelb; ist nichts mehr da, rot
const tone = p => !p?.max ? '' : pct(p) <= 10 ? 'neg' : pct(p) <= 30 ? 'warn' : 'pos'
const parts = computed(() => PARTS.map(([key, icon]) => ({ key, icon, p: props.usage?.[key] ?? null })))
const label = key => key === 'week' ? 'Woche' : 'Monat'
</script>

<template>
  <span v-if="usage" class="usage-mini">
    <span v-for="{ key, icon, p } in parts" :key="key" class="u" :title="`${label(key)}: noch ${n(frei(p))} von ${n(p?.max)} verfügbar (${pct(p)} %), wieder voll am ${p?.resetAt ?? '—'}`">
      <span class="ico">{{ icon }}</span>
      <span class="track"><span class="fill" :class="tone(p)" :style="`width:${pct(p)}%`" /></span>
      <span class="mono pc" :class="tone(p)">{{ pct(p) }}%</span>
    </span>
  </span>
</template>

<style scoped>
/* feste Breiten: die Leiste wackelt nicht, wenn die Zahlen wachsen (Taloan, 22.09.) */
.usage-mini { display: inline-flex; align-items: center; gap: 16px; }   /* Abstand zwischen den Gruppen: sonst weiss niemand, welche Zahl zu welchem Balken gehört (Taloan, 23.09.) */
.u { display: inline-flex; align-items: center; gap: 3px; cursor: pointer; }
.ico { font-size: 11px; opacity: .7; }
.track { width: 44px; height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; }
.fill { display: block; height: 100%; }
.fill.pos { background: var(--pos); } .fill.warn { background: var(--warn); } .fill.neg { background: var(--neg); }
.pc { width: 32px; text-align: right; font-size: 11px; }
.pc.pos { color: var(--muted); } .pc.warn { color: var(--warn); } .pc.neg { color: var(--neg); }
</style>
