<script setup>
// ✂ Zuschneiden und Ausrichten — im Browser auf einer Leinwand, so wie dieser Browser schon die Kacheln rechnet.
// Ein Medium ist unveränderlich: das Ergebnis ist ein NEUES Medium mit Abstammung (MediaSourced.from = das
// Original). Wahlweise ersetzt es das Original gleich als neue Fassung (Block F) — dann wandern die Zuordnungen.
//
// Zwei Drehungen, weil sie zwei Dinge sind: ⟲ ⟳ in Vierteln (ein quer stehendes Foto), und ein feiner Winkel
// zum Ausrichten (ein schiefer Scan, ±15°). Der Ausschnitt gilt im GEDREHTEN Bild, in Pixeln des Originals —
// gerechnet wird in voller Auflösung, die Vorschau ist nur verkleinert.
// props: medium = { id, name, mime, supersededBy? }; emits done({ neu, fassung }) und close
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'
import { t as t_ } from '../i18n.js'

const props = defineProps({ medium: { type: Object, required: true } })
const emit = defineEmits(['done', 'close'])

const img = ref(null)              // das geladene Original
const fehler = ref('')
const quarter = ref(0)             // Viertel: 0..3 → 0°, 90°, 180°, 270°
const angle = ref(0)               // fein: −15 … +15
const crop = ref({ x: 0, y: 0, w: 0, h: 0 })   // im gedrehten Bild, Pixel des Originals
const busy = ref('')
const preview = ref(null)          // die Leinwand der Vorschau
const MAX = { w: 720, h: 480 }

/// Gesamtdrehung in Grad und Bogenmass
const grad = computed(() => quarter.value * 90 + angle.value)
const rad = computed(() => grad.value * Math.PI / 180)

/// Mass des gedrehten Bildes: ein gedrehtes Rechteck braucht einen grösseren Rahmen — |w cos| + |h sin| usw.
function gedreht(w, h, r) {
  const c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r))
  return { w: Math.max(1, Math.round(w * c + h * s)), h: Math.max(1, Math.round(w * s + h * c)) }
}
const rahmen = computed(() => img.value ? gedreht(img.value.naturalWidth, img.value.naturalHeight, rad.value) : { w: 0, h: 0 })
/// Massstab der Vorschau: eingepasst, nie vergrössert
const k = computed(() => rahmen.value.w ? Math.min(1, MAX.w / rahmen.value.w, MAX.h / rahmen.value.h) : 1)

/// Das gedrehte Bild in voller Auflösung auf eine Leinwand zeichnen
function drehen() {
  const c = document.createElement('canvas'); c.width = rahmen.value.w; c.height = rahmen.value.h
  const g = c.getContext('2d')
  if (g) { g.translate(c.width / 2, c.height / 2); g.rotate(rad.value); g.drawImage(img.value, -img.value.naturalWidth / 2, -img.value.naturalHeight / 2) }
  return c
}

/// Den Ausschnitt in die Grenzen holen — ganze Pixel, nie leer, nie ausserhalb
function begrenzen() {
  const R = rahmen.value, z = crop.value
  const x = Math.min(Math.max(0, Math.round(z.x)), Math.max(0, R.w - 1)), y = Math.min(Math.max(0, Math.round(z.y)), Math.max(0, R.h - 1))
  crop.value = { x, y, w: Math.max(1, Math.min(Math.round(z.w), R.w - x)), h: Math.max(1, Math.min(Math.round(z.h), R.h - y)) }
}
const ganz = () => { crop.value = { x: 0, y: 0, w: rahmen.value.w, h: rahmen.value.h } }

function zeichnen() {
  const c = preview.value; if (!c || !img.value) return
  c.width = Math.max(1, Math.round(rahmen.value.w * k.value)); c.height = Math.max(1, Math.round(rahmen.value.h * k.value))
  const g = c.getContext('2d'); if (!g) return
  g.drawImage(drehen(), 0, 0, c.width, c.height)
  // ausserhalb des Ausschnitts abdunkeln, den Rand ziehen
  const z = crop.value, s = k.value
  g.fillStyle = 'rgba(0,0,0,.45)'
  g.fillRect(0, 0, c.width, z.y * s); g.fillRect(0, (z.y + z.h) * s, c.width, c.height)
  g.fillRect(0, z.y * s, z.x * s, z.h * s); g.fillRect((z.x + z.w) * s, z.y * s, c.width, z.h * s)
  g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(z.x * s + .5, z.y * s + .5, z.w * s, z.h * s)
}

// Ziehen auf der Vorschau zeichnet einen neuen Ausschnitt
let start = null
function pos(e) { const r = preview.value.getBoundingClientRect(); return { x: (e.clientX - r.left) / k.value, y: (e.clientY - r.top) / k.value } }
function down(e) { start = pos(e); crop.value = { x: start.x, y: start.y, w: 1, h: 1 } }
function move(e) {
  if (!start) return
  const p = pos(e)
  crop.value = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }
  begrenzen(); zeichnen()
}
function up() { if (!start) return; start = null; if (crop.value.w < 4 || crop.value.h < 4) ganz(); begrenzen(); zeichnen() }

function dreh(n) { quarter.value = (quarter.value + n + 4) % 4; ganz(); zeichnen() }
watch(angle, () => { begrenzen(); zeichnen() })
watch(crop, () => zeichnen(), { deep: true })

/// Ausgabeformat: was das Original war, wenn der Browser es schreiben kann — sonst PNG
const format = computed(() => /^image\/(jpeg|png|webp)$/.test(props.medium.mime) ? props.medium.mime : 'image/png')
const name = computed(() => (props.medium.name || 'bild').replace(/\.[^.]+$/, '') + '-zuschnitt.' + format.value.split('/')[1].replace('jpeg', 'jpg'))

/// Rechnen, hochladen — und wahlweise das Original ersetzen
async function uebernehmen(alsFassung) {
  if (!store.actor) { store.toast(t_('👤 Name fehlt → Einstellungen')); return }
  busy.value = t_('rechne …')
  try {
    begrenzen()
    const z = crop.value
    const c = document.createElement('canvas'); c.width = z.w; c.height = z.h
    const g = c.getContext('2d')
    if (g) g.drawImage(drehen(), z.x, z.y, z.w, z.h, 0, 0, z.w, z.h)
    const blob = await new Promise(r => c.toBlob(r, format.value, 0.92))
    if (!blob) throw new Error(t_('Der Browser konnte das Bild nicht schreiben.'))
    busy.value = t_('lade hoch …')
    const neu = await api.upload('/api/media', new File([blob], name.value, { type: format.value }), { from: props.medium.id })
    if (alsFassung && neu.id !== props.medium.id) await api.post(`/api/media/${props.medium.id}/supersede`, { by: neu.id })
    emit('done', { neu, fassung: alsFassung })
  } catch (e) { store.toast(e.message) }
  finally { busy.value = '' }
}

onMounted(async () => {
  const i = new Image(); i.decoding = 'async'
  try { await new Promise((ok, no) => { i.onload = ok; i.onerror = no; i.src = `/api/media/${props.medium.id}/file` }) }
  catch { fehler.value = t_('Das Original lässt sich nicht laden.'); return }
  img.value = i; ganz(); await nextTick(); zeichnen()
})
function onKey(e) { if (e.key === 'Escape') emit('close') }
// für den Prüfstand: Ausschnitt, Rahmen und die Grenzregel sind von aussen lesbar
defineExpose({ crop, rahmen, begrenzen, ganz })
</script>

<template>
  <div class="ce-overlay" @keydown="onKey" tabindex="-1">
    <div class="ce">
      <div class="toolbar"><h1>{{ '✂ ' + medium.name }}</h1>
        <span class="muted" v-if="img">{{ img.naturalWidth + ' × ' + img.naturalHeight + ' px' }}</span><span class="grow" />
        <span v-if="busy" class="muted">{{ busy }}</span>
        <button class="x" @click="emit('close')" :title="$t('schliessen (Esc)')">✕</button></div>
      <div v-if="fehler" class="empty">{{ fehler }}</div>
      <template v-else>
        <div class="ce-stage" :title="$t('ziehen: Ausschnitt wählen')">
          <canvas ref="preview" @mousedown.prevent="down" @mousemove="move" @mouseup="up" @mouseleave="up" />
        </div>
        <div class="toolbar ce-tools">
          <button class="x" @click="dreh(-1)" :title="$t('90° nach links')">⟲</button>
          <button class="x" @click="dreh(1)" :title="$t('90° nach rechts')">⟳</button>
          <label class="muted" :title="$t('Ausrichten: feiner Winkel, ±15°')">{{ $t("Winkel") }} <input type="range" min="-15" max="15" step="0.5" v-model.number="angle" /> <span class="mono">{{ angle + '°' }}</span></label>
          <span class="grow" />
          <label class="muted mono" :title="$t('Ausschnitt in Pixeln des Originals: x, y, Breite, Höhe')">
            <input type="number" v-model.number="crop.x" @change="begrenzen" class="ce-n" /> <input type="number" v-model.number="crop.y" @change="begrenzen" class="ce-n" />
            <input type="number" v-model.number="crop.w" @change="begrenzen" class="ce-n" /> <input type="number" v-model.number="crop.h" @change="begrenzen" class="ce-n" />
          </label>
          <button class="x" @click="ganz" :title="$t('den ganzen Rahmen nehmen')">◫</button>
        </div>
        <div class="toolbar">
          <span class="muted" style="font-size:12px" :title="$t('Ein Medium ist unveränderlich — das Ergebnis ist ein neues Medium mit Abstammung zum Original.')">{{ name }}</span>
          <span class="grow" />
          <button @click="uebernehmen(false)" :disabled="!img || !!busy" :title="$t('als weiteres Asset anlegen — das Original bleibt, wie es ist')">{{ $t("✓ Neues Asset") }}</button>
          <button class="primary" v-if="!medium.supersededBy" @click="uebernehmen(true)" :disabled="!img || !!busy" :title="$t('anlegen und das Original damit ersetzen — die Zuordnungen wandern mit')">{{ $t("✓ Neue Fassung") }}</button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.ce-overlay { position: fixed; inset: 0; background: #0008; display: grid; place-items: center; z-index: 50; }
.ce { width: 780px; max-width: 96vw; background: var(--pane); border: 1px solid var(--line); border-radius: 8px; }
.ce-stage { display: grid; place-items: center; background: var(--bg); min-height: 200px; padding: 8px; }
.ce-stage canvas { max-width: 100%; cursor: crosshair; }
.ce-tools { flex-wrap: wrap; gap: 8px; }
.ce-n { width: 64px; }
</style>
