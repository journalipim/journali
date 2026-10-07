<script setup>
import { sicheresHtml } from '../html-sicher.js'   // gespeichertes HTML kommt bereinigt in den Editor (07.10.2026)
// Zelle für html: in der Zelle nur der Anfang des Textes (‹› = HTML), Enter oder Doppelklick
// öffnet den Editor — einfacher Schreibmodus (fett, kursiv, Listen, Überschrift, Link) mit
// Umschalter auf den Quelltext. Ctrl+Enter speichert, Esc verwirft.
import { ref, computed, nextTick, watch, onUnmounted } from 'vue'
import { dialog } from '../dialog.js'
import AiBar from './AiBar.vue'
import { t as t_ } from '../i18n.js'

const props = defineProps({ value: String, inherited: String, disabled: Boolean, origin: String, title: String, clickEdit: { type: Boolean, default: true }, node: String, locale: String, label: String })   // clickEdit=false (Tabelle): Doppelklick/Enter öffnet
const emit = defineEmits(['save'])

const open = ref(false)
const draft = ref('')
const source = ref(false)      // Quelltext statt Schreibmodus
const area = ref(null)
const panelId = 'aip-' + Math.random().toString(36).slice(2, 8)   // Behälter für die KI-Leiste in diesem Editor
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
  if (rich.value) { rich.value.innerHTML = sicheresHtml(draft.value); rich.value.focus() }
}
function save() { syncFromRich(); open.value = false; if (draft.value !== (props.value ?? '')) emit('save', draft.value) }
function cancel() { open.value = false }
// Esc und Strg+Enter gelten im offenen Editor, egal wo der Fokus steht
function onWinKey(e) {
  if (!open.value) return
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel() }
  else if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); e.stopPropagation(); save() }
}
watch(open, v => v ? window.addEventListener('keydown', onWinKey, true) : window.removeEventListener('keydown', onWinKey, true))
onUnmounted(() => window.removeEventListener('keydown', onWinKey, true))
// ✦ KI: neuer Text in den Entwurf — Schreibmodus zeigt ihn sofort, Quelltext ebenso
// Ergebnis der KI: ersetzen oder an der Schreibmarke ergänzen
function fromAi({ text, mode }) {
  if (mode === 'insert' && !source.value && rich.value) { rich.value.focus(); document.execCommand('insertHTML', false, sicheresHtml(text)); syncFromRich(); return }
  if (mode === 'insert' && source.value && area.value) { const t = area.value, i = t.selectionStart ?? draft.value.length; draft.value = draft.value.slice(0, i) + text + draft.value.slice(t.selectionEnd ?? i); return }
  draft.value = text; if (rich.value && !source.value) rich.value.innerHTML = sicheresHtml(text)
}
function syncFromRich() { if (!source.value && rich.value) draft.value = rich.value.innerHTML.replace(/<div><br><\/div>/g, '<p></p>') }
async function toggleSource() {
  if (source.value) { source.value = false; await nextTick(); if (rich.value) { rich.value.innerHTML = sicheresHtml(draft.value); rich.value.focus() } }
  else { syncFromRich(); source.value = true; await nextTick(); area.value?.focus() }
}
// Schreibbefehle des Browsers — reichen für Absatz, fett, kursiv, Listen, Überschrift, Link; kein Fremdcode.
function cmd(name, arg = null) { rich.value?.focus(); document.execCommand(name, false, arg) }
async function link() { const url = await dialog.prompt({ title: t_('Link setzen'), text: t_('Adresse (leer entfernt den Link)'), value: 'https://', ok: t_('🔗 Setzen') }); if (url == null) return; url ? cmd('createLink', url) : cmd('unlink') }
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
      :title="disabled ? $t('Achse gibt es hier nicht') : (value == null && inherited != null ? 'geerbt' + (origin ? ' von ' + origin : '') + ' ' + $t('(Enter überschreibt)') : (plain ? plain.slice(0, 400) + '\n\n' : '') + $t('Editor öffnen (auch Enter)'))">
      <template v-if="!disabled"><span v-if="plain" class="muted tag">‹›</span>{{ brief }}</template>
    </div>
    <Teleport to="body">
      <div v-if="open" class="overlay">
        <div class="editor" @keydown="onEditKey">
          <div class="toolbar"><h1>‹› {{ title }}</h1><span class="grow" /><kbd>{{ $t("Ctrl+Enter") }}</kbd>{{ ' ' + $t("speichern ·") + ' ' }}<kbd>{{ $t("Esc") }}</kbd>{{ ' ' + $t("verwerfen") }}</div>
          <div class="toolbar fmt" v-if="!source">
            <button @mousedown.prevent="cmd('formatBlock', 'p')" :title="$t('Absatz')">¶</button>
            <button @mousedown.prevent="cmd('formatBlock', 'h2')" :title="$t('Überschrift')">H2</button>
            <button @mousedown.prevent="cmd('formatBlock', 'h3')" :title="$t('Überschrift klein')">H3</button>
            <span class="sep">·</span>
            <button @mousedown.prevent="cmd('bold')" :title="$t('fett (Ctrl+B)')"><b>B</b></button>
            <button @mousedown.prevent="cmd('italic')" :title="$t('kursiv (Ctrl+I)')"><i>I</i></button>
            <button @mousedown.prevent="cmd('underline')" :title="$t('unterstrichen')"><u>U</u></button>
            <span class="sep">·</span>
            <button @mousedown.prevent="cmd('insertUnorderedList')" :title="$t('Liste')">•≡</button>
            <button @mousedown.prevent="cmd('insertOrderedList')" :title="$t('nummerierte Liste')">1≡</button>
            <button @mousedown.prevent="link()" :title="$t('Link')">🔗</button>
            <span class="sep">·</span>
            <button @mousedown.prevent="cmd('removeFormat')" :title="$t('Formatierung entfernen')">{{ $t("✗ Format entfernen") }}</button>
            <span class="grow" />
            <AiBar :current="draft" html :label="label || title" :locale="locale" :node="node" :panel="'#' + panelId" @result="fromAi" />
            <button @click="toggleSource" :title="$t('HTML-Quelltext zeigen')">{{ $t("‹› Quelltext") }}</button>
          </div>
          <div class="toolbar fmt" v-else><span class="muted">{{ $t("HTML-Quelltext") }}</span><span class="grow" /><button class="primary" @click="toggleSource" :title="$t('zurück zum Schreibmodus')">{{ $t("✎ Schreiben") }}</button></div>
          <div :id="panelId"></div>
          <div ref="rich" v-if="!source" class="rich" contenteditable="true" spellcheck="true" @input="syncFromRich"></div>
          <textarea v-else ref="area" v-model="draft" spellcheck="false"></textarea>
          <div class="toolbar" style="border-top:1px solid var(--line);border-bottom:0"><span class="muted" style="font-size:12px">{{ $t("{0} Zeichen", [plainLen(draft)]) }}</span><span class="grow" /><button @click="cancel">{{ $t("Verwerfen") }}</button><button class="primary" @click="save">{{ $t("Speichern") }}</button></div>
        </div>
      </div>
    </Teleport>
  </td>
</template>

<style scoped>
.tag { font-size: 10px; margin-right: 4px; }
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: grid; place-items: center; z-index: 20; }
.editor { width: min(900px, 92vw); height: min(640px, 85vh); background: var(--pane); border: 1px solid var(--line); border-radius: 6px; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(0,0,0,.4); }
.fmt { gap: 4px; position: relative; }   /* Bezug für die KI-Leiste, die darunter aufklappt */
.fmt button { min-width: 30px; padding: 2px 6px; }
.rich { flex: 1; overflow: auto; padding: 10px 14px; outline: none; background: var(--cell); color: var(--text); line-height: 1.45; }
.rich :deep(p) { margin: 0 0 8px; }
.rich :deep(h2) { font-size: 16px; margin: 10px 0 6px; }
.rich :deep(h3) { font-size: 14px; margin: 8px 0 4px; }
.rich :deep(a) { color: var(--accent); }
textarea { flex: 1; border: 0; resize: none; padding: 8px; font: 12px var(--mono); background: var(--cell); color: var(--text); outline: none; }
</style>
