<script setup>
// Zwei schmale Balken in der Statusleiste (Taloan, 22.09.2026): Woche und Monat. Ein Balken füllt sich mit dem, was
// genutzt wurde (Taloan, 23.09.2026); was noch verfügbar ist, sagt der Tooltip.
// Zahlen aus /api/health (läuft ohnehin alle 3 s); Klick führt in die Einstellungen.
import { computed } from 'vue'
import { t } from '../i18n.js'

const props = defineProps({ usage: Object })   // { week: {used,max}, month: {used,max} }
const PARTS = [['week', '▤'], ['month', '▦']]
const n = v => v >= 2147483647 ? '∞' : (v ?? 0).toLocaleString('de-DE')   // Unlimited: keine Grenze
const frei = p => p?.max >= 2147483647 ? p.max : Math.max(0, (p?.max ?? 0) - (p?.used ?? 0))
/// Ohne Kontingent (max 0) ist alles aufgebraucht — 0 ist sofort erreicht (Taloan, 23.09.2026)
const pct = p => p?.max ? Math.min(100, Math.round((p.used / p.max) * 100)) : 100
/// Viel Luft ist grün; wird es eng, gelb; ist das Kontingent voll, rot
const tone = p => pct(p) >= 90 ? 'neg' : pct(p) >= 70 ? 'warn' : 'pos'
const parts = computed(() => PARTS.map(([key, icon]) => ({ key, icon, p: props.usage?.[key] ?? null })))
const label = key => key === 'week' ? t('Woche') : t('Monat')
</script>

<template>
  <span v-if="usage" class="usage-mini">
    <span v-for="{ key, icon, p } in parts" :key="key" class="u" :title="$t('{0} · {1}: {2} von {3} genutzt · noch {4} verfügbar · wird zurückgesetzt am {5}', [p?.scope ?? '', label(key), n(p?.used), n(p?.max), n(frei(p)), p?.resetAt ?? '—'])">
      <span class="ico">{{ icon }}</span>
      <span class="track"><span class="fill" :class="tone(p)" :style="`width:${pct(p)}%`" /></span>
      <span class="mono pc" :class="tone(p)">{{ pct(p) }}%</span>
    </span>
  </span>
</template>

<style scoped>
/* feste Breiten: die Leiste wackelt nicht, wenn die Zahlen wachsen (Taloan, 22.09.) */
.usage-mini { display: inline-flex; align-items: center; gap: 22px; }   /* Abstand zwischen den Gruppen: sonst weiss niemand, welche Zahl zu welchem Balken gehört (Taloan, 23.09.) */
.u { display: inline-flex; align-items: center; gap: 3px; cursor: pointer; }
.ico { font-size: 11px; opacity: .7; }
.track { width: 44px; height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; }
.fill { display: block; height: 100%; }
.fill.pos { background: var(--pos); } .fill.warn { background: var(--warn); } .fill.neg { background: var(--neg); }
.pc { width: 34px; text-align: left; font-size: 11px; }   /* links: die Zahl gehört an ihren Balken, nicht an den nächsten (Taloan, 23.09.) */
.pc.pos { color: var(--muted); } .pc.warn { color: var(--warn); } .pc.neg { color: var(--neg); }
</style>
