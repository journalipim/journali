<script setup>
// Vorschau eines Mediums (29.09.2026): Bild oder PDF gross, statt die Datei in einem neuen Tab zu öffnen. Das Fenster
// schliesst mit × oder Esc — nicht beim Klick daneben, wie jedes Fenster, in dem gearbeitet wird.
// Mehrere Medien: mit ← → durchblättern, ohne das Fenster zu schliessen.
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { store } from '../store.js'
import { t as t_ } from '../i18n.js'

const props = defineProps({
  media: { type: Array, required: true },   // [{ id, label, mime, isImage, hasThumb }]
  start: { type: String, default: null },   // Id, mit der begonnen wird
})
const emit = defineEmits(['close'])

const i = ref(Math.max(0, props.media.findIndex(m => m.id === props.start)))
const cur = computed(() => props.media[i.value] ?? null)
const mehrere = computed(() => props.media.length > 1)
const istPdf = m => (m?.mime ?? '') === 'application/pdf' || /\.pdf$/i.test(m?.label ?? '')
const istBild = m => m?.isImage === true || (m?.mime ?? '').startsWith('image/')
const darf = computed(() => store.can('download'))
const datei = m => `/api/media/${encodeURIComponent(m.id)}/file`
const link = m => `${datei(m)}?name=${encodeURIComponent(m.label ?? '')}`
const fehler = ref(false)
/// Ein PDF zeigt der Betrachter des Browsers. Steht der Browser auf „PDFs herunterladen“ oder hat das Fenster keinen
/// Betrachter, sagt er das selbst (navigator.pdfViewerEnabled) — dann steht gleich die gerechnete Seitenvorschau da,
/// statt eines Platzhalters mit Öffnen-Knopf. Der Schalter in der Leiste wechselt zwischen beidem (29.09.2026)
const pdfBetrachter = typeof navigator !== 'undefined' ? navigator.pdfViewerEnabled !== false : true
const alsBild = ref(!pdfBetrachter)
watch(cur, () => { fehler.value = false; alsBild.value = !pdfBetrachter })
const blatt = computed(() => istPdf(cur.value) && !alsBild.value)

function weiter(n) { if (!mehrere.value) return; i.value = (i.value + n + props.media.length) % props.media.length }
function onKey(e) {
  if (e.key === 'Escape') { e.stopPropagation(); emit('close') }
  else if (e.key === 'ArrowRight') weiter(1)
  else if (e.key === 'ArrowLeft') weiter(-1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="mv-overlay" v-if="cur">
    <div class="mv">
      <div class="toolbar">
        <h1 :title="`${cur.label ?? ''}\n${cur.mime ?? ''}`">{{ cur.label }}<span v-if="mehrere" class="muted">{{ ' · ' + (i + 1) + '/' + media.length }}</span></h1>
        <span class="grow" />
        <button v-if="mehrere" class="x" @click="weiter(-1)" :title="$t('vorheriges (←)')">‹</button>
        <button v-if="mehrere" class="x" @click="weiter(1)" :title="$t('nächstes (→)')">›</button>
        <button v-if="istPdf(cur) && darf" class="x" @click="alsBild = !alsBild" :title="$t('Zeigt der Betrachter das Blatt nicht, steht hier die gerechnete Seitenvorschau')">{{ alsBild ? '▤' : '▨' }}</button>
        <a v-if="darf" class="x" :href="link(cur)" target="_blank" :title="$t('Datei herunterladen')">⤓</a>
        <button class="x" @click="emit('close')" :title="$t('schliessen (Esc)')">×</button>
      </div>
      <div class="mv-body">
        <div v-if="!darf" class="leer muted">{{ $t("Kein Recht zum Herunterladen") }}</div>
        <iframe v-else-if="blatt" :src="`${datei(cur)}#view=FitH`" :title="cur.label"></iframe>
        <img v-else-if="istPdf(cur) && !fehler" class="seite" :src="`/api/media/${cur.id}/thumb`" :alt="cur.label" @error="fehler = true" />
        <div v-else-if="istPdf(cur)" class="leer muted" :title="$t('Der Job „Vorschauen rechnen“ rechnet die erste Seite')">{{ $t("Noch keine Seitenvorschau") }}</div>
        <img v-else-if="istBild(cur) && !fehler" :src="datei(cur)" :alt="cur.label" @error="fehler = true" />
        <img v-else-if="cur.hasThumb && !fehler" :src="`/api/media/${cur.id}/thumb`" :alt="cur.label" @error="fehler = true" />
        <div v-else class="leer muted">{{ $t("Keine Vorschau für {0}", [cur.mime || '?']) }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mv-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: grid; place-items: center; z-index: 60; }
.mv { width: min(1200px, 94vw); height: min(900px, 92vh); background: var(--pane); border: 1px solid var(--line); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
.mv-body { flex: 1; min-height: 0; display: grid; place-items: center; background: var(--bg); padding: 8px; }
.mv-body img { max-width: 100%; max-height: 100%; object-fit: contain; }
/* die gerechnete Seite ist klein (256 px) — sie wird nicht über ihre Grösse hinaus gezogen */
.mv-body img.seite { max-width: min(100%, 512px); image-rendering: auto; }
.mv-body iframe { width: 100%; height: 100%; border: 0; background: #fff; }
.leer { padding: 24px; }
.toolbar a.x { display: inline-flex; align-items: center; text-decoration: none; }
</style>
