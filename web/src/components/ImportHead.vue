<script setup>
// Ein Kopf für alle Importquellen (Taloan, 17.09.2026: „völlig unstrukturiert, der Bildschirm springt“):
// dieselbe Ordnung in jeder Quelle — Titel, echte Reiter (IXP · Solr · Tabelle), dann ein Formular mit fester
// Beschriftungsspalte: Profil zuerst, darunter die Zeilen der Quelle (Slot). Nichts verschiebt sich beim Wechsel.
import ProfileBar from './ProfileBar.vue'
import { t } from '../i18n.js'
defineProps({ source: String, plugin: String, busy: String, get: Function, set: Function })
// Keine Reiter mehr über die Quellen hinweg (Taloan, 18.09.): das Thema ⇩ Import ist die Übersicht, hier nur der Krümel zurück
const NAMES = { ixp: 'IXP', solr: t('Solr'), table: t('Tabelle') }
</script>

<template>
  <div class="toolbar"><h1><router-link to="/import" class="crumb" :title="$t('zur Übersicht Import')">{{ $t("⇩ Import") }}</router-link> › {{ NAMES[source] ?? source }}</h1><span class="grow" /><span v-if="busy" class="busy">⏳ {{ busy }}</span><slot name="status" /></div>
  <table class="grid form"><colgroup><col style="width:84px" /><col /></colgroup><tbody>
    <tr class="step"><td colspan="2">{{ $t("1 · Quelle") }}</td></tr>
    <tr><td class="attr">{{ $t("Profil") }}</td><td><ProfileBar :key="plugin" :plugin="plugin" :get="get" :set="set" /></td></tr>
    <slot />
  </tbody></table>
</template>

<style scoped>
/* Statusmeldung beim Einlesen/Analysieren — leuchtend, sonst sieht man sie nicht (Taloan, 21.09.) */
.busy { background: var(--accent); color: #fff; font-weight: 600; padding: 2px 10px; border-radius: 4px; animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
.crumb { color: var(--muted); text-decoration: none; font-weight: 400; }
.crumb:hover { color: var(--accent); }
.form { width: 100%; border-bottom: 1px solid var(--line); }
.form td { height: 30px; vertical-align: middle; white-space: normal; padding: 2px 4px; }
.form td.attr { color: var(--muted); white-space: nowrap; padding-left: 8px; }
/* feste Spalten (Taloan, 21.09.: zusammengeschoben verschwanden die Felder — die Bandtexte hielten die Tabelle breiter als die Spalte): die Tabelle bleibt so breit wie die Spalte, lange Bänder werden gekürzt */
.form { table-layout: fixed; width: 100%; }
.form :deep(td) { overflow: hidden; text-overflow: ellipsis; }
.form :deep(tr.step td) { height: 24px; padding: 0 8px; font-size: 12px; font-weight: 600; letter-spacing: .02em; background: var(--accent-soft); border-top: 2px solid var(--accent); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.form :deep(input[type=text]), .form :deep(input[type=password]), .form :deep(input[type=search]) { width: 100%; box-sizing: border-box; }
.form :deep(.row) { display: flex; gap: 4px; align-items: center; }
.form :deep(.row > input) { flex: 1; min-width: 0; }
</style>
