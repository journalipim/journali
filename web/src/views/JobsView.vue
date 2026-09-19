<script setup>
// ⏱ Jobs (fest eingebaut, Taloan 19.09.2026): Rahmen wie PluginHost, die Ansicht zeichnet jobs.js (DOM)
import { ref, onMounted, onUnmounted } from 'vue'
import { plugins } from '../plugins.js'
import { tree } from '../tree.js'
import { mount } from '../jobs.js'

const el = ref(null)
let unmount = null
onMounted(async () => { const r = await mount(el.value, { ...plugins.ctx('jobs'), tree }); if (typeof r === 'function') unmount = r })
onUnmounted(() => { if (unmount) { try { unmount() } catch {} } })
</script>

<template>
  <div ref="el" class="pane" style="flex:1" />
</template>
