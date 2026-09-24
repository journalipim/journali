<script setup>
// Hilfe als Fenster über der Ansicht — kein Seitenwechsel: wer etwas nachliest, bleibt, wo er war.
// Kapitel links, Text rechts, Suche über alle Kapitel. Der Inhalt kommt als fertiges HTML aus /help/<code>/
// (web/build-help.mjs); gibt es ein Kapitel in der Oberflächensprache nicht, kommt das deutsche.
// Geöffnet wird es über help.js (openHelp), geschlossen mit Esc, dem ✕ oder einem Klick daneben.
import { ref, computed, watch } from 'vue'
import { i18n, DEFAULT_LANG } from '../i18n.js'
import { hilfe, closeHelp } from '../help.js'

const index = ref([])        // [{ slug, title, nr }]
const lang = ref(DEFAULT_LANG)
const html = ref('')
const q = ref('')
const texts = ref({})        // slug → Klartext für die Suche, bei Bedarf geladen
const busy = ref(false)
const body = ref(null)

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
  } finally { busy.value = false; if (body.value) body.value.scrollTop = 0 }
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
function go(slug) { hilfe.chapter = slug }

// Erst laden, wenn es zum ersten Mal aufgeht — die Kapitel holt niemand, der nie Hilfe braucht
watch(() => hilfe.open, async auf => {
  if (!auf) return
  if (!index.value.length) await ladeIndex()
  if (!hilfe.chapter && index.value[0]) hilfe.chapter = index.value[0].slug
  else ladeKapitel(hilfe.chapter)
}, { immediate: true })
watch(() => hilfe.chapter, s => { if (hilfe.open) ladeKapitel(s) })
watch(() => i18n.global.locale.value, async () => { if (!index.value.length) return; await ladeIndex(); texts.value = {}; ladeKapitel(hilfe.chapter) })
watch(q, s => { if (s.trim()) ladeTexte() })
</script>

<template>
  <Teleport to="body">
    <div v-if="hilfe.open" class="help-overlay" @mousedown.self="closeHelp()" @keydown.esc="closeHelp()" tabindex="-1">
      <div class="help-box">
        <div class="toolbar">
          <h1>{{ $t("? Hilfe") }}</h1><span class="muted">{{ index.length }}</span>
          <input v-model="q" type="search" class="help-search" :placeholder="$t('Suche in allen Kapiteln')" @keydown.esc.stop="q ? q = '' : closeHelp()" />
          <span class="grow" />
          <button class="x" @click="closeHelp()" :title="$t('schliessen (Esc)')">✕</button>
        </div>
        <div class="help-split">
          <aside class="help-nav scroll">
            <a v-for="k in treffer" :key="k.slug" href="#" class="help-chapter" :class="{ on: k.slug === hilfe.chapter }" @click.prevent="go(k.slug)"><span class="mono muted">{{ k.nr }}</span> {{ k.title }}</a>
            <div v-if="!index.length" class="empty">{{ $t("Keine Kapitel gebaut — npm run build in web/.") }}</div>
          </aside>
          <main ref="body" class="help-body scroll">
            <div v-if="busy" class="muted">…</div>
            <div v-else-if="html" class="help-text" v-html="html" />
            <div v-else class="empty">{{ $t("Kapitel links wählen.") }}</div>
          </main>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.help-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: grid; place-items: center; z-index: 30; }
.help-box { width: min(1100px, 94vw); height: min(760px, 90vh); background: var(--bg); border: 1px solid var(--line); border-radius: 6px; display: flex; flex-direction: column; box-shadow: 0 12px 40px rgba(0,0,0,.4); overflow: hidden; }
.help-split { flex: 1; display: flex; min-height: 0; }
.help-nav { width: 290px; flex: none; border-right: 1px solid var(--line); }
.help-search { margin-left: 12px; width: 220px; }
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
.x { border: 0; background: none; color: var(--muted); font-size: 14px; padding: 0 6px; }
.x:hover { color: var(--fg); }
</style>
