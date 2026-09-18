<script setup>
// Der Dialog selbst (dialog.js): Titel, Text, bei prompt ein Feld; Enter = OK, Esc = Abbrechen; Klick daneben = Abbrechen.
import { ref, watch, nextTick } from 'vue'
import { dialog } from '../dialog.js'
const okBtn = ref(null)
const field = ref(null)
watch(() => dialog.open, async v => { if (!v) return; await nextTick(); (dialog.kind === 'prompt' ? field.value : okBtn.value)?.focus(); field.value?.select() })
function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); dialog.done(false) }
  else if (e.key === 'Enter' && (dialog.kind === 'prompt' || e.target === okBtn.value || !e.target.closest('button'))) { e.preventDefault(); dialog.done(true) }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="dialog.open" class="overlay" @mousedown.self="dialog.done(false)" @keydown="onKey">
      <div class="dlg" role="dialog">
        <div class="title">{{ dialog.title }}</div>
        <div v-if="dialog.warn" class="warnline">⚠ {{ dialog.warn }}</div>
        <div v-if="dialog.list.length" class="list mono"><div v-for="(l, i) in dialog.list.slice(0, 8)" :key="i">{{ l }}</div><div v-if="dialog.list.length > 8" class="muted">… und {{ dialog.list.length - 8 }} weitere</div></div>
        <div v-if="dialog.text" class="text muted">{{ dialog.text }}</div>
        <input v-if="dialog.kind === 'prompt'" ref="field" v-model="dialog.value" class="cell-input" style="width:100%;margin-top:10px" :placeholder="dialog.placeholder" />
        <div class="buttons">
          <button @click="dialog.done(false)">{{ dialog.cancel }}</button>
          <button ref="okBtn" :class="dialog.danger ? 'danger' : 'primary'" @click="dialog.done(true)">{{ dialog.ok }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: grid; place-items: center; z-index: 40; }
.dlg { min-width: 340px; max-width: 520px; background: var(--pane); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 12px 32px rgba(0,0,0,.4); padding: 16px 18px 14px; font-size: 13px; }
.title { font-weight: 600; font-size: 14px; }
.text { margin-top: 6px; white-space: pre-wrap; line-height: 1.45; }
.warnline { margin-top: 10px; font-size: 15px; font-weight: 700; color: var(--neg); }
.list { margin-top: 6px; white-space: pre-wrap; line-height: 1.5; color: var(--text); max-height: 200px; overflow: auto; }
.buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
button.danger { background: var(--neg); color: #fff; border-color: var(--neg); }
</style>
