<script setup>
// Eine Zelle mit Inline-Bearbeitung. Tab fokussiert; Klick öffnet mit dem Cursor
// am Ende, Enter/F2 mit dem bisherigen Wert vorselektiert, Tippen hängt an den
// bisherigen Wert an (überschreibt nie, Taloan 17.09.). Enter speichert, Esc
// verwirft, Tab speichert und springt weiter.
import { ref, nextTick, watch, onUnmounted } from 'vue'
import AiBar from './AiBar.vue'

const isUrl = s => /^https?:\/\//i.test(String(s ?? ''))
const props = defineProps({
  value: String,          // eigener Wert auf dieser Achse (null = keiner)
  inherited: String,      // was ohne eigenen Wert gilt (Fallback)
  disabled: Boolean,      // Achse gibt es für dieses Attribut nicht
  origin: String,         // woher der geerbte Wert kommt (Anzeige im Tooltip)
  mark: String,           // kleines Zeichen rechts in der Zelle (⟳ = Übersetzung zu überarbeiten)
  markTitle: String,
  markClick: Function,    // Klick auf das Zeichen (◌ = Master-Text als eigene Übersetzung übernehmen, Taloan 21.09.)
  source: Object,         // Beleg am Wert (ValueSourced): { source, title, note, method, checkedAt, actor, stale } — ↗ in der Zelle, Klick öffnet die URL
  clickEdit: { type: Boolean, default: true },   // false (Tabelle): Klick markiert nur, Doppelklick bearbeitet
  node: String, locale: String, label: String,    // für ✦ KI im grossen Editor
  suggest: Array,         // Ergänzung beim Tippen wie in Excel: Werte, die es in der Spalte schon gibt (Taloan, 20.09.); der Rest steht markiert, Enter nimmt ihn
})
const emit = defineEmits(['save'])

const editing = ref(false)
const openMode = ref('edit')
// Langer Text (Taloan): Enter/F2/Doppelklick öffnet einen grossen Editor statt der einzeiligen Eingabe
const big = ref(false)
const area = ref(null)
const isLong = v => (v ?? '').length > 80 || (v ?? '').includes('\n')
async function openBig() {
  draft.value = props.value ?? props.inherited ?? ''
  big.value = true; await nextTick(); area.value?.focus()
}
function saveBig() { big.value = false; if (draft.value !== (props.value ?? '')) emit('save', draft.value); nextTick(() => box.value?.focus()) }
// Ergebnis der KI: ersetzen oder an der Schreibmarke ergänzen (Taloan, 22.09.)
function fromAi({ text, mode }) {
  const t = area.value
  if (mode === 'insert' && t) { const i = t.selectionStart ?? draft.value.length, j = t.selectionEnd ?? i; draft.value = draft.value.slice(0, i) + text + draft.value.slice(j); return }
  draft.value = text
}
// Esc und Strg+Enter gelten im offenen grossen Editor, egal wo der Fokus steht (Taloan, 22.09.)
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
  if ((mode === 'select' || mode === 'end') && isLong(props.value ?? props.inherited)) return openBig()
  const cur = props.value ?? ''
  // getipptes Zeichen: Knotenansicht hängt an, Tabelle (clickEdit=false) ersetzt wie Excel
  draft.value = mode === 'select' || mode === 'end' ? cur : (props.clickEdit ? cur + mode : mode)
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
function onInput(e) { if (props.suggest?.length && e.inputType?.startsWith('insert')) complete() }

function commit() {
  if (!editing.value) return   // blur nach Enter kommt ein zweites Mal
  const v = draft.value
  editing.value = false
  if (v !== (props.value ?? '')) emit('save', v)
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
      :tabindex="disabled ? undefined : 0" @click="clickEdit && open('end')" @dblclick="clickEdit || open('end')" @keydown="onKey" :title="disabled ? 'Achse gibt es hier nicht' : (value == null && inherited != null ? 'geerbt' + (origin ? ' von ' + origin : '') + ' — Enter überschreibt' : '')">
      <template v-if="disabled"></template>
      <template v-else-if="value != null">{{ value }}</template>
      <template v-else-if="inherited != null">{{ inherited }}</template>
      <span v-if="mark && !disabled" class="mark" :class="{ btn: !!markClick }" :title="markTitle" @click.stop="markClick && markClick()" @mousedown.stop>{{ mark }}</span>
      <a v-if="source && !disabled && value != null" class="src" :class="{ stale: source.stale, link: isUrl(source.source) }" :href="isUrl(source.source) ? source.source : null" target="_blank" rel="noopener" @mousedown.stop @click.stop="isUrl(source.source) || $event.preventDefault()"
        :title="(source.stale ? 'Beleg veraltet — der Wert wurde danach geändert · ' : '') + 'Quelle: ' + source.source + (source.title ? ' — ' + source.title : '') + ' · ' + ({ web: 'Recherche', ai: 'KI', rule: 'Regel', import: 'Import', manual: 'von Hand', pending: '⏳ angefragt' }[source.method] ?? source.method) + ' · geprüft ' + source.checkedAt + ' · ' + source.actor + (source.note ? ' · ' + source.note : '')">↗</a>
    </div>
    <!-- Das Eingabefeld ersetzt die Box mit denselben Massen — nicht darin, sonst doppelter Rahmen und unten abgeschnitten. -->
    <input v-else ref="input" v-model="draft" class="cell-input" :data-mode="openMode" @keydown="onEditKey" @input="onInput" @blur="commit" />
    <Teleport to="body">
      <div v-if="big" class="overlay" @mousedown.self="cancelBig">
        <div class="big">
          <textarea ref="area" v-model="draft" @keydown="onBigKey" spellcheck="false"></textarea>
          <div class="toolbar" style="position:relative"><span class="muted" style="font-size:12px">{{ draft.length }} Zeichen · Strg+Enter speichert · Esc verwirft</span><span class="grow" /><AiBar class="up" :current="draft" :html="false" :label="label" :locale="locale" :node="node" @result="fromAi" /><button @click="cancelBig">Verwerfen</button><button class="primary" @click="saveBig">Speichern</button></div>
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
