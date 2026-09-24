<script>
// modulweit: dieselbe Vorschau nicht in zwei Kacheln zugleich rechnen
const pending = new Map()
</script>

<script setup>
// Vorschaubild eines Mediums (Taloan, 19.09.2026: die Kacheln luden 189 Originale): GET /api/media/{id}/thumb — gibt es
// noch keine Vorschau, rechnet dieser Browser sie aus dem Original (Canvas, längste Seite 256 px, WebP) und legt sie
// per PUT im Store ab; ab dann kommt sie fertig. Kein Bildpaket im Server nötig — die Arbeit macht der erste Betrachter.
// Nur bei Bildern: ein PDF kann der Browser nicht in ein <img> laden (Taloan, 23.09.2026 — die erste Seite rechnet der
// Job „Werkzeug: Vorschauen rechnen“). Fehlt sie dort noch, bleibt es beim Symbol, statt in jeder Kachel zu scheitern.
import { ref, watch } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { t } from '../i18n.js'

const props = defineProps({ id: String, size: { type: Number, default: 256 }, self: { type: Boolean, default: true } })
const src = ref('')
const failed = ref(false)

function load() {
  failed.value = false
  src.value = `/api/media/${props.id}/thumb`
}
async function make() {
  if (pending.has(props.id)) { await pending.get(props.id); src.value = `/api/media/${props.id}/thumb?v=1`; return }
  const job = (async () => {
    const img = new Image(); img.decoding = 'async'
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = `/api/media/${props.id}/file` })
    const k = Math.min(1, props.size / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k))
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.82))
    if (!blob) throw new Error(t('keine Vorschau'))
    const r = await fetch(`/api/media/${props.id}/thumb`, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/webp', 'X-Actor': store.actor || 'anonym' } })
    if (!r.ok) throw new Error(t('Vorschau ablegen: {0}', [r.status]))
  })()
  pending.set(props.id, job)
  try { await job; src.value = `/api/media/${props.id}/thumb?v=1` }
  catch { failed.value = true }
  finally { pending.delete(props.id) }
}
function onError() {
  // 404 = noch keine Vorschau → rechnen; schlägt auch das Original fehl (Bytes fehlen im Store) → ✗
  if (src.value.includes('?v=1') || failed.value || !props.self) { failed.value = true; return }
  make()
}
watch(() => props.id, load, { immediate: true })
</script>

<template>
  <img v-if="!failed" :src="src" loading="lazy" alt="" @error="onError" />
  <div v-else-if="self" class="doc neg" :title="$t('Datei fehlt im Medienspeicher — Ursprung oder Kopierlauf (docs/betrieb.md)')">✗</div>
  <div v-else class="doc" :title="$t('Noch keine Vorschau — der Job „Werkzeug: Vorschauen rechnen“ rechnet die erste Seite')">▤</div>
</template>
