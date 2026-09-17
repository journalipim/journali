<script setup>
// Rahmen für die Ansicht eines Browser-Plugins: ein Fenster, das Plugin zeichnet hinein (mount).
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { plugins } from '../plugins.js'
import { tree } from '../tree.js'

const route = useRoute()
const el = ref(null)
let unmount = null
async function show() {
  if (unmount) { try { unmount() } catch {} unmount = null }
  if (!plugins.loaded) await plugins.load()
  const v = plugins.views.find(x => x.key === route.params.key && x.path === route.params.path)
  if (!v || !el.value) return
  el.value.innerHTML = ''
  const r = await v.mount(el.value, { ...plugins.ctx(v.key), tree })
  if (typeof r === 'function') unmount = r
}
onMounted(show)
watch(() => route.fullPath, show)
onUnmounted(() => { if (unmount) { try { unmount() } catch {} } })
</script>

<template>
  <div class="pane" style="flex:1">
    <div ref="el" class="scroll" style="padding:8px"></div>
  </div>
</template>
