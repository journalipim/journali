<script setup>
// Auswahlbaum als Vue-Baustein (Taloan): v-model = Knoten-Id; darunter dasselbe DOM wie in Plugins (treePicker.js)
import { ref, onMounted, watch } from 'vue'
import { treePicker } from '../treePicker.js'
const props = defineProps({ modelValue: [String, Array], roles: { type: Array, default: () => ['group', 'product'] }, height: { type: Number, default: 240 }, allowRoot: Boolean, multi: Boolean })
const emit = defineEmits(['update:modelValue', 'pick'])
const host = ref(null); let picker = null
onMounted(() => { picker = treePicker(host.value, { value: props.multi ? null : (props.modelValue || null), values: props.multi ? (props.modelValue ?? []) : [], multi: props.multi, roles: props.roles, height: props.height, allowRoot: props.allowRoot, onPick: r => { emit('update:modelValue', r?.id ?? ''); emit('pick', r) }, onChange: ids => emit('update:modelValue', ids) }) })
watch(() => props.modelValue, v => { if (!picker) return; if (props.multi) { if (JSON.stringify(picker.values) !== JSON.stringify(v ?? [])) picker.setValues(v ?? []) } else if (picker.value !== (v || null)) picker.set(v || null) })
</script>

<template>
  <div ref="host" class="tp-host" />
</template>
