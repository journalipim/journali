<script setup>
// Das Menü selbst: an der Mausposition, im Fenster gehalten, Esc/Klick daneben schliesst,
// ↑↓ Enter wählen. Untermenüs: { label, icon, items } — Hover, Klick oder →
// öffnet rechts daneben, ← schliesst es; Buchstaben gelten im gerade offenen Menü. Einmal in App.vue eingehängt.
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { menu } from '../menu.js'

const box = ref(null)
const subBox = ref(null)
const active = ref(-1)
const sub = ref(-1)          // Index des offenen Untermenüs
const subActive = ref(-1)
const subPos = ref({ x: 0, y: 0 })

watch(() => menu.visible, async v => {
  if (!v) { sub.value = -1; return }
  active.value = -1; sub.value = -1
  await nextTick()
  const el = box.value; if (!el) return
  const r = el.getBoundingClientRect()
  if (menu.x + r.width > innerWidth - 8) menu.x = Math.max(8, innerWidth - r.width - 8)
  if (menu.y + r.height > innerHeight - 8) menu.y = Math.max(8, innerHeight - r.height - 8)
  el.focus()
})

function run(item) {
  if (!item || item.sep || item.disabled) return
  if (item.items) { openSub(menu.items.indexOf(item)); return }
  menu.close()
  item.action?.()
}
async function openSub(i) {
  sub.value = i; subActive.value = -1
  await nextTick()
  const row = box.value?.querySelectorAll('.item, .sep')[i]; const b = box.value?.getBoundingClientRect(); const s = subBox.value?.getBoundingClientRect()
  if (!row || !b || !s) return
  const r = row.getBoundingClientRect()
  let x = b.right - 2, y = r.top - 4
  if (x + s.width > innerWidth - 8) x = Math.max(8, b.left - s.width + 2)   // kein Platz rechts: links
  if (y + s.height > innerHeight - 8) y = Math.max(8, innerHeight - s.height - 8)
  subPos.value = { x, y }
}
function hover(i) { active.value = i; const it = menu.items[i]; if (it?.items && !it.disabled) openSub(i); else sub.value = -1 }   // ausgegrautes Untermenü klappt nicht auf
const subItems = () => menu.items[sub.value]?.items ?? []
function onKey(e) {
  if (sub.value >= 0) {
    const items = subItems().map((it, i) => ({ it, i })).filter(x => !x.it.sep && !x.it.disabled)
    if (e.key === 'Escape' || e.key === 'ArrowLeft') { e.preventDefault(); sub.value = -1; return }
    if (e.key === 'ArrowDown') { e.preventDefault(); const k = items.findIndex(x => x.i === subActive.value); subActive.value = items[(k + 1) % items.length]?.i ?? -1; return }
    if (e.key === 'ArrowUp') { e.preventDefault(); const k = items.findIndex(x => x.i === subActive.value); subActive.value = items[(k - 1 + items.length) % items.length]?.i ?? -1; return }
    if (e.key === 'Enter') { e.preventDefault(); run(subItems()[subActive.value]); return }
    const hit = subItems().find(it => it.key && it.key.toLowerCase() === e.key.toLowerCase() && !it.disabled)
    if (hit) { e.preventDefault(); run(hit); return }
    if (e.key.length === 1) return
  }
  const items = menu.items.map((it, i) => ({ it, i })).filter(x => !x.it.sep && !x.it.disabled)
  if (e.key === 'Escape') { e.preventDefault(); menu.close() }
  else if (e.key === 'ArrowDown') { e.preventDefault(); const k = items.findIndex(x => x.i === active.value); active.value = items[(k + 1) % items.length]?.i ?? -1; sub.value = -1 }
  else if (e.key === 'ArrowUp') { e.preventDefault(); const k = items.findIndex(x => x.i === active.value); active.value = items[(k - 1 + items.length) % items.length]?.i ?? -1; sub.value = -1 }
  else if (e.key === 'ArrowRight' && menu.items[active.value]?.items) { e.preventDefault(); openSub(active.value); subActive.value = 0 }
  else if (e.key === 'Enter') { e.preventDefault(); run(menu.items[active.value]) }
  else {
    const hit = menu.items.find(it => it.key && it.key.toLowerCase() === e.key.toLowerCase() && !it.disabled)
    if (hit) { e.preventDefault(); run(hit) }
  }
}
function onDown(e) { if (menu.visible && box.value && !box.value.contains(e.target) && !subBox.value?.contains(e.target)) menu.close() }
onMounted(() => { window.addEventListener('mousedown', onDown); window.addEventListener('blur', menu.close) })
onUnmounted(() => { window.removeEventListener('mousedown', onDown); window.removeEventListener('blur', menu.close) })
</script>

<template>
  <Teleport to="body">
    <div v-if="menu.visible" ref="box" class="ctx" :style="`left:${menu.x}px;top:${menu.y}px`" tabindex="-1" @keydown="onKey" @contextmenu.prevent>
      <template v-for="(it, i) in menu.items" :key="i">
        <div v-if="it.sep" class="sep" />
        <div v-else class="item" :class="{ disabled: it.disabled, danger: it.danger, active: i === active || i === sub }" @click="run(it)" @mouseenter="hover(i)">
          <span class="icon">{{ it.icon ?? '' }}</span>
          <span class="label">{{ it.label }}</span>
          <span v-if="it.items && !it.disabled" class="hint">▸</span>
          <span v-else-if="it.hint" class="hint">{{ it.hint }}</span>
        </div>
      </template>
    </div>
    <div v-if="menu.visible && sub >= 0" ref="subBox" class="ctx" :style="`left:${subPos.x}px;top:${subPos.y}px`" @contextmenu.prevent>
      <template v-for="(it, i) in subItems()" :key="i">
        <div v-if="it.sep" class="sep" />
        <div v-else class="item" :class="{ disabled: it.disabled, danger: it.danger, active: i === subActive }" @click="run(it)" @mouseenter="subActive = i">
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
