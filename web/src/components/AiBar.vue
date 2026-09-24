<script setup>
// ✦ KI-Leiste im Editor: ÜBERARBEITEN (Verbessern, Kürzen, Ausführlicher) und ERZEUGEN (@ Liste aus Produktdaten,
// @ Marketingtext sachlich/emotional/vergleichend) — dazu eine eigene Anweisung. Das Ergebnis geht in den Entwurf:
// entweder ersetzt es ihn oder es wird an der Schreibmarke ergänzt; gespeichert wird erst mit Speichern.
import { ref } from 'vue'
import { ai } from '../ai.js'
import { store } from '../store.js'
import { PRESETS, rewrite } from '../aiText.js'

// panel: Auswahl eines Behälters im Editor — dort steht die Leiste im Fluss und schiebt den Text nach unten
const props = defineProps({ current: String, html: Boolean, label: String, locale: String, node: String, panel: String })
const emit = defineEmits(['result'])
const open = ref(false); const busy = ref(''); const own = ref('')
const mode = ref(localStorage.getItem('journali.ai.mode') || 'replace')   // replace | insert
function setMode(m) { mode.value = m; localStorage.setItem('journali.ai.mode', m) }
const edits = PRESETS.filter(p => p[3] === 'edit')
const gens = PRESETS.filter(p => p[3] === 'gen')
async function run(instruction) {
  if (!instruction) return
  busy.value = `fragt ${ai.label()} …`
  // die Leiste bleibt offen — man arbeitet meist mehrere Schritte hintereinander
  try { emit('result', { text: await rewrite({ instruction, current: props.current, html: props.html, label: props.label, locale: props.locale, node: props.node }), mode: mode.value }); own.value = '' }
  catch (e) { store.toast(e.message) } finally { busy.value = '' }
}
</script>

<template>
  <button class="ai" :class="{ on: open }" @mousedown.prevent @click="open = !open" :title="ai.available() ? $t('Text mit der KI (') + ai.label() + $t(') bearbeiten — mit den Produktdaten dieses Knotens; jede Anfrage kostet Token') : $t('KI-Schlüssel fehlt — ⚙ Einstellungen → KI')" :disabled="!ai.available()">{{ $t("✦ KI") }}</button>
  <!-- echtes Teleport: die Leiste gehört in den Behälter des Editors, nicht in den Werkzeugbalken -->
  <Teleport v-if="panel" :to="panel" defer>   <!-- defer: der Behälter entsteht erst nach dem Werkzeugbalken -->
    <div v-if="open" class="aibar flow" @mousedown.stop>
    <!-- Beschriftungen als Überschrift über der Reihe, nicht daneben -->
    <div class="col">
      <span class="muted lbl">{{ $t("überarbeiten") }}</span>
      <div class="grp"><button v-for="[k, l, hint] in edits" :key="k" class="x" @click="run(k)" :title="hint" :disabled="!!busy">{{ l }}</button></div>
    </div>
    <div class="col">
      <span class="muted lbl">{{ $t("erzeugen") }}</span>
      <div class="grp"><button v-for="[k, l, hint] in gens" :key="k" class="x ai" @click="run(k)" :title="hint" :disabled="!!busy">{{ l }}</button></div>
    </div>
    <div class="col grow">
      <span class="muted lbl">{{ $t("eigene Anweisung") }}</span>
      <input v-model="own" type="text" :placeholder="$t('… und Enter')" @keydown.enter.stop="run(own)" @keydown.esc.stop="open = false" :disabled="!!busy" />
    </div>
    <div class="col">
      <span class="muted lbl">{{ $t("Ergebnis") }}</span>
      <div class="grp">
        <button class="x" :class="{ primary: mode === 'replace' }" @click="setMode('replace')" :title="$t('das Ergebnis ersetzt den ganzen Entwurf')">{{ $t("Text ersetzen") }}</button>
        <button class="x" :class="{ primary: mode === 'insert' }" @click="setMode('insert')" :title="$t('das Ergebnis wird an der Schreibmarke eingefügt — der übrige Text bleibt')">{{ $t("Am Cursor ergänzen") }}</button>
      </div>
    </div>
      <span v-if="busy" class="ai" style="font-size:12px">{{ busy }}</span>
    </div>
  </Teleport>
  <div v-else-if="open" class="aibar" @mousedown.stop>
    <span class="muted lbl">{{ $t("KI-Leiste ohne Behälter — bitte panel setzen") }}</span>
  </div>
</template>

<style scoped>
.ai.on { background: var(--accent-soft); }
/* eigene Zeile unter der Werkzeugleiste (die umbricht nicht) — links ausgerichtet, Knöpfe einzeilig */
.aibar.flow { position: static; box-shadow: none; border-top: 0; }   /* im Fluss: der Text darunter schrumpft, nichts wird verdeckt */
.aibar { position: absolute; left: 0; right: 0; top: 100%; z-index: 5; display: flex; gap: 14px; align-items: flex-end; flex-wrap: wrap;
  padding: 5px 8px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); background: var(--pane); box-shadow: 0 6px 16px rgba(0,0,0,.25); }
.col { display: flex; flex-direction: column; gap: 2px; }
.col.grow { flex: 1; min-width: 160px; }
.col input { width: 100%; }
.grp { display: flex; gap: 4px; align-items: center; }
.aibar button { white-space: nowrap; min-width: 0; }
.up .aibar, :global(.up) .aibar { top: auto; bottom: 100%; }   /* in der Fusszeile: nach oben aufklappen */
.lbl { font-size: 11px; white-space: nowrap; }
</style>
