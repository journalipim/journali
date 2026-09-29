<script setup>
// Das Datenblatt daneben (29.09.2026, pflegestruktur 34). Das PDF verkleinert; ein Klick auf ein ermitteltes Attribut
// springt zur Seite und markiert die Fundstelle. Rendern und Textlagen kommen von pdf.js im Browser — die echten
// Glyph-Positionen, dieselben Koordinaten wie beim Lesen (Plugin docs). WELCHE Stücke der Kasten umfasst, sagt
// pdf-locate (rein, geprüft). pdf.js wird verzögert geladen; im Test ist die Komponente gestubbt, es lädt also nie.
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t as t_ } from '../i18n.js'
import { findeSpanne, kastenAus } from '../pdf-locate.js'

const props = defineProps({
  doc: { type: String, default: null },
  page: { type: [Number, null], default: null },
  quote: { type: String, default: null },
  value: { type: String, default: null },
  names: { type: Object, default: () => ({}) },
})

const seiten = ref([])          // [{ num, width, height }] — nur die Masse, reaktiv
const marke = ref(null)         // { page, left, top, width, height }
const laden = ref(false)
const fehler = ref('')
const behaelter = ref(null)
const tech = new Map()          // num -> { page, viewport, scale, pdfjs, items } — nicht reaktiv (keine pdf.js-Objekte proxen)
const canvasRefs = {}
let pdfDoc = null
let laufId = 0

function setCanvas(num, el) { if (el) canvasRefs[num] = el }

async function ladePdfjs() {
  const pdfjs = await import('pdfjs-dist')
  try { const w = await import('pdfjs-dist/build/pdf.worker.min.mjs?url'); pdfjs.GlobalWorkerOptions.workerSrc = w.default } catch { /* Worker im Bau eingebettet */ }
  return pdfjs
}

async function ladeDoc(id) {
  const meins = ++laufId
  seiten.value = []; marke.value = null; fehler.value = ''; tech.clear()
  for (const k of Object.keys(canvasRefs)) delete canvasRefs[k]
  if (pdfDoc) { try { pdfDoc.destroy() } catch { /* egal */ } pdfDoc = null }
  if (!id) return
  laden.value = true
  try {
    const pdfjs = await ladePdfjs()
    const res = await fetch(`/api/media/${encodeURIComponent(id)}/file`)
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.arrayBuffer()
    if (meins !== laufId) return
    pdfDoc = await pdfjs.getDocument({ data }).promise
    if (meins !== laufId) return
    const breite = Math.max(180, (behaelter.value?.clientWidth || 400) - 20)
    const masse = []
    for (let n = 1; n <= pdfDoc.numPages; n++) {
      const page = await pdfDoc.getPage(n)
      const eins = page.getViewport({ scale: 1 })
      const scale = Math.max(0.2, Math.min(2, breite / eins.width))
      const viewport = page.getViewport({ scale })
      tech.set(n, { page, viewport, scale, pdfjs, items: [] })
      masse.push({ num: n, width: Math.round(viewport.width), height: Math.round(viewport.height) })
    }
    if (meins !== laufId) return
    seiten.value = masse
    await nextTick()
    for (const m of masse) { if (meins !== laufId) return; await zeichne(m.num) }
    if (meins === laufId) springen()
  } catch (e) {
    if (meins === laufId) fehler.value = t_('PDF konnte nicht geladen werden')
  } finally {
    if (meins === laufId) laden.value = false
  }
}

async function zeichne(num) {
  const t = tech.get(num), canvas = canvasRefs[num]
  if (!t || !canvas) return
  canvas.width = t.viewport.width; canvas.height = t.viewport.height
  const ctx = canvas.getContext('2d'); if (!ctx) return
  await t.page.render({ canvasContext: ctx, viewport: t.viewport }).promise
  const tc = await t.page.getTextContent()
  t.items = tc.items.filter(i => i && i.str != null).map(i => {
    const tx = t.pdfjs.Util.transform(t.viewport.transform, i.transform)
    const hoehe = Math.hypot(tx[2], tx[3]) || (i.height || 0) * t.scale
    return { str: i.str, left: tx[4], top: tx[5] - hoehe, width: (i.width || 0) * t.scale, height: hoehe }
  })
}

/// Zur Seite springen und die Fundstelle markieren. Nur die PDF-Spalte scrollen (nicht scrollIntoView, das könnte
/// übergeordnete Container mitscrollen); alles gekapselt, damit ein Fehler nie in den Dialog schlägt.
function springen() {
  try {
    if (!seiten.value.length) return
    const ziel = Number(props.page)   // die Seitenzahl kann als Text kommen — sonst schlägt der Vergleich fehl und es bliebe Seite 1
    const num = seiten.value.some(s => s.num === ziel) ? ziel : seiten.value[0].num
    markiere(num)
    const seiteEl = canvasRefs[num]?.parentElement, box = behaelter.value
    if (seiteEl && box) box.scrollTop += seiteEl.getBoundingClientRect().top - box.getBoundingClientRect().top - 4
  } catch { /* die Ansicht darf nie den Dialog stören */ }
}

function markiere(num) {
  marke.value = null
  const t = tech.get(num)
  const text = props.quote || props.value
  if (!t || !t.items.length || !text) return
  const k = kastenAus(t.items, findeSpanne(t.items, text))
  if (k) marke.value = { page: num, ...k }
}

watch(() => props.doc, id => ladeDoc(id))
watch(() => [props.page, props.quote, props.value], () => springen())
onMounted(() => ladeDoc(props.doc))
onBeforeUnmount(() => { laufId++; if (pdfDoc) { try { pdfDoc.destroy() } catch { /* egal */ } } })
</script>

<template>
  <div class="pdf" ref="behaelter">
    <div v-if="laden" class="hinweis muted">{{ $t("◌ PDF wird geladen …") }}</div>
    <div v-else-if="fehler" class="hinweis neg">{{ fehler }} · <a :href="`/api/media/${doc}/file`" target="_blank" rel="noopener">{{ $t("öffnen") }}</a></div>
    <div v-else-if="!doc" class="hinweis muted">{{ $t("Kein Dokument") }}</div>
    <div v-for="s in seiten" :key="s.num" class="seite" :style="{ width: s.width + 'px', height: s.height + 'px' }">
      <canvas :ref="el => setCanvas(s.num, el)" />
      <div v-if="marke && marke.page === s.num" class="marke" :style="{ left: marke.left + 'px', top: marke.top + 'px', width: marke.width + 'px', height: marke.height + 'px' }" />
    </div>
  </div>
</template>

<style scoped>
.pdf { height: 100%; overflow: auto; background: var(--panel-2, #14161a); padding: 8px; }
.hinweis { padding: 12px; font-size: 12px; }
.seite { position: relative; margin: 0 auto 10px; box-shadow: 0 1px 5px rgba(0,0,0,.45); }
.seite canvas { display: block; width: 100%; height: 100%; }
.marke { position: absolute; background: color-mix(in srgb, var(--accent, #e0189a) 26%, transparent); outline: 2px solid var(--accent, #e0189a); border-radius: 2px; pointer-events: none; transition: left .2s, top .2s, width .2s, height .2s; }
</style>
