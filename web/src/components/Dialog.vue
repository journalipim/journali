<script setup>
// Der Dialog selbst (dialog.js): Titel, Text, bei prompt ein Feld; Enter = OK, Esc = Abbrechen; Klick daneben = Abbrechen.
import { ref, watch, nextTick } from 'vue'
import { dialog } from '../dialog.js'
const okBtn = ref(null)
const field = ref(null)
watch(() => dialog.open, async v => { if (!v) return; await nextTick(); (dialog.kind === 'prompt' ? field.value : okBtn.value)?.focus(); field.value?.select?.() })
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
        <div v-if="dialog.kind === 'help'" class="keys-box"><table class="keys"><tr v-for="([k, what], i) in dialog.list" :key="i"><td class="k"><kbd>{{ k }}</kbd></td><td>{{ what }}</td></tr></table></div>
        <div v-else-if="dialog.list.length" class="list mono"><div v-for="(l, i) in dialog.list.slice(0, 8)" :key="i">{{ l }}</div><div v-if="dialog.list.length > 8" class="muted">{{ $t("… und {0} weitere", [dialog.list.length - 8]) }}</div></div>
        <div v-if="dialog.text" class="text muted">{{ dialog.text }}</div>
        <label v-if="dialog.option" class="option"><input type="checkbox" v-model="dialog.option.checked" /> {{ dialog.option.label }}</label>
        <select v-if="dialog.kind === 'prompt' && dialog.choices" ref="field" v-model="dialog.value" style="width:100%;margin-top:10px"><option v-for="c in dialog.choices" :key="c.value" :value="c.value">{{ c.label }}</option></select>
        <input v-else-if="dialog.kind === 'prompt'" ref="field" v-model="dialog.value" class="cell-input" style="width:100%;margin-top:10px" :placeholder="dialog.placeholder" :type="dialog.secret ? 'password' : 'text'" :autocomplete="dialog.secret ? 'current-password' : 'off'" />
        <label v-if="dialog.extra" class="extra">{{ dialog.extra.label }}<input v-model="dialog.extra.value" class="cell-input" :type="dialog.extra.type" :placeholder="dialog.extra.placeholder ?? ''" /></label>
        <div class="buttons">
          <button v-if="dialog.cancel" @click="dialog.done(false)">{{ dialog.cancel }}</button>
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
.keys-box { margin-top: 10px; max-height: min(60vh, 520px); overflow-y: scroll; }
.keys { border-collapse: collapse; }
.keys td { padding: 3px 8px 3px 0; vertical-align: top; line-height: 1.4; }
.keys td.k { white-space: nowrap; padding-right: 14px; }
.keys kbd { font: inherit; font-family: ui-monospace, Consolas, monospace; font-size: 12px; background: var(--cell); border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; }
.list { margin-top: 6px; white-space: pre-wrap; line-height: 1.5; color: var(--text); max-height: 200px; overflow-y: scroll; }
.option { display: flex; align-items: center; gap: 6px; margin-top: 10px; cursor: pointer; }
.extra { display: flex; align-items: center; gap: 6px; margin-top: 10px; color: var(--muted); }
.extra > input { flex: 1; min-width: 0; }
.buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
button.danger { background: var(--neg); color: #fff; border-color: var(--neg); }
</style>
