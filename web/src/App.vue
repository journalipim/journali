<script setup>
import { onMounted, onErrorCaptured, ref, computed, watch } from 'vue'
import { store } from './store.js'
import ContextMenu from './components/ContextMenu.vue'
import Dialog from './components/Dialog.vue'
import { useRoute, useRouter } from 'vue-router'
import { plugins } from './plugins.js'
const route = useRoute()
const router = useRouter()
// Auffangrahmen (Taloan, 17.09.: leerer Bildschirm ist im Betrieb ein Desaster): ein Fehler beim Zeichnen einer
// Ansicht landet hier — Meldung mit Ursache, Leiste bleibt bedienbar, der nächste Seitenwechsel räumt auf.
// „location“ gibt es in Vue-Vorlagen nicht (nur eine Handvoll Globals) — der Knopf tat darum nichts (Taloan, 17.09.)
const reload = () => window.location.reload()
const crashed = ref(null)
onErrorCaptured(e => { crashed.value = e?.message ?? String(e); console.error(e); return false })
watch(() => route.fullPath, () => { crashed.value = null })
onMounted(() => { plugins.load() })
onMounted(() => window.addEventListener('keydown', e => {
  if (e.altKey && !e.ctrlKey && [...nav, ...navBottom].some(n => n.key === e.key)) {
    e.preventDefault()
    const n = [...nav, ...navBottom].find(n => n.key === e.key); router.push(n.to === '/tree' && store.lastNode ? `/tree/${store.lastNode}` : n.to)
  }
}))
const nav = [
  { to: '/tree', icon: '▣', label: 'Baum', key: '1' },
  { to: '/model', icon: '⊞', label: 'Modell', key: '3' },
  { to: '/import', icon: '⇩', label: 'Import', key: '4' },
  { to: '/media', icon: '🖼', label: 'Medien', key: '5' },
]
// unten in der Leiste (Taloan, 17.09.): Journal und Einstellungen
const navBottom = [
  { to: '/plugins', icon: '⌁', label: 'Plugins', key: '7' },
  { to: '/journal', icon: '≡', label: 'Journal', key: '2' },
  { to: '/settings', icon: '⚙', label: 'Einstellungen', key: '6' },
]
// Die Leiste als eine Liste (oben … spacer … unten), Reihenfolge aus den Einstellungen; Neues (Plugin-Ansichten) kommt vor den Spacer
const railItems = computed(() => {
  // ▣ Baum führt zum zuletzt gewählten Knoten zurück (Taloan, 18.09.); Kennung des Eintrags bleibt '/tree' (Reihenfolge, aktiv)
  const treeTo = store.lastNode ? `/tree/${store.lastNode}` : '/tree'
  const all = [...nav.map(n => n.to === '/tree' ? { ...n, href: treeTo } : n), ...plugins.views.map(v => ({ to: `/p/${v.key}/${v.path}`, icon: v.icon || '⌁', label: v.label, hint: `Plugin ${v.key}`, exact: true })), { to: 'spacer' }, ...navBottom]
  const order = store.railOrder ?? []
  const known = new Set(all.map(x => x.to))
  const sorted = order.filter(k => known.has(k)).map(k => all.find(x => x.to === k))
  const rest = all.filter(x => !order.includes(x.to))
  const si = sorted.findIndex(x => x.to === 'spacer')
  return si < 0 ? [...sorted, ...rest] : [...sorted.slice(0, si), ...rest.filter(x => x.to !== 'spacer'), ...sorted.slice(si)]
})
// Umsortieren per Drag & Drop (Taloan): Symbol packen, auf ein anderes fallen lassen = davor einordnen; auf den Spacer = ans Ende oben
const dragKey = ref(null)
function railDrop(target) {
  if (!dragKey.value || dragKey.value === target) return
  const keys = railItems.value.map(x => x.to).filter(k => k !== dragKey.value)
  keys.splice(keys.indexOf(target), 0, dragKey.value)
  store.railOrder = keys; store.save(); dragKey.value = null
}
</script>

<template>
  <div class="shell" :class="{ popup: route.query.popup }">
    <nav class="rail" v-if="!route.query.popup">
      <!-- Logo: web/public/logo.png (Taloan, 17.09.2026) — Vite legt public/ neben die Seite -->
      <router-link to="/tree" class="rail-logo" title="journali"><img :src="'/logo-128.png'" alt="journali" onerror="this.style.display='none'" /></router-link>
      <template v-for="n in railItems" :key="n.to">
        <div v-if="n.to === 'spacer'" class="rail-spacer" :class="{ over: dragKey }" @dragover.prevent @drop="railDrop('spacer')" />
        <router-link v-else :to="n.href ?? n.to" class="rail-item" :class="{ active: n.exact ? route.path === n.to : route.path.startsWith(n.to), dragging: dragKey === n.to }"
          :title="`${n.label}  (${n.key ? 'Alt+' + n.key : n.hint}) — ziehen sortiert um`" draggable="true"
          @dragstart="dragKey = n.to" @dragend="dragKey = null" @dragover.prevent @drop="railDrop(n.to)">
          <span class="icon">{{ n.icon }}</span>
        </router-link>
      </template>
      <div class="rail-status" :class="{ online: store.online, offline: store.online === false }"
        :title="store.online ? `Server erreichbar · #${store.head}` : store.error || 'Server wird gesucht …'">
        ●
      </div>
    </nav>

    <main class="content">
      <div v-if="crashed" class="pane" style="flex:1"><div class="empty"><div class="neg" style="font-weight:600">✗ Diese Ansicht ist abgestürzt</div><div class="mono muted" style="margin:8px 0">{{ crashed }}</div><button class="primary" @click="crashed = null; $router.push('/tree')">▣ zum Baum</button> <button @click="reload">↻ neu laden</button></div></div>
      <router-view v-else />
    </main>

    <header class="status" v-if="!route.query.popup">
      <span class="dot" :class="{ online: store.online, offline: store.online === false }">●</span>
      <span class="mono">#{{ store.head }}</span>
      <span class="sep">·</span>
      <span>▣ {{ store.nodes }}</span>
      <span class="grow" />
      <button v-if="store.stale" class="primary" style="padding:0 8px;height:20px;font-size:12px" @click="reload" title="Es liegt eine neue Fassung der Oberfläche — neu laden">↻ neue Fassung</button>
      <span v-if="store.actor" class="actor">👤 {{ store.actor }}</span>
      <router-link v-else to="/settings" class="warn">👤 Name fehlt → Einstellungen</router-link>
    </header>

    <ContextMenu />
    <Dialog />

    <div class="toasts">
      <div v-for="t in store.toasts" :key="t.id" class="toast" :class="t.kind">{{ t.text }}<button v-if="t.action" class="toast-action" :title="t.action.title" @click="store.dismiss(t); t.action.run()">{{ t.action.label }}</button></div>
    </div>
  </div>
</template>
