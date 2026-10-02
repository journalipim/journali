<script setup>
// Die Zeilen eines Teils in Konfiguratorgruppen (docs/pflegestruktur.md 40). Jede Zeile nennt ihre Gruppe, optional eine Bedingung (nur über Teile der Auswahl)
// und ist entweder Mitglied (stellt bereit, verbraucht, Wert in der Gruppe) oder Vorgabe an die Gruppe (Mindest-, Höchstmenge, erlaubte Werte).
// Alle Zeilen, deren Bedingung zutrifft, wirken. Die Komponente ändert die übergebene Bearbeitung (edit) selbst; der Besitzer speichert sie.
import { computed } from 'vue'
import { tree, t } from 'journali'
import { newRow, newCondition, rowKind, valuesText, KEY_PATTERN } from './model.js'
import { describeRow } from './describe.js'
import ConditionEditor from './ConditionEditor.vue'

const props = defineProps({
  edit: { type: Object, required: true },                       // { node, rows }
  groups: { type: Array, default: () => [] },                   // [{ key, label }] — die Gruppen, die es gibt
  attributes: { type: Array, default: () => [] },
  dirty: { type: Boolean, default: false },
})
const emit = defineEmits(['save', 'remove', 'close'])
const WHEN_KINDS = ['has', 'count', 'sum', 'and', 'or', 'not']    // nach der Bilanz einer Gruppe darf eine Zeile nicht fragen (ein Kreis)

const ctx = computed(() => ({
  t, nodeName: id => tree.byId?.get(id)?.label ?? id,
  attributeName: k => props.attributes.find(a => a.key === k)?.label ?? k,
  groupName: k => props.groups.find(g => g.key === k)?.label || k,
}))
const sentence = r => describeRow(r, ctx.value)
const name = computed(() => tree.byId?.get(props.edit.node)?.label ?? props.edit.node)
const complete = computed(() => props.edit.rows.every(r => KEY_PATTERN.test(String(r.group ?? '').trim())))
const toggleWhen = r => { r.when = r.when ? undefined : newCondition('has') }
const setKind = (r, art) => { r.art = art }
const add = art => props.edit.rows.push(newRow(art, props.edit.rows.at(-1)?.group ?? ''))
const remove = i => props.edit.rows.splice(i, 1)
</script>

<template>
  <div class="teil">
    <div class="kopf">
      <strong class="name">{{ name }}</strong>
      <span v-if="name !== edit.node" class="muted id">{{ edit.node }}</span>
      <span class="grow" />
      <button type="button" class="primary speichern" :disabled="!dirty || !complete" :title="complete ? '' : $t('Jede Zeile braucht eine Gruppe (a–z, 0–9, _ und -)')" @click="emit('save')">{{ $t('Speichern') }}</button>
      <button type="button" class="x entfernen" :title="$t('Alle Zeilen dieses Teils entfernen')" @click="emit('remove')">✕</button>
      <button type="button" class="x schliessen" :title="$t('Schliessen')" @click="emit('close')">–</button>
    </div>

    <div v-for="(r, i) in edit.rows" :key="i" class="zeile">
      <div class="felder">
        <input v-model="r.group" list="kg-gruppen" class="grp" :placeholder="$t('Gruppe')" :title="$t('Schlüssel der Gruppe — a–z, 0–9, _ und -')" />
        <select :value="rowKind(r)" class="art" :title="$t('Mitglied: das Teil zählt in der Gruppe und trägt Zahlen oder einen Wert. Vorgabe: das Teil bestimmt, wie viele Teile und welche Werte die Gruppe haben darf; es zählt dort nicht mit.')" @change="setKind(r, $event.target.value)">
          <option value="member">{{ $t('Mitglied') }}</option>
          <option value="limit">{{ $t('gibt vor') }}</option>
        </select>
        <template v-if="rowKind(r) === 'member'">
          <input v-model.number="r.provides" type="number" min="0" class="zahl bereit" :placeholder="$t('bereit')" :title="$t('Stellt so viel bereit')" />
          <input v-model.number="r.consumes" type="number" min="0" class="zahl verbraucht" :placeholder="$t('verbraucht')" :title="$t('Verbraucht so viel')" />
          <input v-model="r.value" class="wert" :placeholder="$t('Wert')" :title="$t('Der Wert des Teils in dieser Gruppe — unabhängig von den Attributen des Produkts')" />
        </template>
        <template v-else>
          <input v-model.number="r.min" type="number" min="0" class="zahl min" :placeholder="$t('min')" :title="$t('Mindestens so viele Teile in der Gruppe — fehlt es, ist die Auswahl unvollständig')" />
          <input v-model.number="r.max" type="number" min="0" class="zahl max" :placeholder="$t('max')" :title="$t('Höchstens so viele Teile in der Gruppe')" />
          <input :value="valuesText(r)" class="werte" :placeholder="$t('Werte, z. B. 8, 32')" :title="$t('Erlaubte Werte der Mitglieder, mit Komma getrennt')" @input="r.valuesText = $event.target.value" />
        </template>
        <label class="wenn" :title="$t('Ohne Bedingung gilt die Zeile immer')"><input type="checkbox" :checked="!!r.when" @change="toggleWhen(r)" /> {{ $t('wenn') }}</label>
        <button type="button" class="x" :title="$t('Zeile entfernen')" @click="remove(i)">✕</button>
      </div>
      <div v-if="r.when" class="bedingung"><ConditionEditor :cond="r.when" :attributes="attributes" :kinds="WHEN_KINDS" /></div>
      <div class="satz muted">{{ sentence(r) }}</div>
    </div>

    <div class="neu">
      <button type="button" class="neue-zeile" :title="$t('Das Teil zählt in einer Gruppe: stellt bereit, verbraucht, hat einen Wert')" @click="add('member')">＋ {{ $t('Mitglied') }}</button>
      <button type="button" class="neue-vorgabe" :title="$t('Das Teil bestimmt Mengen und Werte einer Gruppe — ein Mainboard gibt dem Arbeitsspeicher vor, wie viele Bausteine und welche Größen')" @click="add('limit')">＋ {{ $t('gibt vor') }}</button>
    </div>

    <datalist id="kg-gruppen"><option v-for="g in groups" :key="g.key" :value="g.key">{{ g.label }}</option></datalist>
  </div>
</template>

<style scoped>
.teil { border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; margin: 8px 0; background: var(--pane); }
.kopf { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0 0 8px; }
.grow { flex: 1; }
.zeile { margin: 0 0 8px; padding: 0 0 6px; border-bottom: 1px dashed var(--line); }
.felder { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.grp { width: 130px; }
.art { min-width: 90px; }
.zahl { width: 70px; }
.wert { width: 110px; }
.werte { width: 160px; }
.wenn { display: inline-flex; gap: 4px; align-items: center; color: var(--muted); }
.bedingung { margin: 6px 0 0 8px; padding-left: 8px; border-left: 2px solid var(--line); }
.satz { font-size: 12px; margin-top: 4px; }
.neu { display: flex; gap: 6px; }
.neue-zeile, .neue-vorgabe { border: 1px dashed var(--line); background: none; color: var(--muted); padding: 4px 12px; cursor: pointer; border-radius: 6px; }
.neue-zeile:hover, .neue-vorgabe:hover { color: var(--accent); border-color: var(--accent); }
.x { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 4px; }
.x:hover { color: var(--neg); }
</style>
