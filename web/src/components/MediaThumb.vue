<script>
// modulweit: dieselbe Vorschau nicht in zwei Kacheln zugleich rechnen
const pending = new Map()
</script>

<script setup>
// Vorschaubild eines Mediums: GET /api/media/{id}/thumb — die Vorschau oder die kleinste Ableitung des Jobs derive. Gibt es beides
// noch nicht, rechnet dieser Browser sie aus dem Original (Canvas, längste Seite 256 px, WebP) und legt sie per PUT im Store ab —
// aber nur bei Bildern bis 8 MB und eins nach dem anderen (vorschau.js); grössere zeigen ▤, bis der Job sie gerechnet hat.
// Nur bei Bildern: ein PDF kann der Browser nicht in ein <img> laden. Fehlt sie dort noch, bleibt es beim Symbol, statt in jeder Kachel zu scheitern.
import { ref, watch } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { t } from '../i18n.js'
import { darfRechnen, einzeln } from '../vorschau.js'

const props = defineProps({ id: String, size: { type: Number, default: 256 }, self: { type: Boolean, default: true } })
const src = ref('')
const failed = ref(false)
const wartet = ref(false)   // zu gross für den Browser: die Vorschau kommt vom Job

function load() {
  failed.value = false; wartet.value = false
  src.value = `/api/media/${props.id}/thumb`
}
async function make() {
  if (pending.has(props.id)) { await pending.get(props.id); src.value = `/api/media/${props.id}/thumb?v=1`; return }
  // erst fragen, ob der Browser das darf (Grösse) — dann erst in die Warteschlange
  const medium = await api.get(`/api/media/${encodeURIComponent(props.id)}`).catch(() => null)
  if (!darfRechnen(medium)) { wartet.value = true; return }
  const job = einzeln(async () => {
    const img = new Image(); img.decoding = 'async'
    // mit Zeitgrenze: ein Bild, das nie lädt, hielte sonst die Warteschlange für alle anderen Kacheln an
    await new Promise((ok, no) => { const zeit = setTimeout(() => no(new Error('Zeit')), 30_000); img.onload = () => { clearTimeout(zeit); ok() }; img.onerror = e => { clearTimeout(zeit); no(e) }; img.src = `/api/media/${props.id}/file` })
    const k = Math.min(1, props.size / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k))
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    const blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.82))
    if (!blob) throw new Error(t('keine Vorschau'))
    const r = await fetch(`/api/media/${props.id}/thumb`, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/webp', 'X-Actor': store.actor || 'anonym' } })
    if (!r.ok) throw new Error(t('Vorschau ablegen: {0}', [r.status]))
  })
  pending.set(props.id, job)
  try { await job; if (!wartet.value) src.value = `/api/media/${props.id}/thumb?v=1` }
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
  <div v-if="wartet" class="doc" :title="$t('Noch keine Vorschau — der Job „Vorschauen rechnen“ rechnet sie')">▤</div>
  <img v-else-if="!failed" :src="src" loading="lazy" alt="" @error="onError" />
  <div v-else-if="self" class="doc neg" :title="$t('Datei fehlt im Medienspeicher — Ursprung oder Kopierlauf (docs/betrieb.md)')">✗</div>
  <div v-else class="doc" :title="$t('Noch keine Vorschau — der Job „Vorschauen rechnen“ rechnet die erste Seite')">▤</div>
</template>
