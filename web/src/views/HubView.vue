<script setup>
// Übersicht eines Themas: nach Klick auf ⇩ Import (⇪ Export, ▤ Datenblatt, ✓ Datenanalyse, ⌁ Werkzeuge)
// wählt man hier das Plugin, das man ausführen will — als Kacheln: Symbol gross, Name,
// ein Satz aus dem Manifest, unten Plugin und Version. Kein festes Spaltenlayout für alle: jede Ansicht hat ihr eigenes.
import { computed, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { plugins } from '../plugins.js'
import { TOPICS, entries } from '../topics.js'
import { L } from '../i18n.js'
const props = defineProps({ topic: String })
const t = computed(() => TOPICS.find(x => x.key === props.topic))
const list = computed(() => entries.value[props.topic] ?? [])
// genau ein Eintrag: gleich dorthin — die Übersicht hätte nur eine Kachel
const router = useRouter()
watchEffect(() => { if (plugins.loaded && list.value.length === 1) router.replace(list.value[0].to) })
const meta = key => plugins.list.find(p => p.key === key)
const text = e => e.plugin ? (L(meta(e.plugin)?.manifest?.description) || meta(e.plugin)?.manifest?.description?.en || e.hint) : e.hint
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>{{ t?.icon }} {{ t?.label }}</h1><span class="grow" /><span class="muted">{{ list.length }}</span></div>
    <div class="scroll" style="padding:12px">
      <div v-if="!list.length" class="empty">{{ $t("Kein Plugin für {0} eingeschaltet —", [t?.label]) + ' ' }}<router-link to="/plugins">{{ $t("⬡ Plugins") }}</router-link></div>
      <div class="tiles">
        <router-link v-for="e in list" :key="e.to" :to="e.to" class="tile">
          <div class="head"><span class="icon">{{ e.icon }}</span><span class="name">{{ e.label }}</span></div>
          <div class="text muted">{{ text(e) }}</div>
          <div class="foot"><span v-if="e.plugin" class="mono muted">{{ e.plugin }} {{ meta(e.plugin)?.version }}</span><span v-else class="muted">{{ $t("eingebaut") }}</span><span class="grow" /><span class="go">{{ $t("öffnen ›") }}</span></div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.tile { display: flex; flex-direction: column; gap: 8px; min-height: 150px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--pane); color: var(--text); text-decoration: none; transition: border-color .12s, transform .12s, box-shadow .12s; }
.tile:hover { border-color: var(--accent); transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,.18); }
.tile .head { display: flex; align-items: center; gap: 10px; }
.tile .icon { font-size: 26px; line-height: 1; width: 34px; text-align: center; }
.tile .name { font-weight: 600; font-size: 15px; }
.tile .text { font-size: 12px; line-height: 1.45; flex: 1; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.tile .foot { display: flex; align-items: center; gap: 8px; font-size: 11px; }
.tile .go { color: var(--accent); font-size: 12px; opacity: 0; transition: opacity .12s; }
.tile:hover .go { opacity: 1; }
</style>
