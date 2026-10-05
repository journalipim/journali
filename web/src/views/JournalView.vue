<script setup>
// Das Journal, neueste zuerst, lebendig: beim Einhängen die letzten CHUNK Einträge, bei jedem neuen Serverstand nur die Einträge nach der letzten bekannten Nummer;
// ältere in Stücken nach unten (⇣ ältere).
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api, describe } from '../api.js'
import { store } from '../store.js'
import EntryList from '../components/EntryList.vue'
import { t } from '../i18n.js'

const route = useRoute()
const entries = ref([])
const filter = ref(String(route.query.q ?? ''))
watch(() => route.query.q, q => { if (q != null) filter.value = String(q) })
let pulling = null   // laufende Abfrage — Einhängen und erster Serverstand kommen fast gleichzeitig
const CHUNK = 5000
const MAX = 20000   // so viele Einträge hält die Ansicht höchstens — ein Import mit 100 000 Einträgen bei offenem Journal liess sie sonst wachsen, bis der Tab abstürzte
const oldest = computed(() => entries.value.length ? entries.value[entries.value.length - 1].number : null)
const loadingOlder = ref(false)

async function pull() {
  if (pulling) return pulling
  pulling = (async () => {
    try {
      let after = entries.value[0]?.number ?? 0
      const head = store.head || (await api.get('/api/health')).head || 0
      // erst die neuesten; liegt seit dem letzten Stand mehr als ein Stück dazwischen, beginnt die Ansicht neu bei den neuesten
      if (!entries.value.length || head - after > CHUNK) { entries.value = []; after = Math.max(0, head - CHUNK) }
      const fresh = (await api.get(`/api/journal?after=${after}&limit=${CHUNK}&brief=true`)).filter(e => e.number > after)
      if (fresh.length) { const all = [...fresh.reverse(), ...entries.value]; entries.value = all.length > MAX ? all.slice(0, MAX) : all }
    } catch (e) { store.toast(e.message) }
    finally { pulling = null }
  })()
  return pulling
}
onMounted(pull)
// ältere Einträge: das Stück vor dem ältesten bekannten
async function older() {
  if (loadingOlder.value || !oldest.value || oldest.value <= 1 || entries.value.length >= MAX) return   // höchstens MAX Einträge, auch beim Blättern
  loadingOlder.value = true
  try { const from = Math.max(0, oldest.value - 1 - CHUNK); const more = (await api.get(`/api/journal?after=${from}&limit=${CHUNK}&brief=true`)).filter(e => e.number < oldest.value); entries.value = [...entries.value, ...more.reverse()] }
  catch (e) { store.toast(e.message) } finally { loadingOlder.value = false }
}
watch(() => store.head, pull)

// Art der Arbeit als Filter: eine Kachel je Art, mehrere gleichzeitig; leer = alles
const KINDS = [['data', t('✎ Pflege')], ['publish', t('⇶ Ausleitung')], ['model', t('◫ Modell')], ['structure', t('▤ Struktur')], ['reference', t('⇩ Referenz')], ['setup', t('⚙ Einrichtung')], ['ops', t('⏱ Betrieb')]]
const kinds = ref(new Set())
const toggleKind = k => { const s = new Set(kinds.value); s.has(k) ? s.delete(k) : s.add(k); kinds.value = s }

const shown = computed(() => {
  const f = filter.value.trim().toLowerCase()
  const ks = kinds.value
  return entries.value.filter(e =>
    (!ks.size || ks.has(e.kind))
    && (!f || e.stream.toLowerCase().includes(f) || e.type.toLowerCase().includes(f)
      || e.actor.toLowerCase().includes(f) || describe(e).toLowerCase().includes(f)))
})
const kindCount = k => entries.value.filter(e => e.kind === k).length
// Gezeichnet werden ZEIGE Zeilen, „weitere“ die nächsten — 20 000 Tabellenzeilen auf einmal sind für den Browser zu viel
const ZEIGE = 1000
const zeige = ref(ZEIGE)
watch([filter, kinds], () => { zeige.value = ZEIGE })
const sichtbar = computed(() => shown.value.slice(0, zeige.value))

// Je Monat (05.10.2026): wie viele Einträge welcher Art ins Journal gingen — aus dem Abbild des Servers, also über das ganze Journal, nicht nur
// über die geladenen Einträge; als CSV zum Weitergeben. null = die Einträge stehen da.
const monate = ref(null)
async function jeMonat() {
  if (monate.value) { monate.value = null; return }
  try { monate.value = await api.get('/api/usage/months') } catch (e) { store.toast(e.message) }
}
function csv() {
  const arten = KINDS.map(([k]) => k)
  const zeilen = [['month', ...arten, 'total'], ...monate.value.map(m => [m.month, ...arten.map(k => m.kinds?.[k] ?? 0), m.total])]
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([zeilen.map(z => z.join(';')).join('\n') + '\n'], { type: 'text/csv' }))
  a.download = `journali-nutzung-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar">
      <h1>{{ $t("≡ Journal") }}</h1>
      <span class="muted" :title="oldest ? $t('geladen ab #{0}', [oldest]) : ''">{{ shown.length }}{{ shown.length !== entries.length ? ' / ' + entries.length : '' }}{{ oldest && oldest > 1 ? ` · ab #${oldest}` : '' }}</span>
      <input v-model="filter" type="search" :placeholder="$t('Filter: Strom, Typ, Name, Inhalt')" style="width:300px" />
      <span v-for="[k, label] in KINDS" :key="k" class="view-chip" :class="{ on: kinds.has(k) }" @click="toggleKind(k)" :title="$t('{0} Einträge dieser Art anzeigen', [kindCount(k)])">{{ label }}</span>
      <span class="view-chip je-monat" :class="{ on: monate }" @click="jeMonat" :title="$t('Einträge je Monat und Art, über das ganze Journal')">{{ $t("▦ je Monat") }}</span>
      <span class="grow" />
      <span class="muted mono">#{{ store.head }}</span>
    </div>
    <div v-if="monate" class="scroll">
      <div class="section">
        <h2 :title="$t('Alle Einträge im Journal, je Monat nach Art der Arbeit; nichts davon geht von selbst an journali.')">{{ $t("▦ Nutzung · {0} Monate", [monate.length]) }}</h2>
        <div class="chips"><button class="csv" :disabled="!monate.length" @click="csv" :title="$t('Als CSV-Datei speichern')">{{ $t("⇩ CSV") }}</button></div>
        <table class="grid nutzung">
          <thead><tr><th>{{ $t("Monat") }}</th><th v-for="[k, label] in KINDS" :key="k" class="num">{{ label }}</th><th class="num">Σ</th></tr></thead>
          <tbody><tr v-for="m in monate" :key="m.month"><td class="mono">{{ m.month }}</td><td v-for="[k] in KINDS" :key="k" class="num">{{ m.kinds?.[k] ?? 0 }}</td><td class="num">{{ m.total }}</td></tr></tbody>
        </table>
      </div>
    </div>
    <div v-else class="scroll"><EntryList :entries="sichtbar" show-stream />
      <div v-if="shown.length > sichtbar.length" class="chips" style="padding:8px"><button class="x weitere" @click="zeige += ZEIGE" :title="$t('Die nächsten Zeilen zeigen')">▼ {{ $t('weitere {0}', [Math.min(ZEIGE, shown.length - sichtbar.length)]) }}</button></div>
      <div v-if="oldest && oldest > 1" class="chips" style="padding:8px"><button class="x" :disabled="loadingOlder || entries.length >= MAX" @click="older" :title="$t('die nächsten älteren Einträge laden')">{{ $t("⇣ ältere{0}", [loadingOlder ? ' …' : ` (vor #${oldest})`]) }}</button></div>
    </div>
  </div>
</template>
