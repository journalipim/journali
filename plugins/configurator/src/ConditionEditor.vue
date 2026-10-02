<script setup>
// Eine Bedingung der Regel: Art und Felder je Art; und / oder / nicht tragen Teilbedingungen (diese Komponente ruft sich selbst auf).
// Die Komponente ändert das übergebene Objekt (cond) selbst; der Besitzer speichert es mit der Definition.
import { CONDITION_KINDS, COMPARISONS, newCondition } from './model.js'
import SelectorEditor from './SelectorEditor.vue'
import { t } from 'journali'

const props = defineProps({ cond: { type: Object, required: true }, attributes: { type: Array, default: () => [] }, depth: { type: Number, default: 1 } })
const OP = { '=': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤' }
const KIND = {
  has: t('hat'), count: t('Anzahl'), sum: t('Summe'), balance: t('Bilanz'), and: t('alle von'), or: t('eine von'), not: t('keine von'),
}
const TITLE = {
  has: t('Teile sind gewählt; der Wert ist die Mindestmenge'), count: t('Menge der gewählten Teile vergleichen'), sum: t('Menge × Zahlenwert eines Attributs, aufsummiert'),
  balance: t('Bereit minus verbraucht einer Ressource vergleichen'), and: t('Alle Teilbedingungen treffen zu'), or: t('Mindestens eine Teilbedingung trifft zu'), not: t('Die Teilbedingung trifft nicht zu'),
}

function kind(k) {
  if (k === props.cond.kind) return
  for (const key of Object.keys(props.cond)) delete props.cond[key]
  Object.assign(props.cond, newCondition(k))
}
const addPart = () => props.cond.parts.push(newCondition('has'))
const removePart = i => props.cond.parts.splice(i, 1)
</script>

<template>
  <div class="cond" :style="{ marginLeft: depth > 1 ? '14px' : 0 }">
    <select :value="cond.kind" class="kind" :title="TITLE[cond.kind]" @change="kind($event.target.value)">
      <option v-for="k in CONDITION_KINDS" :key="k" :value="k">{{ KIND[k] }}</option>
    </select>

    <template v-if="cond.kind === 'has'">
      <SelectorEditor :sel="cond.selector" :attributes="attributes" />
      <label class="mal" :title="TITLE.has">≥ <input v-model.number="cond.value" type="number" min="1" class="zahl" /></label>
    </template>
    <template v-else-if="cond.kind === 'count'">
      <SelectorEditor :sel="cond.selector" :attributes="attributes" />
      <select v-model="cond.comparison" class="cmp"><option v-for="c in COMPARISONS" :key="c" :value="c">{{ OP[c] }}</option></select>
      <input v-model.number="cond.value" type="number" class="zahl" />
    </template>
    <template v-else-if="cond.kind === 'sum'">
      <select v-model="cond.attribute" class="attr" :title="$t('Attribut, dessen Zahlenwerte summiert werden')">
        <option value="">{{ $t('— Attribut —') }}</option>
        <option v-for="a in attributes" :key="a.key" :value="a.key">{{ a.label }}</option>
      </select>
      <SelectorEditor :sel="cond.selector" :attributes="attributes" />
      <select v-model="cond.comparison" class="cmp"><option v-for="c in COMPARISONS" :key="c" :value="c">{{ OP[c] }}</option></select>
      <input v-model.number="cond.value" type="number" class="zahl" />
    </template>
    <template v-else-if="cond.kind === 'balance'">
      <input v-model="cond.resource" class="res" :placeholder="$t('Ressource')" />
      <select v-model="cond.comparison" class="cmp"><option v-for="c in COMPARISONS" :key="c" :value="c">{{ OP[c] }}</option></select>
      <input v-model.number="cond.value" type="number" class="zahl" />
    </template>
    <template v-else>
      <button v-if="cond.kind !== 'not'" type="button" class="plus" :title="$t('Teilbedingung hinzufügen')" @click="addPart">＋</button>
      <div v-for="(p, i) in cond.parts" :key="i" class="teil">
        <ConditionEditor :cond="p" :attributes="attributes" :depth="depth + 1" />
        <button v-if="cond.parts.length > 1" type="button" class="x" :title="$t('Teilbedingung entfernen')" @click="removePart(i)">✕</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.cond { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.teil { display: flex; align-items: flex-start; gap: 4px; width: 100%; }
.kind { min-width: 84px; }
.cmp { width: 52px; }
.zahl { width: 64px; }
.res { width: 110px; }
.attr { max-width: 160px; }
.mal { color: var(--muted); }
.plus, .x { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 4px; }
.plus:hover { color: var(--accent); }
.x:hover { color: var(--neg); }
</style>
