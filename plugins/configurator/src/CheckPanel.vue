<script setup>
// Ein Beispiel prüfen: Teile wählen (Id oder SKU, Menge) und sehen, was der Server sagt — dieselbe Prüfung wie für einen Shop
// (POST /api/configurator/{key}/check). Zu jedem Teil, das noch dazukommen könnte, steht, ob es geht und warum nicht.
// Die Prüfung gilt für den gespeicherten Stand der Regeln.
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { api, t } from 'journali'
import Cases from './Cases.vue'

const props = defineProps({ configurator: { type: String, required: true }, unsaved: { type: Boolean, default: false } })

const selection = ref([])          // [{ id, amount }]
const result = ref(null)
const error = ref('')
const input = ref('')
const filter = ref('')
let timer = null, ticket = 0

const names = computed(() => Object.fromEntries((result.value?.selection ?? []).map(s => [s.ref, s.name])))
const name = ref => names.value[ref] ?? ref
const available = computed(() => (result.value?.selectable ?? []).filter(c => !filter.value || (c.name ?? '').toLowerCase().includes(filter.value.toLowerCase()) || Object.values(c.keys ?? {}).some(k => String(k).toLowerCase().includes(filter.value.toLowerCase()))))
const balance = computed(() => Object.entries(result.value?.balance ?? {}))

async function run() {
  const mine = ++ticket
  try {
    const r = await api.post(`/api/configurator/${encodeURIComponent(props.configurator)}/check`, { selection: selection.value.map(s => ({ id: s.id, amount: s.amount })), selectable: true })
    if (mine !== ticket) return
    result.value = r; error.value = ''
  } catch (e) { if (mine !== ticket) return; result.value = null; error.value = e.message }
}
function soon() { clearTimeout(timer); timer = setTimeout(run, 200) }
watch(selection, soon, { deep: true })
watch(() => props.configurator, () => { selection.value = []; run() }, { immediate: true })
watch(() => props.unsaved, run)   // gespeichert: dieselbe Auswahl gegen die neuen Regeln
onBeforeUnmount(() => clearTimeout(timer))

function add(id) {
  id = String(id ?? '').trim(); if (!id) return
  const have = selection.value.find(s => s.id === id)
  if (have) have.amount += 1; else selection.value.push({ id, amount: 1 })
  input.value = ''
}
const remove = i => selection.value.splice(i, 1)
const load = sel => { selection.value = sel.map(s => ({ id: s.id, amount: s.amount ?? 1 })) }
const num = v => Number.isInteger(v) ? v : Math.round(v * 100) / 100
const reasonText = c => (c.reasons ?? []).map(r => r.text).join(' · ')
const affects = v => (v.affects ?? []).map(name).join(', ')
</script>

<template>
  <div class="pruef">
    <div v-if="unsaved" class="hinweis muted">{{ $t('Ungespeicherte Änderungen — geprüft wird der gespeicherte Stand') }}</div>
    <div v-if="error" class="neg fehler">✗ {{ error }}</div>

    <div class="spalten">
      <div class="links">
        <div class="step-band">{{ $t('Auswahl') }} · {{ selection.reduce((n, s) => n + s.amount, 0) }}</div>
        <form class="eingabe" @submit.prevent="add(input)">
          <input v-model="input" :placeholder="$t('Id oder SKU')" :title="$t('Id eines Knotens oder der eindeutige Wert eines Attributs, wie ein Shop ihn schickt')" />
          <button type="submit" :disabled="!input.trim()">＋</button>
        </form>
        <table v-if="selection.length" class="grid auswahl"><tbody>
          <tr v-for="(s, i) in selection" :key="s.id">
            <td>{{ name(s.id) }} <span v-if="name(s.id) !== s.id" class="muted">{{ s.id }}</span></td>
            <td style="width:72px"><input v-model.number="s.amount" type="number" min="1" class="zahl" /></td>
            <td style="width:24px"><button type="button" class="x" :title="$t('entfernen')" @click="remove(i)">✕</button></td>
          </tr>
        </tbody></table>
        <div v-else class="muted leer">{{ $t('Noch nichts gewählt') }}</div>

        <template v-if="result">
          <div class="status">
            <span :class="result.valid ? 'pos' : 'neg'" class="chip" :title="$t('Kein Verbot, keine Grenze und keine Ressource im Minus')">{{ result.valid ? '✓ ' + $t('zulässig') : '✗ ' + $t('unzulässig') }}</span>
            <span :class="result.complete ? 'pos' : 'warn'" class="chip" :title="$t('Nichts verlangt, das fehlt')">{{ result.complete ? '✓ ' + $t('vollständig') : '◐ ' + $t('unvollständig') }}</span>
          </div>
          <ul v-if="result.violations.length" class="meldungen neg">
            <li v-for="(v, i) in result.violations" :key="i" :title="affects(v)">✗ {{ v.text }}<span v-if="affects(v)" class="muted"> · {{ affects(v) }}</span></li>
          </ul>
          <ul v-if="result.missing.length" class="meldungen warn">
            <li v-for="(v, i) in result.missing" :key="i" :title="affects(v)">◐ {{ v.text }}<span v-if="affects(v)" class="muted"> · {{ affects(v) }}</span></li>
          </ul>
          <table v-if="balance.length" class="grid bilanz"><thead><tr><th>{{ $t('Ressource') }}</th><th>{{ $t('bereit') }}</th><th>{{ $t('verbraucht') }}</th><th>{{ $t('frei') }}</th></tr></thead><tbody>
            <tr v-for="[res, b] in balance" :key="res"><td>{{ res }}</td><td>{{ num(b.provided) }}</td><td>{{ num(b.consumed) }}</td><td :class="b.free < 0 ? 'neg' : ''">{{ num(b.free) }}</td></tr>
          </tbody></table>
        </template>
        <Cases :configurator="configurator" :selection="selection" :result="result" @load="load" />
      </div>

      <div class="waehlbar">
        <div class="step-band">{{ $t('Wählbar') }} · {{ result?.selectable?.filter(c => c.ok).length ?? 0 }}/{{ result?.selectable?.length ?? 0 }}</div>
        <input v-model="filter" class="filter" :placeholder="$t('filtern')" />
        <table class="grid"><tbody>
          <tr v-for="c in available" :key="c.id" :class="{ gesperrt: !c.ok }" :title="c.ok ? $t('zur Auswahl hinzufügen') : reasonText(c)" @click="c.ok && add(c.id)">
            <td style="width:20px" :class="c.ok ? 'pos' : 'neg'">{{ c.ok ? '✓' : '✗' }}</td>
            <td>{{ c.name }}<span v-for="(v, k) in c.keys" :key="k" class="muted"> · {{ v }}</span></td>
            <td v-if="!c.ok" class="muted grund">{{ reasonText(c) }}</td>
          </tr>
        </tbody></table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pruef { padding: 8px 0; }
.spalten { display: flex; gap: 16px; align-items: flex-start; }
.links { flex: 1; min-width: 320px; }
.waehlbar { flex: 1; min-width: 320px; }
.eingabe { display: flex; gap: 6px; margin: 4px 0; }
.eingabe input { flex: 1; }
.zahl { width: 60px; }
.status { display: flex; gap: 8px; margin: 10px 0 4px; }
.chip { font-weight: 600; }
.meldungen { margin: 4px 0; padding-left: 16px; list-style: none; }
.hinweis { margin: 0 0 6px; }
.leer { padding: 6px 0; }
.filter { width: 100%; margin: 4px 0; }
tr.gesperrt { opacity: .55; cursor: not-allowed; }
tr:not(.gesperrt) { cursor: pointer; }
.grund { font-size: 12px; }
.bilanz { margin-top: 8px; }
.x { border: 0; background: none; color: var(--muted); cursor: pointer; }
.x:hover { color: var(--neg); }
</style>
