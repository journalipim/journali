<script setup>
import { onMounted } from 'vue'
import { store } from './store.js'
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
  { to: '/products', icon: '▦', label: 'Produkte', key: '1' },
  { to: '/journal', icon: '≡', label: 'Journal', key: '2' },
  { to: '/settings', icon: '⚙', label: 'Einstellungen', key: '3' },
]
</script>

<template>
  <div class="shell">
    <nav class="rail">
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
      <span>▦ {{ store.products }}</span>
      <span class="grow" />
      <span v-if="store.actor" class="actor">👤 {{ store.actor }}</span>
      <router-link v-else to="/settings" class="warn">👤 Name fehlt → Einstellungen</router-link>
    </header>

    <div class="toasts">
      <div v-for="t in store.toasts" :key="t.id" class="toast" :class="t.kind">{{ t.text }}</div>
    </div>
  </div>
</template>
