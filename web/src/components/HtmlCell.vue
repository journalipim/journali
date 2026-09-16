<script setup>
// Zelle für html: in der Zelle nur der Text, Enter oder Doppelklick öffnet den
// Editor — Quelltext links, Vorschau rechts. Ctrl+Enter speichert, Esc verwirft.
import { ref, computed, nextTick } from 'vue'

const props = defineProps({ value: String, inherited: String, disabled: Boolean, origin: String, title: String })
const emit = defineEmits(['save'])

const open = ref(false)
const draft = ref('')
const area = ref(null)

const shown = computed(() => props.value ?? props.inherited ?? '')
const plain = computed(() => shown.value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())

async function edit() {
  if (props.disabled) return
  draft.value = props.value ?? props.inherited ?? ''
  open.value = true
  await nextTick()
  area.value?.focus()
}
function save() { open.value = false; if (draft.value !== (props.value ?? '')) emit('save', draft.value) }
function cancel() { open.value = false }
function onKey(e) {
  if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); edit() }
  else if (e.key === 'Delete' && props.value != null) emit('save', '')
}
function onEditKey(e) {
  if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); save() }
  else if (e.key === 'Escape') { e.preventDefault(); cancel() }
}
</script>

<template>
  <td class="cell">
    <div class="cell-box html" :class="{ inherited: !disabled && value == null && inherited != null, disabled }"
      :tabindex="disabled ? undefined : 0" @dblclick="edit" @keydown="onKey"
      :title="disabled ? 'Achse gibt es hier nicht' : (value == null && inherited != null ? 'geerbt' + (origin ? ' von ' + origin : '') + ' — Enter überschreibt' : 'Enter öffnet den Editor')">
      <template v-if="!disabled">{{ plain }}</template>
    </div>
    <Teleport to="body">
      <div v-if="open" class="overlay" @mousedown.self="cancel">
        <div class="editor" @keydown="onEditKey">
          <div class="toolbar"><h1>‹› {{ title }}</h1><span class="grow" /><kbd>Ctrl+Enter</kbd> speichern · <kbd>Esc</kbd> verwerfen</div>
          <div class="halves">
            <textarea ref="area" v-model="draft" spellcheck="false"></textarea>
            <div class="preview" v-html="draft"></div>
          </div>
          <div class="toolbar" style="border-top:1px solid var(--line);border-bottom:0"><span class="grow" /><button @click="cancel">Verwerfen</button><button class="primary" @click="save">Speichern</button></div>
        </div>
      </div>
    </Teleport>
  </td>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: grid; place-items: center; z-index: 20; }
.editor { width: min(1100px, 92vw); height: min(700px, 85vh); background: var(--pane); border: 1px solid var(--line); border-radius: 6px; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(0,0,0,.4); }
.halves { flex: 1; display: grid; grid-template-columns: 1fr 1fr; min-height: 0; }
textarea { border: 0; border-right: 1px solid var(--line); resize: none; padding: 8px; font: 12px var(--mono); background: var(--cell); color: var(--text); outline: none; }
.preview { overflow: auto; padding: 8px 12px; }
.preview :deep(p) { margin: 0 0 6px; }
</style>
