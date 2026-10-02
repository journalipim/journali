<script setup>
// Ein Selektor: welche Teile gemeint sind — ein Knoten (Produkt, Gruppe oder Variante, sein ganzer Teilbaum), ein Attributfilter, oder beides.
// Die Komponente ändert das übergebene Objekt (sel) selbst; der Besitzer speichert es mit der Definition.
import { ref, watch } from 'vue'
import { tree, TreePicker } from 'journali'
import { COMPARISONS } from './model.js'

const props = defineProps({ sel: { type: Object, required: true }, attributes: { type: Array, default: () => [] } })
const open = ref(false)
// Ein Attributfilter braucht einen Vergleich: „=“ ist der Anfang
watch(() => props.sel.attribute, attribute => { if (attribute && !props.sel.comparison) props.sel.comparison = '=' }, { immediate: true })
const nodeName = id => tree.byId?.get(id)?.label ?? id
const OP = { '=': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤' }
</script>

<template>
  <span class="sel">
    <button type="button" class="knoten" :class="{ leer: !props.sel.node }" :title="$t('Knoten wählen: ein Produkt, eine Variante oder eine Gruppe mit allem darunter')" @click="open = !open">{{ props.sel.node ? nodeName(props.sel.node) : $t('jedes Teil') }}</button>
    <button v-if="props.sel.node" type="button" class="x" :title="$t('Knoten entfernen')" @click="props.sel.node = ''">✕</button>
    <select v-model="props.sel.attribute" class="attr" :title="$t('Nur Teile, deren Attribut so ist')">
      <option value="">{{ $t('— kein Filter —') }}</option>
      <option v-for="a in props.attributes" :key="a.key" :value="a.key">{{ a.label }}</option>
    </select>
    <template v-if="props.sel.attribute">
      <select v-model="props.sel.comparison" class="cmp"><option v-for="c in COMPARISONS" :key="c" :value="c">{{ OP[c] }}</option></select>
      <input v-model="props.sel.value" class="wert" :placeholder="$t('Wert')" />
    </template>
    <TreePicker v-if="open" v-model="props.sel.node" :roles="['group', 'product', 'variant']" :height="180" @pick="open = false" />
  </span>
</template>

<style scoped>
.sel { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.knoten { border: 1px solid var(--line); background: var(--pane); color: var(--text); padding: 1px 6px; cursor: pointer; border-radius: 3px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.knoten.leer { color: var(--muted); }
.x { border: 0; background: none; color: var(--muted); padding: 0 4px; cursor: pointer; }
.x:hover { color: var(--neg); }
.attr { max-width: 160px; }
.cmp { width: 52px; }
.wert { width: 80px; }
</style>
