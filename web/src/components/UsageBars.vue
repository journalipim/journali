<script setup>
// Zwei Balken — Woche und Monat — und darunter der Verlauf. Ein Balken ist ein Füllstand und füllt sich mit dem,
// was genutzt wurde; was noch verfügbar ist, steht als Zeile darüber und im Tooltip. Der Tag wird trotzdem
// gezählt: er steht als Zahl in der Leiste und ist im Verlauf die feinste Auflösung.
// Gezählt wird nur das Tagesgeschäft — Import, Pflege, Ausleitung. Modellieren, Strukturieren, Kataloge und Betrieb
// stehen als graue Zahl daneben. Gezählt wird, was ins Journal geht; Lesen und Exportieren kosten nichts.
// Die Zahlen kommen aus /api/usage — das Abbild zählt je Tag mit, auch rückwirkend für alles, was schon im Journal steht.
import { computed } from 'vue'
import { t } from '../i18n.js'

const props = defineProps({ usage: Object, history: Array, period: { type: String, default: 'day' }, busy: Boolean })
const emit = defineEmits(['period'])

const PARTS = [['week', t('▤ Woche')], ['month', t('▦ Monat')]]   // kein Tageslimit
const HIST = [['day', '◷ Tag'], ['week', t('▤ Woche')], ['month', t('▦ Monat')]]
const n = v => v >= 2147483647 ? '∞' : (v ?? 0).toLocaleString('de-DE')   // Unlimited: keine Grenze
const frei = p => p?.max >= 2147483647 ? p.max : Math.max(0, (p?.max ?? 0) - (p?.used ?? 0))
// Ohne Kontingent (max 0) ist alles aufgebraucht; ohne Grenze (max null) gibt es nichts zu füllen
const pct = p => p?.max ? Math.min(100, Math.round((p.used / p.max) * 1000) / 10) : (p?.max === 0 ? 100 : 0)
// Farbe sagt, wie viel Luft noch ist: bis 70 % grün, bis 90 % gelb, darüber rot
const tone = p => p?.max == null ? '' : pct(p) >= 90 ? 'neg' : pct(p) >= 70 ? 'warn' : 'pos'
const parts = computed(() => PARTS.map(([key, label]) => ({ key, label, p: props.usage?.[key] ?? null })))
const maxHist = computed(() => Math.max(1, ...(props.history ?? []).map(h => h.all ?? h.count)))
const dayName = s => new Date(s + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
const histLabel = s => props.period === 'month' ? new Date(s + 'T00:00:00').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  : props.period === 'week' ? t('KW ab {0}', [new Date(s + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })]) : dayName(s)
</script>

<template>
  <div class="usage">
    <div v-for="{ key, label, p } in parts" :key="key" class="bar-row">
      <span class="lbl">{{ label }}</span>
      <span class="track" :title="p ? $t('{0} von {1} genutzt · noch {2} verfügbar · wird zurückgesetzt am {3}', [n(p.used), n(p.max), n(frei(p)), p.resetAt]) : $t('wird geladen')">
        <span class="fill" :class="tone(p)" :style="`width:${pct(p)}%`" />
      </span>
      <span class="num mono" :class="tone(p)">{{ n(p?.used) }}</span>
      <span class="num mono muted grenze">/ {{ n(p?.max) }} ⊞</span>
      <span class="num mono muted">{{ pct(p) }} %</span>
      <span v-if="usage?.all" class="num mono muted" :title="$t('{0} Einträge gesamt — Modell, Struktur, Kataloge und Betrieb zählen nicht mit', [n(usage.all[key])])">+{{ n(Math.max(0, (usage.all[key] ?? 0) - (p?.used ?? 0))) }}</span>
    </div>

    <div class="chips">
      <span v-for="[key, label] in HIST" :key="key" class="view-chip" :class="{ on: period === key }"
        @click="emit('period', key)" :title="$t('Verlauf je {0} anzeigen', [label.slice(2)])">{{ label }}</span>
      <span class="grow" />
      <span class="muted" style="font-size:12px" :title="$t('heute {0} Tagesgeschäft von {1} Einträgen — ohne Grenze', [n(usage?.day?.used), n(usage?.all?.day)])">{{ $t("heute {0}", [n(usage?.day?.used)]) }}</span>
      <span class="muted" style="font-size:12px">{{ $t("· Journal #{0}", [n(usage?.head)]) }}</span>
    </div>

    <div class="hist">
      <div v-for="h in (history ?? [])" :key="h.start" class="hrow">
        <span class="hlbl">{{ histLabel(h.start) }}</span>
        <!-- heller Teil: was nicht zählt (Modell, Struktur, Kataloge, Betrieb) -->
        <span class="htrack" :title="$t('{0} Tagesgeschäft · {1} zählt nicht', [n(h.count), n((h.all ?? h.count) - h.count)])">
          <span class="hfill rest" :style="`width:${Math.round(((h.all ?? h.count) / maxHist) * 100)}%`" />
          <span class="hfill" :style="`width:${Math.round((h.count / maxHist) * 100)}%`" />
        </span>
        <span class="num mono">{{ n(h.count) }}</span>
      </div>
      <div v-if="!(history ?? []).length" class="muted" style="font-size:12px;padding:4px 0">{{ busy ? $t('wird geladen …') : $t('noch nichts aufgezeichnet') }}</div>
    </div>
  </div>
</template>

<style scoped>
.usage { max-width: 620px; }
/* feste Spalten: die Zahlen springen nicht, wenn sie wachsen */
.bar-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
.lbl { width: 80px; flex: none; font-size: 12px; }
.track { flex: 1; height: 10px; background: var(--line); border-radius: 5px; overflow: hidden; }
.fill { display: block; height: 100%; transition: width .2s; }
.fill.pos { background: var(--pos); } .fill.warn { background: var(--warn); } .fill.neg { background: var(--neg); }
.num { width: 64px; flex: none; text-align: right; font-size: 12px; white-space: nowrap; }
.num.grenze { width: 84px; }   /* Platz für die Einheit — sonst bricht sie in die nächste Zeile */
.num.pos { color: var(--pos); } .num.warn { color: var(--warn); } .num.neg { color: var(--neg); }
.chips { display: flex; align-items: center; gap: 4px; margin: 10px 0 4px; }
.grow { flex: 1; }
/* Verlauf: feste Höhe mit Scrollbar-Platz, damit der Abschnitt nicht springt */
.hist { height: 180px; overflow-y: auto; scrollbar-gutter: stable; border-top: 1px solid var(--line); padding-top: 4px; }
.hrow { display: flex; align-items: center; gap: 8px; padding: 1px 0; }
.hlbl { width: 120px; flex: none; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.htrack { position: relative; flex: 1; height: 8px; background: var(--line); border-radius: 4px; overflow: hidden; }
.hfill { position: absolute; left: 0; top: 0; display: block; height: 100%; background: var(--accent); }
.hfill.rest { background: var(--line); filter: brightness(.94); }
</style>
