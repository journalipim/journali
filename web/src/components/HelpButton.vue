<script setup>
// Der ?-Knopf rechts in der Kopfzeile: öffnet das Menü aus help.js — das Kapitel zur aktuellen Ansicht, alle Kapitel,
// die Links nach draussen. Kontextsensitive Kurzhilfe bleibt bei den ?-Knöpfen in den Ansichten.
import { useRoute, useRouter } from 'vue-router'
import { menu } from '../menu.js'
import { helpItems } from '../help.js'

const route = useRoute(); const router = useRouter()
// ohne Router (Test) fällt es auf die Adresse des Fensters zurück
function open(e) { menu.open(e, helpItems(undefined, route?.path ?? location.pathname, p => router ? router.push(p) : (location.href = p))) }
</script>

<template>
  <button class="help" :title="$t('Hilfe: Kapitel zu dieser Ansicht, alle Kapitel, Website, GitHub')" @click="open">?</button>
</template>
