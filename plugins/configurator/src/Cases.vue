<script setup>
// Testfälle: eine Auswahl mit dem, was der Server dazu sagen soll (zulässig, vollständig, welche Regeln verletzt sind oder fehlen).
// Sie stehen als Plugin-Daten im Journal (case:<konfigurator>:<name>). Nach jeder Änderung an den Regeln zeigt „Alle prüfen“, was sich verschoben hat.
import { ref, computed, watch, onMounted } from 'vue'
import { api, store, dialog, t } from 'journali'
import { expectFrom, compareCase } from './model.js'

const props = defineProps({ configurator: { type: String, required: true }, selection: { type: Array, default: () => [] }, result: { type: Object, default: null } })
const emit = defineEmits(['load'])

const cases = ref({})              // dataName → { label, selection, expect }
const outcome = ref({})            // dataName → { ok, differences } | { error }
const newName = ref('')
const busy = ref(false)

const prefix = computed(() => `case:${props.configurator}:`)
const dataName = label => prefix.value + String(label).trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '')
const rows = computed(() => Object.entries(cases.value).map(([key, c]) => ({ key, ...c })))
const passed = computed(() => rows.value.filter(r => outcome.value[r.key]?.ok).length)

async function load() {
  try { cases.value = await api.get(`/api/plugins/configurator/data?prefix=${encodeURIComponent(prefix.value)}&values=true`) ?? {} } catch { cases.value = {} }
  outcome.value = {}
}
onMounted(load)
watch(() => props.configurator, load)

const canSave = computed(() => !!newName.value.trim() && !!props.result && dataName(newName.value) !== prefix.value)
async function save() {
  if (!canSave.value) return
  const key = dataName(newName.value)
  const body = { label: newName.value.trim(), selection: props.selection.map(s => ({ id: s.id, amount: s.amount })), expect: expectFrom(props.result) }
  try {
    await api.post(`/api/plugins/configurator/data/${encodeURIComponent(key)}`, body, 'PUT')
    newName.value = ''
    await load()
    store.toast(t('Testfall gespeichert'), 'ok')
  } catch (e) { store.toast(e.message) }
}

async function remove(r) {
  const ok = await dialog.confirm({ title: t('Testfall entfernen'), text: r.label, ok: t('Entfernen'), danger: true })
  if (!ok) return
  try { await api.del(`/api/plugins/configurator/data/${encodeURIComponent(r.key)}`); await load() } catch (e) { store.toast(e.message) }
}

async function runAll() {
  busy.value = true
  const next = {}
  for (const r of rows.value) {
    try {
      const res = await api.post(`/api/configurator/${encodeURIComponent(props.configurator)}/check`, { selection: r.selection, selectable: false })
      next[r.key] = compareCase(r.expect ?? {}, res)
    } catch (e) { next[r.key] = { ok: false, error: e.message, differences: [] } }
  }
  outcome.value = next
  busy.value = false
}

const KIND = { valid: t('zulässig'), complete: t('vollständig'), violations: t('Verstoss'), missing: t('fehlt') }
function difference(d) {
  const what = KIND[d.what] ?? d.what
  if (d.what === 'valid' || d.what === 'complete') return t('{0}: erwartet {1}, ist {2}', [what, d.expected ? t('ja') : t('nein'), d.actual ? t('ja') : t('nein')])
  return d.expected ? t('{0} {1} erwartet, aber nicht da', [what, d.expected]) : t('{0} {1} ist neu', [what, d.actual])
}
const text = key => { const o = outcome.value[key]; return !o ? '' : o.error ?? o.differences.map(difference).join(' · ') }
</script>

<template>
  <div class="faelle">
    <div class="step-band">{{ $t('Testfälle') }} · {{ rows.length }}</div>
    <div class="kopf">
      <input v-model="newName" :placeholder="$t('Name des Testfalls')" @keydown.enter="save" />
      <button type="button" :disabled="!canSave" :title="$t('Die Auswahl mit dem jetzigen Ergebnis als Testfall merken')" @click="save">{{ $t('Speichern') }}</button>
      <span class="grow" />
      <button type="button" :disabled="busy || !rows.length" :title="$t('Jede Auswahl gegen die Regeln prüfen und mit dem erwarteten Ergebnis vergleichen')" @click="runAll">▶ {{ $t('Alle prüfen') }}<template v-if="Object.keys(outcome).length"> · {{ passed }}/{{ rows.length }}</template></button>
    </div>
    <table v-if="rows.length" class="grid"><tbody>
      <tr v-for="r in rows" :key="r.key">
        <td style="width:20px" :class="outcome[r.key] ? (outcome[r.key].ok ? 'pos' : 'neg') : 'muted'">{{ outcome[r.key] ? (outcome[r.key].ok ? '✓' : '✗') : '·' }}</td>
        <td>{{ r.label }} <span class="muted">{{ r.selection.length }}</span><div v-if="text(r.key)" class="neg diff">{{ text(r.key) }}</div></td>
        <td style="width:56px;text-align:right;white-space:nowrap">
          <button type="button" class="x" :title="$t('Auswahl laden')" @click="emit('load', r.selection)">⤓</button>
          <button type="button" class="x" :title="$t('entfernen')" @click="remove(r)">✕</button>
        </td>
      </tr>
    </tbody></table>
  </div>
</template>

<style scoped>
.faelle { margin-top: 14px; }
.kopf { display: flex; gap: 6px; align-items: center; margin: 4px 0; }
.kopf input { flex: 1; min-width: 120px; }
.diff { font-size: 12px; }
.x { border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 4px; }
.x:hover { color: var(--accent); }
</style>
