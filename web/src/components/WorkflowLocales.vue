<script setup>
// Workflow je Sprache (Taloan, 22.09.2026: „Französisch in Korrektur, Deutsch freigegeben“ — sonst blockiert eine fehlende
// Übersetzung alles andere). Eine Zeile je Sprache: Zustand, die erlaubten Schritte, ↑ Erben, wenn hier ein eigener steht.
// Eigene Komponente, damit sie geprüft werden kann (web/test/ui-workflow.test.mjs) — NodeView bleibt schlank.
const props = defineProps({ wf: { type: Object, required: true } })
const emit = defineEmits(['step', 'clear'])
const color = c => c && c.startsWith('#') ? c : `var(--${c || 'muted'})`
const when = t => t ? new Date(t).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
</script>

<template>
  <div class="wf-locales">
    <div v-for="l in (wf.locales ?? [])" :key="l.locale" class="wf-loc row" :data-locale="l.locale">
      <span class="mono lang" :title="l.master ? $t('Mastersprache') : l.locale">{{ l.master ? '★ ' : '' }}{{ l.locale }}</span>
      <span class="chip" :style="`border-color:${color(l.color)};color:${color(l.color)}`"
            :title="(l.own ? $t('eigener Zustand') : $t('gilt vom Knoten')) + (l.since ? ` · seit ${when(l.since)} · ${l.actor}` : ' ' + $t('· Startzustand')) + (l.note ? ` · ✎ ${l.note}` : '')">
        {{ l.stateLabel?.de || l.state }}<span v-if="!l.own" class="muted"> ↑</span>
      </span>
      <button v-for="t in (l.transitions ?? [])" :key="t.key" :class="{ blocked: t.blocked }" :disabled="!!t.blocked"
              :title="t.blocked ? t.blocked : `${l.locale}: → ${t.toLabel?.de || t.to}${t.noteRequired ? ' · Notiz Pflicht' : ''}${t.effects?.length ? ' · ' + t.effects.join(', ') : ''}`"
              @click="emit('step', l.locale, t)">{{ t.blocked ? '⊘ ' : '' }}{{ t.label?.de || t.key }} →</button>
      <span v-if="!(l.transitions ?? []).length" class="muted" style="font-size:12px">—</span>
      <span class="grow" />
      <span v-if="l.note" class="muted note" :title="l.note">✎ {{ l.note }}</span>
      <button v-if="l.own" class="x" :title="$t('eigenen Zustand für {0} aufheben — es gilt wieder der des Knotens', [l.locale])" @click="emit('clear', l.locale)">↑</button>
    </div>
  </div>
</template>

<style scoped>
.wf-locales { display: flex; flex-direction: column; gap: 2px; width: 100%; }
.wf-loc { display: flex; gap: 6px; align-items: center; width: 100%; box-sizing: border-box; }
.lang { flex: 0 0 52px; color: var(--muted); font-size: 12px; }
.note { flex: 0 0 auto; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
</style>
