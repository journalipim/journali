<script setup>
// Nutzung: zwei Fortschrittsbalken — Woche und Monat — und darunter der Verlauf (Taloan, 22.09.2026: „ein Tageslimit
// ist Unsinn, macht man 3 Testimporte und muss aufhören“; „wir machen Woche und Monat“). Der Tag wird trotzdem
// gezählt: er steht als Zahl in der Leiste und ist im Verlauf die feinste Auflösung.
// Gezählt wird nur das Tagesgeschäft — Import, Pflege, Ausleitung. Modellieren, Strukturieren, Kataloge und Betrieb
// stehen als graue Zahl daneben (Taloan, 22.09.: „Datenmodellierung … würde ich nicht zählen“). Gezählt wird, was ins Journal geht; Lesen und Exportieren kosten nichts.
// Die Zahlen kommen aus /api/usage — das Abbild zählt je Tag mit, auch rückwirkend für alles, was schon im Journal steht.
import { computed } from 'vue'

const props = defineProps({ usage: Object, history: Array, period: { type: String, default: 'day' }, busy: Boolean })
const emit = defineEmits(['period'])

const PARTS = [['week', '▤ Woche'], ['month', '▦ Monat']]   // kein Tageslimit (Taloan, 22.09.2026)
const HIST = [['day', '◷ Tag'], ['week', '▤ Woche'], ['month', '▦ Monat']]
const n = v => (v ?? 0).toLocaleString('de-DE')
const pct = p => p?.max ? Math.min(100, Math.round((p.used / p.max) * 1000) / 10) : 0
// Farbe sagt, wie eng es wird: unter 60 % grün, bis 85 % gelb, darüber rot
const tone = p => pct(p) >= 85 ? 'neg' : pct(p) >= 60 ? 'warn' : 'pos'
const parts = computed(() => PARTS.map(([key, label]) => ({ key, label, p: props.usage?.[key] ?? null })))
const maxHist = computed(() => Math.max(1, ...(props.history ?? []).map(h => h.all ?? h.count)))
const dayName = s => new Date(s + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })
const histLabel = s => props.period === 'month' ? new Date(s + 'T00:00:00').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
  : props.period === 'week' ? `KW ab ${new Date(s + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}` : dayName(s)
</script>

<template>
  <div class="usage">
    <div v-for="{ key, label, p } in parts" :key="key" class="bar-row">
      <span class="lbl">{{ label }}</span>
      <span class="track" :title="p ? `${n(p.used)} von ${n(p.max)} Einträgen, zurück auf 0 am ${p.resetAt}` : 'wird geladen'">
        <span class="fill" :class="tone(p)" :style="`width:${pct(p)}%`" />
      </span>
      <span class="num mono" :class="tone(p)">{{ n(p?.used) }}</span>
      <span class="num mono muted">/ {{ n(p?.max) }} <span title="Einträge im Journal">⊞</span></span>
      <span class="num mono muted">{{ pct(p) }} %</span>
      <span class="num mono muted" :title="`${n(usage?.all?.[key])} Einträge gesamt — Modell, Struktur, Kataloge und Betrieb zählen nicht mit`">+{{ n((usage?.all?.[key] ?? 0) - (p?.used ?? 0)) }}</span>
    </div>

    <div class="chips">
      <span v-for="[key, label] in HIST" :key="key" class="view-chip" :class="{ on: period === key }"
        @click="emit('period', key)" :title="`Verlauf je ${label.slice(2)} anzeigen`">{{ label }}</span>
      <span class="grow" />
      <span class="muted" style="font-size:12px" :title="`heute ${n(usage?.day?.used)} Tagesgeschäft von ${n(usage?.all?.day)} Einträgen — ohne Grenze`">heute {{ n(usage?.day?.used) }}</span>
      <span class="muted" style="font-size:12px">· Journal #{{ n(usage?.head) }}</span>
    </div>

    <div class="hist">
      <div v-for="h in (history ?? [])" :key="h.start" class="hrow">
        <span class="hlbl">{{ histLabel(h.start) }}</span>
        <!-- heller Teil: was nicht zählt (Modell, Struktur, Kataloge, Betrieb) -->
        <span class="htrack" :title="`${n(h.count)} Tagesgeschäft · ${n((h.all ?? h.count) - h.count)} zählt nicht`">
          <span class="hfill rest" :style="`width:${Math.round(((h.all ?? h.count) / maxHist) * 100)}%`" />
          <span class="hfill" :style="`width:${Math.round((h.count / maxHist) * 100)}%`" />
        </span>
        <span class="num mono">{{ n(h.count) }}</span>
      </div>
      <div v-if="!(history ?? []).length" class="muted" style="font-size:12px;padding:4px 0">{{ busy ? 'wird geladen …' : 'noch nichts aufgezeichnet' }}</div>
    </div>
  </div>
</template>

<style scoped>
.usage { max-width: 620px; }
/* feste Spalten: die Zahlen springen nicht, wenn sie wachsen (Taloan, 22.09.) */
.bar-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
.lbl { width: 80px; flex: none; font-size: 12px; }
.track { flex: 1; height: 10px; background: var(--line); border-radius: 5px; overflow: hidden; }
.fill { display: block; height: 100%; transition: width .2s; }
.fill.pos { background: var(--pos); } .fill.warn { background: var(--warn); } .fill.neg { background: var(--neg); }
.num { width: 64px; flex: none; text-align: right; font-size: 12px; }
.num.pos { color: var(--pos); } .num.warn { color: var(--warn); } .num.neg { color: var(--neg); }
.chips { display: flex; align-items: center; gap: 4px; margin: 10px 0 4px; }
.grow { flex: 1; }
/* Verlauf: feste Höhe mit Scrollbar-Platz, damit der Abschnitt nicht springt (Taloan, 22.09.) */
.hist { height: 180px; overflow-y: auto; scrollbar-gutter: stable; border-top: 1px solid var(--line); padding-top: 4px; }
.hrow { display: flex; align-items: center; gap: 8px; padding: 1px 0; }
.hlbl { width: 120px; flex: none; font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.htrack { position: relative; flex: 1; height: 8px; background: var(--line); border-radius: 4px; overflow: hidden; }
.hfill { position: absolute; left: 0; top: 0; display: block; height: 100%; background: var(--accent); }
.hfill.rest { background: var(--line); filter: brightness(.94); }
</style>
