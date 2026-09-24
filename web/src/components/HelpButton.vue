<script setup>
// Der ?-Knopf rechts in der Kopfzeile (Taloan, 24.09.2026): öffnet das Menü mit den Hilfe-Links aus help.js.
// Kontextsensitive Hilfe bleibt bei den ?-Knöpfen in den Ansichten; hier steht, wohin man sonst geht.
import { menu } from '../menu.js'
import { helpItems } from '../help.js'

function open(e) { menu.open(e, helpItems()) }
</script>

<template>
  <button class="help" :title="$t('Hilfe: Website, später Forum und Fehlermeldungen auf Git')" @click="open">?</button>
</template>
