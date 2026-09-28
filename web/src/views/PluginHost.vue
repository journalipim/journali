<script setup>
// Rahmen für die Ansicht eines Browser-Plugins: entweder eine Vue-Komponente (gebautes Plugin, component) — sie wird
// direkt gezeichnet, mit Router, Dialogen, allem — oder ein Fenster, in das das Plugin selbst zeichnet (mount).
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { plugins } from '../plugins.js'
import { tree } from '../tree.js'

const route = useRoute()
const el = ref(null)
const fehler = ref('')
let unmount = null
const view = computed(() => plugins.loaded ? plugins.views.find(x => x.key === route.params.key && x.path === route.params.path) ?? null : null)
const comp = computed(() => view.value?.component ?? null)
const ctx = computed(() => view.value ? { ...plugins.ctx(view.value.key), tree } : null)
// nur Komponenten, die eine Eigenschaft ctx erklären, bekommen sie (sonst landet sie als Attribut am Wurzelelement)
const wantsCtx = computed(() => { const p = comp.value?.props; return Array.isArray(p) ? p.includes('ctx') : !!p?.ctx })
async function show() {
  if (unmount) { try { unmount() } catch {} unmount = null }
  fehler.value = ''
  if (!plugins.loaded) await plugins.load()
  const v = view.value
  if (!v || v.component || !el.value) return
  el.value.innerHTML = ''
  // Ein Fehler beim Zeichnen liess das Fenster leer — sichtbar wurde er nur in der Konsole (28.09.2026)
  try {
    const r = await v.mount(el.value, ctx.value)
    if (typeof r === 'function') unmount = r
  } catch (e) { fehler.value = `✗ ${v.key}/${v.path}: ${e.message}` }
}
onMounted(show)
// flush: 'post' — beim Wechsel von einer Vue-Ansicht auf eine mount-Ansicht steht das Fenster (el) erst nach dem
// Rendern; vorher war es null, show() brach still ab, und die Ansicht blieb leer (28.09.2026)
watch(() => route.fullPath, show, { flush: 'post' })
onUnmounted(() => { if (unmount) { try { unmount() } catch {} } })
</script>

<template>
  <component v-if="comp" :is="comp" :key="route.params.key + '/' + route.params.path" v-bind="{ ...(view.props ?? {}), ...(wantsCtx ? { ctx } : {}) }" />
  <div v-else class="pane" style="flex:1">
    <div v-if="fehler" class="fehler" style="padding:8px">{{ fehler }}</div>
    <div ref="el" class="scroll" style="padding:8px"></div>
  </div>
</template>
