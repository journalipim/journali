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
const openState = ref(Object.fromEntries(bands.value.map(b => [b.key + ':' + b.band, localStorage.getItem(`journali.band.${b.key}.${b.band}`) !== '0'])))
const isOpen = b => openState.value[b.key + ':' + b.band] !== false
function toggle(b) { const k = b.key + ':' + b.band; openState.value[k] = !isOpen(b); localStorage.setItem(`journali.band.${b.key}.${b.band}`, isOpen(b) ? '1' : '0') }
let cleanups = []
async function show() {
  for (const c of cleanups) { try { c() } catch {} } cleanups = []
  if (!plugins.loaded) await plugins.load()
  await nextTick()
  for (const b of bands.value) {
    const k = b.key + ':' + b.band; const head = heads.value[k], body = bodies.value[k]
    if (!head) continue
    head.innerHTML = ''; if (body) body.innerHTML = ''
    try { const r = await b.mount({ head, body }, props.id, { ...plugins.ctx(b.key), tree }); if (typeof r === 'function') cleanups.push(r) }
    catch (e) { head.textContent = '✗ ' + e.message }
  }
}
onMounted(show)
watch(() => [props.id, bands.value.length], show)
onUnmounted(() => { for (const c of cleanups) { try { c() } catch {} } })
</script>

<template>
  <div v-for="b in bands" :key="b.key + ':' + b.band" class="section plugin-band">
    <!-- Band wie Workflow: Überschrift mit kurzer Zusammenfassung (head, Text), der Pfeil klappt den Körper mit der Bedienzeile auf und zu (body) -->
    <h2 @click="toggle(b)"><span class="caret">{{ isOpen(b) ? '▾' : '▸' }}</span>{{ b.icon || '⌁' }} {{ b.label }} <span class="head muted" :ref="el => { if (el) heads[b.key + ':' + b.band] = el }" /></h2>
    <div v-show="isOpen(b)" class="body" :ref="el => { if (el) bodies[b.key + ':' + b.band] = el }" />
  </div>
</template>

<style scoped>
.plugin-band { padding: 0 8px 10px; }   /* wie .section in der Knotenansicht — die scoped-Regel dort greift hier nicht (mehrere Wurzeln) */
.plugin-band h2 { font-size: 12px; margin: 0 -8px 8px; padding: 0 8px; min-height: 26px; line-height: 24px; box-sizing: border-box; color: var(--text); font-weight: 600; letter-spacing: .02em; background: var(--accent-soft); border-top: 2px solid var(--accent); cursor: pointer; user-select: none; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.plugin-band h2 .caret { display: inline-block; width: 14px; color: var(--muted); }
.plugin-band .head { font-weight: 400; }
.plugin-band .body { padding: 0 0 4px; }
/* die Zeile bleibt im sichtbaren Bereich, auch wenn die Attributtabelle den Rollbereich breiter macht */
.plugin-band .body :deep(.row) { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding: 2px 0 6px; position: sticky; left: 8px; max-width: calc(100vw - 420px); }
</style>
