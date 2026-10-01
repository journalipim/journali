<script setup>
// { } Schnittstelle: die Beschreibung des Servers (GET /api/openapi.json) lesbar — nach Bereichen gruppiert, mit Suche; ein Klick auf einen Aufruf zeigt
// Parameter, Körper und ein Beispiel. Die Beschreibung wird aus den Endpunkten des laufenden Servers erzeugt, die Ansicht erfindet nichts dazu.
import { ref, computed, onMounted } from 'vue'
import { api } from '../api.js'
import { store } from '../store.js'

const spec = ref(null)
const q = ref('')
const offen = ref(new Set())      // aufgeklappte Bereiche
const zeig = ref(new Set())       // aufgeklappte Aufrufe (Methode + Pfad)
const busy = ref(true)

onMounted(async () => {
  try { spec.value = await api.get('/api/openapi.json') } catch (e) { store.toast(e.message) }
  busy.value = false
})

const METHODEN = ['get', 'post', 'put', 'patch', 'delete']
const aufrufe = computed(() => Object.entries(spec.value?.paths ?? {}).flatMap(([pfad, ops]) =>
  METHODEN.filter(m => ops[m]).map(m => ({ id: m + ' ' + pfad, methode: m, pfad, bereich: ops[m].tags?.[0] ?? 'api', recht: ops[m]['x-recht'] ?? '', op: ops[m] }))))

const gefiltert = computed(() => {
  const w = q.value.trim().toLowerCase()
  return !w ? aufrufe.value : aufrufe.value.filter(a => `${a.methode} ${a.pfad} ${a.recht} ${a.bereich} ${a.op.operationId ?? ''}`.toLowerCase().includes(w))
})
const bereiche = computed(() => {
  const m = new Map()
  for (const a of gefiltert.value) { if (!m.has(a.bereich)) m.set(a.bereich, []); m.get(a.bereich).push(a) }
  return [...m].sort((x, y) => x[0].localeCompare(y[0])).map(([name, liste]) => ({ name, liste }))
})
// Bei einer Suche stehen die Treffer offen, sonst sind die Bereiche zu
const bereichOffen = name => q.value.trim() !== '' || offen.value.has(name)
const umschalten = (menge, k) => { const s = new Set(menge); s.has(k) ? s.delete(k) : s.add(k); return s }
const schalteBereich = k => { offen.value = umschalten(offen.value, k) }
const schalteAufruf = k => { zeig.value = umschalten(zeig.value, k) }

const FARBE = { get: 'var(--pos)', post: 'var(--accent)', put: 'var(--warn)', patch: 'var(--warn)', delete: 'var(--neg)' }
const typ = s => s?.type === 'array' ? `${typ(s.items)}[]` : s?.type === 'object' && s.additionalProperties ? `{ ${typ(s.additionalProperties)} }` : s?.enum ? s.enum.join(' | ') : (s?.type ?? '')
const koerper = a => a.op.requestBody?.content?.['application/json']?.schema
/// Das Beispiel: curl mit Token; Pfadteile als <name>, ein Körper aus dem Schema (Platzhalter nach Typ)
function beispiel(a) {
  const pfad = a.pfad.replace(/\{([^}]+)\}/g, '<$1>')
  const k = koerper(a)
  const platz = s => s?.type === 'object' ? Object.fromEntries(Object.entries(s.properties ?? {}).map(([n, v]) => [n, platz(v)])) : s?.type === 'array' ? [platz(s.items)] : s?.type === 'integer' || s?.type === 'number' ? 0 : s?.type === 'boolean' ? false : ''
  return `curl -X ${a.methode.toUpperCase()} -H "Authorization: Bearer $TOKEN"${k ? ` -H "Content-Type: application/json" -d '${JSON.stringify(platz(k))}'` : ''} "https://<server>${pfad}"`
}
</script>

<template>
  <div class="pane" style="flex:1">
    <div class="toolbar">
      <h1>{{ $t("{ } Schnittstelle") }}</h1>
      <span class="muted" :title="$t('Aufrufe')">{{ aufrufe.length }}</span>
      <input v-model="q" type="search" :placeholder="$t('Pfad, Methode, Recht …')" style="width:260px" />
      <span class="grow" />
      <a href="/api/openapi.json" target="_blank" rel="noopener" class="muted" :title="$t('Die Beschreibung als OpenAPI 3.0 (JSON)')">openapi.json</a>
    </div>
    <div class="scroll">
      <div v-if="busy" class="empty">{{ $t("lade …") }}</div>
      <div v-for="b in bereiche" :key="b.name" class="section bereich">
        <h2 style="cursor:pointer" @click="schalteBereich(b.name)">{{ bereichOffen(b.name) ? '▾' : '▸' }} {{ b.name }} <span class="muted">· {{ b.liste.length }}</span></h2>
        <div v-if="bereichOffen(b.name)">
          <div v-for="a in b.liste" :key="a.id" class="aufruf">
            <div class="kopf" style="display:flex;gap:8px;align-items:center;padding:3px 8px;cursor:pointer" @click="schalteAufruf(a.id)">
              <span class="methode mono" :style="`color:${FARBE[a.methode]};width:58px;font-weight:600`">{{ a.methode.toUpperCase() }}</span>
              <span class="mono" style="flex:1">{{ a.pfad }}</span>
              <span class="chip recht" :title="$t('Das Recht, das der Aufruf braucht')">{{ a.recht }}</span>
            </div>
            <div v-if="zeig.has(a.id)" class="einzelheiten" style="padding:4px 8px 10px 74px">
              <table v-if="a.op.parameters?.length" class="grid" style="width:auto">
                <thead><tr><th>{{ $t("Parameter") }}</th><th>{{ $t("in") }}</th><th>{{ $t("Typ") }}</th><th /></tr></thead>
                <tbody>
                  <tr v-for="p in a.op.parameters" :key="p.in + p.name"><td class="mono">{{ p.name }}</td><td class="muted">{{ p.in === 'path' ? $t('Pfad') : $t('Abfrage') }}</td><td class="mono muted">{{ typ(p.schema) }}</td><td>{{ p.required ? '●' : '' }}</td></tr>
                </tbody>
              </table>
              <div v-if="koerper(a)" style="margin-top:6px"><b>{{ $t("Körper") }}</b> <span class="muted">JSON</span><pre class="mono schema" style="margin:2px 0;font-size:11px;white-space:pre-wrap">{{ JSON.stringify(koerper(a), null, 1) }}</pre></div>
              <pre class="mono beispiel" style="margin:6px 0 0;font-size:11px;white-space:pre-wrap">{{ beispiel(a) }}</pre>
            </div>
          </div>
        </div>
      </div>
      <div v-if="!busy && !bereiche.length" class="empty">{{ $t("keine Treffer") }}</div>
    </div>
  </div>
</template>

<style scoped>
/* 299 Aufrufe in einer Liste: die Bereichszeilen dicht an dicht, nicht mit dem Abstand eines Abschnitts */
.bereich { padding: 0; }
.bereich h2 { margin: 0; }
.bereich > div { padding-bottom: 4px; }
.aufruf:hover > .kopf { background: var(--accent-soft); }
.chip.recht { font-size: 11px; }
</style>
