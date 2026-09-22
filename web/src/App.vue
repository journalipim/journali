<script setup>
import { onMounted, onErrorCaptured, ref, computed, watch } from 'vue'
import { store } from './store.js'
import ContextMenu from './components/ContextMenu.vue'
import Dialog from './components/Dialog.vue'
import { useRoute, useRouter } from 'vue-router'
import { plugins } from './plugins.js'
import { TOPICS, entries, baseTopics, topicOfPath } from './topics.js'
import { ai } from './ai.js'
import UsageMini from './components/UsageMini.vue'
const tok = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(n)
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
// Themen in der Leiste (Taloan, 18.09.): Import, Export, Datenblatt, Datenanalyse, Werkzeuge — jedes führt zur Übersicht
// seines Themas, dort wählt man das Plugin; kein Plugin bekommt ein eigenes Symbol. Ein Thema ohne Einträge bleibt weg.
const nav = [
  { to: '/tree', icon: '▣', label: 'Baum', key: '1' },
  { to: '/pub', icon: '⇶', label: 'Publikation', key: '8' },
  { to: '/model', icon: '⊞', label: 'Modell', key: '3' },
  ...TOPICS.map(t => ({ to: t.to, icon: t.icon, label: t.label, key: t.hotkey, topic: t.key, always: !!t.always })),
  { to: '/media', icon: '▨', label: 'Medien', key: '5' },
  { to: '/tasks', icon: '⚑', label: 'Aufgaben', key: '9' },   // Workflow-Schritte, die meiner Rolle gehören (27)
]
// unten in der Leiste (Taloan, 17.09.): Journal und Einstellungen
const navBottom = [
  { to: '/plugins', icon: '⌁', label: 'Plugins', key: '7' },
  { to: '/journal', icon: '≡', label: 'Journal', key: '2' },
  { to: '/settings', icon: '⚙', label: 'Einstellungen', key: '6' },
]
// Die Leiste als eine Liste (oben … spacer … unten), Reihenfolge aus den Einstellungen; Neues (Plugin-Ansichten) kommt vor den Spacer
// Was unter ⌁ Plugins ansteht: Aktualisierungen (Platte neuer als installiert) und noch nicht installierte Plugins
const pluginNews = computed(() => plugins.list.flatMap(p => p.update ? [`↑ ${p.key}: ${p.version} → ${p.diskVersion}`] : p.onDisk && !p.installed ? [`⇩ ${p.key}: nicht installiert`] : []))
async function logout() { await store.logout(); router.push('/login') }
const railTitle = n => `${n.label}  (${n.key ? 'Alt+' + n.key : n.hint}) — ziehen sortiert um` + (n.to === '/plugins' && pluginNews.value.length ? '\n' + pluginNews.value.join('\n') : '')
const railItems = computed(() => {
  // ▣ Baum führt zum zuletzt gewählten Knoten zurück (Taloan, 18.09.); Kennung des Eintrags bleibt '/tree' (Reihenfolge, aktiv)
  const treeTo = store.lastNode ? `/tree/${store.lastNode}` : '/tree'
  // Ein Plugin, das der Nutzer aus der Leiste genommen hat (⌁ Plugins → „nicht in der Leiste“), zählt in seinem Thema nicht
  // (Taloan: „wenn es ausgeschaltet ist, soll es gar nicht in der Leiste sein“) — kein eigenes Symbol, kein Thema nur seinetwegen
  const left = topic => (entries.value[topic] ?? []).filter(e => !e.plugin || !store.railOff.includes(e.plugin))
  // Ein Thema mit genau einem Eintrag (Taloan: „erwarten wir hier weitere Module?“): das Symbol führt direkt hin, die Übersicht wäre nur ein Klick mehr
  const direct = n => n.topic && !n.always && left(n.topic).length === 1 ? { ...n, href: left(n.topic)[0].to } : n
  const all = [...nav.filter(n => !n.topic || n.always || baseTopics.value.has(n.topic) || left(n.topic).length).map(n => n.to === '/tree' ? { ...n, href: treeTo } : direct(n)), { to: 'spacer' }, ...navBottom]
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
    <!-- Fortschritt eines laufenden Stapels (Taloan, 18.09.): dünner Balken ganz oben, dazu Zahl — sichtbar in jeder Ansicht -->
    <div v-if="store.progress" class="progress" :title="`${store.progress.text} … ${store.progress.done} von ${store.progress.total} — Fenster offen lassen`">
      <div class="bar" :style="`width:${Math.round(store.progress.done / Math.max(1, store.progress.total) * 100)}%`" />
      <span class="txt">{{ store.progress.text }} … {{ store.progress.done }} / {{ store.progress.total }} — Fenster offen lassen</span>
    </div>
    <nav class="rail" v-if="!route.query.popup">
      <!-- Logo: web/public/logo.png (Taloan, 17.09.2026) — Vite legt public/ neben die Seite -->
      <router-link to="/tree" class="rail-logo" title="journali PIM"><img :src="'/logo-128.png'" alt="journali PIM" onerror="this.style.display='none'" /></router-link>
      <template v-for="n in railItems" :key="n.to">
        <div v-if="n.to === 'spacer'" class="rail-spacer" :class="{ over: dragKey }" @dragover.prevent @drop="railDrop('spacer')" />
        <router-link v-else :to="n.href ?? n.to" class="rail-item" :class="{ active: n.topic ? topicOfPath(route.path) === n.topic : route.path.startsWith(n.to), dragging: dragKey === n.to }"
          :title="railTitle(n)" draggable="true"
          @dragstart="dragKey = n.to" @dragend="dragKey = null" @dragover.prevent @drop="railDrop(n.to)">
          <span class="icon">{{ n.icon }}</span>
          <!-- Lämpchen (Taloan, 18.09.): ein Plugin hat eine neuere Fassung auf der Platte oder ist noch nicht installiert -->
          <span v-if="n.to === '/plugins' && pluginNews.length" class="lamp" />
        </router-link>
      </template>
      <div class="rail-status" :class="{ online: store.online, offline: store.online === false }"
        :title="store.online ? `Server erreichbar · #${store.head}` : store.error || 'Server wird gesucht …'">
        ●
      </div>
    </nav>

    <main class="content">
      <div v-if="crashed" class="pane" style="flex:1"><div class="empty"><div class="neg" style="font-weight:600">✗ Diese Ansicht ist abgestürzt</div><div class="mono muted" style="margin:8px 0">{{ crashed }}</div><button class="primary" @click="crashed = null; $router.push('/tree')">▣ Zum Baum</button> <button @click="reload">↻ Neu laden</button></div></div>
      <router-view v-else />
    </main>

    <header class="status" v-if="!route.query.popup">
      <span class="brand" title="journali PIM">journali PIM</span>
      <span class="dot" :class="{ online: store.online, offline: store.online === false }">●</span>
      <span class="mono">#{{ store.head }}</span>
      <span class="sep">·</span>
      <span>▣ {{ store.nodes }}</span>
      <!-- KI-Verbrauch (Taloan, 22.09.): Token kosten Geld — hier mitlaufen lassen -->
      <template v-if="ai.used.calls"><span class="sep">·</span><router-link to="/settings" class="ai" :title="`KI seit ${ai.used.since}: ${ai.used.calls} Anfragen · ${ai.used.in.toLocaleString('de-DE')} Token hinein · ${ai.used.out.toLocaleString('de-DE')} hinaus — Einstellungen → KI zum Zurücksetzen`">✦ {{ tok(ai.used.in + ai.used.out) }}</router-link></template>
      <template v-if="store.usage"><span class="sep">·</span><router-link to="/settings" class="ai" title="Nutzung anzeigen"><UsageMini :usage="store.usage" /></router-link></template>
      <span class="grow" />
      <button v-if="store.stale" class="primary" style="padding:0 8px;height:20px;font-size:12px" @click="reload" title="Neue Fassung der Oberfläche laden">↻ Neue Fassung</button>
      <template v-if="store.auth.enabled && store.auth.user"><span class="actor" :title="'Rolle ' + store.auth.role + ' · ' + (store.auth.rights ?? []).join(', ')">👤 {{ store.auth.name || store.auth.user }} <span class="muted">· {{ store.auth.role }}</span></span><button class="x" style="height:20px;padding:0 6px;font-size:12px" @click="logout" title="abmelden">⏻</button></template>
      <span v-else-if="store.actor" class="actor">👤 {{ store.actor }}</span>
      <router-link v-else to="/settings" class="warn">👤 Name fehlt → Einstellungen</router-link>
    </header>

    <ContextMenu />
    <Dialog />

    <div class="toasts">
      <div v-for="t in store.toasts" :key="t.id" class="toast" :class="t.kind">{{ t.text }}<button v-if="t.action" class="toast-action" :title="t.action.title" @click="store.dismiss(t); t.action.run()">{{ t.action.label }}</button></div>
    </div>
  </div>
</template>
