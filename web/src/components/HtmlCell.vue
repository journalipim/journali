<script setup>
// Zelle für html: in der Zelle nur der Anfang des Textes (‹› = HTML), Enter oder Doppelklick
// öffnet den Editor — einfacher Schreibmodus (fett, kursiv, Listen, Überschrift, Link) mit
// Umschalter auf den Quelltext (Taloan, 17.09.). Ctrl+Enter speichert, Esc verwirft.
import { ref, computed, nextTick } from 'vue'
import { dialog } from '../dialog.js'
import AiBar from './AiBar.vue'

const props = defineProps({ value: String, inherited: String, disabled: Boolean, origin: String, title: String, clickEdit: { type: Boolean, default: true }, node: String, locale: String, label: String })   // clickEdit=false (Tabelle): Doppelklick/Enter öffnet
const emit = defineEmits(['save'])

const open = ref(false)
const draft = ref('')
const source = ref(false)      // Quelltext statt Schreibmodus
const area = ref(null)
const rich = ref(null)

const shown = computed(() => props.value ?? props.inherited ?? '')
const plain = computed(() => shown.value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
const LIMIT = 60
const plainLen = s => (s ?? '').replace(/<[^>]+>/g, '').length
const brief = computed(() => plain.value.length > LIMIT ? plain.value.slice(0, LIMIT).trimEnd() + '…' : plain.value)

async function edit() {
  if (props.disabled) return
  draft.value = props.value ?? props.inherited ?? ''
  source.value = false
  open.value = true
  await nextTick()
  if (rich.value) { rich.value.innerHTML = draft.value; rich.value.focus() }
}
function save() { syncFromRich(); open.value = false; if (draft.value !== (props.value ?? '')) emit('save', draft.value) }
function cancel() { open.value = false }
// ✦ KI: neuer Text in den Entwurf — Schreibmodus zeigt ihn sofort, Quelltext ebenso
function fromAi(text) { draft.value = text; if (rich.value && !source.value) rich.value.innerHTML = text }
function syncFromRich() { if (!source.value && rich.value) draft.value = rich.value.innerHTML.replace(/<div><br><\/div>/g, '<p></p>') }
async function toggleSource() {
  if (source.value) { source.value = false; await nextTick(); if (rich.value) { rich.value.innerHTML = draft.value; rich.value.focus() } }
  else { syncFromRich(); source.value = true; await nextTick(); area.value?.focus() }
}
// Schreibbefehle des Browsers — reichen für Absatz, fett, kursiv, Listen, Überschrift, Link; kein Fremdcode.
function cmd(name, arg = null) { rich.value?.focus(); document.execCommand(name, false, arg) }
async function link() { const url = await dialog.prompt({ title: 'Link', text: 'Adresse — leer entfernt den Link', value: 'https://', ok: '🔗 Link' }); if (url == null) return; url ? cmd('createLink', url) : cmd('unlink') }
function onKey(e) {
  if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); edit() }
  else if (e.key === 'Delete' && props.value != null) emit('save', '')
}
function onEditKey(e) {
  if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); save() }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel() }
  else if (e.ctrlKey && !source.value && e.key === 'b') { e.preventDefault(); cmd('bold') }
  else if (e.ctrlKey && !source.value && e.key === 'i') { e.preventDefault(); cmd('italic') }
}
</script>

<template>
  <td class="cell">
    <div class="cell-box html" :class="{ inherited: !disabled && value == null && inherited != null, disabled }"
      :tabindex="disabled ? undefined : 0" @click="clickEdit && edit()" @dblclick="clickEdit || edit()" @keydown="onKey"
      :title="disabled ? 'Achse gibt es hier nicht' : (value == null && inherited != null ? 'geerbt' + (origin ? ' von ' + origin : '') + ' (Enter überschreibt)' : (plain ? plain.slice(0, 400) + '\n\n' : '') + 'Editor öffnen (auch Enter)')">
      <template v-if="!disabled"><span v-if="plain" class="muted tag">‹›</span>{{ brief }}</template>
    </div>
    <Teleport to="body">
      <div v-if="open" class="overlay" @mousedown.self="cancel">
        <div class="editor" @keydown="onEditKey">
          <div class="toolbar"><h1>‹› {{ title }}</h1><span class="grow" /><kbd>Ctrl+Enter</kbd> speichern · <kbd>Esc</kbd> verwerfen</div>
          <div class="toolbar fmt" v-if="!source">
            <button @mousedown.prevent="cmd('formatBlock', 'p')" title="Absatz">¶</button>
            <button @mousedown.prevent="cmd('formatBlock', 'h2')" title="Überschrift">H2</button>
            <button @mousedown.prevent="cmd('formatBlock', 'h3')" title="Überschrift klein">H3</button>
            <span class="sep">·</span>
            <button @mousedown.prevent="cmd('bold')" title="fett (Ctrl+B)"><b>B</b></button>
            <button @mousedown.prevent="cmd('italic')" title="kursiv (Ctrl+I)"><i>I</i></button>
            <button @mousedown.prevent="cmd('underline')" title="unterstrichen"><u>U</u></button>
            <span class="sep">·</span>
            <button @mousedown.prevent="cmd('insertUnorderedList')" title="Liste">•≡</button>
            <button @mousedown.prevent="cmd('insertOrderedList')" title="nummerierte Liste">1≡</button>
            <button @mousedown.prevent="link()" title="Link">🔗</button>
            <span class="sep">·</span>
            <button @mousedown.prevent="cmd('removeFormat')" title="Formatierung entfernen">✗ Format entfernen</button>
            <span class="grow" />
            <AiBar :current="draft" html :label="label || title" :locale="locale" :node="node" @result="fromAi" />
            <button @click="toggleSource" title="HTML-Quelltext zeigen">‹› Quelltext</button>
          </div>
          <div class="toolbar fmt" v-else><span class="muted">HTML-Quelltext</span><span class="grow" /><button class="primary" @click="toggleSource" title="zurück zum Schreibmodus">✎ Schreiben</button></div>
          <div ref="rich" v-if="!source" class="rich" contenteditable="true" spellcheck="true" @input="syncFromRich"></div>
          <textarea v-else ref="area" v-model="draft" spellcheck="false"></textarea>
          <div class="toolbar" style="border-top:1px solid var(--line);border-bottom:0"><span class="muted" style="font-size:12px">{{ plainLen(draft) }} Zeichen</span><span class="grow" /><button @click="cancel">Verwerfen</button><button class="primary" @click="save">Speichern</button></div>
        </div>
      </div>
    </Teleport>
  </td>
</template>

<style scoped>
.tag { font-size: 10px; margin-right: 4px; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: grid; place-items: center; z-index: 20; }
.editor { width: min(900px, 92vw); height: min(640px, 85vh); background: var(--pane); border: 1px solid var(--line); border-radius: 6px; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(0,0,0,.4); }
.fmt { gap: 4px; }
.fmt button { min-width: 30px; padding: 2px 6px; }
.rich { flex: 1; overflow: auto; padding: 10px 14px; outline: none; background: var(--cell); color: var(--text); line-height: 1.45; }
.rich :deep(p) { margin: 0 0 8px; }
.rich :deep(h2) { font-size: 16px; margin: 10px 0 6px; }
.rich :deep(h3) { font-size: 14px; margin: 8px 0 4px; }
.rich :deep(a) { color: var(--accent); }
textarea { flex: 1; border: 0; resize: none; padding: 8px; font: 12px var(--mono); background: var(--cell); color: var(--text); outline: none; }
</style>
