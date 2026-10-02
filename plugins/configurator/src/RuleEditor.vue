<script setup>
// Die Regeln eines Konfigurators als Formular: Kennung, Meldung, Bedingung (leer = gilt immer) und Folge — darunter die Regel als Satz.
// Die Komponente ändert die übergebene Definition (def) selbst; der Besitzer speichert sie.
import { computed } from 'vue'
import { tree, t } from 'journali'
import { EFFECT_KINDS, newCondition, newEffect, nextRuleId } from './model.js'
import { describeRule } from './describe.js'
import ConditionEditor from './ConditionEditor.vue'
import SelectorEditor from './SelectorEditor.vue'

const props = defineProps({ def: { type: Object, required: true }, attributes: { type: Array, default: () => [] } })
const KIND = { forbids: t('verbietet'), limits: t('begrenzt auf höchstens'), requires: t('verlangt mindestens') }
const TITLE = { forbids: t('Kein passendes Teil darf gewählt sein'), limits: t('Höchstens so viele passende Teile'), requires: t('Mindestens so viele passende Teile — fehlt es, ist die Auswahl unvollständig') }

const ctx = computed(() => ({
  t, nodeName: id => tree.byId?.get(id)?.label ?? id,
  attributeName: k => props.attributes.find(a => a.key === k)?.label ?? k,
}))
const sentence = r => describeRule(r, ctx.value)

const add = () => props.def.rules.push({ id: nextRuleId(props.def.rules), text: '', then: newEffect('forbids') })
const remove = i => props.def.rules.splice(i, 1)
const move = (i, d) => { const j = i + d; if (j < 0 || j >= props.def.rules.length) return; const [r] = props.def.rules.splice(i, 1); props.def.rules.splice(j, 0, r) }
const toggleIf = r => { r.if = r.if ? undefined : newCondition('has') }
function effectKind(r, k) {
  const keep = r.then?.selector ?? {}
  r.then = newEffect(k); r.then.selector = keep
}
</script>

<template>
  <div class="regeln">
    <div v-for="(r, i) in def.rules" :key="i" class="regel">
      <div class="kopf">
        <input v-model="r.id" class="kennung" :title="$t('Kennung der Regel — je Konfigurator einmal')" />
        <input v-model="r.text" class="text" :placeholder="$t('Meldung, wenn die Regel verletzt ist')" />
        <button type="button" class="x" :title="$t('nach oben')" :disabled="i === 0" @click="move(i, -1)">↑</button>
        <button type="button" class="x" :title="$t('nach unten')" :disabled="i === def.rules.length - 1" @click="move(i, 1)">↓</button>
        <button type="button" class="x" :title="$t('Regel entfernen')" @click="remove(i)">✕</button>
      </div>
      <div class="zeile">
        <label class="wenn" :title="$t('Ohne Bedingung gilt die Regel immer')"><input type="checkbox" :checked="!!r.if" @change="toggleIf(r)" /> {{ $t('wenn') }}</label>
        <ConditionEditor v-if="r.if" :cond="r.if" :attributes="attributes" />
      </div>
      <div class="zeile">
        <span class="dann">{{ $t('dann') }}</span>
        <select :value="r.then?.kind" class="folge" :title="TITLE[r.then?.kind]" @change="effectKind(r, $event.target.value)">
          <option v-for="k in EFFECT_KINDS" :key="k" :value="k">{{ KIND[k] }}</option>
        </select>
        <input v-if="r.then?.kind === 'limits'" v-model.number="r.then.max" type="number" min="0" class="zahl" />
        <input v-if="r.then?.kind === 'requires'" v-model.number="r.then.min" type="number" min="1" class="zahl" />
        <SelectorEditor v-if="r.then" :sel="r.then.selector" :attributes="attributes" />
      </div>
      <div class="satz muted">{{ sentence(r) }}</div>
    </div>
    <button type="button" class="neue-regel" @click="add">＋ {{ $t('Regel') }}</button>
  </div>
</template>

<style scoped>
.regel { border: 1px solid var(--line); border-radius: 6px; padding: 8px; margin: 0 0 8px; background: var(--pane); }
.kopf, .zeile { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 0 0 4px; }
.kennung { width: 84px; }
.text { flex: 1; min-width: 200px; }
.wenn, .dann { width: 52px; color: var(--muted); }
.folge { min-width: 150px; }
.zahl { width: 64px; }
.satz { font-size: 12px; margin-top: 2px; }
.x { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 4px; }
.x:hover:not(:disabled) { color: var(--accent); }
.x:disabled { opacity: .3; cursor: default; }
.neue-regel { border: 1px dashed var(--line); background: none; color: var(--muted); padding: 6px 12px; cursor: pointer; border-radius: 6px; }
.neue-regel:hover { color: var(--accent); }
</style>
