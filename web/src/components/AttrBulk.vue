<script setup>
// Massenbearbeitung von Attributen (Taloan, 22.09.2026: „jetzt wäre natürlich schön, wenn ich Massenbearbeitung von
// Attributen machen könnte“): je Zeile eine Eigenschaft, ein Zielwert, ein Knopf „→ n“. Was nicht angefasst wird,
// bleibt wie es ist — die Leiste setzt nie ganze Definitionen, sondern immer nur die eine Eigenschaft.
// Die Komponente entscheidet nichts selbst: sie meldet { kind, value }, geschrieben wird draussen (attrWith).
import { ref, computed } from 'vue'

const props = defineProps({
  count: Number,            // wie viele Attribute gewählt sind
  groups: { type: Array, default: () => [] },
  units: { type: Array, default: () => [] },
  roles: { type: Array, default: () => ['group', 'product', 'variant'] },
  roleLabel: { type: Object, default: () => ({}) },
  numericOnly: Boolean,     // alle Gewählten sind Zahlen — nur dann ist die Einheit sinnvoll
  busy: String,
})
const emit = defineEmits(['apply'])

const group = ref(''), unit = ref(''), levels = ref(new Set(props.roles))
const toggleLevel = r => { const s = new Set(levels.value); s.has(r) ? s.delete(r) : s.add(r); levels.value = s }
const levelsText = computed(() => [...props.roles].filter(r => levels.value.has(r)).map(r => props.roleLabel[r] ?? r).join(' · ') || 'keine')
const go = (kind, value) => emit('apply', { kind, value })
</script>

<template>
  <div class="bulk">
    <div class="row">
      <span class="lbl">▤ Gruppe</span>
      <select v-model="group" style="width:260px" title="Attributgruppe der Gewählten setzen">
        <option value="">wählen …</option>
        <option v-for="g in groups" :key="g.key" :value="g.key">{{ g.label?.de || g.key }} · {{ g.key }}</option>
      </select>
      <button class="primary" :disabled="!group || !!busy" @click="go('group', group)" :title="`Gruppe an ${count} Attributen setzen`">→ {{ count }}</button>
    </div>

    <div class="row">
      <span class="lbl" title="an welchen Knotentypen das Attribut gepflegt werden darf">▣▦◆ Ebenen</span>
      <span class="picks">
        <span v-for="r in roles" :key="r" class="view-chip" :class="{ on: levels.has(r) }" @click="toggleLevel(r)"
          :title="`${roleLabel[r] ?? r} ${levels.has(r) ? 'herausnehmen' : 'dazunehmen'}`">{{ roleLabel[r] ?? r }}</span>
      </span>
      <button class="primary" :disabled="!levels.size || !!busy" @click="go('levels', [...roles].filter(r => levels.has(r)))" :title="`Ebenen an ${count} Attributen setzen: ${levelsText}`">→ {{ count }}</button>
    </div>

    <div class="row" v-for="f in [['inheritable', '↓ vererbbar', 'Wert gilt an den Knoten darunter weiter'], ['locale', '🗣 sprachabhängig', 'je Sprache ein eigener Wert'], ['channel', '⇶ kanalabhängig', 'je Kanal ein eigener Wert'], ['multiple', '≣ mehrwertig', 'mehrere Werte je Zelle']]" :key="f[0]">
      <span class="lbl" :title="f[2]">{{ f[1] }}</span>
      <span class="picks">
        <button class="x" :disabled="!!busy" @click="go(f[0], true)" :title="`${f[2]} — an ${count} Attributen einschalten`">✓ an</button>
        <button class="x" :disabled="!!busy" @click="go(f[0], false)" :title="`${f[2]} — an ${count} Attributen ausschalten`">✗ aus</button>
      </span>
    </div>

    <div class="row" v-if="numericOnly">
      <span class="lbl">⚖ Einheit</span>
      <select v-model="unit" style="width:260px" title="Einheit der Gewählten setzen (nur Zahlen)">
        <option value="">wählen …</option>
        <option v-for="u in units" :key="u.key" :value="u.key">{{ u.label?.de || u.key }} · {{ u.quantity }}</option>
      </select>
      <button class="primary" :disabled="!unit || !!busy" @click="go('unit', unit)" :title="`Einheit an ${count} Attributen setzen`">→ {{ count }}</button>
    </div>

    <div class="row muted" style="font-size:12px;min-height:18px">{{ busy || 'Was hier nicht angefasst wird, bleibt an jedem Attribut, wie es ist.' }}</div>
  </div>
</template>

<style scoped>
/* feste Spalten: die Zeilen stehen untereinander, nichts springt (Taloan, 22.09.) */
.bulk { max-width: 640px; }
.row { display: flex; align-items: center; gap: 8px; padding: 3px 0; min-width: 0; }
.lbl { width: 150px; flex: none; font-size: 12px; }
.picks { display: flex; gap: 4px; flex: 1; min-width: 0; }
.row > button { flex: 0 0 auto; }
</style>
