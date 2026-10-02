<script setup>
// Eine einfache Regel als Satz mit Auswahlfeldern — so liest sie jeder:
//   Wenn [A] gewählt ist, darf [B] nicht gewählt sein.            (passt nicht zusammen)
//   Wenn [A] gewählt ist, müssen mindestens [n] von [B] gewählt sein.   (braucht)
//   Von [A] dürfen höchstens [n] gewählt sein.                    (Höchstmenge)
//   Von [A] müssen mindestens [n] gewählt sein.                   (Mindestmenge)
// Die Komponente ändert die übergebene Regel (rule) selbst; der Besitzer speichert sie mit der Definition.
import SelectorEditor from './SelectorEditor.vue'

defineProps({ rule: { type: Object, required: true }, kind: { type: String, required: true }, attributes: { type: Array, default: () => [] } })
</script>

<template>
  <div class="satz-regel">
    <template v-if="kind === 'excludes'">
      <span>{{ $t('Wenn') }}</span><SelectorEditor :sel="rule.if.selector" :attributes="attributes" compact />
      <span>{{ $t('gewählt ist, darf') }}</span><SelectorEditor :sel="rule.then.selector" :attributes="attributes" compact />
      <span>{{ $t('nicht gewählt sein.') }}</span>
    </template>
    <template v-else-if="kind === 'needs'">
      <span>{{ $t('Wenn') }}</span><SelectorEditor :sel="rule.if.selector" :attributes="attributes" compact />
      <span>{{ $t('gewählt ist, müssen mindestens') }}</span><input v-model.number="rule.then.min" type="number" min="1" class="zahl" />
      <span>{{ $t('von') }}</span><SelectorEditor :sel="rule.then.selector" :attributes="attributes" compact /><span>{{ $t('gewählt sein.') }}</span>
    </template>
    <template v-else-if="kind === 'max'">
      <span>{{ $t('Von') }}</span><SelectorEditor :sel="rule.then.selector" :attributes="attributes" compact />
      <span>{{ $t('dürfen höchstens') }}</span><input v-model.number="rule.then.max" type="number" min="0" class="zahl" /><span>{{ $t('gewählt sein.') }}</span>
    </template>
    <template v-else>
      <span>{{ $t('Von') }}</span><SelectorEditor :sel="rule.then.selector" :attributes="attributes" compact />
      <span>{{ $t('müssen mindestens') }}</span><input v-model.number="rule.then.min" type="number" min="1" class="zahl" /><span>{{ $t('gewählt sein.') }}</span>
    </template>
  </div>
</template>

<style scoped>
.satz-regel { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 14px; }
.zahl { width: 56px; }
</style>
