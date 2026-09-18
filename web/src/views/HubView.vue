<script setup>
// Übersicht eines Themas (Taloan, 18.09.2026): nach Klick auf ⇩ Import (⇪ Export, 📄 Datenblatt, ✓ Datenanalyse, ⌁ Werkzeuge)
// wählt man hier das Plugin, das man ausführen will — eine Zeile je Ansicht, mit Plugin und Fassung. Kein festes
// Spaltenlayout für alle: jede Ansicht hat ihr eigenes.
import { computed } from 'vue'
import { plugins } from '../plugins.js'
import { TOPICS, entries } from '../topics.js'
const props = defineProps({ topic: String })
const t = computed(() => TOPICS.find(x => x.key === props.topic))
const list = computed(() => entries.value[props.topic] ?? [])
const version = key => plugins.list.find(p => p.key === key)?.version
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar"><h1>{{ t?.icon }} {{ t?.label }}</h1><span class="grow" /><span class="muted">{{ list.length }}</span></div>
    <div class="scroll" style="padding:8px">
      <div v-if="!list.length" class="empty">Kein Plugin für {{ t?.label }} eingeschaltet — <router-link to="/plugins">⌁ Plugins</router-link></div>
      <router-link v-for="e in list" :key="e.to" :to="e.to" class="hub-row">
        <span class="icon">{{ e.icon }}</span>
        <span class="name">{{ e.label }}</span>
        <span class="muted hint">{{ e.hint }}</span>
        <span class="grow" />
        <span v-if="e.plugin" class="mono muted small">{{ e.plugin }} {{ version(e.plugin) }}</span>
        <span v-else class="muted small">eingebaut</span>
      </router-link>
    </div>
  </div>
</template>

<style scoped>
.hub-row { display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border: 1px solid var(--line); border-radius: 6px; margin-bottom: 6px; color: var(--text); text-decoration: none; background: var(--pane); }
.hub-row:hover { background: var(--hover); border-color: var(--accent); }
.hub-row .icon { width: 22px; text-align: center; }
.hub-row .name { font-weight: 600; min-width: 120px; }
.hub-row .hint { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hub-row .small { font-size: 11px; }
</style>
