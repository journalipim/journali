<script setup>
// Gleiche Begriffe zusammen: ein Begriff, viele Felder. Der Ersatztext gilt für alle angehakten; vorher steht, was daraus wird (Vorschau je Feld).
// Geschrieben wird ein Stapel — er lässt sich im Journal als Ganzes zurücknehmen.
import { ref, computed, watch } from 'vue'
import { store, L, t } from 'journali'
import { snippet, replace, findingKey, targetId } from './befunde.js'
import { catalog } from './checks.js'

const props = defineProps({ group: { type: Object, required: true } })
const emit = defineEmits(['apply'])

const replacement = ref('')
const picked = ref(new Set(props.group.findings.map(findingKey)))
watch(() => props.group.key, () => { replacement.value = ''; picked.value = new Set(props.group.findings.map(findingKey)) })
watch(() => props.group.findings.length, () => { const have = new Set(props.group.findings.map(findingKey)); picked.value = new Set([...picked.value].filter(k => have.has(k))) })

const rule = computed(() => catalog.rules.find(r => r.id === props.group.rule))
const attribute = key => { const a = store.model?.attributes?.find(x => x.key === key); return a ? (L(a.label) || a.key) : key }
const rows = computed(() => props.group.findings.map(f => {
  const after = replace(f.raw, f.rule, f.term, replacement.value)
  return { f, key: findingKey(f), before: snippet(f.raw, f.term, 36), after: snippet(after, replacement.value, 36), changed: after !== f.raw }
}))
const chosen = computed(() => rows.value.filter(r => picked.value.has(r.key) && r.changed))
const toggle = r => { const s = new Set(picked.value); s.has(r.key) ? s.delete(r.key) : s.add(r.key); picked.value = s }
const all = computed({ get: () => picked.value.size === rows.value.length, set: v => { picked.value = v ? new Set(rows.value.map(r => r.key)) : new Set() } })
</script>

<template>
  <div class="term">
    <h3><mark>{{ group.term }}</mark> <span class="muted">· {{ $t('{0} Felder', [group.findings.length]) }}</span></h3>
    <div class="regel muted"><b>{{ rule?.label }}</b> — {{ rule?.hint }}</div>

    <div class="ersatz">
      <input v-model="replacement" :placeholder="$t('Ersatztext für „{0}“', [group.term])" @keydown.enter.prevent="chosen.length && replacement.trim() && emit('apply', chosen.map(r => ({ f: r.f, value: replace(r.f.raw, r.f.rule, r.f.term, replacement)  })), replacement)" />
      <button type="button" class="primary" :disabled="!chosen.length || !replacement.trim()" :title="$t('Den Begriff in den angehakten Feldern ersetzen — ein Stapel, im Journal rückgängig zu machen')"
        @click="emit('apply', chosen.map(r => ({ f: r.f, value: replace(r.f.raw, r.f.rule, r.f.term, replacement) })), replacement)">{{ $t('In {0} Feldern ersetzen', [chosen.length]) }}</button>
    </div>

    <table class="grid vorschau"><thead><tr>
      <th style="width:26px"><input v-model="all" type="checkbox" :title="$t('alle')" /></th><th>{{ $t('Knoten') }}</th><th>{{ $t('Vorher') }}</th><th>{{ $t('Nachher') }}</th>
    </tr></thead><tbody>
      <tr v-for="r in rows" :key="r.key" :class="{ aus: !picked.has(r.key) }">
        <td><input type="checkbox" :checked="picked.has(r.key)" @change="toggle(r)" /></td>
        <td>{{ r.f.node.label }}<span v-if="r.f.heirs.length" class="muted" :title="r.f.heirs.map(h => h.label).join(', ')"> +{{ r.f.heirs.length }}</span>
          <div class="muted feld">{{ attribute(r.f.attribute) }} · {{ r.f.locale }}</div></td>
        <td class="snip"><span>{{ r.before.before }}</span><mark>{{ r.before.term }}</mark><span>{{ r.before.after }}</span></td>
        <td class="snip"><template v-if="replacement.trim()"><span>{{ r.after.before }}</span><mark class="neu">{{ r.after.term }}</mark><span>{{ r.after.after }}</span></template><span v-else class="muted">—</span></td>
      </tr>
    </tbody></table>
  </div>
</template>

<style scoped>
.term { padding: 10px 12px; }
.term h3 { margin: 0 0 4px; font-size: 15px; }
.regel { font-size: 12px; margin: 0 0 8px; }
.ersatz { display: flex; gap: 6px; margin: 0 0 8px; }
.ersatz input { flex: 1; }
.vorschau td { vertical-align: top; }
.snip { font-size: 12px; }
.feld { font-size: 11px; }
.aus { opacity: .45; }
mark.neu { background: color-mix(in srgb, var(--pos) 35%, transparent); }
</style>
