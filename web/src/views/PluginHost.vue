<script setup>
// Rahmen für die Ansicht eines Browser-Plugins: entweder eine Vue-Komponente (gebautes Plugin, component) — sie wird
// direkt gezeichnet, mit Router, Dialogen, allem — oder ein Fenster, in das das Plugin selbst zeichnet (mount).
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { plugins } from '../plugins.js'
import { tree } from '../tree.js'

const route = useRoute()
const el = ref(null)
let unmount = null
const view = computed(() => plugins.loaded ? plugins.views.find(x => x.key === route.params.key && x.path === route.params.path) ?? null : null)
const comp = computed(() => view.value?.component ?? null)
const ctx = computed(() => view.value ? { ...plugins.ctx(view.value.key), tree } : null)
// nur Komponenten, die eine Eigenschaft ctx erklären, bekommen sie (sonst landet sie als Attribut am Wurzelelement)
const wantsCtx = computed(() => { const p = comp.value?.props; return Array.isArray(p) ? p.includes('ctx') : !!p?.ctx })
async function show() {
  if (unmount) { try { unmount() } catch {} unmount = null }
  if (!plugins.loaded) await plugins.load()
  const v = view.value
  if (!v || v.component || !el.value) return
  el.value.innerHTML = ''
  const r = await v.mount(el.value, ctx.value)
  if (typeof r === 'function') unmount = r
}
onMounted(show)
watch(() => route.fullPath, show)
onUnmounted(() => { if (unmount) { try { unmount() } catch {} } })
</script>

<template>
  <component v-if="comp" :is="comp" :key="route.params.key + '/' + route.params.path" v-bind="wantsCtx ? { ctx } : {}" />
  <div v-else class="pane" style="flex:1">
    <div ref="el" class="scroll" style="padding:8px"></div>
  </div>
</template>
