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
import HelpButton from './components/HelpButton.vue'
import { t as t_ } from './i18n.js'

/// Volumen in KB, MB, GB — journali misst Bytes, nichts anderes
const kb = b => {
  const z = (x, e) => (x / e).toLocaleString('de-DE', { maximumFractionDigits: 1 })
  return !b ? '0kb' : b >= 1073741824 ? z(b, 1073741824) + 'gb' : b >= 1048576 ? z(b, 1048576) + 'mb' : Math.max(1, Math.round(b / 1024)) + 'kb'
}
const tok = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : String(n)
const route = useRoute()
const router = useRouter()
// Auffangrahmen: ein Fehler beim Zeichnen einer
// Ansicht landet hier — Meldung mit Ursache, Leiste bleibt bedienbar, der nächste Seitenwechsel räumt auf.
// „location“ gibt es in Vue-Vorlagen nicht (nur eine Handvoll Globals) — der Knopf tat darum nichts
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
// Themen in der Leiste: Import, Export, Datenblatt, Datenanalyse, Werkzeuge — jedes führt zur Übersicht
// seines Themas, dort wählt man das Plugin; kein Plugin bekommt ein eigenes Symbol. Ein Thema ohne Einträge bleibt weg.
const nav = [
  { to: '/tree', icon: '▣', label: t_('Baum'), key: '1' },
  { to: '/pub', icon: '⇶', label: t_('Publikation'), key: '8' },
  { to: '/model', icon: '⊞', label: t_('Modell'), key: '3' },
  ...TOPICS.map(t => ({ to: t.to, icon: t.icon, label: t.label, key: t.hotkey, topic: t.key, always: !!t.always })),
  { to: '/media', icon: '▨', label: t_('Medien'), key: '5' },
  { to: '/tasks', icon: '⚑', label: t_('Aufgaben'), key: '9' },   // Workflow-Schritte, die meiner Rolle gehören (27)
]
// unten in der Leiste: Journal und Einstellungen
const navBottom = [
  { to: '/plugins', icon: '⌁', label: t_('Plugins'), key: '7' },
  { to: '/journal', icon: '≡', label: t_('Journal'), key: '2' },
  { to: '/settings', icon: '⚙', label: t_('Einstellungen'), key: '6' },
]
// Die Leiste als eine Liste (oben … spacer … unten), Reihenfolge aus den Einstellungen; Neues (Plugin-Ansichten) kommt vor den Spacer
// Was unter ⌁ Plugins ansteht: Aktualisierungen (Platte neuer als installiert) und noch nicht installierte Plugins
const pluginNews = computed(() => plugins.list.flatMap(p => p.update ? [`↑ ${p.key}: ${p.version} → ${p.diskVersion}`] : p.onDisk && !p.installed ? [t_('⇩ {0}: nicht installiert', [p.key])] : []))
async function logout() { await store.logout(); router.push('/login') }
// Kürzel oder Hinweis in Klammern — Plugin-Ansichten haben oft keines von beiden, dann keine Klammer (vorher „(undefined)“, 24.09.2026)
const railTitle = n => t_('{0}{1} — ziehen sortiert um', [n.label, n.key ? '  (Alt+' + n.key + ')' : n.hint ? '  (' + n.hint + ')' : '']) + (n.to === '/plugins' && pluginNews.value.length ? '\n' + pluginNews.value.join('\n') : '')
const railItems = computed(() => {
  // ▣ Baum führt zum zuletzt gewählten Knoten zurück; Kennung des Eintrags bleibt '/tree' (Reihenfolge, aktiv)
  const treeTo = store.lastNode ? `/tree/${store.lastNode}` : '/tree'
  // Ein Plugin, das der Nutzer aus der Leiste genommen hat (⌁ Plugins → „nicht in der Leiste“), zählt in seinem Thema nicht
  // — kein eigenes Symbol, kein Thema nur seinetwegen
  const left = topic => (entries.value[topic] ?? []).filter(e => !e.plugin || !store.railOff.includes(e.plugin))
  // Ein Thema mit genau einem Eintrag: das Symbol führt direkt hin, die Übersicht wäre nur ein Klick mehr
  const direct = n => n.topic && !n.always && left(n.topic).length === 1 ? { ...n, href: left(n.topic)[0].to } : n
  const all = [...nav.filter(n => !n.topic || n.always || baseTopics.value.has(n.topic) || left(n.topic).length).map(n => n.to === '/tree' ? { ...n, href: treeTo } : direct(n)), { to: 'spacer' }, ...navBottom]
  const order = store.railOrder ?? []
  const known = new Set(all.map(x => x.to))
  const sorted = order.filter(k => known.has(k)).map(k => all.find(x => x.to === k))
  const rest = all.filter(x => !order.includes(x.to))
  const si = sorted.findIndex(x => x.to === 'spacer')
  return si < 0 ? [...sorted, ...rest] : [...sorted.slice(0, si), ...rest.filter(x => x.to !== 'spacer'), ...sorted.slice(si)]
})
// Umsortieren per Drag & Drop: Symbol packen, auf ein anderes fallen lassen = davor einordnen; auf den Spacer = ans Ende oben
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
    <!-- Fortschritt eines laufenden Stapels: dünner Balken ganz oben, dazu Zahl — sichtbar in jeder Ansicht -->
    <div v-if="store.progress" class="progress" :title="$t('{0} … {1} von {2} — Fenster offen lassen', [store.progress.text, store.progress.done, store.progress.total])">
      <div class="bar" :style="`width:${Math.round(store.progress.done / Math.max(1, store.progress.total) * 100)}%`" />
      <span class="txt">{{ $t("{0} … {1} / {2} — Fenster offen lassen", [store.progress.text, store.progress.done, store.progress.total]) }}</span>
    </div>
    <nav class="rail" v-if="!route.query.popup">
      <!-- Logo: web/public/logo.png — Vite legt public/ neben die Seite -->
      <router-link to="/tree" class="rail-logo" :title="$t('journali PIM')"><img :src="'/logo-128.png'" :alt="$t('journali PIM')" onerror="this.style.display='none'" /></router-link>
      <template v-for="n in railItems" :key="n.to">
        <div v-if="n.to === 'spacer'" class="rail-spacer" :class="{ over: dragKey }" @dragover.prevent @drop="railDrop('spacer')" />
        <router-link v-else :to="n.href ?? n.to" class="rail-item" :class="{ active: n.topic ? topicOfPath(route.path) === n.topic : route.path.startsWith(n.to), dragging: dragKey === n.to }"
          :title="railTitle(n)" draggable="true"
          @dragstart="dragKey = n.to" @dragend="dragKey = null" @dragover.prevent @drop="railDrop(n.to)">
          <span class="icon">{{ n.icon }}</span>
          <!-- Lämpchen: ein Plugin hat eine neuere Fassung auf der Platte oder ist noch nicht installiert -->
          <span v-if="n.to === '/plugins' && pluginNews.length" class="lamp" />
        </router-link>
      </template>
      <div class="rail-status" :class="{ online: store.online, offline: store.online === false }"
        :title="store.online ? $t('Server erreichbar · #{0}', [store.head]) : store.error || $t('Server wird gesucht …')">
        ●
      </div>
    </nav>

    <main class="content">
      <div v-if="crashed" class="pane" style="flex:1"><div class="empty"><div class="neg" style="font-weight:600">{{ $t("✗ Diese Ansicht ist abgestürzt") }}</div><div class="mono muted" style="margin:8px 0">{{ crashed }}</div><button class="primary" @click="crashed = null; $router.push('/tree')">{{ $t("▣ Zum Baum") }}</button> <button @click="reload">{{ $t("↻ Neu laden") }}</button></div></div>
      <router-view v-else />
    </main>

    <header class="status" v-if="!route.query.popup">
      <span class="brand" :title="$t('journali PIM')">{{ $t("journali PIM") }}</span>
      <!-- Version und Bau statt eines zweiten Lämpchens — das in der Leiste links sagt dasselbe -->
      <span v-if="store.online" class="mono muted" :title="`journali ${store.version ?? ''} · gebaut ${store.builtAt}`">{{ store.version }}<span v-if="store.build"> ·{{ store.build }}</span></span>
      <span v-else class="dot" :class="{ offline: store.online === false }">●</span>
      <span class="mono">#{{ store.head }}</span>
      <span class="sep">·</span>
      <span>▣ {{ store.nodes }}</span>
      <template v-if="store.usage"><span class="sep">·</span><router-link to="/settings#teams" class="muted" :title="$t('Nutzung anzeigen')"><UsageMini :usage="store.usage" /></router-link></template>
      <!-- Ohne Team gibt es kein Kontingent — und damit keine Pflege -->
      <template v-else-if="store.auth.enabled && store.auth.user"><span class="sep">·</span><router-link to="/settings#teams" class="warn" :title="$t('Ohne Kontingent weist der Server jede Änderung ab; es kommt aus der Lizenz oder von einem Team, über das abgerechnet wird.')">◍ {{ store.auth.team ? $t('kein Kontingent') : $t('kein Team') }}</router-link></template>
      <!-- KI-Austauschvolumen: was journali hingeschickt und zurückbekommen hat — gemessen, nicht geschätzt -->
      <template v-if="ai.server?.ready"><span class="sep">·</span><router-link to="/settings#teams" class="ai"
        :title="$t('KI Austauschvolumen (mengenbasiert) — Diese Kennzahl gibt an, welche Datenmenge mit KIs über deren APIs ausgetauscht wurden (Senden+Empfangen). Wird zum Monatsbeginn zurückgesetzt.')"
        >{{ $t("✧ KI {0}", [kb(ai.server.volume?.month)]) }}</router-link></template>
      <span class="grow" />
      <button v-if="store.stale" class="primary" style="padding:0 8px;height:20px;font-size:12px" @click="reload" :title="$t('Neue Fassung der Oberfläche laden')">{{ $t("↻ Neue Fassung") }}</button>
      <template v-if="store.auth.enabled && store.auth.user"><span class="actor" :title="$t('Rolle') + ' ' + store.auth.role + ' · ' + (store.auth.rights ?? []).join(', ')">👤 {{ store.auth.name || store.auth.user }} <span class="muted">· {{ store.auth.role }}</span></span><button class="x" style="height:20px;padding:0 6px;font-size:12px" @click="logout" :title="$t('abmelden')">⏻</button></template>
      <span v-else-if="store.actor" class="actor">👤 {{ store.actor }}</span>
      <router-link v-else to="/settings" class="warn">{{ $t("👤 Name fehlt → Einstellungen") }}</router-link>
      <!-- Hilfe: ein ? ganz rechts, dahinter die Links — Website, später Forum und Fehlermeldungen auf Git -->
      <HelpButton />
    </header>

    <ContextMenu />
    <Dialog />

    <div class="toasts">
      <div v-for="t in store.toasts" :key="t.id" class="toast" :class="t.kind">{{ t.text }}<button v-if="t.action" class="toast-action" :title="t.action.title" @click="store.dismiss(t); t.action.run()">{{ t.action.label }}</button></div>
    </div>
  </div>
</template>
