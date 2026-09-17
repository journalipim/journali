<script setup>
// Ein Kopf für alle Importquellen (Taloan, 17.09.2026: „völlig unstrukturiert, der Bildschirm springt“):
// dieselbe Ordnung in jeder Quelle — Titel, echte Reiter (IXP · Solr · Tabelle), dann ein Formular mit fester
// Beschriftungsspalte: Profil zuerst, darunter die Zeilen der Quelle (Slot). Nichts verschiebt sich beim Wechsel.
import { plugins } from '../plugins.js'
import ProfileBar from './ProfileBar.vue'
defineProps({ source: String, plugin: String, busy: String, get: Function, set: Function })
const TABS = [['ixp', 'IXP', '/import'], ['solr', 'Solr', '/import/solr'], ['table', 'Tabelle', '/import/table']]
const on = k => k === 'table' || plugins.enabled(k)
</script>

<template>
  <div class="toolbar"><h1>⇩ Import</h1><span class="grow" /><span v-if="busy" class="muted">{{ busy }}</span><slot name="status" /></div>
  <div class="tabs">
    <router-link v-for="[k, label, to] in TABS" :key="k" :to="to" class="tabbtn" :class="{ on: source === k, locked: !on(k) }" :title="on(k) ? label : `Plugin ${k} ist aus — ⌁ Plugins`">{{ label }}<span v-if="!on(k)"> ⌁</span></router-link>
  </div>
  <table class="grid form"><colgroup><col style="width:84px" /><col /></colgroup><tbody>
    <tr class="step"><td colspan="2">1 · Quelle</td></tr>
    <tr><td class="attr">Profil</td><td><ProfileBar :key="plugin" :plugin="plugin" :get="get" :set="set" /></td></tr>
    <slot />
  </tbody></table>
</template>

<style scoped>
.tabs { display: flex; gap: 2px; padding: 6px 8px 0; border-bottom: 1px solid var(--line); background: var(--bg); }
.tabbtn { border: 1px solid var(--line); border-bottom: 0; border-radius: 6px 6px 0 0; background: var(--bg); color: var(--muted); padding: 2px 12px; font-size: 12px; line-height: 18px; text-decoration: none; }
.tabbtn.on { background: var(--pane); color: var(--text); font-weight: 600; }
.tabbtn.locked { opacity: .6; }
.form { width: 100%; border-bottom: 1px solid var(--line); }
.form td { height: 30px; vertical-align: middle; white-space: normal; padding: 2px 4px; }
.form td.attr { color: var(--muted); white-space: nowrap; padding-left: 8px; }
.form :deep(tr.step td) { height: 24px; padding: 0 8px; font-size: 12px; font-weight: 600; letter-spacing: .02em; background: var(--accent-soft); border-top: 2px solid var(--accent); color: var(--text); }
.form :deep(input[type=text]), .form :deep(input[type=password]), .form :deep(input[type=search]) { width: 100%; box-sizing: border-box; }
.form :deep(.row) { display: flex; gap: 4px; align-items: center; }
.form :deep(.row > input) { flex: 1; min-width: 0; }
</style>
