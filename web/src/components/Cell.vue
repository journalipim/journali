<script setup>
// Eine Zelle mit Inline-Bearbeitung. Tab fokussiert; Klick öffnet mit dem Cursor
// am Ende, Enter/F2 mit dem bisherigen Wert vorselektiert, Tippen hängt an den
// bisherigen Wert an (überschreibt nie, Taloan 17.09.). Enter speichert, Esc
// verwirft, Tab speichert und springt weiter.
import { ref, nextTick } from 'vue'

const props = defineProps({
  value: String,          // eigener Wert auf dieser Achse (null = keiner)
  inherited: String,      // was ohne eigenen Wert gilt (Rückfall)
  disabled: Boolean,      // Achse gibt es für dieses Attribut nicht
  origin: String,         // woher der geerbte Wert kommt (Anzeige im Tooltip)
  mark: String,           // kleines Zeichen rechts in der Zelle (⟳ = Übersetzung zu überarbeiten)
  markTitle: String,
  clickEdit: { type: Boolean, default: true },   // false (Tabelle): Klick markiert nur, Doppelklick bearbeitet
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
  else input.value?.setSelectionRange(draft.value.length, draft.value.length)
}

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
      <span v-if="mark && !disabled" class="mark" :title="markTitle">{{ mark }}</span>
    </div>
    <!-- Das Eingabefeld ersetzt die Box mit denselben Massen — nicht darin, sonst doppelter Rahmen und unten abgeschnitten. -->
    <input v-else ref="input" v-model="draft" class="cell-input" :data-mode="openMode" @keydown="onEditKey" @blur="commit" />
    <Teleport to="body">
      <div v-if="big" class="overlay" @mousedown.self="cancelBig">
        <div class="big">
          <textarea ref="area" v-model="draft" @keydown="onBigKey" spellcheck="false"></textarea>
          <div class="toolbar"><span class="muted" style="font-size:12px">{{ draft.length }} Zeichen · Strg+Enter speichert · Esc verwirft</span><span class="grow" /><button @click="cancelBig">Verwerfen</button><button class="primary" @click="saveBig">Speichern</button></div>
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
</style>
