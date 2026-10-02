<script setup>
// Arbeitsfläche zu einem Befund: der Knoten mit seinem Pfad, die Regel mit Quelle, der Wert mit markiertem Begriff — und gleich daneben das Textfeld.
// Strg+Enter speichert und geht zum nächsten Befund, Esc verlässt das Feld. Wer den Knoten ganz sehen will, öffnet ihn in einem neuen Tab:
// die Prüfung bleibt, wo sie ist.
import { ref, computed, watch, nextTick } from 'vue'
import { tree, store, t, L } from 'journali'
import { snippet, targetId, ignored, findingKey, ignoreName } from './befunde.js'
import { catalog } from './checks.js'

const props = defineProps({ finding: { type: Object, required: true }, ignoredMap: { type: Object, default: () => ({}) }, others: { type: Array, default: () => [] } })
const emit = defineEmits(['save', 'skip', 'ignore', 'unignore', 'pick'])

const ICON = { group: '▣', product: '▦', variant: '◆' }
const value = ref(props.finding.raw ?? '')
const reason = ref('')
const area = ref(null)
watch(() => findingKey(props.finding) + '|' + props.finding.raw, () => { value.value = props.finding.raw ?? ''; reason.value = '' })
watch(() => findingKey(props.finding), () => nextTick(() => area.value?.focus({ preventScroll: true })))

const rule = computed(() => catalog.rules.find(r => r.id === props.finding.rule))
const origin = computed(() => tree.byId?.get(targetId(props.finding)) ?? props.finding.node)
const path = computed(() => { const out = []; for (let n = tree.byId?.get(origin.value.id); n; n = n.parent ? tree.byId?.get(n.parent) : null) out.unshift(n); return out })
const attribute = computed(() => { const a = store.model?.attributes?.find(x => x.key === props.finding.attribute); return a ? (L(a.label) || a.key) : props.finding.attribute })
const marked = computed(() => snippet(value.value, props.finding.term, 400))
const changed = computed(() => value.value !== (props.finding.raw ?? ''))
const isIgnored = computed(() => ignored(props.finding, props.ignoredMap))
const entry = computed(() => props.ignoredMap?.[ignoreName(props.finding)])

function key(e) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); emit('save', value.value) }
  else if (e.key === 'Escape') { e.stopPropagation(); e.target.blur() }
}
</script>

<template>
  <div class="bench">
    <div class="pfad muted">
      <template v-for="(n, i) in path" :key="n.id"><span v-if="i">›</span><span>{{ n.label }}</span></template>
    </div>
    <h3 class="knoten">
      <span class="muted">{{ ICON[origin.role] }}</span>
      <a :href="'/tree/' + origin.id" target="_blank" rel="noopener" :title="$t('Knoten in einem neuen Tab öffnen — die Prüfung bleibt hier')">{{ origin.label }} ↗</a>
      <span class="muted feld">{{ attribute }} · {{ finding.locale }}</span>
    </h3>
    <div v-if="finding.heirs.length" class="erben muted" :title="finding.heirs.map(h => h.label).join(', ')">
      {{ $t('{0} Knoten erben den Wert', [finding.heirs.length]) }}: {{ finding.heirs.slice(0, 4).map(h => h.label).join(', ') }}<template v-if="finding.heirs.length > 4"> …</template>
    </div>
    <div v-else-if="finding.from" class="erben muted">{{ $t('Der Wert kommt von {0} und wird dort geändert.', [origin.label]) }}</div>

    <div class="regel" :class="finding.severity === 'error' ? 'neg' : finding.severity === 'warn' ? 'warn' : 'muted'">
      <b>{{ rule?.label }}</b> <span class="muted">{{ rule?.ref }}</span>
      <div class="hint">{{ rule?.hint }}</div>
    </div>

    <div class="wert">
      <span>{{ marked.before }}</span><mark v-if="marked.term">{{ marked.term }}</mark><span>{{ marked.after }}</span>
    </div>
    <textarea ref="area" v-model="value" rows="6" class="cell-input feldtext" @keydown="key" />
    <div class="knoepfe">
      <button type="button" class="primary" :disabled="!changed" :title="$t('Speichern und zum nächsten Befund — Strg+Enter')" @click="emit('save', value)">{{ $t('Speichern') }} ⏎</button>
      <button type="button" :disabled="!changed" :title="$t('Änderung verwerfen')" @click="value = finding.raw ?? ''">{{ $t('Zurücksetzen') }}</button>
      <button type="button" :title="$t('Zum nächsten Befund, ohne etwas zu ändern — Pfeil nach unten')" @click="emit('skip')">{{ $t('Überspringen') }} ↓</button>
    </div>

    <div class="ausnahme">
      <template v-if="isIgnored">
        <span class="pos">{{ $t('Ausnahme') }}</span><span v-if="entry?.reason" class="muted"> · {{ entry.reason }}</span>
        <button type="button" class="x" :title="$t('Der Befund gilt wieder')" @click="emit('unignore')">{{ $t('aufheben') }}</button>
      </template>
      <template v-else>
        <input v-model="reason" class="grund" :placeholder="$t('Begründung (optional)')" @keydown.enter.prevent="emit('ignore', reason)" />
        <button type="button" :title="$t('Kein Fehlalarm: der Befund bleibt aus der Liste, solange der Text so bleibt')" @click="emit('ignore', reason)">{{ $t('Ausnahme') }}</button>
      </template>
    </div>

    <div v-if="others.length" class="weitere">
      <span class="muted">{{ $t('Weitere Befunde im Feld') }}</span>
      <button v-for="o in others" :key="findingKey(o)" type="button" class="chip" :title="o.message" @click="emit('pick', o)">{{ o.term }}</button>
    </div>
  </div>
</template>

<style scoped>
.bench { padding: 10px 12px; }
.pfad { font-size: 12px; display: flex; flex-wrap: wrap; gap: 4px; }
.knoten { margin: 4px 0; font-size: 15px; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.knoten a { color: var(--text); text-decoration: none; }
.knoten a:hover { color: var(--accent); }
.feld { font-size: 12px; font-weight: 400; }
.erben { font-size: 12px; margin: 0 0 6px; }
.regel { margin: 6px 0; }
.hint { font-size: 12px; color: var(--muted); }
.wert { background: var(--pane); border: 1px solid var(--line); border-radius: 4px; padding: 6px 8px; margin: 8px 0 6px; font-size: 13px; white-space: pre-wrap; max-height: 120px; overflow: auto; }
.feldtext { width: 100%; font-family: inherit; }
.knoepfe { display: flex; gap: 6px; margin: 6px 0; }
.ausnahme { display: flex; gap: 6px; align-items: center; margin: 10px 0; }
.grund { flex: 1; min-width: 120px; }
.weitere { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.chip { border: 1px solid var(--line); background: var(--pane); border-radius: 10px; padding: 0 8px; cursor: pointer; color: var(--text); }
.x { border: 0; background: none; color: var(--muted); cursor: pointer; }
.x:hover { color: var(--accent); }
</style>
