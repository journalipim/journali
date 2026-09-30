<script setup>
// Eine Zelle mit Inline-Bearbeitung. Tab fokussiert; Klick öffnet mit dem Cursor
// am Ende, Enter/F2 mit dem bisherigen Wert vorselektiert, Tippen hängt an den
// bisherigen Wert an (überschreibt nie). Enter speichert, Esc
// verwirft, Tab speichert und springt weiter.
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import AiBar from './AiBar.vue'
import { store } from '../store.js'
import { dialog } from '../dialog.js'
import { describe } from '../transform.js'
import { findeZyklus, resolveWert } from '../compliance-core.js'
import { t as t_, L } from '../i18n.js'

const isUrl = s => /^https?:\/\//i.test(String(s ?? ''))
const props = defineProps({
  value: String,          // eigener Wert auf dieser Achse (null = keiner)
  inherited: String,      // was ohne eigenen Wert gilt (Fallback)
  disabled: Boolean,      // Achse gibt es für dieses Attribut nicht
  origin: String,         // woher der geerbte Wert kommt (Anzeige im Tooltip)
  mark: String,           // kleines Zeichen rechts in der Zelle (⟳ = Übersetzung zu überarbeiten)
  markTitle: String,
  markClick: Function,    // Klick auf das Zeichen (◌ = Master-Text als eigene Übersetzung übernehmen)
  source: Object,         // Beleg am Wert (ValueSourced): { source, title, note, method, checkedAt, actor, stale } — ↗ in der Zelle, Klick öffnet die URL
  clickEdit: { type: Boolean, default: true },   // false (Tabelle): Klick markiert nur, Doppelklick bearbeitet
  node: String, locale: String, label: String,    // für ✦ KI im grossen Editor
  suggest: Array,         // Ergänzung beim Tippen wie in Excel: Werte, die es in der Spalte schon gibt; der Rest steht markiert, Enter nimmt ihn
  formel: Boolean,        // Tippen von f: (oder Bearbeiten eines Werts f:[…]) öffnet den Editor der Umwandlungskette
  formelAttribut: String, // Schlüssel des Attributs (für den Kreis-Schutz und die Auswahl)
  formelWerte: Function,  // liefert { Attribut: Wert } an diesem Knoten (Vorschau und Kreis-Schutz)
})
const emit = defineEmits(['save'])

const editing = ref(false)
const openMode = ref('edit')
// Langer Text: Enter/F2/Doppelklick öffnet einen grossen Editor statt der einzeiligen Eingabe
const big = ref(false)
const area = ref(null)
const panelId = 'aip-' + Math.random().toString(36).slice(2, 8)   // Behälter für die KI-Leiste in diesem Editor
const isLong = v => (v ?? '').length > 80 || (v ?? '').includes('\n')
async function openBig() {
  draft.value = props.value ?? props.inherited ?? ''
  big.value = true; await nextTick(); area.value?.focus()
}
function saveBig() {
  big.value = false
  if (draft.value !== (props.value ?? '') || (draft.value === '' && props.value == null && props.inherited != null)) emit('save', draft.value)
  nextTick(() => box.value?.focus())
}
// Ergebnis der KI: ersetzen oder an der Schreibmarke ergänzen
function fromAi({ text, mode }) {
  const t = area.value
  if (mode === 'insert' && t) { const i = t.selectionStart ?? draft.value.length, j = t.selectionEnd ?? i; draft.value = draft.value.slice(0, i) + text + draft.value.slice(j); return }
  draft.value = text
}
// Esc und Strg+Enter gelten im offenen grossen Editor, egal wo der Fokus steht
function onWinKey(e) {
  if (!big.value) return
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelBig() }
  else if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); e.stopPropagation(); saveBig() }
}
watch(big, v => v ? window.addEventListener('keydown', onWinKey, true) : window.removeEventListener('keydown', onWinKey, true))
onUnmounted(() => window.removeEventListener('keydown', onWinKey, true))
function cancelBig() { big.value = false; nextTick(() => box.value?.focus()) }
function onBigKey(e) {
  if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); saveBig() }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelBig() }
}
const draft = ref('')
const input = ref(null)
const box = ref(null)

// mode: 'select' = alles vorselektiert (Enter/F2), 'end' = Cursor ans Ende (Klick), sonst = getippte Taste anhängen
async function open(mode) {
  if (props.disabled) return
  if (props.formel && (mode === 'select' || mode === 'end') && String(props.value ?? '').startsWith('f:')) return openFormel(props.value)
  if ((mode === 'select' || mode === 'end') && isLong(props.value ?? props.inherited)) return openBig()
  const cur = props.value ?? ''
  // getipptes Zeichen: Knotenansicht hängt an, Tabelle (clickEdit=false) ersetzt wie Excel
  draft.value = mode === 'select' || mode === 'end' ? cur : (props.clickEdit ? cur + mode : mode)
  if (props.formel && draft.value === 'f:') return openFormel('')
  openMode.value = mode === 'select' || mode === 'end' ? 'edit' : 'typed'   // Excel: Bearbeiten- vs. Eingeben-Modus
  editing.value = true
  await nextTick()
  input.value?.focus()
  if (mode === 'select') input.value?.select()
  else { input.value?.setSelectionRange(draft.value.length, draft.value.length); if (openMode.value === 'typed') complete() }
}
// Ergänzen: der erste Vorschlag, der mit dem Getippten beginnt (Gross/Klein egal) — der Rest wird markiert, Tippen ersetzt ihn weiter
function complete() {
  const el = input.value; const typed = draft.value; if (!el || !typed || !props.suggest?.length) return
  if (el.selectionStart !== typed.length) return
  const q = typed.toLowerCase()
  const hit = props.suggest.find(s => s.length > typed.length && s.toLowerCase().startsWith(q))
  if (!hit) return
  draft.value = typed + hit.slice(typed.length)
  nextTick(() => el.setSelectionRange(typed.length, draft.value.length))
}
function onInput(e) {
  if (props.formel && draft.value === 'f:') { editing.value = false; return openFormel('') }
  if (props.suggest?.length && e.inputType?.startsWith('insert')) complete()
}

// Umwandlungskette (ƒ): der Wert ist 'f:' + JSON der Schritte; der Editor ist derselbe wie in der Prüfansicht
// In der Zelle steht das Ergebnis der Kette (mit den Werten dieses Knotens); ist es leer, ihre Beschreibung
const kettenText = v => {
  if (!props.formel || typeof v !== 'string' || !v.startsWith('f:')) return null
  let s; try { s = JSON.parse(v.slice(2)) } catch { return null }
  if (!Array.isArray(s)) return null
  let ergebnis = ''
  try { const w = props.formelWerte?.() ?? {}; ergebnis = resolveWert(v, Object.fromEntries(Object.entries(w).map(([k, x]) => [k, { value: x }]))) ?? '' } catch { /* Beschreibung */ }
  return ergebnis || describe(s) || t_('Kette')
}
const kette = computed(() => kettenText(props.value))
const ketteGeerbt = computed(() => props.value == null ? kettenText(props.inherited) : null)
async function openFormel(wert) {
  let schritte = []
  if (wert) { try { const s = JSON.parse(String(wert).slice(2)); if (Array.isArray(s)) schritte = s } catch { /* ungültig: leer beginnen */ } }
  const werte = props.formelWerte?.() ?? {}
  const attribute = (store.model?.attributes ?? []).filter(a => a.key !== props.formelAttribut && !['rows', 'formula', 'template'].includes(a.type)).map(a => ({ key: a.key, label: L(a.label) }))
  const start = schritte.length ? schritte : [{ op: 'static', text: '' }]   // ein Textfeld, in das {attribut} gehört
  const roh = await dialog.steps({ title: t_('Umwandlung für {0}', [props.label ?? '']), text: t_('Die Vorschau rechnet mit den Werten dieses Knotens; die Kette wird als Attributwert gespeichert.'), value: start, attributes: attribute, values: werte, ok: t_('Übernehmen') })
  nextTick(() => box.value?.focus())
  if (roh == null) return
  const neu = roh.length === 1 && roh[0].op === 'static' && !roh[0].text ? [] : roh
  const v = neu.length ? 'f:' + JSON.stringify(neu) : ''
  if (v && props.formelAttribut && findeZyklus(v, props.formelAttribut, Object.fromEntries(Object.entries(werte).map(([k, x]) => [k, { value: x }])))) {
    store.toast(t_('Die Umwandlung liest {0} selbst — ein Kreis, nicht gespeichert.', [props.formelAttribut])); return
  }
  if (v !== (props.value ?? '')) emit('save', v)
}

function commit() {
  if (!editing.value) return   // blur nach Enter kommt ein zweites Mal
  const v = draft.value
  editing.value = false
  // Leer über einem geerbten Wert heisst „hier gilt nichts“ und geht hinaus, obwohl der eigene Wert schon leer war
  // (27.09.2026: gemeldet als „wird nicht gespeichert“)
  if (v !== (props.value ?? '') || (v === '' && props.value == null && props.inherited != null)) emit('save', v)
}

function cancel() { editing.value = false }

function onKey(e) {
  if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); open('select') }
  else if (e.key === 'Delete' && props.value != null) { emit('save', '') }
  else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); open(e.key) }
}

function onEditKey(e) {
  if (e.key === 'Enter') { e.preventDefault(); commit(); nextTick(() => box.value?.focus()) }
  else if (e.key === 'Escape') { e.preventDefault(); cancel() }
  else if (e.key === 'Tab') { commit() }   // Fokus wandert von selbst weiter
}
</script>

<template>
  <td class="cell">
    <div v-if="!editing" ref="box" class="cell-box" :class="{ inherited: !disabled && value == null && inherited != null, disabled }"
      :tabindex="disabled ? undefined : 0" @click="clickEdit && open('end')" @dblclick="clickEdit || open('end')" @keydown="onKey" :title="disabled ? $t('Achse gibt es hier nicht') : (value == null && inherited != null ? 'geerbt' + (origin ? ' von ' + origin : '') + ' ' + $t('— Enter überschreibt') : '')">
      <template v-if="disabled"></template>
      <template v-else-if="value != null">{{ kette != null ? 'ƒ ' + kette : value }}</template>
      <template v-else-if="inherited != null">{{ ketteGeerbt != null ? 'ƒ ' + ketteGeerbt : inherited }}</template>
      <span v-if="mark && !disabled" class="mark" :class="{ btn: !!markClick }" :title="markTitle" @click.stop="markClick && markClick()" @mousedown.stop>{{ mark }}</span>
      <a v-if="source && !disabled && value != null" class="src" :class="{ stale: source.stale, link: isUrl(source.source) }" :href="isUrl(source.source) ? source.source : null" target="_blank" rel="noopener" @mousedown.stop @click.stop="isUrl(source.source) || $event.preventDefault()"
        :title="(source.stale ? $t('Beleg veraltet — der Wert wurde danach geändert ·') + ' ' : '') + $t('Quelle:') + ' ' + source.source + (source.title ? ' — ' + source.title : '') + ' · ' + ({ web: $t('Recherche'), ai: 'KI', rule: $t('Regel'), import: $t('Import'), manual: $t('von Hand'), pending: '⏳ angefragt' }[source.method] ?? source.method) + ' ' + $t('· geprüft') + ' ' + source.checkedAt + ' · ' + source.actor + (source.note ? ' · ' + source.note : '')">↗</a>
    </div>
    <!-- Das Eingabefeld ersetzt die Box mit denselben Massen — nicht darin, sonst doppelter Rahmen und unten abgeschnitten. -->
    <input v-else ref="input" v-model="draft" class="cell-input" :data-mode="openMode" @keydown="onEditKey" @input="onInput" @blur="commit" />
    <Teleport to="body">
      <div v-if="big" class="overlay">
        <div class="big">
          <textarea ref="area" v-model="draft" @keydown="onBigKey" spellcheck="false"></textarea>
          <div :id="panelId"></div>
          <div class="toolbar"><span class="muted" style="font-size:12px">{{ $t("{0} Zeichen · Strg+Enter speichert · Esc verwirft", [draft.length]) }}</span><span class="grow" /><AiBar :panel="'#' + panelId" :current="draft" :html="false" :label="label" :locale="locale" :node="node" @result="fromAi" /><button @click="cancelBig">{{ $t("Verwerfen") }}</button><button class="primary" @click="saveBig">{{ $t("Speichern") }}</button></div>
        </div>
      </div>
    </Teleport>
  </td>
</template>

<style scoped>
.cell-box { position: relative; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: grid; place-items: center; z-index: 20; }
.big { width: min(720px, 90vw); background: var(--pane); border: 1px solid var(--line); border-radius: 6px; display: flex; flex-direction: column; overflow: hidden; }
.big textarea { min-height: 260px; resize: vertical; border: 0; background: var(--cell); color: var(--text); font: inherit; padding: 10px; outline: none; }
.big .toolbar { border-top: 1px solid var(--line); }
.mark { position: absolute; right: 6px; top: 2px; color: var(--warn); font-size: 12px; }
.mark.btn { cursor: pointer; padding: 0 3px; border-radius: 3px; }
.mark.btn:hover { background: var(--accent-soft); color: var(--accent); }
.src { position: absolute; right: 6px; bottom: 1px; font-size: 11px; color: var(--muted); text-decoration: none; }
.src.link:hover { color: var(--accent); }
.src.stale { color: var(--warn); }
</style>
