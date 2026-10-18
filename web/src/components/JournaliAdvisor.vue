<script setup>
// journali advisor (18.10.2026, docs/todo-journali-advisor.md): Fragen zur Bedienung — „Wie mache ich …?“ — beantwortet aus der Hilfe. Ein Fenster
// unten rechts über der Ansicht, blau wie journali (der product advisor eines Shops ist grün). Ohne KI zeigt es die passenden Abschnitte, ein Klick
// öffnet das Kapitel an der Stelle; mit der KI des Teams steht darüber eine kurze Antwort mit Verweisen [H1]. Das Gespräch bleibt, solange die
// Seite offen ist. Geöffnet wird es im Hilfemenü, in der Demo auch mit dem blauen Knopf oben.
import { ref, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { advisor, closeAdvisor, openHelp, chapterFor } from '../help.js'
import { frage } from '../journaliAdvisor.js'

const route = useRoute()
const router = useRouter()
const q = ref('')
const verlauf = ref([])        // [{ frage, treffer: null (läuft) | [...], antwort, warnung }]
const laeuft = ref(false)
const feld = ref(null), liste = ref(null)

watch(() => advisor.open, auf => { if (auf) nextTick(() => feld.value?.focus()) }, { immediate: true })

const ansEnde = () => nextTick(() => { if (liste.value) liste.value.scrollTop = liste.value.scrollHeight })

async function fragen() {
  const text = q.value.trim()
  if (!text || laeuft.value) return
  q.value = ''; laeuft.value = true
  verlauf.value.push({ frage: text, treffer: null, orte: [], antwort: null, warnung: null })
  const e = verlauf.value[verlauf.value.length - 1]
  ansEnde()
  try { Object.assign(e, await frage(text, { kapitel: chapterFor(route?.path ?? location.pathname) })) }
  catch (x) { e.treffer = []; e.warnung = x.message }
  finally { laeuft.value = false; ansEnde(); nextTick(() => feld.value?.focus()) }
}

/// Ein Ort der Oberfläche (Wo): hingehen — das Fenster bleibt offen
function geheZu(o) { if (router) router.push(o.to); else location.hash = o.to }

/// Ein Abschnitt: das Kapitel an dieser Stelle — die Einleitung eines Kapitels ohne Sprung
function zeige(a) { openHelp(a.slug, a.ebene > 1 ? a.titel : '') }
</script>

<template>
  <Teleport to="body">
    <div v-if="advisor.open" class="ja-fenster" role="dialog" aria-label="journali advisor" @keydown.esc.stop="closeAdvisor()">
      <div class="ja-kopf">
        <span class="ja-titel">journali advisor</span>
        <button type="button" class="ja-zu" :title="$t('schliessen (Esc)')" @click="closeAdvisor()">✕</button>
      </div>
      <div ref="liste" class="ja-verlauf">
        <div v-if="!verlauf.length" class="ja-blase ja-gruss">{{ $t('Fragen zur Bedienung beantworte ich aus der Hilfe.') }}</div>
        <template v-for="(e, i) in verlauf" :key="i">
          <div class="ja-frage">{{ e.frage }}</div>
          <div class="ja-blase">
            <div v-if="!e.treffer" class="muted ja-laeuft">…</div>
            <template v-else>
              <div v-if="e.antwort" class="ja-antwort">{{ e.antwort }}</div>
              <div v-if="e.antwort" class="muted ja-ki" :title="$t('aus den Abschnitten darunter')">{{ $t('Text von einer KI erstellt') }}</div>
              <div v-if="e.warnung" class="neg ja-warnung">✗ {{ e.warnung }}</div>
              <div v-if="e.orte?.length" class="ja-orte">
                <span class="muted">{{ $t('Zu finden unter:') }}</span>
                <button v-for="o in e.orte" :key="o.to" type="button" class="ja-ort-link" :title="$t('dorthin')" @click="geheZu(o)">{{ o.titel }}</button>
              </div>
              <div v-if="!e.treffer.length && !e.orte?.length" class="ja-leer">{{ $t('Dazu steht nichts in der Hilfe.') }}</div>
              <div v-else-if="!e.antwort" class="muted ja-satz">{{ $t('Dazu steht in der Hilfe:') }}</div>
              <button v-for="(a, j) in e.treffer" :key="j" type="button" class="ja-abschnitt" :title="$t('im Kapitel lesen')" @click="zeige(a)">
                <span class="ja-ort"><span class="mono ja-nr">H{{ j + 1 }}</span> {{ a.kapitel }}<template v-if="a.ebene > 1"> › {{ a.titel }}</template></span>
                <span class="ja-auszug">{{ a.auszug }}</span>
              </button>
            </template>
          </div>
        </template>
      </div>
      <form class="ja-eingabe" @submit.prevent="fragen">
        <input ref="feld" v-model="q" class="ja-feld" maxlength="300" :placeholder="$t('Wie mache ich …?')" :aria-label="$t('Wie mache ich …?')" />
        <button type="submit" class="primary" :disabled="laeuft || !q.trim()">{{ $t('Fragen') }}</button>
      </form>
    </div>
  </Teleport>
</template>

<style scoped>
.ja-fenster { position: fixed; right: 16px; bottom: 16px; width: min(440px, calc(100vw - 32px)); height: min(640px, calc(100vh - 80px)); z-index: 25;
  display: flex; flex-direction: column; background: var(--bg); color: var(--text); border: 1px solid var(--line); border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0,0,0,.4); overflow: hidden; }
.ja-kopf { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--accent); color: #fff; }
.ja-titel { flex: 1; font-weight: 700; }
.ja-zu { border: 0; background: none; color: #fff; font-size: 14px; cursor: pointer; padding: 0 4px; }
.ja-verlauf { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.ja-blase { align-self: flex-start; max-width: 100%; background: var(--pane); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
.ja-frage { align-self: flex-end; max-width: 85%; background: var(--accent); color: #fff; border-radius: 8px; padding: 6px 10px; white-space: pre-wrap; }
.ja-antwort { white-space: pre-wrap; line-height: 1.45; }
.ja-ki { font-size: 11px; }
.ja-abschnitt { display: flex; flex-direction: column; gap: 2px; text-align: left; border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 6px;
  background: var(--bg); color: var(--text); padding: 6px 8px; cursor: pointer; font: inherit; }
.ja-abschnitt:hover { border-color: var(--accent); }
.ja-ort { font-weight: 600; font-size: 12px; }
.ja-nr { color: var(--accent); }
.ja-auszug { font-size: 12px; color: var(--muted); line-height: 1.4; }
.ja-orte { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.ja-ort-link { border: 1px solid var(--accent); background: var(--accent-soft); color: var(--accent); border-radius: 12px; padding: 2px 10px; cursor: pointer; font: inherit; font-size: 12px; font-weight: 600; }
.ja-eingabe { display: flex; gap: 6px; padding: 10px; border-top: 1px solid var(--line); }
.ja-feld { flex: 1; min-width: 0; }
</style>
