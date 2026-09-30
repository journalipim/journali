<script setup>
// ⌗ Klassifikation → GPC: derselbe Dialog wie am Knoten, hier als Seite — mit der Veröffentlichung und der Wahl des Knotens.
import { useRoute } from 'vue-router'
import Klasse from './Klasse.vue'
const route = useRoute()
</script>

<template>
  <div class="pane" style="flex:1"><Klasse :key="String(route.query.node ?? '')" :node="String(route.query.node ?? '')" /></div>
</template>
