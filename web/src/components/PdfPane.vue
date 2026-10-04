<script setup>
// Das Datenblatt daneben (29.09.2026, pflegestruktur 34). Das PDF verkleinert; ein Klick auf ein ermitteltes Attribut
// springt zur Seite und markiert die Fundstelle. Rendern und Textlagen kommen von pdf.js im Browser — die echten
// Glyph-Positionen, dieselben Koordinaten wie beim Lesen (Plugin docs). WELCHE Stücke der Kasten umfasst, sagt
// pdf-locate (rein, geprüft). pdf.js wird verzögert geladen; im Test ist die Komponente gestubbt, es lädt also nie.
// Zoom (30.09.2026): CSS-Transform auf dem Inhalt, nicht neu rendern — schnell, der Zoomlevel bleibt beim Attributwechsel.
// Speicher (04.10.2026): vorher wurde jede Seite auf eine eigene Zeichenfläche gezeichnet und nie freigegeben — ein Katalog mit 800 Seiten
// brauchte über 1 GB. Gezeichnet werden nur Seiten nahe dem sichtbaren Bereich (IntersectionObserver), ferne geben ihre Fläche frei;
// die Textlage einer Seite kommt erst, wenn sie gebraucht wird (Markierung, Suche).
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { t as t_ } from '../i18n.js'
import { findeSpanne, findeAlleSpannen, kastenAus } from '../pdf-locate.js'

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
const zoom = ref(1)             // 1 = an die Spaltenbreite angepasst; > 1 vergrössert
const tech = new Map()          // num -> { page, viewport, scale, pdfjs, items } — nicht reaktiv (keine pdf.js-Objekte proxen)
const canvasRefs = {}
const gezeichnet = new Set()     // Seiten, deren Fläche gerade ein Bild trägt
let beobachter = null
let pdfDoc = null
let laufId = 0
let basisBreite = 400           // die Breite, auf die das PDF bei zoom=1 passt

const suchtext = ref('')
const treffer = ref([])          // [{ page, left, top, width, height }]
const trefferNr = ref(-1)
let suchTimer = null

function setCanvas(num, el) { if (el) canvasRefs[num] = el }

async function ladePdfjs() {
  const pdfjs = await import('pdfjs-dist')
  try { const w = await import('pdfjs-dist/build/pdf.worker.min.mjs?url'); pdfjs.GlobalWorkerOptions.workerSrc = w.default } catch { /* Worker im Bau eingebettet */ }
  return pdfjs
}

async function ladeDoc(id) {
  const meins = ++laufId
  seiten.value = []; marke.value = null; fehler.value = ''; tech.clear(); gezeichnet.clear()
  beobachter?.disconnect(); beobachter = null
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
    basisBreite = Math.max(180, (behaelter.value?.clientWidth || 400) - 20)
    const masse = []
    for (let n = 1; n <= pdfDoc.numPages; n++) {
      const page = await pdfDoc.getPage(n)
      const eins = page.getViewport({ scale: 1 })
      const scale = Math.max(0.2, Math.min(2, basisBreite / eins.width))
      const viewport = page.getViewport({ scale })
      tech.set(n, { page, viewport, scale, pdfjs, items: null })
      masse.push({ num: n, width: Math.round(viewport.width), height: Math.round(viewport.height) })
    }
    if (meins !== laufId) return
    seiten.value = masse
    await nextTick()
    beobachten(meins)
    if (meins === laufId) await springen()
  } catch (e) {
    if (meins === laufId) fehler.value = t_('PDF konnte nicht geladen werden')
  } finally {
    if (meins === laufId) laden.value = false
  }
}

/// Seiten nahe dem sichtbaren Bereich zeichnen, ferne freigeben. Ohne IntersectionObserver (Test, alter Browser): die ersten drei.
function beobachten(meins) {
  const Beob = globalThis.IntersectionObserver
  if (!Beob || !behaelter.value) { for (const s of seiten.value.slice(0, 3)) zeichne(s.num); return }
  beobachter = new Beob(eintraege => {
    if (meins !== laufId) return
    for (const e of eintraege) {
      const num = Number(e.target.dataset.num)
      if (e.isIntersecting) zeichne(num); else freigeben(num)
    }
  }, { root: behaelter.value, rootMargin: '1200px 0px' })
  for (const el of behaelter.value.querySelectorAll('.seite[data-num]')) beobachter.observe(el)
}

async function zeichne(num) {
  const t = tech.get(num), canvas = canvasRefs[num]
  if (!t || !canvas || gezeichnet.has(num)) return
  gezeichnet.add(num)
  canvas.width = t.viewport.width; canvas.height = t.viewport.height
  const ctx = canvas.getContext('2d'); if (!ctx) return
  try { await t.page.render({ canvasContext: ctx, viewport: t.viewport }).promise } catch { gezeichnet.delete(num) }
}

/// Die Fläche einer fernen Seite freigeben — der Platz bleibt (die Masse stehen am Element), das Bild kommt beim Zurückscrollen neu
function freigeben(num) {
  const canvas = canvasRefs[num]
  if (!canvas || !gezeichnet.has(num)) return
  canvas.width = 0; canvas.height = 0
  gezeichnet.delete(num)
}

/// Die Textlage einer Seite, einmal geholt und gemerkt (sie ist klein gegen das Bild)
async function textVon(num) {
  const t = tech.get(num)
  if (!t) return []
  if (t.items) return t.items
  const tc = await t.page.getTextContent()
  t.items = tc.items.filter(i => i && i.str != null).map(i => {
    const tx = t.pdfjs.Util.transform(t.viewport.transform, i.transform)
    const hoehe = Math.hypot(tx[2], tx[3]) || (i.height || 0) * t.scale
    return { str: i.str, left: tx[4], top: tx[5] - hoehe, width: (i.width || 0) * t.scale, height: hoehe }
  })
  return t.items
}

/// Zur Fundstelle springen: die Markierung soll vollständig im sichtbaren Bereich liegen. Ist sie bei der aktuellen
/// Zoomstufe grösser als der sichtbare Bereich, wird der Zoom so weit verkleinert, dass sie hineinpasst (30.09.2026).
async function springen() {
  try {
    if (!seiten.value.length) return
    const ziel = Number(props.page)
    const num = seiten.value.some(s => s.num === ziel) ? ziel : seiten.value[0].num
    await markiere(num)
    nextTick(() => {
      const box = behaelter.value
      if (!box) return
      const m = marke.value
      if (!m) {
        const seiteEl = canvasRefs[num]?.parentElement
        if (seiteEl) seiteEl.scrollIntoView({ block: 'start', behavior: 'auto' })
        return
      }
      // Passt die Markierung bei der aktuellen Zoomstufe nicht in den sichtbaren Bereich?
      const rand = 24
      const sichtH = box.clientHeight, sichtW = box.clientWidth
      if (m.height * zoom.value > sichtH - rand * 2 || m.width * zoom.value > sichtW - rand * 2) {
        const noetig = Math.min((sichtH - rand * 2) / m.height, (sichtW - rand * 2) / m.width)
        zoom.value = Math.round(Math.max(0.5, noetig) * 10) / 10
      }
      // scrollIntoView auf dem .marke-Element — der Browser rechnet CSS-Transforms korrekt ein
      requestAnimationFrame(() => {
        const markeEl = box.querySelector('.marke')
        if (markeEl) markeEl.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' })
        else { const seiteEl = canvasRefs[num]?.parentElement; seiteEl?.scrollIntoView({ block: 'start', behavior: 'auto' }) }
      })
    })
  } catch { /* die Ansicht darf nie den Dialog stören */ }
}

async function markiere(num) {
  marke.value = null
  const text = props.quote || props.value
  if (!tech.get(num) || !text) return
  const items = await textVon(num)
  if (!items.length) return
  const k = kastenAus(items, findeSpanne(items, text))
  if (k) marke.value = { page: num, ...k }
}

/// Zoom: Strg+Rad oder die Knöpfe — der Zoomlevel bleibt beim Attributwechsel erhalten (30.09.2026).
/// Beim Zoomen bleibt die Mitte des sichtbaren Bereichs an derselben Stelle im Dokument.
/// requestAnimationFrame statt nextTick, weil der Browser die Scroll-Fläche erst nach dem Layout-Pass aktualisiert.
function zoomen(delta) {
  const box = behaelter.value
  const alt = zoom.value
  const neu = Math.round(Math.max(0.5, Math.min(4, alt + delta)) * 10) / 10
  if (neu === alt) return
  if (box) {
    const mitteY = box.scrollTop + box.clientHeight / 2
    const mitteX = box.scrollLeft + box.clientWidth / 2
    const docY = mitteY / alt
    const docX = mitteX / alt
    zoom.value = neu
    requestAnimationFrame(() => {
      box.scrollTop = docY * neu - box.clientHeight / 2
      box.scrollLeft = docX * neu - box.clientWidth / 2
    })
  } else {
    zoom.value = neu
  }
}
function onWheel(e) { if (e.ctrlKey) { e.preventDefault(); zoomen(e.deltaY < 0 ? 0.2 : -0.2) } }

async function suchen() {
  treffer.value = []; trefferNr.value = -1
  const s = suchtext.value
  if (!s || s.length < 2) return
  const alle = []
  const lauf = laufId
  for (const [num] of tech) {
    const items = await textVon(num)   // je Seite einmal geholt, dann gemerkt
    if (lauf !== laufId || s !== suchtext.value) return
    if (!items.length) continue
    for (const spanne of findeAlleSpannen(items, s)) {
      const k = kastenAus(items, spanne)
      if (k) alle.push({ page: num, ...k })
    }
  }
  alle.sort((a, b) => a.page - b.page || a.top - b.top)
  treffer.value = alle
  if (alle.length) { trefferNr.value = 0; zumTreffer() }
}
function zumTreffer() {
  const t = treffer.value[trefferNr.value]
  if (!t) return
  nextTick(() => { requestAnimationFrame(() => {
    const el = behaelter.value?.querySelector('.such-treffer.aktuell')
    if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
  }) })
}
function naechsterTreffer(d = 1) {
  if (!treffer.value.length) return
  trefferNr.value = (trefferNr.value + d + treffer.value.length) % treffer.value.length
  zumTreffer()
}
function suchTaste(e) {
  if (e.key === 'Enter') { e.preventDefault(); naechsterTreffer(e.shiftKey ? -1 : 1) }
  else if (e.key === 'Escape') { suchtext.value = ''; treffer.value = []; trefferNr.value = -1 }
}
watch(suchtext, () => { clearTimeout(suchTimer); suchTimer = setTimeout(suchen, 200) })

watch(() => props.doc, id => { zoom.value = 1; suchtext.value = ''; treffer.value = []; trefferNr.value = -1; ladeDoc(id) })
watch(() => [props.page, props.quote, props.value], () => springen())
onMounted(() => ladeDoc(props.doc))
onBeforeUnmount(() => { laufId++; beobachter?.disconnect(); if (pdfDoc) { try { pdfDoc.destroy() } catch { /* egal */ } } })
</script>

<template>
  <!-- Aussen das Flex-Item (Breite/Spalte), innen der Scroll-Container: nur so scrollt scrollIntoView die PDF-Spalte
       selbst und nicht den Dialog (bewiesen), und der Dialog kollabiert nicht. -->
  <div class="pdf-pane">
    <div class="pdf-zoom-bar">
      <button class="x" @click="zoomen(-0.2)" :disabled="zoom <= 0.5" title="−">−</button>
      <span class="muted" :title="$t('Strg+Mausrad zum Zoomen')">{{ Math.round(zoom * 100) }}%</span>
      <button class="x" @click="zoomen(0.2)" :disabled="zoom >= 4" title="+">+</button>
      <button v-if="zoom !== 1" class="x muted" @click="zoom = 1" title="1:1">⌂</button>
      <span class="grow" />
      <input class="such-feld" v-model="suchtext" :placeholder="$t('Suchen')" @keydown="suchTaste" />
      <template v-if="treffer.length">
        <span class="muted such-nr">{{ (trefferNr + 1) + '/' + treffer.length }}</span>
        <button class="x" @click="naechsterTreffer(-1)" title="↑">‹</button>
        <button class="x" @click="naechsterTreffer(1)" title="↓">›</button>
      </template>
    </div>
    <div class="pdf" ref="behaelter" @wheel="onWheel">
      <div v-if="laden" class="hinweis muted">{{ $t("◌ PDF wird geladen …") }}</div>
      <div v-else-if="fehler" class="hinweis neg">{{ fehler }} · <a :href="`/api/media/${doc}/file`" target="_blank" rel="noopener">{{ $t("öffnen") }}</a></div>
      <div v-else-if="!doc" class="hinweis muted">{{ $t("Kein Dokument") }}</div>
      <div class="pdf-content" :style="{ transform: `scale(${zoom})`, transformOrigin: 'top center', width: zoom !== 1 ? basisBreite + 'px' : undefined }">
        <div v-for="s in seiten" :key="s.num" class="seite" :data-num="s.num" :style="{ width: s.width + 'px', height: s.height + 'px' }">
          <canvas :ref="el => setCanvas(s.num, el)" />
          <div v-if="marke && marke.page === s.num" class="marke" :style="{ left: marke.left + 'px', top: marke.top + 'px', width: marke.width + 'px', height: marke.height + 'px' }" />
          <template v-for="(t, ti) in (treffer.filter(t => t.page === s.num))" :key="'s' + ti">
            <div class="such-treffer" :class="{ aktuell: treffer.indexOf(t) === trefferNr }" :style="{ left: t.left + 'px', top: t.top + 'px', width: t.width + 'px', height: t.height + 'px' }" />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pdf-pane { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.pdf-zoom-bar { display: flex; align-items: center; gap: 4px; padding: 2px 8px; border-bottom: 1px solid var(--line); font-size: 12px; flex: none; }
.pdf-zoom-bar button { min-width: 22px; }
.pdf { flex: 1; min-height: 0; overflow: auto; position: relative; background: var(--panel-2, #14161a); padding: 8px; }
.pdf-content { /* kein transition — der Zoom greift sofort, damit die Scroll-Korrektur stimmt */ }
.hinweis { padding: 12px; font-size: 12px; }
.seite { position: relative; margin: 0 auto 10px; box-shadow: 0 1px 5px rgba(0,0,0,.45); }
.seite canvas { display: block; width: 100%; height: 100%; }
.marke { position: absolute; background: color-mix(in srgb, var(--accent, #e0189a) 26%, transparent); outline: 2px solid var(--accent, #e0189a); border-radius: 2px; pointer-events: none; transition: left .2s, top .2s, width .2s, height .2s; }
.such-feld { width: 100px; font-size: 12px; padding: 1px 4px; border: 1px solid var(--line); border-radius: 3px; background: var(--bg); color: var(--text); outline: none; }
.such-feld:focus { border-color: var(--accent); }
.such-nr { font-size: 11px; min-width: 32px; text-align: center; }
.such-treffer { position: absolute; background: rgba(255, 196, 0, 0.3); outline: 1px solid rgba(255, 196, 0, 0.6); border-radius: 1px; pointer-events: none; }
.such-treffer.aktuell { background: rgba(255, 140, 0, 0.45); outline: 2px solid rgba(255, 140, 0, 0.9); }
</style>
