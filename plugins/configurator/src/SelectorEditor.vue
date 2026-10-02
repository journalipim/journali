<script setup>
// Ein Selektor: welche Teile gemeint sind — ein Knoten (Produkt, Gruppe oder Variante, sein ganzer Teilbaum), ein Attributfilter, oder beides.
// Kompakt (in einem Satz): nur der Knoten; der Filter steht hinter „Filter“ bereit. Der Auswahlbaum schwebt über der Zeile, er schiebt nichts weg.
// Die Komponente ändert das übergebene Objekt (sel) selbst; der Besitzer speichert es mit der Definition.
import { ref, watch } from 'vue'
import { tree, TreePicker } from 'journali'
import { COMPARISONS } from './model.js'

const props = defineProps({ sel: { type: Object, required: true }, attributes: { type: Array, default: () => [] }, compact: { type: Boolean, default: false } })
const open = ref(false)
const filterOpen = ref(!!props.sel.attribute)
// Ein Attributfilter braucht einen Vergleich: „=“ ist der Anfang
watch(() => props.sel.attribute, attribute => { if (attribute && !props.sel.comparison) props.sel.comparison = '='; if (attribute) filterOpen.value = true }, { immediate: true })
const nodeName = id => tree.byId?.get(id)?.label ?? id
const OP = { '=': '=', '!=': '≠', '>': '>', '>=': '≥', '<': '<', '<=': '≤' }
const showFilter = () => !props.compact || filterOpen.value
</script>

<template>
  <span class="sel">
    <span class="wahl">
      <button type="button" class="knoten" :class="{ leer: !props.sel.node }" :title="$t('Knoten wählen: ein Produkt, eine Variante oder eine Gruppe mit allem darunter')" @click="open = !open">{{ props.sel.node ? nodeName(props.sel.node) : $t('Teil wählen …') }}</button>
      <button v-if="props.sel.node" type="button" class="x" :title="$t('Knoten entfernen')" @click="props.sel.node = ''">✕</button>
      <div v-if="open" class="popover"><TreePicker v-model="props.sel.node" :roles="['group', 'product', 'variant']" :height="200" @pick="open = false" /></div>
    </span>
    <button v-if="compact && !filterOpen" type="button" class="filter" :title="$t('Nur Teile, deren Attribut einen bestimmten Wert hat — etwa Leistung ≥ 850')" @click="filterOpen = true">＋ {{ $t('Filter') }}</button>
    <template v-if="showFilter()">
      <select v-model="props.sel.attribute" class="attr" :title="$t('Nur Teile, deren Attribut so ist')">
        <option value="">{{ $t('— kein Filter —') }}</option>
        <option v-for="a in props.attributes" :key="a.key" :value="a.key">{{ a.label }}</option>
      </select>
      <template v-if="props.sel.attribute">
        <select v-model="props.sel.comparison" class="cmp"><option v-for="c in COMPARISONS" :key="c" :value="c">{{ OP[c] }}</option></select>
        <input v-model="props.sel.value" class="wert" :placeholder="$t('Wert')" />
      </template>
    </template>
  </span>
</template>

<style scoped>
.sel { display: inline-flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.wahl { position: relative; display: inline-flex; align-items: center; gap: 2px; }
.popover { position: absolute; left: 0; top: 100%; z-index: 20; width: 340px; padding: 6px; background: var(--pane); border: 1px solid var(--line); border-radius: 6px; box-shadow: 0 6px 20px rgba(0,0,0,.35); }
.knoten { border: 1px solid var(--line); background: var(--pane); color: var(--text); padding: 1px 8px; cursor: pointer; border-radius: 3px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.knoten.leer { color: var(--accent); border-style: dashed; }
.x { border: 0; background: none; color: var(--muted); padding: 0 4px; cursor: pointer; }
.x:hover { color: var(--neg); }
.filter { border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 12px; }
.filter:hover { color: var(--accent); }
.attr { max-width: 160px; }
.cmp { width: 52px; }
.wert { width: 80px; }
</style>
