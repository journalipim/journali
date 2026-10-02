<script setup>
// Die Regeln eines Konfigurators. Die meisten Regeln haben eine von vier einfachen Formen und stehen als Satz da, in dem nur die Teile zu wählen sind:
//   „passt nicht zusammen“, „braucht“, „höchstens“, „mindestens“. Alles andere (Summe eines Attributs, Bilanz einer Ressource, und/oder/nicht)
//   zeigt der technische Editor. Jede Regel steht darunter noch einmal als Satz — der ist auch die Meldung, wenn keine eingetragen ist.
// Die Komponente ändert die übergebene Definition (def) selbst; der Besitzer speichert sie.
import { computed, reactive } from 'vue'
import { tree, t } from 'journali'
import { EFFECT_KINDS, newCondition, newEffect, nextRuleId, templateRule, templateOf, TEMPLATES } from './model.js'
import { describeRule } from './describe.js'
import ConditionEditor from './ConditionEditor.vue'
import SelectorEditor from './SelectorEditor.vue'
import RuleSentence from './RuleSentence.vue'

const props = defineProps({ def: { type: Object, required: true }, attributes: { type: Array, default: () => [] } })
const technical = reactive({})     // Kennung → der technische Editor ist an
const KIND = { forbids: t('darf nicht gewählt sein'), limits: t('höchstens'), requires: t('mindestens') }
const TITLE = { forbids: t('Kein passendes Teil darf gewählt sein'), limits: t('Höchstens so viele passende Teile'), requires: t('Mindestens so viele passende Teile — fehlt es, ist die Auswahl unvollständig') }
const NAME = { excludes: t('passt nicht zusammen'), needs: t('braucht'), max: t('höchstens'), min: t('mindestens') }
const HINT = {
  excludes: t('Zwei Teile oder Gruppen dürfen nicht zusammen gewählt werden — etwa Kühler 1 und Grafikkarten-Kühler 2'),
  needs: t('Wer ein Teil wählt, braucht ein anderes dazu — etwa eine CPU einen Kühler'),
  max: t('Von einem Teil oder einer Gruppe höchstens so viele — etwa ein Mainboard'),
  min: t('Von einem Teil oder einer Gruppe mindestens so viele — sonst ist die Auswahl unvollständig'),
}

const ctx = computed(() => ({
  t, nodeName: id => tree.byId?.get(id)?.label ?? id,
  attributeName: k => props.attributes.find(a => a.key === k)?.label ?? k,
}))
const sentence = r => describeRule(r, ctx.value)
const form = r => technical[r.id] ? null : templateOf(r)

const addFrom = kind => props.def.rules.push(templateRule(nextRuleId(props.def.rules), kind))
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
    <details class="hilfe" :open="!def.rules.length">
      <summary class="muted">{{ $t('So funktioniert es') }}</summary>
      <ul>
        <li>{{ $t('Eine Regel sagt, welche Teile zusammen gewählt werden dürfen — ein Teil ist ein Produkt, eine Variante oder eine Gruppe mit allem darunter.') }}</li>
        <li>{{ $t('Die meisten Regeln sind ein Satz, in dem nur die Teile zu wählen sind: passt nicht zusammen, braucht, höchstens, mindestens.') }}</li>
        <li>{{ $t('Steckplätze und andere Kapazität brauchen keine Regel: Teile tragen sie als Ressourcen, und der Konfigurator rechnet die Bilanz selbst.') }}</li>
        <li>{{ $t('Unter „Prüfen“ lässt sich eine Auswahl ausprobieren, und Testfälle halten fest, was herauskommen soll.') }}</li>
      </ul>
    </details>

    <div v-for="(r, i) in def.rules" :key="i" class="regel">
      <div class="kopf">
        <input v-model="r.id" class="kennung" :title="$t('Kennung der Regel — je Konfigurator einmal')" />
        <input v-model="r.text" class="text" :placeholder="sentence(r)" :title="$t('Meldung, wenn die Regel verletzt ist — leer: der Satz unten')" />
        <button type="button" class="x" :title="$t('nach oben')" :disabled="i === 0" @click="move(i, -1)">↑</button>
        <button type="button" class="x" :title="$t('nach unten')" :disabled="i === def.rules.length - 1" @click="move(i, 1)">↓</button>
        <button type="button" class="x" :title="$t('Regel entfernen')" @click="remove(i)">✕</button>
      </div>

      <RuleSentence v-if="form(r)" :rule="r" :kind="form(r)" :attributes="attributes" />
      <template v-else>
        <div class="zeile">
          <label class="wenn" :title="$t('Ohne Bedingung gilt die Regel immer')"><input type="checkbox" :checked="!!r.if" @change="toggleIf(r)" /> {{ $t('wenn') }}</label>
          <ConditionEditor v-if="r.if" :cond="r.if" :attributes="attributes" />
        </div>
        <div class="zeile">
          <span class="dann">{{ $t('dann') }}</span>
          <SelectorEditor v-if="r.then" :sel="r.then.selector" :attributes="attributes" />
          <select :value="r.then?.kind" class="folge" :title="TITLE[r.then?.kind]" @change="effectKind(r, $event.target.value)">
            <option v-for="k in EFFECT_KINDS" :key="k" :value="k">{{ KIND[k] }}</option>
          </select>
          <input v-if="r.then?.kind === 'limits'" v-model.number="r.then.max" type="number" min="0" class="zahl" />
          <input v-if="r.then?.kind === 'requires'" v-model.number="r.then.min" type="number" min="1" class="zahl" />
        </div>
      </template>

      <div class="fuss">
        <span class="satz muted">{{ sentence(r) }}</span>
        <button v-if="templateOf(r)" type="button" class="x umschalten" :title="$t('Dieselbe Regel mit allen Feldern: Bedingung, Folge, Mengen')" @click="technical[r.id] = !technical[r.id]">{{ technical[r.id] ? $t('einfach') : $t('technisch') }}</button>
      </div>
    </div>

    <div class="neu">
      <span class="muted">{{ $t('Neue Regel:') }}</span>
      <button v-for="k in TEMPLATES" :key="k" type="button" class="vorlage" :class="'v-' + k" :title="HINT[k]" @click="addFrom(k)">＋ {{ NAME[k] }}</button>
      <button type="button" class="neue-regel" :title="$t('Mit allen Möglichkeiten: Summe eines Attributs, Bilanz einer Ressource, und, oder, nicht')" @click="addFrom('eigene')">＋ {{ $t('eigene Regel') }}</button>
    </div>
  </div>
</template>

<style scoped>
.hilfe { margin: 0 0 10px; }
.hilfe ul { margin: 4px 0 0 18px; padding: 0; font-size: 13px; color: var(--muted); }
.regel { border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; margin: 0 0 8px; background: var(--pane); }
.kopf, .zeile { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 0 0 6px; }
.kennung { width: 70px; }
.text { flex: 1; min-width: 200px; }
.wenn { display: inline-flex; gap: 4px; align-items: center; width: 52px; color: var(--muted); }
.dann { width: 52px; color: var(--muted); }
.folge { min-width: 170px; }
.zahl { width: 64px; }
.fuss { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
.satz { font-size: 12px; flex: 1; }
.x { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 4px; }
.x:hover:not(:disabled) { color: var(--accent); }
.x:disabled { opacity: .3; cursor: default; }
.neu { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 8px; }
.vorlage, .neue-regel { border: 1px dashed var(--line); background: none; color: var(--muted); padding: 5px 12px; cursor: pointer; border-radius: 6px; }
.vorlage:hover, .neue-regel:hover { color: var(--accent); border-color: var(--accent); }
</style>
