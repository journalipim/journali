<script setup>
// Eine Zelle mit Inline-Bearbeitung. Tab/Klick fokussiert, Enter/F2 oder Tippen
// öffnet, Enter speichert, Esc verwirft, Tab speichert und springt weiter.
import { ref, nextTick } from 'vue'

const props = defineProps({
  value: String,          // eigener Wert auf dieser Achse (null = keiner)
  inherited: String,      // was ohne eigenen Wert gilt (Rückfall)
  disabled: Boolean,      // Achse gibt es für dieses Attribut nicht
  origin: String,         // woher der geerbte Wert kommt (Anzeige im Tooltip)
})
const emit = defineEmits(['save'])

const editing = ref(false)
const draft = ref('')
const input = ref(null)
const box = ref(null)

async function open(initial) {
  if (props.disabled) return
  draft.value = initial ?? props.value ?? ''
  editing.value = true
  await nextTick()
  input.value?.focus()
  if (initial === undefined) input.value?.select()
}

function commit() {
  if (!editing.value) return   // blur nach Enter kommt ein zweites Mal
  const v = draft.value
  editing.value = false
  if (v !== (props.value ?? '')) emit('save', v)
}

function cancel() { editing.value = false }

function onKey(e) {
  if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); open() }
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
      :tabindex="disabled ? undefined : 0" @dblclick="open()" @keydown="onKey" :title="disabled ? 'Achse gibt es hier nicht' : (value == null && inherited != null ? 'geerbt' + (origin ? ' von ' + origin : '') + ' — Enter überschreibt' : '')">
      <template v-if="disabled"></template>
      <template v-else-if="value != null">{{ value }}</template>
      <template v-else-if="inherited != null">{{ inherited }}</template>
    </div>
    <!-- Das Eingabefeld ersetzt die Box mit denselben Massen — nicht darin, sonst doppelter Rahmen und unten abgeschnitten. -->
    <input v-else ref="input" v-model="draft" class="cell-input" @keydown="onEditKey" @blur="commit" />
  </td>
</template>
