<script setup>
// Bänder der Plugins in der Knotenansicht (Taloan, 22.09.2026: „die Bedienung erfolgt an anderer Stelle — beim Gegenstand“):
// Beitragspunkt nodeBands — ein Plugin zeichnet je Knoten eine Zeile (head: Zusammenfassung und Knöpfe) und, wenn es will,
// einen Körper darunter (body). Wie das Workflow-Band: Überschrift klappt den Körper auf und zu. Das Plugin bekommt denselben
// ctx wie seine Ansichten; bei Knotenwechsel wird abgebaut und neu gezeichnet.
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { plugins } from '../plugins.js'
import { tree } from '../tree.js'

const props = defineProps({ id: String, role: String })
const bands = computed(() => plugins.loaded ? plugins.nodeBands.filter(b => !b.roles || b.roles.includes(props.role)) : [])
const heads = ref({}), bodies = ref({})
const filled = ref({})   // Körper gefüllt? — erst dann gibt es den Pfeil
let observers = []
const openState = ref(Object.fromEntries(bands.value.map(b => [b.key + ':' + b.band, localStorage.getItem(`journali.band.${b.key}.${b.band}`) !== '0'])))
const isOpen = b => openState.value[b.key + ':' + b.band] !== false
function toggle(b) { const k = b.key + ':' + b.band; openState.value[k] = !isOpen(b); localStorage.setItem(`journali.band.${b.key}.${b.band}`, isOpen(b) ? '1' : '0') }
let cleanups = []
async function show() {
  for (const c of cleanups) { try { c() } catch {} } cleanups = []
  for (const o of observers) o.disconnect(); observers = []
  if (!plugins.loaded) await plugins.load()
  await nextTick()
  for (const b of bands.value) {
    const k = b.key + ':' + b.band; const head = heads.value[k], body = bodies.value[k]
    if (!head) continue
    head.innerHTML = ''; if (body) body.innerHTML = ''
    if (body) { const mo = new MutationObserver(() => { filled.value[k] = body.childNodes.length > 0; if (filled.value[k]) { openState.value[k] = true } }); mo.observe(body, { childList: true }); observers.push(mo); filled.value[k] = false }
    try { const r = await b.mount({ head, body }, props.id, { ...plugins.ctx(b.key), tree }); if (typeof r === 'function') cleanups.push(r) }
    catch (e) { head.textContent = '✗ ' + e.message }
  }
}
onMounted(show)
watch(() => [props.id, bands.value.length], show)
onUnmounted(() => { for (const c of cleanups) { try { c() } catch {} } for (const o of observers) o.disconnect() })
</script>

<template>
  <div v-for="b in bands" :key="b.key + ':' + b.band" class="section plugin-band">
    <!-- Band wie die anderen Bänder der Knotenansicht (26 px, Akzentlinie); der Pfeil erscheint erst, wenn das Plugin einen Körper gefüllt hat (Taloan, 22.09.: „was kann ich da aufklappen?“) -->
    <h2 :class="{ noBody: !filled[b.key + ':' + b.band] }" @click="filled[b.key + ':' + b.band] && toggle(b)"><span class="caret">{{ filled[b.key + ':' + b.band] ? (isOpen(b) ? '▾' : '▸') : '' }}</span>{{ b.icon || '⌁' }} {{ b.label }} <span class="head" @click.stop :ref="el => { if (el) heads[b.key + ':' + b.band] = el }" /></h2>
    <div v-show="isOpen(b)" class="body" :ref="el => { if (el) bodies[b.key + ':' + b.band] = el }" />
  </div>
</template>

<style scoped>
.plugin-band h2 { font-size: 12px; margin: 0 -8px 8px; padding: 0 8px; min-height: 26px; line-height: 24px; box-sizing: border-box; color: var(--text); font-weight: 600; letter-spacing: .02em; background: var(--accent-soft); border-top: 2px solid var(--accent); cursor: pointer; user-select: none; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.plugin-band h2.noBody { cursor: default; }
.plugin-band h2 .caret { display: inline-block; width: 14px; color: var(--muted); }
.plugin-band .head { display: inline-flex; gap: 6px; align-items: center; flex-wrap: wrap; font-weight: 400; font-size: 12px; cursor: default; }
.plugin-band .head :deep(button) { height: 20px; line-height: 18px; padding: 0 6px; font-size: 12px; }
.plugin-band .body:empty { display: none; }
</style>
