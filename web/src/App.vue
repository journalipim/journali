<script setup>
import { onMounted } from 'vue'
import { store } from './store.js'
import ContextMenu from './components/ContextMenu.vue'
import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()
onMounted(() => window.addEventListener('keydown', e => {
  if (e.altKey && !e.ctrlKey && nav.some(n => n.key === e.key)) {
    e.preventDefault()
    router.push(nav.find(n => n.key === e.key).to)
  }
}))
const nav = [
  { to: '/tree', icon: '▣', label: 'Baum', key: '1' },
  { to: '/journal', icon: '≡', label: 'Journal', key: '2' },
  { to: '/model', icon: '⊞', label: 'Modell', key: '3' },
  { to: '/import', icon: '⇩', label: 'Import', key: '4' },
  { to: '/settings', icon: '⚙', label: 'Einstellungen', key: '5' },
]
</script>

<template>
  <div class="shell">
    <nav class="rail">
      <!-- Logo: web/public/logo.png (Taloan, 17.09.2026) — Vite legt public/ neben die Seite -->
      <router-link to="/tree" class="rail-logo" title="journali"><img :src="'/logo-128.png'" alt="journali" onerror="this.style.display='none'" /></router-link>
      <router-link v-for="n in nav" :key="n.to" :to="n.to" class="rail-item"
        :class="{ active: route.path.startsWith(n.to) }" :title="`${n.label}  (Alt+${n.key})`">
        <span class="icon">{{ n.icon }}</span>
      </router-link>
      <div class="rail-spacer" />
      <div class="rail-status" :class="{ online: store.online, offline: store.online === false }"
        :title="store.online ? `Server erreichbar · #${store.head}` : store.error || 'Server wird gesucht …'">
        ●
      </div>
    </nav>

    <main class="content">
      <router-view />
    </main>

    <header class="status">
      <span class="dot" :class="{ online: store.online, offline: store.online === false }">●</span>
      <span class="mono">#{{ store.head }}</span>
      <span class="sep">·</span>
      <span>▣ {{ store.nodes }}</span>
      <span class="grow" />
      <button v-if="store.stale" class="primary" style="padding:0 8px;height:20px;font-size:12px" @click="location.reload()" title="Es liegt eine neue Fassung der Oberfläche — neu laden">↻ neue Fassung</button>
      <span v-if="store.actor" class="actor">👤 {{ store.actor }}</span>
      <router-link v-else to="/settings" class="warn">👤 Name fehlt → Einstellungen</router-link>
    </header>

    <ContextMenu />

    <div class="toasts">
      <div v-for="t in store.toasts" :key="t.id" class="toast" :class="t.kind">{{ t.text }}</div>
    </div>
  </div>
</template>
