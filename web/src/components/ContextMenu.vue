<script setup>
// Das Menü selbst: an der Mausposition, im Fenster gehalten, Esc/Klick daneben schliesst,
// ↑↓ Enter wählen. Einmal in App.vue eingehängt.
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { menu } from '../menu.js'

const box = ref(null)
const active = ref(-1)

watch(() => menu.visible, async v => {
  if (!v) return
  active.value = -1
  await nextTick()
  const el = box.value; if (!el) return
  const r = el.getBoundingClientRect()
  if (menu.x + r.width > innerWidth - 8) menu.x = Math.max(8, innerWidth - r.width - 8)
  if (menu.y + r.height > innerHeight - 8) menu.y = Math.max(8, innerHeight - r.height - 8)
  el.focus()
})

function run(item) {
  if (!item || item.sep || item.disabled) return
  menu.close()
  item.action?.()
}
function onKey(e) {
  const items = menu.items.map((it, i) => ({ it, i })).filter(x => !x.it.sep && !x.it.disabled)
  if (e.key === 'Escape') { e.preventDefault(); menu.close() }
  else if (e.key === 'ArrowDown') { e.preventDefault(); const k = items.findIndex(x => x.i === active.value); active.value = items[(k + 1) % items.length]?.i ?? -1 }
  else if (e.key === 'ArrowUp') { e.preventDefault(); const k = items.findIndex(x => x.i === active.value); active.value = items[(k - 1 + items.length) % items.length]?.i ?? -1 }
  else if (e.key === 'Enter') { e.preventDefault(); run(menu.items[active.value]) }
  else {
    const hit = menu.items.find(it => it.key && it.key.toLowerCase() === e.key.toLowerCase() && !it.disabled)
    if (hit) { e.preventDefault(); run(hit) }
  }
}
function onDown(e) { if (menu.visible && box.value && !box.value.contains(e.target)) menu.close() }
onMounted(() => { window.addEventListener('mousedown', onDown); window.addEventListener('blur', menu.close) })
onUnmounted(() => { window.removeEventListener('mousedown', onDown); window.removeEventListener('blur', menu.close) })
</script>

<template>
  <Teleport to="body">
    <div v-if="menu.visible" ref="box" class="ctx" :style="`left:${menu.x}px;top:${menu.y}px`" tabindex="-1" @keydown="onKey" @contextmenu.prevent>
      <template v-for="(it, i) in menu.items" :key="i">
        <div v-if="it.sep" class="sep" />
        <div v-else class="item" :class="{ disabled: it.disabled, danger: it.danger, active: i === active }" @click="run(it)" @mouseenter="active = i">
          <span class="icon">{{ it.icon ?? '' }}</span>
          <span class="label">{{ it.label }}</span>
          <span v-if="it.hint" class="hint">{{ it.hint }}</span>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.ctx { position: fixed; z-index: 30; min-width: 220px; background: var(--pane); border: 1px solid var(--line); border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,.35); padding: 4px; outline: none; font-size: 13px; }
.item { display: flex; align-items: center; gap: 8px; padding: 5px 10px; border-radius: 4px; cursor: default; white-space: nowrap; }
.item.active { background: var(--accent-soft); }
.item.disabled { opacity: .4; }
.item.danger .label { color: var(--neg); }
.icon { width: 18px; text-align: center; color: var(--muted); }
.hint { margin-left: auto; color: var(--muted); font-size: 11px; padding-left: 16px; }
.sep { height: 1px; background: var(--line); margin: 4px 6px; }
</style>
