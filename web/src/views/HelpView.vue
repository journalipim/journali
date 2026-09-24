<script setup>
// Hilfe in der Instanz: Kapitel links, Text rechts, Suche über alle Kapitel. Die Kapitel kommen als fertiges HTML aus
// /help/<code>/ (web/build-help.mjs); gibt es sie in der Oberflächensprache nicht, kommt das deutsche.
// Der ?-Knopf in der Kopfzeile öffnet das Kapitel zur aktuellen Ansicht (help.js: chapterFor).
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { i18n, DEFAULT_LANG } from '../i18n.js'

const props = defineProps({ chapter: { type: String, default: '' } })
const router = useRouter()
const index = ref([])        // [{ slug, title, nr }]
const lang = ref(DEFAULT_LANG)
const html = ref('')
const q = ref('')
const texts = ref({})        // slug → Klartext für die Suche, bei Bedarf geladen
const busy = ref(false)

async function ladeIndex() {
  for (const code of [i18n.global.locale.value, DEFAULT_LANG]) {
    try {
      const r = await fetch(`/help/${code}/index.json`)
      if (r.ok) { index.value = await r.json(); lang.value = code; return }
    } catch { /* nächste Sprache */ }
  }
  index.value = []
}
async function ladeKapitel(slug) {
  if (!slug) { html.value = ''; return }
  busy.value = true
  try {
    for (const code of [lang.value, DEFAULT_LANG]) {
      const r = await fetch(`/help/${code}/${encodeURIComponent(slug)}.html`)
      if (r.ok) { html.value = await r.text(); return }
    }
    html.value = ''
  } finally { busy.value = false }
}
async function ladeTexte() {
  for (const k of index.value) {
    if (texts.value[k.slug] != null) continue
    try { const r = await fetch(`/help/${lang.value}/${encodeURIComponent(k.slug)}.html`); texts.value[k.slug] = r.ok ? (await r.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase() : '' } catch { texts.value[k.slug] = '' }
  }
}
const treffer = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return index.value
  return index.value.filter(k => k.title.toLowerCase().includes(s) || (texts.value[k.slug] ?? '').includes(s))
})
function go(slug) { router.push(`/help/${slug}`) }

onMounted(async () => { await ladeIndex(); if (props.chapter) ladeKapitel(props.chapter); else if (index.value[0]) go(index.value[0].slug) })
watch(() => props.chapter, s => ladeKapitel(s))
watch(() => i18n.global.locale.value, async () => { await ladeIndex(); texts.value = {}; ladeKapitel(props.chapter) })
watch(q, s => { if (s.trim()) ladeTexte() })
</script>

<template>
  <div class="pane help-pane">
    <aside class="help-nav">
      <div class="toolbar"><h1>{{ $t("? Hilfe") }}</h1><span class="muted">{{ index.length }}</span></div>
      <input v-model="q" type="search" class="help-search" :placeholder="$t('Suche in allen Kapiteln')" />
      <div class="scroll">
        <a v-for="k in treffer" :key="k.slug" href="#" class="help-chapter" :class="{ on: k.slug === chapter }" @click.prevent="go(k.slug)"><span class="mono muted">{{ k.nr }}</span> {{ k.title }}</a>
        <div v-if="!index.length" class="empty">{{ $t("Keine Kapitel gebaut — npm run build in web/.") }}</div>
      </div>
    </aside>
    <main class="help-body scroll">
      <div v-if="busy" class="muted">…</div>
      <div v-else-if="html" class="help-text" v-html="html" />
      <div v-else class="empty">{{ $t("Kapitel links wählen.") }}</div>
    </main>
  </div>
</template>

<style scoped>
.help-pane { display: flex; height: 100%; }
.help-nav { width: 300px; min-width: 240px; border-right: 1px solid var(--line); display: flex; flex-direction: column; }
.help-nav .scroll { flex: 1; }
.help-search { margin: 4px 8px; width: calc(100% - 16px); }
.help-chapter { display: block; padding: 5px 10px; color: var(--text); text-decoration: none; border-left: 3px solid transparent; }
.help-chapter:hover { background: var(--pane); }
.help-chapter.on { border-left-color: var(--accent); background: var(--pane); }
.help-body { flex: 1; padding: 16px 28px; }
.help-text { max-width: 860px; line-height: 1.5; font-size: 14px; }
.help-text :deep(h1) { font-size: 22px; margin: 0 0 12px; }
.help-text :deep(h2) { font-size: 16px; margin: 22px 0 8px; border-bottom: 1px solid var(--line); padding-bottom: 3px; }
.help-text :deep(h3) { font-size: 14px; margin: 16px 0 6px; }
.help-text :deep(code) { font-family: ui-monospace, Consolas, monospace; font-size: 12px; background: var(--pane); padding: 1px 4px; border-radius: 3px; }
.help-text :deep(pre) { background: var(--pane); padding: 8px 10px; border-radius: 4px; overflow: auto; }
.help-text :deep(table) { border-collapse: collapse; margin: 8px 0; }
.help-text :deep(td), .help-text :deep(th) { border: 1px solid var(--line); padding: 4px 8px; text-align: left; vertical-align: top; }
.help-text :deep(a) { color: var(--accent); }
</style>
