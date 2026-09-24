<script setup>
// Massenbearbeitung von Attributen (Taloan, 22.09.2026: „jetzt wäre natürlich schön, wenn ich Massenbearbeitung von
// Attributen machen könnte“): je Zeile eine Eigenschaft. Jede Zeile zeigt zuerst den **Stand der Auswahl** — alle an,
// alle aus oder gemischt mit Zahl (Taloan: „wo Werte gemischt sind, sollte das angezeigt werden“) — und schaltet beim
// Klick durch: gemischt → alle an → alle aus → alle an. Geschrieben wird draussen; die Leiste meldet nur { kind, value }.
import { ref, computed } from 'vue'
import { t } from '../i18n.js'

const props = defineProps({
  attrs: { type: Array, default: () => [] },   // die gewählten Definitionen — daraus kommt der Stand
  groups: { type: Array, default: () => [] },
  units: { type: Array, default: () => [] },
  roles: { type: Array, default: () => ['group', 'product', 'variant'] },
  roleLabel: { type: Object, default: () => ({}) },
  busy: String,
})
const emit = defineEmits(['apply'])

const count = computed(() => props.attrs.length)
const group = ref(''), unit = ref('')
const numericOnly = computed(() => count.value > 0 && props.attrs.every(a => a.type === 'decimal' || a.type === 'integer'))

const FLAGS = [
  ['inheritable', '↓ vererbbar', t('Wert gilt an den Knoten darunter weiter'), a => !!a.inheritable],
  ['locale', t('🗣 sprachabhängig'), t('je Sprache ein eigener Wert'), a => !!(a.perLocale ?? (a.axes ?? []).includes('locale'))],
  ['channel', t('⇶ kanalabhängig'), t('je Kanal ein eigener Wert'), a => !!(a.perChannel ?? (a.axes ?? []).includes('channel'))],
  ['multiple', '≣ mehrwertig', t('mehrere Werte je Zelle'), a => !!a.multiple],
]
/// Stand einer Eigenschaft über die Auswahl: alle an, alle aus oder gemischt (mit Zahl)
function stateOf(has) {
  const on = props.attrs.filter(has).length
  return { on, total: count.value, all: count.value > 0 && on === count.value, none: on === 0, mixed: on > 0 && on < count.value }
}
const flagState = computed(() => Object.fromEntries(FLAGS.map(([key,,, has]) => [key, stateOf(has)])))
const levelState = computed(() => Object.fromEntries(props.roles.map(r => [r, stateOf(a => (a.levels ?? props.roles).includes(r))])))
const stateText = s => s.all ? t('alle an') : s.none ? t('alle aus') : t('gemischt · {0} von {1} an', [s.on, s.total])
/// Klick schaltet durch: gemischt oder aus → alle an; alle an → alle aus
const nextOf = s => !s.all
const go = (kind, value) => emit('apply', { kind, value })
</script>

<template>
  <div class="bulk">
    <div class="row">
      <span class="lbl">{{ $t("▤ Gruppe") }}</span>
      <span class="picks">
        <select v-model="group" style="width:260px" :title="$t('Attributgruppe der Gewählten setzen')">
          <option value="">{{ $t("wählen …") }}</option>
          <option v-for="g in groups" :key="g.key" :value="g.key">{{ $L(g.label) || g.key }} · {{ g.key }}</option>
        </select>
        <span class="muted state">{{ [...new Set(attrs.map(a => a.group || '—'))].slice(0, 3).join(' · ') }}{{ new Set(attrs.map(a => a.group || '—')).size > 3 ? ' …' : '' }}</span>
      </span>
      <button class="primary" :disabled="!group || !!busy" @click="go('group', group)" :title="$t('Gruppe an {0} Attributen setzen', [count])">→ {{ count }}</button>
    </div>

    <div class="row">
      <span class="lbl" :title="$t('an welchen Knotentypen das Attribut gepflegt werden darf')">{{ $t("▣▦◆ Ebenen") }}</span>
      <span class="picks">
        <span v-for="r in roles" :key="r" class="view-chip" :class="{ on: levelState[r].all, mixed: levelState[r].mixed }"
          @click="!busy && go('lv_' + r, nextOf(levelState[r]))"
          :title="$t('{0}: {1} · Klick setzt alle {2}', [roleLabel[r] ?? r, stateText(levelState[r]), nextOf(levelState[r]) ? 'an' : 'aus'])">
          {{ roleLabel[r] ?? r }}<span v-if="levelState[r].mixed" class="mono"> {{ levelState[r].on }}/{{ levelState[r].total }}</span>
        </span>
      </span>
    </div>

    <div class="row" v-for="[key, label, hint] in FLAGS" :key="key">
      <span class="lbl" :title="hint">{{ label }}</span>
      <span class="picks">
        <button class="x" :class="{ on: flagState[key].all }" :disabled="!!busy" @click="go(key, true)" :title="$t('{0} — an allen {1} einschalten', [hint, count])">{{ $t("✓ an") }}</button>
        <button class="x" :class="{ on: flagState[key].none }" :disabled="!!busy" @click="go(key, false)" :title="$t('{0} — an allen {1} ausschalten', [hint, count])">{{ $t("✗ aus") }}</button>
        <span class="muted state" :class="{ warn: flagState[key].mixed }">{{ stateText(flagState[key]) }}</span>
      </span>
    </div>

    <div class="row" v-if="numericOnly">
      <span class="lbl">{{ $t("⚖ Einheit") }}</span>
      <span class="picks">
        <select v-model="unit" style="width:260px" :title="$t('Einheit der Gewählten setzen (nur Zahlen)')">
          <option value="">{{ $t("wählen …") }}</option>
          <option v-for="u in units" :key="u.key" :value="u.key">{{ $L(u.label) || u.key }} · {{ u.quantity }}</option>
        </select>
        <span class="muted state">{{ [...new Set(attrs.map(a => a.unit || '—'))].slice(0, 3).join(' · ') }}</span>
      </span>
      <button class="primary" :disabled="!unit || !!busy" @click="go('unit', unit)" :title="$t('Einheit an {0} Attributen setzen', [count])">→ {{ count }}</button>
    </div>

    <div class="row muted" style="font-size:12px;min-height:18px">{{ busy || $t('Was hier nicht angefasst wird, bleibt an jedem Attribut, wie es ist.') }}</div>
  </div>
</template>

<style scoped>
/* feste Spalten: die Zeilen stehen untereinander, nichts springt (Taloan, 22.09.) */
.bulk { max-width: 720px; }
.row { display: flex; align-items: center; gap: 8px; padding: 3px 0; min-width: 0; }
.lbl { width: 150px; flex: none; font-size: 12px; }
.picks { display: flex; gap: 6px; align-items: center; flex: 1; min-width: 0; }
.row > button { flex: 0 0 auto; }
.state { font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.state.warn { color: var(--warn); }
/* gemischt: halb gefüllt — man sieht sofort, dass nicht alle gleich stehen */
.view-chip.mixed { border-style: dashed; background: linear-gradient(90deg, var(--accent-soft) 50%, transparent 50%); }
button.x.on { color: var(--accent); font-weight: 600; }
</style>
